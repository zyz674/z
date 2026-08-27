import Phaser from 'phaser';
import { createCharacterAnimations, createGameTextures } from '../utils/TextureFactory';

/** 启动场景：程序化生成纹理后进入菜单。 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    createGameTextures(this);
    createCharacterAnimations(this);
    this.scene.start('MenuScene');
  }
}
