import Phaser from 'phaser';
import type { BossConfig } from '../types/Chapter';
import type { Player } from './Player';

type DashState = 'idle' | 'warning' | 'dashing';

/** Ch1 关底 Boss：追踪 + 接触高伤 + 带预警的简单冲刺。 */
export class Boss extends Phaser.Physics.Arcade.Sprite {
  readonly bossConfig: BossConfig;
  readonly maxHp: number;
  hp: number;
  readonly contactDamage: number;
  readonly moveSpeed: number;

  private readonly target: Player;
  private nextContactAt = 0;
  private nextDashAt = 0;
  private dashState: DashState = 'idle';
  private dashUntil = 0;
  private warningUntil = 0;
  private dashAngle = 0;
  private readonly pulseTween: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: BossConfig,
    target: Player,
    hpMult: number,
  ) {
    super(scene, x, y, config.textureKey);
    this.bossConfig = config;
    this.target = target;
    this.maxHp = Math.round(config.maxHp * hpMult);
    this.hp = this.maxHp;
    this.contactDamage = config.contactDamage;
    this.moveSpeed = config.speed;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(26);
    this.play('boss_ch1-walk');
    const half = config.radius + 8;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(config.radius, half - config.radius, half - config.radius);

    this.nextDashAt = scene.time.now + config.dashIntervalMs;
    this.pulseTween = scene.tweens.add({
      targets: this,
      scale: { from: 1, to: 1.06 },
      duration: 620,
      yoyo: true,
      repeat: -1,
    });
  }

  update(time: number): void {
    if (!this.active || !this.target.active) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body.enable) return;

    if (this.dashState === 'idle') {
      this.moveTowardTarget();
      if (this.bossConfig.dashIntervalMs > 0 && time >= this.nextDashAt) {
        this.dashState = 'warning';
        this.warningUntil = time + this.bossConfig.dashWarningMs;
        this.setVelocity(0, 0);
        this.setTintFill(0xff7b54);
      }
      return;
    }

    if (this.dashState === 'warning') {
      this.setVelocity(0, 0);
      if (time >= this.warningUntil) {
        this.dashState = 'dashing';
        this.dashUntil = time + this.bossConfig.dashDurationMs;
        this.dashAngle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
        this.clearTint();
      }
      return;
    }

    // dashing
    const speed = this.moveSpeed * this.bossConfig.dashSpeedMult;
    this.setVelocity(Math.cos(this.dashAngle) * speed, Math.sin(this.dashAngle) * speed);
    if (time >= this.dashUntil) {
      this.dashState = 'idle';
      this.nextDashAt = time + this.bossConfig.dashIntervalMs;
    }
  }

  /** 接触伤害冷却检查，保证伤害受玩家无敌帧/冷却限制。 */
  tryContact(now: number): boolean {
    if (now < this.nextContactAt) return false;
    this.nextContactAt = now + this.bossConfig.contactCooldownMs;
    return true;
  }

  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    this.flashHit();
    return this.hp <= 0;
  }

  destroyBoss(): void {
    this.pulseTween.stop();
    this.destroy();
  }

  private moveTowardTarget(): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
    this.setVelocity(
      Math.cos(angle) * this.moveSpeed,
      Math.sin(angle) * this.moveSpeed,
    );
  }

  private flashHit(): void {
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (this.active && this.dashState !== 'warning') {
        this.clearTint();
      }
    });
  }
}
