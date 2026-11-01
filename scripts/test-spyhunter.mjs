import assert from 'node:assert/strict';
import { SpyHunter } from '../src/games/SpyHunter.js';

console.log('🏎️ Testing Spy Hunter Overhaul: Terrains, Highways, Narrow Streets & Combat Choppers...');

// 1. Setup Mock Renderer & Input
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

class MockInput {
  constructor() {
    this.down = new Set();
    this.justPressed = new Set();
    this.pointer = { x: 0, y: 0, justPressed: false };
  }
  isDown(k) { return this.down.has(k); }
  isJustPressed(k) { return this.justPressed.has(k); }
}

class MockAudio {
  playLaser() {}
  playExplosion() {}
  playPop() {}
  playDig() {}
  playPowerUp() {}
  playStageClear() {}
  playGameOver() {}
  playShove() {}
  playHit() {}
  playMenuSelect() {}
  playMenuMove() {}
  playNote() {}
  stopSequence() {}
}

function createMockCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return {
    fillStyle: '#000',
    strokeStyle: '#fff',
    lineWidth: 1,
    font: '12px sans-serif',
    textAlign: 'start',
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    ellipse: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    createLinearGradient: () => grad,
    createRadialGradient: () => grad
  };
}

const renderer = new MockRenderer();
const input = new MockInput();
const audio = new MockAudio();
const game = new SpyHunter(renderer, input, audio);

// 2. Test Initial State & Biomes
assert.equal(game.state, 'PLAYING', 'Game must initialize in PLAYING state');
assert.equal(game.currentBiome, 'FOREST', 'Initial biome must be FOREST');
assert.ok(game.roadSegments.length > 20, 'Road segments must be initialized');
assert.ok(game.scenery.length > 10, 'Scenery must be initialized');
console.log('✅ Initial Highway & Forest setup verified.');

// 3. Test Biome Progression Across Distance
const biomesFound = new Set();
for (let d = 0; d <= 36000; d += 1500) {
  const b = game._getBiomeAtDistance(d);
  biomesFound.add(b);
}
assert.ok(biomesFound.has('FOREST'), 'Must contain FOREST biome');
assert.ok(biomesFound.has('DESERT'), 'Must contain DESERT biome');
assert.ok(biomesFound.has('SNOW'), 'Must contain SNOW biome');
assert.ok(biomesFound.has('COASTAL'), 'Must contain COASTAL biome');
assert.ok(biomesFound.has('CITY'), 'Must contain CITY biome');
console.log(`✅ All 5 Biomes verified across distance: ${[...biomesFound].join(', ')}`);

// 4. Test Road Profiles (Super Highway, Standard Highway, Narrow Chokepoint, Bridge)
const roadTypesFound = new Set();
for (let d = 0; d <= 7000; d += 500) {
  const prof = game._getRoadProfile(d);
  roadTypesFound.add(prof.type);
}
assert.ok(roadTypesFound.has('SUPER_HIGHWAY'), 'Must have SUPER_HIGHWAY expressway');
assert.ok(roadTypesFound.has('HIGHWAY'), 'Must have standard HIGHWAY');
assert.ok(roadTypesFound.has('NARROW_STREET'), 'Must have NARROW_STREET chokepoint');
assert.ok(roadTypesFound.has('BRIDGE'), 'Must have BRIDGE');
console.log(`✅ All 4 Road Layouts verified: ${[...roadTypesFound].join(', ')}`);

// Verify narrow street is actually narrower than expressway
const superProf = game._getRoadProfile(500);
const narrowProf = game._getRoadProfile(5000);
assert.ok(superProf.targetWidth > 240, 'Super Highway must be wide (>=240)');
assert.ok(narrowProf.targetWidth < 140, 'Narrow Street must be tight (<=140)');
console.log(`✅ Road width dynamics: Expressway=${superProf.targetWidth * 2}px vs Narrow=${narrowProf.targetWidth * 2}px`);

// 5. Test Combat Chopper Overhaul: Spawning, AI, Strafing & Carpet Bombing
game._spawnHelicopter();
const chopper = game.vehicles.find((v) => v.type === 'helicopter');
assert.ok(chopper, 'Chopper must spawn in vehicles list');
assert.equal(chopper.hp, 5, 'Chopper must have 5 HP');
assert.ok(chopper.altitude > 50, 'Chopper starts at high altitude');
assert.equal(chopper.state, 'CRUISE', 'Chopper starts in CRUISE state');
console.log('✅ Combat Chopper spawn & initial state verified.');

// Test Chopper update loop through states
// Force strafe state
chopper.state = 'STRAFE';
chopper.strafeShotsLeft = 4;
chopper.strafeFireTimer = 0;
const initialBullets = game.bullets.length;
game.update(0.02);
assert.ok(game.bullets.length > initialBullets, 'Chopper strafe run must fire enemy tracer bullets');
console.log('✅ Chopper Gatling strafe gunfire verified.');

// Force carpet bomb state
chopper.state = 'CARPET_BOMB';
chopper.bombsLeft = 2;
chopper.bombDropTimer = 0;
const initialBombs = game.fallingBombs.length;
game.update(0.02);
assert.ok(game.fallingBombs.length > initialBombs, 'Chopper carpet bomb run must drop falling aerial bombs');
console.log('✅ Chopper Carpet Bomb cluster drop verified.');

// Test falling bomb detonation physics
const bomb = game.fallingBombs[0];
bomb.altitude = 1; // 1 unit above ground
const preHazards = game.hazards.length;
game._updateFallingBombs(0.05, game.player);
assert.ok(game.hazards.some((h) => h.type === 'CRATER'), 'Bomb detonation must leave a flaming crater hazard');
console.log('✅ Aerial Bomb impact & crater formation verified.');

// Test Chopper mid-air damage and shootability
chopper.y = 150;
chopper.altitude = 70;
chopper.hp = 1;
// Fire missile at chopper from below
game.bullets.push({
  x: chopper.x,
  y: 155,
  vy: -600,
  damage: 4,
  isMissile: true
});
game.update(0.016);
assert.equal(chopper.state, 'CRASHING', 'Lethal missile hit must put chopper into CRASHING spiral');
console.log('✅ Chopper missile kill & crash sequence verified.');

// 6. Test Ice Traction on Snow Biome
game.currentBiome = 'SNOW';
const testRoad = game._getRoadAtY(game.player.y);
testRoad.hasIce = true;
game.player.vx = 200;
input.down.clear();
game.update(0.016);
assert.ok(game.player.vx > 180, 'Car on ice must maintain drift inertia (low friction)');
console.log('✅ Alpine Snow ice patch drift physics verified.');

// 7. Test 100 Frames of Simulation & Rendering
for (let f = 0; f < 100; f++) {
  if (f % 20 === 0) input.down.add('actionA');
  else input.down.delete('actionA');

  if (f % 15 === 0) input.justPressed.add('actionB');
  else input.justPressed.delete('actionB');

  game.update(0.016);
  assert.doesNotThrow(() => {
    game.render(renderer.ctx);
  }, `Frame ${f} render must succeed cleanly`);
}
console.log('✅ 100 Frames of live gameplay and canvas rendering executed flawlessly.');

console.log('🏆 ALL SPY HUNTER TESTS PASSED WITH 100% SUCCESS!');
