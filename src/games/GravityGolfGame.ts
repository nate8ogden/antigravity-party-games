import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type GolfThemeId = 'binary' | 'solar' | 'exoplanet';

interface GolfTheme {
  id: GolfThemeId;
  name: string;
  icon: string;
  bgGradInner: string;
  bgGradOuter: string;
  wormholeGlow: string;
  accentColor: string;
}

const THEMES: Record<GolfThemeId, GolfTheme> = {
  binary: {
    id: 'binary',
    name: 'Binary Nebula',
    icon: '🌌',
    bgGradInner: '#0F172A',
    bgGradOuter: '#020617',
    wormholeGlow: '#38BDF8',
    accentColor: '#38BDF8'
  },
  solar: {
    id: 'solar',
    name: 'Solar Flare Forge',
    icon: '☀️',
    bgGradInner: '#291804',
    bgGradOuter: '#100A02',
    wormholeGlow: '#F59E0B',
    accentColor: '#F59E0B'
  },
  exoplanet: {
    id: 'exoplanet',
    name: 'Alien Exoplanet',
    icon: '🪐',
    bgGradInner: '#1E1B4B',
    bgGradOuter: '#0F0E26',
    wormholeGlow: '#A855F7',
    accentColor: '#C084FC'
  }
};

interface Planet {
  x: number;
  y: number;
  radius: number;
  mass: number;
  color: string;
  colorRing?: string;
  hasRing?: boolean;
}

interface GolfBall {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  inHole: boolean;
  strokes: number;
  power: number;
  aimAngle: number;
  isAiming: boolean;
  powerIncreasing: boolean;
  trail: { x: number; y: number }[];
  mood: CharacterMood;
  moodTimer: number;
}

