import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

/**
 * [G-240] Cauldron Alchemy Brew (Royal Apothecary Cauldron Toss)
 * Overhauled according to the 8 Pillars of Fun:
 * - Replaced the unsteerable isolated box game with an active 2.5D Shared Royal Apothecary Arena!
 * - 2.5D Mascot Alchemists (`this.drawPlayerMascot`) sprint around the shared laboratory floor (`Steer: Run Lab`),
 *   snatch glowing ingredients (`Moonlight Shroom`, `Ruby Dragon Scale`, `Starlight Vial`, `Golden Phoenix Feather`),
 *   and toss/dunk them (`Tap` or run into Cauldron Ring) into the bubbling Grand Central Cauldron!
 * - Matching the active Recipe Order displayed above the cauldron awards a 2x Master Brew Bonus (+50 pts) and advances
 *   the recipe toward a Cauldron Fountain Jackpot; any ingredient dunk still awards +25 pts (and Golden Phoenix Feathers
 *   award +65 pts and count as a wildcard for any recipe step!).
 * - Full elastic player-to-player collisions (m1*v1 + m2*v2) that can pop carried ingredients loose, plus Hold-to-Charge
 *   Alchemical Vortex Dash & Potion Shunt (72%–98% sweet-spot) that launches you forward and knocks nearby rivals away!
 * - 3 swappable visual themes (`royal_apothecary`, `enchanted_greenhouse`, `cyber_biolab`) via [T]/[1-3] or Theme Pill.
 */

type BrewThemeId = 'royal_apothecary' | 'enchanted_greenhouse' | 'cyber_biolab';

interface BrewTheme {
  id: BrewThemeId;
  name: string;
  bgTop: string;
  bgBottom: string;
  floorColor: string;
  tileStroke: string;
  cauldronRim: string;
  cauldronBody: string;
  liquidBase: string;
  liquidGlow: string;
  accent: string;
}

const THEMES: BrewTheme[] = [
  {
    id: 'royal_apothecary',
    name: 'Royal Apothecary',
    bgTop: '#160c28',
    bgBottom: '#2d1846',
    floorColor: '#221336',
    tileStroke: 'rgba(192, 132, 252, 0.16)',
    cauldronRim: '#64748b',
    cauldronBody: '#1e293b',
    liquidBase: '#10b981',
    liquidGlow: '#6ee7b7',
    accent: '#c084fc'
  },
  {
    id: 'enchanted_greenhouse',
    name: 'Starlight Conservatory',
    bgTop: '#062026',
    bgBottom: '#0f393b',
    floorColor: '#0b2b2e',
    tileStroke: 'rgba(52, 211, 153, 0.18)',
    cauldronRim: '#d97706',
    cauldronBody: '#451a03',
    liquidBase: '#38bdf8',
    liquidGlow: '#bae6fd',
    accent: '#34d399'
  },
  {
    id: 'cyber_biolab',
    name: 'Neon Bio-Synth Lab',
    bgTop: '#050816',
    bgBottom: '#0f172a',
    floorColor: '#091024',
    tileStroke: 'rgba(56, 189, 248, 0.2)',
    cauldronRim: '#38bdf8',
    cauldronBody: '#0f172a',
    liquidBase: '#f43f5e',
    liquidGlow: '#fda4af',
    accent: '#22d3ee'
  }
];

type IngredientKind = 'shroom' | 'scale' | 'vial' | 'feather';

interface IngredientMeta {
  kind: IngredientKind;
  label: string;
  color: string;
  glow: string;
  basePts: number;
}

const INGREDIENT_META: Record<IngredientKind, IngredientMeta> = {
  shroom: {
    kind: 'shroom',
    label: 'Moon Shroom',
    color: '#a855f7',
    glow: '#e9d5ff',
    basePts: 25
  },
  scale: {
    kind: 'scale',
    label: 'Dragon Scale',
    color: '#ef4444',
    glow: '#fecaca',
    basePts: 25
  },
  vial: {
    kind: 'vial',
    label: 'Starlight Vial',
    color: '#38bdf8',
    glow: '#bae6fd',
    basePts: 25
  },
  feather: {
    kind: 'feather',
    label: 'Golden Feather',
    color: '#facc15',
    glow: '#fef08a',
    basePts: 65
  }
};

interface FloorIngredient {
  id: number;
  kind: IngredientKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bobPhase: number;
  pickupCooldown: number;
}

