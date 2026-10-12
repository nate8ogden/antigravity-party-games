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
  railIdx: number; // 0, 1, 2, 3
  y: number;
  targetY: number;
  altitude: number; // jump height
  vAltitude: number;
  isJumping: boolean;
  score: number;
  batteriesCollected: number;
  grindCombo: number;
  stunTimer: number;
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

    const startY = height * 0.35;
    const spacing = 65;
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
        stunTimer: 0
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
        x: width + 30,
        railIdx,
        type: isBarrier ? 'barrier' : 'battery',
        collected: false
      });
    }

    // Scroll obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.scrollSpeed * dt;
      if (obs.x < -40) {
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

      // Input: Switch rails (Up/Down) + Jump (Action/Tap)
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      if (this.input.justUp(p.id) || throttle > 0.5) {
        boarder.railIdx = Math.max(0, boarder.railIdx - 1);
        boarder.targetY = this.railYPositions[boarder.railIdx];
      } else if (this.input.justDown(p.id) || throttle < -0.5) {
        boarder.railIdx = Math.min(this.railYPositions.length - 1, boarder.railIdx + 1);
        boarder.targetY = this.railYPositions[boarder.railIdx];
      }

      // Jump Ollie
      if (justAction && !boarder.isJumping) {
        boarder.isJumping = true;
        boarder.vAltitude = 280;
        this.audio.playTap();
      }

      // Altitude physics
      if (boarder.isJumping) {
        boarder.altitude += boarder.vAltitude * dt;
        boarder.vAltitude -= 800 * dt; // gravity
        if (boarder.altitude <= 0) {
          boarder.altitude = 0;
          boarder.vAltitude = 0;
          boarder.isJumping = false;
        }
      }

      // Smooth rail transition
      boarder.y += (boarder.targetY - boarder.y) * 14 * dt;

      // Passive grind score
      if (!boarder.isJumping) {
        boarder.grindCombo += dt * 5;
        boarder.score += dt * 10;
        // Rail sparks
        if (Math.random() < 0.3) {
          this.particles.emit(playerX - 10, boarder.y + 4, 1, '#00E5FF');
        }
      }

      // Obstacle collision check
      for (const obs of this.obstacles) {
        if (obs.railIdx !== boarder.railIdx) continue;
        if (Math.abs(obs.x - playerX) < 22) {
          if (obs.type === 'battery' && !obs.collected) {
            obs.collected = true;
            boarder.batteriesCollected++;
            boarder.score += 25;
            this.audio.playScore();
            this.particles.spawnSparks(playerX, boarder.y, '#FFD700', 8);
          } else if (obs.type === 'barrier' && !boarder.isJumping) {
            // Crash into barrier!
            boarder.stunTimer = 1.0;
            boarder.score = Math.max(0, boarder.score - 20);
            boarder.grindCombo = 0;
            this.audio.playExplosion();
            this.particles.emit(playerX, boarder.y, 10, '#E53935');
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
    // Check impending obstacles on bot's rail
    const ahead = this.obstacles.filter(
      o => o.railIdx === boarder.railIdx && o.x > playerX && o.x < playerX + 160
    );

    let jump = false;
    let switchRail = 0;

    if (ahead.length > 0) {
      const obstacle = ahead[0];
      if (obstacle.type === 'barrier') {
        if (obstacle.x < playerX + 70) {
          jump = true;
        } else if (difficulty !== 'bot_easy') {
          // Switch to adjacent rail
          switchRail = boarder.railIdx === 0 ? -1 : 1;
        }
      }
    } else {
      // Seek battery on nearby rail
      const batteries = this.obstacles.filter(
        o => o.type === 'battery' && !o.collected && o.x > playerX && o.x < playerX + 200
      );
      if (batteries.length > 0 && difficulty === 'bot_hard') {
        const target = batteries[0];
        if (target.railIdx > boarder.railIdx) switchRail = -1;
        else if (target.railIdx < boarder.railIdx) switchRail = 1;
      }
    }

    this.input.setBotInput(botId, jump, 0, switchRail, jump);

    let delay = 0.25;
    if (difficulty === 'bot_easy') delay = 0.45;
    else if (difficulty === 'bot_hard') delay = 0.10;

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
      ? `Player ${winnerId + 1} crushed the Skyline Rails with ${topScore} pts!`
      : 'The magnetic rails de-energized with no master grind king!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#060610');
    bgGrad.addColorStop(1, '#131124');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant skyscraper silhouettes
    ctx.fillStyle = '#1c1b30';
    for (let x = 0; x < width; x += 70) {
      const bh = 140 + ((x * 13) % 90);
      ctx.fillRect(x, height - bh, 60, bh);
    }

    // Top Header
    ctx.save();
    ctx.fillStyle = '#00E5FF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HOVERBOARD RAIL', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FF4081';
    ctx.fillText('SWITCH RAILS (UP/DOWN) • JUMP OVER BARRICADES & SNATCH BATTERIES', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Magnetic Rails
    for (const ry of this.railYPositions) {
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(width, ry);
      ctx.stroke();

      // Glowing energized laser wire
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(width, ry);
      ctx.stroke();
    }

    // Render Obstacles
    for (const obs of this.obstacles) {
      if (obs.collected) continue;
      const oy = this.railYPositions[obs.railIdx];
      if (obs.type === 'barrier') {
        // Red holographic electric barricade
        ctx.fillStyle = '#E53935';
        ctx.fillRect(obs.x - 8, oy - 22, 16, 22);
        ctx.strokeStyle = '#FF8A80';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x - 8, oy - 22, 16, 22);
      } else {
        // Glowing Golden Battery Cell
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(obs.x, oy - 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFA000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Render Hoverboarders
    const playerX = 140;
    for (const p of this.getActivePlayers()) {
      const b = this.playersState.get(p.id);
      if (!b) continue;

      const py = b.y - b.altitude;
      ctx.save();
      ctx.translate(playerX, py);

      if (b.stunTimer > 0 && Math.floor(b.stunTimer * 10) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      // Hoverboard Deck
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-16, -2, 32, 6, 3);
      ctx.fill();

      // Glowing Repulsor Thrusters
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.arc(-10, 4, 3, 0, Math.PI * 2);
      ctx.arc(10, 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Skater Body
      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.roundRect(-5, -20, 10, 18, 3);
      ctx.fill();

      // Helmet
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, -25, 6, 0, Math.PI * 2);
      ctx.fill();

      // Score / Combo text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(b.score)}`, 0, -34);

      ctx.restore();
    }
  }
}
