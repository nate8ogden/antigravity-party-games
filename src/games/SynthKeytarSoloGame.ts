import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SynthNote {
  id: number;
  y: number;
  speed: number;
  color: string;
  hit: boolean;
}

interface KeytarStation {
  id: PlayerId;
  laneX: number;
  notes: SynthNote[];
  score: number;
  combo: number;
  spawnTimer: number;
  soloFlash: number;
}

export class SynthKeytarSoloGame extends BaseGame {
  public stations: Map<PlayerId, KeytarStation> = new Map();
  public currentMapName: string = 'Neon Retrowave Concert Hall';
  private noteIdCounter: number = 0;
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
    this.noteIdCounter = 0;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneX = idx * colWidth + colWidth * 0.5;
      this.stations.set(p.id, {
        id: p.id,
        laneX,
        notes: [],
        score: 0,
        combo: 0,
        spawnTimer: 0.4 + Math.random() * 0.4,
        soloFlash: 0
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

    const strikeY = height - 60;

    this.stations.forEach(st => {
      if (st.soloFlash > 0) st.soloFlash -= dt * 3.5;

      // Spawn synth notes
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = 0.75 + Math.random() * 0.5;
        const colors = ['#00ffff', '#ff007f', '#ffd700'];
        st.notes.push({
          id: this.noteIdCounter++,
          y: 70,
          speed: 240 + Math.random() * 60,
          color: colors[Math.floor(Math.random() * colors.length)],
          hit: false
        });
      }

      // Check keytar tap
      if (this.input.justPressed(st.id)) {
        // Find closest note to strike line
        let bestNote: SynthNote | null = null;
        let minDiff = 45;

        st.notes.forEach(n => {
          if (!n.hit) {
            const diff = Math.abs(n.y - strikeY);
            if (diff < minDiff) {
              minDiff = diff;
              bestNote = n;
            }
          }
        });

        if (bestNote) {
          (bestNote as SynthNote).hit = true;
          st.combo++;
          const gain = 25 + st.combo * 5;
          st.score += gain;
          st.soloFlash = 1.0;
          this.audio.playTone(440 + st.combo * 35, 0.12, 'sawtooth');
          this.particles.emit(st.laneX, strikeY, 12, (bestNote as SynthNote).color);
        } else {
          // Miss / bad timing
          st.combo = 0;
          this.audio.playTone(150, 0.15, 'sawtooth');
        }
      }

      // Move notes
      for (let i = st.notes.length - 1; i >= 0; i--) {
        const n = st.notes[i];
        n.y += n.speed * dt;

        if (n.y > height - 10) {
          if (!n.hit) st.combo = 0;
          st.notes.splice(i, 1);
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
    const st = this.stations.get(botId);
    if (!st) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const strikeY = height - 60;
    const target = st.notes.find(n => !n.hit && Math.abs(n.y - strikeY) < 18);

    if (target) {
      const accuracy = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.78 : 0.52;
      if (Math.random() < accuracy) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 0.35);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.05);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Retrowave Sunset & Stage Lights
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0c071a');
    grad.addColorStop(0.5, '#240d33');
    grad.addColorStop(1, '#0e0517');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#ff007f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP IN RHYTHM WHEN SYNTH NOTES HIT THE KEYTAR LINE!', width * 0.5, 69);
    ctx.restore();

    const strikeY = height - 60;

    // Render Stations
    this.stations.forEach(st => {
      const cfg = this.players.find(p => p.id === st.id);
      const lx = st.laneX;

      // Note Highway Vertical Lane
      ctx.fillStyle = 'rgba(255, 0, 128, 0.06)';
      ctx.fillRect(lx - 24, 70, 48, height - 130);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(lx - 24, 70, 48, height - 130);

      // Strike Target Line (Keytar frets)
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(lx - 28, strikeY);
      ctx.lineTo(lx + 28, strikeY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Synth Notes
      st.notes.forEach(n => {
        if (n.hit) return;
        ctx.fillStyle = n.color;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(lx - 20, n.y - 7, 40, 14, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Solo Flash effect
      if (st.soloFlash > 0) {
        ctx.fillStyle = `rgba(255, 0, 128, ${st.soloFlash * 0.4})`;
        ctx.fillRect(lx - 24, 70, 48, height - 130);
      }

      // Label & Score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name || 'Player'}: ${st.score} Hype`, lx, strikeY + 28);

      if (st.combo > 1) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${st.combo}x STREAK!`, lx, strikeY + 44);
      }
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
      mvpHighlight: winnerId ? `${winnerId} rocked an epic synthwave keytar solo!` : 'Show cancelled!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
