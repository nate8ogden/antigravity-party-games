import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Snowball Fight - Free Movement & Border Constraints', () => {
  test('players can move freely in their territory but cannot cross the center border', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=snowball_fight&players=2&difficulty=bot_easy`);
    await page.waitForTimeout(600);

    // Verify debug state exists
    const debugInit = await page.evaluate(() => (window as any).__SNOWBALL_FIGHT_DEBUG__);
    expect(debugInit).toBeTruthy();
    expect(debugInit.players.length).toBe(2);

    const initialP0X = debugInit.players[0].x;
    const initialP0Y = debugInit.players[0].y;
    expect(initialP0X).toBeGreaterThan(0);
    expect(initialP0Y).toBeGreaterThan(0);

    // 1. Move P0 (Red / West) to the right using 'KeyD'
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(600);
    await page.keyboard.up('KeyD');

    const debugMoved = await page.evaluate(() => (window as any).__SNOWBALL_FIGHT_DEBUG__);
    const movedP0X = debugMoved.players[0].x;
    // Player should have moved to the right
    expect(movedP0X).toBeGreaterThan(initialP0X);

    // 2. Attempt to cross the center border by continuously holding KeyD
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(1200);
    await page.keyboard.up('KeyD');

    const debugAtBorder = await page.evaluate(() => {
      const dbg = (window as any).__SNOWBALL_FIGHT_DEBUG__;
      const canvas = document.querySelector('canvas');
      const width = canvas?.width || 960;
      return {
        p0X: dbg.players[0].x,
        midX: width / 2,
        isBlocked: dbg.players[0].x <= width / 2 - 20
      };
    });

    // P0 must be strictly blocked before crossing midX
    expect(debugAtBorder.p0X).toBeLessThan(debugAtBorder.midX);
    expect(debugAtBorder.isBlocked).toBe(true);

    // 3. Move P0 vertically up and down
    await page.keyboard.down('KeyS'); // down
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyS');

    const debugDown = await page.evaluate(() => (window as any).__SNOWBALL_FIGHT_DEBUG__);
    expect(debugDown.players[0].y).toBeGreaterThan(initialP0Y);

    await page.keyboard.down('KeyW'); // up
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');

    const debugUp = await page.evaluate(() => (window as any).__SNOWBALL_FIGHT_DEBUG__);
    expect(debugUp.players[0].y).toBeLessThan(debugDown.players[0].y);

    // 4. Charge and throw snowball
    await page.keyboard.down('Space');
    await page.waitForTimeout(500);
    const chargingState = await page.evaluate(() => {
      const dbg = (window as any).__SNOWBALL_FIGHT_DEBUG__;
      return dbg.players[0].isCharging && dbg.players[0].chargePower > 0.2;
    });
    expect(chargingState).toBe(true);

    // Release to fire
    await page.keyboard.up('Space');
    await page.waitForTimeout(200);

    const shotState = await page.evaluate(() => {
      const dbg = (window as any).__SNOWBALL_FIGHT_DEBUG__;
      return dbg.snowballs.length;
    });
    expect(shotState).toBeGreaterThan(0);
  });

  test('East bot stays strictly on East side of border and moves tactically', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=snowball_fight&players=2&difficulty=bot_normal`);
    await page.waitForTimeout(1000);

    const positions = await page.evaluate(async () => {
      const samples: { p1X: number; midX: number }[] = [];
      const canvas = document.querySelector('canvas');
      const width = canvas?.width || 960;

      for (let i = 0; i < 10; i++) {
        const dbg = (window as any).__SNOWBALL_FIGHT_DEBUG__;
        if (dbg && dbg.players[1]) {
          samples.push({ p1X: dbg.players[1].x, midX: width / 2 });
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return samples;
    });

    expect(positions.length).toBeGreaterThan(0);
    for (const s of positions) {
      // East bot must remain on the East side (p1X > midX + 20)
      expect(s.p1X).toBeGreaterThan(s.midX + 20);
    }
  });
});
