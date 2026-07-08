import { db, ensureDbReady } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    await ensureDbReady()
    const id = req.nextUrl.searchParams.get('id')
    if (id) {
      const supplier = await db.supplier.findUnique({
        where: { id },
        include: { _count: { select: { purchaseOrders: true } } },
      })
      return NextResponse.json(supplier)
    }
    const suppliers = await db.supplier.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { purchaseOrders: true } } },
    })
    return NextResponse.json(suppliers)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const supplier = await db.supplier.create({ data: body })
    return NextResponse.json(supplier, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create supplier'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const { id, ...data } = body
    const supplier = await db.supplier.update({ where: { id }, data })
    return NextResponse.json(supplier)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update supplier'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDbReady()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    await db.supplier.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete supplier'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
