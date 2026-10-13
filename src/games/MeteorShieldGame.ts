import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface MeteorShieldTheme {
  name: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  starColor: string;
  shieldTrack: string;
  meteorCoreStart: string;
  meteorCoreMid: string;
  meteorCoreEnd: string;
  meteorGlow: string;
  themePillColor: string;
}

export const METEOR_SHIELD_THEMES: MeteorShieldTheme[] = [
  {
    name: 'Deep Cosmos 🌌',
    bgGradStart: '#0F172A',
    bgGradMid: '#090D16',
    bgGradEnd: '#020617',
    starColor: '#FFFFFF',
    shieldTrack: 'rgba(148, 163, 184, 0.22)',
    meteorCoreStart: '#FEF08A',
    meteorCoreMid: '#F97316',
    meteorCoreEnd: '#9A3412',
    meteorGlow: '#F97316',
    themePillColor: '#38BDF8'
  },
  {
    name: 'Solar Nebula ☀️',
    bgGradStart: '#451A03',
    bgGradMid: '#1C0A04',
    bgGradEnd: '#050201',
    starColor: '#FEF08A',
    shieldTrack: 'rgba(245, 158, 11, 0.25)',
    meteorCoreStart: '#FFFFFF',
    meteorCoreMid: '#E11D48',
    meteorCoreEnd: '#881337',
    meteorGlow: '#FB7185',
    themePillColor: '#F59E0B'
  },
  {
    name: 'Cyber Matrix ⚡',
    bgGradStart: '#1E1B4B',
    bgGradMid: '#0F0E2A',
    bgGradEnd: '#030214',
    starColor: '#A7F3D0',
    shieldTrack: 'rgba(168, 85, 247, 0.25)',
    meteorCoreStart: '#E0E7FF',
    meteorCoreMid: '#06B6D4',
    meteorCoreEnd: '#0369A1',
    meteorGlow: '#06B6D4',
    themePillColor: '#A855F7'
  }
];

interface PlanetCore {
  id: PlayerId;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  shieldAngle: number;
  shieldSpan: number; // angular coverage in radians
  shieldDistance: number;
  pulseTimer: number;
  score: number;
  deflectStreak: number;
  isUnderdog: boolean;
  hitStunTimer: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  ownerId: PlayerId | null; // who deflected it last
  life: number;
  isTitan?: boolean;
}

export class MeteorShieldGame extends BaseGame {
  private planets: Map<PlayerId, PlanetCore> = new Map();
  private meteors: Meteor[] = [];
  private meteorSpawnTimer: number = 2.0;
  private arenaCenterX: number = 400;
  private arenaCenterY: number = 300;
  private eliminationOrder: PlayerId[] = [];