export class GravityGolfGame extends BaseGame {
  private currentThemeId: GolfThemeId = 'binary';
  public balls: Map<PlayerId, GolfBall> = new Map();
  public planets: Planet[] = [];
  public holeX: number = 700;
  public holeY: number = 300;
  public holeRadius: number = 18;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private animTimer: number = 0;
  private screenShake: number = 0;
  private freezeFrames: number = 0;
  private suddenDeathTriggered: boolean = false;

  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDownBound);
  }

  public init(width: number, height: number): void {
    const themeKeys: GolfThemeId[] = ['binary', 'solar', 'exoplanet'];
    this.currentThemeId = themeKeys[Math.floor(Math.random() * themeKeys.length)];
    this.reset(width, height);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.cycleTheme();
    } else if (e.key === '1') {
      this.setTheme('binary');
    } else if (e.key === '2') {
      this.setTheme('solar');
    } else if (e.key === '3') {
      this.setTheme('exoplanet');
    }
  }

  public cycleTheme(): void {
    const list: GolfThemeId[] = ['binary', 'solar', 'exoplanet'];
    const curIdx = list.indexOf(this.currentThemeId);
    this.setTheme(list[(curIdx + 1) % list.length]);
  }

  public setTheme(id: GolfThemeId): void {
    if (this.currentThemeId !== id) {
      this.currentThemeId = id;
      this.audio.playTap();
      this.particles.emit(100, 300, 15, THEMES[id].accentColor);
    }
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 45.0;
    this.isFinished = false;
    this.animTimer = 0;
    this.screenShake = 0;
    this.freezeFrames = 0;
    this.suddenDeathTriggered = false;
    this.balls.clear();
    this.botReactionTimers.clear();
    this.planets = [];

    const cx = width * 0.5;
    const cy = height * 0.52;

    switch (this.currentThemeId) {
      case 'solar':
        this.planets = [
          {
            x: cx,
            y: cy,
            radius: 46,
            mass: 65000,
            color: '#F59E0B',
            colorRing: 'rgba(251, 191, 36, 0.45)',
            hasRing: true
          },
          { x: cx - 180, y: cy - 100, radius: 24, mass: 22000, color: '#EF4444' },
          { x: cx + 180, y: cy + 100, radius: 24, mass: 22000, color: '#D97706' }
        ];
        this.holeX = width * 0.88;
        this.holeY = height * 0.52;
        break;

      case 'exoplanet':
        this.planets = [
          { x: cx - 100, y: cy - 120, radius: 30, mass: 35000, color: '#EC4899' },
          { x: cx + 100, y: cy + 120, radius: 30, mass: 35000, color: '#8B5CF6' },
          { x: cx, y: cy, radius: 22, mass: 20000, color: '#10B981' }
        ];
        this.holeX = width * 0.86;
        this.holeY = height * 0.28;
        break;

      case 'binary':
      default:
        this.planets = [
          { x: cx - 90, y: cy, radius: 38, mass: 48000, color: '#EF4444' },
          { x: cx + 90, y: cy, radius: 38, mass: 48000, color: '#06B6D4' }
        ];
        this.holeX = width * 0.88;
        this.holeY = height * 0.52;
        break;
    }

    // Spawn golf balls for players on the launch pad tee
    const active = this.getActivePlayers();
    const teeX = width * 0.12;
    active.forEach((p, idx) => {
      const teeY = height * 0.38 + idx * 45;
      this.balls.set(p.id, {
        id: p.id,
        x: teeX,
        y: teeY,
        vx: 0,
        vy: 0,
        radius: 8.5,
        inHole: false,
        strokes: 0,
        power: 0,
        aimAngle: 0,
        isAiming: true,
        powerIncreasing: true,
        trail: [],
        mood: 'idle',
        moodTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.3 + Math.random() * 0.3);
    });
  }

  private isUnderdog(playerId: PlayerId): boolean {
    const balls = Array.from(this.balls.values());
    const leaderInHole = balls.some((b) => b.inHole && b.id !== playerId);
    const b = this.balls.get(playerId);
    return !!b && !b.inHole && (leaderInHole || b.strokes >= 3);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      return;
    }

    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 14);
    }

    // Sudden death check at <= 15s
    if (this.roundTimer <= 15.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.holeRadius = 24; // Expanded wormhole
      this.audio.playWhoosh();
    }

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update players and ball physics
    const active = this.getActivePlayers();
    for (const p of active) {
      const b = this.balls.get(p.id);
      if (!b || b.inHole) continue;

      if (b.moodTimer > 0) {
        b.moodTimer -= dt;
        if (b.moodTimer <= 0) b.mood = 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const isActionDown = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      const isStationary = Math.hypot(b.vx, b.vy) < 12;

      if (isStationary) {
        b.isAiming = true;
        b.vx = 0;
        b.vy = 0;

        if (steer !== 0) {
          b.aimAngle += steer * dt * 2.8;
        }

        // Power charging oscillation
        if (isActionDown) {
          b.mood = 'focused';
          const powerSpeed = 420;
          if (b.powerIncreasing) {
            b.power += powerSpeed * dt;
            if (b.power >= 580) {
              b.power = 580;
              b.powerIncreasing = false;
            }
          } else {
            b.power -= powerSpeed * dt;
            if (b.power <= 120) {
              b.power = 120;
              b.powerIncreasing = true;
            }
          }
        } else if (b.power > 0) {
          // Release stroke!
          b.vx = Math.cos(b.aimAngle) * b.power;
          b.vy = Math.sin(b.aimAngle) * b.power;
          b.strokes += 1;
          b.power = 0;
          b.isAiming = false;
          b.powerIncreasing = true;
          this.audio.playTap();
          this.particles.emit(b.x, b.y, 8, p.color);
        } else if (justAction && b.power === 0) {
          b.power = 120;
        }
      } else {
        b.isAiming = false;
      }

      // Gravitational physics when in motion
      if (!isStationary) {
        const underdog = this.isUnderdog(p.id);

        for (const pl of this.planets) {
          const dx = pl.x - b.x;
          const dy = pl.y - b.y;
          const distSq = Math.max(pl.radius * pl.radius * 0.8, dx * dx + dy * dy);
          const dist = Math.sqrt(distSq);

          const massMultiplier = this.suddenDeathTriggered ? 1.35 : 1.0;
          const force = (pl.mass * massMultiplier) / distSq;
          b.vx += (dx / (dist || 0.001)) * force * dt;
          b.vy += (dy / (dist || 0.001)) * force * dt;

          // Planet surface bounce
          if (dist < pl.radius + b.radius) {
            const nx = dx / dist;
            const ny = dy / dist;
            b.x = pl.x - nx * (pl.radius + b.radius);
            b.y = pl.y - ny * (pl.radius + b.radius);

            // Elastic bounce with planetary damping (Underdog gets perfect elastic rebound)
            const damping = underdog ? 0.95 : 0.65;
            const dot = b.vx * nx + b.vy * ny;
            b.vx = (b.vx - 2 * dot * nx) * damping;
            b.vy = (b.vy - 2 * dot * ny) * damping;

            this.audio.playBounce();
            this.particles.emit(b.x, b.y, 6, pl.color);
          }
        }

        // Cosmic vacuum friction
        b.vx *= Math.pow(0.988, dt * 60);
        b.vy *= Math.pow(0.988, dt * 60);

        // Underdog subtle tractor beam suction toward wormhole
        if (underdog) {
          const hdx = this.holeX - b.x;
          const hdy = this.holeY - b.y;
          const hDist = Math.hypot(hdx, hdy) || 1;
          b.vx += (hdx / hDist) * 35 * dt;
          b.vy += (hdy / hDist) * 35 * dt;
        }

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Trail recording
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 14) b.trail.shift();

        // Screen boundary bounce
        if (b.x - b.radius < 24) {
          b.x = 24 + b.radius;
          b.vx = -b.vx * 0.8;
          this.audio.playBounce();
        } else if (b.x + b.radius > width - 24) {
          b.x = width - 24 - b.radius;
          b.vx = -b.vx * 0.8;
          this.audio.playBounce();
        }

        if (b.y - b.radius < 76) {
          b.y = 76 + b.radius;
          b.vy = -b.vy * 0.8;
          this.audio.playBounce();
        } else if (b.y + b.radius > height - 24) {
          b.y = height - 24 - b.radius;
          b.vy = -b.vy * 0.8;
          this.audio.playBounce();
        }

        // Wormhole Hole-In-One Detection
        const distToHole = Math.hypot(b.x - this.holeX, b.y - this.holeY);
        if (distToHole < this.holeRadius && Math.hypot(b.vx, b.vy) < 290) {
          b.inHole = true;
          b.vx = 0;
          b.vy = 0;
          b.x = this.holeX;
          b.y = this.holeY;
          b.mood = 'triumph';
          b.moodTimer = 2.0;

          this.audio.playFanfare();
          this.screenShake = 6;
          this.freezeFrames = 2;
          this.particles.emit(this.holeX, this.holeY, 26, THEMES[this.currentThemeId].wormholeGlow);
        }
      }
    }

    // Ball-to-Ball Cosmic Clashes
    for (let i = 0; i < active.length; i++) {
      const bA = this.balls.get(active[i].id);
      if (!bA || bA.inHole) continue;

      for (let j = i + 1; j < active.length; j++) {
        const bB = this.balls.get(active[j].id);
        if (!bB || bB.inHole) continue;

        const dx = bB.x - bA.x;
        const dy = bB.y - bA.y;
        const dist = Math.hypot(dx, dy);
        const minDist = bA.radius + bB.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Elastic separation
          const overlap = minDist - dist;
          bA.x -= nx * overlap * 0.5;
          bA.y -= ny * overlap * 0.5;
          bB.x += nx * overlap * 0.5;
          bB.y += ny * overlap * 0.5;

          const dotA = bA.vx * nx + bA.vy * ny;
          const dotB = bB.vx * nx + bB.vy * ny;

          bA.vx += (dotB - dotA) * nx * 1.1;
          bA.vy += (dotB - dotA) * ny * 1.1;
          bB.vx += (dotA - dotB) * nx * 1.1;
          bB.vy += (dotA - dotB) * ny * 1.1;

          bA.mood = 'shocked';
          bA.moodTimer = 0.6;
          bB.mood = 'shocked';
          bB.moodTimer = 0.6;

          this.audio.playBounce();
          this.particles.emit((bA.x + bB.x) / 2, (bA.y + bB.y) / 2, 8, '#F59E0B');
        }
      }
    }

    // Check round over: all active balls in hole or timer runs out
    const remaining = active.filter((p) => {
      const b = this.balls.get(p.id);
      return b && !b.inHole;
    });

    if (this.roundTimer <= 0 || remaining.length === 0) {
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
    const b = this.balls.get(botId);
    if (!b || b.inHole) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const baseDelay =
      difficulty === 'bot_easy' ? 0.42 : difficulty === 'bot_normal' ? 0.22 : 0.08;
    this.botReactionTimers.set(botId, baseDelay);

    if (Math.hypot(b.vx, b.vy) < 12) {
      let targetAngle = Math.atan2(this.holeY - b.y, this.holeX - b.x);

      // Slingshot curve around planets
      const blockingPlanet = this.planets.find((pl) => {
        const d = Math.hypot(pl.x - b.x, pl.y - b.y);
        return d < 220;
      });

      if (blockingPlanet) {
        const offset = blockingPlanet.y > b.y ? -0.44 : 0.44;
        targetAngle += offset;
      }

      if (difficulty === 'bot_easy') {
        targetAngle += (Math.random() - 0.5) * 0.65;
      }

      b.aimAngle = targetAngle;
      const desiredPower =
        difficulty === 'bot_hard' ? 440 : 340 + Math.random() * 110;

      b.vx = Math.cos(targetAngle) * desiredPower;
      b.vy = Math.sin(targetAngle) * desiredPower;
      b.strokes += 1;
      b.isAiming = false;
      this.audio.playTap();
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const multi = this.suddenDeathTriggered ? 1.5 : 1;
    const scores = this.getActivePlayers().map((p) => {
      const b = this.balls.get(p.id);
      let pts = 0;
      if (b) {
        if (b.inHole) {
          pts = Math.round(Math.max(150, 1000 - (b.strokes - 1) * 200) * multi);
        } else {
          const dist = Math.hypot(b.x - this.holeX, b.y - this.holeY);
          pts = Math.max(20, Math.round((400 - dist * 0.6) * multi));
        }
      }
      return {
        playerId: p.id,
        score: pts,
        strokes: b?.strokes || 0,
        inHole: b?.inHole || false
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId =
      scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topStrokes = scores[0]?.strokes || 0;
    const mvpHighlight =
      winnerId !== null
        ? `Celestial Ace! Sank the wormhole cup in ${topStrokes} stroke(s) across ${THEMES[this.currentThemeId].name}!`
        : 'Cosmic orbiters! Nobody reached the gravitational wormhole!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeId];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Cosmic Void with Radial Nebula Glow
    const spaceGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      40,
      width * 0.5,
      height * 0.5,
      width * 0.7
    );
    spaceGrad.addColorStop(0, theme.bgGradInner);
    spaceGrad.addColorStop(0.6, '#0B0F19');
    spaceGrad.addColorStop(1, theme.bgGradOuter);
    ctx.fillStyle = spaceGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    for (let i = 0; i < 40; i++) {
      const sx = (Math.sin(i * 99) * 0.5 + 0.5) * width;
      const sy = (Math.cos(i * 33) * 0.5 + 0.5) * height;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // 2. Celestial Planets & Gravitational Halos
    for (const pl of this.planets) {
      ctx.save();
      // Gravitational field glow
      const haloGrad = ctx.createRadialGradient(
        pl.x,
        pl.y,
        pl.radius * 0.8,
        pl.x,
        pl.y,
        pl.radius * 2.8
      );
      haloGrad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
      haloGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.radius * 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Planet Sphere with 2.5D shading
      const pGrad = ctx.createRadialGradient(
        pl.x - pl.radius * 0.3,
        pl.y - pl.radius * 0.3,
        4,
        pl.x,
        pl.y,
        pl.radius
      );
      pGrad.addColorStop(0, '#FFFFFF');
      pGrad.addColorStop(0.35, pl.color);
      pGrad.addColorStop(1, '#020617');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.radius, 0, Math.PI * 2);
      ctx.fill();

      // Planet Rings if present
      if (pl.hasRing && pl.colorRing) {
        ctx.strokeStyle = pl.colorRing;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(
          pl.x,
          pl.y,
          pl.radius * 1.8,
          pl.radius * 0.5,
          Math.PI * 0.15,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Wormhole Cup
    ctx.save();
    const holeGrad = ctx.createRadialGradient(
      this.holeX,
      this.holeY,
      2,
      this.holeX,
      this.holeY,
      this.holeRadius * 1.5
    );
    holeGrad.addColorStop(0, '#000000');
    holeGrad.addColorStop(0.6, theme.wormholeGlow);
    holeGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = holeGrad;
    ctx.beginPath();
    ctx.arc(this.holeX, this.holeY, this.holeRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme.wormholeGlow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.holeX, this.holeY, this.holeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Flag Pin
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.holeX, this.holeY);
    ctx.lineTo(this.holeX, this.holeY - 26);
    ctx.stroke();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(this.holeX, this.holeY - 26);
    ctx.lineTo(this.holeX + 14, this.holeY - 20);
    ctx.lineTo(this.holeX, this.holeY - 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 4. Golf Balls, Trails, and Aim Guides
    for (const b of this.balls.values()) {
      if (b.inHole) continue;

      const cfg = this.players.find((x) => x.id === b.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      // Underdog aura
      if (this.isUnderdog(b.id)) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ball trail
      if (b.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        b.trail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Aim Line & Gravitational Trajectory Curve
      if (b.isAiming) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);

        let simX = b.x;
        let simY = b.y;
        const curPower = Math.max(180, b.power > 0 ? b.power : 280);
        let simVx = Math.cos(b.aimAngle) * curPower;
        let simVy = Math.sin(b.aimAngle) * curPower;
        const simDt = 0.035;
        const simSteps = this.isUnderdog(b.id) ? 24 : 15;

        for (let step = 0; step < simSteps; step++) {
          for (const pl of this.planets) {
            const pdx = pl.x - simX;
            const pdy = pl.y - simY;
            const distSq = Math.max(pl.radius * pl.radius * 0.8, pdx * pdx + pdy * pdy);
            const dist = Math.sqrt(distSq);
            const force = pl.mass / distSq;
            simVx += (pdx / dist) * force * simDt;
            simVy += (pdy / dist) * force * simDt;
          }
          simX += simVx * simDt;
          simY += simVy * simDt;
          ctx.lineTo(simX, simY);
        }
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(simX, simY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Golf ball sphere with 2.5D specular dot
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 4, b.radius, b.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x - 2, b.y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // Undo screen shake

    // 5. Header / Course Badge (Safe-zone: y: 56, h: 26)
    const headerW = 340;
    const headerH = 26;
    const headerX = width / 2 - headerW / 2;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${theme.icon} ${theme.name.toUpperCase()} • ORBITAL MINI-GOLF`,
      width / 2,
      headerY + 17
    );

    // 6. Corner Player HUD Cards with CharacterRenderer Mascots
    // Offset bottom-left card above Theme Pill (y: height - 128)
    for (const p of this.getActivePlayers()) {
      const b = this.balls.get(p.id);
      if (!b) continue;

      let cx = 16;
      let cy = 72;
      const cardW = 124;
      const cardH = 66;

      if (p.corner === 'top-right') {
        cx = width - cardW - 16;
        cy = 72;
      } else if (p.corner === 'bottom-left') {
        cx = 16;
        cy = height - cardH - 52;
      } else if (p.corner === 'bottom-right') {
        cx = width - cardW - 16;
        cy = height - cardH - 52;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = b.inHole ? '#10B981' : p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 8);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.stroke();

      // Mascot Avatar
      const isBot = p.type !== 'human';
      drawCharacter(ctx, cx + 22, cy + 33, 16, p.id, isBot, b.mood, this.animTimer);

      // Name & Strokes
      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 46, cy + 22);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`Strokes: ${b.strokes}`, cx + 46, cy + 40);

      ctx.fillStyle = b.inHole ? '#10B981' : '#94A3B8';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(b.inHole ? '⛳ SUNK IN WORMHOLE' : 'In Orbit...', cx + 46, cy + 56);
    }

    // 7. Interactive Theme Pill (Bottom-left: x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, pillX + 10, pillY + 20);

    // 8. Control hints (Bottom-right: x: width - 20, y: height - 28)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Steer: Aim Angle | Hold Action: Charge Stroke', width - 20, height - 24);
  }

  public syncDebug(): Record<string, unknown> {
    return {
      theme: this.currentThemeId,
      roundTimer: this.roundTimer,
      suddenDeath: this.suddenDeathTriggered,
      planets: this.planets.length,
      balls: Array.from(this.balls.entries()).map(([id, b]) => ({
        id,
        strokes: b.strokes,
        inHole: b.inHole,
        isUnderdog: this.isUnderdog(id)
      }))
    };
  }
}
