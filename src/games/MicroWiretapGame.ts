import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface WiretapItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'pin_bug' | 'tape_recorder' | 'matrix_transmitter';
  value: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface WiretapAgent {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Acoustic feedback stun
  sonicPulseTimer: number; // Silent stealth sprint
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  floorColor: string;
  rugColor: string;
  rugBorder: string;
  deskColor: string;
  deskTrim: string;
  pulseColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Grand Diplomatic Embassy',
    icon: '🏛️',
    bgGradTop: '#1E140A',
    bgGradBottom: '#0A0602',
    floorColor: '#3B2314',
    rugColor: '#7F1D1D',
    rugBorder: '#F59E0B',
    deskColor: '#451A03',
    deskTrim: '#D97706',
    pulseColor: '#34D399'
  },
  {
    name: 'Pentagon War Room',
    icon: '🌐',
    bgGradTop: '#0B132B',
    bgGradBottom: '#020617',
    floorColor: '#1E293B',
    rugColor: '#1E3A8A',
    rugBorder: '#38BDF8',
    deskColor: '#0F172A',
    deskTrim: '#0284C7',
    pulseColor: '#38BDF8'
  },
  {
    name: 'Geneva Chalet Hideout',
    icon: '🇨🇭',
    bgGradTop: '#1C1917',
    bgGradBottom: '#0C0A09',
    floorColor: '#292524',
    rugColor: '#14532D',
    rugBorder: '#84CC16',
    deskColor: '#3F2E1E',
    deskTrim: '#A16207',
    pulseColor: '#4ADE80'
  }
];

