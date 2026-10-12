import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Sarcophagus {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  slideProgress: number; // 0 to 1
  isOpen: boolean;
  contents: 'GOLD' | 'EMERALD' | 'CURSE';
  respawnTimer: number;
}

interface CryptPlayer {
  id: PlayerId;
  x: number;
  y: number;
  score: number;
  stunTimer: number;
  isPushing: boolean;
}

export class TombstoneCryptSliderGame extends BaseGame {
  private playersState: Map<PlayerId, CryptPlayer> = new Map();
  private crypts: Sarcophagus[] = [];

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.playersState.clear();
    this.crypts = [];

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 50,
        score: 0,
        stunTimer: 0,
        isPushing: false
      });
    });

    // 2 rows of 3 sarcophagi
    const cols = 3;
    const rows = 2;
    const cryptW = 90;
    const cryptH = 65;
    const xStep = width / (cols + 1);
    const yStep = (height - 120) / (rows + 1);

    let id = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.crypts.push({
          id: id++,
          x: xStep * (c + 1) - cryptW / 2,
          y: 70 + yStep * (r + 1) - cryptH / 2,
          width: cryptW,
          height: cryptH,
          slideProgress: 0,
          isOpen: false,
          contents: this.randomContent(),
          respawnTimer: 0
        });
      }
    }
  }

  private randomContent(): 'GOLD' | 'EMERALD' | 'CURSE' {
    const r = Math.random();
    if (r < 0.35) return 'GOLD';
    if (r < 0.75) return 'EMERALD';
    return 'CURSE';
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update Sarcophagi respawns
    for (const c of this.crypts) {
      if (c.isOpen) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          c.isOpen = false;
          c.slideProgress = 0;
          c.contents = this.randomContent();
        }
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const pushPressed = this.input.isPressed(p.id);

      ps.isPushing = pushPressed;

      // Movement
      const moveSpeed = pushPressed ? 70 : 160;
      ps.x += steer * moveSpeed * dt;
      ps.y += -throttle * moveSpeed * dt;

      // Keep within arena
      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(50, Math.min(height - 30, ps.y));

      // Check if pushing a sarcophagus lid
      if (pushPressed) {
        for (const c of this.crypts) {
          if (c.isOpen) continue;

          // Distance from player to crypt center
          const cx = c.x + c.width / 2;
          const cy = c.y + c.height / 2;
          const dist = Math.hypot(ps.x - cx, ps.y - cy);

          if (dist < 65) {
            c.slideProgress += dt * 1.3;
            if (Math.random() < 0.15) {
              this.audio.playRopeTension();
            }

            if (c.slideProgress >= 1) {
              c.isOpen = true;
              c.slideProgress = 1;
              c.respawnTimer = 3.5;

              if (c.contents === 'GOLD') {
                ps.score += 3;
                this.audio.playScore();
                this.particles.emit(cx, cy, 18, '#fbbf24');
              } else if (c.contents === 'EMERALD') {
                ps.score += 1;
                this.audio.playChime();
                this.particles.emit(cx, cy, 12, '#34d399');
              } else {
                // Curse
                ps.score = Math.max(0, ps.score - 1);
                ps.stunTimer = 1.2;
                this.audio.playBuzzer();
                this.particles.shake(0.3);
                this.particles.emit(cx, cy, 15, '#ef4444');
              }
            }
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    let nearest: Sarcophagus | null = null;
    let minDist = Infinity;

    for (const c of this.crypts) {
      if (c.isOpen) continue;
      const cx = c.x + c.width / 2;
      const cy = c.y + c.height / 2;
      const dist = Math.hypot(ps.x - cx, ps.y - cy);
      if (dist < minDist) {
        minDist = dist;
        nearest = c;
      }
    }

    if (nearest) {
      let cx = nearest.x + nearest.width / 2;
      let cy = nearest.y + nearest.height / 2;
      if (difficulty === 'bot_easy') {
        cx += (Math.random() - 0.5) * 30;
        cy += (Math.random() - 0.5) * 30;
      }

      const dx = cx - ps.x;
      const dy = cy - ps.y;
      const dist = Math.hypot(dx, dy);

      const openRange = difficulty === 'bot_easy' ? 36 : difficulty === 'bot_normal' ? 46 : 54;
      if (dist < openRange) {
        this.input.setBotInput(botId, true, 0, 0);
      } else {
        this.input.setBotInput(botId, false, dx / dist, -dy / dist);
      }
    } else {
      this.input.setBotInput(botId, false, 0, 0);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Dark Crypt Stone Floor
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, width, height);

    // Stone tile grid lines
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Render Sarcophagi
    for (const c of this.crypts) {
      // Base cavity
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(c.x, c.y, c.width, c.height);

      // Cavity content preview/glow
      const cx = c.x + c.width / 2;
      const cy = c.y + c.height / 2;
      if (c.isOpen) {
        if (c.contents === 'GOLD') {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('+3', cx, cy - 18);
        } else if (c.contents === 'EMERALD') {
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(cx, cy, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#6ee7b7';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('+1', cx, cy - 18);
        } else {
          // Curse skull
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(cx, cy - 2, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(cx - 6, cy + 2, 12, 8);
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(cx - 4, cy - 3, 2.5, 0, Math.PI * 2);
          ctx.arc(cx + 4, cy - 3, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('CURSE!', cx, cy - 18);
        }
      }

      // Stone Slab Lid (slides right as slideProgress increases)
      const slideOffset = c.slideProgress * (c.width - 8);
      ctx.fillStyle = '#57534e';
      ctx.fillRect(c.x + slideOffset, c.y, c.width, c.height);

      // Lid border & engraved cross/runes
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + slideOffset, c.y, c.width, c.height);

      // Carved cross
      ctx.beginPath();
      ctx.moveTo(c.x + slideOffset + c.width / 2, c.y + 12);
      ctx.lineTo(c.x + slideOffset + c.width / 2, c.y + c.height - 12);
      ctx.moveTo(c.x + slideOffset + 18, c.y + 24);
      ctx.lineTo(c.x + slideOffset + c.width - 18, c.y + 24);
      ctx.stroke();

      // Progress bar if partially pushed
      if (c.slideProgress > 0 && !c.isOpen) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(c.x, c.y - 10, c.width, 6);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(c.x, c.y - 10, c.width * c.slideProgress, 6);
      }
    }

    // Render Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Player circle
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hands/Push indicators
      if (ps.isPushing) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-8, -14, 5, 0, Math.PI * 2);
        ctx.arc(8, -14, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stun stars
      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*STUN*', 0, -22);
      }

      ctx.restore();

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 28);
    }

    // HUD
    ctx.fillStyle = 'rgba(12, 10, 9, 0.85)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TOMBSTONE CRYPT SLIDER', 16, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#f8fafc';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 24);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} plundered the crypt treasures!` : 'The crypt seals shut forever!'
    };
  }
}
