import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface PaintballTheme {
  name: string;
  floorColor: string;
  gridLineColor: string;
  bunkerDefaultColor: string;
  bunkerStroke: string;
  themePillColor: string;
}

export const PAINTBALL_THEMES: PaintballTheme[] = [
  {
    name: 'Speedball Arena 🎯',
    floorColor: '#0F172A',
    gridLineColor: '#1E293B',
    bunkerDefaultColor: '#38BDF8',
    bunkerStroke: '#FFFFFF',
    themePillColor: '#38BDF8'
  },
  {
    name: 'Cyber Splat Grid ⚡',
    floorColor: '#050D1A',
    gridLineColor: 'rgba(6, 182, 212, 0.25)',
    bunkerDefaultColor: '#06B6D4',
    bunkerStroke: '#38BDF8',
    themePillColor: '#06B6D4'
  },
  {
    name: 'Toyroom Splatterfest 🎨',
    floorColor: '#1C1917',
    gridLineColor: '#292524',
    bunkerDefaultColor: '#F59E0B',
    bunkerStroke: '#FDE047',
    themePillColor: '#F59E0B'
  }
];

interface PaintPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  fireCooldown: number;
  stunTimer: number;
  isUnderdog: boolean;
  streak: number;
  botBurstTimer?: number;
  botBurstPause?: number;
}

interface PaintPellet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: PlayerId;
  color: string;
  bounces: number;
  lifetime: number;
  isSuper: boolean;
}

interface PaintSplat {
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface TargetPinata {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  isMega: boolean;
}

interface ArenaBunker {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export class PixelPaintballGame extends BaseGame {
  private playersState: Map<PlayerId, PaintPlayer> = new Map();
  private pellets: PaintPellet[] = [];
  private splats: PaintSplat[] = [];
  private pinatas: TargetPinata[] = [];
  private bunkers: ArenaBunker[] = [];
  private spawnPinataTimer: number = 2.0;

  private currentThemeIndex: number = 0;
  public currentMapName: string = 'Speedball X';

  private isSuddenDeath: boolean = false;
  private suddenDeathFlashTimer: number = 0;

  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private lastWidth: number = 800;
  private lastHeight: number = 600;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.currentThemeIndex = Math.floor(Math.random() * PAINTBALL_THEMES.length);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.roundTimer = 40;
    this.isFinished = false;
    this.isSuddenDeath = false;
    this.suddenDeathFlashTimer = 0;
    this.playersState.clear();
    this.pellets = [];
    this.splats = [];
    this.pinatas = [];
    this.bunkers = [];

    const cx = width / 2;
    const cy = height / 2;

