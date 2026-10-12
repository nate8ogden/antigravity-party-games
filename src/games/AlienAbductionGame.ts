import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface GroundTarget {
  id: number;
  x: number;
  type: 'cow' | 'golden_cow' | 'dynamite_tractor';
  beamedProgress: number; // 0 to 1
  abducted: boolean;
}

interface SaucerPilot {
  id: PlayerId;
  saucerX: number;
  saucerY: number;
  dir: 1 | -1;
  speed: number;
  beamActive: boolean;
  score: number;
  combo: number;
  stunTimer: number;
  targets: GroundTarget[];
  nextTargetTimer: number;
}

export class AlienAbductionGame extends BaseGame {
  public saucers: Map<PlayerId, SaucerPilot> = new Map();
  public currentMapName: string = 'Area 51 Farmlands';
  private targetIdCounter: number = 0;
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
    this.saucers.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      const initialTargets: GroundTarget[] = [
        { id: ++this.targetIdCounter, x: cx - 40, type: 'cow', beamedProgress: 0, abducted: false },
        { id: ++this.targetIdCounter, x: cx + 30, type: 'golden_cow', beamedProgress: 0, abducted: false },
      ];

      this.saucers.set(p.id, {
        id: p.id,
        saucerX: cx,
        saucerY: height * 0.32,
        dir: 1,
        speed: 95,
        beamActive: false,
        score: 0,
        combo: 0,
        stunTimer: 0,
        targets: initialTargets,
        nextTargetTimer: 2.0,
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

    const count = this.getActivePlayers().length;
    const colWidth = width / Math.max(count, 1);

    this.saucers.forEach((s, pId) => {
      const p = this.getPlayer(pId);
      const idx = this.getActivePlayers().findIndex((pl) => pl.id === pId);
      const minX = idx * colWidth + 30;
      const maxX = (idx + 1) * colWidth - 30;

      if (s.stunTimer > 0) s.stunTimer -= dt;

      // Human input: HOLD to activate tractor beam
      if (p && !p.type.startsWith('bot_')) {
        s.beamActive = this.input.isPressed(pId) && s.stunTimer <= 0;
      }

      // Saucer patrol sway
      s.saucerX += s.dir * s.speed * dt;
      if (s.saucerX > maxX) {
        s.saucerX = maxX;
        s.dir = -1;
      } else if (s.saucerX < minX) {
        s.saucerX = minX;
        s.dir = 1;
      }

      // Spawning new targets
      s.nextTargetTimer -= dt;
      if (s.nextTargetTimer <= 0) {
        const rand = Math.random();
        const type = rand < 0.55 ? 'cow' : rand < 0.8 ? 'golden_cow' : 'dynamite_tractor';
        s.targets.push({
          id: ++this.targetIdCounter,
          x: minX + 20 + Math.random() * (maxX - minX - 40),
          type,
          beamedProgress: 0,
          abducted: false,
        });
        s.nextTargetTimer = 2.5 + Math.random() * 1.5;
      }

      // Tractor Beam interaction
      const groundY = height * 0.76;
      s.targets.forEach((tgt) => {
        if (tgt.abducted) return;

        const inBeamCone = Math.abs(tgt.x - s.saucerX) < 28;
        if (inBeamCone && s.beamActive) {
          tgt.beamedProgress += dt * 1.8;

          if (tgt.type === 'dynamite_tractor') {
            // EXPLOSIVE HAZARD BEAMED!
            tgt.abducted = true;
            s.stunTimer = 1.0;
            s.combo = 0;
            s.score = Math.max(0, s.score - 25);
            this.audio.playTone(110, 0.3, 'sawtooth');
            this.particles.emit(s.saucerX, s.saucerY, 20, '#e74c3c');
          } else if (tgt.beamedProgress >= 1.0) {
            // ABDUCTION COMPLETE!
            tgt.abducted = true;
            const pts = tgt.type === 'golden_cow' ? 50 : 25;
            s.score += pts + s.combo * 4;
            s.combo++;
            this.audio.playTone(720 + s.combo * 30, 0.15, 'sine');
            this.particles.emit(s.saucerX, s.saucerY, 14, '#00e5ff');
          }
        } else {
          tgt.beamedProgress = Math.max(0, tgt.beamedProgress - dt * 2.0);
        }
      });

      s.targets = s.targets.filter((t) => !t.abducted);
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const s = this.saucers.get(botId);
    if (!s || s.stunTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const targetUnderneath = s.targets.find((t) => !t.abducted && Math.abs(t.x - s.saucerX) < 24);
      if (targetUnderneath) {
        if (targetUnderneath.type === 'dynamite_tractor') {
          // Easy bots blunder 28% of the time and beam dynamite tractors; Normal blunders 8%
          const blunders = difficulty === 'bot_easy' ? Math.random() < 0.28 : difficulty === 'bot_normal' ? Math.random() < 0.08 : false;
          s.beamActive = blunders;
        } else {
          // Easy bots occasionally hesitate to beam cows
          const misses = difficulty === 'bot_easy' ? Math.random() < 0.20 : false;
          s.beamActive = !misses;
        }
      } else {
        s.beamActive = false;
      }
      bTimer = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.35 : 0.55;
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Nighttime alien invasion sky background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#030812');
    bgGrad.addColorStop(0.5, '#0a1628');
    bgGrad.addColorStop(0.76, '#0f2416');
    bgGrad.addColorStop(1, '#08140c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const groundY = height * 0.76;
    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.saucers.forEach((s, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#00e5ff';

      // Pasture fence / lane boundary
      ctx.strokeStyle = '#27ae60';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.saucerX - colWidth * 0.5 + 4, groundY);
      ctx.lineTo(s.saucerX + colWidth * 0.5 - 4, groundY);
      ctx.stroke();

      // Tractor Beam Cone
      if (s.beamActive && s.stunTimer <= 0) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
        ctx.beginPath();
        ctx.moveTo(s.saucerX, s.saucerY + 8);
        ctx.lineTo(s.saucerX + 32, groundY);
        ctx.lineTo(s.saucerX - 32, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Ground Targets (Cows & Tractors)
      s.targets.forEach((tgt) => {
        const floatY = groundY - 14 - tgt.beamedProgress * (groundY - s.saucerY - 20);

        ctx.save();
        ctx.translate(tgt.x, floatY);

        if (tgt.type === 'cow' || tgt.type === 'golden_cow') {
          // Spotted Cow / Golden Trophy Cow
          ctx.fillStyle = tgt.type === 'golden_cow' ? '#f1c40f' : '#ecf0f1';
          ctx.beginPath();
          ctx.roundRect(-12, -8, 24, 16, 4);
          ctx.fill();

          if (tgt.type === 'cow') {
            // Black spots
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(-4, -2, 4, 0, Math.PI * 2);
            ctx.arc(6, 2, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          // Cow head
          ctx.fillStyle = tgt.type === 'golden_cow' ? '#f39c12' : '#f5cba7';
          ctx.beginPath();
          ctx.arc(12, -4, 5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Red Dynamite Tractor Hazard
          ctx.fillStyle = '#c0392b';
          ctx.fillRect(-12, -10, 24, 14);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(-4, -6, 8, 6);
          // Big back wheel
          ctx.fillStyle = '#2c3e50';
          ctx.beginPath();
          ctx.arc(-8, 4, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // Flying Saucer (UFO)
      ctx.save();
      ctx.translate(s.saucerX, s.saucerY);

      if (s.stunTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }

      // Glass cockpit dome
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(0, -6, 11, Math.PI, 0);
      ctx.fill();

      // Saucer metal disc
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glowing undercarriage lights
      ctx.fillStyle = s.beamActive ? '#f1c40f' : '#2ecc71';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * 10, 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Score HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${s.score}`, s.saucerX, height * 0.9);
      if (s.combo > 1) {
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${s.combo}x ABDUCTOR`, s.saucerX, height * 0.94);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛸 HOLD TO BEAM UP COWS • DODGE DYNAMITE TRACTORS!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.saucers.forEach((s, pId) => scores.set(pId, s.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.saucers.entries())
      .map(([playerId, s]) => ({ playerId, score: s.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} abducted the prize livestock!` : 'Saucers repelled by the farmers!',
    };
  }
}
