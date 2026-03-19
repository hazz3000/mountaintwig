import { NextRequest, NextResponse } from 'next/server'
import { db, wallets, rewardLedger } from '@mtwg/db'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getAuthUser } from '@/lib/supabase'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

const GrantSchema = z.object({
  reason: z.enum([
    'install_reward', 'first_session', 'level_complete',
    'daily_login',    'streak_bonus',  'referral_install',
    'welcome_bonus',  'ad_watch',
  ]),
  amount:          z.number().int().positive().max(10_000),
  idempotency_key: z.string().min(8).max(256),
  game_id:         z.string().optional(),
  campaign_id:     z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  const body = GrantSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: body.error.issues },
      { status: 400, headers: corsHeaders }
    )
  }

  const { reason, amount, idempotency_key, game_id, campaign_id } = body.data

  try {
    await db.transaction(async (tx) => {
      // ── Step 1: Write ledger entry first ────────────────────────────────────
      // The unique constraint on idempotency_key throws if this grant
      // has already been processed. The catch block below handles this.
      await tx.insert(rewardLedger).values({
        userId:         user.id,
        amount,
        reason,
        gameId:         game_id ?? null,
        campaignId:     campaign_id ?? null,
        idempotencyKey: idempotency_key,
      })

      // ── Step 2: Upsert wallet balance ────────────────────────────────────────
      // Only runs if the ledger write succeeded.
      await tx
        .insert(wallets)
        .values({ userId: user.id, softBalance: amount })
        .onConflictDoUpdate({
          target: wallets.userId,
          set: {
            softBalance: sql`${wallets.softBalance} + ${amount}`,
            updatedAt:   new Date(),
          },
        })
    })

    return NextResponse.json({ ok: true, amount }, { headers: corsHeaders })

  } catch (err: any) {
    // Postgres unique violation code — idempotency key already exists
    // This is NOT an error: it means the grant was already processed.
    if (err?.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true }, { headers: corsHeaders })
    }
    console.error('[/api/rewards/grant] Unexpected error:', err)
    throw err
  }
}
