import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

/**
 * [G-241] Gargoyle Stone Stare (Cathedral Belfry Freeze & Vault)
 * Overhauled according to the 8 Pillars of Fun & Double-Review Control Fix:
 * - Fixed the broken control bug where pressing Action or Left/Right marked `isMoving = true` without climbing!
 * - Intuitive Universal Controls:
 *   * Steer (Up/Down/Left/Right) OR Tap/Hold Action: Climb up the shared Cathedral Belfry roof and weave toward
 *     floating Moonlit Relics (+20 pts), Golden Bell Chimes (+45 pts), and the Grand Summit Bell (+75 pts)!
 *   * Release All Inputs: Instantly freeze into an indestructible Granite Statue! While petrified in stone, you are
 *     100% immune to the Sentinel Gargoyle's Crimson Gaze AND act as a heavy stone bumper against rivals!
 *   * Hold-to-Charge Stone-Quake Vault & Belfry Shunt (72%–98% sweet-spot): Releasing a charged leap vaults you
 *     rapidly up the slate tiles and sends out a shockwave that shunts nearby rivals sideways!
 * - Full elastic player-to-player collisions (m1*v1 + m2*v2) on the shared rooftop.
 * - 3 swappable visual themes (`notre_dame`, `griffin_citadel`, `cyber_belfry`) via [T]/[1-3] or Theme Pill.
 */

type BelfryThemeId = 'notre_dame' | 'griffin_citadel' | 'cyber_belfry';

interface BelfryTheme {
  id: BelfryThemeId;
  name: string;
  skyTop: string;
  skyBottom: string;
  moonColor: string;
  roofBase: string;
  roofTileStroke: string;
  gargoyleStone: string;
  gazeSafe: string;
  gazeWarn: string;
  gazeStare: string;
  accent: string;
}

const THEMES: BelfryTheme[] = [
  {
    id: 'notre_dame',
    name: 'Moonlit Belfry',
    skyTop: '#090d1a',
    skyBottom: '#1e1b4b',
    moonColor: '#fef08a',
    roofBase: '#1e293b',
    roofTileStroke: 'rgba(148, 163, 184, 0.2)',
    gargoyleStone: '#64748b',
    gazeSafe: '#10b981',
    gazeWarn: '#f59e0b',
    gazeStare: '#ef4444',
    accent: '#fbbf24'
  },
  {
    id: 'griffin_citadel',
    name: 'Griffin Spire',
    skyTop: '#160f29',
    skyBottom: '#3b1d5e',
    moonColor: '#fed7aa',
    roofBase: '#271c3a',
    roofTileStroke: 'rgba(216, 180, 254, 0.18)',
    gargoyleStone: '#78716c',
    gazeSafe: '#34d399',
    gazeWarn: '#fbbf24',
    gazeStare: '#f43f5e',
    accent: '#c084fc'
  },
  {
    id: 'cyber_belfry',
    name: 'Neon Clock Spire',
    skyTop: '#030712',
    skyBottom: '#0f172a',
    moonColor: '#38bdf8',
    roofBase: '#0f172a',
    roofTileStroke: 'rgba(56, 189, 248, 0.22)',
    gargoyleStone: '#334155',
    gazeSafe: '#22d3ee',
    gazeWarn: '#facc15',
    gazeStare: '#fb7185',
    accent: '#38bdf8'
  }
];

interface RoofRelic {
  id: number;
  x: number;
  y: number;
  kind: 'silver_crest' | 'golden_chime';
  bobPhase: number;
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

interface ClimberState {
  id: PlayerId;
  config: PlayerConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  bellsRung: number;
  isStoneStatue: boolean;
  isCharging: boolean;
  charge: number;
  wasPressed: boolean;
  pressDuration: number;
  vaultTimer: number;
  shuntCooldown: number;
  zappedTimer: number;
  underdogActive: boolean;
  lastProgressBucket: number;
  botPauseTimer: number;
}

export class GargoyleStoneStareGame extends BaseGame {
  private climbers: Map<PlayerId, ClimberState> = new Map();
  private relics: RoofRelic[] = [];
  private popups: FloatingPopup[] = [];
  private fxParticles: SparkParticle[] = [];

  private sentinelState: 'slumber' | 'stirring' | 'staring' = 'slumber';
  private sentinelTimer = 2.8;
  private gazeSweepAngle = 0;
  private bellSwing = 0;

