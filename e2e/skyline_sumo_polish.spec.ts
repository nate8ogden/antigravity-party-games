import { test, expect } from '@playwright/test';

test.describe('Skyline Sumo - Polish, Platforms, Cloud Rescuer & Adaptive Zoom', () => {
  test('Platforms do not converge or overlap with each other', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const platformCheck = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (!gm) return null;
      gm.startGame('skyline_sumo');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      if (!game) return null;

      const platforms = game.platforms;
      let overlapsFound = 0;
      const details: string[] = [];

      for (let i = 0; i < platforms.length; i++) {
        for (let j = i + 1; j < platforms.length; j++) {
          const p1 = platforms[i];
          const p2 = platforms[j];
          const vertDist = Math.abs(p1.y - p2.y);
          // If vertically close (within 50px)
          if (vertDist < 50) {
            const p1Right = p1.x + p1.w;
            const p2Right = p2.x + p2.w;
            // Check if they overlap or lack horizontal clearance
            const overlap = !(p1Right + 50 <= p2.x || p1.x >= p2Right + 50);
            if (overlap) {
              overlapsFound++;
              details.push(`Overlap between Plat ${i} [${p1.x}, ${p1Right}, y=${p1.y}] and Plat ${j} [${p2.x}, ${p2Right}, y=${p2.y}]`);
            }
          }
        }
      }

      return { totalPlatforms: platforms.length, overlapsFound, details };
    });

    expect(platformCheck).not.toBeNull();
    expect(platformCheck!.totalPlatforms).toBeGreaterThan(15);
    expect(platformCheck!.overlapsFound).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Camera zooms out when players/CPU are under each other', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const zoomResults = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('skyline_sumo');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const p1 = game.climbers.get(0);
      const p2 = game.climbers.get(1);

      // Initial zoom when both on ground
      const initialZoom = game.cameraZoom;

      // Position Player 1 high up, Player 2 directly under Player 1
      p1.x = 400;
      p1.y = -350;
      p1.isGrounded = false;
      p1.vy = 0;

      p2.x = 400; // directly underneath
      p2.y = 250; // 600px vertical gap
      p2.isGrounded = false;
      p2.vy = 0;

      // Simulate a few frames of camera update
      for (let f = 0; f < 30; f++) {
        game.update(0.016, 800, 600);
      }

      const zoomedOutValue = game.cameraZoom;
      const cameraY = game.cameraY;

      // Calculate visible viewport
      const halfH = 600 / (2 * zoomedOutValue);
      const viewTop = cameraY + 300 - halfH;
      const viewBottom = cameraY + 300 + halfH;

      return {
        initialZoom,
        zoomedOutValue,
        viewTop,
        viewBottom,
        p1Y: p1.y,
        p2Y: p2.y
      };
    });

    // Zoom should decrease (zoom out) when players are vertically separated/under each other
    expect(zoomResults.zoomedOutValue).toBeLessThan(0.85);
    expect(zoomResults.zoomedOutValue).toBeGreaterThan(0.40);

    // Both players must be inside the visible vertical frame with comfortable margins
    expect(zoomResults.p1Y).toBeGreaterThan(zoomResults.viewTop);
    expect(zoomResults.p2Y).toBeLessThan(zoomResults.viewBottom);
  });

  test('Cloud dude picks up falling player and safely drops them off centered on nearest platform', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const rescueResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('skyline_sumo');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const p1 = game.climbers.get(0);
      // Place player in falling state below view
      p1.x = 350;
      p1.y = 750;
      p1.vy = 400;
      p1.isGrounded = false;
      p1.fallDuration = 1.5;

      // Trigger rescuer
      game.summonCloudRescuer(p1, 600);
      const targetPlat = game.rescuerTargetPlat;
      const targetPlatCenterX = game.rescuerTargetPlatX;
      const targetPlatY = game.rescuerTargetPlatY;

      // Simulate rescuer descent and lift steps until dropped
      for (let step = 0; step < 120; step++) {
        game.update(0.02, 800, 600);
        if (p1.isGrounded) break;
      }

      return {
        rescuerTriggered: targetPlat !== null,
        targetPlatCenterX,
        targetPlatY,
        finalClimberX: p1.x,
        finalClimberY: p1.y,
        isGrounded: p1.isGrounded
      };
    });

    expect(rescueResult.rescuerTriggered).toBe(true);
    expect(rescueResult.isGrounded).toBe(true);
    // Climber should be dropped right at the center of the platform
    expect(Math.abs(rescueResult.finalClimberX - rescueResult.targetPlatCenterX)).toBeLessThan(5);
    expect(Math.abs(rescueResult.finalClimberY - rescueResult.targetPlatY)).toBeLessThan(5);
  });
});
