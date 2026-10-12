import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface TreasureGem {
  id: number;
  x: number;
  y: number;
  type: 'RUBY' | 'EMERALD' | 'DIAMOND';
  points: number;
  color: string;
  isTaken: boolean;
}

interface PlayerHand {
  id: PlayerId;
  baseX: number;
  baseY: number;
  handX: number;
  handY: number;
  isReaching: boolean;
  lives: number; // 3 lives
  score: number;
  gemsGrabbed: number;
  heldGem: TreasureGem | null;
  stunTimer: number;
  botReactionTimer: number;
}

export class ChestSnatchGame extends BaseGame {
  private playersState: Map<PlayerId, PlayerHand> = new Map();
  private gems: TreasureGem[] = [];
  private chestState: 'OPENING' | 'OPEN' | 'WARNING' | 'SHUT' = 'OPENING';
  private chestTimer: number = 1.5;
  private chestJawOpen: number = 0; // 0 (closed) to 1 (wide open)
  private currentMapName: string = 'Pirate Mimic Vault';
  private gemCounter: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 50.0;
    this.isFinished = false;
    this.chestState = 'OPENING';
    this.chestTimer = 1.2;
    this.chestJawOpen = 0;

    const maps = ['Pirate Mimic Vault', 'Gilded Pharaoh Chest', 'Dungeon Cursed Maw', 'Sunken Galleon Locker'];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];

    this.setupPlayers(width, height);
    this.spawnTreasureGems(width, height);
  }

  private setupPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();

    const spawnCorners = [
      { x: 90, y: 120 },
      { x: width - 90, y: 120 },
      { x: 90, y: height - 80 },
      { x: width - 90, y: height - 80 }
    ];

    active.forEach((p, idx) => {
      const sp = spawnCorners[idx % spawnCorners.length];
      this.playersState.set(p.id, {
        id: p.id,
        baseX: sp.x,
        baseY: sp.y,
        handX: sp.x,
        handY: sp.y,
        isReaching: false,
        lives: 3,
        score: 0,
        gemsGrabbed: 0,
        heldGem: null,
        stunTimer: 0,
        botReactionTimer: 0.15 + Math.random() * 0.15
      });
    });
  }

  private spawnTreasureGems(width: number, height: number): void {
    this.gems = [];
    const cx = width / 2;
    const cy = height / 2 + 10;
    const types: ('RUBY' | 'EMERALD' | 'DIAMOND')[] = ['RUBY', 'RUBY', 'EMERALD', 'EMERALD', 'DIAMOND'];

    for (let i = 0; i < 14; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const pts = t === 'DIAMOND' ? 50 : t === 'EMERALD' ? 25 : 10;
      const col = t === 'DIAMOND' ? '#38BDF8' : t === 'EMERALD' ? '#10B981' : '#EF4444';

      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 45;

      this.gems.push({
        id: ++this.gemCounter,
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        type: t,
        points: pts,
        color: col,
        isTaken: false
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    const cx = width / 2;
    const cy = height / 2 + 10;

    // Chest State Machine
    this.chestTimer -= dt;

    if (this.chestState === 'OPENING') {
      this.chestJawOpen = Math.min(1.0, this.chestJawOpen + dt * 2.2);
      if (this.chestTimer <= 0) {
        this.chestState = 'OPEN';
        this.chestTimer = 1.5 + Math.random() * 2.0; // stays open for a while
      }
    } else if (this.chestState === 'OPEN') {
      this.chestJawOpen = 1.0;
      if (this.chestTimer <= 0) {
        this.chestState = 'WARNING';
        this.chestTimer = 0.45; // teeth chattering warning
        this.audio.playTap();
      }
    } else if (this.chestState === 'WARNING') {
      // Chatter animation
      this.chestJawOpen = 0.85 + Math.sin(Date.now() * 0.04) * 0.15;
      if (this.chestTimer <= 0) {
        // CHOMP! Clamp shut!
        this.chestState = 'SHUT';
        this.chestJawOpen = 0;
        this.chestTimer = 1.0; // stays shut for 1s
        this.audio.playBounce();

        // Check if any hands got chomped
        for (const ps of this.playersState.values()) {
          if (ps.lives > 0) {
            // Hand inside chest! CHOMP!
            const d = Math.hypot(ps.handX - cx, ps.handY - cy);
            if (d < 70) {
              ps.lives--;
              ps.stunTimer = 2.0;
              ps.isReaching = false;
              if (ps.heldGem) {
                ps.heldGem.isTaken = false;
                ps.heldGem = null;
              }
              this.audio.playLaser();
              this.particles.emit(ps.handX, ps.handY, 14, '#EF4444');
            }
          }
        }
      }
    } else if (this.chestState === 'SHUT') {
      this.chestJawOpen = 0;
      if (this.chestTimer <= 0) {
        this.chestState = 'OPENING';
        this.chestTimer = 0.8;
        // Refill taken gems
        if (this.gems.filter((g) => !g.isTaken).length < 5) {
          this.spawnTreasureGems(width, height);
        }
      }
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update Player Hands
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || ps.lives <= 0) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        ps.isReaching = false;
      }

      if (!p.type.startsWith('bot_')) {
        const isPressed = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);
        const wasJustReleased = this.input.justReleased(p.id);

        if (isPressed && ps.stunTimer <= 0 && !ps.heldGem) {
          ps.isReaching = true;
        } else if (wasJustReleased || ps.heldGem) {
          ps.isReaching = false;
        }
      }

      // Hand extension toward chest center
      if (ps.isReaching && ps.stunTimer <= 0 && !ps.heldGem) {
        ps.handX += (cx - ps.handX) * Math.min(1, dt * 10);
        ps.handY += (cy - ps.handY) * Math.min(1, dt * 10);

        // Check grabbing nearest gem if chest is open
        if (this.chestJawOpen > 0.4) {
          for (const g of this.gems) {
            if (g.isTaken) continue;
            const dist = Math.hypot(ps.handX - g.x, ps.handY - g.y);
            if (dist < 22) {
              g.isTaken = true;
              ps.heldGem = g;
              ps.isReaching = false; // Auto-retract with gem
              this.audio.playTap();
              this.particles.emit(g.x, g.y, 6, g.color);
              break;
            }
          }
        }
      } else {
        // Retract to base
        ps.handX += (ps.baseX - ps.handX) * Math.min(1, dt * 11);
        ps.handY += (ps.baseY - ps.handY) * Math.min(1, dt * 11);

        // Bank gem when hand arrives safely at base!
        if (ps.heldGem) {
          const distBase = Math.hypot(ps.handX - ps.baseX, ps.handY - ps.baseY);
          if (distBase < 20) {
            ps.gemsGrabbed++;
            ps.score += ps.heldGem.points;
            this.audio.playChime();
            this.particles.emit(ps.baseX, ps.baseY, 10, ps.heldGem.color);
            ps.heldGem = null;
          }
        }
      }
    }

    // Check last player alive
    const alive = Array.from(this.playersState.values()).filter((p) => p.lives > 0);
    if (alive.length <= 1 && this.getActivePlayers().length > 1) {
      if (alive.length === 1) alive[0].score += 150;
      this.isFinished = true;
      this.audio.playFanfare();
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
    if (!ps || ps.lives <= 0 || ps.stunTimer > 0) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const baseDelay =
      difficulty === 'bot_easy' ? 0.28 : difficulty === 'bot_normal' ? 0.15 : 0.06;
    ps.botReactionTimer = baseDelay;

    if (ps.heldGem) {
      ps.isReaching = false; // Retract to bank
      return;
    }

    if (this.chestState === 'OPEN') {
      ps.isReaching = true;
    } else if (this.chestState === 'WARNING') {
      // Pull back right before snap!
      if (difficulty === 'bot_hard') {
        ps.isReaching = false;
      } else if (difficulty === 'bot_normal') {
        ps.isReaching = Math.random() < 0.2; // 20% greedy risk
      } else {
        ps.isReaching = Math.random() < 0.55; // Easy gets greedy and chomped
      }
    } else {
      ps.isReaching = false;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Dark Dungeon Floor
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2 + 10;

    // 2. Giant Treasure Chest (Mimic)
    const chestW = 150;
    const chestH = 110;

    // Chest Body (Lower base)
    ctx.fillStyle = '#78350F';
    ctx.fillRect(cx - chestW / 2, cy - 20, chestW, chestH / 2 + 20);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - chestW / 2, cy - 20, chestW, chestH / 2 + 20);

    // Gold trim straps
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(cx - chestW / 2 + 24, cy - 20, 10, chestH / 2 + 20);
    ctx.fillRect(cx + chestW / 2 - 34, cy - 20, 10, chestH / 2 + 20);

    // Treasure Gems inside chest
    for (const g of this.gems) {
      if (g.isTaken) continue;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Razor sharp teeth
    const toothCount = 7;
    const toothW = chestW / toothCount;
    ctx.fillStyle = '#F8FAFC';
    for (let t = 0; t < toothCount; t++) {
      const tx = cx - chestW / 2 + t * toothW;
      ctx.beginPath();
      ctx.moveTo(tx, cy - 20);
      ctx.lineTo(tx + toothW / 2, cy - 5);
      ctx.lineTo(tx + toothW, cy - 20);
      ctx.fill();
    }

    // Hinged Upper Chest Lid
    const lidLift = this.chestJawOpen * 65;
    ctx.fillStyle = '#451A03';
    ctx.fillRect(cx - chestW / 2, cy - 40 - lidLift, chestW, 26);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - chestW / 2, cy - 40 - lidLift, chestW, 26);

    // Glowing Mimic Eye on Lid
    ctx.fillStyle = this.chestState === 'WARNING' ? '#EF4444' : '#F59E0B';
    ctx.beginPath();
    ctx.arc(cx, cy - 27 - lidLift, 7, 0, Math.PI * 2);
    ctx.fill();

    // 3. Player Mechanical Grabber Arms
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Arm segment line
      ctx.strokeStyle = ps.lives > 0 ? p.color : '#64748B';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ps.baseX, ps.baseY);
      ctx.lineTo(ps.handX, ps.handY);
      ctx.stroke();

      // Hand claw
      ctx.fillStyle = ps.lives > 0 ? p.colorDark : '#334155';
      ctx.beginPath();
      ctx.arc(ps.handX, ps.handY, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Held Gem in claw
      if (ps.heldGem) {
        ctx.fillStyle = ps.heldGem.color;
        ctx.beginPath();
        ctx.arc(ps.handX, ps.handY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Base stand
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(ps.baseX, ps.baseY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 4. Header & Timer
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`VAULT: ${this.currentMapName.toUpperCase()} • MIMIC CHEST SNATCH`, width / 2, 28);

    const timerSec = Math.ceil(this.roundTimer);
    ctx.fillStyle = this.chestState === 'WARNING' ? '#EF4444' : '#F8FAFC';
    ctx.font = 'bold 20px monospace';
    const statusText =
      this.chestState === 'WARNING'
        ? 'TEETH CHATTERING! PULL BACK!'
        : this.chestState === 'SHUT'
        ? 'CHOMP! JAW SHUT!'
        : `${timerSec}s`;
    ctx.fillText(statusText, width / 2, 52);

    // 5. Corner HUDs
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      let px = 20;
      let py = 20;
      if (p.corner === 'top-right') px = width - 160;
      else if (p.corner === 'bottom-left') py = height - 90;
      else if (p.corner === 'bottom-right') {
        px = width - 160;
        py = height - 90;
      }

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = ps.lives > 0 ? p.color : '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, 140, 70, 8);
      else ctx.rect(px, py, 140, 70);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ps.lives > 0 ? p.color : '#94A3B8';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 20);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${ps.score} pts`, px + 10, py + 42);

      // Lives
      ctx.font = 'bold 12px sans-serif';
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = l < ps.lives ? '#EF4444' : '#475569';
        ctx.fillText('❤', px + 10 + l * 15, py + 60);
      }

      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('STUNNED!', px + 65, py + 60);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.playersState.get(a.id);
      const sb = this.playersState.get(b.id);
      if (!sa || !sb) return 0;
      if (sa.lives !== sb.lives) {
        return sb.lives - sa.lives;
      }
      return sb.score - sa.score;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topScore = this.playersState.get(winnerId ?? 0)?.score || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.playersState.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Loot bandit! Snitched ${topScore} pts in jewels right out of the jaws of the mimic!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
