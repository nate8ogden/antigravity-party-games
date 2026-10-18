import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type DysonTheme = 'dyson_prime' | 'neutron_forge' | 'cyber_swarm';

interface ThemePalette {
  name: string;
  bgTop: string;
  bgBottom: string;
  starCore: string;
  starCorona: string;
  ringAccent: string;
  panelGlow: string;
}

const THEMES: Record<DysonTheme, ThemePalette> = {
  dyson_prime: {
    name: 'Dyson Prime',
    bgTop: '#040614',
    bgBottom: '#16091e',
    starCore: '#fef08a',
    starCorona: '#f97316',
    ringAccent: '#38bdf8',
    panelGlow: '#facc15',
  },
  neutron_forge: {
    name: 'Neutron Star Forge',
    bgTop: '#030b1a',
    bgBottom: '#08203e',
    starCore: '#e0f2fe',
    starCorona: '#38bdf8',
    ringAccent: '#a855f7',
    panelGlow: '#22d3ee',
  },
  cyber_swarm: {
    name: 'Cyber Swarm Matrix',
    bgTop: '#090314',
    bgBottom: '#1f062e',
    starCore: '#fbcfe8',
    starCorona: '#ec4899',
    ringAccent: '#10b981',
    panelGlow: '#34d399',
  },
};

const THEME_ORDER: DysonTheme[] = ['dyson_prime', 'neutron_forge', 'cyber_swarm'];

interface DysonDrone {
  id: PlayerId;
  angle: number;
  angVel: number;
  dir: number;
  panelOpen: boolean;
  capacitor: number;
  chargeRatio: number;
  stunTimer: number;
  overclockTimer: number;
  score: number;
  combo: number;
  underdog: boolean;
  aiReactTimer: number;
  aiShouldHold: boolean;
}

interface SolarBeam {
  id: number;
  angle: number;
  widthRad: number;
  type: 'plasma_flare' | 'coronal_spike' | 'golden_superflare';
  warnTimer: number;
  activeTimer: number;
  hitPlayers: Set<PlayerId>;
}

