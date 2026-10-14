import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

/**
 * [G-244] Clockwork Toy Derby (Grand Toymaker Wind-Up Sprint)
 * Overhauled according to the 8 Pillars of Fun & Wholesome Arcade Re-Theme:
 * - Re-themed from "Creepy Doll Crawl" into a cheerful, vibrant 2.5D Clockwork Toy Derby across the Grand Toymaker's
 *   Workbench Track!
 * - 2.5D Mascot Pilots (`this.drawPlayerMascot`) ride Brass Wind-Up Toy Racers across a shared multi-lane workbench:
 *   * Steer (`WASD`/Arrows): Weave freely across the track to snatch Golden Brass Gears (+25 pts) & Star Keys (+50 pts),
 *     hit Speed Chevron Pads, and dodge Sticky Paint/Glue Puddles!
 *   * Tap Action: Quick Wind-Up Boost + Hop!
 *   * Hold & Release Action in 72%–98% Sweet-Spot: Unleash a Mainspring Overdrive Sprint & Sonic Gear Shunt that
 *     rockets you down the track and shunts rival toy racers sideways!
 * - Elastic player-to-player collisions (m1*v1 + m2*v2) + 3 swappable visual themes (`toymaker_bench`,
 *   `clockwork_palace`, `cyber_circuit`) via [T]/[1-3] or Theme Pill.
 */

type ToyDerbyThemeId = 'toymaker_bench' | 'clockwork_palace' | 'cyber_circuit';

interface ToyDerbyTheme {
  id: ToyDerbyThemeId;
  name: string;
  bgTop: string;
  bgBottom: string;
  trackColor: string;
  laneLine: string;
  borderColor: string;
  accent: string;
}

const THEMES: ToyDerbyTheme[] = [
  {
    id: 'toymaker_bench',
    name: 'Toymaker Workbench',
    bgTop: '#24140e',
    bgBottom: '#432818',
    trackColor: '#362013',
    laneLine: 'rgba(250, 204, 21, 0.24)',
    borderColor: '#d97706',
    accent: '#facc15'
  },
  {
    id: 'clockwork_palace',
    name: 'Royal Brass Gallery',
    bgTop: '#161130',
    bgBottom: '#2b2259',
    trackColor: '#1f1842',
    laneLine: 'rgba(192, 132, 252, 0.24)',
    borderColor: '#a855f7',
    accent: '#c084fc'
  },
  {
    id: 'cyber_circuit',
    name: 'Neon Micro-Track',
    bgTop: '#04091a',
    bgBottom: '#0f172a',
    trackColor: '#0b152b',
    laneLine: 'rgba(56, 189, 248, 0.25)',
    borderColor: '#0284c7',
    accent: '#38bdf8'
  }
];

type TrackItemKind = 'brass_gear' | 'star_key' | 'boost_pad' | 'glue_puddle';

interface TrackItem {
  id: number;
  kind: TrackItemKind;
  x: number;
  y: number;
  radius: number;
  rot: number;
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

interface ToyRacerState {
  id: PlayerId;
  config: PlayerConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  keySpinAngle: number;
  score: number;
  lapsCompleted: number;
  isCharging: boolean;
  charge: number;
  wasPressed: boolean;
  pressDuration: number;
  overdriveTimer: number;
  glueTimer: number;
  underdogActive: boolean;
  lastProgressBucket: number;
}

export class CreepyDollCrawlGame extends BaseGame {
  private racers: Map<PlayerId, ToyRacerState> = new Map();
  private items: TrackItem[] = [];
  private popups: FloatingPopup[] = [];
  private fxParticles: SparkParticle[] = [];

  private roundDuration = 48;
  private elapsed = 0;
  private isOver = false;
  private suddenDeath = false;
  private nextItemId = 1;
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
    this.racers.clear();
    this.items = [];
    this.popups = [];
    this.fxParticles = [];
    this.screenShake = 0;

