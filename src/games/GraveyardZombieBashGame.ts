import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

/**
 * [G-238] Graveyard Skeleton & Pumpkin Bash (Midnight Tombstone Whack)
 * Overhauled according to the 8 Pillars of Fun & Double-Review Audit:
 * - Implemented the missing Guardian Angel Statues promised in instructions, plus Rattle Skeletons (+25 pts),
 *   Jack-O'-Lantern Imps (+35 pts), and Golden Crowned Skeleton Kings (+65 pts)!
 * - 2.5D Mascot Keepers (`this.drawPlayerMascot`) sprint across the shared 12-mound courtyard with full 2D steering
 *   AND 1-button auto-pursuit so tapping Action lunges toward and whacks the nearest active target!
 * - Elastic player-to-player collisions (m1*v1 + m2*v2) + Hold-to-Charge Seismic Shovel Slam & Shockwave Shunt
 *   (72%–98% sweet-spot) that smashes all valid targets in a wide shockwave ring and blasts rivals back!
 * - 3 swappable visual themes (`moonlit_courtyard`, `pumpkin_festival`, `cyber_crypt`) via [T]/[1-3] or Theme Pill.
 */

type CourtyardThemeId = 'moonlit_courtyard' | 'pumpkin_festival' | 'cyber_crypt';

interface CourtyardTheme {
  id: CourtyardThemeId;
  name: string;
  bgTop: string;
  bgBottom: string;
  turfColor: string;
  moundDirt: string;
  stoneColor: string;
  accent: string;
}

const THEMES: CourtyardTheme[] = [
  {
    id: 'moonlit_courtyard',
    name: 'Moonlit Courtyard',
    bgTop: '#0b132b',
    bgBottom: '#1c2541',
    turfColor: '#132a23',
    moundDirt: '#3d2817',
    stoneColor: '#64748b',
    accent: '#34d399'
  },
  {
    id: 'pumpkin_festival',
    name: 'Harvest Hollow',
    bgTop: '#1f102a',
    bgBottom: '#3c1642',
    turfColor: '#241934',
    moundDirt: '#4a2511',
    stoneColor: '#78716c',
    accent: '#fb923c'
  },
  {
    id: 'cyber_crypt',
    name: 'Neon Necropolis',
    bgTop: '#050816',
    bgBottom: '#0f172a',
    turfColor: '#0b1528',
    moundDirt: '#1e293b',
    stoneColor: '#38bdf8',
    accent: '#22d3ee'
  }
];

type MoundOccupantKind = 'none' | 'skeleton' | 'pumpkin' | 'king' | 'angel_statue';

interface GraveMound {
  id: number;
  x: number;
  y: number;
  occupant: MoundOccupantKind;
  popProgress: number;
  stayTimer: number;
  cooldown: number;
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

interface ShockwaveRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  life: number;
}

interface KeeperState {
  id: PlayerId;
  config: PlayerConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  score: number;
  bashes: number;
  swingTimer: number;
  isCharging: boolean;
  charge: number;
  wasPressed: boolean;
  pressDuration: number;
  shuntCooldown: number;
  stunTimer: number;
  underdogActive: boolean;
}

export class GraveyardZombieBashGame extends BaseGame {
  private keepers: Map<PlayerId, KeeperState> = new Map();
  private mounds: GraveMound[] = [];
  private popups: FloatingPopup[] = [];
  private fxParticles: BurstParticle[] = [];
  private rings: ShockwaveRing[] = [];

  private roundDuration = 48;
  private elapsed = 0;
  private isOver = false;
  private suddenDeath = false;
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
    this.keepers.clear();
    this.mounds = [];
    this.popups = [];
    this.fxParticles = [];
    this.rings = [];
    this.screenShake = 0;

    this.roundTimer = this.roundDuration;
    this.elapsed = 0;
    this.isOver = false;
    this.suddenDeath = false;

    // Create 12 Grave Mounds in a 4x3 grid across the shared courtyard
    const cols = 4;
    const rows = 3;
    const startX = width * 0.2;
    const spanX = width * 0.6;
    const startY = 165;
    const spanY = height - 295;

