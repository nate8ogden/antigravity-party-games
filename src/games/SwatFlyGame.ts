import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

export interface SwatTheme {
  name: string;
  tableColor: string;
  rimColor: string;
  clothBg: string;
  checkColorA: string;
  checkColorB: string;
  borderFringe: string;
}

export const SWAT_THEMES: SwatTheme[] = [
  {
    name: 'Picnic Table 🧺',
    tableColor: '#451A03',
    rimColor: '#78350F',
    clothBg: '#FFFFFF',
    checkColorA: 'rgba(239, 68, 68, 0.4)',
    checkColorB: 'rgba(185, 28, 28, 0.65)',
    borderFringe: '#FEE2E2'
  },
  {
    name: 'Diner Counter 🍔',
    tableColor: '#0F172A',
    rimColor: '#334155',
    clothBg: '#F8FAFC',
    checkColorA: 'rgba(15, 23, 42, 0.35)',
    checkColorB: 'rgba(15, 23, 42, 0.7)',
    borderFringe: '#38BDF8'
  },
  {
    name: 'Garden Patio 🌻',
    tableColor: '#1C1917',
    rimColor: '#292524',
    clothBg: '#F0FDF4',
    checkColorA: 'rgba(34, 197, 94, 0.35)',
    checkColorB: 'rgba(21, 128, 61, 0.65)',
    borderFringe: '#BBF7D0'
  }
];

interface Insect {
  id: number;
  type: 'fly' | 'golden_fly' | 'wasp';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: 'flying' | 'landed' | 'swatted';
  stateTimer: number;
  landDuration: number;
  flutterPhase: number;
  alive: boolean;
  points: number;
}

interface Swatter {
  id: PlayerId;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  score: number;
  combo: number;
  isSwatting: boolean;
  swatAnim: number; // 0 to 1
  hasHitThisSwat: boolean;
  stunTimer: number;
  isUnderdog: boolean;
}

