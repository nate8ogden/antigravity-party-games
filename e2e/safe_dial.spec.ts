import { test, expect } from '@playwright/test';

test.describe('Safe Dial Lock Game - Angle Alignment & Hit Registration', () => {
  test('Clicking when needle is inside the green target sector unlocks tumbler without jamming', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=safe_dial&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    // Skip countdown
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    // Set needle angle squarely in the center of the first tumbler green zone and tap
    const testResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const debug = (window as any).__SAFE_DIAL_DEBUG__;
      if (!game || !debug) return null;

      const p1Lock = game.locks.get(0);
      if (!p1Lock) return null;

      const curTarget = p1Lock.targets[p1Lock.crackedTumblers];
      if (!curTarget) return null;

      // Position needle directly inside the green sector
      const greenCenterAngle = curTarget.startAngle + curTarget.spanAngle * 0.5;
      debug.setAngle(0, greenCenterAngle);

      // Trigger tap input for player 0
      debug.tap(0);
      // Process 1 tick of game update
      game.update(0.016, 800, 600);

      return {
        crackedTumblers: p1Lock.crackedTumblers,
        jamTimer: p1Lock.jamTimer
      };
    });

    expect(testResult).not.toBeNull();
    // Tumbler cracked!
    expect(testResult!.crackedTumblers).toBe(1);
    // MUST NOT be jammed!
    expect(testResult!.jamTimer).toBe(0);
  });

  test('Clicking when needle is outside green sector correctly triggers jam', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=safe_dial&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    const jamResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const debug = (window as any).__SAFE_DIAL_DEBUG__;
      if (!game || !debug) return null;

      const p1Lock = game.locks.get(0);
      if (!p1Lock) return null;

      const curTarget = p1Lock.targets[p1Lock.crackedTumblers];
      // Position needle 180 degrees away from green target
      const oppositeAngle = (curTarget.startAngle + Math.PI) % (Math.PI * 2);
      debug.setAngle(0, oppositeAngle);

      // Trigger tap input
      debug.tap(0);
      game.update(0.016, 800, 600);

      return {
        crackedTumblers: p1Lock.crackedTumblers,
        jamTimer: p1Lock.jamTimer
      };
    });

    expect(jamResult).not.toBeNull();
    expect(jamResult!.crackedTumblers).toBe(0);
    // Jam timer is active
    expect(jamResult!.jamTimer).toBeGreaterThan(0);
  });

  test('Cracking all 3 tumblers unlocks the vault', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=safe_dial&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    const unlockResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const debug = (window as any).__SAFE_DIAL_DEBUG__;
      if (!game || !debug) return null;

      const p1Lock = game.locks.get(0);
      if (!p1Lock) return null;

      // Crack all 3 tumblers sequentially
      for (let i = 0; i < 3; i++) {
        const curTarget = p1Lock.targets[p1Lock.crackedTumblers];
        const greenCenter = curTarget.startAngle + curTarget.spanAngle * 0.5;
        debug.setAngle(0, greenCenter);
        debug.tap(0);
        game.update(0.016, 800, 600);
      }

      return {
        crackedTumblers: p1Lock.crackedTumblers,
        isUnlocked: p1Lock.isUnlocked,
        isFinished: game.isFinished
      };
    });

    expect(unlockResult).not.toBeNull();
    expect(unlockResult!.crackedTumblers).toBe(3);
    expect(unlockResult!.isUnlocked).toBe(true);
    expect(unlockResult!.isFinished).toBe(true);
  });
});
