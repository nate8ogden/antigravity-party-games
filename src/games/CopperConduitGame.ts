import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PipeValve {
  y: number;
  orientation: number; // 0: straight down, 1: turn right/open, 2: turn left
}

interface MoltenBlob {
  y: number;
  speed: number;
  state: 'flowing' | 'spilled' | 'poured';
}

interface FoundryStation {
  id: PlayerId;
  laneX: number;
  valves: PipeValve[];
  activeValve: number;
  blobs: MoltenBlob[];
  spawnTimer: number;
  score: number;
  ingots: number;
}

export class CopperConduitGame extends BaseGame {
  public stations: Map<PlayerId, FoundryStation> = new Map();
  public currentMapName: string = 'Royal Foundry Smelting Conduits';
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
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneX = idx * colWidth + colWidth * 0.5;

      const valves: PipeValve[] = [
        { y: height * 0.35, orientation: Math.random() < 0.5 ? 0 : 1 },
        { y: height * 0.55, orientation: Math.random() < 0.5 ? 0 : 1 },
        { y: height * 0.72, orientation: Math.random() < 0.5 ? 0 : 1 }
      ];

      this.stations.set(p.id, {
        id: p.id,
        laneX,
        valves,
        activeValve: 0,
        blobs: [],
        spawnTimer: 0.5 + Math.random() * 0.4,
        score: 0,
        ingots: 0
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

    this.stations.forEach(st => {
      // Toggle valve on tap
      if (this.input.justPressed(st.id)) {
        // Rotate all misaligned valves or cycle active valve
        const nextMisaligned = st.valves.find(v => v.orientation !== 0);
        if (nextMisaligned) {
          nextMisaligned.orientation = 0; // Align to straight down!
          this.audio.playTone(440, 0.08, 'triangle');
        } else {
          // If already aligned, turn one for fun or cycle
          st.valves[0].orientation = (st.valves[0].orientation + 1) % 2;
          this.audio.playTone(320, 0.08, 'triangle');
        }
      }

      // Spawn molten copper droplets from overhead crucible
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = 1.3 + Math.random() * 0.7;
        // Occasionally randomize a valve when a new droplet forms
        if (Math.random() < 0.6) {
          const randValve = st.valves[Math.floor(Math.random() * st.valves.length)];
          randValve.orientation = 1;
        }

        st.blobs.push({
          y: height * 0.2,
          speed: 160 + Math.random() * 30,
          state: 'flowing'
        });
      }

      // Update blobs
      const basinY = height - 50;
      for (let i = st.blobs.length - 1; i >= 0; i--) {
        const b = st.blobs[i];
        if (b.state === 'spilled') {
          st.blobs.splice(i, 1);
          continue;
        }

        b.y += b.speed * dt;

        // Check if passing each valve
        st.valves.forEach(v => {
          if (Math.abs(b.y - v.y) < 12 && v.orientation !== 0) {
            // Molten copper spills out of elbow!
            b.state = 'spilled';
            this.audio.playTone(130, 0.2, 'sawtooth');
            this.particles.emit(st.laneX + 20, v.y, 10, '#ff5500');
            this.particles.emit(st.laneX + 20, v.y, 6, 'rgba(255, 255, 255, 0.7)');
          }
        });

        // Check if reached basin safely
        if (b.y >= basinY && b.state === 'flowing') {
          b.state = 'poured';
          st.ingots++;
          st.score += 30;
          this.audio.playTone(540, 0.12, 'sine');
          this.particles.emit(st.laneX, basinY, 12, '#b87333');
          this.particles.emit(st.laneX, basinY - 10, 8, '#ffd700');
          st.blobs.splice(i, 1);
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
    if (!st) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    // Check if any blob is approaching a misaligned valve
    const urgent = st.blobs.some(b => {
      return st.valves.some(v => v.orientation !== 0 && v.y > b.y && v.y < b.y + 70);
    });

    if (urgent) {
      const accuracy = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.80 : 0.55;
      if (Math.random() < accuracy) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 0.3);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.1);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Foundry Brick & Smelter Glow Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1c100c');
    grad.addColorStop(0.5, '#291812');
    grad.addColorStop(1, '#150d0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#ffaa66';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP TO ALIGN COPPER VALVES! POUR MOLTEN INGOTS!', width * 0.5, 69);
    ctx.restore();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);
    const basinY = height - 50;

    // Render Stations
    this.stations.forEach(st => {
      const cfg = this.players.find(p => p.id === st.id);
      const lx = st.laneX;

      // Vertical Copper Main Pipe
      ctx.fillStyle = '#b87333';
      ctx.fillRect(lx - 8, height * 0.2, 16, basinY - height * 0.2);
      ctx.strokeStyle = '#8c5020';
      ctx.lineWidth = 2;
      ctx.strokeRect(lx - 8, height * 0.2, 16, basinY - height * 0.2);

      // Overhead Crucible Pot
      ctx.fillStyle = '#443328';
      ctx.beginPath();
      ctx.arc(lx, height * 0.18, 22, Math.PI, 0);
      ctx.fill();
      // Molten glow in crucible
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(lx - 16, height * 0.17, 32, 6);

      // Lower Smelting Basin / Crucible
      ctx.fillStyle = cfg?.color || '#b87333';
      ctx.beginPath();
      ctx.roundRect(lx - 32, basinY, 64, 24, 6);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Valves
      st.valves.forEach(v => {
        ctx.save();
        ctx.translate(lx, v.y);

        // Valve Box
        ctx.fillStyle = '#222222';
        ctx.fillRect(-14, -14, 28, 28);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.strokeRect(-14, -14, 28, 28);

        // Indicator Line
        ctx.strokeStyle = v.orientation === 0 ? '#2ecc71' : '#e74c3c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (v.orientation === 0) {
          // Vertical aligned
          ctx.moveTo(0, -12);
          ctx.lineTo(0, 12);
        } else {
          // Bent elbow / open vent
          ctx.moveTo(0, -12);
          ctx.lineTo(0, 0);
          ctx.lineTo(12, 0);
        }
        ctx.stroke();

        ctx.restore();
      });

      // Molten Copper Droplets
      st.blobs.forEach(b => {
        if (b.state !== 'flowing') return;
        ctx.fillStyle = '#ff7700';
        ctx.shadowColor = '#ff5500';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(lx, b.y, 6, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Score / Ingot count
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name || 'Player'}: ${st.score} Pts (${st.ingots} Ingots)`, lx, basinY + 38);
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
      mvpHighlight: winnerId ? `${winnerId} poured pure copper ingots!` : 'Conduits overheated!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
