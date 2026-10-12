import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DinoEgg {
  x: number;
  y: number;
  isGolden: boolean;
  points: number;
  collected: boolean;
}

interface EggScramblePlayer {
  id: PlayerId;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  carriedEggs: DinoEgg[];
  isMoving: boolean;
  score: number;
}

export class TrexEggScrambleGame extends BaseGame {
  private eggs: DinoEgg[] = [];
  private playersState: Map<PlayerId, EggScramblePlayer> = new Map();
  private trexState: 'SLEEPING' | 'WARNING' | 'AWAKE' = 'SLEEPING';
  private trexTimer: number = 3.5;
  private eyeOpenProgress: number = 0;

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
    this.trexState = 'SLEEPING';
    this.trexTimer = 3.0;
    this.eyeOpenProgress = 0;
    this.eggs = [];
    this.playersState.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const margin = 45;

    // Corner home nests
    const corners = [
      { x: margin, y: height - margin },
      { x: width - margin, y: height - margin },
      { x: margin, y: margin + 30 },
      { x: width - margin, y: margin + 30 }
    ];

    active.forEach((p, idx) => {
      const c = corners[idx % corners.length];
      this.playersState.set(p.id, {
        id: p.id,
        x: c.x,
        y: c.y,
        homeX: c.x,
        homeY: c.y,
        carriedEggs: [],
        isMoving: false,
        score: 0
      });
    });

