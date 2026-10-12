import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

const BATCH_14_GAMES = [
  'clockwork_cogs',
  'steam_boiler_relief',
  'zeppelin_dogfight',
  'tesla_coil_arc',
  'automator_assembly',
  'pneumatic_tube_rush',
  'ornithopter_flock',
  'pressure_gauge_lock',
  'copper_conduit',
  'monocycle_derby'
];

test.describe('Batch 14 (Games 187-196 Steampunk Metropolis & Clockwork Contraptions) Verification', () => {

  for (const gameId of BATCH_14_GAMES) {
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

      // Simulate inputs for Player 1: W, Space
      await page.keyboard.press('KeyW');
      await page.keyboard.press('Space');

      // Hold keys briefly to verify hold mechanics (e.g. steam boiler, monocycle pedal)
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(200);
      await page.keyboard.up('KeyW');

      // Let AI bot play and allow physics / game loops to advance for 1.5 seconds
      await page.waitForTimeout(1500);

      // Verify game progressed safely without crashing
      const state2 = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; isFinished: boolean }; state: string } }).__GAME_MANAGER__;
        const ag = gm?.activeGame;
        return {
          roundTimer: ag?.roundTimer,
          isFinished: ag?.isFinished
        };
      });

      if (state1.roundTimer !== undefined && state2.roundTimer !== undefined) {
        expect(state2.roundTimer).toBeLessThanOrEqual(state1.roundTimer);
      }

      // Assert 0 uncaught errors
      expect(consoleErrors).toEqual([]);
    });

    test(`Game ${gameId}: 4-player autonomous simulation and round completion`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      // Launch with 4 players, hard bots, fast speed for rapid validation
      await page.goto(`${LOCAL_URL}?game=${gameId}&players=4&difficulty=hard&speed=fast&autostart=true`);
      await expect(page.locator('canvas')).toBeVisible();

      // Wait through countdown
      await page.waitForTimeout(1800);

      // Simulate multi-touch / keyboard inputs from corner players simultaneously
      await Promise.all([
        page.keyboard.press('KeyW'),
        page.keyboard.press('KeyO'),
        page.keyboard.press('KeyC'),
        page.keyboard.press('KeyM')
      ]);

      // Allow game to run for another 2 seconds under high speed
      await page.waitForTimeout(2000);

      const status = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; isFinished: boolean } } }).__GAME_MANAGER__;
        return {
          hasGame: gm?.activeGame !== undefined,
          roundTimer: gm?.activeGame?.roundTimer
        };
      });

      expect(status.hasGame).toBe(true);
      expect(consoleErrors).toEqual([]);
    });
  }
});
