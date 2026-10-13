import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface SubmarinePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  health: number;
  maxHealth: number;
  chargeTime: number;
  isCharging: boolean;
  torpedoCooldown: number;
  shuntActiveTimer: number;
  shuntDirX: number;
  shuntDirY: number;
  stunTimer: number;
  score: number;
  hitsLanded: number;
  isAlive: boolean;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface Torpedo {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isSuper: boolean;
  bouncesLeft: number;
  life: number;
  rot: number;
}

interface HydroThermalVent {
  x: number;
  y: number;
  radius: number;
  pulseTimer: number;
}

interface BasaltPillar {
  x: number;
  y: number;
  radius: number;
}

interface SunkenCanister {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

interface TrenchTheme {
  id: string;
  name: string;
  icon: string;
  waterDeep: string;
  waterShallow: string;
  rockColor: string;
  rockHighlight: string;
  ventGlow: string;
  accentColor: string;
}

const THEMES: TrenchTheme[] = [
  {
    id: 'mariana_abyss',
    name: 'Mariana Abyss 🌊',
    icon: '🌊',
    waterDeep: '#020612',
    waterShallow: '#0A1832',
    rockColor: '#1A2434',
    rockHighlight: '#2E3F5A',
    ventGlow: '#00E5FF',
    accentColor: '#38BDF8'
  },
  {
    id: 'europa_ocean',
    name: 'Europa Cryo-Trench ❄️',
    icon: '❄️',
    waterDeep: '#021017',
    waterShallow: '#082536',
    rockColor: '#16384C',
    rockHighlight: '#38BDF8',
    ventGlow: '#80D8FF',
    accentColor: '#00E5FF'
  },
  {
    id: 'atlantis_ruins',
    name: 'Atlantis Sunken Ruins 🏛️',
    icon: '🏛️',
    waterDeep: '#04120D',
    waterShallow: '#0C261E',
    rockColor: '#1F382E',
    rockHighlight: '#FFD700',
    ventGlow: '#69F0AE',
    accentColor: '#4ADE80'
  }
];

export class SubmarineTorpedoGame extends BaseGame {
  public currentMapName: string = 'Mariana Abyss 🌊';
  private currentThemeIdx: number = 0;

  private subs: Map<PlayerId, SubmarinePlayer> = new Map();
  private torpedoes: Torpedo[] = [];
  private pillars: BasaltPillar[] = [];
  private vents: HydroThermalVent[] = [];
  private canisters: SunkenCanister[] = [];
  private nextTorpedoId: number = 1;
  private sonarRadius: number = 0;

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
    this.sonarRadius = 0;
    this.torpedoes = [];
    this.subs.clear();
    this.pillars = [];
    this.vents = [];
    this.canisters = [];
    this.botReactionTimers.clear();

    // Natural Basalt Pillars
    this.pillars.push({ x: width * 0.28, y: height * 0.36, radius: 36 });
    this.pillars.push({ x: width * 0.72, y: height * 0.36, radius: 36 });
    this.pillars.push({ x: width * 0.50, y: height * 0.65, radius: 44 });

    // Hydrothermal Vents
    this.vents.push({ x: width * 0.50, y: height * 0.25, radius: 38, pulseTimer: 0 });
    this.vents.push({ x: width * 0.20, y: height * 0.75, radius: 34, pulseTimer: 1.0 });
    this.vents.push({ x: width * 0.80, y: height * 0.75, radius: 34, pulseTimer: 2.0 });

    // Sunken Treasure Canisters
    this.canisters.push({ id: 1, x: width * 0.50, y: height * 0.45, collected: false });
    this.canisters.push({ id: 2, x: width * 0.32, y: height * 0.80, collected: false });
    this.canisters.push({ id: 3, x: width * 0.68, y: height * 0.80, collected: false });

    const active = this.getActivePlayers();
    const spawnPositions = [
      { x: width * 0.16, y: height * 0.26, angle: 0 },
      { x: width * 0.84, y: height * 0.26, angle: Math.PI },
      { x: width * 0.16, y: height * 0.74, angle: 0 },
      { x: width * 0.84, y: height * 0.74, angle: Math.PI }
    ];

