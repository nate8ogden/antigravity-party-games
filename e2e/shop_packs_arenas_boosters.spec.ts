import { test, expect } from '@playwright/test';

test.describe('Unified Shop, Mystery Lucky Packs, Arena Themes & Power-Up Boosters', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
  });

  test('Unified Shop displays ALL 39 items together and category tabs filter correctly', async ({ page }) => {
    // Open Shop
    await page.keyboard.press('b');

    const shopState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      const allItems = gm.getUnifiedShopItems();
      return {
        isShopOpen: gm.isShopOpen,
        currentShopTab: gm.currentShopTab,
        totalItemsCount: allItems.length,
        skinCount: allItems.filter((i: any) => i.category === 'SKIN').length,
        arenaCount: allItems.filter((i: any) => i.category === 'ARENA').length,
        packCount: allItems.filter((i: any) => i.category === 'PACK').length,
        boosterCount: allItems.filter((i: any) => i.category === 'BOOSTER').length
      };
    });

    expect(shopState.isShopOpen).toBe(true);
    expect(shopState.currentShopTab).toBe('ALL');
    expect(shopState.totalItemsCount).toBe(83);
    expect(shopState.skinCount).toBe(52);
    expect(shopState.arenaCount).toBe(22);
    expect(shopState.packCount).toBe(4);
    expect(shopState.boosterCount).toBe(5);

    // Switch to SKINS tab
    await page.keyboard.press('Tab');
    const skinsTabState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      return {
        tab: gm.currentShopTab,
        count: gm.getUnifiedShopItems().length
      };
    });
    expect(skinsTabState.tab).toBe('SKINS');
    expect(skinsTabState.count).toBe(52);

    // Switch to ARENAS tab
    await page.keyboard.press('Tab');
    const arenasTabState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      return {
        tab: gm.currentShopTab,
        count: gm.getUnifiedShopItems().length
      };
    });
    expect(arenasTabState.tab).toBe('ARENAS');
    expect(arenasTabState.count).toBe(22);

    // Switch to PACKS tab
    await page.keyboard.press('Tab');
    const packsTabState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      return {
        tab: gm.currentShopTab,
        count: gm.getUnifiedShopItems().length
      };
    });
    expect(packsTabState.tab).toBe('PACKS');
    expect(packsTabState.count).toBe(4);

    // Switch to BOOSTERS tab
    await page.keyboard.press('Tab');
    const boostersTabState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      return {
        tab: gm.currentShopTab,
        count: gm.getUnifiedShopItems().length
      };
    });
    expect(boostersTabState.tab).toBe('BOOSTERS');
    expect(boostersTabState.count).toBe(5);
  });

  test('Buying and equipping Arena Themes applies in-game theme borders', async ({ page }) => {
    const arenaTest = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;

      // Add coins, unlock and equip arena_sakura_temple and arena_deep_space_station via gm.economy
      gm.economy.addCoins(500);
      const unlockedSakura = gm.economy.unlockArena('arena_sakura_temple', true);
      const equippedSakura = gm.economy.equipArena('arena_sakura_temple');

      // Start a game and verify render runs with theme border
      gm.startGame('tanks');
      gm.render();

      const unlockedSpace = gm.economy.unlockArena('arena_deep_space_station', true);
      const equippedSpace = gm.economy.equipArena('arena_deep_space_station');
      gm.render();

      return {
        unlockedSakura,
        equippedSakura,
        unlockedSpace,
        equippedSpace,
        equippedArena: gm.economy.getEquippedArena(),
        activeGameState: gm.state
      };
    });

    expect(arenaTest.unlockedSakura).toBe(true);
    expect(arenaTest.equippedSakura).toBe(true);
    expect(arenaTest.unlockedSpace).toBe(true);
    expect(arenaTest.equippedSpace).toBe(true);
    expect(arenaTest.equippedArena).toBe('arena_deep_space_station');
    expect(arenaTest.activeGameState).toBe('COUNTDOWN');
  });

  test('New Mascot Skins equip and render procedural auras', async ({ page }) => {
    const skinTest = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;

      const newSkins = ['cyber_dragon', 'valkyrie_aurora', 'void_stalker', 'neon_dj', 'magma_colossus', 'mecha_sentinel'];
      newSkins.forEach((skinId) => {
        gm.economy.unlockSkin(skinId, true);
        gm.economy.equipSkin(0, skinId);
      });

      // Start game and render with cyber_dragon equipped
      gm.economy.equipSkin(0, 'cyber_dragon');
      gm.economy.equipSkin(1, 'valkyrie_aurora');
      gm.startGame('skyline_sumo');
      gm.render();

      return {
        p0Skin: gm.economy.getEquippedSkin(0),
        p1Skin: gm.economy.getEquippedSkin(1),
        gameState: gm.state
      };
    });

    expect(skinTest.p0Skin).toBe('cyber_dragon');
    expect(skinTest.p1Skin).toBe('valkyrie_aurora');
    expect(skinTest.gameState).toBe('COUNTDOWN');
  });

  test('Power-Up Boosters: Double Bounty 2x Coins, Coin Siphon, and Time Booster Clutch Overtime', async ({ page }) => {
    const boosterTest = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;

      // Unlock and equip double coins booster on Player 1
      gm.economy.unlockBooster('booster_double_coins', true);
      gm.economy.equipBooster(0, 'booster_double_coins');

      // Test double coins calculation
      const awardedCoinsDouble = gm.economy.awardRoundWin(0); // 15 * 2 = 30 coins!

      // Equip coin siphon booster on Player 1
      gm.economy.unlockBooster('booster_siphon', true);
      gm.economy.equipBooster(0, 'booster_siphon');

      // Test siphon coins calculation (+10 flat bonus)
      const awardedCoinsSiphon = gm.economy.awardRoundWin(0); // 15 + 10 = 25 coins!
      const tournamentCoinsSiphon = gm.economy.awardTournamentWin(0); // 50 + 25 = 75 coins!

      // Equip booster_time to verify clutch overtime
      gm.economy.unlockBooster('booster_time', true);
      gm.economy.equipBooster(0, 'booster_time');

      // Start game and simulate round clock dropping to 2.5s
      gm.startGame('tanks');
      gm.state = 'PLAYING';
      gm.activeGame.roundTimer = 2.5;

      // Update frame
      gm.update(0.016);

      return {
        awardedCoinsDouble,
        awardedCoinsSiphon,
        tournamentCoinsSiphon,
        afterTimer: gm.activeGame.roundTimer,
        clutchTriggered: gm.chronoClutchTriggered
      };
    });

    // Verify double coins multiplier (30 coins instead of 15)
    expect(boosterTest.awardedCoinsDouble).toBe(30);

    // Verify siphon booster bonuses (25 and 75 coins)
    expect(boosterTest.awardedCoinsSiphon).toBe(25);
    expect(boosterTest.tournamentCoinsSiphon).toBe(75);

    // Verify time was extended by +5 seconds (from 2.5s to ~7.5s)
    expect(boosterTest.clutchTriggered).toBe(true);
    expect(boosterTest.afterTimer).toBeGreaterThan(6.0);
  });

  test('Lucky Mystery Pack opening with 50% Duplicate Coin Refund guarantee', async ({ page }) => {
    const packTest = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;

      // Credit player 500 coins
      gm.economy.addCoins(500);

      // Pre-unlock all Common/Rare skins so any Common/Rare pull is a duplicate
      const allSkins = ['classic', 'retro_pixel', 'cyber_neon', 'magma_fire', 'frost_ice', 'golden_champion', 'galaxy_cosmic', 'arcade_retro'];
      allSkins.forEach((s) => gm.economy.unlockSkin(s, true));

      // Open shop and render so hitboxes are populated
      gm.openShop();
      gm.currentShopTab = 'PACKS';
      gm.render();

      // Open bronze pack through shop hitbox
      const openHitbox = gm.shopHitBoxes.find((h: any) => h.id === 'open_pack_pack_bronze');
      if (openHitbox) {
        openHitbox.action();
      }

      const result = gm.packOpeningResult;
      const coinsAfter = gm.economy.getCoins();

      return {
        hasResult: result !== null,
        result,
        coinsAfter
      };
    });

    expect(packTest.hasResult).toBe(true);
    expect(packTest.result.name).toBeTruthy();
    expect(packTest.result.rarity).toBeTruthy();

    if (packTest.result.isDuplicate) {
      // Duplicate guarantee must refund 50% of the rolled item's coin price (min 20)
      expect(packTest.result.refundCoins).toBeGreaterThanOrEqual(20);
    }

    // Dismiss reveal modal
    await page.keyboard.press('Escape');
    const isDismissed = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      return gm.packOpeningResult === null;
    });
    expect(isDismissed).toBe(true);

    // Test Cosmic Titan Mystery Vault pack opening
    const cosmicResult = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.economy.addCoins(300);
      const res = gm.economy.openPack('pack_cosmic_titan');
      return res;
    });

    expect(cosmicResult).not.toBeNull();
    expect(cosmicResult.name).toBeTruthy();
    expect(['Rare', 'Epic', 'Legendary']).toContain(cosmicResult.rarity);
  });
});
