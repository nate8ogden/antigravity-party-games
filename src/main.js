/**
 * main.js
 * Entry point and Studio Orchestrator for Retro Arcade Studio.
 * Manages the 60 FPS WebGL/Canvas render loop, clean game lifecycle switching,
 * unified input & audio initialization, Firebase cloud persistence, emulator save states,
 * rewind time-machine buffer, DIP switches, and studio deck controls.
 */
import { Renderer, HighScoreStore } from './engine/Renderer.js';
import { InputManager } from './engine/Input.js';
import { AudioSynth } from './engine/AudioSynth.js';
import { wasmCore } from './engine/WasmCore.js';
import {
  CloudPersistence,
  SaveStateManager,
  DipSwitchStore,
  InitialsStore,
  AchievementManager
} from './engine/CloudPersistence.js';
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

// 22 Vault II Classics (Total Roster: 50 Games)
import { Galaxian } from './games/Galaxian.js';
import { DigDug2 } from './games/DigDug2.js';
import { ElevatorAction } from './games/ElevatorAction.js';
import { Tapper } from './games/Tapper.js';
import { LunarLander } from './games/LunarLander.js';
import { Tempest } from './games/Tempest.js';
import { Robotron } from './games/Robotron.js';
import { Sinistar } from './games/Sinistar.js';
import { CrystalCastles } from './games/CrystalCastles.js';
import { Zaxxon } from './games/Zaxxon.js';
import { MoonPatrol } from './games/MoonPatrol.js';
import { Pengo } from './games/Pengo.js';
import { RallyX } from './games/RallyX.js';
import { RoadFighter } from './games/RoadFighter.js';
import { Flicky } from './games/Flicky.js';
import { Mappy } from './games/Mappy.js';
import { CircusCharlie } from './games/CircusCharlie.js';
import { BattleCity } from './games/BattleCity.js';
import { KungFuMaster } from './games/KungFuMaster.js';
import { WildGunman } from './games/WildGunman.js';
import { Exerion } from './games/Exerion.js';
import { TetrisRetro } from './games/TetrisRetro.js';

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
  contra: Contra,
  galaxian: Galaxian,
  digdug2: DigDug2,
  elevatoraction: ElevatorAction,
  tapper: Tapper,
  lunarlander: LunarLander,
  tempest: Tempest,
  robotron: Robotron,
  sinistar: Sinistar,
  crystalcastles: CrystalCastles,
  zaxxon: Zaxxon,
  moonpatrol: MoonPatrol,
  pengo: Pengo,
  rallyx: RallyX,
  roadfighter: RoadFighter,
  flicky: Flicky,
  mappy: Mappy,
  circuscharlie: CircusCharlie,
  battlecity: BattleCity,
  kungfumaster: KungFuMaster,
  wildgunman: WildGunman,
  exerion: Exerion,
  tetrisretro: TetrisRetro
};

export class RetroArcadeStudio {
  constructor() {
    this.displayCanvas = document.getElementById('arcade-canvas');
    this.viewportEl = document.getElementById('arcade-viewport');

    // Initialize localStorage & Firebase Cloud high score defaults immediately
    HighScoreStore.loadAll();
    CloudPersistence.init();

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
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
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

    // Emulator features state
    this.speedMultiplier = 1.0;
    this._speedOptions = [1.0, 1.5, 2.0, 0.5];
    this._speedIdx = 0;

    this._rewindBuffer = [];
    this._rewindSampleAccum = 0;
    this._rewindMaxFrames = 120; // 6 seconds at 20Hz snapshot rate
    this._rewindButtonHeld = false;

    // Attract mode state
    this.attractActive = false;
    this.attractTimer = 0;
    this.lobbyIdleTimer = 0;

    // 3-Initials high score entry state
    this._initialsCursor = 0;

    CloudPersistence.onUpdate(() => {
      this._syncFavoriteButton();
    });

    this._initStudioDeckUI();
    this._applyQueryParams();
    this.renderer.resizeViewport();
    this._startLoop();
  }

