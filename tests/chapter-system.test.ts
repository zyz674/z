import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTER_1 } from '../src/game/data/ChapterConfig.ts';
import { ChapterManager } from '../src/game/systems/ChapterManager.ts';
import {
  clearSaveData,
  loadSave,
  recordChapterResult,
} from '../src/game/storage/SaveData.ts';
import type { RunResult } from '../src/game/types/Chapter.ts';

function installMockStorage(initial: Record<string, string> = {}): void {
  const store = new Map<string, string>(Object.entries(initial));
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = mock;
}

test('ChapterManager advances through P1-P5 and Boss phases', () => {
  const events: string[] = [];
  const manager = new ChapterManager(CHAPTER_1, {
    onPhaseChange: (phase) => events.push('phase:' + phase),
    onBossPrelude: () => events.push('prelude'),
    onBossCountdown: () => events.push('countdown'),
    onBossSpawn: () => events.push('bossSpawn'),
  });

  assert.equal(manager.phase, 'P1');
  manager.update(120_000);
  assert.equal(manager.phase, 'P2');
  manager.update(180_000);
  assert.equal(manager.phase, 'P3');
  manager.update(300_000);
  assert.equal(manager.phase, 'P4');
  manager.setElapsed(12 * 60 * 1000);
  assert.equal(manager.phase, 'P5');

  manager.setElapsed(13 * 60 * 1000);
  assert.equal(manager.phase, 'BOSS_PRELUDE');
  assert.equal(events.filter((e) => e === 'prelude').length, 1);

  manager.setElapsed(13.5 * 60 * 1000);
  assert.equal(manager.phase, 'BOSS_COUNTDOWN');
  assert.equal(events.filter((e) => e === 'countdown').length, 1);
  manager.setElapsed(13.5 * 60 * 1000 + 1000);
  assert.equal(events.filter((e) => e === 'countdown').length, 1);

  manager.setElapsed(14 * 60 * 1000);
  assert.equal(manager.phase, 'BOSS_ACTIVE');
  assert.equal(events.filter((e) => e === 'bossSpawn').length, 1);
  assert.equal(manager.bossSpawned, true);
});

test('Boss death wins the timeout race', () => {
  const manager = new ChapterManager(CHAPTER_1);
  manager.setElapsed(14 * 60 * 1000);
  manager.markBossDead();
  manager.setElapsed(15 * 60 * 1000);
  // Boss 已死亡：即使到达 15:00 也不应判超时
  assert.equal(manager.runState, 'RUNNING');
  const result = manager.markVictory(1000, 40, 10);
  assert.equal(result.victory, true);
  assert.equal(result.failureReason, null);
  assert.equal(result.score, 1000);
});

test('Timeout failure is produced when boss is still alive', () => {
  const manager = new ChapterManager(CHAPTER_1);
  manager.setElapsed(15 * 60 * 1000);
  assert.equal(manager.runState, 'FAILED');
  assert.equal(manager.result?.failureReason, 'TIMEOUT');
});

test('SaveData defaults, migration, corrupt JSON and unlock', () => {
  installMockStorage();
  clearSaveData();

  let save = loadSave();
  assert.equal(save.version, 2);
  assert.equal(save.highestUnlockedChapter, 1);

  const victory: RunResult = {
    chapterId: 'ch1',
    victory: true,
    failureReason: null,
    survivalTimeMs: 14 * 60 * 1000,
    remainingTimeMs: 60 * 1000,
    bossRemainingMs: 60 * 1000,
    score: 1200,
    killCount: 88,
    playerLevel: 12,
    grade: 'A',
    timeBonus: 600,
  };
  recordChapterResult('ch1', victory);
  save = loadSave();
  assert.equal(save.highestUnlockedChapter, 2);
  assert.equal(save.bestScoreByChapter.ch1, 1200);
  assert.equal(save.bestGradeByChapter.ch1, 'A');

  // 损坏 JSON 安全回退
  installMockStorage({ neonBreakoutSaveV2: '{broken json' });
  save = loadSave();
  assert.equal(save.version, 2);
  assert.equal(save.highestUnlockedChapter, 1);

  // 旧版单最高分迁移
  installMockStorage({ 'neon-breakout-highscore': '555' });
  save = loadSave();
  assert.equal(save.bestScoreByChapter.ch1, 555);
});
