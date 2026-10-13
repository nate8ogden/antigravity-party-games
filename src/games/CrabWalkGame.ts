import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface BeachCrab {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingDir: number; // 1 for right, -1 for left
  radius: number;
  chargeTime: number;
  isCharging: boolean;
  isDashing: boolean;
  dashTimer: number;
  shuntCooldown: number;
  stunTimer: number;
  invulnerableTimer: number;
  isFlipped: boolean;
  score: number;
  shellsCollected: number;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
  clawSnipAnim: number;
}

interface FallingItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'seashell' | 'starfish' | 'golden_conch' | 'coconut';
  points: number;
  color: string;
  rotation: number;
  rotSpeed: number;
}

interface BeachTheme {
  id: string;
  name: string;
  icon: string;
  sandLight: string;
  sandDark: string;
  waterSurf: string;
  waterDeep: string;
  accentColor: string;
}

const THEMES: BeachTheme[] = [
  {
    id: 'copacabana',
    name: 'Copacabana Shore 🏖️',
    icon: '🏖️',
    sandLight: '#FFE082',
    sandDark: '#FFCA28',
    waterSurf: '#80DEEA',
    waterDeep: '#00838F',
    accentColor: '#FF6F00'
  },
  {
    id: 'bioluminescent_grotto',
    name: 'Bioluminescent Grotto 🌌',
    icon: '🌌',
    sandLight: '#1A237E',
    sandDark: '#0D47A1',
    waterSurf: '#00E5FF',
    waterDeep: '#050D1A',
    accentColor: '#00E5FF'
  },
  {
    id: 'volcanic_black',
    name: 'Volcanic Black Sand 🌋',
    icon: '🌋',
    sandLight: '#37474F',
    sandDark: '#212121',
    waterSurf: '#FF5722',
    waterDeep: '#3E2723',
    accentColor: '#FF9100'
  }
];

export class CrabWalkGame extends BaseGame {
  public currentMapName: string = 'Copacabana Shore 🏖️';
  private currentThemeIdx: number = 0;

