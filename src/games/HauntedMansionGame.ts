import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Ghost {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'green' | 'purple' | 'boss';
  alpha: number;
  alive: boolean;
  points: number;
}

interface HunterState {
  aimAngle: number;
  aimDir: number;
  score: number;
  cooldown: number;
  strobeFlash: number;
}

export class HauntedMansionGame extends BaseGame {
  private ghosts: Ghost[] = [];
  private hunters: Map<PlayerId, HunterState> = new Map();
  private spawnTimer: number = 1.0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.ghosts = [];
    this.hunters.clear();
    this.spawnTimer = 0.5;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.hunters.set(p.id, {
        aimAngle: (Math.random() - 0.5) * 1.2,
        aimDir: Math.random() < 0.5 ? 1 : -1,
        score: 0,
        cooldown: 0,
        strobeFlash: 0
      });
    }

    // Initial ghosts
    for (let i = 0; i < 4; i++) {
      this.spawnGhost(width, height);
    }
  }

  private spawnGhost(width: number, height: number): void {
    const isBoss = Math.random() < 0.15;
    const isPurple = !isBoss && Math.random() < 0.4;
    const type = isBoss ? 'boss' : isPurple ? 'purple' : 'green';

    this.ghosts.push({
      x: width * 0.15 + Math.random() * (width * 0.7),
      y: height * 0.15 + Math.random() * (height * 0.45),
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.5) * 60,
      type,
      alpha: 0.1,
      alive: true,
      points: isBoss ? 250 : isPurple ? 100 : 50
    });
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

    // Spawn ghosts
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (this.ghosts.filter(g => g.alive).length < 7) {
        this.spawnGhost(width, height);
      }
      this.spawnTimer = 1.2;
    }

    // Update ghosts
    for (const g of this.ghosts) {
      if (!g.alive) continue;
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      if (g.alpha < 0.9) g.alpha += dt * 1.5;

      // Bounce in upper chamber
      if (g.x < width * 0.1) { g.x = width * 0.1; g.vx = -g.vx; }
      if (g.x > width * 0.9) { g.x = width * 0.9; g.vx = -g.vx; }
      if (g.y < height * 0.1) { g.y = height * 0.1; g.vy = -g.vy; }
      if (g.y > height * 0.6) { g.y = height * 0.6; g.vy = -g.vy; }
    }

    // Update Hunters & Inputs
    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const h = this.hunters.get(p.id);
      if (!h) return;

      // Sweep flashlight cone
      h.aimAngle += h.aimDir * dt * 2.2;
      if (h.aimAngle > 0.8) {
        h.aimAngle = 0.8;
        h.aimDir = -1;
      } else if (h.aimAngle < -0.8) {
        h.aimAngle = -0.8;
        h.aimDir = 1;
      }

      if (h.cooldown > 0) h.cooldown -= dt;
      if (h.strobeFlash > 0) h.strobeFlash -= dt * 4;

      // Trigger UV Strobe Flash
      if (this.input.justPressed(p.id) && h.cooldown <= 0) {
        h.cooldown = 0.4;
        h.strobeFlash = 1.0;
        this.audio.playTone(600, 0.1, 'square');

        const hunterX = (width / (count + 1)) * (idx + 1);
        const hunterY = height - 40;

        // Check ghosts inside beam cone
        let hitAny = false;
        for (const g of this.ghosts) {
          if (!g.alive) continue;

          const dx = g.x - hunterX;
          const dy = hunterY - g.y;
          const angleToGhost = Math.atan2(dx, dy);

          if (Math.abs(angleToGhost - h.aimAngle) < 0.22 && dy > 40) {
            g.alive = false;
            h.score += g.points;
            hitAny = true;
            this.audio.playTone(880, 0.15, 'triangle');
            this.particles.emit(g.x, g.y, 25, g.type === 'boss' ? '#FACC15' : g.type === 'purple' ? '#C084FC' : '#4ADE80');
          }
        }

        if (!hitAny) {
          this.audio.playTone(200, 0.05, 'sawtooth');
        }
      }
    });

    // Cleanup dead ghosts
    this.ghosts = this.ghosts.filter(g => g.alive);
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const h = this.hunters.get(botId);
    if (!h || h.cooldown > 0) {
      this.input.setBotInput(botId, false);
      return;
    }

    const active = this.getActivePlayers();
    const idx = active.findIndex(p => p.id === botId);
    const hunterX = (width / (active.length + 1)) * (idx + 1);
    const hunterY = height - 40;

    let targetAngle = 0;
    let foundGhost = false;

    // Hard bots prioritize high point ghosts
    for (const g of this.ghosts) {
      if (!g.alive) continue;
      const dx = g.x - hunterX;
      const dy = hunterY - g.y;
      const angle = Math.atan2(dx, dy);

      if (Math.abs(angle - h.aimAngle) < (difficulty === 'bot_hard' ? 0.12 : 0.2)) {
        foundGhost = true;
        targetAngle = angle;
        break;
      }
    }

    if (foundGhost) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Dim Victorian haunted mansion chamber
    ctx.fillStyle = '#05070E';
    ctx.fillRect(0, 0, width, height);

    // Chandelier glow at top center
    ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.2, 180, 0, Math.PI * 2);
    ctx.fill();

    // Ghosts
    for (const g of this.ghosts) {
      if (!g.alive) continue;

      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.globalAlpha = g.alpha;

      const baseColor = g.type === 'boss' ? '#EAB308' : g.type === 'purple' ? '#A855F7' : '#22C55E';
      ctx.fillStyle = baseColor;

      // Spooky flowing ghost sheet
      ctx.beginPath();
      const r = g.type === 'boss' ? 22 : 15;
      ctx.arc(0, -r * 0.5, r, Math.PI, 0);
      ctx.lineTo(r, r);
      ctx.lineTo(r * 0.5, r * 0.5);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.5, r * 0.5);
      ctx.lineTo(-r, r);
      ctx.closePath();
      ctx.fill();

      // Hollow Glowing Eyes
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.4, r * 0.2, 0, Math.PI * 2);
      ctx.arc(r * 0.35, -r * 0.4, r * 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Flashlight Beams & Hunters
    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const h = this.hunters.get(p.id);
      if (!h) return;

      const px = (width / (count + 1)) * (idx + 1);
      const py = height - 40;

      // Flashlight cone
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-h.aimAngle);

      const beamLen = height * 0.75;
      const beamHalfW = Math.tan(0.2) * beamLen;

      const beamGrad = ctx.createLinearGradient(0, 0, 0, -beamLen);
      beamGrad.addColorStop(0, h.strobeFlash > 0 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(56, 189, 248, 0.35)');
      beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-beamHalfW, -beamLen);
      ctx.lineTo(beamHalfW, -beamLen);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Hunter Player Disc
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Score Pill
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(px - 40, py + 18, 80, 20, 4);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${h.score} PTS`, px, py + 32);
    });

    // Top Header
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`HAUNTED MANSION • TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.hunters.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} banished the most phantoms in the Haunted Mansion!` : 'The mansion fell quiet into shadows!'
    };
  }
}
