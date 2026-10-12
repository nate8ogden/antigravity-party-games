import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Offering {
  weight: number;
  label: string;
  color: string;
}

interface ScalesStation {
  id: PlayerId;
  x: number;
  y: number;
  currentWeight: number;
  targetWeight: number;
  tiltAngle: number;
  upcomingOffering: Offering;
  offeringX: number;
  score: number;
  combo: number;
  judgedTimer: number;
  lockoutTimer: number;
}

const OFFERING_TYPES: Offering[] = [
  { weight: 10, label: 'Lapis Bead', color: '#2980b9' },
  { weight: 25, label: 'Alabaster Jar', color: '#ecf0f1' },
  { weight: 40, label: 'Golden Ankh', color: '#f1c40f' },
  { weight: 65, label: 'Granite Sin', color: '#7f8c8d' },
];

export class AnubisScalesGame extends BaseGame {
  public stations: Map<PlayerId, ScalesStation> = new Map();
  public currentMapName: string = 'Hall of Two Truths';
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.stations.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      this.stations.set(p.id, {
        id: p.id,
        x: cx,
        y: height * 0.65,
        currentWeight: 0,
        targetWeight: 100,
        tiltAngle: -0.3,
        upcomingOffering: OFFERING_TYPES[Math.floor(Math.random() * OFFERING_TYPES.length)],
        offeringX: 0,
        score: 0,
        combo: 0,
        judgedTimer: 0,
        lockoutTimer: 0,
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    this.stations.forEach((st) => {
      const p = this.getPlayer(st.id);
      if (st.lockoutTimer > 0) st.lockoutTimer -= dt;
      if (st.judgedTimer > 0) st.judgedTimer -= dt;

      st.offeringX = Math.sin(Date.now() * 0.004) * 22;

      const weightDiff = st.currentWeight - st.targetWeight;
      const desiredTilt = Math.max(-0.45, Math.min(0.45, (weightDiff / st.targetWeight) * 0.45));
      st.tiltAngle += (desiredTilt - st.tiltAngle) * dt * 4;

      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(st.id) || this.input.justAction(st.id);
        if (justPressed && st.lockoutTimer <= 0) {
          this.dropOffering(st);
        }
      }
    });
  }

  private dropOffering(st: ScalesStation): void {
    st.currentWeight += st.upcomingOffering.weight;
    this.audio.playTone(320 + st.upcomingOffering.weight * 3, 0.1, 'triangle');
    this.particles.emit(st.x + 40, st.y + 10, 8, st.upcomingOffering.color);

    if (st.currentWeight >= st.targetWeight - 5 && st.currentWeight <= st.targetWeight + 5) {
      this.judgeScales(st);
    } else if (st.currentWeight > st.targetWeight + 15) {
      st.score = Math.max(0, st.score - 20);
      st.combo = 0;
      st.lockoutTimer = 0.8;
      this.audio.playTone(130, 0.25, 'sawtooth');
      this.particles.emit(st.x + 40, st.y + 20, 16, '#e74c3c');
      st.currentWeight = 0;
    }

    st.upcomingOffering = OFFERING_TYPES[Math.floor(Math.random() * OFFERING_TYPES.length)];
  }

  private judgeScales(st: ScalesStation): void {
    const diff = Math.abs(st.currentWeight - st.targetWeight);
    if (diff <= 10) {
      const bonus = diff <= 2 ? 50 : 30;
      st.score += bonus + st.combo * 4;
      st.combo++;
      this.audio.playTone(740 + st.combo * 30, 0.2, 'sine');
      this.particles.emit(st.x, st.y - 40, 20, '#f1c40f');
    }
    st.currentWeight = 0;
    st.targetWeight = 75 + Math.floor(Math.random() * 5) * 15;
    st.lockoutTimer = 0.5;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const st = this.stations.get(botId);
    if (!st || st.lockoutTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const nextWeight = st.currentWeight + st.upcomingOffering.weight;
      const willFit = nextWeight <= st.targetWeight + (difficulty === 'bot_hard' ? 5 : 15);
      if (willFit) {
        this.dropOffering(st);
        bTimer = difficulty === 'bot_hard' ? 0.35 : difficulty === 'bot_normal' ? 0.5 : 0.7;
      } else {
        if (Math.abs(st.currentWeight - st.targetWeight) <= 15) {
          this.judgeScales(st);
          bTimer = 0.8;
        } else {
          bTimer = 0.4;
        }
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#151520');
    bgGrad.addColorStop(0.6, '#231828');
    bgGrad.addColorStop(1, '#0e0b12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(212, 175, 55, 0.08)';
    for (let x = 30; x < width; x += 120) {
      ctx.fillRect(x, 80, 20, height * 0.7);
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.stations.forEach((st, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#f39c12';

      ctx.fillStyle = '#4a235a';
      ctx.fillRect(st.x - 35, st.y + 35, 70, 20);

      ctx.fillStyle = '#d4af37';
      ctx.fillRect(st.x - 4, st.y - 40, 8, 80);

      ctx.save();
      ctx.translate(st.x, st.y - 40);
      ctx.rotate(st.tiltAngle);

      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-55, -4, 110, 8);

      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-50, 0);
      ctx.lineTo(-50, 36);
      ctx.stroke();
      ctx.fillStyle = '#b7950b';
      ctx.beginPath();
      ctx.ellipse(-50, 38, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#5dade2';
      ctx.beginPath();
      ctx.ellipse(-50, 30, 4, 12, 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(50, 0);
      ctx.lineTo(50, 36);
      ctx.stroke();
      ctx.fillStyle = '#b7950b';
      ctx.beginPath();
      ctx.ellipse(50, 38, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      const stackCount = Math.min(6, Math.floor(st.currentWeight / 15));
      ctx.fillStyle = '#ecf0f1';
      for (let i = 0; i < stackCount; i++) {
        ctx.beginPath();
        ctx.arc(50 + (i % 2 === 0 ? -4 : 4), 34 - i * 5, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      const u = st.upcomingOffering;
      const craneX = st.x + 40 + st.offeringX;
      const craneY = st.y - 85;

      ctx.fillStyle = u.color;
      ctx.beginPath();
      ctx.arc(craneX, craneY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${u.weight}`, craneX, craneY + 3);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${st.currentWeight} / ${st.targetWeight} wt`, st.x, st.y + 70);

      ctx.fillStyle = color;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${cfg?.name ?? pId}: ${st.score}`, st.x, height * 0.9);
      if (st.combo > 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${st.combo}x PURE HEART`, st.x, height * 0.94);
      }
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚖️ TAP TO DROP OFFERING • BALANCE THE FEATHER!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.stations.forEach((st, pId) => scores.set(pId, st.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.stations.entries())
      .map(([playerId, st]) => ({ playerId, score: st.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} weighed a pure heart before Anubis!` : 'All souls were too heavy!',
    };
  }
}
