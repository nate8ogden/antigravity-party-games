import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type ArcherThemeId = 'citadel' | 'cyber' | 'frost';

interface ArcherTheme {
  id: ArcherThemeId;
  name: string;
  icon: string;
  fieldColor: string;
  fieldGrid: string;
  wallColor: string;
  wallTrim: string;
  arrowGlow: string;
  accentColor: string;
}

const THEMES: Record<ArcherThemeId, ArcherTheme> = {
  citadel: {
    id: 'citadel',
    name: 'Sunfire Citadel',
    icon: '🏰',
    fieldColor: '#166534',
    fieldGrid: 'rgba(255, 255, 255, 0.05)',
    wallColor: '#334155',
    wallTrim: '#E2E8F0',
    arrowGlow: '#F59E0B',
    accentColor: '#FBBF24'
  },
  cyber: {
    id: 'cyber',
    name: 'Neon Bastion',
    icon: '⚡',
    fieldColor: '#090D16',
    fieldGrid: 'rgba(6, 182, 212, 0.1)',
    wallColor: '#1E1B4B',
    wallTrim: '#06B6D4',
    arrowGlow: '#38BDF8',
    accentColor: '#06B6D4'
  },
  frost: {
    id: 'frost',
    name: 'Winterfell Fortress',
    icon: '❄️',
    fieldColor: '#1E293B',
    fieldGrid: 'rgba(186, 230, 253, 0.08)',
    wallColor: '#0F172A',
    wallTrim: '#38BDF8',
    arrowGlow: '#7DD3FC',
    accentColor: '#BAE6FD'
  }
};

const THEME_ORDER: ArcherThemeId[] = ['citadel', 'cyber', 'frost'];

interface Arrow {
  id: number;
  shooterId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  isFireArrow: boolean;
  pierceRemaining: number;
  trail: { x: number; y: number }[];
}

type InvaderType = 'goblin' | 'shield_bearer' | 'ram' | 'thief';

interface Invader {
  id: number;
  type: InvaderType;
  x: number;
  y: number;
  speed: number;
  health: number;
  maxHealth: number;
  radius: number;
  points: number;
  isHit: boolean;
  hitAnim: number;
  wiggle: number;
}

