import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type TombTheme = 'luxor' | 'anubis' | 'cyber';

interface CorridorTrap {
  id: number;
  x: number;
  lane: number; // 0, 1, 2
  type: 'spikes' | 'scarab' | 'gold_idol';
  collected: boolean;
}

interface TombRunner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  yOffset: number; // vertical jump height (<= 0)
  jumpVy: number;
  isJumping: boolean;
  isWhipVault: boolean;
  radius: number;
  isCharging: boolean;
  chargeRatio: number;
  overloadTimer: number;
  stumbleTimer: number;
  score: number;
  combo: number;
  idolsSnatched: number;
  shuntsLanded: number;
  isUnderdog: boolean;
  botReactionTimer: number;
  botTargetLane: number;
  botTargetCharge: number;
}

export class PharaohTombGame extends BaseGame {
  public theme: TombTheme = 'luxor';
  public runners: Map<PlayerId, TombRunner> = new Map();
  private traps: CorridorTrap[] = [];
  private trapIdCounter: number = 0;
  private spawnTimer: number = 0.45;
  private scrollDistance: number = 0;
  private boulderX: number = 95;
  private laneCenters: number[] = [210, 315, 420];
  private suddenDeathTriggered: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private mousedownListener: ((e: MouseEvent) => void) | null = null;
  private lastWidth: number = 800;
  private lastHeight: number = 600;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 36.0;
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.reset(width, height);

