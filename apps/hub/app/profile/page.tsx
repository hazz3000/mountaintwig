'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface LedgerEntry {
  id:        string
  amount:    number
  reason:    string
  createdAt: string
}

export default function ProfilePage() {
  const [balance, setBalance]  = useState<number | null>(null)
  const [recent,  setRecent]   = useState<LedgerEntry[]>([])
  const [streak,  setStreak]   = useState<number>(0)
  const [email,   setEmail]    = useState<string | null>(null)
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }

      setEmail(session.user.email ?? null)
      const token = session.access_token

      const [walletRes, dailyRes] = await Promise.all([
        fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/rewards/daily-login', {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({}),
        }),
      ])

      const wallet = await walletRes.json()
      const daily  = await dailyRes.json()

      setBalance(wallet.balance)
      setRecent(wallet.recent ?? [])
      setStreak(daily.streak ?? 0)
      setLoading(false)
    }
    load()
  }, [])

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
        <h1 className="text-xl font-bold">Profile</h1>
      </header>

      <div className="max-w-xl mx-auto px-5 py-6 space-y-6">

        {/* Balance card */}
        <div className="card text-center py-8">
          <p className="text-neutral-400 text-sm mb-1">Coin balance</p>
          <p className="text-5xl font-black" style={{ color: 'var(--orange)' }}>
            {balance?.toLocaleString() ?? '—'}
          </p>
          <p className="text-neutral-500 text-sm mt-1">coins</p>
        </div>

        {/* Streak */}
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-neutral-400 text-sm">Daily streak</p>
            <p className="text-2xl font-bold text-white">{streak} {streak === 1 ? 'day' : 'days'}</p>
          </div>
          <div className="text-4xl">🔥</div>
        </div>

        {/* Account */}
        <div className="card">
          <p className="text-neutral-400 text-sm mb-1">Account</p>
          <p className="text-neutral-100 font-medium">{email}</p>
        </div>

        {/* Recent transactions */}
        <div>
          <h2 className="text-base font-semibold text-neutral-100 mb-3">Recent coins</h2>
          {recent.length === 0 ? (
            <p className="text-neutral-500 text-sm">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((entry) => (
                <div key={entry.id} className="card flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-100 capitalize">
                      {entry.reason.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${entry.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.amount > 0 ? '+' : ''}{entry.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Link href="/refer" className="btn-primary block text-center">
          Invite friends — earn 750 coins
        </Link>
      </div>
    </main>
  )
}
