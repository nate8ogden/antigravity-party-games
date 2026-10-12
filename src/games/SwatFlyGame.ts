import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface Insect {
  id: number;
  type: 'fly' | 'dragonfly' | 'wasp';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: 'flying' | 'landed' | 'swatted';
  stateTimer: number;
  landDuration: number;
  flutterPhase: number;
  alive: boolean;
  points: number;
}

interface Swatter {
  id: PlayerId;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  score: number;
  isSwatting: boolean;
  swatAnim: number; // 0 to 1
  hasHitThisSwat: boolean;
  stunTimer: number;
}

export class SwatFlyGame extends BaseGame {
  private insects: Insect[] = [];
  private swatters: Map<PlayerId, Swatter> = new Map();
  private nextInsectId: number = 1;
  private spawnCooldown: number = 0;
  private tableBounds = { x: 80, y: 80, w: 0, h: 0 };
  private targetScore: number = 7;
  private botReactionCooldowns: Map<PlayerId, number> = new Map();

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && (window as unknown as { __SWAT_FLY_DEBUG__?: unknown }).__SWAT_FLY_DEBUG__) {
      delete (window as unknown as { __SWAT_FLY_DEBUG__?: unknown }).__SWAT_FLY_DEBUG__;
    }
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.insects = [];
    this.swatters.clear();
    this.botReactionCooldowns.clear();
    this.spawnCooldown = 0.5;

    // Picnic table area
    this.tableBounds = {
      x: 90,
      y: 90,
      w: width - 180,
      h: height - 180
    };

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      // Position swatters initially in each player's corner
      let sx = this.tableBounds.x + 80;
      let sy = this.tableBounds.y + 80;
      if (idx === 1) {
        sx = this.tableBounds.x + this.tableBounds.w - 80;
      } else if (idx === 2) {
        sy = this.tableBounds.y + this.tableBounds.h - 80;
      } else if (idx === 3) {
        sx = this.tableBounds.x + this.tableBounds.w - 80;
        sy = this.tableBounds.y + this.tableBounds.h - 80;
      }

      this.swatters.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        targetX: sx,
        targetY: sy,
        score: 0,
        isSwatting: false,
        swatAnim: 0,
        hasHitThisSwat: false,
        stunTimer: 0
      });
    });

    // Expose debug interface for testing
    if (typeof window !== 'undefined') {
      (window as unknown as { __SWAT_FLY_DEBUG__?: unknown }).__SWAT_FLY_DEBUG__ = {
        getInsects: () => this.insects,
        getSwatters: () => Array.from(this.swatters.values()),
        spawnMovingFlyNear: (x: number, y: number) => {
          const ins: Insect = {
            id: this.nextInsectId++,
            type: 'fly',
            x,
            y,
            targetX: x + 100,
            targetY: y + 100,
            state: 'flying',
            stateTimer: 0,
            landDuration: 2.0,
            flutterPhase: 0,
            alive: true,
            points: 1
          };
          this.insects.push(ins);
          return ins;
        }
      };
    }

    // Spawn initial wave of insects
    for (let i = 0; i < 4; i++) {
      this.spawnInsect();
    }
  }

  private spawnInsect(): void {
    const types: ('fly' | 'dragonfly' | 'wasp')[] = ['fly', 'fly', 'fly', 'dragonfly', 'wasp'];
    const type = types[Math.floor(Math.random() * types.length)];
    const points = type === 'dragonfly' ? 3 : type === 'wasp' ? -2 : 1;

    const margin = 40;
    const tx = this.tableBounds.x + margin + Math.random() * (this.tableBounds.w - margin * 2);
    const ty = this.tableBounds.y + margin + Math.random() * (this.tableBounds.h - margin * 2);

    this.insects.push({
      id: this.nextInsectId++,
      type,
      x: Math.random() < 0.5 ? this.tableBounds.x - 20 : this.tableBounds.x + this.tableBounds.w + 20,
      y: this.tableBounds.y + Math.random() * this.tableBounds.h,
      targetX: tx,
      targetY: ty,
      state: 'flying',
      stateTimer: 0,
      landDuration: type === 'dragonfly' ? 1.4 : type === 'wasp' ? 2.5 : 2.0,
      flutterPhase: Math.random() * Math.PI * 2,
      alive: true,
      points
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Spawn new insects periodically
    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0 && this.insects.filter((i) => i.alive).length < 6) {
      this.spawnInsect();
      this.spawnCooldown = 1.0 + Math.random() * 1.5;
    }

    // Update Insects
    for (const ins of this.insects) {
      if (!ins.alive) continue;
      ins.flutterPhase += dt * 15;

      if (ins.state === 'flying') {
        const dx = ins.targetX - ins.x;
        const dy = ins.targetY - ins.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 10) {
          ins.state = 'landed';
          ins.stateTimer = ins.landDuration;
        } else {
          const speed = ins.type === 'dragonfly' ? 280 : ins.type === 'wasp' ? 160 : 210;
          ins.x += (dx / dist) * speed * dt + Math.sin(ins.flutterPhase) * 1.8;
          ins.y += (dy / dist) * speed * dt + Math.cos(ins.flutterPhase) * 1.8;
        }
      } else if (ins.state === 'landed') {
        ins.stateTimer -= dt;
        if (ins.stateTimer <= 0) {
          // Take off to new landing spot
          ins.state = 'flying';
          const margin = 40;
          ins.targetX = this.tableBounds.x + margin + Math.random() * (this.tableBounds.w - margin * 2);
          ins.targetY = this.tableBounds.y + margin + Math.random() * (this.tableBounds.h - margin * 2);
        }
      }
    }

    // Process Swatter Inputs, Movement, and Slam Animation
    for (const sw of this.swatters.values()) {
      if (sw.stunTimer > 0) {
        sw.stunTimer -= dt;
      }

      const isBot = this.players[sw.id]?.type.startsWith('bot_');

      // Human Movement Controls (WASD / Arrows / Gamepad Stick / Touch)
      if (!isBot && sw.stunTimer <= 0) {
        const steerX = this.input.getSteer(sw.id);
        const steerY = -this.input.getThrottle(sw.id); // W is UP (-Y), S is DOWN (+Y)
        const mag = Math.hypot(steerX, steerY);

        if (mag > 0.08) {
          const moveSpeed = 380;
          sw.x += (steerX / (mag > 1 ? mag : 1)) * moveSpeed * dt;
          sw.y += (steerY / (mag > 1 ? mag : 1)) * moveSpeed * dt;
        } else {
          // Single-button / Tap-only fallback:
          // If holding button without directional input, gently float towards nearest fly!
          if (this.input.isPressed(sw.id)) {
            const nearest = this.insects
              .filter((i) => i.alive && i.type !== 'wasp')
              .sort((a, b) => Math.hypot(a.x - sw.x, a.y - sw.y) - Math.hypot(b.x - sw.x, b.y - sw.y))[0];
            if (nearest) {
              const dx = nearest.x - sw.x;
              const dy = nearest.y - sw.y;
              const d = Math.hypot(dx, dy);
              if (d > 10) {
                sw.x += (dx / d) * 240 * dt;
                sw.y += (dy / d) * 240 * dt;
              }
            }
          }
        }
      }

      // Constrain swatter inside picnic table bounds
      const margin = 28;
      sw.x = Math.max(this.tableBounds.x + margin, Math.min(this.tableBounds.x + this.tableBounds.w - margin, sw.x));
      sw.y = Math.max(this.tableBounds.y + margin, Math.min(this.tableBounds.y + this.tableBounds.h - margin, sw.y));

      // Check player action tap (Space / Enter / Primary action / Tap)
      const justAction = this.input.justAction(sw.id);
      const justPressed = this.input.justPressed(sw.id);
      const pressed = (justAction || (justPressed && !this.input.getSteer(sw.id) && !this.input.getThrottle(sw.id))) && sw.stunTimer <= 0;

      if (pressed && !sw.isSwatting) {
        sw.isSwatting = true;
        sw.swatAnim = 0;
        sw.hasHitThisSwat = false;
        this.audio.playTap();

        // Check if any insect is squashed under the swatter
        this.checkSwatHit(sw);
      }

      // Swatter animation with active impact window
      if (sw.isSwatting) {
        sw.swatAnim += dt * 6; // quick slap
        // Also check impact during descent if not already connected
        if (!sw.hasHitThisSwat && sw.swatAnim <= 0.65) {
          this.checkSwatHit(sw);
        }
        if (sw.swatAnim >= 1) {
          sw.isSwatting = false;
          sw.swatAnim = 0;
          sw.hasHitThisSwat = false;
        }
      }

      // Check win condition
      if (sw.score >= this.targetScore) {
        this.isFinished = true;
        this.audio.playFanfare();
      }
    }

    // Clean up dead insects
    this.insects = this.insects.filter((i) => i.alive);

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private checkSwatHit(sw: Swatter): void {
    if (sw.hasHitThisSwat) return;
    const hitRadius = 45;

    for (const ins of this.insects) {
      // Insects can be swatted whether flying or landed!
      if (!ins.alive) continue;

      const dist = Math.hypot(ins.x - sw.x, ins.y - sw.y);
      if (dist < hitRadius) {
        ins.alive = false;
        sw.hasHitThisSwat = true;
        const isMidair = ins.state === 'flying';

        if (ins.type === 'wasp') {
          // Stung!
          sw.score = Math.max(0, sw.score - 2);
          sw.stunTimer = 1.6;
          this.audio.playExplosion();
          this.particles.showFloatingText('-2 PTS! STUNG! 🐝', sw.x, sw.y - 30, '#EF4444', 22);
          this.particles.spawnSparks(sw.x, sw.y, '#EF4444', 16);
          this.particles.addTrauma(0.3);
        } else if (ins.type === 'dragonfly') {
          // Golden Dragonfly bonus!
          sw.score += 3;
          this.audio.playFanfare();
          const label = isMidair ? '+3 PTS! MID-AIR DRAGONFLY! 🌟' : '+3 PTS! GOLDEN! 🌟';
          this.particles.showFloatingText(label, sw.x, sw.y - 30, '#F59E0B', 24);
          this.particles.spawnSparks(sw.x, sw.y, '#FBBF24', 20);
        } else {
          // Regular fly
          sw.score += 1;
          this.audio.playLaser();
          const label = isMidair ? '+1 PTS! MID-AIR SWAT! 🪰' : '+1 PTS! SQUASHED!';
          this.particles.showFloatingText(label, sw.x, sw.y - 30, '#10B981', 20);
          this.particles.spawnSparks(sw.x, sw.y, '#10B981', 14);
        }
        break;
      }
    }

    if (!sw.hasHitThisSwat && sw.swatAnim === 0) {
      this.particles.spawnSparks(sw.x, sw.y, 'rgba(255,255,255,0.4)', 6);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const sw = this.swatters.get(botId);
    if (!sw || sw.stunTimer > 0) return;

    let cd = (this.botReactionCooldowns.get(botId) || 0) - dt;
    this.botReactionCooldowns.set(botId, cd);

    // Target insects on table (both landed and flying insects!)
    const targetInsects = this.insects.filter((i) => i.alive);
    if (targetInsects.length === 0) return;

    // Filter out wasps for skilled bots
    const safeInsects = targetInsects.filter((i) => {
      if (i.type === 'wasp') {
        return difficulty === 'bot_easy' && Math.random() < 0.25;
      }
      return true;
    });

    if (safeInsects.length === 0) return;

    // Target closest safe insect (with slight bonus for landed if nearby)
    safeInsects.sort((a, b) => {
      const distA = Math.hypot(a.x - sw.x, a.y - sw.y) - (a.state === 'landed' ? 20 : 0);
      const distB = Math.hypot(b.x - sw.x, b.y - sw.y) - (b.state === 'landed' ? 20 : 0);
      return distA - distB;
    });
    const target = safeInsects[0];

    // Smoothly track towards insect
    const moveSpeed = difficulty === 'bot_hard' ? 420 : difficulty === 'bot_normal' ? 320 : 220;
    const dx = target.x - sw.x;
    const dy = target.y - sw.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      sw.x += (dx / dist) * moveSpeed * dt;
      sw.y += (dy / dist) * moveSpeed * dt;
    }

    // Reaction timing before swatting
    const swatRange = difficulty === 'bot_hard' ? 24 : difficulty === 'bot_normal' ? 28 : 34;
    if (dist < swatRange && cd <= 0) {
      const reactionDelay = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.26 : 0.45;
      this.botReactionCooldowns.set(botId, reactionDelay + 0.4);
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Picnic Wooden Table Backdrop
    ctx.fillStyle = '#451A03';
    ctx.fillRect(0, 0, width, height);

    // Outer table rim
    ctx.fillStyle = '#78350F';
    ctx.fillRect(12, 12, width - 24, height - 24);

    // 2. Red & White Gingham Checkered Picnic Tablecloth
    const tb = this.tableBounds;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(tb.x, tb.y, tb.w, tb.h);
    ctx.restore();

    // Gingham Checkers
    const checkSize = 36;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tb.x, tb.y, tb.w, tb.h);
    ctx.clip();

    for (let cy = tb.y; cy < tb.y + tb.h; cy += checkSize) {
      for (let cx = tb.x; cx < tb.x + tb.w; cx += checkSize) {
        const isRed = (Math.floor(cx / checkSize) + Math.floor(cy / checkSize)) % 2 === 0;
        if (isRed) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.fillRect(cx, cy, checkSize, checkSize);
        }
      }
    }
    // Gingham dark intersections
    for (let cy = tb.y; cy < tb.y + tb.h; cy += checkSize) {
      for (let cx = tb.x; cx < tb.x + tb.w; cx += checkSize) {
        const isCross = (Math.floor(cx / checkSize) % 2 === 0) && (Math.floor(cy / checkSize) % 2 === 0);
        if (isCross) {
          ctx.fillStyle = 'rgba(185, 28, 28, 0.65)';
          ctx.fillRect(cx, cy, checkSize, checkSize);
        }
      }
    }
    ctx.restore();

    // Tablecloth hem fringe border
    ctx.strokeStyle = '#FEE2E2';
    ctx.lineWidth = 4;
    ctx.strokeRect(tb.x, tb.y, tb.w, tb.h);

    // 3. Render Insects
    for (const ins of this.insects) {
      if (!ins.alive) continue;
      ctx.save();

      // Insect Ground Shadow
      const shadowDist = ins.state === 'flying' ? 14 : 3;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(ins.x, ins.y + shadowDist, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fluttering Wings
      const wingSpread = Math.sin(ins.flutterPhase) * (ins.state === 'flying' ? 8 : 4);
      ctx.fillStyle = ins.type === 'dragonfly' ? 'rgba(253, 224, 71, 0.75)' : ins.type === 'wasp' ? 'rgba(254, 240, 138, 0.65)' : 'rgba(226, 232, 240, 0.65)';
      // Left wing
      ctx.beginPath();
      ctx.ellipse(ins.x - 7, ins.y - 4 + wingSpread, 7, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Right wing
      ctx.beginPath();
      ctx.ellipse(ins.x + 7, ins.y - 4 + wingSpread, 7, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Insect Body
      if (ins.type === 'dragonfly') {
        // Golden dragonfly
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.roundRect(ins.x - 3, ins.y - 10, 6, 20, 3);
        ctx.fill();
        // Golden head
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.arc(ins.x, ins.y - 10, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (ins.type === 'wasp') {
        // Striped Yellowjacket
        ctx.fillStyle = '#EAB308';
        ctx.beginPath();
        ctx.roundRect(ins.x - 4, ins.y - 8, 8, 16, 4);
        ctx.fill();
        // Black warning stripes
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(ins.x - 4, ins.y - 4, 8, 2.5);
        ctx.fillRect(ins.x - 4, ins.y + 1, 8, 2.5);
        ctx.fillRect(ins.x - 4, ins.y + 5, 8, 2.5);
        // Stinger
        ctx.beginPath();
        ctx.moveTo(ins.x - 2, ins.y + 8);
        ctx.lineTo(ins.x + 2, ins.y + 8);
        ctx.lineTo(ins.x, ins.y + 12);
        ctx.closePath();
        ctx.fill();
      } else {
        // Common Housefly
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.roundRect(ins.x - 4, ins.y - 6, 8, 12, 4);
        ctx.fill();
        // Red compound eyes
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(ins.x - 2.5, ins.y - 5, 2, 0, Math.PI * 2);
        ctx.arc(ins.x + 2.5, ins.y - 5, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 4. Render Flyswatters
    for (const sw of this.swatters.values()) {
      ctx.save();
      const p = this.players[sw.id];
      const pColor = p?.color || '#FFFFFF';

      // Slam impact scaling & rotation
      const slamScale = sw.isSwatting ? 1 - Math.sin(sw.swatAnim * Math.PI) * 0.25 : 1.0;
      const slamOffsetY = sw.isSwatting ? Math.sin(sw.swatAnim * Math.PI) * 12 : 0;

      ctx.translate(sw.x, sw.y + slamOffsetY);
      ctx.scale(slamScale, slamScale);

      // Stun stars if stung
      if (sw.stunTimer > 0) {
        ctx.save();
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫 STUNNED!', 0, -50);
        ctx.restore();
      }

      // Hover shadow on tablecloth
      const hoverElev = sw.isSwatting ? (1 - Math.sin(sw.swatAnim * Math.PI)) * 12 : 12;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.roundRect(-24 + hoverElev * 0.35, -28 + hoverElev, 48, 52, 8);
      ctx.fill();
      ctx.restore();

      // Swatter Handle
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-3, 24, 6, 44);
      // Colored grip
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.roundRect(-4, 48, 8, 22, 4);
      ctx.fill();

      // Swatter Mesh Head (Wire Grid)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(-24, -28, 48, 52, 8);
      ctx.fill();

      // Outer Plastic Frame
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Mesh Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      for (let gx = -16; gx <= 16; gx += 8) {
        ctx.beginPath();
        ctx.moveTo(gx, -26);
        ctx.lineTo(gx, 22);
        ctx.stroke();
      }
      for (let gy = -20; gy <= 16; gy += 8) {
        ctx.beginPath();
        ctx.moveTo(-22, gy);
        ctx.lineTo(22, gy);
        ctx.stroke();
      }

      // Live Score Badge attached to swatter
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(-30, -44, 60, 18, 9);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${sw.score}/${this.targetScore} PTS`, 0, -35);

      ctx.restore();
    }

    // 5. Goal Banner HUD (Positioned safely at y=56 below stopwatch timer)
    ctx.save();
    const pillW = 300;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FEF08A';
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SWAT FLIES (FIRST TO ${this.targetScore}) • WATCH FOR WASPS!`, width / 2, pillY + pillH / 2);
    ctx.restore();

    // 6. On-screen Controls Pill (Bottom of screen)
    ctx.save();
    const hintW = Math.min(460, width - 40);
    const hintH = 22;
    const hintX = width / 2 - hintW / 2;
    const hintY = height - 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(hintX, hintY, hintW, hintH, 11);
    ctx.fill();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 10px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P1: WASD to Move, SPACE to Swat  •  P2: ARROWS to Move, ENTER to Swat', width / 2, hintY + hintH / 2);
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.swatters.values()).sort((a, b) => b.score - a.score);
    const winnerId = list.length > 0 ? list[0].id : null;
    return {
      winnerId,
      rankings: list.map((sw, idx) => ({ playerId: sw.id, score: sw.score, place: idx + 1 })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} swatted ${list[0].score} pests!` : 'Flies rule the picnic!'
    };
  }
}
