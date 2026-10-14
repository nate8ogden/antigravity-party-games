import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type MirrorTheme = 'carnival' | 'crystal' | 'cyber';

interface MirrorPane {
  id: number;
  cx: number;
  cy: number;
  length: number;
  angle: number;
  rotSpeed: number;
  type: 'FLAT' | 'WAVY' | 'PRISM';
  shimmerPhase: number;
}

interface MirrorPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  radius: number;
  staggerTimer: number;
  phaseTimer: number;
  isCharging: boolean;
  chargeRatio: number;
  overloadTimer: number;
  score: number;
  escapes: number;
  shunts: number;
  isUnderdog: boolean;
  botReactionTimer: number;
  botSteerX: number;
  botSteerY: number;
  botTargetCharge: number;
}

interface PrizeGem {
  id: number;
  x: number;
  y: number;
  radius: number;
  points: number;
  type: 'gem' | 'crown';
  collected: boolean;
  respawnTimer: number;
}

export class FunhouseMirrorsGame extends BaseGame {
  public theme: MirrorTheme = 'carnival';
  private mirrors: MirrorPane[] = [];
  private playersState: Map<PlayerId, MirrorPlayer> = new Map();
  private gems: PrizeGem[] = [];
  private exitX: number = 0;
  private exitY: number = 0;
  private exitRadius: number = 28;
  private exitSpotIndex: number = 0;
  private suddenDeathTriggered: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private mousedownListener: ((e: MouseEvent) => void) | null = null;
  private lastWidth: number = 800;
  private lastHeight: number = 600;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.reset(width, height);

