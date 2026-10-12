import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface GardenBat {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface FireflyPlayer {
  id: PlayerId;
  x: number;
  y: number;
  glowProgress: number; // 0 to 1
  isGlowing: boolean;
  streak: number;
  stunTimer: number;
  score: number;
}

export class FireflyNightBeaconGame extends BaseGame {
  private playersState: Map<PlayerId, FireflyPlayer> = new Map();
  private bats: GardenBat[] = [];
  private beaconPulseTimer: number = 0;
  private beaconGlowing: boolean = false;
  private beaconGlowVal: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.beaconPulseTimer = 1.0;
    this.beaconGlowing = false;
    this.beaconGlowVal = 0;
    this.bats = [];
    this.playersState.clear();

    // 1 swooping night bat
    this.bats.push({ x: width * 0.2, y: height * 0.3, vx: 120, vy: 60 });

    const active = this.getActivePlayers();
    const count = active.length;
    const cx = width / 2;
    const cy = height * 0.52;

    active.forEach((p, idx) => {
      const a = (idx / count) * Math.PI * 2;
      this.playersState.set(p.id, {
        id: p.id,
        x: cx + Math.cos(a) * 90,
        y: cy + Math.sin(a) * 90,
        glowProgress: 0,
        isGlowing: false,
        streak: 0,
        stunTimer: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Beacon rhythmic pulsing
    this.beaconPulseTimer -= dt;
    if (this.beaconPulseTimer <= 0) {
      if (!this.beaconGlowing) {
        this.beaconGlowing = true;
        this.beaconPulseTimer = 0.8; // beacon glow window
        this.beaconGlowVal = 1.0;
        this.audio.playTone(440, 0.15);
      } else {
        this.beaconGlowing = false;
        this.beaconPulseTimer = 1.6 + Math.random() * 0.8;
        this.beaconGlowVal = 0;
      }
    }

    if (this.beaconGlowVal > 0 && !this.beaconGlowing) {
      this.beaconGlowVal = Math.max(0, this.beaconGlowVal - dt * 2);
    }

    // Update Bats
    for (const b of this.bats) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 40 || b.x > width - 40) b.vx *= -1;
      if (b.y < 50 || b.y > height - 60) b.vy *= -1;
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const mag = Math.hypot(steerX, steerY);

      if (mag > 0.2) {
        const speed = 190;
        ps.x += (steerX / mag) * speed * dt;
        ps.y += (steerY / mag) * speed * dt;
      }

      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(50, Math.min(height - 40, ps.y));

      // Tap to flash bioluminescent lantern
      const tap = this.input.justPressed(p.id);
      const isHolding = this.input.isPressed(p.id);

      if (tap || isHolding) {
        ps.isGlowing = true;
        ps.glowProgress = Math.min(1.0, ps.glowProgress + dt * 4);

        if (tap) {
          if (this.beaconGlowing) {
            // Synchronized Flash Match!
            ps.streak++;
            const pts = 25 * Math.min(4, ps.streak);
            ps.score += pts;
            this.audio.playScore();
            this.particles.showFloatingText(`SYNC x${ps.streak}! +${pts}`, ps.x, ps.y - 20, '#FBBF24', 20);
            this.particles.spawnConfetti(ps.x, ps.y, 8);
          } else {
            // Out of sync flash
            ps.streak = 0;
          }
        }
      } else {
        ps.isGlowing = false;
        ps.glowProgress = Math.max(0, ps.glowProgress - dt * 3);
      }

      // Check bat strike if glowing
      if (ps.isGlowing && ps.glowProgress > 0.3) {
        for (const b of this.bats) {
          if (Math.hypot(ps.x - b.x, ps.y - b.y) < 32) {
            ps.stunTimer = 1.2;
            ps.isGlowing = false;
            ps.glowProgress = 0;
            ps.streak = 0;
            ps.score = Math.max(0, ps.score - 15);
            this.audio.playStun();
            this.particles.showFloatingText('BAT SWOOP! -15', ps.x, ps.y - 24, '#EF4444', 22);
            this.particles.spawnExplosion(ps.x, ps.y, '#A855F7', 10);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Midnight Summer Meadow Dark Sky
    const cx = width / 2;
    const cy = height * 0.52;

    const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, width * 0.7);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.6, '#090D16');
    bgGrad.addColorStop(1, '#020408');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Glowing Wildflower Grass Stalks at Bottom
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.lineWidth = 1.5;
    for (let x = 10; x < width; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x + Math.sin(x * 0.3) * 12, height - 35);
      ctx.stroke();
    }

    // 2. Central Mother Beacon Firefly Flower
    ctx.save();
    ctx.translate(cx, cy);

    // Huge pulsating bioluminescent bloom
    const glowRad = 24 + this.beaconGlowVal * 28;
    const bloomGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, glowRad);
    bloomGrad.addColorStop(0, '#FFFFFF');
    bloomGrad.addColorStop(0.3, '#FEF08A');
    bloomGrad.addColorStop(0.7, this.beaconGlowing ? '#FBBF24' : 'rgba(251, 191, 36, 0.2)');
    bloomGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = bloomGrad;
    ctx.beginPath();
    ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
    ctx.fill();

    // Beacon Core
    ctx.fillStyle = this.beaconGlowing ? '#FBBF24' : '#78350F';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 8px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BEACON', 0, 3);
    ctx.restore();

    // 3. Draw Night Bats
    for (const b of this.bats) {
      ctx.save();
      ctx.translate(b.x, b.y);
      // Bat wings
      ctx.fillStyle = '#A855F7';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-14, -14, -22, -4);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(14, -14, 22, -4);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();

      // Bat body
      ctx.fillStyle = '#1E1B4B';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Fireflies
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Bioluminescent glow radius
      if (ps.glowProgress > 0) {
        const pGlow = 14 + ps.glowProgress * 22;
        const pGrad = ctx.createRadialGradient(0, 6, 2, 0, 6, pGlow);
        pGrad.addColorStop(0, '#FFFFFF');
        pGrad.addColorStop(0.4, p.color);
        pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(0, 6, pGlow, 0, Math.PI * 2);
        ctx.fill();
      }

      // Firefly Body
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.ellipse(0, -2, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Lantern Abdomen
      ctx.fillStyle = ps.glowProgress > 0.2 ? '#FEF08A' : p.color;
      ctx.beginPath();
      ctx.arc(0, 6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // Score & Streak
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const streakStr = ps.streak > 1 ? ` (x${ps.streak})` : '';
      ctx.fillText(`${p.name}: ${ps.score}${streakStr}`, ps.x, ps.y - 20);
    }

    // 5. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    // Check nearby bats: if bat within 70px, turn off light!
    const nearBat = this.bats.find((b) => Math.hypot(b.x - ps.x, b.y - ps.y) < 70);
    if (nearBat && difficulty !== 'bot_easy') {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Synchronize flash when beacon is glowing
    if (this.beaconGlowing) {
      const chance = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.75 : 0.45;
      if (Math.random() < chance) {
        this.input.setBotInput(botId, true, 0, 0, true);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} illuminated the midnight meadow in perfect firefly harmony!` : 'Tied firefly beacon!'
    };
  }
}
