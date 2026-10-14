import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'victorian_london' | 'crimson_cloudsea' | 'storm_citadel';

interface ThemePalette {
  id: ThemeId;
  name: string;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  cloudColor: string;
  brassTrim: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'victorian_london',
    name: 'Victorian London Dusk',
    skyTop: '#161426',
    skyMid: '#31263e',
    skyBot: '#583b4c',
    cloudColor: 'rgba(254, 240, 138, 0.12)',
    brassTrim: '#f59e0b',
    accent: '#facc15',
  },
  {
    id: 'crimson_cloudsea',
    name: 'Crimson Armada Sunset',
    skyTop: '#2a0a18',
    skyMid: '#5b1929',
    skyBot: '#9a3412',
    cloudColor: 'rgba(251, 146, 60, 0.16)',
    brassTrim: '#fbbf24',
    accent: '#fb923c',
  },
  {
    id: 'storm_citadel',
    name: 'Thunderhead Sky Citadel',
    skyTop: '#090d16',
    skyMid: '#1e293b',
    skyBot: '#334155',
    cloudColor: 'rgba(56, 189, 248, 0.14)',
    brassTrim: '#38bdf8',
    accent: '#38bdf8',
  },
];

interface Cannonball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: PlayerId;
  life: number;
  isFlak: boolean;
}

interface SkyPickup {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'crate' | 'bullion' | 'medallion' | 'mine';
  value: number;
  pulse: number;
}

interface Zeppelin {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  score: number;
  fireCooldown: number;
  propAnim: number;
  charging: boolean;
  charge: number;
  ramTimer: number;
  deflateTimer: number;
  underdog: boolean;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  color: string;
}

