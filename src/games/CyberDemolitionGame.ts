import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ScrapTower {
  id: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
}

interface DemolitionTruck {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  chainLength: number;
  score: number;
  towersCrushed: number;
  stunTimer: number;
}

export class CyberDemolitionGame extends BaseGame {
  public playersState: Map<PlayerId, DemolitionTruck> = new Map();
  public currentMapName: string = 'Cyber Scrap Junkyard 4';

  private scrapTowers: ScrapTower[] = [];
  private towerIdCounter: number = 0;
  private spawnTimer: number = 2.0;
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
    this.scrapTowers = [];
    this.botReactionTimers.clear();

    // Spawn 5 scrap towers in center arena
    const cx = width / 2;
    const cy = height * 0.54;
    const positions = [
      { x: cx, y: cy },
      { x: cx - 110, y: cy - 70 },
      { x: cx + 110, y: cy - 70 },
      { x: cx - 110, y: cy + 70 },
      { x: cx + 110, y: cy + 70 }
    ];

    this.scrapTowers = positions.map(pos => ({
      id: ++this.towerIdCounter,
      x: pos.x,
      y: pos.y,
      radius: 22,
      hp: 100,
      maxHp: 100
    }));

    const active = this.getActivePlayers();
    const count = active.length;
    const spawnRadius = Math.min(width, height) * 0.36;

