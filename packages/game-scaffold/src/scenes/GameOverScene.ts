import Phaser from 'phaser'
import type { AdUnit } from '@mtwg/types'

interface GameOverData {
  score: number
  ad:    AdUnit | null
}

export class GameOverScene extends Phaser.Scene {
  private score = 0
  private ad: AdUnit | null = null

  constructor() {
    super({ key: 'GameOverScene' })
  }

  init(data: GameOverData) {
    this.score = data.score
    this.ad    = data.ad
  }

  create() {
    const { width, height } = this.scale
    const cx = width / 2

    this.add.rectangle(cx, height / 2, width, height, 0x111111)

    this.add.text(cx, height * 0.18, 'GAME OVER', {
      fontSize: '36px', color: '#ffffff',
      fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5)

    this.add.text(cx, height * 0.28, `Score: ${this.score}`, {
      fontSize: '24px', color: '#aaaaaa',
      fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0.5)

    // ── Cross-promo ad card ────────────────────────────────────────────────────
    if (this.ad) {
      this.renderAdCard(this.ad, cx, height * 0.5)
    }

    // ── Play again ─────────────────────────────────────────────────────────────
    const y = this.ad ? height * 0.78 : height * 0.55
    this.add.text(cx, y, 'PLAY AGAIN', {
      fontSize: '22px', color: '#ffffff',
      fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      backgroundColor: '#FF6A00', padding: { x: 36, y: 12 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('GameScene'))

    this.add.text(cx, y + 60, 'Menu', {
      fontSize: '16px', color: '#666666',
      fontFamily: 'system-ui, sans-serif',
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MenuScene'))
  }

  private renderAdCard(ad: AdUnit, cx: number, cy: number) {
    // Card background
    this.add.rectangle(cx, cy, 300, 110, 0x1a1a2e)
      .setStrokeStyle(1, 0xff6a00)

    this.add.text(cx - 120, cy - 28, ad.game_name, {
      fontSize: '16px', color: '#ffffff',
      fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
    })

    this.add.text(cx - 120, cy - 6, ad.cta, {
      fontSize: '13px', color: '#aaaaaa',
      fontFamily: 'system-ui, sans-serif',
    })

    // Install CTA button
    this.add.text(cx, cy + 28, `Install — earn ${ad.reward_coins} 🪙`, {
      fontSize: '14px', color: '#ffffff',
      fontFamily: 'system-ui, sans-serif', fontStyle: 'bold',
      backgroundColor: '#6A1B9A', padding: { x: 16, y: 8 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', async () => {
        await window.mtwg?.trackAdClick(ad.campaign_id)
        window.open(ad.deep_link_url, '_blank')
      })
  }
}
