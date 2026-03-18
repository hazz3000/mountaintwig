// ─────────────────────────────────────────────────────────────────────────────
// Mountain Twig Games — Game scaffold
// Copy apps/game-template to apps/game-XX and replace the game logic in
// src/scenes/GameScene.ts. Everything else (SDK, auth, ads) is pre-wired.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser'
import { BootScene }     from './scenes/BootScene'
import { MenuScene }     from './scenes/MenuScene'
import { GameScene }     from './scenes/GameScene'
import { GameOverScene } from './scenes/GameOverScene'

const config: Phaser.Types.Core.GameConfig = {
  type:            Phaser.AUTO,
  width:           390,            // iPhone 14 Pro logical width
  height:          844,            // iPhone 14 Pro logical height
  backgroundColor: '#111111',
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
  physics: {
    default: 'arcade',
    arcade:  { debug: import.meta.env.DEV },
  },
}

new Phaser.Game(config)
