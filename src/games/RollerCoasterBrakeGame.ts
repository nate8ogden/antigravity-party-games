import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type CoasterTheme = 'wooden_cyclone' | 'neon_hypercoaster' | 'alpine_bobsled';

interface ThemePalette {
  name: string;
  skyTop: string;
  skyBot: string;
  trestleColor: string;
  railMain: string;
  railGlow: string;
  accent: string;
}

const THEMES: Record<CoasterTheme, ThemePalette> = {
  wooden_cyclone: {
    name: 'Boardwalk Wooden Cyclone',
    skyTop: '#0c142c',
    skyBot: '#1e1b4b',
    trestleColor: '#78350f',
    railMain: '#fbbf24',
    railGlow: '#f59e0b',
    accent: '#ef4444',
  },
  neon_hypercoaster: {
    name: 'Cyber Steel Hypercoaster',
    skyTop: '#050814',
    skyBot: '#1e1035',
    trestleColor: '#1e293b',
    railMain: '#38bdf8',
    railGlow: '#ec4899',
    accent: '#22d3ee',
  },
  alpine_bobsled: {
    name: 'Matterhorn Timber Coaster',
    skyTop: '#082f49',
    skyBot: '#0f172a',
    trestleColor: '#475569',
    railMain: '#e2e8f0',
    railGlow: '#34d399',
    accent: '#fbbf24',
  },
};

const THEME_KEYS: CoasterTheme[] = ['wooden_cyclone', 'neon_hypercoaster', 'alpine_bobsled'];

interface TrackPickup {
  id: number;
  trackDist: number;
  lane: number; // -1, 0, 1
  kind: 'ticket' | 'golden_loop' | 'barricade';
  active: boolean;
  pulse: number;
}

interface CoasterCart {
  id: PlayerId;
  color: string;
  isBot: boolean;
  botDiff: 'bot_easy' | 'bot_normal' | 'bot_hard';
  trackDist: number;
  laneOffset: number; // -1.2 to +1.2 across shared 3-rail trestle
  targetLane: number;
  vx: number;
  speed: number;
  heat: number; // 0..1 Centrifugal G-Force heat on hairpin turns
  score: number;
  combo: number;
  braking: boolean;
  charge: number;
  holding: boolean;
  sparkBoostTimer: number;
  derailTimer: number;
  shieldTimer: number;
  underdog: boolean;
  botTimer: number;
  botTargetLane: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class RollerCoasterBrakeGame extends BaseGame {
  private carts: CoasterCart[] = [];
  private pickups: TrackPickup[] = [];
  private nextPickupId = 1;
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
        } else if (e.key === '1') {
          this.themeIdx = 0;
        } else if (e.key === '2') {
          this.themeIdx = 1;
        } else if (e.key === '3') {
          this.themeIdx = 2;
        }
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

