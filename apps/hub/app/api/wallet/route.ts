import { NextRequest, NextResponse } from 'next/server'
import { db, wallets, rewardLedger } from '@mtwg/db'
import { eq, desc } from 'drizzle-orm'
import { getAuthUser } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [wallet, recent] = await Promise.all([
    db.select().from(wallets).where(eq(wallets.userId, user.id)).limit(1),
    db.select()
      .from(rewardLedger)
      .where(eq(rewardLedger.userId, user.id))
      .orderBy(desc(rewardLedger.createdAt))
      .limit(20),
  ])

  return NextResponse.json({
    balance:  wallet[0]?.softBalance ?? 0,
    currency: 'coins',
    recent,
  })
}
