import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface GalleryTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  type: 'duck' | 'clay' | 'star' | 'skull';
  radius: number;
  points: number;
  isHit: boolean;
  hitAnim: number;
}

interface SniperPlayer {
  id: PlayerId;
  reticleX: number;
  reticleY: number;
  score: number;
  shotsFired: number;
  hits: number;
  streak: number;
  cooldown: number;
}

export class TargetSniperGame extends BaseGame {
  public targets: GalleryTarget[] = [];
  public playersState: Map<PlayerId, SniperPlayer> = new Map();
  public currentMapName: string = 'Carnival Shooting Gallery';

  private spawnTimer: number = 0.6;
  private targetIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.targets = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.spawnTimer = 0.5;
    this.targetIdCounter = 0;

    // Pre-populate initial targets across 3 gallery conveyor tiers
    const tiers = [height * 0.28, height * 0.48, height * 0.68];
    tiers.forEach((ty, row) => {
      for (let i = 0; i < 4; i++) {
        const tx = width * 0.15 + i * 160;
        const dir = row % 2 === 0 ? 1 : -1;
        this.targets.push({
          id: this.targetIdCounter++,
          x: tx,
          y: ty,
          vx: dir * (90 + row * 40),
          type: row === 0 ? 'clay' : row === 1 ? 'duck' : 'star',
          radius: 20,
          points: row === 0 ? 50 : row === 1 ? 30 : 100,
          isHit: false,
          hitAnim: 0
        });
      }
    });

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        reticleX: width * 0.25 + idx * 120,
        reticleY: height * 0.5,
        score: 0,
        shotsFired: 0,
        hits: 0,
        streak: 0,
        cooldown: 0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Spawn new targets periodically
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.8 + Math.random() * 0.4;
      this.spawnRandomTarget(width, height);
    }

    // Move targets along conveyor rows
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.x += t.vx * dt;

      if (t.hitAnim > 0) {
        t.hitAnim = Math.max(0, t.hitAnim - dt * 3.5);
      }

      // Despawn off-screen targets
      if ((t.vx > 0 && t.x > width + 40) || (t.vx < 0 && t.x < -40)) {
        this.targets.splice(i, 1);
      }
    }

    // Update players reticles and shots
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.cooldown > 0) ps.cooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Smooth crosshair reticle motion
      const reticleSpeed = 380;
      ps.reticleX += steer * reticleSpeed * dt;
      ps.reticleY += -throttle * reticleSpeed * dt;

      ps.reticleX = Math.max(60, Math.min(width - 60, ps.reticleX));
      ps.reticleY = Math.max(80, Math.min(height - 80, ps.reticleY));

      // Shoot action
      if (justAction && ps.cooldown <= 0) {
        ps.cooldown = 0.24;
        ps.shotsFired += 1;
        this.audio.playTap();
        this.particles.spawnSparks(ps.reticleX, ps.reticleY, '#FBBF24', 6);

        // Check if shot hit any un-hit target
        let hitSomething = false;
        for (const t of this.targets) {
          if (t.isHit) continue;
          const dist = Math.hypot(t.x - ps.reticleX, t.y - ps.reticleY);
          if (dist < t.radius + 6) {
            hitSomething = true;
            t.isHit = true;
            t.hitAnim = 1.0;

            if (t.type === 'skull') {
              // Penalty
              ps.streak = 0;
              ps.score = Math.max(0, ps.score - 60);
              this.audio.playExplosion();
              this.particles.shake(6);
              this.particles.spawnExplosion(t.x, t.y, '#EF4444', 18);
            } else {
              // Valid hit
              ps.hits += 1;
              ps.streak += 1;
              const multiplier = Math.min(4, 1 + Math.floor(ps.streak / 3));
              const pts = t.points * multiplier;
              ps.score += pts;

              if (t.type === 'star') {
                this.audio.playScore();
                this.particles.shake(4);
                this.particles.spawnExplosion(t.x, t.y, '#F59E0B', 20);
              } else {
                this.audio.playLaser();
                this.particles.spawnSparks(t.x, t.y, '#10B981', 12);
              }
            }
            break;
          }
        }

        if (!hitSomething) {
          ps.streak = 0;
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnRandomTarget(width: number, height: number): void {
    const row = Math.floor(Math.random() * 3);
    const tiers = [height * 0.28, height * 0.48, height * 0.68];
    const ty = tiers[row];
    const dir = row % 2 === 0 ? 1 : -1;
    const startX = dir > 0 ? -30 : width + 30;

    const roll = Math.random();
    let type: 'duck' | 'clay' | 'star' | 'skull' = 'duck';
    let pts = 30;

    if (roll < 0.15) {
      type = 'skull';
      pts = -50;
    } else if (roll < 0.35) {
      type = 'star';
      pts = 100;
    } else if (roll < 0.65) {
      type = 'clay';
      pts = 50;
    }

    this.targets.push({
      id: this.targetIdCounter++,
      x: startX,
      y: ty,
      vx: dir * (100 + row * 40),
      type,
      radius: 20,
      points: pts,
      isHit: false,
      hitAnim: 0
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.playersState.get(botId);
    if (!bot) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.35 + Math.random() * 0.22
        : difficulty === 'bot_normal'
        ? 0.18 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    // Find closest non-skull un-hit target
    const validTargets = this.targets.filter((t) => !t.isHit && t.type !== 'skull');
    if (validTargets.length > 0) {
      // Prioritize high-value stars or ducks
      const target = validTargets.find((t) => t.type === 'star') || validTargets[0];
      const leadTime = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.12 : 0;
      let targetX = target.x + target.vx * leadTime;
      let targetY = target.y;

      if (difficulty === 'bot_easy') {
        targetX += (Math.random() - 0.5) * 40;
        targetY += (Math.random() - 0.5) * 30;
      } else if (difficulty === 'bot_normal') {
        targetX += (Math.random() - 0.5) * 16;
        targetY += (Math.random() - 0.5) * 12;
      }

      // Smooth tracking toward target
      const dx = targetX - bot.reticleX;
      const dy = targetY - bot.reticleY;
      const dist = Math.hypot(dx, dy);
      const trackingSpeed = difficulty === 'bot_hard' ? 580 : difficulty === 'bot_normal' ? 400 : 250;

      if (dist > 6) {
        bot.reticleX += (dx / dist) * Math.min(dist, trackingSpeed * dt * 4);
        bot.reticleY += (dy / dist) * Math.min(dist, trackingSpeed * dt * 4);
      }

      // Shoot when reticle is over target
      if (dist < target.radius + 10 && bot.cooldown <= 0) {
        bot.cooldown = 0.28;
        bot.shotsFired += 1;
        target.isHit = true;
        target.hitAnim = 1.0;
        bot.hits += 1;
        bot.streak += 1;
        bot.score += target.points;
        this.audio.playLaser();
        this.particles.spawnSparks(target.x, target.y, '#10B981', 8);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0,
        hits: ps?.hits || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topHits = scores[0]?.hits || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} sharp-shot ${topHits} targets across the carnival gallery!`
      : 'All targets escaped untouched!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Carnival Striped Tent Canopy Background
    ctx.fillStyle = '#7F1D1D';
    ctx.fillRect(0, 0, width, height);

    // Red and cream carnival stripes
    ctx.fillStyle = '#FEF3C7';
    for (let x = 0; x < width; x += 60) {
      ctx.fillRect(x, 0, 30, height * 0.16);
    }

    // Wooden Gallery Shelves
    const tiers = [height * 0.28, height * 0.48, height * 0.68];
    ctx.fillStyle = '#78350F';
    tiers.forEach((ty) => {
      ctx.fillRect(40, ty + 16, width - 80, 14);
      // Brass railing
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(40, ty + 12, width - 80, 4);
      ctx.fillStyle = '#78350F';
    });

    // 2. Draw Moving Targets
    for (const t of this.targets) {
      ctx.save();
      const dropOffset = t.hitAnim > 0 ? t.hitAnim * 14 : 0;
      ctx.translate(t.x, t.y + dropOffset);

      if (t.isHit) {
        ctx.rotate(0.3);
      }

      if (t.type === 'duck') {
        // Yellow Duck Cutout
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(10, -8, 8, 0, Math.PI * 2);
        ctx.fill();

        // Orange Beak
        ctx.fillStyle = '#EA580C';
        ctx.beginPath();
        ctx.moveTo(16, -10);
        ctx.lineTo(24, -7);
        ctx.lineTo(16, -4);
        ctx.closePath();
        ctx.fill();
      } else if (t.type === 'clay') {
        // Red Clay Pigeon Target
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();
      } else if (t.type === 'star') {
        // Golden Star Target
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', 0, 0);
      } else if (t.type === 'skull') {
        // Skull Hazard Cutout
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀', 0, 0);
      }

      ctx.restore();
    }

    // 3. Draw Crosshair Reticles
    for (const p of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === p.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;

      // Outer aiming circle
      ctx.beginPath();
      ctx.arc(p.reticleX, p.reticleY, 18, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(p.reticleX - 24, p.reticleY);
      ctx.lineTo(p.reticleX - 10, p.reticleY);
      ctx.moveTo(p.reticleX + 10, p.reticleY);
      ctx.lineTo(p.reticleX + 24, p.reticleY);
      ctx.moveTo(p.reticleX, p.reticleY - 24);
      ctx.lineTo(p.reticleX, p.reticleY - 10);
      ctx.moveTo(p.reticleX, p.reticleY + 10);
      ctx.lineTo(p.reticleX, p.reticleY + 24);
      ctx.stroke();

      // Player ID Badge below crosshair
      ctx.fillStyle = color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}`, p.reticleX, p.reticleY + 28);

      // Streak badge if >= 3
      if (p.streak >= 3) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.streak}x STREAK!`, p.reticleX, p.reticleY - 28);
      }

      // Player Pill
      ctx.fillStyle = color;
      ctx.font = 'bold 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}`, p.reticleX, p.reticleY + 30);

      ctx.restore();
    }

    // 4. Draw HUD
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width * 0.5, 30);

    // Score bar
    const active = this.getActivePlayers();
    const itemW = 95;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(subBarX, 54, subBarW, 26, 6);
    ctx.fill();

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${p.id + 1}: 🎯${ps?.score || 0}`, px, 67);
    });

    ctx.restore();
  }
}
