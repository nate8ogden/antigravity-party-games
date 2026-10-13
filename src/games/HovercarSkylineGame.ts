import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CyberObstacle {
  id: number;
  x: number;
  y: number;
  lane: number;
  type: 'truck' | 'barrier' | 'battery' | 'nitro';
  passed: boolean;
  pulseAnim: number;
}

interface Hovercar {
  id: PlayerId;
  laneIdx: number; // 0: Top, 1: Middle, 2: Bottom
  targetY: number;
  currentY: number;
  speed: number;
  score: number;
  shield: number;
  stumbleTimer: number;
  nitroTimer: number;
  obstacles: CyberObstacle[];
  spawnTimer: number;
  switchCooldown: number;
  lastThrottle: number;
  thrusterFlicker: number;
  batteriesCollected: number;
}

export class HovercarSkylineGame extends BaseGame {
  public cars: Map<PlayerId, Hovercar> = new Map();
  public currentMapName: string = 'Neo-Kyoto Skyline Highway';
  private obsCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private animTimer: number = 0;
  private skylineThemeIndex: number = 0;

  private themes = [
    {
      name: 'Neo-Tokyo Cyberway',
      bgTop: '#070a14',
      bgBot: '#0f172a',
      neonColor: '#00F2FE',
      gridColor: 'rgba(0, 242, 254, 0.12)',
      sunColor: '#EC4899',
      pillarColor: '#1e293b'
    },
    {
      name: 'Outrun Sunset Strip',
      bgTop: '#1e0538',
      bgBot: '#3b0764',
      neonColor: '#F59E0B',
      gridColor: 'rgba(245, 158, 11, 0.14)',
      sunColor: '#F43F5E',
      pillarColor: '#4a044e'
    },
    {
      name: 'Matrix Acid Rainway',
      bgTop: '#021810',
      bgBot: '#052e16',
      neonColor: '#10B981',
      gridColor: 'rgba(16, 185, 129, 0.14)',
      sunColor: '#34D399',
      pillarColor: '#064e3b'
    }
  ];

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
    this.cars.clear();
    this.obsCounter = 0;
    this.botReactionTimers.clear();
    this.animTimer = 0;
    this.skylineThemeIndex = Math.floor(Math.random() * this.themes.length);
    this.currentMapName = this.themes[this.skylineThemeIndex].name;

    const active = this.getActivePlayers();
    const count = active.length;
    // Highway spans from y = 60 to height - 48
    const playerBlockH = (height - 108) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const baseY = 60 + idx * playerBlockH;
      const subLaneH = playerBlockH / 3;
      // Start in middle lane (1)
      const initialY = baseY + subLaneH * 1.5;

      this.cars.set(p.id, {
        id: p.id,
        laneIdx: 1, // EXACT middle lane
        targetY: initialY,
        currentY: initialY,
        speed: 260,
        score: 0,
        shield: 100,
        stumbleTimer: 0,
        nitroTimer: 0,
        obstacles: [],
        spawnTimer: 0.6 + Math.random() * 0.4,
        switchCooldown: 0,
        lastThrottle: 0,
        thrusterFlicker: Math.random() * 10,
        batteriesCollected: 0
      });

      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    this.animTimer += dt;

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const playerBlockH = (height - 108) / Math.max(count, 1);
    const subLaneH = playerBlockH / 3;

