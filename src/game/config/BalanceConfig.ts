/** 玩家基础数值与成长曲线。 */
export const PLAYER_BASE = {
  maxHp: 130,
  moveSpeed: 235,
  damage: 15,
  fireRate: 2.4,
  bulletSpeed: 540,
  attackRange: 380,
  bulletCount: 1,
  pierce: 0,
  pickupRadius: 90,
  invulnerableTime: 800,
} as const;

export type EnemyTypeId = 'normal' | 'fast' | 'heavy';

export interface EnemyTypeConfig {
  id: EnemyTypeId;
  name: string;
  textureKey: string;
  size: number;
  hp: number;
  speed: number;
  damage: number;
  score: number;
  xp: number;
  color: number;
  /** 多少秒后开始解锁 */
  unlockAt: number;
  /** 解锁后的基础权重 */
  weight: number;
  /** 解锁后额外权重随时间爬升速度（每秒） */
  rampWeight: number;
}

/** 三种敌人：普通 / 快速 / 重型。 */
export const ENEMY_TYPES: EnemyTypeConfig[] = [
  {
    id: 'normal',
    name: '普通敌人',
    textureKey: 'enemy_normal',
    size: 32,
    hp: 24,
    speed: 78,
    damage: 7,
    score: 10,
    xp: 5,
    color: 0xff5d7e,
    unlockAt: 0,
    weight: 1,
    rampWeight: 0,
  },
  {
    id: 'fast',
    name: '快速敌人',
    textureKey: 'enemy_fast',
    size: 24,
    hp: 14,
    speed: 140,
    damage: 6,
    score: 15,
    xp: 8,
    color: 0xffc94d,
    unlockAt: 30,
    weight: 0.35,
    rampWeight: 0.0015,
  },
  {
    id: 'heavy',
    name: '重型敌人',
    textureKey: 'enemy_heavy',
    size: 48,
    hp: 85,
    speed: 44,
    damage: 14,
    score: 30,
    xp: 15,
    color: 0xb15dff,
    unlockAt: 90,
    weight: 0.08,
    rampWeight: 0.001,
  },
];

/** 难度曲线统一配置，所有随时间变化的数值都来自这里。 */
export const DIFFICULTY = {
  /** 初始生成间隔（毫秒） */
  spawnBaseMs: 1400,
  /** 最短生成间隔（毫秒） */
  spawnMinMs: 400,
  /** 每秒减少的生成间隔（毫秒） */
  spawnDecayPerSec: 8,
  /** 场上敌人数量上限 */
  maxEnemies: 80,
  /** 敌人生命每秒成长倍数 */
  hpGrowthPerSec: 0.010,
  /** 敌人速度每秒成长倍数 */
  speedGrowthPerSec: 0.004,
  /** 敌人速度成长上限倍数 */
  speedCap: 1.4,
  /** 掉落经验晶体的概率 */
  gemDropChance: 0.9,
  /** 初始敌人数量（开局直接刷出） */
  initialEnemies: 3,
} as const;

/** 经验曲线：降低前中期门槛，升级更顺滑。 */
export function xpToNext(level: number): number {
  return Math.round(45 + (level - 1) * 32 + Math.pow(level - 1, 2) * 3);
}
