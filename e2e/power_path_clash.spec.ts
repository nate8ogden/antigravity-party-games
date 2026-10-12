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
  await page.waitForTimeout(50);
}

test.describe('Power Path Clash Minigame Verification', () => {
  test('2-player launch, initial power and tower floors initialization', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=power_path_clash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    const initData = await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      const ps0 = dbg?.getPlayerState(0);
      const ps1 = dbg?.getPlayerState(1);
      const floors0 = dbg?.getFloors(0);

      return {
        hasDebug: !!dbg,
        phase: dbg?.getPhase(),
        p0Power: ps0?.power,
        p1Power: ps1?.power,
        floorCount: floors0?.length
      };
    });

    expect(initData.hasDebug).toBe(true);
    expect(initData.phase).toBe('path_selection');
    expect(initData.p0Power).toBe(10);
    expect(initData.p1Power).toBe(10);
    expect(initData.floorCount).toBe(5);
    expect(consoleErrors).toEqual([]);
  });

  test('Path choice progression: Defeating weaker enemy absorbs power', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=power_path_clash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    // Initial power is 10. Floor 0 Option 0 is Goblin (5 POW, +6 POW)
    const powerBefore = await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      return dbg.getPlayerState(0).power;
    });
    expect(powerBefore).toBe(10);

    // Choose option 0 on Floor 0
    await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      dbg.selectChoice(0, 0); // Player 0, Option 0 (Goblin)
    });

    const afterGoblin = await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      const ps = dbg.getPlayerState(0);
      return {
        power: ps.power,
        floor: ps.currentFloor
      };
    });

    // 10 + 6 = 16 power, advanced to floor 1
    expect(afterGoblin.power).toBe(16);
    expect(afterGoblin.floor).toBe(1);

    // Floor 1 Option 0 is Orc Brute (14 POW, +16 POW). Since 16 >= 14, player wins and absorbs!
    await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      dbg.selectChoice(0, 0);
    });

    const afterOrc = await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      const ps = dbg.getPlayerState(0);
      return {
        power: ps.power,
        floor: ps.currentFloor
      };
    });

    // 16 + 16 = 32 power, advanced to floor 2
    expect(afterOrc.power).toBe(32);
    expect(afterOrc.floor).toBe(2);
  });

  test('Multiplier rune boosts power proportionally', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=power_path_clash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    // Set player power to 20 on Floor 2 (War Blade x1.5)
    await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      dbg.setPower(0, 20);
      // Advance to floor 2
      dbg.getPlayerState(0).currentFloor = 2;
      // Option 1 on Floor 2 is War Blade (x1.5)
      dbg.selectChoice(0, 1);
    });

    const afterMult = await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      return dbg.getPlayerState(0).power;
    });

    // 20 * 1.5 = 30
    expect(afterMult).toBe(30);
  });

  test('Final Showdown: Most damage person wins no matter what', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=power_path_clash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    // Rig power: Player 0 has 150 power, Player 1 has 50 power
    await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      dbg.setPower(0, 150);
      dbg.setPower(1, 50);
      dbg.forceClash(); // Trigger final showdown
    });

    // Advance through clash intro & combat animation
    await page.waitForTimeout(4500);

    const clashResult = await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      const p0 = dbg.getPlayerState(0);
      const p1 = dbg.getPlayerState(1);
      const gm = (window as any).__GAME_MANAGER__;
      const result = gm?.activeGame?.getRoundResult();

      return {
        winnerId: result?.winnerId,
        p0Ko: p0.isKo,
        p1Ko: p1.isKo,
        p0Power: p0.power,
        p1Power: p1.power
      };
    });

    // Player 0 had 150 DMG vs Player 1's 50 DMG -> Player 0 MUST win, Player 1 MUST be KO'd
    expect(clashResult.winnerId).toBe(0);
    expect(clashResult.p0Ko).toBe(false);
    expect(clashResult.p1Ko).toBe(true);
  });

  test('Final Showdown reverse case: Rival with higher damage wins', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=power_path_clash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    // Rig power reverse: Player 0 has 40 power, Player 1 has 180 power
    await page.evaluate(() => {
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      dbg.setPower(0, 40);
      dbg.setPower(1, 180);
      dbg.forceClash();
    });

    await page.waitForTimeout(4500);

    const reverseClashResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const result = gm?.activeGame?.getRoundResult();
      const dbg = (window as any).__POWER_PATH_CLASH_DEBUG__;
      return {
        winnerId: result?.winnerId,
        p0Ko: dbg.getPlayerState(0).isKo,
        p1Ko: dbg.getPlayerState(1).isKo
      };
    });

    // Player 1 had 180 DMG vs Player 0's 40 DMG -> Player 1 MUST win, Player 0 MUST be KO'd
    expect(reverseClashResult.winnerId).toBe(1);
    expect(reverseClashResult.p0Ko).toBe(true);
    expect(reverseClashResult.p1Ko).toBe(false);
  });
});
