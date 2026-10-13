import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface MaskedAgent {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'courier' | 'spymaster' | 'phantom_duchess';
  value: number;
  radius: number;
  pulsePhase: number;
  active: boolean;
  maskColor: string;
}

interface BallroomDetective {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Accusation gaffe stun
  flashSprintTimer: number; // Waltz sprint boost
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
  ballroomFloor: string;
  marbleCheck1: string;
  marbleCheck2: string;
  pillarColor: string;
  chandelierGlow: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Venetian Grand Ballroom',
    icon: '🎭',
    bgGradTop: '#260B14',
    bgGradBottom: '#0A0205',
    ballroomFloor: '#1F1315',
    marbleCheck1: '#3F1A24',
    marbleCheck2: '#180B0F',
    pillarColor: '#F59E0B',
    chandelierGlow: 'rgba(251, 191, 36, 0.22)'
  },
  {
    name: 'Gothic Phantom Opera',
    icon: '🥀',
    bgGradTop: '#150824',
    bgGradBottom: '#05010A',
    ballroomFloor: '#160D24',
    marbleCheck1: '#2E154D',
    marbleCheck2: '#0F0619',
    pillarColor: '#8B5CF6',
    chandelierGlow: 'rgba(168, 85, 247, 0.22)'
  },
  {
    name: 'Neo-Vienna Royal Gala',
    icon: '👑',
    bgGradTop: '#1E140A',
    bgGradBottom: '#0A0602',
    ballroomFloor: '#2E1F10',
    marbleCheck1: '#4A341D',
    marbleCheck2: '#1C1208',
    pillarColor: '#D97706',
    chandelierGlow: 'rgba(245, 158, 11, 0.22)'
  }
];

export class DisguiseShuffleGame extends BaseGame {
  private detectives: Map<PlayerId, BallroomDetective> = new Map();
  private agents: MaskedAgent[] = [];
  private nextAgentId = 1;
  private agentSpawnTimer = 0;

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
    this.agents = [];
    this.nextAgentId = 1;
    this.agentSpawnTimer = 0;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    const active = this.getActivePlayers();
    this.detectives.clear();
    this.botReactionTimers.clear();

    const cx = width / 2;
    const cy = height / 2;
    const spawnDist = Math.min(width, height) * 0.35;

