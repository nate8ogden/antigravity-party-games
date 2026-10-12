import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CurveEvent {
  y: number; // distance down track (0 to height)
  direction: 'left' | 'right' | 'loop';
  handledBy: Set<PlayerId>;
}

interface CoasterCart {
  lean: number; // -1 (left), 0 (center), 1 (right)
  leanTarget: number;
  score: number;
  speed: number;
  wobble: number;
}

export class RollercoasterThrillGame extends BaseGame {
  private carts: Map<PlayerId, CoasterCart> = new Map();
  private curves: CurveEvent[] = [];
  private curveSpawnTimer: number = 1.8;
  private trackOffset: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.carts.clear();
    this.curves = [];
    this.curveSpawnTimer = 1.5;
    this.trackOffset = 0;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.carts.set(p.id, {
        lean: 0,
        leanTarget: 0,
        score: 0,
        speed: 380,
        wobble: 0
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.trackOffset = (this.trackOffset + dt * 400) % 60;
    this.updateBots(dt, width, height);

    // Spawn upcoming coaster curves
    this.curveSpawnTimer -= dt;
    if (this.curveSpawnTimer <= 0) {
      const dirs: ('left' | 'right' | 'loop')[] = ['left', 'right', 'loop'];
      this.curves.push({
        y: -40,
        direction: dirs[Math.floor(Math.random() * dirs.length)],
        handledBy: new Set()
      });
      this.curveSpawnTimer = 1.4 + Math.random() * 0.8;
      this.audio.playWhoosh();
    }

    // Move curves down the track towards carts
    const cartY = height - 120;
    for (let i = this.curves.length - 1; i >= 0; i--) {
      const c = this.curves[i];
      c.y += dt * 320;

      // When curve hits cart zone, evaluate leans
      if (Math.abs(c.y - cartY) < 35) {
        for (const p of this.getActivePlayers()) {
          if (!c.handledBy.has(p.id)) {
            const cart = this.carts.get(p.id);
            if (!cart) continue;

            const isCorrect = (c.direction === 'left' && cart.lean < -0.4) ||
                              (c.direction === 'right' && cart.lean > 0.4) ||
                              (c.direction === 'loop' && Math.abs(cart.lean) > 0.3);

            if (isCorrect) {
              cart.score += 150;
              this.audio.playTone(700, 0.1, 'triangle');
              this.particles.emit(width / 2, cartY, 12, '#F59E0B');
            } else {
              cart.wobble = 1.0;
              this.audio.playTone(200, 0.15, 'sawtooth');
            }
            c.handledBy.add(p.id);
          }
        }
      }

      if (c.y > height + 50) {
        this.curves.splice(i, 1);
      }
    }

    // Update cart lean and inputs
    for (const p of this.getActivePlayers()) {
      const cart = this.carts.get(p.id);
      if (!cart) continue;

      if (this.input.justPressed(p.id)) {
        // Toggle lean: center -> left -> right -> center
        if (cart.leanTarget === 0) cart.leanTarget = -1;
        else if (cart.leanTarget === -1) cart.leanTarget = 1;
        else cart.leanTarget = 0;
        this.audio.playTap();
      }

      // Smooth lean interpolation
      cart.lean += (cart.leanTarget - cart.lean) * dt * 10;
      if (cart.wobble > 0) cart.wobble -= dt * 2.5;
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _w: number, height: number): void {
    const cart = this.carts.get(botId);
    if (!cart) return;

    const cartY = height - 120;
    const curve = this.curves.find(c => !c.handledBy.has(botId) && c.y < cartY && cartY - c.y < 120);

    if (curve) {
      const reqLean = curve.direction === 'left' ? -1 : 1;
      const reactionDelay = difficulty === 'bot_hard' ? 0.9 : difficulty === 'bot_normal' ? 0.6 : 0.25;

      if (Math.random() < reactionDelay && cart.leanTarget !== reqLean) {
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Night sky carnival backdrop
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    // Stars
    ctx.fillStyle = '#FFFFFF';
    for (let s = 0; s < 30; s++) {
      const sx = ((s * 97) % width);
      const sy = ((s * 43) % height);
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Coaster Track (Perspective rails)
    const cx = width / 2;
    const topW = 120;
    const botW = width * 0.7;

    // Track Ties
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    for (let ty = this.trackOffset; ty < height; ty += 40) {
      const p = ty / height;
      const w = topW + (botW - topW) * p;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, ty);
      ctx.lineTo(cx + w / 2, ty);
      ctx.stroke();
    }

    // Steel Rails
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, 0);
    ctx.lineTo(cx - botW / 2, height);
    ctx.moveTo(cx + topW / 2, 0);
    ctx.lineTo(cx + botW / 2, height);
    ctx.stroke();

    // Curves / Warning Markers
    for (const c of this.curves) {
      const p = Math.max(0, c.y / height);
      const curW = topW + (botW - topW) * p;

      ctx.save();
      ctx.fillStyle = c.direction === 'loop' ? '#EC4899' : '#F59E0B';
      ctx.beginPath();
      ctx.roundRect(cx - curW * 0.45, c.y - 12, curW * 0.9, 24, 6);
      ctx.fill();

      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      const label = c.direction === 'left' ? '◀◀ LEAN LEFT' : c.direction === 'right' ? 'LEAN RIGHT ▶▶' : '★ 360° LOOP ★';
      ctx.fillText(label, cx, c.y + 4);
      ctx.restore();
    }

    // Draw Carts for all active players
    const active = this.getActivePlayers();
    const count = active.length;
    const cartY = height - 120;

    active.forEach((p, idx) => {
      const cart = this.carts.get(p.id);
      if (!cart) return;

      const spacing = botW / (count + 1);
      const baseX = (cx - botW / 2) + spacing * (idx + 1);
      const leanOffset = cart.lean * 24;
      const wobbleX = cart.wobble > 0 ? (Math.random() - 0.5) * 8 : 0;
      const cartX = baseX + leanOffset + wobbleX;

      ctx.save();
      ctx.translate(cartX, cartY);
      ctx.rotate(cart.lean * 0.25);

      // Cart body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-22, -18, 44, 36, 6);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Steel cart wheels
      ctx.fillStyle = '#334155';
      ctx.fillRect(-24, -14, 5, 10);
      ctx.fillRect(19, -14, 5, 10);
      ctx.fillRect(-24, 6, 5, 10);
      ctx.fillRect(19, 6, 5, 10);

      // Spark particles if leaning hard
      if (Math.abs(cart.lean) > 0.5) {
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-26, 12, 3, 3);
        ctx.fillRect(23, 12, 3, 3);
      }

      ctx.restore();

      // Player Score Tag
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(baseX - 30, cartY + 30, 60, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${cart.score}`, baseX, cartY + 44);
    });

    // Top Header
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ROLLERCOASTER THRILL • TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.carts.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} conquered the rollercoaster loops!` : 'The coaster pulled into the station!'
    };
  }
}
