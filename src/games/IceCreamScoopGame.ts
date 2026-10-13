import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface ScoopFlavor {
  name: string;
  color: string;
  points: number;
  isHazard?: boolean;
  isCherry?: boolean;
}

const FLAVORS: ScoopFlavor[] = [
  { name: 'Vanilla', color: '#FFF8E1', points: 10 },
  { name: 'Strawberry', color: '#F48FB1', points: 15 },
  { name: 'Mint Choc', color: '#81C784', points: 15 },
  { name: 'Blueberry', color: '#64B5F6', points: 20 },
  { name: 'Golden Pistachio', color: '#FFD54F', points: 35 },
  { name: 'Melting Sludge', color: '#4E342E', points: -15, isHazard: true },
  { name: 'Royal Cherry', color: '#D32F2F', points: 30, isCherry: true }
];

interface FallingScoop {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  flavor: ScoopFlavor;
  rot: number;
  rotSpeed: number;
}

interface ConePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  score: number;
  scoops: ScoopFlavor[];
  maxStackHeight: number;
  tiltAngle: number;
  tiltVel: number;
  chargeTime: number;
  shuntCooldown: number;
  shuntActiveTimer: number;
  shuntDir: number;
  stunTimer: number;
  sundaesServed: number;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
  isUnderdog: boolean;
}

interface ThemeConfig {
  id: string;
  name: string;
  icon: string;
  skyTop: string;
  skyBottom: string;
  counterColor: string;
  counterTrim: string;
  floorColor: string;
  accentColor: string;
}

const THEMES: ThemeConfig[] = [
  {
    id: 'gelato_piazza',
    name: 'Gelato Piazza 🍨',
    icon: '🍨',
    skyTop: '#FFF3E0',
    skyBottom: '#FFE0B2',
    counterColor: '#ECEFF1',
    counterTrim: '#B0BEC5',
    floorColor: '#D7CCC8',
    accentColor: '#FF6F00'
  },
  {
    id: 'cyber_softserve',
    name: 'Cyber Soft-Serve ⚡',
    icon: '⚡',
    skyTop: '#0B0F19',
    skyBottom: '#1B1429',
    counterColor: '#1F293D',
    counterTrim: '#00E5FF',
    floorColor: '#0E1726',
    accentColor: '#00E5FF'
  },
  {
    id: 'carnival_sundae',
    name: 'Carnival Sundae 🎪',
    icon: '🎪',
    skyTop: '#FFF8E1',
    skyBottom: '#FFECB3',
    counterColor: '#EF5350',
    counterTrim: '#FFD54F',
    floorColor: '#8D6E63',
    accentColor: '#D81B60'
  }
];

export class IceCreamScoopGame extends BaseGame {
  public currentMapName: string = 'Gelato Piazza 🍨';
  private currentThemeIdx: number = 0;

  private conePlayers: Map<PlayerId, ConePlayer> = new Map();
  private fallingScoops: FallingScoop[] = [];
  private nextScoopId: number = 1;
  private scoopSpawnTimer: number = 0.5;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botTargetScoop: Map<PlayerId, number | null> = new Map();

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
    this.fallingScoops = [];
    this.conePlayers.clear();
    this.botReactionTimers.clear();
    this.botTargetScoop.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.conePlayers.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 110,
        vx: 0,
        score: 0,
        scoops: [FLAVORS[0]], // starts with 1 vanilla scoop
        maxStackHeight: 1,
        tiltAngle: 0,
        tiltVel: 0,
        chargeTime: 0,
        shuntCooldown: 0,
        shuntActiveTimer: 0,
        shuntDir: 0,
        stunTimer: 0,
        sundaesServed: 0,
        mood: 'idle',
        moodTimer: 0,
        animTimer: Math.random() * 5,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
      this.botTargetScoop.set(p.id, null);
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
    for (const cp of this.conePlayers.values()) {
      if (cp.score > maxScore) maxScore = cp.score;
    }

