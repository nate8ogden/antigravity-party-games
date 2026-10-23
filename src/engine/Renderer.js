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
    this._lastVpW = rect.width || window.innerWidth || 960;
    this._lastVpH = rect.height || window.innerHeight || 540;
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

    const rawW = rect.width > 40 ? rect.width : winW;
    const rawH = rect.height > 40 ? rect.height : Math.max(240, winH - 90);
    const availW = Math.max(200, rawW - padLeft - padRight - reservedSides - 6);
    const availH = Math.max(120, rawH - padTop - padBot - 6);
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
    if (this.viewportContainer) {
      const cw = this.viewportContainer.clientWidth || 0;
      const ch = this.viewportContainer.clientHeight || 0;
      if (cw > 40 && ch > 40 && (Math.abs(cw - (this._lastVpW || 0)) > 4 || Math.abs(ch - (this._lastVpH || 0)) > 4)) {
        this.resizeViewport();
      }
    }
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
   * Draws a game-specific miniature pixel-art life icon in the arcade HUD
   */
  _drawLifeIcon(ctx, titleUpper, x, y, accent = PALETTE.CYAN) {
    ctx.save();
    if (titleUpper.includes('PAC')) {
      // Classic yellow Pac-Man profile wedge facing left
      ctx.fillStyle = PALETTE.GOLD;
      ctx.beginPath();
      ctx.arc(x + 6, y + 6, 5.5, 1.25 * Math.PI, 0.75 * Math.PI, false);
      ctx.lineTo(x + 6, y + 6);
      ctx.closePath();
      ctx.fill();
    } else if (
      titleUpper.includes('GALAGA') ||
      titleUpper.includes('GALAXIAN') ||
      titleUpper.includes('DEFENDER') ||
      titleUpper.includes('SINISTAR') ||
      titleUpper.includes('EXERION') ||
      titleUpper.includes('ZAXXON') ||
      titleUpper.includes('STAR') ||
      titleUpper.includes('HORIZON') ||
      titleUpper.includes('INERTIA')
    ) {
      // Classic white/red Namco starfighter icon
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(x + 5, y + 1, 2, 10);
      ctx.fillRect(x + 3, y + 4, 6, 5);
      ctx.fillRect(x + 1, y + 6, 10, 4);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(x + 1, y + 5, 2, 2);
      ctx.fillRect(x + 9, y + 5, 2, 2);
      ctx.fillRect(x + 5, y + 4, 2, 3);
    } else if (titleUpper.includes('INVADER') || titleUpper.includes('ARMADA')) {
      // Classic Taito green laser cannon base
      ctx.fillStyle = PALETTE.GREEN;
      ctx.fillRect(x + 5, y + 2, 2, 3);
      ctx.fillRect(x + 3, y + 5, 6, 2);
      ctx.fillRect(x + 1, y + 7, 10, 4);
    } else if (titleUpper.includes('FROG') || titleUpper.includes('HOPPER')) {
      // Mini green frog with yellow eyes
      ctx.fillStyle = PALETTE.GREEN;
      ctx.fillRect(x + 3, y + 3, 6, 7);
      ctx.fillRect(x + 1, y + 2, 2, 3);
      ctx.fillRect(x + 9, y + 2, 2, 3);
      ctx.fillRect(x + 1, y + 8, 2, 3);
      ctx.fillRect(x + 9, y + 8, 2, 3);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(x + 3, y + 2, 2, 2);
      ctx.fillRect(x + 7, y + 2, 2, 2);
    } else if (titleUpper.includes('DIG') || titleUpper.includes('DRILLER')) {
      // Mini Taizo Hori white/blue helmet
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(x + 2, y + 1, 8, 9);
      ctx.fillStyle = PALETTE.CYAN;
      ctx.fillRect(x + 3, y + 3, 6, 3);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(x + 3, y + 9, 6, 2);
    } else if (
      titleUpper.includes('KONG') ||
      titleUpper.includes('GIRDER') ||
      titleUpper.includes('LODE') ||
      titleUpper.includes('VAULT') ||
      titleUpper.includes('PITFALL') ||
      titleUpper.includes('CONTRA') ||
      titleUpper.includes('COMMANDO') ||
      titleUpper.includes('KUNG')
    ) {
      // Mini Jumpman / Hero cap & face
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(x + 2, y + 1, 8, 3);
      ctx.fillRect(x + 4, y + 3, 7, 2);
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(x + 3, y + 5, 6, 4);
      ctx.fillStyle = PALETTE.BLUE;
      ctx.fillRect(x + 3, y + 9, 6, 3);
    } else if (
      titleUpper.includes('ASTEROID') ||
      titleUpper.includes('METEOR') ||
      titleUpper.includes('LANDER') ||
      titleUpper.includes('TEMPEST') ||
      titleUpper.includes('VORTEX')
    ) {
      // Glowing vector A-frame ship
      ctx.strokeStyle = accent || PALETTE.CYAN;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 1);
      ctx.lineTo(x + 11, y + 11);
      ctx.lineTo(x + 8, y + 9);
      ctx.lineTo(x + 4, y + 9);
      ctx.lineTo(x + 1, y + 11);
      ctx.closePath();
      ctx.stroke();
    } else if (
      titleUpper.includes('OUTRUN') ||
      titleUpper.includes('SPY') ||
      titleUpper.includes('HIGHWAY') ||
      titleUpper.includes('RALLY') ||
      titleUpper.includes('ROAD') ||
      titleUpper.includes('TRON') ||
      titleUpper.includes('LIGHT')
    ) {
      // Mini top-down race car
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(x + 3, y + 1, 6, 10);
      ctx.fillStyle = PALETTE.CYAN;
      ctx.fillRect(x + 4, y + 3, 4, 3);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(x + 1, y + 2, 2, 3);
      ctx.fillRect(x + 9, y + 2, 2, 3);
      ctx.fillRect(x + 1, y + 7, 2, 3);
      ctx.fillRect(x + 9, y + 7, 2, 3);
    } else if (titleUpper.includes('BATTLE') || titleUpper.includes('TANK')) {
      // Mini golden tank
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(x + 1, y + 3, 2, 8);
      ctx.fillRect(x + 9, y + 3, 2, 8);
      ctx.fillRect(x + 3, y + 4, 6, 6);
      ctx.fillRect(x + 5, y + 1, 2, 4);
    } else if (titleUpper.includes('Q*BERT') || titleUpper.includes('ISO HOP')) {
      // Mini orange Q*bert head & snout
      ctx.fillStyle = PALETTE.ORANGE;
      ctx.beginPath();
      ctx.arc(x + 5, y + 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + 7, y + 5, 4, 3);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(x + 3, y + 3, 3, 3);
    } else if (titleUpper.includes('BUBBLE')) {
      // Mini green Bub dragon
      ctx.fillStyle = PALETTE.GREEN;
      ctx.fillRect(x + 2, y + 2, 8, 8);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(x + 1, y + 3, 2, 5);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(x + 6, y + 3, 3, 3);
    } else if (titleUpper.includes('BURGER') || titleUpper.includes('BISTRO')) {
      // Mini white Chef hat
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(x + 2, y + 1, 8, 5);
      ctx.fillRect(x + 3, y + 6, 6, 3);
      ctx.fillStyle = '#FDBA74';
      ctx.fillRect(x + 3, y + 9, 6, 3);
    } else {
      // Classic arcade heart / badge icon
      ctx.fillStyle = accent || PALETTE.PINK;
      ctx.fillRect(x + 2, y + 2, 3, 3);
      ctx.fillRect(x + 7, y + 2, 3, 3);
      ctx.fillRect(x + 1, y + 4, 10, 4);
      ctx.fillRect(x + 3, y + 8, 6, 2);
      ctx.fillRect(x + 5, y + 10, 2, 2);
    }
    ctx.restore();
  }

  /**
   * Draws classic Namco/Taito style stage pennant flags next to the stage counter
   */
  _drawStageFlags(ctx, level, x, y) {
    ctx.save();
    const tens = Math.min(3, Math.floor(level / 10));
    const ones = Math.min(4, level % 10);
    let curX = x;
    for (let i = 0; i < tens; i++) {
      // Large Red/Gold 10-Stage Pennant
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(curX, y, 1.5, 13);
      ctx.fillStyle = PALETTE.RED;
      ctx.beginPath();
      ctx.moveTo(curX + 1.5, y);
      ctx.lineTo(curX + 9, y + 4);
      ctx.lineTo(curX + 1.5, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(curX + 2, y + 3, 4, 2);
      curX += 10;
    }
    for (let i = 0; i < ones; i++) {
      // Classic Yellow/Red 1-Stage Pennant
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(curX, y + 1, 1.5, 12);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.beginPath();
      ctx.moveTo(curX + 1.5, y + 1);
      ctx.lineTo(curX + 7, y + 4);
      ctx.lineTo(curX + 1.5, y + 7);
      ctx.closePath();
      ctx.fill();
      curX += 7;
    }
    ctx.restore();
  }

  /**
   * Draws an authentic 1980s coin-op top arcade HUD bar (38px height)
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
    const titleUpper = String(title || 'ARCADE').toUpperCase();
    ctx.save();

    // Pitch-black coin-op marquee header strip with double neon trim
    ctx.fillStyle = '#04060C';
    ctx.fillRect(0, 0, this.width, 38);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 36.5);
    ctx.lineTo(this.width, 36.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.lineTo(this.width, 34);
    ctx.stroke();

    // 1. Classic Arcade Marquee Title (left)
    const displayTitle = titleUpper.length > 16 ? titleUpper.slice(0, 16) : titleUpper;
    this.drawText(displayTitle, 12, 23, {
      font: FONTS.HEADER,
      size: displayTitle.length > 13 ? 10 : 11.5,
      color: accent,
      glow: 8
    });

    // 2. Classic Coin-Op 1UP Header + 6-Digit Bitmap Score
    const blink1UP = Math.floor(performance.now() / 360) % 2 === 0;
    this.drawText('1UP', 238, 13, {
      font: FONTS.HEADER,
      size: 7.5,
      color: blink1UP ? PALETTE.RED : PALETTE.WHITE
    });
    this.drawText(String(Math.floor(score)).padStart(6, '0'), 238, 28, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.WHITE
    });

    // 3. HIGH SCORE + Champion Initials in Arcade Gold
    const holder = InitialsStore.getLastInitials();
    this.drawText(`HIGH SCORE (${holder})`, 365, 13, {
      font: FONTS.HEADER,
      size: 7.5,
      color: PALETTE.GOLD
    });
    this.drawText(
      String(Math.floor(Math.max(score, highScore))).padStart(6, '0'),
      365,
      28,
      {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.GOLD,
        glow: 6
      }
    );

    // 4. Stage Counter + Classic Arcade Stage Pennant Flags
    this.drawText(`RD:${String(level).padStart(2, '0')}`, 542, 24, {
      font: FONTS.HEADER,
      size: 9.5,
      color: PALETTE.GREEN
    });
    this._drawStageFlags(ctx, level, 600, 12);

    // 5. Game-specific status telemetry (e.g. GOLD, BONUS, BAYS, FUEL)
    if (extraLabel) {
      const cleanExtra = String(extraLabel).length > 22 ? String(extraLabel).slice(0, 22) : extraLabel;
      this.drawText(cleanExtra, 642, 24, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.CYAN
      });
    }

    // 6. Game-Specific Pixel-Art Life Icons on far right
    const maxLivesIcons = Math.max(0, Math.min(6, lives));
    for (let i = 0; i < maxLivesIcons; i++) {
      this._drawLifeIcon(ctx, titleUpper, 864 + i * 15, 12, accent);
    }
    ctx.restore();
  }

  /**
   * Authentic 1980s Coin-Op Attract / Pause / Game Over Cabinet Overlay
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
    ctx.fillStyle = 'rgba(4, 6, 12, 0.84)';
    ctx.fillRect(0, 38, this.width, this.height - 38);

    const boxW = 660;
    const boxH = 304;
    const bx = (this.width - boxW) / 2;
    const by = (this.height - boxH) / 2 + 12;
    const frameCol = state === 'GAMEOVER' ? PALETTE.PINK : accent;

    // Outer & inner double-line coin-op cabinet frame
    ctx.fillStyle = 'rgba(10, 15, 28, 0.97)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = frameCol;
    ctx.lineWidth = 3;
    ctx.shadowColor = frameCol;
    ctx.shadowBlur = 16;
    ctx.strokeRect(bx, by, boxW, boxH);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(bx + 6, by + 6, boxW - 12, boxH - 12);

    // Corner arcade rivets
    ctx.fillStyle = PALETTE.GOLD;
    for (const [rx, ry] of [
      [bx + 10, by + 10],
      [bx + boxW - 14, by + 10],
      [bx + 10, by + boxH - 14],
      [bx + boxW - 14, by + boxH - 14]
    ]) {
      ctx.fillRect(rx, ry, 4, 4);
    }

    const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.006);
    const blinkCoin = Math.floor(performance.now() / 420) % 2 === 0;

    if (state === 'MENU') {
      this.drawText(title.toUpperCase(), this.width / 2, by + 56, {
        font: FONTS.HEADER,
        size: 22,
        color: accent,
        align: 'center',
        glow: 12
      });
      this.drawText(subtitle || 'AUTHENTIC COIN-OP ARCADE EDITION', this.width / 2, by + 90, {
        font: FONTS.HEADER,
        size: 10,
        color: PALETTE.GOLD,
        align: 'center'
      });
      this.drawText(controls, this.width / 2, by + 138, {
        font: FONTS.HUD,
        size: 13,
        color: PALETTE.WHITE,
        align: 'center'
      });
      ctx.globalAlpha = pulse;
      this.drawText(
        blinkCoin
          ? 'INSERT COIN  •  PRESS [SPACE / Z / TAP] FOR 1P START'
          : 'PUSH 1P START BUTTON [SPACE / Z / TAP]',
        this.width / 2,
        by + 196,
        {
          font: FONTS.HEADER,
          size: 12,
          color: PALETTE.GREEN,
          align: 'center',
          glow: 10
        }
      );
      ctx.globalAlpha = 1;
      this.drawText(
        `TOP SCORE: ${String(highScore).padStart(6, '0')} (${InitialsStore.getLastInitials()})   •   CREDIT 01 (FREE PLAY)`,
        this.width / 2,
        by + 242,
        {
          font: FONTS.HEADER,
          size: 9.5,
          color: PALETTE.GOLD,
          align: 'center'
        }
      );
      this.drawText('© 1978-1989 RETRO ARCADE STUDIO ARCHIVE', this.width / 2, by + 276, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.MUTED,
        align: 'center'
      });
    } else if (state === 'PAUSED') {
      this.drawText('PAUSE / DIP SWITCHES', this.width / 2, by + 60, {
        font: FONTS.HEADER,
        size: 20,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 12
      });
      this.drawText(controls, this.width / 2, by + 114, {
        font: FONTS.HUD,
        size: 13,
        color: PALETTE.WHITE,
        align: 'center'
      });
      this.drawText(
        '[F5] SAVE STATE  |  [F8] LOAD STATE  |  [.] FRAME STEP  |  [R] REWIND',
        this.width / 2,
        by + 156,
        {
          font: FONTS.HEADER,
          size: 9,
          color: PALETTE.GOLD,
          align: 'center'
        }
      );
      ctx.globalAlpha = pulse;
      this.drawText(
        'PRESS [P / SPACE / Z] TO RESUME  |  [BACKSPACE] ARCADE LOBBY',
        this.width / 2,
        by + 216,
        {
          font: FONTS.HEADER,
          size: 10.5,
          color: PALETTE.CYAN,
          align: 'center'
        }
      );
      ctx.globalAlpha = 1;
      this.drawText('CREDIT 01  •  CRT SCANLINE EMULATION ACTIVE', this.width / 2, by + 268, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.MUTED,
        align: 'center'
      });
    } else if (state === 'GAMEOVER') {
      this.drawText('GAME OVER', this.width / 2, by + 54, {
        font: FONTS.HEADER,
        size: 24,
        color: PALETTE.PINK,
        align: 'center',
        glow: 14
      });
      this.drawText(
        `1UP SCORE: ${String(Math.floor(score)).padStart(6, '0')}    HIGH: ${String(
          Math.floor(Math.max(score, highScore))
        ).padStart(6, '0')}`,
        this.width / 2,
        by + 96,
        {
          font: FONTS.HEADER,
          size: 11.5,
          color: PALETTE.WHITE,
          align: 'center'
        }
      );

      // 3-Initial Arcade Champion Selector
      const chars = this.initialsChars || ['A', 'C', 'E'];
      this.drawText(
        `ENTER INITIALS (UP/DOWN CHAR, L/R SLOT):  [ ${chars[0]} ] [ ${chars[1]} ] [ ${chars[2]} ]`,
        this.width / 2,
        by + 140,
        {
          font: FONTS.HEADER,
          size: 10,
          color: PALETTE.GOLD,
          align: 'center',
          glow: 8
        }
      );

      this.drawText(
        'PRESS [F8] TO LOAD SAVED STATE OR HOLD [R] TO REWIND!',
        this.width / 2,
        by + 180,
        {
          font: FONTS.HEADER,
          size: 8.5,
          color: PALETTE.CYAN,
          align: 'center'
        }
      );

      ctx.globalAlpha = pulse;
      this.drawText(
        blinkCoin
          ? 'INSERT COIN  •  PRESS [SPACE / Z / TAP] TO CONTINUE'
          : 'PRESS [SPACE / Z / TAP] TO PLAY AGAIN',
        this.width / 2,
        by + 226,
        {
          font: FONTS.HEADER,
          size: 11.5,
          color: PALETTE.GREEN,
          align: 'center',
          glow: 8
        }
      );
      ctx.globalAlpha = 1;
      this.drawText('OR CLICK [STUDIO LOBBY] TO SWITCH CABINETS', this.width / 2, by + 266, {
        font: FONTS.HEADER,
        size: 8.5,
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
