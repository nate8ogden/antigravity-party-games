import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type RoverTheme = 'olympus_mars' | 'europa_ice' | 'titan_methane';

interface ThemePalette {
  name: string;
  skyTop: string;
  skyBottom: string;
  groundFill: string;
  trackLine: string;
  craterFill: string;
  crystalColor: string;
  accent: string;
}

const THEMES: Record<RoverTheme, ThemePalette> = {
  olympus_mars: {
    name: 'Olympus Mons Mars',
    skyTop: '#1c0a08',
    skyBottom: '#451a14',
    groundFill: '#7c2d12',
    trackLine: '#9a3412',
    craterFill: '#270e0a',
    crystalColor: '#10b981',
    accent: '#f97316',
  },
  europa_ice: {
    name: 'Europa Cryo-Ridge',
    skyTop: '#020617',
    skyBottom: '#0f172a',
    groundFill: '#1e3a8a',
    trackLine: '#1d4ed8',
    craterFill: '#091538',
    crystalColor: '#00e5ff',
    accent: '#38bdf8',
  },
  titan_methane: {
    name: 'Titan Amber Dunes',
    skyTop: '#271705',
    skyBottom: '#713f12',
    groundFill: '#854d0e',
    trackLine: '#a16207',
    craterFill: '#3b1f06',
    crystalColor: '#c084fc',
    accent: '#facc15',
  },
};

const THEME_ORDER: RoverTheme[] = ['olympus_mars', 'europa_ice', 'titan_methane'];

interface SurfaceFeature {
  id: number;
  x: number;
  lane: number; // 0, 1, 2
  type: 'crater' | 'xenocrystal' | 'meteorite';
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

interface RoverPilot {
  id: PlayerId;
  x: number;
  laneY: number;
  targetLane: number; // 0, 1, 2
  vx: number;
  yOffset: number; // <= 0 when airborne
  vy: number;
  isJumping: boolean;
  score: number;
  combo: number;
  stumbleTimer: number;
  laserBeamTimer: number;
  laserTargetX: number;
  laserTargetY: number;
  wheelSpin: number;
  charging: boolean;
  charge: number;
  overchargeLockout: number;
  lastTapTime: number;
  isUnderdog: boolean;
  botReleaseTarget: number;
}

export class PlanetaryRoverGame extends BaseGame {
  public rovers: Map<PlayerId, RoverPilot> = new Map();
  public currentMapName: string = 'Olympus Mons Mars';
  private theme: RoverTheme = 'olympus_mars';
  private animTime: number = 0;
  private hazardIdCounter: number = 0;
  private features: SurfaceFeature[] = [];
  private spawnTimer: number = 0.75;
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

  private screenShake: number = 0;

  private triggerScreenShake(amt: number): void {
    this.screenShake = Math.max(this.screenShake, amt);
  }

