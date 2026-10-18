import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

interface MammothTheme {
  id: string;
  name: string;
  skyTop: string;
  gorgeTop: string;
  gorgeBottom: string;
  mammothFur: string;
  accent: string;
}

const THEMES: MammothTheme[] = [
  {
    id: 'pleistocene_gorge',
    name: 'Pleistocene Glacier Gorge',
    skyTop: '#0f172a',
    gorgeTop: '#cbd5e1',
    gorgeBottom: '#94a3b8',
    mammothFur: '#5c3a21',
    accent: '#f59e0b',
  },
  {
    id: 'siberia_permafrost',
    name: 'Siberian Permafrost Basin',
    skyTop: '#082f49',
    gorgeTop: '#e0f2fe',
    gorgeBottom: '#7dd3fc',
    mammothFur: '#451a03',
    accent: '#38bdf8',
  },
  {
    id: 'volcanic_tundra',
    name: 'Obsidian Steppe',
    skyTop: '#1e1b4b',
    gorgeTop: '#e2e8f0',
    gorgeBottom: '#64748b',
    mammothFur: '#3f2314',
    accent: '#fb7185',
  },
];

interface ChargingMammoth {
  id: number;
  x: number;
  y: number;
  vx: number;
  warnTimer: number;
  radius: number;
  stompPhase: number;
  hitPlayers: Set<PlayerId>;
}

