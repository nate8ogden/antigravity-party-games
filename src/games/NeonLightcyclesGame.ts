import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface TrailPoint {
  x: number;
  y: number;
}

interface Lightcycle {
  id: PlayerId;
  x: number;
  y: number;
  dirIndex: number; // 0: Right, 1: Down, 2: Left, 3: Up
  speed: number;
  alive: boolean;
  trail: TrailPoint[];
  boostTimer: number;
  turnCooldown: number;
}

interface PowerPickup {
  id: number;
  type: 'boost' | 'eraser';
  x: number;
  y: number;
}

const DIRS = [
  { dx: 1, dy: 0 },  // 0: Right
  { dx: 0, dy: 1 },  // 1: Down
  { dx: -1, dy: 0 }, // 2: Left
  { dx: 0, dy: -1 }  // 3: Up
];

export class NeonLightcyclesGame extends BaseGame {
  private cycles: Map<PlayerId, Lightcycle> = new Map();
  private pickups: PowerPickup[] = [];
  private arenaBounds = { x: 70, y: 70, w: 0, h: 0 };
  private pickupCooldown: number = 2.0;
  private botLookaheadCooldowns: Map<PlayerId, number> = new Map();
  private barriers: { x: number; y: number; w: number; h: number }[] = [];
  public currentMapName: string = 'Quad Pillars';

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.cycles.clear();
    this.pickups = [];
    this.botLookaheadCooldowns.clear();
    this.pickupCooldown = 2.5;

    this.arenaBounds = {
      x: 75,
      y: 75,
      w: width - 150,
      h: height - 150
    };

    // Procedural Cyber Grid Barrier Map Generation
    this.generateRandomMap(width / 2, height / 2, this.arenaBounds.w, this.arenaBounds.h);

    const active = this.getActivePlayers();
    const count = active.length;

