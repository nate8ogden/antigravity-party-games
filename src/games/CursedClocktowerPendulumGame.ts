import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

/**
 * [G-246] Grand Clocktower Pendulum (Chronos Gear & Pendulum Dodge)
 * Overhauled according to the 8 Pillars of Fun & Double-Review Audit:
 * - 2.5D Mascot Clocksmiths (`this.drawPlayerMascot`) sprint across the shared Grand Clocktower Rafter Beam,
 *   snatching falling Brass Cogs (+20 pts), Silver Mainsprings (+35 pts), and Golden Chronos Cores (+65 pts)!
 * - Intuitive Universal Controls:
 *   * Steer (`WASD`/Arrows or 1-button auto-weave): Run across the Clocktower Beam!
 *   * Hold Action (or Down): Crouch low under the sweeping Grand Brass Pendulum while charging your Chronos Spring!
 *     Ducking right as the pendulum blade sweeps overhead awards a +15 PERFECT DUCK bonus!
 *   * Tap / Release Action: Vault upward to grab aerial Golden Chronos Cores! Releasing a 72%–98% Sweet-Spot charge
 *     unleashes a Chronos Shockwave & Rafter Shunt that pulls nearby gears to you and knocks rivals sideways!
 * - Elastic player-to-player collisions (m1*v1 + m2*v2) + 3 swappable visual themes (`big_ben`, `astral_horology`,
 *   `cyber_chrono`) via [T]/[1-3] or Theme Pill.
 */

type ClocktowerThemeId = 'big_ben' | 'astral_horology' | 'cyber_chrono';

interface ClocktowerTheme {
  id: ClocktowerThemeId;
  name: string;
  bgTop: string;
  bgBottom: string;
  dialColor: string;
  beamColor: string;
  pendulumBlade: string;
  pendulumTrim: string;
  accent: string;
}

const THEMES: ClocktowerTheme[] = [
  {
    id: 'big_ben',
    name: 'Royal Belfry Clock',
    bgTop: '#161124',
    bgBottom: '#2d1e3e',
    dialColor: 'rgba(250, 204, 21, 0.16)',
    beamColor: '#451a03',
    pendulumBlade: '#e2e8f0',
    pendulumTrim: '#f59e0b',
    accent: '#facc15'
  },
  {
    id: 'astral_horology',
    name: 'Celestial Orrery',
    bgTop: '#08142c',
    bgBottom: '#172554',
    dialColor: 'rgba(56, 189, 248, 0.18)',
    beamColor: '#1e293b',
    pendulumBlade: '#bae6fd',
    pendulumTrim: '#38bdf8',
    accent: '#38bdf8'
  },
  {
    id: 'cyber_chrono',
    name: 'Neon Chrono-Core',
    bgTop: '#050714',
    bgBottom: '#111827',
    dialColor: 'rgba(244, 63, 94, 0.18)',
    beamColor: '#0f172a',
    pendulumBlade: '#fda4af',
    pendulumTrim: '#f43f5e',
    accent: '#f43f5e'
  }
];

type GearKind = 'brass_cog' | 'silver_spring' | 'chronos_core';

interface FallingGear {
  id: number;
  kind: GearKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
}

interface FloatingPopup {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface ClocksmithState {
  id: PlayerId;
  config: PlayerConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isGrounded: boolean;
  isDucking: boolean;
  isCharging: boolean;
  charge: number;
  wasPressed: boolean;
  pressDuration: number;
  score: number;
  gearsCollected: number;
  invulnTimer: number;
  closeCallCooldown: number;
  underdogActive: boolean;
  autoDir: number;
}

export class CursedClocktowerPendulumGame extends BaseGame {
  private smiths: Map<PlayerId, ClocksmithState> = new Map();
  private gears: FallingGear[] = [];
  private popups: FloatingPopup[] = [];
  private fxParticles: SparkParticle[] = [];

  private pendulumAngle = 0;
  private pendulumPhase = 0;
  private bgCogAngle = 0;

  private roundDuration = 48;
  private elapsed = 0;
  private isOver = false;
  private suddenDeath = false;
  private nextGearId = 1;
  private gearSpawnTimer = 0;
  private screenShake = 0;

