import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type VolleyTheme = 'sunset' | 'cyber' | 'caldera';

export interface VolleyThemeConfig {
  id: VolleyTheme;
  name: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  floorColor: string;
  floorTrimColor: string;
  netColor: string;
  pillColor: string;
  sunColor: string;
}

export const THEME_CONFIGS: VolleyThemeConfig[] = [
  {
    id: 'sunset',
    name: 'Neon Sunset Beach 🌅',
    skyTop: '#1E1B4B',
    skyMid: '#4C1D95',
    skyBottom: '#F43F5E',
    floorColor: '#0F172A',
    floorTrimColor: '#10B981',
    netColor: '#94A3B8',
    pillColor: '#F43F5E',
    sunColor: 'rgba(251, 191, 36, 0.28)'
  },
  {
    id: 'cyber',
    name: 'Cyber Neon Court ⚡',
    skyTop: '#020617',
    skyMid: '#0F172A',
    skyBottom: '#1E293B',
    floorColor: '#030712',
    floorTrimColor: '#06B6D4',
    netColor: '#38BDF8',
    pillColor: '#06B6D4',
    sunColor: 'rgba(6, 182, 212, 0.22)'
  },
  {
    id: 'caldera',
    name: 'Lava Caldera Beach 🔥',
    skyTop: '#18181B',
    skyMid: '#450A0A',
    skyBottom: '#7F1D1D',
    floorColor: '#1C1917',
    floorTrimColor: '#F97316',
    netColor: '#F59E0B',
    pillColor: '#EA580C',
    sunColor: 'rgba(239, 68, 68, 0.25)'
  }
];

interface VolleyPlayer {
  id: PlayerId;
  team: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  groundY: number;
  isGrounded: boolean;
  radius: number;
  score: number;
  touches: number;
  spikeCooldown: number;
  diveTimer: number;
  isDiving: boolean;
  isUnderdog: boolean;
  botReactionTimer: number;
  patrolDir: 1 | -1;
  celebrateTimer: number;
  shockTimer: number;
}

interface VolleyBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isSpiked: boolean;
  isFireball: boolean;
  lastTouchTeam: 'LEFT' | 'RIGHT' | null;
  lastTouchPlayer: PlayerId | null;
  previousTouchPlayer: PlayerId | null;
  teamTouches: number;
}

