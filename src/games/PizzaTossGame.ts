import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface FloatingHit {
  text: string;
  color: string;
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

interface FlyingTopping {
  id: number;
  x: number;
  y: number; // altitude relative to chef hands (negative is higher)
  vx: number;
  type: 'pepperoni' | 'mushroom' | 'basil' | 'cheese' | 'hazard';
}

interface ToppingOnPizza {
  relX: number;
  relY: number;
  type: 'pepperoni' | 'mushroom' | 'basil' | 'cheese';
}

interface PizzaChef {
  id: PlayerId;
  x: number;
  y: number; // Base of chef hands
  doughY: number; // Relative to chef hands (0 = on hands, < 0 = airborne)
  vDoughY: number;
  doughSize: number; // Radius of pizza crust (20 to 42)
  spinAngle: number;
  spinSpeed: number;
  state: 'HOLDING' | 'AIRBORNE' | 'DROPPED';
  toppings: ToppingOnPizza[];
  flyingToppings: FlyingTopping[];
  spawnTimer: number;
  pizzasBaked: number;
  score: number;
  combo: number;
  flopTimer: number;
  bakeCelebrationTimer: number;
  catchWindowGlow: number;
  floatingHits: FloatingHit[];
}

export class PizzaTossGame extends BaseGame {
  public playersState: Map<PlayerId, PizzaChef> = new Map();
  public currentMapName: string = 'Bella Napoli Pizzeria';

  private toppingIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.playersState.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);
    const counterY = height * 0.60;

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: counterY - 24,
        doughY: 0,
        vDoughY: 0,
        doughSize: 22,
        spinAngle: 0,
        spinSpeed: 2.0,
        state: 'HOLDING',
        toppings: [],
        flyingToppings: [],
        spawnTimer: 0.5 + Math.random() * 0.4,
        pizzasBaked: 0,
        score: 0,
        combo: 0,
        flopTimer: 0,
        bakeCelebrationTimer: 0,
        catchWindowGlow: 0,
        floatingHits: []
      });
      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.2);
    });
  }

  public update(dt: number, _width: number, _height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, _width, _height);

    for (const p of this.getActivePlayers()) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      // Update cooldowns
      if (chef.flopTimer > 0) {
        chef.flopTimer -= dt;
        if (chef.flopTimer <= 0) {
          // Reset to fresh dough
          chef.state = 'HOLDING';
          chef.doughY = 0;
          chef.vDoughY = 0;
          chef.doughSize = 22;
          chef.toppings = [];
        }
      }
      if (chef.bakeCelebrationTimer > 0) chef.bakeCelebrationTimer -= dt;
      if (chef.catchWindowGlow > 0) chef.catchWindowGlow -= dt * 4;

      // Update floating score texts
      for (let i = chef.floatingHits.length - 1; i >= 0; i--) {
        const hit = chef.floatingHits[i];
        hit.y -= dt * 32;
        hit.alpha -= dt * 1.5;
        hit.scale = Math.min(1.2, hit.scale + dt * 0.8);
        if (hit.alpha <= 0) {
          chef.floatingHits.splice(i, 1);
        }
      }

      // Spawn flying toppings across the chef station
      chef.spawnTimer -= dt;
      if (chef.spawnTimer <= 0 && chef.flyingToppings.length < 5) {
        chef.spawnTimer = 0.65 + Math.random() * 0.55;

        const rand = Math.random();
        let type: 'pepperoni' | 'mushroom' | 'basil' | 'cheese' | 'hazard' = 'pepperoni';
        if (rand < 0.12) {
          type = 'hazard'; // Pesky kitchen fly / burnt charcoal
        } else if (rand < 0.25) {
          type = 'cheese'; // Golden mozzarella
        } else if (rand < 0.45) {
          type = 'basil';
        } else if (rand < 0.70) {
          type = 'mushroom';
        }

        // Flying from left or right across chef column
        const fromLeft = Math.random() < 0.5;
        const vx = fromLeft ? (80 + Math.random() * 45) : (-80 - Math.random() * 45);
        const startX = fromLeft ? -52 : 52;
        const altitude = -45 - Math.random() * 85; // between -45 and -130

        chef.flyingToppings.push({
          id: ++this.toppingIdCounter,
          x: startX,
          y: altitude,
          vx,
          type
        });
      }

      // Update flying toppings
      for (let i = chef.flyingToppings.length - 1; i >= 0; i--) {
        const top = chef.flyingToppings[i];
        top.x += top.vx * dt;
        if (Math.abs(top.x) > 65) {
          chef.flyingToppings.splice(i, 1);
        }
      }

      // Update dough physics
      chef.spinAngle += chef.spinSpeed * dt;

      if (chef.state === 'AIRBORNE') {
        chef.doughY += chef.vDoughY * dt;
        chef.vDoughY += 510 * dt; // Gravity

        // Catch sweet spot proximity glow
        if (chef.doughY >= -30 && chef.doughY <= 15 && chef.vDoughY > 0) {
          chef.catchWindowGlow = 1.0;
        }

        // Check if dough dropped past chef hands
        if (chef.doughY > 20) {
          // SPLAT! Dropped on floor
          chef.state = 'DROPPED';
          chef.combo = 0;
          chef.score = Math.max(0, chef.score - 10);
          chef.flopTimer = 0.75;
          chef.doughY = 22;
          chef.vDoughY = 0;

          this.audio.playExplosion();
          this.particles.emit(chef.x, chef.y + 10, 8, '#FFF9C4');

          chef.floatingHits.push({
            text: 'DROPPED! -10',
            color: '#FF1744',
            x: 0,
            y: 0,
            alpha: 1.0,
            scale: 1.1
          });
        }
      }

      // Check input
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handleAction(chef);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  /**
   * Action handler:
   * - If HOLDING: High-loft toss into air
   * - If AIRBORNE and in landing catch zone: Clean catch & bake pizza if topped!
   * - If AIRBORNE high: Acrobatic spin flick to stretch dough and snag passing toppings!
   */
  private handleAction(chef: PizzaChef): void {
    if (chef.state === 'DROPPED') return;

    if (chef.state === 'HOLDING') {
      // 1. LAUNCH DOUGH UPWARD
      chef.state = 'AIRBORNE';
      chef.vDoughY = -345;
      chef.spinSpeed = 3.5;
      this.audio.playWhoosh();
      this.particles.emit(chef.x, chef.y, 4, '#FFF9C4');
      return;
    }

    if (chef.state === 'AIRBORNE') {
      // 2. CHECK CLEAN LANDING CATCH (dough falling back to hands: y between -26 and 16, falling downward)
      if (chef.doughY >= -28 && chef.doughY <= 18 && chef.vDoughY > 0) {
        // Clean catch on hands!
        if (chef.toppings.length >= 2) {
          // BAKE PIZZA!
          chef.pizzasBaked++;
          chef.combo++;
          const bakePts = 50 + chef.toppings.length * 15 + chef.combo * 5;
          chef.score += bakePts;
          chef.bakeCelebrationTimer = 1.0;

          this.audio.playScore();
          this.audio.playChime();
          this.particles.spawnConfetti(chef.x, chef.y - 30, 16);

          chef.floatingHits.push({
            text: `PIZZA BAKED! +${bakePts} 🍕`,
            color: '#00E676',
            x: 0,
            y: -30,
            alpha: 1.0,
            scale: 1.25
          });

          // Reset to fresh dough
          chef.state = 'HOLDING';
          chef.doughY = 0;
          chef.vDoughY = 0;
          chef.doughSize = 22;
          chef.toppings = [];
          return;
        } else {
          // Caught safely but needs more toppings!
          chef.state = 'HOLDING';
          chef.doughY = 0;
          chef.vDoughY = 0;
          this.audio.playTap();
          chef.floatingHits.push({
            text: 'CAUGHT! ADD TOPPINGS!',
            color: '#FFD54F',
            x: 0,
            y: -15,
            alpha: 0.9,
            scale: 0.9
          });
          return;
        }
      }

      // 3. ACROBATIC AERIAL SPIN & TOPPING SNAG
      // Give upward loft burst
      chef.vDoughY = Math.min(-140, chef.vDoughY - 150);
      chef.spinSpeed += 4.0;
      chef.doughSize = Math.min(40, chef.doughSize + 2.5);
      this.audio.playTap();

      // Check if spinning dough collides with any flying toppings
      for (let i = chef.flyingToppings.length - 1; i >= 0; i--) {
        const top = chef.flyingToppings[i];
        const dist = Math.hypot(top.x, top.y - chef.doughY);

        if (dist <= chef.doughSize + 8) {
          if (top.type === 'hazard') {
            // PEST HAZARD: PIZZA RUINED!
            chef.score = Math.max(0, chef.score - 20);
            chef.combo = 0;
            chef.toppings = [];
            this.audio.playExplosion();
            this.particles.emit(chef.x + top.x, chef.y + top.y, 8, '#4E342E');

            chef.floatingHits.push({
              text: 'RUINED! -20 🪰',
              color: '#FF1744',
              x: top.x,
              y: top.y - 12,
              alpha: 1.0,
              scale: 1.1
            });
          } else {
            // TOPPING SNAGGED!
            chef.combo++;
            let pts = 15;
            let topName = 'PEPPERONI';

            if (top.type === 'cheese') {
              pts = 40;
              topName = 'GOLD CHEESE';
              this.audio.playScore();
              this.particles.spawnSparks(chef.x + top.x, chef.y + top.y, '#FFD700', 10);
            } else if (top.type === 'basil') {
              pts = 25;
              topName = 'FRESH BASIL';
              this.audio.playTap();
              this.particles.emit(chef.x + top.x, chef.y + top.y, 6, '#4CAF50');
            } else if (top.type === 'mushroom') {
              pts = 20;
              topName = 'MUSHROOM';
              this.audio.playTap();
              this.particles.emit(chef.x + top.x, chef.y + top.y, 6, '#D7CCC8');
            } else {
              pts = 15;
              topName = 'PEPPERONI';
              this.audio.playTap();
              this.particles.emit(chef.x + top.x, chef.y + top.y, 6, '#E53935');
            }

            const totalPts = pts + chef.combo * 3;
            chef.score += totalPts;

            // Place topping on pizza crust surface
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * (chef.doughSize - 8);
            chef.toppings.push({
              relX: Math.cos(angle) * r,
              relY: Math.sin(angle) * r,
              type: top.type
            });

            chef.floatingHits.push({
              text: `${topName}! +${totalPts}`,
              color: top.type === 'cheese' ? '#FFD700' : '#FFF9C4',
              x: top.x,
              y: top.y - 12,
              alpha: 1.0,
              scale: 1.0
            });
          }

          chef.flyingToppings.splice(i, 1);
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const chef = this.playersState.get(botId);
    if (!chef || chef.state === 'DROPPED') return;

    let shouldAction = false;
    let nextDelay = 0.2;

    if (chef.state === 'HOLDING') {
      // Launch into air
      shouldAction = true;
      nextDelay = 0.3;
    } else if (chef.state === 'AIRBORNE') {
      // Check if falling into catch window
      const inCatchZone = chef.doughY >= -24 && chef.doughY <= 15 && chef.vDoughY > 0;

      if (inCatchZone) {
        if (difficulty === 'bot_easy') {
          shouldAction = Math.random() < 0.65; // Occasionally misses catch
        } else if (difficulty === 'bot_hard') {
          shouldAction = true; // Perfect catch
        } else {
          shouldAction = Math.random() < 0.85;
        }
        nextDelay = 0.25;
      } else {
        // In air: check for toppings near pizza
        const nearbyTopping = chef.flyingToppings.find(t => {
          const dist = Math.hypot(t.x, t.y - chef.doughY);
          return dist < chef.doughSize + 22;
        });

        if (nearbyTopping) {
          if (nearbyTopping.type === 'hazard') {
            // Avoid hazard!
            if (difficulty === 'bot_easy' && Math.random() < 0.3) shouldAction = true; // Mistake
            else shouldAction = false;
          } else {
            shouldAction = true;
          }
        } else if (chef.vDoughY > 120 && chef.doughY < -40) {
          // Keep airborne if falling too early
          if (Math.random() < 0.7) shouldAction = true;
        }

        nextDelay = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.20 : 0.35;
      }
    }

    if (shouldAction) {
      this.handleAction(chef);
    }

    this.botReactionTimers.set(botId, nextDelay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const c = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: c?.score || 0,
        pizzas: c?.pizzasBaked || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topPizzas = scores[0]?.pizzas || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} baked ${topPizzas} gourmet wood-fired Neapolitan pizzas!`
      : 'The pizza dough tore before any master pies could bake!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Italian Pizzeria Brick Oven Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1A0C08');
    bgGrad.addColorStop(0.35, '#2A140E');
    bgGrad.addColorStop(0.7, '#3E1C12');
    bgGrad.addColorStop(1, '#1A0B08');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm wood-fired oven glow
    const ovenGlow = ctx.createRadialGradient(width / 2, height * 0.4, 40, width / 2, height * 0.4, width * 0.65);
    ovenGlow.addColorStop(0, 'rgba(255, 138, 101, 0.15)');
    ovenGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = ovenGlow;
    ctx.fillRect(0, 0, width, height);

    // Pizzeria Marble Counter along lower screen
    const counterY = height * 0.60;
    const counterGrad = ctx.createLinearGradient(0, counterY, 0, height);
    counterGrad.addColorStop(0, '#4E342E');
    counterGrad.addColorStop(0.06, '#3E2723');
    counterGrad.addColorStop(1, '#271916');
    ctx.fillStyle = counterGrad;
    ctx.fillRect(0, counterY, width, height - counterY);

    // Polished Italian checkerboard counter trim
    ctx.fillStyle = '#E53935';
    ctx.fillRect(0, counterY - 4, width, 4);
    ctx.fillStyle = '#FFFFFF';
    for (let cx = 0; cx < width; cx += 16) {
      ctx.fillRect(cx, counterY - 4, 8, 4);
    }

    // 2. Instructions Pill (cleanly positioned below top HUD)
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 260, 56, 520, 26, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 171, 145, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = '#FFE082';
    ctx.fillText('TAP TO LOFT & SPIN • SNAG FLYING TOPPINGS • TIME CATCH ON HANDS TO BAKE!', width / 2, 73);
    ctx.restore();

    // 3. Render Chef Stations
    for (const p of this.getActivePlayers()) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      ctx.save();
      ctx.translate(chef.x, chef.y);

      // Wood-Fired Brick Oven Base behind chef
      ctx.fillStyle = '#B71C1C';
      ctx.beginPath();
      ctx.roundRect(-36, -8, 72, 32, [8, 8, 0, 0]);
      ctx.fill();

      // Oven fire opening
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.ellipse(0, 6, 20, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glowing embers inside
      ctx.fillStyle = '#FF5722';
      ctx.beginPath();
      ctx.ellipse(0, 7, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Catch sweet-spot guide indicator
      ctx.save();
      ctx.strokeStyle = chef.catchWindowGlow > 0 ? 'rgba(0, 230, 118, 0.8)' : 'rgba(255, 213, 79, 0.35)';
      ctx.lineWidth = chef.catchWindowGlow > 0 ? 2 : 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(-32, -22, 64, 26);
      ctx.setLineDash([]);

      ctx.fillStyle = chef.catchWindowGlow > 0 ? '#00E676' : 'rgba(255, 238, 88, 0.6)';
      ctx.font = '800 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(chef.catchWindowGlow > 0 ? 'CATCH NOW!' : 'CATCH ZONE', 0, -10);
      ctx.restore();

      // Flying Toppings
      for (const top of chef.flyingToppings) {
        ctx.save();
        ctx.translate(top.x, top.y);

        this.renderTopping(ctx, top.type);

        ctx.restore();
      }

      // Chef Hands at base
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(-14, 0, 6, 0, Math.PI * 2);
      ctx.arc(14, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // PIZZA DOUGH RENDERING
      if (chef.state !== 'DROPPED') {
        ctx.save();
        ctx.translate(0, chef.doughY);
        ctx.rotate(chef.spinAngle);

        const r = chef.doughSize;

        // Crust drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(2, 2, r, 0, Math.PI * 2);
        ctx.fill();

        // Golden baked crust edge
        ctx.fillStyle = '#FFA000';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Savory tomato sauce core
        ctx.fillStyle = '#D32F2F';
        ctx.beginPath();
        ctx.arc(0, 0, r - 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Melted mozzarella layer
        ctx.fillStyle = '#FFF9C4';
        ctx.beginPath();
        ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
        ctx.fill();

        // Render toppings placed on pizza
        for (const t of chef.toppings) {
          ctx.save();
          ctx.translate(t.relX, t.relY);
          this.renderTopping(ctx, t.type);
          ctx.restore();
        }

        ctx.restore();
      } else {
        // Dropped dough splat on floor
        ctx.fillStyle = '#FFE082';
        ctx.beginPath();
        ctx.ellipse(0, 22, 26, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Wood-fired Pizza Oven celebration icon
      if (chef.bakeCelebrationTimer > 0) {
        ctx.save();
        ctx.translate(34, -20);
        ctx.font = '24px sans-serif';
        ctx.fillText('🍕', 0, 0);
        ctx.restore();
      }

      // Floating hit texts
      for (const hit of chef.floatingHits) {
        ctx.save();
        ctx.translate(hit.x, hit.y);
        ctx.scale(hit.scale, hit.scale);
        ctx.globalAlpha = Math.max(0, hit.alpha);
        ctx.font = '900 12px sans-serif';
        ctx.textAlign = 'center';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(hit.text, 0, 0);

        ctx.fillStyle = hit.color;
        ctx.fillText(hit.text, 0, 0);
        ctx.restore();
      }

      ctx.restore();

      // 4. Station Player Card affixed to counter front
      ctx.save();
      const cardY = counterY + 14;
      const cardW = 100;
      const cardH = 54;

      ctx.fillStyle = '#211310';
      ctx.beginPath();
      ctx.roundRect(chef.x - cardW / 2, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px sans-serif';
      ctx.fillText(p.name, chef.x, cardY + 17);

      ctx.font = '900 18px monospace';
      ctx.fillStyle = '#FFD54F';
      ctx.fillText(`${chef.score}`, chef.x, cardY + 34);

      if (chef.combo >= 2) {
        ctx.fillStyle = '#FF7043';
        ctx.font = '800 10px monospace';
        ctx.fillText(`🔥 ${chef.combo}x STREAK`, chef.x, cardY + 47);
      } else {
        ctx.fillStyle = '#FFE082';
        ctx.font = '700 9px monospace';
        ctx.fillText(`🍕 Baked: ${chef.pizzasBaked}`, chef.x, cardY + 47);
      }

      ctx.restore();
    }
  }

  private renderTopping(ctx: CanvasRenderingContext2D, type: string): void {
    if (type === 'hazard') {
      // Kitchen fly / burnt charcoal
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Wings
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(-2, -3, 3, 2, -0.4, 0, Math.PI * 2);
      ctx.ellipse(2, -3, 3, 2, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'cheese') {
      // Golden mozzarella chunk
      ctx.fillStyle = '#FFD54F';
      ctx.beginPath();
      ctx.roundRect(-4, -4, 8, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-2, -2, 2, 2);
    } else if (type === 'basil') {
      // Fresh emerald basil leaf
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'mushroom') {
      // Sliced white mushroom
      ctx.fillStyle = '#D7CCC8';
      ctx.beginPath();
      ctx.arc(0, -1, 4.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8D6E63';
      ctx.fillRect(-1.5, -1, 3, 4);
    } else {
      // Pepperoni slice
      ctx.fillStyle = '#C62828';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E57373';
      ctx.beginPath();
      ctx.arc(-1.5, -1, 1, 0, Math.PI * 2);
      ctx.arc(1.5, 1, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
