import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DominoTile {
  x: number;
  y: number;
  angle: number;
  isToppled: boolean;
  toppleProgress: number; // 0..1
  isGolden: boolean;
}

interface PlayerDominoTrack {
  id: PlayerId;
  waypoints: { x: number; y: number }[];
  dominos: DominoTile[];
  currentIndex: number;
  isToppling: boolean;
  toppleIndex: number;
  toppleTimer: number;
  score: number;
  bellsRung: number;
  hasFinishedPlacing: boolean;
  botReactionTimer: number;
}

export class DominoCascadeGame extends BaseGame {
  private playerTracks: Map<PlayerId, PlayerDominoTrack> = new Map();
  private beatTimer: number = 0;
  private beatInterval: number = 0.42; // ~142 BPM
  private barrierProgress: number = 0; // 0 to 1
  private currentMapName: string = 'Serpentine S-Curves';
  private phase: 'PLACING' | 'TOPPLING' | 'FINISHED' = 'PLACING';

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.phase = 'PLACING';
    this.barrierProgress = 0;
    this.beatTimer = 0;

    const tracks = ['Serpentine S-Curves', 'Double Spiral Circuit', 'Zig-Zag Cascade', 'Looping Roller'];
    this.currentMapName = tracks[Math.floor(Math.random() * tracks.length)];

    this.playerTracks.clear();
    const active = this.getActivePlayers();

    const quadrantW = width / 2;
    const quadrantH = (height - 80) / 2;

