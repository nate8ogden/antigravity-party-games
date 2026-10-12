import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type RingTheme = 'midway' | 'neon' | 'retro';

interface BottleTarget {
  id: number;
  ringTier: number; // 0 (center), 1 (inner), 2 (outer)
  angle: number;
  dist: number;
  points: number;
  isGold: boolean;
  ringsAttached: number;
  color: string;
}

interface FlyingHoop {
  id: number;
  playerId: PlayerId;
  color: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetBottleId: number | null;
  progress: number;
  speed: number;
  scale: number;
  alive: boolean;
}

interface PitchPlayer {
  id: PlayerId;
  baseX: number;
  baseY: number;
  aimAngle: number;
  ringsLeft: number;
  cooldown: number;
  score: number;
  ringersCount: number;
  combo: number;
  botReactionTimer: number;
}

export class RingTossGame extends BaseGame {
  public ringTheme: RingTheme = 'midway';
  private bottles: BottleTarget[] = [];
  private flyingHoops: FlyingHoop[] = [];
  private playerStates: Map<PlayerId, PitchPlayer> = new Map();
  private hoopCounter: number = 0;
  private trayAngles: number[] = [0, 0, 0];
  private traySpeeds: number[] = [0.4, -0.65, 0.85];
  private boothCenterX: number = 0;
  private boothCenterY: number = 0;
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
        else if (e.key === '3') this.switchTheme('retro', width, height);
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

