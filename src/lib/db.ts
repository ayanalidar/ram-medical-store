// Capture Turso credentials BEFORE setting safe URL
const _rawUrl = String(process.env.DATABASE_URL || '').trim()
const _rawToken = String(process.env.TURSO_AUTH_TOKEN || '').trim()
const _isTurso = _rawUrl.startsWith('libsql://') && _rawToken.length > 0
const _tursoUrl = _isTurso ? _rawUrl : ''
const _tursoToken = _isTurso ? _rawToken : ''

// Set safe URL BEFORE Prisma import (Prisma validates env at import time)
process.env.DATABASE_URL = 'file:/tmp/ram_medical.db'

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  dbReady: boolean
  dbReadyPromise: Promise<void> | undefined
  libsqlClient: any
}

// Placeholder client — replaced by ensureDbReady() with real Turso client
// This placeholder uses file: URL so Prisma never tries libsql://
export let db: PrismaClient = new PrismaClient()

// All CREATE TABLE statements
const allCreateStatements = [
  `CREATE TABLE IF NOT EXISTS "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "Supplier" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "phone" TEXT NOT NULL, "email" TEXT, "address" TEXT, "gstNumber" TEXT, "contactPerson" TEXT, "balance" REAL NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "Medicine" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "genericName" TEXT, "brandName" TEXT, "categoryId" TEXT NOT NULL, "manufacturer" TEXT, "description" TEXT, "dosageForm" TEXT, "strength" TEXT, "unit" TEXT NOT NULL DEFAULT 'Strip', "reorderLevel" INTEGER NOT NULL DEFAULT 10, "reorderQty" INTEGER NOT NULL DEFAULT 50, "taxRate" REAL NOT NULL DEFAULT 0, "hsnCode" TEXT, "rackLocation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "MedicineBatch" ("id" TEXT NOT NULL PRIMARY KEY, "medicineId" TEXT NOT NULL, "batchNo" TEXT NOT NULL, "expiryDate" DATETIME NOT NULL, "purchasePrice" REAL NOT NULL, "sellingPrice" REAL NOT NULL, "mrp" REAL, "quantity" INTEGER NOT NULL DEFAULT 0, "minQuantity" INTEGER NOT NULL DEFAULT 5, "supplierId" TEXT, "purchaseDate" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "MedicineSubstitute" ("id" TEXT NOT NULL PRIMARY KEY, "medicineId" TEXT NOT NULL, "substituteId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("substituteId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "PurchaseOrder" ("id" TEXT NOT NULL PRIMARY KEY, "orderNo" TEXT NOT NULL, "supplierId" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "expectedDate" DATETIME, "totalAmount" REAL NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'Pending', "notes" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" ("id" TEXT NOT NULL PRIMARY KEY, "purchaseOrderId" TEXT NOT NULL, "medicineId" TEXT NOT NULL, "medicineName" TEXT, "batchNo" TEXT, "quantity" INTEGER NOT NULL, "unitPrice" REAL NOT NULL, "total" REAL NOT NULL, "receivedQty" INTEGER NOT NULL DEFAULT 0, FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Sale" ("id" TEXT NOT NULL PRIMARY KEY, "invoiceNo" TEXT NOT NULL, "customerName" TEXT, "customerPhone" TEXT, "doctorName" TEXT, "prescription" TEXT, "subtotal" REAL NOT NULL DEFAULT 0, "discount" REAL NOT NULL DEFAULT 0, "tax" REAL NOT NULL DEFAULT 0, "total" REAL NOT NULL DEFAULT 0, "paymentMethod" TEXT NOT NULL DEFAULT 'Cash', "status" TEXT NOT NULL DEFAULT 'Completed', "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdById" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "SaleItem" ("id" TEXT NOT NULL PRIMARY KEY, "saleId" TEXT NOT NULL, "medicineId" TEXT NOT NULL, "batchId" TEXT, "medicineName" TEXT, "quantity" INTEGER NOT NULL, "unitPrice" REAL NOT NULL, "discount" REAL NOT NULL DEFAULT 0, "tax" REAL NOT NULL DEFAULT 0, "total" REAL NOT NULL, FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("batchId") REFERENCES "MedicineBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "username" TEXT NOT NULL, "password" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'Staff', "phone" TEXT, "active" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "StockAdjustment" ("id" TEXT NOT NULL PRIMARY KEY, "medicineId" TEXT NOT NULL, "batchId" TEXT, "type" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "reason" TEXT, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
]

const allIndexStatements = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_key" ON "Category"("name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "MedicineSubstitute_medicineId_substituteId_key" ON "MedicineSubstitute"("medicineId", "substituteId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_orderNo_key" ON "PurchaseOrder"("orderNo")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Sale_invoiceNo_key" ON "Sale"("invoiceNo")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
]

const columnMigrations = [
  { table: 'User', column: 'active', type: 'BOOLEAN NOT NULL DEFAULT 1' },
  { table: 'User', column: 'phone', type: 'TEXT' },
  { table: 'Sale', column: 'doctorName', type: 'TEXT' },
  { table: 'Sale', column: 'prescription', type: 'TEXT' },
  { table: 'Sale', column: 'createdById', type: 'TEXT' },
  { table: 'SaleItem', column: 'batchId', type: 'TEXT' },
  { table: 'MedicineBatch', column: 'purchaseDate', type: 'DATETIME' },
  { table: 'MedicineBatch', column: 'minQuantity', type: 'INTEGER NOT NULL DEFAULT 5' },
]

async function ensureDbReady() {
  if (globalForPrisma.dbReady) return
  if (globalForPrisma.dbReadyPromise) {
    await globalForPrisma.dbReadyPromise
    return
  }

  globalForPrisma.dbReadyPromise = (async () => {
    try {
      if (_isTurso) {
        // Use dynamic import() — works reliably on Vercel ESM serverless
        const adapterMod = await import('@prisma/adapter-libsql')
        const clientMod = await import('@libsql/client')

        const PrismaLibSQL = (adapterMod as any).PrismaLibSQL || (adapterMod as any).default
        const createClient = (clientMod as any).createClient || (clientMod as any).default?.createClient

        if (!PrismaLibSQL || !createClient) {
          throw new Error('Could not load Turso adapter modules')
        }

        const libsqlClient = createClient({ url: _tursoUrl, authToken: _tursoToken })
        const adapter = new PrismaLibSQL(libsqlClient)
        const tursoClient = new PrismaClient({ adapter })

        // Replace the placeholder with the real Turso-connected client
        db = tursoClient
        globalForPrisma.prisma = tursoClient
        globalForPrisma.libsqlClient = libsqlClient

        console.log('[RAM Medical] Connected to Turso cloud database')

        // Create tables via Turso
        try {
          await libsqlClient.batch(allCreateStatements)
          await libsqlClient.batch(allIndexStatements)
        } catch (batchErr: any) {
          console.warn('[DB] Batch failed, sequential fallback:', batchErr.message)
          for (const sql of allCreateStatements) {
            try { await libsqlClient.execute(sql) } catch (_e: any) { /* skip */ }
          }
          for (const sql of allIndexStatements) {
            try { await libsqlClient.execute(sql) } catch (_e: any) { /* skip */ }
          }
        }

        // Column migrations
        for (const migration of columnMigrations) {
          try {
            const cols = await libsqlClient.execute(`PRAGMA table_info("${migration.table}")`)
            const colNames = (cols.rows || []).map((r: any) => r.name)
            if (!colNames.includes(migration.column)) {
              await libsqlClient.execute(`ALTER TABLE "${migration.table}" ADD COLUMN "${migration.column}" ${migration.type}`)
            }
          } catch (_e: any) { /* skip */ }
        }

        console.log('[RAM Medical] Database ready on Turso')
      } else {
        const localClient = new PrismaClient()
        db = localClient
        globalForPrisma.prisma = localClient
        console.log('[RAM Medical] Using local SQLite database')
      }
    } catch (err) {
      console.error('[RAM Medical] DB init failed:', err)
      // Ultimate fallback: local SQLite
      const fallbackClient = new PrismaClient()
      db = fallbackClient
      globalForPrisma.prisma = fallbackClient
    } finally {
      globalForPrisma.dbReady = true
    }
  })()

  await globalForPrisma.dbReadyPromise
}

export { ensureDbReady }
