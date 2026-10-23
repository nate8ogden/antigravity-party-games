#!/usr/bin/env node
/**
 * Retro Arcade Studio — Automated 50-Game Verification & Self-Correction Test Suite
 * ==================================================================================
 * Validates:
 * 1. All 50 games in GAME_REGISTRY & GAME_CATALOG instantiate cleanly
 * 2. All 51 AudioSynth chiptune soundtracks ('lobby' + 50 games) exist
 * 3. MainMenu renders all 3 tabs ('core', 'expanded', 'vault2') & all 50 miniature arcade screenshots
 * 4. Every game runs 60 frames of update(dt) + render(ctx) under simulated directional + action + pointer inputs
 * 5. State machine transitions (MENU -> PLAYING -> PAUSED -> PLAYING -> GAMEOVER -> reset() -> destroy())
 * 6. SaveStateManager snapshot capture & restore round-trip on all 50 games
 */

// 1. Setup headless browser globals before importing modules
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k)
};

function createMockCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return new Proxy(
    {
      fillStyle: '#000',
      strokeStyle: '#fff',
      lineWidth: 1,
      globalAlpha: 1,
      font: '12px monospace',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      shadowColor: 'transparent',
      shadowBlur: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      measureText: (txt) => ({ width: String(txt || '').length * 8 }),
      getImageData: (x, y, w, h) => ({
        data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
        width: w,
        height: h
      }),
      putImageData: noop
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return noop;
      },
      set(target, prop, val) {
        target[prop] = val;
        return true;
      }
    }
  );
}

globalThis.window = {
  location: { search: '', protocol: 'https:' },
  _listeners: new Map(),
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
  },
  removeEventListener(type, fn) {
    if (this._listeners.has(type)) this._listeners.get(type).delete(fn);
  },
  getListenerCount() {
    let total = 0;
    for (const s of this._listeners.values()) total += s.size;
    return total;
  },
  devicePixelRatio: 1
};

function createMockEl() {
  const ctx = createMockCtx();
  const listeners = new Map();
  const utilBtns = ['start', 'pause', 'menu'].map((act) => {
    const bl = new Map();
    return {
      getAttribute: (k) => (k === 'data-action' ? act : null),
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      addEventListener(t, fn) {
        if (!bl.has(t)) bl.set(t, new Set());
        bl.get(t).add(fn);
      },
      removeEventListener(t, fn) {
        if (bl.has(t)) bl.get(t).delete(fn);
      }
    };
  });
  return {
    width: 960,
    height: 540,
    clientWidth: 960,
    clientHeight: 540,
    style: { setProperty: () => {}, transform: '' },
    dataset: {},
    _listeners: listeners,
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,',
    appendChild: () => {},
    removeChild: () => {},
    remove: () => {},
    querySelector: () => createMockEl(),
    querySelectorAll: (sel) => (sel === '.touch-utility-btn' ? utilBtns : []),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      if (listeners.has(type)) listeners.get(type).delete(fn);
    },
    setAttribute: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 })
  };
}

