import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type MansionTheme = 'victorian' | 'crypt' | 'cyber';

interface Ghost {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'green' | 'purple' | 'boss';
  hp: number;
  maxHp: number;
  alpha: number;
  illuminatedTimer: number;
  alive: boolean;
  points: number;
  bobPhase: number;
}

interface EctoOrb {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  points: number;
  collected: boolean;
}

interface HunterState {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number; // standard radians (0 = right, -PI/2 = up)
  sweepDir: number;
  radius: number;
  isCharging: boolean;
  chargeRatio: number;
  overloadTimer: number;
  stunTimer: number;
  strobeFlash: number;
  lastStrobeSuper: boolean;
  score: number;
  ghostsCaptured: number;
  shuntsLanded: number;
  isUnderdog: boolean;
  botReactionTimer: number;
  botTargetCharge: number;
}

export class HauntedMansionGame extends BaseGame {
  public theme: MansionTheme = 'victorian';
  private ghosts: Ghost[] = [];
  private orbs: EctoOrb[] = [];
  private hunters: Map<PlayerId, HunterState> = new Map();
  private ghostCounter: number = 0;
  private orbCounter: number = 0;
  private spawnTimer: number = 0.6;
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
        if (e.key === '1') this.switchTheme('victorian', this.lastWidth, this.lastHeight);
        else if (e.key === '2') this.switchTheme('crypt', this.lastWidth, this.lastHeight);
        else if (e.key === '3') this.switchTheme('cyber', this.lastWidth, this.lastHeight);
        else if (e.key === 't' || e.key === 'T') {
          const order: MansionTheme[] = ['victorian', 'crypt', 'cyber'];
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
          const order: MansionTheme[] = ['victorian', 'crypt', 'cyber'];
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

  public switchTheme(theme: MansionTheme, width: number, height: number): void {
    this.theme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `THEME: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'victorian' ? '#F59E0B' : theme === 'crypt' ? '#4ADE80' : '#38BDF8',
      22
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.ghosts = [];
    this.orbs = [];
    this.hunters.clear();
    this.ghostCounter = 0;
    this.orbCounter = 0;
    this.spawnTimer = 0.5;
    this.roundTimer = 36.0;
    this.isFinished = false;
    this.suddenDeathTriggered = false;

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const startX = (width / (count + 1)) * (idx + 1);
      this.hunters.set(p.id, {
        id: p.id,
        x: startX,
        y: height - 95,
        vx: 0,
        vy: 0,
        aimAngle: -Math.PI / 2,
        sweepDir: idx % 2 === 0 ? 1 : -1,
        radius: 15,
        isCharging: false,
        chargeRatio: 0,
        overloadTimer: 0,
        stunTimer: 0,
        strobeFlash: 0,
        lastStrobeSuper: false,
        score: 0,
        ghostsCaptured: 0,
        shuntsLanded: 0,
        isUnderdog: false,
        botReactionTimer: 0.14 + idx * 0.05,
        botTargetCharge: 0.82
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnGhost(width, height);
    }
  }

  private spawnGhost(width: number, height: number, forceBoss: boolean = false): void {
    const isBoss = forceBoss || Math.random() < (this.suddenDeathTriggered ? 0.32 : 0.18);
    const isPurple = !isBoss && Math.random() < 0.45;
    const type = isBoss ? 'boss' : isPurple ? 'purple' : 'green';

    this.ghosts.push({
      id: ++this.ghostCounter,
      x: 75 + Math.random() * (width - 150),
      y: 105 + Math.random() * (height - 235),
      vx: (Math.random() - 0.5) * (isBoss ? 115 : 95),
      vy: (Math.random() - 0.5) * (isBoss ? 95 : 75),
      type,
      hp: 1,
      maxHp: 1,
      alpha: 0.25,
      illuminatedTimer: 0,
      alive: true,
      points: isBoss ? 240 : isPurple ? 120 : 65,
      bobPhase: Math.random() * Math.PI * 2
    });
  }

  private normalizeAngleDiff(a: number, b: number): number {
    let diff = (a - b) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.lastWidth = width;
    this.lastHeight = height;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    // Sudden Death Overdrive at <= 12s
    if (this.roundTimer <= 12.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText(
        '⚡ SUDDEN DEATH: POLTERGEIST KING SWARM! ⚡',
        width / 2,
        102,
        '#FACC15',
        21
      );
      this.spawnGhost(width, height, true);
      this.spawnGhost(width, height, true);
    }

    // Compute Underdog Surge (>= 300 pts behind leader)
    let maxScore = 0;
    for (const h of this.hunters.values()) {
      if (h.score > maxScore) maxScore = h.score;
    }
    for (const h of this.hunters.values()) {
      h.isUnderdog = maxScore - h.score >= 300;
    }

    this.updateBots(dt, width, height);

    // Spawn ghosts
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const maxGhosts = this.suddenDeathTriggered ? 11 : 8;
      if (this.ghosts.filter((g) => g.alive).length < maxGhosts) {
        this.spawnGhost(width, height);
      }
      this.spawnTimer = this.suddenDeathTriggered ? 0.65 : 1.05;
    }

    // Update Ghosts
    for (const g of this.ghosts) {
      if (!g.alive) continue;

      if (g.illuminatedTimer > 0) {
        g.illuminatedTimer = Math.max(0, g.illuminatedTimer - dt);
        g.alpha = Math.min(1.0, g.alpha + dt * 4.5);
      } else {
        g.alpha = Math.max(0.28, g.alpha - dt * 1.2);
      }

      const speedScale = g.illuminatedTimer > 0 ? 0.65 : 1.0;
      g.x += g.vx * speedScale * dt;
      g.y += g.vy * speedScale * dt;

      if (g.x < 55) {
        g.x = 55;
        g.vx = Math.abs(g.vx);
      }
      if (g.x > width - 55) {
        g.x = width - 55;
        g.vx = -Math.abs(g.vx);
      }
      if (g.y < 96) {
        g.y = 96;
        g.vy = Math.abs(g.vy);
      }
      if (g.y > height - 65) {
        g.y = height - 65;
        g.vy = -Math.abs(g.vy);
      }
    }

    // Update Ecto-Orbs
    for (const orb of this.orbs) {
      if (orb.collected) continue;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.vx *= Math.pow(0.15, dt);
      orb.vy *= Math.pow(0.15, dt);
      orb.x = Math.max(45, Math.min(width - 45, orb.x));
      orb.y = Math.max(95, Math.min(height - 55, orb.y));
    }

    // Update Hunters & Inputs
    const activePlayers = this.getActivePlayers();
    for (const p of activePlayers) {
      const h = this.hunters.get(p.id);
      if (!h) continue;

      if (h.overloadTimer > 0) h.overloadTimer = Math.max(0, h.overloadTimer - dt);
      if (h.stunTimer > 0) h.stunTimer = Math.max(0, h.stunTimer - dt);
      if (h.strobeFlash > 0) h.strobeFlash = Math.max(0, h.strobeFlash - dt * 3.8);

      const steer = this.input.getSteer(p.id);
      const throttle = -this.input.getThrottle(p.id);
      const holdingAction = this.input.isActionPressed(p.id);

      const moveLen = Math.hypot(steer, throttle);
      if (moveLen > 0.15 && h.stunTimer <= 0) {
        const targetAngle = Math.atan2(throttle, steer);
        const angleDiff = this.normalizeAngleDiff(targetAngle, h.aimAngle);
        h.aimAngle += angleDiff * Math.min(1, dt * 12);
      } else {
        // Gentle automatic radar sweep when standing still (so 1-button mode sweeps smoothly!)
        h.aimAngle += h.sweepDir * dt * 1.35;
        if (h.aimAngle > -0.25) h.sweepDir = -1;
        else if (h.aimAngle < -Math.PI + 0.25) h.sweepDir = 1;
      }

      // Passive UV Flashlight Cone Illumination & Vacuum Reel while Charging!
      const passiveBeamLen = h.isCharging ? 275 : 225;
      const passiveHalfCone = h.isCharging ? 0.36 : 0.3;
      for (const g of this.ghosts) {
        if (!g.alive) continue;
        const dx = g.x - h.x;
        const dy = g.y - h.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 10 && dist <= passiveBeamLen) {
          const ang = Math.atan2(dy, dx);
          if (Math.abs(this.normalizeAngleDiff(ang, h.aimAngle)) <= passiveHalfCone) {
            g.illuminatedTimer = 0.25;
            // If charging Proton Vacuum, reel the ghost closer into capture range!
            if (h.isCharging) {
              g.x -= (dx / (dist || 0.001)) * 95 * dt;
              g.y -= (dy / (dist || 0.001)) * 95 * dt;
            }
          }
        }
      }

      // Hold-to-Charge Proton Strobe & Poltergeist Vacuum (72%-98% Sweet Spot)
      if (h.overloadTimer <= 0 && h.stunTimer <= 0) {
        if (holdingAction) {
          h.isCharging = true;
          h.chargeRatio += dt * 1.2 * (h.isUnderdog ? 1.3 : 1.0);
          if (h.chargeRatio >= 1.0) {
            h.chargeRatio = 0;
            h.isCharging = false;
            h.overloadTimer = 0.55;
            this.audio.playStun();
            this.particles.showFloatingText('PACK OVERHEAT!', h.x, h.y - 24, '#F97316', 16);
          }
        } else if (h.isCharging) {
          const ratio = h.chargeRatio;
          h.isCharging = false;
          h.chargeRatio = 0;
          this.fireUVStrobe(h, ratio);
        }
      }

      const speed = (h.isUnderdog ? 235 : 195) * (h.isCharging ? 0.72 : 1.0);
      if (h.stunTimer <= 0 && moveLen > 0.1) {
        const nx = steer / Math.max(1, moveLen);
        const ny = throttle / Math.max(1, moveLen);
        h.vx += (nx * speed - h.vx) * Math.min(1, dt * 10);
        h.vy += (ny * speed - h.vy) * Math.min(1, dt * 10);
      } else {
        h.vx *= Math.pow(0.1, dt);
        h.vy *= Math.pow(0.1, dt);
      }

      h.x += h.vx * dt;
      h.y += h.vy * dt;

      h.x = Math.max(h.radius + 22, Math.min(width - h.radius - 22, h.x));
      h.y = Math.max(h.radius + 92, Math.min(height - h.radius - 28, h.y));

      // Collect Ecto-Orbs
      for (const orb of this.orbs) {
        if (!orb.collected && Math.hypot(h.x - orb.x, h.y - orb.y) < h.radius + 14) {
          orb.collected = true;
          h.score += orb.points;
          this.audio.playCoin();
          this.particles.spawnConfetti(orb.x, orb.y, 8);
          this.particles.showFloatingText(`+${orb.points} ECTO!`, orb.x, orb.y - 14, '#4ADE80', 17);
        }
      }
    }

    // Player-to-Player Elastic Ballroom Collisions (m1*v1 + m2*v2)
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const p1 = this.hunters.get(activePlayers[i].id);
        const p2 = this.hunters.get(activePlayers[j].id);
        if (!p1 || !p2) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius + 2;

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
          const pImp = 2 * (nx * kx + ny * ky) * 0.5;
          p1.vx -= pImp * nx - nx * 45;
          p1.vy -= pImp * ny - ny * 45;
          p2.vx += pImp * nx + nx * 45;
          p2.vy += pImp * ny + ny * 45;
          this.audio.playBounce();
        }
      }
    }

    this.ghosts = this.ghosts.filter((g) => g.alive);
    this.orbs = this.orbs.filter((o) => !o.collected);
  }

  private fireUVStrobe(h: HunterState, ratio: number): void {
    const isSweetSpot = ratio >= 0.72 && ratio <= 0.98;
    h.strobeFlash = 1.0;
    h.lastStrobeSuper = isSweetSpot;

    const beamRange = isSweetSpot ? 310 : 225;
    const halfCone = isSweetSpot ? 0.46 : 0.32;
    const mult = (isSweetSpot ? 1.5 : 1.0) * (h.isUnderdog ? 1.25 : 1.0);

    let capturedCount = 0;
    for (const g of this.ghosts) {
      if (!g.alive) continue;
      const dx = g.x - h.x;
      const dy = g.y - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= beamRange) {
        const ang = Math.atan2(dy, dx);
        if (Math.abs(this.normalizeAngleDiff(ang, h.aimAngle)) <= halfCone) {
          g.alive = false;
          capturedCount++;
          const pts = Math.round(g.points * mult);
          h.score += pts;
          h.ghostsCaptured++;

          const col = g.type === 'boss' ? '#FACC15' : g.type === 'purple' ? '#C084FC' : '#4ADE80';
          this.particles.spawnExplosion(g.x, g.y, col, 18);
          this.particles.showFloatingText(
            isSweetSpot ? `⚡ SUPER CAPTURE! +${pts}` : `+${pts}`,
            g.x,
            g.y - 16,
            col,
            isSweetSpot ? 20 : 17
          );

          // Spawn bonus Ecto-Orb on Sweet-Spot or Boss capture
          if (isSweetSpot || g.type === 'boss') {
            this.orbs.push({
              id: ++this.orbCounter,
              x: g.x,
              y: g.y,
              vx: (Math.random() - 0.5) * 90,
              vy: (Math.random() - 0.5) * 90,
              points: 55,
              collected: false
            });
          }
        }
      }
    }

    // Check Rival Hunters inside UV Strobe Cone (Strobe Blind Shunt!)
    for (const other of this.hunters.values()) {
      if (other.id === h.id) continue;
      const dx = other.x - h.x;
      const dy = other.y - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist <= (isSweetSpot ? 220 : 140)) {
        const ang = Math.atan2(dy, dx);
        if (Math.abs(this.normalizeAngleDiff(ang, h.aimAngle)) <= halfCone) {
          other.vx += (dx / (dist || 0.001)) * (isSweetSpot ? 320 : 180);
          other.vy += (dy / (dist || 0.001)) * (isSweetSpot ? 320 : 180);
          other.stunTimer = isSweetSpot ? 0.5 : 0.25;
          const shuntPts = isSweetSpot ? 75 : 35;
          h.score += shuntPts;
          h.shuntsLanded++;
          this.audio.playBounce();
          this.particles.showFloatingText(`UV BLIND! +${shuntPts}`, other.x, other.y - 22, '#38BDF8', 17);
        }
      }
    }

    if (capturedCount > 0) {
      this.audio.playScore();
      if (isSweetSpot) this.particles.shake(0.25);
    } else {
      this.audio.playWhoosh();
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const h = this.hunters.get(botId);
    if (!h || h.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Find best Ghost target
    let bestGhost: Ghost | null = null;
    let bestVal = -9999;
    for (const g of this.ghosts) {
      if (!g.alive) continue;
      const d = Math.hypot(g.x - h.x, g.y - h.y);
      const val = g.points * (difficulty === 'bot_hard' ? 1.6 : 1.0) - d * 0.85;
      if (val > bestVal) {
        bestVal = val;
        bestGhost = g;
      }
    }

    if (!bestGhost) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const dx = bestGhost.x - h.x;
    const dy = bestGhost.y - h.y;
    const dist = Math.hypot(dx, dy);
    const targetAng = Math.atan2(dy, dx);
    const angErr = Math.abs(this.normalizeAngleDiff(targetAng, h.aimAngle));

    const steerX = dx / Math.max(1, dist);
    const steerY = -dy / Math.max(1, dist);

    // If charging Proton Strobe, release when inside target sweet spot and aligned
    if (h.isCharging) {
      if (h.chargeRatio >= h.botTargetCharge) {
        this.input.setBotInput(botId, true, steerX, steerY, false);
      } else {
        this.input.setBotInput(botId, true, steerX, steerY, true);
      }
      return;
    }

    h.botReactionTimer -= dt;
    if (h.botReactionTimer > 0) return;

    h.botReactionTimer =
      difficulty === 'bot_hard'
        ? 0.09 + Math.random() * 0.04
        : difficulty === 'bot_normal'
        ? 0.21 + Math.random() * 0.04
        : 0.38 + Math.random() * 0.07;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // If within beam distance and aligned, start charging Proton Strobe!
    if (dist < 245 && angErr < 0.36 && h.overloadTimer <= 0) {
      h.botTargetCharge =
        difficulty === 'bot_hard'
          ? 0.78 + Math.random() * 0.15
          : difficulty === 'bot_normal'
          ? 0.71 + Math.random() * 0.18
          : 0.45 + Math.random() * 0.25;
      this.input.setBotInput(botId, true, steerX, steerY, true);
    } else {
      this.input.setBotInput(botId, true, steerX, steerY, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    const now = performance.now() * 0.001;

    // 1. Haunted Ballroom / Crypt / Cyber Backdrop
    this.renderBackdrop(ctx, width, height, now);

    // 2. UV Flashlight & Strobe Cones (drawn in exact world angle h.aimAngle!)
    this.renderUVBeams(ctx);

    // 3. Ecto-Orbs & Spectral Ghosts
    this.renderOrbs(ctx, now);
    this.renderGhosts(ctx, now);

    // 4. Ghost-Hunter Mascot Players & Proton Packs
    this.renderHunters(ctx, now);

    // 5. Theme Pill (Bottom-Left)
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, now: number): void {
    if (this.theme === 'victorian') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#090D16');
      grad.addColorStop(0.6, '#1E1B4B');
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;
    } else if (this.theme === 'crypt') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#051911');
      grad.addColorStop(0.6, '#0F172A');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#040711';
    }
    ctx.fillRect(0, 0, width, height);

    // Gothic Arched Stained-Glass Windows along back wall
    ctx.save();
    for (const wx of [width * 0.22, width * 0.5, width * 0.78]) {
      ctx.fillStyle =
        this.theme === 'crypt'
          ? 'rgba(74, 222, 128, 0.07)'
          : this.theme === 'cyber'
          ? 'rgba(56, 189, 248, 0.08)'
          : 'rgba(168, 85, 247, 0.08)';
      ctx.beginPath();
      ctx.arc(wx, 125, 34, Math.PI, 0);
      ctx.lineTo(wx + 34, 185);
      ctx.lineTo(wx - 34, 185);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Flickering Chandelier Aura in center
    const flicker = 0.06 + 0.03 * Math.sin(now * 8);
    ctx.fillStyle = `rgba(250, 204, 21, ${flicker})`;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.42, 190, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderUVBeams(ctx: CanvasRenderingContext2D): void {
    for (const p of this.getActivePlayers()) {
      const h = this.hunters.get(p.id);
      if (!h) continue;

      const beamLen = h.strobeFlash > 0 ? (h.lastStrobeSuper ? 310 : 230) : h.isCharging ? 275 : 225;
      const halfCone = h.strobeFlash > 0 ? (h.lastStrobeSuper ? 0.46 : 0.32) : h.isCharging ? 0.36 : 0.3;

      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.aimAngle); // 0 rad = +X right; matches Math.atan2(dy, dx) 100%!

      const grad = ctx.createLinearGradient(0, 0, beamLen, 0);
      if (h.strobeFlash > 0) {
        grad.addColorStop(0, h.lastStrobeSuper ? 'rgba(168, 85, 247, 0.85)' : 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.45)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      } else {
        grad.addColorStop(0, h.isCharging ? 'rgba(168, 85, 247, 0.42)' : 'rgba(56, 189, 248, 0.28)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      }

      const spreadY = Math.tan(halfCone) * beamLen;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(beamLen, -spreadY);
      ctx.lineTo(beamLen, spreadY);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  private renderOrbs(ctx: CanvasRenderingContext2D, now: number): void {
    for (const orb of this.orbs) {
      if (orb.collected) continue;
      ctx.save();
      ctx.translate(orb.x, orb.y + Math.sin(now * 6 + orb.id) * 2.5);
      ctx.fillStyle = '#4ADE80';
      ctx.shadowColor = '#4ADE80';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-2, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderGhosts(ctx: CanvasRenderingContext2D, now: number): void {
    for (const g of this.ghosts) {
      if (!g.alive) continue;

      const bob = Math.sin(now * 4.5 + g.bobPhase) * 4;
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      ctx.globalAlpha = g.alpha;

      const baseColor = g.type === 'boss' ? '#FACC15' : g.type === 'purple' ? '#C084FC' : '#4ADE80';
      ctx.fillStyle = baseColor;
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = g.illuminatedTimer > 0 ? 18 : 8;

      const r = g.type === 'boss' ? 23 : g.type === 'purple' ? 17 : 15;
      ctx.beginPath();
      ctx.arc(0, -r * 0.4, r, Math.PI, 0);
      ctx.lineTo(r, r * 0.85);
      ctx.lineTo(r * 0.5, r * 0.45);
      ctx.lineTo(0, r * 0.85);
      ctx.lineTo(-r * 0.5, r * 0.45);
      ctx.lineTo(-r, r * 0.85);
      ctx.closePath();
      ctx.fill();

      if (g.type === 'boss') {
        // Golden Poltergeist Crown
        ctx.fillStyle = '#F59E0B';
        ctx.font = '900 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♛', 0, -r - 8);
      }

      // Spooky Glowing Eyes
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.35, r * 0.2, 0, Math.PI * 2);
      ctx.arc(r * 0.35, -r * 0.35, r * 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderHunters(ctx: CanvasRenderingContext2D, now: number): void {
    for (const p of this.getActivePlayers()) {
      const h = this.hunters.get(p.id);
      if (!h) continue;

      ctx.save();
      ctx.translate(h.x, h.y);

      if (h.isUnderdog) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, h.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge UV Strobe Capacitor Ring (72%-98% Sweet Spot)
      if (h.isCharging) {
        const r = h.radius + 9;
        const isSweet = h.chargeRatio >= 0.72 && h.chargeRatio <= 0.98;
        ctx.strokeStyle = isSweet ? '#22C55E' : '#C084FC';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + h.chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      const mood =
        h.stunTimer > 0 || h.overloadTimer > 0
          ? 'shocked'
          : h.strobeFlash > 0 || h.ghostsCaptured > 2
          ? 'triumph'
          : 'focused';
      this.drawPlayerMascot(ctx, p.id, 0, 0, h.radius, mood, now);

      // UV Proton Nozzle pointing along h.aimAngle
      ctx.save();
      ctx.rotate(h.aimAngle);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(h.radius - 2, -3, 10, 6);
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(h.radius + 8, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();

      // Score Label above player
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      ctx.fillText(`${h.score} pts`, h.x, h.y - h.radius - 12);
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
    ctx.fillStyle = this.theme === 'victorian' ? '#F59E0B' : this.theme === 'crypt' ? '#4ADE80' : '#38BDF8';
    ctx.fillText(`THEME: ${this.theme.toUpperCase()} [T]`, pillX + pillW / 2, pillY + 20);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map((p) => ({
        playerId: p.id,
        score: this.hunters.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId =
      rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Paranormal Poltergeist Buster!';
    if (winnerId !== null) {
      const h = this.hunters.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} captured ${h?.ghostsCaptured || 0} ghosts & landed ${h?.shuntsLanded || 0} UV blinds!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
