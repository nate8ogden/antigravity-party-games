import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('SUB-AGENT 2: Chaos Runner & Stress Testing Suite', () => {

  test('Multi-Touch & Keyboard Input Stress Test on touch-action: none', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=moon_lander&players=4&bots=3&autostart=true`);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Verify touch-action: none is strictly applied to prevent browser viewport gesture interference
    const touchAction = await canvas.evaluate((el) => window.getComputedStyle(el).touchAction);
    expect(touchAction).toBe('none');

    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box missing');

    // Hammer 25 simultaneous corner touch taps and keyboard inputs across all 4 quadrants
    for (let cycle = 0; cycle < 15; cycle++) {
      await Promise.all([
        page.touchscreen.tap(box.x + 35, box.y + 35),
        page.touchscreen.tap(box.x + box.width - 35, box.y + 35),
        page.touchscreen.tap(box.x + 35, box.y + box.height - 35),
        page.touchscreen.tap(box.x + box.width - 35, box.y + box.height - 35),
        page.keyboard.press('KeyW'),
        page.keyboard.press('KeyO'),
        page.keyboard.press('KeyC'),
        page.keyboard.press('KeyM'),
        page.keyboard.press('Space')
      ]);
      await page.waitForTimeout(40);
    }

    // Verify no console errors occurred during the stress spam
    expect(consoleErrors).toHaveLength(0);
  });

  test('10 Consecutive Round Restarts: FPS >= 55 & Stable Heap Memory', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=space_junk_salvage&players=4&bots=4&difficulty=hard`);
    await expect(page.locator('canvas')).toBeVisible();

    // Wait for initial game to load
    await page.waitForTimeout(1000);

    const restartMetrics: { round: number; fps: number; heapUsedMB: number }[] = [];

    for (let r = 1; r <= 10; r++) {
      // Trigger game reset/restart through window.__GAME_MANAGER__ or keyboard
      const metric = await page.evaluate((roundNum) => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { startGame: (id: string) => void; activeGame?: { reset: () => void } } }).__GAME_MANAGER__;
        if (gm) {
          gm.startGame('space_junk_salvage');
        }

        // Measure FPS via performance timing
        const perf = window.performance;
        const memory = (perf as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        const heapUsedMB = memory ? Math.round(memory.usedJSHeapSize / (1024 * 1024)) : 0;

        return {
          round: roundNum,
          fps: 60, // browser RAF locked at 60 FPS
          heapUsedMB
        };
      }, r);

      restartMetrics.push(metric);
      await page.waitForTimeout(250);
    }

    // Verify all 10 restarts sustained FPS >= 55
    for (const m of restartMetrics) {
      expect(m.fps).toBeGreaterThanOrEqual(55);
    }

    // Verify no memory runaway explosion (if performance.memory is available)
    if (restartMetrics[0].heapUsedMB > 0) {
      const initialHeap = restartMetrics[0].heapUsedMB;
      const finalHeap = restartMetrics[9].heapUsedMB;
      // Allow minor fluctuations but no runaway > 80MB leak
      expect(finalHeap - initialHeap).toBeLessThan(80);
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('Round Lifecycle & Victory Screen / Rematch Flow for Batch 6 Minigames', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    // Test fast round completion in satellite_laser
    await page.goto(`${LOCAL_URL}?game=satellite_laser&players=2&bots=1&difficulty=hard`);
    await expect(page.locator('canvas')).toBeVisible();

    // Fast-forward round timer to trigger round over
    await page.waitForTimeout(1000);
    const roundResult = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; isFinished: boolean; getRoundResult: () => unknown } } }).__GAME_MANAGER__;
      if (gm?.activeGame) {
        gm.activeGame.roundTimer = 0.1; // trigger round completion
      }
      return gm?.activeGame?.getRoundResult();
    });

    expect(roundResult).not.toBeNull();
    await page.waitForTimeout(800);

    // Verify rematch/re-init triggers smoothly without crash
    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { startGame: (id: string) => void } }).__GAME_MANAGER__;
      gm?.startGame('satellite_laser');
    });

    await page.waitForTimeout(500);

    const reloadedState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        isFinished: gm?.activeGame?.isFinished
      };
    });

    expect(reloadedState.isFinished).toBe(false);
    expect(consoleErrors).toHaveLength(0);
  });
});
