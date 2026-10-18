import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

/**
 * [G-237] Telekinetic Toyroom (Gravity Wand Levitation)
 * Overhauled according to the 8 Pillars of Fun & Wholesome Arcade Re-Theme:
 * - Re-themed from creepy "Poltergeist Possession" into a vibrant, magical 2.5D Telekinetic Toyroom & Gravity Lab!
 * - 2.5D Mascot Mages (`this.drawPlayerMascot`) glide across the shared workshop (`Steer: Move Mage`), automatically
 *   tethering nearby floating props (`Clockwork Rocket`, `Crystal Globe`, `Golden Music Box`, `Heavy Brass Anvil`)
 *   with their glowing Gravity Wand beam!
 * - Tap Action to HURL your levitated prop at floating Holo-Dummies (+40 pts), into the Central Starlight Portal (+45 pts),
 *   or straight at rival players (+30 pts + knockback)!
 * - Hold Action (72%–98% sweet-spot) to unleash a Telekinetic Repulsor Wave & Gravity Shunt that blasts every nearby
 *   prop outward at high speed and shunts rival mages across the room!
 * - 3 swappable visual themes (`wizard_toyroom`, `gravity_lab`, `cyber_workshop`) via [T]/[1-3] or Theme Pill.
 */

type ToyroomThemeId = 'wizard_toyroom' | 'gravity_lab' | 'cyber_workshop';

interface ToyroomTheme {
  id: ToyroomThemeId;
  name: string;
  bgTop: string;
  bgBottom: string;
  floorColor: string;
  gridColor: string;
  portalInner: string;
  portalOuter: string;
  accent: string;
}

const THEMES: ToyroomTheme[] = [
  {
    id: 'wizard_toyroom',
    name: 'Arcane Toyroom',
    bgTop: '#1a103c',
    bgBottom: '#311b61',
    floorColor: '#231447',
    gridColor: 'rgba(192, 132, 252, 0.16)',
    portalInner: '#facc15',
    portalOuter: '#a855f7',
    accent: '#c084fc'
  },
  {
    id: 'gravity_lab',
    name: 'Zero-G Observatory',
    bgTop: '#081c2e',
    bgBottom: '#0f3352',
    floorColor: '#0c2640',
    gridColor: 'rgba(56, 189, 248, 0.18)',
    portalInner: '#38bdf8',
    portalOuter: '#0284c7',
    accent: '#38bdf8'
  },
  {
    id: 'cyber_workshop',
    name: 'Neon Synth Foundry',
    bgTop: '#090919',
    bgBottom: '#1e1b4b',
    floorColor: '#11112b',
    gridColor: 'rgba(244, 63, 94, 0.18)',
    portalInner: '#22d3ee',
    portalOuter: '#f43f5e',
    accent: '#f43f5e'
  }
];

type PropKind = 'rocket' | 'globe' | 'music_box' | 'anvil';

interface LevitatedProp {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
  heldBy: PlayerId | null;
  thrownBy: PlayerId | null;
  thrownTimer: number;
  bobPhase: number;
}

interface HoloTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isGolden: boolean;
  pulsePhase: number;
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

interface MageState {
  id: PlayerId;
  config: PlayerConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimX: number;
  aimY: number;
  score: number;
  hits: number;
  heldPropId: number | null;
  isCharging: boolean;
  charge: number;
  wasPressed: boolean;
  pressDuration: number;
  shuntCooldown: number;
  stunTimer: number;
  underdogActive: boolean;
}

export class PoltergeistPossessionGame extends BaseGame {
  private mages: Map<PlayerId, MageState> = new Map();
  private props: LevitatedProp[] = [];
  private targets: HoloTarget[] = [];
  private popups: FloatingPopup[] = [];
  private fxParticles: SparkParticle[] = [];

  private roundDuration = 48;
  private elapsed = 0;
  private isOver = false;
  private suddenDeath = false;
  private nextEntityId = 1;
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
    this.mages.clear();
    this.props = [];
    this.targets = [];
    this.popups = [];
    this.fxParticles = [];
    this.screenShake = 0;

