/**
 * Renderer.js
 * Core 16:9 Scalable Viewport & 2D-to-WebGL Framebuffer Renderer for Retro Arcade Studio.
 * Coordinates offscreen 2D canvas drawing, particle/shake effects, pixel-art sprite matrices,
 * HighScore LocalStorage persistence, and the WebGL CRT Post-Processing pipeline.
 */
import { CRTOverlay } from '../ui/CRTOverlay.js';
import { wasmCore } from './WasmCore.js';

export const PALETTE = {
  BG: '#0B0F19',     // Deep space background
  CYAN: '#00F0FF',   // Electric Cyan
  PINK: '#FF007A',   // Neon Pink
  GOLD: '#FFD700',   // Arcade Gold
  GREEN: '#00FF66',  // Vivid Green
  ORANGE: '#FF8800',
  PURPLE: '#B829FF',
  RED: '#FF2A55',
  BLUE: '#38BDF8',
  WHITE: '#F8FAFC',
  MUTED: '#94A3B8',
  PANEL: '#131B2E'
};

export const FONTS = {
  HEADER: "'Press Start 2P', 'Courier New', monospace",
  HUD: "'Space Grotesk', system-ui, -apple-system, sans-serif",
  BODY: "'Inter', system-ui, -apple-system, sans-serif"
};

const HIGHSCORE_STORAGE_KEY = 'retro_arcade_studio_highscores_v1';

const DEFAULT_HIGHSCORES = {
  loderunner: 12500,
  digdug: 18400,
  donkeykong: 22000,
  sumo: 9500,
  pacman: 25600,
  frogger: 14200,
  galaga: 30000,
  spaceinvaders: 16500,
  asteroids: 15000,
  centipede: 14000,
  defender: 19500,
  arkanoid: 17000,
  paperboy: 11000,
  joust: 13500,
  qbert: 12800,
  rampage: 16000,
  marblemadness: 14500,
  pitfall: 15400,
  duckhunt: 12000,
  excitebike: 13200,
  missilecommand: 14800,
  burgertime: 13600,
  bubblebobble: 16800,
  spyhunter: 15200,
  tron: 11800,
  trackandfield: 10500,
  outrun: 24000,
  contra: 21000
};

export class HighScoreStore {
  static loadAll() {
    try {
      const raw = localStorage.getItem(HIGHSCORE_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(DEFAULT_HIGHSCORES));
        return { ...DEFAULT_HIGHSCORES };
      }
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_HIGHSCORES, ...parsed };
    } catch (_) {
      return { ...DEFAULT_HIGHSCORES };
    }
  }

  static get(gameId) {
    const key = String(gameId || '').toLowerCase();
    const all = HighScoreStore.loadAll();
    return all[key] || 5000;
  }

  static submit(gameId, score) {
    const key = String(gameId || '').toLowerCase();
    const numeric = Math.floor(Number(score) || 0);
    const all = HighScoreStore.loadAll();
    const prev = all[key] || 0;
    const isNew = numeric > prev;
    if (isNew) {
      all[key] = numeric;
      try {
        localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(all));
      } catch (_) {
        // Ignore storage quota errors
      }
    } else {
      // Ensure storage key is initialized even if score didn't beat default
      try {
        if (!localStorage.getItem(HIGHSCORE_STORAGE_KEY)) {
          localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(all));
        }
      } catch (_) {}
    }
    return { highScore: Math.max(prev, numeric), isNew };
  }
}

export class Renderer {
  constructor(displayCanvas, viewportContainer = null) {
    this.width = 960;
    this.height = 540;
    this.displayCanvas = displayCanvas;
    this.viewportContainer = viewportContainer || (displayCanvas ? displayCanvas.parentElement : null);

    // Offscreen 2D framebuffer where all games draw
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCanvas.width = this.width;
    this.bufferCanvas.height = this.height;
    this.ctx = this.bufferCanvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    if (this.displayCanvas) {
      this.displayCanvas.width = this.width;
      this.displayCanvas.height = this.height;
    }

    // Wrap the display canvas in the WebGL CRT post-processing shader pipeline
    this.crt = new CRTOverlay(this.displayCanvas, this.bufferCanvas);
    this.wasm = wasmCore;

    this.shakeTime = 0;
    this.shakeIntensity = 0;

    this.resizeViewport();
    this._onResize = () => this.resizeViewport();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
  }

