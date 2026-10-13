import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface RaftPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  chargeTime: number;
  isCharging: boolean;
  shuntActiveTimer: number;
  shuntDirX: number;
  shuntDirY: number;
  shuntCooldown: number;
  stunTimer: number;
  invulnerableTimer: number;
  health: number;
  maxHealth: number;
  hasChum: boolean;
  chumTimer: number;
  score: number;
  rescuesMade: number;
  isAlive: boolean;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface PredatorShark {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  targetId: PlayerId | null;
  biteAnim: number;
}

interface RescuePickup {
  id: number;
  x: number;
  y: number;
  type: 'buoy' | 'crate' | 'relic' | 'chum';
  color: string;
  points: number;
  radius: number;
}

interface LagoonTheme {
  id: string;
  name: string;
  icon: string;
  waterDeep: string;
  waterShallow: string;
  shoreColor: string;
  shoreTrim: string;
  sharkColor: string;
  accentColor: string;
}

const THEMES: LagoonTheme[] = [
  {
    id: 'emerald_atoll',
    name: 'Emerald Atoll 🏝️',
    icon: '🏝️',
    waterDeep: '#004D40',
    waterShallow: '#00897B',
    shoreColor: '#FFE082',
    shoreTrim: '#FFB74D',
    sharkColor: '#455A64',
    accentColor: '#38BDF8'
  },
  {
    id: 'cyber_aqueduct',
    name: 'Cyber Aqueduct ⚡',
    icon: '⚡',
    waterDeep: '#0A081D',
    waterShallow: '#151336',
    shoreColor: '#171B30',
    shoreTrim: '#00E5FF',
    sharkColor: '#00E5FF',
    accentColor: '#00E5FF'
  },
  {
    id: 'stormy_abyss',
    name: 'Stormy Abyss ⛈️',
    icon: '⛈️',
    waterDeep: '#030C14',
    waterShallow: '#0A1C2C',
    shoreColor: '#263238',
    shoreTrim: '#546E7A',
    sharkColor: '#212121',
    accentColor: '#FFD54F'
  }
];

export class SharkBaitGame extends BaseGame {
  public currentMapName: string = 'Emerald Atoll 🏝️';
  private currentThemeIdx: number = 0;

  private rafts: Map<PlayerId, RaftPlayer> = new Map();
  private sharks: PredatorShark[] = [];
  private pickups: RescuePickup[] = [];
  private nextPickupId: number = 1;
  private spawnPickupTimer: number = 0.5;

  private botReactionTimers: Map<PlayerId, number> = new Map();

