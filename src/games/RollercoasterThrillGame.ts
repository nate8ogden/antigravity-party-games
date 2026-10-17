import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface TrackCurveEvent {
  id: number;
  y: number; // 0 (top horizon) to height
  type: 'left_bank' | 'right_bank' | 'loop_de_loop' | 'airtime_drop';
  label: string;
  handledBy: Set<PlayerId>;
}

interface TrackLoot {
  id: number;
  xRatio: number; // -1 (left rail) to 1 (right rail)
  y: number;
  type: 'track_coin' | 'thrill_ticket' | 'diamond_gem';
  value: number;
  radius: number;
  collected: boolean;
}

interface CoasterCart {
  id: PlayerId;
  xRatio: number; // -1 (far left) to 1 (far right)
  vx: number;
  lean: number; // visual tilt angle
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  boostTimer: number; // Supersonic rail overdrive active
  wobbleTimer: number; // Spinout / stagger from mis-lean or shunt
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  sabotageCount: number;
  perfectCurvesCount: number;
  mood: CharacterMood;
  animTimer: number;
  isUnderdog: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  railColor: string;
  tieColor: string;
  accentGlow: string;
  cartFinishes: string[];
}

const THEMES: VisualTheme[] = [
  {
    name: 'Twisted Timber Boardwalk',
    icon: '🪵',
    bgTop: '#1E1B4B',
    bgBottom: '#451A03',
    railColor: '#D97706',
    tieColor: '#78350F',
    accentGlow: '#F59E0B',
    cartFinishes: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B']
  },
  {
    name: 'Neon Viper Hyperspeed',
    icon: '⚡',
    bgTop: '#050B14',
    bgBottom: '#020617',
    railColor: '#00F0FF',
    tieColor: '#1E293B',
    accentGlow: '#00F0FF',
    cartFinishes: ['#FF007F', '#00F0FF', '#39FF14', '#FFD700']
  },
  {
    name: 'Gothic Phantom Mine',
    icon: '🦇',
    bgTop: '#17051A',
    bgBottom: '#08010B',
    railColor: '#A855F7',
    tieColor: '#3B0764',
    accentGlow: '#C084FC',
    cartFinishes: ['#F43F5E', '#A855F7', '#14B8A6', '#F59E0B']
  }
];

export class RollercoasterThrillGame extends BaseGame {
  private carts: Map<PlayerId, CoasterCart> = new Map();
  private curves: TrackCurveEvent[] = [];
  private curveSpawnTimer: number = 1.4;
  private nextCurveId: number = 1;

  private lootItems: TrackLoot[] = [];
  private nextLootId: number = 1;
  private lootSpawnTimer: number = 0.8;

  private trackScrollOffset: number = 0;
  private coasterMPH: number = 95;
  private trackCurvature: number = 0; // Visual track bend (-1 left to +1 right)
  private targetCurvature: number = 0;

  private currentThemeIdx: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private clickListener: ((e: MouseEvent) => void) | null = null;
  private lastCanvasWidth: number = 800;
  private lastCanvasHeight: number = 600;

