import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface IcepackBlock {
  id: number;
  x: number;
  thickness: 'thin' | 'glacial_wall';
  shattered: boolean;
}

interface IcebreakerVessel {
  id: PlayerId;
  laneY: number;
  shipX: number;
  ramPower: number; // 0 to 100
  powerDir: number;
  speed: number;
  score: number;
  combo: number;
  ramAnim: number;
  stallTimer: number;
  icepacks: IcepackBlock[];
  nextPackDist: number;
}

export class IcebergBreakerGame extends BaseGame {
  public vessels: Map<PlayerId, IcebreakerVessel> = new Map();
  public currentMapName: string = 'Svalbard Pack Ice Passage';
  private packIdCounter: number = 0;
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
    this.vessels.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.55;
      this.vessels.set(p.id, {
        id: p.id,
        laneY,
        shipX: 110,
        ramPower: 20,
        powerDir: 1,
        speed: 130,
        score: 0,
        combo: 0,
        ramAnim: 0,
        stallTimer: 0,
        icepacks: [],
        nextPackDist: 170,
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

    const baseScroll = 150;

    this.vessels.forEach((v) => {
      const p = this.getPlayer(v.id);

      if (v.stallTimer > 0) v.stallTimer -= dt;
      if (v.ramAnim > 0) v.ramAnim = Math.max(0, v.ramAnim - dt * 4);

      // Oscillate turbine ram power
      v.ramPower += v.powerDir * 160 * dt;
      if (v.ramPower > 100) {
        v.ramPower = 100;
        v.powerDir = -1;
      } else if (v.ramPower < 0) {
        v.ramPower = 0;
        v.powerDir = 1;
      }

      // Human input
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(v.id) || this.input.justAction(v.id);
        if (justPressed && v.stallTimer <= 0) {
          this.executeRamSurge(v);
        }
      }

      // Natural drag
      v.speed = Math.max(90, v.speed - 30 * dt);

      // Spawning Ice Packs
      v.nextPackDist -= (baseScroll + v.speed * 0.4) * dt;
      if (v.nextPackDist <= 0) {
        v.icepacks.push({
          id: ++this.packIdCounter,
          x: width + 40,
          thickness: Math.random() < 0.4 ? 'glacial_wall' : 'thin',
          shattered: false,
        });
        v.nextPackDist = 180 + Math.random() * 120;
      }

      // Update icepacks
      for (let i = v.icepacks.length - 1; i >= 0; i--) {
        const pack = v.icepacks[i];
        pack.x -= (baseScroll + v.speed * 0.4) * dt;

        // Collision with ship prow
        if (!pack.shattered && pack.x <= v.shipX + 38 && pack.x >= v.shipX - 10) {
          if (v.ramAnim > 0.3 || v.speed > 210) {
            // SHATTERED THE ICE SHEET!
            pack.shattered = true;
            const pts = pack.thickness === 'glacial_wall' ? 45 : 25;
            v.score += pts + v.combo * 4;
            v.combo++;
            v.speed = Math.min(300, v.speed + 40);
            this.audio.playTone(720, 0.15, 'triangle');
            this.particles.emit(pack.x, v.laneY, 20, '#d4e6f1');
          } else {
            // Stalled against thick ice pack!
            pack.shattered = true;
            v.stallTimer = 0.9;
            v.speed = 60;
            v.combo = 0;
            v.score = Math.max(0, v.score - 20);
            this.audio.playTone(110, 0.3, 'sawtooth');
            this.particles.emit(v.shipX + 30, v.laneY, 14, '#e74c3c');
          }
        }

        if (pack.x < -60) {
          v.icepacks.splice(i, 1);
        }
      }
    });
  }

