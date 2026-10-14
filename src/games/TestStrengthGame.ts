import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type StrengthTheme = 'fairground' | 'forge' | 'arcade';

interface StrikerTower {
  id: number;
  x: number;
  baseY: number;
  topY: number;
  multiplier: number;
  label: string;
  accentColor: string;
  puckHeight: number; // 0 to 1
  puckVelocity: number;
  bellRingTimer: number;
  lastHitter: PlayerId | null;
}

interface BellStar {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  points: number;
  collected: boolean;
}

interface StrongmanPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  radius: number;
  isCharging: boolean;
  chargeRatio: number;
  swingAnimTimer: number;
  overloadTimer: number;
  stunTimer: number;
  score: number;
  bellsRung: number;
  shuntsLanded: number;
  isUnderdog: boolean;
  botReactionTimer: number;
  botTargetTower: number;
  botTargetCharge: number;
}

export class TestStrengthGame extends BaseGame {
  public theme: StrengthTheme = 'fairground';
  private towers: StrikerTower[] = [];
  private playersState: Map<PlayerId, StrongmanPlayer> = new Map();
  private stars: BellStar[] = [];
  private starCounter: number = 0;
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
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.reset(width, height);

    if (typeof window !== 'undefined') {
      this.keydownListener = (e: KeyboardEvent) => {
        if (e.key === '1') this.switchTheme('fairground', this.lastWidth, this.lastHeight);
        else if (e.key === '2') this.switchTheme('forge', this.lastWidth, this.lastHeight);
        else if (e.key === '3') this.switchTheme('arcade', this.lastWidth, this.lastHeight);
        else if (e.key === 't' || e.key === 'T') {
          const order: StrengthTheme[] = ['fairground', 'forge', 'arcade'];
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
          const order: StrengthTheme[] = ['fairground', 'forge', 'arcade'];
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

  public switchTheme(theme: StrengthTheme, width: number, height: number): void {
    this.theme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `THEME: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'fairground' ? '#F59E0B' : theme === 'forge' ? '#EF4444' : '#38BDF8',
      22
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.suddenDeathTriggered = false;
    this.playersState.clear();
    this.stars = [];
    this.starCounter = 0;

    const topY = 128;
    const baseY = height - 112;

    this.towers = [
      {
        id: 0,
        x: width * 0.23,
        baseY,
        topY,
        multiplier: 1.15,
        label: 'IRON ANVIL (1.15x)',
        accentColor: '#38BDF8',
        puckHeight: 0,
        puckVelocity: 0,
        bellRingTimer: 0,
        lastHitter: null
      },
      {
        id: 1,
        x: width * 0.5,
        baseY,
        topY,
        multiplier: 1.65,
        label: '♛ GOLDEN TITAN (1.65x)',
        accentColor: '#F59E0B',
        puckHeight: 0,
        puckVelocity: 0,
        bellRingTimer: 0,
        lastHitter: null
      },
      {
        id: 2,
        x: width * 0.77,
        baseY,
        topY,
        multiplier: 1.25,
        label: 'TURBO STRIKER (1.25x)',
        accentColor: '#EC4899',
        puckHeight: 0,
        puckVelocity: 0,
        bellRingTimer: 0,
        lastHitter: null
      }
    ];

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const startX = (width / (count + 1)) * (idx + 1);
      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: baseY + 26,
        vx: 0,
        vy: 0,
        facing: idx % 2 === 0 ? 1 : -1,
        radius: 16,
        isCharging: false,
        chargeRatio: 0,
        swingAnimTimer: 0,
        overloadTimer: 0,
        stunTimer: 0,
        score: 0,
        bellsRung: 0,
        shuntsLanded: 0,
        isUnderdog: false,
        botReactionTimer: 0.14 + idx * 0.06,
        botTargetTower: idx % 3,
        botTargetCharge: 0.84
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
        '⚡ SUDDEN DEATH: 2X BELL JACKPOTS & STAR SHOWER! ⚡',
        width / 2,
        100,
        '#FACC15',
        21
      );
      for (const t of this.towers) {
        this.spawnBellStars(t.x, t.topY, 2);
      }
    }

    // Compute Underdog Surge (>= 400 pts behind leader)
    let maxScore = 0;
    for (const s of this.playersState.values()) {
      if (s.score > maxScore) maxScore = s.score;
    }
    for (const s of this.playersState.values()) {
      s.isUnderdog = maxScore - s.score >= 400;
    }

    this.updateBots(dt, width, height);

    // Update High-Striker Tower Pucks & Bells
    for (const tower of this.towers) {
      if (tower.bellRingTimer > 0) {
        tower.bellRingTimer = Math.max(0, tower.bellRingTimer - dt);
      }
      if (tower.puckVelocity !== 0 || tower.puckHeight > 0) {
        tower.puckHeight += tower.puckVelocity * dt;
        tower.puckVelocity -= 3.6 * dt; // Gravity on heavy brass puck

        if (tower.puckHeight >= 1.0) {
          tower.puckHeight = 1.0;
          tower.puckVelocity = -0.65;
          if (tower.bellRingTimer <= 0) {
            tower.bellRingTimer = 0.9;
            this.audio.playChime();
            this.audio.playFanfare();
            this.particles.spawnConfetti(tower.x, tower.topY - 12, 24);
            this.spawnBellStars(tower.x, tower.topY, 2);
          }
        }

        if (tower.puckHeight <= 0) {
          tower.puckHeight = 0;
          tower.puckVelocity = 0;
        }
      }
    }

    // Update Falling Bell Stars
    const floorY = height - 86;
    for (const st of this.stars) {
      if (st.collected) continue;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      st.vy += 380 * dt;
      if (st.y > floorY) {
        st.y = floorY;
        st.vy *= -0.55;
        st.vx *= 0.85;
      }
      st.x = Math.max(40, Math.min(width - 40, st.x));
    }

    const activePlayers = this.getActivePlayers();
    for (const p of activePlayers) {
      const s = this.playersState.get(p.id);
      if (!s) continue;

      if (s.swingAnimTimer > 0) s.swingAnimTimer = Math.max(0, s.swingAnimTimer - dt);
      if (s.overloadTimer > 0) s.overloadTimer = Math.max(0, s.overloadTimer - dt);
      if (s.stunTimer > 0) s.stunTimer = Math.max(0, s.stunTimer - dt);

      const steer = this.input.getSteer(p.id);
      const throttle = -this.input.getThrottle(p.id);
      const holdingAction = this.input.isActionPressed(p.id);

      if (Math.abs(steer) > 0.15) {
        s.facing = steer > 0 ? 1 : -1;
      }

      // Hold-to-Charge Sledgehammer Slam (72%-98% Sweet Spot)
      if (s.overloadTimer <= 0 && s.stunTimer <= 0 && s.swingAnimTimer <= 0) {
        if (holdingAction) {
          s.isCharging = true;
          s.chargeRatio += dt * 1.18 * (s.isUnderdog ? 1.3 : 1.0);
          if (s.chargeRatio >= 1.0) {
            s.chargeRatio = 0;
            s.isCharging = false;
            s.overloadTimer = 0.55;
            this.audio.playStun();
            this.particles.showFloatingText('RECOIL OVERLOAD!', s.x, s.y - 28, '#F97316', 16);
          }
        } else if (s.isCharging) {
          const ratio = s.chargeRatio;
          s.isCharging = false;
          s.chargeRatio = 0;
          s.swingAnimTimer = 0.36;
          this.executeHammerSlam(s, ratio);
        }
      }

      const moveSpeed = (s.isUnderdog ? 275 : 230) * (s.isCharging ? 0.65 : 1.0);
      if (s.stunTimer <= 0) {
        s.vx += (steer * moveSpeed - s.vx) * Math.min(1, dt * 11);
        s.vy += (throttle * moveSpeed * 0.6 - s.vy) * Math.min(1, dt * 11);
      } else {
        s.vx *= Math.pow(0.1, dt);
        s.vy *= Math.pow(0.1, dt);
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Keep on the Carnival Strongman Stage
      s.x = Math.max(46, Math.min(width - 46, s.x));
      s.y = Math.max(height - 140, Math.min(height - 62, s.y));

      // Collect Bell Stars on stage
      for (const st of this.stars) {
        if (!st.collected && Math.hypot(s.x - st.x, s.y - st.y) < s.radius + 15) {
          st.collected = true;
          s.score += st.points;
          this.audio.playCoin();
          this.particles.spawnConfetti(st.x, st.y, 10);
          this.particles.showFloatingText(`+${st.points} STAR!`, st.x, st.y - 16, '#FACC15', 18);
        }
      }
    }

    // Player-to-Player Elastic Stage Collisions (m1*v1 + m2*v2)
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const p1 = this.playersState.get(activePlayers[i].id);
        const p2 = this.playersState.get(activePlayers[j].id);
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
          p1.vx -= pImp * nx - nx * 55;
          p1.vy -= pImp * ny;
          p2.vx += pImp * nx + nx * 55;
          p2.vy += pImp * ny;
          this.audio.playBounce();
        }
      }
    }
  }

  private spawnBellStars(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.stars.push({
        id: ++this.starCounter,
        x,
        y: y + 10,
        vx: (i === 0 ? -1 : 1) * (65 + Math.random() * 85),
        vy: -120 - Math.random() * 60,
        points: this.suddenDeathTriggered ? 160 : 110,
        collected: false
      });
    }
  }

  private executeHammerSlam(s: StrongmanPlayer, ratio: number): void {
    const isSweetSpot = ratio >= 0.72 && ratio <= 0.98;
    this.audio.playExplosion();
    this.particles.shake(isSweetSpot ? 0.32 : 0.16);
    this.particles.spawnSparks(s.x + s.facing * 18, s.y + 4, '#FACC15', isSweetSpot ? 18 : 8);

    // 1. Check if striking one of the 3 High-Striker Anvil Pads
    let bestTower: StrikerTower | null = null;
    let minTowerDist = 66;
    for (const t of this.towers) {
      const d = Math.hypot(s.x - t.x, s.y - (t.baseY + 18));
      if (d < minTowerDist) {
        minTowerDist = d;
        bestTower = t;
      }
    }

    if (bestTower) {
      const sdMult = this.suddenDeathTriggered ? 1.5 : 1.0;
      const underdogMult = s.isUnderdog ? 1.25 : 1.0;
      const launchVel = isSweetSpot ? 2.95 : Math.max(0.9, ratio * 2.45);
      bestTower.puckVelocity = Math.max(bestTower.puckVelocity, launchVel);
      bestTower.lastHitter = s.id;

      if (isSweetSpot) {
        const bellPts = Math.round(320 * bestTower.multiplier * sdMult * underdogMult);
        s.score += bellPts;
        s.bellsRung += 1;
        this.particles.showFloatingText(
          `🔔 BELL JACKPOT! +${bellPts}`,
          bestTower.x,
          bestTower.baseY - 40,
          '#22C55E',
          20
        );
      } else {
        const strikePts = Math.round(ratio * 160 * bestTower.multiplier * sdMult * underdogMult);
        s.score += strikePts;
        this.particles.showFloatingText(
          `+${strikePts} PTS`,
          bestTower.x,
          bestTower.baseY - 28,
          bestTower.accentColor,
          17
        );
      }
    }

    // 2. Seismic Anvil Shockwave Shunt against rival players nearby!
    const shockRadius = isSweetSpot ? 115 : 68;
    for (const other of this.playersState.values()) {
      if (other.id === s.id) continue;
      const dx = other.x - s.x;
      const dy = other.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d <= shockRadius) {
        const dir = dx >= 0 ? 1 : -1;
        other.vx += dir * (isSweetSpot ? 340 : 190);
        other.stunTimer = isSweetSpot ? 0.5 : 0.25;
        other.isCharging = false;
        other.chargeRatio = 0;
        const shuntPts = isSweetSpot ? 85 : 40;
        s.score += shuntPts;
        s.shuntsLanded += 1;
        this.audio.playBounce();
        this.particles.showFloatingText(
          `HAMMER SHUNT! +${shuntPts}`,
          other.x,
          other.y - 28,
          '#38BDF8',
          17
        );
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const s = this.playersState.get(botId);
    if (!s || s.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // If charging hammer, release at target charge ratio
    if (s.isCharging) {
      if (s.chargeRatio >= s.botTargetCharge) {
        this.input.setBotInput(botId, false, 0, 0, false);
      } else {
        this.input.setBotInput(botId, true, 0, 0, true);
      }
      return;
    }

    s.botReactionTimer -= dt;
    if (s.botReactionTimer > 0) return;

    s.botReactionTimer =
      difficulty === 'bot_hard'
        ? 0.09 + Math.random() * 0.04
        : difficulty === 'bot_normal'
        ? 0.21 + Math.random() * 0.04
        : 0.38 + Math.random() * 0.07;

    // 1. Check if a nearby Bell Star is on the floor
    for (const st of this.stars) {
      if (!st.collected && Math.abs(st.x - s.x) < 120 && st.y > s.y - 50) {
        const dir = st.x > s.x ? 1 : -1;
        this.input.setBotInput(botId, true, dir, 0, false);
        return;
      }
    }

    // 2. Pick target High-Striker Tower (Hard prefers Center Golden 1.65x Tower or least crowded)
    if (difficulty === 'bot_hard') {
      s.botTargetTower = 1; // Center Golden Titan
    } else if (Math.random() < 0.25) {
      s.botTargetTower = Math.floor(Math.random() * this.towers.length);
    }

    const targetTower = this.towers[s.botTargetTower] || this.towers[1];
    const dx = targetTower.x - s.x;

    if (Math.abs(dx) > 26) {
      const steer = dx > 0 ? 1 : -1;
      this.input.setBotInput(botId, true, steer, 0, false);
      return;
    }

    // At the anvil pad: begin charging Sledgehammer!
    if (s.overloadTimer <= 0 && s.swingAnimTimer <= 0) {
      s.botTargetCharge =
        difficulty === 'bot_hard'
          ? 0.78 + Math.random() * 0.16
          : difficulty === 'bot_normal'
          ? 0.71 + Math.random() * 0.18
          : 0.48 + Math.random() * 0.25;
      this.input.setBotInput(botId, true, 0, 0, true);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    const now = performance.now() * 0.001;

    // 1. Themed Carnival / Forge / Arcade Backdrop & Strongman Stage
    this.renderBackdrop(ctx, width, height, now);

    // 2. 3 Interactive 2.5D High-Striker Towers, Pucks & Brass Bells
    this.renderTowers(ctx, now);

    // 3. Falling Golden Bell Stars
    this.renderStars(ctx, now);

    // 4. Strongman Mascot Players & Sledgehammers
    this.renderPlayers(ctx, now);

    // 5. Theme Pill (Bottom-Left)
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, now: number): void {
    if (this.theme === 'fairground') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1E1B4B');
      grad.addColorStop(0.65, '#311042');
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;
    } else if (this.theme === 'forge') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#18181B');
      grad.addColorStop(0.65, '#450A0A');
      grad.addColorStop(1, '#090D16');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#060913';
    }
    ctx.fillRect(0, 0, width, height);

    // Carnival Bunting Lights at y = 92
    ctx.save();
    for (let x = 40; x < width - 20; x += 44) {
      const lit = Math.sin(now * 5 + x * 0.1) > 0;
      ctx.fillStyle = lit ? '#FDE047' : 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.arc(x, 90, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2.5D Wooden / Steel Strongman Stage Floor
    const stageY = height - 122;
    ctx.fillStyle = this.theme === 'forge' ? '#27272A' : this.theme === 'arcade' ? '#0F172A' : '#451A03';
    ctx.fillRect(0, stageY, width, height - stageY);
    ctx.strokeStyle = this.theme === 'arcade' ? '#38BDF8' : '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, stageY);
    ctx.lineTo(width, stageY);
    ctx.stroke();
    ctx.restore();
  }

  private renderTowers(ctx: CanvasRenderingContext2D, now: number): void {
    for (const t of this.towers) {
      const cx = t.x;
      const towerH = t.baseY - t.topY;

      ctx.save();

      // Tower Backboard Column with 2.5D bevel
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(cx - 22, t.topY, 44, towerH, 6);
      ctx.fill();
      ctx.strokeStyle = t.accentColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Height Graduation Hash Marks & Sweet-Spot Zone
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = 1.8;
      for (let hy = t.topY + 24; hy < t.baseY - 12; hy += 24) {
        ctx.beginPath();
        ctx.moveTo(cx - 16, hy);
        ctx.lineTo(cx - 7, hy);
        ctx.moveTo(cx + 7, hy);
        ctx.lineTo(cx + 16, hy);
        ctx.stroke();
      }

      // Chrome Center Guide Rail
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx, t.topY);
      ctx.lineTo(cx, t.baseY);
      ctx.stroke();

      // Top Brass Bell (vibrates when rung!)
      const bellShake = t.bellRingTimer > 0 ? Math.sin(now * 55) * 4 : 0;
      ctx.save();
      ctx.translate(cx + bellShake, t.topY - 12);
      ctx.fillStyle = t.bellRingTimer > 0 ? '#FEF08A' : '#F59E0B';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = t.bellRingTimer > 0 ? 22 : 8;
      ctx.beginPath();
      ctx.arc(0, 0, 20, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(-22, 0, 44, 6);
      ctx.restore();

      // Tower Label Pill above Bell
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cx - 66, t.topY - 50, 132, 18, 9);
      ctx.fill();
      ctx.fillStyle = t.accentColor;
      ctx.font = '800 9.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.label, cx, t.topY - 38);

      // Launched Heavy Metal Puck
      const puckY = t.baseY - t.puckHeight * towerH;
      ctx.fillStyle = t.accentColor;
      ctx.shadowColor = t.accentColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(cx - 15, puckY - 8, 30, 14, 4);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2.5D Anvil Strike Pad at Base
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(cx - 34, t.baseY, 68, 22, 6);
      ctx.fill();
      ctx.strokeStyle = t.accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.roundRect(cx - 22, t.baseY - 6, 44, 8, 3);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderStars(ctx: CanvasRenderingContext2D, now: number): void {
    for (const st of this.stars) {
      if (st.collected) continue;
      ctx.save();
      ctx.translate(st.x, st.y + Math.sin(now * 6 + st.id) * 2);
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 10;
      ctx.font = '900 18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, 6);
      ctx.restore();
    }
  }

  private renderPlayers(ctx: CanvasRenderingContext2D, now: number): void {
    for (const p of this.getActivePlayers()) {
      const s = this.playersState.get(p.id);
      if (!s) continue;

      ctx.save();
      ctx.translate(s.x, s.y);

      if (s.isUnderdog) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge Sledgehammer Sweet-Spot Arc (72%-98% Green Zone)
      if (s.isCharging) {
        const r = s.radius + 9;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, Math.PI * 1.5);
        ctx.stroke();

        const isSweet = s.chargeRatio >= 0.72 && s.chargeRatio <= 0.98;
        ctx.strokeStyle = isSweet ? '#22C55E' : '#F59E0B';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + s.chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      // 2.5D Player Mascot
      const mood =
        s.stunTimer > 0 || s.overloadTimer > 0
          ? 'shocked'
          : s.swingAnimTimer > 0 || s.bellsRung > 0
          ? 'triumph'
          : 'focused';
      this.drawPlayerMascot(ctx, p.id, 0, 0, s.radius, mood, now);

      // Oversized 2.5D Carnival Sledgehammer held by Mascot
      ctx.save();
      ctx.scale(s.facing, 1);
      const hammerAngle =
        s.swingAnimTimer > 0
          ? 1.15
          : s.isCharging
          ? -0.35 - s.chargeRatio * 1.15
          : 0.25;
      ctx.translate(12, 2);
      ctx.rotate(hammerAngle);

      // Wooden handle
      ctx.fillStyle = '#B45309';
      ctx.fillRect(-2.5, -32, 5, 34);
      // Heavy Steel Mallet Head
      ctx.fillStyle = s.chargeRatio >= 0.72 ? '#22C55E' : '#E2E8F0';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-11, -40, 22, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // Score Label above player
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      ctx.fillText(`${s.score} pts`, s.x, s.y - s.radius - 14);
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
    ctx.fillStyle = this.theme === 'fairground' ? '#F59E0B' : this.theme === 'forge' ? '#EF4444' : '#38BDF8';
    ctx.fillText(`THEME: ${this.theme.toUpperCase()} [T]`, pillX + pillW / 2, pillY + 20);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map((p) => ({
        playerId: p.id,
        score: this.playersState.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId =
      rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Carnival Strongman Champion!';
    if (winnerId !== null) {
      const st = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} rang ${st?.bellsRung || 0} high-striker bells & landed ${st?.shuntsLanded || 0} hammer shunts!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