    active.forEach((p, idx) => {
      let qx = 20;
      let qy = 80;
      if (idx === 1) qx = quadrantW + 20;
      else if (idx === 2) qy = 80 + quadrantH;
      else if (idx === 3) {
        qx = quadrantW + 20;
        qy = 80 + quadrantH;
      }

      const waypoints = this.generateWaypoints(qx, qy, quadrantW - 40, quadrantH - 30);

      this.playerTracks.set(p.id, {
        id: p.id,
        waypoints,
        dominos: [],
        currentIndex: 0,
        isToppling: false,
        toppleIndex: 0,
        toppleTimer: 0,
        score: 0,
        bellsRung: 0,
        hasFinishedPlacing: false,
        botReactionTimer: 0.15 + Math.random() * 0.2
      });
    });
  }

  private generateWaypoints(
    startX: number,
    startY: number,
    w: number,
    h: number
  ): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    const count = 35;

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      // S-curve winding
      const wx = startX + 30 + (w - 60) * t;
      const wy = startY + h / 2 + Math.sin(t * Math.PI * 3) * (h * 0.35);
      pts.push({ x: wx, y: wy });
    }
    return pts;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.beatTimer += dt;
    if (this.beatTimer >= this.beatInterval) {
      this.beatTimer -= this.beatInterval;
    }

    if (this.phase === 'PLACING') {
      this.roundTimer -= dt;
      this.barrierProgress = 1 - Math.max(0, this.roundTimer / 35.0);

      // Handle Bot AI
      this.updateBots(dt, width, height);

      // Human inputs
      for (const p of this.getActivePlayers()) {
        const pt = this.playerTracks.get(p.id);
        if (!pt || pt.hasFinishedPlacing) continue;

        if (!p.type.startsWith('bot_')) {
          const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);
          if (justPressed) {
            this.layDomino(pt);
          }
        }
      }

      // Check if time up or all finished
      const allDone = Array.from(this.playerTracks.values()).every((t) => t.hasFinishedPlacing);
      if (this.roundTimer <= 0 || allDone) {
        this.roundTimer = 0;
        this.startCascade();
      }
    } else if (this.phase === 'TOPPLING') {
      // Simulate domino topple propagation
      let stillToppling = false;

      for (const pt of this.playerTracks.values()) {
        if (!pt.isToppling) continue;

        pt.toppleTimer += dt;
        const toppleStepTime = 0.055; // fast cascade

        while (pt.toppleTimer >= toppleStepTime && pt.toppleIndex < pt.dominos.length) {
          pt.toppleTimer -= toppleStepTime;
          const currentDom = pt.dominos[pt.toppleIndex];
          currentDom.isToppled = true;
          currentDom.toppleProgress = 1.0;
          pt.score += currentDom.isGolden ? 30 : 10;

          // Emit domino clack sound & particles
          this.audio.playTap();

          if (currentDom.isGolden) {
            pt.bellsRung++;
            this.audio.playChime();
          }

          this.particles.emit(currentDom.x, currentDom.y, 4, currentDom.isGolden ? '#F59E0B' : '#FFFFFF');

          pt.toppleIndex++;
        }

        if (pt.toppleIndex < pt.dominos.length) {
          stillToppling = true;
        } else {
          pt.isToppling = false;
        }
      }

      if (!stillToppling) {
        this.phase = 'FINISHED';
        this.isFinished = true;
        this.audio.playFanfare();
      }
    }
  }

  private layDomino(pt: PlayerDominoTrack): void {
    if (pt.currentIndex >= pt.waypoints.length) {
      pt.hasFinishedPlacing = true;
      return;
    }

    const curPt = pt.waypoints[pt.currentIndex];
    const nextPt = pt.waypoints[Math.min(pt.waypoints.length - 1, pt.currentIndex + 1)];
    const angle = Math.atan2(nextPt.y - curPt.y, nextPt.x - curPt.x);

    // Rhythm accuracy bonus
    const beatPhase = Math.abs(this.beatTimer - this.beatInterval / 2) / (this.beatInterval / 2);
    const isGolden = beatPhase < 0.25 || (pt.currentIndex > 0 && pt.currentIndex % 7 === 0);

    pt.dominos.push({
      x: curPt.x,
      y: curPt.y,
      angle,
      isToppled: false,
      toppleProgress: 0,
      isGolden
    });

    this.audio.playTap();
    pt.currentIndex++;

    if (pt.currentIndex >= pt.waypoints.length) {
      pt.hasFinishedPlacing = true;
      this.audio.playChime();
      // Start intense 6-second final hurry-up countdown for remaining players!
      if (this.roundTimer > 6.0) {
        this.roundTimer = 6.0;
      }
    }
  }

  private startCascade(): void {
    this.phase = 'TOPPLING';
    this.audio.playFanfare();
    for (const pt of this.playerTracks.values()) {
      pt.isToppling = true;
      pt.toppleIndex = 0;
      pt.toppleTimer = 0;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const pt = this.playerTracks.get(botId);
    if (!pt || pt.hasFinishedPlacing) return;

    pt.botReactionTimer -= dt;
    if (pt.botReactionTimer > 0) return;

    // Rhythmic beat syncing for higher difficulty
    const beatPhase = Math.abs(this.beatTimer - this.beatInterval / 2) / (this.beatInterval / 2);
    if (difficulty === 'bot_hard' && beatPhase > 0.35 && pt.currentIndex < pt.waypoints.length - 3) {
      pt.botReactionTimer = 0.08;
      return;
    }

    const baseDelay =
      difficulty === 'bot_easy' ? 0.38 + Math.random() * 0.15 : difficulty === 'bot_normal' ? 0.30 + Math.random() * 0.08 : 0.22 + Math.random() * 0.04;
    pt.botReactionTimer = baseDelay;

    this.layDomino(pt);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Dark Workshop Floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // 2. Header & Countdown
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TRACK: ${this.currentMapName.toUpperCase()} • DOMINO CASCADE RACE`, width / 2, 28);

    const timerSec = Math.ceil(this.roundTimer);
    ctx.fillStyle = this.phase === 'TOPPLING' ? '#10B981' : this.roundTimer < 10 ? '#EF4444' : '#F8FAFC';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(this.phase === 'TOPPLING' ? 'CASCADE TOPPLE!' : `${timerSec}s`, width / 2, 52);

    // 3. Descending Hydraulic Barrier line
    if (this.phase === 'PLACING') {
      const barrierY = 70 + this.barrierProgress * (height - 140);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(10, barrierY);
      ctx.lineTo(width - 10, barrierY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('BARRIER DROPPING ▼', width - 20, barrierY - 6);
    }

    // 4. Render Tracks & Dominos for each player
    for (const p of this.getActivePlayers()) {
      const pt = this.playerTracks.get(p.id);
      if (!pt) continue;

      // Draw guide path
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      pt.waypoints.forEach((wp, idx) => {
        if (idx === 0) ctx.moveTo(wp.x, wp.y);
        else ctx.lineTo(wp.x, wp.y);
      });
      ctx.stroke();

      // Dominos
      for (const dom of pt.dominos) {
        ctx.save();
        ctx.translate(dom.x, dom.y);
        ctx.rotate(dom.angle);

        // Domino body
        const domW = 8;
        const domH = 22;

        if (dom.isToppled) {
          // Flattened
          ctx.fillStyle = dom.isGolden ? '#F59E0B' : p.colorDark;
          ctx.fillRect(-domW / 2, -domH * 0.2, domW * 1.5, 4);
        } else {
          // Standing
          ctx.fillStyle = dom.isGolden ? '#F59E0B' : p.color;
          ctx.fillRect(-domW / 2, -domH / 2, domW, domH);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.strokeRect(-domW / 2, -domH / 2, domW, domH);
        }

        ctx.restore();
      }
    }

    // 5. Corner HUDs
    for (const p of this.getActivePlayers()) {
      const pt = this.playerTracks.get(p.id);
      if (!pt) continue;

      let px = 20;
      let py = 20;
      if (p.corner === 'top-right') px = width - 160;
      else if (p.corner === 'bottom-left') py = height - 90;
      else if (p.corner === 'bottom-right') {
        px = width - 160;
        py = height - 90;
      }

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, 140, 70, 8);
      else ctx.rect(px, py, 140, 70);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 20);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${pt.score} pts`, px + 10, py + 42);

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`Tiles: ${pt.dominos.length}/${pt.waypoints.length}`, px + 10, py + 60);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.playerTracks.get(a.id)?.score || 0;
      const sb = this.playerTracks.get(b.id)?.score || 0;
      return sb - sa;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topScore = this.playerTracks.get(winnerId ?? 0)?.score || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.playerTracks.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Spectacular domino run! Triggered a chain reaction of ${topScore} pts on ${this.currentMapName}!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
