import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type CreatureRole = 'minnow' | 'shark';

interface Swimmer {
  id: PlayerId;
  role: CreatureRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  isAlive: boolean; // false if chomped during current wave
  hasCrossed: boolean; // true if reached safe shore this wave
  dashCooldown: number;
  dashDuration: number;
  lungeCooldown: number;
  lungeDuration: number;
  stunTimer: number;
}

interface NpcMinnow {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  color: string;
  isAlive: boolean;
  hasCrossed: boolean;
  speed: number;
  targetY: number;
  jukeTimer: number;
}

interface SeaStar {
  id: number;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  pulsePhase: number;
}

export class SharksAndMinnowsGame extends BaseGame {
  private swimmers: Map<PlayerId, Swimmer> = new Map();
  private npcMinnows: NpcMinnow[] = [];
  private seaStars: SeaStar[] = [];
  private currentWave: number = 1;
  private maxWaves: number = 3;
  private waveTimer: number = 16.0;
  private waveState: 'announcing' | 'swimming' | 'wave_cleared' = 'announcing';
  private announcementTimer: number = 1.4;

  // Ocean zones
  private northShoreY: number = 115;
  private southShoreY: number = 485;
  private swimmingDirection: 'north_to_south' | 'south_to_north' = 'south_to_north';

