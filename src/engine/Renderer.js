/**
 * Renderer.js
 * Core 16:9 Scalable Viewport & 2D-to-WebGL Framebuffer Renderer for Retro Arcade Studio.
 * Coordinates offscreen 2D canvas drawing, particle/shake effects, pixel-art sprite matrices,
 * HighScore LocalStorage + Firebase Cloud Sync persistence, 3-Initial Champion Entry,
 * Rewind VHS overlay, Achievement Toasts, and the WebGL CRT Post-Processing pipeline.
 */
import { CRTOverlay } from '../ui/CRTOverlay.js';
import { wasmCore } from './WasmCore.js';
import {
  cloudPersistence,
  achievementManager,
  InitialsStore
} from './CloudPersistence.js';

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
const HOLDERS_STORAGE_KEY = 'retro_arcade_studio_holders_v1';

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
  contra: 21000,
  galaxian: 14200,
  digdug2: 15800,
  elevatoraction: 16500,
  tapper: 13900,
  lunarlander: 11500,
  tempest: 22400,
  robotron: 28000,
  sinistar: 25600,
  crystalcastles: 17200,
  zaxxon: 19400,
  moonpatrol: 14600,
  pengo: 15200,
  rallyx: 13800,
  roadfighter: 16400,
  flicky: 14900,
  mappy: 15600,
  circuscharlie: 13400,
  battlecity: 18200,
  kungfumaster: 19800,
  wildgunman: 12600,
  exerion: 15100,
  tetrisretro: 24500
};

export class HighScoreStore {
  static loadAll() {
    try {
      const raw = localStorage.getItem(HIGHSCORE_STORAGE_KEY);
      let scores;
      if (!raw) {
        localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(DEFAULT_HIGHSCORES));
        scores = { ...DEFAULT_HIGHSCORES };
      } else {
        const parsed = JSON.parse(raw);
        scores = { ...DEFAULT_HIGHSCORES, ...parsed };
      }
      // Merge with Firebase Cloud Persistence records
      for (const id of Object.keys(scores)) {
        const cloudRec = cloudPersistence.getRecord(id);
        if (cloudRec.highScore > scores[id]) {
          scores[id] = cloudRec.highScore;
        } else if (scores[id] > cloudRec.highScore) {
          cloudRec.highScore = scores[id];
        }
      }
      return scores;
    } catch (_) {
      return { ...DEFAULT_HIGHSCORES };
    }
  }

  static get(gameId) {
    const key = String(gameId || '').toLowerCase();
    const all = HighScoreStore.loadAll();
    const cloudRec = cloudPersistence.getRecord(key);
    return Math.max(all[key] || 5000, cloudRec.highScore || 0);
  }

  static getHolder(gameId) {
    const key = String(gameId || '').toLowerCase();
    try {
      const raw = localStorage.getItem(HOLDERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed[key]) return parsed[key];
      }
    } catch (_) {}
    const cloudRec = cloudPersistence.getRecord(key);
    return cloudRec.holder || 'ACE';
  }

  static setHolder(gameId, initials) {
    const key = String(gameId || '').toLowerCase();
    const clean = InitialsStore.setLastInitials(initials);
    try {
      const raw = localStorage.getItem(HOLDERS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[key] = clean;
      localStorage.setItem(HOLDERS_STORAGE_KEY, JSON.stringify(parsed));
    } catch (_) {}
    const cloudRec = cloudPersistence.getRecord(key);
    cloudRec.holder = clean;
    cloudPersistence.saveToLocal();
    return clean;
  }

  static submit(gameId, score, holderInitials = null) {
    const key = String(gameId || '').toLowerCase();
    const numeric = Math.floor(Number(score) || 0);
    const all = HighScoreStore.loadAll();
    const prev = all[key] || 0;
    const isNew = numeric > prev;
    const initials = holderInitials || InitialsStore.getLastInitials();
    if (isNew) {
      all[key] = numeric;
      try {
        localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(all));
      } catch (_) {}
      HighScoreStore.setHolder(key, initials);
    } else {
      try {
        if (!localStorage.getItem(HIGHSCORE_STORAGE_KEY)) {
          localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(all));
        }
      } catch (_) {}
    }
    // Sync to Firebase Cloud Persistence
    cloudPersistence.recordScore(key, Math.max(prev, numeric), isNew ? initials : null);
    if (numeric >= 25000) {
      achievementManager.unlock('high_roller');
    }
    return { highScore: Math.max(prev, numeric), isNew };
  }
}