    this.spawnEggNest(width, height);
  }

  private spawnEggNest(width: number, height: number): void {
    const cx = width / 2;
    const cy = height * 0.58;
    this.eggs = [];

    // Scatter 8 eggs in center nest
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 25 + (i % 3) * 22;
      const isGolden = i === 0 || i === 4;
      this.eggs.push({
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        isGolden,
        points: isGolden ? 45 : 20,
        collected: false
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // T-Rex Sleep / Awake Cycle
    this.trexTimer -= dt;
    if (this.trexState === 'SLEEPING') {
      if (this.trexTimer <= 1.0) {
        this.trexState = 'WARNING';
        this.audio.playWhoosh();
      }
    } else if (this.trexState === 'WARNING') {
      this.eyeOpenProgress = Math.min(1.0, this.eyeOpenProgress + dt * 2.5);
      if (this.trexTimer <= 0) {
        this.trexState = 'AWAKE';
        this.trexTimer = 1.4; // awake duration
        this.eyeOpenProgress = 1.0;
        this.audio.playExplosion();
        this.particles.shake(0.3);
      }
    } else if (this.trexState === 'AWAKE') {
      if (this.trexTimer <= 0) {
        this.trexState = 'SLEEPING';
        this.trexTimer = 2.8 + Math.random() * 1.5;
        this.eyeOpenProgress = 0;
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const moveMag = Math.hypot(steerX, steerY);
      const isMoving = moveMag > 0.2 || this.input.isPressed(p.id);
      ps.isMoving = isMoving;

      // Caught moving while T-Rex is awake!
      if (this.trexState === 'AWAKE' && isMoving) {
        // Roared at!
        if (ps.carriedEggs.length > 0) {
          const dropped = ps.carriedEggs.pop();
          if (dropped) {
            dropped.collected = false;
            dropped.x = ps.x + (Math.random() - 0.5) * 30;
            dropped.y = ps.y + (Math.random() - 0.5) * 30;
          }
        }
        // Knock back towards home
        ps.x = ps.homeX;
        ps.y = ps.homeY;
        this.audio.playStun();
        this.particles.showFloatingText('ROAR! CAUGHT!', ps.x, ps.y - 20, '#EF4444', 20);
        this.particles.spawnExplosion(ps.x, ps.y, '#EF4444', 10);
        continue;
      }

      if (isMoving) {
        const speed = ps.carriedEggs.length > 0 ? 150 : 200;
        const normX = moveMag > 0.001 ? steerX / moveMag : 0;
        const normY = moveMag > 0.001 ? steerY / moveMag : 0;

        ps.x += normX * speed * dt;
        ps.y += normY * speed * dt;

        ps.x = Math.max(30, Math.min(width - 30, ps.x));
        ps.y = Math.max(90, Math.min(height - 30, ps.y));
      }

      // Pick up eggs from nest (max 3)
      if (ps.carriedEggs.length < 3) {
        for (const egg of this.eggs) {
          if (!egg.collected && Math.hypot(ps.x - egg.x, ps.y - egg.y) < 22) {
            egg.collected = true;
            ps.carriedEggs.push(egg);
            this.audio.playBounce();
            this.particles.showFloatingText(`+EGG`, egg.x, egg.y - 14, egg.isGolden ? '#FBBF24' : '#E2E8F0', 16);
            break;
          }
        }
      }

      // Bank eggs at home nest
      if (ps.carriedEggs.length > 0 && Math.hypot(ps.x - ps.homeX, ps.y - ps.homeY) < 36) {
        let totalGain = 0;
        while (ps.carriedEggs.length > 0) {
          const e = ps.carriedEggs.pop();
          if (e) totalGain += e.points;
        }
        ps.score += totalGain;
        this.audio.playScore();
        this.particles.showFloatingText(`BANKED +${totalGain}!`, ps.homeX, ps.homeY - 24, '#10B981', 22);
        this.particles.spawnConfetti(ps.homeX, ps.homeY, 12);
      }
    }

    // Respawn eggs if nest is empty
    if (this.eggs.every((e) => e.collected)) {
      this.spawnEggNest(width, height);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Prehistoric Volcanic Cave Nest
    const bgGrad = ctx.createRadialGradient(width / 2, height * 0.4, 20, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, '#2E1065');
    bgGrad.addColorStop(0.5, '#1E1B4B');
    bgGrad.addColorStop(1, '#0B091A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Giant Sleeping / Waking T-Rex Head at Top Center
    const trexX = width / 2;
    const trexY = 62;

    ctx.save();
    // Massive Green Scaled T-Rex Jaw and Snout
    ctx.fillStyle = '#065F46';
    ctx.beginPath();
    ctx.ellipse(trexX, trexY, 80, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Nostrils with snoring smoke
    ctx.fillStyle = '#022C22';
    ctx.beginPath();
    ctx.arc(trexX - 35, trexY + 12, 6, 0, Math.PI * 2);
    ctx.arc(trexX + 35, trexY + 12, 6, 0, Math.PI * 2);
    ctx.fill();

    if (this.trexState === 'SLEEPING') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '700 13px sans-serif';
      ctx.fillText('Zzz...', trexX + 42, trexY - 8);
    }

    // T-Rex Amber Eye
    const eyeX = trexX;
    const eyeY = trexY - 14;

    ctx.fillStyle = '#022C22';
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.eyeOpenProgress > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, 16, 10 * this.eyeOpenProgress, 0, 0, Math.PI * 2);
      ctx.clip();
      // Glowing Amber Iris
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(eyeX - 16, eyeY - 10, 32, 20);
      // Slit Pupil
      ctx.fillStyle = '#000000';
      ctx.fillRect(eyeX - 2.5, eyeY - 10, 5, 20);
      ctx.restore();
    } else {
      // Slit closed eyelid line
      ctx.strokeStyle = '#064E3B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(eyeX - 16, eyeY);
      ctx.lineTo(eyeX + 16, eyeY);
      ctx.stroke();
    }

    // Status warning text banner
    ctx.textAlign = 'center';
    ctx.font = '900 13px Montserrat, sans-serif';
    if (this.trexState === 'AWAKE') {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('⚠️ T-REX AWAKE! FREEZE!! ⚠️', trexX, trexY + 54);
    } else if (this.trexState === 'WARNING') {
      ctx.fillStyle = '#F59E0B';
      ctx.fillText('⚡ T-REX STIRRING... STOP! ⚡', trexX, trexY + 54);
    } else {
      ctx.fillStyle = '#10B981';
      ctx.fillText('💤 T-Rex Sleeping — Sneak Eggs!', trexX, trexY + 54);
    }
    ctx.restore();

    // 3. Center Dinosaur Nest Straw & Foliage
    const nestX = width / 2;
    const nestY = height * 0.58;
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.ellipse(nestX, nestY, 78, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 4. Draw Eggs in Nest
    for (const egg of this.eggs) {
      if (egg.collected) continue;
      ctx.save();
      ctx.translate(egg.x, egg.y);
      ctx.fillStyle = egg.isGolden ? '#FBBF24' : '#F1F5F9';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 12, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = egg.isGolden ? '#D97706' : '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Player Home Corner Nests & Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Home bank zone
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(ps.homeX, ps.homeY, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = p.color;
      ctx.font = '700 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SAFE NEST', ps.homeX, ps.homeY + 4);

      // Player circle
      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Carried eggs behind player
      ps.carriedEggs.forEach((_, eIdx) => {
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(-14 - eIdx * 8, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Player score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 20);
    }

    // 6. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 24);
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

    // React to T-Rex state
    if (this.trexState === 'AWAKE' || (this.trexState === 'WARNING' && difficulty !== 'bot_easy')) {
      // Freeze!
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Decide target: if carrying 2+ eggs, head home! Otherwise head to nearest uncollected egg
    let targetX = ps.homeX;
    let targetY = ps.homeY;

    if (ps.carriedEggs.length < 2) {
      let minDist = 9999;
      let targetEgg: DinoEgg | null = null;
      for (const e of this.eggs) {
        if (!e.collected) {
          const d = Math.hypot(e.x - ps.x, e.y - ps.y);
          if (d < minDist) {
            minDist = d;
            targetEgg = e;
          }
        }
      }
      if (targetEgg) {
        targetX = targetEgg.x;
        targetY = targetEgg.y;
      }
    }

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
      mvpHighlight: winnerId ? `${winnerId} poached the prime prehistoric T-Rex eggs!` : 'Tied egg scramble!'
    };
  }
}
