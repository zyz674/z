/** 程序化 Web Audio 音效：不依赖外部素材，失败时静默降级。 */

export type SoundName = 'shoot' | 'hit' | 'kill' | 'hurt' | 'levelup' | 'gem' | 'click' | 'gameover';

const STORAGE_KEY = 'neon-breakout-sound-enabled';

class AudioManager {
  private context: AudioContext | null = null;
  private _enabled = true;

  constructor() {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '0') this._enabled = false;
    } catch {
      this._enabled = true;
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  toggle(): boolean {
    this._enabled = !this._enabled;
    try {
      localStorage.setItem(STORAGE_KEY, this._enabled ? '1' : '0');
    } catch {
      // ignore
    }
    return this._enabled;
  }

  /** 必须在用户手势后调用以解锁 AudioContext。 */
  unlock(): void {
    try {
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === 'suspended') {
        void this.context.resume();
      }
    } catch {
      this.context = null;
    }
  }

  play(name: SoundName): void {
    if (!this._enabled) return;
    try {
      this.unlock();
      if (!this.context) return;
      const t = this.context.currentTime;
      switch (name) {
        case 'shoot':
          this.tone(640, 0.05, 'sine', 0.045, t);
          break;
        case 'hit':
          this.tone(240, 0.07, 'square', 0.05, t);
          break;
        case 'kill':
          this.tone(340, 0.1, 'triangle', 0.07, t);
          break;
        case 'hurt':
          this.tone(150, 0.18, 'sawtooth', 0.09, t);
          break;
        case 'levelup':
          this.tone(520, 0.1, 'sine', 0.08, t);
          this.tone(660, 0.1, 'sine', 0.08, t + 0.09);
          this.tone(880, 0.16, 'sine', 0.08, t + 0.18);
          break;
        case 'gem':
          this.tone(980, 0.06, 'sine', 0.05, t);
          break;
        case 'click':
          this.tone(600, 0.05, 'sine', 0.05, t);
          break;
        case 'gameover':
          this.tone(420, 0.2, 'sawtooth', 0.08, t);
          this.tone(300, 0.2, 'sawtooth', 0.08, t + 0.18);
          this.tone(190, 0.35, 'sawtooth', 0.08, t + 0.36);
          break;
      }
    } catch {
      // 音效失败不影响游戏运行
    }
  }

  private tone(freq: number, duration: number, type: OscillatorType, volume: number, when: number): void {
    if (!this.context) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(this.context.destination);
    osc.start(when);
    osc.stop(when + duration + 0.03);
  }
}

export const audio = new AudioManager();
