import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Gondola {
  wheelIndex: 0 | 1;
  angle: number;
  x: number;
  y: number;
  hasPrize: boolean;
  prizePoints: number;
}

interface WheelPlayer {
  id: PlayerId;
  wheelIndex: 0 | 1;
  gondolaIndex: number;
  jumping: boolean;
  jumpProgress: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fallRespawnTimer: number;
  score: number;
}

export class FerrisWheelHopGame extends BaseGame {
  private wheels: { cx: number; cy: number; radius: number; rotSpeed: number; angle: number }[] = [];
  private gondolas: Gondola[] = [];
  private playersState: Map<PlayerId, WheelPlayer> = new Map();

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
    this.gondolas = [];

    const r = Math.min(130, width * 0.22);
    const cy = height * 0.5;

    // Two adjacent counter-rotating wheels
    this.wheels = [
      { cx: width * 0.35, cy, radius: r, rotSpeed: 0.8, angle: 0 },
      { cx: width * 0.65, cy, radius: r, rotSpeed: -0.8, angle: Math.PI / 8 }
    ];

    const countPerWheel = 8;
    for (let wIdx = 0; wIdx < 2; wIdx++) {
      for (let i = 0; i < countPerWheel; i++) {
        const a = (i / countPerWheel) * Math.PI * 2;
        this.gondolas.push({
          wheelIndex: wIdx as 0 | 1,
          angle: a,
          x: 0,
          y: 0,
          hasPrize: i % 2 === 0,
          prizePoints: i === 0 ? 30 : 15
        });
      }
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        wheelIndex: idx % 2 === 0 ? 0 : 1,
        gondolaIndex: (idx * 2) % countPerWheel,
        jumping: false,
        jumpProgress: 0,
        fromX: 0,
        fromY: 0,
        toX: 0,
        toY: 0,
        fallRespawnTimer: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Rotate wheels and calculate gondola positions
    for (let wIdx = 0; wIdx < 2; wIdx++) {
      const w = this.wheels[wIdx];
      w.angle += w.rotSpeed * dt;
    }

    for (const g of this.gondolas) {
      const w = this.wheels[g.wheelIndex];
      const curAngle = w.angle + g.angle;
      g.x = w.cx + Math.cos(curAngle) * w.radius;
      g.y = w.cy + Math.sin(curAngle) * w.radius;
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.fallRespawnTimer > 0) {
        ps.fallRespawnTimer -= dt;
        continue;
      }

      if (ps.jumping) {
        ps.jumpProgress += dt * 3.2;
        if (ps.jumpProgress >= 1.0) {
          ps.jumping = false;
          // Award jump landing
          ps.score += 20;
          this.audio.playBounce();
          this.particles.showFloatingText('+20 HOP!', ps.toX, ps.toY - 18, p.color, 18);
        }
      } else {
        // Player sits on current gondola
        const gList = this.gondolas.filter((g) => g.wheelIndex === ps.wheelIndex);
        const curG = gList[ps.gondolaIndex % gList.length];

        // Snatch prize ribbon if on gondola
        if (curG && curG.hasPrize) {
          curG.hasPrize = false;
          ps.score += curG.prizePoints;
          this.audio.playScore();
          this.particles.showFloatingText(`+${curG.prizePoints}`, curG.x, curG.y - 18, '#FBBF24', 20);
          this.particles.spawnConfetti(curG.x, curG.y, 8);
        }

        // Tap to Leap to adjacent wheel!
        const tap = this.input.justPressed(p.id);
        if (tap) {
          const otherWheelIdx = (ps.wheelIndex === 0 ? 1 : 0) as 0 | 1;
          const otherGondolas = this.gondolas.filter((g) => g.wheelIndex === otherWheelIdx);

          // Find nearest gondola on target wheel
          let nearestG: Gondola | null = null;
          let minDist = 999;
          for (let i = 0; i < otherGondolas.length; i++) {
            const og = otherGondolas[i];
            const d = Math.hypot(og.x - curG.x, og.y - curG.y);
            if (d < minDist) {
              minDist = d;
              nearestG = og;
            }
          }

          if (nearestG && minDist < 140) {
            // Successful leap
            ps.jumping = true;
            ps.jumpProgress = 0;
            ps.fromX = curG.x;
            ps.fromY = curG.y;
            ps.toX = nearestG.x;
            ps.toY = nearestG.y;
            ps.wheelIndex = otherWheelIdx;
            ps.gondolaIndex = otherGondolas.indexOf(nearestG);
            this.audio.playBoost();
          } else {
            // Mis-timed jump -> Fall to safety net!
            ps.fallRespawnTimer = 1.0;
            this.audio.playWhoosh();
            this.particles.showFloatingText('MISSED!', curG.x, curG.y - 20, '#EF4444', 20);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Starlit Carnival Fairground Sky
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Safety net at bottom
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, height - 35, width, 35);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(0, height - 35, width, 35);
    ctx.setLineDash([]);

    // 2. Draw Ferris Wheel Frameworks
    for (const w of this.wheels) {
      ctx.save();
      ctx.translate(w.cx, w.cy);

      // Support A-Frame Trestle
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-w.radius * 0.7, w.radius + 35);
      ctx.moveTo(0, 0);
      ctx.lineTo(w.radius * 0.7, w.radius + 35);
      ctx.stroke();

      // Outer rim
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, w.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Spokes
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = w.angle + (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * w.radius, Math.sin(a) * w.radius);
        ctx.stroke();
      }

      // Center Hub
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Draw Gondolas (Swinging passenger buckets)
    for (const g of this.gondolas) {
      ctx.save();
      ctx.translate(g.x, g.y);

      // Gondola basket
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-14, 0, 28, 18);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(-14, 0, 28, 18);

      // Canopy roof
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(16, 0);
      ctx.lineTo(0, -10);
      ctx.closePath();
      ctx.fill();

      // Golden Prize Ribbon
      if (g.hasPrize) {
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(0, 8, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Draw Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || ps.fallRespawnTimer > 0) continue;

      let px = 0;
      let py = 0;

      if (ps.jumping) {
        const t = ps.jumpProgress;
        px = ps.fromX + (ps.toX - ps.fromX) * t;
        py = ps.fromY + (ps.toY - ps.fromY) * t - Math.sin(t * Math.PI) * 50;
      } else {
        const gList = this.gondolas.filter((g) => g.wheelIndex === ps.wheelIndex);
        const curG = gList[ps.gondolaIndex % gList.length];
        if (curG) {
          px = curG.x;
          py = curG.y + 6;
        }
      }

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, px, py - 20);
    }

    // 5. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 35);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.jumping || ps.fallRespawnTimer > 0) return;

    const gList = this.gondolas.filter((g) => g.wheelIndex === ps.wheelIndex);
    const curG = gList[ps.gondolaIndex % gList.length];
    if (!curG) return;

    const otherWheelIdx = (ps.wheelIndex === 0 ? 1 : 0) as 0 | 1;
    const otherGondolas = this.gondolas.filter((g) => g.wheelIndex === otherWheelIdx);

    // Check distance to closest opposite gondola
    let minDist = 999;
    for (const og of otherGondolas) {
      const d = Math.hypot(og.x - curG.x, og.y - curG.y);
      if (d < minDist) minDist = d;
    }

    const threshold = difficulty === 'bot_hard' ? 95 : difficulty === 'bot_normal' ? 85 : 70;
    if (minDist < threshold) {
      this.input.setBotInput(botId, true, 0, 0, true);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} soared across high ferris gondolas!` : 'A tied ferris spin!'
    };
  }
}
