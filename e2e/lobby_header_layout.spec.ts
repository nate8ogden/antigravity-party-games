import { test, expect } from '@playwright/test';

test.describe('Lobby Header Layout & Trophy Button Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    // Ensure lobby is ready and rendered
    await page.waitForTimeout(500);
  });

  test('Header pills are separated across left and right with open center channel', async ({ page }) => {
    const layout = await page.evaluate(() => {
      const gm = (window as unknown as {
        __GAME_MANAGER__: {
          shopLobbyBannerHitbox: { x: number; y: number; w: number; h: number } | null;
          trophyLobbyBannerHitbox: { x: number; y: number; w: number; h: number } | null;
          shopCoinBadgeHitbox: { x: number; y: number; w: number; h: number } | null;
          logicalWidth: number;
        };
      }).__GAME_MANAGER__;

      return {
        shop: gm.shopLobbyBannerHitbox,
        trophy: gm.trophyLobbyBannerHitbox,
        coin: gm.shopCoinBadgeHitbox,
        width: gm.logicalWidth,
      };
    });

    expect(layout.shop).not.toBeNull();
    expect(layout.trophy).not.toBeNull();
    expect(layout.coin).not.toBeNull();

    const shopRight = layout.shop!.x + layout.shop!.w;
    const trophyLeft = layout.trophy!.x;
    const trophyRight = layout.trophy!.x + layout.trophy!.w;
    const coinLeft = layout.coin!.x;

    // Verify shop is on the left
    expect(layout.shop!.x).toBeLessThanOrEqual(20);

    // Verify trophy is to the left of coins badge
    expect(trophyRight).toBeLessThan(coinLeft);

    // Verify there is a wide open center channel (> 350px) between shop and trophies for the title text
    const centerClearance = trophyLeft - shopRight;
    expect(centerClearance).toBeGreaterThan(350);

    // Verify no overlapping hitboxes
    expect(shopRight).toBeLessThan(trophyLeft);
  });

  test('Clicking the canvas Trophy pill opens the Trophy Room', async ({ page }) => {
    // Initial state
    let isTrophiesOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isTrophiesOpen: boolean } }).__GAME_MANAGER__;
      return gm.isTrophiesOpen;
    });
    expect(isTrophiesOpen).toBe(false);

    // Get the canvas bounding box and the trophy hitbox
    const canvas = page.locator('#game-canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    const trophyBox = await page.evaluate(() => {
      const gm = (window as unknown as {
        __GAME_MANAGER__: {
          trophyLobbyBannerHitbox: { x: number; y: number; w: number; h: number } | null;
          logicalWidth: number;
          logicalHeight: number;
        };
      }).__GAME_MANAGER__;
      return {
        hitbox: gm.trophyLobbyBannerHitbox,
        logicalWidth: gm.logicalWidth,
        logicalHeight: gm.logicalHeight,
      };
    });

    expect(trophyBox.hitbox).not.toBeNull();

    // Calculate canvas click position scaled to viewport
    const scaleX = canvasBox!.width / trophyBox.logicalWidth;
    const scaleY = canvasBox!.height / trophyBox.logicalHeight;
    const clickX = canvasBox!.x + (trophyBox.hitbox!.x + trophyBox.hitbox!.w / 2) * scaleX;
    const clickY = canvasBox!.y + (trophyBox.hitbox!.y + trophyBox.hitbox!.h / 2) * scaleY;

    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(200);

    isTrophiesOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isTrophiesOpen: boolean } }).__GAME_MANAGER__;
      return gm.isTrophiesOpen;
    });
    expect(isTrophiesOpen).toBe(true);

    // Close with Escape
    await page.keyboard.press('Escape');
    isTrophiesOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isTrophiesOpen: boolean } }).__GAME_MANAGER__;
      return gm.isTrophiesOpen;
    });
    expect(isTrophiesOpen).toBe(false);
  });

  test('Clicking the canvas Skins & Shop pill opens the Locker Shop', async ({ page }) => {
    // Initial state
    let isShopOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isShopOpen: boolean } }).__GAME_MANAGER__;
      return gm.isShopOpen;
    });
    expect(isShopOpen).toBe(false);

    const canvas = page.locator('#game-canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    const shopBox = await page.evaluate(() => {
      const gm = (window as unknown as {
        __GAME_MANAGER__: {
          shopLobbyBannerHitbox: { x: number; y: number; w: number; h: number } | null;
          logicalWidth: number;
          logicalHeight: number;
        };
      }).__GAME_MANAGER__;
      return {
        hitbox: gm.shopLobbyBannerHitbox,
        logicalWidth: gm.logicalWidth,
        logicalHeight: gm.logicalHeight,
      };
    });

    expect(shopBox.hitbox).not.toBeNull();

    const scaleX = canvasBox!.width / shopBox.logicalWidth;
    const scaleY = canvasBox!.height / shopBox.logicalHeight;
    const clickX = canvasBox!.x + (shopBox.hitbox!.x + shopBox.hitbox!.w / 2) * scaleX;
    const clickY = canvasBox!.y + (shopBox.hitbox!.y + shopBox.hitbox!.h / 2) * scaleY;

    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(200);

    isShopOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isShopOpen: boolean } }).__GAME_MANAGER__;
      return gm.isShopOpen;
    });
    expect(isShopOpen).toBe(true);

    // Close with Escape
    await page.keyboard.press('Escape');
    isShopOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: { isShopOpen: boolean } }).__GAME_MANAGER__;
      return gm.isShopOpen;
    });
    expect(isShopOpen).toBe(false);
  });
});
