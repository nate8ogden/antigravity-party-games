import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type RailThemeId = 'aero_skyline' | 'cyber_subway' | 'solar_orbit';

interface RailTheme {
  id: RailThemeId;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  railColor: string;
  railGlow: string;
  barrierColor: string;
  batteryColor: string;
  accentColor: string;
}

const THEMES: Record<RailThemeId, RailTheme> = {
  aero_skyline: {
    id: 'aero_skyline',
    name: 'Aero Skyline Magnetic Rails',
    icon: '🏙️',
    bgTop: '#090814',
    bgBottom: '#24143D',
    railColor: '#00E5FF',
    railGlow: '#00E5FF',
    barrierColor: '#EF4444',
    batteryColor: '#FBBF24',
    accentColor: '#00E5FF'
  },
  cyber_subway: {
    id: 'cyber_subway',
    name: 'Cyber Deep Grid Sub-Rails',
    icon: '⚡',
    bgTop: '#060F0B',
    bgBottom: '#102E20',
    railColor: '#10B981',
    railGlow: '#34D399',
    barrierColor: '#F43F5E',
    batteryColor: '#FDE047',
    accentColor: '#10B981'
  },
  solar_orbit: {
    id: 'solar_orbit',
    name: 'Solar Orbital Sky-Array',
    icon: '🌌',
    bgTop: '#0C0614',
    bgBottom: '#31102A',
    railColor: '#F59E0B',
    railGlow: '#FBBF24',
    barrierColor: '#DC2626',
    batteryColor: '#38BDF8',
    accentColor: '#F59E0B'
  }
};

const THEME_ORDER: RailThemeId[] = ['aero_skyline', 'cyber_subway', 'solar_orbit'];

interface RailObstacle {
  x: number;
  railIdx: number;
  type: 'barrier' | 'battery' | 'overcharge_core';
  collected: boolean;
}

interface FloatingScoreText {
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  maxTimer: number;
}

interface Hoverboarder {
  id: PlayerId;
  railIdx: number; // 0 (top) to 3 (bottom)
  x: number;
  vx: number;
  targetX: number;
  y: number;
  targetY: number;
  altitude: number; // jump height
  vAltitude: number;
  isJumping: boolean;
  jumpCharge: number;
  isSlamming: boolean;
  score: number;
  batteriesCollected: number;
  grindCombo: number;
  stunTimer: number;
  switchCooldown: number;
  lastThrottle: number;
  isUnderdog: boolean;
  gravShield: boolean;
  lastShovedBy: PlayerId | null;
  shoveTimer: number;
  currentMood: CharacterMood;
  animTime: number;
}

export class HoverboardRailGame extends BaseGame {
  public currentTheme: RailThemeId = 'aero_skyline';
  public playersState: Map<PlayerId, Hoverboarder> = new Map();

  private railYPositions: number[] = [];
  private obstacles: RailObstacle[] = [];
  private floatingTexts: FloatingScoreText[] = [];

