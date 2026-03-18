import { NextRequest, NextResponse } from 'next/server'
import { db, referrals } from '@mtwg/db'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getAuthUser } from '@/lib/supabase'

const Schema = z.object({
  referral_id:     z.string().uuid().optional(),
  referral_code:   z.string().length(8).optional(),
  idempotency_key: z.string().min(8).max(256),
})

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = Schema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { referral_id, referral_code, idempotency_key } = body.data

  // ── Find referral ───────────────────────────────────────────────────────────
  const [referral] = referral_id
    ? await db.select().from(referrals)
        .where(and(eq(referrals.id, referral_id), eq(referrals.status, 'pending')))
        .limit(1)
    : referral_code
    ? await db.select().from(referrals)
        .where(and(eq(referrals.code, referral_code), eq(referrals.status, 'pending')))
        .limit(1)
    : []

  if (!referral) {
    return NextResponse.json({ ok: false, reason: 'referral_not_found' })
  }

  // ── Cannot refer yourself ───────────────────────────────────────────────────
  if (referral.referrerId === user.id) {
    return NextResponse.json({ ok: false, reason: 'self_referral' })
  }

  // ── Already resolved ────────────────────────────────────────────────────────
  if (referral.rewardPaid) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // ── Mark resolved ───────────────────────────────────────────────────────────
  await db
    .update(referrals)
    .set({
      referredId:  user.id,
      status:      'resolved',
      rewardPaid:  true,
      resolvedAt:  new Date(),
    })
    .where(eq(referrals.id, referral.id))

  const authHeader = req.headers.get('Authorization') ?? ''
  const apiBase    = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // ── Grant 750 coins to referrer ─────────────────────────────────────────────
  // Need service key to grant on behalf of a different user
  const { createClient } = await import('@supabase/supabase-js')
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )
  const { data: { session: referrerSession } } =
    await adminSupabase.auth.admin.generateLink({
      type:  'magiclink',
      email: '', // we use service key directly below
    }).catch(() => ({ data: { session: null } }))

  // Grant referrer coins via direct DB call (service key bypasses auth)
  // We call the grant logic directly rather than HTTP to avoid token issues
  await grantCoinsDirectly(db, {
    userId:         referral.referrerId,
    amount:         750,
    reason:         'referral_install',
    idempotencyKey: `referral-referrer-${referral.id}`,
  })

  // ── Grant 250 welcome coins to new player ───────────────────────────────────
  await fetch(`${apiBase}/api/rewards/grant`, {
    method:  'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason:          'welcome_bonus',
      amount:          250,
      idempotency_key: `referral-welcome-${referral.id}`,
    }),
  })

  return NextResponse.json({
    ok:                true,
    referrer_rewarded: 750,
    you_rewarded:      250,
  })
}

// ── Direct DB grant (bypasses HTTP layer for cross-user grants) ───────────────
async function grantCoinsDirectly(
  dbClient: typeof db,
  opts: { userId: string; amount: number; reason: string; idempotencyKey: string }
) {
  const { wallets, rewardLedger } = await import('@mtwg/db')
  const { sql } = await import('drizzle-orm')

  try {
    await dbClient.transaction(async (tx) => {
      await tx.insert(rewardLedger).values({
        userId:         opts.userId,
        amount:         opts.amount,
        reason:         opts.reason as any,
        idempotencyKey: opts.idempotencyKey,
      })
      await tx.insert(wallets)
        .values({ userId: opts.userId, softBalance: opts.amount })
        .onConflictDoUpdate({
          target: wallets.userId,
          set: {
            softBalance: sql`${wallets.softBalance} + ${opts.amount}`,
            updatedAt:   new Date(),
          },
        })
    })
  } catch (e: any) {
    if (e?.code === '23505') return // duplicate — already granted
    throw e
  }
}
