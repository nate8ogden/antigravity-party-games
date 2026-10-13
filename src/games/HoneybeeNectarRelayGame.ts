import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MeadowFlower {
  x: number;
  y: number;
  color: string;
  name: string;
  petalCount: number;
  nectar: number; // 0 to 100
  maxNectar: number;
  stemAngle: number;
  bloomScale: number;
  glowAnim: number;
}

interface WaspThreat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  wingTimer: number;
}

interface DandelionMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

interface BeePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hiveX: number;
  hiveY: number;
  carriedNectar: number; // 0 to 100
  stunTimer: number;
  wingAngle: number;
  score: number;
  isSipping: boolean;
  sipTargetX: number;
  sipTargetY: number;
  fullChimePlayed: boolean;
  steerAngle: number;
}

export class HoneybeeNectarRelayGame extends BaseGame {
  private flowers: MeadowFlower[] = [];
  private wasps: WaspThreat[] = [];
  private playersState: Map<PlayerId, BeePlayer> = new Map();
  private dandelionMotes: DandelionMote[] = [];
  private wingTimer: number = 0;
  private animTimer: number = 0;
  private meadowThemeIndex: number = 0;
  public currentMapName: string = 'Sunny Spring Blossom';

  private themes = [
    {
      name: 'Sunny Spring Blossom',
      skyTop: '#6EE7B7',
      skyBot: '#10B981',
      grassTint: 'rgba(34, 197, 94, 0.15)',
      pollenColor: '#FEF08A'
    },
    {
      name: 'Twilight Lavender Grove',
      skyTop: '#C084FC',
      skyBot: '#7E22CE',
      grassTint: 'rgba(168, 85, 247, 0.15)',
      pollenColor: '#F0ABFC'
    },
    {
      name: 'Golden Autumn Meadow',
      skyTop: '#FDE047',
      skyBot: '#D97706',
      grassTint: 'rgba(245, 158, 11, 0.15)',
      pollenColor: '#FEF08A'
    }
  ];

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.wingTimer = 0;
    this.animTimer = 0;
    this.flowers = [];
    this.wasps = [];
    this.dandelionMotes = [];
    this.playersState.clear();

    this.meadowThemeIndex = Math.floor(Math.random() * this.themes.length);
    this.currentMapName = this.themes[this.meadowThemeIndex].name;

    // 9 Wildflowers across meadow
    const flowerTypes = [
      { color: '#F43F5E', name: 'Ruby Rose' },
      { color: '#A855F7', name: 'Royal Lavender' },
      { color: '#F59E0B', name: 'Golden Sunflower' },
      { color: '#06B6D4', name: 'Azure Bluebell' },
      { color: '#EC4899', name: 'Cherry Blossom' },
      { color: '#10B981', name: 'Emerald Lotus' },
      { color: '#F97316', name: 'Tiger Lily' },
      { color: '#8B5CF6', name: 'Wild Violet' },
      { color: '#3B82F6', name: 'Mountain Aster' }
    ];

    const paddingX = 90;
    const paddingY = 85;
    for (let i = 0; i < 9; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cellW = (width - paddingX * 2) / 3;
      const cellH = (height - paddingY - 140) / 3;
      const fType = flowerTypes[i % flowerTypes.length];

      this.flowers.push({
        x: paddingX + (col + 0.5) * cellW + (Math.random() - 0.5) * (cellW * 0.4),
        y: paddingY + (row + 0.5) * cellH + (Math.random() - 0.5) * (cellH * 0.4),
        color: fType.color,
        name: fType.name,
        petalCount: 6,
        nectar: 100,
        maxNectar: 100,
        stemAngle: (Math.random() - 0.5) * 0.4,
        bloomScale: 1.0 + Math.random() * 0.15,
        glowAnim: Math.random() * Math.PI * 2
      });
    }

    // Wasps patrolling meadow airspace
    this.wasps.push({
      x: width * 0.28,
      y: height * 0.38,
      vx: 110,
      vy: 60,
      angle: 0,
      wingTimer: 0
    });
    this.wasps.push({
      x: width * 0.72,
      y: height * 0.52,
      vx: -100,
      vy: 90,
      angle: Math.PI,
      wingTimer: 0.5
    });

