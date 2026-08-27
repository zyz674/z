import type { ChapterId, Grade, RunResult, SaveData } from '../types/Chapter';
import { chapterIdForNumber, chapterNumber } from '../data/ChapterConfig';

const SAVE_KEY = 'neonBreakoutSaveV2';
const LEGACY_SCORE_KEY = 'neon-breakout-highscore';
const LEGACY_SOUND_KEY = 'neon-breakout-sound-enabled';

const DEFAULT_VERSION = 2 as const;

const ALL_CHAPTERS: ChapterId[] = ['ch1', 'ch2', 'ch3'];

export function createDefaultSave(): SaveData {
  return {
    version: DEFAULT_VERSION,
    highestUnlockedChapter: 1,
    bestScoreByChapter: { ch1: 0, ch2: 0, ch3: 0 },
    bestGradeByChapter: { ch1: null, ch2: null, ch3: null },
    settings: { soundEnabled: readLegacySoundSetting() },
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      return normalizeSave(parsed);
    }
  } catch {
    // JSON 损坏或读取失败：安全回退默认值
  }

  // 旧版单最高分迁移
  const migrated = createDefaultSave();
  try {
    const legacy = Number(localStorage.getItem(LEGACY_SCORE_KEY));
    if (Number.isFinite(legacy) && legacy > 0) {
      migrated.bestScoreByChapter.ch1 = Math.floor(legacy);
    }
  } catch {
    // ignore
  }
  return migrated;
}

export function saveSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // 存档失败不应阻塞游戏
  }
}

export function clearSaveData(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function setSoundSetting(enabled: boolean): void {
  const save = loadSave();
  save.settings.soundEnabled = enabled;
  saveSave(save);
}

/** 通关后记录成绩并解锁下一章；失败不解锁。 */
export function recordChapterResult(chapterId: ChapterId, result: RunResult): void {
  const save = loadSave();
  const score = Math.max(0, Math.floor(result.score));
  save.bestScoreByChapter[chapterId] = Math.max(save.bestScoreByChapter[chapterId] ?? 0, score);

  if (result.victory && result.grade) {
    const current = save.bestGradeByChapter[chapterId] ?? null;
    if (!current || gradeRank(result.grade) < gradeRank(current)) {
      save.bestGradeByChapter[chapterId] = result.grade;
    }
    const nextChapter = chapterNumber(chapterId) + 1;
    if (nextChapter <= 3) {
      save.highestUnlockedChapter = Math.max(save.highestUnlockedChapter, nextChapter);
    }
  }

  saveSave(save);
}

export function isChapterUnlocked(save: SaveData, chapterId: ChapterId): boolean {
  return chapterNumber(chapterId) <= save.highestUnlockedChapter;
}

function normalizeSave(raw: unknown): SaveData {
  const fallback = createDefaultSave();
  const obj = asRecord(raw);
  if (!obj) return fallback;

  const version = typeof obj['version'] === 'number' ? obj['version'] : fallback.version;
  if (version !== DEFAULT_VERSION) return fallback;

  const highest = typeof obj['highestUnlockedChapter'] === 'number'
    ? clampInt(obj['highestUnlockedChapter'], 1, 3)
    : 1;

  const bestScoreByChapter = normalizeScoreRecord(obj['bestScoreByChapter'], fallback.bestScoreByChapter);
  const bestGradeByChapter = normalizeGradeRecord(obj['bestGradeByChapter'], fallback.bestGradeByChapter);

  const rawSettings = asRecord(obj['settings']);
  const soundEnabled = typeof rawSettings?.['soundEnabled'] === 'boolean'
    ? rawSettings['soundEnabled']
    : fallback.settings.soundEnabled;

  return {
    version: DEFAULT_VERSION,
    highestUnlockedChapter: highest,
    bestScoreByChapter,
    bestGradeByChapter,
    settings: { soundEnabled },
  };
}

function normalizeScoreRecord(value: unknown, fallback: Record<ChapterId, number>): Record<ChapterId, number> {
  const record = asRecord(value);
  const result: Record<ChapterId, number> = { ...fallback };
  if (!record) return result;
  for (const id of ALL_CHAPTERS) {
    const v = record[id];
    if (typeof v === 'number' && Number.isFinite(v)) {
      result[id] = Math.max(0, Math.floor(v));
    }
  }
  return result;
}

function normalizeGradeRecord(value: unknown, fallback: Record<ChapterId, Grade | null>): Record<ChapterId, Grade | null> {
  const record = asRecord(value);
  const result: Record<ChapterId, Grade | null> = { ...fallback };
  if (!record) return result;
  for (const id of ALL_CHAPTERS) {
    const v = record[id];
    if (v === 'S' || v === 'A' || v === 'B') result[id] = v;
    else result[id] = null;
  }
  return result;
}

function readLegacySoundSetting(): boolean {
  try {
    return localStorage.getItem(LEGACY_SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function gradeRank(grade: Grade): number {
  // 数字越小评级越高：S=0, A=1, B=2
  if (grade === 'S') return 0;
  if (grade === 'A') return 1;
  return 2;
}

export function getDefaultChapterId(): ChapterId {
  return chapterIdForNumber(1);
}