  public reset(_width: number, _height: number): void {
    this.timeElapsed = 0;
    this.roundTime = 45;
    this.isFinished = false;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.carts = [];
    this.pickups = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startLane = idx % 2 === 0 ? -0.7 : 0.7;
      this.carts.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        botDiff: (p.type.startsWith('bot_') ? p.type : 'bot_normal') as 'bot_easy' | 'bot_normal' | 'bot_hard',
        trackDist: 0,
        laneOffset: startLane,
        targetLane: startLane,
        vx: 0,
        speed: 320,
        heat: 0,
        score: 0,
        combo: 1,
        braking: false,
        charge: 0,
        holding: false,
        sparkBoostTimer: 0,
        derailTimer: 0,
        shieldTimer: 0,
        underdog: false,
        botTimer: 0.2 + Math.random() * 0.2,
        botTargetLane: 0,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let d = 260; d < 24000; d += 180) {
      const r = Math.random();
      const lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
      this.pickups.push({
        id: this.nextPickupId++,
        trackDist: d,
        lane,
        kind: r < 0.22 ? 'golden_loop' : r < 0.76 ? 'ticket' : 'barricade',
        active: true,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  private getCurveDangerAt(dist: number): number {
    // Periodic hairpin danger zones along the shared coaster track
    const wave = Math.sin(dist * 0.0042) * Math.cos(dist * 0.0019);
    const raw = Math.max(0, Math.abs(wave) - 0.42) / 0.58;
    return Math.min(1, raw * (this.suddenDeath ? 1.25 : 1.0));
  }

  private getSlopeAt(dist: number): number {
    return Math.sin(dist * 0.0031);
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(c: CoasterCart, text: string): void {
    c.calloutText = text;
    c.calloutTimer = 1.15;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return;
    }

    this.timeElapsed += dt;
    const remaining = Math.max(0, this.roundTime - this.timeElapsed);
    if (remaining <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playBuzzer();
      this.carts.forEach((c) => this.showCallout(c, 'CYCLONE OVERDRIVE 2X!'));
    }

    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    this.updateBots(dt, width, height);

    const maxScore = Math.max(0, ...this.carts.map((c) => c.score));
    const leadDist = Math.max(0, ...this.carts.map((c) => c.trackDist));

    for (const c of this.carts) {
      c.underdog = maxScore - c.score >= 160;
      if (c.calloutTimer > 0) c.calloutTimer = Math.max(0, c.calloutTimer - dt);
      if (c.sparkBoostTimer > 0) c.sparkBoostTimer = Math.max(0, c.sparkBoostTimer - dt);
      if (c.shieldTimer > 0) c.shieldTimer = Math.max(0, c.shieldTimer - dt);

      if (c.derailTimer > 0) {
        c.derailTimer = Math.max(0, c.derailTimer - dt);
        c.speed = 110;
        c.trackDist += c.speed * dt;
        continue;
      }

      const steer = this.input.getSteer(c.id);
      const justTap = this.input.justPressed(c.id) || this.input.justAction(c.id);
      const isHold = this.input.isActionPressed(c.id) || this.input.isPressed(c.id);

      // Lateral rail switching with zero dead-zone and snappy damping
      const latAccel = 7.5 * (c.underdog ? 1.15 : 1.0);
      c.vx += steer * latAccel * dt;
      c.vx *= Math.pow(0.08, dt);
      c.laneOffset = Math.max(-1.15, Math.min(1.15, c.laneOffset + c.vx * dt * 2.4));

      // Tap switches rail cleanly if no analog steer
      if (justTap && Math.abs(steer) < 0.2) {
        c.vx += (c.laneOffset > 0 ? -1 : 1) * 1.9;
        this.audio.playTap();
      }

      // Hold-to-charge Magnetic Friction Brake & Spark Boost (72%-98% Sweet Spot)
      const danger = this.getCurveDangerAt(c.trackDist);
      const slope = this.getSlopeAt(c.trackDist);

      if (isHold) {
        c.holding = true;
        c.braking = true;
        c.charge = Math.min(1, c.charge + dt * 0.88);
        // Braking cools centrifugal heat rapidly and banks spark energy on curves
        c.heat = Math.max(0, c.heat - dt * 1.35);
        if (danger > 0.45 && Math.random() < 0.4) {
          this.particles.spawnSparks(width * 0.5 + c.laneOffset * 110, height * 0.65, '#fbbf24', 2);
        }
      } else {
        c.braking = false;
        if (c.holding) {
          if (c.charge >= 0.72 && c.charge <= 0.98) {
            // Sweet Spot Spark-Rail Slingshot!
            c.sparkBoostTimer = 2.1;
            c.shieldTimer = 2.1;
            const bonus = (this.suddenDeath ? 90 : 65) + c.combo * 10;
            c.score += bonus;
            c.combo = Math.min(4, c.combo + 1);
            this.showCallout(c, `SPARK SLINGSHOT +${bonus}!`);
            this.audio.playBoost();
            this.triggerHitStop(45, 11);

            // Shunt nearby rival carts laterally!
            for (const other of this.carts) {
              if (other.id !== c.id && Math.abs(other.trackDist - c.trackDist) < 160) {
                const dir = other.laneOffset >= c.laneOffset ? 1 : -1;
                other.vx += dir * 3.8;
                other.heat = Math.min(1, other.heat + 0.28);
                c.score += 70;
                this.showCallout(c, 'TRESTLE RAIL SHUNT +70!');
                this.showCallout(other, 'SHUNTED!');
                this.audio.playBounce();
              }
            }
          } else if (c.charge > 0.98) {
            // Brake Lockup Overcharge
            c.speed *= 0.55;
            c.combo = 1;
            this.showCallout(c, 'BRAKE LOCKUP!');
            this.audio.playStun();
          }
          c.holding = false;
          c.charge = 0;
        }
      }

      // Slipstream drafting behind leader
      let slipstream = 1.0;
      for (const other of this.carts) {
        if (
          other.id !== c.id &&
          other.trackDist > c.trackDist &&
          other.trackDist - c.trackDist < 220 &&
          Math.abs(other.laneOffset - c.laneOffset) < 0.48
        ) {
          slipstream = 1.25;
          break;
        }
      }

      // Target speed calculation
      const baseTarget =
        (360 + slope * 75) *
        (c.sparkBoostTimer > 0 ? 1.42 : c.braking ? 0.68 : 1.0) *
        slipstream *
        (c.underdog ? 1.15 : 1.0) *
        (leadDist - c.trackDist > 260 ? 1.18 : 1.0);

      c.speed += (baseTarget - c.speed) * Math.min(1, dt * 5.5);
      c.trackDist += c.speed * dt;

      // Centrifugal heat build-up on danger curves: leaning into the curve or braking cancels heat!
      const curveDir = Math.cos(c.trackDist * 0.0042) >= 0 ? 1 : -1;
      const isLeaningIntoCurve = (curveDir > 0 && steer > 0.15) || (curveDir < 0 && steer < -0.15);

      if (danger > 0.35 && !c.braking && c.shieldTimer <= 0) {
        // Leaning into the curve cuts centrifugal G-force build-up in half!
        const leanFactor = isLeaningIntoCurve ? 0.35 : 1.0;
        const excess = Math.max(0, (c.speed - 310) / 150);
        c.heat += danger * (0.32 + excess * 0.5) * leanFactor * dt;

        if (isLeaningIntoCurve && Math.random() < 0.25) {
          this.particles.spawnSparks(width * 0.5 + c.laneOffset * 110, height * 0.65, '#38bdf8', 1);
        }

        if (c.heat >= 1.0) {
          c.heat = 0;
          c.derailTimer = 0.95;
          c.combo = 1;
          c.score = Math.max(0, c.score - 20);
          this.showCallout(c, 'RAIL WOBBLE! -20');
          this.audio.playExplosion();
          this.triggerHitStop(35, 10);
        }
      } else if (!isHold) {
        c.heat = Math.max(0, c.heat - dt * 0.75);
      }

      // Passive distance score
      c.score += c.speed * dt * 0.045 * (this.suddenDeath ? 2 : 1);

      // Pickup collisions
      for (const pk of this.pickups) {
        if (!pk.active) continue;
        if (
          Math.abs(pk.trackDist - c.trackDist) < 42 &&
          Math.abs(pk.lane * 0.85 - c.laneOffset) < 0.45
        ) {
          pk.active = false;
          if (pk.kind === 'ticket') {
            const pts = 45 * c.combo * (this.suddenDeath ? 2 : 1);
            c.score += pts;
            c.combo = Math.min(4, c.combo + 1);
            this.showCallout(c, `THRILL TICKET +${pts}`);
            this.audio.playScore();
          } else if (pk.kind === 'golden_loop') {
            const pts = 95 * (this.suddenDeath ? 2 : 1);
            c.score += pts;
            c.sparkBoostTimer = Math.max(c.sparkBoostTimer, 1.5);
            this.showCallout(c, `GOLDEN LOOP +${pts}!`);
            this.audio.playChime();
          } else if (pk.kind === 'barricade') {
            if (c.sparkBoostTimer > 0 || c.shieldTimer > 0 || c.underdog) {
              c.score += 55;
              this.showCallout(c, 'SMASHED BARRICADE +55!');
              this.audio.playBounce();
            } else {
              c.speed *= 0.52;
              c.heat = Math.min(0.95, c.heat + 0.35);
              c.combo = 1;
              this.showCallout(c, 'RAIL BARRICADE!');
              this.audio.playStun();
              this.triggerHitStop(40, 9);
            }
          }
        }
      }
    }

    // Mandatory Elastic Cart-to-Cart Bumping (m1*v1 + m2*v2)
    for (let i = 0; i < this.carts.length; i++) {
      for (let j = i + 1; j < this.carts.length; j++) {
        const a = this.carts[i];
        const b = this.carts[j];
        const dDist = Math.abs(a.trackDist - b.trackDist);
        const dLane = a.laneOffset - b.laneOffset;
        if (dDist < 58 && Math.abs(dLane) < 0.48) {
          const push = dLane >= 0 ? 1 : -1;
          const force = 2.4 * (a.underdog || b.underdog ? 1.35 : 1.0);
          a.vx += push * force;
          b.vx -= push * force;
          a.laneOffset += push * 0.08;
          b.laneOffset -= push * 0.08;
          this.audio.playBounce();
          this.triggerHitStop(35, 7);
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
    const bot = this.carts.find((c) => c.id === botId);
    if (!bot || bot.derailTimer > 0) return;

    bot.botTimer -= dt;
    const danger = this.getCurveDangerAt(bot.trackDist);

    if (bot.botTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.24 : 0.34;
      bot.botTimer = delay + Math.random() * 0.1;

      const blunderRate = difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.12 : 0.04;
      if (Math.random() < blunderRate) {
        bot.botTargetLane = [-0.85, 0, 0.85][Math.floor(Math.random() * 3)];
      } else {
        // Look ahead for golden loops or tickets, avoid barricades
        let bestLane = bot.laneOffset;
        let bestVal = -999;
        for (const laneCandidate of [-0.85, 0, 0.85]) {
          let val = -Math.abs(laneCandidate - bot.laneOffset) * 10;
          for (const pk of this.pickups) {
            if (!pk.active) continue;
            const d = pk.trackDist - bot.trackDist;
            if (d > 20 && d < 280 && Math.abs(pk.lane * 0.85 - laneCandidate) < 0.35) {
              if (pk.kind === 'golden_loop') val += 90;
              else if (pk.kind === 'ticket') val += 45;
              else if (pk.kind === 'barricade') val -= 80;
            }
          }
          if (val > bestVal) {
            bestVal = val;
            bestLane = laneCandidate;
          }
        }
        bot.botTargetLane = bestLane + (Math.random() - 0.5) * 0.14;
      }
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const diffLane = bot.botTargetLane - bot.laneOffset;
    if (Math.abs(diffLane) > 0.12) {
      bot.vx += Math.sign(diffLane) * 6.2 * dt;
    }

    // Brake on high heat or charge Sweet Spot slingshot
    const wantHold =
      (bot.heat > 0.55 && danger > 0.4) ||
      (bot.holding && bot.charge < bot.botChargeGoal) ||
      (!bot.holding && danger > 0.5 && Math.random() < 0.35);

    this.input.setBotState(botId, wantHold);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[THEME_KEYS[this.themeIdx]];
    ctx.save();

    if (this.shakeTimer > 0) {
      const s = this.shakeIntensity * (this.shakeTimer / 0.22);
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // Sky Backdrop
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(1, pal.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const leadDist = Math.max(100, ...this.carts.map((c) => c.trackDist));
    const camDist = leadDist - 120;

    // Background Carnival / Mountain Silhouette
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 9; i++) {
      const hx = ((i * 190 - camDist * 0.08) % (width + 220) + width + 220) % (width + 220) - 110;
      ctx.beginPath();
      ctx.arc(hx, height * 0.35, 95, Math.PI, 0);
      ctx.fill();
    }

    // 2.5D Perspective Shared 3-Rail Coaster Track
    const horizonY = height * 0.22;
    const bottomY = height * 0.92;
    const centerX = width * 0.5;

    for (let step = 28; step >= 0; step--) {
      const t0 = step / 28;
      const t1 = (step + 1) / 28;
      const y0 = horizonY + Math.pow(1 - t0, 1.45) * (bottomY - horizonY);
      const y1 = horizonY + Math.pow(1 - t1, 1.45) * (bottomY - horizonY);
      const w0 = 70 + (1 - t0) * (width * 0.56);
      const w1 = 70 + (1 - t1) * (width * 0.56);

      const segDist = camDist + t0 * 440;
      const curveShift0 = Math.sin(segDist * 0.0042) * 95 * t0;
      const curveShift1 = Math.sin((camDist + t1 * 440) * 0.0042) * 95 * t1;
      const danger = this.getCurveDangerAt(segDist);

      // Wooden/Steel Trestle Ties
      ctx.strokeStyle = danger > 0.45 ? 'rgba(239,68,68,0.65)' : pal.trestleColor;
      ctx.lineWidth = Math.max(2, (1 - t0) * 6);
      ctx.beginPath();
      ctx.moveTo(centerX + curveShift0 - w0 * 0.5, y0);
      ctx.lineTo(centerX + curveShift0 + w0 * 0.5, y0);
      ctx.stroke();

      // 3 Lanes of Steel Rails
      for (const lane of [-0.85, 0, 0.85]) {
        ctx.strokeStyle = danger > 0.45 ? '#ef4444' : pal.railMain;
        ctx.lineWidth = Math.max(1.5, (1 - t0) * 4);
        ctx.beginPath();
        ctx.moveTo(centerX + curveShift0 + lane * w0 * 0.42, y0);
        ctx.lineTo(centerX + curveShift1 + lane * w1 * 0.42, y1);
        ctx.stroke();
      }
    }

    // Render Pickups on Track
    for (const pk of this.pickups) {
      if (!pk.active) continue;
      const rel = pk.trackDist - camDist;
      if (rel < -20 || rel > 440) continue;
      const t = Math.max(0, Math.min(1, rel / 440));
      const py = horizonY + Math.pow(1 - t, 1.45) * (bottomY - horizonY);
      const pw = 70 + (1 - t) * (width * 0.56);
      const curveShift = Math.sin(pk.trackDist * 0.0042) * 95 * t;
      const px = centerX + curveShift + pk.lane * 0.85 * pw * 0.42;
      const sc = 0.35 + (1 - t) * 0.85;

      ctx.save();
      ctx.translate(px, py - 12 * sc);
      ctx.scale(sc, sc);
      if (pk.kind === 'golden_loop') {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★95', 0, 4);
      } else if (pk.kind === 'ticket') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-12, -8, 24, 16);
        ctx.strokeStyle = '#e0f2fe';
        ctx.strokeRect(-12, -8, 24, 16);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-16, -10, 32, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WARN', 0, 4);
      }
      ctx.restore();
    }

    // Render Player Coaster Carts
    const sortedCarts = [...this.carts].sort((a, b) => b.trackDist - a.trackDist);
    for (const c of sortedCarts) {
      const rel = Math.max(10, Math.min(390, c.trackDist - camDist));
      const t = Math.max(0.04, Math.min(0.88, rel / 440));
      const py = horizonY + Math.pow(1 - t, 1.45) * (bottomY - horizonY);
      const pw = 70 + (1 - t) * (width * 0.56);
      const curveShift = Math.sin(c.trackDist * 0.0042) * 95 * t;
      const px = centerX + curveShift + c.laneOffset * pw * 0.42;
      const sc = 0.55 + (1 - t) * 0.65;

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(sc, sc);

      // Sweet Spot Charge Ring
      if (c.holding && c.charge > 0.05) {
        const inSweet = c.charge >= 0.72 && c.charge <= 0.98;
        ctx.strokeStyle = inSweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = inSweet ? 5 : 3;
        ctx.beginPath();
        ctx.arc(0, -14, 34, -Math.PI / 2, -Math.PI / 2 + c.charge * Math.PI * 2);
        ctx.stroke();
      }

      // Underdog or Spark Shield Aura
      if (c.sparkBoostTimer > 0 || c.underdog) {
        ctx.strokeStyle = c.sparkBoostTimer > 0 ? '#38bdf8' : '#f43f5e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -12, 30, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2.5D Coaster Cart Body with banking lean
      const trackCurveNow = Math.cos(c.trackDist * 0.0042) * 0.28;
      const totalLean = Math.max(-0.45, Math.min(0.45, c.vx * 0.08 + trackCurveNow));

      ctx.save();
      ctx.rotate(totalLean);

      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(-24, -22, 48, 26, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Centrifugal Heat Bar on Cart
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-20, 8, 40, 5);
      ctx.fillStyle = c.heat > 0.7 ? '#ef4444' : '#fbbf24';
      ctx.fillRect(-20, 8, 40 * Math.min(1, c.heat), 5);

      const mood =
        c.derailTimer > 0
          ? 'shocked'
          : c.sparkBoostTimer > 0
          ? 'triumph'
          : c.holding
          ? 'focused'
          : 'happy';
      this.drawPlayerMascot(ctx, c.id, 0, -28, 15, mood, this.timeElapsed, totalLean * 0.7);
      ctx.restore();

      if (c.calloutTimer > 0 && c.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(c.calloutText, 0, -54);
      }

      ctx.restore();
    }

    // Top HUD
    const remaining = Math.max(0, Math.ceil(this.roundTime - this.timeElapsed));
    ctx.fillStyle = 'rgba(15,23,42,0.82)';
    ctx.fillRect(0, 0, width, 46);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `🎢 ROLLER COASTER BRAKE • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X OVERDRIVE' : ''}`,
      width * 0.5,
      19
    );

    this.carts.forEach((c, idx) => {
      const hx = 90 + idx * 170;
      ctx.fillStyle = c.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${c.id}: ${Math.round(c.score)} pts (${c.combo}x)`, hx, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.carts].sort((a, b) => b.score - a.score);
    const rankings = sorted.map((c, i) => ({
      playerId: c.id,
      score: Math.round(c.score),
      place: i + 1,
    }));
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings,
      mvpHighlight: `Coaster Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
