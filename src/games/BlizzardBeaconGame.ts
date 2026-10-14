import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type BeaconTheme = 'yukon_harbor' | 'cape_horn' | 'cyber_beacon';

interface ThemePalette {
  name: string;
  seaTop: string;
  seaBottom: string;
  pierFill: string;
  beamColor: string;
  accent: string;
}

const THEMES: Record<BeaconTheme, ThemePalette> = {
  yukon_harbor: {
    name: 'Yukon Whiteout Port',
    seaTop: '#06152d',
    seaBottom: '#0f2942',
    pierFill: '#1e293b',
    beamColor: 'rgba(250, 204, 21, 0.28)',
    accent: '#38bdf8',
  },
  cape_horn: {
    name: 'Cape Horn Storm',
    seaTop: '#041f1e',
    seaBottom: '#0f3d3e',
    pierFill: '#1e293b',
    beamColor: 'rgba(56, 189, 248, 0.28)',
    accent: '#2dd4bf',
  },
  cyber_beacon: {
    name: 'Neon Cryo Port',
    seaTop: '#0d041c',
    seaBottom: '#240b47',
    pierFill: '#1e1b4b',
    beamColor: 'rgba(244, 114, 182, 0.28)',
    accent: '#f472b6',
  },
};

const THEME_ORDER: BeaconTheme[] = ['yukon_harbor', 'cape_horn', 'cyber_beacon'];

interface KeeperTurret {
  id: PlayerId;
  x: number;
  vx: number;
  dir: number;
  beamAngle: number;
  furnaceHeat: number;
  chargeRatio: number;
  flareTimer: number;
  stunTimer: number;
  score: number;
  combo: number;
  underdog: boolean;
  aiReactTimer: number;
  aiTargetX: number;
  aiShouldHold: boolean;
}

interface HarborVessel {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'expedition_ship' | 'golden_flagship' | 'rogue_iceberg';
  rescueProgress: number;
  active: boolean;
}

interface SnowParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export class BlizzardBeaconGame extends BaseGame {
  private keepers: Map<PlayerId, KeeperTurret> = new Map();
  private vessels: HarborVessel[] = [];
  private snow: SnowParticle[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextVesselId: number = 1;
  private spawnTimer: number = 0.85;
  private galeTimer: number = 3.5;
  private galeDir: number = 1;
  private animTime: number = 0;
  private theme: BeaconTheme = 'yukon_harbor';
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
          this.theme = 'yukon_harbor';
          this.audio.playTap();
        } else if (e.key === '2') {
          this.theme = 'cape_horn';
          this.audio.playTap();
        } else if (e.key === '3') {
          this.theme = 'cyber_beacon';
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

  private spawnVessel(width: number): void {
    const activeCount = this.vessels.filter((v) => v.active).length;
    if (activeCount >= 6) return;
    const roll = Math.random();
    const type: HarborVessel['type'] =
      roll < 0.25 ? 'golden_flagship' : roll < 0.78 ? 'expedition_ship' : 'rogue_iceberg';
    this.vessels.push({
      id: this.nextVesselId++,
      x: 120 + Math.random() * (width - 240),
      y: 95 + Math.random() * 65,
      vx: (Math.random() - 0.5) * 95,
      vy: 28 + Math.random() * 24,
      type,
      rescueProgress: 0,
      active: true,
    });
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.keepers.clear();
    this.vessels = [];
    this.snow = [];
    this.floatingTexts = [];
    this.suddenDeath = false;
    this.screenShake = 0;

    const active = this.getActivePlayers();
    const count = Math.max(active.length, 1);
    active.forEach((p, i) => {
      const startX = 180 + ((width - 360) * (i + 0.5)) / count;
      this.keepers.set(p.id, {
        id: p.id,
        x: startX,
        vx: 0,
        dir: i % 2 === 0 ? 1 : -1,
        beamAngle: -Math.PI / 2,
        furnaceHeat: 85,
        chargeRatio: 0,
        flareTimer: 0,
        stunTimer: 0,
        score: 0,
        combo: 1,
        underdog: false,
        aiReactTimer: 0.2,
        aiTargetX: startX,
        aiShouldHold: false,
      });
    });

    for (let i = 0; i < 65; i++) {
      this.snow.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 110 + Math.random() * 90,
        vy: 60 + Math.random() * 70,
        r: 1.5 + Math.random() * 2.5,
      });
    }

