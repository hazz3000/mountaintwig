import Phaser from 'phaser'
import { createMTWG } from '@mtwg/sdk'

// ── CHANGE THIS per game ──────────────────────────────────────────────────────
const GAME_ID = 'game-01'   // must match the slug in the games table
// ─────────────────────────────────────────────────────────────────────────────

// Make mtwg available globally so all scenes can call it
declare global {
  interface Window {
    mtwg: ReturnType<typeof createMTWG>
    mtwgUserId: string
    mtwgBalance: number
  }
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Preload shared assets (loading bar, logo)
    this.load.image('logo', '/assets/mtwg-logo.png')
  }

  async create() {
    const { width, height } = this.scale

    // ── Loading screen ────────────────────────────────────────────────────────
    const loadingText = this.add
      .text(width / 2, height / 2, 'Loading…', {
        fontSize:  '18px',
        color:     '#999999',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5)

    // ── Init SDK ──────────────────────────────────────────────────────────────
    window.mtwg = createMTWG(GAME_ID, { debug: import.meta.env.DEV })

    try {
      const { userId, balance, streak } = await window.mtwg.init()
      window.mtwgUserId  = userId
      window.mtwgBalance = balance

      console.log(`[MTWG] Loaded — user: ${userId}, balance: ${balance}, streak: ${streak}`)

      loadingText.destroy()
      this.scene.start('MenuScene', { userId, balance, streak })

    } catch (err: any) {
      if (err?.message === 'MTWG_NO_SESSION') {
        // No auth session — show login overlay
        loadingText.setText('Tap to sign in')
        this.showLoginOverlay()
      } else {
        loadingText.setText('Failed to load. Please restart.')
        console.error('[MTWG Boot]', err)
      }
    }
  }

  private showLoginOverlay() {
    // Inject Supabase login UI as an HTML overlay
    const overlay = document.createElement('div')
    overlay.id    = 'mtwg-login-overlay'
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #111; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 24px;
      font-family: system-ui, sans-serif;
    `
    overlay.innerHTML = `
      <div style="color:#FF6A00;font-size:24px;font-weight:900;letter-spacing:2px">
        MOUNTAIN TWIG
      </div>
      <div style="color:#aaa;font-size:14px">Sign in to save your progress and earn coins</div>
      <input id="mtwg-email" type="email" placeholder="Email"
        style="width:260px;padding:12px 16px;border-radius:12px;border:1px solid #333;
               background:#1a1a1a;color:#fff;font-size:16px;outline:none">
      <button id="mtwg-signin"
        style="width:260px;padding:13px;border-radius:12px;background:#FF6A00;
               color:#fff;font-size:16px;font-weight:700;border:none;cursor:pointer">
        Send magic link
      </button>
      <div id="mtwg-login-msg" style="color:#888;font-size:13px;min-height:20px"></div>
    `
    document.body.appendChild(overlay)

    document.getElementById('mtwg-signin')?.addEventListener('click', async () => {
      const email = (document.getElementById('mtwg-email') as HTMLInputElement)?.value
      const msg   = document.getElementById('mtwg-login-msg')!
      if (!email) { msg.textContent = 'Please enter your email'; return }

      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      )
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      })
      msg.textContent = error
        ? 'Something went wrong — try again'
        : 'Check your email for a magic link!'
    })
  }
}
