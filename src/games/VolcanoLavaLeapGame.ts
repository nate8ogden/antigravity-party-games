import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BasaltPillar {
  id: number;
  x: number;
  y: number;
  radius: number;
  isSubmerged: boolean;
  rumbleTimer: number;
  sinkTimer: number;
  hasRuby: boolean;
}

interface LavaLeaper {
  id: PlayerId;
  currentPillar: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isHopping: boolean;
  score: number;
}

export class VolcanoLavaLeapGame extends BaseGame {
  private pillars: BasaltPillar[] = [];
  private playersState: Map<PlayerId, LavaLeaper> = new Map();
  private surgeTimer: number = 3.0;

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
    this.surgeTimer = 2.5;
    this.pillars = [];
    this.playersState.clear();

    const cx = width / 2;
    const cy = height * 0.52;

    // 1 center pillar + 6 surrounding ring pillars
    this.pillars.push({
      id: 0,
      x: cx,
      y: cy,
      radius: 36,
      isSubmerged: false,
      rumbleTimer: 0,
      sinkTimer: 0,
      hasRuby: false
    });

    const ringRadius = Math.min(width, height) * 0.32;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.pillars.push({
        id: i + 1,
        x: cx + Math.cos(a) * ringRadius,
        y: cy + Math.sin(a) * ringRadius,
        radius: 32,
        isSubmerged: false,
        rumbleTimer: 0,
        sinkTimer: 0,
        hasRuby: i === 0 || i === 3
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const pIdx = idx % this.pillars.length;
      const pil = this.pillars[pIdx];
      this.playersState.set(p.id, {
        id: p.id,
        currentPillar: pIdx,
        x: pil.x,
        y: pil.y,
        targetX: pil.x,
        targetY: pil.y,
        isHopping: false,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Periodic lava surge that submerges 2 random outer pillars
    this.surgeTimer -= dt;
    if (this.surgeTimer <= 0) {
      this.surgeTimer = 3.6;

      // Reset previous submerged
      for (const pil of this.pillars) {
        pil.isSubmerged = false;
        pil.rumbleTimer = 0;
      }

      // Pick 2 outer pillars to rumble and sink
      const outerIndices = [1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5).slice(0, 2);
      for (const idx of outerIndices) {
        this.pillars[idx].rumbleTimer = 1.0; // rumble 1s before sinking
      }
      this.audio.playExplosion();
      this.particles.shake(0.3);
    }

    // Update pillar rumble / sink
    for (const pil of this.pillars) {
      if (pil.rumbleTimer > 0) {
        pil.rumbleTimer -= dt;
        if (pil.rumbleTimer <= 0) {
          pil.isSubmerged = true;
          this.particles.spawnExplosion(pil.x, pil.y, '#EF4444', 10);
        }
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const curPillar = this.pillars[ps.currentPillar];

      // Check if current standing pillar is submerged in lava!
      if (curPillar && curPillar.isSubmerged && !ps.isHopping) {
        ps.score = Math.max(0, ps.score - 15);
        this.audio.playStun();
        this.particles.showFloatingText('LAVA SINGE! -15', ps.x, ps.y - 24, '#EF4444', 22);
        this.particles.spawnExplosion(ps.x, ps.y, '#F97316', 14);

        // Emergency rescue to center pillar
        ps.currentPillar = 0;
        ps.targetX = this.pillars[0].x;
        ps.targetY = this.pillars[0].y;
        ps.x = ps.targetX;
        ps.y = ps.targetY;
      }

      // Hop controls
      const hopAction = this.input.justPressed(p.id);
      if (hopAction && !ps.isHopping) {
        const steerX = this.input.getSteer(p.id);
        const steerY = -this.input.getThrottle(p.id);

        let targetPillarIdx = 0;
        if (Math.hypot(steerX, steerY) > 0.3) {
          // Find pillar closest to directional input
          let bestPillar = 0;
          let bestDot = -999;
          const mag = Math.hypot(steerX, steerY);
          const dirX = steerX / mag;
          const dirY = steerY / mag;

          for (const pil of this.pillars) {
            if (pil.id !== ps.currentPillar) {
              const dx = pil.x - ps.x;
              const dy = pil.y - ps.y;
              const d = Math.hypot(dx, dy);
              const dot = (dx / d) * dirX + (dy / d) * dirY;
              if (dot > bestDot) {
                bestDot = dot;
                bestPillar = pil.id;
              }
            }
          }
          targetPillarIdx = bestPillar;
        } else {
          // Default hop to next clockwise pillar or center
          targetPillarIdx = ps.currentPillar === 0 ? 1 : (ps.currentPillar % 6) + 1;
        }

        const nextPil = this.pillars[targetPillarIdx];
        if (nextPil) {
          ps.currentPillar = targetPillarIdx;
          ps.targetX = nextPil.x;
          ps.targetY = nextPil.y;
          ps.isHopping = true;
          this.audio.playBounce();

          // Snatched fire ruby
          if (nextPil.hasRuby) {
            nextPil.hasRuby = false;
            ps.score += 35;
            this.audio.playScore();
            this.particles.showFloatingText('+35 RUBY!', nextPil.x, nextPil.y - 18, '#F43F5E', 22);
            this.particles.spawnConfetti(nextPil.x, nextPil.y, 10);
          } else {
            ps.score += 5;
          }
        }
      }

      // Smooth hop interpolation
      ps.x += (ps.targetX - ps.x) * Math.min(1, dt * 14);
      ps.y += (ps.targetY - ps.y) * Math.min(1, dt * 14);
      if (Math.hypot(ps.targetX - ps.x, ps.targetY - ps.y) < 3) {
        ps.x = ps.targetX;
        ps.y = ps.targetY;
        ps.isHopping = false;
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Churning Molten Lava Caldera Lake
    const cx = width / 2;
    const cy = height * 0.52;
    const lavaGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, width * 0.65);
    lavaGrad.addColorStop(0, '#F97316');
    lavaGrad.addColorStop(0.5, '#DC2626');
    lavaGrad.addColorStop(1, '#7F1D1D');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, 0, width, height);

    // Churning magma current swirl lines
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
    ctx.lineWidth = 3;
    for (let r = 80; r < width * 0.5; r += 70) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Draw Basalt Stepping Pillars
    for (const pil of this.pillars) {
      ctx.save();
      ctx.translate(pil.x, pil.y);

      if (pil.isSubmerged) {
        // Red boiling lava puddle over sunk stone
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, pil.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Shaking offset if rumbling
        const shakeX = pil.rumbleTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
        const shakeY = pil.rumbleTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
        ctx.translate(shakeX, shakeY);

        // Dark Hexagonal Basalt Column
        ctx.fillStyle = '#1C1917';
        ctx.beginPath();
        ctx.arc(0, 0, pil.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pil.rumbleTimer > 0 ? '#EF4444' : '#57534E';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Cracks glowing with heat
        ctx.strokeStyle = pil.rumbleTimer > 0 ? '#F59E0B' : '#78350F';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-pil.radius * 0.5, -4);
        ctx.lineTo(pil.radius * 0.4, 6);
        ctx.stroke();

        // Fire Ruby Gem
        if (pil.hasRuby) {
          ctx.fillStyle = '#F43F5E';
          ctx.shadowColor = '#F43F5E';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.restore();
    }

    // 3. Draw Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Player circle body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Safari explorer goggles
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-6, -4, 12, 4);
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
    if (!ps || ps.isHopping) return;

    const curPillar = this.pillars[ps.currentPillar];
    const isDangerous = curPillar && (curPillar.rumbleTimer > 0 || curPillar.isSubmerged);

    // If standing on rumbling pillar, MUST hop immediately to safe pillar
    if (isDangerous) {
      const safePillars = this.pillars.filter((p) => !p.isSubmerged && p.rumbleTimer <= 0);
      if (safePillars.length > 0) {
        const target = safePillars[0];
        const dx = target.x - ps.x;
        const dy = target.y - ps.y;
        this.input.setBotInput(botId, true, dx, -dy, true);
        return;
      }
    }

    // Check if another pillar has a ruby
    const rubyPillar = this.pillars.find((p) => p.hasRuby && !p.isSubmerged && p.rumbleTimer <= 0);
    if (rubyPillar && Math.random() < (difficulty === 'bot_hard' ? 0.85 : 0.5)) {
      const dx = rubyPillar.x - ps.x;
      const dy = rubyPillar.y - ps.y;
      this.input.setBotInput(botId, true, dx, -dy, true);
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
      mvpHighlight: winnerId ? `${winnerId} survived the volcanic caldera lava surges!` : 'Tied volcanic leaps!'
    };
  }
}
