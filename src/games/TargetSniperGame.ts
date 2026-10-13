import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type TargetSniperThemeId = 'carnival' | 'cyber' | 'saloon';

interface TargetSniperTheme {
  id: TargetSniperThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  tierTrackColor: string;
  tierTrackHighlight: string;
  curtainColor: string;
  accentColor: string;
  duckColor: string;
  clayColor: string;
  starColor: string;
}

const THEMES: Record<TargetSniperThemeId, TargetSniperTheme> = {
  carnival: {
    id: 'carnival',
    name: 'Carnival Gallery',
    icon: '🎪',
    bgGradTop: '#1E1B4B',
    bgGradBottom: '#4C1D95',
    tierTrackColor: '#78350F',
    tierTrackHighlight: '#F59E0B',
    curtainColor: '#DC2626',
    accentColor: '#F59E0B',
    duckColor: '#FBBF24',
    clayColor: '#EF4444',
    starColor: '#F59E0B'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Hologram Range',
    icon: '⚡',
    bgGradTop: '#0B0F2A',
    bgGradBottom: '#030712',
    tierTrackColor: '#1E1B4B',
    tierTrackHighlight: '#06B6D4',
    curtainColor: '#312E81',
    accentColor: '#06B6D4',
    duckColor: '#38BDF8',
    clayColor: '#F43F5E',
    starColor: '#A855F7'
  },
  saloon: {
    id: 'saloon',
    name: 'Wild West Saloon',
    icon: '🤠',
    bgGradTop: '#291807',
    bgGradBottom: '#140A03',
    tierTrackColor: '#451A03',
    tierTrackHighlight: '#D97706',
    curtainColor: '#991B1B',
    accentColor: '#F59E0B',
    duckColor: '#FDE68A',
    clayColor: '#B45309',
    starColor: '#FBBF24'
  }
};

const THEME_ORDER: TargetSniperThemeId[] = ['carnival', 'cyber', 'saloon'];

interface GalleryTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  type: 'duck' | 'clay' | 'star' | 'skull' | 'diamond_star';
  radius: number;
  points: number;
  isHit: boolean;
  hitAnim: number;
}

interface SniperPlayer {
  id: PlayerId;
  reticleX: number;
  reticleY: number;
  score: number;
  shotsFired: number;
  hits: number;
  streak: number;
  cooldown: number;
  chargeTime: number;
  isCharging: boolean;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class TargetSniperGame extends BaseGame {
  public targets: GalleryTarget[] = [];
  public playersState: Map<PlayerId, SniperPlayer> = new Map();
  public currentTheme: TargetSniperThemeId = 'carnival';
  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private spawnTimer: number = 0.5;
  private targetIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private canvasRef: HTMLCanvasElement | null = null;

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
    this.setupListeners();
    this.reset(width, height);
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    this.keyHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 't') {
        this.cycleTheme();
      } else if (key === '1') {
        this.setTheme('carnival');
      } else if (key === '2') {
        this.setTheme('cyber');
      } else if (key === '3') {
        this.setTheme('saloon');
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    this.canvasRef = document.querySelector('canvas');
    if (this.canvasRef) {
      this.clickHandler = (e: MouseEvent) => {
        if (!this.canvasRef) return;
        const rect = this.canvasRef.getBoundingClientRect();
        const scaleX = this.canvasRef.width / rect.width;
        const scaleY = this.canvasRef.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Theme pill zone: x: 20, y: height - 44, w: 170, h: 32
        const pillY = this.canvasRef.height - 44;
        if (clickX >= 20 && clickX <= 190 && clickY >= pillY && clickY <= pillY + 32) {
          this.cycleTheme();
        }
      };
      this.canvasRef.addEventListener('click', this.clickHandler);
    }
  }

  public cycleTheme(): void {
    const idx = THEME_ORDER.indexOf(this.currentTheme);
    this.setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  }

