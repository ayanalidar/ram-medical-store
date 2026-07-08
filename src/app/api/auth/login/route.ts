import { db, ensureDbReady } from '@/lib/db'
import { NextResponse } from 'next/server'

// Simple password hash (for production, use bcrypt - but keeping it simple for SQLite deployment)
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

// GET: Ensure admin user exists (called by login page on load)
export async function GET() {
  try {
    await ensureDbReady()
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
      console.log('[Login] Auto-created admin user')
      return NextResponse.json({ ready: true, createdAdmin: true })
    }
    return NextResponse.json({ ready: true, createdAdmin: false })
  } catch (error) {
    console.error('[Login] Setup error:', error)
    return NextResponse.json({
      ready: false,
      error: error instanceof Error ? error.message : 'Database not ready',
      hint: 'Click "Setup Database" button below the login form'
    }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbReady()

    // Safety: ensure admin user exists
    try {
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
        console.log('[Login] Auto-created admin user on login attempt')
      }
    } catch (e: any) {
      console.warn('[Login] Admin check warning:', e.message)
    }

    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { username, active: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    const hashedInput = simpleHash(password)
    if (user.password !== hashedInput) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Create a simple session token
    const sessionToken = 'sess_' + user.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        phone: user.phone,
      },
      token: sessionToken,
    })
  } catch (error) {
    console.error('[Login] Error:', error)
    const msg = error instanceof Error ? error.message : 'Login failed'
    return NextResponse.json({ error: `Login failed: ${msg}` }, { status: 500 })
  }
}

// Also export the hash function for creating users
export { simpleHash }
