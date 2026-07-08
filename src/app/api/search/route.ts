import { db, ensureDbReady } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    await ensureDbReady()
    const q = req.nextUrl.searchParams.get('q')
    if (!q) return NextResponse.json([], { status: 200 })

    const medicines = await db.medicine.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { genericName: { contains: q } },
          { brandName: { contains: q } },
          { manufacturer: { contains: q } },
        ],
      },
      include: { category: true, batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } } },
      take: 20,
    })
    return NextResponse.json(medicines)
  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
