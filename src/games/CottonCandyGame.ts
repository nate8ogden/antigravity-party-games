import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type CandyTheme = 'midway' | 'pastel' | 'cyber';

type SugarKind = 'strawberry' | 'raspberry' | 'banana' | 'grape' | 'star' | 'burnt';

interface SugarDrop {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: SugarKind;
  color: string;
  points: number;
  spin: number;
  spinSpeed: number;
  destroyed: boolean;
}

interface StackPuff {
  kind: SugarKind;
  color: string;
  radius: number;
  offsetX: number;
  points: number;
}

interface StackerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  speed: number;
  stack: StackPuff[];
  wobbleAngle: number;
  wobbleVelocity: number;
  isCharging: boolean;
  chargeRatio: number;
  overloadTimer: number;
  score: number;
  bankedCount: number;
  shuntsLanded: number;
  isUnderdog: boolean;
  botReactionTimer: number;
  botTargetCharge: number;
  stickSpinAngle: number;
  stickStickiness: number;
  webSparks: { x: number; y: number; color: string; life: number }[];
}

export class CottonCandyGame extends BaseGame {
  public candyTheme: CandyTheme = 'midway';
  private playersState: Map<PlayerId, StackerPlayer> = new Map();
  private drops: SugarDrop[] = [];
  private dropCounter: number = 0;
  private spawnTimer: number = 0;
  private kettleX: number[] = [200, 400, 600];
  private suddenDeathTriggered: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private mousedownListener: ((e: MouseEvent) => void) | null = null;
  private lastWidth: number = 800;
  private lastHeight: number = 600;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.reset(width, height);

