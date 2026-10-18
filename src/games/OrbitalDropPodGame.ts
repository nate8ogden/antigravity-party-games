import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type DropPodTheme = 'helljumper' | 'venus_acid' | 'cyber_drop';

interface ThemePalette {
  name: string;
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  streakColor: string;
  cryoColor: string;
  beaconColor: string;
  debrisColor: string;
  accent: string;
}

const THEMES: Record<DropPodTheme, ThemePalette> = {
  helljumper: {
    name: 'Scorched Re-Entry',
    bgTop: '#090d16',
    bgMid: '#3b1219',
    bgBottom: '#7f1d1d',
    streakColor: 'rgba(249, 115, 22, 0.28)',
    cryoColor: '#38bdf8',
    beaconColor: '#facc15',
    debrisColor: '#ef4444',
    accent: '#f97316',
  },
  venus_acid: {
    name: 'Venusian Cloud Dive',
    bgTop: '#141706',
    bgMid: '#3f3f0c',
    bgBottom: '#713f12',
    streakColor: 'rgba(250, 204, 21, 0.25)',
    cryoColor: '#2dd4bf',
    beaconColor: '#a855f7',
    debrisColor: '#f43f5e',
    accent: '#facc15',
  },
  cyber_drop: {
    name: 'Neo-Tokyo Insertion',
    bgTop: '#060312',
    bgMid: '#1e0b36',
    bgBottom: '#4c1d95',
    streakColor: 'rgba(236, 72, 153, 0.28)',
    cryoColor: '#00e5ff',
    beaconColor: '#facc15',
    debrisColor: '#ff2a85',
    accent: '#00e5ff',
  },
};

const THEME_ORDER: DropPodTheme[] = ['helljumper', 'venus_acid', 'cyber_drop'];

interface AtmosphericFeature {
  id: number;
  x: number;
  y: number;
  type: 'cryo_cloud' | 'telemetry_ring' | 'flak_debris';
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

interface DropPodPilot {
  id: PlayerId;
  x: number;
  podY: number;
  vx: number;
  moveDir: number;
  fallSpeed: number;
  shieldHeat: number; // 0 to 100 (40% to 78% is optimal green thermal zone)
  retroBurnAnim: number;
  score: number;
  combo: number;
  overheatTimer: number;
  charging: boolean;
  charge: number;
  overchargeLockout: number;
  lastTapTime: number;
  isUnderdog: boolean;
  botReleaseTarget: number;
}

export class OrbitalDropPodGame extends BaseGame {
  public pods: Map<PlayerId, DropPodPilot> = new Map();
  public currentMapName: string = 'Scorched Re-Entry';
  private theme: DropPodTheme = 'helljumper';
  private animTime: number = 0;
  private screenShake: number = 0;
  private featureIdCounter: number = 0;
  private features: AtmosphericFeature[] = [];
  private spawnTimer: number = 0.8;
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
    this.pods.clear();
    this.features = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.spawnTimer = 0.7;

    for (let i = 0; i < 4; i++) {
      this.features.push({
        id: ++this.featureIdCounter,
        x: 90 + Math.random() * (width - 180),
        y: height * (0.55 + i * 0.12),
        type: i % 2 === 0 ? 'cryo_cloud' : 'telemetry_ring',
        resolvedBy: new Set(),
      });
    }

    const active = this.getActivePlayers();
    const count = Math.max(active.length, 1);
    const span = width - 160;

    active.forEach((p, idx) => {
      const cx = 80 + ((idx + 0.5) / count) * span;
      this.pods.set(p.id, {
        id: p.id,
        x: cx,
        podY: height * 0.34,
        vx: 0,
        moveDir: idx % 2 === 0 ? 1 : -1,
        fallSpeed: 215,
        shieldHeat: 45,
        retroBurnAnim: 0,
        score: 0,
        combo: 0,
        overheatTimer: 0,
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
      this.theme = 'helljumper';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '2') {
      this.theme = 'venus_acid';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '3') {
      this.theme = 'cyber_drop';
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
        text: '☄️ IONOSPHERE PLASMA STORM! 2X DROP POINTS! ☄️',
        color: '#facc15',
        alpha: 1.5,
        vy: -20,
      });
    }

    // Underdog Check
    let maxScore = 0;
    this.pods.forEach((pod) => {
      if (pod.score > maxScore) maxScore = pod.score;
    });
    this.pods.forEach((pod) => {
      pod.isUnderdog = maxScore - pod.score >= 150;
    });

    // Spawn rising atmospheric features
    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = isSuddenDeath ? 0.55 : 0.82;
      const roll = Math.random();
      const type: AtmosphericFeature['type'] =
        roll < 0.38 ? 'telemetry_ring' : roll < 0.72 ? 'cryo_cloud' : 'flak_debris';
      this.features.push({
        id: ++this.featureIdCounter,
        x: 80 + Math.random() * (width - 160),
        y: height + 40,
        type,
        resolvedBy: new Set(),
      });
    }

