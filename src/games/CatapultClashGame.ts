import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Boulder {
  id: number;
  throwerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  trail: { x: number; y: number }[];
}

interface CastleBlock {
  id: number;
  team: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  color: string;
}

interface CatapultPlayer {
  id: PlayerId;
  team: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  aimAngle: number; // In radians
  power: number;
  powerIncreasing: boolean;
  isWinding: boolean;
  score: number;
  blocksDestroyed: number;
  shotsFired: number;
  cooldown: number;
}

export class CatapultClashGame extends BaseGame {
  public playersState: Map<PlayerId, CatapultPlayer> = new Map();
  public boulders: Boulder[] = [];
  public castleBlocks: CastleBlock[] = [];
  public currentMapName: string = 'Stoneguard Fortress';

  private boulderIdCounter: number = 0;
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
    this.boulders = [];
    this.castleBlocks = [];
    this.playersState.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();

    // Spawn 2 castles (Left and Right) with destrutible stone blocks
    const blockW = 28;
    const blockH = 22;
    const rows = 5;
    const cols = 4;

    // Left Castle Blocks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.castleBlocks.push({
          id: this.castleBlocks.length,
          team: 'LEFT',
          x: width * 0.16 + c * (blockW + 2),
          y: height * 0.52 + r * (blockH + 2),
          width: blockW,
          height: blockH,
          health: 100,
          maxHealth: 100,
          color: (r + c) % 2 === 0 ? '#475569' : '#334155'
        });
      }
    }

    // Right Castle Blocks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.castleBlocks.push({
          id: this.castleBlocks.length,
          team: 'RIGHT',
          x: width * 0.72 + c * (blockW + 2),
          y: height * 0.52 + r * (blockH + 2),
          width: blockW,
          height: blockH,
          health: 100,
          maxHealth: 100,
          color: (r + c) % 2 === 0 ? '#475569' : '#334155'
        });
      }
    }

    // Spawn Catapults for players
    active.forEach((p, idx) => {
      const team = (idx % 2 === 0) ? 'LEFT' : 'RIGHT';
      const startX = team === 'LEFT' ? width * 0.08 : width * 0.92;
      const startY = height * 0.65 + (idx < 2 ? -40 : 40);
      const defaultAngle = team === 'LEFT' ? -Math.PI / 4 : -Math.PI * 0.75;

      this.playersState.set(p.id, {
        id: p.id,
        team,
        x: startX,
        y: startY,
        aimAngle: defaultAngle,
        power: 0,
        powerIncreasing: true,
        isWinding: false,
        score: 0,
        blocksDestroyed: 0,
        shotsFired: 0,
        cooldown: 0
      });
      this.botReactionTimers.set(p.id, 0.3 + Math.random() * 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update player catapults
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.cooldown > 0) ps.cooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Aim angle adjustment (within realistic trebuchet arc: 15 to 75 degrees)
      if (steer !== 0) {
        const angleSpeed = 1.6;
        ps.aimAngle += (ps.team === 'LEFT' ? steer : -steer) * angleSpeed * dt;
        const minAngle = ps.team === 'LEFT' ? -Math.PI * 0.45 : -Math.PI * 0.95;
        const maxAngle = ps.team === 'LEFT' ? -Math.PI * 0.05 : -Math.PI * 0.55;
        ps.aimAngle = Math.max(minAngle, Math.min(maxAngle, ps.aimAngle));
      }

      // Wind winch power
      if (isAction && ps.cooldown <= 0) {
        ps.isWinding = true;
        const powerSpeed = 550;
        if (ps.powerIncreasing) {
          ps.power += powerSpeed * dt;
          if (ps.power >= 720) {
            ps.power = 720;
            ps.powerIncreasing = false;
          }
        } else {
          ps.power -= powerSpeed * dt;
          if (ps.power <= 200) {
            ps.power = 200;
            ps.powerIncreasing = true;
          }
        }
      } else if (ps.isWinding && ps.power > 0) {
        // Release catapult! Launch boulder!
        ps.isWinding = false;
        ps.cooldown = 0.65;
        ps.shotsFired += 1;

        const bx = ps.x + Math.cos(ps.aimAngle) * 32;
        const by = ps.y + Math.sin(ps.aimAngle) * 32;

        this.boulders.push({
          id: this.boulderIdCounter++,
          throwerId: ps.id,
          x: bx,
          y: by,
          vx: Math.cos(ps.aimAngle) * ps.power,
          vy: Math.sin(ps.aimAngle) * ps.power,
          radius: 9,
          trail: []
        });

        ps.power = 0;
        ps.powerIncreasing = true;
        this.audio.playLaser();
        this.particles.shake(3);
        this.particles.spawnSparks(bx, by, '#F59E0B', 8);
      }
    }

    // Update boulders with ballistic gravity
    const gravity = 620;
    for (let i = this.boulders.length - 1; i >= 0; i--) {
      const b = this.boulders[i];
      b.vy += gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 8) b.trail.shift();

      let hitBlock = false;
      const thrower = this.playersState.get(b.throwerId);

      // Check collision with enemy castle blocks
      for (let j = this.castleBlocks.length - 1; j >= 0; j--) {
        const block = this.castleBlocks[j];
        if (thrower && block.team === thrower.team) continue; // Friendly fire disabled

        if (
          b.x + b.radius >= block.x &&
          b.x - b.radius <= block.x + block.width &&
          b.y + b.radius >= block.y &&
          b.y - b.radius <= block.y + block.height
        ) {
          hitBlock = true;
          block.health -= 50;

          if (thrower) {
            thrower.score += 40;
          }

          this.audio.playBounce();
          this.particles.shake(4);
          this.particles.spawnSparks(b.x, b.y, '#94A3B8', 12);

          if (block.health <= 0) {
            // Block destroyed!
            if (thrower) {
              thrower.score += 100;
              thrower.blocksDestroyed += 1;
            }
            this.audio.playExplosion();
            this.particles.shake(6);
            this.particles.spawnExplosion(block.x + block.width / 2, block.y + block.height / 2, '#F59E0B', 18);
            this.castleBlocks.splice(j, 1);
          }
          break;
        }
      }

      // Ground or out-of-bounds collision
      const groundY = height * 0.78;
      if (hitBlock || b.y >= groundY || b.x < -40 || b.x > width + 40) {
        if (b.y >= groundY && !hitBlock) {
          this.audio.playTap();
          this.particles.spawnSparks(b.x, groundY, '#78350F', 8);
        }
        this.boulders.splice(i, 1);
      }
    }

    // Check round over
    const leftBlocks = this.castleBlocks.filter((b) => b.team === 'LEFT').length;
    const rightBlocks = this.castleBlocks.filter((b) => b.team === 'RIGHT').length;

    if (this.roundTimer <= 0 || leftBlocks === 0 || rightBlocks === 0) {
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

    // Find enemy blocks
    const enemyBlocks = this.castleBlocks.filter((b) => b.team !== bot.team);
    if (enemyBlocks.length === 0) return;

    const target = enemyBlocks[Math.floor(Math.random() * enemyBlocks.length)];
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const dist = Math.hypot(dx, dy);

    // Ballistic tension estimate
    const targetPower = Math.min(700, Math.max(300, dist * 0.95));
    let steer = 0;
    let action = false;

    // Angle adjustment
    const optimalAngle = bot.team === 'LEFT' ? -Math.PI * 0.28 : -Math.PI * 0.72;
    const angleDiff = optimalAngle - bot.aimAngle;
    if (Math.abs(angleDiff) > 0.1) {
      steer = Math.sign(angleDiff) * (bot.team === 'LEFT' ? 1 : -1);
    }

    // Winding
    if (bot.cooldown <= 0) {
      if (bot.power < targetPower) {
        action = true; // Hold action to charge
      } else {
        action = false; // Release to fire
      }
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
        blocks: ps?.blocksDestroyed || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topBlocks = scores[0]?.blocks || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} obliterated ${topBlocks} castle blocks!`
      : 'Draw! Both fortress battlements withstood the siege!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Sky & Castle Landscape
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0F172A');
    skyGrad.addColorStop(0.5, '#1E293B');
    skyGrad.addColorStop(0.78, '#334155');
    skyGrad.addColorStop(1, '#1E1B18');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Castle battlements background wall
    const groundY = height * 0.78;
    ctx.fillStyle = '#292524';
    ctx.fillRect(0, groundY, width, height - groundY);

    // Moat water in center
    const moatX = width * 0.38;
    const moatW = width * 0.24;
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(moatX, groundY + 4, moatW, height - groundY);

    // 2. Render Castle Blocks
    for (const block of this.castleBlocks) {
      ctx.save();
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(block.x + 2, block.y + 2, block.width, block.height);

      ctx.fillStyle = block.color;
      ctx.fillRect(block.x, block.y, block.width, block.height);

      // Stone border
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(block.x, block.y, block.width, block.height);

      // Damage cracks if health < maxHealth
      if (block.health < block.maxHealth) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(block.x + 4, block.y + 4);
        ctx.lineTo(block.x + block.width - 4, block.y + block.height - 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Render Boulders & Smoke Trails
    for (const b of this.boulders) {
      ctx.save();
      if (b.trail.length > 1) {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        b.trail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      }

      // Granite Boulder
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render Catapults & Winch Tension Meters
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      // Wooden Catapult Base Frame
      ctx.fillStyle = '#78350F';
      ctx.fillRect(ps.x - 14, ps.y - 4, 28, 14);

      // Wheels
      ctx.fillStyle = '#451A03';
      ctx.beginPath();
      ctx.arc(ps.x - 10, ps.y + 10, 6, 0, Math.PI * 2);
      ctx.arc(ps.x + 10, ps.y + 10, 6, 0, Math.PI * 2);
      ctx.fill();

      // Pivot Arm pointing in aimAngle
      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.aimAngle);

      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(28, 0);
      ctx.stroke();

      // Catapult bucket
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(28, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Power meter arc when winding
      if (ps.isWinding) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const pRatio = ps.power / 720;
        ctx.arc(ps.x, ps.y - 20, 16, -Math.PI / 2, -Math.PI / 2 + pRatio * Math.PI * 2);
        ctx.stroke();
      }

      // Player label
      ctx.fillStyle = color;
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${ps.id + 1}`, ps.x, ps.y + 26);
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
    ctx.strokeStyle = '#F59E0B';
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
