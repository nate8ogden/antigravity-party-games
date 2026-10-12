import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PainterSkater {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  rollerWidth: number;
  megaTimer: number;
  desiredAngle: number;
  score: number; // percentage or tile count
  paintedTiles: number;
  botReactionTimer: number;
}

interface PaintPowerUp {
  x: number;
  y: number;
  type: 'MEGA_ROLLER';
  active: boolean;
  pulseTimer: number;
}

export class FloorPainterGame extends BaseGame {
  private gridCols = 48;
  private gridRows = 32;
  private tileW = 0;
  private tileH = 0;
  private originX = 0;
  private originY = 0;

  // tileOwners[c][r] = PlayerId | null
  private tileOwners: (PlayerId | null)[][] = [];
  private skaters: Map<PlayerId, PainterSkater> = new Map();
  private powerUps: PaintPowerUp[] = [];
  private currentMapName: string = 'Neon Roller Rink';
  private totalTiles = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 45.0;
    this.isFinished = false;

    const maps = ['Neon Roller Rink', 'Velodrome Paint Pit', 'Urban Graffiti Lot', 'Cyber Roller Dome'];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];

    this.tileW = (width - 40) / this.gridCols;
    this.tileH = (height - 110) / this.gridRows;
    this.originX = 20;
    this.originY = 80;

    this.totalTiles = this.gridCols * this.gridRows;
    this.tileOwners = [];
    for (let c = 0; c < this.gridCols; c++) {
      this.tileOwners[c] = [];
      for (let r = 0; r < this.gridRows; r++) {
        this.tileOwners[c][r] = null;
      }
    }

    this.setupSkaters(width, height);
    this.powerUps = [
      { x: width * 0.35, y: height * 0.45, type: 'MEGA_ROLLER', active: true, pulseTimer: 0 },
      { x: width * 0.65, y: height * 0.55, type: 'MEGA_ROLLER', active: true, pulseTimer: 0 }
    ];
  }

  private setupSkaters(width: number, height: number): void {
    this.skaters.clear();
    const active = this.getActivePlayers();

    const spawnCorners = [
      { x: 70, y: 130, a: 0.6 },
      { x: width - 70, y: 130, a: 2.5 },
      { x: 70, y: height - 60, a: -0.6 },
      { x: width - 70, y: height - 60, a: -2.5 }
    ];

    active.forEach((p, idx) => {
      const sp = spawnCorners[idx % spawnCorners.length];
      this.skaters.set(p.id, {
        id: p.id,
        x: sp.x,
        y: sp.y,
        vx: Math.cos(sp.a) * 190,
        vy: Math.sin(sp.a) * 190,
        angle: sp.a,
        speed: 210,
        rollerWidth: 16,
        megaTimer: 0,
        desiredAngle: sp.a,
        score: 0,
        paintedTiles: 0,
        botReactionTimer: 0.2 + Math.random() * 0.2
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Update Power-ups
    for (const pu of this.powerUps) {
      pu.pulseTimer += dt * 4;
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update Skaters
    for (const p of this.getActivePlayers()) {
      const s = this.skaters.get(p.id);
      if (!s) continue;

      if (s.megaTimer > 0) {
        s.megaTimer -= dt;
        s.rollerWidth = 32;
      } else {
        s.rollerWidth = 16;
      }

      if (!p.type.startsWith('bot_')) {
        const isTurning = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);
        const steer = this.input.getSteer(p.id);

        if (Math.abs(steer) > 0.2) {
          s.angle += steer * 3.6 * dt;
        } else if (isTurning) {
          s.angle += 3.2 * dt; // Clockwise steer on single tap hold
        }
      }

      s.vx = Math.cos(s.angle) * s.speed;
      s.vy = Math.sin(s.angle) * s.speed;

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Arena bounds bounce
      if (s.x < 30 || s.x > width - 30) {
        s.angle = Math.PI - s.angle;
        s.x = Math.max(30, Math.min(width - 30, s.x));
      }
      if (s.y < 90 || s.y > height - 30) {
        s.angle = -s.angle;
        s.y = Math.max(90, Math.min(height - 30, s.y));
      }

      // Paint tiles under skater
      this.paintFloor(s, p.color);

      // Check power-up collection
      for (const pu of this.powerUps) {
        if (pu.active) {
          const d = Math.hypot(s.x - pu.x, s.y - pu.y);
          if (d < 24) {
            pu.active = false;
            s.megaTimer = 6.0;
            this.audio.playChime();
          }
        }
      }
    }

    // Skater vs Skater Bumping
    const skaterList = Array.from(this.skaters.values());
    for (let i = 0; i < skaterList.length; i++) {
      for (let j = i + 1; j < skaterList.length; j++) {
        const s1 = skaterList[i];
        const s2 = skaterList[j];
        const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
        if (dist < 26) {
          // Elastic bump
          const angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
          s1.angle = angle + Math.PI;
          s2.angle = angle;
          this.audio.playBounce();

          this.particles.emit((s1.x + s2.x) / 2, (s1.y + s2.y) / 2, 8, '#F59E0B');
        }
      }
    }

    this.recalculateScores();
  }

  private paintFloor(s: PainterSkater, _color: string): void {
    const rad = s.rollerWidth / 2;
    const minC = Math.max(0, Math.floor((s.x - rad - this.originX) / this.tileW));
    const maxC = Math.min(this.gridCols - 1, Math.floor((s.x + rad - this.originX) / this.tileW));
    const minR = Math.max(0, Math.floor((s.y - rad - this.originY) / this.tileH));
    const maxR = Math.min(this.gridRows - 1, Math.floor((s.y + rad - this.originY) / this.tileH));

    for (let c = minC; c <= maxC; c++) {
      for (let r = minR; r <= maxR; r++) {
        const tileCenterX = this.originX + c * this.tileW + this.tileW / 2;
        const tileCenterY = this.originY + r * this.tileH + this.tileH / 2;
        const dist = Math.hypot(s.x - tileCenterX, s.y - tileCenterY);

        if (dist <= rad) {
          this.tileOwners[c][r] = s.id;
        }
      }
    }
  }

  private recalculateScores(): void {
    const counts = new Map<PlayerId, number>();
    for (const p of this.getActivePlayers()) {
      counts.set(p.id, 0);
    }

    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const owner = this.tileOwners[c][r];
        if (owner !== null && counts.has(owner)) {
          counts.set(owner, (counts.get(owner) || 0) + 1);
        }
      }
    }

    for (const [pid, count] of counts.entries()) {
      const s = this.skaters.get(pid);
      if (s) {
        s.paintedTiles = count;
        s.score = Math.round((count / this.totalTiles) * 100);
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const s = this.skaters.get(botId);
    if (!s) return;

    s.botReactionTimer -= dt;
    if (s.botReactionTimer <= 0) {
      const baseDelay =
        difficulty === 'bot_easy' ? 0.35 : difficulty === 'bot_normal' ? 0.18 : 0.08;
      s.botReactionTimer = baseDelay;

      // Find nearest mega power-up or unpainted sector
      let targetX = s.x + Math.cos(s.angle) * 100;
      let targetY = s.y + Math.sin(s.angle) * 100;

      const availablePowerUp = this.powerUps.find((p) => p.active);
      if (availablePowerUp && Math.random() < 0.7) {
        targetX = availablePowerUp.x;
        targetY = availablePowerUp.y;
      }

      s.desiredAngle = Math.atan2(targetY - s.y, targetX - s.x);
    }

    // Continuous smooth steering towards desired angle every frame
    let diff = s.desiredAngle - s.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const turnRate = difficulty === 'bot_hard' ? 4.8 : difficulty === 'bot_normal' ? 3.6 : 2.4;
    s.angle += Math.sign(diff) * Math.min(Math.abs(diff), turnRate * dt);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Dark Rink Floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // 2. Painted Tiles
    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const owner = this.tileOwners[c][r];
        if (owner !== null) {
          const pConfig = this.players.find((p) => p.id === owner);
          if (pConfig) {
            ctx.fillStyle = pConfig.color;
            ctx.fillRect(
              this.originX + c * this.tileW,
              this.originY + r * this.tileH,
              this.tileW + 0.5,
              this.tileH + 0.5
            );
          }
        }
      }
    }

    // 3. Power-ups
    for (const pu of this.powerUps) {
      if (!pu.active) continue;
      const pulse = 1 + Math.sin(pu.pulseTimer) * 0.2;

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, 14 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Procedural Vector Lightning Bolt badge (No emojis)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(pu.x + 1, pu.y - 7);
      ctx.lineTo(pu.x - 4, pu.y + 1);
      ctx.lineTo(pu.x, pu.y + 1);
      ctx.lineTo(pu.x - 1, pu.y + 7);
      ctx.lineTo(pu.x + 4, pu.y - 1);
      ctx.lineTo(pu.x, pu.y - 1);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Roller Skaters
    for (const p of this.getActivePlayers()) {
      const s = this.skaters.get(p.id);
      if (!s) continue;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);

      // Paint roller bar behind skater
      ctx.fillStyle = s.megaTimer > 0 ? '#F59E0B' : p.colorDark;
      ctx.fillRect(-12, -s.rollerWidth / 2, 6, s.rollerWidth);

      // Skater body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();

      // Skates
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-6, -11, 4, 3);
      ctx.fillRect(-6, 8, 4, 3);

      ctx.restore();
    }

    // 5. Header & Timer
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`RINK: ${this.currentMapName.toUpperCase()} • FLOOR PAINTER TURF WAR`, width / 2, 28);

    const timerSec = Math.ceil(this.roundTimer);
    ctx.fillStyle = this.roundTimer < 10 ? '#EF4444' : '#F8FAFC';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${timerSec}s`, width / 2, 52);

    // 6. Corner HUDs
    for (const p of this.getActivePlayers()) {
      const s = this.skaters.get(p.id);
      if (!s) continue;

      let px = 20;
      let py = 20;
      if (p.corner === 'top-right') px = width - 160;
      else if (p.corner === 'bottom-left') py = height - 90;
      else if (p.corner === 'bottom-right') {
        px = width - 160;
        py = height - 90;
      }

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, 140, 70, 8);
      else ctx.rect(px, py, 140, 70);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 20);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${s.score}% turf`, px + 10, py + 42);

      ctx.fillStyle = s.megaTimer > 0 ? '#F59E0B' : '#94A3B8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(s.megaTimer > 0 ? 'MEGA ROLLER! ⚡' : `${s.paintedTiles} tiles`, px + 10, py + 60);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.skaters.get(a.id)?.paintedTiles || 0;
      const sb = this.skaters.get(b.id)?.paintedTiles || 0;
      return sb - sa;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topPct = this.skaters.get(winnerId ?? 0)?.score || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.skaters.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Turf monarch! Covered ${topPct}% of ${this.currentMapName} in custom paint!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
