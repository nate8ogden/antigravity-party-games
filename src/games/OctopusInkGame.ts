import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface SubmersiblePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  chargeTime: number;
  isCharging: boolean;
  isBoosting: boolean;
  boostTimer: number;
  shuntCooldown: number;
  stunTimer: number;
  invulnerableTimer: number;
  inkBlindTimer: number;
  score: number;
  tentaclesSevered: number;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface PlanktonOrb {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: 'plankton' | 'nautilus' | 'kraken_pearl';
  points: number;
  color: string;
  wobble: number;
}

interface InkPuff {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

interface KrakenTheme {
  id: string;
  name: string;
  icon: string;
  bgDark: string;
  bgLight: string;
  vortexRing: string;
  krakenBody: string;
  krakenTentacle: string;
  accentColor: string;
}

const THEMES: KrakenTheme[] = [
  {
    id: 'mariana_maelstrom',
    name: 'Mariana Maelstrom 🐙',
    icon: '🐙',
    bgDark: '#001A24',
    bgLight: '#00364A',
    vortexRing: '#00E5FF',
    krakenBody: '#7B1FA2',
    krakenTentacle: '#9C27B0',
    accentColor: '#00E5FF'
  },
  {
    id: 'cyber_trench',
    name: 'Cyber Leviathan ⚡',
    icon: '⚡',
    bgDark: '#0A081D',
    bgLight: '#181636',
    vortexRing: '#00E5FF',
    krakenBody: '#263238',
    krakenTentacle: '#37474F',
    accentColor: '#FFD700'
  },
  {
    id: 'magma_caldera',
    name: 'Molten Caldera 🔥',
    icon: '🔥',
    bgDark: '#1A0500',
    bgLight: '#3D0D00',
    vortexRing: '#FF5722',
    krakenBody: '#BF360C',
    krakenTentacle: '#D84315',
    accentColor: '#FFAB00'
  }
];

export class OctopusInkGame extends BaseGame {
  public currentMapName: string = 'Mariana Maelstrom 🐙';
  private currentThemeIdx: number = 0;

  private subs: Map<PlayerId, SubmersiblePlayer> = new Map();
  private orbs: PlanktonOrb[] = [];
  private inkPuffs: InkPuff[] = [];
  private orbIdCounter: number = 0;
  private puffIdCounter: number = 0;

  private krakenRotation: number = 0;
  private tentacleSway: number = 0;
  private tentacleHitCooldowns: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private spawnOrbTimer: number = 0;
  private inkSpewTimer: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;

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
    this.roundTimer = 38.0;
    this.isFinished = false;
    this.subs.clear();
    this.orbs = [];
    this.inkPuffs = [];
    this.botReactionTimers.clear();
    this.krakenRotation = 0;
    this.tentacleSway = 0;
    this.spawnOrbTimer = 0.5;
    this.inkSpewTimer = 2.0;

    const active = this.getActivePlayers();
    const count = active.length;
    const cx = width * 0.5;
    const cy = height * 0.52;
    const spawnRadius = Math.min(width, height) * 0.38;

    active.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      const x = cx + Math.cos(angle) * spawnRadius;
      const y = cy + Math.sin(angle) * spawnRadius;

      this.subs.set(p.id, {
        id: p.id,
        x,
        y,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        radius: 20,
        chargeTime: 0,
        isCharging: false,
        isBoosting: false,
        boostTimer: 0,
        shuntCooldown: 0,
        stunTimer: 0,
        invulnerableTimer: 1.0,
        inkBlindTimer: 0,
        score: 0,
        tentaclesSevered: 0,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.25);
    });

