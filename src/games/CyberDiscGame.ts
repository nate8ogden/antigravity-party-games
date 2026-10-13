import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type CyberThemeId = 'tron' | 'vegas' | 'molten';

interface CyberTheme {
  id: CyberThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  gridLineColor: string;
  boundaryColor: string;
  centerLineColor: string;
  discHaloColor: string;
  accentColor: string;
}

const THEMES: Record<CyberThemeId, CyberTheme> = {
  tron: {
    id: 'tron',
    name: 'Tron Cyber Grid',
    icon: '⚡',
    bgGradTop: '#0A0F1D',
    bgGradBottom: '#020617',
    gridLineColor: 'rgba(6, 182, 212, 0.16)',
    boundaryColor: '#38BDF8',
    centerLineColor: '#06B6D4',
    discHaloColor: '#38BDF8',
    accentColor: '#38BDF8'
  },
  vegas: {
    id: 'vegas',
    name: 'Vegas Neon Arena',
    icon: '🎰',
    bgGradTop: '#24062B',
    bgGradBottom: '#0F0214',
    gridLineColor: 'rgba(236, 72, 153, 0.16)',
    boundaryColor: '#F43F5E',
    centerLineColor: '#EC4899',
    discHaloColor: '#FBBF24',
    accentColor: '#F43F5E'
  },
  molten: {
    id: 'molten',
    name: 'Molten Basalt Ring',
    icon: '🔥',
    bgGradTop: '#261007',
    bgGradBottom: '#0F0502',
    gridLineColor: 'rgba(249, 115, 22, 0.16)',
    boundaryColor: '#EA580C',
    centerLineColor: '#F97316',
    discHaloColor: '#F97316',
    accentColor: '#F97316'
  }
};

interface Disc {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  lastHitterId: PlayerId | null;
  trail: { x: number; y: number; alpha: number }[];
  isHyper: boolean;
}

interface CyberPlayer {
  id: PlayerId;
  x: number;
  y: number;
  radius: number;
  angle: number;
  score: number;
  shields: number;
  isShieldActive: boolean;
  isChargingSmash: boolean;
  chargeTime: number;
  shieldCooldown: number;
  team: 'LEFT' | 'RIGHT';
  mood: CharacterMood;
  moodTimer: number;
}

export class CyberDiscGame extends BaseGame {
  private currentThemeId: CyberThemeId = 'tron';
  public disc: Disc = {
    x: 400,
    y: 300,
    vx: 340,
    vy: 180,
    radius: 14,
    speed: 380,
    lastHitterId: null,
    trail: [],
    isHyper: false
  };
  public playersState: Map<PlayerId, CyberPlayer> = new Map();

  private arenaBounds = { minX: 60, maxX: 740, minY: 72, maxY: 528 };
  private botReactionTimers: Map<PlayerId, number> = new Map();