  private roundDuration = 48;
  private elapsed = 0;
  private isOver = false;
  private suddenDeath = false;
  private nextRelicId = 1;
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
      this.screenShake *= 0.88;
    } else {
      this.screenShake = 0;
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
    this.climbers.clear();
    this.relics = [];
    this.popups = [];
    this.fxParticles = [];

    this.sentinelState = 'slumber';
    this.sentinelTimer = 2.8;
    this.gazeSweepAngle = 0;
    this.bellSwing = 0;

    this.roundTimer = this.roundDuration;
    this.elapsed = 0;
    this.isOver = false;
    this.suddenDeath = false;
    this.nextRelicId = 1;

    const count = Math.max(1, this.getActivePlayers().length);
    const roofLeft = width * 0.22;
    const roofRight = width * 0.78;
    const span = roofRight - roofLeft;
    const startY = height - 92;

    const activePlayers = this.getActivePlayers();
    activePlayers.forEach((p, idx) => {
      const sx = roofLeft + ((idx + 0.5) / count) * span;
      this.climbers.set(p.id, {
        id: p.id,
        config: p,
        x: sx,
        y: startY,
        vx: 0,
        vy: 0,
        score: 0,
        bellsRung: 0,
        isStoneStatue: true,
        isCharging: false,
        charge: 0,
        wasPressed: false,
        pressDuration: 0,
        vaultTimer: 0,
        shuntCooldown: 0,
        zappedTimer: 0,
        underdogActive: false,
        lastProgressBucket: 0,
        botPauseTimer: 0
      });
    });

    for (let i = 0; i < 9; i++) {
      this.spawnRelic(width, height);
    }
  }