  // Mega AI helper shark in Wave 3
  private helperShark: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    lungeCooldown: number;
    lungeDuration: number;
  } | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 55.0;
    this.isFinished = false;
    this.currentWave = 1;
    this.maxWaves = 3;
    this.swimmers.clear();
    this.npcMinnows = [];
    this.seaStars = [];

    this.input.setControlMode('directional');

    this.northShoreY = Math.max(95, Math.floor(height * 0.19));
    this.southShoreY = Math.min(height - 95, Math.floor(height * 0.81));

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.swimmers.set(p.id, {
        id: p.id,
        role: 'minnow',
        x: width / 2,
        y: this.southShoreY + 45,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        score: 0,
        isAlive: true,
        hasCrossed: false,
        dashCooldown: 0,
        dashDuration: 0,
        lungeCooldown: 0,
        lungeDuration: 0,
        stunTimer: 0
      });
    });

    this.startWave(this.currentWave, width, height);

    if (typeof window !== 'undefined') {
      (window as any).__SHARKS_AND_MINNOWS_DEBUG__ = {
        game: this,
        getWave: () => this.currentWave,
        getWaveState: () => this.waveState,
        getSwimmer: (id: PlayerId) => this.swimmers.get(id),
        getNpcMinnows: () => this.npcMinnows,
        getSeaStars: () => this.seaStars,
        setPlayerPos: (id: PlayerId, x: number, y: number) => {
          const s = this.swimmers.get(id);
          if (s) {
            s.x = x;
            s.y = y;
            s.vx = 0;
            s.vy = 0;
          }
        },
        triggerDash: (id: PlayerId) => {
          const s = this.swimmers.get(id);
          if (s && s.role === 'minnow') {
            s.dashDuration = 0.35;
            s.dashCooldown = 1.4;
          }
        },
        triggerLunge: (id: PlayerId) => {
          const s = this.swimmers.get(id);
          if (s && s.role === 'shark') {
            s.lungeDuration = 0.4;
            s.lungeCooldown = 1.6;
          }
        }
      };
    }
  }

  private startWave(waveNum: number, width: number, height: number): void {
    this.currentWave = waveNum;
    this.waveTimer = 16.0;
    this.waveState = 'announcing';
    this.announcementTimer = 1.3;

    // Alternate crossing direction each wave
    this.swimmingDirection = waveNum % 2 === 1 ? 'south_to_north' : 'north_to_south';

    const active = this.getActivePlayers();
    const count = active.length;

    // Assign roles:
    // Wave 1: Player 1 is Shark, Player 0 (and others) are Minnows
    // Wave 2: Roles alternate: Player 0 is Shark, Player 1 is Minnow
    // Wave 3: Both players are Minnows dodging an Apex AI Shark Pack!
    let sharkPlayerId: PlayerId | null = null;
    if (waveNum === 1) {
      sharkPlayerId = count >= 2 ? active[1].id : null;
    } else if (waveNum === 2) {
      sharkPlayerId = active[0].id;
    } else {
      // Wave 3: All active players are Minnows competing in the Final Crossing!
      sharkPlayerId = null;
    }

    const startBankY = this.swimmingDirection === 'south_to_north'
      ? this.southShoreY + 45
      : this.northShoreY - 45;

    const startAngle = this.swimmingDirection === 'south_to_north' ? -Math.PI / 2 : Math.PI / 2;

    active.forEach((p, idx) => {
      const s = this.swimmers.get(p.id);
      if (!s) return;

      const isShark = p.id === sharkPlayerId;
      s.role = isShark ? 'shark' : 'minnow';
      s.isAlive = true;
      s.hasCrossed = false;
      s.dashCooldown = 0;
      s.dashDuration = 0;
      s.lungeCooldown = 0;
      s.lungeDuration = 0;
      s.stunTimer = 0;
      s.vx = 0;
      s.vy = 0;

      if (isShark) {
        // Position Shark in the deep channel center
        s.x = width * 0.5 + (idx % 2 === 0 ? -40 : 40);
        s.y = (this.northShoreY + this.southShoreY) / 2;
        s.angle = 0;
      } else {
        // Position Minnow on starting safe shore
        const slotX = width * 0.25 + (idx * width * 0.5) / Math.max(1, count - (sharkPlayerId !== null ? 1 : 0));
        s.x = Math.max(60, Math.min(width - 60, slotX));
        s.y = startBankY;
        s.angle = startAngle;
      }
    });

    // Helper shark for Wave 3 final challenge or 1-player mode
    if (sharkPlayerId === null || count === 1) {
      this.helperShark = {
        x: width * 0.5,
        y: (this.northShoreY + this.southShoreY) / 2,
        vx: 0,
        vy: 0,
        angle: 0,
        lungeCooldown: 0,
        lungeDuration: 0
      };
    } else {
      this.helperShark = null;
    }

    // Spawn school of 6 cute NPC Minnows swimming alongside players
    this.npcMinnows = [];
    const npcColors = ['#FBBF24', '#34D399', '#F472B6', '#38BDF8', '#A78BFA', '#FB923C'];
    const targetY = this.swimmingDirection === 'south_to_north'
      ? this.northShoreY - 25
      : this.southShoreY + 25;

    for (let i = 0; i < 6; i++) {
      const npcX = width * 0.12 + (i * width * 0.76) / 5 + (Math.random() - 0.5) * 35;
      this.npcMinnows.push({
        id: i,
        x: npcX,
        y: startBankY + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        angle: startAngle,
        color: npcColors[i % npcColors.length],
        isAlive: true,
        hasCrossed: false,
        speed: 155 + Math.random() * 35,
        targetY,
        jukeTimer: 0
      });
    }

    // Spawn 4 collectible Sea Stars in the deep ocean
    this.seaStars = [];
    const channelH = this.southShoreY - this.northShoreY;
    for (let s = 0; s < 4; s++) {
      this.seaStars.push({
        id: s,
        x: width * 0.18 + s * (width * 0.64) / 3 + (Math.random() - 0.5) * 30,
        y: this.northShoreY + channelH * 0.25 + Math.random() * (channelH * 0.5),
        radius: 12,
        collected: false,
        pulsePhase: Math.random() * Math.PI * 2
      });
    }

    // Audio whistle for announcement
    this.audio.playTone(880, 0.08, 'triangle');
    setTimeout(() => this.audio.playTone(1174.66, 0.12, 'sine'), 90);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    // Announcement countdown before releasing minnows
    if (this.waveState === 'announcing') {
      this.announcementTimer -= dt;
      if (this.announcementTimer <= 0) {
        this.waveState = 'swimming';
        this.audio.playTone(659.25, 0.08, 'square');
        setTimeout(() => this.audio.playTone(1318.51, 0.16, 'sine'), 80);
        this.particles.showFloatingText('🏊 SWIM FOR YOUR LIVES!', width / 2, height / 2 - 20, '#38BDF8', 26);
      }
    } else if (this.waveState === 'swimming') {
      this.waveTimer -= dt;
    } else if (this.waveState === 'wave_cleared') {
      this.announcementTimer -= dt;
      if (this.announcementTimer <= 0) {
        if (this.currentWave >= this.maxWaves) {
          this.isFinished = true;
        } else {
          this.startWave(this.currentWave + 1, width, height);
        }
      }
      return;
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update helper shark if active
    if (this.helperShark) {
      this.updateHelperShark(dt, width, height);
    }

    // Update Swimmers (Players)
    const active = this.getActivePlayers();
    for (const p of active) {
      const s = this.swimmers.get(p.id);
      if (!s) continue;

      if (s.stunTimer > 0) {
        s.stunTimer -= dt;
      }

      // Cooldown timers
      if (s.dashCooldown > 0) s.dashCooldown -= dt;
      if (s.dashDuration > 0) s.dashDuration -= dt;
      if (s.lungeCooldown > 0) s.lungeCooldown -= dt;
      if (s.lungeDuration > 0) s.lungeDuration -= dt;

      if (!s.isAlive || s.hasCrossed) {
        // Idle friction once finished or caught
        s.vx *= Math.pow(0.85, dt * 60);
        s.vy *= Math.pow(0.85, dt * 60);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        continue;
      }

      // Input routing
      const rawSteer = this.input.getRawSteer(p.id);
      const rawThrottle = this.input.getRawThrottle(p.id);
      const smoothSteer = this.input.getSteer(p.id);
      const smoothThrottle = this.input.getThrottle(p.id);

      const steer = Math.abs(rawSteer) > 0 ? rawSteer : smoothSteer;
      const throttle = Math.abs(rawThrottle) > 0 ? rawThrottle : smoothThrottle;
      const isAction = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);

      // Handle abilities
      if (s.role === 'minnow') {
        if (isAction && s.dashCooldown <= 0 && s.dashDuration <= 0 && s.stunTimer <= 0) {
          s.dashDuration = 0.35;
          s.dashCooldown = 1.4;
          this.audio.playTone(740, 0.08, 'sine');
          this.particles.spawnSparks(s.x, s.y, '#38BDF8', 8);
        }
      } else if (s.role === 'shark') {
        if (isAction && s.lungeCooldown <= 0 && s.lungeDuration <= 0 && s.stunTimer <= 0) {
          s.lungeDuration = 0.4;
          s.lungeCooldown = 1.6;
          this.audio.playTone(320, 0.12, 'sawtooth');
          this.particles.spawnSparks(s.x, s.y, '#EF4444', 10);
        }
      }

      // Base & boosted speeds
      let speed = s.role === 'shark' ? 195 : 185;
      if (s.dashDuration > 0) speed = 330;
      if (s.lungeDuration > 0) speed = 345;

      const inputX = steer;
      const inputY = -throttle; // Canvas: negative Y is UP, positive Y is DOWN
      const mag = Math.hypot(inputX, inputY);

      if (mag > 0.15 && this.waveState !== 'announcing') {
        const normX = inputX / mag;
        const normY = inputY / mag;
        s.vx = normX * speed;
        s.vy = normY * speed;
        s.angle = Math.atan2(normY, normX);

        // Water wake bubble particles
        if (Math.random() < 0.28) {
          this.particles.spawnSparks(s.x, s.y, s.role === 'shark' ? '#93C5FD' : '#E0F2FE', 2);
        }
      } else {
        // Natural water drag
        s.vx *= Math.pow(0.82, dt * 60);
        s.vy *= Math.pow(0.82, dt * 60);
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Arena constraints
      s.x = Math.max(25, Math.min(width - 25, s.x));

      if (s.role === 'shark') {
        // Shark is strictly trapped in deep water channel between buoy lines
        s.y = Math.max(this.northShoreY + 16, Math.min(this.southShoreY - 16, s.y));
      } else {
        // Minnow can swim freely between shores
        s.y = Math.max(30, Math.min(height - 30, s.y));

        // Check if reached destination safe shore!
        const reachedGoal = this.swimmingDirection === 'south_to_north'
          ? s.y <= this.northShoreY
          : s.y >= this.southShoreY;

        if (reachedGoal && !s.hasCrossed && this.waveState === 'swimming') {
          s.hasCrossed = true;
          s.score += 100;
          this.audio.playTone(523.25, 0.08, 'triangle');
          setTimeout(() => this.audio.playTone(783.99, 0.12, 'sine'), 70);
          this.particles.spawnExplosion(s.x, s.y, '#34D399', 16);
          this.particles.showFloatingText('+100 SAFE!', s.x, s.y - 12, '#34D399', 20);
        }
      }
    }

    // Update NPC Minnows
    for (const npc of this.npcMinnows) {
      if (!npc.isAlive || npc.hasCrossed) continue;

      if (this.waveState === 'swimming') {
        // Move towards target shore
        const dy = npc.targetY - npc.y;
        const dirY = Math.sign(dy);

        // Avoid sharks if nearby
        let fleeX = 0;
        let fleeY = 0;
        const allSharks = this.getAllActiveSharks();
        for (const shk of allSharks) {
          const distToShark = Math.hypot(npc.x - shk.x, npc.y - shk.y);
          if (distToShark < 95) {
            fleeX += (npc.x - shk.x) / (distToShark + 0.1);
            fleeY += (npc.y - shk.y) / (distToShark + 0.1);
          }
        }

        const vx = fleeX * 90 + (Math.sin(performance.now() * 0.005 + npc.id) * 35);
        const vy = dirY * npc.speed + fleeY * 50;

        npc.vx = vx;
        npc.vy = vy;
        npc.x += npc.vx * dt;
        npc.y += npc.vy * dt;
        npc.angle = Math.atan2(npc.vy, npc.vx);

        npc.x = Math.max(30, Math.min(width - 30, npc.x));

        // Check if NPC crossed safely
        const reachedGoal = this.swimmingDirection === 'south_to_north'
          ? npc.y <= this.northShoreY
          : npc.y >= this.southShoreY;

        if (reachedGoal) {
          npc.hasCrossed = true;
          this.particles.spawnSparks(npc.x, npc.y, '#38BDF8', 6);
        }
      }
    }

    // Check Shark chomping / tags against all swimming Minnows (Players + NPCs)
    const allSharks = this.getAllActiveSharks();
    for (const shk of allSharks) {
      const chompRadius = shk.isLunging ? 32 : 24;

      // 1. Check human/bot minnows
      for (const p of active) {
        const s = this.swimmers.get(p.id);
        if (!s || s.role !== 'minnow' || !s.isAlive || s.hasCrossed) continue;

        // Minnow is safe if in safe beach zones!
        const inDeepWater = s.y > this.northShoreY && s.y < this.southShoreY;
        if (!inDeepWater) continue;

        const dist = Math.hypot(s.x - shk.x, s.y - shk.y);
        if (dist < chompRadius + 14) {
          // CHOMP!
          s.isAlive = false;
          s.stunTimer = 1.0;
          this.audio.playExplosion();
          this.particles.shake(0.28);
          this.particles.spawnExplosion(s.x, s.y, '#EF4444', 22);
          this.particles.showFloatingText('🦈 CHOMP!', s.x, s.y - 14, '#EF4444', 22);

          // Award score to the shark
          if (shk.playerId !== null) {
            const sharkSwimmer = this.swimmers.get(shk.playerId);
            if (sharkSwimmer) sharkSwimmer.score += 150;
          }
        }
      }

      // 2. Check NPC minnows
      for (const npc of this.npcMinnows) {
        if (!npc.isAlive || npc.hasCrossed) continue;

        const inDeepWater = npc.y > this.northShoreY && npc.y < this.southShoreY;
        if (!inDeepWater) continue;

        const dist = Math.hypot(npc.x - shk.x, npc.y - shk.y);
        if (dist < chompRadius + 11) {
          npc.isAlive = false;
          this.audio.playBuzzer();
          this.particles.spawnExplosion(npc.x, npc.y, '#38BDF8', 16);
          this.particles.showFloatingText('+50 CATCH!', npc.x, npc.y - 10, '#FBBF24', 16);

          if (shk.playerId !== null) {
            const sharkSwimmer = this.swimmers.get(shk.playerId);
            if (sharkSwimmer) sharkSwimmer.score += 50;
          }
        }
      }
    }

    // Collect Sea Stars in the deep channel (Minnows only)
    for (const star of this.seaStars) {
      if (star.collected) continue;
      star.pulsePhase += dt * 3.5;

      for (const p of active) {
        const s = this.swimmers.get(p.id);
        if (!s || s.role !== 'minnow' || !s.isAlive || s.hasCrossed) continue;

        if (Math.hypot(s.x - star.x, s.y - star.y) < star.radius + 14) {
          star.collected = true;
          s.score += 25;
          this.audio.playTone(987.77, 0.08, 'sine');
          this.particles.spawnSparks(star.x, star.y, '#FACC15', 10);
          this.particles.showFloatingText('+25 STAR!', star.x, star.y - 12, '#FACC15', 16);
        }
      }
    }

    // Check if wave is complete:
    // Wave completes if all active minnows have either crossed or been caught, or waveTimer runs out
    if (this.waveState === 'swimming') {
      const activeMinnows = Array.from(this.swimmers.values()).filter(s => s.role === 'minnow');
      const allPlayerMinnowsDone = activeMinnows.every(s => !s.isAlive || s.hasCrossed);
      const allNpcsDone = this.npcMinnows.every(npc => !npc.isAlive || npc.hasCrossed);

      if ((allPlayerMinnowsDone && allNpcsDone) || this.waveTimer <= 0) {
        this.waveState = 'wave_cleared';
        this.announcementTimer = 2.0;

        const escapedCount = activeMinnows.filter(s => s.hasCrossed).length +
          this.npcMinnows.filter(n => n.hasCrossed).length;

        this.audio.playTone(659.25, 0.1, 'sine');
        setTimeout(() => this.audio.playTone(880, 0.15, 'triangle'), 100);
        this.particles.showFloatingText(
          `🌊 WAVE ${this.currentWave} COMPLETE! (${escapedCount} ESCAPED)`,
          width / 2,
          height / 2,
          '#38BDF8',
          22
        );
      }
    }
  }

  private getAllActiveSharks(): Array<{ x: number; y: number; isLunging: boolean; playerId: PlayerId | null }> {
    const list: Array<{ x: number; y: number; isLunging: boolean; playerId: PlayerId | null }> = [];
    for (const [id, s] of this.swimmers.entries()) {
      if (s.role === 'shark' && s.isAlive) {
        list.push({
          x: s.x,
          y: s.y,
          isLunging: s.lungeDuration > 0,
          playerId: id
        });
      }
    }
    if (this.helperShark) {
      list.push({
        x: this.helperShark.x,
        y: this.helperShark.y,
        isLunging: this.helperShark.lungeDuration > 0,
        playerId: null
      });
    }
    return list;
  }

  private updateHelperShark(dt: number, width: number, height: number): void {
    if (!this.helperShark) return;
    const hs = this.helperShark;

    if (hs.lungeCooldown > 0) hs.lungeCooldown -= dt;
    if (hs.lungeDuration > 0) hs.lungeDuration -= dt;

    if (this.waveState !== 'swimming') {
      // Idle patrol in center
      hs.vx = Math.sin(performance.now() * 0.002) * 110;
      hs.vy = Math.cos(performance.now() * 0.002) * 30;
      hs.x += hs.vx * dt;
      hs.y += hs.vy * dt;
      hs.angle = Math.atan2(hs.vy, hs.vx);
      return;
    }

    // Find nearest active minnow in deep channel
    let closestTarget: { x: number; y: number } | null = null;
    let closestDist = 99999;

    for (const s of this.swimmers.values()) {
      if (s.role === 'minnow' && s.isAlive && !s.hasCrossed && s.y > this.northShoreY && s.y < this.southShoreY) {
        const d = Math.hypot(s.x - hs.x, s.y - hs.y);
        if (d < closestDist) {
          closestDist = d;
          closestTarget = { x: s.x, y: s.y };
        }
      }
    }

    for (const npc of this.npcMinnows) {
      if (npc.isAlive && !npc.hasCrossed && npc.y > this.northShoreY && npc.y < this.southShoreY) {
        const d = Math.hypot(npc.x - hs.x, npc.y - hs.y);
        if (d < closestDist) {
          closestDist = d;
          closestTarget = { x: npc.x, y: npc.y };
        }
      }
    }

    let speed = 190;
    if (hs.lungeDuration > 0) speed = 330;

    if (closestTarget) {
      const dx = closestTarget.x - hs.x;
      const dy = closestTarget.y - hs.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 85 && hs.lungeCooldown <= 0) {
        hs.lungeDuration = 0.4;
        hs.lungeCooldown = 1.8;
      }

      if (dist > 5) {
        hs.vx = (dx / dist) * speed;
        hs.vy = (dy / dist) * speed;
        hs.angle = Math.atan2(dy, dx);
      }
    } else {
      // Horizontal sweeping patrol
      hs.vx = Math.sin(performance.now() * 0.003) * 160;
      hs.vy = 0;
      hs.angle = hs.vx > 0 ? 0 : Math.PI;
    }

    hs.x += hs.vx * dt;
    hs.y += hs.vy * dt;
    hs.x = Math.max(30, Math.min(width - 30, hs.x));
    hs.y = Math.max(this.northShoreY + 18, Math.min(this.southShoreY - 18, hs.y));
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const s = this.swimmers.get(botId);
    if (!s || !s.isAlive || s.hasCrossed || s.stunTimer > 0) return;

    if (s.role === 'shark') {
      // Bot Shark Logic
      const allMinnows: Array<{ x: number; y: number; isHuman: boolean }> = [];
      for (const [id, pl] of this.swimmers.entries()) {
        if (pl.role === 'minnow' && pl.isAlive && !pl.hasCrossed && pl.y > this.northShoreY && pl.y < this.southShoreY) {
          const cfg = this.getPlayer(id);
          allMinnows.push({ x: pl.x, y: pl.y, isHuman: !cfg?.type.startsWith('bot_') });
        }
      }
      for (const npc of this.npcMinnows) {
        if (npc.isAlive && !npc.hasCrossed && npc.y > this.northShoreY && npc.y < this.southShoreY) {
          allMinnows.push({ x: npc.x, y: npc.y, isHuman: false });
        }
      }

      if (allMinnows.length === 0) {
        // Sweep horizontally
        const steer = Math.sin(performance.now() * 0.002) > 0 ? 1 : -1;
        this.input.setBotInput(botId, true, steer, 0, false);
        return;
      }

      // Prioritize human minnow in Hard mode, or closest minnow in Normal/Easy
      let target = allMinnows[0];
      let bestDist = 99999;
      for (const m of allMinnows) {
        const d = Math.hypot(m.x - s.x, m.y - s.y);
        const weight = (difficulty === 'bot_hard' && m.isHuman) ? 0.6 : 1.0;
        if (d * weight < bestDist) {
          bestDist = d * weight;
          target = m;
        }
      }

      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const dist = Math.hypot(dx, dy);

      const steer = Math.abs(dx) > 10 ? Math.sign(dx) : 0;
      // Invert dy for throttle: negative dy is UP (throttle +1), positive dy is DOWN (throttle -1)
      const throttle = Math.abs(dy) > 10 ? -Math.sign(dy) : 0;

      const shouldLunge = (difficulty !== 'bot_easy' && dist < 85 && s.lungeCooldown <= 0);
      this.input.setBotInput(botId, true, steer, throttle, shouldLunge);
    } else {
      // Bot Minnow Logic
      const targetY = this.swimmingDirection === 'south_to_north'
        ? this.northShoreY - 30
        : this.southShoreY + 30;

      const dy = targetY - s.y;
      let throttle = -Math.sign(dy); // +1 up, -1 down
      let steer = 0;
      let shouldDash = false;

      // Check nearby sharks
      const sharks = this.getAllActiveSharks();
      let dangerShark: { x: number; y: number; dist: number } | null = null;
      for (const shk of sharks) {
        const d = Math.hypot(shk.x - s.x, shk.y - s.y);
        if (d < 120 && (!dangerShark || d < dangerShark.dist)) {
          dangerShark = { x: shk.x, y: shk.y, dist: d };
        }
      }

      if (dangerShark) {
        // Juke sideways away from the shark
        steer = s.x < dangerShark.x ? -1 : 1;

        if (dangerShark.dist < 75 && s.dashCooldown <= 0 && difficulty !== 'bot_easy') {
          shouldDash = true;
        }
      } else {
        // Slight natural oscillation
        steer = Math.sin(performance.now() * 0.003 + s.id) * 0.35;
      }

      this.input.setBotInput(botId, true, steer, throttle, shouldDash);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const now = performance.now() * 0.001;

    // 1. Deep Ocean Center Background
    const oceanGrad = ctx.createLinearGradient(0, this.northShoreY, 0, this.southShoreY);
    oceanGrad.addColorStop(0, '#0284C7'); // Cyan/Cerulean
    oceanGrad.addColorStop(0.5, '#0369A1'); // Deep oceanic blue
    oceanGrad.addColorStop(1, '#0284C7');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Animated Caustics & Water Ripple Waves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    for (let r = 0; r < 5; r++) {
      const yWave = this.northShoreY + ((r + 1) * (this.southShoreY - this.northShoreY)) / 6;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 30) {
        const yOffset = Math.sin(x * 0.02 + now * 2.0 + r) * 6;
        if (x === 0) ctx.moveTo(x, yWave + yOffset);
        else ctx.lineTo(x, yWave + yOffset);
      }
      ctx.stroke();
    }

    // 3. Sandy Safe Beaches (North & South Shores)
    // North Shore (Top)
    const sandGradTop = ctx.createLinearGradient(0, 0, 0, this.northShoreY);
    sandGradTop.addColorStop(0, '#FDE047');
    sandGradTop.addColorStop(0.7, '#FEF08A');
    sandGradTop.addColorStop(1, '#38BDF8');
    ctx.fillStyle = sandGradTop;
    ctx.fillRect(0, 0, width, this.northShoreY);

    // South Shore (Bottom)
    const sandGradBottom = ctx.createLinearGradient(0, this.southShoreY, 0, height);
    sandGradBottom.addColorStop(0, '#38BDF8');
    sandGradBottom.addColorStop(0.3, '#FEF08A');
    sandGradBottom.addColorStop(1, '#FDE047');
    ctx.fillStyle = sandGradBottom;
    ctx.fillRect(0, this.southShoreY, width, height - this.southShoreY);

    // Shoreline Sand Textures & Shells
    ctx.fillStyle = '#CA8A04';
    ctx.font = '900 10px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏖️ NORTH SAFE HAVEN 🏖️', width / 2, this.northShoreY - 14);
    ctx.fillText('🏖️ SOUTH SAFE HAVEN 🏖️', width / 2, this.southShoreY + 24);

    // 4. Floating Buoy Barrier Lines separating deep water from safe shores
    this.renderBuoyLine(ctx, width, this.northShoreY, now);
    this.renderBuoyLine(ctx, width, this.southShoreY, now + 1.2);

    // 5. Render Collectible Sea Stars
    for (const star of this.seaStars) {
      if (star.collected) continue;
      const pulse = 1.0 + Math.sin(star.pulsePhase) * 0.15;
      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.scale(pulse, pulse);

      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#F59E0B';
      this.drawStar(ctx, 0, 0, 5, star.radius, star.radius * 0.45);
      ctx.fill();

      ctx.fillStyle = '#FEF08A';
      this.drawStar(ctx, 0, 0, 5, star.radius * 0.6, star.radius * 0.25);
      ctx.fill();
      ctx.restore();
    }

    // 6. Render NPC Minnows
    for (const npc of this.npcMinnows) {
      if (!npc.isAlive) continue;
      this.drawMinnowFish(ctx, npc.x, npc.y, npc.angle, npc.color, 11, now + npc.id);
    }

    // 7. Render Helper Shark if present
    if (this.helperShark) {
      const hs = this.helperShark;
      this.drawSharkCreature(ctx, hs.x, hs.y, hs.angle, '#1E293B', '#0EA5E9', 28, hs.lungeDuration > 0, now);
    }

    // 8. Render Players (Minnows or Sharks)
    const active = this.getActivePlayers();
    for (const p of active) {
      const s = this.swimmers.get(p.id);
      if (!s) continue;

      ctx.save();

      if (s.role === 'shark') {
        // Player is Apex Shark
        this.drawSharkCreature(ctx, s.x, s.y, s.angle, p.color, '#FFFFFF', 30, s.lungeDuration > 0, now);
      } else {
        // Player is Minnow
        if (s.isAlive) {
          this.drawMinnowFish(ctx, s.x, s.y, s.angle, p.color, 14, now + p.id);
          this.drawPlayerMascot(ctx, p.id, s.x, s.y, 11, s.stunTimer > 0 ? 'shocked' : 'happy', now);
        } else {
          // Chomped minnow ghost bubble
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }
      }

      // Name tag & role icon
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10.5px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const roleIcon = s.role === 'shark' ? '🦈' : '🐟';
      ctx.fillText(`${roleIcon} ${p.name}`, s.x, s.y - (s.role === 'shark' ? 26 : 20));

      ctx.restore();
    }

    // 9. Floating Announcement Banner (e.g. "FISHY FISHY CROSS MY OCEAN!")
    if (this.waveState === 'announcing') {
      ctx.save();
      const bannerW = 440;
      const bannerH = 46;
      const bx = width / 2 - bannerW / 2;
      const by = height / 2 - bannerH / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bannerW, bannerH, 12);
      else ctx.rect(bx, by, bannerW, bannerH);
      ctx.fill();
      ctx.stroke();

      ctx.font = '900 17px Montserrat, sans-serif';
      ctx.fillStyle = '#FDE047';
      ctx.textAlign = 'center';
      ctx.fillText('📣 "FISHY FISHY, CROSS MY OCEAN!"', width / 2, by + 28);
      ctx.restore();
    }

    // 10. Top HUD Status Pod
    const hudW = 340;
    const hudH = 28;
    const hudX = width / 2 - hudW / 2;
    const hudY = 12;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hudX, hudY, hudW, hudH, 14);
    else ctx.rect(hudX, hudY, hudW, hudH);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 11.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    const pScores = active.map(p => `${p.name}: ${this.swimmers.get(p.id)?.score || 0}`).join('  •  ');
    ctx.fillText(`WAVE ${this.currentWave}/3  │  ${pScores}`, width / 2, hudY + 18);
    ctx.restore();

    // 11. Bottom Controls & Role Guide Banner
    const botW = Math.min(width - 32, 540);
    const botH = 26;
    const botX = width / 2 - botW / 2;
    const botY = height - 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(botX, botY, botW, botH, 12);
    else ctx.rect(botX, botY, botW, botH);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 10.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94A3B8';
    const p1 = active[0];
    const p2 = active[1];
    const p1Role = p1 ? (this.swimmers.get(p1.id)?.role === 'shark' ? '🦈 SHARK' : '🐟 MINNOW') : '';
    const p2Role = p2 ? (this.swimmers.get(p2.id)?.role === 'shark' ? '🦈 SHARK' : '🐟 MINNOW') : '';
    ctx.fillText(`P1: [WASD] Move • [SPACE] Dash (${p1Role})   │   P2: [ARROWS] • [ENTER] (${p2Role})`, width / 2, botY + 17);
    ctx.restore();
  }

  private renderBuoyLine(ctx: CanvasRenderingContext2D, width: number, y: number, time: number): void {
    ctx.save();
    // Connecting buoyant rope
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += 25) {
      const bobY = y + Math.sin(x * 0.04 + time * 3.0) * 3;
      ctx.lineTo(x, bobY);
    }
    ctx.stroke();

    // Floating buoys (red and white floats)
    const buoySpacing = 42;
    for (let bx = 20; bx < width; bx += buoySpacing) {
      const by = y + Math.sin(bx * 0.04 + time * 3.0) * 3;
      ctx.fillStyle = (Math.floor(bx / buoySpacing) % 2 === 0) ? '#EF4444' : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMinnowFish(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    color: string,
    size: number,
    time: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Wiggling tail fin
    const tailWiggle = Math.sin(time * 16) * 0.35;
    ctx.save();
    ctx.translate(-size * 0.9, 0);
    ctx.rotate(tailWiggle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size * 0.7, -size * 0.45);
    ctx.lineTo(-size * 0.7, size * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Sleek streamlined minnow body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(size * 0.5, -size * 0.18, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(size * 0.58, -size * 0.18, size * 0.11, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawSharkCreature(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    bodyColor: string,
    bellyColor: string,
    size: number,
    isLunging: boolean,
    time: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Powerful caudal tail fin
    const tailAngle = Math.sin(time * 12) * 0.3;
    ctx.save();
    ctx.translate(-size * 1.0, 0);
    ctx.rotate(tailAngle);
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size * 0.8, -size * 0.7);
    ctx.lineTo(-size * 0.5, 0);
    ctx.lineTo(-size * 0.8, size * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Heavy torpedo shark body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.1, size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Light belly underside
    ctx.fillStyle = bellyColor;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.18, size * 0.95, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Menacing Dorsal Fin
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(-size * 0.2, 0);
    ctx.lineTo(-size * 0.1, -size * 0.85);
    ctx.lineTo(size * 0.25, 0);
    ctx.closePath();
    ctx.fill();

    // Pectoral flipper fins
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, size * 0.3);
    ctx.lineTo(size * 0.1, size * 0.85);
    ctx.lineTo(size * 0.25, size * 0.3);
    ctx.closePath();
    ctx.fill();

    // Fierce Eyes
    ctx.fillStyle = '#F87171';
    ctx.beginPath();
    ctx.arc(size * 0.7, -size * 0.18, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(size * 0.73, -size * 0.18, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Open Jaws with Sharp Teeth when Lunging!
    if (isLunging) {
      ctx.fillStyle = '#991B1B'; // Mouth cavity
      ctx.beginPath();
      ctx.arc(size * 0.9, 0, size * 0.35, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();

      // Sharp white teeth
      ctx.fillStyle = '#FFFFFF';
      for (let t = -3; t <= 3; t++) {
        const ty = (t / 3) * size * 0.28;
        ctx.beginPath();
        ctx.moveTo(size * 0.9, ty - 2);
        ctx.lineTo(size * 1.15, ty);
        ctx.lineTo(size * 0.9, ty + 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawStar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    spikes: number,
    outerR: number,
    innerR: number
  ): void {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerR;
      y = cy + Math.sin(rot) * outerR;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    let highestScore = -1;
    let winnerId: PlayerId | null = null;

    active.forEach((p) => {
      const s = this.swimmers.get(p.id);
      const score = s?.score || 0;
      if (score > highestScore) {
        highestScore = score;
        winnerId = p.id;
      }
    });

    const sorted = [...active].sort((a, b) => {
      const scA = this.swimmers.get(a.id)?.score || 0;
      const scB = this.swimmers.get(b.id)?.score || 0;
      return scB - scA;
    });

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.swimmers.get(p.id)?.score || 0
    }));

    const winnerName = winnerId !== null ? this.players[winnerId].name : 'The Ocean';

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${winnerName} dominated Sharks & Minnows with ${highestScore} points!`
        : 'The oceanic depths claimed all swimmers in a thrilling draw!'
    };
  }
}
