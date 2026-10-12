import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Disc {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  lastHitterId: PlayerId | null;
  trail: { x: number; y: number; alpha: number }[];
}

interface CyberPlayer {
  id: PlayerId;
  x: number;
  y: number;
  radius: number;
  angle: number;
  score: number;
  shields: number;
  isShieldActive: boolean;
  shieldCooldown: number;
  team: 'LEFT' | 'RIGHT';
}

export class CyberDiscGame extends BaseGame {
  public disc: Disc = { x: 400, y: 300, vx: 320, vy: 180, radius: 14, speed: 380, lastHitterId: null, trail: [] };
  public playersState: Map<PlayerId, CyberPlayer> = new Map();
  public currentMapName: string = 'Neon Grid Velodrome';

  private arenaBounds = { minX: 60, maxX: 740, minY: 60, maxY: 540 };
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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.playersState.clear();
    this.botReactionTimers.clear();

    this.arenaBounds = {
      minX: width * 0.08,
      maxX: width * 0.92,
      minY: height * 0.12,
      maxY: height * 0.88
    };

    // Initialize Disc at center
    const angle = (Math.random() > 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.8;
    this.disc = {
      x: width * 0.5,
      y: height * 0.5,
      vx: Math.cos(angle) * 360,
      vy: Math.sin(angle) * 360,
      radius: 14,
      speed: 360,
      lastHitterId: null,
      trail: []
    };

    // Spawn players on Left / Right half courts
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const team = (idx % 2 === 0) ? 'LEFT' : 'RIGHT';
      const startX = team === 'LEFT' ? this.arenaBounds.minX + 80 : this.arenaBounds.maxX - 80;
      const startY = (idx < 2) ? height * 0.35 : height * 0.65;

      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        radius: 20,
        angle: team === 'LEFT' ? 0 : Math.PI,
        score: 0,
        shields: 5,
        isShieldActive: false,
        shieldCooldown: 0,
        team
      });
      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.shieldCooldown > 0) ps.shieldCooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      if (steer !== 0 || throttle !== 0) {
        ps.angle = Math.atan2(-throttle, steer);
      }

      // Movement restricted to team court half
      const speed = 260;
      ps.x += steer * speed * dt;
      ps.y += -throttle * speed * dt;

      const midX = width * 0.5;
      const minX = ps.team === 'LEFT' ? this.arenaBounds.minX + ps.radius : midX + ps.radius + 6;
      const maxX = ps.team === 'LEFT' ? midX - ps.radius - 6 : this.arenaBounds.maxX - ps.radius;
      ps.x = Math.max(minX, Math.min(maxX, ps.x));
      ps.y = Math.max(this.arenaBounds.minY + ps.radius, Math.min(this.arenaBounds.maxY - ps.radius, ps.y));

      // Shield actuation
      ps.isShieldActive = isAction && ps.shieldCooldown <= 0;
    }

    // Update Disc movement
    this.disc.x += this.disc.vx * dt;
    this.disc.y += this.disc.vy * dt;

    // Trail recording
    this.disc.trail.push({ x: this.disc.x, y: this.disc.y, alpha: 1.0 });
    if (this.disc.trail.length > 16) this.disc.trail.shift();
    this.disc.trail.forEach((t) => (t.alpha -= dt * 2.0));

    // Top / Bottom boundary bounce
    if (this.disc.y - this.disc.radius <= this.arenaBounds.minY) {
      this.disc.y = this.arenaBounds.minY + this.disc.radius;
      this.disc.vy = Math.abs(this.disc.vy);
      if (Math.abs(this.disc.vx) < 140) {
        this.disc.vx = (this.disc.vx >= 0 ? 1 : -1) * 160;
      }
      this.audio.playBounce();
      this.particles.spawnSparks(this.disc.x, this.disc.y, '#06B6D4', 6);
    } else if (this.disc.y + this.disc.radius >= this.arenaBounds.maxY) {
      this.disc.y = this.arenaBounds.maxY - this.disc.radius;
      this.disc.vy = -Math.abs(this.disc.vy);
      if (Math.abs(this.disc.vx) < 140) {
        this.disc.vx = (this.disc.vx >= 0 ? 1 : -1) * 160;
      }
      this.audio.playBounce();
      this.particles.spawnSparks(this.disc.x, this.disc.y, '#06B6D4', 6);
    }

    // Left / Right Goal Arc detection
    if (this.disc.x - this.disc.radius <= this.arenaBounds.minX) {
      // GOAL FOR RIGHT TEAM!
      this.handleGoal('RIGHT', width, height);
    } else if (this.disc.x + this.disc.radius >= this.arenaBounds.maxX) {
      // GOAL FOR LEFT TEAM!
      this.handleGoal('LEFT', width, height);
    }

    // Player shield deflect / paddle collision
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const dist = Math.hypot(this.disc.x - ps.x, this.disc.y - ps.y);
      const hitRadius = ps.radius + this.disc.radius + (ps.isShieldActive ? 12 : 2);

      if (dist < hitRadius) {
        // Calculate forward deflection vector based on contact offset
        const contactOffset = Math.max(-1, Math.min(1, (this.disc.y - ps.y) / (ps.radius + this.disc.radius)));
        const maxAngle = Math.PI * 0.35; // +/- 63 degrees
        let deflectAngle = ps.team === 'LEFT' ? contactOffset * maxAngle : Math.PI - contactOffset * maxAngle;

        if (ps.isShieldActive) {
          // Power deflection with shield smash
          this.disc.speed = Math.min(880, this.disc.speed + 80);
          this.audio.playLaser();
          this.particles.shake(5);
          this.particles.spawnExplosion(this.disc.x, this.disc.y, '#38BDF8', 18);
          ps.score += 50;
        } else {
          this.disc.speed = Math.min(760, this.disc.speed + 30);
          this.audio.playBounce();
          this.particles.spawnSparks(this.disc.x, this.disc.y, '#FBBF24', 8);
          ps.score += 20;
        }

        this.disc.vx = Math.cos(deflectAngle) * this.disc.speed;
        this.disc.vy = Math.sin(deflectAngle) * this.disc.speed;
        this.disc.lastHitterId = ps.id;

        // Push disc safely outside player body
        this.disc.x = ps.x + Math.cos(deflectAngle) * (hitRadius + 3);
        this.disc.y = ps.y + Math.sin(deflectAngle) * (hitRadius + 3);
        break;
      }
    }

    // Round over condition
    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleGoal(scoringTeam: 'LEFT' | 'RIGHT', width: number, height: number): void {
    this.audio.playFanfare();
    this.particles.shake(8);
    this.particles.spawnExplosion(this.disc.x, this.disc.y, '#EC4899', 28);

    // Award score to players on scoring team
    for (const ps of this.playersState.values()) {
      if (ps.team === scoringTeam) {
        ps.score += 300;
      } else {
        ps.shields = Math.max(0, ps.shields - 1);
      }
    }

    // Reset Disc to center
    const resetAngle = (scoringTeam === 'LEFT' ? Math.PI : 0) + (Math.random() - 0.5) * 0.6;
    this.disc.x = width * 0.5;
    this.disc.y = height * 0.5;
    this.disc.speed = 360;
    this.disc.vx = Math.cos(resetAngle) * this.disc.speed;
    this.disc.vy = Math.sin(resetAngle) * this.disc.speed;
    this.disc.trail = [];
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.playersState.get(botId);
    if (!bot) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.32 + Math.random() * 0.22
        : difficulty === 'bot_normal'
        ? 0.16 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    // Predict disc trajectory and intercept Y coordinate
    const targetY = this.disc.y;
    const dy = targetY - bot.y;

    if (Math.abs(dy) > 10) {
      bot.y += Math.sign(dy) * 240 * dt * 4;
    }

    // Orient towards enemy goal
    bot.angle = bot.team === 'LEFT' ? 0 : Math.PI;

    // Activate shield if disc is close and heading towards goal
    const distToDisc = Math.hypot(this.disc.x - bot.x, this.disc.y - bot.y);
    if (distToDisc < 90 && Math.random() < (difficulty === 'bot_hard' ? 0.9 : 0.6)) {
      bot.isShieldActive = true;
    } else {
      bot.isShieldActive = false;
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} dominated the Cyber Velodrome with superior disc deflections!`
      : 'Velodrome deadlock! Disc energy stabilized!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Dark Tron Cyber Grid
    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, width, height);

    // Neon floor grid lines
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.18)';
    ctx.lineWidth = 1;
    for (let x = this.arenaBounds.minX; x <= this.arenaBounds.maxX; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, this.arenaBounds.minY);
      ctx.lineTo(x, this.arenaBounds.maxY);
      ctx.stroke();
    }
    for (let y = this.arenaBounds.minY; y <= this.arenaBounds.maxY; y += 40) {
      ctx.beginPath();
      ctx.moveTo(this.arenaBounds.minX, y);
      ctx.lineTo(this.arenaBounds.maxX, y);
      ctx.stroke();
    }

    // Center divider
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(width * 0.5, this.arenaBounds.minY);
    ctx.lineTo(width * 0.5, this.arenaBounds.maxY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glowing Arena Perimeter
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.strokeRect(
      this.arenaBounds.minX,
      this.arenaBounds.minY,
      this.arenaBounds.maxX - this.arenaBounds.minX,
      this.arenaBounds.maxY - this.arenaBounds.minY
    );

    // Goal Lines
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(this.arenaBounds.minX, this.arenaBounds.minY + 40);
    ctx.lineTo(this.arenaBounds.minX, this.arenaBounds.maxY - 40);
    ctx.stroke();

    ctx.strokeStyle = '#3B82F6';
    ctx.beginPath();
    ctx.moveTo(this.arenaBounds.maxX, this.arenaBounds.minY + 40);
    ctx.lineTo(this.arenaBounds.maxX, this.arenaBounds.maxY - 40);
    ctx.stroke();

    // 2. Disc and Neon Ribbon Trail
    ctx.save();
    if (this.disc.trail.length > 1) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = this.disc.radius * 1.6;
      ctx.beginPath();
      this.disc.trail.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }

    // Glowing Disc Outer Halo
    const discHalo = ctx.createRadialGradient(this.disc.x, this.disc.y, 4, this.disc.x, this.disc.y, this.disc.radius * 2);
    discHalo.addColorStop(0, '#FFFFFF');
    discHalo.addColorStop(0.4, '#38BDF8');
    discHalo.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = discHalo;
    ctx.beginPath();
    ctx.arc(this.disc.x, this.disc.y, this.disc.radius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Inner Core
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(this.disc.x, this.disc.y, this.disc.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Draw Players and Shields
    for (const p of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === p.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      // Shield aura
      if (p.isShieldActive) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 12, p.angle - 1.1, p.angle + 1.1);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Cyber Body
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Energy Visor
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.radius * 0.4, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Player Pill
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}`, p.x, p.y - p.radius - 8);
    }

    // 4. Draw HUD
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width * 0.5, 30);

    // Score bar
    const active = this.getActivePlayers();
    const itemW = 95;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(subBarX, 54, subBarW, 26, 6);
    ctx.fill();

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${p.id + 1}: ⚡${ps?.score || 0}`, px, 67);
    });

    ctx.restore();
  }
}