    this.updateBots(clampedDt, width, height);

    const sdMult = isSuddenDeath ? 2 : 1;
    const updraftSpeed = isSuddenDeath ? 225 : 180;

    // Update Drop Pods
    this.pods.forEach((pod) => {
      const p = this.getPlayer(pod.id);
      if (pod.overheatTimer > 0) pod.overheatTimer = Math.max(0, pod.overheatTimer - clampedDt);
      if (pod.retroBurnAnim > 0) pod.retroBurnAnim = Math.max(0, pod.retroBurnAnim - clampedDt * 3.5);
      if (pod.overchargeLockout > 0) pod.overchargeLockout = Math.max(0, pod.overchargeLockout - clampedDt);

      // Re-entry acceleration & thermal buildup
      pod.fallSpeed = Math.min(340, pod.fallSpeed + 72 * clampedDt);
      pod.shieldHeat = Math.min(100, pod.shieldHeat + (pod.fallSpeed / 8.2) * clampedDt);

      if (p && !p.type.startsWith('bot_')) {
        const hasSteer = this.input.hasSteer(pod.id);
        const steer = this.input.getSteer(pod.id);
        const holding = this.input.isActionPressed(pod.id) || (!hasSteer && this.input.isPressed(pod.id));
        const justAction = this.input.justAction(pod.id) || (!hasSteer && this.input.justPressed(pod.id));
        const released = (!holding && pod.charging) || this.input.justReleased(pod.id);

        if (pod.overheatTimer <= 0) {
          if (Math.abs(steer) > 0.15) {
            pod.vx += steer * (pod.isUnderdog ? 460 : 380) * clampedDt;
            pod.moveDir = steer >= 0 ? 1 : -1;
          } else if (!hasSteer && holding) {
            pod.vx += pod.moveDir * 190 * clampedDt;
          }

          if (justAction) {
            if (this.animTime - pod.lastTapTime < 0.25) {
              pod.moveDir *= -1;
            }
            pod.lastTapTime = this.animTime;
            if (pod.overchargeLockout <= 0) {
              pod.charging = true;
              pod.charge = 0;
            }
          }

          if (holding && pod.charging && pod.overchargeLockout <= 0) {
            pod.charge += clampedDt * 0.95;
            if (pod.charge >= 1.0) {
              pod.charging = false;
              pod.charge = 0;
              pod.overchargeLockout = 0.9;
              this.audio.playStun();
              this.particles.spawnExplosion(pod.x, pod.podY, '#ef4444', 12);
            }
          }

          if (released && pod.charging) {
            const c = pod.charge;
            pod.charging = false;
            pod.charge = 0;
            this.burnRetro(pod, c >= 0.72 && c <= 0.98, sdMult);
          }
        } else {
          pod.charging = false;
          pod.charge = 0;
        }
      }

      // Optimal Thermal Window (40% to 78% heat) continuous telemetry score
      if (pod.shieldHeat >= 40 && pod.shieldHeat <= 78 && pod.overheatTimer <= 0) {
        pod.score += 14 * clampedDt * sdMult;
      }

      // Thermal Shield Breach at 100% Heat
      if (pod.shieldHeat >= 100 && pod.overheatTimer <= 0) {
        pod.overheatTimer = 0.95;
        pod.shieldHeat = 62;
        pod.combo = 0;
        pod.score = Math.max(0, pod.score - 25);
        this.audio.playStun();
        this.triggerScreenShake(5);
        this.particles.spawnExplosion(pod.x, pod.podY, '#ef4444', 20);
        this.floatingTexts.push({
          x: pod.x,
          y: pod.podY - 26,
          text: '🔥 HEAT SHIELD BREACH! -25',
          color: '#ef4444',
          alpha: 1.1,
          vy: -32,
        });
      }

      pod.vx *= Math.pow(0.06, clampedDt);
      pod.x += pod.vx * clampedDt;
      if (pod.x < 70) {
        pod.x = 70;
        pod.vx = Math.abs(pod.vx) * 0.6;
        pod.moveDir = 1;
      } else if (pod.x > width - 70) {
        pod.x = width - 70;
        pod.vx = -Math.abs(pod.vx) * 0.6;
        pod.moveDir = -1;
      }

      const desiredY = height * 0.3 + ((pod.fallSpeed - 120) / 220) * (height * 0.25);
      pod.podY += (desiredY - pod.podY) * Math.min(1, clampedDt * 6);
    });

