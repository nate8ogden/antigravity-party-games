import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type FloodTheme = 'quarry' | 'mosaic' | 'flora';

interface ThemeConfig {
  id: FloodTheme;
  name: string;
  badge: string;
  bgGradient: [string, string];
  boardBorder: string;
  tileBevel: string;
  gridLineColor: string;
  accentGlow: string;
  voidColor: string;
}

const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'quarry',
    name: 'Jewel Quarry',
    badge: '💎 JEWEL QUARRY',
    bgGradient: ['#0F172A', '#020617'],
    boardBorder: '#F59E0B',
    tileBevel: 'rgba(255, 255, 255, 0.25)',
    gridLineColor: 'rgba(51, 65, 85, 0.25)',
    accentGlow: '#F59E0B',
    voidColor: '#1E293B'
  },
  {
    id: 'mosaic',
    name: 'Neon Mosaic',
    badge: '⚡ NEON MOSAIC',
    bgGradient: ['#0A0F1D', '#040711'],
    boardBorder: '#06B6D4',
    tileBevel: 'rgba(255, 255, 255, 0.35)',
    gridLineColor: 'rgba(6, 182, 212, 0.15)',
    accentGlow: '#EC4899',
    voidColor: '#0F172A'
  },
  {
    id: 'flora',
    name: 'Mystic Flora',
    badge: '🌿 MYSTIC FLORA',
    bgGradient: ['#064E3B', '#022C22'],
    boardBorder: '#10B981',
    tileBevel: 'rgba(255, 255, 255, 0.28)',
    gridLineColor: 'rgba(16, 185, 129, 0.18)',
    accentGlow: '#8B5CF6',
    voidColor: '#052E16'
  }
];

export interface FloodColorDef {
  name: string;
  fill: string;
  dark: string;
  glow: string;
}

export const PALETTE: FloodColorDef[] = [
  { name: 'Crimson', fill: '#EF4444', dark: '#991B1B', glow: '#F87171' },
  { name: 'Cobalt', fill: '#3B82F6', dark: '#1E40AF', glow: '#60A5FA' },
  { name: 'Emerald', fill: '#10B981', dark: '#065F46', glow: '#34D399' },
  { name: 'Amber', fill: '#F59E0B', dark: '#92400E', glow: '#FBBF24' },
  { name: 'Purple', fill: '#8B5CF6', dark: '#5B21B6', glow: '#A78BFA' },
  { name: 'Cyan', fill: '#06B6D4', dark: '#155E75', glow: '#22D3EE' }
];

interface FloodCell {
  col: number;
  row: number;
  x: number;
  y: number;
  colorIdx: number; // 0..5
  owner: PlayerId | null; // Player who owns this cell
  captureAnim: number; // 0..1 scale bounce
  isVoid: boolean;
  stolenAnim: number;
}

interface PlayerFloodState {
  id: PlayerId;
  currentColor: number;
  selectedColorIdx: number;
  score: number; // cells owned
  territoryCount: number;
  lastActionTime: number;
  botReactionTimer: number;
  streak: number;
  burstCharge: number; // 0 to 4
  mood: CharacterMood;
  moodTimer: number;
  isUnderdog: boolean;
}

export class ColorFloodGame extends BaseGame {
  private gridCols = 15;
  private gridRows = 11;
  private grid: FloodCell[][] = [];
  private playerStates: Map<PlayerId, PlayerFloodState> = new Map();
  private totalValidCells = 0;
  public currentTheme: FloodTheme = 'quarry';
  private mapSeed: number = 0;
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;

  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.bindKeyboardShortcuts();
    this.bindCanvasPointer();
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 50.0;
    this.isFinished = false;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;
    this.mapSeed = Math.floor(Math.random() * 10000);

    this.playerStates.clear();
    const active = this.getActivePlayers();
    const startingColors = [0, 1, 2, 3]; // Crimson, Cobalt, Emerald, Amber

    active.forEach((p, idx) => {
      const initColor = startingColors[idx % startingColors.length];
      this.playerStates.set(p.id, {
        id: p.id,
        currentColor: initColor,
        selectedColorIdx: (initColor + 1) % PALETTE.length,
        score: 1,
        territoryCount: 1,
        lastActionTime: 0,
        botReactionTimer: 0.2 + idx * 0.08,
        streak: 0,
        burstCharge: 0,
        mood: 'idle',
        moodTimer: 0,
        isUnderdog: false
      });
    });

