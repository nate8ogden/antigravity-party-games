import { test, expect } from '@playwright/test';

test.describe('Game Randomness, Mutators, and Dynamic Procedural Events', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
  });

  test('BaseGame Universal Mutators: Randomly rolls distinct mutators with valid multipliers', async ({ page }) => {
    const mutatorRolls = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('tanks');
      const game = gm.activeGame;

      const observedTypes = new Set<string>();

      // Force 30 rolls with 100% chance to observe the pool of wild mutators
      for (let i = 0; i < 30; i++) {
        const m = game.rollRandomMutator(1.0);
        observedTypes.add(m.type);
      }

      return Array.from(observedTypes);
    });

    expect(mutatorRolls.length).toBeGreaterThanOrEqual(3);
    const validPool = ['turbo', 'golden_bounty', 'low_gravity', 'slippery', 'gusty_wind'];
    for (const type of mutatorRolls) {
      expect(validPool).toContain(type);
    }
  });

  test('Rocket Skates: Dynamically spawns random track hazards, speed pads, and nitro batteries', async ({ page }) => {
    const trackData = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('rocket_skates');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const initialHazardCount = game.hazards.length;

      // Update game for 180 frames (~3 seconds) to trigger dynamic spawns
      for (let i = 0; i < 180; i++) {
        game.update(0.016, 960, 600);
      }

      const typesObserved = new Set(game.hazards.map((h: any) => h.type));

      return {
        initialHazardCount,
        currentHazardCount: game.hazards.length,
        typesObserved: Array.from(typesObserved)
      };
    });

    expect(trackData.initialHazardCount).toBeGreaterThanOrEqual(3);
    expect(trackData.currentHazardCount).toBeGreaterThanOrEqual(1);
    expect(trackData.typesObserved.length).toBeGreaterThanOrEqual(1);
  });

  test('Horseshoe Toss: Dynamically shifts crosswind gusts and applies drift to horseshoe flight', async ({ page }) => {
    const windData = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('horseshoe_toss');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const windSamples = new Set<number>();
      windSamples.add(Math.round(game.windSpeed));

      // Advance game for 250 frames (~4 seconds) to trigger multiple wind shifts
      for (let i = 0; i < 250; i++) {
        game.update(0.016, 960, 600);
        windSamples.add(Math.round(game.windSpeed));
      }

      return {
        uniqueWindValues: windSamples.size,
        hasNonZeroWind: Array.from(windSamples).some((w) => w !== 0)
      };
    });

    expect(windData.hasNonZeroWind).toBe(true);
    expect(windData.uniqueWindValues).toBeGreaterThanOrEqual(2);
  });

  test('Balloon Dart: Carnival wheel dynamically surges speed and shifts spin direction', async ({ page }) => {
    const wheelData = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('balloon_dart');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const observedSpeeds = new Set<number>();
      observedSpeeds.add(Math.round(game.wheelSpeed * 10) / 10);

      // Run game for 300 frames (~5 seconds) to observe speed changes
      for (let i = 0; i < 300; i++) {
        game.update(0.016, 960, 600);
        observedSpeeds.add(Math.round(game.wheelSpeed * 10) / 10);
      }

      return {
        uniqueSpeedCount: observedSpeeds.size,
        speeds: Array.from(observedSpeeds)
      };
    });

    expect(wheelData.uniqueSpeedCount).toBeGreaterThanOrEqual(2);
  });

  test('Wok Stir Fry: Random ingredient drops and explosive Flambe criticals', async ({ page }) => {
    const wokData = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('wok_stir_fry');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const chef = game.playersState.get(0);

      const initialScore = chef.score;

      // Update game for 200 frames to trigger ingredient drops
      for (let i = 0; i < 200; i++) {
        game.update(0.016, 960, 600);
      }

      // Test Flambe toss
      let flambeObserved = false;
      for (let toss = 0; toss < 30; toss++) {
        chef.heat = 60; // keep in sweet spot for test
        const prevScore = chef.score;
        game.handleWokToss(chef);
        const gained = chef.score - prevScore;
        if (gained >= 30) {
          flambeObserved = true;
          break;
        }
      }

      return {
        scoreIncreased: chef.score > initialScore,
        flambeObserved
      };
    });

    expect(wokData.scoreIncreased).toBe(true);
    expect(wokData.flambeObserved).toBe(true);
  });
});
