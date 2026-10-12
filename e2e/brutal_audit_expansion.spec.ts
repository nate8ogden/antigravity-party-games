import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

const EXPANSION_90_GAMES = [
  // Batch 2 (Games 67-76)
  'catapult_clash', 'jousting_knights', 'dragon_tamer', 'castle_archer',
  'drawbridge_panic', 'blacksmith_forge', 'potion_alchemist', 'royal_feast',
  'sword_in_stone', 'dungeon_escape',

  // Batch 3 (Games 77-86)
  'neon_drifters', 'hoverboard_rail', 'traffic_jam', 'nitro_kart',
  'monorail_hijack', 'drone_delivery', 'rocket_skates', 'cyber_demolition',
  'laser_speedway', 'gravity_pods',

  // Batch 4 (Games 87-96)
  'pancake_flipper', 'sushi_express', 'pizza_toss', 'burger_stack',
  'ice_cream_scoop', 'wok_stir_fry', 'donut_glazer', 'fruit_blender',
  'teppanyaki_catch', 'popcorn_popper',

  // Batch 5 (Games 97-106)
  'submarine_torpedo', 'jellyfish_jump', 'pearl_divers', 'shark_bait',
  'sunken_treasure', 'octopus_ink', 'crab_walk', 'electric_eel',
  'water_scooter', 'deep_sea_harpoon',

  // Batch 6 (Games 107-116)
  'moon_lander', 'space_junk_salvage', 'alien_probe', 'solar_flare',
  'wormhole_leap', 'astro_miner', 'nebula_drift', 'satellite_laser',
  'mars_rover', 'zero_g_tether',

  // Batch 7 (Games 117-126)
  'saloon_brawler', 'train_heist', 'gold_panning', 'rodeo_bull',
  'horseshoe_toss', 'dynamite_tumble', 'cactus_slalom', 'bandit_chase',
  'rattlesnake_reflex', 'western_poker',

  // Batch 8 (Games 127-136)
  'laser_tripwire', 'vault_safe', 'security_camera', 'briefcase_snatch',
  'hack_terminal', 'smoke_bomb_escape', 'micro_wiretap', 'rooftop_zipline',
  'drone_intercept', 'disguise_shuffle',

  // Batch 9 (Games 137-146)
  'synthwave_highway', 'drum_solo', 'turntable_scratch', 'bass_drop',
  'vocal_pitch', 'breakdance_battle', 'neon_metronome', 'equalizer_bounce',
  'retro_chiptune', 'disco_tile',

  // Batch 10 (Games 147-156)
  'ring_toss', 'rollercoaster_thrill', 'balloon_dart', 'dunk_tank',
  'ferris_wheel', 'funhouse_mirrors', 'cotton_candy', 'test_strength',
  'haunted_mansion', 'fireworks_finale'
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
  anomalies: string[];
}

test.describe('Brutal Honest 90-Game Expansion Deep Bug & NaN Audit (Games 67-156)', () => {
  for (const gameId of EXPANSION_90_GAMES) {
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
        // Fallback wait
      }

      // Simulate human inputs (WASD, Space, Arrow keys, Enter)
      await page.keyboard.press('KeyW');
      await page.keyboard.press('KeyA');
      await page.keyboard.press('KeyS');
      await page.keyboard.press('KeyD');
      await page.keyboard.down('Space');
      await page.waitForTimeout(150);
      await page.keyboard.up('Space');

      // Let simulation run with bot AI for another 1.2s
      await page.waitForTimeout(1200);

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
            anomalies: ['activeGame is null or undefined']
          };
        }

        // Check roundTimer
        const timer = ag.roundTimer;
        if (typeof timer !== 'number' || isNaN(timer) || !isFinite(timer)) {
          naNDetails.push(`roundTimer is invalid: ${timer}`);
        }

        // Recursive scan of activeGame object properties for NaN or Infinite values
        function scanObject(obj: any, path: string, depth = 0) {
          if (!obj || depth > 3) return;
          for (const key of Object.keys(obj)) {
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
          anomalies
        };
      }, gameId);

      // Assertions
      expect(consoleErrors, `Console errors detected in ${gameId}: ${consoleErrors.join(', ')}`).toEqual([]);
      expect(telemetry.hasActiveGame, `${gameId} failed to instance BaseGame`).toBe(true);
      expect(telemetry.hasNaN, `NaN values found in ${gameId}: ${telemetry.naNDetails.join('; ')}`).toBe(false);
      expect(telemetry.roundResultValid, `getRoundResult() invalid in ${gameId}: ${telemetry.anomalies.join('; ')}`).toBe(true);
      expect(telemetry.anomalies, `Anomalies found in ${gameId}: ${telemetry.anomalies.join('; ')}`).toEqual([]);
    });
  }
});
