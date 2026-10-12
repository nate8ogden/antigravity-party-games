import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface GlacialItem {
  id: number;
  x: number;
  type: 'krill' | 'sardine' | 'ice_spike';
  collected: boolean;
}

interface PenguinSlider {
  id: PlayerId;
  laneY: number;
  penguinX: number;
  yOffset: number;
  vy: number;
  isDrifting: boolean;
  speed: number;
  score: number;
  combo: number;
  stumbleTimer: number;
  slideAnim: number;
  items: GlacialItem[];
  nextItemDist: number;
}

export class PenguinSlideGame extends BaseGame {
  public sliders: Map<PlayerId, PenguinSlider> = new Map();
  public currentMapName: string = 'Glacier Mountain Chute';
  private itemIdCounter: number = 0;
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
    this.sliders.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.6;
      this.sliders.set(p.id, {
        id: p.id,
        laneY,
        penguinX: width * 0.3,
        yOffset: 0,
        vy: 0,
        isDrifting: false,
        speed: 150,
        score: 0,
        combo: 0,
        stumbleTimer: 0,
        slideAnim: 0,
        items: [],
        nextItemDist: 160,
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

    const baseScroll = 180;

    this.sliders.forEach((s) => {
      const p = this.getPlayer(s.id);

      if (s.stumbleTimer > 0) s.stumbleTimer -= dt;
      s.slideAnim += dt * 12;

      // Friction & natural slide speed
      s.speed = Math.max(110, s.speed - 25 * dt);

      // Human input: Belly jump / flipper surge
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(s.id) || this.input.justAction(s.id);
        if (justPressed && !s.isDrifting && s.stumbleTimer <= 0) {
          this.executeSlideSurge(s);
        }
      }

      // Jump / Air physics
      if (s.isDrifting) {
        s.yOffset += s.vy * dt;
        s.vy += 650 * dt;
        if (s.yOffset >= 0) {
          s.yOffset = 0;
          s.vy = 0;
          s.isDrifting = false;
          // Snow splash on landing
          this.particles.emit(s.penguinX, s.laneY + 10, 8, '#e0f7fa');
        }
      }

      // Spawning Ice Spikes & Fish
      s.nextItemDist -= (baseScroll + s.speed * 0.4) * dt;
      if (s.nextItemDist <= 0) {
        const rand = Math.random();
        const type = rand < 0.45 ? 'sardine' : rand < 0.75 ? 'krill' : 'ice_spike';
        s.items.push({
          id: ++this.itemIdCounter,
          x: width + 40,
          type,
          collected: false,
        });
        s.nextItemDist = 150 + Math.random() * 110;
      }

      // Update items
      for (let i = s.items.length - 1; i >= 0; i--) {
        const item = s.items[i];
        item.x -= (baseScroll + s.speed * 0.4) * dt;

        // Collision with penguin
        const dx = Math.abs(item.x - s.penguinX);
        if (dx < 26 && !item.collected) {
          if (item.type === 'ice_spike') {
            if (s.yOffset > -20) {
              // HIT ICE SPIKE!
              item.collected = true;
              s.stumbleTimer = 0.8;
              s.combo = 0;
              s.speed = 80;
              s.score = Math.max(0, s.score - 20);
              this.audio.playTone(130, 0.25, 'sawtooth');
              this.particles.emit(s.penguinX, s.laneY, 16, '#2980b9');
            } else {
              // Vaulted over ice spike cleanly!
              item.collected = true;
              s.score += 20 + s.combo * 2;
              s.combo++;
              this.audio.playTone(520, 0.08, 'triangle');
            }
          } else if (item.type === 'krill' || item.type === 'sardine') {
            // Snagged delicious fish
            item.collected = true;
            const pts = item.type === 'sardine' ? 35 : 20;
            s.score += pts + s.combo * 3;
            s.combo++;
            s.speed = Math.min(320, s.speed + 30);
            this.audio.playTone(item.type === 'sardine' ? 760 : 640, 0.1, 'sine');
            this.particles.emit(item.x, s.laneY - 10, 10, '#f1c40f');
          }
        }

        if (item.x < -60) {
          s.items.splice(i, 1);
        }
      }
    });
  }

