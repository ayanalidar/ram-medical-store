import { NextResponse } from 'next/server'
import { db, ensureDbReady } from '@/lib/db'

// GET /api/reports/expiry-report - Expiry report
export async function GET() {
  try {
    await ensureDbReady()
    const now = new Date()
    const thirtyDays = new Date(now)
    thirtyDays.setDate(now.getDate() + 30)

    const ninetyDays = new Date(now)
    ninetyDays.setDate(now.getDate() + 90)

    const batches = await db.medicineBatch.findMany({
      where: {
        quantity: { gt: 0 },
      },
      include: {
        medicine: {
          include: { category: true },
        },
        supplier: true,
      },
      orderBy: { expiryDate: 'asc' },
    })

    const expired = batches.filter((b) => new Date(b.expiryDate) < now)
    const expiringWithin30Days = batches.filter((b) => {
      const exp = new Date(b.expiryDate)
      return exp >= now && exp <= thirtyDays
    })
    const expiringWithin90Days = batches.filter((b) => {
      const exp = new Date(b.expiryDate)
      return exp > thirtyDays && exp <= ninetyDays
    })

    const formatBatch = (b: typeof batches[0]) => ({
      batchId: b.id,
      medicineId: b.medicineId,
      medicineName: b.medicine.name,
      category: b.medicine.category.name,
      batchNo: b.batchNo,
      quantity: b.quantity,
      expiryDate: b.expiryDate,
      daysUntilExpiry: Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      purchasePrice: b.purchasePrice,
      sellingPrice: b.sellingPrice,
      totalValue: b.sellingPrice * b.quantity,
      supplier: b.supplier?.name || null,
    })

    return NextResponse.json({
      summary: {
        expiredCount: expired.length,
        expiredValue: expired.reduce((sum, b) => sum + b.sellingPrice * b.quantity, 0),
        expiring30Count: expiringWithin30Days.length,
        expiring30Value: expiringWithin30Days.reduce((sum, b) => sum + b.sellingPrice * b.quantity, 0),
        expiring90Count: expiringWithin90Days.length,
        expiring90Value: expiringWithin90Days.reduce((sum, b) => sum + b.sellingPrice * b.quantity, 0),
      },
      expired: expired.map(formatBatch),
      expiringWithin30Days: expiringWithin30Days.map(formatBatch),
      expiringWithin90Days: expiringWithin90Days.map(formatBatch),
    })
  } catch (error) {
    console.error('Error generating expiry report:', error)
    return NextResponse.json({ error: 'Failed to generate expiry report' }, { status: 500 })
  }
}