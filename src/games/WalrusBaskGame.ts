import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

interface WalrusTheme {
  id: string;
  name: string;
  seaTop: string;
  seaBottom: string;
  iceTop: string;
  iceSide: string;
  iceBorder: string;
  sunZone: string;
  accent: string;
}

const THEMES: WalrusTheme[] = [
  {
    id: 'svalbard_floe',
    name: 'Svalbard Sun Floe',
    seaTop: '#071a2c',
    seaBottom: '#030b14',
    iceTop: '#ecfeff',
    iceSide: '#67e8f9',
    iceBorder: '#a5f3fc',
    sunZone: 'rgba(250, 204, 21, 0.28)',
    accent: '#38bdf8',
  },
  {
    id: 'aurora_shelf',
    name: 'Aurora Borealis Shelf',
    seaTop: '#0f172a',
    seaBottom: '#020617',
    iceTop: '#f0fdf4',
    iceSide: '#34d399',
    iceBorder: '#6ee7b7',
    sunZone: 'rgba(52, 211, 153, 0.28)',
    accent: '#10b981',
  },
  {
    id: 'volcanic_glacier',
    name: 'Icelandic Thermal Berg',
    seaTop: '#1e1b4b',
    seaBottom: '#09071a',
    iceTop: '#fff1f2',
    iceSide: '#fb7185',
    iceBorder: '#fda4af',
    sunZone: 'rgba(251, 146, 60, 0.3)',
    accent: '#f43f5e',
  },
];

interface SeaTreat {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'salmon' | 'golden_crab' | 'urchin_bomb';
  radius: number;
  ttl: number;
  maxTtl: number;
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

interface WalrusFighter {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  score: number;
  combo: number;
  ringOuts: number;
  isHolding: boolean;
  charge: number;
  overchargeTimer: number;
  inWaterTimer: number;
  lungeTimer: number;
  flashTimer: number;
  baskAccum: number;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

export class WalrusBaskGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public walruses: Map<PlayerId, WalrusFighter> = new Map();
  private treats: SeaTreat[] = [];
  private fxParticles: FxParticle[] = [];
  private nextTreatId = 1;
  private treatSpawnTimer = 1.2;

  private themeIndex = 0;
  private elapsed = 0;
  private hitStopTimer = 0;
  private screenShake = 0;
  private suddenDeath = false;

  private floeRadius = 210;
  private sunOffsetX = 0;
  private sunOffsetY = 0;
  private orcaAngle = 0;
  private orcaSplashTimer = 4.5;

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
    return THEMES[this.themeIndex]?.name ?? 'Svalbard Sun Floe';
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
    this.treats = [];
    this.fxParticles = [];
    this.walruses.clear();

    const cx = width * 0.5;
    const cy = height * 0.54;
    this.floeRadius = Math.min(width, height) * 0.37;

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);

