import Phaser from 'phaser'

interface MenuData {
  userId:  string
  balance: number
  streak:  number
}

export class MenuScene extends Phaser.Scene {
  private balance = 0

  constructor() {
    super({ key: 'MenuScene' })
  }

  init(data: MenuData) {
    this.balance = data.balance
  }

  create() {
    const { width, height } = this.scale
    const cx = width / 2

    // Background
    this.add.rectangle(cx, height / 2, width, height, 0x111111)

    // Title — customise per game
    this.add.text(cx, height * 0.28, 'GAME TITLE', {
      fontSize:   '42px',
      color:      '#FF6A00',
      fontFamily: 'system-ui, sans-serif',
      fontStyle:  'bold',
    }).setOrigin(0.5)

    // Coin balance
    this.add.text(cx, height * 0.42, `🪙 ${this.balance.toLocaleString()} coins`, {
      fontSize:   '18px',
      color:      '#aaaaaa',
      fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0.5)

    // Play button
    const playBtn = this.add.text(cx, height * 0.58, 'PLAY', {
      fontSize:        '26px',
      color:           '#ffffff',
      fontFamily:      'system-ui, sans-serif',
      fontStyle:       'bold',
      backgroundColor: '#FF6A00',
      padding:         { x: 40, y: 14 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    playBtn.on('pointerover', () => playBtn.setStyle({ color: '#ffddcc' }))
    playBtn.on('pointerout',  () => playBtn.setStyle({ color: '#ffffff' }))
    playBtn.on('pointerdown', () => this.scene.start('GameScene'))
  }
}
