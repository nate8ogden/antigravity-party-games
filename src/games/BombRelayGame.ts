import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

export interface HazardSlick {
  x: number;
  y: number;
  radius: number;
  type: 'banana' | 'oil';
  droppedById: PlayerId;
  life: number;
}

export interface BombRelayTheme {
  name: string;
  floorBg: string;
  gradStart: string;
  gradMid: string;
  gradEnd: string;
  rimColor: string;
  ringColor: string;
  obstacleColorA: string;
  obstacleColorB: string;
}

export const BOMB_RELAY_THEMES: BombRelayTheme[] = [
  {
    name: 'Neon Cyber Grid ⚡',
    floorBg: '#0B0F19',
    gradStart: '#1E293B',
    gradMid: '#0F172A',
    gradEnd: '#020617',
    rimColor: '#06B6D4',
    ringColor: 'rgba(6, 182, 212, 0.2)',
    obstacleColorA: '#38BDF8',
    obstacleColorB: '#EC4899'
  },
  {
    name: 'Magma Caldera 🔥',
    floorBg: '#180B0B',
    gradStart: '#2A1212',
    gradMid: '#1C0D0D',
    gradEnd: '#0A0505',
    rimColor: '#EF4444',
    ringColor: 'rgba(239, 68, 68, 0.25)',
    obstacleColorA: '#F97316',
    obstacleColorB: '#FBBF24'
  },
  {
    name: 'Toxic Vault ☣️',
    floorBg: '#08170F',
    gradStart: '#0F2E1E',
    gradMid: '#0A2015',
    gradEnd: '#040F0A',
    rimColor: '#10B981',
    ringColor: 'rgba(16, 185, 129, 0.22)',
    obstacleColorA: '#34D399',
    obstacleColorB: '#A3E635'
  }
];

interface RelayRunner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  score: number;
  invulnTimer: number; // brief pass-back cooldown
  slipTimer: number;
  hazardCooldown: number;
  facingAngle: number;
}