interface ArcherPlayer {
  id: PlayerId;
  x: number;
  y: number;
  aimAngle: number;
  chargeTime: number; // 0 to 1
  isDrawing: boolean;
  cooldown: number;
  score: number;
  hits: number;
  combo: number;
  arrowsShot: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class CastleArcherGame extends BaseGame {
  public playersState: Map<PlayerId, ArcherPlayer> = new Map();
  public arrows: Arrow[] = [];
  public invaders: Invader[] = [];
  public currentTheme: ArcherThemeId = 'citadel';

  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private arrowIdCounter: number = 0;
  private invaderIdCounter: number = 0;
  private spawnTimer: number = 0.5;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private lastHeight: number = 600;
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
          this.setTheme('citadel');
        } else if (e.key === '2') {
          this.setTheme('cyber');
        } else if (e.key === '3') {
          this.setTheme('frost');
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

  public setTheme(theme: ArcherThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentColor, 16);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.arrows = [];
    this.invaders = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.spawnTimer = 0.4;
    this.lastHeight = height;

    const active = this.getActivePlayers();
    const spacing = width / (active.length + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: 110, // Standing along fortified parapet walkway at y: 110
        aimAngle: Math.PI / 2, // Aiming downward toward the invasion field
        chargeTime: 0,
        isDrawing: false,
        cooldown: 0,
        score: 0,
        hits: 0,
        combo: 0,
        arrowsShot: 0,
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

    // Spawn invaders advancing upward towards the castle
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (isSuddenDeath ? 0.35 : 0.55) + Math.random() * 0.25;
      const roll = Math.random();
      let type: InvaderType = 'goblin';
      let hp = 1;
      let spd = isSuddenDeath ? 75 : 55;
      let pts = 80;
      let rad = 14;

      if (roll < 0.15) {
        type = 'thief';
        hp = 1;
        spd = isSuddenDeath ? 120 : 95;
        pts = 300;
        rad = 12;
      } else if (roll < 0.40) {
        type = 'ram';
        hp = 3;
        spd = isSuddenDeath ? 50 : 38;
        pts = 240;
        rad = 22;
      } else if (roll < 0.70) {
        type = 'shield_bearer';
        hp = 2;
        spd = isSuddenDeath ? 65 : 48;
        pts = 150;
        rad = 16;
      }

      this.invaders.push({
        id: this.invaderIdCounter++,
        type,
        x: 60 + Math.random() * (width - 120),
        y: height + 20,
        speed: spd,
        health: hp,
        maxHealth: hp,
        radius: rad,
        points: pts,
        isHit: false,
        hitAnim: 0,
        wiggle: Math.random() * Math.PI * 2
      });
    }

    // Move invaders upward
    for (let i = this.invaders.length - 1; i >= 0; i--) {
      const inv = this.invaders[i];
      inv.y -= inv.speed * dt;
      inv.wiggle += dt * 8;

      if (inv.hitAnim > 0) {
        inv.hitAnim = Math.max(0, inv.hitAnim - dt * 4.0);
      }

      // If invader reaches castle battlement wall (y: 135)
      if (inv.y <= 135) {
        this.particles.shake(5);
        this.audio.playExplosion();
        this.particles.spawnExplosion(inv.x, 135, '#EF4444', 16);
        this.invaders.splice(i, 1);
      }
    }

    // Update archer players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.cooldown > 0) ps.cooldown -= dt;
      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) ps.currentMood = 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Aim rotation
      if (steer !== 0) {
        ps.aimAngle += steer * 2.4 * dt;
        ps.aimAngle = Math.max(Math.PI * 0.12, Math.min(Math.PI * 0.88, ps.aimAngle));
      }

