import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type DragonThemeId = 'hatchery' | 'volcano' | 'celestial';

interface DragonTheme {
  id: DragonThemeId;
  name: string;
  icon: string;
  floorColor: string;
  gridColor: string;
  penBorder: string;
  penFill: string;
  accentGlow: string;
  sparkColor: string;
}

const THEMES: Record<DragonThemeId, DragonTheme> = {
  hatchery: {
    id: 'hatchery',
    name: 'Castle Courtyard Hatchery',
    icon: '🏰',
    floorColor: '#334155',
    gridColor: 'rgba(255, 255, 255, 0.07)',
    penBorder: '#E2E8F0',
    penFill: 'rgba(15, 23, 42, 0.65)',
    accentGlow: '#F59E0B',
    sparkColor: '#FDE047'
  },
  volcano: {
    id: 'volcano',
    name: 'Obsidian Magma Nest',
    icon: '🔥',
    floorColor: '#1C1917',
    gridColor: 'rgba(239, 68, 68, 0.12)',
    penBorder: '#EF4444',
    penFill: 'rgba(69, 10, 10, 0.65)',
    accentGlow: '#F97316',
    sparkColor: '#EF4444'
  },
  celestial: {
    id: 'celestial',
    name: 'Starfall Dragon Sanctuary',
    icon: '🌌',
    floorColor: '#0B0F24',
    gridColor: 'rgba(139, 92, 246, 0.12)',
    penBorder: '#8B5CF6',
    penFill: 'rgba(30, 27, 75, 0.65)',
    accentGlow: '#38BDF8',
    sparkColor: '#A78BFA'
  }
};

const THEME_ORDER: DragonThemeId[] = ['hatchery', 'volcano', 'celestial'];

type DragonType = 'standard' | 'golden' | 'pyro';

interface BabyDragon {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: DragonType;
  tamedById: PlayerId | null;
  tameTimer: number;
  isPenned: boolean;
  wiggleAnim: number;
  wanderAngle: number;
}

