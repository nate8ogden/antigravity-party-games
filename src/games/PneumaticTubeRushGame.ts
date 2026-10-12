import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Canister {
  id: number;
  x: number;
  y: number;
  vx: number;
  type: 'gold' | 'silver' | 'nitro';
  value: number;
}

interface PneumaticVault {
  id: PlayerId;
  laneY: number;
  gateOpen: boolean;
  score: number;
  chokeTimer: number;
  canisters: Canister[];
  spawnTimer: number;
}

export class PneumaticTubeRushGame extends BaseGame {
  public vaults: Map<PlayerId, PneumaticVault> = new Map();
  public currentMapName: string = 'Underground Metropolis Dispatch';
  private canisterId: number = 0;
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
    this.vaults.clear();
    this.canisterId = 0;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.5;
      this.vaults.set(p.id, {
        id: p.id,
        laneY,
        gateOpen: false,
        score: 0,
        chokeTimer: 0,
        canisters: [],
        spawnTimer: 0.4 + Math.random() * 0.4
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

    const gateX = width - 80;

    this.vaults.forEach(v => {
      if (v.chokeTimer > 0) v.chokeTimer -= dt;

      // Toggle gate
      if (this.input.justPressed(v.id) && v.chokeTimer <= 0) {
        v.gateOpen = !v.gateOpen;
        this.audio.playTone(v.gateOpen ? 460 : 320, 0.08, 'triangle');
      }

      // Spawn canisters
      v.spawnTimer -= dt;
      if (v.spawnTimer <= 0) {
        v.spawnTimer = 0.9 + Math.random() * 0.7;
        const rand = Math.random();
        const type = rand < 0.25 ? 'nitro' : rand < 0.65 ? 'silver' : 'gold';
        const value = type === 'gold' ? 30 : type === 'silver' ? 15 : -25;
        v.canisters.push({
          id: this.canisterId++,
          x: 20,
          y: v.laneY,
          vx: 260 + Math.random() * 100,
          type,
          value
        });
      }

      // Update canisters
      for (let i = v.canisters.length - 1; i >= 0; i--) {
        const c = v.canisters[i];
        c.x += c.vx * dt;

        // Catch canister at the gate
        if (Math.abs(c.x - gateX) < 18) {
          if (v.gateOpen) {
            // Diverted into vault!
            if (c.type === 'nitro') {
              v.score = Math.max(0, v.score - 30);
              v.chokeTimer = 1.2;
              v.gateOpen = false;
              this.audio.playTone(120, 0.3, 'sawtooth');
              this.particles.emit(gateX, v.laneY, 15, '#ff4400');
            } else {
              v.score += c.value;
              this.audio.playTone(c.type === 'gold' ? 620 : 440, 0.1, 'sine');
              this.particles.emit(gateX, v.laneY, 8, c.type === 'gold' ? '#ffd700' : '#c0c0c0');
            }
            v.canisters.splice(i, 1);
            continue;
          }
        }

        // Passed off screen
        if (c.x > width) {
          v.canisters.splice(i, 1);
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
    const v = this.vaults.get(botId);
    if (!v || v.chokeTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const gateX = width - 80;
    // Look for upcoming canister approaching gate
    const upcoming = v.canisters.find(c => c.x > gateX - 110 && c.x < gateX + 10);

    if (upcoming) {
      const isGood = upcoming.type !== 'nitro';
      // Bot decides desired gate state
      let wantOpen = isGood;
      if (difficulty === 'bot_easy' && Math.random() < 0.3) {
        wantOpen = !wantOpen; // Mistake on easy
      }

      if (v.gateOpen !== wantOpen) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 0.3);
        return;
      }
    } else {
      // Default to closed when nothing approaching
      if (v.gateOpen) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 0.2);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.1);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Metro Subterranean Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#111417');
    grad.addColorStop(0.5, '#192026');
    grad.addColorStop(1, '#0e1214');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP TO TOGGLE PNEUMATIC GATE! DIVERT GOLD, AVOID NITRO!', width * 0.5, 69);
    ctx.restore();

    const gateX = width - 80;
    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    // Render Vault Lanes
    this.vaults.forEach(v => {
      const cfg = this.players.find(p => p.id === v.id);
      const laneY = v.laneY;

      // Brass Pneumatic Tube
      ctx.fillStyle = 'rgba(212, 175, 55, 0.15)';
      ctx.fillRect(20, laneY - 10, width - 40, 20);
      ctx.strokeStyle = '#cd7f32';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(20, laneY - 10);
      ctx.lineTo(width - 20, laneY - 10);
      ctx.moveTo(20, laneY + 10);
      ctx.lineTo(width - 20, laneY + 10);
      ctx.stroke();

      // Tube Ring Couplers
      ctx.fillStyle = '#8c5828';
      for (let rx = 50; rx < width - 40; rx += 80) {
        ctx.fillRect(rx - 3, laneY - 13, 6, 26);
      }

      // Render Moving Canisters
      v.canisters.forEach(c => {
        ctx.save();
        ctx.translate(c.x, c.y);

        // Canister capsule body
        ctx.fillStyle = c.type === 'gold' ? '#ffd700' : c.type === 'silver' ? '#e2e8f0' : '#ef4444';
        ctx.beginPath();
        ctx.roundRect(-14, -7, 28, 14, 6);
        ctx.fill();

        // Rubber seals on ends
        ctx.fillStyle = '#111111';
        ctx.fillRect(-12, -7, 3, 14);
        ctx.fillRect(9, -7, 3, 14);

        // Glass message window in center
        ctx.fillStyle = c.type === 'nitro' ? '#7f1d1d' : 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(-4, -4, 8, 8);

        ctx.restore();
      });

      // Suction Diverter Gate
      ctx.save();
      ctx.translate(gateX, laneY);

      // Gate housing
      ctx.fillStyle = '#262626';
      ctx.fillRect(-10, -22, 20, 44);
      ctx.strokeStyle = v.chokeTimer > 0 ? '#ff3300' : (cfg?.color || '#ffffff');
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -22, 20, 44);

      // Diverter Flap Blade
      ctx.fillStyle = v.gateOpen ? '#2ecc71' : '#e74c3c';
      ctx.beginPath();
      if (v.gateOpen) {
        // Angle open pointing down into vault chute
        ctx.moveTo(-6, -16);
        ctx.lineTo(8, 16);
        ctx.lineTo(4, 16);
        ctx.lineTo(-10, -16);
      } else {
        // Flat closed
        ctx.fillRect(-3, -16, 6, 32);
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Station Score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name || 'Player'}: ${v.score} Pts ${v.gateOpen ? '[GATE OPEN]' : '[CLOSED]'}`, 20, laneY - laneHeight * 0.32);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.vaults.forEach((v, pId) => scores.set(pId, v.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.vaults.entries())
      .map(([playerId, v]) => ({ playerId, score: v.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} intercepted top-secret dispatches!` : 'Dispatch network jammed!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
