import { db, ensureDbReady } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    await ensureDbReady()
    const id = req.nextUrl.searchParams.get('id')
    if (id) {
      const po = await db.purchaseOrder.findUnique({
        where: { id },
        include: { supplier: true, items: true },
      })
      return NextResponse.json(po)
    }
    const orders = await db.purchaseOrder.findMany({
      include: { supplier: true, items: true },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(orders)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const { items, ...poData } = body
    const count = await db.purchaseOrder.count()
    const orderNo = `PO-${String(count + 1).padStart(6, '0')}`

    const totalAmount = items.reduce((s: number, i: { total: number }) => s + i.total, 0)

    const po = await db.purchaseOrder.create({
      data: {
        ...poData,
        orderNo,
        totalAmount,
        items: { create: items },
      },
      include: { items: true, supplier: true },
    })
    return NextResponse.json(po, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create purchase order'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const { id, status } = body
    const po = await db.purchaseOrder.update({ where: { id }, data: { status } })
    return NextResponse.json(po)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update purchase order'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
