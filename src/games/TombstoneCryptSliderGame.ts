import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

/**
 * [G-243] Pharaoh Relic Slider (Ancient Treasure Vault Shove)
 * Overhauled according to the 8 Pillars of Fun & Double-Review Audit:
 * - 2.5D Mascot Explorers (`this.drawPlayerMascot`) sprint across a shared Ancient Treasure Vault (`Steer: Run Vault`),
 *   shoving heavy carved stone vault lids aside to unearth Golden Scarabs (+30 pts), Emerald Ankhs (+45 pts), and
 *   Diamond Pharaoh Crowns (+75 pts)!
 * - Intuitive Universal Controls:
 *   * Steer (`WASD`/Arrows) or 1-button auto-pursuit to approach sealed stone vaults; touching or tapping Action
 *     rapidly slides the heavy stone slab open!
 *   * Hold-to-Charge Seismic Slab Launch & Vault Shunt (72%–98% sweet-spot): Unleashes a golden seismic wave that
 *     instantly slides open all nearby stone lids, magnetizes unearthed relics toward you, and shunts rival explorers!
 * - Elastic player-to-player collisions (m1*v1 + m2*v2) + 3 swappable visual themes (`luxor_vault`, `jade_temple`,
 *   `cyber_archive`) via [T]/[1-3] or Theme Pill.
 */

type VaultThemeId = 'luxor_vault' | 'jade_temple' | 'cyber_archive';

interface VaultTheme {
  id: VaultThemeId;
  name: string;
  bgTop: string;
  bgBottom: string;
  floorColor: string;
  tileStroke: string;
  slabBase: string;
  slabTrim: string;
  accent: string;
}

const THEMES: VaultTheme[] = [
  {
    id: 'luxor_vault',
    name: 'Pharaoh Gold Vault',
    bgTop: '#1c1208',
    bgBottom: '#3b2510',
    floorColor: '#2d1c0d',
    tileStroke: 'rgba(250, 204, 21, 0.18)',
    slabBase: '#78716c',
    slabTrim: '#facc15',
    accent: '#facc15'
  },
  {
    id: 'jade_temple',
    name: 'Emerald Sun Temple',
    bgTop: '#062019',
    bgBottom: '#0d3b2e',
    floorColor: '#092c22',
    tileStroke: 'rgba(52, 211, 153, 0.18)',
    slabBase: '#475569',
    slabTrim: '#34d399',
    accent: '#34d399'
  },
  {
    id: 'cyber_archive',
    name: 'Neon Data Crypt',
    bgTop: '#050816',
    bgBottom: '#0f172a',
    floorColor: '#0b1329',
    tileStroke: 'rgba(56, 189, 248, 0.22)',
    slabBase: '#1e293b',
    slabTrim: '#38bdf8',
    accent: '#38bdf8'
  }
];

type RelicKind = 'scarab' | 'ankh' | 'pharaoh_crown' | 'beetle_trap';

interface TreasureVault {
  id: number;
  x: number;
  y: number;
  slideProgress: number; // 0 = sealed, 1 = fully slid open
  slideDir: number;
  contents: RelicKind;
  isOpened: boolean;
  reSealTimer: number;
  rumblePhase: number;
}

interface LooseRelic {
  id: number;
  kind: 'scarab' | 'ankh' | 'pharaoh_crown';
  x: number;
  y: number;
  vx: number;
  vy: number;
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

interface ExplorerState {
  id: PlayerId;
  config: PlayerConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  score: number;
  vaultsOpened: number;
  isCharging: boolean;
  charge: number;
  wasPressed: boolean;
  pressDuration: number;
  shuntCooldown: number;
  stunTimer: number;
  underdogActive: boolean;
}

export class TombstoneCryptSliderGame extends BaseGame {
  private explorers: Map<PlayerId, ExplorerState> = new Map();
  private vaults: TreasureVault[] = [];
  private looseRelics: LooseRelic[] = [];
  private popups: FloatingPopup[] = [];
  private fxParticles: SparkParticle[] = [];

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
    this.explorers.clear();
    this.vaults = [];
    this.looseRelics = [];
    this.popups = [];
    this.fxParticles = [];
    this.screenShake = 0;

    this.roundTimer = this.roundDuration;
    this.elapsed = 0;
    this.isOver = false;
    this.suddenDeath = false;
    this.nextRelicId = 1;

    // 8 Stone Vaults arranged across the shared chamber
    const cols = 4;
    const rows = 2;
    const startX = width * 0.2;
    const spanX = width * 0.6;
    const startY = 195;
    const spanY = height - 365;

