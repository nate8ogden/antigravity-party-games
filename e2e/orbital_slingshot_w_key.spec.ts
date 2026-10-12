import { test, expect } from '@playwright/test';

test.describe('Orbital Slingshot - Pure Inertia & Only W Key Mechanics', () => {
  test('P1 tether only responds to W key and Space, not A, S, or D', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('orbital');
      gm.state = 'PLAYING';
    });

    // 1. Verify KeyA, KeyS, KeyD do NOT activate tether
    const aResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const input = gm.input;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      const isDownA = input.isPlayerTetherDown(0);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
      const isDownS = input.isPlayerTetherDown(0);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
      const isDownD = input.isPlayerTetherDown(0);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));

      return { isDownA, isDownS, isDownD };
    });

    expect(aResult.isDownA).toBe(false);
    expect(aResult.isDownS).toBe(false);
    expect(aResult.isDownD).toBe(false);

    // 2. Verify KeyW DOES activate tether
    const wResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const input = gm.input;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      const isDownW = input.isPlayerTetherDown(0);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      return isDownW;
    });

    expect(wResult).toBe(true);

    // 3. Verify P2: ArrowUp activates tether, while ArrowLeft/Down/Right do not
    const p2Result = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const input = gm.input;

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
      const isDownLeft = input.isPlayerTetherDown(1);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
      const isDownRight = input.isPlayerTetherDown(1);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
      const isDownDown = input.isPlayerTetherDown(1);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }));

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
      const isDownUp = input.isPlayerTetherDown(1);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }));

      return { isDownLeft, isDownRight, isDownDown, isDownUp };
    });

    expect(p2Result.isDownLeft).toBe(false);
    expect(p2Result.isDownRight).toBe(false);
    expect(p2Result.isDownDown).toBe(false);
    expect(p2Result.isDownUp).toBe(true);

    expect(pageErrors.length).toBe(0);
  });

  test('Ship cannot steer or throttle without a planet: glides on pure inertia in deep space', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const testFlight = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('orbital');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const ship = game.ships.get(0);

      // Place ship far in empty space away from all planets
      ship.tetheredPlanet = null;
      ship.x = 100;
      ship.y = 100;
      ship.vx = 200;
      ship.vy = 0;
      ship.angle = 0;

      // Dispatch KeyA (steer left) and KeyW (steer/throttle) for several frames
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      game.update(0.05, gm.logicalWidth, gm.logicalHeight);
      game.update(0.05, gm.logicalWidth, gm.logicalHeight);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));

      const angleAfterA = ship.angle;
      const vyAfterA = ship.vy;

      // Since ship has no planet, steering with A must NOT change angle or vy!
      return { angleAfterA, vyAfterA, vx: ship.vx };
    });

    expect(testFlight.angleAfterA).toBe(0);
    expect(testFlight.vyAfterA).toBe(0);
    expect(testFlight.vx).toBe(200);
  });

  test('Ship tethers to nearby planet when W is pressed, and slingshots when W is released', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const slingshotCycle = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('orbital');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const ship = game.ships.get(0);
      const planet = game.planets[0];

      // Place ship cruising right near planet[0]
      ship.tetheredPlanet = null;
      ship.x = planet.x;
      ship.y = planet.y - (planet.radius + 35);
      ship.vx = 220;
      ship.vy = 0;

      // Press KeyW to tether
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      game.update(0.05, gm.logicalWidth, gm.logicalHeight);

      const isTetheredAfterW = ship.tetheredPlanet === planet;
      const initialOrbitAngle = ship.tetherAngle;

      // Continue holding W for several frames - ship should orbit around the planet
      game.update(0.1, gm.logicalWidth, gm.logicalHeight);
      game.update(0.1, gm.logicalWidth, gm.logicalHeight);
      const angleMoved = Math.abs(ship.tetherAngle - initialOrbitAngle);

      // Release KeyW - ship should release from planet with high tangential velocity
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      game.update(0.05, gm.logicalWidth, gm.logicalHeight);

      const isTetheredAfterRelease = ship.tetheredPlanet !== null;
      const slingshotSpeed = Math.hypot(ship.vx, ship.vy);

      return {
        isTetheredAfterW,
        angleMoved,
        isTetheredAfterRelease,
        slingshotSpeed
      };
    });

    expect(slingshotCycle.isTetheredAfterW).toBe(true);
    expect(slingshotCycle.angleMoved).toBeGreaterThan(0.2);
    expect(slingshotCycle.isTetheredAfterRelease).toBe(false);
    expect(slingshotCycle.slingshotSpeed).toBeGreaterThanOrEqual(240);
  });
});
