import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface PearlType {
  name: string;
  color: string;
  points: number;
  radius: number;
  isGolden?: boolean;
  isHazard?: boolean;
}

const PEARL_TEMPLATES: PearlType[] = [
  { name: 'White Pearl', color: '#FFFFFF', points: 15, radius: 9 },
  { name: 'Pink Pearl', color: '#F48FB1', points: 20, radius: 10 },
  { name: 'Black Tahitian', color: '#37474F', points: 25, radius: 10 },
  { name: 'Imperial Golden', color: '#FFD700', points: 45, radius: 13, isGolden: true },
  { name: 'Spiny Urchin', color: '#880E4F', points: -15, radius: 9, isHazard: true }
];

interface GiantClam {
  id: number;
  x: number;
  y: number;
  radius: number;
  state: 'closed' | 'opening' | 'open' | 'snapping';
  timer: number;
  pearl: PearlType | null;
  hasPearl: boolean;
}

interface FloatingLoosePearl {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pearl: PearlType;
  life: number;
}

interface DiverPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  chargeTime: number;
  isCharging: boolean;
  shuntActiveTimer: number;
  shuntDirX: number;
  shuntDirY: number;
  shuntCooldown: number;
  stunTimer: number;
  score: number;
  pearlsCollected: number;
  combo: number;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface ReefTheme {
  id: string;
  name: string;
  icon: string;
  waterTop: string;
  waterBottom: string;
  sandColor: string;
  sandTrim: string;
  coralColor: string;
  accentColor: string;
}

const THEMES: ReefTheme[] = [
  {
    id: 'barrier_reef',
    name: 'Great Barrier Reef 🪸',
    icon: '🪸',
    waterTop: '#00695C',
    waterBottom: '#004D40',
    sandColor: '#FFE082',
    sandTrim: '#FFB74D',
    coralColor: '#FF7043',
    accentColor: '#38BDF8'
  },
  {
    id: 'bioluminescent_grotto',
    name: 'Bioluminescent Grotto ⚡',
    icon: '⚡',
    waterTop: '#0A081D',
    waterBottom: '#020108',
    sandColor: '#171B30',
    sandTrim: '#00E5FF',
    coralColor: '#E040FB',
    accentColor: '#00E5FF'
  },
  {
    id: 'pirate_lagoon',
    name: 'Sunken Pirate Lagoon 🏴‍☠️',
    icon: '🏴‍☠️',
    waterTop: '#004D40',
    waterBottom: '#00251A',
    sandColor: '#D7CCC8',
    sandTrim: '#8D6E63',
    coralColor: '#FFD54F',
    accentColor: '#FFB300'
  }
];

export class PearlDiversGame extends BaseGame {
  public currentMapName: string = 'Great Barrier Reef 🪸';
  private currentThemeIdx: number = 0;

  private divers: Map<PlayerId, DiverPlayer> = new Map();
  private clams: GiantClam[] = [];
  private loosePearls: FloatingLoosePearl[] = [];
  private nextPearlId: number = 1;

  private botReactionTimers: Map<PlayerId, number> = new Map();

  private screenShake: number = 0;
  private hitStopTimer: number = 0;

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
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
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
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.divers.clear();
    this.clams = [];
    this.loosePearls = [];
    this.botReactionTimers.clear();

    // Spawn 5 Giant Oyster Clams across seabed
    const clamCount = 5;
    const spacing = width / (clamCount + 1);
    for (let i = 1; i <= clamCount; i++) {
      this.clams.push({
        id: i,
        x: spacing * i + (Math.random() - 0.5) * 20,
        y: height - 120 + (Math.random() - 0.5) * 15,
        radius: 32,
        state: 'closed',
        timer: 0.8 + Math.random() * 1.5,
        pearl: this.generateRandomPearl(),
        hasPearl: true
      });
    }

    const active = this.getActivePlayers();
    const diverSpacing = width / (active.length + 1);

