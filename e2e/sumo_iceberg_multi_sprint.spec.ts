import { test, expect } from '@playwright/test';

test.describe('Sumo Iceberg - Multiple Sprint Charges & Recharge Mechanics', () => {
  test('Players start with 3 sprint charges and can sprint multiple times in sequence', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const sprintData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('sumo_iceberg');
      gm.state = 'PLAYING';
      const game = gm.activeGame as any;
      const w = gm.logicalWidth;
      const h = gm.logicalHeight;

      const p1 = game.rivals.get(0);
      const initialCharges = p1.sprintCharges;
      const maxCharges = p1.maxSprintCharges;

      // Sprint 1
      gm.input.press(0);
      game.update(0.016, w, h);
      gm.input.release(0);
      const chargesAfterSprint1 = p1.sprintCharges;
      const isDashing1 = p1.isDashing;

      // Advance through small sprint cooldown buffer (0.25s) without waiting for full recharge (1.35s)
      p1.sprintCooldown = 0;

      // Sprint 2 (second sprint in succession!)
      gm.input.press(0);
      game.update(0.016, w, h);
      gm.input.release(0);
      const chargesAfterSprint2 = p1.sprintCharges;
      const isDashing2 = p1.isDashing;

      // Advance through cooldown buffer
      p1.sprintCooldown = 0;

      // Sprint 3 (third sprint!)
      gm.input.press(0);
      game.update(0.016, w, h);
      gm.input.release(0);
      const chargesAfterSprint3 = p1.sprintCharges;
      const isDashing3 = p1.isDashing;

      // Advance through cooldown buffer and attempt sprint 4 with 0 charges remaining
      p1.sprintCooldown = 0;
      p1.isDashing = false;
      gm.input.press(0);
      game.update(0.016, w, h);
      gm.input.release(0);
      const chargesAfterSprint4Attempt = p1.sprintCharges;
      const isDashing4Blocked = p1.isDashing;

      return {
        initialCharges,
        maxCharges,
        chargesAfterSprint1,
        isDashing1,
        chargesAfterSprint2,
        isDashing2,
        chargesAfterSprint3,
        isDashing3,
        chargesAfterSprint4Attempt,
        isDashing4Blocked
      };
    });

    expect(pageErrors).toEqual([]);
    expect(sprintData.initialCharges).toBe(3);
    expect(sprintData.maxCharges).toBe(3);

    // Sprint 1
    expect(sprintData.chargesAfterSprint1).toBe(2);
    expect(sprintData.isDashing1).toBe(true);

    // Sprint 2
    expect(sprintData.chargesAfterSprint2).toBe(1);
    expect(sprintData.isDashing2).toBe(true);

    // Sprint 3
    expect(sprintData.chargesAfterSprint3).toBe(0);
    expect(sprintData.isDashing3).toBe(true);

    // Sprint 4 blocked (0 charges)
    expect(sprintData.chargesAfterSprint4Attempt).toBe(0);
    expect(sprintData.isDashing4Blocked).toBe(false);
  });

  test('Spent sprint charges recharge back up over time', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const rechargeData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('sumo_iceberg');
      gm.state = 'PLAYING';
      const game = gm.activeGame as any;
      const w = gm.logicalWidth;
      const h = gm.logicalHeight;

      const p1 = game.rivals.get(0);

      // Spend 2 sprint charges
      p1.sprintCharges = 1;
      p1.sprintRechargeTimer = 0;

      // Advance by half the recharge time (0.7s < 1.35s)
      game.update(0.7, w, h);
      const chargesAtHalf = p1.sprintCharges;
      const rechargeProgress = p1.sprintRechargeTimer;

      // Advance by remaining recharge time (another 0.7s -> total 1.4s > 1.35s)
      game.update(0.7, w, h);
      const chargesAfterFullRecharge1 = p1.sprintCharges;

      // Advance another 1.4s to recharge back to max 3
      game.update(1.4, w, h);
      const chargesAfterFullRecharge2 = p1.sprintCharges;

      return {
        chargesAtHalf,
        rechargeProgress,
        chargesAfterFullRecharge1,
        chargesAfterFullRecharge2
      };
    });

    expect(rechargeData.chargesAtHalf).toBe(1);
    expect(rechargeData.rechargeProgress).toBeGreaterThan(0.5);
    expect(rechargeData.chargesAfterFullRecharge1).toBe(2);
    expect(rechargeData.chargesAfterFullRecharge2).toBe(3);
  });
});
