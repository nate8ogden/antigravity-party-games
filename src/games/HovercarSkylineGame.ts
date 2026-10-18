import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'neo_tokyo' | 'outrun_sunset' | 'matrix_acid';

interface ThemePalette {
  id: ThemeId;
  name: string;
  bgTop: string;
  bgBot: string;
  neonLine: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'neo_tokyo',
    name: 'Neo-Tokyo Cyberway',
    bgTop: '#070a14',
    bgBot: '#0f172a',
    neonLine: 'rgba(56, 189, 248, 0.2)',
    accent: '#38bdf8',
  },
  {
    id: 'outrun_sunset',
    name: 'Outrun Sunset Strip',
    bgTop: '#1e0538',
    bgBot: '#3b0764',
    neonLine: 'rgba(244, 114, 182, 0.22)',
    accent: '#f472b6',
  },
  {
    id: 'matrix_acid',
    name: 'Matrix Acid Rainway',
    bgTop: '#021810',
    bgBot: '#052e16',
    neonLine: 'rgba(52, 211, 153, 0.22)',
    accent: '#34d399',
  },
];

interface HighwayTraffic {
  id: number;
  x: number;
  y: number;
  vx: number;
  kind: 'cargo_truck' | 'battery_orb' | 'hyper_core';
  value: number;
}

interface Hovercar {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  charging: boolean;
  charge: number;
  warpTimer: number;
  spinoutTimer: number;
  drafting: boolean;
  underdog: boolean;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  color: string;
}

