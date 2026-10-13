import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface SaloonItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'mug' | 'whiskey' | 'bounty';
  value: number;
  color: string;
  radius: number;
  pulsePhase: number;
}

interface FlyingChair {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spinSpeed: number;
}

interface SaloonOutlaw {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3
  isCharging: boolean;
  overheatTimer: number;
  punchTimer: number;
  spinTimer: number;
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  floorColorA: string;
  floorColorB: string;
  woodTrimColor: string;
  barColor: string;
  chairColor: string;
  lanternGlow: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Tombstone Saloon',
    icon: '🤠',
    floorColorA: '#3E2723',
    floorColorB: '#4E342E',
    woodTrimColor: '#5D4037',
    barColor: '#27170E',
    chairColor: '#8D6E63',
    lanternGlow: 'rgba(255, 183, 77, 0.25)'
  },
  {
    name: 'Deadwood Gold Mine',
    icon: '⛏️',
    floorColorA: '#2A1E17',
    floorColorB: '#35271E',
    woodTrimColor: '#6D4C41',
    barColor: '#1B130E',
    chairColor: '#A1887F',
    lanternGlow: 'rgba(255, 215, 0, 0.22)'
  },
  {
    name: 'Ghost Town Cantina',
    icon: '🌵',
    floorColorA: '#261815',
    floorColorB: '#1C1210',
    woodTrimColor: '#4E342E',
    barColor: '#150A08',
    chairColor: '#795548',
    lanternGlow: 'rgba(38, 198, 218, 0.22)'
  }
];

export class SaloonBrawlerGame extends BaseGame {
  private outlaws: Map<PlayerId, SaloonOutlaw> = new Map();
  private items: SaloonItem[] = [];
  private chairs: FlyingChair[] = [];
  private nextItemId = 1;
  private nextChairId = 1;
  private itemSpawnTimer = 0;
  private chairSpawnTimer = 0;
  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;
  private tables: { x: number; y: number; r: number }[] = [];

