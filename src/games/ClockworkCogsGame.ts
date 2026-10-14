import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

interface CogTheme {
  id: string;
  name: string;
  bgTop: string;
  bgBottom: string;
  gearPrimary: string;
  gearSecondary: string;
  accent: string;
}

const THEMES: CogTheme[] = [
  {
    id: 'big_ben_brass',
    name: 'Big Ben Brass Works',
    bgTop: '#1c1917',
    bgBottom: '#0c0a09',
    gearPrimary: '#d97706',
    gearSecondary: '#b45309',
    accent: '#facc15',
  },
  {
    id: 'swiss_tourbillon',
    name: 'Geneva Sapphire Movement',
    bgTop: '#0f172a',
    bgBottom: '#020617',
    gearPrimary: '#38bdf8',
    gearSecondary: '#0284c7',
    accent: '#7dd3fc',
  },
  {
    id: 'aether_foundry',
    name: 'Copper Aether Foundry',
    bgTop: '#2e1065',
    bgBottom: '#090514',
    gearPrimary: '#fb7185',
    gearSecondary: '#e11d48',
    accent: '#f472b6',
  },
];

interface PlanetaryGear {
  id: number;
  x: number;
  y: number;
  radius: number;
  angle: number;
  angularVel: number;
  teeth: number;
}

interface MeshJunction {
  id: number;
  x: number;
  y: number;
  state: 'charging' | 'aligned' | 'golden_tourbillon' | 'jammed';
  timer: number;
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

interface HorologistEngineer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  score: number;
  combo: number;
  isHolding: boolean;
  charge: number;
  overchargeTimer: number;
  wrenchAnim: number;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

export class ClockworkCogsGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public stations: Map<PlayerId, HorologistEngineer> = new Map();
  private gears: PlanetaryGear[] = [];
  private junctions: MeshJunction[] = [];
  private fxParticles: FxParticle[] = [];

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
    return THEMES[this.themeIndex]?.name ?? 'Big Ben Brass Works';
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
    this.gears = [];
    this.junctions = [];
    this.fxParticles = [];
    this.stations.clear();

    const cx = width * 0.5;
    const cy = height * 0.54;

    // 5 interlocking planetary gears
    const positions = [
      { x: cx, y: cy, r: 92, vel: 0.9, teeth: 16 },
      { x: cx - 155, y: cy - 75, r: 78, vel: -1.1, teeth: 14 },
      { x: cx + 155, y: cy - 75, r: 78, vel: -1.1, teeth: 14 },
      { x: cx - 155, y: cy + 80, r: 78, vel: -1.1, teeth: 14 },
      { x: cx + 155, y: cy + 80, r: 78, vel: -1.1, teeth: 14 },
    ];

    positions.forEach((pos, idx) => {
      this.gears.push({
        id: idx + 1,
        x: pos.x,
        y: pos.y,
        radius: pos.r,
        angle: idx * 0.6,
        angularVel: pos.vel,
        teeth: pos.teeth,
      });
    });

