import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

export interface HockeyPaddle {
  id: PlayerId;
  centerAngle: number; // base angle of their goal slot (e.g. 0, PI/2, PI, 3PI/2)
  paddleAngleOffset: number; // current offset along their defensive arc
  paddleWidthAngle: number; // angular width of paddle
  goalsConceded: number;
  charge: number; // 0 to 1 Turbo Slap Shot charge
}

export interface HockeyPuck {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  isMultiPuck?: boolean;
}

export interface HockeyTheme {
  name: string;
  floorBg: string;
  iceGradStart: string;
  iceGradMid: string;
  iceGradEnd: string;
  centerLine: string;
  railColor: string;
  puckColor: string;
  puckCore: string;
}

export const HOCKEY_THEMES: HockeyTheme[] = [
  {
    name: 'Neon Air Rink ⚡',
    floorBg: '#080C14',
    iceGradStart: '#1E293B',
    iceGradMid: '#0F172A',
    iceGradEnd: '#090D16',
    centerLine: 'rgba(56, 189, 248, 0.4)',
    railColor: '#475569',
    puckColor: '#0284C7',
    puckCore: '#BAE6FD'
  },
  {
    name: 'Cyber Magma 🔥',
    floorBg: '#140808',
    iceGradStart: '#2A1212',
    iceGradMid: '#1A0C0C',
    iceGradEnd: '#0D0505',
    centerLine: 'rgba(239, 68, 68, 0.45)',
    railColor: '#7C2D12',
    puckColor: '#EA580C',
    puckCore: '#FEF08A'
  },
  {
    name: 'Bioluminescent 🌌',
    floorBg: '#0C0816',
    iceGradStart: '#24143D',
    iceGradMid: '#140C24',
    iceGradEnd: '#08040F',
    centerLine: 'rgba(168, 85, 247, 0.4)',
    railColor: '#6D28D9',
    puckColor: '#9333EA',
    puckCore: '#E9D5FF'
  }
];

export class MicroHockeyGame extends BaseGame {
  public static readonly THEMES = HOCKEY_THEMES;
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  private paddles: Map<PlayerId, HockeyPaddle> = new Map();
  private pucks: HockeyPuck[] = [];
  private puckIdCounter: number = 0;
  private arenaCenterX: number = 0;
  private arenaCenterY: number = 0;
  private arenaRadius: number = 190;
  private goalAngularWidth: number = 0.65; // ~37 degrees per goal
  private iceObstacles: { x: number; y: number; radius: number; color: string }[] = [];
  public currentMapName: string = 'Clean Ice Sheet';

