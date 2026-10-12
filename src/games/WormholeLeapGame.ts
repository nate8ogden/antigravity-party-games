import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface WormholePair {
  id: number;
  color: string;
  name: string;
  p1: { x: number; y: number; angle: number };
  p2: { x: number; y: number; angle: number };
  radius: number;
}

interface QuantumCrystal {
  id: number;
  x: number;
  y: number;
  value: number;
  color: string;
}

interface LeapFighter {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  combo: number;
  portalCooldown: number;
  warpBurstTimer: number;
}

export class WormholeLeapGame extends BaseGame {
  private fighters: Map<PlayerId, LeapFighter> = new Map();
  private pairs: WormholePair[] = [];
  private crystals: QuantumCrystal[] = [];
  private crystalIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.fighters.clear();
    this.crystals = [];
    this.crystalIdCounter = 0;

    // 3 paired wormholes
    this.pairs = [
      {
        id: 1,
        color: '#00E5FF',
        name: 'Cyan',
        p1: { x: width * 0.18, y: height * 0.25, angle: 0 },
        p2: { x: width * 0.82, y: height * 0.75, angle: 0 },
        radius: 30
      },
      {
        id: 2,
        color: '#E040FB',
        name: 'Magenta',
        p1: { x: width * 0.82, y: height * 0.25, angle: 0 },
        p2: { x: width * 0.18, y: height * 0.75, angle: 0 },
        radius: 30
      },
      {
        id: 3,
        color: '#FFD700',
        name: 'Amber',
        p1: { x: width * 0.5, y: height * 0.18, angle: 0 },
        p2: { x: width * 0.5, y: height * 0.82, angle: 0 },
        radius: 30
      }
    ];

