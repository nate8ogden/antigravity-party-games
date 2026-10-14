import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type IcebreakerTheme = 'svalbard' | 'antarctic_shelf' | 'cyber_arctic';

interface ThemePalette {
  name: string;
  seaTop: string;
  seaBottom: string;
  iceFill: string;
  iceStroke: string;
  accent: string;
}

const THEMES: Record<IcebreakerTheme, ThemePalette> = {
  svalbard: {
    name: 'Svalbard Pack Ice',
    seaTop: '#082f49',
    seaBottom: '#0369a1',
    iceFill: '#e0f2fe',
    iceStroke: '#7dd3fc',
    accent: '#38bdf8',
  },
  antarctic_shelf: {
    name: 'Ross Ice Shelf',
    seaTop: '#0f172a',
    seaBottom: '#1e3a8a',
    iceFill: '#f1f5f9',
    iceStroke: '#93c5fd',
    accent: '#60a5fa',
  },
  cyber_arctic: {
    name: 'Cyber Cryo Sea',
    seaTop: '#090418',
    seaBottom: '#1e1b4b',
    iceFill: '#cffafe',
    iceStroke: '#22d3ee',
    accent: '#06b6d4',
  },
};

const THEME_ORDER: IcebreakerTheme[] = ['svalbard', 'antarctic_shelf', 'cyber_arctic'];

interface IcebreakerShip {
  id: PlayerId;
  x: number;
  vx: number;
  lane: number;
  ySmooth: number;
  chargeRatio: number;
  ramBoostTimer: number;
  stunTimer: number;
  score: number;
  combo: number;
  underdog: boolean;
  laneCooldown: number;
  aiReactTimer: number;
  aiTargetLane: number;
  aiShouldHold: boolean;
}