interface TamerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  penX: number;
  penY: number;
  score: number;
  dragonsPenned: number;
  hornCharge: number; // 0 to 1
  isCharging: boolean;
  hornCooldown: number;
  shockwaveRadius: number;
  shockwaveTimer: number;
  stunTimer: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class DragonTamerGame extends BaseGame {
  public playersState: Map<PlayerId, TamerPlayer> = new Map();
  public dragons: BabyDragon[] = [];
  public currentTheme: DragonThemeId = 'hatchery';

  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private lastHeight: number = 600;
  private keydownHandler?: (e: KeyboardEvent) => void;
  private suddenDeathSpawned: boolean = false;

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
          this.setTheme('hatchery');
        } else if (e.key === '2') {
          this.setTheme('volcano');
        } else if (e.key === '3') {
          this.setTheme('celestial');
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

  public setTheme(theme: DragonThemeId): void {
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
    this.dragons = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.suddenDeathSpawned = false;
    this.lastHeight = height;

    const active = this.getActivePlayers();

    // 4 Corner Pens for up to 4 players
    const penCorners = [
      { x: 80, y: 100 },
      { x: width - 80, y: 100 },
      { x: 80, y: height - 90 },
      { x: width - 80, y: height - 90 }
    ];

    active.forEach((p, idx) => {
      const pen = penCorners[idx % penCorners.length];
      this.playersState.set(p.id, {
        id: p.id,
        x: pen.x + (idx % 2 === 0 ? 55 : -55),
        y: pen.y + (idx < 2 ? 55 : -55),
        vx: 0,
        vy: 0,
        angle: 0,
        penX: pen.x,
        penY: pen.y,
        score: 0,
        dragonsPenned: 0,
        hornCharge: 0,
        isCharging: false,
        hornCooldown: 0,
        shockwaveRadius: 0,
        shockwaveTimer: 0,
        stunTimer: 0,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 2.0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.2);
    });

    // Spawn 15 baby dragons in center arena
    this.spawnDragons(width, height, 15);
  }

  private spawnDragons(width: number, height: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let type: DragonType = 'standard';
      let col = '#10B981';
      let rad = 13;

      if (rand < 0.2) {
        type = 'golden';
        col = '#F59E0B';
        rad = 15;
      } else if (rand < 0.45) {
        type = 'pyro';
        col = '#EF4444';
        rad = 14;
      } else {
        col = i % 2 === 0 ? '#10B981' : '#06B6D4';
      }

      this.dragons.push({
        id: this.dragons.length + i,
        x: width * 0.5 + (Math.random() - 0.5) * (width * 0.45),
        y: height * 0.5 + (Math.random() - 0.5) * (height * 0.4),
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50,
        radius: rad,
        color: col,
        type,
        tamedById: null,
        tameTimer: 0,
        isPenned: false,
        wiggleAnim: Math.random() * Math.PI * 2,
        wanderAngle: Math.random() * Math.PI * 2
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.lastHeight = height;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Sudden death spawn
    if (this.roundTimer <= 15.0 && !this.suddenDeathSpawned) {
      this.suddenDeathSpawned = true;
      this.spawnDragons(width, height, 5); // 5 bonus dragons
      this.audio.playFanfare();
      this.particles.shake(6);
    }

    // Underdog check
    let maxScore = 0;
    let minScore = Infinity;
    this.playersState.forEach((ps) => {
      if (ps.score > maxScore) maxScore = ps.score;
      if (ps.score < minScore) minScore = ps.score;
    });
    this.playersState.forEach((ps) => {
      ps.isUnderdog = maxScore - ps.score >= 250 && maxScore > 0;
    });

    // Update bots
    this.updateBots(dt, width, height);

    // Update players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.hornCooldown > 0) ps.hornCooldown -= dt;
      if (ps.shockwaveTimer > 0) {
        ps.shockwaveTimer -= dt;
        ps.shockwaveRadius += dt * 500;
      }
      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) ps.currentMood = 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justActionReleased = this.input.justReleased(p.id);

      if (steer !== 0 || throttle !== 0) {
        ps.angle = Math.atan2(-throttle, steer);
      }

      // Movement
      const baseSpeed = ps.isUnderdog ? 290 : 250;
      const speed = ps.isCharging ? baseSpeed * 0.65 : baseSpeed;
      ps.vx = steer * speed;
      ps.vy = -throttle * speed;
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Arena clamp
      ps.x = Math.max(45, Math.min(width - 45, ps.x));
      ps.y = Math.max(70, Math.min(height - 55, ps.y));

      // Hold-to-Charge Horn
      if (isAction && ps.hornCooldown <= 0) {
        ps.isCharging = true;
        ps.hornCharge = Math.min(1.0, ps.hornCharge + dt * 1.6);
        if (Math.random() < 0.25) {
          this.particles.spawnSparks(ps.x, ps.y, THEMES[this.currentTheme].accentGlow, 1);
        }
      } else if (ps.isCharging || justActionReleased) {
        // Unleash Horn Blast!
        const chargePower = ps.hornCharge;
        ps.isCharging = false;
        ps.hornCharge = 0;
        ps.hornCooldown = 0.65;
        ps.shockwaveTimer = 0.35;
        ps.shockwaveRadius = 20;

        const maxLureRadius = 140 + chargePower * 180; // Up to 320px
        const isMegaRoar = chargePower >= 0.8;

        if (isMegaRoar) {
          this.audio.playExplosion();
          this.particles.shake(7);
          this.particles.spawnSparks(ps.x, ps.y, '#F59E0B', 20);
        } else {
          this.audio.playLaser();
          this.particles.spawnSparks(ps.x, ps.y, '#38BDF8', 10);
        }

        // Lure dragons & stun nearby rivals on mega roar
        for (const d of this.dragons) {
          if (d.isPenned) continue;
          const dist = Math.hypot(d.x - ps.x, d.y - ps.y);
          if (dist < maxLureRadius) {
            d.tamedById = ps.id;
            d.tameTimer = isMegaRoar ? 5.5 : 3.8;
            this.particles.spawnSparks(d.x, d.y, '#EC4899', 4);
          }
        }

        // Stun rivals with Mega Roar shockwave
        if (isMegaRoar) {
          for (const otherP of active) {
            if (otherP.id === ps.id) continue;
            const otherState = this.playersState.get(otherP.id);
            if (!otherState) continue;
            const dist = Math.hypot(otherState.x - ps.x, otherState.y - ps.y);
            if (dist < 130) {
              otherState.stunTimer = 0.8;
              otherState.currentMood = 'shocked';
              this.particles.spawnSparks(otherState.x, otherState.y, '#EF4444', 12);
            }
          }
        }
      }
    }

    // Inter-player bumping / tackle collisions
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = this.playersState.get(active[i].id);
        const p2 = this.playersState.get(active[j].id);
        if (!p1 || !p2) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 36 && dist > 0) {
          // Bump collision!
          const nx = dx / dist;
          const ny = dy / dist;
          p1.x -= nx * 10;
          p1.y -= ny * 10;
          p2.x += nx * 10;
          p2.y += ny * 10;

          this.audio.playBounce();
          this.particles.spawnSparks((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#F59E0B', 8);

          // Scatter tamed dragons on tackle!
          for (const d of this.dragons) {
            if (d.tamedById === p1.id || d.tamedById === p2.id) {
              if (Math.random() < 0.6) {
                d.tamedById = null;
                d.tameTimer = 0;
                d.vx += (Math.random() - 0.5) * 160;
                d.vy += (Math.random() - 0.5) * 160;
              }
            }
          }
        }
      }
    }

    // Update dragons
    for (const d of this.dragons) {
      if (d.isPenned) continue;

      d.wiggleAnim += dt * 9;

      if (d.tameTimer > 0 && d.tamedById !== null) {
        d.tameTimer -= dt;
        const leader = this.playersState.get(d.tamedById);
        if (leader) {
          // Follow tamer toward pen
          const targetX = leader.x;
          const targetY = leader.y;
          const dx = targetX - d.x;
          const dy = targetY - d.y;
          const dist = Math.hypot(dx, dy);

          const pullSpd = leader.isUnderdog ? 250 : 200;
          if (dist > 30) {
            d.vx += (dx / dist) * pullSpd * dt;
            d.vy += (dy / dist) * pullSpd * dt;
          }

          // Check penning
          const distToPen = Math.hypot(d.x - leader.penX, d.y - leader.penY);
          if (distToPen < 55) {
            d.isPenned = true;
            d.vx = 0;
            d.vy = 0;
            const pts = d.type === 'golden' ? 300 : d.type === 'pyro' ? 200 : 100;
            const finalPts = this.roundTimer <= 15.0 ? Math.round(pts * 1.5) : pts;
            leader.score += finalPts;
            leader.dragonsPenned += 1;
            leader.currentMood = 'happy';
            leader.moodTimer = 1.5;

            this.audio.playScore();
            this.particles.shake(4);
            this.particles.spawnExplosion(d.x, d.y, d.color, 18);
          }
        }
      } else {
        d.tamedById = null;
        // Wander
        d.wanderAngle += (Math.random() - 0.5) * 4 * dt;
        d.vx += Math.cos(d.wanderAngle) * 50 * dt;
        d.vy += Math.sin(d.wanderAngle) * 50 * dt;
      }

      // Drag
      d.vx *= Math.pow(0.95, dt * 60);
      d.vy *= Math.pow(0.95, dt * 60);

      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // Arena boundary bounce
      if (d.x < 35) { d.x = 35; d.vx = Math.abs(d.vx); }
      else if (d.x > width - 35) { d.x = width - 35; d.vx = -Math.abs(d.vx); }
      if (d.y < 65) { d.y = 65; d.vy = Math.abs(d.vy); }
      else if (d.y > height - 50) { d.y = height - 50; d.vy = -Math.abs(d.vy); }
    }

    // Check round over
    const allPenned = this.dragons.every((d) => d.isPenned);
    if (this.roundTimer <= 0 || (this.dragons.length > 0 && allPenned)) {
      this.isFinished = true;
      this.audio.playFanfare();
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
    if (!bot || bot.stunTimer > 0) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.40 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    const unpenned = this.dragons.filter((d) => !d.isPenned);
    if (unpenned.length === 0) return;

    const following = this.dragons.filter((d) => d.tamedById === botId && !d.isPenned);

    let targetX = bot.penX;
    let targetY = bot.penY;
    let action = false;

    if (following.length >= 2 || (following.length >= 1 && difficulty === 'bot_easy')) {
      // Guide back to pen
      targetX = bot.penX;
      targetY = bot.penY;
    } else {
      // Seek closest unpenned or golden dragon
      unpenned.sort((a, b) => {
        if (difficulty === 'bot_hard') {
          // Hard prioritizes golden dragons
          if (a.type === 'golden' && b.type !== 'golden') return -1;
          if (b.type === 'golden' && a.type !== 'golden') return 1;
        }
        return Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y);
      });

      const target = unpenned[0];
      targetX = target.x;
      targetY = target.y;

      const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
      if (dist < 160 && bot.hornCooldown <= 0) {
        action = true; // Blow horn
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
      ? `Player ${winnerId + 1} mastered the hatchery with ${topDragons} baby dragons penned!`
      : 'All wild dragons scattered into the realm!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastHeight = height;
    const theme = THEMES[this.currentTheme];

    // 1. Courtyard Floor & Flagstone Grid
    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = theme.gridColor;
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
      ctx.fillStyle = theme.penFill;
      ctx.beginPath();
      ctx.arc(ps.penX, ps.penY, 52, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${ps.id + 1} PEN`, ps.penX, ps.penY - 56);
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
      ctx.beginPath();
      ctx.ellipse(-10, -7 + wingOffset, 6, 9, -0.4, 0, Math.PI * 2);
      ctx.ellipse(10, -7 - wingOffset, 6, 9, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Golden sparkle
      if (d.type === 'golden') {
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, d.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

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

      // Tamed Heart
      if (d.tamedById !== null) {
        ctx.fillStyle = '#EC4899';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♥', 0, -d.radius - 4);
      }
      ctx.restore();
    }

    // 4. Render Tamers
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const isBot = cfg ? cfg.type !== 'human' : false;

      ctx.save();

      // Acoustic Shockwave
      if (ps.shockwaveTimer > 0) {
        ctx.strokeStyle = ps.isUnderdog ? '#F59E0B' : theme.accentGlow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ps.x, ps.y, ps.shockwaveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.translate(ps.x, ps.y);

      // Character Mascot
      drawCharacter(
        ctx,
        0,
        0,
        15,
        ps.id,
        isBot,
        ps.currentMood,
        ps.hornCharge * 3,
        undefined
      );

      // Acoustic Charge Ring
      if (ps.hornCharge > 0) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2 + ps.hornCharge * 2;
        ctx.beginPath();
        ctx.arc(0, 0, 18 + ps.hornCharge * 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Horn graphic
      ctx.rotate(ps.angle);
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(24, -8);
      ctx.lineTo(24, 8);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();

      // Underdog badge
      if (ps.isUnderdog) {
        ctx.rotate(-ps.angle);
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑 SURGE', 0, -28);
      }

      ctx.restore();
    }

    // 5. Safe UI Layout & Theme Pill
    this.renderSafeUI(ctx, width, height);
  }

  private renderSafeUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Minigame Header Badge at y: 56 (SAFE ZONE: y: 12-44 PRESERVED!)
    const isSuddenDeath = this.roundTimer <= 15.0;
    const badgeW = 270;
    const badgeH = 28;
    const badgeX = (width - badgeW) * 0.5;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#10B981';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? '🔥 SUDDEN DEATH! 1.5X SCORE & GOLDEN WYRMS'
      : 'HOLD HORN TO CHARGE ROAR • HERD TO PEN';
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
    ctx.fillText('Hold [Space/Action]: Charge Roar | [WASD/Stick]: Herd & Tackle', width - 20, height - 14);

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
      dragonsTotal: this.dragons.length,
      dragonsPenned: this.dragons.filter((d) => d.isPenned).length,
      roundTimer: this.roundTimer,
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        score: p.score,
        dragonsPenned: p.dragonsPenned,
        isUnderdog: p.isUnderdog,
        hornCharge: Math.round(p.hornCharge * 100)
      }))
    };
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    this.dragons = [];
    this.playersState.clear();
  }
}
