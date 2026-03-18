import { NextRequest, NextResponse } from 'next/server'
import { db, campaigns, games, userGames } from '@mtwg/db'
import { eq, ne, and, sql } from 'drizzle-orm'
import { getAuthUser } from '@/lib/supabase'
import { redis, keys } from '@/lib/redis'

const AD_FREQUENCY_CAP = 3 // max impressions per user per campaign per day

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const gameId = new URL(req.url).searchParams.get('game_id')
  if (!gameId) {
    return NextResponse.json({ error: 'game_id required' }, { status: 400 })
  }

  // ── 1. Get the game row for the current game ────────────────────────────────
  const [currentGame] = await db
    .select()
    .from(games)
    .where(eq(games.slug, gameId))
    .limit(1)

  if (!currentGame) {
    return NextResponse.json(null) // unknown game — no ad
  }

  // ── 2. Get active campaigns (excluding current game, within budget) ─────────
  const activeCampaigns = await db
    .select({ campaign: campaigns, game: games })
    .from(campaigns)
    .innerJoin(games, eq(campaigns.gameId, games.id))
    .where(
      and(
        eq(campaigns.status, 'active'),
        ne(campaigns.gameId, currentGame.id),
        sql`${campaigns.budgetCoins} > ${campaigns.spentCoins}`,
        eq(games.status, 'live'),
      )
    )

  if (!activeCampaigns.length) return NextResponse.json(null)

  // ── 3. Filter: skip games this player has already installed ─────────────────
  const installed = await db
    .select({ gameId: userGames.gameId })
    .from(userGames)
    .where(eq(userGames.userId, user.id))

  const installedIds = new Set(installed.map((r) => r.gameId))
  const eligible = activeCampaigns.filter(
    ({ campaign }) => !installedIds.has(campaign.gameId)
  )

  if (!eligible.length) return NextResponse.json(null)

  // ── 4. Filter: frequency cap (max N impressions per user per campaign/day) ──
  const freqChecks = await Promise.all(
    eligible.map(async ({ campaign }) => {
      const count = await redis.get<number>(keys.adCap(user.id, campaign.id))
      return { campaign, capped: (count ?? 0) >= AD_FREQUENCY_CAP }
    })
  )
  const uncapped = freqChecks
    .filter((r) => !r.capped)
    .map((r) => r.campaign)

  if (!uncapped.length) return NextResponse.json(null)

  // ── 5. Score: v1 = highest reward coins wins ─────────────────────────────────
  // v2 (Phase 3): replace with (0.4×CTR) + (0.4×InstallRate) + (0.2×Retention)
  const sorted = [...eligible]
    .filter(({ campaign }) => uncapped.find((c) => c.id === campaign.id))
    .sort((a, b) => b.campaign.rewardCoins - a.campaign.rewardCoins)

  const winner = sorted[0]
  if (!winner) return NextResponse.json(null)

  // ── 6. Increment frequency cap in Redis ────────────────────────────────────
  const capKey = keys.adCap(user.id, winner.campaign.id)
  await redis.incr(capKey)
  await redis.expire(capKey, 86_400) // TTL = 24 hours

  // ── 7. Return ad unit ───────────────────────────────────────────────────────
  return NextResponse.json({
    campaign_id:   winner.campaign.id,
    game_id:       winner.game.slug,
    game_name:     winner.game.name,
    icon_url:      winner.game.iconUrl,
    reward_coins:  winner.campaign.rewardCoins,
    deep_link_url: winner.campaign.deepLinkUrl ?? `https://mountaintwìggames.com/games/${winner.game.slug}`,
    cta:           `Install and earn ${winner.campaign.rewardCoins} coins`,
  })
}
