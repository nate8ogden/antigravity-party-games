import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MeadowFlower {
  x: number;
  y: number;
  color: string;
  petalCount: number;
  nectar: number; // 0 to 100
  maxNectar: number;
  stemAngle: number;
  bloomScale: number;
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
}

export class HoneybeeNectarRelayGame extends BaseGame {
  private flowers: MeadowFlower[] = [];
  private wasps: WaspThreat[] = [];
  private playersState: Map<PlayerId, BeePlayer> = new Map();
  private dandelionMotes: DandelionMote[] = [];
  private wingTimer: number = 0;
  private animTimer: number = 0;

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
    this.roundTimer = 35;
    this.wingTimer = 0;
    this.animTimer = 0;
    this.flowers = [];
    this.wasps = [];
    this.dandelionMotes = [];
    this.playersState.clear();

    // 1. Scatter 9 lush 2.5D wildflowers across the blooming meadow
    const flowerColors = [
      '#F43F5E', // Ruby Rose
      '#A855F7', // Royal Lavender
      '#F59E0B', // Golden Sunflower
      '#06B6D4', // Azure Bluebell
      '#EC4899', // Cherry Blossom
      '#10B981', // Emerald Lotus
      '#F97316', // Tiger Lily
      '#8B5CF6', // Wild Violet
      '#3B82F6'  // Mountain Aster
    ];

    const paddingX = 90;
    const paddingY = 85;
    for (let i = 0; i < 9; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cellW = (width - paddingX * 2) / 3;
      const cellH = (height - paddingY - 140) / 3;

      this.flowers.push({
        x: paddingX + (col + 0.5) * cellW + (Math.random() - 0.5) * (cellW * 0.45),
        y: paddingY + (row + 0.5) * cellH + (Math.random() - 0.5) * (cellH * 0.45),
        color: flowerColors[i % flowerColors.length],
        petalCount: 6,
        nectar: 100,
        maxNectar: 100,
        stemAngle: (Math.random() - 0.5) * 0.4,
        bloomScale: 0.95 + Math.random() * 0.15
      });
    }

    // 2. Wasps patrolling the meadow airspace
    this.wasps.push({
      x: width * 0.28,
      y: height * 0.38,
      vx: 115,
      vy: 65,
      angle: 0,
      wingTimer: 0
    });
    this.wasps.push({
      x: width * 0.72,
      y: height * 0.55,
      vx: -105,
      vy: 95,
      angle: Math.PI,
      wingTimer: 0.5
    });

