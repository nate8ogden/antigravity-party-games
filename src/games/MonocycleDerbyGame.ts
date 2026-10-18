import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'crystal_palace' | 'paris_velodrome' | 'neon_gyro';

interface ThemePalette {
  id: ThemeId;
  name: string;
  trackTop: string;
  trackMid: string;
  trackBot: string;
  plankLine: string;
  wheelRim: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'crystal_palace',
    name: 'Crystal Palace Teak Track',
    trackTop: '#2c1e13',
    trackMid: '#422c1d',
    trackBot: '#251910',
    plankLine: 'rgba(254, 240, 138, 0.12)',
    wheelRim: '#f59e0b',
    accent: '#facc15',
  },
  {
    id: 'paris_velodrome',
    name: 'Parisian Brass Velodrome',
    trackTop: '#1e1b4b',
    trackMid: '#312e81',
    trackBot: '#0f172a',
    plankLine: 'rgba(56, 189, 248, 0.14)',
    wheelRim: '#fbbf24',
    accent: '#38bdf8',
  },
  {
    id: 'neon_gyro',
    name: 'Cyber Gyro Drome',
    trackTop: '#160d29',
    trackMid: '#2e1065',
    trackBot: '#090514',
    plankLine: 'rgba(192, 132, 252, 0.16)',
    wheelRim: '#c084fc',
    accent: '#c084fc',
  },
];

interface TrackItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  kind: 'pennant' | 'golden_trophy' | 'oil_slick';
  value: number;
}