  private executeSlideSurge(s: PenguinSlider): void {
    s.isDrifting = true;
    s.vy = -340;
    s.speed = Math.min(300, s.speed + 40);
    this.audio.playTone(420, 0.08, 'sine');
    this.particles.emit(s.penguinX - 10, s.laneY + 12, 12, '#ffffff');
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const s = this.sliders.get(botId);
    if (!s || s.isDrifting || s.stumbleTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const lookahead = difficulty === 'bot_hard' ? 90 : difficulty === 'bot_normal' ? 70 : 50;
      const upcomingSpike = s.items.find((it) => !it.collected && it.type === 'ice_spike' && it.x > s.penguinX && it.x < s.penguinX + lookahead);
      if (upcomingSpike) {
        this.executeSlideSurge(s);
        bTimer = difficulty === 'bot_hard' ? 0.35 : 0.55;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Arctic snowy sky atmosphere
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#152536');
    bgGrad.addColorStop(0.5, '#2c4b64');
    bgGrad.addColorStop(1, '#1b3245');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    this.sliders.forEach((s, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#3498db';

      // Snowy glacial chute track
      ctx.fillStyle = '#d4e6f1';
      ctx.fillRect(0, s.laneY + 10, width, 6);
      ctx.fillStyle = '#ebf5fb';
      ctx.fillRect(0, s.laneY + 16, width, laneHeight - 20);

      // Track dividers
      ctx.strokeStyle = '#aed6f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, s.laneY - laneHeight * 0.45);
      ctx.lineTo(width, s.laneY - laneHeight * 0.45);
      ctx.stroke();

      // Items & Spikes
      s.items.forEach((item) => {
        if (item.collected && item.type !== 'ice_spike') return;
        if (item.type === 'ice_spike') {
          // Sharp blue glacial spikes
          ctx.fillStyle = '#5dade2';
          ctx.beginPath();
          ctx.moveTo(item.x - 12, s.laneY + 12);
          ctx.lineTo(item.x, s.laneY - 18);
          ctx.lineTo(item.x + 12, s.laneY + 12);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ebf5fb';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (item.type === 'sardine') {
          // Silver jumping sardine fish
          ctx.fillStyle = '#85c1e9';
          ctx.beginPath();
          ctx.ellipse(item.x, s.laneY - 14, 12, 6, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(item.x + 8, s.laneY - 16, 3, 3);
        } else {
          // Golden Antarctic Krill
          ctx.fillStyle = '#f39c12';
          ctx.beginPath();
          ctx.arc(item.x, s.laneY - 12, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Penguin Slider
      const px = s.penguinX;
      const py = s.laneY + s.yOffset;

      ctx.save();
      ctx.translate(px, py);

      if (s.stumbleTimer > 0) {
        ctx.rotate(0.3);
      }

      // Penguin sliding on white belly
      ctx.fillStyle = '#2c3e50';
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 10, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // White belly
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-2, 4, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cute colored scarf
      ctx.fillStyle = color;
      ctx.fillRect(10, -8, 6, 8);

      // Penguin Beak (Orange)
      ctx.fillStyle = '#e67e22';
      ctx.beginPath();
      ctx.moveTo(18, -4);
      ctx.lineTo(26, -1);
      ctx.lineTo(18, 2);
      ctx.closePath();
      ctx.fill();

      // Flipper paddling
      const flipperAngle = Math.sin(s.slideAnim) * 0.4;
      ctx.fillStyle = '#34495e';
      ctx.beginPath();
      ctx.ellipse(-4, -6, 8, 4, flipperAngle, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name ?? pId}: ${s.score} pts`, 16, s.laneY - laneHeight * 0.2);
      if (s.combo > 1) {
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(`${s.combo}x DRIFT STREAK!`, 130, s.laneY - laneHeight * 0.2);
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
    ctx.fillText('🐧 TAP TO BELLY SURGE OVER SPIKES • CATCH SARDINES!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.sliders.forEach((s, pId) => scores.set(pId, s.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.sliders.entries())
      .map(([playerId, s]) => ({ playerId, score: s.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} performed the fastest belly slide on the glacier!` : 'Slid into the snow drifts!',
    };
  }
}