  private themeIndex = 0;
  private wasThemeKeyPressed = false;
  private pointerHandler: ((e: PointerEvent) => void) | null = null;

  private triggerScreenShake(amt: number): void {
    this.screenShake = Math.max(this.screenShake, amt);
  }

  private applyScreenShake(ctx: CanvasRenderingContext2D): void {
    if (this.screenShake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.screenShake * 2, (Math.random() - 0.5) * this.screenShake * 2);
    }
  }

  public init(width: number, height: number): void {
    this.themeIndex = Math.floor(Math.random() * THEMES.length);
    this.bindThemePill(width, height);
    this.reset(width, height);
  }

  private bindThemePill(_width: number, _height: number): void {
    if (typeof window === 'undefined') return;
    if (this.pointerHandler) {
      window.removeEventListener('pointerdown', this.pointerHandler);
    }
    this.pointerHandler = (e: PointerEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
      const sy = (e.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
      if (sx >= 20 && sx <= 190 && sy >= canvas.height - 44 && sy <= canvas.height - 12) {
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
        this.triggerScreenShake(2);
      }
    };
    window.addEventListener('pointerdown', this.pointerHandler);
  }

  public reset(width: number, height: number): void {
    this.smiths.clear();
    this.gears = [];
    this.popups = [];
    this.fxParticles = [];
    this.screenShake = 0;

    this.pendulumAngle = 0;
    this.pendulumPhase = 0;
    this.bgCogAngle = 0;
    this.roundTimer = this.roundDuration;
    this.elapsed = 0;
    this.isOver = false;
    this.suddenDeath = false;
    this.nextGearId = 1;
    this.gearSpawnTimer = 0;

    const beamY = height - 138;
    const count = Math.max(1, this.getActivePlayers().length);
    const leftX = width * 0.22;
    const spanX = width * 0.56;

    const activePlayers = this.getActivePlayers();
    activePlayers.forEach((p, idx) => {
      const sx = leftX + ((idx + 0.5) / count) * spanX;
      this.smiths.set(p.id, {
        id: p.id,
        config: p,
        x: sx,
        y: beamY,
        vx: 0,
        vy: 0,
        isGrounded: true,
        isDucking: false,
        isCharging: false,
        charge: 0,
        wasPressed: false,
        pressDuration: 0,
        score: 0,
        gearsCollected: 0,
        invulnTimer: 0,
        closeCallCooldown: 0,
        underdogActive: false,
        autoDir: idx % 2 === 0 ? 1 : -1
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnGear(width, height, true);
    }
  }

  private spawnGear(width: number, height: number, initial = false): void {
    const roll = Math.random();
    const kind: GearKind =
      roll < (this.suddenDeath ? 0.38 : 0.2)
        ? 'chronos_core'
        : roll < 0.55
          ? 'silver_spring'
          : 'brass_cog';

    this.gears.push({
      id: this.nextGearId++,
      kind,
      x: width * 0.16 + Math.random() * (width * 0.68),
      y: initial ? 140 + Math.random() * (height - 310) : 95,
      vx: (Math.random() - 0.5) * 45,
      vy: 95 + Math.random() * 65,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 4
    });
  }

  private pollThemeHotkeys(): void {
    if (typeof window === 'undefined') return;
    const kb = (this.input as unknown as { keys?: Set<string> }).keys;
    if (!kb) return;
    const tDown = kb.has('KeyT') || kb.has('Digit1') || kb.has('Digit2') || kb.has('Digit3');
    if (tDown && !this.wasThemeKeyPressed) {
      if (kb.has('Digit1')) this.themeIndex = 0;
      else if (kb.has('Digit2')) this.themeIndex = 1;
      else if (kb.has('Digit3')) this.themeIndex = 2;
      else this.themeIndex = (this.themeIndex + 1) % THEMES.length;
    }
    this.wasThemeKeyPressed = tDown;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isOver) return;
    const safeDt = Math.min(dt, 0.05);
    this.elapsed += safeDt;
    this.roundTimer = Math.max(0, this.roundTimer - safeDt);
    this.pollThemeHotkeys();

    if (!this.suddenDeath && this.roundTimer <= 12) {
      this.suddenDeath = true;
      this.triggerScreenShake(6);
      this.spawnPopup(width * 0.5, 118, 'SUDDEN DEATH! 2X CHRONOS CORES!', '#facc15');
      for (let i = 0; i < 4; i++) {
        this.spawnGear(width, height, true);
      }
    }

    if (this.roundTimer <= 0) {
      this.isOver = true;
      return;
    }

    this.bgCogAngle += safeDt * 0.45;
    const swingFreq = this.suddenDeath ? 2.65 : 2.05;
    this.pendulumPhase += safeDt * swingFreq;
    this.pendulumAngle = Math.sin(this.pendulumPhase) * 0.78;

    const pivotX = width * 0.5;
    const pivotY = 74;
    const beamY = height - 138;
    const armLen = beamY - pivotY - 12;
    const bobX = pivotX + Math.sin(this.pendulumAngle) * armLen;
    const bobY = pivotY + Math.cos(this.pendulumAngle) * armLen;

    let maxScore = 0;
    this.smiths.forEach((s) => {
      if (s.score > maxScore) maxScore = s.score;
    });
    this.smiths.forEach((s) => {
      s.underdogActive = maxScore - s.score >= 55;
    });

    this.updateBots(safeDt, width, height);

    this.smiths.forEach((s) => {
      if (s.invulnTimer > 0) s.invulnTimer = Math.max(0, s.invulnTimer - safeDt);
      if (s.closeCallCooldown > 0) s.closeCallCooldown = Math.max(0, s.closeCallCooldown - safeDt);

      const steerX = this.input.getSteer(s.id);
      const throttle = this.input.getThrottle(s.id);
      const isBot = s.config.type.startsWith('bot_');
      const pressed = this.input.isActionPressed(s.id) || (isBot && this.input.isPressed(s.id));

      if (!isBot) {
        // Holding Action (or Down) crouches safely beneath the pendulum while charging your Chronos Vault!
        if (pressed || throttle < -0.35) {
          s.isDucking = true;
          s.pressDuration += safeDt;
          s.isCharging = true;
          s.charge = Math.min(1, s.charge + safeDt * 0.92);
        } else {
          if (s.wasPressed) {
            this.executeChronosVault(s, width, height);
          } else if (throttle > 0.45 && s.isGrounded) {
            s.vy = -440;
            s.isGrounded = false;
          }
          s.isDucking = false;
          s.isCharging = false;
          s.charge = 0;
          s.pressDuration = 0;
        }
        s.wasPressed = pressed;

        let moveX = steerX;
        if (Math.abs(moveX) < 0.06 && !s.isDucking) {
          // 1-button fallback: smoothly pursue nearest falling gear
          const bestG = this.findBestGearFor(s.x);
          if (bestG) {
            const dx = bestG.x - s.x;
            if (Math.abs(dx) > 12) {
              moveX = Math.max(-0.7, Math.min(0.7, dx / 80));
            }
          }
        }

        const speedMult = (s.underdogActive ? 1.2 : 1.0) * (s.isDucking ? 0.55 : 1.0);
        s.vx += moveX * 1450 * speedMult * safeDt;
      }

      s.vx *= Math.pow(0.015, safeDt);
      s.x += s.vx * safeDt;

      // Vertical jump & gravity
      if (!s.isGrounded) {
        s.vy += 1220 * safeDt;
        s.y += s.vy * safeDt;
        if (s.y >= beamY) {
          s.y = beamY;
          s.vy = 0;
          s.isGrounded = true;
        }
      } else {
        s.y = beamY;
      }

      const minX = width * 0.13;
      const maxX = width * 0.87;
      if (s.x < minX) { s.x = minX; s.vx = Math.abs(s.vx) * 0.5; }
      if (s.x > maxX) { s.x = maxX; s.vx = -Math.abs(s.vx) * 0.5; }

      // Check Pendulum Blade Interaction
      const distToBob = Math.hypot(bobX - s.x, bobY - (s.y - (s.isDucking ? 2 : 18)));
      if (distToBob <= 56) {
        if (s.isDucking || !s.isGrounded || s.invulnTimer > 0) {
          // Safe! Award a crisp +15 Close Call bonus when dodging the blade!
          if (s.closeCallCooldown <= 0) {
            s.closeCallCooldown = 1.1;
            s.score += 15;
            this.spawnParticles(s.x, s.y - 16, '#38bdf8', 10);
            this.spawnPopup(s.x, s.y - 36, 'PERFECT DODGE! +15', '#38bdf8');
          }
        } else {
          // Struck by the pendulum! Knock sideways along the beam
          s.invulnTimer = 0.85;
          s.score = Math.max(0, s.score - 10);
          const dir = Math.cos(this.pendulumPhase) >= 0 ? 1 : -1;
          s.vx = dir * 520;
          s.vy = -260;
          s.isGrounded = false;
          this.triggerScreenShake(5);
          this.spawnParticles(s.x, s.y - 16, '#f43f5e', 16);
          this.spawnPopup(s.x, s.y - 36, 'PENDULUM CLIP! -10', '#f43f5e');
        }
      }
    });

    // Elastic player-to-player collisions along the beam
    const list = Array.from(this.smiths.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const p1 = list[i];
        const p2 = list[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = 46;
        if (dist < minDist) {
          const nx = dx / dist;
          const overlap = (minDist - dist) * 0.5;
          p1.x -= nx * overlap;
          p2.x += nx * overlap;

          const kx = p1.vx - p2.vx;
          const p = nx * kx;
          if (p > 0) {
            p1.vx -= p * nx * 1.2 - nx * 55;
            p2.vx += p * nx * 1.2 + nx * 55;
            this.triggerScreenShake(3);
            this.spawnParticles((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#facc15', 8);
          }
        }
      }
    }

    // Spawn & Update Falling Gears
    this.gearSpawnTimer += safeDt;
    if (this.gearSpawnTimer >= (this.suddenDeath ? 0.55 : 0.85) && this.gears.length < 11) {
      this.gearSpawnTimer = 0;
      this.spawnGear(width, height, false);
    }

    for (let i = this.gears.length - 1; i >= 0; i--) {
      const g = this.gears[i];
      g.rot += g.rotSpeed * safeDt;
      g.x += g.vx * safeDt;
      g.y += g.vy * safeDt;

      // Bounce gently on the Clocktower Beam once so players can grab them on the beam too!
      if (g.y >= beamY - 8 && g.vy > 0) {
        g.y = beamY - 8;
        g.vy = -g.vy * 0.55;
        if (Math.abs(g.vy) < 35) {
          this.gears.splice(i, 1);
          continue;
        }
      }

      let collected = false;
      this.smiths.forEach((s) => {
        if (collected) return;
        if (Math.hypot(g.x - s.x, g.y - (s.y - 10)) <= 40) {
          collected = true;
          const basePts = g.kind === 'chronos_core' ? 65 : g.kind === 'silver_spring' ? 35 : 20;
          const pts = Math.round(basePts * (s.underdogActive ? 1.25 : 1));
          s.score += pts;
          s.gearsCollected++;
          const col = g.kind === 'chronos_core' ? '#facc15' : g.kind === 'silver_spring' ? '#38bdf8' : '#f59e0b';
          this.spawnParticles(g.x, g.y, col, 14);
          this.spawnPopup(g.x, g.y - 20, `+${pts}`, col);
        }
      });

      if (collected) {
        this.gears.splice(i, 1);
      }
    }

    for (let i = this.fxParticles.length - 1; i >= 0; i--) {
      const pt = this.fxParticles[i];
      pt.x += pt.vx * safeDt;
      pt.y += pt.vy * safeDt;
      pt.life -= safeDt;
      if (pt.life <= 0) this.fxParticles.splice(i, 1);
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y += pop.vy * safeDt;
      pop.life -= safeDt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - safeDt * 18);
    }
  }

  private findBestGearFor(x: number): FallingGear | null {
    let best: FallingGear | null = null;
    let bestVal = -1e9;
    for (const g of this.gears) {
      const d = Math.abs(g.x - x);
      const bonus = g.kind === 'chronos_core' ? 140 : g.kind === 'silver_spring' ? 50 : 0;
      if (bonus - d > bestVal) {
        bestVal = bonus - d;
        best = g;
      }
    }
    return best;
  }

  private executeChronosVault(s: ClocksmithState, _width: number, _height: number): void {
    const isSweetSpot = s.charge >= 0.72 && s.charge <= 0.98;
    if (s.isGrounded) {
      s.vy = isSweetSpot ? -540 : -420;
      s.isGrounded = false;
    }
    s.invulnTimer = isSweetSpot ? 0.65 : 0.3;

    if (isSweetSpot) {
      s.score += 15;
      this.triggerScreenShake(5);
      this.spawnParticles(s.x, s.y, '#facc15', 20);
      this.spawnPopup(s.x, s.y - 42, 'CHRONOS TIME-VAULT! +15', '#facc15');

      // Pull nearby falling gears toward the leaping Clocksmith!
      for (const g of this.gears) {
        const dx = s.x - g.x;
        const dy = s.y - 40 - g.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d <= 210) {
          g.vx += (dx / d) * 260;
          g.vy += (dy / d) * 260;
        }
      }

      // Shunt nearby rivals along the beam
      this.smiths.forEach((other) => {
        if (other.id === s.id) return;
        const dx = other.x - s.x;
        if (Math.abs(dx) <= 145) {
          other.vx += (dx >= 0 ? 1 : -1) * 480;
          this.spawnPopup(other.x, other.y - 32, 'CHRONOS SHUNT!', '#fb923c');
        }
      });
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const bot = this.smiths.get(botId);
    if (!bot) return;

    const pivotX = width * 0.5;
    const pivotY = 74;
    const beamY = height - 138;
    const armLen = beamY - pivotY - 12;
    const bobX = pivotX + Math.sin(this.pendulumAngle) * armLen;

    const distX = Math.abs(bobX - bot.x);
    const duckDist = difficulty === 'bot_hard' ? 88 : difficulty === 'bot_normal' ? 72 : 52;

    if (distX <= duckDist) {
      bot.isDucking = true;
      bot.isCharging = true;
      bot.charge = Math.min(1, bot.charge + dt * 0.92);
      return;
    } else if (bot.isDucking) {
      if (bot.charge >= 0.72) {
        this.executeChronosVault(bot, width, height);
      }
      bot.isDucking = false;
      bot.isCharging = false;
      bot.charge = 0;
    }

    const skill = difficulty === 'bot_hard' ? 1.0 : difficulty === 'bot_normal' ? 0.82 : 0.65;
    const target = this.findBestGearFor(bot.x);
    if (target) {
      const dx = target.x - bot.x;
      bot.vx += Math.max(-1, Math.min(1, dx / 60)) * 1250 * skill * dt;
      if (Math.abs(dx) < 36 && target.y < bot.y - 45 && bot.isGrounded && distX > 110) {
        bot.vy = -440;
        bot.isGrounded = false;
      }
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 165;
      this.fxParticles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color,
        size: 3 + Math.random() * 3.5,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65
      });
    }
  }

  private spawnPopup(x: number, y: number, text: string, color: string): void {
    this.popups.push({
      x,
      y,
      vy: -36,
      text,
      color,
      life: 1.0,
      maxLife: 1.0
    });
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex];
    const pivotX = width * 0.5;
    const pivotY = 74;
    const beamY = height - 138;

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Background & Giant Clockwork Dial
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width * 0.5, height * 0.48);
    ctx.rotate(this.bgCogAngle);
    ctx.strokeStyle = theme.dialColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 185, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 145, Math.sin(a) * 145);
      ctx.lineTo(Math.cos(a) * 185, Math.sin(a) * 185);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Shared Clocktower Rafter Beam
    ctx.fillStyle = theme.beamColor;
    ctx.strokeStyle = theme.pendulumTrim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(width * 0.1, beamY + 14, width * 0.8, 28, 10);
    ctx.fill();
    ctx.stroke();

