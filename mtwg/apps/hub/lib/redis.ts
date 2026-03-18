import { Redis } from '@upstash/redis'

// Singleton — reused across requests
export const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// ── Key helpers — keep key patterns in one place ──────────────────────────────
export const keys = {
  // Daily login — TTL set to end of day UTC
  dailyLogin:   (userId: string) => `daily:${userId}`,
  // Streak counter
  streak:       (userId: string) => `streak:${userId}`,
  // Last streak claim date (YYYY-MM-DD)
  streakLast:   (userId: string) => `streak_last:${userId}`,
  // Ad pacing — impressions per user per campaign per day
  adCap:        (userId: string, campaignId: string) => `cap:${userId}:${campaignId}`,
  // Campaign hot score — refreshed every 60s from ClickHouse (Phase 3)
  campaignScore:(campaignId: string) => `score:${campaignId}`,
}

// ── Seconds until end of day UTC ──────────────────────────────────────────────
export function secondsUntilMidnightUTC(): number {
  const now    = new Date()
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ))
  return Math.floor((midnight.getTime() - now.getTime()) / 1000)
}
