import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

export type AnvilType = 'normal' | 'giant' | 'golden';

export interface AnvilTheme {
  name: string;
  floorBg: string;
  tileA: string;
  tileB: string;
  border: string;
  glow: string;
  accent: string;
}

export const ANVIL_THEMES: AnvilTheme[] = [
  {
    name: 'Blacksmith Forge 🔨',
    floorBg: '#18181B',
    tileA: '#27272A',
    tileB: '#1F1F23',
    border: '#F59E0B',
    glow: '#F59E0B',
    accent: '#FBBF24'
  },
  {
    name: 'Neon Cyberpunk ⚡',
    floorBg: '#0B0F19',
    tileA: '#111827',
    tileB: '#0F172A',
    border: '#06B6D4',
    glow: '#06B6D4',
    accent: '#EC4899'
  },
  {
    name: 'Volcano Foundry 🌋',
    floorBg: '#1C0D0A',
    tileA: '#29120D',
    tileB: '#1F0D09',
    border: '#EF4444',
    glow: '#EF4444',
    accent: '#F97316'
  }
];

export interface AnvilDrop {
  id: number;
  type: AnvilType;
  x: number;
  y: number;
  altitude: number;
  warningTime: number;
  initialWarning: number;
  radius: number;
  landed: boolean;
  fadeTimer: number;
}

export type PowerUpType = 'helmet' | 'speed' | 'coin';

export interface PowerUpItem {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  life: number;
}

export interface FlyingHelmet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  vRot: number;
  color: string;
  life: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

export interface DodgingRunner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  dashCooldown: number;
  dashDuration: number;
  hasHelmet: boolean;
  invulnerableTimer: number;
  stunTimer: number;
  speedBoostTimer: number;
  lastShovedById: PlayerId | null;
  lastShoveTime: number;
  score: number;
  coinsCollected: number;
  shovesGiven: number;
  tackleEliminations: number;
  facingAngle: number;
}

