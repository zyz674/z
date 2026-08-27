import Phaser from 'phaser';
import type { EnemyTypeConfig } from '../config/BalanceConfig';
import type { ChapterEliteSettings } from '../types/Chapter';
import type { Player } from './Player';

/** 敌人：追踪玩家、可被击杀，包含自身属性；支持精英变体与头顶血条。 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly typeConfig: EnemyTypeConfig;
  hp: number;
  maxHp: number;
  contactDamage: number;
  scoreValue: number;
  xpValue: number;
  moveSpeed: number;
  elite = false;

  private target: Player | null = null;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private barWidth = 26;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    type: EnemyTypeConfig,
    hpMult: number,
    speedMult: number,
  ) {
    super(scene, x, y, type.textureKey);
    this.typeConfig = type;
    this.hp = Math.ceil(type.hp * hpMult);
    this.maxHp = this.hp;
    this.contactDamage = type.damage;
    this.scoreValue = type.score;
    this.xpValue = type.xp;
    this.moveSpeed = type.speed * speedMult;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(20);
    this.play(type.textureKey + '-walk');
    const half = type.size / 2;
    const radius = half - 2;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(radius, half - radius, half - radius);

    this.barWidth = type.size * 1.1;
    const barY = this.y - type.size * 0.6;
    this.hpBarBg = scene.add.rectangle(this.x, barY, this.barWidth, 4.5, 0x05101f, 0.85)
      .setDepth(24)
      .setStrokeStyle(1, 0xffffff, 0.28);
    this.hpBarFill = scene.add.rectangle(
      this.x - this.barWidth / 2,
      barY,
      this.barWidth,
      2.6,
      colorForType(this.typeConfig),
      0.95,
    ).setOrigin(0, 0.5).setDepth(25);
    this.updateBars();
  }

  setTarget(player: Player): void {
    this.target = player;
  }

  /** 精英化：生命/伤害/奖励上升，速度略降，体型放大。 */
  upgradeToElite(settings: ChapterEliteSettings): void {
    this.elite = true;
    this.hp = Math.round(this.hp * settings.hpMult);
    this.maxHp = this.hp;
    this.contactDamage = Math.round(this.contactDamage * settings.damageMult);
    this.scoreValue = Math.round(this.scoreValue * settings.scoreMult);
    this.xpValue = Math.round(this.xpValue * settings.xpMult);
    this.moveSpeed = this.moveSpeed * settings.speedMult;
    this.setScale(settings.scale);
    this.setTint(0xffc94d);
    this.barWidth = this.typeConfig.size * settings.scale * 1.1;
    this.hpBarFill.setFillStyle(0xffc94d, 0.95);
    this.updateBars();
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    this.flash();
    this.updateBars();
    return this.hp <= 0;
  }

  update(_time: number, _delta: number): void {
    if (!this.active || !this.target || !this.target.active) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body.enable) return;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
    this.setVelocity(Math.cos(angle) * this.moveSpeed, Math.sin(angle) * this.moveSpeed);
    this.updateBars();
  }

  destroy(fromScene?: boolean): void {
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    super.destroy(fromScene);
  }

  private updateBars(): void {
    if (!this.hpBarBg || !this.hpBarFill) return;
    const barY = this.y - (this.typeConfig.size * this.scaleX * 0.6);
    this.hpBarBg.setPosition(this.x, barY);
    this.hpBarFill.setPosition(this.x - this.barWidth / 2, barY);
    const width = this.barWidth * Math.max(0, this.hp / Math.max(1, this.maxHp));
    this.hpBarFill.setSize(width, 2.6);
  }

  private flash(): void {
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (!this.active) return;
      if (this.elite) this.setTint(0xffc94d);
      else this.clearTint();
    });
  }
}

function colorForType(type: EnemyTypeConfig): number {
  if (type.id === 'fast') return 0xffc94d;
  if (type.id === 'heavy') return 0xb15dff;
  return 0xff5d7e;
}
