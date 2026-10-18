import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = './mobile-test-artifacts';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function runMobileAudit() {
  console.log('--- STARTING MOBILE EMULATOR AUDIT ---');
  const browser = await chromium.launch();
  
  const testDevices = [
    { name: 'Google Pixel 7 (Android)', profile: devices['Pixel 7'] },
    { name: 'Apple iPhone 14 (iOS)', profile: devices['iPhone 14'] }
  ];

  const results = {};

  for (const { name, profile } of testDevices) {
    console.log(`\nTesting on ${name}...`);
    const context = await browser.newContext({
      ...profile,
      baseURL: 'http://localhost:5173'
    });

    const page = await context.newPage();
    const consoleErrors = [];
    const consoleWarnings = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });

    // 1. Visit root URL
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Check deviceMode on initial load without user intervention
    const initialDeviceMode = await page.evaluate(() => {
      const gm = (window).__GAME_MANAGER__;
      return {
        deviceMode: gm?.deviceMode,
        bodyClasses: document.body.className,
        btnPhoneActive: document.getElementById('btn-mode-phone')?.classList.contains('active'),
        btnCompActive: document.getElementById('btn-mode-computer')?.classList.contains('active'),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        dpr: window.devicePixelRatio,
        userAgent: navigator.userAgent
      };
    });

    const devSlug = name.includes('Pixel') ? 'pixel7' : 'iphone14';
    await page.screenshot({ path: path.join(outDir, `${devSlug}-1-lobby-initial.png`) });

    // 2. Switch to Phone Mode explicitly (or test if button works)
    const phoneBtn = page.locator('#btn-mode-phone');
    if (await phoneBtn.isVisible()) {
      await phoneBtn.click();
      await page.waitForTimeout(500);
    }

    const postSwitchMode = await page.evaluate(() => {
      const gm = (window).__GAME_MANAGER__;
      return {
        deviceMode: gm?.deviceMode,
        bodyClasses: document.body.className
      };
    });

    await page.screenshot({ path: path.join(outDir, `${devSlug}-2-lobby-phone-mode.png`) });

    // 3. Test Game Launch: Cyber Tanks in 2-Player Mode on Phone
    console.log(`Launching Cyber Tanks (2P Face-to-Face) on ${name}...`);
    await page.goto('/?game=tanks&players=2&device=phone');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      (window).__GAME_MANAGER__?.setDeviceMode('phone');
    });
    await page.waitForTimeout(1000);

    const gameModeInfo = await page.evaluate(() => {
      const gm = (window).__GAME_MANAGER__;
      const ir = gm?.input;
      return {
        active: gm?.activeGame !== null,
        gameId: gm?.activeGame?.constructor?.name,
        deviceMode: gm?.deviceMode,
        inputDeviceMode: ir?.deviceMode,
        phoneTouchLayout: ir?.phoneTouchLayout,
        canvasWidth: gm?.canvas?.width,
        canvasHeight: gm?.canvas?.height,
        logicalWidth: gm?.logicalWidth,
        logicalHeight: gm?.logicalHeight
      };
    });

    await page.screenshot({ path: path.join(outDir, `${devSlug}-3-tanks-2p-ingame.png`) });

    // Test Multi-touch inputs: Player 1 (bottom) and Player 2 (top) simultaneously
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    if (box) {
      // Touch bottom (P1) and top (P2)
      await page.touchscreen.tap(box.x + box.width * 0.25, box.y + box.height * 0.85); // P1 joystick area
      await page.touchscreen.tap(box.x + box.width * 0.25, box.y + box.height * 0.15); // P2 action/joystick area
      await page.waitForTimeout(500);
    }

    // 4. Test Single Button Game: Skyline Sumo on Phone
    console.log(`Launching Skyline Sumo on ${name}...`);
    await page.goto('/?game=skyline_sumo&players=2&device=phone');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      (window).__GAME_MANAGER__?.setDeviceMode('phone');
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, `${devSlug}-4-sumo-2p-ingame.png`) });

    // 5. Test 4-Player Corner Touch Layout on Phone
    console.log(`Launching Micro GP (4P Phone Corners) on ${name}...`);
    await page.goto('/?game=micro_gp&players=4&device=phone');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      (window).__GAME_MANAGER__?.setDeviceMode('phone');
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, `${devSlug}-5-microgp-4p-corners.png`) });

    // 6. Test Phone-Exclusive / Tabletop game: Swipe Ninja Blitz
    console.log(`Launching Swipe Ninja Blitz on ${name}...`);
    await page.goto('/?game=swipe_ninja_blitz&players=2&device=phone');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      (window).__GAME_MANAGER__?.setDeviceMode('phone');
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, `${devSlug}-6-swipe-ninja.png`) });

    results[name] = {
      initialDeviceMode,
      postSwitchMode,
      gameModeInfo,
      consoleErrors,
      consoleWarnings
    };

    await context.close();
  }

  await browser.close();

  fs.writeFileSync(path.join(outDir, 'mobile-audit-report.json'), JSON.stringify(results, null, 2));
  console.log('\n--- AUDIT COMPLETE ---');
  console.log(JSON.stringify(results, null, 2));
}

runMobileAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