    active.forEach((p, idx) => {
      const angle = (idx / active.length) * Math.PI * 2 - Math.PI / 2;
      this.detectives.set(p.id, {
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
        flashSprintTimer: 0,
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

    // Seed initial masked agents
    for (let i = 0; i < 7; i++) {
      this.spawnAgent(width, height);
    }
  }

  private spawnAgent(width: number, height: number): void {
    const marginX = 80;
    const minY = 100;
    const maxY = height - 120;

    const x = marginX + Math.random() * (width - marginX * 2);
    const y = minY + Math.random() * (maxY - minY);

    const roll = Math.random();
    let type: 'courier' | 'spymaster' | 'phantom_duchess' = 'courier';
    let value = 20;
    let radius = 14;
    let speed = 65 + Math.random() * 45;
    let maskColor = '#10B981';

    if (this.roundTimer <= 12) {
      if (roll < 0.35) {
        type = 'phantom_duchess';
        value = 75;
        radius = 18;
        speed = 50;
        maskColor = '#F59E0B';
      } else if (roll < 0.70) {
        type = 'spymaster';
        value = 45;
        radius = 16;
        speed = 75;
        maskColor = '#8B5CF6';
      }
    } else {
      if (roll < 0.15) {
        type = 'phantom_duchess';
        value = 75;
        radius = 18;
        speed = 50;
        maskColor = '#F59E0B';
      } else if (roll < 0.45) {
        type = 'spymaster';
        value = 45;
        radius = 16;
        speed = 75;
        maskColor = '#8B5CF6';
      }
    }

    const ang = Math.random() * Math.PI * 2;
    this.agents.push({
      id: this.nextAgentId++,
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      type,
      value,
      radius,
      pulsePhase: Math.random() * Math.PI * 2,
      active: true,
      maskColor
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

    const isSuddenDeath = this.roundTimer <= 12.0;

    // Leader score check for Underdog Surge
    let highestScore = 0;
    for (const d of this.detectives.values()) {
      if (d.score > highestScore) highestScore = d.score;
    }
    for (const d of this.detectives.values()) {
      d.isUnderdog = (highestScore - d.score) >= 35 && highestScore > 30;
    }

    // Spawn agents periodically
    this.agentSpawnTimer += dt;
    const spawnInterval = isSuddenDeath ? 0.7 : 1.3;
    const maxAgents = isSuddenDeath ? 12 : 9;
    if (this.agentSpawnTimer >= spawnInterval && this.agents.filter(a => a.active).length < maxAgents) {
      this.agentSpawnTimer = 0;
      this.spawnAgent(width, height);
    }

    // Update active agents
    for (const ag of this.agents) {
      if (!ag.active) continue;
      ag.pulsePhase += dt * 3.5;
      ag.x += ag.vx * dt;
      ag.y += ag.vy * dt;

      // Bounce within bounds
      if (ag.x < 60) { ag.x = 60; ag.vx = -ag.vx; }
      if (ag.x > width - 60) { ag.x = width - 60; ag.vx = -ag.vx; }
      if (ag.y < 90) { ag.y = 90; ag.vy = -ag.vy; }
      if (ag.y > height - 100) { ag.y = height - 100; ag.vy = -ag.vy; }
    }

    this.updateBots(dt, width, height);

    // Update Detectives
    for (const d of this.detectives.values()) {
      d.animTimer += dt;

      if (d.streakTimer > 0) {
        d.streakTimer -= dt;
        if (d.streakTimer <= 0) {
          d.streakCount = 0;
        }
      }

      if (d.overheatTimer > 0) {
        d.overheatTimer -= dt;
        d.mood = 'shocked';
        d.vx *= Math.pow(0.05, dt);
        d.vy *= Math.pow(0.05, dt);
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        continue;
      }

      if (d.stunTimer > 0) {
        d.stunTimer -= dt;
        d.mood = 'shocked';
        d.vx *= Math.pow(0.1, dt);
        d.vy *= Math.pow(0.1, dt);
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        continue;
      }

      if (d.flashSprintTimer > 0) {
        d.flashSprintTimer -= dt;
      }

      // Input reading
      const steerX = this.input.getSteer(d.id);
      const throttleY = -this.input.getThrottle(d.id);
      const actionHeld = this.input.isActionPressed(d.id) || this.input.isPressed(d.id);

      // Movement physics
      let baseSpeed = d.isUnderdog ? 295 : 245;
      if (d.flashSprintTimer > 0) baseSpeed *= 1.40;
      const speed = d.isCharging ? baseSpeed * 0.45 : baseSpeed;

      if (Math.hypot(steerX, throttleY) > 0.15) {
        const moveAng = Math.atan2(throttleY, steerX);
        d.angle = moveAng;
        d.vx += Math.cos(moveAng) * speed * 7.5 * dt;
        d.vy += Math.sin(moveAng) * speed * 7.5 * dt;
      }

      // Kinematic damping
      const damping = Math.pow(0.04, dt);
      d.vx *= damping;
      d.vy *= damping;

      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // Arena boundaries
      const minX = 40;
      const maxX = width - 40;
      const minY = 80;
      const maxY = height - 90;

      if (d.x < minX) { d.x = minX; d.vx = -d.vx * 0.4; }
      if (d.x > maxX) { d.x = maxX; d.vx = -d.vx * 0.4; }
      if (d.y < minY) { d.y = minY; d.vy = -d.vy * 0.4; }
      if (d.y > maxY) { d.y = maxY; d.vy = -d.vy * 0.4; }

      // Action Charging: Ultraviolet Monocle & Flash Unmask Sweet Spot
      if (actionHeld) {
        d.isCharging = true;
        d.chargeTime += dt;
        d.mood = 'focused';

        // Overcharge penalty (> 1.25s)
        if (d.chargeTime >= 1.25) {
          d.chargeTime = 0;
          d.isCharging = false;
          d.overheatTimer = 0.85;
          d.score = Math.max(0, d.score - 5);
          this.audio.playExplosion();
          this.screenShake = 12;
          this.particles.emit(d.x, d.y, 25, '#EF4444');
          this.triggerAnnouncement(`${this.getPlayer(d.id)?.name || 'DETECTIVE'} ACCUSATION GAFFE!`, 1.2);
          continue;
        }
      } else if (d.isCharging) {
        // Evaluate Sweet Spot
        const chargeRatio = d.chargeTime / 1.0;
        const sweetSpotMin = d.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = d.isUnderdog ? 1.05 : 0.98;

        if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
          // SWEET SPOT: Ultraviolet Flash Unmask & Cane Lunge!
          d.flashSprintTimer = 1.6;
          d.mood = 'triumph';
          d.score += 25; // Detective Ace Bonus!
          this.audio.playScore();
          this.screenShake = 14;

          this.particles.emit(d.x, d.y, 35, '#F59E0B');
          this.particles.emit(d.x, d.y, 20, '#8B5CF6');

          // Supersonic cane lunge
          d.vx += Math.cos(d.angle) * 360;
          d.vy += Math.sin(d.angle) * 360;

          // Unmask all agents within 140px
          const unmaskRadius = d.isUnderdog ? 190 : 140;
          let unmaskedCount = 0;
          for (const ag of this.agents) {
            if (!ag.active) continue;
            const dist = Math.hypot(ag.x - d.x, ag.y - d.y);
            if (dist <= unmaskRadius) {
              ag.active = false;
              unmaskedCount++;
              const pts = (isSuddenDeath ? ag.value * 2 : ag.value);
              d.score += pts;
              this.particles.emit(ag.x, ag.y, 18, '#F59E0B');
            }
          }

          if (unmaskedCount > 0) {
            this.audio.playBounce();
            this.triggerAnnouncement(`${this.getPlayer(d.id)?.name || 'DETECTIVE'} UV FLASH UNMASKED ${unmaskedCount} AGENTS!`, 1.4);
          } else {
            this.triggerAnnouncement(`${this.getPlayer(d.id)?.name || 'DETECTIVE'} FLASH MONOCLE SWEEP!`, 1.2);
          }

          // Dazzle/stun nearby rival detectives
          for (const other of this.detectives.values()) {
            if (other.id === d.id) continue;
            const dist = Math.hypot(other.x - d.x, other.y - d.y);
            if (dist <= 110 && other.flashSprintTimer <= 0) {
              other.stunTimer = 0.75;
              other.mood = 'shocked';
              const pushAng = Math.atan2(other.y - d.y, other.x - d.x);
              other.vx += Math.cos(pushAng) * 280;
              other.vy += Math.sin(pushAng) * 280;
              this.particles.emit(other.x, other.y, 16, '#F59E0B');
            }
          }
        } else {
          // Minor cane swipe
          d.vx += Math.cos(d.angle) * 160;
          d.vy += Math.sin(d.angle) * 160;
          this.audio.playTap();
          this.particles.emit(d.x, d.y, 12, '#8B5CF6');
        }

        d.chargeTime = 0;
        d.isCharging = false;
      } else {
        d.mood = 'idle';
      }

      // Check Proximity Touch Unmask
      const grabRadius = d.isUnderdog ? 38 : 28;
      for (const ag of this.agents) {
        if (!ag.active) continue;
        const dist = Math.hypot(ag.x - d.x, ag.y - d.y);
        if (dist <= grabRadius + ag.radius) {
          ag.active = false;
          d.streakCount++;
          d.streakTimer = 2.8;

          let multiplier = 1.0;
          if (d.streakCount >= 4) multiplier = 2.5;
          else if (d.streakCount >= 3) multiplier = 2.0;
          else if (d.streakCount >= 2) multiplier = 1.5;

          const pts = Math.round((isSuddenDeath ? ag.value * 2 : ag.value) * multiplier);
          d.score += pts;

          this.audio.playTap();
          const col = ag.type === 'phantom_duchess' ? '#F59E0B' : (ag.type === 'spymaster' ? '#8B5CF6' : '#10B981');
          this.particles.emit(ag.x, ag.y, 18, col);

          if (ag.type === 'phantom_duchess') {
            this.audio.playScore();
            this.triggerAnnouncement(`PHANTOM DUCHESS UNMASKED! +${pts} PTS!`, 1.5);
          }
        }
      }
    }

    // Physical Detective-to-Detective Collision & Ballroom Waltz Shunts
    const detArr = Array.from(this.detectives.values());
    for (let i = 0; i < detArr.length; i++) {
      for (let j = i + 1; j < detArr.length; j++) {
        const d1 = detArr[i];
        const d2 = detArr[j];

        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 40;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = minDist - dist;
          d1.x -= nx * overlap * 0.5;
          d1.y -= ny * overlap * 0.5;
          d2.x += nx * overlap * 0.5;
          d2.y += ny * overlap * 0.5;

          const rvx = d2.vx - d1.vx;
          const rvy = d2.vy - d1.vy;
          const velAlongNorm = rvx * nx + rvy * ny;

          if (velAlongNorm < 0) {
            const restitution = 1.45;
            const impulse = -(1 + restitution) * velAlongNorm * 0.5;

            d1.vx -= nx * impulse;
            d1.vy -= ny * impulse;
            d2.vx += nx * impulse;
            d2.vy += ny * impulse;

            this.audio.playBounce();

            const speed1 = Math.hypot(d1.vx, d1.vy);
            const speed2 = Math.hypot(d2.vx, d2.vy);

            if (speed1 > speed2 + 80 || d1.flashSprintTimer > 0) {
              d1.sabotageCount++;
              d1.score += 30; // Ballroom Shunt Sabotage Bonus
              d2.stunTimer = 0.7;
              d2.score = Math.max(0, d2.score - 10);
              this.particles.emit(d2.x, d2.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(d1.id)?.name || 'P1'} WALTZ-SHUNTED ${this.getPlayer(d2.id)?.name || 'P2'}! (+30 PTS)`, 1.5);
            } else if (speed2 > speed1 + 80 || d2.flashSprintTimer > 0) {
              d2.sabotageCount++;
              d2.score += 30;
              d1.stunTimer = 0.7;
              d1.score = Math.max(0, d1.score - 10);
              this.particles.emit(d1.x, d1.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(d2.id)?.name || 'P2'} WALTZ-SHUNTED ${this.getPlayer(d1.id)?.name || 'P1'}! (+30 PTS)`, 1.5);
            }
          }
        }
      }
    }

    // Clean up unmasked agents
    this.agents = this.agents.filter(a => a.active);
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const d = this.detectives.get(botId);
    if (!d || d.stunTimer > 0 || d.overheatTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.10 : (difficulty === 'bot_normal' ? 0.23 : 0.42);
      reactionTimer = delay + Math.random() * 0.05;
      this.botReactionTimers.set(botId, reactionTimer);

      const cx = width / 2;
      const cy = height / 2;

      // Find best target masked agent
      let bestTarget: { x: number; y: number } | null = null;
      let highestWeight = -1;

      for (const ag of this.agents) {
        if (!ag.active) continue;
        const dist = Math.hypot(ag.x - d.x, ag.y - d.y);
        let weight = (ag.value * 2) - dist * 0.2;
        if (ag.type === 'phantom_duchess') weight += 70;

        if (weight > highestWeight) {
          highestWeight = weight;
          bestTarget = { x: ag.x, y: ag.y };
        }
      }

      // Hard bots actively hunt rivals to waltz-shunt them
      if (difficulty === 'bot_hard') {
        for (const other of this.detectives.values()) {
          if (other.id === botId) continue;
          const distToOther = Math.hypot(other.x - d.x, other.y - d.y);
          if (distToOther < 120 && other.score > d.score) {
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
        bestTarget = { x: d.x + (Math.random() - 0.5) * 150, y: d.y + (Math.random() - 0.5) * 150 };
      }

      const targetAng = Math.atan2(bestTarget.y - d.y, bestTarget.x - d.x);
      const steerX = Math.cos(targetAng);
      const throttleY = -Math.sin(targetAng);

      // Action button charge logic
      let shouldAction = false;
      const targetDist = Math.hypot(bestTarget.x - d.x, bestTarget.y - d.y);

      if (difficulty === 'bot_hard') {
        if (!d.isCharging && targetDist > 80 && Math.random() < 0.65) {
          shouldAction = true;
        } else if (d.isCharging) {
          const sweetSpotMin = d.isUnderdog ? 0.50 : 0.72;
          const sweetSpotMax = d.isUnderdog ? 1.05 : 0.98;
          const chargeRatio = d.chargeTime / 1.0;
          if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
            shouldAction = false; // Sweet spot release!
          } else {
            shouldAction = true;
          }
        }
      } else if (difficulty === 'bot_normal') {
        if (!d.isCharging && Math.random() < 0.3) {
          shouldAction = true;
        } else if (d.isCharging && d.chargeTime > 0.8) {
          shouldAction = false;
        } else if (d.isCharging) {
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

    // Background Gradient (Ballroom atmosphere)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Grand Masquerade Ballroom Floor
    const roomMarginX = 30;
    const roomMarginY = 70;
    const roomW = width - roomMarginX * 2;
    const roomH = height - roomMarginY - 30;

    ctx.fillStyle = theme.ballroomFloor;
    ctx.fillRect(roomMarginX, roomMarginY, roomW, roomH);

    // Marble Checkered Parquet Pattern
    const tileSize = 50;
    for (let x = roomMarginX; x < roomMarginX + roomW; x += tileSize) {
      for (let y = roomMarginY; y < roomMarginY + roomH; y += tileSize) {
        const isAlt = (Math.floor((x - roomMarginX) / tileSize) + Math.floor((y - roomMarginY) / tileSize)) % 2 === 0;
        ctx.fillStyle = isAlt ? theme.marbleCheck1 : theme.marbleCheck2;
        ctx.fillRect(x, y, Math.min(tileSize, roomMarginX + roomW - x), Math.min(tileSize, roomMarginY + roomH - y));
      }
    }

    // Grand Chandelier Amber Light Pool
    const chGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 210);
    chGrad.addColorStop(0, theme.chandelierGlow);
    chGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = chGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 210, 0, Math.PI * 2);
    ctx.fill();

    // Ballroom Gilded Border
    ctx.strokeStyle = theme.pillarColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(roomMarginX + 4, roomMarginY + 4, roomW - 8, roomH - 8);

    // Render Masked Agents
    for (const ag of this.agents) {
      if (!ag.active) continue;

      ctx.save();
      ctx.translate(ag.x, ag.y);
      const bobY = Math.sin(ag.pulsePhase) * 4;
      ctx.translate(0, bobY);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 18 - bobY, ag.radius * 0.9, ag.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ballgown / Tuxedo Body
      ctx.fillStyle = '#1E1B4B';
      ctx.beginPath();
      ctx.arc(0, 0, ag.radius * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ornate Masquerade Mask
      ctx.fillStyle = ag.maskColor;
      ctx.fillRect(-ag.radius * 0.8, -ag.radius * 0.4, ag.radius * 1.6, ag.radius * 0.7);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(-ag.radius * 0.8, -ag.radius * 0.4, ag.radius * 1.6, ag.radius * 0.7);

      // Mask eye holes
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(-4, -1, 2, 0, Math.PI * 2);
      ctx.arc(4, -1, 2, 0, Math.PI * 2);
      ctx.fill();

      if (ag.type === 'phantom_duchess') {
        // Golden sunburst rays on Duchess
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + ag.pulsePhase * 0.8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (ag.radius + 2), Math.sin(a) * (ag.radius + 2));
          ctx.lineTo(Math.cos(a) * (ag.radius + 8), Math.sin(a) * (ag.radius + 8));
          ctx.stroke();
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('75', 0, 16);
      } else if (ag.type === 'spymaster') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('45', 0, 15);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('20', 0, 14);
      }

      ctx.restore();
    }

    // Render Detectives
    for (const d of this.detectives.values()) {
      const pConfig = this.getPlayer(d.id);
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      ctx.save();
      ctx.translate(d.x, d.y);

      // Character Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Underdog Spyglass Aura
      if (d.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 30 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Flash Unmask Sprint Aura
      if (d.flashSprintTimer > 0) {
        ctx.strokeStyle = '#F59E0B';
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
        d.id,
        isBot,
        d.mood,
        d.animTimer
      );

      // Detective Cane / Monocle Facing Direction
      ctx.save();
      ctx.rotate(d.angle);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(8, 4);
      ctx.stroke();
      ctx.restore();

      // Hold-to-Charge Monocle Ring
      if (d.isCharging) {
        const chargeRatio = Math.min(1.0, d.chargeTime / 1.0);
        const sweetSpotMin = d.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = d.isUnderdog ? 1.05 : 0.98;

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
        ctx.strokeStyle = isSweet ? '#F59E0B' : '#8B5CF6';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI / 2, chargeRatio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        ctx.fillStyle = isSweet ? '#F59E0B' : '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isSweet ? 'UV FLASH!' : 'FOCUSING...', 0, -38);
      }

      // Status text
      if (d.overheatTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAFFE STUN', 0, 34);
      } else if (d.stunTimer > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WALTZ STUN', 0, 34);
      }

      ctx.restore();
    }

    // Top Global Timer Safe Zone: y: 12-44, x: width/2 - 80 to width/2 + 80
    // Render Minigame Header Badge at y: 56, h: 28
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    const badgeW = 390;
    const badgeH = 26;
    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, 56, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DISGUISE SHUFFLE // GRAND MASQUERADE UNMASK', cx, 56 + badgeH / 2);
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
      ctx.fillText('⚡ MIDNIGHT MASQUERADE: DOUBLE UNMASK SCORES! ⚡', cx, 98);
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
      const d = this.detectives.get(p.id);
      if (!d) continue;

      let cardX = 20;
      if (i === 1) cardX = width - 150;
      else if (i === 2) cardX = 160;
      else if (i === 3) cardX = width - 290;

      const cardY = height - 128;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = d.isUnderdog ? '#F59E0B' : p.color;
      ctx.lineWidth = d.isUnderdog ? 2.5 : 1.5;
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
      ctx.fillText(`${d.score} PTS`, cardX + 10, cardY + 36);

      if (d.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${d.streakCount}x`, cardX + 120, cardY + 36);
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
        score: this.detectives.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerD = winnerId ? this.detectives.get(winnerId) : null;
    let highlight = 'The masquerade ball danced into mystery!';
    if (winnerId && winnerD) {
      const pName = this.getPlayer(winnerId)?.name || 'Detective';
      if (winnerD.sabotageCount >= 2) {
        highlight = `${pName} waltz-shunted rivals and unmasked the rogue masquerade agents!`;
      } else {
        highlight = `${pName} unmasked the Venetian double agents with a dazzling score of ${winnerD.score}!`;
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
