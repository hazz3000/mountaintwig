import { db, referrals, users } from '@mtwg/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: { code: string }
}

export default async function ReferralLandingPage({ params }: Props) {
  const [referral] = await db
    .select({ referral: referrals, user: users })
    .from(referrals)
    .innerJoin(users, eq(referrals.referrerId, users.id))
    .where(eq(referrals.code, params.code.toUpperCase()))
    .limit(1)

  if (!referral) notFound()

  const referrerName = referral.user.email?.split('@')[0] ?? 'A friend'

  return (
    <main className="min-h-screen bg-neutral-950 flex items-center justify-center px-5">
      <div className="max-w-sm w-full space-y-6 text-center">

        {/* Logo */}
        <div>
          <p className="text-2xl font-black tracking-tight mb-1">
            <span style={{ color: 'var(--orange)' }}>MOUNTAIN</span>{' '}
            <span className="text-white">TWIG</span>
          </p>
          <p className="text-neutral-500 text-sm">GAMES</p>
        </div>

        {/* Invite card */}
        <div className="card space-y-4 py-8">
          <p className="text-4xl">🎮</p>
          <h1 className="text-xl font-bold text-white">
            {referrerName} invited you to play!
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Install any Mountain Twig game and you both earn{' '}
            <span style={{ color: 'var(--orange)' }} className="font-bold">750 coins</span>{' '}
            instantly.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <a
              href="https://apps.apple.com/developer/mountain-twig-games"
              className="btn-primary text-sm py-3"
            >
              App Store
            </a>
            <a
              href="https://play.google.com/store/apps/developer?id=Mountain+Twig+Games"
              className="btn-secondary text-sm py-3"
            >
              Google Play
            </a>
          </div>
        </div>

        {/* How it works */}
        <div className="space-y-3 text-left">
          {[
            ['Install any game', 'Free on App Store and Google Play'],
            ['Create your account', 'One account works across all games'],
            ['Coins land instantly', 'Both you and your friend earn 750 coins'],
          ].map(([title, sub]) => (
            <div key={title} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                   style={{ background: 'var(--orange)' }} />
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-neutral-500">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Referral code display */}
        <p className="text-neutral-600 text-xs font-mono">
          Referral code: {params.code.toUpperCase()}
        </p>
      </div>
    </main>
  )
}
