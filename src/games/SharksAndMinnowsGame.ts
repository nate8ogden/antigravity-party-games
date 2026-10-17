import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type CreatureRole = 'minnow' | 'shark';
export type SharksGameMode = 'last_fish_standing' | 'shark_numbers_increase' | 'permanent_sharks' | 'classic_crossing';

interface Swimmer {
  id: PlayerId;
  role: CreatureRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  isAlive: boolean;    // false if chomped during wave
  hasCrossed: boolean; // true if reached safe shore this wave
  dashCooldown: number;
  dashDuration: number;
  lungeCooldown: number;
  lungeDuration: number;
  stunTimer: number;
  crossStreak: number;
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

interface PredatorShark {
  id: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  lungeCooldown: number;
  lungeDuration: number;
  color: string;
  bellyColor: string;
  size: number;
  speed: number;
}

export class SharksAndMinnowsGame extends BaseGame {
  public gameMode: SharksGameMode = 'classic_crossing';
  private swimmers: Map<PlayerId, Swimmer> = new Map();
  private npcMinnows: NpcMinnow[] = [];
  private seaStars: SeaStar[] = [];
  private helperSharks: PredatorShark[] = [];

  private currentWave: number = 1;
  private maxWaves: number = 4;
  private waveTimer: number = 16.0;
  private waveState: 'announcing' | 'swimming' | 'wave_cleared' = 'announcing';
  private announcementTimer: number = 1.0;

  // Ocean zones
  private northShoreY: number = 115;
  private southShoreY: number = 485;
  private swimmingDirection: 'north_to_south' | 'south_to_north' = 'south_to_north';

  private pointerHandler: ((e: PointerEvent) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private animTimer: number = 0;

  private modeDescriptions: Record<SharksGameMode, { title: string; subtitle: string; icon: string }> = {
    last_fish_standing: {
      title: 'LAST FISH STANDING',
      subtitle: 'Chomped Minnows Turn into Sharks! Last Survivor Wins!',
      icon: '🦈'
    },
    shark_numbers_increase: {
      title: 'SHARK SWARM ESCALATION',
      subtitle: 'Predator pack multiplies each wave! Survive the frenzy!',
      icon: '🌊'
    },
    permanent_sharks: {
      title: 'PERMANENT APEX HUNTERS',
      subtitle: 'Permanent Sharks hunt fleeing Minnows! Continuous score duel!',
      icon: '👑'
    },
    classic_crossing: {
      title: 'CLASSIC REEF CROSSING',
      subtitle: 'Alternate roles each wave & harvest golden sea stars!',
      icon: '⭐'
    }
  };

  private modeList: SharksGameMode[] = [
    'last_fish_standing',
    'shark_numbers_increase',
    'permanent_sharks',
    'classic_crossing'
  ];

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    if (typeof window !== 'undefined' && (window as unknown as { __SHARKS_AND_MINNOWS_DEBUG__?: unknown }).__SHARKS_AND_MINNOWS_DEBUG__) {
      delete (window as unknown as { __SHARKS_AND_MINNOWS_DEBUG__?: unknown }).__SHARKS_AND_MINNOWS_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    // Mode cycle key [M]
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        this.cycleMode();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    // Click on bottom-left mode pill
    this.pointerHandler = (e: PointerEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Bottom-left mode pill: x: 20, y: height - 44, w: 380, h: 32
      if (clickX >= 20 && clickX <= 400 && clickY >= rect.height - 48 && clickY <= rect.height - 10) {
        this.cycleMode();
      }
    };
    window.addEventListener('pointerdown', this.pointerHandler);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.pointerHandler) {
      window.removeEventListener('pointerdown', this.pointerHandler);
      this.pointerHandler = null;
    }
  }