  _tryUnlockAchievement(id) {
    const ach = AchievementManager.unlock(id);
    if (ach) {
      this.renderer.pushToast({
        icon: ach.icon,
        title: `ACHIEVEMENT: ${ach.title}`,
        desc: ach.desc,
        color: '#FFD700',
        timer: 3.4
      });
      this.audio.playStageClear();
    }
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
      btnTouch.textContent = `TOUCH: ${vis ? 'ON' : 'AUTO'}`;
      btnTouch.classList.toggle('active', vis);
    }
  }

  _syncFavoriteButton() {
    const btnFav = document.getElementById('btn-fav-game');
    if (!btnFav) return;
    const targetId = this.activeGameId || (this.mainMenu && GAME_CATALOG[this.mainMenu.selectedIndex]?.id);
    const isFav = targetId ? CloudPersistence.isFavorite(targetId) : false;
    btnFav.textContent = isFav ? '♥ SAVED' : '♡ FAV';
    btnFav.classList.toggle('active', isFav);
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

  saveCurrentState() {
    if (!this.activeGame || !this.activeGameId) {
      this.renderer.pushToast({
        icon: '💾',
        title: 'LAUNCH A CABINET FIRST',
        desc: 'Select any arcade game to capture an instant save state.',
        color: '#00F0FF',
        timer: 2.2
      });
      return false;
    }
    const ok = SaveStateManager.save(this.activeGameId, this.activeGame);
    if (ok) {
      this.audio.playCoin();
      this.renderer.pushToast({
        icon: '💾',
        title: `STATE SAVED — ${this.activeGame.title.toUpperCase()}`,
        desc: `Score ${this.activeGame.score || 0} • Press [F8] or LOAD anytime to restore`,
        color: '#00FF66',
        timer: 2.6
      });
      this._tryUnlockAchievement('SAVE_MASTER');
    }
    return ok;
  }

  loadCurrentState() {
    const targetId = this.activeGameId || (this.mainMenu && GAME_CATALOG[this.mainMenu.selectedIndex]?.id);
    if (!targetId) return false;
    if (!SaveStateManager.hasSave(targetId)) {
      this.renderer.pushToast({
        icon: '📂',
        title: 'NO SAVE STATE FOUND',
        desc: 'Press [F5] or SAVE during gameplay to create a snapshot first.',
        color: '#FF007A',
        timer: 2.4
      });
      return false;
    }
    if (this.activeGameId !== targetId) {
      this.launchGame(targetId, { skipAttract: true });
    }
    const ok = SaveStateManager.load(this.activeGameId, this.activeGame);
    if (ok) {
      this.audio.playPowerUp();
      this.renderer.pushToast({
        icon: '📂',
        title: `STATE RESTORED — ${this.activeGame.title.toUpperCase()}`,
        desc: `Resumed at Score ${this.activeGame.score || 0}`,
        color: '#00F0FF',
        timer: 2.4
      });
    }
    return ok;
  }

  captureScreenshot() {
    this.audio.init();
    this.audio.playCoin();
    this.renderer.triggerShutterFlash();
    this._tryUnlockAchievement('SHUTTERBUG');
    try {
      const dataUrl = this.displayCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      const slug = this.activeGameId || 'studio-lobby';
      const score = this.activeGame ? this.activeGame.score || 0 : 0;
      a.href = dataUrl;
      a.download = `retro-arcade-${slug}-${score}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.renderer.pushToast({
        icon: '📸',
        title: 'ARCADE SNAP SAVED',
        desc: `Captured ${slug.toUpperCase()} frame to PNG`,
        color: '#00F0FF',
        timer: 2.5
      });
    } catch (_) {}
  }

  toggleAttractMode(forceState) {
    this.attractActive = typeof forceState === 'boolean' ? forceState : !this.attractActive;
    const btnAttract = document.getElementById('btn-attract');
    if (btnAttract) {
      btnAttract.classList.toggle('active', this.attractActive);
      btnAttract.textContent = this.attractActive ? '🎬 ATTRACT: ON' : '🎬 ATTRACT';
    }
    if (this.attractActive) {
      this.attractTimer = 0;
      this._launchNextAttractGame();
    } else {
      this.input.clearAttractInput();
      this.renderer.attractOverlay = { active: false, title: '', timer: 0 };
    }
  }

  _launchNextAttractGame() {
    const idx = Math.floor(Math.random() * GAME_CATALOG.length);
    const meta = GAME_CATALOG[idx];
    if (meta) {
      this.launchGame(meta.id, { fromAttract: true });
    }
  }

  _updateAttractAI(nowSec) {
    if (!this.attractActive || !this.activeGame) {
      this.input.clearAttractInput();
      this.renderer.attractOverlay = { active: false, title: '', timer: 0 };
      return;
    }

    // Any real user input immediately hands control over to the player!
    if (
      this.input.keysDown.size > 0 ||
      this.input.pointer.justPressed ||
      (this.input.touchControls &&
        (this.input.touchControls.state.left ||
          this.input.touchControls.state.right ||
          this.input.touchControls.state.up ||
          this.input.touchControls.state.down ||
          this.input.touchControls.state.actionA ||
          this.input.touchControls.state.actionB))
    ) {
      this.toggleAttractMode(false);
      this.renderer.pushToast({
        icon: '🕹️',
        title: 'PLAYER 1 TOOK CONTROL',
        desc: `Live control active in ${this.activeGame.title}`,
        color: '#00FF66',
        timer: 2.2
      });
      return;
    }

    const wave = Math.sin(nowSec * 2.1);
    const wave2 = Math.cos(nowSec * 1.4);
    const pulseA = Math.sin(nowSec * 9.5) > 0.55;
    const pulseB = Math.sin(nowSec * 3.7) > 0.82;
    this.input.setAttractInput({
      left: wave < -0.35,
      right: wave > 0.35,
      up: wave2 > 0.45,
      down: wave2 < -0.45,
      actionA: pulseA,
      actionB: pulseB
    });

    this.renderer.attractOverlay = {
      active: true,
      title: this.activeGame.title,
      timer: Math.max(0, 18 - this.attractTimer)
    };
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
        this.toggleAttractMode(false);
        this.returnToLobby();
      });
      quickBar.appendChild(lobbyBtn);

      // All 8 Core Games + 20 Expanded Games pills with icons
      GAME_CATALOG.forEach((meta) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `cabinet-pill ${meta.category === 'core' ? 'core-pill' : 'vault-pill'}`;
        btn.dataset.game = meta.id;
        btn.textContent = `${meta.icon || '🕹️'} ${meta.title}`;
        btn.title = `${meta.title} (${meta.classicRef || meta.genre}) — ${meta.mechanics}`;
        btn.addEventListener('click', () => {
          this.audio.init();
          this.audio.playMenuSelect();
          this.toggleAttractMode(false);
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
        this.toggleAttractMode(false);
        this.returnToLobby();
      });
    }

    const btnStagePrev = document.getElementById('btn-stage-prev');
    if (btnStagePrev) {
      btnStagePrev.addEventListener('click', () => {
        this.audio.init();
        this.changeStage(-1);
      });
    }

    const btnStageNext = document.getElementById('btn-stage-next');
    if (btnStageNext) {
      btnStageNext.addEventListener('click', () => {
        this.audio.init();
        this.changeStage(1);
      });
    }

    const btnSave = document.getElementById('btn-save-state');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        this.audio.init();
        this.saveCurrentState();
      });
    }

    const btnLoad = document.getElementById('btn-load-state');
    if (btnLoad) {
      btnLoad.addEventListener('click', () => {
        this.audio.init();
        this.loadCurrentState();
      });
    }

    const btnRewind = document.getElementById('btn-rewind');
    if (btnRewind) {
      const startRewind = (e) => {
        e.preventDefault();
        this._rewindButtonHeld = true;
        btnRewind.classList.add('active');
      };
      const stopRewind = () => {
        this._rewindButtonHeld = false;
        btnRewind.classList.remove('active');
      };
      btnRewind.addEventListener('pointerdown', startRewind);
      window.addEventListener('pointerup', stopRewind);
      btnRewind.addEventListener('mouseleave', stopRewind);
    }

    const btnSpeed = document.getElementById('btn-speed');
    if (btnSpeed) {
      btnSpeed.addEventListener('click', () => {
        this.audio.init();
        this.audio.playMenuMove();
        this._speedIdx = (this._speedIdx + 1) % this._speedOptions.length;
        this.speedMultiplier = this._speedOptions[this._speedIdx];
        btnSpeed.textContent = `⚡ ${this.speedMultiplier}x`;
        btnSpeed.classList.toggle('active', this.speedMultiplier !== 1.0);
      });
    }

    const btnTurbo = document.getElementById('btn-turbo');
    if (btnTurbo) {
      btnTurbo.addEventListener('click', () => {
        this.audio.init();
        this.audio.playMenuMove();
        const on = this.input.toggleTurbo();
        btnTurbo.textContent = `🔥 TURBO: ${on ? 'ON' : 'OFF'}`;
        btnTurbo.classList.toggle('active', on);
      });
    }

    const btnDip = document.getElementById('btn-dip');
    if (btnDip) {
      const currentDip = DipSwitchStore.getPreset();
      btnDip.textContent = `⚙ DIP: ${currentDip.label.split(' ')[0]}`;
      btnDip.title = `DIP Switches: ${currentDip.label} (${currentDip.lives} Lives, ${currentDip.difficultyName})`;
      btnDip.addEventListener('click', () => {
        this.audio.init();
        this.audio.playMenuSelect();
        const nextDip = DipSwitchStore.cyclePreset();
        btnDip.textContent = `⚙ DIP: ${nextDip.label.split(' ')[0]}`;
        btnDip.title = `DIP Switches: ${nextDip.label} (${nextDip.lives} Lives, ${nextDip.difficultyName})`;
        if (this.activeGame) {
          this.activeGame.lives = nextDip.lives;
        }
        this.renderer.pushToast({
          icon: '⚙️',
          title: `DIP SWITCH: ${nextDip.label}`,
          desc: `Starting Lives: ${nextDip.lives} • Difficulty: ${nextDip.difficultyName}`,
          color: '#FFD700',
          timer: 2.4
        });
      });
    }

    const btnFav = document.getElementById('btn-fav-game');
    if (btnFav) {
      btnFav.addEventListener('click', () => {
        this.audio.init();
        this.audio.playCoin();
        const targetId = this.activeGameId || (this.mainMenu && GAME_CATALOG[this.mainMenu.selectedIndex]?.id);
        if (targetId) {
          const isFav = CloudPersistence.toggleFavorite(targetId);
          this._syncFavoriteButton();
          const meta = GAME_CATALOG.find((g) => g.id === targetId);
          this.renderer.pushToast({
            icon: isFav ? '♥' : '♡',
            title: isFav ? `SAVED TO FAVORITES` : `REMOVED FROM FAVORITES`,
            desc: meta ? meta.title : targetId.toUpperCase(),
            color: '#FF007A',
            timer: 2.1
          });
        }
      });
    }

    const btnSnap = document.getElementById('btn-snap');
    if (btnSnap) {
      btnSnap.addEventListener('click', () => {
        this.captureScreenshot();
      });
    }

    const btnAttract = document.getElementById('btn-attract');
    if (btnAttract) {
      btnAttract.addEventListener('click', () => {
        this.audio.init();
        this.audio.playMenuSelect();
        this.toggleAttractMode();
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
          const dip = DipSwitchStore.getPreset();
          if (typeof this.activeGame.lives === 'number') {
            this.activeGame.lives = dip.lives;
          }
          this.activeGame.setState('PLAYING');
          this._syncHeaderStatus();
        }
      });
    }

    const btnCrt = document.getElementById('btn-toggle-crt');
    if (btnCrt) {
      btnCrt.addEventListener('click', () => {
        const preset = this.renderer.crt.cyclePreset();
        btnCrt.textContent = `CRT: ${preset.label}`;
        btnCrt.classList.toggle('active', preset.enabled);
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
        btnAudio.textContent = `AUDIO: ${muted ? 'MUTED' : 'ON'}`;
        btnAudio.classList.toggle('active', !muted);
      });
    }

    this._syncFavoriteButton();
  }

  /**
   * Cleanly switches to any of the 28 games, resetting memory, timers, and input state
   */
  launchGame(gameId, opts = {}) {
    const id = String(gameId || '').toLowerCase();
    const GameClass = GAME_REGISTRY[id];
    if (!GameClass) return false;

    if (!opts.fromAttract && this.attractActive) {
      this.toggleAttractMode(false);
    }

    this._cleanupCurrentGame();
    this.input.mount();
    this.input.resetState();
    this._rewindBuffer = [];
    this._rewindSampleAccum = 0;

    this.activeGameId = id;
    this.activeGame = new GameClass(this.renderer, this.input, this.audio);

    // Apply DIP Switch starting lives
    const dip = DipSwitchStore.getPreset();
    if (typeof this.activeGame.lives === 'number') {
      this.activeGame.lives = dip.lives;
    }

    if (this.activeGame.state !== 'PLAYING') {
      this.activeGame.setState('PLAYING');
    }

    // Record play session to Firebase Cloud & unlock first coin achievement
    CloudPersistence.recordPlay(id);
    if (!opts.fromAttract) {
      this._tryUnlockAchievement('FIRST_COIN');
    }

    // Apply dynamic bezel lighting matching the game's cabinet accent color
    const meta = GAME_CATALOG.find((g) => g.id === id);
    if (meta && meta.accent) {
      document.documentElement.style.setProperty('--bezel-accent', meta.accent);
    }

    this.audio.playMusic(id, true);
    this._syncHeaderStatus();
    this._syncFavoriteButton();
    return true;
  }

  returnToLobby() {
    this.toggleAttractMode(false);
    this._cleanupCurrentGame();
    this.input.mount();
    this.input.resetState();
    this.activeGame = null;
    this.activeGameId = null;
    this._rewindBuffer = [];
    this.lobbyIdleTimer = 0;
    document.documentElement.style.setProperty('--bezel-accent', '#00F0FF');
    this.audio.playMusic('lobby', true);
    this._syncHeaderStatus();
    this._syncFavoriteButton();
  }

  _cleanupCurrentGame() {
    this.audio.stopSequence();
    // Cleanly unmount all keyboard, pointer, and touch control event listeners on game switch
    if (this.input && typeof this.input.unmount === 'function') {
      this.input.unmount();
    }
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
        statusEl.textContent = 'SELECT ANY ARCADE CABINET (50 CLASSIC COIN-OP GAMES)';
      }
    }

    document.querySelectorAll('.cabinet-pill').forEach((pill) => {
      const pid = pill.dataset.game;
      const isMatch = (!this.activeGameId && pid === 'lobby') || pid === this.activeGameId;
      pill.classList.toggle('active', isMatch);
    });
  }

  changeStage(delta = 1) {
    if (!this.activeGame) {
      this.renderer.pushToast({
        icon: '🗺️',
        title: 'LAUNCH A CABINET FIRST',
        desc: 'Select any game to cycle through its OG levels with [ or ].',
        color: '#00F0FF',
        timer: 2.2
      });
      return false;
    }

    const g = this.activeGame;
    const nextLvl = Math.max(1, (g.level || g.stage || g.wave || g.round || 1) + delta);
    g.level = nextLvl;
    if (typeof g.stage === 'number') g.stage = nextLvl;
    if (typeof g.wave === 'number') g.wave = nextLvl;
    if (typeof g.round === 'number') g.round = nextLvl;

    try {
      if (typeof g.loadLevel === 'function') g.loadLevel(nextLvl);
      else if (typeof g._loadLevel === 'function') g._loadLevel(nextLvl);
      else if (typeof g.initStage === 'function') g.initStage(nextLvl);
      else if (typeof g._initStage === 'function') g._initStage(nextLvl);
      else if (typeof g._initRound === 'function') g._initRound(true);
      else if (typeof g.initRound === 'function') g.initRound(nextLvl);
      else if (typeof g._initKitchen === 'function') g._initKitchen(nextLvl);
      else if (typeof g._buildCourse === 'function') g._buildCourse(nextLvl);
      else if (typeof g._buildFortress === 'function') {
        g._buildFortress(nextLvl);
        if (typeof g._initPaddle === 'function') g._initPaddle();
      } else if (typeof g._loadScreen === 'function') {
        g.screenIndex = nextLvl - 1;
        g._loadScreen(g.screenIndex);
      } else if (typeof g._initTrack === 'function') g._initTrack(nextLvl);
      else if (typeof g._buildTrack === 'function') g._buildTrack(nextLvl);
      else if (typeof g._initCourse === 'function') g._initCourse(nextLvl);
      else if (typeof g._initMaze === 'function') g._initMaze(nextLvl);
      else if (typeof g._buildCastleLayout === 'function') g._buildCastleLayout(nextLvl);
      else if (typeof g._setupBuilding === 'function') g._setupBuilding(nextLvl);
      else if (typeof g._setupWave === 'function') g._setupWave(nextLvl);
      else if (typeof g._loadTubeWave === 'function') g._loadTubeWave(nextLvl);
      else if (typeof g.initFloor === 'function') g.initFloor(nextLvl);
      else if (typeof g._initHighway === 'function') g._initHighway(nextLvl);
      else if (typeof g._initSector === 'function') g._initSector(nextLvl);
      else if (typeof g._initPyramid === 'function') g._initPyramid(nextLvl);
      else if (typeof g._buildCity === 'function') g._buildCity(nextLvl);
      else if (typeof g._initLevel === 'function') g._initLevel(nextLvl);
      else if (typeof g._initBout === 'function') g._initBout(nextLvl);
      else if (typeof g._initEvent === 'function') {
        g.eventIndex = (nextLvl - 1) % 5;
        g._initEvent(g.eventIndex);
      } else if (typeof g._spawnWave === 'function') g._spawnWave(nextLvl);
      else if (typeof g._initWave === 'function') g._initWave(nextLvl);
    } catch (_) {}

    g.state = 'PLAYING';
    this._rewindBuffer = [];
    this.audio.playStageClear();
    this._syncHeaderStatus();
    this.renderer.pushToast({
      icon: '🗺️',
      title: `${g.title.toUpperCase()} — STAGE ${nextLvl}`,
      desc: 'Switched to OG Level Layout ([ / ] to cycle levels)',
      color: '#FFD700',
      timer: 2.2
    });
    return true;
  }

  _handleEmulatorHotkeys() {
    // [F5] Save State / [F8] Load State / [ and ] Stage Select
    if (this.input.isKeyJustPressed('F5')) {
      this.saveCurrentState();
    }
    if (this.input.isKeyJustPressed('F8')) {
      this.loadCurrentState();
    }
    if (this.input.isKeyJustPressed('BracketLeft')) {
      this.changeStage(-1);
    }
    if (this.input.isKeyJustPressed('BracketRight')) {
      this.changeStage(1);
    }

    //When in GAMEOVER state, allow 3-initial entry with Up/Down/Left/Right
    if (this.activeGame && this.activeGame.state === 'GAMEOVER') {
      if (this.input.isJustPressed('left')) {
        this._initialsCursor = (this._initialsCursor + 2) % 3;
        this.audio.playMenuMove();
      } else if (this.input.isJustPressed('right')) {
        this._initialsCursor = (this._initialsCursor + 1) % 3;
        this.audio.playMenuMove();
      } else if (this.input.isJustPressed('up')) {
        const nextInit = InitialsStore.cycleChar(this._initialsCursor, 1);
        this.audio.playMenuMove();
        if (this.activeGame.score >= HighScoreStore.get(this.activeGameId)) {
          HighScoreStore.setHolder(this.activeGameId, nextInit);
          CloudPersistence.submitHighScore(this.activeGameId, this.activeGame.score, nextInit);
        }
      } else if (this.input.isJustPressed('down')) {
        const nextInit = InitialsStore.cycleChar(this._initialsCursor, -1);
        this.audio.playMenuMove();
        if (this.activeGame.score >= HighScoreStore.get(this.activeGameId)) {
          HighScoreStore.setHolder(this.activeGameId, nextInit);
          CloudPersistence.submitHighScore(this.activeGameId, this.activeGame.score, nextInit);
        }
      }
    }
  }

  _startLoop() {
    const tick = (now) => {
      const rawDt = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      const baseDt = Math.max(0.001, Math.min(0.05, rawDt));

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
      this.input.updateTurbo(baseDt);
      this._handleEmulatorHotkeys();
      this.renderer.beginFrame(baseDt);

      if (this.activeGame) {
        // Check Attract Mode cycling
        if (this.attractActive) {
          this.attractTimer += baseDt;
          if (this.attractTimer >= 18.0 || this.activeGame.state === 'GAMEOVER') {
            this.attractTimer = 0;
            this._launchNextAttractGame();
          } else {
            this._updateAttractAI(now * 0.001);
          }
        }

        const isRewinding =
          (this.input.isKeyDown('KeyR') || this._rewindButtonHeld) &&
          this._rewindBuffer.length > 0;

        if (isRewinding) {
          // Pop latest state from rewind ring buffer
          const snap = this._rewindBuffer.pop();
          if (snap) {
            SaveStateManager.restoreSnapshot(this.activeGame, snap);
            if (this.activeGame.state === 'GAMEOVER') {
              this.activeGame.state = 'PLAYING';
            }
          }
          this.renderer.rewindOverlay = {
            active: true,
            framesLeft: this._rewindBuffer.length,
            maxFrames: this._rewindMaxFrames
          };
          this._tryUnlockAchievement('TIME_TRAVELER');
        } else {
          this.renderer.rewindOverlay = {
            active: false,
            framesLeft: this._rewindBuffer.length,
            maxFrames: this._rewindMaxFrames
          };

          // Frame-step when paused via [.] Period key
          const frameStep =
            this.activeGame.state === 'PAUSED' && this.input.isKeyJustPressed('Period');

          if (frameStep) {
            this.activeGame.state = 'PLAYING';
            this.activeGame.update(1 / 60);
            this.activeGame.state = 'PAUSED';
          } else {
            const dip = DipSwitchStore.getPreset();
            const scaledDt = baseDt * this.speedMultiplier * (dip ? dip.speedScale : 1.0);
            this.activeGame.update(scaledDt);
          }

          // Sample rewind snapshot at 20Hz while PLAYING
          if (this.activeGame.state === 'PLAYING') {
            this._rewindSampleAccum += baseDt;
            if (this._rewindSampleAccum >= 0.05) {
              this._rewindSampleAccum = 0;
              const snap = SaveStateManager.createSnapshot(this.activeGame);
              if (snap) {
                this._rewindBuffer.push(snap);
                if (this._rewindBuffer.length > this._rewindMaxFrames) {
                  this._rewindBuffer.shift();
                }
              }
            }
          }

          // Check score & level achievements
          if ((this.activeGame.score || 0) >= 10000) {
            this._tryUnlockAchievement('HIGH_ROLLER_10K');
          }
          if ((this.activeGame.level || this.activeGame.stage || 1) >= 2) {
            this._tryUnlockAchievement('STAGE_CONQUEROR');
          }
        }

        this.activeGame.render(this.renderer.ctx);
      } else {
        // Lobby idle timer for auto-attract mode (45s of no input)
        if (this.input.keysDown.size === 0 && !this.input.pointer.isDown) {
          this.lobbyIdleTimer += baseDt;
          if (this.lobbyIdleTimer >= 45.0 && !this.attractActive) {
            this.lobbyIdleTimer = 0;
            this.toggleAttractMode(true);
          }
        } else {
          this.lobbyIdleTimer = 0;
        }

        const prevSelected = this.mainMenu.selectedIndex;
        this.mainMenu.update(baseDt);
        if (this.mainMenu.selectedIndex !== prevSelected) {
          this._syncFavoriteButton();
        }
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
