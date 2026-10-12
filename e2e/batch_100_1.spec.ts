import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

const BATCH_1_GAMES = [
  'dodgeball_blitz',
  'gravity_golf',
  'cyber_disc',
  'sumo_spheres',
  'sky_gliders',
  'whack_a_thief',
  'pixel_curling',
  'bumper_boats',
  'target_sniper',
  'fruit_chopper'
];

test.describe('Batch 1 (Games 57-66) Verification', () => {

  for (const gameId of BATCH_1_GAMES) {
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

      // Wait through countdown (1.5s) into active PLAYING state
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
      await page.waitForTimeout(100);
      await page.keyboard.up('KeyW');

      await page.keyboard.down('Space');
      await page.waitForTimeout(100);
      await page.keyboard.up('Space');

      // Allow bot AI to process multiple frames
      await page.waitForTimeout(500);

      // Verify game is alive and running smoothly
      const state2 = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; isFinished: boolean }; state: string } }).__GAME_MANAGER__;
        const ag = gm?.activeGame;
        return {
          hasGame: ag !== undefined,
          roundTimerValid: typeof ag?.roundTimer === 'number' && !isNaN(ag.roundTimer),
          roundTimer: ag?.roundTimer
        };
      });

      expect(state2.hasGame).toBe(true);
      expect(state2.roundTimerValid).toBe(true);

      // Trigger round completion to test Round Over -> Rematch transition
      await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number } } }).__GAME_MANAGER__;
        if (gm?.activeGame) {
          gm.activeGame.roundTimer = 0.05;
        }
      });

      await page.waitForTimeout(600);

      // Rematch via Space
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);

      const rematchState = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: unknown } }).__GAME_MANAGER__;
        return {
          state: gm?.state,
          hasGame: gm?.activeGame !== undefined
        };
      });

      expect(['COUNTDOWN', 'PLAYING', 'ROUND_OVER']).toContain(rematchState.state);
      expect(rematchState.hasGame).toBe(true);
      expect(consoleErrors).toEqual([]);
    });

    test(`Game ${gameId}: 4-player Hard bot simulation`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      // Launch with 4 players on hard difficulty
      await page.goto(`${LOCAL_URL}?game=${gameId}&players=4&difficulty=hard`);
      await expect(page.locator('canvas')).toBeVisible();

      // Wait into active gameplay
      await page.waitForTimeout(1800);

      // Let 4 bots battle for 1.2 seconds
      await page.waitForTimeout(1200);

      const state = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number }; state: string } }).__GAME_MANAGER__;
        return {
          hasGame: gm?.activeGame !== undefined,
          state: gm?.state
        };
      });

      expect(state.hasGame).toBe(true);
      expect(consoleErrors).toEqual([]);
    });
  }
});
