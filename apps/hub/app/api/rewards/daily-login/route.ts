import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase'
import { redis, keys, secondsUntilMidnightUTC } from '@/lib/redis'
import { db, wallets, rewardLedger } from '@mtwg/db'
import { sql } from 'drizzle-orm'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

const STREAK_BONUSES: Record<number, number> = {
  3: 300, 7: 1000, 14: 2000, 30: 5000,
}
const NEXT_BONUS_DAYS = [3, 7, 14, 30]

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  const todayUTC = new Date().toISOString().split('T')[0]

  const alreadyClaimed = await redis.get(keys.dailyLogin(user.id))
  if (alreadyClaimed) {
    const streak = Number(await redis.get(keys.streak(user.id))) || 1
    return NextResponse.json({
      claimed: false, streak, bonus: 0,
      next_bonus_at: NEXT_BONUS_DAYS.find(d => d > streak) ?? null,
    }, { headers: corsHeaders })
  }

  const lastClaimDate = await redis.get<string>(keys.streakLast(user.id))
  const yesterdayUTC  = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
  const currentStreak = Number(await redis.get(keys.streak(user.id))) || 0

  let newStreak: number
  if (!lastClaimDate)                      newStreak = 1
  else if (lastClaimDate === yesterdayUTC) newStreak = currentStreak + 1
  else                                     newStreak = 1

  const baseCoins  = 100
  const bonusCoins = STREAK_BONUSES[newStreak] ?? 0
  const totalCoins = baseCoins + bonusCoins
  const idempotencyKey = `daily_login-${user.id}-${todayUTC}`

  const ttl = secondsUntilMidnightUTC()
  await Promise.all([
    redis.set(keys.dailyLogin(user.id), todayUTC,  { ex: ttl }),
    redis.set(keys.streak(user.id),     newStreak, { ex: 60 * 60 * 24 * 35 }),
    redis.set(keys.streakLast(user.id), todayUTC,  { ex: 60 * 60 * 24 * 35 }),
  ])

  // Grant coins directly — no internal HTTP call
  try {
    await db.transaction(async (tx) => {
      await tx.insert(rewardLedger).values({
        userId:         user.id,
        amount:         totalCoins,
        reason:         bonusCoins > 0 ? 'streak_bonus' : 'daily_login',
        idempotencyKey: idempotencyKey,
      })
      await tx.insert(wallets)
        .values({ userId: user.id, softBalance: totalCoins })
        .onConflictDoUpdate({
          target: wallets.userId,
          set: {
            softBalance: sql`${wallets.softBalance} + ${totalCoins}`,
            updatedAt:   new Date(),
          },
        })
    })
  } catch (e: any) {
    if (e?.code !== '23505') throw e
  }

  return NextResponse.json({
    claimed: true,
  streak:  newStreak,
    bonus:   bonusCoins,
    coins:   totalCoins,
    next_bonus_at: NEXT_BONUS_DAYS.find(d => d > newStreak) ?? null,
  }, { headers: corsHeaders })
}
