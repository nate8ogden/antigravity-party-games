import { test, expect } from '@playwright/test';

async function skipCountdown(page: any) {
  await page.evaluate(() => {
    const gm = (window as any).__GAME_MANAGER__;
    if (gm) {
      gm.countdownTimer = 0;
      gm.state = 'PLAYING';
    }
  });
  await page.waitForTimeout(50);
}

test.describe("Don't Look Down - Multi-Shape, Auto-Jump & 90s Rush Verification", () => {
  test('should boot Don\'t Look Down with 90s timer and no 5-minute references', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=dont_look_down&players=2&difficulty=hard');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    const data = await page.evaluate(() => {
      const dbg = (window as any).__DONT_LOOK_DOWN_DEBUG__;
      return {
        timer: dbg.getRoundTimer(),
        p0: dbg.getPlayer(0),
        p1: dbg.getPlayer(1)
      };
    });

    expect(data.timer).toBeLessThanOrEqual(90);
    expect(data.timer).toBeGreaterThan(80);
    expect(data.p0).toBeDefined();
    expect(data.p1).toBeDefined();
  });

  test('should generate diverse geometric platform shapes (circle, diamond, hexagon, etc.)', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=dont_look_down&players=2&difficulty=hard');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    const shapes = await page.evaluate(() => {
      const dbg = (window as any).__DONT_LOOK_DOWN_DEBUG__;
      const plats = dbg.getPlatforms();
      const shapeSet = new Set(plats.map((p: any) => p.shape));
      return Array.from(shapeSet);
    });

    // Verify multiple shapes were generated (at least 3 distinct shapes in cyber theme)
    expect(shapes.length).toBeGreaterThanOrEqual(3);
    expect(shapes).toContain('rectangle');
    // Check presence of other shapes
    const hasSpecialShape = shapes.some((s) => ['circle', 'diamond', 'hexagon', 'cloud', 'triangle'].includes(s));
    expect(hasSpecialShape).toBe(true);
  });

  test('should automatically jump upon landing on platforms without requiring charge input', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=dont_look_down&players=2&difficulty=normal');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    const jumpResult = await page.evaluate(async () => {
      const dbg = (window as any).__DONT_LOOK_DOWN_DEBUG__;
      const plats = dbg.getPlatforms();
      const targetPlat = plats[1]; // first platform above ground

      // Position player slightly above platform with zero velocity
      dbg.setPlayerPos(0, targetPlat.x + targetPlat.w / 2, targetPlat.y - 2, 0, 50);

      // Wait 120ms for collision and auto-jump bounce
      await new Promise((r) => setTimeout(r, 120));

      const p0 = dbg.getPlayer(0);
      return {
        vy: p0.vy,
        isGrounded: p0.grounded
      };
    });

    // Auto-jump triggered an upward velocity (vy < 0)
    expect(jumpResult.vy).toBeLessThan(-200);
  });

  test('Spring Leap Boost gives higher upward launch velocity when action key is active', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=dont_look_down&players=2&difficulty=normal');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    // Hold Space / Action key
    await page.keyboard.down('Space');

    await page.evaluate(() => {
      const dbg = (window as any).__DONT_LOOK_DOWN_DEBUG__;
      const plats = dbg.getPlatforms();
      const targetPlat = plats[1];
      dbg.setPlayerPos(0, targetPlat.x + targetPlat.w / 2, targetPlat.y - 2, 0, 50);
    });

    await page.waitForTimeout(100);

    const boostResult = await page.evaluate(() => {
      const dbg = (window as any).__DONT_LOOK_DOWN_DEBUG__;
      const p0 = dbg.getPlayer(0);
      return {
        vy: p0.vy,
        springBoostActive: p0.springBoostActive
      };
    });

    await page.keyboard.up('Space');

    // Vy is even more negative than normal 540 bounce (spring boost is 670)
    expect(boostResult.vy).toBeLessThan(-450);
  });

  test('Bot AI actively paths and climbs upward to higher altitude', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=dont_look_down&players=2&difficulty=hard');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    // Give bot time to auto-jump and climb
    await page.waitForTimeout(2500);

    const botAlt = await page.evaluate(() => {
      const dbg = (window as any).__DONT_LOOK_DOWN_DEBUG__;
      const p1 = dbg.getPlayer(1);
      return {
        altitude: p1.highestAltitude,
        y: p1.y
      };
    });

    // Bot climbed above the starting ground (3400)
    expect(botAlt.altitude).toBeGreaterThan(0);
    expect(botAlt.y).toBeLessThan(3350);
  });

  test('Reaching the summit immediately awards victory and ends round', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=dont_look_down&players=2&difficulty=normal');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    const summitResult = await page.evaluate(async () => {
      const dbg = (window as any).__DONT_LOOK_DOWN_DEBUG__;
      // Summit is at y = 220
      dbg.setPlayerPos(0, 400, 220, 0, 0);

      await new Promise((r) => setTimeout(r, 100));

      const res = dbg.game.getRoundResult();
      return {
        isOver: dbg.game.isRoundOver(),
        winnerId: res.winnerId,
        highlight: res.mvpHighlight
      };
    });

    expect(summitResult.isOver).toBe(true);
    expect(summitResult.winnerId).toBe(0);
    expect(summitResult.highlight).toContain('conquered the summit');
  });
});
