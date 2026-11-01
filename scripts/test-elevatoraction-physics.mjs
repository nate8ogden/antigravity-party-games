// test-elevatoraction-physics.mjs
// Verification suite for Elevator Action physics fixes:
// 1. Confines player inside elevator car between floors (no walking through shaft walls).
// 2. Continuous swept collision stops high-speed falling through floor slabs.
// 3. Floors below terminated shafts remain 100% solid corridors.
// 4. Basement failsafe prevents any falling through the map.
// 5. Enemy corridor patrols are not blocked by phantom shafts on other floors.

import assert from 'node:assert';
import { ElevatorAction } from '../src/games/ElevatorAction.js';

class MockAudio {
  playMenuSelect() {}
  playMenuMove() {}
  playCoin() {}
  playHop() {}
  playJump() {}
  playSlap() {}
  playLaser() {}
  playExplosion() {}
  playHit() {}
  playGameOver() {}
  playStageClear() {}
  stopSequence() {}
}

class MockRenderer {
  shake() {}
  drawText() {}
  drawGlowCircle() {}
  drawSprite() {}
}

class MockInput {
  constructor() {
    this.pressed = new Set();
    this.justPressed = new Set();
    this.axis = { x: 0, y: 0 };
  }
  isDown(k) { return this.pressed.has(k); }
  isJustPressed(k) { return this.justPressed.has(k); }
  getAxis() { return { ...this.axis }; }
  clearJustPressed() { this.justPressed.clear(); }
}

console.log('Testing Elevator Action Physics Fixes...');

const mockAudio = new MockAudio();
const mockRenderer = new MockRenderer();
const mockInput = new MockInput();
const game = new ElevatorAction(mockRenderer, mockInput, mockAudio);
game.input = mockInput;

game.setState('PLAYING');

// TEST 1: Shaft wall confinement when elevator is between floors
console.log('  [1/5] Testing elevator car wall clamping between floors...');
{
  const shaft = game.shafts[0]; // minFloor: 0, maxFloor: 5, x: 350, w: 68
  // Place elevator car exactly between floor 1 and floor 2
  const f1Y = game._floorY(1);
  const f2Y = game._floorY(2);
  const midY = (f1Y + f2Y) / 2;
  shaft.carY = midY;

  // Put player inside elevator car
  game.player.x = shaft.x;
  game.player.y = midY;
  game.player.ridingShaft = shaft;
  game.player.jumping = false;
  game.player.crouching = false;

  // Verify it is between floors
  assert.strictEqual(game._getAlignedFloor(shaft.carY, 14), -1, 'Car should be between floors');

  // Push player hard LEFT towards the wall
  game.input.axis = { x: -1, y: 0 };
  for (let i = 0; i < 60; i++) {
    game.update(0.016);
  }

  const minAllowedX = shaft.x - (shaft.w / 2 - 12);
  assert.ok(
    game.player.x >= minAllowedX,
    `Player walked through left elevator wall into concrete! x=${game.player.x}, minAllowed=${minAllowedX}`
  );
  assert.strictEqual(game.player.ridingShaft, shaft, 'Player should remain inside elevator');

  // Push player hard RIGHT towards the wall
  game.input.axis = { x: 1, y: 0 };
  for (let i = 0; i < 60; i++) {
    game.update(0.016);
  }

  const maxAllowedX = shaft.x + (shaft.w / 2 - 12);
  assert.ok(
    game.player.x <= maxAllowedX,
    `Player walked through right elevator wall into concrete! x=${game.player.x}, maxAllowed=${maxAllowedX}`
  );
  assert.strictEqual(game.player.ridingShaft, shaft, 'Player should remain inside elevator');
  console.log('  ✓ Player cannot walk through elevator walls between floors!');
}

// TEST 2: Stepping out of elevator when car reaches a floor
console.log('  [2/5] Testing exiting elevator when aligned with floor corridor...');
{
  const shaft = game.shafts[0];
  const f2Y = game._floorY(2);
  shaft.carY = f2Y; // Exactly aligned with floor 2

  game.player.x = shaft.x;
  game.player.y = f2Y;
  game.player.ridingShaft = shaft;
  game.player.jumping = false;

  assert.strictEqual(game._getAlignedFloor(shaft.carY, 14), 2, 'Car should be aligned with floor 2');

  // Walk left out of the elevator
  game.input.axis = { x: -1, y: 0 };
  for (let i = 0; i < 30; i++) {
    game.update(0.016);
  }

  assert.ok(
    game.player.x < shaft.x - shaft.w / 2,
    `Player should have exited elevator onto floor 2 corridor! x=${game.player.x}`
  );
  assert.strictEqual(game.player.ridingShaft, null, 'Player should no longer be riding elevator');
  assert.strictEqual(game.player.y, f2Y, 'Player should be standing on floor 2 corridor surface');
  assert.strictEqual(game.player.jumping, false, 'Player should not be falling');
  console.log('  ✓ Player seamlessly steps out onto corridor when floor aligned!');
}