    if (typeof window !== 'undefined') {
      this.keydownListener = (e: KeyboardEvent) => {
        if (e.key === '1') this.switchTheme('carnival', this.lastWidth, this.lastHeight);
        else if (e.key === '2') this.switchTheme('crystal', this.lastWidth, this.lastHeight);
        else if (e.key === '3') this.switchTheme('cyber', this.lastWidth, this.lastHeight);
        else if (e.key === 't' || e.key === 'T') {
          const order: MirrorTheme[] = ['carnival', 'crystal', 'cyber'];
          const next = order[(order.indexOf(this.theme) + 1) % order.length];
          this.switchTheme(next, this.lastWidth, this.lastHeight);
        }
      };
      this.mousedownListener = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        if (mx >= 20 && mx <= 190 && my >= this.lastHeight - 44 && my <= this.lastHeight - 12) {
          const order: MirrorTheme[] = ['carnival', 'crystal', 'cyber'];
          const next = order[(order.indexOf(this.theme) + 1) % order.length];
          this.switchTheme(next, this.lastWidth, this.lastHeight);
        }
      };
      window.addEventListener('keydown', this.keydownListener);
      window.addEventListener('mousedown', this.mousedownListener);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      if (this.mousedownListener) {
        window.removeEventListener('mousedown', this.mousedownListener);
        this.mousedownListener = null;
      }
    }
  }

  public switchTheme(theme: MirrorTheme, width: number, height: number): void {
    this.theme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `THEME: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'carnival' ? '#F59E0B' : theme === 'crystal' ? '#38BDF8' : '#EC4899',
      22
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.isFinished = false;
    this.suddenDeathTriggered = false;
    this.roundTimer = 36.0;
    this.mirrors = [];
    this.gems = [];
    this.playersState.clear();

    this.exitSpotIndex = 0;
    this.updateExitPortalPosition(width, height);

    const cx = width / 2;
    const cy = height * 0.54;

    // 7 Dynamic Funhouse Mirror Panes (some static angled baffles, some slowly rotating)
    this.mirrors = [
      { id: 1, cx: cx - 135, cy: cy - 85, length: 105, angle: 0.12, rotSpeed: 0.35, type: 'WAVY', shimmerPhase: 0 },
      { id: 2, cx: cx + 135, cy: cy - 85, length: 105, angle: -0.12, rotSpeed: -0.35, type: 'PRISM', shimmerPhase: 1.2 },
      { id: 3, cx: cx, cy: cy - 35, length: 115, angle: 0, rotSpeed: 0.52, type: 'PRISM', shimmerPhase: 2.1 },
      { id: 4, cx: cx - 155, cy: cy + 25, length: 110, angle: -0.25, rotSpeed: 0, type: 'FLAT', shimmerPhase: 3.0 },
      { id: 5, cx: cx + 155, cy: cy + 25, length: 110, angle: 0.25, rotSpeed: 0, type: 'WAVY', shimmerPhase: 4.2 },
      { id: 6, cx: cx - 85, cy: cy + 105, length: 95, angle: 0.18, rotSpeed: -0.28, type: 'FLAT', shimmerPhase: 5.1 },
      { id: 7, cx: cx + 85, cy: cy + 105, length: 95, angle: -0.18, rotSpeed: 0.28, type: 'PRISM', shimmerPhase: 0.7 }
    ];

    // Scatter Prismatic Gems & Carnival Crowns
    const gemLocs = [
      { x: cx - 140, y: cy - 25, type: 'gem' as const },
      { x: cx + 140, y: cy - 25, type: 'gem' as const },
      { x: cx, y: cy - 105, type: 'crown' as const },
      { x: cx - 75, y: cy + 45, type: 'gem' as const },
      { x: cx + 75, y: cy + 45, type: 'gem' as const },
      { x: cx, y: cy + 55, type: 'crown' as const },
      { x: cx - 175, y: cy + 110, type: 'gem' as const },
      { x: cx + 175, y: cy + 110, type: 'gem' as const }
    ];
    gemLocs.forEach((g, idx) => {
      this.gems.push({
        id: idx + 1,
        x: g.x,
        y: g.y,
        radius: g.type === 'crown' ? 12 : 10,
        points: g.type === 'crown' ? 65 : 30,
        type: g.type,
        collected: false,
        respawnTimer: 0
      });
    });

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const spread = (idx - (count - 1) / 2) * 85;
      this.playersState.set(p.id, {
        id: p.id,
        x: cx + spread,
        y: height - 64,
        vx: 0,
        vy: 0,
        facingX: 0,
        facingY: -1,
        radius: 15,
        staggerTimer: 0,
        phaseTimer: 0,
        isCharging: false,
        chargeRatio: 0,
        overloadTimer: 0,
        score: 0,
        escapes: 0,
        shunts: 0,
        isUnderdog: false,
        botReactionTimer: 0.14 + idx * 0.05,
        botSteerX: 0,
        botSteerY: -1,
        botTargetCharge: 0.82
      });
    });
  }

  private updateExitPortalPosition(width: number, height: number): void {
    const spots = [
      { x: width / 2, y: 112 },
      { x: width * 0.22, y: 122 },
      { x: width * 0.78, y: 122 }
    ];
    const chosen = spots[this.exitSpotIndex % spots.length];
    this.exitX = chosen.x;
    this.exitY = chosen.y;
  }

  private getMirrorEndpoints(m: MirrorPane): { x1: number; y1: number; x2: number; y2: number } {
    const half = m.length * 0.5;
    const cos = Math.cos(m.angle);
    const sin = Math.sin(m.angle);
    return {
      x1: m.cx - cos * half,
      y1: m.cy - sin * half,
      x2: m.cx + cos * half,
      y2: m.cy + sin * half
    };
  }

  private closestPointOnSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): { cx: number; cy: number; dist: number } {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return { cx: x1, cy: y1, dist: Math.hypot(px - x1, py - y1) };
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return { cx, cy, dist: Math.hypot(px - cx, py - cy) };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.lastWidth = width;
    this.lastHeight = height;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Sudden Death Overdrive at <= 12s
    if (this.roundTimer <= 12.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText(
        '⚡ SUDDEN DEATH: SPINNING PRISMS & DOUBLE EXIT BONUS! ⚡',
        width / 2,
        100,
        '#EC4899',
        20
      );
      for (const g of this.gems) {
        g.collected = false;
        g.respawnTimer = 0;
      }
    }

    // Compute Underdog Surge (>= 120 pts behind leader)
    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.isUnderdog = maxScore - ps.score >= 120;
    }

    // Rotate dynamic mirrors
    const rotMult = this.suddenDeathTriggered ? 1.65 : 1.0;
    for (const m of this.mirrors) {
      m.angle += m.rotSpeed * rotMult * dt;
    }

    // Respawn gems over time
    for (const g of this.gems) {
      if (g.collected) {
        g.respawnTimer -= dt;
        if (g.respawnTimer <= 0) {
          g.collected = false;
        }
      }
    }

    this.updateBots(dt, width, height);

    const activePlayers = this.getActivePlayers();
    for (const p of activePlayers) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.staggerTimer > 0) ps.staggerTimer = Math.max(0, ps.staggerTimer - dt);
      if (ps.phaseTimer > 0) ps.phaseTimer = Math.max(0, ps.phaseTimer - dt);
      if (ps.overloadTimer > 0) ps.overloadTimer = Math.max(0, ps.overloadTimer - dt);

      // Read movement input
      let moveX = this.input.getSteer(p.id);
      let moveY = -this.input.getThrottle(p.id);
      const holdingAction = this.input.isActionPressed(p.id);

      const moveLen = Math.hypot(moveX, moveY);
      if (moveLen > 0.15) {
        ps.facingX = moveX / moveLen;
        ps.facingY = moveY / moveLen;
      }

      // Hold-to-Charge Sonic Flashbulb & Mirror-Phase Dash (72%-98% Sweet Spot)
      if (ps.overloadTimer <= 0 && ps.staggerTimer <= 0) {
        if (holdingAction) {
          ps.isCharging = true;
          ps.chargeRatio += dt * 1.2 * (ps.isUnderdog ? 1.3 : 1.0);
          if (ps.chargeRatio >= 1.0) {
            ps.chargeRatio = 0;
            ps.isCharging = false;
            ps.overloadTimer = 0.5;
            this.audio.playStun();
            this.particles.showFloatingText('FLASH OVERLOAD!', ps.x, ps.y - 20, '#F97316', 15);
          }
        } else if (ps.isCharging) {
          const ratio = ps.chargeRatio;
          ps.isCharging = false;
          ps.chargeRatio = 0;

          const isSweet = ratio >= 0.72 && ratio <= 0.98;
          const dashImpulse = isSweet ? 440 : 240;
          ps.vx += ps.facingX * dashImpulse;
          ps.vy += ps.facingY * dashImpulse;
          this.audio.playWhoosh();

          if (isSweet) {
            ps.phaseTimer = 0.75; // Can phase straight through mirrors!
            this.particles.spawnExplosion(ps.x, ps.y, '#38BDF8', 16);
            this.particles.showFloatingText('PRISM PHASE DASH!', ps.x, ps.y - 24, '#38BDF8', 17);
            this.triggerFlashbangWave(ps);
          }
        }
      }

      const baseSpeed = (ps.isUnderdog ? 235 : 195) * (ps.isCharging ? 0.68 : 1.0);
      if (ps.staggerTimer <= 0 && moveLen > 0.1) {
        const nx = moveX / Math.max(1, moveLen);
        const ny = moveY / Math.max(1, moveLen);
        ps.vx += (nx * baseSpeed - ps.vx) * Math.min(1, dt * 10);
        ps.vy += (ny * baseSpeed - ps.vy) * Math.min(1, dt * 10);
      } else {
        ps.vx *= Math.pow(0.08, dt);
        ps.vy *= Math.pow(0.08, dt);
      }

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Arena bounds (respect top HUD header y >= 90)
      ps.x = Math.max(ps.radius + 18, Math.min(width - ps.radius - 18, ps.x));
      ps.y = Math.max(ps.radius + 88, Math.min(height - ps.radius - 28, ps.y));

      // Mirror Pane Collision or Prismatic Phase-Through
      for (const m of this.mirrors) {
        const seg = this.getMirrorEndpoints(m);
        const hit = this.closestPointOnSegment(ps.x, ps.y, seg.x1, seg.y1, seg.x2, seg.y2);
        const minGap = ps.radius + 5;

        if (hit.dist < minGap) {
          if (ps.phaseTimer > 0) {
            // Phase right through the mirror glass for bonus points!
            ps.score += 15;
            this.audio.playChime();
            this.particles.spawnSparks(hit.cx, hit.cy, '#38BDF8', 8);
            this.particles.showFloatingText('PHASE! +15', ps.x, ps.y - 18, '#38BDF8', 15);
            ps.phaseTimer = Math.max(0.08, ps.phaseTimer - 0.35);
          } else {
            // Normal-vector elastic reflection (prevents any clipping or stuck loops!)
            let nx = ps.x - hit.cx;
            let ny = ps.y - hit.cy;
            const nLen = Math.hypot(nx, ny);
            if (nLen > 0.001) {
              nx /= nLen;
              ny /= nLen;
            } else {
              nx = -Math.sin(m.angle);
              ny = Math.cos(m.angle);
            }

            // Push cleanly outside mirror thickness
            ps.x = hit.cx + nx * (minGap + 2);
            ps.y = hit.cy + ny * (minGap + 2);

            // Reflect velocity vector across normal
            const dot = ps.vx * nx + ps.vy * ny;
            if (dot < 0) {
              ps.vx = (ps.vx - 2 * dot * nx) * 0.85 + nx * 135;
              ps.vy = (ps.vy - 2 * dot * ny) * 0.85 + ny * 135;
            } else {
              ps.vx += nx * 135;
              ps.vy += ny * 135;
            }

            if (ps.staggerTimer <= 0) {
              ps.staggerTimer = 0.18;
              this.audio.playBounce();
              this.particles.spawnSparks(hit.cx, hit.cy, '#F43F5E', 8);
              this.particles.showFloatingText('BONK!', ps.x, ps.y - 18, '#F43F5E', 16);
            }
          }
        }
      }

      // Collect Gems & Crowns
      for (const g of this.gems) {
        if (!g.collected && Math.hypot(ps.x - g.x, ps.y - g.y) < ps.radius + g.radius + 4) {
          g.collected = true;
          g.respawnTimer = 4.5;
          const pts = Math.round(g.points * (ps.isUnderdog ? 1.3 : 1.0));
          ps.score += pts;
          this.audio.playCoin();
          this.particles.spawnConfetti(g.x, g.y, 10);
          this.particles.showFloatingText(`+${pts}`, g.x, g.y - 14, g.type === 'crown' ? '#F59E0B' : '#38BDF8', 18);
        }
      }

      // Reach Golden Exit Portal
      if (Math.hypot(ps.x - this.exitX, ps.y - this.exitY) < ps.radius + this.exitRadius) {
        const exitPts = this.suddenDeathTriggered ? 160 : 100;
        ps.score += exitPts;
        ps.escapes += 1;
        this.audio.playFanfare();
        this.particles.shake(0.28);
        this.particles.spawnConfetti(this.exitX, this.exitY, 22);
        this.particles.showFloatingText(`MIRROR ESCAPE! +${exitPts}`, this.exitX, this.exitY - 18, '#10B981', 21);

        // Respawn player near bottom entrance and shift Exit Portal to next alcove
        ps.x = width / 2 + (Math.random() - 0.5) * 160;
        ps.y = height - 62;
        ps.vx = 0;
        ps.vy = 0;
        this.exitSpotIndex = (this.exitSpotIndex + 1) % 3;
        this.updateExitPortalPosition(width, height);
      }
    }

    // Player-to-Player Elastic Collisions (m1*v1 + m2*v2)
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const p1 = this.playersState.get(activePlayers[i].id);
        const p2 = this.playersState.get(activePlayers[j].id);
        if (!p1 || !p2) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius;

        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          p1.x -= nx * overlap;
          p1.y -= ny * overlap;
          p2.x += nx * overlap;
          p2.y += ny * overlap;

          const kx = p1.vx - p2.vx;
          const ky = p1.vy - p2.vy;
          const pImpulse = 2 * (nx * kx + ny * ky) * 0.5;
          p1.vx -= pImpulse * nx - nx * 40;
          p1.vy -= pImpulse * ny - ny * 40;
          p2.vx += pImpulse * nx + nx * 40;
          p2.vy += pImpulse * ny + ny * 40;

          if (p1.phaseTimer > 0 && p2.phaseTimer <= 0) {
            p1.score += 35;
            p1.shunts += 1;
            p2.staggerTimer = 0.35;
            this.particles.showFloatingText('SHUNT! +35', p1.x, p1.y - 20, '#38BDF8', 16);
          } else if (p2.phaseTimer > 0 && p1.phaseTimer <= 0) {
            p2.score += 35;
            p2.shunts += 1;
            p1.staggerTimer = 0.35;
            this.particles.showFloatingText('SHUNT! +35', p2.x, p2.y - 20, '#38BDF8', 16);
          }
          this.audio.playBounce();
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private triggerFlashbangWave(caster: MirrorPlayer): void {
    for (const other of this.playersState.values()) {
      if (other.id === caster.id) continue;
      const dx = other.x - caster.x;
      const dy = other.y - caster.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d <= 98) {
        other.vx += (dx / d) * 280;
        other.vy += (dy / d) * 280;
        other.staggerTimer = 0.45;
        caster.score += 45;
        caster.shunts += 1;
        this.audio.playBounce();
        this.particles.showFloatingText('DAZZLED! +45', other.x, other.y - 20, '#FDE047', 17);
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    if (ps.isCharging) {
      if (ps.chargeRatio >= ps.botTargetCharge) {
        this.input.setBotInput(botId, true, ps.botSteerX, -ps.botSteerY, false);
      } else {
        this.input.setBotInput(botId, true, ps.botSteerX, -ps.botSteerY, true);
      }
      return;
    }

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer <= 0) {
      ps.botReactionTimer =
        difficulty === 'bot_hard'
          ? 0.09 + Math.random() * 0.04
          : difficulty === 'bot_normal'
          ? 0.21 + Math.random() * 0.04
          : 0.38 + Math.random() * 0.07;

      // Pick best target: either a nearby high-value gem/crown or the Golden Exit Portal
      let targetX = this.exitX;
      let targetY = this.exitY;
      let bestDistScore = Math.hypot(this.exitX - ps.x, this.exitY - ps.y) * 0.72;

      for (const g of this.gems) {
        if (g.collected) continue;
        const d = Math.hypot(g.x - ps.x, g.y - ps.y) - (g.type === 'crown' ? 65 : 25);
        if (d < bestDistScore) {
          bestDistScore = d;
          targetX = g.x;
          targetY = g.y;
        }
      }

      const baseAngle = Math.atan2(targetY - ps.y, targetX - ps.x);

      // Evaluate 12 candidate steering rays around baseAngle so bots NEVER walk straight into mirror panes!
      let bestAngle = baseAngle;
      let bestRayScore = -9999;
      let directBlocked = false;

      for (let k = 0; k < 12; k++) {
        const offset = k === 0 ? 0 : (Math.ceil(k / 2) * (k % 2 === 1 ? 1 : -1) * Math.PI) / 6;
        const candAngle = baseAngle + offset;
        const rx = Math.cos(candAngle);
        const ry = Math.sin(candAngle);

        let minClearance = 999;
        for (const m of this.mirrors) {
          const seg = this.getMirrorEndpoints(m);
          const check1 = this.closestPointOnSegment(ps.x + rx * 28, ps.y + ry * 28, seg.x1, seg.y1, seg.x2, seg.y2);
          const check2 = this.closestPointOnSegment(ps.x + rx * 56, ps.y + ry * 56, seg.x1, seg.y1, seg.x2, seg.y2);
          minClearance = Math.min(minClearance, check1.dist, check2.dist);
        }

        if (k === 0 && minClearance < ps.radius + 14) {
          directBlocked = true;
        }

        const alignment = Math.cos(offset);
        const safetyPenalty = minClearance < ps.radius + 12 ? -500 : minClearance * 1.5;
        const score = alignment * 120 + safetyPenalty;

        if (score > bestRayScore) {
          bestRayScore = score;
          bestAngle = candAngle;
        }
      }

      if (difficulty === 'bot_easy' && Math.random() < 0.22) {
        bestAngle += (Math.random() - 0.5) * 0.9;
      }

      ps.botSteerX = Math.cos(bestAngle);
      ps.botSteerY = Math.sin(bestAngle);

      // If direct path is blocked by a mirror and bot is Normal/Hard, charge Phase Dash to phase right through it!
      if (directBlocked && difficulty !== 'bot_easy' && ps.overloadTimer <= 0 && Math.random() < 0.65) {
        ps.botSteerX = Math.cos(baseAngle);
        ps.botSteerY = Math.sin(baseAngle);
        ps.botTargetCharge = difficulty === 'bot_hard' ? 0.78 + Math.random() * 0.14 : 0.72 + Math.random() * 0.16;
        this.input.setBotInput(botId, true, ps.botSteerX, -ps.botSteerY, true);
        return;
      }
    }

    this.input.setBotInput(botId, true, ps.botSteerX, -ps.botSteerY, false);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    const now = performance.now() * 0.001;

    // 1. Themed Funhouse Backdrop & Floor
    this.renderBackdrop(ctx, width, height, now);

    // 2. Golden Exit Portal
    this.renderExitPortal(ctx, now);

    // 3. Prismatic Gems & Carnival Crowns
    this.renderGems(ctx, now);

    // 4. Funhouse Mirror Panes & Optical Reflections
    this.renderMirrorsAndClones(ctx, now);

    // 5. Real Players (2.5D Mascots + Charge Rings)
    this.renderPlayers(ctx, now);

    // 6. Theme Pill (Bottom-Left)
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, now: number): void {
    if (this.theme === 'carnival') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1E1B4B');
      grad.addColorStop(0.5, '#311042');
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;
    } else if (this.theme === 'crystal') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#082F49');
      grad.addColorStop(0.6, '#0F172A');
      grad.addColorStop(1, '#1E1B4B');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#070B14';
    }
    ctx.fillRect(0, 0, width, height);

    // Optical Harlequin Checkerboard Floor
    ctx.save();
    ctx.fillStyle =
      this.theme === 'carnival'
        ? 'rgba(244, 63, 94, 0.06)'
        : this.theme === 'crystal'
        ? 'rgba(56, 189, 248, 0.06)'
        : 'rgba(236, 72, 153, 0.06)';
    const tileSize = 40;
    for (let x = 0; x < width; x += tileSize) {
      for (let y = 84; y < height; y += tileSize) {
        if ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0) {
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }

    // Subtle Funhouse Swirl Rings in center
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    for (let r = 60; r <= 240; r += 60) {
      ctx.beginPath();
      ctx.arc(width / 2, height * 0.54, r + Math.sin(now * 2 + r) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderExitPortal(ctx: CanvasRenderingContext2D, now: number): void {
    ctx.save();
    ctx.translate(this.exitX, this.exitY);

    const pulse = 1 + 0.08 * Math.sin(now * 5);
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, (this.exitRadius + 7) * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, this.exitRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 10.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT PORTAL', 0, -2);
    ctx.font = '800 9.5px Montserrat, sans-serif';
    ctx.fillStyle = '#FEF08A';
    ctx.fillText(this.suddenDeathTriggered ? '+160 PTS' : '+100 PTS', 0, 10);
    ctx.restore();
  }

  private renderGems(ctx: CanvasRenderingContext2D, now: number): void {
    for (const g of this.gems) {
      if (g.collected) continue;
      const bob = Math.sin(now * 4 + g.id) * 2.5;
      ctx.save();
      ctx.translate(g.x, g.y + bob);

      if (g.type === 'crown') {
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♛', 0, 4);
      } else {
        ctx.fillStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -g.radius);
        ctx.lineTo(g.radius, 0);
        ctx.lineTo(0, g.radius);
        ctx.lineTo(-g.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderMirrorsAndClones(ctx: CanvasRenderingContext2D, now: number): void {
    // 1. Optical Distorted Mirror Reflections of players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      for (let i = 0; i < this.mirrors.length; i += 2) {
        const m = this.mirrors[i];
        const d = Math.hypot(ps.x - m.cx, ps.y - m.cy);
        if (d > 180) continue;

        const cloneX = m.cx + (m.cx - ps.x) * 0.38;
        const cloneY = m.cy + (ps.y - m.cy) * 0.32;

        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.translate(cloneX, cloneY);
        const stretchX = m.type === 'WAVY' ? 1.45 + 0.2 * Math.sin(now * 6) : 0.72;
        const stretchY = m.type === 'WAVY' ? 0.72 : 1.45;
        ctx.scale(stretchX, stretchY);
        this.drawPlayerMascot(ctx, p.id, 0, 0, ps.radius, 'shocked', now);
        ctx.restore();
      }
    }

    // 2. 2.5D Mirror Glass Panes & Brass/Neon Posts
    for (const m of this.mirrors) {
      const seg = this.getMirrorEndpoints(m);
      ctx.save();

      const borderCol =
        m.type === 'PRISM' ? '#EC4899' : m.type === 'WAVY' ? '#A855F7' : '#38BDF8';

      // Extruded 2.5D base shadow
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1 + 5);
      ctx.lineTo(seg.x2, seg.y2 + 5);
      ctx.stroke();

      // Glowing Mirror Glass Core
      ctx.strokeStyle = borderCol;
      ctx.shadowColor = borderCol;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();

      // Specular White Glass Highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1 - 1);
      ctx.lineTo(seg.x2, seg.y2 - 1);
      ctx.stroke();

      // End Pillar Posts
      ctx.fillStyle = '#FBBF24';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      for (const pt of [
        { x: seg.x1, y: seg.y1 },
        { x: seg.x2, y: seg.y2 }
      ]) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderPlayers(ctx: CanvasRenderingContext2D, now: number): void {
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      if (ps.phaseTimer > 0) {
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, ps.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (ps.isUnderdog) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, ps.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge Flashbulb / Phase Dash Meter
      if (ps.isCharging) {
        const r = ps.radius + 8;
        const isSweet = ps.chargeRatio >= 0.72 && ps.chargeRatio <= 0.98;
        ctx.strokeStyle = isSweet ? '#22C55E' : '#38BDF8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + ps.chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      const mood =
        ps.staggerTimer > 0
          ? 'shocked'
          : ps.phaseTimer > 0 || ps.escapes > 0
          ? 'triumph'
          : 'focused';
      this.drawPlayerMascot(ctx, p.id, 0, 0, ps.radius, mood, now);

      if (ps.staggerTimer > 0) {
        ctx.fillStyle = '#FDE047';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫', 0, -ps.radius - 8);
      }

      ctx.restore();

      // Score Label above player
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      ctx.fillText(`${ps.score} pts`, ps.x, ps.y - ps.radius - 10);
      ctx.restore();
    }
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number): void {
    const pillW = 170;
    const pillH = 32;
    const pillX = 20;
    const pillY = height - 44;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = '800 10.5px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.theme === 'carnival' ? '#F59E0B' : this.theme === 'crystal' ? '#38BDF8' : '#EC4899';
    ctx.fillText(`THEME: ${this.theme.toUpperCase()} [T]`, pillX + pillW / 2, pillY + 20);
    ctx.restore();
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Funhouse Prism Master!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} escaped ${ps?.escapes || 0} mirror portals with ${ps?.score || 0} pts!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
