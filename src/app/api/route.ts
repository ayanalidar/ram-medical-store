import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || 'NOT_SET'
  const tursoToken = process.env.TURSO_AUTH_TOKEN ? 'SET' : 'NOT_SET'
  const nodeEnv = process.env.NODE_ENV || 'NOT_SET'
  const isTurso = dbUrl.startsWith('libsql://')
  return NextResponse.json({
    status: 'diagnostic',
    DATABASE_URL: dbUrl.substring(0, 50) + (dbUrl.length > 50 ? '...' : ''),
    TURSO_AUTH_TOKEN: tursoToken,
    NODE_ENV: nodeEnv,
    isTurso,
  })
}
