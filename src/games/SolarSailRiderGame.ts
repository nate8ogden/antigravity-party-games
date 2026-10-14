import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type SolarTheme = 'helios' | 'pulsar_nebula' | 'red_giant';

interface ThemePalette {
  name: string;
  bgLeft: string;
  bgMid: string;
  bgRight: string;
  starCore: string;
  starCorona: string;
  flareColor: string;
  stormColor: string;
  sailFill: string;
  accent: string;
}

const THEMES: Record<SolarTheme, ThemePalette> = {
  helios: {
    name: 'Helios Corona',
    bgLeft: '#7c2d12',
    bgMid: '#27120b',
    bgRight: '#09070d',
    starCore: '#fef08a',
    starCorona: '#f97316',
    flareColor: '#facc15',
    stormColor: '#a855f7',
    sailFill: 'rgba(250, 204, 21, 0.72)',
    accent: '#f59e0b',
  },
  pulsar_nebula: {
    name: 'Cyan Supergiant',
    bgLeft: '#0c4a6e',
    bgMid: '#0f172a',
    bgRight: '#020617',
    starCore: '#e0f2fe',
    starCorona: '#38bdf8',
    flareColor: '#2dd4bf',
    stormColor: '#f43f5e',
    sailFill: 'rgba(56, 189, 248, 0.72)',
    accent: '#38bdf8',
  },
  red_giant: {
    name: 'Betelgeuse Nova',
    bgLeft: '#881337',
    bgMid: '#2e0819',
    bgRight: '#0a0308',
    starCore: '#fecdd3',
    starCorona: '#e11d48',
    flareColor: '#fb923c',
    stormColor: '#6366f1',
    sailFill: 'rgba(251, 146, 60, 0.72)',
    accent: '#fb7185',
  },
};

const THEME_ORDER: SolarTheme[] = ['helios', 'pulsar_nebula', 'red_giant'];

interface SolarAnomaly {
  id: number;
  x: number;
  lane: number; // 0, 1, 2
  type: 'cme_flare' | 'ion_storm' | 'photon_pearl';
  vx: number;
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

interface SailCraft {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetLane: number; // 0, 1, 2
  sailDeployed: boolean;
  sailSpread: number; // 0.18 to 1.0
  speed: number;
  score: number;
  combo: number;
  sailDamageTimer: number;
  prismBoostTimer: number;
  slipstream: boolean;
  charging: boolean;
  charge: number;
  overchargeLockout: number;
  lastTapTime: number;
  isUnderdog: boolean;
  botReleaseTarget: number;
}

export class SolarSailRiderGame extends BaseGame {
  public crafts: Map<PlayerId, SailCraft> = new Map();
  public currentMapName: string = 'Helios Corona';
  private theme: SolarTheme = 'helios';
  private animTime: number = 0;
  private anomalyIdCounter: number = 0;
  private anomalies: SolarAnomaly[] = [];
  private spawnTimer: number = 0.9;
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
    const top = 128;
    const bottom = height - 155;
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
    this.crafts.clear();
    this.anomalies = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.spawnTimer = 0.7;

