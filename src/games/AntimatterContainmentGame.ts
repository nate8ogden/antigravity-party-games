import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type AntimatterThemeId = 'cern' | 'supernova' | 'cyber_core';

interface AntimatterTheme {
  name: string;
  bgInner: string;
  bgOuter: string;
  gridColor: string;
  coreStable: string;
  coreVolatile: string;
  accent: string;
}

const THEMES: Record<AntimatterThemeId, AntimatterTheme> = {
  cern: {
    name: 'Facility Zero Tokamak',
    bgInner: '#0f172a',
    bgOuter: '#030712',
    gridColor: 'rgba(56, 189, 248, 0.08)',
    coreStable: '#10b981',
    coreVolatile: '#a855f7',
    accent: '#38bdf8',
  },
  supernova: {
    name: 'Stellar Fusion Reactor',
    bgInner: '#3b0764',
    bgOuter: '#090314',
    gridColor: 'rgba(250, 204, 21, 0.08)',
    coreStable: '#facc15',
    coreVolatile: '#f97316',
    accent: '#facc15',
  },
  cyber_core: {
    name: 'Dark-Matter Matrix',
    bgInner: '#1e1b4b',
    bgOuter: '#020617',
    gridColor: 'rgba(232, 121, 249, 0.09)',
    coreStable: '#22d3ee',
    coreVolatile: '#e879f9',
    accent: '#e879f9',
  },
};

const THEME_ORDER: AntimatterThemeId[] = ['cern', 'supernova', 'cyber_core'];

interface PositronOrb {
  id: number;
  angle: number;
  dist: number;
  value: number;
  collected: boolean;
}

interface Callout {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface CoreStation {
  id: PlayerId;
  angle: number;
  angularVel: number;
  dist: number;
  orbitDir: 1 | -1;
  coreEnergy: number;
  energyRate: number;
  charge: number;
  charging: boolean;
  pulseAnim: number;
  score: number;
  combo: number;
  breachTimer: number;
  shuntCooldown: number;
  pulsesLanded: number;
  empShunts: number;
  botReactionTimer: number;
  botReleaseThreshold: number;
}

function normalizeAngle(a: number): number {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

export class AntimatterContainmentGame extends BaseGame {
  public stations: Map<PlayerId, CoreStation> = new Map();
  public orbs: PositronOrb[] = [];
  public currentMapName: string = 'Facility Zero Tokamak';

  private themeId: AntimatterThemeId = 'cern';
  private callouts: Callout[] = [];
  private orbIdCounter: number = 0;
  private animTime: number = 0;
  private screenShake: number = 0;
  private suddenDeathAnnounced: boolean = false;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    this.bindThemeControls();
  }

  private bindThemeControls(): void {
    this.cleanupControls();
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      } else if (e.key === '1') {
        this.setTheme('cern');
      } else if (e.key === '2') {
        this.setTheme('supernova');
      } else if (e.key === '3') {
        this.setTheme('cyber_core');
      }
    };
    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      if (mx >= 20 && mx <= 190 && my >= canvas.height - 44 && my <= canvas.height - 12) {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('mousedown', this.clickHandler);
  }

  private setTheme(id: AntimatterThemeId): void {
    this.themeId = id;
    this.currentMapName = THEMES[id].name;
    this.audio.playTap();
  }

