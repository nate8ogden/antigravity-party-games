import { test, expect } from '@playwright/test';

test.describe('Pixel Paintball Minigame - Body Collision, Controls & Bot AI Difficulty', () => {
  test('Solid Player-to-Player Collision: players cannot go on top of each other', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=pixel_paintball&players=2&difficulty=normal');
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

    const collisionTest = await page.evaluate(() => {
      const dbg = (window as any).__PIXEL_PAINTBALL_DEBUG__;
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game || !dbg) return null;

      // Teleport Player 0 and Player 1 directly on top of each other at (300, 300)
      dbg.setPlayerPos(0, 300, 300);
      dbg.setPlayerPos(1, 300, 300);

      // Advance physics by 2 frames
      game.update(1 / 60, 800, 600);
      game.update(1 / 60, 800, 600);

      const p0 = dbg.getPlayerState(0);
      const p1 = dbg.getPlayerState(1);
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);

      return {
        dist,
        p0x: p0.x,
        p1x: p1.x
      };
    });

    expect(collisionTest).not.toBeNull();
    // They must have been pushed apart so distance is at least the minimum collision threshold (34px)
    expect(collisionTest!.dist).toBeGreaterThanOrEqual(33.5);
  });

  test('Players driving directly toward each other bounce apart and cannot overlap', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=pixel_paintball&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    const headOnCollision = await page.evaluate(() => {
      const dbg = (window as any).__PIXEL_PAINTBALL_DEBUG__;
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game || !dbg) return null;

      // Place P0 at (200, 300) moving right, P1 at (240, 300) moving left
      dbg.setPlayerPos(0, 200, 300);
      dbg.setPlayerPos(1, 240, 300);

      const p0 = game.playersState.get(0);
      const p1 = game.playersState.get(1);
      p0.vx = 220;
      p1.vx = -220;

      // Run 10 frames of head-on ramming
      let minObservedDist = Infinity;
      for (let i = 0; i < 10; i++) {
        game.update(1 / 60, 800, 600);
        const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        if (d < minObservedDist) minObservedDist = d;
      }

      return {
        minObservedDist
      };
    });

    expect(headOnCollision).not.toBeNull();
    // In head-on ramming, distance must NEVER drop below body collision boundary (~32px)
    expect(headOnCollision!.minObservedDist).toBeGreaterThanOrEqual(32);
  });

  test('Controls: direct 8-directional movement moves rover in corresponding direction', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=pixel_paintball&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    // Test pressing KeyD (Right) moves P0 right
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(150);

    const rightState = await page.evaluate(() => {
      const dbg = (window as any).__PIXEL_PAINTBALL_DEBUG__;
      return dbg ? dbg.getPlayerState(0) : null;
    });
    await page.keyboard.up('KeyD');

    expect(rightState).not.toBeNull();
    expect(rightState!.vx).toBeGreaterThan(0);

    // Test pressing KeyS (Down) moves P0 down
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(150);

    const downState = await page.evaluate(() => {
      const dbg = (window as any).__PIXEL_PAINTBALL_DEBUG__;
      return dbg ? dbg.getPlayerState(0) : null;
    });
    await page.keyboard.up('KeyS');

    expect(downState).not.toBeNull();
    expect(downState!.vy).toBeGreaterThan(0);
  });

  test('Shooting: pressing Space fires paint pellets forward', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=pixel_paintball&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    // Fire paint pellets by pressing Space
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);

    const pellets = await page.evaluate(() => {
      const dbg = (window as any).__PIXEL_PAINTBALL_DEBUG__;
      return dbg ? dbg.getPellets() : [];
    });

    expect(pellets.length).toBeGreaterThan(0);
  });

  test('Bot AI is less hard: keeps tactical distance and does not ram on top of human player', async ({ page }) => {
    // 1 Human (P0) vs 1 Bot (P1) on Normal difficulty
    await page.goto('http://localhost:5173/?game=pixel_paintball&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    const distanceTest = await page.evaluate(() => {
      const dbg = (window as any).__PIXEL_PAINTBALL_DEBUG__;
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game || !dbg) return null;

      // Teleport Human to (350, 300) and Bot close by at (400, 300) - distance 50px
      dbg.setPlayerPos(0, 350, 300);
      dbg.setPlayerPos(1, 400, 300);

      // Simulate 45 frames (0.75 seconds) of AI decision making
      for (let i = 0; i < 45; i++) {
        game.update(1 / 60, 800, 600);
      }

      const p0 = dbg.getPlayerState(0);
      const p1 = dbg.getPlayerState(1);
      const finalDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);

      return {
        finalDist,
        p1vx: p1.vx
      };
    });

    expect(distanceTest).not.toBeNull();
    // Rather than ramming into and sitting on top of P0, the bot must back up / keep tactical distance!
    // Final distance should have expanded significantly outward (well over 50px, toward 100px+)
    expect(distanceTest!.finalDist).toBeGreaterThan(65);
  });
});
