import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PicnicCrumbs {
  x: number;
  y: number;
  type: 'SUGAR' | 'SEED' | 'BERRY';
  points: number;
  weight: number;
  carriedBy: PlayerId | null;
}

interface AntPlayer {
  id: PlayerId;
  x: number;
  y: number;
  carriedCrumb: PicnicCrumbs | null;
  score: number;
}

export class AntColonyHaulGame extends BaseGame {
  private crumbs: PicnicCrumbs[] = [];
  private playersState: Map<PlayerId, AntPlayer> = new Map();
  private pantryX: number = 0;
  private pantryY: number = 0;

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
    this.crumbs = [];
    this.playersState.clear();

    this.pantryX = width / 2;
    this.pantryY = height - 50;

    // Spawn 8 picnic crumbs along surface top
    const types: ('SUGAR' | 'SEED' | 'BERRY')[] = ['SUGAR', 'SEED', 'BERRY'];
    for (let i = 0; i < 8; i++) {
      const t = types[i % types.length];
      this.crumbs.push({
        x: 60 + i * ((width - 120) / 7),
        y: 80 + (i % 2) * 25,
        type: t,
        points: t === 'BERRY' ? 50 : t === 'SEED' ? 35 : 20,
        weight: t === 'BERRY' ? 1.4 : t === 'SEED' ? 1.2 : 1.0,
        carriedBy: null
      });
    }

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: this.pantryX + (idx - count / 2) * 40,
        y: this.pantryY,
        carriedCrumb: null,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const mag = Math.hypot(steerX, steerY);

      if (mag > 0.2) {
        const speed = ps.carriedCrumb ? 200 / ps.carriedCrumb.weight : 230;
        ps.x += (steerX / mag) * speed * dt;
        ps.y += (steerY / mag) * speed * dt;
      }

      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(60, Math.min(height - 40, ps.y));

      // Carry crumb positioning
      if (ps.carriedCrumb) {
        ps.carriedCrumb.x = ps.x;
        ps.carriedCrumb.y = ps.y - 18;

        // Check delivery to colony pantry
        if (Math.hypot(ps.x - this.pantryX, ps.y - this.pantryY) < 42) {
          ps.score += ps.carriedCrumb.points;
          this.audio.playScore();
          this.particles.showFloatingText(`+${ps.carriedCrumb.points} PANTRY!`, this.pantryX, this.pantryY - 24, '#FBBF24', 22);
          this.particles.spawnConfetti(this.pantryX, this.pantryY, 12);

          // Reset crumb back to surface
          ps.carriedCrumb.carriedBy = null;
          ps.carriedCrumb.x = 40 + Math.random() * (width - 80);
          ps.carriedCrumb.y = 70 + Math.random() * 40;
          ps.carriedCrumb = null;
        }
      } else {
        // Pick up nearby uncarried crumb
        for (const c of this.crumbs) {
          if (!c.carriedBy && Math.hypot(ps.x - c.x, ps.y - c.y) < 26) {
            c.carriedBy = p.id;
            ps.carriedCrumb = c;
            this.audio.playTap();
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
    // 1. Subterranean Ant Hill Earth Cross-Section
    const groundY = 120;
    // Aboveground picnic lawn
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, 0, width, groundY);

    // Underground soil chambers
    const soilGrad = ctx.createLinearGradient(0, groundY, 0, height);
    soilGrad.addColorStop(0, '#78350F');
    soilGrad.addColorStop(0.5, '#451A03');
    soilGrad.addColorStop(1, '#270E02');
    ctx.fillStyle = soilGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Tunnels (carved out light brown tracks)
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 44;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(width * 0.2, groundY);
    ctx.lineTo(this.pantryX, this.pantryY);
    ctx.moveTo(width * 0.8, groundY);
    ctx.lineTo(this.pantryX, this.pantryY);
    ctx.moveTo(this.pantryX, groundY);
    ctx.lineTo(this.pantryX, this.pantryY);
    ctx.stroke();

    // 2. Colony Queen Food Pantry Chamber
    ctx.fillStyle = '#571D05';
    ctx.beginPath();
    ctx.arc(this.pantryX, this.pantryY, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#FDE047';
    ctx.font = '700 9px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COLONY PANTRY', this.pantryX, this.pantryY + 4);

    // 3. Draw Picnic Food Crumbs
    for (const c of this.crumbs) {
      ctx.save();
      ctx.translate(c.x, c.y);

      if (c.type === 'SUGAR') {
        // Sparkling White Sugar Cube
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-8, -8, 16, 16);
      } else if (c.type === 'SEED') {
        // Black Watermelon Seed
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 6, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Juicy Red Berry
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(0, -7, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Draw Ants
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Ant 3-segment body: Head, Thorax, Gaster
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(-8, 0, 8, 6, 0, 0, Math.PI * 2); // abdomen
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2); // thorax
      ctx.fill();
      ctx.beginPath();
      ctx.arc(6, 0, 5, 0, Math.PI * 2); // head
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Mandibles
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(10, -2);
      ctx.lineTo(14, -4);
      ctx.moveTo(10, 2);
      ctx.lineTo(14, 4);
      ctx.stroke();

      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 24);
    }

    // 5. Header HUD
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
    if (!ps) return;

    let targetX = this.pantryX;
    let targetY = this.pantryY;

    if (!ps.carriedCrumb) {
      // Find nearest uncarried crumb
      let nearestCrumb: PicnicCrumbs | null = null;
      let minDist = 9999;
      for (const c of this.crumbs) {
        if (!c.carriedBy) {
          const d = Math.hypot(c.x - ps.x, c.y - ps.y);
          if (d < minDist) {
            minDist = d;
            nearestCrumb = c;
          }
        }
      }
      if (nearestCrumb) {
        targetX = nearestCrumb.x;
        targetY = nearestCrumb.y;
      }
    }

    const dx = targetX - ps.x;
    const dy = targetY - ps.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 10) {
      const err = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.2 : 0.45;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * err;
      this.input.setBotInput(botId, true, Math.cos(angle), -Math.sin(angle), true);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
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
      mvpHighlight: winnerId ? `${winnerId} hauled the heaviest harvest down to the ant colony pantry!` : 'Tied ant colony haul!'
    };
  }
}