    // 4 Mesh Junctions between the central gear and outer planetary gears
    for (let i = 1; i < positions.length; i++) {
      const mx = (positions[0].x + positions[i].x) * 0.5;
      const my = (positions[0].y + positions[i].y) * 0.5;
      this.junctions.push({
        id: i,
        x: mx,
        y: my,
        state: i === 1 ? 'golden_tourbillon' : 'aligned',
        timer: 2.5 + i * 0.6,
      });
    }

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const a = (idx / count) * Math.PI * 2;
      const sx = cx + Math.cos(a) * 110;
      const sy = cy + Math.sin(a) * 80;
      this.stations.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        angle: 0,
        radius: 21,
        score: 0,
        combo: 1,
        isHolding: false,
        charge: 0,
        overchargeTimer: 0,
        wrenchAnim: 0,
        botTimer: 0.2 + Math.random() * 0.2,
        botTargetX: sx,
        botTargetY: sy,
        botHoldTarget: 0,
      });
    });
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

  private getMaxScore(): number {
    let max = 0;
    this.stations.forEach((s) => {
      if (s.score > max) max = s.score;
    });
    return max;
  }

  private isUnderdog(s: HorologistEngineer): boolean {
    return this.getMaxScore() - s.score >= 150;
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
      this.addFloatingText(width * 0.5, height * 0.16, '⚡ SUDDEN DEATH: OVERDRIVE ESCAPEMENT! ⚡', '#facc15', 22);
    }

    // Rotate Planetary Gears
    for (const g of this.gears) {
      g.angle += g.angularVel * (this.suddenDeath ? 1.45 : 1.0) * safeDt;
    }

    // Update Mesh Junctions
    for (const j of this.junctions) {
      j.timer -= safeDt;
      if (j.timer <= 0) {
        const roll = Math.random();
        if (roll < (this.suddenDeath ? 0.36 : 0.24)) {
          j.state = 'golden_tourbillon';
          j.timer = 3.2;
        } else if (roll < 0.76) {
          j.state = 'aligned';
          j.timer = 3.6;
        } else if (roll < 0.90) {
          j.state = 'jammed';
          j.timer = 2.0;
        } else {
          j.state = 'charging';
          j.timer = 1.1;
        }
      }
    }

    this.updateBots(safeDt, width, height);

    // Update Engineers
    this.stations.forEach((s) => {
      const p = this.getPlayer(s.id);
      if (s.overchargeTimer > 0) s.overchargeTimer = Math.max(0, s.overchargeTimer - safeDt);
      if (s.wrenchAnim > 0) s.wrenchAnim = Math.max(0, s.wrenchAnim - safeDt * 4);

      // Rotational torque from whichever gear the engineer is standing on
      for (const g of this.gears) {
        const d = Math.hypot(s.x - g.x, s.y - g.y);
        if (d < g.radius && d > 8) {
          const tangent = Math.atan2(s.y - g.y, s.x - g.x) + Math.PI * 0.5;
          const rotForce = g.angularVel * 45;
          s.vx += Math.cos(tangent) * rotForce * safeDt;
          s.vy += Math.sin(tangent) * rotForce * safeDt;
        }
      }

      const underdog = this.isUnderdog(s);
      const speedMult = (underdog ? 1.18 : 1.0) * (s.overchargeTimer > 0 ? 0.55 : 1.0);

      if (p && !p.type.startsWith('bot_')) {
        const move = { x: this.input.getSteer(s.id), y: -this.input.getThrottle(s.id) };
        if (Math.hypot(move.x, move.y) > 0.08) {
          s.vx += move.x * 780 * speedMult * safeDt;
          s.vy += move.y * 780 * speedMult * safeDt;
          s.angle = Math.atan2(move.y, move.x);
        }

        const holding = this.input.isActionPressed(s.id) || this.input.isPressed(s.id);
        if (holding && s.overchargeTimer <= 0) {
          s.isHolding = true;
          s.charge = Math.min(1.15, s.charge + safeDt * 0.85);
          if (s.charge >= 1.05) {
            this.triggerGearGrind(s);
          }
        } else if (s.isHolding) {
          s.isHolding = false;
          if (s.charge >= 0.72 && s.charge <= 0.98) {
            this.executeEscapementOverdrive(s);
          } else {
            this.executeSpannerMesh(s, false);
          }
          s.charge = 0;
        } else if (this.input.justPressed(s.id) || this.input.justAction(s.id)) {
          this.executeSpannerMesh(s, false);
        }
      }

      s.x += s.vx * safeDt;
      s.y += s.vy * safeDt;
      const damp = Math.pow(0.08, safeDt);
      s.vx *= damp;
      s.vy *= damp;

      s.x = Math.max(60, Math.min(width - 60, s.x));
      s.y = Math.max(105, Math.min(height - 65, s.y));
    });

    // Elastic Engineer-to-Engineer Collisions (m1*v1 + m2*v2)
    const list = Array.from(this.stations.values());
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
            this.emitFx((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#facc15', 10, 140);
          }
        }
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

  private executeSpannerMesh(s: HorologistEngineer, isSweetSpot: boolean): void {
    s.wrenchAnim = 1.0;

    let bestJ: MeshJunction | null = null;
    let bestDist = isSweetSpot ? 180 : 95;
    for (const j of this.junctions) {
      const d = Math.hypot(j.x - s.x, j.y - s.y);
      if (d < bestDist) {
        bestDist = d;
        bestJ = j;
      }
    }

    if (!bestJ) {
      s.vx += Math.cos(s.angle) * 240;
      s.vy += Math.sin(s.angle) * 240;
      this.audio.playWhoosh();
      return;
    }

    if (bestJ.state === 'jammed' && !isSweetSpot && !this.isUnderdog(s)) {
      bestJ.state = 'charging';
      bestJ.timer = 1.0;
      s.overchargeTimer = 1.1;
      s.combo = 1;
      s.score = Math.max(0, s.score - 25);
      this.triggerScreenShake(7);
      this.audio.playBuzzer();
      this.emitFx(bestJ.x, bestJ.y, '#ef4444', 16, 180);
      this.addFloatingText(bestJ.x, bestJ.y - 24, '⚙️ GEAR JAM SPARK! -25', '#ef4444', 16);
      return;
    }

    const basePts = bestJ.state === 'golden_tourbillon' ? 95 : 55;
    const mult = Math.min(4, s.combo);
    const total = basePts * mult + (isSweetSpot ? 45 : 0);
    s.score += total;
    s.combo = Math.min(4, s.combo + 1);

    const col = bestJ.state === 'golden_tourbillon' ? '#facc15' : '#38bdf8';
    const label =
      bestJ.state === 'golden_tourbillon'
        ? `⌚ GOLDEN TOURBILLON MESH! +${total}`
        : `⚙️ SYNCHRO MESH! +${total}`;

    bestJ.state = 'charging';
    bestJ.timer = 1.1;

    this.hitStopTimer = 0.04;
    this.triggerScreenShake(7);
    this.audio.playScore();
    this.emitFx(bestJ.x, bestJ.y, col, 18, 190);
    this.addFloatingText(bestJ.x, bestJ.y - 26, label, col, 17);
  }

  private executeEscapementOverdrive(s: HorologistEngineer): void {
    this.executeSpannerMesh(s, true);
    this.hitStopTimer = 0.045;
    this.triggerScreenShake(11);
    this.audio.playBoost();
    this.emitFx(s.x, s.y, '#facc15', 22, 240);

    // Torque-Wave Shunt blasts rival engineers across the gear train!
    const underdog = this.isUnderdog(s);
    this.stations.forEach((other) => {
      if (other.id === s.id) return;
      const dx = other.x - s.x;
      const dy = other.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 190) {
        const pushA = Math.atan2(dy, dx);
        const force = underdog ? 600 : 480;
        other.vx += Math.cos(pushA) * force;
        other.vy += Math.sin(pushA) * force;
        s.score += 70;
        this.addFloatingText(other.x, other.y - 26, '⚙️ TORQUE-WAVE SHUNT! +70', '#facc15', 16);
      }
    });
  }

  private triggerGearGrind(s: HorologistEngineer): void {
    s.isHolding = false;
    s.charge = 0;
    s.overchargeTimer = 1.15;
    s.combo = 1;
    this.triggerScreenShake(6);
    this.audio.playBuzzer();
    this.emitFx(s.x, s.y, '#ef4444', 14, 150);
    this.addFloatingText(s.x, s.y - 28, '⚠️ SPRING OVERWIND!', '#ef4444', 15);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const s = this.stations.get(botId);
    if (!s || s.overchargeTimer > 0) return;

    s.botTimer -= dt;
    if (s.botTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.28 : 0.42;
      s.botTimer = delay + Math.random() * 0.1;

      const targetJ =
        this.junctions.find((j) => j.state === 'golden_tourbillon') ??
        this.junctions.find((j) => j.state === 'aligned') ??
        this.junctions[0];

      if (targetJ) {
        s.botTargetX = targetJ.x;
        s.botTargetY = targetJ.y;
        if (Math.hypot(targetJ.x - s.x, targetJ.y - s.y) < 90 && !s.isHolding) {
          if (Math.random() < (difficulty === 'bot_hard' ? 0.5 : 0.3)) {
            s.isHolding = true;
            s.charge = 0;
            s.botHoldTarget = 0.76 + Math.random() * 0.18;
          } else {
            this.executeSpannerMesh(s, false);
          }
        }
      } else {
        s.botTargetX = width * 0.5;
        s.botTargetY = height * 0.54;
      }
    }

    const dx = s.botTargetX - s.x;
    const dy = s.botTargetY - s.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      const aimA = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.14;
      s.angle = aimA;
      const spd = difficulty === 'bot_hard' ? 720 : difficulty === 'bot_normal' ? 620 : 520;
      s.vx += Math.cos(aimA) * spd * dt;
      s.vy += Math.sin(aimA) * spd * dt;
    }

    if (s.isHolding) {
      s.charge += dt * 0.85;
      if (s.charge >= s.botHoldTarget) {
        s.isHolding = false;
        if (s.charge >= 0.72 && s.charge <= 0.98) {
          this.executeEscapementOverdrive(s);
        } else {
          this.executeSpannerMesh(s, false);
        }
        s.charge = 0;
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.stations.forEach((s, id) => scores.set(id, Math.floor(s.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.stations.entries())
      .map(([playerId, s]) => ({ playerId, score: Math.floor(s.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    const winnerName = winnerId ? this.getPlayer(winnerId)?.name ?? winnerId : 'Nobody';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winnerName} synchronized the Grand Tourbillon Gear Train!`,
    };
  }

  private drawPlanetaryGear(ctx: CanvasRenderingContext2D, g: PlanetaryGear, color: string): void {
    ctx.save();
    ctx.translate(g.x, g.y);

    // 3D Extruded Depth Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.arc(0, 10, g.radius + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(g.angle);

    // Gear Teeth
    ctx.fillStyle = color;
    for (let i = 0; i < g.teeth; i++) {
      const a = (i / g.teeth) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = i % 4 === 0 ? '#facc15' : color;
      ctx.fillRect(-7, -g.radius - 7, 14, 14);
      ctx.restore();
    }

    // Main Gear Plate
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, g.radius - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner cutout ring
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, g.radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex] ?? THEMES[0];

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Clocktower Interior Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Render 5 Interlocking Planetary Brass Gears
    this.gears.forEach((g, idx) => {
      this.drawPlanetaryGear(ctx, g, idx === 0 ? theme.gearPrimary : theme.gearSecondary);
    });

    // 3. Render 4 Mesh Junction Nodes
    for (const j of this.junctions) {
      ctx.save();
      ctx.translate(j.x, j.y);

      const col =
        j.state === 'golden_tourbillon'
          ? '#facc15'
          : j.state === 'aligned'
          ? '#38bdf8'
          : j.state === 'jammed'
          ? '#ef4444'
          : '#64748b';

      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = j.state === 'charging' ? 0 : 14;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        j.state === 'golden_tourbillon'
          ? '⌚ +95'
          : j.state === 'aligned'
          ? '⚙️ +55'
          : j.state === 'jammed'
          ? '⚡ JAM'
          : '•••',
        0,
        4
      );
      ctx.restore();
    }

    // 4. Render Horologist Engineers
    this.stations.forEach((s, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const underdog = this.isUnderdog(s);

      ctx.save();
      ctx.translate(s.x, s.y);

      if (s.isHolding && s.charge > 0.04) {
        const ringR = s.radius + 11;
        const inSweet = s.charge >= 0.72 && s.charge <= 0.98;
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
        ctx.arc(0, 0, ringR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.min(1, s.charge) * Math.PI * 2);
        ctx.stroke();
      }

      if (underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 5, 0, Math.PI * 2);
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
        s.overchargeTimer > 0
          ? 'shocked'
          : s.wrenchAnim > 0
          ? 'triumph'
          : s.isHolding
          ? 'focused'
          : 'happy';
      this.drawPlayerMascot(ctx, pId, 0, -2, 15, mood, this.elapsed, 0);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(s.score)}`, 0, -28);

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
      '⚙️ Steer: Run Planetary Gears • Tap: Mesh Junction • Hold (72–98%): Escapement Overdrive!',
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
