import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type DrawbridgeThemeId = 'castle' | 'cyber' | 'magma';

interface DrawbridgeTheme {
  id: DrawbridgeThemeId;
  name: string;
  icon: string;
  groundColor: string;
  roadColor: string;
  moatWater: string;
  bridgeWood: string;
  bridgeOutline: string;
  accentGlow: string;
  splashColor: string;
}

const THEMES: Record<DrawbridgeThemeId, DrawbridgeTheme> = {
  castle: {
    id: 'castle',
    name: 'Castle Moat Gatehouse',
    icon: '🏰',
    groundColor: '#1E293B',
    roadColor: '#475569',
    moatWater: '#0284C7',
    bridgeWood: '#78350F',
    bridgeOutline: '#F59E0B',
    accentGlow: '#38BDF8',
    splashColor: '#BAE6FD'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Gate Matrix',
    icon: '⚡',
    groundColor: '#090D16',
    roadColor: '#1E1B4B',
    moatWater: '#06B6D4',
    bridgeWood: '#312E81',
    bridgeOutline: '#06B6D4',
    accentGlow: '#06B6D4',
    splashColor: '#67E8F9'
  },
  magma: {
    id: 'magma',
    name: 'Volcanic Caldera Moat',
    icon: '🔥',
    groundColor: '#1C1917',
    roadColor: '#292524',
    moatWater: '#DC2626',
    bridgeWood: '#451A03',
    bridgeOutline: '#EF4444',
    accentGlow: '#F97316',
    splashColor: '#FCA5A5'
  }
};

const THEME_ORDER: DrawbridgeThemeId[] = ['castle', 'cyber', 'magma'];

type EntityType = 'raider' | 'wagon' | 'keg_runner' | 'diamond_messenger';

interface MoatEntity {
  id: number;
  lane: number;
  type: EntityType;
  x: number;
  speed: number;
  isFallen: boolean;
  fallAnim: number;
  isScored: boolean;
  wiggle: number;
}

