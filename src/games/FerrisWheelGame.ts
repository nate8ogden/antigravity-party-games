import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type WheelTheme = 'twilight' | 'neon' | 'stormy';

interface SpokeItem {
  id: number;
  spokeIndex: number;
  distFromCenter: number;
  type: 'coin' | 'gem' | 'star';
  points: number;
  color: string;
  collected: boolean;
}

interface WheelClimber {
  id: PlayerId;
  spokeIndex: number; // 0 to 7
  dist: number;       // distance along spoke (30 to 210)
  speed: number;
  facing: 1 | -1;
  isJumping: boolean;
  jumpArc: number;
  jumpProgress: number;
  targetSpoke: number;
  targetDist: number;
  wobble: number;
  fallRespawnTimer: number;
  score: number;
  tokensCollected: number;
  botReactionTimer: number;
}

export class FerrisWheelGame extends BaseGame {
  public wheelTheme: WheelTheme = 'twilight';
  private wheelAngle: number = 0;
  private wheelSpeed: number = 0.55;
  private climbers: Map<PlayerId, WheelClimber> = new Map();
  private items: SpokeItem[] = [];
  private itemCounter: number = 0;
  private spawnTimer: number = 0;
  private readonly SPOKE_COUNT = 8;
  private readonly MAX_RADIUS = 210;
  private centerX: number = 0;
  private centerY: number = 0;
  private gustForce: number = 0;
  private gustTimer: number = 3.0;
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
        if (e.key === '1') this.switchTheme('twilight', width, height);
        else if (e.key === '2') this.switchTheme('neon', width, height);
        else if (e.key === '3') this.switchTheme('stormy', width, height);
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

