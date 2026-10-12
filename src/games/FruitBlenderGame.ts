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

interface JuiceSplatter {
  x: number;
  y: number;
  r: number;
  color: string;
  alpha: number;
}

interface FallingIngredient {
  id: number;
  type: 'strawberry' | 'banana' | 'watermelon' | 'pineapple' | 'spoon';
  x: number;
  y: number;
  vy: number;
  rotation: number;
  vRot: number;
  scale: number;
}

interface BlenderStation {
  id: PlayerId;
  x: number;
  y: number;
  ingredients: FallingIngredient[];
  spawnTimer: number;
  liquidProgress: number; // 0 to 100%
  liquidColor: string;
  bladeSpeed: number;
  bladeAngle: number;
  smoothiesServed: number;
  score: number;
  combo: number;
  pulseAnim: number;
  jamTimer: number;
  jamMaxTimer: number;
  whiffCooldown: number;
  shakeTimer: number;
  serveCelebrationTimer: number;
  splatters: JuiceSplatter[];
  floatingHits: FloatingHit[];
}

export class FruitBlenderGame extends BaseGame {
  public playersState: Map<PlayerId, BlenderStation> = new Map();
  public currentMapName: string = 'Tropical Juice Bar';

  private ingredientIdCounter: number = 0;
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
    const counterY = height * 0.58;