export class AnvilRainGame extends BaseGame {
  public static readonly THEMES = ANVIL_THEMES;
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  private runners: Map<PlayerId, DodgingRunner> = new Map();
  private anvils: AnvilDrop[] = [];
  private powerups: PowerUpItem[] = [];
  private flyingHelmets: FlyingHelmet[] = [];
  private shockwaves: Shockwave[] = [];
  private anvilIdCounter: number = 0;
  private powerupIdCounter: number = 0;
  private spawnInterval: number = 0.85;
  private spawnTimer: number = 0.4;
  private powerupTimer: number = 4.0;
  private eliminationOrder: PlayerId[] = [];
  private stormIntensity: number = 1.0;

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % ANVIL_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = e.target as HTMLCanvasElement;
      if (!canvas || !canvas.getBoundingClientRect) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill is at x: 20, y: canvas.height - 44, w: 160, h: 32
      if (clickX >= 20 && clickX <= 180 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % ANVIL_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.runners.clear();
    this.anvils = [];
    this.powerups = [];
    this.flyingHelmets = [];
    this.shockwaves = [];
    this.anvilIdCounter = 0;
    this.powerupIdCounter = 0;
    this.spawnInterval = 0.85;
    this.spawnTimer = 0.4;
    this.powerupTimer = 3.5;
    this.eliminationOrder = [];
    this.stormIntensity = 1.0;

    const active = this.getActivePlayers();
    const count = active.length;
    const cx = width / 2;
    const cy = height / 2;

    active.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      const dist = Math.min(width, height) * 0.22;
      this.runners.set(p.id, {
        id: p.id,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: 16,
        alive: true,
        dashCooldown: 0,
        dashDuration: 0,
        hasHelmet: true,
        invulnerableTimer: 0,
        stunTimer: 0,
        speedBoostTimer: 0,
        lastShovedById: null,
        lastShoveTime: 0,
        score: 0,
        coinsCollected: 0,
        shovesGiven: 0,
        tackleEliminations: 0,
        facingAngle: angle
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.stormIntensity += dt * 0.022; // Escalates over time!

    // Update bot decisions with intelligent 16-ray safety grid
    this.updateBots(dt, width, height);

    // Spawn falling anvils (Normal, Giant, or Golden)
    this.spawnTimer -= dt * this.stormIntensity;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.24, this.spawnInterval / this.stormIntensity);
      this.spawnAnvil(width, height);
    }

    // Spawn ambient powerups (Helmets, Speed Sneakers, Gold Coins)
    this.powerupTimer -= dt;
    if (this.powerupTimer <= 0) {
      this.powerupTimer = 4.5 + Math.random() * 3.0;
      this.spawnPowerUp(width, height);
    }

    // Process Powerup Lifetimes & Pickup
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.life -= dt;
      if (pu.life <= 0) {
        this.powerups.splice(i, 1);
        continue;
      }

      // Check collision with runners
      for (const r of this.runners.values()) {
        if (!r.alive) continue;
        const d = Math.hypot(r.x - pu.x, r.y - pu.y);
        if (d < r.radius + 14) {
          if (pu.type === 'helmet') {
            r.hasHelmet = true;
            r.score += 40;
            this.audio.playBoost();
            this.particles.spawnSparks(pu.x, pu.y, '#FBBF24', 16);
            this.particles.showFloatingText('🪖 HARD HAT RESTORED!', r.x, r.y - 25, '#FBBF24', 18);
          } else if (pu.type === 'speed') {
            r.speedBoostTimer = 5.0;
            r.score += 30;
            this.audio.playBoost();
            this.particles.spawnSparks(pu.x, pu.y, '#38BDF8', 16);
            this.particles.showFloatingText('⚡ SPEED BOOST!', r.x, r.y - 25, '#38BDF8', 18);
          } else if (pu.type === 'coin') {
            r.score += 50;
            r.coinsCollected++;
            this.audio.playScore();
            this.particles.spawnSparks(pu.x, pu.y, '#FBBF24', 12);
            this.particles.showFloatingText('+50 🪙', r.x, r.y - 22, '#FBBF24', 16);
          }
          this.powerups.splice(i, 1);
          break;
        }
      }
    }

    // Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      sw.radius += (sw.maxRadius / sw.maxLife) * dt;

      // Check if shockwave hits runners
      for (const r of this.runners.values()) {
        if (!r.alive || r.invulnerableTimer > 0 || r.dashDuration > 0) continue;
        const dist = Math.hypot(r.x - sw.x, r.y - sw.y);
        if (Math.abs(dist - sw.radius) < 18) {
          const pushAngle = Math.atan2(r.y - sw.y, r.x - sw.x);
          r.vx += Math.cos(pushAngle) * 180;
          r.vy += Math.sin(pushAngle) * 180;
          r.stunTimer = 0.35;
          this.audio.playBounce();
          this.particles.spawnSparks(r.x, r.y, '#F59E0B', 8);
          this.particles.showFloatingText('TRIPPED!', r.x, r.y - 18, '#F59E0B', 14);
        }
      }

      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update Flying Dislodged Helmets
    for (let i = this.flyingHelmets.length - 1; i >= 0; i--) {
      const h = this.flyingHelmets[i];
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.vy += 320 * dt; // gravity
      h.angle += h.vRot * dt;
      h.life -= dt;
      if (h.life <= 0) {
        this.flyingHelmets.splice(i, 1);
      }
    }

