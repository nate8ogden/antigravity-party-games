import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface TrappedInsect {
  spoke: number;
  ring: number;
  points: number;
  wrapped: boolean;
}

interface WebSpider {
  id: PlayerId;
  spoke: number; // 0 to 7
  ring: number; // 0 (center hub) to 4 (outer perimeter)
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  score: number;
}

export class SpiderWebTangleGame extends BaseGame {
  private insects: TrappedInsect[] = [];
  private playersState: Map<PlayerId, WebSpider> = new Map();
  private spawnFlyTimer: number = 0;

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
    this.insects = [];
    this.spawnFlyTimer = 1.0;
    this.playersState.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const cx = width / 2;
    const cy = height * 0.52;

    active.forEach((p, idx) => {
      const spoke = (idx * 2) % 8;
      const ring = 2;
      const pos = this.getWebCoords(spoke, ring, width, height);

      this.playersState.set(p.id, {
        id: p.id,
        spoke,
        ring,
        x: pos.x,
        y: pos.y,
        targetX: pos.x,
        targetY: pos.y,
        score: 0
      });
    });

    this.spawnFlies();
  }

  private getWebCoords(spoke: number, ring: number, width: number, height: number): { x: number; y: number } {
    const cx = width / 2;
    const cy = height * 0.52;
    const maxR = Math.min(width, height) * 0.42;
    const r = (ring / 4) * maxR;
    const a = (spoke / 8) * Math.PI * 2;
    return {
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r
    };
  }

  private spawnFlies(): void {
    for (let i = 0; i < 6; i++) {
      this.insects.push({
        spoke: Math.floor(Math.random() * 8),
        ring: 1 + Math.floor(Math.random() * 4),
        points: 25,
        wrapped: false
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    this.spawnFlyTimer -= dt;
    if (this.spawnFlyTimer <= 0 && this.insects.filter((i) => !i.wrapped).length < 5) {
      this.spawnFlyTimer = 2.5;
      this.insects.push({
        spoke: Math.floor(Math.random() * 8),
        ring: 1 + Math.floor(Math.random() * 4),
        points: 25,
        wrapped: false
      });
    }

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const tap = this.input.justPressed(p.id);
      if (tap) {
        const steerX = this.input.getSteer(p.id);
        const steerY = this.input.getThrottle(p.id);

        if (Math.abs(steerY) > 0.4) {
          // Move in/out on radial rings
          if (steerY < 0) {
            ps.ring = Math.min(4, ps.ring + 1); // Outward
          } else {
            ps.ring = Math.max(0, ps.ring - 1); // Inward to hub
          }
        } else if (Math.abs(steerX) > 0.4) {
          // Traverse clockwise / counterclockwise across spokes
          ps.spoke = (ps.spoke + (steerX > 0 ? 1 : 7)) % 8;
        } else {
          // Default advance clockwise
          ps.spoke = (ps.spoke + 1) % 8;
        }

        const nextPos = this.getWebCoords(ps.spoke, ps.ring, width, height);
        ps.targetX = nextPos.x;
        ps.targetY = nextPos.y;
        this.audio.playBounce();
      }

      // Smooth crawl interpolation
      ps.x += (ps.targetX - ps.x) * Math.min(1, dt * 14);
      ps.y += (ps.targetY - ps.y) * Math.min(1, dt * 14);

      // Check wrapping trapped insects
      for (const ins of this.insects) {
        if (!ins.wrapped && ins.spoke === ps.spoke && ins.ring === ps.ring) {
          ins.wrapped = true;
          ps.score += ins.points;
          this.audio.playScore();
          const pos = this.getWebCoords(ins.spoke, ins.ring, width, height);
          this.particles.showFloatingText(`+${ins.points} SILK WRAP!`, pos.x, pos.y - 18, '#FBBF24', 20);
          this.particles.spawnConfetti(pos.x, pos.y, 8);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Garden Trellis Morning Dew Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.6, '#064E3B');
    bgGrad.addColorStop(1, '#022C22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height * 0.52;
    const maxR = Math.min(width, height) * 0.42;

    // 2. Draw Spiderweb Strands
    // Radial spokes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
      ctx.stroke();
    }

    // Concentric spiral rings
    for (let r = 1; r <= 4; r++) {
      const ringRadius = (r / 4) * maxR;
      ctx.beginPath();
      for (let s = 0; s <= 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        const px = cx + Math.cos(a) * ringRadius;
        const py = cy + Math.sin(a) * ringRadius;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // 3. Draw Trapped Insects
    for (const ins of this.insects) {
      if (ins.wrapped) continue;
      const pos = this.getWebCoords(ins.spoke, ins.ring, width, height);
      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Flapping wings
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.ellipse(-4, -4, 5, 2.5, -0.3, 0, Math.PI * 2);
      ctx.ellipse(4, -4, 5, 2.5, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Little Fly Body
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Spiders
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Spider legs (4 pairs)
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i += 0.6) {
        ctx.beginPath();
        ctx.moveTo(0, i * 6);
        ctx.lineTo(-14, i * 10 - 2);
        ctx.moveTo(0, i * 6);
        ctx.lineTo(14, i * 10 - 2);
        ctx.stroke();
      }

      // Cephalothorax & Abdomen
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 4, 8, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Spider Eyes (multiple dots)
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(-2, -7, 1.5, 0, Math.PI * 2);
      ctx.arc(2, -7, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 20);
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

    // Find nearest unwrapped insect
    let targetFly: TrappedInsect | null = null;
    let minDist = 999;
    for (const ins of this.insects) {
      if (!ins.wrapped) {
        const spokeDiff = Math.abs(ins.spoke - ps.spoke);
        const ringDiff = Math.abs(ins.ring - ps.ring);
        const dist = spokeDiff + ringDiff;
        if (dist < minDist) {
          minDist = dist;
          targetFly = ins;
        }
      }
    }

    if (targetFly) {
      let steerX = 0;
      let steerY = 0;
      if (targetFly.ring !== ps.ring) {
        steerY = targetFly.ring > ps.ring ? -1 : 1;
      } else if (targetFly.spoke !== ps.spoke) {
        steerX = targetFly.spoke > ps.spoke ? 1 : -1;
      }

      const chance = difficulty === 'bot_hard' ? 0.9 : difficulty === 'bot_normal' ? 0.7 : 0.45;
      if (Math.random() < chance) {
        this.input.setBotInput(botId, true, steerX, steerY, true);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
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
      mvpHighlight: winnerId ? `${winnerId} trapped the most insects on the dewy spiderweb!` : 'Tied spiderweb tangle!'
    };
  }
}
