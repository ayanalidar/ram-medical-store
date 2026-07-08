import { db, ensureDbReady } from '@/lib/db'
import { NextResponse } from 'next/server'

// Simple password hash (same as login)
function simpleHash(password: string): string {
  let hash = 0
  const str = password + '_ram_medical_salt_2024'
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length
}

const DEFAULT_ADMIN_HASH = simpleHash('admin123')

// Auto-seeds database on first visit — no terminal needed!
export async function GET() {
  try {
    await ensureDbReady()
    // Check if data already exists
    const medCount = await db.medicine.count()
    if (medCount > 0) {
      // Check if admin password was changed from default
      const admin = await db.user.findUnique({ where: { username: 'admin' } })
      const defaultPasswordChanged = admin ? admin.password !== DEFAULT_ADMIN_HASH : true
      return NextResponse.json({ status: 'already_setup', medicines: medCount, defaultPasswordChanged })
    }

    // Create default admin user if not exists
    const adminExists = await db.user.findUnique({ where: { username: 'admin' } })
    if (!adminExists) {
      await db.user.create({
        data: {
          name: 'Admin',
          username: 'admin',
          password: simpleHash('admin123'),
          role: 'Admin',
          phone: null,
        },
      })
    }

    // Create categories
    const categories = [
      { name: 'Analgesics', description: 'Pain relievers and fever reducers' },
      { name: 'Antibiotics', description: 'Anti-bacterial medications' },
      { name: 'Vitamins & Supplements', description: 'Nutritional supplements' },
      { name: 'Cardiovascular', description: 'Heart and blood pressure medications' },
      { name: 'Gastrointestinal', description: 'Digestive system medications' },
      { name: 'Respiratory', description: 'Cough, cold and allergy medications' },
      { name: 'Dermatology', description: 'Skin care medications' },
      { name: 'Diabetes', description: 'Blood sugar management medications' },
      { name: 'Eye & Ear Care', description: 'Ophthalmic and otic preparations' },
      { name: 'First Aid', description: 'Bandages, antiseptics, and emergency supplies' },
    ]
    for (const c of categories) {
      await db.category.upsert({ where: { name: c.name }, update: {}, create: c })
    }

    // Create suppliers
    const suppliers = [
      { name: 'MediCorp Distributors', phone: '9876543210', email: 'orders@medicorp.com', address: 'Mumbai, Maharashtra', gstNumber: '27AABCU9603R1ZM', contactPerson: 'Rajesh Kumar' },
      { name: 'PharmaCare India', phone: '9876543211', email: 'sales@pharmacare.in', address: 'Delhi, NCR', gstNumber: '07AABCP1234R1Z5', contactPerson: 'Priya Sharma' },
      { name: 'HealthLink Supplies', phone: '9876543212', email: 'info@healthlink.co.in', address: 'Bangalore, Karnataka', gstNumber: '29AABCH5678R1Z9', contactPerson: 'Arun Patel' },
      { name: 'Global Pharma Traders', phone: '9876543213', email: 'contact@globalpharma.com', address: 'Hyderabad, Telangana', gstNumber: '36AABCG9012R1Z3', contactPerson: 'Meena Reddy' },
      { name: 'Sunrise Medicals', phone: '9876543214', email: 'order@sunrise.com', address: 'Chennai, Tamil Nadu', gstNumber: '33AABCS3456R1Z7', contactPerson: 'Karthik Iyer' },
    ]
    for (const s of suppliers) {
      const exists = await db.supplier.findFirst({ where: { name: s.name } })
      if (!exists) await db.supplier.create({ data: s })
    }

    // Get IDs
    const catMap = await db.category.findMany()
    const catByName = Object.fromEntries(catMap.map(c => [c.name, c.id]))
    const supMap = await db.supplier.findMany()
    const supByName = Object.fromEntries(supMap.map(s => [s.name, s.id]))

    // Create medicines with batches
    const medicines = [
      { name: 'Paracetamol 500mg', genericName: 'Paracetamol', brandName: 'Dolo 650', categoryId: catByName['Analgesics'], manufacturer: 'Micro Labs', dosageForm: 'Tablet', strength: '500mg', unit: 'Strip', reorderLevel: 20, reorderQty: 100, taxRate: 12, rackLocation: 'A-1', batches: [{ batchNo: 'PCM-2024-001', expiryDate: new Date('2026-06-30'), purchasePrice: 18, sellingPrice: 25, mrp: 30, quantity: 150 }, { batchNo: 'PCM-2024-002', expiryDate: new Date('2026-12-31'), purchasePrice: 17, sellingPrice: 24, mrp: 28, quantity: 200 }] },
      { name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', brandName: 'Mox 500', categoryId: catByName['Antibiotics'], manufacturer: 'Cipla', dosageForm: 'Capsule', strength: '500mg', unit: 'Strip', reorderLevel: 15, reorderQty: 50, taxRate: 12, rackLocation: 'B-2', batches: [{ batchNo: 'AMX-2024-001', expiryDate: new Date('2026-03-15'), purchasePrice: 45, sellingPrice: 65, mrp: 72, quantity: 80 }] },
      { name: 'Azithromycin 500mg', genericName: 'Azithromycin', brandName: 'Azithral', categoryId: catByName['Antibiotics'], manufacturer: 'Alembic', dosageForm: 'Tablet', strength: '500mg', unit: 'Strip', reorderLevel: 10, reorderQty: 30, taxRate: 12, rackLocation: 'B-3', batches: [{ batchNo: 'AZM-2024-001', expiryDate: new Date('2027-01-31'), purchasePrice: 62, sellingPrice: 89, mrp: 95, quantity: 45 }] },
      { name: 'Vitamin D3 60K IU', genericName: 'Cholecalciferol', brandName: 'D-Rise', categoryId: catByName['Vitamins & Supplements'], manufacturer: 'USV', dosageForm: 'Capsule', strength: '60000 IU', unit: 'Box', reorderLevel: 25, reorderQty: 100, taxRate: 12, rackLocation: 'C-1', batches: [{ batchNo: 'VD3-2024-001', expiryDate: new Date('2027-06-30'), purchasePrice: 22, sellingPrice: 35, mrp: 42, quantity: 120 }] },
      { name: 'Cetirizine 10mg', genericName: 'Cetirizine', brandName: 'Cetzine', categoryId: catByName['Respiratory'], manufacturer: 'Dr Reddys', dosageForm: 'Tablet', strength: '10mg', unit: 'Strip', reorderLevel: 30, reorderQty: 100, taxRate: 12, rackLocation: 'D-1', batches: [{ batchNo: 'CTZ-2024-001', expiryDate: new Date('2026-09-30'), purchasePrice: 8, sellingPrice: 15, mrp: 18, quantity: 250 }] },
      { name: 'Omeprazole 20mg', genericName: 'Omeprazole', brandName: 'Omez', categoryId: catByName['Gastrointestinal'], manufacturer: 'Dr Reddys', dosageForm: 'Capsule', strength: '20mg', unit: 'Strip', reorderLevel: 20, reorderQty: 80, taxRate: 12, rackLocation: 'E-1', batches: [{ batchNo: 'OMP-2024-001', expiryDate: new Date('2026-08-15'), purchasePrice: 12, sellingPrice: 22, mrp: 25, quantity: 100 }] },
      { name: 'Metformin 500mg', genericName: 'Metformin', brandName: 'Glycomet', categoryId: catByName['Diabetes'], manufacturer: 'USV', dosageForm: 'Tablet', strength: '500mg', unit: 'Strip', reorderLevel: 25, reorderQty: 100, taxRate: 12, rackLocation: 'F-1', batches: [{ batchNo: 'MET-2024-001', expiryDate: new Date('2027-03-31'), purchasePrice: 15, sellingPrice: 25, mrp: 30, quantity: 180 }] },
      { name: 'Amlodipine 5mg', genericName: 'Amlodipine', brandName: 'Amlong', categoryId: catByName['Cardiovascular'], manufacturer: 'Micro Labs', dosageForm: 'Tablet', strength: '5mg', unit: 'Strip', reorderLevel: 15, reorderQty: 50, taxRate: 12, rackLocation: 'G-1', batches: [{ batchNo: 'AML-2024-001', expiryDate: new Date('2026-11-30'), purchasePrice: 20, sellingPrice: 32, mrp: 38, quantity: 60 }] },
      { name: 'Pantoprazole 40mg', genericName: 'Pantoprazole', brandName: 'Pan 40', categoryId: catByName['Gastrointestinal'], manufacturer: 'Alkem', dosageForm: 'Tablet', strength: '40mg', unit: 'Strip', reorderLevel: 20, reorderQty: 80, taxRate: 12, rackLocation: 'E-2', batches: [{ batchNo: 'PAN-2024-001', expiryDate: new Date('2026-07-31'), purchasePrice: 14, sellingPrice: 24, mrp: 28, quantity: 90 }] },
      { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', brandName: 'Brufen', categoryId: catByName['Analgesics'], manufacturer: 'Abbott', dosageForm: 'Tablet', strength: '400mg', unit: 'Strip', reorderLevel: 20, reorderQty: 80, taxRate: 12, rackLocation: 'A-2', batches: [{ batchNo: 'IBU-2024-001', expiryDate: new Date('2026-10-15'), purchasePrice: 16, sellingPrice: 28, mrp: 32, quantity: 110 }] },
      { name: 'Cough Syrup 100ml', genericName: 'Dextromethorphan', brandName: 'Benadryl', categoryId: catByName['Respiratory'], manufacturer: 'Johnson & Johnson', dosageForm: 'Syrup', strength: '100ml', unit: 'Bottle', reorderLevel: 15, reorderQty: 40, taxRate: 12, rackLocation: 'D-2', batches: [{ batchNo: 'CSY-2024-001', expiryDate: new Date('2026-05-31'), purchasePrice: 55, sellingPrice: 85, mrp: 95, quantity: 35 }] },
      { name: 'Betadine Ointment', genericName: 'Povidone Iodine', brandName: 'Betadine', categoryId: catByName['Dermatology'], manufacturer: 'Win-Medicare', dosageForm: 'Ointment', strength: '15g', unit: 'Tube', reorderLevel: 10, reorderQty: 30, taxRate: 12, rackLocation: 'H-1', batches: [{ batchNo: 'BET-2024-001', expiryDate: new Date('2027-02-28'), purchasePrice: 28, sellingPrice: 45, mrp: 52, quantity: 40 }] },
      { name: 'Eye Drops Refresh', genericName: 'Carboxymethylcellulose', brandName: 'Refresh Tears', categoryId: catByName['Eye & Ear Care'], manufacturer: 'Allergan', dosageForm: 'Eye Drops', strength: '10ml', unit: 'Bottle', reorderLevel: 10, reorderQty: 30, taxRate: 12, rackLocation: 'I-1', batches: [{ batchNo: 'EYE-2024-001', expiryDate: new Date('2026-04-30'), purchasePrice: 65, sellingPrice: 99, mrp: 110, quantity: 25 }] },
      { name: 'Calcium + D3 Tablets', genericName: 'Calcium Carbonate', brandName: 'Shelcal 500', categoryId: catByName['Vitamins & Supplements'], manufacturer: 'Torrent', dosageForm: 'Tablet', strength: '500mg', unit: 'Bottle', reorderLevel: 15, reorderQty: 60, taxRate: 12, rackLocation: 'C-2', batches: [{ batchNo: 'CAL-2024-001', expiryDate: new Date('2027-05-31'), purchasePrice: 85, sellingPrice: 130, mrp: 145, quantity: 50 }] },
      { name: 'Antiseptic Liquid 500ml', genericName: 'Chloroxylenol', brandName: 'Dettol', categoryId: catByName['First Aid'], manufacturer: 'Reckitt', dosageForm: 'Liquid', strength: '500ml', unit: 'Bottle', reorderLevel: 8, reorderQty: 20, taxRate: 12, rackLocation: 'J-1', batches: [{ batchNo: 'DET-2024-001', expiryDate: new Date('2027-12-31'), purchasePrice: 75, sellingPrice: 115, mrp: 125, quantity: 18 }] },
    ]

    for (const m of medicines) {
      const { batches: medBatches, ...medData } = m
      const med = await db.medicine.create({ data: medData })
      for (const b of medBatches) {
        await db.medicineBatch.create({ data: { ...b, medicineId: med.id, supplierId: supByName['MediCorp Distributors'], purchaseDate: new Date('2024-01-15') } })
      }
    }

    // Substitutes
    const paracetamol = await db.medicine.findFirst({ where: { genericName: 'Paracetamol' } })
    const ibuprofen = await db.medicine.findFirst({ where: { genericName: 'Ibuprofen' } })
    if (paracetamol && ibuprofen) {
      const exists = await db.medicineSubstitute.findFirst({ where: { medicineId: paracetamol.id, substituteId: ibuprofen.id } })
      if (!exists) {
        await db.medicineSubstitute.create({ data: { medicineId: paracetamol.id, substituteId: ibuprofen.id } })
        await db.medicineSubstitute.create({ data: { medicineId: ibuprofen.id, substituteId: paracetamol.id } })
      }
    }
    const omeprazole = await db.medicine.findFirst({ where: { genericName: 'Omeprazole' } })
    const pantoprazole = await db.medicine.findFirst({ where: { genericName: 'Pantoprazole' } })
    if (omeprazole && pantoprazole) {
      const exists = await db.medicineSubstitute.findFirst({ where: { medicineId: omeprazole.id, substituteId: pantoprazole.id } })
      if (!exists) {
        await db.medicineSubstitute.create({ data: { medicineId: omeprazole.id, substituteId: pantoprazole.id } })
        await db.medicineSubstitute.create({ data: { medicineId: pantoprazole.id, substituteId: omeprazole.id } })
      }
    }

    // Sample sales
    const sampleSales = [
      { customerName: 'Rahul Sharma', customerPhone: '9988776655', paymentMethod: 'Cash', items: [{ medicineName: 'Paracetamol 500mg', qty: 2, price: 25 }, { medicineName: 'Vitamin D3 60K IU', qty: 1, price: 35 }] },
      { customerName: 'Priya Patel', customerPhone: '8877665544', doctorName: 'Dr. Mehta', paymentMethod: 'UPI', items: [{ medicineName: 'Amoxicillin 500mg', qty: 1, price: 65 }, { medicineName: 'Omeprazole 20mg', qty: 1, price: 22 }, { medicineName: 'Cetirizine 10mg', qty: 1, price: 15 }] },
      { customerName: 'Suresh Kumar', customerPhone: '7766554433', paymentMethod: 'Card', items: [{ medicineName: 'Metformin 500mg', qty: 3, price: 25 }, { medicineName: 'Amlodipine 5mg', qty: 2, price: 32 }] },
      { customerName: 'Anita Desai', paymentMethod: 'Cash', items: [{ medicineName: 'Cough Syrup 100ml', qty: 1, price: 85 }, { medicineName: 'Ibuprofen 400mg', qty: 1, price: 28 }] },
      { customerName: 'Walk-in', paymentMethod: 'Cash', items: [{ medicineName: 'Betadine Ointment', qty: 1, price: 45 }, { medicineName: 'Antiseptic Liquid 500ml', qty: 1, price: 115 }] },
    ]

    for (const s of sampleSales) {
      const subtotal = s.items.reduce((sum, i) => sum + i.qty * i.price, 0)
      const tax = subtotal * 0.12
      const total = subtotal + tax
      const count = await db.sale.count()
      const invoiceNo = `INV-${String(count + 1).padStart(6, '0')}`
      const saleItems = []
      for (const item of s.items) {
        const med = await db.medicine.findFirst({ where: { name: item.medicineName } })
        if (med) saleItems.push({ medicineId: med.id, medicineName: item.medicineName, quantity: item.qty, unitPrice: item.price, total: item.qty * item.price })
      }
      await db.sale.create({
        data: {
          invoiceNo, customerName: s.customerName, customerPhone: s.customerPhone || null,
          doctorName: (s as { doctorName?: string }).doctorName || null,
          subtotal, tax, total, paymentMethod: s.paymentMethod, date: new Date(),
          items: { create: saleItems },
        },
      })
    }

    // Purchase order
    const poCount = await db.purchaseOrder.count()
    const medMap = await db.medicine.findMany()
    const medByName = Object.fromEntries(medMap.map(m => [m.name, m.id]))
    await db.purchaseOrder.create({
      data: {
        orderNo: `PO-${String(poCount + 1).padStart(6, '0')}`,
        supplierId: supByName['MediCorp Distributors'],
        totalAmount: 8500, status: 'Pending', notes: 'Monthly reorder',
        items: {
          create: [
            { medicineId: medByName['Paracetamol 500mg'], medicineName: 'Paracetamol 500mg', quantity: 100, unitPrice: 18, total: 1800 },
            { medicineId: medByName['Cetirizine 10mg'], medicineName: 'Cetirizine 10mg', quantity: 100, unitPrice: 8, total: 800 },
            { medicineId: medByName['Vitamin D3 60K IU'], medicineName: 'Vitamin D3 60K IU', quantity: 50, unitPrice: 22, total: 1100 },
            { medicineId: medByName['Metformin 500mg'], medicineName: 'Metformin 500mg', quantity: 100, unitPrice: 15, total: 1500 },
            { medicineId: medByName['Calcium + D3 Tablets'], medicineName: 'Calcium + D3 Tablets', quantity: 30, unitPrice: 85, total: 2550 },
            { medicineId: medByName['Antiseptic Liquid 500ml'], medicineName: 'Antiseptic Liquid 500ml', quantity: 20, unitPrice: 75, total: 1500 },
          ],
        },
      },
    })

    return NextResponse.json({ status: 'setup_complete', medicines: medicines.length, categories: categories.length, suppliers: suppliers.length, sales: sampleSales.length, defaultPasswordChanged: false })
  } catch (error) {
    console.error('[Setup] Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Setup failed',
      details: 'Database may not be ready. Click "Setup Database" again.',
    }, { status: 500 })
  }
}
