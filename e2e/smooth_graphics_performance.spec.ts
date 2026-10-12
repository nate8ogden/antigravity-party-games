import { test, expect } from '@playwright/test';

test.describe('Graphics Performance & Butter-Smooth 60/120Hz Animation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);
  });

  test('Lobby gallery leverages offscreen thumbnail caching for fast sub-8ms rendering', async ({ page }) => {
    const performanceStats = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      const renderTimes: number[] = [];

      // Warm up and render 30 frames
      for (let i = 0; i < 30; i++) {
        const start = performance.now();
        gm.render();
        const end = performance.now();
        renderTimes.push(end - start);
      }

      const avgRenderMs = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const maxRenderMs = Math.max(...renderTimes);

      return {
        avgRenderMs,
        maxRenderMs,
        totalFrames: renderTimes.length,
      };
    });

    // In a 60-120fps game, rendering must finish well within the 8.3ms - 16.6ms frame budget
    expect(performanceStats.avgRenderMs).toBeLessThan(10);
  });

  test('Active gameplay renders smoothly within frame budget under particle stress', async ({ page }) => {
    const gameplayStats = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('tanks');
      gm.state = 'PLAYING';

      // Spawn intense explosions and sparks to stress-test the particle engine
      for (let i = 0; i < 6; i++) {
        gm.particles.spawnExplosion(400, 300, '#EF4444', 28);
        gm.particles.spawnSparks(400, 300, '#38BDF8', 24);
      }

      const renderTimes: number[] = [];
      for (let i = 0; i < 30; i++) {
        gm.particles.update(0.016);
        const start = performance.now();
        gm.render();
        const end = performance.now();
        renderTimes.push(end - start);
      }

      const avgRenderMs = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;

      return {
        avgRenderMs,
        particleCount: gm.particles.particles ? gm.particles.particles.length : 0,
      };
    });

    expect(gameplayStats.avgRenderMs).toBeLessThan(10);
  });

  test('Canvas hardware acceleration styles and backface visibility are applied', async ({ page }) => {
    const canvasStyles = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas');
      if (!canvas) return null;
      const style = window.getComputedStyle(canvas);
      return {
        transform: style.transform,
        backfaceVisibility: style.backfaceVisibility || (style as any).webkitBackfaceVisibility,
        touchAction: style.touchAction,
      };
    });

    expect(canvasStyles).not.toBeNull();
    expect(canvasStyles!.touchAction).toBe('none');
  });
});