export class MicroWiretapGame extends BaseGame {
  private agents: Map<PlayerId, WiretapAgent> = new Map();
  private items: WiretapItem[] = [];
  private nextItemId = 1;
  private itemSpawnTimer = 0;

  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setTheme(0);
      } else if (e.key === '2') {
        this.setTheme(1);
      } else if (e.key === '3') {
        this.setTheme(2);
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const canvasHeight = canvas.height;
      if (mouseX >= 20 && mouseX <= 190 && mouseY >= canvasHeight - 44 && mouseY <= canvasHeight - 12) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickHandler);
  }

  private cycleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
    this.audio.playTap();
    this.triggerAnnouncement(`THEME: ${THEMES[this.currentThemeIndex].name}`);
  }

  private setTheme(index: number): void {
    if (index >= 0 && index < THEMES.length) {
      this.currentThemeIndex = index;
      this.audio.playTap();
      this.triggerAnnouncement(`THEME: ${THEMES[this.currentThemeIndex].name}`);
    }
  }

  private triggerAnnouncement(msg: string, duration: number = 1.6): void {
    this.announcementText = msg;
    this.announcementTimer = duration;
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.items = [];
    this.nextItemId = 1;
    this.itemSpawnTimer = 0;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    const active = this.getActivePlayers();
    this.agents.clear();
    this.botReactionTimers.clear();

    const cx = width / 2;
    const cy = height / 2;
    const spawnDist = Math.min(width, height) * 0.35;

    active.forEach((p, idx) => {
      const angle = (idx / active.length) * Math.PI * 2 - Math.PI / 2;
      this.agents.set(p.id, {
        id: p.id,
        x: cx + Math.cos(angle) * spawnDist,
        y: cy + Math.sin(angle) * spawnDist,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        sonicPulseTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, 0);
    });

    // Seed initial listening devices
    for (let i = 0; i < 7; i++) {
      this.spawnItem(width, height);
    }
  }

  private spawnItem(width: number, height: number): void {
    const marginX = 80;
    const minY = 100;
    const maxY = height - 120;

    const x = marginX + Math.random() * (width - marginX * 2);
    const y = minY + Math.random() * (maxY - minY);

    const roll = Math.random();
    let type: 'pin_bug' | 'tape_recorder' | 'matrix_transmitter' = 'pin_bug';
    let value = 20;
    let radius = 13;

    if (this.roundTimer <= 12) {
      if (roll < 0.35) {
        type = 'matrix_transmitter';
        value = 75;
        radius = 18;
      } else if (roll < 0.70) {
        type = 'tape_recorder';
        value = 45;
        radius = 15;
      }
    } else {
      if (roll < 0.15) {
        type = 'matrix_transmitter';
        value = 75;
        radius = 18;
      } else if (roll < 0.45) {
        type = 'tape_recorder';
        value = 45;
        radius = 15;
      }
    }

    this.items.push({
      id: this.nextItemId++,
      x,
      y,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
      type,
      value,
      radius,
      pulsePhase: Math.random() * Math.PI * 2,
      collected: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    const cx = width / 2;
    const cy = height / 2;
    const isSuddenDeath = this.roundTimer <= 12.0;

    // Leader score check for Underdog Surge
    let highestScore = 0;
    for (const ag of this.agents.values()) {
      if (ag.score > highestScore) highestScore = ag.score;
    }
    for (const ag of this.agents.values()) {
      ag.isUnderdog = (highestScore - ag.score) >= 35 && highestScore > 30;
    }

    // Spawn items periodically
    this.itemSpawnTimer += dt;
    const spawnInterval = isSuddenDeath ? 0.7 : 1.3;
    const maxItems = isSuddenDeath ? 12 : 9;
    if (this.itemSpawnTimer >= spawnInterval && this.items.filter(i => !i.collected).length < maxItems) {
      this.itemSpawnTimer = 0;
      this.spawnItem(width, height);
    }

    // Update floating listening items
    for (const item of this.items) {
      if (item.collected) continue;
      item.pulsePhase += dt * 3.5;
      item.x += item.vx * dt;
      item.y += item.vy * dt;

      // Bounce within bounds
      if (item.x < 60) { item.x = 60; item.vx = -item.vx; }
      if (item.x > width - 60) { item.x = width - 60; item.vx = -item.vx; }
      if (item.y < 90) { item.y = 90; item.vy = -item.vy; }
      if (item.y > height - 100) { item.y = height - 100; item.vy = -item.vy; }
    }

    this.updateBots(dt, width, height);

    // Update Agents
    for (const ag of this.agents.values()) {
      ag.animTimer += dt;

      if (ag.streakTimer > 0) {
        ag.streakTimer -= dt;
        if (ag.streakTimer <= 0) {
          ag.streakCount = 0;
        }
      }

      if (ag.overheatTimer > 0) {
        ag.overheatTimer -= dt;
        ag.mood = 'shocked';
        ag.vx *= Math.pow(0.05, dt);
        ag.vy *= Math.pow(0.05, dt);
        ag.x += ag.vx * dt;
        ag.y += ag.vy * dt;
        continue;
      }

      if (ag.stunTimer > 0) {
        ag.stunTimer -= dt;
        ag.mood = 'shocked';
        ag.vx *= Math.pow(0.1, dt);
        ag.vy *= Math.pow(0.1, dt);
        ag.x += ag.vx * dt;
        ag.y += ag.vy * dt;
        continue;
      }

      if (ag.sonicPulseTimer > 0) {
        ag.sonicPulseTimer -= dt;
      }

      // Input reading
      const steerX = this.input.getSteer(ag.id);
      const throttleY = -this.input.getThrottle(ag.id);
      const actionHeld = this.input.isActionPressed(ag.id) || this.input.isPressed(ag.id);

      // Movement physics
      let baseSpeed = ag.isUnderdog ? 290 : 240;
      if (ag.sonicPulseTimer > 0) baseSpeed *= 1.35;
      const speed = ag.isCharging ? baseSpeed * 0.45 : baseSpeed;

      if (Math.hypot(steerX, throttleY) > 0.15) {
        const moveAng = Math.atan2(throttleY, steerX);
        ag.angle = moveAng;
        ag.vx += Math.cos(moveAng) * speed * 7.5 * dt;
        ag.vy += Math.sin(moveAng) * speed * 7.5 * dt;
      }

      // Kinematic damping
      const damping = Math.pow(0.04, dt);
      ag.vx *= damping;
      ag.vy *= damping;

      ag.x += ag.vx * dt;
      ag.y += ag.vy * dt;

      // Arena boundaries
      const minX = 40;
      const maxX = width - 40;
      const minY = 80;
      const maxY = height - 90;

      if (ag.x < minX) { ag.x = minX; ag.vx = -ag.vx * 0.4; }
      if (ag.x > maxX) { ag.x = maxX; ag.vx = -ag.vx * 0.4; }
      if (ag.y < minY) { ag.y = minY; ag.vy = -ag.vy * 0.4; }
      if (ag.y > maxY) { ag.y = maxY; ag.vy = -ag.vy * 0.4; }

      // Central Ambassador Desk Collision (110x70 centered)
      const deskW = 120;
      const deskH = 80;
      if (Math.abs(ag.x - cx) < deskW / 2 + 18 && Math.abs(ag.y - cy) < deskH / 2 + 18) {
        const outX = ag.x > cx ? 1 : -1;
        const outY = ag.y > cy ? 1 : -1;
        ag.vx = outX * 160;
        ag.vy = outY * 160;
      }

      // Action Charging: Sonic Screwdriver & Ultrasonic EMP Sweet Spot
      if (actionHeld) {
        ag.isCharging = true;
        ag.chargeTime += dt;
        ag.mood = 'focused';

        // Overcharge penalty (> 1.25s)
        if (ag.chargeTime >= 1.25) {
          ag.chargeTime = 0;
          ag.isCharging = false;
          ag.overheatTimer = 0.85;
          ag.score = Math.max(0, ag.score - 5);
          this.audio.playExplosion();
          this.screenShake = 12;
          this.particles.emit(ag.x, ag.y, 25, '#EF4444');
          this.triggerAnnouncement(`${this.getPlayer(ag.id)?.name || 'AGENT'} ACOUSTIC FEEDBACK SCREECH!`, 1.2);
          continue;
        }
      } else if (ag.isCharging) {
        // Evaluate Sweet Spot
        const chargeRatio = ag.chargeTime / 1.0;
        const sweetSpotMin = ag.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = ag.isUnderdog ? 1.05 : 0.98;

        if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
          // SWEET SPOT: Ultrasonic Bug Plant & Acoustic EMP Pulse!
          ag.sonicPulseTimer = 1.6;
          ag.mood = 'triumph';
          ag.score += 25; // Bug Master Bonus!
          this.audio.playScore();
          this.screenShake = 14;

          this.particles.emit(ag.x, ag.y, 35, '#34D399');
          this.particles.emit(ag.x, ag.y, 20, '#F59E0B');

          // Ultrasonic dash
          ag.vx += Math.cos(ag.angle) * 350;
          ag.vy += Math.sin(ag.angle) * 350;

          // Siphon nearby listening devices within 140px
          const siphonRadius = ag.isUnderdog ? 190 : 140;
          let siphonedCount = 0;
          for (const it of this.items) {
            if (it.collected) continue;
            const dist = Math.hypot(it.x - ag.x, it.y - ag.y);
            if (dist <= siphonRadius) {
              it.collected = true;
              siphonedCount++;
              const pts = (isSuddenDeath ? it.value * 2 : it.value);
              ag.score += pts;
              this.particles.emit(it.x, it.y, 16, '#10B981');
            }
          }

          if (siphonedCount > 0) {
            this.audio.playBounce();
            this.triggerAnnouncement(`${this.getPlayer(ag.id)?.name || 'AGENT'} ULTRASONIC SWEEP (+${siphonedCount} BUGS)!`, 1.4);
          } else {
            this.triggerAnnouncement(`${this.getPlayer(ag.id)?.name || 'AGENT'} ACOUSTIC FREQUENCY BURST!`, 1.2);
          }

          // Stun nearby rivals with ear-splitting pulse
          for (const other of this.agents.values()) {
            if (other.id === ag.id) continue;
            const dist = Math.hypot(other.x - ag.x, other.y - ag.y);
            if (dist <= 110 && other.sonicPulseTimer <= 0) {
              other.stunTimer = 0.75;
              other.mood = 'shocked';
              const pushAng = Math.atan2(other.y - ag.y, other.x - ag.x);
              other.vx += Math.cos(pushAng) * 270;
              other.vy += Math.sin(pushAng) * 270;
              this.particles.emit(other.x, other.y, 16, '#F59E0B');
            }
          }
        } else {
          // Minor pulse
          ag.vx += Math.cos(ag.angle) * 160;
          ag.vy += Math.sin(ag.angle) * 160;
          this.audio.playTap();
          this.particles.emit(ag.x, ag.y, 12, '#34D399');
        }

        ag.chargeTime = 0;
        ag.isCharging = false;
      } else {
        ag.mood = 'idle';
      }

      // Check Item Pickup
      const grabRadius = ag.isUnderdog ? 38 : 28;
      for (const item of this.items) {
        if (item.collected) continue;
        const dist = Math.hypot(item.x - ag.x, item.y - ag.y);
        if (dist <= grabRadius + item.radius) {
          item.collected = true;
          ag.streakCount++;
          ag.streakTimer = 2.8;

          let multiplier = 1.0;
          if (ag.streakCount >= 4) multiplier = 2.5;
          else if (ag.streakCount >= 3) multiplier = 2.0;
          else if (ag.streakCount >= 2) multiplier = 1.5;

          const pts = Math.round((isSuddenDeath ? item.value * 2 : item.value) * multiplier);
          ag.score += pts;

          this.audio.playTap();
          const col = item.type === 'matrix_transmitter' ? '#F59E0B' : (item.type === 'tape_recorder' ? '#8B5CF6' : '#10B981');
          this.particles.emit(item.x, item.y, 18, col);

          if (item.type === 'matrix_transmitter') {
            this.audio.playScore();
            this.triggerAnnouncement(`AMBASSADOR BUG MATRIX SECURED! +${pts} PTS!`, 1.5);
          }
        }
      }
    }

    // Physical Agent-to-Agent Collision & Embassy Shunts
    const agentArr = Array.from(this.agents.values());
    for (let i = 0; i < agentArr.length; i++) {
      for (let j = i + 1; j < agentArr.length; j++) {
        const a1 = agentArr[i];
        const a2 = agentArr[j];

        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 40;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = minDist - dist;
          a1.x -= nx * overlap * 0.5;
          a1.y -= ny * overlap * 0.5;
          a2.x += nx * overlap * 0.5;
          a2.y += ny * overlap * 0.5;

          const rvx = a2.vx - a1.vx;
          const rvy = a2.vy - a1.vy;
          const velAlongNorm = rvx * nx + rvy * ny;

          if (velAlongNorm < 0) {
            const restitution = 1.45;
            const impulse = -(1 + restitution) * velAlongNorm * 0.5;

            a1.vx -= nx * impulse;
            a1.vy -= ny * impulse;
            a2.vx += nx * impulse;
            a2.vy += ny * impulse;

            this.audio.playBounce();

            const speed1 = Math.hypot(a1.vx, a1.vy);
            const speed2 = Math.hypot(a2.vx, a2.vy);

            if (speed1 > speed2 + 80 || a1.sonicPulseTimer > 0) {
              a1.sabotageCount++;
              a1.score += 30; // Desk Shunt Sabotage Bonus
              a2.stunTimer = 0.7;
              a2.score = Math.max(0, a2.score - 10);
              this.particles.emit(a2.x, a2.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(a1.id)?.name || 'P1'} DESK-SHUNTED ${this.getPlayer(a2.id)?.name || 'P2'}! (+30 PTS)`, 1.5);
            } else if (speed2 > speed1 + 80 || a2.sonicPulseTimer > 0) {
              a2.sabotageCount++;
              a2.score += 30;
              a1.stunTimer = 0.7;
              a1.score = Math.max(0, a1.score - 10);
              this.particles.emit(a1.x, a1.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(a2.id)?.name || 'P2'} DESK-SHUNTED ${this.getPlayer(a1.id)?.name || 'P1'}! (+30 PTS)`, 1.5);
            }
          }
        }
      }
    }

    // Clean up collected items
    this.items = this.items.filter(i => !i.collected);
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const ag = this.agents.get(botId);
    if (!ag || ag.stunTimer > 0 || ag.overheatTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.10 : (difficulty === 'bot_normal' ? 0.23 : 0.42);
      reactionTimer = delay + Math.random() * 0.05;
      this.botReactionTimers.set(botId, reactionTimer);

      const cx = width / 2;
      const cy = height / 2;

      // Find best target listening item
      let bestTarget: { x: number; y: number } | null = null;
      let highestWeight = -1;

      for (const item of this.items) {
        if (item.collected) continue;
        const dist = Math.hypot(item.x - ag.x, item.y - ag.y);
        let weight = (item.value * 2) - dist * 0.2;
        if (item.type === 'matrix_transmitter') weight += 70;

        if (weight > highestWeight) {
          highestWeight = weight;
          bestTarget = { x: item.x, y: item.y };
        }
      }

      // Hard bots actively hunt rivals to desk-shunt them
      if (difficulty === 'bot_hard') {
        for (const other of this.agents.values()) {
          if (other.id === botId) continue;
          const distToOther = Math.hypot(other.x - ag.x, other.y - ag.y);
          if (distToOther < 120 && other.score > ag.score) {
            bestTarget = { x: other.x, y: other.y };
            break;
          }
        }
      }

      // Default wander
      if (!bestTarget) {
        bestTarget = { x: cx + (Math.random() - 0.5) * 250, y: cy + (Math.random() - 0.5) * 200 };
      }

      // Easy blunder
      if (difficulty === 'bot_easy' && Math.random() < 0.22) {
        bestTarget = { x: ag.x + (Math.random() - 0.5) * 150, y: ag.y + (Math.random() - 0.5) * 150 };
      }

      const targetAng = Math.atan2(bestTarget.y - ag.y, bestTarget.x - ag.x);
      const steerX = Math.cos(targetAng);
      const throttleY = -Math.sin(targetAng);

      // Action button charge logic
      let shouldAction = false;
      const targetDist = Math.hypot(bestTarget.x - ag.x, bestTarget.y - ag.y);

      if (difficulty === 'bot_hard') {
        if (!ag.isCharging && targetDist > 80 && Math.random() < 0.65) {
          shouldAction = true;
        } else if (ag.isCharging) {
          const sweetSpotMin = ag.isUnderdog ? 0.50 : 0.72;
          const sweetSpotMax = ag.isUnderdog ? 1.05 : 0.98;
          const chargeRatio = ag.chargeTime / 1.0;
          if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
            shouldAction = false; // Sweet spot release!
          } else {
            shouldAction = true;
          }
        }
      } else if (difficulty === 'bot_normal') {
        if (!ag.isCharging && Math.random() < 0.3) {
          shouldAction = true;
        } else if (ag.isCharging && ag.chargeTime > 0.8) {
          shouldAction = false;
        } else if (ag.isCharging) {
          shouldAction = true;
        }
      }

      this.input.setBotInput(botId, shouldAction, steerX, throttleY);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Screen Shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    const theme = THEMES[this.currentThemeIndex];
    const cx = width / 2;
    const cy = height / 2;

    // Background Gradient (Walls / Room atmosphere)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Embassy Parquet Hardwood Floor
    const roomMarginX = 30;
    const roomMarginY = 70;
    const roomW = width - roomMarginX * 2;
    const roomH = height - roomMarginY - 30;

    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(roomMarginX, roomMarginY, roomW, roomH);

    // Floor Parquet Wood Slat Lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1.5;
    for (let x = roomMarginX + 35; x < roomMarginX + roomW; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, roomMarginY);
      ctx.lineTo(x, roomMarginY + roomH);
      ctx.stroke();
    }

    // Grand Persian Center Rug
    const rugW = roomW * 0.70;
    const rugH = roomH * 0.70;
    const rugX = cx - rugW / 2;
    const rugY = cy - rugH / 2 + 10;

    ctx.fillStyle = theme.rugColor;
    ctx.fillRect(rugX, rugY, rugW, rugH);

    // Ornate Gold Rug Border & Fringe
    ctx.strokeStyle = theme.rugBorder;
    ctx.lineWidth = 3;
    ctx.strokeRect(rugX + 5, rugY + 5, rugW - 10, rugH - 10);
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(rugX + 12, rugY + 12, rugW - 24, rugH - 24);
    ctx.setLineDash([]);

    // Central Ambassador Executive Desk (120x80)
    const deskW = 120;
    const deskH = 80;
    const deskX = cx - deskW / 2;
    const deskY = cy - deskH / 2;

    // Desk Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(deskX + 6, deskY + 8, deskW, deskH, 10);
    ctx.fill();

    // Mahogany Desk Top
    ctx.fillStyle = theme.deskColor;
    ctx.beginPath();
    ctx.roundRect(deskX, deskY, deskW, deskH, 10);
    ctx.fill();

    // Brass / Gold Trim & Leather Blotter
    ctx.strokeStyle = theme.deskTrim;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#172554';
    ctx.fillRect(deskX + 25, deskY + 15, deskW - 50, deskH - 30);

    // Ambassador's Red Hotline Phone & Desk Lamp
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(deskX + 35, deskY + 28, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(deskX + deskW - 35, deskY + 28, 8, 0, Math.PI * 2);
    ctx.fill();

    // Render Floating Listening Items
    for (const item of this.items) {
      if (item.collected) continue;

      ctx.save();
      ctx.translate(item.x, item.y);
      const bobY = Math.sin(item.pulsePhase) * 4;
      ctx.translate(0, bobY);

      // Item shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 16 - bobY, item.radius * 0.9, item.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (item.type === 'matrix_transmitter') {
        // Glowing Ambassador Bug Matrix
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + item.pulsePhase * 0.8;
          const px = Math.cos(a) * item.radius;
          const py = Math.sin(a) * item.radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('75', 0, 0);
      } else if (item.type === 'tape_recorder') {
        // Reel-to-Reel Tape Recorder
        ctx.fillStyle = '#8B5CF6';
        ctx.shadowColor = '#C084FC';
        ctx.shadowBlur = 10;
        ctx.fillRect(-item.radius, -item.radius * 0.6, item.radius * 2, item.radius * 1.2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-item.radius, -item.radius * 0.6, item.radius * 2, item.radius * 1.2);

        // Rotating reels
        const spin = item.pulsePhase * 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-item.radius * 0.45, 0, 4, 0, Math.PI * 2);
        ctx.arc(item.radius * 0.45, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('45', 0, 16);
      } else {
        // Micro Lapel Pin Bug
        ctx.fillStyle = '#10B981';
        ctx.shadowColor = '#34D399';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, item.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Antenna
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -item.radius * 0.8);
        ctx.lineTo(0, -item.radius * 1.6);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('20', 0, 0);
      }

      ctx.restore();
    }

    // Render Agents
    for (const ag of this.agents.values()) {
      const pConfig = this.getPlayer(ag.id);
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      ctx.save();
      ctx.translate(ag.x, ag.y);

      // Character Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Underdog Hush Dampener Aura
      if (ag.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 30 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Sonic Pulse Stealth Aura
      if (ag.sonicPulseTimer > 0) {
        ctx.strokeStyle = theme.pulseColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Mascot Character
      drawCharacter(
        ctx,
        0,
        0,
        18,
        ag.id,
        isBot,
        ag.mood,
        ag.animTimer
      );

      // Facing Direction Arrow / Stethoscope Probe
      ctx.save();
      ctx.rotate(ag.angle);
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(8, 4);
      ctx.stroke();
      ctx.restore();

      // Hold-to-Charge Sonic Screwdriver Ring
      if (ag.isCharging) {
        const chargeRatio = Math.min(1.0, ag.chargeTime / 1.0);
        const sweetSpotMin = ag.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = ag.isUnderdog ? 1.05 : 0.98;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 30, sweetSpotMin * Math.PI * 2 - Math.PI / 2, sweetSpotMax * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        const isSweet = chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax;
        ctx.strokeStyle = isSweet ? '#F59E0B' : '#34D399';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI / 2, chargeRatio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        ctx.fillStyle = isSweet ? '#F59E0B' : '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isSweet ? 'SWEET SPOT!' : 'TUNING...', 0, -38);
      }

      // Status text
      if (ag.overheatTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FEEDBACK STUN', 0, 34);
      } else if (ag.stunTimer > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ACOUSTIC STUN', 0, 34);
      }

      ctx.restore();
    }

    // Top Global Timer Safe Zone: y: 12-44, x: width/2 - 80 to width/2 + 80
    // Render Minigame Header Badge at y: 56, h: 28
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 1.5;
    const badgeW = 390;
    const badgeH = 26;
    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, 56, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MICRO WIRETAP // EMBASSY BUG PLANT SHOWDOWN', cx, 56 + badgeH / 2);
    ctx.restore();

    // Central Announcement Banner
    if (this.announcementTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      const bW = Math.min(width - 40, 480);
      const bH = 34;
      ctx.beginPath();
      ctx.roundRect(cx - bW / 2, height * 0.28, bW, bH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FCD34D';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.announcementText, cx, height * 0.28 + bH / 2);
      ctx.restore();
    }

    // Sudden Death Pulsing Banner
    if (this.roundTimer <= 12.0) {
      ctx.save();
      const pulseSD = Math.sin(Date.now() * 0.008) > 0;
      ctx.fillStyle = pulseSD ? '#EF4444' : '#F97316';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ DIPLOMATIC SWEEP: DOUBLE BUG SCORES! ⚡', cx, 98);
      ctx.restore();
    }

    // Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, 30, height - 28);
    ctx.restore();

    // Corner Player Score Cards: y: height - 128 (130x48px)
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const ag = this.agents.get(p.id);
      if (!ag) continue;

      let cardX = 20;
      if (i === 1) cardX = width - 150;
      else if (i === 2) cardX = 160;
      else if (i === 3) cardX = width - 290;

      const cardY = height - 128;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = ag.isUnderdog ? '#F59E0B' : p.color;
      ctx.lineWidth = ag.isUnderdog ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 16);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${ag.score} PTS`, cardX + 10, cardY + 36);

      if (ag.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${ag.streakCount}x`, cardX + 120, cardY + 36);
      }

      ctx.restore();
    }

    ctx.restore(); // End canvas save
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.agents.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerAg = winnerId ? this.agents.get(winnerId) : null;
    let highlight = 'The embassy security swept the room clean!';
    if (winnerId && winnerAg) {
      const pName = this.getPlayer(winnerId)?.name || 'Agent';
      if (winnerAg.sabotageCount >= 2) {
        highlight = `${pName} slammed rivals into the ambassador desk and wired the room!`;
      } else {
        highlight = `${pName} planted embassy listening bugs with a master score of ${winnerAg.score}!`;
      }
    }

    return {
      winnerId,
      rankings,
      mvpHighlight: highlight
    };
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      if (this.clickHandler) {
        window.removeEventListener('click', this.clickHandler);
      }
    }
    super.destroy();
  }
}
