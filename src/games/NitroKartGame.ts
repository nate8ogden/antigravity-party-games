import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface KartMissile {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetId: PlayerId | null;
  life: number;
}

interface OilSlick {
  x: number;
  y: number;
  radius: number;
}

interface NitroKart {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  speed: number;
  score: number;
  hitsDealt: number;
  hasMissile: boolean;
  hasOil: boolean;
  nitroTimer: number;
  spinTimer: number;
}

export class NitroKartGame extends BaseGame {
  public playersState: Map<PlayerId, NitroKart> = new Map();
  public currentMapName: string = 'Cyber Nitro Derby Arena';

  private missiles: KartMissile[] = [];
  private oilSlicks: OilSlick[] = [];
  private missileIdCounter: number = 0;
  private powerupBoxes: { x: number; y: number; active: boolean; respawnTimer: number }[] = [];
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
    this.missiles = [];
    this.oilSlicks = [];
    this.botReactionTimers.clear();

    // Powerup boxes in center arena
    this.powerupBoxes = [
      { x: width * 0.35, y: height * 0.40, active: true, respawnTimer: 0 },
      { x: width * 0.65, y: height * 0.40, active: true, respawnTimer: 0 },
      { x: width * 0.35, y: height * 0.65, active: true, respawnTimer: 0 },
      { x: width * 0.65, y: height * 0.65, active: true, respawnTimer: 0 }
    ];

    const active = this.getActivePlayers();
    const count = active.length;
    const cx = width / 2;
    const cy = height * 0.52;
    const radius = Math.min(width, height) * 0.35;

