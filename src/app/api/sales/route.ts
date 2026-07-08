import { db, ensureDbReady } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    await ensureDbReady()
    const id = req.nextUrl.searchParams.get('id')
    const startDate = req.nextUrl.searchParams.get('startDate')
    const endDate = req.nextUrl.searchParams.get('endDate')
    const stats = req.nextUrl.searchParams.get('stats')

    if (stats === 'true') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const [todaySales, weekSales, monthSales, allSales] = await Promise.all([
        db.sale.aggregate({ where: { date: { gte: today } }, _sum: { total: true }, _count: true }),
        db.sale.aggregate({ where: { date: { gte: weekStart } }, _sum: { total: true }, _count: true }),
        db.sale.aggregate({ where: { date: { gte: monthStart } }, _sum: { total: true }, _count: true }),
        db.sale.aggregate({ _sum: { total: true }, _count: true }),
      ])

      return NextResponse.json({
        today: { total: todaySales._sum.total || 0, count: todaySales._count },
        week: { total: weekSales._sum.total || 0, count: weekSales._count },
        month: { total: monthSales._sum.total || 0, count: monthSales._count },
        all: { total: allSales._sum.total || 0, count: allSales._count },
      })
    }

    if (id) {
      const sale = await db.sale.findUnique({
        where: { id },
        include: { items: { include: { medicine: true, batch: true } } },
      })
      return NextResponse.json(sale)
    }

    const where: Record<string, unknown> = {}
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const sales = await db.sale.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'desc' },
      take: 100,
    })
    return NextResponse.json(sales)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const { items, ...saleData } = body

    // Generate invoice number
    const count = await db.sale.count()
    const invoiceNo = `INV-${String(count + 1).padStart(6, '0')}`

    // FEFO: Process items and reduce stock from earliest-expiring batches
    const processedItems = []
    for (const item of items) {
      const batches = await db.medicineBatch.findMany({
        where: { medicineId: item.medicineId, quantity: { gt: 0 }, expiryDate: { gt: new Date() } },
        orderBy: { expiryDate: 'asc' },
      })

      let remaining = item.quantity
      let unitCost = 0

      for (const batch of batches) {
        if (remaining <= 0) break
        const take = Math.min(remaining, batch.quantity)
        unitCost = batch.purchasePrice
        await db.medicineBatch.update({
          where: { id: batch.id },
          data: { quantity: { decrement: take } },
        })
        remaining -= take
        processedItems.push({
          saleId: undefined as unknown as string,
          medicineId: item.medicineId,
          batchId: batch.id,
          medicineName: item.medicineName,
          quantity: take,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          tax: item.tax || 0,
          total: take * item.unitPrice - (item.discount || 0) + (item.tax || 0),
        })
      }

      if (remaining > 0) {
        return NextResponse.json({ error: `Insufficient stock for ${item.medicineName}. Need ${item.quantity}, available ${item.quantity - remaining}` }, { status: 400 })
      }
    }

    const sale = await db.sale.create({
      data: {
        ...saleData,
        invoiceNo,
        items: { create: processedItems },
      },
      include: { items: true },
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create sale'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
