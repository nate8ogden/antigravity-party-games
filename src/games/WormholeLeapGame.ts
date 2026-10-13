import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface WormholeNode {
  x: number;
  y: number;
  angle: number;
}

interface WormholePair {
  id: number;
  color: string;
  name: string;
  p1: WormholeNode;
  p2: WormholeNode;
  radius: number;
}

interface QuantumRelic {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'tachyon_shard' | 'chronos_cube' | 'singularity_core';
  value: number;
  color: string;
  pulsePhase: number;
}

interface WarpGlider {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  baseMaxSpeed: number;
  radius: number;
  score: number;
  combo: number;

  // Singularity Hold-to-Charge & Slingshot Surge
  isCharging: boolean;
  chargeTime: number; // 0 to 1.2s
  isSurging: boolean;
  surgeTimer: number;
  isStunned: boolean;
  stunTimer: number;

  portalCooldown: number;
  shuntCooldown: number;
  isUnderdog: boolean;

  // Mascot emotion & animation
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface WormholeTheme {
  id: string;
  name: string;
  icon: string;
  voidDark: string;
  voidLight: string;
  gridLineColor: string;
  pair1Color: string;
  pair2Color: string;
  pair3Color: string;
  accentColor: string;
}

const THEMES: WormholeTheme[] = [
  {
    id: 'interstellar_singularity',
    name: 'Interstellar Singularity 🌌',
    icon: '🌌',
    voidDark: '#03020C',
    voidLight: '#0A0824',
    gridLineColor: '#120F38',
    pair1Color: '#00E5FF',
    pair2Color: '#E040FB',
    pair3Color: '#FFD700',
    accentColor: '#00E5FF'
  },
  {
    id: 'chronos_void',
    name: 'Chronos Clockwork Void ⏳',
    icon: '⏳',
    voidDark: '#0E0903',
    voidLight: '#261908',
    gridLineColor: '#3D280E',
    pair1Color: '#FFB300',
    pair2Color: '#FF7043',
    pair3Color: '#00E676',
    accentColor: '#FFB300'
  },
  {
    id: 'subspace_grid',
    name: 'Cyber Subspace Grid ⚡',
    icon: '⚡',
    voidDark: '#011208',
    voidLight: '#062614',
    gridLineColor: '#0C4022',
    pair1Color: '#00E676',
    pair2Color: '#00F5FF',
    pair3Color: '#FF0055',
    accentColor: '#00E676'
  }
];

export class WormholeLeapGame extends BaseGame {
  public currentMapName: string = 'Interstellar Singularity 🌌';
  private currentThemeIdx: number = 0;

  private gliders: Map<PlayerId, WarpGlider> = new Map();
  private pairs: WormholePair[] = [];
  private relics: QuantumRelic[] = [];
  private relicIdCounter: number = 0;
  private spawnRelicTimer: number = 1.0;

  // Starfield
  private stars: { x: number; y: number; size: number; alpha: number }[] = [];

  // Bot AI timers
  private botReactionTimers: Map<PlayerId, number> = new Map();

  // Listeners
  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;

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
        const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
        const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;

        // Theme pill: x: 20, y: height - 44, w: 170, h: 32
        const pillY = canvas.height - 44;
        if (mouseX >= 20 && mouseX <= 190 && mouseY >= pillY && mouseY <= pillY + 32) {
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
    super.destroy();
  }

  public cycleTheme(): void {
    this.setTheme((this.currentThemeIdx + 1) % THEMES.length);
  }

  public setTheme(idx: number): void {
    this.currentThemeIdx = (idx + THEMES.length) % THEMES.length;
    this.currentMapName = THEMES[this.currentThemeIdx].name;
    this.updatePairColors();
    this.audio.playTap();
  }

  private updatePairColors(): void {
    const theme = THEMES[this.currentThemeIdx];
    if (this.pairs.length >= 3) {
      this.pairs[0].color = theme.pair1Color;
      this.pairs[1].color = theme.pair2Color;
      this.pairs[2].color = theme.pair3Color;
    }
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 38.0;
    this.isFinished = false;
    this.gliders.clear();
    this.relics = [];
    this.stars = [];
    this.relicIdCounter = 0;
    this.spawnRelicTimer = 1.0;

    // Starfield
    for (let i = 0; i < 75; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.6,
        alpha: 0.3 + Math.random() * 0.7
      });
    }