    // 3. Floating atmospheric dandelion fluff motes drifting on meadow breeze
    for (let i = 0; i < 16; i++) {
      this.dandelionMotes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 12 + Math.random() * 20,
        vy: -6 - Math.random() * 12,
        size: 2.5 + Math.random() * 2.5,
        alpha: 0.35 + Math.random() * 0.45
      });
    }

    // 4. Initialize Active Player Honeybees and Apiary Hives
    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const hx = spacing * (idx + 1);
      const hy = height - 52;
      this.playersState.set(p.id, {
        id: p.id,
        x: hx,
        y: hy - 35,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        hiveX: hx,
        hiveY: hy,
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
    this.wingTimer += dt * 38;
    this.updateBots(dt, width, height);

    // Update Dandelion Breeze Motes
    for (const m of this.dandelionMotes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x > width + 20) m.x = -20;
      if (m.y < -20) m.y = height + 20;
    }

    // Update Wasps with smooth hovering banking
    for (const w of this.wasps) {
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.wingTimer += dt * 45;
      w.angle = Math.atan2(w.vy, w.vx);

      if (w.x < 50) {
        w.x = 50;
        w.vx = Math.abs(w.vx);
      } else if (w.x > width - 50) {
        w.x = width - 50;
        w.vx = -Math.abs(w.vx);
      }
      if (w.y < 70) {
        w.y = 70;
        w.vy = Math.abs(w.vy);
      } else if (w.y > height - 120) {
        w.y = height - 120;
        w.vy = -Math.abs(w.vy);
      }
    }

    // Flowers naturally recharge sweet golden morning nectar
    for (const fl of this.flowers) {
      if (fl.nectar < fl.maxNectar) {
        fl.nectar = Math.min(fl.maxNectar, fl.nectar + dt * 14);
      }
    }

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
      const inputMag = Math.hypot(steerX, steerY);

      const maxSpeed = 225;
      if (inputMag > 0.15) {
        const targetAngle = Math.atan2(steerY, steerX);
        // Smooth angular steering interpolation
        let diff = targetAngle - ps.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ps.angle += diff * Math.min(1.0, dt * 14);

        ps.vx = (steerX / inputMag) * maxSpeed;
        ps.vy = (steerY / inputMag) * maxSpeed;
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;

        // Occasional golden pollen trail when flying
        if (Math.random() < 0.18) {
          this.particles.spawnSparks(
            ps.x - Math.cos(ps.angle) * 12,
            ps.y - Math.sin(ps.angle) * 12,
            '#FDE047',
            3
          );
        }
      } else {
        ps.vx *= 0.88;
        ps.vy *= 0.88;
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;
      }

      // Arena boundary bounds
      ps.x = Math.max(32, Math.min(width - 32, ps.x));
      ps.y = Math.max(55, Math.min(height - 40, ps.y));

      // Check Sipping Nectar Mechanism:
      // Hovering near a flower (< 46px) automatically sips at 60/sec.
      // Holding the ACTION button (Space, Enter, Tap) engages Turbo Vacuum Sip (120/sec)!
      ps.isSipping = false;
      const inputState = this.input.getInputState(p.id);
      const isActionHeld = this.input.isPressed(p.id) || inputState.action;
      const sipRate = isActionHeld ? 130 : 65;
      const sipRadius = 46;

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

              // Streaming golden nectar droplets into bee's proboscis
              if (Math.random() < (isActionHeld ? 0.65 : 0.35)) {
                this.particles.spawnSparks(
                  fl.x + (Math.random() - 0.5) * 12,
                  fl.y + (Math.random() - 0.5) * 12,
                  '#FBBF24',
                  2
                );
              }

              if (Math.random() < 0.12) {
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
          this.particles.showFloatingText('🍯 POCKETS FULL! FLY TO HIVE ⬇️', ps.x, ps.y - 34, '#F59E0B', 22);
        }
      } else {
        ps.fullChimePlayed = false;
      }

      // Check Depositing Nectar into Honeycomb Apiary Hive
      const hiveDist = Math.hypot(ps.x - ps.hiveX, ps.y - ps.hiveY);
      if (ps.carriedNectar > 5 && hiveDist < 48) {
        const deposit = Math.floor(ps.carriedNectar);
        ps.carriedNectar = 0;
        ps.score += deposit;
        this.audio.playScore();
        this.particles.showFloatingText(`🍯 HONEY STORED! +${deposit}`, ps.hiveX, ps.hiveY - 38, '#FBBF24', 24);
        this.particles.spawnConfetti(ps.hiveX, ps.hiveY - 10, 16);
      }

      // Check Colliding with Threatening Patrol Wasps
      for (const w of this.wasps) {
        if (Math.hypot(ps.x - w.x, ps.y - w.y) < 28) {
          ps.stunTimer = 1.2;
          ps.carriedNectar = Math.max(0, ps.carriedNectar - 35);
          this.audio.playStun();
          this.particles.showFloatingText('💥 WASP STING! -35 NECTAR!', ps.x, ps.y - 25, '#EF4444', 22);
          this.particles.spawnExplosion(ps.x, ps.y, '#EF4444', 14);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Lush Sunlit Wildflower Meadow Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#14532D');
    bgGrad.addColorStop(0.45, '#166534');
    bgGrad.addColorStop(1, '#052E16');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm Morning Sunbeams
    ctx.save();
    ctx.fillStyle = 'rgba(254, 240, 138, 0.05)';
    ctx.beginPath();
    ctx.moveTo(width * 0.15, 0);
    ctx.lineTo(width * 0.35, 0);
    ctx.lineTo(width * 0.65, height);
    ctx.lineTo(width * 0.35, height);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(width * 0.6, 0);
    ctx.lineTo(width * 0.8, 0);
    ctx.lineTo(width, height);
    ctx.lineTo(width * 0.75, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Soft Meadow Clover Patches
    ctx.save();
    ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
    for (let i = 0; i < 18; i++) {
      const cx = (i * 79 + 40) % (width - 60);
      const cy = (i * 63 + 80) % (height - 140);
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.arc(cx + 8, cy - 4, 11, 0, Math.PI * 2);
      ctx.arc(cx - 8, cy - 4, 11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Drifting Dandelion Breeze Fluff
    for (const m of this.dandelionMotes) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${m.alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
      // Little seed stem
      ctx.strokeStyle = `rgba(255, 255, 255, ${m.alpha * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.size * 1.5, m.y + m.size * 1.5);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw 2.5D Bloomed Wildflowers with Stems, Leaves & Golden Nectar Pools
    for (const fl of this.flowers) {
      ctx.save();

      // Stem and leaf
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fl.x, fl.y + 10);
      ctx.quadraticCurveTo(fl.x + Math.sin(fl.stemAngle) * 14, fl.y + 26, fl.x, fl.y + 44);
      ctx.stroke();

      // Leaf
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.ellipse(fl.x + 10, fl.y + 26, 11, 5, 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Flower Head Transformation
      ctx.translate(fl.x, fl.y);
      ctx.scale(fl.bloomScale, fl.bloomScale);

      // Flower Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 22, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // 6 Layered Velvet Petals
      const petalDist = 15;
      const petalRx = 11;
      const petalRy = 8;
      for (let i = 0; i < fl.petalCount; i++) {
        const a = (i / fl.petalCount) * Math.PI * 2 + Math.sin(this.animTimer * 1.5) * 0.05;
        const px = Math.cos(a) * petalDist;
        const py = Math.sin(a) * petalDist;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a);

        // Petal Gradient
        const pGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, petalRx);
        pGrad.addColorStop(0, '#FFFFFF');
        pGrad.addColorStop(0.3, fl.color);
        pGrad.addColorStop(1, '#0F172A');
        ctx.fillStyle = pGrad;

        ctx.beginPath();
        ctx.ellipse(0, 0, petalRx, petalRy, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Central Nectar Reservoir
      const nectarPct = fl.nectar / fl.maxNectar;
      const nectarR = 10;

      // Dark golden pollen base ring
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(0, 0, nectarR + 2, 0, Math.PI * 2);
      ctx.fill();

      // Liquid Golden Honey Pool
      if (nectarPct > 0.05) {
        const honeyGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, nectarR);
        honeyGrad.addColorStop(0, '#FEF08A');
        honeyGrad.addColorStop(0.5, '#FBBF24');
        honeyGrad.addColorStop(1, '#D97706');

        ctx.save();
        ctx.fillStyle = honeyGrad;
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 10 * nectarPct;
        ctx.beginPath();
        ctx.arc(0, 0, nectarR * (0.4 + 0.6 * nectarPct), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Glistening Specular Sheen
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.ellipse(-3, -3, 3, 1.8, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nectar level ring gauge around center
      ctx.strokeStyle = nectarPct > 0.2 ? '#FDE047' : '#94A3B8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, nectarR + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * nectarPct);
      ctx.stroke();

      ctx.restore();
    }

    // 3. Draw 2.5D Menacing Patrol Wasps
    for (const w of this.wasps) {
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.angle);

      // Warning danger aura pulse
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();

      // High-frequency wasp wings
      const wWing = Math.sin(w.wingTimer) * 0.8;
      ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      // Top wing
      ctx.beginPath();
      ctx.ellipse(-2, -12 + wWing * 5, 12, 5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Bottom wing
      ctx.beginPath();
      ctx.ellipse(-2, 12 - wWing * 5, 12, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Wasp Thorax & Segmented Abdomen
      // Head
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.ellipse(12, 0, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glowing compound red eyes
      ctx.fillStyle = '#EF4444';
      ctx.shadowColor = '#DC2626';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(14, -2.5, 2, 0, Math.PI * 2);
      ctx.arc(14, 2.5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Thorax (Black chitin)
      ctx.fillStyle = '#27272A';
      ctx.beginPath();
      ctx.ellipse(4, 0, 7, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Abdomen (Hazard Amber & Black Stripes)
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(-8, 0, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Black stripes
      ctx.fillStyle = '#09090B';
      ctx.fillRect(-12, -6, 3, 12);
      ctx.fillRect(-7, -7, 3, 14);
      ctx.fillRect(-2, -6, 2.5, 12);

      // Sharp venomous stinger
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(-18, -2);
      ctx.lineTo(-24, 0);
      ctx.lineTo(-18, 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // 4. Draw Handcrafted Wooden Apiary Hives & Fuzzy Honeybees
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // === APIARY BEE-BOX HIVE ===
      ctx.save();
      ctx.translate(ps.hiveX, ps.hiveY);

      // Hive Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 34, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Handcrafted Wooden Hive Base Box
      ctx.fillStyle = '#78350F';
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-28, -24, 56, 40, 8);
      else ctx.rect(-28, -24, 56, 40);
      ctx.fill();
      ctx.stroke();

      // Cedar Slats
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-26, -11);
      ctx.lineTo(26, -11);
      ctx.moveTo(-26, 2);
      ctx.lineTo(26, 2);
      ctx.stroke();

      // Player Colored Roof Border
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-32, -28, 64, 8, 4);
      else ctx.rect(-32, -28, 64, 8);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Hexagonal Honeycomb Entrance
      ctx.fillStyle = '#D97706';
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const hx = Math.cos(a) * 11;
        const hy = 8 + Math.sin(a) * 11;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Score / Banked Honey Label Pill
      ctx.save();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-26, -46, 52, 16, 5);
      else ctx.rect(-26, -46, 52, 16);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🍯 ${ps.score}`, 0, -34);
      ctx.restore();

      ctx.restore();

      // === PROBOSCIS NECTAR SIP SUCTION BEAM ===
      if (ps.isSipping && ps.carriedNectar < 100) {
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 10;
        ctx.setLineDash([4, 3]);
        ctx.lineDashOffset = -this.animTimer * 20;

        ctx.beginPath();
        ctx.moveTo(ps.x, ps.y);
        ctx.lineTo(ps.sipTargetX, ps.sipTargetY);
        ctx.stroke();

        // Little suction droplet traveling along straw
        const flowT = (this.animTimer * 4) % 1;
        const flowX = ps.sipTargetX + (ps.x - ps.sipTargetX) * flowT;
        const flowY = ps.sipTargetY + (ps.y - ps.sipTargetY) * flowT;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(flowX, flowY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // === ADORABLE 2.5D FUZZY HONEYBEE ===
      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Bee Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 14, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rotate with flight heading
      ctx.rotate(ps.angle);

      // High-Speed Iridescent Wings (with motion-blur layers)
      const wAngle = ps.wingAngle;
      ctx.save();
      ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.2;

      // Left Wing Pair
      ctx.beginPath();
      ctx.ellipse(-2, -14 + wAngle * 6, 12, 6, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Right Wing Pair
      ctx.beginPath();
      ctx.ellipse(-2, 14 - wAngle * 6, 12, 6, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Velvet Striped Fuzzy Bumblebee Body
      // Base Golden Amber Body
      const beeGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, 14);
      beeGrad.addColorStop(0, '#FEF08A');
      beeGrad.addColorStop(0.4, '#FBBF24');
      beeGrad.addColorStop(1, '#D97706');
      ctx.fillStyle = beeGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dark Velvet Stripes
      ctx.fillStyle = '#18181B';
      ctx.fillRect(-6, -9, 3.5, 18);
      ctx.fillRect(0, -9.5, 3.5, 19);

      // Player Colored Pilot Forehead Visor Band
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(6, 0, 6, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Glossy Shiny Bee Eyes
      ctx.fillStyle = '#09090B';
      ctx.beginPath();
      ctx.arc(9, -4, 2.5, 0, Math.PI * 2);
      ctx.arc(9, 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(9.8, -4.6, 1, 0, Math.PI * 2);
      ctx.arc(9.8, 3.4, 1, 0, Math.PI * 2);
      ctx.fill();

      // Antennae with sensory tips
      ctx.strokeStyle = '#27272A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(10, -3);
      ctx.quadraticCurveTo(15, -7, 16, -11);
      ctx.moveTo(10, 3);
      ctx.quadraticCurveTo(15, 7, 16, 11);
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(16, -11, 1.8, 0, Math.PI * 2);
      ctx.arc(16, 11, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Golden Honey Pollen Baskets (Corbiculae) on hind legs
      // Visibly swells with glowing liquid honey as carriedNectar increases!
      if (ps.carriedNectar > 0) {
        const basketR = 2.5 + (ps.carriedNectar / 100) * 5.5;
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-8, -6, basketR, 0, Math.PI * 2);
        ctx.arc(-8, 6, basketR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // === OVERHEAD NECTAR GAUGE & HUD STATUS ===
      ctx.save();
      const pct = Math.floor(ps.carriedNectar);

      if (ps.stunTimer > 0) {
        // Dizzy stars when stung
        ctx.fillStyle = '#EF4444';
        ctx.font = '900 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫 STUNNED!', ps.x, ps.y - 24);
      } else if (pct >= 100) {
        // Pulsing Full Alert with Arrow pointing down
        const bounce = Math.sin(this.animTimer * 8) * 3;
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 8;
        ctx.font = '900 11.5px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🍯 FULL! GO TO HIVE ⬇️', ps.x, ps.y - 28 + bounce);
      } else {
        // Small sleek honey gauge pill
        const gW = 46;
        const gH = 14;
        const gx = ps.x - gW / 2;
        const gy = ps.y - 26;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(gx, gy, gW, gH, 4);
        else ctx.rect(gx, gy, gW, gH);
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Progress bar fill
        if (pct > 0) {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(gx + 2, gy + 2, (gW - 4) * (pct / 100), gH - 4, 2);
          else ctx.rect(gx + 2, gy + 2, (gW - 4) * (pct / 100), gH - 4);
          ctx.fill();
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 8.5px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🍯 ${pct}%`, ps.x, gy + 10.5);
      }
      ctx.restore();
    }

    // 5. Bottom Controls & Instructions Banner
    ctx.save();
    const bannerW = Math.min(520, width - 40);
    const bannerH = 26;
    const bannerX = width / 2 - bannerW / 2;
    const bannerY = height - 28;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 13);
    else ctx.rect(bannerX, bannerY, bannerW, bannerH);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 10px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌸 Hover near flowers to sip nectar (Hold [ACTION] for 2x Turbo Sip!) • Deliver to your Hive 🍯', width / 2, bannerY + 16.5);
    ctx.restore();

    // 6. Header Match Timer
    ctx.save();
    const timeSec = Math.ceil(this.roundTimer);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱️ ${timeSec}s`, width / 2, 28);
    ctx.restore();
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

    // If carried nectar >= 80, navigate directly back to home apiary hive!
    let targetX = ps.hiveX;
    let targetY = ps.hiveY;

    if (ps.carriedNectar < 80) {
      // Find nearest flower with sweet nectar
      let bestFlower: MeadowFlower | null = null;
      let minDist = 9999;
      for (const fl of this.flowers) {
        if (fl.nectar > 15) {
          const d = Math.hypot(fl.x - ps.x, fl.y - ps.y);
          if (d < minDist) {
            minDist = d;
            bestFlower = fl;
          }
        }
      }
      if (bestFlower) {
        targetX = bestFlower.x;
        targetY = bestFlower.y;
      }
    }

    // Wasp avoidance behavior
    for (const w of this.wasps) {
      const waspDist = Math.hypot(w.x - ps.x, w.y - ps.y);
      if (waspDist < 85) {
        // Flee perpendicular away from wasp
        const fleeX = ps.x - w.x;
        const fleeY = ps.y - w.y;
        targetX = ps.x + fleeX * 2;
        targetY = ps.y + fleeY * 2;
        break;
      }
    }

    const dx = targetX - ps.x;
    const dy = targetY - ps.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      const err = difficulty === 'bot_hard' ? 0.04 : difficulty === 'bot_normal' ? 0.18 : 0.4;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * err;
      // Bots use turbo sip when hovering directly near target flower
      const nearFlower = ps.carriedNectar < 80 && dist < 35;
      this.input.setBotInput(botId, nearFlower, Math.cos(angle), -Math.sin(angle), nearFlower);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} harvested the sweetest wildflower honey!` : 'Tied honeybee relay!'
    };
  }
}
