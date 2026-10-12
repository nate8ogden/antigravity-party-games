import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SolarFlare {
  id: number;
  angle: number;
  type: 'plasma' | 'coronal_spike';
  warningTimer: number; // 0.6s warning
  activeTimer: number; // 0.4s active burst
}

interface DysonDrone {
  id: PlayerId;
  angle: number;
  orbitRadius: number;
  speed: number;
  collectorDeployed: boolean;
  powerStored: number; // 0 to 100
  score: number;
  combo: number;
  staggerTimer: number;
}

export class DysonSphereCollectorGame extends BaseGame {
  public drones: Map<PlayerId, DysonDrone> = new Map();
  public flares: SolarFlare[] = [];
  public currentMapName: string = 'Dyson Swarm Ring Alpha';

  private flareIdCounter: number = 0;
  private nextFlareSpawn: number = 1.2;
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
    this.drones.clear();
    this.flares = [];
    this.botReactionTimers.clear();
    this.nextFlareSpawn = 1.0;

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const startAngle = (idx / count) * Math.PI * 2;
      this.drones.set(p.id, {
        id: p.id,
        angle: startAngle,
        orbitRadius: 150 + (idx % 2) * 25,
        speed: 1.6,
        collectorDeployed: false,
        powerStored: 0,
        score: 0,
        combo: 0,
        staggerTimer: 0,
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

    // Spawning Solar Flares
    this.nextFlareSpawn -= dt;
    if (this.nextFlareSpawn <= 0) {
      this.flares.push({
        id: ++this.flareIdCounter,
        angle: Math.random() * Math.PI * 2,
        type: Math.random() < 0.35 ? 'coronal_spike' : 'plasma',
        warningTimer: 0.7,
        activeTimer: 0.45,
      });
      this.nextFlareSpawn = 1.2 + Math.random() * 0.8;
    }

    // Update Flares
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const fl = this.flares[i];
      if (fl.warningTimer > 0) {
        fl.warningTimer -= dt;
      } else if (fl.activeTimer > 0) {
        fl.activeTimer -= dt;
      } else {
        this.flares.splice(i, 1);
      }
    }

    // Update Drones
    this.drones.forEach((d) => {
      const p = this.getPlayer(d.id);

      if (d.staggerTimer > 0) d.staggerTimer -= dt;

      // Human input: HOLD to deploy solar collector panels
      if (p && !p.type.startsWith('bot_')) {
        d.collectorDeployed = this.input.isPressed(d.id) && d.staggerTimer <= 0;
      }

      // Orbital movement
      d.angle = (d.angle + d.speed * dt) % (Math.PI * 2);

      // Check flare collision
      this.flares.forEach((fl) => {
        if (fl.warningTimer <= 0 && fl.activeTimer > 0) {
          let diff = Math.abs(d.angle - fl.angle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;

          if (diff < 0.28) {
            if (fl.type === 'plasma') {
              if (d.collectorDeployed) {
                // ABSORBED CLEAN SOLAR PLASMA!
                d.powerStored = Math.min(100, d.powerStored + 35);
                d.score += 25 + d.combo * 3;
                d.combo++;
                this.audio.playTone(660 + d.combo * 25, 0.1, 'sine');

                // Check 100% capacitor discharge
                if (d.powerStored >= 100) {
                  d.powerStored = 0;
                  d.score += 50;
                  this.audio.playTone(980, 0.2, 'triangle');
                  const cx = width / 2 + Math.cos(d.angle) * d.orbitRadius;
                  const cy = height / 2 + 10 + Math.sin(d.angle) * d.orbitRadius;
                  this.particles.emit(cx, cy, 22, '#00e5ff');
                }
              }
            } else {
              // CORONAL MASS SPIKE HAZARD!
              if (d.collectorDeployed) {
                d.staggerTimer = 0.9;
                d.collectorDeployed = false;
                d.powerStored = 0;
                d.combo = 0;
                d.score = Math.max(0, d.score - 25);
                this.audio.playTone(110, 0.3, 'sawtooth');
                const cx = width / 2 + Math.cos(d.angle) * d.orbitRadius;
                const cy = height / 2 + 10 + Math.sin(d.angle) * d.orbitRadius;
                this.particles.emit(cx, cy, 18, '#e74c3c');
              }
            }
          }
        }
      });
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const d = this.drones.get(botId);
    if (!d || d.staggerTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      // Look for upcoming flares in path
      const candidateFlare = this.flares.find((fl) => {
        let diff = (fl.angle - d.angle + Math.PI * 2) % (Math.PI * 2);
        return diff > 0 && diff < 0.45;
      });

      if (candidateFlare) {
        if (candidateFlare.type === 'coronal_spike') {
          d.collectorDeployed = false; // drop collector to evade spike
        } else {
          d.collectorDeployed = true; // deploy collector for plasma
        }
      } else {
        d.collectorDeployed = false;
      }
      bTimer = difficulty === 'bot_hard' ? 0.2 : difficulty === 'bot_normal' ? 0.35 : 0.5;
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 10;

    // Deep space Dyson Sphere interior background
    const bgGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 260);
    bgGrad.addColorStop(0, '#f39c12');
    bgGrad.addColorStop(0.35, '#2b1b17');
    bgGrad.addColorStop(0.8, '#0b0c16');
    bgGrad.addColorStop(1, '#05060b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Blazing Core Star
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fill();

    // Dyson Ring Lattice
    ctx.strokeStyle = 'rgba(236, 240, 241, 0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 150, 0, Math.PI * 2);
    ctx.arc(cx, cy, 175, 0, Math.PI * 2);
    ctx.stroke();

    // Solar Flares
    this.flares.forEach((fl) => {
      const isSpike = fl.type === 'coronal_spike';
      const maxLen = 190;
      const flareColor = isSpike ? '#e74c3c' : '#f39c12';

      if (fl.warningTimer > 0) {
        // Warning ray
        ctx.strokeStyle = `rgba(${isSpike ? '231, 76, 60' : '243, 156, 18'}, 0.35)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(fl.angle) * maxLen, cy + Math.sin(fl.angle) * maxLen);
        ctx.stroke();
      } else {
        // Full flare eruption
        ctx.strokeStyle = flareColor;
        ctx.lineWidth = isSpike ? 9 : 6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(fl.angle) * maxLen, cy + Math.sin(fl.angle) * maxLen);
        ctx.stroke();
      }
    });

    // Drones
    this.drones.forEach((d, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#00e5ff';
      const dx = cx + Math.cos(d.angle) * d.orbitRadius;
      const dy = cy + Math.sin(d.angle) * d.orbitRadius;

      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(d.angle + Math.PI / 2);

      if (d.staggerTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }

      // Drone Chassis
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-8, -12, 16, 24, 4);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Collector Solar Panels (Wings expand when deployed)
      const wingSpan = d.collectorDeployed ? 22 : 6;
      ctx.fillStyle = d.collectorDeployed ? '#00e5ff' : '#7f8c8d';
      ctx.fillRect(-8 - wingSpan, -6, wingSpan, 12);
      ctx.fillRect(8, -6, wingSpan, 12);

      ctx.restore();

      // Capacitor Bar over drone
      const barW = 32;
      ctx.fillStyle = '#1c2833';
      ctx.fillRect(dx - barW / 2, dy - 22, barW, 4);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(dx - barW / 2, dy - 22, (barW * d.powerStored) / 100, 4);

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${d.score}`, dx, dy + 24);
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☀️ HOLD PANELS TO ABSORB GOLD PLASMA • DODGE RED SPIKES!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.drones.forEach((d, pId) => scores.set(pId, d.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.drones.entries())
      .map(([playerId, d]) => ({ playerId, score: d.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} charged the Dyson Swarm grid to maximum!` : 'Collectors shattered by solar flares!',
    };
  }
}
