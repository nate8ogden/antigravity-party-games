import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CogStation {
  id: PlayerId;
  cx: number;
  cy: number;
  driveAngle: number;
  driveSpeed: number;
  targetAngle: number;
  targetSpeed: number;
  score: number;
  combo: number;
  meshAnim: number;
  grindTimer: number;
  teethCount: number;
}

export class ClockworkCogsGame extends BaseGame {
  public stations: Map<PlayerId, CogStation> = new Map();
  public currentMapName: string = 'Big Ben Great Clockwork Tower';
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

    active.forEach((p, idx) => {
      let cx = width * 0.25;
      let cy = height * 0.35;
      if (count === 2) {
        cx = idx === 0 ? width * 0.3 : width * 0.7;
        cy = height * 0.55;
      } else {
        if (idx === 1) cx = width * 0.75;
        if (idx === 2) { cx = width * 0.25; cy = height * 0.75; }
        if (idx === 3) { cx = width * 0.75; cy = height * 0.75; }
      }

      this.stations.set(p.id, {
        id: p.id,
        cx,
        cy,
        driveAngle: Math.random() * Math.PI * 2,
        driveSpeed: 2.2 + Math.random() * 0.6,
        targetAngle: Math.random() * Math.PI * 2,
        targetSpeed: -1.8 - Math.random() * 0.5,
        score: 0,
        combo: 0,
        meshAnim: 0,
        grindTimer: 0,
        teethCount: 12
      });

      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.3);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, width, height);

    this.stations.forEach(station => {
      station.driveAngle += station.driveSpeed * dt;
      station.targetAngle += station.targetSpeed * dt;

      if (station.meshAnim > 0) station.meshAnim -= dt * 3.5;
      if (station.grindTimer > 0) station.grindTimer -= dt;

      if (this.input.justPressed(station.id)) {
        this.attemptMesh(station);
      }
    });
  }

  private attemptMesh(station: CogStation): void {
    if (station.grindTimer > 0) return;

    // Normalize angles and check alignment of golden master teeth
    const normDrive = ((station.driveAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const normTarget = ((station.targetAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // Difference between alignment teeth
    const diff = Math.abs(normDrive - normTarget);
    const angleDiff = Math.min(diff, Math.PI * 2 - diff);

    // Sweet spot is within ~0.4 radians (~23 degrees)
    if (angleDiff < 0.42) {
      // Perfect mesh!
      station.combo++;
      const gain = 25 + station.combo * 5;
      station.score += gain;
      station.meshAnim = 1.0;
      this.audio.playTone(450 + station.combo * 40, 0.12, 'sine');
      this.particles.emit(station.cx, station.cy, 10, '#ffd700');

      // Shift speeds slightly to keep rhythm dynamic
      station.driveSpeed = (station.driveSpeed > 0 ? 1 : -1) * (2.0 + Math.random() * 1.5);
      station.targetSpeed = (station.targetSpeed > 0 ? 1 : -1) * (1.8 + Math.random() * 1.2);
    } else {
      // Grind gears!
      station.combo = 0;
      station.grindTimer = 0.6;
      this.audio.playTone(130, 0.25, 'sawtooth');
      this.particles.emit(station.cx, station.cy, 12, '#ff4400');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const station = this.stations.get(botId);
    if (!station || station.grindTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const normDrive = ((station.driveAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const normTarget = ((station.targetAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const diff = Math.abs(normDrive - normTarget);
    const angleDiff = Math.min(diff, Math.PI * 2 - diff);

    const threshold = difficulty === 'bot_hard' ? 0.28 : difficulty === 'bot_normal' ? 0.38 : 0.52;
    if (angleDiff < threshold) {
      const accuracy = difficulty === 'bot_hard' ? 0.92 : difficulty === 'bot_normal' ? 0.75 : 0.50;
      if (Math.random() < accuracy) {
        this.attemptMesh(station);
        this.botReactionTimers.set(botId, 0.4);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.08);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Steampunk Brass & Dark Bronze Victorian Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1c1510');
    grad.addColorStop(0.5, '#2b1f17');
    grad.addColorStop(1, '#18120c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Background giant shadow clock gear
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.06)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.55, 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f6d365';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MESH CLOCKWORK COGS WHEN GOLD TEETH ALIGN!', width * 0.5, 69);
    ctx.restore();

    // Render Stations
    this.stations.forEach(st => {
      const cfg = this.players.find(p => p.id === st.id);
      const isGrinding = st.grindTimer > 0;

      // Station frame plate
      ctx.save();
      ctx.fillStyle = 'rgba(20, 16, 12, 0.6)';
      ctx.strokeStyle = isGrinding ? '#ff4422' : 'rgba(212, 175, 55, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(st.cx - 95, st.cy - 75, 190, 150, 12);
      ctx.fill();
      ctx.stroke();

      // Render Drive Gear (Left)
      this.drawGear(ctx, st.cx - 36, st.cy, 36, st.teethCount, st.driveAngle, cfg?.color || '#d4af37', true);

      // Render Driven Gear (Right)
      this.drawGear(ctx, st.cx + 36, st.cy, 36, st.teethCount, st.targetAngle, '#cd7f32', false);

      // Center mesh point spark
      if (st.meshAnim > 0) {
        ctx.fillStyle = `rgba(255, 220, 100, ${st.meshAnim})`;
        ctx.beginPath();
        ctx.arc(st.cx, st.cy, 18 * st.meshAnim, 0, Math.PI * 2);
        ctx.fill();
      }

      // Grinding warning
      if (isGrinding) {
        ctx.fillStyle = '#ff4400';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GEARS JAMMED!', st.cx, st.cy - 52);
      }

      // Player Score & Combo
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name || 'Player'}: ${st.score} Joules`, st.cx, st.cy + 60);

      if (st.combo > 1) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${st.combo}x SYNCHRO!`, st.cx, st.cy - 52);
      }

      ctx.restore();
    });
  }

  private drawGear(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    radius: number,
    teeth: number,
    angle: number,
    color: string,
    isDriver: boolean
  ): void {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(angle);

    // Gear body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 6, 0, Math.PI * 2);
    ctx.fill();

    // Teeth
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const isGoldTooth = i === 0;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = isGoldTooth ? '#ffd700' : color;
      if (isGoldTooth) {
        // Glowing gold tooth marker
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(-4, -radius, 8, 8);
      ctx.restore();
    }

    // Inner brass spokes
    ctx.strokeStyle = '#18120c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 14, 0, Math.PI * 2);
    ctx.stroke();

    // Center hub & bolt
    ctx.fillStyle = isDriver ? '#f5f5f5' : '#111111';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.stations.forEach((s, pId) => scores.set(pId, s.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.stations.entries())
      .map(([playerId, s]) => ({ playerId, score: s.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} generated peak clockwork torque!` : 'Clockwork halted!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
