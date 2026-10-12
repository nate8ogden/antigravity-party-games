import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CyberSamurai {
  id: PlayerId;
  x: number;
  y: number;
  facing: number; // 1 or -1
  isGuarding: boolean;
  isSlashing: boolean;
  slashT: number;
  staggerTimer: number;
  hp: number;
  score: number;
  animTimer: number;
}

export class CyberSamuraiSlashGame extends BaseGame {
  public samurais: Map<PlayerId, CyberSamurai> = new Map();
  public currentMapName: string = 'Neo-Shinjuku Rooftop Garden';
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
    this.samurais.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      let x = width * 0.25;
      let y = height * 0.45;
      let facing = 1;

      if (count === 2) {
        x = idx === 0 ? width * 0.3 : width * 0.7;
        y = height * 0.55;
        facing = idx === 0 ? 1 : -1;
      } else {
        if (idx === 1) { x = width * 0.75; y = height * 0.45; facing = -1; }
        if (idx === 2) { x = width * 0.25; y = height * 0.75; facing = 1; }
        if (idx === 3) { x = width * 0.75; y = height * 0.75; facing = -1; }
      }

      this.samurais.set(p.id, {
        id: p.id,
        x,
        y,
        facing,
        isGuarding: false,
        isSlashing: false,
        slashT: 0,
        staggerTimer: 0,
        hp: 100,
        score: 0,
        animTimer: 0
      });

      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.3);
    });
  }

  public update(dt: number, _w: number, _h: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, _w, _h);

    this.samurais.forEach(s => {
      s.animTimer += dt;
      if (s.staggerTimer > 0) {
        s.staggerTimer -= dt;
        s.isGuarding = false;
        s.isSlashing = false;
        return;
      }

      // Check input: Tap = slash dash, Hold = cyber energy guard
      const isHolding = this.input.isPressed(s.id);
      const justTapped = this.input.justPressed(s.id);

      if (justTapped && !s.isSlashing) {
        // Execute swift energy slash
        s.isSlashing = true;
        s.slashT = 0;
        s.isGuarding = false;
        this.audio.playTone(680, 0.08, 'sawtooth');
      } else if (isHolding && !s.isSlashing) {
        s.isGuarding = true;
      } else {
        s.isGuarding = false;
      }

      // Progress slash animation
      if (s.isSlashing) {
        s.slashT += dt * 5.0; // ~0.2s duration
        if (s.slashT >= 1.0) {
          s.isSlashing = false;
          s.slashT = 0;
        }

        // Hit detection during mid-slash
        if (s.slashT >= 0.3 && s.slashT <= 0.7) {
          const slashReach = 55;
          const slashX = s.x + s.facing * slashReach;

          this.samurais.forEach(target => {
            if (target.id === s.id || target.hp <= 0) return;
            const dist = Math.hypot(target.x - slashX, target.y - s.y);
            if (dist < 40) {
              if (target.isGuarding) {
                // Parried by target!
                s.staggerTimer = 0.8;
                s.isSlashing = false;
                this.audio.playTone(220, 0.2, 'square');
                this.particles.emit((s.x + target.x) * 0.5, s.y, 14, '#00ffff');
              } else if (!target.isSlashing) {
                // Clean hit on unshielded target!
                target.hp -= 25;
                s.score += 35;
                this.audio.playTone(850, 0.15, 'sawtooth');
                this.particles.emit(target.x, target.y, 18, '#ff0055');

                if (target.hp <= 0) {
                  target.hp = 0;
                  s.score += 50;
                  this.particles.emit(target.x, target.y, 30, '#ffd700');
                }
              }
            }
          });
        }
      }
    });

    // Check round over condition (1 or 0 samurais alive in multi-player)
    let alive = 0;
    this.samurais.forEach(s => { if (s.hp > 0) alive++; });
    if (alive <= 1 && this.getActivePlayers().length > 1) {
      this.finishRound();
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const s = this.samurais.get(botId);
    if (!s || s.hp <= 0 || s.staggerTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    // Find nearest opponent
    let nearest: CyberSamurai | null = null;
    let minDist = 9999;
    this.samurais.forEach(other => {
      if (other.id !== botId && other.hp > 0) {
        const d = Math.hypot(other.x - s.x, other.y - s.y);
        if (d < minDist) {
          minDist = d;
          nearest = other;
        }
      }
    });

    if (nearest) {
      // If opponent is slashing, attempt guard parry
      if ((nearest as CyberSamurai).isSlashing && minDist < 90) {
        const parryChance = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.75 : 0.40;
        if (Math.random() < parryChance) {
          this.input.setBotState(botId, true); // Hold guard
          this.botReactionTimers.set(botId, 0.3);
          return;
        }
      }

      // If in strike range, slash!
      if (minDist < 80) {
        const slashChance = difficulty === 'bot_hard' ? 0.90 : difficulty === 'bot_normal' ? 0.70 : 0.50;
        if (Math.random() < slashChance) {
          this.input.triggerBotPress(botId);
          this.botReactionTimers.set(botId, 0.45);
          return;
        }
      }
    }

    this.input.setBotState(botId, false);
    this.botReactionTimers.set(botId, 0.1);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Cyberpunk Neon Rain Skyline
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a0514');
    grad.addColorStop(0.5, '#160d29');
    grad.addColorStop(1, '#0c0717');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Neon skyscraper silhouettes & holographic ads
    ctx.save();
    ctx.fillStyle = 'rgba(255, 0, 128, 0.08)';
    ctx.fillRect(width * 0.1, 40, 50, height);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.08)';
    ctx.fillRect(width * 0.7, 60, 60, height);
    ctx.restore();

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
    ctx.fillText('TAP: SWIFT KATANA SLASH | HOLD: ENERGY PARRY SHIELD', width * 0.5, 69);
    ctx.restore();

    // Render Samurais
    this.samurais.forEach(s => {
      if (s.hp <= 0) return;
      const cfg = this.players.find(p => p.id === s.id);
      const isStaggered = s.staggerTimer > 0;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.facing, 1);

      // Cyber Armor Body
      ctx.fillStyle = isStaggered ? '#555555' : '#1e1b2e';
      ctx.fillRect(-10, -22, 20, 32);

      // Neon cyber trim
      ctx.strokeStyle = cfg?.color || '#ff007f';
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -22, 20, 32);

      // Cyber Helmet & Visor
      ctx.fillStyle = '#110e1c';
      ctx.beginPath();
      ctx.arc(0, -30, 8, 0, Math.PI * 2);
      ctx.fill();
      // Glowing Neon Visor
      ctx.fillStyle = cfg?.color || '#00ffff';
      ctx.fillRect(2, -32, 6, 3);

      // Energy Parry Shield
      if (s.isGuarding) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(16, -10, 24, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Energy Katana Blade
      ctx.save();
      if (s.isSlashing) {
        // Slash arc sweep
        const slashAngle = -Math.PI * 0.4 + s.slashT * Math.PI * 0.9;
        ctx.rotate(slashAngle);
        ctx.strokeStyle = cfg?.color || '#ff007f';
        ctx.lineWidth = 4;
        ctx.shadowColor = cfg?.color || '#ff007f';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(8, -12);
        ctx.lineTo(48, -12);
        ctx.stroke();
      } else {
        // Sheathed or ready stance
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-4, -4);
        ctx.lineTo(16, 8);
        ctx.stroke();
      }
      ctx.restore();

      // Stagger alert
      if (isStaggered) {
        ctx.fillStyle = '#ff4400';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PARRIED!', 0, -44);
      }

      ctx.restore();

      // HP Bar & Name
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(s.x - 24, s.y - 48, 48, 5);
      ctx.fillStyle = s.hp > 50 ? '#00ffcc' : s.hp > 25 ? '#ffcc00' : '#ff0055';
      ctx.fillRect(s.x - 24, s.y - 48, 48 * (s.hp / 100), 5);

      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name || 'Player'}: ${s.score}`, s.x, s.y + 24);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.samurais.forEach((s, pId) => scores.set(pId, s.score + (s.hp > 0 ? 50 : 0)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.samurais.entries())
      .map(([playerId, s]) => ({ playerId, score: s.score + (s.hp > 0 ? 50 : 0), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} executed the supreme cyber-katana flurry!` : 'Duel ended in static!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
