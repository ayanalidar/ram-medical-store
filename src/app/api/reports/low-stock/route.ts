import { NextResponse } from 'next/server'
import { db, ensureDbReady } from '@/lib/db'

// GET /api/reports/low-stock - Low stock medicines
export async function GET() {
  try {
    await ensureDbReady()
    const medicines = await db.medicine.findMany({
      include: {
        category: true,
        batches: true,
      },
      orderBy: { name: 'asc' },
    })

    const lowStockItems = medicines
      .map((m) => {
        const totalStock = m.batches.reduce((sum, b) => sum + b.quantity, 0)
        const availableBatches = m.batches.filter((b) => b.quantity > 0)
        const nearestExpiry = availableBatches.length > 0
          ? availableBatches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0].expiryDate
          : null

        return {
          id: m.id,
          name: m.name,
          genericName: m.genericName,
          manufacturer: m.manufacturer,
          category: m.category.name,
          totalStock,
          reorderLevel: m.reorderLevel,
          reorderQty: m.reorderQty,
          isLowStock: totalStock <= m.reorderLevel,
          nearestExpiry,
        }
      })
      .filter((m) => m.isLowStock)

    return NextResponse.json({
      count: lowStockItems.length,
      items: lowStockItems,
    })
  } catch (error) {
    console.error('Error generating low stock report:', error)
    return NextResponse.json({ error: 'Failed to generate low stock report' }, { status: 500 })
  }
}