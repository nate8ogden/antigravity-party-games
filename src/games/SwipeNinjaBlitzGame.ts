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

interface SlicedHalf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  innerColor: string;
  angle: number;
  vRot: number;
  side: 1 | -1;
  alpha: number;
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
  prevBladeX: number;
  prevBladeY: number;
  bladeActive: boolean;
  botTimer: number;
}

export class SwipeNinjaBlitzGame extends BaseGame {
  private zones: NinjaZone[] = [];
  private fruits: FlyingFruit[] = [];
  private halves: SlicedHalf[] = [];
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
    this.roundTimer = 35.0;
    this.winnerId = null;
    this.animTime = 0;
    this.fruits = [];
    this.halves = [];
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
        spawnTimer: 0.35 + idx * 0.12,
        bladeX: bounds.x + bounds.w / 2,
        bladeY: bounds.y + bounds.h / 2,
        prevBladeX: bounds.x + bounds.w / 2,
        prevBladeY: bounds.y + bounds.h / 2,
        bladeActive: false,
        botTimer: 0.2
      };
    });
  }

  private computeZoneBounds(idx: number, count: number, width: number, height: number) {
    const topMargin = 48;
    const availH = height - topMargin;
    if (count === 1) {
      return { x: 0, y: topMargin, w: width, h: availH };
    }
    if (count === 2) {
      if (this.input.deviceMode === 'phone' || height > width) {
        // Phone 2P Face-to-Face: Top Half = Player 2 (idx 1), Bottom Half = Player 1 (idx 0)
        const zh = availH / 2;
        const row = idx === 0 ? 1 : 0;
        return { x: 0, y: topMargin + row * zh, w: width, h: zh };
      }
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

    const rawTouches = this.input.getAllActiveTouches();
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
        z.spawnTimer = 0.52 + Math.random() * 0.38;
        // Spawn 1 or 2 fruits per wave for exciting multi-slice combos!
        const waveCount = Math.random() < 0.42 ? 2 : 1;
        for (let w = 0; w < waveCount; w++) {
          this.spawnFruitForZone(z);
        }
      }

      // 1. Direct Finger-Swipe Katana Blade Tracking (matches touch in zone or assigned pid)
      const isBot = this.players.find((p) => p.id === z.id)?.type.startsWith('bot_') ?? false;
      let matchingTouch = rawTouches.find(
        (t) => t.x >= z.x && t.x <= z.x + z.w && t.y >= z.y && t.y <= z.y + z.h
      );
      if (!matchingTouch && !isBot) {
        matchingTouch = rawTouches.find((t) => t.pid === z.id);
      }

      if (matchingTouch && !isBot && z.stunTimer <= 0) {
        // Clamp touch position into zone if using remote zone
        const tx = Math.max(z.x + 12, Math.min(z.x + z.w - 12, matchingTouch.x));
        const ty = Math.max(z.y + 12, Math.min(z.y + z.h - 12, matchingTouch.y));
        if (!z.bladeActive) {
          z.bladeActive = true;
          z.prevBladeX = tx;
          z.prevBladeY = ty;
        } else {
          z.prevBladeX = z.bladeX;
          z.prevBladeY = z.bladeY;
        }
        z.bladeX = tx;
        z.bladeY = ty;

        const moveDist = Math.hypot(z.bladeX - z.prevBladeX, z.bladeY - z.prevBladeY);
        if (moveDist > 3) {
          this.slashes.push({
            x1: z.prevBladeX,
            y1: z.prevBladeY,
            x2: z.bladeX,
            y2: z.bladeY,
            color: z.colorLight,
            alpha: 0.95
          });
        }
        // Check continuous blade intersection against all unsliced fruits in this dojo
        this.sliceFruitsNearSegment(z, z.prevBladeX, z.prevBladeY, z.bladeX, z.bladeY);
      } else {
        z.bladeActive = false;
      }

      // 2. Tap / Keyboard / Gamepad Katana Sweep Slash
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
      f.vy += 320 * dt;
      f.rotation += f.rotSpeed * dt;

      const z = this.zones.find((zn) => zn.id === f.ownerId);
      if (!z || f.y > z.y + z.h + 30) {
        if (z && !f.sliced && f.kind !== 'bomb') {
          z.combo = 0;
        }
        this.fruits.splice(i, 1);
      }
    }

    // Update sliced fruit halves
    for (let i = this.halves.length - 1; i >= 0; i--) {
      const h = this.halves[i];
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.vy += 420 * dt;
      h.angle += h.vRot * dt;
      h.alpha -= dt * 1.4;
      if (h.alpha <= 0) {
        this.halves.splice(i, 1);
      }
    }

    // Update slash trails
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].alpha -= dt * 3.8;
      if (this.slashes[i].alpha <= 0) {
        this.slashes.splice(i, 1);
      }
    }

    // Check 30-point target or round timer
    for (const z of this.zones) {
      if (z.score >= 30) {
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

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.001) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  private sliceFruitsNearSegment(z: NinjaZone, x1: number, y1: number, x2: number, y2: number): void {
    const myFruits = this.fruits.filter((f) => f.ownerId === z.id && !f.sliced);
    let slicedCount = 0;

    for (const f of myFruits) {
      const d = this.distToSegment(f.x, f.y, x1, y1, x2, y2);
      if (d <= f.radius + 26) {
        if (f.kind === 'bomb') {
          // Only trigger bomb if directly hit within radius + 8
          if (d <= f.radius + 8) {
            this.triggerBombHit(z, f);
            return;
          }
          continue;
        }
        this.sliceSingleFruit(z, f);
        slicedCount++;
      }
    }

    if (slicedCount >= 2) {
      z.score += 1;
      this.audio.playChime();
      this.particles.showFloatingText(`🔥 ${slicedCount}X SWIPE BLITZ! +1`, z.x + z.w / 2, z.y + z.h * 0.35, '#FBBF24', 18);
    } else if (slicedCount === 1) {
      this.audio.playSpike();
    }
  }

  private sliceSingleFruit(z: NinjaZone, f: FlyingFruit): void {
    f.sliced = true;
    const pts = f.kind === 'golden_mango' ? 3 : 1;
    z.score += pts;
    z.combo++;

    // Spawn 2 flying sliced halves!
    for (const side of [-1, 1] as const) {
      this.halves.push({
        x: f.x + side * 6,
        y: f.y,
        vx: f.vx + side * (75 + Math.random() * 45),
        vy: f.vy - 60,
        radius: f.radius,
        color: f.color,
        innerColor: f.innerColor,
        angle: f.rotation,
        vRot: side * (4 + Math.random() * 4),
        side,
        alpha: 1.0
      });
    }

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

  private triggerBombHit(z: NinjaZone, b: FlyingFruit): void {
    b.sliced = true;
    z.score = Math.max(0, z.score - 2);
    z.combo = 0;
    z.stunTimer = 0.85;
    this.audio.playExplosion();
    this.particles.spawnExplosion(b.x, b.y, '#EF4444', 24);
    this.particles.shake(0.35);
    this.particles.showFloatingText('💣 BOMB SLICED! -2', b.x, b.y - 16, '#EF4444', 18);
  }

  private spawnFruitForZone(z: NinjaZone): void {
    const roll = Math.random();
    let kind: FlyingFruit['kind'] = 'watermelon';
    let color = '#22C55E';
    let innerColor = '#EF4444';
    let radius = 21;

    if (roll < 0.16) {
      kind = 'bomb';
      color = '#1E293B';
      innerColor = '#EF4444';
      radius = 19;
    } else if (roll < 0.35) {
      kind = 'golden_mango';
      color = '#F59E0B';
      innerColor = '#FDE047';
      radius = 19;
    } else if (roll < 0.65) {
      kind = 'cyber_berry';
      color = '#06B6D4';
      innerColor = '#A855F7';
      radius = 20;
    }

    const startX = z.x + z.w * (0.18 + Math.random() * 0.64);
    const startY = z.y + z.h - 12;
    const targetX = z.x + z.w * 0.5 + (Math.random() - 0.5) * (z.w * 0.38);
    const peakH = z.h * (0.58 + Math.random() * 0.25);
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

    const goodFruits = myFruits.filter((f) => f.kind !== 'bomb' && f.y < z.y + z.h - 24);
    const bombs = myFruits.filter((f) => f.kind === 'bomb' && f.y < z.y + z.h * 0.62);

    if (goodFruits.length > 0) {
      let slicedCount = 0;
      for (const f of goodFruits.slice(0, 3)) {
        this.sliceSingleFruit(z, f);
        slicedCount++;
      }
      if (slicedCount >= 2) {
        z.score += 1;
        this.audio.playChime();
        this.particles.showFloatingText(`🔥 ${slicedCount}X COMBO BLITZ! +1`, z.x + z.w / 2, z.y + z.h * 0.35, '#FBBF24', 18);
      } else {
        this.audio.playSpike();
      }
    } else if (bombs.length > 0) {
      this.triggerBombHit(z, bombs[0]);
    } else {
      const cx = z.x + z.w / 2;
      const cy = z.y + z.h / 2;
      this.slashes.push({
        x1: cx - 44,
        y1: cy + 22,
        x2: cx + 44,
        y2: cy - 22,
        color: '#94A3B8',
        alpha: 0.75
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

      ctx.strokeStyle = z.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(z.x + 2, z.y + 2, z.w - 4, z.h - 4);

      ctx.fillStyle = z.colorLight;
      ctx.font = '900 14px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${z.name}: ${z.score}/30`, z.x + 14, z.y + 24);

      if (z.combo >= 2) {
        ctx.fillStyle = '#FBBF24';
        ctx.font = '800 11px Montserrat, sans-serif';
        ctx.fillText(`🔥 ${z.combo}x STREAK`, z.x + 14, z.y + 42);
      }

      if (z.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = '900 15px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💥 STUNNED!', z.x + z.w / 2, z.y + z.h / 2);
      }

      ctx.restore();
    }

    // Render sliced fruit halves
    for (const h of this.halves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, h.alpha);
      ctx.translate(h.x, h.y);
      ctx.rotate(h.angle);
      ctx.beginPath();
      ctx.arc(0, 0, h.radius, h.side > 0 ? -Math.PI / 2 : Math.PI / 2, h.side > 0 ? Math.PI / 2 : (Math.PI * 3) / 2);
      ctx.closePath();
      ctx.fillStyle = h.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, h.radius * 0.62, h.side > 0 ? -Math.PI / 2 : Math.PI / 2, h.side > 0 ? Math.PI / 2 : (Math.PI * 3) / 2);
      ctx.closePath();
      ctx.fillStyle = h.innerColor;
      ctx.fill();
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
