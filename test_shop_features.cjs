const { chromium } = require('playwright');

async function testShopFeatures() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // Press 'b' to open shop
  await page.keyboard.press('KeyB');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test_shop_open.png' });
  console.log('Saved test_shop_open.png');

  // Tab to ARENAS
  await page.keyboard.press('Tab'); // SKINS
  await page.waitForTimeout(300);
  await page.keyboard.press('Tab'); // ARENAS
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test_shop_arenas.png' });
  console.log('Saved test_shop_arenas.png');

  // Tab to PACKS
  await page.keyboard.press('Tab'); // PACKS
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test_shop_packs.png' });
  console.log('Saved test_shop_packs.png');

  // Trigger pack opening
  await page.evaluate(() => {
    const gm = window.__GAME_MANAGER__;
    if (gm) {
      const curItem = gm.getUnifiedShopItems().find(i => i.id === 'pack_bronze');
      if (curItem) {
        const res = gm.economy.openPack(curItem.id);
        if (res) gm.startPackOpeningAnimation(curItem, res);
      }
    }
  });

  // Wait 1.0s into the vibrating shake phase
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test_pack_shaking.png' });
  console.log('Saved test_pack_shaking.png');

  // Wait 2.2s into the card reveal phase
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'test_pack_reveal.png' });
  console.log('Saved test_pack_reveal.png');

  // Dismiss pack reveal and close shop
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Equip boosters and arena via evaluate, then launch a game
  await page.evaluate(() => {
    const gm = window.__GAME_MANAGER__;
    if (gm) {
      gm.economy.unlockBooster('booster_shield', true);
      gm.economy.unlockBooster('booster_turbo', true);
      gm.economy.equipBooster(0, 'booster_shield');
      gm.economy.equipBooster(1, 'booster_turbo');
      gm.economy.unlockArena('arena_neon_synth', true);
      gm.economy.equipArena('arena_neon_synth');
      gm.startGame('tanks');
    }
  });

  await page.waitForTimeout(1500); // During countdown / play
  await page.screenshot({ path: 'test_in_game_boosters.png' });
  console.log('Saved test_in_game_boosters.png');

  await browser.close();
  console.log('Test completed successfully!');
}

testShopFeatures().catch(console.error);
