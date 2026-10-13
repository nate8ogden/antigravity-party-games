import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface IronStake {
  id: number;
  x: number;
  y: number;
  radius: number;
  isGold: boolean;
  pulseTimer: number;
  ringerOwner: PlayerId | null;
}

interface FlyingHorseshoe {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  heightZ: number;
  vz: number;
  rotation: number;
  isSweetSpot: boolean;
  landed: boolean;
}

interface Rancher {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3
  isCharging: boolean;
  overheatTimer: number;
  stuntTimer: number;
  spinTimer: number;
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  pitchGradTop: string;
  pitchGradBottom: string;
  fenceColor: string;
  sandPitColor: string;
  stakeGlowColor: string;
  dustColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Texas Ranch Corral',
    icon: '🤠',
    pitchGradTop: '#5D4037',
    pitchGradBottom: '#3E2723',
    fenceColor: '#8D6E63',
    sandPitColor: '#D7CCC8',
    stakeGlowColor: '#FFD54F',
    dustColor: 'rgba(215, 204, 200, 0.45)'
  },
  {
    name: 'Mojave Sunset Dunes',
    icon: '🌅',
    pitchGradTop: '#BF360C',
    pitchGradBottom: '#4E1D0C',
    fenceColor: '#E64A19',
    sandPitColor: '#FFCCBC',
    stakeGlowColor: '#00E5FF',
    dustColor: 'rgba(255, 171, 145, 0.4)'
  },
  {
    name: 'Autumn Apple Orchard',
    icon: '🍎',
    pitchGradTop: '#33691E',
    pitchGradBottom: '#1B5E20',
    fenceColor: '#A1887F',
    sandPitColor: '#C8E6C9',
    stakeGlowColor: '#FFEA00',
    dustColor: 'rgba(255, 245, 157, 0.35)'
  }
];

export class HorseshoeTossGame extends BaseGame {
  private ranchers: Map<PlayerId, Rancher> = new Map();
  private stakes: IronStake[] = [];
  private horseshoes: FlyingHorseshoe[] = [];
  private nextShoeId = 1;
  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;
  public windSpeed = 0;
  private windShiftTimer = 0;

  // Key / Click listeners
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
      // Theme pill check: bottom-left x: 20, y: height - 44, w: 170, h: 32
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
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.ranchers.clear();
    this.stakes = [];
    this.horseshoes = [];
    this.nextShoeId = 1;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;
    this.shiftWind();

    // Pitch Iron Stakes (Center Golden Stake + 4 Corner Stakes)
    this.stakes = [
      { id: 0, x: width * 0.5, y: height * 0.44, radius: 14, isGold: true, pulseTimer: 0, ringerOwner: null },
      { id: 1, x: width * 0.28, y: height * 0.32, radius: 11, isGold: false, pulseTimer: 0, ringerOwner: null },
      { id: 2, x: width * 0.72, y: height * 0.32, radius: 11, isGold: false, pulseTimer: 0, ringerOwner: null },
      { id: 3, x: width * 0.28, y: height * 0.56, radius: 11, isGold: false, pulseTimer: 0, ringerOwner: null },
      { id: 4, x: width * 0.72, y: height * 0.56, radius: 11, isGold: false, pulseTimer: 0, ringerOwner: null }
    ];

