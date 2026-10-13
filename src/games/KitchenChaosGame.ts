import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

export type IngredientType = 'bun' | 'raw_patty' | 'cooked_patty' | 'cheese' | 'lettuce' | 'pineapple';

export interface KitchenItem {
  id: number;
  type: IngredientType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  carriedBy: PlayerId | null;
  onTable: boolean;
  cookProgress: number; // For raw patty on stove (0 to 1)
}

export interface CustomerOrder {
  id: number;
  name: string;
  icon: string;
  required: IngredientType[];
  points: number;
  timer: number;
  maxTimer: number;
}

export interface ChefState {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  score: number;
  stunTimer: number;
  dashCooldown: number;
  dashDuration: number;
  heldStack: IngredientType[]; // Current assembled burger ingredients in hands
  deliveries: number;
  color: string;
}

interface KitchenTable {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'bun_crate' | 'patty_bin' | 'stove' | 'produce_bin' | 'delivery' | 'cutting_board';
  label: string;
  icon: string;
  cookingItem?: KitchenItem;
}

interface ButterSpill {
  x: number;
  y: number;
  radius: number;
}

export class KitchenChaosGame extends BaseGame {
  private chefs: Map<PlayerId, ChefState> = new Map();
  private tables: KitchenTable[] = [];
  private looseItems: KitchenItem[] = [];
  private butterSpills: ButterSpill[] = [];
  private activeOrders: CustomerOrder[] = [];
  private nextItemId: number = 1;
  private nextOrderId: number = 1;
  private orderSpawnTimer: number = 0;
  private pineappleSpawnTimer: number = 8.0;
  private animTimer: number = 0;
  private kitchenThemeIndex: number = 0;
  public currentMapName: string = 'Le Petit Parisian Bistro';

  private themes = [
    {
      name: 'Le Petit Parisian Bistro',
      tile1: '#F8FAFC',
      tile2: '#E2E8F0',
      counterColor: '#78350F',
      counterBorder: '#451A03',
      wallColor: '#BE123C'
    },
    {
      name: 'Shinjuku Midnight Izakaya',
      tile1: '#1E293B',
      tile2: '#0F172A',
      counterColor: '#475569',
      counterBorder: '#1E293B',
      wallColor: '#0EA5E9'
    },
    {
      name: 'Neon Cyberpunk Diner',
      tile1: '#18181B',
      tile2: '#27272A',
      counterColor: '#064E3B',
      counterBorder: '#022C22',
      wallColor: '#10B981'
    }
  ];

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 55.0;
    this.isFinished = false;
    this.chefs.clear();
    this.tables = [];
    this.looseItems = [];
    this.butterSpills = [];
    this.activeOrders = [];
    this.nextItemId = 1;
    this.nextOrderId = 1;
    this.orderSpawnTimer = 0;
    this.pineappleSpawnTimer = 8.0;
    this.animTimer = 0;

    this.kitchenThemeIndex = Math.floor(Math.random() * this.themes.length);
    this.currentMapName = this.themes[this.kitchenThemeIndex].name;

    const cx = width / 2;
    const cy = height / 2;

    // Kitchen Stations Layout
    // 1. Delivery Bell Counter (Top Center)
    this.tables.push({
      id: 'delivery',
      x: cx - 110,
      y: 58,
      w: 220,
      h: 44,
      type: 'delivery',
      label: 'DELIVERY COUNTER',
      icon: '🛎️'
    });

    // 2. Bun Crates (Left Counter)
    this.tables.push({
      id: 'buns',
      x: 35,
      y: cy - 110,
      w: 65,
      h: 110,
      type: 'bun_crate',
      label: 'BUNS',
      icon: '🍞'
    });

    // 3. Raw Patty Station (Left Counter Lower)
    this.tables.push({
      id: 'raw_patties',
      x: 35,
      y: cy + 30,
      w: 65,
      h: 110,
      type: 'patty_bin',
      label: 'PATTIES',
      icon: '🥩'
    });

