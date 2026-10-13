import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface Dynamite {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuseTimer: number;
  maxFuse: number;
  kickerId: PlayerId | null;
  isSuperKicked: boolean;
  active: boolean;
  rotation: number;
}

interface MiningCrate {
  id: number;
  x: number;
  y: number;
  type: 'gold' | 'nitro' | 'diamond';
  value: number;
  color: string;
  radius: number;
  pulsePhase: number;
}

interface CavernMiner {
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
  kickTimer: number;
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
  bgGradTop: string;
  bgGradBottom: string;
  beamColor: string;
  oreVeinColor: string;
  tntColor: string;
  sparkColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Silver Lode Cavern',
    icon: '⛏️',
    bgGradTop: '#263238',
    bgGradBottom: '#10171A',
    beamColor: '#5D4037',
    oreVeinColor: 'rgba(255, 215, 0, 0.4)',
    tntColor: '#DC2626',
    sparkColor: '#FFD54F'
  },
  {
    name: 'Volcanic Magma Chamber',
    icon: '🌋',
    bgGradTop: '#3E100C',
    bgGradBottom: '#180402',
    beamColor: '#3E2723',
    oreVeinColor: 'rgba(255, 87, 34, 0.45)',
    tntColor: '#B71C1C',
    sparkColor: '#FF3D00'
  },
  {
    name: 'Cyber Crystal Mine',
    icon: '💎',
    bgGradTop: '#0D1B2A',
    bgGradBottom: '#050A10',
    beamColor: '#1E293B',
    oreVeinColor: 'rgba(0, 229, 255, 0.45)',
    tntColor: '#D500F9',
    sparkColor: '#00E5FF'
  }
];

export class DynamiteTumbleGame extends BaseGame {
  private miners: Map<PlayerId, CavernMiner> = new Map();
  private dynamites: Dynamite[] = [];
  private crates: MiningCrate[] = [];
  private nextTntId = 1;
  private nextCrateId = 1;
  private tntSpawnTimer = 0;
  private crateSpawnTimer = 0;
  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;

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
    this.miners.clear();
    this.dynamites = [];
    this.crates = [];
    this.nextTntId = 1;
    this.nextCrateId = 1;
    this.tntSpawnTimer = 0.5;
    this.crateSpawnTimer = 1.0;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    // Seed initial crates
    for (let i = 0; i < 8; i++) {
      this.spawnCrate(width, height);
    }

