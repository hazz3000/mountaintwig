import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  unique,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'

// ── Enums ─────────────────────────────────────────────────────────────────────
export const platformEnum    = pgEnum('platform',     ['ios', 'android', 'web'])
export const gameStatusEnum  = pgEnum('game_status',  ['live', 'beta', 'coming_soon', 'retired'])
export const campaignStatusEnum = pgEnum('campaign_status', ['active', 'paused', 'exhausted', 'archived'])
export const referralStatusEnum = pgEnum('referral_status', ['pending', 'resolved', 'expired'])
export const coinReasonEnum  = pgEnum('coin_reason', [
  'install_reward',
  'first_session',
  'level_complete',
  'daily_login',
  'streak_bonus',
  'referral_install',
  'welcome_bonus',
  'ad_watch',
])

// ── Users ─────────────────────────────────────────────────────────────────────
// Note: auth is handled by Supabase Auth — this table extends it
// user_id matches the Supabase auth.users id (UUID)
export const users = pgTable('users', {
  id:             uuid('id').primaryKey(),                    // mirrors auth.users.id
  email:          text('email'),
  platform:       platformEnum('platform').notNull().default('web'),
  country:        text('country').notNull().default('US'),
  acquisitionSrc: text('acquisition_src'),                   // 'organic' | 'referral' | campaign id
  createdAt:      timestamp('created_at').notNull().defaultNow(),
})

// ── Wallets ───────────────────────────────────────────────────────────────────
// One row per player. softBalance is the current coin total.
// NEVER update this directly — always go through reward_ledger first.
export const wallets = pgTable('wallets', {
  userId:       uuid('user_id').primaryKey().references(() => users.id),
  softBalance:  integer('soft_balance').notNull().default(0),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
})

// ── Reward ledger ─────────────────────────────────────────────────────────────
// Append-only. Every earn and spend writes here first.
// The idempotency_key unique constraint is what prevents double-grants.
// NEVER UPDATE or DELETE a row. Only INSERT.
export const rewardLedger = pgTable('reward_ledger', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').notNull().references(() => users.id),
  amount:         integer('amount').notNull(),               // negative = spend
  reason:         coinReasonEnum('reason').notNull(),
  gameId:         text('game_id'),
  campaignId:     uuid('campaign_id'),
  idempotencyKey: text('idempotency_key').notNull(),         // UNIQUE — prevents duplicates
  createdAt:      timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqIdempotency: unique().on(t.idempotencyKey),           // THE most important constraint
  idxUserId:       index('ledger_user_id_idx').on(t.userId),
  idxCreatedAt:    index('ledger_created_at_idx').on(t.createdAt),
}))

// ── Games ─────────────────────────────────────────────────────────────────────
export const games = pgTable('games', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  slug:        text('slug').notNull().unique(),              // e.g. 'game-01'
  description: text('description').notNull().default(''),
  iconUrl:     text('icon_url').notNull().default(''),
  category:    text('category').notNull().default('casual'),
  status:      gameStatusEnum('status').notNull().default('beta'),
  bundleId:    text('bundle_id').notNull().unique(),         // 'games.mountaintwig.game01'
  iosAppId:    text('ios_app_id'),                          // App Store numeric ID
  androidId:   text('android_id'),                          // Play Store package name
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── User games (installed tracking) ──────────────────────────────────────────
// Records which games a user has ever played.
// Used by /api/ads to exclude already-installed games from cross-promo.
export const userGames = pgTable('user_games', {
  userId:    uuid('user_id').notNull().references(() => users.id),
  gameId:    uuid('game_id').notNull().references(() => games.id),
  firstSeen: timestamp('first_seen').notNull().defaultNow(),
}, (t) => ({
  pk: unique().on(t.userId, t.gameId),
}))

// ── Campaigns ─────────────────────────────────────────────────────────────────
// A campaign = "promote this game, grant X coins on install"
// Each game can have one active campaign at a time.
export const campaigns = pgTable('campaigns', {
  id:           uuid('id').primaryKey().defaultRandom(),
  gameId:       uuid('game_id').notNull().references(() => games.id),
  rewardCoins:  integer('reward_coins').notNull().default(500),
  budgetCoins:  integer('budget_coins').notNull(),           // total coins available to give out
  spentCoins:   integer('spent_coins').notNull().default(0),
  deepLinkUrl:  text('deep_link_url'),                      // Branch.io short link
  status:       campaignStatusEnum('status').notNull().default('active'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  idxGameId: index('campaign_game_id_idx').on(t.gameId),
  idxStatus: index('campaign_status_idx').on(t.status),
}))

// ── Referrals ─────────────────────────────────────────────────────────────────
export const referrals = pgTable('referrals', {
  id:          uuid('id').primaryKey().defaultRandom(),
  referrerId:  uuid('referrer_id').notNull().references(() => users.id),
  referredId:  uuid('referred_id').references(() => users.id), // null until resolved
  code:        text('code').notNull().unique(),               // 8-char alphanumeric
  campaignId:  uuid('campaign_id').references(() => campaigns.id),
  status:      referralStatusEnum('status').notNull().default('pending'),
  rewardPaid:  boolean('reward_paid').notNull().default(false),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  resolvedAt:  timestamp('resolved_at'),
}, (t) => ({
  idxReferrerId: index('referral_referrer_id_idx').on(t.referrerId),
  idxCode:       index('referral_code_idx').on(t.code),
}))

// ── Notification tokens ───────────────────────────────────────────────────────
// FCM (Android) and APNs (iOS) push tokens per device.
// Used in Week 8+ for PvP challenge notifications.
export const notificationTokens = pgTable('notification_tokens', {
  userId:    uuid('user_id').notNull().references(() => users.id),
  deviceId:  uuid('device_id').notNull(),
  platform:  platformEnum('platform').notNull(),
  token:     text('token').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  pk: unique().on(t.userId, t.deviceId),
}))
