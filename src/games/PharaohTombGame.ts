import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Trap {
  id: number;
  x: number;
  type: 'spikes' | 'scarab' | 'gold_idol';
  collected: boolean;
}

interface RunnerState {
  id: PlayerId;
  laneY: number;
  playerX: number;
  boulderX: number;
  yOffset: number;
  vy: number;
  isJumping: boolean;
  score: number;
  distance: number;
  traps: Trap[];
  nextTrapDist: number;
  stumbleTimer: number;
  crushTimer: number;
  combo: number;
  animFrame: number;
}

export class PharaohTombGame extends BaseGame {
  public runners: Map<PlayerId, RunnerState> = new Map();
  public currentMapName: string = 'Tomb of the Sun God';
  private trapIdCounter: number = 0;
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
    this.runners.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, index) => {
      const laneY = 70 + index * laneHeight + laneHeight * 0.55;
      this.runners.set(p.id, {
        id: p.id,
        laneY,
        playerX: width * 0.42,
        boulderX: width * 0.1,
        yOffset: 0,
        vy: 0,
        isJumping: false,
        score: 0,
        distance: 0,
        traps: [],
        nextTrapDist: 180,
        stumbleTimer: 0,
        crushTimer: 0,
        combo: 0,
        animFrame: 0,
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

    const scrollSpeed = 220;

    this.runners.forEach((r) => {
      if (r.stumbleTimer > 0) r.stumbleTimer -= dt;
      if (r.crushTimer > 0) {
        r.crushTimer -= dt;
        return;
      }

      r.distance += scrollSpeed * dt;
      r.animFrame += dt * 10;

      // Human input
      const p = this.getPlayer(r.id);
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(r.id) || this.input.justAction(r.id);
        if (justPressed && !r.isJumping && r.stumbleTimer <= 0) {
          this.executeJump(r);
        }
      }

      // Physics for jumping
      if (r.isJumping) {
        r.yOffset += r.vy * dt;
        r.vy += 950 * dt;
        if (r.yOffset >= 0) {
          r.yOffset = 0;
          r.vy = 0;
          r.isJumping = false;
        }
      }

      // Spawn Traps
      r.nextTrapDist -= scrollSpeed * dt;
      if (r.nextTrapDist <= 0) {
        const rand = Math.random();
        const type = rand < 0.65 ? 'spikes' : rand < 0.88 ? 'scarab' : 'gold_idol';
        r.traps.push({
          id: ++this.trapIdCounter,
          x: width + 40,
          type,
          collected: false,
        });
        r.nextTrapDist = 160 + Math.random() * 120;
      }

      // Update traps & collision
      for (let i = r.traps.length - 1; i >= 0; i--) {
        const trap = r.traps[i];
        trap.x -= scrollSpeed * dt;

        const dx = Math.abs(trap.x - r.playerX);
        if (dx < 26 && !trap.collected) {
          if (trap.type === 'spikes') {
            if (r.yOffset > -24) {
              trap.collected = true;
              r.stumbleTimer = 0.8;
              r.combo = 0;
              r.boulderX += 35;
              this.audio.playTone(140, 0.25, 'sawtooth');
              this.particles.emit(r.playerX, r.laneY, 14, '#e74c3c');
            } else {
              trap.collected = true;
              r.score += 15 + r.combo * 2;
              r.combo++;
              this.audio.playTone(420 + r.combo * 30, 0.1, 'sine');
            }
          } else if (trap.type === 'scarab' || trap.type === 'gold_idol') {
            trap.collected = true;
            const pts = trap.type === 'scarab' ? 25 : 50;
            r.score += pts;
            r.boulderX = Math.max(width * 0.08, r.boulderX - 20);
            this.audio.playTone(trap.type === 'scarab' ? 660 : 880, 0.15, 'triangle');
            this.particles.emit(trap.x, r.laneY - 20, 10, '#f1c40f');
          }
        }

        if (trap.x < -60) {
          r.traps.splice(i, 1);
        }
      }

      // Boulder chase
      const boulderRecovery = 15 * dt;
      r.boulderX = Math.max(width * 0.08, r.boulderX - boulderRecovery);

      if (r.boulderX >= r.playerX - 25 && r.crushTimer <= 0) {
        r.crushTimer = 1.0;
        r.score = Math.max(0, r.score - 40);
        r.combo = 0;
        r.boulderX = width * 0.12;
        this.audio.playTone(90, 0.4, 'square');
        this.particles.emit(r.playerX, r.laneY, 22, '#d35400');
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const r = this.runners.get(botId);
    if (!r || r.isJumping || r.stumbleTimer > 0) return;

    let reaction = this.botReactionTimers.get(botId) || 0;
    reaction -= dt;
    if (reaction <= 0) {
      const lookahead = difficulty === 'bot_hard' ? 90 : difficulty === 'bot_normal' ? 70 : 50;
      const upcomingTrap = r.traps.find(
        (t) => t.x > r.playerX && t.x < r.playerX + lookahead
      );
      if (upcomingTrap && upcomingTrap.type === 'spikes') {
        this.executeJump(r);
        reaction = difficulty === 'bot_hard' ? 0.35 : difficulty === 'bot_normal' ? 0.5 : 0.7;
      }
    }
    this.botReactionTimers.set(botId, reaction);
  }

  private executeJump(r: RunnerState): void {
    r.isJumping = true;
    r.vy = -380;
    this.audio.playTone(320, 0.1, 'sine');
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#2c1e13');
    bgGrad.addColorStop(0.5, '#3d2b1f');
    bgGrad.addColorStop(1, '#1b120c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(212, 175, 55, 0.08)';
    for (let x = 30; x < width; x += 110) {
      for (let y = 60; y < height - 30; y += 75) {
        ctx.fillRect(x, y, 22, 14);
        ctx.fillRect(x + 7, y + 18, 8, 18);
      }
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    this.runners.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#e67e22';

      ctx.fillStyle = '#4a3728';
      ctx.fillRect(0, r.laneY + 12, width, 6);
      ctx.fillStyle = '#654321';
      ctx.fillRect(0, r.laneY + 18, width, laneHeight - 20);

      ctx.strokeStyle = '#2b1b11';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, r.laneY - laneHeight * 0.45);
      ctx.lineTo(width, r.laneY - laneHeight * 0.45);
      ctx.stroke();

      r.traps.forEach((trap) => {
        if (trap.collected && trap.type !== 'spikes') return;

        if (trap.type === 'spikes') {
          ctx.fillStyle = '#bdc3c7';
          ctx.beginPath();
          ctx.moveTo(trap.x - 14, r.laneY + 12);
          ctx.lineTo(trap.x - 7, r.laneY - 14);
          ctx.lineTo(trap.x, r.laneY + 12);
          ctx.lineTo(trap.x + 7, r.laneY - 14);
          ctx.lineTo(trap.x + 14, r.laneY + 12);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#7f8c8d';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (trap.type === 'scarab') {
          ctx.fillStyle = '#1abc9c';
          ctx.beginPath();
          ctx.ellipse(trap.x, r.laneY - 18, 10, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(trap.x - 2, r.laneY - 24, 4, 12);
        } else if (trap.type === 'gold_idol') {
          ctx.fillStyle = '#f39c12';
          ctx.beginPath();
          ctx.arc(trap.x, r.laneY - 20, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2980b9';
          ctx.fillRect(trap.x - 7, r.laneY - 22, 14, 4);
        }
      });

      const boulderRadius = 26;
      const bY = r.laneY - boulderRadius + 10;
      ctx.save();
      ctx.translate(r.boulderX, bY);
      ctx.rotate((r.distance / 25) % (Math.PI * 2));
      ctx.fillStyle = '#5d6d7e';
      ctx.beginPath();
      ctx.arc(0, 0, boulderRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = '#34495e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-8, -6, 5, 0, Math.PI * 2);
      ctx.arc(8, -6, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const px = r.playerX;
      const py = r.laneY + r.yOffset;
      const legOffset = Math.sin(r.animFrame) * 8;

      ctx.save();
      if (r.stumbleTimer > 0) {
        ctx.translate(px, py);
        ctx.rotate(0.35);
        ctx.translate(-px, -py);
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(px - 10, py - 26, 20, 24, 4);
      ctx.fill();

      ctx.fillStyle = '#f5cba7';
      ctx.beginPath();
      ctx.ellipse(px, py - 30, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py - 32, 8, Math.PI, 0);
      ctx.fill();

      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px - 5, py - 2);
      ctx.lineTo(px - 5 - legOffset, py + 12);
      ctx.moveTo(px + 5, py - 2);
      ctx.lineTo(px + 5 + legOffset, py + 12);
      ctx.stroke();

      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name ?? pId}: ${r.score} pts`, 16, r.laneY - laneHeight * 0.22);
      if (r.combo > 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(`${r.combo}x STREAK!`, 130, r.laneY - laneHeight * 0.22);
      }
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 140, 56, 280, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏃 TAP TO JUMP SPIKES & OUTRUN BOULDER!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.runners.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.runners.entries())
      .map(([playerId, r]) => ({ playerId, score: r.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} outran the Pharaoh's wrath!` : 'Nobody escaped the tomb!',
    };
  }
}
