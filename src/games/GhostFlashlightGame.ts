import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface MansionPlayer {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  speed: number;
  isGhost: boolean;
  timeAsGhost: number;
  flashlightTimer: number; // >0 means light beam active
  flashlightCooldown: number;
  revealedTimer: number; // Visible to everyone
  immunityTimer: number; // Invulnerability to immediate tag-back
  alive: boolean;
}

export class GhostFlashlightGame extends BaseGame {
  private mPlayers: Map<PlayerId, MansionPlayer> = new Map();
  private arenaBounds = { x: 50, y: 50, w: 800, h: 500 };
  private creakyFloorboards: { x: number; y: number; w: number; h: number }[] = [];

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 50;
    this.isFinished = false;
    this.mPlayers.clear();

    const marginX = Math.max(35, width * 0.08);
    const marginY = Math.max(35, height * 0.08);
    this.arenaBounds = {
      x: marginX,
      y: marginY,
      w: width - marginX * 2,
      h: height - marginY * 2
    };

    const cx = this.arenaBounds.x + this.arenaBounds.w / 2;
    const cy = this.arenaBounds.y + this.arenaBounds.h / 2;

    // Procedural Mansion Floorboards & Danger Zones
    this.generateRandomMap(cx, cy, this.arenaBounds.w, this.arenaBounds.h);

    const active = this.getActivePlayers();
    // Player 0 or random starts as the Ghost
    const initialGhostId = active[Math.floor(Math.random() * active.length)].id;

