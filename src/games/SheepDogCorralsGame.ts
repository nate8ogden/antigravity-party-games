import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Sheep {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fleeVx: number;
  fleeVy: number;
  isCorralled: boolean;
  corralOwner: PlayerId | null;
  wobble: number;
}

interface DogPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  barkCooldown: number;
  barkShockwave: { x: number; y: number; radius: number; maxRadius: number; active: boolean };
  corralCount: number;
  score: number;
  botReactionTimer: number;
}

interface CorralPen {
  ownerId: PlayerId;
  x: number;
  y: number;
  width: number;
  height: number;
  gateX: number;
  gateY: number;
}

export class SheepDogCorralsGame extends BaseGame {
  private dogs: Map<PlayerId, DogPlayer> = new Map();
  private sheep: Sheep[] = [];
  private pens: CorralPen[] = [];
  private currentMapName: string = 'Rolling Clover Pasture';

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 55.0;
    this.isFinished = false;

    const maps = ['Rolling Clover Pasture', 'Highland Knoll', 'Daisy Meadow', 'Sunny Valley'];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];

    this.setupPens(width, height);
    this.setupDogs(width, height);
    this.setupSheep(width, height);
  }

  private setupPens(width: number, height: number): void {
    this.pens = [];
    const penW = 120;
    const penH = 100;

    // 4 Corner pens
    this.pens.push({
      ownerId: 0,
      x: 10,
      y: 70,
      width: penW,
      height: penH,
      gateX: penW,
      gateY: 70 + penH / 2
    });
    this.pens.push({
      ownerId: 1,
      x: width - penW - 10,
      y: 70,
      width: penW,
      height: penH,
      gateX: width - penW - 10,
      gateY: 70 + penH / 2
    });
    this.pens.push({
      ownerId: 2,
      x: 10,
      y: height - penH - 10,
      width: penW,
      height: penH,
      gateX: penW,
      gateY: height - penH / 2
    });
    this.pens.push({
      ownerId: 3,
      x: width - penW - 10,
      y: height - penH - 10,
      width: penW,
      height: penH,
      gateX: width - penW - 10,
      gateY: height - penH / 2
    });
  }

  private setupDogs(width: number, height: number): void {
    this.dogs.clear();
    const active = this.getActivePlayers();

    const spawnOffsets = [
      { x: 160, y: 130, angle: 0 },
      { x: width - 160, y: 130, angle: Math.PI },
      { x: 160, y: height - 130, angle: 0 },
      { x: width - 160, y: height - 130, angle: Math.PI }
    ];

    active.forEach((p, idx) => {
      const sp = spawnOffsets[idx % spawnOffsets.length];
      this.dogs.set(p.id, {
        id: p.id,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        angle: sp.angle,
        speed: 210,
        barkCooldown: 0,
        barkShockwave: { x: 0, y: 0, radius: 0, maxRadius: 85, active: false },
        corralCount: 0,
        score: 0,
        botReactionTimer: 0.2 + Math.random() * 0.2
      });
    });
  }

  private setupSheep(width: number, height: number): void {
    this.sheep = [];
    const count = 18;
    const cx = width / 2;
    const cy = height / 2 + 10;

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 110;
      this.sheep.push({
        id: i,
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        fleeVx: 0,
        fleeVy: 0,
        isCorralled: false,
        corralOwner: null,
        wobble: Math.random() * 10
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update Dog Players
    for (const p of this.getActivePlayers()) {
      const dog = this.dogs.get(p.id);
      if (!dog) continue;

      if (dog.barkCooldown > 0) dog.barkCooldown -= dt;

      // Expand active shockwave
      if (dog.barkShockwave.active) {
        dog.barkShockwave.radius += dt * 320;
        if (dog.barkShockwave.radius >= dog.barkShockwave.maxRadius) {
          dog.barkShockwave.active = false;
        }
      }

      if (!p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(p.id);
        const throttle = this.input.getThrottle(p.id);
        const hasDirection = Math.abs(steer) > 0.2 || Math.abs(throttle) > 0.2;
        const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
        const justAction = this.input.justAction(p.id);
        const justReleased = this.input.justReleased(p.id);

        if (hasDirection) {
          dog.angle = Math.atan2(-throttle, steer);
        } else if (!isAction) {
          // Auto-scan angle when idle so single-touch mobile players can steer in any direction!
          dog.angle += 3.2 * dt;
        }

        if (hasDirection || isAction) {
          dog.vx = Math.cos(dog.angle) * dog.speed;
          dog.vy = Math.sin(dog.angle) * dog.speed;
        } else {
          dog.vx *= 0.82;
          dog.vy *= 0.82;
        }

        if (justAction || (justReleased && !hasDirection)) {
          this.triggerBark(dog);
        }
      }

      dog.x += dog.vx * dt;
      dog.y += dog.vy * dt;

      // Clamp arena bounds & bounce angle if hit
      if (dog.x <= 30 || dog.x >= width - 30) {
        dog.vx *= -0.5;
        dog.x = Math.max(30, Math.min(width - 30, dog.x));
        dog.angle = Math.PI - dog.angle;
      }
      if (dog.y <= 80 || dog.y >= height - 30) {
        dog.vy *= -0.5;
        dog.y = Math.max(80, Math.min(height - 30, dog.y));
        dog.angle = -dog.angle;
      }
    }

    // Update Sheep Flocking & Fleeing
    for (const s of this.sheep) {
      if (s.isCorralled) continue;

      s.wobble += dt * 6;

      // 1. Flee from barking shockwaves
      for (const dog of this.dogs.values()) {
        if (dog.barkShockwave.active) {
          const d = Math.hypot(s.x - dog.barkShockwave.x, s.y - dog.barkShockwave.y);
          if (d < dog.barkShockwave.radius + 15) {
            const angle = Math.atan2(s.y - dog.barkShockwave.y, s.x - dog.barkShockwave.x);
            s.fleeVx = Math.cos(angle) * 320;
            s.fleeVy = Math.sin(angle) * 320;
          }
        }

        // Flee slightly from dog proximity
        const distDog = Math.hypot(s.x - dog.x, s.y - dog.y);
        if (distDog < 75) {
          const angle = Math.atan2(s.y - dog.y, s.x - dog.x);
          s.fleeVx += Math.cos(angle) * 110 * dt;
          s.fleeVy += Math.sin(angle) * 110 * dt;
        }
      }

      // Decay flee impulses
      s.fleeVx *= 0.94;
      s.fleeVy *= 0.94;

      s.x += (s.vx + s.fleeVx) * dt;
      s.y += (s.vy + s.fleeVy) * dt;

      // Arena bounce
      if (s.x < 20 || s.x > width - 20) {
        s.vx *= -1;
        s.x = Math.max(20, Math.min(width - 20, s.x));
      }
      if (s.y < 80 || s.y > height - 20) {
        s.vy *= -1;
        s.y = Math.max(80, Math.min(height - 20, s.y));
      }

      // Check Corral Pens
      for (const pen of this.pens) {
        if (
          s.x >= pen.x &&
          s.x <= pen.x + pen.width &&
          s.y >= pen.y &&
          s.y <= pen.y + pen.height
        ) {
          // Sheep Corralled!
          s.isCorralled = true;
          s.corralOwner = pen.ownerId;
          const dog = this.dogs.get(pen.ownerId);
          if (dog) {
            dog.corralCount++;
            dog.score += 100;
          }

          this.audio.playChime();
          this.particles.emit(s.x, s.y, 8, '#10B981');
          break;
        }
      }
    }

    // Check if all sheep corralled
    if (this.sheep.every((s) => s.isCorralled)) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private triggerBark(dog: DogPlayer): void {
    if (dog.barkCooldown > 0) return;
    dog.barkCooldown = 0.55;

    dog.barkShockwave = {
      x: dog.x + Math.cos(dog.angle) * 16,
      y: dog.y + Math.sin(dog.angle) * 16,
      radius: 10,
      maxRadius: 85,
      active: true
    };

    this.audio.playTap();
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const dog = this.dogs.get(botId);
    if (!dog) return;

    dog.botReactionTimer -= dt;
    if (dog.botReactionTimer > 0) return;

    dog.botReactionTimer =
      difficulty === 'bot_easy' ? 0.35 : difficulty === 'bot_normal' ? 0.18 : 0.08;

    // Find nearest uncorralled sheep
    let nearestSheep: Sheep | null = null;
    let minDist = 9999;
    for (const s of this.sheep) {
      if (s.isCorralled) continue;
      const d = Math.hypot(dog.x - s.x, dog.y - s.y);
      if (d < minDist) {
        minDist = d;
        nearestSheep = s;
      }
    }

    const pen = this.pens.find((p) => p.ownerId === botId);
    if (nearestSheep && pen) {
      // Flank behind sheep relative to pen
      const toPenX = pen.gateX - nearestSheep.x;
      const toPenY = pen.gateY - nearestSheep.y;
      const penDist = Math.hypot(toPenX, toPenY) || 1;

      // Target position is behind the sheep
      const targetX = nearestSheep.x - (toPenX / penDist) * 55;
      const targetY = nearestSheep.y - (toPenY / penDist) * 55;

      dog.angle = Math.atan2(targetY - dog.y, targetX - dog.x);
      dog.vx = Math.cos(dog.angle) * dog.speed;
      dog.vy = Math.sin(dog.angle) * dog.speed;

      // Bark when close and facing sheep toward pen
      if (minDist < 65) {
        this.triggerBark(dog);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Lush Green Meadow Floor
    ctx.fillStyle = '#14532D';
    ctx.fillRect(0, 0, width, height);

    // Subtle grass texture
    ctx.fillStyle = '#166534';
    for (let i = 0; i < 40; i++) {
      const gx = (i * 97) % width;
      const gy = 80 + ((i * 61) % (height - 100));
      ctx.fillRect(gx, gy, 4, 3);
    }

    // 2. Corner Corral Pens
    for (const pen of this.pens) {
      const pConfig = this.players.find((p) => p.id === pen.ownerId);

      ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
      ctx.fillRect(pen.x, pen.y, pen.width, pen.height);

      ctx.strokeStyle = pConfig ? pConfig.color : '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(pen.x, pen.y, pen.width, pen.height);

      // Gate opening marker
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(pen.gateX, pen.gateY, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Sheep
    for (const s of this.sheep) {
      ctx.save();
      ctx.translate(s.x, s.y);

      // Fluffy white body
      ctx.fillStyle = s.isCorralled ? '#E2E8F0' : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();

      // Fluff bumps
      ctx.beginPath();
      ctx.arc(-5, -4, 6, 0, Math.PI * 2);
      ctx.arc(5, -4, 6, 0, Math.PI * 2);
      ctx.arc(0, 4, 6, 0, Math.PI * 2);
      ctx.fill();

      // Dark face
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(6, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 4. Dogs & Bark Waves
    for (const p of this.getActivePlayers()) {
      const dog = this.dogs.get(p.id);
      if (!dog) continue;

      // Shockwave ring
      if (dog.barkShockwave.active) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1 - dog.barkShockwave.radius / dog.barkShockwave.maxRadius;
        ctx.beginPath();
        ctx.arc(dog.barkShockwave.x, dog.barkShockwave.y, dog.barkShockwave.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // Dog body
      ctx.save();
      ctx.translate(dog.x, dog.y);
      ctx.rotate(dog.angle);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Snout
      ctx.fillStyle = p.colorDark;
      ctx.beginPath();
      ctx.arc(12, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Collar
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(4, -7, 3, 14);

      ctx.restore();
    }

    // 5. Header & Timer
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`PASTURE: ${this.currentMapName.toUpperCase()} • SHEEP DOG CORRALS`, width / 2, 28);

    const timerSec = Math.ceil(this.roundTimer);
    ctx.fillStyle = this.roundTimer < 10 ? '#EF4444' : '#F8FAFC';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${timerSec}s`, width / 2, 52);

    // 6. Corner HUDs
    for (const p of this.getActivePlayers()) {
      const dog = this.dogs.get(p.id);
      if (!dog) continue;

      let px = 20;
      let py = 20;
      if (p.corner === 'top-right') px = width - 160;
      else if (p.corner === 'bottom-left') py = height - 90;
      else if (p.corner === 'bottom-right') {
        px = width - 160;
        py = height - 90;
      }

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, 140, 70, 8);
      else ctx.rect(px, py, 140, 70);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 20);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${dog.score} pts`, px + 10, py + 42);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`Penned: ${dog.corralCount} Sheep`, px + 10, py + 60);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.dogs.get(a.id)?.score || 0;
      const sb = this.dogs.get(b.id)?.score || 0;
      return sb - sa;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topCount = this.dogs.get(winnerId ?? 0)?.corralCount || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.dogs.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Supreme shepherd! Corralled ${topCount} sheep across ${this.currentMapName}!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
