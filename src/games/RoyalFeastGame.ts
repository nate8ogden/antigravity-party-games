import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface FallingDelicacy {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: 'turkey' | 'goblet' | 'pie' | 'rotten_fish' | 'poison_cabbage';
  scoreValue: number;
  isHazard: boolean;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  laneIdx: number;
}

interface ButlerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  laneMinX: number;
  laneMaxX: number;
  vx: number;
  dir: number; // -1 or 1 for auto-run ping-pong
  platterWidth: number;
  score: number;
  combo: number;
  itemsCaught: number;
  stunTimer: number;
  catchAnim: number;
}

export class RoyalFeastGame extends BaseGame {
  public playersState: Map<PlayerId, ButlerPlayer> = new Map();
  public currentMapName: string = 'Grand Royal Banquet Hall';

  private delicacies: FallingDelicacy[] = [];
  private delicacyIdCounter: number = 0;
  private spawnTimer: number = 0.4;
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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.delicacies = [];
    this.delicacyIdCounter = 0;
    this.spawnTimer = 0.3;
    this.playersState.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneWidth = width / count;

    active.forEach((p, idx) => {
      const minX = idx * laneWidth + 15;
      const maxX = (idx + 1) * laneWidth - 15;
      const startX = (minX + maxX) / 2;

      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: height * 0.78,
        laneMinX: minX,
        laneMaxX: maxX,
        vx: 0,
        dir: idx % 2 === 0 ? 1 : -1,
        platterWidth: 46,
        score: 0,
        combo: 0,
        itemsCaught: 0,
        stunTimer: 0,
        catchAnim: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Spawn falling delicacies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.35 + Math.random() * 0.3;
      this.spawnFoodItem(width);
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }
      if (ps.catchAnim > 0) {
        ps.catchAnim = Math.max(0, ps.catchAnim - dt * 4);
      }

      const steer = this.input.getSteer(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      if (Math.abs(steer) > 0.2) {
        ps.vx = steer * 240;
      } else {
        if (justAction) {
          ps.dir = -ps.dir;
        }
        if (ps.x <= ps.laneMinX + 20) {
          ps.dir = 1;
        } else if (ps.x >= ps.laneMaxX - 20) {
          ps.dir = -1;
        }
        ps.vx = ps.dir * 180;
      }

      ps.x += ps.vx * dt;
      ps.x = Math.max(ps.laneMinX + 20, Math.min(ps.laneMaxX - 20, ps.x));
    }

    // Update Falling items
    for (let i = this.delicacies.length - 1; i >= 0; i--) {
      const item = this.delicacies[i];
      item.y += item.vy * dt;
      item.rotation += item.vRot * dt;

      let caught = false;
      for (const p of active) {
        const ps = this.playersState.get(p.id);
        if (!ps || ps.stunTimer > 0) continue;

        const platterY = ps.y - 14;
        const dx = Math.abs(item.x - ps.x);
        const dy = Math.abs(item.y - platterY);

        if (dx < ps.platterWidth / 2 + item.size / 2 && dy < 16) {
          caught = true;
          this.handleCatch(ps, item);
          break;
        }
      }

      if (caught || item.y > height * 0.85) {
        if (!caught && item.isHazard) {
          this.particles.emit(item.x, height * 0.84, 4, item.color);
        }
        this.delicacies.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnFoodItem(_width: number): void {
    const active = this.getActivePlayers();
    if (active.length === 0) return;

    const targetPlayer = active[Math.floor(Math.random() * active.length)];
    const ps = this.playersState.get(targetPlayer.id);
    if (!ps) return;

    const laneX = ps.laneMinX + 25 + Math.random() * (ps.laneMaxX - ps.laneMinX - 50);

    const roll = Math.random();
    let type: FallingDelicacy['type'];
    let scoreValue = 10;
    let isHazard = false;
    let color = '#E65100';
    let size = 16;

    if (roll < 0.35) {
      type = 'turkey';
      scoreValue = 10;
      color = '#8D6E63';
      size = 18;
    } else if (roll < 0.55) {
      type = 'goblet';
      scoreValue = 15;
      color = '#FFD700';
      size = 14;
    } else if (roll < 0.75) {
      type = 'pie';
      scoreValue = 8;
      color = '#FF7043';
      size = 15;
    } else if (roll < 0.88) {
      type = 'rotten_fish';
      scoreValue = -8;
      isHazard = true;
      color = '#558B2F';
      size = 15;
    } else {
      type = 'poison_cabbage';
      scoreValue = -12;
      isHazard = true;
      color = '#7CB342';
      size = 16;
    }

    this.delicacies.push({
      id: ++this.delicacyIdCounter,
      x: laneX,
      y: 90,
      vy: 140 + Math.random() * 80,
      type,
      scoreValue,
      isHazard,
      size,
      color,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 3,
      laneIdx: active.indexOf(targetPlayer)
    });
  }

  private handleCatch(ps: ButlerPlayer, item: FallingDelicacy): void {
    ps.catchAnim = 1.0;

    if (item.isHazard) {
      ps.combo = 0;
      ps.score = Math.max(0, ps.score + item.scoreValue);
      ps.stunTimer = 1.0;
      this.audio.playExplosion();
      this.particles.emit(ps.x, ps.y - 14, 8, item.color);
    } else {
      ps.combo++;
      const bonus = ps.combo > 3 ? 5 : 0;
      ps.score += item.scoreValue + bonus;
      ps.itemsCaught++;
      this.audio.playScore();
      this.particles.spawnSparks(ps.x, ps.y - 14, item.color, 8);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const laneItems = this.delicacies
      .filter(d => d.x >= ps.laneMinX && d.x <= ps.laneMaxX && d.y < ps.y)
      .sort((a, b) => b.y - a.y);

    let targetX = (ps.laneMinX + ps.laneMaxX) / 2;

    if (laneItems.length > 0) {
      const item = laneItems[0];
      if (item.isHazard) {
        targetX = item.x > ps.x ? ps.laneMinX + 30 : ps.laneMaxX - 30;
      } else {
        targetX = item.x;
      }
    }

    const dx = targetX - ps.x;
    let steer = 0;
    if (Math.abs(dx) > 15) {
      steer = dx > 0 ? 1 : -1;
    }

    this.input.setBotInput(botId, false, steer, 0, false);

    let reactionDelay = 0.25;
    if (difficulty === 'bot_easy') reactionDelay = 0.45;
    else if (difficulty === 'bot_hard') reactionDelay = 0.10;

    this.botReactionTimers.set(botId, reactionDelay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0,
        caught: ps?.itemsCaught || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topScore = scores[0]?.score || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} served the Royal Court with highest honor (${topScore} pts)!`
      : 'The feast was ruined by rotten scraps!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#261C14');
    bgGrad.addColorStop(1, '#4E342E');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#3E2723';
    ctx.fillRect(0, 0, width, 85);
    ctx.strokeStyle = '#D7CCC8';
    ctx.lineWidth = 1;

    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROYAL FEAST', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FFE082';
    ctx.fillText('CATCH DELICACIES ON GOLDEN PLATTER • EVADE ROTTEN SCRAPS', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneWidth = width / count;

    for (let i = 1; i < count; i++) {
      const lx = i * laneWidth;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(lx, 90);
      ctx.lineTo(lx, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#3E2723';
    ctx.fillRect(0, height * 0.82, width, height * 0.18);
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(0, height * 0.82, width, 6);

    for (const item of this.delicacies) {
      this.renderDelicacy(ctx, item);
    }

    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderButler(ctx, ps, p);
    }
  }

  private renderDelicacy(ctx: CanvasRenderingContext2D, item: FallingDelicacy): void {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);

    if (item.type === 'turkey') {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, item.size, item.size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(item.size * 0.6, -3, 8, 6);
      ctx.beginPath();
      ctx.arc(item.size * 0.6 + 8, -3, 3, 0, Math.PI * 2);
      ctx.arc(item.size * 0.6 + 8, 3, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'goblet') {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(-8, -10);
      ctx.lineTo(8, -10);
      ctx.lineTo(6, 2);
      ctx.lineTo(-6, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-2, 2, 4, 8);
      ctx.fillRect(-6, 10, 12, 3);
    } else if (item.type === 'pie') {
      ctx.fillStyle = '#D7CCC8';
      ctx.beginPath();
      ctx.arc(0, 2, item.size * 0.8, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#D32F2F';
      ctx.beginPath();
      ctx.ellipse(0, 2, item.size * 0.75, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'rotten_fish') {
      ctx.fillStyle = '#78909C';
      ctx.beginPath();
      ctx.ellipse(0, 0, item.size, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7CB342';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(-4, -14);
      ctx.moveTo(4, -8);
      ctx.lineTo(6, -14);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#558B2F';
      ctx.beginPath();
      ctx.arc(0, 0, item.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7CB342';
      ctx.beginPath();
      ctx.arc(-2, -2, item.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderButler(ctx: CanvasRenderingContext2D, ps: ButlerPlayer, p: PlayerConfig): void {
    ctx.save();

    const isStunned = ps.stunTimer > 0;
    const bounceOffset = ps.catchAnim * 4;

    ctx.fillStyle = isStunned ? '#757575' : '#212121';
    ctx.beginPath();
    ctx.roundRect(ps.x - 14, ps.y - 10, 28, 40, 6);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.fillRect(ps.x - 8, ps.y - 6, 16, 26);

    ctx.fillStyle = '#FFE0B2';
    ctx.beginPath();
    ctx.arc(ps.x, ps.y - 20, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(ps.x - 5, ps.y - 8);
    ctx.lineTo(ps.x + 5, ps.y - 8);
    ctx.lineTo(ps.x, ps.y - 4);
    ctx.closePath();
    ctx.fill();

    const platterY = ps.y - 14 + bounceOffset;
    ctx.fillStyle = '#E0E0E0';
    ctx.beginPath();
    ctx.ellipse(ps.x, platterY, ps.platterWidth / 2, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#BDBDBD';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(ps.x - 6, platterY - 2, ps.platterWidth / 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isStunned) {
      ctx.fillStyle = '#FFEB3B';
      ctx.font = '900 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★ STUNNED ★', ps.x, ps.y - 36);
    }

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(ps.x - 48, ps.y + 36, 96, 32, 6);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 50);
    ctx.font = '700 10px monospace';
    ctx.fillText(`Caught: ${ps.itemsCaught}`, ps.x, ps.y + 62);

    ctx.restore();
  }
}
