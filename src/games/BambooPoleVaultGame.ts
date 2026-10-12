import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface VaultIdol {
  x: number;
  y: number;
  points: number;
  collected: boolean;
}

interface VaulterPlayer {
  id: PlayerId;
  state: 'RUNNING' | 'BENDING' | 'AIRBORNE' | 'LANDED' | 'FAILED';
  runProgress: number; // 0 to 1
  poleBend: number; // 0 to 1
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
  score: number;
}

export class BambooPoleVaultGame extends BaseGame {
  private playersState: Map<PlayerId, VaulterPlayer> = new Map();
  private idols: VaultIdol[] = [];

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
    this.idols = [];
    this.playersState.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneH = (height - 80) / count;

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneH + laneH / 2;
      this.playersState.set(p.id, {
        id: p.id,
        state: 'RUNNING',
        runProgress: 0,
        poleBend: 0,
        x: 40,
        y: laneY,
        vx: 0,
        vy: 0,
        timer: 0,
        score: 0
      });

      // Suspended golden idol over chasm
      this.idols.push({
        x: width * 0.58,
        y: laneY - 45,
        points: 30,
        collected: false
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneH = (height - 80) / count;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const laneY = 70 + idx * laneH + laneH / 2;
      const plantX = width * 0.38;
      const landingX = width * 0.76;

      const tap = this.input.justPressed(p.id);
      const isHolding = this.input.isPressed(p.id);

      switch (ps.state) {
        case 'RUNNING':
          // Automatic forward run
          ps.x += 160 * dt;

          // Plant pole at planting zone
          if (tap || ps.x >= plantX) {
            if (Math.abs(ps.x - plantX) < 45) {
              ps.state = 'BENDING';
              ps.poleBend = 0.2;
              this.audio.playBounce();
            } else if (ps.x > plantX + 30) {
              // Missed plant into chasm
              ps.state = 'FAILED';
              ps.timer = 1.0;
              this.audio.playStun();
            }
          }
          break;

        case 'BENDING':
          // Hold to bend bamboo pole
          ps.poleBend = Math.min(1.0, ps.poleBend + dt * 2.2);

          // Release to launch!
          if (!isHolding || ps.poleBend >= 1.0) {
            ps.state = 'AIRBORNE';
            const launchPower = 340 + ps.poleBend * 240;
            ps.vx = launchPower * 0.75;
            ps.vy = -launchPower * 0.85;
            this.audio.playWhoosh();
            this.particles.spawnDust(ps.x, laneY, 6);
          }
          break;

        case 'AIRBORNE':
          ps.vy += 680 * dt; // Gravity
          ps.x += ps.vx * dt;
          ps.y += ps.vy * dt;

          // Check collecting suspended idol
          const idol = this.idols[idx];
          if (idol && !idol.collected && Math.hypot(ps.x - idol.x, ps.y - idol.y) < 24) {
            idol.collected = true;
            ps.score += idol.points;
            this.audio.playScore();
            this.particles.showFloatingText(`+${idol.points} IDOL!`, idol.x, idol.y - 18, '#FBBF24', 20);
            this.particles.spawnConfetti(idol.x, idol.y, 8);
          }

          // Check landing on far cliff
          if (ps.y >= laneY) {
            if (ps.x >= landingX - 25) {
              // Perfect vault landing!
              ps.state = 'LANDED';
              ps.timer = 1.2;
              ps.y = laneY;
              ps.score += 35;
              this.audio.playScore();
              this.particles.showFloatingText('CLEARED! +35', ps.x, laneY - 20, '#10B981', 22);
              this.particles.spawnConfetti(ps.x, laneY, 12);
            } else {
              // Fell into ravine
              ps.state = 'FAILED';
              ps.timer = 1.2;
              this.audio.playStun();
              this.particles.showFloatingText('FELL!', ps.x, laneY + 20, '#EF4444', 18);
            }
          }
          break;

        case 'LANDED':
        case 'FAILED':
          ps.timer -= dt;
          if (ps.timer <= 0) {
            // Reset for next attempt
            ps.state = 'RUNNING';
            ps.x = 40;
            ps.y = laneY;
            ps.vx = 0;
            ps.vy = 0;
            ps.poleBend = 0;
            if (this.idols[idx]) this.idols[idx].collected = false;
          }
          break;
      }
    });

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Jungle Chasm & Mist Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#064E3B');
    bgGrad.addColorStop(0.6, '#065F46');
    bgGrad.addColorStop(1, '#022C22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneH = (height - 80) / count;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const laneY = 70 + idx * laneH + laneH / 2;
      const plantX = width * 0.38;
      const landingX = width * 0.76;

      // Divider line between tracks
      if (idx > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 70 + idx * laneH);
        ctx.lineTo(width, 70 + idx * laneH);
        ctx.stroke();
      }

      // Runway Track
      ctx.fillStyle = '#78350F';
      ctx.fillRect(0, laneY + 12, plantX, 14);

      // Stone Plant Box
      ctx.fillStyle = '#64748B';
      ctx.fillRect(plantX - 12, laneY + 10, 24, 18);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.strokeRect(plantX - 12, laneY + 10, 24, 18);

      // Chasm Gap
      ctx.fillStyle = '#020617';
      ctx.fillRect(plantX + 12, laneY + 12, landingX - (plantX + 12), 40);

      // Far Landing Cliff Platform
      ctx.fillStyle = '#059669';
      ctx.fillRect(landingX, laneY + 12, width - landingX, 14);
      ctx.fillStyle = '#10B981';
      ctx.fillRect(landingX, laneY + 10, width - landingX, 4);

      // Suspended Golden Idol
      const idol = this.idols[idx];
      if (idol && !idol.collected) {
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(idol.x, idol.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw Flexible Bamboo Pole
      if (ps.state === 'BENDING') {
        ctx.strokeStyle = '#84CC16';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(plantX, laneY + 12);
        const ctrlX = plantX - 25 * ps.poleBend;
        const ctrlY = laneY - 20;
        ctx.quadraticCurveTo(ctrlX, ctrlY, ps.x, ps.y);
        ctx.stroke();
      } else if (ps.state === 'RUNNING') {
        // Holding pole horizontally
        ctx.strokeStyle = '#84CC16';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ps.x - 14, ps.y + 4);
        ctx.lineTo(ps.x + 24, ps.y - 12);
        ctx.stroke();
      }

      // Draw Player
      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${ps.score}`, 16, laneY - 18);
    });

    // Header HUD
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
    if (!ps) return;
    const plantX = width * 0.38;

    if (ps.state === 'RUNNING') {
      const tol = difficulty === 'bot_hard' ? 12 : difficulty === 'bot_normal' ? 24 : 38;
      if (Math.abs(ps.x - plantX) < tol) {
        this.input.setBotInput(botId, true, 0, 0, true);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
    } else if (ps.state === 'BENDING') {
      const idealBend = difficulty === 'bot_hard' ? 0.85 : difficulty === 'bot_normal' ? 0.7 : 0.55;
      if (ps.poleBend >= idealBend) {
        // Release to launch!
        this.input.setBotInput(botId, false, 0, 0, false);
      } else {
        // Hold to bend
        this.input.setBotInput(botId, true, 0, 0, false);
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
      mvpHighlight: winnerId ? `${winnerId} launched daring high-altitude bamboo vaults over the chasm!` : 'Tied pole vaults!'
    };
  }
}
