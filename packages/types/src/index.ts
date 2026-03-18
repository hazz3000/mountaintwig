// ─────────────────────────────────────────────────────────────────────────────
// @mtwg/types — shared TypeScript contracts for Mountain Twig Games platform
// Every type that crosses a service boundary lives here.
// ─────────────────────────────────────────────────────────────────────────────

// ── Platform config ───────────────────────────────────────────────────────────
export type Platform = 'ios' | 'android' | 'web'

export type CoinReason =
  | 'install_reward'    // installed a promoted game via cross-promo
  | 'first_session'     // played for the first time
  | 'level_complete'    // in-game milestone
  | 'daily_login'       // daily streak reward
  | 'streak_bonus'      // 7-day / 30-day streak milestone
  | 'referral_install'  // friend installed via your referral link
  | 'welcome_bonus'     // new player joined via referral
  | 'ad_watch'          // watched a rewarded ad

export type GameStatus   = 'live' | 'beta' | 'coming_soon' | 'retired'
export type CampaignStatus = 'active' | 'paused' | 'exhausted' | 'archived'
export type ReferralStatus = 'pending' | 'resolved' | 'expired'

// ── Database row types ────────────────────────────────────────────────────────
export interface UserRow {
  id:               string
  email:            string | null
  platform:         Platform
  country:          string
  acquisitionSrc:   string | null
  createdAt:        Date
}

export interface WalletRow {
  userId:       string
  softBalance:  number
  updatedAt:    Date
}

export interface LedgerRow {
  id:              string
  userId:          string
  amount:          number          // negative = spend
  reason:          CoinReason
  gameId:          string | null
  campaignId:      string | null
  idempotencyKey:  string
  createdAt:       Date
}

export interface GameRow {
  id:          string
  name:        string
  slug:        string             // e.g. 'game-01'
  description: string
  iconUrl:     string
  category:    string
  status:      GameStatus
  bundleId:    string             // e.g. 'games.mountaintwig.game01'
  iosAppId:    string | null
  androidId:   string | null
  createdAt:   Date
}

export interface CampaignRow {
  id:           string
  gameId:       string            // game being promoted
  rewardCoins:  number
  budgetCoins:  number
  spentCoins:   number
  deepLinkUrl:  string | null
  status:       CampaignStatus
  createdAt:    Date
}

export interface ReferralRow {
  id:          string
  referrerId:  string
  referredId:  string | null
  code:        string
  campaignId:  string | null
  status:      ReferralStatus
  rewardPaid:  boolean
  createdAt:   Date
  resolvedAt:  Date | null
}

// ── API request / response shapes ─────────────────────────────────────────────
export interface GrantCoinsRequest {
  reason:           CoinReason
  amount:           number
  idempotency_key:  string
  game_id?:         string
  campaign_id?:     string
}

export interface GrantCoinsResponse {
  ok:        boolean
  duplicate?: boolean
  amount?:   number
}

export interface WalletResponse {
  balance:  number
  currency: 'coins'
}

export interface AdUnit {
  campaign_id:  string
  game_id:      string
  game_name:    string
  icon_url:     string
  reward_coins: number
  deep_link_url: string
  cta:          string           // e.g. "Install and earn 500 coins"
}

export interface DailyLoginResponse {
  claimed:   boolean
  streak:    number
  bonus:     number             // bonus coins for streak milestone (0 if none)
  next_bonus_at: number | null // streak day of next bonus
}

export interface ReferralCodeResponse {
  code:      string
  share_url: string
  resolved:  number            // total successful referrals
  pending:   number
}

// ── Amplitude event shapes ─────────────────────────────────────────────────────
// Every event emitted by the SDK or platform API
export interface BaseEvent {
  event_id:   string            // UUID v4 — deduplication key
  user_id:    string
  game_id:    string
  platform:   Platform
  ts:         number            // Unix ms
}

export interface SessionStartEvent extends BaseEvent {
  type: 'session_start'
  sdk_version: string
}

export interface SessionEndEvent extends BaseEvent {
  type:     'session_end'
  duration: number              // seconds
}

export interface LevelCompleteEvent extends BaseEvent {
  type:  'level_complete'
  level: number
  score: number
}

export interface AdImpressionEvent extends BaseEvent {
  type:          'ad_impression'
  campaign_id:   string
  placement:     'between_levels' | 'game_over' | 'hub_catalog'
}

export interface AdClickEvent extends BaseEvent {
  type:        'ad_click'
  campaign_id: string
}

export interface CrossPromoInstallEvent extends BaseEvent {
  type:        'cross_promo_install'
  campaign_id: string
  source_game: string           // which game showed the promo
}

export interface ReferralInstallEvent extends BaseEvent {
  type:        'referral_install'
  referral_id: string
  referrer_id: string
}

export type MTWGEvent =
  | SessionStartEvent
  | SessionEndEvent
  | LevelCompleteEvent
  | AdImpressionEvent
  | AdClickEvent
  | CrossPromoInstallEvent
  | ReferralInstallEvent
