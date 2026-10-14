import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type IcarusThemeId = 'aegean' | 'sunset' | 'astral';

interface IcarusTheme {
  name: string;
  skyTop: string;
  skyUpper: string;
  skyMid: string;
  skyLower: string;
  seaTop: string;
  seaBot: string;
  sunCore: string;
  sunCorona: string;
  accent: string;
}

const THEMES: Record<IcarusThemeId, IcarusTheme> = {
  aegean: {
    name: 'Aegean Sunlit Archipelago',
    skyTop: '#d97706',
    skyUpper: '#fbbf24',
    skyMid: '#38bdf8',
    skyLower: '#0284c7',
    seaTop: '#0369a1',
    seaBot: '#0c4a6e',
    sunCore: '#fef08a',
    sunCorona: 'rgba(251, 191, 36, 0.35)',
    accent: '#facc15',
  },
  sunset: {
    name: 'Helios Crimson Dusk',
    skyTop: '#7f1d1d',
    skyUpper: '#ea580c',
    skyMid: '#c026d3',
    skyLower: '#311042',
    seaTop: '#4c1d95',
    seaBot: '#1e1b4b',
    sunCore: '#fed7aa',
    sunCorona: 'rgba(249, 115, 22, 0.4)',
    accent: '#fb923c',
  },
  astral: {
    name: 'Starlight Olympus Sky',
    skyTop: '#090418',
    skyUpper: '#1e1b4b',
    skyMid: '#1d4ed8',
    skyLower: '#0f172a',
    seaTop: '#0e7490',
    seaBot: '#083344',
    sunCore: '#e0f2fe',
    sunCorona: 'rgba(56, 189, 248, 0.38)',
    accent: '#38bdf8',
  },
};

const THEME_ORDER: IcarusThemeId[] = ['aegean', 'sunset', 'astral'];

interface SkyRing {
  id: number;
  x: number;
  y: number;
  kind: 'gold' | 'solar' | 'ambrosia';
  collected: boolean;
}

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ThermalColumn {
  x: number;
  w: number;
  strength: number;
  phase: number;
}

interface Callout {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface IcarusFlyer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  waxHeat: number;
  wingMeltedTimer: number;
  score: number;
  combo: number;
  wingAngle: number;
  charge: number;
  charging: boolean;
  glideBoostAnim: number;
  shuntCooldown: number;
  ringsCollected: number;
  galesUnleashed: number;
  botReactionTimer: number;
  botTargetX: number;
  botTargetY: number;
  botReleaseThreshold: number;
}

export class IcarusWingsGame extends BaseGame {
  public flyers: Map<PlayerId, IcarusFlyer> = new Map();
  public rings: SkyRing[] = [];
  public clouds: Cloud[] = [];
  public thermals: ThermalColumn[] = [];
  public currentMapName: string = 'Aegean Sunlit Archipelago';