    // Elastic Pod-to-Pod Mid-Air Collisions
    const podArr = Array.from(this.pods.values());
    for (let i = 0; i < podArr.length; i++) {
      for (let j = i + 1; j < podArr.length; j++) {
        const a = podArr[i];
        const b = podArr[j];
        const dx = b.x - a.x;
        const dy = b.podY - a.podY;
        const dist = Math.hypot(dx, dy);
        const minDist = 44;
        if (dist < minDist && dist > 0.01) {
          const sign = dx >= 0 ? 1 : -1;
          const overlap = (minDist - dist) * 0.5;
          a.x -= sign * overlap;
          b.x += sign * overlap;

          const impulse = 195;
          a.vx = -sign * impulse * (b.isUnderdog ? 1.35 : 1.0);
          b.vx = sign * impulse * (a.isUnderdog ? 1.35 : 1.0);

          this.particles.spawnSparks((a.x + b.x) * 0.5, (a.podY + b.podY) * 0.5, '#f97316', 12);
          this.audio.playBounce();
        }
      }
    }

    // Update Rising Atmospheric Features
    for (let i = this.features.length - 1; i >= 0; i--) {
      const f = this.features[i];
      f.y -= updraftSpeed * clampedDt;

      this.pods.forEach((pod) => {
        if (f.resolvedBy.has(pod.id)) return;
        if (Math.hypot(f.x - pod.x, f.y - pod.podY) < 36) {
          f.resolvedBy.add(pod.id);
          if (f.type === 'cryo_cloud') {
            pod.shieldHeat = Math.max(25, pod.shieldHeat - 18);
            const pts = 45 * sdMult;
            pod.score += pts;
            this.audio.playChime();
            this.particles.spawnSparks(pod.x, pod.podY, '#38bdf8', 14);
            this.floatingTexts.push({
              x: pod.x,
              y: pod.podY - 24,
              text: `❄️ CRYO COOL! +${pts}`,
              color: '#38bdf8',
              alpha: 1,
              vy: -34,
            });
          } else if (f.type === 'telemetry_ring') {
            pod.combo = Math.min(6, pod.combo + 1);
            const inGreen = pod.shieldHeat >= 40 && pod.shieldHeat <= 78;
            const pts = (inGreen ? 70 : 40) * sdMult;
            pod.score += pts;
            this.audio.playScore();
            this.particles.spawnExplosion(pod.x, pod.podY, '#facc15', 18);
            this.floatingTexts.push({
              x: pod.x,
              y: pod.podY - 26,
              text: inGreen ? `★ OPTIMAL RING! +${pts}` : `RING +${pts}`,
              color: '#facc15',
              alpha: 1.15,
              vy: -36,
            });
          } else if (f.type === 'flak_debris') {
            pod.shieldHeat = Math.min(100, pod.shieldHeat + 22);
            pod.combo = 0;
            pod.score = Math.max(0, pod.score - 18);
            this.audio.playStun();
            this.triggerScreenShake(4);
            this.particles.spawnExplosion(pod.x, pod.podY, '#ef4444', 16);
            this.floatingTexts.push({
              x: pod.x,
              y: pod.podY - 24,
              text: 'DEBRIS HIT! +HEAT',
              color: '#ef4444',
              alpha: 1,
              vy: -30,
            });
          }
        }
      });

      if (f.y < 60) {
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

  private burnRetro(pod: DropPodPilot, isSweetSpot: boolean, sdMult: number): void {
    pod.retroBurnAnim = 1.0;
    const wasInOptimal = pod.shieldHeat >= 40 && pod.shieldHeat <= 82;

    if (isSweetSpot) {
      pod.fallSpeed = Math.max(125, pod.fallSpeed - 110);
      pod.shieldHeat = 50; // Reset directly to center of green window!
      pod.combo = Math.min(6, pod.combo + 1);
      const pts = Math.round((80 + pod.combo * 10) * sdMult);
      pod.score += pts;
      this.audio.playExplosion();
      this.triggerScreenShake(6);
      this.particles.spawnExplosion(pod.x, pod.podY + 20, '#38bdf8', 24);
      this.floatingTexts.push({
        x: pod.x,
        y: pod.podY - 28,
        text: `⚡ CRYO-PURGE BURN! +${pts}`,
        color: '#38bdf8',
        alpha: 1.2,
        vy: -40,
      });

      // Sonic Boom Shunt against nearby rival Drop Pods!
      this.pods.forEach((other) => {
        if (other.id === pod.id) return;
        const dx = other.x - pod.x;
        if (Math.hypot(dx, other.podY - pod.podY) < 165) {
          const sign = dx >= 0 ? 1 : -1;
          other.vx += sign * 250;
          other.shieldHeat = Math.min(98, other.shieldHeat + 24);
          pod.score += 70;
          this.particles.spawnExplosion(other.x, other.podY, '#f43f5e', 18);
          this.floatingTexts.push({
            x: other.x,
            y: other.podY - 30,
            text: 'SONIC BOOM SHUNT! +70',
            color: '#f43f5e',
            alpha: 1.2,
            vy: -42,
          });
        }
      });
    } else {
      pod.fallSpeed = Math.max(130, pod.fallSpeed - 80);
      pod.shieldHeat = Math.max(18, pod.shieldHeat - 22);
      if (wasInOptimal) {
        pod.combo = Math.min(6, pod.combo + 1);
        const pts = (35 + pod.combo * 5) * sdMult;
        pod.score += pts;
        this.audio.playChime();
        this.particles.spawnSparks(pod.x, pod.podY + 22, '#00e5ff', 14);
        this.floatingTexts.push({
          x: pod.x,
          y: pod.podY - 22,
          text: `RETRO COOL +${pts}`,
          color: '#10b981',
          alpha: 1,
          vy: -32,
        });
      } else {
        this.audio.playTap();
        this.particles.spawnSparks(pod.x, pod.podY + 22, '#f97316', 8);
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
    const pod = this.pods.get(botId);
    if (!pod || pod.overheatTimer > 0 || pod.overchargeLockout > 0) return;

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

      // Steer toward telemetry ring or cryo cloud, away from flak debris
      const targetFeature = this.features.find(
        (f) =>
          !f.resolvedBy.has(botId) &&
          f.y > pod.podY &&
          f.y < pod.podY + 220 &&
          (f.type === 'telemetry_ring' || f.type === 'cryo_cloud')
      );
      if (targetFeature && Math.random() >= blunder) {
        const dx = targetFeature.x - pod.x;
        if (Math.abs(dx) > 18) {
          pod.vx += Math.sign(dx) * (difficulty === 'bot_hard' ? 230 : 170);
        }
      }

      const threshold = difficulty === 'bot_hard' ? 68 : difficulty === 'bot_normal' ? 74 : 83;
      if (pod.shieldHeat >= threshold && Math.random() >= blunder) {
        if (!pod.charging && difficulty === 'bot_hard' && Math.random() < 0.6) {
          pod.charging = true;
          pod.charge = 0;
          pod.botReleaseTarget = 0.78 + Math.random() * 0.15;
        } else if (!pod.charging) {
          this.burnRetro(pod, false, sdMult);
        }
      }
    }
    this.botReactionTimers.set(botId, timer);

    if (pod.charging) {
      pod.charge += dt * 0.95;
      if (pod.charge >= pod.botReleaseTarget) {
        const c = pod.charge;
        pod.charging = false;
        pod.charge = 0;
        this.burnRetro(pod, c >= 0.72 && c <= 0.98, sdMult);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.pods.forEach((pod, pId) => scores.set(pId, Math.floor(pod.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.pods.entries())
      .map(([playerId, pod]) => ({ playerId, score: Math.floor(pod.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${this.getPlayer(winnerId)?.name ?? winnerId} executed a textbook orbital drop!`
        : 'All drop pods overheated in the ionosphere!',
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];

    // 1. Fiery Atmospheric Re-Entry Gradient Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, pal.bgTop);
    bgGrad.addColorStop(0.5, pal.bgMid);
    bgGrad.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Rising Plasma Ionization Streaks
    ctx.strokeStyle = pal.streakColor;
    ctx.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      const sx = (i * 57 + 30) % width;
      const sy = height - ((this.animTime * 340 + i * 65) % height);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + 36);
      ctx.stroke();
    }

    // 3. Render Rising Atmospheric Features (Cryo Clouds, Telemetry Rings, Flak Debris)
    for (const f of this.features) {
      ctx.save();
      ctx.translate(f.x, f.y);

      if (f.type === 'cryo_cloud') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.strokeStyle = pal.cryoColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 28, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (f.type === 'telemetry_ring') {
        ctx.strokeStyle = pal.beaconColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Burning Satellite Flak Debris
        ctx.rotate(this.animTime * 4 + f.id);
        ctx.fillStyle = pal.debrisColor;
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(14, 10);
        ctx.lineTo(-14, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    // 4. Render 2.5D Armored Orbital Drop Pods & Mascot Troopers
    this.pods.forEach((pod, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#f97316';

      ctx.save();
      ctx.translate(pod.x, pod.podY);

      if (pod.overheatTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      } else {
        ctx.rotate(Math.max(-0.22, Math.min(0.22, pod.vx * 0.0007)));
      }

      // Retro-Thruster Cryo Jets
      if (pod.retroBurnAnim > 0) {
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.moveTo(-14, 18);
        ctx.lineTo(0, 38 + pod.retroBurnAnim * 12);
        ctx.lineTo(14, 18);
        ctx.closePath();
        ctx.fill();
      }

      // Armored Conical Drop Pod Hull
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(20, 14);
      ctx.lineTo(-20, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Mascot Shock-Trooper in Reinforced Pod Viewport
      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        -2,
        13,
        pod.overheatTimer > 0 ? 'shocked' : pod.retroBurnAnim > 0.2 ? 'triumph' : 'focused',
        this.animTime
      );

      // Ablative Curved Heat Shield at Base
      const shieldColor =
        pod.shieldHeat > 78 ? '#ef4444' : pod.shieldHeat >= 40 ? '#10b981' : '#38bdf8';
      ctx.fillStyle = shieldColor;
      ctx.beginPath();
      ctx.ellipse(0, 16, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Overhead Thermal Shield Gauge (40%–78% Green Safe Window)
      const bw = 50;
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(-bw / 2 - 1, -42, bw + 2, 7);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.42)';
      ctx.fillRect(-bw / 2 + bw * 0.4, -41, bw * 0.38, 5);
      ctx.fillStyle = shieldColor;
      ctx.fillRect(-bw / 2, -41, (bw * pod.shieldHeat) / 100, 5);

      // Hold-to-Charge Cryo-Purge Bar (72%–98% Sweet Spot)
      if (pod.charging && pod.charge > 0.04) {
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(-bw / 2 - 1, -51, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -50, bw * 0.26, 4);
        const isSweet = pod.charge >= 0.72 && pod.charge <= 0.98;
        ctx.fillStyle = isSweet ? '#facc15' : '#00e5ff';
        ctx.fillRect(-bw / 2, -50, bw * Math.min(1, pod.charge), 4);
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
      '☄️ STEER POD • TAP: RETRO-COOL IN GREEN • HOLD (72–98%): CRYO-PURGE & SONIC SHUNT!',
      width * 0.5,
      73
    );

    // 7. Corner Player Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const pod = this.pods.get(p.id);
      if (!pod) return;
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
      ctx.fillText(`${p.name}: ${Math.floor(pod.score)}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`Heat: ${Math.floor(pod.shieldHeat)}% • ${pod.combo}x Cool`, cardX + 10, cardY + 28);
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