    const active = this.getActivePlayers();
    const spawnPositions = [
      { x: width * 0.25, y: height * 0.8, angle: -Math.PI * 0.35 },
      { x: width * 0.75, y: height * 0.8, angle: -Math.PI * 0.65 },
      { x: width * 0.4, y: height * 0.85, angle: -Math.PI * 0.5 },
      { x: width * 0.6, y: height * 0.85, angle: -Math.PI * 0.5 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnPositions[idx % spawnPositions.length];
      this.ranchers.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        stuntTimer: 0,
        spinTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: idx * 0.5,
        sabotageCount: 0
      });
    });
  }

  private shiftWind(): void {
    this.windSpeed = (Math.random() - 0.5) * 55;
    this.windShiftTimer = 2.5 + Math.random() * 2.0;
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
      if (this.announcementTimer <= 0) {
        this.announcementText = '';
      }
    }

    // Dynamic wind shift
    this.windShiftTimer -= dt;
    if (this.windShiftTimer <= 0) {
      this.shiftWind();
    }

    this.updateBots(dt, width, height);

    // Sudden death check (<= 12s)
    const isSuddenDeath = this.roundTimer <= 12.0;

    // Leader / Underdog calculation
    let topScore = -1;
    for (const r of this.ranchers.values()) {
      if (r.score > topScore) topScore = r.score;
    }

    // Update Ranchers
    for (const [id, r] of this.ranchers.entries()) {
      r.animTimer += dt;
      const isUnderdog = topScore >= 35 && r.score <= topScore - 30;

      if (r.spinTimer > 0) {
        r.spinTimer -= dt;
        r.angle += 12 * dt;
        r.vx *= Math.pow(0.92, dt * 60);
        r.vy *= Math.pow(0.92, dt * 60);
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.mood = 'shocked';
        continue;
      }

      if (r.stunTimer > 0) {
        r.stunTimer -= dt;
        r.vx *= Math.pow(0.85, dt * 60);
        r.vy *= Math.pow(0.85, dt * 60);
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.mood = 'shocked';
        continue;
      }

      if (r.overheatTimer > 0) {
        r.overheatTimer -= dt;
        r.mood = 'shocked';
      }

      if (r.stuntTimer > 0) {
        r.stuntTimer -= dt;
      }

      if (r.streakTimer > 0) {
        r.streakTimer -= dt;
        if (r.streakTimer <= 0) {
          r.streakCount = 0;
        }
      }

      const steerX = this.input.getSteer(id);
      const throttleY = -this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      // Movement
      const speedMult = (isUnderdog ? 1.25 : 1.0) * (r.stuntTimer > 0 ? 1.35 : 1.0);
      const accel = 420 * speedMult;
      r.vx += steerX * accel * dt;
      r.vy += throttleY * accel * dt;

      r.vx *= Math.pow(0.90, dt * 60);
      r.vy *= Math.pow(0.90, dt * 60);

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Keep within pitching arena bounds
      const pad = 44;
      r.x = Math.max(pad, Math.min(width - pad, r.x));
      r.y = Math.max(height * 0.65, Math.min(height - pad, r.y)); // Pitching mound area

      // Aim angle follows forward movement or aims toward nearest stake
      if (Math.hypot(r.vx, r.vy) > 18) {
        r.angle = Math.atan2(r.vy, r.vx);
      }

      // Hold-to-Charge Horseshoe Pitch & Sweet Spot (72%–98%)
      if (isAction && r.overheatTimer <= 0) {
        r.isCharging = true;
        r.chargeTime += dt;
        r.mood = 'focused';

        // Charge trajectory sparks
        if (Math.random() < 0.35) {
          const sparkColor = r.chargeTime >= 0.72 && r.chargeTime <= 0.98 ? '#00E676' : '#FFD54F';
          this.particles.emit(
            r.x + Math.cos(r.angle) * 20,
            r.y + Math.sin(r.angle) * 20,
            2,
            sparkColor
          );
        }

        // Overthrow blowout if held too long
        if (r.chargeTime > 1.25) {
          r.overheatTimer = 0.95;
          r.chargeTime = 0;
          r.isCharging = false;
          r.mood = 'shocked';
          this.audio.playExplosion();
          this.screenShake = 6;
          this.particles.emit(r.x, r.y, 12, '#8D6E63');
          this.announcementText = 'OVERTHROWN!';
          this.announcementTimer = 0.8;
        }
      } else if (r.isCharging) {
        // Released! Pitch Horseshoe
        const sweetSpot = (isUnderdog && r.chargeTime >= 0.50 && r.chargeTime <= 1.05) ||
                          (!isUnderdog && r.chargeTime >= 0.72 && r.chargeTime <= 0.98);

        // Find nearest stake in front of rancher
        let targetStake = this.stakes[0];
        let minDist = 99999;
        for (const s of this.stakes) {
          const d = Math.hypot(s.x - r.x, s.y - r.y);
          if (d < minDist) {
            minDist = d;
            targetStake = s;
          }
        }

        const pitchDist = 180 + (r.chargeTime / 1.0) * 220;
        const targetX = sweetSpot ? targetStake.x : r.x + Math.cos(r.angle) * pitchDist;
        const targetY = sweetSpot ? targetStake.y : r.y + Math.sin(r.angle) * pitchDist;

        this.horseshoes.push({
          id: this.nextShoeId++,
          ownerId: id,
          x: r.x,
          y: r.y,
          vx: (targetX - r.x) * 1.5,
          vy: (targetY - r.y) * 1.5,
          targetX,
          targetY,
          heightZ: 0,
          vz: 350,
          rotation: 0,
          isSweetSpot: sweetSpot,
          landed: false
        });

        if (sweetSpot) {
          r.stuntTimer = 1.0;
          r.mood = 'triumph';
          this.audio.playTap();
        } else {
          this.audio.playTap();
        }

        r.chargeTime = 0;
        r.isCharging = false;
      } else {
        r.mood = 'idle';
      }
    }

    // Physical Rancher Bumping & Sabotage
    const rancherArray = Array.from(this.ranchers.values());
    for (let i = 0; i < rancherArray.length; i++) {
      for (let j = i + 1; j < rancherArray.length; j++) {
        const r1 = rancherArray[i];
        const r2 = rancherArray[j];
        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 38;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          r1.x -= nx * overlap * 0.5;
          r1.y -= ny * overlap * 0.5;
          r2.x += nx * overlap * 0.5;
          r2.y += ny * overlap * 0.5;

          const kx = r1.vx - r2.vx;
          const ky = r1.vy - r2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          const impulse = Math.hypot(kx, ky);
          r1.vx -= p * nx * 1.35;
          r1.vy -= p * ny * 1.35;
          r2.vx += p * nx * 1.35;
          r2.vy += p * ny * 1.35;

          if (impulse > 120 || r1.stuntTimer > 0 || r2.stuntTimer > 0) {
            this.audio.playBounce();
            this.screenShake = Math.min(14, impulse * 0.06 + 4);
            this.hitStopTimer = 0.04;

            const attacker = r1.stuntTimer > r2.stuntTimer ? r1 : (r2.stuntTimer > r1.stuntTimer ? r2 : null);
            if (attacker) {
              const victim = attacker === r1 ? r2 : r1;
              attacker.score += 30;
              attacker.sabotageCount++;
              victim.stunTimer = 0.6;
              victim.score = Math.max(0, victim.score - 10);
              this.particles.emit((r1.x + r2.x) * 0.5, (r1.y + r2.y) * 0.5, 14, '#FF1744');
              this.announcementText = 'RANCHER ELBOW SHUNT! +30';
              this.announcementTimer = 1.0;
            }
          }
        }
      }
    }

    // Update Flying Horseshoes
    for (let i = this.horseshoes.length - 1; i >= 0; i--) {
      const hs = this.horseshoes[i];
      if (hs.landed) continue;

      hs.x += (hs.vx + this.windSpeed) * dt;
      hs.y += hs.vy * dt;
      hs.rotation += 10 * dt;

      // Vertical parabola
      hs.heightZ += hs.vz * dt;
      hs.vz -= 650 * dt;

      // Land on ground when height drops back to 0
      if (hs.heightZ <= 0 && hs.vz < 0) {
        hs.landed = true;
        const owner = this.ranchers.get(hs.ownerId);

        // Check stake rings
        let hitStake: IronStake | null = null;
        let bestDist = 99999;
        for (const s of this.stakes) {
          const d = Math.hypot(hs.x - s.x, hs.y - s.y);
          if (d < bestDist) {
            bestDist = d;
            hitStake = s;
          }
        }

        if (hitStake && bestDist < (hs.isSweetSpot ? 36 : 24)) {
          // Ringer!
          const pts = (hitStake.isGold ? 75 : 45) * (isSuddenDeath ? 2 : 1);
          if (owner) {
            owner.score += pts;
            owner.streakCount = Math.min(3, owner.streakCount + 1);
            owner.streakTimer = 2.2;
            owner.mood = 'triumph';
          }

          hitStake.ringerOwner = hs.ownerId;
          hitStake.pulseTimer = 0.5;
          this.audio.playScore();
          this.screenShake = 8;
          this.particles.emit(hitStake.x, hitStake.y, 18, hitStake.isGold ? '#FFD54F' : '#00E5FF');
          this.announcementText = hitStake.isGold ? `GOLDEN RINGER! +${pts}` : `CLEAN RINGER! +${pts}`;
          this.announcementTimer = 1.0;
        } else if (hitStake && bestDist < 48) {
          // Leaner
          const pts = 20 * (isSuddenDeath ? 2 : 1);
          if (owner) {
            owner.score += pts;
          }
          this.audio.playTap();
          this.particles.emit(hs.x, hs.y, 8, '#B0BEC5');
          this.announcementText = `LEANER! +${pts}`;
          this.announcementTimer = 0.8;
        } else {
          // Miss in sand
          this.audio.playTap();
          this.particles.emit(hs.x, hs.y, 5, '#8D6E63');
        }

        // Clean up shoe after 0.8s
        setTimeout(() => {
          const idx = this.horseshoes.indexOf(hs);
          if (idx !== -1) {
            this.horseshoes.splice(idx, 1);
          }
        }, 800);
      }
    }

    // Stake pulse timers
    for (const s of this.stakes) {
      if (s.pulseTimer > 0) {
        s.pulseTimer -= dt;
      }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const r = this.ranchers.get(botId);
    if (!r || r.spinTimer > 0 || r.stunTimer > 0) return;

    let delay = 0.23;
    let blunderChance = 0.12;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      blunderChance = 0.02;
    }

    // Target Golden stake or nearest open stake
    const targetStake = this.stakes[0];
    const dx = targetStake.x - r.x;
    const dy = targetStake.y - r.y;
    let steerX = 0;
    let throttleY = 0;

    if (Math.hypot(dx, dy) > 20) {
      steerX = Math.max(-1, Math.min(1, dx / 80));
      throttleY = Math.max(-1, Math.min(1, dy / 80));
    }

    // Compensate for wind
    steerX -= (this.windSpeed / 55) * 0.4;

    // Pitch trigger & sweet-spot timing
    let wantPitch = r.chargeTime < 0.85;
    if (r.chargeTime >= 0.78 && r.chargeTime <= 0.95) {
      wantPitch = false; // release sweet spot!
    }

    if (Math.random() < blunderChance) {
      steerX += (Math.random() - 0.5) * 0.7;
      wantPitch = Math.random() < 0.3;
    }

    this.input.setBotInput(botId, wantPitch, steerX, -throttleY, wantPitch);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIndex];

    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Pitch Sand/Grass Arena Gradient
    const arenaGrad = ctx.createLinearGradient(0, 0, 0, height);
    arenaGrad.addColorStop(0, theme.pitchGradTop);
    arenaGrad.addColorStop(1, theme.pitchGradBottom);
    ctx.fillStyle = arenaGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Sand Pit Scoring Boxes
    ctx.fillStyle = theme.sandPitColor;
    ctx.fillRect(width * 0.2, height * 0.22, width * 0.6, height * 0.42);

    ctx.strokeStyle = theme.fenceColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(width * 0.2, height * 0.22, width * 0.6, height * 0.42);

    // 3. Iron Stakes
    for (const stake of this.stakes) {
      ctx.save();
      ctx.translate(stake.x, stake.y);

      // Pulse wave
      if (stake.pulseTimer > 0) {
        ctx.strokeStyle = stake.isGold ? '#FFD54F' : '#00E5FF';
        ctx.lineWidth = 3;
        ctx.globalAlpha = stake.pulseTimer / 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, stake.radius + (0.5 - stake.pulseTimer) * 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // Stake shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(3, 4, stake.radius * 1.2, stake.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iron pin
      ctx.fillStyle = stake.isGold ? '#FFD54F' : '#ECEFF1';
      ctx.beginPath();
      ctx.arc(0, 0, stake.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = stake.isGold ? '#FFA000' : '#455A64';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Points label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stake.isGold ? '+75' : '+45', 0, stake.radius + 12);
      ctx.restore();
    }

    // 4. Flying Horseshoes with Parabola Shadows
    for (const hs of this.horseshoes) {
      ctx.save();
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(hs.x, hs.y + 12, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(hs.x, hs.y - Math.max(0, hs.heightZ * 0.2));
      ctx.rotate(hs.rotation);

      const pConfig = this.getPlayer(hs.ownerId);
      const color = hs.isSweetSpot ? '#FFD54F' : (pConfig?.color || '#ECEFF1');

      ctx.strokeStyle = color;
      ctx.lineWidth = hs.isSweetSpot ? 5 : 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0.4 * Math.PI, 1.6 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Ranchers with Mascot Heads & Pitching Hats
    for (const [id, r] of this.ranchers.entries()) {
      ctx.save();
      ctx.translate(r.x, r.y);
      const pConfig = this.getPlayer(id);
      const color = pConfig?.color || '#EF4444';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      // Charge aura
      if (r.isCharging) {
        const pct = Math.min(1, r.chargeTime / 1.0);
        const sweetSpot = r.chargeTime >= 0.72 && r.chargeTime <= 0.98;
        ctx.strokeStyle = sweetSpot ? '#00E676' : '#FFD54F';
        ctx.lineWidth = sweetSpot ? 4 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22 + pct * 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = sweetSpot ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 213, 79, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, 22 + pct * 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.rotate(r.angle);

      // Rancher Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Straw Rancher Hat
      ctx.fillStyle = '#FFD54F';
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mascot face in center
      drawCharacter(ctx, 0, 0, 9, id, isBot, r.mood, r.animTimer, undefined);

      ctx.restore();

      // Score Pill Above Rancher
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(r.x - 22, r.y - 36, 44, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.score}`, r.x, r.y - 24);
    }

    // 6. Central Announcement Banner
    if (this.announcementTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(width * 0.5 - 150, height * 0.36, 300, 36, 10);
      ctx.fill();
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFEB3B';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.announcementText, width * 0.5, height * 0.36 + 23);
      ctx.restore();
    }

    // 7. UI Header Badge (y: 56, h: 28)
    ctx.save();
    const badgeW = 280;
    const badgeH = 26;
    const badgeX = width * 0.5 - badgeW * 0.5;
    const badgeY = 56;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    const gustSpeed = Math.round(Math.abs(this.windSpeed));
    const gustLabel = gustSpeed < 6 ? 'CALM' : `${gustSpeed} MPH ${this.windSpeed > 0 ? 'EAST ➔' : 'WEST ⬅'}`;
    ctx.fillText(`🐴 HORSESHOE TOSS • WIND: ${gustLabel} 🐴`, width * 0.5, badgeY + 17);
    ctx.restore();

    // 8. Theme Pill (Bottom-Left: x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.icon} ${theme.name}`, pillX + 12, pillY + 20);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('[T] / [1-3]', pillX + pillW - 10, pillY + 20);
    ctx.restore();

    // 9. Corner Player Cards (y: height - 128, 130x48px)
    const cardW = 130;
    const cardH = 48;
    const cardY = height - 128;
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const r = this.ranchers.get(p.id);
      if (!r) return;

      let cardX = 20;
      if (idx === 1) cardX = width - cardW - 20;
      else if (idx === 2) cardX = 160;
      else if (idx === 3) cardX = width - cardW - 160;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Color pip
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cardX + 14, cardY + 24, 7, 0, Math.PI * 2);
      ctx.fill();

      // Name & Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 28, cardY + 20);

      ctx.fillStyle = '#FFD54F';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${r.score} pts`, cardX + 28, cardY + 38);
      ctx.restore();
    });

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.ranchers.entries()).map(([playerId, r]) => ({
      playerId,
      score: r.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} threw dead-center ringers with ${scores[0].score} pts!`
        : 'Horseshoes kicked up wild desert dust!'
    };
  }
}
