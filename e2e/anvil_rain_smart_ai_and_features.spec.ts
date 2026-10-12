import { test, expect } from '@playwright/test';

test.describe('Anvil Rain - Smart Bot AI, Hard Hat Helmets, Body-Checks, & Dynamic Hazards', () => {
  test('Runners start with Hard Hats: first crush deflects with CLANG and saves life, second crush squashes', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const helmetData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('anvil_rain');
      gm.state = 'PLAYING';
      const game = gm.activeGame as any;
      const w = gm.logicalWidth;
      const h = gm.logicalHeight;

      const p1 = game.runners.get(0);
      const initialHasHelmet = p1.hasHelmet;
      const initialAlive = p1.alive;

      // Drop an anvil directly on P1
      const anvil1 = {
        id: 9991,
        type: 'normal',
        x: p1.x,
        y: p1.y,
        altitude: 10,
        warningTime: 0.01,
        initialWarning: 1.0,
        radius: 28,
        landed: false,
        fadeTimer: 0.65
      };
      game.anvils.push(anvil1);

      // Advance update so anvil lands on P1
      game.update(0.02, w, h);

      const hasHelmetAfterHit1 = p1.hasHelmet;
      const aliveAfterHit1 = p1.alive;
      const invulnerableAfterHit1 = p1.invulnerableTimer > 0;
      const flyingHelmetsCount = game.flyingHelmets.length;

      // Remove invulnerability
      p1.invulnerableTimer = 0;

      // Drop a second anvil directly on P1 now that helmet is gone
      const anvil2 = {
        id: 9992,
        type: 'normal',
        x: p1.x,
        y: p1.y,
        altitude: 10,
        warningTime: 0.01,
        initialWarning: 1.0,
        radius: 28,
        landed: false,
        fadeTimer: 0.65
      };
      game.anvils.push(anvil2);

      // Advance update so 2nd anvil lands
      game.update(0.02, w, h);

      const aliveAfterHit2 = p1.alive;
      const isEliminated = game.eliminationOrder.includes(0);

      return {
        initialHasHelmet,
        initialAlive,
        hasHelmetAfterHit1,
        aliveAfterHit1,
        invulnerableAfterHit1,
        flyingHelmetsCount,
        aliveAfterHit2,
        isEliminated
      };
    });

    expect(pageErrors).toEqual([]);
    expect(helmetData.initialHasHelmet).toBe(true);
    expect(helmetData.initialAlive).toBe(true);

    // Hit 1: Helmet saves player!
    expect(helmetData.hasHelmetAfterHit1).toBe(false);
    expect(helmetData.aliveAfterHit1).toBe(true);
    expect(helmetData.invulnerableAfterHit1).toBe(true);
    expect(helmetData.flyingHelmetsCount).toBeGreaterThanOrEqual(1);

    // Hit 2: Squashed!
    expect(helmetData.aliveAfterHit2).toBe(false);
    expect(helmetData.isEliminated).toBe(true);
  });

  test('Body-Check Shove: Dashing into an opponent knocks them back with stun', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const shoveData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('anvil_rain');
      gm.state = 'PLAYING';
      const game = gm.activeGame as any;
      const w = gm.logicalWidth;
      const h = gm.logicalHeight;

      const p1 = game.runners.get(0);
      const p2 = game.runners.get(1);

      // Position P1 right next to P2 and set P1 dashing towards P2
      p1.x = 200;
      p1.y = 200;
      p2.x = 225;
      p2.y = 200;
      p2.vx = 0;
      p2.vy = 0;
      p2.stunTimer = 0;

      p1.dashDuration = 0.2;
      p1.facingAngle = 0; // pointing directly right towards P2

      const p1InitialShoves = p1.shovesGiven;

      // Update to trigger body check collision
      game.update(0.016, w, h);

      return {
        p2VxAfterShove: p2.vx,
        p2Stunned: p2.stunTimer > 0,
        p1ShovesGiven: p1.shovesGiven,
        p1ShovesIncreased: p1.shovesGiven > p1InitialShoves,
        lastShovedById: p2.lastShovedById
      };
    });

    expect(shoveData.p2VxAfterShove).toBeGreaterThan(150);
    expect(shoveData.p2Stunned).toBe(true);
    expect(shoveData.p1ShovesIncreased).toBe(true);
    expect(shoveData.lastShovedById).toBe(0);
  });

  test('Bot AI actively evaluates danger and flees incoming anvil drop zones', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const botAiData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('anvil_rain');
      gm.state = 'PLAYING';
      const game = gm.activeGame as any;
      const w = gm.logicalWidth;
      const h = gm.logicalHeight;

      // P2 is bot_normal
      const bot = game.runners.get(1);
      bot.x = 400;
      bot.y = 300;
      bot.dashCooldown = 0;

      // Spawn an imminent anvil directly over bot's position
      game.anvils.push({
        id: 8888,
        type: 'normal',
        x: bot.x,
        y: bot.y,
        altitude: 100,
        warningTime: 0.35,
        initialWarning: 1.0,
        radius: 28,
        landed: false,
        fadeTimer: 0.65
      });

      // Run bot AI
      game.updateBotAI(0.016, 1, 'bot_normal', w, h);

      // Check bot inputs from input router
      const botInput = gm.input.getBotInput(1);
      const isFleeing = Math.hypot(botInput.steer, botInput.throttle) > 0.5;

      // Advance 10 physics frames and verify bot moved away from the anvil center
      for (let f = 0; f < 10; f++) {
        game.update(0.016, w, h);
      }

      const distFromAnvil = Math.hypot(bot.x - 400, bot.y - 300);

      return {
        botInput,
        isFleeing,
        distFromAnvil
      };
    });

    expect(botAiData.isFleeing).toBe(true);
    expect(botAiData.distFromAnvil).toBeGreaterThan(18); // Bot actively ran away!
  });

  test('Hard Hat and Speed pickups spawn and can be collected', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const pickupData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('anvil_rain');
      gm.state = 'PLAYING';
      const game = gm.activeGame as any;
      const w = gm.logicalWidth;
      const h = gm.logicalHeight;

      const p1 = game.runners.get(0);
      p1.hasHelmet = false; // Player lost helmet
      p1.speedBoostTimer = 0;

      // Spawn helmet right on top of P1
      game.powerups.push({
        id: 7771,
        type: 'helmet',
        x: p1.x,
        y: p1.y,
        life: 10
      });

      game.update(0.016, w, h);
      const helmetRestored = p1.hasHelmet;

      // Spawn speed sneakers right on top of P1
      game.powerups.push({
        id: 7772,
        type: 'speed',
        x: p1.x,
        y: p1.y,
        life: 10
      });

      game.update(0.016, w, h);
      const speedBoostActive = p1.speedBoostTimer > 0;

      return {
        helmetRestored,
        speedBoostActive
      };
    });

    expect(pickupData.helmetRestored).toBe(true);
    expect(pickupData.speedBoostActive).toBe(true);
  });
});
