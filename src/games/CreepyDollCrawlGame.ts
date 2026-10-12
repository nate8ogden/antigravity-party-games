import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Cobweb {
  x: number;
  y: number;
  radius: number;
}

interface CreepyDoll {
  id: PlayerId;
  x: number;
  y: number;
  targetY: number;
  springTension: number; // 0 to 120
  isWinding: boolean;
  crawlSpeed: number;
  stunTimer: number;
  score: number;
  laps: number;
  keyAngle: number;
  wobble: number;
}

export class CreepyDollCrawlGame extends BaseGame {
  private playersState: Map<PlayerId, CreepyDoll> = new Map();
  private cobwebs: Cobweb[] = [];
  private trackLength: number = 2000;

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
    this.cobwebs = [];

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / (count + 1);

    active.forEach((p, idx) => {
      const ly = 70 + laneHeight * (idx + 1);
      this.playersState.set(p.id, {
        id: p.id,
        x: 60,
        y: ly,
        targetY: ly,
        springTension: 0,
        isWinding: false,
        crawlSpeed: 0,
        stunTimer: 0,
        score: 0,
        laps: 0,
        keyAngle: 0,
        wobble: 0
      });
    });

    // Spawn some cobwebs along lanes
    for (let i = 0; i < 6; i++) {
      this.cobwebs.push({
        x: 180 + Math.random() * (width - 300),
        y: 80 + Math.random() * (height - 140),
        radius: 20
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const doll = this.playersState.get(p.id);
      if (!doll) continue;

      if (doll.stunTimer > 0) {
        doll.stunTimer -= dt;
        doll.crawlSpeed = 0;
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const isPressed = this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Vertical lane steering
      doll.y += steer * 70 * dt;
      doll.y = Math.max(60, Math.min(height - 40, doll.y));

      // Winding mechanics
      if (isPressed) {
        doll.isWinding = true;
        doll.springTension += dt * 65; // ~1.5s to reach 100
        doll.keyAngle += dt * 15;

        if (Math.random() < 0.12) {
          this.audio.playSqueak();
        }

        // Overwound SNAP check!
        if (doll.springTension > 105) {
          doll.springTension = 0;
          doll.stunTimer = 1.6;
          doll.crawlSpeed = 0;
          this.audio.playExplosion();
          this.particles.shake(0.3);
          this.particles.emit(doll.x, doll.y, 14, '#ef4444');
        }
      } else if (justReleased) {
        doll.isWinding = false;
        // Release spring into forward propulsion
        if (doll.springTension >= 80 && doll.springTension <= 100) {
          // Sweet spot! TURBO!
          doll.crawlSpeed = 320;
          this.audio.playBoost();
          this.particles.emit(doll.x - 15, doll.y, 12, '#38bdf8');
        } else {
          // Standard release
          doll.crawlSpeed = doll.springTension * 2.2;
          this.audio.playWhoosh();
        }
        doll.springTension = 0;
      } else {
        doll.isWinding = false;
      }

      // Crawl forward
      if (doll.crawlSpeed > 0) {
        doll.crawlSpeed = Math.max(0, doll.crawlSpeed - dt * 130);
        doll.x += doll.crawlSpeed * dt;
        doll.wobble += dt * 16;
        doll.keyAngle += dt * (doll.crawlSpeed / 30);

        // Check cobweb slowdown
        for (const web of this.cobwebs) {
          const dist = Math.hypot(doll.x - web.x, doll.y - web.y);
          if (dist < web.radius + 15) {
            doll.crawlSpeed *= 0.5; // Web slows down
          }
        }

        // Loop / Lap check
        if (doll.x > width - 50) {
          doll.x = 50;
          doll.laps++;
          doll.score += 10;
          this.audio.playScore();
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
    const doll = this.playersState.get(botId);
    if (!doll || doll.stunTimer > 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    const tensionLimit = difficulty === 'bot_easy' ? 62 : difficulty === 'bot_normal' ? 84 : 94;
    let press = false;
    if (doll.springTension < tensionLimit && doll.crawlSpeed < 45) {
      press = true;
    }

    // Steer away from cobwebs directly ahead
    let steerY = 0;
    const canDodge = difficulty === 'bot_easy' ? Math.random() < 0.65 : true;
    if (canDodge) {
      for (const web of this.cobwebs) {
        if (web.x > doll.x && web.x - doll.x < 120 && Math.abs(web.y - doll.y) < 25) {
          steerY = doll.y > web.y ? 1 : -1;
          break;
        }
      }
    }

    this.input.setBotInput(botId, press, 0, steerY);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Dusty Attic Wooden Floor
    ctx.fillStyle = '#271c19';
    ctx.fillRect(0, 0, width, height);

    // Plank lines
    ctx.strokeStyle = '#3e2d27';
    ctx.lineWidth = 1.5;
    for (let y = 50; y < height; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Cobwebs
    for (const web of this.cobwebs) {
      ctx.save();
      ctx.translate(web.x, web.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;

      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * web.radius, Math.sin(a) * web.radius);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, web.radius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Finish line tape
    const finishX = width - 50;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(finishX, 50);
    ctx.lineTo(finishX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Render Dolls
    for (const p of this.getActivePlayers()) {
      const doll = this.playersState.get(p.id);
      if (!doll) continue;

      ctx.save();
      const wobbleOffset = doll.crawlSpeed > 0 ? Math.sin(doll.wobble) * 3 : 0;
      ctx.translate(doll.x, doll.y + wobbleOffset);

      // Winding key on back
      ctx.save();
      ctx.translate(-14, 0);
      ctx.rotate(doll.keyAngle);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-2, -10, 4, 20);
      ctx.beginPath();
      ctx.arc(0, -10, 5, 0, Math.PI * 2);
      ctx.arc(0, 10, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Doll dress / body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-10, -12);
      ctx.lineTo(8, -8);
      ctx.lineTo(8, 8);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();

      // Porcelain cracked head
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(14, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Button eyes (black cross stitch)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(14, -4, 2.5, 0, Math.PI * 2);
      ctx.arc(14, 4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Rosy doll cheeks
      ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.beginPath();
      ctx.arc(17, -5, 2, 0, Math.PI * 2);
      ctx.arc(17, 5, 2, 0, Math.PI * 2);
      ctx.fill();

      // Little doll crawling limbs
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.arc(-2, -13, 4, 0, Math.PI * 2);
      ctx.arc(-2, 13, 4, 0, Math.PI * 2);
      ctx.fill();

      // Stunned indicator
      if (doll.stunTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*SNAPPED!*', 0, -22);
      }

      ctx.restore();

      // Tension Meter above doll
      if (doll.springTension > 0) {
        const barW = 40;
        const barH = 5;
        const bx = doll.x - barW / 2;
        const by = doll.y - 25;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx, by, barW, barH);

        const ratio = Math.min(1, doll.springTension / 100);
        ctx.fillStyle = doll.springTension > 80 ? '#22c55e' : '#fbbf24';
        ctx.fillRect(bx, by, barW * ratio, barH);
      }

      // HUD Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: Lap ${doll.laps}`, doll.x, doll.y + 25);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(24, 18, 16, 0.9)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CREEPY DOLL CRAWL', 16, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#f8fafc';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 24);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, doll]) => ({
        playerId,
        score: doll.score + Math.floor(doll.x / 10),
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} wound up the fastest porcelain crawler!` : 'All the dolls wound down...'
    };
  }
}
