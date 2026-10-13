import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type PainterThemeId = 'neon' | 'graffiti' | 'cyber';

interface PainterTheme {
  id: PainterThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  rinkBorder: string;
  gridLineColor: string;
  unpaintedTile: string;
  accentColor: string;
}

const THEMES: Record<PainterThemeId, PainterTheme> = {
  neon: {
    id: 'neon',
    name: 'Neon Roller Rink',
    icon: '🛼',
    bgGradTop: '#1E1B4B',
    bgGradBottom: '#0F0E26',
    rinkBorder: '#EC4899',
    gridLineColor: 'rgba(236, 72, 153, 0.15)',
    unpaintedTile: '#0B0A1A',
    accentColor: '#F43F5E'
  },
  graffiti: {
    id: 'graffiti',
    name: 'Urban Graffiti Lot',
    icon: '🎨',
    bgGradTop: '#27272A',
    bgGradBottom: '#18181B',
    rinkBorder: '#F59E0B',
    gridLineColor: 'rgba(245, 158, 11, 0.15)',
    unpaintedTile: '#121215',
    accentColor: '#F59E0B'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Splat Arena',
    icon: '⚡',
    bgGradTop: '#0F172A',
    bgGradBottom: '#020617',
    rinkBorder: '#06B6D4',
    gridLineColor: 'rgba(6, 182, 212, 0.15)',
    unpaintedTile: '#050B14',
    accentColor: '#38BDF8'
  }
};

type PowerUpType = 'MEGA_ROLLER' | 'PAINT_BOMB';

interface PaintPowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  active: boolean;
  pulseTimer: number;
}

interface PainterSkater {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  rollerWidth: number;
  megaTimer: number;
  boostTimer: number;
  chargeTime: number;
  isCharging: boolean;
  score: number;
  paintedTiles: number;
  mood: CharacterMood;
  moodTimer: number;
  botReactionTimer: number;
  desiredAngle: number;
}

export class FloorPainterGame extends BaseGame {
  private currentThemeId: PainterThemeId = 'neon';
  private gridCols = 54;
  private gridRows = 36;
  private tileW = 0;
  private tileH = 0;
  private originX = 0;
  private originY = 0;

  // tileOwners[c][r] = PlayerId | null
  private tileOwners: (PlayerId | null)[][] = [];
  private skaters: Map<PlayerId, PainterSkater> = new Map();
  private powerUps: PaintPowerUp[] = [];
  private totalTiles = 0;