    // Process Runner Controls, Physics, & Body-Checks
    for (const r of this.runners.values()) {
      if (!r.alive) continue;

      r.score += dt * 10;
      if (r.dashCooldown > 0) r.dashCooldown -= dt;
      if (r.dashDuration > 0) r.dashDuration -= dt;
      if (r.invulnerableTimer > 0) r.invulnerableTimer -= dt;
      if (r.stunTimer > 0) r.stunTimer -= dt;
      if (r.speedBoostTimer > 0) r.speedBoostTimer -= dt;

      const steer = this.input.getSteer(r.id);
      const throttle = this.input.getThrottle(r.id);
      const action = this.input.justAction(r.id) || this.input.isActionPressed(r.id);
      const justPressed = this.input.justPressed(r.id);

      // Dash / Body-Check trigger
      const wantDash = (action || justPressed) && r.dashCooldown <= 0 && r.stunTimer <= 0;
      if (wantDash) {
        r.dashCooldown = 0.75;
        r.dashDuration = 0.22;
        const dashSpeed = 380;
        const inputY = -throttle;
        const dashAngle = steer !== 0 || throttle !== 0 ? Math.atan2(inputY, steer) : r.facingAngle;
        r.facingAngle = dashAngle;
        r.vx = Math.cos(dashAngle) * dashSpeed;
        r.vy = Math.sin(dashAngle) * dashSpeed;
        this.audio.playBoost();
        this.particles.spawnSparks(r.x, r.y, '#38BDF8', 10);
      }

      // Continuous movement when not stunned
      if (r.stunTimer <= 0) {
        const inputY = -throttle;
        const baseSpeed = r.speedBoostTimer > 0 ? 280 : 210;
        if (steer !== 0 || throttle !== 0) {
          r.facingAngle = Math.atan2(inputY, steer);
          r.vx += (steer * baseSpeed - r.vx) * dt * 12;
          r.vy += (inputY * baseSpeed - r.vy) * dt * 12;
        } else if (r.dashDuration <= 0) {
          r.vx *= Math.pow(0.82, dt * 60);
          r.vy *= Math.pow(0.82, dt * 60);
        }
      } else {
        r.vx *= Math.pow(0.88, dt * 60);
        r.vy *= Math.pow(0.88, dt * 60);
      }

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Arena walls constrain with bounce
      const padding = 42;
      if (r.x < padding) {
        r.x = padding;
        r.vx = Math.abs(r.vx) * 0.5;
      } else if (r.x > width - padding) {
        r.x = width - padding;
        r.vx = -Math.abs(r.vx) * 0.5;
      }
      if (r.y < padding + 25) {
        r.y = padding + 25;
        r.vy = Math.abs(r.vy) * 0.5;
      } else if (r.y > height - padding) {
        r.y = height - padding;
        r.vy = -Math.abs(r.vy) * 0.5;
      }

      // Runner vs Runner Body-Check / Shove Mechanics
      for (const other of this.runners.values()) {
        if (other.id === r.id || !other.alive) continue;
        const d = Math.hypot(r.x - other.x, r.y - other.y);
        const minDist = r.radius + other.radius;

        if (d < minDist) {
          // Push apart
          const angle = Math.atan2(other.y - r.y, other.x - r.x);
          const overlap = minDist - d;
          other.x += Math.cos(angle) * overlap * 0.5;
          other.y += Math.sin(angle) * overlap * 0.5;
          r.x -= Math.cos(angle) * overlap * 0.5;
          r.y -= Math.sin(angle) * overlap * 0.5;

          // If r is actively dashing, execute a high-impact Body-Check!
          if (r.dashDuration > 0) {
            const shoveForce = 290;
            other.vx = Math.cos(r.facingAngle) * shoveForce;
            other.vy = Math.sin(r.facingAngle) * shoveForce;
            other.stunTimer = 0.38;
            other.lastShovedById = r.id;
            other.lastShoveTime = performance.now();

            r.shovesGiven++;
            r.score += 25;
            this.audio.playHitStopThud();
            this.particles.addTrauma(0.14);
            this.particles.spawnSparks(other.x, other.y, '#F59E0B', 12);
            this.particles.showFloatingText('💥 BODY-CHECK!', other.x, other.y - 22, '#F59E0B', 18);
          }
        }
      }
    }

