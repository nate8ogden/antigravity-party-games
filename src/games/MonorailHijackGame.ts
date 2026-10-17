import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type MonorailThemeId = 'neo_kyoto' | 'alpine_express' | 'volcanic_chasm';

interface MonorailTheme {
  id: MonorailThemeId;
  name: string;
  icon: string;
  skyTop: string;
  skyBottom: string;
  carBody: string;
  carStripe: string;
  gantryColor: string;
  bountyGlow: string;
  accentColor: string;
}

const THEMES: Record<MonorailThemeId, MonorailTheme> = {
  neo_kyoto: {
    id: 'neo_kyoto',
    name: 'Neo-Kyoto Maglev Heist',
    icon: '🚅',
    skyTop: '#080A16',
    skyBottom: '#1B1430',
    carBody: '#1E293B',
    carStripe: '#00E5FF',
    gantryColor: '#EF4444',
    bountyGlow: '#FFD700',
    accentColor: '#00E5FF'
  },
  alpine_express: {
    id: 'alpine_express',
    name: 'Alpine Blizzard Express',
    icon: '❄️',
    skyTop: '#0B1526',
    skyBottom: '#223854',
    carBody: '#334155',
    carStripe: '#38BDF8',
    gantryColor: '#F59E0B',
    bountyGlow: '#67E8F9',
    accentColor: '#38BDF8'
  },
  volcanic_chasm: {
    id: 'volcanic_chasm',
    name: 'Volcanic Chasm Mag-Train',
    icon: '🔥',
    skyTop: '#160808',
    skyBottom: '#361010',
    carBody: '#1C1917',
    carStripe: '#EA580C',
    gantryColor: '#DC2626',
    bountyGlow: '#FBBF24',
    accentColor: '#EA580C'
  }
};

const THEME_ORDER: MonorailThemeId[] = ['neo_kyoto', 'alpine_express', 'volcanic_chasm'];

interface MonorailCar {
  x: number;
  width: number;
  height: number;
}

interface OverheadGantry {
  id: number;
  x: number;
  width: number;
  height: number;
  type: 'low_gantry' | 'high_laser';
}

interface CryptoBounty {
  id: number;
  x: number;
  y: number;
  type: 'briefcase' | 'gold_bar' | 'diamond_chip';
  points: number;
  collected: boolean;
  pulsePhase: number;
}

interface FloatingHeistText {
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  maxTimer: number;
}

interface MonorailRunner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  altitude: number;
  vAltitude: number;
  isJumping: boolean;
  jumpCharge: number;
  isDucking: boolean;
  duckTimer: number;
  isDropkicking: boolean;
  score: number;
  bounties: number;
  stunTimer: number;
  isUnderdog: boolean;
  magBoots: boolean;
  lastShovedBy: PlayerId | null;
  shoveTimer: number;
  stuckTimer: number;
  lastPos: { x: number; y: number };
  currentMood: CharacterMood;
  animTime: number;
}

export class MonorailHijackGame extends BaseGame {
  public currentTheme: MonorailThemeId = 'neo_kyoto';
  public playersState: Map<PlayerId, MonorailRunner> = new Map();

  private trainCars: MonorailCar[] = [];
  private gantries: OverheadGantry[] = [];
  private bounties: CryptoBounty[] = [];
  private floatingTexts: FloatingHeistText[] = [];