  private animTimer: number = 0;
  private screenShake: number = 0;
  private freezeFrames: number = 0;
  private suddenDeathTriggered: boolean = false;
  private superBombSpawned: boolean = false;

  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDownBound);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 45.0;
    this.isFinished = false;
    this.animTimer = 0;
    this.screenShake = 0;
    this.freezeFrames = 0;
    this.suddenDeathTriggered = false;
    this.superBombSpawned = false;

    const themeKeys: PainterThemeId[] = ['neon', 'graffiti', 'cyber'];
    this.currentThemeId = themeKeys[Math.floor(Math.random() * themeKeys.length)];

    this.originX = 24;
    this.originY = 82;
    this.tileW = (width - 48) / this.gridCols;
    this.tileH = (height - 120) / this.gridRows;
    this.totalTiles = this.gridCols * this.gridRows;

    // Initialize grid
    this.tileOwners = [];
    for (let c = 0; c < this.gridCols; c++) {
      this.tileOwners[c] = [];
      for (let r = 0; r < this.gridRows; r++) {
        this.tileOwners[c][r] = null;
      }
    }

    this.setupSkaters(width, height);
    this.setupPowerUps(width, height);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.cycleTheme();
    } else if (e.key === '1') {
      this.setTheme('neon');
    } else if (e.key === '2') {
      this.setTheme('graffiti');
    } else if (e.key === '3') {
      this.setTheme('cyber');
    }
  }

  public cycleTheme(): void {
    const list: PainterThemeId[] = ['neon', 'graffiti', 'cyber'];
    const curIdx = list.indexOf(this.currentThemeId);
    this.setTheme(list[(curIdx + 1) % list.length]);
  }

  public setTheme(id: PainterThemeId): void {
    if (this.currentThemeId !== id) {
      this.currentThemeId = id;
      this.audio.playTap();
      this.particles.emit(100, 300, 15, THEMES[id].accentColor);
    }
  }

  private setupPowerUps(width: number, height: number): void {
    this.powerUps = [
      {
        x: width * 0.32,
        y: height * 0.44,
        type: 'MEGA_ROLLER',
        active: true,
        pulseTimer: 0
      },
      {
        x: width * 0.68,
        y: height * 0.56,
        type: 'PAINT_BOMB',
        active: true,
        pulseTimer: 1.5
      }
    ];
  }

  private setupSkaters(width: number, height: number): void {
    this.skaters.clear();
    const active = this.getActivePlayers();

    const spawnPositions = [
      { x: 90, y: 130, a: 0.6 },
      { x: width - 90, y: 130, a: 2.5 },
      { x: 90, y: height - 80, a: -0.6 },
      { x: width - 90, y: height - 80, a: -2.5 }
    ];

    active.forEach((p, idx) => {
      const sp = spawnPositions[idx % spawnPositions.length];
      this.skaters.set(p.id, {
        id: p.id,
        x: sp.x,
        y: sp.y,
        vx: Math.cos(sp.a) * 200,
        vy: Math.sin(sp.a) * 200,
        angle: sp.a,
        speed: 210,
        rollerWidth: 18,
        megaTimer: 0,
        boostTimer: 0,
        chargeTime: 0,
        isCharging: false,
        score: 0,
        paintedTiles: 0,
        mood: 'idle',
        moodTimer: 0,
        botReactionTimer: 0.15 + Math.random() * 0.2,
        desiredAngle: sp.a
      });
    });
  }

  private isUnderdog(playerId: PlayerId): boolean {
    const scores = Array.from(this.skaters.values()).map((s) => s.score);
    const maxScore = Math.max(...scores, 0);
    const s = this.skaters.get(playerId);
    return !!s && maxScore >= 20 && maxScore - s.score >= 15;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      return;
    }

    this.animTimer += dt;
    this.roundTimer -= dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 15);
    }

    // Power-up pulses
    for (const pu of this.powerUps) {
      pu.pulseTimer += dt * 4;
    }

    // Sudden death at <= 15s
    if (this.roundTimer <= 15.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.audio.playWhoosh();
      if (!this.superBombSpawned) {
        this.superBombSpawned = true;
        this.powerUps.push({
          x: width / 2,
          y: height / 2 + 10,
          type: 'PAINT_BOMB',
          active: true,
          pulseTimer: 0
        });
        this.particles.emit(width / 2, height / 2 + 10, 25, '#F59E0B');
      }
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update Skaters
    const active = this.getActivePlayers();
    for (const p of active) {
      const s = this.skaters.get(p.id);
      if (!s) continue;

      if (s.moodTimer > 0) {
        s.moodTimer -= dt;
        if (s.moodTimer <= 0) s.mood = 'idle';
      }

      if (s.megaTimer > 0) s.megaTimer -= dt;
      if (s.boostTimer > 0) s.boostTimer -= dt;

      const underdog = this.isUnderdog(p.id);
      let curRollerWidth = s.megaTimer > 0 ? 36 : underdog ? 25 : 18;
      s.rollerWidth = curRollerWidth;

      let baseSpeed = s.boostTimer > 0 ? 340 : underdog ? 245 : 210;

      if (!p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(p.id);
        const throttle = this.input.getThrottle(p.id);
        const hasDir = Math.abs(steer) > 0.15 || Math.abs(throttle) > 0.15;
        const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
        const justReleased = this.input.justReleased(p.id);

        if (hasDir) {
          s.angle = Math.atan2(-throttle, steer);
        }

        // Hold action to charge Nitro Dash
        if (isAction) {
          s.isCharging = true;
          s.chargeTime += dt;
          s.mood = 'focused';
          if (Math.random() < 0.3) {
            this.particles.emit(s.x, s.y, 1, p.color);
          }
        }

        if (justReleased && s.isCharging) {
          if (s.chargeTime >= 0.5) {
            s.boostTimer = 1.4;
            this.audio.playWhoosh();
            this.particles.emit(s.x, s.y, 10, p.color);
          }
          s.isCharging = false;
          s.chargeTime = 0;
        }
      }

      s.vx = Math.cos(s.angle) * baseSpeed;
      s.vy = Math.sin(s.angle) * baseSpeed;

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Arena walls bounce
      const minX = this.originX + 10;
      const maxX = this.originX + this.gridCols * this.tileW - 10;
      const minY = this.originY + 10;
      const maxY = this.originY + this.gridRows * this.tileH - 10;

      if (s.x <= minX || s.x >= maxX) {
        s.angle = Math.PI - s.angle;
        s.x = Math.max(minX, Math.min(maxX, s.x));
      }
      if (s.y <= minY || s.y >= maxY) {
        s.angle = -s.angle;
        s.y = Math.max(minY, Math.min(maxY, s.y));
      }

      // Paint floor under roller
      this.paintFloor(s);

      // Check power-up collection
      for (const pu of this.powerUps) {
        if (!pu.active) continue;
        const d = Math.hypot(s.x - pu.x, s.y - pu.y);
        if (d < 24) {
          pu.active = false;
          if (pu.type === 'MEGA_ROLLER') {
            s.megaTimer = 6.0;
            s.mood = 'triumph';
            s.moodTimer = 1.0;
            this.audio.playChime();
            this.particles.emit(pu.x, pu.y, 14, '#F59E0B');
          } else if (pu.type === 'PAINT_BOMB') {
            this.triggerPaintBomb(s, pu.x, pu.y);
          }
        }
      }
    }

    // Inter-skater elastic bumping with paint splatters!
    for (let i = 0; i < active.length; i++) {
      const s1 = this.skaters.get(active[i].id);
      if (!s1) continue;

      for (let j = i + 1; j < active.length; j++) {
        const s2 = this.skaters.get(active[j].id);
        if (!s2) continue;

        const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
        if (dist < 26 && dist > 0.001) {
          const bumpAngle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
          s1.angle = bumpAngle + Math.PI;
          s2.angle = bumpAngle;

          s1.mood = 'shocked';
          s1.moodTimer = 0.6;
          s2.mood = 'shocked';
          s2.moodTimer = 0.6;

          this.audio.playBounce();
          this.screenShake = 3;
          this.freezeFrames = 1;

          // Faster skater splatters paint around impact
          const splatX = (s1.x + s2.x) / 2;
          const splatY = (s1.y + s2.y) / 2;
          const winner = s1.boostTimer > s2.boostTimer ? s1 : s2;
          this.splatArea(winner.id, splatX, splatY, 32);
          this.particles.emit(splatX, splatY, 12, '#F59E0B');
        }
      }
    }

    this.recalculateScores();
  }

  private triggerPaintBomb(s: PainterSkater, x: number, y: number): void {
    this.audio.playExplosion();
    this.screenShake = 6;
    this.freezeFrames = 2;
    s.mood = 'triumph';
    s.moodTimer = 1.2;

    const pConfig = this.players.find((p) => p.id === s.id);
    this.particles.emit(x, y, 28, pConfig?.color || '#38BDF8');
    this.splatArea(s.id, x, y, 75);
  }

  private splatArea(ownerId: PlayerId, cx: number, cy: number, radius: number): void {
    const minC = Math.max(0, Math.floor((cx - radius - this.originX) / this.tileW));
    const maxC = Math.min(this.gridCols - 1, Math.floor((cx + radius - this.originX) / this.tileW));
    const minR = Math.max(0, Math.floor((cy - radius - this.originY) / this.tileH));
    const maxR = Math.min(this.gridRows - 1, Math.floor((cy + radius - this.originY) / this.tileH));

    for (let c = minC; c <= maxC; c++) {
      for (let r = minR; r <= maxR; r++) {
        const tX = this.originX + c * this.tileW + this.tileW / 2;
        const tY = this.originY + r * this.tileH + this.tileH / 2;
        if (Math.hypot(cx - tX, cy - tY) <= radius) {
          this.tileOwners[c][r] = ownerId;
        }
      }
    }
  }

  private paintFloor(s: PainterSkater): void {
    const rad = s.rollerWidth / 2;
    const minC = Math.max(0, Math.floor((s.x - rad - this.originX) / this.tileW));
    const maxC = Math.min(this.gridCols - 1, Math.floor((s.x + rad - this.originX) / this.tileW));
    const minR = Math.max(0, Math.floor((s.y - rad - this.originY) / this.tileH));
    const maxR = Math.min(this.gridRows - 1, Math.floor((s.y + rad - this.originY) / this.tileH));

    for (let c = minC; c <= maxC; c++) {
      for (let r = minR; r <= maxR; r++) {
        const tX = this.originX + c * this.tileW + this.tileW / 2;
        const tY = this.originY + r * this.tileH + this.tileH / 2;
        if (Math.hypot(s.x - tX, s.y - tY) <= rad) {
          this.tileOwners[c][r] = s.id;
        }
      }
    }
  }

  private recalculateScores(): void {
    const counts = new Map<PlayerId, number>();
    for (const p of this.getActivePlayers()) {
      counts.set(p.id, 0);
    }

    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const owner = this.tileOwners[c][r];
        if (owner !== null && counts.has(owner)) {
          counts.set(owner, (counts.get(owner) || 0) + 1);
        }
      }
    }

    for (const [pid, count] of counts.entries()) {
      const s = this.skaters.get(pid);
      if (s) {
        s.paintedTiles = count;
        s.score = Math.round((count / this.totalTiles) * 100);
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const s = this.skaters.get(botId);
    if (!s) return;

    s.botReactionTimer -= dt;
    if (s.botReactionTimer <= 0) {
      const baseDelay =
        difficulty === 'bot_easy' ? 0.36 : difficulty === 'bot_normal' ? 0.2 : 0.08;
      s.botReactionTimer = baseDelay;

      // Target active power-up or unpainted sector
      let targetX = s.x + Math.cos(s.angle) * 110;
      let targetY = s.y + Math.sin(s.angle) * 110;

      const activePowerUp = this.powerUps.find((p) => p.active);
      if (activePowerUp && Math.random() < 0.75) {
        targetX = activePowerUp.x;
        targetY = activePowerUp.y;
      }

      s.desiredAngle = Math.atan2(targetY - s.y, targetX - s.x);

      // Trigger Nitro boost when chasing power-up or in straightaway
      if (difficulty === 'bot_hard' && Math.random() < 0.35 && s.boostTimer <= 0) {
        s.boostTimer = 1.2;
      }
    }

    let diff = s.desiredAngle - s.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const turnRate = difficulty === 'bot_hard' ? 5.2 : difficulty === 'bot_normal' ? 3.8 : 2.5;
    s.angle += Math.sign(diff) * Math.min(Math.abs(diff), turnRate * dt);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeId];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Rink Floor with Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Unpainted Rink Area & Painted Tiles
    const rinkW = this.gridCols * this.tileW;
    const rinkH = this.gridRows * this.tileH;

    ctx.fillStyle = theme.unpaintedTile;
    ctx.fillRect(this.originX, this.originY, rinkW, rinkH);

    // Subtle tile grid lines
    ctx.strokeStyle = theme.gridLineColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(this.originX, this.originY, rinkW, rinkH);

    // Painted Tiles
    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const owner = this.tileOwners[c][r];
        if (owner !== null) {
          const pConfig = this.players.find((p) => p.id === owner);
          if (pConfig) {
            ctx.fillStyle = pConfig.color;
            ctx.fillRect(
              this.originX + c * this.tileW,
              this.originY + r * this.tileH,
              this.tileW + 0.6,
              this.tileH + 0.6
            );
          }
        }
      }
    }

    // Outer Rink Border
    ctx.strokeStyle = theme.rinkBorder;
    ctx.lineWidth = 3;
    ctx.strokeRect(this.originX, this.originY, rinkW, rinkH);

    // 3. Power-ups
    for (const pu of this.powerUps) {
      if (!pu.active) continue;
      const pulse = 1 + Math.sin(pu.pulseTimer) * 0.18;

      ctx.save();
      ctx.translate(pu.x, pu.y);
      ctx.scale(pulse, pulse);

      ctx.fillStyle = pu.type === 'MEGA_ROLLER' ? '#F59E0B' : '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Power-up icon badge
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pu.type === 'MEGA_ROLLER' ? '⚡' : '💣', 0, 4);

      ctx.restore();
    }

    // 4. Roller Skaters
    for (const p of this.getActivePlayers()) {
      const s = this.skaters.get(p.id);
      if (!s) continue;

      // Underdog golden aura
      if (this.isUnderdog(p.id)) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);

      // Roller bar behind skater
      ctx.fillStyle = s.megaTimer > 0 ? '#F59E0B' : p.colorDark;
      ctx.fillRect(-14, -s.rollerWidth / 2, 7, s.rollerWidth);

      // Skater Body (2.5D round torso with helmet)
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      // Visor / Helmet front
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(4, -5, 4, 10);

      // Roller Skate Wheels
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-6, -13, 5, 3.5);
      ctx.fillRect(-6, 9.5, 5, 3.5);

      // Nitro exhaust flames when boosting
      if (s.boostTimer > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(-14, -4);
        ctx.lineTo(-24 - Math.random() * 8, 0);
        ctx.lineTo(-14, 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore(); // Undo screen shake

    // 5. Header / Instruction Badge (Safe-zone: y: 56, h: 26)
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
      `${theme.icon} ${theme.name.toUpperCase()} • PAINT THE RINK`,
      width / 2,
      headerY + 17
    );

    // 6. Corner Player HUD Cards with CharacterRenderer Mascots
    // Offset bottom-left card above Theme Pill (y: height - 128)
    for (const p of this.getActivePlayers()) {
      const s = this.skaters.get(p.id);
      if (!s) continue;

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
      drawCharacter(ctx, cx + 22, cy + 33, 16, p.id, isBot, s.mood, this.animTimer);

      // Name & Score
      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 46, cy + 22);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${s.score}% turf`, cx + 46, cy + 40);

      ctx.fillStyle = s.megaTimer > 0 ? '#F59E0B' : '#10B981';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(s.megaTimer > 0 ? 'MEGA ROLLER ⚡' : `${s.paintedTiles} tiles`, cx + 46, cy + 56);
    }

    // 7. Interactive Theme Pill (Bottom-left: x: 20, y: height - 44, w: 170, h: 32)
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

    // 8. Control hints (Bottom-right: x: width - 20, y: height - 28)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Steer: Guide Skater | Hold Action: Nitro Boost', width - 20, height - 24);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.skaters.get(a.id)?.paintedTiles || 0;
      const sb = this.skaters.get(b.id)?.paintedTiles || 0;
      return sb - sa;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topPct = this.skaters.get(winnerId ?? 0)?.score || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.skaters.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Turf monarch! Covered ${topPct}% of the rink in vibrant paint across ${THEMES[this.currentThemeId].name}!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
  }

  public syncDebug(): Record<string, unknown> {
    return {
      theme: this.currentThemeId,
      roundTimer: this.roundTimer,
      suddenDeath: this.suddenDeathTriggered,
      skaters: Array.from(this.skaters.entries()).map(([id, s]) => ({
        id,
        score: s.score,
        paintedTiles: s.paintedTiles,
        isUnderdog: this.isUnderdog(id)
      }))
    };
  }
}
