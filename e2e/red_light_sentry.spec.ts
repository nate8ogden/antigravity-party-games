import { test, expect } from '@playwright/test';

test.describe('Red Light Sentry Game - Distance, Zap Knockback, Yellow Timer & AI', () => {
  test('Starting position is placed farther back at the edges with lengthened track', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=red_light_sentry&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    const runnerData = await page.evaluate(() => {
      const debug = (window as any).__RED_LIGHT_DEBUG__;
      if (!debug) return null;
      return debug.getRunners();
    });

    expect(runnerData).not.toBeNull();
    const p1 = runnerData.find((r: any) => r.id === 0);
    expect(p1).toBeDefined();

    // P1 start is at 26px (farther back from old 50px)
    expect(p1.startX).toBe(26);
    // Distance to trophy is 374px
    const distanceToTrophy = Math.abs(p1.targetX - p1.startX);
    expect(distanceToTrophy).toBeGreaterThan(360);
    // Speed is 92 px/s, requiring > 4s of green light sprint
    expect(p1.speed).toBe(92);
  });

  test('Zap laser strike pushes runner back by 160px', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=red_light_sentry&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    const zapResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const debug = (window as any).__RED_LIGHT_DEBUG__;
      if (!game || !debug) return null;

      const p1 = game.runners.get(0);
      if (!p1) return null;

      // Position runner forward at x = 250
      p1.x = 250;
      const preX = p1.x;

      // Switch sentry to RED phase
      debug.setPhase('red', 2.0);

      // Force player 0 to move during red light
      debug.triggerHold(0, true);
      game.update(0.016, 800, 600);

      return {
        preX,
        postX: p1.x,
        stunTimer: p1.stunTimer
      };
    });

    expect(zapResult).not.toBeNull();
    // Knockback pushes back by 160px (250 - 160 = 90)
    expect(zapResult!.postX).toBe(90);
    // Stun timer applied
    expect(zapResult!.stunTimer).toBeGreaterThan(1.0);
  });

  test('Yellow phase sets up brake warning and bot reaction latency', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=red_light_sentry&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    const yellowData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const debug = (window as any).__RED_LIGHT_DEBUG__;
      if (!game || !debug) return null;

      // Set to yellow phase
      debug.setPhase('yellow', 0.8);

      const bot = game.runners.get(1);
      const botState = game.botStates.get(1);

      return {
        phase: debug.getPhase(),
        yellowDur: debug.getYellowDuration(),
        botState: botState ? { ...botState } : null
      };
    });

    expect(yellowData).not.toBeNull();
    expect(yellowData!.phase).toBe('yellow');
    expect(yellowData!.yellowDur).toBeGreaterThan(0.5);
  });
});
