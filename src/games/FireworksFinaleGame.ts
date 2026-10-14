import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type FireworksTheme = 'harbor' | 'festival' | 'cyber';

interface SkyTargetRing {
  id: number;
  x: number;
  y: number;
  vx: number;
  radius: number;
  multiplier: number;
  label: string;
  color: string;
  pulsePhase: number;
}

interface FireworkRocket {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  apexY: number;
  ownerId: PlayerId;
  color: string;
  isSuperShell: boolean;
  detonated: boolean;
}

interface BargeSparkPickup {
  id: number;
  x: number;
  y: number;
  points: number;
  collected: boolean;
}

interface PyroPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  aimAngle: number; // -0.55 to 0.55 rad from vertical
  radius: number;
  isCharging: boolean;
  chargeRatio: number;
  overloadTimer: number;
  stunTimer: number;
  autoShellTimer: number;
  score: number;
  combo: number;
  apexBursts: number;
  shuntsLanded: number;
  isUnderdog: boolean;
  botReactionTimer: number;
  botTargetCharge: number;
}

export class FireworksFinaleGame extends BaseGame {
  public theme: FireworksTheme = 'harbor';
  private skyRings: SkyTargetRing[] = [];
  private rockets: FireworkRocket[] = [];
  private pickups: BargeSparkPickup[] = [];
  private playersState: Map<PlayerId, PyroPlayer> = new Map();
  private entityCounter: number = 0;
  private pickupSpawnTimer: number = 2.0;
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
        if (e.key === '1') this.switchTheme('harbor', this.lastWidth, this.lastHeight);
        else if (e.key === '2') this.switchTheme('festival', this.lastWidth, this.lastHeight);
        else if (e.key === '3') this.switchTheme('cyber', this.lastWidth, this.lastHeight);
        else if (e.key === 't' || e.key === 'T') {
          const order: FireworksTheme[] = ['harbor', 'festival', 'cyber'];
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
          const order: FireworksTheme[] = ['harbor', 'festival', 'cyber'];
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

  public switchTheme(theme: FireworksTheme, width: number, height: number): void {
    this.theme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `THEME: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'harbor' ? '#F59E0B' : theme === 'festival' ? '#F43F5E' : '#38BDF8',
      22
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.rockets = [];
    this.pickups = [];
    this.playersState.clear();
    this.entityCounter = 0;
    this.pickupSpawnTimer = 1.8;
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.suddenDeathTriggered = false;

    this.skyRings = [
      {
        id: 1,
        x: width * 0.24,
        y: 165,
        vx: 48,
        radius: 34,
        multiplier: 1.5,
        label: '1.5x STAR',
        color: '#38BDF8',
        pulsePhase: 0
      },
      {
        id: 2,
        x: width * 0.5,
        y: 132,
        vx: -62,
        radius: 38,
        multiplier: 2.5,
        label: '♛ 2.5x FINALE',
        color: '#FACC15',
        pulsePhase: 1.5
      },
      {
        id: 3,
        x: width * 0.76,
        y: 175,
        vx: 52,
        radius: 34,
        multiplier: 1.8,
        label: '1.8x WILLOW',
        color: '#EC4899',
        pulsePhase: 3.1
      }
    ];

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    const deckY = height - 66;

    active.forEach((p, idx) => {
      const startX = (width / (count + 1)) * (idx + 1);
      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: deckY,
        vx: 0,
        aimAngle: 0,
        radius: 15,
        isCharging: false,
        chargeRatio: 0,
        overloadTimer: 0,
        stunTimer: 0,
        autoShellTimer: 0.4 + idx * 0.15,
        score: 0,
        combo: 0,
        apexBursts: 0,
        shuntsLanded: 0,
        isUnderdog: false,
        botReactionTimer: 0.14 + idx * 0.05,
        botTargetCharge: 0.84
      });
    });
  }

  private spawnRocket(ps: PyroPlayer, color: string, isSuperShell: boolean): void {
    const speed = isSuperShell ? 470 : 380;
    const vx = Math.sin(ps.aimAngle) * speed * 0.42;
    const vy = -Math.cos(ps.aimAngle) * speed;
    this.rockets.push({
      id: ++this.entityCounter,
      x: ps.x,
      y: ps.y - 26,
      vx,
      vy,
      apexY: isSuperShell ? 135 : 155 + Math.random() * 45,
      ownerId: ps.id,
      color,
      isSuperShell,
      detonated: false
    });
    this.audio.playWhoosh();
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
        '⚡ GRAND FINALE OVERDRIVE: 2X SKY BURSTS! ⚡',
        width / 2,
        100,
        '#FACC15',
        21
      );
    }

    // Compute Underdog Surge (>= 350 pts behind leader)
    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.isUnderdog = maxScore - ps.score >= 350;
    }

    // Drift Sky Target Rings across upper sky
    for (const ring of this.skyRings) {
      ring.x += ring.vx * (this.suddenDeathTriggered ? 1.35 : 1.0) * dt;
      if (ring.x < 90) {
        ring.x = 90;
        ring.vx = Math.abs(ring.vx);
      } else if (ring.x > width - 90) {
        ring.x = width - 90;
        ring.vx = -Math.abs(ring.vx);
      }
    }

    // Spawn Golden Roman Candle Pickups on Barge Deck
    this.pickupSpawnTimer -= dt;
    if (this.pickupSpawnTimer <= 0 && this.pickups.filter((p) => !p.collected).length < 4) {
      this.pickupSpawnTimer = 2.4;
      this.pickups.push({
        id: ++this.entityCounter,
        x: 75 + Math.random() * (width - 150),
        y: height - 66,
        points: 75,
        collected: false
      });
    }

    this.updateBots(dt, width, height);

    // Update ascending Rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      if (r.detonated) {
        this.rockets.splice(i, 1);
        continue;
      }

      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vy += 170 * dt; // Gravity slowing ascent

      if (Math.random() < 0.45) {
        this.particles.emit(r.x, r.y + 10, 2, r.isSuperShell ? '#FACC15' : r.color);
      }

      // Super Shells auto-detonate right at Apex or inside a Sky Target Ring for guaranteed spectacle!
      if (r.isSuperShell) {
        const hitRing = this.skyRings.find((sr) => Math.hypot(r.x - sr.x, r.y - sr.y) <= sr.radius + 12);
        if (hitRing || r.y <= r.apexY || r.vy >= -15) {
          const owner = this.playersState.get(r.ownerId);
          if (owner) {
            this.detonateRocket(r, owner, true);
          }
          this.rockets.splice(i, 1);
          continue;
        }
      }

      // Remove dud if it falls back down without being detonated
      if (r.vy > 95) {
        this.rockets.splice(i, 1);
      }
    }

    const activePlayers = this.getActivePlayers();
    for (const p of activePlayers) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.overloadTimer > 0) ps.overloadTimer = Math.max(0, ps.overloadTimer - dt);
      if (ps.stunTimer > 0) ps.stunTimer = Math.max(0, ps.stunTimer - dt);

      // Auto-launch standard shells periodically so players can also tap to detonate in mid-air
      ps.autoShellTimer -= dt;
      if (ps.autoShellTimer <= 0) {
        ps.autoShellTimer = this.suddenDeathTriggered ? 1.05 : 1.45;
        const activeOwn = this.rockets.filter((rk) => rk.ownerId === p.id && !rk.detonated).length;
        if (activeOwn < 2) {
          this.spawnRocket(ps, p.color, false);
        }
      }

      const steer = this.input.getSteer(p.id);
      const holdingAction = this.input.isActionPressed(p.id);

      const moveSpeed = (ps.isUnderdog ? 275 : 230) * (ps.isCharging ? 0.72 : 1.0);
      if (ps.stunTimer <= 0) {
        ps.vx += (steer * moveSpeed - ps.vx) * Math.min(1, dt * 11);
        ps.aimAngle = steer * 0.32;
      } else {
        ps.vx *= Math.pow(0.1, dt);
      }

      ps.x += ps.vx * dt;
      ps.x = Math.max(52, Math.min(width - 52, ps.x));

      // Hold-to-Charge Mortar Launch & Mid-Air Apex Detonation (72%-98% Sweet Spot)
      if (ps.overloadTimer <= 0 && ps.stunTimer <= 0) {
        if (holdingAction) {
          ps.isCharging = true;
          ps.chargeRatio += dt * 1.22 * (ps.isUnderdog ? 1.3 : 1.0);
          if (ps.chargeRatio >= 1.0) {
            ps.chargeRatio = 0;
            ps.isCharging = false;
            ps.overloadTimer = 0.55;
            this.audio.playStun();
            this.particles.showFloatingText('MORTAR BACKFIRE!', ps.x, ps.y - 34, '#F97316', 16);
          }
        } else if (ps.isCharging) {
          const ratio = ps.chargeRatio;
          ps.isCharging = false;
          ps.chargeRatio = 0;

          const isSweet = ratio >= 0.72 && ratio <= 0.98;
          if (isSweet) {
            // Launch a Super Chrysanthemum Shell AND detonate any active rocket in flight!
            this.spawnRocket(ps, p.color, true);
            this.triggerBargeShockwave(ps);
            const activeRocket = this.rockets.find((rk) => rk.ownerId === p.id && !rk.detonated && !rk.isSuperShell);
            if (activeRocket) {
              this.detonateRocket(activeRocket, ps, true);
            }
          } else {
            // Quick tap or early release: detonate nearest ascending rocket in sky!
            const activeRocket = this.rockets.find((rk) => rk.ownerId === p.id && !rk.detonated);
            if (activeRocket) {
              this.detonateRocket(activeRocket, ps, false);
            } else {
              this.spawnRocket(ps, p.color, false);
            }
          }
        }
      }

      // Collect Roman Candle Pickups on Barge Deck
      for (const pk of this.pickups) {
        if (!pk.collected && Math.abs(ps.x - pk.x) < ps.radius + 16) {
          pk.collected = true;
          ps.score += pk.points;
          this.audio.playCoin();
          this.particles.spawnConfetti(pk.x, pk.y - 12, 10);
          this.particles.showFloatingText(`+${pk.points} SHELL!`, pk.x, pk.y - 24, '#FACC15', 17);
          this.spawnRocket(ps, p.color, true);
        }
      }
    }

    // Player-to-Player Elastic Barge Collisions (m1*v1 + m2*v2)
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const p1 = this.playersState.get(activePlayers[i].id);
        const p2 = this.playersState.get(activePlayers[j].id);
        if (!p1 || !p2) continue;

        const dx = p2.x - p1.x;
        const minDist = p1.radius + p2.radius + 6;
        if (Math.abs(dx) < minDist) {
          const sign = dx >= 0 ? 1 : -1;
          const overlap = (minDist - Math.abs(dx)) * 0.5;
          p1.x -= sign * overlap;
          p2.x += sign * overlap;

          const vDiff = p1.vx - p2.vx;
          p1.vx -= vDiff * 0.65 + sign * 75;
          p2.vx += vDiff * 0.65 + sign * 75;
          this.audio.playBounce();
        }
      }
    }

    this.pickups = this.pickups.filter((pk) => !pk.collected);
  }

  private detonateRocket(r: FireworkRocket, ps: PyroPlayer, forcePerfect: boolean): void {
    r.detonated = true;

    // Check if burst is inside any Sky Target Ring
    let ringMult = 1.0;
    for (const sr of this.skyRings) {
      if (Math.hypot(r.x - sr.x, r.y - sr.y) <= sr.radius + 26) {
        ringMult = Math.max(ringMult, sr.multiplier);
      }
    }

    const apexDiff = Math.abs(r.y - r.apexY);
    const isApex = forcePerfect || apexDiff <= 38 || ringMult > 1.0;
    const sdMult = this.suddenDeathTriggered ? 1.5 : 1.0;
    const underdogMult = ps.isUnderdog ? 1.25 : 1.0;

    if (isApex) {
      ps.combo += 1;
      ps.apexBursts += 1;
      const basePts = r.isSuperShell ? 160 : 110;
      const pts = Math.round((basePts + ps.combo * 15) * ringMult * sdMult * underdogMult);
      ps.score += pts;

      this.audio.playExplosion();
      this.audio.playChime();
      this.particles.spawnConfetti(r.x, r.y, r.isSuperShell ? 28 : 18);
      this.particles.spawnExplosion(r.x, r.y, r.color, 22);
      this.particles.showFloatingText(
        ringMult > 1.0 ? `🎆 ${ringMult}x RING BURST! +${pts}` : `🎇 APEX STARBURST! +${pts}`,
        r.x,
        r.y - 14,
        '#FACC15',
        19
      );

      // Hijack rival rockets caught within 65px of this detonation!
      for (const otherR of this.rockets) {
        if (!otherR.detonated && otherR.ownerId !== ps.id && Math.hypot(otherR.x - r.x, otherR.y - r.y) <= 65) {
          otherR.detonated = true;
          ps.score += 85;
          ps.shuntsLanded += 1;
          this.particles.spawnExplosion(otherR.x, otherR.y, ps.isUnderdog ? '#FACC15' : r.color, 16);
          this.particles.showFloatingText('SKY HIJACK! +85', otherR.x, otherR.y - 18, '#38BDF8', 17);
        }
      }
    } else {
      ps.combo = 0;
      const pts = 45;
      ps.score += pts;
      this.audio.playExplosion();
      this.particles.spawnExplosion(r.x, r.y, r.color, 12);
      this.particles.showFloatingText(`+${pts}`, r.x, r.y - 10, r.color, 15);
    }
  }

  private triggerBargeShockwave(caster: PyroPlayer): void {
    for (const other of this.playersState.values()) {
      if (other.id === caster.id) continue;
      const dx = other.x - caster.x;
      if (Math.abs(dx) <= 105) {
        const dir = dx >= 0 ? 1 : -1;
        other.vx += dir * 280;
        other.stunTimer = 0.4;
        caster.score += 65;
        caster.shuntsLanded += 1;
        this.audio.playBounce();
        this.particles.showFloatingText('MORTAR BLAST! +65', other.x, other.y - 28, '#38BDF8', 16);
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _h: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Track Center 2.5x Finale Ring or nearest Roman Candle pickup
    let targetX = this.skyRings[1]?.x ?? width / 2;
    for (const pk of this.pickups) {
      if (!pk.collected && Math.abs(pk.x - ps.x) < 130) {
        targetX = pk.x;
        break;
      }
    }

    const dx = targetX - ps.x;
    const steer = Math.abs(dx) > 18 ? (dx > 0 ? 1 : -1) : 0;

    // If charging Super Mortar, release inside target sweet spot
    if (ps.isCharging) {
      if (ps.chargeRatio >= ps.botTargetCharge) {
        this.input.setBotInput(botId, steer !== 0, steer, 0, false);
      } else {
        this.input.setBotInput(botId, true, steer, 0, true);
      }
      return;
    }

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    ps.botReactionTimer =
      difficulty === 'bot_hard'
        ? 0.09 + Math.random() * 0.04
        : difficulty === 'bot_normal'
        ? 0.21 + Math.random() * 0.04
        : 0.38 + Math.random() * 0.07;

    // Check if an active rocket is near its apex
    const rocket = this.rockets.find((r) => r.ownerId === botId && !r.detonated);
    if (rocket) {
      const apexDiff = Math.abs(rocket.y - rocket.apexY);
      const threshold = difficulty === 'bot_hard' ? 24 : difficulty === 'bot_normal' ? 42 : 70;
      if (apexDiff <= threshold) {
        // Trigger quick detonation or sweet-spot charge
        this.detonateRocket(rocket, ps, difficulty === 'bot_hard');
        return;
      }
    }

    // Otherwise charge a Sweet-Spot Chrysanthemum Shell when aligned under a Sky Ring!
    if (Math.abs(dx) < 55 && ps.overloadTimer <= 0 && difficulty !== 'bot_easy') {
      ps.botTargetCharge =
        difficulty === 'bot_hard' ? 0.78 + Math.random() * 0.15 : 0.71 + Math.random() * 0.18;
      this.input.setBotInput(botId, true, steer, 0, true);
    } else {
      this.input.setBotInput(botId, steer !== 0, steer, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    const now = performance.now() * 0.001;

    // 1. Midnight Harbor / Kyoto Festival / Cyber Skyline Backdrop
    this.renderBackdrop(ctx, width, height, now);

    // 2. Sky Target Multiplier Rings
    this.renderSkyRings(ctx, now);

    // 3. Ascending Rockets
    this.renderRockets(ctx);

    // 4. Barge Pickups & Pyrotechnician Mascot Players
    this.renderPickups(ctx, now);
    this.renderPlayers(ctx, now);

    // 5. Theme Pill (Bottom-Left)
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, now: number): void {
    if (this.theme === 'harbor') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#020617');
      grad.addColorStop(0.65, '#0F172A');
      grad.addColorStop(1, '#1E293B');
      ctx.fillStyle = grad;
    } else if (this.theme === 'festival') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#090D16');
      grad.addColorStop(0.65, '#311042');
      grad.addColorStop(1, '#4C1D95');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#030712';
    }
    ctx.fillRect(0, 0, width, height);

    // City Skyline Silhouettes & Lit Windows
    ctx.save();
    ctx.fillStyle = this.theme === 'cyber' ? '#09152B' : '#0F172A';
    const bldgW = 48;
    for (let bx = 0; bx < width; bx += bldgW) {
      const bldgH = 55 + ((bx * 37) % 75);
      ctx.fillRect(bx, height - 48 - bldgH, bldgW - 4, bldgH);
    }

    // Harbor Barge Deck at bottom
    const deckY = height - 48;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, deckY, width, 48);
    ctx.strokeStyle = this.theme === 'cyber' ? '#38BDF8' : this.theme === 'festival' ? '#F43F5E' : '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, deckY);
    ctx.lineTo(width, deckY);
    ctx.stroke();

    // Water shimmer line
    ctx.fillStyle = `rgba(56, 189, 248, ${0.12 + 0.05 * Math.sin(now * 3)})`;
    ctx.fillRect(0, height - 16, width, 16);
    ctx.restore();
  }

  private renderSkyRings(ctx: CanvasRenderingContext2D, now: number): void {
    for (const sr of this.skyRings) {
      const pulse = 1 + 0.08 * Math.sin(now * 4 + sr.pulsePhase);
      ctx.save();
      ctx.translate(sr.x, sr.y);
      ctx.strokeStyle = sr.color;
      ctx.shadowColor = sr.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -now * 24;
      ctx.beginPath();
      ctx.arc(0, 0, sr.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = sr.color;
      ctx.font = '800 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sr.label, 0, 4);
      ctx.restore();
    }
  }

  private renderRockets(ctx: CanvasRenderingContext2D): void {
    for (const r of this.rockets) {
      // Personal Apex Target Ring
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.apexY, 20, 0, Math.PI * 2);
      ctx.stroke();

      ctx.translate(r.x, r.y);
      ctx.fillStyle = r.isSuperShell ? '#FACC15' : r.color;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = r.isSuperShell ? 14 : 6;
      ctx.beginPath();
      ctx.roundRect(-5, -13, 10, 24, 3);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-5, -13);
      ctx.lineTo(5, -13);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.moveTo(-3.5, 11);
      ctx.lineTo(0, 21);
      ctx.lineTo(3.5, 11);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderPickups(ctx: CanvasRenderingContext2D, now: number): void {
    for (const pk of this.pickups) {
      if (pk.collected) continue;
      ctx.save();
      ctx.translate(pk.x, pk.y - 6 + Math.sin(now * 5 + pk.id) * 3);
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350F';
      ctx.font = '900 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, 3.5);
      ctx.restore();
    }
  }

  private renderPlayers(ctx: CanvasRenderingContext2D, now: number): void {
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      if (ps.isUnderdog) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, ps.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (ps.isCharging) {
        const r = ps.radius + 9;
        const isSweet = ps.chargeRatio >= 0.72 && ps.chargeRatio <= 0.98;
        ctx.strokeStyle = isSweet ? '#22C55E' : '#FACC15';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + ps.chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      // 2.5D Mobile Mortar Tube behind Mascot
      ctx.save();
      ctx.rotate(ps.aimAngle);
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(-9, -32, 18, 24, 4);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      const mood =
        ps.stunTimer > 0 || ps.overloadTimer > 0
          ? 'shocked'
          : ps.combo >= 2 || ps.isCharging
          ? 'triumph'
          : 'focused';
      this.drawPlayerMascot(ctx, p.id, 0, 0, ps.radius, mood, now);

      ctx.restore();

      // Score & Combo Label
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      const comboTxt = ps.combo >= 2 ? ` (${ps.combo}x)` : '';
      ctx.fillText(`${ps.score} pts${comboTxt}`, ps.x, ps.y - 38);
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
    ctx.fillStyle = this.theme === 'harbor' ? '#F59E0B' : this.theme === 'festival' ? '#F43F5E' : '#38BDF8';
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

    let mvpHighlight = 'Grand Finale Pyrotechnician!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} detonated ${ps?.apexBursts || 0} apex starbursts & ${ps?.shuntsLanded || 0} sky hijacks!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
