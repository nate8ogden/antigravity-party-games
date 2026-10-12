import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CodeRainColumn {
  x: number;
  y: number;
  speed: number;
  chars: string[];
}

interface MatrixItem {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: 'KEY' | 'GLITCH';
  points: number;
}

interface HackerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  score: number;
  buffer: number;
  stunTimer: number;
}

export class MatrixCodeRainGame extends BaseGame {
  private playersState: Map<PlayerId, HackerPlayer> = new Map();
  private columns: CodeRainColumn[] = [];
  private items: MatrixItem[] = [];
  private nextItemId: number = 1;
  private spawnTimer: number = 0;

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
    this.columns = [];
    this.items = [];
    this.nextItemId = 1;
    this.spawnTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 45,
        score: 0,
        buffer: 0,
        stunTimer: 0
      });
    });

    // Create 18 rain columns
    const colCount = Math.floor(width / 24);
    const glyphs = ['0', '1', 'F', 'A', '8', 'C', 'X', '7', '9', 'E', 'B'];
    for (let c = 0; c < colCount; c++) {
      const charList: string[] = [];
      for (let i = 0; i < 12; i++) {
        charList.push(glyphs[Math.floor(Math.random() * glyphs.length)]);
      }
      this.columns.push({
        x: c * 24 + 12,
        y: Math.random() * height,
        speed: 90 + Math.random() * 120,
        chars: charList
      });
    }

    for (let i = 0; i < 4; i++) {
      this.spawnItem(width);
    }
  }

  private spawnItem(width: number): void {
    const isKey = Math.random() < 0.65;
    this.items.push({
      id: this.nextItemId++,
      x: 30 + Math.random() * (width - 60),
      y: -20,
      vy: isKey ? 100 + Math.random() * 50 : 130 + Math.random() * 60,
      type: isKey ? 'KEY' : 'GLITCH',
      points: isKey ? 3 : -2
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update Rain Columns
    for (const col of this.columns) {
      col.y += col.speed * dt;
      if (col.y > height + 180) {
        col.y = -60;
        col.speed = 90 + Math.random() * 120;
      }
    }

    // Spawn falling items
    this.spawnTimer += dt;
    if (this.spawnTimer > 0.65) {
      this.spawnTimer = 0;
      this.spawnItem(width);
    }

    // Update Items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.y += it.vy * dt;

      if (it.y > height + 20) {
        this.items.splice(i, 1);
        continue;
      }

      // Check player collection
      for (const p of this.getActivePlayers()) {
        const ps = this.playersState.get(p.id);
        if (!ps || ps.stunTimer > 0) continue;

        if (Math.hypot(ps.x - it.x, ps.y - it.y) < 22) {
          if (it.type === 'KEY') {
            ps.score += it.points;
            ps.buffer += 25;
            this.audio.playChime();
            this.particles.emit(it.x, it.y, 12, '#fbbf24');

            // Buffer Overflow Mega Decrypt!
            if (ps.buffer >= 100) {
              ps.buffer = 0;
              ps.score += 10;
              this.audio.playScore();
              this.particles.emit(ps.x, ps.y, 20, '#22c55e');
            }
          } else {
            // Corrupt glitch
            ps.score = Math.max(0, ps.score + it.points);
            ps.buffer = 0;
            ps.stunTimer = 1.0;
            this.audio.playBuzzer();
            this.particles.shake(0.3);
            this.particles.emit(it.x, it.y, 14, '#ef4444');
          }
          this.items.splice(i, 1);
          break;
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
      ps.x += steer * 230 * dt;
      ps.x = Math.max(25, Math.min(width - 25, ps.x));
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

    // Avoid glitches nearby
    const canDodge = difficulty === 'bot_easy' ? Math.random() < 0.65 : true;
    if (canDodge) {
      for (const it of this.items) {
        if (it.type === 'GLITCH' && Math.abs(it.x - ps.x) < 30 && it.y < ps.y && ps.y - it.y < 80) {
          const dodgeDir = ps.x < it.x ? -1 : 1;
          this.input.setBotInput(botId, false, dodgeDir, 0);
          return;
        }
      }
    }

    // Seek closest key
    let nearestKey: MatrixItem | null = null;
    let minDist = Infinity;
    for (const it of this.items) {
      if (it.type === 'KEY' && it.y < ps.y) {
        const d = Math.abs(it.x - ps.x) + (ps.y - it.y) * 0.5;
        if (d < minDist) {
          minDist = d;
          nearestKey = it;
        }
      }
    }

    if (nearestKey) {
      const dx = nearestKey.x - ps.x;
      const deadzone = difficulty === 'bot_easy' ? 20 : difficulty === 'bot_normal' ? 10 : 4;
      if (Math.abs(dx) > deadzone) {
        this.input.setBotInput(botId, true, Math.sign(dx), 0);
      } else {
        this.input.setBotInput(botId, false, 0, 0);
      }
    } else {
      this.input.setBotInput(botId, false, 0, 0);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Pure Terminal Black Screen
    ctx.fillStyle = '#020b05';
    ctx.fillRect(0, 0, width, height);

    // Falling Digital Rain Columns
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';

    for (const col of this.columns) {
      for (let i = 0; i < col.chars.length; i++) {
        const charY = col.y - i * 16;
        if (charY > 40 && charY < height) {
          // Leading character is bright white, trailing is fading phosphor green
          if (i === 0) {
            ctx.fillStyle = '#f0fdf4';
          } else {
            const alpha = Math.max(0.15, 1 - i * 0.08);
            ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
          }
          ctx.fillText(col.chars[i], col.x, charY);
        }
      }
    }

    // Render Falling Items (Golden Keys and Corrupt Glitches)
    for (const it of this.items) {
      ctx.save();
      ctx.translate(it.x, it.y);

      if (it.type === 'KEY') {
        // Glowing Golden Cipher Key
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, -4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-2, 0, 4, 10);
        ctx.fillRect(0, 4, 4, 3);
        ctx.fillRect(0, 8, 4, 3);
      } else {
        // Corrupt Red Glitch Matrix Fragment
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillStyle = '#000000';
        ctx.fillRect(-2, -2, 4, 4);
      }

      ctx.restore();
    }

    // Render Players (Hacker Collector Baseline)
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Terminal collector dock
      ctx.fillStyle = p.color;
      ctx.fillRect(-16, -6, 32, 12);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-16, -6, 32, 12);

      // Decryption Buffer Bar
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-14, -4, 28 * (ps.buffer / 100), 8);

      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*GLITCH*', 0, -18);
      }

      ctx.restore();

      // Score
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 22);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(2, 11, 5, 0.9)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('MATRIX CODE RAIN // CIPHER', 16, 24);

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
      mvpHighlight: winnerId ? `${winnerId} decrypted the matrix code stream!` : 'Terminal connection closed!'
    };
  }
}
