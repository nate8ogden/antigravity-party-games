import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type GorgonThemeId = 'sanctum' | 'stygian' | 'cyber_gorgon';

interface GorgonTheme {
  name: string;
  bgInner: string;
  bgMid: string;
  bgOuter: string;
  ringColor: string;
  gazeColor: string;
  gazeFill: string;
  accent: string;
}

const THEMES: Record<GorgonThemeId, GorgonTheme> = {
  sanctum: {
    name: 'Temple of Medusa',
    bgInner: '#1e2f26',
    bgMid: '#132019',
    bgOuter: '#080e0b',
    ringColor: 'rgba(148, 163, 184, 0.35)',
    gazeColor: '#22c55e',
    gazeFill: 'rgba(34, 197, 94, 0.24)',
    accent: '#4ade80',
  },
  stygian: {
    name: 'Stygian Blood Sanctum',
    bgInner: '#31102f',
    bgMid: '#1d091c',
    bgOuter: '#0b030b',
    ringColor: 'rgba(244, 63, 94, 0.32)',
    gazeColor: '#f43f5e',
    gazeFill: 'rgba(244, 63, 94, 0.24)',
    accent: '#fb7185',
  },
  cyber_gorgon: {
    name: 'Neon Basilisk Core',
    bgInner: '#0f172a',
    bgMid: '#090d16',
    bgOuter: '#020617',
    ringColor: 'rgba(56, 189, 248, 0.32)',
    gazeColor: '#a3e635',
    gazeFill: 'rgba(163, 230, 53, 0.24)',
    accent: '#a3e635',
  },
};

const THEME_ORDER: GorgonThemeId[] = ['sanctum', 'stygian', 'cyber_gorgon'];

interface MedusaBoss {
  x: number;
  y: number;
  state: 'idle' | 'charging' | 'gazing' | 'stunned';
  stateTimer: number;
  eyeGlow: number;
  gazeAngle: number;
}

interface AthenaRelic {
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

export interface GorgonFighter {
  id: PlayerId;
  angle: number;
  angularVel: number;
  dist: number;
  orbitDir: 1 | -1;
  shieldRaised: boolean;
  charge: number;
  charging: boolean;
  ricochetAnim: number;
  petrifiedTimer: number;
  shuntCooldown: number;
  hasReflectedCurrentPulse: boolean;
  score: number;
  combo: number;
  reflections: number;
  ricochets: number;
  botReactionTimer: number;
  botReleaseThreshold: number;
}

function normalizeAngle(a: number): number {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

export class GorgonGazeGame extends BaseGame {
  public fighters: Map<PlayerId, GorgonFighter> = new Map();
  public medusa: MedusaBoss = {
    x: 0,
    y: 0,
    state: 'idle',
    stateTimer: 1.6,
    eyeGlow: 0,
    gazeAngle: 0,
  };
  public relics: AthenaRelic[] = [];
  public currentMapName: string = 'Temple of Medusa';

  private themeId: GorgonThemeId = 'sanctum';
  private callouts: Callout[] = [];
  private relicIdCounter: number = 0;
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
        this.setTheme('sanctum');
      } else if (e.key === '2') {
        this.setTheme('stygian');
      } else if (e.key === '3') {
        this.setTheme('cyber_gorgon');
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

  private setTheme(id: GorgonThemeId): void {
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
    this.fighters.clear();
    this.relics = [];
    this.callouts = [];
    this.animTime = 0;
    this.screenShake = 0;
    this.suddenDeathAnnounced = false;

    this.medusa = {
      x: width / 2,
      y: height / 2 + 12,
      state: 'idle',
      stateTimer: 1.4,
      eyeGlow: 0,
      gazeAngle: 0,
    };

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const angle = normalizeAngle((idx / count) * Math.PI * 2);
      this.fighters.set(p.id, {
        id: p.id,
        angle,
        angularVel: 0,
        dist: 156,
        orbitDir: idx % 2 === 0 ? 1 : -1,
        shieldRaised: false,
        charge: 0,
        charging: false,
        ricochetAnim: 0,
        petrifiedTimer: 0,
        shuntCooldown: 0,
        hasReflectedCurrentPulse: false,
        score: 0,
        combo: 0,
        reflections: 0,
        ricochets: 0,
        botReactionTimer: 0.14,
        botReleaseThreshold: 0.82,
      });
    });

    this.spawnRelicRing();
  }

