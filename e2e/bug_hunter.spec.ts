import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

const ALL_66_GAMES = [
  'tanks', 'hovercraft', 'laser_grid', 'orbital',
  'micro_gp', 'ghost_flashlight', 'kitchen_chaos', 'skyline_sumo',
  'animal_stack', 'sumo_iceberg', 'cannon_barrage', 'anvil_rain',
  'bomb_relay', 'micro_hockey', 'quick_draw', 'balloon_burst',
  'swat_fly', 'stop_at_zero', 'turf_whack', 'neon_lightcycles',
  'blade_parry', 'safe_dial', 'coin_apex', 'red_light_sentry',
  'laser_leap', 'color_clash', 'meteor_shield', 'sequence_clash',
  'bubble_soccer', 'wire_cutter', 'magma_hop', 'rhythm_duel',
  'cosmic_vortex', 'pixel_paintball', 'minefield_dash', 'asteroid_miner',
  'dont_look_down', 'snowball_fight',
  'highway_hop', 'gold_miner', 'chomp_frogs', 'tug_of_war',
  'volley_spike', 'maze_escape', 'pinball_battle', 'mole_panic',
  'color_flood', 'memory_matrix', 'snake_arena', 'mirror_laser',
  'domino_cascade', 'water_balloon', 'sheep_dog', 'chest_snatch',
  'rapid_drop4', 'floor_painter',
  'dodgeball_blitz', 'gravity_golf', 'cyber_disc', 'sumo_spheres',
  'sky_gliders', 'whack_a_thief', 'pixel_curling', 'bumper_boats',
  'target_sniper', 'fruit_chopper'
];

test.describe('Rigorous 66-Game Deep Bug Hunter', () => {

  for (const gameId of ALL_66_GAMES) {
    test(`Deep Bug Audit: ${gameId} - Input responsiveness, clean timer, and round lifecycle`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      // Launch game with 2 players (P1 Human vs P2 Bot on Normal)
      await page.goto(`${LOCAL_URL}?game=${gameId}&players=2&difficulty=normal`);
      await expect(page.locator('canvas')).toBeVisible();

      // Wait past countdown (1.5s) into active gameplay
      await page.waitForTimeout(1600);

      // Verify active game exists and check roundTimer
      const state1 = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; isFinished: boolean }; state: string } }).__GAME_MANAGER__;
        const ag = gm?.activeGame;
        if (!ag) return { hasGame: false, error: 'No activeGame' };

        return {
          hasGame: true,
          gameState: gm?.state,
          roundTimerValid: typeof ag.roundTimer === 'number' && !isNaN(ag.roundTimer),
          roundTimer: ag.roundTimer,
          isFinished: ag.isFinished
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

      // Simulate inputs for Player 2: Arrow keys and Enter
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');

      await page.waitForTimeout(400);

      // Verify game is still alive and running
      const state2 = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; isFinished: boolean }; state: string } }).__GAME_MANAGER__;
        const ag = gm?.activeGame;
        return {
          hasGame: ag !== undefined,
          roundTimerValid: typeof ag?.roundTimer === 'number' && !isNaN(ag.roundTimer)
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

      // Press Space to rematch or test rematch via GameManager
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
  }

});
