import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

async function skipCountdown(page: any) {
  await page.evaluate(() => {
    const gm = (window as any).__GAME_MANAGER__;
    if (gm) {
      gm.countdownTimer = 0;
      gm.state = 'PLAYING';
    }
  });
  await page.waitForTimeout(100);
}

test.describe('Landscape Artillery Duel - Turn-Based Mechanics, Camera & Hitboxes', () => {
  test('initializes landscape, 2 players on terrain surface, and camera zooms into active player', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=landscape_artillery&players=2&difficulty=bot_easy`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(300);

    const debug = await page.evaluate(() => (window as any).__LANDSCAPE_ARTILLERY_DEBUG__);
    expect(debug).toBeTruthy();
    expect(debug.players.length).toBe(2);

    // Both players should be alive with 100 HP
    expect(debug.players[0].hp).toBe(100);
    expect(debug.players[1].hp).toBe(100);
    expect(debug.players[0].alive).toBe(true);
    expect(debug.players[1].alive).toBe(true);

    // Players are placed on surface of terrain
    expect(debug.players[0].y).toBeGreaterThan(150);
    expect(debug.players[1].y).toBeGreaterThan(150);

    // Camera zooms in on active player during their turn
    await page.waitForTimeout(400);
    const cameraZoom = await page.evaluate(() => (window as any).__LANDSCAPE_ARTILLERY_DEBUG__.camera.zoom);
    expect(cameraZoom).toBeGreaterThan(1.25);
  });

  test('supports 4 players across randomly generated hills and valleys', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=landscape_artillery&players=4&difficulty=bot_easy`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(300);

    const debug = await page.evaluate(() => (window as any).__LANDSCAPE_ARTILLERY_DEBUG__);
    expect(debug).toBeTruthy();
    expect(debug.players.length).toBe(4);

    // Verify spacing across landscape
    const x0 = debug.players[0].x;
    const x1 = debug.players[1].x;
    const x2 = debug.players[2].x;
    const x3 = debug.players[3].x;

    expect(x0).toBeLessThan(x1);
    expect(x1).toBeLessThan(x2);
    expect(x2).toBeLessThan(x3);
  });

  test('aiming left/right, pulling back power, and firing launcher', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=landscape_artillery&players=2&difficulty=bot_easy`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(300);

    const initialAngle = await page.evaluate(() => (window as any).__LANDSCAPE_ARTILLERY_DEBUG__.players[0].aimAngleDeg);
    const initialPower = await page.evaluate(() => (window as any).__LANDSCAPE_ARTILLERY_DEBUG__.players[0].power);

    // 1. Aim Left (increases angle) using KeyA
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyA');

    const angleAfterA = await page.evaluate(() => (window as any).__LANDSCAPE_ARTILLERY_DEBUG__.players[0].aimAngleDeg);
    expect(angleAfterA).toBeGreaterThan(initialAngle);

    // 2. Pull back power using KeyS
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyS');

    const powerAfterS = await page.evaluate(() => (window as any).__LANDSCAPE_ARTILLERY_DEBUG__.players[0].power);
    expect(powerAfterS).toBeGreaterThan(initialPower);

    // 3. Fire shot with Space
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    const flyingState = await page.evaluate(() => {
      const dbg = (window as any).__LANDSCAPE_ARTILLERY_DEBUG__;
      return {
        turnState: dbg.turnState,
        hasProjectile: Boolean(dbg.projectile)
      };
    });

    // Projectile should be in flight or turn state advanced
    expect(flyingState.hasProjectile || flyingState.turnState === 'PROJECTILE_FLYING' || flyingState.turnState === 'IMPACT_PAUSE' || flyingState.turnState === 'NEXT_TURN_DELAY').toBe(true);
  });

  test('locational body hitboxes: Headshot does 2.5x critical damage, Body does 1.0x, Leg does 0.6x', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=landscape_artillery&players=2&difficulty=bot_easy`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(300);

    // Directly test handlePlayerHit via game instance
    const hitResults = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game) return null;

      const p1 = game.playersState.get(1); // Target player
      if (!p1) return null;

      const baseY = p1.y;

      // 1. Headshot test (hit at baseY - 30)
      p1.hp = 100;
      game.handlePlayerHit(p1, p1.x, baseY - 30);
      const headshotDamage = 100 - p1.hp;
      const headshotEvent = { ...game.lastDamageEvent };

      // 2. Body hit test (hit at baseY - 18)
      p1.hp = 100;
      game.handlePlayerHit(p1, p1.x, baseY - 18);
      const bodyDamage = 100 - p1.hp;
      const bodyEvent = { ...game.lastDamageEvent };

      // 3. Leg hit test (hit at baseY - 4)
      p1.hp = 100;
      game.handlePlayerHit(p1, p1.x, baseY - 4);
      const legDamage = 100 - p1.hp;
      const legEvent = { ...game.lastDamageEvent };

      return {
        headshot: { damage: headshotDamage, event: headshotEvent },
        body: { damage: bodyDamage, event: bodyEvent },
        leg: { damage: legDamage, event: legEvent }
      };
    });

    expect(hitResults).toBeTruthy();

    // Critical Headshot: 50 damage (2.5x standard 20-25)
    expect(hitResults!.headshot.damage).toBe(50);
    expect(hitResults!.headshot.event.hitType).toBe('HEADSHOT');

    // Body hit: 25 damage (1.0x standard)
    expect(hitResults!.body.damage).toBe(25);
    expect(hitResults!.body.event.hitType).toBe('BODY');

    // Leg hit: 15 damage (0.6x glancing)
    expect(hitResults!.leg.damage).toBe(15);
    expect(hitResults!.leg.event.hitType).toBe('LEG');
  });

  test('explosions carve craters into destructible landscape terrain', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=landscape_artillery&players=2&difficulty=bot_easy`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(300);

    const craterTest = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game) return null;

      const testX = 350;
      const heightBefore = game.getTerrainHeightAt(testX);

      // Carve crater at testX
      game.carveCrater(testX, heightBefore, 25);

      const heightAfter = game.getTerrainHeightAt(testX);

      return {
        heightBefore,
        heightAfter,
        craterDepth: heightAfter - heightBefore
      };
    });

    expect(craterTest).toBeTruthy();
    // Crater should deform landscape downward (heightAfter > heightBefore in screen Y coords)
    expect(craterTest!.heightAfter).toBeGreaterThan(craterTest!.heightBefore);
    expect(craterTest!.craterDepth).toBeGreaterThanOrEqual(20);
  });
});
