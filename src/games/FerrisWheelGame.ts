import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type WheelTheme = 'twilight' | 'neon' | 'stormy';

interface SpokeItem {
  id: number;
  spokeIndex: number;
  distFromCenter: number;
  type: 'coin' | 'gem' | 'star' | 'jackpot';
  points: number;
  color: string;
  collected: boolean;
  pulsePhase: number;
}

interface VoltageRing {
  radius: number;
  speed: number;
  active: boolean;
}

interface WheelClimber {
  id: PlayerId;
  spokeIndex: number; // 0 to 7
  dist: number;       // distance along spoke (38 to 208)
  radialVel: number;
  speed: number;
  facing: 1 | -1;
  isJumping: boolean;
  jumpArc: number;
  jumpProgress: number;
  fromSpoke: number;
  targetSpoke: number;
  targetDist: number;
  isSuperVault: boolean;
  steerHopCooldown: number;
  isCharging: boolean;
  chargeRatio: number;
  overloadTimer: number;
  fallRespawnTimer: number;
  stunTimer: number;
  score: number;
  tokensCollected: number;
  shuntsLanded: number;
  isUnderdog: boolean;
  inGondola: boolean;
  wx: number;
  wy: number;
  botReactionTimer: number;
  botTargetSpoke: number;
  botTargetDist: number;
  botTargetCharge: number;
}