    // 3. Falling Gears
    for (const g of this.gears) {
      this.drawGear(ctx, g);
    }

    // 4. Clocksmiths
    const sorted = Array.from(this.smiths.values()).sort((a, b) => a.x - b.x);
    for (const s of sorted) {
      this.drawSmith(ctx, s);
    }

    // 5. Swinging Grand Brass Pendulum
    this.drawPendulum(ctx, pivotX, pivotY, beamY - pivotY - 12, theme);

    // 6. Particles & Popups
    for (const pt of this.fxParticles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const pop of this.popups) {
      ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
      ctx.font = '900 15px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 4;
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;

    // 7. HUD
    this.drawHUD(ctx, width, height, theme);

    ctx.restore();
  }

  private drawPendulum(
    ctx: CanvasRenderingContext2D,
    pivotX: number,
    pivotY: number,
    armLen: number,
    theme: ClocktowerTheme
  ): void {
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(this.pendulumAngle);

    // Rod
    ctx.strokeStyle = theme.pendulumTrim;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, armLen);
    ctx.stroke();

    // Crescent Pendulum Bob
    ctx.translate(0, armLen);
    ctx.fillStyle = theme.pendulumBlade;
    ctx.strokeStyle = theme.pendulumTrim;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = theme.pendulumTrim;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawGear(ctx: CanvasRenderingContext2D, g: FallingGear): void {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rot);