  public switchTheme(theme: RingTheme, width: number, height: number): void {
    this.ringTheme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `RING TOSS: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'midway' ? '#F59E0B' : theme === 'neon' ? '#38BDF8' : '#EC4899',
      24
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.flyingHoops = [];
    this.hoopCounter = 0;
    this.trayAngles = [0, 0, 0];

    this.boothCenterX = width / 2;
    this.boothCenterY = height * 0.38;

    this.initPlayers(width, height);
    this.initBottles();
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
        aimAngle: -Math.PI / 2,
        ringsLeft: 99,
        cooldown: 0,
        score: 0,
        ringersCount: 0,
        combo: 0,
        botReactionTimer: 0.15 + idx * 0.08
      });
    });
  }

  private initBottles(): void {
    this.bottles = [];
    let bId = 0;

    // Center Golden Decanter
    this.bottles.push({
      id: ++bId,
      ringTier: 0,
      angle: 0,
      dist: 0,
      points: 300,
      isGold: true,
      ringsAttached: 0,
      color: '#FACC15'
    });

    // Inner Ring: 6 Bottles
    for (let i = 0; i < 6; i++) {
      this.bottles.push({
        id: ++bId,
        ringTier: 1,
        angle: (i / 6) * Math.PI * 2,
        dist: 75,
        points: 150,
        isGold: i % 2 === 0,
        ringsAttached: 0,
        color: i % 2 === 0 ? '#FDE047' : '#38BDF8'
      });
    }

    // Outer Ring: 10 Bottles
    const outerColors = ['#EF4444', '#10B981', '#A855F7', '#EC4899', '#06B6D4'];
    for (let i = 0; i < 10; i++) {
      this.bottles.push({
        id: ++bId,
        ringTier: 2,
        angle: (i / 10) * Math.PI * 2,
        dist: 145,
        points: 80,
        isGold: false,
        ringsAttached: 0,
        color: outerColors[i % outerColors.length]
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Rotate Concentric Trays
    for (let t = 0; t < 3; t++) {
      this.trayAngles[t] += this.traySpeeds[t] * dt;
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      ps.cooldown = Math.max(0, ps.cooldown - dt);

      // Analog Aim Steering
      const steer = this.input.getSteer(p.id);
      if (Math.abs(steer) > 0.15) {
        ps.aimAngle += steer * 2.6 * dt;
      }

      // Clamp aim arc
      const minA = -Math.PI * 0.85;
      const maxA = -Math.PI * 0.15;
      ps.aimAngle = Math.max(minA, Math.min(maxA, ps.aimAngle));

      // Pitch Ring (Tap / Space / Action)
      const shoot = this.input.justAction(p.id) || (this.input.justPressed(p.id) && Math.abs(steer) < 0.2);
      if (shoot && ps.cooldown <= 0) {
        ps.cooldown = 0.32; // Snappy throwing cadence

        // Calculate target location based on aim line intersecting the bottle stand
        const rayLen = 220 + Math.random() * 80;
        const targetX = ps.baseX + Math.cos(ps.aimAngle) * rayLen;
        const targetY = ps.baseY + Math.sin(ps.aimAngle) * rayLen;

        this.flyingHoops.push({
          id: ++this.hoopCounter,
          playerId: p.id,
          color: p.color,
          startX: ps.baseX,
          startY: ps.baseY - 14,
          x: ps.baseX,
          y: ps.baseY - 14,
          targetX,
          targetY,
          targetBottleId: null,
          progress: 0,
          speed: 1.8,
          scale: 1.0,
          alive: true
        });

        this.audio.playWhoosh();
      }
    }

    // Update Flying Hoops in 3D perspective
    for (let i = this.flyingHoops.length - 1; i >= 0; i--) {
      const hoop = this.flyingHoops[i];
      if (!hoop.alive) {
        this.flyingHoops.splice(i, 1);
        continue;
      }

      hoop.progress += hoop.speed * dt;
      // Parabolic flight arc
      const t = hoop.progress;
      hoop.x = hoop.startX + (hoop.targetX - hoop.startX) * t;
      hoop.y = hoop.startY + (hoop.targetY - hoop.startY) * t - Math.sin(t * Math.PI) * 65;
      hoop.scale = 1.0 - t * 0.45; // Shrinks as it travels deeper into the booth

      // Landing check when t >= 1.0
      if (t >= 1.0) {
        hoop.alive = false;

        // Check if landed around any bottle neck
        let ringer = false;
        for (const b of this.bottles) {
          const bAngle = b.angle + this.trayAngles[b.ringTier];
          const bx = this.boothCenterX + Math.cos(bAngle) * b.dist;
          const by = this.boothCenterY + Math.sin(bAngle) * b.dist;

          const dist = Math.hypot(hoop.targetX - bx, hoop.targetY - by);
          if (dist <= 24) {
            ringer = true;
            b.ringsAttached++;

            const ps = this.playerStates.get(hoop.playerId);
            if (ps) {
              ps.ringersCount++;
              ps.combo++;
              const mult = ps.combo >= 3 ? 2.0 : ps.combo >= 2 ? 1.5 : 1.0;
              const earned = Math.round(b.points * mult);
              ps.score += earned;

              this.audio.playCoin();
              this.particles.spawnConfetti(bx, by, 14);

              const label = ps.combo >= 2 ? `RINGER! +${earned} (${mult}x)` : `RINGER! +${earned}`;
              this.particles.showFloatingText(label, bx, by - 24, b.color, 24);

              if (b.isGold) {
                this.audio.playScore();
                this.particles.showFloatingText('★ GOLDEN RINGER! ★', bx, by - 44, '#FACC15', 26);
              }
            }
            break;
          }
        }

        if (!ringer) {
          // Miss / clatter
          this.audio.playTap();
          const ps = this.playerStates.get(hoop.playerId);
          if (ps) ps.combo = 0;
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
    const ps = this.playerStates.get(botId);
    if (!ps) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    ps.botReactionTimer = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.18 : 0.35;

    // Pick best bottle target
    let bestTarget: BottleTarget | null = null;
    let bestScore = -9999;

    for (const b of this.bottles) {
      const bAngle = b.angle + this.trayAngles[b.ringTier];
      const bx = this.boothCenterX + Math.cos(bAngle) * b.dist;
      const by = this.boothCenterY + Math.sin(bAngle) * b.dist;

      const dx = bx - ps.baseX;
      const dy = by - ps.baseY;
      const dist = Math.hypot(dx, dy);

      let val = b.points;
      if (b.isGold) val += 150;

      const score = val - dist * 0.15;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = b;
      }
    }

    if (!bestTarget) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Lead calculation on rotating tray
    const bAngle = bestTarget.angle + this.trayAngles[bestTarget.ringTier];
    let bx = this.boothCenterX + Math.cos(bAngle) * bestTarget.dist;
    let by = this.boothCenterY + Math.sin(bAngle) * bestTarget.dist;

    if (difficulty !== 'bot_easy') {
      const distToB = Math.hypot(bx - ps.baseX, by - ps.baseY);
      const flightTime = distToB / 450;
      const leadAngle = bAngle + this.traySpeeds[bestTarget.ringTier] * flightTime;
      bx = this.boothCenterX + Math.cos(leadAngle) * bestTarget.dist;
      by = this.boothCenterY + Math.sin(leadAngle) * bestTarget.dist;
    }

    const desiredAngle = Math.atan2(by - ps.baseY, bx - ps.baseX);
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
    // 1. Midway Booth Background
    this.renderBooth(ctx, width, height);

    // 2. Concentric Trays & Glass Bottles
    this.renderTraysAndBottles(ctx);

    // 3. Flying Hoops (3D perspective scaling)
    this.renderHoops(ctx);

    // 4. Players Pitch Stations & Mascots
    this.renderPlayers(ctx);

    // 5. Theme Pill (bottom-left)
    this.renderThemePill(ctx, height);
  }

  private renderBooth(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.ringTheme === 'midway') {
      ctx.fillStyle = '#451A03'; // Rich mahogany wood
    } else if (this.ringTheme === 'neon') {
      ctx.fillStyle = '#0F172A'; // Dark sci-fi arena
    } else {
      ctx.fillStyle = '#1E1B4B'; // Retro twilight
    }
    ctx.fillRect(0, 0, width, height);

    // Carnival Pennants & Velvet Backdrop
    const pennantCount = 16;
    const pw = width / pennantCount;
    for (let i = 0; i < pennantCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#EF4444' : '#FDE047';
      ctx.beginPath();
      ctx.moveTo(i * pw, 0);
      ctx.lineTo((i + 1) * pw, 0);
      ctx.lineTo((i + 0.5) * pw, 26);
      ctx.closePath();
      ctx.fill();
    }

    // Wooden Counter Barrier at bottom
    ctx.fillStyle = '#78350F';
    ctx.fillRect(0, height - 32, width, 32);
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, height - 32, width, 32);
  }

  private renderTraysAndBottles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.boothCenterX, this.boothCenterY);

    // Draw 3 Concentric Wooden / Neon Tray Discs
    const radii = [35, 95, 165];
    radii.forEach((r, idx) => {
      ctx.fillStyle = this.ringTheme === 'neon' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(120, 53, 15, 0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.ringTheme === 'neon' ? '#06B6D4' : '#B45309';
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    ctx.restore();

    // Draw Glass Bottles
    for (const b of this.bottles) {
      const bAngle = b.angle + this.trayAngles[b.ringTier];
      const bx = this.boothCenterX + Math.cos(bAngle) * b.dist;
      const by = this.boothCenterY + Math.sin(bAngle) * b.dist;

      ctx.save();
      ctx.translate(bx, by);

      // Bottle Shadow
      ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bottle Base
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(-6, -6, 12, 16, 3);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Bottle Neck
      ctx.fillStyle = b.color;
      ctx.fillRect(-3, -16, 6, 10);
      ctx.strokeRect(-3, -16, 6, 10);

      // Gold Sparkle on Gold Bottles
      if (b.isGold) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 3);
      }

      // Render Attached Rings stacked around the neck
      for (let k = 0; k < Math.min(4, b.ringsAttached); k++) {
        ctx.strokeStyle = '#F43F5E';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, -10 + k * 4, 8, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderHoops(ctx: CanvasRenderingContext2D): void {
    for (const hoop of this.flyingHoops) {
      if (!hoop.alive) continue;

      ctx.save();
      ctx.translate(hoop.x, hoop.y);
      ctx.scale(hoop.scale, hoop.scale * 0.7); // Perspective oval

      // Glowing Neon Hoop Ring
      ctx.strokeStyle = hoop.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Highlight Ring
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderPlayers(ctx: CanvasRenderingContext2D): void {
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.baseX, ps.baseY);

      // Aim Arrow Line (laser guide)
      ctx.save();
      ctx.rotate(ps.aimAngle);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(45, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Mascot Pitcher
      const mood = ps.combo >= 2 ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, ps.id, 0, 4, 13, mood, performance.now() * 0.001);

      ctx.restore();

      // Score Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      const comboLabel = ps.combo >= 2 ? ` (${ps.combo}x COMBO!)` : '';
      ctx.fillText(`${ps.score} pts${comboLabel}`, ps.baseX, ps.baseY - 28);
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
    ctx.fillStyle = this.ringTheme === 'midway' ? '#F59E0B' : this.ringTheme === 'neon' ? '#38BDF8' : '#EC4899';
    ctx.fillText(`RING TOSS: ${this.ringTheme.toUpperCase()} [1-3]`, pillX + pillW / 2, pillY + 17);
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

    let mvpHighlight = 'Carnival Hoop Master!';
    if (winnerId !== null) {
      const ps = this.playerStates.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} scored ${ps?.ringersCount || 0} ringers!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
