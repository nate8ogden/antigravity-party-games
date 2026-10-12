import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type MoleType = 'standard' | 'king' | 'star' | 'tnt';

interface MoleBurrow {
  id: number;
  x: number;
  y: number;
  radius: number;
  moleType: MoleType | null;
  peekTimer: number; // seconds remaining emerged
  peekHeight: number; // 0 to 1
  isWhacked: boolean;
  whackAnim: number;
}

interface MolePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  slamAnim: number; // 0 to 1
  stunTimer: number;
  score: number;
  molesWhacked: number;
  whackCount: number;
  botReactionTimer: number;
  patrolIndex: number;
  patrolTimer: number;
}

export class MolePanicGame extends BaseGame {
  private playersState: Map<PlayerId, MolePlayer> = new Map();
  private burrows: MoleBurrow[] = [];
  private currentMapName: string = 'Carnival Fairground';
  private spawnInterval: number = 0.8;
  private spawnTimer: number = 0;

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
    this.roundTimer = 40;
    this.spawnTimer = 0.5;

    this.generateProceduralMap(width, height);
    this.initPlayers(width, height);
  }

  private generateProceduralMap(width: number, height: number): void {
    const maps = [
      'Carnival Fairground',
      'Alien Mushroom Glade',
      'Cyber Junk Yard',
      'Arctic Igloo Field'
    ];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];

    // Grid of 4 columns x 3 rows = 12 burrows
    this.burrows = [];
    const cols = 4;
    const rows = 3;
    const startX = width * 0.18;
    const endX = width * 0.82;
    const startY = height * 0.32;
    const endY = height * 0.82;

    const stepX = (endX - startX) / (cols - 1);
    const stepY = (endY - startY) / (rows - 1);

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.burrows.push({
          id: ++id,
          x: startX + c * stepX,
          y: startY + r * stepY,
          radius: 26,
          moleType: null,
          peekTimer: 0,
          peekHeight: 0,
          isWhacked: false,
          whackAnim: 0
        });
      }
    }
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const corners = [
      { x: width * 0.22, y: height * 0.32 },
      { x: width * 0.78, y: height * 0.32 },
      { x: width * 0.22, y: height * 0.82 },
      { x: width * 0.78, y: height * 0.82 }
    ];

    active.forEach((p, idx) => {
      const c = corners[idx % corners.length];
      this.playersState.set(p.id, {
        id: p.id,
        x: c.x,
        y: c.y,
        vx: 0,
        vy: 0,
        targetX: c.x,
        targetY: c.y,
        slamAnim: 0,
        stunTimer: 0,
        score: 0,
        molesWhacked: 0,
        whackCount: 0,
        botReactionTimer: 0.15 + idx * 0.08,
        patrolIndex: idx % Math.max(1, this.burrows.length),
        patrolTimer: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot inputs via BaseGame
    this.updateBots(dt, width, height);

    // Mole spawn maintenance
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.6 + Math.random() * 0.4;
      this.spawnRandomMole();
    }

    // Update Burrows & Emerging Moles
    for (const b of this.burrows) {
      if (b.whackAnim > 0) b.whackAnim = Math.max(0, b.whackAnim - dt * 4.0);

      if (b.moleType !== null) {
        b.peekTimer -= dt;
        if (b.peekTimer <= 0) {
          // Retreat back into burrow
          b.peekHeight -= dt * 4.0;
          if (b.peekHeight <= 0) {
            b.moleType = null;
            b.peekHeight = 0;
            b.isWhacked = false;
          }
        } else {
          // Pop up smoothly
          b.peekHeight = Math.min(1.0, b.peekHeight + dt * 6.0);
        }
      }
    }

    // Update Players & Mallets
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer = Math.max(0, ps.stunTimer - dt);
        continue;
      }

      if (ps.slamAnim > 0) ps.slamAnim = Math.max(0, ps.slamAnim - dt * 6.0);

      // Read Input
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const slam = this.input.justAction(p.id) || (this.input.justPressed(p.id) && steer === 0 && throttle === 0);

      // Mallet movement (manual directional or single-touch burrow cycle)
      if (steer !== 0 || throttle !== 0) {
        const moveSpeed = 360;
        ps.vx = steer * moveSpeed;
        ps.vy = -throttle * moveSpeed;
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;
      } else {
        // Single-button mobile fallback: smoothly cycle across burrows
        ps.patrolTimer += dt;
        if (ps.patrolTimer >= 0.75) {
          ps.patrolTimer = 0;
          ps.patrolIndex = (ps.patrolIndex + 1) % this.burrows.length;
        }
        const targetBurrow = this.burrows[ps.patrolIndex];
        if (targetBurrow) {
          ps.x += (targetBurrow.x - ps.x) * Math.min(1, dt * 7.5);
          ps.y += (targetBurrow.y - ps.y) * Math.min(1, dt * 7.5);
        }
      }

      // Arena boundary limits
      ps.x = Math.max(width * 0.1, Math.min(width * 0.9, ps.x));
      ps.y = Math.max(height * 0.22, Math.min(height * 0.9, ps.y));

      // Handle Mallet Slam
      if (slam && ps.slamAnim <= 0.1) {
        // If single-touch, snap to current targeted burrow for clean hit
        if (steer === 0 && throttle === 0 && this.burrows[ps.patrolIndex]) {
          ps.x = this.burrows[ps.patrolIndex].x;
          ps.y = this.burrows[ps.patrolIndex].y;
        }
        ps.slamAnim = 1.0;
        this.executeMalletSlam(ps, p.color);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnRandomMole(): void {
    // Pick an empty burrow
    const emptyBurrows = this.burrows.filter((b) => b.moleType === null);
    if (emptyBurrows.length === 0) return;

    const chosen = emptyBurrows[Math.floor(Math.random() * emptyBurrows.length)];
    const roll = Math.random();

    let type: MoleType = 'standard';
    let duration = 1.6;

    if (roll < 0.45) {
      type = 'standard';
      duration = 1.6;
    } else if (roll < 0.72) {
      type = 'king';
      duration = 1.4;
    } else if (roll < 0.86) {
      type = 'star';
      duration = 1.0; // Fast peek!
    } else {
      type = 'tnt';
      duration = 1.8;
    }

    chosen.moleType = type;
    chosen.peekTimer = duration;
    chosen.peekHeight = 0;
    chosen.isWhacked = false;
  }

  private executeMalletSlam(ps: MolePlayer, color: string): void {
    ps.whackCount++;
    this.audio.playSqueak();

    // Check if any mole burrow is hit
    let hitMole = false;
    for (const b of this.burrows) {
      if (b.moleType === null || b.isWhacked || b.peekHeight < 0.3) continue;

      const d = Math.hypot(ps.x - b.x, ps.y - b.y);
      if (d <= b.radius + 18) {
        // WHACK!
        b.isWhacked = true;
        b.whackAnim = 1.0;
        b.peekTimer = 0.25; // drop down soon
        hitMole = true;

        if (b.moleType === 'tnt') {
          // Whacked a TNT Mole!
          ps.score = Math.max(0, ps.score - 150);
          ps.stunTimer = 1.4;
          this.audio.playExplosion();
          this.particles.shake(0.35);
          this.particles.showFloatingText('BOOM! -150', b.x, b.y - 25, '#EF4444', 24);
          this.particles.spawnExplosion(b.x, b.y, '#EF4444', 25);
        } else {
          let pts = 100;
          let txtColor = '#FBBF24';
          if (b.moleType === 'king') {
            pts = 250;
            txtColor = '#F59E0B';
          } else if (b.moleType === 'star') {
            pts = 400;
            txtColor = '#EC4899';
          }

          ps.score += pts;
          ps.molesWhacked += 1;

          this.audio.playScore();
          this.particles.shake(0.2);
          this.particles.showFloatingText(`+${pts}!`, b.x, b.y - 30, txtColor, 24);
          this.particles.spawnConfetti(b.x, b.y, 16);
        }
        break;
      }
    }

    if (!hitMole) {
      this.particles.spawnDust(ps.x, ps.y + 10, 6);
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
    if (!ps || ps.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const interval =
      difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.1 : 0.2;
    ps.botReactionTimer = interval;

    // Search for best emerging mole target
    let targetBurrow: MoleBurrow | null = null;
    let bestScore = -9999;

    for (const b of this.burrows) {
      if (b.moleType === null || b.isWhacked || b.peekHeight < 0.25) continue;

      const d = Math.hypot(b.x - ps.x, b.y - ps.y);
      let score = 100 - d;

      if (b.moleType === 'star') score += 350;
      else if (b.moleType === 'king') score += 200;
      else if (b.moleType === 'tnt') score -= 600;

      if (score > bestScore) {
        bestScore = score;
        targetBurrow = b;
      }
    }

    let steer = 0;
    let throttle = 0;
    let slam = false;

    if (targetBurrow) {
      const dx = targetBurrow.x - ps.x;
      const dy = targetBurrow.y - ps.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 12) {
        steer = dx > 0 ? 1 : -1;
        throttle = dy > 0 ? 1 : -1;
      } else {
        // In range to slam!
        if (targetBurrow.moleType !== 'tnt' || (difficulty === 'bot_easy' && Math.random() < 0.3)) {
          slam = true;
        }
      }
    }

    this.input.setBotInput(botId, slam, steer, throttle, slam);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Carnival Board Background
    this.renderBoardBackground(ctx, width, height);

    // 2. Burrows & Moles
    for (const b of this.burrows) {
      this.renderBurrowAndMole(ctx, b);
    }

    // 3. Players / Squeaky Mallets
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderMalletPlayer(ctx, ps, p.color);
    }

    // 4. Center HUD Pod
    this.renderCenterHudPod(ctx, width);
  }

  private renderBoardBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (this.currentMapName === 'Carnival Fairground') {
      bgGrad.addColorStop(0, '#78350F');
      bgGrad.addColorStop(1, '#451A03');
    } else if (this.currentMapName === 'Alien Mushroom Glade') {
      bgGrad.addColorStop(0, '#3B0764');
      bgGrad.addColorStop(1, '#1E1B4B');
    } else if (this.currentMapName === 'Cyber Junk Yard') {
      bgGrad.addColorStop(0, '#1E293B');
      bgGrad.addColorStop(1, '#0F172A');
    } else {
      // Arctic Igloo Field
      bgGrad.addColorStop(0, '#0284C7');
      bgGrad.addColorStop(1, '#0369A1');
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative board border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 3;
    ctx.strokeRect(width * 0.08, height * 0.22, width * 0.84, height * 0.72);
  }

  private renderBurrowAndMole(ctx: CanvasRenderingContext2D, b: MoleBurrow): void {
    // Burrow Dirt Rim
    ctx.fillStyle = '#1C1917';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.radius, b.radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#44403C';
    ctx.stroke();

    // Deep Burrow Hole
    ctx.fillStyle = '#0C0A09';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.radius * 0.8, b.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Render Emerging Mole
    if (b.moleType !== null && b.peekHeight > 0) {
      ctx.save();
      const moleY = b.y - b.peekHeight * 28;
      ctx.translate(b.x, moleY);

      // Squish scale if whacked
      if (b.isWhacked) {
        ctx.scale(1.4, 0.35);
      }

      // Mole Head
      ctx.beginPath();
      ctx.arc(0, 0, 16, Math.PI, 0, false);
      ctx.lineTo(16, 12);
      ctx.lineTo(-16, 12);
      ctx.closePath();

      if (b.moleType === 'star') {
        ctx.fillStyle = '#EC4899';
      } else if (b.moleType === 'king') {
        ctx.fillStyle = '#F59E0B';
      } else if (b.moleType === 'tnt') {
        ctx.fillStyle = '#DC2626';
      } else {
        ctx.fillStyle = '#78350F';
      }
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-5, -4, 3.5, 0, Math.PI * 2);
      ctx.arc(5, -4, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Pupils (Dizzy X if whacked)
      ctx.fillStyle = '#0F172A';
      if (b.isWhacked) {
        ctx.font = '700 8px monospace';
        ctx.fillText('x', -7, -2);
        ctx.fillText('x', 3, -2);
      } else {
        ctx.beginPath();
        ctx.arc(-5, -4, 1.8, 0, Math.PI * 2);
        ctx.arc(5, -4, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Snout / Pink Nose
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.arc(0, 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Accessories
      if (b.moleType === 'king') {
        // Golden Crown
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.moveTo(-10, -15);
        ctx.lineTo(-6, -8);
        ctx.lineTo(0, -15);
        ctx.lineTo(6, -8);
        ctx.lineTo(10, -15);
        ctx.lineTo(8, -5);
        ctx.lineTo(-8, -5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (b.moleType === 'star') {
        // Sparkling Star
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(0, -12, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.moleType === 'tnt') {
        // Fuse
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(3, -20);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderMalletPlayer(
    ctx: CanvasRenderingContext2D,
    ps: MolePlayer,
    color: string
  ): void {
    ctx.save();
    ctx.translate(ps.x, ps.y);

    // Stun flurry if dazed
    if (ps.stunTimer > 0) {
      const a = performance.now() * 0.008;
      ctx.fillStyle = '#FBBF24';
      for (let s = 0; s < 3; s++) {
        const starA = a + (s * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(starA) * 16, Math.sin(starA) * 16 - 15, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Slam tilt angle
    const tilt = ps.slamAnim * 0.65;
    ctx.rotate(tilt);

    // Mallet Handle (Wooden rod)
    ctx.fillStyle = '#92400E';
    ctx.fillRect(-3, -24, 6, 28);
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, -24, 6, 28);

    // Giant Squeaky Mallet Head
    const headW = 34;
    const headH = 20;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-headW / 2, -24 - headH, headW, headH, 5);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Rubber Mallet End Caps
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-headW / 2, -24 - headH + 3, 4, headH - 6);
    ctx.fillRect(headW / 2 - 4, -24 - headH + 3, 4, headH - 6);

    ctx.restore();

    // Score Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.score}`, ps.x, ps.y - 48);
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`ARENA: ${this.currentMapName}`, podX + 16, podY + 17);

    // Timer display
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const timerColor = this.roundTimer < 10 ? '#EF4444' : '#F1F5F9';
    ctx.fillStyle = timerColor;
    ctx.fillText(`TIME: ${this.roundTimer.toFixed(1)}s`, podX + podW - 16, podY + 17);
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

    let mvpHighlight = 'Carnival Whack Champion!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} clobbered ${ps?.molesWhacked || 0} moles with sheer precision!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
