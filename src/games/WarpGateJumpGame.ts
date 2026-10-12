import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface WarpGate {
  id: number;
  z: number; // 300 (far) to 0 (at ship)
  apertureAngle: number; // angle of the opening
  rotationSpeed: number;
  cleared: boolean;
}

interface StarshipPilot {
  id: PlayerId;
  laneX: number;
  shipY: number;
  pointerAngle: number; // ship orientation
  score: number;
  combo: number;
  warpSpeed: number;
  staggerTimer: number;
  warpFlash: number;
  gates: WarpGate[];
}

export class WarpGateJumpGame extends BaseGame {
  public pilots: Map<PlayerId, StarshipPilot> = new Map();
  public currentMapName: string = 'Hyperspace Conduit Beta';
  private gateIdCounter: number = 0;
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
    this.pilots.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      const initialGates: WarpGate[] = [
        { id: ++this.gateIdCounter, z: 280, apertureAngle: Math.random() * Math.PI * 2, rotationSpeed: 1.8, cleared: false },
        { id: ++this.gateIdCounter, z: 520, apertureAngle: Math.random() * Math.PI * 2, rotationSpeed: 2.2, cleared: false },
      ];
      this.pilots.set(p.id, {
        id: p.id,
        laneX: cx,
        shipY: height * 0.72,
        pointerAngle: 0,
        score: 0,
        combo: 0,
        warpSpeed: 160,
        staggerTimer: 0,
        warpFlash: 0,
        gates: initialGates,
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

    this.pilots.forEach((pl) => {
      const p = this.getPlayer(pl.id);

      if (pl.staggerTimer > 0) pl.staggerTimer -= dt;
      if (pl.warpFlash > 0) pl.warpFlash = Math.max(0, pl.warpFlash - dt * 2.5);

      // Rotate ship alignment needle constantly
      pl.pointerAngle = (pl.pointerAngle + dt * 2.8) % (Math.PI * 2);

      // Human input
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(pl.id) || this.input.justAction(pl.id);
        if (justPressed && pl.staggerTimer <= 0) {
          this.executeWarpJump(pl);
        }
      }

      // Update approaching gates
      for (let i = pl.gates.length - 1; i >= 0; i--) {
        const g = pl.gates[i];
        g.z -= pl.warpSpeed * dt;
        g.apertureAngle = (g.apertureAngle + g.rotationSpeed * dt) % (Math.PI * 2);

        // Gate reached ship threshold (z <= 15)
        if (g.z <= 15) {
          if (!g.cleared) {
            // Gate passed without jumping alignment: penalty
            pl.staggerTimer = 0.6;
            pl.combo = 0;
            pl.score = Math.max(0, pl.score - 15);
            this.audio.playTone(130, 0.2, 'sawtooth');
            this.particles.emit(pl.laneX, pl.shipY, 14, '#e74c3c');
          }
          pl.gates.splice(i, 1);
        }
      }

      // Spawn next gate
      const furthestZ = pl.gates.reduce((max, g) => Math.max(max, g.z), 0);
      if (furthestZ < 400) {
        pl.gates.push({
          id: ++this.gateIdCounter,
          z: furthestZ + 220 + Math.random() * 60,
          apertureAngle: Math.random() * Math.PI * 2,
          rotationSpeed: 1.8 + Math.random() * 1.5,
          cleared: false,
        });
      }
    });
  }

