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

interface SizzlingFood {
  id: number;
  type: 'shrimp' | 'zucchini' | 'mushroom' | 'ember';
  x: number;
  y: number; // altitude relative to spatula level
  vy: number;
  vx: number;
  rotation: number;
  vRot: number;
  cookStage: number; // 0 = raw, 1 = seared, 2 = flambé, 3 = ready to serve!
  juggleCount: number;
}

interface HibachiStation {
  id: PlayerId;
  x: number;
  y: number; // Spatula / Griddle height
  foods: SizzlingFood[];
  spawnTimer: number;
  spatulaAnim: number;
  spatulaAngle: number;
  score: number;
  combo: number;
  shrimpServed: number;
  flameBoostTimer: number;
  stunTimer: number;
  shakeTimer: number;
  floatingHits: FloatingHit[];
}

export class TeppanyakiCatchGame extends BaseGame {
  public playersState: Map<PlayerId, HibachiStation> = new Map();
  public currentMapName: string = 'Tokyo Hibachi Teppanyaki Grill';

  private foodIdCounter: number = 0;
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
    const griddleY = height * 0.58;

    active.forEach((p, idx) => {
      // Pre-seed an initial shrimp arcing toward each chef's spatulas
      const initialFoods: SizzlingFood[] = [
        {
          id: ++this.foodIdCounter,
          type: 'shrimp',
          x: 0,
          y: -70,
          vy: 90,
          vx: 0,
          rotation: 0.3,
          vRot: 2.0,
          cookStage: 0,
          juggleCount: 0
        }
      ];

      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: griddleY - 24,
        foods: initialFoods,
        spawnTimer: 0.6 + Math.random() * 0.4,
        spatulaAnim: 0,
        spatulaAngle: 0,
        score: 0,
        combo: 0,
        shrimpServed: 0,
        flameBoostTimer: 0,
        stunTimer: 0,
        shakeTimer: 0,
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
      const st = this.playersState.get(p.id);
      if (!st) continue;

      // Update timers
      if (st.spatulaAnim > 0) st.spatulaAnim = Math.max(0, st.spatulaAnim - dt * 6);
      if (st.stunTimer > 0) st.stunTimer = Math.max(0, st.stunTimer - dt);
      if (st.shakeTimer > 0) st.shakeTimer = Math.max(0, st.shakeTimer - dt);
      if (st.flameBoostTimer > 0) st.flameBoostTimer = Math.max(0, st.flameBoostTimer - dt);

      // Update floating texts
      for (let i = st.floatingHits.length - 1; i >= 0; i--) {
        const hit = st.floatingHits[i];
        hit.y -= dt * 32;
        hit.alpha -= dt * 1.5;
        hit.scale = Math.min(1.2, hit.scale + dt * 0.8);
        if (hit.alpha <= 0) {
          st.floatingHits.splice(i, 1);
        }
      }

      // Food Spawner
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0 && st.foods.length < 4) {
        st.spawnTimer = 0.85 + Math.random() * 0.65;

        const rand = Math.random();
        let type: 'shrimp' | 'zucchini' | 'mushroom' | 'ember' = 'shrimp';
        if (rand < 0.12) {
          type = 'ember'; // Burning charcoal ember hazard!
        } else if (rand < 0.35) {
          type = 'mushroom';
        } else if (rand < 0.60) {
          type = 'zucchini';
        }

        st.foods.push({
          id: ++this.foodIdCounter,
          type,
          x: (Math.random() - 0.5) * 24,
          y: -110,
          vy: 110 + Math.random() * 30,
          vx: (Math.random() - 0.5) * 20,
          rotation: Math.random() * Math.PI,
          vRot: (Math.random() - 0.5) * 4,
          cookStage: 0,
          juggleCount: 0
        });
      }

      // Update foods on the griddle
      for (let i = st.foods.length - 1; i >= 0; i--) {
        const food = st.foods[i];
        food.y += food.vy * dt;
        food.x += food.vx * dt;
        food.vy += 490 * dt; // Gravity
        food.rotation += food.vRot * dt;

        // Food dropped onto the scorching iron grill without being juggled
        if (food.y > 18) {
          if (food.type === 'ember') {
            // Embers burn out safely on the plate
            this.particles.emit(st.x + food.x, st.y + 14, 3, '#424242');
          } else {
            // Scorched burnt food!
            st.combo = 0;
            st.score = Math.max(0, st.score - 8);
            this.audio.playExplosion();
            this.particles.emit(st.x + food.x, st.y + 14, 6, '#3E2723');

            st.floatingHits.push({
              text: 'SCORCHED! -8',
              color: '#FF1744',
              x: food.x,
              y: 0,
              alpha: 1.0,
              scale: 1.0
            });
          }
          st.foods.splice(i, 1);
        }
      }

      // Check player input
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handleSpatulaFlick(st);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  /**
   * Action handler: Lightning dual-spatula pop flip!
   */
  private handleSpatulaFlick(st: HibachiStation): void {
    if (st.stunTimer > 0) return;

    st.spatulaAnim = 1.0;

    // Strike Zone: y between -26 and 14
    let bestIdx = -1;
    let bestDist = 9999;

    for (let i = 0; i < st.foods.length; i++) {
      const f = st.foods[i];
      if (f.y >= -28 && f.y <= 16 && f.vy > 0) {
        const dist = Math.abs(f.y - (-4));
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
    }

    if (bestIdx !== -1) {
      const food = st.foods[bestIdx];

      if (food.type === 'ember') {
        // HAZARD: BURNING CHARCOAL EMBER HIT!
        st.score = Math.max(0, st.score - 20);
        st.combo = 0;
        st.stunTimer = 0.9;
        st.shakeTimer = 0.4;
        st.foods.splice(bestIdx, 1);

        this.audio.playExplosion();
        this.particles.emit(st.x, st.y, 8, '#FF3D00');

        st.floatingHits.push({
          text: 'BURNT SPATULA! -20 🔥',
          color: '#FF1744',
          x: 0,
          y: -20,
          alpha: 1.0,
          scale: 1.15
        });
      } else {
        // CLEAN SPATULA JUGGLE VOLLEY!
        food.juggleCount++;
        food.cookStage = Math.min(3, food.cookStage + 1);
        st.combo++;

        // Upward pop flip
        food.vy = -310 - Math.random() * 40;
        food.vRot = (Math.random() - 0.5) * 8;
        this.audio.playFlipper();

        if (food.cookStage >= 3) {
          // 4th volley: MASTER SERVE FLICK!
          st.shrimpServed++;
          st.flameBoostTimer = 1.0;
          const servePts = 60 + st.combo * 8;
          st.score += servePts;
          this.audio.playScore();
          this.audio.playChime();
          this.particles.spawnConfetti(st.x, st.y - 40, 16);

          st.floatingHits.push({
            text: `SERVED! +${servePts} 🍤`,
            color: '#00E676',
            x: food.x,
            y: -35,
            alpha: 1.0,
            scale: 1.25
          });

          // Serve into customer bowl
          st.foods.splice(bestIdx, 1);
        } else {
          // JUGGLE SEARING!
          let pts = 15;
          let label = 'JUGGLE!';
          if (food.cookStage === 2) {
            pts = 30;
            label = 'FLAMBÉ SEAR!';
            this.particles.spawnSparks(st.x + food.x, st.y + food.y, '#FFA000', 8);
          } else {
            this.particles.emit(st.x + food.x, st.y + food.y, 4, '#FFD54F');
          }

          const totalPts = pts + st.combo * 3;
          st.score += totalPts;

          st.floatingHits.push({
            text: st.combo > 1 ? `${label} ${st.combo}x` : `${label} +${totalPts}`,
            color: food.cookStage === 2 ? '#FF9100' : '#FFF9C4',
            x: food.x,
            y: food.y - 12,
            alpha: 1.0,
            scale: 1.0
          });
        }
      }
    } else {
      // Empty air whiff
      this.audio.playWhoosh();
      st.floatingHits.push({
        text: 'WHIFF!',
        color: '#9E9E9E',
        x: 0,
        y: -15,
        alpha: 0.7,
        scale: 0.85
      });
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

    const st = this.playersState.get(botId);
    if (!st || st.stunTimer > 0) return;

    let shouldFlick = false;
    let nextDelay = 0.2;

    const inZone = st.foods.find(f => f.y >= -24 && f.y <= 14 && f.vy > 0);

    if (inZone) {
      if (inZone.type === 'ember') {
        // Avoid hazard ember
        if (difficulty === 'bot_easy' && Math.random() < 0.3) shouldFlick = true;
        else shouldFlick = false;
      } else {
        if (difficulty === 'bot_easy') shouldFlick = Math.random() < 0.65;
        else if (difficulty === 'bot_hard') shouldFlick = Math.random() < 0.95;
        else shouldFlick = Math.random() < 0.82;
      }
    }

    if (shouldFlick) {
      this.handleSpatulaFlick(st);
    }

    nextDelay = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.20 : 0.35;
    this.botReactionTimers.set(botId, nextDelay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const st = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: st?.score || 0,
        servings: st?.shrimpServed || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topServings = scores[0]?.servings || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} juggled and served ${topServings} flambé teppanyaki master dishes!`
      : 'The hibachi iron cooled before any master servings were completed!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Japanese Teppanyaki Restaurant Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#120A08');
    bgGrad.addColorStop(0.35, '#20100C');
    bgGrad.addColorStop(0.7, '#2E1510');
    bgGrad.addColorStop(1, '#180B08');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm glowing charcoal spotlight
    const spotlight = ctx.createRadialGradient(width / 2, height * 0.4, 40, width / 2, height * 0.4, width * 0.65);
    spotlight.addColorStop(0, 'rgba(255, 112, 67, 0.14)');
    spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, width, height);

    // Teppanyaki Flat-Top Iron Grill Counter along lower screen
    const counterY = height * 0.58;
    const counterGrad = ctx.createLinearGradient(0, counterY, 0, height);
    counterGrad.addColorStop(0, '#37474F');
    counterGrad.addColorStop(0.06, '#263238');
    counterGrad.addColorStop(1, '#1A2327');
    ctx.fillStyle = counterGrad;
    ctx.fillRect(0, counterY, width, height - counterY);

    // Sizzling steel grill divider rails
    ctx.fillStyle = '#FF7043';
    ctx.fillRect(0, counterY - 4, width, 4);
    ctx.fillStyle = '#FFAB91';
    ctx.fillRect(0, counterY, width, 2);

    // 2. Instructions Pill (cleanly positioned below top HUD)
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 255, 56, 510, 26, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 112, 67, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = '#FFCCBC';
    ctx.fillText('SPATULA FLICK TO JUGGLE • SEAR & FLAMBÉ • DODGE EMBERS • SERVE CUSTOMERS!', width / 2, 73);
    ctx.restore();

    // 3. Render Hibachi Chef Stations
    for (const p of this.getActivePlayers()) {
      const st = this.playersState.get(p.id);
      if (!st) continue;

      ctx.save();

      let shakeX = 0;
      let shakeY = 0;
      if (st.shakeTimer > 0) {
        shakeX = Math.sin(st.shakeTimer * 50) * 4;
        shakeY = Math.cos(st.shakeTimer * 40) * 2;
      }
      ctx.translate(st.x + shakeX, st.y + shakeY);

      // Sizzling Iron Flat-Top Plate
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.roundRect(-42, 6, 84, 18, [4, 4, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = '#455A64';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glowing heat element beneath griddle
      const pulse = Math.sin(Date.now() * 0.008) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(255, 87, 34, ${pulse * 0.5})`;
      ctx.fillRect(-36, 12, 72, 4);

      // JUGGLE STRIKE ZONE GUIDE
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 171, 145, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-38, -20, 76, 26);
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 204, 188, 0.7)';
      ctx.font = '800 8.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('JUGGLE ZONE', 0, -8);
      ctx.restore();

      // Render Foods arcing in the air
      for (const food of st.foods) {
        ctx.save();
        ctx.translate(food.x, food.y);
        ctx.rotate(food.rotation);

        this.renderFood(ctx, food);

        ctx.restore();
      }

      // DUAL STAINLESS STEEL SPATULAS
      ctx.save();
      const spatulaLift = st.spatulaAnim > 0 ? Math.sin(st.spatulaAnim * Math.PI) * 16 : 0;
      ctx.translate(0, -spatulaLift);

      // Left spatula
      ctx.fillStyle = '#ECEFF1';
      ctx.fillRect(-22, -4, 16, 7);
      ctx.fillStyle = '#78909C';
      ctx.fillRect(-18, 3, 4, 12);

      // Right spatula
      ctx.fillStyle = '#ECEFF1';
      ctx.fillRect(6, -4, 16, 7);
      ctx.fillStyle = '#78909C';
      ctx.fillRect(14, 3, 4, 12);
      ctx.restore();

      // Customer Serving Bowl to the right
      ctx.fillStyle = '#4E342E';
      ctx.beginPath();
      ctx.arc(36, 10, 10, 0, Math.PI);
      ctx.closePath();
      ctx.fill();

      // Flambé celebration fire burst
      if (st.flameBoostTimer > 0) {
        ctx.fillStyle = '#FF3D00';
        ctx.font = '22px sans-serif';
        ctx.fillText('🔥', -11, -30);
      }

      // STUN WARNING OVERLAY
      if (st.stunTimer > 0) {
        ctx.fillStyle = 'rgba(211, 47, 47, 0.85)';
        ctx.beginPath();
        ctx.roundRect(-38, -35, 76, 24, 4);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🔥 BURNT!', 0, -20);
      }

      // Floating hit texts
      for (const hit of st.floatingHits) {
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

      ctx.fillStyle = '#1D1311';
      ctx.beginPath();
      ctx.roundRect(st.x - cardW / 2, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px sans-serif';
      ctx.fillText(p.name, st.x, cardY + 17);

      ctx.font = '900 18px monospace';
      ctx.fillStyle = '#FFD54F';
      ctx.fillText(`${st.score}`, st.x, cardY + 34);

      if (st.combo >= 2) {
        ctx.fillStyle = '#FF7043';
        ctx.font = '800 10px monospace';
        ctx.fillText(`🔥 ${st.combo}x JUGGLE`, st.x, cardY + 47);
      } else {
        ctx.fillStyle = '#FFAB91';
        ctx.font = '700 9px monospace';
        ctx.fillText(`🍤 Served: ${st.shrimpServed}`, st.x, cardY + 47);
      }

      ctx.restore();
    }
  }

  private renderFood(ctx: CanvasRenderingContext2D, food: SizzlingFood): void {
    if (food.type === 'ember') {
      // Hot charcoal ember
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF3D00';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (food.type === 'zucchini') {
      // Zucchini slice
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = food.cookStage >= 2 ? '#C8E6C9' : '#DCEDC8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (food.type === 'mushroom') {
      // Garlic mushroom
      ctx.fillStyle = food.cookStage >= 2 ? '#8D6E63' : '#D7CCC8';
      ctx.beginPath();
      ctx.arc(0, -1, 5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#795548';
      ctx.fillRect(-1.5, -1, 3, 4);
    } else {
      // Jumbo Tiger Shrimp
      // Color evolves: raw (translucent grey/pink) -> seared (bright pink) -> flambé (golden orange with grill marks)
      let shrimpColor = '#CFD8DC';
      if (food.cookStage === 1) shrimpColor = '#FF8A80';
      else if (food.cookStage >= 2) shrimpColor = '#FF6E40';

      ctx.fillStyle = shrimpColor;
      ctx.beginPath();
      ctx.arc(0, 0, 7, -0.8, 2.2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = shrimpColor;
      ctx.stroke();

      // Tail fan
      ctx.fillStyle = '#D32F2F';
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.lineTo(-9, 8);
      ctx.lineTo(-4, 9);
      ctx.closePath();
      ctx.fill();

      // Flambé glow / grill stripes
      if (food.cookStage >= 2) {
        ctx.fillStyle = '#FFD54F';
        ctx.fillRect(-2, -3, 2, 2);
        ctx.fillRect(1, -2, 2, 2);
      }
    }
  }
}
