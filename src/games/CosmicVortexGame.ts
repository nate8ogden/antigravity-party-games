import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface VortexPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  alive: boolean;
  respawnTimer: number;
  pulseCooldown: number;
  pulseActiveTimer: number;
}

interface AntimatterOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
}

export class CosmicVortexGame extends BaseGame {
  private playersState: Map<PlayerId, VortexPlayer> = new Map();
  private orbs: AntimatterOrb[] = [];
  private vortexAngle: number = 0;
  private vortexPulse: number = 0;
  private nextOrbSpawnTimer: number = 1.5;

  private lastWidth: number = 800;
  private lastHeight: number = 600;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.roundTimer = 45;
    this.isFinished = false;
    this.playersState.clear();
    this.orbs = [];
    this.vortexAngle = 0;
    this.vortexPulse = 0;
    this.nextOrbSpawnTimer = 1.0;

    const cx = width / 2;
    const cy = height / 2;
    const active = this.getActivePlayers();
    const spawnRadius = Math.min(width, height) * 0.38;

    active.forEach((p, idx) => {
      const angle = (idx / active.length) * Math.PI * 2;
      const px = cx + Math.cos(angle) * spawnRadius;
      const py = cy + Math.sin(angle) * spawnRadius;
      // Tangential orbital velocity
      const orbitSpeed = 110;
      const vx = -Math.sin(angle) * orbitSpeed;
      const vy = Math.cos(angle) * orbitSpeed;

      this.playersState.set(p.id, {
        x: px,
        y: py,
        vx,
        vy,
        angle: angle + Math.PI / 2,
        score: 0,
        alive: true,
        respawnTimer: 0,
        pulseCooldown: 0,
        pulseActiveTimer: 0
      });
    });

    // Spawn initial field of 7 cosmic bubbles
    for (let i = 0; i < 7; i++) {
      this.spawnOrb(width, height);
    }