interface SeaObstacle {
  id: number;
  x: number;
  lane: number;
  type: 'pack_floe' | 'diamond_berg' | 'glacial_wall' | 'sea_mine';
  active: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export class IcebergBreakerGame extends BaseGame {
  private ships: Map<PlayerId, IcebreakerShip> = new Map();
  private obstacles: SeaObstacle[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextObsId: number = 1;
  private spawnTimer: number = 0.75;
  private waveTime: number = 0;
  private theme: IcebreakerTheme = 'svalbard';
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
    const topY = 175;
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
          this.theme = 'svalbard';
          this.audio.playTap();
        } else if (e.key === '2') {
          this.theme = 'antarctic_shelf';
          this.audio.playTap();
        } else if (e.key === '3') {
          this.theme = 'cyber_arctic';
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
    this.ships.clear();
    this.obstacles = [];
    this.floatingTexts = [];
    this.suddenDeath = false;
    this.screenShake = 0;

    const active = this.getActivePlayers();
    active.forEach((p, i) => {
      const lane = i % 3;
      this.ships.set(p.id, {
        id: p.id,
        x: 185 + i * 36,
        vx: 0,
        lane,
        ySmooth: this.getLaneY(lane, height),
        chargeRatio: 0,
        ramBoostTimer: 0,
        stunTimer: 0,
        score: 0,
        combo: 1,
        underdog: false,
        laneCooldown: 0,
        aiReactTimer: 0.2,
        aiTargetLane: lane,
        aiShouldHold: false,
      });
    });
  }

  private spawnIceWave(width: number): void {
    const lane = Math.floor(Math.random() * 3);
    const roll = Math.random();
    const type: SeaObstacle['type'] =
      roll < 0.28
        ? 'diamond_berg'
        : roll < 0.62
        ? 'pack_floe'
        : roll < 0.82
        ? 'glacial_wall'
        : 'sea_mine';

    this.obstacles.push({
      id: this.nextObsId++,
      x: width + 70,
      lane,
      type,
      active: true,
    });

    if (Math.random() < 0.55) {
      const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      this.obstacles.push({
        id: this.nextObsId++,
        x: width + 115,
        lane: lane2,
        type: Math.random() < 0.35 ? 'diamond_berg' : 'pack_floe',
        active: true,
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    const clampedDt = Math.min(dt, 0.05);
    this.waveTime += clampedDt;
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
      this.triggerScreenShake(11);
      this.audio.playFanfare();
      this.addFloatingText(width / 2, 108, 'POLAR VORTEX! 2X DIAMOND CORES!', '#38bdf8');
    }

    let maxScore = 0;
    this.ships.forEach((s) => {
      if (s.score > maxScore) maxScore = s.score;
    });
    this.ships.forEach((s) => {
      s.underdog = maxScore - s.score >= 110;
    });

    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (this.suddenDeath ? 0.52 : 0.78) + Math.random() * 0.25;
      this.spawnIceWave(width);
    }

    const scrollSpeed = this.suddenDeath ? 340 : 270;
    this.updateBots(clampedDt, width, height);

    this.ships.forEach((s) => {
      const p = this.getPlayer(s.id);
      if (!p) return;

      if (s.laneCooldown > 0) s.laneCooldown = Math.max(0, s.laneCooldown - clampedDt);
      if (s.ramBoostTimer > 0) s.ramBoostTimer = Math.max(0, s.ramBoostTimer - clampedDt);

      if (s.stunTimer > 0) {
        s.stunTimer = Math.max(0, s.stunTimer - clampedDt);
        s.chargeRatio = 0;
      } else {
        let steer = 0;
        let tapSwitch = false;
        let holdAction = false;
        let releaseAction = false;

        if (!p.type.startsWith('bot_')) {
          steer = this.input.getSteer(p.id);
          tapSwitch = this.input.justPressed(p.id);
          holdAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
          releaseAction = this.input.justReleased(p.id);

          if (Math.abs(steer) > 0.5 && s.laneCooldown <= 0) {
            const nextLane = Math.max(0, Math.min(2, s.lane + (steer > 0 ? 1 : -1)));
            if (nextLane !== s.lane) {
              s.lane = nextLane;
              s.laneCooldown = 0.2;
              this.audio.playTap();
            }
          } else if (tapSwitch && s.laneCooldown <= 0) {
            s.lane = (s.lane + 1) % 3;
            s.laneCooldown = 0.18;
            this.audio.playTap();
          }
        } else {
          if (s.lane !== s.aiTargetLane && s.laneCooldown <= 0) {
            s.lane += Math.sign(s.aiTargetLane - s.lane);
            s.laneCooldown = 0.22;
            this.audio.playTap();
          }
          holdAction = s.aiShouldHold;
          if (!holdAction && s.chargeRatio >= 0.76) {
            releaseAction = true;
          }
        }

        if (holdAction) {
          s.chargeRatio = Math.min(1, s.chargeRatio + clampedDt * 0.82);
          if (s.chargeRatio >= 1.0) {
            s.stunTimer = 0.8;
            s.chargeRatio = 0;
            s.combo = 1;
            this.audio.playStun();
            this.particles.spawnExplosion(s.x, s.ySmooth, '#ef4444', 16);
            this.addFloatingText(s.x, s.ySmooth - 34, 'BOILER OVERPRESSURE!', '#ef4444');
          }
        } else {
          if (releaseAction && s.chargeRatio >= 0.72 && s.chargeRatio <= 0.98) {
            this.fireTurbineRam(s, p.color);
          }
          s.chargeRatio = Math.max(0, s.chargeRatio - clampedDt * 2.2);
        }
      }

      const targetX =
        210 +
        (s.ramBoostTimer > 0 ? 120 : 0) +
        (s.underdog ? 45 : 0) -
        (s.stunTimer > 0 ? 75 : 0);
      s.vx += (targetX - s.x) * 4.2 * clampedDt;
      s.vx *= Math.pow(0.14, clampedDt);
      s.x = Math.max(115, Math.min(width - 140, s.x + s.vx * clampedDt));

      const targetY = this.getLaneY(s.lane, height);
      s.ySmooth += (targetY - s.ySmooth) * Math.min(1, clampedDt * 12);
    });

    // Elastic Icebreaker-to-Icebreaker Collisions
    const list = Array.from(this.ships.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.ySmooth - a.ySmooth;
        const dist = Math.hypot(dx, dy);
        const minDist = 48;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          b.x += nx * overlap * 0.5;

          const impulse = 195;
          a.vx -= nx * impulse * (b.underdog ? 1.35 : 1.0);
          b.vx += nx * impulse * (a.underdog ? 1.35 : 1.0);

          this.audio.playBounce();
          this.triggerScreenShake(5);
          this.particles.spawnSparks(
            (a.x + b.x) * 0.5,
            (a.ySmooth + b.ySmooth) * 0.5,
            '#ffffff',
            12
          );
        }
      }
    }

    // Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const ob = this.obstacles[i];
      ob.x -= scrollSpeed * clampedDt;
      const oy = this.getLaneY(ob.lane, height);

      if (ob.active) {
        this.ships.forEach((s) => {
          if (!ob.active) return;
          if (Math.abs(s.x - ob.x) < 42 && Math.abs(s.ySmooth - oy) < 30) {
            ob.active = false;
            const mult = this.suddenDeath ? 2 : 1;
            const isRamming = s.ramBoostTimer > 0 || s.chargeRatio >= 0.45;

            if (ob.type === 'sea_mine') {
              if (s.ramBoostTimer > 0) {
                const pts = 30 * mult;
                s.score += pts;
                this.audio.playBounce();
                this.particles.spawnExplosion(ob.x, oy, '#38bdf8', 18);
                this.addFloatingText(ob.x, oy - 30, `+${pts} MINE DEFLECTED!`, '#38bdf8');
              } else {
                s.score = Math.max(0, s.score - 20);
                s.stunTimer = 0.9;
                s.vx = -180;
                s.combo = 1;
                this.audio.playExplosion();
                this.triggerScreenShake(9);
                this.particles.spawnExplosion(ob.x, oy, '#ef4444', 22);
                this.addFloatingText(ob.x, oy - 30, 'NAVAL MINE! -20', '#ef4444');
              }
            } else if (ob.type === 'glacial_wall' && !isRamming) {
              s.score = Math.max(0, s.score - 10);
              s.stunTimer = 0.65;
              s.vx = -150;
              s.combo = 1;
              this.audio.playStun();
              this.triggerScreenShake(7);
              this.particles.spawnSparks(ob.x, oy, '#93c5fd', 16);
              this.addFloatingText(ob.x, oy - 30, 'NEED TURBINE CHARGE! -10', '#f97316');
            } else {
              const isDiamond = ob.type === 'diamond_berg';
              const basePts = isDiamond ? 50 : ob.type === 'glacial_wall' ? 40 : 24;
              const pts = (basePts + s.combo * 5) * mult;
              s.score += pts;
              s.combo = Math.min(6, s.combo + 1);
              this.audio.playScore();
              this.triggerScreenShake(isDiamond ? 7 : 5);
              this.particles.spawnExplosion(ob.x, oy, isDiamond ? '#facc15' : '#7dd3fc', 20);
              this.addFloatingText(
                ob.x,
                oy - 32,
                `+${pts} ${isDiamond ? 'DIAMOND CORE!' : 'ICE SHATTER!'} (${s.combo}x)`,
                isDiamond ? '#facc15' : '#38bdf8'
              );
            }
          }
        });
      }

      if (ob.x < -90) {
        this.obstacles.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.95;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private fireTurbineRam(s: IcebreakerShip, color: string): void {
    const mult = this.suddenDeath ? 2 : 1;
    const bonus = 45 * mult;
    s.score += bonus;
    s.ramBoostTimer = 2.5;
    s.vx += 260;
    this.audio.playScore();
    this.triggerScreenShake(9);
    this.particles.spawnExplosion(s.x + 22, s.ySmooth, '#38bdf8', 24);
    this.addFloatingText(s.x, s.ySmooth - 36, `+${bonus} TURBINE RAM OVERDRIVE!`, '#38bdf8');

    this.ships.forEach((other) => {
      if (other.id === s.id) return;
      if (Math.abs(other.x - s.x) < 175 && Math.abs(other.lane - s.lane) <= 1) {
        other.stunTimer = Math.max(other.stunTimer, 0.75);
        other.vx -= 220;
        if (other.lane === s.lane) {
          other.lane = (other.lane + 1) % 3;
        }
        const shuntPts = 45 * mult;
        s.score += shuntPts;
        this.audio.playExplosion();
        this.particles.spawnExplosion(other.x, other.ySmooth, color, 20);
        this.addFloatingText(other.x, other.ySmooth - 32, `+${shuntPts} BOW-WAVE SHUNT!`, color);
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
    const s = this.ships.get(botId);
    if (!s) return;

    s.aiReactTimer -= dt;
    if (s.aiReactTimer > 0) return;

    const reactDelay =
      difficulty === 'bot_hard' ? 0.11 : difficulty === 'bot_normal' ? 0.23 : 0.41;
    const blunderRate =
      difficulty === 'bot_hard' ? 0.02 : difficulty === 'bot_normal' ? 0.12 : 0.22;
    s.aiReactTimer = reactDelay + Math.random() * 0.05;

    if (Math.random() < blunderRate) {
      s.aiShouldHold = false;
      return;
    }

    const laneScores = [0, 0, 0];
    let wallAhead = false;
    for (const ob of this.obstacles) {
      if (!ob.active || ob.x < s.x - 10 || ob.x > s.x + 360) continue;
      const distFactor = 1 - (ob.x - s.x) / 380;
      if (ob.type === 'sea_mine' && s.ramBoostTimer <= 0) {
        laneScores[ob.lane] -= 130 * distFactor;
      } else if (ob.type === 'diamond_berg') {
        laneScores[ob.lane] += 95 * distFactor;
      } else if (ob.type === 'pack_floe') {
        laneScores[ob.lane] += 55 * distFactor;
      } else if (ob.type === 'glacial_wall') {
        if (ob.lane === s.lane) wallAhead = true;
        laneScores[ob.lane] +=
          (s.chargeRatio > 0.35 || s.ramBoostTimer > 0 ? 70 : -45) * distFactor;
      }
    }

    let bestLane = s.lane;
    let bestVal = laneScores[s.lane];
    for (let l = 0; l < 3; l++) {
      if (laneScores[l] > bestVal + 8) {
        bestVal = laneScores[l];
        bestLane = l;
      }
    }
    s.aiTargetLane = bestLane;

    if ((wallAhead || s.chargeRatio > 0.15) && s.chargeRatio < 0.84) {
      s.aiShouldHold = true;
    } else {
      s.aiShouldHold = false;
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

    const seaGrad = ctx.createLinearGradient(0, 0, 0, height);
    seaGrad.addColorStop(0, pal.seaTop);
    seaGrad.addColorStop(1, pal.seaBottom);
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, width, height);

    const topY = 175;
    const bottomY = height - 125;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.25)';
    ctx.lineWidth = 2;
    for (let l = 1; l < 3; l++) {
      const ly = topY + ((bottomY - topY) / 3) * l;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(width, ly);
      ctx.stroke();
    }

    for (const ob of this.obstacles) {
      if (!ob.active) continue;
      const oy = this.getLaneY(ob.lane, height);
      ctx.save();
      ctx.translate(ob.x, oy);

      if (ob.type === 'sea_mine') {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let a = 0; a < 8; a++) {
          const ang = (a * Math.PI) / 4 + this.waveTime;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * 18, Math.sin(ang) * 18);
          ctx.lineTo(Math.cos(ang) * 25, Math.sin(ang) * 25);
          ctx.stroke();
        }
      } else {
        const isDiamond = ob.type === 'diamond_berg';
        const isWall = ob.type === 'glacial_wall';
        ctx.fillStyle = isWall ? '#bae6fd' : pal.iceFill;
        ctx.strokeStyle = isDiamond ? '#facc15' : pal.iceStroke;
        ctx.lineWidth = isWall ? 3.5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(-24, -22);
        ctx.lineTo(18, -26);
        ctx.lineTo(28, 0);
        ctx.lineTo(16, 24);
        ctx.lineTo(-22, 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (isDiamond) {
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.moveTo(0, -12);
          ctx.lineTo(12, 0);
          ctx.lineTo(0, 12);
          ctx.lineTo(-12, 0);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }

    this.ships.forEach((s) => {
      const p = this.getPlayer(s.id);
      if (!p) return;

      ctx.save();
      ctx.translate(s.x, s.ySmooth);

      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-36, -10);
      ctx.lineTo(-56, -18);
      ctx.moveTo(-36, 10);
      ctx.lineTo(-56, 18);
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-32, -16);
      ctx.lineTo(16, -16);
      ctx.lineTo(36, 0);
      ctx.lineTo(16, 16);
      ctx.lineTo(-32, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = s.ramBoostTimer > 0 ? '#facc15' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(14, -15);
      ctx.lineTo(38, 0);
      ctx.lineTo(14, 15);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const mood =
        s.stunTimer > 0
          ? 'shocked'
          : s.ramBoostTimer > 0 || s.combo >= 3
          ? 'triumph'
          : s.chargeRatio > 0.2
          ? 'focused'
          : 'idle';
      this.drawPlayerMascot(ctx, p.id, s.x - 6, s.ySmooth - 4, 16, mood, this.waveTime, 0);

      if (s.chargeRatio > 0.05) {
        const inSweet = s.chargeRatio >= 0.72 && s.chargeRatio <= 0.98;
        ctx.strokeStyle = inSweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = inSweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(s.x, s.ySmooth, 28, -Math.PI / 2, -Math.PI / 2 + s.chargeRatio * Math.PI * 2);
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
      '🚢 STEER / TAP: SWITCH CHANNEL • HOLD (72-98%): TURBINE RAM & BOW-WAVE SHUNT!',
      width / 2,
      70
    );

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const s = this.ships.get(p.id);
      if (!s) return;
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
      ctx.fillText(`${p.name}: ${Math.floor(s.score)}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${s.combo}x Ram ${s.underdog ? '• ⚡SURGE' : ''}`, cardX + 10, cardY + 28);
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
    return this.ships.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.ships.entries())
      .map(([playerId, s]) => ({ playerId, score: Math.floor(s.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${winnerId} pulverized the Arctic pack ice and claimed the Diamond Core!`
        : 'Arctic Icebreaker Showdown!',
    };
  }
}