    // Place cycles in corners or edges facing inwards
    active.forEach((p, idx) => {
      let startX = this.arenaBounds.x + 80;
      let startY = this.arenaBounds.y + 80;
      let startDir = 0; // Right

      if (idx === 1) {
        startX = this.arenaBounds.x + this.arenaBounds.w - 80;
        startY = this.arenaBounds.y + 80;
        startDir = 1; // Down
      } else if (idx === 2) {
        startX = this.arenaBounds.x + 80;
        startY = this.arenaBounds.y + this.arenaBounds.h - 80;
        startDir = 3; // Up
      } else if (idx === 3) {
        startX = this.arenaBounds.x + this.arenaBounds.w - 80;
        startY = this.arenaBounds.y + this.arenaBounds.h - 80;
        startDir = 2; // Left
      }

      this.cycles.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        dirIndex: startDir,
        speed: 175,
        alive: true,
        trail: [{ x: startX, y: startY }],
        boostTimer: 0,
        turnCooldown: 0
      });
    });

    // Spawn 1 initial boost pickup
    this.pickups.push({
      id: 1,
      type: 'boost',
      x: width / 2,
      y: height / 2
    });
  }

  private generateRandomMap(cx: number, cy: number, bw: number, bh: number): void {
    const archetypes = ['Quad Pillars', 'Cyber Diamond', 'Slalom Gates', 'Open Circuit'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.barriers = [];

    switch (this.currentMapName) {
      case 'Quad Pillars':
        // 4 neon pillars in quadrants (leaving central and perimeter corridors open)
        const pw = 40;
        const ph = 40;
        this.barriers.push(
          { x: cx - bw * 0.25 - pw / 2, y: cy - bh * 0.25 - ph / 2, w: pw, h: ph },
          { x: cx + bw * 0.25 - pw / 2, y: cy - bh * 0.25 - ph / 2, w: pw, h: ph },
          { x: cx - bw * 0.25 - pw / 2, y: cy + bh * 0.25 - ph / 2, w: pw, h: ph },
          { x: cx + bw * 0.25 - pw / 2, y: cy + bh * 0.25 - ph / 2, w: pw, h: ph }
        );
        break;

      case 'Cyber Diamond':
        // Angled inner square diamond
        const dw = 35;
        this.barriers.push(
          { x: cx - dw / 2, y: cy - bh * 0.22 - dw / 2, w: dw, h: dw },
          { x: cx - dw / 2, y: cy + bh * 0.22 - dw / 2, w: dw, h: dw },
          { x: cx - bw * 0.22 - dw / 2, y: cy - dw / 2, w: dw, h: dw },
          { x: cx + bw * 0.22 - dw / 2, y: cy - dw / 2, w: dw, h: dw }
        );
        break;

      case 'Slalom Gates':
        // 2 horizontal dividers with central chicane gap
        const gw = bw * 0.26;
        const gh = 18;
        this.barriers.push(
          { x: cx - bw * 0.35, y: cy - bh * 0.16, w: gw, h: gh },
          { x: cx + bw * 0.35 - gw, y: cy + bh * 0.16, w: gw, h: gh }
        );
        break;

      case 'Open Circuit':
      default:
        // Clear open arena
        break;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Spawn Pickups
    this.pickupCooldown -= dt;
    if (this.pickupCooldown <= 0 && this.pickups.length < 3) {
      this.pickupCooldown = 4.0 + Math.random() * 3.0;
      const type = Math.random() < 0.6 ? 'boost' : 'eraser';
      const margin = 60;
      this.pickups.push({
        id: performance.now(),
        type,
        x: this.arenaBounds.x + margin + Math.random() * (this.arenaBounds.w - margin * 2),
        y: this.arenaBounds.y + margin + Math.random() * (this.arenaBounds.h - margin * 2)
      });
    }

    // Sudden Death Watchdog & Arena Compression
    this.updateStagnationWatchdog(dt);
    if (this.roundTimer <= 20) {
      // Contract arena bounds slightly during final countdown
      const shrinkRate = 2.0 * dt;
      this.arenaBounds.x += shrinkRate;
      this.arenaBounds.y += shrinkRate;
      this.arenaBounds.w = Math.max(200, this.arenaBounds.w - shrinkRate * 2);
      this.arenaBounds.h = Math.max(200, this.arenaBounds.h - shrinkRate * 2);
    }

    // Update Cycles
    for (const c of this.cycles.values()) {
      if (!c.alive) continue;

      if (c.turnCooldown > 0) c.turnCooldown -= dt;
      if (c.boostTimer > 0) c.boostTimer -= dt;

      // Handle 1-Button 90-degree clockwise turn
      const turnPressed = this.input.justPressed(c.id);
      if (turnPressed && c.turnCooldown <= 0) {
        c.dirIndex = (c.dirIndex + 1) % 4; // Turn 90 deg clockwise
        c.turnCooldown = 0.12; // debounce
        c.trail.push({ x: c.x, y: c.y });
        this.audio.playTap();
      }

      // Universal Anti-Loop Detection: prevent cycling in endless tight boxes
      this.trackAntiLoop(c.id, c.x, c.y, c.dirIndex * (Math.PI / 2), dt, 80, () => {
        c.boostTimer = 2.0;
        this.particles.showFloatingText('⚡ TURBO BREAKOUT!', c.x, c.y - 25, '#38BDF8', 18);
        this.particles.spawnSparks(c.x, c.y, '#38BDF8', 10);
        this.audio.playBoost();
      });

      // Move forward with progressive speed ramp (+15% every 15s to tighten matches)
      const speedRamp = 1.0 + Math.min(0.6, (60 - this.roundTimer) * 0.01);
      const currentSpeed = (c.boostTimer > 0 ? c.speed * 1.55 : c.speed) * speedRamp;
      const dir = DIRS[c.dirIndex];
      const prevX = c.x;
      const prevY = c.y;

      c.x += dir.dx * currentSpeed * dt;
      c.y += dir.dy * currentSpeed * dt;

      // Update current trail segment tip
      const lastPoint = c.trail[c.trail.length - 1];
      if (lastPoint) {
        lastPoint.x = c.x;
        lastPoint.y = c.y;
      }

      // Boundary collision check
      const b = this.arenaBounds;
      if (c.x < b.x || c.x > b.x + b.w || c.y < b.y || c.y > b.y + b.h) {
        this.eliminateCycle(c);
        continue;
      }

      // Internal Cyber Barrier collision check
      let hitBarrier = false;
      for (const bar of this.barriers) {
        if (c.x >= bar.x && c.x <= bar.x + bar.w && c.y >= bar.y && c.y <= bar.y + bar.h) {
          hitBarrier = true;
          break;
        }
      }
      if (hitBarrier) {
        this.eliminateCycle(c);
        continue;
      }

      // Trail collision check against all cycles
      if (this.checkTrailCollision(c)) {
        this.eliminateCycle(c);
        continue;
      }

      // Pickup collection check
      for (let pi = this.pickups.length - 1; pi >= 0; pi--) {
        const pk = this.pickups[pi];
        if (Math.hypot(c.x - pk.x, c.y - pk.y) < 22) {
          if (pk.type === 'boost') {
            c.boostTimer = 2.5;
            this.audio.playLaser();
            this.particles.showFloatingText('SPEED SURGE! ⚡', c.x, c.y - 20, '#06B6D4', 20);
            this.particles.spawnSparks(pk.x, pk.y, '#06B6D4', 16);
          } else {
            // Trail Eraser: Erase trail within radius
            this.audio.playExplosion();
            this.particles.showFloatingText('TRAIL CLEARED! 💥', c.x, c.y - 20, '#F59E0B', 20);
            this.particles.spawnSparks(pk.x, pk.y, '#F59E0B', 24);
            this.eraseTrailsNear(pk.x, pk.y, 90);
          }
          this.pickups.splice(pi, 1);
        }
      }
    }

    // Check round over (1 or fewer cycles alive)
    const aliveCount = Array.from(this.cycles.values()).filter((c) => c.alive).length;
    if (aliveCount <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private eraseTrailsNear(cx: number, cy: number, radius: number): void {
    for (const c of this.cycles.values()) {
      c.trail = c.trail.filter((pt) => Math.hypot(pt.x - cx, pt.y - cy) > radius);
      if (c.trail.length === 0) {
        c.trail.push({ x: c.x, y: c.y });
      }
    }
  }

  private eliminateCycle(c: Lightcycle): void {
    c.alive = false;
    this.audio.playExplosion();
    this.particles.spawnSparks(c.x, c.y, this.players[c.id].color, 25);
    this.particles.addTrauma(0.3);
    this.particles.showFloatingText('CRASH! 💥', c.x, c.y - 24, '#EF4444', 22);
  }

  private checkTrailCollision(cycle: Lightcycle): boolean {
    const headX = cycle.x;
    const headY = cycle.y;
    const collisionThreshold = 6;

    for (const other of this.cycles.values()) {
      const trail = other.trail;
      // If checking against self, skip the most recent segment
      const maxIndex = other.id === cycle.id ? trail.length - 2 : trail.length - 1;

      for (let i = 0; i < maxIndex; i++) {
        const p1 = trail[i];
        const p2 = trail[i + 1];
        if (!p1 || !p2) continue;

        // Distance from point to line segment
        const dist = this.distToSegment(headX, headY, p1.x, p1.y, p2.x, p2.y);
        if (dist < collisionThreshold) {
          return true;
        }
      }
    }
    return false;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const c = this.cycles.get(botId);
    if (!c || !c.alive || c.turnCooldown > 0) return;

    // Raycast lookahead distance based on difficulty
    const lookaheadDist = difficulty === 'bot_hard' ? 65 : difficulty === 'bot_normal' ? 44 : 28;
    const currentDir = DIRS[c.dirIndex];

    // Check if path directly ahead is blocked
    const aheadX = c.x + currentDir.dx * lookaheadDist;
    const aheadY = c.y + currentDir.dy * lookaheadDist;

    const b = this.arenaBounds;
    const isWallAhead = aheadX < b.x || aheadX > b.x + b.w || aheadY < b.y || aheadY > b.y + b.h;
    const isTrailAhead = this.isLineBlocked(c.x, c.y, aheadX, aheadY, c.id);

    if (isWallAhead || isTrailAhead) {
      // Must turn!
      // In 1-button mode, a single tap turns 90 degrees clockwise (nextDir)
      const nextDirIndex = (c.dirIndex + 1) % 4;
      const nextDir = DIRS[nextDirIndex];
      const nextLookX = c.x + nextDir.dx * (lookaheadDist * 0.7);
      const nextLookY = c.y + nextDir.dy * (lookaheadDist * 0.7);

      const isNextWall = nextLookX < b.x || nextLookX > b.x + b.w || nextLookY < b.y || nextLookY > b.y + b.h;
      const isNextTrail = this.isLineBlocked(c.x, c.y, nextLookX, nextLookY, c.id);

      if (!isNextWall && !isNextTrail) {
        // Safe to turn!
        this.input.setBotInput(botId, true);
      } else {
        // Turning now would also hit an obstacle; double-tap to turn 180 or turn anyway
        this.input.setBotInput(botId, true);
      }
    } else {
      // Path ahead is clear
      // Occasionally turn toward center or pickups if playing on Hard
      if (difficulty === 'bot_hard' && Math.random() < 0.015) {
        const nextDirIndex = (c.dirIndex + 1) % 4;
        const nextDir = DIRS[nextDirIndex];
        const nextX = c.x + nextDir.dx * lookaheadDist;
        const nextY = c.y + nextDir.dy * lookaheadDist;
        if (!this.isLineBlocked(c.x, c.y, nextX, nextY, c.id)) {
          this.input.setBotInput(botId, true);
          return;
        }
      }
      this.input.setBotInput(botId, false);
    }
  }

  private isLineBlocked(x1: number, y1: number, x2: number, y2: number, selfId: PlayerId): boolean {
    const steps = 8;
    for (let s = 1; s <= steps; s++) {
      const px = x1 + (x2 - x1) * (s / steps);
      const py = y1 + (y2 - y1) * (s / steps);

      for (const bar of this.barriers) {
        if (px >= bar.x && px <= bar.x + bar.w && py >= bar.y && py <= bar.y + bar.h) {
          return true;
        }
      }

      for (const other of this.cycles.values()) {
        const trail = other.trail;
        const maxIdx = other.id === selfId ? trail.length - 2 : trail.length - 1;
        for (let i = 0; i < maxIdx; i++) {
          const tp1 = trail[i];
          const tp2 = trail[i + 1];
          if (!tp1 || !tp2) continue;
          if (this.distToSegment(px, py, tp1.x, tp1.y, tp2.x, tp2.y) < 8) {
            return true;
          }
        }
      }
    }
    return false;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Cyberpunk Tron Digital Grid Floor
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, width, height);

    // Glowing cyan/dark-slate grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    const gridStep = 32;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Internal Cyber Grid Monoliths & Barriers
    for (const bar of this.barriers) {
      ctx.save();
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
      // Cyber circuit pattern inside
      ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.fillRect(bar.x + 4, bar.y + 4, bar.w - 8, bar.h - 8);
      ctx.restore();
    }

    // Outer Neon Perimeter Containment Barrier
    const b = this.arenaBounds;
    ctx.save();
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.restore();

    // Corner Energy Pylons
    const corners = [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x, b.y + b.h],
      [b.x + b.w, b.y + b.h]
    ];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Power Pickups
    for (const pk of this.pickups) {
      ctx.save();
      const isBoost = pk.type === 'boost';
      ctx.shadowColor = isBoost ? '#06B6D4' : '#F59E0B';
      ctx.shadowBlur = 16;
      ctx.fillStyle = isBoost ? '#0891B2' : '#D97706';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isBoost ? '⚡' : '💥', pk.x, pk.y);
      ctx.restore();
    }

    // 3. Render Solid Glowing Neon Light Trails
    for (const c of this.cycles.values()) {
      if (c.trail.length < 2) continue;
      const pColor = this.players[c.id]?.color || '#FFFFFF';

      ctx.save();
      // Outer neon trail glow
      ctx.shadowColor = pColor;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(c.trail[0].x, c.trail[0].y);
      for (let i = 1; i < c.trail.length; i++) {
        ctx.lineTo(c.trail[i].x, c.trail[i].y);
      }
      ctx.stroke();

      // Inner white core ribbon
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render Lightcycles
    for (const c of this.cycles.values()) {
      if (!c.alive) continue;
      const p = this.players[c.id];
      const pColor = p?.color || '#FFFFFF';

      ctx.save();
      ctx.translate(c.x, c.y);
      const angle = (c.dirIndex * Math.PI) / 2;
      ctx.rotate(angle);

      // Lightcycle Body (Sleek futuristic racer)
      ctx.shadowColor = pColor;
      ctx.shadowBlur = c.boostTimer > 0 ? 20 : 10;
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.roundRect(-14, -7, 28, 14, 4);
      ctx.fill();

      // Cockpit Glow Strip
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(-4, -3, 10, 6, 2);
      ctx.fill();

      // Front & Rear Hubless Wheels
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(8, -8, 5, 16);
      ctx.fillRect(-13, -8, 5, 16);

      // Boost Exhaust Flame
      if (c.boostTimer > 0) {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(-14, -4);
        ctx.lineTo(-24 - Math.random() * 6, 0);
        ctx.lineTo(-14, 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // Frosted Player Tag
      ctx.save();
      const tagY = c.y - 20;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(c.x - 30, tagY - 9, 60, 18, 9);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.name.toUpperCase(), c.x, tagY);
      ctx.restore();
    }

    // 5. Instruction Banner (Safely at y=56 below stopwatch timer)
    ctx.save();
    const pillW = 280;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    ctx.fill();
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#67E8F9';
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP TO TURN 90° • TRAP OPPONENTS IN TRAILS!', width / 2, pillY + pillH / 2);
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.cycles.values()).sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0));
    const winner = list.find((c) => c.alive);
    const winnerId = winner ? winner.id : null;
    return {
      winnerId,
      rankings: list.map((c, idx) => ({ playerId: c.id, score: c.alive ? 100 : 0, place: idx + 1 })),
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} out-maneuvered all rivals in the neon grid!`
          : 'Total lightcycle collision!'
    };
  }
}
