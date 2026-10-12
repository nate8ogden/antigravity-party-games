import { test, expect } from '@playwright/test';

test.describe('Neon Lightcycles Game', () => {
  test('Trail starts immediately on round launch with >= 2 points and extends without turning', async ({ page }) => {
    // Navigate directly to Neon Lightcycles with 1 player vs bot
    await page.goto('http://localhost:5173/?game=neon_lightcycles&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    // Skip countdown directly into PLAYING state
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    // Let the game update for a few frames
    await page.waitForTimeout(300);

    const initialStatus = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game || !game.cycles) return null;

      return Array.from(game.cycles.values()).map((c: any) => ({
        id: c.id,
        alive: c.alive,
        x: c.x,
        y: c.y,
        trailLength: c.trail.length,
        trail: c.trail.map((p: any) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
      }));
    });

    expect(initialStatus).not.toBeNull();
    expect(initialStatus.length).toBeGreaterThanOrEqual(2);

    for (const c of initialStatus) {
      expect(c.alive).toBe(true);
      // Trail MUST have at least 2 points immediately so it draws and collides from frame 0
      expect(c.trailLength).toBeGreaterThanOrEqual(2);
      expect(c.trail.length).toBeGreaterThanOrEqual(2);
      // The start anchor should not be equal to head after moving
      const startPt = c.trail[0];
      const headPt = c.trail[c.trail.length - 1];
      // Should have moved forward from start anchor
      const dist = Math.hypot(headPt.x - startPt.x, headPt.y - startPt.y);
      expect(dist).toBeGreaterThan(0);
    }
  });

  test('Player turning 90 degrees creates a corner vertex without self-destructing', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=neon_lightcycles&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    // Player 1 (W key) turns 90 degrees
    await page.keyboard.press('KeyW');

    // Wait 250ms for cycle to advance around the corner
    await page.waitForTimeout(250);

    const postTurnStatus = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game || !game.cycles) return null;

      return Array.from(game.cycles.values()).map((c: any) => ({
        id: c.id,
        alive: c.alive,
        x: c.x,
        y: c.y,
        trailLength: c.trail.length
      }));
    });

    expect(postTurnStatus).not.toBeNull();
    const p1 = postTurnStatus.find((c: any) => c.id === 0); // Player 1 ID is 0
    expect(p1).toBeDefined();
    // P1 MUST be alive (not dead from turning suicide bug)
    expect(p1.alive).toBe(true);
    // P1 now has at least 3 trail points: [start, corner, head]
    expect(p1.trailLength).toBeGreaterThanOrEqual(3);
  });

  test('Cycle colliding into a trail causes crash elimination', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=neon_lightcycles&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    // Force bot directly into P1's initial trail line
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game) return;

      const p1 = game.cycles.get(0);
      const bot = game.cycles.get(1);
      if (!p1 || !bot) return;

      // Position bot right along p1's trail segment, headed directly into it
      const startX = p1.trail[0].x;
      const startY = p1.trail[0].y;
      bot.x = startX + 20;
      bot.y = startY + 4;
      bot.dirIndex = 3; // Up, directly intersecting p1's trail
    });

    await page.waitForTimeout(150);

    const checkElimination = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const bot = game?.cycles.get(1);
      return bot ? bot.alive : null;
    });

    // The bot should have crashed into the trail and been eliminated
    expect(checkElimination).toBe(false);
  });
});