    this.generateRandomMap(cx, cy, width, height);

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: width * 0.22, y: height * 0.28 },
      { x: width * 0.78, y: height * 0.28 },
      { x: width * 0.22, y: height * 0.72 },
      { x: width * 0.78, y: height * 0.72 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx % spawnOffsets.length];
      this.playersState.set(p.id, {
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: Math.atan2(height / 2 - pos.y, width / 2 - pos.x),
        score: 0,
        fireCooldown: 0,
        stunTimer: 0,
        isUnderdog: false,
        streak: 0
      });
    });

    // Spawn 2 initial pinatas
    for (let i = 0; i < 2; i++) {
      this.spawnPinata(width, height, false);
    }

    // Bind event listeners
    const canvas = this.input.getCanvas();
    if (canvas && !this.boundPointerDown) {
      this.boundPointerDown = this.handlePointerDown.bind(this);
      canvas.addEventListener('pointerdown', this.boundPointerDown);
    }
    if (!this.boundKeyDown) {
      this.boundKeyDown = this.handleKeyDown.bind(this);
      window.addEventListener('keydown', this.boundKeyDown);
    }

    // Expose debug hook
    (window as any).__PIXEL_PAINTBALL_DEBUG__ = {
      getPlayerState: (pid: PlayerId) => {
        const ps = this.playersState.get(pid);
        return ps ? { ...ps } : null;
      },
      setPlayerPos: (pid: PlayerId, x: number, y: number, angle = 0) => {
        const ps = this.playersState.get(pid);
        if (ps) {
          ps.x = x;
          ps.y = y;
          ps.vx = 0;
          ps.vy = 0;
          ps.angle = angle;
        }
      },
      getPellets: () => this.pellets.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, ownerId: p.ownerId })),
      getPinatas: () => this.pinatas.map((p) => ({ x: p.x, y: p.y, hp: p.hp })),
      getBunkers: () => [...this.bunkers],
      getThemeIndex: () => this.currentThemeIndex,
      setThemeIndex: (idx: number) => {
        this.currentThemeIndex = idx % PAINTBALL_THEMES.length;
      }
    };
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.toggleTheme();
    }
  }

  private toggleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % PAINTBALL_THEMES.length;
    this.audio.playTap();
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click: [T] Theme Pill at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.toggleTheme();
    }
  }

  public override destroy(): void {
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = null;
    }
  }

  private generateRandomMap(cx: number, cy: number, width: number, height: number): void {
    const archetypes = ['Speedball X', 'Fortress Ring', 'Dual Citadel', 'Scatter Pillboxes'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.bunkers = [];

    switch (this.currentMapName) {
      case 'Speedball X':
        this.bunkers = [
          { x: cx, y: cy, radius: 26, color: '#38BDF8' },
          { x: cx - width * 0.22, y: cy, radius: 22, color: '#EC4899' },
          { x: cx + width * 0.22, y: cy, radius: 22, color: '#EC4899' },
          { x: cx, y: cy - height * 0.18, radius: 20, color: '#FACC15' },
          { x: cx, y: cy + height * 0.18, radius: 20, color: '#10B981' }
        ];
        break;

      case 'Fortress Ring':
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const dist = Math.min(width, height) * 0.24;
          const colors = ['#38BDF8', '#EC4899', '#FACC15', '#10B981', '#A855F7', '#F97316'];
          this.bunkers.push({
            x: cx + Math.cos(ang) * dist,
            y: cy + Math.sin(ang) * dist,
            radius: 21,
            color: colors[i % colors.length]
          });
        }
        break;

      case 'Dual Citadel':
        this.bunkers = [
          { x: cx - width * 0.14, y: cy, radius: 28, color: '#38BDF8' },
          { x: cx + width * 0.14, y: cy, radius: 28, color: '#EC4899' },
          { x: cx, y: cy - height * 0.24, radius: 18, color: '#10B981' },
          { x: cx, y: cy + height * 0.24, radius: 18, color: '#FACC15' },
          { x: cx - width * 0.28, y: cy - height * 0.15, radius: 18, color: '#8B5CF6' },
          { x: cx + width * 0.28, y: cy + height * 0.15, radius: 18, color: '#8B5CF6' }
        ];
        break;

      case 'Scatter Pillboxes':
      default:
        const scatterColors = ['#38BDF8', '#EC4899', '#FACC15', '#10B981', '#A855F7', '#EF4444', '#06B6D4'];
        this.bunkers.push({ x: cx, y: cy, radius: 24, color: '#FBBF24' });
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.25;
          const dist = (i % 2 === 0 ? 0.26 : 0.18) * Math.min(width, height);
          this.bunkers.push({
            x: cx + Math.cos(ang) * dist,
            y: cy + Math.sin(ang) * dist,
            radius: 20 + (i % 3) * 2,
            color: scatterColors[i % scatterColors.length]
          });
        }
        break;
    }
  }

  private spawnPinata(width: number, height: number, isMega: boolean = false) {
    this.pinatas.push({
      x: width * 0.35 + Math.random() * width * 0.3,
      y: height * 0.35 + Math.random() * height * 0.3,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.5) * 80,
      hp: isMega ? 6 : 3,
      maxHp: isMega ? 6 : 3,
      radius: isMega ? 25 : 18,
      isMega
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    // Sudden Death Activation (<= 15s remaining)
    if (this.roundTimer <= 15.0 && !this.isSuddenDeath) {
      this.isSuddenDeath = true;
      this.audio.playBoost();
      this.particles.shake(6);
      // Spawn Golden Mega Piñata in center!
      this.spawnPinata(width, height, true);
    }

    if (this.isSuddenDeath) {
      this.suddenDeathFlashTimer += dt;
    }

    // Underdog surge calculations
    let maxScore = -1;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.isUnderdog = maxScore >= 3 && ps.score <= maxScore - 3;
    }

    // Spawn pinatas periodically
    this.spawnPinataTimer -= dt;
    if (this.spawnPinataTimer <= 0 && this.pinatas.length < (this.isSuddenDeath ? 4 : 3)) {
      this.spawnPinata(width, height, this.isSuddenDeath && Math.random() < 0.5);
      this.spawnPinataTimer = 5.0;
    }

    // Update Pinatas
    for (const pinata of this.pinatas) {
      pinata.x += pinata.vx * dt;
      pinata.y += pinata.vy * dt;

      if (pinata.x < 60 || pinata.x > width - 60) pinata.vx *= -1;
      if (pinata.y < 80 || pinata.y > height - 80) pinata.vy *= -1;
    }

    // Bot AI
    this.updateBots(dt, width, height);

    // Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      if (ps.fireCooldown > 0) ps.fireCooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.justAction(p.id) || this.input.justPressed(p.id);
      const isButtonHeld = this.input.isPressed(p.id);

      const inputX = steer;
      const inputY = -throttle;
      const inputMag = Math.hypot(inputX, inputY);

      const pCfg = this.getPlayer(p.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;

      // Underdog +20% move speed boost (264 vs 220)
      const baseMoveSpeed = ps.isUnderdog ? 264 : 220;

      if (!isBot) {
        if (inputMag > 0.15) {
          const normX = inputX / inputMag;
          const normY = inputY / inputMag;
          ps.vx = normX * baseMoveSpeed;
          ps.vy = normY * baseMoveSpeed;
          ps.angle = Math.atan2(normY, normX);
        } else if (isButtonHeld && this.input.getControlMode() === 'single_button') {
          const driveSpeed = ps.isUnderdog ? 228 : 190;
          ps.vx = Math.cos(ps.angle) * driveSpeed;
          ps.vy = Math.sin(ps.angle) * driveSpeed;
        } else {
          ps.vx *= Math.pow(0.80, dt * 60);
          ps.vy *= Math.pow(0.80, dt * 60);
          if (Math.abs(ps.vx) < 1) ps.vx = 0;
          if (Math.abs(ps.vy) < 1) ps.vy = 0;

          if (this.input.getControlMode() === 'single_button') {
            ps.angle += 2.0 * dt;
          }
        }
      } else {
        if (isButtonHeld) {
          const botSpeed = ps.isUnderdog ? 222 : 185;
          ps.vx = Math.cos(ps.angle) * botSpeed;
          ps.vy = Math.sin(ps.angle) * botSpeed;
        } else {
          ps.vx *= Math.pow(0.85, dt * 60);
          ps.vy *= Math.pow(0.85, dt * 60);
        }
      }

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Bunker collisions for players
      const r = 16;
      for (const b of this.bunkers) {
        const db = Math.hypot(ps.x - b.x, ps.y - b.y);
        if (db < b.radius + r && db > 0.01) {
          const nx = (ps.x - b.x) / db;
          const ny = (ps.y - b.y) / db;
          ps.x = b.x + nx * (b.radius + r);
          ps.y = b.y + ny * (b.radius + r);
        }
      }

      // Arena boundaries
      ps.x = Math.max(r + 10, Math.min(width - r - 10, ps.x));
      ps.y = Math.max(r + 65, Math.min(height - r - 65, ps.y));

      // Firing Paint Pellets
      const isFiring = isAction || (isButtonHeld && (isBot || inputMag < 0.15 || this.input.getControlMode() !== 'single_button'));
      if (isFiring && ps.fireCooldown <= 0) {
        // Fire cooldown: Underdog has faster fire rate (0.14s vs 0.22s) or Sudden Death (0.11s)
        const baseCooldown = this.isSuddenDeath ? 0.11 : (ps.isUnderdog ? 0.14 : 0.22);
        ps.fireCooldown = baseCooldown;
        this.input.consumeAction(p.id);
        this.audio.playLaser();

        const pelletSpeed = this.isSuddenDeath ? 600 : 520;
        this.pellets.push({
          x: ps.x + Math.cos(ps.angle) * 18,
          y: ps.y + Math.sin(ps.angle) * 18,
          vx: Math.cos(ps.angle) * pelletSpeed + (Math.random() - 0.5) * 40,
          vy: Math.sin(ps.angle) * pelletSpeed + (Math.random() - 0.5) * 40,
          ownerId: p.id,
          color: p.color,
          bounces: 0,
          lifetime: 1.4,
          isSuper: ps.isUnderdog || this.isSuddenDeath
        });
      }
    }

    // Solid Player-to-Player Elastic Collision
    const activeList = active
      .map((p) => this.playersState.get(p.id))
      .filter((ps): ps is PaintPlayer => Boolean(ps));

    for (let i = 0; i < activeList.length; i++) {
      for (let j = i + 1; j < activeList.length; j++) {
        const p1 = activeList[i];
        const p2 = activeList[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 34;

        if (dist < minDist) {
          const overlap = minDist - (dist || 0.01);
          const nx = dist > 0.001 ? dx / dist : 1;
          const ny = dist > 0.001 ? dy / dist : 0;

          p1.x -= nx * (overlap * 0.5);
          p1.y -= ny * (overlap * 0.5);
          p2.x += nx * (overlap * 0.5);
          p2.y += ny * (overlap * 0.5);

          const rvx = p2.vx - p1.vx;
          const rvy = p2.vy - p1.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          if (velAlongNormal < 0) {
            const restitution = 0.75;
            const impulse = -(1 + restitution) * velAlongNormal;
            p1.vx -= nx * (impulse * 0.5);
            p1.vy -= ny * (impulse * 0.5);
            p2.vx += nx * (impulse * 0.5);
            p2.vy += ny * (impulse * 0.5);

            this.audio.playBounce();
            this.particles.spawnSparks((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#FFFFFF', 3);
          }
        }
      }
    }

    // Update Pellets
    const maxBounces = this.isSuddenDeath ? 3 : 2;
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const pel = this.pellets[i];
      pel.lifetime -= dt;
      if (pel.lifetime <= 0) {
        this.pellets.splice(i, 1);
        continue;
      }

      pel.x += pel.vx * dt;
      pel.y += pel.vy * dt;

      // Bunker Ricochets
      let bounced = false;
      for (const b of this.bunkers) {
        const db = Math.hypot(pel.x - b.x, pel.y - b.y);
        if (db < b.radius + 5) {
          const nx = (pel.x - b.x) / db;
          const ny = (pel.y - b.y) / db;
          const dot = pel.vx * nx + pel.vy * ny;
          pel.vx -= 2 * dot * nx;
          pel.vy -= 2 * dot * ny;
          pel.x = b.x + nx * (b.radius + 6);
          pel.y = b.y + ny * (b.radius + 6);
          bounced = true;
          this.audio.playBounce();
          break;
        }
      }

      // Arena Wall Bounce & Splat
      if (pel.x < 15 || pel.x > width - 15) {
        pel.vx *= -1;
        bounced = true;
      }
      if (pel.y < 70 || pel.y > height - 70) {
        pel.vy *= -1;
        bounced = true;
      }

      if (bounced) {
        pel.bounces++;
        this.audio.playBounce();

        if (this.splats.length > 80) this.splats.shift();
        this.splats.push({
          x: pel.x,
          y: pel.y,
          radius: 8 + Math.random() * 8,
          color: pel.color
        });

        if (pel.bounces >= maxBounces) {
          this.pellets.splice(i, 1);
          continue;
        }
      }

      // Check Pinata Hit
      let hitPinata = false;
      for (let j = this.pinatas.length - 1; j >= 0; j--) {
        const pin = this.pinatas[j];
        if (Math.hypot(pel.x - pin.x, pel.y - pin.y) < pin.radius + 6) {
          pin.hp--;
          hitPinata = true;
          this.audio.playBounce();
          this.particles.spawnSparks(pin.x, pin.y, pin.isMega ? '#FBBF24' : '#F59E0B', 8);

          if (pin.hp <= 0) {
            this.pinatas.splice(j, 1);
            const owner = this.playersState.get(pel.ownerId);
            if (owner) {
              const pts = pin.isMega ? 5 : 3;
              owner.score += pts;
              this.audio.playTone(660, 0.1, 'triangle');
              setTimeout(() => this.audio.playTone(990, 0.15, 'sine'), 80);
              this.particles.spawnExplosion(pin.x, pin.y, pin.isMega ? '#FBBF24' : '#F59E0B', 24);
              this.particles.showFloatingText(`+${pts} ${pin.isMega ? 'MEGA PIÑATA!' : 'PIÑATA BUST!'}`, pin.x, pin.y - 12, '#FACC15', 18);
              if (owner.score >= 15) this.isFinished = true;
            }
          }
          break;
        }
      }
      if (hitPinata) {
        this.pellets.splice(i, 1);
        continue;
      }

      // Check Player Hit
      for (const p of active) {
        if (p.id === pel.ownerId) continue;
        const ps = this.playersState.get(p.id);
        if (!ps || ps.stunTimer > 0) continue;

        if (Math.hypot(pel.x - ps.x, pel.y - ps.y) < 18) {
          // Underdog stun duration halved (0.5s vs 1.0s)
          ps.stunTimer = ps.isUnderdog ? 0.5 : 1.0;
          ps.vx = pel.vx * 0.4;
          ps.vy = pel.vy * 0.4;
          ps.streak = 0;

          const shooter = this.playersState.get(pel.ownerId);
          if (shooter) {
            shooter.streak += 1;
            const streakBonus = shooter.streak >= 3 ? 2 : 1;
            shooter.score += streakBonus;
            this.audio.playScore();
            if (streakBonus > 1) {
              this.particles.showFloatingText(`+${streakBonus} STREAK!`, ps.x, ps.y - 16, '#FBBF24', 16);
            }
            if (shooter.score >= 15) this.isFinished = true;
          }

          this.splats.push({
            x: ps.x,
            y: ps.y,
            radius: 20 + Math.random() * 8,
            color: pel.color
          });

          this.particles.shake(0.3);
          this.audio.playStun();
          this.pellets.splice(i, 1);
          break;
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    let nearestOpp: PaintPlayer | null = null;
    let minOppDist = Infinity;
    for (const [id, opp] of this.playersState.entries()) {
      if (id === botId) continue;
      const d = Math.hypot(opp.x - ps.x, opp.y - ps.y);
      if (d < minOppDist) {
        minOppDist = d;
        nearestOpp = opp;
      }
    }

    let nearestPinata: TargetPinata | null = null;
    let minPinDist = Infinity;
    for (const pin of this.pinatas) {
      const d = Math.hypot(pin.x - ps.x, pin.y - ps.y);
      // Mega pinata priority
      const effectiveD = pin.isMega ? d * 0.6 : d;
      if (effectiveD < minPinDist) {
        minPinDist = effectiveD;
        nearestPinata = pin;
      }
    }

    if (ps.botBurstTimer === undefined) ps.botBurstTimer = 0;
    if (ps.botBurstPause === undefined) ps.botBurstPause = 0;

    const target = nearestPinata && minPinDist < 260 ? nearestPinata : nearestOpp;

    if (difficulty === 'bot_easy') {
      if (Math.random() < 0.03) {
        ps.angle = Math.random() * Math.PI * 2;
      }
      if (target && Math.hypot(target.x - ps.x, target.y - ps.y) < 220) {
        const rawAngle = Math.atan2(target.y - ps.y, target.x - ps.x);
        ps.angle = rawAngle + (Math.random() - 0.5) * 0.70;
        this.input.setBotPressed(botId, Math.random() < 0.35);
      } else {
        this.input.setBotPressed(botId, Math.random() < 0.20);
      }
      return;
    }

    if (difficulty === 'bot_normal') {
      if (!target) return;

      if (nearestOpp && minOppDist < 140) {
        const awayAngle = Math.atan2(ps.y - nearestOpp.y, ps.x - nearestOpp.x);
        ps.angle = awayAngle + (Math.random() - 0.5) * 0.6;
        this.input.setBotPressed(botId, true);
        return;
      }

      const rawTargetAngle = Math.atan2(target.y - ps.y, target.x - ps.x);
      const aimJitter = (Math.sin(Date.now() * 0.003 + botId) * 0.22) + (Math.random() - 0.5) * 0.15;
      const desiredAngle = rawTargetAngle + aimJitter;

      let angleDiff = desiredAngle - ps.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      ps.angle += angleDiff * Math.min(1.0, 5.0 * dt);

      ps.botBurstTimer -= dt;
      if (ps.botBurstPause > 0) {
        ps.botBurstPause -= dt;
        this.input.setBotPressed(botId, false);
      } else {
        this.input.setBotPressed(botId, true);
        if (ps.botBurstTimer <= 0) {
          ps.botBurstTimer = 0.45 + Math.random() * 0.35;
          ps.botBurstPause = 0.40 + Math.random() * 0.35;
        }
      }
    } else {
      // Hard: tactical kiting with lead compensation
      if (!target) return;
      if (nearestOpp && minOppDist < 120) {
        ps.angle = Math.atan2(ps.y - nearestOpp.y, ps.x - nearestOpp.x);
        this.input.setBotPressed(botId, true);
        return;
      }

      const leadX = target.x + (target.vx || 0) * 0.12;
      const leadY = target.y + (target.vy || 0) * 0.12;
      const desiredAngle = Math.atan2(leadY - ps.y, leadX - ps.x) + (Math.random() - 0.5) * 0.08;
      let angleDiff = desiredAngle - ps.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      ps.angle += angleDiff * Math.min(1.0, 7.5 * dt);

      this.input.setBotPressed(botId, true);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = PAINTBALL_THEMES[this.currentThemeIndex];

    // Arena Floor
    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(0, 0, width, height);

    // Floor tactical grid
    ctx.strokeStyle = theme.gridLineColor;
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, height - 60);
      ctx.stroke();
    }
    for (let y = 60; y < height - 60; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Render Paint Splats on Floor
    for (const splat of this.splats) {
      ctx.save();
      ctx.fillStyle = splat.color + '66';
      ctx.beginPath();
      ctx.arc(splat.x, splat.y, splat.radius, 0, Math.PI * 2);
      ctx.fill();

      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(splat.x + Math.cos(a) * (splat.radius + 4), splat.y + Math.sin(a) * (splat.radius + 4), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Render Tactical Inflatable Bunkers
    for (const b of this.bunkers) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = theme.bunkerStroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fill();

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('COVER', b.x, b.y);
      ctx.restore();
    }

    // Render Pinatas
    for (const pin of this.pinatas) {
      ctx.save();
      ctx.shadowColor = pin.isMega ? '#FBBF24' : '#F59E0B';
      ctx.shadowBlur = pin.isMega ? 18 : 12;
      ctx.fillStyle = pin.isMega ? '#FDE047' : '#FBBF24';
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, pin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pin.isMega ? '#B45309' : '#D97706';
      ctx.lineWidth = pin.isMega ? 3 : 2;
      ctx.stroke();

      ctx.fillStyle = '#78350F';
      ctx.font = `900 ${pin.isMega ? 13 : 11}px Montserrat, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pin.isMega ? `🌟 ${pin.hp}` : `🎯 ${pin.hp}`, pin.x, pin.y);
      ctx.restore();
    }

    // Render Paint Pellets
    for (const pel of this.pellets) {
      ctx.save();
      ctx.shadowColor = pel.color;
      ctx.shadowBlur = pel.isSuper ? 16 : 10;
      ctx.fillStyle = pel.color;
      ctx.beginPath();
      ctx.arc(pel.x, pel.y, pel.isSuper ? 6.5 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Core glow
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pel.x, pel.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      const isBot = p.type.startsWith('bot_');

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Underdog Paint Shield Aura
      if (ps.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.rotate(ps.angle);

      // Stun ring if hit
      if (ps.stunTimer > 0) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Blaster Barrel
      ctx.fillStyle = '#334155';
      ctx.fillRect(8, -3.5, 12, 7);

      // Laser Aim Guide for Human Players
      const isHuman = !isBot;
      if (isHuman && ps.stunTimer <= 0) {
        ctx.save();
        ctx.strokeStyle = p.colorLight + '99';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(60, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = p.colorLight;
        ctx.beginPath();
        ctx.arc(60, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Rover Body
      ctx.shadowColor = p.colorDark;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Paint Hopper Tank on back
      ctx.fillStyle = p.colorLight;
      ctx.beginPath();
      ctx.arc(-7, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Mascot Face in Turret Hatch
      let mood: CharacterMood = 'focused';
      if (ps.stunTimer > 0) {
        mood = 'shocked';
      } else if (ps.score >= 12 || this.isFinished) {
        mood = 'triumph';
      } else if (ps.streak >= 2) {
        mood = 'happy';
      }

      drawCharacter(ctx, 0, 0, 8, p.id, isBot, mood, 0);

      ctx.restore();

      // Spinning Cartoon Stun Stars
      if (ps.stunTimer > 0) {
        ctx.save();
        for (let s = 0; s < 3; s++) {
          const sAngle = (Date.now() * 0.008) + (s * Math.PI * 2 / 3);
          const sx = ps.x + Math.cos(sAngle) * 16;
          const sy = ps.y - 20 + Math.sin(sAngle) * 6;
          ctx.fillStyle = '#FACC15';
          ctx.shadowColor = '#FACC15';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Player Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, ps.x, ps.y - 20);
    }

    // Minigame Subheader at safe position y: 56
    const hudW = Math.min(width - 60, 480);
    const hudH = 26;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 13);
    ctx.fill();
    ctx.strokeStyle = this.isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.isSuddenDeath) {
      const flash = Math.sin(this.suddenDeathFlashTimer * 10) > 0;
      ctx.fillStyle = flash ? '#FDE047' : '#EF4444';
      ctx.fillText('⚡ SUDDEN DEATH: MEGA PIÑATAS & RAPID RICOCHETS! ⚡', width / 2, hudY + 13);
    } else {
      const summary = active.map((p) => {
        const ps = this.playersState.get(p.id);
        return `${p.name}: 🎨 ${ps?.score || 0}/15`;
      }).join('   •   ');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(summary, width / 2, hudY + 13);
    }
    ctx.restore();

    // Theme Pill at bottom-left: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, pillX + pillW * 0.5, pillY + pillH * 0.5);

    // Right-aligned Control Hints
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '11px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Steer: WASD / Arrows • Shoot: Space / Enter', width - 24, height - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    if (this.isFinished) return true;
    for (const ps of this.playersState.values()) {
      if (ps.score >= 15) return true;
    }
    return false;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    let winnerId: PlayerId | null = null;
    let highestScore = -1;

    active.forEach((p) => {
      const ps = this.playersState.get(p.id);
      const sc = ps?.score || 0;
      if (sc > highestScore) {
        highestScore = sc;
        winnerId = p.id;
      }
    });

    const sorted = [...active].sort((a, b) => {
      const scA = this.playersState.get(a.id)?.score || 0;
      const scB = this.playersState.get(b.id)?.score || 0;
      return scB - scA;
    });

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.playersState.get(p.id)?.score || 0
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} dominated the Paintball Arena with ${highestScore} points!` : 'Paint splatter covered the arena in a draw!'
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