    const theme = THEMES[this.currentThemeIdx];

    // 3 paired color-coded Singularity Wormholes with event horizons
    this.pairs = [
      {
        id: 1,
        color: theme.pair1Color,
        name: 'Cyan',
        p1: { x: width * 0.18, y: height * 0.28, angle: 0 },
        p2: { x: width * 0.82, y: height * 0.74, angle: 0 },
        radius: 34
      },
      {
        id: 2,
        color: theme.pair2Color,
        name: 'Magenta',
        p1: { x: width * 0.82, y: height * 0.28, angle: 0 },
        p2: { x: width * 0.18, y: height * 0.74, angle: 0 },
        radius: 34
      },
      {
        id: 3,
        color: theme.pair3Color,
        name: 'Amber',
        p1: { x: width * 0.50, y: height * 0.20, angle: 0 },
        p2: { x: width * 0.50, y: height * 0.82, angle: 0 },
        radius: 34
      }
    ];

    // Spawn 12 initial quantum relics
    for (let i = 0; i < 12; i++) {
      this.spawnRelic(width, height);
    }

    const active = this.getActivePlayers();
    const spawnPositions = [
      { x: width * 0.35, y: height * 0.45, angle: -Math.PI * 0.25 },
      { x: width * 0.65, y: height * 0.45, angle: Math.PI * 0.75 },
      { x: width * 0.35, y: height * 0.55, angle: Math.PI * 0.25 },
      { x: width * 0.65, y: height * 0.55, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnPositions[idx % spawnPositions.length];
      this.gliders.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        speed: 0,
        baseMaxSpeed: 230,
        radius: 17,
        score: 0,
        combo: 1,

        isCharging: false,
        chargeTime: 0,
        isSurging: false,
        surgeTimer: 0,
        isStunned: false,
        stunTimer: 0,

        portalCooldown: 0,
        shuntCooldown: 0,
        isUnderdog: false,

        mood: 'idle',
        moodTimer: 0,
        animTimer: idx * 0.3
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private spawnRelic(width: number, height: number): void {
    const roll = Math.random();
    const theme = THEMES[this.currentThemeIdx];

    let type: QuantumRelic['type'] = 'tachyon_shard';
    let val = 20;
    let rad = 11;
    let col = theme.pair1Color;

    if (roll < 0.20) {
      type = 'singularity_core';
      val = 75;
      rad = 16;
      col = theme.pair3Color;
    } else if (roll < 0.55) {
      type = 'chronos_cube';
      val = 40;
      rad = 13;
      col = theme.pair2Color;
    }

    this.relics.push({
      id: ++this.relicIdCounter,
      x: 60 + Math.random() * (width - 120),
      y: 70 + Math.random() * (height - 140),
      vx: (Math.random() - 0.5) * 25,
      vy: (Math.random() - 0.5) * 25,
      radius: rad,
      type,
      value: val,
      color: col,
      pulsePhase: Math.random() * Math.PI * 2
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Rotate wormholes
    for (const pair of this.pairs) {
      pair.p1.angle += 2.0 * dt;
      pair.p2.angle -= 2.0 * dt;
    }

    // Maintain relics
    this.spawnRelicTimer -= dt;
    if (this.spawnRelicTimer <= 0 && this.relics.length < 13) {
      this.spawnRelicTimer = 1.8 + Math.random() * 1.2;
      this.spawnRelic(width, height);
    }

    // Determine max score for Underdog
    let maxScore = 0;
    for (const g of this.gliders.values()) {
      if (g.score > maxScore) maxScore = g.score;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // 1. Update Gliders
    for (const p of active) {
      const g = this.gliders.get(p.id);
      if (!g) continue;

      g.animTimer += dt;
      if (g.moodTimer > 0) {
        g.moodTimer -= dt;
        if (g.moodTimer <= 0) g.mood = 'idle';
      }

      if (g.shuntCooldown > 0) g.shuntCooldown -= dt;
      if (g.portalCooldown > 0) g.portalCooldown -= dt;

      // Underdog check: trailing by >= 35 pts
      g.isUnderdog = (maxScore - g.score >= 35);

      // Handle Stun
      if (g.stunTimer > 0) {
        g.stunTimer -= dt;
        g.angle += 14 * dt;
        g.vx *= 0.93;
        g.vy *= 0.93;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        if (Math.random() < 0.4) {
          this.particles.emit(g.x, g.y, 2, '#FF1744');
        }
        continue;
      }

      const steer = this.input.getSteer(g.id);
      const isActionHeld = this.input.isPressed(g.id) || this.input.isActionPressed(g.id);

      // Turning
      if (steer !== 0) {
        const turnRate = g.isUnderdog ? 4.5 : 3.8;
        g.angle += steer * turnRate * dt;
      }

      // Hold-to-Charge Singularity Slingshot Surge
      if (isActionHeld && !g.isStunned) {
        g.isCharging = true;
        const chargeRate = g.isUnderdog ? 1.4 : 1.0;
        g.chargeTime = Math.min(1.2, g.chargeTime + dt * chargeRate);
        g.mood = 'focused';

        // Cruise thrust forward while charging
        const thrust = 190;
        g.vx += Math.cos(g.angle) * thrust * dt;
        g.vy += Math.sin(g.angle) * thrust * dt;

        // Particle sparks
        if (Math.random() < 0.5) {
          this.particles.emit(g.x, g.y, 2, '#00E5FF');
        }

        // Destabilization blowoff
        if (g.chargeTime >= 1.2) {
          g.isStunned = true;
          g.stunTimer = 1.0;
          g.chargeTime = 0;
          g.isCharging = false;
          g.combo = 1; // Break combo on destabilization
          g.mood = 'shocked';
          g.moodTimer = 1.0;
          this.audio.playExplosion();
          this.particles.spawnExplosion(g.x, g.y, '#FF1744', 16);
        }
      } else if (g.isCharging) {
        // Released -> Slingshot Surge!
        const chargeRatio = g.chargeTime / 1.0;
        g.isCharging = false;
        g.chargeTime = 0;

        const sweetMin = g.isUnderdog ? 0.50 : 0.72;
        const sweetMax = g.isUnderdog ? 1.00 : 0.98;
        const isSweet = chargeRatio >= sweetMin && chargeRatio <= sweetMax;

        if (isSweet) {
          // PERFECT SWEET SPOT: Slingshot Surge!
          g.isSurging = true;
          g.surgeTimer = 1.5;
          g.speed = g.baseMaxSpeed * 2.55;
          g.vx = Math.cos(g.angle) * g.speed;
          g.vy = Math.sin(g.angle) * g.speed;
          g.score += 20; // +20 Warp Surge Bonus!
          g.mood = 'triumph';
          g.moodTimer = 1.2;
          this.audio.playFanfare();
          this.particles.spawnExplosion(g.x, g.y, '#00E5FF', 16);

          // Vacuum up relics within 140px
          for (const r of this.relics) {
            if (Math.hypot(r.x - g.x, r.y - g.y) < 140) {
              const pullAngle = Math.atan2(g.y - r.y, g.x - r.x);
              r.vx += Math.cos(pullAngle) * 380;
              r.vy += Math.sin(pullAngle) * 380;
            }
          }
        } else if (chargeRatio > 0.25) {
          // Mini-surge
          g.isSurging = true;
          g.surgeTimer = 0.8;
          g.speed = g.baseMaxSpeed * 1.4;
          g.vx = Math.cos(g.angle) * g.speed;
          g.vy = Math.sin(g.angle) * g.speed;
          this.audio.playScore();
          this.particles.emit(g.x, g.y, 6, '#80DEEA');
        }
      } else {
        if (g.isSurging) {
          g.surgeTimer -= dt;
          if (g.surgeTimer <= 0) g.isSurging = false;
        } else {
          // Base cruise decay
          const maxCruise = g.isUnderdog ? g.baseMaxSpeed * 1.25 : g.baseMaxSpeed;
          g.speed = Math.hypot(g.vx, g.vy);
          if (g.speed > maxCruise) {
            g.vx *= 0.95;
            g.vy *= 0.95;
          } else {
            // Gentle base cruise
            g.vx += Math.cos(g.angle) * 120 * dt;
            g.vy += Math.sin(g.angle) * 120 * dt;
          }
        }
      }

      // Drag
      g.vx *= Math.pow(0.97, dt * 60);
      g.vy *= Math.pow(0.97, dt * 60);
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      // Arena bounds
      const margin = 24;
      if (g.x < margin) { g.x = margin; g.vx = Math.abs(g.vx) * 0.7; this.audio.playBounce(); }
      if (g.x > width - margin) { g.x = width - margin; g.vx = -Math.abs(g.vx) * 0.7; this.audio.playBounce(); }
      if (g.y < margin + 35) { g.y = margin + 35; g.vy = Math.abs(g.vy) * 0.7; this.audio.playBounce(); }
      if (g.y > height - margin) { g.y = height - margin; g.vy = -Math.abs(g.vy) * 0.7; this.audio.playBounce(); }

      // Check Wormhole Teleportation
      if (g.portalCooldown <= 0) {
        for (const pair of this.pairs) {
          const d1 = Math.hypot(g.x - pair.p1.x, g.y - pair.p1.y);
          const d2 = Math.hypot(g.x - pair.p2.x, g.y - pair.p2.y);

          if (d1 < pair.radius + (this.roundTimer <= 12.0 ? 8 : 0)) {
            this.teleportFighter(g, pair.p2.x, pair.p2.y, pair.color);
            break;
          } else if (d2 < pair.radius + (this.roundTimer <= 12.0 ? 8 : 0)) {
            this.teleportFighter(g, pair.p1.x, pair.p1.y, pair.color);
            break;
          }
        }
      }

      // Check Relic Collection
      for (let rIdx = this.relics.length - 1; rIdx >= 0; rIdx--) {
        const r = this.relics[rIdx];
        if (Math.hypot(g.x - r.x, g.y - r.y) < g.radius + r.radius) {
          const suddenDeathMult = this.roundTimer <= 12.0 ? 2 : 1;
          const pts = r.value * g.combo * suddenDeathMult;
          g.score += pts;
          g.mood = 'happy';
          g.moodTimer = 1.0;
          this.audio.playScore();
          this.particles.spawnExplosion(r.x, r.y, r.color, 12);
          this.relics.splice(rIdx, 1);
        }
      }
    }

    // 2. Physical Elastic Shunting & Portal Combo Sabotage ($m_1 v_1 + m_2 v_2$)
    const gliderArray = Array.from(this.gliders.values());
    for (let i = 0; i < gliderArray.length; i++) {
      for (let j = i + 1; j < gliderArray.length; j++) {
        const g1 = gliderArray[i];
        const g2 = gliderArray[j];
        if (g1.stunTimer > 0 || g2.stunTimer > 0) continue;

        const dx = g2.x - g1.x;
        const dy = g2.y - g1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = g1.radius + g2.radius + 6;

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          g1.x -= nx * overlap * 0.5;
          g1.y -= ny * overlap * 0.5;
          g2.x += nx * overlap * 0.5;
          g2.y += ny * overlap * 0.5;

          // Check if one glider is Surging or traveling significantly faster (Singularity Shunt)
          const g1IsShunter = g1.isSurging || Math.hypot(g1.vx, g1.vy) > Math.hypot(g2.vx, g2.vy) + 60;
          const g2IsShunter = g2.isSurging || Math.hypot(g2.vx, g2.vy) > Math.hypot(g1.vx, g1.vy) + 60;

          if (g1IsShunter && g1.shuntCooldown <= 0) {
            g1.score += 30; // +30 Sabotage Bonus!
            g1.shuntCooldown = 1.0;
            if (!g2.isUnderdog) g2.combo = 1; // Break combo!
            g2.stunTimer = 0.8;
            g2.mood = 'shocked';
            g2.moodTimer = 1.2;
            g1.mood = 'triumph';
            g1.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((g1.x + g2.x) * 0.5, (g1.y + g2.y) * 0.5, '#FF5252', 16);
          } else if (g2IsShunter && g2.shuntCooldown <= 0) {
            g2.score += 30;
            g2.shuntCooldown = 1.0;
            if (!g1.isUnderdog) g1.combo = 1;
            g1.stunTimer = 0.8;
            g1.mood = 'shocked';
            g1.moodTimer = 1.2;
            g2.mood = 'triumph';
            g2.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((g1.x + g2.x) * 0.5, (g1.y + g2.y) * 0.5, '#FF5252', 16);
          } else {
            this.audio.playBounce();
            this.particles.emit((g1.x + g2.x) * 0.5, (g1.y + g2.y) * 0.5, 4, '#FFFFFF');
          }

          // Elastic impulse
          const kx = g1.vx - g2.vx;
          const ky = g1.vy - g2.vy;
          const pImpulse = 2 * (nx * kx + ny * ky) / 2;
          g1.vx -= pImpulse * nx * 0.85;
          g1.vy -= pImpulse * ny * 0.85;
          g2.vx += pImpulse * nx * 0.85;
          g2.vy += pImpulse * ny * 0.85;
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private teleportFighter(g: WarpGlider, destX: number, destY: number, color: string): void {
    this.particles.spawnExplosion(g.x, g.y, color, 14);

    g.x = destX;
    g.y = destY;
    g.portalCooldown = 0.9;
    g.combo = Math.min(4, g.combo + 1);
    g.score += 30 * g.combo;

    // Slingshot forward on exit
    const exitSpeed = g.baseMaxSpeed * 1.6;
    g.vx = Math.cos(g.angle) * exitSpeed;
    g.vy = Math.sin(g.angle) * exitSpeed;

    g.mood = 'triumph';
    g.moodTimer = 1.2;
    this.audio.playFanfare();
    this.particles.spawnExplosion(destX, destY, color, 16);
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

    const g = this.gliders.get(botId);
    if (!g || g.stunTimer > 0) return;

    let targetX = _width * 0.5;
    let targetY = _height * 0.5;
    let holdAction = false;

    // Target nearest wormhole if portal is ready, or closest relic
    let closestPortalDist = 99999;
    let portalTarget: { x: number; y: number } | null = null;

    if (g.portalCooldown <= 0) {
      for (const pair of this.pairs) {
        const d1 = Math.hypot(pair.p1.x - g.x, pair.p1.y - g.y);
        const d2 = Math.hypot(pair.p2.x - g.x, pair.p2.y - g.y);
        if (d1 < closestPortalDist) {
          closestPortalDist = d1;
          portalTarget = pair.p1;
        }
        if (d2 < closestPortalDist) {
          closestPortalDist = d2;
          portalTarget = pair.p2;
        }
      }
    }

    if (portalTarget && closestPortalDist < 200) {
      targetX = portalTarget.x;
      targetY = portalTarget.y;
      if (closestPortalDist < 110) {
        if (g.chargeTime < 0.85) {
          holdAction = true;
        } else {
          holdAction = false; // Slingshot surge into portal!
        }
      }
    } else {
      let minDist = 99999;
      for (const r of this.relics) {
        const d = Math.hypot(r.x - g.x, r.y - g.y);
        if (d < minDist) {
          minDist = d;
          targetX = r.x;
          targetY = r.y;
        }
      }
    }

    const dx = targetX - g.x;
    const dy = targetY - g.y;
    const targetAngle = Math.atan2(dy, dx);

    let angleDiff = targetAngle - g.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff -= Math.PI * 2;

    let turn = 0;
    if (Math.abs(angleDiff) > 0.08) {
      turn = angleDiff > 0 ? 1 : -1;
    }

    let delay = 0.24;
    if (difficulty === 'bot_easy') {
      delay = 0.42;
      if (Math.random() < 0.22) turn = -turn;
      if (Math.random() < 0.3) holdAction = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
      // Hard bot executes predictive sweet spot surges into rivals
      for (const other of this.gliders.values()) {
        if (other.id === botId) continue;
        if (Math.hypot(other.x - g.x, other.y - g.y) < 140 && Math.abs(angleDiff) < 0.3) {
          holdAction = false; // Unleash surge to shunt rival!
          break;
        }
      }
    }

    this.input.setBotInput(botId, holdAction, turn, 1, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    const theme = THEMES[this.currentThemeIdx];

    // 1. Quantum Void Background Gradient
    const voidGrad = ctx.createLinearGradient(0, 0, 0, height);
    voidGrad.addColorStop(0, theme.voidDark);
    voidGrad.addColorStop(1, theme.voidLight);
    ctx.fillStyle = voidGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // 2. Render Wormhole Pairs & Entanglement Lines
    for (const pair of this.pairs) {
      // Entanglement connecting thread
      ctx.strokeStyle = pair.color;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(pair.p1.x, pair.p1.y);
      ctx.lineTo(pair.p2.x, pair.p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;

      // Render both nodes
      this.renderSingularity(ctx, pair.p1.x, pair.p1.y, pair.radius, pair.p1.angle, pair.color);
      this.renderSingularity(ctx, pair.p2.x, pair.p2.y, pair.radius, pair.p2.angle, pair.color);
    }

    // 3. Render Quantum Relics
    for (const r of this.relics) {
      ctx.save();
      ctx.translate(r.x, r.y);

      // Glow halo
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 12;

      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(0, 0, r.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pulsing outer orbit ring
      const pulseR = r.radius + 4 + Math.sin(this.roundTimer * 4 + r.pulsePhase) * 3;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${r.value}`, 0, 3);
      ctx.restore();
    }

    // 4. Render Warp Gliders & Mascot Pilots
    for (const [id, g] of this.gliders.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';
      const isBot = p ? p.type !== 'human' : false;

      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);

      // Space shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(3, 4, g.radius + 4, g.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Slingshot Surge Holographic Aura
      if (g.isSurging) {
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, g.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Glider Delta Hull Body (2.5D Sleek Interceptor)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(18, 0);       // Nose
      ctx.lineTo(-12, -12);    // Starboard wingtip
      ctx.lineTo(-6, 0);       // Nacelle indent
      ctx.lineTo(-12, 12);     // Port wingtip
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glass Cockpit with Mascot Pilot
      ctx.save();
      ctx.rotate(Math.PI / 2);
      drawCharacter(ctx, 0, 0, 13, id, isBot, g.mood, g.animTimer, undefined);
      ctx.restore();

      // Underdog Chrono-Anchor
      if (g.isUnderdog) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, g.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge Singularity Gauge
      if (g.isCharging) {
        const ratio = g.chargeTime / 1.0;
        const sweetMin = g.isUnderdog ? 0.50 : 0.72;
        const sweetMax = g.isUnderdog ? 1.00 : 0.98;
        const isSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = isSweet ? '#00E5FF' : (ratio > sweetMax ? '#FF1744' : '#FFD700');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, g.radius + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
        ctx.stroke();
      }

      ctx.restore();

      // Floating Score & Combo Tag above glider
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const comboLabel = g.combo > 1 ? ` (x${g.combo} CHAIN!)` : '';
      ctx.fillText(`${g.score} pts${comboLabel}`, g.x, g.y - 28);

      if (g.stunTimer > 0) {
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ DESTABILIZED!', g.x, g.y - 42);
      } else if (g.isSurging) {
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ SLINGSHOT SURGE!', g.x, g.y - 42);
      }
    }

    // 5. Strict UI Overlays (Top-Center Safe Zone & Header Badge)
    // Global safe zone for timer: y: 12-44, width 160 centered.
    // Minigame Header Badge at y: 56, h: 28
    ctx.save();
    const badgeW = 280;
    const badgeH = 28;
    const badgeX = (width - badgeW) / 2;
    const badgeY = 56;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WORMHOLE LEAP • QUANTUM CHAIN', width / 2, badgeY + 18);
    ctx.restore();

    // 6. Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.name} [T]`, pillX + 10, pillY + 20);
    ctx.restore();

    // 7. Player Corner Cards (Safe offset y: height - 128, w: 130, h: 48)
    const cardY = height - 128;
    active.forEach((p, idx) => {
      const g = this.gliders.get(p.id);
      if (!g) return;

      const cardX = 20 + idx * 142;
      if (cardX + 130 > width) return;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 8, cardY + 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px Montserrat, sans-serif';
      ctx.fillText(`${g.score} pts`, cardX + 8, cardY + 38);

      ctx.fillStyle = '#B0BEC5';
      ctx.font = '10px Montserrat, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${g.combo}x CHAIN`, cardX + 122, cardY + 38);
      ctx.restore();
    });
  }

  private renderSingularity(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Accretion halo glow
    const radGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, radius);
    radGrad.addColorStop(0, '#FFFFFF');
    radGrad.addColorStop(0.4, color);
    radGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Spiraling accretion arms
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      const offset = (arm * Math.PI) / 2;
      for (let r = 6; r < radius; r += 4) {
        const theta = offset + r * 0.12;
        const px = Math.cos(theta) * r;
        const py = Math.sin(theta) * r;
        if (r === 6) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const g = this.gliders.get(p.id);
      return {
        playerId: p.id,
        score: g ? g.score : 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `Player ${typeof winnerId === 'number' ? winnerId + 1 : winnerId} leaped through space-time with legendary quantum singularity chains!`
        : 'All quantum wormholes collapsed into black holes!'
    };
  }
}
