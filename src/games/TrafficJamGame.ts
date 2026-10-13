import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type TrafficThemeId = 'neo_tokyo' | 'sunset_coastal' | 'cyber_trench';

interface TrafficTheme {
  id: TrafficThemeId;
  name: string;
  icon: string;
  roadColor: string;
  railColor: string;
  railGlow: string;
  laneMarker: string;
  cityBackdrop: string;
  accentColor: string;
}

const THEMES: Record<TrafficThemeId, TrafficTheme> = {
  neo_tokyo: {
    id: 'neo_tokyo',
    name: 'Neo-Tokyo Expressway',
    icon: '⚡',
    roadColor: '#141624',
    railColor: '#00E5FF',
    railGlow: '#00E5FF',
    laneMarker: 'rgba(255, 255, 255, 0.22)',
    cityBackdrop: '#090B14',
    accentColor: '#00E5FF'
  },
  sunset_coastal: {
    id: 'sunset_coastal',
    name: 'Sunset Pacific Highway',
    icon: '🌅',
    roadColor: '#23142B',
    railColor: '#FF007F',
    railGlow: '#FFAA00',
    laneMarker: 'rgba(255, 235, 59, 0.25)',
    cityBackdrop: '#14061A',
    accentColor: '#FF007F'
  },
  cyber_trench: {
    id: 'cyber_trench',
    name: 'Industrial Megacity Trench',
    icon: '🏭',
    roadColor: '#171A1C',
    railColor: '#F59E0B',
    railGlow: '#FBBF24',
    laneMarker: 'rgba(255, 255, 255, 0.18)',
    cityBackdrop: '#0A0D0E',
    accentColor: '#F59E0B'
  }
};

const THEME_ORDER: TrafficThemeId[] = ['neo_tokyo', 'sunset_coastal', 'cyber_trench'];

interface TrafficVehicle {
  id: number;
  x: number;
  y: number;
  targetX: number;
  width: number;
  height: number;
  speed: number;
  type: 'sedan' | 'truck' | 'courier';
  color: string;
  roofColor: string;
}

interface FloatingCombatText {
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  maxTimer: number;
}

interface CyberSpeedster {
  id: PlayerId;
  laneIdx: number;
  x: number;
  y: number;
  targetX: number;
  vx: number;
  vy: number;
  speed: number;
  distance: number;
  score: number;
  closeCalls: number;
  streak: number;
  stunTimer: number;
  nitroCharge: number;
  isNitro: boolean;
  nitroTimer: number;
  isUnderdog: boolean;
  ramBumper: boolean;
  lastShovedBy: PlayerId | null;
  shoveTimer: number;
  stuckTimer: number;
  lastPos: { x: number; y: number };
  currentMood: CharacterMood;
  animTime: number;
}

export class TrafficJamGame extends BaseGame {
  public currentTheme: TrafficThemeId = 'neo_tokyo';
  public playersState: Map<PlayerId, CyberSpeedster> = new Map();

  private traffic: TrafficVehicle[] = [];
  private lanes: number[] = [];
  private floatingTexts: FloatingCombatText[] = [];

