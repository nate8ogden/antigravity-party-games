import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MineTile {
  col: number;
  row: number;
  hasMine: boolean;
  revealed: boolean;
  adjacentMines: number;
  detonateTimer: number; // >0 if stepped on
  exploded: boolean;
}

interface DashPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  stunTimer: number;
  aimAngle: number;
  sweepDir: number;
}

export class MinefieldDashGame extends BaseGame {
  private playersState: Map<PlayerId, DashPlayer> = new Map();
  private grid: MineTile[][] = [];
  private cols: number = 10;
  private rows: number = 7;
  private tileW: number = 60;
  private tileH: number = 55;
  private gridStartX: number = 0;
  private gridStartY: number = 0;
  private coreTargetY: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.playersState.clear();

    this.cols = Math.min(11, Math.max(8, Math.floor((width - 120) / 60)));
    this.rows = Math.min(8, Math.max(6, Math.floor((height - 180) / 55)));
    this.tileW = Math.floor((width - 140) / this.cols);
    this.tileH = Math.floor((height - 180) / this.rows);
    this.gridStartX = (width - this.cols * this.tileW) / 2;
    this.gridStartY = 90;
    this.coreTargetY = this.gridStartY - 20;

    this.generateMinefield();

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = this.gridStartX + (idx + 1) * (this.cols * this.tileW) / (active.length + 1);
      const startY = this.gridStartY + this.rows * this.tileH + 25;

