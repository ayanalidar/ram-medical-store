import { NextResponse } from 'next/server'
import { db, ensureDbReady } from '@/lib/db'

// GET /api/reports/sales-summary - Sales summary by period
export async function GET(request: Request) {
  try {
    await ensureDbReady()
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // day, week, month
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {}
    if (startDate || endDate) {
      where.date = {}
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate)
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate)
    }

    const sales = await db.sale.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'asc' },
    })

    // Group by period
    const grouped: Record<string, { count: number; total: number; subtotal: number; discount: number; tax: number }> = {}

    for (const sale of sales) {
      let key: string
      const date = new Date(sale.date)

      if (period === 'day') {
        key = date.toISOString().split('T')[0]
      } else if (period === 'week') {
        const day = date.getDay()
        const diff = date.getDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(date)
        monday.setDate(diff)
        key = monday.toISOString().split('T')[0]
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }

      if (!grouped[key]) {
        grouped[key] = { count: 0, total: 0, subtotal: 0, discount: 0, tax: 0 }
      }
      grouped[key].count++
      grouped[key].total += sale.total
      grouped[key].subtotal += sale.subtotal
      grouped[key].discount += sale.discount
      grouped[key].tax += sale.tax
    }

    const summary = Object.entries(grouped).map(([period_key, data]) => ({
      period: period_key,
      ...data,
    }))

    return NextResponse.json({ period, data: summary })
  } catch (error) {
    console.error('Error generating sales summary:', error)
    return NextResponse.json({ error: 'Failed to generate sales summary' }, { status: 500 })
  }
}