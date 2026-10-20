/**
 * main.js
 * Entry point and Studio Orchestrator for Retro Arcade Studio.
 * Manages the 60 FPS WebGL/Canvas render loop, clean game lifecycle switching,
 * unified input & audio initialization, and studio deck controls.
 */
import { Renderer, HighScoreStore } from './engine/Renderer.js';
import { InputManager } from './engine/Input.js';
import { AudioSynth } from './engine/AudioSynth.js';
import { wasmCore } from './engine/WasmCore.js';
import { MainMenu, GAME_CATALOG } from './ui/MainMenu.js';

// 8 Flagship Core Games
import { LodeRunner } from './games/LodeRunner.js';
import { DigDug } from './games/DigDug.js';
import { DonkeyKong } from './games/DonkeyKong.js';
import { Sumo } from './games/Sumo.js';
import { PacMan } from './games/PacMan.js';
import { Frogger } from './games/Frogger.js';
import { Galaga } from './games/Galaga.js';
import { SpaceInvaders } from './games/SpaceInvaders.js';

// 20 Expanded Vault Classics
import { Asteroids } from './games/Asteroids.js';
import { Centipede } from './games/Centipede.js';
import { Defender } from './games/Defender.js';
import { Arkanoid } from './games/Arkanoid.js';
import { Paperboy } from './games/Paperboy.js';
import { Joust } from './games/Joust.js';
import { Qbert } from './games/Qbert.js';
import { Rampage } from './games/Rampage.js';
import { MarbleMadness } from './games/MarbleMadness.js';
import { Pitfall } from './games/Pitfall.js';
import { DuckHunt } from './games/DuckHunt.js';
import { Excitebike } from './games/Excitebike.js';
import { MissileCommand } from './games/MissileCommand.js';
import { BurgerTime } from './games/BurgerTime.js';
import { BubbleBobble } from './games/BubbleBobble.js';
import { SpyHunter } from './games/SpyHunter.js';
import { Tron } from './games/Tron.js';
import { TrackAndField } from './games/TrackAndField.js';
import { OutRun } from './games/OutRun.js';
import { Contra } from './games/Contra.js';

export const GAME_REGISTRY = {
  loderunner: LodeRunner,
  digdug: DigDug,
  donkeykong: DonkeyKong,
  sumo: Sumo,
  pacman: PacMan,
  frogger: Frogger,
  galaga: Galaga,
  spaceinvaders: SpaceInvaders,
  asteroids: Asteroids,
  centipede: Centipede,
  defender: Defender,
  arkanoid: Arkanoid,
  paperboy: Paperboy,
  joust: Joust,
  qbert: Qbert,
  rampage: Rampage,
  marblemadness: MarbleMadness,
  pitfall: Pitfall,
  duckhunt: DuckHunt,
  excitebike: Excitebike,
  missilecommand: MissileCommand,
  burgertime: BurgerTime,
  bubblebobble: BubbleBobble,
  spyhunter: SpyHunter,
  tron: Tron,
  trackandfield: TrackAndField,
  outrun: OutRun,
  contra: Contra
};

export class RetroArcadeStudio {
  constructor() {
    this.displayCanvas = document.getElementById('arcade-canvas');
    this.viewportEl = document.getElementById('arcade-viewport');

    // Initialize localStorage high score defaults immediately
    HighScoreStore.loadAll();

    this.audio = new AudioSynth();
    this.wasm = wasmCore;
    this.renderer = new Renderer(this.displayCanvas, this.viewportEl);
    this.input = new InputManager(this.displayCanvas);

    if (this.input.touchControls) {
      this.input.touchControls.onResizeCallback = () => this.renderer.resizeViewport();
    }

    this.input.onFirstInteraction = () => {
      this.audio.init();
      this.audio.playMusic(this.activeGameId || 'lobby');
    };

    const unlockAudio = () => {
      this.audio.init();
      this.audio.playMusic(this.activeGameId || 'lobby');
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
    window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });

    this.input.onMenuCallback = () => {
      this.returnToLobby();
    };

    this.mainMenu = new MainMenu(this.renderer, this.input, this.audio, (gameId) => {
      this.launchGame(gameId);
    });

    this.activeGame = null;
    this.activeGameId = null;
    this.lastFrameTime = performance.now();
    this.fps = 60;
    this._fpsFrames = 0;
    this._fpsAccum = 0;

