import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type LeafTheme = 'emerald_rose_leaf' | 'autumn_maple' | 'neon_botanical';

interface LeafPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  leafColor: string;
}

const THEMES: Record<LeafTheme, LeafPalette> = {
  emerald_rose_leaf: {
    name: 'Tilting Rose Leaf Sumo',
    bgTop: '#064e3b',
    bgBot: '#022c22',
    leafColor: '#16a34a',
  },
  autumn_maple: {
    name: 'Crimson Maple Canopy',
    bgTop: '#451a03',
    bgBot: '#1c1917',
    leafColor: '#ea580c',
  },
  neon_botanical: {
    name: 'Cyber Botanical Leaf',
    bgTop: '#090d16',
    bgBot: '#1e1b4b',
    leafColor: '#10b981',
  },
};

const THEME_KEYS: LeafTheme[] = ['emerald_rose_leaf', 'autumn_maple', 'neon_botanical'];

interface RollingAphid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  royalGolden: boolean;
}

interface LadybugSumo {
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
  flutterTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class LadybugAphidHuntGame extends BaseGame {
  private ladybugs: LadybugSumo[] = [];
  private aphids: RollingAphid[] = [];
  private leafTiltX = 0;
  private leafTiltY = 0;
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

  public reset(width: number, height: number): void {
    this.timeElapsed = 0;
    this.roundTime = 45;
    this.isFinished = false;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.leafTiltX = 0;
    this.leafTiltY = 0;
    this.ladybugs = [];
    this.aphids = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const a = (idx * Math.PI * 2) / Math.max(1, active.length);
      this.ladybugs.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * 0.5 + Math.cos(a) * 90,
        y: height * 0.54 + Math.sin(a) * 70,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        flutterTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 8; i++) {
      this.aphids.push(this.spawnAphid(width, height, i));
    }
  }

