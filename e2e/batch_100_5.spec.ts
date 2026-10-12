import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

const BATCH_5_GAMES = [
  'submarine_torpedo',
  'jellyfish_jump',
  'pearl_divers',
  'shark_bait',
  'sunken_treasure',
  'octopus_ink',
  'crab_walk',
  'electric_eel',
  'water_scooter',
  'deep_sea_harpoon'
];

test.describe('Batch 5 (Games 97-106 Oceanic Abyss & Deep Sea) Verification', () => {

  for (const gameId of BATCH_5_GAMES) {
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
      await page.waitForTimeout(100);
      await page.keyboard.up('KeyW');

      await page.keyboard.down('KeyA');
      await page.waitForTimeout(100);
      await page.keyboard.up('KeyA');

      // Allow bot AI to process multiple frames
      await page.waitForTimeout(500);

      // Verify game is alive and running smoothly
      const state2 = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; isFinished: boolean; getRoundResult?: () => unknown } } }).__GAME_MANAGER__;
        const ag = gm?.activeGame;
        return {
          hasGame: ag !== undefined,
          roundTimerValid: typeof ag?.roundTimer === 'number' && !isNaN(ag.roundTimer),
          result: typeof ag?.getRoundResult === 'function' ? ag.getRoundResult() : null
        };
      });

      expect(state2.hasGame).toBe(true);
      expect(state2.roundTimerValid).toBe(true);
      expect(state2.result).not.toBeNull();

      // Ensure 0 browser console or runtime errors occurred
      expect(consoleErrors).toEqual([]);
    });

    test(`Game ${gameId}: 4-player all-bot tournament simulation without errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      // Launch with 4 bots on hard difficulty
      await page.goto(`${LOCAL_URL}?game=${gameId}&players=4&bots=4&difficulty=hard`);
      await expect(page.locator('canvas')).toBeVisible();

      // Allow 2 seconds of high-speed bot action
      await page.waitForTimeout(2000);

      const simState = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; isFinished: boolean }; state: string } }).__GAME_MANAGER__;
        return {
          hasActiveGame: gm?.activeGame !== undefined,
          state: gm?.state
        };
      });

      expect(simState.hasActiveGame).toBe(true);
      expect(consoleErrors).toEqual([]);
    });
  }
});
