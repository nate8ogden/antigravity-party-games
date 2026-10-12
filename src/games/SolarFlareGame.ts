import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SolarOrb {
  id: number;
  x: number;
  y: number;
  vy: number;
  radius: number;
  value: number;
}

interface SailCruiser {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  temperature: number; // 0 to 100
  isSailUnfurled: boolean;
  score: number;
  overheatTimer: number;
}

export class SolarFlareGame extends BaseGame {
  private cruisers: Map<PlayerId, SailCruiser> = new Map();
  private orbs: SolarOrb[] = [];
  private orbIdCounter: number = 0;
  private flareTimer: number = 5.0; // cycle timer
  private isFlarePeak: boolean = false;
  private flareIntensity: number = 0; // 0 to 1
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
    this.cruisers.clear();
    this.orbs = [];
    this.orbIdCounter = 0;
    this.flareTimer = 4.0;
    this.isFlarePeak = false;
    this.flareIntensity = 0;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = width * 0.2 + (idx / Math.max(1, active.length - 1)) * (width * 0.6);
      this.cruisers.set(p.id, {
        id: p.id,
        x: startX,
        y: height * 0.65,
        vx: 0,
        vy: 0,
        temperature: 20,
        isSailUnfurled: false,
        score: 0,
        overheatTimer: 0
      });
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

    // Update solar flare cycle
    this.flareTimer -= dt;
    if (this.flareTimer <= 0) {
      this.isFlarePeak = !this.isFlarePeak;
      this.flareTimer = this.isFlarePeak ? 3.5 : 5.0;
      if (this.isFlarePeak) {
        this.audio.playTone(220, 0.4, 'sawtooth');
      }
    }

    const targetIntensity = this.isFlarePeak ? 1.0 : 0.15;
    this.flareIntensity += (targetIntensity - this.flareIntensity) * 2.5 * dt;

    // Spawn solar plasma orbs
    if (Math.random() < 0.35 && this.orbs.length < 18) {
      this.orbs.push({
        id: ++this.orbIdCounter,
        x: 30 + Math.random() * (width - 60),
        y: height + 20,
        vy: -80 - Math.random() * 120,
        radius: 8 + Math.random() * 6,
        value: Math.random() > 0.75 ? 30 : 15
      });
    }

