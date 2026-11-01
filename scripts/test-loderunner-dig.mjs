#!/usr/bin/env node
/**
 * test-loderunner-dig.mjs
 * Verification for separate Left and Right brick blasting in Lode Runner.
 */
import assert from 'node:assert/strict';

// Mock storage & globals
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k)
};

function createMockCtx() {
  const noop = () => {};
  return new Proxy(
    {
      fillStyle: '#000',
      strokeStyle: '#fff',
      lineWidth: 1,
      font: '12px monospace',
      measureText: () => ({ width: 50 })
    },
    { get: (t, p) => (p in t ? t[p] : noop) }
  );
}

class MockRenderer {
  constructor() {
    this.width = 960;
    this.height = 540;
    this.ctx = createMockCtx();
  }
  clear() {}
  drawGlowRect() {}
  drawText() {}
  drawHUD() {}
  drawStateOverlay() {}
}

const { TILE, LodeRunner } = await import('../src/games/LodeRunner.js');
const { AudioSynth } = await import('../src/engine/AudioSynth.js');

console.log('🧱 Testing Lode Runner Distinct Left & Right Blast Controls...');

const renderer = new MockRenderer();
const audio = new AudioSynth();

let pressedActions = new Set();
let justPressedActions = new Set();
let pressedKeys = new Set();
let justPressedKeys = new Set();
let pointerState = { x: 480, y: 270, down: false, justPressed: false };

const mockInput = {
  getAxis: () => ({ x: 0, y: 0 }),
  isDown: (act) => pressedActions.has(act),
  isJustPressed: (act) => justPressedActions.has(act),
  isKeyDown: (k) => pressedKeys.has(k),
  isKeyJustPressed: (k) => justPressedKeys.has(k),
  pointer: pointerState
};

const lr = new LodeRunner(renderer, mockInput, audio);

// Setup a clean test platform: player at col 10, row 5
// Brick at (9, 6) [down-left] and Brick at (11, 6) [down-right]
// Solid at (10, 6) [directly below player]
lr.player.col = 10;
lr.player.row = 5;
lr.grid[6][9] = TILE.BRICK;
lr.grid[6][10] = TILE.SOLID;
lr.grid[6][11] = TILE.BRICK;
lr.grid[5][9] = TILE.EMPTY;
lr.grid[5][10] = TILE.EMPTY;
lr.grid[5][11] = TILE.EMPTY;

// TEST 1: KeyZ / KeyQ MUST blast LEFT even if player is holding RIGHT direction
pressedActions.add('right');
pressedKeys.add('ArrowRight');
justPressedKeys.add('KeyZ');
justPressedActions.add('actionA');

lr.update(0.016);

assert.strictEqual(lr.grid[6][9], TILE.EMPTY, 'Left brick at (9, 6) must be blasted by KeyZ');
assert.strictEqual(lr.grid[6][11], TILE.BRICK, 'Right brick at (11, 6) must remain intact');
assert.strictEqual(lr.player.digDir, -1, 'digDir must be -1 (Left)');
console.log('✅ KeyZ strictly blasts Left even when holding Right arrow.');

// Reset bricks
lr.grid[6][9] = TILE.BRICK;
lr.grid[6][11] = TILE.BRICK;
lr.dugBricks = [];
lr.player.digTimer = 0;
pressedActions.clear();
pressedKeys.clear();
justPressedKeys.clear();
justPressedActions.clear();

// TEST 2: KeyX / KeyE MUST blast RIGHT even if player is holding LEFT direction
pressedActions.add('left');
pressedKeys.add('ArrowLeft');
justPressedKeys.add('KeyX');
justPressedActions.add('actionB');

lr.update(0.016);

assert.strictEqual(lr.grid[6][11], TILE.EMPTY, 'Right brick at (11, 6) must be blasted by KeyX');
assert.strictEqual(lr.grid[6][9], TILE.BRICK, 'Left brick at (9, 6) must remain intact');
assert.strictEqual(lr.player.digDir, 1, 'digDir must be 1 (Right)');
console.log('✅ KeyX strictly blasts Right even when holding Left arrow.');

// Reset bricks
lr.grid[6][9] = TILE.BRICK;
lr.grid[6][11] = TILE.BRICK;
lr.dugBricks = [];
lr.player.digTimer = 0;
pressedActions.clear();
pressedKeys.clear();
justPressedKeys.clear();
justPressedActions.clear();

// TEST 3: KeyQ blasts Left
justPressedKeys.add('KeyQ');
lr.update(0.016);
assert.strictEqual(lr.grid[6][9], TILE.EMPTY, 'Left brick must be blasted by KeyQ');
assert.strictEqual(lr.player.digDir, -1, 'digDir must be -1');
console.log('✅ KeyQ (WASD left dig) strictly blasts Left.');

// Reset bricks
lr.grid[6][9] = TILE.BRICK;
lr.grid[6][11] = TILE.BRICK;
lr.dugBricks = [];
lr.player.digTimer = 0;
justPressedKeys.clear();

// TEST 4: KeyE blasts Right
justPressedKeys.add('KeyE');
lr.update(0.016);
assert.strictEqual(lr.grid[6][11], TILE.EMPTY, 'Right brick must be blasted by KeyE');
assert.strictEqual(lr.player.digDir, 1, 'digDir must be 1');
console.log('✅ KeyE (WASD right dig) strictly blasts Right.');

// Reset bricks
lr.grid[6][9] = TILE.BRICK;
lr.grid[6][11] = TILE.BRICK;
lr.dugBricks = [];
lr.player.digTimer = 0;
justPressedKeys.clear();

// TEST 5: Pointer Tap to Left of player blasts Left
const playerPixelX = lr.colToX(10) + lr.tileW * 0.5;
pointerState.x = playerPixelX - 50;
pointerState.y = lr.rowToY(5) + 10;
pointerState.justPressed = true;
lr.update(0.016);
assert.strictEqual(lr.grid[6][9], TILE.EMPTY, 'Clicking to left of player must blast Left');
console.log('✅ Screen tap to the left of player strictly blasts Left.');

// Reset bricks
lr.grid[6][9] = TILE.BRICK;
lr.grid[6][11] = TILE.BRICK;
lr.dugBricks = [];
lr.player.digTimer = 0;

// TEST 6: Pointer Tap to Right of player blasts Right
pointerState.x = playerPixelX + 50;
pointerState.y = lr.rowToY(5) + 10;
pointerState.justPressed = true;
lr.update(0.016);
assert.strictEqual(lr.grid[6][11], TILE.EMPTY, 'Clicking to right of player must blast Right');
console.log('✅ Screen tap to the right of player strictly blasts Right.');

console.log('🏆 ALL LODE RUNNER SEPARATE LEFT/RIGHT BLAST CONTROLS VERIFIED 100%!');
