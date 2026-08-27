import Phaser from 'phaser';
import { ENEMY_TYPES } from '../config/BalanceConfig';

type HeroVariant = 'normal' | 'fast' | 'heavy';

interface HeroPalette {
  body: number;
  accent: number;
  dark: number;
  glow: number;
  eye: number;
}

/** 用 Graphics 程序化生成所有纹理（拟人化角色 + 2 帧步行动画，不依赖外部素材）。 */
export function createGameTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('player')) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // 玩家：赛博幸存者（两帧步行动画）
  drawHumanoid(g, 48, {
    body: 0x0d4a5e,
    accent: 0x00e5ff,
    dark: 0x003344,
    glow: 0x00f0ff,
    eye: 0xffffff,
  }, 'normal', true, 0);
  g.generateTexture('player', 48, 48);
  drawHumanoid(g, 48, {
    body: 0x0d4a5e,
    accent: 0x00e5ff,
    dark: 0x003344,
    glow: 0x00f0ff,
    eye: 0xffffff,
  }, 'normal', true, 1);
  g.generateTexture('player_walk_1', 48, 48);

  // 子弹：青绿色短光条
  g.clear();
  g.fillStyle(0x00ffe1, 1);
  g.fillRoundedRect(0, 2, 16, 6, 3);
  g.fillStyle(0xffffff, 0.9);
  g.fillRoundedRect(11, 4, 5, 2, 1);
  g.generateTexture('bullet', 16, 10);

  // 经验晶体：绿色菱形
  g.clear();
  g.fillStyle(0x123d2a, 1);
  g.fillTriangle(10, 0, 2, 12, 18, 12);
  g.fillStyle(0x38ff9c, 1);
  g.fillTriangle(10, 3, 4, 12, 16, 12);
  g.fillStyle(0xffffff, 0.9);
  g.fillTriangle(10, 5, 7, 12, 13, 12);
  g.generateTexture('gem', 20, 14);

  // 粒子：小型白色圆点（运行时用 tint 染色）
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture('particle', 8, 8);

  // 玩家霓虹光环
  g.clear();
  g.fillStyle(0x00e5ff, 0.12);
  g.fillCircle(40, 40, 37);
  g.lineStyle(2, 0x00e5ff, 0.5);
  g.strokeCircle(40, 40, 38);
  g.generateTexture('aura', 80, 80);

  // 敌人：拟人化异变体（两帧行走）
  const enemyPalettes: Record<string, HeroPalette> = {
    normal: { body: 0x57101f, accent: 0xff5d7e, dark: 0x2b0812, glow: 0xff5d7e, eye: 0xffd9e0 },
    fast: { body: 0x5c3d08, accent: 0xffc94d, dark: 0x2d1f04, glow: 0xffc94d, eye: 0xfff3c9 },
    heavy: { body: 0x2f1758, accent: 0xb15dff, dark: 0x160a2b, glow: 0xb15dff, eye: 0xf0d8ff },
  };
  const enemyVariants: Record<string, HeroVariant> = {
    enemy_normal: 'normal',
    enemy_fast: 'fast',
    enemy_heavy: 'heavy',
  };
  for (const type of ENEMY_TYPES) {
    const d = type.size;
    const palette = enemyPalettes[type.id];
    const variant = enemyVariants[type.textureKey] ?? 'normal';
    g.clear();
    drawHumanoid(g, d, palette, variant, false, 0);
    g.generateTexture(type.textureKey, d, d);
    g.clear();
    drawHumanoid(g, d, palette, variant, false, 1);
    g.generateTexture(type.textureKey + '_1', d, d);
  }

  // Ch1 Boss：巨型拟人化怪物（两帧动画）
  const bossPalette: HeroPalette = {
    body: 0x2a0f3f,
    accent: 0xff2d78,
    dark: 0x1a0728,
    glow: 0xb15dff,
    eye: 0xffffff,
  };
  g.clear();
  drawHumanoid(g, 96, bossPalette, 'heavy', false, 0);
  g.fillStyle(0xff2d78, 1);
  g.fillCircle(48, 52, 12);
  g.lineStyle(3, 0xffffff, 0.9);
  g.strokeCircle(48, 52, 12);
  g.fillStyle(0xffd0e2, 1);
  g.fillCircle(48, 52, 5);
  g.generateTexture('boss_ch1', 96, 96);

  g.clear();
  drawHumanoid(g, 96, bossPalette, 'heavy', false, 1);
  g.fillStyle(0xff2d78, 1);
  g.fillCircle(48, 52, 12);
  g.lineStyle(3, 0xffffff, 0.9);
  g.strokeCircle(48, 52, 12);
  g.fillStyle(0xffd0e2, 1);
  g.fillCircle(48, 52, 5);
  g.generateTexture('boss_ch1_1', 96, 96);

  g.destroy();
}

/** 注册角色循环动画（应在纹理生成后调用一次）。 */
export function createCharacterAnimations(scene: Phaser.Scene): void {
  if (!scene.anims.exists('player-walk')) {
    scene.anims.create({
      key: 'player-walk',
      frames: [{ key: 'player' }, { key: 'player_walk_1' }],
      frameRate: 7,
      repeat: -1,
    });
  }
  for (const type of ENEMY_TYPES) {
    const key = type.textureKey + '-walk';
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: [{ key: type.textureKey }, { key: type.textureKey + '_1' }],
        frameRate: 6,
        repeat: -1,
      });
    }
  }
  if (!scene.anims.exists('boss_ch1-walk')) {
    scene.anims.create({
      key: 'boss_ch1-walk',
      frames: [{ key: 'boss_ch1' }, { key: 'boss_ch1_1' }],
      frameRate: 4,
      repeat: -1,
    });
  }
}

