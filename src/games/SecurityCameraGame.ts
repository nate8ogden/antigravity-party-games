import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CCTVCamera {
  x: number;
  y: number;
  angle: number;
  sweepDir: number;
  coneAngle: number;
  length: number;
}

export class SecurityCameraGame extends BaseGame {
  private scores: Map<PlayerId, number> = new Map();
  private playerProgress: Map<PlayerId, number> = new Map(); // 0 to 1
  private cameras: CCTVCamera[] = [];

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.scores.clear();
    this.playerProgress.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;

    this.cameras = [
      { x: width * 0.35, y: 40, angle: Math.PI * 0.35, sweepDir: 1, coneAngle: 0.35, length: height * 0.75 },
      { x: width * 0.65, y: 40, angle: Math.PI * 0.65, sweepDir: -1, coneAngle: 0.35, length: height * 0.75 }
    ];

    for (const p of this.getActivePlayers()) {
      this.scores.set(p.id, 0);
      this.playerProgress.set(p.id, 0.05);
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    // Sweep CCTV cameras
    for (const cam of this.cameras) {
      cam.angle += cam.sweepDir * 1.3 * dt;
      if (cam.angle > Math.PI * 0.75) {
        cam.angle = Math.PI * 0.75;
        cam.sweepDir = -1;
      } else if (cam.angle < Math.PI * 0.25) {
        cam.angle = Math.PI * 0.25;
        cam.sweepDir = 1;
      }
    }

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      let prog = this.playerProgress.get(p.id) || 0;
      const isPressed = this.input.isPressed(p.id);

      const px = this.getPlayerX(i, width, active.length);
      const py = height - 60 - prog * (height - 140);

      // Check if inside any camera cone
      let inCone = false;
      for (const cam of this.cameras) {
        const dx = px - cam.x;
        const dy = py - cam.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= cam.length) {
          const angleToPlayer = Math.atan2(dy, dx);
          let diff = Math.abs(angleToPlayer - cam.angle);
          while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
          if (diff < cam.coneAngle) {
            inCone = true;
            break;
          }
        }
      }

      if (isPressed) {
        if (inCone) {
          // BUSTED! Moving while camera watches
          prog = 0.05;
          this.scores.set(p.id, Math.max(0, (this.scores.get(p.id) || 0) - 10));
          this.particles.emit(px, py, 16, '#EF4444');
          this.audio.playTone(150, 0.25, 'sawtooth');
        } else {
          // Sneaking forward safely
          prog = Math.min(1.0, prog + 0.32 * dt);
          if (Math.random() < 0.2) this.audio.playTone(400, 0.02, 'sine');
        }
      }

      // Check reached museum pedestal
      if (prog >= 0.95) {
        prog = 0.05;
        this.scores.set(p.id, (this.scores.get(p.id) || 0) + 25);
        this.particles.emit(px, height * 0.2, 18, '#FBBF24');
        this.audio.playTone(920, 0.15, 'sine');
      }

      this.playerProgress.set(p.id, prog);
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const active = this.getActivePlayers();
    const i = active.findIndex(p => p.id === botId);
    if (i === -1) return;

    const prog = this.playerProgress.get(botId) || 0;
    const px = this.getPlayerX(i, width, active.length);
    const py = height - 60 - prog * (height - 140);

    let inCone = false;
    for (const cam of this.cameras) {
      const dx = px - cam.x;
      const dy = py - cam.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= cam.length) {
        const angleToPlayer = Math.atan2(dy, dx);
        let diff = Math.abs(angleToPlayer - cam.angle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
        const margin = difficulty === 'bot_hard' ? cam.coneAngle + 0.05 : cam.coneAngle;
        if (diff < margin) {
          inCone = true;
          break;
        }
      }
    }

    if (inCone) {
      // Freeze!
      this.input.setBotInput(botId, false);
    } else {
      // Advance!
      this.input.setBotInput(botId, true);
    }
  }

  private getPlayerX(index: number, width: number, total: number): number {
    const laneWidth = width / Math.max(1, total);
    return laneWidth * index + laneWidth / 2;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Marble museum gallery floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Pedestals at top
    ctx.fillStyle = '#334155';
    ctx.fillRect(20, height * 0.16, width - 40, 20);

    // Camera Cones
    for (const cam of this.cameras) {
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.beginPath();
      ctx.moveTo(cam.x, cam.y);
      ctx.arc(cam.x, cam.y, cam.length, cam.angle - cam.coneAngle, cam.angle + cam.coneAngle);
      ctx.closePath();
      ctx.fill();

      // Camera body
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.arc(cam.x, cam.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }

    // Players
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const prog = this.playerProgress.get(p.id) || 0;
      const px = this.getPlayerX(i, width, active.length);
      const py = height - 60 - prog * (height - 140);
      const isPressed = this.input.isPressed(p.id);

      ctx.save();
      ctx.translate(px, py);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      // Mask/glasses
      ctx.fillStyle = '#111827';
      ctx.fillRect(-8, -4, 16, 5);

      if (isPressed) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RUN', 0, 24);
      } else {
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FROZEN', 0, 24);
      }

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${this.scores.get(p.id) || 0}`, px, height - 15);
    }

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`SECURITY CAMERA FREEZE: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.scores.get(p.id) || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} sneaked past the cameras unnoticed!` : 'All spies spotted on camera!'
    };
  }
}
