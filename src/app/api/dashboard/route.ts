import { db, ensureDbReady } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await ensureDbReady()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalMedicines,
      totalCategories,
      totalSuppliers,
      todaySales,
      weekSales,
      monthSales,
      lowStockCount,
      expiringCount,
      expiredCount,
      recentSales,
      purchaseOrders,
    ] = await Promise.all([
      db.medicine.count(),
      db.category.count(),
      db.supplier.count(),
      db.sale.aggregate({ where: { date: { gte: today } }, _sum: { total: true }, _count: true }),
      db.sale.aggregate({ where: { date: { gte: weekStart } }, _sum: { total: true }, _count: true }),
      db.sale.aggregate({ where: { date: { gte: monthStart } }, _sum: { total: true }, _count: true }),
      db.medicine.count({
        where: { batches: { some: { quantity: { gt: 0 } } } },
      }),
      db.medicineBatch.count({ where: { expiryDate: { gt: now, lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) }, quantity: { gt: 0 } } }),
      db.medicineBatch.count({ where: { expiryDate: { lte: now }, quantity: { gt: 0 } } }),
      db.sale.findMany({ take: 10, orderBy: { date: 'desc' }, include: { items: true } }),
      db.purchaseOrder.count({ where: { status: 'Pending' } }),
    ])

    // Calculate low stock properly
    const allMeds = await db.medicine.findMany({ include: { batches: true } })
    const lowStock = allMeds.filter(m => m.batches.reduce((s, b) => s + b.quantity, 0) <= m.reorderLevel)

    // Monthly revenue for last 6 months
    const monthlyData: { month: string; revenue: number; sales: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const dEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      const result = await db.sale.aggregate({
        where: { date: { gte: d, lte: dEnd } },
        _sum: { total: true },
        _count: true,
      })
      monthlyData.push({
        month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenue: result._sum.total || 0,
        sales: result._count,
      })
    }

    return NextResponse.json({
      stats: {
        totalMedicines,
        totalCategories,
        totalSuppliers,
        todaySales: { total: todaySales._sum.total || 0, count: todaySales._count },
        weekSales: { total: weekSales._sum.total || 0, count: weekSales._count },
        monthSales: { total: monthSales._sum.total || 0, count: monthSales._count },
        lowStockCount: lowStock.length,
        expiringCount,
        expiredCount,
        pendingOrders: purchaseOrders,
      },
      lowStockItems: lowStock.slice(0, 10).map(m => ({
        id: m.id,
        name: m.name,
        genericName: m.genericName,
        stock: m.batches.reduce((s, b) => s + b.quantity, 0),
        reorderLevel: m.reorderLevel,
      })),
      recentSales,
      monthlyData,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 })
  }
}
