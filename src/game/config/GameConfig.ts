import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { GameScene } from '../scenes/GameScene';

export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;

export const NeonGameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: '#0b0820',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: [BootScene, MenuScene, GameScene],
};
