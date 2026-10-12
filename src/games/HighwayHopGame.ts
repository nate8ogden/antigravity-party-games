import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type LaneType = 'SAFE' | 'ROAD' | 'RAIL' | 'RIVER';

interface Lane {
  index: number;
  y: number;
  height: number;
  type: LaneType;
  speed: number; // positive = moves right, negative = moves left
  color: string;
  // Specific lane entity data
  entities: LaneEntity[];
  railWarning?: number; // countdown until train rushes past
  trainActive?: boolean;
}

interface LaneEntity {
  x: number;
  width: number;
  height: number;
  speed: number;
  color: string;
  type: 'car' | 'truck' | 'train' | 'log' | 'lilypad';
}

interface HopperPlayer {
  id: PlayerId;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  laneIndex: number;
  colIndex: number;
  maxLaneReached: number;
  isHopping: boolean;
  hopProgress: number; // 0 to 1
  hopStartX: number;
  hopStartY: number;
  score: number;
  lives: number;
  maxLives: number;
  invulnTimer: number;
  squishScaleX: number;
  squishScaleY: number;
  alive: boolean;
  hasFinished: boolean;
  onLogSpeed: number;
  botDecisionTimer: number;
}

export class HighwayHopGame extends BaseGame {
  private playersState: Map<PlayerId, HopperPlayer> = new Map();
  private lanes: Lane[] = [];
  private currentMapName: string = 'Neon City Freeway';
  private laneHeight: number = 38;
  private totalLanes: number = 14;
  private columnCount: number = 18;
  private colWidth: number = 44;
  private arenaOffsetY: number = 90;
  private finishOrder: PlayerId[] = [];

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
    this.finishOrder = [];

    // Calculate dimensions
    this.arenaOffsetY = 88;
    this.laneHeight = Math.max(34, Math.floor((height - this.arenaOffsetY - 20) / this.totalLanes));
    this.colWidth = width / this.columnCount;