  public setTheme(themeId: TargetSniperThemeId): void {
    this.currentTheme = themeId;
    this.audio.playTap();
    this.particles.showFloatingText(
      `${THEMES[themeId].icon} ${THEMES[themeId].name}`,
      400,
      120,
      THEMES[themeId].accentColor,
      20
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.targets = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.spawnTimer = 0.5;
    this.targetIdCounter = 0;

    // Pre-populate initial targets across 3 gallery conveyor tiers
    const tiers = [height * 0.28, height * 0.48, height * 0.68];
    tiers.forEach((ty, row) => {
      for (let i = 0; i < 4; i++) {
        const tx = width * 0.15 + i * 160;
        const dir = row % 2 === 0 ? 1 : -1;
        this.targets.push({
          id: this.targetIdCounter++,
          x: tx,
          y: ty,
          vx: dir * (90 + row * 40),
          type: row === 0 ? 'clay' : row === 1 ? 'duck' : 'star',
          radius: 20,
          points: row === 0 ? 50 : row === 1 ? 30 : 100,
          isHit: false,
          hitAnim: 0
        });
      }
    });

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        reticleX: width * 0.25 + idx * 120,
        reticleY: height * 0.5,
        score: 0,
        shotsFired: 0,
        hits: 0,
        streak: 0,
        cooldown: 0,
        chargeTime: 0,
        isCharging: false,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.15);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Dynamic Underdog status
    const playersList = Array.from(this.playersState.values());
    const highestScore = Math.max(0, ...playersList.map((p) => p.score));
    playersList.forEach((p) => {
      p.isUnderdog = highestScore >= 300 && p.score <= highestScore - 180;
    });

    // Update bot decisions
    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 15.0;

    // Spawn new targets periodically
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = isSuddenDeath ? 0.35 + Math.random() * 0.25 : 0.65 + Math.random() * 0.35;
      this.spawnRandomTarget(width, height, isSuddenDeath);
    }

    // Move targets along conveyor rows
    const speedScale = isSuddenDeath ? 1.3 : 1.0;
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.x += t.vx * speedScale * dt;

      if (t.hitAnim > 0) {
        t.hitAnim = Math.max(0, t.hitAnim - dt * 4.0);
      }

