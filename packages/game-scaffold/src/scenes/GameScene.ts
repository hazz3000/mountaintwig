import Phaser from 'phaser'

// ─────────────────────────────────────────────────────────────────────────────
// GameScene — replace the contents of create() and update() with your game.
// The SDK calls at the bottom (grantCoins, getAd) stay as-is.
// ─────────────────────────────────────────────────────────────────────────────

export class GameScene extends Phaser.Scene {
  private score     = 0
  private scoreText!: Phaser.GameObjects.Text
  private gameActive = true
  private sessionStart = Date.now()

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale
    const cx = width / 2

    this.score      = 0
    this.gameActive = true

    // ── Score display ──────────────────────────────────────────────────────────
    this.scoreText = this.add.text(cx, 60, 'Score: 0', {
      fontSize:   '24px',
      color:      '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontStyle:  'bold',
    }).setOrigin(0.5)

    // ── TODO: Replace below with your actual game ──────────────────────────────
    // Placeholder: tap anywhere to score a point
    this.add.text(cx, height / 2, 'Tap to score', {
      fontSize:   '20px',
      color:      '#666666',
      fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0.5)

    this.input.on('pointerdown', () => {
      if (!this.gameActive) return
      this.score++
      this.scoreText.setText(`Score: ${this.score}`)

      // ── Grant coins on milestone ─────────────────────────────────────────────
      // Replace 10 with your actual milestone condition
      if (this.score === 10) {
        this.onMilestone('level_1')
      }

      // Placeholder: end game at score 20
      if (this.score >= 20) {
        this.endGame()
      }
    })

    // ── Back button ────────────────────────────────────────────────────────────
    this.add.text(24, 24, '←', {
      fontSize: '28px', color: '#666',
      fontFamily: 'system-ui, sans-serif',
    })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MenuScene'))
  }

  private async onMilestone(milestoneId: string) {
    if (!window.mtwg) return
    const userId = window.mtwgUserId

    await window.mtwg.grantCoins(
      'level_complete',
      50,
      `level_complete-${userId}-${milestoneId}`,  // idempotency key
    )

    // Show a brief coin animation
    const { width } = this.scale
    const coinPop = this.add.text(width / 2, 120, '+50 🪙', {
      fontSize: '22px', color: '#FF6A00',
      fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: coinPop,
      alpha:   { from: 1, to: 0 },
      y:       { from: 120, to: 60 },
      duration: 1200,
      ease:    'Power2',
      onComplete: () => coinPop.destroy(),
    })
  }

  private async endGame() {
    if (!this.gameActive) return
    this.gameActive = false

    const duration = Math.floor((Date.now() - this.sessionStart) / 1000)
    await window.mtwg?.trackEvent('session_end', { score: this.score, duration })

    // ── Show cross-promo ad before game over screen ────────────────────────────
    const ad = await window.mtwg?.getAd()

    this.scene.start('GameOverScene', {
      score: this.score,
      ad:    ad ?? null,
    })
  }

  update() {
    // Game loop — implement here
  }
}