    // Update plasma orbs
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      orb.y += orb.vy * dt * (1 + this.flareIntensity * 0.8);
      if (orb.y < -30) {
        this.orbs.splice(i, 1);
      }
    }

    // Update cruisers
    for (const [id, c] of this.cruisers.entries()) {
      if (c.overheatTimer > 0) {
        c.overheatTimer -= dt;
        c.temperature = Math.max(20, c.temperature - 40 * dt);
        c.isSailUnfurled = false;
        c.vx *= Math.pow(0.92, dt * 60);
        c.vy *= Math.pow(0.92, dt * 60);
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        continue;
      }

      const moveX = this.input.getSteer(id);
      const moveY = this.input.getThrottle(id);
      c.isSailUnfurled = this.input.isActionPressed(id) || this.input.isPressed(id) || moveY > 0.3;

      if (c.isSailUnfurled) {
        c.score += Math.round(15 * dt);
        const heatGain = (this.isFlarePeak ? 38 : 12) * dt;
        c.temperature += heatGain;

        c.vy -= 120 * dt;

        this.particles.emit(
          c.x,
          c.y + 16,
          2,
          this.isFlarePeak ? '#FF5722' : '#FFEB3B'
        );

        if (c.temperature >= 100) {
          c.overheatTimer = 2.0;
          c.score = Math.max(0, c.score - 20);
          this.audio.playTone(120, 0.3, 'sawtooth');
          this.particles.emit(c.x, c.y, 20, '#FF1744');
        }
      } else {
        c.temperature = Math.max(20, c.temperature - 35 * dt);
      }

      c.vx += moveX * 380 * dt;
      c.vy -= moveY * 220 * dt;

      c.vy -= 40 * this.flareIntensity * dt;

      c.vx *= Math.pow(0.92, dt * 60);
      c.vy *= Math.pow(0.92, dt * 60);

      c.x += c.vx * dt;
      c.y += c.vy * dt;

      c.x = Math.max(25, Math.min(width - 25, c.x));
      c.y = Math.max(40, Math.min(height - 40, c.y));

      // Collect plasma orbs
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const orb = this.orbs[i];
        if (Math.hypot(c.x - orb.x, c.y - orb.y) < orb.radius + 16) {
          c.score += orb.value;
          this.audio.playTone(523, 0.08, 'sine');
          this.particles.emit(orb.x, orb.y, 10, '#FFD54F');
          this.orbs.splice(i, 1);
        }
      }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const c = this.cruisers.get(botId);
    if (!c || c.overheatTimer > 0) return;

    let wantSail = true;
    if (c.temperature > 82 || (this.isFlarePeak && c.temperature > 55)) {
      wantSail = false;
    }

    let closestOrb: SolarOrb | null = null;
    let minDist = 99999;
    for (const orb of this.orbs) {
      const d = Math.hypot(orb.x - c.x, orb.y - c.y);
      if (d < minDist) {
        minDist = d;
        closestOrb = orb;
      }
    }

    let moveX = 0;
    let moveY = 0;
    if (closestOrb) {
      const dx = closestOrb.x - c.x;
      const dy = closestOrb.y - c.y;
      if (Math.abs(dx) > 10) moveX = dx > 0 ? 1 : -1;
      if (Math.abs(dy) > 10) moveY = dy > 0 ? 1 : -1;
    }

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.25) wantSail = !wantSail;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, wantSail, moveX, moveY, wantSail);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0a0302');
    sky.addColorStop(1, '#2c0c03');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const starRadius = width * 0.7;
    const starGrad = ctx.createRadialGradient(width * 0.5, height + starRadius * 0.75, starRadius * 0.2, width * 0.5, height + starRadius * 0.75, starRadius);
    starGrad.addColorStop(0, '#FFF59D');
    starGrad.addColorStop(0.3, '#FF9800');
    starGrad.addColorStop(0.8, '#D84315');
    starGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(width * 0.5, height + starRadius * 0.75, starRadius, 0, Math.PI * 2);
    ctx.fill();

    if (this.flareIntensity > 0.3) {
      ctx.strokeStyle = `rgba(255, 87, 34, ${this.flareIntensity * 0.6})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(width * 0.5, height + 80, width * 0.6, Math.PI, 0);
      ctx.stroke();
    }

    ctx.fillStyle = this.isFlarePeak ? '#FF1744' : '#FFD600';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      this.isFlarePeak ? '⚠ SOLAR FLARE PEAK: HIGH HEAT! ⚠' : `SOLAR WIND QUIET (${Math.ceil(this.flareTimer)}s)`,
      width * 0.5,
      25
    );

    for (const orb of this.orbs) {
      ctx.save();
      ctx.translate(orb.x, orb.y);
      ctx.fillStyle = '#FFD54F';
      ctx.beginPath();
      ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FF8F00';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    for (const [id, c] of this.cruisers.entries()) {
      ctx.save();
      ctx.translate(c.x, c.y);

      const color = this.getPlayer(id)?.color || '#EF4444';

      if (c.isSailUnfurled && c.overheatTimer <= 0) {
        ctx.fillStyle = 'rgba(255, 235, 59, 0.4)';
        ctx.strokeStyle = '#FFF59D';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(24, 0);
        ctx.lineTo(0, 14);
        ctx.lineTo(-24, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(8, 10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ECEFF1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, 10);
      ctx.stroke();

      ctx.restore();

      if (c.overheatTimer > 0) {
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OVERHEAT!', c.x, c.y - 32);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(c.x - 16, c.y - 24, 32, 4);
      const heatPercent = Math.min(1, c.temperature / 100);
      ctx.fillStyle = heatPercent > 0.75 ? '#FF1744' : heatPercent > 0.5 ? '#FF9800' : '#4CAF50';
      ctx.fillRect(c.x - 16, c.y - 24, heatPercent * 32, 4);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.score}`, c.x, c.y - 30);
    }
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.cruisers.entries()).map(([playerId, c]) => ({
      playerId,
      score: c.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} rode the solar flare to victory with ${scores[0].score} pts!` : 'Cruisers completed orbit!'
    };
  }
}
