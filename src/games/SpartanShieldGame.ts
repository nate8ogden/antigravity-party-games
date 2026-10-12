import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Arrow {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

interface EnemyTroop {
  id: number;
  x: number;
  hp: number;
  active: boolean;
}

interface HopliteState {
  id: PlayerId;
  x: number;
  y: number;
  shieldRaised: boolean;
  spearThrustAnim: number;
  score: number;
  combo: number;
  staggerTimer: number;
  arrows: Arrow[];
  enemies: EnemyTroop[];
  nextSalvoTimer: number;
  nextEnemyTimer: number;
}

export class SpartanShieldGame extends BaseGame {
  public hoplites: Map<PlayerId, HopliteState> = new Map();
  public currentMapName: string = 'Gates of Thermopylae';
  private arrowIdCounter: number = 0;
  private enemyIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.hoplites.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      this.hoplites.set(p.id, {
        id: p.id,
        x: cx,
        y: height * 0.68,
        shieldRaised: false,
        spearThrustAnim: 0,
        score: 0,
        combo: 0,
        staggerTimer: 0,
        arrows: [],
        enemies: [],
        nextSalvoTimer: 1.5 + Math.random() * 1.0,
        nextEnemyTimer: 3.0 + Math.random() * 2.0,
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    this.hoplites.forEach((h) => {
      const p = this.getPlayer(h.id);
      if (h.staggerTimer > 0) h.staggerTimer -= dt;
      if (h.spearThrustAnim > 0) {
        h.spearThrustAnim = Math.max(0, h.spearThrustAnim - dt * 4.5);
      }

      // Human inputs
      if (p && !p.type.startsWith('bot_')) {
        const isPressed = this.input.isPressed(h.id);
        const justReleased = this.input.justReleased(h.id);

        h.shieldRaised = isPressed && h.staggerTimer <= 0;

        if (justReleased && h.staggerTimer <= 0) {
          this.executeThrust(h);
        }
      }

      // Spawning Arrow Salvos
      h.nextSalvoTimer -= dt;
      if (h.nextSalvoTimer <= 0) {
        const count = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          h.arrows.push({
            id: ++this.arrowIdCounter,
            x: h.x - 40 + Math.random() * 80,
            y: 80 - i * 35,
            vx: (Math.random() - 0.5) * 20,
            vy: 360 + Math.random() * 80,
            active: true,
          });
        }
        h.nextSalvoTimer = 3.5 + Math.random() * 2.0;
        this.audio.playTone(280, 0.1, 'sine');
      }

      // Spawning Persian Foot Soldiers
      h.nextEnemyTimer -= dt;
      if (h.nextEnemyTimer <= 0) {
        h.enemies.push({
          id: ++this.enemyIdCounter,
          x: h.x + 160,
          hp: 1,
          active: true,
        });
        h.nextEnemyTimer = 4.0 + Math.random() * 3.0;
      }

      // Update Arrows
      for (let i = h.arrows.length - 1; i >= 0; i--) {
        const arr = h.arrows[i];
        arr.y += arr.vy * dt;
        arr.x += arr.vx * dt;

        if (arr.active && arr.y >= h.y - 35 && arr.y <= h.y + 10) {
          if (h.shieldRaised) {
            arr.active = false;
            h.score += 15 + h.combo * 2;
            h.combo++;
            this.audio.playTone(550, 0.1, 'triangle');
            this.particles.emit(arr.x, arr.y, 8, '#f39c12');
          } else {
            arr.active = false;
            h.staggerTimer = 0.7;
            h.score = Math.max(0, h.score - 20);
            h.combo = 0;
            this.audio.playTone(160, 0.2, 'sawtooth');
            this.particles.emit(h.x, h.y, 14, '#e74c3c');
          }
        }

        if (arr.y > height) {
          h.arrows.splice(i, 1);
        }
      }

      // Update Enemies
      for (let i = h.enemies.length - 1; i >= 0; i--) {
        const ene = h.enemies[i];
        ene.x -= 85 * dt;

        if (ene.active && h.spearThrustAnim > 0.3 && ene.x < h.x + 55 && ene.x > h.x - 10) {
          ene.active = false;
          h.score += 45 + h.combo * 5;
          h.combo++;
          this.audio.playTone(720, 0.15, 'sine');
          this.particles.emit(ene.x, h.y, 16, '#e67e22');
        }

        if (ene.active && ene.x <= h.x + 15) {
          ene.active = false;
          if (h.shieldRaised) {
            h.score += 20;
            this.audio.playTone(380, 0.1, 'square');
          } else {
            h.staggerTimer = 0.9;
            h.score = Math.max(0, h.score - 30);
            h.combo = 0;
            this.audio.playTone(120, 0.25, 'sawtooth');
          }
        }

        if (ene.x < -40 || !ene.active) {
          h.enemies.splice(i, 1);
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const h = this.hoplites.get(botId);
    if (!h) return;

    const incomingArrow = h.arrows.find((a) => a.active && a.y > h.y - 120 && a.y < h.y - 20);
    const incomingEnemy = h.enemies.find((e) => e.active && Math.abs(e.x - h.x) < 70);

    let botTimer = this.botReactionTimers.get(botId) || 0;
    botTimer -= dt;
    if (botTimer <= 0) {
      if (incomingArrow) {
        h.shieldRaised = true;
        botTimer = difficulty === 'bot_hard' ? 0.3 : 0.5;
      } else if (incomingEnemy && !h.shieldRaised) {
        h.shieldRaised = false;
        this.executeThrust(h);
        botTimer = difficulty === 'bot_hard' ? 0.4 : 0.6;
      } else {
        h.shieldRaised = false;
        botTimer = 0.2;
      }
    }
    this.botReactionTimers.set(botId, botTimer);
  }

  private executeThrust(h: HopliteState): void {
    if (h.spearThrustAnim <= 0.05) {
      h.spearThrustAnim = 1.0;
      this.audio.playTone(480, 0.08, 'triangle');
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#5b3924');
    bgGrad.addColorStop(0.5, '#784d31');
    bgGrad.addColorStop(1, '#2b1a10');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#3a2316';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.55);
    ctx.lineTo(width * 0.25, height * 0.38);
    ctx.lineTo(width * 0.55, height * 0.52);
    ctx.lineTo(width * 0.8, height * 0.4);
    ctx.lineTo(width, height * 0.5);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.hoplites.forEach((h, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#c0392b';

      ctx.fillStyle = '#422817';
      ctx.fillRect(h.x - colWidth * 0.5, height * 0.72, colWidth, height * 0.28);

      ctx.strokeStyle = '#2b180d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.x - colWidth * 0.5, 0);
      ctx.lineTo(h.x - colWidth * 0.5, height);
      ctx.stroke();

      h.enemies.forEach((ene) => {
        if (!ene.active) return;
        ctx.fillStyle = '#8e44ad';
        ctx.beginPath();
        ctx.roundRect(ene.x - 10, h.y - 28, 20, 26, 4);
        ctx.fill();
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(ene.x, h.y - 32, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ene.x - 8, h.y - 12);
        ctx.lineTo(ene.x - 22, h.y - 18);
        ctx.stroke();
      });

      h.arrows.forEach((arr) => {
        if (!arr.active) return;
        ctx.strokeStyle = '#d35400';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(arr.x, arr.y - 14);
        ctx.lineTo(arr.x, arr.y + 14);
        ctx.stroke();

        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(arr.x, arr.y + 14, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.save();
      if (h.staggerTimer > 0) {
        ctx.translate(h.x, h.y);
        ctx.rotate(-0.25);
        ctx.translate(-h.x, -h.y);
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(h.x - 12, h.y - 28, 24, 28, 4);
      ctx.fill();

      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(h.x, h.y - 34, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(h.x - 3, h.y - 50, 6, 16);

      const shieldY = h.shieldRaised ? h.y - 30 : h.y - 10;
      const shieldX = h.shieldRaised ? h.x : h.x - 14;
      ctx.fillStyle = '#d4ac0d';
      ctx.beginPath();
      ctx.arc(shieldX, shieldY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7d6608';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = '#900c3f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(shieldX - 7, shieldY + 8);
      ctx.lineTo(shieldX, shieldY - 7);
      ctx.lineTo(shieldX + 7, shieldY + 8);
      ctx.stroke();

      const thrustReach = h.spearThrustAnim * 48;
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y - 8);
      ctx.lineTo(h.x + 24 + thrustReach, h.y - 8);
      ctx.stroke();
      ctx.fillStyle = '#bdc3c7';
      ctx.beginPath();
      ctx.moveTo(h.x + 24 + thrustReach, h.y - 12);
      ctx.lineTo(h.x + 36 + thrustReach, h.y - 8);
      ctx.lineTo(h.x + 24 + thrustReach, h.y - 4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${h.score}`, h.x, height * 0.88);
      if (h.combo > 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${h.combo}x COMBO`, h.x, height * 0.92);
      }
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 150, 56, 300, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛡️ HOLD TO BLOCK ARROWS • RELEASE TO THRUST SPEAR!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.hoplites.forEach((h, pId) => scores.set(pId, h.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.hoplites.entries())
      .map(([playerId, h]) => ({ playerId, score: h.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} held the Hot Gates of Thermopylae!` : 'The Spartan line fell!',
    };
  }
}
