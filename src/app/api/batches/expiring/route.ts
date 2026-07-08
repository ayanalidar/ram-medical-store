import { NextResponse } from 'next/server'
import { db, ensureDbReady } from '@/lib/db'

// GET /api/batches/expiring - Get batches expiring within 90 days
export async function GET() {
  try {
    await ensureDbReady()
    const ninetyDaysFromNow = new Date()
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)

    const batches = await db.medicineBatch.findMany({
      where: {
        expiryDate: {
          gt: new Date(),
          lte: ninetyDaysFromNow,
        },
        quantity: { gt: 0 },
      },
      include: {
        medicine: { include: { category: true } },
        supplier: true,
      },
      orderBy: { expiryDate: 'asc' },
    })
    return NextResponse.json(batches)
  } catch (error) {
    console.error('Error fetching expiring batches:', error)
    return NextResponse.json({ error: 'Failed to fetch expiring batches' }, { status: 500 })
  }
}