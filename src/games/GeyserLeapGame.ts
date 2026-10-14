import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

interface GeyserTheme {
  id: string;
  name: string;
  waterTop: string;
  waterBottom: string;
  stoneTop: string;
  stoneRim: string;
  accent: string;
}

const THEMES: GeyserTheme[] = [
  {
    id: 'blue_lagoon',
    name: 'Icelandic Blue Lagoon',
    waterTop: '#083344',
    waterBottom: '#042f2e',
    stoneTop: '#475569',
    stoneRim: '#38bdf8',
    accent: '#22d3ee',
  },
  {
    id: 'yellowstone_prism',
    name: 'Grand Prismatic Spring',
    waterTop: '#0c4a6e',
    waterBottom: '#431407',
    stoneTop: '#78350f',
    stoneRim: '#f59e0b',
    accent: '#fb923c',
  },
  {
    id: 'rotorua_emerald',
    name: 'Rotorua Sulphur Basin',
    waterTop: '#064e3b',
    waterBottom: '#022c22',
    stoneTop: '#334155',
    stoneRim: '#34d399',
    accent: '#10b981',
  },
];

interface ThermalStone {
  id: number;
  x: number;
  y: number;
  radius: number;
  state: 'calm' | 'warning' | 'erupting' | 'golden_crown';
  timer: number;
}

interface FireOpal {
  id: number;
  x: number;
  y: number;
  isCrown: boolean;
  pulse: number;
}

interface FxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FoxJumper {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  zHeight: number;
  vz: number;
  angle: number;
  radius: number;
  score: number;
  combo: number;
  isHolding: boolean;
  charge: number;
  overchargeTimer: number;
  surfTimer: number;
  crownAccum: number;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

export class GeyserLeapGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public hoppers: Map<PlayerId, FoxJumper> = new Map();
  private stones: ThermalStone[] = [];
  private opals: FireOpal[] = [];
  private fxParticles: FxParticle[] = [];
  private nextOpalId = 1;
  private opalSpawnTimer = 1.2;

