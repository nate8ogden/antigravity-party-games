import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface Waypoint {
  x: number;
  y: number;
}

interface TireWall {
  x: number;
  y: number;
  radius: number;
}

interface SkidMark {
  x: number;
  y: number;
  alpha: number;
}

interface Racer {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  speed: number;
  isDrifting: boolean;
  driftCharge: number;
  nitroEnergy: number; // 0 to 100
  nitroTier: 0 | 1 | 2 | 3;
  turboTimer: number;
  slipstreamTimer: number;
  lap: number;
  nextWaypointIndex: number;
  finished: boolean;
  finishTime: number;
  spinoutTimer: number;
  // Anti-loop and recovery metrics
  cumulativeRotation: number;
  lastAngle: number;
  stallTime: number;
  isWrongWay: boolean;
  rescueBoostTimer: number;
}

interface TrackHazard {
  x: number;
  y: number;
  type: 'oil' | 'boost';
}

export class MicroTurboGPGame extends BaseGame {
  private racers: Map<PlayerId, Racer> = new Map();
  private waypoints: Waypoint[] = [];
  private hazards: TrackHazard[] = [];
  private tireWalls: TireWall[] = [];
  private skidMarks: SkidMark[] = [];
  private totalLaps = 3;
  private trackWidth = 78;
  private gameTime = 0;
  private themeIndex: number = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  public currentTrackName: string = 'Grand Prix Circuit';

