import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface ConveyorItem {
  id: number;
  x: number;
  y: number;
  type: 'burger' | 'pizza' | 'sushi' | 'pepper' | 'rotten';
  points: number;
  ownerId: PlayerId;
  flying: boolean;
  vx: number;
  vy: number;
  targetPlateIndex: number;
}

interface Plate {
  x: number;
  y: number;
  radius: number;
  angle: number;
  speed: number;
  multiplier: number;
}

interface ChefState {
  id: PlayerId;
  score: number;
  stunTimer: number;
  feverTimer: number;
  chargeProgress: number; // 0 to 1
  isCharging: boolean;
  readyItem: ConveyorItem | null;
}

export class KitchenChaosGame extends BaseGame {
  private chefs: Map<PlayerId, ChefState> = new Map();
  private conveyorItems: ConveyorItem[] = [];
  private plates: Plate[] = [];
  private nextItemId: number = 1;
  private spawnTimer: number = 0.8;

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 55;
    this.isFinished = false;
    this.chefs.clear();
    this.conveyorItems = [];
    this.plates = [];

    const cx = width / 2;
    const cy = height / 2;

    // Center rotating plates
    this.plates = [
      { x: cx, y: cy, radius: 36, angle: 0, speed: 1.2, multiplier: 2 },
      { x: cx - 90, y: cy, radius: 28, angle: Math.PI, speed: -1.5, multiplier: 1 },
      { x: cx + 90, y: cy, radius: 28, angle: 0, speed: 1.5, multiplier: 1 },
      { x: cx, y: cy - 80, radius: 28, angle: Math.PI / 2, speed: -1.8, multiplier: 1 },
      { x: cx, y: cy + 80, radius: 28, angle: -Math.PI / 2, speed: 1.8, multiplier: 1 }
    ];

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.chefs.set(p.id, {
        id: p.id,
        score: 0,
        stunTimer: 0,
        feverTimer: 0,
        chargeProgress: 0,
        isCharging: false,
        readyItem: null
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Rotate center plates
    for (const pl of this.plates) {
      pl.angle += pl.speed * dt;
    }

    // Spawn conveyor items
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.9;
      this.spawnFoodItem(width, height);
    }

    // Chef stations located at 4 edges/corners
    const active = this.getActivePlayers();
    for (const p of active) {
      const chef = this.chefs.get(p.id);
      if (!chef) continue;

      if (chef.stunTimer > 0) {
        chef.stunTimer -= dt;
        continue;
      }
      if (chef.feverTimer > 0) chef.feverTimer -= dt;

      const isPressed = this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Fling mechanic:
      // Hold -> charge fling launcher meter
      // Release -> launch current food toward center plate!
      if (isPressed) {
        chef.isCharging = true;
        chef.chargeProgress = (chef.chargeProgress + dt * 2.2) % 1.0;
      } else if (justReleased && chef.isCharging) {
        chef.isCharging = false;
        this.launchFood(chef, width, height);
        chef.chargeProgress = 0;
      }
    }

    // Update Flying & Conveyor Items
    const cx = width / 2;
    const cy = height / 2;
    for (let i = this.conveyorItems.length - 1; i >= 0; i--) {
      const item = this.conveyorItems[i];
      if (item.flying) {
        item.x += item.vx * dt * 60;
        item.y += item.vy * dt * 60;

        // Check if landed near center plates
        let landed = false;
        for (const pl of this.plates) {
          if (Math.hypot(item.x - pl.x, item.y - pl.y) < pl.radius + 12) {
            landed = true;
            const chef = this.chefs.get(item.ownerId);
            if (chef) {
              const feverMult = chef.feverTimer > 0 ? 2 : 1;
              if (item.type === 'rotten') {
                chef.score = Math.max(0, chef.score - 2);
                this.audio.playStun();
                this.particles.showFloatingText('-2 ROTTEN!', pl.x, pl.y, '#EF4444', 20);
                this.particles.spawnSparks(pl.x, pl.y, '#10B981', 15);
              } else if (item.type === 'pepper') {
                chef.feverTimer = 8;
                this.audio.playBoost();
                this.particles.showFloatingText('FEVER MODE 2X!', pl.x, pl.y, '#F59E0B', 24);
                this.particles.spawnExplosion(pl.x, pl.y, '#EF4444', 20);
              } else {
                const earned = item.points * pl.multiplier * feverMult;
                chef.score += earned;
                this.audio.playScore();
                this.particles.showFloatingText(`+${earned}!`, pl.x, pl.y, '#FBBF24', 22);
                this.particles.spawnSparks(pl.x, pl.y, '#F59E0B', 12);
              }
            }
            break;
          }
        }

        // Out of bounds
        if (landed || item.x < 0 || item.x > width || item.y < 0 || item.y > height) {
          this.conveyorItems.splice(i, 1);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnFoodItem(width: number, height: number) {
    const active = this.getActivePlayers();
    if (active.length === 0) return;
    const randomChef = active[Math.floor(Math.random() * active.length)];
    const chef = this.chefs.get(randomChef.id);
    if (!chef || chef.readyItem) return;

    const types: ('burger' | 'pizza' | 'sushi' | 'pepper' | 'rotten')[] = [
      'burger',
      'pizza',
      'sushi',
      'burger',
      'pepper',
      'rotten'
    ];
    const chosenType = types[Math.floor(Math.random() * types.length)];
    const pointsMap = { burger: 2, pizza: 3, sushi: 4, pepper: 1, rotten: -2 };

    chef.readyItem = {
      id: this.nextItemId++,
      x: 0,
      y: 0,
      type: chosenType,
      points: pointsMap[chosenType],
      ownerId: chef.id,
      flying: false,
      vx: 0,
      vy: 0,
      targetPlateIndex: 0
    };
  }

  private launchFood(chef: ChefState, width: number, height: number) {
    if (!chef.readyItem) return;

    const station = this.getChefStation(chef.id, width, height);
    const item = chef.readyItem;
    chef.readyItem = null;

    item.flying = true;
    item.x = station.x;
    item.y = station.y;

    const cx = width / 2;
    const cy = height / 2;
    const angle = Math.atan2(cy - station.y, cx - station.x);
    // Accuracy based on charge meter (0.5 is sweet spot!)
    const accuracyOffset = (chef.chargeProgress - 0.5) * 0.45;
    const launchAngle = angle + accuracyOffset;
    const speed = 7.5;

    item.vx = Math.cos(launchAngle) * speed;
    item.vy = Math.sin(launchAngle) * speed;

    this.conveyorItems.push(item);
    this.audio.playTap();
  }

  private getChefStation(pid: PlayerId, width: number, height: number) {
    const margin = 70;
    switch (pid) {
      case 0: return { x: margin, y: margin }; // P1 Top-Left
      case 1: return { x: width - margin, y: margin }; // P2 Top-Right
      case 2: return { x: margin, y: height - margin }; // P3 Bottom-Left
      case 3: return { x: width - margin, y: height - margin }; // P4 Bottom-Right
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const chef = this.chefs.get(botId);
    if (!chef || chef.stunTimer > 0) return;

    if (!chef.readyItem) {
      this.input.setBotInput(botId, false);
      return;
    }

    const isRotten = chef.readyItem.type === 'rotten';

    // If bot receives rotten food, purge it into empty space (release very early or very late)
    // Easy bots occasionally blunder and throw rotten food onto plates
    const shouldPurgeRotten = isRotten && (difficulty !== 'bot_easy' || Math.random() < 0.6);

    if (!chef.isCharging) {
      this.input.setBotInput(botId, true);
    } else {
      if (shouldPurgeRotten) {
        // Discard into the floor with minimum power (< 0.15) to avoid losing points
        if (chef.chargeProgress > 0.12) {
          this.input.setBotInput(botId, false);
        }
      } else {
        // Target rotating center plates
        // Center plate is aligned around charge 0.50
        const jitter = difficulty === 'bot_hard' ? 0.03 : difficulty === 'bot_normal' ? 0.08 : 0.18;
        const targetSweet = 0.50 + (Math.random() - 0.5) * 2 * jitter;

        if (Math.abs(chef.chargeProgress - targetSweet) < 0.06) {
          this.input.setBotInput(botId, false);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Classic Diner Checkered Floor (Warm Charcoal & Deep Crimson/Terracotta)
    const tileSize = 48;
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isEven = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0;
        ctx.fillStyle = isEven ? '#1E1B18' : '#2A2421';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Floor ambient vignette
    const floorGrad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, Math.max(width, height) * 0.65);
    floorGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    floorGrad.addColorStop(1, 'rgba(10, 8, 7, 0.7)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Rotating Center Carousel (Lazy Susan Banquet Turntable)
    const cx = width / 2;
    const cy = height / 2;
    const carouselRadius = 150;

    // Outer brass rim with shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(cx, cy, carouselRadius + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Dark polished mahogany turntable surface
    const tableGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, carouselRadius);
    tableGrad.addColorStop(0, '#451A03');
    tableGrad.addColorStop(0.85, '#270F04');
    tableGrad.addColorStop(1, '#78350F');
    ctx.fillStyle = tableGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, carouselRadius, 0, Math.PI * 2);
    ctx.fill();

    // Concentric brass ring tracks
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 100, 0, Math.PI * 2);
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.stroke();

    // Brass center ornament / bell
    const centerGrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 24);
    centerGrad.addColorStop(0, '#FDE68A');
    centerGrad.addColorStop(0.6, '#D97706');
    centerGrad.addColorStop(1, '#92400E');
    ctx.fillStyle = centerGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Center icon
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔔', cx, cy);

    // 3. Rotating Center Plates
    for (const pl of this.plates) {
      ctx.save();
      // Drop shadow for plate
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;

      // Outer rim
      const isGold = pl.multiplier > 1;
      ctx.fillStyle = isGold ? '#FEF08A' : '#F8FAFC';
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner dish inset
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = isGold ? '#FDE047' : '#E2E8F0';
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.radius * 0.78, 0, Math.PI * 2);
      ctx.fill();

      // Rim decorative border
      ctx.strokeStyle = isGold ? '#D97706' : '#94A3B8';
      ctx.lineWidth = isGold ? 3 : 2;
      ctx.stroke();

      // Multiplier label
      ctx.fillStyle = isGold ? '#78350F' : '#1E293B';
      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pl.multiplier}X`, pl.x, pl.y);
      ctx.restore();
    }

    // 4. Chef Stations in Corners
    const active = this.getActivePlayers();
    for (const p of active) {
      const chef = this.chefs.get(p.id);
      if (!chef) continue;
      const st = this.getChefStation(p.id, width, height);

      ctx.save();

      // Fever mode fire ring
      if (chef.feverTimer > 0) {
        ctx.save();
        ctx.shadowColor = '#F97316';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(st.x, st.y, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Stainless steel prep table with wooden cutting board
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(st.x, st.y, 42, 0, Math.PI * 2);
      ctx.fill();

      // Wooden cutting board inner circle
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(st.x, st.y, 34, 0, Math.PI * 2);
      ctx.fill();

      // Player color rim
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(st.x, st.y, 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Chef icon
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chef.feverTimer > 0 ? '🔥' : '👨‍🍳', st.x, st.y - 2);

      // Trajectory Prediction Arc when charging
      if (chef.isCharging) {
        const dx = cx - st.x;
        const dy = cy - st.y;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        // Landing spot based on power (0 to 1)
        const targetDist = distToCenter * (chef.chargeProgress / 0.50);
        const targetX = st.x + (dx / distToCenter) * targetDist;
        const targetY = st.y + (dy / distToCenter) * targetDist;

        // Dotted power line
        ctx.save();
        ctx.strokeStyle = chef.chargeProgress > 0.45 && chef.chargeProgress < 0.55 ? '#22C55E' : 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(st.x, st.y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        // Target landing crosshair
        ctx.setLineDash([]);
        ctx.fillStyle = chef.chargeProgress > 0.45 && chef.chargeProgress < 0.55 ? '#22C55E' : '#E2E8F0';
        ctx.beginPath();
        ctx.arc(targetX, targetY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Radial charging gauge around the station
        ctx.save();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(st.x, st.y, 48, -Math.PI / 2, -Math.PI / 2 + chef.chargeProgress * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Ready item preview on cutting board
      if (chef.readyItem) {
        const itemEmoji = this.getItemEmoji(chef.readyItem.type);
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 6;
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(itemEmoji, st.x + 22, st.y + 22);
        ctx.restore();
      }

      // Live Score Glass Pill
      const scorePillY = st.y > height / 2 ? st.y - 56 : st.y + 56;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(st.x - 45, scorePillY - 12, 90, 24, 12);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${chef.score} PTS`, st.x, scorePillY);
      ctx.restore();
    }

    // 5. Flying Food Items with Elevation Shadow
    for (const item of this.conveyorItems) {
      if (item.flying) {
        ctx.save();
        // Drop shadow on the floor beneath the food
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(item.x, item.y + 12, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flying food icon
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.getItemEmoji(item.type), item.x, item.y);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private getItemEmoji(type: string): string {
    switch (type) {
      case 'burger': return '🍔';
      case 'pizza': return '🍕';
      case 'sushi': return '🍣';
      case 'pepper': return '🌶️';
      case 'rotten': return '🐟';
      default: return '🧁';
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.chefs.values()).sort((a, b) => b.score - a.score);
    const winnerId = list.length > 0 ? list[0].id : null;
    return {
      winnerId,
      rankings: list.map((c, idx) => ({ playerId: c.id, score: c.score, place: idx + 1 })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} served the master banquet with ${list[0].score} points!` : 'Kitchen tie!'
    };
  }
}
