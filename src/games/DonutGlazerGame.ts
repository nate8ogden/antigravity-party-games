import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MovingDonut {
  x: number;
  glazed: boolean;
  glazeQuality: number; // 0 to 1
}

interface GlazerStation {
  id: PlayerId;
  x: number;
  y: number;
  donuts: MovingDonut[];
  spawnTimer: number;
  score: number;
  combo: number;
  donutsGlazed: number;
  dripAnim: number;
}

export class DonutGlazerGame extends BaseGame {
  public playersState: Map<PlayerId, GlazerStation> = new Map();
  public currentMapName: string = 'Sugar Rush Donut Bakery';

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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.playersState.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height * 0.58,
        donuts: [
          { x: -30, glazed: false, glazeQuality: 0 },
          { x: -110, glazed: false, glazeQuality: 0 }
        ],
        spawnTimer: 1.0,
        score: 0,
        combo: 0,
        donutsGlazed: 0,
        dripAnim: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, _width: number, _height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, _width, _height);

    for (const p of this.getActivePlayers()) {
      const st = this.playersState.get(p.id);
      if (!st) continue;

      if (st.dripAnim > 0) st.dripAnim -= dt * 5;

      // Spawn moving donuts along track
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = 1.2 + Math.random() * 0.4;
        st.donuts.push({ x: -40, glazed: false, glazeQuality: 0 });
      }

      // Move donuts across nozzle (-60 to +60 offset relative to station center)
      for (let i = st.donuts.length - 1; i >= 0; i--) {
        const d = st.donuts[i];
        d.x += 100 * dt;
        if (d.x > 80) {
          st.donuts.splice(i, 1);
        }
      }

      // Check input
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handleGlazeDrip(st);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleGlazeDrip(st: GlazerStation): void {
    st.dripAnim = 1.0;

    // Nozzle is at x = 0 (station center)
    let hitDonut: MovingDonut | null = null;
    let minDist = 9999;

    for (const d of st.donuts) {
      const dist = Math.abs(d.x);
      if (dist < 35 && dist < minDist) {
        minDist = dist;
        hitDonut = d;
      }
    }

    if (hitDonut && !hitDonut.glazed) {
      hitDonut.glazed = true;
      st.donutsGlazed++;

      if (minDist < 10) {
        // PERFECT GLAZE!
        st.combo++;
        hitDonut.glazeQuality = 1.0;
        st.score += 20 + st.combo * 4;
        this.audio.playScore();
        this.particles.spawnSparks(st.x, st.y, '#F48FB1', 10);
      } else {
        // GOOD GLAZE
        hitDonut.glazeQuality = 0.6;
        st.score += 10;
        this.audio.playTap();
        this.particles.emit(st.x, st.y, 4, '#F48FB1');
      }
    } else {
      // Missed drip on conveyor
      st.combo = 0;
      st.score = Math.max(0, st.score - 5);
      this.audio.playBounce();
      this.particles.emit(st.x, st.y + 10, 6, '#F8BBD0');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const st = this.playersState.get(botId);
    if (!st) return;

    // Check if unglazed donut is aligned under nozzle
    const underNozzle = st.donuts.find(d => !d.glazed && Math.abs(d.x) < 20);

    let drip = false;
    let delay = 0.25;

    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (underNozzle && Math.abs(underNozzle.x) < 18) drip = true;
      else if (Math.random() < 0.1) drip = true;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      if (underNozzle && Math.abs(underNozzle.x) < 8) drip = true;
    } else {
      delay = 0.25;
      if (underNozzle && Math.abs(underNozzle.x) < 12) drip = true;
    }

    if (drip) {
      this.handleGlazeDrip(st);
    }

    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const st = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: st?.score || 0,
        glazed: st?.donutsGlazed || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topGlazed = scores[0]?.glazed || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} frosted ${topGlazed} bakery-fresh glazed donuts!`
      : 'The conveyor belt was covered in spilled frosting!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Bakery Pastel Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1E1218');
    bgGrad.addColorStop(1, '#3B212E');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.save();
    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DONUT GLAZER', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#F48FB1';
    ctx.fillText('TIME DRIP TO FROST DONUTS DIRECTLY UNDER NOZZLE', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Stations
    for (const p of this.getActivePlayers()) {
      const st = this.playersState.get(p.id);
      if (!st) continue;

      ctx.save();

      // Station conveyor track
      ctx.fillStyle = '#263238';
      ctx.fillRect(st.x - 70, st.y - 12, 140, 24);
      ctx.strokeStyle = '#455A64';
      ctx.lineWidth = 2;
      ctx.strokeRect(st.x - 70, st.y - 12, 140, 24);

      // Render Donuts on Track
      for (const d of st.donuts) {
        const dx = st.x + d.x;
        // Donut Doughnut Body
        ctx.fillStyle = '#FFB74D';
        ctx.beginPath();
        ctx.arc(dx, st.y, 14, 0, Math.PI * 2);
        ctx.fill();

        // Glaze frosting
        if (d.glazed) {
          ctx.fillStyle = '#F48FB1';
          ctx.beginPath();
          ctx.arc(dx, st.y, 11, 0, Math.PI * 2);
          ctx.fill();
        }

        // Center Donut Hole
        ctx.fillStyle = '#263238';
        ctx.beginPath();
        ctx.arc(dx, st.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Glazing Nozzle Funnel directly overhead
      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.moveTo(st.x - 12, st.y - 65);
      ctx.lineTo(st.x + 12, st.y - 65);
      ctx.lineTo(st.x + 4, st.y - 35);
      ctx.lineTo(st.x - 4, st.y - 35);
      ctx.closePath();
      ctx.fill();

      // Frosting drop dripping down
      const dripY = st.y - 35 + st.dripAnim * 28;
      ctx.fillStyle = '#F48FB1';
      ctx.beginPath();
      ctx.arc(st.x, dripY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Score Badge
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(st.x - 45, st.y + 40, 90, 26, 4);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${st.score}`, st.x, st.y + 53);
      ctx.font = '700 8px monospace';
      ctx.fillText(`Glazed: ${st.donutsGlazed}`, st.x, st.y + 62);

      ctx.restore();
    }
  }
}