  private animTimer: number = 0;
  private screenShake: number = 0;
  private freezeFrames: number = 0;
  private suddenDeathTriggered: boolean = false;

  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 40.0;
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDownBound);
  }

  public init(width: number, height: number): void {
    const themeKeys: CyberThemeId[] = ['tron', 'vegas', 'molten'];
    this.currentThemeId = themeKeys[Math.floor(Math.random() * themeKeys.length)];
    this.reset(width, height);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.cycleTheme();
    } else if (e.key === '1') {
      this.setTheme('tron');
    } else if (e.key === '2') {
      this.setTheme('vegas');
    } else if (e.key === '3') {
      this.setTheme('molten');
    }
  }

  public cycleTheme(): void {
    const list: CyberThemeId[] = ['tron', 'vegas', 'molten'];
    const curIdx = list.indexOf(this.currentThemeId);
    this.setTheme(list[(curIdx + 1) % list.length]);
  }

  public setTheme(id: CyberThemeId): void {
    if (this.currentThemeId !== id) {
      this.currentThemeId = id;
      this.audio.playTap();
      this.particles.emit(100, 300, 15, THEMES[id].accentColor);
    }
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 40.0;
    this.isFinished = false;
    this.animTimer = 0;
    this.screenShake = 0;
    this.freezeFrames = 0;
    this.suddenDeathTriggered = false;
    this.playersState.clear();
    this.botReactionTimers.clear();

    this.arenaBounds = {
      minX: width * 0.08,
      maxX: width * 0.92,
      minY: 76,
      maxY: height - 52
    };

    // Initialize Disc at center
    const angle = (Math.random() > 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.7;
    this.disc = {
      x: width * 0.5,
      y: (this.arenaBounds.minY + this.arenaBounds.maxY) * 0.5,
      vx: Math.cos(angle) * 360,
      vy: Math.sin(angle) * 360,
      radius: 14,
      speed: 360,
      lastHitterId: null,
      trail: [],
      isHyper: false
    };

    // Spawn players on Left / Right half courts
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const team = idx % 2 === 0 ? 'LEFT' : 'RIGHT';
      const startX =
        team === 'LEFT' ? this.arenaBounds.minX + 90 : this.arenaBounds.maxX - 90;
      const startY = idx < 2 ? height * 0.38 : height * 0.62;

      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        radius: 20,
        angle: team === 'LEFT' ? 0 : Math.PI,
        score: 0,
        shields: 5,
        isShieldActive: false,
        isChargingSmash: false,
        chargeTime: 0,
        shieldCooldown: 0,
        team,
        mood: 'idle',
        moodTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.2);
    });
  }

  private isUnderdog(playerId: PlayerId): boolean {
    const ps = this.playersState.get(playerId);
    if (!ps) return false;
    const scores = Array.from(this.playersState.values()).map((p) => p.score);
    const maxScore = Math.max(...scores, 0);
    return maxScore >= 250 && maxScore - ps.score >= 200;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      return;
    }

    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 14);
    }

    if (this.roundTimer <= 15.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.disc.speed = Math.max(500, this.disc.speed);
      this.disc.isHyper = true;
      this.audio.playWhoosh();
    }

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) ps.mood = 'idle';
      }

      if (ps.shieldCooldown > 0) ps.shieldCooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      if (steer !== 0 || throttle !== 0) {
        ps.angle = Math.atan2(-throttle, steer);
      }

      const underdog = this.isUnderdog(p.id);
      const speed = underdog ? 320 : 270;
      ps.x += steer * speed * dt;
      ps.y += -throttle * speed * dt;

      const midX = width * 0.5;
      const minX =
        ps.team === 'LEFT' ? this.arenaBounds.minX + ps.radius : midX + ps.radius + 6;
      const maxX =
        ps.team === 'LEFT' ? midX - ps.radius - 6 : this.arenaBounds.maxX - ps.radius;
      ps.x = Math.max(minX, Math.min(maxX, ps.x));
      ps.y = Math.max(
        this.arenaBounds.minY + ps.radius,
        Math.min(this.arenaBounds.maxY - ps.radius, ps.y)
      );

      // Charge Super Smash Shield on hold
      if (isAction && ps.shieldCooldown <= 0) {
        ps.isChargingSmash = true;
        ps.chargeTime += dt;
        ps.isShieldActive = true;
        ps.mood = 'focused';
        if (Math.random() < 0.25) {
          this.particles.emit(ps.x, ps.y, 1, p.color);
        }
      }

      if (justReleased && ps.isChargingSmash) {
        ps.isChargingSmash = false;
        ps.isShieldActive = false;
        ps.shieldCooldown = 0.35;
      }
    }

    // Update Disc movement
    this.disc.x += this.disc.vx * dt;
    this.disc.y += this.disc.vy * dt;

    // Trail recording
    this.disc.trail.push({ x: this.disc.x, y: this.disc.y, alpha: 1.0 });
    if (this.disc.trail.length > 18) this.disc.trail.shift();
    this.disc.trail.forEach((t) => (t.alpha -= dt * 2.2));

    // Top / Bottom boundary bounce
    if (this.disc.y - this.disc.radius <= this.arenaBounds.minY) {
      this.disc.y = this.arenaBounds.minY + this.disc.radius;
      this.disc.vy = Math.abs(this.disc.vy);
      if (Math.abs(this.disc.vx) < 140) {
        this.disc.vx = (this.disc.vx >= 0 ? 1 : -1) * 160;
      }
      this.audio.playBounce();
      this.particles.emit(this.disc.x, this.disc.y, 6, THEMES[this.currentThemeId].boundaryColor);
    } else if (this.disc.y + this.disc.radius >= this.arenaBounds.maxY) {
      this.disc.y = this.arenaBounds.maxY - this.disc.radius;
      this.disc.vy = -Math.abs(this.disc.vy);
      if (Math.abs(this.disc.vx) < 140) {
        this.disc.vx = (this.disc.vx >= 0 ? 1 : -1) * 160;
      }
      this.audio.playBounce();
      this.particles.emit(this.disc.x, this.disc.y, 6, THEMES[this.currentThemeId].boundaryColor);
    }

    // Left / Right Goal Arc detection
    if (this.disc.x - this.disc.radius <= this.arenaBounds.minX) {
      this.handleGoal('RIGHT', width, height);
    } else if (this.disc.x + this.disc.radius >= this.arenaBounds.maxX) {
      this.handleGoal('LEFT', width, height);
    }

    // Player shield deflect / paddle collision
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const underdog = this.isUnderdog(p.id);
      const dist = Math.hypot(this.disc.x - ps.x, this.disc.y - ps.y);
      const shieldBonus = ps.isShieldActive ? (underdog ? 18 : 12) : 2;
      const hitRadius = ps.radius + this.disc.radius + shieldBonus;

      if (dist < hitRadius) {
        const contactOffset = Math.max(
          -1,
          Math.min(1, (this.disc.y - ps.y) / (ps.radius + this.disc.radius))
        );
        const maxAngle = Math.PI * 0.36;
        let deflectAngle =
          ps.team === 'LEFT'
            ? contactOffset * maxAngle
            : Math.PI - contactOffset * maxAngle;

        const isSmash = ps.isChargingSmash && ps.chargeTime >= 0.45;

        if (isSmash) {
          this.disc.speed = Math.min(940, this.disc.speed + 120);
          this.disc.isHyper = true;
          this.audio.playLaser();
          this.screenShake = 6;
          this.freezeFrames = 2;
          this.particles.emit(this.disc.x, this.disc.y, 18, '#38BDF8');
          ps.score += 60;
          ps.mood = 'triumph';
          ps.moodTimer = 1.0;
        } else if (ps.isShieldActive) {
          this.disc.speed = Math.min(840, this.disc.speed + 60);
          this.audio.playBounce();
          this.particles.emit(this.disc.x, this.disc.y, 10, '#38BDF8');
          ps.score += 35;
          ps.mood = 'focused';
          ps.moodTimer = 0.6;
        } else {
          this.disc.speed = Math.min(760, this.disc.speed + 25);
          this.audio.playBounce();
          this.particles.emit(this.disc.x, this.disc.y, 6, '#FBBF24');
          ps.score += 15;
        }

        this.disc.vx = Math.cos(deflectAngle) * this.disc.speed;
        this.disc.vy = Math.sin(deflectAngle) * this.disc.speed;
        this.disc.lastHitterId = ps.id;

        // Push disc safely outside player body
        this.disc.x = ps.x + Math.cos(deflectAngle) * (hitRadius + 3);
        this.disc.y = ps.y + Math.sin(deflectAngle) * (hitRadius + 3);
        break;
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleGoal(scoringTeam: 'LEFT' | 'RIGHT', width: number, height: number): void {
    this.audio.playFanfare();
    this.screenShake = 8;
    this.freezeFrames = 3;
    this.particles.emit(this.disc.x, this.disc.y, 30, '#EC4899');

    const multi = this.suddenDeathTriggered ? 2 : 1;
    for (const ps of this.playersState.values()) {
      if (ps.team === scoringTeam) {
        ps.score += 300 * multi;
        ps.mood = 'triumph';
        ps.moodTimer = 1.5;
      } else {
        ps.shields = Math.max(0, ps.shields - 1);
        ps.mood = 'shocked';
        ps.moodTimer = 1.5;
      }
    }

    // Reset Disc to center
    const resetAngle =
      (scoringTeam === 'LEFT' ? Math.PI : 0) + (Math.random() - 0.5) * 0.6;
    this.disc.x = width * 0.5;
    this.disc.y = (this.arenaBounds.minY + this.arenaBounds.maxY) * 0.5;
    this.disc.speed = 360;
    this.disc.isHyper = false;
    this.disc.vx = Math.cos(resetAngle) * this.disc.speed;
    this.disc.vy = Math.sin(resetAngle) * this.disc.speed;
    this.disc.trail = [];
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
        ? 0.34 + Math.random() * 0.2
        : difficulty === 'bot_normal'
        ? 0.18 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    // Predict disc trajectory and intercept Y coordinate
    let targetY = this.disc.y;
    if (difficulty === 'bot_easy') {
      targetY += (Math.random() - 0.5) * 60;
    }

    const dy = targetY - bot.y;
    if (Math.abs(dy) > 10) {
      bot.y += Math.sign(dy) * 240 * dt * 4.2;
    }

    bot.angle = bot.team === 'LEFT' ? 0 : Math.PI;

    // Activate shield if disc is close
    const distToDisc = Math.hypot(this.disc.x - bot.x, this.disc.y - bot.y);
    if (
      distToDisc < 95 &&
      Math.random() < (difficulty === 'bot_hard' ? 0.92 : difficulty === 'bot_normal' ? 0.65 : 0.25)
    ) {
      bot.isShieldActive = true;
      if (difficulty === 'bot_hard' && Math.random() < 0.4) {
        bot.isChargingSmash = true;
        bot.chargeTime = 0.5;
      }
    } else {
      bot.isShieldActive = false;
      bot.isChargingSmash = false;
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
        score: ps?.score || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId =
      scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topScore = scores[0]?.score || 0;
    const mvpHighlight =
      winnerId !== null
        ? `Player ${winnerId + 1} dominated the Cyber Velodrome scoring ${topScore} pts in ${THEMES[this.currentThemeId].name}!`
        : 'Velodrome deadlock! Disc energy stabilized!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeId];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Cyber Grid Velodrome Floor
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Neon floor grid lines
    ctx.strokeStyle = theme.gridLineColor;
    ctx.lineWidth = 1;
    for (let x = this.arenaBounds.minX; x <= this.arenaBounds.maxX; x += 38) {
      ctx.beginPath();
      ctx.moveTo(x, this.arenaBounds.minY);
      ctx.lineTo(x, this.arenaBounds.maxY);
      ctx.stroke();
    }
    for (let y = this.arenaBounds.minY; y <= this.arenaBounds.maxY; y += 38) {
      ctx.beginPath();
      ctx.moveTo(this.arenaBounds.minX, y);
      ctx.lineTo(this.arenaBounds.maxX, y);
      ctx.stroke();
    }

    // Center divider
    ctx.strokeStyle = theme.centerLineColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(width * 0.5, this.arenaBounds.minY);
    ctx.lineTo(width * 0.5, this.arenaBounds.maxY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glowing Arena Perimeter
    ctx.strokeStyle = theme.boundaryColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(
      this.arenaBounds.minX,
      this.arenaBounds.minY,
      this.arenaBounds.maxX - this.arenaBounds.minX,
      this.arenaBounds.maxY - this.arenaBounds.minY
    );

    // Goal Lines
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(this.arenaBounds.minX, this.arenaBounds.minY + 30);
    ctx.lineTo(this.arenaBounds.minX, this.arenaBounds.maxY - 30);
    ctx.stroke();

    ctx.strokeStyle = '#3B82F6';
    ctx.beginPath();
    ctx.moveTo(this.arenaBounds.maxX, this.arenaBounds.minY + 30);
    ctx.lineTo(this.arenaBounds.maxX, this.arenaBounds.maxY - 30);
    ctx.stroke();

    // 2. Disc and Neon Ribbon Trail
    if (this.disc.trail.length > 1) {
      ctx.strokeStyle = this.disc.isHyper ? '#F43F5E' : 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = this.disc.radius * 1.6;
      ctx.beginPath();
      this.disc.trail.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }

    // Glowing Disc Outer Halo
    const discHalo = ctx.createRadialGradient(
      this.disc.x,
      this.disc.y,
      4,
      this.disc.x,
      this.disc.y,
      this.disc.radius * 2
    );
    discHalo.addColorStop(0, '#FFFFFF');
    discHalo.addColorStop(0.4, theme.discHaloColor);
    discHalo.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = discHalo;
    ctx.beginPath();
    ctx.arc(this.disc.x, this.disc.y, this.disc.radius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Inner Core
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(this.disc.x, this.disc.y, this.disc.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw Players and Shields
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const underdog = this.isUnderdog(p.id);
      const cfg = this.players.find((x) => x.id === p.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();

      // Underdog golden card aura
      if (underdog) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(ps.x, ps.y, ps.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Shield aura
      if (ps.isShieldActive) {
        const shieldR = ps.radius + (underdog ? 18 : 12);
        ctx.strokeStyle = ps.isChargingSmash ? '#F43F5E' : '#38BDF8';
        ctx.lineWidth = ps.isChargingSmash ? 6 : 4;
        ctx.beginPath();
        ctx.arc(ps.x, ps.y, shieldR, ps.angle - 1.2, ps.angle + 1.2);
        ctx.stroke();
      }

      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.angle);

      // Cyber Body
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, ps.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Energy Visor
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ps.radius * 0.4, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore(); // Undo screen shake

    // 4. Header Badge (Safe-zone: y: 56, h: 26)
    const headerW = 340;
    const headerH = 26;
    const headerX = width / 2 - headerW / 2;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${theme.icon} ${theme.name.toUpperCase()} • ENERGY DISC DUEL`,
      width / 2,
      headerY + 17
    );

    // 5. Corner Player HUD Cards with CharacterRenderer Mascots
    // Offset bottom-left card above Theme Pill (y: height - 128)
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      let cx = 16;
      let cy = 72;
      const cardW = 124;
      const cardH = 66;

      if (p.corner === 'top-right') {
        cx = width - cardW - 16;
        cy = 72;
      } else if (p.corner === 'bottom-left') {
        cx = 16;
        cy = height - cardH - 52;
      } else if (p.corner === 'bottom-right') {
        cx = width - cardW - 16;
        cy = height - cardH - 52;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 8);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.stroke();

      // Mascot Avatar
      const isBot = p.type !== 'human';
      drawCharacter(ctx, cx + 22, cy + 33, 16, p.id, isBot, ps.mood, this.animTimer);

      // Name & Score
      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 46, cy + 22);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`${ps.score} pts`, cx + 46, cy + 40);

      ctx.fillStyle = '#06B6D4';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`Shields: ${ps.shields}`, cx + 46, cy + 56);
    }

    // 6. Interactive Theme Pill (Bottom-left: x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, pillX + 10, pillY + 20);

    // 7. Control hints (Bottom-right: x: width - 20, y: height - 28)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Move: Glide | Tap: Deflect | Hold: Smash Shield', width - 20, height - 24);
  }

  public syncDebug(): Record<string, unknown> {
    return {
      theme: this.currentThemeId,
      roundTimer: this.roundTimer,
      suddenDeath: this.suddenDeathTriggered,
      discSpeed: this.disc.speed,
      discPos: { x: this.disc.x, y: this.disc.y },
      players: Array.from(this.playersState.entries()).map(([id, p]) => ({
        id,
        team: p.team,
        score: p.score,
        shields: p.shields,
        isUnderdog: this.isUnderdog(id)
      }))
    };
  }
}
