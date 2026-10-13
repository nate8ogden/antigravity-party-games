import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type JellyThemeId = 'biolum_trench' | 'cyber_atlantis' | 'magma_vent';

interface JellyTheme {
  id: JellyThemeId;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  jellyColor: string;
  goldJellyColor: string;
  zapColor: string;
  accentGlow: string;
  bubbleColor: string;
}

const THEMES: Record<JellyThemeId, JellyTheme> = {
  biolum_trench: {
    id: 'biolum_trench',
    name: 'Mariana Bioluminescent Trench',
    icon: '🌊',
    bgTop: '#000B18',
    bgBottom: '#002B49',
    jellyColor: '#00E5FF',
    goldJellyColor: '#FFD700',
    zapColor: '#FFEA00',
    accentGlow: '#00E5FF',
    bubbleColor: '#80D8FF'
  },
  cyber_atlantis: {
    id: 'cyber_atlantis',
    name: 'Cyber Neon Atlantis',
    icon: '⚡',
    bgTop: '#090D16',
    bgBottom: '#030712',
    jellyColor: '#A855F7',
    goldJellyColor: '#38BDF8',
    zapColor: '#F43F5E',
    accentGlow: '#A855F7',
    bubbleColor: '#C084FC'
  },
  magma_vent: {
    id: 'magma_vent',
    name: 'Molten Hydrothermal Vents',
    icon: '🔥',
    bgTop: '#1C0606',
    bgBottom: '#3F0D0D',
    jellyColor: '#F97316',
    goldJellyColor: '#FDE047',
    zapColor: '#EF4444',
    accentGlow: '#F97316',
    bubbleColor: '#FCA5A5'
  }
};

const THEME_ORDER: JellyThemeId[] = ['biolum_trench', 'cyber_atlantis', 'magma_vent'];

type JellyType = 'standard' | 'golden' | 'electric';

interface Jellyfish {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: JellyType;
  vy: number;
  oscillationPhase: number;
  oscillationSpeed: number;
  isZapping: boolean;
  zapTimer: number;
  color: string;
}

interface SeaUrchin {
  id: number;
  x: number;
  y: number;
  vx: number;
  radius: number;
  rot: number;
}

