import { NextResponse } from 'next/server'
import { db, ensureDbReady } from '@/lib/db'

// GET /api/reports/inventory-valuation - Current inventory valuation
export async function GET() {
  try {
    await ensureDbReady()
    const batches = await db.medicineBatch.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        medicine: {
          include: { category: true },
        },
        supplier: true,
      },
    })

    let totalCost = 0
    let totalRetail = 0
    let totalItems = 0

    const valuation = batches.map((b) => {
      const cost = b.purchasePrice * b.quantity
      const retail = b.sellingPrice * b.quantity
      totalCost += cost
      totalRetail += retail
      totalItems += b.quantity

      return {
        medicineId: b.medicineId,
        medicineName: b.medicine.name,
        category: b.medicine.category.name,
        batchNo: b.batchNo,
        quantity: b.quantity,
        purchasePrice: b.purchasePrice,
        sellingPrice: b.sellingPrice,
        costValue: cost,
        retailValue: retail,
        expiryDate: b.expiryDate,
      }
    })

    // Group by category
    const byCategory: Record<string, { costValue: number; retailValue: number; items: number }> = {}
    for (const v of valuation) {
      if (!byCategory[v.category]) {
        byCategory[v.category] = { costValue: 0, retailValue: 0, items: 0 }
      }
      byCategory[v.category].costValue += v.costValue
      byCategory[v.category].retailValue += v.retailValue
      byCategory[v.category].items += v.items
    }

    return NextResponse.json({
      summary: {
        totalBatches: batches.length,
        totalItems,
        totalCostValue: totalCost,
        totalRetailValue: totalRetail,
        potentialProfit: totalRetail - totalCost,
      },
      byCategory,
      details: valuation,
    })
  } catch (error) {
    console.error('Error generating inventory valuation:', error)
    return NextResponse.json({ error: 'Failed to generate inventory valuation' }, { status: 500 })
  }
}