    for (let i = 0; i < 3; i++) {
      this.spawnVessel(width);
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    const clampedDt = Math.min(dt, 0.05);
    this.animTime += clampedDt;
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
      this.addFloatingText(width / 2, 108, 'WHITEOUT MAYDAY! 2X SHIP RESCUES!', '#facc15');
    }

    let maxScore = 0;
    this.keepers.forEach((k) => {
      if (k.score > maxScore) maxScore = k.score;
    });
    this.keepers.forEach((k) => {
      k.underdog = maxScore - k.score >= 110;
    });

    this.galeTimer -= clampedDt;
    if (this.galeTimer <= 0) {
      this.galeTimer = 4.2 + Math.random() * 2.0;
      this.galeDir *= -1;
      this.audio.playWhoosh();
    }

    for (const s of this.snow) {
      s.x += s.vx * this.galeDir * clampedDt;
      s.y += s.vy * clampedDt;
      if (s.x > width) s.x -= width;
      if (s.x < 0) s.x += width;
      if (s.y > height) s.y -= height;
    }

    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (this.suddenDeath ? 0.65 : 1.05) + Math.random() * 0.35;
      this.spawnVessel(width);
    }

    const pierY = height - 155;
    this.updateBots(clampedDt, width, height);

    this.keepers.forEach((k) => {
      const p = this.getPlayer(k.id);
      if (!p) return;

      if (k.flareTimer > 0) k.flareTimer = Math.max(0, k.flareTimer - clampedDt);
      k.furnaceHeat = Math.max(25, k.furnaceHeat - clampedDt * 4.5);

      if (k.stunTimer > 0) {
        k.stunTimer = Math.max(0, k.stunTimer - clampedDt);
        k.chargeRatio = 0;
        k.vx *= Math.pow(0.08, clampedDt);
        k.x = Math.max(110, Math.min(width - 110, k.x + k.vx * clampedDt));
        return;
      }

      const speedMult = (k.underdog ? 1.18 : 1.0) * (k.flareTimer > 0 ? 1.25 : 1.0);
      let steer = 0;
      let holdAction = false;
      let releaseAction = false;

      if (!p.type.startsWith('bot_')) {
        steer = this.input.getSteer(p.id);
        if (this.input.justPressed(p.id)) {
          k.dir *= -1;
          k.vx = k.dir * 240 * speedMult;
          k.furnaceHeat = Math.min(100, k.furnaceHeat + 18);
          this.audio.playTap();
        }
        holdAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
        releaseAction = this.input.justReleased(p.id);
      } else {
        const dx = k.aiTargetX - k.x;
        if (Math.abs(dx) > 14) {
          steer = Math.sign(dx);
        }
        holdAction = k.aiShouldHold;
        if (!holdAction && k.chargeRatio >= 0.76) {
          releaseAction = true;
        }
      }

      if (Math.abs(steer) > 0.1) {
        k.dir = Math.sign(steer);
        k.vx += steer * 680 * speedMult * clampedDt;
      } else {
        k.vx += k.dir * 260 * speedMult * clampedDt;
      }

      const maxVx = (holdAction ? 190 : 295) * speedMult;
      k.vx = Math.max(-maxVx, Math.min(maxVx, k.vx));
      k.vx *= Math.pow(0.18, clampedDt);
      k.x += k.vx * clampedDt;

      if (k.x < 110) {
        k.x = 110;
        k.dir = 1;
        k.vx = Math.abs(k.vx) * 0.65;
      } else if (k.x > width - 110) {
        k.x = width - 110;
        k.dir = -1;
        k.vx = -Math.abs(k.vx) * 0.65;
      }

      const targetAngle = -Math.PI / 2 + (k.vx / 320) * 0.32;
      k.beamAngle += (targetAngle - k.beamAngle) * Math.min(1, clampedDt * 10);

      if (holdAction) {
        k.chargeRatio = Math.min(1, k.chargeRatio + clampedDt * 0.82);
        k.furnaceHeat = Math.min(100, k.furnaceHeat + clampedDt * 28);
        if (k.chargeRatio >= 1.0) {
          k.stunTimer = 0.8;
          k.chargeRatio = 0;
          k.combo = 1;
          this.audio.playStun();
          this.particles.spawnExplosion(k.x, pierY, '#ef4444', 16);
          this.addFloatingText(k.x, pierY - 34, 'LENS OVERHEAT!', '#ef4444');
        }
      } else {
        if (releaseAction && k.chargeRatio >= 0.72 && k.chargeRatio <= 0.98) {
          this.fireFoghornFlare(k, p.color, pierY);
        }
        k.chargeRatio = Math.max(0, k.chargeRatio - clampedDt * 2.2);
      }
    });

    // Elastic Keeper-to-Keeper Collisions
    const list = Array.from(this.keepers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const minDist = 48;
        if (Math.abs(dx) < minDist) {
          const sign = dx >= 0 ? 1 : -1;
          const overlap = minDist - Math.abs(dx);
          a.x -= sign * overlap * 0.5;
          b.x += sign * overlap * 0.5;

          const va = a.vx;
          const vb = b.vx;
          a.vx = vb * (b.underdog ? 1.35 : 1.1) - sign * 150;
          b.vx = va * (a.underdog ? 1.35 : 1.1) + sign * 150;
          a.dir = Math.sign(a.vx) || -1;
          b.dir = Math.sign(b.vx) || 1;

          this.audio.playBounce();
          this.triggerScreenShake(5);
          this.particles.spawnSparks((a.x + b.x) * 0.5, pierY, '#facc15', 12);
        }
      }
    }

    // Update Harbor Vessels
    for (let i = this.vessels.length - 1; i >= 0; i--) {
      const v = this.vessels[i];
      if (!v.active) {
        this.vessels.splice(i, 1);
        continue;
      }

      v.x += (v.vx + this.galeDir * 18) * clampedDt;
      v.y += v.vy * clampedDt;
      if (v.x < 100 || v.x > width - 100) {
        v.vx *= -1;
        v.x = Math.max(100, Math.min(width - 100, v.x));
      }

      this.keepers.forEach((k) => {
        if (!v.active || k.stunTimer > 0) return;
        const p = this.getPlayer(k.id);
        if (!p) return;

        const dx = v.x - k.x;
        const dy = v.y - pierY;
        const dist = Math.hypot(dx, dy);
        const angToVessel = Math.atan2(dy, dx);
        const angDiff = Math.abs(angToVessel - k.beamAngle);
        const coneHalf = k.flareTimer > 0 ? 0.36 : 0.24;

        if (dist < 420 && angDiff <= coneHalf) {
          const beamPower =
            (k.flareTimer > 0 ? 1.55 : 1.0) * (0.7 + 0.3 * (k.furnaceHeat / 100));
          v.rescueProgress += clampedDt * 0.95 * beamPower;

          if (v.rescueProgress >= 1.0) {
            v.active = false;
            const mult = this.suddenDeath ? 2 : 1;
            if (v.type === 'rogue_iceberg') {
              const pts = 30 * mult;
              k.score += pts;
              this.audio.playBounce();
              this.particles.spawnExplosion(v.x, v.y, '#38bdf8', 18);
              this.addFloatingText(v.x, v.y - 24, `+${pts} ICEBERG CHARTS!`, '#38bdf8');
            } else {
              const isGold = v.type === 'golden_flagship';
              const pts = ((isGold ? 60 : 35) + k.combo * 5) * mult;
              k.score += pts;
              k.combo = Math.min(6, k.combo + 1);
              k.furnaceHeat = Math.min(100, k.furnaceHeat + 25);
              this.audio.playScore();
              this.triggerScreenShake(isGold ? 7 : 4);
              this.particles.spawnExplosion(v.x, v.y, isGold ? '#facc15' : '#4ade80', 22);
              this.addFloatingText(
                v.x,
                v.y - 28,
                `+${pts} ${isGold ? 'POLAR FLAGSHIP SAVED!' : 'SHIP GUIDED!'} (${k.combo}x)`,
                isGold ? '#facc15' : p.color
              );
            }
          }
        }
      });

      if (v.active && v.y >= pierY - 26) {
        v.active = false;
        if (v.type === 'rogue_iceberg') {
          this.keepers.forEach((k) => {
            if (Math.abs(k.x - v.x) < 65) {
              k.score = Math.max(0, k.score - 15);
              k.stunTimer = 0.85;
              k.combo = 1;
              this.audio.playExplosion();
              this.triggerScreenShake(8);
              this.particles.spawnExplosion(v.x, pierY - 16, '#ef4444', 20);
              this.addFloatingText(k.x, pierY - 38, 'ICEBERG IMPACT! -15', '#ef4444');
            }
          });
        }
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.95;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private fireFoghornFlare(k: KeeperTurret, color: string, pierY: number): void {
    const mult = this.suddenDeath ? 2 : 1;
    const bonus = 45 * mult;
    k.score += bonus;
    k.flareTimer = 2.6;
    k.furnaceHeat = 100;
    this.audio.playScore();
    this.triggerScreenShake(9);
    this.particles.spawnExplosion(k.x, pierY - 18, '#facc15', 24);
    this.addFloatingText(k.x, pierY - 44, `+${bonus} SOLAR FOGHORN FLARE!`, '#facc15');

    this.keepers.forEach((other) => {
      if (other.id === k.id) return;
      const dx = other.x - k.x;
      if (Math.abs(dx) < 175) {
        const pushSign = dx >= 0 ? 1 : -1;
        other.vx = pushSign * 310;
        other.stunTimer = Math.max(other.stunTimer, 0.75);
        const shuntPts = 45 * mult;
        k.score += shuntPts;
        this.audio.playExplosion();
        this.particles.spawnExplosion(other.x, pierY - 12, color, 20);
        this.addFloatingText(other.x, pierY - 36, `+${shuntPts} FOGHORN GALE SHUNT!`, color);
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
    const k = this.keepers.get(botId);
    if (!k) return;

    k.aiReactTimer -= dt;
    if (k.aiReactTimer > 0) return;

    const reactDelay =
      difficulty === 'bot_hard' ? 0.11 : difficulty === 'bot_normal' ? 0.23 : 0.41;
    const blunderRate =
      difficulty === 'bot_hard' ? 0.02 : difficulty === 'bot_normal' ? 0.12 : 0.22;
    k.aiReactTimer = reactDelay + Math.random() * 0.05;

    if (Math.random() < blunderRate) {
      k.aiShouldHold = false;
      return;
    }

    let bestVessel: HarborVessel | null = null;
    let bestScore = -999;
    for (const v of this.vessels) {
      if (!v.active) continue;
      const val =
        (v.type === 'golden_flagship' ? 140 : v.type === 'expedition_ship' ? 90 : 50) +
        v.rescueProgress * 80 -
        Math.abs(v.x - k.x) * 0.25;
      if (val > bestScore) {
        bestScore = val;
        bestVessel = v;
      }
    }

    if (bestVessel) {
      k.aiTargetX = bestVessel.x;
    }

    let rivalClose = false;
    this.keepers.forEach((other) => {
      if (other.id !== k.id && Math.abs(other.x - k.x) < 150) {
        rivalClose = true;
      }
    });

    if ((rivalClose || k.furnaceHeat < 55 || k.chargeRatio > 0.15) && k.chargeRatio < 0.84) {
      k.aiShouldHold = true;
    } else {
      k.aiShouldHold = false;
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

    const pierY = height - 155;

    this.keepers.forEach((k) => {
      if (k.stunTimer > 0) return;
      const p = this.getPlayer(k.id);
      if (!p) return;

      const coneHalf = k.flareTimer > 0 ? 0.36 : 0.24;
      const beamLen = 420;
      ctx.save();
      ctx.translate(k.x, pierY - 12);
      ctx.rotate(k.beamAngle);

      const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, beamLen);
      grad.addColorStop(0, k.flareTimer > 0 ? 'rgba(250, 204, 21, 0.55)' : pal.beamColor);
      grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, beamLen, -coneHalf, coneHalf);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(-coneHalf) * beamLen, Math.sin(-coneHalf) * beamLen);
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(coneHalf) * beamLen, Math.sin(coneHalf) * beamLen);
      ctx.stroke();
      ctx.restore();
    });

    for (const v of this.vessels) {
      if (!v.active) continue;
      ctx.save();
      ctx.translate(v.x, v.y);

      if (v.type === 'rogue_iceberg') {
        ctx.fillStyle = '#bae6fd';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-22, 12);
        ctx.lineTo(-10, -18);
        ctx.lineTo(6, -12);
        ctx.lineTo(22, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        const isGold = v.type === 'golden_flagship';
        ctx.fillStyle = isGold ? '#facc15' : '#e2e8f0';
        ctx.strokeStyle = isGold ? '#ca8a04' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-26, -4);
        ctx.lineTo(26, -4);
        ctx.lineTo(18, 12);
        ctx.lineTo(-18, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-10, -14, 20, 10);
        ctx.fillStyle = isGold ? '#fef08a' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, -19, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (v.rescueProgress > 0.02) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-22, 16, 44, 6);
        ctx.fillStyle = v.type === 'golden_flagship' ? '#facc15' : '#4ade80';
        ctx.fillRect(-21, 17, 42 * Math.min(1, v.rescueProgress), 4);
      }
      ctx.restore();
    }

    ctx.fillStyle = pal.pierFill;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2.5;
    ctx.fillRect(75, pierY, width - 150, 32);
    ctx.strokeRect(75, pierY, width - 150, 32);

    this.keepers.forEach((k) => {
      const p = this.getPlayer(k.id);
      if (!p) return;

      ctx.save();
      ctx.translate(k.x, pierY);

      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-20, -14, 40, 26, 6);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.translate(0, -14);
      ctx.rotate(k.beamAngle + Math.PI / 2);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-9, -16, 18, 14);
      ctx.restore();
      ctx.restore();

      const mood =
        k.stunTimer > 0
          ? 'shocked'
          : k.flareTimer > 0 || k.combo >= 3
          ? 'triumph'
          : k.chargeRatio > 0.2
          ? 'focused'
          : 'idle';
      this.drawPlayerMascot(ctx, p.id, k.x, pierY + 2, 17, mood, this.animTime, k.vx * 0.001);

      if (k.chargeRatio > 0.05) {
        const inSweet = k.chargeRatio >= 0.72 && k.chargeRatio <= 0.98;
        ctx.strokeStyle = inSweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = inSweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(k.x, pierY, 27, -Math.PI / 2, -Math.PI / 2 + k.chargeRatio * Math.PI * 2);
        ctx.stroke();
      }
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    for (const s of this.snow) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

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
      '🚨 STEER / TAP: SWEEP BEACON & GUIDE SHIPS • HOLD (72-98%): FOGHORN GALE SHUNT!',
      width / 2,
      70
    );

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const k = this.keepers.get(p.id);
      if (!k) return;
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
      ctx.fillText(`${p.name}: ${Math.floor(k.score)}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`Lamp: ${Math.floor(k.furnaceHeat)}% • ${k.combo}x`, cardX + 10, cardY + 28);
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
    return this.keepers.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.keepers.entries())
      .map(([playerId, k]) => ({ playerId, score: Math.floor(k.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${winnerId} guided the stranded Polar Expedition through the whiteout blizzard!`
        : 'Blizzard Beacon Showdown!',
    };
  }
}
