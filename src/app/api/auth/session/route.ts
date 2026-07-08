import { NextResponse } from 'next/server'

// Simple session check - returns the user info from the token
export async function POST(request: Request) {
  try {
    const { token, user } = await request.json()

    if (!token || !user) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }

    // Validate token format
    if (token.startsWith('sess_') && user.id && user.name) {
      return NextResponse.json({ valid: true, user })
    }

    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }
}
