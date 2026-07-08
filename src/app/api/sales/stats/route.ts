import { NextResponse } from 'next/server'
import { db, ensureDbReady } from '@/lib/db'

// GET /api/sales/stats - Get sales stats
export async function GET() {
  try {
    await ensureDbReady()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    const [todaySales, weekSales, monthSales, allSales] = await Promise.all([
      db.sale.aggregate({
        where: { date: { gte: today } },
        _sum: { total: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { date: { gte: startOfWeek } },
        _sum: { total: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { date: { gte: startOfMonth } },
        _sum: { total: true },
        _count: true,
      }),
      db.sale.aggregate({
        _sum: { total: true },
        _count: true,
      }),
    ])

    return NextResponse.json({
      today: {
        total: todaySales._sum.total || 0,
        count: todaySales._count,
      },
      thisWeek: {
        total: weekSales._sum.total || 0,
        count: weekSales._count,
      },
      thisMonth: {
        total: monthSales._sum.total || 0,
        count: monthSales._count,
      },
      allTime: {
        totalRevenue: allSales._sum.total || 0,
        totalOrders: allSales._count,
      },
    })
  } catch (error) {
    console.error('Error fetching sales stats:', error)
    return NextResponse.json({ error: 'Failed to fetch sales stats' }, { status: 500 })
  }
}