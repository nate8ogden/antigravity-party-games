import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type PenguinTheme = 'antarctica' | 'aurora_chute' | 'cyber_glacier';

interface ThemePalette {
  name: string;
  skyTop: string;
  skyBottom: string;
  iceTop: string;
  iceBottom: string;
  laneLine: string;
  accent: string;
}

const THEMES: Record<PenguinTheme, ThemePalette> = {
  antarctica: {
    name: 'Antarctic Bobsled',
    skyTop: '#0369a1',
    skyBottom: '#7dd3fc',
    iceTop: '#e0f2fe',
    iceBottom: '#bae6fd',
    laneLine: 'rgba(2, 132, 199, 0.35)',
    accent: '#0284c7',
  },
  aurora_chute: {
    name: 'Aurora Borealis Chute',
    skyTop: '#06122e',
    skyBottom: '#10b981',
    iceTop: '#cffafe',
    iceBottom: '#67e8f9',
    laneLine: 'rgba(13, 148, 136, 0.38)',
    accent: '#14b8a6',
  },
  cyber_glacier: {
    name: 'Cyber Neon Glacier',
    skyTop: '#0f0524',
    skyBottom: '#3b0764',
    iceTop: '#1e1b4b',
    iceBottom: '#312e81',
    laneLine: 'rgba(236, 72, 153, 0.45)',
    accent: '#ec4899',
  },
};

const THEME_ORDER: PenguinTheme[] = ['antarctica', 'aurora_chute', 'cyber_glacier'];

interface PenguinRacer {
  id: PlayerId;
  x: number;
  vx: number;
  lane: number;
  ySmooth: number;
  zHeight: number;
  vz: number;
  chargeRatio: number;
  torpedoTimer: number;
  stunTimer: number;
  drafting: boolean;
  score: number;
  combo: number;
  underdog: boolean;
  laneCooldown: number;
  aiReactTimer: number;
  aiTargetLane: number;
  aiShouldHold: boolean;
}

