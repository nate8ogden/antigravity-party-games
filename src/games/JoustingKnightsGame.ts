import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type JoustThemeId = 'royal' | 'cyber' | 'caldera';

interface JoustTheme {
  id: JoustThemeId;
  name: string;
  icon: string;
  dirtColor: string;
  grassColor: string;
  railWood: string;
  railHighlight: string;
  bannerColor1: string;
  bannerColor2: string;
  accentGlow: string;
  dustColor: string;
}

const THEMES: Record<JoustThemeId, JoustTheme> = {
  royal: {
    id: 'royal',
    name: 'Royal Tournament Tiltyard',
    icon: '🏰',
    dirtColor: '#78350F',
    grassColor: '#15803D',
    railWood: '#451A03',
    railHighlight: '#FDE047',
    bannerColor1: '#DC2626',
    bannerColor2: '#2563EB',
    accentGlow: '#F59E0B',
    dustColor: '#D97706'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Neon Tilt',
    icon: '⚡',
    dirtColor: '#090D16',
    grassColor: '#0F172A',
    railWood: '#1E293B',
    railHighlight: '#06B6D4',
    bannerColor1: '#8B5CF6',
    bannerColor2: '#06B6D4',
    accentGlow: '#38BDF8',
    dustColor: '#06B6D4'
  },
  caldera: {
    id: 'caldera',
    name: 'Dragon Caldera',
    icon: '🐉',
    dirtColor: '#261E1E',
    grassColor: '#450A0A',
    railWood: '#1C1515',
    railHighlight: '#EF4444',
    bannerColor1: '#DC2626',
    bannerColor2: '#F97316',
    accentGlow: '#EA580C',
    dustColor: '#F97316'
  }
};

const THEME_ORDER: JoustThemeId[] = ['royal', 'cyber', 'caldera'];

interface JoustPlayer {
  id: PlayerId;
  team: 'LEFT' | 'RIGHT';
  lane: number; // 0 = upper rail, 1 = lower rail (or 0 for single central rail)
  x: number;
  y: number;
  speed: number;
  laneOffset: number;
  lanceElevation: number; // -1: Low, 0: Mid, 1: High
  lanceCharge: number; // 0 to 1
  isCharging: boolean;
  score: number;
  unhorses: number;
  lanceBreaks: number;
  isUnhorsed: boolean;
  unhorseAnim: number;
  unhorseVx: number;
  unhorseVy: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
  gallopPhase: number;
}

interface WoodSplinter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  color: string;
  life: number;
}

