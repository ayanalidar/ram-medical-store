import { db, ensureDbReady } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    await ensureDbReady()
    const type = req.nextUrl.searchParams.get('type')

    if (type === 'sales-summary') {
      const startDate = req.nextUrl.searchParams.get('startDate')
      const endDate = req.nextUrl.searchParams.get('endDate')
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
      })
      const summary = sales.reduce((acc: Record<string, unknown>, sale) => {
        const key = new Date(sale.date).toLocaleDateString()
        if (!acc[key]) acc[key] = { date: key, sales: 0, profit: 0, count: 0 }
        ;(acc[key] as { sales: number }).sales += sale.total
        ;(acc[key] as { count: number }).count += 1
        return acc
      }, {})
      return NextResponse.json(Object.values(summary))
    }

    if (type === 'profit-report') {
      const sales = await db.sale.findMany({
        include: { items: { include: { batch: true } } },
        orderBy: { date: 'desc' },
        take: 200,
      })
      const report = sales.map(sale => ({
        invoiceNo: sale.invoiceNo,
        date: sale.date,
        revenue: sale.total,
        cost: sale.items.reduce((sum, item) => sum + (item.quantity * (item.batch?.purchasePrice || 0)), 0),
        profit: sale.total - sale.items.reduce((sum, item) => sum + (item.quantity * (item.batch?.purchasePrice || 0)), 0),
      }))
      const totals = report.reduce((acc, r) => {
        acc.revenue += r.revenue
        acc.cost += r.cost
        acc.profit += r.profit
        return acc
      }, { revenue: 0, cost: 0, profit: 0 })
      return NextResponse.json({ transactions: report, totals })
    }

    if (type === 'inventory-valuation') {
      const batches = await db.medicineBatch.findMany({
        include: { medicine: true },
        where: { quantity: { gt: 0 } },
      })
      const valuation = batches.map(b => ({
        medicineName: b.medicine.name,
        batchNo: b.batchNo,
        quantity: b.quantity,
        purchasePrice: b.purchasePrice,
        sellingPrice: b.sellingPrice,
        totalValue: b.quantity * b.purchasePrice,
        potentialRevenue: b.quantity * b.sellingPrice,
      }))
      const totalCost = valuation.reduce((s, v) => s + v.totalValue, 0)
      const totalRevenue = valuation.reduce((s, v) => s + v.potentialRevenue, 0)
      return NextResponse.json({ items: valuation, totalCost, totalRevenue, potentialProfit: totalRevenue - totalCost })
    }

    if (type === 'low-stock') {
      const medicines = await db.medicine.findMany({
        include: { category: true, batches: true },
      })
      const lowStock = medicines.filter(m => {
        const total = m.batches.reduce((s, b) => s + b.quantity, 0)
        return total <= m.reorderLevel
      }).map(m => ({
        id: m.id,
        name: m.name,
        genericName: m.genericName,
        category: m.category.name,
        currentStock: m.batches.reduce((s, b) => s + b.quantity, 0),
        reorderLevel: m.reorderLevel,
        reorderQty: m.reorderQty,
      }))
      return NextResponse.json(lowStock)
    }

    if (type === 'expiry-report') {
      const now = new Date()
      const batches = await db.medicineBatch.findMany({
        include: { medicine: { include: { category: true } } },
        orderBy: { expiryDate: 'asc' },
      })
      const report = batches.map(b => ({
        id: b.id,
        medicineName: b.medicine.name,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        quantity: b.quantity,
        daysToExpiry: Math.ceil((b.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        status: b.expiryDate <= now ? 'Expired' : b.expiryDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) ? 'Critical' : b.expiryDate <= new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) ? 'Warning' : 'OK',
      }))
      return NextResponse.json(report)
    }

    return NextResponse.json({ error: 'Specify report type' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
