import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type QuarryTheme = 'amber_canyon' | 'crystal_grotto' | 'obsidian_dig';

interface QuarryPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  shaleColor: string;
  amberColor: string;
}

const THEMES: Record<QuarryTheme, QuarryPalette> = {
  amber_canyon: {
    name: 'Badlands Amber Quarry',
    bgTop: '#451a03',
    bgBot: '#1c1917',
    shaleColor: '#78350f',
    amberColor: '#fbbf24',
  },
  crystal_grotto: {
    name: 'Subterranean Geode Dig',
    bgTop: '#1e1b4b',
    bgBot: '#090d16',
    shaleColor: '#334155',
    amberColor: '#38bdf8',
  },
  obsidian_dig: {
    name: 'Volcanic Trilobite Site',
    bgTop: '#27272a',
    bgBot: '#09090b',
    shaleColor: '#52525b',
    amberColor: '#f59e0b',
  },
};

const THEME_KEYS: QuarryTheme[] = ['amber_canyon', 'crystal_grotto', 'obsidian_dig'];

interface FossilNode {
  id: number;
  x: number;
  y: number;
  hp: number;
  kind: 'trilobite' | 'golden_amber' | 'gas_pocket';
}

interface Paleontologist {
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
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class AmberFossilExcavateGame extends BaseGame {
  private diggers: Paleontologist[] = [];
  private nodes: FossilNode[] = [];
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
    this.diggers = [];
    this.nodes = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.diggers.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.3 + idx * 0.2),
        y: height * 0.54,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 12; i++) {
      this.nodes.push(this.spawnNode(width, height, i));
    }
  }

  private spawnNode(width: number, height: number, id: number): FossilNode {
    const r = Math.random();
    return {
      id,
      x: width * (0.15 + Math.random() * 0.7),
      y: height * (0.18 + Math.random() * 0.66),
      hp: 2,
      kind: r < 0.26 ? 'golden_amber' : r < 0.82 ? 'trilobite' : 'gas_pocket',
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(d: Paleontologist, text: string): void {
    d.calloutText = text;
    d.calloutTimer = 1.15;
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
      this.diggers.forEach((d) => this.showCallout(d, 'AMBER RUSH 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.diggers.map((d) => d.score));

    for (const d of this.diggers) {
      d.underdog = maxScore - d.score >= 150;
      if (d.calloutTimer > 0) d.calloutTimer = Math.max(0, d.calloutTimer - dt);
      if (d.stunTimer > 0) {
        d.stunTimer = Math.max(0, d.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(d.id);
      const sy = this.input.getThrottle(d.id);
      const pCfg = this.getPlayer(d.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(d.id);

      const justTap = this.input.justAction(d.id) || (isBot && this.input.justPressed(d.id)) || (!hasSteer && !isBot && this.input.justPressed(d.id));
      const isHold = this.input.isActionPressed(d.id) || (isBot && this.input.isPressed(d.id)) || (!hasSteer && !isBot && this.input.isPressed(d.id));

      const accel = 1350 * (d.underdog ? 1.15 : 1.0);
      d.vx += sx * accel * dt;
      d.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      d.vx *= Math.pow(0.05, dt);
      d.vy *= Math.pow(0.05, dt);
      d.x = Math.max(width * 0.1, Math.min(width * 0.9, d.x + d.vx * dt));
      d.y = Math.max(height * 0.16, Math.min(height * 0.88, d.y + d.vy * dt));

      if (justTap) {
        this.chiselNearby(d, width, height, 65, false);
      }

      // Hold-to-charge Seismic Jackhammer & Quarry Shunt (72%-98% Sweet Spot)
      if (isHold) {
        d.holding = true;
        d.charge = Math.min(1, d.charge + dt * 0.92);
      } else if (d.holding) {
        const sweet = d.charge >= 0.72 && d.charge <= 0.98;
        if (sweet) {
          d.score += 85;
          d.combo = Math.min(4, d.combo + 1);
          this.showCallout(d, 'SEISMIC CHISEL +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 12);
          this.chiselNearby(d, width, height, 155, true);

          for (const other of this.diggers) {
            if (other.id !== d.id && Math.hypot(other.x - d.x, other.y - d.y) < 165) {
              const dx = other.x - d.x;
              const dy = other.y - d.y;
              const dist = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / dist) * 520;
              other.vy += (dy / dist) * 520;
              d.score += 70;
              this.showCallout(d, 'QUARRY TREMOR SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (d.charge > 0.98) {
          d.stunTimer = 0.9;
          d.combo = 1;
          this.showCallout(d, 'CHISEL JAM!');
          this.audio.playStun();
        }
        d.holding = false;
        d.charge = 0;
      }
    }

    // Digger-to-Digger Bumping
    for (let i = 0; i < this.diggers.length; i++) {
      for (let j = i + 1; j < this.diggers.length; j++) {
        const a = this.diggers[i];
        const b = this.diggers[j];
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

  private chiselNearby(d: Paleontologist, width: number, height: number, radius: number, instantBreak: boolean): void {
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (Math.hypot(n.x - d.x, n.y - d.y) < radius) {
        n.hp -= instantBreak ? 2 : 1;
        if (n.hp <= 0) {
          if (n.kind === 'gas_pocket' && !instantBreak && !d.underdog) {
            d.stunTimer = 1.0;
            d.combo = 1;
            this.showCallout(d, 'GAS VENT!');
            this.audio.playStun();
          } else {
            const base = n.kind === 'golden_amber' ? 95 : 50;
            const pts = base * d.combo * (this.suddenDeath ? 2 : 1);
            d.score += pts;
            d.combo = Math.min(4, d.combo + 1);
            this.showCallout(d, n.kind === 'golden_amber' ? `GOLDEN AMBER +${pts}!` : `TRILOBITE +${pts}`);
            this.audio.playScore();
            this.particles.spawnSparks(n.x, n.y, '#fbbf24', 10);
          }
          this.nodes[i] = this.spawnNode(width, height, n.id);
        } else {
          this.audio.playTap();
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
    const bot = this.diggers.find((d) => d.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    let best: FossilNode | null = null;
    let bestD = 9999;
    for (const n of this.nodes) {
      if (n.kind === 'gas_pocket') continue;
      const dist = Math.hypot(n.x - bot.x, n.y - bot.y);
      if (dist < bestD) {
        bestD = dist;
        best = n;
      }
    }

    if (best) {
      const dx = best.x - bot.x;
      const dy = best.y - bot.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      bot.vx += (dx / dist) * 1100 * dt;
      bot.vy += (dy / dist) * 1100 * dt;
    }

    const hold = (bestD < 130 && !bot.holding) || (bot.holding && bot.charge < bot.botChargeGoal);
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

    // Fossil Nodes
    for (const n of this.nodes) {
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.fillStyle = n.kind === 'golden_amber' ? pal.amberColor : n.kind === 'trilobite' ? pal.shaleColor : '#ef4444';
      ctx.beginPath();
      ctx.roundRect(-20, -16, 40, 32, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }

    // Diggers
    for (const d of this.diggers) {
      ctx.save();
      ctx.translate(d.x, d.y);
      if (d.holding && d.charge > 0.05) {
        const sweet = d.charge >= 0.72 && d.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + d.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = d.stunTimer > 0 ? 'shocked' : d.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, d.id, 0, 0, 17, mood, this.timeElapsed, d.vx * 0.0005);
      if (d.calloutTimer > 0 && d.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.calloutText, 0, -28);
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
      `⛏️ AMBER FOSSIL EXCAVATE • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X AMBER' : ''}`,
      width * 0.5,
      19
    );

    this.diggers.forEach((d, idx) => {
      ctx.fillStyle = d.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${d.id}: ${Math.round(d.score)} pts (${d.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.diggers].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((d, i) => ({
        playerId: d.id,
        score: Math.round(d.score),
        place: i + 1,
      })),
      mvpHighlight: `Master Paleontologist ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    if (this.isFinished) return false;
    if (y <= 48) {
      this.themeIdx = (this.themeIdx + 1) % THEME_KEYS.length;
      this.audio.playTap();
      return true;
    }
    const midX = width / 2;
    const active = this.diggers.filter((d) => {
      const pCfg = this.getPlayer(d.id);
      return pCfg && !pCfg.type.startsWith('bot_');
    });
    const digger = active.find((d) => (d.id === 0 ? x < midX : x >= midX)) || active[0];
    if (digger && digger.stunTimer <= 0) {
      const dx = x - digger.x;
      const dy = y - digger.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      digger.vx += (dx / dist) * 440;
      digger.vy += (dy / dist) * 440;
      this.chiselNearby(digger, width, height, 75, false);
      this.audio.playTap();
      return true;
    }
    return false;
  }
}
