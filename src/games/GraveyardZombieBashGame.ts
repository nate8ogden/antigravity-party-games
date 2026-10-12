import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CemeteryGrave {
  x: number;
  y: number;
  zombieState: 'EMPTY' | 'RISING' | 'UP' | 'BASHED';
  isGhoul: boolean;
  timer: number;
  heightOffset: number; // 0 to 24
}

interface GraveDigger {
  id: PlayerId;
  x: number;
  y: number;
  swingCooldown: number;
  score: number;
}

export class GraveyardZombieBashGame extends BaseGame {
  private graves: CemeteryGrave[] = [];
  private diggers: Map<PlayerId, GraveDigger> = new Map();

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
    this.graves = [];
    this.diggers.clear();

    // 8 grave plots arranged in a 4x2 grid
    const cols = 4;
    const rows = 2;
    const stepX = (width - 120) / (cols - 1);
    const stepY = 90;
    const startY = height * 0.44;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.graves.push({
          x: 60 + c * stepX,
          y: startY + r * stepY,
          zombieState: 'EMPTY',
          isGhoul: false,
          timer: 0.5 + Math.random() * 2,
          heightOffset: 0
        });
      }
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.diggers.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 50,
        swingCooldown: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update Graves
    for (const g of this.graves) {
      g.timer -= dt;

      if (g.zombieState === 'EMPTY') {
        if (g.timer <= 0) {
          g.zombieState = 'RISING';
          g.isGhoul = Math.random() < 0.3;
          g.timer = 0.6; // rise duration
          g.heightOffset = 0;
          this.audio.playWhoosh();
        }
      } else if (g.zombieState === 'RISING') {
        g.heightOffset = Math.min(24, g.heightOffset + dt * 45);
        if (g.timer <= 0) {
          g.zombieState = 'UP';
          g.timer = 1.4; // active window
          g.heightOffset = 24;
        }
      } else if (g.zombieState === 'UP') {
        if (g.timer <= 0) {
          // Retract back into grave
          g.zombieState = 'EMPTY';
          g.timer = 1.0 + Math.random() * 1.5;
          g.heightOffset = 0;
        }
      } else if (g.zombieState === 'BASHED') {
        g.heightOffset = Math.max(0, g.heightOffset - dt * 60);
        if (g.timer <= 0) {
          g.zombieState = 'EMPTY';
          g.timer = 1.2 + Math.random() * 1.8;
          g.heightOffset = 0;
        }
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.diggers.get(p.id);
      if (!ps) continue;

      if (ps.swingCooldown > 0) ps.swingCooldown -= dt;

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const mag = Math.hypot(steerX, steerY);

      if (mag > 0.2) {
        const speed = 210;
        ps.x += (steerX / mag) * speed * dt;
        ps.y += (steerY / mag) * speed * dt;
      }

      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(height * 0.35, Math.min(height - 30, ps.y));

      // Shovel Whack
      const tap = this.input.justPressed(p.id);
      if (tap && ps.swingCooldown <= 0) {
        ps.swingCooldown = 0.4;
        this.audio.playTap();

        // Check hitting a rising or up zombie
        for (const g of this.graves) {
          if ((g.zombieState === 'RISING' || g.zombieState === 'UP') && Math.hypot(ps.x - g.x, ps.y - (g.y - g.heightOffset)) < 36) {
            g.zombieState = 'BASHED';
            g.timer = 0.6;
            const pts = g.isGhoul ? 40 : 20;
            ps.score += pts;

            this.audio.playExplosion();
            this.particles.showFloatingText(`BASHED! +${pts}`, g.x, g.y - 30, g.isGhoul ? '#EF4444' : '#10B981', 20);
            this.particles.spawnExplosion(g.x, g.y - 10, g.isGhoul ? '#EF4444' : '#10B981', 10);
            break;
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Spooky Foggy Graveyard Night
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.4, '#1E1B4B');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Glowing Full Moon
    ctx.fillStyle = '#FEF08A';
    ctx.shadowColor = '#FEF08A';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(width * 0.85, 60, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 2. Draw Graves & Zombies
    for (const g of this.graves) {
      ctx.save();
      ctx.translate(g.x, g.y);

      // Crooked Tombstone
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, -18, 12, Math.PI, 0, false);
      ctx.lineTo(12, 0);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // R.I.P. inscription
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '700 7px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('R.I.P.', 0, -6);

      // Dirt Mound & Open Grave Pit
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.ellipse(0, 4, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(0, 4, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rising Zombie Body
      if (g.heightOffset > 0) {
        ctx.save();
        ctx.translate(0, -g.heightOffset + 4);

        // Green zombie skin or red ghoul
        ctx.fillStyle = g.isGhoul ? '#DC2626' : '#15803D';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glowing Yellow Eyes
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(-3, -2, 2, 0, Math.PI * 2);
        ctx.arc(3, -2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Reaching undead claw arms
        ctx.strokeStyle = g.isGhoul ? '#DC2626' : '#15803D';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-8, 2);
        ctx.lineTo(-15, -6);
        ctx.moveTo(8, 2);
        ctx.lineTo(15, -6);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // 3. Draw Grave Digger Players
    for (const p of this.getActivePlayers()) {
      const ps = this.diggers.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Shovel
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(6, 6);
      ctx.lineTo(16, -14);
      ctx.stroke();
      // Shovel blade
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(14, -18, 8, 6);

      // Player circle body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

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
    const ps = this.diggers.get(botId);
    if (!ps || ps.swingCooldown > 0) return;

    // Find nearest rising or up zombie
    let targetGrave: CemeteryGrave | null = null;
    let minDist = 9999;
    for (const g of this.graves) {
      if (g.zombieState === 'RISING' || g.zombieState === 'UP') {
        const d = Math.hypot(g.x - ps.x, g.y - ps.y);
        if (d < minDist) {
          minDist = d;
          targetGrave = g;
        }
      }
    }

    if (targetGrave) {
      const dx = targetGrave.x - ps.x;
      const dy = targetGrave.y - ps.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 34) {
        // Whack!
        this.input.setBotInput(botId, true, 0, 0, true);
      } else {
        const err = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.2 : 0.45;
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * err;
        this.input.setBotInput(botId, true, Math.cos(angle), -Math.sin(angle), false);
      }
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.diggers.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.diggers.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} bashed the graveyard zombies back into their tombs!` : 'Tied zombie bashing!'
    };
  }
}
