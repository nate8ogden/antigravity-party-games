import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SurfaceHazard {
  id: number;
  x: number;
  type: 'crater' | 'xenocrystal';
  collected: boolean;
}

interface RoverPilot {
  id: PlayerId;
  laneY: number;
  roverX: number;
  yOffset: number;
  vy: number;
  isJumping: boolean;
  score: number;
  combo: number;
  stumbleTimer: number;
  hazards: SurfaceHazard[];
  nextHazardDist: number;
  wheelSpin: number;
}

export class PlanetaryRoverGame extends BaseGame {
  public rovers: Map<PlayerId, RoverPilot> = new Map();
  public currentMapName: string = 'Mars Olympus Fossae';
  private hazardIdCounter: number = 0;
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
    this.rovers.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.6;
      this.rovers.set(p.id, {
        id: p.id,
        laneY,
        roverX: width * 0.28,
        yOffset: 0,
        vy: 0,
        isJumping: false,
        score: 0,
        combo: 0,
        stumbleTimer: 0,
        hazards: [],
        nextHazardDist: 160,
        wheelSpin: 0,
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    const terrainScroll = 190;

    this.rovers.forEach((r) => {
      const p = this.getPlayer(r.id);

      if (r.stumbleTimer > 0) r.stumbleTimer -= dt;
      r.wheelSpin += dt * 14;

      // Human input
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(r.id) || this.input.justAction(r.id);
        if (justPressed && !r.isJumping && r.stumbleTimer <= 0) {
          this.executeHop(r);
        }
      }

      // Low-gravity jumping physics
      if (r.isJumping) {
        r.yOffset += r.vy * dt;
        r.vy += 480 * dt; // Martian low gravity
        if (r.yOffset >= 0) {
          r.yOffset = 0;
          r.vy = 0;
          r.isJumping = false;
          // Smooth landing
          this.audio.playTone(280, 0.06, 'triangle');
        }
      }

      // Spawning Hazards / Crystals
      r.nextHazardDist -= terrainScroll * dt;
      if (r.nextHazardDist <= 0) {
        const isCrystal = Math.random() < 0.45;
        r.hazards.push({
          id: ++this.hazardIdCounter,
          x: width + 40,
          type: isCrystal ? 'xenocrystal' : 'crater',
          collected: false,
        });
        r.nextHazardDist = 150 + Math.random() * 120;
      }

      // Update Hazards
      for (let i = r.hazards.length - 1; i >= 0; i--) {
        const h = r.hazards[i];
        h.x -= terrainScroll * dt;

        // Collision with Rover
        const dx = Math.abs(h.x - r.roverX);
        if (dx < 28 && !h.collected) {
          if (h.type === 'crater') {
            if (r.yOffset > -20) {
              // FELL INTO CRATER!
              h.collected = true;
              r.stumbleTimer = 0.8;
              r.combo = 0;
              r.score = Math.max(0, r.score - 20);
              this.audio.playTone(130, 0.25, 'sawtooth');
              this.particles.emit(r.roverX, r.laneY, 16, '#c0392b');
            } else {
              // Successfully vaulted crater!
              h.collected = true;
              r.score += 15 + r.combo * 2;
              r.combo++;
              this.audio.playTone(520 + r.combo * 25, 0.1, 'sine');
            }
          } else if (h.type === 'xenocrystal') {
            // Snagged crystal in mid-air
            h.collected = true;
            r.score += 35 + r.combo * 3;
            r.combo++;
            this.audio.playTone(780, 0.15, 'triangle');
            this.particles.emit(h.x, r.laneY - 26, 12, '#00e676');
          }
        }

        if (h.x < -60) {
          r.hazards.splice(i, 1);
        }
      }
    });
  }

  private executeHop(r: RoverPilot): void {
    r.isJumping = true;
    r.vy = -310;
    this.audio.playTone(380, 0.08, 'sine');
    this.particles.emit(r.roverX - 10, r.laneY + 6, 8, '#e67e22');
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const r = this.rovers.get(botId);
    if (!r || r.isJumping || r.stumbleTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const lookahead = difficulty === 'bot_hard' ? 85 : difficulty === 'bot_normal' ? 68 : 50;
      const upcoming = r.hazards.find((h) => !h.collected && h.x > r.roverX && h.x < r.roverX + lookahead);
      if (upcoming && upcoming.type === 'crater') {
        this.executeHop(r);
        bTimer = difficulty === 'bot_hard' ? 0.35 : 0.55;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Red Martian landscape background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1c0f0d');
    bgGrad.addColorStop(0.5, '#3e1e18');
    bgGrad.addColorStop(1, '#150a08');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    this.rovers.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#e67e22';

      // Red Martian dirt track
      ctx.fillStyle = '#5c2c21';
      ctx.fillRect(0, r.laneY + 10, width, 6);
      ctx.fillStyle = '#7b3a2c';
      ctx.fillRect(0, r.laneY + 16, width, laneHeight - 20);

      // Track separator
      ctx.strokeStyle = '#2d140e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, r.laneY - laneHeight * 0.45);
      ctx.lineTo(width, r.laneY - laneHeight * 0.45);
      ctx.stroke();

      // Surface Hazards
      r.hazards.forEach((h) => {
        if (h.collected && h.type !== 'crater') return;
        if (h.type === 'crater') {
          // Dark impact crater pit
          ctx.fillStyle = '#2d140e';
          ctx.beginPath();
          ctx.ellipse(h.x, r.laneY + 12, 18, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Glowing green Xenocrystal
          ctx.fillStyle = '#00e676';
          ctx.beginPath();
          ctx.moveTo(h.x, r.laneY - 32);
          ctx.lineTo(h.x + 8, r.laneY - 20);
          ctx.lineTo(h.x, r.laneY - 8);
          ctx.lineTo(h.x - 8, r.laneY - 20);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // Planetary Rover
      const rx = r.roverX;
      const ry = r.laneY + r.yOffset;

      ctx.save();
      ctx.translate(rx, ry);

      if (r.stumbleTimer > 0) {
        ctx.rotate(0.2);
      }

      // Rover chassis
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-16, -18, 32, 18, 4);
      ctx.fill();

      // Antenna mast
      ctx.strokeStyle = '#bdc3c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -18);
      ctx.lineTo(-14, -28);
      ctx.stroke();
      // Dish
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(-15, -29, 4, 0, Math.PI * 2);
      ctx.fill();

      // 6 Rover Wheels (front, mid, rear)
      ctx.fillStyle = '#2c3e50';
      const wheelOffsets = [-12, 0, 12];
      wheelOffsets.forEach((ox) => {
        ctx.beginPath();
        ctx.arc(ox, 4, 6, 0, Math.PI * 2);
        ctx.fill();
        // Spoke animation
        ctx.strokeStyle = '#bdc3c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ox, 4);
        ctx.lineTo(ox + Math.cos(r.wheelSpin) * 5, 4 + Math.sin(r.wheelSpin) * 5);
        ctx.stroke();
      });

      ctx.restore();

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name ?? pId}: ${r.score} pts`, 16, r.laneY - laneHeight * 0.2);
      if (r.combo > 1) {
        ctx.fillStyle = '#00e676';
        ctx.fillText(`${r.combo}x COMBO`, 130, r.laneY - laneHeight * 0.2);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#e67e22';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚜 TAP TO HOP LOW-GRAVITY CRATERS • SNAG XENOCRYSTALS!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.rovers.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.rovers.entries())
      .map(([playerId, r]) => ({ playerId, score: r.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} mastered the Martian crater terrain!` : 'Rover suspension shattered in craters!',
    };
  }
}