// TEST 3: Solid corridor below terminated shafts (no phantom shaft hole)
console.log('  [3/5] Testing solid corridor under terminated shafts...');
{
  // Shaft 0 is floors 0-5 at x=350. On floor 7, x=350 is a solid corridor!
  const f7Y = game._floorY(7);
  assert.strictEqual(
    game._isShaftOnFloor(350, 7),
    null,
    'Shaft 0 should not exist on floor 7'
  );
  assert.strictEqual(
    game._isFloorSolidAt(350, 7),
    true,
    'Floor 7 must be 100% solid concrete at x=350'
  );

  // Position player on floor 7 at x=300 and walk right past x=350 (Shaft 0 ends at floor 5)
  // Note: Shaft 2 is at x=465, so we test crossing Shaft 0's column (x=316..384) up to x=395
  game.player.x = 300;
  game.player.y = f7Y;
  game.player.ridingShaft = null;
  game.player.jumping = false;
  game.input.axis = { x: 1, y: 0 };

  for (let i = 0; i < 30; i++) {
    game.update(0.016);
    assert.strictEqual(game.player.y, f7Y, `Player fell through floor 7 at frame ${i}! y=${game.player.y}`);
    assert.strictEqual(game.player.jumping, false, 'Player should remain walking on floor 7');
  }
  assert.ok(game.player.x > 380, `Player should have walked right past shaft 0 column! x=${game.player.x}`);
  console.log('  ✓ Player walks across terminated shaft column without falling through!');
}

// TEST 4: High-speed fall swept collision & basement clamp
console.log('  [4/5] Testing swept landing and basement boundaries...');
{
  const basementFloor = game.numFloors - 1;
  const basementY = game._floorY(basementFloor);

  // Simulate high-speed drop towards basement floor (starting below floor 8)
  game.player.x = 220; // Solid corridor
  game.player.y = basementY - 45;
  game.player.jumping = true;
  game.player.vy = 800; // Extreme falling speed
  game.input.axis = { x: 0, y: 0 };

  // Update with large dt step
  game.update(0.05);

  assert.strictEqual(game.player.jumping, false, 'Player should have landed on basement floor');
  assert.strictEqual(game.player.y, basementY, `Player should be at basement Y=${basementY}, got ${game.player.y}`);
  assert.strictEqual(game.player.vy, 0, 'Vertical velocity should be stopped on landing');

  // Verify failsafe clamp: try forcing player below basement
  game.player.y = basementY + 500;
  game.player.jumping = true;
  game.player.vy = 900;
  game.update(0.016);

  assert.strictEqual(game.player.y, basementY, 'Failsafe must clamp player to basement floor');
  assert.strictEqual(game.player.jumping, false, 'Failsafe must stop jumping state');
  console.log('  ✓ Swept collision stops high-speed fall; basement boundary never breached!');
}

// TEST 5: Enemy patrol shaft intelligence
console.log('  [5/5] Testing enemy patrol around shafts...');
{
  // Spawn enemy on floor 7 at x=310 moving towards x=350 (where shaft 0 ends at floor 5)
  game.enemies = [{
    x: 310,
    y: game._floorY(7),
    floor: 7,
    dir: 1,
    speed: 80,
    crouching: false,
    crouchTimer: 0,
    fireTimer: 10,
    aiTimer: 10
  }];

  // Update enemy: should NOT be blocked by shaft 0 because it doesn't exist on floor 7
  for (let i = 0; i < 40; i++) {
    game.update(0.016);
  }

  const e = game.enemies[0];
  assert.ok(e.x > 340, `Enemy should not be blocked by phantom shaft! x=${e.x}`);
  console.log('  ✓ Enemy patrols are unhindered by shafts on different floors!');
}

console.log('🎉 ALL 5 ELEVATOR ACTION PHYSICS TESTS PASSED PERFECTLY!');
