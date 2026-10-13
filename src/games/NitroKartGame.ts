import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type KartThemeId = 'neon_colosseum' | 'magma_demolition' | 'junkyard_thunder';

interface KartTheme {
  id: KartThemeId;
  name: string;
  icon: string;
  floorColor: string;
  gridColor: string;
  boundaryColor: string;
  boundaryGlow: string;
  boxColor: string;
  accentColor: string;
}

const THEMES: Record<KartThemeId, KartTheme> = {
  neon_colosseum: {
    id: 'neon_colosseum',
    name: 'Neon Cyber Colosseum',
    icon: '⚡',
    floorColor: '#0E111C',
    gridColor: '#1E2538',
    boundaryColor: '#00E5FF',
    boundaryGlow: '#00E5FF',
    boxColor: '#FFD700',
    accentColor: '#00E5FF'
  },
  magma_demolition: {
    id: 'magma_demolition',
    name: 'Magma Core Demolition Pit',
    icon: '🔥',
    floorColor: '#1A0B0B',
    gridColor: '#361515',
    boundaryColor: '#EF4444',
    boundaryGlow: '#F97316',
    boxColor: '#F59E0B',
    accentColor: '#EF4444'
  },
  junkyard_thunder: {
    id: 'junkyard_thunder',
    name: 'Scrap Metal Thunderdome',
    icon: '🛠️',
    floorColor: '#121417',
    gridColor: '#242930',
    boundaryColor: '#F59E0B',
    boundaryGlow: '#FDE047',
    boxColor: '#38BDF8',
    accentColor: '#F59E0B'
  }
};

const THEME_ORDER: KartThemeId[] = ['neon_colosseum', 'magma_demolition', 'junkyard_thunder'];

type WeaponType = 'missile' | 'mine' | 'turbo';

interface KartMissile {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetId: PlayerId | null;
  life: number;
  color: string;
}

interface PlacedMine {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  radius: number;
  timer: number;
}

interface PowerupBox {
  id: number;
  x: number;
  y: number;
  active: boolean;
  respawnTimer: number;
}

interface FloatingDerbyText {
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  maxTimer: number;
}

interface NitroKart {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  score: number;
  hitsDealt: number;
  ramsDealt: number;
  weapon: WeaponType | null;
  nitroCharge: number;
  turboTimer: number;
  spinTimer: number;
  isUnderdog: boolean;
  spikedBumper: boolean;
  shieldActive: boolean;
  lastShovedBy: PlayerId | null;
  shoveTimer: number;
  stuckTimer: number;
  lastPos: { x: number; y: number };
  currentMood: CharacterMood;
  animTime: number;
}

export class NitroKartGame extends BaseGame {
  public currentTheme: KartThemeId = 'neon_colosseum';
  public playersState: Map<PlayerId, NitroKart> = new Map();

  private missiles: KartMissile[] = [];
  private mines: PlacedMine[] = [];
  private powerupBoxes: PowerupBox[] = [];
  private floatingTexts: FloatingDerbyText[] = [];

