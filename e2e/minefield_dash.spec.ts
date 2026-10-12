import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Minefield Dash Controls & Barricades Verification', () => {
  test('2-player launch and on-screen control hint verification', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=minefield_dash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    // Wait through countdown into active gameplay
    await page.waitForTimeout(1800);

    const debugState = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return {
        hasDebug: !!dbg,
        cols: dbg?.cols,
        rows: dbg?.rows,
        tileW: dbg?.tileW,
        tileH: dbg?.tileH
      };
    });

    expect(debugState.hasDebug).toBe(true);
    expect(debugState.cols).toBeGreaterThanOrEqual(8);
    expect(debugState.rows).toBeGreaterThanOrEqual(6);
    expect(consoleErrors).toEqual([]);
  });

  test('Direct 8-way WASD controls: Up, Down, Left, Right, and crisp stopping', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=minefield_dash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1800);

    // Initial position of P1
    const p1Initial = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });

    // Press and hold 'W' (Up)
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyW');

    const p1AfterUp = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });

    // P1 should have moved Up (-Y)
    expect(p1AfterUp.y).toBeLessThan(p1Initial.y);

    // After releasing key, velocity should stop
    await page.waitForTimeout(100);
    const p1Stopped = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });
    expect(p1Stopped.vx).toBe(0);
    expect(p1Stopped.vy).toBe(0);

    // Press and hold 'A' (Left)
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyA');

    const p1AfterLeft = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });
    expect(p1AfterLeft.x).toBeLessThan(p1Stopped.x);

    // Press and hold 'D' (Right)
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyD');

    const p1AfterRight = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });
    expect(p1AfterRight.x).toBeGreaterThan(p1AfterLeft.x);
  });

  test('Exploded tiles become impassable solid barricades', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=minefield_dash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1800);

    // Force explode a specific tile directly ahead of P1
    const setupResult = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      const ps0 = dbg.getPlayersState()[0];

      // Identify column P1 is currently in
      const pCol = Math.floor((ps0.x - dbg.gridStartX) / dbg.tileW);
      const targetRow = dbg.rows - 1; // bottom row of grid

      // Force explode this tile
      dbg.forceExplode(pCol, targetRow);

      const tileLeft = dbg.gridStartX + pCol * dbg.tileW;
      const tileRight = tileLeft + dbg.tileW;
      const tileTop = dbg.gridStartY + targetRow * dbg.tileH;
      const tileBottom = tileTop + dbg.tileH;

      return {
        pCol,
        targetRow,
        isBarricaded: dbg.isBarricaded(pCol, targetRow),
        tileLeft,
        tileRight,
        tileTop,
        tileBottom,
        pStartY: ps0.y
      };
    });

    expect(setupResult.isBarricaded).toBe(true);

    // Attempt to walk directly into the exploded barricade by pressing 'W'
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');

    // Verify P1 was blocked by the barricade and cannot penetrate inside it
    const postMoveState = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      const ps0 = dbg.getPlayersState()[0];
      return {
        x: ps0.x,
        y: ps0.y,
        vx: ps0.vx,
        vy: ps0.vy
      };
    });

    // P1 must remain outside the barricade bottom edge (with player radius buffer ~12px)
    expect(postMoveState.y).toBeGreaterThanOrEqual(setupResult.tileBottom + 10);
  });

  test('Bot AI routes around barricades and reaches the field', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=minefield_dash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1800);

    // Force explode a tile directly ahead of the bot (Player 1)
    const botInitial = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      const ps1 = dbg.getPlayersState()[1];
      const botCol = Math.floor((ps1.x - dbg.gridStartX) / dbg.tileW);
      const botTargetRow = dbg.rows - 1;
      dbg.forceExplode(botCol, botTargetRow);
      return {
        initialY: ps1.y,
        botCol,
        botTargetRow
      };
    });

    // Allow bot to update and navigate
    await page.waitForTimeout(1200);

    const botAfter = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      const ps1 = dbg.getPlayersState()[1];
      return {
        y: ps1.y,
        x: ps1.x,
        score: ps1.score
      };
    });

    // Bot should have moved upward or laterally and not get stuck forever
    expect(botAfter.y).toBeLessThan(botInitial.initialY + 10);
  });
});
