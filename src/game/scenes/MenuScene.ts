import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config/GameConfig';
import { getChapterConfig } from '../data/ChapterConfig';
import { ui } from '../ui/UIManager';

/** 主菜单场景：霓虹背景 + DOM 开始界面。 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.drawBackground();
    this.createAmbientParticles();
    ui.setBindings({
      onStart: () => {
        const chapterId = ui.getSelectedChapterId();
        const config = getChapterConfig(chapterId);
        if (!config.playable) {
          ui.setChapterMessage('该章节内容尚未完成，本轮仅 Ch1 可完整游玩。');
          return;
        }
        this.scene.start('GameScene', { chapterId });
      },
    });
    ui.showStart();
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.setDepth(-100);
    g.lineStyle(1, 0x0e2a4a, 0.45);
    const step = 48;
    for (let x = 0; x <= VIEW_WIDTH; x += step) {
      g.lineBetween(x, 0, x, VIEW_HEIGHT);
    }
    for (let y = 0; y <= VIEW_HEIGHT; y += step) {
      g.lineBetween(0, y, VIEW_WIDTH, y);
    }
    g.lineStyle(2, 0x00f0ff, 0.08);
    g.lineBetween(0, VIEW_HEIGHT * 0.35, VIEW_WIDTH, VIEW_HEIGHT * 0.35);
    g.lineBetween(0, VIEW_HEIGHT * 0.68, VIEW_WIDTH, VIEW_HEIGHT * 0.68);
  }

  private createAmbientParticles(): void {
    this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: VIEW_WIDTH },
      y: { min: 0, max: VIEW_HEIGHT },
      speedY: { min: 12, max: 42 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.35, end: 0 },
      lifespan: 5200,
      quantity: 2,
      frequency: 240,
      tint: [0x00f0ff, 0x7c5cff, 0xff2d78],
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(-50);
  }
}
