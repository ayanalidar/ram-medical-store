import { db, ensureDbReady } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    await ensureDbReady()
    const medicineId = req.nextUrl.searchParams.get('medicineId')
    const expiring = req.nextUrl.searchParams.get('expiring')
    const expired = req.nextUrl.searchParams.get('expired')

    if (expired === 'true') {
      const now = new Date()
      const batches = await db.medicineBatch.findMany({
        where: { expiryDate: { lt: now } },
        include: { medicine: { include: { category: true } } },
        orderBy: { expiryDate: 'asc' },
      })
      return NextResponse.json(batches)
    }

    if (expiring === 'true') {
      const now = new Date()
      const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
      const batches = await db.medicineBatch.findMany({
        where: { expiryDate: { gt: now, lte: ninetyDays } },
        include: { medicine: { include: { category: true } } },
        orderBy: { expiryDate: 'asc' },
      })
      return NextResponse.json(batches)
    }

    if (medicineId) {
      const batches = await db.medicineBatch.findMany({
        where: { medicineId },
        include: { supplier: true },
        orderBy: { expiryDate: 'asc' },
      })
      return NextResponse.json(batches)
    }

    return NextResponse.json({ error: 'Specify medicineId, expiring, or expired' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const batch = await db.medicineBatch.create({ data: body })
    return NextResponse.json(batch, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create batch'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const { id, ...data } = body
    const batch = await db.medicineBatch.update({ where: { id }, data })
    return NextResponse.json(batch)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update batch'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
