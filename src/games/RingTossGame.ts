import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Bottle {
  x: number;
  y: number;
  points: number;
  isGold: boolean;
  ringsCount: number;
}

interface FlyingRing {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  progress: number;
  speed: number;
  playerId: PlayerId;
  ringColor: string;
}

interface PlayerTossState {
  aimAngle: number;
  aimDir: number;
  score: number;
  tossCooldown: number;
  ringsThrown: number;
}

export class RingTossGame extends BaseGame {
  private bottles: Bottle[] = [];
  private playerStates: Map<PlayerId, PlayerTossState> = new Map();
  private activeRings: FlyingRing[] = [];

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.playerStates.clear();
    this.activeRings = [];
    this.bottles = [];
    this.roundTimer = 25.0;
    this.isFinished = false;

    // 3x3 Bottle Stand in Upper Center
    const cx = width / 2;
    const cy = height * 0.35;
    const colSpacing = 60;
    const rowSpacing = 45;

    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        const isCenter = r === 0 && c === 0;
        this.bottles.push({
          x: cx + c * colSpacing,
          y: cy + r * rowSpacing,
          points: isCenter ? 100 : (Math.abs(r) + Math.abs(c) === 1 ? 50 : 25),
          isGold: isCenter,
          ringsCount: 0
        });
      }
    }

    for (const p of this.getActivePlayers()) {
      this.playerStates.set(p.id, {
        aimAngle: (Math.random() - 0.5) * 0.8,
        aimDir: Math.random() < 0.5 ? 1 : -1,
        score: 0,
        tossCooldown: 0,
        ringsThrown: 0
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    const count = active.length;

    // Update Player Aim & Input
    active.forEach((p, idx) => {
      const state = this.playerStates.get(p.id);
      if (!state) return;

      // Oscillate aim angle
      state.aimAngle += state.aimDir * dt * 2.2;
      if (state.aimAngle > 0.75) {
        state.aimAngle = 0.75;
        state.aimDir = -1;
      } else if (state.aimAngle < -0.75) {
        state.aimAngle = -0.75;
        state.aimDir = 1;
      }

      if (state.tossCooldown > 0) {
        state.tossCooldown -= dt;
      }

      // Toss Ring
      if (this.input.justPressed(p.id) && state.tossCooldown <= 0) {
        state.tossCooldown = 0.35;
        state.ringsThrown++;
        this.audio.playWhoosh();

        const startX = (width / (count + 1)) * (idx + 1);
        const startY = height - 40;

        // Calculate target location based on aim angle and random throw power
        const targetDist = height * 0.55;
        const targetX = startX + Math.sin(state.aimAngle) * targetDist * 0.8;
        const targetY = startY - Math.cos(state.aimAngle) * targetDist;

        this.activeRings.push({
          x: startX,
          y: startY,
          startX,
          startY,
          targetX,
          targetY,
          progress: 0,
          speed: 2.2,
          playerId: p.id,
          ringColor: p.color
        });
      }
    });

    // Update Flying Rings
    for (let i = this.activeRings.length - 1; i >= 0; i--) {
      const ring = this.activeRings[i];
      ring.progress += ring.speed * dt;

      // Parabolic flight
      const p = Math.min(1, ring.progress);
      ring.x = ring.startX + (ring.targetX - ring.startX) * p;
      const linearY = ring.startY + (ring.targetY - ring.startY) * p;
      const arc = Math.sin(p * Math.PI) * 70;
      ring.y = linearY - arc;

      if (ring.progress >= 1) {
        // Landing check with bottles
        let hitBottle: Bottle | null = null;
        for (const b of this.bottles) {
          const d = Math.hypot(ring.targetX - b.x, ring.targetY - b.y);
          if (d < 28) {
            hitBottle = b;
            break;
          }
        }

        if (hitBottle) {
          hitBottle.ringsCount++;
          const state = this.playerStates.get(ring.playerId);
          if (state) {
            state.score += hitBottle.points;
          }
          this.audio.playTone(hitBottle.isGold ? 880 : 540, 0.12, 'triangle');
          this.particles.emit(hitBottle.x, hitBottle.y, hitBottle.isGold ? 20 : 10, ring.ringColor);
        } else {
          this.audio.playTone(180, 0.05, 'sine');
        }

        this.activeRings.splice(i, 1);
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const state = this.playerStates.get(botId);
    if (!state || state.tossCooldown > 0) {
      this.input.setBotInput(botId, false);
      return;
    }

    const active = this.getActivePlayers();
    const idx = active.findIndex(p => p.id === botId);
    const startX = (width / (active.length + 1)) * (idx + 1);
    const startY = height - 40;

    // Pick target bottle (Center gold bottle preferred by Hard bots)
    const targetBottle = difficulty === 'bot_hard'
      ? this.bottles.find(b => b.isGold) || this.bottles[0]
      : this.bottles[Math.floor(Math.random() * this.bottles.length)];

    const dx = targetBottle.x - startX;
    const dy = startY - targetBottle.y;
    const targetAngle = Math.atan2(dx, dy);

    const tolerance = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.18 : 0.35;
    if (Math.abs(state.aimAngle - targetAngle) < tolerance) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Striped Carnival Booth Backdrop
    ctx.fillStyle = '#7F1D1D';
    ctx.fillRect(0, 0, width, height);

    // Awning stripes
    const stripeW = 40;
    for (let sx = 0; sx < width; sx += stripeW * 2) {
      ctx.fillStyle = '#991B1B';
      ctx.fillRect(sx, 0, stripeW, height);
    }

    // Wooden Booth Table
    const tableY = height * 0.48;
    ctx.fillStyle = '#78350F';
    ctx.fillRect(width * 0.1, height * 0.22, width * 0.8, tableY - height * 0.18);
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 4;
    ctx.strokeRect(width * 0.1, height * 0.22, width * 0.8, tableY - height * 0.18);

    // Bottles
    for (const b of this.bottles) {
      // Bottle shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 16, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bottle body
      ctx.fillStyle = b.isGold ? '#F59E0B' : '#047857';
      ctx.beginPath();
      ctx.roundRect(b.x - 12, b.y - 10, 24, 28, 4);
      ctx.fill();
      // Bottle neck
      ctx.beginPath();
      ctx.roundRect(b.x - 5, b.y - 26, 10, 18, 2);
      ctx.fill();
      // Bottle rim
      ctx.fillStyle = b.isGold ? '#FCD34D' : '#34D399';
      ctx.fillRect(b.x - 7, b.y - 28, 14, 3);

      // Points label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.points}`, b.x, b.y + 8);

      // Rings stacked on bottle
      if (b.ringsCount > 0) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 3;
        for (let r = 0; r < Math.min(4, b.ringsCount); r++) {
          ctx.beginPath();
          ctx.ellipse(b.x, b.y + 12 - r * 5, 16, 6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Flying Rings
    for (const ring of this.activeRings) {
      const p = ring.progress;
      const scale = 1 - p * 0.35; // Perspective shrinking
      ctx.save();
      ctx.translate(ring.x, ring.y);
      ctx.scale(scale, scale * 0.5);
      ctx.strokeStyle = ring.ringColor;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Player Toss Stations at Bottom
    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const state = this.playerStates.get(p.id);
      if (!state) return;

      const px = (width / (count + 1)) * (idx + 1);
      const py = height - 40;

      // Aim Line / Trajectory
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      const aimLen = 100;
      ctx.lineTo(px + Math.sin(state.aimAngle) * aimLen, py - Math.cos(state.aimAngle) * aimLen);
      ctx.stroke();
      ctx.restore();

      // Player Ring Launcher
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Score Pill
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(px - 32, py - 60, 64, 22, 6);
      ctx.fill();
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#F8FAFC';
      ctx.textAlign = 'center';
      ctx.fillText(`${state.score} PTS`, px, py - 45);
    });

    // Timer & Carnival Header
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`RING TOSS • TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.playerStates.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} mastered carnival geometry!` : 'The glass bottles stood tall!'
    };
  }
}
