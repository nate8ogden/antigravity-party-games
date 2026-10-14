import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ElevatorTheme = 'terran_tether' | 'lunar_skyhook' | 'cyber_spire';

interface ThemePalette {
  name: string;
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  planetHorizon: string;
  ribbonColor: string;
  ringColor: string;
  arcColor: string;
  accent: string;
}

const THEMES: Record<ElevatorTheme, ThemePalette> = {
  terran_tether: {
    name: 'New Mombasa Tether',
    bgTop: '#020617',
    bgMid: '#0f172a',
    bgBottom: '#0369a1',
    planetHorizon: '#38bdf8',
    ribbonColor: '#94a3b8',
    ringColor: '#00e5ff',
    arcColor: '#facc15',
    accent: '#38bdf8',
  },
  lunar_skyhook: {
    name: 'Luna Skyhook',
    bgTop: '#030308',
    bgMid: '#18181b',
    bgBottom: '#3f3f46',
    planetHorizon: '#e4e4e7',
    ribbonColor: '#facc15',
    ringColor: '#2dd4bf',
    arcColor: '#f43f5e',
    accent: '#facc15',
  },
  cyber_spire: {
    name: 'Neo-Babel Spire',
    bgTop: '#090214',
    bgMid: '#240b36',
    bgBottom: '#4c1d95',
    planetHorizon: '#ec4899',
    ribbonColor: '#c084fc',
    ringColor: '#00e5ff',
    arcColor: '#ff2a85',
    accent: '#00e5ff',
  },
};

const THEME_ORDER: ElevatorTheme[] = ['terran_tether', 'lunar_skyhook', 'cyber_spire'];

interface TetherFeature {
  id: number;
  y: number;
  ribbon: number; // 0, 1, 2
  type: 'boost_ring' | 'super_cell' | 'lightning_arc';
  resolvedBy: Set<PlayerId>;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

interface ClimberCar {
  id: PlayerId;
  x: number;
  carY: number;
  targetRibbon: number; // 0, 1, 2
  vy: number;
  speed: number;
  altitude: number;
  score: number;
  combo: number;
  staggerTimer: number;
  pulseCooldown: number;
  magSurgeTimer: number;
  charging: boolean;
  charge: number;
  overchargeLockout: number;
  lastTapTime: number;
  isUnderdog: boolean;
  botReleaseTarget: number;
}

export class SpaceElevatorGame extends BaseGame {
  public cars: Map<PlayerId, ClimberCar> = new Map();
  public currentMapName: string = 'New Mombasa Tether';
  private theme: ElevatorTheme = 'terran_tether';
  private animTime: number = 0;
  private screenShake: number = 0;
  private hazardIdCounter: number = 0;
  private features: TetherFeature[] = [];
  private spawnTimer: number = 0.7;
  private floatingTexts: FloatingText[] = [];
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private suddenDeathAlerted: boolean = false;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 40.0;
  }

  private triggerScreenShake(amt: number): void {
    this.screenShake = Math.max(this.screenShake, amt);
  }

  private getRibbonX(ribbon: number, width: number): number {
    const cx = width * 0.5;
    const spacing = Math.min(width * 0.22, 145);
    return cx + (Math.max(0, Math.min(2, ribbon)) - 1) * spacing;
  }