interface ThrownIngredient {
  ownerId: PlayerId;
  ownerColor: string;
  kind: IngredientKind;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
}

interface CauldronBubble {
  rx: number;
  ry: number;
  r: number;
  phase: number;
  speed: number;
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

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface AlchemistState {
  id: PlayerId;
  config: PlayerConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  score: number;
  brewsCompleted: number;
  carrying: IngredientKind | null;
  charge: number;
  isCharging: boolean;
  wasPressed: boolean;
  pressDuration: number;
  dashTimer: number;
  shuntCooldown: number;
  stunTimer: number;
  underdogActive: boolean;
  autoOrbitAngle: number;
}

export class CauldronWitchBrewGame extends BaseGame {
  private alchemists: Map<PlayerId, AlchemistState> = new Map();
  private floorIngredients: FloorIngredient[] = [];
  private thrownIngredients: ThrownIngredient[] = [];
  private bubbles: CauldronBubble[] = [];
  private popups: FloatingPopup[] = [];
  private fxParticles: BurstParticle[] = [];

  private recipeQueue: IngredientKind[] = ['shroom', 'scale', 'vial'];
  private recipeStep = 0;
  private cauldronPulse = 0;
  private cauldronColor = '#10b981';

  private roundDuration = 50;
  private elapsed = 0;
  private isOver = false;
  private suddenDeath = false;
  private nextIngId = 1;
  private spawnClock = 0;
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
    this.alchemists.clear();
    this.floorIngredients = [];
    this.thrownIngredients = [];
    this.bubbles = [];
    this.popups = [];
    this.fxParticles = [];

    this.roundTimer = this.roundDuration;
    this.elapsed = 0;
    this.isOver = false;
    this.suddenDeath = false;
    this.nextIngId = 1;
    this.spawnClock = 0;
    this.cauldronPulse = 0;
    this.cauldronColor = THEMES[this.themeIndex].liquidBase;

    this.generateNewRecipe();

    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const dist = 12 + (i % 4) * 14;
      this.bubbles.push({
        rx: Math.cos(ang) * dist,
        ry: Math.sin(ang) * dist * 0.65,
        r: 4 + (i % 4) * 2.5,
        phase: i * 0.7,
        speed: 2.2 + (i % 3) * 0.8
      });
    }

    const cx = width * 0.5;
    const cy = height * 0.54;
    const activePlayers = this.getActivePlayers();
    const count = Math.max(1, activePlayers.length);

