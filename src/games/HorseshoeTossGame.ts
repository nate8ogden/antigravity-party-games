import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Horseshoe {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  flightTime: number;
  targetY: number;
  landed: boolean;
  scoreAwarded: number;
}

interface PlayerThrowState {
  aimAngle: number;
  aimDir: number;
  power: number;
  powerDir: number;
  phase: 'aim' | 'power' | 'flight' | 'done';
  throwsLeft: number;
  score: number;
  horseshoe: Horseshoe | null;
}

export class HorseshoeTossGame extends BaseGame {
  private throwStates: Map<PlayerId, PlayerThrowState> = new Map();
  public windSpeed: number = 0;
  private windShiftTimer: number = 3.0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.throwStates.clear();
    this.isFinished = false;
    this.roundTimer = 25.0;
    this.shiftWind();

    for (const p of this.getActivePlayers()) {
      this.throwStates.set(p.id, {
        aimAngle: 0,
        aimDir: 1,
        power: 0.2,
        powerDir: 1,
        phase: 'aim',
        throwsLeft: 3,
        score: 0,
        horseshoe: null
      });
    }
  }

  private shiftWind(): void {
    this.windSpeed = (Math.random() - 0.5) * 60;
    this.windShiftTimer = 1.8 + Math.random() * 1.4;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.windShiftTimer -= dt;
    if (this.windShiftTimer <= 0) {
      this.shiftWind();
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    let allDone = true;

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const state = this.throwStates.get(p.id);
      if (!state) continue;

      if (state.throwsLeft > 0 || state.phase === 'flight') {
        allDone = false;
      }

      const justPressed = this.input.justPressed(p.id);

      if (state.phase === 'aim') {
        state.aimAngle += state.aimDir * 60 * dt;
        if (state.aimAngle > 30) {
          state.aimAngle = 30;
          state.aimDir = -1;
        } else if (state.aimAngle < -30) {
          state.aimAngle = -30;
          state.aimDir = 1;
        }

        if (justPressed) {
          state.phase = 'power';
          this.audio.playTone(350, 0.05, 'triangle');
        }
      } else if (state.phase === 'power') {
        state.power += state.powerDir * 1.8 * dt;
        if (state.power > 1.0) {
          state.power = 1.0;
          state.powerDir = -1;
        } else if (state.power < 0.1) {
          state.power = 0.1;
          state.powerDir = 1;
        }

        if (justPressed) {
          state.phase = 'flight';
          const angleRad = (state.aimAngle * Math.PI) / 180;
          const speed = 250 + state.power * 250;
          const targetY = 120 + (1 - state.power) * 160;

          state.horseshoe = {
            x: this.getLaneX(i, width, active.length),
            y: height - 60,
            vx: Math.sin(angleRad) * speed * 0.6,
            vy: -speed,
            rotation: 0,
            flightTime: 0,
            targetY,
            landed: false,
            scoreAwarded: 0
          };
          this.audio.playTone(520, 0.08, 'sine');
        }
      } else if (state.phase === 'flight' && state.horseshoe) {
        const hs = state.horseshoe;
        if (!hs.landed) {
          hs.flightTime += dt;
          hs.x += (hs.vx + this.windSpeed) * dt;
          hs.y += hs.vy * dt;
          hs.vy += 450 * dt;
          hs.rotation += 8 * dt;

          if (hs.vy > 0 && hs.y >= hs.targetY) {
            hs.landed = true;
            const stakeX = this.getLaneX(i, width, active.length);
            const stakeY = 140;
            const dist = Math.hypot(hs.x - stakeX, hs.y - stakeY);

            let pts = 0;
            if (dist < 15) {
              pts = 10;
              this.particles.emit(stakeX, stakeY, 15, '#FBBF24');
              this.audio.playTone(880, 0.2, 'sine');
            } else if (dist < 32) {
              pts = 5;
              this.particles.emit(stakeX, stakeY, 8, '#3B82F6');
              this.audio.playTone(660, 0.15, 'sine');
            } else if (dist < 55) {
              pts = 2;
              this.audio.playTone(440, 0.1, 'sine');
            } else {
              this.audio.playTone(180, 0.1, 'sawtooth');
            }

            state.score += pts;
            hs.scoreAwarded = pts;
            state.throwsLeft--;

            setTimeout(() => {
              if (state.throwsLeft > 0) {
                state.phase = 'aim';
                state.aimAngle = 0;
                state.power = 0.2;
                state.horseshoe = null;
              } else {
                state.phase = 'done';
              }
            }, 700);
          }
        }
      }
    }

    if (allDone) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const state = this.throwStates.get(botId);
    if (!state) continueOrReturn: return;

    if (state.phase === 'aim') {
      const errorMargin = difficulty === 'bot_hard' ? 4 : difficulty === 'bot_normal' ? 8 : 16;
      if (Math.abs(state.aimAngle) <= errorMargin) {
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
    } else if (state.phase === 'power') {
      const targetPower = 0.7;
      const powerMargin = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.12 : 0.22;
      if (Math.abs(state.power - targetPower) <= powerMargin) {
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
    }
  }

  private getLaneX(index: number, width: number, total: number): number {
    const laneWidth = width / Math.max(1, total);
    return laneWidth * index + laneWidth / 2;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#78350F';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const laneWidth = width / Math.max(1, active.length);

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const state = this.throwStates.get(p.id);
      if (!state) continue;
      const lx = this.getLaneX(i, width, active.length);

      ctx.fillStyle = '#D97706';
      ctx.fillRect(lx - laneWidth * 0.45, 80, laneWidth * 0.9, 120);
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 3;
      ctx.strokeRect(lx - laneWidth * 0.45, 80, laneWidth * 0.9, 120);

      ctx.fillStyle = '#E5E7EB';
      ctx.beginPath();
      ctx.arc(lx, 140, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(lx, height - 40, 16, 0, Math.PI * 2);
      ctx.fill();

      if (state.phase === 'aim') {
        const rad = ((state.aimAngle - 90) * Math.PI) / 180;
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(lx, height - 40);
        ctx.lineTo(lx + Math.cos(rad) * 90, height - 40 + Math.sin(rad) * 90);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (state.phase === 'power') {
        ctx.fillStyle = '#1F2937';
        ctx.fillRect(lx - 30, height - 75, 60, 10);
        ctx.fillStyle = state.power > 0.6 && state.power < 0.8 ? '#22C55E' : '#F59E0B';
        ctx.fillRect(lx - 30, height - 75, 60 * state.power, 10);
      }

      if (state.horseshoe) {
        const hs = state.horseshoe;
        ctx.save();
        ctx.translate(hs.x, hs.y);
        ctx.rotate(hs.rotation);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0.4 * Math.PI, 1.6 * Math.PI);
        ctx.stroke();
        ctx.restore();

        if (hs.landed && hs.scoreAwarded > 0) {
          ctx.fillStyle = '#FBBF24';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`+${hs.scoreAwarded}!`, hs.x, hs.y - 18);
        }
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${state.score} pts`, lx, 45);
      ctx.font = '11px sans-serif';
      ctx.fillText(`Throws: ${state.throwsLeft}`, lx, 62);
    }

    ctx.fillStyle = '#FDE68A';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HORSESHOE TOSS', width / 2, 22);

    // Dynamic Random Crosswind Vane Indicator
    const gustSpeed = Math.round(Math.abs(this.windSpeed));
    const gustLabel = gustSpeed < 6 ? '💨 CALM BREEZE' : `💨 GUST: ${gustSpeed} MPH ${this.windSpeed > 0 ? 'EAST ➔' : 'WEST ⬅'}`;
    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 12px Montserrat, sans-serif';
    ctx.fillText(gustLabel, width / 2, 40);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.throwStates.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} threw dead-center ringers!` : 'Horseshoes kicked up wild desert dust!'
    };
  }
}
