import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Arrow {
  id: number;
  shooterId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  trail: { x: number; y: number }[];
}

interface Invader {
  id: number;
  type: 'goblin' | 'shield_bearer' | 'ram';
  x: number;
  y: number;
  speed: number;
  health: number;
  maxHealth: number;
  radius: number;
  points: number;
  isHit: boolean;
  hitAnim: number;
}

interface ArcherPlayer {
  id: PlayerId;
  x: number;
  y: number;
  aimAngle: number;
  cooldown: number;
  score: number;
  hits: number;
  arrowsShot: number;
}

export class CastleArcherGame extends BaseGame {
  public playersState: Map<PlayerId, ArcherPlayer> = new Map();
  public arrows: Arrow[] = [];
  public invaders: Invader[] = [];
  public currentMapName: string = 'Castle Parapet Defense';

  private arrowIdCounter: number = 0;
  private invaderIdCounter: number = 0;
  private spawnTimer: number = 0.5;
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
    this.arrows = [];
    this.invaders = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.spawnTimer = 0.4;

    const active = this.getActivePlayers();
    const spacing = width / (active.length + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: 65, // Standing on top castle parapets
        aimAngle: Math.PI / 2, // Aiming downward toward the field
        cooldown: 0,
        score: 0,
        hits: 0,
        arrowsShot: 0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.25);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Spawn invaders advancing upward from bottom towards the castle
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.55 + Math.random() * 0.35;
      const roll = Math.random();
      let type: 'goblin' | 'shield_bearer' | 'ram' = 'goblin';
      let hp = 1;
      let spd = 65;
      let pts = 80;
      let rad = 14;

      if (roll < 0.25) {
        type = 'ram';
        hp = 3;
        spd = 40;
        pts = 220;
        rad = 22;
      } else if (roll < 0.6) {
        type = 'shield_bearer';
        hp = 2;
        spd = 50;
        pts = 140;
        rad = 16;
      }

