import type {
  ChapterConfig,
  ChapterPhase,
  FailureReason,
  Grade,
  RunResult,
  RunState,
} from '../types/Chapter';

/** 章节时间线回调：所有状态推进都通过回调通知场景。 */
export interface ChapterCallbacks {
  onPhaseChange?: (phase: ChapterPhase, label: string) => void;
  onBossPrelude?: () => void;
  onBossCountdown?: () => void;
  onBossSpawn?: () => void;
  onTimeout?: () => void;
}

const PHASE_LABELS: Record<ChapterPhase, string> = {
  P1: 'P1 暖场',
  P2: 'P2 提速',
  P3: 'P3 重压',
  P4: 'P4 高潮',
  P5: 'P5 终局',
  BOSS_PRELUDE: 'Boss 前奏',
  BOSS_COUNTDOWN: 'Boss 倒计时',
  BOSS_ACTIVE: 'Boss 战',
  COMPLETED: '章节完成',
  FAILED: '章节失败',
};

/**
 * 章节管理器：只负责时间、阶段、事件与结果判定。
 * 时间完全由 GameScene 传入的 gameplay delta 驱动，不读取 Date.now。
 */
export class ChapterManager {
  private readonly config: ChapterConfig;
  private readonly callbacks: ChapterCallbacks;

  private _elapsedMs = 0;
  private _phase: ChapterPhase;
  private _runState: RunState = 'RUNNING';
  private _result: RunResult | null = null;

  private firedPrelude = false;
  private firedCountdown = false;
  private _bossSpawned = false;
  private _bossDead = false;

  constructor(config: ChapterConfig, callbacks: ChapterCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
    this._phase = this.computePhase(0);
  }

  get elapsedMs(): number {
    return this._elapsedMs;
  }

  get phase(): ChapterPhase {
    return this._phase;
  }

  get runState(): RunState {
    return this._runState;
  }

  get result(): RunResult | null {
    return this._result;
  }

  get bossSpawned(): boolean {
    return this._bossSpawned;
  }

  get bossDead(): boolean {
    return this._bossDead;
  }

  get remainingMs(): number {
    return Math.max(0, this.config.durationMs - this._elapsedMs);
  }

  get bossCountdownRemainingMs(): number {
    return Math.max(0, this.config.bossSpawnAtMs - this._elapsedMs);
  }

  /** 有效游戏状态下推进时间；暂停/升级/结算时不调用。 */
  update(deltaMs: number): void {
    if (this._runState !== 'RUNNING') return;
    this._elapsedMs += Math.max(0, deltaMs);
    this.syncTimeline();
  }

  /** 调试接口：直接设置章节时间，跨越阶段时事件只触发一次。 */
  setElapsed(ms: number): void {
    if (this._runState !== 'RUNNING') return;
    this._elapsedMs = Math.max(0, ms);
    this.syncTimeline();
  }

  /** Boss 死亡标记（由场景在冲突判定前调用，保证 Boss 死亡优先于超时）。 */
  markBossDead(): void {
    this._bossDead = true;
  }

  /** Boss 死亡 = 章节通关，返回结算数据。 */
  markVictory(baseScore: number, killCount: number, playerLevel: number): RunResult {
    if (this._result) return this._result;
    this._runState = 'VICTORY';
    this._phase = 'COMPLETED';
    this._bossDead = true;

    const remaining = this.remainingMs;
    const timeBonus = Math.floor(remaining / 1000) * 10;
    const grade = computeGrade(remaining, this.config.gradeThresholds);
    this._result = {
      chapterId: this.config.chapterId,
      victory: true,
      failureReason: null,
      survivalTimeMs: this._elapsedMs,
      remainingTimeMs: remaining,
      bossRemainingMs: remaining,
      score: baseScore + timeBonus,
      killCount,
      playerLevel,
      grade,
      timeBonus,
    };
    this.callbacks.onPhaseChange?.(this._phase, PHASE_LABELS[this._phase]);
    return this._result;
  }

  /** 失败（玩家死亡或超时）。 */
  markFailure(reason: FailureReason): RunResult {
    if (this._result) return this._result;
    this._runState = 'FAILED';
    this._phase = 'FAILED';

    const remaining = reason === 'TIMEOUT' ? 0 : this.remainingMs;
    this._result = {
      chapterId: this.config.chapterId,
      victory: false,
      failureReason: reason,
      survivalTimeMs: this._elapsedMs,
      remainingTimeMs: remaining,
      bossRemainingMs: 0,
      score: baseScorePlaceholder(),
      killCount: baseKillPlaceholder(),
      playerLevel: baseLevelPlaceholder(),
      grade: null,
      timeBonus: 0,
    };
    this.callbacks.onPhaseChange?.(this._phase, PHASE_LABELS[this._phase]);
    return this._result;
  }

  phaseLabel(): string {
    return PHASE_LABELS[this._phase];
  }

  /** 将最终分数/击杀/等级写入失败结果（场景侧填充）。 */
  fillFailureResult(baseScore: number, killCount: number, playerLevel: number): RunResult | null {
    if (!this._result) return null;
    this._result.score = baseScore;
    this._result.killCount = killCount;
    this._result.playerLevel = playerLevel;
    return this._result;
  }

  private syncTimeline(): void {
    const c = this.config;

    const nextPhase = this.computePhase(this._elapsedMs);
    if (nextPhase !== this._phase) {
      this._phase = nextPhase;
      this.callbacks.onPhaseChange?.(this._phase, PHASE_LABELS[this._phase]);
    }

    if (!this.firedPrelude && this._elapsedMs >= c.bossPreludeAtMs) {
      this.firedPrelude = true;
      this.callbacks.onBossPrelude?.();
    }
    if (!this.firedCountdown && this._elapsedMs >= c.bossCountdownAtMs) {
      this.firedCountdown = true;
      this.callbacks.onBossCountdown?.();
    }
    if (!this._bossSpawned && this._elapsedMs >= c.bossSpawnAtMs) {
      this._bossSpawned = true;
      this.callbacks.onBossSpawn?.();
    }

    if (!this._result && this._elapsedMs >= c.durationMs) {
      // Boss 死亡优先：若已标记死亡，交给 markVictory 判定为通关。
      if (this._bossDead) return;
      this.callbacks.onTimeout?.();
      this.markFailure('TIMEOUT');
    }
  }

  private computePhase(ms: number): ChapterPhase {
    const c = this.config;
    if (this._result) return this._result.victory ? 'COMPLETED' : 'FAILED';
    if (ms >= c.bossSpawnAtMs) return 'BOSS_ACTIVE';
    if (ms >= c.bossCountdownAtMs) return 'BOSS_COUNTDOWN';
    if (ms >= c.bossPreludeAtMs) return 'BOSS_PRELUDE';

    const boundaries = c.phaseBoundariesMs;
    for (let i = boundaries.length - 1; i >= 0; i -= 1) {
      if (ms >= boundaries[i]) {
        return `P${i + 1}` as ChapterPhase;
      }
    }
    return 'P1';
  }
}

function computeGrade(remainingMs: number, thresholds: { S: number; A: number }): Grade {
  if (remainingMs >= thresholds.S) return 'S';
  if (remainingMs >= thresholds.A) return 'A';
  return 'B';
}

/** markFailure 暂用占位，场景随后调用 fillFailureResult 覆盖。 */
function baseScorePlaceholder(): number {
  return 0;
}
function baseKillPlaceholder(): number {
  return 0;
}
function baseLevelPlaceholder(): number {
  return 1;
}