  private scrollSpeed: number = 260;
  private spawnTimer: number = 0.4;
  private botReactionTimers: Map<PlayerId, number> = new Map();
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
          this.setTheme('aero_skyline');
        } else if (e.key === '2') {
          this.setTheme('cyber_subway');
        } else if (e.key === '3') {
          this.setTheme('solar_orbit');
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

  public cycleTheme(): void {
    const curIdx = THEME_ORDER.indexOf(this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_ORDER.length;
    this.setTheme(THEME_ORDER[nextIdx]);
  }

  public setTheme(theme: RailThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentColor, 16);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.playersState.clear();
    this.obstacles = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;

    // 4 evenly spaced magnetic skyline rails
    const startY = height * 0.32;
    const spacing = Math.min(80, (height * 0.52) / 3);
    this.railYPositions = [
      startY,
      startY + spacing,
      startY + spacing * 2,
      startY + spacing * 3
    ];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const rail = idx % this.railYPositions.length;
      // Stagger initial X positions so players don't overlap awkwardly
      const initialX = 140 + idx * 45;
      this.playersState.set(p.id, {
        id: p.id,
        railIdx: rail,
        x: initialX,
        vx: 0,
        targetX: initialX,
        y: this.railYPositions[rail],
        targetY: this.railYPositions[rail],
        altitude: 0,
        vAltitude: 0,
        isJumping: false,
        jumpCharge: 0,
        isSlamming: false,
        score: 0,
        batteriesCollected: 0,
        grindCombo: 0,
        stunTimer: 0,
        switchCooldown: 0,
        lastThrottle: 0,
        isUnderdog: false,
        gravShield: false,
        lastShovedBy: null,
        shoveTimer: 0,
        currentMood: 'focused',
        animTime: 0
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 14);
    }

    const isSuddenDeath = this.roundTimer <= 15.0;
    const currentScrollSpeed = this.scrollSpeed * (isSuddenDeath ? 1.3 : 1.0);

    // 1. Spawn obstacles & power-ups
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (isSuddenDeath ? 0.35 : 0.45) + Math.random() * 0.3;
      const railIdx = Math.floor(Math.random() * this.railYPositions.length);
      const roll = Math.random();
      let type: 'barrier' | 'battery' | 'overcharge_core' = 'battery';
      if (roll < 0.45) {
        type = 'barrier';
      } else if (roll < 0.88) {
        type = 'battery';
      } else {
        type = 'overcharge_core';
      }

      this.obstacles.push({
        x: width + 50,
        railIdx,
        type,
        collected: false
      });
    }

    // 2. Scroll obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= currentScrollSpeed * dt;
      if (obs.x < -60) {
        this.obstacles.splice(i, 1);
      }
    }

    // 3. Update Floating Score Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.timer -= dt;
      ft.y -= 25 * dt;
      if (ft.timer <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 4. Update Underdog Status
    this.updateUnderdogStatus();

    // 5. Update Bots
    this.updateBots(dt, width, height);

    // 6. Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const b = this.playersState.get(p.id);
      if (!b) continue;

      b.animTime += dt;

      if (b.stunTimer > 0) {
        b.stunTimer -= dt;
        b.currentMood = 'shocked';
        continue;
      }

      if (b.switchCooldown > 0) b.switchCooldown -= dt;
      if (b.shoveTimer > 0) {
        b.shoveTimer -= dt;
        if (b.shoveTimer <= 0) b.lastShovedBy = null;
      }

      // Discrete, snappy rail switching (Up/Down)
      const throttle = this.input.getThrottle(p.id);
      const isUpEdge = this.input.justUp(p.id) || (throttle > 0.4 && b.lastThrottle <= 0.4);
      const isDownEdge = this.input.justDown(p.id) || (throttle < -0.4 && b.lastThrottle >= -0.4);

      if (b.switchCooldown <= 0) {
        if (isUpEdge && b.railIdx > 0) {
          b.railIdx--;
          b.targetY = this.railYPositions[b.railIdx];
          b.switchCooldown = 0.18;
          this.audio.playTap();
          this.particles.spawnSparks(b.x, b.y, THEMES[this.currentTheme].accentColor, 8);
        } else if (isDownEdge && b.railIdx < this.railYPositions.length - 1) {
          b.railIdx++;
          b.targetY = this.railYPositions[b.railIdx];
          b.switchCooldown = 0.18;
          this.audio.playTap();
          this.particles.spawnSparks(b.x, b.y, THEMES[this.currentTheme].accentColor, 8);
        }
      }
      b.lastThrottle = throttle;

      // Horizontal Speed Adjustment (A/D or Steer left/right)
      const steer = this.input.getSteer(p.id);
      const targetSpeedOffset = steer * 160;
      b.vx += (targetSpeedOffset - b.vx) * 8 * dt;
      b.x += b.vx * dt;
      // Clamp X position to safe playable track range
      b.x = Math.max(100, Math.min(width - 220, b.x));

      // Jump Ollie & Hydraulic Rail Slam Mechanics
      const isCharging = this.input.isActionPressed(p.id);
      const justAction = this.input.justAction(p.id);
      const justReleased = !isCharging && b.jumpCharge > 0.05;

      if (!b.isJumping) {
        if (isCharging) {
          b.jumpCharge = Math.min(1.0, b.jumpCharge + dt * 2.8);
          this.particles.spawnSparks(b.x, b.y + 4, p.color, 1);
        }
        if (justReleased || justAction) {
          b.isJumping = true;
          b.isSlamming = false;
          const jumpPower = 320 + b.jumpCharge * 180;
          b.vAltitude = jumpPower;
          b.jumpCharge = 0;
          this.audio.playWhoosh();
          this.particles.spawnSparks(b.x, b.y, '#FFFFFF', 6);
        }
      } else {
        // Airborne: Can trigger Hydraulic Rail Slam!
        if ((justAction || (throttle < -0.4 && b.lastThrottle >= -0.4)) && !b.isSlamming) {
          b.isSlamming = true;
          b.vAltitude = -650; // High speed downward slam!
          this.audio.playWhoosh();
        }

        b.altitude += b.vAltitude * dt;
        b.vAltitude -= 880 * dt; // gravity

        if (b.altitude <= 0) {
          b.altitude = 0;
          b.vAltitude = 0;
          b.isJumping = false;

          // Check if landed from a Hydraulic Slam!
          if (b.isSlamming) {
            b.isSlamming = false;
            this.screenShake = 5.0;
            this.audio.playExplosion();
            this.particles.spawnSparks(b.x, b.y, THEMES[this.currentTheme].accentColor, 18);
            this.addFloatingText(b.x, b.y - 25, '💥 RAIL SLAM!', '#F59E0B');

            // Shockwave tailgate shunt rivals on the same rail nearby
            for (const other of active) {
              if (other.id === p.id) continue;
              const rival = this.playersState.get(other.id);
              if (rival && rival.railIdx === b.railIdx && Math.abs(rival.x - b.x) < 80) {
                rival.stunTimer = 0.45;
                rival.x -= 70;
                b.score += 40;
                this.addFloatingText(rival.x, rival.y - 25, 'SHOCKED!', '#EF4444');
              }
            }
          } else {
            this.particles.spawnSparks(b.x, b.y, THEMES[this.currentTheme].railColor, 4);
          }
        }
      }

      // Smooth vertical transition between rails
      b.y += (b.targetY - b.y) * 18 * dt;

      // Passive grind score & combo
      if (!b.isJumping) {
        b.grindCombo += dt * 3.5;
        b.score += dt * (14 + Math.min(30, b.grindCombo * 2));
        if (Math.random() < 0.3) {
          this.particles.emit(b.x - 14, b.y + 4, 1, THEMES[this.currentTheme].railGlow);
        }
      }

      // Mood update
      if (b.isJumping) b.currentMood = 'triumph';
      else if (b.isUnderdog) b.currentMood = 'focused';
      else b.currentMood = 'idle';

      // Obstacle collision check
      for (const obs of this.obstacles) {
        if (obs.railIdx !== b.railIdx || obs.collected) continue;

        const vacDist = b.gravShield ? 36 : 24;
        if (Math.abs(obs.x - b.x) < vacDist) {
          if (obs.type === 'battery') {
            obs.collected = true;
            b.batteriesCollected++;
            const pts = 30 * (isSuddenDeath ? 2 : 1);
            b.score += pts;
            this.audio.playScore();
            this.particles.spawnSparks(b.x, b.y, THEMES[this.currentTheme].batteryColor, 12);
            this.addFloatingText(b.x, b.y - 25, `+${pts}⚡`, THEMES[this.currentTheme].batteryColor);
          } else if (obs.type === 'overcharge_core') {
            obs.collected = true;
            b.batteriesCollected += 2;
            const pts = 65 * (isSuddenDeath ? 2 : 1);
            b.score += pts;
            this.audio.playScore();
            this.particles.spawnSparks(b.x, b.y, '#38BDF8', 16);
            this.addFloatingText(b.x, b.y - 25, `+${pts} OVERCHARGE!`, '#38BDF8');
          } else if (obs.type === 'barrier' && !b.isJumping) {
            // Hit electric laser barrier
            if (b.gravShield) {
              // Absorbed by Underdog Grav-Shield!
              b.gravShield = false;
              obs.collected = true;
              this.audio.playBounce();
              this.screenShake = 3.5;
              this.particles.spawnSparks(b.x, b.y, '#F59E0B', 16);
              this.addFloatingText(b.x, b.y - 25, '🛡️ GRAV-SHIELD ABSORBED!', '#F59E0B');
            } else {
              b.stunTimer = 0.85;
              b.score = Math.max(0, b.score - 30);
              b.grindCombo = 0;
              b.x = Math.max(100, b.x - 45);
              this.screenShake = 6.0;
              this.hitStopTimer = 0.045;
              this.audio.playExplosion();
              this.particles.emit(b.x, b.y, 14, '#EF4444');
              this.addFloatingText(b.x, b.y - 25, 'CRASH! -30', '#EF4444');

              // If shoved into barrier by rival, credit rival!
              if (b.lastShovedBy !== null) {
                const rival = this.playersState.get(b.lastShovedBy);
                if (rival) {
                  rival.score += 45;
                  this.addFloatingText(rival.x, rival.y - 25, 'RAIL SABOTAGE! +45', '#10B981');
                }
              }
            }
          }
        }
      }
    }

    // 7. Inter-Player Physical Shoving & Collisions on same rail (m1*v1 + m2*v2)
    for (let i = 0; i < active.length; i++) {
      const b1 = this.playersState.get(active[i].id);
      if (!b1 || b1.stunTimer > 0) continue;

      for (let j = i + 1; j < active.length; j++) {
        const b2 = this.playersState.get(active[j].id);
        if (!b2 || b2.stunTimer > 0) continue;

        // If on same rail and touching horizontally
        if (b1.railIdx === b2.railIdx && !b1.isJumping && !b2.isJumping) {
          const dx = b2.x - b1.x;
          if (Math.abs(dx) < 38) {
            const shoveDir = dx > 0 ? 1 : -1;
            const overlap = 38 - Math.abs(dx);

            b1.x -= shoveDir * overlap * 0.5;
            b2.x += shoveDir * overlap * 0.5;

            // Elastic shove
            b1.vx -= shoveDir * 120 * (b2.isUnderdog ? 1.4 : 1.0);
            b2.vx += shoveDir * 120 * (b1.isUnderdog ? 1.4 : 1.0);

            b1.lastShovedBy = b2.id;
            b1.shoveTimer = 1.5;
            b2.lastShovedBy = b1.id;
            b2.shoveTimer = 1.5;

            this.audio.playBounce();
            this.particles.spawnSparks((b1.x + b2.x) / 2, b1.y, '#F59E0B', 8);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private updateUnderdogStatus(): void {
    const active = this.getActivePlayers();
    if (active.length < 2) return;

    let maxScore = -1;
    let minScore = Infinity;
    for (const p of active) {
      const b = this.playersState.get(p.id);
      if (!b) continue;
      if (b.score > maxScore) maxScore = b.score;
      if (b.score < minScore) minScore = b.score;
    }

    for (const p of active) {
      const b = this.playersState.get(p.id);
      if (!b) continue;
      if (maxScore - b.score >= 50) {
        if (!b.isUnderdog) {
          b.isUnderdog = true;
          b.gravShield = true;
        }
      } else {
        b.isUnderdog = false;
      }
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      timer: 1.1,
      maxTimer: 1.1
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const b = this.playersState.get(botId);
    if (!b || b.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction Delays:
    // Easy: 380-450ms, blunders, jumps late
    // Normal: 220-250ms, switches rails cleanly
    // Hard: 90-130ms, predictive timing, aggressive rail slams on rivals
    let delay = 0.24;
    let blunderChance = 0.0;
    if (difficulty === 'bot_easy') {
      delay = 0.40 + Math.random() * 0.08;
      blunderChance = 0.18;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11 + Math.random() * 0.04;
      blunderChance = 0.0;
    } else {
      delay = 0.23 + Math.random() * 0.05;
      blunderChance = 0.06;
    }
    this.botReactionTimers.set(botId, delay);

    // Obstacles ahead on bot's current rail
    const ahead = this.obstacles.filter(
      o => o.railIdx === b.railIdx && !o.collected && o.x > b.x && o.x < b.x + 200
    );

    let jump = false;
    let throttle = 0;
    let steer = 0;

    if (ahead.length > 0) {
      const obstacle = ahead[0];
      if (obstacle.type === 'barrier') {
        const dist = obstacle.x - b.x;
        if (dist < 90 && Math.random() > blunderChance) {
          // Jump over barrier!
          jump = true;
        } else if (difficulty !== 'bot_easy' && dist > 80) {
          // Switch to adjacent clear rail
          throttle = b.railIdx === 0 ? -1 : 1;
        }
      } else {
        // Battery ahead! Speed up slightly to grab it
        steer = 0.6;
      }
    } else {
      // Seek batteries on adjacent rails
      const batteries = this.obstacles.filter(
        o => (o.type === 'battery' || o.type === 'overcharge_core') && !o.collected && o.x > b.x && o.x < b.x + 240
      );
      if (batteries.length > 0 && difficulty !== 'bot_easy') {
        const target = batteries[0];
        if (target.railIdx > b.railIdx) throttle = -1; // down
        else if (target.railIdx < b.railIdx) throttle = 1; // up
      }

      // Hard bots: Rail slam rivals below them!
      if (difficulty === 'bot_hard' && b.isJumping) {
        for (const p of this.getActivePlayers()) {
          if (p.id !== botId) {
            const rival = this.playersState.get(p.id);
            if (rival && rival.railIdx === b.railIdx && Math.abs(rival.x - b.x) < 60) {
              jump = true; // executes Hydraulic Rail Slam!
            }
          }
        }
      }
    }

    this.input.setBotInput(botId, jump, steer, throttle, jump);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const b = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: Math.floor(b?.score || 0),
        batteries: b?.batteriesCollected || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topScore = scores[0]?.score || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} conquered the Magnetic Skyline with ${scores[0].batteries} power cells (${topScore} pts)!`
      : 'The magnetic rails powered down!';

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
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Atmosphere Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant Neon Skyline Silhouettes
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    for (let x = 0; x < width; x += 70) {
      const bh = 140 + ((x * 19) % 110);
      ctx.fillRect(x, height - bh, 60, bh);
      // Window lights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let wy = height - bh + 16; wy < height - 20; wy += 22) {
        ctx.fillRect(x + 10, wy, 8, 12);
        ctx.fillRect(x + 28, wy, 8, 12);
        ctx.fillRect(x + 44, wy, 8, 12);
      }
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    }

    // 2. Render 4 Magnetic Skyline Rails
    const railLabels = ['LINE 1 (TOP)', 'LINE 2', 'LINE 3', 'LINE 4 (BOT)'];
    this.railYPositions.forEach((ry, idx) => {
      // Structural beam
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(width, ry);
      ctx.stroke();

      // Glowing laser magnetic rail
      ctx.strokeStyle = theme.railColor;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = theme.railGlow;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(width, ry);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Pulsing energy node along the rail
      const pulseX = ((this.animTimer * 220 + idx * 210) % (width + 100)) - 50;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pulseX, ry, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Line label badge on left margin
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(8, ry - 11, 80, 22);
      ctx.strokeStyle = theme.accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(8, ry - 11, 80, 22);

      ctx.fillStyle = theme.accentColor;
      ctx.font = 'bold 9px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(railLabels[idx], 48, ry);
      ctx.restore();
    });

    // 3. Render Obstacles
    for (const obs of this.obstacles) {
      if (obs.collected) continue;
      const oy = this.railYPositions[obs.railIdx];

      if (obs.type === 'barrier') {
        // Red holographic electric laser barricade
        ctx.save();
        ctx.fillStyle = theme.barrierColor;
        ctx.fillRect(obs.x - 10, oy - 30, 20, 30);
        ctx.strokeStyle = '#FCA5A5';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x - 10, oy - 30, 20, 30);

        // Warning Hazard Stripes
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x - 6, oy - 24);
        ctx.lineTo(obs.x + 6, oy - 12);
        ctx.stroke();

        ctx.shadowColor = theme.barrierColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FEE2E2';
        ctx.beginPath();
        ctx.arc(obs.x, oy - 30, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (obs.type === 'overcharge_core') {
        // Glowing cyan/blue overcharge core
        ctx.save();
        const spin = this.animTimer * 5;
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(obs.x, oy - 14, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(obs.x, oy - 14, 13, 5, spin, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.font = '900 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', obs.x, oy - 14);
        ctx.restore();
      } else {
        // Golden Battery Cell
        ctx.save();
        const spin = this.animTimer * 4;
        ctx.shadowColor = theme.batteryColor;
        ctx.shadowBlur = 12;
        ctx.fillStyle = theme.batteryColor;
        ctx.beginPath();
        ctx.arc(obs.x, oy - 12, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(obs.x, oy - 12, 12, 4, spin, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#78350F';
        ctx.font = '900 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', obs.x, oy - 12);
        ctx.restore();
      }
    }

    // 4. Render Hoverboarders
    for (const p of this.getActivePlayers()) {
      const b = this.playersState.get(p.id);
      if (!b) continue;
      this.renderBoarder(ctx, b, p, theme);
    }

    // 5. Floating texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      const alpha = Math.min(1.0, ft.timer / (ft.maxTimer * 0.4));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 12px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore(); // Restore screenshake

    // 6. Safe UI & Theme Pill (Strictly preserving y: 12-44 for Global Timer)
    this.renderSafeUI(ctx, width, height);
  }

  private renderBoarder(ctx: CanvasRenderingContext2D, b: Hoverboarder, p: PlayerConfig, theme: RailTheme): void {
    const py = b.y - b.altitude;
    const tilt = b.isJumping ? (b.isSlamming ? 0.35 : -0.22) : 0;

    ctx.save();
    ctx.translate(b.x, py);
    ctx.rotate(tilt);

    if (b.stunTimer > 0 && Math.floor(b.stunTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Underdog Grav-Shield Aura
    if (b.gravShield) {
      ctx.save();
      const pulse = (Math.sin(this.animTimer * 8) + 1) * 0.5;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, -14, 22 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Thruster Plumes
    const thrusterPulse = Math.sin(this.animTimer * 16) * 2;
    ctx.fillStyle = theme.accentColor;
    ctx.shadowColor = theme.accentColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(-14, 5, 5 + thrusterPulse, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(14, 5, 5 + thrusterPulse, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Aerodynamic Hoverboard Deck
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(-22, -3, 44, 7, 3);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rider Mascot using CharacterRenderer
    ctx.save();
    ctx.translate(0, -18);
    drawCharacter(
      ctx,
      0,
      0,
      13,
      p.id,
      p.type !== 'human',
      b.currentMood,
      b.animTime,
      undefined
    );
    ctx.restore();

    ctx.restore(); // Restore boarder transform

    // Above-character HUD badge
    ctx.save();
    ctx.translate(b.x, py);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-28, -44, 56, 16, 4);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`L${b.railIdx + 1} • ${Math.floor(b.score)}`, 0, -36);
    ctx.restore();
  }

  private renderSafeUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Minigame Header Badge at y: 56 (Strictly leaving y: 12-44 clear for Global Timer!)
    const isSuddenDeath = this.roundTimer <= 15.0;
    const badgeW = 280;
    const badgeH = 28;
    const badgeX = (width - badgeW) * 0.5;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#00E5FF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? '🔥 OVERCHARGE SURGE! 2X POINTS & SPEED'
      : 'UP/DOWN: SWITCH RAILS • HOLD: JUMP • TAP AIR: SLAM';
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Status Cards (Offset to y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const b = this.playersState.get(p.id);
      let cardX = 20;
      let cardY = height - 128;

      if (idx === 0) {
        cardX = 20;
        cardY = height - 128;
      } else if (idx === 1) {
        cardX = width - 150;
        cardY = height - 128;
      } else if (idx === 2) {
        cardX = 20;
        cardY = 92;
      } else {
        cardX = width - 150;
        cardY = 92;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 52, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mini Mascot Icon
      ctx.save();
      ctx.translate(cardX + 22, cardY + 26);
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        p.type !== 'human',
        b?.currentMood || 'idle',
        0,
        undefined
      );
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`P${p.id + 1} (${p.type === 'human' ? 'YOU' : 'BOT'})`, cardX + 42, cardY + 7);

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px "Chakra Petch", monospace';
      ctx.fillText(`${Math.floor(b?.score || 0)} pts`, cardX + 42, cardY + 23);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "Chakra Petch", monospace';
      ctx.fillText(`⚡ ${b?.batteriesCollected || 0} cells`, cardX + 42, cardY + 38);
    });

    // 3. Interactive Theme Pill at bottom-left (x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;
    const theme = THEMES[this.currentTheme];

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px "Chakra Petch", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name.slice(0, 13)}`, pillX + 12, pillY + pillH * 0.5);

    ctx.fillStyle = theme.accentColor;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + pillH * 0.5);

    // 4. Control Hints (bottom-right)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px "Chakra Petch", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('W/S: CHANGE RAIL • A/D: SPEED • SPACE: OLLIE / SLAM', width - 20, height - 14);

    ctx.restore();
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    if (this.isFinished) return false;
    const p1 = this.playersState.get(0);
    if (!p1 || p1.stunTimer > 0) return false;

    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.cycleTheme();
      return true;
    }

    if (x > width * 0.7) {
      if (!p1.isJumping) {
        p1.isJumping = true;
        p1.vAltitude = 360;
        this.audio.playWhoosh();
      } else if (!p1.isSlamming) {
        p1.isSlamming = true;
        p1.vAltitude = -650;
        this.audio.playWhoosh();
      }
      return true;
    }

    if (y < height * 0.5 && p1.railIdx > 0 && p1.switchCooldown <= 0) {
      p1.railIdx--;
      p1.targetY = this.railYPositions[p1.railIdx];
      p1.switchCooldown = 0.18;
      this.audio.playTap();
      return true;
    } else if (y >= height * 0.5 && p1.railIdx < this.railYPositions.length - 1 && p1.switchCooldown <= 0) {
      p1.railIdx++;
      p1.targetY = this.railYPositions[p1.railIdx];
      p1.switchCooldown = 0.18;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  public syncDebug(): void {
    // Debug inspection helper
  }

  public destroy(): void {
    super.destroy();
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      if (this.clickHandler) {
        window.removeEventListener('click', this.clickHandler);
      }
    }
  }
}
