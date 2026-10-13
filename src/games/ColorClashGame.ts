import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface ColorClashTheme {
  name: string;
  bgGradStart: string;
  bgGradEnd: string;
  gridFloor: string;
  tileBorder: string;
  neutralTile: string;
  tileGlow: string;
  accentPill: string;
}

export const COLOR_CLASH_THEMES: ColorClashTheme[] = [
  {
    name: 'Neon Arcade Grid ⚡',
    bgGradStart: '#0B0F19',
    bgGradEnd: '#020617',
    gridFloor: '#0F172A',
    tileBorder: '#1E293B',
    neutralTile: '#1E293B',
    tileGlow: '#38BDF8',
    accentPill: '#38BDF8'
  },
  {
    name: 'Toy Room Splat 🎨',
    bgGradStart: '#2A1810',
    bgGradEnd: '#180D07',
    gridFloor: '#3B2314',
    tileBorder: '#54321D',
    neutralTile: '#452B1B',
    tileGlow: '#F59E0B',
    accentPill: '#F59E0B'
  },
  {
    name: 'Cyber Foundry 🏭',
    bgGradStart: '#131722',
    bgGradEnd: '#0A0C14',
    gridFloor: '#1C2333',
    tileBorder: '#303B52',
    neutralTile: '#242D40',
    tileGlow: '#10B981',
    accentPill: '#10B981'
  }
];

interface PaintRover {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  tileCount: number;
  turboTimer: number;
  paintStreak: number;
  isUnderdog: boolean;
  bumpStunTimer: number;
}

interface PaintTile {
  col: number;
  row: number;
  x: number;
  y: number;
  ownerId: PlayerId | null;
  splashAnim: number;
}

interface PaintBomb {
  x: number;
  y: number;
  active: boolean;
  respawnTimer: number;
  nextX?: number;
  nextY?: number;
  isSuperBomb?: boolean;
}

export class ColorClashGame extends BaseGame {
  private rovers: Map<PlayerId, PaintRover> = new Map();
  private tiles: PaintTile[][] = [];
  private cols: number = 14;
  private rows: number = 9;
  private tileW: number = 50;
  private tileH: number = 50;
  private gridOriginX: number = 50;
  private gridOriginY: number = 70;
  private paintBombs: PaintBomb[] = [];
  private totalTiles: number = 126;

