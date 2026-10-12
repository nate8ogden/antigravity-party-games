import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MazePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  score: number;
  gemsCollected: number;
  speedBoostTimer: number;
  ghostTimer: number;
  freezeTimer: number;
  hasTrap: boolean;
  botDecisionTimer: number;
  facingDx: number;
  facingDy: number;
}

interface MazeGem {
  id: number;
  x: number;
  y: number;
  radius: number;
  isRelic: boolean;
  collected: boolean;
}

interface MazeTrap {
  x: number;
  y: number;
  placedBy: PlayerId;
  active: boolean;
}

interface MazeSentry {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
}

export class MazeEscapeGame extends BaseGame {
  private playersState: Map<PlayerId, MazePlayer> = new Map();
  private gems: MazeGem[] = [];
  private traps: MazeTrap[] = [];
  private sentry: MazeSentry = { x: 0, y: 0, vx: 100, vy: 0, radius: 16, speed: 110 };
  private currentMapName: string = 'Ancient Crypt';
  private wallGrid: boolean[][] = [];
  private cols: number = 19;
  private rows: number = 13;
  private cellW: number = 44;
  private cellH: number = 40;
  private offsetX: number = 20;
  private offsetY: number = 90;
  private gemCounter: number = 0;
  private relicRespawnTimer: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45;
    this.traps = [];
    this.relicRespawnTimer = 0;

    // Grid sizing
    this.offsetX = 20;
    this.offsetY = 88;
    this.cellW = (width - this.offsetX * 2) / this.cols;
    this.cellH = (height - this.offsetY - 20) / this.rows;

