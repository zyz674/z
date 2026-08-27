import type { ChapterConfig, ChapterId } from '../types/Chapter';

/**
 * Ch1 关底 Boss 数值依据（降低难度后）：
 * - 普通敌人：HP 24 / 速度 78 / 接触伤害 7。
 * - Boss：HP 1500；速度 43 ≈ 普通敌人 x0.55。
 * - 接触伤害 21 = 普通敌人 x3。
 * - 玩家 14:00 合理 DPS 约 55-70 → 约 21-27 秒击杀；
 *   较弱构筑 DPS 约 40 → 约 38 秒；较强构筑 DPS 100+ → 约 15 秒。
 */
export const CHAPTER_1: ChapterConfig = {
  chapterId: 'ch1',
  name: '霓虹口岸',
  playable: true,
  durationMs: 15 * 60 * 1000, // 15:00
  phaseBoundariesMs: [0, 2 * 60 * 1000, 5 * 60 * 1000, 8 * 60 * 1000, 12 * 60 * 1000],
  bossPreludeAtMs: 13 * 60 * 1000, // 13:00
  bossCountdownAtMs: 13 * 60 * 1000 + 30 * 1000, // 13:30
  bossSpawnAtMs: 14 * 60 * 1000, // 14:00
  difficulty: {
    enemyHpMult: 1,
    enemySpeedMult: 1,
    eliteMult: 1,
    bossHpMult: 1,
    spawnDensityMult: 1,
  },
  spawnSettings: {
    baseSpawnMs: 1100,
    minSpawnMs: 300,
    spawnDecayPerSec: 10,
    maxEnemies: 120,
    initialEnemies: 4,
    bossActiveSpawnMultiplier: 5,
    bossActiveMaxEnemies: 12,
    bossEscortIntervalMs: 4500,
  },
  eliteSettings: {
    unlockAtMs: 6 * 60 * 1000,
    chance: 0.03,
    maxChance: 0.08,
    hpMult: 2.4,
    speedMult: 0.9,
    damageMult: 1.3,
    scoreMult: 5,
    xpMult: 5,
    scale: 1.35,
  },
  bossConfig: {
    id: 'boss_ch1',
    name: '裂隙主宰·奈落',
    textureKey: 'boss_ch1',
    maxHp: 1500,
    speed: 43,
    contactDamage: 21,
    contactCooldownMs: 1100,
    radius: 40,
    score: 500,
    xp: 80,
    dashIntervalMs: 8000,
    dashWarningMs: 1200,
    dashSpeedMult: 2.8,
    dashDurationMs: 500,
  },
  gradeThresholds: {
    S: 30 * 1000,
    A: 10 * 1000,
  },
};

/** Ch2 / Ch3 占位配置：保留数据结构，本轮不可完整游玩。 */
export const CHAPTER_2: ChapterConfig = {
  chapterId: 'ch2',
  name: '废弃数据港',
  playable: false,
  durationMs: 15 * 60 * 1000,
  phaseBoundariesMs: [0, 2 * 60 * 1000, 5 * 60 * 1000, 8 * 60 * 1000, 12 * 60 * 1000],
  bossPreludeAtMs: 13 * 60 * 1000,
  bossCountdownAtMs: 13 * 60 * 1000 + 30 * 1000,
  bossSpawnAtMs: 14 * 60 * 1000,
  difficulty: {
    enemyHpMult: 1.25,
    enemySpeedMult: 1.1,
    eliteMult: 1.2,
    bossHpMult: 1.15,
    spawnDensityMult: 1.1,
  },
  spawnSettings: { ...CHAPTER_1.spawnSettings },
  eliteSettings: { ...CHAPTER_1.eliteSettings },
  bossConfig: { ...CHAPTER_1.bossConfig, name: '占位 Boss · Ch2' },
  gradeThresholds: { ...CHAPTER_1.gradeThresholds },
};

export const CHAPTER_3: ChapterConfig = {
  chapterId: 'ch3',
  name: '深渊中继站',
  playable: false,
  durationMs: 15 * 60 * 1000,
  phaseBoundariesMs: [0, 2 * 60 * 1000, 5 * 60 * 1000, 8 * 60 * 1000, 12 * 60 * 1000],
  bossPreludeAtMs: 13 * 60 * 1000,
  bossCountdownAtMs: 13 * 60 * 1000 + 30 * 1000,
  bossSpawnAtMs: 14 * 60 * 1000,
  difficulty: {
    enemyHpMult: 1.5,
    enemySpeedMult: 1.2,
    eliteMult: 1.4,
    bossHpMult: 1.3,
    spawnDensityMult: 1.2,
  },
  spawnSettings: { ...CHAPTER_1.spawnSettings },
  eliteSettings: { ...CHAPTER_1.eliteSettings },
  bossConfig: { ...CHAPTER_1.bossConfig, name: '占位 Boss · Ch3' },
  gradeThresholds: { ...CHAPTER_1.gradeThresholds },
};

export const CHAPTERS: ChapterConfig[] = [CHAPTER_1, CHAPTER_2, CHAPTER_3];

export function getChapterConfig(chapterId: ChapterId): ChapterConfig {
  const config = CHAPTERS.find((c) => c.chapterId === chapterId);
  if (!config) return CHAPTER_1;
  return config;
}

/** 章节数字顺序 1-based。 */
export function chapterNumber(chapterId: ChapterId): number {
  return CHAPTERS.findIndex((c) => c.chapterId === chapterId) + 1;
}

export function chapterIdForNumber(n: number): ChapterId {
  const index = Math.min(CHAPTERS.length - 1, Math.max(0, n - 1));
  return CHAPTERS[index].chapterId;
}
