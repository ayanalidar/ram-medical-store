import { db, ensureDbReady } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    await ensureDbReady()
    const adjustments = await db.stockAdjustment.findMany({
      orderBy: { date: 'desc' },
      take: 100,
    })
    return NextResponse.json(adjustments)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch adjustments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const { medicineId, batchId, type, quantity, reason } = body

    // Update batch quantity
    if (batchId) {
      if (type === 'Add' || type === 'Return') {
        await db.medicineBatch.update({ where: { id: batchId }, data: { quantity: { increment: quantity } } })
      } else {
        await db.medicineBatch.update({ where: { id: batchId }, data: { quantity: { decrement: quantity } } })
      }
    }

    const adjustment = await db.stockAdjustment.create({
      data: { medicineId, batchId, type, quantity, reason },
    })
    return NextResponse.json(adjustment, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create adjustment'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