    // 4. Sizzling Stoves (Center Island)
    this.tables.push({
      id: 'stove_left',
      x: cx - 90,
      y: cy - 35,
      w: 80,
      h: 70,
      type: 'stove',
      label: 'GRILL 1',
      icon: '♨️'
    });
    this.tables.push({
      id: 'stove_right',
      x: cx + 10,
      y: cy - 35,
      w: 80,
      h: 70,
      type: 'stove',
      label: 'GRILL 2',
      icon: '♨️'
    });

    // 5. Produce Station: Cheese & Fresh Lettuce (Right Counter)
    this.tables.push({
      id: 'produce',
      x: width - 100,
      y: cy - 110,
      w: 65,
      h: 250,
      type: 'produce_bin',
      label: 'TOPPINGS',
      icon: '🧀'
    });

    // Butter spills on floor
    this.butterSpills = [
      { x: cx - 140, y: cy + 120, radius: 26 },
      { x: cx + 140, y: cy - 90, radius: 26 }
    ];

    // Spawn 2 initial Customer Orders
    this.spawnNewOrder();
    this.spawnNewOrder();

    // Spawn Chefs
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const angle = (idx / active.length) * Math.PI * 2;
      const dist = Math.min(width, height) * 0.28;
      this.chefs.set(p.id, {
        id: p.id,
        x: cx + Math.cos(angle) * dist,
        y: cy + 60 + Math.sin(angle) * (dist * 0.7),
        vx: 0,
        vy: 0,
        angle: 0,
        speed: 0,
        score: 0,
        stunTimer: 0,
        dashCooldown: 0,
        dashDuration: 0,
        heldStack: [],
        deliveries: 0,
        color: p.color
      });
    });
  }

  private spawnNewOrder(): void {
    if (this.activeOrders.length >= 3) return;

    const recipes: Array<{ name: string; icon: string; req: IngredientType[]; pts: number }> = [
      { name: 'Classic Burger', icon: '🍔', req: ['bun', 'cooked_patty', 'bun'], pts: 100 },
      { name: 'Cheeseburger', icon: '🧀', req: ['bun', 'cooked_patty', 'cheese', 'bun'], pts: 180 },
      { name: 'Garden Deluxe', icon: '🥗', req: ['bun', 'cooked_patty', 'cheese', 'lettuce', 'bun'], pts: 260 },
      { name: 'Royale Pineapple', icon: '👑', req: ['bun', 'cooked_patty', 'pineapple', 'bun'], pts: 380 }
    ];

    const pick = recipes[Math.floor(Math.random() * recipes.length)];
    this.activeOrders.push({
      id: this.nextOrderId++,
      name: pick.name,
      icon: pick.icon,
      required: [...pick.req],
      points: pick.pts,
      timer: 24.0,
      maxTimer: 24.0
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;
    this.updateBots(dt, width, height);

    // Update Customer Orders
    this.orderSpawnTimer += dt;
    if (this.orderSpawnTimer >= 7.0) {
      this.orderSpawnTimer = 0;
      this.spawnNewOrder();
    }

    for (let i = this.activeOrders.length - 1; i >= 0; i--) {
      const order = this.activeOrders[i];
      order.timer -= dt;
      if (order.timer <= 0) {
        this.activeOrders.splice(i, 1);
        this.particles.showFloatingText('ORDER EXPIRED! ❌', width * 0.5, 75, '#EF4444', 18);
        this.audio.playBuzzer();
      }
    }

    // Golden Pineapple Spawner
    this.pineappleSpawnTimer -= dt;
    if (this.pineappleSpawnTimer <= 0) {
      this.pineappleSpawnTimer = 14.0;
      this.looseItems.push({
        id: this.nextItemId++,
        type: 'pineapple',
        x: width * 0.5 + (Math.random() - 0.5) * 160,
        y: height * 0.5 + 80 + (Math.random() - 0.5) * 60,
        vx: 0,
        vy: 0,
        carriedBy: null,
        onTable: false,
        cookProgress: 0
      });
      this.audio.playCoin();
      this.particles.showFloatingText('🍍 RARE GOLDEN PINEAPPLE DROPPED!', width * 0.5, height * 0.5 + 40, '#F59E0B', 22);
    }

    // Update Stoves: Cook raw patties into sizzling juicy cooked patties
    for (const table of this.tables) {
      if (table.type === 'stove' && table.cookingItem) {
        table.cookingItem.cookProgress += dt * 0.6; // Cooks in ~1.7s
        if (Math.random() < 0.25) {
          this.particles.spawnSparks(table.x + table.w / 2, table.y + table.h / 2, '#F59E0B', 2);
        }
        if (table.cookingItem.cookProgress >= 1.0) {
          table.cookingItem.type = 'cooked_patty';
          if (Math.random() < 0.15) {
            this.audio.playTone(660, 0.06, 'triangle');
          }
        }
      }
    }

    // 1. Process Chefs Movement, Bumping & Interaction
    for (const chef of this.chefs.values()) {
      if (chef.stunTimer > 0) {
        chef.stunTimer -= dt;
        chef.vx *= Math.pow(0.85, dt * 60);
        chef.vy *= Math.pow(0.85, dt * 60);
        chef.x += chef.vx * dt;
        chef.y += chef.vy * dt;
        chef.angle += dt * 10;
        continue;
      }

      if (chef.dashCooldown > 0) chef.dashCooldown -= dt;
      if (chef.dashDuration > 0) chef.dashDuration -= dt;

      const steer = this.input.getSteer(chef.id);
      const throttle = this.input.getThrottle(chef.id);
      const isPressed = this.input.isPressed(chef.id);
      const isAction = this.input.justAction(chef.id) || (this.input.isActionPressed(chef.id) && chef.dashCooldown <= 0);

      // Dash / Shove Lunge
      if (isAction && chef.dashCooldown <= 0) {
        chef.dashDuration = 0.32;
        chef.dashCooldown = 1.3;
        this.audio.playBoost();
        this.particles.spawnSparks(chef.x, chef.y, '#38BDF8', 8);
      }

      let speed = chef.dashDuration > 0 ? 360 : 215;

      // Check Butter Spills (Sliding physics!)
      let onButter = false;
      for (const b of this.butterSpills) {
        if (Math.hypot(chef.x - b.x, chef.y - b.y) < b.radius + 15) {
          onButter = true;
          break;
        }
      }

      const inputMag = Math.hypot(steer, -throttle);
      if (inputMag > 0.15) {
        const inputAngle = Math.atan2(-throttle, steer);
        chef.angle = inputAngle;

        const accel = onButter ? 220 : 750;
        chef.vx += (steer * speed - chef.vx) * Math.min(1, accel * dt * 0.05);
        chef.vy += (-throttle * speed - chef.vy) * Math.min(1, accel * dt * 0.05);
      } else if (isPressed) {
        // 1-Button: HOLD moves toward nearest ingredient or counter
        chef.vx += (Math.cos(chef.angle) * speed - chef.vx) * Math.min(1, 550 * dt * 0.05);
        chef.vy += (Math.sin(chef.angle) * speed - chef.vy) * Math.min(1, 550 * dt * 0.05);
      } else {
        const friction = onButter ? 0.98 : 0.82;
        chef.vx *= Math.pow(friction, dt * 60);
        chef.vy *= Math.pow(friction, dt * 60);

        if (!onButter && !this.getPlayer(chef.id)?.type.startsWith('bot_')) {
          chef.angle += dt * 2.5;
        }
      }

      chef.x += chef.vx * dt;
      chef.y += chef.vy * dt;
      chef.speed = Math.hypot(chef.vx, chef.vy);

      // Table Collisions & Interact Triggers
      const chefR = 18;
      for (const table of this.tables) {
        // Bounding box push out
        const nearestX = Math.max(table.x, Math.min(chef.x, table.x + table.w));
        const nearestY = Math.max(table.y, Math.min(chef.y, table.y + table.h));
        const dist = Math.hypot(chef.x - nearestX, chef.y - nearestY);

        if (dist < chefR) {
          const nx = (chef.x - nearestX) / (dist || 1);
          const ny = (chef.y - nearestY) / (dist || 1);
          chef.x = nearestX + nx * chefR;
          chef.y = nearestY + ny * chefR;

          // INTERACTION WITH TABLE
          this.handleTableInteraction(chef, table);
        }
      }

      // Arena walls
      chef.x = Math.max(25, Math.min(width - 25, chef.x));
      chef.y = Math.max(80, Math.min(height - 48, chef.y));

      // Grab loose ingredients on floor
      for (let i = this.looseItems.length - 1; i >= 0; i--) {
        const item = this.looseItems[i];
        if (Math.hypot(chef.x - item.x, chef.y - item.y) < chefR + 14) {
          if (chef.heldStack.length < 5) {
            chef.heldStack.push(item.type);
            this.looseItems.splice(i, 1);
            this.audio.playTap();
            this.particles.showFloatingText(`+${item.type.toUpperCase()}`, chef.x, chef.y - 24, '#FDE047', 16);
          }
        }
      }
    }

    // 2. Cutthroat Chef-on-Chef Physical Tackles & Dish Stealing
    const chefsArr = Array.from(this.chefs.values());
    for (let i = 0; i < chefsArr.length; i++) {
      for (let j = i + 1; j < chefsArr.length; j++) {
        const c1 = chefsArr[i];
        const c2 = chefsArr[j];

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 38;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          const overlap = minDist - dist + 10;
          c1.x -= nx * overlap * 0.5;
          c1.y -= ny * overlap * 0.5;
          c2.x += nx * overlap * 0.5;
          c2.y += ny * overlap * 0.5;

          const c1Dashing = c1.dashDuration > 0;
          const c2Dashing = c2.dashDuration > 0;

          if (c1Dashing || c2Dashing) {
            // VIOLENT KITCHEN TACKLE!
            const attacker = c1Dashing ? c1 : c2;
            const victim = c1Dashing ? c2 : c1;

            victim.stunTimer = 1.2;
            victim.vx = (c1Dashing ? nx : -nx) * 380;
            victim.vy = (c1Dashing ? ny : -ny) * 380;

            // Victim drops all held ingredients!
            if (victim.heldStack.length > 0) {
              for (const ing of victim.heldStack) {
                this.looseItems.push({
                  id: this.nextItemId++,
                  type: ing,
                  x: victim.x + (Math.random() - 0.5) * 45,
                  y: victim.y + (Math.random() - 0.5) * 45,
                  vx: (Math.random() - 0.5) * 120,
                  vy: (Math.random() - 0.5) * 120,
                  carriedBy: null,
                  onTable: false,
                  cookProgress: 1.0
                });
              }
              victim.heldStack = [];
              this.particles.showFloatingText('💥 DISH SCATTERED!', victim.x, victim.y - 28, '#EF4444', 24);
            }

            this.audio.playExplosion();
            this.particles.shake(6);
            this.particles.spawnExplosion(victim.x, victim.y, '#F59E0B', 24);
          } else {
            // Normal bumper bounce
            c1.vx = -nx * 190;
            c1.vy = -ny * 190;
            c2.vx = nx * 190;
            c2.vy = ny * 190;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private handleTableInteraction(chef: ChefState, table: KitchenTable): void {
    // Bun Crate
    if (table.type === 'bun_crate') {
      if (chef.heldStack.length < 5 && (!chef.heldStack.includes('bun') || chef.heldStack[0] !== 'bun')) {
        chef.heldStack.unshift('bun'); // Bottom bun
        this.audio.playTap();
      } else if (chef.heldStack.length >= 2 && chef.heldStack[chef.heldStack.length - 1] !== 'bun') {
        chef.heldStack.push('bun'); // Top bun
        this.audio.playTap();
      }
    }

    // Raw Patty Station
    else if (table.type === 'patty_bin') {
      if (chef.heldStack.length < 5 && !chef.heldStack.includes('raw_patty') && !chef.heldStack.includes('cooked_patty')) {
        chef.heldStack.push('raw_patty');
        this.audio.playTap();
        this.particles.showFloatingText('+RAW PATTY', chef.x, chef.y - 24, '#BE123C', 16);
      }
    }

    // Stove Grill
    else if (table.type === 'stove') {
      // If chef has raw patty in hands, place onto stove!
      const rawIdx = chef.heldStack.indexOf('raw_patty');
      if (rawIdx !== -1 && !table.cookingItem) {
        chef.heldStack.splice(rawIdx, 1);
        table.cookingItem = {
          id: this.nextItemId++,
          type: 'raw_patty',
          x: table.x + table.w / 2,
          y: table.y + table.h / 2,
          vx: 0,
          vy: 0,
          carriedBy: null,
          onTable: true,
          cookProgress: 0
        };
        this.audio.playTone(440, 0.08, 'square');
        this.particles.showFloatingText('♨️ SIZZLING...', table.x + table.w / 2, table.y - 12, '#F59E0B', 16);
      }
      // If stove has cooked patty, pick it up into burger stack!
      else if (table.cookingItem && table.cookingItem.type === 'cooked_patty' && chef.heldStack.length < 5) {
        chef.heldStack.push('cooked_patty');
        table.cookingItem = undefined;
        this.audio.playCoin();
        this.particles.spawnSparks(table.x + table.w / 2, table.y + table.h / 2, '#F59E0B', 8);
        this.particles.showFloatingText('+COOKED PATTY! 🥩', chef.x, chef.y - 24, '#F59E0B', 18);
      }
    }

    // Produce Bin (Cheese & Lettuce)
    else if (table.type === 'produce_bin') {
      if (chef.heldStack.length < 5) {
        if (!chef.heldStack.includes('cheese')) {
          chef.heldStack.push('cheese');
          this.audio.playTap();
          this.particles.showFloatingText('+CHEESE 🧀', chef.x, chef.y - 24, '#FACC15', 16);
        } else if (!chef.heldStack.includes('lettuce')) {
          chef.heldStack.push('lettuce');
          this.audio.playTap();
          this.particles.showFloatingText('+LETTUCE 🥬', chef.x, chef.y - 24, '#4ADE80', 16);
        }
      }
    }

    // Delivery Bell Counter
    else if (table.type === 'delivery') {
      if (chef.heldStack.length >= 2) {
        // Check matching order
        let matchedOrderIdx = -1;
        for (let i = 0; i < this.activeOrders.length; i++) {
          const ord = this.activeOrders[i];
          // Check if held stack contains all required ingredients
          const hasAll = ord.required.every(req => chef.heldStack.includes(req));
          if (hasAll) {
            matchedOrderIdx = i;
            break;
          }
        }

        if (matchedOrderIdx !== -1) {
          const ord = this.activeOrders[matchedOrderIdx];
          chef.score += ord.points;
          chef.deliveries++;
          chef.heldStack = [];

          this.activeOrders.splice(matchedOrderIdx, 1);
          this.audio.playScore();
          this.particles.shake(5);
          this.particles.spawnExplosion(table.x + table.w / 2, table.y + table.h / 2, '#F59E0B', 30);
          this.particles.showFloatingText(`ORDER DELIVERED! +${ord.points} 🛎️`, table.x + table.w / 2, table.y - 20, '#F59E0B', 24);

          // Prompt new order
          setTimeout(() => this.spawnNewOrder(), 500);
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
    const chef = this.chefs.get(botId);
    if (!chef || chef.stunTimer > 0) return;

    // Bot decision tree:
    // 1. If has completed burger stack with cooked patty, run to delivery counter!
    // 2. If has raw patty, run to open stove!
    // 3. If stove has cooked patty, run to stove to claim it!
    // 4. If needs raw patty, run to raw patty station!
    // 5. If needs buns, run to bun station!

    let targetX = width / 2;
    let targetY = height / 2;

    const hasCooked = chef.heldStack.includes('cooked_patty');
    const hasRaw = chef.heldStack.includes('raw_patty');
    const hasBun = chef.heldStack.includes('bun');

    if (hasCooked && hasBun) {
      // Deliver order!
      const delivery = this.tables.find(t => t.type === 'delivery');
      if (delivery) {
        targetX = delivery.x + delivery.w / 2;
        targetY = delivery.y + delivery.h + 20;
      }
    } else if (hasRaw) {
      // Place on stove
      const stove = this.tables.find(t => t.type === 'stove' && !t.cookingItem);
      if (stove) {
        targetX = stove.x + stove.w / 2;
        targetY = stove.y + stove.h + 20;
      } else {
        targetX = width / 2;
        targetY = height / 2 + 60;
      }
    } else {
      // Check if a stove has a finished cooked patty!
      const readyStove = this.tables.find(t => t.type === 'stove' && t.cookingItem?.type === 'cooked_patty');
      if (readyStove) {
        targetX = readyStove.x + readyStove.w / 2;
        targetY = readyStove.y + readyStove.h + 20;
      } else if (!hasBun) {
        const bunTable = this.tables.find(t => t.type === 'bun_crate');
        if (bunTable) {
          targetX = bunTable.x + bunTable.w + 20;
          targetY = bunTable.y + bunTable.h / 2;
        }
      } else {
        const pattyTable = this.tables.find(t => t.type === 'patty_bin');
        if (pattyTable) {
          targetX = pattyTable.x + pattyTable.w + 20;
          targetY = pattyTable.y + pattyTable.h / 2;
        }
      }
    }

    // Add humanized imperfection
    if (difficulty === 'bot_easy') {
      targetX += (Math.random() - 0.5) * 90;
      targetY += (Math.random() - 0.5) * 90;
    } else if (difficulty === 'bot_normal') {
      targetX += (Math.random() - 0.5) * 35;
      targetY += (Math.random() - 0.5) * 35;
    }

    const dx = targetX - chef.x;
    const dy = targetY - chef.y;
    const mag = Math.hypot(dx, dy) || 1;

    const steer = dx / mag;
    const throttle = -dy / mag;

    // Tactical dash towards delivery counter
    let wantsDash = false;
    if (hasCooked && hasBun && mag > 120 && chef.dashCooldown <= 0 && Math.random() < 0.25) {
      wantsDash = true;
    }

    this.input.setBotInput(botId, true, steer, throttle, wantsDash);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const curTheme = this.themes[this.kitchenThemeIndex];

    // Checkered Kitchen Floor Tiles
    const tileSize = 38;
    for (let x = 0; x < width; x += tileSize) {
      for (let y = 50; y < height; y += tileSize) {
        const isAlt = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isAlt ? curTheme.tile1 : curTheme.tile2;
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Render Butter Spills
    for (const b of this.butterSpills) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.radius, b.radius * 0.65, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#CA8A04';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🧈 SLICK', b.x, b.y + 3);
    }

    // Render Kitchen Tables & Stations
    for (const t of this.tables) {
      ctx.save();
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(t.x + 4, t.y + 6, t.w, t.h);

      // Station Body
      ctx.fillStyle = curTheme.counterColor;
      ctx.fillRect(t.x, t.y, t.w, t.h);

      // Countertop Rim
      ctx.strokeStyle = curTheme.counterBorder;
      ctx.lineWidth = 3;
      ctx.strokeRect(t.x, t.y, t.w, t.h);

      // Station Icon & Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.icon, t.x + t.w / 2, t.y + t.h * 0.42);

      ctx.font = '900 9px Montserrat, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(t.label, t.x + t.w / 2, t.y + t.h * 0.82);

      // Sizzling Stove Patty
      if (t.type === 'stove' && t.cookingItem) {
        const item = t.cookingItem;
        const cx = t.x + t.w / 2;
        const cy = t.y + t.h / 2;

        ctx.fillStyle = item.type === 'cooked_patty' ? '#78350F' : '#DC2626';
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 11, 0, Math.PI * 2);
        ctx.fill();

        // Cooking Progress Bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(t.x + 8, t.y + t.h - 10, t.w - 16, 5);
        ctx.fillStyle = item.type === 'cooked_patty' ? '#22C55E' : '#F59E0B';
        ctx.fillRect(t.x + 8, t.y + t.h - 10, (t.w - 16) * Math.min(1, item.cookProgress), 5);
      }

      ctx.restore();
    }

    // Render Loose Ingredients on floor
    for (const item of this.looseItems) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.fillStyle = item.type === 'pineapple' ? '#F59E0B' : '#78350F';
      const icon = item.type === 'pineapple' ? '🍍' : item.type === 'bun' ? '🍞' : '🥩';
      ctx.font = '900 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, 0, 0);
      ctx.restore();
    }

    // Render Chefs
    for (const chef of this.chefs.values()) {
      const cfg = this.getPlayer(chef.id);
      ctx.save();
      ctx.translate(chef.x, chef.y);

      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 14, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Chef Mascot Circle
      ctx.fillStyle = chef.color;
      ctx.shadowColor = chef.color;
      ctx.shadowBlur = chef.dashDuration > 0 ? 16 : 8;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();

      // White Chef Apron & Hat
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, -14, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-6, -8, 12, 6);

      // Face expressions
      const isStunned = chef.stunTimer > 0;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      if (isStunned) {
        // Spiral stunned eyes
        ctx.arc(-5, -2, 2.5, 0, Math.PI * 2);
        ctx.arc(5, -2, 2.5, 0, Math.PI * 2);
      } else {
        ctx.arc(-5, -2, 2, 0, Math.PI * 2);
        ctx.arc(5, -2, 2, 0, Math.PI * 2);
      }
      ctx.fill();

      // Held Burger Stack in Hands!
      if (chef.heldStack.length > 0) {
        ctx.save();
        ctx.translate(0, 16);
        for (let sIdx = 0; sIdx < chef.heldStack.length; sIdx++) {
          const ing = chef.heldStack[sIdx];
          const ingY = -sIdx * 6;
          const ingColor = ing === 'bun' ? '#D97706' : ing === 'cooked_patty' ? '#78350F' : ing === 'raw_patty' ? '#DC2626' : ing === 'cheese' ? '#FACC15' : ing === 'lettuce' ? '#22C55E' : '#F59E0B';
          ctx.fillStyle = ingColor;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(-11, ingY - 3, 22, 5, 2);
          else ctx.fillRect(-11, ingY - 3, 22, 5);
          ctx.fill();
        }
        ctx.restore();
      }

      // Name & Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10.5px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name || 'Chef'}: ${chef.score}`, 0, -28);

      ctx.restore();
    }

    // Top Customer Orders Tickets UI (Right under global timer at y: 12-44)
    ctx.save();
    let orderX = width * 0.5 - (this.activeOrders.length * 115) / 2;
    for (const order of this.activeOrders) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(orderX, 10, 108, 40, 8);
      else ctx.fillRect(orderX, 10, 108, 40);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${order.icon} ${order.name}`, orderX + 8, 24);

      // Recipe requirement icons
      const iconsMap: Record<IngredientType, string> = {
        bun: '🍞',
        raw_patty: '🥩',
        cooked_patty: '🥩',
        cheese: '🧀',
        lettuce: '🥬',
        pineapple: '🍍'
      };
      const reqStr = order.required.map(r => iconsMap[r]).join('');
      ctx.font = '900 9px sans-serif';
      ctx.fillText(`${reqStr} • +${order.points}`, orderX + 8, 38);

      orderX += 115;
    }
    ctx.restore();

    // Theme Pill at Bottom-Left (Rule compliant: x: 20, y: height - 44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 370, 32, 16);
    else ctx.fillRect(20, height - 44, 370, 32);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `🍳 [${this.kitchenThemeIndex + 1}/3] ${curTheme.name} | Bump & Steal!`,
      34,
      height - 24
    );
    ctx.restore();
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    for (const chef of this.chefs.values()) {
      scores.set(chef.id, chef.score);
    }
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.chefs.values())
      .map((c) => ({
        playerId: c.id,
        score: c.score,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} served the most delicious burgers in Kitchen Chaos!` : 'Orders were burnt to a crisp!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
