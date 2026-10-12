import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface RiverLog {
  lane: number;
  x: number;
  y: number;
  width: number;
  speed: number;
}

interface LeapingPiranha {
  x: number;
  lane: number;
  timer: number;
  isLeaping: boolean;
  leapY: number;
}

interface RiverPlayer {
  id: PlayerId;
  lane: number; // 0 = south bank, 1..4 = river lanes, 5 = north bank
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isHopping: boolean;
  score: number;
}

export class PiranhaRiverHopGame extends BaseGame {
  private logs: RiverLog[] = [];
  private piranhas: LeapingPiranha[] = [];
  private playersState: Map<PlayerId, RiverPlayer> = new Map();
  private laneHeights: number[] = [];

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
    this.logs = [];
    this.piranhas = [];
    this.playersState.clear();

    // 6 lane Y coordinates: lane 0 (south), 1..4 (river), 5 (north bank)
    this.laneHeights = [];
    const laneCount = 6;
    const laneStep = (height - 90) / (laneCount - 1);
    for (let i = 0; i < laneCount; i++) {
      this.laneHeights.push(height - 45 - i * laneStep);
    }

    // Populate river logs on lanes 1..4
    for (let lane = 1; lane <= 4; lane++) {
      const speed = (lane % 2 === 0 ? 1 : -1) * (70 + lane * 25);
      const logWidth = 90 + (lane % 2) * 30;
      for (let x = 40; x < width + logWidth; x += logWidth + 70) {
        this.logs.push({
          lane,
          x,
          y: this.laneHeights[lane],
          width: logWidth,
          speed
        });
      }

      // Add a leaping piranha in each lane
      this.piranhas.push({
        x: Math.random() * width,
        lane,
        timer: 1.5 + Math.random() * 2,
        isLeaping: false,
        leapY: 0
      });
    }

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const startX = (width / (count + 1)) * (idx + 1);
      const startY = this.laneHeights[0];
      this.playersState.set(p.id, {
        id: p.id,
        lane: 0,
        x: startX,
        y: startY,
        targetX: startX,
        targetY: startY,
        isHopping: false,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update drifting logs
    for (const log of this.logs) {
      log.x += log.speed * dt;
      if (log.speed > 0 && log.x > width + log.width / 2) {
        log.x = -log.width / 2;
      } else if (log.speed < 0 && log.x < -log.width / 2) {
        log.x = width + log.width / 2;
      }
    }

    // Update leaping piranhas
    for (const pir of this.piranhas) {
      pir.timer -= dt;
      if (pir.timer <= 0) {
        if (!pir.isLeaping) {
          pir.isLeaping = true;
          pir.timer = 0.8;
          pir.x = 40 + Math.random() * (width - 80);
          this.audio.playWhoosh();
        } else {
          pir.isLeaping = false;
          pir.timer = 1.8 + Math.random() * 1.5;
        }
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Log riding: if on a river lane (1..4), move with the log under player
      if (ps.lane >= 1 && ps.lane <= 4 && !ps.isHopping) {
        const laneY = this.laneHeights[ps.lane];
        const logUnder = this.logs.find(
          (l) => l.lane === ps.lane && Math.abs(ps.x - l.x) < l.width / 2 + 12
        );

        if (logUnder) {
          ps.x += logUnder.speed * dt;
          ps.targetX = ps.x;
        } else {
          // In water! Fall back to bank
          ps.lane = 0;
          ps.y = this.laneHeights[0];
          ps.targetY = ps.y;
          this.audio.playBounce();
          this.particles.showFloatingText('SPLASH!', ps.x, ps.y - 20, '#38BDF8', 18);
        }
      }

      // Check piranha bites
      for (const pir of this.piranhas) {
        if (pir.isLeaping && pir.lane === ps.lane && Math.hypot(ps.x - pir.x, ps.y - this.laneHeights[pir.lane]) < 32) {
          // Bitten by piranha! Knocked back to lane 0
          ps.lane = 0;
          ps.y = this.laneHeights[0];
          ps.targetY = ps.y;
          this.audio.playChomp();
          this.particles.showFloatingText('CHOMP! -10', ps.x, ps.y - 24, '#EF4444', 22);
          this.particles.spawnExplosion(ps.x, ps.y, '#EF4444', 12);
        }
      }

      // Hop controls
      const hopAction = this.input.justPressed(p.id);
      if (hopAction && !ps.isHopping) {
        const steerX = this.input.getSteer(p.id);
        if (Math.abs(steerX) > 0.4) {
          // Lateral hop
          ps.targetX += Math.sign(steerX) * 44;
          ps.targetX = Math.max(30, Math.min(width - 30, ps.targetX));
        } else {
          // Forward hop
          ps.lane = Math.min(5, ps.lane + 1);
          ps.targetY = this.laneHeights[ps.lane];
        }
        ps.isHopping = true;
        this.audio.playBounce();
      }

      // Smooth lerp to target
      ps.x += (ps.targetX - ps.x) * Math.min(1, dt * 14);
      ps.y += (ps.targetY - ps.y) * Math.min(1, dt * 14);
      if (Math.hypot(ps.targetX - ps.x, ps.targetY - ps.y) < 3) {
        ps.x = ps.targetX;
        ps.y = ps.targetY;
        ps.isHopping = false;
      }

      // Reached North Bank (Lane 5)
      if (ps.lane === 5) {
        ps.score += 35;
        this.audio.playScore();
        this.particles.showFloatingText('SHORE CROSSED! +35', ps.x, ps.y - 20, '#10B981', 24);
        this.particles.spawnConfetti(ps.x, ps.y, 14);
        // Teleport back to South Bank for another crossing
        ps.lane = 0;
        ps.targetY = this.laneHeights[0];
        ps.y = ps.targetY;
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Tropical River Water
    const riverGrad = ctx.createLinearGradient(0, 0, 0, height);
    riverGrad.addColorStop(0, '#064E3B'); // North Jungle Shore
    riverGrad.addColorStop(0.18, '#0369A1'); // River water
    riverGrad.addColorStop(0.82, '#0284C7'); // River water
    riverGrad.addColorStop(1, '#064E3B'); // South Jungle Shore
    ctx.fillStyle = riverGrad;
    ctx.fillRect(0, 0, width, height);

    // North Shore Bank & South Shore Bank Grass
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, 0, width, this.laneHeights[5] + 20);
    ctx.fillRect(0, this.laneHeights[0] - 15, width, height - (this.laneHeights[0] - 15));

    // Shoreline gold sand trim
    ctx.fillStyle = '#D97706';
    ctx.fillRect(0, this.laneHeights[5] + 20, width, 5);
    ctx.fillRect(0, this.laneHeights[0] - 18, width, 5);

    // 2. Draw Floating River Logs
    for (const log of this.logs) {
      ctx.save();
      ctx.translate(log.x, log.y);

      // Bark wood gradient
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.roundRect(-log.width / 2, -14, log.width, 28, 12);
      ctx.fill();
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Moss patch on log
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.ellipse(0, -6, log.width * 0.28, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tree rings on end
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.ellipse(-log.width / 2 + 5, 0, 4, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Draw Leaping Piranhas
    for (const pir of this.piranhas) {
      if (!pir.isLeaping) continue;
      const py = this.laneHeights[pir.lane];
      ctx.save();
      ctx.translate(pir.x, py);

      // Leaping arc offset
      const arcOffset = -Math.sin((pir.timer / 0.8) * Math.PI) * 28;
      ctx.translate(0, arcOffset);

      // Water splash rings below
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -arcOffset, 16, 5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Red Razor Piranha Body
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#991B1B';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Sharp Teeth / Open Jaw
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(15, 0);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();

      // Menacing Eye
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(6, -4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(7, -4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Player frog / explorer circle
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Safari goggles
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(-4, -3, 3.5, 0, Math.PI * 2);
      ctx.arc(4, -3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 20);
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
    if (!ps || ps.isHopping) return;

    // Check if next lane currently has a log right in front of player
    const nextLane = ps.lane + 1;
    if (nextLane > 5) return;

    let canHopForward = false;
    if (nextLane === 5) {
      canHopForward = true;
    } else {
      const logsInNext = this.logs.filter((l) => l.lane === nextLane);
      for (const log of logsInNext) {
        if (Math.abs(log.x - ps.x) < log.width / 2 - 10) {
          canHopForward = true;
          break;
        }
      }
    }

    // Check leaping piranha in next lane
    const piranhaInNext = this.piranhas.find((p) => p.lane === nextLane && p.isLeaping && Math.abs(p.x - ps.x) < 50);
    if (piranhaInNext && difficulty !== 'bot_easy') {
      canHopForward = false;
    }

    const hopThreshold = difficulty === 'bot_hard' ? 0.85 : difficulty === 'bot_normal' ? 0.65 : 0.4;
    if (canHopForward && Math.random() < hopThreshold) {
      this.input.setBotInput(botId, true, 0, 0, true);
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
      mvpHighlight: winnerId ? `${winnerId} navigated the dangerous piranha river rapids!` : 'Tied river crossings!'
    };
  }
}
