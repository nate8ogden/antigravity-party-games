import { test, expect } from '@playwright/test';

test.describe('Micro Turbo GP: Charge-Up Nitro, Track Walls, and Anti-Loop Rescue Boost', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
  });

  test('Starts Micro Turbo GP and renders track, barriers, and HUD tutorial', async ({ page }) => {
    const gameState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('micro_gp');
      gm.state = 'PLAYING';
      gm.render();

      const game = gm.activeGame;
      return {
        trackName: game.currentTrackName,
        waypointsCount: game.waypoints.length,
        tireWallsCount: game.tireWalls.length,
        hazardsCount: game.hazards.length,
        isFinished: game.isFinished
      };
    });

    expect(gameState.trackName).toBeTruthy();
    expect(gameState.waypointsCount).toBeGreaterThan(6);
    expect(gameState.tireWallsCount).toBeGreaterThan(0);
    expect(gameState.hazardsCount).toBeGreaterThan(0);
    expect(gameState.isFinished).toBe(false);
  });

  test('Charge-Up Nitro: Holding charges tiers and releasing triggers explosive boost', async ({ page }) => {
    const nitroTest = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('micro_gp');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const racer = game.racers.get(0);

      // Simulate holding button for 0.75 seconds to charge Tier 2 Super Nitro
      gm.input.press(0);
      for (let i = 0; i < 45; i++) {
        game.update(0.016, 800, 600);
      }

      const chargedTier = racer.nitroTier;
      const chargedDrift = racer.driftCharge;
      const speedWhileDrifting = racer.speed;

      // Release button to fire Nitro
      gm.input.release(0);
      game.update(0.016, 800, 600);

      const boostActive = racer.turboTimer > 0;
      const boostedSpeed = racer.speed;

      return {
        chargedTier,
        chargedDrift,
        speedWhileDrifting,
        boostActive,
        boostedSpeed
      };
    });

    // Verify charge-up reached at least Tier 2
    expect(nitroTest.chargedTier).toBeGreaterThanOrEqual(2);
    expect(nitroTest.chargedDrift).toBeGreaterThan(0.5);

    // Verify releasing unleashed the boost
    expect(nitroTest.boostActive).toBe(true);
    expect(nitroTest.boostedSpeed).toBeGreaterThan(280);
  });

  test('Arena walls and tire barriers bounce racers back toward track', async ({ page }) => {
    const wallCollisionTest = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('micro_gp');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const racer = game.racers.get(0);

      // Place racer moving into the left boundary wall
      racer.x = 24;
      racer.y = 300;
      racer.angle = Math.PI; // facing left
      racer.speed = 180;

      // Step frame
      game.update(0.016, 800, 600);

      const bouncedX = racer.x;
      const newAngle = racer.angle;

      return {
        bouncedX,
        newAngle
      };
    });

    // Verify car bounced off wall and was kept within bounds
    expect(wallCollisionTest.bouncedX).toBeGreaterThanOrEqual(22);
  });

  test('Anti-Loop Auto-Rescue breaks player out of loop if spinning continuously', async ({ page }) => {
    const rescueTest = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('micro_gp');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const racer = game.racers.get(0);

      // Force player into a spinning loop by holding button continuously for 3.5 seconds
      gm.input.press(0);
      let wrongWayTriggered = false;
      let rescueEverTriggered = false;
      let maxSpeedDuringRescue = 0;

      let maxRot = 0;
      let maxStall = 0;
      let waypointsHit = 0;

      for (let i = 0; i < 220; i++) {
        const prevWp = racer.nextWaypointIndex;
        game.update(0.016, 800, 600);
        if (racer.nextWaypointIndex !== prevWp) waypointsHit++;
        maxRot = Math.max(maxRot, racer.cumulativeRotation);
        maxStall = Math.max(maxStall, racer.stallTime);
        if (racer.isWrongWay) wrongWayTriggered = true;
        if (racer.rescueBoostTimer > 0) {
          rescueEverTriggered = true;
          maxSpeedDuringRescue = Math.max(maxSpeedDuringRescue, racer.speed);
        }
      }

      return {
        wrongWayTriggered,
        rescueBoostTriggered: rescueEverTriggered,
        speedAfterRescue: maxSpeedDuringRescue,
        maxRot,
        maxStall,
        waypointsHit
      };
    });

    // Verify wrong way alert detected the backwards/spinning orientation
    expect(rescueTest.wrongWayTriggered).toBe(true);

    // Verify auto-rescue boosted the player out of the loop
    expect(rescueTest.rescueBoostTriggered).toBe(true);
    expect(rescueTest.speedAfterRescue).toBeGreaterThan(200);
  });
});