  private spawnAphid(width: number, height: number, id: number): RollingAphid {
    const a = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 140;
    return {
      id,
      x: width * 0.5 + Math.cos(a) * d,
      y: height * 0.54 + Math.sin(a) * d * 0.72,
      vx: 0,
      vy: 0,
      royalGolden: Math.random() < 0.3,
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(l: LadybugSumo, text: string): void {
    l.calloutText = text;
    l.calloutTimer = 1.15;
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
      this.ladybugs.forEach((l) => this.showCallout(l, 'TILTING LEAF 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    const cx = width * 0.5;
    const cy = height * 0.54;

    // Calculate Dynamic Leaf Tilt from player weight distribution!
    let tx = 0;
    let ty = 0;
    for (const l of this.ladybugs) {
      tx += (l.x - cx) / 240;
      ty += (l.y - cy) / 180;
    }
    this.leafTiltX += (tx - this.leafTiltX) * Math.min(1, dt * 4);
    this.leafTiltY += (ty - this.leafTiltY) * Math.min(1, dt * 4);

    // Aphids roll with the tilting leaf!
    for (let i = 0; i < this.aphids.length; i++) {
      const ap = this.aphids[i];
      ap.vx += this.leafTiltX * 140 * dt;
      ap.vy += this.leafTiltY * 140 * dt;
      ap.vx *= Math.pow(0.2, dt);
      ap.vy *= Math.pow(0.2, dt);
      ap.x += ap.vx * dt;
      ap.y += ap.vy * dt;
      if (Math.hypot((ap.x - cx) / 250, (ap.y - cy) / 185) > 1.0) {
        this.aphids[i] = this.spawnAphid(width, height, ap.id);
      }
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.ladybugs.map((l) => l.score));

    for (const l of this.ladybugs) {
      l.underdog = maxScore - l.score >= 150;
      if (l.calloutTimer > 0) l.calloutTimer = Math.max(0, l.calloutTimer - dt);
      if (l.flutterTimer > 0) l.flutterTimer = Math.max(0, l.flutterTimer - dt);

      const sx = this.input.getSteer(l.id);
      const sy = this.input.getThrottle(l.id);
      const isHold = this.input.isActionPressed(l.id) || this.input.isPressed(l.id);

      const accel = 1400 * (l.underdog ? 1.15 : 1.0);
      l.vx += (sx * accel + this.leafTiltX * 210) * dt;
      l.vy += ((sy !== 0 ? -sy : 0) * accel + this.leafTiltY * 210) * dt;
      l.vx *= Math.pow(0.05, dt);
      l.vy *= Math.pow(0.05, dt);

      // Hold-to-charge Shell-Sumo Ram & Leaf-Edge Knockoff Shunt (72%-98% Sweet Spot)
      if (isHold) {
        l.holding = true;
        l.charge = Math.min(1, l.charge + dt * 0.92);
      } else if (l.holding) {
        const sweet = l.charge >= 0.72 && l.charge <= 0.98;
        if (sweet) {
          l.flutterTimer = 2.0;
          l.score += 85;
          l.combo = Math.min(4, l.combo + 1);
          this.showCallout(l, 'SHELL SUMO SLAM +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 12);

          for (const other of this.ladybugs) {
            if (other.id !== l.id && Math.hypot(other.x - l.x, other.y - l.y) < 175) {
              const dx = other.x - l.x;
              const dy = other.y - l.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 620;
              other.vy += (dy / d) * 620;
              l.score += 70;
              this.showCallout(l, 'LEAF SUMO SHUNT +70!');
              this.audio.playBounce();
            }
          }
        }
        l.holding = false;
        l.charge = 0;
      }

      l.x += l.vx * dt;
      l.y += l.vy * dt;

      // Falling off tilting rose leaf!
      if (Math.hypot((l.x - cx) / 250, (l.y - cy) / 185) > 1.02) {
        l.x = cx;
        l.y = cy;
        l.vx = 0;
        l.vy = 0;
        l.combo = 1;
        this.showCallout(l, 'LEAF FLUTTER RECOVERY!');
        this.audio.playBounce();
      }

      for (let i = 0; i < this.aphids.length; i++) {
        const ap = this.aphids[i];
        if (Math.hypot(l.x - ap.x, l.y - ap.y) < 32) {
          const base = ap.royalGolden ? 95 : 50;
          const pts = base * l.combo * (this.suddenDeath ? 2 : 1);
          l.score += pts;
          l.combo = Math.min(4, l.combo + 1);
          this.showCallout(l, ap.royalGolden ? `ROYAL APHID +${pts}!` : `APHID +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(ap.x, ap.y, '#4ade80', 10);
          this.aphids[i] = this.spawnAphid(width, height, ap.id);
        }
      }
    }

    // Ladybug Sumo Bumping
    for (let i = 0; i < this.ladybugs.length; i++) {
      for (let j = i + 1; j < this.ladybugs.length; j++) {
        const a = this.ladybugs[i];
        const b = this.ladybugs[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 38) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * 340;
          a.vy -= ny * 340;
          b.vx += nx * 340;
          b.vy += ny * 340;
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
    const bot = this.ladybugs.find((l) => l.id === botId);
    if (!bot) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const best = this.aphids.find((a) => a.royalGolden) ?? this.aphids[0];
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

    // Giant Tilting Rose Leaf Arena
    ctx.save();
    ctx.translate(width * 0.5 + this.leafTiltX * 14, height * 0.54 + this.leafTiltY * 14);
    ctx.fillStyle = pal.leafColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 250, 185, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // Aphids
    for (const ap of this.aphids) {
      ctx.fillStyle = ap.royalGolden ? '#fbbf24' : '#bbf7d0';
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, ap.royalGolden ? 15 : 11, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ladybugs
    for (const l of this.ladybugs) {
      ctx.save();
      ctx.translate(l.x, l.y);
      if (l.holding && l.charge > 0.05) {
        const sweet = l.charge >= 0.72 && l.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + l.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = l.flutterTimer > 0 ? 'triumph' : l.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, l.id, 0, 0, 16, mood, this.timeElapsed, l.vx * 0.0005);
      if (l.calloutTimer > 0 && l.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.calloutText, 0, -28);
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
      `🐞 LADYBUG APHID HUNT • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X LEAF SUMO' : ''}`,
      width * 0.5,
      19
    );

    this.ladybugs.forEach((l, idx) => {
      ctx.fillStyle = l.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${l.id}: ${Math.round(l.score)} pts (${l.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.ladybugs].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((l, i) => ({
        playerId: l.id,
        score: Math.round(l.score),
        place: i + 1,
      })),
      mvpHighlight: `Tilting Leaf Sumo Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