  private themes = [
    {
      name: 'Emerald Grand Prix',
      lawnLight: '#0F3821',
      lawnDark: '#0B2A18',
      curbPrimary: '#DC2626',
      asphaltOuter: '#1E293B',
      asphaltInner: '#0F172A',
      centerDash: '#FBBF24'
    },
    {
      name: 'Sunset Canyon Speedway',
      lawnLight: '#451A03',
      lawnDark: '#2E1102',
      curbPrimary: '#F97316',
      asphaltOuter: '#292524',
      asphaltInner: '#1C1917',
      centerDash: '#38BDF8'
    },
    {
      name: 'Midnight Tokyo Circuit',
      lawnLight: '#0F172A',
      lawnDark: '#090D16',
      curbPrimary: '#EC4899',
      asphaltOuter: '#1E1B4B',
      asphaltInner: '#0F0D2E',
      centerDash: '#22D3EE'
    }
  ];

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIndex = (this.themeIndex + 1) % this.themes.length;
          this.audio.playTap();
        } else if (e.key === '1') {
          this.themeIndex = 0;
        } else if (e.key === '2') {
          this.themeIndex = 1;
        } else if (e.key === '3') {
          this.themeIndex = 2;
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 90;
    this.gameTime = 0;
    this.isFinished = false;
    this.racers.clear();
    this.hazards = [];
    this.tireWalls = [];
    this.skidMarks = [];

    const cx = width / 2;
    const cy = height / 2;
    const rw = width * 0.36;
    const rh = height * 0.33;

    // Procedurally generated track layout
    this.generateRandomTrack(cx, cy, rw, rh);

    // Start line positions behind waypoint 0 facing towards waypoint 1
    const active = this.getActivePlayers();
    const p0 = this.waypoints[0];
    const p1 = this.waypoints[1] || { x: p0.x + 10, y: p0.y };
    const trackAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const startX = p0.x - Math.cos(trackAngle) * 45;
    const startY = p0.y - Math.sin(trackAngle) * 45;

    active.forEach((p, idx) => {
      const perpAngle = trackAngle + Math.PI / 2;
      const lateralDist = idx % 2 === 0 ? -16 : 16;
      const rowDist = Math.floor(idx / 2) * 26;
      const px = startX + Math.cos(perpAngle) * lateralDist - Math.cos(trackAngle) * rowDist;
      const py = startY + Math.sin(perpAngle) * lateralDist - Math.sin(trackAngle) * rowDist;

      this.racers.set(p.id, {
        id: p.id,
        x: px,
        y: py,
        angle: trackAngle,
        speed: 0,
        isDrifting: false,
        driftCharge: 0,
        nitroEnergy: 40,
        nitroTier: 0,
        turboTimer: 0,
        slipstreamTimer: 0,
        lap: 0,
        nextWaypointIndex: 0,
        finished: false,
        finishTime: 0,
        spinoutTimer: 0,
        cumulativeRotation: 0,
        lastAngle: trackAngle,
        stallTime: 0,
        isWrongWay: false,
        rescueBoostTimer: 0
      });
    });
  }

  private generateRandomTrack(cx: number, cy: number, rw: number, rh: number): void {
    const archetypes = ['Grand Prix Circuit', 'Figure-8 Twister', 'Omega Ring', 'Canyon Switchback'];
    this.currentTrackName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.waypoints = [];
    this.hazards = [];
    this.tireWalls = [];

    switch (this.currentTrackName) {
      case 'Grand Prix Circuit':
        this.waypoints = [
          { x: cx - rw, y: cy - rh },
          { x: cx, y: cy - rh - 20 },
          { x: cx + rw, y: cy - rh },
          { x: cx + rw + 20, y: cy },
          { x: cx + rw * 0.5, y: cy + rh * 0.2 },
          { x: cx + rw, y: cy + rh },
          { x: cx, y: cy + rh },
          { x: cx - rw, y: cy + rh },
          { x: cx - rw - 20, y: cy }
        ];
        break;

      case 'Figure-8 Twister':
        this.waypoints = [
          { x: cx - rw * 0.8, y: cy - rh },
          { x: cx - rw * 0.2, y: cy - rh },
          { x: cx + rw * 0.3, y: cy - rh * 0.3 },
          { x: cx + rw * 0.8, y: cy - rh * 0.8 },
          { x: cx + rw, y: cy },
          { x: cx + rw * 0.7, y: cy + rh * 0.8 },
          { x: cx + rw * 0.2, y: cy + rh * 0.4 },
          { x: cx - rw * 0.4, y: cy + rh * 0.9 },
          { x: cx - rw, y: cy + rh * 0.6 },
          { x: cx - rw * 0.8, y: cy }
        ];
        break;

      case 'Omega Ring':
        const numPoints = 8;
        for (let i = 0; i < numPoints; i++) {
          const ang = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
          const rX = rw * (0.85 + (i % 2 === 0 ? 0.15 : -0.1));
          const rY = rh * (0.85 + (i % 2 === 1 ? 0.15 : -0.1));
          this.waypoints.push({
            x: cx + Math.cos(ang) * rX,
            y: cy + Math.sin(ang) * rY
          });
        }
        break;

      case 'Canyon Switchback':
      default:
        this.waypoints = [
          { x: cx - rw, y: cy - rh * 0.7 },
          { x: cx - rw * 0.4, y: cy - rh },
          { x: cx + rw * 0.4, y: cy - rh },
          { x: cx + rw, y: cy - rh * 0.6 },
          { x: cx + rw * 0.6, y: cy },
          { x: cx + rw * 0.9, y: cy + rh * 0.8 },
          { x: cx, y: cy + rh * 0.9 },
          { x: cx - rw * 0.6, y: cy + rh * 0.6 },
          { x: cx - rw * 0.9, y: cy }
        ];
        break;
    }

    // Procedurally spawn boost pads and oil slicks along straightaways
    for (let i = 1; i < this.waypoints.length; i++) {
      const w0 = this.waypoints[i - 1];
      const w1 = this.waypoints[i];
      const midX = (w0.x + w1.x) / 2;
      const midY = (w0.y + w1.y) / 2;
      if (i % 2 === 1) {
        this.hazards.push({ x: midX, y: midY, type: 'boost' });
      } else if (i % 2 === 0) {
        this.hazards.push({ x: midX, y: midY, type: 'oil' });
      }
    }

    // Procedurally place safety Tire Wall barriers along the outside of sharp corners
    for (let i = 0; i < this.waypoints.length; i++) {
      const prev = this.waypoints[(i - 1 + this.waypoints.length) % this.waypoints.length];
      const curr = this.waypoints[i];
      const next = this.waypoints[(i + 1) % this.waypoints.length];

      const inAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      const outAngle = Math.atan2(next.y - curr.y, next.x - curr.x);
      let turnDiff = outAngle - inAngle;
      while (turnDiff > Math.PI) turnDiff -= Math.PI * 2;
      while (turnDiff < -Math.PI) turnDiff += Math.PI * 2;

      // If corner turn is sharper than 35 degrees, place tire wall clusters on the outside
      if (Math.abs(turnDiff) > 0.6) {
        const bisectorAngle = inAngle + turnDiff / 2;
        const outsideAngle = turnDiff > 0 ? bisectorAngle - Math.PI / 2 : bisectorAngle + Math.PI / 2;
        const barrierDist = this.trackWidth * 0.58;

        for (let t = -1; t <= 1; t++) {
          const spreadAngle = outsideAngle + t * 0.28;
          this.tireWalls.push({
            x: curr.x + Math.cos(spreadAngle) * (barrierDist + 8),
            y: curr.y + Math.sin(spreadAngle) * (barrierDist + 8),
            radius: 11
          });
        }
      }
    }
  }

  // Distance from point (px, py) to line segment (x1, y1)-(x2, y2)
  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.gameTime += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Fade skid marks
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      this.skidMarks[i].alpha -= dt * 0.6;
      if (this.skidMarks[i].alpha <= 0) {
        this.skidMarks.splice(i, 1);
      }
    }

    for (const r of this.racers.values()) {
      if (r.finished) continue;

      if (r.rescueBoostTimer > 0) r.rescueBoostTimer -= dt;
      if (r.turboTimer > 0) r.turboTimer -= dt;

      // Handle spinout (e.g. from hitting an oil slick)
      if (r.spinoutTimer > 0) {
        r.spinoutTimer -= dt;
        r.angle += 12 * dt;
        r.speed *= 0.94;
        r.x += Math.cos(r.angle) * r.speed * dt;
        r.y += Math.sin(r.angle) * r.speed * dt;
        continue;
      }

      const isPressed = this.input.isPressed(r.id);
      const steer = this.input.getSteer(r.id);
      const throttle = this.input.getThrottle(r.id);
      const action = this.input.isActionPressed(r.id);

      // Passive Nitro regeneration (trickle charge while driving)
      r.nitroEnergy = Math.min(100, r.nitroEnergy + dt * 14);

      // --- Steering & Drift Mechanics ---
      // In single-button mode, holding initiates a power drift turning toward the inside
      // In directional mode, steer controls left/right while action/hold drifts
      const wantsDrift = action || (isPressed && steer === 0);

      if (steer !== 0) {
        r.angle += steer * (wantsDrift ? 4.4 : 3.6) * dt;
        if (wantsDrift) {
          r.isDrifting = true;
          r.driftCharge += dt;
          r.nitroEnergy = Math.min(100, r.nitroEnergy + dt * 45);
        }
      } else if (isPressed) {
        // Single-button drift: turn with high responsiveness and charge Nitro
        r.isDrifting = true;
        r.angle += 3.7 * dt;
        r.driftCharge += dt;
        r.nitroEnergy = Math.min(100, r.nitroEnergy + dt * 45);
      }

      // Track Nitro Tiers based on charge duration
      if (r.driftCharge >= 1.15) {
        r.nitroTier = 3; // Mega Nitro
      } else if (r.driftCharge >= 0.65) {
        r.nitroTier = 2; // Super Nitro
      } else if (r.driftCharge >= 0.22) {
        r.nitroTier = 1; // Mini Nitro
      } else {
        r.nitroTier = 0;
      }

      // Drift particle smoke & skid marks
      if (r.isDrifting && r.speed > 80) {
        if (Math.random() < 0.35) {
          const rearX = r.x - Math.cos(r.angle) * 14;
          const rearY = r.y - Math.sin(r.angle) * 14;
          this.skidMarks.push({ x: rearX, y: rearY, alpha: 0.6 });
          if (this.skidMarks.length > 120) this.skidMarks.shift();

          const sparkColor = r.nitroTier === 3 ? '#C084FC' : r.nitroTier === 2 ? '#FB923C' : '#38BDF8';
          this.particles.spawnSparks(rearX, rearY, sparkColor, r.nitroTier + 1);
        }
      }

      // --- UNLEASH CHARGE-UP NITRO (On Release) ---
      if (!wantsDrift && (!isPressed || steer !== 0)) {
        if (r.isDrifting) {
          r.isDrifting = false;
          if (r.nitroTier === 3) {
            // Tier 3 Mega Nitro
            r.turboTimer = 1.6;
            r.speed = Math.max(r.speed, 350);
            this.audio.playBoost();
            this.particles.showFloatingText('MEGA NITRO! ⚡⚡⚡', r.x, r.y - 22, '#A855F7', 22);
            this.particles.spawnExplosion(r.x, r.y, '#EC4899', 14);
          } else if (r.nitroTier === 2) {
            // Tier 2 Super Nitro
            r.turboTimer = 1.2;
            r.speed = Math.max(r.speed, 310);
            this.audio.playBoost();
            this.particles.showFloatingText('SUPER NITRO! 🔥🔥', r.x, r.y - 20, '#F97316', 20);
            this.particles.spawnSparks(r.x, r.y, '#F97316', 12);
          } else if (r.nitroTier === 1) {
            // Tier 1 Mini Nitro
            r.turboTimer = 0.8;
            r.speed = Math.max(r.speed, 270);
            this.audio.playBoost();
            this.particles.showFloatingText('NITRO BOOST! ⚡', r.x, r.y - 18, '#38BDF8', 18);
            this.particles.spawnSparks(r.x, r.y, '#38BDF8', 8);
          }
          r.driftCharge = 0;
          r.nitroTier = 0;
        }
      }

      // Top speeds based on boosts
      let maxSpeed = 220;
      if (r.turboTimer > 0) {
        maxSpeed = 345;
      } else if (r.slipstreamTimer > 0) {
        maxSpeed = 265;
      }

      // Grass Off-Track Detection & Drag
      let minDistToTrack = Infinity;
      for (let i = 0; i < this.waypoints.length; i++) {
        const w0 = this.waypoints[i];
        const w1 = this.waypoints[(i + 1) % this.waypoints.length];
        const d = this.distToSegment(r.x, r.y, w0.x, w0.y, w1.x, w1.y);
        if (d < minDistToTrack) minDistToTrack = d;
      }

      const isOffTrack = minDistToTrack > this.trackWidth * 0.52;
      if (isOffTrack && r.turboTimer <= 0) {
        maxSpeed = 115; // Grass speed limit
        if (r.speed > 115) {
          r.speed = Math.max(115, r.speed - 240 * dt);
        }
        if (Math.random() < 0.25 && r.speed > 40) {
          this.particles.spawnSparks(r.x - Math.cos(r.angle) * 12, r.y - Math.sin(r.angle) * 12, '#22C55E', 2);
        }
      }

      const accel = throttle > 0 || isPressed ? 320 : throttle < 0 ? -200 : 120;
      r.speed = Math.max(0, Math.min(maxSpeed, r.speed + accel * dt));

      // Move forward
      r.x += Math.cos(r.angle) * r.speed * dt;
      r.y += Math.sin(r.angle) * r.speed * dt;

      // --- PHYSICAL SAFETY WALL COLLISIONS ---
      // 1. Arena Perimeter Wall (bounces cars back on-screen)
      const wallMargin = 22;
      let hitPerimeter = false;
      if (r.x < wallMargin) {
        r.x = wallMargin;
        r.angle = Math.PI - r.angle;
        hitPerimeter = true;
      } else if (r.x > width - wallMargin) {
        r.x = width - wallMargin;
        r.angle = Math.PI - r.angle;
        hitPerimeter = true;
      }
      if (r.y < wallMargin) {
        r.y = wallMargin;
        r.angle = -r.angle;
        hitPerimeter = true;
      } else if (r.y > height - wallMargin) {
        r.y = height - wallMargin;
        r.angle = -r.angle;
        hitPerimeter = true;
      }
      if (hitPerimeter) {
        r.speed = Math.max(60, r.speed * 0.65);
        this.audio.playBounce();
        this.particles.spawnSparks(r.x, r.y, '#FBBF24', 6);
      }

      // 2. Track Tire Wall Barriers (bounces car back toward racing line)
      for (const tire of this.tireWalls) {
        const dist = Math.hypot(r.x - tire.x, r.y - tire.y);
        const minD = tire.radius + 14;
        if (dist < minD) {
          const pushAngle = Math.atan2(r.y - tire.y, r.x - tire.x);
          r.x = tire.x + Math.cos(pushAngle) * minD;
          r.y = tire.y + Math.sin(pushAngle) * minD;
          r.speed = Math.max(65, r.speed * 0.7);

          // Gently orient toward next waypoint
          const targetWp = this.waypoints[r.nextWaypointIndex];
          const wpAngle = Math.atan2(targetWp.y - r.y, targetWp.x - r.x);
          r.angle = wpAngle;

          this.audio.playBounce();
          this.particles.spawnSparks(r.x, r.y, '#EF4444', 8);
        }
      }

      // --- HAZARDS & SPEED PADS ---
      for (const h of this.hazards) {
        if (Math.hypot(r.x - h.x, r.y - h.y) < 26) {
          if (h.type === 'oil') {
            // Mega Nitro burns through oil slicks with invulnerability!
            if (r.turboTimer > 0.8 && r.speed > 280) {
              this.particles.spawnSparks(r.x, r.y, '#A855F7', 6);
            } else if (r.spinoutTimer <= 0) {
              r.spinoutTimer = 0.6;
              this.audio.playStun();
              this.particles.showFloatingText('SPINOUT!', r.x, r.y - 20, '#F59E0B');
            }
          } else if (h.type === 'boost' && r.turboTimer <= 0) {
            r.turboTimer = 1.0;
            this.audio.playBoost();
            this.particles.showFloatingText('SPEED PAD!', r.x, r.y - 20, '#10B981');
          }
        }
      }

      // Slipstream detection (tailgating another car)
      for (const other of this.racers.values()) {
        if (other.id !== r.id && !other.finished) {
          const dist = Math.hypot(other.x - r.x, other.y - r.y);
          if (dist < 80 && dist > 15) {
            const angleToOther = Math.atan2(other.y - r.y, other.x - r.x);
            if (Math.abs(angleToOther - r.angle) < 0.4) {
              r.slipstreamTimer = 0.5;
              if (Math.random() < 0.2) {
                this.particles.spawnSparks(r.x, r.y, '#67E8F9', 2);
              }
            }
          }
        }
      }

      // --- ANTI-LOOP & WRONG-WAY SMART RECOVERY ---
      const targetWp = this.waypoints[r.nextWaypointIndex];
      const angleToWp = Math.atan2(targetWp.y - r.y, targetWp.x - r.x);
      let angleDiff = angleToWp - r.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      let rotDelta = r.angle - r.lastAngle;
      while (rotDelta > Math.PI) rotDelta -= Math.PI * 2;
      while (rotDelta < -Math.PI) rotDelta += Math.PI * 2;
      r.lastAngle = r.angle;

      if (Math.abs(rotDelta) > 0.02) {
        r.cumulativeRotation += Math.abs(rotDelta);
      } else {
        r.cumulativeRotation = Math.max(0, r.cumulativeRotation - dt * 2);
      }

      // Wrong-way detection: facing more than 115 degrees away from next waypoint
      const isFacingWrong = Math.abs(angleDiff) > 2.0;
      r.isWrongWay = isFacingWrong;

      // Stall / Loop detection:
      // If car has turned more than 1.4 full circles (2.8*PI) without hitting a waypoint,
      // or is facing backwards for > 1s, or is spinning:
      const isLooping = r.cumulativeRotation > Math.PI * 2.8;
      if (isFacingWrong || isLooping || (r.speed < 45 && r.driftCharge > 0.5)) {
        r.stallTime += dt;
      } else if (!isLooping && !isFacingWrong) {
        r.stallTime = Math.max(0, r.stallTime - dt * 0.8);
      }

      // AUTO-RESCUE BREAKOUT BOOST (Triggers if stuck in a loop for 1.5s or 1.7 full spins)
      if (r.stallTime >= 1.5 || r.cumulativeRotation >= Math.PI * 3.4) {
        r.angle = angleToWp;
        r.speed = 290;
        r.turboTimer = 1.5;
        r.nitroTier = 2;
        r.stallTime = 0;
        r.cumulativeRotation = 0;
        r.isWrongWay = false;
        r.rescueBoostTimer = 1.5;
        this.audio.playBoost();
        this.particles.showFloatingText('🚀 RESCUE BOOST!', r.x, r.y - 24, '#38BDF8', 24);
        this.particles.spawnGoBlast(r.x, r.y);
      }

      // --- WAYPOINT ADVANCEMENT & LAP COMPLETION ---
      const distToWp = Math.hypot(r.x - targetWp.x, r.y - targetWp.y);
      if (distToWp < this.trackWidth * 1.45) {
        r.nextWaypointIndex = (r.nextWaypointIndex + 1) % this.waypoints.length;
        r.cumulativeRotation = 0;
        r.stallTime = 0;
        r.isWrongWay = false;

        if (r.nextWaypointIndex === 0) {
          r.lap++;
          this.audio.playScore();
          this.particles.showFloatingText(`LAP ${r.lap}/${this.totalLaps}`, r.x, r.y - 24, '#FBBF24', 20);

          if (r.lap >= this.totalLaps) {
            r.finished = true;
            r.finishTime = 90 - this.roundTimer;
            this.audio.playFanfare();
            this.particles.showFloatingText('FINISHED!', r.x, r.y - 28, '#10B981', 28);
          }
        }
      }
    }

    // Check round over
    const finishedCount = Array.from(this.racers.values()).filter((r) => r.finished).length;
    if (finishedCount >= 1 || this.roundTimer <= 0) {
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
    const r = this.racers.get(botId);
    if (!r || r.finished || r.spinoutTimer > 0) return;

    // Lookahead waypoint index
    const lookaheadCount = difficulty === 'bot_hard' ? 2 : difficulty === 'bot_normal' ? 1 : 0;
    const targetWp = this.waypoints[(r.nextWaypointIndex + lookaheadCount) % this.waypoints.length];

    let targetX = targetWp.x;
    let targetY = targetWp.y;

    // Avoid oil slick hazards
    if (difficulty !== 'bot_easy') {
      for (const h of this.hazards) {
        if (h.type === 'oil') {
          const d = Math.hypot(r.x - h.x, r.y - h.y);
          if (d < 75) {
            const perpX = -(h.y - r.y);
            const perpY = h.x - r.x;
            targetX += perpX * 0.6;
            targetY += perpY * 0.6;
            break;
          }
        }
      }
    }

    const targetAngle = Math.atan2(targetY - r.y, targetX - r.x);
    let diff = targetAngle - r.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const steerSens = difficulty === 'bot_hard' ? 3.0 : difficulty === 'bot_normal' ? 2.5 : 1.8;
    const steer = Math.max(-1, Math.min(1, diff * steerSens));

    // Drift on sharp corners, straighten and pop nitro on exits
    const isSharpCorner = Math.abs(diff) > 0.42;
    const shouldDrift = isSharpCorner && r.speed > 110 && difficulty !== 'bot_easy';
    const throttle = isSharpCorner && r.speed > 210 ? 0.4 : 1.0;

    this.input.setBotInput(botId, shouldDrift, steer, throttle, shouldDrift);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const curTheme = this.themes[this.themeIndex] || this.themes[0];
    ctx.save();

    // 1. Infield / Grass Arena with Checkerboard Lawn Texture
    const lawnSize = 64;
    for (let y = 0; y < height; y += lawnSize) {
      for (let x = 0; x < width; x += lawnSize) {
        const isLight = (Math.floor(x / lawnSize) + Math.floor(y / lawnSize)) % 2 === 0;
        ctx.fillStyle = isLight ? curTheme.lawnLight : curTheme.lawnDark;
        ctx.fillRect(x, y, lawnSize, lawnSize);
      }
    }

    // 2. Track Underlay: Red & White Racing Rumble Curbs
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Red base curb
    ctx.lineWidth = this.trackWidth + 14;
    ctx.strokeStyle = curTheme.curbPrimary;
    ctx.beginPath();
    ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++) {
      ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // White alternating curb blocks (dashed overlay)
    ctx.strokeStyle = '#FFFFFF';
    ctx.setLineDash([20, 20]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Asphalt Track Surface
    ctx.lineWidth = this.trackWidth;
    ctx.strokeStyle = curTheme.asphaltOuter;
    ctx.stroke();

    // Inner asphalt texture groove
    ctx.lineWidth = this.trackWidth - 8;
    ctx.strokeStyle = curTheme.asphaltInner;
    ctx.stroke();

    // Track centerline (yellow dash)
    ctx.setLineDash([14, 14]);
    ctx.strokeStyle = curTheme.centerDash;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Drift Skid Marks on Asphalt
    for (const sm of this.skidMarks) {
      ctx.fillStyle = `rgba(15, 23, 42, ${sm.alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Checkered Start / Finish Line at waypoint 0
    const p0 = this.waypoints[0];
    const p1 = this.waypoints[1];
    const trackAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(trackAngle + Math.PI / 2);
    const finishW = this.trackWidth - 4;
    const checkSize = 8;
    for (let cx = -finishW / 2; cx < finishW / 2; cx += checkSize) {
      for (let cy = -checkSize; cy < checkSize; cy += checkSize) {
        const isWhite = (Math.floor(cx / checkSize) + Math.floor(cy / checkSize)) % 2 === 0;
        ctx.fillStyle = isWhite ? '#FFFFFF' : '#000000';
        ctx.fillRect(cx, cy, checkSize, checkSize);
      }
    }
    ctx.restore();

    // 6. Hazards & Power-ups
    for (const h of this.hazards) {
      if (h.type === 'oil') {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.ellipse(h.x + 2, h.y + 2, 24, 16, 0.3, 0, Math.PI * 2);
        ctx.fill();

        const oilGrad = ctx.createLinearGradient(h.x - 20, h.y - 10, h.x + 20, h.y + 10);
        oilGrad.addColorStop(0, '#0F172A');
        oilGrad.addColorStop(0.3, '#7C3AED');
        oilGrad.addColorStop(0.6, '#06B6D4');
        oilGrad.addColorStop(1, '#10B981');
        ctx.fillStyle = oilGrad;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, 22, 14, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      } else {
        // Boost Chevron Pad
        ctx.save();
        ctx.fillStyle = '#065F46';
        ctx.beginPath();
        ctx.arc(h.x, h.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.shadowColor = '#34D399';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(h.x, h.y - 7);
        ctx.lineTo(h.x + 6, h.y + 4);
        ctx.lineTo(h.x + 3, h.y + 4);
        ctx.lineTo(h.x, h.y - 1);
        ctx.lineTo(h.x - 3, h.y + 4);
        ctx.lineTo(h.x - 6, h.y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 7. Physical Tire Wall Barriers
    for (const tire of this.tireWalls) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      // Tire outer rubber
      ctx.beginPath();
      ctx.arc(tire.x, tire.y, tire.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Tire rim hole
      ctx.beginPath();
      ctx.arc(tire.x, tire.y, tire.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    }

    // 8. Arena Perimeter Safety Walls (Red/White & Yellow/Black Hazard Guardrail)
    ctx.save();
    const margin = 16;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#F59E0B';
    ctx.setLineDash([16, 16]);
    ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
    ctx.setLineDash([]);

    // Corner bumper posts
    const corners = [
      { x: margin, y: margin },
      { x: width - margin, y: margin },
      { x: margin, y: height - margin },
      { x: width - margin, y: height - margin }
    ];
    for (const c of corners) {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // 9. Draw High-Detail Micro Racers & HUD
    for (const r of this.racers.values()) {
      const p = this.players[r.id];

      // Smart Compass Arrow if turning around or facing wrong way
      if (r.isWrongWay || r.stallTime > 1.2) {
        const targetWp = this.waypoints[r.nextWaypointIndex];
        const toWpAngle = Math.atan2(targetWp.y - r.y, targetWp.x - r.x);

        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(toWpAngle);

        const pulse = 1 + 0.15 * Math.sin(this.gameTime * 10);
        ctx.fillStyle = '#FBBF24';
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(34 * pulse, 0);
        ctx.lineTo(20 * pulse, -10 * pulse);
        ctx.lineTo(22 * pulse, -4 * pulse);
        ctx.lineTo(12 * pulse, -4 * pulse);
        ctx.lineTo(12 * pulse, 4 * pulse);
        ctx.lineTo(22 * pulse, 4 * pulse);
        ctx.lineTo(20 * pulse, 10 * pulse);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);

      // Car Ground Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-16, -10, 32, 20, 4);
      else ctx.rect(-16, -10, 32, 20);
      ctx.fill();

      // 4 High-Grip Rubber Tires
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(8, -12, 7, 4);
      ctx.fillRect(8, 8, 7, 4);
      ctx.fillRect(-14, -13, 8, 5);
      ctx.fillRect(-14, 8, 8, 5);

      // Turbo Exhaust Flame Jets (Color-coded by tier)
      if (r.turboTimer > 0) {
        ctx.save();
        const flameColor = r.nitroTier === 3 ? '#C084FC' : r.nitroTier === 2 ? '#F97316' : '#38BDF8';
        ctx.shadowColor = flameColor;
        ctx.shadowBlur = 18;
        ctx.fillStyle = flameColor;
        ctx.beginPath();
        ctx.moveTo(-16, -5);
        ctx.lineTo(-28 - Math.random() * 10, -3);
        ctx.lineTo(-16, -1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-16, 1);
        ctx.lineTo(-28 - Math.random() * 10, 3);
        ctx.lineTo(-16, 5);
        ctx.fill();
        ctx.restore();
      }

      // Aerodynamic Car Chassis
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-15, -9, 30, 18, 5);
      else ctx.rect(-15, -9, 30, 18);
      ctx.fill();

      // Center Racing Stripe
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-15, -2, 30, 4);

      // Cockpit with Driver Mascot Helmet
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-5, -6, 12, 12, 3);
      else ctx.rect(-5, -6, 12, 12);
      ctx.fill();

      const driverMood = r.turboTimer > 0 ? 'focused' : r.spinoutTimer > 0 ? 'shocked' : 'idle';
      this.drawPlayerMascot(ctx, r.id, 1, 0, 5, driverMood, performance.now() * 0.001);

      // Rear Spoiler Wing with endplates
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-17, -11, 4, 22);
      ctx.fillStyle = p.colorDark;
      ctx.fillRect(-17, -11, 4, 3);
      ctx.fillRect(-17, 8, 4, 3);

      // LED Headlights
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(14, -7, 2, 4);
      ctx.fillRect(14, 3, 2, 4);

      ctx.restore();

      // --- Nitro Charge-Up Battery Gauge over car ---
      ctx.save();
      const gaugeY = r.y - 36;
      const gW = 34;
      const gH = 6;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(r.x - gW / 2, gaugeY, gW, gH, 3);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 3 Segments for Nitro Tiers
      const segW = (gW - 4) / 3;
      // Segment 1 (Mini Nitro)
      if (r.driftCharge >= 0.22) {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(r.x - gW / 2 + 1, gaugeY + 1, segW, gH - 2);
      }
      // Segment 2 (Super Nitro)
      if (r.driftCharge >= 0.65) {
        ctx.fillStyle = '#F97316';
        ctx.fillRect(r.x - gW / 2 + 1 + segW, gaugeY + 1, segW, gH - 2);
      }
      // Segment 3 (Mega Nitro)
      if (r.driftCharge >= 1.15) {
        ctx.fillStyle = '#A855F7';
        ctx.fillRect(r.x - gW / 2 + 1 + segW * 2, gaugeY + 1, segW, gH - 2);
      }
      ctx.restore();

      // Frosted Lap & Position Pill
      ctx.save();
      const lapBadgeY = r.y - 20;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(r.x - 30, lapBadgeY - 8, 60, 16, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 9.5px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lapText = r.finished ? 'FINISHED' : `LAP ${Math.min(r.lap, this.totalLaps)}/${this.totalLaps}`;
      ctx.fillText(lapText, r.x, lapBadgeY);
      ctx.restore();

      // Flashing Wrong-Way Alert
      if (r.isWrongWay && !r.finished) {
        ctx.save();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.roundRect(r.x - 36, r.y + 18, 72, 16, 6);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 8.5px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WRONG WAY ↩️', r.x, r.y + 29.5);
        ctx.restore();
      }
    }

    // 10. Tutorial Banner during first 6 seconds
    if (this.gameTime < 6.0) {
      ctx.save();
      const banW = Math.min(520, width * 0.85);
      const banH = 34;
      const banX = width / 2 - banW / 2;
      const banY = 24;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(banX, banY, banW, banH, 10);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ HOLD BUTTON TO DRIFT & CHARGE NITRO | RELEASE TO UNLEASH NITRO BLAST!', width / 2, banY + 15);
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('🛡️ Track walls & auto-rescue prevent looping | Stay on asphalt for top speed', width / 2, banY + 27);
      ctx.restore();
    }

    // Theme Pill at Bottom-Left (x: 20, y: height - 44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 390, 30, 15);
    else ctx.fillRect(20, height - 44, 390, 30);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = curTheme.centerDash;
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `🏎️ [T] [${this.themeIndex + 1}/3] ${curTheme.name} • ${this.currentTrackName}`,
      34,
      height - 29
    );
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.racers.values()).sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      if (a.lap !== b.lap) return b.lap - a.lap;
      return b.nextWaypointIndex - a.nextWaypointIndex;
    });

    const winnerId = list.length > 0 ? list[0].id : null;
    return {
      winnerId,
      rankings: list.map((r, idx) => ({ playerId: r.id, score: (this.totalLaps - idx) * 3, place: idx + 1 })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} crossed the checkered flag in style!` : 'Race tie!'
    };
  }
}