    // Update bots
    this.updateBots(dt, width, height);

    // Spawning falling scoops
    this.scoopSpawnTimer -= dt;
    const spawnRate = this.roundTimer < 15 ? 0.45 : 0.75;
    if (this.scoopSpawnTimer <= 0) {
      this.scoopSpawnTimer = spawnRate + Math.random() * 0.35;
      this.spawnFallingScoop(width);
    }

    // Update falling scoops
    for (let i = this.fallingScoops.length - 1; i >= 0; i--) {
      const sc = this.fallingScoops[i];
      sc.x += sc.vx * dt;
      sc.y += sc.vy * dt;
      sc.vy += 220 * dt; // gravity
      sc.rot += sc.rotSpeed * dt;

      // Bounce on counter edge or hit floor
      if (sc.y > height - 60) {
        // Splat on floor
        this.particles.emit(sc.x, height - 70, 6, sc.flavor.color);
        this.fallingScoops.splice(i, 1);
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const cp = this.conePlayers.get(p.id);
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
        cp.x = Math.max(40, Math.min(width - 40, cp.x));
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

      const baseSpeed = cp.isUnderdog ? 340 : 280;

      // Shunt hold-to-charge
      if (isAction && cp.shuntActiveTimer <= 0) {
        cp.chargeTime = Math.min(1.0, cp.chargeTime + dt * 2.2);
        // While charging, slow movement but stabilize tower
        const chargeMoveSpeed = baseSpeed * 0.45;
        if (Math.abs(steer) > 0.15) {
          cp.vx = steer * chargeMoveSpeed;
        } else {
          cp.vx *= 0.8;
        }
        // Active stabilization: tilt dampens
        cp.tiltVel *= Math.pow(0.7, dt * 60);
      } else {
        if (cp.chargeTime > 0.25 && cp.shuntCooldown <= 0) {
          // Release shunt!
          const shuntPower = cp.chargeTime;
          const dir = steer !== 0 ? Math.sign(steer) : (Math.random() > 0.5 ? 1 : -1);
          cp.shuntActiveTimer = 0.22 * shuntPower;
          cp.shuntDir = dir;
          cp.shuntCooldown = 0.8;
          cp.chargeTime = 0;
          this.audio.playWhoosh();
          this.particles.emit(cp.x, cp.y, 10, '#FFD54F');
        } else {
          cp.chargeTime = 0;
          if (cp.shuntActiveTimer <= 0) {
            if (Math.abs(steer) > 0.15) {
              cp.vx = steer * baseSpeed;
            } else {
              cp.vx *= 0.82;
            }
          }
        }
      }

      cp.x += cp.vx * dt;
      // Screen bounds
      if (cp.x < 45) {
        cp.x = 45;
        cp.vx = 0;
      }
      if (cp.x > width - 45) {
        cp.x = width - 45;
        cp.vx = 0;
      }

      // Tower Tilt Wobble Physics
      const stackHeight = cp.scoops.length;
      const wobbleInertia = (stackHeight * 0.08 + 0.15) * (cp.isUnderdog ? 0.55 : 1.0);
      // Lateral acceleration induces tilt
      cp.tiltVel += -cp.vx * wobbleInertia * dt * 0.045;
      // Gravity pulls tilted tower further
      cp.tiltVel += Math.sin(cp.tiltAngle) * (1.2 + stackHeight * 0.35) * dt;
      // Natural spring dampening
      cp.tiltVel *= Math.pow(0.92, dt * 60);
      cp.tiltAngle += cp.tiltVel * dt;

      // If tilt exceeds catastrophe threshold (> 0.72 rad ~ 41 deg), top scoops spill
      if (Math.abs(cp.tiltAngle) > 0.72) {
        this.spillTower(cp);
      }

      // Catch Falling Scoops
      const coneTipY = cp.y - 45 - (cp.scoops.length - 1) * 14;
      const catchRadius = cp.isUnderdog ? 38 : 26;

      for (let i = this.fallingScoops.length - 1; i >= 0; i--) {
        const sc = this.fallingScoops[i];
        const dx = sc.x - cp.x;
        const dy = sc.y - coneTipY;
        const dist = Math.hypot(dx, dy);

        if (dist < catchRadius + sc.radius) {
          // Catch scoop!
          this.catchScoop(cp, sc);
          this.fallingScoops.splice(i, 1);
        }
      }
    }

    // Inter-Player Body & Shunt Collisions
    const playersArr = this.getActivePlayers().map(p => this.conePlayers.get(p.id)!);
    for (let i = 0; i < playersArr.length; i++) {
      for (let j = i + 1; j < playersArr.length; j++) {
        const p1 = playersArr[i];
        const p2 = playersArr[j];
        const dist = Math.abs(p1.x - p2.x);
        const touchDist = 48;

        if (dist < touchDist) {
          const overlap = touchDist - dist;
          const dir = p1.x < p2.x ? -1 : 1;
          p1.x += dir * overlap * 0.5;
          p2.x -= dir * overlap * 0.5;

          // Check if one was shunting
          if (p1.shuntActiveTimer > 0 && p2.shuntActiveTimer <= 0) {
            this.executeShuntImpact(p1, p2, -dir);
          } else if (p2.shuntActiveTimer > 0 && p1.shuntActiveTimer <= 0) {
            this.executeShuntImpact(p2, p1, dir);
          } else {
            // Normal elastic bump
            const avgVx = (p1.vx + p2.vx) * 0.5;
            p1.vx = avgVx + dir * 120;
            p2.vx = avgVx - dir * 120;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnFallingScoop(width: number): void {
    const margin = 70;
    const x = margin + Math.random() * (width - margin * 2);
    // Random flavor with weighted cherries and hazards
    const isSuddenDeath = this.roundTimer < 15;
    let pool = FLAVORS;
    if (isSuddenDeath) {
      // More high-value pistachios and cherries
      pool = [
        ...FLAVORS,
        FLAVORS[4], // Golden Pistachio
        FLAVORS[6]  // Royal Cherry
      ];
    }
    const flavor = pool[Math.floor(Math.random() * pool.length)];

    this.fallingScoops.push({
      id: this.nextScoopId++,
      x,
      y: 70,
      vx: (Math.random() - 0.5) * 80,
      vy: 110 + Math.random() * 60,
      radius: flavor.isCherry ? 11 : 16,
      flavor,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3
    });
  }

  private catchScoop(cp: ConePlayer, sc: FallingScoop): void {
    if (sc.flavor.isHazard) {
      // Sludge hazard! Stuns player and knocks off scoop
      cp.score = Math.max(0, cp.score + sc.flavor.points);
      cp.stunTimer = 0.9;
      cp.mood = 'shocked';
      cp.moodTimer = 1.0;
      this.audio.playExplosion();
      this.screenShake = 6;
      this.particles.emit(cp.x, cp.y - 40, 14, sc.flavor.color);
      if (cp.scoops.length > 1) {
        cp.scoops.pop();
      }
      return;
    }

    if (sc.flavor.isCherry && cp.scoops.length >= 3) {
      // Sundae Completion! Bank tower with huge fanfare
      const heightBonus = cp.scoops.length * 12;
      const totalSundaePts = sc.flavor.points + heightBonus + 25;
      cp.score += totalSundaePts;
      cp.sundaesServed++;
      cp.mood = 'triumph';
      cp.moodTimer = 1.6;
      this.audio.playFanfare();
      this.particles.emit(cp.x, cp.y - 50, 25, '#FFD54F');
      this.particles.emit(cp.x, cp.y - 50, 15, '#D32F2F');
      this.screenShake = 8;
      this.hitStopTimer = 0.045;

      // Reset cone to 1 scoop
      cp.scoops = [FLAVORS[0]];
      cp.tiltAngle = 0;
      cp.tiltVel = 0;
      return;
    }

    // Normal scoop catch
    cp.scoops.push(sc.flavor);
    cp.score += sc.flavor.points;
    cp.maxStackHeight = Math.max(cp.maxStackHeight, cp.scoops.length);
    cp.mood = 'happy';
    cp.moodTimer = 0.6;
    this.audio.playTap();
    this.particles.emit(cp.x, cp.y - 40 - cp.scoops.length * 12, 6, sc.flavor.color);

    // Minor wobble shock
    cp.tiltVel += (Math.random() - 0.5) * 0.8;
  }

  private spillTower(cp: ConePlayer): void {
    if (cp.scoops.length <= 1) {
      cp.tiltAngle = Math.sign(cp.tiltAngle) * 0.5;
      cp.tiltVel = 0;
      return;
    }

    // Spill top scoops
    const lostCount = Math.min(3, cp.scoops.length - 1);
    for (let k = 0; k < lostCount; k++) {
      const lost = cp.scoops.pop();
      if (lost) {
        this.particles.emit(cp.x, cp.y - 50, 8, lost.color);
      }
    }

    cp.score = Math.max(0, cp.score - lostCount * 10);
    cp.stunTimer = 0.6;
    cp.mood = 'shocked';
    cp.moodTimer = 1.0;
    cp.tiltAngle = 0;
    cp.tiltVel = 0;
    this.audio.playExplosion();
    this.screenShake = 7;
  }

  private executeShuntImpact(attacker: ConePlayer, victim: ConePlayer, shuntDir: number): void {
    attacker.score += 30; // Sabotage bonus
    attacker.mood = 'triumph';
    attacker.moodTimer = 1.2;

    victim.vx = shuntDir * 420;
    victim.stunTimer = 0.75;
    victim.tiltVel += shuntDir * 3.2; // heavy wobble impulse
    victim.mood = 'shocked';
    victim.moodTimer = 1.2;

    // Knock off victim's top scoop if they have multiple
    if (victim.scoops.length > 1) {
      const popped = victim.scoops.pop();
      if (popped) {
        this.particles.emit(victim.x, victim.y - 50, 10, popped.color);
      }
    }

    this.audio.playExplosion();
    this.particles.emit((attacker.x + victim.x) * 0.5, attacker.y - 30, 18, '#FF5252');
    this.screenShake = 10;
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

    const cp = this.conePlayers.get(botId);
    if (!cp || cp.stunTimer > 0) return;

    let delay = 0.24;
    let blunder = false;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunder = Math.random() < 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
    }

    // Bot decision making:
    // 1. If tower tilt is high, counter-steer or hold charge to stabilize
    if (Math.abs(cp.tiltAngle) > 0.38) {
      const counterSteer = cp.tiltAngle > 0 ? -1 : 1;
      this.input.setBotInput(botId, true, counterSteer, 0, false);
      this.botReactionTimers.set(botId, delay * 0.5);
      return;
    }

    // 2. Aggressive Hard bot: check if nearby rival can be shunted
    if (difficulty === 'bot_hard' && cp.shuntCooldown <= 0) {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const rival = this.conePlayers.get(p.id);
        if (rival && Math.abs(rival.x - cp.x) < 85 && rival.scoops.length >= 2) {
          const shuntDir = rival.x > cp.x ? 1 : -1;
          // Charge briefly then release
          this.input.setBotInput(botId, true, shuntDir, 0, false);
          this.botReactionTimers.set(botId, 0.25);
          return;
        }
      }
    }

    // 3. Find optimal falling scoop
    let bestScoop: FallingScoop | null = null;
    let bestScore = -9999;

    for (const sc of this.fallingScoops) {
      if (sc.flavor.isHazard) continue; // avoid sludge
      // Prioritize cherry if stack >= 3
      let scoreWeight = sc.flavor.points;
      if (sc.flavor.isCherry) {
        if (cp.scoops.length >= 3) scoreWeight = 100;
        else scoreWeight = -50; // ignore cherry if not ready
      }

      // Distance factor
      const timeToGround = Math.max(0.1, (cp.y - sc.y) / Math.max(1, sc.vy));
      const projectedX = sc.x + sc.vx * timeToGround;
      const dist = Math.abs(projectedX - cp.x);

      const score = scoreWeight - dist * 0.4;
      if (score > bestScore) {
        bestScore = score;
        bestScoop = sc;
      }
    }

    let steer = 0;
    if (bestScoop) {
      const timeToCatch = Math.max(0.05, (cp.y - bestScoop.y) / Math.max(1, bestScoop.vy));
      const targetX = bestScoop.x + bestScoop.vx * timeToCatch;

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
      const cp = this.conePlayers.get(p.id);
      return {
        playerId: p.id,
        score: cp?.score || 0,
        height: cp?.maxStackHeight || 0,
        sundaes: cp?.sundaesServed || 0
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
      ? `Player ${winnerId + 1} stacked a ${topPlayer.height}-scoop tower and served ${topPlayer.sundaes} sundaes!`
      : 'All gelato cones splattered across the parlour floor!';

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

    // Background Sky / Parlour Walls
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Wall Patterns (Theme-dependent)
    this.renderThemeBackground(ctx, width, height, theme);

    // Dispenser Gantries at Top
    this.renderDispensers(ctx, width);

    // Gelato Parlour Counter / Floor
    const counterY = height - 90;
    ctx.fillStyle = theme.counterColor;
    ctx.fillRect(0, counterY, width, 90);

    ctx.fillStyle = theme.counterTrim;
    ctx.fillRect(0, counterY, width, 8);

    // Counter floor trim
    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(0, height - 25, width, 25);

    // Render Falling Scoops
    for (const sc of this.fallingScoops) {
      this.renderScoopItem(ctx, sc);
    }

    // Render Cone Players
    for (const p of this.getActivePlayers()) {
      const cp = this.conePlayers.get(p.id);
      if (!cp) continue;
      this.renderPlayer(ctx, p, cp);
    }

    // Render Particles
    this.particles.render(ctx);

    ctx.restore();

    // UI Header & Theme Pill
    this.renderUI(ctx, width, height);
  }

  private renderThemeBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: ThemeConfig
  ): void {
    ctx.save();
    if (theme.id === 'gelato_piazza') {
      // Italian Awning Stripes & arches
      ctx.fillStyle = 'rgba(216, 27, 96, 0.12)';
      const stripeW = 40;
      for (let x = 0; x < width; x += stripeW * 2) {
        ctx.fillRect(x, 0, stripeW, 140);
      }
      ctx.fillStyle = 'rgba(121, 85, 72, 0.08)';
      ctx.fillRect(0, 140, width, height - 230);
    } else if (theme.id === 'cyber_softserve') {
      // Neon Grid & Holographic Rails
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1;
      const gridSize = 45;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 90);
        ctx.stroke();
      }
      for (let y = 0; y < height - 90; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else {
      // Carnival Canopy & Festive Pennants
      ctx.fillStyle = 'rgba(239, 83, 80, 0.15)';
      for (let x = 0; x < width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 30, 80);
        ctx.lineTo(x + 60, 0);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private renderDispensers(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = '#455A64';
    ctx.fillRect(0, 0, width, 18);

    // Dispenser nozzles
    const nozzles = 6;
    const spacing = width / (nozzles + 1);
    for (let i = 1; i <= nozzles; i++) {
      const nx = spacing * i;
      ctx.fillStyle = '#78909C';
      ctx.beginPath();
      ctx.roundRect(nx - 14, 18, 28, 16, 4);
      ctx.fill();

      // Nozzle tip
      ctx.fillStyle = '#CFD8DC';
      ctx.beginPath();
      ctx.arc(nx, 34, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderScoopItem(ctx: CanvasRenderingContext2D, sc: FallingScoop): void {
    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.rotate(sc.rot);

    if (sc.flavor.isCherry) {
      // Cherry sphere
      ctx.fillStyle = '#D32F2F';
      ctx.beginPath();
      ctx.arc(0, 0, sc.radius, 0, Math.PI * 2);
      ctx.fill();

      // Stem
      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -sc.radius + 2);
      ctx.quadraticCurveTo(8, -sc.radius - 10, 4, -sc.radius - 14);
      ctx.stroke();

      // Specular highlight
      ctx.fillStyle = '#FFCDD2';
      ctx.beginPath();
      ctx.arc(-sc.radius * 0.35, -sc.radius * 0.35, sc.radius * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Gelato scoop sphere with fluff texture
      ctx.fillStyle = sc.flavor.color;
      ctx.beginPath();
      ctx.arc(0, 0, sc.radius, 0, Math.PI * 2);
      ctx.fill();

      // Textured rim
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Highlights
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(-sc.radius * 0.3, -sc.radius * 0.3, sc.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      if (sc.flavor.isHazard) {
        // Toxic skull/hazard mark
        ctx.fillStyle = '#FF5252';
        ctx.font = '900 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', 0, 0);
      }
    }

    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, p: PlayerConfig, cp: ConePlayer): void {
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

    // Draw Chef Mascot
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

    // Draw Chef Hat on Top of Head
    ctx.save();
    ctx.translate(cp.x, cp.y - 44);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.lineTo(14, -12);
    ctx.quadraticCurveTo(0, -22, -14, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Draw Waffle Cone and Scoop Tower in Chef's Hands
    const coneOriginX = cp.x + (cp.vx > 10 ? 12 : cp.vx < -10 ? -12 : 8);
    const coneOriginY = cp.y - 32;

    ctx.save();
    ctx.translate(coneOriginX, coneOriginY);

    // Waffle Cone Geometry (Cone base)
    ctx.fillStyle = cp.isUnderdog ? '#FFD54F' : '#D7CCC8';
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(11, 0);
    ctx.lineTo(0, 32);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = cp.isUnderdog ? '#FF8F00' : '#8D6E63';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Waffle Crosshatch Pattern
    ctx.strokeStyle = cp.isUnderdog ? 'rgba(255, 143, 0, 0.4)' : 'rgba(141, 110, 99, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, 8);
    ctx.lineTo(5, 20);
    ctx.moveTo(7, 8);
    ctx.lineTo(-5, 20);
    ctx.stroke();

    // Rotated Tower of Scoops
    ctx.rotate(cp.tiltAngle);

    cp.scoops.forEach((sc, idx) => {
      const sy = -14 - idx * 13;
      ctx.fillStyle = sc.color;
      ctx.beginPath();
      ctx.arc(0, sy, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Specular shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(-4, sy - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    // Wobble Alert
    if (Math.abs(cp.tiltAngle) > 0.42) {
      ctx.save();
      ctx.fillStyle = '#FF1744';
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WOBBLE!', cp.x, cp.y - 95 - cp.scoops.length * 10);
      ctx.restore();
    }

    // Player Overhead Name & Score Badge
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
    // Top-Center Safe Zone (y: 12-44) is completely free for global timer
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
    ctx.fillText(`🍨 ICE CREAM SCOOP • ${THEMES[this.currentThemeIdx].name}`, width / 2, 70);
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
    ctx.fillText('Steer: Move • Hold Action: Cone Shunt', width - 28, height - 23);
    ctx.restore();
  }

  private renderCornerPlayerCards(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const cp = this.conePlayers.get(p.id);
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
      ctx.fillText(`🍨 ${cp.scoops.length}`, cx + cardW - 8, cy + 36);

      ctx.restore();
    });
  }
}
