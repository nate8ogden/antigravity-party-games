import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SnowballPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  aimAngle: number;
  sweepDir: number;
  minAimAngle: number;
  maxAimAngle: number;
  isCharging: boolean;
  chargePower: number; // 0.0 to 1.0
  chargeTime: number;
  hp: number;
  maxHp: number;
  stunTimer: number;
  throwCooldown: number;
  alive: boolean;
  score: number;
}

interface BallisticSnowball {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  power: number;
  life: number;
}

interface SnowFortBlock {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
}

interface PineTree {
  x: number;
  y: number;
  radius: number;
}

interface SnowDecal {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

interface AmbientFlake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export class SnowballFightGame extends BaseGame {
  private playersState: Map<PlayerId, SnowballPlayer> = new Map();
  private snowballs: BallisticSnowball[] = [];
  private blocks: SnowFortBlock[] = [];
  private trees: PineTree[] = [];
  private decals: SnowDecal[] = [];
  private ambientFlakes: AmbientFlake[] = [];
  private currentMapName: string = 'Twin Snow Forts';
  private ballCounter: number = 0;
  private destructionOrder: PlayerId[] = [];
  private gravity: number = 550;

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
    this.roundTimer = 45;
    this.isFinished = false;
    this.playersState.clear();
    this.snowballs = [];
    this.blocks = [];
    this.trees = [];
    this.decals = [];
    this.ballCounter = 0;
    this.destructionOrder = [];