  private executeRamSurge(v: IcebreakerVessel): void {
    v.ramAnim = 1.0;

    // Peak sweet spot is 72% to 94%
    if (v.ramPower >= 72 && v.ramPower <= 94) {
      v.speed = Math.min(340, v.speed + 100);
      v.score += 20 + v.combo * 2;
      v.combo++;
      this.audio.playTone(840, 0.12, 'sine');
      this.particles.emit(v.shipX + 40, v.laneY, 16, '#00e5ff');
    } else {
      v.speed = Math.min(260, v.speed + 40);
      this.audio.playTone(320, 0.08, 'triangle');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const v = this.vessels.get(botId);
    if (!v || v.stallTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const upcomingPack = v.icepacks.find((p) => !p.shattered && p.x > v.shipX && p.x < v.shipX + 90);
      if (upcomingPack) {
        const sweetMin = difficulty === 'bot_hard' ? 70 : difficulty === 'bot_normal' ? 62 : 45;
        if (v.ramPower >= sweetMin && v.ramPower <= 96) {
          this.executeRamSurge(v);
          bTimer = 0.55;
        }
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Arctic ocean pack ice background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0f2027');
    bgGrad.addColorStop(0.5, '#203a43');
    bgGrad.addColorStop(1, '#132832');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    this.vessels.forEach((v, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#c0392b';

      // Frozen pack ice shipping channel
      ctx.fillStyle = '#a9cce3';
      ctx.fillRect(0, v.laneY + 12, width, 6);
      ctx.fillStyle = '#1b3245';
      ctx.fillRect(0, v.laneY + 18, width, laneHeight - 20);

      // Track separator
      ctx.strokeStyle = '#0e1c24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, v.laneY - laneHeight * 0.45);
      ctx.lineTo(width, v.laneY - laneHeight * 0.45);
      ctx.stroke();

      // Icepack Obstacles
      v.icepacks.forEach((pack) => {
        if (pack.shattered) return;
        const isWall = pack.thickness === 'glacial_wall';
        ctx.fillStyle = isWall ? '#ebf5fb' : '#d4e6f1';
        ctx.beginPath();
        ctx.roundRect(pack.x - 14, v.laneY - (isWall ? 26 : 14), isWall ? 28 : 20, isWall ? 42 : 28, 4);
        ctx.fill();
        ctx.strokeStyle = '#5dade2';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Icebreaker Ship
      ctx.save();
      ctx.translate(v.shipX, v.laneY);

      if (v.stallTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }

      // Reinforced Red Hull
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-35, -12);
      ctx.lineTo(30, -12);
      ctx.lineTo(44, 4);
      ctx.lineTo(30, 16);
      ctx.lineTo(-35, 16);
      ctx.closePath();
      ctx.fill();

      // Reinforced Steel Prow rammer
      ctx.fillStyle = '#7f8c8d';
      ctx.beginPath();
      ctx.moveTo(30, -12);
      ctx.lineTo(44, 4);
      ctx.lineTo(30, 16);
      ctx.closePath();
      ctx.fill();

      // Bridge superstructure
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(-15, -24, 26, 12);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(-5, -20, 12, 5);

      // Ramming shockwave animation
      if (v.ramAnim > 0) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(44, 4, 18 * (1 - v.ramAnim + 0.3), -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }

      ctx.restore();

      // Power Gauge Bar over ship
      const barW = 60;
      const barH = 6;
      const barX = v.shipX - barW / 2;
      const barY = v.laneY - 32;

      ctx.fillStyle = '#1c2833';
      ctx.fillRect(barX, barY, barW, barH);

      // Green sweet spot (72% to 94%)
      ctx.fillStyle = 'rgba(0, 230, 118, 0.4)';
      ctx.fillRect(barX + barW * 0.72, barY, barW * 0.22, barH);

      // Power needle / fill
      ctx.fillStyle = v.ramPower > 72 && v.ramPower < 94 ? '#00e676' : '#f39c12';
      ctx.fillRect(barX, barY, (barW * v.ramPower) / 100, barH);

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name ?? pId}: ${v.score} pts`, 16, v.laneY - laneHeight * 0.2);
      if (v.combo > 1) {
        ctx.fillStyle = '#00e676';
        ctx.fillText(`${v.combo}x RAM STREAK`, 130, v.laneY - laneHeight * 0.2);
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
    ctx.fillText('🚢 TAP AT GREEN RAM ZONE TO CRUSH ARCTIC ICEPACKS!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.vessels.forEach((v, pId) => scores.set(pId, v.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.vessels.entries())
      .map(([playerId, v]) => ({ playerId, score: v.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} plowed clean through the Arctic pack ice!` : 'Icebreakers crushed by the glacier!',
    };
  }
}
