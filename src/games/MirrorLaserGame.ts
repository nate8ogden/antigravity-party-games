import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type MirrorTheme = 'chamber' | 'solar' | 'quantum';

interface ThemeConfig {
  id: MirrorTheme;
  name: string;
  badge: string;
  bgGradient: [string, string];
  emitterBorder: string;
  beamCoreColor: string;
  beamGlowColor: string;
  prismColor: string;
  gridLineColor: string;
}

const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'chamber',
    name: 'Prism Chamber',
    badge: '💎 PRISM CHAMBER',
    bgGradient: ['#0F172A', '#020617'],
    emitterBorder: '#06B6D4',
    beamCoreColor: '#FFFFFF',
    beamGlowColor: 'rgba(6, 182, 212, 0.75)',
    prismColor: '#38BDF8',
    gridLineColor: 'rgba(51, 65, 85, 0.20)'
  },
  {
    id: 'solar',
    name: 'Solar Observatory',
    badge: '☀️ SOLAR CORE',
    bgGradient: ['#1C1917', '#0C0A09'],
    emitterBorder: '#F59E0B',
    beamCoreColor: '#FFFFFF',
    beamGlowColor: 'rgba(245, 158, 11, 0.80)',
    prismColor: '#FBBF24',
    gridLineColor: 'rgba(217, 119, 6, 0.18)'
  },
  {
    id: 'quantum',
    name: 'Quantum Core',
    badge: '⚡ QUANTUM CORE',
    bgGradient: ['#090D1A', '#040711'],
    emitterBorder: '#EC4899',
    beamCoreColor: '#FFFFFF',
    beamGlowColor: 'rgba(236, 72, 153, 0.80)',
    prismColor: '#8B5CF6',
    gridLineColor: 'rgba(139, 92, 246, 0.16)'
  }
];

interface PlayerMirrorCore {
  id: PlayerId;
  coreX: number;
  coreY: number;
  mirrorX: number;
  mirrorY: number;
  mirrorAngle: number;
  targetMirrorAngle: number;
  health: number; // 3 lives
  score: number;
  laserHits: number;
  damageFlash: number;
  invulnerableTimer: number;
  botReactionTimer: number;
  isFocusing: boolean;
  focusCharge: number; // 0..1
  mood: CharacterMood;
  moodTimer: number;
  isUnderdog: boolean;
  barrierActive: boolean;
}

interface SecondaryPrism {
  x: number;
  y: number;
  radius: number;
  angle: number;
  isSplitter: boolean;
  pulseTimer: number;
}

interface LaserRaySegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  isSupercharged: boolean;
}

export class MirrorLaserGame extends BaseGame {
  private playerStates: Map<PlayerId, PlayerMirrorCore> = new Map();
  private prisms: SecondaryPrism[] = [];
  private laserSegments: LaserRaySegment[] = [];
  private laserPulseTimer: number = 0;
  private laserInterval: number = 2.2;
  private isLaserFiring: boolean = false;
  private laserFireDuration: number = 0.55;
  public currentTheme: MirrorTheme = 'chamber';
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;

  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.bindKeyboardShortcuts();
    this.bindCanvasPointer();
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 55.0;
    this.isFinished = false;
    this.laserPulseTimer = 1.0;
    this.isLaserFiring = false;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;

    this.playerStates.clear();
    const active = this.getActivePlayers();

    const cx = width / 2;
    const cy = height / 2 + 12;

    const coreDist = Math.min(width * 0.38, height * 0.38);
    const mirrorDist = Math.min(width * 0.20, height * 0.20);

