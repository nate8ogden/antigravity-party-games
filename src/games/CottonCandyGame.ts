import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type CandyTheme = 'midway' | 'pastel' | 'cyber';

type SugarKind = 'strawberry' | 'raspberry' | 'banana' | 'grape' | 'star' | 'burnt';

interface SugarDrop {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: SugarKind;
  color: string;
  points: number;
  spin: number;
  spinSpeed: number;
  destroyed: boolean;
}

interface StackPuff {
  color: string;
  radius: number;
  offsetX: number;
}

interface StackerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  speed: number;
  stack: StackPuff[];
  wobbleAngle: number;
  wobbleVelocity: number;
  score: number;
  bankedCount: number;
  cashInTimer: number;
  botReactionTimer: number;
}

export class CottonCandyGame extends BaseGame {
  public candyTheme: CandyTheme = 'midway';
  private playersState: Map<PlayerId, StackerPlayer> = new Map();
  private drops: SugarDrop[] = [];
  private dropCounter: number = 0;
  private spawnTimer: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

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

    if (typeof window !== 'undefined') {
      this.keydownListener = (e: KeyboardEvent) => {
        if (e.key === '1') this.switchTheme('midway', width, height);
        else if (e.key === '2') this.switchTheme('pastel', width, height);
        else if (e.key === '3') this.switchTheme('cyber', width, height);
      };
      window.addEventListener('keydown', this.keydownListener);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  public switchTheme(theme: CandyTheme, width: number, height: number): void {
    this.candyTheme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `CANDY: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'midway' ? '#F43F5E' : theme === 'pastel' ? '#A855F7' : '#06B6D4',
      24
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.drops = [];
    this.dropCounter = 0;
    this.spawnTimer = 0;

    this.initPlayers(width, height);
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 60,
        vx: 0,
        speed: 360,
        stack: [],
        wobbleAngle: 0,
        wobbleVelocity: 0,
        score: 0,
        bankedCount: 0,
        cashInTimer: 0,
        botReactionTimer: 0.15 + idx * 0.08
      });
    });
  }

  private spawnSugarDrop(width: number): void {
    const x = 50 + Math.random() * (width - 100);
    const roll = Math.random();

    let kind: SugarKind = 'strawberry';
    let color = '#FB7185';
    let points = 100;
    let radius = 16;

    if (roll < 0.12) {
      kind = 'burnt';
      color = '#1E293B';
      points = -120;
      radius = 17;
    } else if (roll < 0.24) {
      kind = 'star';
      color = '#FACC15';
      points = 300;
      radius = 18;
    } else if (roll < 0.48) {
      kind = 'raspberry';
      color = '#38BDF8';
      points = 120;
      radius = 15;
    } else if (roll < 0.72) {
      kind = 'banana';
      color = '#FDE047';
      points = 140;
      radius = 15;
    } else {
      kind = 'grape';
      color = '#C084FC';
      points = 160;
      radius = 16;
    }

    this.drops.push({
      id: ++this.dropCounter,
      x,
      y: -25,
      vx: (Math.random() - 0.5) * 60,
      vy: 140 + Math.random() * 80,
      radius,
      kind,
      color,
      points,
      spin: 0,
      spinSpeed: (Math.random() - 0.5) * 4,
      destroyed: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Spawn falling sugar drops
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnSugarDrop(width);
      this.spawnTimer = 0.45 + Math.random() * 0.4;
    }

    // Update Sugar Drops
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (drop.destroyed) {
        this.drops.splice(i, 1);
        continue;
      }

      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.spin += drop.spinSpeed * dt;

      // Check collision with players' cotton candy sticks and tops of stacks
      for (const p of this.getActivePlayers()) {
        const ps = this.playersState.get(p.id);
        if (!ps) continue;

        // Effective catch point is the top of the current stack
        const stackHeight = ps.stack.length * 18;
        const catchX = ps.x + Math.sin(ps.wobbleAngle) * stackHeight;
        const catchY = ps.y - 25 - Math.cos(ps.wobbleAngle) * stackHeight;

        const dist = Math.hypot(drop.x - catchX, drop.y - catchY);
        if (dist <= drop.radius + 18) {
          drop.destroyed = true;

          if (drop.kind === 'burnt') {
            // BURNT CRISP! Knocks off the top puff & stuns wobble!
            this.audio.playStun();
            this.particles.shake(0.3);
            this.particles.spawnExplosion(catchX, catchY, '#EF4444', 16);
            this.particles.showFloatingText('BURNT! -120', catchX, catchY - 20, '#EF4444', 22);
            ps.score = Math.max(0, ps.score + drop.points);
            if (ps.stack.length > 0) {
              ps.stack.pop();
            }
            ps.wobbleVelocity += (Math.random() - 0.5) * 8;
          } else {
            // Sweet Sugar Catch!
            this.audio.playTap();
            this.particles.spawnConfetti(catchX, catchY, 10);
            this.particles.showFloatingText(`+${drop.points}`, catchX, catchY - 20, drop.color, 22);

            ps.stack.push({
              color: drop.color,
              radius: 18 + Math.random() * 6,
              offsetX: (Math.random() - 0.5) * 6
            });
            ps.score += drop.points;

            // Trigger Stack Height Fanfare at 6 and 10
            if (ps.stack.length === 6) {
              this.particles.showFloatingText('SUPER CLOUD! 1.5x CASH-IN!', ps.x, ps.y - 120, '#F59E0B', 22);
              this.audio.playChime();
            } else if (ps.stack.length >= 10) {
              this.particles.showFloatingText('MEGA TOWER! 3x CASH-IN!', ps.x, ps.y - 140, '#EC4899', 24);
              this.audio.playBoost();
            }
          }
          break;
        }
      }

      // Despawn at bottom
      if (drop.y > height + 30) {
        drop.destroyed = true;
      }
    }

    // Update Players Movement, Wobble & Cash-In
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ps.cashInTimer = Math.max(0, ps.cashInTimer - dt);

      // Analog Horizontal Movement
      const steer = this.input.getSteer(p.id);
      ps.vx = steer * ps.speed;
      ps.x += ps.vx * dt;

      // Keep within bounds
      ps.x = Math.max(45, Math.min(width - 45, ps.x));

      // Physics Wobble on Stack
      const stackLen = ps.stack.length;
      if (stackLen > 0) {
        // Inertia creates lean when changing direction
        const accelForce = -steer * (0.05 + stackLen * 0.035);
        ps.wobbleVelocity += accelForce * 18 * dt;

        // Restoring spring force towards vertical
        const springK = 22;
        const damping = 6;
        ps.wobbleVelocity += (-springK * ps.wobbleAngle - damping * ps.wobbleVelocity) * dt;
        ps.wobbleAngle += ps.wobbleVelocity * dt;

        // If stack tips over (> 65 degrees), collapse top half!
        if (Math.abs(ps.wobbleAngle) > 1.15 && stackLen >= 4) {
          const lostCount = Math.ceil(stackLen * 0.5);
          for (let k = 0; k < lostCount; k++) {
            ps.stack.pop();
          }
          this.audio.playSnowSplat();
          this.particles.shake(0.3);
          this.particles.showFloatingText('TOPPLE! STACK TIPPED!', ps.x, ps.y - 80, '#EF4444', 24);
          ps.wobbleAngle = 0;
          ps.wobbleVelocity = 0;
        }
      } else {
        ps.wobbleAngle = 0;
        ps.wobbleVelocity = 0;
      }

      // CASH IN ACTION! (Tap/Space/Enter to bank the cloud stack)
      const cashIn = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (cashIn && ps.stack.length > 0 && ps.cashInTimer <= 0) {
        ps.cashInTimer = 0.5;
        const count = ps.stack.length;
        let mult = 1.0;
        if (count >= 10) mult = 3.0;
        else if (count >= 6) mult = 1.8;
        else if (count >= 3) mult = 1.3;

        const bonus = Math.round(count * 80 * mult);
        ps.score += bonus;
        ps.bankedCount += count;
        ps.stack = [];
        ps.wobbleAngle = 0;
        ps.wobbleVelocity = 0;

        this.audio.playScore();
        this.particles.spawnConfetti(ps.x, ps.y - 40, 20);
        this.particles.showFloatingText(`CASHED IN! +${bonus} (${mult}x)`, ps.x, ps.y - 60, '#F59E0B', 24);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    ps.botReactionTimer = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.16 : 0.32;

    // Cash in check for bot
    const stackThreshold = difficulty === 'bot_hard' ? 8 : difficulty === 'bot_normal' ? 5 : 3;
    if (ps.stack.length >= stackThreshold || (this.roundTimer < 3 && ps.stack.length >= 2)) {
      this.input.setBotInput(botId, true, 0, 0, true);
      return;
    }

    // Find closest safe sugar drop
    let bestDrop: SugarDrop | null = null;
    let minDist = 9999;

    for (const drop of this.drops) {
      if (drop.destroyed || drop.y > ps.y - 20) continue;

      if (drop.kind === 'burnt') {
        // If burnt drop is right above us, dodge it!
        if (Math.abs(drop.x - ps.x) < 45 && drop.y > ps.y - 120) {
          const dodgeDir = ps.x < width / 2 ? 1 : -1;
          this.input.setBotInput(botId, true, dodgeDir, 0, false);
          return;
        }
        continue;
      }

      const dx = Math.abs(drop.x - ps.x);
      const dy = ps.y - drop.y;
      const dist = dx + dy * 0.4;
      if (dist < minDist) {
        minDist = dist;
        bestDrop = drop;
      }
    }

    if (!bestDrop) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Move stick towards drop
    const dx = bestDrop.x - ps.x;
    if (Math.abs(dx) > 12) {
      const steer = dx > 0 ? 1 : -1;
      this.input.setBotInput(botId, true, steer, 0, false);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Pastel Sugar Booth Backdrop
    this.renderBackdrop(ctx, width, height);

    // 2. Falling Sugar Drops
    this.renderSugarDrops(ctx);

    // 3. Players Sticks & Towering Cotton Candy Stacks
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderPlayerStack(ctx, ps, p.color);
    }

    // 4. Theme Pill (bottom-left)
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.candyTheme === 'midway') {
      ctx.fillStyle = '#4A044E'; // Rich magenta carnival tent
    } else if (this.candyTheme === 'pastel') {
      ctx.fillStyle = '#1E1B4B'; // Indigo twilight
    } else {
      ctx.fillStyle = '#0F172A'; // Cyber synthwave
    }
    ctx.fillRect(0, 0, width, height);

    // Warm Carnival Sugar Vapor glow at bottom
    const glowGrad = ctx.createLinearGradient(0, height * 0.6, 0, height);
    glowGrad.addColorStop(0, 'transparent');
    glowGrad.addColorStop(1, 'rgba(244, 63, 94, 0.22)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, height * 0.6, width, height * 0.4);

    // Floor counter
    ctx.fillStyle = '#371B43';
    ctx.fillRect(0, height - 28, width, 28);
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, height - 28, width, 28);
  }

  private renderSugarDrops(ctx: CanvasRenderingContext2D): void {
    for (const drop of this.drops) {
      if (drop.destroyed) continue;

      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(drop.spin);

      // Fluffy cloud puff shape
      ctx.fillStyle = drop.color;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += Math.PI * 0.35) {
        const r = drop.radius * (0.8 + Math.sin(a * 3) * 0.2);
        ctx.arc(Math.cos(a) * (drop.radius * 0.5), Math.sin(a) * (drop.radius * 0.5), r * 0.55, 0, Math.PI * 2);
      }
      ctx.fill();

      // Border outline
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Star / Icon inside
      if (drop.kind === 'star') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 4);
      } else if (drop.kind === 'burnt') {
        ctx.fillStyle = '#EF4444';
        ctx.font = '700 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✕', 0, 4);
      }

      ctx.restore();
    }
  }

  private renderPlayerStack(ctx: CanvasRenderingContext2D, ps: StackerPlayer, color: string): void {
    ctx.save();
    ctx.translate(ps.x, ps.y);

    // 1. Player Mascot holding the stick
    const mood = ps.stack.length >= 6 ? 'triumph' : 'focused';
    this.drawPlayerMascot(ctx, ps.id, 0, 6, 14, mood, performance.now() * 0.001);

    // 2. Paper Stick Base
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-3, -28, 6, 32);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, -28, 6, 32);

    // 3. Towering Cotton Candy Cloud Stack with Wobble Tilt
    ctx.save();
    ctx.translate(0, -28);
    ctx.rotate(ps.wobbleAngle);

    for (let i = 0; i < ps.stack.length; i++) {
      const puff = ps.stack[i];
      const py = -i * 18;

      ctx.fillStyle = puff.color;
      ctx.beginPath();
      ctx.arc(puff.offsetX, py - 10, puff.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.stroke();

      // Fluff texture specks
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(puff.offsetX - 4, py - 14, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();

    // Score & Stack Count Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    const multLabel = ps.stack.length >= 10 ? ' [3x!]' : ps.stack.length >= 6 ? ' [1.8x]' : '';
    ctx.fillText(`${ps.score} pts (${ps.stack.length} puffs${multLabel})`, ps.x, ps.y - 42);
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number): void {
    const pillW = 165;
    const pillH = 26;
    const pillX = 20;
    const pillY = height - 44;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.candyTheme === 'midway' ? '#F43F5E' : this.candyTheme === 'pastel' ? '#C084FC' : '#06B6D4';
    ctx.fillText(`CANDY: ${this.candyTheme.toUpperCase()} [1-3]`, pillX + pillW / 2, pillY + 17);
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Sugar Cloud Master!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} stacked ${ps?.bankedCount || 0} candy puffs!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
