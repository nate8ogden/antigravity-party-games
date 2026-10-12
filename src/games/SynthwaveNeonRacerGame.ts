import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface NeonTraffic {
  x: number;
  y: number;
  speed: number;
  color: string;
  isBoostPad: boolean;
}

interface RacerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  score: number;
  boostTimer: number;
  stunTimer: number;
}

export class SynthwaveNeonRacerGame extends BaseGame {
  private playersState: Map<PlayerId, RacerPlayer> = new Map();
  private traffic: NeonTraffic[] = [];
  private gridOffset: number = 0;
  private spawnTimer: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.playersState.clear();
    this.traffic = [];
    this.gridOffset = 0;
    this.spawnTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = (width - 120) / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: 60 + spacing * (idx + 1),
        y: height - 55,
        vx: 0,
        score: 0,
        boostTimer: 0,
        stunTimer: 0
      });
    });

    for (let i = 0; i < 4; i++) {
      this.spawnTraffic(width, height, 100 + i * 80);
    }
  }

  private spawnTraffic(width: number, _height: number, startY: number = -40): void {
    const isPad = Math.random() < 0.25;
    const colors = ['#f43f5e', '#38bdf8', '#a855f7', '#fbbf24'];
    this.traffic.push({
      x: 70 + Math.random() * (width - 140),
      y: startY,
      speed: isPad ? 140 : 80 + Math.random() * 60,
      color: colors[Math.floor(Math.random() * colors.length)],
      isBoostPad: isPad
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);
    this.gridOffset = (this.gridOffset + dt * 180) % 40;

    // Traffic spawning
    this.spawnTimer += dt;
    if (this.spawnTimer > 0.8) {
      this.spawnTimer = 0;
      this.spawnTraffic(width, height);
    }

    // Update Traffic
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const t = this.traffic[i];
      t.y += t.speed * dt;
      if (t.y > height + 40) {
        this.traffic.splice(i, 1);
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      if (ps.boostTimer > 0) {
        ps.boostTimer -= dt;
      }

      const steer = this.input.getSteer(p.id);
      const isPressed = this.input.isPressed(p.id);

      const moveSpeed = ps.boostTimer > 0 ? 280 : (isPressed ? 220 : 160);
      ps.x += steer * moveSpeed * dt;
      ps.x = Math.max(50, Math.min(width - 50, ps.x));

      // Continuous points for driving
      ps.score += dt * (ps.boostTimer > 0 ? 4 : 2);

      // Collisions with traffic / boost pads
      for (let i = this.traffic.length - 1; i >= 0; i--) {
        const t = this.traffic[i];
        const dist = Math.hypot(ps.x - t.x, ps.y - t.y);

        if (dist < 26) {
          if (t.isBoostPad) {
            ps.boostTimer = 2.0;
            ps.score += 5;
            this.audio.playBoost();
            this.particles.emit(t.x, t.y, 14, '#38bdf8');
            this.traffic.splice(i, 1);
          } else {
            // Crash
            ps.stunTimer = 1.0;
            ps.score = Math.max(0, ps.score - 4);
            ps.boostTimer = 0;
            this.audio.playExplosion();
            this.particles.shake(0.3);
            this.particles.emit(ps.x, ps.y, 16, '#f43f5e');
            this.traffic.splice(i, 1);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    // Scan traffic ahead
    let avoidSteer = 0;
    let seekPad = false;
    const scanDist = difficulty === 'bot_easy' ? 95 : difficulty === 'bot_normal' ? 150 : 200;
    const canDodge = difficulty === 'bot_easy' ? Math.random() < 0.70 : true;

    for (const t of this.traffic) {
      const dy = ps.y - t.y;
      const dx = t.x - ps.x;
      if (dy > 0 && dy < scanDist && Math.abs(dx) < 40) {
        if (t.isBoostPad) {
          avoidSteer = Math.sign(dx);
          seekPad = true;
          break;
        } else if (canDodge) {
          // Obstacle! Steer away
          avoidSteer = dx > 0 ? -1 : 1;
          break;
        }
      }
    }

    this.input.setBotInput(botId, seekPad || ps.boostTimer > 0, avoidSteer, 0);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Synthwave Neon Twilight Gradient
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#090514');
    sky.addColorStop(0.45, '#2e0854');
    sky.addColorStop(0.55, '#831843');
    sky.addColorStop(1, '#05020c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // Giant 80s Wireframe Synth Sun
    const sunY = 75;
    const sunR = 40;
    const sunGrad = ctx.createLinearGradient(width / 2, sunY - sunR, width / 2, sunY + sunR);
    sunGrad.addColorStop(0, '#fde047');
    sunGrad.addColorStop(0.6, '#f43f5e');
    sunGrad.addColorStop(1, '#a855f7');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(width / 2, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal sun laser blinds
    ctx.fillStyle = '#2e0854';
    for (let i = 0; i < 6; i++) {
      const slitY = sunY + 6 + i * 5;
      ctx.fillRect(width / 2 - sunR, slitY, sunR * 2, 2 + i * 0.5);
    }

    // Perspective Wireframe Grid Highway
    const roadTop = 130;
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 1.5;

    // Road borders
    ctx.beginPath();
    ctx.moveTo(width / 2 - 30, roadTop);
    ctx.lineTo(30, height);
    ctx.moveTo(width / 2 + 30, roadTop);
    ctx.lineTo(width - 30, height);
    ctx.stroke();

    // Perspective horizontal grid rungs
    for (let y = roadTop; y < height; y += 22) {
      const curY = y + (this.gridOffset * ((y - roadTop) / (height - roadTop)));
      if (curY <= height) {
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, curY);
        ctx.lineTo(width, curY);
        ctx.stroke();
      }
    }

    // Render Boost Pads & Traffic
    for (const t of this.traffic) {
      if (t.isBoostPad) {
        // Neon chevron pad
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(t.x - 12, t.y + 8);
        ctx.lineTo(t.x, t.y - 8);
        ctx.lineTo(t.x + 12, t.y + 8);
        ctx.stroke();
      } else {
        // Wireframe Cyber Cruiser
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(t.x - 12, t.y - 18, 24, 36);
        ctx.fillStyle = t.color;
        ctx.fillRect(t.x - 8, t.y - 12, 16, 8);
        // Taillights
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(t.x - 10, t.y + 14, 4, 3);
        ctx.fillRect(t.x + 6, t.y + 14, 4, 3);
      }
    }

    // Render Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Boost Glow
      if (ps.boostTimer > 0) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
      }

      // Player Neon Wedge Car
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(14, 16);
      ctx.lineTo(8, 20);
      ctx.lineTo(-8, 20);
      ctx.lineTo(-14, 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Windshield
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(8, 6);
      ctx.lineTo(-8, 6);
      ctx.closePath();
      ctx.fill();

      // Turbo flames
      if (ps.boostTimer > 0) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-6, 20, 12, 10 + Math.random() * 8);
      }

      // Stun
      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*CRASH*', 0, -26);
      }

      ctx.restore();

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${Math.floor(ps.score)}`, ps.x, ps.y + 36);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(9, 5, 20, 0.9)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#ec4899';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SYNTHWAVE NEON RACER', 16, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#f8fafc';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 24);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: Math.floor(ps.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} blazed the fastest synthwave neon highway!` : 'Outrun sunset reached!'
    };
  }
}
