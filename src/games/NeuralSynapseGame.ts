import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ThoughtImpulse {
  id: number;
  x: number;
  speed: number;
  isHarmonic: boolean; // true = golden thought, false = viral glitch
}

interface SynapseStation {
  id: PlayerId;
  laneY: number;
  gateOpen: boolean;
  score: number;
  impulses: ThoughtImpulse[];
  spawnTimer: number;
  pulseAnim: number;
}

export class NeuralSynapseGame extends BaseGame {
  public stations: Map<PlayerId, SynapseStation> = new Map();
  public currentMapName: string = 'Synthetic Neural Cortex';
  private impulseId: number = 0;
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
    this.impulseId = 0;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.5;
      this.stations.set(p.id, {
        id: p.id,
        laneY,
        gateOpen: false,
        score: 0,
        impulses: [],
        spawnTimer: 0.4 + Math.random() * 0.4,
        pulseAnim: 0
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

    const gateX = width * 0.65;

    this.stations.forEach(st => {
      if (st.pulseAnim > 0) st.pulseAnim -= dt * 3.5;

      // Tap to toggle synaptic gate
      if (this.input.justPressed(st.id)) {
        st.gateOpen = !st.gateOpen;
        this.audio.playTone(st.gateOpen ? 560 : 380, 0.06, 'triangle');
      }

      // Spawn thought impulses
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = 0.9 + Math.random() * 0.7;
        st.impulses.push({
          id: this.impulseId++,
          x: 40,
          speed: 220 + Math.random() * 80,
          isHarmonic: Math.random() > 0.3
        });
      }

      // Move impulses
      for (let i = st.impulses.length - 1; i >= 0; i--) {
        const imp = st.impulses[i];
        imp.x += imp.speed * dt;

        // Check passage across gate
        if (Math.abs(imp.x - gateX) < 16) {
          if (st.gateOpen) {
            if (imp.isHarmonic) {
              st.score += 35;
              st.pulseAnim = 1.0;
              this.audio.playTone(720, 0.1, 'sine');
              this.particles.emit(gateX, st.laneY, 10, '#00ffff');
            } else {
              // Viral glitch entered!
              st.score = Math.max(0, st.score - 20);
              this.audio.playTone(130, 0.2, 'sawtooth');
              this.particles.emit(gateX, st.laneY, 12, '#ff0055');
            }
            st.impulses.splice(i, 1);
            continue;
          }
        }

        if (imp.x > width) {
          st.impulses.splice(i, 1);
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _h: number
  ): void {
    const st = this.stations.get(botId);
    if (!st) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const gateX = width * 0.65;
    const upcoming = st.impulses.find(i => i.x > gateX - 90 && i.x < gateX + 15);

    if (upcoming) {
      let wantOpen = upcoming.isHarmonic;
      if (difficulty === 'bot_easy' && Math.random() < 0.25) {
        wantOpen = !wantOpen;
      }

      if (st.gateOpen !== wantOpen) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 0.3);
        return;
      }
    } else {
      if (st.gateOpen) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 0.2);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.08);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Neural Cortex Bioluminescent Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#070514');
    grad.addColorStop(0.5, '#120d29');
    grad.addColorStop(1, '#080617');
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
    ctx.fillText('TAP TO OPEN SYNAPSE! CONDUCT GOLD PULSES, BLOCK VIRUSES!', width * 0.5, 69);
    ctx.restore();

    const gateX = width * 0.65;
    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    // Render Neural Axons
    this.stations.forEach(st => {
      const cfg = this.players.find(p => p.id === st.id);
      const laneY = st.laneY;

      // Glowing Axon Line
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(30, laneY);
      ctx.lineTo(width - 30, laneY);
      ctx.stroke();

      // Impulses
      st.impulses.forEach(imp => {
        ctx.fillStyle = imp.isHarmonic ? '#ffd700' : '#ff0055';
        ctx.shadowColor = imp.isHarmonic ? '#ffd700' : '#ff0055';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(imp.x, laneY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Synapse Gate Node
      ctx.save();
      ctx.translate(gateX, laneY);

      // Node Ring
      ctx.fillStyle = '#1c1b2e';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = st.gateOpen ? '#00ffcc' : '#ff0055';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Gate Bridge
      if (st.gateOpen) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(12, 0);
        ctx.stroke();
      }

      ctx.restore();

      // Label & Score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name || 'Player'}: ${st.score} Synapses ${st.gateOpen ? '[OPEN]' : '[BLOCKED]'}`, 30, laneY - laneHeight * 0.32);
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
      mvpHighlight: winnerId ? `${winnerId} stimulated peak synthetic brainwaves!` : 'Brain synapses faded!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
