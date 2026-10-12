import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface AgentState {
  x: number;
  y: number;
  angle: number;
  speed: number;
  hasBriefcase: boolean;
  score: number;
}

export class BriefcaseSnatchGame extends BaseGame {
  private agents: Map<PlayerId, AgentState> = new Map();
  private briefcaseX: number = 0;
  private briefcaseY: number = 0;
  private briefcaseCarrier: PlayerId | null = null;
  private turnstileOpen: boolean = false;
  private turnstileTimer: number = 2.0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.agents.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;
    this.briefcaseX = width / 2;
    this.briefcaseY = height / 2;
    this.briefcaseCarrier = null;
    this.turnstileOpen = true;
    this.turnstileTimer = 2.0;

    const corners = [
      { x: 120, y: 120 },
      { x: width - 120, y: 120 },
      { x: 120, y: height - 120 },
      { x: width - 120, y: height - 120 }
    ];

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const pos = corners[i % 4];
      this.agents.set(p.id, {
        x: pos.x,
        y: pos.y,
        angle: Math.random() * Math.PI * 2,
        speed: 160,
        hasBriefcase: false,
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

    // Toggle subway turnstiles
    this.turnstileTimer -= dt;
    if (this.turnstileTimer <= 0) {
      this.turnstileTimer = 2.5 + Math.random() * 1.5;
      this.turnstileOpen = !this.turnstileOpen;
      this.audio.playTone(this.turnstileOpen ? 600 : 300, 0.05, 'triangle');
    }

    // Award hold points to briefcase carrier
    if (this.briefcaseCarrier !== null) {
      const carrier = this.agents.get(this.briefcaseCarrier);
      if (carrier) {
        carrier.score += dt * 8;
        this.briefcaseX = carrier.x;
        this.briefcaseY = carrier.y;

        // Check banking through turnstiles at top
        if (this.turnstileOpen && carrier.y < 85) {
          carrier.score += 25;
          this.briefcaseCarrier = null;
          carrier.hasBriefcase = false;
          this.briefcaseX = width / 2;
          this.briefcaseY = height / 2;
          this.particles.emit(carrier.x, carrier.y, 20, '#FBBF24');
          this.audio.playTone(950, 0.2, 'sine');
        }
      }
    }

    const active = this.getActivePlayers();
    for (const p of active) {
      const a = this.agents.get(p.id);
      if (!a) continue;

      // Tap turns, hold drives forward
      if (this.input.isPressed(p.id)) {
        a.angle += 3.8 * dt;
      }

      a.x += Math.cos(a.angle) * a.speed * dt;
      a.y += Math.sin(a.angle) * a.speed * dt;

      // Arena bounce
      if (a.x < 30) { a.x = 30; a.angle = Math.PI - a.angle; }
      if (a.x > width - 30) { a.x = width - 30; a.angle = Math.PI - a.angle; }
      if (a.y < 45) { a.y = 45; a.angle = -a.angle; }
      if (a.y > height - 45) { a.y = height - 45; a.angle = -a.angle; }

      // Check pick up loose briefcase
      if (this.briefcaseCarrier === null) {
        if (Math.hypot(a.x - this.briefcaseX, a.y - this.briefcaseY) < 32) {
          this.briefcaseCarrier = p.id;
          a.hasBriefcase = true;
          this.particles.emit(a.x, a.y, 10, '#FBBF24');
          this.audio.playTone(700, 0.1, 'sine');
        }
      }

      // Check snatching from rival agent
      for (const rival of active) {
        if (rival.id === p.id) continue;
        const ra = this.agents.get(rival.id);
        if (ra && ra.hasBriefcase && Math.hypot(a.x - ra.x, a.y - ra.y) < 28) {
          ra.hasBriefcase = false;
          a.hasBriefcase = true;
          this.briefcaseCarrier = p.id;
          this.particles.emit(a.x, a.y, 12, '#38BDF8');
          this.audio.playTone(800, 0.1, 'sawtooth');
          break;
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const a = this.agents.get(botId);
    if (!a) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false);
      return;
    }

    let targetX = this.briefcaseX;
    let targetY = this.briefcaseY;

    if (a.hasBriefcase) {
      // Run toward subway turnstile at top center
      targetX = _width / 2;
      targetY = 50;
    }

    if (difficulty === 'bot_easy') {
      targetX += (Math.random() - 0.5) * 45;
      targetY += (Math.random() - 0.5) * 45;
    }

    const angleToTarget = Math.atan2(targetY - a.y, targetX - a.x);
    let diff = angleToTarget - a.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const deadzone = difficulty === 'bot_easy' ? 0.65 : difficulty === 'bot_normal' ? 0.35 : 0.15;
    if (Math.abs(diff) > deadzone) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Subway station tiles
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, width, height);

    // Turnstiles at top
    ctx.fillStyle = this.turnstileOpen ? '#059669' : '#DC2626';
    ctx.fillRect(width * 0.3, 20, width * 0.4, 25);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.turnstileOpen ? 'TURNSTILES OPEN (+25)' : 'TURNSTILES CLOSED', width / 2, 38);

    // Loose Briefcase
    if (this.briefcaseCarrier === null) {
      ctx.fillStyle = '#D97706';
      ctx.fillRect(this.briefcaseX - 12, this.briefcaseY - 8, 24, 16);
      ctx.strokeStyle = '#FDE68A';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.briefcaseX - 12, this.briefcaseY - 8, 24, 16);
    }

    // Agents
    const active = this.getActivePlayers();
    for (const p of active) {
      const a = this.agents.get(p.id);
      if (!a) continue;

      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);

      // Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      // Heading arrow
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(6, -6);
      ctx.lineTo(6, 6);
      ctx.closePath();
      ctx.fill();

      // Carrying Briefcase icon
      if (a.hasBriefcase) {
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(-6, -18, 12, 8);
      }

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${Math.floor(a.score)}`, a.x, a.y - 20);
    }

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`BRIEFCASE SNATCH: ${Math.ceil(this.roundTimer)}s`, width / 2, 70);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: Math.floor(this.agents.get(p.id)?.score || 0),
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} escaped the subway with top secret files!` : 'The briefcases were lost in transit!'
    };
  }
}