  // Theme & Polish properties
  private currentThemeIndex: number = 0;
  private animTimer: number = 0;
  private suddenDeathAnnounced: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __COLOR_CLASH_DEBUG__?: unknown }).__COLOR_CLASH_DEBUG__) {
      delete (window as unknown as { __COLOR_CLASH_DEBUG__?: unknown }).__COLOR_CLASH_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % COLOR_CLASH_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % COLOR_CLASH_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35;
    this.isFinished = false;
    this.suddenDeathAnnounced = false;
    this.rovers.clear();
    this.tiles = [];
    this.paintBombs = [];
    this.animTimer = 0;

    // Centered grid dimensions safe from HUD
    const marginX = 50;
    const marginTop = 84; // Avoid y: 12-44 timer & y: 56 badge
    const marginBottom = 54; // Avoid bottom theme pill & controls
    const availableW = width - marginX * 2;
    const availableH = height - marginTop - marginBottom;

    this.cols = 14;
    this.rows = 9;
    this.totalTiles = this.cols * this.rows;
    this.tileW = availableW / this.cols;
    this.tileH = availableH / this.rows;
    this.gridOriginX = marginX;
    this.gridOriginY = marginTop;

    // Initialize blank neutral grid
    for (let r = 0; r < this.rows; r++) {
      const rowArr: PaintTile[] = [];
      for (let c = 0; c < this.cols; c++) {
        rowArr.push({
          col: c,
          row: r,
          x: this.gridOriginX + c * this.tileW,
          y: this.gridOriginY + r * this.tileH,
          ownerId: null,
          splashAnim: 0
        });
      }
      this.tiles.push(rowArr);
    }

    // Spawn player rovers in distinct corners
    const active = this.getActivePlayers();
    const spawnPoints = [
      { col: 1, row: 1, angle: Math.PI / 4 },
      { col: this.cols - 2, row: this.rows - 2, angle: -Math.PI * 0.75 },
      { col: 1, row: this.rows - 2, angle: -Math.PI / 4 },
      { col: this.cols - 2, row: 1, angle: Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const sp = spawnPoints[idx % spawnPoints.length];
      const rx = this.gridOriginX + (sp.col + 0.5) * this.tileW;
      const ry = this.gridOriginY + (sp.row + 0.5) * this.tileH;

      this.rovers.set(p.id, {
        id: p.id,
        x: rx,
        y: ry,
        vx: 0,
        vy: 0,
        angle: sp.angle,
        speed: 205,
        tileCount: 0,
        turboTimer: 0,
        paintStreak: 0,
        isUnderdog: false,
        bumpStunTimer: 0
      });

      // Paint starting tile
      this.paintTile(sp.col, sp.row, p.id);
    });

    // Spawn 2 initial paint bomb canisters
    this.paintBombs = [];
    const b1Pos = this.getRandomBombPosition();
    this.paintBombs.push({
      x: b1Pos.x,
      y: b1Pos.y,
      active: true,
      respawnTimer: 0
    });
    const b2Pos = this.getRandomBombPosition();
    this.paintBombs.push({
      x: b2Pos.x,
      y: b2Pos.y,
      active: true,
      respawnTimer: 0
    });

    // Expose debug hook for testing
    (window as any).__COLOR_CLASH_DEBUG__ = {
      getBombs: () => this.paintBombs.map((b) => ({
        x: b.x,
        y: b.y,
        active: b.active,
        respawnTimer: b.respawnTimer,
        nextX: b.nextX,
        nextY: b.nextY,
        isSuperBomb: b.isSuperBomb
      })),
      getRovers: () => Array.from(this.rovers.values()).map((r) => ({
        id: r.id,
        x: r.x,
        y: r.y,
        vx: r.vx,
        vy: r.vy,
        turboTimer: r.turboTimer,
        tileCount: r.tileCount,
        isUnderdog: r.isUnderdog,
        paintStreak: r.paintStreak
      })),
      triggerPickup: (bombIndex: number, roverId: PlayerId) => {
        const b = this.paintBombs[bombIndex];
        const r = this.rovers.get(roverId);
        if (b && r) {
          r.x = b.x;
          r.y = b.y;
        }
      },
      setBombRespawnTimer: (bombIndex: number, timer: number) => {
        if (this.paintBombs[bombIndex]) {
          this.paintBombs[bombIndex].respawnTimer = timer;
        }
      },
      getRandomBombPosition: (excludeIndex?: number) => this.getRandomBombPosition(excludeIndex),
      getTheme: () => COLOR_CLASH_THEMES[this.currentThemeIndex].name,
      setTheme: (idx: number) => {
        this.currentThemeIndex = Math.max(0, Math.min(idx, COLOR_CLASH_THEMES.length - 1));
      }
    };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;
    const isSuddenDeath = this.roundTimer <= 15;

    // Sudden death announcement
    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playExplosion();
      this.particles.addTrauma(0.4);
      this.particles.showFloatingText('🎨 SUDDEN DEATH: SUPER BOMB STORM! 🎨', width / 2, height / 2 - 40, '#FACC15', 28);
    }

    this.updateBots(dt, width, height);

    // Update tile splash animations
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.tiles[r][c];
        if (t.splashAnim > 0) {
          t.splashAnim = Math.max(0, t.splashAnim - dt * 4);
        }
      }
    }

    // Dynamic sudden death bomb spawn accelerator
    for (let i = 0; i < this.paintBombs.length; i++) {
      const b = this.paintBombs[i];
      if (!b.active) {
        b.respawnTimer -= dt;
        if (b.respawnTimer <= 0) {
          b.active = true;
          b.isSuperBomb = isSuddenDeath;
          if (b.nextX !== undefined && b.nextY !== undefined) {
            b.x = b.nextX;
            b.y = b.nextY;
          } else {
            const nextPos = this.getRandomBombPosition(i);
            b.x = nextPos.x;
            b.y = nextPos.y;
          }
          b.nextX = undefined;
          b.nextY = undefined;
          this.particles.spawnSparks(b.x, b.y, b.isSuperBomb ? '#EF4444' : '#F59E0B', 18);
          this.particles.showFloatingText(
            b.isSuperBomb ? 'SUPER BOMB! 💥' : 'BOMB LANDED! 💣',
            b.x,
            b.y - 20,
            b.isSuperBomb ? '#EF4444' : '#F59E0B',
            18
          );
          this.audio.playTap();
        }
      }
    }

    // Calculate Leader and Underdog status
    let maxTiles = 0;
    let minTiles = Infinity;
    for (const r of this.rovers.values()) {
      if (r.tileCount > maxTiles) maxTiles = r.tileCount;
      if (r.tileCount < minTiles) minTiles = r.tileCount;
    }

    for (const r of this.rovers.values()) {
      const deficit = maxTiles - r.tileCount;
      r.isUnderdog = deficit >= 14 && maxTiles >= 20;
    }

    // Process Player Rovers
    const roversList = Array.from(this.rovers.values());

    for (const rover of roversList) {
      if (rover.turboTimer > 0) {
        rover.turboTimer -= dt;
      }
      if (rover.bumpStunTimer > 0) {
        rover.bumpStunTimer -= dt;
      }

      const steer = this.input.getSteer(rover.id);
      const throttle = this.input.getThrottle(rover.id);
      const isPressed = this.input.isActionPressed(rover.id) || (this.input.isPressed(rover.id) && steer === 0 && throttle === 0);

      // Base speed with Underdog & Turbo modifiers
      let curSpeed = rover.speed;
      if (rover.isUnderdog) curSpeed *= 1.20;
      if (rover.turboTimer > 0) curSpeed *= 1.45;
      if (rover.bumpStunTimer > 0) curSpeed *= 0.35;

      const inputY = -throttle;

      if (steer !== 0 || throttle !== 0) {
        // Direct directional steering with WASD / Arrow keys
        const targetAngle = Math.atan2(inputY, steer);
        rover.angle = targetAngle;
        rover.vx += (Math.cos(rover.angle) * curSpeed - rover.vx) * dt * 10;
        rover.vy += (Math.sin(rover.angle) * curSpeed - rover.vy) * dt * 10;
      } else if (isPressed) {
        // 1-button auto drive forward
        rover.vx += (Math.cos(rover.angle) * curSpeed - rover.vx) * dt * 8.5;
        rover.vy += (Math.sin(rover.angle) * curSpeed - rover.vy) * dt * 8.5;
      } else {
        // Idle clockwise slow turn so 1-button players can re-orient
        rover.angle += dt * 3.2;
        rover.vx *= Math.pow(0.85, dt * 60);
        rover.vy *= Math.pow(0.85, dt * 60);
      }

      rover.x += rover.vx * dt;
      rover.y += rover.vy * dt;

      // Arena bounds clamp
      const minX = this.gridOriginX + 16;
      const maxX = this.gridOriginX + this.cols * this.tileW - 16;
      const minY = this.gridOriginY + 16;
      const maxY = this.gridOriginY + this.rows * this.tileH - 16;

      rover.x = Math.max(minX, Math.min(maxX, rover.x));
      rover.y = Math.max(minY, Math.min(maxY, rover.y));

      // Paint occupied tile(s)
      const col = Math.floor((rover.x - this.gridOriginX) / this.tileW);
      const row = Math.floor((rover.y - this.gridOriginY) / this.tileH);

      if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
        const painted = this.paintTile(col, row, rover.id);
        if (painted) {
          rover.paintStreak++;
        }

        // Underdog Mega Roller paints adjacent tiles too
        if (rover.isUnderdog) {
          const offsets = [
            { dc: 1, dr: 0 },
            { dc: -1, dr: 0 },
            { dc: 0, dr: 1 },
            { dc: 0, dr: -1 }
          ];
          for (const off of offsets) {
            const nc = col + off.dc;
            const nr = row + off.dr;
            if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
              this.paintTile(nc, nr, rover.id);
            }
          }
        }
      }

      // Check Paint Bomb pickup
      for (let i = 0; i < this.paintBombs.length; i++) {
        const b = this.paintBombs[i];
        if (b.active && Math.hypot(rover.x - b.x, rover.y - b.y) < 28) {
          b.active = false;
          b.respawnTimer = isSuddenDeath ? 3.0 : 4.5 + Math.random() * 2.0;
          const nextPos = this.getRandomBombPosition(i);
          b.nextX = nextPos.x;
          b.nextY = nextPos.y;
          rover.turboTimer = 3.5;
          const pColor = this.getPlayer(rover.id)?.color || '#38BDF8';
          this.audio.playExplosion();
          this.particles.addTrauma(b.isSuperBomb ? 0.38 : 0.25);
          this.particles.spawnExplosion(b.x, b.y, pColor, b.isSuperBomb ? 55 : 35);
          this.particles.showFloatingText(
            b.isSuperBomb ? 'SUPER PAINT BURST! 💥' : 'PAINT BURST! 💣',
            b.x,
            b.y - 22,
            pColor,
            b.isSuperBomb ? 26 : 22
          );

          // Explode 3x3 (or 5x5 if super bomb) tiles surrounding the bomb
          const radius = b.isSuperBomb ? 2 : 1;
          const bombCol = Math.floor((b.x - this.gridOriginX) / this.tileW);
          const bombRow = Math.floor((b.y - this.gridOriginY) / this.tileH);

          for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
              const tc = bombCol + dc;
              const tr = bombRow + dr;
              if (tc >= 0 && tc < this.cols && tr >= 0 && tr < this.rows) {
                this.paintTile(tc, tr, rover.id);
              }
            }
          }
        }
      }

      // Paint trail particles
      const roverColor = this.getPlayer(rover.id)?.color || '#38BDF8';
      if (Math.random() < 0.35 && Math.hypot(rover.vx, rover.vy) > 35) {
        this.particles.spawnSparks(rover.x, rover.y, roverColor, 2);
      }
    }

    // Rover-to-Rover Elastic Bumper Car Collisions
    for (let i = 0; i < roversList.length; i++) {
      for (let j = i + 1; j < roversList.length; j++) {
        const r1 = roversList[i];
        const r2 = roversList[j];
        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 30; // 2x rover collision radius

        if (dist < minDist && dist > 0.001) {
          // Normal vector
          const nx = dx / dist;
          const ny = dy / dist;

          // Separation displacement
          const overlap = minDist - dist;
          r1.x -= nx * overlap * 0.5;
          r1.y -= ny * overlap * 0.5;
          r2.x += nx * overlap * 0.5;
          r2.y += ny * overlap * 0.5;

          // Elastic bounce impulse
          const separationSpeed = 280;
          r1.vx = -nx * separationSpeed;
          r1.vy = -ny * separationSpeed;
          r2.vx = nx * separationSpeed;
          r2.vy = ny * separationSpeed;

          r1.bumpStunTimer = 0.22;
          r2.bumpStunTimer = 0.22;

          this.audio.playBounce();
          this.particles.addTrauma(0.18);
          this.particles.spawnSparks((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, '#FFFFFF', 10);
        }
      }
    }

    // Recalculate tile ownership counts
    const counts = new Map<PlayerId, number>();
    for (const p of this.getActivePlayers()) counts.set(p.id, 0);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const owner = this.tiles[r][c].ownerId;
        if (owner !== null && counts.has(owner)) {
          counts.set(owner, (counts.get(owner) || 0) + 1);
        }
      }
    }

    for (const [pid, cnt] of counts.entries()) {
      const rov = this.rovers.get(pid);
      if (rov) rov.tileCount = cnt;
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private getRandomBombPosition(excludeIndex?: number): { x: number; y: number } {
    let bestCandidate = {
      x: this.gridOriginX + (Math.floor(this.cols / 2) + 0.5) * this.tileW,
      y: this.gridOriginY + (Math.floor(this.rows / 2) + 0.5) * this.tileH
    };
    let bestScore = -Infinity;

    const minCol = 1;
    const maxCol = this.cols - 2;
    const minRow = 1;
    const maxRow = this.rows - 2;

    for (let attempt = 0; attempt < 35; attempt++) {
      const col = minCol + Math.floor(Math.random() * (maxCol - minCol + 1));
      const row = minRow + Math.floor(Math.random() * (maxRow - minRow + 1));
      const candX = this.gridOriginX + (col + 0.5) * this.tileW;
      const candY = this.gridOriginY + (row + 0.5) * this.tileH;

      let minOtherBombDist = Infinity;
      for (let i = 0; i < this.paintBombs.length; i++) {
        if (excludeIndex !== undefined && i === excludeIndex) continue;
        const other = this.paintBombs[i];
        const ox = other.active ? other.x : (other.nextX ?? other.x);
        const oy = other.active ? other.y : (other.nextY ?? other.y);
        const d = Math.hypot(candX - ox, candY - oy);
        if (d < minOtherBombDist) minOtherBombDist = d;
      }

      let minRoverDist = Infinity;
      for (const rov of this.rovers.values()) {
        const d = Math.hypot(candX - rov.x, candY - rov.y);
        if (d < minRoverDist) minRoverDist = d;
      }

      const bombSeparationOk = minOtherBombDist >= this.tileW * 3.2;
      const roverClearanceOk = minRoverDist >= 75;

      if (bombSeparationOk && roverClearanceOk) {
        return { x: candX, y: candY };
      }

      const score = Math.min(minOtherBombDist, 250) + Math.min(minRoverDist, 180);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = { x: candX, y: candY };
      }
    }

    return bestCandidate;
  }

  private paintTile(col: number, row: number, pid: PlayerId): boolean {
    const t = this.tiles[row][col];
    if (t.ownerId !== pid) {
      t.ownerId = pid;
      t.splashAnim = 1.0;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const rover = this.rovers.get(botId);
    if (!rover) return;

    // 1. Look for active Paint Bombs first
    let targetX = width / 2;
    let targetY = height / 2;
    let foundBomb = false;

    for (const b of this.paintBombs) {
      if (b.active) {
        targetX = b.x;
        targetY = b.y;
        foundBomb = true;
        break;
      } else if (b.respawnTimer <= 1.0 && b.nextX !== undefined && b.nextY !== undefined && difficulty !== 'bot_easy') {
        targetX = b.nextX;
        targetY = b.nextY;
        foundBomb = true;
        break;
      }
    }

    // 2. If no bomb, find nearest unpainted or opponent tile
    if (!foundBomb) {
      let bestDist = Infinity;
      const myCol = Math.floor((rover.x - this.gridOriginX) / this.tileW);
      const myRow = Math.floor((rover.y - this.gridOriginY) / this.tileH);

      const radius = difficulty === 'bot_hard' ? 5 : difficulty === 'bot_normal' ? 3 : 2;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const tc = myCol + dc;
          const tr = myRow + dr;
          if (tc >= 0 && tc < this.cols && tr >= 0 && tr < this.rows) {
            const tile = this.tiles[tr][tc];
            if (tile.ownerId !== botId) {
              const d = Math.hypot(tile.x - rover.x, tile.y - rover.y);
              if (d < bestDist) {
                bestDist = d;
                targetX = tile.x + this.tileW / 2;
                targetY = tile.y + this.tileH / 2;
              }
            }
          }
        }
      }
    }

    const dx = targetX - rover.x;
    const dy = targetY - rover.y;
    const mag = Math.hypot(dx, dy) || 1;

    let steerX = dx / mag;
    let steerY = dy / mag;

    // Human perception inaccuracy for easy bots
    if (difficulty === 'bot_easy') {
      steerX += (Math.random() - 0.5) * 0.75;
      steerY += (Math.random() - 0.5) * 0.75;
    } else if (difficulty === 'bot_normal') {
      steerX += (Math.random() - 0.5) * 0.25;
      steerY += (Math.random() - 0.5) * 0.25;
    }

    const finalMag = Math.hypot(steerX, steerY) || 1;
    this.input.setBotInput(botId, true, steerX / finalMag, -steerY / finalMag, false);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.rovers.values()).sort((a, b) => b.tileCount - a.tileCount);
    const winnerId = sorted.length > 0 && sorted[0].tileCount > 0 ? sorted[0].id : null;
    const winnerName = winnerId !== null ? (this.getPlayer(winnerId)?.name || 'Player') : '';

    return {
      winnerId,
      rankings: sorted.map((r, idx) => ({
        playerId: r.id,
        score: r.tileCount,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null
        ? `${winnerName} DOMINATED THE TURF WITH ${sorted[0].tileCount} TILES (${Math.round((sorted[0].tileCount / this.totalTiles) * 100)}%)!`
        : 'ARENA UNCLAIMED! STALEMATE!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = COLOR_CLASH_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15;

    // 1. Theme Canvas Floor
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradStart);
    bgGrad.addColorStop(1, theme.bgGradEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Render Paint Tiles Grid
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.tiles[r][c];
        const tx = t.x + 1.5;
        const ty = t.y + 1.5;
        const tw = this.tileW - 3;
        const th = this.tileH - 3;

        if (t.ownerId !== null) {
          const pColor = this.getPlayer(t.ownerId)?.color || '#38BDF8';
          ctx.save();
          ctx.fillStyle = pColor;
          ctx.globalAlpha = 0.88 + t.splashAnim * 0.12;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(tx, ty, tw, th, 4);
          else ctx.rect(tx, ty, tw, th);
          ctx.fill();

          // Beveled gloss shine
          ctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
          ctx.fillRect(tx, ty, tw, 4);
          ctx.restore();
        } else {
          // Neutral unpainted tile
          ctx.save();
          ctx.fillStyle = theme.neutralTile;
          ctx.strokeStyle = theme.tileBorder;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(tx, ty, tw, th, 4);
          else ctx.rect(tx, ty, tw, th);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 3. Render Paint Bomb Pickups & Incoming Telegraphs
    for (const b of this.paintBombs) {
      if (!b.active) {
        if (b.respawnTimer <= 1.2 && b.nextX !== undefined && b.nextY !== undefined) {
          ctx.save();
          const p = 1.0 - (b.respawnTimer / 1.2);
          const ringRadius = 14 + (1 - p) * 24;
          ctx.strokeStyle = b.isSuperBomb
            ? `rgba(239, 68, 68, ${0.4 + p * 0.6})`
            : `rgba(245, 158, 11, ${0.4 + p * 0.6})`;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(b.nextX, b.nextY, ringRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Crosshairs
          ctx.strokeStyle = b.isSuperBomb ? '#EF4444' : '#FACC15';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
          const crossSize = 7;
          ctx.beginPath();
          ctx.moveTo(b.nextX - crossSize, b.nextY);
          ctx.lineTo(b.nextX + crossSize, b.nextY);
          ctx.moveTo(b.nextX, b.nextY - crossSize);
          ctx.lineTo(b.nextX + crossSize, b.nextY);
          ctx.stroke();

          ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + p * 0.3})`;
          ctx.beginPath();
          ctx.ellipse(b.nextX, b.nextY + 12, 10 * p, 5 * p, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        continue;
      }

      ctx.save();
      ctx.shadowColor = b.isSuperBomb ? '#EF4444' : '#F59E0B';
      ctx.shadowBlur = b.isSuperBomb ? 22 : 15;

      // Bomb Sphere
      const bombGrad = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 15);
      if (b.isSuperBomb) {
        bombGrad.addColorStop(0, '#FCA5A5');
        bombGrad.addColorStop(0.5, '#EF4444');
        bombGrad.addColorStop(1, '#991B1B');
      } else {
        bombGrad.addColorStop(0, '#FEF08A');
        bombGrad.addColorStop(0.6, '#F59E0B');
        bombGrad.addColorStop(1, '#B45309');
      }
      ctx.fillStyle = bombGrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.isSuperBomb ? 16 : 13, 0, Math.PI * 2);
      ctx.fill();

      // Spark Fuse
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y - 12, 6, 0, Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(b.x + 6, b.y - 15, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Render Paint Rovers with Mascot Drivers
    for (const rover of this.rovers.values()) {
      const pColor = this.getPlayer(rover.id)?.color || '#38BDF8';
      const isBot = this.getPlayer(rover.id)?.type.startsWith('bot_') ?? false;

      ctx.save();
      ctx.translate(rover.x, rover.y);
      ctx.rotate(rover.angle);

      // Rover Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 18, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Underdog Golden Surge Aura
      if (rover.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 18, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Rover Chassis
      ctx.shadowColor = rover.turboTimer > 0 ? '#FACC15' : pColor;
      ctx.shadowBlur = rover.turboTimer > 0 ? 18 : 8;
      ctx.fillStyle = pColor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-15, -11, 30, 22, 5);
      else ctx.rect(-15, -11, 30, 22);
      ctx.fill();

      // Front Paint Roller Barrel
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      const rollerWidth = rover.isUnderdog ? 32 : 24;
      if (ctx.roundRect) ctx.roundRect(11, -rollerWidth / 2, 8, rollerWidth, 3);
      else ctx.rect(11, -rollerWidth / 2, 8, rollerWidth);
      ctx.fill();

      // Rear Heavy Wheels
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-13, -15, 7, 4);
      ctx.fillRect(-13, 11, 7, 4);

      ctx.restore();

      // Determine Driver Mood
      let mood: CharacterMood = 'focused';
      if (rover.bumpStunTimer > 0) {
        mood = 'shocked';
      } else if (rover.turboTimer > 0 || rover.paintStreak >= 5) {
        mood = 'happy';
      } else if (this.isFinished) {
        mood = 'triumph';
      }

      // Render Character Mascot Driver on Top of Rover
      drawCharacter(ctx, rover.x, rover.y - 4, 13, rover.id, isBot, mood, this.animTimer);

      // Percentage / Count Badge floating above rover
      const pct = Math.round((rover.tileCount / this.totalTiles) * 100);
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${pct}% (${rover.tileCount})`, rover.x, rover.y - 25);
      ctx.restore();
    }

    // 5. Instruction Header Badge (y: 56)
    ctx.save();
    const pillW = 440;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.accentPill;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#F87171' : '#FFFFFF';
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isSuddenDeath
        ? '🎨 SUPER BOMB STORM! GRAB BOMBS FOR 5X5 EXPLOSIONS! 🎨'
        : 'DRIVE ROVER • CLAIM TURF • RAM RIVALS & GRAB BOMBS!',
      width / 2,
      pillY + pillH / 2
    );
    ctx.restore();

    // 6. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 170, 32, 16);
    else ctx.rect(20, height - 44, 170, 32);
    ctx.fill();
    ctx.strokeStyle = theme.accentPill;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.accentPill;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 85, height - 44 + 16);
    ctx.restore();

    // 7. On-screen Controls Pill (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('WASD / Arrows: Steer Rover | Tap: Drive', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }
}
