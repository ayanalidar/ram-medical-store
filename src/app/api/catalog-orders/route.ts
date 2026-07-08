import { db, ensureDbReady } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST - Create a catalog/home delivery order
export async function POST(request: Request) {
  try {
    await ensureDbReady()
    const body = await request.json()
    const { customerName, customerPhone, customerAddress, items, notes, paymentMethod } = body

    if (!customerName || !customerPhone || !items || items.length === 0) {
      return NextResponse.json({ error: 'Customer name, phone and at least one item are required' }, { status: 400 })
    }

    // Generate order number
    const orderCount = await db.sale.count()
    const invoiceNo = `HD-${String(orderCount + 1).padStart(6, '0')}`

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0)
    const deliveryCharge = 20
    const total = subtotal + deliveryCharge

    // Process items and reduce stock (FEFO - First Expired First Out)
    const processedItems: any[] = []
    for (const item of items) {
      if (!item.medicineId || !item.medicineName) continue
      let remaining = item.quantity

      // Find batches for this medicine, ordered by expiry (FEFO)
      const batches = await db.medicineBatch.findMany({
        where: { medicineId: item.medicineId, quantity: { gt: 0 } },
        orderBy: { expiryDate: 'asc' },
      })

      for (const batch of batches) {
        if (remaining <= 0) break
        const take = Math.min(remaining, batch.quantity)
        processedItems.push({
          medicineId: item.medicineId,
          batchId: batch.id,
          medicineName: item.medicineName,
          quantity: take,
          unitPrice: item.unitPrice,
          discount: 0,
          tax: 0,
          total: take * item.unitPrice,
        })
        // Reduce stock
        await db.medicineBatch.update({
          where: { id: batch.id },
          data: { quantity: { decrement: take } },
        })
        remaining -= take
      }
    }

    if (processedItems.length === 0) {
      return NextResponse.json({ error: 'No items could be processed - stock may be insufficient' }, { status: 400 })
    }

    // Create the order as a Sale
    const sale = await db.sale.create({
      data: {
        invoiceNo,
        customerName,
        customerPhone,
        subtotal,
        discount: 0,
        tax: 0,
        total,
        paymentMethod: paymentMethod || 'Cash on Delivery',
        status: 'Pending',
        prescription: JSON.stringify({ type: 'home_delivery', address: customerAddress || '', notes: notes || '', deliveryCharge }),
        items: { create: processedItems },
      },
    })

    return NextResponse.json({
      success: true,
      orderId: sale.id,
      invoiceNo,
      total,
      deliveryCharge,
    })
  } catch (error) {
    console.error('[Catalog Order] Error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}

// GET - List all catalog/home delivery orders
export async function GET() {
  try {
    await ensureDbReady()
    const orders = await db.sale.findMany({
      where: { invoiceNo: { startsWith: 'HD-' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: true },
    })
    return NextResponse.json(orders)
  } catch (error) {
    console.error('[Catalog Orders] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