export class Renderer {
  constructor(displayCanvas, viewportContainer = null) {
    this.width = 960;
    this.height = 540;
    this.displayCanvas = displayCanvas;
    this.viewportContainer =
      viewportContainer || (displayCanvas ? displayCanvas.parentElement : null);

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
    this.flashAlpha = 0;
    this.rewinding = false;
    this.attractMode = false;
    this.timeScale = 1.0;

    // 3-Initial Champion Entry State on Game Over
    this.initialsChars = InitialsStore.getLastInitials().split('');
    this.initialsCursor = 0;

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
    const touchEl =
      typeof document !== 'undefined' ? document.getElementById('arcade-touch-overlay') : null;
    const touchVisible = !!(touchEl && touchEl.classList.contains('visible'));
    const winW = window.innerWidth || rect.width || 960;
    const winH = window.innerHeight || rect.height || 540;
    const isPortrait = winH >= winW;
    const isPhoneLandscape = !isPortrait && winH <= 520 && touchVisible;

    let reservedSides = 0;
    if (isPhoneLandscape) {
      // In compact phone landscape, D-Pad and Action A/B sit in left/right gutters
      reservedSides = Math.min(240, Math.max(170, winW * 0.25));
    }

    // Note: CSS padding-bottom on .arcade-viewport already reserves bottom touch space when needed,
    // so we measure the inner content box of .arcade-viewport directly to avoid double-subtracting!
    const style =
      typeof window !== 'undefined' && window.getComputedStyle
        ? window.getComputedStyle(this.viewportContainer)
        : null;
    const padTop = style ? parseFloat(style.paddingTop) || 0 : 6;
    const padBot = style ? parseFloat(style.paddingBottom) || 0 : 6;
    const padLeft = style ? parseFloat(style.paddingLeft) || 0 : 6;
    const padRight = style ? parseFloat(style.paddingRight) || 0 : 6;

    const availW = Math.max(200, rect.width - padLeft - padRight - reservedSides - 6);
    const availH = Math.max(120, rect.height - padTop - padBot - 6);
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

  triggerFlash(alpha = 0.85) {
    this.flashAlpha = alpha;
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

    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.8);
    }

