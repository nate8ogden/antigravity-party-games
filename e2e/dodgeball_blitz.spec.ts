import { test, expect } from '@playwright/test';

test.describe('Dodgeball Blitz - AI & Gameplay Mechanics', () => {
  test('should load Dodgeball Blitz and verify active, intelligent bot AI', async ({ page }) => {
    // Navigate to local dev server with dodgeball_blitz game with 1 human and 1 normal bot
    await page.goto('http://localhost:5173/?game=dodgeball_blitz&players=1&difficulty=normal');

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(500);

    // Fast forward countdown to PLAYING state
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });
    await page.waitForTimeout(100);

    // Verify debug interface is exposed
    const hasDebug = await page.evaluate(() => {
      return typeof (window as any).__DODGEBALL_DEBUG__ !== 'undefined';
    });
    expect(hasDebug).toBe(true);

    const initialBotPos = await page.evaluate(() => {
      const debug = (window as any).__DODGEBALL_DEBUG__;
      const bot = debug.players.find((p: any) => p.id === 1);
      return { x: bot.x, y: bot.y };
    });

    await page.waitForTimeout(600);

    const movedBotPos = await page.evaluate(() => {
      const debug = (window as any).__DODGEBALL_DEBUG__;
      const bot = debug.players.find((p: any) => p.id === 1);
      return { x: bot.x, y: bot.y, vx: bot.vx, vy: bot.vy };
    });

    // The bot MUST have moved (no longer frozen at spawn!)
    const distMoved = Math.hypot(movedBotPos.x - initialBotPos.x, movedBotPos.y - initialBotPos.y);
    expect(distMoved).toBeGreaterThan(20);

    // Verify Human Player 1 movement with WASD
    const initialP1X = await page.evaluate(() => {
      const debug = (window as any).__DODGEBALL_DEBUG__;
      return debug.players[0].x;
    });

    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(50);

    const movedP1X = await page.evaluate(() => {
      const debug = (window as any).__DODGEBALL_DEBUG__;
      return debug.players[0].x;
    });
    expect(movedP1X).toBeGreaterThan(initialP1X);

    // Test Human Catch Action (Space key triggers catchWindow)
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);

    const p1CatchWindow = await page.evaluate(() => {
      const debug = (window as any).__DODGEBALL_DEBUG__;
      return debug.players[0].catchWindow;
    });
    expect(p1CatchWindow).toBeGreaterThan(0);

    // Test Bot Threat Reaction: Throw ball at bot and verify evasion or catch
    const threatResult = await page.evaluate(() => {
      const debug = (window as any).__DODGEBALL_DEBUG__;
      const bot = debug.players.find((p: any) => p.id === 1);
      // Give P1 a ball and throw directly toward bot
      debug.giveBallToPlayer(0);
      const aimAngle = Math.atan2(bot.y - debug.players[0].y, bot.x - debug.players[0].x);
      debug.triggerThrow(0, aimAngle);
      return true;
    });
    expect(threatResult).toBe(true);

    // Wait for ball to travel and bot to react
    await page.waitForTimeout(400);

    // Verify bot reacted (either caught, dodged, or took impact)
    const botStats = await page.evaluate(() => {
      const debug = (window as any).__DODGEBALL_DEBUG__;
      const bot = debug.players.find((p: any) => p.id === 1);
      return {
        isAlive: bot.isAlive,
        catches: bot.catches,
        dodgeVel: Math.hypot(bot.vx, bot.vy)
      };
    });
    // Bot should have actively reacted with velocity or catch
    expect(botStats.catches > 0 || botStats.dodgeVel > 0 || !botStats.isAlive).toBe(true);
  });

  test('should handle elimination and set progression', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=dodgeball_blitz&players=1&difficulty=hard');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(500);

    // Skip countdown
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });
    await page.waitForTimeout(100);

    // Eliminate Player 2 (Bot) to trigger set win for Team LEFT
    await page.evaluate(() => {
      const debug = (window as any).__DODGEBALL_DEBUG__;
      debug.eliminatePlayer(1);
    });

    await page.waitForTimeout(150);

    const teamWins = await page.evaluate(() => {
      const debug = (window as any).__DODGEBALL_DEBUG__;
      return debug.teamWins;
    });

    expect(teamWins.LEFT).toBe(1);
  });
});