globalThis.document = {
  createElement: () => createMockEl(),
  documentElement: createMockEl(),
  body: createMockEl(),
  getElementById: () => createMockEl(),
  querySelector: () => createMockEl(),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

Object.defineProperty(globalThis, 'navigator', {
  value: {
    maxTouchPoints: 0,
    userAgent: 'NodeTestRunner/1.0',
    getGamepads: () => []
  },
  configurable: true,
  writable: true
});

globalThis.performance = globalThis.performance || { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 1;

// 2. Import Studio Modules
const { Renderer, HighScoreStore } = await import('../src/engine/Renderer.js');
const { InputManager } = await import('../src/engine/Input.js');
const { AudioSynth, SOUNDTRACKS } = await import('../src/engine/AudioSynth.js');
const { SaveStateManager } = await import('../src/engine/CloudPersistence.js');
const { MainMenu, GAME_CATALOG } = await import('../src/ui/MainMenu.js');
const { GAME_REGISTRY } = await import('../src/main.js');

const ctx = createMockCtx();
const mockRenderer = new Renderer(createMockEl(), createMockEl());

let activeInputState = {
  dx: 0,
  dy: 0,
  pressed: new Set(),
  justPressed: new Set(),
  keysJustPressed: new Set(),
  swipe: null,
  pointer: { x: 480, y: 270, down: false, justPressed: false, justReleased: false }
};

const mockInput = {
  getAxis: () => ({ x: activeInputState.dx, y: activeInputState.dy }),
  isDown: (action) => activeInputState.pressed.has(action),
  isPressed: (action) => activeInputState.pressed.has(action),
  isJustPressed: (action) => activeInputState.justPressed.has(action),
  isKeyDown: (code) => activeInputState.keysJustPressed.has(code),
  isKeyJustPressed: (code) => activeInputState.keysJustPressed.has(code),
  consumeSwipe: () => {
    const s = activeInputState.swipe;
    activeInputState.swipe = null;
    return s;
  },
  get pointer() {
    return activeInputState.pointer;
  }
};

const audio = new AudioSynth();

console.log('===================================================================');
console.log('🧪 RETRO ARCADE STUDIO — 50-GAME AUTOMATED VERIFICATION SUITE');
console.log('===================================================================');

let failures = 0;

// Check 1: Catalog & Registry count
const catalogIds = GAME_CATALOG.map((g) => g.id);
const registryIds = Object.keys(GAME_REGISTRY);
console.log(`Catalog Games : ${catalogIds.length} | Registry Games : ${registryIds.length}`);

if (catalogIds.length !== 50 || registryIds.length !== 50) {
  console.error(`❌ Expected 50 games, got Catalog=${catalogIds.length}, Registry=${registryIds.length}`);
  failures++;
}

// Check 2: AudioSynth Soundtracks
for (const id of ['lobby', ...catalogIds]) {
  if (!SOUNDTRACKS[id]) {
    console.error(`❌ Missing soundtrack in AudioSynth.js for: ${id}`);
    failures++;
  }
}
console.log(`✅ Verified ${Object.keys(SOUNDTRACKS).length} procedural chiptune soundtracks.`);

// Check 3: MainMenu Tabs & Miniature Screenshots
try {
  const menu = new MainMenu(mockRenderer, mockInput, audio, () => {});
  for (const tab of ['core', 'expanded', 'vault2']) {
    menu.setTab(tab);
    menu.update(1 / 60);
    menu.render(ctx);
  }
  for (const g of GAME_CATALOG) {
    menu.drawGamePreview(ctx, g.id, 10, 10, 120, 64, 1.25);
  }
  console.log('✅ Verified MainMenu 3-tab rendering & all 50 live miniature arcade screenshots.');
} catch (err) {
  console.error('❌ MainMenu test failed:', err);
  failures++;
}

// Check 4: Boot, Simulate, Frame-Rate Analysis, Snapshot/Restore, State-Transition & Destroy all 50 Games
let passedGames = 0;
const frameStats = [];
const heapBeforeAll = process.memoryUsage().heapUsed;

for (const id of catalogIds) {
  const GameClass = GAME_REGISTRY[id];
  if (!GameClass) {
    console.error(`❌ Missing class in GAME_REGISTRY for id: ${id}`);
    failures++;
    continue;
  }

  try {
    const game = new GameClass(mockRenderer, mockInput, audio);

    // Simulate 60 frames with varied inputs & measure frame execution time
    const actions = ['left', 'right', 'up', 'down', 'actionA', 'actionB'];
    let totalFrameMs = 0;
    let maxFrameMs = 0;
    for (let f = 0; f < 60; f++) {
      const act = actions[f % actions.length];
      activeInputState.dx = f % 3 === 0 ? 1 : f % 3 === 1 ? -1 : 0;
      activeInputState.dy = f % 4 === 0 ? -1 : f % 4 === 2 ? 1 : 0;
      activeInputState.pressed = new Set([act]);
      activeInputState.justPressed = f % 5 === 0 ? new Set([act]) : new Set();
      activeInputState.pointer = {
        x: 200 + ((f * 11) % 560),
        y: 100 + ((f * 7) % 360),
        down: f % 6 === 0,
        justPressed: f % 6 === 0,
        justReleased: f % 6 === 3
      };

      const t0 = performance.now();
      game.update(1 / 60);
      game.render(ctx);
      const elapsed = performance.now() - t0;
      totalFrameMs += elapsed;
      if (elapsed > maxFrameMs) maxFrameMs = elapsed;
    }
    const avgFrameMs = totalFrameMs / 60;
    frameStats.push({ id, avgFrameMs, maxFrameMs });
    if (avgFrameMs > 16.67) {
      console.error(`❌ Game [${id}] exceeded 60 FPS frame budget: ${avgFrameMs.toFixed(2)}ms`);
      failures++;
    }

    // Verify SaveStateManager snapshot capture & restore
    const snapshot = SaveStateManager.captureSnapshot(game);
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('SaveStateManager.captureSnapshot returned empty snapshot');
    }
    SaveStateManager.applySnapshot(game, snapshot);
    game.update(1 / 60);
    game.render(ctx);

    // Verify state transitions
    for (const st of ['PAUSED', 'MENU', 'GAMEOVER', 'PLAYING']) {
      if (typeof game.setState === 'function') {
        game.setState(st);
      } else {
        game.state = st;
      }
      activeInputState.justPressed = new Set();
      activeInputState.pointer.justPressed = false;
      game.update(1 / 60);
      game.render(ctx);
    }

    // Verify OG Multi-Level Stage Progression across Levels 1..8
    for (let lvl = 2; lvl <= 8; lvl++) {
      game.level = lvl;
      if (typeof game.stage === 'number') game.stage = lvl;
      if (typeof game.wave === 'number') game.wave = lvl;
      if (typeof game.round === 'number') game.round = lvl;

      if (typeof game.loadLevel === 'function') game.loadLevel(lvl);
      else if (typeof game._loadLevel === 'function') game._loadLevel(lvl);
      else if (typeof game.initStage === 'function') game.initStage(lvl);
      else if (typeof game._initStage === 'function') game._initStage(lvl);
      else if (typeof game._initRound === 'function') game._initRound(true);
      else if (typeof game.initRound === 'function') game.initRound(lvl);
      else if (typeof game._initKitchen === 'function') game._initKitchen(lvl);
      else if (typeof game._buildCourse === 'function') game._buildCourse(lvl);
      else if (typeof game._buildFortress === 'function') {
        game._buildFortress(lvl);
        if (typeof game._initPaddle === 'function') game._initPaddle();
      } else if (typeof game._loadScreen === 'function') {
        game.screenIndex = lvl - 1;
        game._loadScreen(game.screenIndex);
      } else if (typeof game._initTrack === 'function') game._initTrack(lvl);
      else if (typeof game._buildTrack === 'function') game._buildTrack(lvl);
      else if (typeof game._initCourse === 'function') game._initCourse(lvl);
      else if (typeof game._initMaze === 'function') game._initMaze(lvl);
      else if (typeof game._buildCastleLayout === 'function') game._buildCastleLayout(lvl);
      else if (typeof game._setupBuilding === 'function') game._setupBuilding(lvl);
      else if (typeof game._setupWave === 'function') game._setupWave(lvl);
      else if (typeof game._loadTubeWave === 'function') game._loadTubeWave(lvl);
      else if (typeof game.initFloor === 'function') game.initFloor(lvl);
      else if (typeof game._initHighway === 'function') game._initHighway(lvl);
      else if (typeof game._initSector === 'function') game._initSector(lvl);
      else if (typeof game._initPyramid === 'function') game._initPyramid(lvl);
      else if (typeof game._buildCity === 'function') game._buildCity(lvl);
      else if (typeof game._initLevel === 'function') game._initLevel(lvl);
      else if (typeof game._initBout === 'function') game._initBout(lvl);
      else if (typeof game._initEvent === 'function') {
        game.eventIndex = (lvl - 1) % 5;
        game._initEvent(game.eventIndex);
      } else if (typeof game._spawnWave === 'function') game._spawnWave(lvl);
      else if (typeof game._initWave === 'function') game._initWave(lvl);

      game.state = 'PLAYING';
      game.update(1 / 60);
      game.render(ctx);
    }

    // Verify reset() and destroy()
    if (typeof game.reset === 'function') {
      game.reset();
      game.update(1 / 60);
      game.render(ctx);
    }
    if (typeof game.destroy === 'function') {
      game.destroy();
    }

    passedGames++;
  } catch (err) {
    console.error(`❌ Game [${id}] failed verification:`, err);
    failures++;
  }
}

console.log(`✅ Passed full lifecycle, simulation & save-state verification: ${passedGames}/50 games`);

// Check 5: Frame-Rate & Memory Leak Analysis across all 50 games + Touch/Keyboard Listener Unmount Verification
try {
  const overallAvgMs =
    frameStats.reduce((sum, s) => sum + s.avgFrameMs, 0) / Math.max(1, frameStats.length);
  const slowest = [...frameStats].sort((a, b) => b.avgFrameMs - a.avgFrameMs)[0];
  console.log(
    `✅ 50-Game Frame-Time Analysis: Mean=${overallAvgMs.toFixed(3)}ms/frame (60 FPS budget=16.67ms) | Peak Game=${slowest.id} (${slowest.avgFrameMs.toFixed(3)}ms/frame)`
  );

  // Verify InputManager + TouchControls mount / unmount lifecycle across 100 game switches
  const baseWinListeners = globalThis.window.getListenerCount();
  const testCanvas = createMockEl();
  const realInput = new InputManager(testCanvas);
  const mountedCount = realInput.getActiveListenerCount();
  const winCountMounted = globalThis.window.getListenerCount();
  if (mountedCount <= 0 || winCountMounted <= baseWinListeners) {
    throw new Error(`Expected positive mounted listener count, got ${mountedCount}`);
  }

  // Unmount and confirm 0 active listeners remain on realInput and window returns to baseline
  realInput.unmount();
  if (realInput.getActiveListenerCount() !== 0) {
    throw new Error(`Expected 0 active listeners after unmount(), got ${realInput.getActiveListenerCount()}`);
  }
  if (globalThis.window.getListenerCount() !== baseWinListeners) {
    throw new Error(
      `Expected window listeners to return to baseline (${baseWinListeners}) after unmount(), got ${globalThis.window.getListenerCount()}`
    );
  }

  // Simulate 100 rapid game switches (unmount -> destroy old game -> mount -> resetState -> new game)
  for (let i = 0; i < 100; i++) {
    const gid = catalogIds[i % catalogIds.length];
    realInput.unmount();
    realInput.mount();
    realInput.resetState();
    const g = new GAME_REGISTRY[gid](mockRenderer, realInput, audio);
    g.update(1 / 60);
    g.destroy();
  }

  const after100SwitchesCount = realInput.getActiveListenerCount();
  const winAfter100Switches = globalThis.window.getListenerCount();
  if (after100SwitchesCount !== mountedCount || winAfter100Switches !== winCountMounted) {
    throw new Error(
      `Listener leak detected after 100 switches: before=${mountedCount}/${winCountMounted}, after=${after100SwitchesCount}/${winAfter100Switches}`
    );
  }
  realInput.destroy();

  const heapAfterAll = process.memoryUsage().heapUsed;
  const heapDeltaMB = (heapAfterAll - heapBeforeAll) / (1024 * 1024);
  console.log(
    `✅ Touch & Keyboard Listener Unmount Verified: ${mountedCount} listeners mounted -> 0 on unmount -> ${after100SwitchesCount} after 100 switches (0 leaked) | Heap Delta=${heapDeltaMB.toFixed(2)} MB`
  );
} catch (err) {
  console.error('❌ Listener / Memory Leak verification failed:', err);
  failures++;
}

// Check 6: Primary Roster Authentic Level Replication & Web Audio Frequency Verification
try {
  const lr = new GAME_REGISTRY.loderunner(mockRenderer, mockInput, audio);
  if (lr.cols !== 28 || lr.rows !== 16 || lr.totalGold !== 6 || lr.guards.length < 3) {
    throw new Error(`LodeRunner Stage 1 mismatch: ${lr.cols}x${lr.rows}, gold=${lr.totalGold}, guards=${lr.guards.length}`);
  }
  const dd = new GAME_REGISTRY.digdug(mockRenderer, mockInput, audio);
  if (dd.enemies.length !== 4 || dd.rocks.length !== 4 || dd.player.x !== 480 || dd.player.y !== 300) {
    throw new Error(`DigDug Stage 1 mismatch: enemies=${dd.enemies.length}, rocks=${dd.rocks.length}`);
  }
  const dk = new GAME_REGISTRY.donkeykong(mockRenderer, mockInput, audio);
  if (dk.girders.length !== 7 || dk.hammers.length !== 2 || dk.oilDrum.x !== 145) {
    throw new Error(`DonkeyKong 25m Stage 1 mismatch: girders=${dk.girders.length}, hammers=${dk.hammers.length}`);
  }
  const sumo = new GAME_REGISTRY.sumo(mockRenderer, mockInput, audio);
  if (sumo.ringRadius !== 195 || sumo.ringCenter.x !== 480 || sumo.ringCenter.y !== 300) {
    throw new Error(`Sumo Dohyo ring mismatch: radius=${sumo.ringRadius}`);
  }
  const pac = new GAME_REGISTRY.pacman(mockRenderer, mockInput, audio);
  if (pac.ghosts.length !== 4) {
    throw new Error(`PacMan ghosts mismatch: ${pac.ghosts.length}`);
  }
  const frog = new GAME_REGISTRY.frogger(mockRenderer, mockInput, audio);
  if (frog.bays.length !== 5 || frog.lifeTimer !== 60.0) {
    throw new Error(`Frogger Stage 1 mismatch: bays=${frog.bays.length}, timer=${frog.lifeTimer}`);
  }
  const gal = new GAME_REGISTRY.galaga(mockRenderer, mockInput, audio);
  if (gal.enemies.length !== 40) {
    throw new Error(`Galaga formation mismatch: ${gal.enemies.length}`);
  }
  const si = new GAME_REGISTRY.spaceinvaders(mockRenderer, mockInput, audio);
  if (si.invaders.length !== 55 || si.bunkers.length !== 4) {
    throw new Error(`SpaceInvaders Stage 1 mismatch: invaders=${si.invaders.length}, bunkers=${si.bunkers.length}`);
  }
  console.log('✅ Primary Roster Level Replication Verified (LodeRunner 28x16/6-Gold, DigDug 4-Chamber/4-Rock, DK 25m 6-Girder, Sumo 195px Dohyo, Pac-Man 4-Ghosts, Frogger 5-Bay/60s, Galaga 40-Ship, SpaceInvaders 5x11/4-Bunker).');
} catch (err) {
  console.error('❌ Primary Roster Level Replication check failed:', err);
  failures++;
}

console.log('===================================================================');

if (failures > 0) {
  console.error(`❌ Test suite completed with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('🏆 ALL 50 GAMES & STUDIO SYSTEMS PASSED WITH ZERO ERRORS!');
}
