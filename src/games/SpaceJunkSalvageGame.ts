import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Debris {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  spin: number;
  type: 'bolt' | 'panel' | 'booster' | 'gold_satellite_core';
  value: number;
  capturedBy: PlayerId | null;
}

interface SatelliteHazard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
}

interface SalvageTug {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  heldCargo: Debris[];
  isMagnetActive: boolean;
  stunTimer: number;
}

export class SpaceJunkSalvageGame extends BaseGame {
  private tugs: Map<PlayerId, SalvageTug> = new Map();
  private junk: Debris[] = [];
  private hazards: SatelliteHazard[] = [];
  private junkIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private depot = { x: 0, y: 0, radius: 55 };

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.tugs.clear();
    this.junk = [];
    this.hazards = [];
    this.junkIdCounter = 0;

    this.depot = { x: width * 0.5, y: height * 0.5, radius: 50 };

    // Spawn initial junk pieces
    for (let i = 0; i < 22; i++) {
      this.spawnJunkPiece(width, height);
    }

    // Spawn 2 satellite hazards
    this.hazards = [
      { x: width * 0.25, y: height * 0.3, vx: 25, vy: -15, angle: 0 },
      { x: width * 0.75, y: height * 0.7, vx: -20, vy: 20, angle: Math.PI }
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
      this.tugs.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        score: 0,
        heldCargo: [],
        isMagnetActive: false,
        stunTimer: 0
      });
    });
  }

  private spawnJunkPiece(width: number, height: number): void {
    const rand = Math.random();
    let type: 'bolt' | 'panel' | 'booster' | 'gold_satellite_core' = 'bolt';
    let value = 10;
    let radius = 10;

    if (rand < 0.45) {
      type = 'bolt';
      value = 10;
      radius = 9;
    } else if (rand < 0.75) {
      type = 'panel';
      value = 25;
      radius = 14;
    } else if (rand < 0.92) {
      type = 'booster';
      value = 40;
      radius = 18;
    } else {
      type = 'gold_satellite_core';
      value = 75;
      radius = 16;
    }

    let x = 0;
    let y = 0;
    do {
      x = 50 + Math.random() * (width - 100);
      y = 50 + Math.random() * (height - 100);
    } while (Math.hypot(x - width * 0.5, y - height * 0.5) < 90);

    this.junk.push({
      id: ++this.junkIdCounter,
      x,
      y,
      vx: (Math.random() - 0.5) * 35,
      vy: (Math.random() - 0.5) * 35,
      radius,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2,
      type,
      value,
      capturedBy: null
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

    // Maintain minimum junk count
    while (this.junk.length < 18) {
      this.spawnJunkPiece(width, height);
    }

    // Update satellite hazards
    for (const h of this.hazards) {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.angle += 0.4 * dt;

      if (h.x < 40 || h.x > width - 40) h.vx *= -1;
      if (h.y < 40 || h.y > height - 40) h.vy *= -1;
    }

    // Update tugs
    for (const [id, tug] of this.tugs.entries()) {
      if (tug.stunTimer > 0) {
        tug.stunTimer -= dt;
        tug.vx *= Math.pow(0.92, dt * 60);
        tug.vy *= Math.pow(0.92, dt * 60);
        tug.x += tug.vx * dt;
        tug.y += tug.vy * dt;
        continue;
      }

      const steer = this.input.getSteer(id);
      const throttle = this.input.getThrottle(id);
      const isThrusting = throttle > 0.3 || this.input.isPressed(id);
      const turnDir = steer;

      tug.angle += turnDir * 3.2 * dt;

      if (isThrusting) {
        const speed = 190;
        tug.vx += Math.cos(tug.angle) * speed * dt;
        tug.vy += Math.sin(tug.angle) * speed * dt;

        this.particles.emit(
          tug.x - Math.cos(tug.angle) * 16,
          tug.y - Math.sin(tug.angle) * 16,
          2,
          '#00E5FF'
        );
      }

      // Drag
      tug.vx *= Math.pow(0.96, dt * 60);
      tug.vy *= Math.pow(0.96, dt * 60);
      tug.x += tug.vx * dt;
      tug.y += tug.vy * dt;

      // Arena clamp
      tug.x = Math.max(25, Math.min(width - 25, tug.x));
      tug.y = Math.max(25, Math.min(height - 25, tug.y));

      tug.isMagnetActive = this.input.isActionPressed(id) || throttle < -0.3;

      // Magnet beam pull
      if (tug.isMagnetActive && tug.heldCargo.length < 3) {
        const beamX = tug.x + Math.cos(tug.angle) * 35;
        const beamY = tug.y + Math.sin(tug.angle) * 35;

        for (const j of this.junk) {
          if (j.capturedBy !== null && j.capturedBy !== tug.id) continue;
          const dist = Math.hypot(j.x - beamX, j.y - beamY);
          if (dist < 110) {
            // Check cone angle
            const angleToJunk = Math.atan2(j.y - tug.y, j.x - tug.x);
            let angleDiff = Math.abs(angleToJunk - tug.angle);
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            angleDiff = Math.abs(angleDiff);

            if (angleDiff < 0.8) {
              // Pull toward tug
              const pullAngle = Math.atan2(tug.y - j.y, tug.x - j.x);
              j.vx += Math.cos(pullAngle) * 260 * dt;
              j.vy += Math.sin(pullAngle) * 260 * dt;

              // If close enough, capture!
              if (dist < 22 && tug.heldCargo.length < 3 && !tug.heldCargo.includes(j)) {
                j.capturedBy = tug.id;
                tug.heldCargo.push(j);
                this.audio.playTone(440, 0.08, 'sine');
              }
            }
          }
        }
      }

      // Check delivery at Depot
      const distToDepot = Math.hypot(tug.x - this.depot.x, tug.y - this.depot.y);
      if (distToDepot < this.depot.radius + 15 && tug.heldCargo.length > 0) {
        let earned = 0;
        for (const piece of tug.heldCargo) {
          earned += piece.value;
          const idx = this.junk.indexOf(piece);
          if (idx >= 0) this.junk.splice(idx, 1);
        }
        tug.score += earned;
        tug.heldCargo = [];
        this.audio.playTone(659, 0.12, 'triangle');
        setTimeout(() => this.audio.playTone(880, 0.15, 'triangle'), 60);

        this.particles.emit(this.depot.x, this.depot.y, 18, '#76FF03');
      }

      // Check collision with satellite hazards
      for (const h of this.hazards) {
        if (Math.hypot(tug.x - h.x, tug.y - h.y) < 32) {
          tug.stunTimer = 1.4;
          for (const cargo of tug.heldCargo) {
            cargo.capturedBy = null;
            cargo.vx = (Math.random() - 0.5) * 100;
            cargo.vy = (Math.random() - 0.5) * 100;
          }
          tug.heldCargo = [];
          this.audio.playTone(130, 0.2, 'sawtooth');
          this.particles.emit(tug.x, tug.y, 15, '#FF1744');
        }
      }
    }

    // Update uncaptured junk physics
    for (const j of this.junk) {
      if (j.capturedBy === null) {
        j.x += j.vx * dt;
        j.y += j.vy * dt;
        j.angle += j.spin * dt;
        j.vx *= Math.pow(0.99, dt * 60);
        j.vy *= Math.pow(0.99, dt * 60);

        if (j.x < 15) { j.x = 15; j.vx *= -1; }
        if (j.x > width - 15) { j.x = width - 15; j.vx *= -1; }
        if (j.y < 15) { j.y = 15; j.vy *= -1; }
        if (j.y > height - 15) { j.y = height - 15; j.vy *= -1; }
      } else {
        const tug = this.tugs.get(j.capturedBy);
        if (tug) {
          const slot = tug.heldCargo.indexOf(j);
          const followDist = 24 + slot * 16;
          const targetX = tug.x - Math.cos(tug.angle) * followDist;
          const targetY = tug.y - Math.sin(tug.angle) * followDist;
          j.x += (targetX - j.x) * 12 * dt;
          j.y += (targetY - j.y) * 12 * dt;
        } else {
          j.capturedBy = null;
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

    const tug = this.tugs.get(botId);
    if (!tug || tug.stunTimer > 0) return;

    let targetX = this.depot.x;
    let targetY = this.depot.y;
    let wantMagnet = false;

    if (tug.heldCargo.length >= 2) {
      targetX = this.depot.x;
      targetY = this.depot.y;
    } else {
      let closestJunk: Debris | null = null;
      let minDist = 99999;
      for (const j of this.junk) {
        if (j.capturedBy !== null) continue;
        const d = Math.hypot(j.x - tug.x, j.y - tug.y);
        if (d < minDist) {
          minDist = d;
          closestJunk = j;
        }
      }

      if (closestJunk) {
        targetX = closestJunk.x;
        targetY = closestJunk.y;
        if (minDist < 120) wantMagnet = true;
      }
    }

    for (const h of this.hazards) {
      const d = Math.hypot(h.x - tug.x, h.y - tug.y);
      if (d < 70) {
        const repelAngle = Math.atan2(tug.y - h.y, tug.x - h.x);
        targetX = tug.x + Math.cos(repelAngle) * 100;
        targetY = tug.y + Math.sin(repelAngle) * 100;
      }
    }

    const desiredAngle = Math.atan2(targetY - tug.y, targetX - tug.x);
    let angleDiff = desiredAngle - tug.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let turn = 0;
    if (angleDiff > 0.15) turn = 1;
    else if (angleDiff < -0.15) turn = -1;

    const thrust = Math.abs(angleDiff) < 0.9;

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.25) wantMagnet = !wantMagnet;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, thrust, turn, thrust ? 1 : 0, wantMagnet);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Dark orbital space
    ctx.fillStyle = '#050711';
    ctx.fillRect(0, 0, width, height);

    // Distant Earth curvature in corner
    ctx.save();
    ctx.beginPath();
    ctx.arc(width * 0.1, height * 1.2, width * 0.7, 0, Math.PI * 2);
    const earthGrad = ctx.createRadialGradient(width * 0.1, height * 1.2, width * 0.2, width * 0.1, height * 1.2, width * 0.7);
    earthGrad.addColorStop(0, '#1E88E5');
    earthGrad.addColorStop(0.8, '#0D47A1');
    earthGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = earthGrad;
    ctx.fill();
    ctx.restore();

    // Central Recycling Barge / Depot
    ctx.save();
    ctx.translate(this.depot.x, this.depot.y);
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.arc(0, 0, this.depot.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00E676';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Pulsing intake zone
    ctx.fillStyle = 'rgba(0, 230, 118, 0.2)';
    ctx.beginPath();
    ctx.arc(0, 0, this.depot.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SALVAGE', 0, -4);
    ctx.fillText('DEPOT', 0, 12);
    ctx.restore();

    // Render Junk Debris
    for (const j of this.junk) {
      ctx.save();
      ctx.translate(j.x, j.y);
      ctx.rotate(j.angle);

      if (j.type === 'bolt') {
        ctx.fillStyle = '#B0BEC5';
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2;
          const px = Math.cos(a) * j.radius;
          const py = Math.sin(a) * j.radius;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else if (j.type === 'panel') {
        ctx.fillStyle = '#1565C0';
        ctx.fillRect(-j.radius, -j.radius * 0.5, j.radius * 2, j.radius);
        ctx.strokeStyle = '#90CAF9';
        ctx.lineWidth = 1;
        ctx.strokeRect(-j.radius, -j.radius * 0.5, j.radius * 2, j.radius);
      } else if (j.type === 'booster') {
        ctx.fillStyle = '#78909C';
        ctx.fillRect(-j.radius * 0.6, -j.radius, j.radius * 1.2, j.radius * 2);
        ctx.fillStyle = '#E53935';
        ctx.fillRect(-j.radius * 0.6, j.radius * 0.6, j.radius * 1.2, j.radius * 0.4);
      } else {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, j.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFA000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render Hazard Satellites
    for (const h of this.hazards) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.angle);

      ctx.strokeStyle = 'rgba(255, 23, 68, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#CFD8DC';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#0277BD';
      ctx.fillRect(-26, -5, 15, 10);
      ctx.fillRect(11, -5, 15, 10);
      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, -18);
      ctx.stroke();

      ctx.restore();
    }

    // Render Salvage Tugs
    for (const [id, tug] of this.tugs.entries()) {
      ctx.save();
      ctx.translate(tug.x, tug.y);
      ctx.rotate(tug.angle);

      // Magnet beam cone
      if (tug.isMagnetActive && tug.stunTimer <= 0) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.18)';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(85, -35);
        ctx.lineTo(85, 35);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      const color = this.getPlayer(id)?.color || '#EF4444';

      // Tug chassis
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-12, -12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();

      // Front grapple clamps
      ctx.strokeStyle = '#ECEFF1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.lineTo(16, -10);
      ctx.moveTo(10, 6);
      ctx.lineTo(16, 10);
      ctx.stroke();

      ctx.restore();

      // Stunned indicator
      if (tug.stunTimer > 0) {
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ STUNNED ⚡', tug.x, tug.y - 20);
      }

      // Player Score & cargo count
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${tug.score} (${tug.heldCargo.length}/3)`, tug.x, tug.y - 18);
    }
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.tugs.entries()).map(([playerId, tug]) => ({
      playerId,
      score: tug.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} salvaged orbital glory with ${scores[0].score} pts!` : 'All debris cleared!'
    };
  }
}
