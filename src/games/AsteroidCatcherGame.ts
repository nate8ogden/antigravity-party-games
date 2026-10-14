import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type KuiperTheme = 'kuiper_belt' | 'ceres_station' | 'cyber_belt';

interface ThemePalette {
  name: string;
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  gantryRail: string;
  goldColor: string;
  platColor: string;
  cometColor: string;
  mineColor: string;
  accent: string;
}

const THEMES: Record<KuiperTheme, ThemePalette> = {
  kuiper_belt: {
    name: 'Kuiper Belt Refinery',
    bgTop: '#040814',
    bgMid: '#0f172a',
    bgBottom: '#020617',
    gantryRail: '#334155',
    goldColor: '#facc15',
    platColor: '#38bdf8',
    cometColor: '#2dd4bf',
    mineColor: '#ef4444',
    accent: '#facc15',
  },
  ceres_station: {
    name: 'Ceres Foundry',
    bgTop: '#1c0a06',
    bgMid: '#3b150c',
    bgBottom: '#120604',
    gantryRail: '#78350f',
    goldColor: '#fb923c',
    platColor: '#e2e8f0',
    cometColor: '#38bdf8',
    mineColor: '#f43f5e',
    accent: '#fb923c',
  },
  cyber_belt: {
    name: 'Neon Kuiper Grid',
    bgTop: '#090314',
    bgMid: '#1e0b36',
    bgBottom: '#05020a',
    gantryRail: '#4c1d95',
    goldColor: '#facc15',
    platColor: '#00e5ff',
    cometColor: '#ec4899',
    mineColor: '#ff2a85',
    accent: '#00e5ff',
  },
};

const THEME_ORDER: KuiperTheme[] = ['kuiper_belt', 'ceres_station', 'cyber_belt'];

interface SpaceAsteroid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  type: 'gold' | 'platinum' | 'comet' | 'mine';
  radius: number;
  slingshotBy: PlayerId | null;
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

interface HarpoonRig {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  moveDir: number;
  angle: number; // swinging pendulum aim angle (-1.05 to +1.05)
  angleDir: number;
  harpoonDist: number;
  harpoonState: 'idle' | 'firing' | 'retracting';
  superMagShot: boolean;
  caughtAsteroid: SpaceAsteroid | null;
  score: number;
  combo: number;
  hauledCount: number;
  staggerTimer: number;
  charging: boolean;
  charge: number;
  overchargeLockout: number;
  lastTapTime: number;
  isUnderdog: boolean;
  botReleaseTarget: number;
}

export class AsteroidCatcherGame extends BaseGame {
  public rigs: Map<PlayerId, HarpoonRig> = new Map();
  public asteroids: SpaceAsteroid[] = [];
  public currentMapName: string = 'Kuiper Belt Refinery';
  private theme: KuiperTheme = 'kuiper_belt';
  private animTime: number = 0;
  private screenShake: number = 0;
  private astIdCounter: number = 0;
  private nextAstSpawn: number = 0.8;
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
    this.rigs.clear();
    this.asteroids = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.nextAstSpawn = 0.8;

    const active = this.getActivePlayers();
    const count = Math.max(active.length, 1);
    const span = width - 160;

    active.forEach((p, idx) => {
      const cx = 80 + ((idx + 0.5) / count) * span;
      this.rigs.set(p.id, {
        id: p.id,
        x: cx,
        y: 112,
        vx: 0,
        moveDir: idx % 2 === 0 ? 1 : -1,
        angle: (idx % 2 === 0 ? -0.4 : 0.4),
        angleDir: idx % 2 === 0 ? 1 : -1,
        harpoonDist: 0,
        harpoonState: 'idle',
        superMagShot: false,
        caughtAsteroid: null,
        score: 0,
        combo: 0,
        hauledCount: 0,
        staggerTimer: 0,
        charging: false,
        charge: 0,
        overchargeLockout: 0,
        lastTapTime: -10,
        isUnderdog: false,
        botReleaseTarget: 0.84,
      });
      this.botReactionTimers.set(p.id, 0.2);
    });

