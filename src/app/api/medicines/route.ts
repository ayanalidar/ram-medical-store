import { db, ensureDbReady } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    await ensureDbReady()
    const id = req.nextUrl.searchParams.get('id')
    const categoryId = req.nextUrl.searchParams.get('categoryId')
    const search = req.nextUrl.searchParams.get('search')
    const lowStock = req.nextUrl.searchParams.get('lowStock')

    if (id) {
      const medicine = await db.medicine.findUnique({
        where: { id },
        include: {
          category: true,
          batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } },
          substitutes: { include: { substitute: { include: { category: true, batches: { where: { quantity: { gt: 0 } } } } } } },
          medicines: { include: { medicine: { include: { category: true, batches: { where: { quantity: { gt: 0 } } } } } } },
        },
      })
      return NextResponse.json(medicine)
    }

    const where: Record<string, unknown> = {}
    if (categoryId) where.categoryId = categoryId
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { genericName: { contains: search } },
        { brandName: { contains: search } },
        { manufacturer: { contains: search } },
      ]
    }
    if (lowStock === 'true') {
      where.batches = { some: {} }
    }

    const medicines = await db.medicine.findMany({
      where,
      include: {
        category: true,
        batches: { orderBy: { expiryDate: 'asc' } },
      },
      orderBy: { name: 'asc' },
    })

    const result = lowStock === 'true'
      ? medicines.filter(m => {
          const total = m.batches.reduce((s, b) => s + b.quantity, 0)
          return total <= m.reorderLevel
        })
      : medicines

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch medicines' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const medicine = await db.medicine.create({ data: body })
    return NextResponse.json(medicine, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create medicine'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureDbReady()
    const body = await req.json()
    const { id, ...data } = body
    const medicine = await db.medicine.update({ where: { id }, data })
    return NextResponse.json(medicine)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update medicine'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDbReady()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    await db.medicineBatch.deleteMany({ where: { medicineId: id } })
    await db.medicine.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete medicine'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
