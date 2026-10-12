import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BabyDragon {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isGold: boolean;
  tamedById: PlayerId | null;
  tameTimer: number;
  isPenned: boolean;
  wiggleAnim: number;
}

interface TamerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  penX: number;
  penY: number;
  score: number;
  dragonsPenned: number;
  hornCooldown: number;
  hornActiveTimer: number;
}

export class DragonTamerGame extends BaseGame {
  public playersState: Map<PlayerId, TamerPlayer> = new Map();
  public dragons: BabyDragon[] = [];
  public currentMapName: string = 'Castle Courtyard Hatchery';

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
    this.dragons = [];
    this.playersState.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();

    // 4 Corner Pens for up to 4 players
    const penCorners = [
      { x: 75, y: 75 },
      { x: width - 75, y: 75 },
      { x: 75, y: height - 75 },
      { x: width - 75, y: height - 75 }
    ];

    active.forEach((p, idx) => {
      const pen = penCorners[idx % penCorners.length];
      this.playersState.set(p.id, {
        id: p.id,
        x: pen.x + (idx % 2 === 0 ? 60 : -60),
        y: pen.y + (idx < 2 ? 60 : -60),
        angle: 0,
        penX: pen.x,
        penY: pen.y,
        score: 0,
        dragonsPenned: 0,
        hornCooldown: 0,
        hornActiveTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.25);
    });

    // Spawn 14 baby dragons in courtyard center
    for (let i = 0; i < 14; i++) {
      const isGold = i % 5 === 0;
      this.dragons.push({
        id: i,
        x: width * 0.5 + (Math.random() - 0.5) * (width * 0.45),
        y: height * 0.5 + (Math.random() - 0.5) * (height * 0.45),
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        radius: isGold ? 15 : 13,
        color: isGold ? '#F59E0B' : i % 2 === 0 ? '#10B981' : '#EC4899',
        isGold,
        tamedById: null,
        tameTimer: 0,
        isPenned: false,
        wiggleAnim: Math.random() * Math.PI * 2
      });
    }
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

      if (ps.hornCooldown > 0) ps.hornCooldown -= dt;
      if (ps.hornActiveTimer > 0) ps.hornActiveTimer -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      if (steer !== 0 || throttle !== 0) {
        ps.angle = Math.atan2(-throttle, steer);
      }

      const speed = 250;
      ps.x += steer * speed * dt;
      ps.y += -throttle * speed * dt;

      // Arena boundary clamp
      ps.x = Math.max(40, Math.min(width - 40, ps.x));
      ps.y = Math.max(50, Math.min(height - 50, ps.y));

      // Dinner horn sound burst
      if (justAction && ps.hornCooldown <= 0) {
        ps.hornCooldown = 0.85;
        ps.hornActiveTimer = 0.45;
        this.audio.playLaser();
        this.particles.shake(2);
        this.particles.spawnSparks(ps.x, ps.y, '#FBBF24', 12);

        // Lure nearby dragons
        for (const d of this.dragons) {
          if (d.isPenned) continue;
          const dist = Math.hypot(d.x - ps.x, d.y - ps.y);
          if (dist < 190) {
            d.tamedById = ps.id;
            d.tameTimer = 4.0;
            this.particles.spawnSparks(d.x, d.y, '#38BDF8', 6);
          }
        }
      }
    }

    // Update baby dragons
    for (const d of this.dragons) {
      if (d.isPenned) continue;

      d.wiggleAnim += dt * 8;

      if (d.tameTimer > 0 && d.tamedById !== null) {
        d.tameTimer -= dt;
        const leader = this.playersState.get(d.tamedById);
        if (leader) {
          // Follow tamer toward leader or their pen
          const targetX = leader.x;
          const targetY = leader.y;
          const dx = targetX - d.x;
          const dy = targetY - d.y;
          const dist = Math.hypot(dx, dy);

          if (dist > 35) {
            d.vx += (dx / dist) * 190 * dt;
            d.vy += (dy / dist) * 190 * dt;
          }

          // Check if dragon reached leader's pen
          const distToPen = Math.hypot(d.x - leader.penX, d.y - leader.penY);
          if (distToPen < 55) {
            d.isPenned = true;
            d.vx = 0;
            d.vy = 0;
            const pts = d.isGold ? 300 : 150;
            leader.score += pts;
            leader.dragonsPenned += 1;
            this.audio.playScore();
            this.particles.shake(4);
            this.particles.spawnExplosion(d.x, d.y, d.color, 16);
          }
        }
      } else {
        d.tamedById = null;
        // Natural curious wandering
        d.vx += (Math.random() - 0.5) * 80 * dt;
        d.vy += (Math.random() - 0.5) * 80 * dt;
      }

      // Drag
      d.vx *= Math.pow(0.96, dt * 60);
      d.vy *= Math.pow(0.96, dt * 60);

      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // Arena walls bounce
      if (d.x < 35) { d.x = 35; d.vx = Math.abs(d.vx); }
      else if (d.x > width - 35) { d.x = width - 35; d.vx = -Math.abs(d.vx); }
      if (d.y < 45) { d.y = 45; d.vy = Math.abs(d.vy); }
      else if (d.y > height - 45) { d.y = height - 45; d.vy = -Math.abs(d.vy); }
    }