    this._initStudioDeckUI();
    this._applyQueryParams();
    this.renderer.resizeViewport();
    this._startLoop();
  }

  setDeviceMode(mode) {
    if (!this.input.touchControls) return 'desktop';
    const activeMode = this.input.touchControls.setDeviceMode(mode);
    this._syncDeviceButtons();
    this.renderer.resizeViewport();
    return activeMode;
  }

  getDeviceMode() {
    return this.input.touchControls ? this.input.touchControls.deviceMode : 'desktop';
  }

  _syncDeviceButtons() {
    const mode = this.getDeviceMode();
    ['desktop', 'tablet', 'phone'].forEach((m) => {
      const btn = document.getElementById(`btn-mode-${m}`);
      if (btn) btn.classList.toggle('active', mode === m);
    });
    const btnTouch = document.getElementById('btn-toggle-touch');
    if (btnTouch && this.input.touchControls) {
      const vis = this.input.touchControls.isVisible();
      btnTouch.textContent = `TOUCH PAD: ${vis ? 'ON' : 'AUTO'}`;
      btnTouch.classList.toggle('active', vis);
    }
  }

  _applyQueryParams() {
    if (typeof window === 'undefined' || !window.location) return;
    try {
      const params = new URLSearchParams(window.location.search || '');
      const device = params.get('device');
      if (device) {
        this.setDeviceMode(device);
      } else {
        this._syncDeviceButtons();
      }
      const gameParam = params.get('game');
      if (gameParam && GAME_REGISTRY[gameParam.toLowerCase()]) {
        this.launchGame(gameParam.toLowerCase());
      }
    } catch (_) {
      this._syncDeviceButtons();
    }
  }

  _initStudioDeckUI() {
    const quickBar = document.getElementById('cabinet-quick-bar');
    if (quickBar) {
      quickBar.innerHTML = '';

      // Lobby pill
      const lobbyBtn = document.createElement('button');
      lobbyBtn.type = 'button';
      lobbyBtn.className = 'cabinet-pill lobby-pill active';
      lobbyBtn.dataset.game = 'lobby';
      lobbyBtn.textContent = '★ STUDIO LOBBY';
      lobbyBtn.addEventListener('click', () => {
        this.audio.init();
        this.audio.playMenuSelect();
        this.returnToLobby();
      });
      quickBar.appendChild(lobbyBtn);

      // All 8 Core Games + 20 Expanded Games pills
      GAME_CATALOG.forEach((meta) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `cabinet-pill ${meta.category === 'core' ? 'core-pill' : 'vault-pill'}`;
        btn.dataset.game = meta.id;
        btn.textContent = meta.title;
        btn.title = `${meta.title} — ${meta.mechanics}`;
        btn.addEventListener('click', () => {
          this.audio.init();
          this.audio.playMenuSelect();
          this.launchGame(meta.id);
        });
        quickBar.appendChild(btn);
      });
    }

    // Header control buttons
    const btnLobby = document.getElementById('btn-studio-lobby');
    if (btnLobby) {
      btnLobby.addEventListener('click', () => {
        this.audio.init();
        this.audio.playMenuSelect();
        this.returnToLobby();
      });
    }

    const btnPause = document.getElementById('btn-toggle-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.audio.init();
        if (this.activeGame) {
          if (this.activeGame.state === 'PLAYING') {
            this.activeGame.setState('PAUSED');
          } else if (this.activeGame.state === 'PAUSED') {
            this.activeGame.setState('PLAYING');
          }
          this._syncHeaderStatus();
        }
      });
    }

    const btnReset = document.getElementById('btn-reset-game');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.audio.init();
        if (this.activeGame && typeof this.activeGame.reset === 'function') {
          this.audio.playMenuSelect();
          this.activeGame.reset();
          this.activeGame.setState('PLAYING');
          this._syncHeaderStatus();
        }
      });
    }

    const btnCrt = document.getElementById('btn-toggle-crt');
    if (btnCrt) {
      btnCrt.addEventListener('click', () => {
        const on = this.renderer.crt.toggle();
        btnCrt.textContent = `CRT SHADER: ${on ? 'ON' : 'OFF'}`;
        btnCrt.classList.toggle('active', on);
      });
    }

    const btnTouch = document.getElementById('btn-toggle-touch');
    if (btnTouch) {
      btnTouch.addEventListener('click', () => {
        if (this.input.touchControls) {
          this.input.touchControls.toggleForceVisible();
          this._syncDeviceButtons();
          setTimeout(() => this.renderer.resizeViewport(), 50);
        }
      });
    }

    ['desktop', 'tablet', 'phone'].forEach((m) => {
      const btn = document.getElementById(`btn-mode-${m}`);
      if (btn) {
        btn.addEventListener('click', () => {
          this.setDeviceMode(m);
        });
      }
    });

    const btnWasm = document.getElementById('btn-wasm-status');
    if (btnWasm) {
      const active = this.wasm && this.wasm.isActive();
      btnWasm.textContent = `WASM: ${active ? 'NATIVE' : 'JS'}`;
      btnWasm.classList.toggle('active', active);
      btnWasm.addEventListener('click', () => {
        if (this.wasm) {
          const bench = this.wasm.runBenchmark();
          btnWasm.textContent = `WASM: ${bench.speedupFactor}x`;
          btnWasm.title = `WASM: ${bench.wasmTimeMs}ms vs JS: ${bench.jsTimeMs}ms (${bench.speedupFactor}x speedup)`;
        }
      });
    }

    const btnAudio = document.getElementById('btn-toggle-audio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        this.audio.init();
        const muted = this.audio.toggleMute();
        btnAudio.textContent = `AUDIO: ${muted ? 'MUTED' : 'SYNTH ON'}`;
        btnAudio.classList.toggle('active', !muted);
      });
    }
  }

  /**
   * Cleanly switches to any of the 28 games, resetting memory, timers, and input state
   */
  launchGame(gameId) {
    const id = String(gameId || '').toLowerCase();
    const GameClass = GAME_REGISTRY[id];
    if (!GameClass) return false;

    this._cleanupCurrentGame();
    this.input.resetState();

    this.activeGameId = id;
    this.activeGame = new GameClass(this.renderer, this.input, this.audio);
    if (this.activeGame.state !== 'PLAYING') {
      this.activeGame.setState('PLAYING');
    }

    this.audio.playMusic(id, true);
    this._syncHeaderStatus();
    return true;
  }

  returnToLobby() {
    this._cleanupCurrentGame();
    this.input.resetState();
    this.activeGame = null;
    this.activeGameId = null;
    this.audio.playMusic('lobby', true);
    this._syncHeaderStatus();
  }

  _cleanupCurrentGame() {
    this.audio.stopSequence();
    if (this.activeGame) {
      if (typeof this.activeGame.destroy === 'function') {
        try {
          this.activeGame.destroy();
        } catch (_) {}
      }
      this.activeGame = null;
    }
  }

  _syncHeaderStatus() {
    const statusEl = document.getElementById('studio-active-title');
    if (statusEl) {
      if (this.activeGame) {
        const meta = GAME_CATALOG.find((g) => g.id === this.activeGameId);
        statusEl.textContent = meta
          ? `${meta.title.toUpperCase()} — ${meta.controls}`
          : this.activeGame.title.toUpperCase();
      } else {
        statusEl.textContent = 'SELECT ANY ARCADE CABINET (8 CORE + 20 VAULT CLASSICS)';
      }
    }

    document.querySelectorAll('.cabinet-pill').forEach((pill) => {
      const pid = pill.dataset.game;
      const isMatch = (!this.activeGameId && pid === 'lobby') || pid === this.activeGameId;
      pill.classList.toggle('active', isMatch);
    });
  }

  _startLoop() {
    const tick = (now) => {
      const rawDt = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      const dt = Math.max(0.001, Math.min(0.05, rawDt));

      this._fpsFrames++;
      this._fpsAccum += rawDt;
      if (this._fpsAccum >= 0.5) {
        this.fps = Math.min(60, Math.round(this._fpsFrames / this._fpsAccum));
        this._fpsFrames = 0;
        this._fpsAccum = 0;
        const fpsEl = document.getElementById('studio-fps-readout');
        if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;
      }

      this.input.pollGamepads();
      this.renderer.beginFrame(dt);

      if (this.activeGame) {
        this.activeGame.update(dt);
        this.activeGame.render(this.renderer.ctx);
      } else {
        this.mainMenu.update(dt);
        this.mainMenu.render(this.renderer.ctx);
      }

      this.renderer.endFrame();
      this.input.endFrame();

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}

const bootStudio = () => {
  if (!window.arcadeStudio) {
    window.arcadeStudio = new RetroArcadeStudio();
  }
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootStudio);
} else {
  bootStudio();
}

export default RetroArcadeStudio;