  // Anti-loop physics engine & stagnation watchdog
  public stagnationTimer: number = 0;
  public consecutiveWallBounces: number = 0;
  private frenzyTriggered: boolean = false;

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __MICRO_HOCKEY_DEBUG__?: unknown }).__MICRO_HOCKEY_DEBUG__) {
      delete (window as unknown as { __MICRO_HOCKEY_DEBUG__?: unknown }).__MICRO_HOCKEY_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % HOCKEY_THEMES.length;
        this.audio.playTap();
      } else if (e.code === 'KeyM') {
        this.generateRandomMap(this.arenaCenterX, this.arenaCenterY, this.arenaRadius);
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = e.target as HTMLCanvasElement;
      if (!canvas || !canvas.getBoundingClientRect) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill is at x: 20, y: canvas.height - 44, w: 180, h: 32
      if (clickX >= 20 && clickX <= 200 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % HOCKEY_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.paddles.clear();
    this.stagnationTimer = 0;
    this.consecutiveWallBounces = 0;
    this.frenzyTriggered = false;
    this.puckIdCounter = 0;

    // Shift arena center slightly downward so top rim and score pills NEVER overlap the top stopwatch/timer
    this.arenaCenterX = width / 2;
    this.arenaCenterY = height / 2 + 22;
    this.arenaRadius = Math.min(width * 0.36, (height - 110) * 0.38);

    // Procedural Ice Rink Obstacle Layout
    this.generateRandomMap(this.arenaCenterX, this.arenaCenterY, this.arenaRadius);

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const baseAngle = (idx / count) * Math.PI * 2;
      this.paddles.set(p.id, {
        id: p.id,
        centerAngle: baseAngle,
        paddleAngleOffset: 0,
        paddleWidthAngle: 0.34,
        goalsConceded: 0,
        charge: 0
      });
    });

    this.pucks = [this.createPuck(false)];

    // Expose debug interface for test suites
    if (typeof window !== 'undefined') {
      (window as unknown as { __MICRO_HOCKEY_DEBUG__?: unknown }).__MICRO_HOCKEY_DEBUG__ = {
        getPuck: () => this.pucks[0] || null,
        getPaddles: () => Array.from(this.paddles.values()),
        getArena: () => ({ x: this.arenaCenterX, y: this.arenaCenterY, radius: this.arenaRadius }),
        getLoopState: () => ({
          stagnation: this.stagnationTimer,
          wallBounces: this.consecutiveWallBounces
        }),
        triggerSimulatedLoop: () => {
          if (this.pucks[0]) {
            this.pucks[0].x = this.arenaCenterX;
            this.pucks[0].y = this.arenaCenterY;
            this.pucks[0].vx = 0;
            this.pucks[0].vy = 360;
          }
          this.consecutiveWallBounces = 4;
          this.stagnationTimer = 4.2;
        }
      };
    }
  }

  private generateRandomMap(cx: number, cy: number, radius: number): void {
    const archetypes = ['Clean Ice Sheet', 'Center Ice Bumper', 'Twin Ice Pegs', 'Satellite Ring'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.iceObstacles = [];
    const theme = HOCKEY_THEMES[this.currentThemeIndex];

    switch (this.currentMapName) {
      case 'Center Ice Bumper':
        this.iceObstacles = [
          { x: cx, y: cy, radius: 24, color: theme.puckColor }
        ];
        break;

      case 'Twin Ice Pegs':
        this.iceObstacles = [
          { x: cx, y: cy - radius * 0.38, radius: 17, color: theme.railColor },
          { x: cx, y: cy + radius * 0.38, radius: 17, color: theme.railColor }
        ];
        break;

      case 'Satellite Ring':
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
          this.iceObstacles.push({
            x: cx + Math.cos(a) * (radius * 0.42),
            y: cy + Math.sin(a) * (radius * 0.42),
            radius: 16,
            color: theme.puckColor
          });
        }
        break;

      case 'Clean Ice Sheet':
      default:
        break;
    }
  }

  private createPuck(isMulti: boolean = false): HockeyPuck {
    const angle = Math.random() * Math.PI * 2;
    const speed = isMulti ? 380 : 340;
    return {
      id: ++this.puckIdCounter,
      x: this.arenaCenterX,
      y: this.arenaCenterY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: isMulti ? 8.5 : 10,
      speed,
      isMultiPuck: isMulti
    };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.stagnationTimer += dt;
    this.updateBots(dt, width, height);

    // Multi-Puck Frenzy at <= 15s remaining!
    if (this.roundTimer <= 15 && !this.frenzyTriggered) {
      this.frenzyTriggered = true;
      this.pucks.push(this.createPuck(true));
      this.audio.playExplosion();
      this.particles.addTrauma(0.25);
      this.particles.showFloatingText('🚨 MULTI-PUCK FRENZY! 🚨', this.arenaCenterX, this.arenaCenterY - 20, '#EF4444', 24);
    }

    // Determine Underdog Surge: player with most goals conceded gets wider paddle cushion
    let maxConceded = 0;
    let minConceded = Infinity;
    for (const p of this.paddles.values()) {
      if (p.goalsConceded > maxConceded) maxConceded = p.goalsConceded;
      if (p.goalsConceded < minConceded) minConceded = p.goalsConceded;
    }

    // Update Player Paddles with fast, snappy response and Turbo Slap charging
    for (const pad of this.paddles.values()) {
      const isUnderdog = maxConceded - pad.goalsConceded <= 0 && maxConceded > minConceded;
      pad.paddleWidthAngle = isUnderdog ? 0.44 : 0.34; // +30% width cushion for underdog!

      const steer = this.input.getSteer(pad.id);
      const isPressed = this.input.isPressed(pad.id);
      const isAction = this.input.isActionPressed(pad.id);

      // Turbo Slap charging
      if (isAction || isPressed) {
        pad.charge = Math.min(1.0, pad.charge + dt * 2.4);
      } else {
        pad.charge = Math.max(0, pad.charge - dt * 1.5);
      }

      // Slide paddle along defensive arc
      const maxOffset = this.goalAngularWidth * 0.68;
      if (steer !== 0) {
        pad.paddleAngleOffset += steer * 3.8 * dt;
      } else if (isPressed && !isAction) {
        // Toggle side deflection oscillation
        pad.paddleAngleOffset += Math.sin(this.roundTimer * 6) * 2.4 * dt;
      }

      pad.paddleAngleOffset = Math.max(-maxOffset, Math.min(maxOffset, pad.paddleAngleOffset));
    }

    // Process all active pucks
    for (let pIdx = this.pucks.length - 1; pIdx >= 0; pIdx--) {
      const puck = this.pucks[pIdx];

      puck.x += puck.vx * dt;
      puck.y += puck.vy * dt;

      // Ice Obstacles Ricochet with anti-stick clearance
      for (const obs of this.iceObstacles) {
        const dx = puck.x - obs.x;
        const dy = puck.y - obs.y;
        const d = Math.hypot(dx, dy);
        if (d < puck.radius + obs.radius && d > 0.001) {
          const nx = dx / d;
          const ny = dy / d;
          puck.x = obs.x + nx * (puck.radius + obs.radius + 1);
          puck.y = obs.y + ny * (puck.radius + obs.radius + 1);
          const dot = puck.vx * nx + puck.vy * ny;
          if (dot < 0) {
            puck.vx -= 2 * dot * nx;
            puck.vy -= 2 * dot * ny;

            const spin = (Math.random() - 0.5) * 0.14;
            const spd = Math.max(300, Math.hypot(puck.vx, puck.vy));
            const ang = Math.atan2(puck.vy, puck.vx) + spin;
            puck.vx = Math.cos(ang) * spd;
            puck.vy = Math.sin(ang) * spd;

            this.audio.playBounce();
            this.particles.spawnSparks(puck.x, puck.y, obs.color, 7);
          }
        }
      }

      // Controlled puck acceleration
      puck.speed = Math.min(520, Math.max(300, puck.speed + dt * 3));

      const distFromCenter = Math.hypot(puck.x - this.arenaCenterX, puck.y - this.arenaCenterY);

      if (distFromCenter >= this.arenaRadius - puck.radius) {
        const puckAngle = Math.atan2(puck.y - this.arenaCenterY, puck.x - this.arenaCenterX);
        let hitPaddle = false;
        let inGoalSector = false;
        let goalPlayerId: PlayerId | null = null;

        // Check each player's goal sector
        for (const pad of this.paddles.values()) {
          let diff = puckAngle - pad.centerAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          if (Math.abs(diff) < this.goalAngularWidth) {
            inGoalSector = true;
            const padAngle = pad.centerAngle + pad.paddleAngleOffset;
            let padDiff = puckAngle - padAngle;
            while (padDiff > Math.PI) padDiff -= Math.PI * 2;
            while (padDiff < -Math.PI) padDiff += Math.PI * 2;

            if (Math.abs(padDiff) < pad.paddleWidthAngle) {
              // Deflected by paddle!
              hitPaddle = true;
              this.consecutiveWallBounces = 0;
              this.stagnationTimer = 0;

              // Check Turbo Slap Shot
              const isTurbo = pad.charge >= 0.55;
              pad.charge = 0;

              const deflSpeed = (isTurbo ? 540 : puck.speed * 1.05);
              const normX = (this.arenaCenterX - puck.x) / distFromCenter;
              const normY = (this.arenaCenterY - puck.y) / distFromCenter;
              const tangX = -normY;
              const tangY = normX;

              puck.vx = normX * deflSpeed + tangX * (padDiff * 260);
              puck.vy = normY * deflSpeed + tangY * (padDiff * 260);

              if (isTurbo) {
                this.audio.playExplosion();
                this.particles.addTrauma(0.18);
                this.particles.showFloatingText('🚀 TURBO SLAP!', puck.x, puck.y - 20, '#FBBF24', 20);
                this.particles.spawnSparks(puck.x, puck.y, '#FBBF24', 16);
              } else {
                this.audio.playTap();
                this.particles.spawnSparks(puck.x, puck.y, this.players[pad.id].color, 8);
              }
              break;
            } else if (distFromCenter >= this.arenaRadius - puck.radius * 0.3) {
              // GOAL CONCEDED!
              goalPlayerId = pad.id;
              break;
            }
          }
        }

        if (goalPlayerId !== null) {
          // Goal scored!
          const victim = this.paddles.get(goalPlayerId);
          if (victim) {
            victim.goalsConceded++;
            this.audio.playExplosion();
            this.particles.addTrauma(0.24);
            this.particles.showFloatingText('GOAL SCORED! 🚨', puck.x, puck.y, '#EF4444', 24);
            this.particles.spawnExplosion(puck.x, puck.y, '#EF4444', 28);
          }
          // Reset this puck
          puck.x = this.arenaCenterX;
          puck.y = this.arenaCenterY;
          const a = Math.random() * Math.PI * 2;
          puck.vx = Math.cos(a) * puck.speed;
          puck.vy = Math.sin(a) * puck.speed;
          this.consecutiveWallBounces = 0;
          this.stagnationTimer = 0;
        } else if (!hitPaddle && !inGoalSector && distFromCenter >= this.arenaRadius - puck.radius) {
          // Perimeter wall rebound between goal openings
          const nx = (puck.x - this.arenaCenterX) / distFromCenter;
          const ny = (puck.y - this.arenaCenterY) / distFromCenter;
          const dot = puck.vx * nx + puck.vy * ny;
          if (dot > 0) {
            puck.vx -= 2 * dot * nx;
            puck.vy -= 2 * dot * ny;

            const spin = (Math.random() - 0.5) * 0.16;
            const curSpeed = Math.hypot(puck.vx, puck.vy);
            const curAng = Math.atan2(puck.vy, puck.vx) + spin;
            puck.vx = Math.cos(curAng) * curSpeed;
            puck.vy = Math.sin(curAng) * curSpeed;

            this.consecutiveWallBounces++;
            this.audio.playBounce();
            this.particles.spawnSparks(puck.x, puck.y, '#38BDF8', 4);
          }

          const maxR = this.arenaRadius - puck.radius;
          puck.x = this.arenaCenterX + nx * maxR;
          puck.y = this.arenaCenterY + ny * maxR;
        }
      }
    }

    // Active Anti-Loop Watchdog
    if (this.consecutiveWallBounces >= 5 || this.stagnationTimer >= 4.5) {
      if (this.pucks[0]) {
        const pads = Array.from(this.paddles.values());
        const targetPad = pads[Math.floor(Math.random() * pads.length)];
        const targetAng = targetPad.centerAngle + (Math.random() - 0.5) * this.goalAngularWidth * 0.6;
        const speed = Math.max(340, Math.min(480, Math.hypot(this.pucks[0].vx, this.pucks[0].vy)));
        this.pucks[0].vx = Math.cos(targetAng) * speed;
        this.pucks[0].vy = Math.sin(targetAng) * speed;
        this.consecutiveWallBounces = 0;
        this.stagnationTimer = 0;
        this.particles.showFloatingText('⚡ TURBO CROSS!', this.pucks[0].x, this.pucks[0].y - 14, '#38BDF8', 18);
        this.particles.spawnSparks(this.pucks[0].x, this.pucks[0].y, '#38BDF8', 12);
        this.audio.playBounce();
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
    width: number,
    height: number
  ): void {
    const pad = this.paddles.get(botId);
    if (!pad || this.pucks.length === 0) return;

    // Pick the most threatening puck heading toward this bot's sector
    let threatPuck = this.pucks[0];
    let shortestETA = Infinity;

    for (const p of this.pucks) {
      const ox = p.x - this.arenaCenterX;
      const oy = p.y - this.arenaCenterY;
      const R = this.arenaRadius - p.radius;
      const A = p.vx * p.vx + p.vy * p.vy;
      const B = 2 * (ox * p.vx + oy * p.vy);
      const C = ox * ox + oy * oy - R * R;
      const discr = B * B - 4 * A * C;

      if (discr >= 0 && A > 10) {
        const t = (-B + Math.sqrt(discr)) / (2 * A);
        if (t > 0 && t < shortestETA) {
          const hitX = p.x + p.vx * t;
          const hitY = p.y + p.vy * t;
          const hitAngle = Math.atan2(hitY - this.arenaCenterY, hitX - this.arenaCenterX);
          let diff = hitAngle - pad.centerAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          if (Math.abs(diff) <= this.goalAngularWidth * 1.2) {
            shortestETA = t;
            threatPuck = p;
          }
        }
      }
    }

    // Predictive Interception on Threat Puck
    const ox = threatPuck.x - this.arenaCenterX;
    const oy = threatPuck.y - this.arenaCenterY;
    const R = this.arenaRadius - threatPuck.radius;
    const A = threatPuck.vx * threatPuck.vx + threatPuck.vy * threatPuck.vy;
    const B = 2 * (ox * threatPuck.vx + oy * threatPuck.vy);
    const C = ox * ox + oy * oy - R * R;
    const discr = B * B - 4 * A * C;

    let targetOffset = 0;
    let wantSlap = false;

    if (discr >= 0 && A > 10) {
      const t = (-B + Math.sqrt(discr)) / (2 * A);
      if (t > 0 && t < 1.8) {
        const hitX = threatPuck.x + threatPuck.vx * t;
        const hitY = threatPuck.y + threatPuck.vy * t;
        const hitAngle = Math.atan2(hitY - this.arenaCenterY, hitX - this.arenaCenterX);

        let diff = hitAngle - pad.centerAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const maxOffset = this.goalAngularWidth * 0.7;

        if (Math.abs(diff) <= this.goalAngularWidth * 1.15) {
          targetOffset = Math.max(-maxOffset, Math.min(maxOffset, diff));
          // Charge turbo slap when puck is approaching
          if (t < 0.6) {
            wantSlap = true;
          }
        } else {
          const curAngle = Math.atan2(oy, ox);
          let cDiff = curAngle - pad.centerAngle;
          while (cDiff > Math.PI) cDiff -= Math.PI * 2;
          while (cDiff < -Math.PI) cDiff += Math.PI * 2;
          targetOffset = Math.max(-maxOffset * 0.35, Math.min(maxOffset * 0.35, cDiff * 0.25));
        }
      }
    }

    // Difficulty calibrations
    let tolerance = 0.04;
    let timingError = 0;
    if (difficulty === 'bot_hard') {
      tolerance = 0.025;
    } else if (difficulty === 'bot_normal') {
      tolerance = 0.055;
      timingError = (Math.random() - 0.5) * 0.03;
    } else {
      tolerance = 0.12;
      timingError = (Math.random() - 0.5) * 0.08;
    }

    let steer = 0;
    const finalTarget = targetOffset + timingError;
    if (pad.paddleAngleOffset < finalTarget - tolerance) {
      steer = 1;
    } else if (pad.paddleAngleOffset > finalTarget + tolerance) {
      steer = -1;
    }

    this.input.setBotInput(botId, wantSlap, steer, 0, wantSlap);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.paddles.values()).sort((a, b) => a.goalsConceded - b.goalsConceded);
    const winnerId = sorted.length > 0 ? sorted[0].id : null;

    return {
      winnerId,
      rankings: sorted.map((p, idx) => ({
        playerId: p.id,
        score: -p.goalsConceded,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} DEFENDED THEIR GOAL LIKE A WALL!` : 'INTENSE AIR HOCKEY CLASH!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    const theme = HOCKEY_THEMES[this.currentThemeIndex];

    // 1. Stadium Surroundings
    ctx.fillStyle = theme.floorBg;
    ctx.fillRect(0, 0, width, height);

    // 2. Air Hockey Ice Rink Surface
    const iceGrad = ctx.createRadialGradient(
      this.arenaCenterX, this.arenaCenterY, 30,
      this.arenaCenterX, this.arenaCenterY, this.arenaRadius
    );
    iceGrad.addColorStop(0, theme.iceGradStart);
    iceGrad.addColorStop(0.7, theme.iceGradMid);
    iceGrad.addColorStop(1, theme.iceGradEnd);
    ctx.fillStyle = iceGrad;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius, 0, Math.PI * 2);
    ctx.fill();

    // Air Cushion Micro-vents
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    const ventStep = 32;
    for (let vx = this.arenaCenterX - this.arenaRadius; vx <= this.arenaCenterX + this.arenaRadius; vx += ventStep) {
      for (let vy = this.arenaCenterY - this.arenaRadius; vy <= this.arenaCenterY + this.arenaRadius; vy += ventStep) {
        if (Math.hypot(vx - this.arenaCenterX, vy - this.arenaCenterY) < this.arenaRadius - 8) {
          ctx.beginPath();
          ctx.arc(vx, vy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Center Faceoff Circle & Centerline
    ctx.strokeStyle = theme.centerLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, 46, 0, Math.PI * 2);
    ctx.moveTo(this.arenaCenterX, this.arenaCenterY - this.arenaRadius);
    ctx.lineTo(this.arenaCenterX, this.arenaCenterY + this.arenaRadius);
    ctx.stroke();

    ctx.fillStyle = theme.puckColor;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Tactical Ice Bumpers & Pegs
    for (const obs of this.iceObstacles) {
      ctx.save();
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = obs.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = obs.color;
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Outer Chrome Table Rail
    ctx.strokeStyle = theme.railColor;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius + 6, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Goal Arcs and Defensive Mallets
    let maxConceded = 0;
    let minConceded = Infinity;
    for (const p of this.paddles.values()) {
      if (p.goalsConceded > maxConceded) maxConceded = p.goalsConceded;
      if (p.goalsConceded < minConceded) minConceded = p.goalsConceded;
    }

    for (const pad of this.paddles.values()) {
      const pColor = this.players[pad.id]?.color || '#FFFFFF';
      const isUnderdog = maxConceded - pad.goalsConceded <= 0 && maxConceded > minConceded;

      // Goal Pocket Opening
      ctx.save();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(
        this.arenaCenterX,
        this.arenaCenterY,
        this.arenaRadius + 6,
        pad.centerAngle - this.goalAngularWidth,
        pad.centerAngle + this.goalAngularWidth
      );
      ctx.stroke();
      ctx.restore();

      // Striker / Defensive Paddle (3D Mallet Arc)
      const paddleCenter = pad.centerAngle + pad.paddleAngleOffset;

      // Mallet Base Rim
      ctx.save();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(
        this.arenaCenterX,
        this.arenaCenterY,
        this.arenaRadius - 12,
        paddleCenter - pad.paddleWidthAngle,
        paddleCenter + pad.paddleWidthAngle
      );
      ctx.stroke();

      // Mallet Top Grip (White highlight strip)
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Underdog Golden Cushion Glow
      if (isUnderdog) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 4;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(
          this.arenaCenterX,
          this.arenaCenterY,
          this.arenaRadius - 4,
          paddleCenter - pad.paddleWidthAngle,
          paddleCenter + pad.paddleWidthAngle
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Turbo Charge Sparkles
      if (pad.charge > 0.2) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          this.arenaCenterX,
          this.arenaCenterY,
          this.arenaRadius - 12,
          paddleCenter - pad.paddleWidthAngle * pad.charge,
          paddleCenter + pad.paddleWidthAngle * pad.charge
        );
        ctx.stroke();
      }

      ctx.restore();

      // Player Score Pill
      const tagAngle = pad.centerAngle;
      const tagDist = this.arenaRadius + 30;
      let tagX = this.arenaCenterX + Math.cos(tagAngle) * tagDist;
      let tagY = this.arenaCenterY + Math.sin(tagAngle) * tagDist;

      if (tagY < 72 && Math.abs(tagX - width / 2) < 120) {
        tagY = 70;
        tagX = width / 2 + (Math.cos(tagAngle) >= 0 ? 100 : -100);
      }

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(tagX - 52, tagY - 13, 104, 26, 13);
      else ctx.rect(tagX - 52, tagY - 13, 104, 26);
      ctx.fill();
      ctx.strokeStyle = isUnderdog ? '#FBBF24' : pColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = isUnderdog ? '#FBBF24' : '#FFFFFF';
      ctx.font = '800 10.5px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${this.players[pad.id].name.toUpperCase()}: ${pad.goalsConceded} GA`, tagX, tagY);
      ctx.restore();
    }

    // 4. Glowing Neon Pucks
    for (const puck of this.pucks) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(puck.x + 3, puck.y + 3, puck.radius, 0, Math.PI * 2);
      ctx.fill();

      // Puck neon outer body
      ctx.shadowColor = puck.isMultiPuck ? '#EF4444' : theme.puckColor;
      ctx.shadowBlur = 16;
      ctx.fillStyle = puck.isMultiPuck ? '#DC2626' : theme.puckColor;
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
      ctx.fill();

      // Puck bright center core
      ctx.fillStyle = puck.isMultiPuck ? '#FEF08A' : theme.puckCore;
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puck.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Frenzy Banner at y=56 if <= 15s
    if (this.roundTimer <= 15) {
      ctx.save();
      const pillW = 280;
      const pillH = 26;
      const pillX = width / 2 - pillW / 2;
      const pillY = 56;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
      else ctx.rect(pillX, pillY, pillW, pillH);
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚨 MULTI-PUCK FRENZY! 🚨', width / 2, pillY + pillH / 2);
      ctx.restore();
    }

    // 6. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 180, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 180, 32, 16);
    else ctx.rect(20, height - 44, 180, 32);
    ctx.fill();
    ctx.strokeStyle = theme.railColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 90, height - 44 + 16);
    ctx.restore();

    ctx.restore();
  }
}
