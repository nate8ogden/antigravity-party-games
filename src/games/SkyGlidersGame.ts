import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type SkyGlidersThemeId = 'sunset' | 'cyber' | 'aurora';

interface SkyGlidersTheme {
  id: SkyGlidersThemeId;
  name: string;
  icon: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  canyonColor: string;
  canyonHighlight: string;
  ringOuter: string;
  ringInner: string;
  runwayBg: string;
  accentColor: string;
}

const THEMES: Record<SkyGlidersThemeId, SkyGlidersTheme> = {
  sunset: {
    id: 'sunset',
    name: 'Sunset Canyon',
    icon: '🌄',
    skyTop: '#1E1B4B',
    skyMid: '#701A75',
    skyBottom: '#C2410C',
    canyonColor: '#431407',
    canyonHighlight: '#EA580C',
    ringOuter: 'rgba(251, 191, 36, 0.4)',
    ringInner: '#FBBF24',
    runwayBg: '#1E293B',
    accentColor: '#F59E0B'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Skyline',
    icon: '⚡',
    skyTop: '#0B0F2A',
    skyMid: '#1E1B4B',
    skyBottom: '#0284C7',
    canyonColor: '#090D16',
    canyonHighlight: '#06B6D4',
    ringOuter: 'rgba(6, 182, 212, 0.4)',
    ringInner: '#38BDF8',
    runwayBg: '#0F172A',
    accentColor: '#38BDF8'
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora Fjords',
    icon: '❄️',
    skyTop: '#022C22',
    skyMid: '#064E3B',
    skyBottom: '#047857',
    canyonColor: '#062822',
    canyonHighlight: '#34D399',
    ringOuter: 'rgba(52, 211, 153, 0.4)',
    ringInner: '#6EE7B7',
    runwayBg: '#064E3B',
    accentColor: '#10B981'
  }
};

const THEME_ORDER: SkyGlidersThemeId[] = ['sunset', 'cyber', 'aurora'];

interface ThermalRing {
  id: number;
  x: number;
  y: number;
  radius: number;
  isMega: boolean;
  collectedBy: Set<PlayerId>;
}

interface Glider {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pitch: number;      // Radians (-PI/3 to PI/3)
  speed: number;
  score: number;
  ringsPassed: number;
  flightsCompleted: number;
  lastLandZone: string;
  trail: { x: number; y: number }[];
  turboCooldown: number;
  chargeTime: number;
  isCharging: boolean;
  boostActiveTimer: number;
  isDrafting: boolean;
  isUnderdog: boolean;
  moodTimer: number;
  currentMood: CharacterMood;
}

