import { chromium } from 'playwright';

async function testShopFeatures() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // Press 'b' or click shop banner to open shop
  await page.keyboard.press('KeyB');
  await page.waitForTimeout(500);

  // Take screenshot of shop modal
  await page.screenshot({ path: 'test_shop_open.png' });
  console.log('Saved test_shop_open.png');

  // Verify __GAME_STATE__
  const gameState = await page.evaluate(() => {
    const w = window;
    return w.__GAME_STATE__;
  });
  console.log('Game state isShopOpen:', gameState ? (gameState as any).isShopOpen : 'unknown');

  // Cycle through tabs with Tab key
  await page.keyboard.press('Tab'); // SKINS
  await page.waitForTimeout(200);
  await page.keyboard.press('Tab'); // ARENAS
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test_shop_arenas.png' });
  console.log('Saved test_shop_arenas.png');

  await page.keyboard.press('Tab'); // PACKS
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test_shop_packs.png' });
  console.log('Saved test_shop_packs.png');

  // Open pack by simulating openPack call
  await page.evaluate(() => {
    const gm = (window as any).gameManager;
    if (gm) {
      const curItem = gm.getUnifiedShopItems().find((i: any) => i.id === 'pack_standard');
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

  await browser.close();
}

testShopFeatures().catch(console.error);
