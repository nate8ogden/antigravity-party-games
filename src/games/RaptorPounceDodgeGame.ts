import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface RaptorAttack {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  telegraphTimer: number; // counts down to pounce
  pounceProgress: number; // 0 to 1 during leap
  isLeaping: boolean;
  done: boolean;
}

interface RaptorPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dodgeCooldown: number;
  stunTimer: number;
  score: number;
}

export class RaptorPounceDodgeGame extends BaseGame {
  private raptors: RaptorAttack[] = [];
  private playersState: Map<PlayerId, RaptorPlayer> = new Map();
  private spawnRaptorTimer: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.raptors = [];
    this.spawnRaptorTimer = 1.0;
    this.playersState.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const cx = width / 2;
    const cy = height / 2;

    active.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      this.playersState.set(p.id, {
        id: p.id,
        x: cx + Math.cos(angle) * 70,
        y: cy + Math.sin(angle) * 70,
        vx: 0,
        vy: 0,
        dodgeCooldown: 0,
        stunTimer: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Spawn velociraptor pounces
    this.spawnRaptorTimer -= dt;
    if (this.spawnRaptorTimer <= 0) {
      this.spawnRaptorTimer = 1.4 + Math.random() * 0.8;

      // Pick a random player as the target
      const active = this.getActivePlayers();
      const targetP = active[Math.floor(Math.random() * active.length)];
      const ps = this.playersState.get(targetP.id);
      const tx = ps ? ps.x : width / 2;
      const ty = ps ? ps.y : height / 2;

      // Spawn from outside arena edge
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = Math.max(width, height) * 0.55;
      const sx = width / 2 + Math.cos(angle) * spawnDist;
      const sy = height / 2 + Math.sin(angle) * spawnDist;

      this.raptors.push({
        startX: sx,
        startY: sy,
        targetX: tx,
        targetY: ty,
        currentX: sx,
        currentY: sy,
        telegraphTimer: 0.85,
        pounceProgress: 0,
        isLeaping: false,
        done: false
      });
    }

    // Update raptors
    for (let i = this.raptors.length - 1; i >= 0; i--) {
      const r = this.raptors[i];
      if (!r.isLeaping) {
        r.telegraphTimer -= dt;
        if (r.telegraphTimer <= 0) {
          r.isLeaping = true;
          this.audio.playWhoosh();
        }
      } else {
        r.pounceProgress += dt * 3.4; // very fast leap
        r.currentX = r.startX + (r.targetX - r.startX) * r.pounceProgress;
        r.currentY = r.startY + (r.targetY - r.startY) * r.pounceProgress;

        // Check claw strikes on players
        for (const p of this.getActivePlayers()) {
          const ps = this.playersState.get(p.id);
          if (!ps || ps.stunTimer > 0) continue;

          const dist = Math.hypot(ps.x - r.currentX, ps.y - r.currentY);
          if (dist < 26) {
            // Pounced!
            ps.stunTimer = 1.2;
            ps.score = Math.max(0, ps.score - 15);
            this.audio.playStun();
            this.particles.showFloatingText('CLAWED! -15', ps.x, ps.y - 20, '#EF4444', 22);
            this.particles.spawnExplosion(ps.x, ps.y, '#DC2626', 12);
          } else if (dist < 55 && r.pounceProgress > 0.8 && r.pounceProgress < 1.0) {
            // Close Call Dodge!
            ps.score += 25;
            this.audio.playScore();
            this.particles.showFloatingText('CLOSE DODGE! +25', ps.x, ps.y - 18, '#10B981', 18);
          }
        }

        if (r.pounceProgress >= 1.2) {
          r.done = true;
          this.raptors.splice(i, 1);
        }
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }
      if (ps.dodgeCooldown > 0) ps.dodgeCooldown -= dt;

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const mag = Math.hypot(steerX, steerY);

      if (mag > 0.2) {
        const speed = 210;
        ps.x += (steerX / mag) * speed * dt;
        ps.y += (steerY / mag) * speed * dt;
      }

      // Tap to Dodge Roll
      if (this.input.justPressed(p.id) && ps.dodgeCooldown <= 0) {
        ps.dodgeCooldown = 0.8;
        const rollDirX = mag > 0.2 ? steerX / mag : Math.cos(Math.random() * Math.PI * 2);
        const rollDirY = mag > 0.2 ? steerY / mag : Math.sin(Math.random() * Math.PI * 2);
        ps.x += rollDirX * 65;
        ps.y += rollDirY * 65;
        this.audio.playBounce();
        this.particles.spawnDust(ps.x, ps.y, 6);
      }

      // Keep within arena bounds
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width, height) * 0.42;
      const distFromCenter = Math.hypot(ps.x - cx, ps.y - cy);
      if (distFromCenter > maxR) {
        const a = Math.atan2(ps.y - cy, ps.x - cx);
        ps.x = cx + Math.cos(a) * maxR;
        ps.y = cy + Math.sin(a) * maxR;
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Prehistoric Fern Clearing
    const cx = width / 2;
    const cy = height / 2;
    const arenaR = Math.min(width, height) * 0.44;

    const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, width * 0.7);
    bgGrad.addColorStop(0, '#064E3B');
    bgGrad.addColorStop(0.7, '#022C22');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Arena Perimeter Ring of Dense Ferns
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, arenaR, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Draw Raptor Telegraphs & Leaping Raptors
    for (const r of this.raptors) {
      ctx.save();
      if (!r.isLeaping) {
        // Red laser trajectory threat line
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(r.startX, r.startY);
        ctx.lineTo(r.targetX, r.targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Danger Pounce Reticle at target
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.beginPath();
        ctx.arc(r.targetX, r.targetY, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Glowing Raptor Eyes in brush
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(r.startX - 5, r.startY, 3, 0, Math.PI * 2);
        ctx.arc(r.startX + 5, r.startY, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Flying Leaping Velociraptor Sprite
        ctx.translate(r.currentX, r.currentY);
        const leapAngle = Math.atan2(r.targetY - r.startY, r.targetX - r.startX);
        ctx.rotate(leapAngle);

        // Scaled Raptor Body
        ctx.fillStyle = '#B45309';
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Sickle Claw Extended
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(8, 8);
        ctx.quadraticCurveTo(18, 14, 22, 6);
        ctx.stroke();

        // Raptor Jaws
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.moveTo(18, -4);
        ctx.lineTo(28, 0);
        ctx.lineTo(18, 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Draw Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Player circle
      ctx.fillStyle = ps.stunTimer > 0 ? '#64748B' : p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Stun indicator if stunned
      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#FBBF24';
        ctx.font = '900 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*STUN*', 0, -18);
      }
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 20);
    }

    // 4. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    // Check incoming raptors aimed near bot
    let imminentThreat: RaptorAttack | null = null;
    for (const r of this.raptors) {
      if (Math.hypot(ps.x - r.targetX, ps.y - r.targetY) < 60) {
        imminentThreat = r;
        break;
      }
    }

    if (imminentThreat && ps.dodgeCooldown <= 0) {
      // Evade perpendicular to threat line
      const dx = imminentThreat.targetX - imminentThreat.startX;
      const dy = imminentThreat.targetY - imminentThreat.startY;
      const perpX = -dy;
      const perpY = dx;
      const mag = Math.hypot(perpX, perpY) || 1;

      const shouldRoll = difficulty === 'bot_hard' || (difficulty === 'bot_normal' && Math.random() < 0.7);
      if (shouldRoll) {
        this.input.setBotInput(botId, true, perpX / mag, -perpY / mag, true);
      } else {
        this.input.setBotInput(botId, true, perpX / mag, -perpY / mag, false);
      }
    } else {
      // Calm movement towards center
      const cx = width / 2;
      const cy = height / 2;
      const dx = cx - ps.x;
      const dy = cy - ps.y;
      const d = Math.hypot(dx, dy);
      if (d > 30) {
        this.input.setBotInput(botId, true, dx / d, -dy / d, false);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
    }
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

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} dodged savage velociraptor pounces with lightning reflexes!` : 'Tied raptor dodging!'
    };
  }
}
