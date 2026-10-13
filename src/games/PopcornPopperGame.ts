import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface KernelType {
  name: string;
  color: string;
  points: number;
  radius: number;
  isGolden?: boolean;
  isHazard?: boolean;
}

const KERNEL_TEMPLATES: KernelType[] = [
  { name: 'Butter Popcorn', color: '#FFF59D', points: 12, radius: 13 },
  { name: 'White Cheddar', color: '#FFFDE7', points: 15, radius: 14 },
  { name: 'Sweet Caramel', color: '#FFB74D', points: 18, radius: 14 },
  { name: 'Rainbow Sugar', color: '#F48FB1', points: 22, radius: 14 },
  { name: 'Golden Truffle', color: '#FFD700', points: 42, radius: 16, isGolden: true },
  { name: 'Burnt Charcoal', color: '#37474F', points: -15, radius: 12, isHazard: true }
];

interface AirborneKernel {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: KernelType;
  rot: number;
  rotSpeed: number;
}

interface ConcessionPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  chargeTime: number;
  isCharging: boolean;
  bucketKernels: KernelType[];
  shuntCooldown: number;
  shuntActiveTimer: number;
  shuntDir: number;
  stunTimer: number;
  score: number;
  tubsServed: number;
  combo: number;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface PopcornTheme {
  id: string;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  counterColor: string;
  counterTrim: string;
  deckColor: string;
  accentColor: string;
}

const THEMES: PopcornTheme[] = [
  {
    id: 'vintage_cinema',
    name: 'Vintage Cinema 🍿',
    icon: '🍿',
    bgTop: '#1F0A0A',
    bgBottom: '#0D0303',
    counterColor: '#3E2723',
    counterTrim: '#D32F2F',
    deckColor: '#261714',
    accentColor: '#FFD54F'
  },
  {
    id: 'cyber_imax',
    name: 'Cyber IMAX Hub ⚡',
    icon: '⚡',
    bgTop: '#0A0817',
    bgBottom: '#020208',
    counterColor: '#171B30',
    counterTrim: '#00E5FF',
    deckColor: '#0E1020',
    accentColor: '#00E5FF'
  },
  {
    id: 'boardwalk_carnival',
    name: 'Boardwalk Carnival 🎪',
    icon: '🎪',
    bgTop: '#FFF8E1',
    bgBottom: '#FFE0B2',
    counterColor: '#E65100',
    counterTrim: '#FFD54F',
    deckColor: '#8D6E63',
    accentColor: '#FF6F00'
  }
];

export class PopcornPopperGame extends BaseGame {
  public currentMapName: string = 'Vintage Cinema 🍿';
  private currentThemeIdx: number = 0;

