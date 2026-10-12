import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BeaconStation {
  id: PlayerId;
  x: number;
  y: number;
  flameLevel: number; // 0 to 100
  windShieldRaised: boolean;
  windGustActive: boolean;
  gustTimer: number; // time left in current gust
  nextGustTimer: number; // time until next gust
  score: number;
  combo: number;
  staggerTimer: number;
}

export class BlizzardBeaconGame extends BaseGame {
  public stations: Map<PlayerId, BeaconStation> = new Map();
  public currentMapName: string = 'Yukon Blizzard Outpost';
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
    this.stations.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      this.stations.set(p.id, {
        id: p.id,
        x: cx,
        y: height * 0.65,
        flameLevel: 50,
        windShieldRaised: false,
        windGustActive: false,
        gustTimer: 0,
        nextGustTimer: 2.0 + Math.random() * 1.5,
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

    this.stations.forEach((st) => {
      const p = this.getPlayer(st.id);

      if (st.staggerTimer > 0) st.staggerTimer -= dt;

      // Human inputs: HOLD to raise windshield, TAP to stoke firewood
      if (p && !p.type.startsWith('bot_')) {
        st.windShieldRaised = this.input.isPressed(st.id) && st.staggerTimer <= 0;
        const justReleased = this.input.justReleased(st.id);
        if (justReleased && st.staggerTimer <= 0) {
          this.stokeFire(st);
        }
      }

      // Wind gust cycle
      if (st.windGustActive) {
        st.gustTimer -= dt;
        if (st.windShieldRaised) {
          // Successfully shielded flame
          st.score += 15 * dt;
        } else {
          // Flame battered by icy winds!
          st.flameLevel = Math.max(10, st.flameLevel - 45 * dt);
          st.score = Math.max(0, st.score - 20 * dt);
          st.combo = 0;
          this.particles.emit(st.x, st.y - 30, 4, '#ebf5fb');
        }

        if (st.gustTimer <= 0) {
          st.windGustActive = false;
          st.nextGustTimer = 2.5 + Math.random() * 2.0;
        }
      } else {
        st.nextGustTimer -= dt;
        if (st.nextGustTimer <= 0) {
          st.windGustActive = true;
          st.gustTimer = 1.2 + Math.random() * 0.8;
          this.audio.playTone(180, 0.25, 'sawtooth');
        }

        // Natural flame decay when idle
        st.flameLevel = Math.max(20, st.flameLevel - 8 * dt);
      }
    });
  }

  private stokeFire(st: BeaconStation): void {
    if (!st.windGustActive) {
      // Good stoke
      st.flameLevel = Math.min(100, st.flameLevel + 22);
      st.score += 25 + st.combo * 3;
      st.combo++;
      this.audio.playTone(580 + st.combo * 25, 0.1, 'sine');
      this.particles.emit(st.x, st.y - 35, 12, '#f39c12');
    } else {
      // Stoked during gust: ash flew everywhere
      st.staggerTimer = 0.5;
      st.combo = 0;
      st.score = Math.max(0, st.score - 10);
      this.audio.playTone(130, 0.2, 'square');
      this.particles.emit(st.x, st.y - 35, 10, '#7f8c8d');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const st = this.stations.get(botId);
    if (!st || st.staggerTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      if (st.windGustActive) {
        st.windShieldRaised = true;
        bTimer = 0.4;
      } else {
        st.windShieldRaised = false;
        if (st.flameLevel < 75) {
          this.stokeFire(st);
          bTimer = difficulty === 'bot_hard' ? 0.35 : 0.6;
        } else {
          bTimer = 0.3;
        }
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Arctic blizzard swirling atmosphere
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0c1b26');
    bgGrad.addColorStop(0.5, '#1e384d');
    bgGrad.addColorStop(1, '#0e1c26');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Blowing snow particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 30; i++) {
      const sx = ((Date.now() * 0.4 + i * 35) % width);
      const sy = ((Date.now() * 0.15 + i * 40) % height);
      ctx.fillRect(sx, sy, 3, 2);
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.stations.forEach((st, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#f39c12';

      // Stone hearth pedestal
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(st.x - 30, st.y + 12, 60, 24);
      ctx.fillStyle = '#34495e';
      ctx.fillRect(st.x - 36, st.y + 36, 72, 16);

      // Iron Brazier Basin
      ctx.fillStyle = '#1c2833';
      ctx.beginPath();
      ctx.ellipse(st.x, st.y + 8, 24, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Beacon Fire Flame
      const flameH = (st.flameLevel / 100) * 45;
      const flameW = 12 + (st.flameLevel / 100) * 14;

      ctx.fillStyle = st.flameLevel > 50 ? '#f39c12' : '#e74c3c';
      ctx.shadowColor = '#f1c40f';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(st.x - flameW / 2, st.y + 8);
      ctx.quadraticCurveTo(st.x - flameW * 0.8, st.y - flameH * 0.5, st.x, st.y - flameH);
      ctx.quadraticCurveTo(st.x + flameW * 0.8, st.y - flameH * 0.5, st.x + flameW / 2, st.y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner yellow core
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(st.x, st.y - flameH * 0.3, flameW * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Windshield Wall (when raised)
      if (st.windShieldRaised) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(st.x - 34, st.y - 48, 8, 60, 4);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Wind Gust warning / visual arrows
      if (st.windGustActive) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const gx = st.x - 60 + i * 20;
          ctx.beginPath();
          ctx.moveTo(gx, st.y - 20 - i * 10);
          ctx.lineTo(gx + 16, st.y - 20 - i * 10);
          ctx.stroke();
        }
      }

      // Flame Thermometer Bar
      const barW = 50;
      const barH = 6;
      ctx.fillStyle = '#1c2833';
      ctx.fillRect(st.x - barW / 2, st.y + 58, barW, barH);
      ctx.fillStyle = st.flameLevel > 60 ? '#f1c40f' : (st.flameLevel > 30 ? '#e67e22' : '#e74c3c');
      ctx.fillRect(st.x - barW / 2, st.y + 58, (barW * st.flameLevel) / 100, barH);

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(st.score)}`, st.x, height * 0.88);
      if (st.combo > 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${st.combo}x BLAZING`, st.x, height * 0.92);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 HOLD TO SHIELD FROM GUSTS • RELEASE TO STOKE FIRE!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.stations.forEach((st, pId) => scores.set(pId, Math.floor(st.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.stations.entries())
      .map(([playerId, st]) => ({ playerId, score: Math.floor(st.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} kept the emergency beacon ablaze through the blizzard!` : 'All beacon flames snuffed by the blizzard!',
    };
  }
}
