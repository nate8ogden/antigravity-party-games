import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type RocketSkatesThemeId = 'velodrome_classic' | 'cyber_neon' | 'magma_circuit';

interface RocketSkatesTheme {
  id: RocketSkatesThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  trackSurface: string;
  trackBorderInner: string;
  trackBorderOuter: string;
  trackLines: string;
  finishCheck1: string;
  finishCheck2: string;
  accentColor: string;
  hazardColor: string;
}

const THEMES: Record<RocketSkatesThemeId, RocketSkatesTheme> = {
  velodrome_classic: {
    id: 'velodrome_classic',
    name: 'Velodrome Classic',
    icon: '🛼',
    bgGradTop: '#1a1008',
    bgGradBottom: '#0d0704',
    trackSurface: '#2b1a10',
    trackBorderInner: '#f59e0b',
    trackBorderOuter: '#ef4444',
    trackLines: 'rgba(255, 255, 255, 0.25)',
    finishCheck1: '#ffffff',
    finishCheck2: '#1e293b',
    accentColor: '#f59e0b',
    hazardColor: '#ef4444'
  },
  cyber_neon: {
    id: 'cyber_neon',
    name: 'Cyberpunk Neon Ring',
    icon: '⚡',
    bgGradTop: '#08051a',
    bgGradBottom: '#02010a',
    trackSurface: '#120b29',
    trackBorderInner: '#00f0ff',
    trackBorderOuter: '#ff007f',
    trackLines: 'rgba(0, 240, 255, 0.35)',
    finishCheck1: '#00f0ff',
    finishCheck2: '#ff007f',
    accentColor: '#00f0ff',
    hazardColor: '#f43f5e'
  },
  magma_circuit: {
    id: 'magma_circuit',
    name: 'Molten Magma Circuit',
    icon: '🔥',
    bgGradTop: '#1f0d06',
    bgGradBottom: '#0c0402',
    trackSurface: '#26120b',
    trackBorderInner: '#ea580c',
    trackBorderOuter: '#dc2626',
    trackLines: 'rgba(249, 115, 22, 0.3)',
    finishCheck1: '#f97316',
    finishCheck2: '#451a03',
    accentColor: '#f97316',
    hazardColor: '#fbbf24'
  }
};

const THEME_ORDER: RocketSkatesThemeId[] = ['velodrome_classic', 'cyber_neon', 'magma_circuit'];

interface SkaterState {
  id: PlayerId;
  angle: number; // orbital angle around velodrome (0 to 2pi)
  laneOffset: number; // -42 (inner rail) to +42 (outer rail)
  laneVelocity: number;
  speed: number; // angular speed modifier
  boostGauge: number; // 0 to 100
  chargeTimer: number; // how long action is currently held
  isCharging: boolean;
  boostTier: number; // 0, 1, 2, 3
  isBoosting: boolean;
  boostTimer: number;
  spinTimer: number; // spin-out stun from oil or shunts
  spinAngle: number;
  laps: number;
  score: number;
  isDrafting: boolean;
  draftTargetId: PlayerId | null;
  draftTimer: number;
  shuntCooldown: number;
  lastShovedBy: PlayerId | null;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  animTime: number;
}

interface TrackItem {
  id: number;
  angle: number;
  laneOffset: number;
  type: 'battery' | 'speed_strip' | 'oil_slick' | 'golden_core';
  bobble: number;
}

interface FloatingSkateText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class RocketSkatesGame extends BaseGame {
  public currentTheme: RocketSkatesThemeId = 'velodrome_classic';
  public playersState: Map<PlayerId, SkaterState> = new Map();

  private trackCenterX: number = 0;
  private trackCenterY: number = 0;
  private radiusX: number = 220;
  private radiusY: number = 145;
  private trackWidth: number = 96;

