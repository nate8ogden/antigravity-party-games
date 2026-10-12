import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Vine {
  anchorX: number;
  anchorY: number;
  length: number;
  angle: number;
  angularVel: number;
}

interface CanopyFruit {
  x: number;
  y: number;
  type: 'BANANA' | 'PAPAYA';
  points: number;
  collected: boolean;
}

interface JumperState {
  id: PlayerId;
  vineIndex: number; // -1 if airborne
  vineProgress: number; // 0 to 1 position along vine
  x: number;
  y: number;
  vx: number;
  vy: number;
  combo: number;
  respawnTimer: number;
  score: number;
}

export class VineSwingCanopyGame extends BaseGame {
  private vines: Vine[] = [];
  private fruits: CanopyFruit[] = [];
  private playersState: Map<PlayerId, JumperState> = new Map();
  private waterfallOffset: number = 0;

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
    this.vines = [];
    this.fruits = [];
    this.playersState.clear();

    // Create 6 swinging vines across the canopy
    const vineCount = 6;
    const spacing = width / (vineCount + 1);
    for (let i = 0; i < vineCount; i++) {
      this.vines.push({
        anchorX: spacing * (i + 1),
        anchorY: 50,
        length: 140 + (i % 2) * 30,
        angle: Math.sin(i * 1.2) * 0.7,
        angularVel: (i % 2 === 0 ? 1 : -1) * 2.2
      });
    }

