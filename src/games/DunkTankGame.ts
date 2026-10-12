import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type DunkTheme = 'pier' | 'waterpark' | 'hydrolab';

interface PlungerShot {
  id: number;
  playerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
}

interface TankPlayerState {
  id: PlayerId;
  x: number;
  y: number;
  tankX: number;
  tankY: number;
  aimAngle: number;
  hp: number; // 3 hits before drop
  maxHp: number;
  isDunked: boolean;
  dunkTimer: number;
  splashCooldown: number;
  wobbleAngle: number;
  ladderProgress: number; // 0 (submerged) to 1 (recovered)
  score: number;
  dunksInflicted: number;
  botReactionTimer: number;
}

interface WaterDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
}

export class DunkTankGame extends BaseGame {
  public dunkTheme: DunkTheme = 'pier';
  private playersState: Map<PlayerId, TankPlayerState> = new Map();
  private shots: PlungerShot[] = [];
  private waterSplashes: WaterDrop[] = [];
  private shotCounter: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

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

    if (typeof window !== 'undefined') {
      this.keydownListener = (e: KeyboardEvent) => {
        if (e.key === '1') this.switchTheme('pier', width, height);
        else if (e.key === '2') this.switchTheme('waterpark', width, height);
        else if (e.key === '3') this.switchTheme('hydrolab', width, height);
      };
      window.addEventListener('keydown', this.keydownListener);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  public switchTheme(theme: DunkTheme, width: number, height: number): void {
    this.dunkTheme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `DUNK TANK: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'pier' ? '#38BDF8' : theme === 'waterpark' ? '#34D399' : '#818CF8',
      24
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.shots = [];
    this.waterSplashes = [];
    this.shotCounter = 0;

    this.initPlayers(width, height);
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const tx = spacing * (idx + 1);
      const ty = height * 0.48; // Tank water level

      this.playersState.set(p.id, {
        id: p.id,
        x: tx,
        y: ty - 68, // Perched on the springy trapdoor
        tankX: tx,
        tankY: ty,
        aimAngle: idx < count / 2 ? 0.3 : Math.PI - 0.3,
        hp: 3,
        maxHp: 3,
        isDunked: false,
        dunkTimer: 0,
        splashCooldown: 0,
        wobbleAngle: 0,
        ladderProgress: 1,
        score: 0,
        dunksInflicted: 0,
        botReactionTimer: 0.2 + idx * 0.08
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update Water Splash Particles
    for (let i = this.waterSplashes.length - 1; i >= 0; i--) {
      const drop = this.waterSplashes[i];
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.vy += 500 * dt; // Gravity
      drop.alpha -= 1.2 * dt;
      if (drop.alpha <= 0 || drop.y > height) {
        this.waterSplashes.splice(i, 1);
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ps.splashCooldown = Math.max(0, ps.splashCooldown - dt);

      // Handle Dunk State & Ladder Recovery
      if (ps.isDunked) {
        ps.dunkTimer -= dt;
        // Mash Action button to climb back up ladder faster!
        if (this.input.justAction(p.id) || this.input.justPressed(p.id)) {
          ps.ladderProgress = Math.min(1.0, ps.ladderProgress + 0.28);
          this.audio.playSnowSplat();
        } else {
          ps.ladderProgress = Math.min(1.0, ps.ladderProgress + 0.35 * dt);
        }

        // Recovered from dunk!
        if (ps.ladderProgress >= 1.0 || ps.dunkTimer <= 0) {
          ps.isDunked = false;
          ps.hp = ps.maxHp;
          ps.ladderProgress = 1.0;
          ps.wobbleAngle = 0;
          this.particles.showFloatingText('BACK ON PERCH!', ps.x, ps.tankY - 80, '#38BDF8', 20);
        }
        continue;
      }

      // Wobble relaxation
      ps.wobbleAngle *= Math.exp(-4 * dt);

      // Aim Steering
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      if (Math.abs(steer) > 0.15 || Math.abs(throttle) > 0.15) {
        ps.aimAngle = Math.atan2(throttle, steer);
      }

      // Shoot Plunger Water Cannon
      const shoot = this.input.justAction(p.id) || (this.input.justPressed(p.id) && Math.abs(steer) < 0.2);
      if (shoot && ps.splashCooldown <= 0) {
        ps.splashCooldown = 0.35; // Rapid fire rate
        const speed = 640;
        this.shots.push({
          id: ++this.shotCounter,
          playerId: p.id,
          color: p.color,
          x: ps.x + Math.cos(ps.aimAngle) * 32,
          y: ps.y + Math.sin(ps.aimAngle) * 32,
          vx: Math.cos(ps.aimAngle) * speed,
          vy: Math.sin(ps.aimAngle) * speed,
          radius: 9,
          alive: true
        });
        this.audio.playWhoosh();
      }
    }

    // Update Plunger Shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      if (!shot.alive) {
        this.shots.splice(i, 1);
        continue;
      }

      shot.vy += 120 * dt; // Slight parabolic drop
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;

      // Check collision against opponent target bullseyes
      let hit = false;
      for (const p of this.getActivePlayers()) {
        if (p.id === shot.playerId) continue; // No self hit

        const ps = this.playersState.get(p.id);
        if (!ps || ps.isDunked) continue;

        // Bullseye target arm position (protruding right next to the perch)
        const targetArmX = ps.x + 36;
        const targetArmY = ps.tankY - 45;
        const distToTarget = Math.hypot(shot.x - targetArmX, shot.y - targetArmY);
        const distToPlayer = Math.hypot(shot.x - ps.x, shot.y - ps.y);

        if (distToTarget <= 22 || distToPlayer <= 22) {
          hit = true;
          shot.alive = false;

          // Damage & Wobble
          ps.hp -= 1;
          ps.wobbleAngle = (Math.random() - 0.5) * 0.45;
          this.audio.playBounce();
          this.particles.showFloatingText('CLANG!', targetArmX, targetArmY - 20, '#FACC15', 20);

          // Spawn splash drops
          for (let k = 0; k < 8; k++) {
            this.waterSplashes.push({
              x: targetArmX,
              y: targetArmY,
              vx: (Math.random() - 0.5) * 220,
              vy: -Math.random() * 240,
              color: '#38BDF8',
              alpha: 0.9
            });
          }

          // DUNK TRIGGER!
          if (ps.hp <= 0) {
            ps.isDunked = true;
            ps.dunkTimer = 3.5;
            ps.ladderProgress = 0;
            this.audio.playSnowSplat();
            this.particles.shake(0.4);
            this.particles.showFloatingText('SPLASHDOWN! DUNKED!', ps.x, ps.tankY - 40, '#EF4444', 26);

            // Award score to the shooter
            const shooter = this.playersState.get(shot.playerId);
            if (shooter) {
              shooter.score += 350;
              shooter.dunksInflicted += 1;
              this.particles.showFloatingText('+350 DUNK!', shooter.x, shooter.y - 30, shot.color, 24);
              this.particles.spawnConfetti(shooter.x, shooter.y, 16);
            }

            // Massive water splash!
            for (let k = 0; k < 25; k++) {
              this.waterSplashes.push({
                x: ps.tankX + (Math.random() - 0.5) * 45,
                y: ps.tankY,
                vx: (Math.random() - 0.5) * 280,
                vy: -150 - Math.random() * 320,
                color: '#38BDF8',
                alpha: 1.0
              });
            }
          }
          break;
        }
      }

      // Out of bounds check
      if (!hit && (shot.x < -30 || shot.x > width + 30 || shot.y < -30 || shot.y > height + 30)) {
        shot.alive = false;
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    if (ps.isDunked) {
      // Bot mashing button to climb back up!
      if (Math.random() < 0.8) {
        this.input.setBotInput(botId, true, 0, 0, true);
      }
      return;
    }

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    ps.botReactionTimer = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.18 : 0.35;

    // Pick best opponent target
    let bestTarget: TankPlayerState | null = null;
    let minHp = 999;

    for (const [pid, targetPs] of this.playersState.entries()) {
      if (pid === botId || targetPs.isDunked) continue;

      if (targetPs.hp < minHp) {
        minHp = targetPs.hp;
        bestTarget = targetPs;
      }
    }

    if (!bestTarget) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Aim towards target bullseye
    const targetX = bestTarget.x + 36;
    const targetY = bestTarget.tankY - 45;
    const dx = targetX - ps.x;
    const dy = targetY - ps.y;
    const desiredAngle = Math.atan2(dy, dx);

    const angleDiff = Math.abs(ps.aimAngle - desiredAngle);
    const tolerance = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.16 : 0.32;

    if (angleDiff < tolerance && ps.splashCooldown <= 0) {
      if (difficulty === 'bot_easy' && Math.random() < 0.25) {
        this.input.setBotInput(botId, false, 0, 0, false);
        return;
      }
      this.input.setBotInput(botId, true, 0, 0, true);
    } else {
      const steer = Math.cos(desiredAngle);
      const throttle = Math.sin(desiredAngle);
      this.input.setBotInput(botId, true, steer, throttle, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Waterpark / Pier Backdrop
    this.renderBackdrop(ctx, width, height);

    // 2. Individual Water Tanks & Perches
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderPlayerTank(ctx, ps, p.color);
    }

    // 3. Water Splashes
    for (const drop of this.waterSplashes) {
      ctx.fillStyle = drop.color;
      ctx.globalAlpha = Math.max(0, drop.alpha);
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 4. Flying Plunger Shots
    for (const shot of this.shots) {
      if (!shot.alive) continue;
      ctx.save();
      ctx.translate(shot.x, shot.y);
      ctx.rotate(Math.atan2(shot.vy, shot.vx));

      // Red rubber suction plunger head
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(6, 0, 8, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#991B1B';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Wooden handle
      ctx.fillStyle = '#B45309';
      ctx.fillRect(-14, -2.5, 16, 5);
      ctx.restore();
    }

    // 5. Theme Pill (bottom-left)
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.dunkTheme === 'pier') {
      ctx.fillStyle = '#0C4A6E'; // Deep ocean blue
    } else if (this.dunkTheme === 'waterpark') {
      ctx.fillStyle = '#065F46'; // Teal pool deck
    } else {
      ctx.fillStyle = '#1E1B4B'; // Indigo lab
    }
    ctx.fillRect(0, 0, width, height);

    // Boardwalk Wood Planks / Tiles at bottom
    ctx.fillStyle = '#78350F';
    ctx.fillRect(0, height * 0.82, width, height * 0.18);
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 2;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, height * 0.82);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  private renderPlayerTank(ctx: CanvasRenderingContext2D, ps: TankPlayerState, color: string): void {
    const tankW = 85;
    const tankH = 110;
    const tx = ps.tankX - tankW / 2;
    const ty = ps.tankY;

    // 1. Water Tank Glass Container
    ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
    ctx.beginPath();
    ctx.roundRect(tx, ty, tankW, tankH, 8);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(tx, ty, tankW, tankH);

    // Water level inside tank with ripples
    const wave = Math.sin(performance.now() * 0.005 + ps.tankX) * 4;
    ctx.fillStyle = 'rgba(2, 132, 199, 0.65)';
    ctx.fillRect(tx + 2, ty + 15 + wave, tankW - 4, tankH - 17 - wave);

    // 2. Ladder inside tank
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx + 8, ty);
    ctx.lineTo(tx + 8, ty + tankH);
    ctx.moveTo(tx + 22, ty);
    ctx.lineTo(tx + 22, ty + tankH);
    for (let ly = ty + 15; ly < ty + tankH; ly += 18) {
      ctx.moveTo(tx + 8, ly);
      ctx.lineTo(tx + 22, ly);
    }
    ctx.stroke();

    // 3. Mechanical Perch Stand & Trapdoor
    ctx.save();
    ctx.translate(ps.x, ps.tankY - 45);
    ctx.rotate(ps.wobbleAngle);

    // Perch Arm
    ctx.fillStyle = '#475569';
    ctx.fillRect(-28, -6, 56, 10);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.strokeRect(-28, -6, 56, 10);

    // Target Bullseye Arm Protruding to the right
    ctx.fillStyle = '#64748B';
    ctx.fillRect(28, -3, 20, 6);

    // Bullseye Ring
    ctx.beginPath();
    ctx.arc(44, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(44, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(44, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.fill();

    // HP Pips on target
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.hp} HP`, 44, -20);

    // 4. Mascot Player Rendering
    const currentY = ps.isDunked ? 45 + (1 - ps.ladderProgress) * 40 : -22;
    const mood = ps.isDunked ? 'shocked' : ps.dunksInflicted > 0 ? 'triumph' : 'focused';
    this.drawPlayerMascot(ctx, ps.id, 0, currentY, 15, mood, performance.now() * 0.001);

    // Water Gun Cannon
    if (!ps.isDunked) {
      ctx.save();
      ctx.translate(0, -22);
      ctx.rotate(ps.aimAngle);
      ctx.fillStyle = color;
      ctx.fillRect(0, -3, 24, 6);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, -3, 24, 6);
      ctx.restore();
    }

    ctx.restore();

    // Score Tag above tank
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.score} pts`, ps.x, ps.tankY - 88);
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number): void {
    const pillW = 165;
    const pillH = 26;
    const pillX = 20;
    const pillY = height - 44;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.dunkTheme === 'pier' ? '#38BDF8' : this.dunkTheme === 'waterpark' ? '#34D399' : '#818CF8';
    ctx.fillText(`TANK: ${this.dunkTheme.toUpperCase()} [1-3]`, pillX + pillW / 2, pillY + 17);
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Splash Master!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} scored ${ps?.dunksInflicted || 0} splashdowns!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