  // Key / Click listeners
  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.setupListeners();
  }

  private setupListeners(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setTheme(0);
      } else if (e.key === '2') {
        this.setTheme(1);
      } else if (e.key === '3') {
        this.setTheme(2);
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      // Theme pill check: bottom-left x: 20, y: height - 44, w: 170, h: 32
      const canvasHeight = canvas.height;
      if (clickX >= 20 && clickX <= 190 && clickY >= canvasHeight - 44 && clickY <= canvasHeight - 12) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickHandler);
  }

  public cycleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
    this.audio.playTap();
  }

  public setTheme(idx: number): void {
    if (idx >= 0 && idx < THEMES.length) {
      this.currentThemeIndex = idx;
      this.audio.playTap();
    }
  }

  public override destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    if (this.clickHandler) {
      window.removeEventListener('click', this.clickHandler);
      this.clickHandler = undefined;
    }
    super.destroy();
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.outlaws.clear();
    this.items = [];
    this.chairs = [];
    this.nextItemId = 1;
    this.nextChairId = 1;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;
    this.itemSpawnTimer = 0.5;
    this.chairSpawnTimer = 1.5;

    // Saloon Tables
    this.tables = [
      { x: width * 0.28, y: height * 0.32, r: 34 },
      { x: width * 0.72, y: height * 0.32, r: 34 },
      { x: width * 0.28, y: height * 0.68, r: 34 },
      { x: width * 0.72, y: height * 0.68, r: 34 }
    ];

    // Initial items
    for (let i = 0; i < 12; i++) {
      this.spawnItem(width, height);
    }

    const active = this.getActivePlayers();
    const spawnCorners = [
      { x: 90, y: height * 0.5 - 60, angle: 0 },
      { x: width - 90, y: height * 0.5 - 60, angle: Math.PI },
      { x: 90, y: height * 0.5 + 60, angle: 0 },
      { x: width - 90, y: height * 0.5 + 60, angle: Math.PI }
    ];

    active.forEach((p, idx) => {
      const pos = spawnCorners[idx % spawnCorners.length];
      this.outlaws.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        punchTimer: 0,
        spinTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: idx * 0.5,
        sabotageCount: 0
      });
    });
  }

  private spawnItem(width: number, height: number): void {
    const rand = Math.random();
    let type: 'mug' | 'whiskey' | 'bounty' = 'mug';
    let value = 20;
    let color = '#FFB300';
    let radius = 11;

    if (rand < 0.55) {
      type = 'mug';
      value = 20;
      color = '#FFB300';
      radius = 11;
    } else if (rand < 0.85) {
      type = 'whiskey';
      value = 40;
      color = '#FF7043';
      radius = 13;
    } else {
      type = 'bounty';
      value = 75;
      color = '#FFD54F';
      radius = 15;
    }

    this.items.push({
      id: this.nextItemId++,
      x: 80 + Math.random() * (width - 160),
      y: 90 + Math.random() * (height - 180),
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      type,
      value,
      color,
      radius,
      pulsePhase: Math.random() * Math.PI * 2
    });
  }

  private spawnChair(width: number, height: number): void {
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -20 : width + 20;
    const startY = 90 + Math.random() * (height - 180);
    const speed = (200 + Math.random() * 120) * (fromLeft ? 1 : -1);

    this.chairs.push({
      id: this.nextChairId++,
      x: startX,
      y: startY,
      vx: speed,
      vy: (Math.random() - 0.5) * 60,
      angle: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 12
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
      if (this.announcementTimer <= 0) {
        this.announcementText = '';
      }
    }

    this.updateBots(dt, width, height);

    // Replenish items
    while (this.items.length < 10) {
      this.spawnItem(width, height);
    }

    // Spawn flying barstools
    this.chairSpawnTimer -= dt;
    if (this.chairSpawnTimer <= 0) {
      this.spawnChair(width, height);
      this.chairSpawnTimer = 1.4 + Math.random() * 1.0;
    }

    // Update flying chairs
    for (let i = this.chairs.length - 1; i >= 0; i--) {
      const chair = this.chairs[i];
      chair.x += chair.vx * dt;
      chair.y += chair.vy * dt;
      chair.angle += chair.spinSpeed * dt;

      if (chair.x < -60 || chair.x > width + 60) {
        this.chairs.splice(i, 1);
      }
    }

    // Sudden death check (<= 12s)
    const isSuddenDeath = this.roundTimer <= 12.0;

    // Leader / Underdog calculation
    let topScore = -1;
    for (const o of this.outlaws.values()) {
      if (o.score > topScore) topScore = o.score;
    }

    // Update Outlaws
    for (const [id, o] of this.outlaws.entries()) {
      o.animTimer += dt;
      const isUnderdog = topScore >= 35 && o.score <= topScore - 30;

      if (o.spinTimer > 0) {
        o.spinTimer -= dt;
        o.angle += 12 * dt;
        o.vx *= Math.pow(0.92, dt * 60);
        o.vy *= Math.pow(0.92, dt * 60);
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.mood = 'shocked';
        continue;
      }

      if (o.stunTimer > 0) {
        o.stunTimer -= dt;
        o.vx *= Math.pow(0.85, dt * 60);
        o.vy *= Math.pow(0.85, dt * 60);
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.mood = 'shocked';
        continue;
      }

      if (o.overheatTimer > 0) {
        o.overheatTimer -= dt;
        o.mood = 'shocked';
      }

      if (o.punchTimer > 0) {
        o.punchTimer -= dt;
      }

      if (o.streakTimer > 0) {
        o.streakTimer -= dt;
        if (o.streakTimer <= 0) {
          o.streakCount = 0;
        }
      }

      const steerX = this.input.getSteer(id);
      const throttleY = -this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      // Movement
      const speedMult = (isUnderdog ? 1.25 : 1.0) * (o.punchTimer > 0 ? 1.4 : 1.0);
      const accel = 460 * speedMult;
      o.vx += steerX * accel * dt;
      o.vy += throttleY * accel * dt;

      // Floor friction
      o.vx *= Math.pow(0.90, dt * 60);
      o.vy *= Math.pow(0.90, dt * 60);

      o.x += o.vx * dt;
      o.y += o.vy * dt;

      // Keep within saloon walls
      const pad = 44;
      o.x = Math.max(pad, Math.min(width - pad, o.x));
      o.y = Math.max(pad, Math.min(height - pad, o.y));

      // Table bounce
      for (const t of this.tables) {
        const d = Math.hypot(o.x - t.x, o.y - t.y);
        const minDist = t.r + 20;
        if (d < minDist && d > 0.001) {
          const nx = (o.x - t.x) / d;
          const ny = (o.y - t.y) / d;
          o.x = t.x + nx * minDist;
          o.y = t.y + ny * minDist;
          o.vx *= -0.6;
          o.vy *= -0.6;
        }
      }

      // Heading
      if (Math.hypot(o.vx, o.vy) > 20) {
        o.angle = Math.atan2(o.vy, o.vx);
      }

      // Hold-to-Charge Haymaker Punch & Barstool Smash Sweet Spot (72%–98%)
      if (isAction && o.overheatTimer <= 0) {
        o.isCharging = true;
        o.chargeTime += dt;
        o.mood = 'focused';

        // Charge sparks
        if (Math.random() < 0.35) {
          const sparkColor = o.chargeTime >= 0.72 && o.chargeTime <= 0.98 ? '#00E676' : '#FFB300';
          this.particles.emit(
            o.x + Math.cos(o.angle) * 16,
            o.y + Math.sin(o.angle) * 16,
            2,
            sparkColor
          );
        }

        // Overswing blowout
        if (o.chargeTime > 1.25) {
          o.overheatTimer = 0.95;
          o.chargeTime = 0;
          o.isCharging = false;
          o.mood = 'shocked';
          this.audio.playExplosion();
          this.screenShake = 7;
          this.particles.emit(o.x, o.y, 14, '#FF3D00');
          this.announcementText = 'OVERSWING STUMBLE!';
          this.announcementTimer = 0.8;
        }
      } else if (o.isCharging) {
        // Released! Evaluate charge
        const sweetSpot = (isUnderdog && o.chargeTime >= 0.50 && o.chargeTime <= 1.05) ||
                          (!isUnderdog && o.chargeTime >= 0.72 && o.chargeTime <= 0.98);

        if (sweetSpot) {
          // Saloon Super-Haymaker!
          o.punchTimer = 1.2;
          o.score += 25;
          o.mood = 'triumph';
          this.audio.playScore();
          this.screenShake = 9;
          this.announcementText = 'SUPER-HAYMAKER! +25';
          this.announcementTimer = 1.0;

          // Lunge forward
          o.vx += Math.cos(o.angle) * 380;
          o.vy += Math.sin(o.angle) * 380;

          // Shatter any flying chair in 65px radius
          for (let c = this.chairs.length - 1; c >= 0; c--) {
            const chair = this.chairs[c];
            if (Math.hypot(o.x - chair.x, o.y - chair.y) < 65) {
              this.chairs.splice(c, 1);
              this.particles.emit(chair.x, chair.y, 14, '#8D6E63');
              this.audio.playBounce();
            }
          }

          this.particles.emit(o.x, o.y, 16, '#00E676');
        } else {
          // Normal punch
          o.punchTimer = 0.35;
          this.audio.playTap();
          o.vx += Math.cos(o.angle) * 160;
          o.vy += Math.sin(o.angle) * 160;
        }

        o.chargeTime = 0;
        o.isCharging = false;
      } else {
        o.mood = 'idle';
      }

      // Flying Chair hazard collision
      if (o.punchTimer <= 0 && !isUnderdog) {
        for (let c = this.chairs.length - 1; c >= 0; c--) {
          const chair = this.chairs[c];
          if (Math.hypot(o.x - chair.x, o.y - chair.y) < 26) {
            o.spinTimer = 1.1;
            o.score = Math.max(0, o.score - 10);
            this.audio.playBounce();
            this.screenShake = 8;
            this.particles.emit(chair.x, chair.y, 12, '#EF4444');
            this.chairs.splice(c, 1);
            break;
          }
        }
      }

      // Item pickup (Mugs, Whiskey, Bounties)
      for (let i = this.items.length - 1; i >= 0; i--) {
        const item = this.items[i];
        if (Math.hypot(o.x - item.x, o.y - item.y) < item.radius + 20) {
          const earned = item.value * (isSuddenDeath ? 2 : 1);
          o.score += earned;
          o.streakCount = Math.min(3, o.streakCount + 1);
          o.streakTimer = 2.0;
          this.audio.playScore();
          this.particles.emit(item.x, item.y, 12, item.color);
          this.items.splice(i, 1);
          o.mood = 'triumph';
          break;
        }
      }
    }

    // Physical Outlaw Bumping & Table-Crashing Sabotage
    const outlawArray = Array.from(this.outlaws.values());
    for (let i = 0; i < outlawArray.length; i++) {
      for (let j = i + 1; j < outlawArray.length; j++) {
        const o1 = outlawArray[i];
        const o2 = outlawArray[j];
        const dx = o2.x - o1.x;
        const dy = o2.y - o1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 40;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          o1.x -= nx * overlap * 0.5;
          o1.y -= ny * overlap * 0.5;
          o2.x += nx * overlap * 0.5;
          o2.y += ny * overlap * 0.5;

          const kx = o1.vx - o2.vx;
          const ky = o1.vy - o2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          const impulse = Math.hypot(kx, ky);
          o1.vx -= p * nx * 1.35;
          o1.vy -= p * ny * 1.35;
          o2.vx += p * nx * 1.35;
          o2.vy += p * ny * 1.35;

          if (impulse > 120 || o1.punchTimer > 0 || o2.punchTimer > 0) {
            this.audio.playBounce();
            this.screenShake = Math.min(14, impulse * 0.06 + 4);
            this.hitStopTimer = 0.04;

            const attacker = o1.punchTimer > o2.punchTimer ? o1 : (o2.punchTimer > o1.punchTimer ? o2 : null);
            if (attacker) {
              const victim = attacker === o1 ? o2 : o1;
              attacker.score += 30;
              attacker.sabotageCount++;
              victim.stunTimer = 0.65;
              victim.score = Math.max(0, victim.score - 10);
              this.particles.emit((o1.x + o2.x) * 0.5, (o1.y + o2.y) * 0.5, 14, '#FF1744');
              this.announcementText = 'BARROOM SHUNT! +30';
              this.announcementTimer = 1.0;
            }
          }
        }
      }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const o = this.outlaws.get(botId);
    if (!o || o.spinTimer > 0 || o.stunTimer > 0) return;

    let delay = 0.23;
    let blunderChance = 0.12;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      blunderChance = 0.02;
    }

    // Target Selection: Nearest valuable item, or punch nearby rival
    let targetX = _width * 0.5;
    let targetY = _height * 0.5;
    let minDist = 99999;
    let closest: SaloonItem | null = null;

    for (const item of this.items) {
      const d = Math.hypot(item.x - o.x, item.y - o.y);
      const weight = item.type === 'bounty' ? 0.6 : (item.type === 'whiskey' ? 0.8 : 1.0);
      const scoreDist = d * weight;
      if (scoreDist < minDist) {
        minDist = scoreDist;
        closest = item;
      }
    }

    if (closest) {
      targetX = closest.x;
      targetY = closest.y;
    }

    // Check if rival is near to punch
    let wantPunch = false;
    for (const [otherId, rival] of this.outlaws.entries()) {
      if (otherId === botId) continue;
      const d = Math.hypot(rival.x - o.x, rival.y - o.y);
      if (d < 55) {
        targetX = rival.x;
        targetY = rival.y;
        wantPunch = true;
        break;
      }
    }

    const dx = targetX - o.x;
    const dy = targetY - o.y;
    let steerX = 0;
    let throttleY = 0;

    if (Math.hypot(dx, dy) > 20) {
      steerX = Math.max(-1, Math.min(1, dx / 80));
      throttleY = Math.max(-1, Math.min(1, dy / 80));
    }

    // Hold-to-charge sweet spot
    let wantAction = wantPunch || (o.chargeTime > 0 && o.chargeTime < 0.85);
    if (o.chargeTime >= 0.78 && o.chargeTime <= 0.95) {
      wantAction = false; // Release at sweet spot!
    }

    if (Math.random() < blunderChance) {
      steerX += (Math.random() - 0.5) * 0.7;
      throttleY += (Math.random() - 0.5) * 0.7;
      wantAction = Math.random() < 0.3;
    }

    this.input.setBotInput(botId, wantAction, steerX, -throttleY, wantAction);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIndex];

    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Saloon Wood Plank Floorboards
    const plankH = 26;
    for (let y = 0; y < height; y += plankH) {
      ctx.fillStyle = (Math.floor(y / plankH) % 2 === 0) ? theme.floorColorA : theme.floorColorB;
      ctx.fillRect(0, y, width, plankH);

      ctx.strokeStyle = theme.woodTrimColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Grand Mahogany Bar Counter (Top Center)
    ctx.fillStyle = theme.barColor;
    ctx.fillRect(width * 0.25, 10, width * 0.5, 40);

    ctx.strokeStyle = '#D7CCC8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(width * 0.25, 10, width * 0.5, 40);

    // Warm lantern glow across the bar
    ctx.fillStyle = theme.lanternGlow;
    ctx.fillRect(0, 0, width, height);

    // 3. Saloon Poker Tables
    for (const t of this.tables) {
      ctx.save();
      ctx.translate(t.x, t.y);

      // Table felt
      ctx.fillStyle = '#1B5E20';
      ctx.beginPath();
      ctx.arc(0, 0, t.r, 0, Math.PI * 2);
      ctx.fill();

      // Wood edge trim
      ctx.strokeStyle = '#3E2723';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Poker cards / chips on table
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-8, -6, 6, 9);
      ctx.fillRect(3, -4, 6, 9);
      ctx.fillStyle = '#D32F2F';
      ctx.beginPath();
      ctx.arc(0, 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Saloon Items (Beer Mugs, Whiskey Bottles, Bounties)
    for (const item of this.items) {
      ctx.save();
      ctx.translate(item.x, item.y);
      const bob = Math.sin(item.pulsePhase) * 2;

      // Glow
      ctx.fillStyle = item.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, bob, item.radius * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Core item
      if (item.type === 'mug') {
        ctx.fillStyle = '#FFB300';
        ctx.fillRect(-6, bob - 6, 12, 14);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-6, bob - 10, 12, 4); // Foam
        ctx.strokeStyle = '#8D6E63';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-6, bob - 6, 12, 14);
      } else if (item.type === 'whiskey') {
        ctx.fillStyle = '#FF7043';
        ctx.fillRect(-5, bob - 8, 10, 16);
        ctx.fillRect(-2, bob - 13, 4, 5); // Neck
      } else {
        // Bounty Gold Pouch
        ctx.fillStyle = '#FFD54F';
        ctx.beginPath();
        ctx.arc(0, bob, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Value label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${item.value}`, 0, bob + item.radius + 11);
      ctx.restore();
    }

    // 5. Flying Barstools
    for (const chair of this.chairs) {
      ctx.save();
      ctx.translate(chair.x, chair.y);
      ctx.rotate(chair.angle);

      ctx.fillStyle = theme.chairColor;
      ctx.fillRect(-12, -12, 24, 24);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(-12, -12, 24, 24);

      ctx.restore();
    }

    // 6. Outlaws with Cowboy Hats & Mascot Faces
    for (const [id, o] of this.outlaws.entries()) {
      ctx.save();
      ctx.translate(o.x, o.y);
      const pConfig = this.getPlayer(id);
      const color = pConfig?.color || '#EF4444';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      // Charge aura
      if (o.isCharging) {
        const pct = Math.min(1, o.chargeTime / 1.0);
        const sweetSpot = o.chargeTime >= 0.72 && o.chargeTime <= 0.98;
        ctx.strokeStyle = sweetSpot ? '#00E676' : '#FFB300';
        ctx.lineWidth = sweetSpot ? 4 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22 + pct * 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = sweetSpot ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 179, 0, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, 22 + pct * 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Punch trail
      if (o.punchTimer > 0) {
        ctx.strokeStyle = '#FF1744';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.rotate(o.angle);

      // Outlaw Body & Poncho
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cowboy Hat Brim
      ctx.fillStyle = '#4E342E';
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cowboy Hat Crown
      ctx.fillStyle = '#3E2723';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();

      // Mascot face in center
      drawCharacter(ctx, 2, 0, 10, id, isBot, o.mood, o.animTimer, undefined);

      ctx.restore();

      // Score Pill Above Outlaw
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(o.x - 22, o.y - 36, 44, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${o.score}`, o.x, o.y - 24);
    }

    // 7. Central Announcement Banner
    if (this.announcementTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(width * 0.5 - 150, height * 0.36, 300, 36, 10);
      ctx.fill();
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFEB3B';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.announcementText, width * 0.5, height * 0.36 + 23);
      ctx.restore();
    }

    // 8. UI Header Badge (y: 56, h: 28)
    ctx.save();
    const badgeW = 260;
    const badgeH = 26;
    const badgeX = width * 0.5 - badgeW * 0.5;
    const badgeY = 56;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🤠 SALOON BRAWLER • BARROOM MELEE 🤠', width * 0.5, badgeY + 17);
    ctx.restore();

    // 9. Theme Pill (Bottom-Left: x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.icon} ${theme.name}`, pillX + 12, pillY + 20);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('[T] / [1-3]', pillX + pillW - 10, pillY + 20);
    ctx.restore();

    // 10. Corner Player Cards (y: height - 128, 130x48px)
    const cardW = 130;
    const cardH = 48;
    const cardY = height - 128;
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const o = this.outlaws.get(p.id);
      if (!o) return;

      let cardX = 20;
      if (idx === 1) cardX = width - cardW - 20;
      else if (idx === 2) cardX = 160;
      else if (idx === 3) cardX = width - cardW - 160;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Color pip
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cardX + 14, cardY + 24, 7, 0, Math.PI * 2);
      ctx.fill();

      // Name & Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 28, cardY + 20);

      ctx.fillStyle = '#FFD54F';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${o.score} pts`, cardX + 28, cardY + 38);
      ctx.restore();
    });

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.outlaws.entries()).map(([playerId, o]) => ({
      playerId,
      score: o.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} served up justice in the saloon with ${scores[0].score} pts!`
        : 'The saloon brawl settled into a dusty draw!'
    };
  }
}