    active.forEach((p, idx) => {
      const ang = (idx / count) * Math.PI * 2;
      this.playersState.set(p.id, {
        id: p.id,
        x: cx + Math.cos(ang) * radius,
        y: cy + Math.sin(ang) * radius,
        angle: ang + Math.PI,
        speed: 0,
        score: 0,
        hitsDealt: 0,
        hasMissile: true,
        hasOil: false,
        nitroTimer: 0,
        spinTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Powerup respawns
    for (const box of this.powerupBoxes) {
      if (!box.active) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
        }
      }
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    for (const p of active) {
      const kart = this.playersState.get(p.id);
      if (!kart) continue;

      if (kart.nitroTimer > 0) kart.nitroTimer -= dt;

      // Handle spin out
      if (kart.spinTimer > 0) {
        kart.spinTimer -= dt;
        kart.angle += 12 * dt;
        kart.speed *= 0.92;
        kart.x += Math.cos(kart.angle) * kart.speed * dt;
        kart.y += Math.sin(kart.angle) * kart.speed * dt;
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Steering & Driving
      kart.angle += steer * 3.4 * dt;

      const maxSpd = kart.nitroTimer > 0 ? 300 : 190;
      if (throttle > 0.1 || this.input.isPressed(p.id)) {
        kart.speed = Math.min(maxSpd, kart.speed + 280 * dt);
      } else if (throttle < -0.1) {
        kart.speed = Math.max(-60, kart.speed - 200 * dt);
      } else {
        kart.speed *= 0.95;
      }

      kart.x += Math.cos(kart.angle) * kart.speed * dt;
      kart.y += Math.sin(kart.angle) * kart.speed * dt;

      // Boundary bounce
      const pad = 28;
      if (kart.x < pad || kart.x > width - pad) {
        kart.angle = Math.PI - kart.angle;
        kart.x = Math.max(pad, Math.min(width - pad, kart.x));
        this.audio.playBounce();
      }
      if (kart.y < 85 || kart.y > height - pad) {
        kart.angle = -kart.angle;
        kart.y = Math.max(85, Math.min(height - pad, kart.y));
        this.audio.playBounce();
      }

      // Check powerup box collection
      for (const box of this.powerupBoxes) {
        if (box.active && Math.hypot(kart.x - box.x, kart.y - box.y) < 24) {
          box.active = false;
          box.respawnTimer = 4.0;
          this.audio.playScore();

          if (Math.random() < 0.5) {
            kart.hasMissile = true;
          } else {
            kart.nitroTimer = 2.5;
            this.particles.spawnSparks(kart.x, kart.y, '#FFD700', 8);
          }
        }
      }

      // Action: Fire weapon
      if (justAction) {
        if (kart.hasMissile) {
          kart.hasMissile = false;
          this.fireMissile(kart);
        } else if (kart.hasOil) {
          kart.hasOil = false;
          this.oilSlicks.push({ x: kart.x, y: kart.y, radius: 20 });
          this.audio.playBounce();
        }
      }

      // Oil slick collision
      for (const oil of this.oilSlicks) {
        if (Math.hypot(kart.x - oil.x, kart.y - oil.y) < oil.radius + 10) {
          kart.spinTimer = 1.0;
          this.audio.playExplosion();
          this.particles.emit(kart.x, kart.y, 6, '#455A64');
          break;
        }
      }
    }

    // Update Missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.life -= dt;

      // Homing logic towards target
      if (m.targetId !== null) {
        const target = this.playersState.get(m.targetId);
        if (target) {
          const ang = Math.atan2(target.y - m.y, target.x - m.x);
          m.vx = m.vx * 0.92 + Math.cos(ang) * 320 * 0.08;
          m.vy = m.vy * 0.92 + Math.sin(ang) * 320 * 0.08;
        }
      }

      m.x += m.vx * dt;
      m.y += m.vy * dt;

      // Smoke trail
      this.particles.emit(m.x, m.y, 1, '#FFA726');

      // Check collision with players
      let hit = false;
      for (const p of active) {
        if (p.id === m.ownerId) continue;
        const kart = this.playersState.get(p.id);
        if (!kart) continue;

        if (Math.hypot(m.x - kart.x, m.y - kart.y) < 22) {
          hit = true;
          kart.spinTimer = 1.2;
          const owner = this.playersState.get(m.ownerId);
          if (owner) {
            owner.score += 50;
            owner.hitsDealt++;
          }
          this.audio.playExplosion();
          this.particles.emit(kart.x, kart.y, 14, '#FF5722');
          break;
        }
      }

      if (hit || m.life <= 0) {
        this.missiles.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private fireMissile(kart: NitroKart): void {
    // Find closest rival
    let targetId: PlayerId | null = null;
    let minDist = 9999;
    for (const p of this.getActivePlayers()) {
      if (p.id === kart.id) continue;
      const target = this.playersState.get(p.id);
      if (!target) continue;
      const d = Math.hypot(target.x - kart.x, target.y - kart.y);
      if (d < minDist) {
        minDist = d;
        targetId = p.id;
      }
    }

    this.missiles.push({
      id: ++this.missileIdCounter,
      ownerId: kart.id,
      x: kart.x + Math.cos(kart.angle) * 20,
      y: kart.y + Math.sin(kart.angle) * 20,
      vx: Math.cos(kart.angle) * 280,
      vy: Math.sin(kart.angle) * 280,
      targetId,
      life: 3.5
    });

    this.audio.playTap();
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const kart = this.playersState.get(botId);
    if (!kart || kart.spinTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Bot seeks powerup box or chases nearest opponent
    let targetX = _width / 2;
    let targetY = _height / 2;

    const availableBox = this.powerupBoxes.find(b => b.active);
    if (availableBox) {
      targetX = availableBox.x;
      targetY = availableBox.y;
    } else {
      for (const p of this.getActivePlayers()) {
        if (p.id !== botId) {
          const rival = this.playersState.get(p.id);
          if (rival) {
            targetX = rival.x;
            targetY = rival.y;
            break;
          }
        }
      }
    }

    const ang = Math.atan2(targetY - kart.y, targetX - kart.x);
    let angleDiff = ang - kart.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let steer = 0;
    if (Math.abs(angleDiff) > 0.2) steer = angleDiff > 0 ? 1 : -1;

    let fire = false;
    if (kart.hasMissile && Math.abs(angleDiff) < 0.4) {
      fire = true;
    }

    this.input.setBotInput(botId, true, steer, 1, fire);

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
      const kart = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: kart?.score || 0,
        hits: kart?.hitsDealt || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topHits = scores[0]?.hits || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} clinched the Nitro Kart Derby with ${topHits} missile hits!`
      : 'Derby demolished with no sole victor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Cyber Arena Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#10101c');
    bgGrad.addColorStop(1, '#1b1a30');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Shock rail boundaries
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 80, width - 40, height - 100);

    // Header
    ctx.save();
    ctx.fillStyle = '#00E5FF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NITRO KART ARENA', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FFD54F';
    ctx.fillText('STEER & DRIVE • GRAB POWERUPS • FIRE HOMING MISSILES', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Powerup Boxes
    for (const box of this.powerupBoxes) {
      if (!box.active) continue;
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(box.x - 12, box.y - 12, 24, 24);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x - 12, box.y - 12, 24, 24);

      ctx.fillStyle = '#263238';
      ctx.font = '900 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', box.x, box.y + 5);
    }

    // Render Oil Slicks
    for (const oil of this.oilSlicks) {
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.arc(oil.x, oil.y, oil.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Missiles
    for (const m of this.missiles) {
      ctx.fillStyle = '#E53935';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Karts
    for (const p of this.getActivePlayers()) {
      const kart = this.playersState.get(p.id);
      if (!kart) continue;

      ctx.save();
      ctx.translate(kart.x, kart.y);
      ctx.rotate(kart.angle);

      // Kart chassis
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.roundRect(-14, -10, 28, 20, 4);
      ctx.fill();

      // Player livery
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-8, -7, 16, 14, 3);
      ctx.fill();

      // Wheels
      ctx.fillStyle = '#424242';
      ctx.fillRect(-12, -12, 6, 4);
      ctx.fillRect(6, -12, 6, 4);
      ctx.fillRect(-12, 8, 6, 4);
      ctx.fillRect(6, 8, 6, 4);

      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${kart.score}`, kart.x, kart.y - 18);
    }
  }
}