    for (let i = 0; i < 10; i++) {
      this.spawnAsteroid(width, height, true);
    }
  }

  protected onKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
      this.theme = THEME_ORDER[idx];
      this.currentMapName = THEMES[this.theme].name;
      this.audio.playTap();
    } else if (e.key === '1') {
      this.theme = 'kuiper_belt';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '2') {
      this.theme = 'ceres_station';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '3') {
      this.theme = 'cyber_belt';
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

  private spawnAsteroid(width: number, height: number, initial: boolean = false): void {
    const roll = Math.random();
    const type: SpaceAsteroid['type'] =
      roll < 0.22 ? 'mine' : roll < 0.42 ? 'platinum' : roll < 0.56 ? 'comet' : 'gold';
    const fromLeft = Math.random() < 0.5;
    const speed =
      type === 'comet'
        ? 95 + Math.random() * 55
        : type === 'platinum'
          ? 50 + Math.random() * 35
          : 28 + Math.random() * 28;
    const x = initial ? 60 + Math.random() * (width - 120) : fromLeft ? -25 : width + 25;
    const y = 205 + Math.random() * (height - 345);
    this.asteroids.push({
      id: ++this.astIdCounter,
      x,
      y,
      vx: (fromLeft ? 1 : -1) * speed,
      vy: 0,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 2.4,
      type,
      radius: type === 'mine' ? 14 : type === 'comet' ? 15 : type === 'platinum' ? 17 : 20,
      slingshotBy: null,
      collected: false,
    });
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
        y: 165,
        text: '☄️ HALLEY COMET SWARM! 2X ORE VALUE! ☄️',
        color: '#facc15',
        alpha: 1.5,
        vy: -20,
      });
    }

    // Underdog Check
    let maxScore = 0;
    this.rigs.forEach((r) => {
      if (r.score > maxScore) maxScore = r.score;
    });
    this.rigs.forEach((r) => {
      r.isUnderdog = maxScore - r.score >= 150;
    });

    // Spawn drifting asteroids
    this.nextAstSpawn -= clampedDt;
    if (this.nextAstSpawn <= 0 && this.asteroids.length < (isSuddenDeath ? 15 : 12)) {
      this.spawnAsteroid(width, height, false);
      this.nextAstSpawn = isSuddenDeath ? 0.65 : 1.1;
    }

    // Update drifting asteroids & slingshot mines
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const ast = this.asteroids[i];
      if (ast.collected) continue;
      ast.x += ast.vx * clampedDt;
      ast.y += ast.vy * clampedDt;
      ast.rot += ast.vRot * clampedDt;

      // Wrap around horizontal edges if normal drift
      if (!ast.slingshotBy) {
        if (ast.x < -40) ast.x = width + 35;
        if (ast.x > width + 40) ast.x = -35;
      } else {
        // Slingshot mine homing toward rival gantry tug!
        this.rigs.forEach((r) => {
          if (r.id !== ast.slingshotBy && Math.hypot(r.x - ast.x, r.y - ast.y) < 34) {
            ast.collected = true;
            r.staggerTimer = 0.9;
            r.combo = 0;
            r.score = Math.max(0, r.score - 20);
            this.audio.playExplosion();
            this.triggerScreenShake(5);
            this.particles.spawnExplosion(r.x, r.y, '#ef4444', 20);
            this.floatingTexts.push({
              x: r.x,
              y: r.y + 30,
              text: 'MINE SLINGSHOT HIT! -20',
              color: '#ef4444',
              alpha: 1.1,
              vy: -30,
            });
          }
        });
        if (ast.y < 40 || ast.y > height + 40 || ast.x < -50 || ast.x > width + 50) {
          ast.collected = true;
        }
      }
    }

    this.updateBots(clampedDt, width, height);

    const sdMult = isSuddenDeath ? 2 : 1;

    this.rigs.forEach((r) => {
      const p = this.getPlayer(r.id);
      if (r.staggerTimer > 0) r.staggerTimer = Math.max(0, r.staggerTimer - clampedDt);
      if (r.overchargeLockout > 0) r.overchargeLockout = Math.max(0, r.overchargeLockout - clampedDt);

      // Swing pendulum aim turret when idle
      if (r.harpoonState === 'idle') {
        r.angle += r.angleDir * clampedDt * 2.05;
        if (r.angle > 1.02) {
          r.angle = 1.02;
          r.angleDir = -1;
        } else if (r.angle < -1.02) {
          r.angle = -1.02;
          r.angleDir = 1;
        }
      }

      if (p && !p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(r.id);
        const holding = this.input.isActionPressed(r.id) || this.input.isPressed(r.id);
        const justPressed = this.input.justPressed(r.id) || this.input.justAction(r.id);
        const released = this.input.justReleased(r.id);

        if (r.staggerTimer <= 0) {
          if (Math.abs(steer) > 0.15) {
            r.vx += steer * (r.isUnderdog ? 460 : 380) * clampedDt;
          } else if (holding && r.harpoonState === 'idle') {
            r.vx += r.moveDir * 190 * clampedDt;
          }

          if (justPressed && r.harpoonState === 'idle') {
            if (this.animTime - r.lastTapTime < 0.26) {
              r.moveDir *= -1;
            }
            r.lastTapTime = this.animTime;
            if (r.overchargeLockout <= 0) {
              r.charging = true;
              r.charge = 0;
            }
          }

          if (holding && r.charging && r.harpoonState === 'idle' && r.overchargeLockout <= 0) {
            r.charge += clampedDt * 0.95;
            if (r.charge >= 1.0) {
              r.charging = false;
              r.charge = 0;
              r.overchargeLockout = 0.9;
              this.audio.playStun();
              this.particles.spawnExplosion(r.x, r.y, '#ef4444', 12);
              this.floatingTexts.push({
                x: r.x,
                y: r.y + 30,
                text: 'COIL OVERLOAD!',
                color: '#ef4444',
                alpha: 1,
                vy: -28,
              });
            }
          }

          if (released && r.charging && r.harpoonState === 'idle') {
            const c = r.charge;
            r.charging = false;
            r.charge = 0;
            this.fireHarpoon(r, c >= 0.72 && c <= 0.98);
          }
        } else {
          r.charging = false;
          r.charge = 0;
        }
      }

      // Gantry horizontal motion & bounds
      r.vx *= Math.pow(0.06, clampedDt);
      r.x += r.vx * clampedDt;
      if (r.x < 75) {
        r.x = 75;
        r.vx = Math.abs(r.vx) * 0.5;
        r.moveDir = 1;
      } else if (r.x > width - 75) {
        r.x = width - 75;
        r.vx = -Math.abs(r.vx) * 0.5;
        r.moveDir = -1;
      }

      // Harpoon state machine
      if (r.harpoonState === 'firing') {
        const fireSpeed = (r.superMagShot ? 560 : 390) * (r.isUnderdog ? 1.18 : 1.0);
        r.harpoonDist += fireSpeed * clampedDt;
        const tipX = r.x + Math.sin(r.angle) * r.harpoonDist;
        const tipY = r.y + Math.cos(r.angle) * r.harpoonDist;

        // 1. Check Mid-Reel Hijack against a rival's retracting asteroid!
        this.rigs.forEach((other) => {
          if (
            other.id !== r.id &&
            other.caughtAsteroid &&
            other.harpoonState === 'retracting' &&
            !r.caughtAsteroid
          ) {
            const ox = other.x + Math.sin(other.angle) * other.harpoonDist;
            const oy = other.y + Math.cos(other.angle) * other.harpoonDist;
            if (Math.hypot(tipX - ox, tipY - oy) < 30) {
              r.caughtAsteroid = other.caughtAsteroid;
              other.caughtAsteroid = null;
              r.harpoonState = 'retracting';
              r.score += 50;
              this.audio.playScore();
              this.particles.spawnExplosion(ox, oy, '#facc15', 18);
              this.floatingTexts.push({
                x: ox,
                y: oy - 20,
                text: '🧲 HARPOON HIJACK! +50',
                color: '#facc15',
                alpha: 1.2,
                vy: -38,
              });
            }
          }
        });

        // 2. Check collision with drifting asteroids
        if (!r.caughtAsteroid) {
          const hitRadiusBonus = r.superMagShot ? 26 : 10;
          for (const ast of this.asteroids) {
            if (!ast.collected && Math.hypot(ast.x - tipX, ast.y - tipY) < ast.radius + hitRadiusBonus) {
              if (ast.type === 'mine') {
                if (r.superMagShot) {
                  // Sweet-Spot Super-Mag Shot SLINGSHOTS the Plasma Mine at the nearest rival!
                  let nearestRival: HarpoonRig | null = null;
                  let bestD = Infinity;
                  this.rigs.forEach((other) => {
                    if (other.id !== r.id) {
                      const d = Math.abs(other.x - ast.x);
                      if (d < bestD) {
                        bestD = d;
                        nearestRival = other;
                      }
                    }
                  });
                  ast.slingshotBy = r.id;
                  if (nearestRival) {
                    const targetRig = nearestRival as HarpoonRig;
                    const ang = Math.atan2(targetRig.y - ast.y, targetRig.x - ast.x);
                    ast.vx = Math.cos(ang) * 420;
                    ast.vy = Math.sin(ang) * 420;
                  } else {
                    ast.vy = -380;
                  }
                  r.harpoonState = 'retracting';
                  r.score += 70;
                  this.audio.playExplosion();
                  this.particles.spawnExplosion(tipX, tipY, '#f43f5e', 20);
                  this.floatingTexts.push({
                    x: tipX,
                    y: tipY - 22,
                    text: '💥 MINE SLINGSHOT SHUNT! +70',
                    color: '#f43f5e',
                    alpha: 1.2,
                    vy: -40,
                  });
                } else {
                  // Direct mine hit shocks the rig
                  ast.collected = true;
                  r.harpoonState = 'retracting';
                  r.score = Math.max(0, r.score - 20);
                  r.combo = 0;
                  r.staggerTimer = 0.8;
                  this.audio.playStun();
                  this.triggerScreenShake(5);
                  this.particles.spawnExplosion(tipX, tipY, '#ef4444', 18);
                  this.floatingTexts.push({
                    x: tipX,
                    y: tipY - 20,
                    text: 'PLASMA MINE! -20',
                    color: '#ef4444',
                    alpha: 1,
                    vy: -30,
                  });
                }
              } else {
                ast.collected = true;
                r.caughtAsteroid = ast;
                r.harpoonState = 'retracting';
                this.audio.playChime();
                this.particles.spawnSparks(tipX, tipY, '#facc15', 14);
              }
              break;
            }
          }
        }

        if (r.harpoonDist > 420 || tipY > height - 45 || tipX < 15 || tipX > width - 15) {
          r.harpoonState = 'retracting';
        }
      } else if (r.harpoonState === 'retracting') {
        const reelSpeed = (r.superMagShot ? 460 : 310) * (r.isUnderdog ? 1.2 : 1.0);
        r.harpoonDist = Math.max(0, r.harpoonDist - reelSpeed * clampedDt);

        if (r.harpoonDist <= 0) {
          r.harpoonDist = 0;
          r.harpoonState = 'idle';

          if (r.caughtAsteroid && r.caughtAsteroid.type !== 'mine') {
            r.combo = Math.min(6, r.combo + 1);
            r.hauledCount++;
            const basePts =
              r.caughtAsteroid.type === 'comet'
                ? 85
                : r.caughtAsteroid.type === 'platinum'
                  ? 60
                  : 40;
            const mult = r.superMagShot ? 1.65 : 1.0;
            const pts = Math.round((basePts + r.combo * 8) * mult * sdMult);
            r.score += pts;
            this.audio.playScore();
            this.particles.spawnExplosion(r.x, r.y + 16, '#facc15', 18);
            this.floatingTexts.push({
              x: r.x,
              y: r.y + 34,
              text: r.superMagShot ? `⚡ SUPER HAUL! +${pts}` : `+${pts} (${r.combo}x)`,
              color: r.caughtAsteroid.type === 'comet' ? '#2dd4bf' : '#facc15',
              alpha: 1.15,
              vy: -34,
            });
          }
          r.caughtAsteroid = null;
          r.superMagShot = false;
        }
      }
    });

    // Elastic Gantry Tug-to-Tug Collisions
    const rigArr = Array.from(this.rigs.values());
    for (let i = 0; i < rigArr.length; i++) {
      for (let j = i + 1; j < rigArr.length; j++) {
        const a = rigArr[i];
        const b = rigArr[j];
        const dx = b.x - a.x;
        const minDist = 56;
        if (Math.abs(dx) < minDist) {
          const sign = dx >= 0 ? 1 : -1;
          const overlap = (minDist - Math.abs(dx)) * 0.5;
          a.x -= sign * overlap;
          b.x += sign * overlap;

          const impulse = 190;
          a.vx = -sign * impulse * (b.isUnderdog ? 1.35 : 1.0);
          b.vx = sign * impulse * (a.isUnderdog ? 1.35 : 1.0);
          a.moveDir = -sign;
          b.moveDir = sign;

          this.particles.spawnSparks((a.x + b.x) * 0.5, a.y, '#38bdf8', 10);
          this.audio.playBounce();
        }
      }
    }

    this.asteroids = this.asteroids.filter((a) => !a.collected);

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.9;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private fireHarpoon(r: HarpoonRig, isSweetSpot: boolean): void {
    r.harpoonState = 'firing';
    r.superMagShot = isSweetSpot;
    if (isSweetSpot) {
      this.audio.playExplosion();
      this.triggerScreenShake(4);
      this.particles.spawnSparks(r.x, r.y + 14, '#facc15', 16);
    } else {
      this.audio.playWhoosh();
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const r = this.rigs.get(botId);
    if (!r || r.harpoonState !== 'idle' || r.staggerTimer > 0 || r.overchargeLockout > 0) return;

    let timer = (this.botReactionTimers.get(botId) ?? 0) - dt;
    if (timer <= 0) {
      timer =
        difficulty === 'bot_easy'
          ? 0.39 + Math.random() * 0.06
          : difficulty === 'bot_normal'
            ? 0.22 + Math.random() * 0.04
            : 0.1 + Math.random() * 0.03;

      const blunder = difficulty === 'bot_easy' ? 0.21 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      // Find valuable asteroid and steer gantry tug toward its x
      const targetAst = this.asteroids.find(
        (a) => !a.collected && (a.type !== 'mine' || (difficulty === 'bot_hard' && r.charging))
      );
      if (targetAst) {
        const dx = targetAst.x - r.x;
        if (Math.abs(dx) > 45) {
          r.vx += Math.sign(dx) * (difficulty === 'bot_hard' ? 220 : 160);
        }
      }

      for (const ast of this.asteroids) {
        if (ast.type === 'mine' && Math.random() >= blunder) continue;
        const dx = ast.x + ast.vx * 0.25 - r.x;
        const dy = ast.y - r.y;
        if (dy > 40) {
          const targetAngle = Math.atan2(dx, dy);
          const diff = Math.abs(r.angle - targetAngle);
          const tolerance = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.14 : 0.1;
          if (diff < tolerance) {
            if (!r.charging && difficulty === 'bot_hard' && Math.random() < 0.6) {
              r.charging = true;
              r.charge = 0;
              r.botReleaseTarget = 0.78 + Math.random() * 0.15;
            } else if (!r.charging) {
              this.fireHarpoon(r, false);
            }
            break;
          }
        }
      }
    }
    this.botReactionTimers.set(botId, timer);

    if (r.charging) {
      r.charge += dt * 0.95;
      if (r.charge >= r.botReleaseTarget) {
        const c = r.charge;
        r.charging = false;
        r.charge = 0;
        this.fireHarpoon(r, c >= 0.72 && c <= 0.98);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.rigs.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.rigs.entries())
      .map(([playerId, r]) => ({ playerId, score: r.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${this.getPlayer(winnerId)?.name ?? winnerId} hauled the richest Kuiper asteroid fortune!`
        : 'All refinery harpoons came back empty!',
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];

    // 1. Deep Kuiper Belt Space Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, pal.bgTop);
    bgGrad.addColorStop(0.5, pal.bgMid);
    bgGrad.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Shared Top Orbital Refinery Gantry Beam (y = 112)
    ctx.fillStyle = pal.gantryRail;
    ctx.fillRect(40, 102, width - 80, 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 102, width - 80, 14);

    // 3. Render Drifting 2.5D Asteroids, Comets, & Plasma Mines
    for (const ast of this.asteroids) {
      if (ast.collected) continue;
      ctx.save();
      ctx.translate(ast.x, ast.y);

      if (ast.type === 'comet') {
        // Glowing Comet Tail
        const tailDir = ast.vx >= 0 ? -1 : 1;
        const tailGrad = ctx.createLinearGradient(0, 0, tailDir * 48, 0);
        tailGrad.addColorStop(0, 'rgba(45, 212, 191, 0.75)');
        tailGrad.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(tailDir * 48, 0);
        ctx.lineTo(0, 10);
        ctx.closePath();
        ctx.fill();
      }

      ctx.rotate(ast.rot);
      if (ast.type === 'gold' || ast.type === 'platinum' || ast.type === 'comet') {
        ctx.fillStyle =
          ast.type === 'comet'
            ? pal.cometColor
            : ast.type === 'platinum'
              ? pal.platColor
              : pal.goldColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const sides = 7;
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          const r = ast.radius * (i % 2 === 0 ? 1.0 : 0.82);
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Spiked Red Proximity Plasma Mine
        ctx.fillStyle = pal.mineColor;
        ctx.beginPath();
        ctx.arc(0, 0, ast.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * ast.radius, Math.sin(a) * ast.radius);
          ctx.lineTo(Math.cos(a) * (ast.radius + 7), Math.sin(a) * (ast.radius + 7));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 4. Render 2.5D Mobile Refinery Tugs, Mascot Operators, & Magnetic Harpoons
    this.rigs.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#facc15';

      const tipX = r.x + Math.sin(r.angle) * r.harpoonDist;
      const tipY = r.y + Math.cos(r.angle) * r.harpoonDist;

      // Laser Sight Preview Line when Idle
      if (r.harpoonState === 'idle') {
        ctx.save();
        ctx.strokeStyle = r.charge >= 0.72 ? '#facc15' : 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = r.charge >= 0.72 ? 2.5 : 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + 12);
        ctx.lineTo(r.x + Math.sin(r.angle) * 145, r.y + Math.cos(r.angle) * 145);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Harpoon Tether Cable
      ctx.strokeStyle = r.superMagShot ? '#facc15' : '#e2e8f0';
      ctx.lineWidth = r.superMagShot ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + 10);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Magnetic Claw Head
      ctx.fillStyle = r.superMagShot ? '#facc15' : color;
      ctx.beginPath();
      ctx.arc(tipX, tipY, r.superMagShot ? 9 : 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Caught Asteroid on Retracting Claw
      if (r.caughtAsteroid && r.harpoonState === 'retracting') {
        ctx.fillStyle =
          r.caughtAsteroid.type === 'comet'
            ? pal.cometColor
            : r.caughtAsteroid.type === 'platinum'
              ? pal.platColor
              : pal.goldColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tipX, tipY + 12, r.caughtAsteroid.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 2.5D Refinery Tug on Gantry Rail
      ctx.save();
      ctx.translate(r.x, r.y);

      if (r.staggerTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, 0);
      }

      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-24, -12, 48, 22, 6);
      ctx.fill();
      ctx.stroke();

      // Mascot Operator on Refinery Tug
      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        -18,
        14,
        r.staggerTimer > 0 ? 'shocked' : r.caughtAsteroid ? 'triumph' : 'focused',
        this.animTime
      );

      // Hold-to-Charge Graviton Coil Bar (72%–98% Sweet Spot)
      if (r.charging && r.charge > 0.04) {
        const bw = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(-bw / 2 - 1, -40, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -39, bw * 0.26, 4);
        const isSweet = r.charge >= 0.72 && r.charge <= 0.98;
        ctx.fillStyle = isSweet ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -39, bw * Math.min(1, r.charge), 4);
      }

      ctx.restore();
    });

    // 5. Floating Combat Text
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

    // 6. Top Instruction Banner (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 56, 520, 26, 13);
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🧲 STEER GANTRY • TAP: FIRE HARPOON • HOLD (72–98%): SUPER-MAG & MINE SLINGSHOT!',
      width * 0.5,
      73
    );

    // 7. Corner Player Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const r = this.rigs.get(p.id);
      if (!r) return;
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
      ctx.fillText(`${p.name}: ${r.score}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`Hauled: ${r.hauledCount} • ${r.combo}x Streak`, cardX + 10, cardY + 28);
    });

    // 8. Bottom-Left Theme Pill
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