  private executeWarpJump(pl: StarshipPilot): void {
    const nearestGate = pl.gates.find((g) => !g.cleared && g.z < 90 && g.z > 20);
    if (!nearestGate) {
      // Whiffed jump too early/late
      pl.staggerTimer = 0.4;
      this.audio.playTone(180, 0.1, 'square');
      return;
    }

    // Check angle alignment between ship pointer and gate aperture
    let angleDiff = Math.abs(pl.pointerAngle - nearestGate.apertureAngle);
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

    if (angleDiff < 0.65) {
      // LIGHTSPEED WARP!
      nearestGate.cleared = true;
      pl.warpFlash = 1.0;
      const pts = 35 + pl.combo * 5;
      pl.score += pts;
      pl.combo++;
      pl.warpSpeed = Math.min(320, pl.warpSpeed + 25);
      this.audio.playTone(880 + pl.combo * 40, 0.15, 'sine');
      this.particles.emit(pl.laneX, pl.shipY - 20, 20, '#00e5ff');
    } else {
      // Clipped gate edge
      nearestGate.cleared = true;
      pl.staggerTimer = 0.6;
      pl.combo = 0;
      pl.score = Math.max(0, pl.score - 10);
      pl.warpSpeed = Math.max(140, pl.warpSpeed - 30);
      this.audio.playTone(150, 0.25, 'sawtooth');
      this.particles.emit(pl.laneX, pl.shipY, 12, '#e67e22');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const pl = this.pilots.get(botId);
    if (!pl || pl.staggerTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const targetGate = pl.gates.find((g) => !g.cleared && g.z < 85 && g.z > 25);
      if (targetGate) {
        let diff = Math.abs(pl.pointerAngle - targetGate.apertureAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;

        const tolerance = difficulty === 'bot_hard' ? 0.60 : difficulty === 'bot_normal' ? 0.50 : 0.40;
        if (diff < tolerance) {
          this.executeWarpJump(pl);
          bTimer = 0.5;
        }
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Hyperspace neon conduit background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#05030a');
    bgGrad.addColorStop(0.5, '#130924');
    bgGrad.addColorStop(1, '#080410');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Hyperspace star streaks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 20; i++) {
      const sx = ((Date.now() * 0.1 + i * 40) % width);
      const sy = ((Date.now() * 0.4 + i * 60) % height);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + 30);
      ctx.stroke();
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.pilots.forEach((pl, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#9b59b6';

      // Lane boundary
      ctx.strokeStyle = 'rgba(155, 89, 182, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(pl.laneX - colWidth * 0.5 + 4, 60, colWidth - 8, height - 70);

      // Draw Approaching Warp Gates (perspective projection)
      pl.gates.forEach((g) => {
        if (g.cleared) return;
        const scale = 1 - g.z / 320; // 0 to 1 as it nears
        if (scale <= 0) return;

        const gateRadius = 20 + scale * 45;
        const gateY = pl.shipY - 140 + scale * 120;

        ctx.save();
        ctx.translate(pl.laneX, gateY);

        // Gate Ring
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3 + scale * 3;
        ctx.beginPath();
        ctx.arc(0, 0, gateRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Gate Opening Aperture (Green Glow sector)
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 6 + scale * 4;
        ctx.beginPath();
        ctx.arc(0, 0, gateRadius, g.apertureAngle - 0.4, g.apertureAngle + 0.4);
        ctx.stroke();

        ctx.restore();
      });

      // Starship
      ctx.save();
      ctx.translate(pl.laneX, pl.shipY);

      if (pl.staggerTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, 0);
      }

      // Ship body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(16, 16);
      ctx.lineTo(0, 8);
      ctx.lineTo(-16, 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Warp Alignment Reticle / Pointer
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(pl.pointerAngle) * 32, Math.sin(pl.pointerAngle) * 32);
      ctx.stroke();

      // Cockpit Glow
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(0, -6, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Score / Speed HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${pl.score}`, pl.laneX, height * 0.88);
      if (pl.combo > 1) {
        ctx.fillStyle = '#00e676';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${pl.combo}x HYPER-JUMP`, pl.laneX, height * 0.92);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚀 TAP WHEN NEEDLE ALIGNS WITH GREEN GATE SLOT!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.pilots.forEach((pl, pId) => scores.set(pId, pl.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.pilots.entries())
      .map(([playerId, pl]) => ({ playerId, score: pl.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} achieved lightspeed hyperdrive jumps!` : 'Sub-light engine stalled!',
    };
  }
}
