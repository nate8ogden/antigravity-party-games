import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ZiplineObstacle {
  x: number;
  line: number; // 0 = upper, 1 = lower
  type: 'spark' | 'data';
  hit: boolean;
}

interface AgentZipline {
  line: number; // 0 or 1
  y: number;
  stunTimer: number;
  score: number;
}

export class RooftopZiplineGame extends BaseGame {
  private agentLines: Map<PlayerId, AgentZipline> = new Map();
  private obstacles: ZiplineObstacle[] = [];
  private spawnTimer: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.agentLines.clear();
    this.obstacles = [];
    this.spawnTimer = 0.5;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.agentLines.set(p.id, {
        line: 0,
        y: 0,
        stunTimer: 0,
        score: 0
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
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const az = this.agentLines.get(p.id);
      if (!az) continue;

      if (az.stunTimer > 0) {
        az.stunTimer -= dt;
      }

      az.score += dt * 5; // distance score

      // Tap to switch line
      if (this.input.justPressed(p.id)) {
        az.line = az.line === 0 ? 1 : 0;
        this.audio.playTone(550, 0.05, 'triangle');
      }
    }

    // Spawn obstacles
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.8 + Math.random() * 0.5;
      const line = Math.random() < 0.5 ? 0 : 1;
      const type: 'spark' | 'data' = Math.random() < 0.4 ? 'data' : 'spark';
      this.obstacles.push({
        x: width + 40,
        line,
        type,
        hit: false
      });
    }

    // Move obstacles
    const zipSpeed = 280;
    for (const obs of this.obstacles) {
      if (obs.hit) continue;
      obs.x -= zipSpeed * dt;

      for (let i = 0; i < active.length; i++) {
        const p = active[i];
        const az = this.agentLines.get(p.id);
        if (!az || az.stunTimer > 0) continue;

        const playerX = 140;
        if (Math.abs(obs.x - playerX) < 24 && obs.line === az.line) {
          obs.hit = true;
          const py = this.getZiplineY(i, az.line, height, active.length);

          if (obs.type === 'spark') {
            az.stunTimer = 1.0;
            az.score = Math.max(0, az.score - 10);
            this.particles.emit(playerX, py, 12, '#EF4444');
            this.audio.playTone(160, 0.2, 'sawtooth');
          } else {
            az.score += 15;
            this.particles.emit(playerX, py, 8, '#38BDF8');
            this.audio.playTone(850, 0.08, 'sine');
          }
          break;
        }
      }
    }

    this.obstacles = this.obstacles.filter(o => !o.hit && o.x > -50);
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const az = this.agentLines.get(botId);
    if (!az) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false);
      return;
    }

    const scanFar = difficulty === 'bot_easy' ? 200 : difficulty === 'bot_normal' ? 245 : 275;
    const canDodge = difficulty === 'bot_easy' ? Math.random() < 0.68 : true;

    // Look for incoming obstacles
    const incomingDanger = this.obstacles.find(o => !o.hit && o.x > 140 && o.x < scanFar && o.line === az.line);
    if (incomingDanger) {
      if (incomingDanger.type === 'spark' && canDodge) {
        // Switch line to dodge
        this.input.setBotInput(botId, true);
      } else {
        // Data packet on current line: stay on it!
        this.input.setBotInput(botId, false);
      }
    } else {
      // Look for incoming data on the other line
      const seekOtherData = difficulty === 'bot_easy' ? Math.random() < 0.5 : true;
      const otherLineData = seekOtherData && this.obstacles.find(o => !o.hit && o.x > 180 && o.x < 280 && o.line !== az.line && o.type === 'data');
      if (otherLineData) {
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
    }
  }

  private getZiplineY(laneIndex: number, lineIndex: number, height: number, total: number): number {
    const laneHeight = (height - 80) / Math.max(1, total);
    const baseY = 50 + laneIndex * laneHeight;
    return lineIndex === 0 ? baseY + laneHeight * 0.35 : baseY + laneHeight * 0.75;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Night City Skyscraper Backdrop
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const laneHeight = (height - 80) / Math.max(1, active.length);

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const az = this.agentLines.get(p.id);
      if (!az) continue;

      const y0 = this.getZiplineY(i, 0, height, active.length);
      const y1 = this.getZiplineY(i, 1, height, active.length);

      // Upper & Lower Cable Ropes
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(width, y0);
      ctx.moveTo(0, y1);
      ctx.lineTo(width, y1);
      ctx.stroke();

      // Current player Y
      const py = az.line === 0 ? y0 : y1;
      const playerX = 140;

      ctx.save();
      ctx.translate(playerX, py);

      // Trolley hook
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 0);
      ctx.stroke();

      // Agent body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 8, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${Math.floor(az.score)}`, 20, y0 - 10);
    }

    // Obstacles
    for (const obs of this.obstacles) {
      if (obs.hit) continue;

      for (let i = 0; i < active.length; i++) {
        const oy = this.getZiplineY(i, obs.line, height, active.length);

        if (obs.type === 'spark') {
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(obs.x, oy, 8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(obs.x - 7, oy - 7, 14, 14);
        }
      }
    }

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ROOFTOP ZIPLINE: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: Math.floor(this.agentLines.get(p.id)?.score || 0),
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} ziplined through the nocturnal skyline to safety!` : 'The zipline cables snapped into the night!'
    };
  }
}
