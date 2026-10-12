import { test, expect } from '@playwright/test';

test.describe('Swat the Fly - Controls & Movement Verification', () => {
  test('Flyswatter responds to WASD movement and Spacebar swat action', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    // Start Swat the Fly
    const initialPos = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (!gm) return null;
      gm.startGame('swat_fly');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      if (!game) return null;
      const sw = game.swatters.get(0);
      return sw ? { x: sw.x, y: sw.y } : null;
    });

    expect(initialPos).not.toBeNull();

    // 1. Test Moving Right with KeyD
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyD');

    const posAfterD = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const sw = gm.activeGame.swatters.get(0);
      return { x: sw.x, y: sw.y };
    });

    expect(posAfterD.x).toBeGreaterThan(initialPos!.x);

    // 2. Test Moving Down with KeyS (increasing Y)
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyS');

    const posAfterS = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const sw = gm.activeGame.swatters.get(0);
      return { x: sw.x, y: sw.y };
    });

    expect(posAfterS.y).toBeGreaterThan(posAfterD.y);

    // 3. Test Moving Up with KeyW (decreasing Y)
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(350);
    await page.keyboard.up('KeyW');

    const posAfterW = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const sw = gm.activeGame.swatters.get(0);
      return { x: sw.x, y: sw.y };
    });

    expect(posAfterW.y).toBeLessThan(posAfterS.y);

    // 4. Test Moving Left with KeyA
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyA');

    const posAfterA = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const sw = gm.activeGame.swatters.get(0);
      return { x: sw.x, y: sw.y };
    });

    expect(posAfterA.x).toBeLessThan(posAfterD.x);

    // 5. Test Swat Slam Action with Spacebar
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);

    const isSwatting = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const sw = gm.activeGame.swatters.get(0);
      return sw.isSwatting;
    });

    expect(isSwatting).toBe(true);

    expect(pageErrors.length).toBe(0);
  });
});
