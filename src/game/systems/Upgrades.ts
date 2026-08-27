import type { PlayerStats, UpgradeId } from '../types';

/** 强化的数据驱动定义：所有升级都通过数组描述，容易扩展。 */
export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  icon: string;
  maxLevel: number;
  /** 展示强化后的具体数值变化（基于当前属性）。 */
  preview: (stats: Readonly<PlayerStats>) => string;
  apply: (stats: PlayerStats) => void;
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'damage',
    name: '火力强化',
    desc: '子弹伤害永久提升',
    icon: '💥',
    maxLevel: 6,
    preview: (s) => `子弹伤害 ${s.damage} → ${s.damage + 4}`,
    apply: (s) => { s.damage += 4; },
  },
  {
    id: 'fireRate',
    name: '速射核心',
    desc: '提高每秒攻击次数',
    icon: '⚡',
    maxLevel: 6,
    preview: (s) => `攻击速度 ${s.fireRate.toFixed(2)}/秒 → ${(s.fireRate + 0.25).toFixed(2)}/秒`,
    apply: (s) => { s.fireRate += 0.25; },
  },
  {
    id: 'moveSpeed',
    name: '疾行模块',
    desc: '提高移动速度',
    icon: '👟',
    maxLevel: 5,
    preview: (s) => `移动速度 ${s.moveSpeed} → ${s.moveSpeed + 18}`,
    apply: (s) => { s.moveSpeed += 18; },
  },
  {
    id: 'maxHp',
    name: '强化护甲',
    desc: '增加最大生命并恢复 20 点',
    icon: '🛡️',
    maxLevel: 5,
    preview: (s) => `最大生命 ${s.maxHp} → ${s.maxHp + 20}，并回复 20 点`,
    apply: (s) => {
      s.maxHp += 20;
      s.hp = Math.min(s.maxHp, s.hp + 20);
    },
  },
  {
    id: 'bulletSpeed',
    name: '高速弹头',
    desc: '提高子弹飞行速度',
    icon: '🚀',
    maxLevel: 5,
    preview: (s) => `子弹速度 ${s.bulletSpeed} → ${s.bulletSpeed + 70}`,
    apply: (s) => { s.bulletSpeed += 70; },
  },
  {
    id: 'bulletCount',
    name: '多重射击',
    desc: '每次攻击额外发射一枚子弹',
    icon: '🔱',
    maxLevel: 3,
    preview: (s) => `子弹数量 ${s.bulletCount} → ${s.bulletCount + 1}`,
    apply: (s) => { s.bulletCount += 1; },
  },
  {
    id: 'pickupRadius',
    name: '引力场',
    desc: '扩大经验晶体吸取范围',
    icon: '🧲',
    maxLevel: 5,
    preview: (s) => `吸取范围 ${s.pickupRadius} → ${s.pickupRadius + 30}`,
    apply: (s) => { s.pickupRadius += 30; },
  },
  {
    id: 'attackRange',
    name: '索敌雷达',
    desc: '扩大自动索敌范围',
    icon: '📡',
    maxLevel: 5,
    preview: (s) => `攻击范围 ${s.attackRange} → ${s.attackRange + 45}`,
    apply: (s) => { s.attackRange += 45; },
  },
  {
    id: 'pierce',
    name: '穿透弹头',
    desc: '子弹额外穿透一个敌人',
    icon: '🎯',
    maxLevel: 3,
    preview: (s) => `穿透 ${s.pierce} → ${s.pierce + 1} 个敌人`,
    apply: (s) => { s.pierce += 1; },
  },
  {
    id: 'heal',
    name: '紧急修复',
    desc: '立即恢复 35 点生命',
    icon: '💚',
    maxLevel: 2,
    preview: (s) => `恢复 35 点生命（${s.hp} → ${Math.min(s.maxHp, s.hp + 35)}）`,
    apply: (s) => { s.hp = Math.min(s.maxHp, s.hp + 35); },
  },
];

/** 随机挑选互不重复的强化选项。 */
export function nextUpgradeSet(
  levels: ReadonlyMap<UpgradeId, number>,
  count = 3,
): UpgradeDef[] {
  const available = UPGRADE_DEFS.filter((def) => (levels.get(def.id) ?? 0) < def.maxLevel);
  const shuffled = available.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, count);
}

export function getUpgradeDef(id: UpgradeId): UpgradeDef | undefined {
  return UPGRADE_DEFS.find((def) => def.id === id);
}