export class JoustingKnightsGame extends BaseGame {
  public playersState: Map<PlayerId, JoustPlayer> = new Map();
  public currentTheme: JoustThemeId = 'royal';
  public splinters: WoodSplinter[] = [];

  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private passNumber: number = 1;
  private maxPasses: number = 4;
  private passResetTimer: number = 0;
  private rails: number[] = [300];
  private lastHeight: number = 600;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private hitFreezeTimer: number = 0;
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
          this.setTheme('royal');
        } else if (e.key === '2') {
          this.setTheme('cyber');
        } else if (e.key === '3') {
          this.setTheme('caldera');
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

  public setTheme(theme: JoustThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentGlow, 18);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.passNumber = 1;
    this.passResetTimer = 0;
    this.hitFreezeTimer = 0;
    this.splinters = [];
    this.playersState.clear();
    this.botReactionTimers.clear();

    const activeCount = this.getActivePlayers().length;
    if (activeCount <= 2) {
      this.rails = [height * 0.52];
    } else {
      this.rails = [height * 0.36, height * 0.68];
    }

    this.setupPass(width);
  }

  private setupPass(width: number): void {
    const active = this.getActivePlayers();
    const isDualLane = this.rails.length > 1;

    // Check underdog
    let maxScore = 0;
    let minScore = Infinity;
    active.forEach((p) => {
      const s = this.playersState.get(p.id)?.score || 0;
      if (s > maxScore) maxScore = s;
      if (s < minScore) minScore = s;
    });

    active.forEach((p, idx) => {
      let lane = 0;
      let team: 'LEFT' | 'RIGHT' = 'LEFT';

      if (!isDualLane) {
        team = idx === 0 ? 'LEFT' : 'RIGHT';
        lane = 0;
      } else {
        // Dual rail assignment with pass rotation
        if (this.passNumber % 2 === 1) {
          lane = idx < 2 ? 0 : 1;
          team = (idx % 2 === 0) ? 'LEFT' : 'RIGHT';
        } else {
          // Cross-over matchup
          if (idx === 0) { lane = 0; team = 'LEFT'; }
          else if (idx === 3) { lane = 0; team = 'RIGHT'; }
          else if (idx === 1) { lane = 1; team = 'LEFT'; }
          else { lane = 1; team = 'RIGHT'; }
        }
      }

      const railY = this.rails[lane] || (this.rails[0] || 300);
      const startX = team === 'LEFT' ? width * 0.08 : width * 0.92;
      const initialY = team === 'LEFT' ? railY - 48 : railY + 48;

      const prevScore = this.playersState.get(p.id)?.score || 0;
      const prevUnhorses = this.playersState.get(p.id)?.unhorses || 0;
      const prevBreaks = this.playersState.get(p.id)?.lanceBreaks || 0;
      const isUnderdog = maxScore - prevScore >= 200 && maxScore > 0;

      this.playersState.set(p.id, {
        id: p.id,
        team,
        lane,
        x: startX,
        y: initialY,
        speed: isUnderdog ? 440 : 380,
        laneOffset: 0,
        lanceElevation: 0,
        lanceCharge: 0,
        isCharging: false,
        score: prevScore,
        unhorses: prevUnhorses,
        lanceBreaks: prevBreaks,
        isUnhorsed: false,
        unhorseAnim: 0,
        unhorseVx: 0,
        unhorseVy: 0,
        isUnderdog,
        currentMood: 'focused',
        moodTimer: 2.0,
        gallopPhase: Math.random() * Math.PI * 2
      });

      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.2);
    });

    this.audio.playWhoosh();
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    // Hit-stop freeze frame for impact crunch
    if (this.hitFreezeTimer > 0) {
      this.hitFreezeTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update splinter physics
    for (let i = this.splinters.length - 1; i >= 0; i--) {
      const s = this.splinters[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 800 * dt; // gravity
      s.rot += s.vRot * dt;
      s.life -= dt * 1.5;
      if (s.life <= 0) {
        this.splinters.splice(i, 1);
      }
    }

    // Between-pass reset timer
    if (this.passResetTimer > 0) {
      this.passResetTimer -= dt;
      if (this.passResetTimer <= 0) {
        if (this.passNumber >= this.maxPasses || this.roundTimer <= 0) {
          this.isFinished = true;
          this.audio.playFanfare();
          return;
        }
        this.passNumber++;
        this.setupPass(width);
      }
      return;
    }

    // Sudden death threshold
    const isSuddenDeath = this.roundTimer <= 15.0;

    // Update bots
    this.updateBots(dt, width, height);

    // Update each knight
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Mood timer decay
      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) {
          ps.currentMood = ps.isUnhorsed ? 'shocked' : 'focused';
        }
      }

      if (ps.isUnhorsed) {
        ps.unhorseAnim += dt * 5;
        ps.x += ps.unhorseVx * dt;
        ps.y += ps.unhorseVy * dt;
        ps.unhorseVy += 600 * dt; // Gravity tumble
        continue;
      }

      // Gallop animation cycle
      ps.gallopPhase += dt * (isSuddenDeath ? 18 : 14);

      const throttle = this.input.getThrottle(p.id);
      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Micro lane steering
      const inputY = throttle !== 0 ? -throttle : steer !== 0 ? steer : 0;
      if (inputY !== 0) {
        ps.laneOffset += inputY * 130 * dt;
        ps.laneOffset = Math.max(-28, Math.min(28, ps.laneOffset));
      } else {
        ps.laneOffset *= 0.94; // Re-center
      }

      // Lance elevation: -1 = low, 0 = mid, 1 = high
      if (inputY < -0.3) {
        ps.lanceElevation = 1; // Aim high
      } else if (inputY > 0.3) {
        ps.lanceElevation = -1; // Aim low
      } else {
        ps.lanceElevation = 0; // Aim center
      }

      // Hold-to-Charge Kinetic Couched Strike
      ps.isCharging = isAction;
      if (isAction) {
        ps.lanceCharge = Math.min(1.0, ps.lanceCharge + dt * 1.8);
        // Spawn charge sparkles
        if (Math.random() < 0.35) {
          const theme = THEMES[this.currentTheme];
          const lanceX = ps.x + (ps.team === 'LEFT' ? 45 : -45);
          this.particles.spawnSparks(lanceX, ps.y - 12, ps.isUnderdog ? '#F59E0B' : theme.accentGlow, 1);
        }
      } else {
        ps.lanceCharge = Math.max(0, ps.lanceCharge - dt * 2.5);
      }

      // Gallop forward
      const dir = ps.team === 'LEFT' ? 1 : -1;
      const speedMult = isSuddenDeath ? 1.35 : 1.0;
      ps.x += dir * ps.speed * speedMult * dt;

      const railY = this.rails[ps.lane] || (this.rails[0] || 300);
      ps.y = (ps.team === 'LEFT' ? railY - 48 : railY + 48) + ps.laneOffset;

      // Gallop dust puff
      if (Math.random() < 0.2) {
        this.particles.spawnSparks(
          ps.x - dir * 18,
          ps.y + 12,
          THEMES[this.currentTheme].dustColor,
          2
        );
      }
    }

    // Check clash along rails
    this.checkClashes(width);

    // Check pass completion
    const allPassed = Array.from(this.playersState.values()).every(
      (p) => (p.team === 'LEFT' && p.x > width * 0.94) || (p.team === 'RIGHT' && p.x < width * 0.06) || p.isUnhorsed
    );

    if (allPassed && this.passResetTimer <= 0) {
      this.passResetTimer = 1.2;
    }
  }

  private checkClashes(width: number): void {
    if (this.passResetTimer > 0) return;

    for (let laneIdx = 0; laneIdx < this.rails.length; laneIdx++) {
      const leftKnights = Array.from(this.playersState.values()).filter(
        (p) => p.lane === laneIdx && p.team === 'LEFT' && !p.isUnhorsed
      );
      const rightKnights = Array.from(this.playersState.values()).filter(
        (p) => p.lane === laneIdx && p.team === 'RIGHT' && !p.isUnhorsed
      );

      for (const lk of leftKnights) {
        for (const rk of rightKnights) {
          const dist = Math.abs(lk.x - rk.x);
          if (dist < 46) {
            this.resolveClash(lk, rk, laneIdx);
            return;
          }
        }
      }
    }
  }

  private resolveClash(lk: JoustPlayer, rk: JoustPlayer, laneIdx: number): void {
    const railY = this.rails[laneIdx] || 300;
    const clashX = (lk.x + rk.x) * 0.5;

    const lkHasCouch = lk.lanceCharge >= 0.7;
    const rkHasCouch = rk.lanceCharge >= 0.7;
    const lkHasLance = lk.isCharging;
    const rkHasLance = rk.isCharging;

    const elevationDiff = lk.lanceElevation - rk.lanceElevation;
    const theme = THEMES[this.currentTheme];

    // Trigger hit-stop freeze frame
    this.hitFreezeTimer = 0.045; // 45ms freeze frame
    this.particles.shake(10);
    this.spawnWoodSplinters(clashX, railY, theme.railWood, 20);

    if (lkHasCouch && rkHasCouch) {
      // Supersonic mutual critical clash!
      this.audio.playExplosion();
      this.particles.spawnExplosion(clashX, railY, '#F59E0B', 32);

      if (elevationDiff === 0) {
        // Both shatter lances!
        lk.score += 250;
        rk.score += 250;
        lk.lanceBreaks += 1;
        rk.lanceBreaks += 1;
        lk.currentMood = 'triumph';
        rk.currentMood = 'triumph';
      } else if (elevationDiff > 0) {
        // Left knight struck helmet
        this.unhorsePlayer(rk, 1, -280);
        lk.score += 450;
        lk.unhorses += 1;
        lk.currentMood = 'triumph';
      } else {
        // Right knight struck helmet
        this.unhorsePlayer(lk, -1, -280);
        rk.score += 450;
        rk.unhorses += 1;
        rk.currentMood = 'triumph';
      }
    } else if (lkHasCouch && !rkHasCouch) {
      // Left knight punches through with charged Couched Strike!
      this.audio.playExplosion();
      this.particles.spawnExplosion(clashX, railY, '#38BDF8', 28);
      this.unhorsePlayer(rk, 1, -320);
      lk.score += 400;
      lk.unhorses += 1;
      lk.currentMood = 'triumph';
    } else if (!lkHasCouch && rkHasCouch) {
      // Right knight punches through!
      this.audio.playExplosion();
      this.particles.spawnExplosion(clashX, railY, '#38BDF8', 28);
      this.unhorsePlayer(lk, -1, -320);
      rk.score += 400;
      rk.unhorses += 1;
      rk.currentMood = 'triumph';
    } else if (lkHasLance && rkHasLance) {
      // Standard lance clash
      this.audio.playBounce();
      this.particles.spawnSparks(clashX, railY, theme.accentGlow, 18);

      if (elevationDiff === 0) {
        lk.score += 180;
        rk.score += 180;
        lk.lanceBreaks += 1;
        rk.lanceBreaks += 1;
      } else if (elevationDiff > 0) {
        this.unhorsePlayer(rk, 1, -220);
        lk.score += 320;
        lk.unhorses += 1;
        lk.currentMood = 'triumph';
      } else {
        this.unhorsePlayer(lk, -1, -220);
        rk.score += 320;
        rk.unhorses += 1;
        rk.currentMood = 'triumph';
      }
    } else if (lkHasLance && !rkHasLance) {
      // Left knight unhorses undefended right knight
      this.audio.playBounce();
      this.unhorsePlayer(rk, 1, -260);
      lk.score += 350;
      lk.unhorses += 1;
      lk.currentMood = 'triumph';
    } else if (!lkHasLance && rkHasLance) {
      // Right knight unhorses undefended left knight
      this.audio.playBounce();
      this.unhorsePlayer(lk, -1, -260);
      rk.score += 350;
      rk.unhorses += 1;
      rk.currentMood = 'triumph';
    } else {
      // Clean pass without lowering lances
      this.audio.playTap();
    }

    this.passResetTimer = 1.3;
  }

  private unhorsePlayer(p: JoustPlayer, knockDir: number, launchVy: number): void {
    p.isUnhorsed = true;
    p.unhorseVx = knockDir * 240;
    p.unhorseVy = launchVy;
    p.currentMood = 'shocked';
    p.moodTimer = 3.0;
  }

  private spawnWoodSplinters(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 260;
      this.splinters.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 100,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 14,
        color: Math.random() > 0.4 ? color : '#F59E0B',
        life: 0.6 + Math.random() * 0.5
      });
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
    if (!bot || bot.isUnhorsed) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.38 + Math.random() * 0.18
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.10
        : 0.08 + Math.random() * 0.05;
    this.botReactionTimers.set(botId, interval);

    // Distance to center or approaching rival on same lane
    const rival = Array.from(this.playersState.values()).find(
      (p) => p.lane === bot.lane && p.team !== bot.team && !p.isUnhorsed
    );

    const distToRival = rival ? Math.abs(bot.x - rival.x) : Math.abs(bot.x - width * 0.5);

    let action = false;
    let throttle = 0;

    if (distToRival < 260) {
      action = true; // Hold action to couch lance

      if (difficulty === 'bot_hard') {
        // High level counter-elevation
        if (rival) {
          // If rival aims low, aim high. If rival aims high, aim low or match
          throttle = rival.lanceElevation <= 0 ? 1 : -1;
        }
      } else if (difficulty === 'bot_normal') {
        if (Math.random() < 0.75 && rival) {
          throttle = -rival.lanceElevation;
        } else {
          throttle = Math.random() > 0.5 ? 1 : -1;
        }
      } else {
        // Easy: 35% chance to miss-time or misalign
        if (Math.random() < 0.65) {
          throttle = Math.random() > 0.5 ? 1 : 0;
        }
      }
    }

    this.input.setBotInput(botId, action, 0, throttle, action);
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
        unhorses: ps?.unhorses || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topUnhorses = scores[0]?.unhorses || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} dominated the tournament with ${topUnhorses} heroic unhorses!`
      : 'Draw! All knights rode with untamed heraldic valor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastHeight = height;
    const theme = THEMES[this.currentTheme];

    // 1. Tiltyard Ground & Grass Borders
    ctx.fillStyle = theme.dirtColor;
    ctx.fillRect(0, 0, width, height);

    // Green grass / spectator turf top and bottom
    ctx.fillStyle = theme.grassColor;
    ctx.fillRect(0, 0, width, 50);
    ctx.fillRect(0, height - 52, width, 52);

    // Heraldic Bunting Banners along borders
    this.renderBanners(ctx, width, height, theme);

    // 2. Wooden Tilt Rails
    for (const railY of this.rails) {
      // Shadow beneath rail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, railY + 6, width, 10);

      // Main barrier
      ctx.fillStyle = theme.railWood;
      ctx.fillRect(0, railY - 7, width, 14);

      // Gold / Neon Railing Highlight
      ctx.strokeStyle = theme.railHighlight;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, railY);
      ctx.lineTo(width, railY);
      ctx.stroke();

      // Rail posts
      for (let px = 40; px < width; px += 90) {
        ctx.fillStyle = '#1E140A';
        ctx.fillRect(px - 4, railY - 14, 8, 28);
        ctx.fillStyle = theme.railHighlight;
        ctx.fillRect(px - 2, railY - 12, 4, 6);
      }
    }

    // 3. Render Splinters
    for (const s of this.splinters) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = s.color;
      ctx.fillRect(-6, -2, 12, 4);
      ctx.restore();
    }

    // 4. Render Knights & Galloping Steeds
    for (const ps of this.playersState.values()) {
      this.renderJouster(ctx, ps, theme);
    }

    // 5. Safe UI & Theme Pill
    this.renderSafeUI(ctx, width, height);
  }

  private renderBanners(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: JoustTheme
  ): void {
    ctx.save();
    const bannerSpacing = 55;
    const bannerH = 18;

    for (let bx = 20; bx < width - 20; bx += bannerSpacing) {
      const col = (Math.floor(bx / bannerSpacing) % 2 === 0) ? theme.bannerColor1 : theme.bannerColor2;
      ctx.fillStyle = col;

      // Top banner pennant
      ctx.beginPath();
      ctx.moveTo(bx, 50);
      ctx.lineTo(bx + bannerSpacing * 0.5, 50 + bannerH);
      ctx.lineTo(bx + bannerSpacing, 50);
      ctx.closePath();
      ctx.fill();

      // Bottom banner pennant
      ctx.beginPath();
      ctx.moveTo(bx, height - 52);
      ctx.lineTo(bx + bannerSpacing * 0.5, height - 52 - bannerH);
      ctx.lineTo(bx + bannerSpacing, height - 52);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private renderJouster(
    ctx: CanvasRenderingContext2D,
    ps: JoustPlayer,
    theme: JoustTheme
  ): void {
    const cfg = this.players.find((x) => x.id === ps.id);
    const color = cfg ? cfg.color : '#FFFFFF';
    const isLeft = ps.team === 'LEFT';
    const dir = isLeft ? 1 : -1;
    const isBot = cfg ? cfg.type !== 'human' : false;

    ctx.save();
    ctx.translate(ps.x, ps.y);

    if (ps.isUnhorsed) {
      ctx.rotate(ps.unhorseAnim * 1.6);
    }

    // Gallop vertical bounce
    const bounceY = ps.isUnhorsed ? 0 : Math.sin(ps.gallopPhase) * 4;

    // 1. Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 26, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Steed Body & Legs
    const horseColor = isLeft ? '#D97706' : '#E2E8F0';
    const saddleColor = isLeft ? '#92400E' : '#94A3B8';

    // Gallop legs
    ctx.strokeStyle = horseColor;
    ctx.lineWidth = 4;
    const legPhase = Math.sin(ps.gallopPhase);
    ctx.beginPath();
    ctx.moveTo(-12, 6 + bounceY);
    ctx.lineTo(-18 - legPhase * 8, 16);
    ctx.moveTo(12, 6 + bounceY);
    ctx.lineTo(18 + legPhase * 8, 16);
    ctx.stroke();

    // Steed Torso
    ctx.fillStyle = horseColor;
    ctx.beginPath();
    ctx.ellipse(0, bounceY, 24, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Caparison / Saddle blanket
    ctx.fillStyle = color;
    ctx.fillRect(-10, bounceY - 6, 20, 14);

    // Steed Head & Neck
    ctx.fillStyle = horseColor;
    ctx.beginPath();
    ctx.ellipse(dir * 20, -7 + bounceY, 11, 8, dir * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Reins
    ctx.strokeStyle = saddleColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, bounceY - 10);
    ctx.lineTo(dir * 18, -4 + bounceY);
    ctx.stroke();

    // 3. Knight Avatar Character Mascot
    ctx.save();
    ctx.translate(0, -18 + bounceY);
    drawCharacter(
      ctx,
      0,
      0,
      12,
      ps.id,
      isBot,
      ps.currentMood,
      ps.gallopPhase * 0.2,
      undefined
    );
    ctx.restore();

    // 4. Heraldic Shield
    ctx.save();
    ctx.translate(dir * 6, -14 + bounceY);
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(-5, -7, 12, 16, [2, 6, 8, 2]);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-3, -5, 8, 12, [1, 4, 6, 1]);
    ctx.fill();
    ctx.restore();

    // 5. Couched Lance & Kinetic Glow
    ctx.save();
    ctx.translate(0, -12 + bounceY);

    const lanceAngle = ps.isCharging
      ? ps.lanceElevation * 0.16
      : isLeft
      ? -Math.PI / 4
      : -Math.PI * 0.75;

    const lanceLen = 52;
    const tipX = dir * Math.cos(lanceAngle) * lanceLen;
    const tipY = Math.sin(lanceAngle) * lanceLen;

    // Kinetic Power Charge Ring / Glow
    if (ps.lanceCharge > 0) {
      const chargeRadius = 6 + ps.lanceCharge * 12;
      const glowCol = ps.isUnderdog ? '#F59E0B' : theme.accentGlow;
      ctx.strokeStyle = glowCol;
      ctx.lineWidth = 2 + ps.lanceCharge * 2;
      ctx.beginPath();
      ctx.arc(tipX, tipY, chargeRadius, 0, Math.PI * 2);
      ctx.stroke();

      if (ps.lanceCharge >= 0.7) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
      }
    }

    // Lance Shaft
    ctx.strokeStyle = ps.isUnderdog ? '#F59E0B' : '#94A3B8';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Lance Spearhead Tip
    ctx.fillStyle = ps.lanceCharge >= 0.7 ? '#FDE047' : '#EF4444';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Underdog Gilded Crown Aura
    if (ps.isUnderdog && !ps.isUnhorsed) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 SURGE', 0, -38);
    }

    ctx.restore();
  }

  private renderSafeUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Minigame Header Badge at y: 56 (PRESERVING GLOBAL TIMER AT y: 12-44!)
    const isSuddenDeath = this.roundTimer <= 15.0;
    const badgeW = 260;
    const badgeH = 28;
    const badgeX = (width - badgeW) * 0.5;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? `PASS ${this.passNumber}/${this.maxPasses} • ⚔️ SUDDEN DEATH!`
      : `PASS ${this.passNumber}/${this.maxPasses} • COUCH LANCE TO STRIKE`;
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Cards (Safely offset to y: height - 128)
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
        cardY = 90;
      } else {
        cardX = width - 150;
        cardY = 90;
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
        ps?.currentMood || 'focused',
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

    // 4. Control Hints (bottom-right aligned)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Hold [Space/Action]: Couch Lance | [W/S]: Aim Elevation', width - 20, height - 14);

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
      passNumber: this.passNumber,
      maxPasses: this.maxPasses,
      theme: this.currentTheme,
      splintersCount: this.splinters.length,
      roundTimer: this.roundTimer,
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        team: p.team,
        lane: p.lane,
        x: Math.round(p.x),
        y: Math.round(p.y),
        score: p.score,
        unhorses: p.unhorses,
        isUnhorsed: p.isUnhorsed,
        isUnderdog: p.isUnderdog,
        lanceCharge: Math.round(p.lanceCharge * 100)
      }))
    };
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    this.splinters = [];
    this.playersState.clear();
  }
}
