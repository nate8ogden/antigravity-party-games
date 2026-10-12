import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface StarMote {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

interface SkyGlider {
  id: PlayerId;
  x: number;
  y: number;
  vy: number;
  score: number;
  combo: number;
  auroraCharge: number;
  gliderAngle: number;
}

export class AuroraCollectorGame extends BaseGame {
  public gliders: Map<PlayerId, SkyGlider> = new Map();
  public starMotes: StarMote[] = [];
  public currentMapName: string = 'Tromso Aurora Borealis';

  private moteIdCounter: number = 0;
  private nextMoteDist: number = 140;
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
    this.gliders.clear();
    this.starMotes = [];
    this.botReactionTimers.clear();
    this.nextMoteDist = 120;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = width * 0.18 + idx * 35;
      this.gliders.set(p.id, {
        id: p.id,
        x: startX,
        y: height * 0.45,
        vy: 0,
        score: 0,
        combo: 0,
        auroraCharge: 0,
        gliderAngle: 0,
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

    const scrollSpeed = 160;

    // Spawning Star Motes
    this.nextMoteDist -= scrollSpeed * dt;
    if (this.nextMoteDist <= 0) {
      this.starMotes.push({
        id: ++this.moteIdCounter,
        x: width + 30,
        y: height * 0.25 + Math.random() * (height * 0.45),
        collected: false,
      });
      this.nextMoteDist = 130 + Math.random() * 90;
    }

    // Update motes
    for (let i = this.starMotes.length - 1; i >= 0; i--) {
      this.starMotes[i].x -= scrollSpeed * dt;
      if (this.starMotes[i].x < -40) {
        this.starMotes.splice(i, 1);
      }
    }

    // Aurora ribbon center wave
    const waveTime = Date.now() * 0.002;

    this.gliders.forEach((g) => {
      const p = this.getPlayer(g.id);

      // Human input: Tap to flap lift
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(g.id) || this.input.justAction(g.id);
        if (justPressed) {
          this.executeFlap(g);
        }
      }

      // Physics
      g.y += g.vy * dt;
      g.vy += 420 * dt; // gravity
      g.gliderAngle += (0 - g.gliderAngle) * dt * 4;

      // Keep inside bounds
      if (g.y > height * 0.85) {
        g.y = height * 0.85;
        g.vy = -100;
      } else if (g.y < 80) {
        g.y = 80;
        g.vy = 50;
      }

      // Check if inside Aurora ribbon (sine wave)
      const idealAuroraY = height * 0.45 + Math.sin(waveTime + g.x * 0.01) * 65;
      const distFromAurora = Math.abs(g.y - idealAuroraY);

      if (distFromAurora < 45) {
        // Charging from aurora ribbon
        g.score += 15 * dt;
        g.auroraCharge = Math.min(100, g.auroraCharge + 35 * dt);
        if (g.auroraCharge >= 100) {
          g.auroraCharge = 0;
          g.score += 30;
          this.audio.playTone(880, 0.15, 'sine');
          this.particles.emit(g.x, g.y, 14, '#2ecc71');
        }
      } else {
        g.auroraCharge = Math.max(0, g.auroraCharge - 20 * dt);
      }

      // Mote collection
      this.starMotes.forEach((m) => {
        if (!m.collected && Math.hypot(m.x - g.x, m.y - g.y) < 24) {
          m.collected = true;
          g.score += 35 + g.combo * 3;
          g.combo++;
          this.audio.playTone(720 + g.combo * 30, 0.12, 'triangle');
          this.particles.emit(m.x, m.y, 14, '#f1c40f');
        }
      });
    });
  }

  private executeFlap(g: SkyGlider): void {
    g.vy = -240;
    g.gliderAngle = -0.4;
    this.audio.playTone(480, 0.08, 'sine');
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    height: number
  ): void {
    const g = this.gliders.get(botId);
    if (!g) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const waveTime = Date.now() * 0.002;
      const idealAuroraY = height * 0.45 + Math.sin(waveTime + g.x * 0.01) * 65;

      const targetMote = this.starMotes.find((m) => !m.collected && m.x > g.x && m.x < g.x + 140);
      const targetY = targetMote ? targetMote.y : idealAuroraY;

      if (g.y > targetY + 12) {
        this.executeFlap(g);
        bTimer = difficulty === 'bot_hard' ? 0.22 : difficulty === 'bot_normal' ? 0.35 : 0.5;
      } else {
        bTimer = 0.15;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Night Arctic starry sky background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#040b14');
    bgGrad.addColorStop(0.5, '#0b192c');
    bgGrad.addColorStop(1, '#02060c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 37) % width;
      const sy = (i * 23) % (height * 0.7);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Dancing Aurora Borealis Ribbons
    const waveTime = Date.now() * 0.002;
    ctx.save();
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.4)';
    ctx.lineWidth = 48;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = 0; x <= width; x += 30) {
      const y = height * 0.45 + Math.sin(waveTime + x * 0.01) * 65;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Inner Violet Ribbon
    ctx.strokeStyle = 'rgba(155, 89, 182, 0.35)';
    ctx.lineWidth = 24;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 30) {
      const y = height * 0.45 + Math.sin(waveTime + 0.8 + x * 0.01) * 65;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Star Motes
    this.starMotes.forEach((m) => {
      if (m.collected) return;
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Sky Gliders
    this.gliders.forEach((g, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#00e5ff';

      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.gliderAngle);

      // Celestial Glider Wings
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-16, 6);
      ctx.lineTo(16, 0);
      ctx.lineTo(-16, -6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pilot Cockpit
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Aurora Prism Bar above glider
      const barW = 32;
      ctx.fillStyle = '#1c2833';
      ctx.fillRect(g.x - barW / 2, g.y - 18, barW, 4);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(g.x - barW / 2, g.y - 18, (barW * g.auroraCharge) / 100, 4);

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(g.score)}`, g.x, g.y - 24);
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨ TAP TO SOAR INSIDE AURORA RIBBONS • CATCH MOTES!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.gliders.forEach((g, pId) => scores.set(pId, Math.floor(g.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.gliders.entries())
      .map(([playerId, g]) => ({ playerId, score: Math.floor(g.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} gathered the radiant light of the Northern Aurora!` : 'Gliders lost in the dark sky!',
    };
  }
}
