import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config/GameConfig';
import { DIFFICULTY, ENEMY_TYPES, xpToNext, type EnemyTypeConfig } from '../config/BalanceConfig';
import { CHAPTERS, chapterIdForNumber, chapterNumber, getChapterConfig } from '../data/ChapterConfig';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { ExperienceGem } from '../entities/ExperienceGem';
import { Boss } from '../entities/Boss';
import { audio } from '../systems/AudioManager';
import { ChapterManager, type ChapterCallbacks } from '../systems/ChapterManager';
import { getUpgradeDef, nextUpgradeSet } from '../systems/Upgrades';
import { clearSaveData, loadSave, recordChapterResult } from '../storage/SaveData';
import { ui, type HudViewData } from '../ui/UIManager';
import type {
  ChapterConfig,
  ChapterId,
  ChapterPhase,
  DebugSnapshot,
  FailureReason,
  NeonDebugApi,
  ResultViewData,
  RunState,
} from '../types/Chapter';
import type { UpgradeCardData, UpgradeId } from '../types';

type GameMode = 'running' | 'paused' | 'upgrading' | 'victory' | 'failed';
type Targetable = Enemy | Boss;

interface GameSceneData {
  chapterId?: ChapterId;
}

/** 核心玩法场景：章节制时间线、Boss 战、自动攻击、升级、暂停与结算。 */
export class GameScene extends Phaser.Scene {
  private chapterId: ChapterId = 'ch1';
  private chapterConfig!: ChapterConfig;
  private chapterManager!: ChapterManager;

  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private gems!: Phaser.Physics.Arcade.Group;
  private bossGroup!: Phaser.Physics.Arcade.Group;
  private boss: Boss | null = null;
  private bossSpawnRequested = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  private mode: GameMode = 'running';
  private totalScore = 0;
  private kills = 0;
  private nextFireAt = 0;
  private hudTimer = 0;
  private spawnEvent: Phaser.Time.TimerEvent | null = null;
  private upgradeLevels = new Map<UpgradeId, number>();
  private muzzle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private playerTrail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private playerAura!: Phaser.GameObjects.Image;
  private edgeVignette!: Phaser.GameObjects.Graphics;
  private debugApi: NeonDebugApi | null = null;

  private handleEsc = (): void => {
    this.togglePause();
  };

  private handleWindowBlur = (): void => {
    if (this.mode === 'running') this.pauseGame();
  };

  constructor() {
    super('GameScene');
  }

  init(data: GameSceneData): void {
    this.chapterId = data?.chapterId ?? 'ch1';
  }

  create(): void {
    this.chapterConfig = getChapterConfig(this.chapterId);
    this.mode = 'running';
    this.totalScore = 0;
    this.kills = 0;
    this.nextFireAt = 0;
    this.hudTimer = 0;
    this.spawnEvent = null;
    this.boss = null;
    this.bossSpawnRequested = false;
    this.upgradeLevels.clear();
    this.time.timeScale = 1;
    this.physics.world.setBounds(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    this.drawBackground();

    this.bullets = this.physics.add.group({
      classType: Bullet,
      maxSize: 240,
      runChildUpdate: true,
    });
    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: 160,
      runChildUpdate: true,
    });
    this.gems = this.physics.add.group();
    this.bossGroup = this.physics.add.group();

    this.player = new Player(this, VIEW_WIDTH / 2, VIEW_HEIGHT / 2);