  private themeIndex = 0;
  private elapsed = 0;
  private hitStopTimer = 0;
  private screenShake = 0;
  private suddenDeath = false;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
  }

  public get currentMapName(): string {
    return THEMES[this.themeIndex]?.name ?? 'Icelandic Blue Lagoon';
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    this.bindThemeControls();
  }

  private bindThemeControls(): void {
    if (typeof window === 'undefined') return;
    this.cleanupThemeControls();

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

    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      const px = 20;
      const py = canvas.height - 44;
      const pw = 170;
      const ph = 32;
      if (cx >= px && cx <= px + pw && cy >= py && cy <= py + ph) {
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
        this.audio.playTap();
      }
    };

    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('mousedown', this.clickHandler);
  }

  private cleanupThemeControls(): void {
    if (typeof window === 'undefined') return;
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('mousedown', this.clickHandler);
      this.clickHandler = null;
    }
  }

  public cleanup(): void {
    this.cleanupThemeControls();
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.elapsed = 0;
    this.hitStopTimer = 0;
    this.screenShake = 0;
    this.suddenDeath = false;
    this.stones = [];
    this.opals = [];
    this.fxParticles = [];
    this.hoppers.clear();

    // 15 shared thermal stepping stones in 3 rows of 5
    const cols = 5;
    const rows = 3;
    let id = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = width * (0.16 + c * 0.17) + (r % 2 === 1 ? 18 : -18);
        const sy = height * (0.28 + r * 0.23);
        const isCenter = r === 1 && c === 2;
        this.stones.push({
          id: id++,
          x: sx,
          y: sy,
          radius: 42,
          state: isCenter ? 'golden_crown' : 'calm',
          timer: 1.5 + Math.random() * 2.5,
        });
      }
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startStone = this.stones[idx % this.stones.length];
      this.hoppers.set(p.id, {
        id: p.id,
        x: startStone.x,
        y: startStone.y,
        vx: 0,
        vy: 0,
        zHeight: 0,
        vz: 0,
        angle: 0,
        radius: 21,
        score: 0,
        combo: 1,
        isHolding: false,
        charge: 0,
        overchargeTimer: 0,
        surfTimer: 0,
        crownAccum: 0,
        botTimer: 0.2 + Math.random() * 0.2,
        botTargetX: startStone.x,
        botTargetY: startStone.y,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 4; i++) {
      this.spawnOpal();
    }
  }

  private triggerScreenShake(amount: number): void {
    this.screenShake = Math.min(18, Math.max(this.screenShake, amount));
  }

  private applyScreenShake(ctx: CanvasRenderingContext2D): void {
    if (this.screenShake > 0.2) {
      const dx = (Math.random() - 0.5) * this.screenShake * 1.6;
      const dy = (Math.random() - 0.5) * this.screenShake * 1.6;
      ctx.translate(dx, dy);
    }
  }

  private emitFx(x: number, y: number, color: string, count = 12, speed = 150): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.fxParticles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.3,
      });
    }
  }

  private spawnOpal(): void {
    if (this.stones.length === 0) return;
    const st = this.stones[Math.floor(Math.random() * this.stones.length)];
    this.opals.push({
      id: this.nextOpalId++,
      x: st.x + (Math.random() - 0.5) * 20,
      y: st.y + (Math.random() - 0.5) * 20,
      isCrown: Math.random() < 0.28,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  private getMaxScore(): number {
    let max = 0;
    this.hoppers.forEach((h) => {
      if (h.score > max) max = h.score;
    });
    return max;
  }

  private isUnderdog(h: FoxJumper): boolean {
    return this.getMaxScore() - h.score >= 150;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    const safeDt = Math.min(0.05, dt);
    this.elapsed += safeDt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - safeDt * 28);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= safeDt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - safeDt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.cleanupThemeControls();
      return;
    }

    if (this.roundTimer <= 12.0 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.triggerScreenShake(11);
      this.audio.playExplosion();
      this.addFloatingText(width * 0.5, height * 0.16, '⚡ SUDDEN DEATH: SUPER-GEYSER ERUPTION! ⚡', '#facc15', 22);
    }

    // Update Thermal Stones
    for (const st of this.stones) {
      st.timer -= safeDt;
      if (st.timer <= 0) {
        if (st.state === 'calm') {
          const roll = Math.random();
          if (roll < 0.25) {
            st.state = 'golden_crown';
            st.timer = 4.2;
          } else if (roll < (this.suddenDeath ? 0.8 : 0.58)) {
            st.state = 'warning';
            st.timer = 1.05;
          } else {
            st.timer = 2.0 + Math.random() * 1.5;
          }
        } else if (st.state === 'warning') {
          st.state = 'erupting';
          st.timer = 1.1;
          this.audio.playTone(190, 0.18, 'triangle');
          this.emitFx(st.x, st.y, '#e0f2fe', 12, 170);
        } else {
          st.state = 'calm';
          st.timer = 1.8 + Math.random() * 2.0;
        }
      }
    }

    this.opalSpawnTimer -= safeDt;
    if (this.opalSpawnTimer <= 0) {
      this.opalSpawnTimer = 1.7;
      if (this.opals.length < 6) {
        this.spawnOpal();
      }
    }

    this.updateBots(safeDt, width, height);

    // Update Fox Hoppers
    this.hoppers.forEach((h) => {
      const p = this.getPlayer(h.id);
      if (h.overchargeTimer > 0) h.overchargeTimer = Math.max(0, h.overchargeTimer - safeDt);
      if (h.surfTimer > 0) h.surfTimer = Math.max(0, h.surfTimer - safeDt);

      const underdog = this.isUnderdog(h);
      const speedMult = (underdog ? 1.18 : 1.0) * (h.overchargeTimer > 0 ? 0.55 : 1.0);

      if (p && !p.type.startsWith('bot_')) {
        const move = { x: this.input.getSteer(h.id), y: -this.input.getThrottle(h.id) };
        if (Math.hypot(move.x, move.y) > 0.08) {
          h.vx += move.x * 760 * speedMult * safeDt;
          h.vy += move.y * 760 * speedMult * safeDt;
          h.angle = Math.atan2(move.y, move.x);
        }

        const holding = this.input.isActionPressed(h.id) || this.input.isPressed(h.id);
        if (holding && h.overchargeTimer <= 0) {
          h.isHolding = true;
          h.charge = Math.min(1.15, h.charge + safeDt * 0.85);
          if (h.charge >= 1.05) {
            this.triggerSteamScald(h);
          }
        } else if (h.isHolding) {
          h.isHolding = false;
          if (h.charge >= 0.72 && h.charge <= 0.98) {
            this.executeGeyserSurfLeap(h);
          } else {
            this.executeFoxHop(h);
          }
          h.charge = 0;
        } else if (this.input.justPressed(h.id) || this.input.justAction(h.id)) {
          this.executeFoxHop(h);
        }
      }

      if (h.zHeight > 0 || h.vz !== 0) {
        h.zHeight += h.vz * safeDt;
        h.vz -= 900 * safeDt;
        if (h.zHeight <= 0) {
          h.zHeight = 0;
          h.vz = 0;
          this.emitFx(h.x, h.y + 8, '#bae6fd', 6, 100);
        }
      }

      h.x += h.vx * safeDt;
      h.y += h.vy * safeDt;
      const damp = Math.pow(0.09, safeDt);
      h.vx *= damp;
      h.vy *= damp;

      // Keep inside basin bounds
      h.x = Math.max(60, Math.min(width - 60, h.x));
      h.y = Math.max(110, Math.min(height - 65, h.y));

      // Check stone underneath
      const onStone = this.stones.find((s) => Math.hypot(s.x - h.x, s.y - h.y) < s.radius + 6);
      if (onStone) {
        if (onStone.state === 'golden_crown') {
          h.crownAccum += safeDt * 24;
          if (h.crownAccum >= 12) {
            const pts = Math.floor(h.crownAccum);
            h.score += pts;
            h.crownAccum -= pts;
          }
        } else if (onStone.state === 'erupting' && h.zHeight < 18 && h.surfTimer <= 0) {
          if (!underdog) {
            h.vz = 420;
            h.overchargeTimer = 1.0;
            h.combo = 1;
            h.score = Math.max(0, h.score - 25);
            this.triggerScreenShake(8);
            this.audio.playExplosion();
            this.emitFx(h.x, h.y, '#fb923c', 18, 200);
            this.addFloatingText(h.x, h.y - 28, '🌋 GEYSER SCALD! -25', '#fb923c', 16);
          } else {
            h.vz = 360;
            h.score += 40;
            this.addFloatingText(h.x, h.y - 28, '🛡️ THERMAL RIDE! +40', '#38bdf8', 15);
          }
        }
      }
    });

    // Elastic Fox-to-Fox Collisions (m1*v1 + m2*v2)
    const list = Array.from(this.hoppers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal < 0) {
            const impulse = -velAlongNormal * 1.25;
            a.vx -= nx * (impulse + 145);
            a.vy -= ny * (impulse + 145);
            b.vx += nx * (impulse + 145);
            b.vy += ny * (impulse + 145);
            this.audio.playBounce();
            this.emitFx((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#ffffff', 10, 140);
          }
        }
      }
    }

    // Update Fire Opals
    for (let i = this.opals.length - 1; i >= 0; i--) {
      const op = this.opals[i];
      op.pulse += safeDt * 5;
      let picked = false;
      this.hoppers.forEach((h) => {
        if (picked) return;
        if (Math.hypot(h.x - op.x, h.y - op.y) < h.radius + 16) {
          picked = true;
          const basePts = op.isCrown ? 90 : 45;
          const mult = Math.min(4, h.combo);
          const total = basePts * mult;
          h.score += total;
          h.combo = Math.min(4, h.combo + 1);
          this.audio.playScore();
          const col = op.isCrown ? '#facc15' : '#22d3ee';
          this.emitFx(op.x, op.y, col, 16, 170);
          this.addFloatingText(
            op.x,
            op.y - 24,
            op.isCrown ? `💎 GOLDEN GEYSER OPAL! +${total}` : `✨ SILICA GEM! +${total}`,
            col,
            16
          );
        }
      });
      if (picked) {
        this.opals.splice(i, 1);
      }
    }

    // Update FX particles
    for (let i = this.fxParticles.length - 1; i >= 0; i--) {
      const p = this.fxParticles[i];
      p.life += safeDt;
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.fxParticles.splice(i, 1);
      }
    }
  }

  private executeFoxHop(h: FoxJumper): void {
    if (h.zHeight <= 4) {
      h.vz = 340;
      h.vx += Math.cos(h.angle) * 240;
      h.vy += Math.sin(h.angle) * 240;
      this.audio.playWhoosh();
      this.emitFx(h.x, h.y, '#e0f2fe', 8, 120);
    }
  }

  private executeGeyserSurfLeap(h: FoxJumper): void {
    h.surfTimer = 0.9;
    h.vz = 420;
    h.vx += Math.cos(h.angle) * 340;
    h.vy += Math.sin(h.angle) * 340;
    h.score += 85;
    h.combo = Math.min(4, h.combo + 1);

    this.hitStopTimer = 0.045;
    this.triggerScreenShake(11);
    this.audio.playBoost();
    this.emitFx(h.x, h.y, '#facc15', 22, 240);
    this.addFloatingText(h.x, h.y - 34, '🦊 GEYSER-SURF SUPER LEAP! +85', '#facc15', 18);

    // Steam-Vent Shunt blasts nearby rival foxes into erupting geysers!
    const underdog = this.isUnderdog(h);
    this.hoppers.forEach((other) => {
      if (other.id === h.id) return;
      const dx = other.x - h.x;
      const dy = other.y - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 190) {
        const pushA = Math.atan2(dy, dx);
        const force = underdog ? 600 : 480;
        other.vx += Math.cos(pushA) * force;
        other.vy += Math.sin(pushA) * force;
        h.score += 70;
        this.addFloatingText(other.x, other.y - 26, '💨 STEAM-VENT SHUNT! +70', '#22d3ee', 16);
      }
    });
  }

  private triggerSteamScald(h: FoxJumper): void {
    h.isHolding = false;
    h.charge = 0;
    h.overchargeTimer = 1.15;
    h.combo = 1;
    this.triggerScreenShake(6);
    this.audio.playBuzzer();
    this.emitFx(h.x, h.y, '#ef4444', 14, 150);
    this.addFloatingText(h.x, h.y - 28, '⚠️ STEAM OVERPRESSURE!', '#ef4444', 15);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const h = this.hoppers.get(botId);
    if (!h || h.overchargeTimer > 0) return;

    h.botTimer -= dt;
    if (h.botTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.28 : 0.42;
      h.botTimer = delay + Math.random() * 0.1;

      if (this.opals.length > 0) {
        let bestOp = this.opals[0];
        let bestDist = 9999;
        for (const op of this.opals) {
          const d = Math.hypot(op.x - h.x, op.y - h.y);
          if (d < bestDist) {
            bestDist = d;
            bestOp = op;
          }
        }
        h.botTargetX = bestOp.x;
        h.botTargetY = bestOp.y;
      } else {
        const crown = this.stones.find((s) => s.state === 'golden_crown');
        const safe = this.stones.find((s) => s.state === 'calm');
        const target = crown ?? safe ?? this.stones[0];
        if (target) {
          h.botTargetX = target.x;
          h.botTargetY = target.y;
        }
      }

      if (!h.isHolding && Math.random() < (difficulty === 'bot_hard' ? 0.45 : 0.25)) {
        h.isHolding = true;
        h.charge = 0;
        h.botHoldTarget = 0.76 + Math.random() * 0.18;
      } else if (Math.random() < 0.4) {
        this.executeFoxHop(h);
      }
    }

    const dx = h.botTargetX - h.x;
    const dy = h.botTargetY - h.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      const aimA = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.14;
      h.angle = aimA;
      const spd = difficulty === 'bot_hard' ? 700 : difficulty === 'bot_normal' ? 600 : 500;
      h.vx += Math.cos(aimA) * spd * dt;
      h.vy += Math.sin(aimA) * spd * dt;
    }

    if (h.isHolding) {
      h.charge += dt * 0.85;
      if (h.charge >= h.botHoldTarget) {
        h.isHolding = false;
        if (h.charge >= 0.72 && h.charge <= 0.98) {
          this.executeGeyserSurfLeap(h);
        } else {
          this.executeFoxHop(h);
        }
        h.charge = 0;
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.hoppers.forEach((h, id) => scores.set(id, Math.floor(h.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.hoppers.entries())
      .map(([playerId, h]) => ({ playerId, score: Math.floor(h.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    const winnerName = winnerId ? this.getPlayer(winnerId)?.name ?? winnerId : 'Nobody';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winnerName} surfed the Volcanic Geysers & claimed the Fire Opals!`,
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex] ?? THEMES[0];

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Geothermal Lagoon Water Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.waterTop);
    bgGrad.addColorStop(1, theme.waterBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Render 15 2.5D Thermal Stepping Stones
    for (const st of this.stones) {
      ctx.save();
      ctx.translate(st.x, st.y);

      // 3D Stone Base Shadow
      ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 10, st.radius, st.radius * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stone Top
      ctx.fillStyle =
        st.state === 'golden_crown'
          ? '#fef08a'
          : st.state === 'erupting'
          ? '#fb923c'
          : st.state === 'warning'
          ? '#fdba74'
          : theme.stoneTop;
      ctx.beginPath();
      ctx.ellipse(0, 0, st.radius, st.radius * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle =
        st.state === 'golden_crown'
          ? '#facc15'
          : st.state === 'erupting'
          ? '#ef4444'
          : theme.stoneRim;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Center Vent Crater
      ctx.fillStyle = st.state === 'erupting' ? '#ffffff' : '#0f172a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (st.state === 'erupting') {
        const plumeH = 52 + Math.sin(this.elapsed * 24) * 10;
        const pGrad = ctx.createLinearGradient(0, 0, 0, -plumeH);
        pGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        pGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-22, -plumeH);
        ctx.lineTo(22, -plumeH);
        ctx.lineTo(14, 0);
        ctx.closePath();
        ctx.fill();
      } else if (st.state === 'golden_crown') {
        ctx.fillStyle = '#854d0e';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑 +24/s', 0, 4);
      }

      ctx.restore();
    }

    // 3. Render Fire Opals & Silica Gems
    for (const op of this.opals) {
      ctx.save();
      ctx.translate(op.x, op.y + Math.sin(op.pulse) * 4);
      ctx.fillStyle = op.isCrown ? '#facc15' : '#22d3ee';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, op.isCrown ? 13 : 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render 2.5D Arctic Fox Hoppers
    this.hoppers.forEach((h, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const underdog = this.isUnderdog(h);

      ctx.save();
      ctx.translate(h.x, h.y);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 12, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(0, -h.zHeight);

      if (h.isHolding && h.charge > 0.04) {
        const ringR = h.radius + 11;
        const inSweet = h.charge >= 0.72 && h.charge <= 0.98;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.5 + 0.72 * Math.PI * 2, -Math.PI * 0.5 + 0.98 * Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = inSweet ? '#facc15' : color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.min(1, h.charge) * Math.PI * 2);
        ctx.stroke();
      }

      if (underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, h.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 2, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const mood: CharacterMood =
        h.overchargeTimer > 0
          ? 'shocked'
          : h.surfTimer > 0 || h.zHeight > 10
          ? 'triumph'
          : h.isHolding
          ? 'focused'
          : 'happy';
      this.drawPlayerMascot(ctx, pId, 0, -2, 15, mood, this.elapsed, 0);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(h.score)}`, 0, -28);

      ctx.restore();
    });

    // 5. FX Particles
    for (const p of this.fxParticles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.renderFloatingTexts(ctx);

    // 6. Top Control Banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 295, 12, 590, 30, 15);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🌋 Steer: Hop Thermal Stones • Tap: Vault Geyser • Hold (72–98%): Geyser-Surf Super Leap!',
      width * 0.5,
      31
    );

    // 7. Clickable Bottom-Left Theme Pill
    const px = 20;
    const py = height - 44;
    const pw = 170;
    const ph = 32;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 ${theme.name} [T]`, px + pw * 0.5, py + 20);

    ctx.restore();
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size = 16): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -38, size });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
      ctx.font = `900 ${ft.size}px "Outfit", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(2, 6, 23, 0.9)";
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

}