  private crabs: Map<PlayerId, BeachCrab> = new Map();
  private items: FallingItem[] = [];
  private itemIdCounter: number = 0;
  private spawnTimer: number = 0;
  private tidePhase: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
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
    super.destroy();
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.clickHandler) window.removeEventListener('click', this.clickHandler);
    }
  }

  public cycleTheme(): void {
    this.currentThemeIdx = (this.currentThemeIdx + 1) % THEMES.length;
    this.currentMapName = THEMES[this.currentThemeIdx].name;
    this.audio.playTap();
  }

  public setTheme(idx: number): void {
    if (idx >= 0 && idx < THEMES.length) {
      this.currentThemeIdx = idx;
      this.currentMapName = THEMES[this.currentThemeIdx].name;
      this.audio.playTap();
    }
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.crabs.clear();
    this.items = [];
    this.botReactionTimers.clear();
    this.spawnTimer = 0.3;
    this.tidePhase = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const startY = height * 0.72;

    active.forEach((p, idx) => {
      const step = width / (count + 1);
      const startX = step * (idx + 1);

      this.crabs.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        facingDir: idx % 2 === 0 ? 1 : -1,
        radius: 22,
        chargeTime: 0,
        isCharging: false,
        isDashing: false,
        dashTimer: 0,
        shuntCooldown: 0,
        stunTimer: 0,
        invulnerableTimer: 1.0,
        isFlipped: false,
        score: 0,
        shellsCollected: 0,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: 0,
        clawSnipAnim: 0
      });
      this.botReactionTimers.set(p.id, 0.25);
    });

    for (let i = 0; i < 8; i++) {
      this.spawnItem(width, height, true);
    }
  }

  private spawnItem(width: number, height: number, initial: boolean = false): void {
    const roll = Math.random();
    let type: FallingItem['type'] = 'seashell';
    let points = 20;
    let radius = 12;
    let color = '#FFCCBC';

    if (roll < 0.25) {
      type = 'coconut';
      points = -15;
      radius = 16;
      color = '#5D4037';
    } else if (roll < 0.60) {
      type = 'seashell';
      points = 20;
      radius = 12;
      color = '#FFCCBC';
    } else if (roll < 0.85) {
      type = 'starfish';
      points = 35;
      radius = 14;
      color = '#FF4081';
    } else {
      type = 'golden_conch';
      points = 60;
      radius = 18;
      color = '#FFD700';
    }

    const x = 50 + Math.random() * (width - 100);
    const y = initial ? height * 0.25 + Math.random() * (height * 0.45) : -20;
    const vy = 120 + Math.random() * 90;
    const vx = (Math.random() - 0.5) * 60;

    this.items.push({
      id: ++this.itemIdCounter,
      x,
      y,
      vx,
      vy,
      radius,
      type,
      points,
      color,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 4
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    const isSuddenDeath = this.roundTimer <= 15.0;
    this.tidePhase += dt * 2.5;

    // Item Spawning
    this.spawnTimer += dt;
    const spawnRate = isSuddenDeath ? 0.35 : 0.65;
    if (this.spawnTimer > spawnRate && this.items.length < 24) {
      this.spawnTimer = 0;
      this.spawnItem(width, height);
    }

    // Update Falling/Bouncing Items
    const groundY = height * 0.86;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rotation += it.rotSpeed * dt;

      // Beach bounce or wash
      if (it.y > groundY) {
        it.y = groundY;
        it.vy = -it.vy * 0.45;
        it.vx *= 0.85;
        if (Math.abs(it.vy) < 25) {
          it.vy = 0;
        }
      }

      // Despawn off bounds
      if (it.x < -30 || it.x > width + 30 || it.y > height + 40) {
        this.items.splice(i, 1);
      }
    }

    // Underdog calculation
    let maxScore = -1;
    for (const c of this.crabs.values()) {
      if (c.score > maxScore) maxScore = c.score;
    }
    for (const c of this.crabs.values()) {
      c.isUnderdog = maxScore - c.score >= 35 && maxScore > 20;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // Update Crabs
    for (const p of active) {
      const c = this.crabs.get(p.id);
      if (!c) continue;

      c.animTimer += dt;
      if (c.stunTimer > 0) {
        c.stunTimer -= dt;
        if (c.stunTimer <= 0) c.isFlipped = false;
      }
      if (c.invulnerableTimer > 0) c.invulnerableTimer -= dt;
      if (c.shuntCooldown > 0) c.shuntCooldown -= dt;
      if (c.moodTimer > 0) {
        c.moodTimer -= dt;
        if (c.moodTimer <= 0) c.mood = 'idle';
      }

      // Input
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      if (c.stunTimer <= 0 && !c.isFlipped) {
        const hasInput = Math.hypot(steer, throttle) > 0.15;
        if (hasInput) {
          if (Math.abs(steer) > 0.1) c.facingDir = Math.sign(steer);
          const speed = c.isUnderdog ? 270 : 220;
          c.vx += (steer * speed - c.vx) * Math.min(1.0, dt * 8.5);
          c.vy += (-throttle * speed * 0.7 - c.vy) * Math.min(1.0, dt * 8.5);

          // Sand dust particles
          if (Math.random() < 0.25) {
            this.particles.emit(c.x, c.y + 12, 1, '#FFE082');
          }
        } else {
          c.vx *= Math.pow(0.2, dt);
          c.vy *= Math.pow(0.2, dt);
        }

        // Hold-to-Charge Tidal Pinch Dash
        if (isAction) {
          c.isCharging = true;
          c.chargeTime += dt;
          c.mood = 'focused';
          c.clawSnipAnim += dt * 14;
          if (Math.random() < 0.25) {
            this.particles.spawnSparks(c.x + c.facingDir * 18, c.y, '#FF6F00', 2);
          }
        } else if (c.isCharging) {
          // Unleash Pinch Dash
          const ratio = Math.min(1.0, c.chargeTime / 1.0);
          const isSweet = ratio >= 0.72 && ratio <= 0.98;

          c.isCharging = false;
          c.chargeTime = 0;
          c.isDashing = true;
          c.dashTimer = isSweet ? 0.48 : 0.32;

          const dashSpeed = (isSweet ? 480 : 350) * (c.isUnderdog ? 1.2 : 1.0);
          c.vx = c.facingDir * dashSpeed;

          if (isSweet) {
            this.audio.playExplosion();
            this.particles.spawnConfetti(c.x, c.y, 16);
            c.mood = 'triumph';
            c.moodTimer = 1.2;
          } else {
            this.audio.playBounce();
          }
        }
      } else {
        c.vx *= Math.pow(0.1, dt);
        c.vy *= Math.pow(0.1, dt);
      }

      if (c.dashTimer > 0) {
        c.dashTimer -= dt;
        c.clawSnipAnim += dt * 25;
        if (c.dashTimer <= 0) c.isDashing = false;
        this.particles.emit(c.x - c.facingDir * 16, c.y + 10, 2, '#FFB74D');
      }

      c.x += c.vx * dt;
      c.y += c.vy * dt;

      // Beach boundaries
      const minY = height * 0.52;
      const maxY = height * 0.88;
      if (c.x < c.radius + 15) { c.x = c.radius + 15; c.vx = 0; }
      if (c.x > width - c.radius - 15) { c.x = width - c.radius - 15; c.vx = 0; }
      if (c.y < minY) { c.y = minY; c.vy = 0; }
      if (c.y > maxY) { c.y = maxY; c.vy = 0; }

      // Item Pickup / Collision Detection
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        const reach = c.radius + it.radius + (c.isUnderdog ? 18 : 6);

        if (Math.hypot(c.x - it.x, c.y - it.y) < reach) {
          if (it.type === 'coconut') {
            if (c.isUnderdog) {
              // Converted to sweet coconut milk!
              c.score += 15;
              this.audio.playScore();
              this.particles.spawnConfetti(c.x, c.y, 12);
            } else if (c.isDashing) {
              // Cleaved through with pincers!
              c.score += 10;
              this.audio.playExplosion();
              this.particles.spawnSparks(it.x, it.y, '#795548', 12);
            } else if (c.invulnerableTimer <= 0) {
              // Conked on the head!
              c.score = Math.max(0, c.score + it.points);
              c.stunTimer = 1.0;
              c.isFlipped = true;
              c.mood = 'shocked';
              c.moodTimer = 1.2;
              this.audio.playExplosion();
              this.particles.emit(c.x, c.y, 12, '#5D4037');
            }
          } else {
            const awarded = it.points * (isSuddenDeath ? 2 : 1);
            c.score += awarded;
            c.shellsCollected++;
            this.audio.playScore();
            this.particles.spawnSparks(it.x, it.y, it.color, 10);
            if (it.type === 'golden_conch') {
              c.mood = 'triumph';
              c.moodTimer = 1.4;
              this.particles.spawnConfetti(c.x, c.y, 18);
            }
          }
          this.items.splice(i, 1);
          break;
        }
      }
    }

    // Inter-Crab Bumping & Shell Shunts
    const crabsArr = Array.from(this.crabs.values());
    for (let i = 0; i < crabsArr.length; i++) {
      for (let j = i + 1; j < crabsArr.length; j++) {
        const c1 = crabsArr[i];
        const c2 = crabsArr[j];

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = c1.radius + c2.radius;

        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          c1.x -= nx * overlap * 0.5;
          c1.y -= ny * overlap * 0.5;
          c2.x += nx * overlap * 0.5;
          c2.y += ny * overlap * 0.5;

          const vRel = (c1.vx - c2.vx) * nx + (c1.vy - c2.vy) * ny;
          c1.vx -= nx * vRel * 0.7;
          c1.vy -= ny * vRel * 0.7;
          c2.vx += nx * vRel * 0.7;
          c2.vy += ny * vRel * 0.7;

          // Concussive Shell Shunts
          if (c1.isDashing && c2.invulnerableTimer <= 0) {
            c2.vx += nx * 420;
            c2.vy += ny * 350;
            c2.stunTimer = 0.9;
            c2.isFlipped = true;
            c2.mood = 'shocked';
            c2.moodTimer = 1.2;
            c1.score += 30; // Sabotage bonus
            this.audio.playExplosion();
            this.particles.spawnSparks(c2.x, c2.y, '#FF6F00', 14);

            // Knock loose shells onto the beach
            if (c2.score >= 20) {
              c2.score = Math.max(0, c2.score - 20);
              this.spawnItem(width, height);
            }
          } else if (c2.isDashing && c1.invulnerableTimer <= 0) {
            c1.vx -= nx * 420;
            c1.vy -= ny * 350;
            c1.stunTimer = 0.9;
            c1.isFlipped = true;
            c1.mood = 'shocked';
            c1.moodTimer = 1.2;
            c2.score += 30;
            this.audio.playExplosion();
            this.particles.spawnSparks(c1.x, c1.y, '#FF6F00', 14);

            if (c1.score >= 20) {
              c1.score = Math.max(0, c1.score - 20);
              this.spawnItem(width, height);
            }
          } else {
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
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

    const c = this.crabs.get(botId);
    if (!c || c.stunTimer > 0) return;

    let steerX = 0;
    let steerY = 0;
    let shouldCharge = false;

    // Find nearest falling shell/starfish
    let bestItem: FallingItem | null = null;
    let bestDist = Infinity;

    for (const it of this.items) {
      if (it.type === 'coconut' && !c.isUnderdog && difficulty !== 'bot_easy') continue;
      const d = Math.hypot(it.x - c.x, it.y - c.y);
      const weight = it.type === 'golden_conch' ? 0.4 : it.type === 'starfish' ? 0.7 : 1.0;
      const weightedDist = d * weight;
      if (weightedDist < bestDist) {
        bestDist = weightedDist;
        bestItem = it;
      }
    }

    if (bestItem) {
      const dx = bestItem.x - c.x;
      const dy = bestItem.y - c.y;
      const seekAngle = Math.atan2(dy, dx);
      steerX = Math.cos(seekAngle);
      steerY = Math.sin(seekAngle);

      if (bestDist < 110 && difficulty === 'bot_hard') {
        shouldCharge = true;
      }
    }

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      steerX = -steerX;
      steerY = -steerY;
    }

    this.input.setBotInput(botId, shouldCharge, steerX, -steerY, false);

    const delay = difficulty === 'bot_hard' ? 0.11 : difficulty === 'bot_normal' ? 0.24 : 0.42;
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const c = this.crabs.get(p.id);
      return {
        playerId: p.id,
        score: c?.score || 0
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
      ? `Crab Champion P${winnerId + 1} scuttled across the tide-line to claim victory with ${topScore} points!`
      : 'All crabs retreated into their shells in a sandy beach draw!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    // Background Gradient Sand & Ocean Shore
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.waterDeep);
    bgGrad.addColorStop(0.35, theme.waterSurf);
    bgGrad.addColorStop(0.50, theme.sandLight);
    bgGrad.addColorStop(1, theme.sandDark);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Animated Tide Surf Waves
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    for (let x = 0; x <= width; x += 20) {
      const waveY = height * 0.48 + Math.sin(this.tidePhase + x * 0.03) * 12;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.lineTo(width, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Render Falling & Ground Items
    for (const it of this.items) {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rotation);

      if (it.type === 'coconut') {
        // Heavy Spiked Coconut
        ctx.fillStyle = it.color;
        ctx.beginPath();
        ctx.arc(0, 0, it.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3E2723';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // 3 Coconut Eyes
        ctx.fillStyle = '#271202';
        ctx.beginPath();
        ctx.arc(-4, -3, 2, 0, Math.PI * 2);
        ctx.arc(4, -3, 2, 0, Math.PI * 2);
        ctx.arc(0, 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.type === 'starfish') {
        // Sugar Starfish (5 points)
        ctx.fillStyle = it.color;
        ctx.beginPath();
        for (let a = 0; a < 5; a++) {
          const outerAngle = (a * Math.PI * 2) / 5 - Math.PI / 2;
          const innerAngle = outerAngle + Math.PI / 5;
          ctx.lineTo(Math.cos(outerAngle) * it.radius, Math.sin(outerAngle) * it.radius);
          ctx.lineTo(Math.cos(innerAngle) * (it.radius * 0.45), Math.sin(innerAngle) * (it.radius * 0.45));
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (it.type === 'golden_conch') {
        // Royal Conch (Jackpot)
        ctx.fillStyle = it.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, it.radius * 1.2, it.radius * 0.7, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FF8F00';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        // Seashell
        ctx.fillStyle = it.color;
        ctx.beginPath();
        ctx.arc(0, 0, it.radius, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render Beach Crabs
    for (const c of this.crabs.values()) {
      const pConfig = this.players.find((p) => p.id === c.id);
      const pColor = pConfig ? pConfig.color : '#38BDF8';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      ctx.save();
      ctx.translate(c.x, c.y);

      // Underdog Hermit Shell Aura
      if (c.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, c.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Upside down animation when flipped
      if (c.isFlipped) {
        ctx.rotate(Math.PI);
      }

      // Articulated Crab Legs
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 3;
      for (let leg = -2; leg <= 2; leg++) {
        if (leg === 0) continue;
        const legOffY = leg * 6;
        const kick = Math.sin(c.animTimer * 12 + leg) * 6;
        // Left legs
        ctx.beginPath();
        ctx.moveTo(-12, legOffY);
        ctx.lineTo(-24, legOffY + kick);
        ctx.lineTo(-30, legOffY + kick + 8);
        ctx.stroke();
        // Right legs
        ctx.beginPath();
        ctx.moveTo(12, legOffY);
        ctx.lineTo(24, legOffY - kick);
        ctx.lineTo(30, legOffY - kick + 8);
        ctx.stroke();
      }

      // Crab Chitin Carapace Shell
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, c.radius * 1.15, c.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Big Snapping Pincers
      const clawSnip = Math.sin(c.clawSnipAnim) * 8;
      ctx.fillStyle = '#EF4444';
      // Left claw
      ctx.save();
      ctx.translate(-c.radius - 8, -8);
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-4, -6 - clawSnip * 0.5, 4, 12);
      ctx.restore();
      // Right claw
      ctx.save();
      ctx.translate(c.radius + 8, -8);
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(0, -6 - clawSnip * 0.5, 4, 12);
      ctx.restore();

      // Mascot Crab Rider
      drawCharacter(
        ctx,
        0,
        -4,
        12,
        c.id,
        isBot,
        c.mood,
        c.animTimer,
        undefined
      );

      ctx.restore();

      // Charging Gauge Ring
      if (c.isCharging) {
        const ratio = Math.min(1.0, c.chargeTime / 1.0);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.strokeStyle = ratio >= 0.72 && ratio <= 0.98 ? '#00E676' : '#FF9800';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, c.radius + 14, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * ratio);
        ctx.stroke();

        if (ratio >= 0.72 && ratio <= 0.98) {
          ctx.fillStyle = '#00E676';
          ctx.font = '900 11px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SWEET SPOT!', 0, -c.radius - 18);
        }
        ctx.restore();
      }
    }

    // Minigame Header Badge (Safe zone y: 56)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(width / 2 - 120, 56, 240, 28);
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(width / 2 - 120, 56, 240, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 13px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🦀 CRAB WALK TIDE SCUTTLE', width / 2, 75);
    ctx.restore();

    // Theme Pill at Bottom-Left (Rule compliant: x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(20, height - 44, 170, 32);
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, height - 44, 170, 32);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`[T] ${theme.name}`, 28, height - 24);
    ctx.restore();

    // Corner Player Cards safely offset to y: height - 128 (130x48px)
    const activeCrabs = Array.from(this.crabs.values());
    const cardPositions = [
      { x: 18, y: height - 128 },
      { x: width - 148, y: height - 128 },
      { x: 18, y: 88 },
      { x: width - 148, y: 88 }
    ];

    activeCrabs.forEach((c, idx) => {
      if (idx >= cardPositions.length) return;
      const pos = cardPositions[idx];
      const pConfig = this.players.find((p) => p.id === c.id);
      const pColor = pConfig ? pConfig.color : '#38BDF8';
      const pNum = typeof c.id === 'number' ? (c.id as number) + 1 : String(c.id).slice(-1);

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(pos.x, pos.y, 130, 48);
      ctx.strokeStyle = pColor;
      ctx.lineWidth = c.isUnderdog ? 3 : 1.5;
      ctx.strokeRect(pos.x, pos.y, 130, 48);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${pNum} ${c.isUnderdog ? '⭐ UNDERDOG' : 'CRAB'}`, pos.x + 8, pos.y + 18);

      ctx.fillStyle = '#FFD54F';
      ctx.font = '900 16px Montserrat, sans-serif';
      ctx.fillText(`${c.score} PTS`, pos.x + 8, pos.y + 40);

      if (c.isFlipped) {
        ctx.fillStyle = '#F44336';
        ctx.font = '11px sans-serif';
        ctx.fillText('🔄 FLIPPED', pos.x + 65, pos.y + 40);
      }
      ctx.restore();
    });
  }
}
