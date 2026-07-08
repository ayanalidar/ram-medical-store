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

// GET all users
export async function GET() {
  try {
    await ensureDbReady()
    const users = await db.user.findMany({
      select: { id: true, name: true, username: true, role: true, phone: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(users)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST create new user
export async function POST(request: Request) {
  try {
    await ensureDbReady()
    const { name, username, password, role, phone } = await request.json()

    if (!name || !username || !password) {
      return NextResponse.json({ error: 'Name, username and password required' }, { status: 400 })
    }

    // Check if username already exists
    const existing = await db.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
    }

    const hashedPassword = simpleHash(password)

    const user = await db.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        role: role || 'Staff',
        phone: phone || null,
      },
      select: { id: true, name: true, username: true, role: true, phone: true, active: true, createdAt: true },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

// PUT update user (supports both id-based and username-based password reset)
export async function PUT(request: Request) {
  try {
    await ensureDbReady()
    const body = await request.json()
    const { id, name, role, phone, active, password, username } = body

    // Forgot password flow: reset by username
    if (!id && username && password) {
      const user = await db.user.findUnique({ where: { username, active: true } })
      if (!user) {
        return NextResponse.json({ error: 'Username not found' }, { status: 404 })
      }
      await db.user.update({
        where: { id: user.id },
        data: { password: simpleHash(password) },
      })
      return NextResponse.json({ success: true })
    }

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (phone !== undefined) updateData.phone = phone
    if (active !== undefined) updateData.active = active
    if (password) updateData.password = simpleHash(password)

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, username: true, role: true, phone: true, active: true, createdAt: true },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE user
export async function DELETE(request: Request) {
  try {
    await ensureDbReady()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Don't allow deleting the last admin
    const admins = await db.user.count({ where: { role: 'Admin', active: true } })
    const user = await db.user.findUnique({ where: { id } })
    if (user?.role === 'Admin' && admins <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last admin' }, { status: 400 })
    }

    await db.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
