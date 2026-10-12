import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface AutomatonUnit {
  x: number;
  assembled: boolean;
  type: 'robot' | 'bird';
  speed: number;
}

interface AssemblyStation {
  id: PlayerId;
  laneY: number;
  pressY: number; // offset when slamming down
  isPressing: boolean;
  score: number;
  combo: number;
  jamTimer: number;
  units: AutomatonUnit[];
  spawnTimer: number;
}

export class AutomatorAssemblyGame extends BaseGame {
  public stations: Map<PlayerId, AssemblyStation> = new Map();
  public currentMapName: string = 'Royal Clockwork Automaton Factory';
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
    this.stations.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.5;
      this.stations.set(p.id, {
        id: p.id,
        laneY,
        pressY: 0,
        isPressing: false,
        score: 0,
        combo: 0,
        jamTimer: 0,
        units: [],
        spawnTimer: 0.5 + Math.random() * 0.5
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

    const pressX = 140; // X position of the hydraulic press

    this.stations.forEach(st => {
      if (st.jamTimer > 0) st.jamTimer -= dt;

      // Spawn automatons along conveyor
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = 1.3 + Math.random() * 0.8;
        st.units.push({
          x: width + 20,
          assembled: false,
          type: Math.random() < 0.6 ? 'robot' : 'bird',
          speed: 150 + Math.random() * 40
        });
      }

      // Update moving units
      for (let i = st.units.length - 1; i >= 0; i--) {
        const u = st.units[i];
        u.x -= u.speed * dt;
        if (u.x < -40) {
          st.units.splice(i, 1);
        }
      }

      // Update press animation
      if (st.isPressing) {
        st.pressY += dt * 140;
        if (st.pressY >= 26) {
          st.pressY = 26;
          st.isPressing = false;
        }
      } else if (st.pressY > 0) {
        st.pressY = Math.max(0, st.pressY - dt * 90);
      }

      // Check input
      if (this.input.justPressed(st.id) && st.jamTimer <= 0) {
        st.isPressing = true;
        st.pressY = 0;

        // Check if an unassembled unit is right under the press
        let hitUnit = st.units.find(u => !u.assembled && Math.abs(u.x - pressX) < 28);
        if (hitUnit) {
          hitUnit.assembled = true;
          st.combo++;
          const gain = 20 + st.combo * 5;
          st.score += gain;
          this.audio.playTone(480 + st.combo * 30, 0.1, 'triangle');
          this.particles.emit(pressX, st.laneY + 5, 8, '#ffd700');
        } else {
          // Empty press smash (jam)
          st.combo = 0;
          st.jamTimer = 0.5;
          this.audio.playTone(140, 0.15, 'sawtooth');
          this.particles.emit(pressX, st.laneY + 15, 6, '#ff4400');
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const st = this.stations.get(botId);
    if (!st || st.jamTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const pressX = 140;
    const target = st.units.find(u => !u.assembled && Math.abs(u.x - pressX) < 24);

    if (target) {
      const accuracy = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.80 : 0.55;
      if (Math.random() < accuracy) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 0.4);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.08);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Workshop Wood & Brass Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1c140e');
    grad.addColorStop(0.5, '#2b1c13');
    grad.addColorStop(1, '#18110b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#ffcc80';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STAMP BRASS GEARS INTO CONVEYOR AUTOMATONS!', width * 0.5, 69);
    ctx.restore();

    const pressX = 140;
    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    // Render Stations
    this.stations.forEach(st => {
      const cfg = this.players.find(p => p.id === st.id);
      const laneY = st.laneY;

      // Conveyor Belt
      ctx.fillStyle = '#100c09';
      ctx.fillRect(20, laneY + 12, width - 40, 14);
      ctx.strokeStyle = '#634832';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, laneY + 12, width - 40, 14);

      // Conveyor Rollers
      ctx.fillStyle = '#8b6548';
      for (let rx = 30; rx < width - 40; rx += 36) {
        ctx.beginPath();
        ctx.arc(rx, laneY + 19, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Moving Automatons
      st.units.forEach(u => {
        ctx.save();
        ctx.translate(u.x, laneY + 8);

        // Body
        ctx.fillStyle = u.assembled ? '#ffd700' : '#8a7968';
        ctx.fillRect(-12, -18, 24, 20);

        // Head
        ctx.fillStyle = u.assembled ? '#ffea00' : '#6b5e51';
        ctx.fillRect(-8, -26, 16, 8);

        // Glowing eyes / windup key
        if (u.assembled) {
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(-5, -24, 3, 3);
          ctx.fillRect(2, -24, 3, 3);

          // Top windup key
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, -32, 5, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Empty gear cavity in chest
          ctx.fillStyle = '#1a1410';
          ctx.beginPath();
          ctx.arc(0, -8, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // Hydraulic Steam Stamp Press
      ctx.save();
      ctx.translate(pressX, laneY - 25 + st.pressY);

      // Piston rod
      ctx.fillStyle = '#a6896f';
      ctx.fillRect(-6, -30, 12, 30);

      // Heavy stamp hammer
      ctx.fillStyle = st.jamTimer > 0 ? '#ff3300' : (cfg?.color || '#cd7f32');
      ctx.fillRect(-16, 0, 32, 16);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-16, 0, 32, 16);

      // Gold gear tooth ready on hammer head
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(0, 16, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Station Score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name || 'Player'}: ${st.score} Built`, 20, laneY - laneHeight * 0.32);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.stations.forEach((s, pId) => scores.set(pId, s.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.stations.entries())
      .map(([playerId, s]) => ({ playerId, score: s.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} manufactured an invincible clockwork army!` : 'Factory stalled!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
