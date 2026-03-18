import { db, games, campaigns } from '@mtwg/db'
import { eq, and, sql } from 'drizzle-orm'
import Link from 'next/link'
import Image from 'next/image'

export default async function HubHome() {
  const [allGames, activeAds] = await Promise.all([
    db.select().from(games).where(eq(games.status, 'live')),
    db
      .select({ campaign: campaigns, game: games })
      .from(campaigns)
      .innerJoin(games, eq(campaigns.gameId, games.id))
      .where(
        and(
          eq(campaigns.status, 'active'),
          sql`${campaigns.budgetCoins} > ${campaigns.spentCoins}`,
        )
      )
      .limit(3),
  ])

  return (
    <main className="min-h-screen bg-neutral-950">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <span className="text-xl font-black tracking-tight">
          <span style={{ color: 'var(--orange)' }}>MOUNTAIN</span>{' '}
          <span className="text-white">TWIG</span>
        </span>
        <Link href="/profile" className="coin-badge">
          🪙 <span id="header-balance">—</span>
        </Link>
      </header>

      <div className="max-w-xl mx-auto px-5 py-6 space-y-8">

        {/* ── Earn coins section ── */}
        {activeAds.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-neutral-100 mb-3">Earn coins</h2>
            <div className="space-y-3">
              {activeAds.map(({ campaign, game }) => (
                <a
                  key={campaign.id}
                  href={campaign.deepLinkUrl ?? '#'}
                  className="card flex items-center gap-4 hover:border-orange-500/40 transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-neutral-800 flex-shrink-0 overflow-hidden">
                    {game.iconUrl && (
                      <Image src={game.iconUrl} alt={game.name} width={56} height={56} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-neutral-100 truncate">{game.name}</p>
                    <p className="text-sm text-neutral-400 truncate">{game.description}</p>
                  </div>
                  <div className="coin-badge flex-shrink-0">+{campaign.rewardCoins}</div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Game catalog ── */}
        <section>
          <h2 className="text-lg font-bold text-neutral-100 mb-3">Games</h2>
          {allGames.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-neutral-400">No games yet — check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {allGames.map((game) => (
                <a
                  key={game.id}
                  href={`/games/${game.slug}`}
                  className="card flex flex-col items-center gap-3 hover:border-neutral-600 transition-colors text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-neutral-800 overflow-hidden">
                    {game.iconUrl && (
                      <Image src={game.iconUrl} alt={game.name} width={64} height={64} />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-100 text-sm">{game.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{game.category}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* ── Nav ── */}
        <nav className="grid grid-cols-3 gap-2 pb-6">
          <Link href="/rewards" className="btn-secondary text-center text-sm">Rewards</Link>
          <Link href="/refer"   className="btn-secondary text-center text-sm">Refer</Link>
          <Link href="/profile" className="btn-secondary text-center text-sm">Profile</Link>
        </nav>
      </div>
    </main>
  )
}