    active.forEach((p, idx) => {
      const a = (idx / count) * Math.PI * 2;
      const dist = this.floeRadius * 0.48;
      const sx = cx + Math.cos(a) * dist;
      const sy = cy + Math.sin(a) * dist;
      this.walruses.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        angle: a + Math.PI,
        radius: 24,
        score: 0,
        combo: 1,
        ringOuts: 0,
        isHolding: false,
        charge: 0,
        overchargeTimer: 0,
        inWaterTimer: 0,
        lungeTimer: 0,
        flashTimer: 0,
        baskAccum: 0,
        botTimer: 0.2 + Math.random() * 0.2,
        botTargetX: cx,
        botTargetY: cy,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 4; i++) {
      this.spawnTreat(width, height);
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

  private spawnTreat(width: number, height: number): void {
    const cx = width * 0.5;
    const cy = height * 0.54;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * (this.floeRadius * 0.78);
    const roll = Math.random();
    const type: SeaTreat['type'] =
      roll < 0.22 ? 'golden_crab' : roll < 0.80 ? 'salmon' : 'urchin_bomb';

    this.treats.push({
      id: this.nextTreatId++,
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      vx: (Math.random() - 0.5) * 28,
      vy: (Math.random() - 0.5) * 28,
      type,
      radius: type === 'golden_crab' ? 16 : 14,
      ttl: 11.0,
      maxTtl: 11.0,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  private getMaxScore(): number {
    let max = 0;
    this.walruses.forEach((w) => {
      if (w.score > max) max = w.score;
    });
    return max;
  }

  private isUnderdog(w: WalrusFighter): boolean {
    return this.getMaxScore() - w.score >= 150;
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

    const cx = width * 0.5;
    const cy = height * 0.54;
    const baseRadius = Math.min(width, height) * 0.37;

    if (this.roundTimer <= 12.0) {
      if (!this.suddenDeath) {
        this.suddenDeath = true;
        this.triggerScreenShake(10);
        this.audio.playExplosion();
        this.addFloatingText(cx, cy - 90, '⚡ SUDDEN DEATH: MELTING ICEBERG! ⚡', '#facc15', 22);
      }
      const shrinkRatio = 0.72 + 0.28 * (this.roundTimer / 12.0);
      this.floeRadius = baseRadius * shrinkRatio;
    } else {
      this.floeRadius = baseRadius;
    }

    // Wandering warm sunbeam spot on the iceberg
    this.sunOffsetX = Math.cos(this.elapsed * 0.65) * (this.floeRadius * 0.28);
    this.sunOffsetY = Math.sin(this.elapsed * 0.85) * (this.floeRadius * 0.24);
    const sunX = cx + this.sunOffsetX;
    const sunY = cy + this.sunOffsetY;

    // Circling Orca hazard
    this.orcaAngle = (this.orcaAngle + safeDt * (this.suddenDeath ? 1.45 : 0.95)) % (Math.PI * 2);
    this.orcaSplashTimer -= safeDt;
    if (this.orcaSplashTimer <= 0) {
      this.orcaSplashTimer = this.suddenDeath ? 2.8 : 4.4;
      const ox = cx + Math.cos(this.orcaAngle) * (this.floeRadius + 24);
      const oy = cy + Math.sin(this.orcaAngle) * (this.floeRadius + 24);
      this.emitFx(ox, oy, '#38bdf8', 16, 190);
      this.audio.playTone(190, 0.16, 'triangle');

      // Orca splash wave nudges walruses near that rim inward/sideways
      this.walruses.forEach((w) => {
        if (w.inWaterTimer > 0) return;
        const d = Math.hypot(w.x - ox, w.y - oy);
        if (d < 135) {
          const pushA = Math.atan2(w.y - oy, w.x - ox);
          w.vx += Math.cos(pushA) * 210;
          w.vy += Math.sin(pushA) * 210;
        }
      });
    }

    // Spawn treats
    this.treatSpawnTimer -= safeDt;
    if (this.treatSpawnTimer <= 0) {
      this.treatSpawnTimer = this.suddenDeath ? 1.3 : 2.1;
      if (this.treats.length < 7) {
        this.spawnTreat(width, height);
      }
    }

    this.updateBots(safeDt, width, height);

    // Update players
    this.walruses.forEach((w) => {
      const p = this.getPlayer(w.id);
      if (w.overchargeTimer > 0) w.overchargeTimer = Math.max(0, w.overchargeTimer - safeDt);
      if (w.lungeTimer > 0) w.lungeTimer = Math.max(0, w.lungeTimer - safeDt);
      if (w.flashTimer > 0) w.flashTimer = Math.max(0, w.flashTimer - safeDt);

      if (w.inWaterTimer > 0) {
        w.inWaterTimer -= safeDt;
        if (w.inWaterTimer <= 0) {
          const respawnA = Math.random() * Math.PI * 2;
          w.x = cx + Math.cos(respawnA) * (this.floeRadius * 0.25);
          w.y = cy + Math.sin(respawnA) * (this.floeRadius * 0.25);
          w.vx = 0;
          w.vy = 0;
          w.flashTimer = 0.8;
          this.emitFx(w.x, w.y, '#e0f2fe', 14, 160);
        }
        return;
      }

      const underdog = this.isUnderdog(w);
      const speedMult = (underdog ? 1.18 : 1.0) * (w.overchargeTimer > 0 ? 0.55 : 1.0);

      if (p && !p.type.startsWith('bot_')) {
        const hasSteer = this.input.hasSteer(w.id);
        const move = { x: this.input.getSteer(w.id), y: -this.input.getThrottle(w.id) };
        if (Math.hypot(move.x, move.y) > 0.08) {
          w.vx += move.x * 680 * speedMult * safeDt;
          w.vy += move.y * 680 * speedMult * safeDt;
          w.angle = Math.atan2(move.y, move.x);
        } else if (!hasSteer && this.input.isPressed(w.id) && w.charge === 0) {
          w.vx += Math.cos(w.angle) * 450 * speedMult * safeDt;
          w.vy += Math.sin(w.angle) * 450 * speedMult * safeDt;
        }

        const holding = this.input.isActionPressed(w.id) || (!hasSteer && this.input.isPressed(w.id));
        if (holding && w.overchargeTimer <= 0) {
          w.isHolding = true;
          w.charge = Math.min(1.15, w.charge + safeDt * 0.82);
          if (w.charge >= 1.05) {
            this.triggerOvercharge(w);
          }
        } else if (w.isHolding) {
          w.isHolding = false;
          if (w.charge >= 0.72 && w.charge <= 0.98) {
            this.executeBellyQuakeSlam(w);
          } else {
            this.executeTuskLunge(w, Math.max(0.5, w.charge));
          }
          w.charge = 0;
        } else if (this.input.justAction(w.id) || (!hasSteer && this.input.justPressed(w.id))) {
          this.executeTuskLunge(w, 0.65);
        }
      }

      // Icy friction physics
      w.x += w.vx * safeDt;
      w.y += w.vy * safeDt;
      const damping = Math.pow(0.14, safeDt);
      w.vx *= damping;
      w.vy *= damping;

      // Sunbeam Warmth Crown scoring
      const sunDist = Math.hypot(w.x - sunX, w.y - sunY);
      if (sunDist < this.floeRadius * 0.34) {
        w.baskAccum += safeDt * (this.suddenDeath ? 26 : 18);
        if (w.baskAccum >= 10) {
          const gain = Math.floor(w.baskAccum);
          w.score += gain;
          w.baskAccum -= gain;
        }
      }

      // Ring-out into freezing water
      const distCenter = Math.hypot(w.x - cx, w.y - cy);
      if (distCenter > this.floeRadius + 8) {
        w.inWaterTimer = 1.35;
        w.isHolding = false;
        w.charge = 0;
        w.combo = 1;
        w.score = Math.max(0, w.score - 30);

        // Credit nearest rival for the Sumo Ring-Out
        let nearestRival: WalrusFighter | null = null;
        let bestDist = 260;
        this.walruses.forEach((other) => {
          if (other.id === w.id || other.inWaterTimer > 0) return;
          const d = Math.hypot(other.x - w.x, other.y - w.y);
          if (d < bestDist) {
            bestDist = d;
            nearestRival = other;
          }
        });

        if (nearestRival) {
          const rival = nearestRival as WalrusFighter;
          const bonus = 85 * Math.min(4, rival.combo);
          rival.score += bonus;
          rival.combo = Math.min(4, rival.combo + 1);
          rival.ringOuts++;
          this.addFloatingText(rival.x, rival.y - 34, `🦭 SUMO RING-OUT! +${bonus}`, '#facc15', 18);
        }

        this.triggerScreenShake(9);
        this.hitStopTimer = 0.045;
        this.audio.playExplosion();
        this.emitFx(w.x, w.y, '#38bdf8', 22, 220);
        this.addFloatingText(w.x, w.y - 18, '💦 SPLASH! -30', '#38bdf8', 16);
      }
    });

    // Elastic Walrus-to-Walrus sumo collisions (m1*v1 + m2*v2)
    const list = Array.from(this.walruses.values()).filter((w) => w.inWaterTimer <= 0);
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
            const restitution = 1.25;
            const impulse = -(1 + restitution) * velAlongNormal * 0.5;
            const boostA = a.lungeTimer > 0 ? 1.55 : 1.0;
            const boostB = b.lungeTimer > 0 ? 1.55 : 1.0;

            a.vx -= nx * impulse * boostB;
            a.vy -= ny * impulse * boostB;
            b.vx += nx * impulse * boostA;
            b.vy += ny * impulse * boostA;

            const extraBump = 140;
            a.vx -= nx * extraBump * boostB;
            a.vy -= ny * extraBump * boostB;
            b.vx += nx * extraBump * boostA;
            b.vy += ny * extraBump * boostA;

            if (a.lungeTimer > 0 && b.lungeTimer <= 0) {
              a.score += 30;
              this.addFloatingText((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 - 20, 'TUSK BASH! +30', '#38bdf8', 15);
            } else if (b.lungeTimer > 0 && a.lungeTimer <= 0) {
              b.score += 30;
              this.addFloatingText((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 - 20, 'TUSK BASH! +30', '#38bdf8', 15);
            }

            const impactForce = Math.min(14, Math.hypot(rvx, rvy) * 0.025);
            if (impactForce > 3) {
              this.triggerScreenShake(impactForce);
              this.audio.playBounce();
              this.emitFx((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#ffffff', 10, 150);
            }
          }
        }
      }
    }

    // Update treats & pickups
    for (let i = this.treats.length - 1; i >= 0; i--) {
      const t = this.treats[i];
      t.ttl -= safeDt;
      t.pulse += safeDt * 5;
      t.x += t.vx * safeDt;
      t.y += t.vy * safeDt;

      const dFromCenter = Math.hypot(t.x - cx, t.y - cy);
      if (dFromCenter > this.floeRadius * 0.85) {
        const toCenter = Math.atan2(cy - t.y, cx - t.x);
        t.vx = Math.cos(toCenter) * 35;
        t.vy = Math.sin(toCenter) * 35;
      }

      let picked = false;
      this.walruses.forEach((w) => {
        if (picked || w.inWaterTimer > 0) return;
        const d = Math.hypot(w.x - t.x, w.y - t.y);
        if (d < w.radius + t.radius) {
          picked = true;
          if (t.type === 'urchin_bomb') {
            if (!this.isUnderdog(w)) {
              w.overchargeTimer = 1.1;
              w.combo = 1;
              w.score = Math.max(0, w.score - 25);
              const blastA = Math.atan2(w.y - t.y, w.x - t.x);
              w.vx += Math.cos(blastA) * 360;
              w.vy += Math.sin(blastA) * 360;
              this.triggerScreenShake(7);
              this.audio.playExplosion();
              this.emitFx(t.x, t.y, '#ef4444', 16, 180);
              this.addFloatingText(t.x, t.y - 20, '💥 SEA URCHIN! -25', '#ef4444', 16);
            } else {
              this.emitFx(t.x, t.y, '#38bdf8', 10, 130);
              this.addFloatingText(t.x, t.y - 20, '🛡️ ARMOR BLOCK!', '#38bdf8', 15);
            }
          } else {
            const basePts = t.type === 'golden_crab' ? 85 : 45;
            const mult = Math.min(4, w.combo);
            const total = basePts * mult;
            w.score += total;
            w.combo = Math.min(4, w.combo + 1);
            this.audio.playScore();
            const col = t.type === 'golden_crab' ? '#facc15' : '#fb7185';
            this.emitFx(t.x, t.y, col, 14, 160);
            this.addFloatingText(
              t.x,
              t.y - 20,
              t.type === 'golden_crab' ? `🦀 GOLDEN CRAB! +${total}` : `🐟 SALMON! +${total}`,
              col,
              16
            );
          }
        }
      });

      if (picked || t.ttl <= 0) {
        this.treats.splice(i, 1);
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

  private executeTuskLunge(w: WalrusFighter, power: number): void {
    const impulse = 360 + power * 220;
    w.vx += Math.cos(w.angle) * impulse;
    w.vy += Math.sin(w.angle) * impulse;
    w.lungeTimer = 0.35;
    this.audio.playWhoosh();
    this.emitFx(w.x - Math.cos(w.angle) * 18, w.y - Math.sin(w.angle) * 18, '#e0f2fe', 8, 120);
  }

  private executeBellyQuakeSlam(w: WalrusFighter): void {
    const underdog = this.isUnderdog(w);
    const impulse = underdog ? 680 : 580;
    w.vx += Math.cos(w.angle) * impulse;
    w.vy += Math.sin(w.angle) * impulse;
    w.lungeTimer = 0.55;
    w.flashTimer = 0.45;
    w.score += 80;
    w.combo = Math.min(4, w.combo + 1);

    this.hitStopTimer = 0.045;
    this.triggerScreenShake(12);
    this.audio.playBoost();
    this.emitFx(w.x, w.y, '#facc15', 22, 240);
    this.addFloatingText(w.x, w.y - 34, '🦭 BELLY-QUAKE SLAM! +80', '#facc15', 18);

    // Shockwave shunts nearby rival walruses toward the edge!
    this.walruses.forEach((other) => {
      if (other.id === w.id || other.inWaterTimer > 0) return;
      const dx = other.x - w.x;
      const dy = other.y - w.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 175) {
        const pushA = Math.atan2(dy, dx);
        const force = underdog ? 620 : 510;
        other.vx += Math.cos(pushA) * force;
        other.vy += Math.sin(pushA) * force;
        w.score += 70;
        this.addFloatingText(other.x, other.y - 26, '🌊 TIDAL TUSK SHUNT! +70', '#38bdf8', 16);
      }
    });
  }

  private triggerOvercharge(w: WalrusFighter): void {
    w.isHolding = false;
    w.charge = 0;
    w.overchargeTimer = 1.25;
    w.combo = 1;
    w.vx *= -0.4;
    w.vy *= -0.4;
    this.triggerScreenShake(6);
    this.audio.playBuzzer();
    this.emitFx(w.x, w.y, '#ef4444', 14, 150);
    this.addFloatingText(w.x, w.y - 28, '⚠️ SLIPOUT STUN!', '#ef4444', 15);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const w = this.walruses.get(botId);
    if (!w || w.inWaterTimer > 0 || w.overchargeTimer > 0) return;

    const cx = width * 0.5;
    const cy = height * 0.54;
    const sunX = cx + this.sunOffsetX;
    const sunY = cy + this.sunOffsetY;

    w.botTimer -= dt;
    if (w.botTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.26 : 0.38;
      w.botTimer = delay + Math.random() * 0.12;

      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.12 : 0.03;

      if (Math.random() < blunder) {
        const randA = Math.random() * Math.PI * 2;
        w.botTargetX = cx + Math.cos(randA) * (this.floeRadius * 0.45);
        w.botTargetY = cy + Math.sin(randA) * (this.floeRadius * 0.45);
      } else {
        // Priority 1: Golden crab or salmon
        let bestTreat: SeaTreat | null = null;
        let bestScore = -9999;
        for (const t of this.treats) {
          if (t.type === 'urchin_bomb') continue;
          const d = Math.hypot(t.x - w.x, t.y - w.y);
          const val = (t.type === 'golden_crab' ? 240 : 120) - d * 0.5;
          if (val > bestScore) {
            bestScore = val;
            bestTreat = t;
          }
        }

        if (bestTreat && bestScore > 25) {
          w.botTargetX = bestTreat.x;
          w.botTargetY = bestTreat.y;
        } else {
          w.botTargetX = sunX;
          w.botTargetY = sunY;
        }

        // Check if rival is close enough to charge or lunge
        let rivalNear = false;
        this.walruses.forEach((other) => {
          if (other.id === botId || other.inWaterTimer > 0) return;
          if (Math.hypot(other.x - w.x, other.y - w.y) < 135) {
            rivalNear = true;
            w.botTargetX = other.x;
            w.botTargetY = other.y;
          }
        });

        if (rivalNear && !w.isHolding && Math.random() < (difficulty === 'bot_hard' ? 0.65 : 0.4)) {
          w.isHolding = true;
          w.charge = 0;
          w.botHoldTarget = 0.76 + Math.random() * 0.18;
        } else if (rivalNear && !w.isHolding && Math.random() < 0.45) {
          this.executeTuskLunge(w, 0.65);
        }
      }
    }

    // Move toward target, staying away from water edge
    const distFromCenter = Math.hypot(w.x - cx, w.y - cy);
    const targetX = distFromCenter > this.floeRadius * 0.78 ? cx : w.botTargetX;
    const targetY = distFromCenter > this.floeRadius * 0.78 ? cy : w.botTargetY;

    const dx = targetX - w.x;
    const dy = targetY - w.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      const aimA = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.14;
      w.angle = aimA;
      const moveSpd = difficulty === 'bot_hard' ? 640 : difficulty === 'bot_normal' ? 560 : 470;
      w.vx += Math.cos(aimA) * moveSpd * dt;
      w.vy += Math.sin(aimA) * moveSpd * dt;
    }

    if (w.isHolding) {
      w.charge += dt * 0.82;
      if (w.charge >= w.botHoldTarget) {
        w.isHolding = false;
        if (w.charge >= 0.72 && w.charge <= 0.98) {
          this.executeBellyQuakeSlam(w);
        } else {
          this.executeTuskLunge(w, w.charge);
        }
        w.charge = 0;
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.walruses.forEach((w, id) => scores.set(id, Math.floor(w.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.walruses.entries())
      .map(([playerId, w]) => ({ playerId, score: Math.floor(w.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    const winnerName = winnerId ? this.getPlayer(winnerId)?.name ?? winnerId : 'Nobody';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winnerName} ruled the Svalbard Iceberg as Supreme Walrus King!`,
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex] ?? THEMES[0];
    const cx = width * 0.5;
    const cy = height * 0.54;

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Arctic Deep Ocean Background
    const seaGrad = ctx.createLinearGradient(0, 0, 0, height);
    seaGrad.addColorStop(0, theme.seaTop);
    seaGrad.addColorStop(1, theme.seaBottom);
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, width, height);

    // Animated ocean ripple rings around iceberg
    for (let i = 1; i <= 3; i++) {
      const waveR = this.floeRadius + 16 + ((this.elapsed * 28 + i * 26) % 78);
      const alpha = Math.max(0, 0.35 - (waveR - this.floeRadius) / 220);
      ctx.strokeStyle = `rgba(186, 230, 253, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Circling 2.5D Orca Fin & Wake
    const orcaR = this.floeRadius + 34;
    const ox = cx + Math.cos(this.orcaAngle) * orcaR;
    const oy = cy + Math.sin(this.orcaAngle) * orcaR;
    const orcaTangent = this.orcaAngle + Math.PI * 0.5;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(orcaTangent);
    // White wake V
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-18, -12);
    ctx.moveTo(14, 0);
    ctx.lineTo(-18, 12);
    ctx.stroke();
    // Orca body & white eyepatch
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(10, -4, 5, 2.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Dorsal fin
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-8, -16);
    ctx.lineTo(-10, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. 2.5D Extruded Iceberg Shelf
    // Underwater glacial shelf shadow + 3D extruded wall
    ctx.fillStyle = 'rgba(2, 132, 199, 0.38)';
    ctx.beginPath();
    ctx.arc(cx, cy + 22, this.floeRadius + 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = theme.iceSide;
    ctx.beginPath();
    ctx.arc(cx, cy + 14, this.floeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Top Ice Surface
    const iceGrad = ctx.createRadialGradient(cx - 35, cy - 35, 20, cx, cy, this.floeRadius);
    iceGrad.addColorStop(0, '#ffffff');
    iceGrad.addColorStop(0.75, theme.iceTop);
    iceGrad.addColorStop(1, theme.iceBorder);
    ctx.fillStyle = iceGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, this.floeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme.iceBorder;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Sudden Death fracture lines
    if (this.suddenDeath) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.lineWidth = 2.5;
      for (let k = 0; k < 6; k++) {
        const fa = (k / 6) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(fa) * (this.floeRadius * 0.45), cy + Math.sin(fa) * (this.floeRadius * 0.45));
        ctx.lineTo(cx + Math.cos(fa + 0.15) * this.floeRadius, cy + Math.sin(fa + 0.15) * this.floeRadius);
        ctx.stroke();
      }
    }

    // 4. Wandering Warm Sunbeam Crown Zone
    const sunX = cx + this.sunOffsetX;
    const sunY = cy + this.sunOffsetY;
    const sunR = this.floeRadius * 0.34;
    ctx.fillStyle = theme.sunZone;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(180, 83, 9, 0.78)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☀️ SUNBEAM CROWN (+18/s)', sunX, sunY + 4);

    // 5. Sea Treats (Salmon, Golden Crabs, Urchin Bombs)
    for (const t of this.treats) {
      const bob = Math.sin(t.pulse) * 3;
      ctx.save();
      ctx.translate(t.x, t.y + bob);

      // Shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 10, t.radius * 0.9, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (t.type === 'salmon') {
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 7, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#be123c';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        // Tail fin
        ctx.beginPath();
        ctx.moveTo(-12, 2);
        ctx.lineTo(-19, -4);
        ctx.lineTo(-18, 7);
        ctx.closePath();
        ctx.fill();
      } else if (t.type === 'golden_crab') {
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🦀', 0, 4);
      } else {
        // Sea Urchin Bomb
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        for (let s = 0; s < 8; s++) {
          const sa = (s / 8) * Math.PI * 2 + this.elapsed * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(sa) * 8, Math.sin(sa) * 8);
          ctx.lineTo(Math.cos(sa) * 16, Math.sin(sa) * 16);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 6. Render 2.5D Walrus Sumo Wrestlers
    this.walruses.forEach((w, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const underdog = this.isUnderdog(w);

      if (w.inWaterTimer > 0) {
        // Bobbing splash ring in water
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(w.x, w.y, 18 + (1.35 - w.inWaterTimer) * 16, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      ctx.save();
      ctx.translate(w.x, w.y);

      // Hold-to-charge ring (72%-98% Sweet Spot)
      if (w.isHolding && w.charge > 0.04) {
        const ringR = w.radius + 11;
        const inSweet = w.charge >= 0.72 && w.charge <= 0.98;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // Sweet spot arc marker
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.5 + 0.72 * Math.PI * 2, -Math.PI * 0.5 + 0.98 * Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = inSweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.min(1, w.charge) * Math.PI * 2);
        ctx.stroke();
      }

      if (underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, w.radius + 6 + Math.sin(this.elapsed * 8) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 12, w.radius * 1.05, w.radius * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rotate for Walrus Body & Ivory Tusks
      ctx.save();
      ctx.rotate(w.angle);

      // 2.5D Plump Walrus Blubber Cushion
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = w.flashTimer > 0 ? '#facc15' : '#0f172a';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Side Flippers
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(-8, -19, 9, 4.5, -0.35, 0, Math.PI * 2);
      ctx.ellipse(-8, 19, 9, 4.5, 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Whiskered Snout & Gleaming Ivory Tusks protruding forward
      ctx.fillStyle = '#d6d3d1';
      ctx.beginPath();
      ctx.ellipse(16, 0, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      // Left Tusk
      ctx.beginPath();
      ctx.moveTo(18, -8);
      ctx.lineTo(33, -6);
      ctx.lineTo(18, -3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right Tusk
      ctx.beginPath();
      ctx.moveTo(18, 3);
      ctx.lineTo(33, 6);
      ctx.lineTo(18, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Player Mascot riding/integrated at center
      const mood: CharacterMood =
        w.overchargeTimer > 0
          ? 'shocked'
          : w.lungeTimer > 0 || w.flashTimer > 0
          ? 'triumph'
          : w.isHolding
          ? 'focused'
          : 'happy';
      this.drawPlayerMascot(ctx, pId, 0, -3, 15, mood, this.elapsed, 0);

      // Name & Score Tag
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(w.score)}`, 0, -30);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(w.score)}`, -1, -31);

      if (w.combo > 1) {
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`${w.combo}x KING`, 0, 32);
      }

      ctx.restore();
    });

    // 7. FX Particles
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

    // 8. Top Control Banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 290, 12, 580, 30, 15);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🦭 Steer: Slide Walrus • Tap: Tusk Lunge • Hold (72–98%): Belly-Quake Sumo Slam | BASK IN SUN!',
      width * 0.5,
      31
    );

    // 9. Clickable Bottom-Left Theme Pill
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

  public handlePointerDown(x: number, y: number, _width: number, height: number): boolean {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }
}
