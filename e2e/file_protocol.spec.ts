import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('File Protocol Execution (No Web Server Required)', () => {
  test('Launches directly via file:// index.html with no server running', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const distPath = path.resolve(process.cwd(), 'Antigravity_Games.html');
    const fileUrl = `file://${distPath}`;

    await page.goto(fileUrl);
    await page.waitForTimeout(500);

    const isLoaded = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      return {
        hasGameManager: !!gm,
        hasCanvas: !!canvas,
        canvasWidth: canvas?.width,
        canvasHeight: canvas?.height,
        gameState: gm?.state
      };
    });

    expect(isLoaded.hasCanvas).toBe(true);
    expect(isLoaded.hasGameManager).toBe(true);
    expect(isLoaded.gameState).toBe('LOBBY');
    expect(pageErrors.length).toBe(0);

    // Start a minigame on file:// protocol
    const gameStarted = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('skyline_sumo');
      gm.state = 'PLAYING';
      return gm.state === 'PLAYING' && !!gm.activeGame;
    });

    expect(gameStarted).toBe(true);

    // Let game loop run for 800ms
    await page.waitForTimeout(800);
    expect(pageErrors.length).toBe(0);
  });
});