    this.generateProceduralMap();
    this.initPlayers();
  }

  private generateProceduralMap(): void {
    const maps = [
      'Ancient Crypt',
      'Neon Cyber Grid',
      'Overgrown Moss Ruins',
      'Volcanic Catacombs'
    ];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];

    // Initialize wall grid (true = solid wall, false = open path)
    this.wallGrid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => false)
    );

    // Outer perimeter walls
    for (let c = 0; c < this.cols; c++) {
      this.wallGrid[0][c] = true;
      this.wallGrid[this.rows - 1][c] = true;
    }
    for (let r = 0; r < this.rows; r++) {
      this.wallGrid[r][0] = true;
      this.wallGrid[r][this.cols - 1] = true;
    }

    // Procedural interior labyrinth pillars and barriers with open loops
    for (let r = 2; r < this.rows - 2; r += 2) {
      for (let c = 2; c < this.cols - 2; c += 2) {
        this.wallGrid[r][c] = true;

        // Random wall branch in one direction
        const dirs = [
          { dr: -1, dc: 0 },
          { dr: 1, dc: 0 },
          { dr: 0, dc: -1 },
          { dr: 0, dc: 1 }
        ];
        const chosen = dirs[Math.floor(Math.random() * dirs.length)];
        // Keep center open for Golden Relic
        const centerR = Math.floor(this.rows / 2);
        const centerC = Math.floor(this.cols / 2);
        if (
          Math.abs(r + chosen.dr - centerR) > 1 ||
          Math.abs(c + chosen.dc - centerC) > 1
        ) {
          this.wallGrid[r + chosen.dr][c + chosen.dc] = true;
        }
      }
    }

    // Populate Gems in open corridors
    this.gems = [];
    this.gemCounter = 0;

    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        if (!this.wallGrid[r][c] && (r % 2 !== 0 || c % 2 !== 0)) {
          const isCenter = r === Math.floor(this.rows / 2) && c === Math.floor(this.cols / 2);
          this.gems.push({
            id: ++this.gemCounter,
            x: this.offsetX + (c + 0.5) * this.cellW,
            y: this.offsetY + (r + 0.5) * this.cellH,
            radius: isCenter ? 14 : 7,
            isRelic: isCenter,
            collected: false
          });
        }
      }
    }

    // Spawn Sentry at center open path
    this.sentry = {
      x: this.offsetX + Math.floor(this.cols / 2) * this.cellW,
      y: this.offsetY + (Math.floor(this.rows / 2) - 2) * this.cellH,
      vx: 110,
      vy: 0,
      radius: 15,
      speed: 110
    };
  }

  private initPlayers(): void {
    this.playersState.clear();
    const active = this.getActivePlayers();

    // 4 Corner spawn positions
    const corners = [
      { r: 1, c: 1 },
      { r: 1, c: this.cols - 2 },
      { r: this.rows - 2, c: 1 },
      { r: this.rows - 2, c: this.cols - 2 }
    ];

    active.forEach((p, idx) => {
      const sp = corners[idx % corners.length];
      const px = this.offsetX + (sp.c + 0.5) * this.cellW;
      const py = this.offsetY + (sp.r + 0.5) * this.cellH;

      this.playersState.set(p.id, {
        id: p.id,
        x: px,
        y: py,
        vx: 0,
        vy: 0,
        radius: 13,
        score: 0,
        gemsCollected: 0,
        speedBoostTimer: 0,
        ghostTimer: 0,
        freezeTimer: 0,
        hasTrap: true,
        botDecisionTimer: 0.15 + idx * 0.1,
        facingDx: idx % 2 === 0 ? 1 : -1,
        facingDy: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot inputs
    this.updateBots(dt, width, height);

    // Relic respawn maintenance
    if (this.relicRespawnTimer > 0) {
      this.relicRespawnTimer -= dt;
      if (this.relicRespawnTimer <= 0) {
        // Respawn golden relic in center
        const centerR = Math.floor(this.rows / 2);
        const centerC = Math.floor(this.cols / 2);
        this.gems.push({
          id: ++this.gemCounter,
          x: this.offsetX + (centerC + 0.5) * this.cellW,
          y: this.offsetY + (centerR + 0.5) * this.cellH,
          radius: 14,
          isRelic: true,
          collected: false
        });
        this.particles.showFloatingText('RELIC RESPAWNED!', width / 2, height / 2 - 20, '#F59E0B', 24);
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.freezeTimer > 0) {
        ps.freezeTimer = Math.max(0, ps.freezeTimer - dt);
        continue;
      }

      if (ps.speedBoostTimer > 0) ps.speedBoostTimer = Math.max(0, ps.speedBoostTimer - dt);
      if (ps.ghostTimer > 0) ps.ghostTimer = Math.max(0, ps.ghostTimer - dt);

      // Read Inputs
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || (this.input.justPressed(p.id) && steer === 0 && throttle === 0);
      const isPressing = this.input.isActionPressed(p.id) || (this.input.isPressed(p.id) && steer === 0 && throttle === 0);

      // Place trap if has trap, and cycle facing direction clockwise in single-touch mode
      if (justAction) {
        if (ps.hasTrap) {
          ps.hasTrap = false;
          this.traps.push({
            x: ps.x,
            y: ps.y,
            placedBy: ps.id,
            active: true
          });
          this.audio.playTap();
          this.particles.showFloatingText('TRAP SET!', ps.x, ps.y - 20, '#38BDF8', 18);
        } else if (steer === 0 && throttle === 0) {
          // Cycle facing direction clockwise: Right -> Down -> Left -> Up
          const nextDx = -ps.facingDy;
          const nextDy = ps.facingDx;
          ps.facingDx = nextDx;
          ps.facingDy = nextDy;
          this.audio.playTap();
        }
      }

      // Movement
      const baseSpeed = ps.speedBoostTimer > 0 ? 250 : 170;
      if (steer !== 0 || throttle !== 0) {
        ps.vx = steer * baseSpeed;
        ps.vy = -throttle * baseSpeed;
        if (steer !== 0) ps.facingDx = steer > 0 ? 1 : -1;
        if (throttle !== 0) ps.facingDy = throttle > 0 ? -1 : 1;
      } else {
        // Single-button mobile fallback: auto-walk along current facing corridor
        // If blocked ahead, attempt automatic 90-degree corridor turn
        const lookDist = 14;
        const blockedAhead = this.checkWallOverlap(ps.x + ps.facingDx * lookDist, ps.y + ps.facingDy * lookDist, ps.radius);
        if (blockedAhead) {
          // Try turning right
          const turnRightDx = -ps.facingDy;
          const turnRightDy = ps.facingDx;
          const rightBlocked = this.checkWallOverlap(ps.x + turnRightDx * lookDist, ps.y + turnRightDy * lookDist, ps.radius);
          if (!rightBlocked) {
            ps.facingDx = turnRightDx;
            ps.facingDy = turnRightDy;
          } else {
            // Try turning left
            ps.facingDx = -turnRightDx;
            ps.facingDy = -turnRightDy;
          }
        }
        ps.vx = ps.facingDx * baseSpeed;
        ps.vy = ps.facingDy * baseSpeed;
      }

      // Wall collision resolution (unless ghost cloak is active)
      if (ps.ghostTimer > 0) {
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;
        // Keep within outer arena bounds
        ps.x = Math.max(this.offsetX + this.cellW + ps.radius, Math.min(this.offsetX + (this.cols - 1) * this.cellW - ps.radius, ps.x));
        ps.y = Math.max(this.offsetY + this.cellH + ps.radius, Math.min(this.offsetY + (this.rows - 1) * this.cellH - ps.radius, ps.y));
      } else {
        this.resolvePlayerWallCollision(ps, dt);
      }

      // Gem collection
      for (const gem of this.gems) {
        if (gem.collected) continue;

        const dist = Math.hypot(ps.x - gem.x, ps.y - gem.y);
        if (dist < ps.radius + gem.radius) {
          gem.collected = true;
          ps.gemsCollected += 1;

          if (gem.isRelic) {
            ps.score += 250;
            this.relicRespawnTimer = 12.0;
            this.audio.playFanfare();
            this.particles.shake(0.3);
            this.particles.showFloatingText('GOLDEN RELIC! +250', ps.x, ps.y - 25, '#F59E0B', 24);
            this.particles.spawnConfetti(gem.x, gem.y, 25);
          } else {
            ps.score += 15;
            this.audio.playTap();
            this.particles.spawnSparks(gem.x, gem.y, '#38BDF8', 6);
          }
        }
      }

      // Trap triggers
      for (const trap of this.traps) {
        if (!trap.active || trap.placedBy === ps.id) continue;
        const d = Math.hypot(ps.x - trap.x, ps.y - trap.y);
        if (d < ps.radius + 12) {
          trap.active = false;
          ps.freezeTimer = 1.4;
          this.audio.playStun();
          this.particles.shake(0.25);
          this.particles.showFloatingText('FROZEN!', ps.x, ps.y - 25, '#38BDF8', 22);
        }
      }

      // Sentry collision
      const sentryDist = Math.hypot(ps.x - this.sentry.x, ps.y - this.sentry.y);
      if (sentryDist < ps.radius + this.sentry.radius) {
        // Knockback from sentry!
        const pushAngle = Math.atan2(ps.y - this.sentry.y, ps.x - this.sentry.x);
        ps.x += Math.cos(pushAngle) * 35;
        ps.y += Math.sin(pushAngle) * 35;
        ps.score = Math.max(0, ps.score - 40);

        this.audio.playExplosion();
        this.particles.shake(0.35);
        this.particles.showFloatingText('SENTRY HIT! -40', ps.x, ps.y - 28, '#EF4444', 22);
        this.particles.spawnExplosion(ps.x, ps.y, '#EF4444', 16);
      }
    }

    // Update Sentry Patrol
    this.updateSentry(dt);

    // End round check
    const remainingGems = this.gems.filter((g) => !g.collected);
    if (remainingGems.length === 0 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private resolvePlayerWallCollision(ps: MazePlayer, dt: number): void {
    // Try X movement
    const nextX = ps.x + ps.vx * dt;
    if (!this.checkWallOverlap(nextX, ps.y, ps.radius)) {
      ps.x = nextX;
    }

    // Try Y movement
    const nextY = ps.y + ps.vy * dt;
    if (!this.checkWallOverlap(ps.x, nextY, ps.radius)) {
      ps.y = nextY;
    }
  }

  private checkWallOverlap(x: number, y: number, radius: number): boolean {
    const minC = Math.floor((x - radius - this.offsetX) / this.cellW);
    const maxC = Math.floor((x + radius - this.offsetX) / this.cellW);
    const minR = Math.floor((y - radius - this.offsetY) / this.cellH);
    const maxR = Math.floor((y + radius - this.offsetY) / this.cellH);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return true;
        if (this.wallGrid[r][c]) {
          const wLeft = this.offsetX + c * this.cellW;
          const wRight = wLeft + this.cellW;
          const wTop = this.offsetY + r * this.cellH;
          const wBottom = wTop + this.cellH;

          // Circle-Box overlap test
          const closeX = Math.max(wLeft, Math.min(x, wRight));
          const closeY = Math.max(wTop, Math.min(y, wBottom));
          if (Math.hypot(x - closeX, y - closeY) < radius) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private updateSentry(dt: number): void {
    this.sentry.x += this.sentry.vx * dt;
    this.sentry.y += this.sentry.vy * dt;

    // Check wall collision ahead; pick random perpendicular turn if blocked
    if (this.checkWallOverlap(this.sentry.x + (this.sentry.vx > 0 ? 12 : -12), this.sentry.y + (this.sentry.vy > 0 ? 12 : -12), this.sentry.radius)) {
      // Pick alternative open direction
      const options: { vx: number; vy: number }[] = [
        { vx: this.sentry.speed, vy: 0 },
        { vx: -this.sentry.speed, vy: 0 },
        { vx: 0, vy: this.sentry.speed },
        { vx: 0, vy: -this.sentry.speed }
      ];
      const valid = options.filter(
        (o) => !this.checkWallOverlap(this.sentry.x + o.vx * 0.15, this.sentry.y + o.vy * 0.15, this.sentry.radius)
      );

      // Prefer perpendicular turns over direct 180 reverse to avoid oscillating
      const nonReverse = valid.filter((o) => !(o.vx === -this.sentry.vx && o.vy === -this.sentry.vy));
      const pool = nonReverse.length > 0 ? nonReverse : valid;

      if (pool.length > 0) {
        const choice = pool[Math.floor(Math.random() * pool.length)];
        this.sentry.vx = choice.vx;
        this.sentry.vy = choice.vy;
      } else {
        this.sentry.vx = -this.sentry.vx;
        this.sentry.vy = -this.sentry.vy;
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.freezeTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    ps.botDecisionTimer -= dt;
    if (ps.botDecisionTimer > 0) return;

    const interval =
      difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.14 : 0.24;
    ps.botDecisionTimer = interval;

    // Find nearest uncollected gem / relic
    let targetX = ps.x;
    let targetY = ps.y;
    let bestScore = -9999;

    for (const gem of this.gems) {
      if (gem.collected) continue;
      const d = Math.hypot(gem.x - ps.x, gem.y - ps.y);
      let score = (gem.isRelic ? 400 : 80) - d;

      // Penalize target if sentry is nearby
      const sentryD = Math.hypot(gem.x - this.sentry.x, gem.y - this.sentry.y);
      if (sentryD < 80) score -= 150;

      if (score > bestScore) {
        bestScore = score;
        targetX = gem.x;
        targetY = gem.y;
      }
    }

    // Direction vector towards target
    const dx = targetX - ps.x;
    const dy = targetY - ps.y;
    let steer = 0;
    let throttle = 0;

    if (Math.abs(dx) > Math.abs(dy)) {
      steer = dx > 0 ? 1 : -1;
    } else {
      throttle = dy > 0 ? 1 : -1;
    }

    // Chance of dropping trap if opponent is trailing on Hard/Normal
    let useAction = false;
    if (ps.hasTrap && difficulty !== 'bot_easy') {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const other = this.playersState.get(p.id);
        if (other && Math.hypot(other.x - ps.x, other.y - ps.y) < 70) {
          useAction = true;
          break;
        }
      }
    }

    this.input.setBotInput(botId, useAction, steer, -throttle, useAction);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Maze Backdrop
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    // 2. Maze Floor & Wall Grid
    this.renderMazeWalls(ctx);

    // 3. Traps
    for (const trap of this.traps) {
      if (!trap.active) continue;
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 4. Gems & Golden Relic
    for (const gem of this.gems) {
      if (gem.collected) continue;
      this.renderGem(ctx, gem);
    }

    // 5. Minotaur / Cyber Sentry
    this.renderSentry(ctx);

    // 6. Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderMazePlayer(ctx, ps, p.color);
    }

    // 7. Center HUD Pod
    this.renderCenterHudPod(ctx, width);
  }

  private renderMazeWalls(ctx: CanvasRenderingContext2D): void {
    let wallColor = '#1E293B';
    let wallStroke = '#334155';

    if (this.currentMapName === 'Neon Cyber Grid') {
      wallColor = '#0F172A';
      wallStroke = '#06B6D4';
    } else if (this.currentMapName === 'Overgrown Moss Ruins') {
      wallColor = '#14532D';
      wallStroke = '#166534';
    } else if (this.currentMapName === 'Volcanic Catacombs') {
      wallColor = '#450A0A';
      wallStroke = '#7F1D1D';
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const wx = this.offsetX + c * this.cellW;
        const wy = this.offsetY + r * this.cellH;

        if (this.wallGrid[r][c]) {
          ctx.fillStyle = wallColor;
          ctx.fillRect(wx, wy, this.cellW, this.cellH);
          ctx.strokeStyle = wallStroke;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(wx, wy, this.cellW, this.cellH);
        } else {
          // Subtle floor tile
          ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
          ctx.fillRect(wx + 1, wy + 1, this.cellW - 2, this.cellH - 2);
        }
      }
    }
  }

  private renderGem(ctx: CanvasRenderingContext2D, gem: MazeGem): void {
    ctx.save();
    ctx.translate(gem.x, gem.y);

    if (gem.isRelic) {
      // Golden Relic Idol
      ctx.beginPath();
      ctx.arc(0, 0, gem.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FEF08A';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, 4);
    } else {
      // Sparkling Cyan Gem
      ctx.beginPath();
      ctx.moveTo(0, -gem.radius);
      ctx.lineTo(gem.radius, 0);
      ctx.lineTo(0, gem.radius);
      ctx.lineTo(-gem.radius, 0);
      ctx.closePath();
      ctx.fillStyle = '#38BDF8';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderSentry(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.sentry.x, this.sentry.y);

    // Sentry red aura
    ctx.beginPath();
    ctx.arc(0, 0, this.sentry.radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.fill();

    // Sentry Body
    ctx.beginPath();
    ctx.arc(0, 0, this.sentry.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#7F1D1D';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#EF4444';
    ctx.stroke();

    // Spiked Horns
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(-14, -18);
    ctx.lineTo(-6, -11);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(10, -8);
    ctx.lineTo(14, -18);
    ctx.lineTo(6, -11);
    ctx.closePath();
    ctx.fill();

    // Glowing Single Cyclops Eye
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(1, -1, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderMazePlayer(
    ctx: CanvasRenderingContext2D,
    ps: MazePlayer,
    color: string
  ): void {
    ctx.save();
    ctx.translate(ps.x, ps.y);

    // Ghost transparency
    if (ps.ghostTimer > 0) {
      ctx.globalAlpha = 0.55;
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 8, 10, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, ps.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Ice cube overlay if frozen
    if (ps.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.fillRect(-ps.radius - 2, -ps.radius - 2, (ps.radius + 2) * 2, (ps.radius + 2) * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-ps.radius - 2, -ps.radius - 2, (ps.radius + 2) * 2, (ps.radius + 2) * 2);
    }

    // Face / Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-3, -3, 3, 0, Math.PI * 2);
    ctx.arc(3, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-3, -3, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -3, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Score Tag above player
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.score}`, ps.x, ps.y - 18);
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`MAZE: ${this.currentMapName}`, podX + 16, podY + 17);

    // Timer display
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const timerColor = this.roundTimer < 10 ? '#EF4444' : '#F1F5F9';
    ctx.fillStyle = timerColor;
    ctx.fillText(`TIME: ${this.roundTimer.toFixed(1)}s`, podX + podW - 16, podY + 17);
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Labyrinth Champion!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} navigated the maze with ${ps?.gemsCollected || 0} gems!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