    activePlayers.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2 + Math.PI * 0.25;
      const sx = cx + Math.cos(angle) * 185;
      const sy = cy + Math.sin(angle) * 125;
      this.alchemists.set(p.id, {
        id: p.id,
        config: p,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        facingX: -Math.cos(angle),
        facingY: -Math.sin(angle),
        score: 0,
        brewsCompleted: 0,
        carrying: null,
        charge: 0,
        isCharging: false,
        wasPressed: false,
        pressDuration: 0,
        dashTimer: 0,
        shuntCooldown: 0,
        stunTimer: 0,
        underdogActive: false,
        autoOrbitAngle: angle
      });
    });

    // Spawn initial rich wave of ingredients around the shared laboratory
    for (let i = 0; i < 11; i++) {
      this.spawnIngredient(width, height, i < 3 ? this.recipeQueue[i] : undefined);
    }
  }

  private generateNewRecipe(): void {
    const basePool: IngredientKind[] = ['shroom', 'scale', 'vial'];
    this.recipeQueue = [
      basePool[Math.floor(Math.random() * basePool.length)],
      basePool[Math.floor(Math.random() * basePool.length)],
      basePool[Math.floor(Math.random() * basePool.length)]
    ];
    this.recipeStep = 0;
  }

  private spawnIngredient(width: number, height: number, forcedKind?: IngredientKind): void {
    const cx = width * 0.5;
    const cy = height * 0.54;
    const angle = Math.random() * Math.PI * 2;
    const radiusX = 135 + Math.random() * Math.max(90, width * 0.34 - 135);
    const radiusY = 95 + Math.random() * Math.max(60, height * 0.31 - 95);

    let kind: IngredientKind = forcedKind ?? 'shroom';
    if (!forcedKind) {
      const needed = this.recipeQueue[this.recipeStep] ?? 'shroom';
      const roll = Math.random();
      if (roll < 0.16 || (this.suddenDeath && roll < 0.32)) {
        kind = 'feather';
      } else if (roll < 0.52) {
        kind = needed;
      } else {
        const pool: IngredientKind[] = ['shroom', 'scale', 'vial'];
        kind = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    const x = Math.max(64, Math.min(width - 64, cx + Math.cos(angle) * radiusX));
    const y = Math.max(118, Math.min(height - 96, cy + Math.sin(angle) * radiusY));

    this.floorIngredients.push({
      id: this.nextIngId++,
      kind,
      x,
      y,
      vx: (Math.random() - 0.5) * 35,
      vy: (Math.random() - 0.5) * 35,
      bobPhase: Math.random() * Math.PI * 2,
      pickupCooldown: 0.15
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
      this.spawnPopup(width * 0.5, 118, 'SUDDEN DEATH! 2X GOLDEN FEATHERS!', '#facc15');
      for (let i = 0; i < 3; i++) {
        this.spawnIngredient(width, height, 'feather');
      }
    }

    if (this.roundTimer <= 0) {
      this.isOver = true;
      return;
    }

    this.cauldronPulse = Math.max(0, this.cauldronPulse - safeDt * 2.5);

    // Determine Underdog status
    let maxScore = 0;
    this.alchemists.forEach((a) => {
      if (a.score > maxScore) maxScore = a.score;
    });
    this.alchemists.forEach((a) => {
      a.underdogActive = maxScore - a.score >= 60;
    });

    // Update bots
    this.updateBots(safeDt, width, height);

    const cx = width * 0.5;
    const cy = height * 0.54;
    const cauldronRadius = 64;

    // Update players
    this.alchemists.forEach((a) => {
      if (a.shuntCooldown > 0) a.shuntCooldown = Math.max(0, a.shuntCooldown - safeDt);
      if (a.dashTimer > 0) a.dashTimer = Math.max(0, a.dashTimer - safeDt);
      if (a.stunTimer > 0) a.stunTimer = Math.max(0, a.stunTimer - safeDt);

      const steerX = this.input.getSteer(a.id);
      const steerY = -this.input.getThrottle(a.id);
      const pCfg = this.getPlayer(a.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(a.id);
      const pressed = this.input.isActionPressed(a.id) || (isBot && this.input.isPressed(a.id)) || (!hasSteer && !isBot && this.input.isPressed(a.id));
      const justPressed = this.input.justAction(a.id) || (isBot && this.input.justPressed(a.id)) || (!hasSteer && !isBot && this.input.justPressed(a.id));

      // Hold-to-charge tracking
      if (pressed) {
        a.pressDuration += safeDt;
        if (a.pressDuration > 0.16) {
          a.isCharging = true;
          a.charge = Math.min(1, a.charge + safeDt * 0.88);
        }
      } else {
        if (a.wasPressed) {
          if (a.isCharging && a.charge >= 0.35) {
            this.executeVortexShunt(a, width, height);
          } else if (a.carrying) {
            // Quick tap tosses ingredient toward the central cauldron!
            this.tossCarriedIngredient(a, cx, cy);
          } else {
            // Quick tap when empty-handed gives a snappy grab-step lunge
            a.vx += a.facingX * 240;
            a.vy += a.facingY * 240;
            a.dashTimer = 0.18;
          }
        }
        a.isCharging = false;
        a.charge = 0;
        a.pressDuration = 0;
      }
      a.wasPressed = pressed;

      // Movement handling (works seamlessly in both 2D directional and 1-button modes)
      let moveX = steerX;
      let moveY = steerY;
      if (Math.abs(moveX) < 0.05 && Math.abs(moveY) < 0.05 && !a.config.type.startsWith('bot_')) {
        // In single-button mode or when no directional key is held, gently steer toward nearest needed ingredient or cauldron
        if (a.carrying) {
          const dx = cx - a.x;
          const dy = cy - a.y;
          const d = Math.hypot(dx, dy) || 1;
          moveX = (dx / (d || 0.001)) * 0.72;
          moveY = (dy / (d || 0.001)) * 0.72;
        } else if (this.floorIngredients.length > 0) {
          let best = this.floorIngredients[0];
          let bestScore = -1e9;
          const needed = this.recipeQueue[this.recipeStep];
          for (const ing of this.floorIngredients) {
            const dist = Math.hypot(ing.x - a.x, ing.y - a.y);
            const bonus = ing.kind === 'feather' ? 140 : ing.kind === needed ? 90 : 0;
            const s = bonus - dist;
            if (s > bestScore) {
              bestScore = s;
              best = ing;
            }
          }
          const dx = best.x - a.x;
          const dy = best.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          moveX = (dx / (d || 0.001)) * 0.68;
          moveY = (dy / (d || 0.001)) * 0.68;
        }
      }

      if (justPressed && a.carrying && Math.hypot(cx - a.x, cy - a.y) < 250) {
        this.tossCarriedIngredient(a, cx, cy);
      }

      const len = Math.hypot(moveX, moveY);
      if (len > 0.08 && a.stunTimer <= 0) {
        const nx = moveX / Math.max(1, len);
        const ny = moveY / Math.max(1, len);
        a.facingX = nx;
        a.facingY = ny;
        const speedMult = (a.underdogActive ? 1.2 : 1.0) * (a.isCharging ? 0.68 : 1.0);
        const accel = 1350 * speedMult;
        a.vx += nx * accel * safeDt;
        a.vy += ny * accel * safeDt;
      }

      const drag = Math.pow(0.018, safeDt);
      a.vx *= drag;
      a.vy *= drag;

      a.x += a.vx * safeDt;
      a.y += a.vy * safeDt;

      // Arena bounds
      const minX = 52;
      const maxX = width - 52;
      const minY = 104;
      const maxY = height - 88;
      if (a.x < minX) { a.x = minX; a.vx = Math.abs(a.vx) * 0.6; }
      if (a.x > maxX) { a.x = maxX; a.vx = -Math.abs(a.vx) * 0.6; }
      if (a.y < minY) { a.y = minY; a.vy = Math.abs(a.vy) * 0.6; }
      if (a.y > maxY) { a.y = maxY; a.vy = -Math.abs(a.vy) * 0.6; }

      // Cauldron physical rim collision + automatic dunk when carrying an ingredient near the rim!
      const dxC = a.x - cx;
      const dyC = a.y - cy;
      const distC = Math.hypot(dxC, dyC) || 1;
      if (a.carrying && distC <= cauldronRadius + 46) {
        this.tossCarriedIngredient(a, cx, cy);
      }
      if (distC < cauldronRadius + 22) {
        const nx = dxC / distC;
        const ny = dyC / distC;
        a.x = cx + nx * (cauldronRadius + 22);
        a.y = cy + ny * (cauldronRadius + 22);
        const dot = a.vx * nx + a.vy * ny;
        if (dot < 0) {
          a.vx -= 1.5 * dot * nx;
          a.vy -= 1.5 * dot * ny;
        }
      }

      // Pick up floor ingredients
      if (!a.carrying && a.stunTimer <= 0) {
        for (let i = this.floorIngredients.length - 1; i >= 0; i--) {
          const ing = this.floorIngredients[i];
          if (ing.pickupCooldown > 0) continue;
          if (Math.hypot(ing.x - a.x, ing.y - a.y) <= 38) {
            a.carrying = ing.kind;
            this.floorIngredients.splice(i, 1);
            this.spawnParticles(ing.x, ing.y, INGREDIENT_META[ing.kind].color, 8);
            break;
          }
        }
      }
    });

    // Elastic player-to-player collisions (m1*v1 + m2*v2)
    const list = Array.from(this.alchemists.values());
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
          const p = 2 * (nx * kx + ny * ky) / 2;
          if (p > 0) {
            const restitution = 1.18;
            p1.vx -= p * nx * restitution - nx * 45;
            p1.vy -= p * ny * restitution - ny * 45;
            p2.vx += p * nx * restitution + nx * 45;
            p2.vy += p * ny * restitution + ny * 45;
            this.triggerScreenShake(3);
            this.spawnParticles((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#facc15', 8);

            // Hard dash impacts knock carried ingredient loose!
            if (p1.dashTimer > 0 && p2.carrying) {
              this.dropCarriedIngredient(p2, nx * 160, ny * 160);
              this.spawnPopup(p2.x, p2.y - 28, 'JARRED LOOSE!', '#f87171');
            } else if (p2.dashTimer > 0 && p1.carrying) {
              this.dropCarriedIngredient(p1, -nx * 160, -ny * 160);
              this.spawnPopup(p1.x, p1.y - 28, 'JARRED LOOSE!', '#f87171');
            }
          }
        }
      }
    }

    // Update floor ingredients
    this.spawnClock += safeDt;
    const maxIng = this.suddenDeath ? 14 : 11;
    if (this.spawnClock >= (this.suddenDeath ? 1.1 : 1.7) && this.floorIngredients.length < maxIng) {
      this.spawnClock = 0;
      this.spawnIngredient(width, height);
    }

    for (const ing of this.floorIngredients) {
      ing.bobPhase += safeDt * 4.2;
      if (ing.pickupCooldown > 0) ing.pickupCooldown = Math.max(0, ing.pickupCooldown - safeDt);
      ing.x += ing.vx * safeDt;
      ing.y += ing.vy * safeDt;
      ing.vx *= Math.pow(0.05, safeDt);
      ing.vy *= Math.pow(0.05, safeDt);
      ing.x = Math.max(58, Math.min(width - 58, ing.x));
      ing.y = Math.max(115, Math.min(height - 92, ing.y));
    }

    // Update thrown ingredients arcing into the cauldron
    for (let i = this.thrownIngredients.length - 1; i >= 0; i--) {
      const t = this.thrownIngredients[i];
      t.progress += safeDt * 3.1;
      const u = Math.min(1, t.progress);
      t.x = t.startX + (t.targetX - t.startX) * u;
      t.y = t.startY + (t.targetY - t.startY) * u - Math.sin(u * Math.PI) * 58;
      if (u >= 1) {
        this.resolveCauldronDunk(t, width, height);
        this.thrownIngredients.splice(i, 1);
      }
    }

    // Update particles & popups
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

  private tossCarriedIngredient(a: AlchemistState, cx: number, cy: number): void {
    if (!a.carrying) return;
    const kind = a.carrying;
    a.carrying = null;
    this.thrownIngredients.push({
      ownerId: a.id,
      ownerColor: a.config.color,
      kind,
      x: a.x,
      y: a.y - 16,
      startX: a.x,
      startY: a.y - 16,
      targetX: cx + (Math.random() - 0.5) * 24,
      targetY: cy + (Math.random() - 0.5) * 16,
      progress: 0
    });
  }

  private dropCarriedIngredient(a: AlchemistState, vx: number, vy: number): void {
    if (!a.carrying) return;
    this.floorIngredients.push({
      id: this.nextIngId++,
      kind: a.carrying,
      x: a.x,
      y: a.y,
      vx,
      vy,
      bobPhase: 0,
      pickupCooldown: 0.45
    });
    a.carrying = null;
  }

  private resolveCauldronDunk(t: ThrownIngredient, width: number, height: number): void {
    const owner = this.alchemists.get(t.ownerId);
    if (!owner) return;

    const meta = INGREDIENT_META[t.kind];
    const needed = this.recipeQueue[this.recipeStep];
    const isMatch = t.kind === needed || t.kind === 'feather';
    const mult = (this.suddenDeath ? 1.5 : 1) * (owner.underdogActive ? 1.25 : 1);

    this.cauldronPulse = 1;
    this.cauldronColor = meta.color;
    this.spawnParticles(t.targetX, t.targetY, meta.color, 18);

    if (isMatch) {
      const basePts = t.kind === 'feather' ? 70 : 45;
      const pts = Math.round(basePts * mult);
      owner.score += pts;
      this.recipeStep++;
      this.triggerScreenShake(4);

      if (this.recipeStep >= this.recipeQueue.length) {
        const jackpot = Math.round(60 * mult);
        owner.score += jackpot;
        owner.brewsCompleted++;
        this.spawnPopup(t.targetX, t.targetY - 34, `MASTER POTION! +${pts + jackpot}`, '#facc15');
        this.spawnParticles(t.targetX, t.targetY, '#facc15', 26);
        this.triggerScreenShake(7);
        this.generateNewRecipe();
        // Ensure at least one of the new needed ingredients spawns immediately
        this.spawnIngredient(width, height, this.recipeQueue[0]);
      } else {
        this.spawnPopup(t.targetX, t.targetY - 24, `RECIPE MATCH! +${pts}`, meta.glow);
        this.spawnIngredient(width, height, this.recipeQueue[this.recipeStep]);
      }
    } else {
      const pts = Math.round(20 * mult);
      owner.score += pts;
      this.spawnPopup(t.targetX, t.targetY - 18, `WILD BREW +${pts}`, '#94a3b8');
    }
  }

  private executeVortexShunt(a: AlchemistState, width: number, height: number): void {
    const isSweetSpot = a.charge >= 0.72 && a.charge <= 0.98;
    const power = isSweetSpot ? 620 : 390;
    a.vx = a.facingX * power;
    a.vy = a.facingY * power;
    a.dashTimer = isSweetSpot ? 0.45 : 0.25;
    a.shuntCooldown = 0.75;

    const cx = width * 0.5;
    const cy = height * 0.54;
    if (a.carrying && Math.hypot(cx - a.x, cy - a.y) < 310) {
      this.tossCarriedIngredient(a, cx, cy);
    }

    this.spawnParticles(a.x, a.y, isSweetSpot ? '#facc15' : a.config.color, isSweetSpot ? 22 : 12);
    this.triggerScreenShake(isSweetSpot ? 6 : 3);

    if (isSweetSpot) {
      a.score += 15;
      this.spawnPopup(a.x, a.y - 38, 'VORTEX SHUNT! +15', '#facc15');
    }

    // Knock back nearby rivals and pop their carried ingredient loose on sweet-spot!
    const radius = isSweetSpot ? 145 : 95;
    this.alchemists.forEach((other) => {
      if (other.id === a.id) return;
      const dx = other.x - a.x;
      const dy = other.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= radius) {
        const nx = dx / d;
        const ny = dy / d;
        const knock = isSweetSpot ? 540 : 320;
        other.vx += nx * knock;
        other.vy += ny * knock;
        if (isSweetSpot) {
          other.stunTimer = 0.45;
          if (other.carrying) {
            this.dropCarriedIngredient(other, nx * 210, ny * 210);
          }
          this.spawnPopup(other.x, other.y - 30, 'ALCHEMICAL SHUNT!', '#c084fc');
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
    const bot = this.alchemists.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    const cx = width * 0.5;
    const cy = height * 0.54;
    const skill = difficulty === 'bot_hard' ? 1.0 : difficulty === 'bot_normal' ? 0.82 : 0.64;

    if (bot.carrying) {
      // Carry ingredient toward cauldron and dunk!
      const dx = cx - bot.x;
      const dy = cy - bot.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      bot.facingX = nx;
      bot.facingY = ny;
      bot.vx += nx * 1180 * skill * dt;
      bot.vy += ny * 1180 * skill * dt;

      if (dist <= 135) {
        this.tossCarriedIngredient(bot, cx, cy);
      }
      return;
    }

    // Look for best ingredient on floor
    const needed = this.recipeQueue[this.recipeStep];
    let target: FloorIngredient | null = null;
    let bestVal = -1e9;
    for (const ing of this.floorIngredients) {
      if (ing.pickupCooldown > 0) continue;
      const d = Math.hypot(ing.x - bot.x, ing.y - bot.y);
      const matchBonus =
        ing.kind === 'feather' ? 180 : ing.kind === needed ? (difficulty === 'bot_easy' ? 45 : 135) : 0;
      const val = matchBonus - d;
      if (val > bestVal) {
        bestVal = val;
        target = ing;
      }
    }

    if (target) {
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      bot.facingX = nx;
      bot.facingY = ny;
      bot.vx += nx * 1150 * skill * dt;
      bot.vy += ny * 1150 * skill * dt;

      // Occasional sweet-spot vortex dash on normal/hard
      if (difficulty !== 'bot_easy' && d > 160 && bot.shuntCooldown <= 0 && Math.random() < dt * 0.85) {
        bot.charge = difficulty === 'bot_hard' ? 0.84 : 0.65;
        this.executeVortexShunt(bot, width, height);
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
        size: 3 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65
      });
    }
  }

  private spawnPopup(x: number, y: number, text: string, color: string): void {
    this.popups.push({
      x,
      y,
      vy: -38,
      text,
      color,
      life: 1.05,
      maxLife: 1.05
    });
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex];
    const cx = width * 0.5;
    const cy = height * 0.54;

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Background & Shared 2.5D Apothecary Floor
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    this.drawArenaEnvironment(ctx, width, height, cx, cy, theme);

    // 2. Active Recipe Scroll Banner above the Cauldron
    this.drawRecipeBanner(ctx, cx, cy - 115, theme);

    // 3. Central Boiling Grand Cauldron
    this.drawGrandCauldron(ctx, cx, cy, theme);

    // 4. Floor Ingredients
    for (const ing of this.floorIngredients) {
      const bob = Math.sin(ing.bobPhase) * 4;
      this.drawIngredientToken(ctx, ing.x, ing.y + bob, ing.kind, 1.0, ing.kind === this.recipeQueue[this.recipeStep]);
    }

    // 5. Players sorted by Y for 2.5D depth
    const sortedPlayers = Array.from(this.alchemists.values()).sort((a, b) => a.y - b.y);
    for (const a of sortedPlayers) {
      this.drawAlchemist(ctx, a);
    }

    // 6. Arcing Thrown Ingredients
    for (const t of this.thrownIngredients) {
      this.drawIngredientToken(ctx, t.x, t.y, t.kind, 1.15, true);
    }

    // 7. Particles & Popups
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

    // 8. Clean HUD Header, Corner Player Cards & Theme Pill
    this.drawHUD(ctx, width, height, theme);

    ctx.restore();
  }

  private drawArenaEnvironment(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cx: number,
    cy: number,
    theme: BrewTheme
  ): void {
    // Apothecary stone floor
    ctx.fillStyle = theme.floorColor;
    ctx.beginPath();
    ctx.roundRect(38, 92, width - 76, height - 168, 26);
    ctx.fill();
    ctx.strokeStyle = theme.tileStroke;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Concentric arcane alchemy circles around the central cauldron
    for (const r of [105, 175, 255]) {
      ctx.strokeStyle = theme.tileStroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.15, r * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Radial floor tiles
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + this.elapsed * 0.04;
      ctx.strokeStyle = theme.tileStroke;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * 75, cy + Math.sin(ang) * 52);
      ctx.lineTo(cx + Math.cos(ang) * 290, cy + Math.sin(ang) * 195);
      ctx.stroke();
    }
  }

  private drawRecipeBanner(ctx: CanvasRenderingContext2D, x: number, y: number, theme: BrewTheme): void {
    const w = 290;
    const h = 54;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x - w * 0.5, y - h * 0.5, w, h, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 11px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT POTION RECIPE:', x - w * 0.5 + 14, y - 10);
    ctx.fillStyle = '#facc15';
    ctx.fillText('2X MATCH BONUS!', x - w * 0.5 + 14, y + 10);

    for (let i = 0; i < this.recipeQueue.length; i++) {
      const slotX = x + 36 + i * 38;
      const slotY = y;
      const done = i < this.recipeStep;
      const active = i === this.recipeStep;

      ctx.fillStyle = done ? 'rgba(16, 185, 129, 0.35)' : active ? 'rgba(250, 204, 21, 0.25)' : 'rgba(30, 41, 59, 0.8)';
      ctx.strokeStyle = done ? '#10b981' : active ? '#facc15' : '#475569';
      ctx.lineWidth = active ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(slotX, slotY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      this.drawIngredientToken(ctx, slotX, slotY, this.recipeQueue[i], 0.62, false);
      if (done) {
        ctx.fillStyle = '#10b981';
        ctx.font = '900 14px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓', slotX + 10, slotY - 8);
      }
    }
    ctx.restore();
  }

  private drawGrandCauldron(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: BrewTheme): void {
    const scale = 1 + this.cauldronPulse * 0.1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Dunk Zone Ring
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.32)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 8, 98, 72, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 38, 76, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cauldron kettle belly
    const kettleGrad = ctx.createRadialGradient(-18, -10, 12, 0, 10, 74);
    kettleGrad.addColorStop(0, '#475569');
    kettleGrad.addColorStop(0.55, theme.cauldronBody);
    kettleGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = kettleGrad;
    ctx.beginPath();
    ctx.ellipse(0, 10, 70, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.cauldronRim;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Rim & bubbling liquid top
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(0, -14, 62, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.stroke();

    const liqGrad = ctx.createRadialGradient(0, -14, 6, 0, -14, 56);
    liqGrad.addColorStop(0, theme.liquidGlow);
    liqGrad.addColorStop(0.65, this.cauldronColor);
    liqGrad.addColorStop(1, '#064e3b');
    ctx.fillStyle = liqGrad;
    ctx.beginPath();
    ctx.ellipse(0, -14, 54, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Animated bubbles
    for (const b of this.bubbles) {
      const pulse = Math.sin(this.elapsed * b.speed + b.phase);
      const r = b.r * (0.75 + 0.35 * pulse);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(b.rx, -14 + b.ry * 0.45 - pulse * 3, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawIngredientToken(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    kind: IngredientKind,
    scale: number,
    highlightNeeded: boolean
  ): void {
    const meta = INGREDIENT_META[kind];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    if (highlightNeeded || kind === 'feather') {
      const pulse = 18 + Math.sin(this.elapsed * 7) * 3;
      ctx.strokeStyle = kind === 'feather' ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Soft glow disc
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    if (kind === 'shroom') {
      // Stem
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.roundRect(-4, 0, 8, 10, 3);
      ctx.fill();
      // Cap
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(0, 0, 10, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f3e8ff';
      ctx.beginPath();
      ctx.arc(-4, -4, 2, 0, Math.PI * 2);
      ctx.arc(4, -3, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'scale') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fecaca';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (kind === 'vial') {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 3, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-3, -9, 6, 5);
    } else {
      // Golden Phoenix Feather
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 12, Math.PI * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawAlchemist(ctx: CanvasRenderingContext2D, a: AlchemistState): void {
    ctx.save();

    if (a.underdogActive) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 30 + Math.sin(this.elapsed * 9) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw 2.5D Player Mascot
    const mood: CharacterMood = a.stunTimer > 0 ? 'shocked' : a.isCharging || a.dashTimer > 0 ? 'triumph' : 'focused';
    this.drawPlayerMascot(ctx, a.id, a.x, a.y, 22, mood, this.elapsed);

    // Carried ingredient floating overhead
    if (a.carrying) {
      this.drawIngredientToken(ctx, a.x, a.y - 36, a.carrying, 0.95, true);
    }

    // Hold-to-charge sweet-spot arc (72% - 98%)
    if (a.isCharging && a.charge > 0.08) {
      const r = 32;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, -Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();

      const sweet = a.charge >= 0.72 && a.charge <= 0.98;
      ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, -Math.PI * 0.5, -Math.PI * 0.5 + a.charge * Math.PI * 2);
      ctx.stroke();
    }

    // Player label
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3;
    ctx.strokeText(a.config.name, a.x, a.y + 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(a.config.name, a.x, a.y + 36);

    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: BrewTheme): void {
    // Top Header Badge (y: 52-80)
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
        ? `⚡ SUDDEN DEATH BREW • ${timeStr} ⚡`
        : `CAULDRON ALCHEMY BREW • ${timeStr}`,
      width * 0.5,
      71
    );

    // Corner Player Cards (y: height - 128)
    const cardW = 168;
    const cardH = 66;
    const players = Array.from(this.alchemists.values());
    players.forEach((a, idx) => {
      const cardX = idx % 2 === 0 ? 20 : width - cardW - 20;
      const cardY = idx < 2 ? height - 128 : 54;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = a.config.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = a.config.color;
      ctx.font = '800 13px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(a.config.name, cardX + 12, cardY + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px "Outfit", sans-serif';
      ctx.fillText(`${a.score} PTS`, cardX + 12, cardY + 46);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 11px "Outfit", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        a.carrying ? `HOLD: ${INGREDIENT_META[a.carrying].label.split(' ')[1]}` : `BREWS: ${a.brewsCompleted}`,
        cardX + cardW - 10,
        cardY + 22
      );
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

  public handlePointerDown(x: number, y: number, _width: number, height: number): boolean {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.cauldronColor = THEMES[this.themeIndex].liquidBase;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  public getScore(playerId: PlayerId): number {
    return this.alchemists.get(playerId)?.score ?? 0;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.alchemists.values()).sort((a, b) => b.score - a.score);
    const rankings = sorted.map((a, idx) => ({
      playerId: a.id,
      score: a.score,
      place: idx + 1
    }));
    const isTie = sorted.length >= 2 && sorted[0].score === sorted[1].score;
    const winnerId = isTie || sorted.length === 0 ? null : sorted[0].id;
    return {
      winnerId,
      rankings,
      mvpHighlight: sorted[0]
        ? `${sorted[0].config.name} brewed ${sorted[0].brewsCompleted} Master Potions (${sorted[0].score} pts)!`
        : 'Master Apothecary Showdown!'
    };
  }
}
