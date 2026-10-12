import { test, expect } from '@playwright/test';

test.describe('Cosmic Vortex Minigame - Continuous Bubbles & Anti-Corner-Stuck Physics', () => {
  test('Initializes with active cosmic bubbles and continuously replenishes them', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=cosmic_vortex&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    // Skip countdown
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    const initOrbCount = await page.evaluate(() => {
      const dbg = (window as any).__COSMIC_VORTEX_DEBUG__;
      return dbg ? dbg.getOrbCount() : 0;
    });

    expect(initOrbCount).toBeGreaterThanOrEqual(6);

    // Simulate clearing all orbs (e.g. players collecting them in rapid succession)
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (game) {
        game.orbs = []; // Clear all orbs
        // Advance simulation by 2.5 seconds (150 frames)
        for (let i = 0; i < 150; i++) {
          game.update(1 / 60, 800, 600);
        }
      }
    });

    const replenishedOrbCount = await page.evaluate(() => {
      const dbg = (window as any).__COSMIC_VORTEX_DEBUG__;
      return dbg ? dbg.getOrbCount() : 0;
    });

    // Bubbles must have continuously spawned back to the healthy target range (>= 6)
    expect(replenishedOrbCount).toBeGreaterThanOrEqual(6);
  });

  test('Bubbles remain contained within the active celestial arena', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=cosmic_vortex&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    // Simulate 10 seconds of physics updates
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (game) {
        for (let i = 0; i < 600; i++) {
          game.update(1 / 60, 800, 600);
        }
      }
    });

    const orbs = await page.evaluate(() => {
      const dbg = (window as any).__COSMIC_VORTEX_DEBUG__;
      return dbg ? dbg.getOrbs() : [];
    });

    expect(orbs.length).toBeGreaterThanOrEqual(6);
    // Every single orb must be inside or near the arena bounds (not lost in deep outer space)
    for (const orb of orbs) {
      expect(orb.x).toBeGreaterThanOrEqual(15);
      expect(orb.x).toBeLessThanOrEqual(785);
      expect(orb.y).toBeGreaterThanOrEqual(15);
      expect(orb.y).toBeLessThanOrEqual(585);
    }
  });

  test('Corner Anti-Trap: ship in corner is deflected away from walls toward center playfield', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=cosmic_vortex&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    // Teleport Player 0 directly into the top-left corner aimed into the wall
    const cornerResult = await page.evaluate(() => {
      const dbg = (window as any).__COSMIC_VORTEX_DEBUG__;
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game || !dbg) return null;

      // Place at (20, 20) with velocity directed into the corner and facing corner
      dbg.setPlayerPos(0, 20, 20, -100, -100, Math.PI * 1.25);

      // Simulate 30 frames (0.5 seconds) while thrusting
      for (let i = 0; i < 30; i++) {
        game.update(1 / 60, 800, 600);
      }

      const p0 = dbg.getPlayerState(0);
      return {
        x: p0.x,
        y: p0.y,
        vx: p0.vx,
        vy: p0.vy
      };
    });

    expect(cornerResult).not.toBeNull();
    // Player should have been repulsed out of the corner towards center!
    // Margin is 32, corner pocket pushes firmly inward
    expect(cornerResult!.x).toBeGreaterThan(30);
    expect(cornerResult!.y).toBeGreaterThan(30);
    // Velocities must be directed inward (positive vx and vy away from top-left)
    expect(cornerResult!.vx).toBeGreaterThan(0);
    expect(cornerResult!.vy).toBeGreaterThan(0);
  });

  test('Bot AI Corner Avoidance: bot immediately steers and escapes corner towards center', async ({ page }) => {
    // 1 Human (P1) vs 1 Bot (P2)
    await page.goto('http://localhost:5173/?game=cosmic_vortex&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    const botEscapeResult = await page.evaluate(() => {
      const dbg = (window as any).__COSMIC_VORTEX_DEBUG__;
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game || !dbg) return null;

      // Teleport Bot (Player 1) to bottom-right corner (760, 560)
      dbg.setPlayerPos(1, 760, 560, 0, 0, 0);

      // Run bot AI and update for 20 frames
      for (let i = 0; i < 20; i++) {
        game.update(1 / 60, 800, 600);
      }

      const bot = dbg.getPlayerState(1);
      return {
        x: bot.x,
        y: bot.y,
        vx: bot.vx,
        vy: bot.vy,
        angle: bot.angle
      };
    });

    expect(botEscapeResult).not.toBeNull();
    // Bot should have moved inward away from (760, 560) towards center (400, 300)
    expect(botEscapeResult!.x).toBeLessThan(760);
    expect(botEscapeResult!.y).toBeLessThan(560);
    expect(botEscapeResult!.vx).toBeLessThan(0); // Moving left towards center
    expect(botEscapeResult!.vy).toBeLessThan(0); // Moving up towards center
  });

  test('Ships elastically bounce off each other preventing pinning in tight spots', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=cosmic_vortex&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    const collisionResult = await page.evaluate(() => {
      const dbg = (window as any).__COSMIC_VORTEX_DEBUG__;
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game || !dbg) return null;

      // Place P0 and P1 directly overlapping at (100, 100)
      dbg.setPlayerPos(0, 100, 100, 50, 0);
      dbg.setPlayerPos(1, 105, 100, -50, 0);

      // Run 2 frames of collision resolution
      game.update(1 / 60, 800, 600);
      game.update(1 / 60, 800, 600);

      const p0 = dbg.getPlayerState(0);
      const p1 = dbg.getPlayerState(1);
      const distance = Math.hypot(p1.x - p0.x, p1.y - p0.y);

      return {
        distance,
        p0vx: p0.vx,
        p1vx: p1.vx
      };
    });

    expect(collisionResult).not.toBeNull();
    // Overlapping ships must be pushed apart to at least ship collision radius
    expect(collisionResult!.distance).toBeGreaterThanOrEqual(28);
    // P0 bounced to the left (negative vx), P1 bounced to the right (positive vx)
    expect(collisionResult!.p0vx).toBeLessThan(0);
    expect(collisionResult!.p1vx).toBeGreaterThan(0);
  });
});