    this.roundTimer = this.roundDuration;
    this.elapsed = 0;
    this.isOver = false;
    this.suddenDeath = false;
    this.nextItemId = 1;

    const topY = 128;
    const botY = height - 115;
    const spanY = botY - topY;
    const count = Math.max(1, this.players.length);

    this.players.forEach((p, idx) => {
      const sy = topY + ((idx + 0.5) / count) * spanY;
      this.racers.set(p.id, {
        id: p.id,
        config: p,
        x: 92,
        y: sy,
        vx: 95,
        vy: 0,
        keySpinAngle: 0,
        score: 0,
        lapsCompleted: 0,
        isCharging: false,
        charge: 0,
        wasPressed: false,
        pressDuration: 0,
        overdriveTimer: 0,
        glueTimer: 0,
        underdogActive: false,
        lastProgressBucket: 0
      });
    });

    this.populateTrackItems(width, height);
  }

  private populateTrackItems(width: number, height: number): void {
    this.items = [];
    for (let i = 0; i < 14; i++) {
      this.spawnTrackItem(width, height);
    }
  }

  private spawnTrackItem(width: number, height: number): void {
    const roll = Math.random();
    let kind: TrackItemKind = 'brass_gear';
    if (roll < (this.suddenDeath ? 0.35 : 0.18)) kind = 'star_key';
    else if (roll < 0.44) kind = 'boost_pad';
    else if (roll < 0.62) kind = 'glue_puddle';

    this.items.push({
      id: this.nextItemId++,
      kind,
      x: 155 + Math.random() * (width - 285),
      y: 122 + Math.random() * (height - 235),
      radius: kind === 'glue_puddle' ? 24 : 16,
      rot: Math.random() * Math.PI * 2
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
      this.spawnPopup(width * 0.5, 114, 'SUDDEN DEATH! GOLDEN STAR KEYS!', '#facc15');
      for (let i = 0; i < 4; i++) {
        this.spawnTrackItem(width, height);
      }
    }

    if (this.roundTimer <= 0) {
      this.isOver = true;
      return;
    }

    let maxScore = 0;
    this.racers.forEach((r) => {
      if (r.score > maxScore) maxScore = r.score;
    });
    this.racers.forEach((r) => {
      r.underdogActive = maxScore - r.score >= 55;
    });

    this.updateBots(safeDt, width, height);

    const startX = 92;
    const finishX = width - 92;

    this.racers.forEach((r) => {
      if (r.overdriveTimer > 0) r.overdriveTimer = Math.max(0, r.overdriveTimer - safeDt);
      if (r.glueTimer > 0) r.glueTimer = Math.max(0, r.glueTimer - safeDt);

      const steerX = this.input.getSteer(r.id);
      const steerY = -this.input.getThrottle(r.id);
      const pressed = this.input.isPressed(r.id);

      // Hold-to-Wind Mainspring vs Quick Tap Hop-Boost
      if (!r.config.type.startsWith('bot_')) {
        if (pressed) {
          r.pressDuration += safeDt;
          r.isCharging = true;
          r.charge = Math.min(1, r.charge + safeDt * 0.92);
          r.keySpinAngle -= safeDt * 14;
        } else {
          if (r.wasPressed) {
            this.releaseMainspring(r);
          }
          r.isCharging = false;
          r.charge = 0;
          r.pressDuration = 0;
        }
        r.wasPressed = pressed;

        // Vertical lane weaving works via Up/Down OR Left/Right steering!
        let laneSteer = Math.abs(steerY) > 0.08 ? steerY : steerX;
        if (Math.abs(laneSteer) < 0.06) {
          // Auto-weave slightly toward nearest Brass Gear or Star Key ahead
          const bestY = this.findBestLaneY(r);
          const dy = bestY - r.y;
          if (Math.abs(dy) > 10) {
            laneSteer = Math.max(-0.65, Math.min(0.65, dy / 75));
          }
        }

        r.vy += laneSteer * 1080 * safeDt;
        if (steerX > 0.1) {
          r.vx += steerX * 420 * safeDt;
        }
      }

      // Baseline clockwork forward cruise so toys are never stuck still
      const baseCruise = r.isCharging ? 65 : 155 * (r.underdogActive ? 1.2 : 1.0);
      if (r.vx < baseCruise) {
        r.vx += (baseCruise - r.vx) * 4.5 * safeDt;
      }

      const glueFactor = r.glueTimer > 0 && r.overdriveTimer <= 0 ? 0.52 : 1.0;
      r.vx *= Math.pow(0.18, safeDt);
      r.vy *= Math.pow(0.02, safeDt);

      r.x += r.vx * glueFactor * safeDt;
      r.y += r.vy * glueFactor * safeDt;
      r.keySpinAngle += r.vx * 0.025 * safeDt;

      r.y = Math.max(114, Math.min(height - 96, r.y));
      r.x = Math.max(64, r.x);

      // Incremental distance points
      const ratio = Math.max(0, Math.min(1, (r.x - startX) / Math.max(1, finishX - startX)));
      const bucket = Math.floor(ratio * 5);
      if (bucket > r.lastProgressBucket) {
        r.score += (bucket - r.lastProgressBucket) * 5;
        r.lastProgressBucket = bucket;
      }

      // Track Item interactions
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        if (Math.hypot(it.x - r.x, it.y - r.y) <= it.radius + 24) {
          if (it.kind === 'glue_puddle') {
            if (r.overdriveTimer <= 0 && r.glueTimer <= 0) {
              r.glueTimer = 0.85;
              r.vx *= 0.45;
              this.spawnPopup(r.x, r.y - 26, 'STICKY PAINT!', '#c084fc');
            }
          } else if (it.kind === 'boost_pad') {
            r.vx = Math.max(r.vx, 480);
            r.overdriveTimer = Math.max(r.overdriveTimer, 0.45);
            r.score += 15;
            this.spawnParticles(it.x, it.y, '#38bdf8', 12);
            this.spawnPopup(r.x, r.y - 24, 'TURBO PAD! +15', '#38bdf8');
          } else {
            const basePts = it.kind === 'star_key' ? 50 : 25;
            const pts = Math.round(basePts * (r.underdogActive ? 1.25 : 1));
            r.score += pts;
            if (it.kind === 'star_key') {
              r.vx = Math.max(r.vx, 460);
              r.overdriveTimer = 0.5;
            }
            this.spawnParticles(it.x, it.y, '#facc15', 14);
            this.spawnPopup(it.x, it.y - 22, `+${pts}`, '#facc15');
            this.items.splice(i, 1);
            this.spawnTrackItem(width, height);
          }
        }
      }

      // Cross Finish Ribbon -> Score Lap Jackpot and loop to start for continuous racing!
      if (r.x >= finishX) {
        const lapBonus = Math.round((this.suddenDeath ? 95 : 70) * (r.underdogActive ? 1.25 : 1));
        r.score += lapBonus;
        r.lapsCompleted++;
        r.lastProgressBucket = 0;
        this.triggerScreenShake(6);
        this.spawnParticles(finishX, r.y, '#facc15', 26);
        this.spawnPopup(finishX - 40, r.y - 28, `LAP COMPLETE! +${lapBonus}`, '#facc15');
        r.x = startX;
      }
    });

    // Elastic player-to-player collisions
    const list = Array.from(this.racers.values());
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
            p1.vx -= p * nx * 1.15 - nx * 40;
            p1.vy -= p * ny * 1.15 - ny * 40;
            p2.vx += p * nx * 1.15 + nx * 40;
            p2.vy += p * ny * 1.15 + ny * 40;
            this.triggerScreenShake(3);
            this.spawnParticles((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#facc15', 8);
          }
        }
      }
    }

    for (const it of this.items) {
      if (it.kind === 'brass_gear' || it.kind === 'star_key') {
        it.rot += safeDt * 3.2;
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

  private findBestLaneY(r: ToyRacerState): number {
    let bestY = r.y;
    let bestDist = 1e9;
    for (const it of this.items) {
      if (it.kind === 'glue_puddle') continue;
      if (it.x > r.x + 10 && it.x < r.x + 260) {
        const d = Math.hypot(it.x - r.x, it.y - r.y) - (it.kind === 'star_key' ? 80 : 0);
        if (d < bestDist) {
          bestDist = d;
          bestY = it.y;
        }
      }
    }
    return bestY;
  }

  private releaseMainspring(r: ToyRacerState): void {
    const isSweetSpot = r.charge >= 0.72 && r.charge <= 0.98;
    const boost = isSweetSpot ? 680 : 340 + r.charge * 220;
    r.vx = Math.max(r.vx, boost);
    r.overdriveTimer = isSweetSpot ? 0.65 : 0.28;
    r.glueTimer = 0;

    this.triggerScreenShake(isSweetSpot ? 5 : 2);
    this.spawnParticles(r.x - 16, r.y, isSweetSpot ? '#facc15' : r.config.color, isSweetSpot ? 20 : 10);

    if (isSweetSpot) {
      r.score += 15;
      this.spawnPopup(r.x, r.y - 34, 'MAINSPRING OVERDRIVE! +15', '#facc15');

      // Shunt nearby rival toy racers sideways!
      this.racers.forEach((other) => {
        if (other.id === r.id) return;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d <= 140) {
          other.vy += (dy >= 0 ? 1 : -1) * 420;
          other.vx -= 140;
          this.spawnPopup(other.x, other.y - 26, 'SONIC GEAR SHUNT!', '#fb923c');
        }
      });
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.racers.get(botId);
    if (!bot) return;

    const targetY = this.findBestLaneY(bot);
    const dy = targetY - bot.y;
    const skill = difficulty === 'bot_hard' ? 1.0 : difficulty === 'bot_normal' ? 0.82 : 0.65;
    bot.vy += Math.max(-1, Math.min(1, dy / 65)) * 950 * skill * dt;

    if (!bot.isCharging && bot.overdriveTimer <= 0 && Math.random() < dt * 2.2) {
      bot.isCharging = true;
      bot.charge = 0;
    }

    if (bot.isCharging) {
      bot.charge += dt * 0.92;
      const targetCharge =
        difficulty === 'bot_hard' ? 0.84 : difficulty === 'bot_normal' ? 0.76 : 0.55;
      if (bot.charge >= targetCharge) {
        this.releaseMainspring(bot);
        bot.isCharging = false;
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

    // 1. Background & Toymaker Workbench Track
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.trackColor;
    ctx.beginPath();
    ctx.roundRect(42, 96, width - 84, height - 172, 24);
    ctx.fill();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Checkered Finish Line on Right
    const finishX = width - 92;
    for (let row = 0; row < 12; row++) {
      const sy = 102 + row * ((height - 184) / 12);
      ctx.fillStyle = row % 2 === 0 ? '#f8fafc' : '#0f172a';
      ctx.fillRect(finishX - 10, sy, 10, (height - 184) / 12);
      ctx.fillStyle = row % 2 === 1 ? '#f8fafc' : '#0f172a';
      ctx.fillRect(finishX, sy, 10, (height - 184) / 12);
    }

    // 2. Track Items
    for (const it of this.items) {
      this.drawTrackItem(ctx, it);
    }

    // 3. Wind-Up Toy Racers sorted by Y
    const sorted = Array.from(this.racers.values()).sort((a, b) => a.y - b.y);
    for (const r of sorted) {
      this.drawToyRacer(ctx, r);
    }

    // 4. Particles & Popups
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

    // 5. HUD
    this.drawHUD(ctx, width, height, theme);

    ctx.restore();
  }

  private drawTrackItem(ctx: CanvasRenderingContext2D, it: TrackItem): void {
    ctx.save();
    ctx.translate(it.x, it.y);

    if (it.kind === 'glue_puddle') {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.55)';
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (it.kind === 'boost_pad') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-18, -12, 36, 24, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#bae6fd';
      ctx.font = '900 13px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('>>', 0, 5);
    } else {
      ctx.rotate(it.rot);
      ctx.fillStyle = it.kind === 'star_key' ? '#fde047' : '#f59e0b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, it.kind === 'star_key' ? 16 : 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawToyRacer(ctx: CanvasRenderingContext2D, r: ToyRacerState): void {
    ctx.save();

    if (r.underdogActive) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 30 + Math.sin(this.elapsed * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Brass Wind-Up Key spinning behind the Toy Kart
    ctx.save();
    ctx.translate(r.x - 24, r.y);
    ctx.rotate(Math.sin(r.keySpinAngle) * 0.45);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-12, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-15, -6, 5, 0, Math.PI * 2);
    ctx.arc(-15, 6, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Brass Toy Kart Chassis & Wheels
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(r.x - 12, r.y + 16, 7, 0, Math.PI * 2);
    ctx.arc(r.x + 12, r.y + 16, 7, 0, Math.PI * 2);
    ctx.fill();

    // 2.5D Mascot Pilot
    const mood: CharacterMood = r.glueTimer > 0 ? 'shocked' : r.isCharging || r.overdriveTimer > 0 ? 'triumph' : 'focused';
    this.drawPlayerMascot(ctx, r.id, r.x, r.y, 21, mood, this.elapsed, 0);

    // Hold-to-Wind Mainspring Sweet-Spot Gauge (72% - 98%)
    if (r.isCharging && r.charge > 0.05) {
      const sweet = r.charge >= 0.72 && r.charge <= 0.98;
      ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 31, -Math.PI * 0.5, -Math.PI * 0.5 + r.charge * Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3;
    ctx.strokeText(r.config.name, r.x, r.y + 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(r.config.name, r.x, r.y + 36);

    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: ToyDerbyTheme): void {
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
        ? `⚡ SUDDEN DEATH TOY DERBY • ${timeStr} ⚡`
        : `CLOCKWORK TOY DERBY • ${timeStr}`,
      width * 0.5,
      71
    );

    const cardW = 168;
    const cardH = 66;
    const players = Array.from(this.racers.values());
    players.forEach((r, idx) => {
      const cardX = idx % 2 === 0 ? 20 : width - cardW - 20;
      const cardY = idx < 2 ? height - 128 : 54;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = r.config.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = r.config.color;
      ctx.font = '800 13px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(r.config.name, cardX + 12, cardY + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px "Outfit", sans-serif';
      ctx.fillText(`${r.score} PTS`, cardX + 12, cardY + 46);

      ctx.fillStyle = '#fde047';
      ctx.font = '700 11px "Outfit", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`LAPS: ${r.lapsCompleted}`, cardX + cardW - 12, cardY + 22);
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
    return this.racers.get(playerId)?.score ?? 0;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.racers.values()).sort((a, b) => b.score - a.score);
    const rankings = sorted.map((r, idx) => ({
      playerId: r.id,
      score: r.score,
      place: idx + 1
    }));
    const isTie = sorted.length >= 2 && sorted[0].score === sorted[1].score;
    const winnerId = isTie || sorted.length === 0 ? null : sorted[0].id;
    return {
      winnerId,
      rankings,
      mvpHighlight: sorted[0]
        ? `${sorted[0].config.name} completed ${sorted[0].lapsCompleted} laps (${sorted[0].score} pts)!`
        : 'Toy Derby Complete!'
    };
  }
}
