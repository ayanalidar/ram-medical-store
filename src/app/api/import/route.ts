import { db, ensureDbReady } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const text = buffer.toString('utf-8')

    // Parse CSV (comma or tab separated)
    const lines = text.trim().split('\n')
    if (lines.length < 2) return NextResponse.json({ error: 'File must have header and data rows' }, { status: 400 })

    const separator = lines[0].includes('\t') ? '\t' : ','
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase())

    let imported = 0
    let errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map(v => v.trim())
      if (values.length < 3) continue

      const getValue = (field: string) => {
        const idx = headers.indexOf(field)
        return idx >= 0 ? values[idx] : ''
      }

      try {
        const name = getValue('name') || getValue('medicine_name') || getValue('medicine')
        const genericName = getValue('generic_name') || getValue('genericname') || getValue('generic')
        const category = getValue('category') || 'General'
        const batchNo = getValue('batch_no') || getValue('batchno') || getValue('batch') || `BATCH-${Date.now()}`
        const expiryDate = getValue('expiry_date') || getValue('expirydate') || getValue('expiry')
        const purchasePrice = parseFloat(getValue('purchase_price') || getValue('purchaseprice') || getValue('cost') || '0')
        const sellingPrice = parseFloat(getValue('selling_price') || getValue('sellingprice') || getValue('price') || getValue('mrp') || '0')
        const quantity = parseInt(getValue('quantity') || getValue('qty') || '0')
        const manufacturer = getValue('manufacturer') || ''
        const strength = getValue('strength') || ''
        const unit = getValue('unit') || 'Strip'

        if (!name) continue

        // Upsert category
        let cat = await db.category.findUnique({ where: { name: category } })
        if (!cat) {
          cat = await db.category.create({ data: { name: category } })
        }

        // Create medicine
        const medicine = await db.medicine.create({
          data: {
            name,
            genericName: genericName || null,
            categoryId: cat.id,
            manufacturer: manufacturer || null,
            strength: strength || null,
            unit,
          },
        })

        // Create batch
        if (expiryDate && quantity > 0) {
          const expDate = new Date(expiryDate)
          await db.medicineBatch.create({
            data: {
              medicineId: medicine.id,
              batchNo,
              expiryDate: isNaN(expDate.getTime()) ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : expDate,
              purchasePrice,
              sellingPrice: sellingPrice || purchasePrice,
              quantity,
            },
          })
        }

        imported++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        errors.push(`Row ${i + 1}: ${msg}`)
      }
    }

    return NextResponse.json({ imported, errors, total: lines.length - 1 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Import failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