    active.forEach((p, idx) => {
      this.divers.set(p.id, {
        id: p.id,
        x: diverSpacing * (idx + 1),
        y: 140,
        vx: 0,
        vy: 0,
        angle: Math.PI / 2,
        targetAngle: Math.PI / 2,
        chargeTime: 0,
        isCharging: false,
        shuntActiveTimer: 0,
        shuntDirX: 0,
        shuntDirY: 0,
        shuntCooldown: 0,
        stunTimer: 0,
        score: 0,
        pearlsCollected: 0,
        combo: 0,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: Math.random() * 5
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
    });

    this.currentThemeIdx = 0;
    this.currentMapName = THEMES[0].name;
  }

  private generateRandomPearl(): PearlType {
    const isSuddenDeath = this.roundTimer < 15;
    let pool = PEARL_TEMPLATES;
    if (isSuddenDeath) {
      pool = [
        ...PEARL_TEMPLATES,
        PEARL_TEMPLATES[3], // Imperial Golden
        PEARL_TEMPLATES[3]
      ];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  public cycleTheme(): void {
    this.currentThemeIdx = (this.currentThemeIdx + 1) % THEMES.length;
    this.currentMapName = THEMES[this.currentThemeIdx].name;
    this.audio.playTap();
  }

  public setTheme(index: number): void {
    if (index >= 0 && index < THEMES.length) {
      this.currentThemeIdx = index;
      this.currentMapName = THEMES[this.currentThemeIdx].name;
      this.audio.playTap();
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Identify leader score for Underdog surge
    let maxScore = 0;
    for (const d of this.divers.values()) {
      if (d.score > maxScore) maxScore = d.score;
    }

    // Update bots
    this.updateBots(dt, width, height);

    // Update Clam biological opening/snapping cycle
    for (const clam of this.clams) {
      clam.timer -= dt;
      if (clam.timer <= 0) {
        if (clam.state === 'closed') {
          clam.state = 'opening';
          clam.timer = 0.5;
          clam.hasPearl = true;
          clam.pearl = this.generateRandomPearl();
        } else if (clam.state === 'opening') {
          clam.state = 'open';
          clam.timer = this.roundTimer < 15 ? 1.6 : 1.1 + Math.random() * 0.7; // harvest window
        } else if (clam.state === 'open') {
          clam.state = 'snapping';
          clam.timer = 0.35;
          this.audio.playBounce();
          this.particles.emit(clam.x, clam.y - 10, 4, '#80DEEA');
        } else if (clam.state === 'snapping') {
          clam.state = 'closed';
          clam.timer = 0.9 + Math.random() * 1.4;
        }
      }
    }

    // Update Floating Loose Pearls
    for (let i = this.loosePearls.length - 1; i >= 0; i--) {
      const lp = this.loosePearls[i];
      lp.x += lp.vx * dt;
      lp.y += lp.vy * dt;
      lp.vx *= 0.96;
      lp.vy *= 0.96;
      lp.life -= dt;
      if (lp.life <= 0) {
        this.loosePearls.splice(i, 1);
      }
    }

    // Update Divers
    for (const p of this.getActivePlayers()) {
      const diver = this.divers.get(p.id);
      if (!diver) continue;

      diver.animTimer += dt;
      if (diver.moodTimer > 0) {
        diver.moodTimer -= dt;
        if (diver.moodTimer <= 0) diver.mood = 'idle';
      }

      // Check Underdog
      diver.isUnderdog = maxScore >= 35 && diver.score <= maxScore - 30;

      // Handle Stun
      if (diver.stunTimer > 0) {
        diver.stunTimer -= dt;
        diver.vx *= 0.88;
        diver.vy *= 0.88;
        diver.x += diver.vx * dt;
        diver.y += diver.vy * dt;
        continue;
      }

      // Handle Shunt Cooldown & Active Timer
      if (diver.shuntCooldown > 0) diver.shuntCooldown -= dt;
      if (diver.shuntActiveTimer > 0) {
        diver.shuntActiveTimer -= dt;
        diver.vx = diver.shuntDirX * 580;
        diver.vy = diver.shuntDirY * 580;
        this.particles.emit(diver.x, diver.y, 2, '#38BDF8');
      }

      // Swimming Steering & Input
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const hasMoveInput = Math.abs(steer) > 0.1 || Math.abs(throttle) > 0.1;
      if (hasMoveInput) {
        diver.targetAngle = Math.atan2(-throttle, steer);
      }

      // Smooth hydrodynamic turning
      let diff = diver.targetAngle - diver.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      diver.angle += diff * Math.min(1.0, dt * 8);

      const baseSwimThrust = diver.isUnderdog ? 270 : 220;

      // Hold-to-Charge Fin Surge vs Plunge Shunt
      if (isAction && diver.shuntActiveTimer <= 0) {
        diver.isCharging = true;
        diver.chargeTime = Math.min(1.0, diver.chargeTime + dt * 2.2);

        // While charging, diver glides steadily
        if (hasMoveInput) {
          diver.vx += Math.cos(diver.angle) * baseSwimThrust * 0.45 * dt;
          diver.vy += Math.sin(diver.angle) * baseSwimThrust * 0.45 * dt;
        }
      } else {
        if (diver.isCharging) {
          // Release: Fin Surge Dash or Plunge Shunt!
          diver.isCharging = false;
          if (diver.chargeTime > 0.25) {
            diver.shuntActiveTimer = 0.24;
            diver.shuntDirX = Math.cos(diver.angle);
            diver.shuntDirY = Math.sin(diver.angle);
            diver.shuntCooldown = 0.8;
            this.audio.playWhoosh();
            this.particles.emit(diver.x, diver.y, 10, '#38BDF8');
          }
          diver.chargeTime = 0;
        } else if (diver.shuntActiveTimer <= 0 && hasMoveInput) {
          diver.vx += Math.cos(diver.angle) * baseSwimThrust * dt;
          diver.vy += Math.sin(diver.angle) * baseSwimThrust * dt;

          // Swim bubbles
          if (Math.random() < 0.25) {
            const finX = diver.x - Math.cos(diver.angle) * 18;
            const finY = diver.y - Math.sin(diver.angle) * 18;
            this.particles.emit(finX, finY, 1, '#BAE6FD');
          }
        }
      }

      // Water Drag
      diver.vx *= Math.pow(0.88, dt * 10);
      diver.vy *= Math.pow(0.88, dt * 10);

      diver.x += diver.vx * dt;
      diver.y += diver.vy * dt;

      // Arena bounds
      const margin = 35;
      if (diver.x < margin) { diver.x = margin; diver.vx = Math.abs(diver.vx) * 0.5; }
      if (diver.x > width - margin) { diver.x = width - margin; diver.vx = -Math.abs(diver.vx) * 0.5; }
      if (diver.y < 65) { diver.y = 65; diver.vy = Math.abs(diver.vy) * 0.5; }
      if (diver.y > height - 70) { diver.y = height - 70; diver.vy = -Math.abs(diver.vy) * 0.5; }

      // Check Clam Harvesting or Snapping
      const harvestRadius = diver.isUnderdog ? 38 : 28;
      for (const clam of this.clams) {
        const d = Math.hypot(diver.x - clam.x, diver.y - clam.y);
        if (d < harvestRadius) {
          if (clam.state === 'open' && clam.hasPearl && clam.pearl) {
            // Harvest Pearl!
            this.harvestPearl(diver, clam);
          } else if ((clam.state === 'snapping' || clam.state === 'closed') && !diver.isUnderdog) {
            // Shell Snap!
            diver.stunTimer = 0.85;
            diver.score = Math.max(0, diver.score - 10);
            diver.mood = 'shocked';
            diver.moodTimer = 1.0;
            this.audio.playExplosion();
            this.screenShake = 6;
            this.particles.emit(clam.x, clam.y - 10, 10, '#FF5252');
          }
        }
      }

      // Check Floating Loose Pearl Collection
      for (let i = this.loosePearls.length - 1; i >= 0; i--) {
        const lp = this.loosePearls[i];
        if (Math.hypot(diver.x - lp.x, diver.y - lp.y) < harvestRadius) {
          diver.score += lp.pearl.points;
          diver.pearlsCollected++;
          diver.mood = 'triumph';
          diver.moodTimer = 0.8;
          this.audio.playScore();
          this.particles.emit(lp.x, lp.y, 8, lp.pearl.color);
          this.loosePearls.splice(i, 1);
        }
      }
    }

    // Inter-Diver Plunge Shunts
    const diversArr = this.getActivePlayers().map(p => this.divers.get(p.id)!);
    for (let i = 0; i < diversArr.length; i++) {
      for (let j = i + 1; j < diversArr.length; j++) {
        const d1 = diversArr[i];
        const d2 = diversArr[j];
        const dist = Math.hypot(d1.x - d2.x, d1.y - d2.y);
        const touchDist = 44;

        if (dist < touchDist && dist > 0) {
          const overlap = touchDist - dist;
          const nx = (d1.x - d2.x) / dist;
          const ny = (d1.y - d2.y) / dist;
          d1.x += nx * overlap * 0.5;
          d1.y += ny * overlap * 0.5;
          d2.x -= nx * overlap * 0.5;
          d2.y -= ny * overlap * 0.5;

          // Check if one was shunting
          if (d1.shuntActiveTimer > 0 && d2.shuntActiveTimer <= 0) {
            this.executeDiverShunt(d1, d2, nx, ny);
          } else if (d2.shuntActiveTimer > 0 && d1.shuntActiveTimer <= 0) {
            this.executeDiverShunt(d2, d1, -nx, -ny);
          } else {
            // Normal bump
            const avgVx = (d1.vx + d2.vx) * 0.5;
            const avgVy = (d1.vy + d2.vy) * 0.5;
            d1.vx = avgVx + nx * 100;
            d1.vy = avgVy + ny * 100;
            d2.vx = avgVx - nx * 100;
            d2.vy = avgVy - ny * 100;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private harvestPearl(diver: DiverPlayer, clam: GiantClam): void {
    const pearl = clam.pearl!;
    clam.hasPearl = false;
    clam.pearl = null;

    if (pearl.isHazard) {
      // Urchin!
      diver.score = Math.max(0, diver.score + pearl.points);
      diver.stunTimer = 0.8;
      diver.mood = 'shocked';
      diver.moodTimer = 1.0;
      this.audio.playExplosion();
      this.particles.emit(clam.x, clam.y - 15, 12, pearl.color);
      return;
    }

    diver.score += pearl.points;
    diver.pearlsCollected++;
    diver.combo++;

    if (pearl.isGolden) {
      diver.mood = 'triumph';
      diver.moodTimer = 1.4;
      this.audio.playFanfare();
      this.particles.emit(clam.x, clam.y - 15, 22, '#FFD700');
      this.screenShake = 8;
      this.hitStopTimer = 0.04;
    } else {
      diver.mood = 'happy';
      diver.moodTimer = 0.6;
      this.audio.playScore();
      this.particles.emit(clam.x, clam.y - 15, 8, pearl.color);
    }
  }

  private executeDiverShunt(attacker: DiverPlayer, victim: DiverPlayer, nx: number, ny: number): void {
    attacker.score += 30; // Sabotage bonus
    attacker.mood = 'triumph';
    attacker.moodTimer = 1.2;

    victim.vx = -nx * 440;
    victim.vy = -ny * 440;
    victim.stunTimer = 0.85;
    victim.mood = 'shocked';
    victim.moodTimer = 1.2;

    // Dislodge 1-2 floating loose pearls from victim into water for attacker to steal!
    if (victim.pearlsCollected > 0) {
      victim.pearlsCollected--;
      this.loosePearls.push({
        id: this.nextPearlId++,
        x: victim.x,
        y: victim.y,
        vx: -nx * 130 + (Math.random() - 0.5) * 40,
        vy: -ny * 130 + (Math.random() - 0.5) * 40,
        pearl: PEARL_TEMPLATES[1], // Pink Pearl
        life: 5.0
      });
    }

    this.audio.playExplosion();
    this.particles.emit((attacker.x + victim.x) * 0.5, (attacker.y + victim.y) * 0.5, 18, '#FF5252');
    this.screenShake = 9;
    this.hitStopTimer = 0.045;
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

    const diver = this.divers.get(botId);
    if (!diver || diver.stunTimer > 0) return;

    let delay = 0.24;
    let blunder = false;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunder = Math.random() < 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
    }

    // 1. Locate best open clam or loose pearl
    let targetX = diver.x;
    let targetY = diver.y;
    let bestDist = Infinity;

    // Check open clams with pearls
    for (const clam of this.clams) {
      if ((clam.state === 'open' || clam.state === 'opening') && clam.hasPearl) {
        const d = Math.hypot(clam.x - diver.x, clam.y - diver.y);
        if (d < bestDist) {
          bestDist = d;
          targetX = clam.x;
          targetY = clam.y - 10;
        }
      }
    }

    // Also check loose pearls
    for (const lp of this.loosePearls) {
      const d = Math.hypot(lp.x - diver.x, lp.y - diver.y);
      if (d < bestDist) {
        bestDist = d;
        targetX = lp.x;
        targetY = lp.y;
      }
    }

    // Hard bot: attack nearby rivals with plunge shunt
    if (difficulty === 'bot_hard' && diver.shuntCooldown <= 0) {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const rival = this.divers.get(p.id);
        if (rival && Math.hypot(rival.x - diver.x, rival.y - diver.y) < 75) {
          const dx = rival.x - diver.x;
          const dy = rival.y - diver.y;
          this.input.setBotInput(botId, true, dx, -dy, false);
          this.botReactionTimers.set(botId, 0.28);
          return;
        }
      }
    }

    const dx = targetX - diver.x;
    const dy = targetY - diver.y;
    let steerX = Math.abs(dx) > 12 ? Math.sign(dx) : 0;
    let steerY = Math.abs(dy) > 12 ? Math.sign(dy) : 0;

    if (blunder) {
      steerX = -steerX;
      steerY = -steerY;
    }

    this.input.setBotInput(botId, false, steerX, -steerY, false);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const d = this.divers.get(p.id);
      return {
        playerId: p.id,
        score: d?.score || 0,
        pearls: d?.pearlsCollected || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topPlayer = scores[0];
    const mvpHighlight = winnerId !== null
      ? `Diver ${winnerId + 1} harvested ${topPlayer.pearls} glowing lustrous sea pearls!`
      : 'All divers surfaced empty-handed from the reef!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Water Lagoon Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.waterTop);
    bgGrad.addColorStop(1, theme.waterBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Coral Background
    this.renderThemeBackdrop(ctx, width, height, theme);

    // Seabed Floor Sand
    const sandY = height - 90;
    ctx.fillStyle = theme.sandColor;
    ctx.fillRect(0, sandY, width, 90);

    ctx.fillStyle = theme.sandTrim;
    ctx.fillRect(0, sandY, width, 6);

    // Render Giant Oyster Clams
    for (const clam of this.clams) {
      this.renderClam(ctx, clam);
    }

    // Render Floating Loose Pearls
    for (const lp of this.loosePearls) {
      ctx.save();
      ctx.fillStyle = lp.pearl.color;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, lp.pearl.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Render Divers
    for (const p of this.getActivePlayers()) {
      const diver = this.divers.get(p.id);
      if (!diver) continue;
      this.renderDiver(ctx, p, diver, theme);
    }

    // Render Particles
    this.particles.render(ctx);

    ctx.restore();

    // UI Header & Theme Pill
    this.renderUI(ctx, width, height);
  }

  private renderThemeBackdrop(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: ReefTheme
  ): void {
    ctx.save();
    if (theme.id === 'barrier_reef') {
      // Coral branches
      ctx.fillStyle = 'rgba(255, 112, 67, 0.15)';
      for (let x = 40; x < width; x += 110) {
        ctx.beginPath();
        ctx.arc(x, height - 90, 45, Math.PI, 0);
        ctx.fill();
      }
    } else if (theme.id === 'bioluminescent_grotto') {
      // Glowing Neon Spores
      for (let x = 30; x < width; x += 70) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
        ctx.beginPath();
        ctx.arc(x, 150 + Math.sin(this.roundTimer * 2 + x) * 30, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Shipwreck Timbers
      ctx.fillStyle = 'rgba(141, 110, 99, 0.15)';
      for (let x = 50; x < width; x += 120) {
        ctx.fillRect(x, height - 200, 24, 110);
      }
    }
    ctx.restore();
  }

  private renderClam(ctx: CanvasRenderingContext2D, clam: GiantClam): void {
    ctx.save();
    ctx.translate(clam.x, clam.y);

    // Clam Bottom Shell
    ctx.fillStyle = '#5D4037';
    ctx.beginPath();
    ctx.ellipse(0, 0, clam.radius, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Open Shell Lip / Interior Nacre
    if (clam.state === 'open' || clam.state === 'opening') {
      ctx.fillStyle = '#FCE4EC';
      ctx.beginPath();
      ctx.ellipse(0, -6, clam.radius * 0.8, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pearl sitting in center
      if (clam.hasPearl && clam.pearl) {
        ctx.fillStyle = clam.pearl.color;
        ctx.beginPath();
        ctx.arc(0, -8, clam.pearl.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Shimmer
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-2, -10, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Top Shell (hinged up when open)
    const shellOffset = clam.state === 'open' ? -18 : clam.state === 'opening' ? -10 : -2;
    ctx.fillStyle = '#6D4C41';
    ctx.beginPath();
    ctx.ellipse(0, shellOffset, clam.radius * 0.9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private renderDiver(
    ctx: CanvasRenderingContext2D,
    p: PlayerConfig,
    diver: DiverPlayer,
    _theme: ReefTheme
  ): void {
    ctx.save();
    ctx.translate(diver.x, diver.y);

    // Underdog Golden Glow Aura
    if (diver.isUnderdog) {
      ctx.save();
      const auraPulse = Math.sin(diver.animTimer * 8) * 6 + 18;
      const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, auraPulse + 25);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
      grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, auraPulse + 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Charge Indicator Ring
    if (diver.chargeTime > 0) {
      ctx.save();
      const chargeRatio = diver.chargeTime / 1.0;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(diver.angle);

    // Swim Fin Kick Animation
    const finAnim = Math.sin(diver.animTimer * 16) * 6;
    ctx.fillStyle = diver.isUnderdog ? '#FFD700' : p.color;
    ctx.beginPath();
    ctx.moveTo(-16, -finAnim);
    ctx.lineTo(-28, -finAnim - 6);
    ctx.lineTo(-28, -finAnim + 6);
    ctx.closePath();
    ctx.fill();

    // Woven Pearl Net in Hand
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(14, 10, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Mascot Diver Avatar
    const isBot = p.type !== 'human';
    drawCharacter(
      ctx,
      0,
      0,
      16,
      p.id,
      isBot,
      diver.mood,
      diver.animTimer,
      undefined
    );

    // Scuba Mask & Snorkel
    ctx.fillStyle = 'rgba(0, 229, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(6, -2, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // Overhead Name & Score Badge
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(diver.x - 38, diver.y + 22, 76, 22, 6);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${diver.score}`, diver.x, diver.y + 36);
    ctx.restore();
  }

  private renderUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Top-Center Safe Zone (y: 12-44) is strictly reserved for global timer
    // Minigame Header Badge strictly at y: 56
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 130, 56, 260, 28, 8);
    ctx.fill();

    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🦪 PEARL DIVERS • ${THEMES[this.currentThemeIdx].name}`, width / 2, 70);
    ctx.restore();

    // Theme Pill (bottom-left at x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`[T] ${THEMES[this.currentThemeIdx].name}`, pillX + 10, pillY + pillH / 2);
    ctx.restore();

    // Player Cards at Corners (Offset to y: height - 128 to never overlap Theme Pill)
    this.renderCornerPlayerCards(ctx, width, height);

    // Control Hints at Bottom Right
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(width - 260, height - 36, 240, 26, 6);
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Steer: Swim • Hold Action: Fin Surge & Shunt', width - 28, height - 23);
    ctx.restore();
  }

  private renderCornerPlayerCards(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const diver = this.divers.get(p.id);
      if (!diver) return;

      const cardW = 130;
      const cardH = 48;
      let cx = 20;
      let cy = height - 128; // safe offset above Theme Pill

      if (idx === 1) {
        cx = width - cardW - 20;
        cy = height - 128;
      } else if (idx === 2) {
        cx = 20;
        cy = 90;
      } else if (idx === 3) {
        cx = width - cardW - 20;
        cy = 90;
      }

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 6);
      ctx.fill();

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 10, cy + 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 13px monospace';
      ctx.fillText(`${diver.score} pts`, cx + 10, cy + 36);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🦪 ${diver.pearlsCollected}`, cx + cardW - 8, cy + 36);

      ctx.restore();
    });
  }
}