    // Process Falling Anvils
    for (let i = this.anvils.length - 1; i >= 0; i--) {
      const a = this.anvils[i];

      if (!a.landed) {
        a.warningTime -= dt;
        a.altitude = Math.max(0, (a.warningTime / a.initialWarning) * 450);

        if (a.warningTime <= 0) {
          // Anvil Slams Ground!
          a.landed = true;
          a.altitude = 0;

          if (a.type === 'giant') {
            this.audio.playExplosion();
            this.particles.addTrauma(0.35);
            this.particles.spawnExplosion(a.x, a.y, '#DC2626', 28);
            // Spawn expanding ground shockwave ring
            this.shockwaves.push({
              x: a.x,
              y: a.y,
              radius: a.radius,
              maxRadius: 130,
              life: 0.45,
              maxLife: 0.45
            });
            this.particles.showFloatingText('⚡ MEGA SLAM! ⚡', a.x, a.y - 20, '#EF4444', 22);
          } else if (a.type === 'golden') {
            this.audio.playScore();
            this.particles.addTrauma(0.22);
            this.particles.spawnExplosion(a.x, a.y, '#FBBF24', 36);
            this.particles.showFloatingText('✨ GOLDEN JACKPOT! ✨', a.x, a.y - 25, '#FBBF24', 22);

            // Shower of coins and guaranteed Hard Hat
            this.powerups.push({
              id: ++this.powerupIdCounter,
              type: 'helmet',
              x: a.x,
              y: a.y,
              life: 12
            });
            [-35, 35].forEach((offsetX) => {
              this.powerups.push({
                id: ++this.powerupIdCounter,
                type: 'coin',
                x: a.x + offsetX,
                y: a.y + (Math.random() - 0.5) * 20,
                life: 10
              });
            });
          } else {
            this.audio.playExplosion();
            this.particles.addTrauma(0.18);
            this.particles.spawnExplosion(a.x, a.y, '#64748B', 18);
          }

          // Check if any runner was in the impact zone
          for (const r of this.runners.values()) {
            if (!r.alive) continue;
            const dist = Math.hypot(r.x - a.x, r.y - a.y);
            const crushRadius = a.radius + r.radius * 0.72;

            if (dist < crushRadius) {
              if (r.invulnerableTimer > 0) {
                // Invulnerability shield protects
                this.audio.playBounce();
                this.particles.spawnSparks(r.x, r.y, '#60A5FA', 14);
                this.particles.showFloatingText('SHIELDED!', r.x, r.y - 20, '#60A5FA', 16);
              } else if (r.hasHelmet) {
                // Hard Hat Helmet deflects the crush!
                r.hasHelmet = false;
                r.invulnerableTimer = 1.8;
                r.stunTimer = 0.4;
                this.audio.playBounce();
                this.particles.addTrauma(0.24);
                this.particles.spawnSparks(r.x, r.y, '#FBBF24', 20);

                // Flying helmet piece arcs through air
                this.flyingHelmets.push({
                  x: r.x,
                  y: r.y - 10,
                  vx: (Math.random() - 0.5) * 160,
                  vy: -180 - Math.random() * 80,
                  angle: 0,
                  vRot: (Math.random() - 0.5) * 18,
                  color: '#FBBF24',
                  life: 1.6
                });

                this.particles.showFloatingText('🪖 HELMET SAVED YOU! (CLANG!)', r.x, r.y - 30, '#FBBF24', 20);
              } else {
                // Direct Anvil Crush Pancake!
                r.alive = false;
                this.eliminationOrder.push(r.id);
                this.audio.playBounce();
                this.particles.addTrauma(0.3);
                this.particles.spawnExplosion(r.x, r.y, this.players[r.id].color, 32);
                this.particles.showFloatingText('🥞 SQUASHED!', r.x, r.y, '#EF4444', 26);

                // Award Shove Combo Elimination bonus
                if (r.lastShovedById !== null && performance.now() - r.lastShoveTime < 2000) {
                  const attacker = this.runners.get(r.lastShovedById);
                  if (attacker && attacker.alive) {
                    attacker.tackleEliminations++;
                    attacker.score += 200;
                    this.particles.showFloatingText('💀 ANVIL TACKLE ELIMINATION! +200', attacker.x, attacker.y - 30, '#10B981', 22);
                  }
                }
              }
            }
          }
        }
      } else {
        // Anvil stays on ground briefly then fades
        a.fadeTimer -= dt;
        if (a.fadeTimer <= 0) {
          this.anvils.splice(i, 1);
        }
      }
    }