    // Ambient falling snow
    this.ambientFlakes = [];
    for (let i = 0; i < 50; i++) {
      this.ambientFlakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 15,
        vy: 20 + Math.random() * 35,
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.3 + Math.random() * 0.5
      });
    }

    const active = this.getActivePlayers();
    const isTwoPlayer = active.length === 2;

    // Procedural Map Generation
    this.generateProceduralMap(width, height, isTwoPlayer);

    if (isTwoPlayer) {
      // 2 Player Duel: West vs East
      const p1 = active[0];
      const p2 = active[1];

      this.playersState.set(p1.id, {
        id: p1.id,
        x: width * 0.16,
        y: height * 0.5,
        vx: 0,
        vy: 0,
        baseX: width * 0.16,
        baseY: height * 0.5,
        aimAngle: 0,
        sweepDir: 1,
        minAimAngle: -Math.PI * 0.32,
        maxAimAngle: Math.PI * 0.32,
        isCharging: false,
        chargePower: 0,
        chargeTime: 0,
        hp: 3,
        maxHp: 3,
        stunTimer: 0,
        throwCooldown: 0,
        alive: true,
        score: 0
      });

      this.playersState.set(p2.id, {
        id: p2.id,
        x: width * 0.84,
        y: height * 0.5,
        vx: 0,
        vy: 0,
        baseX: width * 0.84,
        baseY: height * 0.5,
        aimAngle: Math.PI,
        sweepDir: 1,
        minAimAngle: Math.PI * 0.68,
        maxAimAngle: Math.PI * 1.32,
        isCharging: false,
        chargePower: 0,
        chargeTime: 0,
        hp: 3,
        maxHp: 3,
        stunTimer: 0,
        throwCooldown: 0,
        alive: true,
        score: 0
      });
    } else {
      // 3 or 4 Players: 4 Corner quadrants facing arena center
      const corners: {
        x: number;
        y: number;
        centerAngle: number;
        minA: number;
        maxA: number;
      }[] = [
        {
          x: width * 0.18,
          y: height * 0.22,
          centerAngle: Math.PI * 0.25,
          minA: 0,
          maxA: Math.PI * 0.5
        }, // P1 (Top-Left)
        {
          x: width * 0.82,
          y: height * 0.22,
          centerAngle: Math.PI * 0.75,
          minA: Math.PI * 0.5,
          maxA: Math.PI
        }, // P2 (Top-Right)
        {
          x: width * 0.18,
          y: height * 0.78,
          centerAngle: -Math.PI * 0.25,
          minA: -Math.PI * 0.5,
          maxA: 0
        }, // P3 (Bottom-Left)
        {
          x: width * 0.82,
          y: height * 0.78,
          centerAngle: -Math.PI * 0.75,
          minA: -Math.PI,
          maxA: -Math.PI * 0.5
        }  // P4 (Bottom-Right)
      ];

      active.forEach((p, idx) => {
        const c = corners[idx % corners.length];
        this.playersState.set(p.id, {
          id: p.id,
          x: c.x,
          y: c.y,
          vx: 0,
          vy: 0,
          baseX: c.x,
          baseY: c.y,
          aimAngle: c.centerAngle,
          sweepDir: 1,
          minAimAngle: c.minA - 0.2,
          maxAimAngle: c.maxA + 0.2,
          isCharging: false,
          chargePower: 0,
          chargeTime: 0,
          hp: 3,
          maxHp: 3,
          stunTimer: 0,
          throwCooldown: 0,
          alive: true,
          score: 0
        });
      });
    }
  }

  private generateProceduralMap(width: number, height: number, isTwoPlayer: boolean): void {
    const archetypes = [
      'Twin Snow Forts',
      'Pine Forest',
      'Igloo Village',
      'Glacier Ridge'
    ];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];

    this.blocks = [];
    this.trees = [];

    const cx = width / 2;
    const cy = height / 2;
    let blockId = 0;

    if (this.currentMapName === 'Twin Snow Forts') {
      // Mirrored snow barricades
      const fortOffsets = isTwoPlayer
        ? [
            { x: cx - 110, y: cy - 70 },
            { x: cx - 110, y: cy + 70 },
            { x: cx + 110, y: cy - 70 },
            { x: cx + 110, y: cy + 70 },
            { x: cx - 160, y: cy },
            { x: cx + 160, y: cy }
          ]
        : [
            { x: cx - 120, y: cy - 60 },
            { x: cx + 120, y: cy - 60 },
            { x: cx - 120, y: cy + 60 },
            { x: cx + 120, y: cy + 60 },
            { x: cx, y: cy - 110 },
            { x: cx, y: cy + 110 }
          ];

      fortOffsets.forEach((pt) => {
        this.blocks.push({
          id: blockId++,
          x: pt.x - 22,
          y: pt.y - 22,
          w: 44,
          h: 44,
          hp: 2,
          maxHp: 2
        });
      });

      // Flanking pine trees
      this.trees.push({ x: cx, y: cy, radius: 26 });
      this.trees.push({ x: cx, y: cy - 140, radius: 22 });
      this.trees.push({ x: cx, y: cy + 140, radius: 22 });
    } else if (this.currentMapName === 'Pine Forest') {
      // Clustered pine trees and tactical snow mounds
      const treeCoords = [
        { x: cx - 90, y: cy - 80 },
        { x: cx + 90, y: cy + 80 },
        { x: cx - 90, y: cy + 80 },
        { x: cx + 90, y: cy - 80 },
        { x: cx, y: cy },
        { x: cx - 180, y: cy },
        { x: cx + 180, y: cy }
      ];
      treeCoords.forEach((t) => {
        this.trees.push({ x: t.x, y: t.y, radius: 24 });
      });

      // Scattered snow blocks
      const blockCoords = [
        { x: cx, y: cy - 100 },
        { x: cx, y: cy + 100 },
        { x: cx - 50, y: cy },
        { x: cx + 50, y: cy }
      ];
      blockCoords.forEach((b) => {
        this.blocks.push({
          id: blockId++,
          x: b.x - 20,
          y: b.y - 20,
          w: 40,
          h: 40,
          hp: 2,
          maxHp: 2
        });
      });
    } else if (this.currentMapName === 'Igloo Village') {
      // Central dome shelter and perimeter blocks
      this.trees.push({ x: cx - 140, y: cy - 110, radius: 20 });
      this.trees.push({ x: cx + 140, y: cy - 110, radius: 20 });
      this.trees.push({ x: cx - 140, y: cy + 110, radius: 20 });
      this.trees.push({ x: cx + 140, y: cy + 110, radius: 20 });

      // Ring of destructible snow blocks around center
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
        const bx = cx + Math.cos(angle) * 85;
        const by = cy + Math.sin(angle) * 75;
        this.blocks.push({
          id: blockId++,
          x: bx - 18,
          y: by - 18,
          w: 36,
          h: 36,
          hp: 2,
          maxHp: 2
        });
      }
    } else {
      // Glacier Ridge: Linear icy corridor with defensive trenches
      const rowY = [cy - 90, cy, cy + 90];
      rowY.forEach((ry) => {
        this.blocks.push({
          id: blockId++,
          x: cx - 75 - 20,
          y: ry - 20,
          w: 40,
          h: 40,
          hp: 2,
          maxHp: 2
        });
        this.blocks.push({
          id: blockId++,
          x: cx + 75 - 20,
          y: ry - 20,
          w: 40,
          h: 40,
          hp: 2,
          maxHp: 2
        });
      });
      this.trees.push({ x: cx, y: cy - 140, radius: 24 });
      this.trees.push({ x: cx, y: cy + 140, radius: 24 });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update ambient snowflakes
    for (const flake of this.ambientFlakes) {
      flake.y += flake.vy * dt;
      flake.x += flake.vx * dt;
      if (flake.y > height) {
        flake.y = -10;
        flake.x = Math.random() * width;
      }
    }

    // Process Bot AI
    this.updateBots(dt, width, height);

    // Update active players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.alive) continue;

      if (ps.throwCooldown > 0) {
        ps.throwCooldown = Math.max(0, ps.throwCooldown - dt);
      }

      if (ps.stunTimer > 0) {
        ps.stunTimer = Math.max(0, ps.stunTimer - dt);
        // Stunned players cannot aim or charge
        ps.isCharging = false;
        ps.chargePower = 0;
        ps.chargeTime = 0;
        continue;
      }

      // Read steer input (allows manual fast aim sweep or directional steering)
      const steer = this.input.getSteer(p.id);
      const isPressed = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);

      if (!ps.isCharging) {
        // Sweeping aim arrow
        if (steer !== 0) {
          ps.aimAngle += steer * 2.8 * dt;
        } else {
          ps.aimAngle += ps.sweepDir * 1.6 * dt;
        }

        // Clamp & bounce sweep within aim cone
        if (ps.aimAngle > ps.maxAimAngle) {
          ps.aimAngle = ps.maxAimAngle;
          ps.sweepDir = -1;
        } else if (ps.aimAngle < ps.minAimAngle) {
          ps.aimAngle = ps.minAimAngle;
          ps.sweepDir = 1;
        }
      } else {
        // While charging, slight fine-tuning steer
        if (steer !== 0) {
          ps.aimAngle += steer * 1.1 * dt;
        }
      }

      // Handle power charging & throwing
      if (isPressed && ps.throwCooldown <= 0) {
        if (!ps.isCharging) {
          ps.isCharging = true;
          ps.chargeTime = 0;
          ps.chargePower = 0.2;
        } else {
          ps.chargeTime += dt;
          // Charge power ramps up smoothly from 0.2 to 1.0 in ~1.0s, then oscillates gently
          const ramp = ps.chargeTime / 1.0;
          if (ramp <= 1.0) {
            ps.chargePower = 0.2 + ramp * 0.8;
          } else {
            // Oscillate smoothly between 0.75 and 1.0 so player can time peak power
            ps.chargePower = 0.875 + Math.sin((ramp - 1.0) * Math.PI * 3) * 0.125;
          }
        }
      } else if (ps.isCharging) {
        // Button released: FIRE SNOWBALL!
        this.throwSnowball(ps);
        ps.isCharging = false;
        ps.chargePower = 0;
        ps.chargeTime = 0;
        ps.throwCooldown = 0.4;
      }

      // Slight gentle dampening on player knockback
      ps.vx *= 0.9;
      ps.vy *= 0.9;
      ps.x += ps.vx * dt * 60;
      ps.y += ps.vy * dt * 60;

      // Keep player inside camp boundary
      const campRadius = 45;
      const dBaseX = ps.x - ps.baseX;
      const dBaseY = ps.y - ps.baseY;
      const dist = Math.hypot(dBaseX, dBaseY);
      if (dist > campRadius) {
        ps.x = ps.baseX + (dBaseX / dist) * campRadius;
        ps.y = ps.baseY + (dBaseY / dist) * campRadius;
      }
    }

    // Update Snowballs
    for (let i = this.snowballs.length - 1; i >= 0; i--) {
      const b = this.snowballs[i];
      b.life += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.vz -= this.gravity * dt;

      let collided = false;

      // Check collision with trees
      for (const tree of this.trees) {
        const d = Math.hypot(b.x - tree.x, b.y - tree.y);
        if (d < tree.radius + b.radius && b.z < 35) {
          this.audio.playSnowSplat();
          this.particles.spawnExplosion(b.x, b.y, '#FFFFFF', 14);
          this.addSnowDecal(b.x, b.y);
          collided = true;
          break;
        }
      }

      // Check collision with SnowFortBlocks
      if (!collided) {
        for (let bi = this.blocks.length - 1; bi >= 0; bi--) {
          const block = this.blocks[bi];
          if (
            b.x >= block.x &&
            b.x <= block.x + block.w &&
            b.y >= block.y &&
            b.y <= block.y + block.h &&
            b.z < 30
          ) {
            block.hp -= 1;
            this.audio.playSnowSplat();
            this.particles.spawnExplosion(b.x, b.y, '#E2E8F0', 16);
            if (block.hp <= 0) {
              this.particles.spawnExplosion(
                block.x + block.w / 2,
                block.y + block.h / 2,
                '#CBD5E1',
                22
              );
              this.blocks.splice(bi, 1);
            }
            collided = true;
            break;
          }
        }
      }

      // Check collision with Players (only if ball is near ground level z < 28)
      if (!collided && b.z < 28) {
        for (const p of this.getActivePlayers()) {
          const ps = this.playersState.get(p.id);
          if (!ps || !ps.alive || ps.id === b.ownerId) continue;

          const dist = Math.hypot(b.x - ps.x, b.y - ps.y);
          if (dist < 26) {
            // Hit player!
            ps.hp -= 1;
            ps.stunTimer = 1.1;

            // Knockback
            const pushAngle = Math.atan2(b.vy, b.vx);
            ps.vx = Math.cos(pushAngle) * 5.5;
            ps.vy = Math.sin(pushAngle) * 5.5;

            // Give shooter points
            const shooter = this.playersState.get(b.ownerId);
            if (shooter) {
              shooter.score += 100;
            }

            this.audio.playSnowSplat();
            this.audio.playStun();
            this.particles.shake(0.35);
            this.particles.spawnExplosion(ps.x, ps.y, p.color, 24);
            this.particles.showFloatingText('SPLAT!', ps.x, ps.y - 24, p.color, 22);
            this.addSnowDecal(ps.x, ps.y);

            if (ps.hp <= 0) {
              ps.alive = false;
              this.destructionOrder.push(ps.id);
              this.particles.spawnExplosion(ps.x, ps.y, '#FFFFFF', 30);
              this.particles.showFloatingText('OUT!', ps.x, ps.y - 30, '#EF4444', 26);
            }

            collided = true;
            break;
          }
        }
      }

      // Ground landing
      if (!collided && b.z <= 0) {
        this.audio.playSnowSplat();
        this.particles.spawnExplosion(b.x, b.y, '#F1F5F9', 10);
        this.addSnowDecal(b.x, b.y);
        collided = true;
      }

      // Boundary check or collided
      if (collided || b.x < -40 || b.x > width + 40 || b.y < -40 || b.y > height + 40) {
        this.snowballs.splice(i, 1);
      }
    }

    // Check round over condition
    const alivePlayers = Array.from(this.playersState.values()).filter((p) => p.alive);
    if (alivePlayers.length <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private throwSnowball(ps: SnowballPlayer): void {
    // Horizontal speed scales from 280 to 650 based on power
    const speed = 260 + ps.chargePower * 420;
    const vx = Math.cos(ps.aimAngle) * speed;
    const vy = Math.sin(ps.aimAngle) * speed;

    // Vertical launch speed scales with power
    const vz = 170 + ps.chargePower * 270;

    // Spawn point in front of player
    const spawnX = ps.x + Math.cos(ps.aimAngle) * 24;
    const spawnY = ps.y + Math.sin(ps.aimAngle) * 24;

    this.snowballs.push({
      id: this.ballCounter++,
      ownerId: ps.id,
      x: spawnX,
      y: spawnY,
      z: 14,
      vx,
      vy,
      vz,
      radius: 7,
      power: ps.chargePower,
      life: 0
    });

    this.audio.playWhoosh();
    this.particles.spawnExplosion(spawnX, spawnY, '#FFFFFF', 6);
  }

  private addSnowDecal(x: number, y: number): void {
    if (this.decals.length > 35) {
      this.decals.shift();
    }
    this.decals.push({
      x,
      y,
      radius: 12 + Math.random() * 10,
      alpha: 0.6
    });
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Winter Arctic Ice Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#E0F2FE'); // Pale arctic ice
    bgGrad.addColorStop(0.5, '#F0F9FF'); // Soft snow field
    bgGrad.addColorStop(1, '#E2E8F0'); // Frozen white-grey
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Arena boundary lines
    ctx.strokeStyle = '#BAE6FD';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Center divider / decorative frozen ring
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 70, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Render Snow Splat Decals
    for (const decal of this.decals) {
      ctx.beginPath();
      ctx.arc(decal.x, decal.y, decal.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${decal.alpha})`;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
      ctx.stroke();
    }

    // Render Snow Fort Blocks
    for (const block of this.blocks) {
      // Drop shadow
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.fillRect(block.x + 3, block.y + 4, block.w, block.h);

      // Snow block body
      ctx.fillStyle = block.hp === 2 ? '#FFFFFF' : '#E2E8F0';
      ctx.fillRect(block.x, block.y, block.w, block.h);

      // Block outline & frosty bevel
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x, block.y, block.w, block.h);

      // Snow block brick lines / cracks if damaged
      if (block.hp < block.maxHp) {
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(block.x + 8, block.y + 6);
        ctx.lineTo(block.x + block.w - 12, block.y + block.h - 8);
        ctx.stroke();
      } else {
        // Ice crystal highlight
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1;
        ctx.strokeRect(block.x + 4, block.y + 4, block.w - 8, block.h - 8);
      }
    }

    // Render Pine Trees
    for (const tree of this.trees) {
      // Tree ground shadow
      ctx.beginPath();
      ctx.ellipse(tree.x + 4, tree.y + 6, tree.radius * 1.1, tree.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 116, 139, 0.3)';
      ctx.fill();

      // Evergreen tiered layers
      const tiers = [
        { r: tree.radius, color: '#166534', yOffset: 0 },
        { r: tree.radius * 0.75, color: '#15803D', yOffset: -8 },
        { r: tree.radius * 0.5, color: '#16A34A', yOffset: -16 }
      ];

      for (const t of tiers) {
        ctx.beginPath();
        ctx.arc(tree.x, tree.y + t.yOffset, t.r, 0, Math.PI * 2);
        ctx.fillStyle = t.color;
        ctx.fill();
        ctx.strokeStyle = '#14532D';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Snow cap on top of each tier
        ctx.beginPath();
        ctx.arc(tree.x, tree.y + t.yOffset - 3, t.r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
    }

    // Render Ballistic Snowball Shadows (first, so they stay grounded)
    for (const b of this.snowballs) {
      const shadowScale = Math.max(0.4, 1 - b.z / 180);
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.radius * shadowScale * 1.3, b.radius * shadowScale * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.fill();
    }

    // Render Players & Bases
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Base footprint ring
      ctx.beginPath();
      ctx.arc(ps.baseX, ps.baseY, 32, 0, Math.PI * 2);
      ctx.strokeStyle = `${p.color}55`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (!ps.alive) {
        // Player eliminated: Render Comical Decorated Snowman
        this.renderSnowman(ctx, ps.x, ps.y, p.color);
        continue;
      }

      // Player shadow
      ctx.beginPath();
      ctx.ellipse(ps.x + 3, ps.y + 4, 18, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(71, 85, 105, 0.35)';
      ctx.fill();

      // Player Body (Winter Coat / Arctic Parka)
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#1E293B';
      ctx.stroke();

      // Winter Hood / Beanie trim
      ctx.beginPath();
      ctx.arc(ps.x, ps.y - 4, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = p.colorDark || '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Eyes facing aim direction
      const eyeOffset = 6;
      const ex1 = ps.x + Math.cos(ps.aimAngle - 0.35) * eyeOffset;
      const ey1 = ps.y + Math.sin(ps.aimAngle - 0.35) * eyeOffset - 4;
      const ex2 = ps.x + Math.cos(ps.aimAngle + 0.35) * eyeOffset;
      const ey2 = ps.y + Math.sin(ps.aimAngle + 0.35) * eyeOffset - 4;

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(ex1, ey1, 1.8, 0, Math.PI * 2);
      ctx.arc(ex2, ey2, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Stun flurry if dazed
      if (ps.stunTimer > 0) {
        const stunAngle = performance.now() * 0.008;
        for (let s = 0; s < 3; s++) {
          const a = stunAngle + (s * Math.PI * 2) / 3;
          const sx = ps.x + Math.cos(a) * 18;
          const sy = ps.y - 18 + Math.sin(a) * 6;
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#FBBF24';
          ctx.fill();
        }
      }

      // Draw Aim Trajectory & Power Meter
      this.renderPlayerAimAndPower(ctx, ps, p.color);

      // Player Hearts above head
      this.renderHearts(ctx, ps.x, ps.y - 28, ps.hp, ps.maxHp);
    }

    // Render Ballistic Snowballs (elevated by z)
    for (const b of this.snowballs) {
      const renderY = b.y - b.z;
      const sizeBonus = Math.min(6, b.z / 25);
      const drawRadius = b.radius + sizeBonus;

      // Snowball glow & body
      ctx.beginPath();
      ctx.arc(b.x, renderY, drawRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#93C5FD';
      ctx.stroke();

      // Powder glint
      ctx.beginPath();
      ctx.arc(b.x - drawRadius * 0.35, renderY - drawRadius * 0.35, drawRadius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
    }

    // Render Ambient Falling Snow
    ctx.fillStyle = '#FFFFFF';
    for (const flake of this.ambientFlakes) {
      ctx.globalAlpha = flake.alpha;
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Render Central HUD Pod at top corridor (y = 56)
    this.renderCenterHudPod(ctx, width);

    ctx.restore();
  }

  private renderPlayerAimAndPower(ctx: CanvasRenderingContext2D, ps: SnowballPlayer, color: string): void {
    const aimLen = 38;
    const ax = ps.x + Math.cos(ps.aimAngle) * aimLen;
    const ay = ps.y + Math.sin(ps.aimAngle) * aimLen;

    // Aim Pointer Line
    ctx.strokeStyle = color;
    ctx.lineWidth = ps.isCharging ? 3.5 : 2;
    ctx.beginPath();
    ctx.moveTo(ps.x + Math.cos(ps.aimAngle) * 16, ps.y + Math.sin(ps.aimAngle) * 16);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    // Arrow Tip
    const arrowAngle = ps.aimAngle;
    const arrowHeadLen = 9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(
      ax - arrowHeadLen * Math.cos(arrowAngle - Math.PI / 6),
      ay - arrowHeadLen * Math.sin(arrowAngle - Math.PI / 6)
    );
    ctx.lineTo(
      ax - arrowHeadLen * Math.cos(arrowAngle + Math.PI / 6),
      ay - arrowHeadLen * Math.sin(arrowAngle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    // If Charging: Render Ballistic Prediction Arc & Power Bar
    if (ps.isCharging) {
      // Estimated range based on current power
      const predictedRange = 120 + ps.chargePower * 280;
      const stepCount = 5;
      ctx.save();
      for (let s = 1; s <= stepCount; s++) {
        const dist = (predictedRange * s) / stepCount;
        const px = ps.x + Math.cos(ps.aimAngle) * dist;
        const py = ps.y + Math.sin(ps.aimAngle) * dist;
        const dotAlpha = (s / stepCount) * 0.7;

        ctx.beginPath();
        ctx.arc(px, py, 2.5 + (s === stepCount ? 2 : 0), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${dotAlpha})`;
        ctx.fill();
      }

      // Circular/Curved Power Arc above player head
      const barW = 44;
      const barH = 6;
      const barX = ps.x - barW / 2;
      const barY = ps.y - 36;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      // Power gradient from green to red
      const pGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
      pGrad.addColorStop(0, '#22C55E');
      pGrad.addColorStop(0.6, '#FBBF24');
      pGrad.addColorStop(1, '#EF4444');
      ctx.fillStyle = pGrad;
      ctx.fillRect(barX, barY, barW * ps.chargePower, barH);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

      ctx.restore();
    }
  }

  private renderSnowman(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    // Bottom snowball
    ctx.beginPath();
    ctx.arc(x, y + 6, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Head snowball
    ctx.beginPath();
    ctx.arc(x, y - 10, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Coal eyes & carrot nose
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(x - 4, y - 13, 2.5, 2.5);
    ctx.fillRect(x + 2, y - 13, 2.5, 2.5);
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(x - 1, y - 9);
    ctx.lineTo(x + 5, y - 8);
    ctx.lineTo(x - 1, y - 7);
    ctx.fill();

    // Player colored scarf
    ctx.fillStyle = color;
    ctx.fillRect(x - 10, y - 2, 20, 5);
    ctx.fillRect(x + 2, y + 1, 5, 10);
  }

  private renderHearts(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    hp: number,
    maxHp: number
  ): void {
    const spacing = 12;
    const startX = x - ((maxHp - 1) * spacing) / 2;

    for (let i = 0; i < maxHp; i++) {
      const hx = startX + i * spacing;
      const isFilled = i < hp;

      ctx.beginPath();
      ctx.arc(hx, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isFilled ? '#EF4444' : '#CBD5E1';
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    // Dark sleek capsule
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`❄️ ${this.currentMapName.toUpperCase()}`, podX + 16, podY + podH / 2);

    // Round Timer
    const mins = Math.floor(this.roundTimer / 60);
    const secs = Math.floor(this.roundTimer % 60);
    const timerStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    ctx.font = '800 13px Inter, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.roundTimer <= 10 ? '#EF4444' : '#FFFFFF';
    ctx.fillText(timerStr, width / 2, podY + podH / 2);

    // Player Status Mini-Dots on Right
    ctx.textAlign = 'right';
    let dotX = podX + podW - 16;
    const active = this.getActivePlayers();
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      const ps = this.playersState.get(p.id);
      const isAlive = ps ? ps.alive : false;

      ctx.beginPath();
      ctx.arc(dotX, podY + podH / 2, 5, 0, Math.PI * 2);
      ctx.fillStyle = isAlive ? p.color : '#64748B';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      dotX -= 14;
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();

    // Compute rankings: Survivors first (ranked by HP, then score), followed by destruction order
    const survivors = active
      .filter((p) => this.playersState.get(p.id)?.alive)
      .sort((a, b) => {
        const sa = this.playersState.get(a.id)!;
        const sb = this.playersState.get(b.id)!;
        if (sb.hp !== sa.hp) return sb.hp - sa.hp;
        return sb.score - sa.score;
      });

    const eliminated = this.destructionOrder
      .slice()
      .reverse()
      .map((id) => active.find((p) => p.id === id)!)
      .filter(Boolean);

    const fullOrder = [...survivors, ...eliminated];

    // Build rankings list
    const rankings = fullOrder.map((p, idx) => ({
      playerId: p.id,
      score: this.playersState.get(p.id)?.score ?? 0,
      place: idx + 1
    }));

    const winnerId = fullOrder.length > 0 ? fullOrder[0].id : null;
    const winnerName = active.find((p) => p.id === winnerId)?.name ?? 'Player';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winnerName} ruled the snowball arena with master artillery accuracy!`
    };
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || !ps.alive || ps.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Find nearest alive enemy
    const enemies = this.getActivePlayers()
      .filter((p) => p.id !== botId && this.playersState.get(p.id)?.alive)
      .map((p) => this.playersState.get(p.id)!);

    if (enemies.length === 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Sort by proximity
    enemies.sort((a, b) => Math.hypot(a.x - ps.x, a.y - ps.y) - Math.hypot(b.x - ps.x, b.y - ps.y));
    const target = enemies[0];

    const dx = target.x - ps.x;
    const dy = target.y - ps.y;
    const dist = Math.hypot(dx, dy);
    let targetAngle = Math.atan2(dy, dx);

    // Apply difficulty modifiers
    let aimTolerance = 0.22;
    let powerTolerance = 0.15;
    let steerDir = 0;

    if (difficulty === 'bot_easy') {
      // Slower reaction, large aim dispersion
      aimTolerance = 0.45;
      powerTolerance = 0.3;
      // Occasionally idle
      if (Math.random() < 0.03) {
        this.input.setBotInput(botId, false, 0, 0, false);
        return;
      }
    } else if (difficulty === 'bot_hard') {
      // Pinpoint precision, leading moving targets
      aimTolerance = 0.08;
      powerTolerance = 0.05;
      if (target.vx !== 0 || target.vy !== 0) {
        const leadTime = dist / 450;
        targetAngle = Math.atan2(target.y + target.vy * leadTime - ps.y, target.x + target.vx * leadTime - ps.x);
      }
    }

    // Steer aim towards target
    let angleDiff = targetAngle - ps.aimAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) > 0.08) {
      steerDir = angleDiff > 0 ? 1 : -1;
    }

    // Calculate required throw power for distance
    // Snowball flight distance at power P is approximately: D = 140 + P * 380
    const rawPower = Math.min(1.0, Math.max(0.3, (dist - 90) / 360));
    const powerJitter =
      difficulty === 'bot_easy'
        ? (Math.random() - 0.5) * 0.2
        : difficulty === 'bot_normal'
        ? (Math.random() - 0.5) * 0.08
        : 0;
    const targetPower = Math.min(1.0, Math.max(0.28, rawPower + powerJitter));

    // Decision: charge or release
    if (Math.abs(angleDiff) <= aimTolerance) {
      if (!ps.isCharging) {
        // Start charging
        this.input.setBotInput(botId, true, steerDir, 0, true);
      } else {
        // Check if power reached
        if (ps.chargePower >= targetPower) {
          // Release throw!
          this.input.setBotInput(botId, false, 0, 0, false);
        } else {
          // Keep charging
          this.input.setBotInput(botId, true, steerDir, 0, true);
        }
      }
    } else {
      // Not yet aligned: guide aim without charging, or cancel charge if misaligned
      this.input.setBotInput(botId, false, steerDir, 0, false);
    }
  }
}