    if (typeof window !== 'undefined') {
      this.keydownListener = (e: KeyboardEvent) => {
        if (e.key === '1') this.switchTheme('luxor', this.lastWidth, this.lastHeight);
        else if (e.key === '2') this.switchTheme('anubis', this.lastWidth, this.lastHeight);
        else if (e.key === '3') this.switchTheme('cyber', this.lastWidth, this.lastHeight);
        else if (e.key === 't' || e.key === 'T') {
          const order: TombTheme[] = ['luxor', 'anubis', 'cyber'];
          const next = order[(order.indexOf(this.theme) + 1) % order.length];
          this.switchTheme(next, this.lastWidth, this.lastHeight);
        }
      };
      this.mousedownListener = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        if (mx >= 20 && mx <= 190 && my >= this.lastHeight - 44 && my <= this.lastHeight - 12) {
          const order: TombTheme[] = ['luxor', 'anubis', 'cyber'];
          const next = order[(order.indexOf(this.theme) + 1) % order.length];
          this.switchTheme(next, this.lastWidth, this.lastHeight);
        }
      };
      window.addEventListener('keydown', this.keydownListener);
      window.addEventListener('mousedown', this.mousedownListener);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      if (this.mousedownListener) {
        window.removeEventListener('mousedown', this.mousedownListener);
        this.mousedownListener = null;
      }
    }
  }

  public switchTheme(theme: TombTheme, width: number, height: number): void {
    this.theme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `THEME: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'luxor' ? '#F59E0B' : theme === 'anubis' ? '#A855F7' : '#38BDF8',
      22
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.isFinished = false;
    this.suddenDeathTriggered = false;
    this.roundTimer = 36.0;
    this.runners.clear();
    this.traps = [];
    this.trapIdCounter = 0;
    this.spawnTimer = 0.35;
    this.scrollDistance = 0;
    this.boulderX = 88;

    const topCorridor = 165;
    const bottomCorridor = height - 95;
    const span = bottomCorridor - topCorridor;
    this.laneCenters = [topCorridor + span * 0.18, topCorridor + span * 0.5, topCorridor + span * 0.82];

    const active = this.getActivePlayers();
    active.forEach((p, index) => {
      const laneIdx = index % 3;
      this.runners.set(p.id, {
        id: p.id,
        x: width * 0.42 + index * 32,
        y: this.laneCenters[laneIdx],
        vx: 0,
        vy: 0,
        yOffset: 0,
        jumpVy: 0,
        isJumping: false,
        isWhipVault: false,
        radius: 15,
        isCharging: false,
        chargeRatio: 0,
        overloadTimer: 0,
        stumbleTimer: 0,
        score: 0,
        combo: 0,
        idolsSnatched: 0,
        shuntsLanded: 0,
        isUnderdog: false,
        botReactionTimer: 0.14 + index * 0.05,
        botTargetLane: laneIdx,
        botTargetCharge: 0.82
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.lastWidth = width;
    this.lastHeight = height;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    // Sudden Death Overdrive at <= 12s
    if (this.roundTimer <= 12.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText(
        '⚡ SUDDEN DEATH: RUNAWAY SKULL BOULDER & GOLD IDOL RUSH! ⚡',
        width / 2,
        102,
        '#FACC15',
        20
      );
    }

    // Compute Underdog Surge (>= 180 pts behind leader)
    let maxScore = 0;
    for (const r of this.runners.values()) {
      if (r.score > maxScore) maxScore = r.score;
    }
    for (const r of this.runners.values()) {
      r.isUnderdog = maxScore - r.score >= 180;
    }

    const scrollSpeed = this.suddenDeathTriggered ? 310 : 245;
    this.scrollDistance += scrollSpeed * dt;

    // Boulder creeps forward during Sudden Death or settles around x = 92..135
    const targetBoulderX = this.suddenDeathTriggered ? 132 : 94;
    this.boulderX += (targetBoulderX - this.boulderX) * dt * 1.8;

    // Spawn Corridor Traps & Relics across the 3 lanes
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeathTriggered ? 0.34 : 0.48;
      const lane = Math.floor(Math.random() * 3);
      const roll = Math.random();
      const type =
        roll < 0.46 ? 'spikes' : roll < (this.suddenDeathTriggered ? 0.68 : 0.8) ? 'scarab' : 'gold_idol';
      this.traps.push({
        id: ++this.trapIdCounter,
        x: width + 40,
        lane,
        type,
        collected: false
      });
    }

    this.updateBots(dt, width, height);

    // Update traps
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const trap = this.traps[i];
      trap.x -= scrollSpeed * dt;
      if (trap.x < -60) {
        this.traps.splice(i, 1);
      }
    }

    const activePlayers = this.getActivePlayers();
    for (const p of activePlayers) {
      const r = this.runners.get(p.id);
      if (!r) continue;

      if (r.overloadTimer > 0) r.overloadTimer = Math.max(0, r.overloadTimer - dt);
      if (r.stumbleTimer > 0) r.stumbleTimer = Math.max(0, r.stumbleTimer - dt);

      const steer = this.input.getSteer(p.id);
      const throttle = -this.input.getThrottle(p.id);
      const holdingAction = this.input.isActionPressed(p.id);

      // Hold-to-Charge Bullwhip Grapple Vault & Sandstorm Shunt (72%-98% Sweet Spot)
      if (r.overloadTimer <= 0 && r.stumbleTimer <= 0) {
        if (holdingAction) {
          r.isCharging = true;
          r.chargeRatio += dt * 1.25 * (r.isUnderdog ? 1.3 : 1.0);
          if (r.chargeRatio >= 1.0) {
            r.chargeRatio = 0;
            r.isCharging = false;
            r.overloadTimer = 0.5;
            this.audio.playStun();
            this.particles.showFloatingText('WHIP TANGLE!', r.x, r.y - 28, '#F97316', 16);
          }
        } else if (r.isCharging) {
          const ratio = r.chargeRatio;
          r.isCharging = false;
          r.chargeRatio = 0;

          if (!r.isJumping) {
            const isSweet = ratio >= 0.72 && ratio <= 0.98;
            r.isJumping = true;
            r.isWhipVault = isSweet;
            r.jumpVy = isSweet ? -440 : -360;
            this.audio.playWhoosh();

            if (isSweet) {
              r.vx += 195; // Surge forward away from the boulder!
              this.particles.showFloatingText('WHIP VAULT!', r.x, r.y - 34, '#FACC15', 18);
              this.triggerWhipShockwave(r);
            }
          }
        }
      }

      // Vertical Jump Physics
      if (r.isJumping) {
        r.yOffset += r.jumpVy * dt;
        r.jumpVy += 920 * dt;
        if (r.yOffset >= 0) {
          r.yOffset = 0;
          r.jumpVy = 0;
          r.isJumping = false;
          r.isWhipVault = false;
        }
      }

      const speed = (r.isUnderdog ? 245 : 205) * (r.stumbleTimer > 0 ? 0.45 : 1.0);
      const treadDrag = r.stumbleTimer > 0 ? -95 : 0;
      r.vx += (steer * speed + treadDrag - r.vx) * Math.min(1, dt * 9);
      r.vy += (throttle * speed - r.vy) * Math.min(1, dt * 11);

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Corridor bounds
      r.x = Math.max(this.boulderX + 42, Math.min(width - 48, r.x));
      r.y = Math.max(this.laneCenters[0] - 28, Math.min(this.laneCenters[2] + 28, r.y));

      // Check Boulder Crush if pushed back against the giant Skull Boulder!
      if (r.x <= this.boulderX + 46 && r.stumbleTimer <= 0) {
        r.stumbleTimer = 0.65;
        r.vx = 240;
        r.score = Math.max(0, r.score - 35);
        r.combo = 0;
        this.audio.playExplosion();
        this.particles.shake(0.28);
        this.particles.showFloatingText('BOULDER CRUSH! -35', r.x, r.y - 24, '#EF4444', 18);
      }

      // Check Trap & Relic Collisions
      for (const trap of this.traps) {
        if (trap.collected) continue;
        const trapY = this.laneCenters[trap.lane];
        const dx = Math.abs(trap.x - r.x);
        const dy = Math.abs(trapY - r.y);
        const pickupRadius = r.isWhipVault ? 58 : 28;

        if (trap.type === 'spikes') {
          if (dx < 24 && dy < 22) {
            if (r.yOffset > -20) {
              // Tripped on floor spikes!
              trap.collected = true;
              r.stumbleTimer = 0.65;
              r.vx = -150;
              r.combo = 0;
              this.boulderX = Math.min(185, this.boulderX + 18);
              this.audio.playStun();
              this.particles.spawnSparks(r.x, r.y, '#EF4444', 10);
              this.particles.showFloatingText('SPIKED!', r.x, r.y - 20, '#EF4444', 17);
            } else {
              // Vaulted cleanly over spikes!
              trap.collected = true;
              r.combo += 1;
              const pts = 25 + r.combo * 5;
              r.score += pts;
              this.audio.playTap();
              this.particles.showFloatingText(`HURDLE! +${pts}`, r.x, r.y + r.yOffset - 18, '#38BDF8', 16);
            }
          }
        } else if (Math.hypot(trap.x - r.x, trapY - r.y) <= pickupRadius) {
          trap.collected = true;
          r.idolsSnatched += 1;
          r.combo += 1;
          const basePts = trap.type === 'gold_idol' ? 85 : 40;
          const mult = (r.isWhipVault ? 1.4 : 1.0) * (r.isUnderdog ? 1.25 : 1.0);
          const pts = Math.round(basePts * mult);
          r.score += pts;
          this.audio.playCoin();
          this.particles.spawnConfetti(trap.x, trapY, 10);
          this.particles.showFloatingText(
            trap.type === 'gold_idol' ? `♛ ANUBIS IDOL! +${pts}` : `+${pts} SCARAB`,
            trap.x,
            trapY - 18,
            trap.type === 'gold_idol' ? '#FACC15' : '#2DD4BF',
            18
          );
        }
      }
    }

    // Player-to-Player Elastic Corridor Collisions (m1*v1 + m2*v2)
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const p1 = this.runners.get(activePlayers[i].id);
        const p2 = this.runners.get(activePlayers[j].id);
        if (!p1 || !p2) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius + 4;

        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          p1.x -= nx * overlap;
          p1.y -= ny * overlap;
          p2.x += nx * overlap;
          p2.y += ny * overlap;

          const kx = p1.vx - p2.vx;
          const ky = p1.vy - p2.vy;
          const pImp = 2 * (nx * kx + ny * ky) * 0.5;
          p1.vx -= pImp * nx - nx * 50;
          p1.vy -= pImp * ny - ny * 50;
          p2.vx += pImp * nx + nx * 50;
          p2.vy += pImp * ny + ny * 50;
          this.audio.playBounce();
        }
      }
    }
  }

  private triggerWhipShockwave(caster: TombRunner): void {
    for (const other of this.runners.values()) {
      if (other.id === caster.id) continue;
      const d = Math.hypot(other.x - caster.x, other.y - caster.y);
      if (d > 0 && d <= 96) {
        other.vx -= 220; // lashes rival backward toward the Skull Boulder!
        other.stumbleTimer = 0.45;
        caster.score += 60;
        caster.shuntsLanded += 1;
        this.audio.playBounce();
        this.particles.showFloatingText('WHIP LASH! +60', other.x, other.y - 24, '#FACC15', 17);
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _height: number
  ): void {
    const r = this.runners.get(botId);
    if (!r) return;

    // Find upcoming spikes or idols
    let dangerSpike: CorridorTrap | null = null;
    let bestRelic: CorridorTrap | null = null;
    let bestRelicDist = 9999;

    for (const t of this.traps) {
      if (t.collected || t.x < r.x - 10) continue;
      const laneY = this.laneCenters[t.lane];
      if (t.type === 'spikes' && Math.abs(laneY - r.y) < 26 && t.x - r.x < 105) {
        dangerSpike = t;
      } else if (t.type !== 'spikes') {
        const d = (t.x - r.x) + Math.abs(laneY - r.y) * 1.2 - (t.type === 'gold_idol' ? 90 : 0);
        if (d < bestRelicDist) {
          bestRelicDist = d;
          bestRelic = t;
        }
      }
    }

    const targetY = bestRelic ? this.laneCenters[bestRelic.lane] : this.laneCenters[r.botTargetLane];
    const dy = targetY - r.y;
    const throttle = Math.abs(dy) > 12 ? (dy < 0 ? 1 : -1) : 0;
    const steer = r.x < width * 0.48 ? 0.6 : r.x > width * 0.68 ? -0.4 : 0;

    if (r.isCharging) {
      if (r.chargeRatio >= r.botTargetCharge || (dangerSpike && dangerSpike.x - r.x < 52)) {
        this.input.setBotInput(botId, true, steer, throttle, false);
      } else {
        this.input.setBotInput(botId, true, steer, throttle, true);
      }
      return;
    }

    r.botReactionTimer -= dt;
    if (r.botReactionTimer > 0) return;

    r.botReactionTimer =
      difficulty === 'bot_hard'
        ? 0.09 + Math.random() * 0.04
        : difficulty === 'bot_normal'
        ? 0.2 + Math.random() * 0.04
        : 0.36 + Math.random() * 0.07;

    if (dangerSpike && !r.isJumping && r.overloadTimer <= 0) {
      if (difficulty === 'bot_easy' && Math.random() < 0.22) {
        return;
      }
      r.botTargetCharge = difficulty === 'bot_hard' ? 0.76 : 0.2;
      this.input.setBotInput(botId, true, steer, throttle, true);
      return;
    }

    this.input.setBotInput(botId, true, steer, throttle, false);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    const now = performance.now() * 0.001;

    // 1. Luxor Sandstone / Anubis Crypt / Cyber Pyramid Corridor Backdrop
    this.renderBackdrop(ctx, width, height, now);

    // 2. Corridor Traps, Turquoise Scarabs & Golden Anubis Idols
    this.renderTraps(ctx, now);

    // 3. Colossal Rolling Pharaoh Skull Boulder on left
    this.renderBoulder(ctx, height);

    // 4. Explorer Mascot Runners & Bullwhip Charge Rings
    this.renderRunners(ctx, now);

    // 5. Theme Pill (Bottom-Left)
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, now: number): void {
    if (this.theme === 'luxor') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1C1208');
      grad.addColorStop(0.5, '#3D2610');
      grad.addColorStop(1, '#1A0F05');
      ctx.fillStyle = grad;
    } else if (this.theme === 'anubis') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#090718');
      grad.addColorStop(0.5, '#1E1B4B');
      grad.addColorStop(1, '#05070E');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#060A14';
    }
    ctx.fillRect(0, 0, width, height);

    // Scrolling Hieroglyph Wall Frieze along upper wall
    const offset = this.scrollDistance % 96;
    ctx.save();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.1)';
    for (let x = -offset; x < width + 96; x += 96) {
      ctx.fillRect(x + 12, 96, 36, 34);
      // Flickering wall torch sconce
      const flicker = 0.6 + 0.4 * Math.sin(now * 10 + x);
      ctx.fillStyle =
        this.theme === 'anubis'
          ? `rgba(168, 85, 247, ${flicker})`
          : this.theme === 'cyber'
          ? `rgba(56, 189, 248, ${flicker})`
          : `rgba(249, 115, 22, ${flicker})`;
      ctx.beginPath();
      ctx.arc(x + 68, 112, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.1)';
    }

    // 3 Shared Corridor Flagstone Lanes
    for (let i = 0; i < this.laneCenters.length; i++) {
      const ly = this.laneCenters[i];
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, ly + 32);
      ctx.lineTo(width, ly + 32);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderTraps(ctx: CanvasRenderingContext2D, now: number): void {
    for (const trap of this.traps) {
      if (trap.collected) continue;
      const ly = this.laneCenters[trap.lane];

      ctx.save();
      ctx.translate(trap.x, ly);

      if (trap.type === 'spikes') {
        ctx.fillStyle = '#E2E8F0';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-16, 12);
        ctx.lineTo(-8, -14);
        ctx.lineTo(0, 12);
        ctx.lineTo(8, -14);
        ctx.lineTo(16, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (trap.type === 'scarab') {
        const bob = Math.sin(now * 5 + trap.id) * 3;
        ctx.translate(0, -10 + bob);
        ctx.fillStyle = '#2DD4BF';
        ctx.shadowColor = '#2DD4BF';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        const bob = Math.sin(now * 5 + trap.id) * 3.5;
        ctx.translate(0, -12 + bob);
        ctx.fillStyle = '#FACC15';
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350F';
        ctx.font = '900 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♛', 0, 4);
      }

      ctx.restore();
    }
  }

  private renderBoulder(ctx: CanvasRenderingContext2D, _height: number): void {
    const cy = this.laneCenters[1];
    const r = 64;

    ctx.save();
    ctx.translate(this.boulderX, cy);
    ctx.rotate((this.scrollDistance / 38) % (Math.PI * 2));

    const grad = ctx.createRadialGradient(-14, -14, 8, 0, 0, r);
    grad.addColorStop(0, '#94A3B8');
    grad.addColorStop(0.65, '#475569');
    grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Carved Hieroglyph Grooves on Boulder
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private renderRunners(ctx: CanvasRenderingContext2D, now: number): void {
    for (const p of this.getActivePlayers()) {
      const r = this.runners.get(p.id);
      if (!r) continue;

      // Ground shadow under jumping runner
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.beginPath();
      ctx.ellipse(r.x, r.y + 12, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const drawY = r.y + r.yOffset;
      ctx.save();
      ctx.translate(r.x, drawY);

      if (r.isUnderdog) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (r.isCharging) {
        const rad = r.radius + 9;
        const isSweet = r.chargeRatio >= 0.72 && r.chargeRatio <= 0.98;
        ctx.strokeStyle = isSweet ? '#22C55E' : '#FACC15';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, rad, -Math.PI / 2, -Math.PI / 2 + r.chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      const mood =
        r.stumbleTimer > 0 || r.overloadTimer > 0
          ? 'shocked'
          : r.isWhipVault || r.combo >= 2
          ? 'triumph'
          : 'focused';
      this.drawPlayerMascot(ctx, p.id, 0, 0, r.radius, mood, now);

      ctx.restore();

      // Score & Combo Label
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      const comboTxt = r.combo >= 2 ? ` (${r.combo}x)` : '';
      ctx.fillText(`${r.score} pts${comboTxt}`, r.x, drawY - r.radius - 11);
      ctx.restore();
    }
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number): void {
    const pillW = 170;
    const pillH = 32;
    const pillX = 20;
    const pillY = height - 44;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = '800 10.5px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.theme === 'luxor' ? '#F59E0B' : this.theme === 'anubis' ? '#A855F7' : '#38BDF8';
    ctx.fillText(`THEME: ${this.theme.toUpperCase()} [T]`, pillX + pillW / 2, pillY + 20);
    ctx.restore();
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.runners.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.runners.entries())
      .map(([playerId, r]) => ({ playerId, score: r.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Pharaoh Tomb Raider!';
    if (winnerId !== null) {
      const r = this.runners.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} snatched ${r?.idolsSnatched || 0} relics & landed ${r?.shuntsLanded || 0} whip shunts!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
