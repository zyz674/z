import Phaser from 'phaser';
import { PLAYER_BASE, xpToNext } from '../config/BalanceConfig';
import type { PlayerStats } from '../types';

/** 玩家：移动、受伤无敌、闪烁反馈。 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: PlayerStats;
  invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(30);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // 48x48 拟人纹理：以躯干为中心设置圆形碰撞体
    body.setCircle(16, 8, 8);
    this.setCollideWorldBounds(true);
    this.stats = {
      maxHp: PLAYER_BASE.maxHp,
      hp: PLAYER_BASE.maxHp,
      moveSpeed: PLAYER_BASE.moveSpeed,
      damage: PLAYER_BASE.damage,
      fireRate: PLAYER_BASE.fireRate,
      bulletSpeed: PLAYER_BASE.bulletSpeed,
      attackRange: PLAYER_BASE.attackRange,
      bulletCount: PLAYER_BASE.bulletCount,
      pierce: PLAYER_BASE.pierce,
      pickupRadius: PLAYER_BASE.pickupRadius,
      xp: 0,
      level: 1,
      xpToNext: xpToNext(1),
    };
  }

  move(dirX: number, dirY: number): void {
    const len = Math.hypot(dirX, dirY);
    if (len === 0) {
      this.setVelocity(0, 0);
      this.anims.stop();
      if (this.texture.key !== 'player') this.setTexture('player');
      return;
    }
    const speed = this.stats.moveSpeed;
    this.setVelocity((dirX / len) * speed, (dirY / len) * speed);
    if (!this.anims.isPlaying) this.play('player-walk');
  }

  /** 受到伤害：返回是否实际扣血。 */
  takeDamage(amount: number, now: number): boolean {
    if (now < this.invulnerableUntil || this.stats.hp <= 0) return false;
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.invulnerableUntil = now + PLAYER_BASE.invulnerableTime;
    this.flashHit();
    return true;
  }

  heal(amount: number): void {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  private flashHit(): void {
    this.scene.tweens.killTweensOf(this);
    this.setTintFill(0xffffff);
    this.setAlpha(0.4);
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 90,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        if (!this.active) return;
        this.clearTint();
        this.setAlpha(1);
      },
    });
  }
}
