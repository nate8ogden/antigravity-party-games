import { test, expect } from '@playwright/test';

test.describe('Blade Parry - Rock \'Em Sock \'Em Mechanics', () => {
  test('should load Blade Parry and verify Rock \'Em Sock \'Em gameplay', async ({ page }) => {
    // Navigate to local dev server with blade_parry game
    await page.goto('http://localhost:5173/?game=blade_parry&mode=pvp');

    // Wait for canvas to be present
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Allow game to initialize and run a few frames
    await page.waitForTimeout(500);

    // Verify debug object is exposed on window
    const hasDebug = await page.evaluate(() => {
      return typeof (window as any).__BLADE_PARRY_DEBUG__ !== 'undefined';
    });
    expect(hasDebug).toBe(true);

    // Check initial state
    const initialState = await page.evaluate(() => {
      const debug = (window as any).__BLADE_PARRY_DEBUG__;
      return {
        p1Notches: debug.p1.chinNotches,
        p2Notches: debug.p2.chinNotches,
        p1X: debug.p1.x,
        p2X: debug.p2.x,
        p1Popped: debug.p1.isHeadPopped,
        p2Popped: debug.p2.isHeadPopped,
      };
    });
    expect(initialState.p1Notches).toBe(0);
    expect(initialState.p2Notches).toBe(0);
    expect(initialState.p1Popped).toBe(false);
    expect(initialState.p2Popped).toBe(false);

    // Skip countdown to immediately enter PLAYING state
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });
    await page.waitForTimeout(100);

    // 1. Test Shuffle Movement (KeyD / Right)
    const beforeShuffleX = await page.evaluate(() => (window as any).__BLADE_PARRY_DEBUG__.p1.x);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(150);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(50);
    const afterShuffleX = await page.evaluate(() => (window as any).__BLADE_PARRY_DEBUG__.p1.x);
    expect(afterShuffleX).toBeGreaterThan(beforeShuffleX);

    // 2. Test Left Jab punch input for Player 1 (W key)
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(100);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(50);

    // Verify punch triggered or cooldown activated
    const cdState = await page.evaluate(() => {
      const debug = (window as any).__BLADE_PARRY_DEBUG__;
      return debug.p1.punchCooldown > 0 || debug.p1.activePunch !== 'none';
    });
    expect(cdState).toBe(true);

    // 3. Test Blade Parry input (Space key)
    await page.waitForTimeout(400); // Wait for punch cooldown to reset
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);
    const parryActive = await page.evaluate(() => {
      const debug = (window as any).__BLADE_PARRY_DEBUG__;
      return debug.p1.isGuarding || debug.p1.guardTimer > 0 || debug.p1.parryCooldown > 0;
    });
    expect(parryActive).toBe(true);

    // 4. Test Knockout (5 chin notches) via debug harness
    await page.evaluate(() => {
      const debug = (window as any).__BLADE_PARRY_DEBUG__;
      // Add chin notches to trigger knockout
      debug.addChinNotches(1, 5);
    });

    await page.waitForTimeout(200);

    const koState = await page.evaluate(() => {
      const debug = (window as any).__BLADE_PARRY_DEBUG__;
      return {
        p2Notches: debug.p2.chinNotches,
        p2Popped: debug.p2.isHeadPopped,
        p1Wins: debug.p1Wins,
      };
    });

    expect(koState.p2Notches).toBe(5);
    expect(koState.p2Popped).toBe(true);
    expect(koState.p1Wins).toBeGreaterThanOrEqual(1);
  });
});