    for (let i = 0; i < 14; i++) {
      this.spawnOrb(width, height);
    }
  }

  private spawnOrb(width: number, height: number): void {
    const cx = width * 0.5;
    const cy = height * 0.52;
    const minR = 75;
    const maxR = Math.min(width, height) * 0.44;

    const angle = Math.random() * Math.PI * 2;
    const dist = minR + Math.random() * (maxR - minR);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;

    const roll = Math.random();
    let type: PlanktonOrb['type'] = 'plankton';
    let points = 20;
    let radius = 10;
    let color = '#00E5FF';

    if (roll < 0.28) {
      type = 'nautilus';
      points = 35;
      radius = 13;
      color = '#FFD54F';
    } else if (roll < 0.42) {
      type = 'kraken_pearl';
      points = 55;
      radius = 15;
      color = '#E040FB';
    }

    this.orbs.push({
      id: ++this.orbIdCounter,
      x,
      y,
      radius,
      type,
      points,
      color,
      wobble: Math.random() * Math.PI * 2
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    const isSuddenDeath = this.roundTimer <= 15.0;

    const rotSpeed = isSuddenDeath ? 0.95 : 0.55;
    this.krakenRotation += dt * rotSpeed;
    this.tentacleSway += dt * 4.5;

    for (let i = 0; i < this.tentacleHitCooldowns.length; i++) {
      if (this.tentacleHitCooldowns[i] > 0) this.tentacleHitCooldowns[i] -= dt;
    }

    // Periodic orb spawning
    this.spawnOrbTimer += dt;
    if (this.spawnOrbTimer > (isSuddenDeath ? 1.5 : 2.5) && this.orbs.length < 18) {
      this.spawnOrbTimer = 0;
      this.spawnOrb(width, height);
    }

    // Periodic kraken ink spew
    this.inkSpewTimer += dt;
    const spewInterval = isSuddenDeath ? 2.5 : 4.0;
    if (this.inkSpewTimer > spewInterval) {
      this.inkSpewTimer = 0;
      this.spewKrakenInk(width, height);
    }

    // Update ink puffs
    for (let i = this.inkPuffs.length - 1; i >= 0; i--) {
      const puff = this.inkPuffs[i];
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.radius = Math.min(puff.maxRadius, puff.radius + dt * 25);
      puff.life -= dt;
      if (puff.life <= 0) {
        this.inkPuffs.splice(i, 1);
      }
    }

    // Underdog calculation
    let maxScore = -1;
    for (const s of this.subs.values()) {
      if (s.score > maxScore) maxScore = s.score;
    }
    for (const s of this.subs.values()) {
      s.isUnderdog = maxScore - s.score >= 35 && maxScore > 20;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    const cx = width * 0.5;
    const cy = height * 0.52;

    // Update subs
    for (const p of active) {
      const s = this.subs.get(p.id);
      if (!s) continue;

      s.animTimer += dt;
      if (s.stunTimer > 0) s.stunTimer -= dt;
      if (s.invulnerableTimer > 0) s.invulnerableTimer -= dt;
      if (s.inkBlindTimer > 0) s.inkBlindTimer -= dt;
      if (s.shuntCooldown > 0) s.shuntCooldown -= dt;
      if (s.moodTimer > 0) {
        s.moodTimer -= dt;
        if (s.moodTimer <= 0) s.mood = 'idle';
      }

      // Whirlpool vortex pull
      const toCenterX = cx - s.x;
      const toCenterY = cy - s.y;
      const centerDist = Math.hypot(toCenterX, toCenterY) || 1;
      const vortexPull = (65 + (isSuddenDeath ? 35 : 0)) * (1.0 - Math.min(1.0, centerDist / 350));
      s.vx += (toCenterX / centerDist) * vortexPull * dt;
      s.vy += (toCenterY / centerDist) * vortexPull * dt;

      // Tangential vortex swirl
      const swirlDirX = -toCenterY / centerDist;
      const swirlDirY = toCenterX / centerDist;
      s.vx += swirlDirX * 45 * dt;
      s.vy += swirlDirY * 45 * dt;

      // Controls
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      if (s.stunTimer <= 0) {
        const hasInput = Math.hypot(steer, throttle) > 0.15;
        if (hasInput) {
          const moveAngle = Math.atan2(-throttle, steer);
          s.angle = moveAngle;

          const baseSpeed = s.isUnderdog ? 260 : 210;
          const targetVx = Math.cos(moveAngle) * baseSpeed;
          const targetVy = Math.sin(moveAngle) * baseSpeed;

          s.vx += (targetVx - s.vx) * Math.min(1.0, dt * 7.5);
          s.vy += (targetVy - s.vy) * Math.min(1.0, dt * 7.5);

          // Propeller cavitation bubbles
          if (Math.random() < 0.3) {
            this.particles.emit(s.x - Math.cos(s.angle) * 16, s.y - Math.sin(s.angle) * 16, 2, '#80DEEA');
          }
        } else {
          s.vx *= Math.pow(0.4, dt);
          s.vy *= Math.pow(0.4, dt);
        }

        // Hold-to-Charge Hydro-Torpedo Dash
        if (isAction) {
          s.isCharging = true;
          s.chargeTime += dt;
          s.mood = 'focused';
          if (Math.random() < 0.25) {
            this.particles.spawnSparks(s.x, s.y, '#00E5FF', 2);
          }
        } else if (s.isCharging) {
          // Unleash Dash
          const ratio = Math.min(1.0, s.chargeTime / 1.0);
          const isSweet = ratio >= 0.72 && ratio <= 0.98;

          s.isCharging = false;
          s.chargeTime = 0;
          s.isBoosting = true;
          s.boostTimer = isSweet ? 0.55 : 0.35;

          const boostMag = (isSweet ? 460 : 340) * (s.isUnderdog ? 1.25 : 1.0);
          s.vx = Math.cos(s.angle) * boostMag;
          s.vy = Math.sin(s.angle) * boostMag;

          if (isSweet) {
            this.audio.playExplosion();
            this.particles.spawnConfetti(s.x, s.y, 16);
            s.mood = 'triumph';
            s.moodTimer = 1.2;
          } else {
            this.audio.playBounce();
          }
        }
      } else {
        s.vx *= Math.pow(0.1, dt);
        s.vy *= Math.pow(0.1, dt);
      }

      if (s.boostTimer > 0) {
        s.boostTimer -= dt;
        if (s.boostTimer <= 0) s.isBoosting = false;
        // Torpedo bubble wake
        this.particles.emit(s.x - Math.cos(s.angle) * 18, s.y - Math.sin(s.angle) * 18, 3, '#00E5FF');
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Arena boundary clamp
      const maxArenaR = Math.min(width, height) * 0.46;
      const curDist = Math.hypot(s.x - cx, s.y - cy);
      if (curDist > maxArenaR) {
        const nx = (s.x - cx) / curDist;
        const ny = (s.y - cy) / curDist;
        s.x = cx + nx * maxArenaR;
        s.y = cy + ny * maxArenaR;
        s.vx -= nx * 140;
        s.vy -= ny * 140;
      }

      // Collect plankton orbs
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const orb = this.orbs[i];
        const reach = s.radius + orb.radius + (s.isBoosting ? 14 : 0);
        if (Math.hypot(s.x - orb.x, s.y - orb.y) < reach) {
          const awarded = orb.points * (isSuddenDeath ? 2 : 1);
          s.score += awarded;
          this.orbs.splice(i, 1);
          this.audio.playScore();
          this.particles.spawnSparks(orb.x, orb.y, orb.color, 10);
          if (orb.type === 'kraken_pearl') {
            s.mood = 'triumph';
            s.moodTimer = 1.3;
            this.particles.spawnConfetti(s.x, s.y, 16);
          }
          break;
        }
      }

      // Ink puff collision
      for (const puff of this.inkPuffs) {
        if (Math.hypot(s.x - puff.x, s.y - puff.y) < s.radius + puff.radius) {
          if (!s.isUnderdog && s.inkBlindTimer <= 0) {
            s.inkBlindTimer = 2.2;
            s.score = Math.max(0, s.score - 15);
            s.mood = 'shocked';
            s.moodTimer = 1.4;
            this.audio.playExplosion();
            this.particles.emit(s.x, s.y, 12, '#212121');
          }
        }
      }

      // Tentacle collisions & slashing
      const tentacleCount = 8;
      const tentacleLength = Math.min(width, height) * 0.38;
      for (let tIdx = 0; tIdx < tentacleCount; tIdx++) {
        if (this.tentacleHitCooldowns[tIdx] > 0) continue;
        const baseAngle = this.krakenRotation + (tIdx / tentacleCount) * Math.PI * 2;
        const tipX = cx + Math.cos(baseAngle) * tentacleLength;
        const tipY = cy + Math.sin(baseAngle) * tentacleLength;

        // Check line distance from sub to tentacle
        const d = this.distToSegment(s.x, s.y, cx, cy, tipX, tipY);
        if (d < s.radius + 18) {
          if (s.isBoosting) {
            // Torpedo cuts right through the tentacle!
            this.tentacleHitCooldowns[tIdx] = 2.5; // severed temporarily
            s.score += 40; // Sever bonus
            s.tentaclesSevered++;
            s.mood = 'triumph';
            s.moodTimer = 1.2;
            this.audio.playScore();
            this.particles.spawnConfetti((s.x + tipX) * 0.5, (s.y + tipY) * 0.5, 18);
          } else if (s.invulnerableTimer <= 0) {
            // Slapped by tentacle!
            const awayX = s.x - cx;
            const awayY = s.y - cy;
            const mag = Math.hypot(awayX, awayY) || 1;
            s.vx = (awayX / mag) * 360;
            s.vy = (awayY / mag) * 360;
            s.stunTimer = 0.9;
            s.mood = 'shocked';
            s.moodTimer = 1.2;
            s.score = Math.max(0, s.score - 10);
            this.audio.playBounce();
            this.particles.spawnSparks(s.x, s.y, '#9C27B0', 12);
          }
        }
      }
    }

    // Inter-Submersible Bumper Collisions & Shunts
    const subsArr = Array.from(this.subs.values());
    for (let i = 0; i < subsArr.length; i++) {
      for (let j = i + 1; j < subsArr.length; j++) {
        const s1 = subsArr[i];
        const s2 = subsArr[j];

        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = s1.radius + s2.radius;

        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          s1.x -= nx * overlap * 0.5;
          s1.y -= ny * overlap * 0.5;
          s2.x += nx * overlap * 0.5;
          s2.y += ny * overlap * 0.5;

          // Swap velocities
          const vRel = (s1.vx - s2.vx) * nx + (s1.vy - s2.vy) * ny;
          s1.vx -= nx * vRel * 0.8;
          s1.vy -= ny * vRel * 0.8;
          s2.vx += nx * vRel * 0.8;
          s2.vy += ny * vRel * 0.8;

          // Concussive Shunt Detection
          if (s1.isBoosting && s2.invulnerableTimer <= 0) {
            s2.vx += nx * 400;
            s2.vy += ny * 400;
            s2.stunTimer = 0.85;
            s2.mood = 'shocked';
            s2.moodTimer = 1.2;
            s1.score += 30; // Sabotage bonus
            this.audio.playExplosion();
            this.particles.spawnSparks(s2.x, s2.y, '#FF9800', 14);
          } else if (s2.isBoosting && s1.invulnerableTimer <= 0) {
            s1.vx -= nx * 400;
            s1.vy -= ny * 400;
            s1.stunTimer = 0.85;
            s1.mood = 'shocked';
            s1.moodTimer = 1.2;
            s2.score += 30;
            this.audio.playExplosion();
            this.particles.spawnSparks(s1.x, s1.y, '#FF9800', 14);
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

  private spewKrakenInk(width: number, height: number): void {
    const cx = width * 0.5;
    const cy = height * 0.52;
    this.audio.playExplosion();

    for (let i = 0; i < 4; i++) {
      const angle = this.krakenRotation + (i / 4) * Math.PI * 2;
      const speed = 90 + Math.random() * 50;
      this.inkPuffs.push({
        id: ++this.puffIdCounter,
        x: cx + Math.cos(angle) * 45,
        y: cy + Math.sin(angle) * 45,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 18,
        maxRadius: 48,
        life: 4.5,
        maxLife: 4.5
      });
    }
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const s = this.subs.get(botId);
    if (!s || s.stunTimer > 0) return;

    const cx = width * 0.5;
    const cy = height * 0.52;

    let steerX = 0;
    let steerY = 0;
    let shouldCharge = false;

    // Check danger: too close to center
    const centerDist = Math.hypot(s.x - cx, s.y - cy);
    if (centerDist < 95) {
      // Flee outwards!
      const awayAngle = Math.atan2(s.y - cy, s.x - cx);
      steerX = Math.cos(awayAngle);
      steerY = Math.sin(awayAngle);
      shouldCharge = true;
    } else {
      // Target nearest high-value orb
      let bestOrb: PlanktonOrb | null = null;
      let bestDist = Infinity;

      for (const orb of this.orbs) {
        const d = Math.hypot(orb.x - s.x, orb.y - s.y);
        const weight = orb.points > 30 ? 0.7 : 1.0;
        const weightedDist = d * weight;
        if (weightedDist < bestDist) {
          bestDist = weightedDist;
          bestOrb = orb;
        }
      }

      if (bestOrb) {
        const dx = bestOrb.x - s.x;
        const dy = bestOrb.y - s.y;
        const seekAngle = Math.atan2(dy, dx);
        steerX = Math.cos(seekAngle);
        steerY = Math.sin(seekAngle);

        if (bestDist < 120 && difficulty === 'bot_hard') {
          shouldCharge = true;
        }
      }
    }

    // Blunder on Easy
    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      steerX = -steerX;
      steerY = -steerY;
    }

    this.input.setBotInput(botId, shouldCharge, steerX, -steerY, false);

    const delay = difficulty === 'bot_hard' ? 0.11 : difficulty === 'bot_normal' ? 0.23 : 0.42;
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const s = this.subs.get(p.id);
      return {
        playerId: p.id,
        score: s?.score || 0
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
      ? `Captain P${winnerId + 1} conquered the abyssal kraken whirlpool with ${topScore} points!`
      : 'All bathyspheres were consumed in the swirling kraken whirlpool!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];
    const cx = width * 0.5;
    const cy = height * 0.52;

    // Background Gradient Abyss
    const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, width * 0.6);
    bgGrad.addColorStop(0, theme.bgLight);
    bgGrad.addColorStop(1, theme.bgDark);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Swirling Whirlpool Rings
    ctx.save();
    ctx.strokeStyle = theme.vortexRing;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.25;
    for (let r = 50; r < Math.min(width, height) * 0.46; r += 45) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + Math.sin(this.tentacleSway + r) * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Render Kraken Tentacles
    const tentacleCount = 8;
    const tentacleLength = Math.min(width, height) * 0.38;
    for (let tIdx = 0; tIdx < tentacleCount; tIdx++) {
      if (this.tentacleHitCooldowns[tIdx] > 0) continue; // severed
      const baseAngle = this.krakenRotation + (tIdx / tentacleCount) * Math.PI * 2;
      const wave = Math.sin(this.tentacleSway + tIdx * 1.2) * 28;

      const midX = cx + Math.cos(baseAngle) * (tentacleLength * 0.55) - Math.sin(baseAngle) * wave;
      const midY = cy + Math.sin(baseAngle) * (tentacleLength * 0.55) + Math.cos(baseAngle) * wave;
      const tipX = cx + Math.cos(baseAngle) * tentacleLength;
      const tipY = cy + Math.sin(baseAngle) * tentacleLength;

      ctx.save();
      ctx.strokeStyle = theme.krakenTentacle;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();

      // Suction cups
      ctx.fillStyle = '#E1BEE7';
      ctx.beginPath();
      ctx.arc(midX, midY, 4, 0, Math.PI * 2);
      ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Kraken Center Body & Snapping Eyes
    ctx.save();
    ctx.fillStyle = theme.krakenBody;
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Central Maw / Vortex Core
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Yellow Kraken Eyes
    const eyeAngle = this.krakenRotation;
    ctx.fillStyle = '#FFEB3B';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(eyeAngle + 0.6) * 28, cy + Math.sin(eyeAngle + 0.6) * 28, 6, 0, Math.PI * 2);
    ctx.arc(cx + Math.cos(eyeAngle - 0.6) * 28, cy + Math.sin(eyeAngle - 0.6) * 28, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(eyeAngle + 0.6) * 28, cy + Math.sin(eyeAngle + 0.6) * 28, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + Math.cos(eyeAngle - 0.6) * 28, cy + Math.sin(eyeAngle - 0.6) * 28, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Render Ink Puffs
    for (const puff of this.inkPuffs) {
      ctx.save();
      const alpha = Math.max(0.1, puff.life / puff.maxLife);
      ctx.fillStyle = `rgba(18, 18, 18, ${alpha * 0.85})`;
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Plankton Orbs
    for (const orb of this.orbs) {
      ctx.save();
      ctx.translate(orb.x, orb.y);

      // Glow Aura
      ctx.fillStyle = orb.color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, orb.radius + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      if (orb.type === 'plankton') {
        ctx.fillStyle = orb.color;
        ctx.beginPath();
        ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-2, -2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (orb.type === 'nautilus') {
        ctx.fillStyle = '#FFD54F';
        ctx.beginPath();
        ctx.arc(0, 0, orb.radius, 0, Math.PI * 1.5);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.strokeStyle = '#FF6F00';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Imperial Kraken Pearl
        ctx.fillStyle = '#E040FB';
        ctx.beginPath();
        ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render Submersibles
    for (const s of this.subs.values()) {
      const pConfig = this.players.find((p) => p.id === s.id);
      const pColor = pConfig ? pConfig.color : '#38BDF8';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      ctx.save();
      ctx.translate(s.x, s.y);

      // Underdog Poseidon Aura
      if (s.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Torpedo Booster Rings
      if (s.isBoosting) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(-Math.cos(s.angle) * 20, -Math.sin(s.angle) * 20, 16, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.rotate(s.angle);

      // Submersible Body
      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.ellipse(0, 0, s.radius * 1.25, s.radius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Colored Racing Trim
      ctx.fillStyle = pColor;
      ctx.fillRect(-s.radius * 0.8, -s.radius * 0.35, s.radius * 1.6, s.radius * 0.7);

      // Bronze Propeller Screw at Rear
      ctx.fillStyle = '#FFB300';
      ctx.fillRect(-s.radius * 1.35, -4, 4, 8);

      // Mascot Pilot in Glass Dome Cockpit
      drawCharacter(
        ctx,
        2,
        0,
        12,
        s.id,
        isBot,
        s.mood,
        s.animTimer,
        undefined
      );

      ctx.restore();

      // Charging Gauge Ring
      if (s.isCharging) {
        const ratio = Math.min(1.0, s.chargeTime / 1.0);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.strokeStyle = ratio >= 0.72 && ratio <= 0.98 ? '#00E676' : '#00E5FF';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 14, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * ratio);
        ctx.stroke();

        if (ratio >= 0.72 && ratio <= 0.98) {
          ctx.fillStyle = '#00E676';
          ctx.font = '900 11px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SWEET SPOT!', 0, -s.radius - 18);
        }
        ctx.restore();
      }

      // Ink Blindness Splatter on Viewport
      if (s.inkBlindTimer > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(18, 18, 18, 0.75)';
        ctx.beginPath();
        ctx.arc(s.x - 8, s.y - 8, 14, 0, Math.PI * 2);
        ctx.arc(s.x + 8, s.y + 6, 12, 0, Math.PI * 2);
        ctx.fill();
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
    ctx.fillText('🐙 KRAKEN WHIRLPOOL DUEL', width / 2, 75);
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
    const activeSubs = Array.from(this.subs.values());
    const cardPositions = [
      { x: 18, y: height - 128 },
      { x: width - 148, y: height - 128 },
      { x: 18, y: 88 },
      { x: width - 148, y: 88 }
    ];

    activeSubs.forEach((s, idx) => {
      if (idx >= cardPositions.length) return;
      const pos = cardPositions[idx];
      const pConfig = this.players.find((p) => p.id === s.id);
      const pColor = pConfig ? pConfig.color : '#38BDF8';
      const pNum = typeof s.id === 'number' ? (s.id as number) + 1 : String(s.id).slice(-1);

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(pos.x, pos.y, 130, 48);
      ctx.strokeStyle = pColor;
      ctx.lineWidth = s.isUnderdog ? 3 : 1.5;
      ctx.strokeRect(pos.x, pos.y, 130, 48);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${pNum} ${s.isUnderdog ? '⭐ UNDERDOG' : 'PILOT'}`, pos.x + 8, pos.y + 18);

      ctx.fillStyle = '#FFD54F';
      ctx.font = '900 16px Montserrat, sans-serif';
      ctx.fillText(`${s.score} PTS`, pos.x + 8, pos.y + 40);

      if (s.inkBlindTimer > 0) {
        ctx.fillStyle = '#E040FB';
        ctx.font = '11px sans-serif';
        ctx.fillText('👁️ BLIND', pos.x + 75, pos.y + 40);
      }
      ctx.restore();
    });
  }
}