    active.forEach((p, idx) => {
      const pos = spawnPositions[idx % spawnPositions.length];
      this.subs.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        targetAngle: pos.angle,
        health: 4,
        maxHealth: 4,
        chargeTime: 0,
        isCharging: false,
        torpedoCooldown: 0,
        shuntActiveTimer: 0,
        shuntDirX: 0,
        shuntDirY: 0,
        stunTimer: 0,
        score: 0,
        hitsLanded: 0,
        isAlive: true,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: Math.random() * 5
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
    });

    this.currentThemeIdx = 0;
    this.currentMapName = THEMES[0].name;
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
    this.sonarRadius = (this.sonarRadius + dt * 180) % (Math.hypot(width, height) * 0.7);

    // Identify leader score for Underdog surge
    let maxScore = 0;
    for (const sub of this.subs.values()) {
      if (sub.score > maxScore) maxScore = sub.score;
    }

    // Update bots
    this.updateBots(dt, width, height);

    // Update vents
    for (const vent of this.vents) {
      vent.pulseTimer += dt;
      if (Math.random() < 0.3) {
        this.particles.emit(
          vent.x + (Math.random() - 0.5) * vent.radius,
          vent.y + (Math.random() - 0.5) * vent.radius,
          1,
          THEMES[this.currentThemeIdx].ventGlow
        );
      }
    }

