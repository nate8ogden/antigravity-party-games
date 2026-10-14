import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

/**
 * [G-242] Ghost Vacuum Buster (Proton Ecto-Canister Trap)
 * Overhauled according to the 8 Pillars of Fun & Double-Review Audit:
 * - Replaced static unmovable pedestals with roaming 2.5D Mascot Ecto-Busters (`this.drawPlayerMascot`) across
 *   a shared Grand Mansion Hall!
 * - Intuitive Universal Controls:
 *   * Steer (`WASD`/Arrows): Roam the hall & aim your Proton Suction Cone (with smart auto-tracking toward the
 *     nearest specter so both 2D and 1-button modes feel effortless and responsive!).
 *   * Tap / Hold Action: Fire your Proton Vacuum Cone to reel in Green Slimer Sprites (+25 pts), Cyan Plasma
 *     Wisps (+35 pts), and Golden King Specters (+70 pts)!
 *   * Release Charged Action in 72%–98% Sweet-Spot: Unleash a Proton Overdrive Snap-Trap & Ecto-Shunt that
 *     instantly reels in all ghosts inside your cone and blasts rival Busters backward!
 * - Elastic player-to-player collisions (m1*v1 + m2*v2) + 3 swappable visual themes (`grand_mansion`,
 *   `royal_museum`, `cyber_containment`) via [T]/[1-3] or Theme Pill.
 */

type BusterThemeId = 'grand_mansion' | 'royal_museum' | 'cyber_containment';

interface BusterTheme {
  id: BusterThemeId;
  name: string;
  bgTop: string;
  bgBottom: string;
  floorColor: string;
  carpetColor: string;
  trimColor: string;
  accent: string;
}

const THEMES: BusterTheme[] = [
  {
    id: 'grand_mansion',
    name: 'Grand Mansion Hall',
    bgTop: '#0f1026',
    bgBottom: '#1e1b4b',
    floorColor: '#1a1638',
    carpetColor: '#3b1c4a',
    trimColor: 'rgba(168, 85, 247, 0.25)',
    accent: '#4ade80'
  },
  {
    id: 'royal_museum',
    name: 'Natural History Wing',
    bgTop: '#091e26',
    bgBottom: '#133642',
    floorColor: '#0f2933',
    carpetColor: '#164e63',
    trimColor: 'rgba(56, 189, 248, 0.25)',
    accent: '#38bdf8'
  },
  {
    id: 'cyber_containment',
    name: 'Ecto-Containment Grid',
    bgTop: '#050816',
    bgBottom: '#0f172a',
    floorColor: '#0b1329',
    carpetColor: '#1e293b',
    trimColor: 'rgba(244, 63, 94, 0.25)',
    accent: '#f43f5e'
  }
];

type GhostKind = 'slimer' | 'plasma' | 'golden_king';

interface EctoGhost {
  id: number;
  kind: GhostKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bobPhase: number;
  pulledBy: PlayerId | null;
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

interface BusterState {
  id: PlayerId;
  config: PlayerConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  score: number;
  captured: number;
  isVacuuming: boolean;
  isCharging: boolean;
  charge: number;
  wasPressed: boolean;
  pressDuration: number;
  overdriveTimer: number;
  shuntCooldown: number;
  stunTimer: number;
  underdogActive: boolean;
}

export class GhostVacuumBusterGame extends BaseGame {
  private busters: Map<PlayerId, BusterState> = new Map();
  private ghosts: EctoGhost[] = [];
  private popups: FloatingPopup[] = [];
  private fxParticles: SparkParticle[] = [];

  private roundDuration = 48;
  private elapsed = 0;
  private isOver = false;
  private suddenDeath = false;
  private nextGhostId = 1;
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
    this.busters.clear();
    this.ghosts = [];
    this.popups = [];
    this.fxParticles = [];
    this.screenShake = 0;

    this.roundTimer = this.roundDuration;
    this.elapsed = 0;
    this.isOver = false;
    this.suddenDeath = false;
    this.nextGhostId = 1;

    const cx = width * 0.5;
    const cy = height * 0.54;
    const count = Math.max(1, this.players.length);

    this.players.forEach((p, idx) => {
      const ang = (idx / count) * Math.PI * 2 + Math.PI * 0.25;
      const sx = cx + Math.cos(ang) * 195;
      const sy = cy + Math.sin(ang) * 125;
      this.busters.set(p.id, {
        id: p.id,
        config: p,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        aimAngle: Math.atan2(cy - sy, cx - sx),
        score: 0,
        captured: 0,
        isVacuuming: true,
        isCharging: false,
        charge: 0,
        wasPressed: false,
        pressDuration: 0,
        overdriveTimer: 0,
        shuntCooldown: 0,
        stunTimer: 0,
        underdogActive: false
      });
    });