  private cleanupControls(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('mousedown', this.clickHandler);
      this.clickHandler = null;
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.stations.clear();
    this.orbs = [];
    this.callouts = [];
    this.animTime = 0;
    this.screenShake = 0;
    this.suddenDeathAnnounced = false;

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const angle = normalizeAngle((idx / count) * Math.PI * 2);
      this.stations.set(p.id, {
        id: p.id,
        angle,
        angularVel: 0,
        dist: 154,
        orbitDir: idx % 2 === 0 ? 1 : -1,
        coreEnergy: 42 + (idx % 3) * 8,
        energyRate: 28 + Math.random() * 14,
        charge: 0,
        charging: false,
        pulseAnim: 0,
        score: 0,
        combo: 0,
        breachTimer: 0,
        shuntCooldown: 0,
        pulsesLanded: 0,
        empShunts: 0,
        botReactionTimer: 0.14,
        botReleaseThreshold: 0.82,
      });
    });

    this.spawnOrbs();
  }

  private spawnOrbs(): void {
    for (let i = 0; i < 5; i++) {
      this.orbs.push({
        id: ++this.orbIdCounter,
        angle: normalizeAngle((i / 5) * Math.PI * 2 + Math.random() * 0.5),
        dist: 154,
        value: 32,
        collected: false,
      });
    }
  }

  private spawnCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  private getLeaderScore(): number {
    let best = 0;
    this.stations.forEach((st) => {
      if (st.score > best) best = st.score;
    });
    return best;
  }

  private isUnderdog(st: CoreStation): boolean {
    return this.getLeaderScore() - st.score >= 110;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.animTime += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.cleanupControls();
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 26);
    }

    const suddenDeath = this.roundTimer <= 12.0;
    if (suddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playFanfare();
      this.spawnCallout(width * 0.5, height * 0.18, '⚛️ CRITICAL SINGULARITY SURGE (2X SCORE)! ⚛️', '#38bdf8');
    }

    const cx = width / 2;
    const cy = height / 2 + 12;
    const scoreMult = suddenDeath ? 2 : 1;

    this.updateBots(dt, width, height);

    this.stations.forEach((st) => {
      if (st.shuntCooldown > 0) st.shuntCooldown = Math.max(0, st.shuntCooldown - dt);
      if (st.pulseAnim > 0) st.pulseAnim = Math.max(0, st.pulseAnim - dt * 3.0);

      if (st.breachTimer > 0) {
        st.breachTimer = Math.max(0, st.breachTimer - dt);
        return;
      }

      st.coreEnergy += st.energyRate * (suddenDeath ? 1.25 : 1.0) * dt;

      const p = this.getPlayer(st.id);
      const underdog = this.isUnderdog(st);

      if (p && !p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(st.id);
        const justTapped = this.input.justPressed(st.id) || this.input.justAction(st.id);
        const holdAction = this.input.isActionPressed(st.id) || this.input.isPressed(st.id);

        if (Math.abs(steer) > 0.1) {
          st.angularVel += steer * (underdog ? 3.8 : 3.2) * dt;
          st.orbitDir = steer >= 0 ? 1 : -1;
        } else {
          st.angularVel += st.orbitDir * 1.15 * dt;
        }

        if (justTapped && !st.charging) {
          this.fireContainmentPulse(st, false, cx, cy, scoreMult);
        }

        if (holdAction) {
          st.charging = true;
          st.charge = Math.min(1.0, st.charge + dt * 1.1);
          // Holding magnetic coil gently dampens energy rise so you can time the release!
          st.coreEnergy = Math.max(20, st.coreEnergy - st.energyRate * 0.55 * dt);
          if (st.charge >= 1.0) {
            st.charging = false;
            st.charge = 0;
          }
        } else if (st.charging) {
          const released = st.charge;
          st.charging = false;
          st.charge = 0;
          if (released >= 0.25) {
            this.fireContainmentPulse(st, released >= 0.72 && released <= 0.98, cx, cy, scoreMult);
          }
        }
      }

      st.angularVel *= Math.pow(0.08, dt);
      st.angle = normalizeAngle(st.angle + st.angularVel * dt);

      const sx = cx + Math.cos(st.angle) * st.dist;
      const sy = cy + Math.sin(st.angle) * st.dist;

      // Collect Positron Orbs along the Tokamak Ring
      this.orbs.forEach((orb) => {
        if (orb.collected) return;
        const ox = cx + Math.cos(orb.angle) * orb.dist;
        const oy = cy + Math.sin(orb.angle) * orb.dist;
        if (Math.hypot(ox - sx, oy - sy) < 34) {
          orb.collected = true;
          const pts = orb.value * scoreMult;
          st.score += pts;
          st.combo++;
          this.audio.playCoin();
          this.particles.spawnConfetti(ox, oy, 10);
          this.spawnCallout(ox, oy - 20, `⚛️ +${pts} POSITRON!`, '#38bdf8');
        }
      });

      // Check Overload Breach
      if (st.coreEnergy >= 100) {
        if (!underdog) {
          st.breachTimer = 0.75;
          st.coreEnergy = 35;
          st.combo = 0;
          st.score = Math.max(0, st.score - 20);
          this.audio.playStun();
          this.particles.spawnExplosion(sx, sy, '#ef4444', 18);
          this.spawnCallout(sx, sy - 28, '-20 CORE BREACH!', '#ef4444');
        } else {
          st.coreEnergy = 50;
          this.audio.playBounce();
          this.spawnCallout(sx, sy - 28, 'SURGE VENT!', '#38bdf8');
        }
      }
    });

    // Elastic Engineer-to-Engineer Collisions on the Catwalk Ring
    const list = Array.from(this.stations.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const ax = cx + Math.cos(a.angle) * a.dist;
        const ay = cy + Math.sin(a.angle) * a.dist;
        const bx = cx + Math.cos(b.angle) * b.dist;
        const by = cy + Math.sin(b.angle) * b.dist;
        if (Math.hypot(bx - ax, by - ay) < 34) {
          const diff = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle));
          const dir = diff >= 0 ? 1 : -1;
          a.angularVel -= dir * 2.2;
          b.angularVel += dir * 2.2;
          this.audio.playBounce();
          this.particles.spawnSparks((ax + bx) * 0.5, (ay + by) * 0.5, '#38bdf8', 8);
        }
      }
    }

    if (this.orbs.every((o) => o.collected)) {
      this.orbs = [];
      this.spawnOrbs();
    }

    // Update Callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 30 * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  private fireContainmentPulse(
    st: CoreStation,
    isSweetSpotCharge: boolean,
    cx: number,
    cy: number,
    scoreMult: number
  ): void {
    const sx = cx + Math.cos(st.angle) * st.dist;
    const sy = cy + Math.sin(st.angle) * st.dist;
    st.pulseAnim = 1.0;

    const inGreenZone = st.coreEnergy >= 60 && st.coreEnergy <= 92;

    if (isSweetSpotCharge || inGreenZone) {
      st.pulsesLanded++;
      st.combo++;
      const basePts = isSweetSpotCharge && inGreenZone ? 85 : isSweetSpotCharge ? 65 : 42;
      const pts = (basePts + Math.min(35, st.combo * 4)) * scoreMult;
      st.score += pts;
      st.coreEnergy = Math.max(28, st.coreEnergy - 44);
      st.energyRate = 28 + Math.random() * 18;

      if (isSweetSpotCharge) {
        this.screenShake = Math.min(14, this.screenShake + 7);
        this.audio.playExplosion();
        this.particles.spawnExplosion(cx, cy, '#38bdf8', 18);
        this.spawnCallout(sx, sy - 30, `⚡ GRAVITON PULSE! +${pts}`, '#facc15');

        // EMP Flux Shunt against rival engineers!
        this.stations.forEach((other) => {
          if (other.id === st.id || other.shuntCooldown > 0) return;
          const ox = cx + Math.cos(other.angle) * other.dist;
          const oy = cy + Math.sin(other.angle) * other.dist;
          if (Math.hypot(ox - sx, oy - sy) <= 125) {
            const diff = Math.atan2(
              Math.sin(other.angle - st.angle),
              Math.cos(other.angle - st.angle)
            );
            other.angularVel += (diff >= 0 ? 1 : -1) * 3.0;
            other.coreEnergy = Math.min(96, other.coreEnergy + 20);
            other.shuntCooldown = 1.2;
            const shuntPts = 65 * scoreMult;
            st.score += shuntPts;
            st.empShunts++;
            this.audio.playStun();
            this.particles.spawnExplosion(ox, oy, '#a855f7', 14);
            this.spawnCallout(ox, oy - 28, `⚡ EMP SHUNT! +${shuntPts}`, '#e879f9');
          }
        });
      } else {
        this.audio.playScore();
        this.particles.spawnSparks(sx, sy, '#10b981', 12);
        this.spawnCallout(sx, sy - 26, `✨ STABILIZED +${pts}`, '#10b981');
      }
    } else {
      st.coreEnergy = Math.max(20, st.coreEnergy - 24);
      const pts = 15 * scoreMult;
      st.score += pts;
      this.audio.playTap();
      this.spawnCallout(sx, sy - 24, `VENT +${pts}`, '#94a3b8');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const st = this.stations.get(botId);
    if (!st || st.breachTimer > 0) return;

    const cx = width / 2;
    const cy = height / 2 + 12;
    const scoreMult = this.roundTimer <= 12.0 ? 2 : 1;

    st.botReactionTimer -= dt;
    if (st.botReactionTimer <= 0) {
      st.botReactionTimer =
        difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.22 : 0.38;
      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      if (st.coreEnergy >= 64 && !st.charging && Math.random() > blunder) {
        if (difficulty === 'bot_easy') {
          this.fireContainmentPulse(st, false, cx, cy, scoreMult);
        } else {
          st.charging = true;
          st.botReleaseThreshold = difficulty === 'bot_hard' ? 0.80 : 0.74;
        }
      }
    }

    const orb = this.orbs.find((o) => !o.collected);
    if (orb) {
      const diff = Math.atan2(Math.sin(orb.angle - st.angle), Math.cos(orb.angle - st.angle));
      st.angularVel += Math.sign(diff) * 2.6 * dt;
    } else {
      st.angularVel += st.orbitDir * 1.4 * dt;
    }

    if (st.charging) {
      st.charge = Math.min(1.0, st.charge + dt * 1.1);
      st.coreEnergy = Math.max(20, st.coreEnergy - st.energyRate * 0.55 * dt);
      if (st.charge >= st.botReleaseThreshold) {
        const released = st.charge;
        st.charging = false;
        st.charge = 0;
        this.fireContainmentPulse(
          st,
          released >= 0.72 && released <= 0.98,
          cx,
          cy,
          scoreMult
        );
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeId];
    const cx = width / 2;
    const cy = height / 2 + 12;

    ctx.save();
    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Tokamak Reactor Chamber Backdrop
    const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 330);
    bgGrad.addColorStop(0, theme.bgInner);
    bgGrad.addColorStop(1, theme.bgOuter);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Central 2.5D Antimatter Singularity & Tokamak Torus Ring
    ctx.save();
    ctx.translate(cx, cy);

    // Outer Catwalk Ring
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 154, 0, Math.PI * 2);
    ctx.stroke();

    // 6 Magnetic Induction Coils
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + this.animTime * 0.4;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(62, -6, 16, 12);
      ctx.restore();
    }

    // Throbbing Antimatter Singularity Sphere
    const pulse = Math.sin(this.animTime * 6) * 5;
    const coreGrad = ctx.createRadialGradient(-6, -6, 4, 0, 0, 48 + pulse);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.45, theme.coreStable);
    coreGrad.addColorStop(0.85, theme.coreVolatile);
    coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 48 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Render Positron Orbs
    this.orbs.forEach((orb) => {
      if (orb.collected) return;
      const ox = cx + Math.cos(orb.angle) * orb.dist;
      const oy = cy + Math.sin(orb.angle) * orb.dist;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    // 4. Render 2.5D Quantum Engineer Mascots & Containment Gauges
    this.stations.forEach((st, pId) => {
      const cfg = this.getPlayer(pId);
      const sx = cx + Math.cos(st.angle) * st.dist;
      const sy = cy + Math.sin(st.angle) * st.dist;
      const isSweetSpot = st.charge >= 0.72 && st.charge <= 0.98;
      const inGreenZone = st.coreEnergy >= 60 && st.coreEnergy <= 92;

      if (st.pulseAnim > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(56, 189, 248, ${st.pulseAnim})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(sx, sy);

      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        0,
        16,
        st.breachTimer > 0 ? 'shocked' : st.pulseAnim > 0.2 ? 'triumph' : 'focused',
        this.animTime
      );

      // Personal Core Energy Bar (60%–92% Green Zone)
      const bw = 44;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(-bw / 2 - 1, -29, bw + 2, 6);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.fillRect(-bw / 2 + bw * 0.6, -28, bw * 0.32, 4);
      ctx.fillStyle = st.coreEnergy > 92 ? '#ef4444' : inGreenZone ? '#10b981' : '#38bdf8';
      ctx.fillRect(-bw / 2, -28, (bw * Math.min(100, st.coreEnergy)) / 100, 4);

      // Hold-to-Charge Graviton Gauge (72%–98% Sweet Spot)
      if (st.charging && st.charge > 0.04) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(-bw / 2 - 1, -37, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -36, bw * 0.26, 4);
        ctx.fillStyle = isSweetSpot ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -36, bw * st.charge, 4);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? `P${pId + 1}`}: ${Math.floor(st.coreEnergy)}%`, 0, 28);
      ctx.restore();
    });

    // 5. Callouts
    this.callouts.forEach((c) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, c.life / c.maxLife);
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(c.text, c.x + 1, c.y + 1);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    });

    ctx.restore();

    // 6. Top Instruction Pill (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 245, 56, 490, 28, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '⚛️ STEER: ORBIT TOKAMAK • TAP IN GREEN ZONE OR HOLD (72–98%) GRAVITON SHUNT!',
      width / 2,
      74
    );

    // 7. Corner Score Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const st = this.stations.get(p.id);
      if (!st) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 - row * 56;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 48, 10);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${Math.floor(st.score)} pts`, cardX + 10, cardY + 37);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`⚛️${st.pulsesLanded} ⚡${st.empShunts}`, cardX + 150, cardY + 37);
    });

    // 8. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 [T] ${theme.name}`, 105, height - 24);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.stations.forEach((st, pId) => scores.set(pId, Math.floor(st.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    this.cleanupControls();
    const rankings = Array.from(this.stations.entries())
      .map(([playerId, st]) => ({ playerId, score: Math.floor(st.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    const winnerCfg = winnerId ? this.getPlayer(winnerId) : undefined;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerCfg
        ? `${winnerCfg.name} stabilized the Antimatter Core with ${rankings[0].score} pts!`
        : 'Catastrophic singularity breach!',
    };
  }
}
