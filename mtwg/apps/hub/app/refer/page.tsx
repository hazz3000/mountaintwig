'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export default function ReferPage() {
  const [shareUrl,  setShareUrl]  = useState<string | null>(null)
  const [code,      setCode]      = useState<string | null>(null)
  const [resolved,  setResolved]  = useState(0)
  const [copied,    setCopied]    = useState(false)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }

      const res = await fetch('/api/referral/my-code', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setCode(data.code)
      setShareUrl(data.share_url)
      setResolved(data.resolved ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareLink() {
    if (!shareUrl) return
    if (navigator.share) {
      await navigator.share({
        title: 'Join Mountain Twig Games',
        text:  'Play games and earn coins — join with my link and we both earn 750 coins!',
        url:   shareUrl,
      })
    } else {
      copyLink()
    }
  }

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
        <h1 className="text-xl font-bold">Refer friends</h1>
      </header>

      <div className="max-w-xl mx-auto px-5 py-6 space-y-5">

        {/* Hero */}
        <div className="card text-center py-8 space-y-2">
          <p className="text-4xl">🎮</p>
          <h2 className="text-xl font-bold text-white">Invite a friend</h2>
          <p className="text-neutral-400 text-sm">
            You both earn <span style={{ color: 'var(--orange)' }} className="font-bold">750 coins</span> when
            they install their first Mountain Twig game.
          </p>
        </div>

        {/* Referral link */}
        <div className="card space-y-3">
          <p className="text-neutral-400 text-xs uppercase tracking-widest">Your referral link</p>
          <div className="flex items-center gap-2 bg-neutral-800 rounded-xl px-3 py-2.5">
            <p className="text-neutral-300 text-sm truncate flex-1 font-mono">
              {shareUrl ?? '—'}
            </p>
            <button
              onClick={copyLink}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors flex-shrink-0"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button onClick={shareLink} className="btn-primary w-full">
            Share link
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <p className="text-neutral-400 text-xs mb-1">Successful referrals</p>
            <p className="text-3xl font-black" style={{ color: 'var(--orange)' }}>{resolved}</p>
          </div>
          <div className="card text-center">
            <p className="text-neutral-400 text-xs mb-1">Coins earned</p>
            <p className="text-3xl font-black text-white">{(resolved * 750).toLocaleString()}</p>
          </div>
        </div>

        {/* How it works */}
        <div className="card space-y-3">
          <p className="text-neutral-400 text-xs uppercase tracking-widest">How it works</p>
          {[
            ['1', 'Share your link with a friend'],
            ['2', 'They install any Mountain Twig game'],
            ['3', 'You both earn 750 coins instantly'],
          ].map(([num, text]) => (
            <div key={num} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                   style={{ background: 'var(--orange)', color: 'white' }}>
                {num}
              </div>
              <p className="text-neutral-300 text-sm">{text}</p>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
