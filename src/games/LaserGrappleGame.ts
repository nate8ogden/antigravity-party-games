import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface GrappleAnchor {
  x: number;
  y: number;
}

interface GrappleSwinger {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isAttached: boolean;
  anchor: GrappleAnchor | null;
  tetherLength: number;
  angle: number;
  angularVel: number;
  score: number;
  combo: number;
  distance: number;
}

export class LaserGrappleGame extends BaseGame {
  public swingers: Map<PlayerId, GrappleSwinger> = new Map();
  public anchors: GrappleAnchor[] = [];
  public currentMapName: string = 'Cyber-Skyline Neon Grapple Spire';
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

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.swingers.clear();
    this.anchors = [];
    this.botReactionTimers.clear();

    // Create anchor spires across the sky
    for (let i = 0; i < 15; i++) {
      this.anchors.push({
        x: 100 + i * 160,
        y: 110 + (i % 2) * 50
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const initialAnchor = this.anchors[0];
      this.swingers.set(p.id, {
        id: p.id,
        x: initialAnchor.x - 40,
        y: initialAnchor.y + 70 + idx * 15,
        vx: 120,
        vy: 0,
        isAttached: true,
        anchor: initialAnchor,
        tetherLength: 75,
        angle: -Math.PI * 0.4,
        angularVel: 2.2,
        score: 0,
        combo: 0,
        distance: 0
      });

      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.3);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, width, height);

    const gravity = 320;

    this.swingers.forEach(s => {
      const isHolding = this.input.isPressed(s.id);

      if (isHolding) {
        if (!s.isAttached) {
          // Find closest anchor in front
          let bestAnchor: GrappleAnchor | null = null;
          let minDist = 220;
          this.anchors.forEach(a => {
            const d = Math.hypot(a.x - s.x, a.y - s.y);
            if (d < minDist && a.x >= s.x - 20) {
              minDist = d;
              bestAnchor = a;
            }
          });

          if (bestAnchor) {
            s.isAttached = true;
            s.anchor = bestAnchor;
            s.tetherLength = Math.hypot((bestAnchor as GrappleAnchor).x - s.x, (bestAnchor as GrappleAnchor).y - s.y);
            s.angle = Math.atan2(s.y - (bestAnchor as GrappleAnchor).y, s.x - (bestAnchor as GrappleAnchor).x);
            // Convert linear velocity to angular velocity
            const tangentSpeed = s.vx * Math.sin(s.angle) - s.vy * Math.cos(s.angle);
            s.angularVel = tangentSpeed / s.tetherLength;
            this.audio.playTone(620, 0.08, 'triangle');
            this.particles.emit((bestAnchor as GrappleAnchor).x, (bestAnchor as GrappleAnchor).y, 8, '#00ffff');
          }
        }
      } else {
        if (s.isAttached) {
          // Release grapple! Fling forward!
          s.isAttached = false;
          s.vx = -s.angularVel * s.tetherLength * Math.sin(s.angle) + 40;
          s.vy = s.angularVel * s.tetherLength * Math.cos(s.angle);
          s.combo++;
          s.score += 20 * s.combo;
          this.audio.playTone(780, 0.1, 'sine');
          s.anchor = null;
        }
      }

      if (s.isAttached && s.anchor) {
        // Pendulum physics
        const angularAccel = -(gravity / s.tetherLength) * Math.sin(s.angle - Math.PI * 0.5);
        s.angularVel += angularAccel * dt;
        s.angularVel *= 0.995;
        s.angle += s.angularVel * dt;

        s.x = s.anchor.x + Math.cos(s.angle) * s.tetherLength;
        s.y = s.anchor.y + Math.sin(s.angle) * s.tetherLength;
        s.distance = Math.max(s.distance, s.x);
      } else {
        // Freefall physics
        s.vy += gravity * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.distance = Math.max(s.distance, s.x);

        // Respawn if fell too far
        if (s.y > height - 40) {
          s.y = height * 0.5;
          s.vy = -120;
          s.vx = 80;
          s.combo = 0;
          this.audio.playTone(130, 0.2, 'sawtooth');
          this.particles.emit(s.x, height - 40, 15, '#ff0055');
        }
      }

      // Loop anchors when travelling far right
      if (s.x > width * 0.7) {
        // shift everyone back smoothly or score distance
      }

      s.score = Math.max(s.score, Math.round(s.distance));
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const s = this.swingers.get(botId);
    if (!s) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    if (s.isAttached) {
      // Release at forward apex of swing (angle between 0.1 and 0.5 rad)
      const releaseAngle = difficulty === 'bot_hard' ? 0.35 : 0.45;
      if (s.angle > releaseAngle && s.angularVel > 0.8) {
        this.input.setBotState(botId, false); // release
        this.botReactionTimers.set(botId, 0.3);
        return;
      }
    } else {
      // Free falling, attach to next anchor when approaching
      let nearestDist = 999;
      this.anchors.forEach(a => {
        const d = Math.hypot(a.x - s.x, a.y - s.y);
        if (d < nearestDist && a.x > s.x - 20) nearestDist = d;
      });

      if (nearestDist < 190) {
        this.input.setBotState(botId, true); // hold to latch
        this.botReactionTimers.set(botId, 0.35);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.08);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Cyberpunk Dusk Skyline Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0d0918');
    grad.addColorStop(0.5, '#1b122c');
    grad.addColorStop(1, '#0e0b17');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLD: GRAPPLE LASER TETHER | RELEASE: SOAR AT APEX!', width * 0.5, 69);
    ctx.restore();

    // Render Anchors
    this.anchors.forEach(a => {
      ctx.fillStyle = '#222638';
      ctx.beginPath();
      ctx.arc(a.x, a.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Render Swingers
    this.swingers.forEach(s => {
      const cfg = this.players.find(p => p.id === s.id);

      // Laser Tether Beam
      if (s.isAttached && s.anchor) {
        ctx.strokeStyle = cfg?.color || '#00e5ff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = cfg?.color || '#00e5ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(s.anchor.x, s.anchor.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.save();
      ctx.translate(s.x, s.y);

      // Cyber Runner Figure
      ctx.fillStyle = cfg?.color || '#ff007f';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      // Neon trail
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(-s.vx * 0.04, -s.vy * 0.04, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Label & Score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name || 'Player'}: ${s.score}m`, s.x, s.y - 18);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.swingers.forEach((s, pId) => scores.set(pId, s.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.swingers.entries())
      .map(([playerId, s]) => ({ playerId, score: s.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} swung across the skyline with cyber precision!` : 'Grapple ropes severed!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