interface JumperDiver {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  highestAltitude: number;
  score: number;
  combo: number;
  chargeTime: number; // 0 to 1
  isCharging: boolean;
  stunTimer: number;
  headBops: number;
  bounceAnim: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class JellyfishJumpGame extends BaseGame {
  public divers: Map<PlayerId, JumperDiver> = new Map();
  public jellies: Jellyfish[] = [];
  public urchins: SeaUrchin[] = [];
  public currentTheme: JellyThemeId = 'biolum_trench';

  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private jellyIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private cameraY: number = 0;
  private targetCameraY: number = 0;
  private lastHeight: number = 600;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;

    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.cycleTheme();
        } else if (e.key === '1') {
          this.setTheme('biolum_trench');
        } else if (e.key === '2') {
          this.setTheme('cyber_atlantis');
        } else if (e.key === '3') {
          this.setTheme('magma_vent');
        }
      };
      window.addEventListener('keydown', this.keydownHandler);
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_ORDER.indexOf(this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_ORDER.length;
    this.setTheme(THEME_ORDER[nextIdx]);
  }

  public setTheme(theme: JellyThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentGlow, 16);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.divers.clear();
    this.jellies = [];
    this.urchins = [];
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.botReactionTimers.clear();
    this.lastHeight = height;

    const theme = THEMES[this.currentTheme];

    // Generate ascending column of floating jellyfish platforms
    for (let y = height * 0.72; y > -height * 5; y -= 68 + Math.random() * 24) {
      const roll = Math.random();
      let type: JellyType = 'standard';
      let col = theme.jellyColor;
      let rad = 26 + Math.random() * 10;

      if (roll < 0.15) {
        type = 'golden';
        col = theme.goldJellyColor;
        rad = 32;
      } else if (roll < 0.40) {
        type = 'electric';
        col = theme.zapColor;
      }

      this.jellies.push({
        id: ++this.jellyIdCounter,
        x: width * 0.12 + Math.random() * (width * 0.76),
        y,
        radius: rad,
        type,
        vy: -14 - Math.random() * 18,
        oscillationPhase: Math.random() * Math.PI * 2,
        oscillationSpeed: 2 + Math.random() * 2,
        isZapping: false,
        zapTimer: Math.random() * 2,
        color: col
      });

      // Occasional drifting sea urchin hazard
      if (Math.random() < 0.22 && y < height * 0.4) {
        this.urchins.push({
          id: this.urchins.length,
          x: Math.random() * width,
          y: y + 34,
          vx: (Math.random() - 0.5) * 60,
          radius: 14,
          rot: Math.random() * Math.PI * 2
        });
      }
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = width * 0.25 + (idx / Math.max(1, active.length - 1)) * (width * 0.5);
      this.divers.set(p.id, {
        id: p.id,
        x: startX,
        y: height * 0.78,
        vx: 0,
        vy: -420, // Initial launch spring
        highestAltitude: 0,
        score: 0,
        combo: 0,
        chargeTime: 0,
        isCharging: false,
        stunTimer: 0,
        headBops: 0,
        bounceAnim: 0,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 2.0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.lastHeight = height;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    const isSuddenDeath = this.roundTimer <= 15.0;

    // Check underdog
    let maxScore = 0;
    let minScore = Infinity;
    this.divers.forEach((d) => {
      if (d.score > maxScore) maxScore = d.score;
      if (d.score < minScore) minScore = d.score;
    });
    this.divers.forEach((d) => {
      d.isUnderdog = maxScore - d.score >= 200 && maxScore > 0;
    });

    this.updateBots(dt, width, height);

    // Update floating jellyfish
    for (const j of this.jellies) {
      j.oscillationPhase += dt * j.oscillationSpeed;
      j.x += Math.sin(j.oscillationPhase) * dt * 28;
      j.y += j.vy * dt;

      // Electric jelly zap oscillation
      if (j.type === 'electric') {
        j.zapTimer += dt;
        if (j.zapTimer > 2.2) {
          j.zapTimer = 0;
          j.isZapping = !j.isZapping;
        }
      }
    }

    // Update sea urchins
    for (const u of this.urchins) {
      u.x += u.vx * dt;
      u.rot += dt * 3;
      if (u.x < 20) { u.x = 20; u.vx = Math.abs(u.vx); }
      else if (u.x > width - 20) { u.x = width - 20; u.vx = -Math.abs(u.vx); }
    }

    const active = this.getActivePlayers();

    // Update diver movement & collisions
    for (const p of active) {
      const d = this.divers.get(p.id);
      if (!d) continue;

      if (d.stunTimer > 0) {
        d.stunTimer -= dt;
      }
      if (d.bounceAnim > 0) {
        d.bounceAnim -= dt * 4;
      }
      if (d.moodTimer > 0) {
        d.moodTimer -= dt;
        if (d.moodTimer <= 0) d.currentMood = 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Hold-to-Charge Hydro-Rocket Dash / Ground Stomp
      if (isAction && d.stunTimer <= 0) {
        d.isCharging = true;
        d.chargeTime = Math.min(1.0, d.chargeTime + dt * 2.2);

        if (d.chargeTime >= 0.7 && Math.random() < 0.25) {
          this.particles.spawnSparks(d.x, d.y, '#38BDF8', 1);
        }
      } else if (d.isCharging || justReleased) {
        const isRocket = d.chargeTime >= 0.7;
        d.isCharging = false;
        d.chargeTime = 0;

        if (isRocket && d.stunTimer <= 0) {
          this.audio.playExplosion();
          this.particles.shake(5);
          this.particles.spawnSparks(d.x, d.y + 12, '#38BDF8', 18);

          // Rocket upward thrust + directional boost
          d.vy = -680;
          if (Math.abs(steer) > 0.2) {
            d.vx = steer * 420;
          }
        }
      }

      // Air steering
      const airControl = d.isUnderdog ? 290 : 230;
      if (d.stunTimer <= 0) {
        if (Math.abs(steer) > 0.15) {
          d.vx = steer * airControl;
        } else {
          d.vx *= 0.94;
        }
      } else {
        d.vx *= 0.90;
      }

      // Gravity
      d.vy += 620 * dt;

      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // Screen horizontal wrap
      if (d.x < 15) d.x = width - 15;
      else if (d.x > width - 15) d.x = 15;

      // Urchin hazard collision
      for (const u of this.urchins) {
        const dist = Math.hypot(u.x - d.x, u.y - d.y);
        if (dist < u.radius + 14 && d.stunTimer <= 0) {
          d.stunTimer = 0.8;
          d.vy = 220;
          d.vx = (d.x < u.x ? -1 : 1) * 260;
          d.currentMood = 'shocked';
          d.moodTimer = 1.6;

          this.audio.playExplosion();
          this.particles.shake(6);
          this.particles.spawnSparks(d.x, d.y, '#EF4444', 16);
        }
      }

      // Jellyfish bounce check (when descending)
      if (d.vy > 0 && d.stunTimer <= 0) {
        for (const j of this.jellies) {
          const dx = d.x - j.x;
          const dy = d.y - j.y;

          // Landed near bell cap
          if (Math.abs(dx) < j.radius * 1.05 && dy > -10 && dy < 18) {
            if (j.type === 'electric' && j.isZapping && !d.isUnderdog) {
              // Zapped by electric jelly!
              d.stunTimer = 0.9;
              d.vy = 240;
              d.currentMood = 'shocked';
              d.moodTimer = 1.8;

              this.audio.playExplosion();
              this.particles.shake(6);
              this.particles.spawnSparks(d.x, d.y, '#FFEA00', 20);
            } else {
              // Super bounce!
              const isGold = j.type === 'golden';
              const bouncePower = isGold ? -720 : -520;
              const speedMult = isSuddenDeath ? 1.25 : 1.0;
              d.vy = bouncePower * speedMult;
              d.bounceAnim = 1.0;
              d.combo++;

              const pts = isGold ? 150 : 50;
              const mult = Math.min(4, 1 + Math.floor(d.combo / 3));
              d.score += pts * mult * (isSuddenDeath ? 2 : 1);
              d.currentMood = 'happy';
              d.moodTimer = 1.2;

              if (isGold) {
                this.audio.playFanfare();
                this.particles.shake(5);
                this.particles.spawnExplosion(j.x, j.y, '#FFD700', 24);
              } else {
                this.audio.playBounce();
                this.particles.spawnSparks(j.x, j.y, j.color, 12);
              }

              // Update highest altitude
              const currentAlt = Math.max(0, Math.floor((height * 0.88 - d.y) / 8));
              if (currentAlt > d.highestAltitude) {
                d.highestAltitude = currentAlt;
              }
            }
            break;
          }
        }
      }

      // Abyss floor / Geyser safety check
      const abyssLimitY = height * 0.92 - this.cameraY;
      if (d.y > abyssLimitY) {
        // Rescued by Abyssal Geyser!
        d.y = abyssLimitY - 10;
        d.vy = -560; // Geyser blast!
        d.score = Math.max(0, d.score - 40);
        d.combo = 0;
        d.currentMood = 'shocked';
        d.moodTimer = 1.5;

        this.audio.playBounce();
        this.particles.shake(4);
        this.particles.spawnSparks(d.x, d.y, '#38BDF8', 20);
      }
    }

    // Inter-player Head-Bopping & Shoving!
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const d1 = this.divers.get(active[i].id);
        const d2 = this.divers.get(active[j].id);
        if (!d1 || !d2) continue;

        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 32) {
          // Check vertical head-bop
          if (d1.vy > 0 && d1.y < d2.y - 12) {
            // Diver 1 bopped Diver 2's head!
            d1.vy = -620; // Super rocket bounce!
            d2.vy = 260; // Dunked downward!
            d1.headBops++;
            d1.score += 150;
            d1.currentMood = 'triumph';
            d1.moodTimer = 1.8;
            d2.currentMood = 'shocked';
            d2.moodTimer = 1.6;

            this.audio.playScore();
            this.particles.shake(5);
            this.particles.spawnExplosion(d1.x, d2.y - 14, '#F59E0B', 18);
          } else if (d2.vy > 0 && d2.y < d1.y - 12) {
            // Diver 2 bopped Diver 1's head!
            d2.vy = -620;
            d1.vy = 260;
            d2.headBops++;
            d2.score += 150;
            d2.currentMood = 'triumph';
            d2.moodTimer = 1.8;
            d1.currentMood = 'shocked';
            d1.moodTimer = 1.6;

            this.audio.playScore();
            this.particles.shake(5);
            this.particles.spawnExplosion(d2.x, d1.y - 14, '#F59E0B', 18);
          } else {
            // Mid-air elastic body bump
            const nx = dx / (dist || 1);
            d1.vx = -nx * 200;
            d2.vx = nx * 200;

            this.audio.playBounce();
            this.particles.spawnSparks((d1.x + d2.x) * 0.5, (d1.y + d2.y) * 0.5, '#F59E0B', 8);
          }
        }
      }
    }

    // Camera smoothly tracks highest diver
    let highestY = height * 0.80;
    for (const d of this.divers.values()) {
      if (d.y < highestY) highestY = d.y;
    }
    this.targetCameraY = Math.max(0, height * 0.52 - highestY);
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1.0, dt * 4.5);

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
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

    const d = this.divers.get(botId);
    if (!d || d.stunTimer > 0) return;

    // Look for target jellyfish beneath or near diver
    const candidateJellies = this.jellies
      .filter((j) => {
        const dy = j.y - d.y;
        if (dy < 0 || dy > 280) return false;
        if (j.type === 'electric' && j.isZapping && difficulty !== 'bot_easy') return false;
        return true;
      })
      .sort((a, b) => {
        if (difficulty === 'bot_hard') {
          // Hard prioritizes golden jellies
          if (a.type === 'golden' && b.type !== 'golden') return -1;
          if (b.type === 'golden' && a.type !== 'golden') return 1;
        }
        return (a.y - d.y) - (b.y - d.y);
      });

    let targetX = d.x;
    let action = false;

    if (candidateJellies.length > 0) {
      const best = candidateJellies[0];
      targetX = best.x;

      if (difficulty === 'bot_hard' && best.type === 'golden' && Math.abs(best.x - d.x) < 40) {
        action = true; // Hydro-rocket dash into golden jelly
      }
    }

    // Check head-bop opportunity on hard
    if (difficulty === 'bot_hard' && d.vy > 0) {
      for (const [otherId, otherD] of this.divers.entries()) {
        if (otherId === botId) continue;
        if (otherD.y > d.y && otherD.y < d.y + 120 && Math.abs(otherD.x - d.x) < 30) {
          targetX = otherD.x; // Aim to boop opponent's head!
          break;
        }
      }
    }

    const dx = targetX - d.x;
    let steer = 0;
    if (Math.abs(dx) > 10) {
      steer = Math.sign(dx);
    }

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      steer = -steer; // Blunder on easy
    }

    this.input.setBotInput(botId, action, steer, 0, action);

    const interval =
      difficulty === 'bot_easy'
        ? 0.38 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.18 + Math.random() * 0.10
        : 0.08 + Math.random() * 0.05;
    this.botReactionTimers.set(botId, interval);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const d = this.divers.get(p.id);
      return {
        playerId: p.id,
        score: d ? d.score : 0,
        bops: d ? d.headBops : 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topBops = scores[0]?.bops || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} ascended the oceanic abyss with ${topBops} mascot head-bops!`
      : 'All divers were claimed by the abyssal gloom!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastHeight = height;
    const theme = THEMES[this.currentTheme];

    // 1. Oceanic Trench Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, theme.bgTop);
    grad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(0, this.cameraY);

    // 2. Render Sea Urchins
    for (const u of this.urchins) {
      if (u.y + this.cameraY < -50 || u.y + this.cameraY > height + 50) continue;

      ctx.save();
      ctx.translate(u.x, u.y);
      ctx.rotate(u.rot);

      ctx.fillStyle = '#1E1B4B';
      ctx.beginPath();
      ctx.arc(0, 0, u.radius, 0, Math.PI * 2);
      ctx.fill();

      // Spikes
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * u.radius, Math.sin(a) * u.radius);
        ctx.lineTo(Math.cos(a) * (u.radius + 8), Math.sin(a) * (u.radius + 8));
        ctx.stroke();
      }

      ctx.restore();
    }

    // 3. Render Jellyfish
    for (const j of this.jellies) {
      if (j.y + this.cameraY < -60 || j.y + this.cameraY > height + 60) continue;

      ctx.save();
      ctx.translate(j.x, j.y);

      // Bioluminescent bell dome
      ctx.fillStyle = j.color;
      ctx.beginPath();
      ctx.arc(0, 0, j.radius, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      // Glowing inner rim
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Electric spark arcs if zapping
      if (j.type === 'electric' && j.isZapping) {
        ctx.strokeStyle = '#FFEA00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, j.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Golden sparkle ring
      if (j.type === 'golden') {
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, j.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Animated tentacles
      ctx.strokeStyle = j.color;
      ctx.lineWidth = 1.8;
      for (let t = -j.radius * 0.7; t <= j.radius * 0.7; t += 7) {
        ctx.beginPath();
        ctx.moveTo(t, 0);
        const wave = Math.sin(j.oscillationPhase + t) * 6;
        ctx.quadraticCurveTo(t + wave, 14, t, 28);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 4. Render Divers
    for (const [id, d] of this.divers.entries()) {
      const p = this.players.find((pl) => pl.id === id);
      const isBot = p ? p.type !== 'human' : false;

      ctx.save();
      ctx.translate(d.x, d.y);

      // Diver Mascot
      drawCharacter(
        ctx,
        0,
        0,
        15,
        id,
        isBot,
        d.currentMood,
        d.chargeTime * 4,
        undefined
      );

      // Scuba Oxygen Tank on back
      ctx.fillStyle = '#78909C';
      ctx.fillRect(-18, -8, 6, 16);

      // Hydro-Rocket Thruster Aura
      if (d.chargeTime > 0) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2 + d.chargeTime * 3;
        ctx.beginPath();
        ctx.arc(0, 0, 18 + d.chargeTime * 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Status labels
      if (d.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ ZAPPED!', 0, -28);
      } else if (d.isUnderdog) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑 SURGE', 0, -28);
      } else if (d.combo > 1) {
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 11px "Chakra Petch", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${d.combo}x COMBO`, 0, -28);
      }

      ctx.restore();
    }

    ctx.restore();

    // 5. Safe UI & Theme Pill
    this.renderSafeUI(ctx, width, height);
  }

  private renderSafeUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Minigame Header Badge at y: 56 (PRESERVING GLOBAL TIMER AT y: 12-44!)
    const isSuddenDeath = this.roundTimer <= 15.0;
    const badgeW = 270;
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
      ? '🔥 TRENCH BLOOM! 2X SCORE & GOLDEN JELLIES'
      : 'BOUNCE ON JELLY BELLS • BOP HEADS TO ROCKET';
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Cards (Offset to y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const d = this.divers.get(p.id);
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
      ctx.roundRect(cardX, cardY, 130, 48, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mini Mascot Icon
      ctx.save();
      ctx.translate(cardX + 22, cardY + 24);
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        p.type !== 'human',
        d?.currentMood || 'idle',
        0,
        undefined
      );
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`P${p.id + 1} (${p.type === 'human' ? 'YOU' : 'BOT'})`, cardX + 44, cardY + 8);

      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px "Chakra Petch", monospace';
      ctx.fillText(`${d?.score || 0} pts`, cardX + 44, cardY + 26);
    });

    // 3. Theme Pill at bottom-left (x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;
    const theme = THEMES[this.currentTheme];

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accentGlow;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name.substring(0, 14)} [T]`, pillX + pillW * 0.5, pillY + pillH * 0.5);

    // 4. Control Hints
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Hold [Space/Action]: Hydro-Rocket | [A/D]: Steer', width - 20, height - 14);

    ctx.restore();
  }

  public handleClick(x: number, y: number): boolean {
    const pillX = 20;
    const pillY = (this.lastHeight || 600) - 44;
    const pillW = 170;
    const pillH = 32;

    if (x >= pillX && x <= pillX + pillW && y >= pillY && y <= pillY + pillH) {
      this.cycleTheme();
      return true;
    }
    return false;
  }

  public syncDebug(): Record<string, any> {
    return {
      theme: this.currentTheme,
      jelliesCount: this.jellies.length,
      urchinsCount: this.urchins.length,
      roundTimer: this.roundTimer,
      divers: Array.from(this.divers.values()).map((d) => ({
        id: d.id,
        score: d.score,
        combo: d.combo,
        bops: d.headBops,
        isUnderdog: d.isUnderdog,
        y: Math.round(d.y)
      }))
    };
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    this.jellies = [];
    this.urchins = [];
    this.divers.clear();
  }
}