    active.forEach((p, idx) => {
      // Pre-seed an initial juicy fruit drifting down into each pitcher
      const initialIngredients: FallingIngredient[] = [
        {
          id: ++this.ingredientIdCounter,
          type: 'strawberry',
          x: (Math.random() - 0.5) * 16,
          y: -40,
          vy: 110,
          rotation: 0.2,
          vRot: 1.5,
          scale: 1.0
        },
        {
          id: ++this.ingredientIdCounter,
          type: 'banana',
          x: (Math.random() - 0.5) * 16,
          y: -95,
          vy: 120,
          rotation: -0.5,
          vRot: -1.2,
          scale: 1.0
        }
      ];

      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: counterY - 26,
        ingredients: initialIngredients,
        spawnTimer: 0.8 + Math.random() * 0.4,
        liquidProgress: 15,
        liquidColor: '#FF4081',
        bladeSpeed: 100,
        bladeAngle: 0,
        smoothiesServed: 0,
        score: 0,
        combo: 0,
        pulseAnim: 0,
        jamTimer: 0,
        jamMaxTimer: 1.1,
        whiffCooldown: 0,
        shakeTimer: 0,
        serveCelebrationTimer: 0,
        splatters: [],
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

      // Update timers & animations
      if (st.pulseAnim > 0) st.pulseAnim = Math.max(0, st.pulseAnim - dt * 5);
      if (st.jamTimer > 0) st.jamTimer = Math.max(0, st.jamTimer - dt);
      if (st.whiffCooldown > 0) st.whiffCooldown = Math.max(0, st.whiffCooldown - dt);
      if (st.shakeTimer > 0) st.shakeTimer = Math.max(0, st.shakeTimer - dt);
      if (st.serveCelebrationTimer > 0) st.serveCelebrationTimer = Math.max(0, st.serveCelebrationTimer - dt);

      // Blade spin physics
      st.bladeAngle += (st.bladeSpeed * dt * Math.PI) / 180;
      st.bladeSpeed = Math.max(80, st.bladeSpeed - 240 * dt);

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

      // Update splatters sliding down glass
      for (let i = st.splatters.length - 1; i >= 0; i--) {
        const splat = st.splatters[i];
        splat.y += dt * 8;
        splat.alpha -= dt * 0.4;
        if (splat.alpha <= 0) {
          st.splatters.splice(i, 1);
        }
      }

      // Ingredient Spawner
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0 && st.ingredients.length < 5) {
        st.spawnTimer = 0.75 + Math.random() * 0.55;

        // Ingredient probability: 32% Strawberry, 28% Banana, 20% Watermelon, 10% Pineapple, 10% Metal Spoon Hazard
        const rand = Math.random();
        let type: 'strawberry' | 'banana' | 'watermelon' | 'pineapple' | 'spoon' = 'strawberry';
        let vy = 115 + Math.random() * 35;

        if (rand < 0.10) {
          type = 'spoon'; // Hazard!
          vy = 145 + Math.random() * 40;
        } else if (rand < 0.20) {
          type = 'pineapple'; // Jackpot!
          vy = 130 + Math.random() * 30;
        } else if (rand < 0.40) {
          type = 'watermelon';
          vy = 125 + Math.random() * 30;
        } else if (rand < 0.68) {
          type = 'banana';
          vy = 115 + Math.random() * 25;
        }

        st.ingredients.push({
          id: ++this.ingredientIdCounter,
          type,
          x: (Math.random() - 0.5) * 20,
          y: -105,
          vy,
          rotation: (Math.random() - 0.5) * 1.5,
          vRot: (Math.random() - 0.5) * 3,
          scale: 1.0
        });
      }

      // Update falling ingredients
      for (let i = st.ingredients.length - 1; i >= 0; i--) {
        const item = st.ingredients[i];
        item.y += item.vy * dt;
        item.rotation += item.vRot * dt;

        // Fall past blades without being blended
        if (item.y > 22) {
          if (item.type === 'spoon') {
            // Dodged danger successfully!
            this.audio.playBounce();
            st.floatingHits.push({
              text: 'DODGED! 🛡️',
              color: '#81C784',
              x: 0,
              y: 8,
              alpha: 0.9,
              scale: 0.9
            });
          } else {
            // Unblended fruit drops into the drain
            const splatColor = this.getFruitColor(item.type);
            this.particles.emit(st.x + item.x, st.y + 18, 3, splatColor);
          }
          st.ingredients.splice(i, 1);
        }
      }

      // Check player input
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handlePulse(st);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  /**
   * Action handler: Pulses blender blades into overdrive to chop and blitz fruits in the Blitz Zone
   */
  private handlePulse(st: PopperStationLike): void {
    // 1. If currently jammed from chopping a metal spoon, input is locked out
    if (st.jamTimer > 0) {
      this.audio.playTone(150, 0.08, 'sawtooth');
      return;
    }

    // 2. If whiff cooldown active, ignore fast button mashing
    if (st.whiffCooldown > 0) {
      return;
    }

    // Trigger visual pulse & blade surge
    st.pulseAnim = 1.0;
    st.bladeSpeed = 850;

    // 3. Find candidate ingredient in the Blitz Strike Zone (-20 to 14)
    let bestIdx = -1;
    let bestDist = 9999;
    const bladeLevel = 0; // Blade center level

    for (let i = 0; i < st.ingredients.length; i++) {
      const item = st.ingredients[i];
      if (item.y >= -24 && item.y <= 16) {
        const dist = Math.abs(item.y - bladeLevel);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
    }

    // 4. Process strike
    if (bestIdx !== -1) {
      const target = st.ingredients[bestIdx];

      if (target.type === 'spoon') {
        // HAZARD: BLADE JAMMED!
        st.score = Math.max(0, st.score - 25);
        st.combo = 0;
        st.jamTimer = 1.1;
        st.jamMaxTimer = 1.1;
        st.shakeTimer = 0.45;
        st.bladeSpeed = 0;
        st.ingredients.splice(bestIdx, 1);

        this.audio.playExplosion();
        this.particles.emit(st.x, st.y, 8, '#78909C');
        this.particles.spawnSparks(st.x, st.y, '#FF3D00', 10);

        st.floatingHits.push({
          text: 'BLADE JAMMED! -25',
          color: '#FF1744',
          x: 0,
          y: -20,
          alpha: 1.0,
          scale: 1.1
        });
      } else {
        // FRUIT BLITZ!
        const isPerfect = target.y >= -10 && target.y <= 8;
        st.combo++;
        const fruitColor = this.getFruitColor(target.type);

        let pts = 20;
        let fruitName = 'BERRY';

        if (target.type === 'pineapple') {
          pts = isPerfect ? 75 : 55;
          fruitName = 'PINEAPPLE';
          this.audio.playScore();
          this.particles.spawnSparks(st.x, st.y - 10, '#FFD700', 14);
        } else if (target.type === 'watermelon') {
          pts = isPerfect ? 50 : 35;
          fruitName = 'MELON';
          this.audio.playScore();
          this.particles.emit(st.x, st.y - 8, 8, '#FF5252');
        } else if (target.type === 'banana') {
          pts = isPerfect ? 35 : 25;
          fruitName = 'BANANA';
          this.audio.playTap();
          this.particles.emit(st.x, st.y - 8, 6, '#FDD835');
        } else {
          pts = isPerfect ? 30 : 20;
          fruitName = 'BERRY';
          this.audio.playTap();
          this.particles.emit(st.x, st.y - 8, 6, '#FF4081');
        }

        const totalPts = pts + st.combo * 4;
        st.score += totalPts;
        st.liquidColor = fruitColor;
        st.liquidProgress = Math.min(100, st.liquidProgress + 25);

        // Splatters on glass
        st.splatters.push({
          x: (Math.random() - 0.5) * 36,
          y: -30 + Math.random() * 30,
          r: 3 + Math.random() * 4,
          color: fruitColor,
          alpha: 0.85
        });

        st.floatingHits.push({
          text: isPerfect
            ? (st.combo > 1 ? `PERFECT ${fruitName}! ${st.combo}x` : `PERFECT ${fruitName}! +${totalPts}`)
            : `BLITZ! +${totalPts}`,
          color: isPerfect ? '#FFEE58' : '#FFFFFF',
          x: target.x,
          y: target.y - 14,
          alpha: 1.0,
          scale: isPerfect ? 1.15 : 0.95
        });

        st.ingredients.splice(bestIdx, 1);

        // Check if smoothie completed (100% capacity)
        if (st.liquidProgress >= 100) {
          st.smoothiesServed++;
          const serveBonus = 80 + st.combo * 10;
          st.score += serveBonus;
          st.liquidProgress = 0;
          st.serveCelebrationTimer = 1.2;

          this.audio.playChime();
          this.particles.spawnConfetti(st.x, st.y - 50, 18);

          st.floatingHits.push({
            text: 'SMOOTHIE SERVED! +80 🍹',
            color: '#00E676',
            x: 0,
            y: -50,
            alpha: 1.0,
            scale: 1.25
          });
        }
      }
    } else {
      // 5. Whiffed empty pulse
      st.whiffCooldown = 0.42;
      this.audio.playWhoosh();
      this.particles.emit(st.x, st.y + 4, 3, '#B0BEC5');

      st.floatingHits.push({
        text: 'WHIFF!',
        color: '#B0BEC5',
        x: 0,
        y: -15,
        alpha: 0.7,
        scale: 0.85
      });
    }
  }

  private getFruitColor(type: string): string {
    switch (type) {
      case 'pineapple': return '#FFA000';
      case 'watermelon': return '#FF5252';
      case 'banana': return '#FDD835';
      case 'strawberry': default: return '#E91E63';
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
    if (!st) return;

    if (st.jamTimer > 0 || st.whiffCooldown > 0) {
      this.botReactionTimers.set(botId, 0.15);
      return;
    }

    let shouldPulse = false;
    let nextDelay = 0.2;

    const inZone = st.ingredients.find(item => item.y >= -20 && item.y <= 12);

    if (difficulty === 'bot_easy') {
      nextDelay = 0.38 + Math.random() * 0.2;
      if (inZone) {
        if (inZone.type === 'spoon' && Math.random() < 0.35) {
          shouldPulse = true; // Mistake on hazard
        } else if (inZone.type !== 'spoon' && Math.random() < 0.65) {
          shouldPulse = true;
        }
      } else if (Math.random() < 0.08) {
        shouldPulse = true; // Random whiff
      }
    } else if (difficulty === 'bot_hard') {
      nextDelay = 0.10 + Math.random() * 0.08;
      // High-precision timing on fruits, 100% hazard avoidance
      const perfectFruit = st.ingredients.find(item => item.type !== 'spoon' && item.y >= -10 && item.y <= 8);
      if (perfectFruit && Math.random() < 0.94) {
        shouldPulse = true;
      }
    } else {
      // Normal bot
      nextDelay = 0.20 + Math.random() * 0.12;
      if (inZone) {
        if (inZone.type === 'spoon') {
          if (Math.random() < 0.12) shouldPulse = true; // Rare mistake
        } else if (Math.random() < 0.82) {
          shouldPulse = true;
        }
      }
    }

    if (shouldPulse) {
      this.handlePulse(st);
    }

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
        smoothies: st?.smoothiesServed || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topSmoothies = scores[0]?.smoothies || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} blended and served ${topSmoothies} gourmet tropical smoothies!`
      : 'The blender jars sat empty with unmashed fruit!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Tropical Juice Bar Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0E1A10');
    bgGrad.addColorStop(0.35, '#162E1C');
    bgGrad.addColorStop(0.7, '#1F4229');
    bgGrad.addColorStop(1, '#112415');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm tropical beach bar spotlight
    const spotlight = ctx.createRadialGradient(width / 2, height * 0.35, 40, width / 2, height * 0.35, width * 0.6);
    spotlight.addColorStop(0, 'rgba(255, 249, 196, 0.12)');
    spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, width, height);

    // Tropical Bar Counter along lower screen
    const counterY = height * 0.58;
    const counterGrad = ctx.createLinearGradient(0, counterY, 0, height);
    counterGrad.addColorStop(0, '#5D4037');
    counterGrad.addColorStop(0.06, '#3E2723');
    counterGrad.addColorStop(1, '#271916');
    ctx.fillStyle = counterGrad;
    ctx.fillRect(0, counterY, width, height - counterY);

    // Polished bamboo counter trim
    ctx.fillStyle = '#C8E6C9';
    ctx.fillRect(0, counterY - 4, width, 4);
    ctx.fillStyle = '#81C784';
    ctx.fillRect(0, counterY, width, 2);

    // 2. Instructions Pill (cleanly positioned below top HUD)
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 255, 56, 510, 26, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(129, 199, 132, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = '#C8E6C9';
    ctx.fillText('BLITZ AT THE BLADES! • AVOID METAL SPOONS • FILL & SERVE SMOOTHIES!', width / 2, 73);
    ctx.restore();

    // 3. Render Blender Stations
    for (const p of this.getActivePlayers()) {
      const st = this.playersState.get(p.id);
      if (!st) continue;

      ctx.save();

      // Station vibration shake
      let shakeX = 0;
      let shakeY = 0;
      if (st.shakeTimer > 0) {
        shakeX = Math.sin(st.shakeTimer * 50) * 4;
        shakeY = Math.cos(st.shakeTimer * 40) * 2;
      }
      ctx.translate(st.x + shakeX, st.y + shakeY);

      // Glass Pitcher dimensions
      const pitcherW = 68;
      const pitcherH = 100;
      const pitcherTop = -90;

      // Overhead Fruit Chute Dispenser
      ctx.fillStyle = '#37474F';
      ctx.beginPath();
      ctx.roundRect(-22, pitcherTop - 14, 44, 12, [4, 4, 1, 1]);
      ctx.fill();
      ctx.fillStyle = '#78909C';
      ctx.fillRect(-18, pitcherTop - 4, 36, 4);

      // Glass Pitcher Chamber
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(-pitcherW / 2, pitcherTop, pitcherW, pitcherH);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(-pitcherW / 2, pitcherTop, pitcherW, pitcherH);

      // Liquid Fill inside Pitcher
      const maxLiquidHeight = 78;
      const curLiquidHeight = (st.liquidProgress / 100) * maxLiquidHeight;

      if (curLiquidHeight > 0) {
        ctx.save();
        ctx.beginPath();
        const liquidTopY = 10 - curLiquidHeight;

        // Waveform surface
        ctx.moveTo(-pitcherW / 2 + 2, liquidTopY);
        for (let lx = -pitcherW / 2 + 2; lx <= pitcherW / 2 - 2; lx += 4) {
          const wave = Math.sin(Date.now() * 0.008 + lx * 0.15) * (st.pulseAnim > 0 ? 3.5 : 1.5);
          // Whirlpool vortex dip at center when pulsing
          const vortexDip = st.pulseAnim > 0 ? Math.max(0, 6 - Math.abs(lx) * 0.2) : 0;
          ctx.lineTo(lx, liquidTopY + wave + vortexDip);
        }
        ctx.lineTo(pitcherW / 2 - 2, 10);
        ctx.lineTo(-pitcherW / 2 + 2, 10);
        ctx.closePath();

        ctx.fillStyle = st.liquidColor;
        ctx.globalAlpha = 0.75;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Foam / Bubble cap on surface
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(-pitcherW / 2 + 4, liquidTopY - 2, pitcherW - 8, 3);
        ctx.globalAlpha = 1.0;
        ctx.restore();
      }

      // Measurement Notches on glass
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(-pitcherW / 2 + 3, pitcherTop + 24, 8, 1.5);
      ctx.fillRect(-pitcherW / 2 + 3, pitcherTop + 46, 8, 1.5);
      ctx.fillRect(-pitcherW / 2 + 3, pitcherTop + 68, 8, 1.5);

      // Internal Glass Splatters
      for (const splat of st.splatters) {
        ctx.fillStyle = splat.color;
        ctx.globalAlpha = Math.max(0, splat.alpha);
        ctx.beginPath();
        ctx.arc(splat.x, splat.y, splat.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // BLITZ ZONE TARGET RETICLE
      ctx.save();
      ctx.strokeStyle = 'rgba(129, 199, 132, 0.55)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-pitcherW / 2 + 5, -14, pitcherW - 10, 22);
      ctx.setLineDash([]);

      ctx.fillStyle = '#C8E6C9';
      ctx.font = '800 8.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BLITZ ZONE', 0, -3);
      ctx.restore();

      // Render Falling Ingredients
      for (const item of st.ingredients) {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.rotation);

        this.renderIngredient(ctx, item.type);

        ctx.restore();
      }

      // Glass Pitcher Highlights & Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-pitcherW / 2, pitcherTop, pitcherW, pitcherH);

      // Glass glare reflection stripe
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.moveTo(-pitcherW / 2 + 5, pitcherTop + 2);
      ctx.lineTo(-pitcherW / 2 + 15, pitcherTop + 2);
      ctx.lineTo(-pitcherW / 2 + 3, pitcherTop + pitcherH - 8);
      ctx.lineTo(-pitcherW / 2 + 1, pitcherTop + pitcherH - 8);
      ctx.closePath();
      ctx.fill();

      // Stainless Steel Blender Blades at bottom
      ctx.save();
      ctx.translate(0, 8);
      ctx.rotate(st.bladeAngle);

      ctx.fillStyle = '#ECEFF1';
      ctx.fillRect(-14, -2.5, 28, 5);
      ctx.fillRect(-2.5, -14, 5, 28);
      ctx.fillStyle = '#B0BEC5';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Blender Motor Base Unit
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-pitcherW / 2 - 4, 10, pitcherW + 8, 22, [4, 4, 6, 6]);
      ctx.fill();
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Chrome Rotary Control Knob & LED
      ctx.fillStyle = '#CFD8DC';
      ctx.beginPath();
      ctx.arc(0, 21, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#37474F';
      ctx.fillRect(-1, 16, 2, 5);

      // Speed indicator LED
      ctx.fillStyle = st.pulseAnim > 0 ? '#00E676' : '#FFD54F';
      ctx.beginPath();
      ctx.arc(pitcherW / 2 - 8, 21, 3, 0, Math.PI * 2);
      ctx.fill();

      // JAMMED WARNING OVERLAY
      if (st.jamTimer > 0) {
        const jamRatio = st.jamTimer / st.jamMaxTimer;
        ctx.fillStyle = 'rgba(211, 47, 47, 0.88)';
        ctx.beginPath();
        ctx.roundRect(-pitcherW / 2 + 2, -45, pitcherW - 4, 28, 4);
        ctx.fill();
        ctx.strokeStyle = '#FFCDD2';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 9.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ MOTOR JAMMED!', 0, -32);

        // Lockout progress bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(-pitcherW / 2 + 6, -26, pitcherW - 12, 4);
        ctx.fillStyle = '#FFEB3B';
        ctx.fillRect(-pitcherW / 2 + 6, -26, (pitcherW - 12) * (1 - jamRatio), 4);
      }

      // SMOOTHIE SERVED CELEBRATION COCKTAIL GLASS
      if (st.serveCelebrationTimer > 0) {
        ctx.save();
        ctx.translate(pitcherW / 2 + 18, -10);

        // Chilled Glass
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(-8, -25, 16, 32);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-8, -25, 16, 32);

        // Smoothie liquid inside glass
        ctx.fillStyle = st.liquidColor;
        ctx.fillRect(-7, -23, 14, 28);

        // Foam head
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-7, -25, 14, 3);

        // Little Cocktail Umbrella
        ctx.fillStyle = '#FF4081';
        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.lineTo(-12, -26);
        ctx.lineTo(12, -26);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#FFD54F';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.lineTo(4, -14);
        ctx.stroke();

        ctx.restore();
      }

      // Floating hit texts
      for (const hit of st.floatingHits) {
        ctx.save();
        ctx.translate(hit.x, hit.y);
        ctx.scale(hit.scale, hit.scale);
        ctx.globalAlpha = Math.max(0, hit.alpha);
        ctx.font = '900 12px sans-serif';
        ctx.textAlign = 'center';

        // Dark outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(hit.text, 0, 0);

        ctx.fillStyle = hit.color;
        ctx.fillText(hit.text, 0, 0);
        ctx.restore();
      }

      ctx.restore();

      // 4. Station Player Card & Scoreboard affixed to counter front
      ctx.save();
      const cardY = counterY + 14;
      const cardW = 100;
      const cardH = 54;

      // Card bevel background
      ctx.fillStyle = '#172319';
      ctx.beginPath();
      ctx.roundRect(st.x - cardW / 2, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Player name & score
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px sans-serif';
      ctx.fillText(p.name, st.x, cardY + 17);

      ctx.font = '900 18px monospace';
      ctx.fillStyle = '#FFD54F';
      ctx.fillText(`${st.score}`, st.x, cardY + 34);

      // Streak/combo or smoothie count badge
      if (st.combo >= 2) {
        ctx.fillStyle = '#FF7043';
        ctx.font = '800 10px monospace';
        ctx.fillText(`🔥 ${st.combo}x STREAK`, st.x, cardY + 47);
      } else {
        ctx.fillStyle = '#C8E6C9';
        ctx.font = '700 9px monospace';
        ctx.fillText(`🍹 Served: ${st.smoothiesServed}`, st.x, cardY + 47);
      }

      ctx.restore();
    }
  }

  /**
   * Procedural vector rendering for each fruit / hazard type
   */
  private renderIngredient(ctx: CanvasRenderingContext2D, type: string): void {
    if (type === 'spoon') {
      // Metallic spoon hazard with warning icon
      ctx.fillStyle = '#CFD8DC';
      ctx.beginPath();
      ctx.ellipse(0, -6, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-1.5, 2, 3, 14);

      ctx.fillStyle = '#B0BEC5';
      ctx.fillRect(-1, 4, 2, 12);

      // Red hazard glow
      ctx.fillStyle = '#FF1744';
      ctx.beginPath();
      ctx.arc(0, -6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'pineapple') {
      // Golden Pineapple
      ctx.fillStyle = '#FFA000';
      ctx.beginPath();
      ctx.ellipse(0, 2, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Texture criss-cross
      ctx.strokeStyle = '#FF6F00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5, -4); ctx.lineTo(5, 8);
      ctx.moveTo(5, -4); ctx.lineTo(-5, 8);
      ctx.stroke();

      // Green spiked crown leaves
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-6, -17);
      ctx.lineTo(-2, -12);
      ctx.lineTo(0, -20);
      ctx.lineTo(2, -12);
      ctx.lineTo(6, -17);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'watermelon') {
      // Watermelon Slice
      ctx.fillStyle = '#2E7D32'; // Rind
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0.2, Math.PI - 0.2);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FF5252'; // Flesh
      ctx.beginPath();
      ctx.arc(0, -1, 9, 0.3, Math.PI - 0.3);
      ctx.lineTo(0, -1);
      ctx.closePath();
      ctx.fill();

      // Seeds
      ctx.fillStyle = '#212121';
      ctx.fillRect(-3, 3, 1.5, 1.5);
      ctx.fillRect(2, 3, 1.5, 1.5);
      ctx.fillRect(0, 6, 1.5, 1.5);
    } else if (type === 'banana') {
      // Curved Banana
      ctx.fillStyle = '#FDD835';
      ctx.beginPath();
      ctx.arc(0, 0, 9, -0.6, 1.8);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#FDD835';
      ctx.stroke();

      ctx.fillStyle = '#795548';
      ctx.fillRect(6, -6, 2.5, 2.5);
    } else {
      // Fresh Strawberry
      ctx.fillStyle = '#E91E63';
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.quadraticCurveTo(8, 4, 7, -4);
      ctx.quadraticCurveTo(0, -7, -7, -4);
      ctx.quadraticCurveTo(-8, 4, 0, 10);
      ctx.fill();

      // Green calyx top leaves
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(-6, -10);
      ctx.lineTo(-2, -6);
      ctx.lineTo(0, -11);
      ctx.lineTo(2, -6);
      ctx.lineTo(6, -10);
      ctx.closePath();
      ctx.fill();

      // Yellow seeds
      ctx.fillStyle = '#FFF59D';
      ctx.fillRect(-2, -1, 1, 1.5);
      ctx.fillRect(2, -1, 1, 1.5);
      ctx.fillRect(0, 3, 1, 1.5);
    }
  }
}

// Helper type alias for internal method signatures
type PopperStationLike = BlenderStation;