      this.invaders.push({
        id: this.invaderIdCounter++,
        type,
        x: 60 + Math.random() * (width - 120),
        y: height + 20,
        speed: spd,
        health: hp,
        maxHealth: hp,
        radius: rad,
        points: pts,
        isHit: false,
        hitAnim: 0
      });
    }

    // Move invaders upward towards castle parapets
    for (let i = this.invaders.length - 1; i >= 0; i--) {
      const inv = this.invaders[i];
      inv.y -= inv.speed * dt;

      if (inv.hitAnim > 0) {
        inv.hitAnim = Math.max(0, inv.hitAnim - dt * 4.0);
      }

      // If invader reaches castle wall
      if (inv.y <= 95) {
        this.particles.shake(4);
        this.audio.playExplosion();
        this.particles.spawnExplosion(inv.x, 95, '#EF4444', 16);
        this.invaders.splice(i, 1);
      }
    }

    // Update archer players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.cooldown > 0) ps.cooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Aim rotation (sweeping from left to right downward: 30 deg to 150 deg)
      if (steer !== 0) {
        ps.aimAngle += steer * 2.2 * dt;
        ps.aimAngle = Math.max(Math.PI * 0.15, Math.min(Math.PI * 0.85, ps.aimAngle));
      }

      // Shoot arrow
      if (justAction && ps.cooldown <= 0) {
        ps.cooldown = 0.28;
        ps.arrowsShot += 1;

        const arrowSpeed = 620;
        this.arrows.push({
          id: this.arrowIdCounter++,
          shooterId: ps.id,
          x: ps.x,
          y: ps.y + 12,
          vx: Math.cos(ps.aimAngle) * arrowSpeed,
          vy: Math.sin(ps.aimAngle) * arrowSpeed,
          angle: ps.aimAngle,
          trail: []
        });

        this.audio.playLaser();
        this.particles.spawnSparks(ps.x, ps.y + 12, '#F59E0B', 6);
      }
    }

    // Update arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.angle = Math.atan2(a.vy, a.vx);

      a.trail.push({ x: a.x, y: a.y });
      if (a.trail.length > 6) a.trail.shift();

      let arrowDestroyed = false;
      const shooter = this.playersState.get(a.shooterId);

      // Check collision with invaders
      for (let j = this.invaders.length - 1; j >= 0; j--) {
        const inv = this.invaders[j];
        const dist = Math.hypot(inv.x - a.x, inv.y - a.y);

        if (dist < inv.radius + 6) {
          arrowDestroyed = true;
          inv.health -= 1;
          inv.hitAnim = 1.0;

          if (inv.health <= 0) {
            // Invader killed!
            if (shooter) {
              shooter.score += inv.points;
              shooter.hits += 1;
            }
            this.audio.playScore();
            this.particles.shake(3);
            this.particles.spawnExplosion(inv.x, inv.y, '#10B981', 16);
            this.invaders.splice(j, 1);
          } else {
            // Shield hit
            this.audio.playBounce();
            this.particles.spawnSparks(a.x, a.y, '#94A3B8', 8);
          }
          break;
        }
      }

      // Out of bounds
      if (arrowDestroyed || a.y > height + 20 || a.x < -20 || a.x > width + 20) {
        this.arrows.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
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
        ? 0.40 + Math.random() * 0.25
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.15
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    if (this.invaders.length === 0) return;

    // Pick closest invader
    const invader = this.invaders[0];
    const dx = invader.x - bot.x;
    const dy = invader.y - bot.y;
    let targetAngle = Math.atan2(dy, dx);

    if (difficulty === 'bot_easy') {
      targetAngle += (Math.random() - 0.5) * 0.35;
    }

    const angleDiff = targetAngle - bot.aimAngle;
    let steer = 0;
    let action = false;

    if (Math.abs(angleDiff) > 0.08) {
      steer = Math.sign(angleDiff);
    } else if (bot.cooldown <= 0) {
      action = true; // Fire arrow!
    }

    this.input.setBotInput(botId, action, steer, 0, action);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0,
        hits: ps?.hits || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topHits = scores[0]?.hits || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} shot down ${topHits} invading siege beasts!`
      : 'The castle battlements were breached!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Grassy battlefield ground
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, 0, width, height);

    // Castle stone battlements at top
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, width, 85);

    // Crenellations
    ctx.fillStyle = '#1E293B';
    for (let x = 0; x < width; x += 40) {
      ctx.fillRect(x, 70, 20, 15);
    }

    // 2. Render Invaders
    for (const inv of this.invaders) {
      ctx.save();
      ctx.translate(inv.x, inv.y);

      if (inv.type === 'ram') {
        // Battering Ram
        ctx.fillStyle = '#78350F';
        ctx.fillRect(-18, -10, 36, 20);
        ctx.fillStyle = '#94A3B8';
        ctx.beginPath();
        ctx.arc(0, -12, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (inv.type === 'shield_bearer') {
        // Armored Orc
        ctx.fillStyle = '#065F46';
        ctx.beginPath();
        ctx.arc(0, 0, inv.radius, 0, Math.PI * 2);
        ctx.fill();
        // Shield
        ctx.fillStyle = '#64748B';
        ctx.fillRect(-12, -14, 24, 8);
      } else {
        // Goblin runner
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(0, 0, inv.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(-4, -2, 2, 0, Math.PI * 2);
        ctx.arc(4, -2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Render Arrows
    for (const a of this.arrows) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);

      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(4, -4);
      ctx.lineTo(4, 4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // 4. Render Archers on Castle Wall
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Archer Head & Cap
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      // Longbow
      ctx.save();
      ctx.rotate(ps.aimAngle);
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 18, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();

      // Bow string
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(-Math.PI / 3) * 18, Math.sin(-Math.PI / 3) * 18);
      ctx.lineTo(Math.cos(Math.PI / 3) * 18, Math.sin(Math.PI / 3) * 18);
      ctx.stroke();
      ctx.restore();

      // Player Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${ps.id + 1}`, 0, -18);

      ctx.restore();
    }

    // 5. Draw HUD
    this.renderHUD(ctx, width);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    // Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#10B981';
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

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      const px = subBarX + idx * itemW;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.beginPath();
      ctx.roundRect(px + 4, 52, itemW - 8, 26, 6);
      ctx.fill();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}: ${ps?.score || 0}`, px + itemW * 0.5, 68);
    });
    ctx.restore();
  }
}