  private spawnTimer: number = 0.3;
  private roadOffsetY: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private screenShake: number = 0;
  private hitStopTimer: number = 0;
  private animTimer: number = 0;
  private vehicleIdCounter: number = 0;

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
          this.setTheme('neo_tokyo');
        } else if (e.key === '2') {
          this.setTheme('sunset_coastal');
        } else if (e.key === '3') {
          this.setTheme('cyber_trench');
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

  public setTheme(theme: TrafficThemeId): void {
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
    this.traffic = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.vehicleIdCounter = 0;

    // 5-Lane Cyber Expressway
    const laneCount = 5;
    const roadWidth = width * 0.72;
    const laneW = roadWidth / laneCount;
    const startX = (width - roadWidth) / 2 + laneW / 2;

    this.lanes = [];
    for (let i = 0; i < laneCount; i++) {
      this.lanes.push(startX + i * laneW);
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const lane = (idx + 1) % this.lanes.length;
      this.playersState.set(p.id, {
        id: p.id,
        laneIdx: lane,
        x: this.lanes[lane],
        y: height * 0.78,
        targetX: this.lanes[lane],
        vx: 0,
        vy: 0,
        speed: 190,
        distance: 0,
        score: 0,
        closeCalls: 0,
        streak: 0,
        stunTimer: 0,
        nitroCharge: 0,
        isNitro: false,
        nitroTimer: 0,
        isUnderdog: false,
        ramBumper: false,
        lastShovedBy: null,
        shoveTimer: 0,
        stuckTimer: 0,
        lastPos: { x: this.lanes[lane], y: height * 0.78 },
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
    const speedMult = isSuddenDeath ? 1.3 : 1.0;

    // Road scroll
    this.roadOffsetY = (this.roadOffsetY + 260 * speedMult * dt) % 40;

    // 1. Spawn dynamic traffic
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (isSuddenDeath ? 0.22 : 0.32) + Math.random() * 0.25;
      const laneIdx = Math.floor(Math.random() * this.lanes.length);
      const laneX = this.lanes[laneIdx];
      const roll = Math.random();

      if (roll < 0.20) {
        // Armored Semi-Truck (Heavy 2-car length hazard)
        this.traffic.push({
          id: ++this.vehicleIdCounter,
          x: laneX,
          y: -100,
          targetX: laneX,
          width: 36,
          height: 82,
          speed: 85 + Math.random() * 30,
          type: 'truck',
          color: '#334155',
          roofColor: '#475569'
        });
      } else if (roll < 0.38) {
        // Golden Courier Van (+45 pts bounty)
        this.traffic.push({
          id: ++this.vehicleIdCounter,
          x: laneX,
          y: -70,
          targetX: laneX,
          width: 32,
          height: 54,
          speed: 130 + Math.random() * 40,
          type: 'courier',
          color: '#F59E0B',
          roofColor: '#FDE047'
        });
      } else {
        // Standard Commuter Pod Sedan
        const colors = ['#64748B', '#475569', '#38BDF8', '#94A3B8', '#A855F7'];
        this.traffic.push({
          id: ++this.vehicleIdCounter,
          x: laneX,
          y: -60,
          targetX: laneX,
          width: 30,
          height: 50,
          speed: 100 + Math.random() * 50,
          type: 'sedan',
          color: colors[Math.floor(Math.random() * colors.length)],
          roofColor: '#1E293B'
        });
      }
    }

    // 2. Update Traffic movement
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const v = this.traffic[i];
      v.y += (240 * speedMult - v.speed) * dt;
      if (v.y > height + 100) {
        this.traffic.splice(i, 1);
      }
    }

    // 3. Update Floating Combat Texts
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
      const car = this.playersState.get(p.id);
      if (!car) continue;

      car.animTime += dt;
      if (car.nitroTimer > 0) car.nitroTimer -= dt;
      if (car.shoveTimer > 0) {
        car.shoveTimer -= dt;
        if (car.shoveTimer <= 0) car.lastShovedBy = null;
      }

      if (car.stunTimer > 0) {
        car.stunTimer -= dt;
        car.currentMood = 'shocked';
        car.speed = Math.max(80, car.speed - 120 * dt);
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Discrete & analog lane steering
      if (this.input.justLeft(p.id)) {
        const curIdx = this.findNearestLane(car.targetX);
        if (curIdx > 0) car.targetX = this.lanes[curIdx - 1];
        this.audio.playTap();
      } else if (this.input.justRight(p.id)) {
        const curIdx = this.findNearestLane(car.targetX);
        if (curIdx < this.lanes.length - 1) car.targetX = this.lanes[curIdx + 1];
        this.audio.playTap();
      } else if (Math.abs(steer) > 0.25) {
        car.targetX += steer * 280 * dt;
        const roadMin = this.lanes[0] - 14;
        const roadMax = this.lanes[this.lanes.length - 1] + 14;
        car.targetX = Math.max(roadMin, Math.min(roadMax, car.targetX));
      }

      // Smooth kinematic lane centering
      car.x += (car.targetX - car.x) * 14 * dt;

      // Vertical positioning adjustment (W/S or throttle)
      const targetY = height * 0.78 - throttle * 60;
      car.y += (targetY - car.y) * 6 * dt;

      // Hold-to-Charge Turbo Nitrous
      if (isAction) {
        car.nitroCharge = Math.min(1.0, car.nitroCharge + dt * 2.4);
        this.particles.spawnSparks(car.x, car.y + 24, p.color, 1);
      }

      if (justReleased && car.nitroCharge > 0.25) {
        // Trigger Turbo Nitrous Burst!
        car.isNitro = true;
        car.nitroTimer = 0.6 + car.nitroCharge * 0.5;
        car.speed = 360;
        this.screenShake = 4.5;
        this.audio.playWhoosh();
        this.particles.spawnSparks(car.x, car.y + 24, '#FFFFFF', 14);
        this.addFloatingText(car.x, car.y - 30, '⚡ NITRO OVERDRIVE!', p.color);
        car.nitroCharge = 0;
      }

      // Max speed & acceleration
      let maxSpeed = 220;
      if (car.nitroTimer > 0) maxSpeed = 380;
      else if (car.isUnderdog) maxSpeed = 260;
      if (isSuddenDeath) maxSpeed += 30;

      const accel = car.nitroTimer > 0 ? 520 : (throttle > 0.1 || isAction ? 240 : -80);
      car.speed = Math.max(140, Math.min(maxSpeed, car.speed + accel * dt));

      car.distance += car.speed * dt * 0.1;
      car.score += dt * (18 + car.streak * 4) * (isSuddenDeath ? 2 : 1);

      // Exhaust sparks when zooming
      if (car.speed > 260) {
        this.particles.emit(car.x - 8, car.y + 24, 1, THEMES[this.currentTheme].accentColor);
        this.particles.emit(car.x + 8, car.y + 24, 1, THEMES[this.currentTheme].accentColor);
      }

      // Mood
      if (car.nitroTimer > 0) car.currentMood = 'triumph';
      else if (car.isUnderdog) car.currentMood = 'focused';
      else car.currentMood = 'idle';

      // Collision & Close-Call Detection with Traffic
      for (const v of this.traffic) {
        const dx = Math.abs(car.x - v.x);
        const dy = Math.abs(car.y - v.y);
        const colW = 30 / 2 + v.width / 2 - 4;
        const colH = 46 / 2 + v.height / 2 - 4;

        if (dx < colW && dy < colH) {
          // Check Underdog Ram Bumper
          if (car.ramBumper) {
            car.ramBumper = false;
            v.y -= 140; // smashes car forward!
            this.audio.playExplosion();
            this.screenShake = 5.0;
            this.particles.spawnSparks(car.x, car.y - 20, '#F59E0B', 18);
            this.addFloatingText(car.x, car.y - 30, '🛡️ RAM BUMPER SMASH!', '#F59E0B');
            continue;
          }

          // Check if hitting Golden Courier Van
          if (v.type === 'courier') {
            v.y = height + 200; // collected!
            car.score += 50 * (isSuddenDeath ? 2 : 1);
            car.nitroCharge = 1.0; // full nitro!
            this.audio.playScore();
            this.particles.spawnSparks(car.x, car.y, '#F59E0B', 20);
            this.addFloatingText(car.x, car.y - 30, '+50 COURIER BOUNTY! 💎', '#F59E0B');
            continue;
          }

          // Crash into traffic!
          car.stunTimer = 0.95;
          car.score = Math.max(0, car.score - 35);
          car.streak = 0;
          car.speed = 100;
          car.currentMood = 'shocked';
          this.screenShake = 7.5;
          this.hitStopTimer = 0.045;
          this.audio.playExplosion();
          this.particles.emit(car.x, car.y, 18, '#EF4444');
          this.addFloatingText(car.x, car.y - 30, 'CRASH! -35', '#EF4444');

          // If shoved into this crash by rival, credit rival!
          if (car.lastShovedBy !== null) {
            const rival = this.playersState.get(car.lastShovedBy);
            if (rival) {
              rival.score += 50;
              this.addFloatingText(rival.x, rival.y - 30, 'HIGHWAY SABOTAGE! +50', '#10B981');
            }
          }
        } else if (dx < colW + 16 && dy < colH + 12 && dx >= colW) {
          // Close Call / Near Miss bonus!
          if (Math.random() < 0.12) {
            car.closeCalls++;
            car.streak++;
            const bonus = 15 + car.streak * 5;
            car.score += bonus;
            this.audio.playTap();
            this.addFloatingText(car.x, car.y - 25, `CLOSE CALL! +${bonus}`, '#38BDF8');
          }
        }
      }
    }

    // 7. Inter-Player Physical Shoving & PIT Maneuvers (m1*v1 + m2*v2)
    for (let i = 0; i < active.length; i++) {
      const c1 = this.playersState.get(active[i].id);
      if (!c1 || c1.stunTimer > 0) continue;

      for (let j = i + 1; j < active.length; j++) {
        const c2 = this.playersState.get(active[j].id);
        if (!c2 || c2.stunTimer > 0) continue;

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 34 && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = 34 - dist;

          c1.x -= nx * overlap * 0.5;
          c1.targetX = c1.x;
          c2.x += nx * overlap * 0.5;
          c2.targetX = c2.x;

          // Check if either is under Nitro (High Speed PIT Shunt!)
          if (c1.nitroTimer > 0 || c2.nitroTimer > 0) {
            this.screenShake = 6.0;
            this.hitStopTimer = 0.045;
            this.audio.playExplosion();

            if (c1.nitroTimer > 0 && c2.nitroTimer <= 0) {
              c2.stunTimer = 0.35;
              c2.targetX += nx * 60;
              c2.lastShovedBy = c1.id;
              c2.shoveTimer = 1.8;
              this.particles.spawnSparks(c2.x, c2.y, '#EF4444', 16);
              this.addFloatingText(c1.x, c1.y - 30, 'PIT SHUNT! 💥', '#10B981');
            } else if (c2.nitroTimer > 0 && c1.nitroTimer <= 0) {
              c1.stunTimer = 0.35;
              c1.targetX -= nx * 60;
              c1.lastShovedBy = c2.id;
              c1.shoveTimer = 1.8;
              this.particles.spawnSparks(c1.x, c1.y, '#EF4444', 16);
              this.addFloatingText(c2.x, c2.y - 30, 'PIT SHUNT! 💥', '#10B981');
            }
          } else {
            // Elastic side scrape
            c1.vx -= nx * 80;
            c2.vx += nx * 80;
            c1.lastShovedBy = c2.id;
            c1.shoveTimer = 1.5;
            c2.lastShovedBy = c1.id;
            c2.shoveTimer = 1.5;
            this.audio.playBounce();
            this.particles.spawnSparks((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, '#F59E0B', 8);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private findNearestLane(x: number): number {
    let nearest = 0;
    let minDist = 9999;
    this.lanes.forEach((lx, idx) => {
      const d = Math.abs(x - lx);
      if (d < minDist) {
        minDist = d;
        nearest = idx;
      }
    });
    return nearest;
  }

  private updateUnderdogStatus(): void {
    const active = this.getActivePlayers();
    if (active.length < 2) return;

    let maxScore = -1;
    let minScore = Infinity;
    for (const p of active) {
      const car = this.playersState.get(p.id);
      if (!car) continue;
      if (car.score > maxScore) maxScore = car.score;
      if (car.score < minScore) minScore = car.score;
    }

    for (const p of active) {
      const car = this.playersState.get(p.id);
      if (!car) continue;
      if (maxScore - car.score >= 60) {
        if (!car.isUnderdog) {
          car.isUnderdog = true;
          car.ramBumper = true;
        }
      } else {
        car.isUnderdog = false;
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
    const car = this.playersState.get(botId);
    if (!car || car.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction Delays:
    // Easy: 380-450ms, blunders into traffic
    // Normal: 220-250ms, cleanly weaves into open lanes
    // Hard: 90-130ms, threads narrow gaps, targets courier vans, shunts rivals
    let delay = 0.24;
    let blunderChance = 0.0;
    if (difficulty === 'bot_easy') {
      delay = 0.40 + Math.random() * 0.08;
      blunderChance = 0.16;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11 + Math.random() * 0.04;
      blunderChance = 0.0;
    } else {
      delay = 0.23 + Math.random() * 0.05;
      blunderChance = 0.05;
    }
    this.botReactionTimers.set(botId, delay);

    // Obstacles ahead in bot's lane
    const ahead = this.traffic.filter(
      v => Math.abs(v.x - car.x) < 32 && v.y < car.y && v.y > car.y - 190
    );

    let steer = 0;
    let throttle = 0.5;
    let nitro = false;

    if (ahead.length > 0 && Math.random() > blunderChance) {
      const curLane = this.findNearestLane(car.x);
      // Evade to safest adjacent lane
      const canGoLeft = curLane > 0;
      const canGoRight = curLane < this.lanes.length - 1;

      if (canGoLeft && Math.random() < 0.5) {
        car.targetX = this.lanes[curLane - 1];
        steer = -1;
      } else if (canGoRight) {
        car.targetX = this.lanes[curLane + 1];
        steer = 1;
      } else if (canGoLeft) {
        car.targetX = this.lanes[curLane - 1];
        steer = -1;
      }
    } else {
      // Clear lane ahead!
      throttle = 1.0;
      if (difficulty === 'bot_hard' || (difficulty === 'bot_normal' && Math.random() < 0.4)) {
        nitro = true;
      }

      // Hard bots: check for rivals nearby to shunt!
      if (difficulty === 'bot_hard') {
        for (const p of this.getActivePlayers()) {
          if (p.id !== botId) {
            const rival = this.playersState.get(p.id);
            if (rival && Math.abs(rival.y - car.y) < 40 && Math.abs(rival.x - car.x) < 50) {
              // Shunt toward rival!
              car.targetX = rival.x;
              steer = rival.x > car.x ? 1 : -1;
              nitro = true;
            }
          }
        }
      }
    }

    this.input.setBotInput(botId, nitro, steer, throttle, nitro);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const car = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: Math.floor(car?.score || 0),
        distance: Math.floor(car?.distance || 0),
        closeCalls: car?.closeCalls || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topDist = scores[0]?.distance || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} weaved through rush hour traffic with ${topDist}m distance (${scores[0].score} pts)!`
      : 'Expressway gridlock claimed all speedsters!';

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

    // 1. City Backdrop
    ctx.fillStyle = theme.cityBackdrop;
    ctx.fillRect(0, 0, width, height);

    // 2. Highway Asphalt Surface
    const roadWidth = width * 0.72;
    const roadX = (width - roadWidth) / 2;
    ctx.fillStyle = theme.roadColor;
    ctx.fillRect(roadX, 0, roadWidth, height);

    // Outer Neon Guardrails
    ctx.strokeStyle = theme.railColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = theme.railGlow;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(roadX, 0);
    ctx.lineTo(roadX, height);
    ctx.moveTo(roadX + roadWidth, 0);
    ctx.lineTo(roadX + roadWidth, height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Lane Dash Markings
    ctx.strokeStyle = theme.laneMarker;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([22, 22]);
    for (let i = 1; i < this.lanes.length; i++) {
      const lx = (this.lanes[i - 1] + this.lanes[i]) / 2;
      ctx.beginPath();
      ctx.moveTo(lx, -40 + this.roadOffsetY);
      ctx.lineTo(lx, height + 40);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Render Traffic Vehicles
    for (const v of this.traffic) {
      this.renderTrafficVehicle(ctx, v);
    }

    // 4. Render Player Cars with Mascots
    for (const p of this.getActivePlayers()) {
      const car = this.playersState.get(p.id);
      if (!car) continue;
      this.renderPlayerCar(ctx, car, p, theme);
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

  private renderTrafficVehicle(ctx: CanvasRenderingContext2D, v: TrafficVehicle): void {
    ctx.save();
    ctx.translate(v.x, v.y);

    if (v.type === 'truck') {
      // Armored Semi-Truck
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.roundRect(-v.width / 2, -v.height / 2, v.width, v.height, 5);
      ctx.fill();
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Trailer roof ridges
      ctx.fillStyle = v.roofColor;
      ctx.beginPath();
      ctx.roundRect(-v.width / 2 + 4, -v.height / 2 + 4, v.width - 8, v.height - 18, 3);
      ctx.fill();

      // Cab windshield
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-v.width / 2 + 6, v.height / 2 - 12, v.width - 12, 6);

      // Red Taillights
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-v.width / 2 + 3, -v.height / 2 + 2, 7, 3);
      ctx.fillRect(v.width / 2 - 10, -v.height / 2 + 2, 7, 3);
    } else if (v.type === 'courier') {
      // Golden Courier Van
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.roundRect(-v.width / 2, -v.height / 2, v.width, v.height, 5);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glowing Diamond Decal
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();

      // Red Taillights
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-v.width / 2 + 3, v.height / 2 - 4, 6, 3);
      ctx.fillRect(v.width / 2 - 9, v.height / 2 - 4, 6, 3);
    } else {
      // Commuter Sedan
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.roundRect(-v.width / 2, -v.height / 2, v.width, v.height, 5);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Roof & Windshield
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-v.width / 2 + 3, -v.height / 2 + 10, v.width - 6, v.height - 20, 3);
      ctx.fill();

      // Red Taillights
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-v.width / 2 + 3, v.height / 2 - 4, 6, 3);
      ctx.fillRect(v.width / 2 - 9, v.height / 2 - 4, 6, 3);
    }

    ctx.restore();
  }

  private renderPlayerCar(ctx: CanvasRenderingContext2D, car: CyberSpeedster, p: PlayerConfig, theme: TrafficTheme): void {
    ctx.save();
    ctx.translate(car.x, car.y);

    if (car.stunTimer > 0 && Math.floor(car.stunTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Underdog Ram Bumper
    if (car.ramBumper) {
      ctx.save();
      const pulse = (Math.sin(this.animTimer * 8) + 1) * 0.5;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, -18, 22 + pulse * 2, -Math.PI * 0.7, -Math.PI * 0.3);
      ctx.stroke();
      ctx.restore();
    }

    // Turbo Flame Exhaust
    if (car.nitroTimer > 0 || car.speed > 280) {
      ctx.save();
      const flameLen = 14 + Math.random() * 10;
      ctx.fillStyle = theme.accentColor;
      ctx.beginPath();
      ctx.moveTo(-8, 24);
      ctx.lineTo(0, 24 + flameLen);
      ctx.lineTo(8, 24);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Cyber Roadster Chassis
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(-16, -24, 32, 48, 6);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Racing Livery Bonnet
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(-11, -18, 22, 36, 4);
    ctx.fill();

    // Transparent Cockpit Bubble with Mascot Driver
    ctx.save();
    ctx.translate(0, 0);
    drawCharacter(
      ctx,
      0,
      0,
      8,
      p.id,
      p.type !== 'human',
      car.currentMood,
      car.animTime,
      undefined
    );
    ctx.restore();

    // Glass Windshield
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Twin Neon Headlights
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(-12, -24, 6, 3);
    ctx.fillRect(6, -24, 6, 3);

    ctx.restore(); // Restore car transform

    // HUD Badge above car
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-24, -40, 48, 14, 3);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.floor(car.score)}`, 0, -33);
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
      ? '🔥 RUSH HOUR SURGE! 2X POINTS & COURIERS'
      : 'A/D: WEAVE LANES • HOLD ACTION: NITRO • SHUNT RIVALS';
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Status Cards (Offset to y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const car = this.playersState.get(p.id);
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
        car?.currentMood || 'idle',
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
      ctx.fillText(`${Math.floor(car?.score || 0)} pts`, cardX + 42, cardY + 23);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "Chakra Petch", monospace';
      ctx.fillText(`🏎️ ${Math.floor(car?.distance || 0)}m`, cardX + 42, cardY + 38);
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
    ctx.fillText('STEER: A/D/LANES • HOLD ACTION: NITRO BURST', width - 20, height - 14);

    ctx.restore();
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
