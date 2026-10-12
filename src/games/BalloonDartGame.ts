import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type GalleryTheme = 'midway' | 'neon' | 'sunset';

type BalloonKind = 'standard' | 'golden' | 'bomb' | 'speedy';

interface GalleryBalloon {
  id: number;
  tier: number; // 0, 1, 2
  x: number;
  y: number;
  radius: number;
  kind: BalloonKind;
  color: string;
  points: number;
  bobPhase: number;
  popped: boolean;
}

interface FlyingDart {
  id: number;
  playerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  alive: boolean;
}

interface DartPlayerState {
  id: PlayerId;
  baseX: number;
  baseY: number;
  aimAngle: number;
  steerDir: number;
  score: number;
  poppedCount: number;
  combo: number;
  cooldown: number;
  botReactionTimer: number;
}

export class BalloonDartGame extends BaseGame {
  public galleryTheme: GalleryTheme = 'midway';
  private balloons: GalleryBalloon[] = [];
  private flyingDarts: FlyingDart[] = [];
  private playerStates: Map<PlayerId, DartPlayerState> = new Map();
  private balloonCounter: number = 0;
  private dartCounter: number = 0;
  private tierSpeeds: number[] = [65, -95, 125]; // Alternating conveyor speeds (px/s)
  private windForce: number = 0;
  private windChangeTimer: number = 3.5;
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
        else if (e.key === '2') this.switchTheme('neon', width, height);
        else if (e.key === '3') this.switchTheme('sunset', width, height);
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

