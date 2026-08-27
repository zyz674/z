import { audio } from '../systems/AudioManager';
import { CHAPTERS } from '../data/ChapterConfig';
import { loadSave, setSoundSetting } from '../storage/SaveData';
import type { ChapterHudInfo, ChapterId, ChapterSelectCard, ResultViewData } from '../types/Chapter';
import type { HUDData, UpgradeCardData, UpgradeId } from '../types';

export interface HudViewData extends HUDData, ChapterHudInfo {}

export interface UIBindings {
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onChooseUpgrade: (id: UpgradeId) => void;
  onChapterSelect: () => void;
  onNextChapter: () => void;
}

/** DOM 界面管理：章节选择、HUD、Boss 血条、事件横幅、升级、暂停与结算。 */
class UIManager {
  private bindings: Partial<UIBindings> = {};
  private initialized = false;
  private selectedChapterId: ChapterId = 'ch1';
  private bannerTimer = 0;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.on('btn-start', () => {
      audio.unlock();
      audio.play('click');
      this.bindings.onStart?.();
    });
    this.on('btn-start-sound', () => this.toggleSound());
    this.on('btn-sound', () => this.toggleSound());
    this.on('btn-pause', () => this.bindings.onPause?.());
    this.on('btn-resume', () => this.bindings.onResume?.());
    this.on('btn-restart-pause', () => this.bindings.onRestart?.());
    this.on('btn-restart', () => this.bindings.onRestart?.());
    this.on('btn-chapter-select', () => this.bindings.onChapterSelect?.());
    this.on('btn-next-chapter', () => this.bindings.onNextChapter?.());
  }

  setBindings(bindings: Partial<UIBindings>): void {
    this.bindings = bindings;
  }

  getSelectedChapterId(): ChapterId {
    return this.selectedChapterId;
  }

  setChapterMessage(text: string): void {
    this.el('chapter-message').textContent = text;
  }

  showStart(): void {
    this.selectedChapterId = 'ch1';
    this.buildChapterList();
    this.hideAllScreens();
    this.el('screen-start').classList.remove('hidden');
    this.el('hud').classList.add('hidden');
    this.el('chapter-message').textContent = '';
    this.refreshSoundState();
  }

  showGame(): void {
    this.hideAllScreens();
    this.el('hud').classList.remove('hidden');
    this.hideBossBar();
    this.hideEventBanner();
  }

  showPause(): void {
    this.showScreen('screen-pause');
  }

  hidePause(): void {
    this.el('screen-pause').classList.add('hidden');
  }

  hideUpgrade(): void {
    this.el('screen-upgrade').classList.add('hidden');
  }

  showUpgrade(options: UpgradeCardData[]): void {
    const container = this.el('upgrade-cards');
    container.innerHTML = '';
    for (const opt of options) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      card.innerHTML =
        `<div class="upgrade-icon">${opt.icon}</div>` +
        `<div class="upgrade-name">${opt.name}</div>` +
        `<div class="upgrade-level">Lv.${opt.level} → Lv.${opt.level + 1}</div>` +
        `<div class="upgrade-desc">${opt.desc}</div>` +
        `<div class="upgrade-effect">${opt.preview}</div>`;
      card.addEventListener('click', () => {
        audio.play('click');
        this.bindings.onChooseUpgrade?.(opt.id);
      });
      container.appendChild(card);
    }
    this.showScreen('screen-upgrade');
  }

  showResult(data: ResultViewData): void {
    this.hideAllScreens();
    this.el('screen-result').classList.remove('hidden');
    this.el('hud').classList.add('hidden');
    this.hideBossBar();

    this.el('result-title').textContent = data.victory ? '章节完成！' : '章节失败';
    this.el('result-title').className = data.victory ? 'over-title' : 'over-title danger';
    this.el('result-sub').textContent = data.victory
      ? `${data.chapterName} 突围成功`
      : data.failureReason === 'TIMEOUT'
        ? 'Boss 超时未击杀，突围失败'
        : '玩家阵亡，突围失败';

    this.el('result-chapter').textContent = chapterShort(data.chapterId);
    this.el('result-grade').textContent = data.grade ?? '-';
    this.el('result-grade').className = 'stat-value grade' + (data.grade === 'S' ? ' grade-s' : '');
    this.el('result-time').textContent = formatTimeMs(data.survivalTimeMs);
    this.el('result-boss-remaining').textContent = data.victory ? formatTimeMs(data.bossRemainingMs) : '-';
    this.el('result-kills').textContent = String(data.killCount);
    this.el('result-level').textContent = String(data.playerLevel);
    this.el('result-base-score').textContent = formatNumber(data.baseScore);
    this.el('result-time-bonus').textContent = '+' + formatNumber(data.timeBonus);
    this.el('result-final-score').textContent = formatNumber(data.finalScore);
    this.el('result-failure').textContent = data.failureReason === 'PLAYER_DEAD'
      ? 'PLAYER_DEAD'
      : data.failureReason === 'TIMEOUT'
        ? 'TIMEOUT'
        : '-';

    const nextBtn = this.el('btn-next-chapter');
    if (data.victory && data.nextChapterId) {
      nextBtn.classList.remove('hidden');
      nextBtn.textContent = `进入 ${chapterShort(data.nextChapterId)}`;
    } else {
      nextBtn.classList.add('hidden');
    }

    this.el('result-unlock').textContent = data.victory && data.nextChapterId
      ? `已解锁：${chapterShort(data.nextChapterId)}`
      : data.victory
        ? '已通关当前章节'
        : '未解锁下一章节';
  }

  updateHUD(data: HudViewData): void {
    this.el('hud-level').textContent = String(data.level);
    this.el('hud-chapter').textContent = data.chapterLabel;
    this.el('hud-time').textContent = formatTimeMs(data.elapsedMs);
    this.el('hud-total').textContent = formatTimeMs(data.totalMs);
    this.el('hud-phase').textContent = data.phaseLabel;
    this.el('hud-score').textContent = formatNumber(data.score);
    this.el('hud-kills').textContent = String(data.kills);

    const hpPct = clampPercent(data.hp / Math.max(1, data.maxHp));
    const xpPct = clampPercent(data.xp / Math.max(1, data.xpToNext));
    this.el('hp-fill').style.width = hpPct + '%';
    this.el('xp-fill').style.width = xpPct + '%';
    this.el('hp-text').textContent = `${Math.ceil(data.hp)}/${data.maxHp}`;
    this.el('xp-text').textContent = `${Math.floor(data.xp)}/${data.xpToNext}`;

    if (data.bossName) {
      this.showBossBar(data.bossName, data.bossHp, data.bossMaxHp);
    } else {
      this.hideBossBar();
    }
  }

  showBossBar(name: string, hp: number, maxHp: number): void {
    const bar = this.el('boss-bar');
    if (bar.classList.contains('hidden')) bar.classList.remove('hidden');
    this.el('boss-name').textContent = name;
    const pct = clampPercent(hp / Math.max(1, maxHp));
    this.el('boss-fill').style.width = pct + '%';
    this.el('boss-hp-text').textContent = `${Math.ceil(hp)}/${Math.ceil(maxHp)}`;
  }

  hideBossBar(): void {
    this.el('boss-bar').classList.add('hidden');
  }

  showEventBanner(text: string, durationMs = 2200): void {
    const banner = this.el('event-banner');
    this.el('event-banner-text').textContent = text;
    banner.classList.remove('hidden');
    if (this.bannerTimer) window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => {
      banner.classList.add('hidden');
      this.bannerTimer = 0;
    }, durationMs);
  }

  hideEventBanner(): void {
    if (this.bannerTimer) window.clearTimeout(this.bannerTimer);
    this.bannerTimer = 0;
    this.el('event-banner').classList.add('hidden');
  }

  flashHurt(): void {
    const vignette = this.el('hurt-vignette');
    vignette.classList.remove('hurt');
    void vignette.offsetWidth;
    vignette.classList.add('hurt');
    vignette.addEventListener('animationend', () => vignette.classList.remove('hurt'), { once: true });
  }

  refreshSoundState(): void {
    const enabled = audio.enabled;
    this.el('btn-sound').textContent = enabled ? '🔊' : '🔇';
    this.el('btn-start-sound').textContent = enabled ? '🔊 音效：开' : '🔇 音效：关';
  }

  private buildChapterList(): void {
    const save = loadSave();
    const container = this.el('chapter-list');
    container.innerHTML = '';
    for (const config of CHAPTERS) {
      const unlocked = chapterNumber(config.chapterId) <= save.highestUnlockedChapter;
      const playable = config.playable;
      const card: ChapterSelectCard = {
        chapterId: config.chapterId,
        name: `${chapterShort(config.chapterId)} ${config.name}`,
        unlocked,
        playable,
        bestScore: save.bestScoreByChapter[config.chapterId] ?? 0,
        bestGrade: save.bestGradeByChapter[config.chapterId] ?? null,
      };
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.chapter = config.chapterId;
      btn.className = 'chapter-btn' + (unlocked ? ' unlocked' : ' locked') + (this.selectedChapterId === config.chapterId ? ' selected' : '');
      btn.innerHTML =
        `<span class="chapter-id">${chapterShort(config.chapterId)}</span>` +
        `<span class="chapter-name">${config.name}</span>` +
        `<span class="chapter-state">${unlocked ? (playable ? 'ON AIR' : '待接入') : '🔒 锁定'}</span>` +
        `<span class="channel-bars" aria-hidden="true"><i></i><i></i><i></i></span>` +
        `<span class="chapter-best">最高分 ${formatNumber(card.bestScore)}${card.bestGrade ? ' · ' + card.bestGrade : ''}</span>`;
      btn.addEventListener('click', () => {
        if (!unlocked) {
          this.el('chapter-message').textContent = '该章节尚未解锁，通关前一章后开放。';
          return;
        }
        this.selectedChapterId = config.chapterId;
        if (!playable) {
          this.el('chapter-message').textContent = '该章节内容尚未完成，本轮仅 Ch1 可完整游玩。';
        } else {
          this.el('chapter-message').textContent = '';
          audio.play('click');
        }
        this.refreshChapterSelection();
      });
      container.appendChild(btn);
    }
    this.refreshChapterSelection();
  }

  private refreshChapterSelection(): void {
    const buttons = this.el('chapter-list').querySelectorAll<HTMLButtonElement>('.chapter-btn');
    buttons.forEach((btn) => {
      const id = btn.dataset.chapter as ChapterId | undefined;
      if (id) btn.classList.toggle('selected', id === this.selectedChapterId);
    });
    const save = loadSave();
    this.el('start-highscore').textContent = formatNumber(save.bestScoreByChapter[this.selectedChapterId] ?? 0);
  }

  private toggleSound(): void {
    audio.unlock();
    audio.toggle();
    setSoundSetting(audio.enabled);
    this.refreshSoundState();
    audio.play('click');
  }

  private showScreen(id: string): void {
    this.hideAllScreens();
    this.el(id).classList.remove('hidden');
  }

  private hideAllScreens(): void {
    for (const id of ['screen-start', 'screen-pause', 'screen-upgrade', 'screen-result']) {
      this.el(id).classList.add('hidden');
    }
  }

  private on(id: string, handler: () => void): void {
    this.el(id).addEventListener('click', handler);
  }

  private el(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing UI element #${id}`);
    return element;
  }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value * 100));
}

export function formatTimeMs(ms: number): string {
  return formatTime(ms / 1000);
}

export function formatTime(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatNumber(value: number): string {
  return Math.floor(value).toLocaleString('zh-CN');
}

function chapterShort(id: ChapterId): string {
  return 'Ch' + chapterNumber(id);
}

function chapterNumber(id: ChapterId): number {
  return CHAPTERS.findIndex((c) => c.chapterId === id) + 1;
}

export const ui = new UIManager();