  public init(width: number, height: number): void {
    this.theme = THEME_ORDER[Math.floor(Math.random() * THEME_ORDER.length)];
    this.currentMapName = THEMES[this.theme].name;
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 40.0;
    this.animTime = 0;
    this.suddenDeathAlerted = false;
    this.cars.clear();
    this.features = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.spawnTimer = 0.65;

    for (let i = 0; i < 4; i++) {
      this.features.push({
        id: ++this.hazardIdCounter,
        y: 120 + i * 110,
        ribbon: i % 3,
        type: i % 2 === 0 ? 'boost_ring' : 'super_cell',
        resolvedBy: new Set(),
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const ribbon = idx % 3;
      const rx = this.getRibbonX(ribbon, width);
      this.cars.set(p.id, {
        id: p.id,
        x: rx,
        carY: height * 0.66 - (idx % 2) * 34,
        targetRibbon: ribbon,
        vy: 0,
        speed: 170,
        altitude: 0,
        score: 0,
        combo: 0,
        staggerTimer: 0,
        pulseCooldown: 0,
        magSurgeTimer: 0,
        charging: false,
        charge: 0,
        overchargeLockout: 0,
        lastTapTime: -10,
        isUnderdog: false,
        botReleaseTarget: 0.84,
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  protected onKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
      this.theme = THEME_ORDER[idx];
      this.currentMapName = THEMES[this.theme].name;
      this.audio.playTap();
    } else if (e.key === '1') {
      this.theme = 'terran_tether';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '2') {
      this.theme = 'lunar_skyhook';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '3') {
      this.theme = 'cyber_spire';
      this.currentMapName = THEMES[this.theme].name;
    }
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): void {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
      this.theme = THEME_ORDER[idx];
      this.currentMapName = THEMES[this.theme].name;
      this.audio.playTap();
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    const clampedDt = Math.min(dt, 0.05);
    this.animTime += clampedDt;

    this.roundTimer = Math.max(0, this.roundTimer - clampedDt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    const isSuddenDeath = this.roundTimer <= 12.0;
    if (isSuddenDeath && !this.suddenDeathAlerted) {
      this.suddenDeathAlerted = true;
      this.audio.playFanfare();
      this.triggerScreenShake(7);
      this.floatingTexts.push({
        x: width * 0.5,
        y: 104,
        text: '⚡ GEOSYNCHRONOUS OVERDRIVE! 2X INDUCTION POINTS! ⚡',
        color: '#facc15',
        alpha: 1.5,
        vy: -20,
      });
    }

    // Underdog Check
    let maxScore = 0;
    this.cars.forEach((c) => {
      if (c.score > maxScore) maxScore = c.score;
    });
    this.cars.forEach((c) => {
      c.isUnderdog = maxScore - c.score >= 150;
    });

    const scrollSpeed = isSuddenDeath ? 240 : 190;

    // Spawn shared features along the 3 Tether Ribbons
    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = isSuddenDeath ? 0.52 : 0.78;
      const ribbon = Math.floor(Math.random() * 3);
      const roll = Math.random();
      const type: TetherFeature['type'] =
        roll < 0.45 ? 'boost_ring' : roll < 0.72 ? 'lightning_arc' : 'super_cell';
      this.features.push({
        id: ++this.hazardIdCounter,
        y: 75,
        ribbon,
        type,
        resolvedBy: new Set(),
      });
    }

    this.updateBots(clampedDt, width, height);

    const sdMult = isSuddenDeath ? 2 : 1;

    // Update Climber Cars
    this.cars.forEach((c) => {
      const p = this.getPlayer(c.id);
      if (c.staggerTimer > 0) c.staggerTimer = Math.max(0, c.staggerTimer - clampedDt);
      if (c.pulseCooldown > 0) c.pulseCooldown = Math.max(0, c.pulseCooldown - clampedDt);
      if (c.magSurgeTimer > 0) c.magSurgeTimer = Math.max(0, c.magSurgeTimer - clampedDt);
      if (c.overchargeLockout > 0) c.overchargeLockout = Math.max(0, c.overchargeLockout - clampedDt);

      c.altitude += c.speed * clampedDt * 0.45;
      c.speed = Math.max(120, c.speed - 38 * clampedDt);

      if (p && !p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(c.id);
        const holding = this.input.isActionPressed(c.id) || this.input.isPressed(c.id);
        const justPressed = this.input.justPressed(c.id) || this.input.justAction(c.id);
        const released = this.input.justReleased(c.id);

        if (c.staggerTimer <= 0) {
          if (steer < -0.45 && Math.abs(c.x - this.getRibbonX(c.targetRibbon, width)) < 18) {
            c.targetRibbon = Math.max(0, c.targetRibbon - 1);
          } else if (steer > 0.45 && Math.abs(c.x - this.getRibbonX(c.targetRibbon, width)) < 18) {
            c.targetRibbon = Math.min(2, c.targetRibbon + 1);
          }

          if (justPressed) {
            if (this.animTime - c.lastTapTime < 0.25) {
              c.targetRibbon = (c.targetRibbon + 1) % 3;
            }
            c.lastTapTime = this.animTime;
            if (c.overchargeLockout <= 0) {
              c.charging = true;
              c.charge = 0;
            }
          }

          if (holding && c.charging && c.overchargeLockout <= 0) {
            c.charge += clampedDt * 0.95;
            if (c.charge >= 1.0) {
              c.charging = false;
              c.charge = 0;
              c.overchargeLockout = 0.95;
              this.audio.playStun();
              this.particles.spawnExplosion(c.x, c.carY, '#ef4444', 12);
              this.floatingTexts.push({
                x: c.x,
                y: c.carY - 26,
                text: 'COIL OVERLOAD!',
                color: '#ef4444',
                alpha: 1,
                vy: -30,
              });
            }
          }

          if (released && c.charging) {
            const ch = c.charge;
            c.charging = false;
            c.charge = 0;
            this.pulseClimber(c, ch >= 0.72 && ch <= 0.98, width, sdMult);
          }
        } else {
          c.charging = false;
          c.charge = 0;
        }
      }

      const desiredX = this.getRibbonX(c.targetRibbon, width);
      c.x += (desiredX - c.x) * Math.min(1, clampedDt * 12);

      // Vertical position reflects speed relative to pack
      const targetY = height * 0.68 - ((c.speed - 120) / 260) * 140;
      c.carY += (targetY - c.carY + c.vy * clampedDt) * Math.min(1, clampedDt * 8);
      c.vy *= Math.pow(0.08, clampedDt);
    });

    // Elastic Pod-to-Pod Collisions
    const carArr = Array.from(this.cars.values());
    for (let i = 0; i < carArr.length; i++) {
      for (let j = i + 1; j < carArr.length; j++) {
        const a = carArr[i];
        const b = carArr[j];
        const dx = b.x - a.x;
        const dy = b.carY - a.carY;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;
        if (dist < minDist && dist > 0.01) {
          const ny = dy / dist;
          a.carY -= ny * 10;
          b.carY += ny * 10;
          if (a.targetRibbon === b.targetRibbon) {
            b.targetRibbon = (b.targetRibbon + 1) % 3;
          }
          this.particles.spawnSparks((a.x + b.x) * 0.5, (a.carY + b.carY) * 0.5, '#00e5ff', 10);
          this.audio.playBounce();
        }
      }
    }

    // Update Features & Climber Collisions
    for (let i = this.features.length - 1; i >= 0; i--) {
      const f = this.features[i];
      f.y += scrollSpeed * clampedDt;
      const fx = this.getRibbonX(f.ribbon, width);

      this.cars.forEach((c) => {
        if (f.resolvedBy.has(c.id)) return;
        if (Math.abs(fx - c.x) < 28 && Math.abs(f.y - c.carY) < 30) {
          f.resolvedBy.add(c.id);
          if (f.type === 'boost_ring') {
            c.combo = Math.min(6, c.combo + 1);
            const pts = (45 + c.combo * 6) * sdMult;
            c.score += pts;
            c.speed = Math.min(360, c.speed + 70);
            this.audio.playChime();
            this.particles.spawnSparks(c.x, c.carY, '#00e5ff', 14);
            this.floatingTexts.push({
              x: c.x,
              y: c.carY - 24,
              text: `BOOST RING +${pts}`,
              color: '#00e5ff',
              alpha: 1,
              vy: -34,
            });
          } else if (f.type === 'super_cell') {
            c.combo = Math.min(6, c.combo + 1);
            const pts = (65 + c.combo * 8) * sdMult;
            c.score += pts;
            c.speed = Math.min(380, c.speed + 90);
            this.audio.playCoin();
            this.particles.spawnExplosion(c.x, c.carY, '#facc15', 16);
            this.floatingTexts.push({
              x: c.x,
              y: c.carY - 26,
              text: `⚡ SUPER CELL! +${pts}`,
              color: '#facc15',
              alpha: 1.1,
              vy: -36,
            });
          } else if (f.type === 'lightning_arc') {
            if (c.magSurgeTimer > 0) {
              // Mag-Surge armor shatters lightning arc!
              const pts = 75 * sdMult;
              c.score += pts;
              this.audio.playExplosion();
              this.particles.spawnExplosion(fx, f.y, '#00e5ff', 20);
              this.floatingTexts.push({
                x: c.x,
                y: c.carY - 26,
                text: `⚡ ARC SHATTERED! +${pts}`,
                color: '#00e5ff',
                alpha: 1.15,
                vy: -38,
              });
            } else {
              c.speed = 95;
              c.staggerTimer = 0.8;
              c.combo = 0;
              c.score = Math.max(0, c.score - 20);
              this.audio.playStun();
              this.triggerScreenShake(4);
              this.particles.spawnExplosion(c.x, c.carY, '#ef4444', 18);
              this.floatingTexts.push({
                x: c.x,
                y: c.carY - 24,
                text: 'CABLE ARC SHOCK! -20',
                color: '#ef4444',
                alpha: 1,
                vy: -30,
              });
            }
          }
        }
      });

      if (f.y > height + 50) {
        this.features.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.9;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private pulseClimber(c: ClimberCar, isSweetSpot: boolean, width: number, sdMult: number): void {
    if (c.pulseCooldown > 0 && !isSweetSpot) return;
    c.pulseCooldown = 0.35;

    const nearbyRing = this.features.find(
      (f) =>
        !f.resolvedBy.has(c.id) &&
        (f.type === 'boost_ring' || f.type === 'super_cell') &&
        Math.abs(this.getRibbonX(f.ribbon, width) - c.x) < 34 &&
        Math.abs(f.y - c.carY) < 62
    );

    if (isSweetSpot) {
      c.magSurgeTimer = 1.5;
      c.speed = Math.min(390, c.speed + 125);
      c.combo = Math.min(6, c.combo + 1);
      const pts = Math.round((85 + c.combo * 10) * sdMult);
      c.score += pts;
      if (nearbyRing) nearbyRing.resolvedBy.add(c.id);
      this.audio.playExplosion();
      this.triggerScreenShake(6);
      this.particles.spawnExplosion(c.x, c.carY, '#facc15', 22);
      this.floatingTexts.push({
        x: c.x,
        y: c.carY - 28,
        text: `🚀 MAG-RAIL OVERDRIVE! +${pts}`,
        color: '#facc15',
        alpha: 1.2,
        vy: -40,
      });

      // Cable-Shock Shunt against nearby rival climbers!
      this.cars.forEach((other) => {
        if (other.id === c.id) return;
        if (Math.hypot(other.x - c.x, other.carY - c.carY) < 165) {
          other.targetRibbon = (other.targetRibbon + 1) % 3;
          other.speed = Math.max(100, other.speed - 70);
          other.staggerTimer = Math.max(other.staggerTimer, 0.55);
          c.score += 70;
          this.particles.spawnExplosion(other.x, other.carY, '#f43f5e', 18);
          this.floatingTexts.push({
            x: other.x,
            y: other.carY - 30,
            text: 'CABLE SHOCK SHUNT! +70',
            color: '#f43f5e',
            alpha: 1.2,
            vy: -42,
          });
        }
      });
    } else if (nearbyRing) {
      nearbyRing.resolvedBy.add(c.id);
      c.combo = Math.min(6, c.combo + 1);
      const pts = (70 + c.combo * 8) * sdMult;
      c.score += pts;
      c.speed = Math.min(375, c.speed + 95);
      this.audio.playScore();
      this.particles.spawnExplosion(c.x, c.carY, '#10b981', 18);
      this.floatingTexts.push({
        x: c.x,
        y: c.carY - 26,
        text: `PERFECT INDUCTION! +${pts}`,
        color: '#10b981',
        alpha: 1.1,
        vy: -36,
      });
    } else {
      // Misfired pulse outside a boost ring triggers minor Eddy-Current Brake (no free spam points!)
      c.speed = Math.max(115, c.speed - 20);
      this.audio.playTap();
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _height: number
  ): void {
    const c = this.cars.get(botId);
    if (!c || c.staggerTimer > 0 || c.overchargeLockout > 0) return;

    const isSuddenDeath = this.roundTimer <= 12.0;
    const sdMult = isSuddenDeath ? 2 : 1;

    let timer = (this.botReactionTimers.get(botId) ?? 0) - dt;
    if (timer <= 0) {
      timer =
        difficulty === 'bot_easy'
          ? 0.4 + Math.random() * 0.06
          : difficulty === 'bot_normal'
            ? 0.23 + Math.random() * 0.04
            : 0.1 + Math.random() * 0.03;

      const blunder = difficulty === 'bot_easy' ? 0.21 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      const incomingHazard = this.features.find(
        (f) =>
          !f.resolvedBy.has(botId) &&
          f.ribbon === c.targetRibbon &&
          f.y < c.carY &&
          c.carY - f.y < 140
      );

      if (incomingHazard && Math.random() >= blunder) {
        if (incomingHazard.type === 'lightning_arc') {
          if (difficulty === 'bot_hard' && !c.charging && Math.random() < 0.45) {
            c.charging = true;
            c.charge = 0;
            c.botReleaseTarget = 0.78 + Math.random() * 0.15;
          } else {
            c.targetRibbon = (c.targetRibbon + 1) % 3;
          }
        } else if (Math.abs(incomingHazard.y - c.carY) < 55) {
          this.pulseClimber(c, false, width, sdMult);
        }
      } else {
        // Move toward ribbon with upcoming boost_ring or super_cell
        const bestRing = this.features.find(
          (f) =>
            !f.resolvedBy.has(botId) &&
            (f.type === 'boost_ring' || f.type === 'super_cell') &&
            f.y < c.carY - 30 &&
            c.carY - f.y < 190
        );
        if (bestRing && Math.random() >= blunder) {
          c.targetRibbon = bestRing.ribbon;
        }
      }
    }
    this.botReactionTimers.set(botId, timer);

    if (c.charging) {
      c.charge += dt * 0.95;
      if (c.charge >= c.botReleaseTarget) {
        const ch = c.charge;
        c.charging = false;
        c.charge = 0;
        this.pulseClimber(c, ch >= 0.72 && ch <= 0.98, width, sdMult);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.cars.forEach((c, pId) => scores.set(pId, c.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.cars.entries())
      .map(([playerId, c]) => ({ playerId, score: c.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${this.getPlayer(winnerId)?.name ?? winnerId} reached Geosynchronous Orbit first!`
        : 'All climber pods stalled on the tether!',
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];

    // 1. Orbital Exosphere Sky Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, pal.bgTop);
    bgGrad.addColorStop(0.6, pal.bgMid);
    bgGrad.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Curved Planetary Limb at Bottom Horizon
    ctx.fillStyle = pal.planetHorizon;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height + 110, width * 0.75, 165, 0, Math.PI, 0);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // 3. Shared 3 Carbon-Nanotube Tether Ribbons
    for (let r = 0; r < 3; r++) {
      const rx = this.getRibbonX(r, width);
      ctx.strokeStyle = pal.ribbonColor;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(rx, 80);
      ctx.lineTo(rx, height - 40);
      ctx.stroke();

      // Cross-truss struts
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5;
      const offset = (this.animTime * 180) % 36;
      for (let y = 85 + offset; y < height - 45; y += 36) {
        ctx.beginPath();
        ctx.moveTo(rx - 6, y);
        ctx.lineTo(rx + 6, y);
        ctx.stroke();
      }
    }

    // 4. Render Descending Induction Rings, Super-Cells, & Lightning Arcs
    for (const f of this.features) {
      const fx = this.getRibbonX(f.ribbon, width);
      ctx.save();
      ctx.translate(fx, f.y);

      if (f.type === 'boost_ring') {
        ctx.strokeStyle = pal.ringColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.type === 'super_cell') {
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Crackling Electrostatic Lightning Arc
        ctx.strokeStyle = pal.arcColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-26, 0);
        ctx.lineTo(-9, -9);
        ctx.lineTo(9, 9);
        ctx.lineTo(26, 0);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 5. Render 2.5D Magnetic Climber Pods & Mascot Astronauts
    this.cars.forEach((c, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';

      ctx.save();
      ctx.translate(c.x, c.carY);

      if (c.staggerTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, 0);
      }

      if (c.magSurgeTimer > 0) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Armored Climber Pod Hull
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-18, -24, 36, 48, 10);
      ctx.fill();
      ctx.stroke();

      // Mascot Astronaut inside Panoramic Pod Window
      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        -2,
        14,
        c.staggerTimer > 0 ? 'shocked' : c.magSurgeTimer > 0 ? 'triumph' : 'focused',
        this.animTime
      );

      // Hold-to-Charge Mag-Rail Bar (72%–98% Sweet Spot)
      if (c.charging && c.charge > 0.04) {
        const bw = 42;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(-bw / 2 - 1, -36, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -35, bw * 0.26, 4);
        const isSweet = c.charge >= 0.72 && c.charge <= 0.98;
        ctx.fillStyle = isSweet ? '#facc15' : '#00e5ff';
        ctx.fillRect(-bw / 2, -35, bw * Math.min(1, c.charge), 4);
      }

      ctx.restore();
    });

    // 6. Floating Combat Text
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

    // 7. Top Instruction Banner (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 56, 520, 26, 13);
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🚡 STEER RIBBONS • TAP AT BOOST RINGS • HOLD (72–98%): MAG-OVERDRIVE & SHOCK SHUNT!',
      width * 0.5,
      73
    );

    // 8. Corner Player Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const c = this.cars.get(p.id);
      if (!c) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 + row * 40;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 34, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${c.score}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${Math.floor(c.altitude)} km • ${c.combo}x Surge`, cardX + 10, cardY + 28);
    });

    // 9. Bottom-Left Theme Pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 ${pal.name} [T]`, 105, height - 24);
  }
}
