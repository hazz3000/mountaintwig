// packages/db/src/__tests__/wallet.test.ts
// Run with: pnpm test --filter @mtwg/db
//
// Tests the most critical constraint in the system:
// duplicate coin grants must be blocked by idempotency_key.

import { describe, it, expect, beforeAll } from 'vitest'
import { db, wallets, rewardLedger, users } from '../index'
import { eq } from 'drizzle-orm'

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'

beforeAll(async () => {
  // Clean up test data
  await db.delete(rewardLedger).where(eq(rewardLedger.userId, TEST_USER_ID))
  await db.delete(wallets).where(eq(wallets.userId, TEST_USER_ID))
  await db.delete(users).where(eq(users.id, TEST_USER_ID))

  // Create test user + wallet
  await db.insert(users).values({ id: TEST_USER_ID, country: 'US' })
  await db.insert(wallets).values({ userId: TEST_USER_ID, softBalance: 0 })
})

describe('Wallet — idempotent coin grants', () => {
  const IDEMPOTENCY_KEY = 'test-grant-abc123-level-1'

  it('grants coins on first call', async () => {
    await db.transaction(async (tx) => {
      await tx.insert(rewardLedger).values({
        userId:         TEST_USER_ID,
        amount:         100,
        reason:         'level_complete',
        idempotencyKey: IDEMPOTENCY_KEY,
      })
      const { sql } = await import('drizzle-orm')
      await tx.insert(wallets)
        .values({ userId: TEST_USER_ID, softBalance: 100 })
        .onConflictDoUpdate({
          target: wallets.userId,
          set: {
            softBalance: sql`${wallets.softBalance} + 100`,
            updatedAt:   new Date(),
          },
        })
    })

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, TEST_USER_ID))

    expect(wallet.softBalance).toBe(100)
  })

  it('blocks duplicate grant with same idempotency key', async () => {
    let threw = false
    try {
      await db.insert(rewardLedger).values({
        userId:         TEST_USER_ID,
        amount:         100,
        reason:         'level_complete',
        idempotencyKey: IDEMPOTENCY_KEY, // same key — must throw
      })
    } catch (e: any) {
      // Postgres unique violation
      if (e?.code === '23505') threw = true
    }

    expect(threw).toBe(true)

    // Balance must still be 100 — not 200
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, TEST_USER_ID))

    expect(wallet.softBalance).toBe(100)
  })

  it('allows a second grant with a different idempotency key', async () => {
    const { sql } = await import('drizzle-orm')

    await db.transaction(async (tx) => {
      await tx.insert(rewardLedger).values({
        userId:         TEST_USER_ID,
        amount:         50,
        reason:         'level_complete',
        idempotencyKey: 'test-grant-abc123-level-2', // different key
      })
      await tx.insert(wallets)
        .values({ userId: TEST_USER_ID, softBalance: 50 })
        .onConflictDoUpdate({
          target: wallets.userId,
          set: {
            softBalance: sql`${wallets.softBalance} + 50`,
            updatedAt:   new Date(),
          },
        })
    })

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, TEST_USER_ID))

    expect(wallet.softBalance).toBe(150)
  })
})