    // Expose debug hook for testing
    (window as any).__COSMIC_VORTEX_DEBUG__ = {
      getOrbs: () => this.orbs.map((o) => ({ x: o.x, y: o.y, vx: o.vx, vy: o.vy, radius: o.radius, hue: o.hue })),
      getOrbCount: () => this.orbs.length,
      getPlayerState: (pid: PlayerId) => {
        const ps = this.playersState.get(pid);
        return ps ? { ...ps } : null;
      },
      setPlayerPos: (pid: PlayerId, x: number, y: number, vx = 0, vy = 0, angle = 0) => {
        const ps = this.playersState.get(pid);
        if (ps) {
          ps.x = x;
          ps.y = y;
          ps.vx = vx;
          ps.vy = vy;
          ps.angle = angle;
        }
      },
      spawnOrb: () => this.spawnOrb(this.lastWidth, this.lastHeight)
    };
  }

  private spawnOrb(width: number, height: number) {
    const cx = width / 2;
    const cy = height / 2;
    const minR = 90;
    const maxR = Math.min(width, height) * 0.40;
    const r = minR + Math.random() * (maxR - minR);
    const angle = Math.random() * Math.PI * 2;
    const speed = 65 + Math.random() * 45;
    const radialDrift = (Math.random() - 0.5) * 20;

    // Iridescent cosmic bubble hues: Cyan (180), Magenta (310), Amber (45), Emerald (140), Purple (270)
    const hues = [180, 310, 45, 140, 270];
    const hue = hues[Math.floor(Math.random() * hues.length)];

    this.orbs.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: -Math.sin(angle) * speed + Math.cos(angle) * radialDrift,
      vy: Math.cos(angle) * speed + Math.sin(angle) * radialDrift,
      radius: 9,
      hue
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.vortexAngle += dt * 1.8;
    this.vortexPulse = Math.sin(this.vortexAngle * 2.5) * 0.5 + 0.5;

    const cx = width / 2;
    const cy = height / 2;
    const eventHorizonR = 48;

    // Continuous bubble spawning (maintain 6 to 9 active bubbles at all times)
    const MAX_ORBS = 9;
    const MIN_ORBS = 6;
    this.nextOrbSpawnTimer -= dt;

    if (this.orbs.length < MIN_ORBS) {
      // Rapid catch-up replenishment if bubbles were collected or consumed
      this.spawnOrb(width, height);
      this.nextOrbSpawnTimer = 0.4;
    } else if (this.nextOrbSpawnTimer <= 0 && this.orbs.length < MAX_ORBS) {
      this.spawnOrb(width, height);
      this.nextOrbSpawnTimer = 1.0 + Math.random() * 0.6;
    }

    // Update bubbles with gravity, containment, and boundary reflections
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      const dx = cx - orb.x;
      const dy = cy - orb.y;
      const dist = Math.hypot(dx, dy);

      // Event horizon consumption with sparkling implosion
      if (dist < eventHorizonR + 5) {
        this.particles.spawnSparks(orb.x, orb.y, orb.hue === 180 ? '#38BDF8' : '#F472B6', 8);
        this.orbs.splice(i, 1);
        continue;
      }

      // Despawn if drifted far outside arena bounds
      if (dist > Math.max(width, height) * 0.68) {
        this.orbs.splice(i, 1);
        continue;
      }

      // Gravitational acceleration (with baseline inward cosmic drift so bubbles don't linger in outer darkness)
      const safeDist = Math.max(1, dist);
      const gravity = 45000 / (safeDist * safeDist + 2000) + 15;
      orb.vx += (dx / safeDist) * gravity * dt;
      orb.vy += (dy / safeDist) * gravity * dt;

      // Subtle drag to stabilize orbital flight
      orb.vx *= Math.pow(0.99, dt * 60);
      orb.vy *= Math.pow(0.99, dt * 60);

      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;

      // Arena boundary bounce for bubbles (keeps bubbles inside play area!)
      const orbMargin = 22;
      if (orb.x < orbMargin) {
        orb.x = orbMargin;
        orb.vx = Math.abs(orb.vx) * 0.85 + 20;
      } else if (orb.x > width - orbMargin) {
        orb.x = width - orbMargin;
        orb.vx = -Math.abs(orb.vx) * 0.85 - 20;
      }
      if (orb.y < orbMargin) {
        orb.y = orbMargin;
        orb.vy = Math.abs(orb.vy) * 0.85 + 20;
      } else if (orb.y > height - orbMargin) {
        orb.y = height - orbMargin;
        orb.vy = -Math.abs(orb.vy) * 0.85 - 20;
      }
    }

    // Process Bot Inputs
    this.updateBots(dt, width, height);

    // Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (!ps.alive) {
        ps.respawnTimer -= dt;
        if (ps.respawnTimer <= 0) {
          ps.alive = true;
          const spawnR = Math.min(width, height) * 0.38;
          const angle = Math.random() * Math.PI * 2;
          ps.x = cx + Math.cos(angle) * spawnR;
          ps.y = cy + Math.sin(angle) * spawnR;
          ps.vx = -Math.sin(angle) * 100;
          ps.vy = Math.cos(angle) * 100;
          ps.angle = angle + Math.PI / 2;
          this.audio.playTap();
        }
        continue;
      }

      if (ps.pulseCooldown > 0) ps.pulseCooldown -= dt;
      if (ps.pulseActiveTimer > 0) ps.pulseActiveTimer -= dt;

      // Handle Inputs
      const steer = this.input.getSteer(p.id);
      const thrust = this.input.isPressed(p.id);

      if (steer !== 0) {
        ps.angle += steer * 4.0 * dt;
      } else {
        // Continuous rotation in single-button mode: holding thrust creates an arc
        // and players NEVER get stuck pointing in one direction!
        const rotSpeed = thrust ? 2.6 : 3.6;
        ps.angle += rotSpeed * dt;
      }

      if (thrust) {
        const thrustPower = 340;
        ps.vx += Math.cos(ps.angle) * thrustPower * dt;
        ps.vy += Math.sin(ps.angle) * thrustPower * dt;

        // Ion thruster trail particles
        if (Math.random() < 0.4) {
          const flameX = ps.x - Math.cos(ps.angle) * 14;
          const flameY = ps.y - Math.sin(ps.angle) * 14;
          this.particles.spawnSparks(flameX, flameY, p.colorLight, 1);
        }
      }

      // Check Pulse Blast Trigger (Triggered when tapping or double-tapping)
      const justTapped = this.input.justPressed(p.id);
      if (justTapped && ps.pulseCooldown <= 0) {
        ps.pulseCooldown = 2.2;
        ps.pulseActiveTimer = 0.25;
        this.audio.playLaser();
        this.particles.shake(0.35);

        // Repulse all opponents within blast range
        const blastRange = 135;
        for (const other of active) {
          if (other.id === p.id) continue;
          const os = this.playersState.get(other.id);
          if (!os || !os.alive) continue;

          const odx = os.x - ps.x;
          const ody = os.y - ps.y;
          const odist = Math.hypot(odx, ody);
          if (odist < blastRange && odist > 0.1) {
            const push = (1 - odist / blastRange) * 420;
            os.vx += (odx / odist) * push;
            os.vy += (ody / odist) * push;
            this.audio.playBounce();
          }
        }
      }

      // Gravitational pull toward event horizon (with baseline cosmic vortex inward current)
      const dx = cx - ps.x;
      const dy = cy - ps.y;
      const dist = Math.hypot(dx, dy);

      const safeDist = Math.max(1, dist);
      const gravity = 62000 / (safeDist * safeDist + 1800) + 25; // Inward drift everywhere in arena!
      ps.vx += (dx / safeDist) * gravity * dt;
      ps.vy += (dy / safeDist) * gravity * dt;

      // Friction / Drag in space
      ps.vx *= Math.pow(0.96, dt * 60);
      ps.vy *= Math.pow(0.96, dt * 60);

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Critical gravity warning zone
      if (dist < 115) {
        this.particles.shake(0.06);
        if (Math.random() < 0.2) {
          this.particles.spawnSparks(ps.x, ps.y, '#EF4444', 1);
        }
      }

      // Event horizon consumption with relativistic spaghettification
      if (dist < eventHorizonR) {
        ps.alive = false;
        ps.respawnTimer = 2.0;
        ps.score = Math.max(0, ps.score - 1);
        this.audio.playExplosion();
        this.particles.shake(0.55);

        // Implosion ring particles
        this.particles.spawnExplosion(cx, cy, p.color, 28);
        continue;
      }

      // Arena boundary collision with firm inward deflection (prevents sticking against walls)
      const margin = 32;
      let hitWall = false;
      if (ps.x < margin) {
        ps.x = margin;
        ps.vx = Math.max(Math.abs(ps.vx) * 0.75, 120);
        hitWall = true;
      } else if (ps.x > width - margin) {
        ps.x = width - margin;
        ps.vx = -Math.max(Math.abs(ps.vx) * 0.75, 120);
        hitWall = true;
      }
      if (ps.y < margin) {
        ps.y = margin;
        ps.vy = Math.max(Math.abs(ps.vy) * 0.75, 120);
        hitWall = true;
      } else if (ps.y > height - margin) {
        ps.y = height - margin;
        ps.vy = -Math.max(Math.abs(ps.vy) * 0.75, 120);
        hitWall = true;
      }

      if (hitWall) {
        this.particles.spawnSparks(ps.x, ps.y, p.colorLight, 2);
      }

      // Corner Anti-Trap Cushion: If in any corner pocket, apply diagonal push and steer toward center
      const cornerPocket = 85;
      const inCornerX = ps.x < cornerPocket || ps.x > width - cornerPocket;
      const inCornerY = ps.y < cornerPocket || ps.y > height - cornerPocket;
      if (inCornerX && inCornerY) {
        const toCenterX = (cx - ps.x) / dist;
        const toCenterY = (cy - ps.y) / dist;
        const cornerPush = 280; // Strong spring force pushing out of corner
        ps.vx += toCenterX * cornerPush * dt;
        ps.vy += toCenterY * cornerPush * dt;

        // Smoothly steer ship angle toward center if facing into corner
        const centerAngle = Math.atan2(cy - ps.y, cx - ps.x);
        let angleDiff = centerAngle - ps.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        ps.angle += angleDiff * Math.min(1.0, 5.0 * dt);
      }

      // Orb Collection
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const orb = this.orbs[i];
        if (Math.hypot(ps.x - orb.x, ps.y - orb.y) < 22) {
          this.orbs.splice(i, 1);
          ps.score += 1;
          this.audio.playTone(740, 0.08, 'sine');
          setTimeout(() => this.audio.playTone(1100, 0.12, 'triangle'), 60);

          // Sparkle burst
          this.particles.spawnSparks(orb.x, orb.y, '#38BDF8', 14);

          if (ps.score >= 5) {
            this.isFinished = true;
          }
        }
      }
    }

    // Player-to-Player Elastic Collision (prevents pinning/wedging each other in corners)
    const activeList = active
      .map((p) => ({ cfg: p, state: this.playersState.get(p.id)! }))
      .filter((item) => item.state && item.state.alive);

    for (let i = 0; i < activeList.length; i++) {
      for (let j = i + 1; j < activeList.length; j++) {
        const p1 = activeList[i].state;
        const p2 = activeList[j].state;
        const pdx = p2.x - p1.x;
        const pdy = p2.y - p1.y;
        const pdist = Math.hypot(pdx, pdy);
        const minDist = 30; // Ship collision diameter

        if (pdist < minDist && pdist > 0.01) {
          const overlap = minDist - pdist;
          const nx = pdx / pdist;
          const ny = pdy / pdist;

          // Push positions apart
          p1.x -= nx * (overlap * 0.5);
          p1.y -= ny * (overlap * 0.5);
          p2.x += nx * (overlap * 0.5);
          p2.y += ny * (overlap * 0.5);

          // Relative velocity bounce
          const rvx = p2.vx - p1.vx;
          const rvy = p2.vy - p1.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          if (velAlongNormal < 0) {
            const impulse = -(1 + 0.9) * velAlongNormal;
            p1.vx -= nx * (impulse * 0.5);
            p1.vy -= ny * (impulse * 0.5);
            p2.vx += nx * (impulse * 0.5);
            p2.vy += ny * (impulse * 0.5);

            this.audio.playBounce();
            this.particles.spawnSparks((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#FFFFFF', 4);
          }
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || !ps.alive) return;

    const cx = width / 2;
    const cy = height / 2;
    const dx = cx - ps.x;
    const dy = cy - ps.y;
    const dist = Math.hypot(dx, dy);

    // Corner & Wall Avoidance: if near boundary or corner, prioritize escaping to center
    const wallMargin = 80;
    const cornerMargin = 110;
    const nearLeft = ps.x < wallMargin;
    const nearRight = ps.x > width - wallMargin;
    const nearTop = ps.y < wallMargin;
    const nearBottom = ps.y > height - wallMargin;
    const inCorner = (nearLeft || nearRight) && (nearTop || nearBottom) || (ps.x < cornerMargin && ps.y < cornerMargin);

    if (inCorner || nearLeft || nearRight || nearTop || nearBottom) {
      // Steer firmly towards the central playfield and thrust out
      ps.angle = Math.atan2(cy - ps.y, cx - ps.x);
      this.input.setBotPressed(botId, true);
      return;
    }

    // Find nearest safe orb
    let bestOrb: AntimatterOrb | null = null;
    let bestDist = Infinity;
    for (const orb of this.orbs) {
      const d = Math.hypot(orb.x - ps.x, orb.y - ps.y);
      const orbDistFromCenter = Math.hypot(cx - orb.x, cy - orb.y);
      // Skip orbs that are dangerously close to the black hole event horizon
      if (orbDistFromCenter < 68) continue;
      if (d < bestDist) {
        bestDist = d;
        bestOrb = orb;
      }
    }

    if (difficulty === 'bot_easy') {
      // Wanders, avoids singularity, and occasionally chases orbs
      if (dist < 130) {
        // Thrust outwards away from center
        ps.angle = Math.atan2(-dy, -dx);
        this.input.setBotPressed(botId, true);
      } else if (bestOrb && bestDist < 180 && Math.random() < 0.6) {
        ps.angle = Math.atan2(bestOrb.y - ps.y, bestOrb.x - ps.x);
        this.input.setBotPressed(botId, true);
      } else if (Math.random() < 0.05 && ps.pulseCooldown <= 0) {
        this.input.setBotPressed(botId, true);
      } else {
        this.input.setBotPressed(botId, Math.random() < 0.4);
      }
    } else if (difficulty === 'bot_normal') {
      if (dist < 150) {
        // Strongly counter gravity outward
        ps.angle = Math.atan2(-dy, -dx);
        this.input.setBotPressed(botId, true);
      } else if (bestOrb) {
        ps.angle = Math.atan2(bestOrb.y - ps.y, bestOrb.x - ps.x);
        this.input.setBotPressed(botId, true);
      } else {
        // Orbit tangentially
        ps.angle = Math.atan2(dy, dx) + Math.PI / 2;
        this.input.setBotPressed(botId, true);
      }

      // Pulse if any rival is nearby
      if (ps.pulseCooldown <= 0) {
        for (const [id, opp] of this.playersState.entries()) {
          if (id === botId || !opp.alive) continue;
          if (Math.hypot(opp.x - ps.x, opp.y - ps.y) < 100) {
            this.input.setBotPressed(botId, true);
            break;
          }
        }
      }
    } else {
      // Hard: Intelligent gravity-assist vectoring & offensive pulse
      if (dist < 165) {
        // Emergency radial escape
        ps.angle = Math.atan2(-dy, -dx) + 0.2;
        this.input.setBotPressed(botId, true);
      } else if (bestOrb && bestDist < 250) {
        // Intercept orb
        ps.angle = Math.atan2(bestOrb.y - ps.y, bestOrb.x - ps.x);
        this.input.setBotPressed(botId, true);
      } else {
        // Position strategically between rival and event horizon
        let targetOpp: VortexPlayer | null = null;
        let oppDist = Infinity;
        for (const [id, opp] of this.playersState.entries()) {
          if (id === botId || !opp.alive) continue;
          const d = Math.hypot(opp.x - ps.x, opp.y - ps.y);
          if (d < oppDist) {
            oppDist = d;
            targetOpp = opp;
          }
        }

        if (targetOpp && oppDist < 125 && ps.pulseCooldown <= 0) {
          // Fire pulse to blast rival toward the black hole
          this.input.setBotPressed(botId, true);
        } else {
          // Maintain high-speed orbital flight
          ps.angle = Math.atan2(dy, dx) + Math.PI / 2;
          this.input.setBotPressed(botId, true);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;

    // Deep space gradient backdrop
    const bgGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.7);
    bgGrad.addColorStop(0, '#020617');
    bgGrad.addColorStop(0.5, '#0B0F19');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant star grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 73) % width);
      const sy = ((i * 97) % height);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Accretion Disk Swirling Rays (Relativistic Multilayer Vortex)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.vortexAngle);

    for (let i = 0; i < 12; i++) {
      const armAngle = (i / 12) * Math.PI * 2;
      const diskGrad = ctx.createLinearGradient(0, 0, Math.cos(armAngle) * 240, Math.sin(armAngle) * 240);
      diskGrad.addColorStop(0, 'rgba(168, 85, 247, 0.55)');
      diskGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.35)');
      diskGrad.addColorStop(0.8, 'rgba(236, 72, 153, 0.15)');
      diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = diskGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 240, armAngle, armAngle + 0.32);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Central Event Horizon Black Hole
    const eventR = 46 + this.vortexPulse * 4;
    ctx.save();
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, eventR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#818CF8';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Singularity Photon Ring
    ctx.save();
    ctx.strokeStyle = '#F472B6';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#F472B6';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(cx, cy, eventR - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Center singularity warning core
    ctx.fillStyle = '#C084FC';
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    // Gravitational Tether Lines for ships in danger
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.alive) continue;
      const d = Math.hypot(cx - ps.x, cy - ps.y);
      if (d < 125) {
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + (1 - d / 125) * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ps.x, ps.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Render Antimatter Orbs
    for (const orb of this.orbs) {
      ctx.save();
      ctx.shadowColor = orb.hue === 180 ? '#38BDF8' : '#F472B6';
      ctx.shadowBlur = 14;
      ctx.fillStyle = orb.hue === 180 ? '#38BDF8' : '#F472B6';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();

      // Specular shine
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(orb.x - 2.5, orb.y - 2.5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (!ps.alive) {
        // Respawning Ghost Marker
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(width, height) * 0.40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.angle);

      // Pulse Blast Shockwave Ring
      if (ps.pulseActiveTimer > 0) {
        ctx.save();
        ctx.strokeStyle = p.colorLight;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, (1 - ps.pulseActiveTimer / 0.25) * 130, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Repulsor Cooldown Ring around Ship
      ctx.save();
      if (ps.pulseCooldown > 0) {
        const readyRatio = 1 - ps.pulseCooldown / 2.2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = p.colorLight;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + readyRatio * Math.PI * 2);
        ctx.stroke();
      } else {
        // Ready Glow Ring
        ctx.strokeStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Ship 2.5D Hull
      ctx.shadowColor = p.colorDark;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cockpit Dome
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Player Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, ps.x, ps.y - 22);
    }

    // Top Center Antimatter HUD
    const hudW = 280;
    const hudH = 26;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hudX, hudY, hudW, hudH, 13);
    else ctx.rect(hudX, hudY, hudW, hudH);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    let summary = active.map((p) => {
      const ps = this.playersState.get(p.id);
      return `${p.name}: 🌌 ${ps?.score || 0}/5`;
    }).join('   •   ');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(summary, width / 2, hudY + 17);
  }

  public isRoundOver(): boolean {
    if (this.isFinished) return true;
    for (const ps of this.playersState.values()) {
      if (ps.score >= 5) return true;
    }
    return false;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    let winnerId: PlayerId | null = null;
    let highestScore = -1;

    active.forEach((p) => {
      const ps = this.playersState.get(p.id);
      const sc = ps?.score || 0;
      if (sc > highestScore) {
        highestScore = sc;
        winnerId = p.id;
      }
    });

    const sorted = [...active].sort((a, b) => {
      const scA = this.playersState.get(a.id)?.score || 0;
      const scB = this.playersState.get(b.id)?.score || 0;
      return scB - scA;
    });

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.playersState.get(p.id)?.score || 0
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} harnessed the Cosmic Vortex!` : 'The Singularity consumed all pilots in a draw!'
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