    let idCounter = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.vaults.push({
          id: idCounter++,
          x: startX + (c / (cols - 1)) * spanX,
          y: startY + (r / Math.max(1, rows - 1)) * spanY,
          slideProgress: 0,
          slideDir: c % 2 === 0 ? -1 : 1,
          contents: this.rollVaultContents(),
          isOpened: false,
          reSealTimer: 0,
          rumblePhase: Math.random() * Math.PI * 2
        });
      }
    }

    const cx = width * 0.5;
    const cy = height * 0.54;
    const activePlayers = this.getActivePlayers();
    const count = Math.max(1, activePlayers.length);

    activePlayers.forEach((p, idx) => {
      const ang = (idx / count) * Math.PI * 2 + Math.PI * 0.25;
      this.explorers.set(p.id, {
        id: p.id,
        config: p,
        x: cx + Math.cos(ang) * 165,
        y: cy + Math.sin(ang) * 95,
        vx: 0,
        vy: 0,
        facingX: Math.cos(ang),
        facingY: Math.sin(ang),
        score: 0,
        vaultsOpened: 0,
        isCharging: false,
        charge: 0,
        wasPressed: false,
        pressDuration: 0,
        shuntCooldown: 0,
        stunTimer: 0,
        underdogActive: false
      });
    });
  }

  private rollVaultContents(): RelicKind {
    const roll = Math.random();
    if (roll < 0.14) return 'beetle_trap';
    if (roll < (this.suddenDeath ? 0.52 : 0.32)) return 'pharaoh_crown';
    if (roll < 0.65) return 'ankh';
    return 'scarab';
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
      this.spawnPopup(width * 0.5, 118, 'SUDDEN DEATH! DIAMOND PHARAOH CROWNS!', '#facc15');
      for (const v of this.vaults) {
        if (v.isOpened) {
          v.reSealTimer = 0.1;
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isOver = true;
      return;
    }

    // Update Vaults re-sealing
    for (const v of this.vaults) {
      v.rumblePhase += safeDt * 12;
      if (v.isOpened) {
        v.reSealTimer -= safeDt;
        if (v.reSealTimer <= 0) {
          v.isOpened = false;
          v.slideProgress = 0;
          v.contents = this.rollVaultContents();
        }
      } else if (v.slideProgress > 0) {
        // Slowly slide back if nobody is pushing
        v.slideProgress = Math.max(0, v.slideProgress - safeDt * 0.25);
      }
    }

    let maxScore = 0;
    this.explorers.forEach((e) => {
      if (e.score > maxScore) maxScore = e.score;
    });
    this.explorers.forEach((e) => {
      e.underdogActive = maxScore - e.score >= 55;
    });

    this.updateBots(safeDt, width, height);

    this.explorers.forEach((e) => {
      if (e.shuntCooldown > 0) e.shuntCooldown = Math.max(0, e.shuntCooldown - safeDt);
      if (e.stunTimer > 0) e.stunTimer = Math.max(0, e.stunTimer - safeDt);

      const steerX = this.input.getSteer(e.id);
      const steerY = -this.input.getThrottle(e.id);
      const isBot = e.config.type.startsWith('bot_');
      const hasSteer = this.input.hasSteer(e.id);
      const pressed = this.input.isActionPressed(e.id) || (isBot && this.input.isPressed(e.id)) || (!hasSteer && !isBot && this.input.isPressed(e.id));
      const justPressed = this.input.justAction(e.id) || (isBot && this.input.justPressed(e.id)) || (!hasSteer && !isBot && this.input.justPressed(e.id));

      // Hold-to-Charge Seismic Slab Launch
      if (pressed && e.stunTimer <= 0) {
        e.pressDuration += safeDt;
        if (e.pressDuration > 0.18) {
          e.isCharging = true;
          e.charge = Math.min(1, e.charge + safeDt * 0.9);
        }
      } else {
        if (e.wasPressed && e.stunTimer <= 0 && e.isCharging && e.charge >= 0.4) {
          this.executeSeismicSlabLaunch(e);
        }
        e.isCharging = false;
        e.charge = 0;
        e.pressDuration = 0;
      }
      e.wasPressed = pressed;

      if (!e.config.type.startsWith('bot_') && e.stunTimer <= 0) {
        let moveX = steerX;
        let moveY = steerY;
        if (Math.abs(moveX) < 0.06 && Math.abs(moveY) < 0.06) {
          const target = this.findBestTargetFor(e.x, e.y, true);
          if (target) {
            const dx = target.x - e.x;
            const dy = target.y - e.y;
            const d = Math.hypot(dx, dy) || 1;
            moveX = (dx / (d || 0.001)) * 0.72;
            moveY = (dy / (d || 0.001)) * 0.72;
          }
        }

        const len = Math.hypot(moveX, moveY);
        if (len > 0.08) {
          const nx = moveX / Math.max(1, len);
          const ny = moveY / Math.max(1, len);
          e.facingX = nx;
          e.facingY = ny;
          const speedMult = (e.underdogActive ? 1.2 : 1.0) * (e.isCharging ? 0.7 : 1.0);
          e.vx += nx * 1340 * speedMult * safeDt;
          e.vy += ny * 1340 * speedMult * safeDt;
        }
      }

      const drag = Math.pow(0.02, safeDt);
      e.vx *= drag;
      e.vy *= drag;
      e.x += e.vx * safeDt;
      e.y += e.vy * safeDt;

      e.x = Math.max(54, Math.min(width - 54, e.x));
      e.y = Math.max(106, Math.min(height - 88, e.y));

      // Slide nearby sealed stone vaults by touching or pressing Action!
      if (e.stunTimer <= 0) {
        for (const v of this.vaults) {
          if (v.isOpened) continue;
          const d = Math.hypot(v.x - e.x, v.y - e.y);
          if (d <= 68) {
            const shoveRate = (pressed ? 2.4 : 1.45) + (justPressed ? 4.5 : 0);
            v.slideProgress = Math.min(1, v.slideProgress + shoveRate * safeDt);
            if (v.slideProgress >= 1) {
              this.openVault(e, v, false);
            }
          }
        }
      }

      // Collect Loose Relics
      if (e.stunTimer <= 0) {
        for (let i = this.looseRelics.length - 1; i >= 0; i--) {
          const rel = this.looseRelics[i];
          if (Math.hypot(rel.x - e.x, rel.y - e.y) <= 38) {
            const basePts = rel.kind === 'pharaoh_crown' ? 75 : rel.kind === 'ankh' ? 45 : 30;
            const pts = Math.round(basePts * (e.underdogActive ? 1.25 : 1));
            e.score += pts;
            const col = rel.kind === 'pharaoh_crown' ? '#facc15' : rel.kind === 'ankh' ? '#34d399' : '#38bdf8';
            this.spawnParticles(rel.x, rel.y, col, 14);
            this.spawnPopup(rel.x, rel.y - 22, `+${pts}`, col);
            this.looseRelics.splice(i, 1);
          }
        }
      }
    });

    // Elastic player-to-player collisions
    const list = Array.from(this.explorers.values());
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
            this.spawnParticles((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#facc15', 8);
          }
        }
      }
    }

    // Update Loose Relics
    for (const rel of this.looseRelics) {
      rel.bobPhase += safeDt * 4.5;
      rel.x += rel.vx * safeDt;
      rel.y += rel.vy * safeDt;
      rel.vx *= Math.pow(0.06, safeDt);
      rel.vy *= Math.pow(0.06, safeDt);
      rel.x = Math.max(60, Math.min(width - 60, rel.x));
      rel.y = Math.max(112, Math.min(height - 92, rel.y));
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

  private findBestTargetFor(x: number, y: number, avoidTrap: boolean): { x: number; y: number } | null {
    // Prefer loose relics first!
    let best: { x: number; y: number } | null = null;
    let bestVal = -1e9;

    for (const rel of this.looseRelics) {
      const d = Math.hypot(rel.x - x, rel.y - y);
      const val = (rel.kind === 'pharaoh_crown' ? 200 : 140) - d;
      if (val > bestVal) {
        bestVal = val;
        best = { x: rel.x, y: rel.y };
      }
    }

    for (const v of this.vaults) {
      if (v.isOpened) continue;
      if (avoidTrap && v.contents === 'beetle_trap') continue;
      const d = Math.hypot(v.x - x, v.y - y);
      const val = v.slideProgress * 60 - d;
      if (val > bestVal) {
        bestVal = val;
        best = { x: v.x, y: v.y };
      }
    }
    return best;
  }

  private openVault(e: ExplorerState, v: TreasureVault, fromSeismic: boolean): void {
    v.isOpened = true;
    v.slideProgress = 1;
    v.reSealTimer = this.suddenDeath ? 2.6 : 3.8;
    e.vaultsOpened++;

    if (v.contents === 'beetle_trap' && !fromSeismic) {
      e.score = Math.max(0, e.score - 15);
      e.stunTimer = 0.55;
      const dx = e.x - v.x;
      const dy = e.y - v.y;
      const d = Math.hypot(dx, dy) || 1;
      e.vx = (dx / (d || 0.001)) * 380;
      e.vy = (dy / (d || 0.001)) * 380;
      this.triggerScreenShake(5);
      this.spawnParticles(v.x, v.y, '#a855f7', 16);
      this.spawnPopup(v.x, v.y - 24, 'BEETLE TRAP! -15', '#c084fc');
      return;
    }

    const relicKind: 'scarab' | 'ankh' | 'pharaoh_crown' =
      v.contents === 'beetle_trap' ? 'scarab' : v.contents;

    // Award instant discovery bonus AND pop out the glowing relic (or auto-collect if explorer is right on top)
    const openBonus = Math.round(15 * (e.underdogActive ? 1.25 : 1));
    e.score += openBonus;
    this.triggerScreenShake(4);
    this.spawnParticles(v.x, v.y, '#facc15', 16);

    const ang = Math.atan2(e.y - v.y, e.x - v.x);
    this.looseRelics.push({
      id: this.nextRelicId++,
      kind: relicKind,
      x: v.x + Math.cos(ang) * 14,
      y: v.y + Math.sin(ang) * 14,
      vx: Math.cos(ang) * 90,
      vy: Math.sin(ang) * 90,
      bobPhase: 0
    });
  }

  private executeSeismicSlabLaunch(e: ExplorerState): void {
    const isSweetSpot = e.charge >= 0.72 && e.charge <= 0.98;
    const radius = isSweetSpot ? 175 : 115;
    e.shuntCooldown = 0.85;

    // Slide open all vaults inside radius safely!
    for (const v of this.vaults) {
      if (v.isOpened) continue;
      if (Math.hypot(v.x - e.x, v.y - e.y) <= radius) {
        this.openVault(e, v, true);
      }
    }

    // Magnetize nearby loose relics toward the explorer!
    for (const rel of this.looseRelics) {
      const dx = e.x - rel.x;
      const dy = e.y - rel.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= radius * 1.2) {
        rel.vx = (dx / (d || 0.001)) * 320;
        rel.vy = (dy / (d || 0.001)) * 320;
      }
    }

    // Shunt nearby rival Explorers
    this.explorers.forEach((other) => {
      if (other.id === e.id) return;
      const dx = other.x - e.x;
      const dy = other.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= radius) {
        const push = isSweetSpot ? 540 : 320;
        other.vx += (dx / (d || 0.001)) * push;
        other.vy += (dy / (d || 0.001)) * push;
        if (isSweetSpot) {
          other.stunTimer = 0.45;
          this.spawnPopup(other.x, other.y - 28, 'VAULT SHUNT!', '#facc15');
        }
      }
    });

    this.triggerScreenShake(isSweetSpot ? 6 : 3);
    this.spawnParticles(e.x, e.y, isSweetSpot ? '#facc15' : e.config.color, isSweetSpot ? 22 : 12);

    if (isSweetSpot) {
      e.score += 15;
      this.spawnPopup(e.x, e.y - 36, 'SEISMIC SLAB LAUNCH! +15', '#facc15');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.explorers.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    const skill = difficulty === 'bot_hard' ? 1.0 : difficulty === 'bot_normal' ? 0.82 : 0.65;
    const avoidTrap = difficulty !== 'bot_easy' || Math.random() < 0.75;
    const target = this.findBestTargetFor(bot.x, bot.y, avoidTrap);

    if (target) {
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const d = Math.hypot(dx, dy) || 1;
      bot.facingX = dx / (d || 0.001);
      bot.facingY = dy / (d || 0.001);
      bot.vx += bot.facingX * 1160 * skill * dt;
      bot.vy += bot.facingY * 1160 * skill * dt;

      if (difficulty !== 'bot_easy' && d < 95 && bot.shuntCooldown <= 0 && Math.random() < dt * 0.7) {
        bot.charge = difficulty === 'bot_hard' ? 0.85 : 0.65;
        this.executeSeismicSlabLaunch(bot);
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

    // 1. Background & Pharaoh Vault Floor
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.floorColor;
    ctx.beginPath();
    ctx.roundRect(38, 92, width - 76, height - 168, 24);
    ctx.fill();
    ctx.strokeStyle = theme.tileStroke;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 2. Stone Vaults & Sliding Lids
    for (const v of this.vaults) {
      this.drawVault(ctx, v, theme);
    }

    // 3. Loose Relics
    for (const rel of this.looseRelics) {
      this.drawLooseRelic(ctx, rel);
    }

    // 4. Explorers sorted by Y
    const sorted = Array.from(this.explorers.values()).sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      this.drawExplorer(ctx, e);
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

  private drawVault(ctx: CanvasRenderingContext2D, v: TreasureVault, theme: VaultTheme): void {
    ctx.save();
    const isTrap = !v.isOpened && v.contents === 'beetle_trap';
    const shakeX = isTrap ? Math.sin(v.rumblePhase) * 1.8 : 0;
    ctx.translate(v.x + shakeX, v.y);

    // Recessed Vault Cavity
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = isTrap ? 'rgba(192, 132, 252, 0.5)' : theme.slabTrim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-36, -24, 72, 48, 10);
    ctx.fill();
    ctx.stroke();

    // Inner glow inside cavity
    ctx.fillStyle = v.contents === 'pharaoh_crown' ? 'rgba(250, 204, 21, 0.25)' : 'rgba(56, 189, 248, 0.16)';
    ctx.beginPath();
    ctx.roundRect(-30, -18, 60, 36, 7);
    ctx.fill();

    // Sliding Carved Stone Slab Lid
    const offset = v.slideProgress * 58 * v.slideDir;
    ctx.save();
    ctx.translate(offset, 0);
    ctx.fillStyle = theme.slabBase;
    ctx.strokeStyle = isTrap ? '#c084fc' : theme.slabTrim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-36, -24, 72, 48, 10);
    ctx.fill();
    ctx.stroke();

    // Carved Hieroglyph / Sun Emblem on lid
    ctx.fillStyle = isTrap ? '#c084fc' : theme.slabTrim;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Progress bar when partially slid
    if (!v.isOpened && v.slideProgress > 0.05) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(-26, -34, 52, 6);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-26, -34, 52 * v.slideProgress, 6);
    }

    ctx.restore();
  }

  private drawLooseRelic(ctx: CanvasRenderingContext2D, rel: LooseRelic): void {
    ctx.save();
    ctx.translate(rel.x, rel.y + Math.sin(rel.bobPhase) * 4);
    const col =
      rel.kind === 'pharaoh_crown' ? '#facc15' : rel.kind === 'ankh' ? '#34d399' : '#38bdf8';

    ctx.fillStyle = col;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#090d16';
    ctx.font = '900 10px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rel.kind === 'pharaoh_crown' ? '👑' : rel.kind === 'ankh' ? '☥' : '🪲', 0, 4);
    ctx.restore();
  }

  private drawExplorer(ctx: CanvasRenderingContext2D, e: ExplorerState): void {
    ctx.save();

    if (e.underdogActive) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 29 + Math.sin(this.elapsed * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    const mood: CharacterMood = e.stunTimer > 0 ? 'shocked' : e.isCharging ? 'triumph' : 'focused';
    this.drawPlayerMascot(ctx, e.id, e.x, e.y, 22, mood, this.elapsed, Math.atan2(e.facingY, e.facingX));

    if (e.isCharging && e.charge > 0.08) {
      const sweet = e.charge >= 0.72 && e.charge <= 0.98;
      ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 32, -Math.PI * 0.5, -Math.PI * 0.5 + e.charge * Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3;
    ctx.strokeText(e.config.name, e.x, e.y + 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(e.config.name, e.x, e.y + 36);

    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VaultTheme): void {
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
        ? `⚡ SUDDEN DEATH VAULT • ${timeStr} ⚡`
        : `PHARAOH RELIC SLIDER • ${timeStr}`,
      width * 0.5,
      71
    );

    const cardW = 168;
    const cardH = 66;
    const players = Array.from(this.explorers.values());
    players.forEach((e, idx) => {
      const cardX = idx % 2 === 0 ? 20 : width - cardW - 20;
      const cardY = idx < 2 ? height - 128 : 54;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = e.config.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = e.config.color;
      ctx.font = '800 13px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(e.config.name, cardX + 12, cardY + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px "Outfit", sans-serif';
      ctx.fillText(`${e.score} PTS`, cardX + 12, cardY + 46);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 11px "Outfit", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`VAULTS: ${e.vaultsOpened}`, cardX + cardW - 12, cardY + 22);
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
    return this.explorers.get(playerId)?.score ?? 0;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.explorers.values()).sort((a, b) => b.score - a.score);
    const rankings = sorted.map((e, idx) => ({
      playerId: e.id,
      score: e.score,
      place: idx + 1
    }));
    const isTie = sorted.length >= 2 && sorted[0].score === sorted[1].score;
    const winnerId = isTie || sorted.length === 0 ? null : sorted[0].id;
    return {
      winnerId,
      rankings,
      mvpHighlight: sorted[0]
        ? `${sorted[0].config.name} opened ${sorted[0].vaultsOpened} vaults (${sorted[0].score} pts)!`
        : 'Vault Expedition Complete!'
    };
  }
}
