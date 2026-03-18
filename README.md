# Mountain Twig Games — Platform Monorepo

> Solo builder edition. TypeScript throughout. One deploy target. 10 weeks.

## Stack

| Layer | Technology |
|-------|-----------|
| Hub frontend | Next.js 14 + Tailwind CSS |
| Backend API | Next.js API routes + Zod |
| Database | Supabase Postgres + Drizzle ORM |
| Auth | Supabase Auth (email + Google) |
| Cache | Upstash Redis |
| Games | Phaser 3 + TypeScript + Vite |
| Deep links | Branch.io |
| Analytics | Amplitude |
| Deploy | Vercel |
| Monorepo | Turborepo + pnpm |

---

## Quick start

### 1. Prerequisites

```bash
node >= 20
pnpm >= 9
```

### 2. Clone and install

```bash
git clone https://github.com/your-org/mountain-twig-games
cd mountain-twig-games
pnpm install
```

### 3. Set up environment

```bash
cp .env.example .env.local
# Fill in all values — see comments in .env.example for where to get each one
```

Required services (all have free tiers):
- **Supabase** — [supabase.com](https://supabase.com) — database + auth
- **Upstash** — [upstash.com](https://upstash.com) — Redis
- **Branch.io** — [branch.io](https://branch.io) — deep links
- **Amplitude** — [amplitude.com](https://amplitude.com) — analytics
- **Vercel** — [vercel.com](https://vercel.com) — deployment

### 4. Push database schema

```bash
pnpm db:push
```

This creates all tables in your Supabase Postgres database.

### 5. Start development

```bash
pnpm dev
# Hub runs at http://localhost:3000
# Game scaffold runs at http://localhost:5173
```

---

## Project structure

```
mountain-twig-games/
├── apps/
│   ├── hub/              # Next.js platform hub
│   └── game-01/          # First game (copy from game-scaffold)
├── packages/
│   ├── sdk/              # @mtwg/sdk — what every game imports
│   ├── types/            # @mtwg/types — shared TypeScript contracts
│   ├── db/               # @mtwg/db — Drizzle schema + client
│   └── game-scaffold/    # Template for new games
└── infra/                # Terraform (Phase 3+)
```

---

## Adding a new game

```bash
# 1. Copy the scaffold
cp -r packages/game-scaffold apps/game-02

# 2. Update the game ID
# Edit apps/game-02/src/scenes/BootScene.ts
# Change: const GAME_ID = 'game-02'

# 3. Update Capacitor config
# Edit apps/game-02/capacitor.config.ts
# Change: GAME_SLUG, APP_NAME, BUNDLE_SUFFIX

# 4. Add to hub catalog
# Insert a row in the games table in Supabase

# 5. Build game logic
# Edit apps/game-02/src/scenes/GameScene.ts
# Everything else (auth, coins, ads) is already wired
```

---

## Key API routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/register` | Ensure user + wallet exist |
| GET  | `/api/wallet` | Get coin balance + recent ledger |
| POST | `/api/rewards/grant` | Grant coins (idempotent) |
| POST | `/api/rewards/daily-login` | Claim daily streak reward |
| GET  | `/api/ads` | Get cross-promo campaign |
| POST | `/api/events` | Track game event |
| GET  | `/api/referral/my-code` | Get referral code + share URL |
| POST | `/api/referral/resolve` | Resolve referral on new player install |
| POST | `/api/referral/resolve-crosspromo` | Resolve cross-promo install |

---

## Critical rules — never skip

### 1. Idempotency key on every coin grant
Every call to `/api/rewards/grant` must include a deterministic `idempotency_key`.
Format: `{reason}-{userId}-{contextId}`

```typescript
// ✅ Correct
await mtwg.grantCoins('level_complete', 50, `level_complete-${userId}-level-5`)

// ❌ Wrong — no idempotency key, duplicates possible
await mtwg.grantCoins('level_complete', 50, '')
```

### 2. Ledger before balance
The `reward_ledger` INSERT must happen inside the same transaction as the
`wallets` UPDATE. Never update the balance without a ledger entry.

### 3. apple-app-site-association must be live before App Store submission
Served at `https://mountaintwìggames.com/.well-known/apple-app-site-association`
No redirect. No auth. Content-Type: application/json.

### 4. Amplitude from day one
All five core events must fire before you have any users:
`session_start`, `ad_impression`, `ad_click`, `cross_promo_install`, `referral_install`

---

## Running tests

```bash
pnpm test
# Or for a specific package:
pnpm test --filter @mtwg/db
```

---

## Deploying

```bash
# Hub deploys automatically on push to main via Vercel
# To deploy manually:
vercel --prod

# To build all packages:
pnpm build
```

---

## Week by week build plan
See `mountain_twig_games_build_guide.docx` for the full 10-week plan
with task breakdowns and hour estimates.
