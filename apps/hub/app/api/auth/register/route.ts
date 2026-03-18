import { NextRequest, NextResponse } from 'next/server'
import { db, users, wallets } from '@mtwg/db'
import { eq } from 'drizzle-orm'
import { getAuthUser } from '@/lib/supabase'

// Called by SDK init() on every game boot.
// Ensures users + wallets rows exist for this Supabase auth user.
// Safe to call multiple times — idempotent.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Upsert user row ─────────────────────────────────────────────────────────
  await db
    .insert(users)
    .values({
      id:      user.id,
      email:   user.email ?? null,
      country: 'US',  // TODO: detect from IP headers in production
    })
    .onConflictDoNothing({ target: users.id })

  // ── Upsert wallet row ───────────────────────────────────────────────────────
  await db
    .insert(wallets)
    .values({ userId: user.id, softBalance: 0 })
    .onConflictDoNothing({ target: wallets.userId })

  // ── Return current balance ──────────────────────────────────────────────────
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, user.id))
    .limit(1)

  return NextResponse.json({
    userId:  user.id,
    balance: wallet?.softBalance ?? 0,
  })
}