  private spawnRelic(width: number, height: number): void {
    const x = width * 0.19 + Math.random() * (width * 0.62);
    const y = 175 + Math.random() * (height - 295);
    const isGolden = Math.random() < (this.suddenDeath ? 0.45 : 0.26);
    this.relics.push({
      id: this.nextRelicId++,
      x,
      y,
      kind: isGolden ? 'golden_chime' : 'silver_crest',
      bobPhase: Math.random() * Math.PI * 2
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
      this.spawnPopup(width * 0.5, 118, 'SUDDEN DEATH! 2X GOLDEN BELL CHIMES!', '#facc15');
      for (let i = 0; i < 4; i++) {
        this.spawnRelic(width, height);
      }
    }

    if (this.roundTimer <= 0) {
      this.isOver = true;
      return;
    }

    this.bellSwing *= Math.pow(0.08, safeDt);

    // Sentinel Gargoyle state machine
    this.sentinelTimer -= safeDt;
    if (this.sentinelTimer <= 0) {
      if (this.sentinelState === 'slumber') {
        this.sentinelState = 'stirring';
        this.sentinelTimer = this.suddenDeath ? 0.85 : 1.05;
      } else if (this.sentinelState === 'stirring') {
        this.sentinelState = 'staring';
        this.sentinelTimer = this.suddenDeath ? 1.35 : 1.65;
        this.triggerScreenShake(3);
      } else {
        this.sentinelState = 'slumber';
        this.sentinelTimer = (this.suddenDeath ? 1.6 : 2.2) + Math.random() * 1.1;
      }
    }

    if (this.sentinelState === 'staring') {
      this.gazeSweepAngle = Math.sin(this.elapsed * 3.8) * 0.55;
    }

    // Underdog detection
    let maxScore = 0;
    this.climbers.forEach((c) => {
      if (c.score > maxScore) maxScore = c.score;
    });
    this.climbers.forEach((c) => {
      c.underdogActive = maxScore - c.score >= 55;
    });

    // Update Bots
    this.updateBots(safeDt, width, height);

    const summitY = 148;
    const startY = height - 92;

    // Update Climbers
    this.climbers.forEach((c) => {
      if (c.shuntCooldown > 0) c.shuntCooldown = Math.max(0, c.shuntCooldown - safeDt);
      if (c.vaultTimer > 0) c.vaultTimer = Math.max(0, c.vaultTimer - safeDt);
      if (c.zappedTimer > 0) c.zappedTimer = Math.max(0, c.zappedTimer - safeDt);

      if (!c.config.type.startsWith('bot_')) {
        const steerX = this.input.getSteer(c.id);
        const throttle = this.input.getThrottle(c.id); // +1 up, -1 down
        const pressed = this.input.isPressed(c.id);

        // Hold-to-charge Stone-Quake Vault
        if (pressed) {
          c.pressDuration += safeDt;
          if (c.pressDuration > 0.18) {
            c.isCharging = true;
            c.charge = Math.min(1, c.charge + safeDt * 0.9);
          }
        } else {
          if (c.wasPressed && c.isCharging && c.charge >= 0.4) {
            this.executeStoneQuakeVault(c, width, height);
          }
          c.isCharging = false;
          c.charge = 0;
          c.pressDuration = 0;
        }
        c.wasPressed = pressed;

        // Determine climbing & horizontal movement:
        // Players climb whenever they press Up, press Action, OR steer Left/Right!
        // Releasing all controls freezes them solid into a Granite Statue!
        const hasDirectional = Math.abs(steerX) > 0.08 || Math.abs(throttle) > 0.08;
        const wantsToMove = (hasDirectional || pressed) && c.zappedTimer <= 0;

        if (wantsToMove) {
          c.isStoneStatue = false;
          const speedMult = (c.underdogActive ? 1.22 : 1.0) * (c.isCharging ? 0.65 : 1.0);
          let moveX = steerX;
          let moveY = -throttle; // Up is negative Y

          // If player is using 1-button (pressing Action without Up/Down) or steering only Left/Right,
          // automatically advance upward toward the nearest relic or the Summit Bell!
          if (Math.abs(throttle) < 0.08) {
            moveY = -0.88;
            if (Math.abs(moveX) < 0.08) {
              // Gently steer toward nearest relic above or summit bell center
              const targetX = this.findBestLaneTargetX(c, width);
              const dx = targetX - c.x;
              if (Math.abs(dx) > 10) {
                moveX = Math.max(-0.65, Math.min(0.65, dx / 90));
              }
            }
          }

          c.vx += moveX * 1150 * speedMult * safeDt;
          c.vy += moveY * 1050 * speedMult * safeDt;
        } else if (c.vaultTimer <= 0) {
          // Released all controls -> Petrify into an immovable Granite Statue!
          c.isStoneStatue = true;
          c.vx *= Math.pow(0.0005, safeDt);
          c.vy *= Math.pow(0.0005, safeDt);
        }
      }

      // Apply drag & velocity
      const drag = c.isStoneStatue && c.vaultTimer <= 0 ? Math.pow(0.001, safeDt) : Math.pow(0.025, safeDt);
      c.vx *= drag;
      c.vy *= drag;

      c.x += c.vx * safeDt;
      c.y += c.vy * safeDt;

      // Keep inside Cathedral Roof bounds
      const minX = width * 0.16;
      const maxX = width * 0.84;
      if (c.x < minX) { c.x = minX; c.vx = Math.abs(c.vx) * 0.5; }
      if (c.x > maxX) { c.x = maxX; c.vx = -Math.abs(c.vx) * 0.5; }
      if (c.y > startY) { c.y = startY; c.vy = 0; }

      // Sentinel Gargoyle Stare Check:
      // If Sentinel is staring and player is NOT a Stone Statue (i.e. actively moving), zap them back down!
      const speedMag = Math.hypot(c.vx, c.vy);
      if (this.sentinelState === 'staring' && !c.isStoneStatue && speedMag > 42 && c.zappedTimer <= 0) {
        c.zappedTimer = 0.75;
        c.isStoneStatue = true;
        c.isCharging = false;
        c.charge = 0;
        c.vy = 480;
        c.y = Math.min(startY, c.y + 115);
        this.triggerScreenShake(6);
        this.spawnParticles(c.x, c.y, '#ef4444', 18);
        this.spawnPopup(c.x, c.y - 26, 'SPOTTED BY GARGOYLE!', '#ef4444');
      }

      // Incremental Climb Progress Points
      const climbRatio = Math.max(0, Math.min(1, (startY - c.y) / Math.max(1, startY - summitY)));
      const bucket = Math.floor(climbRatio * 6);
      if (bucket > c.lastProgressBucket) {
        const diff = bucket - c.lastProgressBucket;
        c.lastProgressBucket = bucket;
        c.score += diff * 5;
      }

      // Collect Relics on the roof
      for (let i = this.relics.length - 1; i >= 0; i--) {
        const rel = this.relics[i];
        if (Math.hypot(rel.x - c.x, rel.y - c.y) <= 36) {
          const basePts = rel.kind === 'golden_chime' ? 45 : 20;
          const pts = Math.round(basePts * (c.underdogActive ? 1.25 : 1));
          c.score += pts;
          this.spawnParticles(rel.x, rel.y, rel.kind === 'golden_chime' ? '#facc15' : '#38bdf8', 12);
          this.spawnPopup(rel.x, rel.y - 20, `+${pts}`, rel.kind === 'golden_chime' ? '#facc15' : '#bae6fd');
          this.relics.splice(i, 1);
          this.spawnRelic(width, height);
        }
      }

      // Ring the Grand Summit Bell!
      if (c.y <= summitY) {
        const bellBonus = Math.round((this.suddenDeath ? 110 : 75) * (c.underdogActive ? 1.25 : 1));
        c.score += bellBonus;
        c.bellsRung++;
        c.lastProgressBucket = 0;
        this.bellSwing = 1.0;
        this.triggerScreenShake(7);
        this.spawnParticles(width * 0.5, summitY - 20, '#facc15', 28);
        this.spawnPopup(c.x, summitY, `BELL RUNG! +${bellBonus}`, '#facc15');
        // Reset climber to bottom roof ledge for another ascent run!
        c.y = startY;
        c.vy = 0;
        c.isStoneStatue = true;
      }
    });

    // Elastic player-to-player collisions (Petrified Stone Statues have 2.2x mass and deflect moving rivals!)
    const list = Array.from(this.climbers.values());
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
          const overlap = minDist - dist;

          const m1 = p1.isStoneStatue ? 2.2 : 1.0;
          const m2 = p2.isStoneStatue ? 2.2 : 1.0;
          const totalM = m1 + m2;

          p1.x -= nx * overlap * (m2 / totalM);
          p1.y -= ny * overlap * (m2 / totalM);
          p2.x += nx * overlap * (m1 / totalM);
          p2.y += ny * overlap * (m1 / totalM);

          const kx = p1.vx - p2.vx;
          const ky = p1.vy - p2.vy;
          const impact = nx * kx + ny * ky;
          if (impact > 0) {
            const impulse = (2 * impact) / totalM;
            p1.vx -= impulse * m2 * nx * 1.15;
            p1.vy -= impulse * m2 * ny * 1.15;
            p2.vx += impulse * m1 * nx * 1.15;
            p2.vy += impulse * m1 * ny * 1.15;
            this.triggerScreenShake(3);
            this.spawnParticles((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#cbd5e1', 7);
          }
        }
      }
    }

    // Animate relics, particles, popups
    for (const rel of this.relics) {
      rel.bobPhase += safeDt * 4;
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
  }

  private findBestLaneTargetX(c: ClimberState, width: number): number {
    let bestX = width * 0.5;
    let bestDist = 1e9;
    for (const rel of this.relics) {
      if (rel.y < c.y - 10 && rel.y > c.y - 210) {
        const d = Math.hypot(rel.x - c.x, rel.y - c.y);
        const bonus = rel.kind === 'golden_chime' ? -60 : 0;
        if (d + bonus < bestDist) {
          bestDist = d + bonus;
          bestX = rel.x;
        }
      }
    }
    return bestX;
  }

  private executeStoneQuakeVault(c: ClimberState, _width: number, _height: number): void {
    const isSweetSpot = c.charge >= 0.72 && c.charge <= 0.98;
    const leapVel = isSweetSpot ? -640 : -410;
    c.vy = leapVel;
    c.vaultTimer = isSweetSpot ? 0.36 : 0.22;
    c.shuntCooldown = 0.85;
    c.isStoneStatue = false;

    this.triggerScreenShake(isSweetSpot ? 6 : 3);
    this.spawnParticles(c.x, c.y, isSweetSpot ? '#facc15' : '#94a3b8', isSweetSpot ? 20 : 10);

    if (isSweetSpot) {
      c.score += 15;
      this.spawnPopup(c.x, c.y - 34, 'STONE-QUAKE VAULT! +15', '#facc15');
    }

    const radius = isSweetSpot ? 140 : 90;
    this.climbers.forEach((other) => {
      if (other.id === c.id) return;
      const dx = other.x - c.x;
      const dy = other.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= radius) {
        const nx = dx / d;
        const ny = dy / d;
        const push = isSweetSpot ? 480 : 280;
        other.vx += nx * push;
        other.vy += Math.max(80, ny * push);
        if (isSweetSpot) {
          this.spawnPopup(other.x, other.y - 26, 'BELFRY SHUNT!', '#fbbf24');
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const bot = this.climbers.get(botId);
    if (!bot || bot.zappedTimer > 0) return;

    const freezeThreshold =
      difficulty === 'bot_hard' ? 0.14 : difficulty === 'bot_normal' ? 0.28 : 0.45;

    const shouldFreeze =
      this.sentinelState === 'staring' ||
      (this.sentinelState === 'stirring' && this.sentinelTimer <= freezeThreshold);

    if (shouldFreeze) {
      // Easy bots occasionally react late
      if (difficulty === 'bot_easy' && this.sentinelState === 'staring' && Math.random() < dt * 0.65) {
        bot.isStoneStatue = false;
        bot.vy -= 420 * dt;
      } else {
        bot.isStoneStatue = true;
      }
      return;
    }

    bot.isStoneStatue = false;
    const skill = difficulty === 'bot_hard' ? 1.0 : difficulty === 'bot_normal' ? 0.84 : 0.68;
    const targetX = this.findBestLaneTargetX(bot, width);
    const dx = targetX - bot.x;
    const steerX = Math.max(-0.85, Math.min(0.85, dx / 75));

    bot.vx += steerX * 920 * skill * dt;
    bot.vy -= 980 * skill * dt;

    if (
      difficulty !== 'bot_easy' &&
      this.sentinelState === 'slumber' &&
      this.sentinelTimer > 1.1 &&
      bot.shuntCooldown <= 0 &&
      Math.random() < dt * 0.7
    ) {
      bot.charge = difficulty === 'bot_hard' ? 0.84 : 0.65;
      this.executeStoneQuakeVault(bot, width, height);
      bot.charge = 0;
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 155;
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

    // 1. Sky & Full Moon Backdrop
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.moonColor;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(width * 0.5, 118, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(width * 0.5, 118, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 2. Cathedral Belfry Slate Roof Perspective
    this.drawCathedralRoof(ctx, width, height, theme);

    // 3. Sentinel Gargoyle Gaze Cone
    this.drawGargoyleAndGaze(ctx, width, height, theme);

    // 4. Relics on the Roof
    for (const rel of this.relics) {
      const bob = Math.sin(rel.bobPhase) * 4;
      this.drawRelic(ctx, rel.x, rel.y + bob, rel.kind);
    }

    // 5. Climbers sorted by Y
    const sorted = Array.from(this.climbers.values()).sort((a, b) => a.y - b.y);
    for (const c of sorted) {
      this.drawClimber(ctx, c, theme);
    }

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

  private drawCathedralRoof(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: BelfryTheme
  ): void {
    const topLeft = width * 0.2;
    const topRight = width * 0.8;
    const botLeft = width * 0.12;
    const botRight = width * 0.88;
    const topY = 136;
    const botY = height - 68;

    ctx.fillStyle = theme.roofBase;
    ctx.beginPath();
    ctx.moveTo(topLeft, topY);
    ctx.lineTo(topRight, topY);
    ctx.lineTo(botRight, botY);
    ctx.lineTo(botLeft, botY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = theme.roofTileStroke;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Horizontal slate shingle rows
    for (let r = 1; r <= 9; r++) {
      const u = r / 10;
      const y = topY + (botY - topY) * u;
      const lx = topLeft + (botLeft - topLeft) * u;
      const rx = topRight + (botRight - topRight) * u;
      ctx.strokeStyle = theme.roofTileStroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(rx, y);
      ctx.stroke();
    }

    // Golden Summit Bell Goal Line
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.setLineDash([10, 6]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(topLeft + 10, 152);
    ctx.lineTo(topRight - 10, 152);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawGargoyleAndGaze(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: BelfryTheme
  ): void {
    const cx = width * 0.5;
    const gy = 118;

    // Gaze Cone when stirring or staring
    if (this.sentinelState !== 'slumber') {
      ctx.save();
      const coneColor = this.sentinelState === 'staring' ? theme.gazeStare : theme.gazeWarn;
      const grad = ctx.createLinearGradient(cx, gy, cx, height - 70);
      grad.addColorStop(0, this.sentinelState === 'staring' ? 'rgba(239, 68, 68, 0.36)' : 'rgba(245, 158, 11, 0.22)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0.03)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, gy + 12);
      ctx.lineTo(width * 0.14 + Math.sin(this.gazeSweepAngle) * 45, height - 68);
      ctx.lineTo(width * 0.86 + Math.sin(this.gazeSweepAngle) * 45, height - 68);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = coneColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Swinging Golden Belfry Bell behind Sentinel Gargoyle
    ctx.save();
    ctx.translate(cx, gy - 18);
    ctx.rotate(Math.sin(this.elapsed * 16) * this.bellSwing * 0.35);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, 20, Math.PI, 0);
    ctx.lineTo(24, 18);
    ctx.lineTo(-24, 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Stone Sentinel Gargoyle Bust
    ctx.save();
    ctx.translate(cx, gy + 12);

    // Wings
    ctx.fillStyle = theme.gargoyleStone;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-68, -26);
    ctx.lineTo(-54, 14);
    ctx.closePath();
    ctx.moveTo(18, 0);
    ctx.lineTo(68, -26);
    ctx.lineTo(54, 14);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Eyes
    const eyeColor =
      this.sentinelState === 'staring'
        ? theme.gazeStare
        : this.sentinelState === 'stirring'
          ? theme.gazeWarn
          : theme.gazeSafe;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-8, -2, this.sentinelState === 'slumber' ? 3 : 5.5, 0, Math.PI * 2);
    ctx.arc(8, -2, this.sentinelState === 'slumber' ? 3 : 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Status Banner right below Gargoyle
    const bannerText =
      this.sentinelState === 'staring'
        ? '👁️ CRIMSON STARE! RELEASE TO FREEZE! 👁️'
        : this.sentinelState === 'stirring'
          ? '⚠️ GARGOYLE STIRRING... PREPARE TO FREEZE! ⚠️'
          : '🟢 GARGOYLE SLUMBERING — CLIMB & VAULT! 🟢';
    ctx.font = '900 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 4;
    ctx.strokeText(bannerText, 0, 38);
    ctx.fillStyle = eyeColor;
    ctx.fillText(bannerText, 0, 38);

    ctx.restore();
  }

  private drawRelic(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    kind: 'silver_crest' | 'golden_chime'
  ): void {
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'golden_chime') {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -2, 10, Math.PI, 0);
      ctx.lineTo(13, 10);
      ctx.lineTo(-13, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawClimber(ctx: CanvasRenderingContext2D, c: ClimberState, _theme: BelfryTheme): void {
    ctx.save();

    if (c.underdogActive) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 29 + Math.sin(this.elapsed * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    const mood: CharacterMood = c.zappedTimer > 0 ? 'shocked' : c.isStoneStatue ? 'idle' : 'focused';
    this.drawPlayerMascot(ctx, c.id, c.x, c.y, 21, mood, this.elapsed);

    // Stone Statue Shield Ring when petrified
    if (c.isStoneStatue) {
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 25, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '800 10px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🗿 STONE', c.x, c.y - 28);
    }

    // Hold-to-Charge Stone-Quake Vault sweet-spot arc
    if (c.isCharging && c.charge > 0.08) {
      const sweet = c.charge >= 0.72 && c.charge <= 0.98;
      ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 31, -Math.PI * 0.5, -Math.PI * 0.5 + c.charge * Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3;
    ctx.strokeText(c.config.name, c.x, c.y + 35);
    ctx.fillStyle = c.config.color;
    ctx.fillText(c.config.name, c.x, c.y + 35);

    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: BelfryTheme): void {
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
        ? `⚡ SUDDEN DEATH BELFRY • ${timeStr} ⚡`
        : `GARGOYLE STONE STARE • ${timeStr}`,
      width * 0.5,
      71
    );

    const cardW = 168;
    const cardH = 66;
    const players = Array.from(this.climbers.values());
    players.forEach((c, idx) => {
      const cardX = idx % 2 === 0 ? 20 : width - cardW - 20;
      const cardY = idx < 2 ? height - 128 : 54;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = c.config.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = c.config.color;
      ctx.font = '800 13px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(c.config.name, cardX + 12, cardY + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px "Outfit", sans-serif';
      ctx.fillText(`${c.score} PTS`, cardX + 12, cardY + 46);

      ctx.fillStyle = '#fde047';
      ctx.font = '700 11px "Outfit", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🔔 x${c.bellsRung}`, cardX + cardW - 12, cardY + 22);
    });

    // Clickable Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
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
    return this.climbers.get(playerId)?.score ?? 0;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.climbers.values()).sort((a, b) => b.score - a.score);
    const rankings = sorted.map((c, idx) => ({
      playerId: c.id,
      score: c.score,
      place: idx + 1
    }));
    const isTie = sorted.length >= 2 && sorted[0].score === sorted[1].score;
    const winnerId = isTie || sorted.length === 0 ? null : sorted[0].id;
    return {
      winnerId,
      rankings,
      mvpHighlight: sorted[0]
        ? `${sorted[0].config.name} rang the Summit Bell ${sorted[0].bellsRung}x (${sorted[0].score} pts)!`
        : 'Cathedral Belfry Showdown!'
    };
  }
}
