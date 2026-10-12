import { test, expect } from '@playwright/test';

test.describe('Pixel Curling - Mechanics & AI', () => {
  test('should load Pixel Curling and verify aim, launch, sweep, and bot turn progression', async ({ page }) => {
    // Navigate to local dev server with pixel_curling game (1 human, 1 bot)
    await page.goto('http://localhost:5173/?game=pixel_curling&players=1&difficulty=normal');

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(500);

    // Fast forward countdown to PLAYING state
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });
    await page.waitForTimeout(100);

    // Verify debug interface is exposed
    const hasDebug = await page.evaluate(() => {
      return typeof (window as any).__CURLING_DEBUG__ !== 'undefined';
    });
    expect(hasDebug).toBe(true);

    // Check initial player state
    const initialP1State = await page.evaluate(() => {
      const debug = (window as any).__CURLING_DEBUG__;
      const p1 = debug.players.find((p: any) => p.id === 0);
      return {
        aimAngle: p1.aimAngle,
        launchPower: p1.launchPower,
        stonesRemaining: p1.stonesRemaining
      };
    });
    expect(initialP1State.aimAngle).toBe(0);
    expect(initialP1State.stonesRemaining).toBe(3);

    // 1. Test Steering / Aiming (KeyD / Right Arrow)
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(150);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(50);

    const aimedAngle = await page.evaluate(() => {
      const debug = (window as any).__CURLING_DEBUG__;
      const p1 = debug.players.find((p: any) => p.id === 0);
      return p1.aimAngle;
    });
    expect(aimedAngle).toBeGreaterThan(0);

    // 2. Test Hold Space to Charge Launch Power and Release to Launch
    await page.keyboard.down('Space');
    await page.waitForTimeout(300); // Charge power
    const chargedPower = await page.evaluate(() => {
      const debug = (window as any).__CURLING_DEBUG__;
      const p1 = debug.players.find((p: any) => p.id === 0);
      return p1.launchPower;
    });
    expect(chargedPower).toBeGreaterThan(150);

    // Release Space to launch stone
    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    // Verify stone was launched and is in motion
    const stonesState = await page.evaluate(() => {
      const debug = (window as any).__CURLING_DEBUG__;
      return {
        count: debug.stones.length,
        hasMovingStone: debug.stones.some((s: any) => s.isMoving)
      };
    });
    expect(stonesState.count).toBe(1);
    expect(stonesState.hasMovingStone).toBe(true);

    // 3. Test Sweeping Action while stone is moving
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);

    // 4. Fast forward current stone to stop and check turn advance
    await page.evaluate(() => {
      const debug = (window as any).__CURLING_DEBUG__;
      debug.forceTurnEnd();
    });
    await page.waitForTimeout(150);

    // Turn should have advanced from turn 0 (Player 1) to turn 1 (Player 2 / Bot)
    const turnAfterP1 = await page.evaluate(() => {
      const debug = (window as any).__CURLING_DEBUG__;
      return debug.currentTurnIndex;
    });
    expect(turnAfterP1).toBe(1);

    // 5. Verify Bot executes its turn (Bot launches stone)
    await page.waitForTimeout(800); // Allow bot reaction and launch

    const botLaunchState = await page.evaluate(() => {
      const debug = (window as any).__CURLING_DEBUG__;
      return {
        stoneCount: debug.stones.length,
        botStonesRemaining: debug.players.find((p: any) => p.id === 1).stonesRemaining
      };
    });

    // Bot must have launched its stone!
    expect(botLaunchState.stoneCount).toBeGreaterThanOrEqual(2);
    expect(botLaunchState.botStonesRemaining).toBeLessThan(3);
  });

  test('should load via ?game=curling alias and calculate button proximity', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=curling&players=1&difficulty=hard');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(500);

    // Skip countdown
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });
    await page.waitForTimeout(100);

    // Test placing stone right on the center pin/button using debug helper
    await page.evaluate(() => {
      const debug = (window as any).__CURLING_DEBUG__;
      const gm = (window as any).__GAME_MANAGER__;
      const hX = gm.activeGame.houseX;
      const hY = gm.activeGame.houseY;
      debug.placeStoneAt(0, hX + 4, hY + 4);
    });

    await page.waitForTimeout(100);

    const stoneStatus = await page.evaluate(() => {
      const debug = (window as any).__CURLING_DEBUG__;
      const s = debug.stones[0];
      return {
        hasStone: !!s,
        distToPin: s.distToPin,
        score: s.score,
        isShotStone: s.isShotStone
      };
    });

    expect(stoneStatus.hasStone).toBe(true);
    expect(stoneStatus.distToPin).toBeLessThan(20);
    expect(stoneStatus.score).toBe(500); // 500 points for Button Pin!
    expect(stoneStatus.isShotStone).toBe(true);
  });
});