    // Spawn tropical fruits
    for (let i = 0; i < vineCount - 1; i++) {
      const midX = (this.vines[i].anchorX + this.vines[i + 1].anchorX) / 2;
      this.fruits.push({
        x: midX,
        y: 110 + (i % 3) * 35,
        type: i % 2 === 0 ? 'BANANA' : 'PAPAYA',
        points: i % 2 === 0 ? 15 : 30,
        collected: false
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const vIdx = idx % this.vines.length;
      const v = this.vines[vIdx];
      const px = v.anchorX + Math.sin(v.angle) * v.length;
      const py = v.anchorY + Math.cos(v.angle) * v.length;

      this.playersState.set(p.id, {
        id: p.id,
        vineIndex: vIdx,
        vineProgress: 1.0,
        x: px,
        y: py,
        vx: 0,
        vy: 0,
        combo: 0,
        respawnTimer: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.waterfallOffset = (this.waterfallOffset + dt * 140) % 60;
    this.updateBots(dt, width, height);

    // Update vine pendulum physics: d^2 theta / dt^2 = - (g/L) * sin(theta)
    const gravity = 18;
    for (let i = 0; i < this.vines.length; i++) {
      const v = this.vines[i];
      const accel = -(gravity / (v.length / 40)) * Math.sin(v.angle);
      v.angularVel += accel * dt;
      v.angularVel *= Math.pow(0.998, dt * 60); // light air damping
      v.angle += v.angularVel * dt;
    }

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.respawnTimer > 0) {
        ps.respawnTimer -= dt;
        if (ps.respawnTimer <= 0) {
          // Respawn onto random vine
          ps.vineIndex = Math.floor(Math.random() * this.vines.length);
          ps.combo = 0;
        }
        continue;
      }

      if (ps.vineIndex >= 0) {
        // Clinging to vine
        const v = this.vines[ps.vineIndex];
        ps.x = v.anchorX + Math.sin(v.angle) * (v.length * ps.vineProgress);
        ps.y = v.anchorY + Math.cos(v.angle) * (v.length * ps.vineProgress);

        // Tap to release vine
        if (this.input.justPressed(p.id)) {
          // Tangential release velocity
          const tangentialSpeed = v.angularVel * (v.length * ps.vineProgress);
          ps.vx = Math.cos(v.angle) * tangentialSpeed;
          ps.vy = -Math.sin(v.angle) * tangentialSpeed;

          // Add a forward boost in swing direction
          ps.vx += Math.sign(v.angularVel) * 120;
          ps.vy -= 110;

          ps.vineIndex = -1; // airborne!
          this.audio.playWhoosh();
          this.particles.spawnDust(ps.x, ps.y, 4);
        }
      } else {
        // Airborne trajectory
        ps.vy += 480 * dt; // gravity
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;

        // Wrap or clamp horizontal boundaries
        if (ps.x < 30) {
          ps.x = 30;
          ps.vx = Math.abs(ps.vx) * 0.7;
        } else if (ps.x > width - 30) {
          ps.x = width - 30;
          ps.vx = -Math.abs(ps.vx) * 0.7;
        }

        // Snatch fruits in midair
        for (const fruit of this.fruits) {
          if (!fruit.collected && Math.hypot(ps.x - fruit.x, ps.y - fruit.y) < 26) {
            fruit.collected = true;
            ps.score += fruit.points;
            this.audio.playScore();
            this.particles.showFloatingText(`+${fruit.points}`, fruit.x, fruit.y - 18, '#F59E0B', 20);
            this.particles.spawnConfetti(fruit.x, fruit.y, 8);
          }
        }

        // Check grabbing an adjacent vine
        for (let i = 0; i < this.vines.length; i++) {
          const v = this.vines[i];
          const tipX = v.anchorX + Math.sin(v.angle) * v.length;
          const tipY = v.anchorY + Math.cos(v.angle) * v.length;
          const distToTip = Math.hypot(ps.x - tipX, ps.y - tipY);

          if (distToTip < 32 && ps.vy > -50) {
            // Caught vine!
            ps.vineIndex = i;
            ps.vineProgress = 1.0;
            ps.combo++;
            const pts = 20 * ps.combo;
            ps.score += pts;

            // Transfer linear momentum into pendulum angular velocity
            v.angularVel += (ps.vx / v.length) * 0.8;

            this.audio.playBounce();
            this.particles.showFloatingText(`SWING x${ps.combo}! +${pts}`, tipX, tipY - 24, p.color, 20);
            this.particles.spawnConfetti(tipX, tipY, 6);
            break;
          }
        }

        // Fall into canopy gorge
        if (ps.y > height + 20) {
          ps.respawnTimer = 1.2;
          ps.combo = 0;
          this.audio.playStun();
          this.particles.showFloatingText('FELL!', ps.x, height - 30, '#EF4444', 18);
        }
      }
    }

    // Respawn collected fruits after delay
    if (this.fruits.every((f) => f.collected)) {
      for (const f of this.fruits) f.collected = false;
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Prehistoric Jungle Canopy & Waterfall
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#064E3B');
    bgGrad.addColorStop(0.5, '#065F46');
    bgGrad.addColorStop(1, '#022C22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Deep Gorge Waterfall in backdrop
    const wfX = width * 0.5;
    const wfW = 90;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.fillRect(wfX - wfW / 2, 0, wfW, height);

    // Water flow lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    for (let y = this.waterfallOffset; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(wfX - 35, y);
      ctx.lineTo(wfX - 35, y + 20);
      ctx.moveTo(wfX + 15, y + 10);
      ctx.lineTo(wfX + 15, y + 30);
      ctx.stroke();
    }

    // Heavy Jungle Overhead Tree Branch
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.ellipse(width / 2, 45, width * 0.55, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Jungle leaves hanging from branch
    ctx.fillStyle = '#10B981';
    for (let x = 30; x < width; x += 45) {
      ctx.beginPath();
      ctx.ellipse(x, 58, 16, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Draw Fruits
    for (const f of this.fruits) {
      if (f.collected) continue;
      ctx.save();
      ctx.translate(f.x, f.y);

      if (f.type === 'BANANA') {
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(0, 0, 10, -0.2, Math.PI * 0.8, false);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#FBBF24';
        ctx.stroke();
      } else {
        // Papaya
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#84CC16';
        ctx.beginPath();
        ctx.arc(0, -6, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Draw Swinging Liana Vines
    for (let i = 0; i < this.vines.length; i++) {
      const v = this.vines[i];
      const tipX = v.anchorX + Math.sin(v.angle) * v.length;
      const tipY = v.anchorY + Math.cos(v.angle) * v.length;

      // Vine rope
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(v.anchorX, v.anchorY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Vine leaves along rope
      ctx.fillStyle = '#34D399';
      for (let step = 0.25; step <= 0.85; step += 0.3) {
        const lx = v.anchorX + Math.sin(v.angle) * (v.length * step);
        const ly = v.anchorY + Math.cos(v.angle) * (v.length * step);
        ctx.beginPath();
        ctx.ellipse(lx + 4, ly, 6, 3, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Vine end knot
      ctx.fillStyle = '#047857';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || ps.respawnTimer > 0) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Player circle body
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = ps.combo > 1 ? 14 : 6;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Safari explorer hat
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.ellipse(0, -11, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-6, -18, 12, 8);

      ctx.restore();

      // Player score tag
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const comboStr = ps.combo > 1 ? ` (x${ps.combo})` : '';
      ctx.fillText(`${p.name}: ${ps.score}${comboStr}`, ps.x, ps.y - 26);
    }

    // 5. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.respawnTimer > 0 || ps.vineIndex < 0) return;

    const v = this.vines[ps.vineIndex];
    // Release when vine is swinging forward and near optimal release angle
    const targetAngle = difficulty === 'bot_hard' ? 0.35 : difficulty === 'bot_normal' ? 0.25 : 0.15;
    const isSwingingForward = v.angularVel > 0.8;

    if (isSwingingForward && v.angle > targetAngle) {
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
      mvpHighlight: winnerId ? `${winnerId} swung flawlessly across the jungle canopy!` : 'Tied canopy swings!'
    };
  }
}
