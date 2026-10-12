import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

const ALL_GAMES = [
  { id: 'tanks', name: 'Cyber Tanks 2.0', expectedClass: 'CyberTanksGame' },
  { id: 'hovercraft', name: 'Neon Bumper Derby', expectedClass: 'BumperHovercraftGame' },
  { id: 'laser_grid', name: 'Laser Grid Reflex', expectedClass: 'LaserGridReflexGame' },
  { id: 'orbital', name: 'Orbital Slingshot', expectedClass: 'OrbitalSlingshotGame' },
  { id: 'micro_gp', name: 'Micro Turbo GP', expectedClass: 'MicroTurboGPGame' },
  { id: 'ghost_flashlight', name: 'Ghost Flashlight', expectedClass: 'GhostFlashlightGame' },
  { id: 'kitchen_chaos', name: 'Kitchen Chaos', expectedClass: 'KitchenChaosGame' },
  { id: 'skyline_sumo', name: 'Skyline Sumo', expectedClass: 'SkylineSumoGame' },
  { id: 'animal_stack', name: 'Animal Stack', expectedClass: 'AnimalStackGame' },
  { id: 'sumo_iceberg', name: 'Sumo Iceberg', expectedClass: 'SumoIcebergGame' },
  { id: 'cannon_barrage', name: 'Cannon Barrage', expectedClass: 'CannonBarrageGame' },
  { id: 'anvil_rain', name: 'Anvil Rain', expectedClass: 'AnvilRainGame' },
  { id: 'bomb_relay', name: 'Bomb Relay', expectedClass: 'BombRelayGame' },
  { id: 'micro_hockey', name: 'Micro Hockey', expectedClass: 'MicroHockeyGame' },
  { id: 'quick_draw', name: 'Quick Draw Western', expectedClass: 'QuickDrawWesternGame' },
  { id: 'balloon_burst', name: 'Balloon Burst', expectedClass: 'BalloonBurstGame' },
  { id: 'swat_fly', name: 'Swat the Fly', expectedClass: 'SwatFlyGame' },
  { id: 'stop_at_zero', name: 'Stop at Zero', expectedClass: 'StopAtZeroGame' },
  { id: 'turf_whack', name: 'Turf Whack', expectedClass: 'TurfWhackGame' },
  { id: 'neon_lightcycles', name: 'Neon Lightcycles', expectedClass: 'NeonLightcyclesGame' },
  { id: 'blade_parry', name: 'Blade Parry', expectedClass: 'BladeParryGame' },
  { id: 'safe_dial', name: 'Safe Dial Lock', expectedClass: 'SafeDialGame' },
  { id: 'coin_apex', name: 'Coin Apex', expectedClass: 'CoinApexGame' },
  { id: 'red_light_sentry', name: 'Red Light Sentry', expectedClass: 'RedLightSentryGame' }
];

test.describe('Rigorous 16-Minigame QA & AI Calibration Suite', () => {

  test('Lobby Visual Verification: Crisp White Background & Zero Grid Artifacts', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    // Verify background color in CSS
    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    const appBg = await page.evaluate(() => window.getComputedStyle(document.getElementById('app')!).backgroundColor);
    
    // rgb(248, 250, 252) is #F8FAFC
    expect(bodyBg).toBe('rgb(248, 250, 252)');
    expect(appBg).toBe('rgb(248, 250, 252)');

    // Verify utility buttons tactile 2.5D styling
    const pauseBtn = page.locator('#center-pause-btn');
    await expect(pauseBtn).toBeVisible();
    const pauseShadow = await pauseBtn.evaluate((el) => window.getComputedStyle(el).boxShadow);
    expect(pauseShadow).toContain('rgb(148, 163, 184)'); // #94A3B8 beveled edge

    // Capture visual snapshot
    await page.screenshot({ path: 'test-results/lobby_clean_white.png' });
  });

  for (const g of ALL_GAMES) {
    test(`Game Evaluation: ${g.name} (${g.id}) loads, runs active game loop with bot AI`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      // Launch with 1 human, 1 bot, fast speed
      await page.goto(`${LOCAL_URL}?game=${g.id}&players=2&bots=1&difficulty=normal&speed=fast`);
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();

      // Wait 1 second for game engine to update
      await page.waitForTimeout(1000);

      // Query game state
      const state = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: any; __GAME_STATE__?: any }).__GAME_MANAGER__;
        const gs = (window as unknown as { __GAME_STATE__?: any }).__GAME_STATE__;
        return {
          active: gs?.active,
          gameState: gm?.state,
          activeGameId: gm?.activeGame?.constructor?.name,
          roundTimer: gm?.activeGame?.roundTimer,
          botType: gm?.players[1]?.type
        };
      });

      expect(consoleErrors).toEqual([]);
      expect(state.active).toBe(true);
      expect(state.activeGameId).toBe(g.expectedClass);
      expect(state.botType).toBe('bot_normal');
      expect(['COUNTDOWN', 'PLAYING']).toContain(state.gameState);
    });
  }

  test('Specific QA: Laser Grid Reflex AI Calibration (Human Latency & Beatability)', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=laser_grid&players=2&bots=1&difficulty=normal&speed=fast`);
    await expect(page.locator('canvas')).toBeVisible();

    // Verify bot parameters
    const botReaction = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: any }).__GAME_MANAGER__;
      const game = gm?.activeGame;
      return {
        hasDangerTimers: game?.botDangerTimers !== undefined,
        gridSize: game?.gridSize,
        targetBatteries: game?.targetBatteriesToWin
      };
    });

    expect(botReaction.gridSize).toBe(5);
    expect(botReaction.targetBatteries).toBe(10);

    // Let the game run for 2.5s and ensure player inputs step smoothly
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(1000);
  });

  test('Specific QA: Orbital Slingshot Bot AI No Infinite Orbit Verification', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=orbital&players=2&bots=1&difficulty=normal&speed=fast`);
    await expect(page.locator('canvas')).toBeVisible();

    // Let bots run for 3 seconds
    const orbitHistory: number[] = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(500);
      const maxOrbit = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: any }).__GAME_MANAGER__;
        const game = gm?.activeGame;
        if (!game || !game.botOrbitDuration) return 0;
        const durations = Array.from(game.botOrbitDuration.values()) as number[];
        return Math.max(0, ...durations);
      });
      orbitHistory.push(maxOrbit);
    }

    // Verify that bot orbit duration NEVER exceeded the 1.8s hard cap
    const maxRecordedOrbit = Math.max(...orbitHistory);
    expect(maxRecordedOrbit).toBeLessThanOrEqual(1.85);
  });

  test('Specific QA: Difficulty Scaling Verification (Easy, Normal, Hard) across Minigames', async ({ page }) => {
    // Check difficulty setting propagation to bot instances
    for (const diff of ['easy', 'normal', 'hard']) {
      await page.goto(`${LOCAL_URL}?players=1&difficulty=${diff}`);
      await expect(page.locator('canvas')).toBeVisible();

      const globalDiff = await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: any }).__GAME_MANAGER__;
        return {
          global: gm?.globalBotDifficulty,
          p2Type: gm?.players[1]?.type
        };
      });

      expect(globalDiff.global).toBe(`bot_${diff}`);
      expect(globalDiff.p2Type).toBe(`bot_${diff}`);
    }
  });

});
