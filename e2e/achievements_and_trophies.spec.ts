import { test, expect } from '@playwright/test';

test.describe('Achievement & Trophy Room System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.evaluate(() => {
      const am = (window as unknown as { __ACHIEVEMENT_MANAGER__: { resetForTesting: () => void } }).__ACHIEVEMENT_MANAGER__;
      if (am) am.resetForTesting();
    });
  });

  test('Utility bar displays Trophy Room button with golden trophy icon and progress badge', async ({ page }) => {
    const trophyBtn = page.locator('#trophy-btn');
    await expect(trophyBtn).toBeVisible();

    const trophyBadge = page.locator('#trophy-unlocked-count');
    await expect(trophyBadge).toBeVisible();
    await expect(trophyBadge).toHaveText('0/12');
  });

  test('Toggling Trophy Room via UI button and keyboard shortcut (T / Esc)', async ({ page }) => {
    // Initial state: Trophy Room is closed
    let isTrophiesOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isTrophiesOpen: boolean } }).__GAME_MANAGER__;
      return gm.isTrophiesOpen;
    });
    expect(isTrophiesOpen).toBe(false);

    // Click Trophy button in utility bar to open
    await page.locator('#trophy-btn').click();
    isTrophiesOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isTrophiesOpen: boolean } }).__GAME_MANAGER__;
      return gm.isTrophiesOpen;
    });
    expect(isTrophiesOpen).toBe(true);

    // Press Escape to close
    await page.keyboard.press('Escape');
    isTrophiesOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isTrophiesOpen: boolean } }).__GAME_MANAGER__;
      return gm.isTrophiesOpen;
    });
    expect(isTrophiesOpen).toBe(false);

    // Press 'T' key to open
    await page.keyboard.press('t');
    isTrophiesOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isTrophiesOpen: boolean } }).__GAME_MANAGER__;
      return gm.isTrophiesOpen;
    });
    expect(isTrophiesOpen).toBe(true);

    // Press 'T' key again to toggle close
    await page.keyboard.press('t');
    isTrophiesOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isTrophiesOpen: boolean } }).__GAME_MANAGER__;
      return gm.isTrophiesOpen;
    });
    expect(isTrophiesOpen).toBe(false);
  });

  test('Unlocking achievement awards bounty coins and updates progress badge', async ({ page }) => {
    const initialCoins = await page.evaluate(() => {
      const em = (window as unknown as { __ECONOMY_MANAGER__: { getCoins: () => number } }).__ECONOMY_MANAGER__;
      return em.getCoins();
    });

    // Unlock 'first_win' achievement (reward: 25 coins)
    const unlockResult = await page.evaluate(() => {
      const am = (window as unknown as {
        __ACHIEVEMENT_MANAGER__: {
          unlock: (id: string) => boolean;
          isUnlocked: (id: string) => boolean;
          getUnlockedCount: () => number;
        };
      }).__ACHIEVEMENT_MANAGER__;

      const success = am.unlock('first_win');
      return {
        success,
        isUnlocked: am.isUnlocked('first_win'),
        unlockedCount: am.getUnlockedCount()
      };
    });

    expect(unlockResult.success).toBe(true);
    expect(unlockResult.isUnlocked).toBe(true);
    expect(unlockResult.unlockedCount).toBe(1);

    // Trophy count badge in utility bar should reactively update to '1/12'
    const trophyBadge = page.locator('#trophy-unlocked-count');
    await expect(trophyBadge).toHaveText('1/12');

    // Economy balance should have increased by exactly 25 coins
    const updatedCoins = await page.evaluate(() => {
      const em = (window as unknown as { __ECONOMY_MANAGER__: { getCoins: () => number } }).__ECONOMY_MANAGER__;
      return em.getCoins();
    });
    expect(updatedCoins).toBe(initialCoins + 25);

    // Coin counter badge in utility bar should update
    const coinCount = page.locator('#shop-coin-count');
    await expect(coinCount).toHaveText((initialCoins + 25).toString());
  });

  test('Trophy Room modal renders locked and unlocked status with coin bounties', async ({ page }) => {
    // Unlock two achievements
    await page.evaluate(() => {
      const am = (window as unknown as { __ACHIEVEMENT_MANAGER__: { unlock: (id: string) => boolean } }).__ACHIEVEMENT_MANAGER__;
      am.unlock('first_win');
      am.unlock('coin_hoarder');
    });

    // Open Trophy Room
    await page.locator('#trophy-btn').click();

    // Verify modal is open and has correct counts
    const state = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isTrophiesOpen: boolean } }).__GAME_MANAGER__;
      const am = (window as unknown as {
        __ACHIEVEMENT_MANAGER__: {
          getUnlockedCount: () => number;
          getTotalCount: () => number;
          isUnlocked: (id: string) => boolean;
        };
      }).__ACHIEVEMENT_MANAGER__;

      return {
        isTrophiesOpen: gm.isTrophiesOpen,
        unlockedCount: am.getUnlockedCount(),
        totalCount: am.getTotalCount(),
        firstWinUnlocked: am.isUnlocked('first_win'),
        coinHoarderUnlocked: am.isUnlocked('coin_hoarder'),
        speedDemonUnlocked: am.isUnlocked('speed_demon')
      };
    });

    expect(state.isTrophiesOpen).toBe(true);
    expect(state.unlockedCount).toBe(2);
    expect(state.totalCount).toBe(12);
    expect(state.firstWinUnlocked).toBe(true);
    expect(state.coinHoarderUnlocked).toBe(true);
    expect(state.speedDemonUnlocked).toBe(false);
  });

  test('Achievement unlocks persist in localStorage across page reloads', async ({ page }) => {
    // Unlock an achievement
    await page.evaluate(() => {
      const am = (window as unknown as { __ACHIEVEMENT_MANAGER__: { unlock: (id: string) => boolean } }).__ACHIEVEMENT_MANAGER__;
      am.unlock('hard_bot_slayer');
    });

    // Reload page
    await page.reload();
    await page.waitForSelector('#game-canvas');

    // Verify persisted unlock
    const isUnlocked = await page.evaluate(() => {
      const am = (window as unknown as { __ACHIEVEMENT_MANAGER__: { isUnlocked: (id: string) => boolean } }).__ACHIEVEMENT_MANAGER__;
      return am.isUnlocked('hard_bot_slayer');
    });
    expect(isUnlocked).toBe(true);

    const trophyBadge = page.locator('#trophy-unlocked-count');
    await expect(trophyBadge).toHaveText('1/12');
  });
});
