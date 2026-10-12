const { chromium } = require('playwright');

async function testBeeGame() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // Launch honeybee_nectar_relay game
  await page.evaluate(() => {
    const gm = window.__GAME_MANAGER__;
    if (gm) {
      gm.startGame('honeybee_nectar_relay');
    }
  });

  // Wait for countdown to finish and game to start
  await page.waitForTimeout(3500);

  // Take initial screenshot of meadow and bloomed wildflowers
  await page.screenshot({ path: 'test_bee_meadow.png' });
  console.log('Saved test_bee_meadow.png');

  // Move P1 towards the center flower
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');

  // Hold Space for Turbo Sip
  await page.keyboard.down('Space');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test_bee_sipping.png' });
  console.log('Saved test_bee_sipping.png');

  await page.keyboard.up('Space');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test_bee_carrying.png' });
  console.log('Saved test_bee_carrying.png');

  await browser.close();
  console.log('Test completed successfully!');
}

testBeeGame().catch(console.error);