export class SkyGlidersGame extends BaseGame {
  public gliders: Map<PlayerId, Glider> = new Map();
  public rings: ThermalRing[] = [];
  public currentTheme: SkyGlidersThemeId = 'sunset';
  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private canyonLength: number = 800;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private nextRingId: number = 1;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private canvasRef: HTMLCanvasElement | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    this.keyHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 't') {
        this.cycleTheme();
      } else if (key === '1') {
        this.setTheme('sunset');
      } else if (key === '2') {
        this.setTheme('cyber');
      } else if (key === '3') {
        this.setTheme('aurora');
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    this.canvasRef = document.querySelector('canvas');
    if (this.canvasRef) {
      this.clickHandler = (e: MouseEvent) => {
        if (!this.canvasRef) return;
        const rect = this.canvasRef.getBoundingClientRect();
        const scaleX = this.canvasRef.width / rect.width;
        const scaleY = this.canvasRef.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Theme pill zone: x: 20, y: height - 44, w: 170, h: 32
        const pillY = this.canvasRef.height - 44;
        if (clickX >= 20 && clickX <= 190 && clickY >= pillY && clickY <= pillY + 32) {
          this.cycleTheme();
        }
      };
      this.canvasRef.addEventListener('click', this.clickHandler);
    }
  }

  public cycleTheme(): void {
    const idx = THEME_ORDER.indexOf(this.currentTheme);
    this.setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  }

  public setTheme(themeId: SkyGlidersThemeId): void {
    this.currentTheme = themeId;
    this.audio.playTap();
    this.particles.showFloatingText(
      `${THEMES[themeId].icon} ${THEMES[themeId].name}`,
      this.canyonLength * 0.5,
      140,
      THEMES[themeId].accentColor,
      20
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.gliders.clear();
    this.botReactionTimers.clear();
    this.rings = [];
    this.canyonLength = width;
    this.nextRingId = 1;

    this.generateRings(width, height);

    // Spawn gliders on launch catapults
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startY = height * 0.28 + idx * 56;
      this.gliders.set(p.id, {
        id: p.id,
        x: width * 0.08,
        y: startY,
        vx: 260,
        vy: 0,
        pitch: 0,
        speed: 260,
        score: 0,
        ringsPassed: 0,
        flightsCompleted: 0,
        lastLandZone: 'READY',
        trail: [],
        turboCooldown: 0,
        chargeTime: 0,
        isCharging: false,
        boostActiveTimer: 0,
        isDrafting: false,
        isUnderdog: false,
        moodTimer: 0,
        currentMood: 'idle'
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.15);
    });
  }

  private generateRings(width: number, height: number): void {
    this.rings = [];
    // 5 rings across canyon path: 3 regular, 1 central mega ring, 1 approach ring
    const ringXs = [width * 0.24, width * 0.38, width * 0.52, width * 0.66, width * 0.78];
    ringXs.forEach((rx, idx) => {
      const isMega = idx === 2;
      this.rings.push({
        id: this.nextRingId++,
        x: rx,
        y: height * 0.32 + (idx % 2 === 0 ? -50 : 50) + (Math.random() - 0.5) * 30,
        radius: isMega ? 40 : 30,
        isMega,
        collectedBy: new Set()
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Dynamic Underdog status
    const glidersList = Array.from(this.gliders.values());
    const maxScore = Math.max(0, ...glidersList.map((g) => g.score));
    glidersList.forEach((g) => {
      g.isUnderdog = maxScore >= 400 && g.score <= maxScore - 250;
    });

    // Update bot decisions
    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 15.0;

    // Update gliders
    for (const p of this.getActivePlayers()) {
      const g = this.gliders.get(p.id);
      if (!g) continue;

      if (g.turboCooldown > 0) g.turboCooldown -= dt;
      if (g.boostActiveTimer > 0) g.boostActiveTimer -= dt;
      if (g.moodTimer > 0) {
        g.moodTimer -= dt;
      } else {
        g.currentMood = g.boostActiveTimer > 0 || g.isCharging ? 'focused' : 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Pitch control: Throttle Up pulls pitch up (trades speed for climb); Throttle Down dives (gains speed)
      const pitchInput = -throttle;
      g.pitch += pitchInput * dt * 2.8;

      // Lateral trim: Left airbrakes; Right streamlines forward
      if (steer < -0.2) {
        g.speed = Math.max(130, g.speed - 140 * dt);
        g.pitch -= 0.6 * dt;
      } else if (steer > 0.2) {
        g.speed = Math.min(520, g.speed + 140 * dt);
      }

      // Hold-to-Charge Rocket Booster
      const boostCooldownMax = g.isUnderdog ? 1.2 : 2.0;
      if (g.turboCooldown <= 0) {
        if (actionHeld) {
          g.isCharging = true;
          g.chargeTime = Math.min(0.6, g.chargeTime + dt);
          if (Math.random() < 0.25) {
            this.particles.spawnSparks(g.x, g.y, THEMES[this.currentTheme].accentColor, 1);
          }
        } else if (g.isCharging || justAction) {
          // Release Rocket Boost!
          const chargeRatio = Math.max(0.25, g.chargeTime / 0.6);
          g.turboCooldown = boostCooldownMax;
          g.boostActiveTimer = 0.45 + chargeRatio * 0.2;
          g.speed = Math.min(600, g.speed + 130 + chargeRatio * 160);
          g.y -= 28 + chargeRatio * 20; // Thermal updraft lift
          g.isCharging = false;
          g.chargeTime = 0;
          g.currentMood = 'focused';
          g.moodTimer = 0.8;

          this.audio.playLaser();
          this.particles.shake(chargeRatio > 0.7 ? 5 : 3);
          this.particles.spawnSparks(g.x, g.y, p.color, Math.round(10 + chargeRatio * 14));
          this.particles.showFloatingText(
            chargeRatio > 0.8 ? 'SONIC BOOST!' : 'JET SURGE!',
            g.x,
            g.y - 20,
            '#38BDF8',
            14
          );
        }
      } else {
        g.isCharging = false;
        g.chargeTime = 0;
      }

      // Pitch angle clamping
      g.pitch = Math.max(-0.68, Math.min(0.68, g.pitch));

      // Aerodynamics: Diving increases forward speed; climbing creates lift but slows speed
      if (g.pitch > 0) {
        // Diving forward & down
        g.speed += Math.sin(g.pitch) * 220 * dt;
      } else {
        // Climbing
        g.speed -= Math.sin(-g.pitch) * 250 * dt;
      }

      // Underdog baseline speed boost
      const maxSpeedCap = g.isUnderdog ? 620 : 540;
      g.speed = Math.max(130, Math.min(maxSpeedCap, g.speed));
      g.speed *= Math.pow(0.996, dt * 60);

      // Forward motion and vertical descent based on pitch
      g.vx = Math.cos(g.pitch) * g.speed;
      g.vy = Math.sin(g.pitch) * g.speed * 0.75;

      g.x += g.vx * dt;
      g.y += g.vy * dt;

      // Natural gravitational sink rate (slightly lower during boost)
      g.y += (g.boostActiveTimer > 0 ? 6 : 18) * dt;

      // Vertical bounds clamping within canyon
      g.y = Math.max(50, Math.min(height - 65, g.y));

      // Vapor Trail recording
      g.trail.push({ x: g.x, y: g.y });
      if (g.trail.length > (g.boostActiveTimer > 0 ? 28 : 18)) g.trail.shift();

      // Check Thermal Ring fly-through
      const ringMultiplier = isSuddenDeath ? 2 : 1;
      const collectRadiusExtra = g.isUnderdog ? 16 : 10;
      for (const ring of this.rings) {
        if (!ring.collectedBy.has(p.id)) {
          const dist = Math.hypot(g.x - ring.x, g.y - ring.y);
          if (dist < ring.radius + collectRadiusExtra) {
            ring.collectedBy.add(p.id);
            const ringPts = (ring.isMega ? 300 : 150) * ringMultiplier;
            g.score += ringPts;
            g.ringsPassed += 1;
            g.speed = Math.min(maxSpeedCap, g.speed + 100);
            g.y -= ring.isMega ? 45 : 30; // Updraft lift
            g.currentMood = 'triumph';
            g.moodTimer = 1.0;

            this.audio.playScore();
            this.particles.shake(ring.isMega ? 5 : 2);
            this.particles.spawnSparks(g.x, g.y, THEMES[this.currentTheme].ringInner, ring.isMega ? 24 : 14);
            this.particles.showFloatingText(
              ring.isMega ? `+${ringPts} MEGA RING!` : `+${ringPts} RING!`,
              ring.x,
              ring.y - 20,
              ring.isMega ? '#F59E0B' : '#38BDF8',
              15
            );
          }
        }
      }

      // Runway Touch-down at far right
      const runwayStartX = width * 0.84;
      if (g.x >= runwayStartX) {
        // Evaluate Landing Precision Zone based on Y proximity to center runway
        const centerRunwayY = height * 0.5;
        const landingOffset = Math.abs(g.y - centerRunwayY);

        let landingPts = 150;
        let zoneLabel = 'ROUGH (150)';
        if (landingOffset < 42) {
          landingPts = 500 * ringMultiplier;
          zoneLabel = `BULLSEYE (+${landingPts})`;
          this.audio.playFanfare();
          this.particles.shake(6);
          this.particles.spawnExplosion(g.x, g.y, '#10B981', 28);
          g.currentMood = 'triumph';
        } else if (landingOffset < 95) {
          landingPts = 300 * ringMultiplier;
          zoneLabel = `RUNWAY (+${landingPts})`;
          this.audio.playScore();
          g.currentMood = 'happy';
        } else {
          landingPts = 150 * ringMultiplier;
          zoneLabel = `OUTER (+${landingPts})`;
          this.audio.playBounce();
          g.currentMood = 'idle';
        }

        g.score += landingPts;
        g.flightsCompleted += 1;
        g.lastLandZone = zoneLabel;
        g.moodTimer = 1.2;

        this.particles.showFloatingText(zoneLabel, runwayStartX + 30, g.y, '#10B981', 16);

        // Catapult relaunch for continuous exhilarating flight runs!
        g.x = width * 0.07;
        g.y = height * 0.28 + (g.id * 56) % (height * 0.44);
        g.pitch = 0;
        g.speed = 280;
        g.trail = [];
        this.audio.playWhoosh();
      }
    }

    // Slipstream Drafting & Wing-Tip Mid-Air Bumping
    const activeGliders = Array.from(this.gliders.values());
    for (let i = 0; i < activeGliders.length; i++) {
      activeGliders[i].isDrafting = false;
      for (let j = 0; j < activeGliders.length; j++) {
        if (i === j) continue;
        const g1 = activeGliders[i];
        const g2 = activeGliders[j];

        const dx = g2.x - g1.x; // positive if g2 is ahead of g1
        const dy = g2.y - g1.y;
        const dist = Math.hypot(dx, dy);

        // 1. Slipstream: g1 is trailing closely behind g2
        if (dx > 15 && dx < 80 && Math.abs(dy) < 26) {
          g1.isDrafting = true;
          g1.speed = Math.min(580, g1.speed + 120 * dt);
          if (Math.random() < 0.2) {
            this.particles.spawnSparks(g1.x, g1.y, '#38BDF8', 1);
          }
        }

        // 2. Wing-tip elastic bumping
        if (dist < 26 && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          g1.x -= nx * 3;
          g1.y -= ny * 3;
          g2.x += nx * 3;
          g2.y += ny * 3;

          // Swap lateral speeds with bounce
          const tempVy = g1.vy;
          g1.vy = g2.vy * 1.2;
          g2.vy = tempVy * 1.2;

          g1.currentMood = 'shocked';
          g2.currentMood = 'shocked';
          g1.moodTimer = 0.5;
          g2.moodTimer = 0.5;

          this.audio.playBounce();
          this.particles.shake(2);
          this.particles.spawnSparks((g1.x + g2.x) / 2, (g1.y + g2.y) / 2, '#FFFFFF', 6);
        }
      }
    }

    // Refresh rings when all rings are collected by everyone or after a period
    const allRingsCollected = this.rings.every((r) => r.collectedBy.size >= this.getActivePlayers().length);
    if (allRingsCollected) {
      this.generateRings(width, height);
    }

    // Check round over: timer expired
    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    height: number
  ): void {
    const bot = this.gliders.get(botId);
    if (!bot) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.35 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.18 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.05;
    this.botReactionTimers.set(botId, interval);

    // Find next uncollected ring ahead
    const nextRing = this.rings.find((r) => r.x > bot.x && !r.collectedBy.has(botId));

    let targetY = height * 0.5;
    if (nextRing) {
      targetY = nextRing.y;
    }

    if (difficulty === 'bot_easy') {
      targetY += (Math.random() - 0.5) * 65;
    } else if (difficulty === 'bot_hard' && nextRing) {
      // Predictive altitude trimming
      targetY = nextRing.y;
    }

    const dy = targetY - bot.y;
    let throttle = 0;
    let action = false;

    if (dy < -14) {
      // Target is above: pull up
      throttle = 1.0;
    } else if (dy > 14) {
      // Target is below: dive down
      throttle = -1.0;
    }

    const boostChance = difficulty === 'bot_hard' ? 0.85 : difficulty === 'bot_normal' ? 0.5 : 0.2;
    if (nextRing && Math.abs(dy) < 30 && bot.turboCooldown <= 0 && Math.random() < boostChance) {
      action = true;
    }

    this.input.setBotInput(botId, false, 0, throttle, action);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const g = this.gliders.get(p.id);
      return {
        playerId: p.id,
        score: g?.score || 0,
        rings: g?.ringsPassed || 0,
        flights: g?.flightsCompleted || 0,
        lastZone: g?.lastLandZone || 'DNF'
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const theme = THEMES[this.currentTheme];
    const topRings = scores[0]?.rings || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} dominated the ${theme.name} canyon with ${topRings} rings and precision bullseyes!`
      : 'All gliders encountered wind shear in the canyon!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // 1. Beautiful Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(0.4, theme.skyMid);
    skyGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant mountain canyon silhouettes with illuminated crests
    ctx.fillStyle = theme.canyonColor;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height * 0.74);
    ctx.lineTo(width * 0.22, height * 0.60);
    ctx.lineTo(width * 0.48, height * 0.76);
    ctx.lineTo(width * 0.72, height * 0.62);
    ctx.lineTo(width * 0.88, height * 0.78);
    ctx.lineTo(width, height * 0.70);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Canyon crest highlight rim
    ctx.strokeStyle = theme.canyonHighlight;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.74);
    ctx.lineTo(width * 0.22, height * 0.60);
    ctx.lineTo(width * 0.48, height * 0.76);
    ctx.lineTo(width * 0.72, height * 0.62);
    ctx.lineTo(width * 0.88, height * 0.78);
    ctx.lineTo(width, height * 0.70);
    ctx.stroke();

    // 2. Floating Golden Thermal Updraft Rings
    const now = performance.now() * 0.003;
    for (const r of this.rings) {
      ctx.save();
      const pulse = 1.0 + Math.sin(now + r.id) * 0.08;
      const rx = r.radius * 0.65 * pulse;
      const ry = r.radius * pulse;

      // Outer glow aura
      ctx.strokeStyle = r.isMega ? 'rgba(245, 158, 11, 0.45)' : theme.ringOuter;
      ctx.lineWidth = r.isMega ? 10 : 7;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Ring Rim
      ctx.strokeStyle = r.isMega ? '#F59E0B' : theme.ringInner;
      ctx.lineWidth = r.isMega ? 4 : 3;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner icon / sparkle for Mega rings
      if (r.isMega) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★ 2X', r.x, r.y);
      }
      ctx.restore();
    }

    // 3. Runway Landing Zone at right edge
    const rX = width * 0.84;
    const rW = width * 0.16;
    ctx.fillStyle = theme.runwayBg;
    ctx.fillRect(rX, height * 0.24, rW, height * 0.52);

    // Target bullseye lines on runway
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3;
    ctx.strokeRect(rX, height * 0.42, rW, height * 0.16);

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎯 BULLSEYE', rX + rW * 0.5, height * 0.5);

    // Runway carrier hazard lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rX, height * 0.24, rW, height * 0.52);

    // 4. Draw Gliders and Vapor Trails
    for (const g of this.gliders.values()) {
      const cfg = this.players[g.id];
      const color = cfg ? cfg.color : '#FFFFFF';

      // Vapor Trail
      if (g.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = g.boostActiveTimer > 0 ? '#38BDF8' : color;
        ctx.lineWidth = g.boostActiveTimer > 0 ? 3.5 : 2;
        ctx.beginPath();
        g.trail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.pitch);

      // Underdog jetpack aura
      if (g.isUnderdog) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Slipstream drafting wind streaks
      if (g.isDrafting) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-28, -6);
        ctx.lineTo(-12, -6);
        ctx.moveTo(-28, 6);
        ctx.lineTo(-12, 6);
        ctx.stroke();
      }

      // Paper Airplane Delta Wing
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(20, 0); // Nose
      ctx.lineTo(-15, -14); // Left wingtip
      ctx.lineTo(-7, 0); // Center crease
      ctx.lineTo(-15, 14); // Right wingtip
      ctx.closePath();
      ctx.fill();

      // Wing fold shading
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-15, 14);
      ctx.closePath();
      ctx.fill();

      // Draw mascot cockpit head
      const isBot = cfg?.type !== 'human';
      drawCharacter(ctx, 0, -4, 10, g.id, isBot, g.currentMood, performance.now() * 0.001);

      ctx.restore();

      // Player Name Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(g.x - 28, g.y - 28, 56, 15, 6);
      else ctx.rect(g.x - 28, g.y - 28, 56, 15);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg?.name.toUpperCase() || `P${g.id + 1}`, g.x, g.y - 20);
    }

    // 5. Draw HUD & Safe-zone elements
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = THEMES[this.currentTheme];

    // Minigame Header at y: 56, h: 26 (NEVER overlaps global timer at y: 12-44)
    const headerW = 290;
    const headerH = 26;
    const headerX = width * 0.5 - headerW * 0.5;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.strokeStyle = theme.ringInner;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const isSuddenDeath = this.roundTimer <= 15.0;
    const headerText = isSuddenDeath
      ? `⚡ TAILWIND SURGE 2X: ${Math.ceil(this.roundTimer)}s ⚡`
      : `${theme.icon} SKY GLIDERS — ${theme.name.toUpperCase()}`;
    ctx.fillText(headerText, width * 0.5, headerY + headerH * 0.5);

    // Interactive Theme Pill at bottom-left: x: 20, y: height - 44, w: 170, h: 32
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name}`, pillX + 12, pillY + pillH * 0.5);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '900 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + pillH * 0.5);

    // Bottom Right Controls Hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('W/S: Pitch | A/D: Trim | Hold Action: Jet Surge', width - 20, height - 28);

    // Corner Player Cards offset to y: height - 128 (avoids theme pill at y: height - 44)
    const active = this.getActivePlayers();
    const cardW = 110;
    const cardH = 50;

    active.forEach((p, idx) => {
      const g = this.gliders.get(p.id);
      let cx = 20;
      let cy = height - 128;

      if (idx === 1) {
        cx = width - cardW - 20;
        cy = height - 128;
      } else if (idx === 2) {
        cx = 20;
        cy = 94;
      } else if (idx === 3) {
        cx = width - cardW - 20;
        cy = 94;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 8);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mascot preview in card
      const isBot = p.type !== 'human';
      const mood: CharacterMood = g ? g.currentMood : 'idle';
      drawCharacter(ctx, cx + 22, cy + 25, 14, p.id, isBot, mood, performance.now() * 0.001);

      // Score / Status
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(p.name, cx + 42, cy + 8);

      ctx.fillStyle = theme.accentColor;
      ctx.font = '900 12px "Chakra Petch", monospace';
      ctx.fillText(`⚡ ${Math.round(g?.score || 0)}`, cx + 42, cy + 26);
    });

    ctx.restore();
  }

  public syncDebug(): void {
    // Expose internal state for headless tests
    (window as any).__SKY_GLIDERS_DEBUG__ = {
      roundTimer: this.roundTimer,
      currentTheme: this.currentTheme,
      gliders: Array.from(this.gliders.values()).map((g) => ({
        id: g.id,
        score: g.score,
        ringsPassed: g.ringsPassed,
        speed: g.speed,
        isUnderdog: g.isUnderdog
      }))
    };
  }

  public destroy(): void {
    super.destroy();
    if (typeof window !== 'undefined') {
      if (this.keyHandler) {
        window.removeEventListener('keydown', this.keyHandler);
        this.keyHandler = null;
      }
      if (this.canvasRef && this.clickHandler) {
        this.canvasRef.removeEventListener('click', this.clickHandler);
        this.clickHandler = null;
      }
    }
  }
}
