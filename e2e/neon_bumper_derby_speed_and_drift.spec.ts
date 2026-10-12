import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Neon Bumper Derby - Speed, Anti-Drift and Physics Tests', () => {
  test('High top speed and instant forward acceleration', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=hovercraft&players=2`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(600);

    // Initial state
    const initialCar0 = await page.evaluate(() => {
      const debug = (window as any).__HOVERCRAFT_DEBUG__;
      const c = debug?.cars?.get(0);
      return { vx: c?.vx, vy: c?.vy, angle: c?.angle };
    });

    expect(initialCar0).toBeTruthy();

    // Hold W to accelerate
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);

    const acceleratedCar = await page.evaluate(() => {
      const debug = (window as any).__HOVERCRAFT_DEBUG__;
      const c = debug?.cars?.get(0);
      const speed = Math.hypot(c.vx, c.vy);
      return { speed, vx: c.vx, vy: c.vy };
    });

    await page.keyboard.up('KeyW');

    // Speed should be high (> 450 px/s) instead of sluggish (< 60 px/s)
    expect(acceleratedCar.speed).toBeGreaterThan(450);
  });

  test('Zero involuntary drift or phantom spinning when idle', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=hovercraft&players=2`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(600);

    const angleBefore = await page.evaluate(() => {
      const debug = (window as any).__HOVERCRAFT_DEBUG__;
      const c = debug?.cars?.get(0);
      return c?.angle;
    });

    // Wait 500ms with zero keys pressed
    await page.waitForTimeout(500);

    const angleAfter = await page.evaluate(() => {
      const debug = (window as any).__HOVERCRAFT_DEBUG__;
      const c = debug?.cars?.get(0);
      return c?.angle;
    });

    // Angle must remain strictly stationary when idle (no continuous auto-spinning drift)
    expect(Math.abs(angleAfter - angleBefore)).toBeLessThan(0.001);
  });

  test('High lateral tire grip rapidly absorbs sideways drift', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=hovercraft&players=2`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(600);

    // Manually inject a sideways lateral impulse to test tire traction
    const driftDecay = await page.evaluate(async () => {
      const debug = (window as any).__HOVERCRAFT_DEBUG__;
      const c = debug?.cars?.get(0);
      if (!c) return null;

      // Point car East (angle = 0)
      c.angle = 0;
      c.vx = 200; // forward
      c.vy = 400; // purely lateral sideways drift

      const initialLateral = Math.abs(c.vy);

      // Wait 150ms for tire grip to engage
      await new Promise((r) => setTimeout(r, 150));

      const settledLateral = Math.abs(c.vy);
      return { initialLateral, settledLateral };
    });

    expect(driftDecay).toBeTruthy();
    // Sideways drift should be damped down by > 80%
    expect(driftDecay!.settledLateral).toBeLessThan(driftDecay!.initialLateral * 0.25);
  });

  test('Bumper bounce provides explosive propulsion and awards score', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=hovercraft&players=2`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(600);

    const bounceResult = await page.evaluate(async () => {
      const debug = (window as any).__HOVERCRAFT_DEBUG__;
      const c = debug?.cars?.get(0);
      const b = debug?.bumpers?.[0];
      if (!c || !b) return null;

      const initialScore = c.score;

      // Position car slightly touching bumper
      c.x = b.x + b.radius + c.radius - 2;
      c.y = b.y;
      c.vx = -100;
      c.vy = 0;

      // Wait 100ms for bumper physics resolution
      await new Promise((r) => setTimeout(r, 100));

      const speedAfter = Math.hypot(c.vx, c.vy);
      return {
        speedAfter,
        scoreDelta: c.score - initialScore,
        pulseActive: b.pulseTimer > 0
      };
    });

    expect(bounceResult).toBeTruthy();
    expect(bounceResult!.speedAfter).toBeGreaterThan(480);
    expect(bounceResult!.scoreDelta).toBe(50);
    expect(bounceResult!.pulseActive).toBe(true);
  });

  test('Battery pickup grants supercharge boost speed', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=hovercraft&players=2`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(600);

    const batteryTest = await page.evaluate(async () => {
      const debug = (window as any).__HOVERCRAFT_DEBUG__;
      const c = debug?.cars?.get(0);
      const bat = debug?.batteries?.[0];
      if (!c || !bat) return null;

      // Place car on battery
      c.x = bat.x;
      c.y = bat.y;
      c.superChargeTimer = 0;

      await new Promise((r) => setTimeout(r, 100));

      return {
        isSuperCharged: c.superChargeTimer > 0,
        batteryConsumed: !bat.active
      };
    });

    expect(batteryTest).toBeTruthy();
    expect(batteryTest!.isSuperCharged).toBe(true);
    expect(batteryTest!.batteryConsumed).toBe(true);
  });
});