export class ZeppelinDogfightGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public zeppelins: Map<PlayerId, Zeppelin> = new Map();
  public cannonballs: Cannonball[] = [];
  private pickups: SkyPickup[] = [];
  private shockwaves: Shockwave[] = [];
  private nextPickupId = 1;
  private pickupTimer = 1.6;
  private themeIndex = 0;
  private suddenDeath = false;
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
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIndex = (this.themeIndex + 1) % THEMES.length;
          this.audio.playTap();
        } else if (e.key === '1') {
          this.themeIndex = 0;
          this.audio.playTap();
        } else if (e.key === '2') {
          this.themeIndex = 1;
          this.audio.playTap();
        } else if (e.key === '3') {
          this.themeIndex = 2;
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.suddenDeath = false;
    this.zeppelins.clear();
    this.cannonballs = [];
    this.pickups = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.pickupTimer = 1.4;

    const active = this.getActivePlayers();
    const spawns = [
      { x: width * 0.24, y: height * 0.42, angle: 0 },
      { x: width * 0.76, y: height * 0.42, angle: Math.PI },
      { x: width * 0.24, y: height * 0.68, angle: 0 },
      { x: width * 0.76, y: height * 0.68, angle: Math.PI },
    ];

    active.forEach((p, idx) => {
      const sp = spawns[idx % spawns.length];
      this.zeppelins.set(p.id, {
        id: p.id,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        angle: sp.angle,
        hp: 100,
        score: 0,
        fireCooldown: 0,
        propAnim: 0,
        charging: false,
        charge: 0,
        ramTimer: 0,
        deflateTimer: 0,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.15,
        botTargetX: width * 0.5,
        botTargetY: height * 0.5,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnSkyPickup(width, height);
    }
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  private spawnSkyPickup(width: number, height: number, x?: number, y?: number, forcedKind?: 'crate' | 'bullion' | 'medallion' | 'mine'): void {
    if (this.pickups.length >= 13) return;
    const roll = Math.random();
    const kind = forcedKind ?? (roll < 0.22 ? 'mine' : roll < 0.44 ? 'medallion' : roll < 0.72 ? 'bullion' : 'crate');
    const px = x ?? (90 + Math.random() * (width - 180));
    const py = y ?? (115 + Math.random() * (height - 210));
    const value = kind === 'medallion' ? 90 : kind === 'bullion' ? 50 : kind === 'crate' ? 45 : -30;
    this.pickups.push({
      id: this.nextPickupId++,
      x: px,
      y: py,
      vx: (Math.random() - 0.5) * 35,
      vy: (Math.random() - 0.5) * 25,
      kind,
      value,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    if (!this.suddenDeath && this.roundTimer <= 15.0) {
      this.suddenDeath = true;
      this.audio.playFanfare();
      this.addScreenShake(8);
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: ROYAL ARMADA 2X GOLD! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.zeppelins.forEach(z => {
      if (z.score > maxScore) maxScore = z.score;
    });
    this.zeppelins.forEach(z => {
      z.underdog = maxScore - z.score >= 150;
    });

    this.updateBots(dt, width, height);

    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      this.pickupTimer = this.suddenDeath ? 1.15 : 1.85;
      this.spawnSkyPickup(width, height);
    }

    for (const p of this.pickups) {
      p.pulse += dt * 4.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 70 || p.x > width - 70) p.vx *= -1;
      if (p.y < 105 || p.y > height - 75) p.vy *= -1;
    }

    // Update Zeppelins
    this.zeppelins.forEach(z => {
      z.propAnim += dt * (z.ramTimer > 0 ? 35 : 16);
      if (z.fireCooldown > 0) z.fireCooldown = Math.max(0, z.fireCooldown - dt);
      if (z.ramTimer > 0) z.ramTimer = Math.max(0, z.ramTimer - dt);

      if (z.deflateTimer > 0) {
        z.deflateTimer -= dt;
        z.angle += dt * 7;
        z.vx *= 0.92;
        z.vy *= 0.92;
        z.x += z.vx * dt;
        z.y += z.vy * dt;
        this.clampZeppelin(z, width, height);
        if (z.deflateTimer <= 0) {
          z.hp = 100;
          this.addFloatingText(z.x, z.y - 26, '🔧 GASBAG REPAIRED!', '#38bdf8', 15);
        }
        return;
      }

      const move = { x: this.input.getSteer(z.id), y: -this.input.getThrottle(z.id) };
      const speedMult = (z.underdog ? 1.24 : 1.0) * (z.ramTimer > 0 ? 1.85 : 1.0) * (z.charging ? 0.75 : 1.0);
      const accel = 820 * speedMult;

      if (Math.abs(move.x) > 0.05 || Math.abs(move.y) > 0.05) {
        const len = Math.hypot(move.x, move.y) || 1;
        const nx = move.x / len;
        const ny = move.y / len;
        z.angle = Math.atan2(ny, nx);
        z.vx += nx * accel * dt;
        z.vy += ny * accel * dt;
      }

      z.vx *= 0.88;
      z.vy *= 0.88;
      z.x += z.vx * dt;
      z.y += z.vy * dt;
      this.clampZeppelin(z, width, height);

      // Tap to fire broadside + bow steam cannon volley
      if ((this.input.justPressed(z.id) || this.input.justAction(z.id)) && z.fireCooldown <= 0) {
        this.fireVolley(z, false);
      }

      // Hold-to-charge Ironclad Prow Ram (72%–98% Sweet Spot)
      const holding = this.input.isActionPressed(z.id) || this.input.isPressed(z.id);
      if (holding) {
        z.charging = true;
        z.charge += dt * 0.84;
        if (z.charge >= 1.0) {
          z.charging = false;
          z.charge = 0;
          z.deflateTimer = 0.7;
          this.audio.playBuzzer();
          this.particles.emit(z.x, z.y, 14, '#ef4444');
          this.addFloatingText(z.x, z.y - 28, '⚠️ BOILER STALL!', '#ef4444', 15);
        }
      } else if (z.charging) {
        const pct = z.charge;
        z.charging = false;
        z.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          z.ramTimer = 1.25;
          z.vx += Math.cos(z.angle) * 440;
          z.vy += Math.sin(z.angle) * 440;
          const bonus = this.suddenDeath ? 150 : 80;
          z.score += bonus;
          this.fireVolley(z, true);
          this.audio.playBoost();
          this.addScreenShake(7);
          this.shockwaves.push({
            x: z.x,
            y: z.y,
            r: 20,
            maxR: 135,
            alpha: 1,
            color: '#facc15',
          });
          this.addFloatingText(z.x, z.y - 34, `🚀 IRONCLAD PROW RAM! +${bonus}`, '#facc15', 18);
        } else if (pct >= 0.25) {
          z.vx += Math.cos(z.angle) * 240;
          z.vy += Math.sin(z.angle) * 240;
          this.audio.playWhoosh();
        }
      }

      // Check sky pickups & mines
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        if (Math.hypot(p.x - z.x, p.y - z.y) < 34) {
          if (p.kind === 'mine') {
            if (z.ramTimer > 0 || z.underdog) {
              z.score += 55;
              this.audio.playExplosion();
              this.particles.emit(p.x, p.y, 18, '#facc15');
              this.addFloatingText(p.x, p.y - 24, '🛡️ MINE CLEARED! +55', '#38bdf8', 16);
            } else {
              z.hp = Math.max(20, z.hp - 35);
              z.deflateTimer = 0.85;
              z.score = Math.max(0, z.score - 25);
              this.audio.playExplosion();
              this.addScreenShake(8);
              this.particles.emit(p.x, p.y, 22, '#ef4444');
              this.addFloatingText(p.x, p.y - 24, '💥 SKY MINE! -25', '#ef4444', 16);
            }
          } else {
            const pts = Math.round(p.value * (this.suddenDeath ? 2 : 1));
            z.score += pts;
            if (p.kind === 'crate') z.hp = Math.min(100, z.hp + 30);
            this.audio.playScore();
            const col = p.kind === 'medallion' ? '#facc15' : p.kind === 'bullion' ? '#fde047' : '#4ade80';
            const label = p.kind === 'medallion' ? `👑 AIR MEDALLION! +${pts}` : p.kind === 'bullion' ? `💰 SKY BULLION! +${pts}` : `📦 REPAIR CRATE! +${pts}`;
            this.particles.emit(p.x, p.y, 12, col);
            this.addFloatingText(p.x, p.y - 22, label, col, 16);
          }
          this.pickups.splice(i, 1);
        }
      }
    });

    // Zeppelin-to-Zeppelin Sky-Galleon Ram collisions
    const list = Array.from(this.zeppelins.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 48;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          const impulse = 250;
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
          b.vx += nx * impulse;
          b.vy += ny * impulse;
          this.audio.playBounce();

          if (a.ramTimer > 0 && b.ramTimer <= 0) {
            a.score += 75;
            b.deflateTimer = 0.85;
            b.vx += nx * 240;
            b.vy += ny * 240;
            this.addScreenShake(8);
            this.addFloatingText(b.x, b.y - 30, '⚓ SKY-GALLEON RAM! +75', '#facc15', 18);
          } else if (b.ramTimer > 0 && a.ramTimer <= 0) {
            b.score += 75;
            a.deflateTimer = 0.85;
            a.vx -= nx * 240;
            a.vy -= ny * 240;
            this.addScreenShake(8);
            this.addFloatingText(a.x, a.y - 30, '⚓ SKY-GALLEON RAM! +75', '#facc15', 18);
          }
        }
      }
    }

    // Update Cannonballs
    for (let i = this.cannonballs.length - 1; i >= 0; i--) {
      const b = this.cannonballs[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      let hit = false;
      this.zeppelins.forEach(target => {
        if (target.id === b.ownerId || target.deflateTimer > 0) return;
        if (Math.hypot(target.x - b.x, target.y - b.y) < 30) {
          hit = true;
          target.hp -= 34;
          target.vx += b.vx * 0.35;
          target.vy += b.vy * 0.35;
          this.audio.playBounce();
          this.particles.emit(b.x, b.y, 12, '#fb923c');

          const shooter = this.zeppelins.get(b.ownerId);
          if (shooter) {
            const hitPts = this.suddenDeath ? 90 : 45;
            shooter.score += hitPts;
            this.addFloatingText(target.x, target.y - 24, `🎯 BROADSIDE HIT! +${hitPts}`, '#facc15', 16);
          }

          if (target.hp <= 0) {
            target.hp = 0;
            target.deflateTimer = 1.5;
            this.audio.playExplosion();
            this.addScreenShake(9);
            this.particles.emit(target.x, target.y, 26, '#ef4444');
            if (shooter) {
              shooter.score += 95;
              this.addFloatingText(target.x, target.y - 42, '💥 AIRSHIP TAKEDOWN! +95', '#facc15', 19);
            }
            this.spawnSkyPickup(width, height, target.x - 24, target.y, 'bullion');
            this.spawnSkyPickup(width, height, target.x + 24, target.y, 'bullion');
          }
        }
      });

      if (hit || b.life <= 0 || b.x < 20 || b.x > width - 20 || b.y < 70 || b.y > height - 20) {
        this.cannonballs.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.r += (s.maxR - s.r) * dt * 7;
      s.alpha -= dt * 1.9;
      if (s.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 0.95;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private clampZeppelin(z: Zeppelin, width: number, height: number): void {
    const padX = 58;
    const minY = 98;
    const maxY = height - 66;
    if (z.x < padX) { z.x = padX; z.vx = Math.abs(z.vx) * 0.5; }
    if (z.x > width - padX) { z.x = width - padX; z.vx = -Math.abs(z.vx) * 0.5; }
    if (z.y < minY) { z.y = minY; z.vy = Math.abs(z.vy) * 0.5; }
    if (z.y > maxY) { z.y = maxY; z.vy = -Math.abs(z.vy) * 0.5; }
  }

  private fireVolley(z: Zeppelin, isFlak: boolean): void {
    z.fireCooldown = isFlak ? 0.35 : 0.48;
    const angles = isFlak ? [z.angle - 0.25, z.angle, z.angle + 0.25] : [z.angle];
    const speed = 390;
    for (const a of angles) {
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      this.cannonballs.push({
        x: z.x + nx * 32,
        y: z.y + ny * 32,
        vx: nx * speed + z.vx * 0.35,
        vy: ny * speed + z.vy * 0.35,
        ownerId: z.id,
        life: 1.8,
        isFlak,
      });
    }
    this.audio.playTap();
    this.particles.emit(z.x + Math.cos(z.angle) * 32, z.y + Math.sin(z.angle) * 32, 6, '#fde047');
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const z = this.zeppelins.get(botId);
    if (!z || z.deflateTimer > 0) return;

    z.botTimer -= dt;
    if (z.botTimer <= 0) {
      z.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      // Pick best collectible or rival target
      let bestX = width * 0.5;
      let bestY = height * 0.5;
      let bestVal = -999;

      for (const p of this.pickups) {
        if (p.kind === 'mine') continue;
        const d = Math.hypot(p.x - z.x, p.y - z.y);
        const val = p.value * 1.4 - d * 0.25;
        if (val > bestVal) {
          bestVal = val;
          bestX = p.x;
          bestY = p.y;
        }
      }

      this.zeppelins.forEach(other => {
        if (other.id === botId || other.deflateTimer > 0) return;
        const d = Math.hypot(other.x - z.x, other.y - z.y);
        const val = 95 - d * 0.2;
        if (val > bestVal) {
          bestVal = val;
          bestX = other.x;
          bestY = other.y;
        }
      });

      z.botTargetX = bestX;
      z.botTargetY = bestY;

      if (!z.charging && Math.random() < (difficulty === 'bot_hard' ? 0.28 : 0.14)) {
        z.botHoldTarget = difficulty === 'bot_hard' ? 0.84 : 0.78;
      }
    }

    const dx = z.botTargetX - z.x;
    const dy = z.botTargetY - z.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 8 ? dx / dist : 0;
    const throttleY = dist > 8 ? -dy / dist : 0;
    const actor: any = (this as any).engineers?.get(botId) || (this as any).zeppelins?.get(botId) || (this as any).harvesters?.get(botId) || (this as any).toymakers?.get(botId) || (this as any).dispatchers?.get(botId) || (this as any).flyers?.get(botId);
    if (actor) {
      actor.vx += steerX * 620 * dt;
      actor.vy += -throttleY * 620 * dt;
      if (typeof actor.angle === 'number' && (Math.abs(steerX) > 0.01 || Math.abs(throttleY) > 0.01)) actor.angle = Math.atan2(-throttleY, steerX);
    }

    if (z.botHoldTarget > 0) {
      if (z.charge < z.botHoldTarget) {
        this.input.setBotState(botId, true);
      } else {
        z.botHoldTarget = 0;
        this.input.setBotState(botId, false);
      }
    } else {
      this.input.setBotState(botId, false);
      if (z.fireCooldown <= 0 && Math.random() < (difficulty === 'bot_hard' ? 0.45 : 0.22)) {
        this.input.triggerBotPress(botId);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    // Sky Backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.skyTop);
    bg.addColorStop(0.55, theme.skyMid);
    bg.addColorStop(1, theme.skyBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Cloud banks & silhouetted Big Ben clocktower
    ctx.save();
    ctx.fillStyle = theme.cloudColor;
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 190 + this.roundTimer * 18) % (width + 160)) - 80;
      const cy = 140 + (i % 3) * 115;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 85, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(width * 0.12, height - 85, 36, 85);
    ctx.beginPath();
    ctx.moveTo(width * 0.12 - 4, height - 85);
    ctx.lineTo(width * 0.12 + 18, height - 130);
    ctx.lineTo(width * 0.12 + 40, height - 85);
    ctx.fill();
    ctx.restore();

    // Shockwaves
    for (const s of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Pickups & Barrage Mines
    for (const p of this.pickups) {
      const bob = Math.sin(p.pulse) * 4;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      if (p.kind === 'mine') {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'medallion') {
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'bullion') {
        ctx.fillStyle = '#eab308';
        ctx.fillRect(-11, -7, 22, 14);
      } else {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(-10, -10, 20, 20);
      }
      ctx.restore();
    }

    // Cannonballs
    for (const b of this.cannonballs) {
      ctx.save();
      ctx.fillStyle = b.isFlak ? '#38bdf8' : '#fde047';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.isFlak ? 6 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render 2.5D Armored Steam Dirigibles
    this.zeppelins.forEach(z => {
      const cfg = this.players.find(p => p.id === z.id);
      const color = cfg?.color || '#38bdf8';

      ctx.save();
      ctx.translate(z.x, z.y);

      // Charge ring
      if (z.charging) {
        const sweet = z.charge >= 0.72 && z.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 38, -Math.PI * 0.5, -Math.PI * 0.5 + z.charge * Math.PI * 2);
        ctx.stroke();
      }

      if (z.ramTimer > 0 || z.underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Underslung Gondola with Mascot Sky-Captain
      const mood = z.deflateTimer > 0 ? 'shocked' : z.charging ? 'focused' : z.ramTimer > 0 ? 'triumph' : 'idle';
      this.drawPlayerMascot(ctx, cfg?.id || 1, 0, 14, 15, mood === 'focused' ? 'focused' : mood === 'shocked' ? 'shocked' : 'happy', 45 - this.roundTimer, 0);

      ctx.save();
      ctx.rotate(z.angle);
      // 2.5D Ribbed Envelope Gasbag
      ctx.fillStyle = z.deflateTimer > 0 ? '#475569' : color;
      ctx.strokeStyle = theme.brassTrim;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, -4, 30, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Armored Ironclad Ramming Prow
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(26, -11);
      ctx.lineTo(38, -4);
      ctx.lineTo(26, 3);
      ctx.closePath();
      ctx.fill();

      // Rear Spinning Brass Propeller
      const blade = Math.sin(z.propAnim) * 9;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-32, -4 - blade);
      ctx.lineTo(-32, -4 + blade);
      ctx.stroke();
      ctx.restore();

      // Hull integrity bar
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(-22, -30, 44, 5);
      ctx.fillStyle = z.hp > 40 ? '#4ade80' : '#ef4444';
      ctx.fillRect(-22, -30, 44 * (z.hp / 100), 5);

      ctx.restore();
    });

    this.renderFloatingTexts(ctx);

    // Top Header Banner (Respecting top-center timer safe zone y: 12-44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 54, 520, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: PILOT DIRIGIBLE 360° • TAP: BROADSIDE VOLLEY • HOLD (72-98%): IRONCLAD PROW RAM', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const z = this.zeppelins.get(p.id);
      if (!z) return;
      const isLeft = idx % 2 === 0;
      const cardX = isLeft ? 18 : width - 148;
      const cardY = height - 128 - Math.floor(idx / 2) * 56;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = '800 12px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '900 15px "Outfit", sans-serif';
      ctx.fillText(`${z.score} PTS`, cardX + 10, cardY + 38);
      ctx.restore();
    });

    // Bottom-Left Theme Pill
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🎨 ${theme.name} [T]`, 105, height - 28);
    ctx.restore();
  }

  
  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getScores();
    const rankings = Array.from(scores.entries())
      .map(([playerId, score]) => ({ playerId, score: Math.floor(score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => { r.place = idx + 1; });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} dominated the arena!` : "Photo finish!",
    };
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.zeppelins.forEach((z, id) => scores.set(id, z.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.zeppelins.forEach(z => {
      if (z.score > bestScore) {
        bestScore = z.score;
        bestId = z.id;
        tie = false;
      } else if (z.score === bestScore) {
        tie = true;
      }
    });
    return tie ? null : bestId;
  }

  public cleanup(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size = 16): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -38, size });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
      ctx.font = `900 ${ft.size}px "Outfit", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  private addScreenShake(amt: number): void {
    void amt;
  }

}
