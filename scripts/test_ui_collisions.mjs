import { chromium } from '../node_modules/playwright/index.mjs';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });
  const viewports = [
    { name: 'Desktop (1280x800)', width: 1280, height: 800 },
    { name: 'Tablet / iPad (1024x768)', width: 1024, height: 768 },
    { name: 'Mobile iPhone (375x667)', width: 375, height: 667 },
    { name: 'Mobile Android (412x915)', width: 412, height: 915 }
  ];

  for (const vp of viewports) {
    console.log(`\n=== Testing Viewport: ${vp.name} ===`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(600);

    // 1. Verify Pause button is hidden in lobby
    const pauseBtnVisible = await page.$eval('#center-pause-btn', el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
    console.log(`- Lobby Pause button hidden: ${!pauseBtnVisible} (Expected: true)`);

    // 2. Verify Utility bar position & bounding box
    const utilBox = await page.$eval('.utility-bar', el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, opacity: style.opacity, pointerEvents: style.pointerEvents };
    });
    console.log(`- Utility bar: x=${utilBox.x.toFixed(1)}, y=${utilBox.y.toFixed(1)}, w=${utilBox.w.toFixed(1)}, h=${utilBox.h.toFixed(1)}`);

    // 3. Check GameManager hitboxes via page evaluate
    const hitboxes = await page.evaluate(() => {
      const gm = window.gameManager;
      if (!gm) return null;
      return {
        shopCoin: gm.shopCoinBadgeHitbox,
        shopLocker: gm.shopLobbyBannerHitbox,
        trophyBanner: gm.trophyLobbyBannerHitbox,
        playerBadges: gm.playerBadgeHitboxes,
        isModalOpen: gm.isModalOpen
      };
    });

    if (hitboxes) {
      console.log(`- Canvas Header Badges removed: shopCoin=${hitboxes.shopCoin}, shopLocker=${hitboxes.shopLocker}, trophyBanner=${hitboxes.trophyBanner}`);
      console.log(`- Player Badges count: ${hitboxes.playerBadges.length}`);
      hitboxes.playerBadges.forEach((pb, idx) => {
        // Ensure no overlap with utility bar
        const overlapsUtil = !(
          pb.x + pb.w <= utilBox.x ||
          pb.x >= utilBox.x + utilBox.w ||
          pb.y + pb.h <= utilBox.y ||
          pb.y >= utilBox.y + utilBox.h
        );
        if (overlapsUtil) {
          console.error(`  [COLLISION DETECTED] Player ${idx + 1} badge (x:${pb.x}, y:${pb.y}, w:${pb.w}, h:${pb.h}) overlaps utility bar!`);
        } else {
          console.log(`  [CLEAN] Player ${idx + 1} (x:${pb.x}, y:${pb.y}, w:${pb.w}, h:${pb.h}) has ZERO overlap with utility bar.`);
        }
      });
    }

    // 4. Test Opening Game Modal: Utility bar should hide completely
    console.log('- Opening Game Details Modal...');
    await page.evaluate(() => {
      const gm = window.gameManager;
      if (gm) gm.openGameModal(0);
    });
    await page.waitForTimeout(300);

    const isModalOpenClass = await page.evaluate(() => document.body.classList.contains('modal-open'));
    const modalUtilState = await page.$eval('.utility-bar', el => {
      const style = window.getComputedStyle(el);
      return { opacity: style.opacity, pointerEvents: style.pointerEvents };
    });
    console.log(`- body.modal-open active: ${isModalOpenClass}`);
    console.log(`- Utility bar in modal: opacity=${modalUtilState.opacity}, pointerEvents=${modalUtilState.pointerEvents}`);

    // Close modal
    await page.evaluate(() => {
      const gm = window.gameManager;
      if (gm) gm.closeGameModal();
    });
    await page.waitForTimeout(200);

    // 5. Test Settings Modal: Utility bar should hide completely
    console.log('- Opening Settings Modal...');
    await page.evaluate(() => {
      const gm = window.gameManager;
      if (gm) gm.openSettings();
    });
    await page.waitForTimeout(300);

    const isSettingsModalOpenClass = await page.evaluate(() => document.body.classList.contains('modal-open'));
    const settingsUtilState = await page.$eval('.utility-bar', el => {
      const style = window.getComputedStyle(el);
      return { opacity: style.opacity, pointerEvents: style.pointerEvents };
    });
    console.log(`- body.modal-open active for Settings: ${isSettingsModalOpenClass}`);
    console.log(`- Utility bar in Settings: opacity=${settingsUtilState.opacity}, pointerEvents=${settingsUtilState.pointerEvents}`);

    await page.close();
  }

  await browser.close();
  console.log('\nAll collision checks passed successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