  private concessionPlayers: Map<PlayerId, ConcessionPlayer> = new Map();
  private airborneKernels: AirborneKernel[] = [];
  private nextKernelId: number = 1;
  private kernelSpawnTimer: number = 0.5;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botTargetKernel: Map<PlayerId, number | null> = new Map();

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
    this.airborneKernels = [];
    this.concessionPlayers.clear();
    this.botReactionTimers.clear();
    this.botTargetKernel.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.concessionPlayers.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 110,
        vx: 0,
        chargeTime: 0,
        isCharging: false,
        bucketKernels: [],
        shuntCooldown: 0,
        shuntActiveTimer: 0,
        shuntDir: 0,
        stunTimer: 0,
        score: 0,
        tubsServed: 0,
        combo: 0,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: Math.random() * 5
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
      this.botTargetKernel.set(p.id, null);
    });

    this.currentThemeIdx = 0;
    this.currentMapName = THEMES[0].name;
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
    for (const cp of this.concessionPlayers.values()) {
      if (cp.score > maxScore) maxScore = cp.score;
    }

    // Update bots
    this.updateBots(dt, width, height);

    // Spawning airborne popcorn bursts from central kettle
    this.kernelSpawnTimer -= dt;
    const spawnRate = this.roundTimer < 15 ? 0.38 : 0.68;
    if (this.kernelSpawnTimer <= 0) {
      this.kernelSpawnTimer = spawnRate + Math.random() * 0.28;
      this.spawnPoppedKernel(width);
    }

    // Update airborne kernels
    for (let i = this.airborneKernels.length - 1; i >= 0; i--) {
      const k = this.airborneKernels[i];
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.vy += 230 * dt; // gravity
      k.rot += k.rotSpeed * dt;

      // Splat on concession counter
      if (k.y > height - 70) {
        this.particles.emit(k.x, height - 75, 4, k.type.color);
        this.airborneKernels.splice(i, 1);
      }
    }

    // Update concession players
    for (const p of this.getActivePlayers()) {
      const cp = this.concessionPlayers.get(p.id);
      if (!cp) continue;

      cp.animTimer += dt;
      if (cp.moodTimer > 0) {
        cp.moodTimer -= dt;
        if (cp.moodTimer <= 0) cp.mood = 'idle';
      }

      // Check Underdog
      cp.isUnderdog = maxScore >= 35 && cp.score <= maxScore - 30;

      // Handle Stun
      if (cp.stunTimer > 0) {
        cp.stunTimer -= dt;
        cp.vx *= 0.85;
        cp.x += cp.vx * dt;
        cp.x = Math.max(45, Math.min(width - 45, cp.x));
        continue;
      }

      // Handle Shunt Cooldown & Active Timer
      if (cp.shuntCooldown > 0) cp.shuntCooldown -= dt;
      if (cp.shuntActiveTimer > 0) {
        cp.shuntActiveTimer -= dt;
        cp.vx = cp.shuntDir * 580;
        this.particles.emit(cp.x - cp.shuntDir * 16, cp.y - 15, 2, '#FFD54F');
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const baseSpeed = cp.isUnderdog ? 330 : 270;

      // Hold-to-Charge Butter Scoop & Bucket Shunt
      if (isAction && cp.shuntActiveTimer <= 0) {
        cp.isCharging = true;
        cp.chargeTime = Math.min(1.0, cp.chargeTime + dt * 2.2);

        const chargeMoveSpeed = baseSpeed * 0.45;
        if (Math.abs(steer) > 0.15) {
          cp.vx = steer * chargeMoveSpeed;
        } else {
          cp.vx *= 0.8;
        }
      } else {
        if (cp.isCharging) {
          // Release: Butter Tub Serving or Bucket Shunt!
          cp.isCharging = false;
          if (cp.chargeTime > 0.2) {
            this.executeConcessionAction(cp, steer);
          }
          cp.chargeTime = 0;
        } else if (cp.shuntActiveTimer <= 0) {
          if (Math.abs(steer) > 0.15) {
            cp.vx = steer * baseSpeed;
          } else {
            cp.vx *= 0.82;
          }
        }
      }

      cp.x += cp.vx * dt;
      // Screen bounds
      if (cp.x < 50) {
        cp.x = 50;
        cp.vx = 0;
      }
      if (cp.x > width - 50) {
        cp.x = width - 50;
        cp.vx = 0;
      }

      // Catch Falling Popcorn in Bucket
      const bucketX = cp.x + (cp.vx > 10 ? 12 : cp.vx < -10 ? -12 : 6);
      const bucketY = cp.y - 28;
      const catchRadius = cp.isUnderdog ? 36 : 26;

      for (let i = this.airborneKernels.length - 1; i >= 0; i--) {
        const k = this.airborneKernels[i];
        const dist = Math.hypot(k.x - bucketX, k.y - bucketY);

        if (dist < catchRadius + k.type.radius) {
          this.catchKernel(cp, k.type);
          this.airborneKernels.splice(i, 1);
        }
      }
    }

    // Inter-Player Body & Shunt Collisions
    const playersArr = this.getActivePlayers().map(p => this.concessionPlayers.get(p.id)!);
    for (let i = 0; i < playersArr.length; i++) {
      for (let j = i + 1; j < playersArr.length; j++) {
        const c1 = playersArr[i];
        const c2 = playersArr[j];
        const dist = Math.abs(c1.x - c2.x);
        const touchDist = 48;

        if (dist < touchDist) {
          const overlap = touchDist - dist;
          const dir = c1.x < c2.x ? -1 : 1;
          c1.x += dir * overlap * 0.5;
          c2.x -= dir * overlap * 0.5;

          // Check if one was shunting
          if (c1.shuntActiveTimer > 0 && c2.shuntActiveTimer <= 0) {
            this.executeBucketShunt(c1, c2, -dir);
          } else if (c2.shuntActiveTimer > 0 && c1.shuntActiveTimer <= 0) {
            this.executeBucketShunt(c2, c1, dir);
          } else {
            // Normal bump
            const avgVx = (c1.vx + c2.vx) * 0.5;
            c1.vx = avgVx + dir * 110;
            c2.vx = avgVx - dir * 110;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnPoppedKernel(width: number): void {
    const margin = 70;
    const x = margin + Math.random() * (width - margin * 2);
    const isSuddenDeath = this.roundTimer < 15;
    let pool = KERNEL_TEMPLATES;
    if (isSuddenDeath) {
      pool = [
        ...KERNEL_TEMPLATES,
        KERNEL_TEMPLATES[4], // Golden Truffle
        KERNEL_TEMPLATES[2]  // Sweet Caramel
      ];
    }
    const template = pool[Math.floor(Math.random() * pool.length)];

    this.airborneKernels.push({
      id: this.nextKernelId++,
      x,
      y: 70,
      vx: (Math.random() - 0.5) * 80,
      vy: 110 + Math.random() * 60,
      type: template,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3
    });
  }

  private catchKernel(cp: ConcessionPlayer, kernel: KernelType): void {
    if (kernel.isHazard) {
      // Burnt charcoal! If not underdog, causes soot stun
      if (!cp.isUnderdog) {
        cp.score = Math.max(0, cp.score + kernel.points);
        cp.stunTimer = 0.85;
        cp.combo = 0;
        cp.mood = 'shocked';
        cp.moodTimer = 1.0;
        this.audio.playExplosion();
        this.screenShake = 6;
        this.particles.emit(cp.x, cp.y - 25, 12, kernel.color);
        return;
      }
    }

    cp.bucketKernels.push(kernel);
    cp.score += kernel.points;
    cp.combo++;
    cp.mood = 'happy';
    cp.moodTimer = 0.6;
    this.audio.playTap();
    this.particles.emit(cp.x, cp.y - 25, 6, kernel.color);
  }

  private executeConcessionAction(cp: ConcessionPlayer, steer: number): void {
    // If moving sideways with strong input, trigger Bucket Shunt Dash!
    const wantsShunt = Math.abs(steer) > 0.35 && cp.shuntCooldown <= 0;
    if (wantsShunt) {
      cp.shuntActiveTimer = 0.22;
      cp.shuntDir = Math.sign(steer);
      cp.shuntCooldown = 0.8;
      this.audio.playWhoosh();
      this.particles.emit(cp.x, cp.y - 20, 10, '#FFD54F');
      return;
    }

    // Otherwise, serve Jumbo Butter Tub!
    if (cp.bucketKernels.length === 0) {
      this.audio.playTap();
      return;
    }

    const inSweetSpot = cp.chargeTime >= 0.72 && cp.chargeTime <= 0.98;
    const multiplier = inSweetSpot ? 2.0 : 1.2;
    const kernelCount = cp.bucketKernels.length;
    const tubBonus = Math.round((25 + kernelCount * 14 + cp.combo * 4) * multiplier);

    cp.score += tubBonus;
    cp.tubsServed++;
    cp.bucketKernels = [];

    cp.mood = 'triumph';
    cp.moodTimer = 1.4;

    if (inSweetSpot) {
      this.audio.playFanfare();
      this.particles.emit(cp.x, cp.y - 45, 22, '#FFD54F');
      this.particles.emit(cp.x, cp.y - 45, 15, '#FF9800');
      this.screenShake = 8;
      this.hitStopTimer = 0.04;
    } else {
      this.audio.playScore();
      this.particles.emit(cp.x, cp.y - 35, 10, '#FFF59D');
    }
  }

  private executeBucketShunt(attacker: ConcessionPlayer, victim: ConcessionPlayer, dir: number): void {
    attacker.score += 30; // Sabotage bonus
    attacker.mood = 'triumph';
    attacker.moodTimer = 1.2;

    victim.vx = dir * 420;
    victim.stunTimer = 0.75;
    victim.mood = 'shocked';
    victim.moodTimer = 1.2;

    // Pop loose kernel out of victim's bucket into air for attacker to steal!
    if (victim.bucketKernels.length > 0) {
      const popped = victim.bucketKernels.pop()!;
      this.airborneKernels.push({
        id: this.nextKernelId++,
        x: victim.x,
        y: victim.y - 45,
        vx: -dir * 110,
        vy: -170,
        type: popped,
        rot: 0,
        rotSpeed: 4
      });
    }

    this.audio.playExplosion();
    this.particles.emit((attacker.x + victim.x) * 0.5, attacker.y - 25, 18, '#FF5252');
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

    const cp = this.concessionPlayers.get(botId);
    if (!cp || cp.stunTimer > 0) return;

    let delay = 0.24;
    let blunder = false;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunder = Math.random() < 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
    }

    // 1. If player has 2+ kernels in bucket, serve tub
    if (cp.bucketKernels.length >= 2) {
      this.executeConcessionAction(cp, 0);
      this.botReactionTimers.set(botId, delay);
      return;
    }

    // 2. Hard bot: shunt nearby rivals
    if (difficulty === 'bot_hard' && cp.shuntCooldown <= 0) {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const rival = this.concessionPlayers.get(p.id);
        if (rival && Math.abs(rival.x - cp.x) < 80 && rival.bucketKernels.length > 0) {
          const shuntDir = rival.x > cp.x ? 1 : -1;
          this.executeConcessionAction(cp, shuntDir);
          this.botReactionTimers.set(botId, 0.3);
          return;
        }
      }
    }

    // 3. Locate best falling kernel
    let bestKernel: AirborneKernel | null = null;
    let bestScore = -9999;

    for (const k of this.airborneKernels) {
      if (k.type.isHazard) continue; // avoid burnt charcoal
      let weight = k.type.points;
      if (k.type.isGolden) weight += 30;

      const timeToGround = Math.max(0.1, (cp.y - k.y) / Math.max(1, k.vy));
      const projectedX = k.x + k.vx * timeToGround;
      const dist = Math.abs(projectedX - cp.x);

      const score = weight - dist * 0.4;
      if (score > bestScore) {
        bestScore = score;
        bestKernel = k;
      }
    }

    let steer = 0;
    if (bestKernel) {
      const timeToCatch = Math.max(0.05, (cp.y - bestKernel.y) / Math.max(1, bestKernel.vy));
      const targetX = bestKernel.x + bestKernel.vx * timeToCatch;

      if (Math.abs(targetX - cp.x) > 16) {
        steer = targetX > cp.x ? 1 : -1;
      }
    }

    if (blunder) {
      steer = -steer;
    }

    this.input.setBotInput(botId, false, steer, 0, false);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const cp = this.concessionPlayers.get(p.id);
      return {
        playerId: p.id,
        score: cp?.score || 0,
        tubs: cp?.tubsServed || 0
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
      ? `Player ${winnerId + 1} served ${topPlayer.tubs} overflowing jumbo butter popcorn tubs!`
      : 'The theater lobby floor was covered in spilled popcorn kernels!';

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

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Backdrop
    this.renderThemeBackdrop(ctx, width, height, theme);

    // Concession Counter
    const counterY = height - 90;
    ctx.fillStyle = theme.counterColor;
    ctx.fillRect(0, counterY, width, 90);

    ctx.fillStyle = theme.counterTrim;
    ctx.fillRect(0, counterY, width, 8);

    // Floor deck
    ctx.fillStyle = theme.deckColor;
    ctx.fillRect(0, height - 25, width, 25);

    // Render Airborne Kernels
    for (const k of this.airborneKernels) {
      this.renderKernelItem(ctx, k);
    }

    // Render Concession Players
    for (const p of this.getActivePlayers()) {
      const cp = this.concessionPlayers.get(p.id);
      if (!cp) continue;
      this.renderConcessionPlayer(ctx, p, cp, theme);
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
    theme: PopcornTheme
  ): void {
    ctx.save();
    if (theme.id === 'vintage_cinema') {
      // Red Velvet Drapes & Cinema Lights
      ctx.fillStyle = 'rgba(211, 47, 47, 0.15)';
      for (let x = 30; x < width; x += 100) {
        ctx.fillRect(x, 0, 40, height - 90);
      }
    } else if (theme.id === 'cyber_imax') {
      // Neon IMAX Beam Conduits
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 55) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 90);
        ctx.stroke();
      }
    } else {
      // Boardwalk Striped Canopy
      ctx.fillStyle = 'rgba(255, 111, 0, 0.15)';
      for (let x = 20; x < width; x += 70) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 35, 60);
        ctx.lineTo(x + 70, 0);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private renderKernelItem(ctx: CanvasRenderingContext2D, k: AirborneKernel): void {
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.rot);

    if (k.type.isGolden) {
      // Golden Truffle Kernel
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(0, 0, k.type.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFA000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Specular highlight
      ctx.fillStyle = '#FFFDE7';
      ctx.beginPath();
      ctx.arc(-4, -4, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (k.type.isHazard) {
      // Burnt Charcoal
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.rect(-k.type.radius, -k.type.radius, k.type.radius * 2, k.type.radius * 2);
      ctx.fill();

      ctx.fillStyle = '#FF5252';
      ctx.font = '900 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕', 0, 0);
    } else {
      // Popped Popcorn cloud
      ctx.fillStyle = k.type.color;
      ctx.beginPath();
      ctx.arc(0, 0, k.type.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderConcessionPlayer(
    ctx: CanvasRenderingContext2D,
    p: PlayerConfig,
    cp: ConcessionPlayer,
    _theme: PopcornTheme
  ): void {
    ctx.save();

    // Underdog Golden Glow Aura
    if (cp.isUnderdog) {
      ctx.save();
      const auraPulse = Math.sin(cp.animTimer * 8) * 6 + 18;
      const grad = ctx.createRadialGradient(cp.x, cp.y - 30, 10, cp.x, cp.y - 30, auraPulse + 25);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
      grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y - 30, auraPulse + 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Charge Indicator Ring
    if (cp.chargeTime > 0) {
      ctx.save();
      const chargeRatio = cp.chargeTime / 1.0;
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y - 25, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Mascot
    const isBot = p.type !== 'human';
    drawCharacter(
      ctx,
      cp.x,
      cp.y - 22,
      22,
      p.id,
      isBot,
      cp.mood,
      cp.animTimer,
      undefined
    );

    // Draw Paper Concession Hat
    ctx.save();
    ctx.translate(cp.x, cp.y - 44);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.lineTo(10, -12);
    ctx.lineTo(-10, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#D32F2F';
    ctx.fillRect(-6, -12, 4, 12);
    ctx.fillRect(2, -12, 4, 12);
    ctx.restore();

    // Draw Popcorn Tub in Hands
    const bucketX = cp.x + (cp.vx > 10 ? 14 : cp.vx < -10 ? -14 : 8);
    const bucketY = cp.y - 26;

    ctx.save();
    ctx.translate(bucketX, bucketY);

    // Striped Popcorn Bucket (Trapezoid)
    ctx.fillStyle = cp.isUnderdog ? '#FFD700' : '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(10, -14);
    ctx.lineTo(7, 10);
    ctx.lineTo(-7, 10);
    ctx.closePath();
    ctx.fill();

    // Red Stripes
    ctx.fillStyle = cp.isUnderdog ? '#FF8F00' : '#D32F2F';
    ctx.beginPath();
    ctx.moveTo(-4, -14);
    ctx.lineTo(-1, -14);
    ctx.lineTo(-1, 10);
    ctx.lineTo(-3, 10);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(1, -14);
    ctx.lineTo(4, -14);
    ctx.lineTo(3, 10);
    ctx.lineTo(1, 10);
    ctx.closePath();
    ctx.fill();

    // Popped Popcorn overflowing bucket
    if (cp.bucketKernels.length > 0) {
      ctx.fillStyle = '#FFF59D';
      ctx.beginPath();
      ctx.arc(0, -16, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Overhead Name & Score Badge
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(cp.x - 38, cp.y + 12, 76, 22, 6);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${cp.score}`, cp.x, cp.y + 27);
    ctx.restore();

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
    ctx.fillText(`🍿 POPCORN POPPER • ${THEMES[this.currentThemeIdx].name}`, width / 2, 70);
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
    ctx.fillText('Steer: Move • Hold Action: Tub Serve & Shunt', width - 28, height - 23);
    ctx.restore();
  }

  private renderCornerPlayerCards(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const cp = this.concessionPlayers.get(p.id);
      if (!cp) return;

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
      ctx.fillText(`${cp.score} pts`, cx + 10, cy + 36);

      ctx.fillStyle = '#FFD54F';
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🍿 ${cp.tubsServed}`, cx + cardW - 8, cy + 36);

      ctx.restore();
    });
  }
}
