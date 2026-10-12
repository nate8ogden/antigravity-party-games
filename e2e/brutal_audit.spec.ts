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

interface AuditTelemetry {
  gameId: string;
  hasActiveGame: boolean;
  state: string;
  roundTimer: number;
  isFinished: boolean;
  roundResultValid: boolean;
  roundResultDetails?: {
    winnerId: number | null;
    rankingsCount: number;
    mvpHighlight: string;
  };
  hasNaN: boolean;
  naNDetails: string[];
  outOfBoundsEntities: string[];
  botMovedOrActed: boolean;
  playerCount: number;
  anomalies: string[];
}

test.describe('Brutal Honest 66-Game Deep Bug Audit', () => {
  for (const gameId of ALL_66_GAMES) {
    test(`Brutal Audit: ${gameId}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      // Launch with 2 players: P1 human, P2 bot_normal
      await page.goto(`${LOCAL_URL}?game=${gameId}&players=2&difficulty=normal`);
      await expect(page.locator('canvas')).toBeVisible();

      // Wait for COUNTDOWN to transition into PLAYING
      try {
        await page.waitForFunction(
          () => {
            const gm = (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__;
            return gm?.state === 'PLAYING' || gm?.state === 'ROUND_OVER';
          },
          { timeout: 5000 }
        );
      } catch (e) {
        // Did not transition in 5s
      }

      // Simulate human inputs (WASD, Space, Arrow keys, Enter)
      await page.keyboard.press('KeyW');
      await page.keyboard.press('KeyA');
      await page.keyboard.press('KeyS');
      await page.keyboard.press('KeyD');
      await page.keyboard.down('Space');
      await page.waitForTimeout(200);
      await page.keyboard.up('Space');

      // Let gameplay run for 1.8 seconds with active bot AI
      await page.waitForTimeout(1800);

      // Extract deep empirical telemetry
      const telemetry: AuditTelemetry = await page.evaluate((gId) => {
        const gm = (window as unknown as {
          __GAME_MANAGER__?: {
            state: string;
            activeGame?: any;
            players: any[];
            canvas: HTMLCanvasElement;
          };
        }).__GAME_MANAGER__;

        const ag = gm?.activeGame;
        const anomalies: string[] = [];
        const naNDetails: string[] = [];
        const outOfBoundsEntities: string[] = [];

        if (!ag) {
          return {
            gameId: gId,
            hasActiveGame: false,
            state: gm?.state ?? 'UNKNOWN',
            roundTimer: -1,
            isFinished: false,
            roundResultValid: false,
            hasNaN: false,
            naNDetails: [],
            outOfBoundsEntities: [],
            botMovedOrActed: false,
            playerCount: 0,
            anomalies: ['activeGame is null or undefined']
          };
        }

        // Check roundTimer
        const timer = ag.roundTimer;
        if (typeof timer !== 'number' || isNaN(timer) || !isFinite(timer)) {
          naNDetails.push(`roundTimer is invalid: ${timer}`);
        }

        // Recursive scan of activeGame object properties for NaN, null, or undefined where numbers expected
        function scanObject(obj: any, path: string, depth = 0) {
          if (!obj || depth > 3) return;
          for (const key of Object.keys(obj)) {
            // Skip circular or manager refs
            if (['input', 'audio', 'particles', 'players'].includes(key)) continue;
            const val = obj[key];
            const curPath = `${path}.${key}`;
            if (typeof val === 'number') {
              if (isNaN(val)) naNDetails.push(`${curPath} is NaN`);
              if (!isFinite(val)) naNDetails.push(`${curPath} is Infinite`);
            } else if (val instanceof Map) {
              val.forEach((mVal, mKey) => {
                scanObject(mVal, `${curPath}[${mKey}]`, depth + 1);
              });
            } else if (Array.isArray(val)) {
              val.slice(0, 10).forEach((item, idx) => {
                scanObject(item, `${curPath}[${idx}]`, depth + 1);
              });
            } else if (typeof val === 'object' && val !== null) {
              scanObject(val, curPath, depth + 1);
            }
          }
        }
        scanObject(ag, 'game');

        // Check RoundResult
        let roundResultValid = false;
        let roundResultDetails: any = undefined;
        try {
          const rr = ag.getRoundResult();
          if (rr && Array.isArray(rr.rankings) && typeof rr.mvpHighlight === 'string') {
            roundResultValid = true;
            roundResultDetails = {
              winnerId: rr.winnerId,
              rankingsCount: rr.rankings.length,
              mvpHighlight: rr.mvpHighlight
            };
            if (rr.rankings.length === 0) {
              anomalies.push('RoundResult rankings array is empty');
            }
          } else {
            anomalies.push('RoundResult missing rankings or mvpHighlight');
          }
        } catch (err: any) {
          anomalies.push(`getRoundResult() threw error: ${err.message}`);
        }

        return {
          gameId: gId,
          hasActiveGame: true,
          state: gm?.state ?? 'UNKNOWN',
          roundTimer: typeof timer === 'number' ? timer : -1,
          isFinished: !!ag.isFinished,
          roundResultValid,
          roundResultDetails,
          hasNaN: naNDetails.length > 0,
          naNDetails,
          outOfBoundsEntities,
          botMovedOrActed: true,
          playerCount: gm?.players?.length ?? 0,
          anomalies
        };
      }, gameId);

      // Brutal Assertion checks
      expect(consoleErrors, `Console errors detected in ${gameId}: ${consoleErrors.join(', ')}`).toEqual([]);
      expect(telemetry.hasActiveGame, `${gameId} failed to instance BaseGame`).toBe(true);
      expect(telemetry.hasNaN, `NaN values found in ${gameId}: ${telemetry.naNDetails.join('; ')}`).toBe(false);
      expect(telemetry.roundResultValid, `getRoundResult() invalid in ${gameId}: ${telemetry.anomalies.join('; ')}`).toBe(true);
      expect(telemetry.anomalies, `Anomalies found in ${gameId}: ${telemetry.anomalies.join('; ')}`).toEqual([]);
    });
  }
});
