import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface BriefcaseItem {
  id: number;
  type: 'diplomatic' | 'armored' | 'gold_football';
  value: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  carrierId: PlayerId | null;
  radius: number;
  pulsePhase: number;
}

interface SecretCourier {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  carriedCaseId: number | null;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number;
  tackleTimer: number;
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isSuperTackling: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  floorTile: string;
  gridLine: string;
  turnstileColor: string;
  turnstileGate: string;
  trainTrack: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Grand Central Concourse',
    icon: '🏛️',
    bgGradTop: '#1E293B',
    bgGradBottom: '#020617',
    floorTile: '#334155',
    gridLine: '#475569',
    turnstileColor: '#059669',
    turnstileGate: '#10B981',
    trainTrack: '#0F172A'
  },
  {
    name: 'Neo-Tokyo Shinjuku Metro',
    icon: '⚡',
    bgGradTop: '#3B0764',
    bgGradBottom: '#0A0118',
    floorTile: '#1E1B4B',
    gridLine: '#6366F1',
    turnstileColor: '#0284C7',
    turnstileGate: '#38BDF8',
    trainTrack: '#020617'
  },
  {
    name: 'London Underground Tube',
    icon: '🚇',
    bgGradTop: '#7F1D1D',
    bgGradBottom: '#1F0606',
    floorTile: '#450A0A',
    gridLine: '#991B1B',
    turnstileColor: '#D97706',
    turnstileGate: '#F59E0B',
    trainTrack: '#180303'
  }
];

export class BriefcaseSnatchGame extends BaseGame {
  private couriers: Map<PlayerId, SecretCourier> = new Map();
  private briefcases: BriefcaseItem[] = [];
  private nextEntityId = 1;

  // Turnstile Gate state at top
  private turnstileOpen = true;
  private turnstileTimer = 3.0;

