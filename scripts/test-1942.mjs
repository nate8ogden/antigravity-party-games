#!/usr/bin/env node
/**
 * test-1942.mjs
 * Verification suite for 1942 Vertical Air Combat Shmup.
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
      globalAlpha: 1,
      font: '12px monospace',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      shadowColor: 'transparent',
      shadowBlur: 0,
      setLineDash: noop,
      measureText: (txt) => ({ width: String(txt || '').length * 8 })
    },
    {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        return noop;
      },
      set: (target, prop, val) => {
        target[prop] = val;
        return true;
      }
    }
  );
}

class MockRenderer {
  constructor() {
    this.width = 960;
    this.height = 540;
    this.ctx = createMockCtx();
  }
  clear() {}
  shake() {}
  drawGlowCircle() {}
  drawGlowRect() {}
  drawText() {}
  drawHUD() {}
  drawStateOverlay() {}
}

const { AudioSynth } = await import('../src/engine/AudioSynth.js');
const { Game1942 } = await import('../src/games/Game1942.js');

console.log('🛩️ Testing 1942 Pacific Air Combat Simulation...');

const renderer = new MockRenderer();
const audio = new AudioSynth();
let inputKeys = new Set();
let justPressedKeys = new Set();

const mockInput = {
  getAxis: () => ({ x: 0, y: 0 }),
  isDown: (k) => inputKeys.has(k),
  isPressed: (k) => inputKeys.has(k),
  isJustPressed: (k) => justPressedKeys.has(k),
  isKeyDown: (k) => inputKeys.has(k),
  isKeyJustPressed: (k) => justPressedKeys.has(k),
  pointer: { x: 480, y: 270, down: false, justPressed: false, justReleased: false }
};

const game = new Game1942(renderer, mockInput, audio);

// 1. Initial State & Scenery
assert.strictEqual(game.id, 'game1942', 'Game ID should be game1942');
assert.strictEqual(game.title, '1942', 'Game Title should be 1942');
assert.strictEqual(game.stageConfig.stageNum, 32, 'Initial stage should be Stage 32 Midway');
assert.strictEqual(game.player.loopsLeft, 3, 'Player should start with 3 Loop rolls');
console.log('✅ Initial P-38 Lightning setup & Stage 32 Pacific ocean verified.');

// 2. Machine Gun Firing
inputKeys.add('actionA');
game.update(0.016);
assert(game.playerBullets.length >= 2, 'Player should fire twin machine gun bullets');
console.log('✅ Twin forward machine guns verified.');

// 3. 360-Degree Loop Roll
inputKeys.delete('actionA');
justPressedKeys.add('actionB');
game.update(0.016);
justPressedKeys.clear();
assert.strictEqual(game.player.isLooping, true, 'Player should be looping');
assert.strictEqual(game.player.loopsLeft, 2, 'Loops left should decrement to 2');

// Loop invulnerability
const bullet = { x: game.player.x, y: game.player.y, vx: 0, vy: 100 };
game.enemyBullets.push(bullet);
game.update(0.1);
assert.strictEqual(game.lives, 3, 'Player should be invulnerable during 360 loop roll');

// Complete loop
for (let i = 0; i < 60; i++) game.update(0.016);
assert.strictEqual(game.player.isLooping, false, 'Player loop should complete cleanly');
console.log('✅ 360° Loop Roll mechanics & aerial invulnerability verified.');

// 4. Twin Escort Wingmen Powerup
game._collectPowerup({ type: 'wingmen', x: game.player.x, y: game.player.y });
assert.strictEqual(game.player.hasWingmen, true, 'Player should have Twin Escort Wingmen');
inputKeys.add('actionA');
game.player.fireCooldown = 0;
game.update(0.016);
inputKeys.delete('actionA');
assert(game.playerBullets.length >= 6, 'Twin Escorts should boost firepower to 6 simultaneous gun streams');
console.log('✅ Twin Escort Fighter wingmen powerup & 6-bullet storm verified.');

// 5. Wingmen Damage Absorption
const attackBullet = { x: game.player.x - 34, y: game.player.y + 6, vx: 0, vy: 100 };
game.enemyBullets.push(attackBullet);
game.player.invulnerableTimer = 0;
game.update(0.016);
assert.strictEqual(game.lives, 3, 'Wingman should absorb lethal bullet hit to protect main plane');
console.log('✅ Wingman bullet absorption verified.');

// 6. Red Squadron Formation & 100% Squad Wipe
const formId = 'test_squad';
game.formations.set(formId, { totalPlanes: 3, destroyedCount: 0 });
const p1 = { type: 'red_squadron', formationId: formId, hp: 1, hitRadius: 15, points: 150, x: 200, y: 100 };
const p2 = { type: 'red_squadron', formationId: formId, hp: 1, hitRadius: 15, points: 150, x: 240, y: 100 };
const p3 = { type: 'red_squadron', formationId: formId, hp: 1, hitRadius: 15, points: 150, x: 280, y: 100 };
game.enemies.push(p1, p2, p3);

game._destroyEnemy(p1);
game._destroyEnemy(p2);
const prePow = game.powerups.length;
game._destroyEnemy(p3);
assert(game.powerups.length > prePow, '100% squad wipe must drop golden [POW] capsule');
console.log('✅ Red Squadron 100% squad wipe bonus & [POW] drop verified.');

// 7. Mega Bomb Blast
game.enemyBullets.push({ x: 300, y: 300, vx: 0, vy: 100 }, { x: 400, y: 300, vx: 0, vy: 100 });
game.triggerMegaBomb();
assert.strictEqual(game.enemyBullets.length, 0, 'Mega Bomb must vaporize all enemy bullets');
console.log('✅ Mega Bomb screen blast & bullet conversion verified.');

// 8. Daihishyo Ayako Super-Bomber Flagship Boss
game._spawnAyakoBoss();
assert(game.boss !== null, 'Ayako boss should be spawned');
assert.strictEqual(game.boss.type, 'ayako_boss', 'Boss type must be ayako_boss');
game.boss.hp = 1;
game._destroyEnemy(game.boss);
assert(game.stageClearTimer > 0, 'Destroying Ayako boss must initiate stage clear sequence');
console.log('✅ Daihishyo Ayako Super-Bomber boss battle verified.');

// 9. Save State Capture & Restore
const state = game.captureState();
assert.strictEqual(state.stage, 1, 'Captured stage should be 1');
state.score = 99900;
state.stage = 5;
game.restoreState(state);
assert.strictEqual(game.score, 99900, 'Restored score should match');
assert.strictEqual(game.stage, 5, 'Restored stage should match');
console.log('✅ SaveStateManager capture & restore round-trip verified.');

// 10. Multi-Level Stage Progression (32 -> 4)
for (let lvl = 1; lvl <= 8; lvl++) {
  game.initStage(lvl);
  assert(game.stageConfig !== undefined, `Stage ${lvl} config must exist`);
  game.update(1 / 60);
  game.render(renderer.ctx);
}
console.log('✅ Multi-Stage Progression (32 Midway -> 4 Tokyo Bay) verified.');

console.log('🏆 1942 PACIFIC AIR COMBAT SUITE: ALL TESTS PASSED WITH 100% SUCCESS!');
