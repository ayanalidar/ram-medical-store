import { db, ensureDbReady } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    await ensureDbReady()
    const medicineId = req.nextUrl.searchParams.get('medicineId')
    if (!medicineId) return NextResponse.json({ error: 'medicineId required' }, { status: 400 })

    const subs = await db.medicineSubstitute.findMany({
      where: { medicineId },
      include: { substitute: { include: { category: true, batches: { where: { quantity: { gt: 0 } } } } } },
    })
    const reverse = await db.medicineSubstitute.findMany({
      where: { substituteId: medicineId },
      include: { medicine: { include: { category: true, batches: { where: { quantity: { gt: 0 } } } } } },
    })
    return NextResponse.json([...subs.map(s => s.substitute), ...reverse.map(r => r.medicine)])
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch substitutes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const { medicineId, substituteId } = body
    const sub = await db.medicineSubstitute.create({
      data: { medicineId, substituteId },
    })
    return NextResponse.json(sub, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to add substitute'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const { medicineId, substituteId } = body
    await db.medicineSubstitute.deleteMany({
      where: {
        OR: [
          { medicineId, substituteId },
          { medicineId: substituteId, substituteId: medicineId },
        ],
      },
    })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to remove substitute'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
