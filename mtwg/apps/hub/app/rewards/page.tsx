'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const STREAK_BONUSES: Record<number, number> = { 3: 300, 7: 1000, 14: 2000, 30: 5000 }

export default function RewardsPage() {
  const [streak,       setStreak]       = useState(0)
  const [nextBonus,    setNextBonus]    = useState<number | null>(null)
  const [claimedToday, setClaimedToday] = useState(false)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }

      const res = await fetch('/api/rewards/daily-login', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setStreak(data.streak ?? 0)
      setNextBonus(data.next_bonus_at ?? null)
      setClaimedToday(!data.claimed)  // if claimed=false it was already claimed
      setLoading(false)
    }
    load()
  }, [])

  // Build 7-day streak calendar display
  const streakDays = Array.from({ length: 7 }, (_, i) => {
    const day = i + 1
    const done   = day <= streak
    const bonus  = STREAK_BONUSES[day]
    return { day, done, bonus }
  })

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-400">Loading…</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950">
      <header className="flex items-center gap-3 px-5 py-4 border-b border-neutral-800">
        <Link href="/" className="text-neutral-400 hover:text-white transition-colors">←</Link>
        <h1 className="text-xl font-bold">Rewards</h1>
      </header>

      <div className="max-w-xl mx-auto px-5 py-6 space-y-6">

        {/* Daily streak */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Daily streak</h2>
              <p className="text-neutral-400 text-sm">{streak} day{streak !== 1 ? 's' : ''} in a row</p>
            </div>
            <span className="text-3xl">🔥</span>
          </div>

          {/* 7-day grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {streakDays.map(({ day, done, bonus }) => (
              <div key={day} className="flex flex-col items-center gap-1">
                <div
                  className={`w-full aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                    done
                      ? 'bg-orange-500 text-white'
                      : day === streak + 1
                      ? 'bg-neutral-700 text-neutral-300 ring-1 ring-orange-500'
                      : 'bg-neutral-800 text-neutral-600'
                  }`}
                >
                  {done ? '✓' : day}
                </div>
                {bonus && (
                  <p className="text-xs text-neutral-500 text-center leading-tight">
                    +{bonus}
                  </p>
                )}
              </div>
            ))}
          </div>

          {claimedToday ? (
            <p className="text-green-400 text-sm text-center font-medium">
              ✓ Daily login claimed — come back tomorrow!
            </p>
          ) : (
            <p className="text-neutral-400 text-sm text-center">
              Open any Mountain Twig game to claim today's coins
            </p>
          )}

          {nextBonus && (
            <p className="text-center text-sm">
              <span className="text-neutral-400">Reach day </span>
              <span className="font-bold" style={{ color: 'var(--orange)' }}>{nextBonus}</span>
              <span className="text-neutral-400"> for a </span>
              <span className="font-bold text-white">+{STREAK_BONUSES[nextBonus]}</span>
              <span className="text-neutral-400"> coin bonus</span>
            </p>
          )}
        </div>

        {/* Earn opportunities */}
        <div>
          <h2 className="text-base font-bold text-white mb-3">Ways to earn</h2>
          <div className="space-y-2">
            {[
              { action: 'Install a new game',    coins: 500,  icon: '📲' },
              { action: 'Play for the first time', coins: 200, icon: '🎮' },
              { action: 'Complete a level',       coins: 50,   icon: '⭐' },
              { action: 'Daily login',             coins: 100,  icon: '📅' },
              { action: '7-day streak',            coins: 1000, icon: '🔥' },
              { action: 'Refer a friend',          coins: 750,  icon: '👥' },
            ].map(({ action, coins, icon }) => (
              <div key={action} className="card flex items-center gap-3 py-3">
                <span className="text-xl">{icon}</span>
                <p className="flex-1 text-sm text-neutral-200">{action}</p>
                <span className="coin-badge">+{coins}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}
