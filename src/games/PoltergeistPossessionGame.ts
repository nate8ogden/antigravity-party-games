import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface HauntedProp {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'TEAPOT' | 'CANDELABRA' | 'CLOCK';
  points: number;
  possessedBy: PlayerId | null;
  possessTimer: number;
}

interface PoltergeistPlayer {
  id: PlayerId;
  x: number;
  y: number;
  score: number;
}

export class PoltergeistPossessionGame extends BaseGame {
  private props: HauntedProp[] = [];
  private playersState: Map<PlayerId, PoltergeistPlayer> = new Map();
  private portalX: number = 0;
  private portalY: number = 0;

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
    this.props = [];
    this.playersState.clear();

    this.portalX = width / 2;
    this.portalY = 60;

    // Spawn 7 floating antique props
    const types: ('TEAPOT' | 'CANDELABRA' | 'CLOCK')[] = ['TEAPOT', 'CANDELABRA', 'CLOCK'];
    for (let i = 0; i < 7; i++) {
      const t = types[i % types.length];
      this.props.push({
        id: i,
        x: 60 + Math.random() * (width - 120),
        y: 110 + Math.random() * (height - 180),
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        type: t,
        points: t === 'CLOCK' ? 50 : t === 'CANDELABRA' ? 30 : 20,
        possessedBy: null,
        possessTimer: 0
      });
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const cx = width / 2;
    const cy = height * 0.65;

    active.forEach((p, idx) => {
      const a = (idx / count) * Math.PI * 2;
      this.playersState.set(p.id, {
        id: p.id,
        x: cx + Math.cos(a) * 80,
        y: cy + Math.sin(a) * 80,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update floating antique props
    for (const prop of this.props) {
      prop.x += prop.vx * dt;
      prop.y += prop.vy * dt;

      if (prop.x < 30 || prop.x > width - 30) prop.vx *= -1;
      if (prop.y < 50 || prop.y > height - 40) prop.vy *= -1;

      if (prop.possessTimer > 0) {
        prop.possessTimer -= dt;
        if (prop.possessTimer <= 0) prop.possessedBy = null;
      }

      // Check delivery into haunted fireplace portal
      if (prop.possessedBy && Math.hypot(prop.x - this.portalX, prop.y - this.portalY) < 46) {
        const ps = this.playersState.get(prop.possessedBy);
        if (ps) ps.score += prop.points;

        this.audio.playScore();
        this.particles.showFloatingText(`PORTAL BANISHED! +${prop.points}`, this.portalX, this.portalY - 20, '#A855F7', 22);
        this.particles.spawnConfetti(this.portalX, this.portalY, 12);

        // Reset prop
        prop.x = 40 + Math.random() * (width - 80);
        prop.y = height * 0.6 + Math.random() * (height * 0.25);
        prop.vx = (Math.random() - 0.5) * 80;
        prop.vy = (Math.random() - 0.5) * 80;
        prop.possessedBy = null;
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const mag = Math.hypot(steerX, steerY);

      if (mag > 0.2) {
        const speed = 220;
        ps.x += (steerX / mag) * speed * dt;
        ps.y += (steerY / mag) * speed * dt;
      }

      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(50, Math.min(height - 40, ps.y));

      // Tap to possess nearest unpossessed antique prop
      const tap = this.input.justPressed(p.id);
      if (tap) {
        let nearestProp: HauntedProp | null = null;
        let minDist = 48;
        for (const pr of this.props) {
          const d = Math.hypot(ps.x - pr.x, ps.y - pr.y);
          if (d < minDist) {
            minDist = d;
            nearestProp = pr;
          }
        }

        if (nearestProp) {
          nearestProp.possessedBy = p.id;
          nearestProp.possessTimer = 3.5;
          // Launch towards fireplace portal
          const angle = Math.atan2(this.portalY - nearestProp.y, this.portalX - nearestProp.x);
          const launchSpeed = 340;
          nearestProp.vx = Math.cos(angle) * launchSpeed;
          nearestProp.vy = Math.sin(angle) * launchSpeed;

          this.audio.playGhostTag();
          this.particles.showFloatingText('POSSESSED!', nearestProp.x, nearestProp.y - 18, p.color, 18);
          this.particles.spawnExplosion(nearestProp.x, nearestProp.y, p.color, 8);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Haunted Victorian Dining Room
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1E1B4B');
    bgGrad.addColorStop(0.5, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Haunted Fireplace Portal at Top
    ctx.save();
    ctx.fillStyle = '#4C1D95';
    ctx.beginPath();
    ctx.arc(this.portalX, this.portalY, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C084FC';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Swirling portal vortex rings
    ctx.strokeStyle = '#E9D5FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.portalX, this.portalY, 26, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 9px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPECTRAL FIREPLACE', this.portalX, this.portalY + 4);
    ctx.restore();

    // 3. Draw Floating Antique Props
    for (const pr of this.props) {
      ctx.save();
      ctx.translate(pr.x, pr.y);

      // Ghostly possession aura
      if (pr.possessedBy) {
        const owner = this.getActivePlayers().find((p) => p.id === pr.possessedBy);
        ctx.shadowColor = owner ? owner.color : '#A855F7';
        ctx.shadowBlur = 16;
      }

      if (pr.type === 'CLOCK') {
        // Grandfather Clock
        ctx.fillStyle = '#78350F';
        ctx.fillRect(-10, -18, 20, 36);
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(0, -8, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.type === 'CANDELABRA') {
        // Brass Candelabra with blue spirit flames
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(0, -6);
        ctx.moveTo(-10, -2);
        ctx.lineTo(10, -2);
        ctx.stroke();
        // Spirit flame
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(-10, -8, 3, 0, Math.PI * 2);
        ctx.arc(0, -12, 3, 0, Math.PI * 2);
        ctx.arc(10, -8, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Porcelain Teapot
        ctx.fillStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Spout & Handle
        ctx.beginPath();
        ctx.moveTo(8, -2);
        ctx.lineTo(16, -6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Draw Poltergeist Ghost Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Translucent ghostly body with flowing tail
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, -4, 12, Math.PI, 0, false);
      ctx.quadraticCurveTo(12, 14, 0, 18);
      ctx.quadraticCurveTo(-12, 14, -12, -4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Glowing Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-4, -4, 3, 0, Math.PI * 2);
      ctx.arc(4, -4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4, -4, 1.5, 0, Math.PI * 2);
      ctx.arc(4, -4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 24);
    }

    // 5. Header HUD
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
    if (!ps) return;

    // Find nearest unpossessed prop
    let targetProp: HauntedProp | null = null;
    let minDist = 9999;
    for (const pr of this.props) {
      if (!pr.possessedBy) {
        const d = Math.hypot(pr.x - ps.x, pr.y - ps.y);
        if (d < minDist) {
          minDist = d;
          targetProp = pr;
        }
      }
    }

    if (targetProp) {
      const dx = targetProp.x - ps.x;
      const dy = targetProp.y - ps.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 42) {
        // Possess!
        this.input.setBotInput(botId, true, 0, 0, true);
      } else {
        const err = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.2 : 0.45;
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * err;
        this.input.setBotInput(botId, true, Math.cos(angle), -Math.sin(angle), false);
      }
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
      mvpHighlight: winnerId ? `${winnerId} possessed the antique dining room with spectral mastery!` : 'Tied poltergeist possession!'
    };
  }
}