  private items: TrackItem[] = [];
  private itemSpawnTimer: number = 1.8;
  private itemIdCounter: number = 0;
  private floatingTexts: FloatingSkateText[] = [];
  private textIdCounter: number = 0;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botTargetLanes: Map<PlayerId, number> = new Map();
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
          this.setTheme('velodrome_classic');
        } else if (e.key === '2') {
          this.setTheme('cyber_neon');
        } else if (e.key === '3') {
          this.setTheme('magma_circuit');
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

  public setTheme(theme: RocketSkatesThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentColor, 16);
  }

  public cycleTheme(): void {
    const curIdx = THEME_ORDER.indexOf(this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_ORDER.length;
    this.setTheme(THEME_ORDER[nextIdx]);
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
    this.playersState.clear();
    this.items = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.botTargetLanes.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.itemIdCounter = 0;

    this.trackCenterX = width / 2;
    this.trackCenterY = height * 0.53;
    this.radiusX = Math.min(260, width * 0.32);
    this.radiusY = Math.min(170, height * 0.28);
    this.trackWidth = 96;

    // Spawn initial items
    for (let i = 0; i < 6; i++) {
      this.spawnRandomItem((i * Math.PI) / 3);
    }

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      // Stagger starting grid along the bottom-right straight
      const startAngle = Math.PI * 0.5 - (idx * 0.16);
      const laneSpread = ((idx - (count - 1) / 2) / Math.max(1, count - 1)) * 50;

      this.playersState.set(p.id, {
        id: p.id,
        angle: startAngle,
        laneOffset: laneSpread,
        laneVelocity: 0,
        speed: 1.35,
        boostGauge: 100,
        chargeTimer: 0,
        isCharging: false,
        boostTier: 0,
        isBoosting: false,
        boostTimer: 0,
        spinTimer: 0,
        spinAngle: 0,
        laps: 0,
        score: 0,
        isDrafting: false,
        draftTargetId: null,
        draftTimer: 0,
        shuntCooldown: 0,
        lastShovedBy: null,
        isUnderdog: false,
        currentMood: 'idle',
        animTime: 0
      });

      this.botReactionTimers.set(p.id, 0.2);
      this.botTargetLanes.set(p.id, 0);
    });
  }

  private spawnRandomItem(preferredAngle?: number): void {
    const types: ('battery' | 'speed_strip' | 'oil_slick' | 'golden_core')[] = [
      'battery',
      'speed_strip',
      'oil_slick',
      'golden_core'
    ];
    // Bias towards batteries and speed strips, occasional golden core
    const roll = Math.random();
    let type: 'battery' | 'speed_strip' | 'oil_slick' | 'golden_core' = 'battery';
    if (roll < 0.35) type = 'battery';
    else if (roll < 0.65) type = 'speed_strip';
    else if (roll < 0.85) type = 'oil_slick';
    else type = 'golden_core';

    const angle = preferredAngle !== undefined ? preferredAngle : Math.random() * Math.PI * 2;
    const laneOffset = (Math.random() - 0.5) * 64;

    this.items.push({
      id: ++this.itemIdCounter,
      angle,
      laneOffset,
      type,
      bobble: Math.random() * Math.PI * 2
    });
  }

  private addFloatingText(text: string, x: number, y: number, color: string, size: number = 14): void {
    this.floatingTexts.push({
      id: ++this.textIdCounter,
      text,
      x,
      y,
      color,
      size,
      life: 0.9,
      maxLife: 0.9
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= dt * 30;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Dynamic track item spawning
    this.itemSpawnTimer -= dt;
    const maxItems = this.roundTimer <= 15 ? 9 : 6;
    if (this.itemSpawnTimer <= 0 && this.items.length < maxItems) {
      this.itemSpawnTimer = this.roundTimer <= 15 ? 1.0 + Math.random() * 0.8 : 1.6 + Math.random() * 1.2;
      this.spawnRandomItem();
    }

    // Update items bobble
    for (const item of this.items) {
      item.bobble += dt * 3.5;
    }

    // Calculate leader and underdog status
    let maxScore = -1;
    let minScore = 999999;
    const activePlayers = this.getActivePlayers();

    for (const p of activePlayers) {
      const s = this.playersState.get(p.id);
      if (!s) continue;
      if (s.score > maxScore) maxScore = s.score;
      if (s.score < minScore) minScore = s.score;
    }

    for (const p of activePlayers) {
      const s = this.playersState.get(p.id);
      if (!s) continue;
      s.isUnderdog = maxScore - s.score >= 50 && s.score < maxScore;
    }

    // Run Bot AI updates
    this.updateBots(dt, width, height);

    // Update each skater
    for (const p of activePlayers) {
      const s = this.playersState.get(p.id);
      if (!s) continue;

      s.animTime += dt * 6;
      if (s.shuntCooldown > 0) s.shuntCooldown -= dt;

      // Handle spin-out stun
      if (s.spinTimer > 0) {
        s.spinTimer -= dt;
        s.spinAngle += dt * 14;
        s.speed = Math.max(0.4, s.speed - dt * 1.8);
        s.currentMood = 'shocked';
        if (s.spinTimer <= 0) {
          s.spinAngle = 0;
          s.currentMood = 'idle';
        }
      }

      // Input steering
      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Lane physics: steer changes lane offset
      if (s.spinTimer <= 0) {
        const laneAccel = steer * 220;
        s.laneVelocity += laneAccel * dt;
        s.laneVelocity *= Math.pow(0.05, dt); // Damping
        s.laneOffset += s.laneVelocity * dt;

        // Clamp to track borders
        const maxOffset = this.trackWidth * 0.44;
        if (s.laneOffset < -maxOffset) {
          s.laneOffset = -maxOffset;
          s.laneVelocity = Math.abs(s.laneVelocity) * 0.4;
        } else if (s.laneOffset > maxOffset) {
          s.laneOffset = maxOffset;
          s.laneVelocity = -Math.abs(s.laneVelocity) * 0.4;
        }

        // Hold-to-Charge Thruster mechanic
        if (isAction) {
          if (s.boostGauge > 5 && !s.isBoosting) {
            s.isCharging = true;
            s.chargeTimer += dt;
            s.currentMood = 'focused';

            // Determine boost tier
            if (s.chargeTimer >= 1.8) {
              s.boostTier = 3; // Overdrive
            } else if (s.chargeTimer >= 1.0) {
              s.boostTier = 2; // Plasma
            } else if (s.chargeTimer >= 0.4) {
              s.boostTier = 1; // Spark
            } else {
              s.boostTier = 0;
            }

            // Charge sparks
            const pos = this.getTrackPos(s.angle, s.laneOffset);
            if (Math.random() < 0.4) {
              const sparkCol = s.boostTier === 3 ? '#ff0055' : s.boostTier === 2 ? '#38bdf8' : '#facc15';
              this.particles.spawnSparks(pos.x, pos.y, sparkCol, 2);
            }

            // Stall risk if held way too long (> 2.3s)
            if (s.chargeTimer > 2.3) {
              s.isCharging = false;
              s.chargeTimer = 0;
              s.boostTier = 0;
              s.boostGauge = Math.max(0, s.boostGauge - 20);
              s.speed = Math.max(0.6, s.speed * 0.5);
              this.audio.playBounce();
              this.particles.spawnSparks(pos.x, pos.y, '#94a3b8', 12);
              this.addFloatingText('⚠️ OVERCHARGE STALL!', pos.x, pos.y - 25, '#ef4444', 15);
              s.currentMood = 'shocked';
            }
          }
        } else {
          // Release action: fire the charged boost!
          if (s.isCharging && s.chargeTimer >= 0.3) {
            s.isCharging = false;
            s.isBoosting = true;
            s.boostTimer = 0.8 + s.boostTier * 0.45;
            const cost = 15 + s.boostTier * 15;
            s.boostGauge = Math.max(0, s.boostGauge - cost);

            const boostSpeed = 2.4 + s.boostTier * 0.85;
            s.speed = Math.max(s.speed, boostSpeed);

            const pos = this.getTrackPos(s.angle, s.laneOffset);
            this.audio.playWhoosh();
            this.screenShake = 3 + s.boostTier * 2.5;

            let boostMsg = '⚡ TURBO BOOST!';
            let boostCol = '#facc15';
            if (s.boostTier === 3) {
              boostMsg = '🔥 OVERDRIVE WARP!';
              boostCol = '#ff0055';
              this.audio.playScore();
              this.particles.spawnSparks(pos.x, pos.y, '#ff0055', 18);
            } else if (s.boostTier === 2) {
              boostMsg = '🚀 PLASMA BLAST!';
              boostCol = '#38bdf8';
              this.particles.spawnSparks(pos.x, pos.y, '#38bdf8', 12);
            } else {
              this.particles.spawnSparks(pos.x, pos.y, '#facc15', 8);
            }

            this.addFloatingText(boostMsg, pos.x, pos.y - 25, boostCol, 16);
            s.currentMood = 'triumph';
            s.chargeTimer = 0;
            s.boostTier = 0;
          } else {
            s.isCharging = false;
            s.chargeTimer = 0;
            s.boostTier = 0;
          }
        }

        // Active boosting decay
        if (s.isBoosting) {
          s.boostTimer -= dt;
          const pos = this.getTrackPos(s.angle, s.laneOffset);
          const exhaustColor = s.isUnderdog ? '#fbbf24' : p.color;
          this.particles.emit(pos.x, pos.y, 2, exhaustColor);

          if (s.boostTimer <= 0) {
            s.isBoosting = false;
            if (s.currentMood === 'triumph') s.currentMood = 'idle';
          }
        } else {
          // Normal drag & passive boost regeneration
          const regenRate = (s.isUnderdog ? 28 : 18) * (this.roundTimer <= 15 ? 1.8 : 1.0);
          s.boostGauge = Math.min(100, s.boostGauge + dt * regenRate);
          s.speed = Math.max(1.35, s.speed - dt * 1.1);
        }
      }

      // Check drafting & slipstream behind rivals
      s.isDrafting = false;
      s.draftTargetId = null;
      for (const rival of activePlayers) {
        if (rival.id === p.id) continue;
        const rs = this.playersState.get(rival.id);
        if (!rs) continue;

        // Check if rival is ahead along the track within 0.15 to 0.45 radians
        let angleDiff = (rs.angle - s.angle) % (Math.PI * 2);
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        const laneDiff = Math.abs(s.laneOffset - rs.laneOffset);
        if (angleDiff > 0.08 && angleDiff < 0.42 && laneDiff < 22) {
          s.isDrafting = true;
          s.draftTargetId = rival.id;
          s.draftTimer += dt;
          s.speed = Math.min(3.2, s.speed + dt * 1.8);
          s.boostGauge = Math.min(100, s.boostGauge + dt * 25);

          const myPos = this.getTrackPos(s.angle, s.laneOffset);
          if (Math.random() < 0.25) {
            this.particles.spawnSparks(myPos.x, myPos.y, '#38bdf8', 1);
          }

          if (s.draftTimer >= 0.8) {
            // Slingshot ready
            s.draftTimer = 0;
            s.score += 25;
            this.audio.playScore();
            this.addFloatingText('💨 SLIPSTREAM BOOST! +25', myPos.x, myPos.y - 25, '#38bdf8', 15);
            s.speed = Math.min(3.6, s.speed + 1.2);
            s.currentMood = 'triumph';
          }
          break;
        }
      }
      if (!s.isDrafting) {
        s.draftTimer = Math.max(0, s.draftTimer - dt * 1.5);
      }

      // Collect track items
      for (let ii = this.items.length - 1; ii >= 0; ii--) {
        const item = this.items[ii];
        let diffAngle = Math.abs(s.angle - item.angle) % (Math.PI * 2);
        if (diffAngle > Math.PI) diffAngle = Math.PI * 2 - diffAngle;
        const diffLane = Math.abs(s.laneOffset - item.laneOffset);

        if (diffAngle < 0.12 && diffLane < 24) {
          const itemPos = this.getTrackPos(item.angle, item.laneOffset);

          if (item.type === 'battery') {
            s.boostGauge = 100;
            s.score += 15;
            this.audio.playScore();
            this.particles.spawnSparks(itemPos.x, itemPos.y, '#38bdf8', 12);
            this.addFloatingText('⚡ NITRO REFILL! +15', itemPos.x, itemPos.y - 25, '#38bdf8', 15);
          } else if (item.type === 'speed_strip') {
            s.speed = 3.6;
            s.isBoosting = true;
            s.boostTimer = 0.9;
            s.score += 20;
            this.audio.playWhoosh();
            this.particles.spawnSparks(itemPos.x, itemPos.y, '#f59e0b', 14);
            this.addFloatingText('⏩ SPEED STRIP! +20', itemPos.x, itemPos.y - 25, '#f59e0b', 15);
          } else if (item.type === 'oil_slick') {
            if (!s.isUnderdog) {
              s.spinTimer = 0.7;
              s.speed = Math.max(0.5, s.speed * 0.4);
              s.score = Math.max(0, s.score - 10);
              this.audio.playBounce();
              this.particles.spawnSparks(itemPos.x, itemPos.y, '#a855f7', 10);
              this.addFloatingText('🛢️ SLIP! -10', itemPos.x, itemPos.y - 25, '#ef4444', 15);
            } else {
              this.addFloatingText('🛡️ UNDERDOG OIL IMMUNITY!', itemPos.x, itemPos.y - 25, '#fbbf24', 15);
            }
          } else if (item.type === 'golden_core') {
            s.score += 50;
            s.boostGauge = 100;
            this.audio.playFanfare();
            this.particles.spawnConfetti(itemPos.x, itemPos.y, 20);
            this.addFloatingText('💎 GOLDEN CORE! +50', itemPos.x, itemPos.y - 25, '#facc15', 18);
          }

          this.items.splice(ii, 1);
        }
      }

      // Orbital progress
      const prevAngle = s.angle;
      // Banking advantage: inside rail has smaller perimeter so advances angle faster
      const laneFactor = 1.0 - (s.laneOffset / (this.trackWidth * 1.5)) * 0.15;
      s.angle += s.speed * laneFactor * dt;

      // Wrap around 2*PI
      if (s.angle >= Math.PI * 2) {
        s.angle -= Math.PI * 2;
        s.laps++;
        const lapBonus = this.roundTimer <= 15 ? 200 : 100;
        s.score += lapBonus;
        this.audio.playScore();

        const ppos = this.getTrackPos(s.angle, s.laneOffset);
        this.particles.spawnConfetti(ppos.x, ppos.y, 16);
        this.addFloatingText(`🏁 LAP ${s.laps}! +${lapBonus}`, ppos.x, ppos.y - 30, '#10b981', 17);
        s.currentMood = 'triumph';
      }
    }

    // Inter-Player Body Collisions & Mighty Shoulder Shunts
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const p1 = activePlayers[i];
        const p2 = activePlayers[j];
        const s1 = this.playersState.get(p1.id);
        const s2 = this.playersState.get(p2.id);
        if (!s1 || !s2) continue;

        let diffAngle = Math.abs(s1.angle - s2.angle) % (Math.PI * 2);
        if (diffAngle > Math.PI) diffAngle = Math.PI * 2 - diffAngle;
        const diffLane = Math.abs(s1.laneOffset - s2.laneOffset);

        // Near collision along track
        if (diffAngle < 0.14 && diffLane < 26) {
          const pos1 = this.getTrackPos(s1.angle, s1.laneOffset);
          const pos2 = this.getTrackPos(s2.angle, s2.laneOffset);
          const midX = (pos1.x + pos2.x) / 2;
          const midY = (pos1.y + pos2.y) / 2;

          // Determine if either player is boosting or executing an intentional shunt
          const s1Strong = s1.isBoosting || s1.speed > s2.speed + 0.4 || s1.isUnderdog;
          const s2Strong = s2.isBoosting || s2.speed > s1.speed + 0.4 || s2.isUnderdog;

          this.audio.playBounce();
          this.hitStopTimer = 0.045; // 45ms hit-stop
          this.screenShake = 6;
          this.particles.spawnSparks(midX, midY, '#f59e0b', 12);

          // Elastic separation across lanes
          const pushSign = s1.laneOffset < s2.laneOffset ? -1 : 1;
          const shuntForce = 140 * (s1.isUnderdog || s2.isUnderdog ? 1.4 : 1.0);

          s1.laneVelocity += pushSign * shuntForce;
          s2.laneVelocity -= pushSign * shuntForce;

          if (s1Strong && !s2Strong && s1.shuntCooldown <= 0) {
            s1.shuntCooldown = 1.2;
            s1.score += 35;
            s2.spinTimer = 0.55;
            s2.lastShovedBy = p1.id;
            s2.currentMood = 'shocked';
            s1.currentMood = 'triumph';
            this.addFloatingText('💥 SHOULDER CHECK! +35', midX, midY - 25, p1.color, 16);
          } else if (s2Strong && !s1Strong && s2.shuntCooldown <= 0) {
            s2.shuntCooldown = 1.2;
            s2.score += 35;
            s1.spinTimer = 0.55;
            s1.lastShovedBy = p2.id;
            s1.currentMood = 'shocked';
            s2.currentMood = 'triumph';
            this.addFloatingText('💥 SHOULDER CHECK! +35', midX, midY - 25, p2.color, 16);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  // Calculate 2D position on the velodrome oval from angle and lane offset
  private getTrackPos(angle: number, laneOffset: number): { x: number; y: number; normalX: number; normalY: number } {
    const rx = this.radiusX + laneOffset;
    const ry = this.radiusY + laneOffset * 0.85;

    const x = this.trackCenterX + Math.cos(angle) * rx;
    const y = this.trackCenterY + Math.sin(angle) * ry;

    // Tangent angle
    const tx = -Math.sin(angle) * rx;
    const ty = Math.cos(angle) * ry;
    const mag = Math.hypot(tx, ty) || 1;

    return {
      x,
      y,
      normalX: tx / mag,
      normalY: ty / mag
    };
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const s = this.playersState.get(botId);
    if (!s) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction calibration
    let reactionDelay = 0.24; // Normal: 220-250ms
    let blunderChance = 0.08;
    if (difficulty === 'bot_easy') {
      reactionDelay = 0.42; // Easy: 380-450ms
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      reactionDelay = 0.11; // Hard: 90-130ms
      blunderChance = 0.01;
    }

    // Check upcoming items within 0.1 to 0.6 rads ahead
    let targetLane = 0; // Default optimal inner/mid racing line
    let foundCrateOrBattery = false;

    for (const item of this.items) {
      let angleDist = (item.angle - s.angle) % (Math.PI * 2);
      if (angleDist < 0) angleDist += Math.PI * 2;

      if (angleDist > 0.06 && angleDist < 0.6) {
        if (item.type === 'oil_slick' && !s.isUnderdog) {
          // Avoid oil: steer away
          if (Math.abs(s.laneOffset - item.laneOffset) < 26) {
            targetLane = item.laneOffset > 0 ? -30 : 30;
          }
        } else if (item.type === 'golden_core' || item.type === 'speed_strip' || item.type === 'battery') {
          // Seek good pickups
          targetLane = item.laneOffset;
          foundCrateOrBattery = true;
          break;
        }
      }
    }

    // If no urgent pickup, look for rivals to slipstream or shoulder shunt
    if (!foundCrateOrBattery) {
      if (difficulty === 'bot_hard') {
        // Try to draft rival ahead or ram side rival
        for (const [rid, rs] of this.playersState.entries()) {
          if (rid === botId) continue;
          let angleDist = (rs.angle - s.angle) % (Math.PI * 2);
          if (angleDist < 0) angleDist += Math.PI * 2;

          if (angleDist > 0.08 && angleDist < 0.45) {
            targetLane = rs.laneOffset; // line up for drafting
            break;
          } else if (angleDist < 0.08 && Math.abs(rs.laneOffset - s.laneOffset) < 32) {
            targetLane = rs.laneOffset; // ram into rival for shoulder shunt!
            break;
          }
        }
      } else {
        // Hold inside apex line
        targetLane = -18;
      }
    }

    // Apply blunder
    if (Math.random() < blunderChance) {
      targetLane += (Math.random() - 0.5) * 45;
    }

    this.botTargetLanes.set(botId, targetLane);

    // Compute steer towards targetLane
    const laneErr = targetLane - s.laneOffset;
    const steer = Math.max(-1, Math.min(1, laneErr / 20));

    // Boost decision
    let action = false;
    if (s.boostGauge > 45) {
      if (difficulty === 'bot_hard') {
        // Charge up to Tier 2 or 3
        if (s.isCharging) {
          action = s.chargeTimer < 1.4; // Hold to tier 2 then release
        } else {
          action = true; // Start charging
        }
      } else {
        // Simple boost
        action = Math.random() < 0.6;
      }
    }

    this.input.setBotInput(botId, action, steer, steer, action);
    this.botReactionTimers.set(botId, reactionDelay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const s = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: s?.score || 0,
        laps: s?.laps || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topLaps = scores[0]?.laps || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} dominated the Velodrome with ${scores[0].score} pts and ${topLaps} laps!`
      : 'Velodrome heats concluded in a breathtaking photo finish!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // Screen Shake
    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative velodrome stadium grandstands
    this.renderStadiumAtmosphere(ctx, width, height, theme);

    // 2. Velodrome Track Surface (Oval banking)
    this.renderTrack(ctx, theme);

    // 3. Track Items (Batteries, Speed Strips, Oil Slicks, Golden Cores)
    this.renderItems(ctx, theme);

    // 4. Skaters & Mascot Drivers
    this.renderSkaters(ctx);

    // 5. Floating Texts
    this.renderFloatingTexts(ctx);

    ctx.restore(); // Screen shake end

    // 6. UI HUD (Safe Layout)
    this.renderUI(ctx, width, height, theme);
  }

  private renderStadiumAtmosphere(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: RocketSkatesTheme
  ): void {
    ctx.save();

    if (theme.id === 'velodrome_classic') {
      // Warm stadium spotlights
      ctx.fillStyle = 'rgba(251, 191, 36, 0.05)';
      ctx.beginPath();
      ctx.arc(width * 0.2, 0, 240, 0, Math.PI * 2);
      ctx.arc(width * 0.8, 0, 240, 0, Math.PI * 2);
      ctx.fill();

      // Outer grandstand rail
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX + 68, this.radiusY + 68, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (theme.id === 'cyber_neon') {
      // Perspective synth grid
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (theme.id === 'magma_circuit') {
      // Bubbling lava glow in track infield
      const lavaGrad = ctx.createRadialGradient(
        this.trackCenterX,
        this.trackCenterY,
        20,
        this.trackCenterX,
        this.trackCenterY,
        this.radiusY - 30
      );
      lavaGrad.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
      lavaGrad.addColorStop(0.7, 'rgba(249, 115, 22, 0.12)');
      lavaGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = lavaGrad;
      ctx.beginPath();
      ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX - 35, this.radiusY - 35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderTrack(ctx: CanvasRenderingContext2D, theme: RocketSkatesTheme): void {
    ctx.save();

    // Infield grass/floor
    ctx.fillStyle = theme.id === 'velodrome_classic' ? '#18120c' : theme.id === 'cyber_neon' ? '#080516' : '#140804';
    ctx.beginPath();
    ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX - this.trackWidth * 0.5, this.radiusY - this.trackWidth * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Track Surface (Broad oval ring)
    ctx.strokeStyle = theme.trackSurface;
    ctx.lineWidth = this.trackWidth;
    ctx.beginPath();
    ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX, this.radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 2.5D Track Wood Planks or Neon Grid Lines
    if (theme.id === 'velodrome_classic') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1.5;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
        const inner = this.getTrackPos(a, -this.trackWidth * 0.48);
        const outer = this.getTrackPos(a, this.trackWidth * 0.48);
        ctx.beginPath();
        ctx.moveTo(inner.x, inner.y);
        ctx.lineTo(outer.x, outer.y);
        ctx.stroke();
      }
    }

    // Lane division guide lines
    ctx.strokeStyle = theme.trackLines;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX - 22, this.radiusY - 18, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX + 22, this.radiusY + 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner & Outer Curb Rails
    ctx.strokeStyle = theme.trackBorderInner;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX - this.trackWidth * 0.5, this.radiusY - this.trackWidth * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = theme.trackBorderOuter;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX + this.trackWidth * 0.5, this.radiusY + this.trackWidth * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Checkered Finish Line at Bottom Straight (angle = 0 rad / right side or 0.5pi)
    const finishAngle = 0;
    const finishInner = this.getTrackPos(finishAngle, -this.trackWidth * 0.5);
    const finishOuter = this.getTrackPos(finishAngle, this.trackWidth * 0.5);

    const steps = 6;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const x0 = finishInner.x + (finishOuter.x - finishInner.x) * t0;
      const y0 = finishInner.y + (finishOuter.y - finishInner.y) * t0;
      const x1 = finishInner.x + (finishOuter.x - finishInner.x) * t1;
      const y1 = finishInner.y + (finishOuter.y - finishInner.y) * t1;

      ctx.strokeStyle = s % 2 === 0 ? theme.finishCheck1 : theme.finishCheck2;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // "FINISH / START" Label Banner
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH / START', finishOuter.x + 32, finishOuter.y);

    ctx.restore();
  }

  private renderItems(ctx: CanvasRenderingContext2D, _theme: RocketSkatesTheme): void {
    for (const item of this.items) {
      const pos = this.getTrackPos(item.angle, item.laneOffset);
      const bob = Math.sin(item.bobble) * 3;

      ctx.save();
      ctx.translate(pos.x, pos.y + bob);

      if (item.type === 'battery') {
        // Cyan Battery Box
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(-10, -10, 20, 20, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, 0);
      } else if (item.type === 'speed_strip') {
        // Golden Chevron Acceleration Pad
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#d97706';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(10, 8);
        ctx.lineTo(0, 3);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⏩', 0, -2);
      } else if (item.type === 'oil_slick') {
        // Purple Oil Hazard
        ctx.fillStyle = 'rgba(168, 85, 247, 0.85)';
        ctx.shadowColor = '#9333ea';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 9, 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f3e8ff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛢️', 0, 0);
      } else if (item.type === 'golden_core') {
        // High-value Golden Orb
        const orbGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 12);
        orbGrad.addColorStop(0, '#fef08a');
        orbGrad.addColorStop(0.7, '#facc15');
        orbGrad.addColorStop(1, '#ca8a04');
        ctx.fillStyle = orbGrad;
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#78350f';
        ctx.font = '900 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💎', 0, 0);
      }

      ctx.restore();
    }
  }

  private renderSkaters(ctx: CanvasRenderingContext2D): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const s = this.playersState.get(p.id);
      if (!s) continue;

      const pos = this.getTrackPos(s.angle, s.laneOffset);
      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Skater rotation along velocity tangent + spinout
      const baseTangentAngle = Math.atan2(pos.normalY, pos.normalX);
      const bankTilt = (s.laneVelocity / 180) * 0.35;
      ctx.rotate(baseTangentAngle + Math.PI * 0.5 + s.spinAngle + bankTilt);

      // Slipstream Wind Tunnel effect if drafting
      if (s.isDrafting) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-14, 25);
        ctx.lineTo(-8, 8);
        ctx.moveTo(14, 25);
        ctx.lineTo(8, 8);
        ctx.stroke();
      }

      // Underdog Golden Aura
      if (s.isUnderdog) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Roller Skate Boots Chassis
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-12, 6, 6, 14); // Left boot
      ctx.fillRect(6, 6, 6, 14); // Right boot

      // Quad Wheels
      ctx.fillStyle = p.color;
      ctx.fillRect(-14, 7, 3, 4);
      ctx.fillRect(-14, 15, 3, 4);
      ctx.fillRect(11, 7, 3, 4);
      ctx.fillRect(11, 15, 3, 4);

      // Rocket Backpack Thruster
      ctx.fillStyle = s.isBoosting ? '#ff5722' : '#64748b';
      ctx.beginPath();
      ctx.roundRect(-8, 8, 16, 8, 2);
      ctx.fill();

      // Rocket Exhaust Flame
      if (s.isBoosting || s.isCharging) {
        const flameLen = s.isBoosting ? 18 + Math.random() * 8 : 6 + s.boostTier * 4;
        const flameGrad = ctx.createLinearGradient(0, 16, 0, 16 + flameLen);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.4, s.boostTier === 3 ? '#ff0055' : '#f97316');
        flameGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-6, 16);
        ctx.lineTo(6, 16);
        ctx.lineTo(0, 16 + flameLen);
        ctx.closePath();
        ctx.fill();
      }

      // Mascot Character Body
      drawCharacter(
        ctx,
        0,
        -2,
        15,
        p.id,
        isBot,
        s.currentMood,
        s.animTime,
        undefined
      );

      // Charge Gauge Arc Ring
      if (s.isCharging) {
        const chargeProgress = Math.min(1, s.chargeTimer / 1.8);
        ctx.strokeStyle = s.boostTier === 3 ? '#ff0055' : s.boostTier === 2 ? '#38bdf8' : '#facc15';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, -2, 21, -Math.PI / 2, -Math.PI / 2 + chargeProgress * Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Skater Floating Lap & Boost Badge
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1} • L${s.laps + 1}`, pos.x, pos.y - 24);

      // Mini boost meter bar
      const barW = 28;
      const barH = 4;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(pos.x - barW / 2, pos.y - 20, barW, barH);
      ctx.fillStyle = s.boostGauge > 40 ? '#38bdf8' : '#ef4444';
      ctx.fillRect(pos.x - barW / 2, pos.y - 20, (s.boostGauge / 100) * barW, barH);
      ctx.restore();
    }
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${ft.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  private renderUI(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: RocketSkatesTheme
  ): void {
    // 1. Minigame Header Badge (Safe at y: 56, h: 28)
    ctx.save();
    ctx.textAlign = 'center';

    const badgeW = 390;
    const badgeH = 28;
    const badgeX = width / 2 - badgeW / 2;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.font = '800 13px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🛼 ROCKET SKATES • STEER LANES & HOLD TO CHARGE NITRO', width / 2, badgeY + 18);
    ctx.restore();

    // 2. Sudden Death Banner if <= 15s
    if (this.roundTimer <= 15 && this.roundTimer > 0) {
      ctx.save();
      const pulse = 0.8 + Math.sin(this.animTimer * 8) * 0.2;
      ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.25})`;
      ctx.fillRect(0, 90, width, 26);

      ctx.fillStyle = '#fef08a';
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ SUDDEN DEATH: 2X LAP POINTS & SUPERCHARGED BOOSTS! ⚡', width / 2, 107);
      ctx.restore();
    }

    // 3. Theme Pill at Bottom-Left (x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name}`, pillX + 12, pillY + pillH / 2);

    ctx.font = '800 10px monospace';
    ctx.fillStyle = theme.accentColor;
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 12, pillY + pillH / 2);
    ctx.restore();

    // 4. Player Corner Status Cards (Safely offset to y: height - 128, 130x52px)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const s = this.playersState.get(p.id);
      if (!s) return;

      const cardW = 130;
      const cardH = 52;
      const isLeft = idx % 2 === 0;
      const isBottom = idx < 2;

      const cardX = isLeft ? 20 : width - cardW - 20;
      // Offset bottom cards to y: height - 128 so they never block the Theme Pill at y: height - 44
      const cardY = isBottom ? height - 128 : 110;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = s.isUnderdog ? '#fbbf24' : p.color;
      ctx.lineWidth = s.isUnderdog ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      // Mini mascot avatar
      drawCharacter(
        ctx,
        cardX + 22,
        cardY + 26,
        14,
        p.id,
        p.type !== 'human',
        s.currentMood,
        s.animTime,
        undefined
      );

      // Score and laps
      ctx.font = '800 11px sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(`P${p.id + 1} (${s.laps} Laps)`, cardX + 44, cardY + 20);

      ctx.font = '900 14px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${s.score} pts`, cardX + 44, cardY + 38);

      if (s.isUnderdog) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('⚡SURGE', cardX + cardW - 6, cardY + 16);
      }

      ctx.restore();
    });

    // 5. Control Hint (Right-aligned at bottom-right)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('STEER: Inner/Outer Lane | HOLD: Charge Rocket Thruster | RAM: Shoulder Shunt', width - 20, height - 14);
    ctx.restore();
  }
}