      // Hold-to-Charge Bowstring Draw
      if (isAction && ps.cooldown <= 0) {
        ps.isDrawing = true;
        const chargeRate = ps.isUnderdog ? 2.6 : 2.0;
        ps.chargeTime = Math.min(1.0, ps.chargeTime + dt * chargeRate);

        if (ps.chargeTime >= 0.8 && Math.random() < 0.25) {
          this.particles.spawnSparks(
            ps.x + Math.cos(ps.aimAngle) * 20,
            ps.y + Math.sin(ps.aimAngle) * 20,
            '#F59E0B',
            1
          );
        }
      } else if (ps.isDrawing || justReleased) {
        // Release arrow!
        const isFire = ps.chargeTime >= 0.8;
        const arrowSpeed = 500 + ps.chargeTime * 350;
        ps.isDrawing = false;
        ps.cooldown = ps.isUnderdog ? 0.18 : 0.24;
        ps.arrowsShot += 1;

        this.arrows.push({
          id: this.arrowIdCounter++,
          shooterId: ps.id,
          x: ps.x,
          y: ps.y + 14,
          vx: Math.cos(ps.aimAngle) * arrowSpeed,
          vy: Math.sin(ps.aimAngle) * arrowSpeed,
          angle: ps.aimAngle,
          isFireArrow: isFire,
          pierceRemaining: isFire ? 3 : 1,
          trail: []
        });

        if (isFire) {
          this.audio.playExplosion();
          this.particles.spawnSparks(ps.x, ps.y + 14, '#F59E0B', 12);
        } else {
          this.audio.playLaser();
          this.particles.spawnSparks(ps.x, ps.y + 14, THEMES[this.currentTheme].accentColor, 5);
        }

        ps.chargeTime = 0;
      }
    }

    // Update arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.angle = Math.atan2(a.vy, a.vx);

      a.trail.push({ x: a.x, y: a.y });
      if (a.trail.length > 8) a.trail.shift();

      let destroyArrow = false;
      const shooter = this.playersState.get(a.shooterId);

      // Check collision with invaders
      for (let j = this.invaders.length - 1; j >= 0; j--) {
        const inv = this.invaders[j];
        const dist = Math.hypot(inv.x - a.x, inv.y - a.y);

        if (dist < inv.radius + 8) {
          const dmg = a.isFireArrow ? 2 : 1;
          inv.health -= dmg;
          inv.hitAnim = 1.0;
          a.pierceRemaining -= 1;

          if (inv.health <= 0) {
            // Invader vanquished!
            if (shooter) {
              shooter.combo += 1;
              const comboBonus = Math.min(4, 1 + Math.floor(shooter.combo / 3));
              const pts = inv.points * comboBonus * (isSuddenDeath ? 2 : 1);
              shooter.score += pts;
              shooter.hits += 1;
              shooter.currentMood = 'happy';
              shooter.moodTimer = 1.5;
            }
            this.audio.playScore();
            this.particles.shake(3);
            this.particles.spawnExplosion(inv.x, inv.y, inv.type === 'thief' ? '#F59E0B' : '#10B981', 18);
            this.invaders.splice(j, 1);
          } else {
            // Deflected by shield
            this.audio.playBounce();
            this.particles.spawnSparks(a.x, a.y, '#94A3B8', 10);
          }

          if (a.pierceRemaining <= 0) {
            destroyArrow = true;
            break;
          }
        }
      }

      // Out of bounds
      if (destroyArrow || a.y > height + 30 || a.x < -30 || a.x > width + 30) {
        if (!destroyArrow && shooter && a.y > height + 20) {
          shooter.combo = 0; // Reset combo on whiff
        }
        this.arrows.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
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
    if (!bot) return;

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

    if (this.invaders.length === 0) return;

    // Pick target invader
    const sorted = [...this.invaders].sort((a, b) => {
      if (difficulty === 'bot_hard') {
        // Prioritize thief goblins or nearest battering ram
        if (a.type === 'thief' && b.type !== 'thief') return -1;
        if (b.type === 'thief' && a.type !== 'thief') return 1;
      }
      return a.y - b.y; // Closest to castle wall
    });

    const target = sorted[0];
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    let targetAngle = Math.atan2(dy, dx);

    if (difficulty === 'bot_easy') {
      targetAngle += (Math.random() - 0.5) * 0.32;
    }

    const angleDiff = targetAngle - bot.aimAngle;
    let steer = 0;
    let action = false;

    if (Math.abs(angleDiff) > 0.08) {
      steer = Math.sign(angleDiff);
    } else if (bot.cooldown <= 0) {
      action = true; // Draw and shoot
    }

    this.input.setBotInput(botId, action, steer, 0, action);
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

    const topHits = scores[0]?.hits || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} defended the parapets with ${topHits} clean archery hits!`
      : 'The battlements held firm against all invaders!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastHeight = height;
    const theme = THEMES[this.currentTheme];

    // 1. Grassy / Cyber Battlefield Ground
    ctx.fillStyle = theme.fieldColor;
    ctx.fillRect(0, 0, width, height);

    // Stone flagstone grid on ground
    ctx.strokeStyle = theme.fieldGrid;
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, 135);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 135; y < height; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Castle Stone Wall & Crenellations (y: 84 to 135)
    ctx.fillStyle = theme.wallColor;
    ctx.fillRect(0, 84, width, 50);

    ctx.strokeStyle = theme.wallTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 134);
    ctx.lineTo(width, 134);
    ctx.stroke();

    // Crenellations along outer wall lip
    ctx.fillStyle = theme.wallColor;
    for (let cx = 15; cx < width; cx += 45) {
      ctx.fillRect(cx, 130, 25, 12);
      ctx.strokeStyle = theme.wallTrim;
      ctx.strokeRect(cx, 130, 25, 12);
    }

    // 3. Render Invaders
    for (const inv of this.invaders) {
      ctx.save();
      ctx.translate(inv.x, inv.y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 6, inv.radius, inv.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const wiggleX = Math.sin(inv.wiggle) * 2;

      if (inv.type === 'ram') {
        // Armored Battering Ram
        ctx.fillStyle = '#78350F';
        ctx.fillRect(-18 + wiggleX, -10, 36, 20);
        ctx.fillStyle = '#94A3B8';
        ctx.beginPath();
        ctx.arc(wiggleX, -12, 10, 0, Math.PI * 2);
        ctx.fill();
        // Spikes
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-14 + wiggleX, -18, 4, 8);
        ctx.fillRect(10 + wiggleX, -18, 4, 8);
      } else if (inv.type === 'shield_bearer') {
        // Armored Orc
        ctx.fillStyle = '#065F46';
        ctx.beginPath();
        ctx.arc(wiggleX, 0, inv.radius, 0, Math.PI * 2);
        ctx.fill();
        // Wooden / Iron Shield
        ctx.fillStyle = '#64748B';
        ctx.fillRect(-14 + wiggleX, -14, 28, 8);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-3 + wiggleX, -13, 6, 6);
      } else if (inv.type === 'thief') {
        // Golden Thief Goblin
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(wiggleX, 0, inv.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-3 + wiggleX, -2, 2.5, 0, Math.PI * 2);
        ctx.arc(3 + wiggleX, -2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Treasure bag
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(wiggleX, 8, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Goblin runner
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(wiggleX, 0, inv.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(-4 + wiggleX, -2, 2, 0, Math.PI * 2);
        ctx.arc(4 + wiggleX, -2, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Health bar if damaged
      if (inv.health < inv.maxHealth) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(-12, -inv.radius - 8, 24, 4);
        ctx.fillStyle = '#10B981';
        ctx.fillRect(-12, -inv.radius - 8, 24 * (inv.health / inv.maxHealth), 4);
      }

      ctx.restore();
    }

    // 4. Render Arrows
    for (const a of this.arrows) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);

      // Fire Arrow Glow
      if (a.isFireArrow) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();

        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(10, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = theme.arrowGlow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();

        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(4, -4);
        ctx.lineTo(4, 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    // 5. Render Archer Players on Parapet Walkway
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const isBot = cfg ? cfg.type !== 'human' : false;

      ctx.save();
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
        ps.chargeTime * 4,
        undefined
      );

      // Longbow Aim & String
      ctx.save();
      ctx.rotate(ps.aimAngle);

      // Bow limb
      ctx.strokeStyle = ps.isUnderdog ? '#F59E0B' : '#B45309';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 18, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();

      // String pull back
      const pullBack = ps.chargeTime * 10;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(-Math.PI / 3) * 18, Math.sin(-Math.PI / 3) * 18);
      ctx.lineTo(-pullBack, 0);
      ctx.lineTo(Math.cos(Math.PI / 3) * 18, Math.sin(Math.PI / 3) * 18);
      ctx.stroke();

      // Fire aura if full charge
      if (ps.chargeTime >= 0.8) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(14, 0, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Combo or Underdog label
      if (ps.isUnderdog) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑 SURGE', 0, -26);
      } else if (ps.combo > 1) {
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 11px "Chakra Petch", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${ps.combo}x COMBO`, 0, -24);
      }

      ctx.restore();
    }

    // 6. Safe UI & Theme Pill
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
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? '🔥 SUDDEN DEATH! 2X SCORE & SIEGE CATAPULTS'
      : 'HOLD ACTION TO DRAW BOW • AIM WITH [A/D]';
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
    ctx.strokeStyle = theme.accentColor;
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
    ctx.fillText('Hold [Space/Action]: Draw Bow | [A/D / Stick]: Aim Arc', width - 20, height - 14);

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
      arrowsTotal: this.arrows.length,
      invadersTotal: this.invaders.length,
      roundTimer: this.roundTimer,
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        score: p.score,
        hits: p.hits,
        combo: p.combo,
        isUnderdog: p.isUnderdog,
        chargeTime: Math.round(p.chargeTime * 100)
      }))
    };
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    this.arrows = [];
    this.invaders = [];
    this.playersState.clear();
  }
}