    // Update submarines
    for (const p of this.getActivePlayers()) {
      const sub = this.subs.get(p.id);
      if (!sub || !sub.isAlive) continue;

      sub.animTimer += dt;
      if (sub.moodTimer > 0) {
        sub.moodTimer -= dt;
        if (sub.moodTimer <= 0) sub.mood = 'idle';
      }

      // Check Underdog
      sub.isUnderdog = maxScore >= 35 && sub.score <= maxScore - 30;

      // Handle Stun
      if (sub.stunTimer > 0) {
        sub.stunTimer -= dt;
        sub.vx *= 0.88;
        sub.vy *= 0.88;
        sub.x += sub.vx * dt;
        sub.y += sub.vy * dt;
        continue;
      }

      // Handle Shunt Cooldown & Active Timer
      if (sub.torpedoCooldown > 0) sub.torpedoCooldown -= dt;
      if (sub.shuntActiveTimer > 0) {
        sub.shuntActiveTimer -= dt;
        sub.vx = sub.shuntDirX * 520;
        sub.vy = sub.shuntDirY * 520;
        this.particles.emit(sub.x, sub.y, 2, '#38BDF8');
      }

      // Steering & Throttle
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const hasMoveInput = Math.abs(steer) > 0.1 || Math.abs(throttle) > 0.1;
      if (hasMoveInput) {
        sub.targetAngle = Math.atan2(-throttle, steer);
      }

      // Smooth hydrodynamic turning
      let diff = sub.targetAngle - sub.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      sub.angle += diff * Math.min(1.0, dt * 7);

      const baseThrust = sub.isUnderdog ? 260 : 210;

      // Check if inside hydrothermal vent (convection speed boost)
      for (const vent of this.vents) {
        const d = Math.hypot(sub.x - vent.x, sub.y - vent.y);
        if (d < vent.radius) {
          sub.vx += Math.cos(sub.angle) * 120 * dt;
          sub.vy += Math.sin(sub.angle) * 120 * dt;
          this.particles.emit(sub.x, sub.y, 1, THEMES[this.currentThemeIdx].ventGlow);
        }
      }

      // Hold-to-Charge Supercavitating Torpedo vs Hydro-Ram
      if (isAction && sub.shuntActiveTimer <= 0) {
        sub.isCharging = true;
        sub.chargeTime = Math.min(1.0, sub.chargeTime + dt * 2.2);

        // While charging, sub cruises steadily
        if (hasMoveInput) {
          sub.vx += Math.cos(sub.angle) * baseThrust * 0.45 * dt;
          sub.vy += Math.sin(sub.angle) * baseThrust * 0.45 * dt;
        }
      } else {
        if (sub.isCharging) {
          // Release: Launch Torpedo or Execute Hydro-Ram!
          sub.isCharging = false;
          const isSweet = sub.chargeTime >= 0.72 && sub.chargeTime <= 0.98;

          // If holding heavy forward throttle and near a rival, trigger Hydro-Ram!
          if (sub.chargeTime > 0.35 && hasMoveInput) {
            sub.shuntActiveTimer = 0.22;
            sub.shuntDirX = Math.cos(sub.angle);
            sub.shuntDirY = Math.sin(sub.angle);
            this.audio.playWhoosh();
            this.particles.emit(sub.x, sub.y, 10, '#00E5FF');
          }

          // Also launch torpedo
          if (sub.torpedoCooldown <= 0) {
            this.launchTorpedo(sub, isSweet);
          }
          sub.chargeTime = 0;
        } else if (sub.shuntActiveTimer <= 0 && hasMoveInput) {
          sub.vx += Math.cos(sub.angle) * baseThrust * dt;
          sub.vy += Math.sin(sub.angle) * baseThrust * dt;

          // Propeller Cavitation Bubbles
          if (Math.random() < 0.28) {
            const propX = sub.x - Math.cos(sub.angle) * 20;
            const propY = sub.y - Math.sin(sub.angle) * 20;
            this.particles.emit(propX, propY, 1, '#BAE6FD');
          }
        }
      }

      // Water Drag
      sub.vx *= Math.pow(0.88, dt * 10);
      sub.vy *= Math.pow(0.88, dt * 10);

      sub.x += sub.vx * dt;
      sub.y += sub.vy * dt;

      // Arena boundary limits
      const margin = 35;
      if (sub.x < margin) { sub.x = margin; sub.vx = Math.abs(sub.vx) * 0.6; }
      if (sub.x > width - margin) { sub.x = width - margin; sub.vx = -Math.abs(sub.vx) * 0.6; }
      if (sub.y < 65) { sub.y = 65; sub.vy = Math.abs(sub.vy) * 0.6; }
      if (sub.y > height - 60) { sub.y = height - 60; sub.vy = -Math.abs(sub.vy) * 0.6; }

      // Basalt Pillar Collisions
      for (const pillar of this.pillars) {
        const dx = sub.x - pillar.x;
        const dy = sub.y - pillar.y;
        const dist = Math.hypot(dx, dy);
        const minDist = pillar.radius + 18;
        if (dist < minDist && dist > 0) {
          const push = minDist - dist;
          sub.x += (dx / dist) * push;
          sub.y += (dy / dist) * push;
          sub.vx *= 0.4;
          sub.vy *= 0.4;
          this.audio.playBounce();
        }
      }

      // Sunken Treasure Canister Collection
      for (const can of this.canisters) {
        if (!can.collected && Math.hypot(sub.x - can.x, sub.y - can.y) < 32) {
          can.collected = true;
          sub.score += 35;
          sub.mood = 'triumph';
          sub.moodTimer = 1.0;
          this.audio.playScore();
          this.particles.emit(can.x, can.y, 16, '#FFD700');
        }
      }
    }

