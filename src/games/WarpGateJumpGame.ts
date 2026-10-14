import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type WarpTheme = 'andromeda' | 'bifrost' | 'cyber_grid';

interface ThemePalette {
  name: string;
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  tunnelRing: string;
  gateFrame: string;
  apertureColor: string;
  overdriveColor: string;
  hazardArc: string;
  accent: string;
}

const THEMES: Record<WarpTheme, ThemePalette> = {
  andromeda: {
    name: 'Andromeda Conduit',
    bgTop: '#04020c',
    bgMid: '#12082b',
    bgBottom: '#060312',
    tunnelRing: 'rgba(56, 189, 248, 0.22)',
    gateFrame: '#f43f5e',
    apertureColor: '#10b981',
    overdriveColor: '#facc15',
    hazardArc: '#ef4444',
    accent: '#38bdf8',
  },
  bifrost: {
    name: 'Asgard Bifrost',
    bgTop: '#0c0617',
    bgMid: '#2e1042',
    bgBottom: '#140824',
    tunnelRing: 'rgba(250, 204, 21, 0.25)',
    gateFrame: '#f97316',
    apertureColor: '#2dd4bf',
    overdriveColor: '#fef08a',
    hazardArc: '#e11d48',
    accent: '#facc15',
  },
  cyber_grid: {
    name: 'Synthwave Vector',
    bgTop: '#050510',
    bgMid: '#1e0b36',
    bgBottom: '#090414',
    tunnelRing: 'rgba(236, 72, 153, 0.26)',
    gateFrame: '#ec4899',
    apertureColor: '#00e5ff',
    overdriveColor: '#facc15',
    hazardArc: '#ff2a85',
    accent: '#00e5ff',
  },
};

const THEME_ORDER: WarpTheme[] = ['andromeda', 'bifrost', 'cyber_grid'];

interface SharedWarpGate {
  id: number;
  z: number; // 340 (far vanishing point) down to 0 (player ring plane)
  apertureAngle: number; // center of the safe green opening
  apertureHalfWidth: number; // radians half-width (e.g. 0.65)
  overdriveAngle: number; // bonus golden slot inside aperture
  rotationSpeed: number;
  resolvedBy: Set<PlayerId>;
}

interface TachyonCell {
  id: number;
  angle: number;
  z: number;
  value: number;
  collected: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

interface StarshipPilot {
  id: PlayerId;
  angle: number; // orbital angle around tunnel cross-section
  omega: number; // angular velocity (rad/s)
  orbitDir: number; // 1 or -1 for single-button steering
  score: number;
  combo: number;
  gatesCleared: number;
  staggerTimer: number;
  warpFlash: number;
  hyperPhaseTimer: number; // temporary invulnerability / auto-clear during hyper-jump
  charging: boolean;
  charge: number;
  overchargeLockout: number;
  lastTapTime: number;
  isUnderdog: boolean;
  botTargetAngle: number;
  botReleaseTarget: number;
}

export class WarpGateJumpGame extends BaseGame {
  public pilots: Map<PlayerId, StarshipPilot> = new Map();
  public currentMapName: string = 'Andromeda Conduit';
  private theme: WarpTheme = 'andromeda';
  private animTime: number = 0;
  private gateIdCounter: number = 0;
  private sharedGates: SharedWarpGate[] = [];
  private tachyonCells: TachyonCell[] = [];
  private cellSpawnTimer: number = 1.4;
  private floatingTexts: FloatingText[] = [];
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private suddenDeathAlerted: boolean = false;
  private starAngles: { angle: number; z: number; speed: number }[] = [];

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 40.0;
  }

  private screenShake: number = 0;

  private triggerScreenShake(amt: number): void {
    this.screenShake = Math.max(this.screenShake, amt);
  }

  private normalizeAngle(a: number): number {
    return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }

  private shortestAngleDiff(from: number, to: number): number {
    let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  public init(width: number, height: number): void {
    this.theme = THEME_ORDER[Math.floor(Math.random() * THEME_ORDER.length)];
    this.currentMapName = THEMES[this.theme].name;
    this.reset(width, height);
  }

  public reset(_width: number, _height: number): void {
    this.isFinished = false;
    this.roundTimer = 40.0;
    this.animTime = 0;
    this.suddenDeathAlerted = false;
    this.pilots.clear();
    this.sharedGates = [];
    this.tachyonCells = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();

    this.starAngles = [];
    for (let i = 0; i < 42; i++) {
      this.starAngles.push({
        angle: Math.random() * Math.PI * 2,
        z: Math.random() * 340,
        speed: 140 + Math.random() * 140,
      });
    }

    // Spawn 3 initial shared Warp Gates in depth
    for (let i = 0; i < 3; i++) {
      const ap = Math.random() * Math.PI * 2;
      this.sharedGates.push({
        id: ++this.gateIdCounter,
        z: 135 + i * 115,
        apertureAngle: ap,
        apertureHalfWidth: 0.68,
        overdriveAngle: this.normalizeAngle(ap + (Math.random() - 0.5) * 0.35),
        rotationSpeed: (i % 2 === 0 ? 1 : -1) * (1.05 + i * 0.2),
        resolvedBy: new Set(),
      });
    }

    const active = this.getActivePlayers();
    const count = Math.max(active.length, 1);

    active.forEach((p, idx) => {
      const startAngle = this.normalizeAngle(Math.PI * 0.5 + (idx - (count - 1) * 0.5) * 0.55);
      this.pilots.set(p.id, {
        id: p.id,
        angle: startAngle,
        omega: 0,
        orbitDir: idx % 2 === 0 ? 1 : -1,
        score: 0,
        combo: 0,
        gatesCleared: 0,
        staggerTimer: 0,
        warpFlash: 0,
        hyperPhaseTimer: 0,
        charging: false,
        charge: 0,
        overchargeLockout: 0,
        lastTapTime: -10,
        isUnderdog: false,
        botTargetAngle: startAngle,
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
      this.theme = 'andromeda';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '2') {
      this.theme = 'bifrost';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '3') {
      this.theme = 'cyber_grid';
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

  private getPilotCoords(angle: number, width: number, height: number): { x: number; y: number; rx: number; ry: number } {
    const cx = width * 0.5;
    const cy = height * 0.51;
    const rx = Math.min(width * 0.31, 225);
    const ry = Math.min(height * 0.29, 155);
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
      rx,
      ry,
    };
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
        y: height * 0.24,
        text: '⚡ LIGHTSPEED OVERDRIVE! 2X GATE POINTS! ⚡',
        color: '#facc15',
        alpha: 1.5,
        vy: -24,
      });
    }

    // Underdog calculation
    let maxScore = 0;
    this.pilots.forEach((pl) => {
      if (pl.score > maxScore) maxScore = pl.score;
    });
    this.pilots.forEach((pl) => {
      pl.isUnderdog = maxScore - pl.score >= 160;
    });

    // Update star streaks
    for (const s of this.starAngles) {
      s.z -= s.speed * (isSuddenDeath ? 1.4 : 1.0) * clampedDt;
      if (s.z <= 5) {
        s.z = 340;
        s.angle = Math.random() * Math.PI * 2;
      }
    }

    // Spawn Tachyon Hyper-Cells
    this.cellSpawnTimer -= clampedDt;
    if (this.cellSpawnTimer <= 0 && this.tachyonCells.length < 5) {
      this.cellSpawnTimer = isSuddenDeath ? 1.2 : 1.9;
      this.tachyonCells.push({
        id: ++this.gateIdCounter,
        angle: Math.random() * Math.PI * 2,
        z: 320,
        value: isSuddenDeath ? 70 : 45,
        collected: false,
      });
    }

    for (let i = this.tachyonCells.length - 1; i >= 0; i--) {
      const tc = this.tachyonCells[i];
      tc.z -= (isSuddenDeath ? 155 : 120) * clampedDt;
      if (tc.z <= 28 && tc.z >= -12 && !tc.collected) {
        this.pilots.forEach((pl) => {
          if (tc.collected) return;
          const diff = Math.abs(this.shortestAngleDiff(pl.angle, tc.angle));
          if (diff < 0.32) {
            tc.collected = true;
            pl.score += tc.value;
            this.audio.playCoin();
            const pos = this.getPilotCoords(pl.angle, width, height);
            this.particles.spawnSparks(pos.x, pos.y, '#38bdf8', 12);
            this.floatingTexts.push({
              x: pos.x,
              y: pos.y - 24,
              text: `+${tc.value} TACHYON!`,
              color: '#38bdf8',
              alpha: 1,
              vy: -32,
            });
          }
        });
      }
      if (tc.collected || tc.z < -20) {
        this.tachyonCells.splice(i, 1);
      }
    }

    // Update approaching Shared Warp Gates
    const gateApproachSpeed = isSuddenDeath ? 132 : 102;
    for (let i = this.sharedGates.length - 1; i >= 0; i--) {
      const g = this.sharedGates[i];
      g.z -= gateApproachSpeed * clampedDt;
      g.apertureAngle = this.normalizeAngle(g.apertureAngle + g.rotationSpeed * clampedDt);
      g.overdriveAngle = this.normalizeAngle(g.overdriveAngle + g.rotationSpeed * clampedDt);

      // Gate reaches the player interceptor ring plane (z <= 18)
      if (g.z <= 18 && g.z >= -10) {
        this.pilots.forEach((pl) => {
          if (g.resolvedBy.has(pl.id)) return;
          g.resolvedBy.add(pl.id);
          this.evaluateGateCrossing(pl, g, width, height, false, 1.0);
        });
      }

      if (g.z < -25) {
        this.sharedGates.splice(i, 1);
      }
    }

    // Maintain 3 gates in the tunnel
    const furthestZ = this.sharedGates.reduce((max, g) => Math.max(max, g.z), 0);
    if (furthestZ < 260) {
      const ap = Math.random() * Math.PI * 2;
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.sharedGates.push({
        id: ++this.gateIdCounter,
        z: furthestZ + (isSuddenDeath ? 105 : 120),
        apertureAngle: ap,
        apertureHalfWidth: isSuddenDeath ? 0.58 : 0.68,
        overdriveAngle: this.normalizeAngle(ap + (Math.random() - 0.5) * 0.32),
        rotationSpeed: dir * (1.1 + Math.random() * (isSuddenDeath ? 1.1 : 0.75)),
        resolvedBy: new Set(),
      });
    }

    this.updateBots(clampedDt, width, height);

    // Update Pilots
    this.pilots.forEach((pl) => {
      const p = this.getPlayer(pl.id);
      if (pl.staggerTimer > 0) pl.staggerTimer = Math.max(0, pl.staggerTimer - clampedDt);
      if (pl.warpFlash > 0) pl.warpFlash = Math.max(0, pl.warpFlash - clampedDt * 2.5);
      if (pl.hyperPhaseTimer > 0) pl.hyperPhaseTimer = Math.max(0, pl.hyperPhaseTimer - clampedDt);
      if (pl.overchargeLockout > 0) pl.overchargeLockout = Math.max(0, pl.overchargeLockout - clampedDt);

      const pos = this.getPilotCoords(pl.angle, width, height);

      if (p && !p.type.startsWith('bot_')) {
        const move = { x: this.input.getSteer(pl.id), y: -this.input.getThrottle(pl.id) };
        const holding = this.input.isActionPressed(pl.id) || this.input.isPressed(pl.id);
        const justPressed = this.input.justPressed(pl.id) || this.input.justAction(pl.id);
        const released = this.input.justReleased(pl.id);

        if (pl.staggerTimer <= 0) {
          if (Math.abs(move.x) > 0.1 || Math.abs(move.y) > 0.1) {
            if (Math.abs(move.x) > 0.2 && Math.abs(move.y) < 0.2) {
              // Horizontal steering around tunnel ring
              const topOrBottom = Math.sin(pl.angle) >= 0 ? -1 : 1;
              pl.omega += move.x * topOrBottom * 8.5 * clampedDt;
            } else {
              const targetA = Math.atan2(move.y, move.x);
              const diff = this.shortestAngleDiff(pl.angle, targetA);
              pl.omega += Math.sign(diff) * Math.min(Math.abs(diff) * 6, 9.5) * clampedDt;
            }
          } else if (holding) {
            pl.omega += pl.orbitDir * 5.2 * clampedDt;
          }

          if (justPressed) {
            if (this.animTime - pl.lastTapTime < 0.28) {
              pl.orbitDir *= -1;
            }
            pl.lastTapTime = this.animTime;
            if (pl.overchargeLockout <= 0) {
              pl.charging = true;
              pl.charge = 0;
            }
          }

          if (holding && pl.charging && pl.overchargeLockout <= 0) {
            pl.charge += clampedDt * 0.92;
            if (pl.charge >= 1.0) {
              // Coil Overcharge!
              pl.charging = false;
              pl.charge = 0;
              pl.overchargeLockout = 1.0;
              this.audio.playStun();
              this.particles.spawnExplosion(pos.x, pos.y, '#ef4444', 14);
              this.floatingTexts.push({
                x: pos.x,
                y: pos.y - 26,
                text: 'COIL OVERLOAD!',
                color: '#ef4444',
                alpha: 1,
                vy: -30,
              });
            }
          }

          if (released && pl.charging) {
            const c = pl.charge;
            pl.charging = false;
            pl.charge = 0;
            if (c >= 0.72 && c <= 0.98) {
              this.triggerHyperJump(pl, true, width, height);
            } else {
              this.triggerHyperJump(pl, false, width, height);
            }
          }
        } else {
          pl.charging = false;
          pl.charge = 0;
        }
      }

      const maxOmega = (pl.isUnderdog ? 4.2 : 3.5) * (pl.hyperPhaseTimer > 0 ? 1.35 : 1.0);
      pl.omega = Math.max(-maxOmega, Math.min(maxOmega, pl.omega));
      pl.angle = this.normalizeAngle(pl.angle + pl.omega * clampedDt);
      pl.omega *= Math.pow(0.06, clampedDt);
    });

    // Elastic Ship-to-Ship Collision along Tunnel Perimeter
    const pilotArr = Array.from(this.pilots.values());
    for (let i = 0; i < pilotArr.length; i++) {
      for (let j = i + 1; j < pilotArr.length; j++) {
        const a = pilotArr[i];
        const b = pilotArr[j];
        const diff = this.shortestAngleDiff(a.angle, b.angle);
        const minAng = 0.25;
        if (Math.abs(diff) < minAng) {
          const push = (minAng - Math.abs(diff)) * 0.52;
          const sign = diff >= 0 ? 1 : -1;
          a.angle = this.normalizeAngle(a.angle - sign * push);
          b.angle = this.normalizeAngle(b.angle + sign * push);

          const tempOmega = a.omega;
          const boostA = a.isUnderdog ? 1.35 : 1.05;
          const boostB = b.isUnderdog ? 1.35 : 1.05;
          a.omega = (b.omega * 0.85 - sign * 2.1) * boostA;
          b.omega = (tempOmega * 0.85 + sign * 2.1) * boostB;

          const posA = this.getPilotCoords(a.angle, width, height);
          const posB = this.getPilotCoords(b.angle, width, height);
          this.particles.spawnSparks((posA.x + posB.x) * 0.5, (posA.y + posB.y) * 0.5, '#facc15', 10);
          this.audio.playBounce();
        }
      }
    }

    // Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.9;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private evaluateGateCrossing(
    pl: StarshipPilot,
    g: SharedWarpGate,
    width: number,
    height: number,
    fromHyperJump: boolean,
    bonusMult: number
  ): void {
    const pos = this.getPilotCoords(pl.angle, width, height);
    const diff = Math.abs(this.shortestAngleDiff(pl.angle, g.apertureAngle));
    const overdriveDiff = Math.abs(this.shortestAngleDiff(pl.angle, g.overdriveAngle));
    const isSuddenDeath = this.roundTimer <= 12.0;
    const sdMult = isSuddenDeath ? 2 : 1;

    const effectiveHalfWidth = g.apertureHalfWidth + (fromHyperJump ? 0.35 : 0) + (pl.hyperPhaseTimer > 0 ? 0.25 : 0);

    if (overdriveDiff < 0.26 || (fromHyperJump && bonusMult > 1.2 && diff < effectiveHalfWidth)) {
      // GOLDEN OVERDRIVE SLOT!
      pl.combo = Math.min(6, pl.combo + 1);
      pl.gatesCleared++;
      pl.warpFlash = 1.0;
      const pts = Math.round((95 + pl.combo * 12) * bonusMult * sdMult);
      pl.score += pts;
      this.audio.playScore();
      this.triggerScreenShake(bonusMult > 1.2 ? 6 : 4);
      this.particles.spawnExplosion(pos.x, pos.y, '#facc15', 22);
      this.floatingTexts.push({
        x: pos.x,
        y: pos.y - 28,
        text: bonusMult > 1.2 ? `⚡ HYPER OVERDRIVE! +${pts}` : `★ OVERDRIVE SLOT! +${pts}`,
        color: '#facc15',
        alpha: 1.2,
        vy: -42,
      });
    } else if (diff <= effectiveHalfWidth || pl.hyperPhaseTimer > 0) {
      // GREEN APERTURE CLEARED!
      pl.combo = Math.min(6, pl.combo + 1);
      pl.gatesCleared++;
      pl.warpFlash = 0.85;
      const pts = Math.round((55 + pl.combo * 10) * bonusMult * sdMult);
      pl.score += pts;
      this.audio.playChime();
      this.particles.spawnSparks(pos.x, pos.y, '#10b981', 16);
      this.floatingTexts.push({
        x: pos.x,
        y: pos.y - 24,
        text: `WARP GATE +${pts} (${pl.combo}x)`,
        color: '#10b981',
        alpha: 1.0,
        vy: -36,
      });
    } else {
      // CLIPPED RED PLASMA BARRIER!
      pl.staggerTimer = 0.75;
      pl.combo = 0;
      pl.score = Math.max(0, pl.score - 20);
      this.audio.playStun();
      this.triggerScreenShake(4);
      this.particles.spawnExplosion(pos.x, pos.y, '#ef4444', 16);
      this.floatingTexts.push({
        x: pos.x,
        y: pos.y - 24,
        text: 'GATE BARRIER HIT! -20',
        color: '#ef4444',
        alpha: 1.0,
        vy: -30,
      });
    }
  }

  private triggerHyperJump(pl: StarshipPilot, isSweetSpot: boolean, width: number, height: number): void {
    const pos = this.getPilotCoords(pl.angle, width, height);
    const nearestGate = this.sharedGates.find((g) => !g.resolvedBy.has(pl.id) && g.z <= 115 && g.z > 0);

    if (isSweetSpot) {
      pl.hyperPhaseTimer = 1.25;
      pl.warpFlash = 1.0;
      this.audio.playExplosion();
      this.triggerScreenShake(6);
      this.particles.spawnExplosion(pos.x, pos.y, '#38bdf8', 24);

      if (nearestGate) {
        nearestGate.resolvedBy.add(pl.id);
        this.evaluateGateCrossing(pl, nearestGate, width, height, true, 1.65);
      } else {
        pl.score += 45;
        this.floatingTexts.push({
          x: pos.x,
          y: pos.y - 26,
          text: '⚡ HYPER-PHASE BOOST! +45',
          color: '#38bdf8',
          alpha: 1.1,
          vy: -36,
        });
      }

      // GRAVITY-WAKE SHUNT against nearby rival ships!
      this.pilots.forEach((other) => {
        if (other.id === pl.id) return;
        const diff = this.shortestAngleDiff(pl.angle, other.angle);
        if (Math.abs(diff) < 0.75) {
          const pushSign = diff >= 0 ? 1 : -1;
          other.omega += pushSign * (pl.isUnderdog ? 6.5 : 5.0);
          other.staggerTimer = Math.max(other.staggerTimer, 0.55);
          pl.score += 70;
          const opos = this.getPilotCoords(other.angle, width, height);
          this.particles.spawnExplosion(opos.x, opos.y, '#f43f5e', 18);
          this.floatingTexts.push({
            x: opos.x,
            y: opos.y - 32,
            text: 'GRAVITY SHUNT! +70',
            color: '#f43f5e',
            alpha: 1.2,
            vy: -42,
          });
        }
      });
    } else {
      // Standard Micro-Warp Blink
      this.audio.playWhoosh();
      this.particles.spawnSparks(pos.x, pos.y, '#00e5ff', 10);
      if (nearestGate && nearestGate.z <= 85) {
        nearestGate.resolvedBy.add(pl.id);
        this.evaluateGateCrossing(pl, nearestGate, width, height, true, 1.0);
      } else {
        // Quick angular micro-dash in current orbit direction
        pl.omega += pl.orbitDir * 2.4;
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const pl = this.pilots.get(botId);
    if (!pl || pl.staggerTimer > 0 || pl.overchargeLockout > 0) return;

    let timer = (this.botReactionTimers.get(botId) ?? 0) - dt;
    if (timer <= 0) {
      const delay =
        difficulty === 'bot_easy'
          ? 0.39 + Math.random() * 0.06
          : difficulty === 'bot_normal'
            ? 0.22 + Math.random() * 0.04
            : 0.1 + Math.random() * 0.03;
      timer = delay;

      const nextGate = this.sharedGates.find((g) => !g.resolvedBy.has(botId) && g.z > 0);
      if (nextGate) {
        const isSuddenDeath = this.roundTimer <= 12.0;
        const speed = isSuddenDeath ? 132 : 102;
        const timeToArrive = Math.max(0, (nextGate.z - 15) / speed);
        const predictedAngle =
          difficulty === 'bot_hard'
            ? this.normalizeAngle(nextGate.overdriveAngle + nextGate.rotationSpeed * timeToArrive)
            : difficulty === 'bot_normal'
              ? this.normalizeAngle(nextGate.apertureAngle + nextGate.rotationSpeed * timeToArrive * 0.7)
              : nextGate.apertureAngle;

        const blunder = difficulty === 'bot_easy' ? 0.21 : difficulty === 'bot_normal' ? 0.08 : 0.0;
        pl.botTargetAngle =
          Math.random() < blunder ? this.normalizeAngle(predictedAngle + 0.9) : predictedAngle;

        const diff = Math.abs(this.shortestAngleDiff(pl.angle, pl.botTargetAngle));
        if (!pl.charging && nextGate.z < 115 && diff < 0.45 && Math.random() < (difficulty === 'bot_hard' ? 0.8 : 0.45)) {
          pl.charging = true;
          pl.charge = 0;
          pl.botReleaseTarget =
            difficulty === 'bot_hard'
              ? 0.8 + Math.random() * 0.14
              : difficulty === 'bot_normal'
                ? 0.72 + Math.random() * 0.22
                : 0.45 + Math.random() * 0.35;
        }
      }
    }
    this.botReactionTimers.set(botId, timer);

    const diff = this.shortestAngleDiff(pl.angle, pl.botTargetAngle);
    if (Math.abs(diff) > 0.05) {
      const steerAccel = difficulty === 'bot_hard' ? 8.2 : difficulty === 'bot_normal' ? 6.5 : 4.8;
      pl.omega += Math.sign(diff) * steerAccel * dt;
    }

    if (pl.charging) {
      pl.charge += dt * 0.92;
      if (pl.charge >= pl.botReleaseTarget) {
        const c = pl.charge;
        pl.charging = false;
        pl.charge = 0;
        this.triggerHyperJump(pl, c >= 0.72 && c <= 0.98, width, height);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.pilots.forEach((pl, pId) => scores.set(pId, pl.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.pilots.entries())
      .map(([playerId, pl]) => ({ playerId, score: pl.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${this.getPlayer(winnerId)?.name ?? winnerId} mastered the Hyperspace Conduit!`
        : 'Sub-light engines stalled in the warp tunnel!',
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];
    const cx = width * 0.5;
    const cy = height * 0.51;
    const maxRx = Math.min(width * 0.31, 225);
    const maxRy = Math.min(height * 0.29, 155);

    // 1. Deep Hyperspace Backdrop
    const bgGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, Math.max(width, height) * 0.7);
    bgGrad.addColorStop(0, pal.bgMid);
    bgGrad.addColorStop(0.55, pal.bgTop);
    bgGrad.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Tunnel Depth Rings & Radial Vector Ribs
    ctx.save();
    for (let r = 1; r <= 5; r++) {
      const frac = ((r * 0.2 + this.animTime * 0.35) % 1);
      ctx.strokeStyle = pal.tunnelRing;
      ctx.lineWidth = 1 + frac * 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, maxRx * frac, maxRy * frac, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = pal.tunnelRing;
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 12);
      ctx.lineTo(cx + Math.cos(a) * maxRx * 1.15, cy + Math.sin(a) * maxRy * 1.15);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Radial Star Streaks
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    for (const s of this.starAngles) {
      const frac1 = Math.max(0.05, 1 - s.z / 340);
      const frac2 = Math.min(1.15, frac1 + 0.09);
      ctx.lineWidth = 1 + frac1 * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(s.angle) * maxRx * frac1, cy + Math.sin(s.angle) * maxRy * frac1);
      ctx.lineTo(cx + Math.cos(s.angle) * maxRx * frac2, cy + Math.sin(s.angle) * maxRy * frac2);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Outer Interceptor Orbit Track
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, maxRx, maxRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Render Approaching Shared Chromatic Warp Gates (from farthest to nearest)
    const sortedGates = [...this.sharedGates].sort((a, b) => b.z - a.z);
    for (const g of sortedGates) {
      const scale = Math.max(0.06, Math.min(1.12, 1 - (g.z - 15) / 325));
      const grx = maxRx * scale;
      const gry = maxRy * scale;

      ctx.save();
      ctx.translate(cx, cy);

      // Red Electrified Plasma Barrier Ring
      ctx.strokeStyle = pal.hazardArc;
      ctx.lineWidth = 3 + scale * 5;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        grx,
        gry,
        0,
        g.apertureAngle + g.apertureHalfWidth,
        g.apertureAngle + Math.PI * 2 - g.apertureHalfWidth
      );
      ctx.stroke();

      // Safe Emerald Warp Aperture Sector
      ctx.strokeStyle = pal.apertureColor;
      ctx.lineWidth = 6 + scale * 6;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        grx,
        gry,
        0,
        g.apertureAngle - g.apertureHalfWidth,
        g.apertureAngle + g.apertureHalfWidth
      );
      ctx.stroke();

      // Golden Overdrive Core Slot inside Aperture
      ctx.strokeStyle = pal.overdriveColor;
      ctx.lineWidth = 8 + scale * 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, grx, gry, 0, g.overdriveAngle - 0.18, g.overdriveAngle + 0.18);
      ctx.stroke();

      // Pylon Nodes at Aperture Edges
      for (const edgeSign of [-1, 1]) {
        const ea = g.apertureAngle + edgeSign * g.apertureHalfWidth;
        const px = Math.cos(ea) * grx;
        const py = Math.sin(ea) * gry;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 3 + scale * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 6. Render Tachyon Hyper-Cells
    for (const tc of this.tachyonCells) {
      const scale = Math.max(0.1, Math.min(1.05, 1 - (tc.z - 15) / 325));
      const tx = cx + Math.cos(tc.angle) * maxRx * scale;
      const ty = cy + Math.sin(tc.angle) * maxRy * scale;
      const r = 5 + scale * 7;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(this.animTime * 4);
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 7. Render 2.5D Hyperdrive Interceptors & Mascot Pilots
    this.pilots.forEach((pl, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const pos = this.getPilotCoords(pl.angle, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      if (pl.staggerTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }

      // Underdog Halo
      if (pl.isUnderdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Hyper-Phase Aura
      if (pl.hyperPhaseTimer > 0 || pl.warpFlash > 0) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, 26 + pl.warpFlash * 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2.5D Swept-Wing Starship Chassis oriented slightly inward toward tunnel center
      const inwardAngle = Math.atan2(cy - pos.y, cx - pos.x);
      ctx.save();
      ctx.rotate(inwardAngle + Math.PI * 0.5);

      // Twin Ion Thruster Plumes
      const flameH = 10 + Math.sin(this.animTime * 28) * 4 + (pl.hyperPhaseTimer > 0 ? 12 : 0);
      ctx.fillStyle = pl.hyperPhaseTimer > 0 ? '#facc15' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-10, 12);
      ctx.lineTo(-6, 12 + flameH);
      ctx.lineTo(-2, 12);
      ctx.moveTo(2, 12);
      ctx.lineTo(6, 12 + flameH);
      ctx.lineTo(10, 12);
      ctx.fill();

      // Delta Wing Hull
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(22, 14);
      ctx.lineTo(8, 10);
      ctx.lineTo(0, 15);
      ctx.lineTo(-8, 10);
      ctx.lineTo(-22, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Mascot Pilot in Glass Canopy
      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        -2,
        14,
        pl.staggerTimer > 0 ? 'shocked' : pl.hyperPhaseTimer > 0 ? 'triumph' : 'focused',
        this.animTime
      );

      // Hold-to-Charge Hyperdrive Coil Bar (72%–98% Sweet Spot)
      if (pl.charging && pl.charge > 0.04) {
        const bw = 42;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(-bw / 2 - 1, -34, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -33, bw * 0.26, 4);
        const isSweet = pl.charge >= 0.72 && pl.charge <= 0.98;
        ctx.fillStyle = isSweet ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -33, bw * Math.min(1, pl.charge), 4);
      }

      // Player Tag & Combo Badge
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId} (${pl.combo}x)`, 0, 30);

      ctx.restore();
    });

    // 8. Floating Combat Text
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

    // 9. Top Instruction Banner (y: 56 safe zone)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 56, 520, 26, 13);
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🚀 STEER TO GREEN/GOLD GATE SLOTS • HOLD & RELEASE (72–98%) FOR HYPER-JUMP & SHUNT!',
      width * 0.5,
      73
    );

    // 10. Corner Player Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const pl = this.pilots.get(p.id);
      if (!pl) return;
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
      ctx.fillText(`${p.name}: ${pl.score}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`Gates: ${pl.gatesCleared} • ${pl.combo}x Warp`, cardX + 10, cardY + 28);
    });

    // 11. Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
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