    // Dandelion breeze motes
    for (let i = 0; i < 18; i++) {
      this.dandelionMotes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 14 + Math.random() * 22,
        vy: -5 + Math.random() * 10,
        size: 1.5 + Math.random() * 2.2,
        alpha: 0.25 + Math.random() * 0.45
      });
    }

    // Spawn Player Bees at their Apiary Hives along bottom edge
    const active = this.getActivePlayers();
    const count = active.length;
    const hiveSpacing = width / (count + 1);

    active.forEach((p, idx) => {
      const hiveX = hiveSpacing * (idx + 1);
      const hiveY = height - 60;

      this.playersState.set(p.id, {
        id: p.id,
        x: hiveX,
        y: hiveY - 45,
        vx: 0,
        vy: -40,
        angle: -Math.PI / 2,
        steerAngle: -Math.PI / 2,
        hiveX,
        hiveY,
        carriedNectar: 0,
        stunTimer: 0,
        wingAngle: 0,
        score: 0,
        isSipping: false,
        sipTargetX: 0,
        sipTargetY: 0,
        fullChimePlayed: false
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;
    this.wingTimer += dt * 32;

    this.updateBots(dt, width, height);

    // Update Dandelion drift
    for (const m of this.dandelionMotes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x > width + 20) m.x = -20;
      if (m.y < 30) m.y = height - 40;
      if (m.y > height - 40) m.y = 40;
    }

    // Update Wasps
    for (const w of this.wasps) {
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.wingTimer += dt * 45;
      w.angle = Math.atan2(w.vy, w.vx);

      if (w.x < 50) { w.x = 50; w.vx = Math.abs(w.vx); }
      else if (w.x > width - 50) { w.x = width - 50; w.vx = -Math.abs(w.vx); }
      if (w.y < 70) { w.y = 70; w.vy = Math.abs(w.vy); }
      else if (w.y > height - 120) { w.y = height - 120; w.vy = -Math.abs(w.vy); }
    }

    // Flowers naturally recharge nectar
    for (const fl of this.flowers) {
      fl.glowAnim += dt * 3;
      if (fl.nectar < fl.maxNectar) {
        fl.nectar = Math.min(fl.maxNectar, fl.nectar + dt * 15);
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        ps.isSipping = false;
        ps.angle += dt * 12; // Dazed spinning
        continue;
      }

      ps.wingAngle = Math.sin(this.wingTimer + p.id * 1.5) * 0.7;

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const isPressed = this.input.isPressed(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.justAction(p.id);
      const inputMag = Math.hypot(steerX, steerY);
      const maxSpeed = 230;

      // Single-button navigation assistance
      if (inputMag > 0.15) {
        // Multi-directional WASD / Joystick
        const targetAngle = Math.atan2(steerY, steerX);
        let diff = targetAngle - ps.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ps.angle += diff * Math.min(1.0, dt * 14);

        ps.vx = (steerX / inputMag) * maxSpeed;
        ps.vy = (steerY / inputMag) * maxSpeed;
      } else if (isPressed) {
        // Single Button Arcade: HOLD propels forward in current heading!
        ps.vx += (Math.cos(ps.angle) * maxSpeed - ps.vx) * Math.min(1.0, dt * 12);
        ps.vy += (Math.sin(ps.angle) * maxSpeed - ps.vy) * Math.min(1.0, dt * 12);
      } else {
        // Released button: smooth friction and auto-orient towards target
        ps.vx *= Math.pow(0.85, dt * 60);
        ps.vy *= Math.pow(0.85, dt * 60);

        // When button released in 1-button mode, gently orient towards best flower (or hive if full)
        if (ps.carriedNectar >= 100) {
          const toHiveAngle = Math.atan2(ps.hiveY - ps.y, ps.hiveX - ps.x);
          let diff = toHiveAngle - ps.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ps.angle += diff * Math.min(1.0, dt * 4.0);
        } else {
          // Find nearest flower with nectar
          let nearestFlower: MeadowFlower | null = null;
          let nearestDist = Infinity;
          for (const fl of this.flowers) {
            if (fl.nectar > 15) {
              const d = Math.hypot(fl.x - ps.x, fl.y - ps.y);
              if (d < nearestDist) {
                nearestDist = d;
                nearestFlower = fl;
              }
            }
          }
          if (nearestFlower) {
            const toFlAngle = Math.atan2(nearestFlower.y - ps.y, nearestFlower.x - ps.x);
            let diff = toFlAngle - ps.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            ps.angle += diff * Math.min(1.0, dt * 4.0);
          }
        }
      }

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Arena boundary bounds
      ps.x = Math.max(35, Math.min(width - 35, ps.x));
      ps.y = Math.max(55, Math.min(height - 40, ps.y));

      // Golden pollen particles when flying
      if (Math.hypot(ps.vx, ps.vy) > 40 && Math.random() < 0.22) {
        this.particles.spawnSparks(
          ps.x - Math.cos(ps.angle) * 14,
          ps.y - Math.sin(ps.angle) * 14,
          '#FDE047',
          2
        );
      }

      // SUCKING NECTAR MECHANIC (REVISED & ULTRA-RESPONSIVE):
      // Generous suction radius: 75px!
      // Sucks automatically when near flower; holding Action or Space accelerates into Super-Vacuum!
      ps.isSipping = false;
      const isSuperVacuum = isAction || (isPressed && inputMag > 0.15);
      const sipRate = isSuperVacuum ? 180 : 85; // Fast and satisfying!
      const sipRadius = 75;

      if (ps.carriedNectar < 100) {
        for (const fl of this.flowers) {
          if (fl.nectar > 2) {
            const dist = Math.hypot(ps.x - fl.x, ps.y - fl.y);
            if (dist < sipRadius) {
              ps.isSipping = true;
              ps.sipTargetX = fl.x;
              ps.sipTargetY = fl.y;

              const sipAmount = Math.min(fl.nectar, sipRate * dt);
              fl.nectar -= sipAmount;
              ps.carriedNectar = Math.min(100, ps.carriedNectar + sipAmount);

              // Liquid honey droplets traveling into proboscis
              if (Math.random() < 0.55) {
                this.particles.spawnSparks(fl.x, fl.y, '#FBBF24', 3);
              }
              if (Math.random() < 0.15) {
                this.audio.playTap();
              }
              break;
            }
          }
        }
      }

      // Check Full Capacity Notification
      if (ps.carriedNectar >= 100) {
        if (!ps.fullChimePlayed) {
          ps.fullChimePlayed = true;
          this.audio.playCoin();
          this.particles.shake(3);
          this.particles.showFloatingText('🍯 HONEY POUCH FULL! FLY TO HIVE ⬇️', ps.x, ps.y - 36, '#F59E0B', 22);
        }
      } else {
        ps.fullChimePlayed = false;
      }

      // Depositing Nectar into Honeycomb Apiary Hive
      const hiveDist = Math.hypot(ps.x - ps.hiveX, ps.y - ps.hiveY);
      if (ps.carriedNectar > 5 && hiveDist < 55) {
        const deposit = Math.floor(ps.carriedNectar);
        ps.carriedNectar = 0;
        ps.score += deposit;

        this.audio.playScore();
        this.particles.shake(4);
        this.particles.spawnSparks(ps.hiveX, ps.hiveY - 15, '#F59E0B', 18);
        this.particles.showFloatingText(`+${deposit} HONEY! 🍯`, ps.hiveX, ps.hiveY - 45, '#F59E0B', 24);
      }

      // Wasp Collision Check
      for (const w of this.wasps) {
        const waspDist = Math.hypot(ps.x - w.x, ps.y - w.y);
        if (waspDist < 26) {
          ps.stunTimer = 1.6;
          // Drop half carried nectar
          const dropped = Math.floor(ps.carriedNectar * 0.5);
          ps.carriedNectar -= dropped;
          ps.score = Math.max(0, ps.score - 15);

          // Push away
          ps.vx = Math.cos(w.angle) * 260;
          ps.vy = Math.sin(w.angle) * 260;

          this.audio.playExplosion();
          this.particles.shake(6);
          this.particles.spawnExplosion(ps.x, ps.y, '#EF4444', 25);
          this.particles.showFloatingText('STUNG BY WASP! 🐝💥', ps.x, ps.y - 32, '#EF4444', 22);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
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
    if (!ps || ps.stunTimer > 0) return;

    let targetX = ps.hiveX;
    let targetY = ps.hiveY;

    if (ps.carriedNectar >= 90) {
      // Return to hive to deposit
      targetX = ps.hiveX;
      targetY = ps.hiveY - 10;
    } else {
      // Find flower with highest nectar
      let bestFlower: MeadowFlower | null = null;
      let bestScore = -Infinity;

      for (const fl of this.flowers) {
        if (fl.nectar < 10) continue;
        const dist = Math.hypot(fl.x - ps.x, fl.y - ps.y);
        const score = fl.nectar - dist * 0.35;
        if (score > bestScore) {
          bestScore = score;
          bestFlower = fl;
        }
      }

      if (bestFlower) {
        targetX = bestFlower.x;
        targetY = bestFlower.y;
      }
    }

    // Wasp avoidance
    for (const w of this.wasps) {
      const d = Math.hypot(w.x - ps.x, w.y - ps.y);
      if (d < 110) {
        const awayAngle = Math.atan2(ps.y - w.y, ps.x - w.x);
        targetX += Math.cos(awayAngle) * 140;
        targetY += Math.sin(awayAngle) * 140;
      }
    }

    let dx = targetX - ps.x;
    let dy = targetY - ps.y;

    // Add humanized error based on difficulty
    if (difficulty === 'bot_easy') {
      dx += (Math.random() - 0.5) * 80;
      dy += (Math.random() - 0.5) * 80;
    } else if (difficulty === 'bot_normal') {
      dx += (Math.random() - 0.5) * 35;
      dy += (Math.random() - 0.5) * 35;
    }

    const mag = Math.hypot(dx, dy) || 1;
    const steer = dx / mag;
    const throttle = -dy / mag;
    this.input.setBotInput(botId, true, steer, throttle, false);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const curTheme = this.themes[this.meadowThemeIndex];

    // Sky & Grass Meadow Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, curTheme.skyTop);
    bgGrad.addColorStop(0.45, '#16A34A');
    bgGrad.addColorStop(1, '#14532D');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Soft Meadow Clover Patches
    ctx.fillStyle = curTheme.grassTint;
    for (let i = 0; i < 20; i++) {
      const cx = (i * 83 + 50) % (width - 60);
      const cy = (i * 61 + 80) % (height - 140);
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.arc(cx + 9, cy - 5, 12, 0, Math.PI * 2);
      ctx.arc(cx - 9, cy - 5, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Drifting Dandelion Motes
    for (const m of this.dandelionMotes) {
      ctx.fillStyle = `rgba(255, 255, 255, ${m.alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2.5D Bloomed Wildflowers with Golden Nectar Reservoirs
    for (const fl of this.flowers) {
      ctx.save();

      // Stem
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fl.x, fl.y + 10);
      ctx.quadraticCurveTo(fl.x + Math.sin(fl.stemAngle) * 16, fl.y + 28, fl.x, fl.y + 46);
      ctx.stroke();

      // Green Leaf
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.ellipse(fl.x + 12, fl.y + 26, 12, 6, 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(fl.x, fl.y);
      ctx.scale(fl.bloomScale, fl.bloomScale);

      // Suction Ring Range Guide: Glows when ripe with nectar
      if (fl.nectar > 10) {
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, 48 + Math.sin(fl.glowAnim) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Flower Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Velvet Petals
      const petalDist = 16;
      for (let i = 0; i < fl.petalCount; i++) {
        const a = (i / fl.petalCount) * Math.PI * 2 + Math.sin(this.animTimer * 1.5) * 0.05;
        const px = Math.cos(a) * petalDist;
        const py = Math.sin(a) * petalDist;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a);

        ctx.fillStyle = fl.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      // Nectar Reservoir Pool
      const nectarPct = fl.nectar / fl.maxNectar;
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();

      if (nectarPct > 0.05) {
        // Glowing Honey
        const honeyGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 10);
        honeyGrad.addColorStop(0, '#FEF08A');
        honeyGrad.addColorStop(0.5, '#FBBF24');
        honeyGrad.addColorStop(1, '#D97706');
        ctx.fillStyle = honeyGrad;
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 12 * nectarPct;
        ctx.beginPath();
        ctx.arc(0, 0, 10 * (0.3 + 0.7 * nectarPct), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Flower Nectar Gauge Text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(fl.nectar)}%`, 0, 26);

      ctx.restore();
    }

    // Wasps
    for (const w of this.wasps) {
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.angle);

      // Hazard aura
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();

      // Wasp Wings
      const wWing = Math.sin(w.wingTimer) * 0.8;
      ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
      ctx.beginPath();
      ctx.ellipse(-2, -12 + wWing * 5, 12, 5, -0.3, 0, Math.PI * 2);
      ctx.ellipse(-2, 12 - wWing * 5, 12, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Wasp Body
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(-6, 0, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Black hazard stripes
      ctx.fillStyle = '#18181B';
      ctx.fillRect(-10, -6, 3, 12);
      ctx.fillRect(-5, -7, 3, 14);
      ctx.fillRect(0, -6, 2.5, 12);

      // Stinger
      ctx.beginPath();
      ctx.moveTo(-18, -2);
      ctx.lineTo(-24, 0);
      ctx.lineTo(-18, 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Apiary Hives & Honeybees
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Apiary Wooden Box
      ctx.save();
      ctx.translate(ps.hiveX, ps.hiveY);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 32, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cedar wood hive
      ctx.fillStyle = '#78350F';
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-26, -22, 52, 38, 7);
      else ctx.fillRect(-26, -22, 52, 38);
      ctx.fill();
      ctx.stroke();

      // Player Color Trim
      ctx.fillStyle = p.color;
      ctx.fillRect(-24, -20, 48, 6);

      // Honey Score
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🍯 ${ps.score}`, 0, 2);
      ctx.restore();

      // Suction Tractor Beam
      if (ps.isSipping && ps.carriedNectar < 100) {
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 12;
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -this.animTimer * 28;

        ctx.beginPath();
        ctx.moveTo(ps.x, ps.y);
        ctx.lineTo(ps.sipTargetX, ps.sipTargetY);
        ctx.stroke();

        // Traveling Golden Droplet
        const flowT = (this.animTimer * 5) % 1;
        const flowX = ps.sipTargetX + (ps.x - ps.sipTargetX) * flowT;
        const flowY = ps.sipTargetY + (ps.y - ps.sipTargetY) * flowT;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(flowX, flowY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Adorable 2.5D Honeybee
      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Bee Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(ps.angle);

      // Translucent Wings with motion blur
      const wAngle = ps.wingAngle;
      ctx.fillStyle = 'rgba(224, 242, 254, 0.8)';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(-2, -14 + wAngle * 6, 13, 6, -0.3, 0, Math.PI * 2);
      ctx.ellipse(-2, 14 - wAngle * 6, 13, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bumblebee Fuzzy Body
      const beeGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, 15);
      beeGrad.addColorStop(0, '#FEF08A');
      beeGrad.addColorStop(0.4, '#FBBF24');
      beeGrad.addColorStop(1, '#D97706');
      ctx.fillStyle = beeGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dark Velvet Stripes
      ctx.fillStyle = '#18181B';
      ctx.fillRect(-6, -10, 4, 20);
      ctx.fillRect(1, -10, 4, 20);

      // Player Forehead Visor Band
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(7, 0, 6, -Math.PI / 2, Math.PI / 2);
      ctx.fill();

      // Shiny Eyes
      ctx.fillStyle = '#09090B';
      ctx.beginPath();
      ctx.arc(10, -4, 2.5, 0, Math.PI * 2);
      ctx.arc(10, 4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Antennae
      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(10, -4);
      ctx.lineTo(16, -9);
      ctx.moveTo(10, 4);
      ctx.lineTo(16, 9);
      ctx.stroke();

      ctx.restore();

      // Honey Capacity Gauge above Bee
      const honeyPct = ps.carriedNectar / 100;
      ctx.save();
      ctx.translate(ps.x, ps.y - 24);

      // Gauge background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-20, -5, 40, 10, 5);
      else ctx.fillRect(-20, -5, 40, 10);
      ctx.fill();

      // Liquid Honey fill
      ctx.fillStyle = honeyPct >= 1.0 ? '#F59E0B' : '#FBBF24';
      if (honeyPct > 0) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-18, -4, 36 * honeyPct, 8, 4);
        else ctx.fillRect(-18, -4, 36 * honeyPct, 8);
        ctx.fill();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 8px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(ps.carriedNectar)}%`, 0, 3);
      ctx.restore();
    }

    // Top Instruction Banner
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(width * 0.5 - 210, 50, 420, 26, 13);
    else ctx.fillRect(width * 0.5 - 210, 50, 420, 26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FEF08A';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌺 HOVER NEAR FLOWERS TO SUCK NECTAR ➡️ CARRY TO HIVE 🍯', width * 0.5, 63);
    ctx.restore();

    // Theme Pill at Bottom-Left (Rule compliant: x: 20, y: height - 44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 360, 32, 16);
    else ctx.fillRect(20, height - 44, 360, 32);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = curTheme.pollenColor;
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `🐝 [${this.meadowThemeIndex + 1}/3] ${curTheme.name} | Auto-Siphon < 75px`,
      34,
      height - 24
    );
    ctx.restore();
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    for (const p of this.playersState.values()) {
      scores.set(p.id, p.score);
    }
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.values())
      .map((ps) => ({ playerId: ps.id, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} harvested the most sweet golden honey!` : 'Wasps ruled the meadow!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