  // Bot sensory perception buffers
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupThemeListeners();
    this.reset(width, height);
  }

  private setupThemeListeners(): void {
    if (typeof window === 'undefined') return;

    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setTheme(0);
      } else if (e.key === '2') {
        this.setTheme(1);
      } else if (e.key === '3') {
        this.setTheme(2);
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.clickListener = (e: MouseEvent) => {
      const rect = {
        x: 20,
        y: this.lastCanvasHeight - 44,
        w: 170,
        h: 32
      };
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const cRect = canvas.getBoundingClientRect();
      const scaleX = this.lastCanvasWidth / cRect.width;
      const scaleY = this.lastCanvasHeight / cRect.height;
      const mx = (e.clientX - cRect.left) * scaleX;
      const my = (e.clientY - cRect.top) * scaleY;

      if (mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickListener);
  }

  private cycleTheme(): void {
    this.currentThemeIdx = (this.currentThemeIdx + 1) % THEMES.length;
    this.audio.playTone(560 + this.currentThemeIdx * 80, 0.08, 'triangle');
  }

  private setTheme(idx: number): void {
    if (idx >= 0 && idx < THEMES.length) {
      this.currentThemeIdx = idx;
      this.audio.playTone(560 + this.currentThemeIdx * 80, 0.08, 'triangle');
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastCanvasWidth = width;
    this.lastCanvasHeight = height;
    this.carts.clear();
    this.curves = [];
    this.lootItems = [];
    this.botReactionTimers.clear();
    this.curveSpawnTimer = 1.2;
    this.lootSpawnTimer = 0.5;
    this.trackScrollOffset = 0;
    this.coasterMPH = 95;
    this.trackCurvature = 0;
    this.targetCurvature = 0;
    this.roundTimer = 35.0;
    this.isFinished = false;

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      // Space carts across track ratios (-0.75 to +0.75)
      const ratio = count === 1 ? 0 : -0.75 + (1.5 / (count - 1)) * idx;
      this.carts.set(p.id, {
        id: p.id,
        xRatio: ratio,
        vx: 0,
        lean: 0,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        boostTimer: 0,
        wobbleTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        sabotageCount: 0,
        perfectCurvesCount: 0,
        mood: 'idle',
        animTimer: 0,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastCanvasWidth = width;
    this.lastCanvasHeight = height;
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    const isSuddenDeath = this.roundTimer <= 12.0;
    this.coasterMPH = isSuddenDeath ? 145 : 95;

    // Track scroll velocity
    const scrollSpeed = (this.coasterMPH / 95) * 520;
    this.trackScrollOffset = (this.trackScrollOffset + dt * scrollSpeed) % 60;

    // Update Underdog status (trailing by >= 35 points)
    let maxScore = -Infinity;
    for (const c of this.carts.values()) {
      if (c.score > maxScore) maxScore = c.score;
    }
    for (const c of this.carts.values()) {
      c.isUnderdog = maxScore - c.score >= 35 && maxScore > 20;
    }

    // Bot AI decision cycle
    this.updateBots(dt, width, height);

    // Update Coaster Carts
    this.updateCarts(dt, isSuddenDeath);

    // Physical Cart-to-Cart rail collisions
    this.handleCartCollisions(width);

    // Update Track Curves & Inversions
    this.updateCurves(dt, width, height, isSuddenDeath);

    // Dynamic Track Curvature: Bend perspective towards incoming banking curve
    const cartY = height - 110;
    const nextCurve = this.curves.find(c => c.y < cartY + 120 && c.y > 0);
    if (nextCurve) {
      if (nextCurve.type === 'left_bank') this.targetCurvature = -0.55;
      else if (nextCurve.type === 'right_bank') this.targetCurvature = 0.55;
      else if (nextCurve.type === 'loop_de_loop') this.targetCurvature = Math.sin(this.roundTimer * 8) * 0.25;
      else this.targetCurvature = 0;
    } else {
      this.targetCurvature = 0;
    }
    this.trackCurvature += (this.targetCurvature - this.trackCurvature) * Math.min(1, dt * 5.0);

    // Update Track Loot
    this.updateTrackLoot(dt, width, height, isSuddenDeath);
  }

  private updateCarts(dt: number, isSuddenDeath: boolean): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const cart = this.carts.get(p.id);
      if (!cart) continue;

      cart.animTimer += dt;
      if (cart.streakTimer > 0) {
        cart.streakTimer -= dt;
        if (cart.streakTimer <= 0) cart.streakCount = 0;
      }

      if (cart.stunTimer > 0) cart.stunTimer -= dt;
      if (cart.wobbleTimer > 0) {
        cart.wobbleTimer -= dt;
        cart.vx *= Math.pow(0.1, dt);
        cart.xRatio += cart.vx * dt;
        cart.xRatio = Math.max(-0.95, Math.min(0.95, cart.xRatio));
        continue;
      }

      if (cart.boostTimer > 0) {
        cart.boostTimer -= dt;
        // Boost particle trail
        if (Math.random() < 0.4) {
          const theme = THEMES[this.currentThemeIdx];
          const cx = this.lastCanvasWidth / 2 + cart.xRatio * (this.lastCanvasWidth * 0.32);
          this.particles.emit(cx, this.lastCanvasHeight - 110, 2, theme.accentGlow);
        }
      }

      // Read steer & throttle inputs
      const steerX = this.input.getSteer(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const actionJustPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);

      const lateralSpeed = (cart.isUnderdog ? 2.4 : 1.9) * (cart.boostTimer > 0 ? 1.4 : 1.0);

      // Mobile / One-Touch Smart Banking Assist:
      // Tapping action when approaching a banking curve snaps cart into optimal centrifugal lean angle!
      if (actionJustPressed) {
        const cartY = this.lastCanvasHeight - 110;
        const upcomingCurve = this.curves.find(c => c.y < cartY + 180 && c.y > 0 && !c.handledBy.has(p.id));
        if (upcomingCurve) {
          if (upcomingCurve.type === 'left_bank') {
            cart.vx = -1.6;
            cart.lean = -0.55;
            this.audio.playTone(520, 0.08, 'sine');
          } else if (upcomingCurve.type === 'right_bank') {
            cart.vx = 1.6;
            cart.lean = 0.55;
            this.audio.playTone(520, 0.08, 'sine');
          } else if (upcomingCurve.type === 'loop_de_loop') {
            cart.boostTimer = Math.max(cart.boostTimer, 0.6);
            this.audio.playBoost();
          } else if (upcomingCurve.type === 'airtime_drop') {
            cart.xRatio *= 0.4;
            cart.lean = 0;
            this.audio.playTone(600, 0.08, 'triangle');
          }
        }
      }

      // Lateral banking along rails
      if (Math.abs(steerX) > 0.08) {
        cart.vx += steerX * lateralSpeed * dt * 8.0;
        cart.lean += (steerX * 0.45 - cart.lean) * dt * 10.0;
      } else {
        cart.lean += (0 - cart.lean) * dt * 8.0;
      }
      cart.vx *= Math.pow(0.02, dt);
      cart.xRatio += cart.vx * dt;
      cart.xRatio = Math.max(-0.95, Math.min(0.95, cart.xRatio));

      // Hold-to-Charge Kinetic Magnetic Rail Boost Sweet Spot (72%–98%)
      if (actionHeld && cart.boostTimer <= 0) {
        cart.isCharging = true;
        cart.chargeTime += dt;
        cart.mood = 'focused';

        // Overcharge past 1.25s triggers Rail Overheat Emergency Lockup!
        if (cart.chargeTime > 1.25) {
          cart.isCharging = false;
          cart.chargeTime = 0;
          cart.wobbleTimer = 0.85;
          cart.score = Math.max(0, cart.score - 5);
          cart.mood = 'shocked';
          this.audio.playTone(170, 0.25, 'sawtooth');
          const cx = this.lastCanvasWidth / 2 + cart.xRatio * (this.lastCanvasWidth * 0.32);
          this.particles.emit(cx, this.lastCanvasHeight - 110, 16, '#EF4444');
          this.particles.showFloatingText('BRAKE LOCKUP! -5', cx, this.lastCanvasHeight - 145, '#EF4444', 18);
        }
      } else {
        if (cart.isCharging) {
          // Releasing charged rail boost: check sweet spot!
          cart.isCharging = false;
          const sweetMin = cart.isUnderdog ? 0.50 : 0.72;
          const sweetMax = cart.isUnderdog ? 1.05 : 0.98;

          if (cart.chargeTime >= sweetMin && cart.chargeTime <= sweetMax) {
            // PERFECT SWEET SPOT: Supersonic Rail Overdrive!
            cart.boostTimer = 0.95;
            cart.mood = 'triumph';
            const mult = isSuddenDeath ? 2 : 1;
            cart.score += 25 * mult;

            this.audio.playTone(720, 0.16, 'sine');
            this.audio.playTone(940, 0.14, 'triangle');
            const cx = this.lastCanvasWidth / 2 + cart.xRatio * (this.lastCanvasWidth * 0.32);
            this.particles.emit(cx, this.lastCanvasHeight - 110, 24, '#FACC15');
            this.particles.showFloatingText('SUPERSONIC BOOST! ★', cx, this.lastCanvasHeight - 150, '#FACC15', 20);

            // Vacuum track loot
            this.vacuumTrackLoot(cart);
          } else if (cart.chargeTime < sweetMin && cart.chargeTime > 0.1) {
            // Undercharged mild acceleration
            cart.boostTimer = 0.35;
            this.audio.playTone(420, 0.08, 'triangle');
          }
          cart.chargeTime = 0;
        } else {
          if (cart.mood !== 'triumph') cart.mood = 'idle';
        }
      }
    }
  }

  private vacuumTrackLoot(cart: CoasterCart): void {
    for (const item of this.lootItems) {
      if (item.collected) continue;
      const diffX = Math.abs(item.xRatio - cart.xRatio);
      if (diffX < 0.6) {
        item.xRatio += (cart.xRatio - item.xRatio) * 0.7;
      }
    }
  }

  private handleCartCollisions(width: number): void {
    const list = Array.from(this.carts.values());
    const cartWidthRatio = 0.22; // In rail ratio units

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];

        const diffX = b.xRatio - a.xRatio;
        const dist = Math.abs(diffX);

        if (dist < cartWidthRatio && dist > 0.001) {
          const overlap = cartWidthRatio - dist;
          const sign = diffX > 0 ? 1 : -1;

          a.xRatio -= sign * overlap * 0.5;
          b.xRatio += sign * overlap * 0.5;

          const relVx = b.vx - a.vx;
          const impulse = relVx * sign;

          if (impulse < 0) {
            const p = impulse * 1.35 * 0.5;
            a.vx += sign * p;
            b.vx -= sign * p;

            const impactSpeed = Math.abs(impulse);
            if (impactSpeed > 0.25 || a.boostTimer > 0 || b.boostTimer > 0) {
              this.audio.playTone(300, 0.08, 'triangle');
              const midX = width / 2 + ((a.xRatio + b.xRatio) * 0.5) * (width * 0.32);
              this.particles.emit(midX, this.lastCanvasHeight - 110, 10, '#FFFFFF');

              // Rail Shunt Sabotage: if attacker is in supersonic boost, violently shunt victim!
              if (a.boostTimer > 0 && b.boostTimer <= 0) {
                a.score += 30;
                a.sabotageCount++;
                a.mood = 'triumph';
                b.wobbleTimer = 0.75;
                b.mood = 'shocked';
                this.audio.playTone(720, 0.15, 'sawtooth');
                this.particles.showFloatingText('RAIL SHUNT! +30', midX, this.lastCanvasHeight - 145, '#F59E0B', 18);
              } else if (b.boostTimer > 0 && a.boostTimer <= 0) {
                b.score += 30;
                b.sabotageCount++;
                b.mood = 'triumph';
                a.wobbleTimer = 0.75;
                a.mood = 'shocked';
                this.audio.playTone(720, 0.15, 'sawtooth');
                this.particles.showFloatingText('RAIL SHUNT! +30', midX, this.lastCanvasHeight - 145, '#F59E0B', 18);
              }
            }
          }
        }
      }
    }
  }

  private updateCurves(dt: number, width: number, height: number, isSuddenDeath: boolean): void {
    this.curveSpawnTimer -= dt;
    if (this.curveSpawnTimer <= 0) {
      const types: ('left_bank' | 'right_bank' | 'loop_de_loop' | 'airtime_drop')[] = [
        'left_bank',
        'right_bank',
        'loop_de_loop',
        'airtime_drop'
      ];
      const selected = types[Math.floor(Math.random() * types.length)];
      let label = '◀◀ BANK LEFT';
      if (selected === 'right_bank') label = 'BANK RIGHT ▶▶';
      else if (selected === 'loop_de_loop') label = '★ 360° VERTICAL LOOP ★';
      else if (selected === 'airtime_drop') label = '⚡ AIRTIME G-DROP ⚡';

      this.curves.push({
        id: this.nextCurveId++,
        y: -50,
        type: selected,
        label,
        handledBy: new Set()
      });

      this.curveSpawnTimer = isSuddenDeath ? 1.2 : 1.9;
      this.audio.playWhoosh();
    }

    const cartY = height - 110;
    const mult = isSuddenDeath ? 2 : 1;

    for (let i = this.curves.length - 1; i >= 0; i--) {
      const c = this.curves[i];
      c.y += dt * (this.coasterMPH / 95) * 380;

      // Evaluate curve apex when passing cart zone (forgiving window: cartY ± 44)
      if (Math.abs(c.y - cartY) < 44) {
        for (const p of this.getActivePlayers()) {
          if (!c.handledBy.has(p.id)) {
            const cart = this.carts.get(p.id);
            if (!cart) continue;

            let isHandled = false;

            if (c.type === 'left_bank') {
              // Lean left or steer left or supersonic boost
              isHandled = cart.xRatio < -0.1 || cart.lean < -0.08 || cart.boostTimer > 0;
            } else if (c.type === 'right_bank') {
              // Lean right or steer right or supersonic boost
              isHandled = cart.xRatio > 0.1 || cart.lean > 0.08 || cart.boostTimer > 0;
            } else if (c.type === 'loop_de_loop') {
              // Supersonic boost or active charge
              isHandled = cart.boostTimer > 0 || cart.isCharging || cart.chargeTime > 0.2;
            } else if (c.type === 'airtime_drop') {
              // Center track balance or boost
              isHandled = Math.abs(cart.xRatio) < 0.65 || cart.boostTimer > 0;
            }

            if (isHandled) {
              // Successfully nailed curve apex
              cart.perfectCurvesCount++;
              cart.streakCount++;
              cart.streakTimer = 4.0;
              cart.mood = 'triumph';
              const earned = 60 * mult;
              cart.score += earned;
              cart.boostTimer = Math.max(cart.boostTimer, 0.45);

              this.audio.playTone(660, 0.12, 'triangle');
              this.audio.playTone(880, 0.14, 'sine');
              const cx = width / 2 + cart.xRatio * (width * 0.32);
              this.particles.emit(cx, cartY, 18, '#10B981');
              this.particles.showFloatingText(`PERFECT LEAN! +${earned}`, cx, cartY - 35, '#10B981', 18);
            } else {
              // Smooth, forgiving coaster ride: award coasting points without jarring spinout or score deduction!
              const earned = 15 * mult;
              cart.score += earned;
              this.audio.playTone(420, 0.08, 'triangle');
              const cx = width / 2 + cart.xRatio * (width * 0.32);
              this.particles.emit(cx, cartY, 6, '#F59E0B');
              this.particles.showFloatingText(`COASTING +${earned}`, cx, cartY - 35, '#F59E0B', 15);
            }

            c.handledBy.add(p.id);
          }
        }
      }

      if (c.y > height + 60) {
        this.curves.splice(i, 1);
      }
    }
  }

  private updateTrackLoot(dt: number, width: number, height: number, isSuddenDeath: boolean): void {
    this.lootSpawnTimer -= dt;
    if (this.lootSpawnTimer <= 0) {
      if (this.lootItems.length < 8) {
        const roll = Math.random();
        let type: 'track_coin' | 'thrill_ticket' | 'diamond_gem' = 'track_coin';
        let val = 20;
        let rad = 12;

        if (roll < 0.2) {
          type = 'diamond_gem';
          val = 75;
          rad = 16;
        } else if (roll < 0.55) {
          type = 'thrill_ticket';
          val = 45;
          rad = 14;
        }

        this.lootItems.push({
          id: this.nextLootId++,
          xRatio: (Math.random() - 0.5) * 1.6,
          y: -30,
          type,
          value: val,
          radius: rad,
          collected: false
        });
      }
      this.lootSpawnTimer = isSuddenDeath ? 0.7 : 1.1;
    }

    const cartY = height - 110;
    const mult = isSuddenDeath ? 2 : 1;

    for (let i = this.lootItems.length - 1; i >= 0; i--) {
      const item = this.lootItems[i];
      if (item.collected) {
        this.lootItems.splice(i, 1);
        continue;
      }

      item.y += dt * (this.coasterMPH / 95) * 440;

      // Check collection near carts
      for (const cart of this.carts.values()) {
        const cx = width / 2 + cart.xRatio * (width * 0.32);
        const itemX = width / 2 + item.xRatio * (width * 0.32);

        const dist = Math.hypot(cx - itemX, cartY - item.y);
        const reach = (cart.isUnderdog ? 36 : 26) + item.radius;

        if (dist < reach) {
          item.collected = true;
          const streakMult = 1.0 + Math.min(cart.streakCount * 0.25, 1.5);
          const earned = Math.round(item.value * mult * streakMult);

          cart.score += earned;
          cart.streakCount++;
          cart.streakTimer = 3.5;
          cart.mood = 'triumph';

          this.audio.playTone(
            item.type === 'diamond_gem' ? 960 : item.type === 'thrill_ticket' ? 760 : 540,
            0.1,
            'triangle'
          );

          this.particles.emit(itemX, item.y, 12, item.type === 'diamond_gem' ? '#67E8F9' : '#FBBF24');
          break;
        }
      }

      if (item.y > height + 40) {
        this.lootItems.splice(i, 1);
      }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const cart = this.carts.get(botId);
    if (!cart || cart.wobbleTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    let reactionTimer = this.botReactionTimers.get(botId) || 0;
    reactionTimer += dt;
    this.botReactionTimers.set(botId, reactionTimer);

    const lagThreshold = difficulty === 'bot_easy' ? 0.42 : difficulty === 'bot_normal' ? 0.23 : 0.10;
    if (reactionTimer < lagThreshold) return;
    this.botReactionTimers.set(botId, 0);

    const blunderChance = difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;
    const isBlundering = Math.random() < blunderChance;

    // Check for approaching curve
    const cartY = height - 110;
    const approachingCurve = this.curves.find(c => !c.handledBy.has(botId) && c.y < cartY && cartY - c.y < 160);

    let targetRatio = cart.xRatio;
    let shouldHoldAction = false;

    if (approachingCurve && !isBlundering) {
      if (approachingCurve.type === 'left_bank') {
        targetRatio = -0.7;
      } else if (approachingCurve.type === 'right_bank') {
        targetRatio = 0.7;
      } else if (approachingCurve.type === 'loop_de_loop') {
        // Must charge or boost for vertical loop!
        shouldHoldAction = true;
      } else if (approachingCurve.type === 'airtime_drop') {
        targetRatio = 0;
      }
    } else {
      // Hunt highest-value track loot
      let bestDist = Infinity;
      let targetLoot: TrackLoot | null = null;

      for (const item of this.lootItems) {
        if (item.collected || item.y > cartY) continue;
        const weight = item.type === 'diamond_gem' ? 2.5 : item.type === 'thrill_ticket' ? 1.5 : 1.0;
        const dist = (cartY - item.y) / weight;
        if (dist < bestDist) {
          bestDist = dist;
          targetLoot = item;
        }
      }

      if (targetLoot) {
        targetRatio = targetLoot.xRatio;
      }

      // Hard bots occasionally charge sweet spot boosts to blast through rivals
      if (difficulty === 'bot_hard' && Math.random() < 0.12 && !cart.isCharging) {
        shouldHoldAction = true;
      }
    }

    // Handle bot release timing for sweet spot
    if (cart.isCharging) {
      const sweetTarget = cart.isUnderdog ? 0.75 : 0.85;
      if (cart.chargeTime >= sweetTarget) {
        shouldHoldAction = false;
      } else {
        shouldHoldAction = true;
      }
    }

    // Steer towards targetRatio
    let steerX = 0;
    const diff = targetRatio - cart.xRatio;
    if (Math.abs(diff) > 0.08) {
      steerX = diff > 0 ? 1 : -1;
    }

    this.input.setBotInput(botId, shouldHoldAction, steerX, 0);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    // Background Sky Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars & Skyline
    this.renderBackdropStars(ctx, width, height);

    // 2.5D Coaster Track & Trestles
    this.renderTrack(ctx, width, height, theme);

    // Curve & Apex Warning Banners
    this.renderCurves(ctx, width, height);

    // Track Loot
    this.renderTrackLoot(ctx, width, theme);

    // Coaster Carts & Mascot Riders
    this.renderCarts(ctx, width, height, theme);

    // HUD and UI Layout
    this.renderHUD(ctx, width, height, theme);
  }

  private renderBackdropStars(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#FFFFFF';
    for (let s = 0; s < 25; s++) {
      const sx = (s * 97) % width;
      const sy = (s * 43) % (height * 0.45);
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  private renderTrack(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    const cx = width / 2;
    const topW = 90;
    const botW = width * 0.72;

    ctx.save();

    // Wooden Trestle Support Ties in Perspective with Dynamic Curve Offset
    ctx.strokeStyle = theme.tieColor;
    ctx.lineWidth = 3;

    for (let ty = this.trackScrollOffset; ty < height; ty += 40) {
      const p = ty / height;
      const w = topW + (botW - topW) * p;
      const curveOffset = Math.sin(p * Math.PI) * this.trackCurvature * (width * 0.16);

      ctx.beginPath();
      ctx.moveTo(cx + curveOffset - w / 2, ty);
      ctx.lineTo(cx + curveOffset + w / 2, ty);
      ctx.stroke();

      // Center rail tie spine
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(cx + curveOffset - 5, ty - 2, 10, 4);
    }

    // Steel Coaster Rails with perspective gradient & curve bend
    ctx.strokeStyle = theme.railColor;
    ctx.lineWidth = 6;
    ctx.shadowColor = theme.accentGlow;
    ctx.shadowBlur = 10;

    const midCurveOffset = this.trackCurvature * (width * 0.16);

    // Left Rail (Bezier Curved)
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, 0);
    ctx.quadraticCurveTo(cx + midCurveOffset - (topW + botW) * 0.25, height * 0.5, cx - botW / 2, height);
    ctx.stroke();

    // Right Rail (Bezier Curved)
    ctx.beginPath();
    ctx.moveTo(cx + topW / 2, 0);
    ctx.quadraticCurveTo(cx + midCurveOffset + (topW + botW) * 0.25, height * 0.5, cx + botW / 2, height);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private renderCurves(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const topW = 90;
    const botW = width * 0.72;
    const t = performance.now() * 0.003;

    for (const c of this.curves) {
      const p = Math.max(0, c.y / height);
      const curW = topW + (botW - topW) * p;
      const pylonLeftX = cx - curW * 0.48;
      const pylonRightX = cx + curW * 0.48;
      const archH = Math.max(18, 32 * p);

      ctx.save();
      const isLoop = c.type === 'loop_de_loop';
      const isLeft = c.type === 'left_bank';
      const isRight = c.type === 'right_bank';
      const isAirtime = c.type === 'airtime_drop';

      const archColor = isLoop ? '#EC4899' : isAirtime ? '#06B6D4' : isLeft ? '#38BDF8' : '#F59E0B';
      const glowColor = isLoop ? '#F472B6' : isAirtime ? '#67E8F9' : isLeft ? '#06B6D4' : '#FBBF24';

      // 1. Dual Gantry Pylons at track rails
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = archColor;
      ctx.lineWidth = Math.max(1.5, 2.5 * p);
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8 * p;

      // Left truss pylon
      ctx.fillRect(pylonLeftX - 6 * p, c.y - archH, 12 * p, archH + 10);
      ctx.strokeRect(pylonLeftX - 6 * p, c.y - archH, 12 * p, archH + 10);

      // Right truss pylon
      ctx.fillRect(pylonRightX - 6 * p, c.y - archH, 12 * p, archH + 10);
      ctx.strokeRect(pylonRightX - 6 * p, c.y - archH, 12 * p, archH + 10);

      // 2. High-Voltage Neon Overhead Arch Span
      ctx.beginPath();
      ctx.moveTo(pylonLeftX, c.y);
      ctx.quadraticCurveTo(cx, c.y - archH * 1.35, pylonRightX, c.y);
      ctx.strokeStyle = archColor;
      ctx.lineWidth = Math.max(2, 4.5 * p);
      ctx.stroke();

      // 3. Central Neon Gantry Banner Box
      const boxW = Math.min(curW * 0.75, 260);
      const boxH = Math.max(18, 26 * p);
      const boxY = c.y - archH * 0.85;

      const bgGrad = ctx.createLinearGradient(cx - boxW / 2, boxY, cx + boxW / 2, boxY);
      bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
      bgGrad.addColorStop(0.5, 'rgba(30, 41, 59, 0.95)');
      bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');

      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.roundRect(cx - boxW / 2, boxY - boxH / 2, boxW, boxH, 6);
      ctx.fill();
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = Math.max(1.5, 2.2 * p);
      ctx.stroke();

      // 4. Directional Animated Chevrons
      let displayArrows = '';
      if (isLeft) {
        const frame = Math.floor(t * 8) % 3;
        displayArrows = frame === 0 ? '◀ ◀ ◁' : frame === 1 ? '◀ ◁ ◀' : '◁ ◀ ◀';
      } else if (isRight) {
        const frame = Math.floor(t * 8) % 3;
        displayArrows = frame === 0 ? '▷ ▶ ▶' : frame === 1 ? '▶ ▷ ▶' : '▶ ▶ ▷';
      } else if (isLoop) {
        displayArrows = '🌀 360° LOOP 🌀';
      } else {
        displayArrows = '⚡ AIRTIME DROP ⚡';
      }

      ctx.font = `900 ${Math.max(10, Math.floor(13 * p))}px "Outfit", system-ui, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      ctx.fillText(c.label, cx, boxY);
      ctx.shadowBlur = 0;

      // 5. Track Apex Timing Guide Line across rails
      const apexDist = Math.abs(c.y - (height - 110));
      if (apexDist < 80) {
        const apexPulse = 1 - apexDist / 80;
        ctx.strokeStyle = isLoop ? 'rgba(236, 72, 153, 0.7)' : 'rgba(16, 185, 129, 0.85)';
        ctx.lineWidth = Math.max(2, 4 * apexPulse);
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 12 * apexPulse;
        ctx.beginPath();
        ctx.moveTo(pylonLeftX + 6, c.y);
        ctx.lineTo(pylonRightX - 6, c.y);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderTrackLoot(ctx: CanvasRenderingContext2D, width: number, theme: VisualTheme): void {
    for (const item of this.lootItems) {
      if (item.collected) continue;

      const itemX = width / 2 + item.xRatio * (width * 0.32);

      ctx.save();
      ctx.translate(itemX, item.y);

      if (item.type === 'diamond_gem') {
        // Diamond Funhouse Gem (+75)
        ctx.fillStyle = '#67E8F9';
        ctx.beginPath();
        ctx.moveTo(0, -item.radius);
        ctx.lineTo(item.radius, 0);
        ctx.lineTo(0, item.radius);
        ctx.lineTo(-item.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (item.type === 'thrill_ticket') {
        // Thrill Ticket (+45)
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.roundRect(-10, -7, 20, 14, 3);
        ctx.fill();
        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#78350F';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PASS', 0, 3);
      } else {
        // Track Coin (+20)
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFBEB';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderCarts(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    const active = this.getActivePlayers();
    const cartY = height - 110;

    active.forEach((p, idx) => {
      const cart = this.carts.get(p.id);
      if (!cart) return;

      const trackBank = this.trackCurvature * 0.35;
      const cartX = width / 2 + (cart.xRatio + this.trackCurvature * 0.15) * (width * 0.32);

      ctx.save();
      ctx.translate(cartX, cartY);

      // Wobble shaking or dynamic lean into the coaster curve!
      if (cart.wobbleTimer > 0) {
        ctx.rotate(Math.sin(cart.animTimer * 24) * 0.25);
      } else {
        // Lean into curve: natural physical camber
        ctx.rotate(cart.lean + trackBank);
      }

      // Supersonic Boost Aura
      if (cart.boostTimer > 0) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.roundRect(-28, -24, 56, 48, 8);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Charge Ring
      if (cart.isCharging) {
        const chargeRatio = Math.min(1.0, cart.chargeTime / 1.0);
        const sweetMin = cart.isUnderdog ? 0.50 : 0.72;
        const sweetMax = cart.isUnderdog ? 1.05 : 0.98;
        const isSweet = cart.chargeTime >= sweetMin && cart.chargeTime <= sweetMax;

        ctx.strokeStyle = isSweet ? '#10B981' : cart.chargeTime > sweetMax ? '#EF4444' : '#F59E0B';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 32, -Math.PI / 2, -Math.PI / 2 + chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      // Underdog Halo
      if (cart.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Coaster Cart Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-24, -20, 48, 40, 8);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Steel Bumper Rollers
      ctx.fillStyle = '#334155';
      ctx.fillRect(-27, -16, 5, 10);
      ctx.fillRect(22, -16, 5, 10);
      ctx.fillRect(-27, 6, 5, 10);
      ctx.fillRect(22, 6, 5, 10);

      // Mascot Rider
      drawCharacter(ctx, 0, 0, 16, p.id, p.id !== 0, cart.mood, cart.animTimer);

      // Streak Pill
      if (cart.streakCount >= 2) {
        const mult = (1.0 + Math.min(cart.streakCount * 0.25, 1.5)).toFixed(1);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(-24, -42, 48, 16, 4);
        ctx.fill();
        ctx.strokeStyle = theme.railColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#FBBF24';
        ctx.textAlign = 'center';
        ctx.fillText(`${mult}x THRILL`, 0, -30);
      }

      ctx.restore();
    });
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    ctx.save();

    // Top Safe Zone reserved for global timer at y: 12-44
    // Header Minigame Badge at y: 56
    const badgeW = 300;
    const badgeH = 26;
    const badgeX = (width - badgeW) / 2;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.strokeStyle = theme.railColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.fillText(`ROLLERCOASTER THRILL 🎢 • ${this.coasterMPH} MPH`, width / 2, badgeY + 17);

    // Theme Pill at bottom-left x: 20, y: height - 44, w: 170, h: 32 with shortcut [T]
    const pillRect = {
      x: 20,
      y: height - 44,
      w: 170,
      h: 32
    };
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillRect.x, pillRect.y, pillRect.w, pillRect.h, 6);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.textAlign = 'center';
    ctx.fillText(`[T] ${theme.name} ${theme.icon}`, pillRect.x + pillRect.w * 0.5, pillRect.y + 20);

    // Corner Player Score Cards at y: height - 128 (130x48px)
    const active = this.getActivePlayers();
    const cardW = 130;
    const cardH = 48;
    const cardY = height - 128;

    active.forEach((p, idx) => {
      const cart = this.carts.get(p.id);
      if (!cart) return;

      const cardX = 20 + idx * (cardW + 12);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 6);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Player Name
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);

      // Score
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(`${cart.score} pts`, cardX + 10, cardY + 38);

      // Underdog badge on card
      if (cart.isUnderdog) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('⚡SURGE', cardX + cardW - 8, cardY + 18);
      }
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const cart = this.carts.get(p.id);
        const score = cart ? cart.score : 0;
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Runaway Coaster Daredevil!';
    if (winnerId !== null) {
      const cart = this.carts.get(winnerId);
      mvpHighlight = `${this.getPlayer(winnerId)?.name} conquered the runaway rails with ${cart?.perfectCurvesCount || 0} apex banks & ${cart?.sabotageCount || 0} rail shunts!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
      }
      if (this.clickListener) {
        window.removeEventListener('click', this.clickListener);
      }
    }
    super.destroy();
  }
}