  // Visual Themes & Polish
  private currentThemeIndex: number = 0;
  private animTimer: number = 0;
  private suddenDeathAnnounced: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

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
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __METEOR_SHIELD_DEBUG__?: unknown }).__METEOR_SHIELD_DEBUG__) {
      delete (window as unknown as { __METEOR_SHIELD_DEBUG__?: unknown }).__METEOR_SHIELD_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % METEOR_SHIELD_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % METEOR_SHIELD_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.suddenDeathAnnounced = false;
    this.planets.clear();
    this.meteors = [];
    this.meteorSpawnTimer = 1.2;
    this.eliminationOrder = [];
    this.animTimer = 0;

    this.arenaCenterX = width / 2;
    this.arenaCenterY = height / 2;

    const active = this.getActivePlayers();
    const count = active.length;

    // Distribute planets in arena quadrants/corners
    const positions = count === 2 ? [
      { x: width * 0.26, y: height * 0.52 },
      { x: width * 0.74, y: height * 0.52 }
    ] : [
      { x: width * 0.26, y: height * 0.38 },
      { x: width * 0.74, y: height * 0.38 },
      { x: width * 0.26, y: height * 0.70 },
      { x: width * 0.74, y: height * 0.70 }
    ];

    active.forEach((p, idx) => {
      const pos = positions[idx % positions.length];
      this.planets.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        radius: 28,
        hp: 3,
        maxHp: 3,
        shieldAngle: idx === 0 ? 0 : Math.PI,
        shieldSpan: 1.18, // ~68 degrees
        shieldDistance: 52,
        pulseTimer: 0,
        score: 0,
        deflectStreak: 0,
        isUnderdog: false,
        hitStunTimer: 0
      });
    });

    // Spawn 2 initial meteors
    this.spawnMeteor(width, height);
    this.spawnMeteor(width, height);

    // Expose debug hook for testing
    (window as any).__METEOR_SHIELD_DEBUG__ = {
      getPlanets: () => Array.from(this.planets.values()).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        hp: p.hp,
        shieldAngle: p.shieldAngle,
        shieldSpan: p.shieldSpan,
        score: p.score,
        deflectStreak: p.deflectStreak,
        isUnderdog: p.isUnderdog
      })),
      getMeteors: () => this.meteors.map(m => ({
        x: m.x,
        y: m.y,
        vx: m.vx,
        vy: m.vy,
        radius: m.radius,
        ownerId: m.ownerId,
        isTitan: m.isTitan
      })),
      pulse: (pid: PlayerId) => {
        const p = this.planets.get(pid);
        if (p) p.pulseTimer = 1.0;
      },
      getTheme: () => METEOR_SHIELD_THEMES[this.currentThemeIndex].name,
      setTheme: (idx: number) => {
        this.currentThemeIndex = Math.max(0, Math.min(idx, METEOR_SHIELD_THEMES.length - 1));
      }
    };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;
    const isSuddenDeath = this.roundTimer <= 15;

    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playExplosion();
      this.particles.addTrauma(0.4);
      this.particles.showFloatingText('☄️ SUDDEN DEATH: TITAN METEOR STORM! ☄️', width / 2, height / 2 - 40, '#FACC15', 28);
    }

    this.updateBots(dt, width, height);

    // Spawn meteors periodically (accelerates in Sudden Death)
    this.meteorSpawnTimer -= dt;
    const maxMeteors = isSuddenDeath ? 12 : 8;
    if (this.meteorSpawnTimer <= 0 && this.meteors.length < maxMeteors) {
      const spawnInterval = isSuddenDeath ? 0.8 : Math.max(1.1, 2.2 - (45 - this.roundTimer) * 0.03);
      this.meteorSpawnTimer = spawnInterval;
      this.spawnMeteor(width, height, isSuddenDeath && Math.random() < 0.4);
    }

    // Determine Leader and Underdog
    let maxHp = 0;
    let minHp = 4;
    let maxScore = -Infinity;
    let minScore = Infinity;
    for (const p of this.planets.values()) {
      if (p.hp > maxHp) maxHp = p.hp;
      if (p.hp < minHp && p.hp > 0) minHp = p.hp;
      if (p.score > maxScore) maxScore = p.score;
      if (p.score < minScore) minScore = p.score;
    }

    for (const p of this.planets.values()) {
      if (p.hp <= 0) {
        p.isUnderdog = false;
        continue;
      }
      p.isUnderdog = (maxHp - p.hp >= 1) || (maxScore - p.score >= 150 && maxScore > 0);
      // Underdog magnetic barrier: expanded shield coverage
      p.shieldSpan = p.isUnderdog ? 1.55 : 1.18;
    }

    // Process Planet Shields & Inputs
    for (const planet of this.planets.values()) {
      if (planet.hp <= 0) continue;

      if (planet.pulseTimer > 0) {
        planet.pulseTimer = Math.max(0, planet.pulseTimer - dt * 3.5);
      }
      if (planet.hitStunTimer > 0) {
        planet.hitStunTimer = Math.max(0, planet.hitStunTimer - dt);
      }

      const steer = this.input.getSteer(planet.id);
      const isPressed = this.input.isPressed(planet.id);
      const justAction = this.input.justPressed(planet.id) || this.input.justAction(planet.id);

      // Rotate shield
      if (steer !== 0) {
        planet.shieldAngle += steer * 4.4 * dt;
      } else if (isPressed) {
        // 1-button auto orbit
        planet.shieldAngle += 4.0 * dt;
      }

      // Keep angle normalized
      const twoPi = Math.PI * 2;
      planet.shieldAngle = ((planet.shieldAngle % twoPi) + twoPi) % twoPi;

      // Kinetic repulsor pulse
      if (justAction && planet.pulseTimer <= 0) {
        planet.pulseTimer = 1.0;
        this.audio.playBoost();
        this.particles.spawnSparks(
          planet.x + Math.cos(planet.shieldAngle) * planet.shieldDistance,
          planet.y + Math.sin(planet.shieldAngle) * planet.shieldDistance,
          planet.isUnderdog ? '#F59E0B' : (this.players[planet.id]?.color || '#38BDF8'),
          12
        );
      }
    }

    // Process Meteors Physics & Deflections
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;

      // Fiery trail particles
      if (Math.random() < 0.45) {
        const theme = METEOR_SHIELD_THEMES[this.currentThemeIndex];
        this.particles.spawnSparks(m.x, m.y, m.isTitan ? '#EF4444' : theme.meteorGlow, 1);
      }

      // Screen boundary bounces
      if (m.x < 15 || m.x > width - 15) {
        m.vx = -m.vx;
        m.x = Math.max(15, Math.min(width - 15, m.x));
      }
      if (m.y < 70 || m.y > height - 48) {
        m.vy = -m.vy;
        m.y = Math.max(70, Math.min(height - 48, m.y));
      }

      // Check collision with player shields and planet cores
      for (const planet of this.planets.values()) {
        if (planet.hp <= 0) continue;

        const distToCenter = Math.hypot(m.x - planet.x, m.y - planet.y);

        // 1. Check Shield Deflection Collision
        const shieldDistMin = planet.shieldDistance - 10;
        const shieldDistMax = planet.shieldDistance + (m.isTitan ? 16 : 12);
        if (distToCenter >= shieldDistMin && distToCenter <= shieldDistMax) {
          const meteorAngle = Math.atan2(m.y - planet.y, m.x - planet.x);
          let diff = (meteorAngle - planet.shieldAngle) % (Math.PI * 2);
          if (diff < -Math.PI) diff += Math.PI * 2;
          if (diff > Math.PI) diff -= Math.PI * 2;

          if (Math.abs(diff) <= planet.shieldSpan / 2) {
            // METEOR DEFLECTED BY SHIELD!
            const wasDeflectedByOther = m.ownerId !== null && m.ownerId !== planet.id;
            m.ownerId = planet.id;
            planet.deflectStreak++;

            const isSuperRicochet = planet.pulseTimer > 0;
            const boostMultiplier = isSuperRicochet ? 1.55 : 1.15;
            const pointsEarned = isSuperRicochet ? 50 : 20;
            planet.score += pointsEarned;

            this.audio.playLaser();
            const pColor = this.players[planet.id]?.color || '#38BDF8';
            this.particles.spawnSparks(m.x, m.y, isSuperRicochet ? '#FACC15' : pColor, isSuperRicochet ? 20 : 12);

            const streakLabel = isSuperRicochet
              ? `⚡ SUPER RICOCHET! +${pointsEarned}`
              : `+${pointsEarned} DEFLECTED!`;
            this.particles.showFloatingText(
              streakLabel,
              m.x,
              m.y - 20,
              isSuperRicochet ? '#FACC15' : '#38BDF8',
              isSuperRicochet ? 20 : 16
            );

            // Reflection normal vector
            const nx = Math.cos(meteorAngle);
            const ny = Math.sin(meteorAngle);

            const curSpeed = Math.hypot(m.vx, m.vy) * boostMultiplier;
            const maxSpeed = m.isTitan ? 420 : 520;
            m.vx = nx * Math.min(maxSpeed, curSpeed);
            m.vy = ny * Math.min(maxSpeed, curSpeed);

            // Push outside shield boundary
            m.x = planet.x + nx * (planet.shieldDistance + 18);
            m.y = planet.y + ny * (planet.shieldDistance + 18);
            break;
          }
        }

        // 2. Check Planet Core Direct Impact
        if (distToCenter < planet.radius + m.radius) {
          // DIRECT IMPACT DAMAGE!
          const damage = m.isTitan ? 2 : 1;
          planet.hp = Math.max(0, planet.hp - damage);
          planet.deflectStreak = 0;
          planet.hitStunTimer = 0.35;

          // If another player aimed this deflected meteor into this core, award huge bounty!
          if (m.ownerId !== null && m.ownerId !== planet.id) {
            const attacker = this.planets.get(m.ownerId);
            if (attacker) {
              attacker.score += 150;
              this.particles.showFloatingText(
                `DIRECT HIT BOUNTY! +150`,
                attacker.x,
                attacker.y - 45,
                '#10B981',
                22
              );
            }
          }

          this.audio.playExplosion();
          this.particles.addTrauma(m.isTitan ? 0.45 : 0.30);
          this.particles.spawnExplosion(m.x, m.y, '#EF4444', m.isTitan ? 55 : 35);
          this.particles.showFloatingText(
            `-${damage} CORE HP! 💥`,
            planet.x,
            planet.y - 35,
            '#EF4444',
            22
          );

          // Meteor destroyed on impact
          this.meteors.splice(i, 1);

          if (planet.hp <= 0) {
            this.eliminationOrder.push(planet.id);
            this.particles.showFloatingText('CORE PULVERIZED! 💀', planet.x, planet.y - 20, '#EF4444', 24);
          }
          break;
        }
      }
    }

    // Check round over
    const alivePlanets = Array.from(this.planets.values()).filter((p) => p.hp > 0);
    if (alivePlanets.length <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnMeteor(width: number, height: number, isTitan: boolean = false): void {
    const side = Math.floor(Math.random() * 4);
    let sx = 0;
    let sy = 0;
    if (side === 0) { sx = Math.random() * width; sy = 75; }
    else if (side === 1) { sx = width - 20; sy = Math.random() * height; }
    else if (side === 2) { sx = Math.random() * width; sy = height - 55; }
    else { sx = 20; sy = Math.random() * height; }

    const targetX = width / 2 + (Math.random() - 0.5) * 160;
    const targetY = height / 2 + (Math.random() - 0.5) * 160;
    const dx = targetX - sx;
    const dy = targetY - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const baseSpeed = isTitan ? 130 + Math.random() * 50 : 170 + Math.random() * 90;

    this.meteors.push({
      x: sx,
      y: sy,
      vx: (dx / dist) * baseSpeed,
      vy: (dy / dist) * baseSpeed,
      radius: isTitan ? 16 : 9,
      speed: baseSpeed,
      ownerId: null,
      life: 22,
      isTitan
    });
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const planet = this.planets.get(botId);
    if (!planet || planet.hp <= 0) return;

    // Find closest meteor threatening this planet
    let nearestMeteor: Meteor | null = null;
    let minD = Infinity;

    for (const m of this.meteors) {
      const d = Math.hypot(m.x - planet.x, m.y - planet.y);
      const dot = (m.x - planet.x) * m.vx + (m.y - planet.y) * m.vy;
      if (dot < 0 && d < minD && d < 260) {
        minD = d;
        nearestMeteor = m;
      }
    }

    if (nearestMeteor) {
      const threatAngle = Math.atan2(nearestMeteor.y - planet.y, nearestMeteor.x - planet.x);
      let diff = (threatAngle - planet.shieldAngle) % (Math.PI * 2);
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;

      // Human inaccuracy calibration
      if (difficulty === 'bot_easy') {
        diff += (Math.random() - 0.5) * 0.45;
      } else if (difficulty === 'bot_normal') {
        diff += (Math.random() - 0.5) * 0.15;
      }

      if (Math.abs(diff) > 0.08) {
        const steer = diff > 0 ? 1 : -1;
        this.input.setBotInput(botId, false, steer, 0, false);
      } else {
        // Aligned! Repulsor pulse if meteor is closing in
        const wantPulse = minD < planet.shieldDistance + 24;
        this.input.setBotInput(botId, false, 0, 0, wantPulse);
      }
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.planets.values()).sort(
      (a, b) => b.hp - a.hp || b.score - a.score
    );
    const winnerId = sorted.length > 0 && sorted[0].hp > 0 ? sorted[0].id : null;

    return {
      winnerId,
      rankings: sorted.map((p, idx) => ({
        playerId: p.id,
        score: p.hp * 100 + p.score,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null
        ? `${this.players[winnerId].name}'S PLANETARY SHIELD SURVIVED WITH ${sorted[0].hp} HP (${sorted[0].score} PTS)!`
        : 'ALL PLANETARY CORES WERE PULVERIZED!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = METEOR_SHIELD_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15;

    // 1. Deep Space Theme Background
    const bgGrad = ctx.createRadialGradient(
      this.arenaCenterX, this.arenaCenterY, 40,
      this.arenaCenterX, this.arenaCenterY, width * 0.8
    );
    bgGrad.addColorStop(0, theme.bgGradStart);
    bgGrad.addColorStop(0.65, theme.bgGradMid);
    bgGrad.addColorStop(1, theme.bgGradEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant Stars
    ctx.fillStyle = theme.starColor;
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137.5) % width;
      const sy = (i * 219.3) % height;
      ctx.globalAlpha = 0.25 + (i % 6) * 0.12;
      ctx.fillRect(sx, sy, 1.8, 1.8);
    }
    ctx.globalAlpha = 1.0;

    // 2. Render Planets, Shields, and Mascot Commanders
    for (const p of this.planets.values()) {
      const pColor = this.players[p.id]?.color || '#38BDF8';
      const isBot = this.players[p.id]?.type.startsWith('bot_') ?? false;

      // Orbital Shield Track Circle
      ctx.save();
      ctx.strokeStyle = p.isUnderdog ? '#F59E0B' : theme.shieldTrack;
      ctx.lineWidth = p.isUnderdog ? 2 : 1.5;
      ctx.setLineDash(p.isUnderdog ? [6, 4] : [4, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.shieldDistance, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (p.hp > 0) {
        // Orbiting Deflector Shield Arc
        ctx.save();
        const isPulsing = p.pulseTimer > 0;
        ctx.shadowColor = isPulsing ? '#FFFFFF' : (p.isUnderdog ? '#F59E0B' : pColor);
        ctx.shadowBlur = isPulsing ? 24 : 14;
        ctx.strokeStyle = isPulsing ? '#FFFFFF' : (p.isUnderdog ? '#F59E0B' : pColor);
        ctx.lineWidth = isPulsing ? 9 : 6;
        ctx.beginPath();
        const startA = p.shieldAngle - p.shieldSpan / 2;
        const endA = p.shieldAngle + p.shieldSpan / 2;
        ctx.arc(p.x, p.y, p.shieldDistance, startA, endA);
        ctx.stroke();
        ctx.restore();
      }

      // Planet Core Body
      ctx.save();
      if (p.hp > 0) {
        ctx.shadowColor = pColor;
        ctx.shadowBlur = 16;
        const planetGrad = ctx.createRadialGradient(p.x - 6, p.y - 6, 2, p.x, p.y, p.radius);
        planetGrad.addColorStop(0, '#FFFFFF');
        planetGrad.addColorStop(0.5, pColor);
        planetGrad.addColorStop(1, '#0F172A');
        ctx.fillStyle = planetGrad;
      } else {
        ctx.fillStyle = '#1E293B';
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Render Mascot Commander inside Planet Core
      if (p.hp > 0) {
        let mood: CharacterMood = 'focused';
        if (p.hitStunTimer > 0) {
          mood = 'shocked';
        } else if (p.pulseTimer > 0 || p.deflectStreak >= 3) {
          mood = 'happy';
        } else if (this.isFinished) {
          mood = 'triumph';
        }

        drawCharacter(ctx, p.x, p.y, 14, p.id, isBot, mood, this.animTimer);
      }

      // HP Hearts & Score Badge Above Planet
      ctx.save();
      ctx.textAlign = 'center';
      const badgeY = p.y - p.shieldDistance - 14;

      let hpStr = '';
      for (let h = 0; h < p.hp; h++) hpStr += '❤️';
      if (p.hp <= 0) hpStr = '💀 DESTROYED';
      ctx.font = '11px sans-serif';
      ctx.fillText(hpStr, p.x, badgeY - 12);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 11px Montserrat, sans-serif';
      ctx.fillText(`${p.score} PTS`, p.x, badgeY);

      if (p.deflectStreak >= 2 && p.hp > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = '800 10px Montserrat, sans-serif';
        ctx.fillText(`${p.deflectStreak}X RICOCHET`, p.x, badgeY + 12);
      }
      ctx.restore();
    }

    // 3. Render Meteors
    for (const m of this.meteors) {
      ctx.save();
      ctx.shadowColor = m.isTitan ? '#EF4444' : theme.meteorGlow;
      ctx.shadowBlur = m.isTitan ? 22 : 14;

      // Fiery Core
      const mGrad = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, m.radius);
      if (m.isTitan) {
        mGrad.addColorStop(0, '#FFFFFF');
        mGrad.addColorStop(0.4, '#F87171');
        mGrad.addColorStop(1, '#991B1B');
      } else {
        mGrad.addColorStop(0, theme.meteorCoreStart);
        mGrad.addColorStop(0.5, theme.meteorCoreMid);
        mGrad.addColorStop(1, theme.meteorCoreEnd);
      }
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();

      // Flame tail
      const tailAngle = Math.atan2(-m.vy, -m.vx);
      ctx.strokeStyle = m.isTitan ? 'rgba(239, 68, 68, 0.7)' : 'rgba(249, 115, 22, 0.6)';
      ctx.lineWidth = m.isTitan ? 8 : 4;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + Math.cos(tailAngle) * (m.isTitan ? 28 : 18), m.y + Math.sin(tailAngle) * (m.isTitan ? 28 : 18));
      ctx.stroke();
      ctx.restore();
    }

    // 4. Header Badge (y: 56)
    ctx.save();
    const pillW = 440;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#F87171' : '#FFFFFF';
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isSuddenDeath
        ? '☄️ TITAN METEOR STORM! PULSE SHIELD TO DEFLECT TITANS! ☄️'
        : 'ORBIT SHIELD • DEFLECT METEORS AT RIVALS • TAP FOR PULSE!',
      width / 2,
      pillY + pillH / 2
    );
    ctx.restore();

    // 5. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 170, 32, 16);
    else ctx.rect(20, height - 44, 170, 32);
    ctx.fill();
    ctx.strokeStyle = theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.themePillColor;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 85, height - 44 + 16);
    ctx.restore();

    // 6. On-screen Controls Pill (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Steer: Orbit Shield | Space/Tap: Kinetic Pulse', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }
}