    const active = this.getActivePlayers();
    const spawnPositions = [
      { x: width * 0.28, y: height * 0.3, angle: Math.PI * 0.25 },
      { x: width * 0.72, y: height * 0.3, angle: Math.PI * 0.75 },
      { x: width * 0.28, y: height * 0.7, angle: -Math.PI * 0.25 },
      { x: width * 0.72, y: height * 0.7, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnPositions[idx % spawnPositions.length];
      this.miners.set(p.id, {
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
        kickTimer: 0,
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

  private spawnDynamite(width: number, height: number): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 80;

    this.dynamites.push({
      id: this.nextTntId++,
      x: width * 0.5,
      y: height * 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      fuseTimer: 4.5,
      maxFuse: 4.5,
      kickerId: null,
      isSuperKicked: false,
      active: true,
      rotation: Math.random() * Math.PI * 2
    });
  }

  private spawnCrate(width: number, height: number): void {
    const rand = Math.random();
    let type: 'gold' | 'nitro' | 'diamond' = 'gold';
    let value = 20;
    let color = '#FFD54F';
    let radius = 12;

    if (rand < 0.55) {
      type = 'gold';
      value = 20;
      color = '#FFD54F';
      radius = 12;
    } else if (rand < 0.85) {
      type = 'nitro';
      value = 40;
      color = '#FF5722';
      radius = 14;
    } else {
      type = 'diamond';
      value = 75;
      color = '#00E5FF';
      radius = 16;
    }

    this.crates.push({
      id: this.nextCrateId++,
      x: 70 + Math.random() * (width - 140),
      y: 80 + Math.random() * (height - 160),
      type,
      value,
      color,
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
      if (this.announcementTimer <= 0) {
        this.announcementText = '';
      }
    }

    this.updateBots(dt, width, height);

    // Sudden death acceleration (<= 12s)
    const isSuddenDeath = this.roundTimer <= 12.0;

    // Spawn TNT
    this.tntSpawnTimer -= dt;
    if (this.tntSpawnTimer <= 0 && this.dynamites.length < 5) {
      this.spawnDynamite(width, height);
      this.tntSpawnTimer = isSuddenDeath ? 1.4 : 2.2;
    }

    // Spawn crates
    this.crateSpawnTimer -= dt;
    if (this.crateSpawnTimer <= 0 && this.crates.length < 8) {
      this.spawnCrate(width, height);
      this.crateSpawnTimer = 3.0 + Math.random() * 2.0;
    }

    // Leader / Underdog calculation
    let topScore = -1;
    for (const m of this.miners.values()) {
      if (m.score > topScore) topScore = m.score;
    }

    // Update Miners
    for (const [id, m] of this.miners.entries()) {
      m.animTimer += dt;
      const isUnderdog = topScore >= 35 && m.score <= topScore - 30;

      if (m.spinTimer > 0) {
        m.spinTimer -= dt;
        m.angle += 12 * dt;
        m.vx *= Math.pow(0.92, dt * 60);
        m.vy *= Math.pow(0.92, dt * 60);
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.mood = 'shocked';
        continue;
      }

      if (m.stunTimer > 0) {
        m.stunTimer -= dt;
        m.vx *= Math.pow(0.85, dt * 60);
        m.vy *= Math.pow(0.85, dt * 60);
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.mood = 'shocked';
        continue;
      }

      if (m.overheatTimer > 0) {
        m.overheatTimer -= dt;
        m.mood = 'shocked';
      }

      if (m.kickTimer > 0) {
        m.kickTimer -= dt;
      }

      if (m.streakTimer > 0) {
        m.streakTimer -= dt;
        if (m.streakTimer <= 0) {
          m.streakCount = 0;
        }
      }

      const steerX = this.input.getSteer(id);
      const throttleY = -this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      // Movement
      const speedMult = (isUnderdog ? 1.25 : 1.0) * (m.kickTimer > 0 ? 1.35 : 1.0);
      const accel = 440 * speedMult;
      m.vx += steerX * accel * dt;
      m.vy += throttleY * accel * dt;

      m.vx *= Math.pow(0.90, dt * 60);
      m.vy *= Math.pow(0.90, dt * 60);

      m.x += m.vx * dt;
      m.y += m.vy * dt;

      // Keep within quarry walls
      const pad = 44;
      m.x = Math.max(pad, Math.min(width - pad, m.x));
      m.y = Math.max(pad, Math.min(height - pad, m.y));

      // Heading
      if (Math.hypot(m.vx, m.vy) > 18) {
        m.angle = Math.atan2(m.vy, m.vx);
      }

      // Hold-to-Charge Volley Punt & Sweet Spot (72%–98%)
      if (isAction && m.overheatTimer <= 0) {
        m.isCharging = true;
        m.chargeTime += dt;
        m.mood = 'focused';

        // Sparks
        if (Math.random() < 0.35) {
          const sparkColor = m.chargeTime >= 0.72 && m.chargeTime <= 0.98 ? '#00E676' : '#FFD54F';
          this.particles.emit(
            m.x + Math.cos(m.angle) * 16,
            m.y + Math.sin(m.angle) * 16,
            2,
            sparkColor
          );
        }

        // Blowout if held too long
        if (m.chargeTime > 1.25) {
          m.overheatTimer = 0.95;
          m.chargeTime = 0;
          m.isCharging = false;
          m.mood = 'shocked';
          this.audio.playExplosion();
          this.screenShake = 6;
          this.particles.emit(m.x, m.y, 14, '#FF3D00');
          this.announcementText = 'STUMBLE MISS!';
          this.announcementTimer = 0.8;
        }
      } else if (m.isCharging) {
        // Released! Check for nearby dynamite to punt
        const sweetSpot = (isUnderdog && m.chargeTime >= 0.50 && m.chargeTime <= 1.05) ||
                          (!isUnderdog && m.chargeTime >= 0.72 && m.chargeTime <= 0.98);

        let kickedAny = false;
        for (const d of this.dynamites) {
          if (!d.active) continue;
          const dist = Math.hypot(d.x - m.x, d.y - m.y);
          if (dist < 55) {
            kickedAny = true;
            d.kickerId = id;
            d.isSuperKicked = sweetSpot;

            const kickSpeed = sweetSpot ? 460 : 280;
            d.vx = Math.cos(m.angle) * kickSpeed;
            d.vy = Math.sin(m.angle) * kickSpeed;

            if (sweetSpot) {
              d.fuseTimer = 1.3; // Prime for fast explosive hit!
              m.score += 25;
              m.mood = 'triumph';
              this.audio.playScore();
              this.screenShake = 8;
              this.particles.emit(d.x, d.y, 16, '#00E676');
              this.announcementText = 'SUPER VOLLEY PUNT! +25';
              this.announcementTimer = 1.0;
            } else {
              d.fuseTimer += 1.2;
              this.audio.playTap();
            }
            break;
          }
        }

        m.kickTimer = sweetSpot ? 1.0 : 0.35;
        m.chargeTime = 0;
        m.isCharging = false;

        if (!kickedAny) {
          this.audio.playTap();
        }
      } else {
        m.mood = 'idle';
      }

      // Crate pickup
      for (let i = this.crates.length - 1; i >= 0; i--) {
        const crate = this.crates[i];
        if (Math.hypot(m.x - crate.x, m.y - crate.y) < crate.radius + 20) {
          const earned = crate.value * (isSuddenDeath ? 2 : 1);
          m.score += earned;
          m.streakCount = Math.min(3, m.streakCount + 1);
          m.streakTimer = 2.0;
          this.audio.playScore();
          this.particles.emit(crate.x, crate.y, 12, crate.color);
          this.crates.splice(i, 1);
          m.mood = 'triumph';
          break;
        }
      }
    }

    // Physical Miner Bumping & Shunts
    const minerArray = Array.from(this.miners.values());
    for (let i = 0; i < minerArray.length; i++) {
      for (let j = i + 1; j < minerArray.length; j++) {
        const m1 = minerArray[i];
        const m2 = minerArray[j];
        const dx = m2.x - m1.x;
        const dy = m2.y - m1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 38;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          m1.x -= nx * overlap * 0.5;
          m1.y -= ny * overlap * 0.5;
          m2.x += nx * overlap * 0.5;
          m2.y += ny * overlap * 0.5;

          const kx = m1.vx - m2.vx;
          const ky = m1.vy - m2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          const impulse = Math.hypot(kx, ky);
          m1.vx -= p * nx * 1.35;
          m1.vy -= p * ny * 1.35;
          m2.vx += p * nx * 1.35;
          m2.vy += p * ny * 1.35;

          if (impulse > 120 || m1.kickTimer > 0 || m2.kickTimer > 0) {
            this.audio.playBounce();
            this.screenShake = Math.min(14, impulse * 0.06 + 4);
            this.hitStopTimer = 0.04;

            const attacker = m1.kickTimer > m2.kickTimer ? m1 : (m2.kickTimer > m1.kickTimer ? m2 : null);
            if (attacker) {
              const victim = attacker === m1 ? m2 : m1;
              attacker.score += 30;
              attacker.sabotageCount++;
              victim.stunTimer = 0.65;
              victim.score = Math.max(0, victim.score - 10);
              this.particles.emit((m1.x + m2.x) * 0.5, (m1.y + m2.y) * 0.5, 14, '#FF1744');
              this.announcementText = 'QUARRY SHUNT! +30';
              this.announcementTimer = 1.0;
            }
          }
        }
      }
    }

    // Update Tumbling Dynamites
    for (let i = this.dynamites.length - 1; i >= 0; i--) {
      const d = this.dynamites[i];
      if (!d.active) continue;

      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rotation += 8 * dt;
      d.fuseTimer -= dt;

      // Wall bounce
      if (d.x < 30 || d.x > width - 30) {
        d.vx *= -0.85;
        d.x = Math.max(30, Math.min(width - 30, d.x));
      }
      if (d.y < 30 || d.y > height - 30) {
        d.vy *= -0.85;
        d.y = Math.max(30, Math.min(height - 30, d.y));
      }

      // Fuse sparks
      if (Math.random() < 0.4) {
        this.particles.emit(d.x, d.y - 10, 2, '#FFD54F');
      }

      // Explosion!
      if (d.fuseTimer <= 0) {
        d.active = false;
        this.audio.playExplosion();
        this.screenShake = 12;
        this.hitStopTimer = 0.05;
        this.particles.emit(d.x, d.y, 24, '#FF3D00');

        // Splash damage to nearby miners
        for (const m of this.miners.values()) {
          const dist = Math.hypot(m.x - d.x, m.y - d.y);
          if (dist < 80) {
            m.spinTimer = 1.2;
            m.score = Math.max(0, m.score - 15);
            m.vx = (m.x - d.x) * 4.5;
            m.vy = (m.y - d.y) * 4.5;

            // If kicked by another miner, award knockout points to kicker!
            if (d.kickerId !== null && d.kickerId !== m.id) {
              const kicker = this.miners.get(d.kickerId);
              if (kicker) {
                const earned = (isSuddenDeath ? 70 : 40);
                kicker.score += earned;
                kicker.sabotageCount++;
                this.announcementText = `BLAST KNOCKOUT! +${earned}`;
                this.announcementTimer = 1.0;
              }
            }
          }
        }
      }
    }

    this.dynamites = this.dynamites.filter(d => d.active);
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const m = this.miners.get(botId);
    if (!m || m.spinTimer > 0 || m.stunTimer > 0) return;

    let delay = 0.23;
    let blunderChance = 0.12;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      blunderChance = 0.02;
    }

    // Check closest dynamite
    let closestD: Dynamite | null = null;
    let minDist = 99999;
    for (const d of this.dynamites) {
      if (!d.active) continue;
      const dist = Math.hypot(d.x - m.x, d.y - m.y);
      if (dist < minDist) {
        minDist = dist;
        closestD = d;
      }
    }

    let targetX = _width * 0.5;
    let targetY = _height * 0.5;
    let wantKick = false;

    if (closestD && minDist < 65) {
      // Aim at nearest rival to blast them
      let rivalTarget = { x: _width * 0.5, y: _height * 0.5 };
      for (const [otherId, r] of this.miners.entries()) {
        if (otherId === botId) continue;
        rivalTarget = { x: r.x, y: r.y };
        break;
      }
      targetX = rivalTarget.x;
      targetY = rivalTarget.y;
      wantKick = true;
    } else if (closestD && minDist < 120 && closestD.fuseTimer < 1.5) {
      // Run away from exploding TNT
      targetX = m.x - (closestD.x - m.x);
      targetY = m.y - (closestD.y - m.y);
    } else {
      // Hunt nearest crate
      let closestC: MiningCrate | null = null;
      let minCDist = 99999;
      for (const c of this.crates) {
        const d = Math.hypot(c.x - m.x, c.y - m.y);
        if (d < minCDist) {
          minCDist = d;
          closestC = c;
        }
      }
      if (closestC) {
        targetX = closestC.x;
        targetY = closestC.y;
      }
    }

    const dx = targetX - m.x;
    const dy = targetY - m.y;
    let steerX = 0;
    let throttleY = 0;

    if (Math.hypot(dx, dy) > 20) {
      steerX = Math.max(-1, Math.min(1, dx / 80));
      throttleY = Math.max(-1, Math.min(1, dy / 80));
    }

    // Sweet-spot timing
    let wantAction = wantKick || (m.chargeTime > 0 && m.chargeTime < 0.85);
    if (m.chargeTime >= 0.78 && m.chargeTime <= 0.95) {
      wantAction = false;
    }

    if (Math.random() < blunderChance) {
      steerX += (Math.random() - 0.5) * 0.7;
      throttleY += (Math.random() - 0.5) * 0.7;
      wantAction = Math.random() < 0.3;
    }

    this.input.setBotInput(botId, wantAction, steerX, -throttleY, wantAction);
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

    // 1. Mine Cavern Floor Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Timber Mine Support Beams
    ctx.fillStyle = theme.beamColor;
    ctx.fillRect(20, 20, 16, height - 40);
    ctx.fillRect(width - 36, 20, 16, height - 40);
    ctx.fillRect(20, 20, width - 40, 16);
    ctx.fillRect(20, height - 36, width - 40, 16);

    // 3. Ore Veins
    ctx.fillStyle = theme.oreVeinColor;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(80 + i * 120, 80 + ((i * 47) % (height - 160)), 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Mining Crates
    for (const c of this.crates) {
      ctx.save();
      ctx.translate(c.x, c.y);
      const bob = Math.sin(c.pulsePhase) * 2;

      // Glow
      ctx.fillStyle = c.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, bob, c.radius * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Box
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.radius * 0.75, bob - c.radius * 0.75, c.radius * 1.5, c.radius * 1.5);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-c.radius * 0.75, bob - c.radius * 0.75, c.radius * 1.5, c.radius * 1.5);

      // Points label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${c.value}`, 0, bob + c.radius + 12);
      ctx.restore();
    }

    // 5. Tumbling Dynamite
    for (const d of this.dynamites) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);

      // Dynamite Bundle
      ctx.fillStyle = d.isSuperKicked ? '#FF3D00' : theme.tntColor;
      ctx.fillRect(-14, -8, 28, 16);

      ctx.strokeStyle = '#212121';
      ctx.lineWidth = 2;
      ctx.strokeRect(-14, -8, 28, 16);

      // Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TNT', 0, 4);

      // Fuse & Sparks
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(20, -5);
      ctx.stroke();

      ctx.fillStyle = '#FFEA00';
      ctx.beginPath();
      ctx.arc(20, -5, 3 + Math.sin(d.fuseTimer * 20) * 2, 0, Math.PI * 2);
      ctx.fill();

      // Countdown timer above
      ctx.restore();

      ctx.fillStyle = d.fuseTimer < 1.5 ? '#FF1744' : '#FFEB3B';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${d.fuseTimer.toFixed(1)}s`, d.x, d.y - 18);
    }

    // 6. Miners with Hardhat Headlamps & Steel Boots
    for (const [id, m] of this.miners.entries()) {
      ctx.save();
      ctx.translate(m.x, m.y);
      const pConfig = this.getPlayer(id);
      const color = pConfig?.color || '#EF4444';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      // Charge aura
      if (m.isCharging) {
        const pct = Math.min(1, m.chargeTime / 1.0);
        const sweetSpot = m.chargeTime >= 0.72 && m.chargeTime <= 0.98;
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

      // Kick trail
      if (m.kickTimer > 0) {
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.rotate(m.angle);

      // Miner Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Yellow Miner Hardhat
      ctx.fillStyle = '#FFD54F';
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Headlamp Beam Cone
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(40, -15);
      ctx.lineTo(40, 15);
      ctx.closePath();
      ctx.fill();

      // Mascot face in center
      drawCharacter(ctx, 0, 0, 9, id, isBot, m.mood, m.animTimer, undefined);

      ctx.restore();

      // Score Pill Above Miner
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(m.x - 22, m.y - 36, 44, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${m.score}`, m.x, m.y - 24);
    }

    // 7. Central Announcement Banner
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

    // 8. UI Header Badge (y: 56, h: 28)
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
    ctx.fillText('💣 DYNAMITE TUMBLE • QUARRY DODGE 💣', width * 0.5, badgeY + 17);
    ctx.restore();

    // 9. Theme Pill (Bottom-Left: x: 20, y: height - 44, w: 170, h: 32)
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

    // 10. Corner Player Cards (y: height - 128, 130x48px)
    const cardW = 130;
    const cardH = 48;
    const cardY = height - 128;
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const m = this.miners.get(p.id);
      if (!m) return;

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
      ctx.fillText(`${m.score} pts`, cardX + 28, cardY + 38);
      ctx.restore();
    });

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.miners.entries()).map(([playerId, m]) => ({
      playerId,
      score: m.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} booted dynamite to victory with ${scores[0].score} pts!`
        : 'The quarry settled into dusty rubble!'
    };
  }
}