    for (let i = 0; i < 9; i++) {
      this.spawnGhost(width, height);
    }
  }

  private spawnGhost(width: number, height: number): void {
    const roll = Math.random();
    const kind: GhostKind =
      roll < (this.suddenDeath ? 0.36 : 0.18)
        ? 'golden_king'
        : roll < 0.55
          ? 'plasma'
          : 'slimer';

    const ang = Math.random() * Math.PI * 2;
    const spd = kind === 'golden_king' ? 75 : 95;
    this.ghosts.push({
      id: this.nextGhostId++,
      kind,
      x: 95 + Math.random() * (width - 190),
      y: 128 + Math.random() * (height - 240),
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      radius: kind === 'golden_king' ? 24 : 18,
      bobPhase: Math.random() * Math.PI * 2,
      pulledBy: null
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
      this.spawnPopup(width * 0.5, 118, 'SUDDEN DEATH! GOLDEN KING SPECTER SURGE!', '#facc15');
      for (let i = 0; i < 3; i++) {
        this.spawnGhost(width, height);
      }
    }

    if (this.roundTimer <= 0) {
      this.isOver = true;
      return;
    }

    let maxScore = 0;
    this.busters.forEach((b) => {
      if (b.score > maxScore) maxScore = b.score;
    });
    this.busters.forEach((b) => {
      b.underdogActive = maxScore - b.score >= 55;
    });

    this.updateBots(safeDt, width, height);

    // Reset ghost pull indicators
    for (const g of this.ghosts) {
      g.pulledBy = null;
    }

    this.busters.forEach((b) => {
      if (b.overdriveTimer > 0) b.overdriveTimer = Math.max(0, b.overdriveTimer - safeDt);
      if (b.shuntCooldown > 0) b.shuntCooldown = Math.max(0, b.shuntCooldown - safeDt);
      if (b.stunTimer > 0) b.stunTimer = Math.max(0, b.stunTimer - safeDt);

      const steerX = this.input.getSteer(b.id);
      const steerY = -this.input.getThrottle(b.id);
      const pressed = this.input.isPressed(b.id);

      // Hold-to-Charge Proton Overdrive Snap-Trap
      if (pressed && b.stunTimer <= 0) {
        b.pressDuration += safeDt;
        b.isVacuuming = true;
        if (b.pressDuration > 0.18) {
          b.isCharging = true;
          b.charge = Math.min(1, b.charge + safeDt * 0.88);
        }
      } else {
        if (b.wasPressed && b.stunTimer <= 0 && b.isCharging && b.charge >= 0.4) {
          this.executeProtonOverdrive(b);
        }
        b.isCharging = false;
        b.charge = 0;
        b.pressDuration = 0;
        // Keep a passive baseline suction active so steering players can always catch ghosts,
        // while pressing/holding boosts suction cone power by 2x!
        b.isVacuuming = b.stunTimer <= 0;
      }
      b.wasPressed = pressed;

      if (!b.config.type.startsWith('bot_') && b.stunTimer <= 0) {
        let moveX = steerX;
        let moveY = steerY;
        const bestGhost = this.findBestGhostFor(b.x, b.y);

        if (Math.abs(moveX) < 0.06 && Math.abs(moveY) < 0.06 && bestGhost) {
          const dx = bestGhost.x - b.x;
          const dy = bestGhost.y - b.y;
          const d = Math.hypot(dx, dy) || 1;
          moveX = (dx / d) * (pressed ? 0.85 : 0.48);
          moveY = (dy / d) * (pressed ? 0.85 : 0.48);
        }

        const len = Math.hypot(moveX, moveY);
        if (len > 0.08) {
          const nx = moveX / Math.max(1, len);
          const ny = moveY / Math.max(1, len);
          const speedMult = (b.underdogActive ? 1.2 : 1.0) * (b.isCharging ? 0.72 : 1.0);
          b.vx += nx * 1260 * speedMult * safeDt;
          b.vy += ny * 1260 * speedMult * safeDt;
        }

        // Smoothly aim Proton Nozzle toward movement direction + nearest ghost assist
        if (bestGhost) {
          const gAng = Math.atan2(bestGhost.y - b.y, bestGhost.x - b.x);
          const moveAng = len > 0.1 ? Math.atan2(moveY, moveX) : gAng;
          const targetAng = len > 0.1 ? this.lerpAngle(moveAng, gAng, 0.45) : gAng;
          b.aimAngle = this.lerpAngle(b.aimAngle, targetAng, 10 * safeDt);
        } else if (len > 0.1) {
          b.aimAngle = this.lerpAngle(b.aimAngle, Math.atan2(moveY, moveX), 10 * safeDt);
        }
      }

      const drag = Math.pow(0.02, safeDt);
      b.vx *= drag;
      b.vy *= drag;
      b.x += b.vx * safeDt;
      b.y += b.vy * safeDt;

      b.x = Math.max(54, Math.min(width - 54, b.x));
      b.y = Math.max(106, Math.min(height - 88, b.y));

      // Apply Proton Suction Cone to Ghosts
      if (b.isVacuuming && b.stunTimer <= 0) {
        const coneRange = pressed || b.overdriveTimer > 0 ? 235 : 175;
        const pullStrength = (pressed ? 420 : 250) * (b.overdriveTimer > 0 ? 1.65 : 1.0) * (b.underdogActive ? 1.2 : 1.0);

        for (const g of this.ghosts) {
          const dx = g.x - b.x;
          const dy = g.y - b.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d <= coneRange) {
            const angToGhost = Math.atan2(dy, dx);
            const diff = Math.abs(this.normalizeAngle(angToGhost - b.aimAngle));
            if (diff <= 0.62) {
              g.pulledBy = b.id;
              const resist = g.kind === 'golden_king' ? 0.68 : 1.0;
              g.vx -= (dx / d) * pullStrength * resist * safeDt;
              g.vy -= (dy / d) * pullStrength * resist * safeDt;
            }
          }
        }
      }
    });

    // Elastic player-to-player collisions
    const list = Array.from(this.busters.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const p1 = list[i];
        const p2 = list[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = 48;
        if (dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          p1.x -= nx * overlap;
          p1.y -= ny * overlap;
          p2.x += nx * overlap;
          p2.y += ny * overlap;

          const kx = p1.vx - p2.vx;
          const ky = p1.vy - p2.vy;
          const p = nx * kx + ny * ky;
          if (p > 0) {
            p1.vx -= p * nx * 1.18 - nx * 45;
            p1.vy -= p * ny * 1.18 - ny * 45;
            p2.vx += p * nx * 1.18 + nx * 45;
            p2.vy += p * ny * 1.18 + ny * 45;
            this.triggerScreenShake(3);
            this.spawnParticles((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#4ade80', 8);
          }
        }
      }
    }

    // Update Ghosts & Canister Captures
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.bobPhase += safeDt * 5;
      g.x += g.vx * safeDt;
      g.y += g.vy * safeDt;

      // Gentle damping so ghosts don't accelerate infinitely
      const spd = Math.hypot(g.vx, g.vy);
      if (spd > 280) {
        g.vx = (g.vx / spd) * 280;
        g.vy = (g.vy / spd) * 280;
      } else if (spd < 55 && !g.pulledBy) {
        const ang = Math.random() * Math.PI * 2;
        g.vx += Math.cos(ang) * 40;
        g.vy += Math.sin(ang) * 40;
      }

      if (g.x < 68 || g.x > width - 68) g.vx *= -1;
      if (g.y < 114 || g.y > height - 94) g.vy *= -1;
      g.x = Math.max(64, Math.min(width - 64, g.x));
      g.y = Math.max(110, Math.min(height - 90, g.y));

      // Check capture by any Buster
      let captured = false;
      this.busters.forEach((b) => {
        if (captured || b.stunTimer > 0) return;
        if (Math.hypot(g.x - b.x, g.y - b.y) <= g.radius + 28) {
          captured = true;
          const basePts = g.kind === 'golden_king' ? 70 : g.kind === 'plasma' ? 35 : 25;
          const pts = Math.round(basePts * (b.underdogActive ? 1.25 : 1));
          b.score += pts;
          b.captured++;
          const col = g.kind === 'golden_king' ? '#facc15' : g.kind === 'plasma' ? '#38bdf8' : '#4ade80';
          this.triggerScreenShake(g.kind === 'golden_king' ? 5 : 3);
          this.spawnParticles(b.x, b.y, col, 18);
          this.spawnPopup(
            b.x,
            b.y - 28,
            g.kind === 'golden_king' ? `KING TRAPPED! +${pts}` : `TRAPPED! +${pts}`,
            col
          );
        }
      });

      if (captured) {
        this.ghosts.splice(i, 1);
        this.spawnGhost(width, height);
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

  private normalizeAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const diff = this.normalizeAngle(b - a);
    return a + diff * Math.min(1, t);
  }

  private findBestGhostFor(x: number, y: number): EctoGhost | null {
    let best: EctoGhost | null = null;
    let bestVal = -1e9;
    for (const g of this.ghosts) {
      const d = Math.hypot(g.x - x, g.y - y);
      const bonus = g.kind === 'golden_king' ? 140 : g.kind === 'plasma' ? 50 : 0;
      if (bonus - d > bestVal) {
        bestVal = bonus - d;
        best = g;
      }
    }
    return best;
  }

  private executeProtonOverdrive(b: BusterState): void {
    const isSweetSpot = b.charge >= 0.72 && b.charge <= 0.98;
    b.overdriveTimer = isSweetSpot ? 0.9 : 0.45;
    b.shuntCooldown = 0.85;

    // Yank all ghosts inside cone strongly toward the Buster!
    const range = isSweetSpot ? 265 : 195;
    for (const g of this.ghosts) {
      const dx = g.x - b.x;
      const dy = g.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= range) {
        const diff = Math.abs(this.normalizeAngle(Math.atan2(dy, dx) - b.aimAngle));
        if (diff <= 0.75) {
          const yank = isSweetSpot ? 340 : 210;
          g.vx = -(dx / d) * yank;
          g.vy = -(dy / d) * yank;
        }
      }
    }

    // Shunt nearby rival Busters
    const shuntRadius = isSweetSpot ? 155 : 100;
    this.busters.forEach((other) => {
      if (other.id === b.id) return;
      const dx = other.x - b.x;
      const dy = other.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= shuntRadius) {
        const push = isSweetSpot ? 540 : 320;
        other.vx += (dx / d) * push;
        other.vy += (dy / d) * push;
        if (isSweetSpot) {
          other.stunTimer = 0.45;
          this.spawnPopup(other.x, other.y - 28, 'PROTON SHUNT!', '#4ade80');
        }
      }
    });

    this.triggerScreenShake(isSweetSpot ? 6 : 3);
    this.spawnParticles(b.x, b.y, isSweetSpot ? '#facc15' : '#4ade80', isSweetSpot ? 22 : 12);

    if (isSweetSpot) {
      b.score += 15;
      this.spawnPopup(b.x, b.y - 36, 'PROTON OVERDRIVE! +15', '#facc15');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.busters.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    const skill = difficulty === 'bot_hard' ? 1.0 : difficulty === 'bot_normal' ? 0.82 : 0.65;
    const target = this.findBestGhostFor(bot.x, bot.y);

    if (target) {
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const d = Math.hypot(dx, dy) || 1;
      const targetAng = Math.atan2(dy, dx);
      bot.aimAngle = this.lerpAngle(bot.aimAngle, targetAng, 8 * skill * dt);
      bot.isVacuuming = true;

      if (d > 95) {
        bot.vx += (dx / d) * 1050 * skill * dt;
        bot.vy += (dy / d) * 1050 * skill * dt;
      }

      // Apply bot suction pull
      if (d <= 210) {
        const pull = 360 * skill;
        target.pulledBy = bot.id;
        target.vx -= (dx / d) * pull * dt;
        target.vy -= (dy / d) * pull * dt;
      }

      if (difficulty !== 'bot_easy' && d < 185 && bot.shuntCooldown <= 0 && Math.random() < dt * 0.7) {
        bot.charge = difficulty === 'bot_hard' ? 0.85 : 0.65;
        this.executeProtonOverdrive(bot);
        bot.charge = 0;
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

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Background & Grand Mansion Carpet Floor
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.floorColor;
    ctx.beginPath();
    ctx.roundRect(38, 92, width - 76, height - 168, 24);
    ctx.fill();
    ctx.strokeStyle = theme.trimColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = theme.carpetColor;
    ctx.beginPath();
    ctx.roundRect(96, 134, width - 192, height - 252, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Proton Vacuum Cones
    this.busters.forEach((b) => {
      if (b.isVacuuming && b.stunTimer <= 0) {
        this.drawVacuumCone(ctx, b);
      }
    });

    // 3. Floating Ecto-Ghosts
    for (const g of this.ghosts) {
      this.drawGhost(ctx, g);
    }

    // 4. Busters sorted by Y
    const sorted = Array.from(this.busters.values()).sort((a, b) => a.y - b.y);
    for (const b of sorted) {
      this.drawBuster(ctx, b);
    }

    // 5. Particles & Popups
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

    // 6. HUD
    this.drawHUD(ctx, width, height, theme);

    ctx.restore();
  }

  private drawVacuumCone(ctx: CanvasRenderingContext2D, b: BusterState): void {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.aimAngle);

    const len = b.overdriveTimer > 0 ? 235 : 175;
    const spread = 0.45;
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, b.overdriveTimer > 0 ? 'rgba(250, 204, 21, 0.42)' : 'rgba(74, 222, 128, 0.32)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(len, -Math.tan(spread) * len);
    ctx.lineTo(len, Math.tan(spread) * len);
    ctx.closePath();
    ctx.fill();

    // Animated suction rings pulling inward
    const ringOffset = 1 - ((this.elapsed * 2.8) % 1);
    ctx.strokeStyle = b.config.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    for (const base of [0.3, 0.65, 0.95]) {
      const u = (base + ringOffset) % 1;
      const rx = 24 + u * (len - 34);
      const ry = Math.tan(spread) * rx * 0.75;
      ctx.beginPath();
      ctx.ellipse(rx, 0, 7, Math.max(4, ry), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawGhost(ctx: CanvasRenderingContext2D, g: EctoGhost): void {
    ctx.save();
    ctx.translate(g.x, g.y + Math.sin(g.bobPhase) * 4);

    const col =
      g.kind === 'golden_king' ? '#facc15' : g.kind === 'plasma' ? '#38bdf8' : '#4ade80';

    ctx.fillStyle = col;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.arc(0, -4, g.radius, Math.PI, 0);
    ctx.lineTo(g.radius, g.radius * 0.8);
    ctx.lineTo(0, g.radius * 0.45);
    ctx.lineTo(-g.radius, g.radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (g.kind === 'golden_king') {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(-12, -g.radius - 2);
      ctx.lineTo(-7, -g.radius - 13);
      ctx.lineTo(0, -g.radius - 6);
      ctx.lineTo(7, -g.radius - 13);
      ctx.lineTo(12, -g.radius - 2);
      ctx.closePath();
      ctx.fill();
    }

    // Playful Ghost Eyes
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(-6, -5, 3, 0, Math.PI * 2);
    ctx.arc(6, -5, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawBuster(ctx: CanvasRenderingContext2D, b: BusterState): void {
    ctx.save();

    if (b.underdogActive) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 29 + Math.sin(this.elapsed * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    const mood: CharacterMood = b.stunTimer > 0 ? 'shocked' : b.isCharging || b.overdriveTimer > 0 ? 'triumph' : 'focused';
    this.drawPlayerMascot(ctx, b.id, b.x, b.y, 22, mood, this.elapsed, b.aimAngle);

    if (b.isCharging && b.charge > 0.08) {
      const sweet = b.charge >= 0.72 && b.charge <= 0.98;
      ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 32, -Math.PI * 0.5, -Math.PI * 0.5 + b.charge * Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3;
    ctx.strokeText(b.config.name, b.x, b.y + 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.config.name, b.x, b.y + 36);

    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: BusterTheme): void {
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
        ? `⚡ SUDDEN DEATH BUSTERS • ${timeStr} ⚡`
        : `GHOST VACUUM BUSTER • ${timeStr}`,
      width * 0.5,
      71
    );

    const cardW = 168;
    const cardH = 66;
    const players = Array.from(this.busters.values());
    players.forEach((b, idx) => {
      const cardX = idx % 2 === 0 ? 20 : width - cardW - 20;
      const cardY = idx < 2 ? height - 128 : 54;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = b.config.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = b.config.color;
      ctx.font = '800 13px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(b.config.name, cardX + 12, cardY + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px "Outfit", sans-serif';
      ctx.fillText(`${b.score} PTS`, cardX + 12, cardY + 46);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 11px "Outfit", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`TRAPPED: ${b.captured}`, cardX + cardW - 12, cardY + 22);
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

  public getScore(playerId: PlayerId): number {
    return this.busters.get(playerId)?.score ?? 0;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.busters.values()).sort((a, b) => b.score - a.score);
    const rankings = sorted.map((b, idx) => ({
      playerId: b.id,
      score: b.score,
      place: idx + 1
    }));
    const isTie = sorted.length >= 2 && sorted[0].score === sorted[1].score;
    const winnerId = isTie || sorted.length === 0 ? null : sorted[0].id;
    return {
      winnerId,
      rankings,
      mvpHighlight: sorted[0]
        ? `${sorted[0].config.name} trapped ${sorted[0].captured} ghosts (${sorted[0].score} pts)!`
        : 'Containment Complete!'
    };
  }
}