    this.muzzle = this.add.particles(0, 0, 'particle', {
      speed: { min: 20, max: 100 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      lifespan: 180,
      quantity: 2,
      emitting: false,
      tint: 0x00ffe1,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.muzzle.setDepth(40);

    // 玩家移动拖影
    this.playerTrail = this.add.particles(0, 0, 'particle', {
      speed: { min: 0, max: 8 },
      lifespan: 380,
      quantity: 1,
      frequency: 42,
      scale: { start: 0.65, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: 0x00e5ff,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.playerTrail.setDepth(15);
    this.playerTrail.startFollow(this.player);
    this.playerTrail.emitting = false;

    // 玩家霓虹光环
    this.playerAura = this.add.image(this.player.x, this.player.y, 'aura')
      .setDepth(13)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: this.playerAura,
      scale: { from: 1, to: 1.12 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    this.edgeVignette = this.drawEdgeVignette();

    this.chapterManager = new ChapterManager(this.chapterConfig, this.buildChapterCallbacks());

    this.registerColliders();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.input.keyboard!.on('keydown-ESC', this.handleEsc);
    window.addEventListener('blur', this.handleWindowBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.onShutdown());

    ui.setBindings({
      onStart: () => this.restartGame(),
      onPause: () => this.togglePause(),
      onResume: () => this.resumeGame(),
      onRestart: () => this.restartGame(),
      onChooseUpgrade: (id) => this.applyUpgrade(id),
      onChapterSelect: () => this.scene.start('MenuScene'),
      onNextChapter: () => this.scene.start('MenuScene'),
    });
    ui.showGame();
    ui.refreshSoundState();
    this.pushHud();

    this.startSpawner();
    this.setupDebug();
  }

  update(time: number, delta: number): void {
    if (this.mode !== 'running') return;

    // 只允许累计 gameplay delta，暂停/升级/结算时不调用本章方法
    const dtMs = Math.min(delta, 50);
    this.chapterManager.update(dtMs);
    this.handleBossSpawnRequest();
    if (this.chapterManager.runState === 'FAILED') {
      this.finishFailure('TIMEOUT');
      return;
    }

    const dt = dtMs / 1000;
    this.hudTimer += dt;

    const moveX = this.readAxisX();
    const moveY = this.readAxisY();
    this.player.move(moveX, moveY);
    this.playerTrail.emitting = moveX !== 0 || moveY !== 0;
    this.playerAura.setPosition(this.player.x, this.player.y);
    this.autoAttack(time);
    this.updateGems();
    if (this.boss) this.boss.update(time);

    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.pushHud();
    }
  }

  // ---------- 章节时间线与 Boss 事件 ----------

  private buildChapterCallbacks(): ChapterCallbacks {
    return {
      onPhaseChange: (phase) => this.handlePhaseChange(phase),
      onBossPrelude: () => {
        ui.showEventBanner('⚠ BOSS 警告：裂隙主宰正在接近', 2600);
        audio.play('levelup');
      },
      onBossCountdown: () => {
        ui.showEventBanner('BOSS 将在 30 秒后登场', 2600);
        audio.play('levelup');
      },
      onBossSpawn: () => {
        this.bossSpawnRequested = true;
      },
    };
  }

  private handlePhaseChange(phase: ChapterPhase): void {
    if (phase === 'BOSS_ACTIVE') {
      this.edgeVignette.setVisible(true);
    } else if (phase === 'COMPLETED' || phase === 'FAILED') {
      this.edgeVignette.setVisible(false);
    }
  }

  private handleBossSpawnRequest(): void {
    if (
      this.bossSpawnRequested &&
      !this.boss &&
      this.mode === 'running' &&
      this.chapterManager.runState === 'RUNNING'
    ) {
      this.spawnBossNow();
    }
  }

  /** 幂等：同一时间最多一只 Boss。 */
  private spawnBossNow(): void {
    if (this.boss || this.mode !== 'running') return;
    this.bossSpawnRequested = false;
    const cfg = this.chapterConfig.bossConfig;
    const boss = new Boss(
      this,
      VIEW_WIDTH / 2,
      96,
      cfg,
      this.player,
      this.chapterConfig.difficulty.bossHpMult,
    );
    this.bossGroup.add(boss);
    this.boss = boss;
    this.trimRegularEnemiesForBoss();
    this.edgeVignette.setVisible(true);
    ui.showEventBanner(cfg.name + ' · 登场！', 2600);
    audio.play('levelup');
    this.pushHud();
  }

  /** Boss 战开始：把普通敌人清到护卫上限，防止数量继续累积。 */
  private trimRegularEnemiesForBoss(): void {
    const cap = this.chapterConfig.spawnSettings.bossActiveMaxEnemies;
    const children = this.enemies.getChildren();
    if (children.length <= cap) return;
    for (let i = cap; i < children.length; i += 1) {
      const enemy = children[i] as Enemy;
      if (enemy.active) enemy.destroy();
    }
  }

  private registerColliders(): void {
    // 子弹命中普通敌人
    this.physics.add.overlap(this.bullets, this.enemies, (bulletObj, enemyObj) => {
      const bullet = bulletObj as Bullet;
      const enemy = enemyObj as Enemy;
      if (!bullet.active || !enemy.active || this.mode !== 'running') return;
      audio.play('hit');
      const killed = enemy.takeDamage(bullet.damage);
      this.burst(enemy.x, enemy.y, enemy.typeConfig.color, 5, 130);
      this.consumeBullet(bullet);
      if (killed) this.killEnemy(enemy);
    }, undefined, this);

    // 子弹命中 Boss
    this.physics.add.overlap(this.bullets, this.bossGroup, (bulletObj, bossObj) => {
      const bullet = bulletObj as Bullet;
      const boss = bossObj as Boss;
      if (!bullet.active || !boss.active || this.mode !== 'running') return;
      audio.play('hit');
      const killed = boss.takeDamage(bullet.damage);
      this.burst(boss.x, boss.y, 0xff2d78, 6, 160);
      this.consumeBullet(bullet);
      if (killed) this.defeatBoss();
    }, undefined, this);

    // 敌人接触玩家
    this.physics.add.overlap(this.player, this.enemies, (_playerObj, enemyObj) => {
      const enemy = enemyObj as Enemy;
      if (!enemy.active || this.mode !== 'running') return;
      const hit = this.player.takeDamage(enemy.contactDamage, this.time.now);
      if (!hit) return;
      this.onPlayerHurt();
    }, undefined, this);

    // Boss 接触玩家（受伤害冷却/无敌帧限制）
    this.physics.add.overlap(this.player, this.bossGroup, (_playerObj, bossObj) => {
      const boss = bossObj as Boss;
      if (!boss.active || this.mode !== 'running') return;
      if (!boss.tryContact(this.time.now)) return;
      const hit = this.player.takeDamage(boss.contactDamage, this.time.now);
      if (!hit) return;
      this.onPlayerHurt();
    }, undefined, this);

    // 玩家拾取经验晶体
    this.physics.add.overlap(this.player, this.gems, (_playerObj, gemObj) => {
      const gem = gemObj as ExperienceGem;
      if (!gem.active || this.mode !== 'running') return;
      const gemValue = gem.value;
      this.player.stats.xp += gemValue;
      gem.destroy();
      this.floatText(this.player.x, this.player.y - 22, '+' + gemValue + ' XP', '#38ff9c');
      this.burst(this.player.x, this.player.y, 0x38ff9c, 6, 110);
      audio.play('gem');
      this.checkLevelUp();
    }, undefined, this);

    this.physics.add.collider(this.enemies, this.enemies);
  }

  private consumeBullet(bullet: Bullet): void {
    if (bullet.pierce <= 0) bullet.destroy();
    else bullet.pierce -= 1;
  }

  private onPlayerHurt(): void {
    this.burst(this.player.x, this.player.y, 0xff2d78, 10, 180);
    this.cameras.main.shake(130, 0.004);
    ui.flashHurt();
    audio.play('hurt');
    if (this.player.stats.hp <= 0) this.finishFailure('PLAYER_DEAD');
  }

  // ---------- 输入与移动 ----------

  private readAxisX(): number {
    const left = this.cursors.left.isDown || this.keyA.isDown;
    const right = this.cursors.right.isDown || this.keyD.isDown;
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  private readAxisY(): number {
    const up = this.cursors.up.isDown || this.keyW.isDown;
    const down = this.cursors.down.isDown || this.keyS.isDown;
    return (down ? 1 : 0) - (up ? 1 : 0);
  }

  // ---------- 自动攻击 ----------

  private autoAttack(time: number): void {
    if (time < this.nextFireAt) return;
    const stats = this.player.stats;
    const target = this.findNearestTarget(stats.attackRange);
    if (!target) return;

    const baseAngle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      target.x,
      target.y,
    );
    const count = Math.max(1, Math.floor(stats.bulletCount));
    const spread = count > 1 ? 0.16 : 0;
    const start = baseAngle - (spread * (count - 1)) / 2;
    for (let i = 0; i < count; i += 1) {
      this.fireBullet(start + spread * i, stats);
    }
    this.nextFireAt = time + 1000 / stats.fireRate;
    this.muzzle.emitParticleAt(
      this.player.x + Math.cos(baseAngle) * 24,
      this.player.y + Math.sin(baseAngle) * 24,
      2,
    );
    audio.play('shoot');
  }

  private findNearestTarget(range: number): Targetable | null {
    let nearest: Targetable | null = null;
    let best = range;
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist <= best) {
        best = dist;
        nearest = enemy;
      }
    }
    if (this.boss && this.boss.active) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);
      if (dist <= best) {
        best = dist;
        nearest = this.boss;
      }
    }
    return nearest;
  }

  private fireBullet(angle: number, stats: Player['stats']): void {
    const sx = this.player.x + Math.cos(angle) * 22;
    const sy = this.player.y + Math.sin(angle) * 22;
    const bullet = this.bullets.get(sx, sy, 'bullet') as Bullet | null;
    if (!bullet) return;
    bullet.launch(sx, sy, angle, stats.damage, stats.pierce, stats.bulletSpeed);
  }

  // ---------- 敌人生成与难度 ----------

  private startSpawner(): void {
    for (let i = 0; i < this.chapterConfig.spawnSettings.initialEnemies; i += 1) {
      this.spawnEnemy();
    }
    this.scheduleNextSpawn();
  }

  private scheduleNextSpawn(): void {
    if (this.mode !== 'running') return;
    this.spawnEvent = this.time.delayedCall(this.nextSpawnIntervalMs(), () => {
      if (this.mode !== 'running') return;
      this.spawnEnemy();
      this.scheduleNextSpawn();
    });
  }

  private nextSpawnIntervalMs(): number {
    const s = this.chapterConfig.spawnSettings;
    const elapsedSec = this.chapterManager.elapsedMs / 1000;
    let interval = Math.max(
      s.minSpawnMs,
      s.baseSpawnMs - elapsedSec * s.spawnDecayPerSec,
    );
    interval = interval / Math.max(0.5, this.chapterConfig.difficulty.spawnDensityMult);
    if (this.chapterManager.phase === 'BOSS_ACTIVE') {
      interval = Math.max(
        s.minSpawnMs,
        Math.min(interval * s.bossActiveSpawnMultiplier, s.bossEscortIntervalMs),
      );
    }
    return Math.round(interval);
  }

  private spawnEnemy(): void {
    const s = this.chapterConfig.spawnSettings;
    const limit = this.chapterManager.phase === 'BOSS_ACTIVE'
      ? s.bossActiveMaxEnemies
      : s.maxEnemies;
    if (this.enemies.countActive(true) >= limit) return;

    const type = this.pickEnemyType();
    const pos = this.randomEdgePosition();
    const elapsedSec = this.chapterManager.elapsedMs / 1000;
    const hpMult =
      (1 + elapsedSec * DIFFICULTY.hpGrowthPerSec) * this.chapterConfig.difficulty.enemyHpMult;
    const speedMult = Math.min(
      DIFFICULTY.speedCap,
      1 + elapsedSec * DIFFICULTY.speedGrowthPerSec,
    ) * this.chapterConfig.difficulty.enemySpeedMult;

    const enemy = new Enemy(this, pos.x, pos.y, type, hpMult, speedMult);
    this.enemies.add(enemy);
    enemy.setTarget(this.player);

    if (this.shouldSpawnElite()) {
      enemy.upgradeToElite(this.chapterConfig.eliteSettings);
    }
  }

  private shouldSpawnElite(): boolean {
    const e = this.chapterConfig.eliteSettings;
    if (this.chapterManager.elapsedMs < e.unlockAtMs) return false;
    if (this.chapterManager.phase === 'BOSS_ACTIVE') return false;
    const elapsedSec = this.chapterManager.elapsedMs / 1000;
    const ramp = Math.max(0, elapsedSec - e.unlockAtMs / 1000) * 0.004;
    let chance = (e.chance + ramp) * this.chapterConfig.difficulty.eliteMult;
    chance = Math.min(e.maxChance, chance);
    return Math.random() < chance;
  }

  private pickEnemyType(): EnemyTypeConfig {
    const elapsedSec = this.chapterManager.elapsedMs / 1000;
    const unlocked = ENEMY_TYPES.filter((t) => elapsedSec >= t.unlockAt);
    let total = 0;
    for (const t of unlocked) total += this.weightFor(t, elapsedSec);
    if (total <= 0) return ENEMY_TYPES[0];
    let roll = Math.random() * total;
    for (const t of unlocked) {
      roll -= this.weightFor(t, elapsedSec);
      if (roll <= 0) return t;
    }
    return unlocked[unlocked.length - 1] ?? ENEMY_TYPES[0];
  }

  private weightFor(type: EnemyTypeConfig, elapsedSec: number): number {
    return type.weight + Math.max(0, elapsedSec - type.unlockAt) * type.rampWeight;
  }

  private randomEdgePosition(): Phaser.Math.Vector2 {
    const side = Phaser.Math.Between(0, 3);
    const pad = 26;
    switch (side) {
      case 0:
        return new Phaser.Math.Vector2(-pad, Phaser.Math.Between(0, VIEW_HEIGHT));
      case 1:
        return new Phaser.Math.Vector2(VIEW_WIDTH + pad, Phaser.Math.Between(0, VIEW_HEIGHT));
      case 2:
        return new Phaser.Math.Vector2(Phaser.Math.Between(0, VIEW_WIDTH), -pad);
      default:
        return new Phaser.Math.Vector2(Phaser.Math.Between(0, VIEW_WIDTH), VIEW_HEIGHT + pad);
    }
  }

  // ---------- 战斗结算 ----------

  private killEnemy(enemy: Enemy): void {
    this.kills += 1;
    this.totalScore += enemy.scoreValue;
    this.floatText(enemy.x, enemy.y - 16, '+' + enemy.scoreValue, '#ffd27c');
    this.burst(enemy.x, enemy.y, enemy.typeConfig.color, 12, 230);
    this.spawnAfterimage(enemy.x, enemy.y, enemy.texture.key, enemy.typeConfig.color, enemy.scaleX);
    if (Math.random() < DIFFICULTY.gemDropChance) {
      this.dropGem(enemy.x, enemy.y, enemy.xpValue);
    }
    enemy.destroy();
    audio.play('kill');
  }

  private dropGem(x: number, y: number, value: number): void {
    const gem = new ExperienceGem(this, x, y, value);
    gem.setVelocity(Phaser.Math.Between(-30, 30), Phaser.Math.Between(-30, 30));
    this.gems.add(gem);
  }

  /** 死亡残影：短暂残留的原型投影，淡出后销毁。 */
  private spawnAfterimage(x: number, y: number, texture: string, tint: number, scale: number): void {
    const ghost = this.add.image(x, y, texture);
    ghost.setDepth(18);
    ghost.setTint(tint);
    ghost.setAlpha(0.72);
    ghost.setScale(scale * 1.08);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: scale * 1.3,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => ghost.destroy(),
    });
  }

  private updateGems(): void {
    const stats = this.player.stats;
    for (const child of this.gems.getChildren()) {
      const gem = child as ExperienceGem;
      if (!gem.active) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, gem.x, gem.y);
      if (dist <= stats.pickupRadius) {
        const angle = Phaser.Math.Angle.Between(gem.x, gem.y, this.player.x, this.player.y);
        const speed = Phaser.Math.Clamp((stats.pickupRadius - dist) * 8 + 140, 140, 540);
        gem.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      } else {
        gem.setVelocity(0, 0);
      }
    }
  }

  // ---------- Boss 胜利 / 失败 ----------

  /** Boss 死亡：幂等、立即通关，且优先于同帧超时。 */
  private defeatBoss(): void {
    if (!this.boss || this.mode !== 'running') return;
    this.chapterManager.markBossDead();
    this.kills += 1;
    this.totalScore += this.chapterConfig.bossConfig.score;
    const boss = this.boss;
    this.boss = null;
    this.floatText(boss.x, boss.y - 24, '+' + this.chapterConfig.bossConfig.score + ' BOSS', '#ff7ba9');
    this.cameras.main.shake(320, 0.008);
    this.spawnAfterimage(boss.x, boss.y, boss.texture.key, 0xff2d78, boss.scaleX);
    boss.destroyBoss();
    ui.hideBossBar();
    this.edgeVignette.setVisible(false);
    this.finishVictory();
  }

  private finishVictory(): void {
    if (this.mode === 'victory' || this.mode === 'failed') return;
    this.mode = 'victory';
    this.stopWorldForResult();

    const result = this.chapterManager.markVictory(
      this.totalScore,
      this.kills,
      this.player.stats.level,
    );
    recordChapterResult(this.chapterId, result);

    const nextNum = chapterNumber(this.chapterId) + 1;
    const nextChapterId = nextNum <= CHAPTERS.length ? chapterIdForNumber(nextNum) : null;
    const view: ResultViewData = {
      chapterId: this.chapterId,
      chapterName: this.chapterConfig.name,
      victory: true,
      failureReason: null,
      survivalTimeMs: result.survivalTimeMs,
      bossRemainingMs: result.bossRemainingMs,
      killCount: result.killCount,
      playerLevel: result.playerLevel,
      baseScore: result.score - result.timeBonus,
      timeBonus: result.timeBonus,
      finalScore: result.score,
      grade: result.grade,
      nextChapterUnlocked: nextChapterId !== null,
      nextChapterId,
    };
    ui.showResult(view);
    audio.play('levelup');
  }

  private finishFailure(reason: FailureReason): void {
    if (this.mode === 'victory' || this.mode === 'failed') return;
    this.mode = 'failed';
    this.stopWorldForResult();
    this.edgeVignette.setVisible(false);
    ui.hideBossBar();

    const result = this.chapterManager.markFailure(reason);
    const filled = this.chapterManager.fillFailureResult(
      this.totalScore,
      this.kills,
      this.player.stats.level,
    ) ?? result;
    recordChapterResult(this.chapterId, filled);

    const view: ResultViewData = {
      chapterId: this.chapterId,
      chapterName: this.chapterConfig.name,
      victory: false,
      failureReason: reason,
      survivalTimeMs: filled.survivalTimeMs,
      bossRemainingMs: 0,
      killCount: filled.killCount,
      playerLevel: filled.playerLevel,
      baseScore: filled.score,
      timeBonus: 0,
      finalScore: filled.score,
      grade: null,
      nextChapterUnlocked: false,
      nextChapterId: null,
    };
    ui.showResult(view);
    audio.play('gameover');
  }

  private stopWorldForResult(): void {
    this.physics.world.pause();
    this.time.timeScale = 0;
    if (this.spawnEvent) this.spawnEvent.paused = true;
    this.player.setVelocity(0, 0);
  }

  // ---------- 经验与升级 ----------

  private checkLevelUp(): void {
    const stats = this.player.stats;
    let leveled = false;
    while (stats.xp >= stats.xpToNext) {
      stats.xp -= stats.xpToNext;
      stats.level += 1;
      stats.xpToNext = xpToNext(stats.level);
      leveled = true;
    }
    if (leveled) this.startLevelUp();
  }

  private startLevelUp(): void {
    const options = nextUpgradeSet(this.upgradeLevels, 3);
    if (options.length === 0) {
      audio.play('levelup');
      return;
    }
    this.floatText(this.player.x, this.player.y - 28, 'LEVEL UP!', '#00f0ff');
    this.mode = 'upgrading';
    this.physics.world.pause();
    this.time.timeScale = 0;
    if (this.spawnEvent) this.spawnEvent.paused = true;
    this.player.setVelocity(0, 0);

    const cards: UpgradeCardData[] = options.map((def) => {
      const level = this.upgradeLevels.get(def.id) ?? 0;
      return {
        id: def.id,
        name: def.name,
        desc: def.desc,
        icon: def.icon,
        level,
        preview: def.preview(this.player.stats),
      };
    });
    ui.showUpgrade(cards);
    audio.play('levelup');
  }

  private applyUpgrade(id: UpgradeId): void {
    const def = getUpgradeDef(id);
    if (!def || this.mode !== 'upgrading') return;
    def.apply(this.player.stats);
    this.upgradeLevels.set(id, (this.upgradeLevels.get(id) ?? 0) + 1);

    ui.hideUpgrade();
    this.mode = 'running';
    this.physics.world.resume();
    this.time.timeScale = 1;
    if (this.spawnEvent) this.spawnEvent.paused = false;
    audio.play('click');
    this.burst(this.player.x, this.player.y, 0x00f0ff, 18, 240);

    if (this.player.stats.xp >= this.player.stats.xpToNext) {
      this.startLevelUp();
    }
  }

  // ---------- 暂停 / 继续 ----------

  private togglePause(): void {
    if (this.mode === 'running') this.pauseGame();
    else if (this.mode === 'paused') this.resumeGame();
  }

  private pauseGame(): void {
    this.mode = 'paused';
    this.physics.world.pause();
    this.time.timeScale = 0;
    if (this.spawnEvent) this.spawnEvent.paused = true;
    this.player.setVelocity(0, 0);
    ui.showPause();
    audio.play('click');
  }

  private resumeGame(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'running';
    this.physics.world.resume();
    this.time.timeScale = 1;
    if (this.spawnEvent) this.spawnEvent.paused = false;
    ui.hidePause();
    audio.play('click');
  }

  private restartGame(): void {
    this.scene.restart({ chapterId: this.chapterId });
  }

  // ---------- HUD / 特效 / 背景 ----------

  private pushHud(): void {
    const stats = this.player.stats;
    const cm = this.chapterManager;
    const phaseLabel = cm.phase === 'BOSS_COUNTDOWN'
      ? `Boss 倒计时 ${Math.ceil(cm.bossCountdownRemainingMs / 1000)}s`
      : cm.phaseLabel();
    const hud: HudViewData = {
      hp: stats.hp,
      maxHp: stats.maxHp,
      xp: stats.xp,
      xpToNext: stats.xpToNext,
      level: stats.level,
      time: cm.elapsedMs / 1000,
      score: this.totalScore,
      kills: this.kills,
      chapterLabel: 'Ch' + chapterNumber(this.chapterId),
      elapsedMs: cm.elapsedMs,
      totalMs: this.chapterConfig.durationMs,
      phase: cm.phase,
      phaseLabel,
      bossName: this.boss ? this.chapterConfig.bossConfig.name : null,
      bossHp: this.boss?.hp ?? 0,
      bossMaxHp: this.boss?.maxHp ?? 1,
    };
    ui.updateHUD(hud);
  }

  /** 战斗飘字：得分 / XP / 升级提示。 */
  private floatText(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color,
      stroke: '#05060f',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(70);
    this.tweens.add({
      targets: label,
      y: y - 34,
      alpha: 0,
      duration: 720,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private burst(x: number, y: number, color: number, count: number, speed: number): void {
    const emitter = this.add.particles(x, y, 'particle', {
      speed: { min: 40, max: speed },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      lifespan: 430,
      quantity: count,
      emitting: false,
      tint: color,
      blendMode: Phaser.BlendModes.ADD,
    });
    emitter.setDepth(45);
    emitter.explode(count);
    this.time.delayedCall(650, () => {
      if (emitter.active) emitter.destroy();
    });
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
    this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: VIEW_WIDTH },
      y: { min: 0, max: VIEW_HEIGHT },
      speedY: { min: 10, max: 34 },
      speedX: { min: -5, max: 5 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.25, end: 0 },
      lifespan: 5200,
      quantity: 2,
      frequency: 260,
      tint: [0x00f0ff, 0x7c5cff],
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(-50);
  }

  /** Boss 战期间屏幕边缘轻量压暗（不逐帧滤镜）。 */
  private drawEdgeVignette(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.setDepth(59);
    g.fillStyle(0x000000, 0.26);
    g.fillRect(0, 0, VIEW_WIDTH, 42);
    g.fillRect(0, VIEW_HEIGHT - 42, VIEW_WIDTH, 42);
    g.fillRect(0, 0, 42, VIEW_HEIGHT);
    g.fillRect(VIEW_WIDTH - 42, 0, 42, VIEW_HEIGHT);
    g.setVisible(false);
    return g;
  }

  // ---------- 开发调试接口 ----------

  private setupDebug(): void {
    if (!import.meta.env.DEV) return;
    const api: NeonDebugApi = {
      getSnapshot: () => this.debugSnapshot(),
      setElapsedMs: (ms) => {
        if (this.mode !== 'running') return;
        this.chapterManager.setElapsed(ms);
        this.handleBossSpawnRequest();
        this.handleOutcomeAfterDebug();
        this.pushHud();
      },
      advanceTimeMs: (ms) => {
        if (this.mode !== 'running') return;
        this.chapterManager.update(ms);
        this.handleBossSpawnRequest();
        this.handleOutcomeAfterDebug();
        this.pushHud();
      },
      spawnBoss: () => this.spawnBossNow(),
      setBossHp: (value) => {
        if (this.boss) {
          this.boss.hp = Math.max(0, Math.min(this.boss.maxHp, value));
          this.pushHud();
        }
      },
      defeatBoss: () => this.defeatBoss(),
      killPlayer: () => this.finishFailure('PLAYER_DEAD'),
      restartChapter: () => this.restartGame(),
      clearSave: () => clearSaveData(),
      pause: () => this.pauseGame(),
      resume: () => this.resumeGame(),
      grantXp: (amount) => {
        if (this.mode !== 'running') return;
        this.player.stats.xp += amount;
        this.checkLevelUp();
        this.pushHud();
      },
      setPlayerHp: (value) => {
        this.player.stats.hp = Math.max(0, Math.min(this.player.stats.maxHp, value));
        this.pushHud();
      },
      godMode: () => {
        this.player.invulnerableUntil = Number.MAX_SAFE_INTEGER;
      },
    };
    this.debugApi = api;
    window.__NEON_DEBUG__ = api;
  }

  private handleOutcomeAfterDebug(): void {
    if (this.mode !== 'running') return;
    if (this.chapterManager.runState === 'FAILED') {
      this.finishFailure('TIMEOUT');
    }
  }

  private debugSnapshot(): DebugSnapshot {
    const save = loadSave();
    return {
      runState: this.debugRunState(),
      chapterId: this.chapterId,
      chapterPhase: this.chapterManager.phase,
      elapsedMs: this.chapterManager.elapsedMs,
      remainingMs: this.chapterManager.remainingMs,
      bossSpawned: this.chapterManager.bossSpawned,
      bossAlive: this.boss !== null && this.boss.active,
      bossHp: this.boss?.hp ?? 0,
      bossMaxHp: this.boss?.maxHp ?? 0,
      enemyCount: this.enemies.countActive(true),
      playerHp: this.player.stats.hp,
      result: this.chapterManager.result,
      highestUnlockedChapter: save.highestUnlockedChapter,
    };
  }

  private debugRunState(): RunState {
    switch (this.mode) {
      case 'running': return 'RUNNING';
      case 'paused': return 'PAUSED';
      case 'upgrading': return 'UPGRADING';
      case 'victory': return 'VICTORY';
      case 'failed': return 'FAILED';
    }
  }

  // ---------- 清理 ----------

  private onShutdown(): void {
    this.input.keyboard?.off('keydown-ESC', this.handleEsc);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.spawnEvent = null;
    this.boss = null;
    this.teardownDebug();
  }

  private teardownDebug(): void {
    if (this.debugApi) {
      if (window.__NEON_DEBUG__ === this.debugApi) {
        window.__NEON_DEBUG__ = undefined;
      }
      this.debugApi = null;
    }
  }
}
