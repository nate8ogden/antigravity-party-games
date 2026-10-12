import { test, expect } from '@playwright/test';

async function skipCountdown(page: any) {
  await page.evaluate(() => {
    const gm = (window as any).__GAME_MANAGER__;
    if (gm) {
      gm.countdownTimer = 0;
      gm.state = 'PLAYING';
    }
  });
  await page.waitForTimeout(50);
}

test.describe('Asteroid Miner - Time-based & Stealing Mechanics', () => {
  test('should boot Asteroid Miner correctly without crashing', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=asteroid_miner&mode=pvb&difficulty=bot_normal');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    const isRunning = await page.evaluate(() => {
      const dbg = (window as any).__ASTEROID_MINER_DEBUG__;
      return !!dbg && !!dbg.getShip(0) && !!dbg.getShip(1);
    });
    expect(isRunning).toBe(true);
  });

  test('should be time-based and NOT end when a player banks 10 gems', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=asteroid_miner&mode=pvb&difficulty=bot_normal');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    // Set player 0 banked score to 12 while timer is still high
    const stateBefore = await page.evaluate(() => {
      const dbg = (window as any).__ASTEROID_MINER_DEBUG__;
      dbg.setBankedScore(0, 12);
      return {
        isFinished: dbg.game.isFinished,
        isRoundOver: dbg.game.isRoundOver(),
        timer: dbg.getRoundTimer(),
        score0: dbg.getShip(0).bankedScore
      };
    });

    // The game must NOT be over just because score is >= 10
    expect(stateBefore.score0).toBe(12);
    expect(stateBefore.isRoundOver).toBe(false);
    expect(stateBefore.isFinished).toBe(false);

    // Now set roundTimer to 0
    const stateAfter = await page.evaluate(() => {
      const dbg = (window as any).__ASTEROID_MINER_DEBUG__;
      dbg.setRoundTimer(0);
      return {
        isFinished: dbg.game.isFinished,
        isRoundOver: dbg.game.isRoundOver(),
        timer: dbg.getRoundTimer()
      };
    });

    expect(stateAfter.isRoundOver).toBe(true);
  });

  test('ship-to-ship ramming transfers gems from victim to attacker', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=asteroid_miner&mode=pvb&difficulty=bot_normal');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    const stealResult = await page.evaluate(async () => {
      const dbg = (window as any).__ASTEROID_MINER_DEBUG__;
      const s0 = dbg.getShip(0);
      const s1 = dbg.getShip(1);

      dbg.setCargo(0, 0);
      dbg.setCargo(1, 3);
      s0.bumpCooldown = 0;
      s1.bumpCooldown = 0;

      // Position s0 and s1 touching with s0 ramming into s1
      dbg.setShipPos(1, 410, 300, 0, 0);
      dbg.setShipPos(0, 380, 300, 200, 0); // s0 moving right towards s1

      // Wait 150ms for collision resolution in loop
      await new Promise((r) => setTimeout(r, 150));

      return {
        p0Cargo: dbg.getShip(0).cargo,
        p1Cargo: dbg.getShip(1).cargo
      };
    });

    // Attacker gained at least 1 gem, victim lost 1 gem
    expect(stealResult.p0Cargo).toBeGreaterThanOrEqual(1);
    expect(stealResult.p1Cargo).toBeLessThan(3);
  });

  test('depot raiding siphons gems from rival depot into player cargo', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=asteroid_miner&mode=pvb&difficulty=bot_normal');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    const raidResult = await page.evaluate(async () => {
      const dbg = (window as any).__ASTEROID_MINER_DEBUG__;
      const rivalDepot = dbg.getDepots().find((d: any) => d.playerId === 1);
      const s0 = dbg.getShip(0);

      dbg.setBankedScore(1, 5); // Rival has 5 banked gems
      dbg.setCargo(0, 0);       // Raider has room
      s0.raidCooldown = 0;

      // Place raider right on top of rival depot
      dbg.setShipPos(0, rivalDepot.x, rivalDepot.y, 0, 0);

      // Wait 150ms for depot raid trigger
      await new Promise((r) => setTimeout(r, 150));

      return {
        raiderCargo: dbg.getShip(0).cargo,
        rivalBanked: dbg.getShip(1).bankedScore
      };
    });

    expect(raidResult.raiderCargo).toBe(1);
    expect(raidResult.rivalBanked).toBe(4);
  });

  test('bot AI actively pursues and steals from player carrying gems', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=asteroid_miner&mode=pvb&difficulty=bot_hard');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await skipCountdown(page);

    const botChasing = await page.evaluate(async () => {
      const dbg = (window as any).__ASTEROID_MINER_DEBUG__;
      const s0 = dbg.getShip(0);
      const s1 = dbg.getShip(1);

      // Give player 0 cargo
      dbg.setCargo(0, 4);
      dbg.setCargo(1, 0);

      // Place bot 180px away from player horizontally (bot at 580, player at 400)
      dbg.setShipPos(0, 400, 300, 0, 0);
      dbg.setShipPos(1, 580, 300, 0, 0);
      s1.angle = Math.PI; // pointing directly at player 0

      // Wait for bot AI update cycles
      await new Promise((r) => setTimeout(r, 350));

      return {
        botVx: s1.vx,
        botAngle: s1.angle,
        botDist: Math.hypot(s1.x - s0.x, s1.y - s0.y)
      };
    });

    // Bot is moving toward player (vx < 0 or dist decreased from 180)
    expect(botChasing.botVx < 0 || botChasing.botDist < 180).toBe(true);
  });
});