    let idCounter = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const mx = startX + (c / (cols - 1)) * spanX + (r % 2 === 1 ? 16 : -16);
        const my = startY + (r / (rows - 1)) * spanY;
        this.mounds.push({
          id: idCounter++,
          x: mx,
          y: my,
          occupant: 'none',
          popProgress: 0,
          stayTimer: 0,
          cooldown: 0.3 + Math.random() * 1.4
        });
      }
    }

    const cx = width * 0.5;
    const cy = height * 0.54;
    const activePlayers = this.getActivePlayers();
    const count = Math.max(1, activePlayers.length);

    activePlayers.forEach((p, idx) => {
      const ang = (idx / count) * Math.PI * 2 + Math.PI * 0.25;
      this.keepers.set(p.id, {
        id: p.id,
        config: p,
        x: cx + Math.cos(ang) * 165,
        y: cy + Math.sin(ang) * 105,
        vx: 0,
        vy: 0,
        facingX: Math.cos(ang),
        facingY: Math.sin(ang),
        score: 0,
        bashes: 0,
        swingTimer: 0,
        isCharging: false,
        charge: 0,
        wasPressed: false,
        pressDuration: 0,
        shuntCooldown: 0,
        stunTimer: 0,
        underdogActive: false
      });
    });

    // Immediately pop up 4 targets so action starts at 0.0s!
    for (let i = 0; i < 4; i++) {
      this.popRandomMound();
    }
  }

  private popRandomMound(): void {
    const empty = this.mounds.filter((m) => m.occupant === 'none' && m.cooldown <= 0);
    if (empty.length === 0) return;
    const chosen = empty[Math.floor(Math.random() * empty.length)];
    const roll = Math.random();
    if (roll < 0.16) {
      chosen.occupant = 'angel_statue';
      chosen.stayTimer = 2.4;
    } else if (roll < (this.suddenDeath ? 0.52 : 0.32)) {
      chosen.occupant = 'king';
      chosen.stayTimer = 2.6;
    } else if (roll < 0.64) {
      chosen.occupant = 'pumpkin';
      chosen.stayTimer = 2.9;
    } else {
      chosen.occupant = 'skeleton';
      chosen.stayTimer = 3.2;
    }
    chosen.popProgress = 0.1;
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
      this.spawnPopup(width * 0.5, 118, 'SUDDEN DEATH! SKELETON KING INVASION!', '#facc15');
      for (let i = 0; i < 3; i++) {
        this.popRandomMound();
      }
    }

    if (this.roundTimer <= 0) {
      this.isOver = true;
      return;
    }

    // Update Mounds
    let activeCount = 0;
    for (const m of this.mounds) {
      if (m.occupant !== 'none') {
        activeCount++;
        m.popProgress = Math.min(1, m.popProgress + safeDt * 5.5);
        m.stayTimer -= safeDt;
        if (m.stayTimer <= 0) {
          m.occupant = 'none';
          m.popProgress = 0;
          m.cooldown = 0.6 + Math.random() * 1.1;
        }
      } else if (m.cooldown > 0) {
        m.cooldown = Math.max(0, m.cooldown - safeDt);
      }
    }

    const desiredActive = this.suddenDeath ? 7 : 5;
    if (activeCount < desiredActive && Math.random() < safeDt * 6.5) {
      this.popRandomMound();
    }

    // Underdog detection
    let maxScore = 0;
    this.keepers.forEach((k) => {
      if (k.score > maxScore) maxScore = k.score;
    });
    this.keepers.forEach((k) => {
      k.underdogActive = maxScore - k.score >= 55;
    });

    this.updateBots(safeDt, width, height);

    // Update Keepers
    this.keepers.forEach((k) => {
      if (k.swingTimer > 0) k.swingTimer = Math.max(0, k.swingTimer - safeDt);
      if (k.shuntCooldown > 0) k.shuntCooldown = Math.max(0, k.shuntCooldown - safeDt);
      if (k.stunTimer > 0) k.stunTimer = Math.max(0, k.stunTimer - safeDt);

      const steerX = this.input.getSteer(k.id);
      const steerY = -this.input.getThrottle(k.id);
      const isBot = k.config.type.startsWith('bot_');
      const actionHeld = !isBot ? this.input.isActionPressed(k.id) : this.input.isPressed(k.id);
      const actionJustPressed = !isBot ? this.input.justAction(k.id) : this.input.justPressed(k.id);

      // Hold-to-charge vs Quick Tap Shovel Bash
      if (actionHeld && k.stunTimer <= 0) {
        k.pressDuration += safeDt;
        if (k.pressDuration > 0.16) {
          k.isCharging = true;
          k.charge = Math.min(1, k.charge + safeDt * 0.9);
        }
      } else {
        if (k.wasPressed && k.stunTimer <= 0) {
          if (k.isCharging && k.charge >= 0.4) {
            this.executeSeismicSlam(k);
          } else {
            this.executeShovelSwing(k);
          }
        }
        k.isCharging = false;
        k.charge = 0;
        k.pressDuration = 0;
      }
      k.wasPressed = actionHeld;

      if (actionJustPressed && k.stunTimer <= 0 && !k.isCharging) {
        this.executeShovelSwing(k);
      }

      if (!k.config.type.startsWith('bot_') && k.stunTimer <= 0) {
        let moveX = steerX;
        let moveY = steerY;

        // 1-button fallback: automatically pursue nearest valid non-angel target!
        if (Math.abs(moveX) < 0.06 && Math.abs(moveY) < 0.06) {
          const bestMound = this.findBestMoundFor(k.x, k.y, true);
          if (bestMound) {
            const dx = bestMound.x - k.x;
            const dy = bestMound.y - k.y;
            const d = Math.hypot(dx, dy) || 1;
            moveX = (dx / d) * 0.72;
            moveY = (dy / d) * 0.72;
          }
        }

        const len = Math.hypot(moveX, moveY);
        if (len > 0.08) {
          const nx = moveX / Math.max(1, len);
          const ny = moveY / Math.max(1, len);
          k.facingX = nx;
          k.facingY = ny;
          const speedMult = (k.underdogActive ? 1.2 : 1.0) * (k.isCharging ? 0.68 : 1.0);
          k.vx += nx * 1350 * speedMult * safeDt;
          k.vy += ny * 1350 * speedMult * safeDt;
        }
      }

      const drag = Math.pow(0.018, safeDt);
      k.vx *= drag;
      k.vy *= drag;
      k.x += k.vx * safeDt;
      k.y += k.vy * safeDt;

      k.x = Math.max(54, Math.min(width - 54, k.x));
      k.y = Math.max(106, Math.min(height - 88, k.y));
    });

    // Elastic player-to-player collisions
    const list = Array.from(this.keepers.values());
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

    // Update rings, particles, popups
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += (r.maxR - r.r) * 10 * safeDt;
      r.life -= safeDt * 2.2;
      if (r.life <= 0) this.rings.splice(i, 1);
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

  private findBestMoundFor(x: number, y: number, avoidAngel: boolean): GraveMound | null {
    let best: GraveMound | null = null;
    let bestVal = -1e9;
    for (const m of this.mounds) {
      if (m.occupant === 'none') continue;
      if (avoidAngel && m.occupant === 'angel_statue') continue;
      const d = Math.hypot(m.x - x, m.y - y);
      const bonus = m.occupant === 'king' ? 140 : m.occupant === 'pumpkin' ? 60 : 25;
      const val = bonus - d;
      if (val > bestVal) {
        bestVal = val;
        best = m;
      }
    }
    return best;
  }

  private executeShovelSwing(k: KeeperState): void {
    k.swingTimer = 0.22;

    // Lunge slightly toward nearest active target if within 110px
    const near = this.findBestMoundFor(k.x, k.y, true);
    if (near && Math.hypot(near.x - k.x, near.y - k.y) < 120) {
      const dx = near.x - k.x;
      const dy = near.y - k.y;
      const d = Math.hypot(dx, dy) || 1;
      k.facingX = dx / d;
      k.facingY = dy / d;
      k.vx += (dx / d) * 230;
      k.vy += (dy / d) * 230;
    }

    for (const m of this.mounds) {
      if (m.occupant === 'none') continue;
      if (Math.hypot(m.x - k.x, m.y - k.y) <= 72) {
        this.resolveMoundHit(k, m, false);
      }
    }
  }

  private executeSeismicSlam(k: KeeperState): void {
    const isSweetSpot = k.charge >= 0.72 && k.charge <= 0.98;
    const radius = isSweetSpot ? 175 : 115;
    k.swingTimer = 0.32;
    k.shuntCooldown = 0.8;

    this.rings.push({
      x: k.x,
      y: k.y,
      r: 20,
      maxR: radius,
      color: isSweetSpot ? '#facc15' : k.config.color,
      life: 1.0
    });

    this.triggerScreenShake(isSweetSpot ? 6 : 3);
    this.spawnParticles(k.x, k.y, isSweetSpot ? '#facc15' : k.config.color, isSweetSpot ? 22 : 12);

    if (isSweetSpot) {
      k.score += 15;
      this.spawnPopup(k.x, k.y - 36, 'SEISMIC SHOVEL SLAM! +15', '#facc15');
    }

    // Smash all non-angel targets in shockwave radius!
    for (const m of this.mounds) {
      if (m.occupant === 'none' || m.occupant === 'angel_statue') continue;
      if (Math.hypot(m.x - k.x, m.y - k.y) <= radius) {
        this.resolveMoundHit(k, m, true);
      }
    }

    // Shunt nearby rival Keepers
    this.keepers.forEach((other) => {
      if (other.id === k.id) return;
      const dx = other.x - k.x;
      const dy = other.y - k.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= radius) {
        const push = isSweetSpot ? 540 : 320;
        other.vx += (dx / d) * push;
        other.vy += (dy / d) * push;
        if (isSweetSpot) {
          other.stunTimer = 0.45;
          this.spawnPopup(other.x, other.y - 28, 'SHOCKWAVE SHUNT!', '#fb923c');
        }
      }
    });
  }

  private resolveMoundHit(k: KeeperState, m: GraveMound, fromShockwave: boolean): void {
    const kind = m.occupant;
    m.occupant = 'none';
    m.popProgress = 0;
    m.cooldown = 0.75 + Math.random() * 0.9;

    if (kind === 'angel_statue' && !fromShockwave) {
      k.score = Math.max(0, k.score - 20);
      k.stunTimer = 0.65;
      this.triggerScreenShake(5);
      this.spawnParticles(m.x, m.y, '#ef4444', 18);
      this.spawnPopup(m.x, m.y - 24, 'ANGEL STATUE! -20 (STUN)', '#ef4444');
      return;
    }

    const basePts = kind === 'king' ? 65 : kind === 'pumpkin' ? 35 : 25;
    const pts = Math.round(basePts * (k.underdogActive ? 1.25 : 1));
    k.score += pts;
    k.bashes++;

    const color = kind === 'king' ? '#facc15' : kind === 'pumpkin' ? '#fb923c' : '#4ade80';
    this.triggerScreenShake(kind === 'king' ? 5 : 3);
    this.spawnParticles(m.x, m.y, color, kind === 'king' ? 22 : 14);
    this.spawnPopup(
      m.x,
      m.y - 24,
      kind === 'king' ? `ROYAL SKELETON! +${pts}` : `WHACK! +${pts}`,
      color
    );
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.keepers.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    const skill = difficulty === 'bot_hard' ? 1.0 : difficulty === 'bot_normal' ? 0.82 : 0.65;
    const avoidAngel = difficulty !== 'bot_easy' || Math.random() < 0.78;
    const target = this.findBestMoundFor(bot.x, bot.y, avoidAngel);

    if (target) {
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const d = Math.hypot(dx, dy) || 1;
      bot.facingX = dx / d;
      bot.facingY = dy / d;
      bot.vx += bot.facingX * 1180 * skill * dt;
      bot.vy += bot.facingY * 1180 * skill * dt;

      if (d <= 64 && bot.swingTimer <= 0) {
        if (difficulty !== 'bot_easy' && bot.shuntCooldown <= 0 && Math.random() < 0.28) {
          bot.charge = difficulty === 'bot_hard' ? 0.84 : 0.65;
          this.executeSeismicSlam(bot);
          bot.charge = 0;
        } else {
          this.executeShovelSwing(bot);
        }
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

    // 1. Sky & Courtyard Turf
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.turfColor;
    ctx.beginPath();
    ctx.roundRect(38, 92, width - 76, height - 168, 24);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 2. Shockwave Rings
    for (const r of this.rings) {
      ctx.globalAlpha = Math.max(0, r.life);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 3. Grave Mounds & Pop-up Occupants
    for (const m of this.mounds) {
      this.drawMound(ctx, m, theme);
    }

    // 4. Keepers sorted by Y
    const sorted = Array.from(this.keepers.values()).sort((a, b) => a.y - b.y);
    for (const k of sorted) {
      this.drawKeeper(ctx, k);
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

  private drawMound(ctx: CanvasRenderingContext2D, m: GraveMound, theme: CourtyardTheme): void {
    ctx.save();
    ctx.translate(m.x, m.y);

    // Carved headstone behind mound
    ctx.fillStyle = theme.stoneColor;
    ctx.beginPath();
    ctx.roundRect(-22, -38, 44, 34, [16, 16, 4, 4]);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dirt mound ellipse
    ctx.fillStyle = theme.moundDirt;
    ctx.beginPath();
    ctx.ellipse(0, 6, 34, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (m.occupant !== 'none') {
      const lift = m.popProgress * 18;
      ctx.translate(0, -lift);

      if (m.occupant === 'angel_statue') {
        // Winged Marble Angel Statue with Golden Halo (DO NOT HIT!)
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(0, -4, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Golden Halo
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, -22, 12, 4, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#f87171';
        ctx.font = '800 10px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ANGEL', 0, 18);
      } else if (m.occupant === 'king') {
        // Golden Skeleton King
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, -4, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Crown
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(-12, -16);
        ctx.lineTo(-8, -28);
        ctx.lineTo(0, -20);
        ctx.lineTo(8, -28);
        ctx.lineTo(12, -16);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(-5, -5, 3, 0, Math.PI * 2);
        ctx.arc(5, -5, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.occupant === 'pumpkin') {
        // Glowing Jack-O'-Lantern
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.ellipse(0, -4, 17, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fed7aa';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-5, -6, 3, 0, Math.PI * 2);
        ctx.arc(5, -6, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Playful Rattle Skeleton
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(0, -4, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#bbf7d0';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(-5, -5, 3, 0, Math.PI * 2);
        ctx.arc(5, -5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawKeeper(ctx: CanvasRenderingContext2D, k: KeeperState): void {
    ctx.save();

    if (k.underdogActive) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 29 + Math.sin(this.elapsed * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Swing arc indicator
    if (k.swingTimer > 0) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 56, 0, Math.PI * 2);
      ctx.stroke();
    }

    const mood: CharacterMood = k.stunTimer > 0 ? 'shocked' : k.isCharging || k.swingTimer > 0 ? 'triumph' : 'focused';
    this.drawPlayerMascot(ctx, k.id, k.x, k.y, 22, mood, this.elapsed, Math.atan2(k.facingY, k.facingX));

    if (k.isCharging && k.charge > 0.08) {
      const sweet = k.charge >= 0.72 && k.charge <= 0.98;
      ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 32, -Math.PI * 0.5, -Math.PI * 0.5 + k.charge * Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3;
    ctx.strokeText(k.config.name, k.x, k.y + 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(k.config.name, k.x, k.y + 36);

    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: CourtyardTheme): void {
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
        ? `⚡ SUDDEN DEATH BASH • ${timeStr} ⚡`
        : `MIDNIGHT COURTYARD BASH • ${timeStr}`,
      width * 0.5,
      71
    );

    const cardW = 168;
    const cardH = 66;
    const players = Array.from(this.keepers.values());
    players.forEach((k, idx) => {
      const cardX = idx % 2 === 0 ? 20 : width - cardW - 20;
      const cardY = idx < 2 ? height - 128 : 54;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = k.config.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = k.config.color;
      ctx.font = '800 13px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(k.config.name, cardX + 12, cardY + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px "Outfit", sans-serif';
      ctx.fillText(`${k.score} PTS`, cardX + 12, cardY + 46);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 11px "Outfit", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`WHACKS: ${k.bashes}`, cardX + cardW - 12, cardY + 22);
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
    return this.keepers.get(playerId)?.score ?? 0;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.keepers.values()).sort((a, b) => b.score - a.score);
    const rankings = sorted.map((k, idx) => ({
      playerId: k.id,
      score: k.score,
      place: idx + 1
    }));
    const isTie = sorted.length >= 2 && sorted[0].score === sorted[1].score;
    const winnerId = isTie || sorted.length === 0 ? null : sorted[0].id;
    return {
      winnerId,
      rankings,
      mvpHighlight: sorted[0]
        ? `${sorted[0].config.name} whacked ${sorted[0].bashes} targets (${sorted[0].score} pts)!`
        : 'Courtyard Bash Complete!'
    };
  }

  public handlePointerDown(x: number, y: number, _width: number, height: number): boolean {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playSelect();
      return true;
    }
    return false;
  }
}