    this.generateProceduralMap(width, height);
    this.initPlayers(width);
  }

  private initPlayers(width: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;

    // Distribute players along bottom safe lane (lane 0)
    const lane0Y = this.arenaOffsetY + (this.totalLanes - 1) * this.laneHeight + this.laneHeight / 2;

    active.forEach((p, idx) => {
      const col = Math.floor(((idx + 1) * this.columnCount) / (count + 1));
      const px = (col + 0.5) * this.colWidth;
      const py = lane0Y;

      this.playersState.set(p.id, {
        id: p.id,
        x: px,
        y: py,
        targetX: px,
        targetY: py,
        laneIndex: 0,
        colIndex: col,
        maxLaneReached: 0,
        isHopping: false,
        hopProgress: 0,
        hopStartX: px,
        hopStartY: py,
        score: 0,
        lives: 3,
        maxLives: 3,
        invulnTimer: 1.0,
        squishScaleX: 1,
        squishScaleY: 1,
        alive: true,
        hasFinished: false,
        onLogSpeed: 0,
        botDecisionTimer: 0.2 + idx * 0.1
      });
    });
  }

  private generateProceduralMap(width: number, height: number): void {
    const maps = [
      'Neon City Freeway',
      'Country Farmland',
      'Subway Rail Yard',
      'Amazon River Rapids'
    ];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];
    this.lanes = [];

    // Total lanes: 0 is start (bottom), totalLanes - 1 is goal (top)
    // Map pattern from bottom (index 0) to top (index totalLanes - 1):
    for (let i = 0; i < this.totalLanes; i++) {
      const laneY = this.arenaOffsetY + (this.totalLanes - 1 - i) * this.laneHeight;
      let type: LaneType = 'SAFE';
      let speed = 0;
      let color = '#1E293B';

      if (i === 0 || i === this.totalLanes - 1 || i === 4 || i === 8) {
        // Safe rest berms
        type = 'SAFE';
        color = i === this.totalLanes - 1 ? '#10B981' : '#1E293B';
      } else if (this.currentMapName === 'Neon City Freeway') {
        if (i <= 3) {
          type = 'ROAD';
          speed = (i % 2 === 0 ? 1 : -1) * (110 + i * 25);
          color = '#0F172A';
        } else if (i === 5 || i === 6) {
          type = 'RAIL';
          speed = (i % 2 === 0 ? 1 : -1) * 380;
          color = '#1E1B4B';
        } else {
          type = 'RIVER';
          speed = (i % 2 === 0 ? 1 : -1) * (70 + (i - 8) * 15);
          color = '#0284C7';
        }
      } else if (this.currentMapName === 'Subway Rail Yard') {
        if (i === 1 || i === 2 || i === 5 || i === 6 || i === 7) {
          type = 'RAIL';
          speed = (i % 2 === 0 ? 1 : -1) * 360;
          color = '#334155';
        } else if (i === 3) {
          type = 'ROAD';
          speed = 95;
          color = '#1E293B';
        } else {
          type = 'RIVER';
          speed = (i % 2 === 0 ? 1 : -1) * 85;
          color = '#0369A1';
        }
      } else if (this.currentMapName === 'Amazon River Rapids') {
        if (i === 1 || i === 2) {
          type = 'ROAD';
          speed = (i % 2 === 0 ? 1 : -1) * 100;
          color = '#3F2E18';
        } else {
          type = 'RIVER';
          speed = (i % 2 === 0 ? 1 : -1) * (100 + i * 18);
          color = '#0284C7';
        }
      } else {
        // Country Farmland
        if (i <= 3) {
          type = 'ROAD';
          speed = (i % 2 === 0 ? 1 : -1) * (90 + i * 20);
          color = '#334155';
        } else if (i === 5) {
          type = 'RAIL';
          speed = -340;
          color = '#1E293B';
        } else {
          type = 'RIVER';
          speed = (i % 2 === 0 ? 1 : -1) * 80;
          color = '#0284C7';
        }
      }

      const lane: Lane = {
        index: i,
        y: laneY,
        height: this.laneHeight,
        type,
        speed,
        color,
        entities: [],
        railWarning: type === 'RAIL' ? 2.5 + Math.random() * 3 : undefined,
        trainActive: false
      };

      // Populate lane entities
      this.populateLaneEntities(lane, width);
      this.lanes.push(lane);
    }
  }

  private populateLaneEntities(lane: Lane, width: number): void {
    if (lane.type === 'ROAD') {
      const entityCount = 3 + Math.floor(Math.random() * 2);
      const spacing = width / entityCount;
      const carColors = ['#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6'];

      for (let e = 0; e < entityCount; e++) {
        const isTruck = Math.random() < 0.35;
        const eWidth = isTruck ? 74 : 44;
        const startX = e * spacing + (Math.random() - 0.5) * 30;

        lane.entities.push({
          x: (startX + width) % width,
          width: eWidth,
          height: this.laneHeight * 0.72,
          speed: lane.speed,
          color: carColors[Math.floor(Math.random() * carColors.length)],
          type: isTruck ? 'truck' : 'car'
        });
      }
    } else if (lane.type === 'RIVER') {
      const logCount = 3 + Math.floor(Math.random() * 2);
      const spacing = width / logCount;
      for (let e = 0; e < logCount; e++) {
        const isLily = Math.random() < 0.25;
        const lWidth = isLily ? 36 : 78 + Math.floor(Math.random() * 30);
        const startX = e * spacing + (Math.random() - 0.5) * 20;

        lane.entities.push({
          x: (startX + width) % width,
          width: lWidth,
          height: this.laneHeight * 0.75,
          speed: lane.speed,
          color: isLily ? '#22C55E' : '#78350F',
          type: isLily ? 'lilypad' : 'log'
        });
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot inputs via BaseGame
    this.updateBots(dt, width, height);

    // Update Lanes (cars, trains, river logs)
    for (const lane of this.lanes) {
      // Update moving entities
      for (const ent of lane.entities) {
        ent.x += ent.speed * dt;
        if (ent.speed > 0 && ent.x > width + ent.width) {
          ent.x = -ent.width;
        } else if (ent.speed < 0 && ent.x < -ent.width) {
          ent.x = width + ent.width;
        }
      }

      // Railway warning & train triggers
      if (lane.type === 'RAIL') {
        if (lane.railWarning !== undefined) {
          lane.railWarning -= dt;
          if (lane.railWarning <= 0) {
            // Spawn high-speed train!
            lane.trainActive = true;
            lane.railWarning = 5.0 + Math.random() * 4.0;
            const trainW = 380;
            const startX = lane.speed > 0 ? -trainW : width + 20;

            lane.entities = [
              {
                x: startX,
                width: trainW,
                height: this.laneHeight * 0.85,
                speed: lane.speed,
                color: '#DC2626',
                type: 'train'
              }
            ];
            this.audio.playWhoosh();
            this.particles.shake(0.25);
          }
        }

        // Clean up train once past
        if (lane.trainActive && lane.entities.length > 0) {
          const t = lane.entities[0];
          if (
            (t.speed > 0 && t.x > width + 100) ||
            (t.speed < 0 && t.x < -t.width - 100)
          ) {
            lane.entities = [];
            lane.trainActive = false;
          }
        }
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.alive) continue;

      if (ps.invulnTimer > 0) {
        ps.invulnTimer = Math.max(0, ps.invulnTimer - dt);
      }

      // Smooth recovery from squish
      ps.squishScaleX += (1 - ps.squishScaleX) * 10 * dt;
      ps.squishScaleY += (1 - ps.squishScaleY) * 10 * dt;

      // Handle hopping interpolation
      if (ps.isHopping) {
        ps.hopProgress += dt * 6.5; // ~0.15s per hop
        if (ps.hopProgress >= 1) {
          ps.hopProgress = 1;
          ps.isHopping = false;
          ps.x = ps.targetX;
          ps.y = ps.targetY;
        } else {
          const ease = Math.sin(ps.hopProgress * Math.PI);
          ps.x = ps.hopStartX + (ps.targetX - ps.hopStartX) * ps.hopProgress;
          ps.y = ps.hopStartY + (ps.targetY - ps.hopStartY) * ps.hopProgress;
          // Vertical arc pop
          ps.squishScaleY = 1 + ease * 0.35;
          ps.squishScaleX = 1 - ease * 0.2;
        }
      }

      // If standing on river, drift with log speed
      const curLane = this.lanes[ps.laneIndex];
      if (!ps.isHopping && curLane && curLane.type === 'RIVER') {
        ps.x += ps.onLogSpeed * dt;
        ps.targetX = ps.x;

        // Drown check if carried offscreen
        if (ps.x < 10 || ps.x > width - 10) {
          this.handlePlayerDeath(ps, p.color, 'DRIFTED OFF!');
          continue;
        }
      }

      // Read Inputs if not hopping and alive
      if (!ps.isHopping && ps.alive && !ps.hasFinished) {
        this.handlePlayerInput(p.id, ps, width);
      }

      // Hazard & Collision Checks
      this.checkPlayerCollisions(ps, p.color, width);
    }

    // Check Round Over condition
    const aliveCount = Array.from(this.playersState.values()).filter((p) => p.alive && !p.hasFinished).length;
    const finishedCount = this.finishOrder.length;
    if (this.roundTimer <= 0 || aliveCount === 0 || finishedCount >= this.getActivePlayers().length) {
      this.isFinished = true;
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  private handlePlayerInput(pid: PlayerId, ps: HopperPlayer, width: number): void {
    if (ps.isHopping || !ps.alive || ps.hasFinished) return;

    let dCol = 0;
    let dLane = 0;

    const justAction = this.input.justAction(pid) || (this.input.justPressed(pid) && this.input.getSteer(pid) === 0);
    const steer = this.input.getSteer(pid);
    const throttle = this.input.getThrottle(pid);

    if (justAction) {
      dLane = 1;
    } else if (throttle > 0.5) {
      dLane = 1;
    } else if (throttle < -0.5) {
      dLane = -1;
    } else if (steer < -0.5) {
      dCol = -1;
    } else if (steer > 0.5) {
      dCol = 1;
    }

    if (dLane !== 0 || dCol !== 0) {
      this.attemptHop(ps, dCol, dLane, width);
    }
  }

  private attemptHop(ps: HopperPlayer, dCol: number, dLane: number, width: number): void {
    if (ps.isHopping) return;
    const targetLaneIdx = Math.max(0, Math.min(this.totalLanes - 1, ps.laneIndex + dLane));
    const targetColIdx = Math.max(0, Math.min(this.columnCount - 1, ps.colIndex + dCol));

    const targetLane = this.lanes[targetLaneIdx];
    if (!targetLane) return;

    ps.isHopping = true;
    ps.hopProgress = 0;
    ps.hopStartX = ps.x;
    ps.hopStartY = ps.y;
    ps.laneIndex = targetLaneIdx;
    ps.colIndex = targetColIdx;
    ps.targetX = (targetColIdx + 0.5) * this.colWidth;
    ps.targetY = targetLane.y + targetLane.height / 2;

    this.audio.playBounce();
    this.particles.spawnDust(ps.x, ps.y + 12, 6);

    // Scoring progression
    if (targetLaneIdx > ps.maxLaneReached) {
      ps.maxLaneReached = targetLaneIdx;
      ps.score += 25;

      // Finish line reach!
      if (targetLaneIdx === this.totalLanes - 1 && !ps.hasFinished) {
        ps.hasFinished = true;
        ps.score += 500;
        this.finishOrder.push(ps.id);
        this.audio.playFanfare();
        this.particles.showFloatingText('GOAL! +500', ps.x, ps.y - 30, '#10B981', 28);
        this.particles.spawnConfetti(ps.x, ps.y, 40);

        // First finisher ends round after brief celebration
        if (this.finishOrder.length === 1) {
          this.roundTimer = Math.min(this.roundTimer, 3.5);
        }
      }
    }
  }

  private checkPlayerCollisions(ps: HopperPlayer, color: string, width: number): void {
    if (ps.invulnTimer > 0 || !ps.alive || ps.hasFinished) return;

    const lane = this.lanes[ps.laneIndex];
    if (!lane) return;

    // Road & Rail collisions
    if (lane.type === 'ROAD' || lane.type === 'RAIL') {
      for (const ent of lane.entities) {
        const entLeft = ent.x;
        const entRight = ent.x + ent.width;
        const entTop = lane.y + (lane.height - ent.height) / 2;
        const entBottom = entTop + ent.height;

        // Bounding box overlap with player circle radius ~12
        if (
          ps.x + 10 > entLeft &&
          ps.x - 10 < entRight &&
          ps.y + 10 > entTop &&
          ps.y - 10 < entBottom
        ) {
          // Squished!
          this.handlePlayerDeath(ps, color, ent.type === 'train' ? 'TRAIN WRECK!' : 'SQUISHED!');
          return;
        }
      }
    }

    // River log support check
    if (lane.type === 'RIVER' && !ps.isHopping) {
      let onLog = false;
      let logSpeed = 0;

      for (const ent of lane.entities) {
        if (ps.x >= ent.x - 8 && ps.x <= ent.x + ent.width + 8) {
          onLog = true;
          logSpeed = ent.speed;
          break;
        }
      }

      if (onLog) {
        ps.onLogSpeed = logSpeed;
      } else {
        // Splashed in river water!
        this.handlePlayerDeath(ps, color, 'SPLASH!');
        return;
      }
    } else {
      ps.onLogSpeed = 0;
    }
  }

  private handlePlayerDeath(ps: HopperPlayer, color: string, reason: string): void {
    ps.lives -= 1;
    ps.invulnTimer = 1.3;
    ps.squishScaleX = 1.8;
    ps.squishScaleY = 0.3;

    this.audio.playExplosion();
    this.particles.shake(0.35);
    this.particles.spawnExplosion(ps.x, ps.y, color, 20);
    this.particles.showFloatingText(reason, ps.x, ps.y - 25, '#EF4444', 22);

    if (ps.lives <= 0) {
      ps.alive = false;
      this.particles.showFloatingText('ELIMINATED!', ps.x, ps.y - 35, '#EF4444', 26);
    } else {
      // Respawn at nearest safe lane behind player
      let respawnLaneIdx = 0;
      for (let l = ps.laneIndex; l >= 0; l--) {
        if (this.lanes[l].type === 'SAFE') {
          respawnLaneIdx = l;
          break;
        }
      }
      ps.laneIndex = respawnLaneIdx;
      const rLane = this.lanes[respawnLaneIdx];
      ps.targetX = ps.x;
      ps.targetY = rLane.y + rLane.height / 2;
      ps.x = ps.targetX;
      ps.y = ps.targetY;
      ps.isHopping = false;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || !ps.alive || ps.hasFinished || ps.isHopping) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    ps.botDecisionTimer -= dt;
    if (ps.botDecisionTimer > 0) return;

    // Reset decision cadence by difficulty
    const interval =
      difficulty === 'bot_hard'
        ? 0.16 + Math.random() * 0.06
        : difficulty === 'bot_normal'
        ? 0.26 + Math.random() * 0.12
        : 0.42 + Math.random() * 0.22;
    ps.botDecisionTimer = interval;

    const nextLaneIdx = ps.laneIndex + 1;
    if (nextLaneIdx >= this.totalLanes) return;

    const nextLane = this.lanes[nextLaneIdx];
    const curLane = this.lanes[ps.laneIndex];

    // Evaluate danger of hopping forward
    let isForwardSafe = true;

    if (nextLane.type === 'ROAD' || nextLane.type === 'RAIL') {
      const hopDuration = 0.16;
      for (const ent of nextLane.entities) {
        const futureX = ent.x + ent.speed * hopDuration;
        const targetX = (ps.colIndex + 0.5) * this.colWidth;
        if (targetX >= futureX - 16 && targetX <= futureX + ent.width + 16) {
          isForwardSafe = false;
          break;
        }
      }
      if (nextLane.type === 'RAIL' && nextLane.trainActive) {
        isForwardSafe = false;
      }
    } else if (nextLane.type === 'RIVER') {
      const hopDuration = 0.16;
      let logFound = false;
      const targetX = (ps.colIndex + 0.5) * this.colWidth;
      for (const ent of nextLane.entities) {
        const futureX = ent.x + ent.speed * hopDuration;
        if (targetX >= futureX + 12 && targetX <= futureX + ent.width - 12) {
          logFound = true;
          break;
        }
      }
      isForwardSafe = logFound;
    }

    // Bot decision: Hop forward if safe, else evade or adjust column
    if (isForwardSafe) {
      if (difficulty === 'bot_easy' && Math.random() < 0.25) {
        return;
      }
      this.attemptHop(ps, 0, 1, width);
    } else {
      if (curLane && curLane.type === 'RIVER') {
        const curCol = ps.colIndex;
        if (curLane.speed > 0 && curCol > 2) {
          this.attemptHop(ps, -1, 0, width);
        } else if (curLane.speed < 0 && curCol < this.columnCount - 3) {
          this.attemptHop(ps, 1, 0, width);
        }
      } else if (Math.random() < 0.4) {
        const dCol = Math.random() < 0.5 ? -1 : 1;
        this.attemptHop(ps, dCol, 0, width);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Render Background
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    // 2. Render Lanes
    for (const lane of this.lanes) {
      this.renderLane(ctx, lane, width);
    }

    // 3. Render Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderHopperPlayer(ctx, ps, p.color);
    }

    // 4. Render Center HUD Pod
    this.renderCenterHudPod(ctx, width);
  }

  private renderLane(ctx: CanvasRenderingContext2D, lane: Lane, width: number): void {
    ctx.fillStyle = lane.color;
    ctx.fillRect(0, lane.y, width, lane.height);

    // Lane border line
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, lane.y + lane.height - 1, width, 1);

    if (lane.type === 'SAFE') {
      // Flower / Grass blades texture
      ctx.fillStyle = lane.index === this.totalLanes - 1 ? '#059669' : '#334155';
      for (let x = 12; x < width; x += 28) {
        ctx.fillRect(x, lane.y + 4, 3, 6);
        ctx.fillRect(x + 10, lane.y + lane.height - 10, 4, 5);
      }

      if (lane.index === this.totalLanes - 1) {
        // Goal Finish Pasture Banner
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.font = '900 13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★ GOLDEN PASTURE FINISH LINE ★', width / 2, lane.y + lane.height * 0.65);
      }
    } else if (lane.type === 'ROAD') {
      // Dashed lane divider
      ctx.fillStyle = '#FBBF24';
      for (let x = 10; x < width; x += 36) {
        ctx.fillRect(x, lane.y + lane.height / 2 - 1.5, 18, 3);
      }
    } else if (lane.type === 'RAIL') {
      // Wooden railroad ties and twin steel rails
      ctx.fillStyle = '#78350F';
      for (let x = 6; x < width; x += 16) {
        ctx.fillRect(x, lane.y + 2, 7, lane.height - 4);
      }
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(0, lane.y + 8, width, 3);
      ctx.fillRect(0, lane.y + lane.height - 11, width, 3);

      // Warning lights if train is coming
      if (lane.railWarning !== undefined && lane.railWarning < 1.6) {
        const flash = Math.floor(performance.now() / 150) % 2 === 0;
        ctx.fillStyle = flash ? '#EF4444' : '#7F1D1D';
        ctx.beginPath();
        ctx.arc(24, lane.y + lane.height / 2, 6, 0, Math.PI * 2);
        ctx.arc(width - 24, lane.y + lane.height / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (lane.type === 'RIVER') {
      // Water ripple highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      const waveOffset = (performance.now() * 0.04) % 40;
      for (let x = -20 + waveOffset; x < width; x += 40) {
        ctx.fillRect(x, lane.y + 6, 14, 2);
        ctx.fillRect(x + 20, lane.y + lane.height - 8, 12, 2);
      }
    }

    // Render Lane Entities (Cars, Trucks, Logs, Trains)
    for (const ent of lane.entities) {
      const ey = lane.y + (lane.height - ent.height) / 2;

      if (ent.type === 'car' || ent.type === 'truck') {
        // Vehicle Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(ent.x + 2, ey + ent.height, ent.width, 3);

        // Vehicle Chassis
        ctx.fillStyle = ent.color;
        ctx.beginPath();
        ctx.roundRect(ent.x, ey, ent.width, ent.height, 4);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#0F172A';
        ctx.stroke();

        // Windshield
        ctx.fillStyle = '#93C5FD';
        const windX = ent.speed > 0 ? ent.x + ent.width - 14 : ent.x + 4;
        ctx.fillRect(windX, ey + 3, 10, ent.height - 6);

        // Headlights
        ctx.fillStyle = '#FEF08A';
        const hX = ent.speed > 0 ? ent.x + ent.width - 2 : ent.x;
        ctx.fillRect(hX, ey + 2, 2, 4);
        ctx.fillRect(hX, ey + ent.height - 6, 2, 4);
      } else if (ent.type === 'train') {
        // Massive High-Speed Train
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(ent.x, ey + ent.height, ent.width, 4);

        ctx.fillStyle = ent.color;
        ctx.beginPath();
        ctx.roundRect(ent.x, ey, ent.width, ent.height, 6);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Train Windows
        ctx.fillStyle = '#FEF08A';
        for (let wx = ent.x + 16; wx < ent.x + ent.width - 20; wx += 26) {
          ctx.fillRect(wx, ey + 4, 16, ent.height - 8);
        }
      } else if (ent.type === 'log') {
        // River Log
        ctx.fillStyle = '#5B21B6'; // log bark outline
        ctx.fillStyle = ent.color;
        ctx.beginPath();
        ctx.roundRect(ent.x, ey, ent.width, ent.height, ent.height / 2);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#451A03';
        ctx.stroke();

        // Tree bark wood rings
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(ent.x + 14, ey + 4, 4, ent.height - 8);
        ctx.fillRect(ent.x + ent.width - 18, ey + 4, 4, ent.height - 8);
      } else if (ent.type === 'lilypad') {
        // Circular Lilypad
        ctx.fillStyle = ent.color;
        ctx.beginPath();
        ctx.arc(ent.x + ent.width / 2, ey + ent.height / 2, ent.width / 2, 0.2, Math.PI * 1.8);
        ctx.lineTo(ent.x + ent.width / 2, ey + ent.height / 2);
        ctx.fill();
        ctx.strokeStyle = '#15803D';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  private renderHopperPlayer(
    ctx: CanvasRenderingContext2D,
    ps: HopperPlayer,
    color: string
  ): void {
    if (!ps.alive) return;

    // Invulnerability Flashing
    if (ps.invulnTimer > 0 && Math.floor(performance.now() / 80) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(ps.x, ps.y);
    ctx.scale(ps.squishScaleX, ps.squishScaleY);

    // Player Shadow
    ctx.beginPath();
    ctx.ellipse(0, 8, 12, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Body (Round Hopper Chicken / Capsule)
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Eyes facing forward (upward)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-4, -5, 3.5, 0, Math.PI * 2);
    ctx.arc(4, -5, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-4, -6.5, 1.8, 0, Math.PI * 2);
    ctx.arc(4, -6.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Tiny golden beak
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(-3, -7);
    ctx.lineTo(3, -7);
    ctx.closePath();
    ctx.fill();

    // Lives counter / small hearts above player
    ctx.restore();
    this.renderPlayerHearts(ctx, ps.x, ps.y - 18, ps.lives, ps.maxLives);
  }

  private renderPlayerHearts(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    lives: number,
    maxLives: number
  ): void {
    const spacing = 9;
    const startX = x - ((maxLives - 1) * spacing) / 2;
    for (let i = 0; i < maxLives; i++) {
      const hx = startX + i * spacing;
      ctx.beginPath();
      ctx.arc(hx, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = i < lives ? '#EF4444' : '#475569';
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
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
    ctx.fillText(`MAP: ${this.currentMapName}`, podX + 16, podY + 17);

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

    let mvpHighlight = 'Highway Survivor!';
    if (this.finishOrder.length > 0) {
      mvpHighlight = `First to Cross: Player ${Number(this.finishOrder[0]) + 1}!`;
    } else if (winnerId !== null) {
      mvpHighlight = `Master Hopper Player ${Number(winnerId) + 1} navigated the perils!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
