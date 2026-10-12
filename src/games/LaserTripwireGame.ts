import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface LaserBeam {
  y: number;
  vy: number;
  heightRange: [number, number];
  active: boolean;
}

interface IntelItem {
  x: number;
  y: number;
  collected: boolean;
}

export class LaserTripwireGame extends BaseGame {
  private scores: Map<PlayerId, number> = new Map();
  private playerX: Map<PlayerId, number> = new Map();
  private playerY: Map<PlayerId, number> = new Map();
  private playerStance: Map<PlayerId, 'stand' | 'crawl' | 'jump'> = new Map();
  private playerShock: Map<PlayerId, number> = new Map();
  private jumpTimers: Map<PlayerId, number> = new Map();
  private lasers: LaserBeam[] = [];
  private intelItems: IntelItem[] = [];
  private spawnTimer: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.scores.clear();
    this.playerX.clear();
    this.playerY.clear();
    this.playerStance.clear();
    this.playerShock.clear();
    this.jumpTimers.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;
    this.spawnTimer = 0.5;

    // Laser beams sweeping vertically across corridor
    this.lasers = [
      { y: height * 0.35, vy: 90, heightRange: [height * 0.25, height * 0.75], active: true },
      { y: height * 0.65, vy: -110, heightRange: [height * 0.25, height * 0.75], active: true },
      { y: height * 0.5, vy: 140, heightRange: [height * 0.3, height * 0.7], active: true }
    ];

    this.intelItems = [];
    for (let i = 0; i < 6; i++) {
      this.intelItems.push({
        x: 100 + Math.random() * (width - 200),
        y: height * 0.3 + Math.random() * (height * 0.4),
        collected: false
      });
    }

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      this.scores.set(p.id, 0);
      this.playerX.set(p.id, 100 + i * (width / Math.max(1, active.length)));
      this.playerY.set(p.id, height * 0.5);
      this.playerStance.set(p.id, 'stand');
      this.playerShock.set(p.id, 0);
      this.jumpTimers.set(p.id, 0);
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

    // Update laser oscillations
    for (const laser of this.lasers) {
      laser.y += laser.vy * dt;
      if (laser.y < laser.heightRange[0]) {
        laser.y = laser.heightRange[0];
        laser.vy = Math.abs(laser.vy);
      } else if (laser.y > laser.heightRange[1]) {
        laser.y = laser.heightRange[1];
        laser.vy = -Math.abs(laser.vy);
      }
    }

    const active = this.getActivePlayers();
    for (const p of active) {
      const shock = this.playerShock.get(p.id) || 0;
      if (shock > 0) {
        this.playerShock.set(p.id, Math.max(0, shock - dt));
        continue;
      }

      let jt = this.jumpTimers.get(p.id) || 0;
      const isPressed = this.input.isPressed(p.id);
      const justPressed = this.input.justPressed(p.id);

      if (justPressed && jt <= 0) {
        // Tap to jump
        jt = 0.55;
        this.jumpTimers.set(p.id, jt);
        this.audio.playTone(520, 0.06, 'triangle');
      }

      if (jt > 0) {
        jt -= dt;
        this.jumpTimers.set(p.id, jt);
        this.playerStance.set(p.id, 'jump');
      } else if (isPressed) {
        // Holding down = crawl low
        this.playerStance.set(p.id, 'crawl');
      } else {
        this.playerStance.set(p.id, 'stand');
      }

      // Check laser collisions
      const stance = this.playerStance.get(p.id) || 'stand';
      const py = height * 0.5;
      let playerEffectiveY = py;
      let playerHeight = 40;

      if (stance === 'crawl') {
        playerEffectiveY = py + 20;
        playerHeight = 15;
      } else if (stance === 'jump') {
        playerEffectiveY = py - 35;
        playerHeight = 20;
      }

      for (const laser of this.lasers) {
        if (Math.abs(laser.y - playerEffectiveY) < playerHeight / 2) {
          // Alarm tripped!
          this.playerShock.set(p.id, 1.2);
          this.scores.set(p.id, Math.max(0, (this.scores.get(p.id) || 0) - 10));
          const px = this.playerX.get(p.id) || 200;
          this.particles.emit(px, playerEffectiveY, 15, '#EF4444');
          this.audio.playTone(180, 0.2, 'sawtooth');
          break;
        }
      }

      // Check intel collection
      const px = this.playerX.get(p.id) || 200;
      for (const item of this.intelItems) {
        if (!item.collected && Math.hypot(item.x - px, item.y - playerEffectiveY) < 30) {
          item.collected = true;
          this.scores.set(p.id, (this.scores.get(p.id) || 0) + 15);
          this.particles.emit(item.x, item.y, 8, '#06B6D4');
          this.audio.playTone(720, 0.08, 'sine');
        }
      }
    }

    // Respawn collected intel
    if (this.intelItems.every(item => item.collected)) {
      for (let i = 0; i < 6; i++) {
        this.intelItems.push({
          x: 100 + Math.random() * (width - 200),
          y: height * 0.3 + Math.random() * (height * 0.4),
          collected: false
        });
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, height: number): void {
    const py = height * 0.5;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false);
      return;
    }

    const scanWindow = difficulty === 'bot_easy' ? 30 : difficulty === 'bot_normal' ? 42 : 52;
    const canDodge = difficulty === 'bot_easy' ? Math.random() < 0.68 : true;

    const approachingLaser = this.lasers.find(l => Math.abs(l.y - py) < scanWindow);

    if (approachingLaser && canDodge) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Dark high-security vault corridor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Corridor metal floor & ceiling borders
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, width, height * 0.2);
    ctx.fillRect(0, height * 0.8, width, height * 0.2);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, height * 0.2, width, height * 0.6);

    // Active red laser beams
    for (const laser of this.lasers) {
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, laser.y);
      ctx.lineTo(width, laser.y);
      ctx.stroke();

      // Laser glow
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, laser.y);
      ctx.lineTo(width, laser.y);
      ctx.stroke();
    }

    // Intel flash drives / diamonds
    for (const item of this.intelItems) {
      if (item.collected) continue;
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - 8);
      ctx.lineTo(item.x + 8, item.y);
      ctx.lineTo(item.x, item.y + 8);
      ctx.lineTo(item.x - 8, item.y);
      ctx.closePath();
      ctx.fill();
    }

    // Players
    const active = this.getActivePlayers();
    const py = height * 0.5;

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const px = this.playerX.get(p.id) || 100;
      const stance = this.playerStance.get(p.id) || 'stand';
      const shock = (this.playerShock.get(p.id) || 0) > 0;

      let drawY = py;
      if (stance === 'crawl') drawY = py + 20;
      else if (stance === 'jump') drawY = py - 35;

      ctx.save();
      ctx.translate(px, drawY);

      if (shock) {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SHOCK', 0, -22);
      } else if (stance === 'crawl') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Night vision goggles
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(8, -4, 4, 4);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(4, -4, 4, 4);
      }

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${this.scores.get(p.id) || 0}`, px, height * 0.15);
    }

    // HUD Header
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`LASER TRIPWIRE: ${Math.ceil(this.roundTimer)}s`, width / 2, 35);
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} slipped past the security grid like a phantom!` : 'The laser grid alarmed the sector!'
    };
  }
}