/**
 * 绘制卡通人（chibi）角色：大头 + 大眼 + 小身体 + 小短腿。
 * frame=1 时腿部错位形成两帧走路动画；表情区分玩家与敌怪。
 */
function drawHumanoid(
  g: Phaser.GameObjects.Graphics,
  size: number,
  p: HeroPalette,
  variant: HeroVariant,
  hero: boolean,
  frame: number,
): void {
  const r = size / 2;
  const isHeavy = variant === 'heavy';
  const isFast = variant === 'fast';
  const outline = p.dark;

  // 底部发光晕圈
  g.fillStyle(p.glow, 0.16);
  g.fillCircle(r, r, r - 1);

  // 小短腿（两帧交替）
  const legW = size * 0.11;
  const legH = size * 0.13;
  const legY = size * 0.68;
  const shift = frame === 1 ? size * 0.045 : 0;
  g.fillStyle(p.accent, 1);
  g.fillRoundedRect(r - size * 0.14 + shift, legY, legW, legH + size * 0.08, legW / 2);
  g.fillRoundedRect(r + size * 0.14 - legW - shift, legY, legW, legH + size * 0.08, legW / 2);
  g.fillStyle(outline, 1);
  g.fillRoundedRect(r - size * 0.14 + shift, legY + legH + size * 0.04, legW, size * 0.045, 3);
  g.fillRoundedRect(r + size * 0.14 - legW - shift, legY + legH + size * 0.04, legW, size * 0.045, 3);

  // 身体
  const bodyW = size * (isHeavy ? 0.5 : isFast ? 0.34 : 0.42);
  const bodyH = size * (isHeavy ? 0.26 : 0.24);
  const bodyX = r - bodyW / 2;
  const bodyY = size * 0.38;
  g.fillStyle(p.body, 1);
  g.fillRoundedRect(bodyX, bodyY, bodyW, bodyH, bodyH / 2);
  g.lineStyle(2, outline, 1);
  g.strokeRoundedRect(bodyX, bodyY, bodyW, bodyH, bodyH / 2);

  // 手臂
  const armR = size * (isHeavy ? 0.1 : 0.08);
  const armOffset = frame === 1 ? size * 0.03 : 0;
  g.fillStyle(p.accent, 1);
  g.fillCircle(bodyX - 1, bodyY + bodyH * 0.4 + armOffset, armR);
  g.fillCircle(bodyX + bodyW + 1, bodyY + bodyH * 0.4 - armOffset, armR);

  // 大头
  const headR = size * (isHeavy ? 0.27 : 0.23);
  const headY = size * 0.21;
  g.fillStyle(p.accent, 1);
  g.fillCircle(r, headY, headR);
  g.lineStyle(2, outline, 1);
  g.strokeCircle(r, headY, headR);

  if (hero) {
    // 玩家：发光头带
    g.fillStyle(p.eye, 0.95);
    g.fillRoundedRect(r - headR * 0.72, headY - headR * 0.42, headR * 1.44, headR * 0.26, 4);
  }
  if (isHeavy) {
    // 重装：小角
    g.fillStyle(p.accent, 1);
    g.fillTriangle(r - headR * 0.7, headY - headR * 0.55, r - headR * 0.35, headY - headR * 1.1, r - headR * 0.15, headY - headR * 0.55);
    g.fillTriangle(r + headR * 0.7, headY - headR * 0.55, r + headR * 0.35, headY - headR * 1.1, r + headR * 0.15, headY - headR * 0.55);
  }
  if (isFast) {
    // 疾行者：尖发
    g.fillStyle(p.accent, 1);
    g.fillTriangle(r - headR * 0.4, headY - headR * 0.75, r, headY - headR * 1.15, r + headR * 0.4, headY - headR * 0.75);
  }

  // 眼睛
  const eyeDX = headR * 0.33;
  const eyeY = headY + headR * 0.08;
  const eyeR = headR * 0.15;
  g.fillStyle(0xffffff, 1);
  g.fillCircle(r - eyeDX, eyeY, eyeR);
  g.fillCircle(r + eyeDX, eyeY, eyeR);
  g.fillStyle(0x1c1c2e, 1);
  g.fillCircle(r - eyeDX, eyeY, eyeR * 0.52);
  g.fillCircle(r + eyeDX, eyeY, eyeR * 0.52);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(r - eyeDX - eyeR * 0.18, eyeY - eyeR * 0.2, eyeR * 0.2);
  g.fillCircle(r + eyeDX - eyeR * 0.18, eyeY - eyeR * 0.2, eyeR * 0.2);

  // 嘴巴
  g.fillStyle(outline, 1);
  if (hero) {
    g.fillRoundedRect(r - headR * 0.15, headY + headR * 0.45, headR * 0.3, headR * 0.11, 3);
  } else {
    g.fillRoundedRect(r - headR * 0.2, headY + headR * 0.46, headR * 0.4, headR * 0.09, 2);
  }

  // 敌人眉毛（生气脸）
  if (!hero) {
    g.lineStyle(2, outline, 1);
    g.lineBetween(r - eyeDX - eyeR * 0.55, eyeY - eyeR * 1.2, r - eyeDX + eyeR * 0.45, eyeY - eyeR * 0.6);
    g.lineBetween(r + eyeDX - eyeR * 0.45, eyeY - eyeR * 0.6, r + eyeDX + eyeR * 0.55, eyeY - eyeR * 1.2);
  }

  if (hero) {
    // 玩家的能量武器线
    g.lineStyle(3, p.glow, 0.9);
    g.lineBetween(bodyX + bodyW * 1.2, bodyY + 3, bodyX + bodyW * 1.95, bodyY - 2);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(bodyX + bodyW * 1.95, bodyY - 2, 2.6);
  }
}