  private themeId: IcarusThemeId = 'aegean';
  private callouts: Callout[] = [];
  private ringIdCounter: number = 0;
  private nextRingDist: number = 110;
  private animTime: number = 0;
  private screenShake: number = 0;
  private suddenDeathAnnounced: boolean = false;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    this.bindThemeControls();
  }

  private bindThemeControls(): void {
    this.cleanupControls();
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      } else if (e.key === '1') {
        this.setTheme('aegean');
      } else if (e.key === '2') {
        this.setTheme('sunset');
      } else if (e.key === '3') {
        this.setTheme('astral');
      }
    };
    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      if (mx >= 20 && mx <= 190 && my >= canvas.height - 44 && my <= canvas.height - 12) {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('mousedown', this.clickHandler);
  }

  private setTheme(id: IcarusThemeId): void {
    this.themeId = id;
    this.currentMapName = THEMES[id].name;
    this.audio.playTap();
  }

  private cleanupControls(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('mousedown', this.clickHandler);
      this.clickHandler = null;
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.flyers.clear();
    this.rings = [];
    this.callouts = [];
    this.clouds = [
      { x: width * 0.2, y: height * 0.34, w: 105, h: 38 },
      { x: width * 0.56, y: height * 0.42, w: 125, h: 42 },
      { x: width * 0.86, y: height * 0.30, w: 95, h: 36 },
    ];
    this.thermals = [
      { x: width * 0.32, w: 68, strength: 185, phase: 0 },
      { x: width * 0.68, w: 74, strength: 205, phase: 2.1 },
    ];
    this.nextRingDist = 90;
    this.animTime = 0;
    this.screenShake = 0;
    this.suddenDeathAnnounced = false;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = width * 0.22 + idx * 72;
      const startY = height * 0.52 + (idx % 2) * 28;
      this.flyers.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        waxHeat: 12,
        wingMeltedTimer: 0,
        score: 0,
        combo: 0,
        wingAngle: 0,
        charge: 0,
        charging: false,
        glideBoostAnim: 0,
        shuntCooldown: 0,
        ringsCollected: 0,
        galesUnleashed: 0,
        botReactionTimer: 0.14,
        botTargetX: startX,
        botTargetY: startY,
        botReleaseThreshold: 0.82,
      });
    });

    // Seed initial rings across the sky so action begins immediately
    for (let i = 0; i < 4; i++) {
      this.rings.push({
        id: ++this.ringIdCounter,
        x: width * (0.35 + i * 0.16),
        y: height * (0.32 + (i % 3) * 0.14),
        kind: i === 2 ? 'solar' : 'gold',
        collected: false,
      });
    }
  }

  private spawnCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  private getLeaderScore(): number {
    let best = 0;
    this.flyers.forEach((f) => {
      if (f.score > best) best = f.score;
    });
    return best;
  }

  private isUnderdog(f: IcarusFlyer): boolean {
    return this.getLeaderScore() - f.score >= 110;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.animTime += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.cleanupControls();
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 26);
    }

    const suddenDeath = this.roundTimer <= 12.0;
    if (suddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playFanfare();
      this.spawnCallout(width * 0.5, height * 0.24, '☀️ APOLLO SOLAR FLARE (2X SCORE)! ☀️', '#facc15');
    }

    const scrollSpeed = suddenDeath ? 205 : 168;
    const sunLine = height * (suddenDeath ? 0.25 : 0.21);
    const seaLine = height * 0.81;
    const scoreMult = suddenDeath ? 2 : 1;

    // Scroll Cooling Clouds
    this.clouds.forEach((c) => {
      c.x -= scrollSpeed * 0.55 * dt;
      if (c.x < -140) {
        c.x = width + 60;
        c.y = sunLine + 35 + Math.random() * (seaLine - sunLine - 110);
      }
    });

    // Drift Golden Thermal Columns
    this.thermals.forEach((th) => {
      th.phase += dt * 3;
      th.x -= scrollSpeed * 0.35 * dt;
      if (th.x < -80) {
        th.x = width + 70;
      }
    });

    // Spawn Sky Rings
    this.nextRingDist -= scrollSpeed * dt;
    if (this.nextRingDist <= 0) {
      const y = sunLine + 24 + Math.random() * (seaLine - sunLine - 56);
      const isSolar = y < sunLine + 75;
      const isAmbrosia = !isSolar && Math.random() < 0.22;
      this.rings.push({
        id: ++this.ringIdCounter,
        x: width + 36,
        y,
        kind: isAmbrosia ? 'ambrosia' : isSolar ? 'solar' : 'gold',
        collected: false,
      });
      this.nextRingDist = 115 + Math.random() * 65;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].x -= scrollSpeed * dt;
      if (this.rings[i].x < -40 || this.rings[i].collected) {
        this.rings.splice(i, 1);
      }
    }

    this.updateBots(dt, width, height);

    // Update Flyers
    this.flyers.forEach((f) => {
      if (f.wingMeltedTimer > 0) f.wingMeltedTimer = Math.max(0, f.wingMeltedTimer - dt);
      if (f.shuntCooldown > 0) f.shuntCooldown = Math.max(0, f.shuntCooldown - dt);
      if (f.glideBoostAnim > 0) f.glideBoostAnim = Math.max(0, f.glideBoostAnim - dt * 3.0);

      const p = this.getPlayer(f.id);
      const underdog = this.isUnderdog(f);

      if (p && !p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(f.id);
        const justPressed = this.input.justPressed(f.id) || this.input.justAction(f.id);
        const holdAction = this.input.isActionPressed(f.id) || this.input.isPressed(f.id);

        if (Math.abs(steer) > 0.1) {
          f.vx += steer * (underdog ? 540 : 460) * dt;
        }

        if (f.wingMeltedTimer <= 0) {
          if (justPressed && !f.charging) {
            this.executeFlap(f);
          }

          if (holdAction) {
            f.charging = true;
            f.charge = Math.min(1.0, f.charge + dt * 1.05);
            // Aerodynamic glide dampens fall & cools wax while holding!
            if (f.vy > 45) f.vy -= 320 * dt;
            f.waxHeat = Math.max(0, f.waxHeat - 18 * dt);
            if (f.charge >= 1.0) {
              f.charging = false;
              f.charge = 0;
            }
          } else if (f.charging) {
            const released = f.charge;
            f.charging = false;
            f.charge = 0;
            if (released >= 0.26) {
              this.executeSolarGlide(f, released, scoreMult);
            }
          }
        } else {
          f.charging = false;
          f.charge = 0;
        }
      }

      // Check Golden Thermal Updrafts
      const inThermal = this.thermals.find((th) => Math.abs(f.x - th.x) < th.w * 0.5);
      if (inThermal && f.wingMeltedTimer <= 0) {
        f.vy -= inThermal.strength * dt;
      }

      // Physics integration
      f.vx *= Math.pow(0.08, dt);
      f.x += f.vx * dt;
      f.x = Math.max(70, Math.min(width - 90, f.x));

      f.vy += 420 * dt;
      f.y += f.vy * dt;
      f.wingAngle += (0 - f.wingAngle) * dt * 5.5;

      const inCloud = this.clouds.some(
        (c) => f.x >= c.x - 24 && f.x <= c.x + c.w + 24 && Math.abs(f.y - c.y) < 38
      );

      // Solar Heat vs Cooling Clouds
      if (f.y < sunLine) {
        f.waxHeat += (underdog ? 34 : 46) * dt;
        if (f.waxHeat >= 100 && f.wingMeltedTimer <= 0) {
          f.wingMeltedTimer = 1.15;
          f.waxHeat = 55;
          f.combo = 0;
          f.vy = 160;
          f.score = Math.max(0, f.score - 20);
          this.audio.playStun();
          this.particles.spawnExplosion(f.x, f.y, '#f97316', 16);
          this.spawnCallout(f.x, f.y + 18, '-20 WAX MELTED!', '#ef4444');
        }
      } else if (inCloud) {
        f.waxHeat = Math.max(0, f.waxHeat - 48 * dt);
      } else {
        f.waxHeat = Math.max(0, f.waxHeat - 18 * dt);
      }

      // Aegean Sea Wave Bounce
      if (f.y > seaLine) {
        f.y = seaLine;
        f.vy = -195;
        f.waxHeat = Math.max(0, f.waxHeat - 25);
        if (!underdog) {
          f.score = Math.max(0, f.score - 12 * dt);
        }
        this.audio.playBounce();
        this.particles.spawnSparks(f.x, seaLine, '#38bdf8', 6);
      }

      // Collect Sky Rings
      const catchRadius = f.glideBoostAnim > 0 ? 52 : 34;
      this.rings.forEach((r) => {
        if (!r.collected && Math.hypot(r.x - f.x, r.y - f.y) < catchRadius) {
          r.collected = true;
          f.ringsCollected++;
          f.combo++;
          const basePts = r.kind === 'ambrosia' ? 60 : r.kind === 'solar' ? 42 : 26;
          const pts = (basePts + Math.min(30, f.combo * 3)) * scoreMult;
          f.score += pts;
          if (r.kind === 'ambrosia') {
            f.waxHeat = Math.max(0, f.waxHeat - 35);
          }
          this.audio.playCoin();
          this.particles.spawnConfetti(r.x, r.y, 12);
          this.spawnCallout(
            r.x,
            r.y - 20,
            r.kind === 'ambrosia' ? `🪽 +${pts} AMBROSIA!` : r.kind === 'solar' ? `☀️ +${pts} SOLAR!` : `+${pts}`,
            r.kind === 'ambrosia' ? '#38bdf8' : '#facc15'
          );
        }
      });
    });

    // Elastic Mid-Air Flyer Collisions
    const list = Array.from(this.flyers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 36) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = 36 - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          a.vx -= nx * 125;
          a.vy -= ny * 135;
          b.vx += nx * 125;
          b.vy += ny * 135;
          this.audio.playBounce();
          this.particles.spawnSparks((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#facc15', 8);
        }
      }
    }

    // Update Callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 30 * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  private executeFlap(f: IcarusFlyer): void {
    f.vy = -245;
    f.waxHeat = Math.min(100, f.waxHeat + 3.5);
    f.wingAngle = -0.62;
    this.audio.playTap();
  }

  private executeSolarGlide(f: IcarusFlyer, chargeLevel: number, scoreMult: number): void {
    const isSweetSpot = chargeLevel >= 0.72 && chargeLevel <= 0.98;
    f.glideBoostAnim = 1.0;
    f.wingAngle = -0.8;

    if (isSweetSpot) {
      f.vy = -275;
      f.vx += 195;
      f.waxHeat = Math.max(0, f.waxHeat - 28);
      f.galesUnleashed++;
      this.screenShake = Math.min(12, this.screenShake + 6);
      this.audio.playExplosion();
      this.particles.spawnExplosion(f.x, f.y, '#facc15', 18);
      this.spawnCallout(f.x, f.y - 34, '⚡ APOLLO SUNBURST GLIDE!', '#facc15');

      // Vacuum nearby rings within 105px
      this.rings.forEach((r) => {
        if (!r.collected && Math.hypot(r.x - f.x, r.y - f.y) <= 105) {
          r.x = f.x;
          r.y = f.y;
        }
      });

      // Solar Gale Shunt against rival flyers!
      this.flyers.forEach((other) => {
        if (other.id === f.id || other.shuntCooldown > 0) return;
        const d = Math.hypot(other.x - f.x, other.y - f.y);
        if (d <= 98) {
          const pushUp = other.y < f.y ? -260 : 250;
          other.vy += pushUp;
          other.vx -= 140;
          other.waxHeat = Math.min(95, other.waxHeat + 18);
          other.shuntCooldown = 1.2;
          const pts = 65 * scoreMult;
          f.score += pts;
          this.audio.playStun();
          this.particles.spawnExplosion(other.x, other.y, '#facc15', 14);
          this.spawnCallout(other.x, other.y - 28, `🌪️ GALE SHUNT! +${pts}`, '#facc15');
        }
      });
    } else {
      f.vy = -195;
      f.vx += 95;
      this.audio.playWhoosh();
      this.particles.spawnSparks(f.x, f.y, '#fde047', 8);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const f = this.flyers.get(botId);
    if (!f || f.wingMeltedTimer > 0) return;

    const scoreMult = this.roundTimer <= 12.0 ? 2 : 1;

    f.botReactionTimer -= dt;
    if (f.botReactionTimer <= 0) {
      f.botReactionTimer =
        difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.39;
      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      // Pick best upcoming ring
      let bestRing: SkyRing | null = null;
      let bestScore = -Infinity;
      for (const r of this.rings) {
        if (r.collected || r.x < f.x - 20) continue;
        const val = r.kind === 'ambrosia' ? 110 : r.kind === 'solar' ? 85 : 55;
        const distScore = val - (r.x - f.x) * 0.25 - Math.abs(r.y - f.y) * 0.35;
        if (distScore > bestScore) {
          bestScore = distScore;
          bestRing = r;
        }
      }

      if (f.waxHeat > 72 && Math.random() > blunder) {
        // Seek cooling cloud or lower altitude
        const cloud = this.clouds.find((c) => c.x > 60 && c.x < width - 60);
        f.botTargetY = cloud ? cloud.y : height * 0.62;
        f.botTargetX = cloud ? cloud.x + cloud.w * 0.5 : width * 0.35;
      } else if (bestRing && Math.random() > blunder) {
        f.botTargetY = bestRing.y;
        f.botTargetX = Math.max(110, Math.min(width * 0.68, bestRing.x - 45));
      } else {
        f.botTargetY = height * 0.52;
        f.botTargetX = width * (0.25 + Number(botId) * 0.12);
      }

      if (f.y > f.botTargetY + 14 && f.waxHeat < 82) {
        this.executeFlap(f);
        if (!f.charging && difficulty !== 'bot_easy' && Math.random() < 0.45) {
          f.charging = true;
          f.botReleaseThreshold = difficulty === 'bot_hard' ? 0.80 : 0.74;
        }
      }
    }

    const dx = f.botTargetX - f.x;
    if (Math.abs(dx) > 14) {
      f.vx += Math.sign(dx) * 380 * dt;
    }

    if (f.charging) {
      f.charge = Math.min(1.0, f.charge + dt * 1.05);
      if (f.vy > 45) f.vy -= 300 * dt;
      if (f.charge >= f.botReleaseThreshold) {
        const released = f.charge;
        f.charging = false;
        f.charge = 0;
        this.executeSolarGlide(f, released, scoreMult);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeId];
    const suddenDeath = this.roundTimer <= 12.0;
    const sunLine = height * (suddenDeath ? 0.25 : 0.21);
    const seaLine = height * 0.81;

    ctx.save();
    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Sky Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(0.22, theme.skyUpper);
    bgGrad.addColorStop(0.55, theme.skyMid);
    bgGrad.addColorStop(0.82, theme.skyLower);
    bgGrad.addColorStop(1, theme.seaBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Scorching Solar Zone Band & Sun Orb
    ctx.fillStyle = 'rgba(249, 115, 22, 0.16)';
    ctx.fillRect(0, 0, width, sunLine);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, sunLine);
    ctx.lineTo(width, sunLine);
    ctx.stroke();
    ctx.setLineDash([]);

    const sunX = width * 0.84;
    const sunY = 54;
    ctx.fillStyle = theme.sunCorona;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 82 + Math.sin(this.animTime * 4) * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 44, 0, Math.PI * 2);
    ctx.fill();

    // 2. Golden Thermal Updraft Columns
    this.thermals.forEach((th) => {
      const thGrad = ctx.createLinearGradient(0, sunLine, 0, seaLine);
      thGrad.addColorStop(0, 'rgba(250, 204, 21, 0)');
      thGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.14)');
      thGrad.addColorStop(1, 'rgba(250, 204, 21, 0.04)');
      ctx.fillStyle = thGrad;
      ctx.fillRect(th.x - th.w / 2, sunLine, th.w, seaLine - sunLine);

      // Rising wind chevrons
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const wy = seaLine - (((this.animTime * 90 + i * 95) % (seaLine - sunLine)));
        ctx.beginPath();
        ctx.moveTo(th.x - 14, wy + 8);
        ctx.lineTo(th.x, wy);
        ctx.lineTo(th.x + 14, wy + 8);
        ctx.stroke();
      }
    });

    // 3. Cooling Cumulus Clouds
    this.clouds.forEach((c) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.beginPath();
      ctx.roundRect(c.x, c.y - c.h / 2, c.w, c.h, 18);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x + c.w * 0.32, c.y - c.h * 0.38, 22, 0, Math.PI * 2);
      ctx.arc(c.x + c.w * 0.66, c.y - c.h * 0.32, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('❄️ COOL CLOUD', c.x + c.w * 0.5, c.y + 4);
    });

    // 4. Sky Rings (Gold, Solar 1.6x, Ambrosia Feather)
    this.rings.forEach((r) => {
      if (r.collected) return;
      ctx.save();
      ctx.translate(r.x, r.y);
      const stroke = r.kind === 'ambrosia' ? '#38bdf8' : r.kind === 'solar' ? '#f97316' : '#facc15';
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 20, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle =
        r.kind === 'ambrosia'
          ? 'rgba(56, 189, 248, 0.28)'
          : r.kind === 'solar'
          ? 'rgba(249, 115, 22, 0.28)'
          : 'rgba(250, 204, 21, 0.24)';
      ctx.fill();
      ctx.restore();
    });

    // 5. Aegean Sea & Distant Marble Islands
    const seaGrad = ctx.createLinearGradient(0, seaLine, 0, height);
    seaGrad.addColorStop(0, theme.seaTop);
    seaGrad.addColorStop(1, theme.seaBot);
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, seaLine, width, height - seaLine);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let x = 0; x < width; x += 36) {
      const waveOff = Math.sin(this.animTime * 4 + x * 0.05) * 3;
      ctx.beginPath();
      ctx.arc(x + 18, seaLine + waveOff, 14, Math.PI, 0);
      ctx.fill();
    }

    // 6. Render 2.5D Icarus Flyers with Articulated Feathered Wings
    this.flyers.forEach((f, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#ef4444';
      const isSweetSpot = f.charge >= 0.72 && f.charge <= 0.98;

      ctx.save();
      ctx.translate(f.x, f.y);

      if (f.glideBoostAnim > 0) {
        ctx.strokeStyle = `rgba(250, 204, 21, ${f.glideBoostAnim})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, (1 - f.glideBoostAnim) * 85 + 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.rotate(f.wingAngle * 0.4);

      // Articulated Feathered Wax Wings
      const wingColor =
        f.wingMeltedTimer > 0
          ? '#ea580c'
          : isSweetSpot || f.glideBoostAnim > 0
          ? '#fef08a'
          : '#f8fafc';
      const flapY = Math.sin(f.wingAngle * 2.5) * 14;

      ctx.fillStyle = wingColor;
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      // Left Wing
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.quadraticCurveTo(-28, -22 - flapY, -34, -4 - flapY);
      ctx.lineTo(-14, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right Wing
      ctx.beginPath();
      ctx.moveTo(6, -4);
      ctx.quadraticCurveTo(28, -22 - flapY, 34, -4 - flapY);
      ctx.lineTo(14, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2.5D Mascot Flyer
      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        0,
        16,
        f.wingMeltedTimer > 0 ? 'shocked' : f.glideBoostAnim > 0.2 ? 'triumph' : 'focused',
        this.animTime
      );
      ctx.restore();

      // Wax Heat Bar
      const barW = 38;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(-barW / 2, -30, barW, 5);
      ctx.fillStyle = f.waxHeat > 72 ? '#ef4444' : '#f59e0b';
      ctx.fillRect(-barW / 2, -30, (barW * f.waxHeat) / 100, 5);

      // Hold-to-Charge Daedalus Glide Gauge (72%–98% Sweet Spot)
      if (f.charging && f.charge > 0.04) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(-barW / 2 - 1, -39, barW + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-barW / 2 + barW * 0.72, -38, barW * 0.26, 4);
        ctx.fillStyle = isSweetSpot ? '#facc15' : '#38bdf8';
        ctx.fillRect(-barW / 2, -38, barW * f.charge, 4);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? `P${pId + 1}`}: ${Math.floor(f.score)}`, 0, 28);
      ctx.restore();
    });

    // 7. Callouts
    this.callouts.forEach((c) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, c.life / c.maxLife);
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(c.text, c.x + 1, c.y + 1);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    });

    ctx.restore();

    // 8. Top Instruction Pill (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 245, 56, 490, 28, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🪶 TAP: FLAP • STEER: FLY • HOLD & RELEASE (72–98%): SUNBURST GLIDE & GALE SHUNT!',
      width / 2,
      74
    );

    // 9. Corner Score Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const f = this.flyers.get(p.id);
      if (!f) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 - row * 56;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 48, 10);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${Math.floor(f.score)} pts`, cardX + 10, cardY + 37);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`⭕${f.ringsCollected} 🌪️${f.galesUnleashed}`, cardX + 150, cardY + 37);
    });

    // 10. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 [T] ${theme.name}`, 105, height - 24);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.flyers.forEach((f, pId) => scores.set(pId, Math.floor(f.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    this.cleanupControls();
    const rankings = Array.from(this.flyers.entries())
      .map(([playerId, f]) => ({ playerId, score: Math.floor(f.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    const winnerCfg = winnerId ? this.getPlayer(winnerId) : undefined;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerCfg
        ? `${winnerCfg.name} soared across the Aegean with ${rankings[0].score} pts!`
        : 'All wax wings melted into the Aegean!',
    };
  }
}
