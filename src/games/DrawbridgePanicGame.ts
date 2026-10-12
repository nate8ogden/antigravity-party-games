import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MoatEntity {
  id: number;
  lane: number;
  type: 'raider' | 'wagon';
  x: number;
  speed: number;
  isFallen: boolean;
  isScored: boolean;
}

interface BridgePlayer {
  id: PlayerId;
  lane: number;
  bridgeY: number;
  isBridgeOpen: boolean; // True = open/raised (gap in road); False = closed (flat road)
  score: number;
  raidersPlunged: number;
  wagonsSaved: number;
  breaches: number;
}

export class DrawbridgePanicGame extends BaseGame {
  public playersState: Map<PlayerId, BridgePlayer> = new Map();
  public entities: MoatEntity[] = [];
  public currentMapName: string = 'Castle Moat Gatehouse';

  private entityIdCounter: number = 0;
  private spawnTimer: number = 0.6;
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
    this.entities = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.spawnTimer = 0.5;

    const active = this.getActivePlayers();
    const laneHeight = height / (active.length + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        lane: idx,
        bridgeY: laneHeight * (idx + 1),
        isBridgeOpen: false, // Closed by default
        score: 0,
        raidersPlunged: 0,
        wagonsSaved: 0,
        breaches: 0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.25);
    });
  }

  public update(dt: number, width: number, _height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, _height);

    // Spawn entities in each player's lane
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.75 + Math.random() * 0.45;
      const active = this.getActivePlayers();

      active.forEach((p, laneIdx) => {
        const isRaider = Math.random() < 0.6;
        this.entities.push({
          id: this.entityIdCounter++,
          lane: laneIdx,
          type: isRaider ? 'raider' : 'wagon',
          x: -30, // Starts on outer left bank
          speed: isRaider ? 180 : 130,
          isFallen: false,
          isScored: false
        });
      });
    }

    // Update player drawbridge levers
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Toggle bridge on action press
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      ps.isBridgeOpen = isAction; // Hold action to open the gap / raise drawbridge!
    }

    // Moat gap coordinates along the road
    const bridgeGapX = width * 0.48;
    const bridgeGapW = 85;

    // Move entities across bridge
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i];
      if (ent.isFallen) continue;

      ent.x += ent.speed * dt;
      const player = Array.from(this.playersState.values()).find((p) => p.lane === ent.lane);
      if (!player) continue;

      // Check if entity is over the drawbridge gap
      const isOverGap = ent.x >= bridgeGapX && ent.x <= bridgeGapX + bridgeGapW;

      if (isOverGap && player.isBridgeOpen) {
        // Drawbridge is OPEN: Entity plunges into the moat water!
        ent.isFallen = true;

        if (ent.type === 'raider') {
          // Plunged enemy raider! Great job!
          player.score += 100;
          player.raidersPlunged += 1;
          this.audio.playScore();
          this.particles.shake(3);
          this.particles.spawnSparks(ent.x, player.bridgeY, '#0284C7', 14);
        } else {
          // Plunged friendly gold wagon! Penalty!
          player.score = Math.max(0, player.score - 100);
          this.audio.playExplosion();
          this.particles.shake(5);
          this.particles.spawnExplosion(ent.x, player.bridgeY, '#EF4444', 16);
        }
      } else if (ent.x > width * 0.85 && !ent.isScored) {
        // Entity reached castle gate safely
        ent.isScored = true;

        if (ent.type === 'wagon') {
          // Friendly wagon saved!
          player.score += 200;
          player.wagonsSaved += 1;
          this.audio.playFanfare();
          this.particles.spawnSparks(ent.x, player.bridgeY, '#F59E0B', 16);
        } else {
          // Raider breached gate! Penalty!
          player.breaches += 1;
          player.score = Math.max(0, player.score - 150);
          this.audio.playExplosion();
          this.particles.shake(6);
          this.particles.spawnExplosion(ent.x, player.bridgeY, '#EF4444', 20);
        }
      }

      // Despawn off right screen
      if (ent.x > width + 50 || ent.isFallen) {
        this.entities.splice(i, 1);
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
    width: number,
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

    const bridgeGapX = width * 0.48;
    // Find entities in bot's lane approaching the gap
    const approaching = this.entities.filter(
      (e) => e.lane === bot.lane && e.x >= bridgeGapX - 50 && e.x <= bridgeGapX + 85
    );

    let action = false;
    if (approaching.length > 0) {
      const ent = approaching[0];
      if (ent.type === 'raider') {
        action = true; // Open bridge to drop raider!
      } else {
        action = false; // Keep bridge closed for wagon!
      }

      if (difficulty === 'bot_easy' && Math.random() < 0.25) {
        action = !action; // Occasional mistake on easy
      }
    }

    this.input.setBotInput(botId, action, 0, 0, action);
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
        raiders: ps?.raidersPlunged || 0,
        wagons: ps?.wagonsSaved || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topRaiders = scores[0]?.raiders || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} plunged ${topRaiders} invaders into the castle moat!`
      : 'Draw! All drawbridges held firm!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Castle Moat Water & Outer Banks
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, width, height);

    // Deep blue water in center moat
    const bridgeGapX = width * 0.48;
    const bridgeGapW = 85;
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(bridgeGapX, 0, bridgeGapW, height);

    // 2. Render Lanes & Drawbridges
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      const roadY = ps.bridgeY;
      const roadH = 34;

      // Stone road approach
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, roadY - roadH / 2, bridgeGapX, roadH);
      ctx.fillRect(bridgeGapX + bridgeGapW, roadY - roadH / 2, width - (bridgeGapX + bridgeGapW), roadH);

      // Drawbridge plank
      ctx.save();
      if (ps.isBridgeOpen) {
        // Raised drawbridge: plank pulled up vertically
        ctx.fillStyle = '#78350F';
        ctx.fillRect(bridgeGapX, roadY - roadH / 2 - 28, 16, roadH + 28);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.strokeRect(bridgeGapX, roadY - roadH / 2 - 28, 16, roadH + 28);
      } else {
        // Lowered drawbridge: wooden road spanning the gap
        ctx.fillStyle = '#92400E';
        ctx.fillRect(bridgeGapX, roadY - roadH / 2, bridgeGapW, roadH);
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 2;
        ctx.strokeRect(bridgeGapX, roadY - roadH / 2, bridgeGapW, roadH);
      }

      // Player lever icon & badge
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bridgeGapX + bridgeGapW + 24, roadY, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${ps.id + 1}`, bridgeGapX + bridgeGapW + 24, roadY + 4);
      ctx.restore();
    }

    // 3. Render Entities (Raiders & Wagons)
    for (const ent of this.entities) {
      const player = Array.from(this.playersState.values()).find((p) => p.lane === ent.lane);
      if (!player) continue;

      ctx.save();
      ctx.translate(ent.x, player.bridgeY);

      if (ent.type === 'wagon') {
        // Royal Gold Wagon
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-16, -10, 32, 20);
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Dark Raider
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        // Weapon
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(14, -6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Draw HUD
    this.renderHUD(ctx, width);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    // Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#0284C7';
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
