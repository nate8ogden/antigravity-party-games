import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'watermelon' | 'pineapple' | 'orange' | 'strawberry' | 'bomb';
  points: number;
  rotation: number;
  rotSpeed: number;
  isSliced: boolean;
  sliceAngle: number;
  half1X?: number;
  half1Y?: number;
  half2X?: number;
  half2Y?: number;
}

interface ChopperPlayer {
  id: PlayerId;
  bladeX: number;
  bladeY: number;
  score: number;
  slices: number;
  combos: number;
  stunTimer: number;
  slashAnim: number;
  trail: { x: number; y: number }[];
}

export class FruitChopperGame extends BaseGame {
  public fruits: Fruit[] = [];
  public playersState: Map<PlayerId, ChopperPlayer> = new Map();
  public currentMapName: string = 'Bamboo Dojo Arena';

  private spawnTimer: number = 0.7;
  private fruitIdCounter: number = 0;
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
    this.fruits = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.spawnTimer = 0.6;
    this.fruitIdCounter = 0;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        bladeX: width * 0.25 + idx * 120,
        bladeY: height * 0.5,
        score: 0,
        slices: 0,
        combos: 0,
        stunTimer: 0,
        slashAnim: 0,
        trail: []
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Spawn fruit waves from bottom of screen
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.7 + Math.random() * 0.4;
      this.spawnFruitWave(width, height);
    }

    // Update flying fruits physics
    const gravity = 520;
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.vy += gravity * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rotation += f.rotSpeed * dt;

      if (f.isSliced) {
        if (f.half1X !== undefined && f.half1Y !== undefined) {
          f.half1X -= 80 * dt;
          f.half1Y += 40 * dt;
        }
        if (f.half2X !== undefined && f.half2Y !== undefined) {
          f.half2X += 80 * dt;
          f.half2Y += 40 * dt;
        }
      }

      // Remove fruit fallen below screen
      if (f.y > height + 50) {
        this.fruits.splice(i, 1);
      }
    }

    // Update players blade movement & slicing
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }
      if (ps.slashAnim > 0) ps.slashAnim = Math.max(0, ps.slashAnim - dt * 4.0);

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      const moveSpeed = 420;
      ps.bladeX += steer * moveSpeed * dt;
      ps.bladeY += -throttle * moveSpeed * dt;

      ps.bladeX = Math.max(40, Math.min(width - 40, ps.bladeX));
      ps.bladeY = Math.max(60, Math.min(height - 60, ps.bladeY));

      // Blade trail
      ps.trail.push({ x: ps.bladeX, y: ps.bladeY });
      if (ps.trail.length > 10) ps.trail.shift();

      const isActionDown = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const isSlashing = justAction || isActionDown;

      // Slash action
      if (isSlashing) {
        ps.slashAnim = Math.max(ps.slashAnim, 0.7);
        if (justAction) {
          this.audio.playLaser();
          this.particles.spawnSparks(ps.bladeX, ps.bladeY, '#FFFFFF', 6);
        }

        // Check fruit collisions within blade slash radius
        let slicedCount = 0;
        for (const f of this.fruits) {
          if (f.isSliced) continue;
          const dist = Math.hypot(f.x - ps.bladeX, f.y - ps.bladeY);

          if (dist < f.radius + 20) {
            if (f.type === 'bomb') {
              // BOMB DETONATION!
              f.isSliced = true;
              ps.stunTimer = 1.6;
              ps.score = Math.max(0, ps.score - 100);
              this.audio.playExplosion();
              this.particles.shake(8);
              this.particles.spawnExplosion(f.x, f.y, '#EF4444', 26);
              break;
            } else {
              // Slice fruit into halves!
              f.isSliced = true;
              f.half1X = f.x - 6;
              f.half1Y = f.y;
              f.half2X = f.x + 6;
              f.half2Y = f.y;
              slicedCount++;

              ps.slices += 1;
              ps.score += f.points;

              const splashColor =
                f.type === 'watermelon'
                  ? '#EF4444'
                  : f.type === 'pineapple'
                  ? '#F59E0B'
                  : f.type === 'orange'
                  ? '#EA580C'
                  : '#EC4899';

              this.audio.playTap();
              this.particles.spawnSparks(f.x, f.y, splashColor, 16);
            }
          }
        }

        // Multi-slice combo bonus
        if (slicedCount >= 2) {
          ps.combos += 1;
          const bonus = slicedCount * 50;
          ps.score += bonus;
          this.audio.playScore();
          this.particles.shake(4);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnFruitWave(width: number, height: number): void {
    const waveCount = Math.floor(1 + Math.random() * 3);
    const types: ('watermelon' | 'pineapple' | 'orange' | 'strawberry' | 'bomb')[] = [
      'watermelon',
      'pineapple',
      'orange',
      'strawberry',
      'bomb'
    ];

    for (let i = 0; i < waveCount; i++) {
      const spawnX = width * 0.20 + Math.random() * (width * 0.60);
      const spawnY = height + 20;

      const roll = Math.random();
      let type = types[Math.floor(Math.random() * 4)]; // 0 to 3
      let pts = 50;
      let radius = 22;

      if (roll < 0.20) {
        type = 'bomb';
        pts = 0;
        radius = 20;
      } else if (type === 'watermelon') {
        pts = 60;
        radius = 28;
      } else if (type === 'pineapple') {
        pts = 50;
        radius = 24;
      } else if (type === 'orange') {
        pts = 40;
        radius = 20;
      } else {
        pts = 30;
        radius = 16;
      }

      // Parabolic launch angle & velocity
      const targetCenterX = width * 0.5;
      const angle = Math.atan2(-height * 0.65, targetCenterX - spawnX) + (Math.random() - 0.5) * 0.4;
      const speed = 460 + Math.random() * 120;

      this.fruits.push({
        id: this.fruitIdCounter++,
        x: spawnX,
        y: spawnY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        type,
        points: pts,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 6.0,
        isSliced: false,
        sliceAngle: 0
      });
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.playersState.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.35 + Math.random() * 0.22
        : difficulty === 'bot_normal'
        ? 0.18 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    // Target airborne fruit that is NOT a bomb
    const validFruits = this.fruits.filter((f) => !f.isSliced && f.type !== 'bomb' && f.y < 450);
    if (validFruits.length > 0) {
      const target = validFruits[0];
      bot.bladeX = target.x;
      bot.bladeY = target.y;

      // Slice action
      target.isSliced = true;
      bot.slices += 1;
      bot.score += target.points;
      bot.slashAnim = 1.0;
      this.audio.playTap();
      this.particles.spawnSparks(target.x, target.y, '#F59E0B', 10);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0,
        slices: ps?.slices || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topSlices = scores[0]?.slices || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} sliced ${topSlices} airborne fruits with ninja precision!`
      : 'All fruits fell uncut onto the dojo floor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Japanese Dojo Tatami Floor & Bamboo Wall
    const dojoGrad = ctx.createLinearGradient(0, 0, 0, height);
    dojoGrad.addColorStop(0, '#78350F');
    dojoGrad.addColorStop(0.5, '#451A03');
    dojoGrad.addColorStop(1, '#291002');
    ctx.fillStyle = dojoGrad;
    ctx.fillRect(0, 0, width, height);

    // Tatami Bamboo Mats lines
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Airborne Fruits
    for (const f of this.fruits) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      if (f.type === 'watermelon') {
        // Green striped watermelon
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, f.radius * 0.75, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.type === 'pineapple') {
        // Golden pineapple
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.ellipse(0, 0, f.radius * 0.8, f.radius, 0, 0, Math.PI * 2);
        ctx.fill();

        // Green leafy crown
        ctx.fillStyle = '#16A34A';
        ctx.beginPath();
        ctx.moveTo(0, -f.radius);
        ctx.lineTo(-8, -f.radius - 12);
        ctx.lineTo(0, -f.radius - 16);
        ctx.lineTo(8, -f.radius - 12);
        ctx.closePath();
        ctx.fill();
      } else if (f.type === 'orange') {
        // Orange citrus
        ctx.fillStyle = '#EA580C';
        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.type === 'strawberry') {
        // Red strawberry
        ctx.fillStyle = '#E11D48';
        ctx.beginPath();
        ctx.moveTo(0, f.radius);
        ctx.lineTo(-f.radius, -f.radius * 0.5);
        ctx.lineTo(f.radius, -f.radius * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (f.type === 'bomb') {
        // Black iron bomb with glowing spark fuse
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -f.radius);
        ctx.quadraticCurveTo(8, -f.radius - 8, 14, -f.radius - 6);
        ctx.stroke();

        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(14, -f.radius - 6, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 3. Katana Blade Trails & Slicing Reticles
    for (const p of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === p.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      // Katana slash trail
      if (p.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        p.trail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Blade Crosshair
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.bladeX, p.bladeY, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Blade slash effect
      if (p.slashAnim > 0) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.bladeX - 30, p.bladeY - 30);
        ctx.lineTo(p.bladeX + 30, p.bladeY + 30);
        ctx.stroke();
      }

      // Stunned indicator
      if (p.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡STUNNED!', p.bladeX, p.bladeY + 28);
      }

      // Player Pill
      ctx.fillStyle = color;
      ctx.font = 'bold 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}`, p.bladeX, p.bladeY - 22);

      ctx.restore();
    }

    // 4. Draw HUD
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width * 0.5, 30);

    // Score bar
    const active = this.getActivePlayers();
    const itemW = 95;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(subBarX, 54, subBarW, 26, 6);
    ctx.fill();

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${p.id + 1}: 🍉${ps?.score || 0}`, px, 67);
    });

    ctx.restore();
  }
}