  private spawnRelicRing(): void {
    for (let i = 0; i < 4; i++) {
      this.relics.push({
        id: ++this.relicIdCounter,
        angle: normalizeAngle((i / 4) * Math.PI * 2 + Math.random() * 0.6),
        dist: 156,
        value: 35,
        collected: false,
      });
    }
  }

  private spawnCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  private getLeaderScore(): number {
    let best = 0;
    this.fighters.forEach((f) => {
      if (f.score > best) best = f.score;
    });
    return best;
  }

  private isUnderdog(f: GorgonFighter): boolean {
    return this.getLeaderScore() - f.score >= 110;
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
      this.spawnCallout(width * 0.5, height * 0.18, '🐍 MEDUSA WRATH GAZE (2X SCORE)! 🐍', '#4ade80');
    }

    const m = this.medusa;
    m.x = width / 2;
    m.y = height / 2 + 12;
    m.gazeAngle = normalizeAngle(m.gazeAngle + (suddenDeath ? 1.8 : 1.15) * dt);
    const scoreMult = suddenDeath ? 2 : 1;

    this.updateBots(dt, width, height);

    // Update Medusa Boss State Machine
    m.stateTimer -= dt * (suddenDeath ? 1.3 : 1.0);
    if (m.state === 'idle') {
      m.eyeGlow = 0;
      if (m.stateTimer <= 0) {
        m.state = 'charging';
        m.stateTimer = 1.05;
        this.fighters.forEach((f) => (f.hasReflectedCurrentPulse = false));
        this.audio.playWhoosh();
      }
    } else if (m.state === 'charging') {
      m.eyeGlow = Math.min(1, 1 - m.stateTimer / 1.05);
      if (m.stateTimer <= 0) {
        m.state = 'gazing';
        m.stateTimer = 0.65;
        this.screenShake = Math.min(12, this.screenShake + 5);
        this.audio.playBounce();

        // Evaluate all fighters when Medusa's Petrifying Gaze erupts
        this.fighters.forEach((f) => {
          if (f.petrifiedTimer > 0) return;
          const fx = m.x + Math.cos(f.angle) * f.dist;
          const fy = m.y + Math.sin(f.angle) * f.dist;

          if (f.shieldRaised) {
            f.hasReflectedCurrentPulse = true;
            f.reflections++;
            f.combo++;
            const pts = (40 + Math.min(30, f.combo * 4)) * scoreMult;
            f.score += pts;
            // Reflecting the gaze boosts mirror charge right into the 72%-98% Sweet Spot!
            f.charge = Math.max(0.78, Math.min(0.95, f.charge + 0.25));
            this.audio.playScore();
            this.particles.spawnExplosion(fx, fy, '#4ade80', 16);
            this.spawnCallout(fx, fy - 28, `🛡️ DEFLECTED! +${pts}`, '#4ade80');
          } else if (!this.isUnderdog(f)) {
            f.petrifiedTimer = 1.35;
            f.combo = 0;
            f.score = Math.max(0, f.score - 20);
            this.audio.playStun();
            this.particles.spawnExplosion(fx, fy, '#94a3b8', 16);
            this.spawnCallout(fx, fy - 28, '🗿 -20 PETRIFIED!', '#ef4444');
          } else {
            this.audio.playBounce();
            this.spawnCallout(fx, fy - 28, 'ATHENA AEGIS ARMOR!', '#38bdf8');
          }
        });
      }
    } else if (m.state === 'gazing') {
      if (m.stateTimer <= 0) {
        m.state = 'stunned';
        m.stateTimer = 1.1;
      }
    } else if (m.state === 'stunned') {
      m.eyeGlow = 0;
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 1.2 + Math.random() * 0.7;
      }
    }

    // Update Fighters
    this.fighters.forEach((f) => {
      if (f.shuntCooldown > 0) f.shuntCooldown = Math.max(0, f.shuntCooldown - dt);
      if (f.ricochetAnim > 0) f.ricochetAnim = Math.max(0, f.ricochetAnim - dt * 3.0);

      if (f.petrifiedTimer > 0) {
        f.petrifiedTimer = Math.max(0, f.petrifiedTimer - dt);
        f.shieldRaised = false;
        f.charging = false;
        f.charge = 0;
        return;
      }

      const p = this.getPlayer(f.id);
      const underdog = this.isUnderdog(f);
      const orbitAccel = (underdog ? 3.8 : 3.2) * (f.shieldRaised ? 0.65 : 1.0);

      if (p && !p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(f.id);
        const holdAction = this.input.isActionPressed(f.id) || this.input.isPressed(f.id);

        if (Math.abs(steer) > 0.1) {
          f.angularVel += steer * orbitAccel * dt;
          f.orbitDir = steer >= 0 ? 1 : -1;
        } else {
          f.angularVel += f.orbitDir * 1.15 * dt;
        }

        if (holdAction) {
          f.shieldRaised = true;
          f.charging = true;
          f.charge = Math.min(1.0, f.charge + dt * 0.92);
          // Overcharging past 100% tarnishes the mirror (prevents infinite-hold exploit!)
          if (f.charge >= 1.0) {
            f.shieldRaised = false;
            f.charging = false;
            f.charge = 0;
            f.petrifiedTimer = 0.55;
            this.audio.playStun();
            const fx = m.x + Math.cos(f.angle) * f.dist;
            const fy = m.y + Math.sin(f.angle) * f.dist;
            this.spawnCallout(fx, fy - 28, 'MIRROR TARNISHED!', '#ef4444');
          }
        } else if (f.charging) {
          const released = f.charge;
          f.charging = false;
          f.shieldRaised = false;
          f.charge = 0;
          this.executeMirrorRicochet(f, released, scoreMult);
        } else {
          f.shieldRaised = false;
        }
      }

      f.angularVel *= Math.pow(0.08, dt);
      f.angle = normalizeAngle(f.angle + f.angularVel * dt);

      const fx = m.x + Math.cos(f.angle) * f.dist;
      const fy = m.y + Math.sin(f.angle) * f.dist;

      // Collect Athena Owl Relics along the ring
      this.relics.forEach((r) => {
        if (r.collected) return;
        const rx = m.x + Math.cos(r.angle) * r.dist;
        const ry = m.y + Math.sin(r.angle) * r.dist;
        if (Math.hypot(rx - fx, ry - fy) < 34) {
          r.collected = true;
          const pts = r.value * scoreMult;
          f.score += pts;
          f.combo++;
          this.audio.playCoin();
          this.particles.spawnConfetti(rx, ry, 10);
          this.spawnCallout(rx, ry - 20, `🦉 +${pts} ATHENA!`, '#facc15');
        }
      });
    });

    // Elastic Orbital Collisions between Fighters
    const list = Array.from(this.fighters.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const ax = m.x + Math.cos(a.angle) * a.dist;
        const ay = m.y + Math.sin(a.angle) * a.dist;
        const bx = m.x + Math.cos(b.angle) * b.dist;
        const by = m.y + Math.sin(b.angle) * b.dist;
        if (Math.hypot(bx - ax, by - ay) < 34) {
          const diff = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle));
          const dir = diff >= 0 ? 1 : -1;
          a.angularVel -= dir * 2.2;
          b.angularVel += dir * 2.2;
          this.audio.playBounce();
          this.particles.spawnSparks((ax + bx) * 0.5, (ay + by) * 0.5, '#facc15', 8);
        }
      }
    }

    if (this.relics.every((r) => r.collected)) {
      this.relics = [];
      this.spawnRelicRing();
    }

    // Update Callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 30 * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  private executeMirrorRicochet(
    f: GorgonFighter,
    chargeLevel: number,
    scoreMult: number
  ): void {
    const isSweetSpot = chargeLevel >= 0.72 && chargeLevel <= 0.98;
    const m = this.medusa;
    const fx = m.x + Math.cos(f.angle) * f.dist;
    const fy = m.y + Math.sin(f.angle) * f.dist;

    f.ricochetAnim = 1.0;

    if (isSweetSpot) {
      f.ricochets++;
      f.combo++;
      const bossPts = (f.hasReflectedCurrentPulse ? 85 : 50) * scoreMult;
      f.score += bossPts;
      this.screenShake = Math.min(14, this.screenShake + 7);
      this.audio.playExplosion();
      this.particles.spawnExplosion(m.x, m.y, '#4ade80', 18);
      this.spawnCallout(fx, fy - 32, `⚡ MIRROR RICOCHET! +${bossPts}`, '#facc15');

      // Ricochet beam petrifies & shunts nearby rival fighters!
      this.fighters.forEach((other) => {
        if (other.id === f.id || other.shuntCooldown > 0) return;
        const ox = m.x + Math.cos(other.angle) * other.dist;
        const oy = m.y + Math.sin(other.angle) * other.dist;
        if (Math.hypot(ox - fx, oy - fy) <= 125) {
          const diff = Math.atan2(Math.sin(other.angle - f.angle), Math.cos(other.angle - f.angle));
          other.angularVel += (diff >= 0 ? 1 : -1) * 3.2;
          other.petrifiedTimer = 0.75;
          other.shieldRaised = false;
          other.charging = false;
          other.charge = 0;
          other.shuntCooldown = 1.25;
          const pts = 70 * scoreMult;
          f.score += pts;
          this.audio.playStun();
          this.particles.spawnExplosion(ox, oy, '#4ade80', 14);
          this.spawnCallout(ox, oy - 30, `🐍 GAZE SHUNT! +${pts}`, '#4ade80');
        }
      });
    } else {
      this.audio.playWhoosh();
      this.particles.spawnSparks(fx, fy, '#4ade80', 8);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const f = this.fighters.get(botId);
    if (!f || f.petrifiedTimer > 0) return;

    const m = this.medusa;
    const scoreMult = this.roundTimer <= 12.0 ? 2 : 1;

    f.botReactionTimer -= dt;
    if (f.botReactionTimer <= 0) {
      f.botReactionTimer =
        difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.22 : 0.38;
      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      // Raise shield when Medusa is about to gaze
      const raiseWindow =
        difficulty === 'bot_hard' ? 0.65 : difficulty === 'bot_normal' ? 0.55 : 0.45;
      if (m.state === 'charging' && m.stateTimer <= raiseWindow && Math.random() > blunder) {
        f.shieldRaised = true;
        f.charging = true;
        f.botReleaseThreshold = difficulty === 'bot_hard' ? 0.82 : 0.75;
      } else if (m.state !== 'charging' && m.state !== 'gazing' && f.charging) {
        // Release after gaze completes!
        const released = f.charge;
        f.charging = false;
        f.shieldRaised = false;
        f.charge = 0;
        this.executeMirrorRicochet(f, released, scoreMult);
      }
    }

    // Orbit toward nearest uncollected Athena relic
    const relic = this.relics.find((r) => !r.collected);
    if (relic) {
      const diff = Math.atan2(Math.sin(relic.angle - f.angle), Math.cos(relic.angle - f.angle));
      f.angularVel += Math.sign(diff) * 2.6 * dt;
    } else {
      f.angularVel += f.orbitDir * 1.4 * dt;
    }

    if (f.charging) {
      f.charge = Math.min(0.95, f.charge + dt * 0.92);
      if (m.state === 'stunned' && f.charge >= f.botReleaseThreshold) {
        const released = f.charge;
        f.charging = false;
        f.shieldRaised = false;
        f.charge = 0;
        this.executeMirrorRicochet(f, released, scoreMult);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeId];
    const mx = width / 2;
    const my = height / 2 + 12;

    ctx.save();
    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Gorgon Sanctum Backdrop
    const bgGrad = ctx.createRadialGradient(mx, my, 36, mx, my, 320);
    bgGrad.addColorStop(0, theme.bgInner);
    bgGrad.addColorStop(0.6, theme.bgMid);
    bgGrad.addColorStop(1, theme.bgOuter);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Sanctum Orbit Ring & Doric Ruins
    ctx.strokeStyle = theme.ringColor;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(mx, my, 156, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Render Athena Owl Relics
    this.relics.forEach((r) => {
      if (r.collected) return;
      const rx = mx + Math.cos(r.angle) * r.dist;
      const ry = my + Math.sin(r.angle) * r.dist;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    // 4. Render 2.5D Medusa Boss in Center
    const m = this.medusa;
    ctx.save();
    ctx.translate(mx, my);

    if (m.state === 'charging') {
      ctx.strokeStyle = theme.gazeColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 32 + m.eyeGlow * 124, 0, Math.PI * 2);
      ctx.stroke();
    } else if (m.state === 'gazing') {
      ctx.fillStyle = theme.gazeFill;
      ctx.beginPath();
      ctx.arc(0, 0, 172, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = theme.gazeColor;
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    // Writhing Serpent Hair
    ctx.strokeStyle = theme.gazeColor;
    ctx.lineWidth = 4;
    for (let i = 0; i < 10; i++) {
      const sAngle = (i / 10) * Math.PI * 2 + Math.sin(this.animTime * 5 + i) * 0.35;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        Math.cos(sAngle) * 24,
        Math.sin(sAngle) * 24,
        Math.cos(sAngle + 0.35) * 40,
        Math.sin(sAngle + 0.35) * 40
      );
      ctx.stroke();
    }

    // Medusa Head
    ctx.fillStyle = m.state === 'stunned' ? '#64748b' : '#15803d';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Gorgon Eyes
    ctx.fillStyle = m.eyeGlow > 0 || m.state === 'gazing' ? '#fef08a' : '#090d16';
    ctx.beginPath();
    ctx.arc(-7, -3, m.eyeGlow > 0 ? 5 : 3.5, 0, Math.PI * 2);
    ctx.arc(7, -3, m.eyeGlow > 0 ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 5. Render 2.5D Perseus Mascots & Polished Bronze Aegis Mirrors
    this.fighters.forEach((f, pId) => {
      const cfg = this.getPlayer(pId);
      const fx = mx + Math.cos(f.angle) * f.dist;
      const fy = my + Math.sin(f.angle) * f.dist;
      const isSweetSpot = f.charge >= 0.72 && f.charge <= 0.98;

      // Reflected Laser Beam to Medusa on Ricochet!
      if (f.ricochetAnim > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(250, 204, 21, ${f.ricochetAnim})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(fx, fy);

      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        0,
        16,
        f.petrifiedTimer > 0 ? 'shocked' : f.ricochetAnim > 0.2 ? 'triumph' : 'focused',
        this.animTime
      );

      // Polished Bronze Mirror facing inward toward Medusa
      const inAngle = f.angle + Math.PI;
      const mirrorDist = f.shieldRaised ? 20 : 12;
      const shieldX = Math.cos(inAngle) * mirrorDist;
      const shieldY = Math.sin(inAngle) * mirrorDist;

      ctx.save();
      ctx.translate(shieldX, shieldY);
      ctx.rotate(inAngle);
      ctx.fillStyle = f.shieldRaised ? '#e2e8f0' : '#94a3b8';
      ctx.strokeStyle = isSweetSpot ? '#facc15' : '#d97706';
      ctx.lineWidth = f.shieldRaised ? 3 : 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, f.shieldRaised ? 17 : 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Hold-to-Charge Mirror Ricochet Gauge (72%–98% Sweet Spot)
      if (f.charging && f.charge > 0.04) {
        const bw = 40;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(-bw / 2 - 1, -32, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -31, bw * 0.26, 4);
        ctx.fillStyle = isSweetSpot ? '#facc15' : '#4ade80';
        ctx.fillRect(-bw / 2, -31, bw * f.charge, 4);
      }

      ctx.fillStyle = f.petrifiedTimer > 0 ? '#94a3b8' : '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        f.petrifiedTimer > 0 ? '🗿 PETRIFIED!' : `${cfg?.name ?? `P${pId + 1}`}: ${f.score}`,
        0,
        28
      );
      ctx.restore();
    });

    // 6. Callouts
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

    // 7. Top Instruction Pill (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 245, 56, 490, 28, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🐍 STEER: ORBIT • HOLD MIRROR ON GAZE & RELEASE (72–98%) FOR BEAM RICOCHET!',
      width / 2,
      74
    );

    // 8. Corner Score Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const f = this.fighters.get(p.id);
      if (!f) return;
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
      ctx.fillText(`${Math.floor(f.score)} pts`, cardX + 10, cardY + 37);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🛡️${f.reflections} ⚡${f.ricochets}`, cardX + 150, cardY + 37);
    });

    // 9. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
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
    this.fighters.forEach((f, pId) => scores.set(pId, Math.floor(f.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    this.cleanupControls();
    const rankings = Array.from(this.fighters.entries())
      .map(([playerId, f]) => ({ playerId, score: Math.floor(f.score), place: 1 }))
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
        ? `${winnerCfg.name} deflected Medusa's gaze with ${rankings[0].score} pts!`
        : 'All heroes turned to stone!',
    };
  }
}
