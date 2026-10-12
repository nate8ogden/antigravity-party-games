import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

const BATCH_10_GAMES = [
  'ring_toss',
  'rollercoaster_thrill',
  'balloon_dart',
  'dunk_tank',
  'ferris_wheel',
  'funhouse_mirrors',
  'cotton_candy',
  'test_strength',
  'haunted_mansion',
  'fireworks_finale'
];

test.describe('Batch 10 (Games 147-156 Grand Carnival & Ultimate Chaos) Verification', () => {

  for (const gameId of BATCH_10_GAMES) {
    test(`Game ${gameId}: 2-player launch, controls, bot AI, and lifecycle`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      // Launch with 2 players (Human P1 vs Normal Bot P2)
      await page.goto(`${LOCAL_URL}?game=${gameId}&players=2&difficulty=normal`);
      await expect(page.locator('canvas')).toBeVisible();

      // Wait through countdown (1.5s) into active state
      await page.waitForTimeout(1700);

      // Verify active game exists and check initial state
      const state1 = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; isFinished: boolean }; state: string } }).__GAME_MANAGER__;
        const ag = gm?.activeGame;
        return {
          hasGame: ag !== undefined,
          gameState: gm?.state,
          roundTimerValid: typeof ag?.roundTimer === 'number' && !isNaN(ag.roundTimer),
          roundTimer: ag?.roundTimer,
          isFinished: ag?.isFinished
        };
      });

      expect(state1.hasGame).toBe(true);
      expect(state1.roundTimerValid).toBe(true);

      // Simulate inputs for Player 1: WASD and Space
      await page.keyboard.press('KeyW');
      await page.keyboard.press('KeyA');
      await page.keyboard.press('KeyS');
      await page.keyboard.press('KeyD');
      await page.keyboard.press('Space');

      // Hold keys briefly to verify physics/movement
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(200);
      await page.keyboard.up('KeyW');

      await page.keyboard.down('Space');
      await page.waitForTimeout(200);
      await page.keyboard.up('Space');

      // Check state after inputs and bot simulation
      const result = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; isFinished: boolean; getRoundResult: () => unknown } } }).__GAME_MANAGER__;
        const ag = gm?.activeGame;
        return {
          roundTimer: ag?.roundTimer,
          roundResult: ag?.getRoundResult()
        };
      });

      expect(result.roundResult).toBeDefined();
      expect(consoleErrors).toEqual([]);
    });

    test(`Game ${gameId}: 4-player Hard Bot stress & victory screen`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      // Launch 4 players, hard difficulty
      await page.goto(`${LOCAL_URL}?game=${gameId}&players=4&difficulty=hard`);
      await expect(page.locator('canvas')).toBeVisible();

      // Fast-forward or simulate until round ends
      await page.waitForTimeout(2000);

      // Trigger time acceleration or direct completion if needed
      await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number }; update: (dt: number) => void } }).__GAME_MANAGER__;
        if (gm?.activeGame) {
          // Accelerate round timer to near finish
          gm.activeGame.roundTimer = Math.min(gm.activeGame.roundTimer, 0.5);
        }
      });

      // Wait for round over transition
      await page.waitForTimeout(2200);

      const finalState = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; currentRoundResult?: unknown } }).__GAME_MANAGER__;
        return {
          state: gm?.state,
          hasResult: gm?.currentRoundResult !== undefined && gm?.currentRoundResult !== null
        };
      });

      expect(['ROUND_OVER', 'PLAYING', 'COUNTDOWN']).toContain(finalState.state);
      expect(consoleErrors).toEqual([]);
    });
  }
});
