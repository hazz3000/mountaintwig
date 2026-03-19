import { NextRequest, NextResponse } from 'next/server'
import { db, campaigns, games, userGames } from '@mtwg/db'
import { eq, ne, and, sql } from 'drizzle-orm'
import { getAuthUser } from '@/lib/supabase'
import { redis, keys } from '@/lib/redis'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

const AD_FREQUENCY_CAP = 3

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  const gameSlug = new URL(req.url).searchParams.get('game_id')
  if (!gameSlug) {
    return NextResponse.json(null, { headers: corsHeaders })
  }

  const [currentGame] = await db.select().from(games)
    .where(eq(games.slug, gameSlug)).limit(1)

  const activeCampaigns = await db
    .select({ campaign: campaigns, game: games })
    .from(campaigns)
    .innerJoin(games, eq(campaigns.gameId, games.id))
    .where(
      and(
        eq(campaigns.status, 'active'),
        sql`${campaigns.budgetCoins} > ${campaigns.spentCoins}`,
        eq(games.status, 'live'),
        currentGame ? ne(campaigns.gameId, currentGame.id) : sql`true`
      )
    )

  if (!activeCampaigns.length) {
    return NextResponse.json(null, { headers: corsHeaders })
  }

  const installed = await db.select({ gameId: userGames.gameId })
    .from(userGames).where(eq(userGames.userId, user.id))
  const installedIds = new Set(installed.map(r => r.gameId))

  const eligible = activeCampaigns.filter(
    ({ campaign }) => !installedIds.has(campaign.gameId)
  )

  if (!eligible.length) {
    return NextResponse.json(null, { headers: corsHeaders })
  }

  const winner = eligible.sort(
    (a, b) => b.campaign.rewardCoins - a.campaign.rewardCoins
  )[0]

  const capKey = keys.adCap(user.id, winner.campaign.id)
  const currentCount = (await redis.get<number>(capKey)) ?? 0
  if (currentCount >= AD_FREQUENCY_CAP) {
    return NextResponse.json(null, { headers: corsHeaders })
  }

  const count = await redis.incr(capKey)
  if (count === 1) await redis.expire(capKey, 86400)

  return NextResponse.json({
    campaign_id:   winner.campaign.id,
    game_id:       winner.game.slug,
    game_name:     winner.game.name,
    icon_url:      winner.game.iconUrl,
    reward_coins:  winner.campaign.rewardCoins,
    deep_link_url: winner.campaign.deepLinkUrl ?? `https://mountaintwìggames.com/games/${winner.game.slug}`,
    cta:           `Play ${winner.game.name} — earn ${winner.campaign.rewardCoins} coins`,
  }, { headers: corsHeaders })
}
