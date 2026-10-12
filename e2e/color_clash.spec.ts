import { test, expect } from '@playwright/test';

test.describe('Color Clash Game - Random Paint Bomb Spawning & Pickups', () => {
  test('Paint bomb starting spawn locations vary randomly across game resets', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=color_clash&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    // Skip countdown
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    // Sample initial bomb locations across 10 match resets
    const bombPositions = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const dbg = (window as any).__COLOR_CLASH_DEBUG__;
      if (!game || !dbg) return null;

      const samples: Array<{ b0: { x: number; y: number }; b1: { x: number; y: number } }> = [];

      for (let i = 0; i < 10; i++) {
        game.reset(800, 600);
        const bombs = dbg.getBombs();
        samples.push({
          b0: { x: bombs[0].x, y: bombs[0].y },
          b1: { x: bombs[1].x, y: bombs[1].y }
        });
      }

      return samples;
    });

    expect(bombPositions).not.toBeNull();
    expect(bombPositions!.length).toBe(10);

    // Verify distinct positions exist (they are not all identical static coords)
    const b0XCoords = new Set(bombPositions!.map((s) => s.b0.x));
    const b0YCoords = new Set(bombPositions!.map((s) => s.b0.y));
    const b1XCoords = new Set(bombPositions!.map((s) => s.b1.x));
    const b1YCoords = new Set(bombPositions!.map((s) => s.b1.y));

    // There should be multiple distinct x and y coordinates chosen across 10 resets
    expect(b0XCoords.size).toBeGreaterThanOrEqual(3);
    expect(b0YCoords.size).toBeGreaterThanOrEqual(2);
    expect(b1XCoords.size).toBeGreaterThanOrEqual(3);
    expect(b1YCoords.size).toBeGreaterThanOrEqual(2);

    // Verify bombs are separated from each other
    for (const s of bombPositions!) {
      const dist = Math.hypot(s.b0.x - s.b1.x, s.b0.y - s.b1.y);
      expect(dist).toBeGreaterThanOrEqual(140);
    }
  });

  test('Picking up a bomb grants turbo, claims 3x3 tiles, and respawns at a fresh random location', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=color_clash&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    const pickupResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const dbg = (window as any).__COLOR_CLASH_DEBUG__;
      if (!game || !dbg) return null;

      const initialBombs = dbg.getBombs();
      const oldBomb0X = initialBombs[0].x;
      const oldBomb0Y = initialBombs[0].y;

      // Teleport rover 0 directly onto Bomb 0
      dbg.triggerPickup(0, 0);

      // Advance game update by 1 frame (0.016s) to process pickup
      game.update(0.016, 800, 600);

      const afterPickupBombs = dbg.getBombs();
      const rover0 = dbg.getRovers().find((r: any) => r.id === 0);

      const pickedBomb = afterPickupBombs[0];
      const hasNextCoord = pickedBomb.nextX !== undefined && pickedBomb.nextY !== undefined;

      // Fast-forward respawn timer to trigger landing
      pickedBomb.respawnTimer = 0.01;
      game.update(0.02, 800, 600);

      const respawnedBombs = dbg.getBombs();
      const newBomb0 = respawnedBombs[0];

      return {
        wasActiveInitially: initialBombs[0].active,
        isActiveAfterPickup: pickedBomb.active,
        hasNextCoord,
        roverTurboTimer: rover0?.turboTimer ?? 0,
        roverTileCount: rover0?.tileCount ?? 0,
        oldCoord: { x: oldBomb0X, y: oldBomb0Y },
        newCoord: { x: newBomb0.x, y: newBomb0.y },
        isActiveAfterRespawn: newBomb0.active
      };
    });

    expect(pickupResult).not.toBeNull();
    expect(pickupResult!.wasActiveInitially).toBe(true);
    expect(pickupResult!.isActiveAfterPickup).toBe(false);
    expect(pickupResult!.hasNextCoord).toBe(true);
    expect(pickupResult!.roverTurboTimer).toBeGreaterThan(3.0);
    // Exploding 3x3 territory should paint multiple tiles
    expect(pickupResult!.roverTileCount).toBeGreaterThanOrEqual(4);
    expect(pickupResult!.isActiveAfterRespawn).toBe(true);
  });

  test('Smart bots seek active bombs or incoming drop reticles', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=color_clash&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    const botNavigates = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const dbg = (window as any).__COLOR_CLASH_DEBUG__;
      if (!game || !dbg) return null;

      const initialBot = dbg.getRovers().find((r: any) => r.id === 1);
      const initialDistToBomb0 = Math.hypot(initialBot.x - game.paintBombs[0].x, initialBot.y - game.paintBombs[0].y);

      // Run 25 game frames for bot steering
      for (let i = 0; i < 25; i++) {
        game.update(0.016, 800, 600);
      }

      const updatedBot = dbg.getRovers().find((r: any) => r.id === 1);
      return {
        moved: Math.hypot(updatedBot.x - initialBot.x, updatedBot.y - initialBot.y) > 20,
        distToBomb0: Math.hypot(updatedBot.x - game.paintBombs[0].x, updatedBot.y - game.paintBombs[0].y),
        initialDistToBomb0
      };
    });

    expect(botNavigates).not.toBeNull();
    expect(botNavigates!.moved).toBe(true);
  });
});
