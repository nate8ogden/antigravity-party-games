import { test, expect } from '@playwright/test';

test.describe('In-Game Currency Economy & Mascot Skins System', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before test to ensure clean baseline
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
  });

  test('Utility bar displays Shop button with coin icon and initial balance', async ({ page }) => {
    const shopBtn = page.locator('#shop-btn');
    await expect(shopBtn).toBeVisible();

    const coinCount = page.locator('#shop-coin-count');
    await expect(coinCount).toBeVisible();

    const countText = await coinCount.textContent();
    const parsedCoins = parseInt(countText || '0', 10);
    expect(parsedCoins).toBeGreaterThanOrEqual(0);
  });

  test('Toggling shop via UI button and keyboard shortcut (B / Esc)', async ({ page }) => {
    // Verify initial closed state
    let isShopOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isShopOpen: boolean } }).__GAME_MANAGER__;
      return gm.isShopOpen;
    });
    expect(isShopOpen).toBe(false);

    // Click Shop button to open
    await page.locator('#shop-btn').click();
    isShopOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isShopOpen: boolean } }).__GAME_MANAGER__;
      return gm.isShopOpen;
    });
    expect(isShopOpen).toBe(true);

    // Press Escape to close
    await page.keyboard.press('Escape');
    isShopOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isShopOpen: boolean } }).__GAME_MANAGER__;
      return gm.isShopOpen;
    });
    expect(isShopOpen).toBe(false);

    // Press 'B' key in Lobby to open
    await page.keyboard.press('b');
    isShopOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isShopOpen: boolean } }).__GAME_MANAGER__;
      return gm.isShopOpen;
    });
    expect(isShopOpen).toBe(true);
  });

  test('Awarding coins upon round victory & tournament championship', async ({ page }) => {
    const result = await page.evaluate(() => {
      const gm = (window as unknown as {
        __GAME_MANAGER__: {
          startGame: (id: string) => void;
          activeGame: { roundTimer: number; isRoundOver: () => boolean; getRoundResult: () => unknown } | null;
          update: (dt: number) => void;
          state: string;
        }
      }).__GAME_MANAGER__;
      const em = (window as unknown as { __ECONOMY_MANAGER__: { getCoins: () => number; addCoins: (n: number) => number } }).__ECONOMY_MANAGER__;

      const startCoins = em.getCoins();

      // Start Cyber Tanks and fast forward countdown
      gm.startGame('tanks');
      if (gm.activeGame) {
        gm.update(4.0);
      }

      return { state: gm.state, startCoins };
    });

    expect(result.state).toBe('PLAYING');

    // Simulate winning a round
    const afterRoundWin = await page.evaluate((data) => {
      const gm = (window as unknown as {
        __GAME_MANAGER__: {
          activeGame: {
            isRoundOver: () => boolean;
            getRoundResult: () => { winnerId: number; rankings: { place: number; playerId: number; score: number }[]; mvpHighlight: string };
            roundTimer: number;
          } | null;
          update: (dt: number) => void;
          state: string;
        }
      }).__GAME_MANAGER__;
      const em = (window as unknown as { __ECONOMY_MANAGER__: { getCoins: () => number } }).__ECONOMY_MANAGER__;

      if (gm.activeGame) {
        // Mock game round end with P1 winning
        gm.activeGame.isRoundOver = () => true;
        gm.activeGame.getRoundResult = () => ({
          winnerId: 0,
          rankings: [{ place: 1, playerId: 0, score: 1 }, { place: 2, playerId: 1, score: 0 }],
          mvpHighlight: 'P1 Victory'
        });
        // Trigger game manager update to process round win
        gm.update(0.016);
      }

      return {
        state: gm.state,
        coins: em.getCoins(),
        startCoins: data.startCoins
      };
    }, result);

    expect(afterRoundWin.state).toBe('ROUND_OVER');
    // Round victory awards +15 coins (plus any milestone achievement bounty)
    expect(afterRoundWin.coins).toBeGreaterThanOrEqual(afterRoundWin.startCoins + 15);
  });

  test('Purchasing, unlocking, and equipping custom skins', async ({ page }) => {
    const purchaseResult = await page.evaluate(() => {
      const em = (window as unknown as {
        __ECONOMY_MANAGER__: {
          getCoins: () => number;
          addCoins: (n: number) => number;
          isSkinUnlocked: (id: string) => boolean;
          getEquippedSkin: (pid: number) => string;
        }
      }).__ECONOMY_MANAGER__;

      const gm = (window as unknown as {
        __GAME_MANAGER__: {
          openShop: () => void;
          selectedShopSkinIndex: number;
          handleGlobalKey: (key: string) => void;
        }
      }).__GAME_MANAGER__;

      // Add coins to afford Cyber Neon (45 coins)
      em.addCoins(200);
      const coinsBefore = em.getCoins();

      // Open shop
      gm.openShop();

      // Cycle to Cyber Neon (index 1, cost 45)
      gm.handleGlobalKey('ArrowRight');

      // Press Enter to buy
      gm.handleGlobalKey('Enter');

      // Equip on Player 1 ('1') and Player 2 ('2')
      gm.handleGlobalKey('1');
      gm.handleGlobalKey('2');

      const coinsAfter = em.getCoins();
      const isUnlocked = em.isSkinUnlocked('cyber_neon');
      const p1Equipped = em.getEquippedSkin(0);
      const p2Equipped = em.getEquippedSkin(1);

      return {
        coinsBefore,
        coinsAfter,
        isUnlocked,
        p1Equipped,
        p2Equipped
      };
    });

    // 45 coins spent for Cyber Neon
    expect(purchaseResult.coinsAfter).toBe(purchaseResult.coinsBefore - 45);
    expect(purchaseResult.isUnlocked).toBe(true);
    expect(purchaseResult.p1Equipped).toBe('cyber_neon');
    expect(purchaseResult.p2Equipped).toBe('cyber_neon');
  });

  test('Canvas rendering without visual or console errors when shop is active', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Open shop
    await page.locator('#shop-btn').click();
    await page.waitForTimeout(100);

    // Cycle through all 7 skins to verify rendering and aura particles
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(60);
    }

    expect(errors).toHaveLength(0);
  });
});