interface HeliostatOrb {
  angle: number;
  angVel: number;
  gold: boolean;
  pulse: number;
  active: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export class DysonSphereCollectorGame extends BaseGame {
  private drones: Map<PlayerId, DysonDrone> = new Map();
  private beams: SolarBeam[] = [];
  private orbs: HeliostatOrb[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextBeamId: number = 1;
  private spawnTimer: number = 0.9;
  private orbTimer: number = 1.6;
  private starPulse: number = 0;
  private ringRot: number = 0;
  private theme: DysonTheme = 'dyson_prime';
  private suddenDeath: boolean = false;
  private screenShake: number = 0;
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
    this.theme = THEME_ORDER[Math.floor(Math.random() * THEME_ORDER.length)];
    this.reset(width, height);

    if (!this.keyHandler && typeof window !== 'undefined') {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
          this.theme = THEME_ORDER[idx];
          this.audio.playTap();
        } else if (e.key === '1') {
          this.theme = 'dyson_prime';
          this.audio.playTap();
        } else if (e.key === '2') {
          this.theme = 'neutron_forge';
          this.audio.playTap();
        } else if (e.key === '3') {
          this.theme = 'cyber_swarm';
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public override destroy(): void {
    if (this.keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public handlePointerDown(x: number, y: number, _width: number, height: number): void {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
      this.theme = THEME_ORDER[idx];
      this.audio.playTap();
    }
  }

  private triggerScreenShake(amt: number): void {
    this.screenShake = Math.max(this.screenShake, amt);
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1.35, vy: -26 });
  }

  private normalizeAngleDiff(a: number, b: number): number {
    let diff = (a - b) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  private spawnOrb(): void {
    const activeCount = this.orbs.filter((o) => o.active).length;
    if (activeCount >= 6) return;
    this.orbs.push({
      angle: Math.random() * Math.PI * 2,
      angVel: (Math.random() > 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.45),
      gold: Math.random() < 0.3,
      pulse: Math.random() * Math.PI * 2,
      active: true,
    });
  }

  public reset(_width: number, _height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.drones.clear();
    this.beams = [];
    this.orbs = [];
    this.floatingTexts = [];
    this.suddenDeath = false;
    this.screenShake = 0;

    const active = this.getActivePlayers();
    const count = Math.max(active.length, 1);
    active.forEach((p, i) => {
      this.drones.set(p.id, {
        id: p.id,
        angle: (i * Math.PI * 2) / count - Math.PI / 2,
        angVel: 0,
        dir: i % 2 === 0 ? 1 : -1,
        panelOpen: false,
        capacitor: 25,
        chargeRatio: 0,
        stunTimer: 0,
        overclockTimer: 0,
        score: 0,
        combo: 1,
        underdog: false,
        aiReactTimer: 0.2,
        aiShouldHold: false,
      });
    });

    for (let i = 0; i < 4; i++) {
      this.spawnOrb();
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    const clampedDt = Math.min(dt, 0.05);
    this.starPulse += clampedDt * 4.5;
    this.ringRot += clampedDt * 0.25;
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - clampedDt * 28);
    }

    this.roundTimer = Math.max(0, this.roundTimer - clampedDt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    if (!this.suddenDeath && this.roundTimer <= 12) {
      this.suddenDeath = true;
      this.triggerScreenShake(11);
      this.audio.playFanfare();
      this.addFloatingText(width / 2, 108, 'SUPERNOVA SURGE! 2X SOLAR FLUX!', '#facc15');
    }

    let maxScore = 0;
    this.drones.forEach((d) => {
      if (d.score > maxScore) maxScore = d.score;
    });
    this.drones.forEach((d) => {
      d.underdog = maxScore - d.score >= 120;
    });

    const cx = width / 2;
    const cy = height / 2 + 18;
    const orbitR = 178;

    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (this.suddenDeath ? 0.55 : 0.92) + Math.random() * 0.35;
      const roll = Math.random();
      const type: SolarBeam['type'] =
        roll < 0.22 ? 'golden_superflare' : roll < 0.65 ? 'plasma_flare' : 'coronal_spike';
      this.beams.push({
        id: this.nextBeamId++,
        angle: Math.random() * Math.PI * 2,
        widthRad: type === 'golden_superflare' ? 0.34 : 0.28,
        type,
        warnTimer: this.suddenDeath ? 0.68 : 0.88,
        activeTimer: 0.48,
        hitPlayers: new Set<PlayerId>(),
      });
    }

    this.orbTimer -= clampedDt;
    if (this.orbTimer <= 0) {
      this.orbTimer = this.suddenDeath ? 1.15 : 1.75;
      this.spawnOrb();
    }

    for (const orb of this.orbs) {
      if (!orb.active) continue;
      orb.angle = (orb.angle + orb.angVel * clampedDt + Math.PI * 2) % (Math.PI * 2);
      orb.pulse += clampedDt * 5;
    }

    this.updateBots(clampedDt, width, height);

    this.drones.forEach((d) => {
      const p = this.getPlayer(d.id);
      if (!p) return;

      if (d.stunTimer > 0) {
        d.stunTimer = Math.max(0, d.stunTimer - clampedDt);
        d.panelOpen = false;
        d.chargeRatio = Math.max(0, d.chargeRatio - clampedDt * 1.5);
        d.angVel *= Math.pow(0.08, clampedDt);
        d.angle = (d.angle + d.angVel * clampedDt + Math.PI * 2) % (Math.PI * 2);
        return;
      }

      if (d.overclockTimer > 0) {
        d.overclockTimer = Math.max(0, d.overclockTimer - clampedDt);
      }

      const speedMult = (d.underdog ? 1.18 : 1.0) * (d.overclockTimer > 0 ? 1.28 : 1.0);
      let steer = 0;
      let holdAction = false;
      let releaseAction = false;

      if (!p.type.startsWith('bot_')) {
        const hasSteer = this.input.hasSteer(p.id);
        steer = this.input.getSteer(p.id);
        if (this.input.justAction(p.id) || (!hasSteer && this.input.justPressed(p.id))) {
          d.dir *= -1;
          d.angVel = d.dir * 2.15 * speedMult;
          this.audio.playTap();
        }
        holdAction = this.input.isActionPressed(p.id) || (!hasSteer && this.input.isPressed(p.id));
        releaseAction = this.input.justReleased(p.id) || (!holdAction && d.chargeRatio > 0);
      } else {
        steer = d.dir;
        holdAction = d.aiShouldHold;
        if (!holdAction && d.chargeRatio >= 0.75) {
          releaseAction = true;
        }
      }

      if (Math.abs(steer) > 0.1) {
        d.dir = Math.sign(steer);
        d.angVel += steer * 5.2 * speedMult * clampedDt;
      } else {
        d.angVel += d.dir * 2.4 * speedMult * clampedDt;
      }

      const maxAngVel = (holdAction ? 1.55 : 2.35) * speedMult;
      d.angVel = Math.max(-maxAngVel, Math.min(maxAngVel, d.angVel));
      d.angVel *= Math.pow(0.22, clampedDt);
      d.angle = (d.angle + d.angVel * clampedDt + Math.PI * 2) % (Math.PI * 2);

      d.panelOpen = holdAction;
      if (holdAction) {
        d.chargeRatio = Math.min(1, d.chargeRatio + clampedDt * 0.78);
        if (d.chargeRatio >= 1.0) {
          d.stunTimer = 0.85;
          d.chargeRatio = 0;
          d.combo = 1;
          d.panelOpen = false;
          this.audio.playStun();
          this.triggerScreenShake(7);
          const dx = cx + Math.cos(d.angle) * orbitR;
          const dy = cy + Math.sin(d.angle) * orbitR;
          this.particles.spawnExplosion(dx, dy, '#ef4444', 18);
          this.addFloatingText(dx, dy - 26, 'CAPACITOR OVERLOAD!', '#ef4444');
        }
      } else {
        if (releaseAction && d.chargeRatio >= 0.72 && d.chargeRatio <= 0.98) {
          this.fireMegaDischarge(d, p.color, cx, cy, orbitR);
        }
        d.chargeRatio = Math.max(0, d.chargeRatio - clampedDt * 2.2);
      }

      const dx = cx + Math.cos(d.angle) * orbitR;
      const dy = cy + Math.sin(d.angle) * orbitR;
      for (const orb of this.orbs) {
        if (!orb.active) continue;
        const diff = Math.abs(this.normalizeAngleDiff(d.angle, orb.angle));
        if (diff < 0.22) {
          orb.active = false;
          const mult = this.suddenDeath ? 2 : 1;
          const pts = (orb.gold ? 35 : 18) * mult;
          d.score += pts;
          d.capacitor = Math.min(100, d.capacitor + (orb.gold ? 28 : 15));
          this.audio.playCoin();
          this.particles.spawnSparks(dx, dy, orb.gold ? '#facc15' : '#38bdf8', 12);
          this.addFloatingText(
            dx,
            dy - 24,
            orb.gold ? `+${pts} HELIO-CORE!` : `+${pts} PHOTON`,
            orb.gold ? '#facc15' : '#38bdf8'
          );
          if (d.capacitor >= 100) {
            this.bankCapacitor(d, dx, dy);
          }
        }
      }
    });

    // Elastic Drone-to-Drone Orbital Collisions
    const list = Array.from(this.drones.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const diff = this.normalizeAngleDiff(a.angle, b.angle);
        const minAng = 0.27;
        if (Math.abs(diff) < minAng) {
          const pushSign = diff >= 0 ? 1 : -1;
          const overlap = minAng - Math.abs(diff);
          a.angle = (a.angle + pushSign * overlap * 0.5 + Math.PI * 2) % (Math.PI * 2);
          b.angle = (b.angle - pushSign * overlap * 0.5 + Math.PI * 2) % (Math.PI * 2);

          const va = a.angVel;
          const vb = b.angVel;
          const boostA = b.underdog ? 1.35 : 1.1;
          const boostB = a.underdog ? 1.35 : 1.1;
          a.angVel = vb * boostA + pushSign * 1.45;
          b.angVel = va * boostB - pushSign * 1.45;
          a.dir = Math.sign(a.angVel) || 1;
          b.dir = Math.sign(b.angVel) || -1;

          const midAngle = (a.angle + b.angle) * 0.5;
          const mx = cx + Math.cos(midAngle) * orbitR;
          const my = cy + Math.sin(midAngle) * orbitR;
          this.audio.playBounce();
          this.triggerScreenShake(5);
          this.particles.spawnSparks(mx, my, '#ffffff', 12);
        }
      }
    }

    // Update Solar Beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      if (b.warnTimer > 0) {
        b.warnTimer -= clampedDt;
        if (b.warnTimer <= 0) {
          this.audio.playWhoosh();
        }
      } else {
        b.activeTimer -= clampedDt;
        this.drones.forEach((d) => {
          if (b.hitPlayers.has(d.id)) return;
          const diff = Math.abs(this.normalizeAngleDiff(d.angle, b.angle));
          if (diff <= b.widthRad * 0.88) {
            b.hitPlayers.add(d.id);
            const p = this.getPlayer(d.id);
            if (!p) return;
            const dx = cx + Math.cos(d.angle) * orbitR;
            const dy = cy + Math.sin(d.angle) * orbitR;
            const mult = this.suddenDeath ? 2 : 1;

            if (b.type === 'coronal_spike') {
              if (d.overclockTimer > 0) {
                const pts = 30 * mult;
                d.score += pts;
                this.audio.playBounce();
                this.particles.spawnSparks(dx, dy, '#38bdf8', 14);
                this.addFloatingText(dx, dy - 26, `+${pts} SHIELD ABSORB!`, '#38bdf8');
              } else {
                const penalty = d.panelOpen ? 20 : 10;
                d.score = Math.max(0, d.score - penalty);
                d.capacitor = Math.max(0, d.capacitor - 25);
                d.stunTimer = d.panelOpen ? 0.95 : 0.45;
                d.combo = 1;
                this.audio.playExplosion();
                this.triggerScreenShake(8);
                this.particles.spawnExplosion(dx, dy, '#ef4444', 18);
                this.addFloatingText(
                  dx,
                  dy - 26,
                  d.panelOpen ? 'PANEL SCORCHED! -20' : 'CORONAL FLARE! -10',
                  '#ef4444'
                );
              }
            } else {
              const isGold = b.type === 'golden_superflare';
              const panelBonus = d.panelOpen ? 1.65 : 1.0;
              const basePts = isGold ? 45 : 28;
              const pts = Math.round((basePts + d.combo * 5) * panelBonus * mult);
              d.score += pts;
              d.combo = Math.min(6, d.combo + 1);
              d.capacitor = Math.min(
                100,
                d.capacitor + (isGold ? 42 : 26) * (d.panelOpen ? 1.35 : 1.0)
              );
              this.audio.playScore();
              this.triggerScreenShake(isGold ? 6 : 4);
              this.particles.spawnSparks(dx, dy, isGold ? '#facc15' : '#38bdf8', 16);
              this.addFloatingText(
                dx,
                dy - 28,
                `+${pts} ${isGold ? 'SUPERFLARE!' : 'SOLAR HARVEST!'} (${d.combo}x)`,
                isGold ? '#facc15' : p.color
              );
              if (d.capacitor >= 100) {
                this.bankCapacitor(d, dx, dy);
              }
            }
          }
        });
        if (b.activeTimer <= 0) {
          this.beams.splice(i, 1);
        }
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.95;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private bankCapacitor(d: DysonDrone, dx: number, dy: number): void {
    d.capacitor = 0;
    const mult = this.suddenDeath ? 2 : 1;
    const bonus = 65 * mult;
    d.score += bonus;
    this.audio.playFanfare();
    this.triggerScreenShake(7);
    this.particles.spawnExplosion(dx, dy, '#facc15', 22);
    this.addFloatingText(dx, dy - 42, `+${bonus} DYSON CAPACITOR FULL!`, '#facc15');
  }

  private fireMegaDischarge(
    d: DysonDrone,
    color: string,
    cx: number,
    cy: number,
    orbitR: number
  ): void {
    const dx = cx + Math.cos(d.angle) * orbitR;
    const dy = cy + Math.sin(d.angle) * orbitR;
    const mult = this.suddenDeath ? 2 : 1;
    const bonus = 55 * mult;
    d.score += bonus;
    d.overclockTimer = 2.6;
    d.capacitor = Math.min(100, d.capacitor + 35);
    this.audio.playScore();
    this.triggerScreenShake(9);
    this.particles.spawnExplosion(dx, dy, '#38bdf8', 24);
    this.addFloatingText(dx, dy - 34, `+${bonus} MEGA-CAPACITOR SURGE!`, '#38bdf8');

    this.drones.forEach((other) => {
      if (other.id === d.id) return;
      const diff = this.normalizeAngleDiff(other.angle, d.angle);
      if (Math.abs(diff) <= 0.75) {
        const pushSign = diff >= 0 ? 1 : -1;
        other.angVel = pushSign * 3.2;
        other.stunTimer = Math.max(other.stunTimer, 0.75);
        const steal = Math.min(other.capacitor, 25);
        other.capacitor -= steal;
        d.capacitor = Math.min(100, d.capacitor + steal);
        const shuntPts = 45 * mult;
        d.score += shuntPts;
        const ox = cx + Math.cos(other.angle) * orbitR;
        const oy = cy + Math.sin(other.angle) * orbitR;
        this.audio.playExplosion();
        this.particles.spawnExplosion(ox, oy, color, 20);
        this.addFloatingText(ox, oy - 30, `+${shuntPts} CORONAL ARC SHUNT!`, color);
      }
    });

    if (d.capacitor >= 100) {
      this.bankCapacitor(d, dx, dy);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const d = this.drones.get(botId);
    if (!d) return;

    d.aiReactTimer -= dt;
    if (d.aiReactTimer > 0) return;

    const reactDelay =
      difficulty === 'bot_hard' ? 0.11 : difficulty === 'bot_normal' ? 0.23 : 0.41;
    const blunderRate =
      difficulty === 'bot_hard' ? 0.02 : difficulty === 'bot_normal' ? 0.12 : 0.22;
    d.aiReactTimer = reactDelay + Math.random() * 0.06;

    if (Math.random() < blunderRate) {
      d.aiShouldHold = Math.random() < 0.35;
      return;
    }

    let dangerSpike: SolarBeam | null = null;
    let bestFlare: SolarBeam | null = null;
    for (const b of this.beams) {
      const angDiff = Math.abs(this.normalizeAngleDiff(d.angle, b.angle));
      if (b.type === 'coronal_spike' && angDiff < b.widthRad * 1.45) {
        dangerSpike = b;
      } else if (
        b.type !== 'coronal_spike' &&
        (!bestFlare ||
          angDiff < Math.abs(this.normalizeAngleDiff(d.angle, bestFlare.angle)))
      ) {
        bestFlare = b;
      }
    }

    if (dangerSpike) {
      const escapeSign = this.normalizeAngleDiff(d.angle, dangerSpike.angle) >= 0 ? 1 : -1;
      d.dir = escapeSign;
      d.aiShouldHold = false;
      return;
    }

    if (bestFlare) {
      const delta = this.normalizeAngleDiff(bestFlare.angle, d.angle);
      if (Math.abs(delta) > 0.12) {
        d.dir = delta > 0 ? 1 : -1;
      }
      d.aiShouldHold = Math.abs(delta) < 0.38 && d.chargeRatio < 0.84;
      return;
    }

    let bestOrb: HeliostatOrb | null = null;
    let bestDist = 999;
    for (const o of this.orbs) {
      if (!o.active) continue;
      const dist = Math.abs(this.normalizeAngleDiff(o.angle, d.angle));
      if (dist < bestDist) {
        bestDist = dist;
        bestOrb = o;
      }
    }
    if (bestOrb) {
      const delta = this.normalizeAngleDiff(bestOrb.angle, d.angle);
      d.dir = delta >= 0 ? 1 : -1;
    }

    let rivalNearby = false;
    this.drones.forEach((other) => {
      if (other.id !== d.id && Math.abs(this.normalizeAngleDiff(other.angle, d.angle)) < 0.65) {
        rivalNearby = true;
      }
    });
    if (rivalNearby && d.chargeRatio < 0.85) {
      d.aiShouldHold = true;
    } else {
      d.aiShouldHold = false;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];
    ctx.save();
    if (this.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, pal.bgTop);
    bgGrad.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2 + 18;
    const orbitR = 178;

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 36; i++) {
      const sx = (i * 193) % width;
      const sy = (i * 137) % height;
      ctx.fillRect(sx, sy, 2, 2);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.ringRot);
    ctx.strokeStyle = pal.ringAccent;
    ctx.lineWidth = 10;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, orbitR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (orbitR - 14), Math.sin(a) * (orbitR - 14));
      ctx.lineTo(Math.cos(a) * (orbitR + 14), Math.sin(a) * (orbitR + 14));
      ctx.stroke();
    }
    ctx.restore();

    for (const b of this.beams) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(b.angle);

      const isSpike = b.type === 'coronal_spike';
      const isGold = b.type === 'golden_superflare';
      const col = isSpike ? '#ef4444' : isGold ? '#facc15' : '#38bdf8';

      if (b.warnTimer > 0) {
        const blink = 0.28 + 0.22 * Math.sin(this.starPulse * 5);
        ctx.fillStyle = isSpike
          ? `rgba(239, 68, 68, ${blink})`
          : isGold
          ? `rgba(250, 204, 21, ${blink})`
          : `rgba(56, 189, 248, ${blink})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, orbitR + 28, -b.widthRad, b.widthRad);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, orbitR, -b.widthRad, b.widthRad);
        ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, orbitR + 36, -b.widthRad, b.widthRad);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, orbitR + 24, -b.widthRad * 0.4, b.widthRad * 0.4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    const starR = 54 + Math.sin(this.starPulse) * 4;
    const coronaGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, starR + 36);
    coronaGrad.addColorStop(0, '#ffffff');
    coronaGrad.addColorStop(0.45, pal.starCore);
    coronaGrad.addColorStop(0.8, pal.starCorona);
    coronaGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, starR + 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, starR * 0.78, 0, Math.PI * 2);
    ctx.stroke();

    for (const orb of this.orbs) {
      if (!orb.active) continue;
      const ox = cx + Math.cos(orb.angle) * orbitR;
      const oy = cy + Math.sin(orb.angle) * orbitR;
      const r = (orb.gold ? 11 : 8) + Math.sin(orb.pulse) * 1.5;

      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = orb.gold ? '#facc15' : '#38bdf8';
      ctx.shadowColor = orb.gold ? '#facc15' : '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.drones.forEach((d) => {
      const p = this.getPlayer(d.id);
      if (!p) return;

      const dx = cx + Math.cos(d.angle) * orbitR;
      const dy = cy + Math.sin(d.angle) * orbitR;

      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(d.angle + Math.PI / 2);

      if (d.overclockTimer > 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();
      }

      const wingSpan = d.panelOpen ? 34 : 14;
      ctx.fillStyle = d.panelOpen ? pal.panelGlow : '#334155';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-wingSpan - 14, -6, wingSpan, 12);
      ctx.strokeRect(-wingSpan - 14, -6, wingSpan, 12);
      ctx.fillRect(14, -6, wingSpan, 12);
      ctx.strokeRect(14, -6, wingSpan, 12);
      ctx.restore();

      const mood =
        d.stunTimer > 0
          ? 'shocked'
          : d.overclockTimer > 0 || d.combo >= 3
          ? 'triumph'
          : d.panelOpen
          ? 'focused'
          : 'idle';
      this.drawPlayerMascot(ctx, p.id, dx, dy, 18, mood, this.starPulse, d.angVel * 0.15);

      if (d.chargeRatio > 0.05) {
        const inSweet = d.chargeRatio >= 0.72 && d.chargeRatio <= 0.98;
        ctx.strokeStyle = inSweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = inSweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(dx, dy, 26, -Math.PI / 2, -Math.PI / 2 + d.chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(dx - 22, dy + 23, 44, 6);
      ctx.fillStyle = d.capacitor > 75 ? '#facc15' : '#38bdf8';
      ctx.fillRect(dx - 21, dy + 24, 42 * (d.capacitor / 100), 4);
    });

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.alpha);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // Top Header Badge (y=56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = pal.ringAccent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width / 2 - 255, 52, 510, 28, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '☀️ STEER / TAP: ORBIT RING • HOLD: SOLAR WINGS • RELEASE (72-98%): ARC SHUNT!',
      width / 2,
      70
    );

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const d = this.drones.get(p.id);
      if (!d) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 + row * 40;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 34, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${Math.floor(d.score)}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`Cap: ${Math.floor(d.capacitor)}% • ${d.combo}x`, cardX + 10, cardY + 28);
    });

    // Bottom-left Theme Pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = pal.ringAccent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 ${pal.name} [T]`, 105, height - 24);

    ctx.restore();
  }

  public getScore(playerId: PlayerId): number {
    return this.drones.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.drones.entries())
      .map(([playerId, d]) => ({ playerId, score: Math.floor(d.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${winnerId} harvested the Dyson Swarm Mega-Capacitor!`
        : 'Dyson Swarm Showdown!',
    };
  }
}
