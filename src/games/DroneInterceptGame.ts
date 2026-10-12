import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Drone {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isHostile: boolean;
  active: boolean;
}

interface PlayerEMP {
  reticleAngle: number;
  score: number;
  cooldown: number;
}

export class DroneInterceptGame extends BaseGame {
  private emps: Map<PlayerId, PlayerEMP> = new Map();
  private drones: Drone[] = [];
  private spawnTimer: number = 0;
  private nextDroneId: number = 1;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.emps.clear();
    this.drones = [];
    this.spawnTimer = 0.5;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (let i = 0; i < 8; i++) {
      this.spawnDrone(width, height);
    }

    for (const p of this.getActivePlayers()) {
      this.emps.set(p.id, {
        reticleAngle: Math.random() * Math.PI * 2,
        score: 0,
        cooldown: 0
      });
    }
  }

  private spawnDrone(width: number, height: number): void {
    const isHostile = Math.random() < 0.75;
    const angle = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 80;
    this.drones.push({
      id: this.nextDroneId++,
      x: 80 + Math.random() * (width - 160),
      y: 80 + Math.random() * (height - 160),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      isHostile,
      active: true
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

    // Update drones
    for (const d of this.drones) {
      if (!d.active) continue;
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      if (d.x < 50) { d.x = 50; d.vx *= -1; }
      if (d.x > width - 50) { d.x = width - 50; d.vx *= -1; }
      if (d.y < 50) { d.y = 50; d.vy *= -1; }
      if (d.y > height - 50) { d.y = height - 50; d.vy *= -1; }
    }

    // Spawn new drones
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2 + Math.random() * 0.6;
      if (this.drones.filter(d => d.active).length < 10) {
        this.spawnDrone(width, height);
      }
    }

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const emp = this.emps.get(p.id);
      if (!emp) continue;

      if (emp.cooldown > 0) {
        emp.cooldown -= dt;
      }

      // Rotate reticle continuously
      emp.reticleAngle += 2.4 * dt;

      const pos = this.getPlayerStation(i, width, height);
      const targetX = pos.x + Math.cos(emp.reticleAngle) * 120;
      const targetY = pos.y + Math.sin(emp.reticleAngle) * 120;

      if (this.input.justPressed(p.id) && emp.cooldown <= 0) {
        emp.cooldown = 0.55;
        this.particles.emit(targetX, targetY, 18, '#06B6D4');
        this.audio.playTone(450, 0.12, 'sawtooth');

        // Check drones in blast radius (55px)
        let friedCount = 0;
        for (const d of this.drones) {
          if (!d.active) continue;
          if (Math.hypot(d.x - targetX, d.y - targetY) < 55) {
            d.active = false;
            if (d.isHostile) {
              friedCount++;
              emp.score += 10;
              this.particles.emit(d.x, d.y, 14, '#EF4444');
              this.audio.playTone(850, 0.08, 'sine');
            } else {
              // Friendly drone hit penalty
              emp.score = Math.max(0, emp.score - 10);
              this.audio.playTone(160, 0.2, 'sawtooth');
            }
          }
        }

        if (friedCount >= 2) {
          emp.score += 15; // Combo bonus
          this.audio.playTone(1050, 0.15, 'sine');
        }
      }
    }

    this.drones = this.drones.filter(d => d.active);
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const active = this.getActivePlayers();
    const i = active.findIndex(p => p.id === botId);
    if (i === -1) return;

    const emp = this.emps.get(botId);
    if (!emp || emp.cooldown > 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false);
      return;
    }

    const pos = this.getPlayerStation(i, width, height);
    const targetX = pos.x + Math.cos(emp.reticleAngle) * 120;
    const targetY = pos.y + Math.sin(emp.reticleAngle) * 120;

    const rangeThreshold = difficulty === 'bot_easy' ? 36 : difficulty === 'bot_normal' ? 45 : 52;
    const hostileInRange = this.drones.some(d => d.active && d.isHostile && Math.hypot(d.x - targetX, d.y - targetY) < rangeThreshold);
    const friendlyCheck = difficulty === 'bot_easy' ? Math.random() < 0.70 : true;
    const friendlyInRange = friendlyCheck && this.drones.some(d => d.active && !d.isHostile && Math.hypot(d.x - targetX, d.y - targetY) < 65);

    if (hostileInRange && !friendlyInRange) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getPlayerStation(index: number, width: number, height: number): { x: number; y: number } {
    const stations = [
      { x: 80, y: 80 },
      { x: width - 80, y: 80 },
      { x: 80, y: height - 80 },
      { x: width - 80, y: height - 80 }
    ];
    return stations[index] || stations[0];
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Drones
    for (const d of this.drones) {
      if (!d.active) continue;

      ctx.save();
      ctx.translate(d.x, d.y);

      // Drone X-cross frame
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(10, 10);
      ctx.moveTo(10, -10);
      ctx.lineTo(-10, 10);
      ctx.stroke();

      // Center LED
      ctx.fillStyle = d.isHostile ? '#EF4444' : '#38BDF8';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Rotors
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(-10, -10, 3, 0, Math.PI * 2);
      ctx.arc(10, -10, 3, 0, Math.PI * 2);
      ctx.arc(-10, 10, 3, 0, Math.PI * 2);
      ctx.arc(10, 10, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Stations & Reticles
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const emp = this.emps.get(p.id);
      if (!emp) continue;
      const pos = this.getPlayerStation(i, width, height);

      // Base Turret
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
      ctx.fill();

      // Reticle
      const rx = pos.x + Math.cos(emp.reticleAngle) * 120;
      const ry = pos.y + Math.sin(emp.reticleAngle) * 120;

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(rx, ry);
      ctx.stroke();
      ctx.setLineDash([]);

      // EMP blast crosshair
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rx, ry, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${emp.score}`, pos.x, pos.y > height / 2 ? pos.y + 32 : pos.y - 25);
    }

    ctx.fillStyle = '#06B6D4';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`DRONE INTERCEPT: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.emps.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} discharged EMPs to clear the skies!` : 'Surveillance drones intercepted the sector!'
    };
  }
}
