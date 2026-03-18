import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase'
import { redis, keys, secondsUntilMidnightUTC } from '@/lib/redis'

// Streak milestone bonuses
const STREAK_BONUSES: Record<number, number> = {
  3:  300,
  7:  1000,
  14: 2000,
  30: 5000,
}

const NEXT_BONUS_DAYS = [3, 7, 14, 30]

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todayUTC = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // ── Already claimed today? ──────────────────────────────────────────────────
  const alreadyClaimed = await redis.get(keys.dailyLogin(user.id))
  if (alreadyClaimed) {
    const streak = Number(await redis.get(keys.streak(user.id))) || 1
    return NextResponse.json({
      claimed:        false,
      streak,
      bonus:          0,
      next_bonus_at:  nextBonusDay(streak),
    })
  }

  // ── Calculate streak ────────────────────────────────────────────────────────
  const lastClaimDate = await redis.get<string>(keys.streakLast(user.id))
  const yesterdayUTC  = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
  const currentStreak = Number(await redis.get(keys.streak(user.id))) || 0

  let newStreak: number
  if (!lastClaimDate) {
    newStreak = 1                                // first ever login
  } else if (lastClaimDate === yesterdayUTC) {
    newStreak = currentStreak + 1               // consecutive day
  } else {
    newStreak = 1                               // streak broken
  }

  // ── Calculate coins to grant ────────────────────────────────────────────────
  const baseCoins  = 100
  const bonusCoins = STREAK_BONUSES[newStreak] ?? 0
  const totalCoins = baseCoins + bonusCoins

  // ── Write to Redis ──────────────────────────────────────────────────────────
  const ttl = secondsUntilMidnightUTC()
  await Promise.all([
    redis.set(keys.dailyLogin(user.id),  todayUTC, { ex: ttl }),
    redis.set(keys.streak(user.id),      newStreak, { ex: 60 * 60 * 24 * 35 }),
    redis.set(keys.streakLast(user.id),  todayUTC,  { ex: 60 * 60 * 24 * 35 }),
  ])

  // ── Grant coins via ledger ──────────────────────────────────────────────────
  const idempotencyKey = `daily_login-${user.id}-${todayUTC}`
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/rewards/grant`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': req.headers.get('Authorization') ?? '',
    },
    body: JSON.stringify({
      reason:          bonusCoins > 0 ? 'streak_bonus' : 'daily_login',
      amount:          totalCoins,
      idempotency_key: idempotencyKey,
    }),
  })

  return NextResponse.json({
    claimed:       true,
    streak:        newStreak,
    bonus:         bonusCoins,
    next_bonus_at: nextBonusDay(newStreak),
  })
}

function nextBonusDay(currentStreak: number): number | null {
  return NEXT_BONUS_DAYS.find((d) => d > currentStreak) ?? null
}
