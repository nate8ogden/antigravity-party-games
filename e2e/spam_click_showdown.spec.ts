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

test.describe('Spam Click Showdown - Furious Button-Mashing Soda Blastoff', () => {
  test('initializes game, stations, and renders pressurized bottles with 0 PSI', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=spam_click_showdown&players=2&bots=1&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(200);

    const debug = await page.evaluate(() => (window as any).__SPAM_CLICK_DEBUG__);
    expect(debug).toBeTruthy();
    expect(debug.players.length).toBe(2);

    // Initial state: 0 pressure, 0 clicks, not finished
    expect(debug.players[0].pressure).toBe(0);
    expect(debug.players[0].totalClicks).toBe(0);
    expect(debug.isFinished).toBe(false);
    expect(debug.blastoffSequence).toBe(false);
  });

  test('spam clicking pumps pressure, increments click counter, and measures CPS', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=spam_click_showdown&players=2&bots=1&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(150);

    // Spam press Space / KeyW rapidly 12 times
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(45);
    }

    const debug = await page.evaluate(() => (window as any).__SPAM_CLICK_DEBUG__);
    expect(debug).toBeTruthy();

    const p0 = debug.players[0];
    expect(p0.totalClicks).toBeGreaterThanOrEqual(10);
    expect(p0.pressure).toBeGreaterThan(100);
    expect(p0.cps).toBeGreaterThan(5);
  });

  test('mouse clicking anywhere on screen pumps pressure in 1P mode', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=spam_click_showdown&players=2&bots=1&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(150);

    const initialClicks = await page.evaluate(() => (window as any).__SPAM_CLICK_DEBUG__.players[0].totalClicks);

    // Mouse click on canvas 5 times
    const canvas = page.locator('canvas');
    for (let i = 0; i < 5; i++) {
      await canvas.click({ position: { x: 300, y: 300 } });
      await page.waitForTimeout(60);
    }

    const afterClicks = await page.evaluate(() => (window as any).__SPAM_CLICK_DEBUG__.players[0].totalClicks);
    expect(afterClicks).toBeGreaterThan(initialClicks);
  });

  test('supports 4 players with individual launchpads and bot AI mashing', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=spam_click_showdown&players=4&bots=3&difficulty=hard`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    // Allow bots to spam click for 2.0 seconds
    await page.waitForTimeout(2000);

    const debug = await page.evaluate(() => (window as any).__SPAM_CLICK_DEBUG__);
    expect(debug).toBeTruthy();
    expect(debug.players.length).toBe(4);

    // Verify bots are actively mashing and building pressure
    const bot1 = debug.players[1];
    const bot2 = debug.players[2];
    const bot3 = debug.players[3];

    expect(bot1.totalClicks).toBeGreaterThan(5);
    expect(bot2.totalClicks).toBeGreaterThan(5);
    expect(bot3.totalClicks).toBeGreaterThan(5);
    expect(bot1.pressure).toBeGreaterThan(50);
  });

  test('reaching 1000 PSI triggers rocket blastoff sequence and crowns the winner', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=spam_click_showdown&players=2&bots=1&difficulty=easy`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(100);

    // Rapidly spam Player 1 to max pressure using debug trigger helper
    await page.evaluate(() => {
      const debug = (window as any).__SPAM_CLICK_DEBUG__;
      for (let i = 0; i < 80; i++) {
        debug.triggerClick(0);
      }
    });

    await page.waitForTimeout(200);

    const debug = await page.evaluate(() => (window as any).__SPAM_CLICK_DEBUG__);
    expect(debug).toBeTruthy();

    // Verify blastoff sequence triggered with Player 0 as winner
    expect(debug.blastoffSequence).toBe(true);
    expect(debug.winnerId).toBe(0);
    expect(debug.players[0].hasPopped).toBe(true);
  });
});
