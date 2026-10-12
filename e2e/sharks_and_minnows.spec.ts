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

test.describe('Sharks and Minnows Minigame Verification', () => {
  test('2-player launch and roles initialization', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=sharks_and_minnows&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    const initData = await page.evaluate(() => {
      const dbg = (window as any).__SHARKS_AND_MINNOWS_DEBUG__;
      const s0 = dbg?.getSwimmer(0);
      const s1 = dbg?.getSwimmer(1);
      const npcs = dbg?.getNpcMinnows();
      const stars = dbg?.getSeaStars();

      return {
        hasDebug: !!dbg,
        wave: dbg?.getWave(),
        p0Role: s0?.role,
        p1Role: s1?.role,
        npcCount: npcs?.length,
        starCount: stars?.length
      };
    });

    expect(initData.hasDebug).toBe(true);
    expect(initData.wave).toBe(1);
    expect(initData.p0Role).toBe('minnow');
    expect(initData.p1Role).toBe('shark');
    expect(initData.npcCount).toBe(6);
    expect(initData.starCount).toBe(4);
    expect(consoleErrors).toEqual([]);
  });

  test('Minnow direct movement & Dart Juke ability', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=sharks_and_minnows&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    // Fast-forward announcement phase into 'swimming'
    await page.waitForTimeout(1400);

    const p0Before = await page.evaluate(() => {
      const dbg = (window as any).__SHARKS_AND_MINNOWS_DEBUG__;
      return dbg.getSwimmer(0);
    });

    // Swim upwards with 'W'
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyW');

    const p0AfterW = await page.evaluate(() => {
      const dbg = (window as any).__SHARKS_AND_MINNOWS_DEBUG__;
      return dbg.getSwimmer(0);
    });

    // Minnow should have moved up (y decreased)
    expect(p0AfterW.y).toBeLessThan(p0Before.y);

    // Test Dart Juke with 'Space'
    await page.keyboard.down('Space');
    await page.waitForTimeout(80);
    await page.keyboard.up('Space');
    await page.waitForTimeout(40);

    const p0AfterDash = await page.evaluate(() => {
      const dbg = (window as any).__SHARKS_AND_MINNOWS_DEBUG__;
      return {
        dashDuration: dbg.getSwimmer(0)?.dashDuration,
        dashCooldown: dbg.getSwimmer(0)?.dashCooldown
      };
    });

    expect(p0AfterDash.dashCooldown).toBeGreaterThan(0);
  });

  test('Shark bounds and Chomp Lunge ability', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=sharks_and_minnows&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(1400);

    // Test Shark Lunge
    await page.evaluate(() => {
      const dbg = (window as any).__SHARKS_AND_MINNOWS_DEBUG__;
      dbg.triggerLunge(1);
    });

    const s1Lunge = await page.evaluate(() => {
      const dbg = (window as any).__SHARKS_AND_MINNOWS_DEBUG__;
      const s1 = dbg.getSwimmer(1);
      return {
        lungeDuration: s1.lungeDuration,
        lungeCooldown: s1.lungeCooldown
      };
    });

    expect(s1Lunge.lungeDuration).toBeGreaterThan(0);
    expect(s1Lunge.lungeCooldown).toBeGreaterThan(0);
  });

  test('Chomping a minnow in deep ocean awards shark score', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=sharks_and_minnows&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(1400);

    // Teleport Shark (P1) and Minnow (P0) into deep water channel adjacent to each other
    await page.evaluate(() => {
      const dbg = (window as any).__SHARKS_AND_MINNOWS_DEBUG__;
      // Deep channel center is around y = 300
      dbg.setPlayerPos(1, 400, 300); // Shark
      dbg.setPlayerPos(0, 410, 300); // Minnow right next to shark
    });

    // Advance 3 physics frames
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const g = gm?.activeGame;
      if (g) {
        g.update(1 / 60, 800, 600);
        g.update(1 / 60, 800, 600);
        g.update(1 / 60, 800, 600);
      }
    });

    const result = await page.evaluate(() => {
      const dbg = (window as any).__SHARKS_AND_MINNOWS_DEBUG__;
      const p0 = dbg.getSwimmer(0);
      const p1 = dbg.getSwimmer(1);
      return {
        p0Alive: p0.isAlive,
        p1Score: p1.score
      };
    });

    // Minnow should be chomped (alive: false) and Shark awarded 150 points
    expect(result.p0Alive).toBe(false);
    expect(result.p1Score).toBe(150);
  });

  test('Safe crossing to destination shore awards 100 points', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=sharks_and_minnows&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(1400);

    // In Wave 1 (south to north), destination is North Shore (y <= 115)
    await page.evaluate(() => {
      const dbg = (window as any).__SHARKS_AND_MINNOWS_DEBUG__;
      dbg.setPlayerPos(0, 400, 100); // inside North Shore Safe Haven
    });

    // Advance 1 frame
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm?.activeGame?.update(1 / 60, 800, 600);
    });

    const crossResult = await page.evaluate(() => {
      const dbg = (window as any).__SHARKS_AND_MINNOWS_DEBUG__;
      const p0 = dbg.getSwimmer(0);
      return {
        hasCrossed: p0.hasCrossed,
        score: p0.score
      };
    });

    expect(crossResult.hasCrossed).toBe(true);
    expect(crossResult.score).toBeGreaterThanOrEqual(100);
  });
});