    if (typeof window !== 'undefined') {
      this.keydownListener = (e: KeyboardEvent) => {
        if (e.key === '1') this.switchTheme('midway', this.lastWidth, this.lastHeight);
        else if (e.key === '2') this.switchTheme('pastel', this.lastWidth, this.lastHeight);
        else if (e.key === '3') this.switchTheme('cyber', this.lastWidth, this.lastHeight);
        else if (e.key === 't' || e.key === 'T') {
          const order: CandyTheme[] = ['midway', 'pastel', 'cyber'];
          const next = order[(order.indexOf(this.candyTheme) + 1) % order.length];
          this.switchTheme(next, this.lastWidth, this.lastHeight);
        }
      };
      this.mousedownListener = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        if (mx >= 20 && mx <= 190 && my >= this.lastHeight - 44 && my <= this.lastHeight - 12) {
          const order: CandyTheme[] = ['midway', 'pastel', 'cyber'];
          const next = order[(order.indexOf(this.candyTheme) + 1) % order.length];
          this.switchTheme(next, this.lastWidth, this.lastHeight);
        }
      };
      window.addEventListener('keydown', this.keydownListener);
      window.addEventListener('mousedown', this.mousedownListener);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      if (this.mousedownListener) {
        window.removeEventListener('mousedown', this.mousedownListener);
        this.mousedownListener = null;
      }
    }
  }

  public switchTheme(theme: CandyTheme, width: number, height: number): void {
    this.candyTheme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `THEME: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'midway' ? '#F43F5E' : theme === 'pastel' ? '#C084FC' : '#06B6D4',
      22
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.roundTimer = 36.0;
    this.isFinished = false;
    this.suddenDeathTriggered = false;
    this.drops = [];
    this.dropCounter = 0;
    this.spawnTimer = 0.2;
    this.kettleX = [width * 0.22, width * 0.5, width * 0.78];

    this.initPlayers(width, height);
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 64,
        vx: 0,
        speed: 350,
        stack: [],
        wobbleAngle: 0,
        wobbleVelocity: 0,
        isCharging: false,
        chargeRatio: 0,
        overloadTimer: 0,
        score: 0,
        bankedCount: 0,
        shuntsLanded: 0,
        isUnderdog: false,
        botReactionTimer: 0.14 + idx * 0.06,
        botTargetCharge: 0.82,
        stickSpinAngle: 0,
        stickStickiness: 1.0,
        webSparks: []
      });
    });
  }

  // Returns array of catch centers along the wooden stick and each puff on the stack
  private getCatchSegments(ps: StackerPlayer): { x: number; y: number; radius: number; isStick: boolean }[] {
    const segments: { x: number; y: number; radius: number; isStick: boolean }[] = [];
    const stickBaseY = ps.y - 4;
    const stickTopY = ps.y - 34;

    // Along the stick itself (wide sticky capture column so sugar instantly clings to stick)
    for (let t = 0.1; t <= 1.0; t += 0.25) {
      segments.push({
        x: ps.x,
        y: stickBaseY + (stickTopY - stickBaseY) * t,
        radius: 28,
        isStick: true
      });
    }

    // Along each puff in the growing stack with precise world-space rotation
    const sinW = Math.sin(ps.wobbleAngle);
    const cosW = Math.cos(ps.wobbleAngle);

    for (let i = 0; i < ps.stack.length; i++) {
      const puff = ps.stack[i];
      const localX = puff.offsetX;
      const localY = -(i * 16 + 8);
      // Transform local rotated offset around stickTopY
      const curX = ps.x + cosW * localX + sinW * (-localY);
      const curY = stickTopY + sinW * localX - cosW * (-localY);
      segments.push({
        x: curX,
        y: curY,
        radius: puff.radius + 14, // Generous fluffy adhesion margin
        isStick: false
      });
    }

    return segments;
  }

  private getStackTipPosition(ps: StackerPlayer): { x: number; y: number } {
    const stackHeight = 34 + ps.stack.length * 16;
    return {
      x: ps.x + Math.sin(ps.wobbleAngle) * stackHeight,
      y: ps.y - Math.cos(ps.wobbleAngle) * stackHeight
    };
  }

  private spawnSugarDrop(width: number): void {
    // Spawn either from one of the 3 overhead Sugar Kettles or across the canopy
    const useKettle = Math.random() < 0.65;
    const baseK = this.kettleX[Math.floor(Math.random() * this.kettleX.length)] || width * 0.5;
    const x = useKettle
      ? Math.max(55, Math.min(width - 55, baseK + (Math.random() - 0.5) * 140))
      : 55 + Math.random() * (width - 110);

    const roll = Math.random();
    let kind: SugarKind = 'strawberry';
    let color = '#FB7185';
    let points = 90;
    let radius = 16;

    if (roll < 0.13) {
      kind = 'burnt';
      color = '#1E293B';
      points = -110;
      radius = 16;
    } else if (roll < (this.suddenDeathTriggered ? 0.36 : 0.25)) {
      kind = 'star';
      color = '#FACC15';
      points = 260;
      radius = 18;
    } else if (roll < 0.5) {
      kind = 'raspberry';
      color = '#38BDF8';
      points = 110;
      radius = 15;
    } else if (roll < 0.75) {
      kind = 'banana';
      color = '#FDE047';
      points = 125;
      radius = 15;
    } else {
      kind = 'grape';
      color = '#C084FC';
      points = 140;
      radius = 16;
    }

    this.drops.push({
      id: ++this.dropCounter,
      x,
      y: 96,
      vx: (Math.random() - 0.5) * 65,
      vy: (this.suddenDeathTriggered ? 175 : 135) + Math.random() * 75,
      radius,
      kind,
      color,
      points,
      spin: 0,
      spinSpeed: (Math.random() - 0.5) * 4,
      destroyed: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.lastWidth = width;
    this.lastHeight = height;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Oscillate overhead Sugar Kettles
    const now = performance.now() * 0.001;
    this.kettleX[0] = width * 0.24 + Math.sin(now * 1.4) * 55;
    this.kettleX[1] = width * 0.5 + Math.cos(now * 1.8) * 65;
    this.kettleX[2] = width * 0.76 + Math.sin(now * 1.6 + 1.5) * 55;

    // Sudden Death Overdrive at <= 12s
    if (this.roundTimer <= 12.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.audio.playFanfare();
      this.particles.shake(0.32);
      this.particles.showFloatingText(
        '⚡ SUDDEN DEATH: GOLDEN SUGAR SHOWER & 2X BANKING! ⚡',
        width / 2,
        104,
        '#FACC15',
        21
      );
    }

    // Compute Underdog Surge (>= 400 pts behind leader)
    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.isUnderdog = maxScore - ps.score >= 400;
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Spawn falling sugar drops
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnSugarDrop(width);
      this.spawnTimer = this.suddenDeathTriggered
        ? 0.26 + Math.random() * 0.22
        : 0.42 + Math.random() * 0.32;
    }

    const activePlayers = this.getActivePlayers();

    // Update Sugar Drops & Centrifugal Vortex Attraction
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (drop.destroyed) {
        this.drops.splice(i, 1);
        continue;
      }

      // Sticky Sugar Attraction: cotton candy naturally attracts and pulls falling sugar drops towards the stick and stack!
      if (drop.kind !== 'burnt') {
        for (const p of activePlayers) {
          const ps = this.playersState.get(p.id);
          if (!ps) continue;
          const tip = this.getStackTipPosition(ps);
          const dx = tip.x - drop.x;
          const dy = tip.y - drop.y;
          const d = Math.hypot(dx, dy);

          // Active vortex has large radius; passive sticky adhesion pulls drops in vicinity
          const pullRadius = ps.isCharging ? (ps.isUnderdog ? 140 : 110) : (ps.isUnderdog ? 75 : 55);
          if (d > 4 && d < pullRadius && drop.y < tip.y + 40) {
            const pullForce = ps.isCharging ? 380 : 180;
            drop.vx += (dx / (d || 0.001)) * pullForce * dt;
            drop.vy += (dy / (d || 0.001)) * (pullForce * 0.75) * dt;
          }
        }
      }

      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.spin += drop.spinSpeed * dt;
      drop.x = Math.max(36, Math.min(width - 36, drop.x));

      // Check collision with player's stick or any part of the stack
      for (const p of activePlayers) {
        const ps = this.playersState.get(p.id);
        if (!ps) continue;

        const segments = this.getCatchSegments(ps);
        let caught = false;
        let hitX = ps.x;
        let hitY = ps.y - 30;

        for (const seg of segments) {
          const dist = Math.hypot(drop.x - seg.x, drop.y - seg.y);
          if (dist <= drop.radius + seg.radius) {
            caught = true;
            hitX = seg.x;
            hitY = seg.y;
            break;
          }
        }

        if (caught) {
          drop.destroyed = true;

          if (drop.kind === 'burnt') {
            this.audio.playStun();
            this.particles.shake(0.26);
            this.particles.spawnExplosion(hitX, hitY, '#EF4444', 14);
            this.particles.showFloatingText('BURNT! -100', hitX, hitY - 18, '#EF4444', 20);
            ps.score = Math.max(0, ps.score - 100);
            if (ps.stack.length > 0) {
              ps.stack.pop();
            }
            ps.wobbleVelocity += (Math.random() - 0.5) * 6;
          } else {
            this.audio.playTap();
            this.particles.spawnConfetti(hitX, hitY, 10);
            const catchScore = Math.round(drop.points * 0.45);
            ps.score += catchScore;

            // Spun web filament sparks that cling and wrap around the stick!
            for (let s = 0; s < 5; s++) {
              ps.webSparks.push({
                x: (Math.random() - 0.5) * 24,
                y: -ps.stack.length * 16 - Math.random() * 20,
                color: drop.color,
                life: 1.0
              });
            }

            // Stack on top of stick or previous puff
            ps.stack.push({
              kind: drop.kind,
              color: drop.color,
              radius: 18 + Math.min(8, ps.stack.length * 0.6),
              offsetX: (Math.random() - 0.5) * 6,
              points: drop.points
            });
            this.particles.showFloatingText(
              `STICK & STACK! +${catchScore}`,
              hitX,
              hitY - 20,
              drop.color,
              18
            );
          }
          break;
        }
      }

      if (drop.y > height + 30) {
        drop.destroyed = true;
      }
    }

    // Update Players Movement, Wobble & Hold-to-Charge Caramelize Cash-In
    for (const p of activePlayers) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.overloadTimer > 0) {
        ps.overloadTimer = Math.max(0, ps.overloadTimer - dt);
      }

      const steer = this.input.getSteer(p.id);
      const holdingAction = this.input.isActionPressed(p.id) || this.input.getThrottle(p.id) > 0.5;
      const speedMult = (ps.isUnderdog ? 1.25 : 1.0) * (ps.overloadTimer > 0 ? 0.55 : 1.0);

      const targetVx = steer * ps.speed * speedMult;
      ps.vx += (targetVx - ps.vx) * Math.min(1, dt * 12);
      ps.x += ps.vx * dt;
      ps.x = Math.max(48, Math.min(width - 48, ps.x));

      // Hold-to-Charge Centrifugal Sugar-Spin & Caramelize Cash-In (72%-98% Sweet Spot)
      if (ps.overloadTimer <= 0) {
        if (holdingAction) {
          ps.isCharging = true;
          ps.chargeRatio += dt * 1.15 * (ps.isUnderdog ? 1.3 : 1.0);
          // Gyroscopic stabilization while spinning cone!
          ps.wobbleAngle *= Math.pow(0.15, dt);
          ps.wobbleVelocity *= Math.pow(0.1, dt);

          if (ps.chargeRatio >= 1.0) {
            ps.chargeRatio = 0;
            ps.isCharging = false;
            ps.overloadTimer = 0.5;
            if (ps.stack.length > 0) ps.stack.pop();
            this.audio.playStun();
            this.particles.showFloatingText('OVER-SPUN!', ps.x, ps.y - 45, '#F97316', 17);
          }
        } else if (ps.isCharging) {
          const ratio = ps.chargeRatio;
          ps.isCharging = false;
          ps.chargeRatio = 0;

          const isSweet = ratio >= 0.72 && ratio <= 0.98;
          if (ps.stack.length > 0 && (ratio >= 0.25 || ps.stack.length >= 3)) {
            this.bankPlayerStack(ps, isSweet);
          } else if (isSweet) {
            // Even without a stack, releasing in the sweet spot fires a Sugar Shockwave Shunt!
            this.triggerSugarShockwave(ps);
          }
        }
      }

      // Physics Wobble on Stack - Organic spring elasticity
      const stackLen = ps.stack.length;
      if (stackLen > 0) {
        const accelForce = -steer * (0.02 + stackLen * 0.012);
        ps.wobbleVelocity += accelForce * 12 * dt;

        const springK = 32;
        const damping = ps.isCharging ? 18 : 9.5;
        ps.wobbleVelocity += (-springK * ps.wobbleAngle - damping * ps.wobbleVelocity) * dt;
        ps.wobbleAngle += ps.wobbleVelocity * dt;
        // Clamp maximum angle so it sways satisfyingly without snapping
        ps.wobbleAngle = Math.max(-0.95, Math.min(0.95, ps.wobbleAngle));
      } else {
        ps.wobbleAngle = 0;
        ps.wobbleVelocity = 0;
      }
    }

    // Player-to-Player Elastic Counter Collisions (m1*v1 + m2*v2 + Wobble Sabotage!)
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const p1 = this.playersState.get(activePlayers[i].id);
        const p2 = this.playersState.get(activePlayers[j].id);
        if (!p1 || !p2) continue;

        const dx = p2.x - p1.x;
        const minDist = 36;
        if (Math.abs(dx) < minDist) {
          const sign = dx >= 0 ? 1 : -1;
          const overlap = (minDist - Math.abs(dx)) * 0.5;
          p1.x -= sign * overlap;
          p2.x += sign * overlap;

          const vDiff = p1.vx - p2.vx;
          p1.vx -= vDiff * 0.65 + sign * 85;
          p2.vx += vDiff * 0.65 + sign * 85;

          // Impart wobble shock to both towers!
          p1.wobbleVelocity -= sign * 2.8;
          p2.wobbleVelocity += sign * 2.8;
          this.audio.playBounce();
          this.particles.spawnSparks((p1.x + p2.x) * 0.5, p1.y - 12, '#F43F5E', 8);
        }
      }
    }

    if (this.roundTimer <= 0) {
      // Auto-bank remaining stacks at buzzer at 1x rate
      for (const ps of this.playersState.values()) {
        if (ps.stack.length > 0) {
          this.bankPlayerStack(ps, false);
        }
      }
      this.isFinished = true;
    }
  }

  private bankPlayerStack(ps: StackerPlayer, isSweetSpot: boolean): void {
    const count = ps.stack.length;
    if (count === 0) return;

    // Count unique flavors in stack for Rainbow Swirl Multiplier
    const uniqueFlavors = new Set(ps.stack.map((s) => s.kind)).size;
    const rawValue = ps.stack.reduce((sum, s) => sum + s.points, 0);

    let heightMult = 1.0;
    if (count >= 8) heightMult = 2.5;
    else if (count >= 5) heightMult = 1.75;
    else if (count >= 3) heightMult = 1.35;

    const flavorMult = 1 + (uniqueFlavors - 1) * 0.18;
    const sweetMult = isSweetSpot ? 1.5 : 1.0;
    const sdMult = this.suddenDeathTriggered ? 1.35 : 1.0;

    const bonus = Math.round(rawValue * heightMult * flavorMult * sweetMult * sdMult);
    ps.score += bonus;
    ps.bankedCount += count;
    ps.stack = [];
    ps.wobbleAngle = 0;
    ps.wobbleVelocity = 0;

    this.audio.playScore();
    this.particles.spawnConfetti(ps.x, ps.y - 50, isSweetSpot ? 26 : 16);
    const label = isSweetSpot
      ? `SWEET CARAMEL BANK! +${bonus}`
      : `BANKED ${count} PUFFS! +${bonus}`;
    this.particles.showFloatingText(label, ps.x, ps.y - 68, isSweetSpot ? '#22C55E' : '#FACC15', 21);

    if (isSweetSpot) {
      this.triggerSugarShockwave(ps);
    }
  }

  private triggerSugarShockwave(caster: StackerPlayer): void {
    for (const other of this.playersState.values()) {
      if (other.id === caster.id) continue;
      const dx = other.x - caster.x;
      if (Math.abs(dx) <= 135) {
        const dir = dx >= 0 ? 1 : -1;
        other.vx += dir * 240;
        other.wobbleVelocity += dir * 4.2;
        caster.score += 75;
        caster.shuntsLanded += 1;
        this.audio.playBounce();
        this.particles.showFloatingText('SUGAR SHUNT! +75', caster.x, caster.y - 92, '#38BDF8', 17);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    const tip = this.getStackTipPosition(ps);

    // If charging Caramelize Cash-In, release inside target sweet spot
    if (ps.isCharging) {
      if (ps.chargeRatio >= ps.botTargetCharge) {
        this.input.setBotInput(botId, false, 0, 0, false);
      } else {
        this.input.setBotInput(botId, true, 0, 0, true);
      }
      return;
    }

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    ps.botReactionTimer =
      difficulty === 'bot_hard'
        ? 0.08 + Math.random() * 0.04
        : difficulty === 'bot_normal'
        ? 0.19 + Math.random() * 0.04
        : 0.35 + Math.random() * 0.07;

    // Check if ready to charge Sweet-Spot Bank
    const bankThreshold = difficulty === 'bot_hard' ? 6 : difficulty === 'bot_normal' ? 4 : 3;
    if (
      (ps.stack.length >= bankThreshold || (this.roundTimer < 3.5 && ps.stack.length >= 1)) &&
      ps.overloadTimer <= 0
    ) {
      ps.botTargetCharge =
        difficulty === 'bot_hard'
          ? 0.78 + Math.random() * 0.14
          : difficulty === 'bot_normal'
          ? 0.72 + Math.random() * 0.16
          : 0.55;
      this.input.setBotInput(botId, true, 0, 0, true);
      return;
    }

    // Dodge falling burnt crisps near our actual stack tip!
    for (const drop of this.drops) {
      if (drop.destroyed || drop.kind !== 'burnt') continue;
      if (Math.abs(drop.x - tip.x) < 46 && drop.y < tip.y + 10 && drop.y > tip.y - 135) {
        const dodgeDir = ps.x < width / 2 ? 1 : -1;
        this.input.setBotInput(botId, true, dodgeDir, 0, false);
        return;
      }
    }

    // Find best falling sugar cloud relative to our stack tip
    let bestDrop: SugarDrop | null = null;
    let bestScore = -9999;

    for (const drop of this.drops) {
      if (drop.destroyed || drop.kind === 'burnt' || drop.y > tip.y + 12) continue;
      const dx = Math.abs(drop.x - tip.x);
      const dy = Math.max(10, tip.y - drop.y);
      const timeToReach = dy / Math.max(80, drop.vy);
      const reachPenalty = Math.abs(dx - timeToReach * 180);
      const val = drop.points * 1.4 - dx * 0.85 - dy * 0.35 - reachPenalty * 0.2;
      if (val > bestScore) {
        bestScore = val;
        bestDrop = drop;
      }
    }

    if (!bestDrop) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    if (difficulty === 'bot_easy' && Math.random() < 0.2) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const dx = bestDrop.x - tip.x;
    if (Math.abs(dx) > 10) {
      const steer = Math.max(-1, Math.min(1, dx / 45));
      this.input.setBotInput(botId, true, steer, 0, false);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;

    // 1. Pastel Sugar Booth Backdrop & Overhead Spinning Floss Kettles
    this.renderBackdrop(ctx, width, height);

    // 2. Falling Sugar Drops
    this.renderSugarDrops(ctx);

    // 3. Players Sticks & Towering Cotton Candy Stacks
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderPlayerStack(ctx, ps);
    }

    // 4. Theme Pill (bottom-left)
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const now = performance.now() * 0.001;
    if (this.candyTheme === 'midway') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#3B0764');
      grad.addColorStop(0.6, '#4A044E');
      grad.addColorStop(1, '#1E1B4B');
      ctx.fillStyle = grad;
    } else if (this.candyTheme === 'pastel') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1E1B4B');
      grad.addColorStop(0.6, '#312E81');
      grad.addColorStop(1, '#4C1D95');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#090D16';
    }
    ctx.fillRect(0, 0, width, height);

    // 3 Overhead 2.5D Spinning Sugar-Floss Kettles along rail at y = 92
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(40, 88);
    ctx.lineTo(width - 40, 88);
    ctx.stroke();

    for (let i = 0; i < this.kettleX.length; i++) {
      const kx = this.kettleX[i];
      const ky = 92;
      ctx.fillStyle = this.candyTheme === 'cyber' ? '#06B6D4' : '#F43F5E';
      ctx.beginPath();
      ctx.roundRect(kx - 24, ky - 10, 48, 18, 8);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Whirling floss spinner head
      const spinX = Math.sin(now * 14 + i) * 10;
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(kx + spinX, ky - 1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Floor Counter
    ctx.fillStyle = this.candyTheme === 'cyber' ? '#0F172A' : '#371B43';
    ctx.fillRect(0, height - 32, width, 32);
    ctx.strokeStyle = this.candyTheme === 'cyber' ? '#06B6D4' : '#F43F5E';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, height - 32);
    ctx.lineTo(width, height - 32);
    ctx.stroke();
  }

  private renderSugarDrops(ctx: CanvasRenderingContext2D): void {
    for (const drop of this.drops) {
      if (drop.destroyed) continue;

      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(drop.spin);

      // Fluffy cloud puff shape
      ctx.fillStyle = drop.color;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += Math.PI * 0.35) {
        const r = drop.radius * (0.82 + Math.sin(a * 3) * 0.18);
        ctx.arc(
          Math.cos(a) * (drop.radius * 0.48),
          Math.sin(a) * (drop.radius * 0.48),
          r * 0.56,
          0,
          Math.PI * 2
        );
      }
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      if (drop.kind === 'star') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 4);
      } else if (drop.kind === 'burnt') {
        ctx.fillStyle = '#EF4444';
        ctx.font = '900 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✕', 0, 4);
      }

      ctx.restore();
    }
  }

  private renderPlayerStack(ctx: CanvasRenderingContext2D, ps: StackerPlayer): void {
    const now = performance.now() * 0.001;
    const tip = this.getStackTipPosition(ps);

    // Draw Centrifugal Vortex Ring at cone tip when holding Action
    if (ps.isCharging) {
      ctx.save();
      ctx.translate(tip.x, tip.y);
      const isSweet = ps.chargeRatio >= 0.72 && ps.chargeRatio <= 0.98;
      ctx.strokeStyle = isSweet ? '#22C55E' : '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -now * 45;
      ctx.beginPath();
      ctx.arc(0, 0, 32 + ps.chargeRatio * 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Charge arc around player base
      ctx.restore();
    }

    ctx.save();
    ctx.translate(ps.x, ps.y);

    if (ps.isUnderdog) {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 6, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (ps.isCharging) {
      const isSweet = ps.chargeRatio >= 0.72 && ps.chargeRatio <= 0.98;
      ctx.strokeStyle = isSweet ? '#22C55E' : '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 6, 22, -Math.PI / 2, -Math.PI / 2 + ps.chargeRatio * Math.PI * 2);
      ctx.stroke();
    }

    // 1. Player Mascot holding the stick
    const mood =
      ps.overloadTimer > 0 || Math.abs(ps.wobbleAngle) > 0.75
        ? 'shocked'
        : ps.stack.length >= 5 || ps.isCharging
        ? 'triumph'
        : 'focused';
    this.drawPlayerMascot(ctx, ps.id, 0, 6, 15, mood, now);

    // 2. Realistic Carnival Paper Stick (Striped White & Red/Blue, Tall & Sturdy)
    ctx.save();
    ctx.translate(0, 0);

    // Wooden / Paper stick with spiral carnival stripe
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, -36);
    ctx.stroke();

    // Spiral candy stripe on stick
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 5;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -now * 12;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, -36);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sticky sugar base seal where cotton candy binds to stick
    ctx.fillStyle = ps.stack.length > 0 ? ps.stack[0].color : '#F472B6';
    ctx.beginPath();
    ctx.ellipse(0, -30, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Towering Cotton Candy Cloud Stack with Dynamic Wobble & Spun Sugar Fibers
    ctx.save();
    ctx.translate(0, -34);
    ctx.rotate(ps.wobbleAngle);

    // Render underlying cotton candy core spine
    if (ps.stack.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 0; i < ps.stack.length; i++) {
        const puff = ps.stack[i];
        ctx.lineTo(puff.offsetX, -i * 16 - 8);
      }
      ctx.stroke();
    }

    // Render each fluffy cotton candy puff on the stack
    for (let i = 0; i < ps.stack.length; i++) {
      const puff = ps.stack[i];
      const py = -i * 16;
      const px = puff.offsetX;

      // Fluffy outer cloud lobes
      ctx.fillStyle = puff.color;
      ctx.beginPath();
      ctx.arc(px, py - 8, puff.radius, 0, Math.PI * 2);
      ctx.fill();

      // Additional fluffy cloud lobes for authentic cotton candy texture
      for (let a = 0; a < Math.PI * 2; a += Math.PI * 0.5) {
        ctx.beginPath();
        ctx.arc(
          px + Math.cos(a + i) * (puff.radius * 0.42),
          py - 8 + Math.sin(a + i) * (puff.radius * 0.42),
          puff.radius * 0.55,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Shimmer highlight rim
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();

      // Translucent glossy sugar sheen
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(px - puff.radius * 0.35, py - 8 - puff.radius * 0.35, 4.2, 0, Math.PI * 2);
      ctx.fill();

      // Spun sugar connecting fibers bridging to next puff
      if (i < ps.stack.length - 1) {
        const nextPuff = ps.stack[i + 1];
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - 6, py - 8);
        ctx.bezierCurveTo(px - 10, py - 16, nextPuff.offsetX - 10, py - 16, nextPuff.offsetX - 6, py - 24);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px + 6, py - 8);
        ctx.bezierCurveTo(px + 10, py - 16, nextPuff.offsetX + 10, py - 16, nextPuff.offsetX + 6, py - 24);
        ctx.stroke();
      }
    }

    // Render clinging spun sugar sparks
    for (let s = ps.webSparks.length - 1; s >= 0; s--) {
      const sp = ps.webSparks[s];
      sp.life -= 0.02;
      if (sp.life <= 0) {
        ps.webSparks.splice(s, 1);
        continue;
      }
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.max(0, sp.life);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
    ctx.restore();

    // Score & Stack Multiplier Label
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 11.5px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 4;
    const multLabel =
      ps.stack.length >= 8 ? ' [2.5x!]' : ps.stack.length >= 5 ? ' [1.75x]' : ps.stack.length >= 3 ? ' [1.35x]' : '';
    ctx.fillText(`${ps.score} pts (${ps.stack.length} puffs${multLabel})`, ps.x, ps.y - 40);
    ctx.restore();
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number): void {
    const pillW = 170;
    const pillH = 32;
    const pillX = 20;
    const pillY = height - 44;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = '800 10.5px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.candyTheme === 'midway' ? '#F43F5E' : this.candyTheme === 'pastel' ? '#C084FC' : '#06B6D4';
    ctx.fillText(`THEME: ${this.candyTheme.toUpperCase()} [T]`, pillX + pillW / 2, pillY + 20);
    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
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

    let mvpHighlight = 'Sugar Cloud Master!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} caramelized ${ps?.bankedCount || 0} sugar puffs!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
