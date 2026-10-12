import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface FireworkRocket {
  x: number;
  y: number;
  startY: number;
  apexY: number;
  vy: number;
  playerId: PlayerId;
  color: string;
  detonated: boolean;
  dud: boolean;
}

interface FinalePlayerState {
  score: number;
  combo: number;
  rocketCooldown: number;
}

export class FireworksFinaleGame extends BaseGame {
  private rockets: FireworkRocket[] = [];
  private playerStates: Map<PlayerId, FinalePlayerState> = new Map();
  private autoLaunchTimer: number = 0.8;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.rockets = [];
    this.playerStates.clear();
    this.autoLaunchTimer = 0.5;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.playerStates.set(p.id, {
        score: 0,
        combo: 0,
        rocketCooldown: 0
      });
    }

    // Launch initial rockets
    this.launchSalvo(width, height);
  }

  private launchSalvo(width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const spacing = width / (active.length + 1);
      const rx = spacing * (idx + 1) + (Math.random() - 0.5) * 40;
      const apexY = height * 0.2 + Math.random() * (height * 0.25);

      this.rockets.push({
        x: rx,
        y: height - 30,
        startY: height - 30,
        apexY,
        vy: -380,
        playerId: p.id,
        color: p.color,
        detonated: false,
        dud: false
      });
    });
    this.audio.playWhoosh();
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

    // Auto-launch rockets continuously
    this.autoLaunchTimer -= dt;
    if (this.autoLaunchTimer <= 0) {
      this.launchSalvo(width, height);
      this.autoLaunchTimer = 1.3;
    }

    // Update active rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.y += r.vy * dt;
      r.vy += dt * 180; // Gravity slowing ascension

      // Rocket passed apex without detonation -> dud
      if (r.vy > 100 && !r.detonated) {
        r.dud = true;
        this.rockets.splice(i, 1);
        continue;
      }

      // Spark trail
      if (Math.random() < 0.4) {
        this.particles.emit(r.x, r.y + 10, 2, '#F59E0B');
      }
    }

    // Check player inputs to detonate nearest rocket
    for (const p of this.getActivePlayers()) {
      const state = this.playerStates.get(p.id);
      if (!state) continue;

      if (this.input.justPressed(p.id)) {
        // Find player's active rocket closest to apex
        const targetRocket = this.rockets.find(r => r.playerId === p.id && !r.detonated);
        if (targetRocket) {
          targetRocket.detonated = true;
          const apexDiff = Math.abs(targetRocket.y - targetRocket.apexY);

          if (apexDiff < 30) {
            // PERFECT APEX BURST!
            state.combo++;
            const pts = 100 + state.combo * 15;
            state.score += pts;
            this.audio.playExplosion();
            this.audio.playTone(880, 0.15, 'triangle');
            this.particles.emit(targetRocket.x, targetRocket.y, 45, targetRocket.color);
            this.particles.emit(targetRocket.x, targetRocket.y, 20, '#FACC15');
          } else if (apexDiff < 70) {
            // Good burst
            state.combo = Math.max(0, state.combo - 1);
            state.score += 50;
            this.audio.playExplosion();
            this.particles.emit(targetRocket.x, targetRocket.y, 25, targetRocket.color);
          } else {
            // Poor timing
            state.combo = 0;
            state.score += 20;
            this.audio.playTone(220, 0.08, 'sawtooth');
            this.particles.emit(targetRocket.x, targetRocket.y, 10, '#64748B');
          }

          // Remove detonated rocket
          const rIdx = this.rockets.indexOf(targetRocket);
          if (rIdx !== -1) this.rockets.splice(rIdx, 1);
        } else {
          // Empty tap
          this.audio.playTone(180, 0.04, 'sine');
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _w: number, _h: number): void {
    const rocket = this.rockets.find(r => r.playerId === botId && !r.detonated);
    if (!rocket) {
      this.input.setBotInput(botId, false);
      return;
    }

    const apexDiff = Math.abs(rocket.y - rocket.apexY);
    const threshold = difficulty === 'bot_hard' ? 20 : difficulty === 'bot_normal' ? 45 : 75;

    if (apexDiff <= threshold) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Midnight dark sky
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, width, height);

    // City skyline silhouettes at bottom
    ctx.fillStyle = '#0F172A';
    const bldgW = 45;
    for (let bx = 0; bx < width; bx += bldgW) {
      const bldgH = 40 + ((bx * 31) % 60);
      ctx.fillRect(bx, height - bldgH, bldgW - 2, bldgH);
    }

    // Active Rockets
    for (const r of this.rockets) {
      // Apex detonation target ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.apexY, 25, 0, Math.PI * 2);
      ctx.stroke();

      // Rocket missile body
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.roundRect(-4, -12, 8, 24, 2);
      ctx.fill();

      // Golden cone nose
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(-4, -12);
      ctx.lineTo(4, -12);
      ctx.closePath();
      ctx.fill();

      // Exhaust flame
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(-3, 12);
      ctx.lineTo(0, 20);
      ctx.lineTo(3, 12);
      ctx.fill();

      ctx.restore();
    }

    // Player Stations at Bottom
    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const state = this.playerStates.get(p.id);
      if (!state) return;

      const px = (width / (count + 1)) * (idx + 1);
      const py = height - 25;

      // Rocket Mortar Tube
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(px - 10, py - 30, 20, 30, 3);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Score Pill
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(px - 45, py - 60, 90, 22, 4);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${state.score} PTS`, px, py - 44);
    });

    // Top Header
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`FIREWORKS FINALE • TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} illuminated the midnight carnival sky with a spectacular fireworks finale!` : 'The final pyrotechnic spark settled!'
    };
  }
}