    this.cars.forEach((car, pId) => {
      const idx = active.findIndex(p => p.id === pId);
      const baseY = 60 + idx * playerBlockH;

      if (car.stumbleTimer > 0) {
        car.stumbleTimer -= dt;
        car.speed = 110;
      } else if (car.nitroTimer > 0) {
        car.nitroTimer -= dt;
        car.speed = 460;
      } else {
        car.speed = Math.min(380, car.speed + dt * 12);
      }

      car.score += Math.round(car.speed * dt * 0.12);
      car.thrusterFlicker += dt * 30;

      // Decrement switch debounce cooldown
      if (car.switchCooldown > 0) {
        car.switchCooldown -= dt;
      }

      // Read Inputs
      const throttle = this.input.getThrottle(car.id);
      const steer = this.input.getSteer(car.id);
      const isUpEdge = this.input.justUp(car.id) || (throttle > 0.45 && car.lastThrottle <= 0.45) || this.input.justLeft(car.id);
      const isDownEdge = this.input.justDown(car.id) || (throttle < -0.45 && car.lastThrottle >= -0.45) || this.input.justRight(car.id);
      const isTap = this.input.justAction(car.id) || (this.input.justPressed(car.id) && !isUpEdge && !isDownEdge);

      // CRITICAL FIX: Only change lane if switchCooldown <= 0!
      // This prevents single key presses from skipping the middle lane (1)!
      if (car.stumbleTimer <= 0 && car.switchCooldown <= 0) {
        if (isUpEdge && car.laneIdx > 0) {
          // Up moves from Bottom(2)->Mid(1) or Mid(1)->Top(0)
          car.laneIdx--;
          car.switchCooldown = 0.20; // 200ms lock prevents bouncing into outer lane
          this.audio.playTone(480 + (2 - car.laneIdx) * 90, 0.06, 'triangle');
          this.particles.spawnSparks(75, car.currentY, '#00F2FE', 6);
        } else if (isDownEdge && car.laneIdx < 2) {
          // Down moves from Top(0)->Mid(1) or Mid(1)->Bottom(2)
          car.laneIdx++;
          car.switchCooldown = 0.20;
          this.audio.playTone(480 + (2 - car.laneIdx) * 90, 0.06, 'triangle');
          this.particles.spawnSparks(75, car.currentY, '#00F2FE', 6);
        } else if (isTap) {
          // One-button tap mode: cycles smoothly Top(0) -> Mid(1) -> Bot(2) -> Top(0)
          car.laneIdx = (car.laneIdx + 1) % 3;
          car.switchCooldown = 0.20;
          this.audio.playTone(520 + car.laneIdx * 70, 0.06, 'triangle');
          this.particles.spawnSparks(75, car.currentY, '#00F2FE', 6);
        }
      }

      car.lastThrottle = throttle;

      // Smooth vertical spring glide to target lane
      car.targetY = baseY + car.laneIdx * subLaneH + subLaneH * 0.5;
      car.currentY += (car.targetY - car.currentY) * Math.min(1, 14 * dt);

      // Spawn obstacles along the 3 sub-lanes
      car.spawnTimer -= dt;
      if (car.spawnTimer <= 0) {
        car.spawnTimer = 0.75 + Math.random() * 0.45;
        const obsLane = Math.floor(Math.random() * 3);
        const rand = Math.random();
        const type: 'battery' | 'nitro' | 'truck' | 'barrier' =
          rand < 0.25 ? 'battery' : rand < 0.40 ? 'nitro' : rand < 0.72 ? 'truck' : 'barrier';

        car.obstacles.push({
          id: this.obsCounter++,
          x: width + 40,
          y: baseY + obsLane * subLaneH + subLaneH * 0.5,
          lane: obsLane,
          type,
          passed: false,
          pulseAnim: Math.random() * Math.PI * 2
        });
      }

      // Move and check collisions with obstacles
      for (let i = car.obstacles.length - 1; i >= 0; i--) {
        const obs = car.obstacles[i];
        obs.x -= car.speed * dt;
        obs.pulseAnim += dt * 6;

        // Collision detection with player hovercar at x = 75
        if (!obs.passed && Math.abs(obs.x - 75) < 32) {
          if (Math.abs(obs.y - car.currentY) < subLaneH * 0.42) {
            obs.passed = true;
            if (obs.type === 'battery') {
              car.score += 45;
              car.batteriesCollected++;
              this.audio.playCoin();
              this.particles.spawnSparks(75, car.currentY, '#00FFCC', 12);
              this.particles.showFloatingText('+45 BATTERY ⚡', 85, car.currentY - 18, '#00FFCC', 18);
            } else if (obs.type === 'nitro') {
              car.nitroTimer = 2.4;
              car.score += 75;
              this.audio.playBoost();
              this.particles.shake(4);
              this.particles.spawnSparks(75, car.currentY, '#F59E0B', 16);
              this.particles.showFloatingText('🚀 NITRO OVERDRIVE!', 85, car.currentY - 18, '#F59E0B', 22);
            } else {
              // Crash with truck or barrier!
              car.stumbleTimer = 0.95;
              car.nitroTimer = 0;
              car.shield = Math.max(0, car.shield - 25);
              car.score = Math.max(0, car.score - 30);
              this.audio.playExplosion();
              this.particles.shake(6);
              this.particles.spawnExplosion(75, car.currentY, '#EF4444', 20);
              this.particles.showFloatingText('CRASH! -30', 85, car.currentY - 18, '#EF4444', 20);
            }
          }
        }

        if (obs.x < -60) {
          car.obstacles.splice(i, 1);
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    height: number
  ): void {
    const car = this.cars.get(botId);
    if (!car || car.stumbleTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const playerBlockH = (height - 108) / Math.max(count, 1);
    const subLaneH = playerBlockH / 3;

    // Check if hazard exists in current lane
    const hazard = car.obstacles.find(o => {
      return (o.type === 'truck' || o.type === 'barrier') &&
        !o.passed &&
        o.x > 75 &&
        o.x < (difficulty === 'bot_hard' ? 280 : difficulty === 'bot_normal' ? 220 : 170) &&
        o.lane === car.laneIdx;
    });

    if (hazard) {
      const dodgeChance = difficulty === 'bot_hard' ? 0.94 : difficulty === 'bot_normal' ? 0.75 : 0.48;
      if (Math.random() < dodgeChance) {
        // Decide whether to go up or down to avoid hazard
        let targetLane = car.laneIdx;
        if (car.laneIdx === 0) {
          targetLane = 1;
        } else if (car.laneIdx === 2) {
          targetLane = 1;
        } else {
          // In middle lane, pick the lane with no hazard or with a battery
          const topHazard = car.obstacles.some(o => o.lane === 0 && !o.passed && o.x > 75 && o.x < 240);
          targetLane = topHazard ? 2 : 0;
        }

        if (targetLane < car.laneIdx) {
          this.input.setBotInput(botId, true, 0, 1, false); // Up
        } else {
          this.input.setBotInput(botId, true, 0, -1, false); // Down
        }

        const reactionDelay = difficulty === 'bot_hard' ? 0.22 : difficulty === 'bot_normal' ? 0.35 : 0.50;
        this.botReactionTimers.set(botId, reactionDelay);
        return;
      }
    }

    // Check for attractive collectible in adjacent lane
    const bonus = car.obstacles.find(o => {
      return (o.type === 'battery' || o.type === 'nitro') &&
        !o.passed &&
        o.x > 90 &&
        o.x < 260 &&
        o.lane !== car.laneIdx;
    });

    if (bonus && Math.random() < (difficulty === 'bot_hard' ? 0.8 : difficulty === 'bot_normal' ? 0.45 : 0.2)) {
      if (bonus.lane < car.laneIdx) {
        this.input.setBotInput(botId, true, 0, 1, false);
      } else {
        this.input.setBotInput(botId, true, 0, -1, false);
      }
      this.botReactionTimers.set(botId, 0.4);
      return;
    }

    this.botReactionTimers.set(botId, 0.1);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const curTheme = this.themes[this.skylineThemeIndex];

    // Background Gradient: Cyber Skyline
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, curTheme.bgTop);
    grad.addColorStop(0.5, curTheme.bgBot);
    grad.addColorStop(1, '#05070e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Parallax Skyline Distant Cityscape
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    for (let i = 0; i < 18; i++) {
      const bx = ((i * 68 - this.animTimer * 25) % (width + 80)) - 40;
      const bw = 48 + (i % 3) * 14;
      const bh = 90 + ((i * 37) % 70);
      ctx.fillRect(bx, height - bh, bw, bh);

      // Skyscraper neon windows
      ctx.fillStyle = (i % 2 === 0) ? curTheme.gridColor : 'rgba(255, 255, 255, 0.08)';
      for (let w = 6; w < bw - 8; w += 10) {
        for (let r = 8; r < bh - 10; r += 16) {
          if ((i + w + r) % 3 !== 0) {
            ctx.fillRect(bx + w, height - bh + r, 4, 6);
          }
        }
      }
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    }
    ctx.restore();

    const active = this.getActivePlayers();
    const count = active.length;
    const playerBlockH = (height - 108) / Math.max(count, 1);
    const subLaneH = playerBlockH / 3;

    // Render Player Highway Sectors
    this.cars.forEach((car, pId) => {
      const cfg = this.players.find(p => p.id === car.id);
      const idx = active.findIndex(p => p.id === pId);
      const baseY = 60 + idx * playerBlockH;

      // Sector Backdrop
      ctx.fillStyle = 'rgba(10, 15, 28, 0.85)';
      ctx.fillRect(20, baseY, width - 40, playerBlockH);

      // Glowing Cyber Rails (Top, Middle-1, Middle-2, Bottom)
      ctx.strokeStyle = curTheme.gridColor;
      ctx.lineWidth = 1.5;

      // 3 Sub-lanes dividers with animated neon road markers
      for (let l = 1; l <= 2; l++) {
        const lineY = baseY + subLaneH * l;
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash([16, 12]);
        ctx.lineDashOffset = -this.animTimer * (car.speed * 0.8);
        ctx.beginPath();
        ctx.moveTo(20, lineY);
        ctx.lineTo(width - 20, lineY);
        ctx.stroke();
        ctx.restore();
      }

      // Outer Sector Border with Player Color Accent
      ctx.strokeStyle = cfg?.color || '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, baseY, width - 40, playerBlockH);

      // Lane Guide Badges on the left edge: [TOP], [MID], [BOT]
      const laneNames = ['TOP', 'MID', 'BOT'];
      for (let l = 0; l < 3; l++) {
        const ly = baseY + l * subLaneH + subLaneH * 0.5;
        const isCurrent = car.laneIdx === l;
        ctx.fillStyle = isCurrent ? (cfg?.color || '#00F2FE') : 'rgba(255, 255, 255, 0.15)';
        ctx.font = '900 9px Montserrat, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(laneNames[l], 26, ly + 3);

        if (isCurrent) {
          // Arrow indicator pointing to current lane
          ctx.beginPath();
          ctx.moveTo(48, ly - 4);
          ctx.lineTo(54, ly);
          ctx.lineTo(48, ly + 4);
          ctx.fill();
        }
      }

      // Render Obstacles in this highway sector
      car.obstacles.forEach(o => {
        if (o.passed) return;

        ctx.save();
        ctx.translate(o.x, o.y);

        if (o.type === 'battery') {
          // Golden/Cyan Cyber Power Core
          ctx.fillStyle = '#00FFCC';
          ctx.shadowColor = '#00FFCC';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(0, 0, 9 + Math.sin(o.pulseAnim) * 1.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚡', 0, 0);
        } else if (o.type === 'nitro') {
          // Fiery Rocket Booster Core
          ctx.fillStyle = '#F59E0B';
          ctx.shadowColor = '#F59E0B';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(0, 0, 10 + Math.sin(o.pulseAnim * 1.5) * 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🚀', 0, 0);
        } else if (o.type === 'truck') {
          // Heavy Cyber Container Hauler
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#DC2626';
          if (ctx.roundRect) ctx.roundRect(-22, -11, 44, 22, 5);
          else ctx.fillRect(-22, -11, 44, 22);
          ctx.fill();

          // Container ribbed lines
          ctx.fillStyle = '#7F1D1D';
          ctx.fillRect(-16, -9, 5, 18);
          ctx.fillRect(-6, -9, 5, 18);
          ctx.fillRect(4, -9, 5, 18);

          // Headlights
          ctx.fillStyle = '#FEF08A';
          ctx.fillRect(-22, -8, 3, 5);
          ctx.fillRect(-22, 3, 3, 5);
        } else {
          // Electric Forcefield Barrier
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#F59E0B';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(-12, -12);
          ctx.lineTo(12, 12);
          ctx.moveTo(12, -12);
          ctx.lineTo(-12, 12);
          ctx.stroke();

          // Pulsing warning diamond
          ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
          ctx.beginPath();
          ctx.moveTo(0, -14);
          ctx.lineTo(14, 0);
          ctx.lineTo(0, 14);
          ctx.lineTo(-14, 0);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      });

      // Render 2.5D Aerodynamic Hovercar
      ctx.save();
      ctx.translate(75, car.currentY);

      // Blue plasma hover cushion underneath
      const plasmaScale = 1 + Math.sin(car.thrusterFlicker) * 0.15;
      const plasmaColor = car.nitroTimer > 0 ? 'rgba(245, 158, 11, 0.65)' : 'rgba(0, 242, 254, 0.55)';
      ctx.fillStyle = plasmaColor;
      ctx.shadowColor = car.nitroTimer > 0 ? '#F59E0B' : '#00F2FE';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(0, 10, 22 * plasmaScale, 6 * plasmaScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rear Jet Exhaust Plume
      const flameLen = (car.nitroTimer > 0 ? 35 : 18) + Math.sin(car.thrusterFlicker * 2) * 5;
      const flameGrad = ctx.createLinearGradient(-18, 0, -18 - flameLen, 0);
      flameGrad.addColorStop(0, '#FFFFFF');
      flameGrad.addColorStop(0.3, car.nitroTimer > 0 ? '#F59E0B' : '#38BDF8');
      flameGrad.addColorStop(1, 'rgba(0, 242, 254, 0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-18, -4);
      ctx.lineTo(-18 - flameLen, 0);
      ctx.lineTo(-18, 4);
      ctx.closePath();
      ctx.fill();

      // Car Sleek Chitin Body
      const carColor = car.stumbleTimer > 0 ? '#64748B' : (cfg?.color || '#3B82F6');
      ctx.fillStyle = carColor;
      ctx.shadowColor = carColor;
      ctx.shadowBlur = car.nitroTimer > 0 ? 16 : 8;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-18, -9, 36, 18, 6);
      else ctx.fillRect(-18, -9, 36, 18);
      ctx.fill();

      // Cockpit Tinted Canopy Glass
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(2, 0, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Forward Twin Laser Headlight Beams
      const beamGrad = ctx.createLinearGradient(18, 0, 50, 0);
      beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(18, -5);
      ctx.lineTo(48, -12);
      ctx.lineTo(48, -2);
      ctx.lineTo(18, -3);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(18, 3);
      ctx.lineTo(48, 2);
      ctx.lineTo(48, 12);
      ctx.lineTo(18, 5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Player Score & Status Header inside Sector
      ctx.fillStyle = cfg?.color || '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      const statusText = car.nitroTimer > 0 ? '🚀 NITRO ACTIVE!' : car.stumbleTimer > 0 ? '💥 STUMBLED!' : '';
      ctx.fillText(
        `${cfg?.name || 'Player'}: ${car.score} pts  |  ${Math.round(car.speed)} km/h  ${statusText}`,
        70,
        baseY + 16
      );
    });

    // Master Theme Pill at Bottom-Left (Rule compliant: x: 20, y: height - 44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 340, 32, 16);
    else ctx.fillRect(20, height - 44, 340, 32);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = curTheme.neonColor;
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `🛣️ [${this.skylineThemeIndex + 1}/3] ${curTheme.name} | Up/Down/Tap Switch`,
      34,
      height - 24
    );
    ctx.restore();
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.cars.forEach((c, pId) => scores.set(pId, c.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.cars.entries())
      .map(([playerId, c]) => ({ playerId, score: c.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} dominated the cyberway skyline at top speed!` : 'Hovercars crashed in gridlock!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
