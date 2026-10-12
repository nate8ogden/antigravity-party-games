import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BeachCrab {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  dir: number;
  laneMinX: number;
  laneMaxX: number;
  clawAnim: number;
  score: number;
  stunTimer: number;
}

interface FallingSeashell {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: 'seashell' | 'starfish' | 'coconut';
  points: number;
}

export class CrabWalkGame extends BaseGame {
  private crabs: Map<PlayerId, BeachCrab> = new Map();
  private items: FallingSeashell[] = [];
  private itemIdCounter: number = 0;
  private spawnTimer: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.crabs.clear();
    this.items = [];
    this.spawnTimer = 0.4;

    const active = this.getActivePlayers();
    const laneWidth = width / active.length;

    active.forEach((p, idx) => {
      const laneMinX = idx * laneWidth;
      const laneMaxX = (idx + 1) * laneWidth;
      const startX = laneMinX + laneWidth / 2;

      this.crabs.set(p.id, {
        id: p.id,
        x: startX,
        y: height * 0.82,
        vx: 0,
        dir: 0,
        laneMinX,
        laneMaxX,
        clawAnim: 0,
        score: 0,
        stunTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private spawnItem(width: number): void {
    const active = this.getActivePlayers();
    if (active.length === 0) return;

    const laneWidth = width / active.length;
    const laneIdx = Math.floor(Math.random() * active.length);
    const minX = laneIdx * laneWidth + 25;
    const maxX = (laneIdx + 1) * laneWidth - 25;

    const roll = Math.random();
    const isCoconut = roll < 0.25;
    const isStarfish = !isCoconut && roll < 0.55;

    this.items.push({
      id: ++this.itemIdCounter,
      x: minX + Math.random() * (maxX - minX),
      y: -10,
      vy: 140 + Math.random() * 80,
      type: isCoconut ? 'coconut' : isStarfish ? 'starfish' : 'seashell',
      points: isCoconut ? -10 : isStarfish ? 25 : 15
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.35 + Math.random() * 0.25;
      this.spawnItem(width);
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    for (const p of active) {
      const crab = this.crabs.get(p.id);
      if (!crab) continue;

      if (crab.stunTimer > 0) crab.stunTimer -= dt;
      if (crab.clawAnim > 0) crab.clawAnim -= dt * 5;

      const steer = this.input.getSteer(p.id);
      if (crab.stunTimer <= 0) {
        crab.vx = steer * 240;
      } else {
        crab.vx = 0;
      }

      crab.x += crab.vx * dt;

      // Restrict crab to its quadrant lane
      if (crab.x < crab.laneMinX + 20) crab.x = crab.laneMinX + 20;
      if (crab.x > crab.laneMaxX - 20) crab.x = crab.laneMaxX - 20;
    }

    // Update falling items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.vy * dt;

      let caught = false;

      for (const p of active) {
        const crab = this.crabs.get(p.id);
        if (!crab || crab.stunTimer > 0) continue;

        if (Math.hypot(crab.x - item.x, crab.y - item.y) < 22) {
          caught = true;
          crab.clawAnim = 1.0;

          if (item.type === 'coconut') {
            crab.stunTimer = 1.2;
            crab.score = Math.max(0, crab.score + item.points);
            this.audio.playExplosion();
            this.particles.emit(crab.x, crab.y, 8, '#795548');
          } else {
            crab.score += item.points;
            this.audio.playScore();
            this.particles.spawnConfetti(item.x, item.y, 8);
          }
          break;
        }
      }

      if (caught || item.y > height * 0.88) {
        this.items.splice(i, 1);
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

    const crab = this.crabs.get(botId);
    if (!crab || crab.stunTimer > 0) return;

    // Filter items in bot's lane
    const laneItems = this.items
      .filter(i => i.x >= crab.laneMinX && i.x <= crab.laneMaxX && i.y < crab.y)
      .sort((a, b) => b.y - a.y);

    let targetX = (crab.laneMinX + crab.laneMaxX) / 2;

    if (laneItems.length > 0) {
      const item = laneItems[0];
      if (item.type === 'coconut') {
        targetX = item.x > crab.x ? crab.laneMinX + 25 : crab.laneMaxX - 25;
      } else {
        targetX = item.x;
      }
    }

    let steer = 0;
    const dx = targetX - crab.x;
    if (Math.abs(dx) > 12) {
      steer = dx > 0 ? 1 : -1;
    }

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.2) steer = -steer;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, false, steer, 0, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Sunny beach sand gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#4FC3F7');
    grad.addColorStop(0.5, '#0288D1');
    grad.addColorStop(0.8, '#FFE082');
    grad.addColorStop(1, '#FFCA28');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Lane dividers
    const active = this.getActivePlayers();
    const laneWidth = width / active.length;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < active.length; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneWidth, 0);
      ctx.lineTo(i * laneWidth, height);
      ctx.stroke();
    }

    // Render falling items
    for (const item of this.items) {
      ctx.save();
      ctx.translate(item.x, item.y);

      if (item.type === 'coconut') {
        ctx.fillStyle = '#5D4037';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3E2723';
        ctx.beginPath();
        ctx.arc(-2, -2, 2, 0, Math.PI * 2);
        ctx.arc(2, -2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.type === 'starfish') {
        ctx.fillStyle = '#FF7043';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Spiral seashell
        ctx.fillStyle = '#ECEFF1';
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 6, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#B0BEC5';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render crabs
    for (const [id, crab] of this.crabs.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#E53935';

      ctx.save();
      ctx.translate(crab.x, crab.y);

      // Crab round carapace
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Left & right claws
      const clawPinch = crab.clawAnim > 0 ? 0.3 : 0;
      ctx.fillStyle = color;
      // Left claw
      ctx.beginPath();
      ctx.arc(-18, -8, 6, 0, Math.PI * 2);
      ctx.fill();
      // Right claw
      ctx.beginPath();
      ctx.arc(18, -8, 6, 0, Math.PI * 2);
      ctx.fill();

      // Little stalk eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-5, -12, 3, 0, Math.PI * 2);
      ctx.arc(5, -12, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(-5, -12, 1.5, 0, Math.PI * 2);
      ctx.arc(5, -12, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Score above crab
      ctx.fillStyle = color;
      ctx.font = 'bold 15px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${crab.score} pts`, crab.x, crab.y - 22);
    }

    // Timer
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width / 2, 32);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const crab = this.crabs.get(p.id);
      return {
        playerId: p.id,
        score: crab ? crab.score : 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} scuttled away with the shell harvest!` : 'The falling coconuts bonked all the crabs!'
    };
  }
}