  public switchTheme(theme: GalleryTheme, width: number, height: number): void {
    this.galleryTheme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `GALLERY: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'midway' ? '#F59E0B' : theme === 'neon' ? '#38BDF8' : '#EC4899',
      24
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.balloons = [];
    this.flyingDarts = [];
    this.balloonCounter = 0;
    this.dartCounter = 0;
    this.windForce = (Math.random() - 0.5) * 40;
    this.windChangeTimer = 4.0;
    this.spawnTimer = 0;

    this.initPlayers(width, height);
    this.populateInitialBalloons(width, height);
  }

  private initPlayers(width: number, height: number): void {
    this.playerStates.clear();
    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const px = spacing * (idx + 1);
      const py = height - 55;
      this.playerStates.set(p.id, {
        id: p.id,
        baseX: px,
        baseY: py,
        aimAngle: -Math.PI / 2, // Straight up
        steerDir: 0,
        score: 0,
        poppedCount: 0,
        combo: 0,
        cooldown: 0,
        botReactionTimer: 0.15 + idx * 0.08
      });
    });
  }

  private populateInitialBalloons(width: number, height: number): void {
    const tierYs = [height * 0.22, height * 0.36, height * 0.50];
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#EC4899'];

    tierYs.forEach((ty, tIdx) => {
      const count = 7;
      for (let i = 0; i < count; i++) {
        const x = (width / (count + 1)) * (i + 1) + (Math.random() - 0.5) * 20;
        this.spawnBalloonAt(x, ty, tIdx, colors[(i + tIdx) % colors.length]);
      }
    });
  }

  private spawnBalloonAt(x: number, y: number, tier: number, color: string): void {
    const roll = Math.random();
    let kind: BalloonKind = 'standard';
    let points = 100;
    let radius = 17;
    let bColor = color;

    if (roll < 0.14) {
      kind = 'bomb';
      points = 350;
      bColor = '#1E293B'; // Black bomb with spark fuse
      radius = 19;
    } else if (roll < 0.30) {
      kind = 'golden';
      points = 250;
      bColor = '#FBBF24';
      radius = 16;
    } else if (roll < 0.45) {
      kind = 'speedy';
      points = 180;
      bColor = '#06B6D4';
      radius = 14;
    }

    this.balloons.push({
      id: ++this.balloonCounter,
      tier,
      x,
      y,
      radius,
      kind,
      color: bColor,
      points,
      bobPhase: Math.random() * Math.PI * 2,
      popped: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update crosswind
    this.windChangeTimer -= dt;
    if (this.windChangeTimer <= 0) {
      this.windChangeTimer = 3 + Math.random() * 3;
      this.windForce = (Math.random() - 0.5) * 55;
    }

    // Spawn new balloons on conveyor edges if sparse
    this.spawnTimer -= dt;
    const tierYs = [height * 0.22, height * 0.36, height * 0.50];
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#EC4899'];
    if (this.spawnTimer <= 0 && this.balloons.filter(b => !b.popped).length < 18) {
      this.spawnTimer = 0.8 + Math.random() * 0.6;
      const t = Math.floor(Math.random() * 3);
      const spawnLeft = this.tierSpeeds[t] > 0;
      const x = spawnLeft ? -25 : width + 25;
      this.spawnBalloonAt(x, tierYs[t], t, colors[Math.floor(Math.random() * colors.length)]);
    }

    // Move Conveyor Balloons
    for (const b of this.balloons) {
      if (b.popped) continue;

      const speedMult = b.kind === 'speedy' ? 1.4 : 1.0;
      b.x += this.tierSpeeds[b.tier] * speedMult * dt;
      b.bobPhase += 3.5 * dt;

      // Wrap around edges
      if (b.x > width + 40 && this.tierSpeeds[b.tier] > 0) {
        b.x = -30;
      } else if (b.x < -40 && this.tierSpeeds[b.tier] < 0) {
        b.x = width + 30;
      }
    }

    // Update Players (Aiming & Shooting)
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      ps.cooldown = Math.max(0, ps.cooldown - dt);

      // Analog Aim Steer
      const steer = this.input.getSteer(p.id);
      if (Math.abs(steer) > 0.15) {
        ps.aimAngle += steer * 2.8 * dt;
      }

      // Constrain aim arc (from -160° to -20°)
      const minA = -Math.PI * 0.88;
      const maxA = -Math.PI * 0.12;
      ps.aimAngle = Math.max(minA, Math.min(maxA, ps.aimAngle));

      // Trigger Shot
      const shoot = this.input.justAction(p.id) || (this.input.justPressed(p.id) && Math.abs(steer) < 0.2);
      if (shoot && ps.cooldown <= 0) {
        ps.cooldown = 0.28; // Snappy fire rate
        const dartSpeed = 680;
        this.flyingDarts.push({
          id: ++this.dartCounter,
          playerId: p.id,
          color: p.color,
          x: ps.baseX,
          y: ps.baseY - 18,
          vx: Math.cos(ps.aimAngle) * dartSpeed + this.windForce * 0.5,
          vy: Math.sin(ps.aimAngle) * dartSpeed,
          angle: ps.aimAngle,
          alive: true
        });
        this.audio.playWhoosh();
      }
    }

    // Update Flying Darts
    for (let i = this.flyingDarts.length - 1; i >= 0; i--) {
      const dart = this.flyingDarts[i];
      if (!dart.alive) {
        this.flyingDarts.splice(i, 1);
        continue;
      }

      // Physics + Gravity + Crosswind
      dart.vx += this.windForce * 0.8 * dt;
      dart.vy += 320 * dt; // Gravity arc
      dart.x += dart.vx * dt;
      dart.y += dart.vy * dt;
      dart.angle = Math.atan2(dart.vy, dart.vx);

      // Collision check with balloons
      let hit = false;
      for (const b of this.balloons) {
        if (b.popped) continue;

        const by = b.y + Math.sin(b.bobPhase) * 6;
        const dist = Math.hypot(dart.x - b.x, dart.y - by);
        if (dist <= b.radius + 8) {
          hit = true;
          b.popped = true;
          dart.alive = false;

          const ps = this.playerStates.get(dart.playerId);
          if (ps) {
            ps.poppedCount++;
            ps.combo++;
            let earned = b.points;

            if (b.kind === 'bomb') {
              // BOMB CHAIN EXPLOSION! Pops all balloons in the same tier!
              this.audio.playExplosion();
              this.particles.shake(0.4);
              this.particles.spawnExplosion(b.x, by, '#EF4444', 28);
              this.particles.showFloatingText('💥 CHAIN POP! +500', b.x, by - 25, '#EF4444', 26);

              for (const other of this.balloons) {
                if (!other.popped && other.tier === b.tier) {
                  other.popped = true;
                  ps.score += other.points;
                  ps.poppedCount++;
                  this.particles.spawnConfetti(other.x, other.y, 8);
                }
              }
              earned = 500;
            } else {
              this.audio.playTap();
              this.particles.spawnConfetti(b.x, by, 12);
              const label = ps.combo >= 2 ? `+${earned} (${ps.combo}x COMBO!)` : `+${earned}`;
              this.particles.showFloatingText(label, b.x, by - 20, b.color, 22);
            }

            ps.score += earned;
          }
          break;
        }
      }

      // Bounds check
      if (!hit && (dart.y < -30 || dart.x < -30 || dart.x > width + 30 || dart.y > height + 20)) {
        dart.alive = false;
        const ps = this.playerStates.get(dart.playerId);
        if (ps) ps.combo = 0; // Combo reset on miss
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
    const ps = this.playerStates.get(botId);
    if (!ps) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    ps.botReactionTimer = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.18 : 0.35;

    // Pick best balloon target
    let bestTarget: GalleryBalloon | null = null;
    let bestScore = -9999;

    for (const b of this.balloons) {
      if (b.popped) continue;

      const by = b.y + Math.sin(b.bobPhase) * 6;
      const dx = b.x - ps.baseX;
      const dy = by - ps.baseY;
      const dist = Math.hypot(dx, dy);

      let val = b.points;
      if (b.kind === 'bomb') val = 600; // High priority on bomb chain
      if (b.kind === 'golden') val = 300;

      // Prefer balloons closer to vertical overhead for easy shots
      const angle = Math.atan2(dy, dx);
      if (angle < -Math.PI * 0.88 || angle > -Math.PI * 0.12) continue;

      const score = val - dist * 0.2;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = b;
      }
    }

    if (!bestTarget) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Aim calculation with lead prediction
    let targetX = bestTarget.x;
    const targetY = bestTarget.y + Math.sin(bestTarget.bobPhase) * 6;
    const distToTarget = Math.hypot(targetX - ps.baseX, targetY - ps.baseY);
    const flightTime = distToTarget / 680;

    if (difficulty !== 'bot_easy') {
      const speedMult = bestTarget.kind === 'speedy' ? 1.4 : 1.0;
      targetX += this.tierSpeeds[bestTarget.tier] * speedMult * flightTime;
      targetX += this.windForce * flightTime * 0.4;
    }

    const desiredAngle = Math.atan2(targetY - ps.baseY, targetX - ps.baseX);
    const angleDiff = desiredAngle - ps.aimAngle;

    const tolerance = difficulty === 'bot_hard' ? 0.06 : difficulty === 'bot_normal' ? 0.14 : 0.28;
    if (Math.abs(angleDiff) < tolerance && ps.cooldown <= 0) {
      if (difficulty === 'bot_easy' && Math.random() < 0.25) {
        this.input.setBotInput(botId, false, 0, 0, false);
        return;
      }
      this.input.setBotInput(botId, true, 0, 0, true);
    } else {
      const steer = angleDiff > 0 ? 1 : -1;
      this.input.setBotInput(botId, true, steer, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Carnival Booth Background
    this.renderBooth(ctx, width, height);

    // 2. Conveyor Racks & Moving Balloons
    this.renderBalloons(ctx, height);

    // 3. Wind Pennants
    this.renderWindBanner(ctx, width);

    // 4. Flying Darts
    this.renderDarts(ctx);

    // 5. Player Catapults & Mascots
    this.renderPlayers(ctx);

    // 6. Theme Pill (bottom-left)
    this.renderThemePill(ctx, height);
  }

  private renderBooth(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Theme Backdrop
    if (this.galleryTheme === 'midway') {
      ctx.fillStyle = '#451A03'; // Warm wood booth
    } else if (this.galleryTheme === 'neon') {
      ctx.fillStyle = '#0F172A'; // Cyber booth
    } else {
      ctx.fillStyle = '#31102F'; // Sunset booth
    }
    ctx.fillRect(0, 0, width, height);

    // Carnival Striped Canopy Curtain at Top
    const stripeCount = 18;
    const stripeW = width / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#DC2626' : '#FEF08A';
      ctx.beginPath();
      ctx.moveTo(i * stripeW, 0);
      ctx.lineTo((i + 1) * stripeW, 0);
      ctx.lineTo((i + 0.5) * stripeW, 36);
      ctx.closePath();
      ctx.fill();
    }

    // Wooden / Metallic Conveyor Racks
    const tierYs = [height * 0.22, height * 0.36, height * 0.50];
    for (const ty of tierYs) {
      ctx.fillStyle = this.galleryTheme === 'neon' ? '#1E293B' : '#78350F';
      ctx.fillRect(0, ty + 18, width, 10);
      ctx.strokeStyle = this.galleryTheme === 'neon' ? '#06B6D4' : '#B45309';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, ty + 18, width, 10);
    }
  }

  private renderBalloons(ctx: CanvasRenderingContext2D, height: number): void {
    for (const b of this.balloons) {
      if (b.popped) continue;

      const by = b.y + Math.sin(b.bobPhase) * 6;

      ctx.save();
      ctx.translate(b.x, by);

      // Golden Glow
      if (b.kind === 'golden') {
        const glowGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, b.radius * 1.8);
        glowGrad.addColorStop(0, 'rgba(251, 191, 36, 0.6)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Balloon Oval Shape
      ctx.beginPath();
      ctx.ellipse(0, -2, b.radius * 0.9, b.radius * 1.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();

      // Specular Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(-b.radius * 0.3, -b.radius * 0.5, b.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Knot & String
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(-3, b.radius * 1.1);
      ctx.lineTo(3, b.radius * 1.1);
      ctx.lineTo(0, b.radius * 1.25);
      ctx.closePath();
      ctx.fill();

      // Bomb fuse & skull / icon
      if (b.kind === 'bomb') {
        ctx.fillStyle = '#EF4444';
        ctx.font = '700 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💣', 0, 3);
      } else if (b.kind === 'golden') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 2);
      }

      ctx.restore();
    }
  }

  private renderWindBanner(ctx: CanvasRenderingContext2D, width: number): void {
    const bannerW = 200;
    const bannerH = 24;
    const bx = width / 2 - bannerW / 2;
    const by = 46;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bannerW, bannerH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const windDir = this.windForce >= 0 ? '▶' : '◀';
    const windStr = Math.abs(Math.round(this.windForce));
    ctx.fillStyle = '#FDE047';
    ctx.fillText(`WIND: ${windDir} ${windStr} mph`, bx + bannerW / 2, by + 16);
  }

  private renderDarts(ctx: CanvasRenderingContext2D): void {
    for (const dart of this.flyingDarts) {
      if (!dart.alive) continue;

      ctx.save();
      ctx.translate(dart.x, dart.y);
      ctx.rotate(dart.angle);

      // Dart Shaft
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(10, 0);
      ctx.strokeStyle = dart.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Sharp Tip Needle
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(16, 0);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flight Feathers
      ctx.fillStyle = dart.color;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-22, -5);
      ctx.lineTo(-18, 0);
      ctx.lineTo(-22, 5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  private renderPlayers(ctx: CanvasRenderingContext2D): void {
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.baseX, ps.baseY);

      // Catapult Base Stand
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(-22, -4, 44, 18, 6);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Aim Barrel
      ctx.save();
      ctx.rotate(ps.aimAngle);
      ctx.fillStyle = p.color;
      ctx.fillRect(0, -3.5, 26, 7);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, -3.5, 26, 7);

      // Laser Aim Guide Dot (subtle)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(60, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Mascot Operator
      const mood = ps.combo >= 2 ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, ps.id, 0, 4, 12, mood, performance.now() * 0.001);

      ctx.restore();

      // Score Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.score} pts`, ps.baseX, ps.baseY - 32);
    }
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
    ctx.fillStyle = this.galleryTheme === 'midway' ? '#F59E0B' : this.galleryTheme === 'neon' ? '#38BDF8' : '#EC4899';
    ctx.fillText(`GALLERY: ${this.galleryTheme.toUpperCase()} [1-3]`, pillX + pillW / 2, pillY + 17);
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playerStates.get(p.id);
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

    let mvpHighlight = 'Carnival Sharpshooter!';
    if (winnerId !== null) {
      const ps = this.playerStates.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} popped ${ps?.poppedCount || 0} balloons!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