export class FerrisWheelGame extends BaseGame {
  public wheelTheme: WheelTheme = 'twilight';
  private wheelAngle: number = 0;
  private wheelSpeed: number = 0.56;
  private climbers: Map<PlayerId, WheelClimber> = new Map();
  private items: SpokeItem[] = [];
  private voltageRings: VoltageRing[] = [];
  private itemCounter: number = 0;
  private spawnTimer: number = 0;
  private ringSpawnTimer: number = 5.5;
  private readonly SPOKE_COUNT = 8;
  private readonly MAX_RADIUS = 208;
  private readonly GONDOLA_RADIUS = 186;
  private centerX: number = 0;
  private centerY: number = 0;
  private gustForce: number = 0;
  private gustTimer: number = 3.5;
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
        if (e.key === '1') this.switchTheme('twilight', this.lastWidth, this.lastHeight);
        else if (e.key === '2') this.switchTheme('neon', this.lastWidth, this.lastHeight);
        else if (e.key === '3') this.switchTheme('stormy', this.lastWidth, this.lastHeight);
        else if (e.key === 't' || e.key === 'T') {
          const order: WheelTheme[] = ['twilight', 'neon', 'stormy'];
          const next = order[(order.indexOf(this.wheelTheme) + 1) % order.length];
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
          const order: WheelTheme[] = ['twilight', 'neon', 'stormy'];
          const next = order[(order.indexOf(this.wheelTheme) + 1) % order.length];
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

  public switchTheme(theme: WheelTheme, width: number, height: number): void {
    this.wheelTheme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `THEME: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'twilight' ? '#F59E0B' : theme === 'neon' ? '#38BDF8' : '#94A3B8',
      22
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.roundTimer = 38.0;
    this.isFinished = false;
    this.suddenDeathTriggered = false;
    this.wheelAngle = 0;
    this.wheelSpeed = 0.56;
    this.climbers.clear();
    this.items = [];
    this.voltageRings = [];
    this.itemCounter = 0;
    this.spawnTimer = 0;
    this.ringSpawnTimer = 5.5;
    this.gustForce = 12;
    this.gustTimer = 3.5;

    this.centerX = width / 2;
    this.centerY = height / 2 + 16;

    this.initPlayers();
    this.populateInitialItems();
  }

  private initPlayers(): void {
    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);

    active.forEach((p, idx) => {
      const assignedSpoke = Math.floor((idx / count) * this.SPOKE_COUNT) % this.SPOKE_COUNT;
      const dist = 105 + (idx % 2) * 28;
      const angle = (assignedSpoke / this.SPOKE_COUNT) * Math.PI * 2;
      this.climbers.set(p.id, {
        id: p.id,
        spokeIndex: assignedSpoke,
        dist,
        radialVel: 0,
        speed: 155,
        facing: 1,
        isJumping: false,
        jumpArc: 0,
        jumpProgress: 0,
        fromSpoke: assignedSpoke,
        targetSpoke: assignedSpoke,
        targetDist: dist,
        isSuperVault: false,
        steerHopCooldown: 0,
        isCharging: false,
        chargeRatio: 0,
        overloadTimer: 0,
        fallRespawnTimer: 0,
        stunTimer: 0,
        score: 0,
        tokensCollected: 0,
        shuntsLanded: 0,
        isUnderdog: false,
        inGondola: false,
        wx: this.centerX + Math.cos(angle) * dist,
        wy: this.centerY + Math.sin(angle) * dist,
        botReactionTimer: 0.15 + idx * 0.06,
        botTargetSpoke: assignedSpoke,
        botTargetDist: dist,
        botTargetCharge: 0.82
      });
    });
  }

  private populateInitialItems(): void {
    for (let s = 0; s < this.SPOKE_COUNT; s++) {
      for (let r = 68; r <= 186; r += 58) {
        this.spawnItemOnSpoke(s, r, false);
      }
    }
  }

  private spawnItemOnSpoke(spokeIndex: number, dist: number, forceJackpot: boolean = false): void {
    const roll = Math.random();
    let type: 'coin' | 'gem' | 'star' | 'jackpot' = 'coin';
    let points = 50;
    let color = '#FDE047';

    if (forceJackpot) {
      type = 'jackpot';
      points = 350;
      color = '#F43F5E';
    } else if (roll < 0.22) {
      type = 'star';
      points = 220;
      color = '#F59E0B';
    } else if (roll < 0.56) {
      type = 'gem';
      points = 120;
      color = '#38BDF8';
    }

    this.items.push({
      id: ++this.itemCounter,
      spokeIndex,
      distFromCenter: dist,
      type,
      points,
      color,
      collected: false,
      pulsePhase: Math.random() * Math.PI * 2
    });
  }

  private getShortestSpokeDelta(fromSpoke: number, toSpoke: number): number {
    let diff = (toSpoke - fromSpoke) % this.SPOKE_COUNT;
    if (diff > this.SPOKE_COUNT / 2) diff -= this.SPOKE_COUNT;
    if (diff < -this.SPOKE_COUNT / 2) diff += this.SPOKE_COUNT;
    return diff;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.lastWidth = width;
    this.lastHeight = height;
    this.centerX = width / 2;
    this.centerY = height / 2 + 16;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Sudden Death Overdrive at <= 12s
    if (this.roundTimer <= 12.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.wheelSpeed = 0.88;
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText(
        '⚡ SUDDEN DEATH: TURBO WHEEL & GONDOLA JACKPOTS! ⚡',
        width / 2,
        104,
        '#F43F5E',
        22
      );
      for (let s = 0; s < this.SPOKE_COUNT; s += 2) {
        this.spawnItemOnSpoke(s, this.GONDOLA_RADIUS, true);
      }
    }

    // Compute Underdog Surge (>= 350 pts behind leader)
    let maxScore = 0;
    for (const c of this.climbers.values()) {
      if (c.score > maxScore) maxScore = c.score;
    }
    for (const c of this.climbers.values()) {
      c.isUnderdog = maxScore - c.score >= 350;
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Rotate Giant Wheel
    this.wheelAngle += this.wheelSpeed * dt;

    // High altitude wind gusts
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gustTimer = 3.2 + Math.random() * 2.4;
      const sign = Math.random() < 0.5 ? -1 : 1;
      this.gustForce = sign * (22 + Math.random() * 24);
    }

    // Hub Voltage Rings (hazard you can jump over or shelter inside a Gondola Cabin)
    this.ringSpawnTimer -= dt;
    if (this.ringSpawnTimer <= 0) {
      this.ringSpawnTimer = this.suddenDeathTriggered ? 3.2 : 5.2;
      this.voltageRings.push({
        radius: 34,
        speed: this.suddenDeathTriggered ? 92 : 72,
        active: true
      });
      this.audio.playTap();
    }

    for (const ring of this.voltageRings) {
      if (!ring.active) continue;
      ring.radius += ring.speed * dt;
      if (ring.radius > this.MAX_RADIUS + 10) {
        ring.active = false;
      }
    }
    this.voltageRings = this.voltageRings.filter((r) => r.active);

    // Item respawner
    this.spawnTimer -= dt;
    const activeItems = this.items.filter((i) => !i.collected);
    if (this.spawnTimer <= 0 && activeItems.length < 16) {
      this.spawnTimer = this.suddenDeathTriggered ? 0.65 : 1.05;
      const s = Math.floor(Math.random() * this.SPOKE_COUNT);
      const r = Math.random() < 0.35 ? this.GONDOLA_RADIUS : 62 + Math.random() * 118;
      this.spawnItemOnSpoke(s, r, this.suddenDeathTriggered && Math.random() < 0.28);
    }

    // Update Climbers
    const activePlayers = this.getActivePlayers();
    for (const p of activePlayers) {
      const c = this.climbers.get(p.id);
      if (!c) continue;

      if (c.fallRespawnTimer > 0) {
        c.fallRespawnTimer = Math.max(0, c.fallRespawnTimer - dt);
        const angle = this.wheelAngle + (c.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;
        c.wx = this.centerX + Math.cos(angle) * c.dist;
        c.wy = this.centerY + Math.sin(angle) * c.dist;
        continue;
      }

      if (c.stunTimer > 0) {
        c.stunTimer = Math.max(0, c.stunTimer - dt);
      }
      if (c.overloadTimer > 0) {
        c.overloadTimer = Math.max(0, c.overloadTimer - dt);
      }
      if (c.steerHopCooldown > 0) {
        c.steerHopCooldown = Math.max(0, c.steerHopCooldown - dt);
      }

      // Mid-jump across spokes
      if (c.isJumping) {
        const jumpRate = c.isSuperVault ? 3.8 : 3.2;
        c.jumpProgress += jumpRate * dt;
        c.jumpArc = Math.sin(c.jumpProgress * Math.PI) * (c.isSuperVault ? 42 : 26);

        const fromAngle = this.wheelAngle + (c.fromSpoke / this.SPOKE_COUNT) * Math.PI * 2;
        const spokeDelta = this.getShortestSpokeDelta(c.fromSpoke, c.targetSpoke);
        const curAngle = fromAngle + (spokeDelta / this.SPOKE_COUNT) * Math.PI * 2 * c.jumpProgress;
        const curDist = c.dist + (c.targetDist - c.dist) * c.jumpProgress;
        c.wx = this.centerX + Math.cos(curAngle) * curDist;
        c.wy = this.centerY + Math.sin(curAngle) * curDist - c.jumpArc;

        if (c.jumpProgress >= 1.0) {
          c.jumpProgress = 0;
          c.isJumping = false;
          c.jumpArc = 0;
          c.spokeIndex = c.targetSpoke;
          c.dist = c.targetDist;
          this.audio.playBounce();

          if (c.isSuperVault) {
            c.isSuperVault = false;
            this.triggerSuperVaultLanding(c, p.color);
          }
        }
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const holdingAction = this.input.isActionPressed(p.id);
      const boostMult = c.isUnderdog ? 1.32 : 1.0;

      // Gondola shelter check (near rim at GONDOLA_RADIUS)
      c.inGondola = Math.abs(c.dist - this.GONDOLA_RADIUS) <= 16;

      // Hold-to-Charge Grapple Vault & Shockwave Shunt
      if (c.overloadTimer <= 0 && c.stunTimer <= 0) {
        if (holdingAction) {
          c.isCharging = true;
          c.chargeRatio += dt * 1.15 * (c.isUnderdog ? 1.3 : 1.0);
          if (c.chargeRatio >= 1.0) {
            // Overcharge winch stall
            c.chargeRatio = 0;
            c.isCharging = false;
            c.overloadTimer = 0.55;
            this.audio.playStun();
            this.particles.showFloatingText('WINCH JAM!', c.wx, c.wy - 22, '#F97316', 16);
          }
        } else if (c.isCharging) {
          const ratio = c.chargeRatio;
          c.isCharging = false;
          c.chargeRatio = 0;

          const isSweetSpot = ratio >= 0.72 && ratio <= 0.98;
          const jumpDir = steer < -0.15 ? -1 : steer > 0.15 ? 1 : c.facing;
          const spokeStep = isSweetSpot ? jumpDir * 2 : jumpDir;
          c.fromSpoke = c.spokeIndex;
          c.targetSpoke = (c.spokeIndex + spokeStep + this.SPOKE_COUNT) % this.SPOKE_COUNT;
          c.targetDist = Math.max(52, Math.min(this.GONDOLA_RADIUS, c.dist));
          c.isJumping = true;
          c.jumpProgress = 0;
          c.isSuperVault = isSweetSpot;
          this.audio.playWhoosh();

          if (isSweetSpot) {
            this.particles.showFloatingText('SWEET VAULT!', c.wx, c.wy - 24, '#38BDF8', 18);
          }
        }
      }

      // Steer hops cleanly to adjacent spoke
      if (!c.isJumping && Math.abs(steer) > 0.48 && c.steerHopCooldown <= 0 && c.stunTimer <= 0) {
        const jumpDir = steer > 0 ? 1 : -1;
        c.facing = jumpDir;
        c.fromSpoke = c.spokeIndex;
        c.targetSpoke = (c.spokeIndex + jumpDir + this.SPOKE_COUNT) % this.SPOKE_COUNT;
        c.targetDist = c.dist;
        c.isJumping = true;
        c.jumpProgress = 0;
        c.isSuperVault = false;
        c.steerHopCooldown = 0.24;
        this.audio.playWhoosh();
        continue;
      }

      // Climb inward / outward along current spoke
      if (Math.abs(throttle) > 0.15 && c.stunTimer <= 0) {
        c.radialVel -= throttle * c.speed * boostMult * 4.5 * dt;
      }

      // Natural gravity & wind gust pull along spoke slope
      const spokeAngle = this.wheelAngle + (c.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;
      const gravitySlide = Math.sin(spokeAngle) * 44;
      const windSlide = Math.cos(spokeAngle) * this.gustForce;
      const gondolaStabilizer = c.inGondola ? 0.25 : 1.0;

      c.radialVel += (gravitySlide + windSlide) * gondolaStabilizer * dt;
      c.radialVel *= Math.pow(0.18, dt);
      c.dist += c.radialVel * dt;
      c.dist = Math.max(38, Math.min(this.MAX_RADIUS, c.dist));

      c.wx = this.centerX + Math.cos(spokeAngle) * c.dist;
      c.wy = this.centerY + Math.sin(spokeAngle) * c.dist;

      // Apex Gondola Passive Score Bonus (riding a gondola near top of wheel)
      if (c.inGondola && Math.sin(spokeAngle) < -0.65) {
        // Award periodic apex bonus
        if (Math.random() < dt * 2.5) {
          c.score += 15;
          this.particles.showFloatingText('+15 APEX', c.wx, c.wy - 22, '#FDE047', 14);
        }
      }

      // Check Voltage Ring hazard (unless jumping or sheltered inside a Gondola Cabin!)
      for (const ring of this.voltageRings) {
        if (!c.inGondola && Math.abs(c.dist - ring.radius) < 11 && c.stunTimer <= 0) {
          c.stunTimer = 0.65;
          c.radialVel += 95; // pushes outward
          this.audio.playBounce();
          this.particles.spawnSparks(c.wx, c.wy, '#38BDF8', 10);
          this.particles.showFloatingText('ZAPPED!', c.wx, c.wy - 18, '#38BDF8', 16);
        }
      }

      // Over-the-edge slip check: if pushed to MAX_RADIUS on downward lower hemisphere
      if (c.dist >= this.MAX_RADIUS - 2 && Math.sin(spokeAngle) > 0.35 && !c.inGondola) {
        c.fallRespawnTimer = 1.35;
        c.score = Math.max(0, c.score - 80);
        c.dist = 82;
        c.radialVel = 0;
        this.audio.playStun();
        this.particles.shake(0.28);
        this.particles.showFloatingText('SLIPPED! -80', c.wx, c.wy, '#EF4444', 20);
        continue;
      }

      // Check item collection
      this.collectNearbyItems(c, c.inGondola ? 28 : 23);
    }

    // Player-to-Player Elastic Spoke & Mid-Air Collisions (m1*v1 + m2*v2)
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const c1 = this.climbers.get(activePlayers[i].id);
        const c2 = this.climbers.get(activePlayers[j].id);
        if (!c1 || !c2 || c1.fallRespawnTimer > 0 || c2.fallRespawnTimer > 0) continue;

        const dx = c2.wx - c1.wx;
        const dy = c2.wy - c1.wy;
        const distSq = dx * dx + dy * dy;
        const minDist = 28;
        if (distSq > 0 && distSq < minDist * minDist) {
          const d = Math.sqrt(distSq);
          const overlap = (minDist - d) * 0.5;
          // Radial separation along spokes
          if (c1.spokeIndex === c2.spokeIndex) {
            if (c1.dist < c2.dist) {
              c1.dist = Math.max(38, c1.dist - overlap);
              c2.dist = Math.min(this.MAX_RADIUS, c2.dist + overlap + 12);
              c2.radialVel += 110;
              c1.score += 40;
              c1.shuntsLanded++;
              this.particles.showFloatingText('SHUNT! +40', c1.wx, c1.wy - 20, '#F59E0B', 16);
            } else {
              c2.dist = Math.max(38, c2.dist - overlap);
              c1.dist = Math.min(this.MAX_RADIUS, c1.dist + overlap + 12);
              c1.radialVel += 110;
              c2.score += 40;
              c2.shuntsLanded++;
              this.particles.showFloatingText('SHUNT! +40', c2.wx, c2.wy - 20, '#F59E0B', 16);
            }
            this.audio.playBounce();
            this.particles.spawnSparks((c1.wx + c2.wx) * 0.5, (c1.wy + c2.wy) * 0.5, '#FDE047', 10);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private triggerSuperVaultLanding(c: WheelClimber, color: string): void {
    this.particles.spawnExplosion(c.wx, c.wy, color, 16);
    // Magnet-collect nearby items within 54px
    this.collectNearbyItems(c, 54);

    // Shockwave shunt rivals on the same or adjacent spokes
    for (const other of this.climbers.values()) {
      if (other.id === c.id || other.fallRespawnTimer > 0) continue;
      const spokeDiff = Math.abs(this.getShortestSpokeDelta(c.spokeIndex, other.spokeIndex));
      if (spokeDiff <= 1 && Math.abs(other.dist - c.dist) < 65) {
        other.radialVel += 165;
        other.dist = Math.min(this.MAX_RADIUS, other.dist + 32);
        other.stunTimer = 0.55;
        c.score += 90;
        c.shuntsLanded++;
        this.audio.playBounce();
        this.particles.showFloatingText('VAULT SHUNT! +90', c.wx, c.wy - 28, '#38BDF8', 18);
      }
    }
  }

  private collectNearbyItems(c: WheelClimber, pickupRadius: number): void {
    for (const item of this.items) {
      if (item.collected) continue;
      const angle = this.wheelAngle + (item.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;
      const ix = this.centerX + Math.cos(angle) * item.distFromCenter;
      const iy = this.centerY + Math.sin(angle) * item.distFromCenter;
      const dist = Math.hypot(c.wx - ix, c.wy - iy);

      if (dist <= pickupRadius) {
        item.collected = true;
        const gondolaMult = c.inGondola ? 1.25 : 1.0;
        const underdogMult = c.isUnderdog ? 1.25 : 1.0;
        const pts = Math.round(item.points * gondolaMult * underdogMult);
        c.score += pts;
        c.tokensCollected += 1;
        this.audio.playCoin();
        this.particles.showFloatingText(`+${pts}`, ix, iy - 16, item.color, 20);
        this.particles.spawnConfetti(ix, iy, 10);
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
    _width: number,
    _height: number
  ): void {
    const c = this.climbers.get(botId);
    if (!c || c.fallRespawnTimer > 0 || c.isJumping) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // If charging grapple vault, release at target charge ratio
    if (c.isCharging) {
      if (c.chargeRatio >= c.botTargetCharge) {
        const dir = this.getShortestSpokeDelta(c.spokeIndex, c.botTargetSpoke) >= 0 ? 1 : -1;
        this.input.setBotInput(botId, true, dir, 0, false);
      } else {
        this.input.setBotInput(botId, true, 0, 0, true);
      }
      return;
    }

    c.botReactionTimer -= dt;
    if (c.botReactionTimer > 0) return;

    c.botReactionTimer =
      difficulty === 'bot_hard'
        ? 0.09 + Math.random() * 0.04
        : difficulty === 'bot_normal'
        ? 0.22 + Math.random() * 0.04
        : 0.38 + Math.random() * 0.07;

    // Easy bot occasional blunder
    if (difficulty === 'bot_easy' && Math.random() < 0.21) {
      this.input.setBotInput(botId, true, 0, -0.6, false);
      return;
    }

    const spokeAngle = this.wheelAngle + (c.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;

    // 1. Emergency slip prevention on lower hemisphere outside Gondola
    if (c.dist > 168 && Math.sin(spokeAngle) > 0.3 && !c.inGondola) {
      this.input.setBotInput(botId, true, 0, 1, false);
      return;
    }

    // 2. Dodge incoming Voltage Ring (either hop spoke or enter Gondola)
    if (difficulty !== 'bot_easy') {
      for (const ring of this.voltageRings) {
        if (Math.abs(c.dist - ring.radius) < 26 && !c.inGondola) {
          this.input.setBotInput(botId, true, 1, 1, false);
          return;
        }
      }
    }

    // 3. Evaluate all available items across all spokes
    let bestItem: SpokeItem | null = null;
    let bestScoreVal = -9999;

    for (const it of this.items) {
      if (it.collected) continue;
      const spokeSteps = Math.abs(this.getShortestSpokeDelta(c.spokeIndex, it.spokeIndex));
      const radialDiff = Math.abs(c.dist - it.distFromCenter);
      const val = it.points * 1.4 - spokeSteps * 55 - radialDiff * 0.7;
      if (val > bestScoreVal) {
        bestScoreVal = val;
        bestItem = it;
      }
    }

    if (bestItem) {
      const spokeDelta = this.getShortestSpokeDelta(c.spokeIndex, bestItem.spokeIndex);
      if (spokeDelta === 0) {
        // On the right spoke: climb inward or outward to collect
        const diff = bestItem.distFromCenter - c.dist;
        if (Math.abs(diff) > 10) {
          const throttle = diff > 0 ? -1 : 1; // negative throttle climbs outward
          this.input.setBotInput(botId, true, 0, throttle, false);
        } else {
          this.input.setBotInput(botId, false, 0, 0, false);
        }
        return;
      }

      // If target is 2 spokes away and bot is Normal/Hard, charge a Sweet-Spot Super Vault!
      if (Math.abs(spokeDelta) >= 2 && difficulty !== 'bot_easy' && c.overloadTimer <= 0) {
        c.botTargetSpoke = bestItem.spokeIndex;
        c.botTargetCharge =
          difficulty === 'bot_hard' ? 0.78 + Math.random() * 0.14 : 0.70 + Math.random() * 0.18;
        c.facing = spokeDelta > 0 ? 1 : -1;
        this.input.setBotInput(botId, true, 0, 0, true);
        return;
      }

      // Otherwise hop 1 spoke in the right direction (fixes old -1 bug!)
      const hopDir = spokeDelta > 0 ? 1 : -1;
      this.input.setBotInput(botId, true, hopDir, 0, false);
      return;
    }

    // Fallback: climb toward Gondola cabin radius for safe Apex points
    const gondolaDiff = this.GONDOLA_RADIUS - c.dist;
    this.input.setBotInput(botId, true, 0, gondolaDiff > 0 ? -1 : 1, false);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;

    // 1. High Altitude Carnival Backdrop + Support A-Frame Towers
    this.renderBackdrop(ctx, width, height);

    // 2. Giant Mechanical Ferris Wheel Frame, Spokes, Voltage Rings & Gondolas
    this.renderWheel(ctx);

    // 3. Spoke Items (Coins, Gems, Stars, Jackpots)
    this.renderItems(ctx);

    // 4. Climbers & Mascots + Charge Arcs
    this.renderClimbers(ctx);

    // 5. Wind Indicator & Theme Pill
    this.renderWindIndicator(ctx, width);
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const now = performance.now() * 0.001;
    if (this.wheelTheme === 'twilight') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1E1B4B');
      grad.addColorStop(0.55, '#4C1D95');
      grad.addColorStop(1, '#9D174D');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (this.wheelTheme === 'neon') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#040711');
      grad.addColorStop(0.6, '#0F172A');
      grad.addColorStop(1, '#1E1B4B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Perspective synth grid at bottom
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, height - 90);
        ctx.lineTo((x - width / 2) * 1.5 + width / 2, height);
        ctx.stroke();
      }
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0F172A');
      grad.addColorStop(0.65, '#1E293B');
      grad.addColorStop(1, '#334155');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Support A-Frame Steel Towers anchoring the Ferris Wheel hub to the pier
    ctx.save();
    ctx.strokeStyle = this.wheelTheme === 'neon' ? 'rgba(30, 64, 175, 0.7)' : 'rgba(15, 23, 42, 0.65)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(this.centerX - 115, height);
    ctx.lineTo(this.centerX, this.centerY);
    ctx.lineTo(this.centerX + 115, height);
    ctx.stroke();

    // Distant Carnival Pier String Lights at bottom
    for (let x = 20; x < width; x += 36) {
      const glow = 0.5 + 0.5 * Math.sin(now * 4 + x * 0.1);
      ctx.fillStyle = `rgba(253, 224, 71, ${0.25 + glow * 0.35})`;
      ctx.beginPath();
      ctx.arc(x, height - 18, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderWheel(ctx: CanvasRenderingContext2D): void {
    const now = performance.now() * 0.001;
    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    // Apex Sky Bonus Zone Indicator at top of wheel
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, this.MAX_RADIUS + 12, -Math.PI * 0.72, -Math.PI * 0.28);
    ctx.stroke();
    ctx.fillStyle = '#FDE047';
    ctx.font = '800 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ APEX GONDOLA BONUS ZONE ★', 0, -this.MAX_RADIUS - 18);
    ctx.restore();

    // Outer Rim Double Truss Rings
    ctx.strokeStyle = this.wheelTheme === 'neon' ? '#06B6D4' : this.wheelTheme === 'stormy' ? '#94A3B8' : '#F59E0B';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, this.MAX_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.GONDOLA_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Expanding Hub Voltage Rings
    for (const ring of this.voltageRings) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 8 Structural Iron Spokes + Glowing Bulbs + Gravity-Stabilized 2.5D Gondola Cabins
    for (let s = 0; s < this.SPOKE_COUNT; s++) {
      const angle = this.wheelAngle + (s / this.SPOKE_COUNT) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Steel girder truss spoke
      ctx.strokeStyle =
        this.wheelTheme === 'neon'
          ? 'rgba(56, 189, 248, 0.85)'
          : this.wheelTheme === 'stormy'
          ? '#CBD5E1'
          : '#D97706';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(cos * 32, sin * 32);
      ctx.lineTo(cos * this.MAX_RADIUS, sin * this.MAX_RADIUS);
      ctx.stroke();

      // Marquee chase lights along each spoke
      for (let r = 64; r <= 168; r += 34) {
        const lit = Math.sin(now * 6 - r * 0.08 + s) > 0;
        ctx.fillStyle = lit ? '#FEF08A' : 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(cos * r, sin * r, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2.5D Swinging Gondola Cabin anchored at GONDOLA_RADIUS (always hangs upright with wind sway!)
      const gx = cos * this.GONDOLA_RADIUS;
      const gy = sin * this.GONDOLA_RADIUS;
      const sway = Math.sin(now * 2.6 + s) * 0.08 + this.gustForce * 0.0025;

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(sway);

      // Gondola hanger bar
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 12);
      ctx.stroke();

      // Cabin roof & body
      const cabinColor = s % 2 === 0 ? '#0EA5E9' : '#EC4899';
      ctx.fillStyle = cabinColor;
      ctx.beginPath();
      ctx.roundRect(-14, 10, 28, 18, 6);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cabin panoramic window
      ctx.fillStyle = 'rgba(254, 249, 195, 0.75)';
      ctx.fillRect(-9, 13, 18, 7);
      ctx.restore();
    }

    // Inner Hub Turbine Gear
    const hubGrad = ctx.createRadialGradient(-6, -6, 4, 0, 0, 34);
    hubGrad.addColorStop(0, '#FDE047');
    hubGrad.addColorStop(0.6, '#D97706');
    hubGrad.addColorStop(1, '#334155');
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  }

  private renderItems(ctx: CanvasRenderingContext2D): void {
    const now = performance.now() * 0.004;
    for (const it of this.items) {
      if (it.collected) continue;

      const angle = this.wheelAngle + (it.spokeIndex / this.SPOKE_COUNT) * Math.PI * 2;
      const ix = this.centerX + Math.cos(angle) * it.distFromCenter;
      const iy = this.centerY + Math.sin(angle) * it.distFromCenter;
      const scale = 1 + 0.12 * Math.sin(now + it.pulsePhase);

      ctx.save();
      ctx.translate(ix, iy);
      ctx.scale(scale, scale);

      if (it.type === 'jackpot') {
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♛', 0, 4);
      } else if (it.type === 'star') {
        ctx.fillStyle = it.color;
        ctx.font = '900 17px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 6);
      } else if (it.type === 'gem') {
        ctx.fillStyle = it.color;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 8);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = it.color;
        ctx.fill();
        ctx.strokeStyle = '#CA8A04';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderClimbers(ctx: CanvasRenderingContext2D): void {
    const now = performance.now() * 0.001;
    for (const p of this.getActivePlayers()) {
      const c = this.climbers.get(p.id);
      if (!c || c.fallRespawnTimer > 0) continue;

      const px = c.wx;
      const py = c.wy;

      ctx.save();
      ctx.translate(px, py);

      // Underdog golden halo
      if (c.isUnderdog) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Grapple Vault Charge Ring (72%-98% Sweet Spot highlighted)
      if (c.isCharging) {
        const r = 21;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, Math.PI * 1.5);
        ctx.stroke();

        const isSweet = c.chargeRatio >= 0.72 && c.chargeRatio <= 0.98;
        ctx.strokeStyle = isSweet ? '#22C55E' : '#38BDF8';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + c.chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      // Mascot Climber
      const mood =
        c.stunTimer > 0 || c.dist > 188
          ? 'shocked'
          : c.inGondola || c.tokensCollected > 2
          ? 'triumph'
          : 'focused';
      this.drawPlayerMascot(ctx, p.id, 0, 0, 14, mood, now);

      ctx.restore();

      // Score & Status Label
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(`${c.score} pts`, px, py - 21);
      ctx.restore();
    }
  }

  private renderWindIndicator(ctx: CanvasRenderingContext2D, width: number): void {
    const dir = this.gustForce >= 0 ? '→' : '←';
    const knots = Math.round(Math.abs(this.gustForce));
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 78, 86, 156, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 10.5px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`HIGH-WIRE WIND: ${dir} ${knots} KT`, width / 2, 100.5);
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
    ctx.fillStyle = this.wheelTheme === 'twilight' ? '#F59E0B' : this.wheelTheme === 'neon' ? '#38BDF8' : '#94A3B8';
    ctx.fillText(`THEME: ${this.wheelTheme.toUpperCase()} [T]`, pillX + pillW / 2, pillY + 20);
    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const c = this.climbers.get(p.id);
        const score = c ? c.score : 0;
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

    let mvpHighlight = 'High Altitude Sky-Wheel Master!';
    if (winnerId !== null) {
      const c = this.climbers.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} snagged ${c?.tokensCollected || 0} tokens & ${c?.shuntsLanded || 0} girder shunts!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
