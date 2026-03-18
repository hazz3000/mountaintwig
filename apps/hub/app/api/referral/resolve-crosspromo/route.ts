import { NextRequest, NextResponse } from 'next/server'
import { db, campaigns, userGames, games } from '@mtwg/db'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getAuthUser } from '@/lib/supabase'

const Schema = z.object({
  campaign_id:     z.string().uuid(),
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

  const { campaign_id, idempotency_key } = body.data

  // ── 1. Load campaign — must be active with budget remaining ────────────────
  const [campaign] = await db
    .select({ campaign: campaigns, game: games })
    .from(campaigns)
    .innerJoin(games, eq(campaigns.gameId, games.id))
    .where(
      and(
        eq(campaigns.id, campaign_id),
        eq(campaigns.status, 'active'),
        sql`${campaigns.budgetCoins} > ${campaigns.spentCoins}`,
      )
    )
    .limit(1)

  if (!campaign) {
    return NextResponse.json({ ok: false, reason: 'campaign_inactive' })
  }

  try {
    await db.transaction(async (tx) => {
      // ── 2. Grant coins to installing player (ledger-first) ─────────────────
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/rewards/grant`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': req.headers.get('Authorization') ?? '',
        },
        body: JSON.stringify({
          reason:          'install_reward',
          amount:          campaign.campaign.rewardCoins,
          idempotency_key: idempotency_key,
          campaign_id:     campaign_id,
          game_id:         campaign.game.slug,
        }),
      })

      // ── 3. Decrement campaign budget ────────────────────────────────────────
      await tx
        .update(campaigns)
        .set({ spentCoins: sql`${campaigns.spentCoins} + ${campaign.campaign.rewardCoins}` })
        .where(eq(campaigns.id, campaign_id))

      // ── 4. Mark game as installed for this user ─────────────────────────────
      await tx
        .insert(userGames)
        .values({ userId: user.id, gameId: campaign.campaign.gameId })
        .onConflictDoNothing()
    })

    return NextResponse.json({
      ok:           true,
      coins_granted: campaign.campaign.rewardCoins,
      game:          campaign.game.name,
    })

  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    console.error('[resolve-crosspromo] Error:', err)
    throw err
  }
}
