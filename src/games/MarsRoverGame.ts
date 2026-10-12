import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SoilSample {
  id: number;
  x: number;
  y: number;
  type: 'hematite' | 'water_ice' | 'fossil';
  value: number;
  color: string;
}

interface DustDevil {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spin: number;
}

interface MarsRover {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  samplesHeld: SoilSample[];
  isDrilling: boolean;
  drillTimer: number;
  score: number;
  spinTimer: number;
}

export class MarsRoverGame extends BaseGame {
  private rovers: Map<PlayerId, MarsRover> = new Map();
  private samples: SoilSample[] = [];
  private dustDevils: DustDevil[] = [];
  private sampleIdCounter: number = 0;
  private rocketLander = { x: 0, y: 0, radius: 45 };
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
    this.rovers.clear();
    this.samples = [];
    this.dustDevils = [];
    this.sampleIdCounter = 0;

    this.rocketLander = { x: width * 0.5, y: height * 0.5, radius: 40 };

    for (let i = 0; i < 12; i++) {
      this.spawnSample(width, height);
    }

    this.dustDevils = [
      { x: width * 0.25, y: height * 0.3, vx: 40, vy: -30, radius: 32, spin: 0 },
      { x: width * 0.75, y: height * 0.7, vx: -35, vy: 40, radius: 32, spin: 0 }
    ];