export class BombRelayGame extends BaseGame {
  public static readonly THEMES = BOMB_RELAY_THEMES;
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  private runners: Map<PlayerId, RelayRunner> = new Map();
  private slicks: HazardSlick[] = [];
  private bombHolderId: PlayerId = 0;
  private fuseTimer: number = 14.0;
  private initialFuse: number = 14.0;
  private arenaRadius: number = 220;
  private arenaCenterX: number = 0;
  private arenaCenterY: number = 0;
  private eliminationOrder: PlayerId[] = [];
  private tickTimer: number = 1.0;
  private obstacles: { x: number; y: number; radius: number; color: string }[] = [];
  public currentMapName: string = 'Central Vault';

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % BOMB_RELAY_THEMES.length;
        this.audio.playTap();
      } else if (e.code === 'KeyM') {
        this.generateRandomMap(this.arenaCenterX, this.arenaCenterY, this.arenaRadius);
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = e.target as HTMLCanvasElement;
      if (!canvas || !canvas.getBoundingClientRect) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill is at x: 20, y: canvas.height - 44, w: 180, h: 32
      if (clickX >= 20 && clickX <= 200 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % BOMB_RELAY_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 75;
    this.isFinished = false;
    this.runners.clear();
    this.slicks = [];
    this.eliminationOrder = [];
    this.arenaCenterX = width / 2;
    this.arenaCenterY = height / 2;
    this.arenaRadius = Math.min(width, height) * 0.38;
    this.initialFuse = 12.0;
    this.fuseTimer = this.initialFuse;
    this.tickTimer = 1.0;

    // Procedural Obstacle Layout Generation
    this.generateRandomMap(this.arenaCenterX, this.arenaCenterY, this.arenaRadius);

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      const dist = this.arenaRadius * 0.65;
      this.runners.set(p.id, {
        id: p.id,
        x: this.arenaCenterX + Math.cos(angle) * dist,
        y: this.arenaCenterY + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: 17,
        alive: true,
        score: 0,
        invulnTimer: 0,
        slipTimer: 0,
        hazardCooldown: 0,
        facingAngle: angle
      });
    });

    // Random initial bomb holder
    const activeIds = active.map((p) => p.id);
    this.bombHolderId = activeIds[Math.floor(Math.random() * activeIds.length)] ?? 0;
  }

  private generateRandomMap(cx: number, cy: number, radius: number): void {
    const archetypes = ['Central Vault', 'Stonehenge Circle', 'Twin Rebounders', 'Open Colosseum'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.obstacles = [];
    const theme = BOMB_RELAY_THEMES[this.currentThemeIndex];

    switch (this.currentMapName) {
      case 'Central Vault':
        // Center heavy bunker with 4 orbiting deflector pegs
        this.obstacles.push({ x: cx, y: cy, radius: 28, color: theme.obstacleColorA });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          this.obstacles.push({
            x: cx + Math.cos(a) * (radius * 0.45),
            y: cy + Math.sin(a) * (radius * 0.45),
            radius: 16,
            color: theme.obstacleColorB
          });
        }
        break;

      case 'Stonehenge Circle':
        // 5 circular monoliths forming an inner ring
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          this.obstacles.push({
            x: cx + Math.cos(a) * (radius * 0.42),
            y: cy + Math.sin(a) * (radius * 0.42),
            radius: 20,
            color: theme.obstacleColorA
          });
        }
        break;

      case 'Twin Rebounders':
        // Two massive bouncy pylons
        this.obstacles.push(
          { x: cx - radius * 0.35, y: cy, radius: 26, color: theme.obstacleColorB },
          { x: cx + radius * 0.35, y: cy, radius: 26, color: theme.obstacleColorA }
        );
        break;

      case 'Open Colosseum':
      default:
        // Clear open arena
        break;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Sudden Death check (<= 15s)
    const isSuddenDeath = this.roundTimer <= 15;

    // Fuse countdown
    this.fuseTimer -= dt;
    this.tickTimer -= dt;
    if (this.tickTimer <= 0) {
      this.tickTimer = Math.max(0.14, (this.fuseTimer / this.initialFuse) * 0.8);
      this.audio.playTap();
    }

    // Bomb Detonation!
    if (this.fuseTimer <= 0) {
      this.detonateBomb();
      return;
    }

    // Process hazard slicks (bananas & oil)
    for (let i = this.slicks.length - 1; i >= 0; i--) {
      const slick = this.slicks[i];
      slick.life -= dt;
      if (slick.life <= 0) {
        this.slicks.splice(i, 1);
        continue;
      }
      for (const r of this.runners.values()) {
        if (!r.alive || r.slipTimer > 0) continue;
        const d = Math.hypot(r.x - slick.x, r.y - slick.y);
        if (d < r.radius + slick.radius) {
          r.slipTimer = 0.72;
          r.vx *= 0.15;
          r.vy *= 0.15;
          this.audio.playBounce();
          this.particles.addTrauma(0.14);
          this.particles.spawnSparks(r.x, r.y, slick.type === 'banana' ? '#FBBF24' : '#334155', 14);
          this.particles.showFloatingText(slick.type === 'banana' ? '🍌 SLIPPED!' : '🛢️ SKIDDED!', r.x, r.y - 20, '#F59E0B', 18);
          this.slicks.splice(i, 1);
          break;
        }
      }
    }

    // Calculate alive runners and max score for Underdog Surge
    const activeRunners = Array.from(this.runners.values()).filter((r) => r.alive);
    let maxScore = 0;
    for (const r of activeRunners) {
      if (r.score > maxScore) maxScore = r.score;
    }

    // Process Runner Movements
    for (const r of this.runners.values()) {
      if (!r.alive) continue;

      if (r.invulnTimer > 0) r.invulnTimer -= dt;
      if (r.hazardCooldown > 0) r.hazardCooldown -= dt;

      // Handle slip spinning
      if (r.slipTimer > 0) {
        r.slipTimer -= dt;
        r.facingAngle += 16 * dt; // Hilarious spin!
        r.vx *= Math.pow(0.85, dt * 60);
        r.vy *= Math.pow(0.85, dt * 60);
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        continue;
      }

      const steer = this.input.getSteer(r.id);
      const throttle = this.input.getThrottle(r.id);
      const isPressed = this.input.isPressed(r.id);
      const justAction = this.input.justAction(r.id) || (this.input.isActionPressed(r.id) && r.hazardCooldown <= 0);

      // Hazard Drop (Banana Peel / Oil Slick)
      if (justAction && r.hazardCooldown <= 0 && r.id !== this.bombHolderId) {
        r.hazardCooldown = 3.8;
        const slickType = Math.random() < 0.5 ? 'banana' : 'oil';
        this.slicks.push({
          x: r.x - Math.cos(r.facingAngle) * 24,
          y: r.y - Math.sin(r.facingAngle) * 24,
          radius: 16,
          type: slickType,
          droppedById: r.id,
          life: 8.5
        });
        this.audio.playTap();
        this.particles.showFloatingText(slickType === 'banana' ? '🍌 BANANA PEEL!' : '🛢️ OIL SLICK!', r.x, r.y - 25, '#F59E0B', 16);
      }

      const isBombCarrier = r.id === this.bombHolderId;
      const isUnderdog = !isBombCarrier && (maxScore - r.score >= 50 || activeRunners.length <= 2);
      const baseSpeed = (isBombCarrier ? 245 : 210) * (isUnderdog ? 1.15 : 1.0);

      const inputY = -throttle;
      if (steer !== 0 || throttle !== 0) {
        r.facingAngle = Math.atan2(inputY, steer);
        r.vx += (steer * baseSpeed - r.vx) * dt * 9;
        r.vy += (inputY * baseSpeed - r.vy) * dt * 9;
      } else if (isPressed) {
        // Forward lunge
        r.vx += Math.cos(r.facingAngle) * baseSpeed * dt * 8;
        r.vy += Math.sin(r.facingAngle) * baseSpeed * dt * 8;
      } else {
        r.vx *= Math.pow(0.92, dt * 60);
        r.vy *= Math.pow(0.92, dt * 60);
      }

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Arena circular bumper collision
      const distFromCenter = Math.hypot(r.x - this.arenaCenterX, r.y - this.arenaCenterY);
      if (distFromCenter > this.arenaRadius - r.radius) {
        const nx = (r.x - this.arenaCenterX) / distFromCenter;
        const ny = (r.y - this.arenaCenterY) / distFromCenter;
        r.x = this.arenaCenterX + nx * (this.arenaRadius - r.radius);
        r.y = this.arenaCenterY + ny * (this.arenaRadius - r.radius);

        // Bumper bounce
        const dot = r.vx * nx + r.vy * ny;
        r.vx = (r.vx - 2 * dot * nx) * 0.85;
        r.vy = (r.vy - 2 * dot * ny) * 0.85;
        this.audio.playBounce();
        this.particles.spawnSparks(r.x, r.y, '#38BDF8', 5);
      }

      // Internal Obstacle Deflection
      for (const obs of this.obstacles) {
        const dObs = Math.hypot(r.x - obs.x, r.y - obs.y);
        if (dObs < obs.radius + r.radius && dObs > 0) {
          const nx = (r.x - obs.x) / dObs;
          const ny = (r.y - obs.y) / dObs;
          r.x = obs.x + nx * (obs.radius + r.radius);
          r.y = obs.y + ny * (obs.radius + r.radius);
          const dot = r.vx * nx + r.vy * ny;
          r.vx = (r.vx - 2 * dot * nx) * 0.85;
          r.vy = (r.vy - 2 * dot * ny) * 0.85;
          this.audio.playBounce();
          this.particles.spawnSparks(r.x, r.y, obs.color, 4);
        }
      }
    }

    // Inter-player collision & Bomb Passing
    const runnerArr = Array.from(this.runners.values()).filter((r) => r.alive);
    for (let i = 0; i < runnerArr.length; i++) {
      for (let j = i + 1; j < runnerArr.length; j++) {
        const p1 = runnerArr[i];
        const p2 = runnerArr[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const d = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius;

        if (d < minDist && d > 0) {
          const nx = dx / d;
          const ny = dy / d;

          // Check if Bomb Transfer occurs
          const p1IsCarrier = p1.id === this.bombHolderId && p1.invulnTimer <= 0;
          const p2IsCarrier = p2.id === this.bombHolderId && p2.invulnTimer <= 0;

          if (p1IsCarrier || p2IsCarrier) {
            const tagger = p1IsCarrier ? p1 : p2;
            const taggee = p1IsCarrier ? p2 : p1;
            const dirX = taggee.x - tagger.x;
            const dirY = taggee.y - tagger.y;
            const dirDist = Math.hypot(dirX, dirY) || 1;
            const sepNx = dirX / dirDist;
            const sepNy = dirY / dirDist;

            // Explosive Separation Blast: Push apart by extra clearance distance
            const pushDist = (minDist - d) + 40;
            tagger.x -= sepNx * (pushDist * 0.5);
            tagger.y -= sepNy * (pushDist * 0.5);
            taggee.x += sepNx * (pushDist * 0.5);
            taggee.y += sepNy * (pushDist * 0.5);

            // High-energy knockback velocity impulse away from each other
            const blastSpeed = 380;
            tagger.vx = -sepNx * blastSpeed;
            tagger.vy = -sepNy * blastSpeed;
            taggee.vx = sepNx * blastSpeed;
            taggee.vy = sepNy * blastSpeed;

            // Generous invulnerability timers on both players to prevent sticking or instant re-tagging
            tagger.invulnTimer = 1.3;
            taggee.invulnTimer = 1.3;

            // Transfer the bomb with audiovisual fireworks
            this.transferBomb(taggee.id, tagger.id);
          } else {
            // Normal elastic bounce between non-tagging runners to prevent sticking
            const pushDist = (minDist - d) + 8;
            p1.x -= nx * (pushDist * 0.5);
            p1.y -= ny * (pushDist * 0.5);
            p2.x += nx * (pushDist * 0.5);
            p2.y += ny * (pushDist * 0.5);

            const bounceSpeed = 190;
            p1.vx = -nx * bounceSpeed;
            p1.vy = -ny * bounceSpeed;
            p2.vx = nx * bounceSpeed;
            p2.vy = ny * bounceSpeed;
            this.audio.playBounce();
          }
        }
      }
    }

    // Check survivors
    const survivors = runnerArr.filter((r) => r.alive);
    if (survivors.length <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private transferBomb(newHolderId: PlayerId, oldHolderId?: PlayerId) {
    this.bombHolderId = newHolderId;
    const newHolder = this.runners.get(newHolderId);
    const oldHolder = oldHolderId !== undefined ? this.runners.get(oldHolderId) : null;

    // Escalating Fuse: Each pass shaves 12% off the remaining fuse!
    this.fuseTimer = Math.max(3.2, this.fuseTimer * 0.88);

    if (newHolder) {
      newHolder.invulnTimer = 1.3;
      this.audio.playBoost();
      this.particles.shake(8);
      this.particles.showFloatingText('💥 TAGGED! BOMB PASSED!', newHolder.x, newHolder.y - 25, '#EF4444', 22);
      this.particles.spawnSparks(newHolder.x, newHolder.y, '#EF4444', 20);
    }
    if (oldHolder) {
      oldHolder.invulnTimer = 1.3;
      oldHolder.score += 50;
      this.particles.showFloatingText('💨 ESCAPED! +50', oldHolder.x, oldHolder.y - 25, '#22C55E', 20);
      this.particles.spawnSparks(oldHolder.x, oldHolder.y, '#22C55E', 15);
    }
  }

  private detonateBomb() {
    const victim = this.runners.get(this.bombHolderId);
    if (victim && victim.alive) {
      victim.alive = false;
      this.eliminationOrder.push(victim.id);
      this.audio.playExplosion();
      this.particles.addTrauma(0.38);
      this.particles.spawnExplosion(victim.x, victim.y, '#EF4444', 45);
      this.particles.showFloatingText('💥 KABOOM! ELIMINATED!', victim.x, victim.y, '#EF4444', 26);
    }

    // Check if game over
    const survivors = Array.from(this.runners.values()).filter((r) => r.alive);
    if (survivors.length <= 1) {
      this.isFinished = true;
      return;
    }

    // Pick new bomb holder among survivors
    const choice = survivors[Math.floor(Math.random() * survivors.length)];
    this.bombHolderId = choice.id;
    choice.invulnTimer = 0.5;
    this.initialFuse = Math.max(5.5, this.initialFuse - 1.5);
    this.fuseTimer = this.initialFuse;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const me = this.runners.get(botId);
    if (!me || !me.alive) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    if (me.slipTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const isHolder = botId === this.bombHolderId;
    let steerX = 0;
    let steerY = 0;
    let wantAction = false;

    if (isHolder) {
      // Chasing nearest opponent
      let nearestOpp: RelayRunner | null = null;
      let minD = Infinity;
      for (const r of this.runners.values()) {
        if (r.id !== botId && r.alive) {
          const d = Math.hypot(r.x - me.x, r.y - me.y);
          if (d < minD) {
            minD = d;
            nearestOpp = r;
          }
        }
      }

      if (nearestOpp) {
        const dx = nearestOpp.x - me.x;
        const dy = nearestOpp.y - me.y;
        const mag = Math.hypot(dx, dy) || 1;
        steerX = dx / mag;
        steerY = dy / mag;
      }
    } else {
      // Fleeing from the bomb holder!
      const holder = this.runners.get(this.bombHolderId);
      if (holder && holder.alive) {
        const awayDx = me.x - holder.x;
        const awayDy = me.y - holder.y;
        const awayDist = Math.hypot(awayDx, awayDy) || 1;

        steerX = awayDx / awayDist;
        steerY = awayDy / awayDist;

        // If holder is dangerously close (< 110px), drop hazard banana peel!
        if (awayDist < 110 && me.hazardCooldown <= 0) {
          wantAction = true;
        }

        // Wall repulsion to avoid getting trapped against outer rim
        const distFromCenter = Math.hypot(me.x - this.arenaCenterX, me.y - this.arenaCenterY);
        if (distFromCenter > this.arenaRadius * 0.72) {
          const toCenterX = (this.arenaCenterX - me.x) / (distFromCenter || 1);
          const toCenterY = (this.arenaCenterY - me.y) / (distFromCenter || 1);
          steerX += toCenterX * 0.85;
          steerY += toCenterY * 0.85;
        }
      }
    }

    // Add difficulty inaccuracy
    if (difficulty === 'bot_easy') {
      steerX += (Math.random() - 0.5) * 0.8;
      steerY += (Math.random() - 0.5) * 0.8;
    }

    const mag = Math.hypot(steerX, steerY) || 1;
    this.input.setBotInput(botId, true, steerX / mag, -steerY / mag, wantAction);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const survivors = Array.from(this.runners.values()).filter((r) => r.alive);
    const winnerId = survivors.length === 1 ? survivors[0].id : (this.eliminationOrder[this.eliminationOrder.length - 1] ?? null);

    const rankedIds = [...survivors.map((s) => s.id), ...[...this.eliminationOrder].reverse()];

    return {
      winnerId,
      rankings: rankedIds.map((pid, idx) => ({
        playerId: pid,
        score: (this.runners.get(pid)?.score || 0) + (idx === 0 ? 100 : 0),
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} SURVIVED THE TICKING RELAY!` : 'THE BOMB DETONATED EVERYONE!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    const theme = BOMB_RELAY_THEMES[this.currentThemeIndex];

    // 1. Theme Arena Floor
    ctx.fillStyle = theme.floorBg;
    ctx.fillRect(0, 0, width, height);

    // Arena circular boundary fill
    const arenaGrad = ctx.createRadialGradient(
      this.arenaCenterX, this.arenaCenterY, 30,
      this.arenaCenterX, this.arenaCenterY, this.arenaRadius
    );
    arenaGrad.addColorStop(0, theme.gradStart);
    arenaGrad.addColorStop(0.85, theme.gradMid);
    arenaGrad.addColorStop(1, theme.gradEnd);
    ctx.fillStyle = arenaGrad;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius, 0, Math.PI * 2);
    ctx.fill();

    // Hazard Concentric Target Rings
    ctx.strokeStyle = theme.ringColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius * 0.75, 0, Math.PI * 2);
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius * 0.5, 0, Math.PI * 2);
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius * 0.25, 0, Math.PI * 2);
    ctx.stroke();

    // High-Voltage Neon Perimeter Rim
    const isCriticalFuse = this.fuseTimer < 3.2;
    ctx.save();
    ctx.shadowColor = isCriticalFuse ? '#EF4444' : theme.rimColor;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = isCriticalFuse ? '#EF4444' : theme.rimColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Internal Tactical Obstacles
    for (const obs of this.obstacles) {
      ctx.save();
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = obs.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      // Center jewel node
      ctx.fillStyle = obs.color;
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Hazard Slicks (Bananas 🍌 & Oil Puddles 🛢️)
    for (const slick of this.slicks) {
      ctx.save();
      ctx.translate(slick.x, slick.y);

      if (slick.type === 'banana') {
        // Banana Peel
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.arc(-8, -2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FBBF24';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🍌', 0, -8);
      } else {
        // Oil Slick Puddle
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 9, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#A855F7';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Iridescent rainbow sheen
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(2, -2, 5, 0, Math.PI);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Render Runners with CharacterRenderer Mascots
    const activeRunners = Array.from(this.runners.values()).filter((r) => r.alive);
    let maxScore = 0;
    for (const r of activeRunners) {
      if (r.score > maxScore) maxScore = r.score;
    }

    for (const r of this.runners.values()) {
      if (!r.alive) continue;

      ctx.save();
      const pColor = this.players[r.id]?.color || '#FFFFFF';
      const isHolder = r.id === this.bombHolderId;
      const isUnderdog = !isHolder && (maxScore - r.score >= 50 || activeRunners.length <= 2);

      // Bomb carrier pulsating warning aura
      if (isHolder) {
        ctx.save();
        const pulse = (Math.sin(performance.now() * 0.012) + 1) * 0.5;
        ctx.fillStyle = isCriticalFuse ? `rgba(239, 68, 68, ${0.28 + pulse * 0.3})` : `rgba(245, 158, 11, ${0.22 + pulse * 0.18})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Underdog Golden Surge Aura
      if (isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(r.x, r.y + r.radius - 2, r.radius * 0.9, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Determine emotional mood for Mascot
      let mood: CharacterMood = 'focused';
      if (isHolder) {
        mood = isCriticalFuse ? 'shocked' : 'focused';
      } else if (r.slipTimer > 0) {
        mood = 'shocked';
      } else if (r.score > 0) {
        mood = 'triumph';
      }

      // Draw standard character mascot
      this.drawPlayerMascot(ctx, r.id, r.x, r.y, r.radius, mood, performance.now() * 0.001);

      // Player name badge below character
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(r.x - 36, r.y + r.radius + 6, 72, 18, 9);
      else ctx.rect(r.x - 36, r.y + r.radius + 6, 72, 18);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.players[r.id].name.toUpperCase(), r.x, r.y + r.radius + 15);

      // Render Bomb above holder's head!
      if (isHolder) {
        this.renderBomb(ctx, r.x, r.y - 32);
      }

      ctx.restore();
    }

    // 3. Fuse Countdown HUD Pill (Positioned safely at y=58 below stopwatch timer)
    ctx.save();
    const pillW = 300;
    const pillH = 30;
    const pillX = width / 2 - pillW / 2;
    const pillY = 58;
    const isSuddenDeath = this.roundTimer <= 15;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 15);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();

    const pillBorderColor = isCriticalFuse || isSuddenDeath ? '#EF4444' : '#F59E0B';
    ctx.strokeStyle = pillBorderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = pillBorderColor;
    ctx.font = '900 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isSuddenDeath) {
      ctx.fillText(`🚨 HYPER FUSE: ${Math.max(0, this.fuseTimer).toFixed(1)}s (TAP: DROP 🍌) 🚨`, width / 2, pillY + pillH / 2);
    } else {
      ctx.fillText(`💣 BOMB DETONATION: ${Math.max(0, this.fuseTimer).toFixed(1)}s (TAP: DROP 🍌) 💣`, width / 2, pillY + pillH / 2);
    }
    ctx.restore();

    // 4. Interactive Bottom-Left Theme & Map Pill (x: 20, y: height - 44, w: 180, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 180, 32, 16);
    else ctx.rect(20, height - 44, 180, 32);
    ctx.fill();
    ctx.strokeStyle = theme.rimColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.rimColor;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 90, height - 44 + 16);
    ctx.restore();

    ctx.restore();
  }

  private renderBomb(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 16, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bomb spherical body with 3D gradient
    const bombGrad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, 16);
    bombGrad.addColorStop(0, '#52525B');
    bombGrad.addColorStop(0.6, '#18181B');
    bombGrad.addColorStop(1, '#09090B');
    ctx.fillStyle = bombGrad;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glossy catchlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x - 6, y - 6, 5, 3, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // Brass fuse neck
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - 4, y - 21, 8, 6, 2);
    else ctx.rect(x - 4, y - 21, 8, 6);
    ctx.fill();

    // Curved rope fuse
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 21);
    ctx.quadraticCurveTo(x + 6, y - 26, x + 2, y - 30);
    ctx.stroke();

    // Sizzling spark explosion flame
    const sparkX = x + 2;
    const sparkY = y - 30;
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
