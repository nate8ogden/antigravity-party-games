import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface MinefieldTheme {
  name: string;
  bgGradStart: string;
  bgGradEnd: string;
  tileBgUnrevealed: string;
  tileBorderUnrevealed: string;
  tileBgRevealed: string;
  tileBorderRevealed: string;
  goalBeamColor: string;
  themePillColor: string;
}

export const MINEFIELD_THEMES: MinefieldTheme[] = [
  {
    name: 'Cyberpunk Hex Matrix ⚡',
    bgGradStart: '#0B0F19',
    bgGradEnd: '#05070D',
    tileBgUnrevealed: '#0F172A',
    tileBorderUnrevealed: '#1E293B',
    tileBgRevealed: '#1E293B',
    tileBorderRevealed: '#334155',
    goalBeamColor: '#38BDF8',
    themePillColor: '#38BDF8'
  },
  {
    name: 'Volcanic Geothermal Rift 🔥',
    bgGradStart: '#1A0700',
    bgGradEnd: '#0D0300',
    tileBgUnrevealed: '#261208',
    tileBorderUnrevealed: '#3D1D0E',
    tileBgRevealed: '#3D1D0E',
    tileBorderRevealed: '#662E14',
    goalBeamColor: '#F97316',
    themePillColor: '#F97316'
  },
  {
    name: 'Military Bunker C4 💣',
    bgGradStart: '#0F1712',
    bgGradEnd: '#080C09',
    tileBgUnrevealed: '#19261D',
    tileBorderUnrevealed: '#283B2F',
    tileBgRevealed: '#26382C',
    tileBorderRevealed: '#3D5946',
    goalBeamColor: '#10B981',
    themePillColor: '#10B981'
  }
];

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
  isUnderdog: boolean;
  shoveCooldown: number;
  consecutiveSafeTiles: number;
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

  // Theme support
  private currentThemeIndex: number = 0;

  // Sudden Death State
  private isSuddenDeath: boolean = false;
  private suddenDeathFlashTimer: number = 0;

  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private lastWidth: number = 800;
  private lastHeight: number = 600;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.currentThemeIndex = Math.floor(Math.random() * MINEFIELD_THEMES.length);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.roundTimer = 45;
    this.isFinished = false;
    this.isSuddenDeath = false;
    this.suddenDeathFlashTimer = 0;
    this.playersState.clear();

    this.input.setControlMode('directional');

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
      const startX = this.gridStartX + ((idx + 1) * (this.cols * this.tileW)) / (active.length + 1);
      const startY = this.gridStartY + this.rows * this.tileH + 25;

      this.playersState.set(p.id, {
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        score: 0,
        stunTimer: 0,
        aimAngle: -Math.PI / 2,
        sweepDir: 1,
        isUnderdog: false,
        shoveCooldown: 0,
        consecutiveSafeTiles: 0
      });
    });

    // Bind event listeners
    const canvas = this.input.getCanvas();
    if (canvas && !this.boundPointerDown) {
      this.boundPointerDown = this.handlePointerDown.bind(this);
      canvas.addEventListener('pointerdown', this.boundPointerDown);
    }
    if (!this.boundKeyDown) {
      this.boundKeyDown = this.handleKeyDown.bind(this);
      window.addEventListener('keydown', this.boundKeyDown);
    }

    if (typeof window !== 'undefined') {
      (window as any).__MINEFIELD_DASH_DEBUG__ = {
        game: this,
        cols: this.cols,
        rows: this.rows,
        tileW: this.tileW,
        tileH: this.tileH,
        gridStartX: this.gridStartX,
        gridStartY: this.gridStartY,
        getGrid: () => this.grid,
        getPlayersState: () => {
          const out: Record<string, any> = {};
          for (const [id, ps] of this.playersState.entries()) {
            out[id] = { ...ps };
          }
          return out;
        },
        forceExplode: (c: number, r: number) => {
          if (this.grid[c]?.[r]) {
            this.grid[c][r].exploded = true;
            this.grid[c][r].revealed = true;
            this.grid[c][r].detonateTimer = 0;
            this.ensureFieldSolvable();
          }
        },
        isBarricaded: (c: number, r: number) => {
          return !!this.grid[c]?.[r]?.exploded;
        },
        setPlayerPos: (id: PlayerId, x: number, y: number) => {
          const ps = this.playersState.get(id);
          if (ps) {
            ps.x = x;
            ps.y = y;
            ps.vx = 0;
            ps.vy = 0;
          }
        },
        getThemeIndex: () => this.currentThemeIndex,
        setThemeIndex: (idx: number) => {
          this.currentThemeIndex = idx % MINEFIELD_THEMES.length;
        }
      };
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.toggleTheme();
    }
  }

  private toggleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % MINEFIELD_THEMES.length;
    this.audio.playTap();
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click: [T] Theme Pill at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.toggleTheme();
    }
  }

  public override destroy(): void {
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = null;
    }
  }

  private generateMinefield() {
    this.grid = [];
    const mineDensity = 0.20;

    for (let c = 0; c < this.cols; c++) {
      this.grid[c] = [];
      for (let r = 0; r < this.rows; r++) {
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

  private ensureFieldSolvable(): void {
    const visited: boolean[][] = Array.from({ length: this.cols }, () => Array(this.rows).fill(false));
    const queue: [number, number][] = [];

    for (let c = 0; c < this.cols; c++) {
      if (!this.grid[c][this.rows - 1].exploded) {
        queue.push([c, this.rows - 1]);
        visited[c][this.rows - 1] = true;
      }
    }

    let canReachGoal = false;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    while (queue.length > 0) {
      const [curC, curR] = queue.shift()!;
      if (curR === 0) {
        canReachGoal = true;
        break;
      }

      for (const [dc, dr] of dirs) {
        const nc = curC + dc;
        const nr = curR + dr;
        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
          if (!visited[nc][nr] && !this.grid[nc][nr].exploded) {
            visited[nc][nr] = true;
            queue.push([nc, nr]);
          }
        }
      }
    }

    if (!canReachGoal) {
      for (let r = this.rows - 2; r >= 1; r--) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[c][r].exploded) {
            this.grid[c][r].exploded = false;
            this.grid[c][r].hasMine = false;
            this.grid[c][r].revealed = true;
            this.grid[c][r].adjacentMines = 0;

            const bx = this.gridStartX + c * this.tileW + this.tileW / 2;
            const by = this.gridStartY + r * this.tileH + this.tileH / 2;
            this.particles.spawnExplosion(bx, by, '#F59E0B', 20);
            this.particles.showFloatingText('⚡ BARRICADE BREACHED!', bx, by - 12, '#FACC15', 16);
            return;
          }
        }
      }
    }
  }

  private resolveBarricadeCollisions(ps: DashPlayer): void {
    const radius = 13;
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        if (!this.grid[c][r].exploded) continue;

        const tileLeft = this.gridStartX + c * this.tileW;
        const tileRight = tileLeft + this.tileW;
        const tileTop = this.gridStartY + r * this.tileH;
        const tileBottom = tileTop + this.tileH;

        if (
          ps.x + radius < tileLeft ||
          ps.x - radius > tileRight ||
          ps.y + radius < tileTop ||
          ps.y - radius > tileBottom
        ) {
          continue;
        }

        const clampX = Math.max(tileLeft, Math.min(tileRight, ps.x));
        const clampY = Math.max(tileTop, Math.min(tileBottom, ps.y));
        const dx = ps.x - clampX;
        const dy = ps.y - clampY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = radius - dist;
            ps.x += nx * overlap;
            ps.y += ny * overlap;

            const velDot = ps.vx * nx + ps.vy * ny;
            if (velDot < 0) {
              ps.vx -= velDot * nx;
              ps.vy -= velDot * ny;
            }
          } else {
            const dL = ps.x - tileLeft;
            const dR = tileRight - ps.x;
            const dT = ps.y - tileTop;
            const dB = tileBottom - ps.y;
            const minD = Math.min(dL, dR, dT, dB);
            if (minD === dL) {
              ps.x = tileLeft - radius;
              ps.vx = Math.min(0, ps.vx);
            } else if (minD === dR) {
              ps.x = tileRight + radius;
              ps.vx = Math.max(0, ps.vx);
            } else if (minD === dT) {
              ps.y = tileTop - radius;
              ps.vy = Math.min(0, ps.vy);
            } else {
              ps.y = tileBottom + radius;
              ps.vy = Math.max(0, ps.vy);
            }
          }
        }
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

    // Sudden death threshold (<= 15 seconds remaining)
    if (this.roundTimer <= 15.0 && !this.isSuddenDeath) {
      this.isSuddenDeath = true;
      this.audio.playBoost();
      this.particles.shake(6);
    }

    if (this.isSuddenDeath) {
      this.suddenDeathFlashTimer += dt;
    }

    // Underdog surge calculations: identify leader
    let maxScore = -1;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.isUnderdog = maxScore >= 2 && ps.score <= maxScore - 2;
    }

    // Update active mines countdown & detonation
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

            this.particles.spawnExplosion(tx, ty, '#EF4444', 20);

            // Blast wave knocks back nearby players
            for (const ps of this.playersState.values()) {
              if (Math.hypot(ps.x - tx, ps.y - ty) < this.tileW * 0.95) {
                // Underdog stun time is halved
                ps.stunTimer = ps.isUnderdog ? 0.5 : 1.0;
                ps.y = this.gridStartY + this.rows * this.tileH + 25; // Knocked back to starting line
                ps.vx = 0;
                ps.vy = 0;
                ps.consecutiveSafeTiles = 0;
                this.audio.playStun();
                this.particles.showFloatingText('💥 KNOCKED BACK!', ps.x, ps.y - 12, '#EF4444', 16);
              }
            }

            this.ensureFieldSolvable();
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

      if (ps.shoveCooldown > 0) {
        ps.shoveCooldown -= dt;
      }

      const rawSteer = this.input.getRawSteer(p.id);
      const rawThrottle = this.input.getRawThrottle(p.id);
      const smoothSteer = this.input.getSteer(p.id);
      const smoothThrottle = this.input.getThrottle(p.id);

      const steer = Math.abs(rawSteer) > 0 ? rawSteer : smoothSteer;
      const throttle = Math.abs(rawThrottle) > 0 ? rawThrottle : smoothThrottle;
      const isAction = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);

      // Underdog +25% sprint velocity
      const baseSpeed = ps.isUnderdog ? 190 : 160;
      const dashSpeed = ps.isUnderdog ? 285 : 240;
      const speed = isAction ? dashSpeed : baseSpeed;

      const inputX = steer;
      const inputY = -throttle;
      const mag = Math.hypot(inputX, inputY);

      if (mag > 0.15) {
        const normX = inputX / mag;
        const normY = inputY / mag;
        ps.vx = normX * speed;
        ps.vy = normY * speed;
        ps.aimAngle = Math.atan2(normY, normX);

        if (isAction && Math.random() < 0.25) {
          this.particles.spawnSparks(ps.x, ps.y + 6, ps.isUnderdog ? '#F59E0B' : p.color, 4);
        }
      } else if (isAction && this.input.controlMode === 'single_button') {
        ps.vx = Math.cos(ps.aimAngle) * speed;
        ps.vy = Math.sin(ps.aimAngle) * speed;
      } else {
        ps.vx = 0;
        ps.vy = 0;
      }

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      this.resolveBarricadeCollisions(ps);

      ps.x = Math.max(this.gridStartX + 12, Math.min(this.gridStartX + this.cols * this.tileW - 12, ps.x));
      ps.y = Math.max(this.gridStartY - 30, Math.min(this.gridStartY + this.rows * this.tileH + 45, ps.y));

      this.resolveBarricadeCollisions(ps);

      // Check current grid tile for reveal or mine trip
      const col = Math.floor((ps.x - this.gridStartX) / this.tileW);
      const row = Math.floor((ps.y - this.gridStartY) / this.tileH);

      if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
        const tile = this.grid[col][row];
        if (!tile.revealed && !tile.exploded) {
          tile.revealed = true;
          this.audio.playTap();

          if (tile.hasMine && tile.detonateTimer <= 0) {
            // Underdog gets generous fuse grace (1.0s vs 0.65s or 0.40s in sudden death)
            const baseFuse = this.isSuddenDeath ? 0.40 : 0.65;
            tile.detonateTimer = ps.isUnderdog ? 1.0 : baseFuse;
            this.audio.playBuzzer();
          } else if (!tile.hasMine) {
            ps.consecutiveSafeTiles += 1;
            if (tile.adjacentMines === 0) {
              // Auto-cascade reveal surrounding safe tiles
              this.cascadeReveal(col, row);
            }
          }
        }
      }

      // Reached the Energy Extraction Goal at the top
      if (ps.y <= this.gridStartY - 10) {
        // Sudden death Titan Core = 2 points!
        const pointsAwarded = this.isSuddenDeath ? 2 : 1;
        ps.score += pointsAwarded;
        this.audio.playTone(523.25, 0.08, 'triangle');
        setTimeout(() => this.audio.playTone(783.99, 0.12, 'sine'), 80);

        this.particles.spawnExplosion(ps.x, ps.y, '#FBBF24', 24);
        this.particles.showFloatingText(`+${pointsAwarded} ${this.isSuddenDeath ? 'TITAN CORE EXTRACTED!' : 'CORE EXTRACTED!'}`, ps.x, ps.y - 14, '#FACC15', 18);

        if (ps.score >= 3) {
          this.isFinished = true;
        } else {
          this.generateMinefield();
          active.forEach((pl, i) => {
            const st = this.playersState.get(pl.id);
            if (st) {
              st.x = this.gridStartX + ((i + 1) * (this.cols * this.tileW)) / (active.length + 1);
              st.y = this.gridStartY + this.rows * this.tileH + 25;
              st.vx = 0;
              st.vy = 0;
              st.stunTimer = 0;
              st.consecutiveSafeTiles = 0;
            }
          });
        }
      }
    }

    // Player-to-player elastic collision with shove impulse
    const playerList = Array.from(this.playersState.values());
    for (let i = 0; i < playerList.length; i++) {
      for (let j = i + 1; j < playerList.length; j++) {
        const p1 = playerList[i];
        const p2 = playerList[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 26;

        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          p1.x -= nx * overlap;
          p1.y -= ny * overlap;
          p2.x += nx * overlap;
          p2.y += ny * overlap;

          // Shove knockback if one player is sprinting/dashing
          const p1Dashing = Math.hypot(p1.vx, p1.vy) > 200;
          const p2Dashing = Math.hypot(p2.vx, p2.vy) > 200;
          if (p1Dashing && p1.shoveCooldown <= 0) {
            p2.vx += nx * 220;
            p2.vy += ny * 220;
            p1.shoveCooldown = 0.5;
            this.audio.playBounce();
            this.particles.spawnSparks(p2.x, p2.y, '#F59E0B', 6);
          } else if (p2Dashing && p2.shoveCooldown <= 0) {
            p1.vx -= nx * 220;
            p1.vy -= ny * 220;
            p2.shoveCooldown = 0.5;
            this.audio.playBounce();
            this.particles.spawnSparks(p1.x, p1.y, '#F59E0B', 6);
          }
        }
      }
    }
  }

  private cascadeReveal(startCol: number, startRow: number): void {
    const queue: [number, number][] = [[startCol, startRow]];
    const visited: boolean[][] = Array.from({ length: this.cols }, () => Array(this.rows).fill(false));
    visited[startCol][startRow] = true;

    while (queue.length > 0) {
      const [c, r] = queue.shift()!;
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows && !visited[nc][nr]) {
            visited[nc][nr] = true;
            const tile = this.grid[nc][nr];
            if (!tile.hasMine && !tile.exploded) {
              tile.revealed = true;
              if (tile.adjacentMines === 0) {
                queue.push([nc, nr]);
              }
            }
          }
        }
      }
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

    const curCol = Math.max(0, Math.min(this.cols - 1, Math.floor((ps.x - this.gridStartX) / this.tileW)));
    const curRow = Math.max(0, Math.min(this.rows - 1, Math.floor((ps.y - this.gridStartY) / this.tileH)));
    const targetRow = Math.max(0, curRow - 1);

    let throttle = 1.0;
    let steer = 0;
    let action = false;

    // Check if current tile is ticking - emergency lateral escape
    const curTile = this.grid[curCol]?.[curRow];
    if (curTile?.detonateTimer > 0) {
      const canLeft = curCol > 0 && !this.grid[curCol - 1][curRow].exploded && this.grid[curCol - 1][curRow].detonateTimer <= 0;
      const canRight = curCol < this.cols - 1 && !this.grid[curCol + 1][curRow].exploded && this.grid[curCol + 1][curRow].detonateTimer <= 0;
      if (canLeft && canRight) {
        steer = Math.random() > 0.5 ? -1 : 1;
      } else if (canLeft) {
        steer = -1;
      } else if (canRight) {
        steer = 1;
      }
      throttle = 0.4;
      action = difficulty !== 'bot_easy';
      this.input.setBotInput(botId, true, steer, throttle, action);
      return;
    }

    if (difficulty === 'bot_easy') {
      const frontTile = this.grid[curCol]?.[targetRow];
      if (frontTile?.exploded || frontTile?.detonateTimer > 0) {
        const canLeft = curCol > 0 && !this.grid[curCol - 1][curRow].exploded;
        const canRight = curCol < this.cols - 1 && !this.grid[curCol + 1][curRow].exploded;
        steer = canLeft ? -1 : (canRight ? 1 : 0);
        throttle = 0.4;
      } else {
        steer = (Math.random() - 0.5) * 0.35;
        throttle = 0.7;
      }
      this.input.setBotInput(botId, true, steer, throttle, false);
      return;
    }

    // Normal and Hard path evaluation
    let bestCol = curCol;
    let bestScore = -99999;
    const candidateCols = [curCol, curCol - 1, curCol + 1].filter(c => c >= 0 && c < this.cols);

    for (const c of candidateCols) {
      const tile = this.grid[c][targetRow];
      if (tile.exploded) continue;

      let score = 100;
      score -= Math.abs(c - curCol) * 15;

      if (tile.detonateTimer > 0) {
        score -= 500;
      }

      if (tile.revealed) {
        if (tile.hasMine) {
          score -= 1000;
        } else {
          score += 200;
        }
      } else {
        if (difficulty === 'bot_hard') {
          let knownSafe = false;
          let adjacentMineSum = 0;
          let neighborRevealedCount = 0;
          for (let dc = -1; dc <= 1; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
              const nc = c + dc;
              const nr = targetRow + dr;
              if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
                const nt = this.grid[nc][nr];
                if (nt.revealed && !nt.hasMine) {
                  if (nt.adjacentMines === 0) knownSafe = true;
                  adjacentMineSum += nt.adjacentMines;
                  neighborRevealedCount++;
                }
              }
            }
          }
          if (knownSafe) {
            score += 150;
            action = true;
          } else if (neighborRevealedCount > 0) {
            score -= (adjacentMineSum / neighborRevealedCount) * 40;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCol = c;
      }
    }

    if (bestScore === -99999) {
      const lateralOptions = [curCol - 1, curCol + 1].filter(c => c >= 0 && c < this.cols && !this.grid[c][curRow].exploded);
      if (lateralOptions.length > 0) {
        bestCol = lateralOptions[0];
        throttle = 0.2;
      }
    }

    const targetCenterX = this.gridStartX + bestCol * this.tileW + this.tileW / 2;
    const diffX = targetCenterX - ps.x;

    if (Math.abs(diffX) > 8) {
      steer = Math.sign(diffX);
    } else {
      steer = 0;
    }

    if (difficulty === 'bot_hard' && bestScore > 150) {
      action = true;
    }

    this.input.setBotInput(botId, true, steer, throttle, action);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = MINEFIELD_THEMES[this.currentThemeIndex];

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradStart);
    bgGrad.addColorStop(1, theme.bgGradEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Goal Extraction Line at top
    const goalY = this.gridStartY - 15;
    ctx.save();
    ctx.shadowColor = this.isSuddenDeath ? '#EF4444' : theme.goalBeamColor;
    ctx.shadowBlur = this.isSuddenDeath ? 20 : 14;
    ctx.fillStyle = this.isSuddenDeath ? '#EF4444' : theme.goalBeamColor;
    ctx.fillRect(this.gridStartX, goalY - 10, this.cols * this.tileW, 8);
    ctx.restore();

    ctx.fillStyle = this.isSuddenDeath ? '#FDE047' : '#FDE68A';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      this.isSuddenDeath ? '⚡ TITAN ENERGY CORE: +2 CORES! ⚡' : '⚡ ENERGY EXTRACTION LINE ⚡',
      this.gridStartX + (this.cols * this.tileW) / 2,
      goalY - 16
    );

    // Render Grid Hex-Plates / Barricades
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const t = this.grid[c][r];
        const x = this.gridStartX + c * this.tileW + 2;
        const y = this.gridStartY + r * this.tileH + 2;
        const w = this.tileW - 4;
        const h = this.tileH - 4;

        if (t.exploded) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 4);
          ctx.clip();

          ctx.fillStyle = '#18181B';
          ctx.fillRect(x, y, w, h);

          const stripeW = 9;
          ctx.fillStyle = '#EAB308';
          for (let sx = -h; sx < w + h; sx += stripeW * 2) {
            ctx.beginPath();
            ctx.moveTo(x + sx, y + h);
            ctx.lineTo(x + sx + stripeW, y + h);
            ctx.lineTo(x + sx + stripeW + h, y);
            ctx.lineTo(x + sx + h, y);
            ctx.closePath();
            ctx.fill();
          }

          ctx.strokeStyle = '#DC2626';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

          const badgeW = Math.min(w - 12, 42);
          const badgeH = 18;
          const badgeX = x + w / 2 - badgeW / 2;
          const badgeY = y + h / 2 - badgeH / 2;
          ctx.fillStyle = '#7F1D1D';
          ctx.strokeStyle = '#F87171';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 8.5px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⛔ BLOCK', x + w / 2, y + h / 2 + 3);

          ctx.restore();
        } else if (t.detonateTimer > 0) {
          const isBlink = Math.floor(t.detonateTimer * 10) % 2 === 0;
          ctx.fillStyle = isBlink ? '#EF4444' : '#7F1D1D';
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 14px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚠️', x + w / 2, y + h / 2 + 5);
        } else if (t.revealed) {
          ctx.fillStyle = theme.tileBgRevealed;
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = theme.tileBorderRevealed;
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);

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
          ctx.fillStyle = theme.tileBgUnrevealed;
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = theme.tileBorderUnrevealed;
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
      const isBot = p.type.startsWith('bot_');

      ctx.save();

      // Underdog Golden Pulse Aura
      if (ps.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(ps.x, ps.y, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Dynamic Sonar Scanner Radar Ring radiating from player
      const radarPhase = (now * 2.5 + p.id * 0.5) % 1.0;
      const radarR = 12 + radarPhase * 45;
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, radarR, 0, Math.PI * 2);
      ctx.strokeStyle = ps.isUnderdog ? '#F59E0B' : p.color;
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
      let mood: CharacterMood = 'focused';
      const curCol = Math.floor((ps.x - this.gridStartX) / this.tileW);
      const curRow = Math.floor((ps.y - this.gridStartY) / this.tileH);
      const curTile = (curCol >= 0 && curCol < this.cols && curRow >= 0 && curRow < this.rows) ? this.grid[curCol][curRow] : null;

      if (ps.stunTimer > 0 || curTile?.detonateTimer! > 0) {
        mood = 'shocked';
      } else if (ps.score >= 2 || this.isFinished) {
        mood = 'triumph';
      } else if (ps.consecutiveSafeTiles >= 2) {
        mood = 'happy';
      }

      drawCharacter(ctx, ps.x, ps.y, 13, p.id, isBot, mood, now * 4);

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

    // Minigame Subheader at safe position y: 56
    const hudW = Math.min(width - 60, 480);
    const hudH = 26;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 13);
    ctx.fill();
    ctx.strokeStyle = this.isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.isSuddenDeath) {
      const flash = Math.sin(this.suddenDeathFlashTimer * 10) > 0;
      ctx.fillStyle = flash ? '#FDE047' : '#EF4444';
      ctx.fillText('⚡ SUDDEN DEATH: FAST FUSES & 2X TITAN CORES! ⚡', width / 2, hudY + 13);
    } else {
      const summary = active.map((p) => {
        const ps = this.playersState.get(p.id);
        return `${p.name}: ${ps?.score || 0}/3 CORES`;
      }).join('   •   ');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(summary, width / 2, hudY + 13);
    }
    ctx.restore();

    // Theme Pill at bottom-left: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, pillX + pillW * 0.5, pillY + pillH * 0.5);

    // Right-aligned Control Hints
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '11px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Move: WASD / Arrows • Sprint/Shove: Space / Enter', width - 24, height - 28);
    ctx.restore();
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