interface BridgePlayer {
  id: PlayerId;
  lane: number;
  bridgeY: number;
  isBridgeOpen: boolean; // True = raised/open gap; False = lowered/flat road
  bridgeAngle: number; // 0 (flat) to 1 (fully raised)
  chargeLever: number; // 0 to 1
  isCharging: boolean;
  score: number;
  raidersPlunged: number;
  wagonsSaved: number;
  breaches: number;
  combo: number;
  sabotageStun: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class DrawbridgePanicGame extends BaseGame {
  public playersState: Map<PlayerId, BridgePlayer> = new Map();
  public entities: MoatEntity[] = [];
  public currentTheme: DrawbridgeThemeId = 'castle';

  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private entityIdCounter: number = 0;
  private spawnTimer: number = 0.6;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private lastHeight: number = 600;
  private lastWidth: number = 800;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;

    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.cycleTheme();
        } else if (e.key === '1') {
          this.setTheme('castle');
        } else if (e.key === '2') {
          this.setTheme('cyber');
        } else if (e.key === '3') {
          this.setTheme('magma');
        }
      };
      window.addEventListener('keydown', this.keydownHandler);
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_ORDER.indexOf(this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_ORDER.length;
    this.setTheme(THEME_ORDER[nextIdx]);
  }

  public setTheme(theme: DrawbridgeThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentGlow, 16);
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
    this.lastHeight = height;

    const active = this.getActivePlayers();
    // Layout lanes across central vertical height (between y: 110 and y: height - 120)
    const availableHeight = height - 240;
    const laneHeight = availableHeight / active.length;

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        lane: idx,
        bridgeY: 130 + laneHeight * (idx + 0.5),
        isBridgeOpen: false,
        bridgeAngle: 0,
        chargeLever: 0,
        isCharging: false,
        score: 0,
        raidersPlunged: 0,
        wagonsSaved: 0,
        breaches: 0,
        combo: 0,
        sabotageStun: 0,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 2.0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.lastHeight = height;
    this.lastWidth = width;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    const isSuddenDeath = this.roundTimer <= 15.0;

    // Check underdog
    let maxScore = 0;
    let minScore = Infinity;
    this.playersState.forEach((ps) => {
      if (ps.score > maxScore) maxScore = ps.score;
      if (ps.score < minScore) minScore = ps.score;
    });
    this.playersState.forEach((ps) => {
      ps.isUnderdog = maxScore - ps.score >= 250 && maxScore > 0;
    });

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Spawn entities in each lane
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (isSuddenDeath ? 0.45 : 0.70) + Math.random() * 0.35;
      const active = this.getActivePlayers();

      active.forEach((p, laneIdx) => {
        const roll = Math.random();
        let type: EntityType = 'raider';
        let spd = isSuddenDeath ? 240 : 180;

        if (roll < 0.15) {
          type = 'diamond_messenger';
          spd = isSuddenDeath ? 330 : 260;
        } else if (roll < 0.35) {
          type = 'keg_runner';
          spd = isSuddenDeath ? 260 : 200;
        } else if (roll < 0.65) {
          type = 'wagon';
          spd = isSuddenDeath ? 180 : 130;
        }

        this.entities.push({
          id: this.entityIdCounter++,
          lane: laneIdx,
          type,
          x: -35,
          speed: spd,
          isFallen: false,
          fallAnim: 0,
          isScored: false,
          wiggle: Math.random() * Math.PI * 2
        });
      });
    }

    // Update player drawbridges & levers
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) ps.currentMood = 'idle';
      }

      if (ps.sabotageStun > 0) {
        ps.sabotageStun -= dt;
        continue;
      }

      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Hold Action: Crank hydraulic winch to raise drawbridge!
      ps.isBridgeOpen = isAction;
      if (isAction) {
        ps.bridgeAngle = Math.min(1.0, ps.bridgeAngle + dt * 6.5);
        ps.chargeLever = Math.min(1.0, ps.chargeLever + dt * 2.0);
      } else {
        ps.bridgeAngle = Math.max(0, ps.bridgeAngle - dt * 8.0);
        ps.chargeLever = Math.max(0, ps.chargeLever - dt * 4.0);
      }

      // Springboard Slam on rapid release!
      if (justReleased && ps.chargeLever >= 0.7) {
        this.audio.playExplosion();
        this.particles.shake(4);
        const bridgeGapX = width * 0.48;
        this.particles.spawnSparks(bridgeGapX + 42, ps.bridgeY, '#F59E0B', 14);
      }
    }

    // Moat gap coordinates
    const bridgeGapX = width * 0.48;
    const bridgeGapW = 85;

    // Move entities across bridges
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i];

      if (ent.isFallen) {
        ent.fallAnim += dt * 4;
        if (ent.fallAnim >= 1.0) {
          this.entities.splice(i, 1);
        }
        continue;
      }

      ent.x += ent.speed * dt;
      ent.wiggle += dt * 9;

      const player = Array.from(this.playersState.values()).find((p) => p.lane === ent.lane);
      if (!player) continue;

      const isOverGap = ent.x >= bridgeGapX && ent.x <= bridgeGapX + bridgeGapW;

      // Drawbridge open: entity plunges into moat!
      if (isOverGap && player.bridgeAngle > 0.5) {
        ent.isFallen = true;

        if (ent.type === 'raider' || ent.type === 'keg_runner') {
          // Plunged enemy!
          const pts = ent.type === 'keg_runner' ? 220 : 120;
          player.combo += 1;
          const comboMult = Math.min(4, 1 + Math.floor(player.combo / 3));
          player.score += pts * comboMult * (isSuddenDeath ? 2 : 1);
          player.raidersPlunged += 1;
          player.currentMood = 'happy';
          player.moodTimer = 1.5;

          if (ent.type === 'keg_runner') {
            this.audio.playExplosion();
            this.particles.shake(7);
            this.particles.spawnExplosion(ent.x, player.bridgeY, '#EF4444', 24);
          } else {
            this.audio.playScore();
            this.particles.shake(3);
            this.particles.spawnSparks(ent.x, player.bridgeY, THEMES[this.currentTheme].splashColor, 16);
          }

          // Trigger sabotage shockwave on high combo
          if (player.combo >= 4 && player.combo % 4 === 0) {
            this.triggerMoatSabotage(player.id);
          }
        } else {
          // Accidental plunge of friendly wagon or messenger! Penalty!
          player.combo = 0;
          const penalty = ent.type === 'diamond_messenger' ? 200 : 100;
          player.score = Math.max(0, player.score - penalty);
          player.currentMood = 'shocked';
          player.moodTimer = 2.0;

          this.audio.playBounce();
          this.particles.shake(5);
          this.particles.spawnExplosion(ent.x, player.bridgeY, '#EF4444', 18);
        }
      } else if (ent.x > width * 0.86 && !ent.isScored) {
        // Entity reached castle gate safely!
        ent.isScored = true;

        if (ent.type === 'wagon' || ent.type === 'diamond_messenger') {
          // Safe friendly passage!
          const pts = ent.type === 'diamond_messenger' ? 450 : 200;
          player.combo += 1;
          const comboMult = Math.min(4, 1 + Math.floor(player.combo / 3));
          player.score += pts * comboMult * (isSuddenDeath ? 2 : 1);
          player.wagonsSaved += 1;
          player.currentMood = 'triumph';
          player.moodTimer = 1.8;

          this.audio.playFanfare();
          this.particles.spawnSparks(ent.x, player.bridgeY, '#F59E0B', 18);
        } else {
          // Enemy breached castle gate!
          player.combo = 0;
          player.breaches += 1;
          const penalty = ent.type === 'keg_runner' ? 250 : 150;
          player.score = Math.max(0, player.score - penalty);
          player.currentMood = 'shocked';
          player.moodTimer = 2.0;

          this.audio.playExplosion();
          this.particles.shake(7);
          this.particles.spawnExplosion(ent.x, player.bridgeY, '#DC2626', 22);
        }
      }

      if (ent.x > width + 50) {
        this.entities.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private triggerMoatSabotage(leaderId: PlayerId): void {
    for (const p of this.getActivePlayers()) {
      if (p.id === leaderId) continue;
      const ps = this.playersState.get(p.id);
      if (ps) {
        ps.sabotageStun = 0.7;
        ps.currentMood = 'shocked';
        this.particles.spawnSparks(this.lastWidth * 0.48, ps.bridgeY, '#EF4444', 10);
      }
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
    if (!bot || bot.sabotageStun > 0) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.38 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    const bridgeGapX = width * 0.48;
    const approaching = this.entities.filter(
      (e) => e.lane === bot.lane && !e.isFallen && e.x >= bridgeGapX - 60 && e.x <= bridgeGapX + 85
    );

    let action = false;
    if (approaching.length > 0) {
      const ent = approaching[0];
      const isHostile = ent.type === 'raider' || ent.type === 'keg_runner';

      if (isHostile) {
        action = true; // Raise bridge to drop raider
      } else {
        action = false; // Lower bridge to save wagon
      }

      if (difficulty === 'bot_easy' && Math.random() < 0.20) {
        action = !action; // Occasional mistake
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
      ? `Player ${winnerId + 1} defended the gatehouse with ${topRaiders} invaders plunged!`
      : 'All drawbridges stood firm in equal defense!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastHeight = height;
    const theme = THEMES[this.currentTheme];

    // 1. Fortress Ground & Deep Moat Water
    ctx.fillStyle = theme.groundColor;
    ctx.fillRect(0, 0, width, height);

    const bridgeGapX = width * 0.48;
    const bridgeGapW = 85;

    // Water channel
    ctx.fillStyle = theme.moatWater;
    ctx.fillRect(bridgeGapX, 0, bridgeGapW, height);

    // Moat water foam ripple lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    for (let my = 15; my < height; my += 30) {
      ctx.beginPath();
      ctx.moveTo(bridgeGapX + 5, my);
      ctx.lineTo(bridgeGapX + bridgeGapW - 5, my);
      ctx.stroke();
    }

    // 2. Render Lanes & Drawbridges
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const isBot = cfg ? cfg.type !== 'human' : false;

      const roadY = ps.bridgeY;
      const roadH = 34;

      // Stone road approach on left and right banks
      ctx.fillStyle = theme.roadColor;
      ctx.fillRect(0, roadY - roadH / 2, bridgeGapX, roadH);
      ctx.fillRect(bridgeGapX + bridgeGapW, roadY - roadH / 2, width - (bridgeGapX + bridgeGapW), roadH);

      // Cobblestone trim
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, roadY - roadH / 2, bridgeGapX, roadH);
      ctx.strokeRect(bridgeGapX + bridgeGapW, roadY - roadH / 2, width - (bridgeGapX + bridgeGapW), roadH);

      // Drawbridge plank
      ctx.save();
      const raisedH = ps.bridgeAngle * 34;

      if (ps.bridgeAngle > 0.05) {
        // Raised drawbridge plank
        ctx.fillStyle = theme.bridgeWood;
        ctx.fillRect(bridgeGapX, roadY - roadH / 2 - raisedH, 18, roadH + raisedH);
        ctx.strokeStyle = theme.bridgeOutline;
        ctx.lineWidth = 2;
        ctx.strokeRect(bridgeGapX, roadY - roadH / 2 - raisedH, 18, roadH + raisedH);

        // Winch chains
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bridgeGapX + 9, roadY - roadH / 2 - raisedH);
        ctx.lineTo(bridgeGapX - 15, roadY - roadH / 2 - 25);
        ctx.stroke();
      } else {
        // Lowered drawbridge spanning the gap
        ctx.fillStyle = theme.bridgeWood;
        ctx.fillRect(bridgeGapX, roadY - roadH / 2, bridgeGapW, roadH);
        ctx.strokeStyle = theme.bridgeOutline;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bridgeGapX, roadY - roadH / 2, bridgeGapW, roadH);
      }

      // Gatekeeper Mascot at Lever (Right bank: bridgeGapX + bridgeGapW + 28)
      ctx.save();
      ctx.translate(bridgeGapX + bridgeGapW + 28, roadY);
      drawCharacter(
        ctx,
        0,
        0,
        14,
        ps.id,
        isBot,
        ps.currentMood,
        ps.bridgeAngle * 2,
        undefined
      );

      // Lever graphic
      ctx.strokeStyle = ps.isUnderdog ? '#F59E0B' : '#64748B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, 12);
      ctx.lineTo(-8 - ps.bridgeAngle * 10, -10 + ps.bridgeAngle * 4);
      ctx.stroke();

      // Combo or Underdog label
      if (ps.isUnderdog) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑 SURGE', 0, -22);
      } else if (ps.combo > 1) {
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 11px "Chakra Petch", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${ps.combo}x`, 0, -22);
      }

      ctx.restore();
      ctx.restore();
    }

    // 3. Render Entities (Raiders, Wagons, Kegs, Messengers)
    for (const ent of this.entities) {
      const player = Array.from(this.playersState.values()).find((p) => p.lane === ent.lane);
      if (!player) continue;

      ctx.save();
      ctx.translate(ent.x, player.bridgeY);

      if (ent.isFallen) {
        ctx.scale(1 - ent.fallAnim * 0.7, 1 - ent.fallAnim * 0.7);
        ctx.rotate(ent.fallAnim * 4);
      }

      const wiggleY = Math.sin(ent.wiggle) * 2;

      if (ent.type === 'wagon') {
        // Royal Gold Wagon
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-16, -10 + wiggleY, 32, 20);
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(0, wiggleY, 6, 0, Math.PI * 2);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.arc(-10, 10 + wiggleY, 4, 0, Math.PI * 2);
        ctx.arc(10, 10 + wiggleY, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.type === 'diamond_messenger') {
        // High-speed Diamond Messenger
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(0, wiggleY, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, wiggleY, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.type === 'keg_runner') {
        // Explosive Powder Keg
        ctx.fillStyle = '#991B1B';
        ctx.fillRect(-12, -10 + wiggleY, 24, 20);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-4, -14 + wiggleY, 8, 4); // Fuse
      } else {
        // Barbarian Raider
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, wiggleY, 11, 0, Math.PI * 2);
        ctx.fill();
        // Spiked club
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, wiggleY);
        ctx.lineTo(13, -7 + wiggleY);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 4. Safe UI & Theme Pill
    this.renderSafeUI(ctx, width, height);
  }

  private renderSafeUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Minigame Header Badge at y: 56 (PRESERVING GLOBAL TIMER AT y: 12-44!)
    const isSuddenDeath = this.roundTimer <= 15.0;
    const badgeW = 270;
    const badgeH = 28;
    const badgeX = (width - badgeW) * 0.5;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#0284C7';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? '🔥 CARAVAN RUSH! 2X SCORE & SPEED SURGE'
      : 'HOLD ACTION TO RAISE BRIDGE • DROP RAIDERS';
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Cards (Offset to y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      let cardX = 20;
      let cardY = height - 128;

      if (idx === 0) {
        cardX = 20;
        cardY = height - 128;
      } else if (idx === 1) {
        cardX = width - 150;
        cardY = height - 128;
      } else if (idx === 2) {
        cardX = 20;
        cardY = 92;
      } else {
        cardX = width - 150;
        cardY = 92;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mini Mascot Icon
      ctx.save();
      ctx.translate(cardX + 22, cardY + 24);
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        p.type !== 'human',
        ps?.currentMood || 'idle',
        0,
        undefined
      );
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`P${p.id + 1} (${p.type === 'human' ? 'YOU' : 'BOT'})`, cardX + 44, cardY + 8);

      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px "Chakra Petch", monospace';
      ctx.fillText(`${ps?.score || 0} pts`, cardX + 44, cardY + 26);
    });

    // 3. Theme Pill at bottom-left (x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;
    const theme = THEMES[this.currentTheme];

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accentGlow;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name.substring(0, 14)} [T]`, pillX + pillW * 0.5, pillY + pillH * 0.5);

    // 4. Control Hints
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Hold [Space/Action]: Raise Bridge | Release: Lower Plank', width - 20, height - 14);

    ctx.restore();
  }

  public handleClick(x: number, y: number): boolean {
    const pillX = 20;
    const pillY = (this.lastHeight || 600) - 44;
    const pillW = 170;
    const pillH = 32;

    if (x >= pillX && x <= pillX + pillW && y >= pillY && y <= pillY + pillH) {
      this.cycleTheme();
      return true;
    }
    return false;
  }

  public syncDebug(): Record<string, any> {
    return {
      theme: this.currentTheme,
      entitiesCount: this.entities.length,
      roundTimer: this.roundTimer,
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        lane: p.lane,
        score: p.score,
        combo: p.combo,
        raidersPlunged: p.raidersPlunged,
        wagonsSaved: p.wagonsSaved,
        isUnderdog: p.isUnderdog,
        bridgeAngle: Math.round(p.bridgeAngle * 100)
      }))
    };
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    this.entities = [];
    this.playersState.clear();
  }
}
