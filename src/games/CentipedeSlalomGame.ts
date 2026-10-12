import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SlalomGate {
  x: number;
  y: number;
  width: number;
  passedBy: Set<PlayerId>;
}

interface CentipedeSegment {
  x: number;
  y: number;
}

interface CentipedePlayer {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  speed: number;
  segments: CentipedeSegment[];
  stunTimer: number;
  score: number;
}

export class CentipedeSlalomGame extends BaseGame {
  private playersState: Map<PlayerId, CentipedePlayer> = new Map();
  private gates: SlalomGate[] = [];
  private scrollOffset: number = 0;

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
    this.roundTimer = 30;
    this.scrollOffset = 0;
    this.gates = [];
    this.playersState.clear();

    // Spawn 7 slalom gates vertically down the garden track
    for (let i = 0; i < 7; i++) {
      this.gates.push({
        x: width * 0.3 + (i % 2 === 0 ? -60 : 60),
        y: 120 + i * 140,
        width: 65,
        passedBy: new Set()
      });
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const startX = spacing * (idx + 1);
      const startY = height - 60;
      const segs: CentipedeSegment[] = [];
      for (let s = 0; s < 6; s++) {
        segs.push({ x: startX, y: startY + (s + 1) * 10 });
      }

      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        angle: -Math.PI / 2,
        speed: 180,
        segments: segs,
        stunTimer: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Scroll gates downward to simulate continuous forward track
    const scrollSpeed = 80;
    for (const g of this.gates) {
      g.y += scrollSpeed * dt;
      if (g.y > height + 40) {
        g.y = -60;
        g.x = width * 0.5 + (Math.random() - 0.5) * (width * 0.5);
        g.passedBy.clear();
      }
    }

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const mag = Math.hypot(steerX, steerY);

      if (mag > 0.2) {
        const targetA = Math.atan2(steerY, steerX);
        let diff = targetA - ps.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        ps.angle += diff * Math.min(1, dt * 7);
      }

      // Move head forward
      ps.x += Math.cos(ps.angle) * ps.speed * dt;
      ps.y += Math.sin(ps.angle) * ps.speed * dt;

      // Keep within track bounds
      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(60, Math.min(height - 40, ps.y));

      // Update trailing body segments (Inverse Kinematics follow)
      let prevX = ps.x;
      let prevY = ps.y;
      const segGap = 9;

      for (const seg of ps.segments) {
        const dx = prevX - seg.x;
        const dy = prevY - seg.y;
        const dist = Math.hypot(dx, dy);
        if (dist > segGap) {
          const angle = Math.atan2(dy, dx);
          seg.x = prevX - Math.cos(angle) * segGap;
          seg.y = prevY - Math.sin(angle) * segGap;
        }
        prevX = seg.x;
        prevY = seg.y;
      }

      // Check passing through slalom gates
      for (const g of this.gates) {
        if (!g.passedBy.has(p.id) && Math.abs(ps.y - g.y) < 14) {
          if (Math.abs(ps.x - g.x) < g.width / 2) {
            // Passed cleanly through slalom gate!
            g.passedBy.add(p.id);
            ps.score += 30;
            this.audio.playWhoosh();
            this.particles.showFloatingText('SLALOM! +30', g.x, g.y - 18, '#10B981', 22);
            this.particles.spawnConfetti(g.x, g.y, 8);
          } else if (Math.abs(ps.x - g.x) < g.width / 2 + 16) {
            // Bumped gate post
            ps.stunTimer = 0.8;
            ps.score = Math.max(0, ps.score - 10);
            this.audio.playStun();
            this.particles.showFloatingText('BUMP! -10', ps.x, ps.y - 20, '#EF4444', 18);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Garden Pebble Track
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1C1917');
    bgGrad.addColorStop(0.5, '#292524');
    bgGrad.addColorStop(1, '#0C0A09');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Moss borders at left and right
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, 0, 24, height);
    ctx.fillRect(width - 24, 0, 24, height);
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 24, height);
    ctx.strokeRect(width - 24, 0, 24, height);

    // 2. Draw Slalom Gates
    for (const g of this.gates) {
      ctx.save();
      const leftPostX = g.x - g.width / 2;
      const rightPostX = g.x + g.width / 2;

      // Gate flag connecting dash line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(leftPostX, g.y);
      ctx.lineTo(rightPostX, g.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Left Red Post
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(leftPostX, g.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Right Red Post
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(rightPostX, g.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Centipedes
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      // Draw trailing body segments
      for (let s = ps.segments.length - 1; s >= 0; s--) {
        const seg = ps.segments[s];
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, 6 - (s / ps.segments.length) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Little yellow feet on sides
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(seg.x - 7, seg.y - 1, 3, 2);
        ctx.fillRect(seg.x + 4, seg.y - 1, 3, 2);
      }

      // Draw Head
      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.angle);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Antennae
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(6, -3);
      ctx.lineTo(14, -8);
      ctx.moveTo(6, 3);
      ctx.lineTo(14, 8);
      ctx.stroke();
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 20);
    }

    // 4. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    // Find closest upcoming gate below or near head
    let nextGate: SlalomGate | null = null;
    let minYDist = 9999;
    for (const g of this.gates) {
      const dy = g.y - ps.y;
      if (dy > -20 && dy < minYDist) {
        minYDist = dy;
        nextGate = g;
      }
    }

    const targetX = nextGate ? nextGate.x : width / 2;
    const targetY = nextGate ? nextGate.y : ps.y + 40;

    const dx = targetX - ps.x;
    const dy = targetY - ps.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      const err = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.2 : 0.45;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * err;
      this.input.setBotInput(botId, true, Math.cos(angle), -Math.sin(angle), true);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} slalomed the garden pebble gates like a lightning centipede!` : 'Tied centipede slalom!'
    };
  }
}