    // Seed initial anomalies across the 3 shared lanes
    for (let i = 0; i < 4; i++) {
      const lane = i % 3;
      this.anomalies.push({
        id: ++this.anomalyIdCounter,
        x: width * (0.48 + i * 0.14),
        lane,
        type: i % 2 === 0 ? 'cme_flare' : 'photon_pearl',
        vx: -175,
        resolvedBy: new Set(),
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const lane = idx % 3;
      const startY = this.getLaneY(lane, height);
      this.crafts.set(p.id, {
        id: p.id,
        x: 155 + (idx % 2) * 38,
        y: startY,
        vx: 0,
        vy: 0,
        targetLane: lane,
        sailDeployed: true,
        sailSpread: 1.0,
        speed: 150,
        score: 0,
        combo: 0,
        sailDamageTimer: 0,
        prismBoostTimer: 0,
        slipstream: false,
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
      this.theme = 'helios';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '2') {
      this.theme = 'pulsar_nebula';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '3') {
      this.theme = 'red_giant';
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
        y: 102,
        text: '☀️ CORONAL MASS EJECTION! 2X SOLAR FLARE POINTS! ☀️',
        color: '#facc15',
        alpha: 1.5,
        vy: -20,
      });
    }

    // Underdog Check
    let maxScore = 0;
    this.crafts.forEach((c) => {
      if (c.score > maxScore) maxScore = c.score;
    });
    this.crafts.forEach((c) => {
      c.isUnderdog = maxScore - c.score >= 150;
    });

    // Spawn shared anomalies across the 3 lanes
    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = isSuddenDeath ? 0.55 : 0.85;
      const lane = Math.floor(Math.random() * 3);
      const roll = Math.random();
      const type: SolarAnomaly['type'] =
        roll < 0.44 ? 'cme_flare' : roll < 0.76 ? 'ion_storm' : 'photon_pearl';
      this.anomalies.push({
        id: ++this.anomalyIdCounter,
        x: width + 45,
        lane,
        type,
        vx: -(isSuddenDeath ? 225 : 175) - Math.random() * 45,
        resolvedBy: new Set(),
      });
    }

    this.updateBots(clampedDt, width, height);

    // Update Crafts
    this.crafts.forEach((c) => {
      const p = this.getPlayer(c.id);
      if (c.sailDamageTimer > 0) c.sailDamageTimer = Math.max(0, c.sailDamageTimer - clampedDt);
      if (c.prismBoostTimer > 0) c.prismBoostTimer = Math.max(0, c.prismBoostTimer - clampedDt);
      if (c.overchargeLockout > 0) c.overchargeLockout = Math.max(0, c.overchargeLockout - clampedDt);

      // Slipstream Drafting behind leading rival in same lane
      c.slipstream = false;
      this.crafts.forEach((other) => {
        if (other.id !== c.id && Math.abs(other.y - c.y) < 30 && other.x > c.x + 25 && other.x < c.x + 170) {
          c.slipstream = true;
        }
      });

      if (p && !p.type.startsWith('bot_')) {
        const move = { x: this.input.getSteer(c.id), y: -this.input.getThrottle(c.id) };
        const holding = this.input.isActionPressed(c.id) || this.input.isPressed(c.id);
        const justPressed = this.input.justPressed(c.id) || this.input.justAction(c.id);
        const released = this.input.justReleased(c.id);

        if (move.y < -0.45 && Math.abs(c.y - this.getLaneY(c.targetLane, height)) < 16) {
          c.targetLane = Math.max(0, c.targetLane - 1);
        } else if (move.y > 0.45 && Math.abs(c.y - this.getLaneY(c.targetLane, height)) < 16) {
          c.targetLane = Math.min(2, c.targetLane + 1);
        }

        if (Math.abs(move.x) > 0.2) {
          c.vx += move.x * 240 * clampedDt;
        }

        if (justPressed && c.sailDamageTimer <= 0) {
          if (this.animTime - c.lastTapTime < 0.26) {
            c.targetLane = (c.targetLane + 1) % 3;
          }
          c.lastTapTime = this.animTime;
          if (c.overchargeLockout <= 0) {
            c.charging = true;
            c.charge = 0;
          }
        }

        if (holding && c.charging && c.overchargeLockout <= 0) {
          c.charge += clampedDt * 0.92;
          if (c.charge >= 1.0) {
            c.charging = false;
            c.charge = 0;
            c.overchargeLockout = 1.0;
            this.audio.playStun();
            this.particles.spawnExplosion(c.x, c.y, '#ef4444', 12);
            this.floatingTexts.push({
              x: c.x,
              y: c.y - 26,
              text: 'PRISM OVERHEAT!',
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
          if (ch >= 0.72 && ch <= 0.98) {
            this.triggerPrismSurge(c, width, height);
          } else {
            // Quick tap toggles sail deploy / furl
            c.sailDeployed = !c.sailDeployed;
            this.audio.playTap();
          }
        }
      }

      const targetSpread = c.sailDeployed ? 1.0 : 0.18;
      c.sailSpread += (targetSpread - c.sailSpread) * clampedDt * 9;

      // Photon gale propulsion & horizontal position along corridor
      const slipMult = c.slipstream ? 1.25 : 1.0;
      const dogMult = c.isUnderdog ? 1.18 : 1.0;
      const prismMult = c.prismBoostTimer > 0 ? 1.45 : 1.0;

      if (c.sailDeployed && c.sailDamageTimer <= 0) {
        c.speed = Math.min(320, c.speed + 75 * clampedDt * slipMult * dogMult);
        c.score += 7 * clampedDt * slipMult * prismMult;
        c.vx += 55 * clampedDt * slipMult;
      } else {
        c.speed = Math.max(105, c.speed - 55 * clampedDt);
        c.vx -= 35 * clampedDt;
      }

      const targetY = this.getLaneY(c.targetLane, height);
      c.vy += (targetY - c.y) * 14 * clampedDt;
      c.vy *= Math.pow(0.04, clampedDt);
      c.vx *= Math.pow(0.12, clampedDt);

      c.x = Math.max(115, Math.min(width - 140, c.x + c.vx * clampedDt));
      c.y += c.vy * clampedDt;
    });

    // Elastic Craft-to-Craft Collisions
    const craftArr = Array.from(this.crafts.values());
    for (let i = 0; i < craftArr.length; i++) {
      for (let j = i + 1; j < craftArr.length; j++) {
        const a = craftArr[i];
        const b = craftArr[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 44;
        if (dist < minDist && dist > 0.01) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          const impulse = 155;
          a.vx -= nx * impulse * (b.isUnderdog ? 1.35 : 1.0);
          a.vy -= ny * impulse;
          b.vx += nx * impulse * (a.isUnderdog ? 1.35 : 1.0);
          b.vy += ny * impulse;

          this.particles.spawnSparks((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#facc15', 10);
          this.audio.playBounce();
        }
      }
    }

    // Update Anomalies & Craft Interactions
    const sdMult = isSuddenDeath ? 2 : 1;
    for (let i = this.anomalies.length - 1; i >= 0; i--) {
      const a = this.anomalies[i];
      a.x += a.vx * clampedDt;
      const ay = this.getLaneY(a.lane, height);

      this.crafts.forEach((c) => {
        if (a.resolvedBy.has(c.id)) return;
        if (Math.abs(a.x - c.x) < 34 && Math.abs(ay - c.y) < 28) {
          a.resolvedBy.add(c.id);
          if (a.type === 'photon_pearl') {
            const pts = 45 * sdMult;
            c.score += pts;
            c.combo = Math.min(6, c.combo + 1);
            this.audio.playCoin();
            this.particles.spawnSparks(c.x, c.y, '#38bdf8', 14);
            this.floatingTexts.push({
              x: c.x,
              y: c.y - 24,
              text: `+${pts} PHOTON PEARL!`,
              color: '#38bdf8',
              alpha: 1,
              vy: -34,
            });
          } else if (a.type === 'cme_flare') {
            if (c.sailDeployed || c.prismBoostTimer > 0) {
              c.combo = Math.min(6, c.combo + 1);
              const pts = (55 + c.combo * 8) * sdMult;
              c.score += pts;
              c.speed = Math.min(340, c.speed + 70);
              c.vx += 120;
              this.audio.playScore();
              this.particles.spawnExplosion(c.x, c.y, '#facc15', 18);
              this.floatingTexts.push({
                x: c.x,
                y: c.y - 26,
                text: `☀️ FLARE SURGE! +${pts}`,
                color: '#facc15',
                alpha: 1.1,
                vy: -38,
              });
            } else {
              c.score += 15;
              this.audio.playTap();
            }
          } else if (a.type === 'ion_storm') {
            if (c.prismBoostTimer > 0) {
              // Prism armor vaporizes Ion Storm!
              const pts = 75 * sdMult;
              c.score += pts;
              this.audio.playExplosion();
              this.particles.spawnExplosion(a.x, ay, '#38bdf8', 20);
              this.floatingTexts.push({
                x: c.x,
                y: c.y - 26,
                text: `⚡ PRISM VAPORIZE! +${pts}`,
                color: '#38bdf8',
                alpha: 1.1,
                vy: -38,
              });
            } else if (!c.sailDeployed) {
              // Furled sail slips cleanly through Ion Storm!
              c.combo = Math.min(6, c.combo + 1);
              const pts = (40 + c.combo * 6) * sdMult;
              c.score += pts;
              this.audio.playChime();
              this.particles.spawnSparks(c.x, c.y, '#2dd4bf', 12);
              this.floatingTexts.push({
                x: c.x,
                y: c.y - 24,
                text: `STORM SLIP! +${pts}`,
                color: '#2dd4bf',
                alpha: 1.0,
                vy: -34,
              });
            } else {
              // Open sail scorched by Ion Storm!
              c.sailDamageTimer = 0.9;
              c.sailDeployed = false;
              c.combo = 0;
              c.score = Math.max(0, c.score - 20);
              c.vx -= 140;
              this.audio.playStun();
              this.triggerScreenShake(4);
              this.particles.spawnExplosion(c.x, c.y, '#a855f7', 18);
              this.floatingTexts.push({
                x: c.x,
                y: c.y - 26,
                text: 'SAIL SCORCHED! -20',
                color: '#a855f7',
                alpha: 1.0,
                vy: -30,
              });
            }
          }
        }
      });

      if (a.x < -60) {
        this.anomalies.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.9;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private triggerPrismSurge(c: SailCraft, _width: number, height: number): void {
    c.prismBoostTimer = 1.65;
    c.sailDeployed = true;
    c.vx += 180;
    c.score += 65;
    this.audio.playExplosion();
    this.triggerScreenShake(6);
    this.particles.spawnExplosion(c.x, c.y, '#facc15', 24);
    this.floatingTexts.push({
      x: c.x,
      y: c.y - 28,
      text: '☀️ PHOTON PRISM SURGE! +65',
      color: '#facc15',
      alpha: 1.2,
      vy: -40,
    });

    // Focused Solar Beam Shunt against nearby rival clippers!
    this.crafts.forEach((other) => {
      if (other.id === c.id) return;
      if (Math.hypot(other.x - c.x, other.y - c.y) < 165) {
        other.targetLane = (other.targetLane + 1) % 3;
        other.vx -= 150;
        other.sailDamageTimer = Math.max(other.sailDamageTimer, 0.55);
        c.score += 70;
        this.particles.spawnExplosion(other.x, other.y, '#f43f5e', 18);
        this.floatingTexts.push({
          x: other.x,
          y: other.y - 30,
          text: 'SOLAR BEAM SHUNT! +70',
          color: '#f43f5e',
          alpha: 1.2,
          vy: -42,
        });
      }
    });

    // Convert any Ion Storm immediately ahead in lane into bonus energy
    for (const a of this.anomalies) {
      const ay = this.getLaneY(a.lane, height);
      if (!a.resolvedBy.has(c.id) && Math.abs(ay - c.y) < 35 && a.x > c.x && a.x < c.x + 180 && a.type === 'ion_storm') {
        a.type = 'cme_flare';
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
    const c = this.crafts.get(botId);
    if (!c || c.sailDamageTimer > 0 || c.overchargeLockout > 0) return;

    let timer = (this.botReactionTimers.get(botId) ?? 0) - dt;
    if (timer <= 0) {
      timer =
        difficulty === 'bot_easy'
          ? 0.4 + Math.random() * 0.06
          : difficulty === 'bot_normal'
            ? 0.23 + Math.random() * 0.04
            : 0.1 + Math.random() * 0.03;

      const blunder = difficulty === 'bot_easy' ? 0.21 : difficulty === 'bot_normal' ? 0.08 : 0.0;
      const incoming = this.anomalies.find(
        (a) => !a.resolvedBy.has(botId) && a.lane === c.targetLane && a.x > c.x && a.x < c.x + 175
      );

      if (incoming && Math.random() >= blunder) {
        if (incoming.type === 'ion_storm') {
          if (difficulty === 'bot_hard' && !c.charging && Math.random() < 0.55) {
            c.charging = true;
            c.charge = 0;
            c.botReleaseTarget = 0.82 + Math.random() * 0.12;
          } else if (Math.random() < 0.5) {
            c.targetLane = (c.targetLane + 1) % 3;
          } else {
            c.sailDeployed = false;
          }
        } else {
          c.sailDeployed = true;
        }
      } else {
        c.sailDeployed = true;
        // Look for adjacent lane with CME flare or Photon Pearl
        const better = this.anomalies.find(
          (a) =>
            !a.resolvedBy.has(botId) &&
            (a.type === 'cme_flare' || a.type === 'photon_pearl') &&
            a.x > c.x + 40 &&
            a.x < c.x + 220
        );
        if (better && Math.random() >= blunder) {
          c.targetLane = better.lane;
        }
      }
    }
    this.botReactionTimers.set(botId, timer);

    if (c.charging) {
      c.charge += dt * 0.92;
      if (c.charge >= c.botReleaseTarget) {
        const ch = c.charge;
        c.charging = false;
        c.charge = 0;
        if (ch >= 0.72 && ch <= 0.98) {
          this.triggerPrismSurge(c, width, height);
        } else {
          c.sailDeployed = !c.sailDeployed;
        }
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.crafts.forEach((c, pId) => scores.set(pId, Math.floor(c.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.crafts.entries())
      .map(([playerId, c]) => ({ playerId, score: Math.floor(c.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${this.getPlayer(winnerId)?.name ?? winnerId} rode the solar photon gale to victory!`
        : 'All solar sails were scorched by the corona!',
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];

    // 1. Solar Corona Gradient Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, width, 0);
    bgGrad.addColorStop(0, pal.bgLeft);
    bgGrad.addColorStop(0.45, pal.bgMid);
    bgGrad.addColorStop(1, pal.bgRight);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Blazing 2.5D Star Surface & Prominence Loops on Left Edge
    const sunGrad = ctx.createRadialGradient(-30, height * 0.5, 20, -30, height * 0.5, 190);
    sunGrad.addColorStop(0, pal.starCore);
    sunGrad.addColorStop(0.45, pal.starCorona);
    sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(-30, height * 0.5, 190, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();

    // 3. Shared 3-Lane Photon Wind Corridors
    for (let lane = 0; lane < 3; lane++) {
      const ly = this.getLaneY(lane, height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(90, ly);
      ctx.lineTo(width - 40, ly);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Render Solar Anomalies (Flares, Ion Storms, Photon Pearls)
    for (const a of this.anomalies) {
      const ay = this.getLaneY(a.lane, height);
      ctx.save();
      ctx.translate(a.x, ay);

      if (a.type === 'cme_flare') {
        // Golden Coronal Mass Ejection Wave
        ctx.fillStyle = pal.flareColor;
        ctx.beginPath();
        ctx.arc(0, 0, 19 + Math.sin(this.animTime * 12) * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (a.type === 'ion_storm') {
        // Crackling Magnetar Ion Storm Vortex
        ctx.rotate(this.animTime * 5);
        ctx.fillStyle = pal.stormColor;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 4; k++) {
          const ang = (k / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * 10, Math.sin(ang) * 10);
          ctx.lineTo(Math.cos(ang + 0.4) * 25, Math.sin(ang + 0.4) * 25);
          ctx.stroke();
        }
      } else {
        // Shimmering Photon Pearl
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    // 5. Render 2.5D Solar Sail Clippers & Mascot Captains
    this.crafts.forEach((c, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#f59e0b';

      ctx.save();
      ctx.translate(c.x, c.y);

      if (c.sailDamageTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }

      // Slipstream Wake Lines
      if (c.slipstream || c.prismBoostTimer > 0) {
        ctx.strokeStyle = c.prismBoostTimer > 0 ? '#facc15' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-42, -12);
        ctx.lineTo(-14, -6);
        ctx.moveTo(-42, 12);
        ctx.lineTo(-14, 6);
        ctx.stroke();
      }

      // Clipper Hull Gondola
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-22, -9, 40, 18, 8);
      ctx.fill();
      ctx.stroke();

      // Mascot Captain at the Helm
      this.drawPlayerMascot(
        ctx,
        pId,
        -4,
        -6,
        14,
        c.sailDamageTimer > 0 ? 'shocked' : c.prismBoostTimer > 0 ? 'triumph' : 'focused',
        this.animTime
      );

      // Articulated Diamond Mylar Solar Sail ahead of Bow
      const sailH = 38 * c.sailSpread;
      ctx.fillStyle = c.sailDamageTimer > 0 ? 'rgba(148, 163, 184, 0.5)' : pal.sailFill;
      ctx.strokeStyle = c.prismBoostTimer > 0 ? '#fef08a' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, -sailH);
      ctx.lineTo(28, 0);
      ctx.lineTo(8, sailH);
      ctx.lineTo(-2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hold-to-Charge Photon Prism Bar (72%–98% Sweet Spot)
      if (c.charging && c.charge > 0.04) {
        const bw = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(-bw / 2 - 1, -46, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -45, bw * 0.26, 4);
        const isSweet = c.charge >= 0.72 && c.charge <= 0.98;
        ctx.fillStyle = isSweet ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -45, bw * Math.min(1, c.charge), 4);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.sailDeployed ? 'SAIL OPEN' : 'FURLED', 0, 24);

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
      '☀️ STEER LANES • TAP: OPEN/FURL SAIL • HOLD (72–98%): PHOTON PRISM SURGE & SHUNT!',
      width * 0.5,
      73
    );

    // 8. Corner Player Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const c = this.crafts.get(p.id);
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
      ctx.fillText(`${p.name}: ${Math.floor(c.score)}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${c.sailDeployed ? 'Sail Open' : 'Furled'} • ${c.combo}x Gale`, cardX + 10, cardY + 28);
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
