// ─────────────────────────────────────────────────────────────────────────────
// @mtwg/sdk — Mountain Twig Games SDK
// Import this in every game. Five lines to be fully integrated.
//
// Usage:
//   import { createMTWG } from '@mtwg/sdk'
//   const mtwg = createMTWG('game-01')
//   const { userId, balance } = await mtwg.init()
//   await mtwg.grantCoins('level_complete', 50, `level-${userId}-${levelId}`)
//   const ad = await mtwg.getAd()
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  AdUnit,
  WalletResponse,
  GrantCoinsRequest,
  GrantCoinsResponse,
  DailyLoginResponse,
  CoinReason,
  Platform,
  MTWGEvent,
} from '@mtwg/types'

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ''
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const API_BASE      = process.env.MTWG_API_URL ?? 'https://mountaintwìggames.com'
const SDK_VERSION   = '0.1.0'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface InitResult {
  userId:   string
  balance:  number
  streak:   number
  platform: Platform
}

export interface SDKOptions {
  debug?: boolean
  platform?: Platform
}

// ── Main SDK class ────────────────────────────────────────────────────────────
class MTWGSDK {
  private gameId:   string
  private userId:   string | null = null
  private supabase: SupabaseClient
  private opts:     SDKOptions
  private platform: Platform

  constructor(gameId: string, opts: SDKOptions = {}) {
    this.gameId   = gameId
    this.opts     = opts
    this.platform = opts.platform ?? this.detectPlatform()
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  }

  // ── init() — call once on game boot ────────────────────────────────────────
  // Restores session, handles deep link attribution, fires daily login.
  // Returns userId and current coin balance.
  async init(): Promise<InitResult> {
    this.log('Initialising MTWG SDK', SDK_VERSION)

    // 1. Restore or create Supabase session
    const { data: { session } } = await this.supabase.auth.getSession()

    if (!session) {
      // No session — caller should show login UI
      // In Capacitor games this triggers the login overlay
      throw new Error('MTWG_NO_SESSION')
    }

    this.userId = session.user.id
    this.log('User identified:', this.userId)

    // 2. Ensure platform user row + wallet exist
    await this.post('/api/auth/register', {})

    // 3. Handle Branch.io deep link (cross-promo or referral attribution)
    await this.handleDeepLink()

    // 4. Claim daily login (silent — won't throw if already claimed today)
    const daily = await this.claimDaily()
    if (daily.claimed) {
      this.log(`Daily login claimed. Streak: ${daily.streak}`)
    }

    // 5. Track session start
    await this.trackEvent('session_start', { sdk_version: SDK_VERSION })

    // 6. Return userId + balance
    const { balance } = await this.getBalance()

    return {
      userId:   this.userId,
      balance,
      streak:   daily.streak,
      platform: this.platform,
    }
  }

  // ── trackEvent() ───────────────────────────────────────────────────────────
  async trackEvent(event: string, props?: Record<string, unknown>): Promise<void> {
    if (!this.userId) throw new Error('MTWG_NOT_INITIALISED')

    const payload = {
      event,
      game_id:   this.gameId,
      platform:  this.platform,
      sdk_version: SDK_VERSION,
      ...props,
    }

    // Fire Amplitude (non-blocking)
    this.fireAmplitude(event, payload)

    // Post to platform (non-blocking — don't await, don't block game)
    this.post('/api/events', payload).catch((e) =>
      this.log('Event post failed (non-fatal):', e)
    )
  }

  // ── grantCoins() ───────────────────────────────────────────────────────────
  // Idempotency key MUST be unique per grant action.
  // Format: `{reason}-{userId}-{contextId}`
  // e.g. `level_complete-abc123-level-5`
  async grantCoins(
    reason: CoinReason,
    amount: number,
    idempotencyKey: string,
  ): Promise<GrantCoinsResponse> {
    if (!this.userId) throw new Error('MTWG_NOT_INITIALISED')

    const body: GrantCoinsRequest = {
      reason,
      amount,
      idempotency_key: idempotencyKey,
      game_id:         this.gameId,
    }

    const result = await this.post<GrantCoinsResponse>('/api/rewards/grant', body)

    if (result.ok && !result.duplicate) {
      this.log(`Coins granted: ${amount} (${reason})`)
      await this.trackEvent('coins_granted', { reason, amount })
    }

    return result
  }

  // ── getBalance() ───────────────────────────────────────────────────────────
  async getBalance(): Promise<WalletResponse> {
    return this.get<WalletResponse>('/api/wallet')
  }