  public cycleMode(): void {
    const curIdx = this.modeList.indexOf(this.gameMode);
    const nextIdx = (curIdx + 1) % this.modeList.length;
    this.gameMode = this.modeList[nextIdx];
    this.audio.playTone(587.33, 0.08, 'triangle');
    setTimeout(() => this.audio.playTone(880, 0.12, 'sine'), 80);
    this.particles.showFloatingText(
      `MODE: ${this.modeDescriptions[this.gameMode].title}!`,
      400,
      300,
      '#FACC15',
      24
    );
    this.reset(800, 600);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 55.0;
    this.isFinished = false;
    this.currentWave = 1;
    this.maxWaves = this.gameMode === 'shark_numbers_increase' ? 4 : 3;
    this.swimmers.clear();
    this.npcMinnows = [];
    this.seaStars = [];
    this.helperSharks = [];
    this.animTimer = 0;

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
        stunTimer: 0,
        crossStreak: 0
      });
    });

    this.startWave(this.currentWave, width, height);

    if (typeof window !== 'undefined') {
      (window as unknown as { __SHARKS_AND_MINNOWS_DEBUG__?: unknown }).__SHARKS_AND_MINNOWS_DEBUG__ = {
        game: this,
        getMode: () => this.gameMode,
        setMode: (m: SharksGameMode) => { this.gameMode = m; this.reset(width, height); },
        getWave: () => this.currentWave,
        getWaveState: () => this.waveState,
        getSwimmer: (id: PlayerId) => this.swimmers.get(id),
        getNpcMinnows: () => this.npcMinnows,
        getSeaStars: () => this.seaStars,
        getHelperSharks: () => this.helperSharks,
        setPlayerPos: (id: PlayerId, x: number, y: number) => {
          const s = this.swimmers.get(id);
          if (s) {
            s.x = x;
            s.y = y;
          }
        },
        triggerLunge: (id: PlayerId) => {
          const s = this.swimmers.get(id);
          if (s) {
            s.lungeDuration = 0.40;
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
    this.announcementTimer = 1.0;

    // Alternate crossing direction each wave
    this.swimmingDirection = waveNum % 2 === 1 ? 'south_to_north' : 'north_to_south';

    const active = this.getActivePlayers();
    const count = active.length;

    // 1. Role Assignment per Game Mode
    if (this.gameMode === 'last_fish_standing') {
      // In Wave 1, player 1 (or bot) starts as original shark; others are minnows
      // In subsequent waves, minnows keep their transformed shark role!
      if (waveNum === 1) {
        const initialSharkId = count >= 2 ? active[1].id : null;
        active.forEach((p) => {
          const s = this.swimmers.get(p.id);
          if (s) {
            s.role = (p.id === initialSharkId) ? 'shark' : 'minnow';
          }
        });
      }
    } else if (this.gameMode === 'shark_numbers_increase') {
      // All human players start as Minnows working together to survive the growing predator swarm!
      // In 2P, player 1 can be Shark while AI sharks assist!
      active.forEach((p, idx) => {
        const s = this.swimmers.get(p.id);
        if (s) {
          s.role = (idx === 1 && count >= 2) ? 'shark' : 'minnow';
        }
      });
    } else if (this.gameMode === 'permanent_sharks') {
      // Player 1 (or second player) is permanently the Shark for all waves
      active.forEach((p, idx) => {
        const s = this.swimmers.get(p.id);
        if (s) {
          s.role = (idx === 1 && count >= 2) ? 'shark' : 'minnow';
        }
      });
    } else {
      // Classic Crossing: Alternate roles
      active.forEach((p, idx) => {
        const s = this.swimmers.get(p.id);
        if (s) {
          if (waveNum === 1) s.role = (idx === 1) ? 'shark' : 'minnow';
          else if (waveNum === 2) s.role = (idx === 0) ? 'shark' : 'minnow';
          else s.role = 'minnow';
        }
      });
    }

    const startBankY = this.swimmingDirection === 'south_to_north'
      ? this.southShoreY + 45
      : this.northShoreY - 45;

    const startAngle = this.swimmingDirection === 'south_to_north' ? -Math.PI / 2 : Math.PI / 2;

    active.forEach((p, idx) => {
      const s = this.swimmers.get(p.id);
      if (!s) return;

      s.isAlive = true;
      s.hasCrossed = false;
      s.dashCooldown = 0;
      s.dashDuration = 0;
      s.lungeCooldown = 0;
      s.lungeDuration = 0;
      s.stunTimer = 0;
      s.vx = 0;
      s.vy = 0;

      if (s.role === 'shark') {
        // Deep water channel center
        s.x = width * 0.45 + (idx % 2 === 0 ? -40 : 40);
        s.y = (this.northShoreY + this.southShoreY) / 2;
        s.angle = 0;
      } else {
        // Starting safe shore
        const slotX = width * 0.22 + (idx * width * 0.56) / Math.max(1, count - 1);
        s.x = Math.max(60, Math.min(width - 60, slotX));
        s.y = startBankY;
        s.angle = startAngle;
      }
    });

    // 2. Spawn Predator Sharks according to Mode & Wave
    this.helperSharks = [];
    const activeSharkCount = Array.from(this.swimmers.values()).filter(s => s.role === 'shark').length;

    if (this.gameMode === 'shark_numbers_increase') {
      // Wave 1: 1 predator; Wave 2: 2 predators; Wave 3: 3 predators; Wave 4: 4 predators (including Megalodon!)
      const targetPredatorCount = waveNum;
      const needAiSharks = Math.max(0, targetPredatorCount - activeSharkCount);

      const sharkProfiles = [
        { name: 'Hammerhead', color: '#334155', belly: '#94A3B8', size: 28, speed: 195 },
        { name: 'Tiger Shark', color: '#1E293B', belly: '#38BDF8', size: 32, speed: 215 },
        { name: 'Great White', color: '#0F172A', belly: '#E2E8F0', size: 36, speed: 235 },
        { name: 'MEGALODON', color: '#7F1D1D', belly: '#FCA5A5', size: 44, speed: 250 }
      ];

      for (let i = 0; i < needAiSharks; i++) {
        const prof = sharkProfiles[i % sharkProfiles.length];
        this.helperSharks.push({
          id: i,
          name: prof.name,
          x: width * 0.2 + (i * width * 0.6) / Math.max(1, needAiSharks),
          y: (this.northShoreY + this.southShoreY) / 2 + (i % 2 === 0 ? -30 : 30),
          vx: 0,
          vy: 0,
          angle: 0,
          lungeCooldown: 0,
          lungeDuration: 0,
          color: prof.color,
          bellyColor: prof.belly,
          size: prof.size,
          speed: prof.speed
        });
      }
    } else {
      // If no human shark (solo play), spawn 1 Apex AI shark
      if (activeSharkCount === 0) {
        this.helperSharks.push({
          id: 0,
          name: 'Apex White',
          x: width * 0.5,
          y: (this.northShoreY + this.southShoreY) / 2,
          vx: 0,
          vy: 0,
          angle: 0,
          lungeCooldown: 0,
          lungeDuration: 0,
          color: '#1E293B',
          bellyColor: '#0EA5E9',
          size: 30,
          speed: 200
        });
      }
    }

    // 3. Spawn School of NPC Minnows
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
        speed: 160 + Math.random() * 35,
        targetY,
        jukeTimer: 0
      });
    }

    // 4. Spawn Collectible Sea Stars in the deep ocean
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

    // Whistle sound for wave launch
    this.audio.playTone(880, 0.08, 'triangle');
    setTimeout(() => this.audio.playTone(1174.66, 0.12, 'sine'), 90);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    this.animTimer += dt;

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    // Announcement countdown
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
        // In Last Fish Standing mode: check if only 1 or 0 minnows remain
        if (this.gameMode === 'last_fish_standing') {
          const livingMinnows = Array.from(this.swimmers.values()).filter(s => s.role === 'minnow');
          if (livingMinnows.length <= 1) {
            // Crown the final survivor!
            if (livingMinnows.length === 1) {
              livingMinnows[0].score += 500;
              this.particles.showFloatingText('👑 FINAL MINNOW STANDING! +500', width / 2, height / 2 - 40, '#FACC15', 28);
            }
            this.isFinished = true;
            return;
          }
        }

        if (this.currentWave >= this.maxWaves) {
          this.isFinished = true;
        } else {
          this.startWave(this.currentWave + 1, width, height);
        }
      }
      return;
    }

    // Update Bots
    this.updateBots(dt, width, height);

    // Update Helper Sharks
    for (const hs of this.helperSharks) {
      this.updatePredatorShark(hs, dt, width, height);
    }

    // Update Swimmers (Players)
    const active = this.getActivePlayers();
    for (const p of active) {
      const s = this.swimmers.get(p.id);
      if (!s) continue;

      if (s.stunTimer > 0) s.stunTimer -= dt;
      if (s.dashCooldown > 0) s.dashCooldown -= dt;
      if (s.dashDuration > 0) s.dashDuration -= dt;
      if (s.lungeCooldown > 0) s.lungeCooldown -= dt;
      if (s.lungeDuration > 0) s.lungeDuration -= dt;

      if (!s.isAlive || s.hasCrossed) {
        s.vx *= Math.pow(0.85, dt * 60);
        s.vy *= Math.pow(0.85, dt * 60);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        continue;
      }

      // Input handling (Directional + 1-Button)
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isPressed = this.input.isPressed(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.justAction(p.id);

      // Dash (Minnow) or Lunge (Shark)
      if (s.role === 'minnow') {
        if ((isAction || (isPressed && Math.hypot(steer, throttle) === 0)) && s.dashCooldown <= 0 && s.stunTimer <= 0) {
          s.dashDuration = 0.35;
          s.dashCooldown = 1.4;
          this.audio.playTone(740, 0.08, 'sine');
          this.particles.spawnSparks(s.x, s.y, '#38BDF8', 8);
        }
      } else if (s.role === 'shark') {
        if (isAction && s.lungeCooldown <= 0 && s.stunTimer <= 0) {
          s.lungeDuration = 0.40;
          s.lungeCooldown = 1.6;
          this.audio.playTone(320, 0.12, 'sawtooth');
          this.particles.spawnSparks(s.x, s.y, '#EF4444', 12);
        }
      }

      let speed = s.role === 'shark' ? 200 : 185;
      if (s.dashDuration > 0) speed = 330;
      if (s.lungeDuration > 0) speed = 350;

      const inputMag = Math.hypot(steer, -throttle);
      if (inputMag > 0.15 && this.waveState !== 'announcing') {
        const normX = steer / inputMag;
        const normY = -throttle / inputMag;
        s.vx = normX * speed;
        s.vy = normY * speed;
        s.angle = Math.atan2(normY, normX);

        if (Math.random() < 0.26) {
          this.particles.spawnSparks(s.x, s.y, s.role === 'shark' ? '#93C5FD' : '#E0F2FE', 2);
        }
      } else if (isPressed && this.waveState !== 'announcing') {
        // 1-Button: HOLD propels in current heading
        s.vx = Math.cos(s.angle) * speed;
        s.vy = Math.sin(s.angle) * speed;
      } else {
        // Natural water drag
        s.vx *= Math.pow(0.82, dt * 60);
        s.vy *= Math.pow(0.82, dt * 60);

        // 1-Button weave turn when released
        if (inputMag <= 0.15 && !p.type.startsWith('bot_')) {
          s.angle += dt * 2.2;
        }
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.x = Math.max(25, Math.min(width - 25, s.x));

      if (s.role === 'shark') {
        // Trapped in deep water channel
        s.y = Math.max(this.northShoreY + 16, Math.min(this.southShoreY - 16, s.y));
      } else {
        s.y = Math.max(30, Math.min(height - 30, s.y));

        // Reached destination shore
        const reachedGoal = this.swimmingDirection === 'south_to_north'
          ? s.y <= this.northShoreY
          : s.y >= this.southShoreY;

        if (reachedGoal && !s.hasCrossed && this.waveState === 'swimming') {
          s.hasCrossed = true;
          s.crossStreak++;
          const streakBonus = (s.crossStreak - 1) * 25;
          const points = 100 + streakBonus;
          s.score += points;

          this.audio.playTone(523.25, 0.08, 'triangle');
          setTimeout(() => this.audio.playTone(783.99, 0.12, 'sine'), 70);
          this.particles.spawnExplosion(s.x, s.y, '#34D399', 16);
          this.particles.showFloatingText(`+${points} SAFE!`, s.x, s.y - 12, '#34D399', 20);
        }
      }
    }

    // Update NPC Minnows
    for (const npc of this.npcMinnows) {
      if (!npc.isAlive || npc.hasCrossed) continue;

      if (this.waveState === 'swimming') {
        const dy = npc.targetY - npc.y;
        const dirY = Math.sign(dy);

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

        const reachedGoal = this.swimmingDirection === 'south_to_north'
          ? npc.y <= this.northShoreY
          : npc.y >= this.southShoreY;

        if (reachedGoal) {
          npc.hasCrossed = true;
          this.particles.spawnSparks(npc.x, npc.y, '#38BDF8', 6);
        }
      }
    }

    // Check Shark Chomps / Infiltration
    const allSharks = this.getAllActiveSharks();
    for (const shk of allSharks) {
      const chompRadius = shk.isLunging ? 34 : 25;

      // 1. Check Player Minnows
      for (const p of active) {
        const s = this.swimmers.get(p.id);
        if (!s || s.role !== 'minnow' || !s.isAlive || s.hasCrossed) continue;

        const inDeepWater = s.y > this.northShoreY && s.y < this.southShoreY;
        if (!inDeepWater) continue;

        const dist = Math.hypot(s.x - shk.x, s.y - shk.y);
        if (dist < chompRadius + 14) {
          // CHOMPED!
          s.stunTimer = 1.0;
          this.audio.playExplosion();
          this.particles.shake(6);
          this.particles.spawnExplosion(s.x, s.y, '#EF4444', 24);

          if (this.gameMode === 'last_fish_standing') {
            // INFECTION: Minnow turns into a Shark!
            s.role = 'shark';
            s.isAlive = true;
            s.hasCrossed = false;
            s.score = Math.max(0, s.score - 20);
            this.particles.showFloatingText('🦈 TURNED INTO SHARK!', s.x, s.y - 18, '#EF4444', 24);
          } else {
            s.isAlive = false;
            this.particles.showFloatingText('🦈 CHOMP!', s.x, s.y - 14, '#EF4444', 22);
          }

          // Award score to the attacking shark
          if (shk.playerId !== null) {
            const sharkSwimmer = this.swimmers.get(shk.playerId);
            if (sharkSwimmer) sharkSwimmer.score += 150;
          }
        }
      }

      // 2. Check NPC Minnows
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

    // Collect Sea Stars
    for (const star of this.seaStars) {
      if (star.collected) continue;
      star.pulsePhase += dt * 3.5;

      for (const p of active) {
        const s = this.swimmers.get(p.id);
        if (!s || s.role !== 'minnow' || !s.isAlive || s.hasCrossed) continue;

        if (Math.hypot(s.x - star.x, s.y - star.y) < star.radius + 14) {
          star.collected = true;
          s.score += 35;
          this.audio.playTone(987.77, 0.08, 'sine');
          this.particles.spawnSparks(star.x, star.y, '#FACC15', 10);
          this.particles.showFloatingText('+35 STAR! ⭐', star.x, star.y - 12, '#FACC15', 18);
        }
      }
    }

    // Wave Completion Check
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

  private updatePredatorShark(hs: PredatorShark, dt: number, width: number, height: number): void {
    if (hs.lungeCooldown > 0) hs.lungeCooldown -= dt;
    if (hs.lungeDuration > 0) hs.lungeDuration -= dt;

    if (this.waveState !== 'swimming') {
      hs.vx = Math.sin(this.animTimer * 2 + hs.id) * 120;
      hs.vy = Math.cos(this.animTimer * 2 + hs.id) * 30;
      hs.x += hs.vx * dt;
      hs.y += hs.vy * dt;
      hs.angle = Math.atan2(hs.vy, hs.vx);
      return;
    }

    // Target closest minnow in deep water
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

    let speed = hs.speed;
    if (hs.lungeDuration > 0) speed *= 1.6;

    if (closestTarget) {
      const dx = closestTarget.x - hs.x;
      const dy = closestTarget.y - hs.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 90 && hs.lungeCooldown <= 0) {
        hs.lungeDuration = 0.45;
        hs.lungeCooldown = 2.0;
      }

      if (dist > 5) {
        hs.vx = (dx / dist) * speed;
        hs.vy = (dy / dist) * speed;
        hs.angle = Math.atan2(dy, dx);
      }
    } else {
      hs.vx = Math.sin(this.animTimer * 2 + hs.id) * 160;
      hs.vy = 0;
      hs.angle = hs.vx > 0 ? 0 : Math.PI;
    }

    hs.x += hs.vx * dt;
    hs.y += hs.vy * dt;
    hs.x = Math.max(35, Math.min(width - 35, hs.x));
    hs.y = Math.max(this.northShoreY + 20, Math.min(this.southShoreY - 20, hs.y));
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
    for (const hs of this.helperSharks) {
      list.push({
        x: hs.x,
        y: hs.y,
        isLunging: hs.lungeDuration > 0,
        playerId: null
      });
    }
    return list;
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
        const steer = Math.sin(this.animTimer * 2) > 0 ? 1 : -1;
        this.input.setBotInput(botId, true, steer, 0, false);
        return;
      }

      let target = allMinnows[0];
      let bestDist = 99999;
      for (const m of allMinnows) {
        const d = Math.hypot(m.x - s.x, m.y - s.y);
        const weight = (difficulty === 'bot_hard' && m.isHuman) ? 0.65 : 1.0;
        if (d * weight < bestDist) {
          bestDist = d * weight;
          target = m;
        }
      }

      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const dist = Math.hypot(dx, dy);

      const steer = Math.abs(dx) > 10 ? Math.sign(dx) : 0;
      const throttle = Math.abs(dy) > 10 ? -Math.sign(dy) : 0;
      const shouldLunge = (difficulty !== 'bot_easy' && dist < 85 && s.lungeCooldown <= 0);

      this.input.setBotInput(botId, true, steer, throttle, shouldLunge);
    } else {
      // Minnow logic
      const targetY = this.swimmingDirection === 'south_to_north'
        ? this.northShoreY - 30
        : this.southShoreY + 30;

      const dy = targetY - s.y;
      let throttle = -Math.sign(dy);
      let steer = 0;
      let shouldDash = false;

      const sharks = this.getAllActiveSharks();
      let dangerShark: { x: number; y: number; dist: number } | null = null;
      for (const shk of sharks) {
        const d = Math.hypot(shk.x - s.x, shk.y - s.y);
        if (d < 120 && (!dangerShark || d < dangerShark.dist)) {
          dangerShark = { x: shk.x, y: shk.y, dist: d };
        }
      }

      if (dangerShark) {
        steer = s.x < dangerShark.x ? -1 : 1;
        if (dangerShark.dist < 75 && s.dashCooldown <= 0 && difficulty !== 'bot_easy') {
          shouldDash = true;
        }
      } else {
        steer = Math.sin(this.animTimer * 2 + s.id) * 0.35;
      }

      this.input.setBotInput(botId, true, steer, throttle, shouldDash);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const now = performance.now() * 0.001;

    // 1. Deep Ocean Background
    const oceanGrad = ctx.createLinearGradient(0, this.northShoreY, 0, this.southShoreY);
    oceanGrad.addColorStop(0, '#0284C7');
    oceanGrad.addColorStop(0.5, '#0369A1');
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

    // 3. Sandy Safe Beaches
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

    // Beach Titles
    ctx.fillStyle = '#CA8A04';
    ctx.font = '900 10.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏖️ NORTH SAFE HAVEN 🏖️', width / 2, this.northShoreY - 14);
    ctx.fillText('🏖️ SOUTH SAFE HAVEN 🏖️', width / 2, this.southShoreY + 24);

    // 4. Floating Buoy Barrier Lines
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

    // 7. Render Predator Sharks (AI Helpers)
    for (const hs of this.helperSharks) {
      this.drawSharkCreature(ctx, hs.x, hs.y, hs.angle, hs.color, hs.bellyColor, hs.size, hs.lungeDuration > 0, now);
      // Name label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hs.name, hs.x, hs.y - hs.size - 4);
    }

    // 8. Render Players (Minnows or Sharks)
    const active = this.getActivePlayers();
    for (const p of active) {
      const s = this.swimmers.get(p.id);
      if (!s) continue;

      ctx.save();
      if (s.role === 'shark') {
        this.drawSharkCreature(ctx, s.x, s.y, s.angle, p.color, '#FFFFFF', 30, s.lungeDuration > 0, now);
      } else {
        if (s.isAlive) {
          this.drawMinnowFish(ctx, s.x, s.y, s.angle, p.color, 14, now + p.id);
        } else {
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10.5px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const roleIcon = s.role === 'shark' ? '🦈' : '🐟';
      ctx.fillText(`${roleIcon} ${p.name}`, s.x, s.y - (s.role === 'shark' ? 32 : 20));
      ctx.restore();
    }

    // 9. Floating Announcement Modal
    if (this.waveState === 'announcing') {
      ctx.save();
      const bannerW = 480;
      const bannerH = 54;
      const bx = width / 2 - bannerW / 2;
      const by = height / 2 - bannerH / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bannerW, bannerH, 14);
      else ctx.rect(bx, by, bannerW, bannerH);
      ctx.fill();
      ctx.stroke();

      const desc = this.modeDescriptions[this.gameMode];
      ctx.font = '900 15px Montserrat, sans-serif';
      ctx.fillStyle = '#FDE047';
      ctx.textAlign = 'center';
      ctx.fillText(`${desc.icon} ${desc.title}`, width / 2, by + 22);

      ctx.font = '700 11px Montserrat, sans-serif';
      ctx.fillStyle = '#E0F2FE';
      ctx.fillText(desc.subtitle, width / 2, by + 42);
      ctx.restore();
    }

    // 10. Top HUD Status Pod
    const hudW = 420;
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
    ctx.fillText(`WAVE ${this.currentWave}/${this.maxWaves}  │  ${pScores}`, width / 2, hudY + 18);
    ctx.restore();

    // 11. Interactive Bottom-Left Theme & Mode Pill (Rule compliant: x: 20, y: height - 44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 400, 32, 16);
    else ctx.fillRect(20, height - 44, 400, 32);
    ctx.fill();
    ctx.stroke();

    const desc = this.modeDescriptions[this.gameMode];
    const modeNum = this.modeList.indexOf(this.gameMode) + 1;
    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${desc.icon} [MODE ${modeNum}/4] ${desc.title}  (Press [M] to switch)`,
      32,
      height - 24
    );
    ctx.restore();
  }

  private renderBuoyLine(ctx: CanvasRenderingContext2D, width: number, y: number, time: number): void {
    ctx.save();
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += 25) {
      const bobY = y + Math.sin(x * 0.04 + time * 3.0) * 3;
      ctx.lineTo(x, bobY);
    }
    ctx.stroke();

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

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();

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

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.1, size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bellyColor;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.18, size * 0.95, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Dorsal Fin
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(-size * 0.2, 0);
    ctx.lineTo(-size * 0.1, -size * 0.85);
    ctx.lineTo(size * 0.25, 0);
    ctx.closePath();
    ctx.fill();

    // Pectoral flippers
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, size * 0.3);
    ctx.lineTo(size * 0.1, size * 0.85);
    ctx.lineTo(size * 0.25, size * 0.3);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#F87171';
    ctx.beginPath();
    ctx.arc(size * 0.7, -size * 0.18, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(size * 0.73, -size * 0.18, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Open Jaws with Sharp Teeth when Lunging
    if (isLunging) {
      ctx.fillStyle = '#991B1B';
      ctx.beginPath();
      ctx.arc(size * 0.9, 0, size * 0.35, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();

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
        ? `${winnerName} conquered Sharks & Minnows [${this.modeDescriptions[this.gameMode].title}] with ${highestScore} pts!`
        : 'The ocean claimed all swimmers!'
    };
  }
}