  /**
   * Responsive 16:9 viewport scaling across Desktop, Tablet, and Mobile Phone (Portrait & Landscape)
   */
  resizeViewport() {
    if (!this.displayCanvas || !this.viewportContainer) return;
    const rect = this.viewportContainer.getBoundingClientRect();
    const touchEl = typeof document !== 'undefined' ? document.getElementById('arcade-touch-overlay') : null;
    const touchVisible = !!(touchEl && touchEl.classList.contains('visible'));
    const winW = window.innerWidth || rect.width || 960;
    const winH = window.innerHeight || rect.height || 540;
    const isPortrait = winH >= winW;
    const isPhoneLandscape = !isPortrait && winH <= 500 && touchVisible;

    let reservedBottom = 0;
    let reservedSides = 0;

    if (touchVisible) {
      if (isPortrait) {
        reservedBottom = winW <= 520 ? 186 : 196;
      } else if (isPhoneLandscape) {
        // In compact phone landscape, D-Pad and Action A/B sit in left/right gutters
        reservedSides = Math.min(250, Math.max(180, winW * 0.26));
        reservedBottom = 8;
      } else {
        // Tablet / desktop touch preview in landscape
        reservedBottom = 168;
      }
    }

    const availW = Math.max(220, rect.width - 12 - reservedSides);
    const availH = Math.max(130, rect.height - 12 - reservedBottom);
    const targetAspect = 16 / 9;

    let drawW = availW;
    let drawH = drawW / targetAspect;
    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * targetAspect;
    }

