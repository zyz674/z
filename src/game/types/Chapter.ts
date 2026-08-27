/** 章节制 + 关底 Boss：章节数据模型（全部时间单位为毫秒）。 */

export type ChapterId = 'ch1' | 'ch2' | 'ch3';

export type ChapterPhase =
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'BOSS_PRELUDE'
  | 'BOSS_COUNTDOWN'
  | 'BOSS_ACTIVE'
  | 'COMPLETED'
  | 'FAILED';

export type RunState =
  | 'RUNNING'
  | 'PAUSED'
  | 'UPGRADING'
  | 'VICTORY'
  | 'FAILED';

export type FailureReason = 'PLAYER_DEAD' | 'TIMEOUT';

export type Grade = 'S' | 'A' | 'B';
export type GradeKey = Exclude<Grade, 'B'>;

export interface ChapterDifficulty {
  /** 敌人生命倍率（随章节较明显增长） */
  enemyHpMult: number;
  /** 敌人速度倍率（只允许小幅增长） */
  enemySpeedMult: number;
  /** 精英出现倍率（有上限） */
  eliteMult: number;
  /** Boss 生命独立倍率 */
  bossHpMult: number;
  /** 生成密度倍率 */
  spawnDensityMult: number;
}

export interface ChapterSpawnSettings {
  /** 常规阶段初始生成间隔（毫秒） */
  baseSpawnMs: number;
  /** 生成间隔硬下限（毫秒） */
  minSpawnMs: number;
  /** 每秒生成间隔衰减（毫秒/秒） */
  spawnDecayPerSec: number;
  /** 常规敌人数量硬上限 */
  maxEnemies: number;
  /** 开局预刷敌人数量 */
  initialEnemies: number;
  /** Boss 战期间常规生成间隔倍率（>1 表示降频） */
  bossActiveSpawnMultiplier: number;
  /** Boss 战期间常规护卫敌人数量上限 */
  bossActiveMaxEnemies: number;
  /** Boss 战护卫生成间隔（毫秒） */
  bossEscortIntervalMs: number;
}

export interface ChapterEliteSettings {
  unlockAtMs: number;
  chance: number;
  maxChance: number;
  hpMult: number;
  speedMult: number;
  damageMult: number;
  scoreMult: number;
  xpMult: number;
  scale: number;
}

export interface BossConfig {
  id: string;
  name: string;
  textureKey: string;
  maxHp: number;
  /** 追踪速度（像素/秒） */
  speed: number;
  /** 接触伤害 */
  contactDamage: number;
  /** 接触伤害冷却（毫秒） */
  contactCooldownMs: number;
  radius: number;
  score: number;
  xp: number;
  /** 冲刺攻击间隔（毫秒，0 表示禁用） */
  dashIntervalMs: number;
  /** 冲刺前预警时长（毫秒） */
  dashWarningMs: number;
  /** 冲刺速度倍率 */
  dashSpeedMult: number;
  /** 冲刺持续时长（毫秒） */
  dashDurationMs: number;
}

export interface GradeThresholds {
  /** 击败 Boss 时剩余时间 >= S 阈值 */
  S: number;
  /** 击败 Boss 时剩余时间 >= A 阈值（<S） */
  A: number;
}

export interface ChapterConfig {
  chapterId: ChapterId;
  name: string;
  /** 是否可完整游玩（Ch2/Ch3 本轮占位） */
  playable: boolean;
  durationMs: number;
  /** P1-P5 各阶段起始时间（毫秒），长度为 5 */
  phaseBoundariesMs: number[];
  bossPreludeAtMs: number;
  bossCountdownAtMs: number;
  bossSpawnAtMs: number;
  difficulty: ChapterDifficulty;
  spawnSettings: ChapterSpawnSettings;
  eliteSettings: ChapterEliteSettings;
  bossConfig: BossConfig;
  gradeThresholds: GradeThresholds;
}

export interface RunResult {
  chapterId: ChapterId;
  victory: boolean;
  failureReason: FailureReason | null;
  survivalTimeMs: number;
  remainingTimeMs: number;
  score: number;
  killCount: number;
  playerLevel: number;
  grade: Grade | null;
  timeBonus: number;
  /** 通关后 Boss 剩余时间（用于结算展示） */
  bossRemainingMs: number;
}

export interface ChapterSaveData {
  bestScore: number;
  bestGrade: Grade | null;
}

export interface SaveData {
  version: 2;
  highestUnlockedChapter: number;
  bestScoreByChapter: Record<ChapterId, number>;
  bestGradeByChapter: Record<ChapterId, Grade | null>;
  settings: {
    soundEnabled: boolean;
  };
}

/** 开始界面章节卡片数据。 */
export interface ChapterSelectCard {
  chapterId: ChapterId;
  name: string;
  unlocked: boolean;
  playable: boolean;
  bestScore: number;
  bestGrade: Grade | null;
}

/** HUD 中章节相关信息。 */
export interface ChapterHudInfo {
  chapterLabel: string;
  elapsedMs: number;
  totalMs: number;
  phase: ChapterPhase;
  phaseLabel: string;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
}

/** 结算界面数据。 */
export interface ResultViewData {
  chapterId: ChapterId;
  chapterName: string;
  victory: boolean;
  failureReason: FailureReason | null;
  survivalTimeMs: number;
  bossRemainingMs: number;
  killCount: number;
  playerLevel: number;
  baseScore: number;
  timeBonus: number;
  finalScore: number;
  grade: Grade | null;
  nextChapterUnlocked: boolean;
  nextChapterId: ChapterId | null;
}

/** 调试接口快照。 */
export interface DebugSnapshot {
  runState: RunState;
  chapterId: ChapterId;
  chapterPhase: ChapterPhase;
  elapsedMs: number;
  remainingMs: number;
  bossSpawned: boolean;
  bossAlive: boolean;
  bossHp: number;
  bossMaxHp: number;
  enemyCount: number;
  playerHp: number;
  result: RunResult | null;
  highestUnlockedChapter: number;
}

/** 开发环境调试接口。 */
export interface NeonDebugApi {
  getSnapshot(): DebugSnapshot;
  setElapsedMs(ms: number): void;
  advanceTimeMs(ms: number): void;
  spawnBoss(): void;
  setBossHp(value: number): void;
  defeatBoss(): void;
  killPlayer(): void;
  restartChapter(): void;
  clearSave(): void;
  /** 调试辅助：直接刷新章节时间/状态（不替代正常流程）。 */
  pause(): void;
  resume(): void;
  grantXp(amount: number): void;
  setPlayerHp(value: number): void;
  godMode(): void;
}