interface MonocycleRider {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  wheelSpin: number;
  score: number;
  charging: boolean;
  charge: number;
  gyroTimer: number;
  wipeoutTimer: number;
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

export class MonocycleDerbyGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public riders: Map<PlayerId, MonocycleRider> = new Map();
  private items: TrackItem[] = [];
  private shockwaves: Shockwave[] = [];
  private nextItemId = 1;
  private spawnTimer = 0.75;
  private scrollOffset = 0;
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
    this.riders.clear();
    this.items = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.spawnTimer = 0.6;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.riders.set(p.id, {
        id: p.id,
        x: 130 + idx * 55,
        y: height * 0.34 + idx * 48,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        wheelSpin: 0,
        score: 0,
        charging: false,
        charge: 0,
        gyroTimer: 0,
        wipeoutTimer: 0,
        drafting: false,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.14,
        botTargetX: width * 0.5,
        botTargetY: height * 0.5,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnTrackItem(width, height, true);
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

  private spawnTrackItem(width: number, height: number, randomX = false): void {
    if (this.items.length >= 14) return;
    const roll = Math.random();
    const kind = roll < 0.22 ? 'oil_slick' : roll < 0.42 ? 'golden_trophy' : 'pennant';
    this.items.push({
      id: this.nextItemId++,
      x: randomX ? 160 + Math.random() * (width - 220) : width + 36,
      y: 110 + Math.random() * (height - 195),
      vx: -(180 + Math.random() * 55) * (this.suddenDeath ? 1.25 : 1.0),
      kind,
      value: kind === 'golden_trophy' ? 95 : kind === 'pennant' ? 50 : -25,
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
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: FINAL BELL SPRINT 2X! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.riders.forEach(r => {
      if (r.score > maxScore) maxScore = r.score;
    });
    this.riders.forEach(r => {
      r.underdog = maxScore - r.score >= 150;
    });

    this.updateBots(dt, width, height);

    this.scrollOffset = (this.scrollOffset + dt * 240) % 48;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeath ? 0.52 : 0.82;
      this.spawnTrackItem(width, height, false);
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.x += it.vx * dt;
      if (it.x < -40) this.items.splice(i, 1);
    }

    const list = Array.from(this.riders.values());
    this.riders.forEach(r => {
      r.wheelSpin += dt * (r.gyroTimer > 0 ? 22 : 12);
      if (r.gyroTimer > 0) r.gyroTimer = Math.max(0, r.gyroTimer - dt);

      if (r.z > 0 || r.vz > 0) {
        r.z += r.vz * dt;
        r.vz -= 620 * dt;
        if (r.z <= 0) {
          r.z = 0;
          r.vz = 0;
        }
      }

      r.drafting = false;
      for (const other of list) {
        if (other.id !== r.id && other.x > r.x + 24 && other.x < r.x + 145 && Math.abs(other.y - r.y) < 34) {
          r.drafting = true;
          r.score += Math.round(16 * dt);
          break;
        }
      }

      if (r.wipeoutTimer > 0) {
        r.wipeoutTimer -= dt;
        r.charging = false;
        r.charge = 0;
        r.vx *= 0.9;
        r.vy *= 0.9;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        this.clampRider(r, width, height);
        return;
      }

      const move = { x: this.input.getSteer(r.id), y: -this.input.getThrottle(r.id) };
      const speedMult = (r.underdog ? 1.24 : 1.0) * (r.drafting ? 1.24 : 1.0) * (r.gyroTimer > 0 ? 1.55 : 1.0);
      const accel = 940 * speedMult;

      r.vx += move.x * accel * dt;
      r.vy += move.y * accel * dt;
      r.vx *= 0.87;
      r.vy *= 0.87;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      this.clampRider(r, width, height);

      const pCfg = this.getPlayer(r.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(r.id);

      if ((this.input.justAction(r.id) || (isBot && this.input.justPressed(r.id)) || (!hasSteer && !isBot && this.input.justPressed(r.id))) && r.z <= 0) {
        r.vz = 235;
        this.audio.playWhoosh();
      }

      const holding = this.input.isActionPressed(r.id) || (isBot && this.input.isPressed(r.id)) || (!hasSteer && !isBot && this.input.isPressed(r.id));
      if (holding) {
        r.charging = true;
        r.charge += dt * 0.84;
        if (r.charge >= 1.0) {
          r.charging = false;
          r.charge = 0;
          r.wipeoutTimer = 0.75;
          this.audio.playBuzzer();
          this.addFloatingText(r.x, r.y - 28, '⚠️ OVER-TORQUE WIPEOUT!', '#ef4444', 15);
        }
      } else if (r.charging) {
        const pct = r.charge;
        r.charging = false;
        r.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerGyroOverdrive(r);
        }
      }

      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        if (Math.hypot(it.x - r.x, it.y - r.y) < 30) {
          if (it.kind === 'oil_slick') {
            if (r.z > 8 || r.gyroTimer > 0 || r.underdog) {
              r.score += 45;
              this.audio.playScore();
              this.addFloatingText(it.x, it.y - 22, '🛞 SLICK CLEARED! +45', '#38bdf8', 15);
            } else {
              r.wipeoutTimer = 0.8;
              r.score = Math.max(0, r.score - 25);
              this.audio.playBuzzer();
              this.addFloatingText(it.x, it.y - 22, '🛢️ OIL SPINOUT! -25', '#ef4444', 16);
            }
          } else {
            const pts = Math.round(it.value * (this.suddenDeath ? 2 : 1));
            r.score += pts;
            this.audio.playScore();
            const col = it.kind === 'golden_trophy' ? '#facc15' : '#38bdf8';
            const label = it.kind === 'golden_trophy' ? `🏆 PALACE TROPHY! +${pts}` : `🚩 SPRINT PENNANT! +${pts}`;
            this.particles.emit(it.x, it.y, 12, col);
            this.addFloatingText(it.x, it.y - 22, label, col, 16);
          }
          this.items.splice(i, 1);
        }
      }
    });

    // Rider-to-Rider wheel collisions
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

  private clampRider(r: MonocycleRider, width: number, height: number): void {
    const padX = 56;
    const minY = 98;
    const maxY = height - 62;
    if (r.x < padX) { r.x = padX; r.vx = Math.abs(r.vx) * 0.5; }
    if (r.x > width - padX) { r.x = width - padX; r.vx = -Math.abs(r.vx) * 0.5; }
    if (r.y < minY) { r.y = minY; r.vy = Math.abs(r.vy) * 0.5; }
    if (r.y > maxY) { r.y = maxY; r.vy = -Math.abs(r.vy) * 0.5; }
  }

  private triggerGyroOverdrive(r: MonocycleRider): void {
    r.gyroTimer = 1.45;
    r.vx += 380;
    const pts = this.suddenDeath ? 170 : 85;
    r.score += pts;
    this.audio.playBoost();
    this.shockwaves.push({
      x: r.x,
      y: r.y,
      r: 20,
      maxR: 155,
      alpha: 1,
      color: '#facc15',
    });
    this.particles.emit(r.x, r.y, 24, '#facc15');
    this.addFloatingText(r.x, r.y - 34, `⚙️ GYRO-OVERDRIVE SPRINT! +${pts}`, '#facc15', 18);

    this.riders.forEach(other => {
      if (other.id === r.id) return;
      const dx = other.x - r.x;
      const dy = other.y - r.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150) {
        const nx = dist > 0.01 ? dx / dist : 1;
        const ny = dist > 0.01 ? dy / dist : 0;
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.wipeoutTimer = 0.7;
        r.score += 70;
        this.addFloatingText(other.x, other.y - 28, '🛞 GYRO-WHEEL SHUNT! +70', '#38bdf8', 17);
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
    const bot = this.riders.get(botId);
    if (!bot || bot.wipeoutTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      let best: TrackItem | null = null;
      let bestScore = -999;
      for (const it of this.items) {
        if (it.kind === 'oil_slick') continue;
        const d = Math.hypot(it.x - bot.x, it.y - bot.y);
        const val = it.value * 1.3 - d * 0.25;
        if (val > bestScore) {
          bestScore = val;
          best = it;
        }
      }

      if (best) {
        bot.botTargetX = Math.max(90, Math.min(width - 90, best.x));
        bot.botTargetY = best.y;
      } else {
        bot.botTargetX = width * 0.48;
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
    bg.addColorStop(0, theme.trackTop);
    bg.addColorStop(0.55, theme.trackMid);
    bg.addColorStop(1, theme.trackBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Velodrome Banking Plank Lines
    ctx.save();
    ctx.strokeStyle = theme.plankLine;
    ctx.lineWidth = 1.5;
    for (let y = 95; y < height - 50; y += 22) {
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

    for (const it of this.items) {
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.kind === 'oil_slick') {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (it.kind === 'golden_trophy') {
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

    // Render 2.5D Gyroscopic Monocycles
    const sorted = Array.from(this.riders.values()).sort((a, b) => a.y - b.y);
    for (const r of sorted) {
      const cfg = this.players.find(p => p.id === r.id);

      ctx.save();
      ctx.translate(r.x, r.y - r.z);

      if (r.charging) {
        const sweet = r.charge >= 0.72 && r.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI * 0.5, -Math.PI * 0.5 + r.charge * Math.PI * 2);
        ctx.stroke();
      }

      // Outer 6-Foot Brass Wheel
      ctx.strokeStyle = r.gyroTimer > 0 ? '#facc15' : theme.wheelRim;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();

      const mood = r.wipeoutTimer > 0 ? 'shocked' : r.charging ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, cfg?.id || 1, 0, 0, 13, mood, 45 - this.roundTimer, 0);
      ctx.restore();
    }

    this.renderFloatingTexts(ctx);

    // Top Header Banner
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 54, 520, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: CARVE VELODROME & DRAFT • TAP: GYRO HOP • HOLD (72-98%): GYRO-OVERDRIVE SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const r = this.riders.get(p.id);
      if (!r) return;
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
      ctx.fillText(`${r.score} PTS`, cardX + 10, cardY + 38);
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
      mvpHighlight: winnerId ? `${winnerId} ruled the Crystal Palace Velodrome!` : 'Photo finish!',
    };
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.riders.forEach((r, id) => scores.set(id, r.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.riders.forEach(r => {
      if (r.score > bestScore) {
        bestScore = r.score;
        bestId = r.id;
        tie = false;
      } else if (r.score === bestScore) {
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