    active.forEach((p, idx) => {
      const ang = (idx / count) * Math.PI * 2;
      const tx = cx + Math.cos(ang) * spawnRadius;
      const ty = cy + Math.sin(ang) * spawnRadius;

      this.playersState.set(p.id, {
        id: p.id,
        x: tx,
        y: ty,
        vx: 0,
        vy: 0,
        angle: ang + Math.PI,
        speed: 0,
        ballX: tx - Math.cos(ang) * 45,
        ballY: ty - Math.sin(ang) * 45,
        ballVx: 0,
        ballVy: 0,
        chainLength: 45,
        score: 0,
        towersCrushed: 0,
        stunTimer: 0
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Tower respawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.scrapTowers.length < 5) {
      this.spawnTimer = 2.5;
      const cx = width / 2;
      const cy = height * 0.54;
      this.scrapTowers.push({
        id: ++this.towerIdCounter,
        x: cx + (Math.random() - 0.5) * 220,
        y: cy + (Math.random() - 0.5) * 160,
        radius: 22,
        hp: 100,
        maxHp: 100
      });
    }

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const truck = this.playersState.get(p.id);
      if (!truck) continue;

      if (truck.stunTimer > 0) {
        truck.stunTimer -= dt;
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      truck.angle += steer * 3.2 * dt;

      const maxSpeed = isAction ? 240 : 160;
      if (throttle > 0.1 || isAction) {
        truck.speed = Math.min(maxSpeed, truck.speed + 220 * dt);
      } else if (throttle < -0.1) {
        truck.speed = Math.max(-70, truck.speed - 180 * dt);
      } else {
        truck.speed *= 0.94;
      }

      truck.x += Math.cos(truck.angle) * truck.speed * dt;
      truck.y += Math.sin(truck.angle) * truck.speed * dt;

      // Arena bounds
      const pad = 28;
      truck.x = Math.max(pad, Math.min(width - pad, truck.x));
      truck.y = Math.max(85, Math.min(height - pad, truck.y));

      // Physics Wrecking Ball Elastic Spring / Pendulum
      const dx = truck.x - truck.ballX;
      const dy = truck.y - truck.ballY;
      const dist = Math.hypot(dx, dy);

      if (dist > truck.chainLength) {
        const tension = (dist - truck.chainLength) * 14;
        const normX = dx / dist;
        const normY = dy / dist;
        truck.ballVx += normX * tension * dt;
        truck.ballVy += normY * tension * dt;
      }

      // Ball drag & position
      truck.ballVx *= Math.pow(0.96, dt * 10);
      truck.ballVy *= Math.pow(0.96, dt * 10);
      truck.ballX += truck.ballVx * dt;
      truck.ballY += truck.ballVy * dt;

      // Ball collision with Scrap Towers
      for (let i = this.scrapTowers.length - 1; i >= 0; i--) {
        const tower = this.scrapTowers[i];
        const ballDist = Math.hypot(truck.ballX - tower.x, truck.ballY - tower.y);
        const ballSpeed = Math.hypot(truck.ballVx, truck.ballVy);

        if (ballDist < tower.radius + 14 && ballSpeed > 60) {
          // Smash tower!
          const damage = ballSpeed * 0.4;
          tower.hp -= damage;
          truck.score += Math.floor(damage * 0.5);

          this.audio.playExplosion();
          this.particles.emit(tower.x, tower.y, 8, '#B0BEC5');

          if (tower.hp <= 0) {
            truck.towersCrushed++;
            truck.score += 50;
            this.audio.playScore();
            this.particles.spawnConfetti(tower.x, tower.y, 16);
            this.scrapTowers.splice(i, 1);
          }
        }
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
    const truck = this.playersState.get(botId);
    if (!truck || truck.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Target closest scrap tower
    let targetX = _width / 2;
    let targetY = _height / 2;

    if (this.scrapTowers.length > 0) {
      let nearest = this.scrapTowers[0];
      let minDist = Math.hypot(truck.x - nearest.x, truck.y - nearest.y);
      for (const t of this.scrapTowers) {
        const d = Math.hypot(truck.x - t.x, truck.y - t.y);
        if (d < minDist) {
          minDist = d;
          nearest = t;
        }
      }
      targetX = nearest.x;
      targetY = nearest.y;
    }

    const ang = Math.atan2(targetY - truck.y, targetX - truck.x);
    let angleDiff = ang - truck.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let steer = 0;
    if (Math.abs(angleDiff) > 0.2) steer = angleDiff > 0 ? 1 : -1;

    this.input.setBotInput(botId, true, steer, 1, true);

    let delay = 0.25;
    if (difficulty === 'bot_easy') delay = 0.45;
    else if (difficulty === 'bot_hard') delay = 0.10;

    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const t = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: t?.score || 0,
        towers: t?.towersCrushed || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topScore = scores[0]?.score || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} demolished the junkyard with ${topScore} scrap value!`
      : 'The scrap piles withstood the wrecking ball demolition!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Junkyard floor
    ctx.fillStyle = '#14141c';
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.save();
    ctx.fillStyle = '#00E5FF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CYBER DEMOLITION', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FFD54F';
    ctx.fillText('SWING WRECKING BALLS • SMASH SCRAP TOWERS INTO METALLIC DEBRIS', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Scrap Towers
    for (const tower of this.scrapTowers) {
      ctx.fillStyle = '#455A64';
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, tower.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78909C';
      ctx.lineWidth = 3;
      ctx.stroke();

      // HP Ring
      const hpPct = tower.hp / tower.maxHp;
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, tower.radius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpPct);
      ctx.stroke();
    }

    // Render Trucks & Wrecking Balls
    for (const p of this.getActivePlayers()) {
      const truck = this.playersState.get(p.id);
      if (!truck) continue;

      // Draw Tow Chain
      ctx.strokeStyle = '#CFD8DC';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(truck.x, truck.y);
      ctx.lineTo(truck.ballX, truck.ballY);
      ctx.stroke();

      // Draw Iron Wrecking Ball
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.arc(truck.ballX, truck.ballY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ECEFF1';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Monster Truck
      ctx.save();
      ctx.translate(truck.x, truck.y);
      ctx.rotate(truck.angle);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-16, -11, 32, 22, 4);
      ctx.fill();

      // Giant Wheels
      ctx.fillStyle = '#212121';
      ctx.fillRect(-14, -14, 8, 4);
      ctx.fillRect(6, -14, 8, 4);
      ctx.fillRect(-14, 10, 8, 4);
      ctx.fillRect(6, 10, 8, 4);

      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${truck.score}`, truck.x, truck.y - 18);
    }
  }
}