    this.roundTimer = this.roundDuration;
    this.elapsed = 0;
    this.isOver = false;
    this.suddenDeath = false;
    this.nextEntityId = 1;

    const cx = width * 0.5;
    const cy = height * 0.54;
    const activePlayers = this.getActivePlayers();
    const count = Math.max(1, activePlayers.length);

    activePlayers.forEach((p, idx) => {
      const ang = (idx / count) * Math.PI * 2 + Math.PI * 0.25;
      const sx = cx + Math.cos(ang) * 185;
      const sy = cy + Math.sin(ang) * 125;
      this.mages.set(p.id, {
        id: p.id,
        config: p,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        aimX: -Math.cos(ang),
        aimY: -Math.sin(ang),
        score: 0,
        hits: 0,
        heldPropId: null,
        isCharging: false,
        charge: 0,
        wasPressed: false,
        pressDuration: 0,
        shuntCooldown: 0,
        stunTimer: 0,
        underdogActive: false
      });
    });

    for (let i = 0; i < 10; i++) {
      this.spawnProp(width, height);
    }

    for (let i = 0; i < 5; i++) {
      this.spawnTarget(width, height);
    }
  }

  private spawnProp(width: number, height: number): void {
    const kinds: PropKind[] = ['rocket', 'globe', 'music_box', 'anvil'];
    const kind =
      Math.random() < (this.suddenDeath ? 0.38 : 0.22)
        ? 'music_box'
        : kinds[Math.floor(Math.random() * kinds.length)];

    const x = 85 + Math.random() * (width - 170);
    const y = 125 + Math.random() * (height - 235);
    this.props.push({
      id: this.nextEntityId++,
      kind,
      x,
      y,
      vx: (Math.random() - 0.5) * 65,
      vy: (Math.random() - 0.5) * 65,
      radius: kind === 'anvil' ? 20 : 17,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3,
      heldBy: null,
      thrownBy: null,
      thrownTimer: 0,
      bobPhase: Math.random() * Math.PI * 2
    });
  }

  private spawnTarget(width: number, height: number): void {
    const ang = Math.random() * Math.PI * 2;
    const spd = 65 + Math.random() * 55;
    this.targets.push({
      id: this.nextEntityId++,
      x: 95 + Math.random() * (width - 190),
      y: 130 + Math.random() * (height - 245),
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      radius: 22,
      isGolden: Math.random() < (this.suddenDeath ? 0.45 : 0.24),
      pulsePhase: Math.random() * Math.PI * 2
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
      this.spawnPopup(width * 0.5, 118, 'SUDDEN DEATH! GOLDEN MUSIC BOX OVERLOAD!', '#facc15');
      for (let i = 0; i < 3; i++) {
        this.spawnProp(width, height);
        this.spawnTarget(width, height);
      }
    }

    if (this.roundTimer <= 0) {
      this.isOver = true;
      return;
    }

    let maxScore = 0;
    this.mages.forEach((m) => {
      if (m.score > maxScore) maxScore = m.score;
    });
    this.mages.forEach((m) => {
      m.underdogActive = maxScore - m.score >= 55;
    });

    this.updateBots(safeDt, width, height);

    const cx = width * 0.5;
    const cy = height * 0.54;

    this.mages.forEach((m) => {
      if (m.shuntCooldown > 0) m.shuntCooldown = Math.max(0, m.shuntCooldown - safeDt);
      if (m.stunTimer > 0) m.stunTimer = Math.max(0, m.stunTimer - safeDt);

      const hasSteer = this.input.hasSteer(m.id);
      const steerX = hasSteer ? this.input.getSteer(m.id) : 0;
      const steerY = hasSteer ? -this.input.getThrottle(m.id) : 0;
      const isBot = m.config.type.startsWith('bot_');
      const actionHeld = this.input.isActionPressed(m.id) || (isBot && this.input.isPressed(m.id)) || (!hasSteer && !isBot && this.input.isPressed(m.id));

      // Hold-to-Charge vs Quick Tap Hurl
      if (actionHeld) {
        m.pressDuration += safeDt;
        if (m.pressDuration > 0.16) {
          m.isCharging = true;
          m.charge = Math.min(1, m.charge + safeDt * 0.9);
        }
      } else {
        if (m.wasPressed) {
          if (m.isCharging && m.charge >= 0.4) {
            this.executeRepulsorShunt(m, width, height);
          } else if (m.heldPropId !== null) {
            this.hurlHeldProp(m, width, height, 620);
          } else {
            // Quick tap while empty-handed pulls nearest prop into your Gravity Wand tether!
            this.tryTetherNearestProp(m, 145);
          }
        }
        m.isCharging = false;
        m.charge = 0;
        m.pressDuration = 0;
      }
      m.wasPressed = actionHeld;

      if (!m.config.type.startsWith('bot_')) {
        let moveX = steerX;
        let moveY = steerY;
        if (Math.abs(moveX) < 0.06 && Math.abs(moveY) < 0.06) {
          // 1-button fallback: automatically glide toward nearest untethered prop or aim toward best target
          if (m.heldPropId === null) {
            const bestProp = this.findNearestFreeProp(m.x, m.y);
            if (bestProp) {
              const dx = bestProp.x - m.x;
              const dy = bestProp.y - m.y;
              const d = Math.hypot(dx, dy) || 1;
              moveX = (dx / d) * 0.72;
              moveY = (dy / d) * 0.72;
            }
          } else {
            const bestTarget = this.findBestTargetPoint(m.x, m.y, cx, cy);
            const dx = bestTarget.x - m.x;
            const dy = bestTarget.y - m.y;
            const d = Math.hypot(dx, dy) || 1;
            m.aimX = dx / d;
            m.aimY = dy / d;
            moveX = (dx / d) * 0.55;
            moveY = (dy / d) * 0.55;
          }
        }

        const len = Math.hypot(moveX, moveY);
        if (len > 0.08 && m.stunTimer <= 0) {
          const nx = moveX / Math.max(1, len);
          const ny = moveY / Math.max(1, len);
          m.aimX = nx;
          m.aimY = ny;
          const speedMult = (m.underdogActive ? 1.2 : 1.0) * (m.isCharging ? 0.7 : 1.0);
          m.vx += nx * 1320 * speedMult * safeDt;
          m.vy += ny * 1320 * speedMult * safeDt;
        }
      }

      const drag = Math.pow(0.02, safeDt);
      m.vx *= drag;
      m.vy *= drag;
      m.x += m.vx * safeDt;
      m.y += m.vy * safeDt;

      const minX = 54;
      const maxX = width - 54;
      const minY = 104;
      const maxY = height - 88;
      if (m.x < minX) { m.x = minX; m.vx = Math.abs(m.vx) * 0.6; }
      if (m.x > maxX) { m.x = maxX; m.vx = -Math.abs(m.vx) * 0.6; }
      if (m.y < minY) { m.y = minY; m.vy = Math.abs(m.vy) * 0.6; }
      if (m.y > maxY) { m.y = maxY; m.vy = -Math.abs(m.vy) * 0.6; }

      // Auto-tether nearby prop if empty-handed
      if (m.heldPropId === null && m.stunTimer <= 0) {
        this.tryTetherNearestProp(m, 64);
      }
    });

    // Elastic player-to-player collisions
    const list = Array.from(this.mages.values());
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
            this.spawnParticles((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#c084fc', 8);
          }
        }
      }
    }

    // Update Targets
    for (const t of this.targets) {
      t.pulsePhase += safeDt * 4.5;
      t.x += t.vx * safeDt;
      t.y += t.vy * safeDt;
      if (t.x < 75 || t.x > width - 75) t.vx *= -1;
      if (t.y < 118 || t.y > height - 98) t.vy *= -1;
      t.x = Math.max(70, Math.min(width - 70, t.x));
      t.y = Math.max(114, Math.min(height - 94, t.y));
    }

    // Update Props & Collisions
    for (let i = this.props.length - 1; i >= 0; i--) {
      const pr = this.props[i];
      pr.bobPhase += safeDt * 4;
      pr.rotation += pr.rotSpeed * safeDt;

      if (pr.heldBy !== null) {
        const holder = this.mages.get(pr.heldBy);
        if (!holder) {
          pr.heldBy = null;
        } else {
          const orbitX = holder.x + holder.aimX * 42;
          const orbitY = holder.y + holder.aimY * 42;
          pr.vx = (orbitX - pr.x) * 14;
          pr.vy = (orbitY - pr.y) * 14;
          pr.x += pr.vx * safeDt;
          pr.y += pr.vy * safeDt;
        }
      } else {
        if (pr.thrownTimer > 0) {
          pr.thrownTimer = Math.max(0, pr.thrownTimer - safeDt);
          if (pr.thrownTimer <= 0) pr.thrownBy = null;
        }

        pr.x += pr.vx * safeDt;
        pr.y += pr.vy * safeDt;
        pr.vx *= Math.pow(0.28, safeDt);
        pr.vy *= Math.pow(0.28, safeDt);

        if (pr.x < 62) { pr.x = 62; pr.vx = Math.abs(pr.vx) * 0.85; }
        if (pr.x > width - 62) { pr.x = width - 62; pr.vx = -Math.abs(pr.vx) * 0.85; }
        if (pr.y < 112) { pr.y = 112; pr.vy = Math.abs(pr.vy) * 0.85; }
        if (pr.y > height - 92) { pr.y = height - 92; pr.vy = -Math.abs(pr.vy) * 0.85; }

        // Check if thrown prop hits Central Starlight Vortex Portal
        if (pr.thrownBy && Math.hypot(pr.x - cx, pr.y - cy) <= 46) {
          const owner = this.mages.get(pr.thrownBy);
          if (owner) {
            const basePts = pr.kind === 'music_box' ? 65 : 40;
            const pts = Math.round(basePts * (owner.underdogActive ? 1.25 : 1));
            owner.score += pts;
            owner.hits++;
            this.triggerScreenShake(4);
            this.spawnParticles(cx, cy, '#facc15', 18);
            this.spawnPopup(cx, cy - 26, `PORTAL DUNK! +${pts}`, '#facc15');
          }
          this.props.splice(i, 1);
          this.spawnProp(width, height);
          continue;
        }

        // Check if thrown prop hits a Holo-Target
        let consumed = false;
        if (pr.thrownBy && Math.hypot(pr.vx, pr.vy) > 130) {
          const owner = this.mages.get(pr.thrownBy);
          for (let tIdx = this.targets.length - 1; tIdx >= 0; tIdx--) {
            const t = this.targets[tIdx];
            if (Math.hypot(t.x - pr.x, t.y - pr.y) <= t.radius + pr.radius + 6) {
              if (owner) {
                const basePts = (t.isGolden ? 60 : 35) + (pr.kind === 'music_box' ? 25 : 0);
                const pts = Math.round(basePts * (owner.underdogActive ? 1.25 : 1));
                owner.score += pts;
                owner.hits++;
                this.triggerScreenShake(5);
                this.spawnParticles(t.x, t.y, t.isGolden ? '#facc15' : '#38bdf8', 20);
                this.spawnPopup(t.x, t.y - 24, `BULLSEYE! +${pts}`, t.isGolden ? '#facc15' : '#38bdf8');
              }
              this.targets.splice(tIdx, 1);
              this.spawnTarget(width, height);
              this.props.splice(i, 1);
              this.spawnProp(width, height);
              consumed = true;
              break;
            }
          }
          if (consumed) continue;

          // Check if thrown prop hits a rival Mage!
          this.mages.forEach((other) => {
            if (other.id === pr.thrownBy) return;
            if (Math.hypot(other.x - pr.x, other.y - pr.y) <= pr.radius + 24) {
              other.vx += pr.vx * 0.85;
              other.vy += pr.vy * 0.85;
              other.stunTimer = 0.4;
              if (owner) {
                owner.score += 25;
                owner.hits++;
                this.spawnPopup(other.x, other.y - 28, 'PROP SMASH! +25', '#f43f5e');
              }
              this.triggerScreenShake(5);
              this.spawnParticles(other.x, other.y, '#f43f5e', 16);
              pr.thrownBy = null;
              pr.vx *= -0.4;
              pr.vy *= -0.4;
            }
          });
        }
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

  private findNearestFreeProp(x: number, y: number): LevitatedProp | null {
    let best: LevitatedProp | null = null;
    let bestVal = 1e9;
    for (const pr of this.props) {
      if (pr.heldBy !== null) continue;
      const d = Math.hypot(pr.x - x, pr.y - y) - (pr.kind === 'music_box' ? 60 : 0);
      if (d < bestVal) {
        bestVal = d;
        best = pr;
      }
    }
    return best;
  }

  private findBestTargetPoint(x: number, y: number, cx: number, cy: number): { x: number; y: number } {
    let best = { x: cx, y: cy };
    let bestDist = Math.hypot(cx - x, cy - y);
    for (const t of this.targets) {
      const d = Math.hypot(t.x - x, t.y - y) - (t.isGolden ? 80 : 30);
      if (d < bestDist) {
        bestDist = d;
        best = { x: t.x, y: t.y };
      }
    }
    return best;
  }

  private tryTetherNearestProp(m: MageState, maxRadius: number): void {
    if (m.heldPropId !== null) return;
    let best: LevitatedProp | null = null;
    let bestDist = maxRadius;
    for (const pr of this.props) {
      if (pr.heldBy !== null) continue;
      const d = Math.hypot(pr.x - m.x, pr.y - m.y);
      if (d <= bestDist) {
        bestDist = d;
        best = pr;
      }
    }
    if (best) {
      best.heldBy = m.id;
      best.thrownBy = null;
      m.heldPropId = best.id;
      this.spawnParticles(best.x, best.y, m.config.color, 8);
    }
  }

  private hurlHeldProp(m: MageState, width: number, height: number, speed: number): void {
    if (m.heldPropId === null) return;
    const pr = this.props.find((p) => p.id === m.heldPropId);
    m.heldPropId = null;
    if (!pr) return;

    // Auto-assist aim slightly toward nearest target or central portal so hurls feel super satisfying!
    const bestTarget = this.findBestTargetPoint(pr.x, pr.y, width * 0.5, height * 0.54);
    const tdx = bestTarget.x - pr.x;
    const tdy = bestTarget.y - pr.y;
    const td = Math.hypot(tdx, tdy) || 1;
    const blendX = m.aimX * 0.55 + (tdx / td) * 0.45;
    const blendY = m.aimY * 0.55 + (tdy / td) * 0.45;
    const blen = Math.hypot(blendX, blendY) || 1;

    pr.heldBy = null;
    pr.thrownBy = m.id;
    pr.thrownTimer = 1.6;
    pr.vx = (blendX / blen) * speed;
    pr.vy = (blendY / blen) * speed;
    pr.rotSpeed = 12;

    this.spawnParticles(pr.x, pr.y, m.config.color, 12);
    this.triggerScreenShake(3);
  }

  private executeRepulsorShunt(m: MageState, width: number, height: number): void {
    const isSweetSpot = m.charge >= 0.72 && m.charge <= 0.98;
    const speed = isSweetSpot ? 780 : 540;

    if (m.heldPropId !== null) {
      this.hurlHeldProp(m, width, height, speed);
    }

    // Blast all nearby free props toward targets!
    const radius = isSweetSpot ? 175 : 115;
    for (const pr of this.props) {
      if (pr.heldBy !== null) continue;
      const dx = pr.x - m.x;
      const dy = pr.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= radius) {
        const target = this.findBestTargetPoint(pr.x, pr.y, width * 0.5, height * 0.54);
        const tx = target.x - pr.x;
        const ty = target.y - pr.y;
        const td = Math.hypot(tx, ty) || 1;
        pr.thrownBy = m.id;
        pr.thrownTimer = 1.8;
        pr.vx = (tx / td) * speed;
        pr.vy = (ty / td) * speed;
      }
    }

    // Shunt nearby rival Mages
    this.mages.forEach((other) => {
      if (other.id === m.id) return;
      const dx = other.x - m.x;
      const dy = other.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= radius) {
        const push = isSweetSpot ? 540 : 320;
        other.vx += (dx / d) * push;
        other.vy += (dy / d) * push;
        if (isSweetSpot) {
          other.stunTimer = 0.45;
          this.spawnPopup(other.x, other.y - 28, 'GRAVITY SHUNT!', '#c084fc');
        }
      }
    });

    m.shuntCooldown = 0.8;
    this.triggerScreenShake(isSweetSpot ? 6 : 3);
    this.spawnParticles(m.x, m.y, isSweetSpot ? '#facc15' : m.config.color, isSweetSpot ? 24 : 12);

    if (isSweetSpot) {
      m.score += 15;
      this.spawnPopup(m.x, m.y - 36, 'REPULSOR WAVE! +15', '#facc15');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const bot = this.mages.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    const skill = difficulty === 'bot_hard' ? 1.0 : difficulty === 'bot_normal' ? 0.82 : 0.65;
    const cx = width * 0.5;
    const cy = height * 0.54;

    if (bot.heldPropId !== null) {
      const target = this.findBestTargetPoint(bot.x, bot.y, cx, cy);
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const d = Math.hypot(dx, dy) || 1;
      bot.aimX = dx / d;
      bot.aimY = dy / d;
      bot.vx += bot.aimX * 980 * skill * dt;
      bot.vy += bot.aimY * 980 * skill * dt;

      if (d < 240 && Math.random() < dt * (difficulty === 'bot_hard' ? 4.2 : 2.5)) {
        this.hurlHeldProp(bot, width, height, 620);
      }
      return;
    }

    const bestProp = this.findNearestFreeProp(bot.x, bot.y);
    if (bestProp) {
      const dx = bestProp.x - bot.x;
      const dy = bestProp.y - bot.y;
      const d = Math.hypot(dx, dy) || 1;
      bot.aimX = dx / d;
      bot.aimY = dy / d;
      bot.vx += bot.aimX * 1120 * skill * dt;
      bot.vy += bot.aimY * 1120 * skill * dt;
    }

    if (difficulty !== 'bot_easy' && bot.shuntCooldown <= 0 && Math.random() < dt * 0.6) {
      bot.charge = difficulty === 'bot_hard' ? 0.85 : 0.65;
      this.executeRepulsorShunt(bot, width, height);
      bot.charge = 0;
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 160;
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
    const cx = width * 0.5;
    const cy = height * 0.54;

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Background & Shared Workshop Floor
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.floorColor;
    ctx.beginPath();
    ctx.roundRect(38, 92, width - 76, height - 168, 24);
    ctx.fill();
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Central Starlight Scoring Portal
    this.drawCentralPortal(ctx, cx, cy, theme);

    // 2. Holo-Targets
    for (const t of this.targets) {
      this.drawHoloTarget(ctx, t);
    }

    // 3. Gravity Wand Tether Beams
    this.mages.forEach((m) => {
      if (m.heldPropId !== null) {
        const pr = this.props.find((p) => p.id === m.heldPropId);
        if (pr) {
          ctx.strokeStyle = m.config.color;
          ctx.lineWidth = 3.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(m.x, m.y - 8);
          ctx.lineTo(pr.x, pr.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });

    // 4. Floating Toyroom Props
    for (const pr of this.props) {
      this.drawProp(ctx, pr);
    }

    // 5. Mages sorted by Y
    const sortedMages = Array.from(this.mages.values()).sort((a, b) => a.y - b.y);
    for (const m of sortedMages) {
      this.drawMage(ctx, m);
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

  private drawCentralPortal(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: ToyroomTheme): void {
    ctx.save();
    ctx.translate(cx, cy);
    const pulse = 1 + Math.sin(this.elapsed * 4) * 0.06;
    ctx.scale(pulse, pulse);

    const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, 48);
    grad.addColorStop(0, theme.portalInner);
    grad.addColorStop(0.6, theme.portalOuter);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme.portalInner;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, 40, this.elapsed * 2, this.elapsed * 2 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 10px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STAR PORTAL', 0, 4);
    ctx.restore();
  }

  private drawHoloTarget(ctx: CanvasRenderingContext2D, t: HoloTarget): void {
    ctx.save();
    ctx.translate(t.x, t.y);
    const r = t.radius + Math.sin(t.pulsePhase) * 2;
    ctx.fillStyle = t.isGolden ? 'rgba(250, 204, 21, 0.25)' : 'rgba(56, 189, 248, 0.22)';
    ctx.strokeStyle = t.isGolden ? '#facc15' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = t.isGolden ? '#fef08a' : '#bae6fd';
    ctx.font = '800 10px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.isGolden ? '+60' : '+35', 0, 4);
    ctx.restore();
  }

  private drawProp(ctx: CanvasRenderingContext2D, pr: LevitatedProp): void {
    ctx.save();
    ctx.translate(pr.x, pr.y + Math.sin(pr.bobPhase) * 3);
    ctx.rotate(pr.rotation);

    if (pr.kind === 'music_box') {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-14, -14, 28, 28, 6);
      ctx.fill();
      ctx.stroke();
    } else if (pr.kind === 'rocket') {
      ctx.fillStyle = '#f43f5e';
      ctx.strokeStyle = '#fecdd3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(12, 12);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (pr.kind === 'globe') {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-16, -11, 32, 22, 5);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMage(ctx: CanvasRenderingContext2D, m: MageState): void {
    ctx.save();

    if (m.underdogActive) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 29 + Math.sin(this.elapsed * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    const mood: CharacterMood = m.stunTimer > 0 ? 'shocked' : m.isCharging ? 'triumph' : 'focused';
    this.drawPlayerMascot(ctx, m.id, m.x, m.y, 22, mood, this.elapsed, Math.atan2(m.aimY, m.aimX));

    if (m.isCharging && m.charge > 0.08) {
      const sweet = m.charge >= 0.72 && m.charge <= 0.98;
      ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 32, -Math.PI * 0.5, -Math.PI * 0.5 + m.charge * Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3;
    ctx.strokeText(m.config.name, m.x, m.y + 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(m.config.name, m.x, m.y + 36);

    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: ToyroomTheme): void {
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
        ? `⚡ SUDDEN DEATH TOYROOM • ${timeStr} ⚡`
        : `TELEKINETIC TOYROOM • ${timeStr}`,
      width * 0.5,
      71
    );

    const cardW = 168;
    const cardH = 66;
    const players = Array.from(this.mages.values());
    players.forEach((m, idx) => {
      const cardX = idx % 2 === 0 ? 20 : width - cardW - 20;
      const cardY = idx < 2 ? height - 128 : 54;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = m.config.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = m.config.color;
      ctx.font = '800 13px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(m.config.name, cardX + 12, cardY + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px "Outfit", sans-serif';
      ctx.fillText(`${m.score} PTS`, cardX + 12, cardY + 46);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 11px "Outfit", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`HITS: ${m.hits}`, cardX + cardW - 12, cardY + 22);
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
    return this.mages.get(playerId)?.score ?? 0;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.mages.values()).sort((a, b) => b.score - a.score);
    const rankings = sorted.map((m, idx) => ({
      playerId: m.id,
      score: m.score,
      place: idx + 1
    }));
    const isTie = sorted.length >= 2 && sorted[0].score === sorted[1].score;
    const winnerId = isTie || sorted.length === 0 ? null : sorted[0].id;
    return {
      winnerId,
      rankings,
      mvpHighlight: sorted[0]
        ? `${sorted[0].config.name} scored ${sorted[0].score} pts (${sorted[0].hits} hits)!`
        : 'Toyroom Complete!'
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
