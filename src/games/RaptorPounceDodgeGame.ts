import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type RaptorTheme = 'savanna_ferns' | 'moonlit_paddock' | 'redwood_canyon';

interface RaptorPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  strikeColor: string;
}

const THEMES: Record<RaptorTheme, RaptorPalette> = {
  savanna_ferns: {
    name: 'Long Grass Raptor Savanna',
    bgTop: '#14532d',
    bgBot: '#052e16',
    strikeColor: '#ef4444',
  },
  moonlit_paddock: {
    name: 'Isla Nublar Night Paddock',
    bgTop: '#0f172a',
    bgBot: '#020617',
    strikeColor: '#ec4899',
  },
  redwood_canyon: {
    name: 'Redwood Fern Clearing',
    bgTop: '#451a03',
    bgBot: '#1c1917',
    strikeColor: '#f97316',
  },
};

const THEME_KEYS: RaptorTheme[] = ['savanna_ferns', 'moonlit_paddock', 'redwood_canyon'];

interface RaptorPounce {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  timer: number;
  phase: 'telegraph' | 'strike';
}

interface AmberRelic {
  id: number;
  x: number;
  y: number;
  golden: boolean;
}

interface Survivor {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  rollInvulnTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class RaptorPounceDodgeGame extends BaseGame {
  private survivors: Survivor[] = [];
  private pounces: RaptorPounce[] = [];
  private relics: AmberRelic[] = [];
  private spawnTimer = 1.1;
  private timeElapsed = 0;
  private roundTime = 45;
  private suddenDeath = false;
  private hitStopTimer = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private themeIdx = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIdx = (this.themeIdx + 1) % THEME_KEYS.length;
          this.audio.playTap();
        } else if (e.key === '1') this.themeIdx = 0;
        else if (e.key === '2') this.themeIdx = 1;
        else if (e.key === '3') this.themeIdx = 2;
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public reset(width: number, height: number): void {
    this.timeElapsed = 0;
    this.roundTime = 45;
    this.isFinished = false;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.survivors = [];
    this.pounces = [];
    this.relics = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.survivors.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.32 + idx * 0.18),
        y: height * 0.54,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        rollInvulnTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 8; i++) {
      this.relics.push(this.spawnRelic(width, height, i));
    }
  }

  private spawnRelic(width: number, height: number, id: number): AmberRelic {
    return {
      id,
      x: width * (0.16 + Math.random() * 0.68),
      y: height * (0.18 + Math.random() * 0.66),
      golden: Math.random() < 0.28,
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(s: Survivor, text: string): void {
    s.calloutText = text;
    s.calloutTimer = 1.15;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return;
    }

    this.timeElapsed += dt;
    const remaining = Math.max(0, this.roundTime - this.timeElapsed);
    if (remaining <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playBuzzer();
      this.survivors.forEach((s) => this.showCallout(s, 'PACK AMBUSH 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Spawn Raptor Pounce Telegraphs
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeath ? 0.85 : 1.3;
      const target = this.survivors[Math.floor(Math.random() * this.survivors.length)];
      const ty = target ? target.y : height * 0.5;
      this.pounces.push({
        id: Math.random(),
        x1: width * 0.08,
        y1: ty + (Math.random() - 0.5) * 90,
        x2: width * 0.92,
        y2: ty + (Math.random() - 0.5) * 90,
        timer: 1.05,
        phase: 'telegraph',
      });
    }

    for (const p of this.pounces) {
      p.timer -= dt;
      if (p.phase === 'telegraph' && p.timer <= 0) {
        p.phase = 'strike';
        p.timer = 0.28;
        this.audio.playWhoosh();
        for (const s of this.survivors) {
          const dist = Math.abs((p.y2 - p.y1) * s.x - (p.x2 - p.x1) * s.y + p.x2 * p.y1 - p.y2 * p.x1) /
            Math.max(1, Math.hypot(p.y2 - p.y1, p.x2 - p.x1));
          if (dist < 34) {
            if (s.rollInvulnTimer > 0 || s.underdog) {
              s.score += 60;
              this.showCallout(s, 'CLOSE CALL DODGE +60!');
              this.audio.playScore();
            } else {
              s.stunTimer = 1.05;
              s.combo = 1;
              this.showCallout(s, 'POUNCED!');
              this.audio.playStun();
              this.triggerHitStop(45, 12);
            }
          }
        }
      }
    }
    this.pounces = this.pounces.filter((p) => !(p.phase === 'strike' && p.timer <= 0));

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.survivors.map((s) => s.score));

    for (const s of this.survivors) {
      s.underdog = maxScore - s.score >= 150;
      if (s.calloutTimer > 0) s.calloutTimer = Math.max(0, s.calloutTimer - dt);
      if (s.rollInvulnTimer > 0) s.rollInvulnTimer = Math.max(0, s.rollInvulnTimer - dt);
      if (s.stunTimer > 0) {
        s.stunTimer = Math.max(0, s.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(s.id);
      const sy = this.input.getThrottle(s.id);
      const justTap = this.input.justPressed(s.id) || this.input.justAction(s.id);
      const isHold = this.input.isActionPressed(s.id) || this.input.isPressed(s.id);

      const accel = 1350 * (s.underdog ? 1.15 : 1.0);
      s.vx += sx * accel * dt;
      s.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      s.vx *= Math.pow(0.05, dt);
      s.vy *= Math.pow(0.05, dt);

      if (justTap) {
        s.rollInvulnTimer = 0.45;
        this.audio.playTap();
      }

      // Hold-to-charge Flare Decoy Roll & Savanna Shunt (72%-98% Sweet Spot)
      if (isHold) {
        s.holding = true;
        s.charge = Math.min(1, s.charge + dt * 0.92);
      } else if (s.holding) {
        const sweet = s.charge >= 0.72 && s.charge <= 0.98;
        if (sweet) {
          s.rollInvulnTimer = 2.0;
          s.score += 85;
          s.combo = Math.min(4, s.combo + 1);
          this.showCallout(s, 'FLARE ROLL +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.survivors) {
            if (other.id !== s.id && Math.hypot(other.x - s.x, other.y - s.y) < 165) {
              const dx = other.x - s.x;
              const dy = other.y - s.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 520;
              other.vy += (dy / d) * 520;
              s.score += 70;
              this.showCallout(s, 'RAPTOR BAIT SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (s.charge > 0.98) {
          s.stunTimer = 0.9;
          s.combo = 1;
          this.showCallout(s, 'STUMBLED!');
          this.audio.playStun();
        }
        s.holding = false;
        s.charge = 0;
      }

      s.x = Math.max(width * 0.1, Math.min(width * 0.9, s.x + s.vx * dt));
      s.y = Math.max(height * 0.16, Math.min(height * 0.88, s.y + s.vy * dt));

      for (let i = 0; i < this.relics.length; i++) {
        const rl = this.relics[i];
        if (Math.hypot(s.x - rl.x, s.y - rl.y) < 32) {
          const base = rl.golden ? 95 : 50;
          const pts = base * s.combo * (this.suddenDeath ? 2 : 1);
          s.score += pts;
          s.combo = Math.min(4, s.combo + 1);
          this.showCallout(s, rl.golden ? `GOLDEN CLAW +${pts}!` : `RELIC +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(rl.x, rl.y, '#fbbf24', 10);
          this.relics[i] = this.spawnRelic(width, height, rl.id);
        }
      }
    }

    // Survivor-to-Survivor Bumping
    for (let i = 0; i < this.survivors.length; i++) {
      for (let j = i + 1; j < this.survivors.length; j++) {
        const a = this.survivors[i];
        const b = this.survivors[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 36) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * 280;
          a.vy -= ny * 280;
          b.vx += nx * 280;
          b.vy += ny * 280;
          this.audio.playBounce();
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.survivors.find((s) => s.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const best = this.relics[0];
    if (best) {
      const dx = best.x - bot.x;
      const dy = best.y - bot.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      bot.vx += (dx / d) * 1100 * dt;
      bot.vy += (dy / d) * 1100 * dt;
    }

    const hold = !bot.holding || bot.charge < bot.botChargeGoal;
    this.input.setBotState(botId, hold);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[THEME_KEYS[this.themeIdx]];
    ctx.save();

    if (this.shakeTimer > 0) {
      const s = this.shakeIntensity * (this.shakeTimer / 0.22);
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, pal.bgTop);
    bg.addColorStop(1, pal.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Raptor Pounce Lines
    for (const p of this.pounces) {
      ctx.strokeStyle = p.phase === 'strike' ? '#ffffff' : pal.strikeColor;
      ctx.lineWidth = p.phase === 'strike' ? 14 : 4;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
    }

    // Relics
    for (const rl of this.relics) {
      ctx.fillStyle = rl.golden ? '#fbbf24' : '#34d399';
      ctx.beginPath();
      ctx.arc(rl.x, rl.y, rl.golden ? 15 : 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Survivors
    for (const s of this.survivors) {
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.holding && s.charge > 0.05) {
        const sweet = s.charge >= 0.72 && s.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + s.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = s.stunTimer > 0 ? 'shocked' : s.rollInvulnTimer > 0 ? 'triumph' : s.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, s.id, 0, 0, 17, mood, this.timeElapsed, s.vx * 0.0005);
      if (s.calloutTimer > 0 && s.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.calloutText, 0, -28);
      }
      ctx.restore();
    }

    // HUD
    const remaining = Math.max(0, Math.ceil(this.roundTime - this.timeElapsed));
    ctx.fillStyle = 'rgba(15,23,42,0.82)';
    ctx.fillRect(0, 0, width, 46);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `🦎 RAPTOR POUNCE DODGE • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X AMBUSH' : ''}`,
      width * 0.5,
      19
    );

    this.survivors.forEach((s, idx) => {
      ctx.fillStyle = s.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${s.id}: ${Math.round(s.score)} pts (${s.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.survivors].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((s, i) => ({
        playerId: s.id,
        score: Math.round(s.score),
        place: i + 1,
      })),
      mvpHighlight: `Raptor Evasion Ace ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