    // Check round over
    const allPenned = this.dragons.every((d) => d.isPenned);
    if (this.roundTimer <= 0 || allPenned) {
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
        ? 0.45 + Math.random() * 0.25
        : difficulty === 'bot_normal'
        ? 0.22 + Math.random() * 0.15
        : 0.10 + Math.random() * 0.08;
    this.botReactionTimers.set(botId, interval);

    // Find nearest unpenned dragon
    const unpenned = this.dragons.filter((d) => !d.isPenned);
    if (unpenned.length === 0) return;

    // Check if bot already has followers
    const following = this.dragons.filter((d) => d.tamedById === botId && !d.isPenned);

    let targetX = bot.penX;
    let targetY = bot.penY;
    let action = false;

    if (following.length > 0) {
      // Guide followers to pen
      targetX = bot.penX;
      targetY = bot.penY;
    } else {
      // Seek closest wild dragon
      unpenned.sort((a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y));
      const targetDragon = unpenned[0];
      targetX = targetDragon.x;
      targetY = targetDragon.y;

      const dist = Math.hypot(targetDragon.x - bot.x, targetDragon.y - bot.y);
      if (dist < 140 && bot.hornCooldown <= 0) {
        action = true; // Blow dinner horn!
      }
    }

    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
    const dist = Math.hypot(dx, dy);

    let steer = 0;
    let throttle = 0;
    if (dist > 15) {
      steer = Math.sign(dx);
      throttle = -Math.sign(dy);
    }

    this.input.setBotInput(botId, action, steer, throttle, action);
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
        dragons: ps?.dragonsPenned || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topDragons = scores[0]?.dragons || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} tamed and penned ${topDragons} baby dragons!`
      : 'All dragons wandered into the castle shadows!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Cobblestone Courtyard Floor
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, width, height);

    // Stone flagstone grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Render Player Corner Pens
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.beginPath();
      ctx.arc(ps.penX, ps.penY, 52, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${ps.id + 1} PEN`, ps.penX, ps.penY - 58);
      ctx.restore();
    }

    // 3. Render Baby Dragons
    for (const d of this.dragons) {
      ctx.save();
      ctx.translate(d.x, d.y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 6, d.radius, d.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dragon Body
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
      ctx.fill();

      // Wing flaps
      const wingOffset = Math.sin(d.wiggleAnim) * 5;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(-10, -8 + wingOffset, 6, 10, -0.4, 0, Math.PI * 2);
      ctx.ellipse(10, -8 - wingOffset, 6, 10, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Cute Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-4, -2, 3, 0, Math.PI * 2);
      ctx.arc(4, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4, -2, 1.5, 0, Math.PI * 2);
      ctx.arc(4, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Tamed Heart Indicator
      if (d.tamedById !== null) {
        ctx.fillStyle = '#EC4899';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♥', 0, -d.radius - 4);
      }
      ctx.restore();
    }

    // 4. Render Tamers & Horn Shockwave
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      // Horn Acoustic Shockwave
      if (ps.hornActiveTimer > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const shockRadius = (1 - ps.hornActiveTimer / 0.45) * 190;
        ctx.arc(ps.x, ps.y, shockRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.angle);

      // Tamer Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();

      // Royal Horn
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(24, -8);
      ctx.lineTo(24, 8);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();

      // Player Label
      ctx.rotate(-ps.angle);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${ps.id + 1}`, 0, 26);
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
