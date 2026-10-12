import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Guest {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isAgent: boolean;
  maskColor: string;
}

export class DisguiseShuffleGame extends BaseGame {
  private scores: Map<PlayerId, number> = new Map();
  private cursorX: Map<PlayerId, number> = new Map();
  private cursorY: Map<PlayerId, number> = new Map();
  private cursorAngle: Map<PlayerId, number> = new Map();
  private guests: Guest[] = [];

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.scores.clear();
    this.cursorX.clear();
    this.cursorY.clear();
    this.cursorAngle.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;

    this.spawnGuests(width, height);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      this.scores.set(p.id, 0);
      this.cursorAngle.set(p.id, (i * Math.PI) / 2);
    }
  }

  private spawnGuests(width: number, height: number): void {
    this.guests = [];
    const colors = ['#9333EA', '#2563EB', '#059669', '#D97706', '#DB2777'];

    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 40;
      this.guests.push({
        id: i,
        x: 100 + Math.random() * (width - 200),
        y: 100 + Math.random() * (height - 200),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        isAgent: i === 0, // Guest 0 is the rogue double agent with Gold Mask!
        maskColor: i === 0 ? '#FBBF24' : colors[i % colors.length]
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

    // Update guests drifting around ballroom
    for (const g of this.guests) {
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      if (g.x < 70) { g.x = 70; g.vx *= -1; }
      if (g.x > width - 70) { g.x = width - 70; g.vx *= -1; }
      if (g.y < 70) { g.y = 70; g.vy *= -1; }
      if (g.y > height - 70) { g.y = height - 70; g.vy *= -1; }
    }

    const cx = width / 2;
    const cy = height / 2;
    const active = this.getActivePlayers();

    for (const p of active) {
      let angle = (this.cursorAngle.get(p.id) || 0) + 1.8 * dt;
      this.cursorAngle.set(p.id, angle);

      const radius = 160;
      const curX = cx + Math.cos(angle) * radius;
      const curY = cy + Math.sin(angle) * radius;
      this.cursorX.set(p.id, curX);
      this.cursorY.set(p.id, curY);

      if (this.input.justPressed(p.id)) {
        // Check if any guest is under cursor
        const hitGuest = this.guests.find(g => Math.hypot(g.x - curX, g.y - curY) < 32);

        if (hitGuest) {
          if (hitGuest.isAgent) {
            // UNMASKED DOUBLE AGENT!
            this.scores.set(p.id, (this.scores.get(p.id) || 0) + 25);
            this.particles.emit(hitGuest.x, hitGuest.y, 20, '#FBBF24');
            this.audio.playTone(950, 0.15, 'sine');
            // Reshuffle guests
            this.spawnGuests(width, height);
          } else {
            // Innocent guest false accusation
            this.scores.set(p.id, Math.max(0, (this.scores.get(p.id) || 0) - 10));
            this.particles.emit(hitGuest.x, hitGuest.y, 10, '#EF4444');
            this.audio.playTone(160, 0.2, 'sawtooth');
          }
        } else {
          this.audio.playTone(250, 0.05, 'triangle');
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const curX = this.cursorX.get(botId) || 0;
    const curY = this.cursorY.get(botId) || 0;

    const agent = this.guests.find(g => g.isAgent);
    if (!agent) return;

    const dist = Math.hypot(agent.x - curX, agent.y - curY);
    const threshold = difficulty === 'bot_hard' ? 22 : difficulty === 'bot_normal' ? 16 : 10;

    if (dist <= threshold) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Elegant Masquerade Ballroom
    ctx.fillStyle = '#1E1B4B';
    ctx.fillRect(0, 0, width, height);

    // Ballroom Chandeliers glow
    ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 220, 0, Math.PI * 2);
    ctx.fill();

    // Guests
    for (const g of this.guests) {
      ctx.save();
      ctx.translate(g.x, g.y);

      // Ballgown / Tuxedo body
      ctx.fillStyle = '#312E81';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();

      // Masquerade Mask
      ctx.fillStyle = g.maskColor;
      ctx.fillRect(-10, -6, 20, 8);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(-10, -6, 20, 8);

      if (g.isAgent) {
        // Subtle golden sparkle on agent
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(-2, -14, 4, 4);
      }

      ctx.restore();
    }

    // Player Spotlights & Cursors
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const curX = this.cursorX.get(p.id) || width / 2;
      const curY = this.cursorY.get(p.id) || height / 2;

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(curX, curY, 26, 0, Math.PI * 2);
      ctx.moveTo(curX - 32, curY);
      ctx.lineTo(curX + 32, curY);
      ctx.moveTo(curX, curY - 32);
      ctx.lineTo(curX, curY + 32);
      ctx.stroke();

      // Player Score HUD
      const px = 20 + i * (width / Math.max(1, active.length));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px + 10, 20, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${this.scores.get(p.id) || 0}`, px + 24, 24);
    }

    ctx.fillStyle = '#FDE047';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`DISGUISE SHUFFLE (SPOT GOLD MASK): ${Math.ceil(this.roundTimer)}s`, width / 2, 55);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.scores.get(p.id) || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} spotted the rogue double agent in the masquerade!` : 'The masquerade ball danced into mystery!'
    };
  }
}