  private screenShake: number = 0;
  private hitStopTimer: number = 0;

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

    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.code === 'KeyT') {
          this.cycleTheme();
        } else if (e.code === 'Digit1') {
          this.setTheme(0);
        } else if (e.code === 'Digit2') {
          this.setTheme(1);
        } else if (e.code === 'Digit3') {
          this.setTheme(2);
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

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.clickHandler) window.removeEventListener('click', this.clickHandler);
    }
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.rafts.clear();
    this.sharks = [];
    this.pickups = [];
    this.botReactionTimers.clear();

    // Spawn 2 patrolling sharks in center
    this.sharks.push({
      id: 1,
      x: width * 0.45,
      y: height * 0.50,
      vx: 0,
      vy: 0,
      angle: 0,
      speed: 135,
      targetId: null,
      biteAnim: 0
    });
    this.sharks.push({
      id: 2,
      x: width * 0.55,
      y: height * 0.50,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      speed: 145,
      targetId: null,
      biteAnim: 0
    });

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: width * 0.20, y: height * 0.26, angle: Math.PI / 4 },
      { x: width * 0.80, y: height * 0.26, angle: (3 * Math.PI) / 4 },
      { x: width * 0.20, y: height * 0.74, angle: -Math.PI / 4 },
      { x: width * 0.80, y: height * 0.74, angle: (-3 * Math.PI) / 4 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx % spawnOffsets.length];
      this.rafts.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        targetAngle: pos.angle,
        chargeTime: 0,
        isCharging: false,
        shuntActiveTimer: 0,
        shuntDirX: 0,
        shuntDirY: 0,
        shuntCooldown: 0,
        stunTimer: 0,
        invulnerableTimer: 1.0,
        health: 4,
        maxHealth: 4,
        hasChum: false,
        chumTimer: 0,
        score: 0,
        rescuesMade: 0,
        isAlive: true,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: Math.random() * 5
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
    });

    // Spawn 5 initial pickups
    for (let i = 0; i < 5; i++) {
      this.spawnRescuePickup(width, height);
    }

    this.currentThemeIdx = 0;
    this.currentMapName = THEMES[0].name;
  }

  private spawnRescuePickup(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer < 15;
    const roll = Math.random();
    let type: 'buoy' | 'crate' | 'relic' | 'chum' = 'buoy';
    let color = '#FF5252';
    let points = 15;
    let radius = 13;

    if (isSuddenDeath || roll < 0.20) {
      type = 'relic';
      color = '#FFD700';
      points = 45;
      radius = 16;
    } else if (roll < 0.35) {
      type = 'chum';
      color = '#8D6E63';
      points = 20;
      radius = 14;
    } else if (roll < 0.65) {
      type = 'crate';
      color = '#FF9800';
      points = 25;
      radius = 14;
    }

    this.pickups.push({
      id: this.nextPickupId++,
      x: 70 + Math.random() * (width - 140),
      y: 90 + Math.random() * (height - 180),
      type,
      color,
      points,
      radius
    });
  }

  public cycleTheme(): void {
    this.currentThemeIdx = (this.currentThemeIdx + 1) % THEMES.length;
    this.currentMapName = THEMES[this.currentThemeIdx].name;
    this.audio.playTap();
  }

  public setTheme(index: number): void {
    if (index >= 0 && index < THEMES.length) {
      this.currentThemeIdx = index;
      this.currentMapName = THEMES[this.currentThemeIdx].name;
      this.audio.playTap();
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Identify leader score for Underdog surge
    let maxScore = 0;
    for (const r of this.rafts.values()) {
      if (r.score > maxScore) maxScore = r.score;
    }

    // Update bots
    this.updateBots(dt, width, height);

    // Spawning rescue pickups
    this.spawnPickupTimer -= dt;
    const maxPickups = this.roundTimer < 15 ? 7 : 5;
    if (this.spawnPickupTimer <= 0 && this.pickups.length < maxPickups) {
      this.spawnPickupTimer = this.roundTimer < 15 ? 1.0 : 1.8;
      this.spawnRescuePickup(width, height);
    }

    // Update Rafts
    for (const p of this.getActivePlayers()) {
      const r = this.rafts.get(p.id);
      if (!r || !r.isAlive) continue;

      r.animTimer += dt;
      if (r.moodTimer > 0) {
        r.moodTimer -= dt;
        if (r.moodTimer <= 0) r.mood = 'idle';
      }

      // Check Underdog
      r.isUnderdog = maxScore >= 35 && r.score <= maxScore - 30;

      // Handle Stun & Invulnerable
      if (r.invulnerableTimer > 0) r.invulnerableTimer -= dt;
      if (r.stunTimer > 0) {
        r.stunTimer -= dt;
        r.vx *= 0.88;
        r.vy *= 0.88;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        continue;
      }

      // Handle Chum Bait Timer
      if (r.hasChum) {
        r.chumTimer -= dt;
        if (r.chumTimer <= 0) r.hasChum = false;
        if (Math.random() < 0.3) {
          this.particles.emit(r.x, r.y, 1, '#8D6E63');
        }
      }

      // Handle Shunt Cooldown & Active Timer
      if (r.shuntCooldown > 0) r.shuntCooldown -= dt;
      if (r.shuntActiveTimer > 0) {
        r.shuntActiveTimer -= dt;
        r.vx = r.shuntDirX * 600;
        r.vy = r.shuntDirY * 600;
        this.particles.emit(r.x, r.y, 2, '#38BDF8');
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const hasMoveInput = Math.abs(steer) > 0.1 || Math.abs(throttle) > 0.1;
      if (hasMoveInput) {
        r.targetAngle = Math.atan2(-throttle, steer);
      }

      // Smooth hydrodynamic turning
      let diff = r.targetAngle - r.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      r.angle += diff * Math.min(1.0, dt * 8);

      const baseSpeed = r.isUnderdog ? 290 : 230;

      // Hold-to-Charge Outboard Turbo Boost & Bumper Ram
      if (isAction && r.shuntActiveTimer <= 0) {
        r.isCharging = true;
        r.chargeTime = Math.min(1.0, r.chargeTime + dt * 2.2);

        if (hasMoveInput) {
          r.vx += Math.cos(r.angle) * baseSpeed * 0.45 * dt;
          r.vy += Math.sin(r.angle) * baseSpeed * 0.45 * dt;
        }
      } else {
        if (r.isCharging) {
          // Release Turbo Boost / Bumper Ram!
          r.isCharging = false;
          if (r.chargeTime > 0.25) {
            r.shuntActiveTimer = 0.24;
            r.shuntDirX = Math.cos(r.angle);
            r.shuntDirY = Math.sin(r.angle);
            r.shuntCooldown = 0.8;
            this.audio.playWhoosh();
            this.particles.emit(r.x, r.y, 10, '#38BDF8');
          }
          r.chargeTime = 0;
        } else if (r.shuntActiveTimer <= 0 && hasMoveInput) {
          r.vx += Math.cos(r.angle) * baseSpeed * dt;
          r.vy += Math.sin(r.angle) * baseSpeed * dt;

          // Outboard motor wake bubbles
          if (Math.random() < 0.25) {
            const propX = r.x - Math.cos(r.angle) * 18;
            const propY = r.y - Math.sin(r.angle) * 18;
            this.particles.emit(propX, propY, 1, '#E0F2FE');
          }
        }
      }

      // Water Drag
      r.vx *= Math.pow(0.88, dt * 10);
      r.vy *= Math.pow(0.88, dt * 10);

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Arena boundaries
      const margin = 35;
      if (r.x < margin) { r.x = margin; r.vx = Math.abs(r.vx) * 0.6; }
      if (r.x > width - margin) { r.x = width - margin; r.vx = -Math.abs(r.vx) * 0.6; }
      if (r.y < 65) { r.y = 65; r.vy = Math.abs(r.vy) * 0.6; }
      if (r.y > height - 60) { r.y = height - 60; r.vy = -Math.abs(r.vy) * 0.6; }

      // Check Rescue Pickup Collection
      const collectRadius = r.isUnderdog ? 38 : 28;
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        if (Math.hypot(r.x - pk.x, r.y - pk.y) < collectRadius) {
          this.collectPickup(r, pk);
          this.pickups.splice(i, 1);
        }
      }
    }

    // Update Sharks (AI pursuit logic)
    for (const shark of this.sharks) {
      if (shark.biteAnim > 0) shark.biteAnim -= dt * 6;

      // Determine target: Priority to rafts carrying Chum Bait, otherwise closest non-underdog raft
      let targetRaft: RaftPlayer | null = null;
      let minDist = 320;

      for (const r of this.rafts.values()) {
        if (!r.isAlive || r.invulnerableTimer > 0) continue;
        if (r.isUnderdog) continue; // Megalodon Whistle: sharks ignore underdog

        if (r.hasChum) {
          targetRaft = r;
          break;
        }

        const d = Math.hypot(r.x - shark.x, r.y - shark.y);
        if (d < minDist) {
          minDist = d;
          targetRaft = r;
        }
      }

      if (targetRaft) {
        const dx = targetRaft.x - shark.x;
        const dy = targetRaft.y - shark.y;
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - shark.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        shark.angle += diff * Math.min(1.0, dt * 5);
      } else {
        // Natural wandering in lagoon
        shark.angle += dt * 0.8;
      }

      shark.vx = Math.cos(shark.angle) * shark.speed;
      shark.vy = Math.sin(shark.angle) * shark.speed;
      shark.x += shark.vx * dt;
      shark.y += shark.vy * dt;

      // Shark boundary bounce
      if (shark.x < 40) { shark.x = 40; shark.angle = 0; }
      if (shark.x > width - 40) { shark.x = width - 40; shark.angle = Math.PI; }
      if (shark.y < 70) { shark.y = 70; shark.angle = Math.PI / 2; }
      if (shark.y > height - 60) { shark.y = height - 60; shark.angle = -Math.PI / 2; }

      // Check Shark attack on rafts
      for (const r of this.rafts.values()) {
        if (!r.isAlive || r.invulnerableTimer > 0) continue;

        if (Math.hypot(shark.x - r.x, shark.y - r.y) < 28) {
          // SHARK CHOMP!
          shark.biteAnim = 1.0;
          r.health--;
          r.invulnerableTimer = 1.6;
          r.score = Math.max(0, r.score - 15);
          r.hasChum = false;
          r.mood = 'shocked';
          r.moodTimer = 1.2;

          this.audio.playExplosion();
          this.screenShake = 10;
          this.hitStopTimer = 0.045;
          this.particles.emit(r.x, r.y, 18, '#FF1744');

          // Knockback
          r.vx = Math.cos(shark.angle) * 320;
          r.vy = Math.sin(shark.angle) * 320;

          if (r.health <= 0) {
            // Raft breached! Instant respawn
            r.health = r.maxHealth;
            r.x = 80 + Math.random() * 640;
            r.y = 120 + Math.random() * 360;
            this.particles.emit(r.x, r.y, 24, '#D50000');
          }
        }
      }
    }

    // Inter-Raft Bumper Collisions & Shunts
    const raftsArr = this.getActivePlayers().map(p => this.rafts.get(p.id)!);
    for (let i = 0; i < raftsArr.length; i++) {
      for (let j = i + 1; j < raftsArr.length; j++) {
        const r1 = raftsArr[i];
        const r2 = raftsArr[j];
        if (!r1.isAlive || !r2.isAlive) continue;

        const dist = Math.hypot(r1.x - r2.x, r1.y - r2.y);
        const touchDist = 44;

        if (dist < touchDist && dist > 0) {
          const overlap = touchDist - dist;
          const nx = (r1.x - r2.x) / dist;
          const ny = (r1.y - r2.y) / dist;
          r1.x += nx * overlap * 0.5;
          r1.y += ny * overlap * 0.5;
          r2.x -= nx * overlap * 0.5;
          r2.y -= ny * overlap * 0.5;

          // Check if one was shunting
          if (r1.shuntActiveTimer > 0 && r2.shuntActiveTimer <= 0) {
            this.executeBumperShunt(r1, r2, nx, ny);
          } else if (r2.shuntActiveTimer > 0 && r1.shuntActiveTimer <= 0) {
            this.executeBumperShunt(r2, r1, -nx, -ny);
          } else {
            // Normal rubber bumper bounce
            const avgVx = (r1.vx + r2.vx) * 0.5;
            const avgVy = (r1.vy + r2.vy) * 0.5;
            r1.vx = avgVx + nx * 120;
            r1.vy = avgVy + ny * 120;
            r2.vx = avgVx - nx * 120;
            r2.vy = avgVy - ny * 120;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private collectPickup(r: RaftPlayer, pk: RescuePickup): void {
    if (pk.type === 'chum') {
      // Attracts sharks for 4 seconds!
      r.hasChum = true;
      r.chumTimer = 4.0;
      r.score += pk.points;
      r.mood = 'shocked';
      r.moodTimer = 1.0;
      this.audio.playTap();
      this.particles.emit(pk.x, pk.y, 10, pk.color);
      return;
    }

    r.score += pk.points;
    r.rescuesMade++;

    if (pk.type === 'relic') {
      r.mood = 'triumph';
      r.moodTimer = 1.4;
      this.audio.playFanfare();
      this.particles.emit(pk.x, pk.y, 22, '#FFD700');
      this.screenShake = 7;
      this.hitStopTimer = 0.04;
    } else {
      r.mood = 'happy';
      r.moodTimer = 0.6;
      this.audio.playScore();
      this.particles.emit(pk.x, pk.y, 8, pk.color);
    }
  }

  private executeBumperShunt(attacker: RaftPlayer, victim: RaftPlayer, nx: number, ny: number): void {
    attacker.score += 30; // Sabotage bonus
    attacker.mood = 'triumph';
    attacker.moodTimer = 1.2;

    victim.vx = -nx * 440;
    victim.vy = -ny * 440;
    victim.stunTimer = 0.85;
    victim.mood = 'shocked';
    victim.moodTimer = 1.2;

    // Transfer Chum Bait from attacker to victim if attacker has it!
    if (attacker.hasChum) {
      attacker.hasChum = false;
      victim.hasChum = true;
      victim.chumTimer = 4.0;
    }

    this.audio.playExplosion();
    this.particles.emit((attacker.x + victim.x) * 0.5, (attacker.y + victim.y) * 0.5, 18, '#00E5FF');
    this.screenShake = 9;
    this.hitStopTimer = 0.045;
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

    const r = this.rafts.get(botId);
    if (!r || !r.isAlive || r.stunTimer > 0) return;

    let delay = 0.24;
    let blunder = false;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunder = Math.random() < 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
    }

    // Check nearest shark threat
    let nearestShark: PredatorShark | null = null;
    let minSharkDist = Infinity;
    for (const sh of this.sharks) {
      const d = Math.hypot(sh.x - r.x, sh.y - r.y);
      if (d < minSharkDist) {
        minSharkDist = d;
        nearestShark = sh;
      }
    }

    let steerX = 0;
    let steerY = 0;

    // If shark is close and bot doesn't have underdog immunity, flee!
    if (nearestShark && minSharkDist < 160 && !r.isUnderdog) {
      const dx = r.x - nearestShark.x;
      const dy = r.y - nearestShark.y;
      const fleeAngle = Math.atan2(dy, dx);
      steerX = Math.cos(fleeAngle);
      steerY = Math.sin(fleeAngle);

      // Hard bot triggers turbo boost to escape
      if (difficulty === 'bot_hard' && r.shuntCooldown <= 0) {
        this.input.setBotInput(botId, true, steerX, -steerY, false);
        this.botReactionTimers.set(botId, 0.25);
        return;
      }
    } else {
      // Seek nearest high-value rescue pickup
      let bestPickup: RescuePickup | null = null;
      let bestDist = Infinity;
      for (const pk of this.pickups) {
        if (pk.type === 'chum' && !r.isUnderdog) continue; // avoid chum
        const d = Math.hypot(pk.x - r.x, pk.y - r.y);
        if (d < bestDist) {
          bestDist = d;
          bestPickup = pk;
        }
      }

      if (bestPickup) {
        const dx = bestPickup.x - r.x;
        const dy = bestPickup.y - r.y;
        const seekAngle = Math.atan2(dy, dx);
        steerX = Math.cos(seekAngle);
        steerY = Math.sin(seekAngle);
      }
    }

    // Hard bot: ram rivals if they are close
    if (difficulty === 'bot_hard' && r.shuntCooldown <= 0) {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const rival = this.rafts.get(p.id);
        if (rival && Math.hypot(rival.x - r.x, rival.y - r.y) < 75) {
          const dx = rival.x - r.x;
          const dy = rival.y - r.y;
          this.input.setBotInput(botId, true, dx, -dy, false);
          this.botReactionTimers.set(botId, 0.28);
          return;
        }
      }
    }

    if (blunder) {
      steerX = -steerX;
      steerY = -steerY;
    }

    this.input.setBotInput(botId, false, steerX, -steerY, false);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const r = this.rafts.get(p.id);
      return {
        playerId: p.id,
        score: r?.score || 0,
        rescues: r?.rescuesMade || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topPlayer = scores[0];
    const mvpHighlight = winnerId !== null
      ? `Captain ${winnerId + 1} braved the predator lagoon and secured ${topPlayer.rescues} high-value rescue drops!`
      : 'All rescue rafts were shredded in the feeding frenzy lagoon!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Lagoon Water Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.waterShallow);
    bgGrad.addColorStop(1, theme.waterDeep);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Shore Perimeters
    this.renderThemeBackdrop(ctx, width, height, theme);

    // Render Rescue Pickups
    for (const pk of this.pickups) {
      this.renderPickup(ctx, pk);
    }

    // Render Patrolling Sharks
    for (const shark of this.sharks) {
      this.renderShark(ctx, shark, theme);
    }

    // Render Rafts
    for (const p of this.getActivePlayers()) {
      const r = this.rafts.get(p.id);
      if (!r || !r.isAlive) continue;
      this.renderRaft(ctx, p, r, theme);
    }

    // Render Particles
    this.particles.render(ctx);

    ctx.restore();

    // UI Header & Theme Pill
    this.renderUI(ctx, width, height);
  }

  private renderThemeBackdrop(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: LagoonTheme
  ): void {
    ctx.save();
    if (theme.id === 'emerald_atoll') {
      // Coral Sand Shoreline perimeter
      ctx.strokeStyle = theme.shoreColor;
      ctx.lineWidth = 14;
      ctx.strokeRect(10, 50, width - 20, height - 70);
    } else if (theme.id === 'cyber_aqueduct') {
      // Neon Rails & Circuit Lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 55) {
        ctx.beginPath();
        ctx.moveTo(x, 50);
        ctx.lineTo(x, height - 20);
        ctx.stroke();
      }
    } else {
      // Dark Rocks & Rain Storm Ripples
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 60; y < height; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private renderPickup(ctx: CanvasRenderingContext2D, pk: RescuePickup): void {
    ctx.save();
    ctx.translate(pk.x, pk.y);

    if (pk.type === 'relic') {
      // Golden Pelican Relic
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(0, 0, pk.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFA000';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, 0);
    } else if (pk.type === 'chum') {
      // Chum Bait Barrel
      ctx.fillStyle = '#8D6E63';
      ctx.beginPath();
      ctx.roundRect(-pk.radius, -pk.radius * 0.8, pk.radius * 2, pk.radius * 1.6, 4);
      ctx.fill();
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FF5252';
      ctx.font = '900 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🥩', 0, 0);
    } else {
      // Ring Buoy / Flare Crate
      ctx.fillStyle = pk.color;
      ctx.beginPath();
      ctx.arc(0, 0, pk.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, pk.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderShark(ctx: CanvasRenderingContext2D, shark: PredatorShark, theme: LagoonTheme): void {
    ctx.save();
    ctx.translate(shark.x, shark.y);
    ctx.rotate(shark.angle);

    // Shark Fin slicing water
    ctx.fillStyle = theme.sharkColor;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dorsal Fin Crest
    ctx.fillStyle = '#37474F';
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-6, -16);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();

    // Predatory Red Eyes
    ctx.fillStyle = '#FF1744';
    ctx.beginPath();
    ctx.arc(10, -4, 2, 0, Math.PI * 2);
    ctx.arc(10, 4, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderRaft(
    ctx: CanvasRenderingContext2D,
    p: PlayerConfig,
    r: RaftPlayer,
    _theme: LagoonTheme
  ): void {
    ctx.save();
    ctx.translate(r.x, r.y);

    // Underdog Glow
    if (r.isUnderdog) {
      ctx.save();
      const auraPulse = Math.sin(r.animTimer * 8) * 6 + 22;
      const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, auraPulse + 25);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
      grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, auraPulse + 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Charge Indicator Ring
    if (r.chargeTime > 0) {
      ctx.save();
      const chargeRatio = r.chargeTime / 1.0;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(r.angle);

    // Inflatable Pontoon Rubber Collar (Oval)
    ctx.fillStyle = r.isUnderdog ? '#FFD700' : p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Raft Deck Interior
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outboard Motor Propeller at Stern
    ctx.fillStyle = '#455A64';
    ctx.fillRect(-26, -4, 8, 8);

    // Mascot Captain Seated at Helm
    const isBot = p.type !== 'human';
    drawCharacter(
      ctx,
      0,
      0,
      12,
      p.id,
      isBot,
      r.mood,
      r.animTimer,
      undefined
    );

    ctx.restore();

    // Overhead Health & Score Badge
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(r.x - 38, r.y + 24, 76, 22, 6);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${r.score}`, r.x, r.y + 38);

    // Health pips
    for (let k = 0; k < r.maxHealth; k++) {
      ctx.fillStyle = k < r.health ? '#4CAF50' : '#546E7A';
      ctx.beginPath();
      ctx.arc(r.x - 18 + k * 12, r.y + 20, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Top-Center Safe Zone (y: 12-44) is strictly reserved for global timer
    // Minigame Header Badge strictly at y: 56
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 130, 56, 260, 28, 8);
    ctx.fill();

    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🦈 SHARK BAIT • ${THEMES[this.currentThemeIdx].name}`, width / 2, 70);
    ctx.restore();

    // Theme Pill (bottom-left at x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`[T] ${THEMES[this.currentThemeIdx].name}`, pillX + 10, pillY + pillH / 2);
    ctx.restore();

    // Player Cards at Corners (Offset to y: height - 128 to never overlap Theme Pill)
    this.renderCornerPlayerCards(ctx, width, height);

    // Control Hints at Bottom Right
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(width - 260, height - 36, 240, 26, 6);
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Steer: Pilot Raft • Hold Action: Boost & Ram', width - 28, height - 23);
    ctx.restore();
  }

  private renderCornerPlayerCards(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const r = this.rafts.get(p.id);
      if (!r) return;

      const cardW = 130;
      const cardH = 48;
      let cx = 20;
      let cy = height - 128; // safe offset above Theme Pill

      if (idx === 1) {
        cx = width - cardW - 20;
        cy = height - 128;
      } else if (idx === 2) {
        cx = 20;
        cy = 90;
      } else if (idx === 3) {
        cx = width - cardW - 20;
        cy = 90;
      }

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 6);
      ctx.fill();

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 10, cy + 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 13px monospace';
      ctx.fillText(`${r.score} pts`, cx + 10, cy + 36);

      ctx.fillStyle = '#FFD54F';
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🛟 ${r.rescuesMade}`, cx + cardW - 8, cy + 36);

      ctx.restore();
    });
  }
}
