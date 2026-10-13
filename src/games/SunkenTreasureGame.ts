import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface SalvageCutter {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  width: number;
  height: number;
  craneAngle: number;
  craneSpeed: number;
  hookState: 'swinging' | 'dropping' | 'retracting';
  hookLength: number;
  hookX: number;
  hookY: number;
  chargeTime: number;
  isCharging: boolean;
  isOvercharged: boolean;
  shuntTimer: number;
  shuntCooldown: number;
  caughtItem: TreasureItem | null;
  score: number;
  stunTimer: number;
  invulnerableTimer: number;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface TreasureItem {
  id: number;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  type: 'gold_chest' | 'silver_bar' | 'jeweled_goblet' | 'captain_skull' | 'sea_mine';
  points: number;
  weight: number;
  color: string;
  sparkleTimer: number;
}

interface SeabedTheme {
  id: string;
  name: string;
  icon: string;
  skyColor: string;
  waterSurface: string;
  waterDeep: string;
  seabedColor: string;
  seabedTrim: string;
  cutterColor: string;
  accentColor: string;
}

const THEMES: SeabedTheme[] = [
  {
    id: 'isla_muerte',
    name: 'Isla de la Muerte 🏴‍☠️',
    icon: '🏴‍☠️',
    skyColor: '#FF7043',
    waterSurface: '#00ACC1',
    waterDeep: '#002529',
    seabedColor: '#C2B280',
    seabedTrim: '#8D6E63',
    cutterColor: '#5D4037',
    accentColor: '#FFD54F'
  },
  {
    id: 'neo_atlantis',
    name: 'Cyber Neo-Atlantis ⚡',
    icon: '⚡',
    skyColor: '#09081C',
    waterSurface: '#00E5FF',
    waterDeep: '#050D1A',
    seabedColor: '#1A237E',
    seabedTrim: '#00E5FF',
    cutterColor: '#263238',
    accentColor: '#00E5FF'
  },
  {
    id: 'ghost_triangle',
    name: 'Bermuda Ghost Triangle 👻',
    icon: '👻',
    skyColor: '#1B5E20',
    waterSurface: '#00796B',
    waterDeep: '#001A14',
    seabedColor: '#2E7D32',
    seabedTrim: '#1B5E20',
    cutterColor: '#37474F',
    accentColor: '#69F0AE'
  }
];

export class SunkenTreasureGame extends BaseGame {
  public currentMapName: string = 'Isla de la Muerte 🏴‍☠️';
  private currentThemeIdx: number = 0;

  private cutters: Map<PlayerId, SalvageCutter> = new Map();
  private treasures: TreasureItem[] = [];
  private treasureIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private wavePhase: number = 0;
  private spawnItemTimer: number = 0;

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
    this.cutters.clear();
    this.treasures = [];
    this.botReactionTimers.clear();
    this.wavePhase = 0;
    this.spawnItemTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const waterY = height * 0.22;

    active.forEach((p, idx) => {
      const step = width / (count + 1);
      const startX = step * (idx + 1);

      this.cutters.set(p.id, {
        id: p.id,
        x: startX,
        y: waterY,
        vx: 0,
        width: 74,
        height: 32,
        craneAngle: 0,
        craneSpeed: 1.9,
        hookState: 'swinging',
        hookLength: 32,
        hookX: startX,
        hookY: waterY + 32,
        chargeTime: 0,
        isCharging: false,
        isOvercharged: false,
        shuntTimer: 0,
        shuntCooldown: 0,
        caughtItem: null,
        score: 0,
        stunTimer: 0,
        invulnerableTimer: 1.0,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.25);
    });

    // Spawn rich initial seabed treasure trove
    for (let i = 0; i < 16; i++) {
      this.spawnTreasure(width, height, true);
    }
  }

  private spawnTreasure(width: number, height: number, initial: boolean = false): void {
    const roll = Math.random();
    let type: TreasureItem['type'] = 'silver_bar';
    let points = 25;
    let weight = 1.0;
    let radius = 13;
    let color = '#B0BEC5';

    if (roll < 0.24) {
      type = 'sea_mine';
      points = -20;
      weight = 1.0;
      radius = 15;
      color = '#263238';
    } else if (roll < 0.55) {
      type = 'silver_bar';
      points = 25;
      weight = 0.9;
      radius = 12;
      color = '#CFD8DC';
    } else if (roll < 0.82) {
      type = 'gold_chest';
      points = 45;
      weight = 1.4;
      radius = 17;
      color = '#FFD54F';
    } else if (roll < 0.94) {
      type = 'jeweled_goblet';
      points = 35;
      weight = 0.6;
      radius = 11;
      color = '#E040FB';
    } else {
      type = 'captain_skull';
      points = 70;
      weight = 1.1;
      radius = 18;
      color = '#FFD700';
    }

    const minX = 70;
    const maxX = width - 70;
    const x = minX + Math.random() * (maxX - minX);
    const minY = height * 0.60;
    const maxY = height * 0.88;
    const y = minY + Math.random() * (maxY - minY);

    this.treasures.push({
      id: ++this.treasureIdCounter,
      x,
      y,
      baseY: y,
      radius,
      type,
      points,
      weight,
      color,
      sparkleTimer: Math.random() * 2
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.wavePhase += dt * 3.2;

    // Periodic seabed item restocking
    this.spawnItemTimer += dt;
    if (this.spawnItemTimer > 3.0 && this.treasures.length < 18) {
      this.spawnItemTimer = 0;
      this.spawnTreasure(width, height);
    }

    // Underdog calculation
    let maxScore = -1;
    let minScore = Infinity;
    for (const c of this.cutters.values()) {
      if (c.score > maxScore) maxScore = c.score;
      if (c.score < minScore) minScore = c.score;
    }
    for (const c of this.cutters.values()) {
      c.isUnderdog = maxScore - c.score >= 35 && maxScore > 20;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    const waterY = height * 0.22;

    // Update cutters
    for (const p of active) {
      const c = this.cutters.get(p.id);
      if (!c) continue;

      c.animTimer += dt;
      if (c.stunTimer > 0) c.stunTimer -= dt;
      if (c.invulnerableTimer > 0) c.invulnerableTimer -= dt;
      if (c.shuntTimer > 0) c.shuntTimer -= dt;
      if (c.shuntCooldown > 0) c.shuntCooldown -= dt;
      if (c.moodTimer > 0) {
        c.moodTimer -= dt;
        if (c.moodTimer <= 0) c.mood = 'idle';
      }

      // Input: Lateral steering
      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      if (c.stunTimer <= 0) {
        const speed = (c.isUnderdog ? 290 : 230) * (c.isCharging ? 0.45 : 1.0);
        c.vx += (steer * speed - c.vx) * Math.min(1.0, dt * 8.5);

        // Wake particles
        if (Math.abs(c.vx) > 30 && Math.random() < 0.35) {
          this.particles.emit(c.x - Math.sign(c.vx) * 25, c.y + 12, 2, '#E0F7FA');
        }
      } else {
        c.vx *= Math.pow(0.1, dt);
      }

      c.x += c.vx * dt;
      // Clamp to screen
      const halfW = c.width * 0.5;
      if (c.x < halfW + 15) {
        c.x = halfW + 15;
        c.vx = 0;
      }
      if (c.x > width - halfW - 15) {
        c.x = width - halfW - 15;
        c.vx = 0;
      }

      // Floating bobbing
      c.y = waterY + Math.sin(this.wavePhase + c.x * 0.02) * 4;

      // Winch Mechanics: Hold to charge pressure, release to launch
      if (c.hookState === 'swinging') {
        c.craneAngle += c.craneSpeed * dt * (c.isUnderdog ? 1.25 : 1.0);
        const maxAngle = Math.PI * 0.38;
        if (c.craneAngle > maxAngle || c.craneAngle < -maxAngle) {
          c.craneSpeed = -c.craneSpeed;
          c.craneAngle = Math.sign(c.craneAngle) * maxAngle;
        }

        if (c.stunTimer <= 0) {
          if (isAction) {
            c.isCharging = true;
            c.chargeTime += dt;
            c.mood = 'focused';
            // Boiler sparks
            if (Math.random() < 0.25) {
              this.particles.spawnSparks(c.x - 14, c.y - 12, '#FF9800', 2);
            }
          } else if (c.isCharging) {
            // Releasing the charge
            const maxCharge = 1.0;
            const ratio = Math.min(1.0, c.chargeTime / maxCharge);
            const isSweet = ratio >= 0.72 && ratio <= 0.98;

            c.isCharging = false;
            c.chargeTime = 0;
            c.hookState = 'dropping';
            c.isOvercharged = isSweet;

            if (isSweet) {
              this.audio.playExplosion();
              this.particles.spawnConfetti(c.x, c.y + 20, 16);
              c.mood = 'triumph';
              c.moodTimer = 1.2;
            } else {
              this.audio.playTap();
            }

            // Also check for Ram Shunt launch
            if (Math.abs(c.vx) > 80 && c.shuntCooldown <= 0) {
              c.shuntTimer = 0.45;
              c.shuntCooldown = 1.2;
            }
          }
        }

        c.hookLength = 32;
        c.hookX = c.x + Math.sin(c.craneAngle) * c.hookLength;
        c.hookY = c.y + Math.cos(c.craneAngle) * c.hookLength;
      } else if (c.hookState === 'dropping') {
        const dropSpeed = (c.isOvercharged ? 650 : 360) * (c.isUnderdog ? 1.25 : 1.0);
        c.hookLength += dropSpeed * dt;
        c.hookX = c.x + Math.sin(c.craneAngle) * c.hookLength;
        c.hookY = c.y + Math.cos(c.craneAngle) * c.hookLength;

        // Dropping bubble wake
        if (Math.random() < 0.4) {
          this.particles.emit(c.hookX, c.hookY, 1, '#80DEEA');
        }

        // Check collision with treasures
        for (let i = this.treasures.length - 1; i >= 0; i--) {
          const item = this.treasures[i];
          const reach = item.radius + (c.isUnderdog ? 22 : 12);
          if (Math.hypot(c.hookX - item.x, c.hookY - item.y) < reach) {
            c.caughtItem = item;
            c.hookState = 'retracting';
            this.treasures.splice(i, 1);
            this.audio.playBounce();
            this.particles.spawnSparks(c.hookX, c.hookY, item.color, 8);
            break;
          }
        }

        // Reached seabed or maximum line
        if (c.hookY > height * 0.91 || c.hookLength > height * 0.85) {
          c.hookState = 'retracting';
          this.particles.spawnSparks(c.hookX, c.hookY, '#C2B280', 6);
        }
      } else if (c.hookState === 'retracting') {
        const baseRetract = c.isOvercharged ? 520 : 340;
        const weightMod = c.caughtItem ? Math.max(0.6, c.caughtItem.weight) : 1.0;
        const pullSpeed = (baseRetract / weightMod) * (c.isUnderdog ? 1.3 : 1.0);

        c.hookLength = Math.max(32, c.hookLength - pullSpeed * dt);
        c.hookX = c.x + Math.sin(c.craneAngle) * c.hookLength;
        c.hookY = c.y + Math.cos(c.craneAngle) * c.hookLength;

        if (c.hookLength <= 32) {
          // Hauled item brought onto deck!
          if (c.caughtItem) {
            if (c.caughtItem.type === 'sea_mine') {
              if (c.isUnderdog) {
                // Deflector shield prevents damage!
                this.audio.playBounce();
                this.particles.spawnConfetti(c.x, c.y - 15, 12);
              } else {
                c.score = Math.max(0, c.score + c.caughtItem.points);
                c.stunTimer = 1.3;
                c.mood = 'shocked';
                c.moodTimer = 1.4;
                this.audio.playExplosion();
                this.particles.emit(c.x, c.y, 16, '#37474F');
                this.particles.spawnSparks(c.x, c.y, '#FF5722', 14);
              }
            } else {
              const suddenMult = this.roundTimer <= 15 ? 2 : 1;
              const awarded = c.caughtItem.points * suddenMult;
              c.score += awarded;
              c.mood = 'triumph';
              c.moodTimer = 1.3;
              this.audio.playScore();
              this.particles.spawnConfetti(c.x, c.y - 15, 20);
            }
            c.caughtItem = null;
          }
          c.hookState = 'swinging';
          c.isOvercharged = false;
        }
      }
    }

    // Physical Cutter-to-Cutter Collision & Winch Sabotage Shunts
    const cuttersArr = Array.from(this.cutters.values());
    for (let i = 0; i < cuttersArr.length; i++) {
      for (let j = i + 1; j < cuttersArr.length; j++) {
        const c1 = cuttersArr[i];
        const c2 = cuttersArr[j];

        const dx = c2.x - c1.x;
        const minDist = (c1.width + c2.width) * 0.48;

        if (Math.abs(dx) < minDist) {
          const overlap = minDist - Math.abs(dx);
          const sign = Math.sign(dx) || 1;

          // Push apart
          c1.x -= sign * overlap * 0.5;
          c2.x += sign * overlap * 0.5;

          // Swap velocities with elasticity
          const vRel = c1.vx - c2.vx;
          c1.vx -= vRel * 0.6;
          c2.vx += vRel * 0.6;

          // Concussive Shunt detection
          if (c1.shuntTimer > 0 && c2.invulnerableTimer <= 0) {
            c2.vx += sign * 380;
            c2.stunTimer = 0.85;
            c2.mood = 'shocked';
            c2.moodTimer = 1.2;
            c1.score += 30; // Sabotage bonus
            this.audio.playExplosion();
            this.particles.spawnSparks(c2.x, c2.y, '#FF9800', 12);

            // Steal hauled item if rival is currently retracting!
            if (c2.caughtItem && c2.hookState === 'retracting' && !c1.caughtItem) {
              c1.caughtItem = c2.caughtItem;
              c2.caughtItem = null;
              c1.hookState = 'retracting';
              c1.hookLength = c2.hookLength;
              c2.hookState = 'swinging';
              this.audio.playScore();
              this.particles.spawnConfetti(c1.x, c1.y, 16);
            }
          } else if (c2.shuntTimer > 0 && c1.invulnerableTimer <= 0) {
            c1.vx -= sign * 380;
            c1.stunTimer = 0.85;
            c1.mood = 'shocked';
            c1.moodTimer = 1.2;
            c2.score += 30;
            this.audio.playExplosion();
            this.particles.spawnSparks(c1.x, c1.y, '#FF9800', 12);

            if (c1.caughtItem && c1.hookState === 'retracting' && !c2.caughtItem) {
              c2.caughtItem = c1.caughtItem;
              c1.caughtItem = null;
              c2.hookState = 'retracting';
              c2.hookLength = c1.hookLength;
              c1.hookState = 'swinging';
              this.audio.playScore();
              this.particles.spawnConfetti(c2.x, c2.y, 16);
            }
          } else {
            this.audio.playBounce();
            this.particles.emit((c1.x + c2.x) / 2, waterY, 4, '#E0F7FA');
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
    width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const c = this.cutters.get(botId);
    if (!c || c.stunTimer > 0) return;

    let steerVal = 0;
    let shouldCharge = false;

    // Find best target treasure
    let bestTreasure: TreasureItem | null = null;
    let bestDist = Infinity;

    for (const t of this.treasures) {
      if (t.type === 'sea_mine' && difficulty !== 'bot_easy') continue;
      const dist = Math.abs(t.x - c.x);
      const scoreWeight = t.points > 40 ? 0.6 : 1.0;
      const weightedDist = dist * scoreWeight;
      if (weightedDist < bestDist) {
        bestDist = weightedDist;
        bestTreasure = t;
      }
    }

    if (bestTreasure) {
      const dx = bestTreasure.x - c.x;
      if (Math.abs(dx) > 18) {
        steerVal = Math.sign(dx);
      }

      // Check alignment with crane angle
      const dy = bestTreasure.y - c.y;
      const desiredAngle = Math.atan2(dx, dy);
      const angleDiff = Math.abs(c.craneAngle - desiredAngle);

      if (c.hookState === 'swinging') {
        if (!c.isCharging && angleDiff < 0.22) {
          shouldCharge = true;
        } else if (c.isCharging) {
          const targetHold = difficulty === 'bot_hard' ? 0.84 : 0.65;
          if (c.chargeTime < targetHold) {
            shouldCharge = true;
          } else {
            shouldCharge = false;
          }
        }
      }
    }

    // Easy bot error injection
    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      steerVal = -steerVal;
      shouldCharge = Math.random() < 0.5;
    }

    this.input.setBotInput(botId, shouldCharge, steerVal, 0, false);

    const delay = difficulty === 'bot_hard' ? 0.11 : difficulty === 'bot_normal' ? 0.24 : 0.42;
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const c = this.cutters.get(p.id);
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

    const mvpHighlight = winnerId !== null
      ? `Captain P${winnerId + 1} salvaged the sunken depths with ${scores[0].score} points of pirate doubloons!`
      : 'The murky shipwreck claim ended in an all-out salvage stalemate!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    // Sky Backdrop
    ctx.fillStyle = theme.skyColor;
    ctx.fillRect(0, 0, width, height * 0.22);

    // Dynamic Clouds / Sunset Glimmer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(width * 0.25, height * 0.1, 48, 0, Math.PI * 2);
    ctx.arc(width * 0.28, height * 0.08, 60, 0, Math.PI * 2);
    ctx.arc(width * 0.75, height * 0.12, 54, 0, Math.PI * 2);
    ctx.fill();

    // Ocean Depth Gradient
    const waterGrad = ctx.createLinearGradient(0, height * 0.22, 0, height);
    waterGrad.addColorStop(0, theme.waterSurface);
    waterGrad.addColorStop(0.35, '#006064');
    waterGrad.addColorStop(1, theme.waterDeep);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, height * 0.22, width, height * 0.78);

    // Caustic light rays
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 26;
    for (let i = 0; i < width; i += 120) {
      ctx.beginPath();
      ctx.moveTo(i, height * 0.22);
      ctx.lineTo(i + Math.sin(this.wavePhase + i) * 60 - 80, height);
      ctx.stroke();
    }
    ctx.restore();

    // Seabed Reef
    ctx.fillStyle = theme.seabedColor;
    ctx.fillRect(0, height * 0.90, width, height * 0.10);
    ctx.fillStyle = theme.seabedTrim;
    ctx.fillRect(0, height * 0.90, width, 8);

    // Sunken Shipwreck Galleon Silhouette in Background
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.moveTo(width * 0.35, height * 0.90);
    ctx.lineTo(width * 0.38, height * 0.78);
    ctx.lineTo(width * 0.52, height * 0.76);
    ctx.lineTo(width * 0.56, height * 0.90);
    ctx.fill();
    // Mast
    ctx.fillRect(width * 0.44, height * 0.68, 6, height * 0.22);
    ctx.fillRect(width * 0.41, height * 0.72, 32, 4);
    ctx.restore();

    // Render seabed treasures
    for (const t of this.treasures) {
      ctx.save();
      ctx.translate(t.x, t.y);

      // Glow aura
      if (t.type !== 'sea_mine') {
        ctx.fillStyle = t.color;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(0, 0, t.radius + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      if (t.type === 'sea_mine') {
        // Spiked explosive naval mine
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        ctx.fill();
        // Red flashing detonator
        ctx.fillStyle = Math.sin(this.wavePhase * 4) > 0 ? '#F44336' : '#B71C1C';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        // Spikes
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 3;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (t.radius - 2), Math.sin(a) * (t.radius - 2));
          ctx.lineTo(Math.cos(a) * (t.radius + 7), Math.sin(a) * (t.radius + 7));
          ctx.stroke();
        }
      } else if (t.type === 'gold_chest') {
        // Golden pirate treasure chest
        ctx.fillStyle = '#8D6E63';
        ctx.fillRect(-t.radius, -t.radius * 0.7, t.radius * 2, t.radius * 1.4);
        ctx.fillStyle = '#FFD54F';
        ctx.fillRect(-t.radius, -t.radius * 0.7, t.radius * 2, 4);
        ctx.fillRect(-t.radius * 0.2, -t.radius * 0.2, t.radius * 0.4, 6);
        ctx.strokeStyle = '#FFB300';
        ctx.lineWidth = 2;
        ctx.strokeRect(-t.radius, -t.radius * 0.7, t.radius * 2, t.radius * 1.4);
      } else if (t.type === 'silver_bar') {
        // Silver ingot
        ctx.fillStyle = '#CFD8DC';
        ctx.fillRect(-t.radius, -t.radius * 0.5, t.radius * 2, t.radius);
        ctx.strokeStyle = '#90A4AE';
        ctx.lineWidth = 2;
        ctx.strokeRect(-t.radius, -t.radius * 0.5, t.radius * 2, t.radius);
      } else if (t.type === 'jeweled_goblet') {
        // Royal Chalice
        ctx.fillStyle = '#E040FB';
        ctx.beginPath();
        ctx.arc(0, -t.radius * 0.3, t.radius * 0.8, 0, Math.PI);
        ctx.lineTo(0, t.radius * 0.6);
        ctx.fill();
        ctx.fillRect(-t.radius * 0.5, t.radius * 0.6, t.radius, 3);
      } else if (t.type === 'captain_skull') {
        // Jackpot Golden Skull
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, -2, t.radius * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-t.radius * 0.4, t.radius * 0.2, t.radius * 0.8, 6);
        // Eye sockets
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.arc(-4, -2, 3, 0, Math.PI * 2);
        ctx.arc(4, -2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Surface Wave Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 15) {
      const y = height * 0.22 + Math.sin(this.wavePhase + x * 0.02) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Render Cutters & Winch Lines
    for (const c of this.cutters.values()) {
      const pConfig = this.players.find((p) => p.id === c.id);
      const pColor = pConfig ? pConfig.color : '#38BDF8';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      ctx.save();
      ctx.translate(c.x, c.y);

      // Underdog Kraken Aura
      if (c.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.ellipse(0, 4, c.width * 0.65, 24, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Shunt Boost Rooster Tail
      if (c.shuntTimer > 0) {
        ctx.fillStyle = 'rgba(255, 152, 0, 0.6)';
        ctx.beginPath();
        ctx.moveTo(-c.width * 0.5, 4);
        ctx.lineTo(-c.width * 0.8, -12);
        ctx.lineTo(-c.width * 0.5, 14);
        ctx.fill();
      }

      // 2.5D Wooden Cutter Hull
      ctx.fillStyle = theme.cutterColor;
      ctx.beginPath();
      ctx.moveTo(-c.width * 0.5, 0);
      ctx.lineTo(-c.width * 0.4, 16);
      ctx.lineTo(c.width * 0.38, 16);
      ctx.lineTo(c.width * 0.52, 2);
      ctx.lineTo(c.width * 0.42, -4);
      ctx.closePath();
      ctx.fill();

      // Colored Racing Stripe
      ctx.fillStyle = pColor;
      ctx.fillRect(-c.width * 0.38, 2, c.width * 0.78, 6);

      // Boiler Chimney with Steam
      ctx.fillStyle = '#263238';
      ctx.fillRect(-c.width * 0.3, -16, 10, 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(-c.width * 0.3 + 5, -22, 6 + Math.sin(c.animTimer * 6) * 2, 0, Math.PI * 2);
      ctx.fill();

      // Winch Crane Tower
      ctx.fillStyle = '#37474F';
      ctx.fillRect(8, -20, 8, 20);
      ctx.strokeStyle = '#78909C';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, -20, 8, 20);

      // Mascot Captain at the Helm
      drawCharacter(
        ctx,
        -6,
        -14,
        13,
        c.id,
        isBot,
        c.mood,
        c.animTimer,
        undefined
      );

      // Steam Pressure Charging Ring
      if (c.isCharging) {
        const ratio = Math.min(1.0, c.chargeTime / 1.0);
        ctx.strokeStyle = ratio >= 0.72 && ratio <= 0.98 ? '#00E676' : '#FF9800';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(12, -18, 22, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * ratio);
        ctx.stroke();

        if (ratio >= 0.72 && ratio <= 0.98) {
          ctx.fillStyle = '#00E676';
          ctx.font = '900 11px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SWEET SPOT!', 0, -32);
        }
      }

      ctx.restore();

      // Render Winch Line & Claw Hook
      ctx.save();
      const craneAnchorX = c.x + 12;
      const craneAnchorY = c.y - 18;

      ctx.strokeStyle = c.isOvercharged ? '#00E676' : '#B0BEC5';
      ctx.lineWidth = c.isOvercharged ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(craneAnchorX, craneAnchorY);
      ctx.lineTo(c.hookX, c.hookY);
      ctx.stroke();

      // Claw Hook Head
      ctx.save();
      ctx.translate(c.hookX, c.hookY);
      ctx.fillStyle = c.isOvercharged ? '#00E676' : '#ECEFF1';
      ctx.beginPath();
      ctx.arc(0, 0, c.isUnderdog ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Prongs
      ctx.strokeStyle = c.isOvercharged ? '#00E676' : '#90A4AE';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-5, 4, 6, Math.PI * 0.5, Math.PI * 1.2);
      ctx.arc(5, 4, 6, -Math.PI * 0.2, Math.PI * 0.5);
      if (c.isUnderdog) {
        ctx.arc(0, 6, 7, Math.PI * 0.3, Math.PI * 0.7);
      }
      ctx.stroke();

      // If carrying a hooked item
      if (c.caughtItem) {
        ctx.save();
        ctx.translate(0, 14);
        ctx.fillStyle = c.caughtItem.color;
        ctx.beginPath();
        ctx.arc(0, 0, c.caughtItem.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      ctx.restore();
    }

    // Minigame Header Badge (Safe zone y: 56)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(width / 2 - 120, 56, 240, 28);
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(width / 2 - 120, 56, 240, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 13px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏴‍☠️ SUNKEN TREASURE SALVAGE', width / 2, 75);
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
    const activeCutters = Array.from(this.cutters.values());
    const cardPositions = [
      { x: 18, y: height - 128 },
      { x: width - 148, y: height - 128 },
      { x: 18, y: 88 },
      { x: width - 148, y: 88 }
    ];

    activeCutters.forEach((c, idx) => {
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
      ctx.fillText(`P${pNum} ${c.isUnderdog ? '⭐ UNDERDOG' : 'SALVAGER'}`, pos.x + 8, pos.y + 18);

      ctx.fillStyle = '#FFD54F';
      ctx.font = '900 16px Montserrat, sans-serif';
      ctx.fillText(`${c.score} PTS`, pos.x + 8, pos.y + 40);

      // Mini status icon
      if (c.stunTimer > 0) {
        ctx.fillStyle = '#F44336';
        ctx.font = '11px sans-serif';
        ctx.fillText('💥 STUN', pos.x + 80, pos.y + 40);
      }
      ctx.restore();
    });
  }
}
