import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface FlyingFruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: 'watermelon' | 'golden_mango' | 'cyber_berry' | 'bomb';
  color: string;
  innerColor: string;
  rotation: number;
  rotSpeed: number;
  ownerId: PlayerId;
  sliced: boolean;
}

interface SlashTrail {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  alpha: number;
}

interface NinjaZone {
  id: PlayerId;
  name: string;
  color: string;
  colorLight: string;
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  combo: number;
  stunTimer: number;
  spawnTimer: number;
  bladeX: number;
  bladeY: number;
  botTimer: number;
}

export class SwipeNinjaBlitzGame extends BaseGame {
  private zones: NinjaZone[] = [];
  private fruits: FlyingFruit[] = [];
  private slashes: SlashTrail[] = [];
  private winnerId: PlayerId | null = null;
  private animTime: number = 0;

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
    this.roundTimer = 30.0;
    this.winnerId = null;
    this.animTime = 0;
    this.fruits = [];
    this.slashes = [];
    this.input.setControlMode('single_button');

    const active = this.getActivePlayers();
    this.zones = active.map((p, idx) => {
      const bounds = this.computeZoneBounds(idx, active.length, width, height);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        colorLight: p.colorLight,
        x: bounds.x,
        y: bounds.y,
        w: bounds.w,
        h: bounds.h,
        score: 0,
        combo: 0,
        stunTimer: 0,
        spawnTimer: 0.35 + idx * 0.15,
        bladeX: bounds.x + bounds.w / 2,
        bladeY: bounds.y + bounds.h / 2,
        botTimer: 0.2
      };
    });
  }

  private computeZoneBounds(idx: number, count: number, width: number, height: number) {
    const topMargin = 48;
    const availH = height - topMargin;
    if (count <= 2) {
      const zw = width / 2;
      return { x: idx * zw, y: topMargin, w: zw, h: availH };
    }
    const qw = width / 2;
    const qh = availH / 2;
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    return { x: col * qw, y: topMargin + row * qh, w: qw, h: qh };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    this.animTime += dt;
    this.updateBots(dt, width, height);

    const activeCount = this.zones.length;
    for (let i = 0; i < activeCount; i++) {
      const z = this.zones[i];
      const b = this.computeZoneBounds(i, activeCount, width, height);
      z.x = b.x;
      z.y = b.y;
      z.w = b.w;
      z.h = b.h;

      if (z.stunTimer > 0) {
        z.stunTimer = Math.max(0, z.stunTimer - dt);
      }

      z.spawnTimer -= dt;
      if (z.spawnTimer <= 0) {
        z.spawnTimer = 0.65 + Math.random() * 0.45;
        this.spawnFruitForZone(z);
      }

      // Check player swipe / tap action
      const tapped = this.input.justPressed(z.id) || this.input.justAction(z.id);
      if (tapped && z.stunTimer <= 0) {
        this.performKatanaSwipe(z);
      }
    }

    // Update flying fruits
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 320 * dt; // Gravity arc
      f.rotation += f.rotSpeed * dt;

      const z = this.zones.find((zn) => zn.id === f.ownerId);
      if (!z || f.y > z.y + z.h + 30) {
        if (z && !f.sliced && f.kind !== 'bomb') {
          z.combo = 0;
        }
        this.fruits.splice(i, 1);
      }
    }

    // Update slash trails
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].alpha -= dt * 3.8;
      if (this.slashes[i].alpha <= 0) {
        this.slashes.splice(i, 1);
      }
    }

    // Check 25-point target or round timer
    for (const z of this.zones) {
      if (z.score >= 25) {
        this.winnerId = z.id;
        this.isFinished = true;
        return;
      }
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      const sorted = [...this.zones].sort((a, b) => b.score - a.score);
      if (sorted.length > 0 && (sorted.length === 1 || sorted[0].score > sorted[1].score)) {
        this.winnerId = sorted[0].id;
      }
      this.isFinished = true;
    }
  }

  private spawnFruitForZone(z: NinjaZone): void {
    const roll = Math.random();
    let kind: FlyingFruit['kind'] = 'watermelon';
    let color = '#22C55E';
    let innerColor = '#EF4444';
    let radius = 20;

    if (roll < 0.18) {
      kind = 'bomb';
      color = '#1E293B';
      innerColor = '#EF4444';
      radius = 19;
    } else if (roll < 0.36) {
      kind = 'golden_mango';
      color = '#F59E0B';
      innerColor = '#FDE047';
      radius = 18;
    } else if (roll < 0.65) {
      kind = 'cyber_berry';
      color = '#06B6D4';
      innerColor = '#A855F7';
      radius = 19;
    }

    const startX = z.x + z.w * (0.2 + Math.random() * 0.6);
    const startY = z.y + z.h - 12;
    const targetX = z.x + z.w * 0.5 + (Math.random() - 0.5) * (z.w * 0.35);
    const peakH = z.h * (0.58 + Math.random() * 0.24);
    const vy = -Math.sqrt(2 * 320 * peakH);
    const flightTime = Math.abs(vy / 320);
    const vx = (targetX - startX) / Math.max(0.4, flightTime);

    this.fruits.push({
      x: startX,
      y: startY,
      vx,
      vy,
      radius,
      kind,
      color,
      innerColor,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 6,
      ownerId: z.id,
      sliced: false
    });
  }

  private performKatanaSwipe(z: NinjaZone): void {
    this.audio.playWhoosh();
    const myFruits = this.fruits.filter((f) => f.ownerId === z.id && !f.sliced);

    // Prioritize ripe fruits near apex; if only a bomb is near center, risk hitting it!
    const goodFruits = myFruits.filter((f) => f.kind !== 'bomb' && f.y < z.y + z.h - 28);
    const bombs = myFruits.filter((f) => f.kind === 'bomb' && f.y < z.y + z.h * 0.65);

    if (goodFruits.length > 0) {
      let slicedCount = 0;
      for (const f of goodFruits.slice(0, 3)) {
        f.sliced = true;
        slicedCount++;
        const pts = f.kind === 'golden_mango' ? 3 : 1;
        z.score += pts;
        z.combo++;
        this.slashes.push({
          x1: f.x - 36,
          y1: f.y + 22,
          x2: f.x + 36,
          y2: f.y - 22,
          color: z.colorLight,
          alpha: 1.0
        });
        this.particles.spawnExplosion(f.x, f.y, f.innerColor, 14);
        this.particles.showFloatingText(
          pts > 1 ? `🥭 GOLDEN SLICE! +${pts}` : `⚔️ +${pts}`,
          f.x,
          f.y - 14,
          pts > 1 ? '#FDE047' : z.colorLight,
          16
        );
      }
      if (slicedCount >= 2) {
        z.score += 1;
        this.audio.playChime();
        this.particles.showFloatingText(`🔥 ${slicedCount}X COMBO BLITZ! +1`, z.x + z.w / 2, z.y + z.h * 0.35, '#FBBF24', 18);
      } else {
        this.audio.playSpike();
      }
    } else if (bombs.length > 0) {
      const b = bombs[0];
      b.sliced = true;
      z.score = Math.max(0, z.score - 2);
      z.combo = 0;
      z.stunTimer = 0.9;
      this.audio.playExplosion();
      this.particles.spawnExplosion(b.x, b.y, '#EF4444', 24);
      this.particles.shake(0.4);
      this.particles.showFloatingText('💣 BOMB SLICED! -2', b.x, b.y - 16, '#EF4444', 18);
    } else {
      // Empty air slash visual
      const cx = z.x + z.w / 2;
      const cy = z.y + z.h / 2;
      this.slashes.push({
        x1: cx - 40,
        y1: cy + 20,
        x2: cx + 40,
        y2: cy - 20,
        color: '#94A3B8',
        alpha: 0.7
      });
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const z = this.zones.find((zn) => zn.id === botId);
    if (!z || z.stunTimer > 0) return;

    z.botTimer -= dt;
    if (z.botTimer > 0) return;

    const delay = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.32 : 0.52;
    z.botTimer = delay + Math.random() * 0.15;

    const hasGoodFruit = this.fruits.some(
      (f) => f.ownerId === botId && !f.sliced && f.kind !== 'bomb' && f.y < z.y + z.h * 0.72
    );
    if (hasGoodFruit) {
      this.input.triggerBotPress(botId);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    // Render each player's dojo slicing quadrant
    for (const z of this.zones) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(z.x, z.y, z.w, z.h);
      ctx.clip();

      const grad = ctx.createLinearGradient(z.x, z.y, z.x, z.y + z.h);
      grad.addColorStop(0, '#0F172A');
      grad.addColorStop(1, z.stunTimer > 0 ? '#450A0A' : '#1E293B');
      ctx.fillStyle = grad;
      ctx.fillRect(z.x, z.y, z.w, z.h);

      // Zone border
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(z.x + 2, z.y + 2, z.w - 4, z.h - 4);

      // Score & Combo Banner
      ctx.fillStyle = z.colorLight;
      ctx.font = '900 14px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${z.name}: ${z.score}/25`, z.x + 12, z.y + 24);

      if (z.combo >= 2) {
        ctx.fillStyle = '#FBBF24';
        ctx.font = '800 11px Montserrat, sans-serif';
        ctx.fillText(`🔥 ${z.combo}x STREAK`, z.x + 12, z.y + 42);
      }

      if (z.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = '900 15px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💥 STUNNED!', z.x + z.w / 2, z.y + z.h / 2);
      }

      ctx.restore();
    }

    // Render flying fruits & bombs
    for (const f of this.fruits) {
      if (f.sliced) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      ctx.beginPath();
      ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, f.radius * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = f.innerColor;
      ctx.fill();

      if (f.kind === 'bomb') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', 0, 1);
      }
      ctx.restore();
    }

    // Render katana slash arcs
    for (const s of this.slashes) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 5;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.zones].sort((a, b) => b.score - a.score);
    const rankings = sorted.map((z, idx) => ({
      playerId: z.id,
      score: z.score,
      place: idx + 1
    }));
    const top = sorted[0];
    const isTie = sorted.length > 1 && sorted[0].score === sorted[1].score && this.winnerId === null;
    const winnerId = isTie ? null : (this.winnerId ?? top?.id ?? null);

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} sliced ${top.score} targets!` : 'Ninja Blade Tie!'
    };
  }
}
