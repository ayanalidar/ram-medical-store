import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDbReady } from '@/lib/db'

// PUT /api/purchases/receive - Receive purchase order (add stock from received items)
export async function PUT(request: NextRequest) {
  try {
    await ensureDbReady()
    const body = await request.json()
    const { id, items } = body

    if (!id) {
      return NextResponse.json({ error: 'Purchase order ID is required' }, { status: 400 })
    }

    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true, supplier: true },
    })
    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (purchaseOrder.status === 'Received') {
      return NextResponse.json({ error: 'Purchase order is already received' }, { status: 400 })
    }

    // Process received items
    const receivedItems = items || purchaseOrder.items
    for (const item of receivedItems) {
      const orderItem = purchaseOrder.items.find((oi) => oi.id === item.id)
      if (!orderItem) continue

      const receiveQty = Number(item.receivedQty || item.quantity || 0)
      if (receiveQty <= 0) continue

      // Update received quantity
      await db.purchaseOrderItem.update({
        where: { id: orderItem.id },
        data: { receivedQty: (orderItem.receivedQty || 0) + receiveQty },
      })

      // Create or update batch
      if (orderItem.batchNo) {
        const existingBatch = await db.medicineBatch.findFirst({
          where: { medicineId: orderItem.medicineId, batchNo: orderItem.batchNo },
        })

        if (existingBatch) {
          await db.medicineBatch.update({
            where: { id: existingBatch.id },
            data: { quantity: existingBatch.quantity + receiveQty },
          })
        } else {
          await db.medicineBatch.create({
            data: {
              medicineId: orderItem.medicineId,
              batchNo: orderItem.batchNo,
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              purchasePrice: orderItem.unitPrice,
              sellingPrice: orderItem.unitPrice * 1.2,
              quantity: receiveQty,
              supplierId: purchaseOrder.supplierId,
              purchaseDate: new Date(),
            },
          })
        }
      }
    }

    // Update PO status
    const updatedOrder = await db.purchaseOrder.update({
      where: { id },
      data: { status: 'Received' },
      include: { supplier: true, items: true },
    })

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('Error receiving purchase order:', error)
    return NextResponse.json({ error: 'Failed to receive purchase order' }, { status: 500 })
  }
}