export class VolleySpikeGame extends BaseGame {
  private playersState: Map<PlayerId, VolleyPlayer> = new Map();
  private ball: VolleyBall = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 14,
    isSpiked: false,
    isFireball: false,
    lastTouchTeam: null,
    lastTouchPlayer: null,
    previousTouchPlayer: null,
    teamTouches: 0
  };

  private floorY: number = 0;
  private netX: number = 0;
  private netTopY: number = 0;
  private netHeight: number = 100;
  private netWidth: number = 12;
  private teamLeftScore: number = 0;
  private teamRightScore: number = 0;
  private targetScore: number = 5;
  private serveTimer: number = 0;
  private gravity: number = 720;

  // Theme & Layout Controls
  public mapTheme: VolleyTheme = 'sunset';
  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;

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
    this.isFinished = false;
    this.roundTimer = 45;
    this.teamLeftScore = 0;
    this.teamRightScore = 0;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;

    this.floorY = height - 50;
    this.netX = width / 2;
    this.netHeight = 110;
    this.netTopY = this.floorY - this.netHeight;

    this.input.setControlMode('directional');
    this.initPlayers(width);
    this.serveBall('LEFT');
    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__VOLLEY_SPIKE_DEBUG__ = {
        get players() { return Array.from(self.playersState.values()); },
        get ball() { return self.ball; },
        get teamLeftScore() { return self.teamLeftScore; },
        get teamRightScore() { return self.teamRightScore; },
        get isFinished() { return self.isFinished; },
        get roundTimer() { return self.roundTimer; },
        get theme() { return self.mapTheme; },
        setTheme: (theme: VolleyTheme) => self.setMapTheme(theme),
        cycleTheme: () => self.cycleTheme(),
        handlePointScored: (team: 'LEFT' | 'RIGHT', reason: string) => self.handlePointScored(team, reason)
      };
    }
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
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.mapTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setMapTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setMapTheme(theme: VolleyTheme): void {
    if (this.mapTheme === theme) return;
    this.mapTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#38BDF8', 12);
    this.syncDebug();
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.unbindKeyboardShortcuts();

    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setMapTheme('sunset');
      } else if (e.key === '2') {
        this.setMapTheme('cyber');
      } else if (e.key === '3') {
        this.setMapTheme('caldera');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private unbindKeyboardShortcuts(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  public override destroy(): void {
    this.unbindKeyboardShortcuts();
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (typeof window !== 'undefined' && (window as any).__VOLLEY_SPIKE_DEBUG__) {
      delete (window as any).__VOLLEY_SPIKE_DEBUG__;
    }
  }

  private initPlayers(width: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const isLeft = idx % 2 === 0;
      const team: 'LEFT' | 'RIGHT' = isLeft ? 'LEFT' : 'RIGHT';

      let startX: number;
      if (count === 2) {
        startX = isLeft ? this.netX * 0.45 : this.netX + (width - this.netX) * 0.55;
      } else {
        const rank = Math.floor(idx / 2);
        startX = isLeft
          ? this.netX * (rank === 0 ? 0.35 : 0.68)
          : this.netX + (width - this.netX) * (rank === 0 ? 0.65 : 0.32);
      }

      this.playersState.set(p.id, {
        id: p.id,
        team,
        x: startX,
        y: this.floorY - 18,
        vx: 0,
        vy: 0,
        baseX: startX,
        groundY: this.floorY - 18,
        isGrounded: true,
        radius: 18,
        score: 0,
        touches: 0,
        spikeCooldown: 0,
        diveTimer: 0,
        isDiving: false,
        isUnderdog: false,
        botReactionTimer: 0.15 + idx * 0.1,
        patrolDir: 1,
        celebrateTimer: 0,
        shockTimer: 0
      });
    });
  }

  private serveBall(servingTeam: 'LEFT' | 'RIGHT'): void {
    this.serveTimer = 1.0;
    this.ball.x = servingTeam === 'LEFT' ? this.netX * 0.45 : this.netX + (this.netX * 0.55);
    this.ball.y = this.netTopY - 70;
    this.ball.vx = servingTeam === 'LEFT' ? 80 : -80;
    this.ball.vy = -180;
    this.ball.isSpiked = false;
    this.ball.isFireball = this.roundTimer <= 15;
    this.ball.lastTouchTeam = null;
    this.ball.lastTouchPlayer = null;
    this.ball.previousTouchPlayer = null;
    this.ball.teamTouches = 0;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    const isSuddenDeath = this.roundTimer <= 15;

    // Sudden Death warning trigger
    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.ball.isFireball = true;
      this.audio.playBoost();
      this.particles.shake(0.5);
      this.particles.showFloatingText('⚡ FIREBALL RALLY OVERDRIVE! 2x POINTS! ⚡', width / 2, height / 2 - 30, '#FACC15', 30);
    }

    // Underdog Team detection (trailing by >= 2 points)
    const leftIsUnderdog = this.teamRightScore - this.teamLeftScore >= 2;
    const rightIsUnderdog = this.teamLeftScore - this.teamRightScore >= 2;

    for (const ps of this.playersState.values()) {
      ps.isUnderdog = (ps.team === 'LEFT' && leftIsUnderdog) || (ps.team === 'RIGHT' && rightIsUnderdog);
      if (ps.celebrateTimer > 0) ps.celebrateTimer = Math.max(0, ps.celebrateTimer - dt);
      if (ps.shockTimer > 0) ps.shockTimer = Math.max(0, ps.shockTimer - dt);
    }

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.spikeCooldown > 0) ps.spikeCooldown = Math.max(0, ps.spikeCooldown - dt);
      if (ps.diveTimer > 0) {
        ps.diveTimer = Math.max(0, ps.diveTimer - dt);
        if (ps.diveTimer <= 0) ps.isDiving = false;
      }

      const steer = this.input.getSteer(p.id);
      const rawSteer = this.input.getRawSteer(p.id);
      const effectiveSteer = Math.abs(steer) > 0.1 ? steer : rawSteer;

      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      const justUp = this.input.justUp(p.id);
      const justDown = this.input.justDown(p.id);
      const throttle = this.input.getThrottle(p.id);
      const rawThrottle = this.input.getRawThrottle(p.id);

      const isJump = justUp || (justAction && throttle >= -0.2) || throttle > 0.4 || rawThrottle > 0;
      const isDive = justDown || throttle < -0.4 || rawThrottle < 0;

      // Underdog Jet Shoes: Super fast recovery and dive boost
      const diveDuration = ps.isUnderdog ? 0.24 : 0.38;

      if (isDive && !ps.isDiving) {
        ps.isDiving = true;
        ps.diveTimer = diveDuration;
        const diveDir = effectiveSteer !== 0 ? Math.sign(effectiveSteer) : (ps.team === 'LEFT' ? 1 : -1);
        ps.vx = diveDir * (ps.isUnderdog ? 440 : 380);
        if (!ps.isGrounded) {
          ps.vy = 280;
        }
        this.audio.playWhoosh();
        this.particles.spawnDust(ps.x, ps.y + ps.radius, 8);
        this.particles.showFloatingText('DIVE!', ps.x, ps.y - 20, '#38BDF8', 18);
      }

      const moveMultiplier = ps.isUnderdog ? 1.20 : 1.0;
      const moveSpeed = (ps.isDiving ? 380 : ps.isGrounded ? 280 : 250) * moveMultiplier;
      if (effectiveSteer !== 0) {
        ps.vx = effectiveSteer * moveSpeed;
      } else if (ps.isDiving) {
        ps.vx *= Math.pow(0.92, dt * 60);
      } else {
        ps.vx = 0;
      }
      ps.x += ps.vx * dt;

      // Boundaries
      const minX = ps.team === 'LEFT' ? ps.radius + 15 : this.netX + this.netWidth / 2 + ps.radius;
      const maxX = ps.team === 'LEFT' ? this.netX - this.netWidth / 2 - ps.radius : width - ps.radius - 15;
      if (ps.x < minX) ps.x = minX;
      if (ps.x > maxX) ps.x = maxX;

      // Jump & Gravity (Underdog jumps 25% higher)
      if (isJump && ps.isGrounded && !ps.isDiving) {
        ps.vy = ps.isUnderdog ? -620 : -510;
        ps.isGrounded = false;
        this.audio.playBounce();
        this.particles.spawnDust(ps.x, ps.y + ps.radius, 6);
      }

      if (!ps.isGrounded) {
        ps.vy += this.gravity * dt;
        ps.y += ps.vy * dt;

        if (ps.y >= ps.groundY) {
          ps.y = ps.groundY;
          ps.vy = 0;
          ps.isGrounded = true;
        }
      }
    }

    if (this.serveTimer > 0) {
      this.serveTimer -= dt;
      return;
    }

    // Update Ball Physics
    this.ball.vy += this.gravity * dt;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.vx *= Math.pow(0.992, dt * 60);

    // Fireball sparks during sudden death
    if (this.ball.isFireball && Math.random() < 0.4) {
      this.particles.spawnExplosion(this.ball.x, this.ball.y, '#FACC15', 3);
    }

    // Ball Wall Collisions
    if (this.ball.x - this.ball.radius < 10) {
      this.ball.x = 10 + this.ball.radius;
      this.ball.vx = Math.abs(this.ball.vx) * 0.85;
      this.audio.playBounce();
    } else if (this.ball.x + this.ball.radius > width - 10) {
      this.ball.x = width - 10 - this.ball.radius;
      this.ball.vx = -Math.abs(this.ball.vx) * 0.85;
      this.audio.playBounce();
    }

    // Ball Net Collision
    const netLeft = this.netX - this.netWidth / 2;
    const netRight = this.netX + this.netWidth / 2;
    if (
      this.ball.y + this.ball.radius >= this.netTopY &&
      this.ball.x + this.ball.radius >= netLeft &&
      this.ball.x - this.ball.radius <= netRight
    ) {
      if (this.ball.y < this.netTopY + 8) {
        this.ball.vy = -Math.abs(this.ball.vy) * 0.75;
        this.ball.y = this.netTopY - this.ball.radius;
      } else {
        if (this.ball.x < this.netX) {
          this.ball.x = netLeft - this.ball.radius;
          this.ball.vx = -Math.abs(this.ball.vx) * 0.8;
        } else {
          this.ball.x = netRight + this.ball.radius;
          this.ball.vx = Math.abs(this.ball.vx) * 0.8;
        }
      }
      this.ball.isSpiked = false;
      this.audio.playBounce();
    }

    // Ball & Player Collisions
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const dx = this.ball.x - ps.x;
      const dy = this.ball.y - ps.y;
      const dist = Math.hypot(dx, dy);

      const touchRadius = this.ball.radius + ps.radius + (ps.isDiving ? 8 : 0);
      if (dist < touchRadius) {
        const normalX = dx / (dist || 1);
        const normalY = dy / (dist || 1);

        const isSpikeAttempt = (!ps.isGrounded && ps.y < this.netTopY + 36 && ps.spikeCooldown <= 0) ||
                               (!ps.isGrounded && (this.input.justDown(p.id) || this.input.getThrottle(p.id) < -0.3));

        if (isSpikeAttempt) {
          // POWER SPIKE!
          this.ball.isSpiked = true;
          ps.spikeCooldown = 0.45;
          const spikeDir = ps.team === 'LEFT' ? 1 : -1;
          const fireballBoost = this.ball.isFireball ? 1.25 : 1.0;
          this.ball.vx = spikeDir * (390 + Math.random() * 60) * fireballBoost;
          this.ball.vy = (280 + Math.random() * 60) * fireballBoost;

          this.audio.playSpike();
          this.particles.shake(0.35);
          this.particles.showFloatingText('POWER SPIKE!!', ps.x, ps.y - 30, '#F59E0B', 24);
          this.particles.spawnConfetti(this.ball.x, this.ball.y, 25);
        } else {
          this.ball.isSpiked = false;

          const active = this.getActivePlayers();
          const teammate = active.find((tp) => tp.id !== ps.id && this.playersState.get(tp.id)?.team === ps.team);
          const tmState = teammate ? this.playersState.get(teammate.id) : null;

          if (this.ball.lastTouchTeam !== ps.team && tmState) {
            const toTmX = tmState.x - ps.x;
            this.ball.vx = Math.max(-170, Math.min(170, toTmX * 1.5));
            this.ball.vy = -470;
            this.particles.showFloatingText('NICE SET!', ps.x, ps.y - 25, '#38BDF8', 18);
          } else {
            const popDir = ps.team === 'LEFT' ? 1 : -1;
            const angleInfluence = normalX * 180;
            this.ball.vx = popDir * 165 + angleInfluence + ps.vx * 0.35;
            this.ball.vy = -410 - Math.abs(ps.vy) * 0.2;
          }

          this.audio.playBounce();
          this.particles.spawnSparks(this.ball.x, this.ball.y, p.color, 8);
        }

        if (this.ball.lastTouchTeam === ps.team) {
          this.ball.teamTouches += 1;
        } else {
          this.ball.lastTouchTeam = ps.team;
          this.ball.teamTouches = 1;
        }
        this.ball.previousTouchPlayer = this.ball.lastTouchPlayer;
        this.ball.lastTouchPlayer = ps.id;
        ps.touches += 1;

        this.ball.x = ps.x + normalX * (touchRadius + 2);
        this.ball.y = ps.y + normalY * (touchRadius + 2);

        if (this.ball.teamTouches > 3) {
          this.handlePointScored(ps.team === 'LEFT' ? 'RIGHT' : 'LEFT', 'FOUR TOUCHES FAULT!');
          return;
        }
      }
    }

    // Ground Touch / Point scored check
    if (this.ball.y + this.ball.radius >= this.floorY) {
      if (this.ball.x < this.netX) {
        this.handlePointScored('RIGHT', 'POINT RIGHT!');
      } else {
        this.handlePointScored('LEFT', 'POINT LEFT!');
      }
    }

    this.syncDebug();

    // Round over condition
    if (
      this.teamLeftScore >= this.targetScore ||
      this.teamRightScore >= this.targetScore ||
      this.roundTimer <= 0
    ) {
      this.isFinished = true;
    }
  }

  private handlePointScored(scoringTeam: 'LEFT' | 'RIGHT', reason: string): void {
    if (scoringTeam === 'LEFT') {
      this.teamLeftScore += 1;
    } else {
      this.teamRightScore += 1;
    }

    let isTeamCombo = false;
    let assisterId: PlayerId | null = null;
    let scorerId: PlayerId | null = null;

    if (this.ball.lastTouchTeam === scoringTeam && this.ball.lastTouchPlayer !== null) {
      scorerId = this.ball.lastTouchPlayer;
      if (this.ball.previousTouchPlayer !== null && this.ball.previousTouchPlayer !== scorerId) {
        const prevPlayer = this.playersState.get(this.ball.previousTouchPlayer);
        if (prevPlayer && prevPlayer.team === scoringTeam) {
          isTeamCombo = true;
          assisterId = prevPlayer.id;
        }
      }
    }

    const isSuddenDeath = this.roundTimer <= 15;
    const pointsAwarded = isSuddenDeath ? 200 : 100;

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      if (ps.team === scoringTeam) {
        ps.score += pointsAwarded;
        ps.celebrateTimer = 1.2;
        if (isTeamCombo && p.id === assisterId) {
          ps.score += 40;
        }
        if (isTeamCombo && p.id === scorerId) {
          ps.score += 40;
        }
      } else {
        ps.shockTimer = 1.0;
      }
    }

    const color = scoringTeam === 'LEFT' ? '#3B82F6' : '#EF4444';
    this.audio.playScore();
    this.particles.shake(0.35);

    if (isTeamCombo) {
      this.particles.showFloatingText(`DUO COMBO! +${pointsAwarded + 40} PTS!`, this.ball.x, this.floorY - 65, '#F59E0B', 28);
      this.particles.spawnConfetti(this.ball.x, this.floorY - 20, 35);
    } else {
      this.particles.showFloatingText(reason, this.ball.x, this.floorY - 45, color, 26);
      this.particles.spawnConfetti(this.ball.x, this.floorY - 15, 25);
    }

    const nextServeTeam = scoringTeam === 'LEFT' ? 'RIGHT' : 'LEFT';
    this.serveBall(nextServeTeam);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const interval =
      difficulty === 'bot_hard' ? 0.04 : difficulty === 'bot_normal' ? 0.08 : 0.16;
    ps.botReactionTimer = interval;

    const ballHeadingToMe =
      (ps.team === 'LEFT' && this.ball.vx < 0) ||
      (ps.team === 'RIGHT' && this.ball.vx > 0) ||
      (ps.team === 'LEFT' && this.ball.x < this.netX) ||
      (ps.team === 'RIGHT' && this.ball.x > this.netX);

    let targetX = ps.baseX;
    let shouldJump = false;

    if (ballHeadingToMe) {
      const targetHeadY = ps.groundY - 30;
      let predictedX = this.ball.x;

      if (this.ball.y < targetHeadY) {
        const a = 0.5 * this.gravity;
        const b = this.ball.vy;
        const c = this.ball.y - targetHeadY;
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const t = (-b + Math.sqrt(disc)) / (2 * a);
          if (t > 0) {
            predictedX = this.ball.x + this.ball.vx * t;
            if (predictedX < 15) predictedX = 15 + Math.abs(predictedX - 15);
            else if (predictedX > width - 15) predictedX = width - 15 - Math.abs(predictedX - (width - 15));
          }
        }
      }

      if (difficulty === 'bot_easy') {
        predictedX += (Math.random() - 0.5) * 65;
      } else if (difficulty === 'bot_normal') {
        predictedX += (Math.random() - 0.5) * 22;
      }

      targetX = predictedX;

      if (ps.team === 'LEFT') {
        targetX -= 12;
      } else {
        targetX += 12;
      }

      const distToBall = Math.hypot(ps.x - this.ball.x, ps.y - this.ball.y);
      if (distToBall < 110 && this.ball.y < ps.y - 15 && this.ball.vy > -50) {
        if (difficulty === 'bot_easy' && Math.random() < 0.35) {
          shouldJump = false;
        } else {
          shouldJump = true;
        }
      }
    } else {
      targetX = ps.baseX;
    }

    let steer = 0;
    if (targetX > ps.x + 8) steer = 1;
    else if (targetX < ps.x - 8) steer = -1;

    this.input.setBotInput(botId, shouldJump, steer, shouldJump ? -1 : 0, shouldJump);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEME_CONFIGS.find((t) => t.id === this.mapTheme) || THEME_CONFIGS[0];

    // Court Background
    this.renderCourtBackground(ctx, width, height, theme);

    // Net & Floor
    this.renderNetAndFloor(ctx, width, theme);

    // Players with CharacterRenderer Mascot
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderVolleyPlayer(ctx, ps, p);
    }

    // Volleyball
    this.renderBall(ctx);

    // Center HUD Pod at y = 56
    this.renderCenterHudPod(ctx, width, theme);

    // Interactive Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, theme);

    // Control Hints (Right-aligned)
    this.renderControlHints(ctx, width, height);
  }

  private renderCourtBackground(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VolleyThemeConfig): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(0.5, theme.skyMid);
    bgGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant Sun / Ring
    ctx.beginPath();
    ctx.arc(width / 2, this.floorY - 140, 90, 0, Math.PI * 2);
    ctx.fillStyle = theme.sunColor;
    ctx.fill();
  }

  private renderNetAndFloor(ctx: CanvasRenderingContext2D, width: number, theme: VolleyThemeConfig): void {
    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(0, this.floorY, width, 50);

    ctx.fillStyle = theme.floorTrimColor;
    ctx.fillRect(0, this.floorY, width, 5);

    // Center Net Post
    ctx.fillStyle = theme.netColor;
    ctx.fillRect(this.netX - this.netWidth / 2, this.netTopY, this.netWidth, this.netHeight);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.netX - this.netWidth / 2, this.netTopY, this.netWidth, this.netHeight);

    // Net Mesh
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    for (let y = this.netTopY + 10; y < this.floorY; y += 12) {
      ctx.beginPath();
      ctx.moveTo(this.netX - this.netWidth / 2, y);
      ctx.lineTo(this.netX + this.netWidth / 2, y);
      ctx.stroke();
    }

    // Top Net White Band Tape
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(this.netX - this.netWidth / 2 - 2, this.netTopY, this.netWidth + 4, 8);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.netX - this.netWidth / 2 - 2, this.netTopY, this.netWidth + 4, 8);
  }

  private renderVolleyPlayer(
    ctx: CanvasRenderingContext2D,
    ps: VolleyPlayer,
    p: PlayerConfig
  ): void {
    // Shadow on court floor
    ctx.beginPath();
    ctx.ellipse(ps.x, this.floorY - 2, ps.radius * 0.85, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Underdog Jet Shoes Aura
    if (ps.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, ps.radius + 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.font = '900 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('JET ⚡', ps.x, ps.y + ps.radius + 14);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(ps.x, ps.y);

    let mood: CharacterMood = 'focused';
    if (ps.shockTimer > 0) {
      mood = 'shocked';
    } else if (ps.celebrateTimer > 0) {
      mood = 'triumph';
    } else if (!ps.isGrounded) {
      mood = 'focused';
    } else {
      mood = 'happy';
    }

    const isBot = p.type.startsWith('bot_');

    // Mascot Avatar via CharacterRenderer
    drawCharacter(ctx, 0, 0, 16, p.id, isBot, mood, this.animTimer * 4);

    ctx.restore();
  }

  private renderBall(ctx: CanvasRenderingContext2D): void {
    const shadowDist = Math.max(0, this.floorY - this.ball.y);
    const shadowScale = Math.max(0.25, 1 - shadowDist / 420);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(this.ball.x, this.floorY - 2, this.ball.radius * shadowScale * 1.3, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * shadowScale})`;
    ctx.fill();

    // Projected Landing Reticle
    if (this.ball.vy > 0 && shadowDist > 40) {
      const a = 0.5 * this.gravity;
      const b = this.ball.vy;
      const c = this.ball.y - this.floorY;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const t = (-b + Math.sqrt(disc)) / (2 * a);
        if (t > 0 && t < 1.4) {
          const landX = this.ball.x + this.ball.vx * t;
          ctx.beginPath();
          ctx.ellipse(landX, this.floorY - 2, 16, 5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = this.ball.isSpiked || this.ball.isFireball ? '#EF4444' : 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    ctx.restore();

    ctx.save();
    ctx.translate(this.ball.x, this.ball.y);

    if (this.ball.isSpiked || this.ball.isFireball) {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, this.ball.radius + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, this.ball.radius + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(0, 0, this.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.ball.isFireball ? '#FEF08A' : '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-2, -2, this.ball.radius * 0.75, 0, Math.PI * 0.8);
    ctx.stroke();

    ctx.strokeStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(2, 2, this.ball.radius * 0.75, Math.PI, Math.PI * 1.8);
    ctx.stroke();

    ctx.restore();
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number, theme: VolleyThemeConfig): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.pillColor;
    ctx.fillText(theme.name.toUpperCase(), podX + 16, podY + podH / 2);

    // Score Board in Center
    ctx.font = '800 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${this.teamLeftScore}  —  ${this.teamRightScore}`, width / 2, podY + podH / 2);

    // Sudden death or sub-status on right
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#FACC15';
      ctx.fillText('⚡ FIREBALL', podX + podW - 16, podY + podH / 2);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('FIRST TO 5', podX + podW - 16, podY + podH / 2);
    }
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, theme: VolleyThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = theme.pillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(theme.name, pillX + 14, pillY + pillH / 2);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 12, pillY + pillH / 2);
    ctx.restore();
  }

  private renderControlHints(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('A/D: Move | Up/Space: Jump/Spike | Down: Dive Dig', width - 24, height - 28);
    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const winningTeam = this.teamLeftScore >= this.teamRightScore ? 'LEFT' : 'RIGHT';

    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
        const isWinningTeam = ps && ps.team === winningTeam;
        return {
          playerId: p.id,
          score,
          place: isWinningTeam ? 1 : 2
        };
      })
      .sort((a, b) => {
        if (a.place !== b.place) return a.place - b.place;
        return b.score - a.score;
      });

    const winningPlayers = rankings.filter((r) => r.place === 1);
    const winnerId = winningPlayers.length > 0 ? winningPlayers[0].playerId : null;

    let mvpHighlight = 'Beach Volley Champions!';
    if (this.teamLeftScore !== this.teamRightScore) {
      const winningTeamName = this.teamLeftScore > this.teamRightScore ? 'Blue Duo' : 'Red Duo';
      mvpHighlight = `${winningTeamName} spiked to victory with unstoppable team coordination!`;
    } else if (winnerId !== null) {
      mvpHighlight = `Player ${Number(winnerId) + 1} dominated the volleyball net!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
