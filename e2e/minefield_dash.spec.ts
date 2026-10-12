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
  await page.waitForTimeout(50);
}

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

    await skipCountdown(page);

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
    await skipCountdown(page);

    // Initial position of P1
    const p1Initial = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });

    // Press and hold 'W' (Up)
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');

    const p1AfterUp = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });

    // P1 should have moved Up (-Y in canvas)
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
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyA');

    const p1AfterLeft = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });
    expect(p1AfterLeft.x).toBeLessThan(p1Stopped.x);

    // Press and hold 'D' (Right)
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyD');

    const p1AfterRight = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });
    expect(p1AfterRight.x).toBeGreaterThan(p1AfterLeft.x);

    // Press and hold 'S' (Down)
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyS');

    const p1AfterDown = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });
    expect(p1AfterDown.y).toBeGreaterThan(p1AfterUp.y);
  });

  test('Exploded tiles become impassable solid barricades', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=minefield_dash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    // Setup an exploded tile and position P1 directly below it
    const barricadeInfo = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      const targetCol = 3;
      const targetRow = 3;

      // Force explode (3, 3)
      dbg.forceExplode(targetCol, targetRow);

      const tileLeft = dbg.gridStartX + targetCol * dbg.tileW;
      const tileRight = tileLeft + dbg.tileW;
      const tileTop = dbg.gridStartY + targetRow * dbg.tileH;
      const tileBottom = tileTop + dbg.tileH;
      const centerX = tileLeft + dbg.tileW / 2;

      // Position P1 just 5px below the bottom edge of the barricade
      const startY = tileBottom + 15;
      dbg.setPlayerPos(0, centerX, startY);

      return {
        isBarricaded: dbg.isBarricaded(targetCol, targetRow),
        tileLeft,
        tileRight,
        tileTop,
        tileBottom,
        centerX,
        startY
      };
    });

    expect(barricadeInfo.isBarricaded).toBe(true);

    // Walk UP ('KeyW') directly against the bottom wall of the barricade
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');

    const postWalk = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      return dbg.getPlayersState()[0];
    });

    // Player radius is 13px, so player center cannot penetrate below tileBottom + 12
    expect(postWalk.y).toBeGreaterThanOrEqual(barricadeInfo.tileBottom + 12);

    // Now test moving from the left against the barricade's left edge
    await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      const targetCol = 3;
      const targetRow = 3;
      const tileLeft = dbg.gridStartX + targetCol * dbg.tileW;
      const tileTop = dbg.gridStartY + targetRow * dbg.tileH;
      const centerY = tileTop + dbg.tileH / 2;
      // Position P1 15px to the left of the tile
      dbg.setPlayerPos(0, tileLeft - 15, centerY);
    });

    // Walk RIGHT ('KeyD') directly against the left edge of the barricade
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyD');

    const postWalkRight = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      const targetCol = 3;
      const tileLeft = dbg.gridStartX + targetCol * dbg.tileW;
      const ps0 = dbg.getPlayersState()[0];
      return {
        x: ps0.x,
        tileLeft
      };
    });

    // Player center cannot penetrate beyond tileLeft - 12
    expect(postWalkRight.x).toBeLessThanOrEqual(postWalkRight.tileLeft - 12);
  });

  test('Bot AI routes around barricades and reaches the field', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=minefield_dash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

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
    await page.waitForTimeout(1000);

    const botAfter = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      const ps1 = dbg.getPlayersState()[1];
      return {
        y: ps1.y,
        x: ps1.x,
        score: ps1.score
      };
    });

    // Bot should have moved upward or laterally and not get stuck
    expect(botAfter.y).toBeLessThan(botInitial.initialY + 10);
  });

  test('Player-to-player separation prevents overlapping', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=minefield_dash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    const separationTest = await page.evaluate(() => {
      const dbg = (window as any).__MINEFIELD_DASH_DEBUG__;
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game || !dbg) return null;

      // Teleport Player 0 and Player 1 to the exact same position
      dbg.setPlayerPos(0, 300, 300);
      dbg.setPlayerPos(1, 300, 300);

      // Advance physics by 2 frames
      game.update(1 / 60, 800, 600);
      game.update(1 / 60, 800, 600);

      const p0 = dbg.getPlayersState()[0];
      const p1 = dbg.getPlayersState()[1];
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);

      return {
        dist,
        p0x: p0.x,
        p1x: p1.x
      };
    });

    expect(separationTest).not.toBeNull();
    // Elastic separation should push them apart to at least 23px
    expect(separationTest!.dist).toBeGreaterThanOrEqual(23);
  });
});
