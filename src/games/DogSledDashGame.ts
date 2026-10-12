import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface TrailObstacle {
  id: number;
  x: number;
  type: 'crevasse' | 'spruce_log';
  cleared: boolean;
}

interface MusherTeam {
  id: PlayerId;
  laneY: number;
  sledX: number;
  yOffset: number;
  vy: number;
  isJumping: boolean;
  speed: number;
  score: number;
  combo: number;
  stumbleTimer: number;
  gallopAnim: number;
  obstacles: TrailObstacle[];
  nextObsDist: number;
}

export class DogSledDashGame extends BaseGame {
  public mushers: Map<PlayerId, MusherTeam> = new Map();
  public currentMapName: string = 'Iditarod Frozen Tundra';
  private obsIdCounter: number = 0;
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
    this.mushers.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.55;
      this.mushers.set(p.id, {
        id: p.id,
        laneY,
        sledX: 120,
        yOffset: 0,
        vy: 0,
        isJumping: false,
        speed: 160,
        score: 0,
        combo: 0,
        stumbleTimer: 0,
        gallopAnim: 0,
        obstacles: [],
        nextObsDist: 170,
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

    const baseScroll = 190;

    this.mushers.forEach((m) => {
      const p = this.getPlayer(m.id);

      if (m.stumbleTimer > 0) m.stumbleTimer -= dt;
      m.gallopAnim += dt * 14;

      // Human input: MUSH! Leap across obstacle
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(m.id) || this.input.justAction(m.id);
        if (justPressed && !m.isJumping && m.stumbleTimer <= 0) {
          this.executeMushLeap(m);
        }
      }

      // Sled jump physics
      if (m.isJumping) {
        m.yOffset += m.vy * dt;
        m.vy += 850 * dt;
        if (m.yOffset >= 0) {
          m.yOffset = 0;
          m.vy = 0;
          m.isJumping = false;
          this.particles.emit(m.sledX, m.laneY + 8, 8, '#ffffff');
        }
      }

      // Spawning trail obstacles
      m.nextObsDist -= (baseScroll + m.speed * 0.4) * dt;
      if (m.nextObsDist <= 0) {
        m.obstacles.push({
          id: ++this.obsIdCounter,
          x: width + 40,
          type: Math.random() < 0.5 ? 'crevasse' : 'spruce_log',
          cleared: false,
        });
        m.nextObsDist = 160 + Math.random() * 130;
      }

      // Update obstacles
      for (let i = m.obstacles.length - 1; i >= 0; i--) {
        const obs = m.obstacles[i];
        obs.x -= (baseScroll + m.speed * 0.4) * dt;

        // Collision with sled team
        const dx = Math.abs(obs.x - (m.sledX + 25)); // checking husky leader dog position
        if (dx < 30 && !obs.cleared) {
          if (m.yOffset > -22) {
            // CRASHED INTO CREVASSE / LOG!
            obs.cleared = true;
            m.stumbleTimer = 0.8;
            m.combo = 0;
            m.speed = 70;
            m.score = Math.max(0, m.score - 20);
            this.audio.playTone(130, 0.25, 'sawtooth');
            this.particles.emit(m.sledX + 20, m.laneY, 16, '#c0392b');
          } else {
            // MUSH LEAP OVER CREVASSE!
            obs.cleared = true;
            m.score += 35 + m.combo * 3;
            m.combo++;
            m.speed = Math.min(320, m.speed + 35);
            this.audio.playTone(680, 0.1, 'sine');
            this.particles.emit(obs.x, m.laneY, 10, '#00e5ff');
          }
        }

        if (obs.x < -60) {
          m.obstacles.splice(i, 1);
        }
      }
    });
  }

