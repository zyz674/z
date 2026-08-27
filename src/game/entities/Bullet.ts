import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config/GameConfig';

/** 子弹：命中后消失或穿透，离开地图自动销毁。 */
export class Bullet extends Phaser.Physics.Arcade.Sprite {
  damage = 0;
  pierce = 0;

  constructor(scene: Phaser.Scene, x = 0, y = 0, texture = 'bullet') {
    super(scene, x, y, texture);
  }

  launch(x: number, y: number, angle: number, damage: number, pierce: number, speed: number): void {
    this.setActive(true);
    this.setVisible(true);
    this.enableBody(true, x, y, true, true);
    this.setRotation(angle);
    this.damage = damage;
    this.pierce = pierce;
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.scene.physics.velocityFromRotation(angle, speed, body.velocity);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    if (
      this.x < -40 || this.x > VIEW_WIDTH + 40 ||
      this.y < -40 || this.y > VIEW_HEIGHT + 40
    ) {
      this.destroy();
    }
  }
}