    this.displayCanvas.style.width = `${Math.floor(drawW)}px`;
    this.displayCanvas.style.height = `${Math.floor(drawH)}px`;
  }

  shake(intensity = 6, duration = 0.2) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  beginFrame(dt = 0.016) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = PALETTE.BG;
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      const ox = (Math.random() * 2 - 1) * this.shakeIntensity;
      const oy = (Math.random() * 2 - 1) * this.shakeIntensity;
      ctx.translate(ox, oy);
      if (this.shakeTime <= 0) {
        this.shakeIntensity = 0;
      }
    }
  }

  endFrame() {
    this.ctx.restore();
    this.crt.render();
  }

  clear(color = PALETTE.BG) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawGlowRect(x, y, w, h, color, blur = 10, fill = true, lineWidth = 2) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    if (fill) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }

  drawGlowCircle(x, y, r, color, blur = 10, fill = true, lineWidth = 2) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawText(text, x, y, {
    font = FONTS.HUD,
    size = 16,
    color = PALETTE.WHITE,
    align = 'left',
    baseline = 'alphabetic',
    glow = 0,
    glowColor = null,
    bold = true
  } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${bold ? '700 ' : ''}${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (glow > 0) {
      ctx.shadowColor = glowColor || color;
      ctx.shadowBlur = glow;
    }
    ctx.fillText(String(text), x, y);
    ctx.restore();
  }

  /**
   * Renders a pixel art matrix where each character in strings maps to a hex color
   */
  drawPixelSprite(rows, x, y, scale = 2, palette = {}, flipX = false, flipY = false) {
    const ctx = this.ctx;
    const h = rows.length;
    const w = rows[0] ? rows[0].length : 0;
    for (let r = 0; r < h; r++) {
      const rowStr = rows[r];
      for (let c = 0; c < w; c++) {
        const ch = rowStr[c];
        if (ch === '.' || ch === ' ' || !palette[ch]) continue;
        const drawC = flipX ? w - 1 - c : c;
        const drawR = flipY ? h - 1 - r : r;
        ctx.fillStyle = palette[ch];
        ctx.fillRect(
          Math.round(x + drawC * scale),
          Math.round(y + drawR * scale),
          Math.ceil(scale),
          Math.ceil(scale)
        );
      }
    }
  }

  /**
   * Draws a standardized top arcade HUD bar (38px height)
   */
  drawHUD({
    title = 'ARCADE',
    score = 0,
    highScore = 0,
    lives = 3,
    level = 1,
    extraLabel = '',
    accent = PALETTE.CYAN
  } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 25, 0.92)';
    ctx.fillRect(0, 0, this.width, 38);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 38);
    ctx.lineTo(this.width, 38);
    ctx.stroke();

    // Game Title
    this.drawText(title.toUpperCase(), 16, 25, {
      font: FONTS.HEADER,
      size: 13,
      color: accent,
      glow: 8
    });

    // 1UP Score
    this.drawText(`1UP: ${String(Math.floor(score)).padStart(6, '0')}`, 275, 25, {
      font: FONTS.HUD,
      size: 16,
      color: PALETTE.WHITE
    });

    // HIGH SCORE
    this.drawText(`HI: ${String(Math.floor(Math.max(score, highScore))).padStart(6, '0')}`, 455, 25, {
      font: FONTS.HUD,
      size: 16,
      color: PALETTE.GOLD,
      glow: 6
    });

    // Level / Wave
    this.drawText(`LV:${level}`, 640, 25, {
      font: FONTS.HUD,
      size: 15,
      color: PALETTE.GREEN
    });

    if (extraLabel) {
      this.drawText(extraLabel, 720, 25, {
        font: FONTS.HUD,
        size: 14,
        color: PALETTE.CYAN
      });
    }

    // Lives indicator on far right
    const maxLivesIcons = Math.max(0, Math.min(6, lives));
    this.drawText('LIVES:', 835, 25, {
      font: FONTS.HUD,
      size: 13,
      color: PALETTE.MUTED
    });
    for (let i = 0; i < maxLivesIcons; i++) {
      ctx.fillStyle = PALETTE.PINK;
      ctx.shadowColor = PALETTE.PINK;
      ctx.shadowBlur = 6;
      ctx.fillRect(885 + i * 11, 14, 7, 12);
    }
    ctx.restore();
  }

  /**
   * Standard state overlay for MENU, PAUSED, and GAMEOVER states
   */
  drawStateOverlay(state, {
    title = '',
    subtitle = '',
    controls = 'ARROWS/WASD: MOVE  |  Z/SPACE: ACTION A  |  X/SHIFT: ACTION B  |  P: PAUSE',
    score = 0,
    highScore = 0,
    accent = PALETTE.CYAN
  } = {}) {
    if (state === 'PLAYING') return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 25, 0.80)';
    ctx.fillRect(0, 38, this.width, this.height - 38);

    const boxW = 620;
    const boxH = 270;
    const bx = (this.width - boxW) / 2;
    const by = (this.height - boxH) / 2 + 10;

    ctx.fillStyle = 'rgba(19, 27, 46, 0.96)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = state === 'GAMEOVER' ? PALETTE.PINK : accent;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = state === 'GAMEOVER' ? PALETTE.PINK : accent;
    ctx.shadowBlur = 16;
    ctx.strokeRect(bx, by, boxW, boxH);
    ctx.shadowBlur = 0;

    const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.006);

    if (state === 'MENU') {
      this.drawText(title.toUpperCase(), this.width / 2, by + 58, {
        font: FONTS.HEADER,
        size: 22,
        color: accent,
        align: 'center',
        glow: 12
      });
      this.drawText(subtitle || 'MODERNIZED COIN-OP EDITION', this.width / 2, by + 95, {
        font: FONTS.HUD,
        size: 15,
        color: PALETTE.GOLD,
        align: 'center'
      });
      this.drawText(controls, this.width / 2, by + 145, {
        font: FONTS.BODY,
        size: 13,
        color: PALETTE.WHITE,
        align: 'center'
      });
      ctx.globalAlpha = pulse;
      this.drawText('PRESS [SPACE / Z / TAP] TO START COIN-OP', this.width / 2, by + 205, {
        font: FONTS.HEADER,
        size: 14,
        color: PALETTE.GREEN,
        align: 'center',
        glow: 10
      });
      ctx.globalAlpha = 1;
      this.drawText(`RECORD HIGH SCORE: ${String(highScore).padStart(6, '0')}`, this.width / 2, by + 242, {
        font: FONTS.HUD,
        size: 14,
        color: PALETTE.MUTED,
        align: 'center'
      });
    } else if (state === 'PAUSED') {
      this.drawText('SYSTEM PAUSED', this.width / 2, by + 72, {
        font: FONTS.HEADER,
        size: 24,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 12
      });
      this.drawText(controls, this.width / 2, by + 130, {
        font: FONTS.BODY,
        size: 13,
        color: PALETTE.WHITE,
        align: 'center'
      });
      ctx.globalAlpha = pulse;
      this.drawText('PRESS [P / SPACE / Z] TO RESUME  |  [BACKSPACE] STUDIO LOBBY', this.width / 2, by + 195, {
        font: FONTS.HUD,
        size: 15,
        color: PALETTE.CYAN,
        align: 'center'
      });
      ctx.globalAlpha = 1;
    } else if (state === 'GAMEOVER') {
      this.drawText('GAME OVER', this.width / 2, by + 62, {
        font: FONTS.HEADER,
        size: 26,
        color: PALETTE.PINK,
        align: 'center',
        glow: 14
      });
      this.drawText(`FINAL SCORE: ${String(Math.floor(score)).padStart(6, '0')}`, this.width / 2, by + 115, {
        font: FONTS.HUD,
        size: 20,
        color: PALETTE.WHITE,
        align: 'center'
      });
      this.drawText(`HIGH SCORE: ${String(Math.floor(Math.max(score, highScore))).padStart(6, '0')}`, this.width / 2, by + 150, {
        font: FONTS.HUD,
        size: 16,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 8
      });
      ctx.globalAlpha = pulse;
      this.drawText('PRESS [SPACE / Z / TAP] TO PLAY AGAIN', this.width / 2, by + 205, {
        font: FONTS.HEADER,
        size: 13,
        color: PALETTE.GREEN,
        align: 'center',
        glow: 8
      });
      ctx.globalAlpha = 1;
      this.drawText('OR CLICK [STUDIO LOBBY] TO SWITCH CABINETS', this.width / 2, by + 240, {
        font: FONTS.BODY,
        size: 13,
        color: PALETTE.MUTED,
        align: 'center'
      });
    }

    ctx.restore();
  }
}

export default Renderer;