  private executeMushLeap(m: MusherTeam): void {
    m.isJumping = true;
    m.vy = -380;
    this.audio.playTone(520, 0.08, 'triangle');
    this.particles.emit(m.sledX - 10, m.laneY + 6, 10, '#e0f7fa');
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const m = this.mushers.get(botId);
    if (!m || m.isJumping || m.stumbleTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const lookahead = difficulty === 'bot_hard' ? 95 : difficulty === 'bot_normal' ? 75 : 55;
      const upcoming = m.obstacles.find((ob) => !ob.cleared && ob.x > m.sledX && ob.x < m.sledX + lookahead);
      if (upcoming) {
        this.executeMushLeap(m);
        bTimer = difficulty === 'bot_hard' ? 0.35 : 0.55;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Frozen tundra snowscape
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1c2833');
    bgGrad.addColorStop(0.5, '#2e4053');
    bgGrad.addColorStop(1, '#1b2631');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    this.mushers.forEach((m, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#e67e22';

      // Snow trail
      ctx.fillStyle = '#ebf5fb';
      ctx.fillRect(0, m.laneY + 8, width, 6);
      ctx.fillStyle = '#d4e6f1';
      ctx.fillRect(0, m.laneY + 14, width, laneHeight - 18);

      // Track dividers
      ctx.strokeStyle = '#aed6f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, m.laneY - laneHeight * 0.45);
      ctx.lineTo(width, m.laneY - laneHeight * 0.45);
      ctx.stroke();

      // Obstacles
      m.obstacles.forEach((ob) => {
        if (ob.cleared) return;
        if (ob.type === 'crevasse') {
          // Bottomless blue glacial crevasse
          ctx.fillStyle = '#0f2027';
          ctx.beginPath();
          ctx.roundRect(ob.x - 14, m.laneY + 6, 28, 14, 3);
          ctx.fill();
          ctx.strokeStyle = '#3498db';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Fallen spruce log
          ctx.fillStyle = '#5d4037';
          ctx.beginPath();
          ctx.roundRect(ob.x - 10, m.laneY - 8, 20, 16, 4);
          ctx.fill();
        }
      });

      // Musher Sled Team
      const sx = m.sledX;
      const sy = m.laneY + m.yOffset;

      ctx.save();
      ctx.translate(sx, sy);

      if (m.stumbleTimer > 0) {
        ctx.rotate(0.25);
      }

      // Wooden Sled
      ctx.fillStyle = '#6e2c00';
      ctx.beginPath();
      ctx.roundRect(-22, -10, 24, 12, 3);
      ctx.fill();
      // Metal runners
      ctx.strokeStyle = '#bdc3c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-26, 4);
      ctx.lineTo(6, 4);
      ctx.quadraticCurveTo(12, 4, 12, -2);
      ctx.stroke();

      // Musher standing on sled
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-16, -24, 14, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#f5cba7';
      ctx.beginPath();
      ctx.arc(-9, -28, 6, 0, Math.PI * 2);
      ctx.fill();

      // Husky Dogs gallop (2 huskies in tandem ahead)
      const dogLegOffset = Math.sin(m.gallopAnim) * 5;
      const dogOffsets = [24, 46];

      dogOffsets.forEach((dx) => {
        // Husky gray body
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.roundRect(dx - 8, -8, 16, 10, 3);
        ctx.fill();
        // White chest
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(dx + 6, -4, 4, 0, Math.PI * 2);
        ctx.fill();
        // Head & ears
        ctx.fillStyle = '#34495e';
        ctx.beginPath();
        ctx.arc(dx + 8, -9, 4, 0, Math.PI * 2);
        ctx.fill();

        // Galloping legs
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(dx - 5, 2);
        ctx.lineTo(dx - 5 - dogLegOffset, 8);
        ctx.moveTo(dx + 5, 2);
        ctx.lineTo(dx + 5 + dogLegOffset, 8);
        ctx.stroke();
      });

      // Harness lines connecting dogs to sled
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, -2);
      ctx.lineTo(54, -2);
      ctx.stroke();

      ctx.restore();

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name ?? pId}: ${m.score} pts`, 16, m.laneY - laneHeight * 0.2);
      if (m.combo > 1) {
        ctx.fillStyle = '#00e676';
        ctx.fillText(`${m.combo}x MUSH STREAK!`, 130, m.laneY - laneHeight * 0.2);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐕 TAP TO MUSH LEAP OVER CREVASSES & SPRUCE LOGS!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.mushers.forEach((m, pId) => scores.set(pId, m.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.mushers.entries())
      .map(([playerId, m]) => ({ playerId, score: m.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} led the dog sled team across the Iditarod finish line!` : 'Sleds crashed in the snow!',
    };
  }
}
