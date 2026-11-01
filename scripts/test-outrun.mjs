import assert from 'node:assert/strict';
import { OutRun } from '../src/games/OutRun.js';

class MockAudio {
  constructor() {
    this.played = [];
  }
  playMusic(name) { this.played.push({ type: 'music', name }); }
  stopSequence() {}
  playNote() {}
  playLaser() {}
  playExplosion() {}
  playPowerUp() {}
  playShove() {}
  playCoin() {}
  playStageClear() {}
  playGameOver() {}
  playMenuSelect() {}
  playMenuMove() {}
}

class MockRenderer {
  constructor() {
    this.shaken = false;
  }
  shake() { this.shaken = true; }
  drawGlowCircle() {}
  drawGlowRect() {}
  drawGlowText() {}
  drawText() {}
  drawHUD() {}
  drawStateOverlay() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  fill() {}
  stroke() {}
  fillRect() {}
  fillText() {}
  arc() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  createLinearGradient() {
    return {
      addColorStop() {}
    };
  }
}

class MockInput {
  constructor() {
    this.keys = new Set();
    this.justPressedKeys = new Set();
    this.actions = new Set();
    this.justPressedActions = new Set();
    this.pointer = { justPressed: false, down: false };
  }
  isDown(action) { return this.actions.has(action); }
  isJustPressed(action) { return this.justPressedActions.has(action); }
  isKeyDown(code) { return this.keys.has(code); }
  isKeyJustPressed(code) { return this.justPressedKeys.has(code); }
}

console.log('🏁 Starting OutRun Arcade Deluxe Verification Suite...');

const audio = new MockAudio();
const renderer = new MockRenderer();
const input = new MockInput();
const game = new OutRun(renderer, input, audio);

// 1. Initial State & Sega OutRun Defaults
assert.equal(game.gear, 'LOW', 'Initial gear must be LOW');
assert.equal(game.speed, 0, 'Initial speed must be 0');
assert.equal(game.stage, 1, 'Initial stage must be 1');
assert.equal(game.timeRemaining, 60, 'Starting timer must be 60 seconds');
assert.equal(game.radioIndex, 0, 'Default radio station must be Magical Sound Shower');
assert.equal(game.segments.length > 500, true, 'Track segments properly initialized');
assert.equal(game.traffic.length >= 14, true, 'Traffic pool properly initialized');
console.log('✅ Initial State & Sega Arcade Specs verified.');

// 2. FM In-Dash Radio Station Cycling
game._cycleRadio();
assert.equal(game.radioIndex, 1, 'Next radio station should be Splash Wave');
game._cycleRadio();
assert.equal(game.radioIndex, 2, 'Next radio station should be Passing Breeze');
game._cycleRadio();
assert.equal(game.radioIndex, 0, 'Radio station should cycle back to Magical Sound Shower');
console.log('✅ FM In-Dash Radio 3-station tuner verified.');

// 3. Acceleration & 2-Speed Transmission Physics
// Accelerate in LOW gear
input.actions.add('up');
for (let i = 0; i < 90; i++) {
  game.update(0.016);
}
assert.ok(game.speed > 100, `LOW gear should provide explosive acceleration (got ${game.speed.toFixed(1)} km/h)`);
// Now let's test top speed in LOW gear (maxLowSpeed = 175)
// Notice auto-upshift triggers at >= 170 if up is held, so let's check manual gear shift behavior
game.speed = 150;
game.gear = 'LOW';
game._toggleGear(); // Manual shift to HIGH
assert.equal(game.gear, 'HIGH', 'Manual shift toggles gear to HIGH');
for (let i = 0; i < 180; i++) {
  game.update(0.016);
}
assert.ok(game.speed > 250, `HIGH gear should accelerate past 250 km/h (got ${game.speed.toFixed(1)} km/h)`);
assert.ok(game.speed <= 293.001, `Speed must cap at high max speed (got ${game.speed.toFixed(1)} km/h)`);
console.log('✅ 2-Speed Transmission (LOW torque / HIGH overdrive) verified.');