  public switchTheme(theme: WheelTheme, width: number, height: number): void {
    this.wheelTheme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `SKY WHEEL: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'twilight' ? '#F59E0B' : theme === 'neon' ? '#38BDF8' : '#64748B',
      24
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.wheelAngle = 0;
    this.wheelSpeed = 0.55;
    this.climbers.clear();
    this.items = [];
    this.itemCounter = 0;
    this.spawnTimer = 0;
    this.gustForce = 0;
    this.gustTimer = 3.0;

    this.centerX = width / 2;
    this.centerY = height / 2 + 10;

    this.initPlayers();
    this.populateInitialItems();
  }

  private initPlayers(): void {
    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const assignedSpoke = Math.floor((idx / count) * this.SPOKE_COUNT);
      this.climbers.set(p.id, {
        id: p.id,
        spokeIndex: assignedSpoke,
        dist: 90 + idx * 20,
        speed: 160,
        facing: 1,
        isJumping: false,
        jumpArc: 0,
        jumpProgress: 0,
        targetSpoke: assignedSpoke,
        targetDist: 90,
        wobble: 0,
        fallRespawnTimer: 0,
        score: 0,
        tokensCollected: 0,
        botReactionTimer: 0.15 + idx * 0.08
      });
    });
  }

  private populateInitialItems(): void {
    for (let s = 0; s < this.SPOKE_COUNT; s++) {
      for (let r = 70; r <= 190; r += 50) {
        this.spawnItemOnSpoke(s, r);
      }
    }
  }

  private spawnItemOnSpoke(spokeIndex: number, dist: number): void {
    const roll = Math.random();
    let type: 'coin' | 'gem' | 'star' = 'coin';
    let points = 50;
    let color = '#FDE047';

    if (roll < 0.22) {
      type = 'star';
      points = 250;
      color = '#F59E0B';
    } else if (roll < 0.55) {
      type = 'gem';
      points = 120;
      color = '#38BDF8';
    }

    this.items.push({
      id: ++this.itemCounter,
      spokeIndex,
      distFromCenter: dist,
      type,
      points,
      color,
      collected: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Rotate Giant Wheel
    this.wheelAngle += this.wheelSpeed * dt;

    // High altitude wind gusts
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gustTimer = 3 + Math.random() * 3;
      this.gustForce = (Math.random() - 0.5) * 45;
    }

    // Item respawner
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.items.filter((i) => !i.collected).length < 14) {
      this.spawnTimer = 1.0 + Math.random() * 0.8;
      const s = Math.floor(Math.random() * this.SPOKE_COUNT);
      const r = 60 + Math.random() * 130;
      this.spawnItemOnSpoke(s, r);
    }

    // Update Climbers
    for (const p of this.getActivePlayers()) {
      const c = this.climbers.get(p.id);
      if (!c) continue;

      if (c.fallRespawnTimer > 0) {
        c.fallRespawnTimer -= dt;
        continue;
      }

      // If in mid-jump across spokes
      if (c.isJumping) {
        c.jumpProgress += 3.2 * dt;
        c.jumpArc = Math.sin(c.jumpProgress * Math.PI) * 26;

        if (c.jumpProgress >= 1.0) {
          c.jumpProgress = 0;
          c.isJumping = false;
          c.jumpArc = 0;
          c.spokeIndex = c.targetSpoke;
          c.dist = c.targetDist;
          this.audio.playBounce();
        }
        continue;
      }

      // Read Inputs: Steer moves along spoke / jumps to adjacent spoke
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id);

      // Move along spoke (inward / outward)
      if (Math.abs(throttle) > 0.2) {
        c.dist -= throttle * c.speed * dt;
        c.dist = Math.max(35, Math.min(this.MAX_RADIUS, c.dist));
      }

      // Natural gravity pull along spoke slope
      const spokeAngle = this.wheelAngle + (c.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;
      const slopePull = Math.sin(spokeAngle) * 35;
      c.dist += slopePull * dt;
      c.dist = Math.max(35, Math.min(this.MAX_RADIUS, c.dist));

      // Over-the-edge check: if slipped past MAX_RADIUS, slip & fall!
      if (c.dist >= this.MAX_RADIUS && Math.sin(spokeAngle) > 0.5) {
        c.fallRespawnTimer = 1.5;
        c.score = Math.max(0, c.score - 100);
        c.dist = 70;
        this.audio.playStun();
        this.particles.shake(0.3);
        this.particles.showFloatingText('SLIPPED! -100', width / 2, height / 2, '#EF4444', 22);
        continue;
      }

      // Jump to adjacent spoke
      if (justAction || Math.abs(steer) > 0.6) {
        const jumpDir = steer >= 0 ? 1 : -1;
        c.isJumping = true;
        c.jumpProgress = 0;
        c.targetSpoke = (c.spokeIndex + jumpDir + this.SPOKE_COUNT) % this.SPOKE_COUNT;
        c.targetDist = c.dist;
        this.audio.playWhoosh();
      }

      // Check item collection
      for (const item of this.items) {
        if (item.collected || item.spokeIndex !== c.spokeIndex) continue;

        if (Math.abs(c.dist - item.distFromCenter) < 22) {
          item.collected = true;
          c.score += item.points;
          c.tokensCollected += 1;
          this.audio.playCoin();

          const curAngle = this.wheelAngle + (c.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;
          const ix = this.centerX + Math.cos(curAngle) * item.distFromCenter;
          const iy = this.centerY + Math.sin(curAngle) * item.distFromCenter;
          this.particles.showFloatingText(`+${item.points}`, ix, iy - 16, item.color, 22);
          this.particles.spawnConfetti(ix, iy, 10);
        }
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
    const c = this.climbers.get(botId);
    if (!c || c.fallRespawnTimer > 0 || c.isJumping) return;

    c.botReactionTimer -= dt;
    if (c.botReactionTimer > 0) return;

    c.botReactionTimer = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.18 : 0.35;

    // Check if on danger slope (near outer edge slipping downward)
    const spokeAngle = this.wheelAngle + (c.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;
    if (c.dist > 165 && Math.sin(spokeAngle) > 0.4) {
      // Danger! Climb inward!
      this.input.setBotInput(botId, true, 0, 1, false);
      return;
    }

    // Look for items on current spoke
    let itemOnCurrentSpoke: SpokeItem | null = null;
    let minDist = 999;
    for (const it of this.items) {
      if (it.collected) continue;
      if (it.spokeIndex === c.spokeIndex) {
        const d = Math.abs(c.dist - it.distFromCenter);
        if (d < minDist) {
          minDist = d;
          itemOnCurrentSpoke = it;
        }
      }
    }

    if (itemOnCurrentSpoke) {
      const diff = itemOnCurrentSpoke.distFromCenter - c.dist;
      if (Math.abs(diff) > 10) {
        const throttle = diff > 0 ? -1 : 1; // negative moves outward
        this.input.setBotInput(botId, true, 0, throttle, false);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
      return;
    }

    // If no items on current spoke, jump to adjacent spoke with items
    let bestAdjacent = -1;
    let bestPoints = 0;
    const nextSpoke = (c.spokeIndex + 1) % this.SPOKE_COUNT;
    const prevSpoke = (c.spokeIndex - 1 + this.SPOKE_COUNT) % this.SPOKE_COUNT;

    for (const it of this.items) {
      if (it.collected) continue;
      if (it.spokeIndex === nextSpoke && it.points > bestPoints) {
        bestPoints = it.points;
        bestAdjacent = 1;
      }
      if (it.spokeIndex === prevSpoke && it.points > bestPoints) {
        bestPoints = it.points;
        bestAdjacent = -1;
      }
    }

    if (bestAdjacent !== -1) {
      this.input.setBotInput(botId, true, bestAdjacent, 0, true);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. High Altitude Carnival Backdrop
    this.renderBackdrop(ctx, width, height);

    // 2. Giant Mechanical Ferris Wheel Frame & Spokes
    this.renderWheel(ctx);

    // 3. Spoke Items (Coins, Gems, Stars)
    this.renderItems(ctx);

    // 4. Climbers & Mascots
    this.renderClimbers(ctx);

    // 5. Theme Pill (bottom-left)
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.wheelTheme === 'twilight') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1E1B4B');
      grad.addColorStop(0.6, '#4C1D95');
      grad.addColorStop(1, '#831843');
      ctx.fillStyle = grad;
    } else if (this.wheelTheme === 'neon') {
      ctx.fillStyle = '#090D16';
    } else {
      ctx.fillStyle = '#1E293B';
    }
    ctx.fillRect(0, 0, width, height);

    // Distant Carnival Lights / Horizon at bottom
    ctx.fillStyle = 'rgba(253, 224, 71, 0.15)';
    ctx.fillRect(0, height - 35, width, 35);
  }

  private renderWheel(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    // Outer Rim Rings
    ctx.strokeStyle = this.wheelTheme === 'neon' ? '#06B6D4' : '#F59E0B';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, this.MAX_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.MAX_RADIUS - 14, 0, Math.PI * 2);
    ctx.stroke();

    // Inner Hub Gear
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 8 Structural Iron Spokes
    for (let s = 0; s < this.SPOKE_COUNT; s++) {
      const angle = this.wheelAngle + (s / this.SPOKE_COUNT) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Steel girder truss spoke
      ctx.strokeStyle = this.wheelTheme === 'neon' ? 'rgba(56, 189, 248, 0.8)' : '#D97706';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cos * 30, sin * 30);
      ctx.lineTo(cos * this.MAX_RADIUS, sin * this.MAX_RADIUS);
      ctx.stroke();

      // Cross-struts along spoke
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      for (let r = 60; r < this.MAX_RADIUS; r += 35) {
        ctx.beginPath();
        ctx.arc(cos * r, sin * r, 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderItems(ctx: CanvasRenderingContext2D): void {
    for (const it of this.items) {
      if (it.collected) continue;

      const angle = this.wheelAngle + (it.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;
      const ix = this.centerX + Math.cos(angle) * it.distFromCenter;
      const iy = this.centerY + Math.sin(angle) * it.distFromCenter;

      ctx.save();
      ctx.translate(ix, iy);

      if (it.type === 'star') {
        ctx.fillStyle = it.color;
        ctx.font = '700 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 6);
      } else if (it.type === 'gem') {
        ctx.fillStyle = it.color;
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(7, 0);
        ctx.lineTo(0, 7);
        ctx.lineTo(-7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fillStyle = it.color;
        ctx.fill();
        ctx.strokeStyle = '#CA8A04';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderClimbers(ctx: CanvasRenderingContext2D): void {
    for (const p of this.getActivePlayers()) {
      const c = this.climbers.get(p.id);
      if (!c || c.fallRespawnTimer > 0) continue;

      // Calculate position on spoke + jump arc
      let angle = this.wheelAngle + (c.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;
      let dist = c.dist;

      if (c.isJumping) {
        const fromAngle = this.wheelAngle + (c.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;
        const toAngle = this.wheelAngle + (c.targetSpoke / this.SPOKE_COUNT) * Math.PI * 2;
        angle = fromAngle + (toAngle - fromAngle) * c.jumpProgress;
      }

      const px = this.centerX + Math.cos(angle) * dist;
      const py = this.centerY + Math.sin(angle) * dist - c.jumpArc;

      ctx.save();
      ctx.translate(px, py);

      // Mascot Climber
      const mood = c.dist > 160 ? 'shocked' : c.tokensCollected > 0 ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, p.id, 0, 0, 13, mood, performance.now() * 0.001);

      ctx.restore();

      // Score Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.score} pts`, px, py - 20);
    }
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number): void {
    const pillW = 175;
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
    ctx.fillStyle = this.wheelTheme === 'twilight' ? '#F59E0B' : this.wheelTheme === 'neon' ? '#38BDF8' : '#94A3B8';
    ctx.fillText(`SKY WHEEL: ${this.wheelTheme.toUpperCase()} [1-3]`, pillX + pillW / 2, pillY + 17);
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const c = this.climbers.get(p.id);
        const score = c ? c.score : 0;
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

    let mvpHighlight = 'High Altitude Master!';
    if (winnerId !== null) {
      const c = this.climbers.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} snagged ${c?.tokensCollected || 0} high-wire tokens!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
