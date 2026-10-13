import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface RailObstacle {
  x: number;
  railIdx: number;
  type: 'barrier' | 'battery';
  collected: boolean;
}

interface Hoverboarder {
  id: PlayerId;
  railIdx: number; // 0 (top), 1 (mid-up), 2 (mid-down), 3 (bottom)
  y: number;
  targetY: number;
  altitude: number; // jump height
  vAltitude: number;
  isJumping: boolean;
  score: number;
  batteriesCollected: number;
  grindCombo: number;
  stunTimer: number;
  switchCooldown: number; // Debounces rail changes so a tap moves exactly 1 line
  lastThrottle: number;    // Tracks previous throttle to detect rising edges
}

export class HoverboardRailGame extends BaseGame {
  public playersState: Map<PlayerId, Hoverboarder> = new Map();
  public currentMapName: string = 'Aero-Skyline Magnetic Rails';

  private railYPositions: number[] = [];
  private obstacles: RailObstacle[] = [];
  private scrollSpeed: number = 240;
  private spawnTimer: number = 0.4;
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
    this.obstacles = [];
    this.botReactionTimers.clear();

    // 4 evenly spaced magnetic skyline rails
    const startY = height * 0.32;
    const spacing = Math.min(80, (height * 0.52) / 3);
    this.railYPositions = [
      startY,
      startY + spacing,
      startY + spacing * 2,
      startY + spacing * 3
    ];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const rail = idx % this.railYPositions.length;
      this.playersState.set(p.id, {
        id: p.id,
        railIdx: rail,
        y: this.railYPositions[rail],
        targetY: this.railYPositions[rail],
        altitude: 0,
        vAltitude: 0,
        isJumping: false,
        score: 0,
        batteriesCollected: 0,
        grindCombo: 0,
        stunTimer: 0,
        switchCooldown: 0,
        lastThrottle: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Spawn obstacles & batteries
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.45 + Math.random() * 0.35;
      const railIdx = Math.floor(Math.random() * this.railYPositions.length);
      const isBarrier = Math.random() < 0.45;
      this.obstacles.push({
        x: width + 40,
        railIdx,
        type: isBarrier ? 'barrier' : 'battery',
        collected: false
      });
    }

    // Scroll obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.scrollSpeed * dt;
      if (obs.x < -50) {
        this.obstacles.splice(i, 1);
      }
    }

    this.updateBots(dt, width, height);

    const playerX = 140;

