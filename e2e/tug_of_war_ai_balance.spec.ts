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

test.describe('Tug of War - AI Calibration, Sweet Spot Windows & Comeback Adrenaline', () => {
  test('initializes 2 players, centered rope, and oscillating needle', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tug_of_war&players=2&bots=1&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(200);

    const debug = await page.evaluate(() => (window as any).__TUG_OF_WAR_DEBUG__);
    expect(debug).toBeTruthy();
    expect(debug.players.length).toBe(2);
    expect(Math.abs(debug.ropeOffset)).toBeLessThan(0.05);

    // Verify Player 0 is LEFT and Player 1 is RIGHT
    expect(debug.players[0].team).toBe('LEFT');
    expect(debug.players[1].team).toBe('RIGHT');
    expect(debug.isFinished).toBe(false);
  });

  test('normal AI bot has humanized error rates with occasional slips and beatable cadence', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tug_of_war&players=2&bots=1&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    // Let the match run for 5 seconds to observe bot pulls
    await page.waitForTimeout(5000);

    const debug = await page.evaluate(() => (window as any).__TUG_OF_WAR_DEBUG__);
    expect(debug).toBeTruthy();

    const bot = debug.players[1];
    // Bot should pull actively
    expect(bot.pullCount).toBeGreaterThan(2);

    // Over multiple rounds/sweeps, the bot is not pulling 100% perfect pulls like an unyielding machine
    // (i.e. bot pull count is reasonable and humanized, not 15 perfect pulls in 5s)
    expect(bot.pullCount).toBeLessThan(12);
  });

  test('human player hitting sweet spot pulls gains ground against bot', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tug_of_war&players=2&bots=1&difficulty=easy`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(150);

    // Human player (Player 0 on Left) executes timed pulls when needle is centered
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => {
        const debug = (window as any).__TUG_OF_WAR_DEBUG__;
        if (debug && debug.executePull) {
          const p0 = debug.players[0];
          // Force needle to sweet spot to simulate skillful timing
          p0.needle = 0.50;
          debug.executePull(0);
        }
      });
      await page.waitForTimeout(250);
    }

    const debug = await page.evaluate(() => (window as any).__TUG_OF_WAR_DEBUG__);
    expect(debug).toBeTruthy();

    // Player 0 should have successfully pulled rope to the LEFT (negative offset)
    expect(debug.ropeOffset).toBeLessThan(-0.15);
    expect(debug.players[0].perfectCount).toBeGreaterThan(0);
  });

  test('comeback adrenaline provides extra pull force when team is losing', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tug_of_war&players=2&bots=1&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(100);

    const pullDifference = await page.evaluate(() => {
      const debug = (window as any).__TUG_OF_WAR_DEBUG__;
      const game = (window as any).__GAME_MANAGER__?.currentGame;
      if (!debug || !game) return null;

      // 1. Measure normal pull force at ropeOffset = 0
      debug.ropeOffset = 0;
      const p0 = debug.players[0];
      p0.needle = 0.50; // Perfect
      game.executePull(p0, '#EF4444');
      const normalPullDelta = Math.abs(debug.ropeOffset);

      // 2. Measure pull force when losing (ropeOffset = 0.40 towards opponent)
      debug.ropeOffset = 0.40;
      p0.needle = 0.50; // Perfect
      game.executePull(p0, '#EF4444');
      const comebackPullDelta = 0.40 - debug.ropeOffset;

      return {
        normalPullDelta,
        comebackPullDelta
      };
    });

    expect(pullDifference).toBeTruthy();
    // Comeback pull force should be strictly greater than normal pull force (+25% adrenaline)
    expect(pullDifference!.comebackPullDelta).toBeGreaterThan(pullDifference!.normalPullDelta);
  });
});
