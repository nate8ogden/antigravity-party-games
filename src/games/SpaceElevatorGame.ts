import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CableHazard {
  id: number;
  y: number; // relative to screen
  type: 'boost_ring' | 'lightning_arc';
  resolved: boolean;
}

interface ClimberCar {
  id: PlayerId;
  x: number;
  carY: number;
  speed: number;
  altitude: number; // 0 to 36000 km
  score: number;
  combo: number;
  staggerTimer: number;
  hazards: CableHazard[];
  nextHazardDist: number;
}

export class SpaceElevatorGame extends BaseGame {
  public cars: Map<PlayerId, ClimberCar> = new Map();
  public currentMapName: string = 'Equatorial Orbital Tether';
  private hazardIdCounter: number = 0;
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
    this.cars.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      this.cars.set(p.id, {
        id: p.id,
        x: cx,
        carY: height * 0.65,
        speed: 160,
        altitude: 0,
        score: 0,
        combo: 0,
        staggerTimer: 0,
        hazards: [],
        nextHazardDist: 180,
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    this.cars.forEach((c) => {
      const p = this.getPlayer(c.id);

      if (c.staggerTimer > 0) c.staggerTimer -= dt;

      c.altitude += c.speed * dt * 0.05;
      c.speed = Math.max(100, c.speed - 35 * dt); // cable friction

      // Human input: magnetic climber surge
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(c.id) || this.input.justAction(c.id);
        if (justPressed && c.staggerTimer <= 0) {
          this.pulseClimber(c);
        }
      }

      // Spawning cable hazards / boost rings
      c.nextHazardDist -= c.speed * dt;
      if (c.nextHazardDist <= 0) {
        c.hazards.push({
          id: ++this.hazardIdCounter,
          y: -40,
          type: Math.random() > 0.4 ? 'boost_ring' : 'lightning_arc',
          resolved: false,
        });
        c.nextHazardDist = 180 + Math.random() * 140;
      }

      // Update hazards moving down towards climber
      for (let i = c.hazards.length - 1; i >= 0; i--) {
        const h = c.hazards[i];
        h.y += c.speed * dt;

        // Interaction zone with climber car
        if (!h.resolved && h.y >= c.carY - 25 && h.y <= c.carY + 25) {
          h.resolved = true;
          if (h.type === 'boost_ring') {
            // Magnetic boost ring contact
            c.speed = Math.min(360, c.speed + 80);
            c.score += 35 + c.combo * 4;
            c.combo++;
            this.audio.playTone(780, 0.12, 'sine');
            this.particles.emit(c.x, c.carY, 14, '#00e5ff');
          } else {
            // Electrostatic lightning strike!
            c.speed = 80;
            c.staggerTimer = 0.8;
            c.combo = 0;
            c.score = Math.max(0, c.score - 20);
            this.audio.playTone(120, 0.25, 'sawtooth');
            this.particles.emit(c.x, c.carY, 18, '#f39c12');
          }
        }

        if (h.y > height + 60) {
          c.hazards.splice(i, 1);
        }
      }
    });
  }

  private pulseClimber(c: ClimberCar): void {
    const nearbyRing = c.hazards.find((h) => !h.resolved && h.type === 'boost_ring' && Math.abs(h.y - c.carY) < 45);
    const nearbyLightning = c.hazards.find((h) => !h.resolved && h.type === 'lightning_arc' && Math.abs(h.y - c.carY) < 45);

    if (nearbyLightning) {
      // Pulsed directly into lightning!
      c.speed = 60;
      c.staggerTimer = 1.0;
      c.combo = 0;
      c.score = Math.max(0, c.score - 25);
      this.audio.playTone(100, 0.3, 'sawtooth');
      this.particles.emit(c.x, c.carY, 20, '#e74c3c');
    } else if (nearbyRing) {
      // PERFECT BOOST SURGE!
      nearbyRing.resolved = true;
      c.speed = Math.min(380, c.speed + 110);
      c.score += 45 + c.combo * 5;
      c.combo++;
      this.audio.playTone(880 + c.combo * 40, 0.15, 'triangle');
      this.particles.emit(c.x, c.carY, 20, '#00e676');
    } else {
      // Small acceleration surge
      c.speed = Math.min(320, c.speed + 35);
      c.score += 10;
      this.audio.playTone(460, 0.08, 'triangle');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const c = this.cars.get(botId);
    if (!c || c.staggerTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const incomingRing = c.hazards.find((h) => !h.resolved && h.type === 'boost_ring' && Math.abs(h.y - c.carY) < 55);
      const incomingLightning = c.hazards.find((h) => !h.resolved && h.type === 'lightning_arc' && Math.abs(h.y - c.carY) < 65);

      if (incomingRing && !incomingLightning) {
        this.pulseClimber(c);
        bTimer = difficulty === 'bot_hard' ? 0.35 : 0.55;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Altitude sky gradient: Deep blue atmosphere to starry vacuum
    const bgGrad = ctx.createLinearGradient(0, height, 0, 0);
    bgGrad.addColorStop(0, '#154360');
    bgGrad.addColorStop(0.4, '#1b2631');
    bgGrad.addColorStop(1, '#05070a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.cars.forEach((c, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#00e5ff';

      // Carbon Nanotube Tether Ribbon
      ctx.strokeStyle = '#7f8c8d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(c.x, 0);
      ctx.lineTo(c.x, height);
      ctx.stroke();

      // Carbon weave stripes
      ctx.strokeStyle = '#bdc3c7';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(c.x - 4, y);
        ctx.lineTo(c.x + 4, y);
        ctx.stroke();
      }

      // Hazards on Cable
      c.hazards.forEach((h) => {
        if (h.resolved) return;
        if (h.type === 'boost_ring') {
          // Cyan magnetic induction ring
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(c.x, h.y, 24, 8, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Yellow electrostatic lightning arc
          ctx.strokeStyle = '#f1c40f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(c.x - 22, h.y);
          ctx.lineTo(c.x - 8, h.y - 8);
          ctx.lineTo(c.x + 8, h.y + 8);
          ctx.lineTo(c.x + 22, h.y);
          ctx.stroke();
        }
      });

      // Climber Car
      ctx.save();
      ctx.translate(c.x, c.carY);

      if (c.staggerTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, 0);
      }

      // Climber capsule
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-14, -22, 28, 44, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Magnetic guide rollers
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(-18, -16, 4, 8);
      ctx.fillRect(14, -16, 4, 8);
      ctx.fillRect(-18, 8, 4, 8);
      ctx.fillRect(14, 8, 4, 8);

      // Observation window
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(0, -6, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Altitude & Speed HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(c.altitude)} km`, c.x, height * 0.88);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${c.score} pts`, c.x, height * 0.92);
      if (c.combo > 1) {
        ctx.fillStyle = '#00e676';
        ctx.fillText(`${c.combo}x MAG-SURGE`, c.x, height * 0.96);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚡 TAP AT BOOST RINGS TO SURGE • AVOID LIGHTNING!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.cars.forEach((c, pId) => scores.set(pId, c.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.cars.entries())
      .map(([playerId, c]) => ({ playerId, score: c.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} reached geosynchronous orbit first!` : 'Climber cars stalled on the cable!',
    };
  }
}
