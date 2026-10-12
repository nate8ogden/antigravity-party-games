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

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.playersState.clear();
    this.orbs = [];
    this.vortexAngle = 0;
    this.vortexPulse = 0;

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

    for (let i = 0; i < 5; i++) {
      this.spawnOrb(width, height);
    }
  }

  private spawnOrb(width: number, height: number) {
    const cx = width / 2;
    const cy = height / 2;
    const minR = 85;
    const maxR = Math.min(width, height) * 0.42;
    const r = minR + Math.random() * (maxR - minR);
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 40;

    this.orbs.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: -Math.sin(angle) * speed,
      vy: Math.cos(angle) * speed,
      radius: 9,
      hue: Math.random() > 0.5 ? 180 : 310
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

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

    // Spawn orbs
    this.nextOrbSpawnTimer -= dt;
    if (this.nextOrbSpawnTimer <= 0 && this.orbs.length < 8) {
      this.spawnOrb(width, height);
      this.nextOrbSpawnTimer = 3.0;
    }

    // Update orbs with gravity
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      const dx = cx - orb.x;
      const dy = cy - orb.y;
      const dist = Math.hypot(dx, dy);

      if (dist < eventHorizonR + 5) {
        this.orbs.splice(i, 1);
        continue;
      }

      // Gravitational acceleration
      const safeDist = Math.max(1, dist);
      const gravity = 45000 / (safeDist * safeDist + 2000);
      orb.vx += (dx / safeDist) * gravity * dt;
      orb.vy += (dy / safeDist) * gravity * dt;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
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
          const spawnR = Math.min(width, height) * 0.40;
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
      } else if (!thrust) {
        // Single-button mobile fallback: gentle rotational scan when idle
        ps.angle += 2.2 * dt;
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

      // Gravitational pull toward event horizon
      const dx = cx - ps.x;
      const dy = cy - ps.y;
      const dist = Math.hypot(dx, dy);

      const safeDist = Math.max(1, dist);
      const gravity = 62000 / (safeDist * safeDist + 1800);
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

      // World boundary bounce
      const margin = 20;
      if (ps.x < margin) { ps.x = margin; ps.vx *= -0.7; }
      if (ps.x > width - margin) { ps.x = width - margin; ps.vx *= -0.7; }
      if (ps.y < margin) { ps.y = margin; ps.vy *= -0.7; }
      if (ps.y > height - margin) { ps.y = height - margin; ps.vy *= -0.7; }

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

    // Find nearest orb
    let bestOrb: AntimatterOrb | null = null;
    let bestDist = Infinity;
    for (const orb of this.orbs) {
      const d = Math.hypot(orb.x - ps.x, orb.y - ps.y);
      if (d < bestDist) {
        bestDist = d;
        bestOrb = orb;
      }
    }

    if (difficulty === 'bot_easy') {
      // Wanders and occasionally counters gravity
      if (dist < 130) {
        // Thrust outwards away from center
        ps.angle = Math.atan2(-dy, -dx);
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