interface ChuteItem {
  id: number;
  x: number;
  lane: number;
  type: 'ramp' | 'crevasse' | 'sardine' | 'king_salmon' | 'slalom_gate';
  active: boolean;
  passedPlayers: Set<PlayerId>;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export class PenguinSlideGame extends BaseGame {
  private racers: Map<PlayerId, PenguinRacer> = new Map();
  private items: ChuteItem[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextItemId: number = 1;
  private spawnTimer: number = 0.7;
  private scrollOffset: number = 0;
  private animTime: number = 0;
  private theme: PenguinTheme = 'antarctica';
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

  private getLaneY(lane: number, height: number): number {
    const topY = 185;
    const laneH = (height - topY - 125) / 3;
    return topY + laneH * (lane + 0.5);
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
          this.theme = 'antarctica';
          this.audio.playTap();
        } else if (e.key === '2') {
          this.theme = 'aurora_chute';
          this.audio.playTap();
        } else if (e.key === '3') {
          this.theme = 'cyber_glacier';
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

  public reset(_width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.racers.clear();
    this.items = [];
    this.floatingTexts = [];
    this.suddenDeath = false;
    this.screenShake = 0;

    const active = this.getActivePlayers();
    active.forEach((p, i) => {
      const startLane = i % 3;
      this.racers.set(p.id, {
        id: p.id,
        x: 190 + i * 38,
        vx: 0,
        lane: startLane,
        ySmooth: this.getLaneY(startLane, height),
        zHeight: 0,
        vz: 0,
        chargeRatio: 0,
        torpedoTimer: 0,
        stunTimer: 0,
        drafting: false,
        score: 0,
        combo: 1,
        underdog: false,
        laneCooldown: 0,
        aiReactTimer: 0.2,
        aiTargetLane: startLane,
        aiShouldHold: false,
      });
    });
  }

  private spawnCourseWave(width: number): void {
    const lane = Math.floor(Math.random() * 3);
    const roll = Math.random();
    if (roll < 0.28) {
      this.items.push({
        id: this.nextItemId++,
        x: width + 60,
        lane,
        type: 'ramp',
        active: true,
        passedPlayers: new Set(),
      });
      this.items.push({
        id: this.nextItemId++,
        x: width + 210,
        lane,
        type: 'king_salmon',
        active: true,
        passedPlayers: new Set(),
      });
    } else if (roll < 0.56) {
      this.items.push({
        id: this.nextItemId++,
        x: width + 60,
        lane,
        type: 'crevasse',
        active: true,
        passedPlayers: new Set(),
      });
      const safeLane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      this.items.push({
        id: this.nextItemId++,
        x: width + 75,
        lane: safeLane,
        type: Math.random() < 0.5 ? 'slalom_gate' : 'sardine',
        active: true,
        passedPlayers: new Set(),
      });
    } else {
      this.items.push({
        id: this.nextItemId++,
        x: width + 60,
        lane,
        type: Math.random() < 0.45 ? 'slalom_gate' : 'sardine',
        active: true,
        passedPlayers: new Set(),
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    const clampedDt = Math.min(dt, 0.05);
    this.animTime += clampedDt;
    const baseSpeed = this.suddenDeath ? 430 : 340;
    this.scrollOffset = (this.scrollOffset + baseSpeed * clampedDt) % 120;

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
      this.triggerScreenShake(10);
      this.audio.playFanfare();
      this.addFloatingText(width / 2, 108, 'AVALANCHE SPRINT! 2X SALMON & GATES!', '#38bdf8');
    }

    let maxScore = 0;
    this.racers.forEach((r) => {
      if (r.score > maxScore) maxScore = r.score;
    });
    this.racers.forEach((r) => {
      r.underdog = maxScore - r.score >= 110;
    });

    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (this.suddenDeath ? 0.48 : 0.72) + Math.random() * 0.25;
      this.spawnCourseWave(width);
    }

    this.updateBots(clampedDt, width, height);

    this.racers.forEach((r) => {
      const p = this.getPlayer(r.id);
      if (!p) return;

      if (r.laneCooldown > 0) r.laneCooldown = Math.max(0, r.laneCooldown - clampedDt);
      if (r.torpedoTimer > 0) r.torpedoTimer = Math.max(0, r.torpedoTimer - clampedDt);

      if (r.stunTimer > 0) {
        r.stunTimer = Math.max(0, r.stunTimer - clampedDt);
        r.chargeRatio = 0;
      }

      r.drafting = false;
      this.racers.forEach((other) => {
        if (other.id === r.id) return;
        if (other.lane === r.lane && other.x > r.x + 25 && other.x - r.x < 190) {
          r.drafting = true;
        }
      });

      if (r.stunTimer <= 0) {
        let steer = 0;
        let tapSwitch = false;
        let holdAction = false;
        let releaseAction = false;

        if (!p.type.startsWith('bot_')) {
          steer = this.input.getSteer(p.id);
          tapSwitch = this.input.justPressed(p.id);
          holdAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
          releaseAction = this.input.justReleased(p.id);

          if (Math.abs(steer) > 0.5 && r.laneCooldown <= 0) {
            const nextLane = Math.max(0, Math.min(2, r.lane + (steer > 0 ? 1 : -1)));
            if (nextLane !== r.lane) {
              r.lane = nextLane;
              r.laneCooldown = 0.2;
              this.audio.playTap();
            }
          } else if (tapSwitch && r.laneCooldown <= 0) {
            r.lane = (r.lane + 1) % 3;
            r.laneCooldown = 0.18;
            this.audio.playTap();
          }
        } else {
          if (r.lane !== r.aiTargetLane && r.laneCooldown <= 0) {
            r.lane += Math.sign(r.aiTargetLane - r.lane);
            r.laneCooldown = 0.22;
            this.audio.playTap();
          }
          holdAction = r.aiShouldHold;
          if (!holdAction && r.chargeRatio >= 0.76) {
            releaseAction = true;
          }
        }

        if (holdAction) {
          r.chargeRatio = Math.min(1, r.chargeRatio + clampedDt * 0.85);
          if (r.chargeRatio >= 1.0) {
            r.stunTimer = 0.75;
            r.chargeRatio = 0;
            r.combo = 1;
            this.audio.playStun();
            this.addFloatingText(r.x, r.ySmooth - 36, 'BELLY SPIN OUT!', '#ef4444');
          }
        } else {
          if (releaseAction && r.chargeRatio >= 0.72 && r.chargeRatio <= 0.98) {
            this.fireTorpedoSpin(r, p.color);
          }
          r.chargeRatio = Math.max(0, r.chargeRatio - clampedDt * 2.4);
        }
      }

      const targetX =
        215 +
        (r.drafting ? 75 : 0) +
        (r.torpedoTimer > 0 ? 110 : 0) +
        (r.underdog ? 45 : 0) -
        (r.stunTimer > 0 ? 70 : 0);
      r.vx += (targetX - r.x) * 4.5 * clampedDt;
      r.vx *= Math.pow(0.12, clampedDt);
      r.x = Math.max(110, Math.min(width - 140, r.x + r.vx * clampedDt));

      const targetY = this.getLaneY(r.lane, height);
      r.ySmooth += (targetY - r.ySmooth) * Math.min(1, clampedDt * 13);

      if (r.zHeight > 0 || r.vz !== 0) {
        r.zHeight += r.vz * clampedDt;
        r.vz -= 640 * clampedDt;
        if (r.zHeight <= 0) {
          r.zHeight = 0;
          r.vz = 0;
          this.particles.spawnSparks(r.x, r.ySmooth, '#e0f2fe', 8);
        }
      }
    });

    // Elastic Penguin-to-Penguin Collisions
    const list = Array.from(this.racers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (Math.abs(a.zHeight - b.zHeight) > 26) continue;
        const dx = b.x - a.x;
        const dy = b.ySmooth - a.ySmooth;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          b.x += nx * overlap * 0.5;

          const impulse = 190;
          a.vx -= nx * impulse * (b.underdog ? 1.35 : 1.0);
          b.vx += nx * impulse * (a.underdog ? 1.35 : 1.0);

          if (a.torpedoTimer > 0 && b.laneCooldown <= 0) {
            b.lane = Math.max(0, Math.min(2, b.lane + (Math.random() > 0.5 ? 1 : -1)));
            b.laneCooldown = 0.35;
          } else if (b.torpedoTimer > 0 && a.laneCooldown <= 0) {
            a.lane = Math.max(0, Math.min(2, a.lane + (Math.random() > 0.5 ? 1 : -1)));
            a.laneCooldown = 0.35;
          }

          this.audio.playBounce();
          this.triggerScreenShake(5);
          this.particles.spawnSparks(
            (a.x + b.x) * 0.5,
            (a.ySmooth + b.ySmooth) * 0.5,
            '#ffffff',
            10
          );
        }
      }
    }

    // Update Course Items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.x -= baseSpeed * clampedDt;
      const itemY = this.getLaneY(it.lane, height);

      if (it.active) {
        this.racers.forEach((r) => {
          if (!it.active) return;
          if (Math.abs(r.x - it.x) < 34 && Math.abs(r.ySmooth - itemY) < 28) {
            const mult = this.suddenDeath ? 2 : 1;

            if (it.type === 'ramp' && !it.passedPlayers.has(r.id)) {
              it.passedPlayers.add(r.id);
              r.vz = 275;
              r.zHeight = Math.max(r.zHeight, 4);
              const pts = 18 * mult;
              r.score += pts;
              this.audio.playWhoosh();
              this.particles.spawnSparks(r.x, r.ySmooth, '#38bdf8', 12);
              this.addFloatingText(r.x, r.ySmooth - 36, `+${pts} ICE LAUNCH!`, '#38bdf8');
            } else if (it.type === 'king_salmon') {
              if (r.zHeight >= 22 || r.torpedoTimer > 0) {
                it.active = false;
                const pts = 50 * mult;
                r.score += pts;
                r.combo = Math.min(5, r.combo + 1);
                this.audio.playCoin();
                this.triggerScreenShake(6);
                this.particles.spawnExplosion(it.x, itemY - 36, '#facc15', 18);
                this.addFloatingText(it.x, itemY - 52, `+${pts} GOLDEN KING SALMON!`, '#facc15');
              }
            } else if (it.type === 'sardine') {
              it.active = false;
              const pts = 22 * mult;
              r.score += pts;
              this.audio.playCoin();
              this.particles.spawnSparks(it.x, itemY, '#38bdf8', 10);
              this.addFloatingText(it.x, itemY - 26, `+${pts} SARDINE!`, '#38bdf8');
            } else if (it.type === 'slalom_gate' && !it.passedPlayers.has(r.id)) {
              it.passedPlayers.add(r.id);
              const pts = (20 + r.combo * 5) * mult;
              r.score += pts;
              r.combo = Math.min(5, r.combo + 1);
              this.audio.playScore();
              this.particles.spawnSparks(it.x, itemY, '#4ade80', 12);
              this.addFloatingText(it.x, itemY - 30, `+${pts} SLALOM (${r.combo}x)`, '#4ade80');
            } else if (it.type === 'crevasse' && !it.passedPlayers.has(r.id)) {
              if (r.zHeight > 18 || r.torpedoTimer > 0) {
                it.passedPlayers.add(r.id);
                const pts = 25 * mult;
                r.score += pts;
                this.audio.playBounce();
                this.addFloatingText(r.x, r.ySmooth - 36, `+${pts} CREVASSE CLEARED!`, '#38bdf8');
              } else {
                it.passedPlayers.add(r.id);
                r.score = Math.max(0, r.score - 15);
                r.stunTimer = 0.85;
                r.vx = -160;
                r.combo = 1;
                this.audio.playExplosion();
                this.triggerScreenShake(8);
                this.particles.spawnExplosion(r.x, r.ySmooth, '#ef4444', 18);
                this.addFloatingText(r.x, r.ySmooth - 30, 'CREVASSE DROP! -15', '#ef4444');
              }
            }
          }
        });
      }

      if (it.x < -90) {
        this.items.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.95;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private fireTorpedoSpin(r: PenguinRacer, color: string): void {
    const mult = this.suddenDeath ? 2 : 1;
    const bonus = 45 * mult;
    r.score += bonus;
    r.torpedoTimer = 2.4;
    r.vx += 240;
    this.audio.playScore();
    this.triggerScreenShake(8);
    this.particles.spawnExplosion(r.x, r.ySmooth - r.zHeight, '#38bdf8', 22);
    this.addFloatingText(r.x, r.ySmooth - r.zHeight - 36, `+${bonus} BELLY-TORPEDO SURGE!`, '#38bdf8');

    this.racers.forEach((other) => {
      if (other.id === r.id) return;
      if (Math.abs(other.x - r.x) < 165 && Math.abs(other.lane - r.lane) <= 1) {
        other.stunTimer = Math.max(other.stunTimer, 0.75);
        other.vx -= 210;
        if (other.lane === r.lane) {
          other.lane = (other.lane + 1) % 3;
        }
        const shuntPts = 40 * mult;
        r.score += shuntPts;
        this.audio.playBounce();
        this.particles.spawnExplosion(other.x, other.ySmooth, '#ffffff', 18);
        this.addFloatingText(other.x, other.ySmooth - 32, `+${shuntPts} SNOW-SPRAY SHUNT!`, color);
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const r = this.racers.get(botId);
    if (!r) return;

    r.aiReactTimer -= dt;
    if (r.aiReactTimer > 0) return;

    const reactDelay =
      difficulty === 'bot_hard' ? 0.11 : difficulty === 'bot_normal' ? 0.23 : 0.4;
    const blunderRate =
      difficulty === 'bot_hard' ? 0.02 : difficulty === 'bot_normal' ? 0.12 : 0.22;
    r.aiReactTimer = reactDelay + Math.random() * 0.05;

    if (Math.random() < blunderRate) {
      r.aiShouldHold = false;
      return;
    }

    const laneScores = [0, 0, 0];
    for (const it of this.items) {
      if (!it.active || it.x < r.x - 15 || it.x > r.x + 360) continue;
      const distFactor = 1 - (it.x - r.x) / 380;
      if (it.type === 'crevasse' && r.zHeight < 10 && r.torpedoTimer <= 0) {
        laneScores[it.lane] -= 120 * distFactor;
      } else if (it.type === 'ramp') {
        laneScores[it.lane] += 75 * distFactor;
      } else if (it.type === 'king_salmon') {
        laneScores[it.lane] += 95 * distFactor;
      } else if (it.type === 'slalom_gate' || it.type === 'sardine') {
        laneScores[it.lane] += 55 * distFactor;
      }
    }

    let bestLane = r.lane;
    let bestVal = laneScores[r.lane];
    for (let l = 0; l < 3; l++) {
      if (laneScores[l] > bestVal + 8) {
        bestVal = laneScores[l];
        bestLane = l;
      }
    }
    r.aiTargetLane = bestLane;

    let rivalClose = false;
    this.racers.forEach((other) => {
      if (other.id !== r.id && Math.abs(other.x - r.x) < 150) {
        rivalClose = true;
      }
    });
    if ((rivalClose || r.chargeRatio > 0.15) && r.chargeRatio < 0.84) {
      r.aiShouldHold = true;
    } else {
      r.aiShouldHold = false;
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

    const skyGrad = ctx.createLinearGradient(0, 0, 0, 185);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, 185);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, 185);
    for (let x = 0; x <= width; x += 110) {
      const peakH = 55 + ((x * 37) % 45);
      ctx.lineTo(x + 55, 185 - peakH);
      ctx.lineTo(x + 110, 185);
    }
    ctx.fill();

    const chuteTop = 175;
    const chuteBottom = height - 115;
    const iceGrad = ctx.createLinearGradient(0, chuteTop, 0, chuteBottom);
    iceGrad.addColorStop(0, pal.iceTop);
    iceGrad.addColorStop(1, pal.iceBottom);
    ctx.fillStyle = iceGrad;
    ctx.fillRect(0, chuteTop, width, chuteBottom - chuteTop);

    ctx.strokeStyle = pal.laneLine;
    ctx.lineWidth = 2.5;
    for (let l = 1; l < 3; l++) {
      const ly = chuteTop + ((chuteBottom - chuteTop) / 3) * l;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(width, ly);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    for (let x = -this.scrollOffset; x < width; x += 120) {
      for (let l = 0; l < 3; l++) {
        const ly = this.getLaneY(l, height);
        ctx.beginPath();
        ctx.moveTo(x, ly - 14);
        ctx.lineTo(x + 48, ly - 14);
        ctx.stroke();
      }
    }

    for (const it of this.items) {
      if (!it.active) continue;
      const iy = this.getLaneY(it.lane, height);
      ctx.save();
      ctx.translate(it.x, iy);

      if (it.type === 'crevasse') {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-22, -22);
        ctx.lineTo(18, -12);
        ctx.lineTo(6, 4);
        ctx.lineTo(22, 22);
        ctx.lineTo(-16, 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (it.type === 'ramp') {
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-26, 16);
        ctx.lineTo(24, -18);
        ctx.lineTo(24, 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (it.type === 'slalom_gate') {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-4, -32, 4, 34);
        ctx.beginPath();
        ctx.moveTo(0, -32);
        ctx.lineTo(18, -24);
        ctx.lineTo(0, -16);
        ctx.fill();
      } else if (it.type === 'sardine') {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.type === 'king_salmon') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        const bob = -36 + Math.sin(this.animTime * 6) * 5;
        ctx.translate(0, bob);
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 8, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    this.racers.forEach((r) => {
      const p = this.getPlayer(r.id);
      if (!p) return;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.beginPath();
      ctx.ellipse(
        r.x,
        r.ySmooth + 14,
        Math.max(10, 22 - r.zHeight * 0.15),
        7,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      const drawY = r.ySmooth - r.zHeight;
      ctx.save();
      ctx.translate(r.x, drawY);

      if (r.torpedoTimer > 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(0, 6, 24, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(3, 9, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(22, 4);
      ctx.lineTo(31, 7);
      ctx.lineTo(22, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const mood =
        r.stunTimer > 0
          ? 'shocked'
          : r.torpedoTimer > 0 || r.zHeight > 15
          ? 'triumph'
          : r.drafting
          ? 'focused'
          : 'idle';
      this.drawPlayerMascot(
        ctx,
        p.id,
        r.x - 2,
        drawY - 4,
        17,
        mood,
        this.animTime,
        r.torpedoTimer > 0 ? this.animTime * 14 : 0.15
      );

      if (r.chargeRatio > 0.05) {
        const inSweet = r.chargeRatio >= 0.72 && r.chargeRatio <= 0.98;
        ctx.strokeStyle = inSweet ? '#facc15' : '#0284c7';
        ctx.lineWidth = inSweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(r.x, drawY, 26, -Math.PI / 2, -Math.PI / 2 + r.chargeRatio * Math.PI * 2);
        ctx.stroke();
      }
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
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width / 2 - 255, 52, 510, 28, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🐧 STEER / TAP: SWITCH LANE • JUMP RAMPS FOR SALMON • HOLD (72-98%): TORPEDO SHUNT!',
      width / 2,
      70
    );

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const r = this.racers.get(p.id);
      if (!r) return;
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
      ctx.fillText(`${p.name}: ${Math.floor(r.score)}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${r.combo}x Slalom ${r.drafting ? '• ⚡DRAFT' : ''}`, cardX + 10, cardY + 28);
    });

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = pal.accent;
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
    return this.racers.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.racers.entries())
      .map(([playerId, r]) => ({ playerId, score: Math.floor(r.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${winnerId} conquered the Antarctic Glacier Bobsled Chute!`
        : 'Glacier Bobsled Showdown!',
    };
  }
}