      this.playersState.set(p.id, {
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        score: 0,
        stunTimer: 0,
        aimAngle: -Math.PI / 2,
        sweepDir: 1
      });
    });
  }

  private generateMinefield() {
    this.grid = [];
    const mineDensity = 0.20; // 20% of tiles are mines

    for (let c = 0; c < this.cols; c++) {
      this.grid[c] = [];
      for (let r = 0; r < this.rows; r++) {
        // Safe starting and ending buffer rows
        const isSafeRow = r === 0 || r === this.rows - 1;
        const hasMine = !isSafeRow && Math.random() < mineDensity;
        this.grid[c][r] = {
          col: c,
          row: r,
          hasMine,
          revealed: false,
          adjacentMines: 0,
          detonateTimer: 0,
          exploded: false
        };
      }
    }

    // Solvability guarantee: Ensure every row has at least 2 guaranteed safe tiles
    for (let r = 1; r < this.rows - 1; r++) {
      let safeCount = 0;
      for (let c = 0; c < this.cols; c++) {
        if (!this.grid[c][r].hasMine) safeCount++;
      }
      while (safeCount < 2) {
        const randC = Math.floor(Math.random() * this.cols);
        if (this.grid[randC][r].hasMine) {
          this.grid[randC][r].hasMine = false;
          safeCount++;
        }
      }
    }

    // Compute adjacent mines
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        if (this.grid[c][r].hasMine) continue;
        let count = 0;
        for (let dc = -1; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) {
            if (dc === 0 && dr === 0) continue;
            const nc = c + dc;
            const nr = r + dr;
            if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
              if (this.grid[nc][nr].hasMine) count++;
            }
          }
        }
        this.grid[c][r].adjacentMines = count;
      }
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

    // Update active mines countdown
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const tile = this.grid[c][r];
        if (tile.detonateTimer > 0) {
          tile.detonateTimer -= dt;
          if (tile.detonateTimer <= 0 && !tile.exploded) {
            tile.exploded = true;
            this.audio.playExplosion();
            this.particles.shake(0.35);

            const tx = this.gridStartX + c * this.tileW + this.tileW / 2;
            const ty = this.gridStartY + r * this.tileH + this.tileH / 2;

            // Shrapnel
            this.particles.spawnExplosion(tx, ty, '#EF4444', 16);

            // Check if any player caught in blast
            for (const [id, ps] of this.playersState.entries()) {
              if (Math.hypot(ps.x - tx, ps.y - ty) < this.tileW) {
                ps.stunTimer = 1.2;
                ps.y = this.gridStartY + this.rows * this.tileH + 25; // Knocked back to start line!
                ps.vx = 0;
                ps.vy = 0;
                this.audio.playStun();
              }
            }
          }
        }
      }
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

      const steer = this.input.getSteer(p.id);
      const isDown = this.input.isPressed(p.id);
      const speed = isDown ? 210 : 160;

      if (steer !== 0) {
        ps.vx = steer * speed;
        ps.vy = -speed * 0.7;
      } else if (isDown) {
        // Single-button mobile mode: dash forward in aimed heading
        ps.vx = Math.cos(ps.aimAngle) * speed;
        ps.vy = Math.sin(ps.aimAngle) * speed;
      } else {
        // Idle aim sweep across forward cone (-135deg to -45deg)
        ps.aimAngle += ps.sweepDir * 2.2 * dt;
        if (ps.aimAngle > -Math.PI * 0.25) {
          ps.aimAngle = -Math.PI * 0.25;
          ps.sweepDir = -1;
        } else if (ps.aimAngle < -Math.PI * 0.75) {
          ps.aimAngle = -Math.PI * 0.75;
          ps.sweepDir = 1;
        }
        ps.vx *= Math.pow(0.85, dt * 60);
        ps.vy *= Math.pow(0.85, dt * 60);
      }

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Clamp to arena
      ps.x = Math.max(this.gridStartX + 10, Math.min(this.gridStartX + this.cols * this.tileW - 10, ps.x));
      ps.y = Math.max(this.gridStartY - 30, Math.min(this.gridStartY + this.rows * this.tileH + 45, ps.y));

      // Check current grid tile
      const col = Math.floor((ps.x - this.gridStartX) / this.tileW);
      const row = Math.floor((ps.y - this.gridStartY) / this.tileH);

      if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
        const tile = this.grid[col][row];
        if (!tile.revealed) {
          tile.revealed = true;
          this.audio.playTap();

          if (tile.hasMine && tile.detonateTimer <= 0) {
            tile.detonateTimer = 0.65; // 0.65s fuse!
            this.audio.playBuzzer();
          }
        }
      }

      // Reached the Golden Battery Core at the top!
      if (ps.y <= this.gridStartY - 10) {
        ps.score += 1;
        this.audio.playTone(523.25, 0.08, 'triangle');
        setTimeout(() => this.audio.playTone(783.99, 0.12, 'sine'), 80);

        // Celebration burst
        this.particles.spawnExplosion(ps.x, ps.y, '#FBBF24', 24);
        this.particles.showFloatingText('+1 CORE EXTRACTED!', ps.x, ps.y - 14, '#FACC15', 18);

        if (ps.score >= 3) {
          this.isFinished = true;
        } else {
          // Reset players to start line and generate a new layout
          this.generateMinefield();
          active.forEach((pl, i) => {
            const st = this.playersState.get(pl.id);
            if (st) {
              st.x = this.gridStartX + (i + 1) * (this.cols * this.tileW) / (active.length + 1);
              st.y = this.gridStartY + this.rows * this.tileH + 25;
              st.vx = 0;
              st.vy = 0;
            }
          });
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    const curCol = Math.max(0, Math.min(this.cols - 1, Math.floor((ps.x - this.gridStartX) / this.tileW)));
    const curRow = Math.max(0, Math.min(this.rows - 1, Math.floor((ps.y - this.gridStartY) / this.tileH)));

    if (difficulty === 'bot_easy') {
      // Recklessly dashes forward towards the core
      const steer = (Math.random() - 0.5) * 0.8;
      this.input.setBotInput(botId, true, steer);
    } else if (difficulty === 'bot_normal') {
      // Looks ahead at next row tile
      let nextCol = curCol;
      const targetRow = Math.max(0, curRow - 1);

      // Check if current tile is ticking, flee sideways!
      if (this.grid[curCol][curRow]?.detonateTimer > 0) {
        nextCol = curCol > 0 ? curCol - 1 : curCol + 1;
      } else if (this.grid[curCol][targetRow]?.revealed && this.grid[curCol][targetRow].hasMine) {
        // Step to adjacent column
        nextCol = curCol > 0 ? curCol - 1 : curCol + 1;
      }

      const steer = nextCol < curCol ? -1 : (nextCol > curCol ? 1 : 0);
      this.input.setBotInput(botId, true, steer);
    } else {
      // Hard: Checks revealed numbers and avoids proximity risk
      let bestX = ps.x;
      let minMines = 99;

      const targetRow = Math.max(0, curRow - 1);
      for (let dc = -1; dc <= 1; dc++) {
        const c = curCol + dc;
        if (c >= 0 && c < this.cols) {
          const t = this.grid[c][targetRow];
          if (!t.exploded && (!t.revealed || !t.hasMine)) {
            const risk = t.revealed ? t.adjacentMines : 1;
            if (risk < minMines) {
              minMines = risk;
              bestX = this.gridStartX + c * this.tileW + this.tileW / 2;
            }
          }
        }
      }

      // If current tile is ticking, emergency escape
      if (this.grid[curCol][curRow]?.detonateTimer > 0) {
        bestX = ps.x + (Math.random() > 0.5 ? 50 : -50);
      }

      const steer = bestX < ps.x - 12 ? -1 : (bestX > ps.x + 12 ? 1 : 0);
      this.input.setBotInput(botId, true, steer);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Cyber Command Grid Background
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    // Goal Battery Line at top
    const goalY = this.gridStartY - 15;
    ctx.save();
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(this.gridStartX, goalY - 10, this.cols * this.tileW, 8);
    ctx.restore();

    ctx.fillStyle = '#FDE68A';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ ENERGY EXTRACTION LINE ⚡', this.gridStartX + (this.cols * this.tileW) / 2, goalY - 16);

    // Render Grid Hex-Plates
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const t = this.grid[c][r];
        const x = this.gridStartX + c * this.tileW + 2;
        const y = this.gridStartY + r * this.tileH + 2;
        const w = this.tileW - 4;
        const h = this.tileH - 4;

        if (t.exploded) {
          ctx.fillStyle = '#450A0A';
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = '#F87171';
          ctx.font = '900 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💥', x + w / 2, y + h / 2 + 5);
        } else if (t.detonateTimer > 0) {
          // Warning blink
          const isBlink = Math.floor(t.detonateTimer * 10) % 2 === 0;
          ctx.fillStyle = isBlink ? '#EF4444' : '#7F1D1D';
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 14px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚠️', x + w / 2, y + h / 2 + 5);
        } else if (t.revealed) {
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);

          // Proximity number
          if (t.adjacentMines > 0) {
            const colors = ['#38BDF8', '#FBBF24', '#F97316', '#EF4444'];
            ctx.fillStyle = colors[Math.min(colors.length - 1, t.adjacentMines - 1)];
            ctx.font = '900 14px Montserrat, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${t.adjacentMines}`, x + w / 2, y + h / 2 + 5);
          } else {
            ctx.fillStyle = '#64748B';
            ctx.font = '900 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('·', x + w / 2, y + h / 2 + 3);
          }
        } else {
          // Unrevealed cyber plate
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);
        }
      }
    }

    // Start Line
    const startLineY = this.gridStartY + this.rows * this.tileH + 10;
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(this.gridStartX, startLineY);
    ctx.lineTo(this.gridStartX + this.cols * this.tileW, startLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Render Players
    const active = this.getActivePlayers();
    const now = performance.now() * 0.001;
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();

      // Dynamic Sonar Scanner Radar Ring radiating from player
      const radarPhase = (now * 2.5 + p.id * 0.5) % 1.0;
      const radarR = 12 + radarPhase * 45;
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, radarR, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = (1 - radarPhase) * 0.5;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Stun electrical ring
      if (ps.stunTimer > 0) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ps.x, ps.y, 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Explorer Mascot
      const mood = ps.stunTimer > 0 ? 'shocked' : 'focused';
      this.drawPlayerMascot(ctx, p.id, ps.x, ps.y, 13, mood, now);

      // Aim directional laser guide
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ps.x + Math.cos(ps.aimAngle) * 12, ps.y + Math.sin(ps.aimAngle) * 12);
      ctx.lineTo(ps.x + Math.cos(ps.aimAngle) * 22, ps.y + Math.sin(ps.aimAngle) * 22);
      ctx.stroke();

      ctx.restore();

      // Name & Score Tag
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, ps.x, ps.y - 18);
    }

    // Top Center HUD Score Pod
    const hudW = 280;
    const hudH = 26;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hudX, hudY, hudW, hudH, 13);
    else ctx.rect(hudX, hudY, hudW, hudH);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    let summary = active.map((p) => {
      const ps = this.playersState.get(p.id);
      return `${p.name}: ${ps?.score || 0}/3 CORES`;
    }).join('   •   ');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(summary, width / 2, hudY + 17);
  }

  public isRoundOver(): boolean {
    if (this.isFinished) return true;
    for (const ps of this.playersState.values()) {
      if (ps.score >= 3) return true;
    }
    return false;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    let winnerId: PlayerId | null = null;
    let highestScore = -1;

    active.forEach((p) => {
      const ps = this.playersState.get(p.id);
      const sc = ps?.score || 0;
      if (sc > highestScore) {
        highestScore = sc;
        winnerId = p.id;
      }
    });

    const sorted = [...active].sort((a, b) => {
      const scA = this.playersState.get(a.id)?.score || 0;
      const scB = this.playersState.get(b.id)?.score || 0;
      return scB - scA;
    });

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.playersState.get(p.id)?.score || 0
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} navigated the Minefield like a cyber master!` : 'The Minefield claimed all operatives in a draw!'
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