export class HovercarSkylineGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public cars: Map<PlayerId, Hovercar> = new Map();
  private traffic: HighwayTraffic[] = [];
  private shockwaves: Shockwave[] = [];
  private nextTrafficId = 1;
  private spawnTimer = 0.7;
  private themeIndex = 0;
  private suddenDeath = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIndex = (this.themeIndex + 1) % THEMES.length;
          this.audio.playTap();
        } else if (e.key === '1') {
          this.themeIndex = 0;
          this.audio.playTap();
        } else if (e.key === '2') {
          this.themeIndex = 1;
          this.audio.playTap();
        } else if (e.key === '3') {
          this.themeIndex = 2;
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.suddenDeath = false;
    this.cars.clear();
    this.traffic = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.spawnTimer = 0.55;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.cars.set(p.id, {
        id: p.id,
        x: 130 + idx * 55,
        y: height * 0.34 + idx * 48,
        vx: 0,
        vy: 0,
        score: 0,
        charging: false,
        charge: 0,
        warpTimer: 0,
        spinoutTimer: 0,
        drafting: false,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.14,
        botTargetX: width * 0.5,
        botTargetY: height * 0.5,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnTraffic(width, height, true);
    }
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    void width;
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  private spawnTraffic(width: number, height: number, randomX = false): void {
    if (this.traffic.length >= 15) return;
    const roll = Math.random();
    const kind = roll < 0.28 ? 'cargo_truck' : roll < 0.5 ? 'hyper_core' : 'battery_orb';
    this.traffic.push({
      id: this.nextTrafficId++,
      x: randomX ? 170 + Math.random() * (width - 230) : width + 45,
      y: 110 + Math.random() * (height - 195),
      vx: -(210 + Math.random() * 65) * (this.suddenDeath ? 1.25 : 1.0),
      kind,
      value: kind === 'hyper_core' ? 95 : kind === 'battery_orb' ? 50 : -25,
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    if (!this.suddenDeath && this.roundTimer <= 15.0) {
      this.suddenDeath = true;
      this.audio.playFanfare();
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: CYBERWAY OVERDRIVE 2X! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.cars.forEach(c => {
      if (c.score > maxScore) maxScore = c.score;
    });
    this.cars.forEach(c => {
      c.underdog = maxScore - c.score >= 150;
    });

    this.updateBots(dt, width, height);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeath ? 0.48 : 0.78;
      this.spawnTraffic(width, height, false);
    }

    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const t = this.traffic[i];
      t.x += t.vx * dt;
      if (t.x < -50) this.traffic.splice(i, 1);
    }

    const list = Array.from(this.cars.values());
    this.cars.forEach(c => {
      if (c.warpTimer > 0) c.warpTimer = Math.max(0, c.warpTimer - dt);

      c.drafting = false;
      for (const other of list) {
        if (other.id !== c.id && other.x > c.x + 24 && other.x < c.x + 150 && Math.abs(other.y - c.y) < 34) {
          c.drafting = true;
          c.score += Math.round(16 * dt);
          break;
        }
      }

      if (c.spinoutTimer > 0) {
        c.spinoutTimer -= dt;
        c.charging = false;
        c.charge = 0;
        c.vx *= 0.9;
        c.vy *= 0.9;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        this.clampCar(c, width, height);
        return;
      }

      const move = { x: this.input.getSteer(c.id), y: -this.input.getThrottle(c.id) };
      const speedMult = (c.underdog ? 1.24 : 1.0) * (c.drafting ? 1.24 : 1.0) * (c.warpTimer > 0 ? 1.55 : 1.0);
      const accel = 960 * speedMult;

      c.vx += move.x * accel * dt;
      c.vy += move.y * accel * dt;
      c.vx *= 0.87;
      c.vy *= 0.87;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      this.clampCar(c, width, height);

      const pCfg = this.getPlayer(c.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;

      if (this.input.justAction(c.id) || (isBot && this.input.justPressed(c.id))) {
        c.vx += 180;
        this.audio.playWhoosh();
      }

      const holding = this.input.isActionPressed(c.id) || (isBot && this.input.isPressed(c.id));
      if (holding) {
        c.charging = true;
        c.charge += dt * 0.84;
        if (c.charge >= 1.0) {
          c.charging = false;
          c.charge = 0;
          c.spinoutTimer = 0.75;
          this.audio.playBuzzer();
          this.addFloatingText(c.x, c.y - 28, '⚠️ TURBINE STALL!', '#ef4444', 15);
        }
      } else if (c.charging) {
        const pct = c.charge;
        c.charging = false;
        c.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerHyperNitroWarp(c);
        }
      }

      for (let i = this.traffic.length - 1; i >= 0; i--) {
        const t = this.traffic[i];
        if (Math.hypot(t.x - c.x, t.y - c.y) < 32) {
          if (t.kind === 'cargo_truck') {
            if (c.warpTimer > 0 || c.underdog) {
              c.score += 55;
              this.audio.playBoost();
              this.particles.emit(t.x, t.y, 16, '#facc15');
              this.addFloatingText(t.x, t.y - 22, '🚀 HAULER SMASHED! +55', '#facc15', 16);
            } else {
              c.spinoutTimer = 0.8;
              c.score = Math.max(0, c.score - 25);
              this.audio.playExplosion();
              this.particles.emit(t.x, t.y, 18, '#ef4444');
              this.addFloatingText(t.x, t.y - 22, '💥 CARGO CRASH! -25', '#ef4444', 16);
            }
          } else {
            const pts = Math.round(t.value * (this.suddenDeath ? 2 : 1));
            c.score += pts;
            this.audio.playScore();
            const col = t.kind === 'hyper_core' ? '#facc15' : '#38bdf8';
            const label = t.kind === 'hyper_core' ? `👑 HYPER CORE! +${pts}` : `⚡ BATTERY ORB! +${pts}`;
            this.particles.emit(t.x, t.y, 12, col);
            this.addFloatingText(t.x, t.y - 22, label, col, 16);
          }
          this.traffic.splice(i, 1);
        }
      }
    });

    // Hovercar-to-Hovercar collisions
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const imp = 230;
          a.vx -= nx * imp;
          a.vy -= ny * imp;
          b.vx += nx * imp;
          b.vy += ny * imp;
          this.audio.playBounce();
        }
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.r += (s.maxR - s.r) * dt * 7;
      s.alpha -= dt * 1.9;
      if (s.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 0.95;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private clampCar(c: Hovercar, width: number, height: number): void {
    const padX = 56;
    const minY = 98;
    const maxY = height - 62;
    if (c.x < padX) { c.x = padX; c.vx = Math.abs(c.vx) * 0.5; }
    if (c.x > width - padX) { c.x = width - padX; c.vx = -Math.abs(c.vx) * 0.5; }
    if (c.y < minY) { c.y = minY; c.vy = Math.abs(c.vy) * 0.5; }
    if (c.y > maxY) { c.y = maxY; c.vy = -Math.abs(c.vy) * 0.5; }
  }

  private triggerHyperNitroWarp(c: Hovercar): void {
    c.warpTimer = 1.45;
    c.vx += 380;
    const pts = this.suddenDeath ? 170 : 85;
    c.score += pts;
    this.audio.playBoost();
    this.shockwaves.push({
      x: c.x,
      y: c.y,
      r: 20,
      maxR: 155,
      alpha: 1,
      color: '#facc15',
    });
    this.particles.emit(c.x, c.y, 24, '#facc15');
    this.addFloatingText(c.x, c.y - 34, `🚀 HYPER-NITRO WARP! +${pts}`, '#facc15', 18);

    this.cars.forEach(other => {
      if (other.id === c.id) return;
      const dist = Math.hypot(other.x - c.x, other.y - c.y);
      if (dist < 150) {
        const nx = (other.x - c.x) / (dist || 1);
        const ny = (other.y - c.y) / (dist || 1);
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.spinoutTimer = 0.7;
        c.score += 70;
        this.addFloatingText(other.x, other.y - 28, '💥 SKYWAY SHUNT! +70', '#38bdf8', 17);
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const bot = this.cars.get(botId);
    if (!bot || bot.spinoutTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      let best: HighwayTraffic | null = null;
      let bestScore = -999;
      for (const t of this.traffic) {
        if (t.kind === 'cargo_truck') continue;
        const d = Math.hypot(t.x - bot.x, t.y - bot.y);
        const val = t.value * 1.3 - d * 0.25;
        if (val > bestScore) {
          bestScore = val;
          best = t;
        }
      }

      if (best) {
        bot.botTargetX = Math.max(90, Math.min(width - 90, best.x));
        bot.botTargetY = best.y;
      } else {
        bot.botTargetX = width * 0.45;
        bot.botTargetY = height * 0.5;
      }

      if (!bot.charging && Math.random() < (difficulty === 'bot_hard' ? 0.28 : 0.14)) {
        bot.botHoldTarget = difficulty === 'bot_hard' ? 0.84 : 0.78;
      }
    }

    const dx = bot.botTargetX - bot.x;
    const dy = bot.botTargetY - bot.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 8 ? dx / dist : 0;
    const throttleY = dist > 8 ? -dy / dist : 0;
    bot.vx += steerX * 620 * dt;
    bot.vy += -throttleY * 620 * dt;

    if (bot.botHoldTarget > 0) {
      if (bot.charge < bot.botHoldTarget) {
        this.input.setBotState(botId, true);
      } else {
        bot.botHoldTarget = 0;
        this.input.setBotState(botId, false);
      }
    } else {
      this.input.setBotState(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 5 Shared Neon Skyway Lanes
    ctx.save();
    ctx.strokeStyle = theme.neonLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 14]);
    for (let y = 115; y < height - 60; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    for (const s of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const t of this.traffic) {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.kind === 'cargo_truck') {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-24, -13, 48, 26, 6);
        ctx.fill();
        ctx.stroke();
      } else if (t.kind === 'hyper_core') {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Render 2.5D Cyber-Hovercars
    const sorted = Array.from(this.cars.values()).sort((a, b) => a.y - b.y);
    for (const c of sorted) {
      const cfg = this.players.find(p => p.id === c.id);
      const color = cfg?.color || '#38bdf8';

      ctx.save();
      ctx.translate(c.x, c.y);

      if (c.charging) {
        const sweet = c.charge >= 0.72 && c.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI * 0.5, -Math.PI * 0.5 + c.charge * Math.PI * 2);
        ctx.stroke();
      }

      // Hovercar Chassis
      ctx.fillStyle = color;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-22, -12, 44, 24, 10);
      ctx.fill();
      ctx.stroke();

      const mood = c.spinoutTimer > 0 ? 'shocked' : c.charging ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, cfg?.id || 1, 0, -2, 13, mood, 45 - this.roundTimer, 0);
      ctx.restore();
    }

    this.renderFloatingTexts(ctx);

    // Top Header Banner
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 54, 520, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: WEAVE SKYWAY 2D & DRAFT • TAP: JOLT • HOLD (72-98%): HYPER-NITRO WARP SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const c = this.cars.get(p.id);
      if (!c) return;
      const isLeft = idx % 2 === 0;
      const cardX = isLeft ? 18 : width - 148;
      const cardY = height - 128 - Math.floor(idx / 2) * 56;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = '800 12px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '900 15px "Outfit", sans-serif';
      ctx.fillText(`${c.score} PTS`, cardX + 10, cardY + 38);
      ctx.restore();
    });

    // Bottom-Left Theme Pill
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🎨 ${theme.name} [T]`, 105, height - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getScores();
    const rankings = Array.from(scores.entries())
      .map(([playerId, score]) => ({ playerId, score: Math.floor(score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => { r.place = idx + 1; });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} owned the Neo-Tokyo Cyberway!` : 'Photo finish!',
    };
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.cars.forEach((c, id) => scores.set(id, c.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.cars.forEach(c => {
      if (c.score > bestScore) {
        bestScore = c.score;
        bestId = c.id;
        tie = false;
      } else if (c.score === bestScore) {
        tie = true;
      }
    });
    return tie ? null : bestId;
  }

  public cleanup(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size = 16): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -38, size });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
      ctx.font = `900 ${ft.size}px "Outfit", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }
}