  // ── getAd() ────────────────────────────────────────────────────────────────
  // Returns the best cross-promo campaign for this player, or null.
  // Call between levels or on game-over screen.
  async getAd(): Promise<AdUnit | null> {
    try {
      const ad = await this.get<AdUnit | null>(`/api/ads?game_id=${this.gameId}`)
      if (ad) {
        await this.trackEvent('ad_impression', {
          campaign_id: ad.campaign_id,
          placement:   'between_levels',
        })
      }
      return ad
    } catch {
      return null  // Ads are non-critical — never block the game
    }
  }

  // ── trackAdClick() ─────────────────────────────────────────────────────────
  // Call this when the player taps a cross-promo ad before opening the link.
  async trackAdClick(campaignId: string): Promise<void> {
    await this.trackEvent('ad_click', { campaign_id: campaignId })
  }

  // ── claimDaily() ───────────────────────────────────────────────────────────
  async claimDaily(): Promise<DailyLoginResponse> {
    return this.post<DailyLoginResponse>('/api/rewards/daily-login', {})
  }

  // ── getStreak() ────────────────────────────────────────────────────────────
  async getStreak(): Promise<number> {
    const daily = await this.post<DailyLoginResponse>('/api/rewards/daily-login', {})
    return daily.streak
  }

  // ── Private: deep link handler ────────────────────────────────────────────
  // Reads Branch.io referringParams on app open.
  // If opened via cross-promo or referral link, fires attribution endpoint.
  private async handleDeepLink(): Promise<void> {
    try {
      // Check for Branch.io data in Capacitor plugins
      // @ts-expect-error — BranchDeepLinks is injected by capacitor-branch-deep-links
      if (typeof window === 'undefined' || !window.BranchDeepLinks) return

      // @ts-expect-error
      const { referringParams } = await window.BranchDeepLinks.initSession()
      if (!referringParams?.['+clicked_branch_link']) return

      const campaignId = referringParams['campaign_id']
      const referralId = referringParams['referral_id']

      if (campaignId) {
        this.log('Cross-promo deep link detected:', campaignId)
        await this.post('/api/referral/resolve-crosspromo', {
          campaign_id:     campaignId,
          idempotency_key: `crosspromo-${this.userId}-${campaignId}`,
        })
      }

      if (referralId) {
        this.log('Referral deep link detected:', referralId)
        await this.post('/api/referral/resolve', {
          referral_id:     referralId,
          idempotency_key: `referral-${this.userId}-${referralId}`,
        })
      }
    } catch (e) {
      this.log('Deep link handling failed (non-fatal):', e)
    }
  }

  // ── Private: HTTP helpers ──────────────────────────────────────────────────
  private async getToken(): Promise<string> {
    const { data: { session } } = await this.supabase.auth.getSession()
    if (!session?.access_token) throw new Error('MTWG_NO_SESSION')
    return session.access_token
  }

  private async get<T>(path: string): Promise<T> {
    const token = await this.getToken()
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`MTWG_API_ERROR ${res.status} ${path}`)
    return res.json()
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getToken()
    const res = await fetch(`${API_BASE}${path}`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`MTWG_API_ERROR ${res.status} ${path}`)
    return res.json()
  }

  // ── Private: Amplitude ────────────────────────────────────────────────────
  private fireAmplitude(event: string, props: Record<string, unknown>): void {
    try {
      // @ts-expect-error — Amplitude loaded via script tag or npm in Capacitor
      if (typeof amplitude !== 'undefined') {
        // @ts-expect-error
        amplitude.track(event, props)
      }
    } catch {
      // Amplitude is analytics — never block game logic
    }
  }

  // ── Private: platform detection ───────────────────────────────────────────
  private detectPlatform(): Platform {
    if (typeof window === 'undefined') return 'web'
    // @ts-expect-error — Capacitor global
    if (window.Capacitor?.getPlatform() === 'ios')     return 'ios'
    // @ts-expect-error
    if (window.Capacitor?.getPlatform() === 'android') return 'android'
    return 'web'
  }

  private log(...args: unknown[]): void {
    if (this.opts.debug || process.env.NODE_ENV === 'development') {
      console.log('[MTWG SDK]', ...args)
    }
  }
}

// ── Factory function ──────────────────────────────────────────────────────────
export const createMTWG = (gameId: string, opts?: SDKOptions) =>
  new MTWGSDK(gameId, opts)

export type { AdUnit, WalletResponse, DailyLoginResponse, InitResult }
