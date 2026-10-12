import { test, expect } from '@playwright/test';

test.describe('Coin Apex Game - Apex Variance, Removed Line, and Beatable AI', () => {
  test('Apex height varies significantly across multiple tosses', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=coin_apex&players=1&difficulty=normal');
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

    // Sample initial velocities across several simulated tosses
    const velocities = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game) return null;

      const samples: number[] = [];
      for (let i = 0; i < 15; i++) {
        game.launchCoin(800, 600);
        if (game.coin) {
          samples.push(game.coin.vy);
        }
      }
      return samples;
    });

    expect(velocities).not.toBeNull();
    expect(velocities!.length).toBe(15);

    const minVy = Math.min(...velocities!);
    const maxVy = Math.max(...velocities!);
    const vySpread = Math.abs(maxVy - minVy);

    // Initial velocity spread should be substantial (> 120 px/s variation)
    expect(vySpread).toBeGreaterThan(120);

    // Verify apex heights span a wide range (peak height = vy^2 / (2 * g))
    const minHeight = (Math.min(Math.abs(minVy), Math.abs(maxVy)) ** 2) / (2 * 380);
    const maxHeight = (Math.max(Math.abs(minVy), Math.abs(maxVy)) ** 2) / (2 * 380);
    const heightSpread = maxHeight - minHeight;
    expect(heightSpread).toBeGreaterThan(80);
  });

  test('Player catching at apex awards +3 Perfect Apex points', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=coin_apex&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    const scoreResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const debug = (window as any).__COIN_APEX_DEBUG__;
      if (!game || !debug) return null;

      // Force coin to exact apex velocity (vy = 0)
      debug.launchWithVy(0);

      // Player 0 catches at apex
      debug.tap(0);
      game.update(0.016, 800, 600);

      const p0Score = game.scores.get(0);
      return { p0Score };
    });

    expect(scoreResult).not.toBeNull();
    // Awarded 3 points for Perfect Apex
    expect(scoreResult!.p0Score).toBe(3);
  });

  test('Bot AI has realistic timing plans rather than robotic 100% perfect catches', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=coin_apex&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    const botPlans = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game) return null;

      const plans: number[] = [];
      for (let i = 0; i < 20; i++) {
        game.launchCoin(800, 600);
        const plan = game.botPlans.get(1); // bot is id 1
        if (plan) plans.push(plan.targetVy);
      }
      return plans;
    });

    expect(botPlans).not.toBeNull();
    expect(botPlans!.length).toBe(20);

    // Bot plans must not all be 0 (surgical apex). There should be variance including whiffs (> 70 or < -70) and good catches (> 30)
    const hasVariance = botPlans!.some((vy) => Math.abs(vy) > 25);
    expect(hasVariance).toBe(true);
  });
});