    // Win condition check
    const survivors = Array.from(this.runners.values()).filter((r) => r.alive);
    if (survivors.length <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnAnvil(width: number, height: number): void {
    const padding = 65;
    const x = padding + Math.random() * (width - padding * 2);
    const y = padding + 35 + Math.random() * (height - padding * 2 - 35);

    // Roll anvil type: Normal (75%), Giant (18%), Golden (7%)
    const roll = Math.random();
    let type: AnvilType = 'normal';
    let radius = 28;
    let baseWarning = 1.15;

    if (roll < 0.18) {
      type = 'giant';
      radius = 45;
      baseWarning = 1.45;
    } else if (roll < 0.25) {
      type = 'golden';
      radius = 30;
      baseWarning = 1.25;
    }

    const warning = Math.max(0.62, baseWarning / Math.sqrt(this.stormIntensity));

    this.anvils.push({
      id: ++this.anvilIdCounter,
      type,
      x,
      y,
      altitude: 450,
      warningTime: warning,
      initialWarning: warning,
      radius,
      landed: false,
      fadeTimer: 0.65
    });
  }

  private spawnPowerUp(width: number, height: number): void {
    const padding = 75;
    const x = padding + Math.random() * (width - padding * 2);
    const y = padding + 40 + Math.random() * (height - padding * 2 - 40);

    const types: PowerUpType[] = ['helmet', 'speed', 'coin'];
    const type = types[Math.floor(Math.random() * types.length)];

    this.powerups.push({
      id: ++this.powerupIdCounter,
      type,
      x,
      y,
      life: 11
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const me = this.runners.get(botId);
    if (!me || !me.alive) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    if (me.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const padding = 55;
    let currentDanger = 0;
    let closestAnvilTime = 999;

    // Check if bot is currently under an imminent anvil shadow
    for (const a of this.anvils) {
      if (a.landed) continue;
      const d = Math.hypot(me.x - a.x, me.y - a.y);
      if (d < a.radius + 30) {
        const timeFactor = Math.max(0.08, a.warningTime);
        currentDanger += (1 / timeFactor) * 100;
        if (a.warningTime < closestAnvilTime) {
          closestAnvilTime = a.warningTime;
        }
      }
    }

    // 16-Ray Directional Safety Field Evaluation
    const angles = 16;
    const testDist = 65;
    let bestAngle = me.facingAngle;
    let bestScore = -999999;

    for (let i = 0; i < angles; i++) {
      const candAngle = (i / angles) * Math.PI * 2;
      const candX = me.x + Math.cos(candAngle) * testDist;
      const candY = me.y + Math.sin(candAngle) * testDist;

      let score = 0;

      // 1. Heavy penalty for leaving arena bounds or getting pinned against walls
      if (candX < padding || candX > width - padding || candY < padding + 25 || candY > height - padding) {
        score -= 2500;
      }

      // 2. Penalty for proximity to falling anvil shadows
      for (const a of this.anvils) {
        if (a.landed) continue;
        const d = Math.hypot(candX - a.x, candY - a.y);
        const dangerMargin = a.radius + (difficulty === 'bot_hard' ? 42 : difficulty === 'bot_normal' ? 32 : 22);
        if (d < dangerMargin) {
          const urgency = Math.max(0.05, a.warningTime);
          score -= (1 / urgency) * (dangerMargin - d) * 35;
        }
      }

      // 3. Proximity to shockwaves
      for (const sw of this.shockwaves) {
        const d = Math.hypot(candX - sw.x, candY - sw.y);
        if (Math.abs(d - sw.radius) < 32) {
          score -= 400;
        }
      }

      // 4. Collectibles score
      for (const pu of this.powerups) {
        const d = Math.hypot(candX - pu.x, candY - pu.y);
        if (d < 160) {
          if (pu.type === 'helmet' && !me.hasHelmet) score += 500;
          else if (pu.type === 'speed') score += 180;
          else if (pu.type === 'coin') score += 130;
        }
      }

      // 5. Tactical Shove opportunity on Normal/Hard
      if (difficulty !== 'bot_easy') {
        for (const other of this.runners.values()) {
          if (other.id === botId || !other.alive) continue;
          const dToEnemy = Math.hypot(candX - other.x, candY - other.y);
          if (dToEnemy < 55) {
            // Check if enemy is standing in an anvil drop zone
            for (const a of this.anvils) {
              if (!a.landed && Math.hypot(other.x - a.x, other.y - a.y) < a.radius + 30) {
                score += 380; // Shove them under!
              }
            }
          }
        }
      }

      // 6. Smooth directional inertia
      const diff = Math.abs(candAngle - me.facingAngle);
      score -= diff * 6;

      if (score > bestScore) {
        bestScore = score;
        bestAngle = candAngle;
      }
    }

    let steerX = Math.cos(bestAngle);
    let steerY = Math.sin(bestAngle);
    let wantDash = false;

    // Dash to escape imminent crush or execute opportunistic shove
    if (currentDanger > 60 && closestAnvilTime < 0.42 && me.dashCooldown <= 0) {
      wantDash = difficulty === 'bot_hard' || (difficulty === 'bot_normal' && Math.random() < 0.85) || Math.random() < 0.45;
    }

    // Easy blunder chance
    if (difficulty === 'bot_easy' && Math.random() < 0.16) {
      steerX += (Math.random() - 0.5) * 1.5;
      steerY += (Math.random() - 0.5) * 1.5;
      wantDash = false;
    }

    // Crucially pass wantDash as BOTH pressed AND action so dash triggers reliably even while steering
    this.input.setBotInput(botId, wantDash, steerX, -steerY, wantDash);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const survivors = Array.from(this.runners.values()).filter((r) => r.alive);
    const winnerId = survivors.length === 1 ? survivors[0].id : (this.eliminationOrder[this.eliminationOrder.length - 1] ?? null);

    const rankedIds = [...survivors.map((s) => s.id), ...[...this.eliminationOrder].reverse()];

    return {
      winnerId,
      rankings: rankedIds.map((pid, idx) => {
        const r = this.runners.get(pid);
        return {
          playerId: pid,
          score: Math.round((r?.score || 0) + (r?.tackleEliminations || 0) * 100 + (r?.coinsCollected || 0) * 25),
          place: idx + 1
        };
      }),
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} survived the Apocalyptic Anvil Storm with ${this.runners.get(winnerId)?.shovesGiven || 0} shoves!`
          : 'THE ANVIL RAIN REDUCED ALL RUNNERS TO DUST!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Blacksmith Forge Stone Arena Background
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, width, height);

    // Stone flagstone tiles
    const tileSize = 60;
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isOffset = Math.floor(y / tileSize) % 2 === 1;
        const tileX = isOffset ? x + tileSize / 2 : x;
        ctx.fillStyle = (Math.floor(tileX / tileSize) + Math.floor(y / tileSize)) % 2 === 0 ? '#27272A' : '#1F1F23';
        ctx.fillRect(tileX, y, tileSize - 2, tileSize - 2);
      }
    }

    // Industrial hazard perimeter border with hazard stripes
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // 2. Render Anvil Ground Shadows (Expanding Warning Crosshairs)
    for (const a of this.anvils) {
      if (a.landed) continue;
      const progress = 1 - Math.max(0, a.warningTime / a.initialWarning);
      const currentRadius = a.radius * (0.35 + progress * 0.65);
      const isCritical = progress > 0.72;

      ctx.save();
      // Danger fill pulse
      if (a.type === 'giant') {
        ctx.fillStyle = isCritical ? 'rgba(239, 68, 68, 0.55)' : 'rgba(220, 38, 38, 0.3)';
      } else if (a.type === 'golden') {
        ctx.fillStyle = isCritical ? 'rgba(251, 191, 36, 0.65)' : 'rgba(245, 158, 11, 0.35)';
      } else {
        ctx.fillStyle = isCritical ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.25)';
      }

      ctx.beginPath();
      ctx.arc(a.x, a.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // Outer warning ring
      ctx.strokeStyle = a.type === 'golden' ? '#FBBF24' : isCritical ? '#EF4444' : '#F59E0B';
      ctx.lineWidth = isCritical ? 3.5 : 2;
      ctx.stroke();

      // Targeting crosshair
      ctx.strokeStyle = a.type === 'golden' ? 'rgba(251, 191, 36, 0.85)' : isCritical ? 'rgba(239, 68, 68, 0.85)' : 'rgba(245, 158, 11, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x - currentRadius - 5, a.y);
      ctx.lineTo(a.x + currentRadius + 5, a.y);
      ctx.moveTo(a.x, a.y - currentRadius - 5);
      ctx.lineTo(a.x, a.y + currentRadius + 5);
      ctx.stroke();

      // Label on giant or golden anvils
      if (a.type === 'giant') {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ MEGA CRUSHER', a.x, a.y - currentRadius - 6);
      } else if (a.type === 'golden') {
        ctx.fillStyle = '#FBBF24';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✨ GOLDEN ANVIL', a.x, a.y - currentRadius - 6);
      }

      ctx.restore();
    }

    // 3. Render Shockwaves
    for (const sw of this.shockwaves) {
      ctx.save();
      const alpha = sw.life / sw.maxLife;
      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render Powerups (Helmets, Speed, Coins)
    for (const pu of this.powerups) {
      ctx.save();
      ctx.translate(pu.x, pu.y);
      const bob = Math.sin(performance.now() * 0.006 + pu.x) * 3;
      ctx.translate(0, bob);

      // Floor shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 14 - bob, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (pu.type === 'helmet') {
        // Gleaming Construction Hard Hat
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 8, 0, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-15, -1, 30, 3);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HARD HAT', 0, 16);
      } else if (pu.type === 'speed') {
        // Speed Sneakers
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, 0);
        ctx.fillText('SPEED', 0, 16);
      } else {
        // Golden Coin
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#78350F';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪙', 0, 0);
      }
      ctx.restore();
    }

    // 5. Render Flying Dislodged Helmets
    for (const h of this.flyingHelmets) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.angle);
      ctx.fillStyle = h.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 7, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 6. Render Runners
    for (const r of this.runners.values()) {
      ctx.save();
      const pColor = this.players[r.id]?.color || '#FFFFFF';

      if (!r.alive) {
        // Squashed cartoon pancake
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(r.x, r.y + 4, r.radius * 1.8, r.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = pColor;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.radius * 1.6, r.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('x x', r.x, r.y - 1);
        ctx.restore();
        continue;
      }

      // Invulnerability flicker
      if (r.invulnerableTimer > 0 && Math.floor(performance.now() / 70) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(r.x, r.y + r.radius - 2, r.radius * 0.9, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Invulnerability shield aura
      if (r.invulnerableTimer > 0) {
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Expressive Mascot Character
      const mood: CharacterMood =
        !r.alive
          ? 'shocked'
          : r.stunTimer > 0
          ? 'shocked'
          : r.shovesGiven > 0
          ? 'triumph'
          : 'focused';

      this.drawPlayerMascot(ctx, r.id, r.x, r.y, r.radius, mood, performance.now() * 0.001);

      // Hard Hat Helmet atop Mascot
      if (r.hasHelmet) {
        ctx.save();
        ctx.translate(r.x, r.y - r.radius * 0.75);

        // Construction Hard Hat dome
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.ellipse(0, 0, r.radius * 0.95, r.radius * 0.65, 0, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Helmet brim
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-r.radius * 1.05, -1, r.radius * 2.1, 3.5);

        // Safety crest badge
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, -r.radius * 0.35, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Speed Boots Glow
      if (r.speedBoostTimer > 0) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y + r.radius - 3, 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Dash Cooldown indicator bar below player
      if (r.dashCooldown > 0) {
        const ratio = 1 - r.dashCooldown / 0.75;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(r.x - 14, r.y + r.radius + 5, 28, 4);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(r.x - 14, r.y + r.radius + 5, 28 * Math.max(0, Math.min(1, ratio)), 4);
      }

      // Runner Name Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(r.x - 36, r.y - r.radius - 22, 72, 16, 8);
      else ctx.rect(r.x - 36, r.y - r.radius - 22, 72, 16);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.players[r.id].name.toUpperCase(), r.x, r.y - r.radius - 14);

      ctx.restore();
    }

    // 7. Render Falling & Landed Anvils (Heavy 3D Cast Iron)
    for (const a of this.anvils) {
      ctx.save();
      const drawY = a.landed ? a.y : a.y - a.altitude;

      // Drop shadow beneath anvil
      if (!a.landed) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, a.radius * 0.65, a.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Metallic Iron Gradient
      const isGiant = a.type === 'giant';
      const isGolden = a.type === 'golden';
      const scale = isGiant ? 1.6 : 1.0;

      const ironGrad = ctx.createLinearGradient(a.x - 20 * scale, drawY - 20 * scale, a.x + 20 * scale, drawY + 10 * scale);
      if (isGolden) {
        ironGrad.addColorStop(0, '#FEF08A');
        ironGrad.addColorStop(0.5, '#F59E0B');
        ironGrad.addColorStop(1, '#B45309');
      } else if (isGiant) {
        ironGrad.addColorStop(0, '#475569');
        ironGrad.addColorStop(0.5, '#1E293B');
        ironGrad.addColorStop(1, '#020617');
      } else {
        ironGrad.addColorStop(0, '#64748B');
        ironGrad.addColorStop(0.5, '#334155');
        ironGrad.addColorStop(1, '#0F172A');
      }
      ctx.fillStyle = ironGrad;

      // Anvil base
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(a.x - 16 * scale, drawY - 2 * scale, 32 * scale, 8 * scale, 2);
      else ctx.rect(a.x - 16 * scale, drawY - 2 * scale, 32 * scale, 8 * scale);
      ctx.fill();

      // Anvil waist
      ctx.fillRect(a.x - 8 * scale, drawY - 12 * scale, 16 * scale, 10 * scale);

      // Anvil top body (striking face)
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(a.x - 20 * scale, drawY - 20 * scale, 40 * scale, 9 * scale, 2);
      else ctx.rect(a.x - 20 * scale, drawY - 20 * scale, 40 * scale, 9 * scale);
      ctx.fill();

      // Anvil tapered conical horn
      ctx.beginPath();
      ctx.moveTo(a.x + 20 * scale, drawY - 20 * scale);
      ctx.lineTo(a.x + 32 * scale, drawY - 15 * scale);
      ctx.lineTo(a.x + 20 * scale, drawY - 11 * scale);
      ctx.closePath();
      ctx.fill();

      // Striking face silver metallic bevel
      ctx.fillStyle = isGolden ? '#FFFBEB' : '#CBD5E1';
      ctx.fillRect(a.x - 18 * scale, drawY - 19 * scale, 36 * scale, 2.5 * scale);

      ctx.restore();
    }

    // 8. Storm Intensity & Stats HUD Badge (Positioned safely below timer at y=56)
    ctx.save();
    const pillW = 320;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const aliveCount = Array.from(this.runners.values()).filter((r) => r.alive).length;
    ctx.fillText(`⚡ STORM: ${Math.round(this.stormIntensity * 100)}%  •  ALIVE: ${aliveCount}  •  DASH TO SHOVE! ⚡`, width / 2, pillY + pillH / 2);
    ctx.restore();

    ctx.restore();
  }
}
