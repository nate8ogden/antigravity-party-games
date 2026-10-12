import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Scoop {
  flavor: string;
  color: string;
}

const FLAVORS = [
  { flavor: 'Vanilla', color: '#FFF9C4' },
  { flavor: 'Strawberry', color: '#F48FB1' },
  { flavor: 'Mint', color: '#A5D6A7' },
  { flavor: 'Chocolate', color: '#6D4C41' },
  { flavor: 'Blueberry', color: '#90CAF9' }
];

interface ConeStacker {
  id: PlayerId;
  x: number;
  y: number;
  tiltAngle: number; // in radians
  tiltVel: number;
  scoops: Scoop[];
  nextScoopTimer: number;
  score: number;
  maxTowerHeight: number;
  tumbleTimer: number;
}

export class IceCreamScoopGame extends BaseGame {
  public playersState: Map<PlayerId, ConeStacker> = new Map();
  public currentMapName: string = 'Gelato Paradise Parlour';

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
        y: height * 0.76,
        tiltAngle: (Math.random() - 0.5) * 0.1,
        tiltVel: (Math.random() - 0.5) * 0.2,
        scoops: [FLAVORS[0]],
        nextScoopTimer: 1.5,
        score: 10,
        maxTowerHeight: 1,
        tumbleTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, _width: number, _height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, _width, _height);

    for (const p of this.getActivePlayers()) {
      const c = this.playersState.get(p.id);
      if (!c) continue;

      if (c.tumbleTimer > 0) {
        c.tumbleTimer -= dt;
        continue;
      }

      // Next scoop drop timer
      c.nextScoopTimer -= dt;
      if (c.nextScoopTimer <= 0) {
        c.nextScoopTimer = 1.8 + Math.random() * 0.8;
        const fl = FLAVORS[Math.floor(Math.random() * FLAVORS.length)];
        c.scoops.push(fl);
        c.score += 15;
        c.maxTowerHeight = Math.max(c.maxTowerHeight, c.scoops.length);
        this.audio.playTap();
        this.particles.emit(c.x, c.y - c.scoops.length * 16, 4, fl.color);
      }

      // Balancing controls: steer or tap to counter-lean
      const steer = this.input.getSteer(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      if (Math.abs(steer) > 0.2) {
        c.tiltVel += steer * 2.2 * dt;
      } else if (justAction) {
        // Nudge opposite to current tilt
        c.tiltVel -= Math.sign(c.tiltAngle) * 1.8;
      }

      // Tower wobble physics (gravity instability increases with height)
      const instability = 0.8 + c.scoops.length * 0.35;
      c.tiltVel += Math.sin(c.tiltAngle) * instability * dt;
      c.tiltVel *= Math.pow(0.92, dt * 10);
      c.tiltAngle += c.tiltVel * dt;

      // Check if tower tumbles over (> 45 deg = 0.78 rad)
      if (Math.abs(c.tiltAngle) > 0.75) {
        // Tumble!
        c.tumbleTimer = 1.2;
        c.score = Math.max(0, c.score - 15);
        this.audio.playExplosion();
        this.particles.emit(c.x, c.y - 40, 12, '#F48FB1');

        // Reset to 1 scoop
        c.scoops = [FLAVORS[0]];
        c.tiltAngle = 0;
        c.tiltVel = 0;
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
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

    const c = this.playersState.get(botId);
    if (!c || c.tumbleTimer > 0) return;

    let steer = 0;
    // Bot counter-steers against tilt
    if (Math.abs(c.tiltAngle) > 0.08) {
      steer = c.tiltAngle > 0 ? -1 : 1;
    }

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.2) steer = -steer; // over-compensates
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, false, steer, 0, false);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const c = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: c?.score || 0,
        height: c?.maxTowerHeight || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topHeight = scores[0]?.height || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} balanced a dizzying ${topHeight}-scoop ice cream tower!`
      : 'All gelato cones tumbled onto the parlour floor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Pastel parlour background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1A0E1A');
    bgGrad.addColorStop(1, '#3B1E38');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.save();
    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ICE CREAM SCOOP', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#F48FB1';
    ctx.fillText('BALANCE TOWERING WAFFLE CONES • STEER/TAP TO COUNTER WOBBLE', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Parlour Counter floor
    ctx.fillStyle = '#4A148C';
    ctx.fillRect(0, height * 0.82, width, height * 0.18);

    // Render Cones & Towering Scoops
    for (const p of this.getActivePlayers()) {
      const c = this.playersState.get(p.id);
      if (!c) continue;

      ctx.save();
      ctx.translate(c.x, c.y);

      // Waffle cone base (triangular)
      ctx.fillStyle = '#D7CCC8';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 36);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8D6E63';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rotated Tower of Scoops
      ctx.rotate(c.tiltAngle);

      c.scoops.forEach((sc, idx) => {
        const sy = -14 - idx * 16;
        ctx.fillStyle = sc.color;
        ctx.beginPath();
        ctx.arc(0, sy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Cherry on top of highest scoop
      const cherryY = -14 - c.scoops.length * 16;
      ctx.fillStyle = '#D32F2F';
      ctx.beginPath();
      ctx.arc(0, cherryY + 4, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Tilt warning
      if (Math.abs(c.tiltAngle) > 0.45) {
        ctx.fillStyle = '#FF1744';
        ctx.font = '900 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WOBBLE!', c.x, c.y - 120);
      }

      // Player Score Badge
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(c.x - 45, c.y + 44, 90, 26, 4);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${c.score}`, c.x, c.y + 57);
      ctx.font = '700 8px monospace';
      ctx.fillText(`Max: ${c.maxTowerHeight} scoops`, c.x, c.y + 66);
    }
  }
}
