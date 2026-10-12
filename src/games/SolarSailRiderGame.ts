import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SolarAnomaly {
  id: number;
  x: number;
  type: 'cme_flare' | 'ion_storm';
  resolved: boolean;
}

interface SailCraft {
  id: PlayerId;
  laneY: number;
  craftX: number;
  sailDeployed: boolean;
  speed: number;
  score: number;
  combo: number;
  sailDamageTimer: number;
  sailSpread: number; // 0 to 1
  anomalies: SolarAnomaly[];
  nextAnomalyDist: number;
}

export class SolarSailRiderGame extends BaseGame {
  public crafts: Map<PlayerId, SailCraft> = new Map();
  public currentMapName: string = 'Helios Corona Corridor';
  private anomalyIdCounter: number = 0;
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
    this.crafts.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.5;
      this.crafts.set(p.id, {
        id: p.id,
        laneY,
        craftX: 110,
        sailDeployed: true,
        speed: 130,
        score: 0,
        combo: 0,
        sailDamageTimer: 0,
        sailSpread: 1.0,
        anomalies: [],
        nextAnomalyDist: 180,
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

    const baseScroll = 140;

    this.crafts.forEach((c) => {
      const p = this.getPlayer(c.id);

      if (c.sailDamageTimer > 0) c.sailDamageTimer -= dt;

      // Sail deployment animation transition
      const targetSpread = c.sailDeployed ? 1.0 : 0.15;
      c.sailSpread += (targetSpread - c.sailSpread) * dt * 8;

      // Human input: tap toggles sail deploy / furl
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(c.id) || this.input.justAction(c.id);
        if (justPressed) {
          c.sailDeployed = !c.sailDeployed;
          this.audio.playTone(c.sailDeployed ? 520 : 280, 0.08, 'triangle');
        }
      }

      // Photon wind pushes deployed sail forward
      if (c.sailDeployed && c.sailDamageTimer <= 0) {
        c.speed = Math.min(300, c.speed + 60 * dt);
        c.score += 4 * dt;
      } else {
        c.speed = Math.max(90, c.speed - 50 * dt);
      }

      // Spawning Anomalies
      c.nextAnomalyDist -= (baseScroll + c.speed * 0.4) * dt;
      if (c.nextAnomalyDist <= 0) {
        c.anomalies.push({
          id: ++this.anomalyIdCounter,
          x: width + 40,
          type: Math.random() > 0.45 ? 'cme_flare' : 'ion_storm',
          resolved: false,
        });
        c.nextAnomalyDist = 180 + Math.random() * 140;
      }

      // Update Anomalies
      for (let i = c.anomalies.length - 1; i >= 0; i--) {
        const a = c.anomalies[i];
        a.x -= (baseScroll + c.speed * 0.4) * dt;

        // Interaction zone with craft
        if (!a.resolved && a.x <= c.craftX + 35 && a.x >= c.craftX - 20) {
          a.resolved = true;
          if (a.type === 'cme_flare') {
            if (c.sailDeployed) {
              // RODE THE SOLAR FLARE!
              c.score += 35 + c.combo * 4;
              c.combo++;
              c.speed = Math.min(340, c.speed + 65);
              this.audio.playTone(760, 0.15, 'sine');
              this.particles.emit(c.craftX, c.laneY, 16, '#f39c12');
            } else {
              // Furled sail missed the flare
              c.score += 10;
              this.audio.playTone(380, 0.08, 'sine');
            }
          } else if (a.type === 'ion_storm') {
            if (c.sailDeployed) {
              // ION STORM BURNT DEPLOYED SAIL!
              c.sailDamageTimer = 1.0;
              c.sailDeployed = false;
              c.combo = 0;
              c.score = Math.max(0, c.score - 20);
              c.speed = 80;
              this.audio.playTone(120, 0.25, 'sawtooth');
              this.particles.emit(c.craftX, c.laneY, 18, '#9b59b6');
            } else {
              // SAFELY FURLED PAST ION STORM!
              c.score += 25 + c.combo * 3;
              c.combo++;
              this.audio.playTone(620, 0.1, 'triangle');
              this.particles.emit(c.craftX, c.laneY, 10, '#00e5ff');
            }
          }
        }

        if (a.x < -60) {
          c.anomalies.splice(i, 1);
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const c = this.crafts.get(botId);
    if (!c || c.sailDamageTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const incoming = c.anomalies.find((a) => !a.resolved && a.x > c.craftX && a.x < c.craftX + 160);
      if (incoming) {
        if (incoming.type === 'ion_storm') {
          // Should furl sail
          if (c.sailDeployed) {
            c.sailDeployed = false;
            bTimer = difficulty === 'bot_hard' ? 0.35 : 0.5;
          }
        } else if (incoming.type === 'cme_flare') {
          // Should deploy sail
          if (!c.sailDeployed) {
            c.sailDeployed = true;
            bTimer = 0.4;
          }
        }
      } else if (!c.sailDeployed) {
        // Deploy by default for speed
        c.sailDeployed = true;
        bTimer = 0.3;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Solar Corona ablaze background
    const bgGrad = ctx.createLinearGradient(0, 0, width, 0);
    bgGrad.addColorStop(0, '#f39c12');
    bgGrad.addColorStop(0.25, '#d35400');
    bgGrad.addColorStop(0.7, '#2c1e13');
    bgGrad.addColorStop(1, '#0e0b12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Blazing Star Core at left
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, height / 2, 70, 0, Math.PI * 2);
    ctx.fill();

    // Stream lines of solar photon wind
    ctx.strokeStyle = 'rgba(255, 235, 59, 0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const ly = 80 + i * 65;
      ctx.beginPath();
      ctx.moveTo(70, ly);
      ctx.lineTo(width, ly);
      ctx.stroke();
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    this.crafts.forEach((c, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#e67e22';

      // Lane boundary
      ctx.strokeStyle = 'rgba(243, 156, 18, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, c.laneY - laneHeight * 0.45);
      ctx.lineTo(width, c.laneY - laneHeight * 0.45);
      ctx.stroke();

      // Anomalies
      c.anomalies.forEach((a) => {
        if (a.resolved) return;
        if (a.type === 'cme_flare') {
          // Radiant golden solar flare surge
          ctx.fillStyle = '#f1c40f';
          ctx.beginPath();
          ctx.arc(a.x, c.laneY, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Purple crackling ion storm vortex
          ctx.fillStyle = '#8e44ad';
          ctx.beginPath();
          ctx.arc(a.x, c.laneY, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      });

      // Solar Sail Craft
      ctx.save();
      ctx.translate(c.craftX, c.laneY);

      if (c.sailDamageTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }

      // Titanium Spacecraft Spine
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(-12, -4, 28, 8);

      // Diamond reflective Solar Sail
      const sailHeight = 36 * c.sailSpread;
      ctx.fillStyle = c.sailDamageTimer > 0 ? '#7f8c8d' : 'rgba(0, 229, 255, 0.65)';
      ctx.beginPath();
      ctx.moveTo(-8, -sailHeight);
      ctx.lineTo(12, 0);
      ctx.lineTo(-8, sailHeight);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Photon Thruster engine
      ctx.fillStyle = color;
      ctx.fillRect(-18, -6, 8, 12);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(-24, -3, 6, 6);

      ctx.restore();

      // HUD / Status
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(c.score)} pts`, 20, c.laneY - laneHeight * 0.22);
      ctx.fillStyle = c.sailDeployed ? '#00e676' : '#f39c12';
      ctx.fillText(c.sailDeployed ? 'SAIL OPEN' : 'FURLED', 140, c.laneY - laneHeight * 0.22);
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☀️ TAP TO OPEN/FURL SAIL • CATCH FLARES, DODGE STORMS!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.crafts.forEach((c, pId) => scores.set(pId, Math.floor(c.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.crafts.entries())
      .map(([playerId, c]) => ({ playerId, score: Math.floor(c.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} rode the solar photon gale to victory!` : 'All sails vaporized by the star!',
    };
  }
}