  private missileIdCounter: number = 0;
  private mineIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private screenShake: number = 0;
  private hitStopTimer: number = 0;
  private animTimer: number = 0;

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.cycleTheme();
        } else if (e.key === '1') {
          this.setTheme('neon_colosseum');
        } else if (e.key === '2') {
          this.setTheme('magma_demolition');
        } else if (e.key === '3') {
          this.setTheme('junkyard_thunder');
        }
      };
      window.addEventListener('keydown', this.keydownHandler);

      this.clickHandler = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Theme Pill at bottom-left
        const pillX = 20;
        const pillY = canvas.height - 44;
        const pillW = 170;
        const pillH = 32;

        if (
          clickX >= pillX &&
          clickX <= pillX + pillW &&
          clickY >= pillY &&
          clickY <= pillY + pillH
        ) {
          this.cycleTheme();
        }
      };
      window.addEventListener('click', this.clickHandler);
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_ORDER.indexOf(this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_ORDER.length;
    this.setTheme(THEME_ORDER[nextIdx]);
  }

  public setTheme(theme: KartThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentColor, 16);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.playersState.clear();
    this.missiles = [];
    this.mines = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;

    // Powerup crates placed symmetrically in arena
    const cx = width / 2;
    const cy = height * 0.54;
    this.powerupBoxes = [
      { id: 1, x: cx - 140, y: cy - 90, active: true, respawnTimer: 0 },
      { id: 2, x: cx + 140, y: cy - 90, active: true, respawnTimer: 0 },
      { id: 3, x: cx - 140, y: cy + 90, active: true, respawnTimer: 0 },
      { id: 4, x: cx + 140, y: cy + 90, active: true, respawnTimer: 0 },
      { id: 5, x: cx, y: cy, active: true, respawnTimer: 0 }
    ];

    const active = this.getActivePlayers();
    const count = active.length;
    const radius = Math.min(width, height) * 0.34;

    active.forEach((p, idx) => {
      const ang = (idx / count) * Math.PI * 2;
      const startX = cx + Math.cos(ang) * radius;
      const startY = cy + Math.sin(ang) * radius;

      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: ang + Math.PI,
        speed: 0,
        score: 0,
        hitsDealt: 0,
        ramsDealt: 0,
        weapon: 'missile',
        nitroCharge: 0,
        turboTimer: 0,
        spinTimer: 0,
        isUnderdog: false,
        spikedBumper: false,
        shieldActive: false,
        lastShovedBy: null,
        shoveTimer: 0,
        stuckTimer: 0,
        lastPos: { x: startX, y: startY },
        currentMood: 'focused',
        animTime: 0
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 14);
    }

    const isSuddenDeath = this.roundTimer <= 15.0;

    // 1. Powerup box respawns
    const respawnRate = isSuddenDeath ? 2.0 : 3.5;
    for (const box of this.powerupBoxes) {
      if (!box.active) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          this.particles.spawnSparks(box.x, box.y, THEMES[this.currentTheme].boxColor, 10);
        }
      }
    }

    // 2. Update Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.timer -= dt;
      ft.y -= 25 * dt;
      if (ft.timer <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 3. Update Underdog Status
    this.updateUnderdogStatus();

    // 4. Update Bots
    this.updateBots(dt, width, height);

    // 5. Update Player Karts
    const active = this.getActivePlayers();
    for (const p of active) {
      const kart = this.playersState.get(p.id);
      if (!kart) continue;

      kart.animTime += dt;
      if (kart.turboTimer > 0) kart.turboTimer -= dt;
      if (kart.shoveTimer > 0) {
        kart.shoveTimer -= dt;
        if (kart.shoveTimer <= 0) kart.lastShovedBy = null;
      }

      // Handle spinout
      if (kart.spinTimer > 0) {
        kart.spinTimer -= dt;
        kart.angle += 14 * dt;
        kart.speed *= 0.93;
        kart.x += Math.cos(kart.angle) * kart.speed * dt;
        kart.y += Math.sin(kart.angle) * kart.speed * dt;
        kart.currentMood = 'shocked';
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Steering
      const turnSpeed = kart.turboTimer > 0 ? 2.8 : 3.6;
      kart.angle += steer * turnSpeed * dt;

      // Hold-to-Charge Turbo Boost
      if (isAction) {
        kart.nitroCharge = Math.min(1.0, kart.nitroCharge + dt * 2.2);
        this.particles.spawnSparks(kart.x, kart.y, p.color, 1);
      }

      // Releasing fires turbo ram or weapon!
      if (justReleased) {
        if (kart.weapon !== null) {
          this.fireWeapon(kart);
        } else if (kart.nitroCharge > 0.25) {
          kart.turboTimer = 0.7 + kart.nitroCharge * 0.6;
          this.screenShake = 4.5;
          this.audio.playWhoosh();
          this.particles.spawnSparks(kart.x, kart.y, '#FFFFFF', 14);
          this.addFloatingText(kart.x, kart.y - 25, 'TURBO RAM! ⚡', p.color);
        }
        kart.nitroCharge = 0;
      }

      // Drive acceleration & speed
      let maxSpeed = 200;
      if (kart.turboTimer > 0) maxSpeed = 340;
      if (kart.isUnderdog) maxSpeed += 30;
      if (isSuddenDeath) maxSpeed += 25;

      const accel = kart.turboTimer > 0 ? 540 : (throttle > 0.1 || isAction ? 300 : -100);
      kart.speed = Math.max(-80, Math.min(maxSpeed, kart.speed + accel * dt));

      // Velocity integration with drift slip
      const forwardX = Math.cos(kart.angle) * kart.speed;
      const forwardY = Math.sin(kart.angle) * kart.speed;
      kart.vx = kart.vx * 0.82 + forwardX * 0.18;
      kart.vy = kart.vy * 0.82 + forwardY * 0.18;

      kart.x += kart.vx * dt;
      kart.y += kart.vy * dt;

      // Arena Wall Shock Boundary Collisions
      const minX = 36;
      const maxX = width - 36;
      const minY = 96;
      const maxY = height - 36;

      if (kart.x < minX || kart.x > maxX || kart.y < minY || kart.y > maxY) {
        kart.x = Math.max(minX, Math.min(maxX, kart.x));
        kart.y = Math.max(minY, Math.min(maxY, kart.y));
        kart.speed *= -0.55;
        this.screenShake = 3.0;
        this.audio.playBounce();
        this.particles.spawnSparks(kart.x, kart.y, THEMES[this.currentTheme].boundaryColor, 12);
      }

      // Stuck detection for AI
      const distMoved = Math.hypot(kart.x - kart.lastPos.x, kart.y - kart.lastPos.y);
      if (distMoved < 4 && Math.abs(kart.speed) < 25) {
        kart.stuckTimer += dt;
      } else {
        kart.stuckTimer = 0;
      }
      kart.lastPos.x = kart.x;
      kart.lastPos.y = kart.y;

      // Mood updates
      if (kart.turboTimer > 0) kart.currentMood = 'triumph';
      else if (kart.isUnderdog) kart.currentMood = 'focused';
      else kart.currentMood = 'idle';

      // Powerup crate collision
      for (const box of this.powerupBoxes) {
        if (box.active && Math.hypot(kart.x - box.x, kart.y - box.y) < 26) {
          box.active = false;
          box.respawnTimer = respawnRate;

          // Award weapon
          const roll = Math.random();
          if (roll < 0.5) kart.weapon = 'missile';
          else if (roll < 0.8) kart.weapon = 'mine';
          else kart.weapon = 'turbo';

          this.audio.playScore();
          this.particles.spawnSparks(box.x, box.y, THEMES[this.currentTheme].boxColor, 16);
          const weaponNames = { missile: '🚀 HOMING MISSILE!', mine: '💣 PROXIMITY MINE!', turbo: '⚡ NITRO OVERDRIVE!' };
          this.addFloatingText(kart.x, kart.y - 25, weaponNames[kart.weapon], THEMES[this.currentTheme].boxColor);
        }
      }

      // Proximity Mine collision
      for (let i = this.mines.length - 1; i >= 0; i--) {
        const mine = this.mines[i];
        if (mine.ownerId !== kart.id || mine.timer < 0.5) {
          if (Math.hypot(kart.x - mine.x, kart.y - mine.y) < mine.radius + 14) {
            // Detonate mine!
            this.mines.splice(i, 1);
            this.handleKartExplosion(kart, mine.ownerId, 'MINE BLAST! 💣');
            break;
          }
        }
      }
    }

    // 6. Inter-Player Physical Derby T-Bone Shunts (m1*v1 + m2*v2)
    for (let i = 0; i < active.length; i++) {
      const k1 = this.playersState.get(active[i].id);
      if (!k1) continue;

      for (let j = i + 1; j < active.length; j++) {
        const k2 = this.playersState.get(active[j].id);
        if (!k2) continue;

        const dx = k2.x - k1.x;
        const dy = k2.y - k1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 28;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          k1.x -= nx * overlap * 0.5;
          k1.y -= ny * overlap * 0.5;
          k2.x += nx * overlap * 0.5;
          k2.y += ny * overlap * 0.5;

          // Check for Turbo Derby T-Bone Shunts!
          const k1Ramming = k1.turboTimer > 0 || k1.spikedBumper;
          const k2Ramming = k2.turboTimer > 0 || k2.spikedBumper;

          if (k1Ramming || k2Ramming) {
            this.screenShake = 7.5;
            this.hitStopTimer = 0.045;
            this.audio.playExplosion();

            if (k1Ramming && !k2Ramming) {
              k2.spinTimer = 0.65;
              k2.vx = nx * 320;
              k2.vy = ny * 320;
              k2.lastShovedBy = k1.id;
              k2.shoveTimer = 1.8;
              k1.score += 45 * (isSuddenDeath ? 2 : 1);
              k1.ramsDealt++;
              this.particles.spawnSparks(k2.x, k2.y, '#EF4444', 20);
              this.addFloatingText(k1.x, k1.y - 30, 'DERBY SMASH! +45 💥', '#10B981');
            } else if (k2Ramming && !k1Ramming) {
              k1.spinTimer = 0.65;
              k1.vx = -nx * 320;
              k1.vy = -ny * 320;
              k1.lastShovedBy = k2.id;
              k1.shoveTimer = 1.8;
              k2.score += 45 * (isSuddenDeath ? 2 : 1);
              k2.ramsDealt++;
              this.particles.spawnSparks(k1.x, k1.y, '#EF4444', 20);
              this.addFloatingText(k2.x, k2.y - 30, 'DERBY SMASH! +45 💥', '#10B981');
            } else {
              // Mutual clash
              k1.vx = -nx * 200;
              k1.vy = -ny * 200;
              k2.vx = nx * 200;
              k2.vy = ny * 200;
              this.particles.spawnSparks((k1.x + k2.x) / 2, (k1.y + k2.y) / 2, '#F59E0B', 16);
            }
          } else {
            // Elastic bump
            const kx = k1.vx - k2.vx;
            const ky = k1.vy - k2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            k1.vx -= p * nx * 0.8;
            k1.vy -= p * ny * 0.8;
            k2.vx += p * nx * 0.8;
            k2.vy += p * ny * 0.8;
            this.audio.playBounce();
          }
        }
      }
    }

    // 7. Update Missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.life -= dt;

      // Homing logic towards target
      if (m.targetId !== null) {
        const target = this.playersState.get(m.targetId);
        if (target) {
          const ang = Math.atan2(target.y - m.y, target.x - m.x);
          m.vx = m.vx * 0.90 + Math.cos(ang) * 360 * 0.10;
          m.vy = m.vy * 0.90 + Math.sin(ang) * 360 * 0.10;
        }
      }

      m.x += m.vx * dt;
      m.y += m.vy * dt;

      this.particles.emit(m.x, m.y, 1, m.color);

      // Check collision with players
      let hit = false;
      for (const p of active) {
        if (p.id === m.ownerId) continue;
        const kart = this.playersState.get(p.id);
        if (!kart) continue;

        if (Math.hypot(m.x - kart.x, m.y - kart.y) < 24) {
          hit = true;
          this.handleKartExplosion(kart, m.ownerId, 'DIRECT MISSILE HIT! 🚀');
          break;
        }
      }

      if (hit || m.life <= 0) {
        this.missiles.splice(i, 1);
      }
    }

    // Update mine timers
    for (const mine of this.mines) {
      mine.timer += dt;
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private fireWeapon(kart: NitroKart): void {
    if (!kart.weapon) return;

    if (kart.weapon === 'missile') {
      // Find closest opponent
      let targetId: PlayerId | null = null;
      let minDist = 9999;
      for (const p of this.getActivePlayers()) {
        if (p.id === kart.id) continue;
        const target = this.playersState.get(p.id);
        if (!target) continue;
        const d = Math.hypot(target.x - kart.x, target.y - kart.y);
        if (d < minDist) {
          minDist = d;
          targetId = p.id;
        }
      }

      this.missiles.push({
        id: ++this.missileIdCounter,
        ownerId: kart.id,
        x: kart.x + Math.cos(kart.angle) * 22,
        y: kart.y + Math.sin(kart.angle) * 22,
        vx: Math.cos(kart.angle) * 300,
        vy: Math.sin(kart.angle) * 300,
        targetId,
        life: 3.5,
        color: this.players[kart.id]?.color || '#EF4444'
      });
      this.audio.playWhoosh();
    } else if (kart.weapon === 'mine') {
      this.mines.push({
        id: ++this.mineIdCounter,
        ownerId: kart.id,
        x: kart.x - Math.cos(kart.angle) * 24,
        y: kart.y - Math.sin(kart.angle) * 24,
        radius: 18,
        timer: 0
      });
      this.audio.playTap();
      this.particles.spawnSparks(kart.x, kart.y, '#F59E0B', 8);
    } else if (kart.weapon === 'turbo') {
      kart.turboTimer = 2.2;
      this.audio.playWhoosh();
      this.screenShake = 5.0;
      this.particles.spawnSparks(kart.x, kart.y, '#38BDF8', 18);
      this.addFloatingText(kart.x, kart.y - 25, 'SUPER NITRO! ⚡', '#38BDF8');
    }

    kart.weapon = null;
  }

  private handleKartExplosion(victim: NitroKart, attackerId: PlayerId, label: string): void {
    if (victim.shieldActive) {
      victim.shieldActive = false;
      this.audio.playBounce();
      this.screenShake = 4.0;
      this.particles.spawnSparks(victim.x, victim.y, '#FFD700', 16);
      this.addFloatingText(victim.x, victim.y - 25, '🛡️ SHIELD ABSORBED!', '#FFD700');
      return;
    }

    victim.spinTimer = 1.1;
    victim.score = Math.max(0, victim.score - 20);
    this.screenShake = 8.0;
    this.hitStopTimer = 0.045;
    this.audio.playExplosion();
    this.particles.emit(victim.x, victim.y, 22, '#EF4444');
    this.addFloatingText(victim.x, victim.y - 25, 'SPUN OUT! -20', '#EF4444');

    const attacker = this.playersState.get(attackerId);
    if (attacker && attacker.id !== victim.id) {
      const isSuddenDeath = this.roundTimer <= 15.0;
      attacker.score += 55 * (isSuddenDeath ? 2 : 1);
      attacker.hitsDealt++;
      this.addFloatingText(attacker.x, attacker.y - 30, `${label} +55`, '#10B981');
    }
  }

  private updateUnderdogStatus(): void {
    const active = this.getActivePlayers();
    if (active.length < 2) return;

    let maxScore = -1;
    let minScore = Infinity;
    for (const p of active) {
      const kart = this.playersState.get(p.id);
      if (!kart) continue;
      if (kart.score > maxScore) maxScore = kart.score;
      if (kart.score < minScore) minScore = kart.score;
    }

    for (const p of active) {
      const kart = this.playersState.get(p.id);
      if (!kart) continue;
      if (maxScore - kart.score >= 50) {
        if (!kart.isUnderdog) {
          kart.isUnderdog = true;
          kart.spikedBumper = true;
          kart.shieldActive = true;
        }
      } else {
        kart.isUnderdog = false;
      }
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      timer: 1.1,
      maxTimer: 1.1
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const kart = this.playersState.get(botId);
    if (!kart || kart.spinTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction Delays:
    // Easy: 380-450ms, blunders, wide turns
    // Normal: 220-250ms, collects crates, fires missiles
    // Hard: 90-130ms, hunts human players for turbo T-bone rams, drops mines
    let delay = 0.24;
    let blunderChance = 0.0;
    if (difficulty === 'bot_easy') {
      delay = 0.40 + Math.random() * 0.08;
      blunderChance = 0.18;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11 + Math.random() * 0.04;
      blunderChance = 0.0;
    } else {
      delay = 0.23 + Math.random() * 0.05;
      blunderChance = 0.06;
    }
    this.botReactionTimers.set(botId, delay);

    // Auto-reverse if stuck
    if (kart.stuckTimer > 0.3) {
      this.input.setBotInput(botId, false, -1, -1.0, false);
      return;
    }

    // Target Selection: Powerup crate or Closest rival
    let targetX = _width / 2;
    let targetY = _height / 2;

    const availableBox = this.powerupBoxes.find(b => b.active);
    if (availableBox && kart.weapon === null) {
      targetX = availableBox.x;
      targetY = availableBox.y;
    } else {
      // Hunt nearest rival for missile shot or ram
      let nearestDist = 9999;
      for (const p of this.getActivePlayers()) {
        if (p.id !== botId) {
          const rival = this.playersState.get(p.id);
          if (rival) {
            const d = Math.hypot(rival.x - kart.x, rival.y - kart.y);
            if (d < nearestDist) {
              nearestDist = d;
              targetX = rival.x;
              targetY = rival.y;
            }
          }
        }
      }
    }

    if (Math.random() < blunderChance) {
      targetX += (Math.random() - 0.5) * 60;
      targetY += (Math.random() - 0.5) * 60;
    }

    const ang = Math.atan2(targetY - kart.y, targetX - kart.x);
    let angleDiff = ang - kart.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let steer = 0;
    if (Math.abs(angleDiff) > 0.18) steer = angleDiff > 0 ? 1 : -1;

    let fire = false;
    if (kart.weapon !== null && Math.abs(angleDiff) < 0.35) {
      fire = true;
    } else if (kart.weapon === null && Math.abs(angleDiff) < 0.25 && difficulty === 'bot_hard') {
      fire = true; // charges turbo ram!
    }

    this.input.setBotInput(botId, fire, steer, 1.0, fire);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const kart = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: kart?.score || 0,
        hits: kart?.hitsDealt || 0,
        rams: kart?.ramsDealt || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topHits = scores[0]?.hits || 0;
    const topRams = scores[0]?.rams || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} dominated the Derby Arena with ${topHits} missile hits and ${topRams} T-bone smashes!`
      : 'Derby demolished with no sole victor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // Screen Shake Offset
    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Arena Floor
    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(0, 0, width, height);

    // Arena Grid
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1.5;
    for (let x = 0; x < width; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 80; y < height; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Outer Shock Boundaries
    const minX = 28;
    const maxX = width - 28;
    const minY = 88;
    const maxY = height - 28;

    ctx.strokeStyle = theme.boundaryColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = theme.boundaryGlow;
    ctx.shadowBlur = 12;
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    ctx.shadowBlur = 0;

    // 2. Powerup Crates
    for (const box of this.powerupBoxes) {
      if (!box.active) continue;
      this.renderPowerupBox(ctx, box, theme);
    }

    // 3. Placed Proximity Mines
    for (const mine of this.mines) {
      ctx.save();
      const pulse = (Math.sin(this.animTimer * 12) + 1) * 0.5;
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(mine.x, mine.y, mine.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mine.x, mine.y, mine.radius + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Missiles
    for (const m of this.missiles) {
      ctx.save();
      ctx.translate(m.x, m.y);
      const ang = Math.atan2(m.vy, m.vx);
      ctx.rotate(ang);

      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.roundRect(-8, -4, 16, 8, 3);
      ctx.fill();

      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(13, 0);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 5. Player Karts with Mascots
    for (const p of this.getActivePlayers()) {
      const kart = this.playersState.get(p.id);
      if (!kart) continue;
      this.renderKart(ctx, kart, p, theme);
    }

    // 6. Floating texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      const alpha = Math.min(1.0, ft.timer / (ft.maxTimer * 0.4));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 12px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore(); // Restore screenshake

    // 7. Safe UI & Theme Pill (Strictly preserving y: 12-44 for Global Timer)
    this.renderSafeUI(ctx, width, height);
  }

  private renderPowerupBox(ctx: CanvasRenderingContext2D, box: PowerupBox, theme: KartTheme): void {
    ctx.save();
    ctx.translate(box.x, box.y);
    const spin = this.animTimer * 2;
    ctx.rotate(spin);

    // Glowing crate
    ctx.fillStyle = theme.boxColor;
    ctx.shadowColor = theme.boxColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(-12, -12, 24, 24, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-12, -12, 24, 24);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 13px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 0);
    ctx.restore();
  }

  private renderKart(ctx: CanvasRenderingContext2D, kart: NitroKart, p: PlayerConfig, theme: KartTheme): void {
    ctx.save();
    ctx.translate(kart.x, kart.y);
    ctx.rotate(kart.angle);

    if (kart.spinTimer > 0 && Math.floor(kart.spinTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Underdog Spiked Battle-Bumper
    if (kart.spikedBumper) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(14, -12);
      ctx.lineTo(22, 0);
      ctx.lineTo(14, 12);
      ctx.stroke();
      ctx.restore();
    }

    // Shield Aura
    if (kart.shieldActive) {
      ctx.save();
      const pulse = (Math.sin(this.animTimer * 8) + 1) * 0.5;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Turbo Flame Exhaust
    if (kart.turboTimer > 0) {
      ctx.save();
      const flameLen = 14 + Math.random() * 12;
      ctx.fillStyle = theme.accentColor;
      ctx.beginPath();
      ctx.moveTo(-16, -6);
      ctx.lineTo(-16 - flameLen, 0);
      ctx.lineTo(-16, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Kart Chassis
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(-16, -12, 32, 24, 5);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Livery Nose
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(-4, -9, 18, 18, 4);
    ctx.fill();

    // Mascot Driver in Open Cockpit
    ctx.save();
    ctx.translate(-2, 0);
    drawCharacter(
      ctx,
      0,
      0,
      8,
      p.id,
      p.type !== 'human',
      kart.currentMood,
      kart.animTime,
      undefined
    );
    ctx.restore();

    // Kart Wheels (4 corners)
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-14, -15, 8, 4);
    ctx.fillRect(6, -15, 8, 4);
    ctx.fillRect(-14, 11, 8, 4);
    ctx.fillRect(6, 11, 8, 4);

    ctx.restore(); // Restore kart transform

    // HUD Badge above kart
    ctx.save();
    ctx.translate(kart.x, kart.y);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-24, -36, 48, 14, 3);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${kart.score} pts`, 0, -29);
    ctx.restore();
  }

  private renderSafeUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Minigame Header Badge at y: 56 (Strictly leaving y: 12-44 clear for Global Timer!)
    const isSuddenDeath = this.roundTimer <= 15.0;
    const badgeW = 280;
    const badgeH = 28;
    const badgeX = (width - badgeW) * 0.5;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#00E5FF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? '🔥 DERBY OVERLOAD! 2X POINTS & FAST CRATES'
      : 'STEER & DRIVE • GRAB WEAPONS • T-BONE RAM RIVALS';
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Status Cards (Offset to y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const kart = this.playersState.get(p.id);
      let cardX = 20;
      let cardY = height - 128;

      if (idx === 0) {
        cardX = 20;
        cardY = height - 128;
      } else if (idx === 1) {
        cardX = width - 150;
        cardY = height - 128;
      } else if (idx === 2) {
        cardX = 20;
        cardY = 92;
      } else {
        cardX = width - 150;
        cardY = 92;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 52, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mini Mascot Icon
      ctx.save();
      ctx.translate(cardX + 22, cardY + 26);
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        p.type !== 'human',
        kart?.currentMood || 'idle',
        0,
        undefined
      );
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`P${p.id + 1} (${p.type === 'human' ? 'YOU' : 'BOT'})`, cardX + 42, cardY + 7);

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px "Chakra Petch", monospace';
      ctx.fillText(`${kart?.score || 0} pts`, cardX + 42, cardY + 23);

      const weaponIcon = kart?.weapon === 'missile' ? '🚀 MISSILE' : (kart?.weapon === 'mine' ? '💣 MINE' : (kart?.weapon === 'turbo' ? '⚡ TURBO' : '🥊 RAM'));
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "Chakra Petch", monospace';
      ctx.fillText(weaponIcon, cardX + 42, cardY + 38);
    });

    // 3. Interactive Theme Pill at bottom-left (x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;
    const theme = THEMES[this.currentTheme];

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px "Chakra Petch", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name.slice(0, 13)}`, pillX + 12, pillY + pillH * 0.5);

    ctx.fillStyle = theme.accentColor;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + pillH * 0.5);

    // 4. Control Hints (bottom-right)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px "Chakra Petch", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('STEER: WASD / STICK • TAP: WEAPON / TURBO RAM', width - 20, height - 14);

    ctx.restore();
  }

  public syncDebug(): void {
    // Debug inspection helper
  }

  public destroy(): void {
    super.destroy();
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      if (this.clickHandler) {
        window.removeEventListener('click', this.clickHandler);
      }
    }
  }
}