    // Spawn quantum crystals
    for (let i = 0; i < 16; i++) {
      this.spawnCrystal(width, height);
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = width * 0.35 + (idx % 2) * (width * 0.3);
      const startY = height * 0.4 + Math.floor(idx / 2) * (height * 0.2);
      this.fighters.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: (idx * Math.PI) / 2,
        score: 0,
        combo: 1,
        portalCooldown: 0,
        warpBurstTimer: 0
      });
    });
  }

  private spawnCrystal(width: number, height: number): void {
    const isRare = Math.random() < 0.25;
    this.crystals.push({
      id: ++this.crystalIdCounter,
      x: 50 + Math.random() * (width - 100),
      y: 50 + Math.random() * (height - 100),
      value: isRare ? 40 : 15,
      color: isRare ? '#FFD700' : '#76FF03'
    });
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

    // Rotate wormholes
    for (const pair of this.pairs) {
      pair.p1.angle += 1.8 * dt;
      pair.p2.angle -= 1.8 * dt;
    }

    // Maintain crystals
    while (this.crystals.length < 14) {
      this.spawnCrystal(width, height);
    }

    // Update fighters
    for (const [id, f] of this.fighters.entries()) {
      if (f.portalCooldown > 0) {
        f.portalCooldown -= dt;
      }
      if (f.warpBurstTimer > 0) {
        f.warpBurstTimer -= dt;
      }

      const turnDir = this.input.getSteer(id);
      f.angle += turnDir * 3.5 * dt;

      const throttle = this.input.getThrottle(id);
      const isThrusting = throttle > 0.3 || this.input.isPressed(id);
      if (isThrusting) {
        const thrust = 220;
        f.vx += Math.cos(f.angle) * thrust * dt;
        f.vy += Math.sin(f.angle) * thrust * dt;

        this.particles.emit(
          f.x - Math.cos(f.angle) * 14,
          f.y - Math.sin(f.angle) * 14,
          2,
          '#00E5FF'
        );
      }

      // Warp burst on Action button
      if (this.input.isActionPressed(id) && f.warpBurstTimer <= 0) {
        f.warpBurstTimer = 1.2;
        f.vx += Math.cos(f.angle) * 260;
        f.vy += Math.sin(f.angle) * 260;
        this.audio.playTone(330, 0.1, 'sawtooth');
      }

      // Friction & physics
      f.vx *= Math.pow(0.96, dt * 60);
      f.vy *= Math.pow(0.96, dt * 60);
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      // Screen boundary wrap
      if (f.x < 15) f.x = width - 15;
      if (f.x > width - 15) f.x = 15;
      if (f.y < 15) f.y = height - 15;
      if (f.y > height - 15) f.y = 15;

      // Check Wormhole Teleportation
      if (f.portalCooldown <= 0) {
        for (const pair of this.pairs) {
          const d1 = Math.hypot(f.x - pair.p1.x, f.y - pair.p1.y);
          const d2 = Math.hypot(f.x - pair.p2.x, f.y - pair.p2.y);

          if (d1 < pair.radius) {
            this.teleportFighter(f, pair.p2.x, pair.p2.y, pair.color);
            break;
          } else if (d2 < pair.radius) {
            this.teleportFighter(f, pair.p1.x, pair.p1.y, pair.color);
            break;
          }
        }
      }

      // Collect crystals
      for (let i = this.crystals.length - 1; i >= 0; i--) {
        const c = this.crystals[i];
        if (Math.hypot(f.x - c.x, f.y - c.y) < 18) {
          const points = c.value * f.combo;
          f.score += points;
          this.audio.playTone(659, 0.08, 'triangle');
          this.particles.emit(c.x, c.y, 10, c.color);
          this.crystals.splice(i, 1);
        }
      }
    }
  }

  private teleportFighter(f: LeapFighter, destX: number, destY: number, color: string): void {
    this.particles.emit(f.x, f.y, 15, color);

    f.x = destX;
    f.y = destY;
    f.portalCooldown = 1.0;
    f.combo = Math.min(4, f.combo + 1);
    f.score += 25 * f.combo;

    const speed = 280;
    f.vx = Math.cos(f.angle) * speed;
    f.vy = Math.sin(f.angle) * speed;

    this.audio.playTone(880, 0.15, 'sine');
    setTimeout(() => this.audio.playTone(1174, 0.15, 'sine'), 60);

    this.particles.emit(destX, destY, 20, color);
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const f = this.fighters.get(botId);
    if (!f) return;

    let targetX = _width * 0.5;
    let targetY = _height * 0.5;
    let wantBurst = false;

    let closestPortalDist = 99999;
    let portalTarget: { x: number; y: number } | null = null;
    if (f.portalCooldown <= 0) {
      for (const pair of this.pairs) {
        const d1 = Math.hypot(pair.p1.x - f.x, pair.p1.y - f.y);
        const d2 = Math.hypot(pair.p2.x - f.x, pair.p2.y - f.y);
        if (d1 < closestPortalDist) {
          closestPortalDist = d1;
          portalTarget = pair.p1;
        }
        if (d2 < closestPortalDist) {
          closestPortalDist = d2;
          portalTarget = pair.p2;
        }
      }
    }

    if (portalTarget && closestPortalDist < 180) {
      targetX = portalTarget.x;
      targetY = portalTarget.y;
      if (closestPortalDist < 90) wantBurst = true;
    } else {
      let minDist = 99999;
      for (const c of this.crystals) {
        const d = Math.hypot(c.x - f.x, c.y - f.y);
        if (d < minDist) {
          minDist = d;
          targetX = c.x;
          targetY = c.y;
        }
      }
    }

    const desiredAngle = Math.atan2(targetY - f.y, targetX - f.x);
    let angleDiff = desiredAngle - f.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let turn = 0;
    if (angleDiff > 0.15) turn = 1;
    else if (angleDiff < -0.15) turn = -1;

    const thrust = Math.abs(angleDiff) < 1.0;

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.25) wantBurst = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, thrust, turn, thrust ? 1 : 0, wantBurst);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Quantum void background
    ctx.fillStyle = '#050410';
    ctx.fillRect(0, 0, width, height);

    // Render Wormholes
    for (const pair of this.pairs) {
      this.renderSinglePortal(ctx, pair.p1.x, pair.p1.y, pair.radius, pair.p1.angle, pair.color);
      this.renderSinglePortal(ctx, pair.p2.x, pair.p2.y, pair.radius, pair.p2.angle, pair.color);

      ctx.strokeStyle = pair.color;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(pair.p1.x, pair.p1.y);
      ctx.lineTo(pair.p2.x, pair.p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    }

    // Render Crystals
    for (const c of this.crystals) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Render Fighters
    for (const [id, f] of this.fighters.entries()) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);

      const color = this.getPlayer(id)?.color || '#EF4444';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, -9);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, 9);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(2, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const comboText = f.combo > 1 ? ` (x${f.combo})` : '';
      ctx.fillText(`${f.score}${comboText}`, f.x, f.y - 16);
    }
  }

  private renderSinglePortal(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const radGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, radius);
    radGrad.addColorStop(0, '#FFFFFF');
    radGrad.addColorStop(0.4, color);
    radGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      const offset = (arm * Math.PI) / 2;
      for (let r = 6; r < radius; r += 4) {
        const theta = offset + r * 0.12;
        const px = Math.cos(theta) * r;
        const py = Math.sin(theta) * r;
        if (r === 6) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.fighters.entries()).map(([playerId, f]) => ({
      playerId,
      score: f.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} warped quantum reality with ${scores[0].score} pts!` : 'Wormholes collapsed!'
    };
  }
}
