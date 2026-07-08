import { NextResponse } from 'next/server'
import { db, ensureDbReady } from '@/lib/db'

// GET /api/reports/profit-report - Profit report (sales vs cost)
export async function GET(request: Request) {
  try {
    await ensureDbReady()
    const { searchParams } = new URL(request.url)
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
      include: {
        items: {
          include: {
            batch: true,
            medicine: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    })

    let totalRevenue = 0
    let totalCost = 0
    const itemDetails: Array<{
      date: string
      invoiceNo: string
      medicineName: string
      quantity: number
      sellingPrice: number
      costPrice: number
      profit: number
    }> = []

    for (const sale of sales) {
      totalRevenue += sale.total
      for (const item of sale.items) {
        const costPrice = item.batch?.purchasePrice || item.unitPrice * 0.7
        const cost = costPrice * item.quantity
        totalCost += cost
        itemDetails.push({
          date: sale.date.toISOString().split('T')[0],
          invoiceNo: sale.invoiceNo,
          medicineName: item.medicineName || item.medicine.name,
          quantity: item.quantity,
          sellingPrice: item.unitPrice,
          costPrice,
          profit: (item.unitPrice - costPrice) * item.quantity,
        })
      }
    }

    return NextResponse.json({
      period: { startDate: startDate || null, endDate: endDate || null },
      totalRevenue,
      totalCost,
      grossProfit: totalRevenue - totalCost,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      items: itemDetails,
    })
  } catch (error) {
    console.error('Error generating profit report:', error)
    return NextResponse.json({ error: 'Failed to generate profit report' }, { status: 500 })
  }
}