// 4. Slipstream Drafting Boost
// Put a traffic vehicle ahead within drafting distance
game.speed = 280;
const targetCar = game.traffic[0];
targetCar.offset = game.playerX; // Direct slipstream line
targetCar.z = game.position + game.segmentLength * 1.3;
game.update(0.016);
assert.equal(game.slipstreaming, true, 'Drafting directly behind traffic vehicle must trigger slipstreaming');
for (let i = 0; i < 40; i++) {
  targetCar.z = game.position + game.segmentLength * 0.9;
  targetCar.offset = game.playerX;
  game.update(0.016);
}
assert.ok(game.speed > 293, `Slipstream drafting must push top speed beyond 293 km/h towards 298 km/h (got ${game.speed.toFixed(1)} km/h)`);
console.log(`✅ Slipstream drafting surge verified (Peak speed: ${game.speed.toFixed(1)} km/h).`);

// 5. Power Drifting & Dual Smoke Particles
// Clear traffic cars away from test section
for (const c of game.traffic) {
  c.z = game.position + 20000;
}
game.speed = 220;
// Force current and upcoming segments curve
const curSegIdx = Math.floor(game.position / game.segmentLength);
for (let i = 0; i < 20; i++) {
  game.segments[(curSegIdx + i) % game.segments.length].curve = 3.0;
}
input.actions.clear();
input.actions.add('down'); // Brake
input.actions.add('right'); // Steer
game.particles = [];
for (let i = 0; i < 5; i++) {
  game.update(0.016);
}
assert.equal(game.drifting, true, 'Braking into a sharp high-speed curve must engage power drifting');
assert.ok(game.particles.length > 0, 'Power drifting must generate billowing tire smoke particles');
console.log('✅ Power drifting & dual tire smoke physics verified.');

// 6. Rollover Crash Physics
game.speed = 220;
game.playerX = 1.65; // Deep off-road
const crashSegIdx = Math.floor(game.position / game.segmentLength);
for (let i = 0; i < 5; i++) {
  game.segments[(crashSegIdx + i) % game.segments.length].props = [{ side: 1, offset: 1.5, type: 'PALM' }];
}
game.update(0.016);
assert.ok(game.spinTimer > 0, 'High speed off-road obstacle collision must trigger spin timer');
assert.ok(game.crashRoll > 0, 'High speed crash must initiate rollover physics');
assert.equal(game.gear, 'LOW', 'Crash must drop car back to LOW gear');
console.log('✅ Tumbling rollover crash & recovery mechanics verified.');

// 7. Checkpoint Advancement & Branching Route Progression
game.spinTimer = 0;
game.crashRoll = 0;
game.speed = 200;
game.position = game.stageLength * game.segmentLength; // Reach checkpoint
game.playerX = 0.5; // Right fork
const prevStage = game.stage;
const initialTime = game.timeRemaining;
game.update(0.016);
assert.equal(game.stage, prevStage + 1, 'Stage must advance at checkpoint');
assert.ok(game.timeRemaining > initialTime, 'Passing checkpoint must add time bonus');
assert.equal(game.forkChoice, 'RIGHT', 'Fork selection must record direction');
console.log(`✅ Stage advancement & branching route choice verified (Advanced to Stage ${game.stage}).`);

// Fast forward to Championship Finish (Stage 5)
game.stage = 4;
game.position = game.stageLength * game.segmentLength;
game.update(0.016);
assert.equal(game.stage, 5, 'Must reach Stage 5');
assert.equal(game.biomeIndex, 7, 'Stage 5 must load Championship Goal biome');
console.log('✅ Grand Championship Finish stage verified.');

// 8. Full Graphics Render Pass
const mockCtx = {
  canvas: { width: 960, height: 540 },
  save() {},
  restore() {},
  translate() {},
  rotate() {},
  scale() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  closePath() {},
  fill() {},
  stroke() {},
  fillRect() {},
  strokeRect() {},
  fillText() {},
  measureText() { return { width: 40 }; },
  arc() {},
  ellipse() {},
  roundRect() {},
  quadraticCurveTo() {},
  bezierCurveTo() {},
  createLinearGradient() {
    return { addColorStop() {} };
  }
};
assert.doesNotThrow(() => {
  game.render(mockCtx);
}, 'Rendering loop must execute cleanly without exceptions');
console.log('✅ Full pseudo-3D parallax, road rasterizer & dashboard HUD render pass verified.');

console.log('🏆 OUTRUN DELUXE OVERHAUL VERIFICATION COMPLETE: ALL TESTS PASSED!');
