import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Skyline Sumo - Wall Avoidance Aiming & Cushioned Bounce Physics', () => {
  test('AI climber near arena wall clamps aim straight up or inward, never aiming outward into the wall', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await page.waitForSelector('#game-canvas');

    const result = await page.evaluate(async () => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('skyline_sumo');
      gm.update(4.0); // skip countdown

      const game = gm.activeGame;
      if (!game) throw new Error('Game not active');

      const bot = game.climbers.get(1);
      if (!bot) throw new Error('Bot not found');

      // Place bot close to left wall (< 75px)
      bot.x = 45;
      bot.isGrounded = true;
      bot.isCharging = true;
      bot.chargePower = 0.5;

      // Update game one frame
      game.update(0.016, 960, 600);

      const leftWallAim = bot.aimAngle;

      // Place bot close to right wall (> 960 - 75 = 885)
      bot.x = 920;
      bot.isGrounded = true;
      bot.isCharging = true;
      bot.chargePower = 0.5;

      game.update(0.016, 960, 600);

      const rightWallAim = bot.aimAngle;

      return {
        leftWallAim,
        rightWallAim,
        straightUp: -Math.PI / 2
      };
    });

    // When near left wall, aim angle must be >= -Math.PI/2 (straight up or angled toward right/center, never left toward wall)
    expect(result.leftWallAim).toBeGreaterThanOrEqual(result.straightUp - 0.001);

    // When near right wall, aim angle must be <= -Math.PI/2 (straight up or angled toward left/center, never right toward wall)
    expect(result.rightWallAim).toBeLessThanOrEqual(result.straightUp + 0.001);
  });

  test('wall impact absorbs kinetic energy, caps rebound speed, and activates cooldown preventing multi-ricochets', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await page.waitForSelector('#game-canvas');

    const bounceResult = await page.evaluate(async () => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('skyline_sumo');
      gm.update(4.0);

      const game = gm.activeGame;
      const climber = game.climbers.get(0);

      // Launch climber into left wall at high speed (-420 px/s)
      climber.isGrounded = false;
      climber.x = 35;
      climber.y = 300;
      climber.vx = -420;
      climber.vy = 200;
      climber.wallBounceCooldown = 0;

      // Update 1 frame to trigger wall collision
      game.update(0.05, 960, 600);

      const reboundVx = climber.vx;
      const reboundVy = climber.vy;
      const cooldown = climber.wallBounceCooldown;

      return {
        reboundVx,
        reboundVy,
        cooldown
      };
    });

    // Rebound speed must be significantly cushioned (capped <= 130 px/s, NOT 80% of 420 which would be 336)
    expect(bounceResult.reboundVx).toBeGreaterThan(0);
    expect(bounceResult.reboundVx).toBeLessThanOrEqual(130);

    // Cooldown must be active to prevent rapid double ricochet
    expect(bounceResult.cooldown).toBeGreaterThan(0.1);

    // Vertical velocity should have friction absorption
    expect(bounceResult.reboundVy).toBeLessThan(200 + 650 * 0.05); // reduced by 0.82 friction
  });

  test('bot AI climbs upwards smoothly without getting trapped against walls', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await page.waitForSelector('#game-canvas');

    const climbResult = await page.evaluate(async () => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('skyline_sumo');
      gm.update(4.0);

      const game = gm.activeGame;
      const bot = game.climbers.get(1);
      const startY = bot.y;
      let highestY = startY;

      // Run 200 frames of gameplay
      for (let f = 0; f < 200; f++) {
        gm.update(0.016);
        if (bot.y < highestY) highestY = bot.y;
      }

      return {
        heightGained: startY - highestY,
        score: bot.score
      };
    });

    // Bot should successfully ascend
    expect(climbResult.heightGained).toBeGreaterThan(30);
  });
});
