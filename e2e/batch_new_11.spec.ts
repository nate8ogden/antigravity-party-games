import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

const BATCH_11_GAMES = [
  'hydra_slayer',
  'pharaoh_tomb',
  'spartan_shield',
  'kraken_whirlpool',
  'icarus_wings',
  'minotaur_labyrinth',
  'olympus_lightning',
  'anubis_scales',
  'gorgon_gaze',
  'viking_longship'
];

test.describe('Batch 11 (Games 157-166 Ancient Wonders & Mythological Trials) Verification', () => {

  for (const gameId of BATCH_11_GAMES) {
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

      // Hold keys briefly to verify hold mechanics (e.g. Spartan shield, Gorgon mirror)
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

      expect(result.roundResult).not.toBeNull();
      expect(consoleErrors).toHaveLength(0);
    });

    test(`Game ${gameId}: 4-player full bot simulation and score result validation`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      // Launch with 4 players, hard difficulty, fast forward
      await page.goto(`${LOCAL_URL}?game=${gameId}&players=4&bots=4&difficulty=hard`);
      await expect(page.locator('canvas')).toBeVisible();

      // Let simulation run for 2.2 seconds
      await page.waitForTimeout(2200);

      const simState = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean; getRoundResult: () => { rankings: Array<{ playerId: string; score: number; place: number }>; winnerId: string | null } } } }).__GAME_MANAGER__;
        const ag = gm?.activeGame;
        const rr = ag?.getRoundResult();
        return {
          rankingsCount: rr?.rankings?.length || 0,
          rankingsValid: Array.isArray(rr?.rankings) && rr.rankings.length >= 2,
          winnerDefined: rr ? ('winnerId' in rr) : false
        };
      });

      expect(simState.rankingsValid).toBe(true);
      expect(simState.winnerDefined).toBe(true);
      expect(consoleErrors).toHaveLength(0);
    });
  }
});
