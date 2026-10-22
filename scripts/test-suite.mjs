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
  addEventListener: () => {},
  removeEventListener: () => {},
  devicePixelRatio: 1
};

function createMockEl() {
  const ctx = createMockCtx();
  return {
    width: 960,
    height: 540,
    clientWidth: 960,
    clientHeight: 540,
    style: { setProperty: () => {} },
    dataset: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,',
    appendChild: () => {},
    removeChild: () => {},
    remove: () => {},
    querySelector: () => createMockEl(),
    querySelectorAll: () => [],
    addEventListener: () => {},
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

// Check 4: Boot, Simulate, Snapshot/Restore, State-Transition & Destroy all 50 Games
let passedGames = 0;
for (const id of catalogIds) {
  const GameClass = GAME_REGISTRY[id];
  if (!GameClass) {
    console.error(`❌ Missing class in GAME_REGISTRY for id: ${id}`);
    failures++;
    continue;
  }

  try {
    const game = new GameClass(mockRenderer, mockInput, audio);

    // Simulate 60 frames with varied inputs
    const actions = ['left', 'right', 'up', 'down', 'actionA', 'actionB'];
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

      game.update(1 / 60);
      game.render(ctx);
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
console.log('===================================================================');

if (failures > 0) {
  console.error(`❌ Test suite completed with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('🏆 ALL 50 GAMES & STUDIO SYSTEMS PASSED WITH ZERO ERRORS!');
}
