import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MicroDrone {
  id: number;
  x: number;
  y: number;
  vy: number;
}

interface EmpWave {
  radius: number;
  maxRadius: number;
  active: boolean;
}

interface DefenseTerminal {
  id: PlayerId;
  laneX: number;
  coreHp: number;
  score: number;
  empCooldown: number;
  empWave: EmpWave | null;
  drones: MicroDrone[];
  spawnTimer: number;
}

export class DroneSwarmDefenseGame extends BaseGame {
  public terminals: Map<PlayerId, DefenseTerminal> = new Map();
  public currentMapName: string = 'Cyber-Grid Defense Bastion';
  private droneIdCounter: number = 0;
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
    this.terminals.clear();
    this.droneIdCounter = 0;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneX = idx * colWidth + colWidth * 0.5;
      this.terminals.set(p.id, {
        id: p.id,
        laneX,
        coreHp: 100,
        score: 0,
        empCooldown: 0,
        empWave: null,
        drones: [],
        spawnTimer: 0.5 + Math.random() * 0.5
      });

      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.3);
    });
  }

  public update(dt: number, _w: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, _w, height);

    const terminalY = height - 55;

    this.terminals.forEach(t => {
      if (t.empCooldown > 0) t.empCooldown -= dt;

      // Trigger EMP Shockwave on tap
      if (this.input.justPressed(t.id) && t.empCooldown <= 0) {
        t.empCooldown = 1.3;
        t.empWave = {
          radius: 10,
          maxRadius: 110,
          active: true
        };
        this.audio.playTone(320, 0.2, 'square');
        this.particles.emit(t.laneX, terminalY, 8, '#00e5ff');
      }

      // Update EMP Wave
      if (t.empWave && t.empWave.active) {
        t.empWave.radius += dt * 240;
        if (t.empWave.radius >= t.empWave.maxRadius) {
          t.empWave.active = false;
        }

        // Check drones in blast radius
        for (let i = t.drones.length - 1; i >= 0; i--) {
          const d = t.drones[i];
          const dist = Math.hypot(d.x - t.laneX, d.y - terminalY);
          if (dist <= t.empWave.radius) {
            // Drone fried!
            t.score += 25;
            this.audio.playTone(660, 0.08, 'triangle');
            this.particles.emit(d.x, d.y, 8, '#00ffff');
            t.drones.splice(i, 1);
          }
        }
      }

      // Spawn descending micro-drones
      t.spawnTimer -= dt;
      if (t.spawnTimer <= 0) {
        t.spawnTimer = 0.8 + Math.random() * 0.6;
        t.drones.push({
          id: this.droneIdCounter++,
          x: t.laneX + (Math.random() - 0.5) * 60,
          y: 70,
          vy: 110 + Math.random() * 50
        });
      }

      // Move drones
      for (let i = t.drones.length - 1; i >= 0; i--) {
        const d = t.drones[i];
        d.y += d.vy * dt;

        if (d.y >= terminalY - 10) {
          // Drone reached core!
          t.coreHp = Math.max(0, t.coreHp - 15);
          this.audio.playTone(120, 0.25, 'sawtooth');
          this.particles.emit(d.x, terminalY, 12, '#ff0055');
          t.drones.splice(i, 1);
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    height: number
  ): void {
    const t = this.terminals.get(botId);
    if (!t || t.empCooldown > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const terminalY = height - 55;
    // Count drones within EMP danger zone
    const inRange = t.drones.filter(d => terminalY - d.y < 95);

    const minCluster = difficulty === 'bot_hard' ? 2 : 1;
    if (inRange.length >= minCluster || inRange.some(d => terminalY - d.y < 35)) {
      const accuracy = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.78 : 0.50;
      if (Math.random() < accuracy) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 0.5);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.08);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Cyber Defense Fortress Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#04060d');
    grad.addColorStop(0.5, '#0c1024');
    grad.addColorStop(1, '#050711');
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
    ctx.fillText('TIME EMP SHOCKWAVES TO ANNIHILATE DRONE SWARMS!', width * 0.5, 69);
    ctx.restore();

    const terminalY = height - 55;

    // Render Terminals & Sectors
    this.terminals.forEach(t => {
      const cfg = this.players.find(p => p.id === t.id);
      const lx = t.laneX;

      // EMP Wave Ring
      if (t.empWave && t.empWave.active) {
        ctx.save();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(lx, terminalY, t.empWave.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Micro Drones
      t.drones.forEach(d => {
        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Terminal Core Platform
      ctx.fillStyle = '#1c2438';
      ctx.beginPath();
      ctx.roundRect(lx - 32, terminalY - 14, 64, 28, 6);
      ctx.fill();
      ctx.strokeStyle = t.empCooldown <= 0 ? '#00ffcc' : '#555555';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Core Crystal
      ctx.fillStyle = cfg?.color || '#00e5ff';
      ctx.beginPath();
      ctx.arc(lx, terminalY, 8, 0, Math.PI * 2);
      ctx.fill();

      // HP Bar & Score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name || 'Player'}: ${t.score} Pts (${t.coreHp}% Core)`, lx, terminalY + 28);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.terminals.forEach((t, pId) => scores.set(pId, t.score + t.coreHp));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.terminals.entries())
      .map(([playerId, t]) => ({ playerId, score: t.score + t.coreHp, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} shielded the core from drone swarm saturation!` : 'Data terminals destroyed!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
