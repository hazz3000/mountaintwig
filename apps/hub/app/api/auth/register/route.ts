import { NextRequest, NextResponse } from 'next/server'
import { db, users, wallets, referrals } from '@mtwg/db'
import { eq } from 'drizzle-orm'
import { getAuthUser } from '@/lib/supabase'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  await db.insert(users).values({
    id: user.id, email: user.email ?? null, country: 'US',
  }).onConflictDoNothing({ target: users.id })

  await db.insert(wallets).values({
    userId: user.id, softBalance: 0,
  }).onConflictDoNothing({ target: wallets.userId })

  const existing = await db.select().from(referrals)
    .where(eq(referrals.referrerId, user.id)).limit(1)

  if (!existing[0]) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from({ length: 8 }, () =>
      chars[Math.floor(Math.random() * chars.length)]).join('')
    await db.insert(referrals).values({
      referrerId: user.id, code, status: 'pending',
    }).onConflictDoNothing()
  }

  const [wallet] = await db.select().from(wallets)
    .where(eq(wallets.userId, user.id)).limit(1)

  const [referral] = await db.select().from(referrals)
    .where(eq(referrals.referrerId, user.id)).limit(1)

  return NextResponse.json({
    userId: user.id,
    balance: wallet?.softBalance ?? 0,
    referralCode: referral?.code ?? null,
  }, { headers: corsHeaders })
}
