# Mountain Twig Games — Session Context

Paste this at the start of every new Claude chat session to restore context instantly.

---

## What we're building
Mountain Twig Games — a multi-game mobile platform.
Each game is its own native Capacitor app (iOS + Android).
All games share one Supabase backend, a universal coin wallet, and a referral engine.
Cross-promotion between games (via Branch.io deep links) is the core growth mechanic.

## Build plan
10-week solo build. Full spec in mountain_twig_games_build_guide.docx.

## Tech stack
Turborepo + pnpm | Next.js 14 | Supabase + Drizzle | Upstash Redis
Phaser 3 + Capacitor | Branch.io | Amplitude | Vercel | TypeScript strict

## Current status
[ ] Week 1 — Monorepo scaffold, DB schema, SDK, hub shell
[ ] Week 2 — Identity + wallet
[ ] Week 3 — SDK + Branch.io + Capacitor
[ ] Week 4–5 — Game #1
[ ] Week 6 — Cross-promo engine
[ ] Week 7 — Referral engine
[ ] Week 8 — Rewards + daily streak
[ ] Week 9 — Game #2
[ ] Week 10 — App Store launch

## Key constraints (never break these)
1. Idempotency key on every coin grant — format: `{reason}-{userId}-{contextId}`
2. Ledger INSERT before wallet UPDATE — same transaction, always
3. Two separate Redis clusters — session and ad-pacing
4. SDK auth is direct Supabase — no iframes, no postMessage
5. Deep links via Branch.io only — apple-app-site-association must be live before App Store submit

## Repo structure
apps/hub             Next.js hub
apps/game-01         First game (Phaser 3)
packages/sdk         @mtwg/sdk
packages/types       @mtwg/types
packages/db          @mtwg/db — Drizzle schema
packages/game-scaffold  Template for new games

## What to update each session
After each session, update the checklist above and add a note below:

### Session log
- Session 1: Generated full scaffold, .cursorrules, CONTEXT.md
