import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

export interface SubTower {
  id: string;
  ownerId: PlayerId;
  name: string;
  x: number;
  y: number;
  radius: number;
  maxHp: number;
  hp: number;
  alive: boolean;
}

export interface FortressTower {
  id: PlayerId;
  x: number;
  y: number;
  cannonAngle: number;
  sweepMinAngle: number;
  sweepMaxAngle: number;
  sweepSpeed: number;
  sweepDir: number;
  maxHp: number;
  hp: number;
  reloadTimer: number;
  reloadTime: number;
  alive: boolean;
  score: number;
  subTowers: SubTower[];
}

export interface Cannonball {
  id: number;
  shooterId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
}

export class CannonBarrageGame extends BaseGame {
  private fortresses: Map<PlayerId, FortressTower> = new Map();
  private cannonballs: Cannonball[] = [];
  private ballIdCounter: number = 0;
  private destructionOrder: PlayerId[] = [];

  public areSubTowersDown(f: FortressTower): boolean {
    return f.subTowers.length === 0 || f.subTowers.every((st) => !st.alive);
  }

  public getAliveSubTowersCount(f: FortressTower): number {
    return f.subTowers.filter((st) => st.alive).length;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.fortresses.clear();
    this.cannonballs = [];
    this.ballIdCounter = 0;
    this.destructionOrder = [];

    const active = this.getActivePlayers();
    const isTwoPlayer = active.length === 2;

    if (isTwoPlayer) {
      // 2 Player Duel: West vs East
      const p1 = active[0];
      const p2 = active[1];

      const p1SubTowers: SubTower[] = [
        {
          id: `${p1.id}-north`,
          ownerId: p1.id,
          name: 'North Bastion',
          x: 135,
          y: height / 2 - 140,
          radius: 20,
          maxHp: 2,
          hp: 2,
          alive: true
        },
        {
          id: `${p1.id}-south`,
          ownerId: p1.id,
          name: 'South Bastion',
          x: 135,
          y: height / 2 + 140,
          radius: 20,
          maxHp: 2,
          hp: 2,
          alive: true
        }
      ];

      this.fortresses.set(p1.id, {
        id: p1.id,
        x: 75,
        y: height / 2,
        cannonAngle: 0,
        sweepMinAngle: -Math.PI / 3,
        sweepMaxAngle: Math.PI / 3,
        sweepSpeed: 1.7,
        sweepDir: 1,
        maxHp: 4,
        hp: 4,
        reloadTimer: 0,
        reloadTime: 0.85,
        alive: true,
        score: 0,
        subTowers: p1SubTowers
      });

      const p2SubTowers: SubTower[] = [
        {
          id: `${p2.id}-north`,
          ownerId: p2.id,
          name: 'North Bastion',
          x: width - 135,
          y: height / 2 - 140,
          radius: 20,
          maxHp: 2,
          hp: 2,
          alive: true
        },
        {
          id: `${p2.id}-south`,
          ownerId: p2.id,
          name: 'South Bastion',
          x: width - 135,
          y: height / 2 + 140,
          radius: 20,
          maxHp: 2,
          hp: 2,
          alive: true
        }
      ];

      this.fortresses.set(p2.id, {
        id: p2.id,
        x: width - 75,
        y: height / 2,
        cannonAngle: Math.PI,
        sweepMinAngle: (2 * Math.PI) / 3,
        sweepMaxAngle: (4 * Math.PI) / 3,
        sweepSpeed: 1.7,
        sweepDir: 1,
        maxHp: 4,
        hp: 4,
        reloadTimer: 0,
        reloadTime: 0.85,
        alive: true,
        score: 0,
        subTowers: p2SubTowers
      });
    } else {
      // 3 or 4 Players: 4 Corner Fortresses facing center
      const corners: {
        x: number;
        y: number;
        minA: number;
        maxA: number;
        subs: { x: number; y: number; name: string }[];
      }[] = [
        {
          x: 80,
          y: 80,
          minA: 0,
          maxA: Math.PI / 2,
          subs: [
            { x: 180, y: 75, name: 'East Bastion' },
            { x: 75, y: 180, name: 'South Bastion' }
          ]
        },
        {
          x: width - 80,
          y: 80,
          minA: Math.PI / 2,
          maxA: Math.PI,
          subs: [
            { x: width - 180, y: 75, name: 'West Bastion' },
            { x: width - 75, y: 180, name: 'South Bastion' }
          ]
        },
        {
          x: 80,
          y: height - 80,
          minA: -Math.PI / 2,
          maxA: 0,
          subs: [
            { x: 180, y: height - 75, name: 'East Bastion' },
            { x: 75, y: height - 180, name: 'North Bastion' }
          ]
        },
        {
          x: width - 80,
          y: height - 80,
          minA: Math.PI,
          maxA: (3 * Math.PI) / 2,
          subs: [
            { x: width - 180, y: height - 75, name: 'West Bastion' },
            { x: width - 75, y: height - 180, name: 'North Bastion' }
          ]
        }
      ];

      active.forEach((p, idx) => {
        const c = corners[idx] || corners[0];
        const midA = (c.minA + c.maxA) / 2;
        const subTowers: SubTower[] = c.subs.map((s, sIdx) => ({
          id: `${p.id}-sub-${sIdx}`,
          ownerId: p.id,
          name: s.name,
          x: s.x,
          y: s.y,
          radius: 19,
          maxHp: 2,
          hp: 2,
          alive: true
        }));

        this.fortresses.set(p.id, {
          id: p.id,
          x: c.x,
          y: c.y,
          cannonAngle: midA,
          sweepMinAngle: c.minA,
          sweepMaxAngle: c.maxA,
          sweepSpeed: 1.5,
          sweepDir: 1,
          maxHp: 3,
          hp: 3,
          reloadTimer: 0,
          reloadTime: 0.95,
          alive: true,
          score: 0,
          subTowers
        });
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bots
    this.updateBots(dt, width, height);

    // Update Fortresses & Cannons
    for (const f of this.fortresses.values()) {
      if (!f.alive) continue;

      if (f.reloadTimer > 0) f.reloadTimer -= dt;

      // Oscillate cannon aim
      f.cannonAngle += f.sweepDir * f.sweepSpeed * dt;
      if (f.cannonAngle >= f.sweepMaxAngle) {
        f.cannonAngle = f.sweepMaxAngle;
        f.sweepDir = -1;
      } else if (f.cannonAngle <= f.sweepMinAngle) {
        f.cannonAngle = f.sweepMinAngle;
        f.sweepDir = 1;
      }

      // Check player fire input
      const justPressed = this.input.justPressed(f.id) || this.input.isActionPressed(f.id);
      if (justPressed && f.reloadTimer <= 0) {
        this.fireCannon(f);
      }
    }

    // Process Cannonballs
    for (let i = this.cannonballs.length - 1; i >= 0; i--) {
      const b = this.cannonballs[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      // Cannonball smoke trail
      if (Math.random() < 0.45) {
        this.particles.spawnSparks(b.x, b.y, '#94A3B8', 1);
      }

      // Out of bounds or life expired
      if (b.x < 0 || b.x > width || b.y < 0 || b.y > height || b.life <= 0) {
        this.cannonballs.splice(i, 1);
        continue;
      }

      // Check collision with enemy sub-towers and main fortresses
      let hit = false;
      for (const target of this.fortresses.values()) {
        if (!target.alive || target.id === b.shooterId) continue;

        // 1. Check outer guard towers (sub-towers) first
        for (const st of target.subTowers) {
          if (!st.alive) continue;
          const dSub = Math.hypot(b.x - st.x, b.y - st.y);
          if (dSub < st.radius + b.radius) {
            hit = true;
            st.hp -= 1;
            this.audio.playExplosion();
            this.particles.addTrauma(0.15);
            this.particles.spawnExplosion(b.x, b.y, '#F59E0B', 16);

            const shooter = this.fortresses.get(b.shooterId);
            if (shooter) shooter.score += 50;

            if (st.hp <= 0) {
              st.alive = false;
              this.particles.spawnExplosion(st.x, st.y, '#EF4444', 32);
              this.particles.showFloatingText('GUARD TOWER DESTROYED!', st.x, st.y - 20, '#EF4444', 20);

              if (this.areSubTowersDown(target)) {
                this.audio.playFanfare();
                this.particles.addTrauma(0.3);
                this.particles.showFloatingText(
                  `⚡ ${this.players[target.id].name}'S SHIELD DOWN!`,
                  target.x,
                  target.y - 50,
                  '#38BDF8',
                  24
                );
              }
            } else {
              this.particles.showFloatingText(`GUARD TOWER HIT! [${st.hp}/${st.maxHp}]`, st.x, st.y - 18, '#F59E0B', 15);
            }
            break;
          }
        }

        if (hit) break;

        // 2. Check main fortress tower
        const dMain = Math.hypot(b.x - target.x, b.y - target.y);
        if (dMain < 36) {
          hit = true;

          // If outer guard towers are still standing, main fortress is completely shielded!
          if (!this.areSubTowersDown(target)) {
            this.audio.playBounce();
            this.particles.spawnSparks(b.x, b.y, '#38BDF8', 16);
            const remaining = this.getAliveSubTowersCount(target);
            this.particles.showFloatingText(
              `🛡️ SHIELDED! [${remaining} Guard Tower${remaining > 1 ? 's' : ''} Left]`,
              target.x,
              target.y - 30,
              '#38BDF8',
              16
            );
          } else {
            // Shield is down! Direct damage to main tower!
            target.hp -= 1;
            this.audio.playExplosion();
            this.particles.addTrauma(0.25);
            this.particles.spawnExplosion(b.x, b.y, '#F59E0B', 24);

            const shooter = this.fortresses.get(b.shooterId);
            if (shooter) shooter.score += 100;

            if (target.hp <= 0) {
              target.alive = false;
              this.destructionOrder.push(target.id);
              this.particles.spawnExplosion(target.x, target.y, '#EF4444', 50);
              this.particles.showFloatingText('MAIN FORTRESS DESTROYED!', target.x, target.y, '#EF4444', 24);
            } else {
              this.particles.showFloatingText(`DIRECT HIT! [${target.hp}/${target.maxHp} HP]`, target.x, target.y - 25, '#EF4444', 18);
            }
          }
          break;
        }
      }

      if (hit) {
        this.cannonballs.splice(i, 1);
      }
    }

    // Check round over condition
    const aliveForts = Array.from(this.fortresses.values()).filter((f) => f.alive);
    if (aliveForts.length <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private fireCannon(f: FortressTower) {
    f.reloadTimer = f.reloadTime;

    const speed = 480;
    const barrelLength = 34;
    const spawnX = f.x + Math.cos(f.cannonAngle) * barrelLength;
    const spawnY = f.y + Math.sin(f.cannonAngle) * barrelLength;

    this.cannonballs.push({
      id: ++this.ballIdCounter,
      shooterId: f.id,
      x: spawnX,
      y: spawnY,
      vx: Math.cos(f.cannonAngle) * speed,
      vy: Math.sin(f.cannonAngle) * speed,
      radius: 6.5,
      life: 2.5
    });

    this.audio.playLaser();
    this.particles.spawnSparks(spawnX, spawnY, '#F59E0B', 8);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const f = this.fortresses.get(botId);
    if (!f || !f.alive || f.reloadTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Collect all valid targets across all alive enemies:
    // If an enemy has alive sub-towers, target those sub-towers!
    // Once an enemy's outer towers are down, target their vulnerable main tower!
    const enemyTargets: { x: number; y: number; isMain: boolean; name: string }[] = [];
    for (const other of this.fortresses.values()) {
      if (other.id === botId || !other.alive) continue;

      if (!this.areSubTowersDown(other)) {
        for (const st of other.subTowers) {
          if (st.alive) {
            enemyTargets.push({ x: st.x, y: st.y, isMain: false, name: st.name });
          }
        }
      } else {
        enemyTargets.push({ x: other.x, y: other.y, isMain: true, name: 'Main Tower' });
      }
    }

    if (enemyTargets.length === 0) return;

    let shouldFire = false;
    const tolerance = difficulty === 'bot_hard' ? 0.09 : difficulty === 'bot_normal' ? 0.16 : 0.28;

    for (const target of enemyTargets) {
      const angleToTarget = Math.atan2(target.y - f.y, target.x - f.x);
      let diff = angleToTarget - f.cannonAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) <= tolerance) {
        const fireChance = difficulty === 'bot_hard' ? 0.96 : difficulty === 'bot_normal' ? 0.72 : 0.45;
        if (Math.random() < fireChance) {
          shouldFire = true;
          break;
        }
      }
    }

    this.input.setBotInput(botId, shouldFire, 0, 0, false);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.fortresses.values()).sort((a, b) => {
      const aliveA = a.alive ? 1 : 0;
      const aliveB = b.alive ? 1 : 0;
      if (aliveA !== aliveB) return aliveB - aliveA;
      if (a.hp !== b.hp) return b.hp - a.hp;
      const aSubs = this.getAliveSubTowersCount(a);
      const bSubs = this.getAliveSubTowersCount(b);
      if (aSubs !== bSubs) return bSubs - aSubs;
      return b.score - a.score;
    });

    const winnerId = sorted.length > 0 && sorted[0].alive ? sorted[0].id : null;

    return {
      winnerId,
      rankings: sorted.map((f, idx) => ({
        playerId: f.id,
        score: f.score + f.hp * 50 + this.getAliveSubTowersCount(f) * 25,
        place: idx + 1
      })),
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} demolished all enemy bastions & main towers!`
          : 'THE FORTRESSES WERE REDUCED TO ASHES IN A DRAW!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Stone Cobblestone Battlefield Background
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, width, height);

    // Stone tile grid lines
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Render Defensive Curtain Walls connecting Main Fortress to Sub Towers
    for (const f of this.fortresses.values()) {
      for (const st of f.subTowers) {
        ctx.save();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(st.x, st.y);
        ctx.stroke();

        ctx.strokeStyle = st.alive && f.alive ? '#334155' : '#1E293B';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(st.x, st.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Render Fortresses & Sub Towers
    for (const f of this.fortresses.values()) {
      const pColor = this.players[f.id]?.color || '#FFFFFF';

      // 1. Render Sub Towers (Outer Guard Bastions)
      for (const st of f.subTowers) {
        ctx.save();
        if (!st.alive) {
          // Crumbled stone ruins
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(st.x, st.y, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#64748B';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('RUINS', st.x, st.y + 3);
          ctx.restore();
          continue;
        }

        // Outer stone bastion wall
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Inner fortification rim
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.radius - 5, 0, Math.PI * 2);
        ctx.fill();

        // Center stone lookout dome
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(st.x, st.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 4 stone battlements / crenels around rim
        for (let b = 0; b < 4; b++) {
          const bAngle = (b / 4) * Math.PI * 2;
          const bx = st.x + Math.cos(bAngle) * (st.radius - 2);
          const by = st.y + Math.sin(bAngle) * (st.radius - 2);
          ctx.fillStyle = pColor;
          ctx.fillRect(bx - 3, by - 3, 6, 6);
        }

        // Sub-tower HP pips
        for (let h = 0; h < st.maxHp; h++) {
          const pipW = 8;
          const pipSpacing = 10;
          const startX = st.x - ((st.maxHp - 1) * pipSpacing) / 2;
          const pipX = startX + h * pipSpacing;
          const isFilled = h < st.hp;
          ctx.fillStyle = isFilled ? '#22C55E' : '#EF4444';
          ctx.fillRect(pipX - pipW / 2, st.y + st.radius + 5, pipW, 4);
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(pipX - pipW / 2, st.y + st.radius + 5, pipW, 4);
        }

        // Tower badge label
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GUARD TOWER', st.x, st.y - st.radius - 4);

        ctx.restore();
      }

      // 2. Render Main Fortress
      ctx.save();
      if (!f.alive) {
        // Destroyed ruins
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(f.x, f.y, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FORTRESS RUINS', f.x, f.y + 4);
        ctx.restore();
        continue;
      }

      // Fortress Outer Stone Wall
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Destructible brick crenellations (equal to remaining HP)
      const crenelCount = f.maxHp;
      for (let i = 0; i < crenelCount; i++) {
        const cAngle = (i / crenelCount) * Math.PI * 2;
        const cx = f.x + Math.cos(cAngle) * 28;
        const cy = f.y + Math.sin(cAngle) * 28;
        ctx.fillStyle = i < f.hp ? pColor : '#475569';
        ctx.fillRect(cx - 5, cy - 5, 10, 10);
      }

      // Rotating Heavy Iron Cannon (Only Main Tower has a cannon!)
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.cannonAngle);

      // Cannon Barrel
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, -6, 34, 12);
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, -4, 32, 8);

      // Muzzle rim
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(30, -8, 6, 16);

      ctx.restore();

      // Cannon Turret Pivot Base
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 14, 0, Math.PI * 2);
      ctx.fill();

      // Mascot Commander Hatch
      const mood: CharacterMood = !f.alive ? 'shocked' : f.hp === 1 ? 'shocked' : 'focused';
      this.drawPlayerMascot(ctx, f.id, f.x, f.y, 10, mood, performance.now() * 0.001);

      // Reload Indicator Ring
      if (f.reloadTimer > 0) {
        const reloadRatio = 1 - f.reloadTimer / f.reloadTime;
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 18, 0, Math.PI * 2 * reloadRatio);
        ctx.stroke();
      }

      // Main Fortress HP Hearts / Pips
      for (let h = 0; h < f.maxHp; h++) {
        const pipX = f.x - (f.maxHp - 1) * 8 + h * 16;
        ctx.fillStyle = h < f.hp ? '#22C55E' : '#EF4444';
        ctx.fillRect(pipX - 5, f.y + 42, 10, 5);
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(pipX - 5, f.y + 42, 10, 5);
      }

      // Player Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.players[f.id].name, f.x, f.y - 44);

      // Main Tower Forcefield / Shield or Vulnerable Indicator
      const isShielded = !this.areSubTowersDown(f);
      if (isShielded) {
        const pulse = Math.sin(performance.now() * 0.006 + f.id * 2) * 0.15 + 0.35;

        // Translucent energy dome
        ctx.fillStyle = `rgba(56, 189, 248, ${pulse * 0.25})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 44, 0, Math.PI * 2);
        ctx.fill();

        // Rotating dashed energy shield border
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.setLineDash([10, 6]);
        ctx.lineDashOffset = -performance.now() * 0.02;
        ctx.arc(f.x, f.y, 44, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Shield Badge
        const aliveSubs = this.getAliveSubTowersCount(f);
        const badgeW = 96;
        const badgeH = 18;
        const badgeX = f.x - badgeW / 2;
        const badgeY = f.y - 68;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
        else ctx.rect(badgeX, badgeY, badgeW, badgeH);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#38BDF8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🛡️ SHIELDED (${aliveSubs}/2)`, f.x, badgeY + badgeH / 2);
      } else {
        // Exposed / Vulnerable Warning Halo
        const pulse = Math.sin(performance.now() * 0.01) * 0.2 + 0.8;
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(f.x, f.y, 44, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Exposed badge
        const badgeW = 86;
        const badgeH = 18;
        const badgeX = f.x - badgeW / 2;
        const badgeY = f.y - 68;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
        else ctx.rect(badgeX, badgeY, badgeW, badgeH);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#EF4444';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`⚠️ VULNERABLE`, f.x, badgeY + badgeH / 2);
      }

      ctx.restore();
    }

    // Render Cannonballs
    for (const b of this.cannonballs) {
      ctx.save();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Metallic highlight
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(b.x - 2, b.y - 2, b.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }
}
