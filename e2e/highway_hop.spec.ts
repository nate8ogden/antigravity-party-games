import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

async function skipCountdown(page: any) {
  await page.evaluate(() => {
    const gm = (window as any).__GAME_MANAGER__;
    if (gm) {
      gm.countdownTimer = 0;
      gm.state = 'PLAYING';
    }
  });
  await page.waitForTimeout(100);
}

test.describe('Highway Hop - Straight Forward Hopping & AI Intelligence', () => {
  test('forward hop advances straight forward 1 block without recentering horizontally to map center', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=highway_hop&players=2&difficulty=bot_normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(200);

    const initialDebug = await page.evaluate(() => (window as any).__HIGHWAY_HOP_DEBUG__);
    expect(initialDebug).toBeTruthy();
    expect(initialDebug.players.length).toBe(2);

    const p0InitialX = initialDebug.players[0].x;
    const p0InitialLane = initialDebug.players[0].laneIndex;

    // Hop left once to change column off-center
    await page.keyboard.press('KeyA');
    await page.waitForTimeout(220); // wait for 0.15s hop animation

    const afterLeft = await page.evaluate(() => (window as any).__HIGHWAY_HOP_DEBUG__.players[0]);
    expect(afterLeft.x).toBeLessThan(p0InitialX);
    expect(afterLeft.laneIndex).toBe(p0InitialLane);
    const xBeforeForward = afterLeft.x;

    // Hop straight forward (KeyW)
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(220); // wait for 0.15s hop animation

    const afterForward = await page.evaluate(() => (window as any).__HIGHWAY_HOP_DEBUG__.players[0]);
    // Must advance exactly 1 lane forward
    expect(afterForward.laneIndex).toBe(p0InitialLane + 1);
    // Must maintain exact X coordinate without snapping/recentering to the center of the map
    expect(Math.abs(afterForward.x - xBeforeForward)).toBeLessThan(0.5);
    expect(Math.abs(afterForward.targetX - xBeforeForward)).toBeLessThan(0.5);
  });

  test('river log drift maintains exact horizontal position when jumping forward to next lane', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=highway_hop&players=2&difficulty=bot_easy`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(150);

    // Position player safely on a custom test position to simulate log hopping
    const testResult = await page.evaluate(() => {
      const debug = (window as any).__HIGHWAY_HOP_DEBUG__;
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.currentGame;
      if (!game) return null;

      // Find a safe spot or set custom coordinates
      const p = game.playersState.get(0);
      if (!p) return null;

      // Set player to an off-center position (e.g. x = 123.45)
      p.x = 123.45;
      p.targetX = 123.45;
      p.isHopping = false;
      const initialLane = p.laneIndex;

      // Execute forward hop
      game.attemptHop(p, 0, 1, 900);
      return {
        initialX: 123.45,
        targetX: p.targetX,
        newLane: p.laneIndex,
        initialLane
      };
    });

    expect(testResult).toBeTruthy();
    expect(testResult?.newLane).toBe(testResult!.initialLane + 1);
    // targetX must match initialX with 0 sideways distortion
    expect(Math.abs(testResult!.targetX - testResult!.initialX)).toBeLessThan(0.01);
  });

  test('AI bot evaluates safe continuous collision windows and avoids oncoming vehicles', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=highway_hop&players=2&difficulty=bot_hard`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    // Let the game run for 4 seconds to observe bot navigation
    await page.waitForTimeout(4000);

    const debug = await page.evaluate(() => (window as any).__HIGHWAY_HOP_DEBUG__);
    expect(debug).toBeTruthy();

    const bot = debug.players[1];
    // Bot should have made decisions and advanced through lanes
    expect(bot.score).toBeGreaterThan(0);
    expect(bot.maxLaneReached).toBeGreaterThan(0);
    // Bot should still be alive or have lives remaining
    expect(bot.lives).toBeGreaterThan(0);
  });
});