    const angles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.75, Math.PI * 0.25];

    active.forEach((p, idx) => {
      const a = angles[idx % angles.length];
      const coreX = cx + Math.cos(a) * coreDist;
      const coreY = cy + Math.sin(a) * coreDist;
      const mirrorX = cx + Math.cos(a) * mirrorDist;
      const mirrorY = cy + Math.sin(a) * mirrorDist;

      const initAngle = a + Math.PI / 4;

      this.playerStates.set(p.id, {
        id: p.id,
        coreX,
        coreY,
        mirrorX,
        mirrorY,
        mirrorAngle: initAngle,
        targetMirrorAngle: initAngle,
        health: 3,
        score: 0,
        laserHits: 0,
        damageFlash: 0,
        invulnerableTimer: 0,
        botReactionTimer: 0.2 + idx * 0.06,
        isFocusing: false,
        focusCharge: 0,
        mood: 'idle',
        moodTimer: 0,
        isUnderdog: false,
        barrierActive: true
      });
    });

    this.generatePrisms(cx, cy);
    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__MIRROR_LASER_DEBUG__ = {
        get players() { return Array.from(self.playerStates.values()); },
        get prisms() { return self.prisms; },
        get roundTimer() { return self.roundTimer; },
        get isFinished() { return self.isFinished; },
        get theme() { return self.currentTheme; },
        setTheme: (t: MirrorTheme) => self.setMirrorTheme(t),
        cycleTheme: () => self.cycleTheme(),
        fireLaserBurst: () => self.fireLaser(self.lastWidth, self.lastHeight)
      };
    }
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setMirrorTheme('chamber');
      } else if (e.key === '2') {
        this.setMirrorTheme('solar');
      } else if (e.key === '3') {
        this.setMirrorTheme('quantum');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private bindCanvasPointer(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      this.handlePointerDown(e);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.cycleTheme();
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setMirrorTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setMirrorTheme(theme: MirrorTheme): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#06B6D4', 12);
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      const canvas = this.input.getCanvas();
      if (canvas && this.boundPointerDown) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
        this.boundPointerDown = null;
      }
      delete (window as any).__MIRROR_LASER_DEBUG__;
    }
  }

  private generatePrisms(cx: number, cy: number): void {
    this.prisms = [];
    const dist = 100;
    this.prisms.push({ x: cx + dist, y: cy, radius: 15, angle: 0, isSplitter: true, pulseTimer: 0 });
    this.prisms.push({ x: cx - dist, y: cy, radius: 15, angle: Math.PI, isSplitter: true, pulseTimer: 0 });
    this.prisms.push({ x: cx, y: cy + dist, radius: 15, angle: Math.PI / 2, isSplitter: true, pulseTimer: 0 });
    this.prisms.push({ x: cx, y: cy - dist, radius: 15, angle: -Math.PI / 2, isSplitter: true, pulseTimer: 0 });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Underdog status (trailing by health or score >= 150 pts)
    this.updateUnderdogStatus();

    // Sudden Death Overdrive at 15s remaining
    if (this.roundTimer <= 15 && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.laserInterval = 1.1; // Double frequency beam storm
      this.audio.playFanfare();
      this.particles.shake(0.4);
      this.particles.showFloatingText('LASER OVERDRIVE! ⚡ 2X DAMAGE', width / 2, 78, '#EF4444', 24);
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Smooth mirror rotation animation & decay
    for (const ps of this.playerStates.values()) {
      ps.mirrorAngle += (ps.targetMirrorAngle - ps.mirrorAngle) * Math.min(1, dt * 18);
      if (ps.damageFlash > 0) {
        ps.damageFlash = Math.max(0, ps.damageFlash - dt * 2.5);
      }
      if (ps.invulnerableTimer > 0) {
        ps.invulnerableTimer = Math.max(0, ps.invulnerableTimer - dt);
      }
      if (ps.moodTimer > 0) {
        ps.moodTimer = Math.max(0, ps.moodTimer - dt);
        if (ps.moodTimer <= 0) ps.mood = 'idle';
      }
    }

    // Laser Pulse Cycle
    this.laserPulseTimer -= dt;
    if (!this.isLaserFiring) {
      if (this.laserPulseTimer <= 0) {
        this.isLaserFiring = true;
        this.laserPulseTimer = this.laserFireDuration;
        this.audio.playLaser();
        this.fireLaser(width, height);
      }
    } else {
      if (this.laserPulseTimer <= 0) {
        this.isLaserFiring = false;
        this.laserPulseTimer = this.laserInterval;
        this.laserSegments = [];
      } else {
        this.fireLaser(width, height);
      }
    }

    // Update bot AI
    this.updateBots(dt, width, height);

    // Human controls
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps || ps.health <= 0) continue;

      if (p.type === 'human') {
        const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);
        const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
        const steer = this.input.getSteer(p.id);

        // Hold to focus / supercharge mirror
        if (actionHeld) {
          ps.isFocusing = true;
          ps.focusCharge = Math.min(1.0, ps.focusCharge + dt * 2.0);
          ps.mood = 'focused';
        } else {
          ps.isFocusing = false;
          ps.focusCharge = Math.max(0, ps.focusCharge - dt * 3.0);
        }

        if (justPressed && !actionHeld) {
          // Tap rotates mirror 45 degrees
          ps.targetMirrorAngle += Math.PI / 4;
          this.audio.playTap();
        } else if (Math.abs(steer) > 0.5) {
          ps.targetMirrorAngle += Math.sign(steer) * (Math.PI / 4);
          this.audio.playTap();
        }
      }
    }

    // Check last core standing
    const alive = Array.from(this.playerStates.values()).filter((p) => p.health > 0);
    if (alive.length <= 1 && this.getActivePlayers().length > 1) {
      if (alive.length === 1) {
        alive[0].score += 150;
        alive[0].mood = 'triumph';
      }
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private updateUnderdogStatus(): void {
    const players = Array.from(this.playerStates.values());
    if (players.length < 2) return;

    let maxHealth = -1;
    let minHealth = 999;
    let maxScore = -1;

    for (const p of players) {
      if (p.health > maxHealth) maxHealth = p.health;
      if (p.health < minHealth) minHealth = p.health;
      if (p.score > maxScore) maxScore = p.score;
    }

    for (const p of players) {
      p.isUnderdog = (p.health === minHealth && minHealth < maxHealth) || (maxScore - p.score >= 150);
    }
  }

  private fireLaser(width: number, height: number): void {
    this.laserSegments = [];
    const cx = width / 2;
    const cy = height / 2 + 12;

    const baseAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
    for (const a of baseAngles) {
      this.traceRay(cx, cy, Math.cos(a), Math.sin(a), 0, null, false, width, height);
    }
  }

  private traceRay(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    bounces: number,
    lastReflectorId: PlayerId | null,
    isSupercharged: boolean,
    width: number,
    height: number
  ): void {
    if (bounces > 7) return;

    let closestDist = 9999;
    let hitType: 'WALL' | 'MIRROR' | 'CORE' | 'PRISM' = 'WALL';
    let hitObject: unknown = null;
    let hitNormalX = 0;
    let hitNormalY = 0;

    // 1. Mirror Hits
    for (const ps of this.playerStates.values()) {
      if (ps.health <= 0) continue;
      const hitRadius = ps.isUnderdog ? 24 : 18; // Underdog wider mirror
      const d = this.rayCircleIntersect(startX, startY, dirX, dirY, ps.mirrorX, ps.mirrorY, hitRadius);
      if (d !== null && d > 4 && d < closestDist) {
        closestDist = d;
        hitType = 'MIRROR';
        hitObject = ps;
        const normAngle = ps.mirrorAngle + Math.PI / 2;
        hitNormalX = Math.cos(normAngle);
        hitNormalY = Math.sin(normAngle);
      }
    }

    // 2. Core Hits
    for (const ps of this.playerStates.values()) {
      if (ps.health <= 0) continue;
      const d = this.rayCircleIntersect(startX, startY, dirX, dirY, ps.coreX, ps.coreY, 24);
      if (d !== null && d > 4 && d < closestDist) {
        closestDist = d;
        hitType = 'CORE';
        hitObject = ps;
      }
    }

    // 3. Prism Hits
    for (const pr of this.prisms) {
      const d = this.rayCircleIntersect(startX, startY, dirX, dirY, pr.x, pr.y, pr.radius);
      if (d !== null && d > 4 && d < closestDist) {
        closestDist = d;
        hitType = 'PRISM';
        hitObject = pr;
      }
    }

    // 4. Default Wall Hit
    if (closestDist === 9999) {
      let tX = 9999;
      let tY = 9999;
      if (dirX > 0) tX = (width - startX) / dirX;
      else if (dirX < 0) tX = (0 - startX) / dirX;

      if (dirY > 0) tY = (height - startY) / dirY;
      else if (dirY < 0) tY = (0 - startY) / dirY;

      closestDist = Math.min(tX, tY);
      hitType = 'WALL';
    }

    const endX = startX + dirX * closestDist;
    const endY = startY + dirY * closestDist;

    const segmentColor =
      lastReflectorId !== null
        ? this.players.find((p) => p.id === lastReflectorId)?.color || '#38BDF8'
        : '#38BDF8';

    this.laserSegments.push({
      startX,
      startY,
      endX,
      endY,
      color: segmentColor,
      isSupercharged
    });

    if (hitType === 'MIRROR') {
      const ps = hitObject as PlayerMirrorCore;
      const dot = dirX * hitNormalX + dirY * hitNormalY;
      const refX = dirX - 2 * dot * hitNormalX;
      const refY = dirY - 2 * dot * hitNormalY;

      const supercharge = isSupercharged || ps.focusCharge >= 0.5;
      this.particles.emit(endX, endY, 6, '#F59E0B');

      this.traceRay(endX, endY, refX, refY, bounces + 1, ps.id, supercharge, width, height);
    } else if (hitType === 'CORE') {
      const ps = hitObject as PlayerMirrorCore;
      if (ps.health > 0 && ps.invulnerableTimer <= 0) {
        // Underdog Hard-Light Barrier absorption
        if (ps.isUnderdog && ps.barrierActive) {
          ps.barrierActive = false;
          ps.invulnerableTimer = 1.0;
          this.audio.playBounce();
          this.particles.shake(0.25);
          this.particles.showFloatingText('BARRIER DEFLECTED! 🛡️', ps.coreX, ps.coreY - 25, '#F59E0B', 18);
          return;
        }

        const dmg = this.roundTimer <= 15 ? 2 : 1;
        ps.health = Math.max(0, ps.health - dmg);
        ps.invulnerableTimer = 0.85;
        ps.damageFlash = 1.0;
        ps.mood = 'shocked';
        ps.moodTimer = 1.0;
        this.audio.playBounce();
        this.particles.shake(0.35);

        if (lastReflectorId !== null && lastReflectorId !== ps.id) {
          const shooter = this.playerStates.get(lastReflectorId);
          if (shooter) {
            let pts = 120;
            if (isSupercharged) pts *= 1.5;
            if (bounces >= 2) pts += 100; // Chain combo
            shooter.score += pts;
            shooter.laserHits++;
            shooter.mood = 'triumph';
            shooter.moodTimer = 1.2;
            this.particles.showFloatingText(`CORE HIT! +${pts}`, ps.coreX, ps.coreY - 25, '#22C55E', 22);
          }
        }

        this.particles.emit(endX, endY, 14, '#EF4444');
      }
    } else if (hitType === 'PRISM') {
      const pr = hitObject as SecondaryPrism;
      if (pr.isSplitter) {
        const a1 = Math.atan2(dirY, dirX) + Math.PI / 4;
        const a2 = Math.atan2(dirY, dirX) - Math.PI / 4;
        this.traceRay(endX, endY, Math.cos(a1), Math.sin(a1), bounces + 1, lastReflectorId, isSupercharged, width, height);
        this.traceRay(endX, endY, Math.cos(a2), Math.sin(a2), bounces + 1, lastReflectorId, isSupercharged, width, height);
      }
    }
  }

  private rayCircleIntersect(
    rx: number,
    ry: number,
    dx: number,
    dy: number,
    cx: number,
    cy: number,
    radius: number
  ): number | null {
    const fx = rx - cx;
    const fy = ry - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    if (t1 > 0) return t1;
    if (t2 > 0) return t2;
    return null;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playerStates.get(botId);
    if (!ps || ps.health <= 0) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const baseDelay =
      difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.28 : 0.50;
    ps.botReactionTimer = baseDelay;

    if (difficulty === 'bot_easy' && Math.random() < 0.35) {
      ps.targetMirrorAngle += Math.PI / 4;
      return;
    }

    const cx = width / 2;
    const cy = height / 2 + 12;
    const inDx = ps.mirrorX - cx;
    const inDy = ps.mirrorY - cy;
    const inLen = Math.hypot(inDx, inDy) || 1;
    const inX = inDx / inLen;
    const inY = inDy / inLen;

    const candidateAngles: number[] = [];
    for (let k = 0; k < 8; k++) {
      candidateAngles.push((k * Math.PI) / 4);
    }

    let bestAngle = ps.targetMirrorAngle;
    let bestScore = -9999;

    for (const testAngle of candidateAngles) {
      const normAngle = testAngle + Math.PI / 2;
      const nx = Math.cos(normAngle);
      const ny = Math.sin(normAngle);

      const dot = inX * nx + inY * ny;
      const rx = inX - 2 * dot * nx;
      const ry = inY - 2 * dot * ny;

      // Penalize reflecting toward self
      const ownDx = ps.coreX - ps.mirrorX;
      const ownDy = ps.coreY - ps.mirrorY;
      const ownLen = Math.hypot(ownDx, ownDy) || 1;
      const ownDot = rx * (ownDx / ownLen) + ry * (ownDy / ownLen);

      let score = -ownDot * 250;

      // Reward reflecting toward opponents
      for (const opp of this.playerStates.values()) {
        if (opp.id === botId || opp.health <= 0) continue;
        const oppDx = opp.coreX - ps.mirrorX;
        const oppDy = opp.coreY - ps.mirrorY;
        const oppLen = Math.hypot(oppDx, oppDy) || 1;
        const oppDot = rx * (oppDx / oppLen) + ry * (oppDy / oppLen);
        if (oppDot > 0.55) score += oppDot * 180;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAngle = testAngle;
      }
    }

    ps.targetMirrorAngle = bestAngle;

    // Hard AI focuses mirror when aligned
    if (difficulty === 'bot_hard' && bestScore > 100) {
      ps.isFocusing = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;

    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme) || THEME_CONFIGS[0];

    // 1. Stage Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, cfg.bgGradient[0]);
    bgGrad.addColorStop(1, cfg.bgGradient[1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Laboratory Grid Lines
    ctx.strokeStyle = cfg.gridLineColor;
    ctx.lineWidth = 1;
    for (let x = 40; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, height - 50);
      ctx.stroke();
    }

    const cx = width / 2;
    const cy = height / 2 + 12;

    // 2. Central Emitter Core
    ctx.save();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = cfg.emitterBorder;
    ctx.lineWidth = 3;
    ctx.shadowColor = cfg.emitterBorder;
    ctx.shadowBlur = this.isLaserFiring ? 20 : 8;
    ctx.stroke();

    // Pulsing central crystal
    const pulseScale = 1 + (this.isLaserFiring ? 0.35 : (1 - this.laserPulseTimer / this.laserInterval) * 0.22);
    ctx.fillStyle = this.isLaserFiring ? '#FFFFFF' : cfg.emitterBorder;
    ctx.beginPath();
    ctx.arc(cx, cy, 16 * pulseScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Secondary Prisms
    for (const pr of this.prisms) {
      ctx.save();
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = cfg.prismColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = cfg.prismColor;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Laser Beams
    if (this.laserSegments.length > 0) {
      ctx.save();
      for (const seg of this.laserSegments) {
        // Outer glow
        ctx.strokeStyle = seg.color;
        ctx.globalAlpha = seg.isSupercharged ? 0.65 : 0.40;
        ctx.lineWidth = seg.isSupercharged ? 12 : 7;
        ctx.beginPath();
        ctx.moveTo(seg.startX, seg.startY);
        ctx.lineTo(seg.endX, seg.endY);
        ctx.stroke();

        // Inner core beam
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = seg.isSupercharged ? 4 : 2.5;
        ctx.beginPath();
        ctx.moveTo(seg.startX, seg.startY);
        ctx.lineTo(seg.endX, seg.endY);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Player Pedestals & Mirrors
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      // Base Core
      ctx.save();
      ctx.translate(ps.coreX, ps.coreY);

      // Underdog Barrier Halo
      if (ps.isUnderdog && ps.barrierActive && ps.health > 0) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = ps.health <= 0 ? '#334155' : ps.damageFlash > 0 ? '#EF4444' : p.colorDark;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ps.health <= 0 ? '#64748B' : p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Core Shield Text
      if (ps.health > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${ps.health} HP`, 0, 0);
      } else {
        ctx.fillStyle = '#EF4444';
        ctx.font = '700 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✖', 0, 0);
      }
      ctx.restore();

      // Mirror Pedestal & Rotatable Reflector
      if (ps.health > 0) {
        ctx.save();
        ctx.translate(ps.mirrorX, ps.mirrorY);

        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Angled Mirror Blade
        ctx.rotate(ps.mirrorAngle);
        const bladeW = ps.isUnderdog ? 46 : 36;
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(-bladeW / 2, -3.5, bladeW, 7);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-bladeW / 2, -3.5, bladeW, 7);

        // Focus glow when holding action
        if (ps.focusCharge > 0.2) {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 3;
          ctx.strokeRect(-bladeW / 2 - 2, -5.5, bladeW + 4, 11);
        }

        ctx.restore();
      }
    }

    // 6. Corner Player Cards & Mascot Avatars
    this.renderPlayerCornerCards(ctx, width, height, cfg);

    // 7. Center Sub-Header Badge (y: 56, h: 26 - respects top-center y:12-44 safe zone)
    this.renderSubHeaderBadge(ctx, width, cfg);

    // 8. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, cfg);

    // 9. Control Hints (bottom-right x: width - 20, y: height - 28, textAlign: right)
    this.renderControlsHUD(ctx, width, height);
  }

  private renderPlayerCornerCards(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cfg: ThemeConfig
  ): void {
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      let px = 20;
      let py = 16;
      let mascotX = px + 175;
      let mascotY = py + 36;

      if (p.corner === 'top-right') {
        px = width - 180;
        mascotX = px - 20;
      } else if (p.corner === 'bottom-left') {
        // Place neatly above theme pill (theme pill is at y: height - 44)
        py = height - 134;
        mascotY = py + 36;
      } else if (p.corner === 'bottom-right') {
        px = width - 180;
        py = height - 134;
        mascotX = px - 20;
        mascotY = py + 36;
      }

      // Container Card
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.beginPath();
      ctx.roundRect(px, py, 160, 78, 8);
      ctx.fill();

      // Card border (dashed gold if Underdog)
      if (ps.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
      } else {
        ctx.strokeStyle = ps.health > 0 ? p.color : '#64748B';
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.restore();

      // Name & Score
      ctx.fillStyle = ps.health > 0 ? p.color : '#94A3B8';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 18);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 13px Inter, monospace';
      ctx.fillText(`${ps.score} pts`, px + 10, py + 35);

      ctx.fillStyle = ps.health > 0 ? '#10B981' : '#EF4444';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText(ps.health > 0 ? `Core: ${ps.health}/3 HP` : 'CORE DESTROYED', px + 10, py + 54);

      // Hits counter
      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText(`Direct Hits: ${ps.laserHits}`, px + 10, py + 70);

      // Render Mascot Avatar alongside the card
      const isBot = p.type !== 'human';
      ctx.save();
      drawCharacter(ctx, mascotX, mascotY, 13, ps.id, isBot, ps.mood, this.animTimer);
      ctx.restore();
    }
  }

  private renderSubHeaderBadge(ctx: CanvasRenderingContext2D, width: number, cfg: ThemeConfig): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56; // Safe zone below top-center timer y: 12-44

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = cfg.emitterBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`CHAMBER: ${cfg.name}`, podX + 16, podY + 17);

    // Laser status
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('⚡ LASER OVERDRIVE 2X', podX + podW - 16, podY + 17);
    } else if (this.isLaserFiring) {
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('FIRING BEAMS! ⚡', podX + podW - 16, podY + 17);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`CHARGING: ${this.laserPulseTimer.toFixed(1)}s`, podX + podW - 16, podY + 17);
    }
    ctx.restore();
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, cfg: ThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = cfg.emitterBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(cfg.badge, pillX + 12, pillY + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + 20);
    ctx.restore();
  }

  private renderControlsHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.fillText('Tap: Rotate Mirror 45° | Hold: Focus Beam | Deflect into Rival Cores!', width - 20, height - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.playerStates.get(a.id);
      const sb = this.playerStates.get(b.id);
      if (!sa || !sb) return 0;
      if (sa.health !== sb.health) {
        return sb.health - sa.health;
      }
      return sb.score - sa.score;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topHits = this.playerStates.get(winnerId ?? 0)?.laserHits || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.playerStates.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Optical mastermind! Deflected laser beams with ${topHits} direct core strikes on ${this.currentTheme}!`
    };
  }
}
