/** 玩家当前成长数值（向上/向下兼容的核心数据）。 */
export interface PlayerStats {
  maxHp: number;
  hp: number;
  moveSpeed: number;
  damage: number;
  /** 每秒攻击次数 */
  fireRate: number;
  bulletSpeed: number;
  attackRange: number;
  /** 一次齐射发射的子弹数 */
  bulletCount: number;
  /** 额外穿透次数（0 表示命中后消失） */
  pierce: number;
  pickupRadius: number;
  xp: number;
  level: number;
  xpToNext: number;
}

export type UpgradeId =
  | 'damage'
  | 'fireRate'
  | 'moveSpeed'
  | 'maxHp'
  | 'bulletSpeed'
  | 'bulletCount'
  | 'pickupRadius'
  | 'attackRange'
  | 'pierce'
  | 'heal';

export interface UpgradeCardData {
  id: UpgradeId;
  name: string;
  desc: string;
  icon: string;
  /** 强化当前等级 */
  level: number;
  /** 强化后效果预览，例如 "子弹伤害 14 → 18" */
  preview: string;
}

export interface HUDData {
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  level: number;
  time: number;
  score: number;
  kills: number;
}

export interface GameOverData {
  time: number;
  kills: number;
  level: number;
  score: number;
  highScore: number;
}
