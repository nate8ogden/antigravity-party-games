import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ThermalRing {
  x: number;
  y: number;
  radius: number;
  collectedBy: Set<PlayerId>;
}

interface Glider {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pitch: number;      // Radians (-PI/3 to PI/3)
  speed: number;
  altitude: number;   // Simulated Z height (0 to 100)
  isLanded: boolean;
  score: number;
  ringsPassed: number;
  landZone: string;
  trail: { x: number; y: number }[];
  turboCooldown: number;
}

export class SkyGlidersGame extends BaseGame {
  public gliders: Map<PlayerId, Glider> = new Map();
  public rings: ThermalRing[] = [];
  public currentMapName: string = 'Sunset Canyon';

  private canyonLength: number = 800;
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
    this.gliders.clear();
    this.botReactionTimers.clear();
    this.rings = [];
    this.canyonLength = width;

    // Generate floating thermal updraft rings across the sky
    const ringXs = [width * 0.28, width * 0.44, width * 0.60, width * 0.74];
    ringXs.forEach((rx, idx) => {
      this.rings.push({
        x: rx,
        y: height * 0.32 + ((idx % 2 === 0) ? -45 : 45),
        radius: 32,
        collectedBy: new Set()
      });
    });

    // Spawn gliders on launch catapults
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startY = height * 0.30 + idx * 55;
      this.gliders.set(p.id, {
        id: p.id,
        x: width * 0.08,
        y: startY,
        vx: 260,
        vy: 0,
        pitch: 0,
        speed: 260,
        altitude: 80,
        isLanded: false,
        score: 0,
        ringsPassed: 0,
        landZone: 'IN FLIGHT',
        trail: [],
        turboCooldown: 0
      });
      this.botReactionTimers.set(p.id, 0.3 + Math.random() * 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update gliders
    for (const p of this.getActivePlayers()) {
      const g = this.gliders.get(p.id);
      if (!g || g.isLanded) continue;

      if (g.turboCooldown > 0) g.turboCooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Pitch control: Throttle Up pulls pitch up (trades speed for climb); Throttle Down dives (gains speed)
      const pitchInput = -throttle;
      g.pitch += pitchInput * dt * 2.4;

      // Lateral trim: Left airbrakes; Right streamlines forward
      if (steer < -0.2) {
        g.speed = Math.max(120, g.speed - 120 * dt);
        g.pitch -= 0.5 * dt;
      } else if (steer > 0.2) {
        g.speed = Math.min(500, g.speed + 120 * dt);
      }

      // Updraft Turbo Boost
      if (justAction && g.turboCooldown <= 0) {
        g.turboCooldown = 2.0;
        g.speed = Math.min(520, g.speed + 110);
        g.y -= 25; // immediate thermal updraft lift
        this.audio.playLaser();
        this.particles.shake(2);
        this.particles.spawnSparks(g.x, g.y, '#38BDF8', 12);
      }

      g.pitch = Math.max(-0.65, Math.min(0.65, g.pitch));

      // Aerodynamics: Diving increases forward speed; climbing creates lift but slows speed
      if (g.pitch > 0) {
        // Diving forward & down
        g.speed += Math.sin(g.pitch) * 190 * dt;
      } else {
        // Climbing
        g.speed -= Math.sin(-g.pitch) * 220 * dt;
      }

      // Air resistance / natural glide speed clamp
      g.speed = Math.max(120, Math.min(520, g.speed));
      g.speed *= Math.pow(0.995, dt * 60);

      // Forward motion and vertical descent based on pitch
      g.vx = Math.cos(g.pitch) * g.speed;
      g.vy = Math.sin(g.pitch) * g.speed * 0.75;

      g.x += g.vx * dt;
      g.y += g.vy * dt;

      // Natural gravitational sink rate
      g.y += 16 * dt;

      // Clamp within canyon vertical bounds
      g.y = Math.max(35, Math.min(height - 55, g.y));

      // Trail recording
      g.trail.push({ x: g.x, y: g.y });
      if (g.trail.length > 20) g.trail.shift();

      // Check Thermal Ring fly-through
      for (const ring of this.rings) {
        if (!ring.collectedBy.has(p.id)) {
          const dist = Math.hypot(g.x - ring.x, g.y - ring.y);
          if (dist < ring.radius + 12) {
            ring.collectedBy.add(p.id);
            g.score += 150;
            g.ringsPassed += 1;
            g.speed = Math.min(480, g.speed + 90); // Updraft boost
            g.y -= 35; // Altitude lift
            this.audio.playScore();
            this.particles.spawnSparks(g.x, g.y, '#FBBF24', 16);
          }
        }
      }

      // Runway Touch-down at far right
      const runwayStartX = width * 0.85;
      if (g.x >= runwayStartX) {
        g.isLanded = true;
        g.vx = 0;
        g.vy = 0;

        // Evaluate Landing Precision Zone based on Y proximity to center runway
        const centerRunwayY = height * 0.5;
        const landingOffset = Math.abs(g.y - centerRunwayY);

        if (landingOffset < 40) {
          g.score += 500;
          g.landZone = 'BULLSEYE (500)';
          this.audio.playFanfare();
          this.particles.shake(6);
          this.particles.spawnExplosion(g.x, g.y, '#10B981', 24);
        } else if (landingOffset < 90) {
          g.score += 300;
          g.landZone = 'RUNWAY (300)';
          this.audio.playScore();
        } else {
          g.score += 100;
          g.landZone = 'ROUGH (100)';
          this.audio.playTap();
        }
      }
    }

    // Check round over: all landed or time expired
    const allLanded = Array.from(this.gliders.values()).every((g) => g.isLanded);
    if (this.roundTimer <= 0 || allLanded) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    height: number
  ): void {
    const bot = this.gliders.get(botId);
    if (!bot || bot.isLanded) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.35 + Math.random() * 0.25
        : difficulty === 'bot_normal'
        ? 0.18 + Math.random() * 0.15
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    // Find next uncollected ring ahead
    const nextRing = this.rings.find((r) => r.x > bot.x && !r.collectedBy.has(botId));

    let targetY = height * 0.5;
    if (nextRing) {
      targetY = nextRing.y;
    }

    if (difficulty === 'bot_easy') {
      targetY += (Math.random() - 0.5) * 60;
    }

    const dy = targetY - bot.y;
    let throttle = 0;
    let action = false;

    if (dy < -15) {
      // Target is above: pull up
      throttle = 1.0;
    } else if (dy > 15) {
      // Target is below: dive down
      throttle = -1.0;
    }

    if (difficulty === 'bot_hard' && nextRing && Math.abs(dy) < 25 && bot.turboCooldown <= 0) {
      action = true;
    }

    this.input.setBotInput(botId, false, 0, throttle, action);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const g = this.gliders.get(p.id);
      return {
        playerId: p.id,
        score: g?.score || 0,
        rings: g?.ringsPassed || 0,
        zone: g?.landZone || 'DNF'
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topRings = scores[0]?.rings || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} aced the canyon gliding through ${topRings} thermal rings!`
      : 'All gliders stalled in canyon downdrafts!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Beautiful Sunset Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#1E1B4B');
    skyGrad.addColorStop(0.3, '#701A75');
    skyGrad.addColorStop(0.7, '#C2410C');
    skyGrad.addColorStop(1, '#FBBF24');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant mountain canyon silhouettes
    ctx.fillStyle = '#431407';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height * 0.75);
    ctx.lineTo(width * 0.25, height * 0.62);
    ctx.lineTo(width * 0.55, height * 0.78);
    ctx.lineTo(width * 0.85, height * 0.65);
    ctx.lineTo(width, height * 0.82);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // 2. Floating Golden Thermal Updraft Rings
    for (const r of this.rings) {
      ctx.save();
      // Outer glow
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.radius * 0.6, r.radius, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Golden Ring Rim
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.radius * 0.6, r.radius, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Runway Landing Zone at right edge
    const rX = width * 0.85;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(rX, height * 0.25, width * 0.15, height * 0.5);

    // Target bullseye lines on runway
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3;
    ctx.strokeRect(rX, height * 0.42, width * 0.15, height * 0.16);

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BULLSEYE', rX + (width * 0.15) / 2, height * 0.5 + 4);

    // 4. Draw Gliders and Vapor Trails
    for (const g of this.gliders.values()) {
      const cfg = this.players.find((x) => x.id === g.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      // Vapor Trail
      if (g.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        g.trail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.pitch);

      // Paper Airplane Delta Wing
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(18, 0); // Nose
      ctx.lineTo(-14, -12); // Left wingtip
      ctx.lineTo(-6, 0); // Center crease
      ctx.lineTo(-14, 12); // Right wingtip
      ctx.closePath();
      ctx.fill();

      // Wing fold shading
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Player Pill
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${g.id + 1}`, g.x, g.y - 18);
    }

    // 5. Draw HUD
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
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
      const g = this.gliders.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = g?.isLanded ? `🛬${g?.score || 0}` : `⭕${g?.ringsPassed || 0}`;
      ctx.fillText(`P${p.id + 1}: ${label}`, px, 67);
    });

    ctx.restore();
  }
}