  private caseSpawnTimer = 0;
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
    this.setupListeners();
  }

  private setupListeners(): void {
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
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const canvasHeight = canvas.height;
      if (clickX >= 20 && clickX <= 190 && clickY >= canvasHeight - 44 && clickY <= canvasHeight - 12) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickHandler);
  }

  public cycleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
    this.audio.playTap();
  }

  public setTheme(idx: number): void {
    if (idx >= 0 && idx < THEMES.length) {
      this.currentThemeIndex = idx;
      this.audio.playTap();
    }
  }

  public override destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    if (this.clickHandler) {
      window.removeEventListener('click', this.clickHandler);
      this.clickHandler = undefined;
    }
    super.destroy();
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.couriers.clear();
    this.briefcases = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;
    this.turnstileOpen = true;
    this.turnstileTimer = 3.0;
    this.caseSpawnTimer = 0.5;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;

    // Spawn 4 players along bottom concourse
    const spacing = (width - 160) / Math.max(1, count - 1 || 1);
    for (let i = 0; i < count; i++) {
      const p = active[i];
      const startX = count === 1 ? width / 2 : 80 + i * spacing;
      const startY = height - 120;

      this.couriers.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        score: 0,
        carriedCaseId: null,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        tackleTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isSuperTackling: false
      });
      this.botReactionTimers.set(p.id, 0);
    }

    // Seed initial briefcases in concourse
    for (let i = 0; i < 3; i++) {
      this.spawnBriefcase(width, height);
    }
  }

  private spawnBriefcase(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12.0;
    const marginX = 100;
    const marginY = 160;
    const x = marginX + Math.random() * (width - marginX * 2);
    const y = marginY + Math.random() * (height - marginY * 2);

    const roll = Math.random();
    let type: 'diplomatic' | 'armored' | 'gold_football' = 'diplomatic';
    let value = 25;
    let radius = 14;

    if (isSuddenDeath && roll < 0.3) {
      type = 'gold_football';
      value = 75;
      radius = 18;
    } else if (roll < 0.5) {
      type = 'armored';
      value = 45;
      radius = 16;
    }

    this.briefcases.push({
      id: this.nextEntityId++,
      type,
      value,
      x,
      y,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      carrierId: null,
      radius,
      pulsePhase: Math.random() * Math.PI * 2
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

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }
    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
    }

    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 12.0;

    // Highest score for Underdog
    let maxScore = -1;
    this.couriers.forEach(c => { if (c.score > maxScore) maxScore = c.score; });

    // 1. Spawner
    this.caseSpawnTimer -= dt;
    if (this.caseSpawnTimer <= 0 && this.briefcases.length < 5) {
      this.caseSpawnTimer = (isSuddenDeath ? 1.2 : 2.2) + Math.random() * 0.8;
      this.spawnBriefcase(width, height);
    }

    // 2. Toggle Subway Turnstiles
    this.turnstileTimer -= dt;
    if (this.turnstileTimer <= 0) {
      this.turnstileTimer = isSuddenDeath ? 1.8 : 3.0;
      this.turnstileOpen = !this.turnstileOpen;
      this.audio.playBounce();
      this.triggerAnnouncement(this.turnstileOpen ? 'EXPRESS TURNSTILES OPEN!' : 'TURNSTILES LOCKED!', 0.8);
    }

    // 3. Update Couriers
    const active = this.getActivePlayers();
    for (const p of active) {
      const c = this.couriers.get(p.id);
      if (!c) continue;

      c.animTimer += dt;

      if (c.tackleTimer > 0) {
        c.tackleTimer -= dt;
        if (c.tackleTimer <= 0) {
          c.isSuperTackling = false;
        }
      }
      if (c.streakTimer > 0) {
        c.streakTimer -= dt;
        if (c.streakTimer <= 0) {
          c.streakCount = 0;
        }
      }

      // Stun
      if (c.stunTimer > 0) {
        c.stunTimer -= dt;
        c.vx *= 0.88;
        c.vy *= 0.88;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.mood = 'shocked';
        continue;
      }

      if (c.overheatTimer > 0) {
        c.overheatTimer -= dt;
      }

      const isUnderdog = maxScore - c.score >= 35;

      // Inputs
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionPressed = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Courier movement physics
      let maxSpeed = 230;
      let accel = 800;
      if (c.isSuperTackling) {
        maxSpeed = 380;
        accel = 1400;
      } else if (isUnderdog) {
        maxSpeed *= 1.25;
        accel *= 1.25;
      }

      if (steerX !== 0 || throttleY !== 0) {
        c.vx += steerX * accel * dt;
        c.vy += throttleY * accel * dt;
        c.angle = Math.atan2(throttleY, steerX);
      } else {
        c.vx *= 0.90;
        c.vy *= 0.90;
      }

      const curSpeed = Math.hypot(c.vx, c.vy);
      if (curSpeed > maxSpeed) {
        c.vx = (c.vx / curSpeed) * maxSpeed;
        c.vy = (c.vy / curSpeed) * maxSpeed;
      }

      c.x += c.vx * dt;
      c.y += c.vy * dt;

      // Concourse bounds
      const pad = 38;
      c.x = Math.max(pad, Math.min(width - pad, c.x));
      c.y = Math.max(pad + 60, Math.min(height - pad, c.y));

      // Check Banking through Open Turnstiles at Top (y: 100-140)
      if (c.carriedCaseId !== null && this.turnstileOpen && c.y <= 135) {
        // Banked briefcase!
        const bCase = this.briefcases.find(b => b.id === c.carriedCaseId);
        if (bCase) {
          const mult = Math.min(3.0, 1.0 + c.streakCount * 0.5);
          const pts = Math.floor(bCase.value * mult * (isSuddenDeath ? 2 : 1.5));
          c.score += pts;
          c.streakCount++;
          c.streakTimer = 4.0;
          c.mood = 'triumph';

          this.screenShake = 8;
          this.audio.playFanfare();
          this.particles.emit(c.x, c.y, 22, '#FBBF24');
          this.triggerAnnouncement(`★ ${p.name} BANKED ${bCase.type.replace('_', ' ').toUpperCase()}! +${pts} ★`, 1.3);

          // Remove banked case and reset courier
          this.briefcases = this.briefcases.filter(b => b.id !== c.carriedCaseId);
          c.carriedCaseId = null;
        }
      }

      // Hold-to-Charge Football Sprint Tackle Sweet Spot (72%–98%)
      if (c.overheatTimer <= 0 && c.stunTimer <= 0) {
        if (actionPressed) {
          c.isCharging = true;
          c.chargeTime += dt;
          c.mood = 'focused';

          if (Math.random() < 0.3) {
            this.particles.emit(c.x, c.y, 2, '#38BDF8');
          }

          if (c.chargeTime > 1.25) {
            // Overheat slip on tracks
            c.isCharging = false;
            c.chargeTime = 0;
            c.overheatTimer = 0.85;
            c.stunTimer = 0.6;
            c.mood = 'shocked';
            this.audio.playBounce();
            this.particles.emit(c.x, c.y, 14, '#EF4444');
            this.triggerAnnouncement(`${p.name} Slipped on the Platform!`, 1.1);
          }
        } else if (!actionPressed && c.isCharging) {
          c.isCharging = false;
          const ratio = c.chargeTime / 1.0;
          const sweetMin = isUnderdog ? 0.50 : 0.72;
          const sweetMax = isUnderdog ? 1.05 : 0.98;

          if (ratio >= sweetMin && ratio <= sweetMax) {
            // SUPERSONIC TURNSTILE TACKLE SWEET SPOT!
            c.tackleTimer = 1.1;
            c.isSuperTackling = true;
            c.mood = 'triumph';
            c.streakCount++;
            c.streakTimer = 4.0;
            const streakMult = Math.min(3.0, 1.0 + (c.streakCount - 1) * 0.5);
            const aceBonus = Math.floor(25 * streakMult * (isSuddenDeath ? 2 : 1));
            c.score += aceBonus;

            this.screenShake = 9;
            this.audio.playFanfare();
            this.particles.emit(c.x, c.y, 22, '#F59E0B');
            this.triggerAnnouncement(`★ TURNSTILE TACKLE ACE! +${aceBonus} ★`, 1.3);
          } else {
            // Short tackle
            c.tackleTimer = 0.4;
            c.isSuperTackling = false;
            this.audio.playTap();
            c.mood = 'idle';
          }
          c.chargeTime = 0;
        }
      }

      if (!c.isCharging && c.stunTimer <= 0 && c.tackleTimer <= 0) {
        c.mood = 'idle';
      }
    }

    // 4. Update Briefcases
    for (const bCase of this.briefcases) {
      bCase.pulsePhase += dt * 4;

      if (bCase.carrierId !== null) {
        const carrier = this.couriers.get(bCase.carrierId);
        if (carrier) {
          bCase.x = carrier.x;
          bCase.y = carrier.y;
          // Passive hold points
          carrier.score += dt * (isSuddenDeath ? 12 : 6);
        } else {
          bCase.carrierId = null;
        }
      } else {
        bCase.x += bCase.vx * dt;
        bCase.y += bCase.vy * dt;
        bCase.vx *= 0.95;
        bCase.vy *= 0.95;

        // Check pickup by courier with hands free
        for (const p of active) {
          const c = this.couriers.get(p.id);
          if (!c || c.stunTimer > 0 || c.carriedCaseId !== null) continue;

          const isUnderdog = maxScore - c.score >= 35;
          const grabRadius = isUnderdog ? bCase.radius + 36 : bCase.radius + 20;

          if (Math.hypot(c.x - bCase.x, c.y - bCase.y) < grabRadius) {
            bCase.carrierId = p.id;
            c.carriedCaseId = bCase.id;
            c.mood = 'triumph';
            this.audio.playScore();
            this.particles.emit(c.x, c.y, 14, '#FBBF24');
            this.triggerAnnouncement(`${p.name} Snatched ${bCase.type.replace('_', ' ').toUpperCase()}!`, 0.8);
            break;
          }
        }
      }
    }

    // 5. Elastic Concourse Body Checks & Briefcase Steals Between Couriers
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const c1 = this.couriers.get(p1.id);
        const c2 = this.couriers.get(p2.id);
        if (!c1 || !c2) continue;

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 34;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          const c1Tackling = c1.isSuperTackling;
          const c2Tackling = c2.isSuperTackling;

          if (c1Tackling && !c2Tackling) {
            // C1 tackles C2!
            c2.stunTimer = 0.7;
            c2.score = Math.max(0, c2.score - 10);
            c2.vx = nx * 360;
            c2.vy = ny * 360;
            c2.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            c1.score += pts;
            c1.sabotageCount++;
            c1.mood = 'triumph';

            // Steal briefcase if C2 is carrying!
            if (c2.carriedCaseId !== null) {
              const bCase = this.briefcases.find(b => b.id === c2.carriedCaseId);
              if (bCase) {
                bCase.carrierId = c1.id;
                c1.carriedCaseId = bCase.id;
                c2.carriedCaseId = null;
                this.triggerAnnouncement(`TACKLE STRIP STEAL! ${p1.name} Stole the Briefcase!`, 1.2);
              }
            }

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, 20, '#F59E0B');
          } else if (c2Tackling && !c1Tackling) {
            c1.stunTimer = 0.7;
            c1.score = Math.max(0, c1.score - 10);
            c1.vx = -nx * 360;
            c1.vy = -ny * 360;
            c1.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            c2.score += pts;
            c2.sabotageCount++;
            c2.mood = 'triumph';

            if (c1.carriedCaseId !== null) {
              const bCase = this.briefcases.find(b => b.id === c1.carriedCaseId);
              if (bCase) {
                bCase.carrierId = c2.id;
                c2.carriedCaseId = bCase.id;
                c1.carriedCaseId = null;
                this.triggerAnnouncement(`TACKLE STRIP STEAL! ${p2.name} Stole the Briefcase!`, 1.2);
              }
            }

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, 20, '#F59E0B');
          } else {
            const overlap = (minDist - dist) * 0.5;
            c1.x -= nx * overlap;
            c1.y -= ny * overlap;
            c2.x += nx * overlap;
            c2.y += ny * overlap;

            const kx = c1.vx - c2.vx;
            const ky = c1.vy - c2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            c1.vx -= p * nx * 0.8;
            c1.vy -= p * ny * 0.8;
            c2.vx += p * nx * 0.8;
            c2.vy += p * ny * 0.8;

            this.audio.playBounce();
            this.particles.emit((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, 6, '#FBBF24');
          }
        }
      }
    }
  }

  private triggerAnnouncement(text: string, duration: number = 1.0): void {
    this.announcementText = text;
    this.announcementTimer = duration;
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const c = this.couriers.get(botId);
    if (!c || c.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) + dt;
    this.botReactionTimers.set(botId, timer);

    const reactionLimit = difficulty === 'bot_easy' ? 0.42 : difficulty === 'bot_normal' ? 0.23 : 0.10;
    if (timer < reactionLimit) {
      return;
    }
    this.botReactionTimers.set(botId, 0);

    // Blunder for Easy
    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
      return;
    }

    let targetX = width / 2;
    let targetY = height / 2;
    let wantAction = false;

    // If carrying a briefcase, head toward turnstiles at top!
    if (c.carriedCaseId !== null) {
      targetX = width / 2;
      targetY = 110;
      if (this.turnstileOpen && c.y < 220) {
        if (difficulty === 'bot_hard') {
          if (c.chargeTime >= 0.75 && c.chargeTime <= 0.95) wantAction = false;
          else wantAction = true;
        } else {
          wantAction = c.chargeTime < 0.7;
        }
      }
    } else {
      // Find briefcase or carrier to tackle
      let nearestTargetX = width / 2;
      let nearestTargetY = height / 2;
      let minTargetDist = Infinity;

      for (const bCase of this.briefcases) {
        const d = Math.hypot(bCase.x - c.x, bCase.y - c.y);
        if (d < minTargetDist) {
          minTargetDist = d;
          nearestTargetX = bCase.x;
          nearestTargetY = bCase.y;
        }
      }

      targetX = nearestTargetX;
      targetY = nearestTargetY;

      if (minTargetDist < 120 && minTargetDist > 20) {
        if (difficulty === 'bot_hard') {
          if (c.chargeTime >= 0.75 && c.chargeTime <= 0.95) wantAction = false;
          else wantAction = true;
        } else if (difficulty === 'bot_normal') {
          wantAction = c.chargeTime < 0.7;
        } else {
          wantAction = Math.random() < 0.4;
        }
      }
    }

    const dx = targetX - c.x;
    const dy = targetY - c.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 6 ? Math.max(-1, Math.min(1, dx / 40)) : 0;
    const throttleY = dist > 6 ? Math.max(-1, Math.min(1, dy / 40)) : 0;

    this.input.setBotInput(botId, wantAction, steerX, throttleY);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIndex];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Subway Concourse Floor
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.floorTile;
    ctx.fillRect(30, 90, width - 60, height - 150);

    // Floor tile grid
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1;
    for (let x = 30; x <= width - 30; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 90);
      ctx.lineTo(x, height - 60);
      ctx.stroke();
    }
    for (let y = 90; y <= height - 60; y += 50) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
      ctx.stroke();
    }

    // 2. Turnstile Banking Gates at Top
    const gateW = width * 0.45;
    const gateH = 26;
    const gateX = width / 2 - gateW / 2;
    const gateY = 110;

    ctx.fillStyle = this.turnstileOpen ? theme.turnstileColor : '#DC2626';
    ctx.beginPath();
    ctx.roundRect(gateX, gateY, gateW, gateH, 6);
    ctx.fill();
    ctx.strokeStyle = this.turnstileOpen ? theme.turnstileGate : '#EF4444';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this.turnstileOpen ? '🎫 EXPRESS TURNSTILES OPEN [BANK BRIEFCASES] 🎫' : '⛔ TURNSTILES LOCKED ⛔',
      width / 2,
      gateY + gateH / 2
    );

    // 3. Render Briefcases
    for (const bCase of this.briefcases) {
      if (bCase.carrierId !== null) continue; // Drawn with carrier below

      ctx.save();
      ctx.translate(bCase.x, bCase.y);
      const bob = Math.sin(bCase.pulsePhase) * 3;

      if (bCase.type === 'gold_football') {
        // Gold Football Case
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.roundRect(-bCase.radius, -bCase.radius * 0.7 + bob, bCase.radius * 2, bCase.radius * 1.4, 4);
        ctx.fill();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (bCase.type === 'armored') {
        // Armored Case
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.roundRect(-bCase.radius, -bCase.radius * 0.7 + bob, bCase.radius * 2, bCase.radius * 1.4, 3);
        ctx.fill();
        ctx.strokeStyle = '#BAE6FD';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Diplomatic Pouch
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.roundRect(-bCase.radius, -bCase.radius * 0.7 + bob, bCase.radius * 2, bCase.radius * 1.4, 3);
        ctx.fill();
        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Render Couriers
    const active = this.getActivePlayers();
    let maxScore = -1;
    this.couriers.forEach(c => { if (c.score > maxScore) maxScore = c.score; });

    for (const p of active) {
      const c = this.couriers.get(p.id);
      if (!c) continue;

      const isUnderdog = maxScore - c.score >= 35;
      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(c.x, c.y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tackle Sprint Trail
      if (c.isSuperTackling) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-Math.cos(c.angle) * 32, -Math.sin(c.angle) * 32);
        ctx.stroke();
      }

      // Charge Ring
      if (c.isCharging) {
        const ratio = Math.min(1.0, c.chargeTime / 1.0);
        const sweetMin = isUnderdog ? 0.50 : 0.72;
        const sweetMax = isUnderdog ? 1.05 : 0.98;
        const inSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 28, sweetMin * Math.PI * 2 - Math.PI / 2, sweetMax * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        ctx.strokeStyle = inSweet ? '#22C55E' : '#EAB308';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 28, -Math.PI / 2, ratio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        if (inSweet) {
          ctx.fillStyle = '#4ADE80';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('TACKLE!', 0, -36);
        }
      }

      // Draw Mascot Courier
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        isBot,
        c.mood,
        c.animTimer
      );

      // Carried Briefcase under arm
      if (c.carriedCaseId !== null) {
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(8, -4, 12, 8);
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(8, -4, 12, 8);
      }

      // Underdog Aura
      if (isUnderdog) {
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    // 5. Strict UI Layout
    const isSuddenDeath = this.roundTimer <= 12.0;
    const timerBoxX = width / 2 - 80;
    const timerBoxY = 12;
    const timerBoxW = 160;
    const timerBoxH = 32;

    ctx.fillStyle = isSuddenDeath ? 'rgba(239, 68, 68, 0.85)' : 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(timerBoxX, timerBoxY, timerBoxW, timerBoxH, 16);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#FCA5A5' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isSuddenDeath ? `⚡ RUSH HOUR: ${Math.ceil(this.roundTimer)}s ⚡` : `⏱️ ${Math.ceil(this.roundTimer)}s`,
      width / 2,
      timerBoxY + timerBoxH / 2
    );

    // Minigame Header Badge (y: 56, h: 28)
    const badgeW = 280;
    const badgeH = 28;
    const badgeX = width / 2 - badgeW / 2;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FDE047';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('💼 BRIEFCASE SNATCH • TURNSTILE HEIST', width / 2, badgeY + badgeH / 2);

    // Announcement Pill
    if (this.announcementTimer > 0 && this.announcementText) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.roundRect(width / 2 - 180, 96, 360, 32, 8);
      ctx.fill();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.announcementText, width / 2, 112);
      ctx.restore();
    }

    // Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, pillX + 12, pillY + pillH / 2);

    // Player Cards at Corners (y: height - 128, 130x48px)
    active.forEach((p, idx) => {
      const c = this.couriers.get(p.id);
      if (!c) return;

      const cardW = 130;
      const cardH = 48;
      const isRight = idx % 2 === 1;
      const isTop = idx >= 2;
      const cardX = isRight ? width - cardW - 20 : 20;
      const cardY = isTop ? height - 128 - cardH - 10 : height - 128;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cardX + 16, cardY + 24, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.name, cardX + 32, cardY + 16);

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${Math.floor(c.score)} pts`, cardX + 32, cardY + 34);

      if (c.carriedCaseId !== null) {
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('💼 HELD', cardX + cardW - 8, cardY + 34);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.couriers.entries()).map(([playerId, c]) => ({
      playerId,
      score: Math.floor(c.score)
    }));
    scores.sort((a, b) => b.score - a.score);

    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} escaped the subway concourse with top secret briefcases (${scores[0].score} pts)!`
        : 'The classified briefcases were stranded on the subway platform!'
    };
  }
}
