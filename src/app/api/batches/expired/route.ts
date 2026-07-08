import { NextResponse } from 'next/server'
import { db, ensureDbReady } from '@/lib/db'

// GET /api/batches/expired - Get already expired batches
export async function GET() {
  try {
    await ensureDbReady()
    const batches = await db.medicineBatch.findMany({
      where: {
        expiryDate: { lt: new Date() },
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
    console.error('Error fetching expired batches:', error)
    return NextResponse.json({ error: 'Failed to fetch expired batches' }, { status: 500 })
  }
}