      // Despawn off-screen targets
      if ((t.vx > 0 && t.x > width + 40) || (t.vx < 0 && t.x < -40)) {
        this.targets.splice(i, 1);
      }
    }

    // Update players reticles and shots
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.cooldown > 0) ps.cooldown -= dt;
      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
      } else {
        ps.currentMood = ps.isCharging ? 'focused' : 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Smooth crosshair reticle motion
      const reticleSpeed = ps.isUnderdog ? 480 : 400;
      ps.reticleX += steer * reticleSpeed * dt;
      ps.reticleY += -throttle * reticleSpeed * dt;

      ps.reticleX = Math.max(50, Math.min(width - 50, ps.reticleX));
      ps.reticleY = Math.max(70, Math.min(height - 70, ps.reticleY));

      // Hold-to-Charge Lock-On Sniper Blast
      if (actionHeld) {
        ps.isCharging = true;
        ps.chargeTime = Math.min(0.65, ps.chargeTime + dt);
        ps.currentMood = 'focused';
        if (Math.random() < 0.25) {
          this.particles.spawnSparks(ps.reticleX, ps.reticleY, p.color, 1);
        }
      } else if (ps.isCharging || justAction) {
        // Release Shot!
        const isSuperShot = ps.chargeTime >= 0.5;
        ps.isCharging = false;
        ps.chargeTime = 0;

        if (ps.cooldown <= 0) {
          ps.cooldown = isSuperShot ? 0.35 : 0.20;
          ps.shotsFired += 1;
          this.firePlayerShot(ps, p, isSuperShot, isSuddenDeath);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private firePlayerShot(
    player: SniperPlayer,
    pCfg: PlayerConfig,
    isSuperShot: boolean,
    isSuddenDeath: boolean
  ): void {
    const hitRadius = (isSuperShot ? 42 : 22) * (player.isUnderdog ? 1.4 : 1.0);
    this.audio.playLaser();
    this.particles.spawnSparks(player.reticleX, player.reticleY, pCfg.color, isSuperShot ? 18 : 8);

    if (isSuperShot) {
      this.particles.shake(5);
    }

    let hitCount = 0;
    const targetsToHit: GalleryTarget[] = [];

    for (const t of this.targets) {
      if (t.isHit) continue;
      const dist = Math.hypot(t.x - player.reticleX, t.y - player.reticleY);
      if (dist < t.radius + hitRadius) {
        targetsToHit.push(t);
        if (!isSuperShot) break; // Regular shot hits 1 target, super shot pierces multiple
      }
    }

    if (targetsToHit.length > 0) {
      targetsToHit.forEach((t) => {
        t.isHit = true;
        t.hitAnim = 1.0;
        hitCount++;

        if (t.type === 'skull') {
          if (!player.isUnderdog) {
            player.streak = 0;
            player.score = Math.max(0, player.score - 60);
            player.currentMood = 'shocked';
            player.moodTimer = 1.0;
            this.audio.playExplosion();
            this.particles.shake(6);
            this.particles.spawnExplosion(t.x, t.y, '#EF4444', 20);
            this.particles.showFloatingText('💀 -60 SKULL!', t.x, t.y - 20, '#EF4444', 16);
          } else {
            // Underdog Eagle Eye purifies skull!
            player.score += 50;
            this.audio.playBounce();
            this.particles.spawnSparks(t.x, t.y, '#FBBF24', 12);
            this.particles.showFloatingText('+50 PURIFIED!', t.x, t.y - 20, '#FBBF24', 14);
          }
        } else {
          // Valid target
          player.hits += 1;
          player.streak += 1;
          const streakMultiplier = Math.min(4, 1 + Math.floor(player.streak / 3));
          const suddenMultiplier = isSuddenDeath ? 2 : 1;
          const superMultiplier = isSuperShot ? 1.5 : 1.0;
          const pts = Math.round(t.points * streakMultiplier * suddenMultiplier * superMultiplier);
          player.score += pts;
          player.currentMood = 'triumph';
          player.moodTimer = 0.8;

          if (t.type === 'diamond_star' || t.type === 'star') {
            this.audio.playFanfare();
            this.particles.shake(5);
            this.particles.spawnExplosion(t.x, t.y, '#F59E0B', 24);
            this.particles.showFloatingText(
              `★ +${pts}!`,
              t.x,
              t.y - 24,
              THEMES[this.currentTheme].accentColor,
              18
            );
          } else {
            this.audio.playScore();
            this.particles.spawnSparks(t.x, t.y, pCfg.color, 12);
            this.particles.showFloatingText(`+${pts}`, t.x, t.y - 18, '#10B981', 14);
          }
        }
      });
    } else {
      player.streak = 0;
      this.audio.playTap();
    }
  }

  private spawnRandomTarget(width: number, height: number, isSuddenDeath: boolean): void {
    const row = Math.floor(Math.random() * 3);
    const tiers = [height * 0.28, height * 0.48, height * 0.68];
    const ty = tiers[row];
    const dir = row % 2 === 0 ? 1 : -1;
    const startX = dir > 0 ? -30 : width + 30;

    const roll = Math.random();
    let type: 'duck' | 'clay' | 'star' | 'skull' | 'diamond_star' = 'duck';
    let pts = 30;

    if (roll < 0.15) {
      type = 'skull';
      pts = -50;
    } else if (isSuddenDeath && roll < 0.35) {
      type = 'diamond_star';
      pts = 200;
    } else if (roll < 0.45) {
      type = 'star';
      pts = 100;
    } else if (roll < 0.72) {
      type = 'clay';
      pts = 50;
    }

    this.targets.push({
      id: this.targetIdCounter++,
      x: startX,
      y: ty,
      vx: dir * (100 + row * 40),
      type,
      radius: 20,
      points: pts,
      isHit: false,
      hitAnim: 0
    });
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
        ? 0.38 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.05;
    this.botReactionTimers.set(botId, interval);

    // Accidental skull shot on Easy/Normal
    const skulls = this.targets.filter((t) => !t.isHit && t.type === 'skull');
    const skullMistake =
      difficulty === 'bot_easy' ? Math.random() < 0.20 : difficulty === 'bot_normal' ? Math.random() < 0.05 : false;
    if (skulls.length > 0 && skullMistake) {
      const skull = skulls[0];
      bot.reticleX = skull.x;
      bot.reticleY = skull.y;
      const pCfg = this.players[botId];
      if (pCfg) this.firePlayerShot(bot, pCfg, false, this.roundTimer <= 15.0);
      return;
    }

    // Find active valid targets
    const validTargets = this.targets.filter(
      (t) => !t.isHit && (t.type === 'duck' || t.type === 'clay' || t.type === 'star' || t.type === 'diamond_star')
    );

    if (validTargets.length > 0) {
      if (difficulty === 'bot_easy' && Math.random() < 0.22) {
        return;
      }

      // Prioritize stars > clays > ducks
      const target =
        validTargets.find((t) => t.type === 'diamond_star') ||
        validTargets.find((t) => t.type === 'star') ||
        validTargets.find((t) => t.type === 'clay') ||
        validTargets[0];

      // Predictive conveyor lead
      const leadTime = difficulty === 'bot_hard' ? 0.12 : 0;
      bot.reticleX = target.x + target.vx * leadTime;
      bot.reticleY = target.y;

      if (difficulty === 'bot_easy') {
        bot.reticleX += (Math.random() - 0.5) * 32;
        bot.reticleY += (Math.random() - 0.5) * 24;
      }

      const isSuper = difficulty === 'bot_hard' && Math.random() < 0.4;
      const pCfg = this.players[botId];
      if (pCfg) {
        this.firePlayerShot(bot, pCfg, isSuper, this.roundTimer <= 15.0);
      }
    }
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
        hits: ps?.hits || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const theme = THEMES[this.currentTheme];
    const topHits = scores[0]?.hits || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} sharp-shot the ${theme.name} with ${topHits} bullseyes!`
      : 'Carnival gallery closed! The ducks got away!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // 1. Gallery Booth Background
    const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
    wallGrad.addColorStop(0, theme.bgGradTop);
    wallGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative side curtains
    ctx.fillStyle = theme.curtainColor;
    ctx.fillRect(0, 0, 40, height);
    ctx.fillRect(width - 40, 0, 40, height);

    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(40, height);
    ctx.moveTo(width - 40, 0);
    ctx.lineTo(width - 40, height);
    ctx.stroke();

    // 2. Conveyor Tiers
    const tiers = [height * 0.28, height * 0.48, height * 0.68];
    for (const ty of tiers) {
      // Wood conveyor shelf
      ctx.fillStyle = theme.tierTrackColor;
      ctx.fillRect(40, ty + 16, width - 80, 10);

      // Brass rail highlight
      ctx.strokeStyle = theme.tierTrackHighlight;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(40, ty + 16);
      ctx.lineTo(width - 40, ty + 16);
      ctx.stroke();
    }

    // 3. Targets
    for (const t of this.targets) {
      ctx.save();
      ctx.translate(t.x, t.y);

      if (t.isHit) {
        ctx.scale(1.2, 0.4);
      }

      if (t.type === 'duck') {
        // Yellow Rubber Duck Target
        ctx.fillStyle = theme.duckColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(10, -8, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#EA580C';
        ctx.beginPath();
        ctx.moveTo(16, -10);
        ctx.lineTo(24, -7);
        ctx.lineTo(16, -4);
        ctx.closePath();
        ctx.fill();
      } else if (t.type === 'clay') {
        // Clay Target
        ctx.fillStyle = theme.clayColor;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();
      } else if (t.type === 'star') {
        // Golden Star Target
        ctx.fillStyle = theme.starColor;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', 0, 0);
      } else if (t.type === 'diamond_star') {
        // Mythic Diamond Star
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💎', 0, 0);
      } else if (t.type === 'skull') {
        // Skull Hazard Cutout
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀', 0, 0);
      }

      ctx.restore();
    }

    // 4. Draw Crosshair Reticles
    for (const p of this.playersState.values()) {
      const cfg = this.players[p.id];
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;

      // Charge ring
      if (p.isCharging && p.chargeTime > 0) {
        const ratio = p.chargeTime / 0.65;
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.reticleX, p.reticleY, 26, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
        ctx.stroke();
      }

      // Outer aiming circle
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.reticleX, p.reticleY, 18, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(p.reticleX - 24, p.reticleY);
      ctx.lineTo(p.reticleX - 10, p.reticleY);
      ctx.moveTo(p.reticleX + 10, p.reticleY);
      ctx.lineTo(p.reticleX + 24, p.reticleY);
      ctx.moveTo(p.reticleX, p.reticleY - 24);
      ctx.lineTo(p.reticleX, p.reticleY - 10);
      ctx.moveTo(p.reticleX, p.reticleY + 10);
      ctx.lineTo(p.reticleX, p.reticleY + 24);
      ctx.stroke();

      // Streak badge
      if (p.streak >= 3) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.streak}x STREAK!`, p.reticleX, p.reticleY - 26);
      }

      // Player Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(p.reticleX - 22, p.reticleY + 22, 44, 14, 6);
      else ctx.rect(p.reticleX - 22, p.reticleY + 22, 44, 14);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg?.name.toUpperCase() || `P${p.id + 1}`, p.reticleX, p.reticleY + 29);

      ctx.restore();
    }

    // 5. Draw HUD & Safe-zone elements
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = THEMES[this.currentTheme];

    // Minigame Header at y: 56, h: 26 (NEVER overlaps global timer at y: 12-44)
    const headerW = 300;
    const headerH = 26;
    const headerX = width * 0.5 - headerW * 0.5;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const isSuddenDeath = this.roundTimer <= 15.0;
    const headerText = isSuddenDeath
      ? `🎯 RAPID GALLERY 2X: ${Math.ceil(this.roundTimer)}s 🎯`
      : `${theme.icon} TARGET SNIPER — ${theme.name.toUpperCase()}`;
    ctx.fillText(headerText, width * 0.5, headerY + headerH * 0.5);

    // Interactive Theme Pill at bottom-left: x: 20, y: height - 44, w: 170, h: 32
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name}`, pillX + 12, pillY + pillH * 0.5);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '900 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + pillH * 0.5);

    // Bottom Right Controls Hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('WASD / Arrows: Aim | Hold Action: Lock-On Blast', width - 20, height - 28);

    // Corner Player Cards offset to y: height - 128 (avoids theme pill at y: height - 44)
    const active = this.getActivePlayers();
    const cardW = 110;
    const cardH = 50;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      let cx = 20;
      let cy = height - 128;

      if (idx === 1) {
        cx = width - cardW - 20;
        cy = height - 128;
      } else if (idx === 2) {
        cx = 20;
        cy = 94;
      } else if (idx === 3) {
        cx = width - cardW - 20;
        cy = 94;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 8);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mascot preview in card
      const isBot = p.type !== 'human';
      const mood: CharacterMood = ps ? ps.currentMood : 'idle';
      drawCharacter(ctx, cx + 22, cy + 25, 14, p.id, isBot, mood, performance.now() * 0.001);

      // Score / Status
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(p.name, cx + 42, cy + 8);

      ctx.fillStyle = theme.accentColor;
      ctx.font = '900 12px "Chakra Petch", monospace';
      ctx.fillText(`🎯 ${Math.round(ps?.score || 0)}`, cx + 42, cy + 26);
    });

    ctx.restore();
  }

  public syncDebug(): void {
    // Expose internal state for headless tests
    (window as any).__TARGET_SNIPER_DEBUG__ = {
      roundTimer: this.roundTimer,
      currentTheme: this.currentTheme,
      targets: this.targets.map((t) => ({
        id: t.id,
        type: t.type,
        isHit: t.isHit
      })),
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        score: p.score,
        hits: p.hits,
        streak: p.streak,
        isUnderdog: p.isUnderdog
      }))
    };
  }

  public destroy(): void {
    super.destroy();
    if (typeof window !== 'undefined') {
      if (this.keyHandler) {
        window.removeEventListener('keydown', this.keyHandler);
        this.keyHandler = null;
      }
      if (this.canvasRef && this.clickHandler) {
        this.canvasRef.removeEventListener('click', this.clickHandler);
        this.clickHandler = null;
      }
    }
  }
}