interface TundraPickup {
  id: number;
  x: number;
  y: number;
  type: 'ivory_relic' | 'amber_fossil' | 'tar_pit';
  radius: number;
  ttl: number;
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

interface TundraHunter {
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
  hornTimer: number;
  surviveAccum: number;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

export class MammothStampedeGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public runners: Map<PlayerId, TundraHunter> = new Map();
  private mammoths: ChargingMammoth[] = [];
  private pickups: TundraPickup[] = [];
  private fxParticles: FxParticle[] = [];
  private nextId = 1;
  private mammothSpawnTimer = 0.9;
  private pickupSpawnTimer = 1.1;

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
    return THEMES[this.themeIndex]?.name ?? 'Pleistocene Glacier Gorge';
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
    this.mammoths = [];
    this.pickups = [];
    this.fxParticles = [];
    this.runners.clear();

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const sx = width * (0.3 + (idx / Math.max(1, count - 1 || 1)) * 0.4);
      const sy = height * (0.35 + (idx % 2) * 0.25);
      this.runners.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        zHeight: 0,
        vz: 0,
        angle: 0,
        radius: 22,
        score: 0,
        combo: 1,
        isHolding: false,
        charge: 0,
        overchargeTimer: 0,
        hornTimer: 0,
        surviveAccum: 0,
        botTimer: 0.2 + Math.random() * 0.2,
        botTargetX: sx,
        botTargetY: sy,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 5; i++) {
      this.spawnPickup(width, height);
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

  private spawnMammoth(width: number, height: number): void {
    const fromLeft = Math.random() < 0.5;
    const laneY = height * (0.24 + Math.random() * 0.56);
    const spd = (265 + Math.random() * 75) * (this.suddenDeath ? 1.25 : 1.0);
    this.mammoths.push({
      id: this.nextId++,
      x: fromLeft ? -55 : width + 55,
      y: laneY,
      vx: fromLeft ? spd : -spd,
      warnTimer: 0.65,
      radius: 34,
      stompPhase: Math.random() * Math.PI * 2,
      hitPlayers: new Set(),
    });
  }

  private spawnPickup(width: number, height: number): void {
    const roll = Math.random();
    const type: TundraPickup['type'] =
      roll < (this.suddenDeath ? 0.32 : 0.22)
        ? 'amber_fossil'
        : roll < 0.82
        ? 'ivory_relic'
        : 'tar_pit';

    this.pickups.push({
      id: this.nextId++,
      x: width * (0.14 + Math.random() * 0.72),
      y: height * (0.24 + Math.random() * 0.56),
      type,
      radius: type === 'amber_fossil' ? 16 : 15,
      ttl: 11.0,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  private getMaxScore(): number {
    let max = 0;
    this.runners.forEach((r) => {
      if (r.score > max) max = r.score;
    });
    return max;
  }

  private isUnderdog(r: TundraHunter): boolean {
    return this.getMaxScore() - r.score >= 150;
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
      this.addFloatingText(width * 0.5, height * 0.18, '⚡ SUDDEN DEATH: MEGA-HERD STAMPEDE! ⚡', '#facc15', 22);
    }

    this.mammothSpawnTimer -= safeDt;
    if (this.mammothSpawnTimer <= 0) {
      this.mammothSpawnTimer = this.suddenDeath ? 0.9 : 1.45;
      if (this.mammoths.length < (this.suddenDeath ? 6 : 4)) {
        this.spawnMammoth(width, height);
      }
    }

    this.pickupSpawnTimer -= safeDt;
    if (this.pickupSpawnTimer <= 0) {
      this.pickupSpawnTimer = 1.6;
      if (this.pickups.length < 7) {
        this.spawnPickup(width, height);
      }
    }

    this.updateBots(safeDt, width, height);

    // Update Hunters
    this.runners.forEach((r) => {
      const p = this.getPlayer(r.id);
      if (r.overchargeTimer > 0) r.overchargeTimer = Math.max(0, r.overchargeTimer - safeDt);
      if (r.hornTimer > 0) r.hornTimer = Math.max(0, r.hornTimer - safeDt);

      // Survival trickle points
      r.surviveAccum += safeDt * 8;
      if (r.surviveAccum >= 8) {
        r.score += 8;
        r.surviveAccum -= 8;
      }

      const underdog = this.isUnderdog(r);
      const speedMult = (underdog ? 1.18 : 1.0) * (r.overchargeTimer > 0 ? 0.55 : 1.0);

      if (p && !p.type.startsWith('bot_')) {
        const move = { x: this.input.getSteer(r.id), y: -this.input.getThrottle(r.id) };
        if (Math.hypot(move.x, move.y) > 0.08) {
          r.vx += move.x * 760 * speedMult * safeDt;
          r.vy += move.y * 760 * speedMult * safeDt;
          r.angle = Math.atan2(move.y, move.x);
        }

        const holding = this.input.isActionPressed(r.id);
        if (holding && r.overchargeTimer <= 0) {
          r.isHolding = true;
          r.charge = Math.min(1.15, r.charge + safeDt * 0.85);
          if (r.charge >= 1.05) {
            this.triggerFrostSlip(r);
          }
        } else if (r.isHolding) {
          r.isHolding = false;
          if (r.charge >= 0.72 && r.charge <= 0.98) {
            this.executeWarHornVault(r);
          } else {
            this.executeSpearVault(r);
          }
          r.charge = 0;
        } else if (this.input.justAction(r.id)) {
          this.executeSpearVault(r);
        }
      }

      // Vertical leap physics
      if (r.zHeight > 0 || r.vz !== 0) {
        r.zHeight += r.vz * safeDt;
        r.vz -= 920 * safeDt;
        if (r.zHeight <= 0) {
          r.zHeight = 0;
          r.vz = 0;
          this.emitFx(r.x, r.y + 8, '#cbd5e1', 6, 100);
        }
      }

      r.x += r.vx * safeDt;
      r.y += r.vy * safeDt;
      const damp = Math.pow(0.09, safeDt);
      r.vx *= damp;
      r.vy *= damp;

      // Bounds
      const minX = 60;
      const maxX = width - 60;
      const minY = 110;
      const maxY = height - 68;
      if (r.x < minX) {
        r.x = minX;
        r.vx = Math.abs(r.vx) * 0.5;
      } else if (r.x > maxX) {
        r.x = maxX;
        r.vx = -Math.abs(r.vx) * 0.5;
      }
      if (r.y < minY) {
        r.y = minY;
        r.vy = Math.abs(r.vy) * 0.5;
      } else if (r.y > maxY) {
        r.y = maxY;
        r.vy = -Math.abs(r.vy) * 0.5;
      }
    });

    // Elastic Hunter-to-Hunter Collisions (m1*v1 + m2*v2)
    const list = Array.from(this.runners.values());
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
            const impulse = -velAlongNormal * 1.2;
            a.vx -= nx * (impulse + 140);
            a.vy -= ny * (impulse + 140);
            b.vx += nx * (impulse + 140);
            b.vy += ny * (impulse + 140);
            this.audio.playBounce();
            this.emitFx((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#f8fafc', 10, 140);
          }
        }
      }
    }

    // Update Charging Mammoths
    for (let i = this.mammoths.length - 1; i >= 0; i--) {
      const m = this.mammoths[i];
      if (m.warnTimer > 0) {
        m.warnTimer -= safeDt;
        continue;
      }

      m.x += m.vx * safeDt;
      m.stompPhase += safeDt * 16;

      this.runners.forEach((r) => {
        if (m.hitPlayers.has(r.id)) return;
        const d = Math.hypot(r.x - m.x, r.y - m.y);
        if (d < r.radius + m.radius - 6) {
          m.hitPlayers.add(r.id);
          if (r.zHeight > 22 || r.hornTimer > 0) {
            // Vaulted over the mammoth!
            const bonus = 55 * Math.min(4, r.combo);
            r.score += bonus;
            r.combo = Math.min(4, r.combo + 1);
            this.audio.playScore();
            this.emitFx(r.x, r.y, '#facc15', 14, 170);
            this.addFloatingText(r.x, r.y - 28, `🦣 MAMMOTH VAULT! +${bonus}`, '#facc15', 16);
          } else if (!this.isUnderdog(r)) {
            r.overchargeTimer = 1.1;
            r.combo = 1;
            r.score = Math.max(0, r.score - 30);
            const pushA = Math.atan2(r.y - m.y, r.x - m.x);
            r.vx += Math.cos(pushA) * 440;
            r.vy += Math.sin(pushA) * 440;
            this.hitStopTimer = 0.045;
            this.triggerScreenShake(10);
            this.audio.playExplosion();
            this.emitFx(r.x, r.y, '#ef4444', 20, 210);
            this.addFloatingText(r.x, r.y - 26, '🦣 TUSK TRAMPLE! -30', '#ef4444', 17);
          }
        }
      });

      if (m.x < -110 || m.x > width + 110) {
        this.mammoths.splice(i, 1);
      }
    }

    // Update Pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.ttl -= safeDt;
      pk.pulse += safeDt * 5;

      let taken = false;
      this.runners.forEach((r) => {
        if (taken) return;
        if (Math.hypot(r.x - pk.x, r.y - pk.y) < r.radius + pk.radius) {
          taken = true;
          if (pk.type === 'tar_pit') {
            if (r.zHeight <= 10 && !this.isUnderdog(r)) {
              r.overchargeTimer = 1.0;
              r.combo = 1;
              r.score = Math.max(0, r.score - 20);
              this.audio.playBuzzer();
              this.emitFx(pk.x, pk.y, '#475569', 14, 150);
              this.addFloatingText(pk.x, pk.y - 22, '🕳️ PERMAFROST BOG! -20', '#94a3b8', 15);
            } else {
              taken = false;
            }
          } else {
            const basePts = pk.type === 'amber_fossil' ? 95 : 50;
            const mult = Math.min(4, r.combo);
            const total = basePts * mult;
            r.score += total;
            r.combo = Math.min(4, r.combo + 1);
            this.audio.playScore();
            const col = pk.type === 'amber_fossil' ? '#facc15' : '#fef08a';
            this.emitFx(pk.x, pk.y, col, 16, 170);
            this.addFloatingText(
              pk.x,
              pk.y - 22,
              pk.type === 'amber_fossil' ? `🔶 AMBER FOSSIL! +${total}` : `🦴 IVORY RELIC! +${total}`,
              col,
              16
            );
          }
        }
      });

      if (taken || pk.ttl <= 0) {
        this.pickups.splice(i, 1);
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

  private executeSpearVault(r: TundraHunter): void {
    if (r.zHeight <= 2) {
      r.vz = 360;
      r.vx += Math.cos(r.angle) * 210;
      r.vy += Math.sin(r.angle) * 210;
      this.audio.playWhoosh();
      this.emitFx(r.x, r.y, '#e2e8f0', 10, 130);
    }
  }

  private executeWarHornVault(r: TundraHunter): void {
    r.hornTimer = 0.85;
    r.vz = 420;
    r.vx += Math.cos(r.angle) * 320;
    r.vy += Math.sin(r.angle) * 320;
    r.score += 85;
    r.combo = Math.min(4, r.combo + 1);

    this.hitStopTimer = 0.045;
    this.triggerScreenShake(12);
    this.audio.playBoost();
    this.emitFx(r.x, r.y, '#facc15', 22, 240);
    this.addFloatingText(r.x, r.y - 34, '📯 WAR-HORN STAMPEDE CALL! +85', '#facc15', 18);

    // Shunt nearby rival hunters into the mammoth lanes!
    const underdog = this.isUnderdog(r);
    this.runners.forEach((other) => {
      if (other.id === r.id) return;
      const dx = other.x - r.x;
      const dy = other.y - r.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 190) {
        const pushA = Math.atan2(dy, dx);
        const force = underdog ? 600 : 480;
        other.vx += Math.cos(pushA) * force;
        other.vy += Math.sin(pushA) * force;
        r.score += 70;
        this.addFloatingText(other.x, other.y - 26, '🌊 TUNDRA HORN SHUNT! +70', '#38bdf8', 16);
      }
    });
  }

  private triggerFrostSlip(r: TundraHunter): void {
    r.isHolding = false;
    r.charge = 0;
    r.overchargeTimer = 1.15;
    r.combo = 1;
    this.triggerScreenShake(6);
    this.audio.playBuzzer();
    this.emitFx(r.x, r.y, '#ef4444', 14, 150);
    this.addFloatingText(r.x, r.y - 28, '⚠️ PERMAFROST SLIP!', '#ef4444', 15);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const r = this.runners.get(botId);
    if (!r || r.overchargeTimer > 0) return;

    r.botTimer -= dt;
    if (r.botTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.28 : 0.42;
      r.botTimer = delay + Math.random() * 0.1;

      // Check incoming mammoth in our vertical band
      const dangerMammoth = this.mammoths.find(
        (m) => Math.abs(m.y - r.y) < 52 && Math.abs(m.x - r.x) < 170
      );

      if (dangerMammoth) {
        if (r.zHeight <= 2 && Math.random() < (difficulty === 'bot_hard' ? 0.85 : 0.6)) {
          this.executeSpearVault(r);
        }
        r.botTargetY = r.y < height * 0.5 ? r.y + 110 : r.y - 110;
      } else {
        // Seek nearest relic/amber
        let bestPk: TundraPickup | null = null;
        let bestScore = -9999;
        for (const pk of this.pickups) {
          if (pk.type === 'tar_pit') continue;
          const d = Math.hypot(pk.x - r.x, pk.y - r.y);
          const val = (pk.type === 'amber_fossil' ? 280 : 150) - d * 0.5;
          if (val > bestScore) {
            bestScore = val;
            bestPk = pk;
          }
        }

        if (bestPk) {
          r.botTargetX = bestPk.x;
          r.botTargetY = bestPk.y;
        } else {
          r.botTargetX = width * 0.5;
          r.botTargetY = height * 0.5;
        }

        if (!r.isHolding && Math.random() < (difficulty === 'bot_hard' ? 0.45 : 0.25)) {
          r.isHolding = true;
          r.charge = 0;
          r.botHoldTarget = 0.76 + Math.random() * 0.18;
        }
      }
    }

    const dx = r.botTargetX - r.x;
    const dy = r.botTargetY - r.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      const aimA = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.14;
      r.angle = aimA;
      const spd = difficulty === 'bot_hard' ? 700 : difficulty === 'bot_normal' ? 600 : 500;
      r.vx += Math.cos(aimA) * spd * dt;
      r.vy += Math.sin(aimA) * spd * dt;
    }

    if (r.isHolding) {
      r.charge += dt * 0.85;
      if (r.charge >= r.botHoldTarget) {
        r.isHolding = false;
        if (r.charge >= 0.72 && r.charge <= 0.98) {
          this.executeWarHornVault(r);
        } else {
          this.executeSpearVault(r);
        }
        r.charge = 0;
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.runners.forEach((r, id) => scores.set(id, Math.floor(r.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.runners.entries())
      .map(([playerId, r]) => ({ playerId, score: Math.floor(r.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    const winnerName = winnerId ? this.getPlayer(winnerId)?.name ?? winnerId : 'Nobody';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winnerName} vaulted the Woolly Mammoth Stampede & claimed the Amber Fossils!`,
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex] ?? THEMES[0];

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Ice Age Gorge Background
    ctx.fillStyle = theme.skyTop;
    ctx.fillRect(0, 0, width, 96);

    const gorgeGrad = ctx.createLinearGradient(0, 96, 0, height);
    gorgeGrad.addColorStop(0, theme.gorgeTop);
    gorgeGrad.addColorStop(1, theme.gorgeBottom);
    ctx.fillStyle = gorgeGrad;
    ctx.fillRect(0, 96, width, height - 96);

    // Glacial canyon walls
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 88, width, 14);

    // 2. Render Mammoth Charge Warning Corridors
    for (const m of this.mammoths) {
      if (m.warnTimer > 0) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.fillRect(0, m.y - 26, width, 52);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          m.vx > 0 ? '⚠️ 🦣 STAMPEDE INCOMING FROM LEFT! ➔' : '⬅ ⚠️ 🦣 STAMPEDE INCOMING FROM RIGHT!',
          width * 0.5,
          m.y + 4
        );
      }
    }

    // 3. Render Pickups (Ivory Relics, Amber Fossils, Tar Pits)
    for (const pk of this.pickups) {
      ctx.save();
      ctx.translate(pk.x, pk.y + Math.sin(pk.pulse) * 3);

      if (pk.type === 'tar_pit') {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (pk.type === 'amber_fossil') {
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔶', 0, 4);
      } else {
        // Ivory Relic
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.roundRect(-14, -6, 28, 12, 5);
        ctx.fill();
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Render Charging 2.5D Woolly Mammoths
    for (const m of this.mammoths) {
      if (m.warnTimer > 0) continue;
      const dir = m.vx >= 0 ? 1 : -1;
      const bounce = Math.abs(Math.sin(m.stompPhase)) * 5;

      ctx.save();
      ctx.translate(m.x, m.y - bounce);
      ctx.scale(dir, 1);

      // Shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 22 + bounce, 36, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shaggy Woolly Body
      ctx.fillStyle = theme.mammothFur;
      ctx.beginPath();
      ctx.ellipse(-4, 0, 34, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#271206';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Domed Head & Trunk
      ctx.beginPath();
      ctx.arc(22, -6, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Giant Curved Ivory Tusks
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(28, 2);
      ctx.quadraticCurveTo(48, 0, 50, -18);
      ctx.stroke();

      // Angry Eye
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(27, -9, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 5. Render Tundra Hunters
    this.runners.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const underdog = this.isUnderdog(r);

      ctx.save();
      ctx.translate(r.x, r.y);

      // Ground shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 14, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(0, -r.zHeight);

      // Charge ring (72%-98% Sweet Spot)
      if (r.isHolding && r.charge > 0.04) {
        const ringR = r.radius + 11;
        const inSweet = r.charge >= 0.72 && r.charge <= 0.98;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
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
        ctx.arc(0, 0, ringR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.min(1, r.charge) * Math.PI * 2);
        ctx.stroke();
      }

      if (underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hunter Fur Cloak Base
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 2, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const mood: CharacterMood =
        r.overchargeTimer > 0
          ? 'shocked'
          : r.hornTimer > 0 || r.zHeight > 10
          ? 'triumph'
          : r.isHolding
          ? 'focused'
          : 'happy';
      this.drawPlayerMascot(ctx, pId, 0, -2, 15, mood, this.elapsed, 0);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(r.score)}`, 0, -28);

      if (r.combo > 1) {
        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`${r.combo}x HUNTER`, 0, 28);
      }

      ctx.restore();
    });

    // 6. FX Particles
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

    // 7. Top Control Banner
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
      '🦣 Steer: Run Gorge • Tap: Vault Mammoth • Hold (72–98%): War-Horn Stampede Shunt!',
      width * 0.5,
      31
    );

    // 8. Clickable Bottom-Left Theme Pill
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
      this.audio.playSelect();
      return true;
    }
    return false;
  }
}