  private getLaneY(lane: number, height: number): number {
    const top = 165;
    const bottom = height - 150;
    const step = (bottom - top) / 2;
    return top + Math.max(0, Math.min(2, lane)) * step;
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
    this.rovers.clear();
    this.features = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.spawnTimer = 0.65;

    for (let i = 0; i < 4; i++) {
      this.features.push({
        id: ++this.hazardIdCounter,
        x: width * (0.48 + i * 0.14),
        lane: i % 3,
        type: i % 2 === 0 ? 'xenocrystal' : 'crater',
        resolvedBy: new Set(),
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const lane = idx % 3;
      const ly = this.getLaneY(lane, height);
      this.rovers.set(p.id, {
        id: p.id,
        x: 165 + (idx % 2) * 44,
        laneY: ly,
        targetLane: lane,
        vx: 0,
        yOffset: 0,
        vy: 0,
        isJumping: false,
        score: 0,
        combo: 0,
        stumbleTimer: 0,
        laserBeamTimer: 0,
        laserTargetX: 0,
        laserTargetY: 0,
        wheelSpin: 0,
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
      this.theme = 'olympus_mars';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '2') {
      this.theme = 'europa_ice';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '3') {
      this.theme = 'titan_methane';
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
        text: '☄️ METEORITE SHOWER! 2X XENOCRYSTAL POINTS! ☄️',
        color: '#facc15',
        alpha: 1.5,
        vy: -20,
      });
    }

    // Underdog Check
    let maxScore = 0;
    this.rovers.forEach((r) => {
      if (r.score > maxScore) maxScore = r.score;
    });
    this.rovers.forEach((r) => {
      r.isUnderdog = maxScore - r.score >= 150;
    });

    const terrainScroll = isSuddenDeath ? 245 : 195;

    // Spawn shared surface features
    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = isSuddenDeath ? 0.52 : 0.78;
      const lane = Math.floor(Math.random() * 3);
      const roll = Math.random();
      const type: SurfaceFeature['type'] =
        roll < 0.42 ? 'crater' : roll < 0.8 ? 'xenocrystal' : 'meteorite';
      this.features.push({
        id: ++this.hazardIdCounter,
        x: width + 45,
        lane,
        type,
        resolvedBy: new Set(),
      });
    }

    this.updateBots(clampedDt, width, height);

    // Update Rovers
    this.rovers.forEach((r) => {
      const p = this.getPlayer(r.id);
      if (r.stumbleTimer > 0) r.stumbleTimer = Math.max(0, r.stumbleTimer - clampedDt);
      if (r.laserBeamTimer > 0) r.laserBeamTimer = Math.max(0, r.laserBeamTimer - clampedDt);
      if (r.overchargeLockout > 0) r.overchargeLockout = Math.max(0, r.overchargeLockout - clampedDt);
      r.wheelSpin += clampedDt * (r.stumbleTimer > 0 ? 4 : 15);

      if (p && !p.type.startsWith('bot_')) {
        const move = { x: this.input.getSteer(r.id), y: -this.input.getThrottle(r.id) };
        const holding = this.input.isActionPressed(r.id);
        const justAction = this.input.justAction(r.id);
        const released = !holding && r.charging;

        if (r.stumbleTimer <= 0) {
          if (move.y < -0.45 && Math.abs(r.laneY - this.getLaneY(r.targetLane, height)) < 16) {
            r.targetLane = Math.max(0, r.targetLane - 1);
          } else if (move.y > 0.45 && Math.abs(r.laneY - this.getLaneY(r.targetLane, height)) < 16) {
            r.targetLane = Math.min(2, r.targetLane + 1);
          }

          if (Math.abs(move.x) > 0.2) {
            r.vx += move.x * (r.isUnderdog ? 310 : 250) * clampedDt;
          }

          if (justAction) {
            if (this.animTime - r.lastTapTime < 0.25) {
              r.targetLane = (r.targetLane + 1) % 3;
            }
            r.lastTapTime = this.animTime;
            if (r.overchargeLockout <= 0) {
              r.charging = true;
              r.charge = 0;
            }
          }

          if (holding && r.charging && r.overchargeLockout <= 0) {
            r.charge += clampedDt * 0.95;
            if (r.charge >= 1.0) {
              r.charging = false;
              r.charge = 0;
              r.overchargeLockout = 0.95;
              this.audio.playStun();
              this.particles.spawnExplosion(r.x, r.laneY + r.yOffset, '#ef4444', 12);
              this.floatingTexts.push({
                x: r.x,
                y: r.laneY + r.yOffset - 26,
                text: 'JET OVERHEAT!',
                color: '#ef4444',
                alpha: 1,
                vy: -30,
              });
            }
          }

          if (released && r.charging) {
            const c = r.charge;
            r.charging = false;
            r.charge = 0;
            if (c >= 0.72 && c <= 0.98) {
              this.executeSkyVault(r, true, height);
            } else if (!r.isJumping) {
              this.executeSkyVault(r, false, height);
            }
          }
        } else {
          r.charging = false;
          r.charge = 0;
        }
      }

      // Smooth lane interpolation
      const desiredY = this.getLaneY(r.targetLane, height);
      r.laneY += (desiredY - r.laneY) * Math.min(1, clampedDt * 11);

      r.vx *= Math.pow(0.08, clampedDt);
      r.x = Math.max(115, Math.min(width - 135, r.x + r.vx * clampedDt));

      // Low-gravity vertical arc physics
      if (r.isJumping || r.yOffset < 0) {
        r.yOffset += r.vy * clampedDt;
        r.vy += 510 * clampedDt; // Martian low gravity
        if (r.yOffset >= 0) {
          r.yOffset = 0;
          r.vy = 0;
          r.isJumping = false;
          this.audio.playTap();
        }
      }
    });

    // Elastic Rover-to-Rover Collisions
    const roverArr = Array.from(this.rovers.values());
    for (let i = 0; i < roverArr.length; i++) {
      for (let j = i + 1; j < roverArr.length; j++) {
        const a = roverArr[i];
        const b = roverArr[j];
        const dx = b.x - a.x;
        const dy = b.laneY - a.laneY;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;
        if (dist < minDist && dist > 0.01 && Math.abs(a.yOffset - b.yOffset) < 28) {
          const nx = dx / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          b.x += nx * overlap;

          const impulse = 165;
          a.vx -= nx * impulse * (b.isUnderdog ? 1.35 : 1.0);
          b.vx += nx * impulse * (a.isUnderdog ? 1.35 : 1.0);

          this.particles.spawnSparks((a.x + b.x) * 0.5, (a.laneY + b.laneY) * 0.5, '#facc15', 10);
          this.audio.playBounce();
        }
      }
    }

    // Update Surface Features & Rover Collisions
    const sdMult = isSuddenDeath ? 2 : 1;
    for (let i = this.features.length - 1; i >= 0; i--) {
      const f = this.features[i];
      f.x -= terrainScroll * clampedDt;
      const fy = this.getLaneY(f.lane, height);

      this.rovers.forEach((r) => {
        if (f.resolvedBy.has(r.id)) return;
        if (Math.abs(f.x - r.x) < 30 && Math.abs(fy - r.laneY) < 24) {
          if (f.type === 'crater') {
            f.resolvedBy.add(r.id);
            if (r.yOffset > -18) {
              // Fell into impact crater!
              r.stumbleTimer = 0.75;
              r.combo = 0;
              r.score = Math.max(0, r.score - 20);
              r.vx -= 110;
              this.audio.playStun();
              this.triggerScreenShake(4);
              this.particles.spawnExplosion(r.x, r.laneY, '#ef4444', 16);
              this.floatingTexts.push({
                x: r.x,
                y: r.laneY - 24,
                text: 'CRATER STUMBLE! -20',
                color: '#ef4444',
                alpha: 1,
                vy: -30,
              });
            } else {
              // Clean low-G vault over crater!
              r.combo = Math.min(6, r.combo + 1);
              const pts = (25 + r.combo * 5) * sdMult;
              r.score += pts;
              this.audio.playChime();
              this.floatingTexts.push({
                x: r.x,
                y: r.laneY + r.yOffset - 22,
                text: `CRATER VAULT +${pts}`,
                color: '#38bdf8',
                alpha: 1,
                vy: -32,
              });
            }
          } else if (f.type === 'xenocrystal') {
            // Requires airborne jump (yOffset <= -16) to snag aerial Xenocrystals!
            if (r.yOffset <= -16) {
              f.resolvedBy.add(r.id);
              r.combo = Math.min(6, r.combo + 1);
              const pts = (50 + r.combo * 8) * sdMult;
              r.score += pts;
              this.audio.playScore();
              this.particles.spawnSparks(f.x, fy - 34, '#10b981', 16);
              this.floatingTexts.push({
                x: r.x,
                y: r.laneY + r.yOffset - 26,
                text: `💎 XENOCRYSTAL! +${pts}`,
                color: '#10b981',
                alpha: 1.1,
                vy: -38,
              });
            }
          } else if (f.type === 'meteorite') {
            // Ground/low Golden Meteorite Core
            f.resolvedBy.add(r.id);
            r.combo = Math.min(6, r.combo + 1);
            const pts = (65 + r.combo * 8) * sdMult;
            r.score += pts;
            this.audio.playCoin();
            this.particles.spawnExplosion(f.x, fy - 6, '#facc15', 18);
            this.floatingTexts.push({
              x: r.x,
              y: r.laneY - 26,
              text: `☄️ MARS METEORITE! +${pts}`,
              color: '#facc15',
              alpha: 1.15,
              vy: -38,
            });
          }
        }
      });

      if (f.x < -60) {
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

  private executeSkyVault(r: RoverPilot, isSweetSpot: boolean, height: number): void {
    r.isJumping = true;
    if (isSweetSpot) {
      r.vy = -395;
      r.vx += 130;
      r.score += 55;
      this.audio.playExplosion();
      this.triggerScreenShake(6);
      this.particles.spawnExplosion(r.x, r.laneY, '#f97316', 22);
      this.floatingTexts.push({
        x: r.x,
        y: r.laneY - 30,
        text: '🚀 SUPER-G SKY VAULT! +55',
        color: '#facc15',
        alpha: 1.2,
        vy: -40,
      });

      // Auto-zap nearest Xenocrystal with Rover Laser Mast!
      const crystal = this.features.find(
        (f) =>
          !f.resolvedBy.has(r.id) &&
          (f.type === 'xenocrystal' || f.type === 'meteorite') &&
          f.x > r.x - 20 &&
          f.x < r.x + 190
      );
      if (crystal) {
        crystal.resolvedBy.add(r.id);
        const cy = this.getLaneY(crystal.lane, height) - 32;
        r.laserBeamTimer = 0.45;
        r.laserTargetX = crystal.x;
        r.laserTargetY = cy;
        r.score += 75;
        this.particles.spawnSparks(crystal.x, cy, '#10b981', 18);
        this.floatingTexts.push({
          x: crystal.x,
          y: cy - 18,
          text: '⚡ LASER HARVEST! +75',
          color: '#10b981',
          alpha: 1.2,
          vy: -36,
        });
      }

      // Seismic Slam Shunt against nearby rival rovers!
      this.rovers.forEach((other) => {
        if (other.id === r.id) return;
        if (Math.hypot(other.x - r.x, other.laneY - r.laneY) < 155) {
          other.targetLane = (other.targetLane + 1) % 3;
          other.vx -= 140;
          other.stumbleTimer = Math.max(other.stumbleTimer, 0.55);
          r.score += 70;
          this.particles.spawnExplosion(other.x, other.laneY, '#f43f5e', 18);
          this.floatingTexts.push({
            x: other.x,
            y: other.laneY - 30,
            text: 'SEISMIC SHUNT! +70',
            color: '#f43f5e',
            alpha: 1.2,
            vy: -42,
          });
        }
      });
    } else {
      r.vy = -315;
      this.audio.playBounce();
      this.particles.spawnSparks(r.x - 12, r.laneY + 6, '#f97316', 8);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    height: number
  ): void {
    const r = this.rovers.get(botId);
    if (!r || r.stumbleTimer > 0 || r.overchargeLockout > 0) return;

    let timer = (this.botReactionTimers.get(botId) ?? 0) - dt;
    if (timer <= 0) {
      timer =
        difficulty === 'bot_easy'
          ? 0.39 + Math.random() * 0.06
          : difficulty === 'bot_normal'
            ? 0.22 + Math.random() * 0.04
            : 0.1 + Math.random() * 0.03;

      const blunder = difficulty === 'bot_easy' ? 0.21 : difficulty === 'bot_normal' ? 0.08 : 0.0;
      const lookahead = difficulty === 'bot_hard' ? 105 : difficulty === 'bot_normal' ? 85 : 65;

      // Check upcoming feature in current lane
      const upcoming = this.features.find(
        (f) => !f.resolvedBy.has(botId) && f.lane === r.targetLane && f.x > r.x && f.x < r.x + lookahead
      );

      if (upcoming && !r.isJumping && Math.random() >= blunder) {
        if (upcoming.type === 'crater' || upcoming.type === 'xenocrystal') {
          if (difficulty === 'bot_hard' && !r.charging && Math.random() < 0.45) {
            r.charging = true;
            r.charge = 0;
            r.botReleaseTarget = 0.78 + Math.random() * 0.14;
          } else {
            this.executeSkyVault(r, false, height);
          }
        }
      } else if (!r.isJumping) {
        // Switch lane toward meteorite or xenocrystal
        const prize = this.features.find(
          (f) =>
            !f.resolvedBy.has(botId) &&
            (f.type === 'meteorite' || f.type === 'xenocrystal') &&
            f.x > r.x + 50 &&
            f.x < r.x + 210
        );
        if (prize && Math.random() >= blunder) {
          r.targetLane = prize.lane;
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
        this.executeSkyVault(r, c >= 0.72 && c <= 0.98, height);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.rovers.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.rovers.entries())
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
        ? `${this.getPlayer(winnerId)?.name ?? winnerId} conquered the planetary canyon!`
        : 'All rovers got stuck in impact craters!',
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];

    // 1. Planetary Sky Backdrop
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(0.45, pal.skyBottom);
    skyGrad.addColorStop(1, pal.groundFill);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Celestial Horizon Body (Phobos/Deimos, Jupiter, or Ringed Saturn)
    ctx.save();
    if (this.theme === 'europa_ice') {
      ctx.fillStyle = 'rgba(251, 146, 60, 0.25)';
      ctx.beginPath();
      ctx.arc(width * 0.78, 95, 52, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.theme === 'titan_methane') {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
      ctx.beginPath();
      ctx.arc(width * 0.76, 95, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(width * 0.76, 95, 68, 14, -0.2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(254, 215, 170, 0.3)';
      ctx.beginPath();
      ctx.arc(width * 0.75, 88, 18, 0, Math.PI * 2);
      ctx.arc(width * 0.84, 108, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Shared 3-Track Canyon Ridges
    for (let lane = 0; lane < 3; lane++) {
      const ly = this.getLaneY(lane, height);
      ctx.fillStyle = pal.trackLine;
      ctx.fillRect(0, ly + 8, width, 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, ly + 8);
      ctx.lineTo(width, ly + 8);
      ctx.stroke();
    }

    // 4. Render Surface Features (Craters, Aerial Xenocrystals, Golden Meteorites)
    for (const f of this.features) {
      const fy = this.getLaneY(f.lane, height);
      ctx.save();
      ctx.translate(f.x, fy);

      if (f.type === 'crater') {
        ctx.fillStyle = pal.craterFill;
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 11, 22, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (f.type === 'xenocrystal') {
        const hoverY = -36 + Math.sin(this.animTime * 6 + f.id) * 4;
        ctx.fillStyle = pal.crystalColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, hoverY - 14);
        ctx.lineTo(10, hoverY);
        ctx.lineTo(0, hoverY + 14);
        ctx.lineTo(-10, hoverY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Golden Meteorite Core on ground
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -4, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    // 5. Render 2.5D 6-Wheeled Planetary Rovers & Mascot Drivers
    this.rovers.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#f97316';
      const rx = r.x;
      const ry = r.laneY + r.yOffset;

      // Ground Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(rx, r.laneY + 12, Math.max(10, 22 + r.yOffset * 0.15), 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Active Mining Laser Beam
      if (r.laserBeamTimer > 0) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(rx + 10, ry - 26);
        ctx.lineTo(r.laserTargetX, r.laserTargetY);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(rx, ry);

      if (r.stumbleTimer > 0) {
        ctx.rotate(Math.sin(this.animTime * 30) * 0.22);
      } else if (r.isJumping) {
        ctx.rotate(Math.max(-0.25, Math.min(0.25, r.vy * 0.0006)));
      }

      // Mascot Driver inside Pressurized Rover Dome
      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        -20,
        14,
        r.stumbleTimer > 0 ? 'shocked' : r.isJumping ? 'triumph' : 'focused',
        this.animTime
      );

      // Transparent Glass Canopy Bubble
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, -18, 16, Math.PI, 0);
      ctx.stroke();

      // Armored 2.5D Rover Chassis
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-22, -12, 44, 16, 5);
      ctx.fill();
      ctx.stroke();

      // Laser Mast at Bow
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(14, -12);
      ctx.lineTo(18, -26);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(18, -27, 4, 0, Math.PI * 2);
      ctx.fill();

      // 6 Rocker-Bogie Wheels
      for (const wx of [-15, 0, 15]) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(wx, 6, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wx, 6);
        ctx.lineTo(wx + Math.cos(r.wheelSpin) * 5, 6 + Math.sin(r.wheelSpin) * 5);
        ctx.stroke();
      }

      // Hold-to-Charge Sky-Vault Bar (72%–98% Sweet Spot)
      if (r.charging && r.charge > 0.04) {
        const bw = 42;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(-bw / 2 - 1, -44, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -43, bw * 0.26, 4);
        const isSweet = r.charge >= 0.72 && r.charge <= 0.98;
        ctx.fillStyle = isSweet ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -43, bw * Math.min(1, r.charge), 4);
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
      '🚜 STEER LANES • TAP: LOW-G HOP FOR XENOCRYSTALS • HOLD (72–98%): LASER VAULT & SHUNT!',
      width * 0.5,
      73
    );

    // 8. Corner Player Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const r = this.rovers.get(p.id);
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
      ctx.fillText(`Track ${r.targetLane + 1} • ${r.combo}x Combo`, cardX + 10, cardY + 28);
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