    this.generateMap(width, height);
    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__COLOR_FLOOD_DEBUG__ = {
        get players() { return Array.from(self.playerStates.values()); },
        get grid() { return self.grid; },
        get roundTimer() { return self.roundTimer; },
        get isFinished() { return self.isFinished; },
        get theme() { return self.currentTheme; },
        setTheme: (t: FloodTheme) => self.setFloodTheme(t),
        cycleTheme: () => self.cycleTheme(),
        executeFlood: (pid: PlayerId, color: number) => self.executeFlood(pid, color)
      };
    }
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setFloodTheme('quarry');
      } else if (e.key === '2') {
        this.setFloodTheme('mosaic');
      } else if (e.key === '3') {
        this.setFloodTheme('flora');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private bindCanvasPointer(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      this.handlePointerDown(e);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.cycleTheme();
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setFloodTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setFloodTheme(theme: FloodTheme): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#06B6D4', 12);
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      const canvas = this.input.getCanvas();
      if (canvas && this.boundPointerDown) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
        this.boundPointerDown = null;
      }
      delete (window as any).__COLOR_FLOOD_DEBUG__;
    }
  }

  private generateMap(width: number, height: number): void {
    this.grid = [];
    this.totalValidCells = 0;

    const cellW = Math.min((width * 0.68) / this.gridCols, (height * 0.62) / this.gridRows);
    const startX = (width - this.gridCols * cellW) / 2;
    const startY = (height - this.gridRows * cellW) / 2 + 14;

    for (let c = 0; c < this.gridCols; c++) {
      this.grid[c] = [];
      for (let r = 0; r < this.gridRows; r++) {
        // Corners reserved for players
        const isCorner0 = c === 0 && r === 0;
        const isCorner1 = c === this.gridCols - 1 && r === 0;
        const isCorner2 = c === 0 && r === this.gridRows - 1;
        const isCorner3 = c === this.gridCols - 1 && r === this.gridRows - 1;

        let isVoid = false;
        const isNearCorner =
          (c <= 1 && r <= 1) ||
          (c >= this.gridCols - 2 && r <= 1) ||
          (c <= 1 && r >= this.gridRows - 2) ||
          (c >= this.gridCols - 2 && r >= this.gridRows - 2);

        if (!isNearCorner) {
          const noise = Math.sin(c * 1.5 + this.mapSeed) * Math.cos(r * 1.8 + this.mapSeed);
          if (noise > 0.68) {
            isVoid = true;
          }
        }

        let colorIdx = Math.floor(Math.random() * PALETTE.length);
        let owner: PlayerId | null = null;

        if (isCorner0 && this.playerStates.has(0)) {
          owner = 0;
          colorIdx = 0;
        } else if (isCorner1 && this.playerStates.has(1)) {
          owner = 1;
          colorIdx = 1;
        } else if (isCorner2 && this.playerStates.has(2)) {
          owner = 2;
          colorIdx = 2;
        } else if (isCorner3 && this.playerStates.has(3)) {
          owner = 3;
          colorIdx = 3;
        }

        if (!isVoid) this.totalValidCells++;

        this.grid[c][r] = {
          col: c,
          row: r,
          x: startX + c * cellW + cellW / 2,
          y: startY + r * cellW + cellW / 2,
          colorIdx,
          owner,
          captureAnim: owner !== null ? 1 : 0,
          isVoid,
          stolenAnim: 0
        };
      }
    }

    this.recalculateScores();
  }

  private recalculateScores(): void {
    const counts = new Map<PlayerId, number>();
    for (const p of this.getActivePlayers()) {
      counts.set(p.id, 0);
    }

    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.owner !== null && counts.has(cell.owner)) {
          counts.set(cell.owner, (counts.get(cell.owner) || 0) + 1);
        }
      }
    }

    for (const [pid, count] of counts.entries()) {
      const ps = this.playerStates.get(pid);
      if (ps) {
        ps.score = count;
        ps.territoryCount = count;
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Underdog status (trailing leader by >= 15% of valid cells)
    this.updateUnderdogStatus();

    // Sudden Death Overdrive at 15s remaining
    if (this.roundTimer <= 15 && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.dissolveVoidBlocks();
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText('CHROMATIC OVERDRIVE! ⚡ 2X EXPANSION', width / 2, 78, '#F59E0B', 24);
    }

    // Handle bot AI
    this.updateBots(dt, width, height);

    // Human controls
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      if (ps.moodTimer > 0) {
        ps.moodTimer = Math.max(0, ps.moodTimer - dt);
        if (ps.moodTimer <= 0) ps.mood = 'idle';
      }

      if (p.type === 'human') {
        const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);
        const steer = this.input.getSteer(p.id);

        if (justPressed) {
          this.executeFlood(ps.id, ps.selectedColorIdx);
        } else if (Math.abs(steer) > 0.4) {
          if (Date.now() - ps.lastActionTime > 180) {
            ps.lastActionTime = Date.now();
            const step = steer > 0 ? 1 : -1;
            ps.selectedColorIdx = (ps.selectedColorIdx + step + PALETTE.length) % PALETTE.length;
            this.audio.playTap();
          }
        }
      }
    }

    // Cell capture animation decay
    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.captureAnim > 0) {
          cell.captureAnim = Math.max(0, cell.captureAnim - dt * 2.8);
        }
        if (cell.stolenAnim > 0) {
          cell.stolenAnim = Math.max(0, cell.stolenAnim - dt * 3.0);
        }
      }
    }

    // Check win condition (>50% of arena or timer 0)
    for (const ps of this.playerStates.values()) {
      if (ps.score >= this.totalValidCells * 0.5) {
        this.isFinished = true;
        this.audio.playFanfare();
        return;
      }
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private updateUnderdogStatus(): void {
    const players = Array.from(this.playerStates.values());
    if (players.length < 2) return;

    let maxScore = -1;
    for (const p of players) {
      if (p.score > maxScore) maxScore = p.score;
    }

    const threshold = Math.max(6, Math.floor(this.totalValidCells * 0.15));
    for (const p of players) {
      p.isUnderdog = maxScore - p.score >= threshold;
    }
  }

  private dissolveVoidBlocks(): void {
    // In sudden death, dissolve void obstacles into accessible wild cells
    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.isVoid) {
          cell.isVoid = false;
          cell.colorIdx = Math.floor(Math.random() * PALETTE.length);
          cell.captureAnim = 1.0;
          this.totalValidCells++;
          this.particles.spawnExplosion(cell.x, cell.y, '#F59E0B', 8);
        }
      }
    }
  }

  private getNextLegalColor(playerId: PlayerId, startIdx: number): number {
    const unavailable = new Set<number>();
    const ps = this.playerStates.get(playerId);
    if (ps) unavailable.add(ps.currentColor);
    for (const other of this.playerStates.values()) {
      if (other.id !== playerId) unavailable.add(other.currentColor);
    }

    for (let i = 0; i < PALETTE.length; i++) {
      const idx = (startIdx + i) % PALETTE.length;
      if (!unavailable.has(idx)) return idx;
    }
    return (startIdx + 1) % PALETTE.length;
  }

  private executeFlood(playerId: PlayerId, targetColorIdx: number): boolean {
    const ps = this.playerStates.get(playerId);
    if (!ps) return false;

    // Disallow picking own current color
    if (targetColorIdx === ps.currentColor) {
      ps.selectedColorIdx = this.getNextLegalColor(playerId, targetColorIdx + 1);
      return false;
    }

    // Disallow picking another player's active current color
    for (const other of this.playerStates.values()) {
      if (other.id !== playerId && other.currentColor === targetColorIdx) {
        ps.selectedColorIdx = this.getNextLegalColor(playerId, targetColorIdx + 1);
        return false;
      }
    }

    ps.currentColor = targetColorIdx;

    // Flood fill from all cells owned by this player
    const owned: FloodCell[] = [];
    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.owner === playerId) {
          cell.colorIdx = targetColorIdx;
          cell.captureAnim = 1.0;
          owned.push(cell);
        }
      }
    }

    // Expand into adjacent cells matching targetColorIdx
    // Includes Territory Stealing: if neighbor is owned by a rival, convert & steal it!
    let newlyCaptured = 0;
    let stolenCount = 0;
    const queue = [...owned];
    const visited = new Set<string>();
    owned.forEach((c) => visited.add(`${c.col},${c.row}`));

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const [dc, dr] of dirs) {
        const nc = cur.col + dc;
        const nr = cur.row + dr;
        if (nc >= 0 && nc < this.gridCols && nr >= 0 && nr < this.gridRows) {
          const key = `${nc},${nr}`;
          if (!visited.has(key)) {
            visited.add(key);
            const neighbor = this.grid[nc][nr];
            if (!neighbor.isVoid && (neighbor.owner === null || neighbor.owner !== playerId)) {
              if (neighbor.colorIdx === targetColorIdx) {
                if (neighbor.owner !== null) {
                  // Territory Incursion / Steal!
                  stolenCount++;
                  neighbor.stolenAnim = 1.0;
                  const prevOwner = this.playerStates.get(neighbor.owner);
                  if (prevOwner) {
                    prevOwner.mood = 'shocked';
                    prevOwner.moodTimer = 1.2;
                  }
                }
                neighbor.owner = playerId;
                neighbor.captureAnim = 1.0;
                newlyCaptured++;
                queue.push(neighbor);

                this.particles.emit(neighbor.x, neighbor.y, 6, PALETTE[targetColorIdx].fill);
              }
            }
          }
        }
      }
    }

    // Prism Burst Check: charge meter
    ps.burstCharge++;
    const burstThreshold = ps.isUnderdog ? 2 : 4;
    if (ps.burstCharge >= burstThreshold && newlyCaptured > 0) {
      ps.burstCharge = 0;
      this.triggerPrismBurst(playerId);
    }

    this.recalculateScores();

    if (newlyCaptured > 0) {
      ps.streak++;
      ps.mood = 'triumph';
      ps.moodTimer = 0.8;
      this.audio.playChime();

      if (stolenCount > 0) {
        this.audio.playBounce();
        this.particles.shake(0.25);
        this.particles.showFloatingText(`TERRITORY STEAL! +${stolenCount}`, this.lastWidth / 2, 108, '#EC4899', 18);
      }
    } else {
      this.audio.playTap();
      ps.streak = 0;
    }

    // Auto-advance selected color to highest-gain legal color for fluid single-touch play!
    let bestNext = this.getNextLegalColor(playerId, targetColorIdx + 1);
    let bestGain = -1;
    for (let c = 0; c < PALETTE.length; c++) {
      if (c === ps.currentColor) continue;
      let isOpponent = false;
      for (const o of this.playerStates.values()) {
        if (o.id !== playerId && o.currentColor === c) isOpponent = true;
      }
      if (isOpponent) continue;

      const gain = this.simulateGain(playerId, c);
      if (gain > bestGain) {
        bestGain = gain;
        bestNext = c;
      }
    }
    ps.selectedColorIdx = bestNext;
    return true;
  }

  private triggerPrismBurst(playerId: PlayerId): void {
    const ps = this.playerStates.get(playerId);
    if (!ps) return;

    this.audio.playFanfare();
    this.particles.shake(0.3);

    // Convert an extra outer ring of non-void cells adjacent to current territory
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];
    let burstCaptured = 0;

    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.owner === playerId) {
          for (const [dc, dr] of dirs) {
            const nc = c + dc;
            const nr = r + dr;
            if (nc >= 0 && nc < this.gridCols && nr >= 0 && nr < this.gridRows) {
              const neighbor = this.grid[nc][nr];
              if (!neighbor.isVoid && neighbor.owner === null) {
                neighbor.owner = playerId;
                neighbor.colorIdx = ps.currentColor;
                neighbor.captureAnim = 1.0;
                burstCaptured++;
                this.particles.spawnExplosion(neighbor.x, neighbor.y, PALETTE[ps.currentColor].fill, 6);
              }
            }
          }
        }
      }
    }

    if (burstCaptured > 0) {
      this.particles.showFloatingText('PRISM BURST! 🌟', this.lastWidth / 2, 108, '#F59E0B', 22);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playerStates.get(botId);
    if (!ps) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const baseDelay =
      difficulty === 'bot_hard'
        ? 0.18 + Math.random() * 0.08
        : difficulty === 'bot_normal'
        ? 0.30 + Math.random() * 0.15
        : 0.55 + Math.random() * 0.25;
    ps.botReactionTimer = baseDelay;

    const unavailableColors = new Set<number>();
    unavailableColors.add(ps.currentColor);
    for (const other of this.playerStates.values()) {
      if (other.id !== botId) unavailableColors.add(other.currentColor);
    }

    let bestColor = -1;
    let maxScore = -1;

    for (let c = 0; c < PALETTE.length; c++) {
      if (unavailableColors.has(c)) continue;

      let score = this.simulateGain(botId, c);

      // On Hard: add strategic 2-step foresight and deny leader's best color
      if (difficulty === 'bot_hard') {
        let denialBonus = 0;
        for (const other of this.playerStates.values()) {
          if (other.id !== botId && other.score > ps.score) {
            const rivalGain = this.simulateGain(other.id, c);
            if (rivalGain >= 3) denialBonus += rivalGain * 0.6; // deny leader!
          }
        }
        score += denialBonus;
      }

      if (score > maxScore) {
        maxScore = score;
        bestColor = c;
      }
    }

    if (difficulty === 'bot_easy' && Math.random() < 0.32) {
      const available = Array.from({ length: PALETTE.length }, (_, i) => i).filter(
        (i) => !unavailableColors.has(i)
      );
      if (available.length > 0) {
        bestColor = available[Math.floor(Math.random() * available.length)];
      }
    } else if (maxScore <= 0) {
      const available = Array.from({ length: PALETTE.length }, (_, i) => i).filter(
        (i) => !unavailableColors.has(i)
      );
      if (available.length > 0) {
        bestColor = available[Math.floor(Math.random() * available.length)];
      }
    }

    if (bestColor !== -1) {
      this.executeFlood(botId, bestColor);
    }
  }

  private simulateGain(botId: PlayerId, colorIdx: number): number {
    const queue: FloodCell[] = [];
    const visited = new Set<string>();

    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.owner === botId) {
          queue.push(cell);
          visited.add(`${c},${r}`);
        }
      }
    }

    let gain = 0;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const [dc, dr] of dirs) {
        const nc = cur.col + dc;
        const nr = cur.row + dr;
        if (nc >= 0 && nc < this.gridCols && nr >= 0 && nr < this.gridRows) {
          const key = `${nc},${nr}`;
          if (!visited.has(key)) {
            visited.add(key);
            const neighbor = this.grid[nc][nr];
            if (!neighbor.isVoid && neighbor.owner !== botId && neighbor.colorIdx === colorIdx) {
              gain++;
              // Bonus weighting for stealing from an opponent
              if (neighbor.owner !== null) gain += 1.5;
              queue.push(neighbor);
            }
          }
        }
      }
    }

    return gain;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;

    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme) || THEME_CONFIGS[0];

    // 1. Board Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, cfg.bgGradient[0]);
    bgGrad.addColorStop(1, cfg.bgGradient[1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Circuit / Board Outer Border
    ctx.save();
    ctx.strokeStyle = cfg.boardBorder;
    ctx.lineWidth = 3;
    ctx.shadowColor = cfg.accentGlow;
    ctx.shadowBlur = this.roundTimer <= 15 ? 16 + Math.sin(this.animTimer * 10) * 8 : 8;
    ctx.strokeRect(width * 0.14, height * 0.17, width * 0.72, height * 0.75);
    ctx.restore();

    // 2. Grid Cells
    const cellW = Math.min((width * 0.68) / this.gridCols, (height * 0.62) / this.gridRows);
    const rad = 5;

    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.isVoid) {
          ctx.fillStyle = cfg.voidColor;
          ctx.fillRect(cell.x - cellW / 2 + 2, cell.y - cellW / 2 + 2, cellW - 4, cellW - 4);
          continue;
        }

        const colDef = PALETTE[cell.colorIdx];
        const scale = 1 + cell.captureAnim * 0.22;
        const curW = (cellW - 3) * scale;

        ctx.save();
        ctx.translate(cell.x, cell.y);

        // Cell shadow / bevel
        ctx.fillStyle = colDef.dark;
        ctx.beginPath();
        ctx.roundRect(-curW / 2, -curW / 2 + 2, curW, curW, rad);
        ctx.fill();

        // Main cell face
        ctx.fillStyle = colDef.fill;
        ctx.beginPath();
        ctx.roundRect(-curW / 2, -curW / 2, curW, curW - 2, rad);
        ctx.fill();

        // Highlight glint bevel
        ctx.fillStyle = cfg.tileBevel;
        ctx.fillRect(-curW / 2 + 2, -curW / 2 + 2, curW - 4, 3);

        // Stolen incursion flash
        if (cell.stolenAnim > 0) {
          ctx.fillStyle = `rgba(236, 72, 153, ${cell.stolenAnim * 0.6})`;
          ctx.fill();
        }

        // Owner crest / indicator
        if (cell.owner !== null) {
          const ownerConfig = this.players.find((p) => p.id === cell.owner);
          if (ownerConfig) {
            ctx.fillStyle = ownerConfig.color;
            ctx.beginPath();
            ctx.arc(0, -1, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    }

    // 3. Player Corner Podiums & Mascot Avatars
    this.renderPlayerCornerCards(ctx, width, height, cfg);

    // 4. Center Sub-Header Badge (y: 56, h: 26 - respects top-center y:12-44 safe zone)
    this.renderSubHeaderBadge(ctx, width, cfg);

    // 5. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, cfg);

    // 6. Control Hints (bottom-right x: width - 20, y: height - 28, textAlign: right)
    this.renderControlsHUD(ctx, width, height);
  }

  private renderPlayerCornerCards(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cfg: ThemeConfig
  ): void {
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      let px = 20;
      let py = 16;
      let mascotX = px + 175;
      let mascotY = py + 36;

      if (p.corner === 'top-right') {
        px = width - 180;
        mascotX = px - 20;
      } else if (p.corner === 'bottom-left') {
        // Place neatly above theme pill (theme pill is at y: height - 44)
        py = height - 134;
        mascotY = py + 36;
      } else if (p.corner === 'bottom-right') {
        px = width - 180;
        py = height - 134;
        mascotX = px - 20;
        mascotY = py + 36;
      }

      // Container Card
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.beginPath();
      ctx.roundRect(px, py, 160, 78, 8);
      ctx.fill();

      // Card border (dashed gold if Underdog)
      if (ps.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
      } else {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.restore();

      // Name & Score
      ctx.fillStyle = p.color;
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 18);

      const percent = Math.round((ps.score / Math.max(1, this.totalValidCells)) * 100);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 13px Inter, monospace';
      ctx.fillText(`${ps.score} tiles (${percent}%)`, px + 10, py + 35);

      // Color Palette bar
      const barY = py + 44;
      const swW = 18;
      PALETTE.forEach((pal, i) => {
        const swX = px + 10 + i * (swW + 5);
        const isCurrent = ps.currentColor === i;
        const isSelected = ps.selectedColorIdx === i;

        let isOpponent = false;
        for (const o of this.playerStates.values()) {
          if (o.id !== p.id && o.currentColor === i) isOpponent = true;
        }

        ctx.fillStyle = isOpponent ? '#475569' : pal.fill;
        ctx.fillRect(swX, barY, swW, swW);

        if (isSelected && !isOpponent) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(swX - 2, barY - 2, swW + 4, swW + 4);
        }

        if (isCurrent) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(swX + swW / 2, barY + swW / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Quick tap hint
      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 9px Inter, sans-serif';
      ctx.fillText('Tap: Flood | Steer: Pick', px + 10, py + 72);

      // Render Mascot Avatar alongside the card
      const isBot = p.type !== 'human';
      ctx.save();
      drawCharacter(ctx, mascotX, mascotY, 13, ps.id, isBot, ps.mood, this.animTimer);
      ctx.restore();
    }
  }

  private renderSubHeaderBadge(ctx: CanvasRenderingContext2D, width: number, cfg: ThemeConfig): void {
    const podW = 320;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56; // Safe zone below top-center timer y: 12-44

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = cfg.boardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`ARENA: ${cfg.name}`, podX + 16, podY + 17);

    // Overdrive Status
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('⚡ OVERDRIVE 2X', podX + podW - 16, podY + 17);
    } else {
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('TERRITORY INVASION', podX + podW - 16, podY + 17);
    }
    ctx.restore();
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, cfg: ThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = cfg.boardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(cfg.badge, pillX + 12, pillY + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + 20);
    ctx.restore();
  }

  private renderControlsHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.fillText('Tap: Flood Color | Steer: Cycle Palette | Steal Rival Borders!', width - 20, height - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.playerStates.get(a.id)?.score || 0;
      const sb = this.playerStates.get(b.id)?.score || 0;
      return sb - sa;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topScore = this.playerStates.get(winnerId ?? 0)?.score || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.playerStates.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Dominant expansion! Captured ${topScore} tiles across ${this.currentTheme}!`
    };
  }
}