    achievementManager.update(dt);
  }

  endFrame() {
    const ctx = this.ctx;
    ctx.restore();

    // 1. Rewind Time-Machine VHS Scan Bar Overlay
    if (this.rewinding || (this.rewindOverlay && this.rewindOverlay.active)) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.14)';
      ctx.fillRect(0, 0, this.width, this.height);
      const barY = ((performance.now() * 0.45) % this.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(0, barY, this.width, 18);
      this.drawText('⏪ REWINDING TIME-MACHINE', this.width / 2, 74, {
        font: FONTS.HEADER,
        size: 16,
        color: PALETTE.CYAN,
        align: 'center',
        glow: 14
      });
      ctx.restore();
    }

    // 2. Attract Mode Demo Banner
    if (this.attractMode || (this.attractOverlay && this.attractOverlay.active)) {
      const blink = Math.floor(performance.now() / 420) % 2 === 0;
      ctx.save();
      ctx.fillStyle = 'rgba(11, 15, 25, 0.82)';
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 2;
      ctx.fillRect(190, 488, 580, 36);
      ctx.strokeRect(190, 488, 580, 36);
      if (blink) {
        this.drawText(
          '🎬 ATTRACT DEMO MODE — PRESS ANY KEY OR TAP TO INSERT COIN',
          this.width / 2,
          511,
          {
            font: FONTS.HEADER,
            size: 10.5,
            color: PALETTE.GOLD,
            align: 'center',
            glow: 10
          }
        );
      }
      ctx.restore();
    }

    // 3. Achievement & Emulator Save State Toast Notifications
    if (achievementManager.activeToasts.length > 0) {
      ctx.save();
      achievementManager.activeToasts.forEach((t, idx) => {
        const y = 46 + idx * 52;
        const x = this.width - 332;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = t.color || PALETTE.GOLD;
        ctx.lineWidth = 2;
        ctx.shadowColor = t.color || PALETTE.GOLD;
        ctx.shadowBlur = 12;
        ctx.fillRect(x, y, 320, 44);
        ctx.strokeRect(x, y, 320, 44);
        ctx.shadowBlur = 0;

        this.drawText(t.title, x + 12, y + 19, {
          font: FONTS.HEADER,
          size: 9.5,
          color: t.color || PALETTE.GOLD
        });
        if (t.subtitle) {
          this.drawText(t.subtitle, x + 12, y + 36, {
            font: FONTS.BODY,
            size: 11,
            color: PALETTE.WHITE,
            bold: false
          });
        }
      });
      ctx.restore();
    }

    // 4. Screenshot Shutter Flash
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha.toFixed(2)})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

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

  drawText(
    text,
    x,
    y,
    {
      font = FONTS.HUD,
      size = 16,
      color = PALETTE.WHITE,
      align = 'left',
      baseline = 'alphabetic',
      glow = 0,
      glowColor = null,
      bold = true
    } = {}
  ) {
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

    // HIGH SCORE + Champion Initials
    const holder = InitialsStore.getLastInitials();
    this.drawText(
      `HI(${holder}): ${String(Math.floor(Math.max(score, highScore))).padStart(6, '0')}`,
      435,
      25,
      {
        font: FONTS.HUD,
        size: 15,
        color: PALETTE.GOLD,
        glow: 6
      }
    );

    // Level / Wave
    this.drawText(`LV:${level}`, 640, 25, {
      font: FONTS.HUD,
      size: 15,
      color: PALETTE.GREEN
    });

    if (extraLabel) {
      this.drawText(extraLabel, 710, 25, {
        font: FONTS.HUD,
        size: 13.5,
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
  drawStateOverlay(
    state,
    {
      title = '',
      subtitle = '',
      controls = 'ARROWS/WASD: MOVE  |  Z/SPACE: ACTION A  |  X/SHIFT: ACTION B  |  P: PAUSE',
      score = 0,
      highScore = 0,
      accent = PALETTE.CYAN
    } = {}
  ) {
    if (state === 'PLAYING') return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 25, 0.80)';
    ctx.fillRect(0, 38, this.width, this.height - 38);

    const boxW = 640;
    const boxH = 290;
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
      this.drawText(
        `RECORD HIGH SCORE: ${String(highScore).padStart(6, '0')} (${InitialsStore.getLastInitials()})`,
        this.width / 2,
        by + 248,
        {
          font: FONTS.HUD,
          size: 14,
          color: PALETTE.MUTED,
          align: 'center'
        }
      );
    } else if (state === 'PAUSED') {
      this.drawText('SYSTEM PAUSED', this.width / 2, by + 64, {
        font: FONTS.HEADER,
        size: 24,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 12
      });
      this.drawText(controls, this.width / 2, by + 118, {
        font: FONTS.BODY,
        size: 13,
        color: PALETTE.WHITE,
        align: 'center'
      });
      this.drawText(
        '[F5] SAVE STATE  |  [F8] LOAD STATE  |  [.] FRAME STEP  |  [R] REWIND',
        this.width / 2,
        158 + by,
        {
          font: FONTS.HUD,
          size: 13,
          color: PALETTE.GOLD,
          align: 'center'
        }
      );
      ctx.globalAlpha = pulse;
      this.drawText(
        'PRESS [P / SPACE / Z] TO RESUME  |  [BACKSPACE] STUDIO LOBBY',
        this.width / 2,
        by + 218,
        {
          font: FONTS.HUD,
          size: 15,
          color: PALETTE.CYAN,
          align: 'center'
        }
      );
      ctx.globalAlpha = 1;
    } else if (state === 'GAMEOVER') {
      this.drawText('GAME OVER', this.width / 2, by + 54, {
        font: FONTS.HEADER,
        size: 25,
        color: PALETTE.PINK,
        align: 'center',
        glow: 14
      });
      this.drawText(
        `FINAL SCORE: ${String(Math.floor(score)).padStart(6, '0')}   •   HI: ${String(
          Math.floor(Math.max(score, highScore))
        ).padStart(6, '0')}`,
        this.width / 2,
        by + 98,
        {
          font: FONTS.HUD,
          size: 18,
          color: PALETTE.WHITE,
          align: 'center'
        }
      );

      // 3-Initial Arcade Champion Selector
      const chars = this.initialsChars || ['A', 'C', 'E'];
      this.drawText(
        `CHAMPION INITIALS (UP/DOWN LETTER, LEFT/RIGHT SLOT):  [${chars[0]}] [${chars[1]}] [${chars[2]}]`,
        this.width / 2,
        by + 142,
        {
          font: FONTS.HUD,
          size: 15,
          color: PALETTE.GOLD,
          align: 'center',
          glow: 8
        }
      );

      this.drawText(
        'PRESS [F8] TO LOAD SAVED STATE OR HOLD [R] TO REWIND!',
        this.width / 2,
        by + 182,
        {
          font: FONTS.HUD,
          size: 13,
          color: PALETTE.CYAN,
          align: 'center'
        }
      );

      ctx.globalAlpha = pulse;
      this.drawText('PRESS [SPACE / Z / TAP] TO PLAY AGAIN', this.width / 2, by + 226, {
        font: FONTS.HEADER,
        size: 13,
        color: PALETTE.GREEN,
        align: 'center',
        glow: 8
      });
      ctx.globalAlpha = 1;
      this.drawText('OR CLICK [STUDIO LOBBY] TO SWITCH CABINETS', this.width / 2, by + 260, {
        font: FONTS.BODY,
        size: 12.5,
        color: PALETTE.MUTED,
        align: 'center'
      });
    }

    ctx.restore();
  }

  pushToast(opts = {}) {
    if (!opts) return;
    achievementManager.pushToast(
      `${opts.icon ? opts.icon + ' ' : ''}${opts.title || 'ARCADE NOTICE'}`,
      opts.desc || opts.subtitle || '',
      opts.color || PALETTE.CYAN
    );
  }

  triggerShutterFlash() {
    this.shutterFlashTimer = 0.25;
    this.flashAlpha = 0.85;
  }

  destroy() {
    if (typeof window !== 'undefined' && this._onResize) {
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onResize);
    }
  }
}

export default Renderer;