    active.forEach((p, idx) => {
      const angle = (Math.PI * 2 * idx) / active.length;
      const dist = Math.min(this.arenaBounds.w, this.arenaBounds.h) * 0.35;
      this.mPlayers.set(p.id, {
        id: p.id,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        angle: angle + Math.PI,
        speed: 0,
        isGhost: p.id === initialGhostId,
        timeAsGhost: 0,
        flashlightTimer: 0,
        flashlightCooldown: 0,
        revealedTimer: 2.0, // briefly visible at start
        immunityTimer: 0,
        alive: true
      });
    });
  }

  public currentMapName: string = 'Haunted Crypt';

  private generateRandomMap(cx: number, cy: number, aw: number, ah: number): void {
    const archetypes = ['Haunted Crypt', 'Attic Crossroad', 'Narrow Parlor', 'Scattered Creaks'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.creakyFloorboards = [];

    switch (this.currentMapName) {
      case 'Haunted Crypt':
        this.creakyFloorboards = [
          { x: cx - 120, y: cy - 70, w: 75, h: 55 },
          { x: cx + 55, y: cy + 40, w: 75, h: 55 },
          { x: cx - 60, y: cy + 90, w: 85, h: 45 },
          { x: cx + 70, y: cy - 90, w: 65, h: 50 },
          { x: cx - 110, y: cy + 30, w: 60, h: 50 }
        ];
        break;

      case 'Attic Crossroad':
        // Plus-shaped floorboard traps crossing center
        this.creakyFloorboards = [
          { x: cx - 35, y: cy - ah * 0.35, w: 70, h: ah * 0.22 },
          { x: cx - 35, y: cy + ah * 0.13, w: 70, h: ah * 0.22 },
          { x: cx - aw * 0.35, y: cy - 25, w: aw * 0.22, h: 50 },
          { x: cx + aw * 0.13, y: cy - 25, w: aw * 0.22, h: 50 }
        ];
        break;

      case 'Narrow Parlor':
        // Perimeter ring of creaky floorboards with open center
        this.creakyFloorboards = [
          { x: cx - aw * 0.32, y: cy - ah * 0.30, w: 90, h: 50 },
          { x: cx + aw * 0.16, y: cy - ah * 0.30, w: 90, h: 50 },
          { x: cx - aw * 0.32, y: cy + ah * 0.22, w: 90, h: 50 },
          { x: cx + aw * 0.16, y: cy + ah * 0.22, w: 90, h: 50 },
          { x: cx - 40, y: cy - 25, w: 80, h: 50 }
        ];
        break;

      case 'Scattered Creaks':
      default:
        // 6 procedurally placed noisy floorboard traps
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.4;
          const dist = (0.2 + (i % 3) * 0.08) * Math.min(aw, ah);
          this.creakyFloorboards.push({
            x: cx + Math.cos(ang) * dist - 35,
            y: cy + Math.sin(ang) * dist - 25,
            w: 65 + (i % 2) * 20,
            h: 45 + (i % 3) * 10
          });
        }
        break;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    for (const mp of this.mPlayers.values()) {
      if (mp.isGhost) {
        mp.timeAsGhost += dt;
      }

      if (mp.flashlightCooldown > 0) mp.flashlightCooldown -= dt;
      if (mp.flashlightTimer > 0) mp.flashlightTimer -= dt;
      if (mp.revealedTimer > 0) mp.revealedTimer -= dt;
      if (mp.immunityTimer > 0) mp.immunityTimer -= dt;

      const isPressed = this.input.isPressed(mp.id);
      const justPressed = this.input.justPressed(mp.id);
      const steer = this.input.getSteer(mp.id);
      const throttle = this.input.getThrottle(mp.id);
      const action = this.input.isActionPressed(mp.id);

      // Flashlight trigger on action or crisp tap
      if ((action || justPressed) && !mp.isGhost && mp.flashlightCooldown <= 0) {
        mp.flashlightTimer = 0.6;
        mp.flashlightCooldown = 1.2;
        this.audio.playTap();
      }

      // Smooth direct directional movement
      const topSpeed = mp.isGhost ? 240 : 185;
      if (steer !== 0 || throttle !== 0) {
        // throttle > 0 is up (negative Y)
        mp.angle = Math.atan2(-throttle, steer);
        mp.speed = Math.min(topSpeed, mp.speed + 500 * dt);
      } else if (isPressed) {
        mp.speed = Math.min(topSpeed, mp.speed + 400 * dt);
      } else {
        mp.speed *= Math.pow(0.75, dt * 60);
      }

      // Move player
      const nx = mp.x + Math.cos(mp.angle) * mp.speed * dt;
      const ny = mp.y + Math.sin(mp.angle) * mp.speed * dt;

      const radius = 18;
      if (nx - radius >= this.arenaBounds.x && nx + radius <= this.arenaBounds.x + this.arenaBounds.w) {
        mp.x = nx;
      }
      if (ny - radius >= this.arenaBounds.y && ny + radius <= this.arenaBounds.y + this.arenaBounds.h) {
        mp.y = ny;
      }

      // Step on creaky floorboards
      for (const cf of this.creakyFloorboards) {
        if (mp.x >= cf.x && mp.x <= cf.x + cf.w && mp.y >= cf.y && mp.y <= cf.y + cf.h) {
          mp.revealedTimer = 0.8;
          if (Math.random() < 0.2) {
            this.audio.playTap();
            this.particles.showFloatingText('CREAK!', mp.x, mp.y - 15, '#F59E0B', 14);
          }
        }
      }
    }

    // Flashlight cone revealing check
    for (const hunter of this.mPlayers.values()) {
      if (hunter.flashlightTimer > 0) {
        for (const target of this.mPlayers.values()) {
          if (target.id === hunter.id) continue;
          const d = Math.hypot(target.x - hunter.x, target.y - hunter.y);
          if (d < 160) {
            const angleToTarget = Math.atan2(target.y - hunter.y, target.x - hunter.x);
            let diff = angleToTarget - hunter.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) < 0.5) {
              target.revealedTimer = 0.5;
            }
          }
        }
      }
    }

    // Ghost tag collision
    const ghost = Array.from(this.mPlayers.values()).find((p) => p.isGhost);
    if (ghost) {
      for (const human of this.mPlayers.values()) {
        if (!human.isGhost && human.immunityTimer <= 0 && Math.hypot(human.x - ghost.x, human.y - ghost.y) < 32) {
          // Curse transfer!
          ghost.isGhost = false;
          ghost.immunityTimer = 1.2; // Immunity from instant tag-back!
          human.isGhost = true;
          human.immunityTimer = 0;
          human.revealedTimer = 1.2;
          ghost.revealedTimer = 1.2;

          this.audio.playGhostTag();
          this.particles.addTrauma(0.4);
          this.particles.spawnExplosion(human.x, human.y, '#A855F7', 35);
          this.particles.showFloatingText('TAGGED! CURSED!', human.x, human.y - 25, '#C084FC', 24);
          break;
        }
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
    const me = this.mPlayers.get(botId);
    if (!me) return;

    if (me.isGhost) {
      // Find human targets: prioritize revealed humans or those within hearing radius
      const hearingRadius = difficulty === 'bot_hard' ? 260 : difficulty === 'bot_normal' ? 180 : 120;
      let target: MansionPlayer | null = null;
      let minD = Infinity;

      for (const other of this.mPlayers.values()) {
        if (!other.isGhost) {
          const d = Math.hypot(other.x - me.x, other.y - me.y);
          // Target if revealed, or within hearing radius, or hard bot tracking
          const canSense = other.revealedTimer > 0 || d < hearingRadius || difficulty === 'bot_hard';
          if (canSense && d < minD) {
            minD = d;
            target = other;
          }
        }
      }

      if (target) {
        // Chase target
        const dx = target.x - me.x;
        const dy = target.y - me.y;
        const mag = Math.hypot(dx, dy) || 1;
        const steer = dx / mag;
        const throttle = -dy / mag; // Negative Y is up
        this.input.setBotInput(botId, true, steer, throttle, false);
      } else {
        // Ambient patrol around center
        const cx = width / 2;
        const cy = height / 2;
        const patrolDx = cx - me.x + Math.sin(this.roundTimer * 2) * 120;
        const patrolDy = cy - me.y + Math.cos(this.roundTimer * 2) * 120;
        const mag = Math.hypot(patrolDx, patrolDy) || 1;
        this.input.setBotInput(botId, true, patrolDx / mag, -patrolDy / mag, false);
      }
    } else {
      // Human runner: flee from ghost and strategically pulse flashlight
      const ghost = Array.from(this.mPlayers.values()).find((p) => p.isGhost);
      if (ghost) {
        const distToGhost = Math.hypot(ghost.x - me.x, ghost.y - me.y);
        let fleeDx = me.x - ghost.x;
        let fleeDy = me.y - ghost.y;

        // Wall repulsion to prevent getting trapped in corners
        const margin = 60;
        if (me.x < this.arenaBounds.x + margin) fleeDx += 120;
        if (me.x > this.arenaBounds.x + this.arenaBounds.w - margin) fleeDx -= 120;
        if (me.y < this.arenaBounds.y + margin) fleeDy += 120;
        if (me.y > this.arenaBounds.y + this.arenaBounds.h - margin) fleeDy -= 120;

        const mag = Math.hypot(fleeDx, fleeDy) || 1;
        const steer = fleeDx / mag;
        const throttle = -fleeDy / mag;

        // Flashlight defense: if ghost is nearby and within forward cone, flash to reveal/slow
        let useFlashlight = false;
        if (distToGhost < 160 && me.flashlightCooldown <= 0) {
          const angleToGhost = Math.atan2(ghost.y - me.y, ghost.x - me.x);
          let diff = angleToGhost - me.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) < 0.8) {
            useFlashlight = true;
          }
        }

        this.input.setBotInput(botId, true, steer, throttle, useFlashlight);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Haunted Victorian Mansion Parquet Floor
    ctx.fillStyle = '#0F0D15';
    ctx.fillRect(0, 0, width, height);

    // Weathered floorboard planks across the arena
    const plankH = 28;
    const b = this.arenaBounds;
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();

    for (let py = b.y; py < b.y + b.h; py += plankH) {
      const isOdd = Math.floor(py / plankH) % 2 === 1;
      ctx.fillStyle = isOdd ? '#1A1622' : '#14111C';
      ctx.fillRect(b.x, py, b.w, plankH - 2);

      // Plank vertical seams
      ctx.strokeStyle = '#09080E';
      ctx.lineWidth = 1.5;
      for (let px = b.x + (isOdd ? 60 : 0); px < b.x + b.w; px += 120) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + plankH - 2);
        ctx.stroke();
      }
    }

    // Creaky Floorboard Traps (Highlighted with weathered oak & nail rivets)
    for (const cf of this.creakyFloorboards) {
      ctx.fillStyle = '#2A1F18';
      ctx.fillRect(cf.x, cf.y, cf.w, cf.h);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cf.x, cf.y, cf.w, cf.h);

      // Rusted nail rivets at corners
      ctx.fillStyle = '#78350F';
      ctx.fillRect(cf.x + 3, cf.y + 3, 3, 3);
      ctx.fillRect(cf.x + cf.w - 6, cf.y + 3, 3, 3);
      ctx.fillRect(cf.x + 3, cf.y + cf.h - 6, 3, 3);
      ctx.fillRect(cf.x + cf.w - 6, cf.y + cf.h - 6, 3, 3);
    }
    ctx.restore();

    // Mansion Stone Perimeter Walls
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    ctx.strokeRect(this.arenaBounds.x, this.arenaBounds.y, this.arenaBounds.w, this.arenaBounds.h);

    // 2. Volumetric Flashlight Cones
    for (const mp of this.mPlayers.values()) {
      if (mp.flashlightTimer > 0) {
        ctx.save();
        ctx.translate(mp.x, mp.y);
        ctx.rotate(mp.angle);

        // Flashlight beam radial gradient (intense center, soft edge drop-off)
        const coneGrad = ctx.createRadialGradient(0, 0, 15, 0, 0, 180);
        coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
        coneGrad.addColorStop(0.4, 'rgba(253, 224, 71, 0.45)');
        coneGrad.addColorStop(0.8, 'rgba(250, 204, 21, 0.15)');
        coneGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');

        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 180, -0.42, 0.42);
        ctx.closePath();
        ctx.fill();

        // Flashlight bright core beam line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(170, 0);
        ctx.stroke();

        ctx.restore();
      }
    }

    // 3. Draw Players (Investigators vs. Eerie Spectral Ghost)
    const now = performance.now();
    for (const mp of this.mPlayers.values()) {
      const p = this.players[mp.id];
      const isVisible = mp.isGhost || mp.revealedTimer > 0 || mp.flashlightTimer > 0;

      ctx.save();
      ctx.translate(mp.x, mp.y);
      ctx.rotate(mp.angle);

      if (mp.isGhost) {
        // Ethereal floating ghost
        const floatY = Math.sin(now * 0.006) * 3;
        const pulse = (Math.sin(now * 0.008) + 1) * 3;

        // Violet ectoplasm aura
        ctx.shadowColor = '#C084FC';
        ctx.shadowBlur = 24;
        ctx.fillStyle = 'rgba(168, 85, 247, 0.35)';
        ctx.beginPath();
        ctx.arc(0, floatY, 26 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // Ghost body silhouette with undulating ripples
        ctx.fillStyle = '#E9D5FF';
        ctx.beginPath();
        ctx.arc(0, floatY, 17, Math.PI, 0, false);
        // Ghost trailing skirt
        ctx.lineTo(17, floatY + 16);
        ctx.lineTo(10, floatY + 11);
        ctx.lineTo(0, floatY + 16);
        ctx.lineTo(-10, floatY + 11);
        ctx.lineTo(-17, floatY + 16);
        ctx.closePath();
        ctx.fill();

        // Big dark haunted eyes
        ctx.fillStyle = '#3B0764';
        ctx.beginPath();
        ctx.ellipse(5, floatY - 2, 3, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(11, floatY - 2, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // O-shaped mouth
        ctx.beginPath();
        ctx.ellipse(8, floatY + 6, 2.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Human Investigator Mascot
        ctx.globalAlpha = isVisible ? 1.0 : 0.2;
        this.drawPlayerMascot(ctx, mp.id, 0, 0, 14, mp.flashlightTimer > 0 ? 'focused' : 'idle', now * 0.001);

        // Flashlight cylinder in hand
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(10, -4, 10, 8);
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(18, -5, 3, 10);
      }

      ctx.restore();

      // Ghost status indicator pill
      if (mp.isGhost) {
        ctx.save();
        const pillY = mp.y - 32;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(mp.x - 48, pillY - 10, 96, 20, 10);
        else ctx.rect(mp.x - 48, pillY - 10, 96, 20);
        ctx.fill();
        ctx.strokeStyle = '#C084FC';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#E9D5FF';
        ctx.font = '800 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`GHOST (${Math.floor(mp.timeAsGhost)}s)`, mp.x, pillY);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    // Player who spent LEAST time as ghost wins!
    const list = Array.from(this.mPlayers.values()).sort((a, b) => a.timeAsGhost - b.timeAsGhost);
    const winnerId = list.length > 0 ? list[0].id : null;
    return {
      winnerId,
      rankings: list.map((mp, idx) => ({ playerId: mp.id, score: Math.max(0, 40 - Math.floor(mp.timeAsGhost)), place: idx + 1 })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} eluded the spectral curse!` : 'Mansion conquered!'
    };
  }
}