    // Update Torpedoes
    for (let i = this.torpedoes.length - 1; i >= 0; i--) {
      const t = this.torpedoes[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.life -= dt;

      // Torpedo Cavitation Trail
      if (Math.random() < 0.35) {
        this.particles.emit(t.x, t.y, 1, t.isSuper ? '#FFD700' : '#E0F2FE');
      }

      let exploded = false;

      // Basalt Pillar Ricochet or Hit
      for (const pillar of this.pillars) {
        const dist = Math.hypot(t.x - pillar.x, t.y - pillar.y);
        if (dist < pillar.radius + 6) {
          if (t.isSuper && t.bouncesLeft > 0) {
            // Ricochet!
            t.bouncesLeft--;
            const nx = (t.x - pillar.x) / dist;
            const ny = (t.y - pillar.y) / dist;
            const dot = t.vx * nx + t.vy * ny;
            t.vx -= 2 * dot * nx;
            t.vy -= 2 * dot * ny;
            t.rot = Math.atan2(t.vy, t.vx);
            this.audio.playBounce();
            this.particles.emit(t.x, t.y, 6, '#FFD700');
          } else {
            exploded = true;
          }
          break;
        }
      }

      // Wall hit
      if (t.x < 20 || t.x > width - 20 || t.y < 55 || t.y > height - 40) {
        exploded = true;
      }

      // Submarine Impact
      if (!exploded) {
        for (const p of this.getActivePlayers()) {
          const victim = this.subs.get(p.id);
          if (!victim || !victim.isAlive || victim.id === t.ownerId) continue;

          if (Math.hypot(t.x - victim.x, t.y - victim.y) < 22) {
            exploded = true;
            this.executeTorpedoHit(t, victim);
            break;
          }
        }
      }

      if (exploded || t.life <= 0) {
        this.particles.emit(t.x, t.y, 8, t.isSuper ? '#FFD700' : '#38BDF8');
        this.torpedoes.splice(i, 1);
      }
    }

    // Inter-Submarine Hydro-Ram Collisions
    const subsArr = this.getActivePlayers().map(p => this.subs.get(p.id)!);
    for (let i = 0; i < subsArr.length; i++) {
      for (let j = i + 1; j < subsArr.length; j++) {
        const s1 = subsArr[i];
        const s2 = subsArr[j];
        if (!s1.isAlive || !s2.isAlive) continue;

        const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
        const touchDist = 44;

        if (dist < touchDist && dist > 0) {
          const overlap = touchDist - dist;
          const nx = (s1.x - s2.x) / dist;
          const ny = (s1.y - s2.y) / dist;
          s1.x += nx * overlap * 0.5;
          s1.y += ny * overlap * 0.5;
          s2.x -= nx * overlap * 0.5;
          s2.y -= ny * overlap * 0.5;

          // Check if one was Hydro-Ramming
          if (s1.shuntActiveTimer > 0 && s2.shuntActiveTimer <= 0) {
            this.executeRamImpact(s1, s2, nx, ny);
          } else if (s2.shuntActiveTimer > 0 && s1.shuntActiveTimer <= 0) {
            this.executeRamImpact(s2, s1, -nx, -ny);
          } else {
            // Normal hull bump
            const avgVx = (s1.vx + s2.vx) * 0.5;
            const avgVy = (s1.vy + s2.vy) * 0.5;
            s1.vx = avgVx + nx * 100;
            s1.vy = avgVy + ny * 100;
            s2.vx = avgVx - nx * 100;
            s2.vy = avgVy - ny * 100;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private launchTorpedo(sub: SubmarinePlayer, isSuper: boolean): void {
    sub.torpedoCooldown = isSuper ? 0.65 : 0.85;
    const speed = isSuper ? 460 : 310;
    const launchX = sub.x + Math.cos(sub.angle) * 22;
    const launchY = sub.y + Math.sin(sub.angle) * 22;

    this.torpedoes.push({
      id: this.nextTorpedoId++,
      ownerId: sub.id,
      x: launchX,
      y: launchY,
      vx: Math.cos(sub.angle) * speed,
      vy: Math.sin(sub.angle) * speed,
      isSuper,
      bouncesLeft: isSuper ? 2 : 0,
      life: 2.5,
      rot: sub.angle
    });

    this.audio.playWhoosh();
    this.particles.emit(launchX, launchY, isSuper ? 10 : 4, isSuper ? '#FFD700' : '#E0F2FE');
  }

  private executeTorpedoHit(t: Torpedo, victim: SubmarinePlayer): void {
    const shooter = this.subs.get(t.ownerId);
    const damage = t.isSuper ? 2 : 1;

    victim.health = Math.max(0, victim.health - damage);
    victim.stunTimer = 0.8;
    victim.mood = 'shocked';
    victim.moodTimer = 1.2;

    if (shooter) {
      shooter.score += t.isSuper ? 45 : 25;
      shooter.hitsLanded++;
      shooter.mood = 'triumph';
      shooter.moodTimer = 1.2;
    }

    this.audio.playExplosion();
    this.screenShake = t.isSuper ? 12 : 7;
    this.hitStopTimer = 0.045;
    this.particles.emit(victim.x, victim.y, 18, '#FF5252');

    if (victim.health <= 0) {
      // Submarine Hull Breach! Respawn after delay
      victim.health = victim.maxHealth;
      victim.x = 80 + Math.random() * 640;
      victim.y = 120 + Math.random() * 360;
      this.particles.emit(victim.x, victim.y, 25, '#FF1744');
    }
  }

  private executeRamImpact(attacker: SubmarinePlayer, victim: SubmarinePlayer, nx: number, ny: number): void {
    attacker.score += 30; // Sabotage bonus
    attacker.mood = 'triumph';
    attacker.moodTimer = 1.2;

    victim.vx = -nx * 440;
    victim.vy = -ny * 440;
    victim.stunTimer = 0.85;
    victim.mood = 'shocked';
    victim.moodTimer = 1.2;

    this.audio.playExplosion();
    this.particles.emit((attacker.x + victim.x) * 0.5, (attacker.y + victim.y) * 0.5, 18, '#00E5FF');
    this.screenShake = 10;
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

    const sub = this.subs.get(botId);
    if (!sub || !sub.isAlive || sub.stunTimer > 0) return;

    let delay = 0.24;
    let blunder = false;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunder = Math.random() < 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
    }

    // Find nearest rival submarine
    let nearest: SubmarinePlayer | null = null;
    let minDist = Infinity;
    for (const [id, rival] of this.subs.entries()) {
      if (id === botId || !rival.isAlive) continue;
      const d = Math.hypot(rival.x - sub.x, rival.y - sub.y);
      if (d < minDist) {
        minDist = d;
        nearest = rival;
      }
    }

    let steerX = 0;
    let steerY = 0;
    let shoot = false;

    if (nearest) {
      const dx = nearest.x - sub.x;
      const dy = nearest.y - sub.y;
      const targetAngle = Math.atan2(dy, dx);
      let angleDiff = Math.abs(sub.angle - targetAngle);
      while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);

      steerX = Math.cos(targetAngle);
      steerY = Math.sin(targetAngle);

      if (difficulty === 'bot_easy') {
        if (angleDiff < 0.6 && Math.random() < 0.5) shoot = true;
      } else if (difficulty === 'bot_hard') {
        if (angleDiff < 0.28) shoot = true;
      } else {
        if (angleDiff < 0.42) shoot = true;
      }
    }

    if (blunder) {
      steerX = -steerX;
      steerY = -steerY;
    }

    this.input.setBotInput(botId, shoot, steerX, -steerY, false);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const sub = this.subs.get(p.id);
      return {
        playerId: p.id,
        score: sub?.score || 0,
        hits: sub?.hitsLanded || 0
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
      ? `Captain ${winnerId + 1} dominated the oceanic trench with ${topPlayer.hits} direct torpedo strikes!`
      : 'All submarines retreated into the murky ocean abyss!';

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

    // Trench Ocean Waters
    const waterGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      80,
      width / 2,
      height / 2,
      width * 0.7
    );
    waterGrad.addColorStop(0, theme.waterShallow);
    waterGrad.addColorStop(1, theme.waterDeep);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, width, height);

    // Dynamic Sonar Pulse Wave
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, this.sonarRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Render Hydrothermal Vents
    for (const vent of this.vents) {
      ctx.save();
      const pulse = Math.sin(vent.pulseTimer * 4) * 4;
      const grad = ctx.createRadialGradient(vent.x, vent.y, 4, vent.x, vent.y, vent.radius + pulse);
      grad.addColorStop(0, theme.ventGlow);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(vent.x, vent.y, vent.radius + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Sunken Treasure Canisters
    for (const can of this.canisters) {
      if (!can.collected) {
        ctx.save();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(can.x, can.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFA000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', can.x, can.y);
        ctx.restore();
      }
    }

    // Render Basalt Pillars
    for (const pillar of this.pillars) {
      ctx.save();
      ctx.fillStyle = theme.rockColor;
      ctx.beginPath();
      ctx.arc(pillar.x, pillar.y, pillar.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = theme.rockHighlight;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Top texture concentric ring
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pillar.x, pillar.y, pillar.radius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Render Torpedoes
    for (const t of this.torpedoes) {
      this.renderTorpedo(ctx, t);
    }

    // Render Submarines
    for (const p of this.getActivePlayers()) {
      const sub = this.subs.get(p.id);
      if (!sub || !sub.isAlive) continue;
      this.renderSubmarine(ctx, p, sub, theme);
    }

    // Render Particles
    this.particles.render(ctx);

    ctx.restore();

    // UI Header & Theme Pill
    this.renderUI(ctx, width, height);
  }

  private renderTorpedo(ctx: CanvasRenderingContext2D, t: Torpedo): void {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rot);

    // Torpedo Body
    ctx.fillStyle = t.isSuper ? '#FFD700' : '#ECEFF1';
    ctx.beginPath();
    ctx.roundRect(-10, -4, 20, 8, 4);
    ctx.fill();

    ctx.strokeStyle = t.isSuper ? '#FF8F00' : '#00E5FF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Warhead glow
    ctx.fillStyle = t.isSuper ? '#FF1744' : '#00E5FF';
    ctx.beginPath();
    ctx.arc(8, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderSubmarine(
    ctx: CanvasRenderingContext2D,
    p: PlayerConfig,
    sub: SubmarinePlayer,
    _theme: TrenchTheme
  ): void {
    ctx.save();
    ctx.translate(sub.x, sub.y);

    // Underdog Glow
    if (sub.isUnderdog) {
      ctx.save();
      const auraPulse = Math.sin(sub.animTimer * 8) * 6 + 22;
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
    if (sub.chargeTime > 0) {
      ctx.save();
      const chargeRatio = sub.chargeTime / 1.0;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(sub.angle);

    // Submarine Hull (Elongated tear-drop)
    ctx.fillStyle = sub.isUnderdog ? '#FFD700' : p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Conning Tower / Glass Dome Cockpit
    ctx.fillStyle = 'rgba(224, 242, 254, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Propeller Screws at rear
    const propAnim = Math.sin(sub.animTimer * 20) * 8;
    ctx.strokeStyle = '#90A4AE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-26, -propAnim);
    ctx.lineTo(-26, propAnim);
    ctx.stroke();

    // Mini Captain Mascot inside Dome
    const isBot = p.type !== 'human';
    drawCharacter(
      ctx,
      0,
      0,
      10,
      p.id,
      isBot,
      sub.mood,
      sub.animTimer,
      undefined
    );

    ctx.restore();

    // Overhead Health & Score Badge
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(sub.x - 38, sub.y + 24, 76, 22, 6);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${sub.score}`, sub.x, sub.y + 38);

    // Health pips
    for (let k = 0; k < sub.maxHealth; k++) {
      ctx.fillStyle = k < sub.health ? '#4CAF50' : '#546E7A';
      ctx.beginPath();
      ctx.arc(sub.x - 18 + k * 12, sub.y + 20, 3, 0, Math.PI * 2);
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
    ctx.fillText(`🌊 SUBMARINE TORPEDO • ${THEMES[this.currentThemeIdx].name}`, width / 2, 70);
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
    ctx.fillText('Steer: Pilot Sub • Hold Action: Torpedo & Ram', width - 28, height - 23);
    ctx.restore();
  }

  private renderCornerPlayerCards(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const sub = this.subs.get(p.id);
      if (!sub) return;

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
      ctx.fillText(`${sub.score} pts`, cx + 10, cy + 36);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🎯 ${sub.hitsLanded}`, cx + cardW - 8, cy + 36);

      ctx.restore();
    });
  }
}
