import { test, expect } from '@playwright/test';

test.describe('Laser Leap Game - Beatable Bot AI and Jump Mechanics', () => {
  test('Laser Leap initializes jumpers and laser properly', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=laser_leap&players=1&difficulty=normal');
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

    const jumpers = await page.evaluate(() => {
      const dbg = (window as any).__LASER_LEAP_DEBUG__;
      return dbg ? dbg.getJumpers() : null;
    });

    expect(jumpers).not.toBeNull();
    expect(jumpers.length).toBeGreaterThanOrEqual(2);
    expect(jumpers[0].alive).toBe(true);
    expect(jumpers[1].alive).toBe(true);
  });

  test('Jumping cleanly over the laser beam awards +10 points', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=laser_leap&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    // Setup: place laser just before P0 pod angle, and trigger jump at apex
    const result = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const dbg = (window as any).__LASER_LEAP_DEBUG__;
      const game = gm?.activeGame;
      if (!game || !dbg) return null;

      const p0 = dbg.getJumpers().find((j: any) => j.id === 0);
      if (!p0) return null;

      // Position laser 0.4 rad behind P0 moving clockwise
      const twoPi = Math.PI * 2;
      const startAngle = ((p0.angle - 0.35) % twoPi + twoPi) % twoPi;
      dbg.setLaser(startAngle, 2.0, 1);

      // Trigger jump now
      dbg.jump(0);

      // Step simulation by 0.17s so jump is at apex (~40px)
      game.update(0.17, 800, 600);

      // Step simulation across the beam sweep
      game.update(0.10, 800, 600);

      const after = dbg.getJumpers().find((j: any) => j.id === 0);
      return {
        alive: after.alive,
        score: after.score,
        jumpHeight: after.jumpHeight
      };
    });

    expect(result).not.toBeNull();
    expect(result!.alive).toBe(true);
    expect(result!.score).toBe(10);
  });

  test('Staying on the ground when laser sweeps through causes elimination (Zapped)', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=laser_leap&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    const result = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const dbg = (window as any).__LASER_LEAP_DEBUG__;
      const game = gm?.activeGame;
      if (!game || !dbg) return null;

      const p0 = dbg.getJumpers().find((j: any) => j.id === 0);
      if (!p0) return null;

      // Position laser 0.2 rad behind P0 moving clockwise without jumping
      const twoPi = Math.PI * 2;
      const startAngle = ((p0.angle - 0.2) % twoPi + twoPi) % twoPi;
      dbg.setLaser(startAngle, 3.0, 1);

      // Sweep through P0 angle without jumping
      game.update(0.15, 800, 600);

      const after = dbg.getJumpers().find((j: any) => j.id === 0);
      return {
        alive: after.alive
      };
    });

    expect(result).not.toBeNull();
    expect(result!.alive).toBe(false);
  });

  test('Bot AI is less hard: rolls blunders and has reversal surprise latency', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=laser_leap&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    // Verify botState exists and has surprise timer initialized or tracked
    const botAudit = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const dbg = (window as any).__LASER_LEAP_DEBUG__;
      const game = gm?.activeGame;
      if (!game || !dbg) return null;

      // Sample planned lead times over multiple sweeps
      const samples: number[] = [];
      const botPid = 1; // P2 is bot in 1-player mode

      for (let i = 0; i < 40; i++) {
        // Reset plannedCurrentSweep and set laser approaching
        const bState = dbg.getBotState(botPid);
        if (bState) {
          bState.hasPlannedCurrentSweep = false;
        }
        const jumper = dbg.getJumpers().find((j: any) => j.id === botPid);
        const twoPi = Math.PI * 2;
        // Place laser 0.5s away
        const startAngle = ((jumper.angle - 0.5 * 2.4) % twoPi + twoPi) % twoPi;
        dbg.setLaser(startAngle, 2.4, 1);

        // Update bot AI
        game.update(0.016, 800, 600);

        if (bState) {
          samples.push(bState.plannedLeadTime);
        }
      }

      // Check reversal surprise latency
      game.reversalTimer = 0.01;
      game.update(0.02, 800, 600);
      const afterReversalState = dbg.getBotState(botPid);

      return {
        samples,
        reversalSurpriseTimer: afterReversalState?.surpriseTimer ?? 0
      };
    });

    expect(botAudit).not.toBeNull();
    expect(botAudit!.reversalSurpriseTimer).toBeGreaterThan(0.1);

    // Samples should include variation and blunders (>0.388 or <0.052)
    const samples = botAudit!.samples;
    expect(samples.length).toBe(40);
    const hasBlunder = samples.some(t => t > 0.388 || t < 0.052);
    expect(hasBlunder).toBe(true);
  });
});
