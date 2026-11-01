#!/usr/bin/env node
/**
 * test-syndicate.mjs
 * Verification suite for Syndicate Cyberpunk Tactical Squad Shooter.
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
const { Syndicate } = await import('../src/games/Syndicate.js');

console.log('🕶️ Testing Syndicate Cyberpunk Tactical Squad Simulation...');

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

const game = new Syndicate(renderer, mockInput, audio);

// 1. Initial State & Squad Formation
assert.strictEqual(game.id, 'syndicate', 'Game ID must be syndicate');
assert.strictEqual(game.title, 'Syndicate', 'Game Title must be Syndicate');
assert.strictEqual(game.mission.city, 'LONDON', 'Stage 1 must be London mission');
assert.strictEqual(game.agents.length, 4, 'Must deploy 4-Agent Strike Team (Alpha, Bravo, Charlie, Delta)');
assert.strictEqual(game.agents.filter((a) => a.alive).length, 4, 'All 4 agents must start alive');
console.log('✅ 4-Agent Eurocorp Strike Team & London dispatch initialized.');

// 2. Weapon Cycling
assert.strictEqual(game.selectedWeaponIdx, 0, 'Default weapon should be Uzi');
game.cycleWeapon(1);
assert.strictEqual(game.selectedWeaponIdx, 1, 'Should cycle to Minigun');
game.cycleWeapon(1);
assert.strictEqual(game.selectedWeaponIdx, 2, 'Should cycle to Gauss Gun');
game.cycleWeapon(1);
assert.strictEqual(game.selectedWeaponIdx, 3, 'Should cycle to Laser Rifle');
game.cycleWeapon(1);
assert.strictEqual(game.selectedWeaponIdx, 4, 'Should cycle to Persuadertron');
console.log('✅ Cyber-Arsenal weapon cycling verified.');

// 3. Squad Firing
game.selectedWeaponIdx = 1; // Minigun
inputKeys.add('actionA');
game.fireCooldown = 0;
game.update(0.016);
inputKeys.delete('actionA');
assert(game.bullets.length >= 4, 'All 4 agents must fire simultaneously in squad formation');
console.log('✅ 4-Agent squad simultaneous volley fire verified.');

// 4. The Persuadertron Mind-Control
game.selectedWeaponIdx = 4; // Persuadertron
const civ = game.civilians[0];
const lead = game._getLeadAgent();
civ.x = lead.x + 40;
civ.y = lead.y;
const prePersuaded = game.persuaded.length;
game._activatePersuadertron(lead.x, lead.y, 250);
assert(game.persuaded.length > prePersuaded, 'Persuadertron must brainwash nearby civilian into follower');
assert.strictEqual(game.missionPersuaded >= 1, true, 'missionPersuaded counter must increment');
console.log('✅ Persuadertron mind-control & follower conversion verified.');

// 5. IPA Adrenaline Overdrive
assert.strictEqual(game.isOverdrive, false, 'Overdrive should start inactive');
game.triggerOverdrive();
assert.strictEqual(game.isOverdrive, true, 'Overdrive must be activated');
assert(game.overdriveTimer > 0, 'Overdrive timer must be active');
console.log('✅ IPA Adrenaline Overdrive activation verified.');

// 6. Explosive Barrel Detonations
const barrel = game.barrels[0];
barrel.hp = 1;
const preBarrelsExplosion = game.particles.length;
game._detonateBarrel(barrel);
assert(game.particles.length > preBarrelsExplosion, 'Barrel detonation must spawn explosive particles');
console.log('✅ Explosive barrel destruction verified.');

// 7. Save State Capture & Restore
const state = game.captureState();
assert.strictEqual(state.stage, 1, 'Captured stage should be 1');
state.score = 88880;
state.stage = 4;
game.restoreState(state);
assert.strictEqual(game.score, 88880, 'Restored score must match');
assert.strictEqual(game.stage, 4, 'Restored stage must match');
assert.strictEqual(game.mission.city, 'NEW YORK', 'Stage 4 must be New York');
console.log('✅ SaveStateManager capture & restore round-trip verified.');

// 8. Multi-Stage Mission Progression (London -> Atlantic Sector)
for (let lvl = 1; lvl <= 8; lvl++) {
  game.initStage(lvl);
  assert(game.mission !== undefined, `Mission config for stage ${lvl} must exist`);
  game.update(1 / 60);
  game.render(renderer.ctx);
}
console.log('✅ 8-Stage Global Corporate Conquest progression verified.');

console.log('🏆 SYNDICATE CYBERPUNK TACTICAL SUITE: ALL TESTS PASSED WITH 100% SUCCESS!');
