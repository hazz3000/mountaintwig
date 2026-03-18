import { NextRequest, NextResponse } from 'next/server'
import { db, referrals } from '@mtwg/db'
import { eq, count } from 'drizzle-orm'
import { getAuthUser } from '@/lib/supabase'

// Generates a referral code for the user if one doesn't exist,
// returns the code and a Branch.io share URL.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Find or create referral code ────────────────────────────────────────────
  const existing = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referrerId, user.id))
    .limit(1)

  let code: string
  if (existing[0]) {
    code = existing[0].code
  } else {
    code = generateCode()
    await db.insert(referrals).values({
      referrerId: user.id,
      code,
      status: 'pending',
    })
  }

  // ── Count resolved referrals ────────────────────────────────────────────────
  const [resolvedCount] = await db
    .select({ value: count() })
    .from(referrals)
    .where(eq(referrals.referrerId, user.id))

  // ── Build share URL ─────────────────────────────────────────────────────────
  // In production this should be a Branch.io short link
  // For now use a direct URL — swap for Branch in Week 7
  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mountaintwìggames.com'
  const shareUrl = `${baseUrl}/r/${code}`

  return NextResponse.json({
    code,
    share_url: shareUrl,
    resolved:  resolvedCount?.value ?? 0,
    pending:   0,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateCode(): string {
  const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I confusion
  let result   = ''
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