    for (const p of this.getActivePlayers()) {
      const boarder = this.playersState.get(p.id);
      if (!boarder) continue;

      if (boarder.stunTimer > 0) {
        boarder.stunTimer -= dt;
        continue;
      }

      if (boarder.switchCooldown > 0) {
        boarder.switchCooldown -= dt;
      }

      // Discrete, precise rail switching: 1 press = exactly 1 rail change!
      const throttle = this.input.getThrottle(p.id);
      const isUpEdge = this.input.justUp(p.id) || (throttle > 0.4 && boarder.lastThrottle <= 0.4);
      const isDownEdge = this.input.justDown(p.id) || (throttle < -0.4 && boarder.lastThrottle >= -0.4);

      if (boarder.switchCooldown <= 0) {
        if (isUpEdge && boarder.railIdx > 0) {
          boarder.railIdx--;
          boarder.targetY = this.railYPositions[boarder.railIdx];
          boarder.switchCooldown = 0.20;
          this.audio.playTone(480 + (3 - boarder.railIdx) * 65, 0.06, 'triangle');
          this.particles.spawnSparks(playerX, boarder.y, '#00E5FF', 6);
        } else if (isDownEdge && boarder.railIdx < this.railYPositions.length - 1) {
          boarder.railIdx++;
          boarder.targetY = this.railYPositions[boarder.railIdx];
          boarder.switchCooldown = 0.20;
          this.audio.playTone(480 + (3 - boarder.railIdx) * 65, 0.06, 'triangle');
          this.particles.spawnSparks(playerX, boarder.y, '#00E5FF', 6);
        } else if (throttle > 0.6 && boarder.railIdx > 0) {
          // Continuous hold with comfortable repeat delay
          boarder.railIdx--;
          boarder.targetY = this.railYPositions[boarder.railIdx];
          boarder.switchCooldown = 0.24;
          this.audio.playTone(480 + (3 - boarder.railIdx) * 65, 0.06, 'triangle');
          this.particles.spawnSparks(playerX, boarder.y, '#00E5FF', 6);
        } else if (throttle < -0.6 && boarder.railIdx < this.railYPositions.length - 1) {
          boarder.railIdx++;
          boarder.targetY = this.railYPositions[boarder.railIdx];
          boarder.switchCooldown = 0.24;
          this.audio.playTone(480 + (3 - boarder.railIdx) * 65, 0.06, 'triangle');
          this.particles.spawnSparks(playerX, boarder.y, '#00E5FF', 6);
        }
      }

      boarder.lastThrottle = throttle;

      // Jump Ollie (Space / Action / Tap)
      const justAction = this.input.justAction(p.id) || (this.input.justPressed(p.id) && !isUpEdge && !isDownEdge);
      if (justAction && !boarder.isJumping) {
        boarder.isJumping = true;
        boarder.vAltitude = 310;
        this.audio.playTap();
      }

      // Altitude physics
      if (boarder.isJumping) {
        boarder.altitude += boarder.vAltitude * dt;
        boarder.vAltitude -= 850 * dt; // gravity
        if (boarder.altitude <= 0) {
          boarder.altitude = 0;
          boarder.vAltitude = 0;
          boarder.isJumping = false;
          // Landing rail sparks
          this.particles.spawnSparks(playerX, boarder.y, '#00E5FF', 4);
        }
      }

      // Smooth rail transition
      boarder.y += (boarder.targetY - boarder.y) * 16 * dt;

      // Passive grind score & rail sparks
      if (!boarder.isJumping) {
        boarder.grindCombo += dt * 5;
        boarder.score += dt * 12;
        if (Math.random() < 0.35) {
          this.particles.emit(playerX - 12, boarder.y + 4, 1, '#00E5FF');
        }
      }

      // Obstacle collision check
      for (const obs of this.obstacles) {
        if (obs.railIdx !== boarder.railIdx) continue;
        if (Math.abs(obs.x - playerX) < 24) {
          if (obs.type === 'battery' && !obs.collected) {
            obs.collected = true;
            boarder.batteriesCollected++;
            boarder.score += 30;
            this.audio.playScore();
            this.particles.spawnSparks(playerX, boarder.y, '#FFD700', 10);
            this.particles.showFloatingText('+30', playerX, boarder.y - 25, '#FFD700', 14);
          } else if (obs.type === 'barrier' && !boarder.isJumping) {
            // Crash into barrier!
            boarder.stunTimer = 0.9;
            boarder.score = Math.max(0, boarder.score - 25);
            boarder.grindCombo = 0;
            this.audio.playExplosion();
            this.particles.emit(playerX, boarder.y, 12, '#EF4444');
            this.particles.showFloatingText('CRASH!', playerX, boarder.y - 25, '#EF4444', 16);
          }
        }
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
    const boarder = this.playersState.get(botId);
    if (!boarder || boarder.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const playerX = 140;
    // Check impending obstacles on bot's current rail
    const ahead = this.obstacles.filter(
      o => o.railIdx === boarder.railIdx && o.x > playerX && o.x < playerX + 180
    );

    let jump = false;
    let switchRail = 0;

    if (ahead.length > 0) {
      const obstacle = ahead[0];
      if (obstacle.type === 'barrier') {
        if (obstacle.x < playerX + 80) {
          jump = true;
        } else if (difficulty !== 'bot_easy') {
          // Switch to adjacent rail
          switchRail = boarder.railIdx === 0 ? -1 : 1;
        }
      }
    } else {
      // Seek battery on adjacent rail
      const batteries = this.obstacles.filter(
        o => o.type === 'battery' && !o.collected && o.x > playerX && o.x < playerX + 220
      );
      if (batteries.length > 0 && difficulty === 'bot_hard') {
        const target = batteries[0];
        if (target.railIdx > boarder.railIdx) switchRail = -1; // down
        else if (target.railIdx < boarder.railIdx) switchRail = 1; // up
      }
    }

    this.input.setBotInput(botId, jump, 0, switchRail, jump);

    let delay = 0.25;
    if (difficulty === 'bot_easy') delay = 0.40;
    else if (difficulty === 'bot_hard') delay = 0.12;

    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const b = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: Math.floor(b?.score || 0),
        batteries: b?.batteriesCollected || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topScore = scores[0]?.score || 0;
    const mvpHighlight = winnerId !== null
      ? `${this.players[winnerId].name} ruled the Skyline Rails with ${topScore} pts!`
      : 'The magnetic rails de-energized!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const now = performance.now();

    // 1. Synthwave Aero-Skyline Twilight Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#090814');
    bgGrad.addColorStop(0.4, '#15102A');
    bgGrad.addColorStop(1, '#24143D');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Neon Cyber Skyline Silhouettes in the distance
    ctx.fillStyle = '#1A1433';
    for (let x = 0; x < width; x += 75) {
      const bh = 140 + ((x * 17) % 110);
      ctx.fillRect(x, height - bh, 65, bh);

      // Window grid lights
      ctx.fillStyle = 'rgba(255, 64, 129, 0.15)';
      for (let wy = height - bh + 15; wy < height - 20; wy += 22) {
        ctx.fillRect(x + 12, wy, 8, 12);
        ctx.fillRect(x + 30, wy, 8, 12);
        ctx.fillRect(x + 48, wy, 8, 12);
      }
      ctx.fillStyle = '#1A1433';
    }

    // 2. High-Contrast HUD Banner (Top Center)
    const bannerW = Math.min(620, width - 60);
    const bannerH = 46;
    const bannerX = (width - bannerW) / 2;
    const bannerY = 56;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 12);
    else ctx.rect(bannerX, bannerY, bannerW, bannerH);
    ctx.fill();

    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 13px Montserrat, sans-serif';
    ctx.fillText('🛹 HOVERBOARD SKYLINE: UP/DOWN TO CHANGE RAILS (4 LINES)', bannerX + bannerW / 2, bannerY + 15);

    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.fillStyle = '#00E5FF';
    ctx.fillText(`SPACE / TAP: Ollie Jump | ⏱️ Round: ${Math.ceil(this.roundTimer)}s`, bannerX + bannerW / 2, bannerY + 31);
    ctx.restore();

    // 3. Render 4 Magnetic Skyline Rails
    const railLabels = ['LINE 1 (TOP)', 'LINE 2', 'LINE 3', 'LINE 4 (BOT)'];
    this.railYPositions.forEach((ry, idx) => {
      // Sub-track structural rail beam
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(width, ry);
      ctx.stroke();

      // Glowing energized laser track
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(width, ry);
      ctx.stroke();

      // Pulsing energy node along the rail
      const pulseX = ((now * 0.35 + idx * 200) % (width + 100)) - 50;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pulseX, ry, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Line label badge on the left margin
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(8, ry - 11, 85, 22);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, ry - 11, 85, 22);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '800 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(railLabels[idx], 50, ry);
      ctx.restore();
    });

    // 4. Render Obstacles
    for (const obs of this.obstacles) {
      if (obs.collected) continue;
      const oy = this.railYPositions[obs.railIdx];
      if (obs.type === 'barrier') {
        // Red holographic electric laser barricade
        ctx.save();
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(obs.x - 10, oy - 28, 20, 28);
        ctx.strokeStyle = '#FCA5A5';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x - 10, oy - 28, 20, 28);

        // Warning Hazard Stripes
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x - 6, oy - 22);
        ctx.lineTo(obs.x + 6, oy - 10);
        ctx.stroke();

        // Pulsing hazard glow
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FEE2E2';
        ctx.beginPath();
        ctx.arc(obs.x, oy - 28, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Glowing Golden Battery Cell
        ctx.save();
        const spin = now * 0.005;
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(obs.x, oy - 12, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(obs.x, oy - 12, 12, 4, spin, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#78350F';
        ctx.font = '900 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', obs.x, oy - 12);
        ctx.restore();
      }
    }

    // 5. Render Hoverboarders
    const playerX = 140;
    for (const p of this.getActivePlayers()) {
      const b = this.playersState.get(p.id);
      if (!b) continue;

      const py = b.y - b.altitude;
      const tilt = b.isJumping ? -0.22 : 0;

      ctx.save();
      ctx.translate(playerX, py);
      ctx.rotate(tilt);

      if (b.stunTimer > 0 && Math.floor(b.stunTimer * 10) % 2 === 0) {
        ctx.globalAlpha = 0.35;
      }

      // Glowing Cyan Ion Thruster Plumes
      const thrusterPulse = Math.sin(now * 0.02) * 2;
      ctx.fillStyle = '#00E5FF';
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(-14, 5, 5 + thrusterPulse, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(14, 5, 5 + thrusterPulse, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sleek Aerodynamic Hoverboard Deck
      ctx.shadowBlur = 0;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-20, -3, 40, 7, 3);
      else ctx.rect(-20, -3, 40, 7);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Player Mascot Riding Hoverboard
      this.drawPlayerMascot(ctx, p.id, 0, -18, 14, b.isJumping ? 'focused' : 'idle', now * 0.001);

      // Score / Current Line Pill Badge
      ctx.restore();

      ctx.save();
      ctx.translate(playerX, py);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(-26, -42, 52, 16);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(-26, -42, 52, 16);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`L${b.railIdx + 1} • ${Math.floor(b.score)}`, 0, -34);
      ctx.restore();
    }
  }
}
