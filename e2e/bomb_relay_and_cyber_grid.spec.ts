import { test, expect } from '@playwright/test';

test.describe('Bomb Relay Separation & Reimagined Cyber Grid Runner', () => {
  test('Bomb Relay: should separate players explosively upon tag with invulnerability', async ({ page }) => {
    // Navigate to bomb relay
    await page.goto('http://localhost:5173/?game=bomb_relay&players=1&difficulty=normal');

    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Fast-forward countdown
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });
    await page.waitForTimeout(100);

    // Test bomb passing separation
    const preTagData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm.activeGame;
      const runners = Array.from(game.runners.values()) as any[];
      const p1 = runners.find((r) => r.id === 0);
      const p2 = runners.find((r) => r.id === 1);

      // Force collision in clear arena space away from center obstacle
      const cx = game.arenaCenterX;
      const cy = game.arenaCenterY + 110;
      p1.x = cx - 12;
      p1.y = cy;
      p2.x = cx + 13;
      p2.y = cy;
      p1.vx = 50;
      p2.vx = -50;
      game.bombHolderId = 0;
      p1.invulnTimer = 0;
      p2.invulnTimer = 0;

      return {
        initialDist: Math.hypot(p2.x - p1.x, p2.y - p1.y)
      };
    });

    // Wait a frame for collision & separation impulse to process
    await page.waitForTimeout(80);

    const postTagData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm.activeGame;
      const runners = Array.from(game.runners.values()) as any[];
      const p1 = runners.find((r) => r.id === 0);
      const p2 = runners.find((r) => r.id === 1);

      return {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        p1Invuln: p1.invulnTimer,
        p2Invuln: p2.invulnTimer,
        p1Vx: p1.vx,
        p2Vx: p2.vx,
        bombHolder: game.bombHolderId
      };
    });

    // The bomb must have transferred to player 1
    expect(postTagData.bombHolder).toBe(1);
    // Distance must have increased due to separation blast
    expect(postTagData.dist).toBeGreaterThan(preTagData.initialDist + 20);
    // Both players must have active invulnerability timers to prevent sticking
    expect(postTagData.p1Invuln).toBeGreaterThan(0.8);
    expect(postTagData.p2Invuln).toBeGreaterThan(0.8);
    // Opposing velocities from blast
    expect(postTagData.p1Vx).toBeLessThan(0);
    expect(postTagData.p2Vx).toBeGreaterThan(0);
  });

  test('Cyber Grid Runner: should feature 360 hover physics, nitro boost, and data core collection', async ({ page }) => {
    // Navigate to cyber_grid_runner
    await page.goto('http://localhost:5173/?game=cyber_grid_runner&players=1&difficulty=normal');

    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Fast-forward countdown
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });
    await page.waitForTimeout(100);

    // Verify debug interface
    const hasDebug = await page.evaluate(() => {
      return typeof (window as any).__CYBER_GRID_DEBUG__ !== 'undefined';
    });
    expect(hasDebug).toBe(true);

    // 1. Test 360 Steering
    const initialPos = await page.evaluate(() => {
      const debug = (window as any).__CYBER_GRID_DEBUG__;
      return { x: debug.players[0].x, y: debug.players[0].y };
    });

    await page.keyboard.down('KeyD');
    await page.waitForTimeout(150);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(50);

    const movedPos = await page.evaluate(() => {
      const debug = (window as any).__CYBER_GRID_DEBUG__;
      return { x: debug.players[0].x, y: debug.players[0].y };
    });
    expect(movedPos.x).toBeGreaterThan(initialPos.x);

    // 2. Test Nitro Boost Trigger (Space key)
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);

    const boostState = await page.evaluate(() => {
      const debug = (window as any).__CYBER_GRID_DEBUG__;
      return {
        isBoosting: debug.players[0].isBoosting,
        nitroEnergy: debug.players[0].nitroEnergy
      };
    });
    expect(boostState.isBoosting).toBe(true);
    expect(boostState.nitroEnergy).toBeLessThan(100);

    // 3. Test Data Node Collection
    const nodeCollected = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm.activeGame;
      const p1 = game.playersState.get(0);
      const node = game.dataNodes[0];

      // Move p1 directly on top of node
      p1.x = node.x;
      p1.y = node.y;
      return true;
    });
    expect(nodeCollected).toBe(true);

    await page.waitForTimeout(60);

    const scoreAfterNode = await page.evaluate(() => {
      const debug = (window as any).__CYBER_GRID_DEBUG__;
      return debug.players[0].score;
    });
    expect(scoreAfterNode).toBeGreaterThan(0);
  });
});
