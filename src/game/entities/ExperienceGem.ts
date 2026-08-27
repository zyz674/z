import Phaser from 'phaser';

/** 经验晶体：靠近玩家后被吸附，重叠时拾取。 */
export class ExperienceGem extends Phaser.Physics.Arcade.Sprite {
  readonly value: number;

  constructor(scene: Phaser.Scene, x: number, y: number, value: number) {
    super(scene, x, y, 'gem');
    this.value = value;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(12);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(6, 4, 1);
  }
}