  private trainY: number = 0;
  private gantryTimer: number = 2.0;
  private bountyTimer: number = 1.0;
  private gantryIdCounter: number = 0;
  private bountyIdCounter: number = 0;
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
          this.setTheme('neo_kyoto');
        } else if (e.key === '2') {
          this.setTheme('alpine_express');
        } else if (e.key === '3') {
          this.setTheme('volcanic_chasm');
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

  public setTheme(theme: MonorailThemeId): void {
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
    this.gantries = [];
    this.bounties = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;

    this.trainY = height * 0.72;

    // 4 interconnected high-speed monorail cars with gaps
    const carW = 160;
    const gap = 34;
    const startX = width * 0.08;
    this.trainCars = [
      { x: startX, width: carW, height: 72 },
      { x: startX + carW + gap, width: carW, height: 72 },
      { x: startX + (carW + gap) * 2, width: carW, height: 72 },
      { x: startX + (carW + gap) * 3, width: carW, height: 72 }
    ];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const car = this.trainCars[idx % this.trainCars.length];
      const initialX = car.x + car.width * 0.5 + (idx % 2 === 0 ? -25 : 25);
      this.playersState.set(p.id, {
        id: p.id,
        x: initialX,
        y: this.trainY,
        vx: 0,
        altitude: 0,
        vAltitude: 0,
        isJumping: false,
        jumpCharge: 0,
        isDucking: false,
        duckTimer: 0,
        isDropkicking: false,
        score: 0,
        bounties: 0,
        stunTimer: 0,
        isUnderdog: false,
        magBoots: false,
        lastShovedBy: null,
        shoveTimer: 0,
        stuckTimer: 0,
        lastPos: { x: initialX, y: this.trainY },
        currentMood: 'focused',
        animTime: 0
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
    });
  }

  public update(dt: number, width: number, _height: number): void {
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
    const gantrySpeed = 360 * (isSuddenDeath ? 1.35 : 1.0);

    // 1. Spawn overhead tunnel gantries & high laser scanners
    this.gantryTimer -= dt;
    if (this.gantryTimer <= 0) {
      this.gantryTimer = (isSuddenDeath ? 1.4 : 2.0) + Math.random() * 1.2;
      const roll = Math.random();
      const type = roll < 0.65 ? 'low_gantry' : 'high_laser';
      this.gantries.push({
        id: ++this.gantryIdCounter,
        x: width + 50,
        width: 48,
        height: type === 'low_gantry' ? 65 : 40,
        type
      });
    }

    // 2. Spawn crypto bounties
    this.bountyTimer -= dt;
    if (this.bountyTimer <= 0) {
      this.bountyTimer = (isSuddenDeath ? 0.6 : 1.0) + Math.random() * 0.6;
      const targetCar = this.trainCars[Math.floor(Math.random() * this.trainCars.length)];
      const roll = Math.random();
      let type: 'briefcase' | 'gold_bar' | 'diamond_chip' = 'briefcase';
      let points = 30;

      if (roll < 0.50) {
        type = 'briefcase';
        points = 30;
      } else if (roll < 0.85) {
        type = 'gold_bar';
        points = 50;
      } else {
        type = 'diamond_chip';
        points = 75;
      }

      this.bounties.push({
        id: ++this.bountyIdCounter,
        x: targetCar.x + 24 + Math.random() * (targetCar.width - 48),
        y: this.trainY - 26,
        type,
        points,
        collected: false,
        pulsePhase: Math.random() * Math.PI * 2
      });
    }

    // 3. Move gantries leftward
    for (let i = this.gantries.length - 1; i >= 0; i--) {
      const g = this.gantries[i];
      g.x -= gantrySpeed * dt;
      if (g.x < -70) {
        this.gantries.splice(i, 1);
      }
    }

    // 4. Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.timer -= dt;
      ft.y -= 25 * dt;
      if (ft.timer <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 5. Update Underdog
    this.updateUnderdogStatus();

    // 6. Update Bots
    this.updateBots(dt, width, _height);

    // 7. Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const runner = this.playersState.get(p.id);
      if (!runner) continue;

      runner.animTime += dt;
      if (runner.shoveTimer > 0) {
        runner.shoveTimer -= dt;
        if (runner.shoveTimer <= 0) runner.lastShovedBy = null;
      }

      if (runner.stunTimer > 0) {
        runner.stunTimer -= dt;
        runner.currentMood = 'shocked';
        continue;
      }

      if (runner.duckTimer > 0) {
        runner.duckTimer -= dt;
        if (runner.duckTimer <= 0) runner.isDucking = false;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isCharging = this.input.isActionPressed(p.id);
      const justAction = this.input.justAction(p.id);
      const justReleased = !isCharging && runner.jumpCharge > 0.05;

      // Horizontal run & braking
      const speedMult = runner.isUnderdog ? 1.22 : 1.0;
      runner.vx += (steer * 220 * speedMult - runner.vx) * 12 * dt;
      runner.x += runner.vx * dt;

      // Arena bounds
      const minTrainX = this.trainCars[0].x - 10;
      const maxTrainX = this.trainCars[this.trainCars.length - 1].x + this.trainCars[0].width + 10;
      runner.x = Math.max(minTrainX, Math.min(maxTrainX, runner.x));

      // Jump charging & execution
      if (!runner.isJumping) {
        if (isCharging) {
          runner.jumpCharge = Math.min(1.0, runner.jumpCharge + dt * 2.6);
          this.particles.spawnSparks(runner.x, runner.y + 4, p.color, 1);
        }

        if (justReleased || (justAction && throttle > 0.2)) {
          runner.isJumping = true;
          runner.isDropkicking = false;
          const jumpPower = 280 + runner.jumpCharge * 140;
          runner.vAltitude = jumpPower;
          runner.jumpCharge = 0;
          this.audio.playTap();
          this.particles.spawnSparks(runner.x, runner.y, '#FFFFFF', 6);
        } else if (throttle < -0.4) {
          // Duck low under tunnel gantries
          runner.isDucking = true;
          runner.duckTimer = 0.5;
        }
      } else {
        // Airborne: Can execute Mid-Air Dropkick / Roof Slam!
        if (justAction && !runner.isDropkicking) {
          runner.isDropkicking = true;
          runner.vx = (steer >= 0 ? 1 : -1) * 360;
          runner.vAltitude = -180;
          this.audio.playWhoosh();
          this.particles.spawnSparks(runner.x, runner.y - runner.altitude, p.color, 8);
        }

        runner.altitude += runner.vAltitude * dt;
        runner.vAltitude -= 780 * dt; // gravity

        if (runner.altitude <= 0) {
          runner.altitude = 0;
          runner.vAltitude = 0;
          runner.isJumping = false;
          runner.isDropkicking = false;
        }
      }

      // Check on roof vs fell between cars
      let onCar = false;
      for (const car of this.trainCars) {
        if (runner.x >= car.x && runner.x <= car.x + car.width) {
          onCar = true;
          break;
        }
      }

      // If fallen into gap between cars
      if (!onCar && runner.altitude <= 0) {
        if (runner.magBoots) {
          // Underdog Mag-Boots bridge the gap!
          this.audio.playBounce();
          this.particles.spawnSparks(runner.x, runner.y, '#F59E0B', 8);
        } else {
          // Fall through gap!
          runner.stunTimer = 1.0;
          runner.score = Math.max(0, runner.score - 25);
          runner.currentMood = 'shocked';
          this.screenShake = 6.0;
          this.audio.playExplosion();
          this.particles.emit(runner.x, this.trainY + 20, 14, '#EF4444');
          this.addFloatingText(runner.x, this.trainY - 10, 'GAP FALL! -25 ☠️', '#EF4444');

          // Credit rival if shoved into gap!
          if (runner.lastShovedBy !== null) {
            const rival = this.playersState.get(runner.lastShovedBy);
            if (rival) {
              rival.score += 45;
              this.addFloatingText(rival.x, rival.y - 25, 'GAP TACKLE! +45 💥', '#10B981');
            }
          }

          // Respawn safely on nearest car
          runner.x = this.trainCars[1].x + 40;
        }
      }

      // Mood
      if (runner.isDropkicking) runner.currentMood = 'triumph';
      else if (runner.isUnderdog) runner.currentMood = 'focused';
      else runner.currentMood = 'idle';

      // Collect bounties
      for (const b of this.bounties) {
        if (!b.collected && Math.hypot(runner.x - b.x, (runner.y - runner.altitude) - b.y) < 24) {
          b.collected = true;
          runner.bounties++;
          const pts = b.points * (isSuddenDeath ? 2 : 1);
          runner.score += pts;
          this.audio.playScore();
          this.particles.spawnSparks(b.x, b.y, THEMES[this.currentTheme].bountyGlow, 14);
          this.addFloatingText(b.x, b.y - 20, `+${pts} BOUNTY! 💰`, THEMES[this.currentTheme].bountyGlow);
        }
      }

      // Check overhead gantry collision
      const headY = runner.y - runner.altitude - (runner.isDucking ? 10 : 25);
      for (const g of this.gantries) {
        const inX = Math.abs(runner.x - g.x) < g.width / 2 + 12;
        const gantryBottomY = 160 + g.height;

        if (g.type === 'low_gantry') {
          if (inX && headY < gantryBottomY && !runner.isDucking) {
            // Whacked by low gantry!
            runner.stunTimer = 0.9;
            runner.score = Math.max(0, runner.score - 25);
            runner.currentMood = 'shocked';
            this.screenShake = 7.0;
            this.hitStopTimer = 0.045;
            this.audio.playExplosion();
            this.particles.emit(runner.x, headY, 14, '#EF4444');
            this.addFloatingText(runner.x, headY - 15, 'WHACKED! -25 💥', '#EF4444');
            break;
          }
        } else {
          // High Laser Scanner: hits if jumping too high!
          if (inX && headY < gantryBottomY + 20) {
            runner.stunTimer = 0.8;
            runner.score = Math.max(0, runner.score - 20);
            this.audio.playExplosion();
            this.particles.spawnSparks(runner.x, headY, '#38BDF8', 12);
            this.addFloatingText(runner.x, headY - 15, 'ZAPPED! -20 ⚡', '#38BDF8');
            break;
          }
        }
      }
    }

    // 8. Inter-Player Physical Rooftop Bumping & Dropkicks (m1*v1 + m2*v2)
    for (let i = 0; i < active.length; i++) {
      const r1 = this.playersState.get(active[i].id);
      if (!r1 || r1.stunTimer > 0) continue;

      for (let j = i + 1; j < active.length; j++) {
        const r2 = this.playersState.get(active[j].id);
        if (!r2 || r2.stunTimer > 0) continue;

        const dx = r2.x - r1.x;
        const dy = (r2.y - r2.altitude) - (r1.y - r1.altitude);
        const dist = Math.hypot(dx, dy);

        if (dist < 32 && dist > 0.001) {
          const nx = dx / dist;
          const overlap = 32 - dist;

          r1.x -= nx * overlap * 0.5;
          r2.x += nx * overlap * 0.5;

          // Check if either is dropkicking
          if (r1.isDropkicking || r2.isDropkicking) {
            this.screenShake = 6.5;
            this.hitStopTimer = 0.045;
            this.audio.playExplosion();

            if (r1.isDropkicking && !r2.isDropkicking) {
              r2.vx = nx * 340 * (r1.isUnderdog ? 1.4 : 1.0);
              r2.stunTimer = 0.45;
              r2.lastShovedBy = r1.id;
              r2.shoveTimer = 1.8;
              r1.score += 40;
              this.particles.spawnSparks(r2.x, r2.y, '#EF4444', 16);
              this.addFloatingText(r1.x, r1.y - 30, 'DROPKICK! +40 🥊', '#10B981');
            } else if (r2.isDropkicking && !r1.isDropkicking) {
              r1.vx = -nx * 340 * (r2.isUnderdog ? 1.4 : 1.0);
              r1.stunTimer = 0.45;
              r1.lastShovedBy = r2.id;
              r1.shoveTimer = 1.8;
              r2.score += 40;
              this.particles.spawnSparks(r1.x, r1.y, '#EF4444', 16);
              this.addFloatingText(r2.x, r2.y - 30, 'DROPKICK! +40 🥊', '#10B981');
            }
          } else {
            // Elastic shoulder-check
            r1.vx -= nx * 110;
            r2.vx += nx * 110;
            r1.lastShovedBy = r2.id;
            r1.shoveTimer = 1.5;
            r2.lastShovedBy = r1.id;
            r2.shoveTimer = 1.5;
            this.audio.playBounce();
            this.particles.spawnSparks((r1.x + r2.x) / 2, r1.y, '#F59E0B', 8);
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
      const runner = this.playersState.get(p.id);
      if (!runner) continue;
      if (runner.score > maxScore) maxScore = runner.score;
      if (runner.score < minScore) minScore = runner.score;
    }

    for (const p of active) {
      const runner = this.playersState.get(p.id);
      if (!runner) continue;
      if (maxScore - runner.score >= 50) {
        if (!runner.isUnderdog) {
          runner.isUnderdog = true;
          runner.magBoots = true;
        }
      } else {
        runner.isUnderdog = false;
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
    const runner = this.playersState.get(botId);
    if (!runner || runner.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction Delays:
    // Easy: 380-450ms, blunders, late ducks
    // Normal: 220-250ms, jumps gaps cleanly, ducks gantries
    // Hard: 90-130ms, executes mid-air dropkicks, hunts diamond chips
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

    // Target bounty
    let targetX = runner.x;
    const uncollected = this.bounties.filter(b => !b.collected);
    if (uncollected.length > 0) {
      targetX = uncollected[0].x;
    }

    let steer = 0;
    if (Math.abs(targetX - runner.x) > 16) {
      steer = targetX > runner.x ? 1 : -1;
    }

    // Check approaching gantry
    let duck = false;
    let jump = false;

    for (const g of this.gantries) {
      const dist = g.x - runner.x;
      if (dist > 0 && dist < 120) {
        if (g.type === 'low_gantry') {
          if (Math.random() > blunderChance) {
            duck = true;
          }
        }
      }
    }

    // Check if gap ahead on roof
    let nearGap = true;
    for (const car of this.trainCars) {
      if (runner.x + steer * 30 >= car.x && runner.x + steer * 30 <= car.x + car.width) {
        nearGap = false;
        break;
      }
    }
    if (nearGap && !runner.isJumping) {
      jump = true; // leap across car gap!
    }

    // Hard bots: dropkick human rivals!
    if (difficulty === 'bot_hard' && runner.isJumping && !runner.isDropkicking) {
      for (const p of this.getActivePlayers()) {
        if (p.id !== botId) {
          const rival = this.playersState.get(p.id);
          if (rival && Math.abs(rival.x - runner.x) < 80) {
            jump = true; // triggers dropkick!
          }
        }
      }
    }

    this.input.setBotInput(botId, jump, steer, duck ? -1 : (jump ? 1 : 0), jump);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const runner = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: Math.floor(runner?.score || 0),
        bounties: runner?.bounties || 0
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
      ? `Player ${winnerId + 1} hijacked the Maglev with ${scores[0].bounties} bounties (${topScore} pts)!`
      : 'The monorail sped into the darkness with no clear victor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // Screen Shake Offset
    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Atmosphere Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Tunnel / Skyline Background Details
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    for (let x = 0; x < width; x += 80) {
      const bh = 150 + ((x * 13) % 100);
      ctx.fillRect(x, height - bh, 68, bh);
    }

    // Speed Motion Streaks in Tunnel Ceiling
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const streakY = 100 + i * 22;
      const streakX = ((this.animTimer * 500 + i * 160) % (width + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(streakX, streakY);
      ctx.lineTo(streakX + 60, streakY);
      ctx.stroke();
    }

    // 2. High-Speed Maglev Rail Line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(0, this.trainY + 70);
    ctx.lineTo(width, this.trainY + 70);
    ctx.stroke();

    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = theme.accentColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, this.trainY + 70);
    ctx.lineTo(width, this.trainY + 70);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Render Monorail Train Cars
    for (let i = 0; i < this.trainCars.length; i++) {
      const car = this.trainCars[i];

      // Car body
      ctx.fillStyle = theme.carBody;
      ctx.beginPath();
      ctx.roundRect(car.x, this.trainY, car.width, car.height, 8);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Neon livery side stripe
      ctx.fillStyle = theme.carStripe;
      ctx.fillRect(car.x + 8, this.trainY + 22, car.width - 16, 10);

      // Roof grip grating
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(car.x + 6, this.trainY - 4, car.width - 12, 6);

      // Coupler linking cars
      if (i < this.trainCars.length - 1) {
        ctx.fillStyle = '#64748B';
        ctx.fillRect(car.x + car.width, this.trainY + 30, 34, 12);
      }
    }

    // 4. Render Overhead Gantries & Lasers
    for (const g of this.gantries) {
      ctx.save();
      if (g.type === 'low_gantry') {
        // Red steel gantry truss
        ctx.fillStyle = theme.gantryColor;
        ctx.fillRect(g.x - g.width / 2, 110, g.width, g.height + 40);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(g.x - g.width / 2, 110, g.width, g.height + 40);

        // Caution Stripes
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        for (let y = 120; y < 110 + g.height + 30; y += 14) {
          ctx.beginPath();
          ctx.moveTo(g.x - g.width / 2 + 6, y);
          ctx.lineTo(g.x + g.width / 2 - 6, y + 10);
          ctx.stroke();
        }
      } else {
        // High Blue Laser Scanner
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(g.x - g.width / 2, 110, g.width, 24);

        // Glowing beam
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(g.x, 134);
        ctx.lineTo(g.x, this.trainY);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // 5. Render Crypto Bounties
    for (const b of this.bounties) {
      if (b.collected) continue;
      this.renderBounty(ctx, b, theme);
    }

    // 6. Render Runners with CharacterRenderer
    for (const p of this.getActivePlayers()) {
      const runner = this.playersState.get(p.id);
      if (!runner) continue;
      this.renderRunner(ctx, runner, p);
    }

    // 7. Floating texts
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

    // 8. Safe UI & Theme Pill (Strictly preserving y: 12-44 for Global Timer)
    this.renderSafeUI(ctx, width, height);
  }

  private renderBounty(ctx: CanvasRenderingContext2D, b: CryptoBounty, theme: MonorailTheme): void {
    ctx.save();
    const bob = Math.sin(this.animTimer * 5 + b.pulsePhase) * 3;
    ctx.translate(b.x, b.y + bob);

    ctx.shadowColor = theme.bountyGlow;
    ctx.shadowBlur = 10;

    if (b.type === 'briefcase') {
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-10, -7, 20, 14);
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-10, -7, 20, 14);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-4, -10, 8, 3); // handle
    } else if (b.type === 'gold_bar') {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(-11, 6);
      ctx.lineTo(11, 6);
      ctx.lineTo(8, -6);
      ctx.lineTo(-8, -6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Diamond Data Chip
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderRunner(ctx: CanvasRenderingContext2D, runner: MonorailRunner, p: PlayerConfig): void {
    const ry = runner.y - runner.altitude;
    ctx.save();
    ctx.translate(runner.x, ry);

    if (runner.stunTimer > 0 && Math.floor(runner.stunTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Underdog Mag-Boots Aura
    if (runner.magBoots) {
      ctx.save();
      ctx.fillStyle = '#F59E0B';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 8;
      ctx.fillRect(-10, 0, 8, 4);
      ctx.fillRect(2, 0, 8, 4);
      ctx.restore();
    }

    // Dropkick Tilt & Motion
    if (runner.isDropkicking) {
      ctx.rotate(0.45);
    }

    // Rider Mascot using CharacterRenderer
    const radius = runner.isDucking ? 10 : 14;
    const mascotY = runner.isDucking ? -8 : -14;
    ctx.save();
    ctx.translate(0, mascotY);
    drawCharacter(
      ctx,
      0,
      0,
      radius,
      p.id,
      p.type !== 'human',
      runner.currentMood,
      runner.animTime,
      undefined
    );
    ctx.restore();

    ctx.restore(); // Restore runner transform

    // HUD score badge above runner
    ctx.save();
    ctx.translate(runner.x, ry);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-24, runner.isDucking ? -30 : -38, 48, 14, 3);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${runner.score} pts`, 0, runner.isDucking ? -23 : -31);
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
      ? '🔥 TUNNEL SURGE! 2X POINTS & FAST GANTRIES'
      : 'RUN ROOFS • DUCK GANTRIES • DROPKICK RIVALS';
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Status Cards (Offset to y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const runner = this.playersState.get(p.id);
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
        runner?.currentMood || 'idle',
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
      ctx.fillText(`${runner?.score || 0} pts`, cardX + 42, cardY + 23);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "Chakra Petch", monospace';
      ctx.fillText(`💼 ${runner?.bounties || 0} bounties`, cardX + 42, cardY + 38);
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
    ctx.fillText('A/D: RUN • S: DUCK • SPACE: JUMP • TAP AIR: DROPKICK', width - 20, height - 14);

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
      // Right side tap = jump / dropkick
      if (!p1.isJumping) {
        p1.isJumping = true;
        p1.vAltitude = 280;
        this.audio.playTap();
      } else if (!p1.isDropkicking) {
        p1.isDropkicking = true;
        p1.vx = 360;
        p1.vAltitude = -180;
        this.audio.playWhoosh();
      }
      return true;
    }

    // Left/mid tap = run towards tap x
    p1.vx = (x > p1.x ? 1 : -1) * 220;
    this.audio.playTap();
    return true;
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
