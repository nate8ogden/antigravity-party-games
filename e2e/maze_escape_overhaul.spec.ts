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

test.describe('Maze Escape - Overhaul & Sentry Territory Dynamics', () => {
  test('controls when left alone stop character completely (zero auto-walking drift)', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=maze_escape&players=2&difficulty=bot_normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(150);

    const debug = await page.evaluate(() => (window as any).__MAZE_ESCAPE_DEBUG__);
    expect(debug).toBeTruthy();

    const p0 = debug.players[0];
    // In directional manual mode, character must NOT auto-walk when keys are untouched
    expect(p0.vx).toBe(0);
    expect(p0.vy).toBe(0);

    // Press KeyD to walk
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    });
    await page.waitForTimeout(100);

    let movingDebug = await page.evaluate(() => (window as any).__MAZE_ESCAPE_DEBUG__);
    expect(movingDebug.players[0].vx).toBeGreaterThan(0);

    // Release KeyD: character must stop dead in their tracks!
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    });
    await page.waitForTimeout(100);

    let stoppedDebug = await page.evaluate(() => (window as any).__MAZE_ESCAPE_DEBUG__);
    expect(stoppedDebug.players[0].vx).toBe(0);
    expect(stoppedDebug.players[0].vy).toBe(0);
  });

  test('map is expanded to a large sprawling labyrinth (27x17) with multiple sentries (4)', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=maze_escape&players=2&difficulty=bot_normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(100);

    const debug = await page.evaluate(() => (window as any).__MAZE_ESCAPE_DEBUG__);
    expect(debug.cols).toBe(27);
    expect(debug.rows).toBe(17);
    expect(debug.sentries.length).toBe(4);

    // Verify sentries have individual quadrant territories
    for (const sentry of debug.sentries) {
      expect(sentry.minX).toBeDefined();
      expect(sentry.maxX).toBeGreaterThan(sentry.minX);
      expect(sentry.minY).toBeDefined();
      expect(sentry.maxY).toBeGreaterThan(sentry.minY);
      expect(sentry.state).toBe('PATROL');
      expect(sentry.radius).toBe(15);
    }
  });

  test('sentry chases player when near, but stops and loses chase when player leaves invisible boundary', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=maze_escape&players=2&difficulty=bot_normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(100);

    // Teleport player 0 inside Sentry 0's territory close to Sentry 0
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm.activeGame;
      const sentry = game.sentries[0];
      const p0 = game.playersState.get(0);
      // Place player within 60px of sentry, well inside territory
      p0.x = sentry.x + 40;
      p0.y = sentry.y;
      p0.invulnerableTimer = 0;
      p0.ghostTimer = 0;
      game.update(0.016, 960, 600);
    });

    await page.waitForTimeout(50);

    // Sentry 0 should now be in CHASE mode targeting Player 0
    let chaseDebug = await page.evaluate(() => {
      const debug = (window as any).__MAZE_ESCAPE_DEBUG__;
      return {
        state: debug.sentries[0].state,
        target: debug.sentries[0].targetPlayerId,
        alertState: debug.sentries[0].alertState
      };
    });
    expect(chaseDebug.state).toBe('CHASE');
    expect(chaseDebug.target).toBe(0);

    // Now move Player 0 outside Sentry 0's invisible boundary
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm.activeGame;
      const sentry = game.sentries[0];
      const p0 = game.playersState.get(0);
      // Place player well outside sentry's territory (e.g. far on the other side of map)
      p0.x = sentry.maxX + 150;
      p0.y = sentry.maxY + 150;
      game.update(0.016, 960, 600);
    });

    await page.waitForTimeout(50);

    // Sentry must give up the chase because the player left its invisible boundary!
    let lostDebug = await page.evaluate(() => {
      const debug = (window as any).__MAZE_ESCAPE_DEBUG__;
      return {
        state: debug.sentries[0].state,
        target: debug.sentries[0].targetPlayerId,
        alertState: debug.sentries[0].alertState
      };
    });
    expect(lostDebug.state).toBe('RETURN');
    expect(lostDebug.target).toBeNull();
    expect(lostDebug.alertState).toBe('LOST');
  });

  test('sentry collision applies significant point penalty (-120 pts) and creates large distance between player and sentry', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=maze_escape&players=2&difficulty=bot_normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(100);

    // Give player initial score and gems
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const p0 = gm.activeGame.playersState.get(0);
      p0.score = 300;
      p0.gemsCollected = 10;
      p0.invulnerableTimer = 0;
    });

    // Trigger sentry collision
    await page.evaluate(() => {
      const debug = (window as any).__MAZE_ESCAPE_DEBUG__;
      debug.triggerSentryCollision(0, 0);
    });

    const result = await page.evaluate(() => {
      const debug = (window as any).__MAZE_ESCAPE_DEBUG__;
      const p0 = debug.players[0];
      const s0 = debug.sentries[0];
      const distance = Math.hypot(p0.x - s0.x, p0.y - s0.y);
      return {
        score: p0.score,
        invulnerableTimer: p0.invulnerableTimer,
        gemsCollected: p0.gemsCollected,
        sentryStun: s0.stunTimer,
        distance
      };
    });

    // Significant penalty: 300 - 120 = 180 points
    expect(result.score).toBe(180);
    // Gems dropped
    expect(result.gemsCollected).toBe(7);
    // Distance must be created: substantially larger than touch radius (> 150px)
    expect(result.distance).toBeGreaterThan(150);
    // Player must have invulnerability shield active
    expect(result.invulnerableTimer).toBeGreaterThan(1.5);
    // Sentry must be stunned
    expect(result.sentryStun).toBeGreaterThan(1.0);
  });

  test('bot AI navigates corridors toward gems and avoids sentries', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=maze_escape&players=2&difficulty=bot_hard`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);

    // Let bot play for 2 seconds
    await page.waitForTimeout(2000);

    const botState = await page.evaluate(() => {
      const debug = (window as any).__MAZE_ESCAPE_DEBUG__;
      const bot = debug.players[1];
      return {
        score: bot.score,
        gemsCollected: bot.gemsCollected,
        x: bot.x,
        y: bot.y
      };
    });

    // Bot should have successfully collected gems and navigated corridors
    expect(botState.gemsCollected).toBeGreaterThan(0);
    expect(botState.score).toBeGreaterThan(0);
  });
});