    const active = this.getActivePlayers();
    const spawnCorners = [
      { x: 90, y: 90, angle: Math.PI * 0.25 },
      { x: width - 90, y: 90, angle: Math.PI * 0.75 },
      { x: 90, y: height - 90, angle: -Math.PI * 0.25 },
      { x: width - 90, y: height - 90, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnCorners[idx % spawnCorners.length];
      this.rovers.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        samplesHeld: [],
        isDrilling: false,
        drillTimer: 0,
        score: 0,
        spinTimer: 0
      });
    });
  }

  private spawnSample(width: number, height: number): void {
    const rand = Math.random();
    let type: 'hematite' | 'water_ice' | 'fossil' = 'hematite';
    let value = 15;
    let color = '#FF7043';

    if (rand < 0.5) {
      type = 'hematite';
      value = 15;
      color = '#FF7043';
    } else if (rand < 0.85) {
      type = 'water_ice';
      value = 30;
      color = '#00E5FF';
    } else {
      type = 'fossil';
      value = 60;
      color = '#FFD700';
    }

    let x = 0;
    let y = 0;
    do {
      x = 60 + Math.random() * (width - 120);
      y = 60 + Math.random() * (height - 120);
    } while (Math.hypot(x - width * 0.5, y - height * 0.5) < 80);

    this.samples.push({
      id: ++this.sampleIdCounter,
      x,
      y,
      type,
      value,
      color
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

    while (this.samples.length < 10) {
      this.spawnSample(width, height);
    }

    for (const dd of this.dustDevils) {
      dd.x += dd.vx * dt;
      dd.y += dd.vy * dt;
      dd.spin += 6 * dt;

      if (dd.x < 40 || dd.x > width - 40) dd.vx *= -1;
      if (dd.y < 40 || dd.y > height - 40) dd.vy *= -1;

      if (Math.random() < 0.4) {
        this.particles.emit(dd.x, dd.y, 2, '#D84315');
      }
    }

    for (const [id, r] of this.rovers.entries()) {
      if (r.spinTimer > 0) {
        r.spinTimer -= dt;
        r.angle += 10 * dt;
        r.vx *= Math.pow(0.94, dt * 60);
        r.vy *= Math.pow(0.94, dt * 60);
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        continue;
      }

      const turnDir = this.input.getSteer(id);
      r.angle += turnDir * 3.2 * dt;

      const throttle = this.input.getThrottle(id);
      const isThrusting = throttle > 0.3 || this.input.isPressed(id);

      if (isThrusting) {
        const speed = 160;
        r.vx += Math.cos(r.angle) * speed * dt;
        r.vy += Math.sin(r.angle) * speed * dt;

        this.particles.emit(
          r.x - Math.cos(r.angle) * 12,
          r.y - Math.sin(r.angle) * 12,
          1,
          '#BF360C'
        );
      }

      r.vx *= Math.pow(0.92, dt * 60);
      r.vy *= Math.pow(0.92, dt * 60);
      r.x += r.vx * dt;
      r.y += r.vy * dt;

      r.x = Math.max(25, Math.min(width - 25, r.x));
      r.y = Math.max(25, Math.min(height - 25, r.y));

      r.isDrilling = this.input.isActionPressed(id) && r.samplesHeld.length < 3;

      if (r.isDrilling) {
        for (let i = this.samples.length - 1; i >= 0; i--) {
          const sample = this.samples[i];
          if (Math.hypot(r.x - sample.x, r.y - sample.y) < 26) {
            r.samplesHeld.push(sample);
            this.samples.splice(i, 1);
            this.audio.playTone(392, 0.08, 'square');
            setTimeout(() => this.audio.playTone(523, 0.1, 'triangle'), 60);
            this.particles.emit(sample.x, sample.y, 10, sample.color);
            break;
          }
        }
      }

      const distToRocket = Math.hypot(r.x - this.rocketLander.x, r.y - this.rocketLander.y);
      if (distToRocket < this.rocketLander.radius + 15 && r.samplesHeld.length > 0) {
        let earned = 0;
        for (const s of r.samplesHeld) {
          earned += s.value;
        }
        r.score += earned;
        r.samplesHeld = [];
        this.audio.playTone(659, 0.1, 'triangle');
        setTimeout(() => this.audio.playTone(880, 0.15, 'triangle'), 60);
        this.particles.emit(this.rocketLander.x, this.rocketLander.y, 16, '#FFD700');
      }

      for (const dd of this.dustDevils) {
        if (Math.hypot(r.x - dd.x, r.y - dd.y) < dd.radius + 14) {
          r.spinTimer = 1.2;
          r.vx = (Math.random() - 0.5) * 200;
          r.vy = (Math.random() - 0.5) * 200;
          this.audio.playTone(140, 0.2, 'sawtooth');
          break;
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

    const r = this.rovers.get(botId);
    if (!r || r.spinTimer > 0) return;

    let targetX = this.rocketLander.x;
    let targetY = this.rocketLander.y;
    let wantDrill = false;

    if (r.samplesHeld.length >= 2) {
      targetX = this.rocketLander.x;
      targetY = this.rocketLander.y;
    } else {
      let minDist = 99999;
      let closestSample: SoilSample | null = null;
      for (const s of this.samples) {
        const d = Math.hypot(s.x - r.x, s.y - r.y);
        if (d < minDist) {
          minDist = d;
          closestSample = s;
        }
      }

      if (closestSample) {
        targetX = closestSample.x;
        targetY = closestSample.y;
        if (minDist < 30) wantDrill = true;
      }
    }

    const desiredAngle = Math.atan2(targetY - r.y, targetX - r.x);
    let angleDiff = desiredAngle - r.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let turn = 0;
    if (angleDiff > 0.15) turn = 1;
    else if (angleDiff < -0.15) turn = -1;

    const thrust = Math.abs(angleDiff) < 1.0;

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.25) wantDrill = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, thrust, turn, thrust ? 1 : 0, wantDrill);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const soil = ctx.createLinearGradient(0, 0, 0, height);
    soil.addColorStop(0, '#3E1B15');
    soil.addColorStop(1, '#5D2417');
    ctx.fillStyle = soil;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#4A1D13';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width * 0.2, height * 0.2, 40, 0, Math.PI * 2);
    ctx.arc(width * 0.8, height * 0.8, 55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(this.rocketLander.x, this.rocketLander.y);
    ctx.fillStyle = '#37474F';
    ctx.beginPath();
    ctx.arc(0, 0, this.rocketLander.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ECEFF1';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ECEFF1';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(8, 10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HABITAT', 0, 24);
    ctx.restore();

    for (const s of this.samples) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    for (const dd of this.dustDevils) {
      ctx.save();
      ctx.translate(dd.x, dd.y);
      ctx.rotate(dd.spin);

      ctx.strokeStyle = 'rgba(216, 67, 21, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, dd.radius, 0, Math.PI * 1.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, dd.radius * 0.6, Math.PI * 0.5, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const [id, r] of this.rovers.entries()) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);

      const color = this.getPlayer(id)?.color || '#EF4444';

      ctx.fillStyle = '#212121';
      [-10, 0, 10].forEach(wx => {
        ctx.fillRect(wx - 3, -13, 6, 4);
        ctx.fillRect(wx - 3, 9, 6, 4);
      });

      ctx.fillStyle = color;
      ctx.fillRect(-12, -9, 24, 18);

      ctx.fillStyle = '#0277BD';
      ctx.fillRect(-8, -6, 12, 12);

      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.arc(7, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      if (r.isDrilling) {
        ctx.strokeStyle = '#FFD54F';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(20, 0);
        ctx.stroke();
      }

      ctx.restore();

      for (let i = 0; i < r.samplesHeld.length; i++) {
        ctx.fillStyle = r.samplesHeld[i].color;
        ctx.beginPath();
        ctx.arc(r.x - 8 + i * 8, r.y - 18, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.score}`, r.x, r.y - 24);
    }
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.rovers.entries()).map(([playerId, r]) => ({
      playerId,
      score: r.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} explored Mars like a boss with ${scores[0].score} pts!` : 'Martian sol ended!'
    };
  }
}
