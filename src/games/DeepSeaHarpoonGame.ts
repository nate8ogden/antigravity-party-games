import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface HarpoonTurret {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  sweepDir: number;
  sweepSpeed: number;
  cooldown: number;
  score: number;
}

interface HarpoonSpear {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface SeaCreature {
  id: number;
  x: number;
  y: number;
  vx: number;
  radius: number;
  type: 'angler' | 'neon_squid' | 'golden_nautilus';
  points: number;
  color: string;
}

export class DeepSeaHarpoonGame extends BaseGame {
  private turrets: Map<PlayerId, HarpoonTurret> = new Map();
  private spears: HarpoonSpear[] = [];
  private creatures: SeaCreature[] = [];
  private spearIdCounter: number = 0;
  private creatureIdCounter: number = 0;
  private spawnTimer: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.turrets.clear();
    this.spears = [];
    this.creatures = [];
    this.spawnTimer = 0.5;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const x = width * 0.15 + (idx / Math.max(1, active.length - 1)) * (width * 0.7);
      this.turrets.set(p.id, {
        id: p.id,
        x,
        y: height * 0.88,
        angle: -Math.PI / 2,
        sweepDir: 1,
        sweepSpeed: 1.8,
        cooldown: 0,
        score: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });

    for (let i = 0; i < 5; i++) {
      this.spawnCreature(width, height);
    }
  }

  private spawnCreature(width: number, height: number): void {
    const roll = Math.random();
    const isGold = roll < 0.2;
    const isSquid = !isGold && roll < 0.6;
    const dir = Math.random() < 0.5 ? 1 : -1;

    this.creatures.push({
      id: ++this.creatureIdCounter,
      x: dir === 1 ? -20 : width + 20,
      y: height * 0.18 + Math.random() * (height * 0.5),
      vx: dir * (90 + Math.random() * 80),
      radius: isGold ? 16 : isSquid ? 14 : 11,
      type: isGold ? 'golden_nautilus' : isSquid ? 'neon_squid' : 'angler',
      points: isGold ? 35 : isSquid ? 20 : 10,
      color: isGold ? '#FFD700' : isSquid ? '#E040FB' : '#00E5FF'
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.creatures.length < 8) {
      this.spawnTimer = 1.0 + Math.random() * 0.8;
      this.spawnCreature(width, height);
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // Update turrets sweep & fire
    for (const p of active) {
      const t = this.turrets.get(p.id);
      if (!t) continue;

      if (t.cooldown > 0) t.cooldown -= dt;

      // Oscillate harpoon aim angle
      t.angle += t.sweepDir * t.sweepSpeed * dt;
      if (t.angle < -Math.PI * 0.85) {
        t.angle = -Math.PI * 0.85;
        t.sweepDir = 1;
      } else if (t.angle > -Math.PI * 0.15) {
        t.angle = -Math.PI * 0.15;
        t.sweepDir = -1;
      }

      // Check input: Fire Harpoon
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction && t.cooldown <= 0) {
        t.cooldown = 0.55;
        this.spears.push({
          id: ++this.spearIdCounter,
          ownerId: p.id,
          x: t.x + Math.cos(t.angle) * 20,
          y: t.y + Math.sin(t.angle) * 20,
          vx: Math.cos(t.angle) * 550,
          vy: Math.sin(t.angle) * 550,
          life: 1.5
        });
        this.audio.playTap();
        this.particles.emit(t.x, t.y, 4, '#81D4FA');
      }
    }

    // Update creatures
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      c.x += c.vx * dt;

      if ((c.vx > 0 && c.x > width + 40) || (c.vx < 0 && c.x < -40)) {
        this.creatures.splice(i, 1);
      }
    }

    // Update spears
    for (let i = this.spears.length - 1; i >= 0; i--) {
      const s = this.spears[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;

      let hit = false;

      // Check hit on sea creatures
      for (let cIdx = this.creatures.length - 1; cIdx >= 0; cIdx--) {
        const c = this.creatures[cIdx];
        if (Math.hypot(s.x - c.x, s.y - c.y) < c.radius + 6) {
          hit = true;
          const t = this.turrets.get(s.ownerId);
          if (t) t.score += c.points;

          this.audio.playScore();
          this.particles.spawnConfetti(c.x, c.y, 10);
          this.creatures.splice(cIdx, 1);
          break;
        }
      }

      if (hit || s.life <= 0 || s.y < 0) {
        this.spears.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const t = this.turrets.get(botId);
    if (!t || t.cooldown > 0) return;

    let shoot = false;
    let delay = 0.25;

    // Check if any creature is in crosshairs of harpoon trajectory
    for (const c of this.creatures) {
      const dx = c.x - t.x;
      const dy = c.y - t.y;
      const angleToCreature = Math.atan2(dy, dx);

      if (Math.abs(t.angle - angleToCreature) < 0.14) {
        shoot = true;
        break;
      }
    }

    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.3) shoot = true; // accidental premature fire
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    if (shoot) {
      t.cooldown = 0.55;
      this.spears.push({
        id: ++this.spearIdCounter,
        ownerId: botId,
        x: t.x + Math.cos(t.angle) * 20,
        y: t.y + Math.sin(t.angle) * 20,
        vx: Math.cos(t.angle) * 550,
        vy: Math.sin(t.angle) * 550,
        life: 1.5
      });
      this.audio.playTap();
    }

    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Dark deep ocean abyss
    ctx.fillStyle = '#020C1B';
    ctx.fillRect(0, 0, width, height);

    // Flashlight beam cones from turrets
    for (const [id, t] of this.turrets.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';

      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);

      // Light beam
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(height * 0.9, -40);
      ctx.lineTo(height * 0.9, 40);
      ctx.closePath();
      ctx.fill();

      // Gun barrel
      ctx.fillStyle = color;
      ctx.fillRect(0, -4, 24, 8);

      ctx.restore();

      // Base mount
      ctx.fillStyle = '#37474F';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 14, Math.PI, 0);
      ctx.fill();

      // Score above turret
      ctx.fillStyle = color;
      ctx.font = 'bold 15px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${t.score} pts`, t.x, t.y + 16);
    }

    // Render creatures
    for (const c of this.creatures) {
      ctx.save();
      ctx.translate(c.x, c.y);

      // Bioluminescent glow halo
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner details
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(c.vx > 0 ? 4 : -4, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Render harpoon spears
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    for (const s of this.spears) {
      const angle = Math.atan2(s.vy, s.vx);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();

      // Barbed spear tip
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.moveTo(6, -4);
      ctx.lineTo(12, 0);
      ctx.lineTo(6, 4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Timer
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width / 2, 32);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const t = this.turrets.get(p.id);
      return {
        playerId: p.id,
        score: t ? t.score : 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} sniped the abyssal creatures with precision!` : 'The deep abyss remained shrouded in darkness!'
    };
  }
}