export class SwatFlyGame extends BaseGame {
  public static readonly THEMES = SWAT_THEMES;
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  private insects: Insect[] = [];
  private swatters: Map<PlayerId, Swatter> = new Map();
  private nextInsectId: number = 1;
  private spawnCooldown: number = 0;
  private tableBounds = { x: 80, y: 80, w: 0, h: 0 };
  private targetScore: number = 8;
  private botReactionCooldowns: Map<PlayerId, number> = new Map();
  private suddenDeathFrenzy: boolean = false;

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __SWAT_FLY_DEBUG__?: unknown }).__SWAT_FLY_DEBUG__) {
      delete (window as unknown as { __SWAT_FLY_DEBUG__?: unknown }).__SWAT_FLY_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % SWAT_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = e.target as HTMLCanvasElement;
      if (!canvas || !canvas.getBoundingClientRect) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill is at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % SWAT_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.insects = [];
    this.swatters.clear();
    this.botReactionCooldowns.clear();
    this.spawnCooldown = 0.5;
    this.suddenDeathFrenzy = false;

    // Picnic table area
    this.tableBounds = {
      x: 90,
      y: 90,
      w: width - 180,
      h: height - 180
    };

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      let sx = this.tableBounds.x + 80;
      let sy = this.tableBounds.y + 80;
      if (idx === 1) {
        sx = this.tableBounds.x + this.tableBounds.w - 80;
      } else if (idx === 2) {
        sy = this.tableBounds.y + this.tableBounds.h - 80;
      } else if (idx === 3) {
        sx = this.tableBounds.x + this.tableBounds.w - 80;
        sy = this.tableBounds.y + this.tableBounds.h - 80;
      }

      this.swatters.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        targetX: sx,
        targetY: sy,
        score: 0,
        combo: 0,
        isSwatting: false,
        swatAnim: 0,
        hasHitThisSwat: false,
        stunTimer: 0,
        isUnderdog: false
      });
    });

    if (typeof window !== 'undefined') {
      (window as unknown as { __SWAT_FLY_DEBUG__?: unknown }).__SWAT_FLY_DEBUG__ = {
        getInsects: () => this.insects,
        getSwatters: () => Array.from(this.swatters.values()),
        spawnMovingFlyNear: (x: number, y: number) => {
          const ins: Insect = {
            id: this.nextInsectId++,
            type: 'fly',
            x,
            y,
            targetX: x + 100,
            targetY: y + 100,
            state: 'flying',
            stateTimer: 0,
            landDuration: 2.0,
            flutterPhase: 0,
            alive: true,
            points: 1
          };
          this.insects.push(ins);
          return ins;
        }
      };
    }

    for (let i = 0; i < 4; i++) {
      this.spawnInsect();
    }
  }

  private spawnInsect(forcedType?: 'fly' | 'golden_fly' | 'wasp'): void {
    const types: ('fly' | 'golden_fly' | 'wasp')[] = ['fly', 'fly', 'fly', 'golden_fly', 'wasp'];
    const type = forcedType || types[Math.floor(Math.random() * types.length)];
    const points = type === 'golden_fly' ? 3 : type === 'wasp' ? -2 : 1;

    const margin = 40;
    const tx = this.tableBounds.x + margin + Math.random() * (this.tableBounds.w - margin * 2);
    const ty = this.tableBounds.y + margin + Math.random() * (this.tableBounds.h - margin * 2);

    this.insects.push({
      id: this.nextInsectId++,
      type,
      x: Math.random() < 0.5 ? this.tableBounds.x - 20 : this.tableBounds.x + this.tableBounds.w + 20,
      y: this.tableBounds.y + Math.random() * this.tableBounds.h,
      targetX: tx,
      targetY: ty,
      state: 'flying',
      stateTimer: 0,
      landDuration: type === 'golden_fly' ? 1.4 : type === 'wasp' ? 2.5 : 2.0,
      flutterPhase: Math.random() * Math.PI * 2,
      alive: true,
      points
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Sudden Death Golden Super-Fly Frenzy at <= 15s
    if (this.roundTimer <= 15 && !this.suddenDeathFrenzy) {
      this.suddenDeathFrenzy = true;
      this.spawnInsect('golden_fly');
      this.spawnInsect('golden_fly');
      this.audio.playFanfare();
      this.particles.showFloatingText('🚨 GOLDEN SUPER-FLY FRENZY! 🚨', width / 2, height / 2 - 40, '#F59E0B', 24);
    }

    // Spawn new insects periodically
    this.spawnCooldown -= dt;
    const maxInsects = this.roundTimer <= 15 ? 8 : 6;
    if (this.spawnCooldown <= 0 && this.insects.filter((i) => i.alive).length < maxInsects) {
      this.spawnInsect();
      this.spawnCooldown = this.roundTimer <= 15 ? 0.7 : 1.0 + Math.random() * 1.5;
    }

    // Update Insects
    for (const ins of this.insects) {
      if (!ins.alive) continue;
      ins.flutterPhase += dt * 15;

      if (ins.state === 'flying') {
        const dx = ins.targetX - ins.x;
        const dy = ins.targetY - ins.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 10) {
          ins.state = 'landed';
          ins.stateTimer = ins.landDuration;
        } else {
          const speed = ins.type === 'golden_fly' ? 280 : ins.type === 'wasp' ? 160 : 210;
          ins.x += (dx / dist) * speed * dt + Math.sin(ins.flutterPhase) * 1.8;
          ins.y += (dy / dist) * speed * dt + Math.cos(ins.flutterPhase) * 1.8;
        }
      } else if (ins.state === 'landed') {
        ins.stateTimer -= dt;
        if (ins.stateTimer <= 0) {
          ins.state = 'flying';
          const margin = 40;
          ins.targetX = this.tableBounds.x + margin + Math.random() * (this.tableBounds.w - margin * 2);
          ins.targetY = this.tableBounds.y + margin + Math.random() * (this.tableBounds.h - margin * 2);
        }
      }
    }

    // Calculate max score for Underdog Surge
    let maxScore = 0;
    for (const sw of this.swatters.values()) {
      if (sw.score > maxScore) maxScore = sw.score;
    }

    // Process Swatters
    for (const sw of this.swatters.values()) {
      if (sw.stunTimer > 0) {
        sw.stunTimer -= dt;
      }

      sw.isUnderdog = maxScore >= 4 && sw.score <= maxScore - 3;
      const isBot = this.players[sw.id]?.type.startsWith('bot_');

      // Movement
      if (!isBot && sw.stunTimer <= 0) {
        const steerX = this.input.getSteer(sw.id);
        const steerY = -this.input.getThrottle(sw.id);
        const mag = Math.hypot(steerX, steerY);

        const moveSpeed = (sw.isUnderdog ? 440 : 380);
        if (mag > 0.08) {
          sw.x += (steerX / (mag > 1 ? mag : 1)) * moveSpeed * dt;
          sw.y += (steerY / (mag > 1 ? mag : 1)) * moveSpeed * dt;
        } else if (this.input.isPressed(sw.id)) {
          const nearest = this.insects
            .filter((i) => i.alive && i.type !== 'wasp')
            .sort((a, b) => Math.hypot(a.x - sw.x, a.y - sw.y) - Math.hypot(b.x - sw.x, b.y - sw.y))[0];
          if (nearest) {
            const dx = nearest.x - sw.x;
            const dy = nearest.y - sw.y;
            const d = Math.hypot(dx, dy);
            if (d > 10) {
              sw.x += (dx / d) * 260 * dt;
              sw.y += (dy / d) * 260 * dt;
            }
          }
        }
      }

      // Constrain inside picnic table
      const margin = 28;
      sw.x = Math.max(this.tableBounds.x + margin, Math.min(this.tableBounds.x + this.tableBounds.w - margin, sw.x));
      sw.y = Math.max(this.tableBounds.y + margin, Math.min(this.tableBounds.y + this.tableBounds.h - margin, sw.y));

      // Action tap to swat
      const justAction = this.input.justAction(sw.id);
      const justPressed = this.input.justPressed(sw.id);
      const pressed = (justAction || (justPressed && !this.input.getSteer(sw.id) && !this.input.getThrottle(sw.id))) && sw.stunTimer <= 0;

      if (pressed && !sw.isSwatting) {
        sw.isSwatting = true;
        sw.swatAnim = 0;
        sw.hasHitThisSwat = false;
        this.audio.playTap();
        this.checkSwatHit(sw);
      }

      if (sw.isSwatting) {
        sw.swatAnim += dt * 6.5;
        if (!sw.hasHitThisSwat && sw.swatAnim <= 0.65) {
          this.checkSwatHit(sw);
        }
        if (sw.swatAnim >= 1) {
          // If swung and missed completely, reset combo
          if (!sw.hasHitThisSwat && sw.combo > 0) {
            sw.combo = 0;
          }
          sw.isSwatting = false;
          sw.swatAnim = 0;
          sw.hasHitThisSwat = false;
        }
      }

      if (sw.score >= this.targetScore) {
        this.isFinished = true;
        this.audio.playFanfare();
      }
    }

    this.insects = this.insects.filter((i) => i.alive);

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private checkSwatHit(sw: Swatter): void {
    if (sw.hasHitThisSwat) return;
    const hitRadius = sw.isUnderdog ? 56 : 46;

    // Check shockwave collision against other swatters to shove them
    for (const other of this.swatters.values()) {
      if (other.id === sw.id) continue;
      const d = Math.hypot(other.x - sw.x, other.y - sw.y);
      if (d < hitRadius + 20) {
        const pushX = (other.x - sw.x) / (d || 1);
        const pushY = (other.y - sw.y) / (d || 1);
        other.x += pushX * 36;
        other.y += pushY * 36;
        other.stunTimer = 0.35;
        this.audio.playBounce();
        this.particles.showFloatingText('💥 SHOVED!', other.x, other.y - 20, '#EF4444', 16);
      }
    }

    for (const ins of this.insects) {
      if (!ins.alive) continue;

      const dist = Math.hypot(ins.x - sw.x, ins.y - sw.y);
      if (dist < hitRadius) {
        ins.alive = false;
        sw.hasHitThisSwat = true;
        const isMidair = ins.state === 'flying';

        if (ins.type === 'wasp') {
          // Stung! Breaks combo and costs points
          sw.combo = 0;
          sw.score = Math.max(0, sw.score - 2);
          sw.stunTimer = 1.6;
          this.audio.playExplosion();
          this.particles.showFloatingText('-2 PTS! STUNG! 🐝', sw.x, sw.y - 30, '#EF4444', 22);
          this.particles.spawnSparks(sw.x, sw.y, '#EF4444', 16);
          this.particles.addTrauma(0.3);
        } else if (ins.type === 'golden_fly') {
          // Golden Super-Fly
          sw.combo++;
          const comboMult = sw.combo >= 3 ? 2 : 1;
          const pts = 3 * comboMult;
          sw.score += pts;
          this.audio.playFanfare();
          const label = isMidair ? `+${pts} PTS! MID-AIR SUPER-FLY! 🌟` : `+${pts} PTS! GOLDEN FLY! 🌟`;
          this.particles.showFloatingText(label, sw.x, sw.y - 30, '#F59E0B', 24);
          this.particles.spawnSparks(sw.x, sw.y, '#FBBF24', 20);
        } else {
          // Regular fly
          sw.combo++;
          const comboMult = sw.combo >= 3 ? 2 : 1;
          const pts = 1 * comboMult;
          sw.score += pts;
          this.audio.playLaser();
          const label = comboMult > 1 ? `+${pts} PTS! (2X COMBO 🔥)` : isMidair ? '+1 PTS! MID-AIR SWAT! 🪰' : '+1 PTS! SQUASHED!';
          this.particles.showFloatingText(label, sw.x, sw.y - 30, '#10B981', 20);
          this.particles.spawnSparks(sw.x, sw.y, '#10B981', 14);
        }
        break;
      }
    }

    if (!sw.hasHitThisSwat && sw.swatAnim === 0) {
      this.particles.spawnSparks(sw.x, sw.y, 'rgba(255,255,255,0.4)', 6);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const sw = this.swatters.get(botId);
    if (!sw || sw.stunTimer > 0) return;

    let cd = (this.botReactionCooldowns.get(botId) || 0) - dt;
    this.botReactionCooldowns.set(botId, cd);

    const targetInsects = this.insects.filter((i) => i.alive);
    if (targetInsects.length === 0) return;

    const safeInsects = targetInsects.filter((i) => {
      if (i.type === 'wasp') {
        return difficulty === 'bot_easy' && Math.random() < 0.25;
      }
      return true;
    });

    if (safeInsects.length === 0) return;

    safeInsects.sort((a, b) => {
      const distA = Math.hypot(a.x - sw.x, a.y - sw.y) - (a.state === 'landed' ? 20 : 0);
      const distB = Math.hypot(b.x - sw.x, b.y - sw.y) - (b.state === 'landed' ? 20 : 0);
      return distA - distB;
    });
    const target = safeInsects[0];

    const moveSpeed = difficulty === 'bot_hard' ? 420 : difficulty === 'bot_normal' ? 320 : 220;
    const dx = target.x - sw.x;
    const dy = target.y - sw.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      sw.x += (dx / dist) * moveSpeed * dt;
      sw.y += (dy / dist) * moveSpeed * dt;
    }

    const swatRange = difficulty === 'bot_hard' ? 26 : difficulty === 'bot_normal' ? 30 : 36;
    if (dist < swatRange && cd <= 0) {
      const reactionDelay = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.26 : 0.45;
      this.botReactionCooldowns.set(botId, reactionDelay + 0.4);
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    const theme = SWAT_THEMES[this.currentThemeIndex];

    // 1. Table Backdrop
    ctx.fillStyle = theme.tableColor;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.rimColor;
    ctx.fillRect(12, 12, width - 24, height - 24);

    // 2. Checkered Tablecloth
    const tb = this.tableBounds;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = theme.clothBg;
    ctx.fillRect(tb.x, tb.y, tb.w, tb.h);
    ctx.restore();

    // Checkers
    const checkSize = 36;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tb.x, tb.y, tb.w, tb.h);
    ctx.clip();

    for (let cy = tb.y; cy < tb.y + tb.h; cy += checkSize) {
      for (let cx = tb.x; cx < tb.x + tb.w; cx += checkSize) {
        const isA = (Math.floor(cx / checkSize) + Math.floor(cy / checkSize)) % 2 === 0;
        if (isA) {
          ctx.fillStyle = theme.checkColorA;
          ctx.fillRect(cx, cy, checkSize, checkSize);
        }
      }
    }
    for (let cy = tb.y; cy < tb.y + tb.h; cy += checkSize) {
      for (let cx = tb.x; cx < tb.x + tb.w; cx += checkSize) {
        const isCross = (Math.floor(cx / checkSize) % 2 === 0) && (Math.floor(cy / checkSize) % 2 === 0);
        if (isCross) {
          ctx.fillStyle = theme.checkColorB;
          ctx.fillRect(cx, cy, checkSize, checkSize);
        }
      }
    }
    ctx.restore();

    ctx.strokeStyle = theme.borderFringe;
    ctx.lineWidth = 4;
    ctx.strokeRect(tb.x, tb.y, tb.w, tb.h);

    // 3. Render Insects
    for (const ins of this.insects) {
      if (!ins.alive) continue;
      ctx.save();

      const shadowDist = ins.state === 'flying' ? 14 : 3;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(ins.x, ins.y + shadowDist, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fluttering Wings
      const wingSpread = Math.sin(ins.flutterPhase) * (ins.state === 'flying' ? 8 : 4);
      ctx.fillStyle = ins.type === 'golden_fly' ? 'rgba(254, 240, 138, 0.85)' : ins.type === 'wasp' ? 'rgba(254, 240, 138, 0.65)' : 'rgba(226, 232, 240, 0.65)';
      ctx.beginPath();
      ctx.ellipse(ins.x - 7, ins.y - 4 + wingSpread, 7, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(ins.x + 7, ins.y - 4 + wingSpread, 7, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();

      if (ins.type === 'golden_fly') {
        // Golden Super-Fly with metallic body and red compound eyes
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(ins.x - 4, ins.y - 7, 8, 14, 4);
        else ctx.rect(ins.x - 4, ins.y - 7, 8, 14);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Head with red compound eyes
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.arc(ins.x, ins.y - 7, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(ins.x - 2.5, ins.y - 8, 2, 0, Math.PI * 2);
        ctx.arc(ins.x + 2.5, ins.y - 8, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (ins.type === 'wasp') {
        ctx.fillStyle = '#EAB308';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(ins.x - 4, ins.y - 8, 8, 16, 4);
        else ctx.rect(ins.x - 4, ins.y - 8, 8, 16);
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(ins.x - 4, ins.y - 4, 8, 2.5);
        ctx.fillRect(ins.x - 4, ins.y + 1, 8, 2.5);
        ctx.fillRect(ins.x - 4, ins.y + 5, 8, 2.5);
        ctx.beginPath();
        ctx.moveTo(ins.x - 2, ins.y + 8);
        ctx.lineTo(ins.x + 2, ins.y + 8);
        ctx.lineTo(ins.x, ins.y + 12);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(ins.x - 4, ins.y - 6, 8, 12, 4);
        else ctx.rect(ins.x - 4, ins.y - 6, 8, 12);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(ins.x - 2.5, ins.y - 5, 2, 0, Math.PI * 2);
        ctx.arc(ins.x + 2.5, ins.y - 5, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 4. Render Flyswatters
    for (const sw of this.swatters.values()) {
      ctx.save();
      const p = this.players[sw.id];
      const pColor = p?.color || '#FFFFFF';

      const slamScale = sw.isSwatting ? 1 - Math.sin(sw.swatAnim * Math.PI) * 0.25 : 1.0;
      const slamOffsetY = sw.isSwatting ? Math.sin(sw.swatAnim * Math.PI) * 12 : 0;

      ctx.translate(sw.x, sw.y + slamOffsetY);
      ctx.scale(slamScale, slamScale);

      if (sw.stunTimer > 0) {
        ctx.save();
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫 STUNNED!', 0, -50);
        ctx.restore();
      }

      // Underdog Electric Sparkle Glow
      if (sw.isUnderdog) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-28, -32, 56, 60);
        ctx.setLineDash([]);
      }

      const hoverElev = sw.isSwatting ? (1 - Math.sin(sw.swatAnim * Math.PI)) * 12 : 12;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-24 + hoverElev * 0.35, -28 + hoverElev, 48, 52, 8);
      else ctx.rect(-24 + hoverElev * 0.35, -28 + hoverElev, 48, 52);
      ctx.fill();

      // Swatter Handle
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-3, 24, 6, 44);
      ctx.fillStyle = pColor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-4, 48, 8, 22, 4);
      else ctx.rect(-4, 48, 8, 22);
      ctx.fill();

      // Swatter Mesh Head
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-24, -28, 48, 52, 8);
      else ctx.rect(-24, -28, 48, 52);
      ctx.fill();

      ctx.strokeStyle = pColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Mesh Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      for (let gx = -16; gx <= 16; gx += 8) {
        ctx.beginPath();
        ctx.moveTo(gx, -26);
        ctx.lineTo(gx, 22);
        ctx.stroke();
      }
      for (let gy = -20; gy <= 16; gy += 8) {
        ctx.beginPath();
        ctx.moveTo(-22, gy);
        ctx.lineTo(22, gy);
        ctx.stroke();
      }

      // Live Score & Combo Badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-34, -44, 68, 18, 9);
      else ctx.rect(-34, -44, 68, 18);
      ctx.fill();
      ctx.strokeStyle = sw.combo >= 3 ? '#F59E0B' : pColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = sw.combo >= 3 ? '#FBBF24' : '#FFFFFF';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const comboText = sw.combo >= 3 ? ` (${sw.combo}X)` : '';
      ctx.fillText(`${sw.score}/${this.targetScore}${comboText}`, 0, -35);

      ctx.restore();
    }

    // 5. Goal Banner HUD at y=56
    ctx.save();
    const pillW = 320;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;
    const isSuddenDeath = this.roundTimer <= 15;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FEF08A';
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isSuddenDeath) {
      ctx.fillText(`🚨 DRAGONFLY SWARM (3X PTS)! FIRST TO ${this.targetScore} 🚨`, width / 2, pillY + pillH / 2);
    } else {
      ctx.fillText(`SWAT FLIES (FIRST TO ${this.targetScore}) • WATCH FOR WASPS!`, width / 2, pillY + pillH / 2);
    }
    ctx.restore();

    // 6. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 170, 32, 16);
    else ctx.rect(20, height - 44, 170, 32);
    ctx.fill();
    ctx.strokeStyle = theme.borderFringe;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.borderFringe;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 85, height - 44 + 16);
    ctx.restore();

    // 7. Compact Controls Pill (Shifted right to avoid any overlap)
    ctx.save();
    const ctrlW = Math.min(380, width - 220);
    const ctrlH = 30;
    const ctrlX = Math.max(200, width - ctrlW - 20);
    const ctrlY = height - 43;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(ctrlX, ctrlY, ctrlW, ctrlH, 15);
    else ctx.rect(ctrlX, ctrlY, ctrlW, ctrlH);
    ctx.fill();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 9.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MOVE: WASD / ARROWS • SWAT: SPACE / ENTER', ctrlX + ctrlW / 2, ctrlY + ctrlH / 2);
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.swatters.values()).sort((a, b) => b.score - a.score);
    const winnerId = list.length > 0 ? list[0].id : null;
    return {
      winnerId,
      rankings: list.map((sw, idx) => ({ playerId: sw.id, score: sw.score, place: idx + 1 })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} swatted ${list[0].score} pests!` : 'Flies rule the picnic!'
    };
  }
}