    const col =
      g.kind === 'chronos_core' ? '#facc15' : g.kind === 'silver_spring' ? '#38bdf8' : '#f59e0b';
    const r = g.kind === 'chronos_core' ? 16 : 13;

    ctx.fillStyle = col;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawSmith(ctx: CanvasRenderingContext2D, s: ClocksmithState): void {
    ctx.save();

    if (s.underdogActive) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 29 + Math.sin(this.elapsed * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    const mood: CharacterMood = s.isCharging ? 'triumph' : 'focused';
    ctx.save();
    ctx.translate(s.x, s.y + (s.isDucking ? 7 : 0));
    if (s.isDucking) {
      ctx.scale(1.26, 0.68);
    }
    this.drawPlayerMascot(ctx, s.id, 0, 0, 21, mood, this.elapsed, 0);
    ctx.restore();

    if (s.isCharging && s.charge > 0.08) {
      const sweet = s.charge >= 0.72 && s.charge <= 0.98;
      ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 31, -Math.PI * 0.5, -Math.PI * 0.5 + s.charge * Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3;
    ctx.strokeText(s.config.name, s.x, s.y + 34);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s.config.name, s.x, s.y + 34);

    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: ClocktowerTheme): void {
    const headerW = 390;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = this.suddenDeath ? '#facc15' : theme.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - headerW * 0.5, 48, headerW, 36, 18);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 15px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.suddenDeath ? '#facc15' : '#f8fafc';
    const timeStr = `${Math.ceil(this.roundTimer)}s`;
    ctx.fillText(
      this.suddenDeath
        ? `⚡ SUDDEN DEATH CLOCKTOWER • ${timeStr} ⚡`
        : `GRAND CLOCKTOWER PENDULUM • ${timeStr}`,
      width * 0.5,
      71
    );

    const cardW = 168;
    const cardH = 66;
    const players = Array.from(this.smiths.values());
    players.forEach((s, idx) => {
      const cardX = idx % 2 === 0 ? 20 : width - cardW - 20;
      const cardY = idx < 2 ? height - 128 : 54;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = s.config.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = s.config.color;
      ctx.font = '800 13px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(s.config.name, cardX + 12, cardY + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px "Outfit", sans-serif';
      ctx.fillText(`${s.score} PTS`, cardX + 12, cardY + 46);

      ctx.fillStyle = '#fde047';
      ctx.font = '700 11px "Outfit", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`GEARS: ${s.gearsCollected}`, cardX + cardW - 12, cardY + 22);
    });

    // Clickable Theme Pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 ${theme.name} [T]`, 105, height - 24);
  }

  public isRoundOver(): boolean {
    return this.isOver;
  }

  public handlePointerDown(x: number, y: number, _width: number, height: number): boolean {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  public getScore(playerId: PlayerId): number {
    return this.smiths.get(playerId)?.score ?? 0;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.smiths.values()).sort((a, b) => b.score - a.score);
    const rankings = sorted.map((s, idx) => ({
      playerId: s.id,
      score: s.score,
      place: idx + 1
    }));
    const isTie = sorted.length >= 2 && sorted[0].score === sorted[1].score;
    const winnerId = isTie || sorted.length === 0 ? null : sorted[0].id;
    return {
      winnerId,
      rankings,
      mvpHighlight: sorted[0]
        ? `${sorted[0].config.name} collected ${sorted[0].gearsCollected} gears (${sorted[0].score} pts)!`
        : 'Clocktower Showdown Complete!'
    };
  }
}
