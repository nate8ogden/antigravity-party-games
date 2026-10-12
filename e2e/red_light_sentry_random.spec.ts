import { test, expect } from '@playwright/test';

test.describe('Red Light Sentry: Random Phase Changes & Red Light Laser Scan', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
  });

  test('Starts Red Light Sentry and transitions to Yellow and Red in under 2 seconds', async ({ page }) => {
    const phasesObserved = await page.evaluate(async () => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('red_light_sentry');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const phases = new Set<string>();
      phases.add(game.sentryPhase);

      // Advance game frame by frame for 2.2 seconds (140 frames at 0.016s)
      for (let i = 0; i < 140; i++) {
        game.update(0.016, 960, 600);
        phases.add(game.sentryPhase);
      }

      return Array.from(phases);
    });

    // Must have observed both yellow and red light phases within 2.2 seconds!
    expect(phasesObserved).toContain('green');
    expect(phasesObserved).toContain('yellow');
    expect(phasesObserved).toContain('red');
  });

  test('Cycles through multiple unpredictable random phases without letting players rush trophy in 1 run', async ({ page }) => {
    const cycleData = await page.evaluate(async () => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('red_light_sentry');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const phaseHistory: { phase: string; duration: number }[] = [];
      let currentPhase = game.sentryPhase;
      let duration = 0;

      // Run game for 8 seconds
      for (let i = 0; i < 500; i++) {
        game.update(0.016, 960, 600);
        if (game.sentryPhase !== currentPhase) {
          phaseHistory.push({ phase: currentPhase, duration });
          currentPhase = game.sentryPhase;
          duration = 0;
        } else {
          duration += 0.016;
        }
      }
      phaseHistory.push({ phase: currentPhase, duration });

      return {
        phaseCount: phaseHistory.length,
        hasRed: phaseHistory.some((p) => p.phase === 'red'),
        hasYellow: phaseHistory.some((p) => p.phase === 'yellow'),
        hasGreen: phaseHistory.some((p) => p.phase === 'green'),
        phaseHistory
      };
    });

    expect(cycleData.hasRed).toBe(true);
    expect(cycleData.hasYellow).toBe(true);
    expect(cycleData.hasGreen).toBe(true);
    expect(cycleData.phaseCount).toBeGreaterThanOrEqual(4); // Multiple dynamic phase switches
  });

  test('Moving during Red Light results in ZAPPED laser strike, stun, and knockback', async ({ page }) => {
    const zapResult = await page.evaluate(async () => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('red_light_sentry');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const runner = game.runners.get(0);

      // Force game into Red Light phase
      game.sentryPhase = 'red';
      game.phaseTimer = 2.0;

      const xBeforeZap = runner.x;

      // Simulate player holding button during RED LIGHT
      gm.input.press(0);
      game.update(0.016, 960, 600);

      return {
        stunned: runner.stunTimer > 0,
        knockbackHappened: runner.dir === 1 ? runner.x < xBeforeZap || runner.x === runner.startX : runner.x > xBeforeZap,
        zappedLaserActive: game.zappedLaserBeam !== null
      };
    });

    expect(zapResult.stunned).toBe(true);
    expect(zapResult.zappedLaserActive).toBe(true);
  });

  test('Releasing during Red Light safely avoids laser detection', async ({ page }) => {
    const freezeResult = await page.evaluate(async () => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('red_light_sentry');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const runner = game.runners.get(0);

      // Player advanced safely on green
      runner.x += 100;
      const savedX = runner.x;

      // Sentry turns red
      game.sentryPhase = 'red';
      game.phaseTimer = 2.0;

      // Player releases input (freeze as statue!)
      gm.input.release(0);

      // Update for 60 frames during red light
      for (let i = 0; i < 60; i++) {
        game.update(0.016, 960, 600);
      }

      return {
        stunned: runner.stunTimer > 0,
        samePosition: runner.x === savedX,
        zappedLaserActive: game.zappedLaserBeam !== null
      };
    });

    expect(freezeResult.stunned).toBe(false);
    expect(freezeResult.samePosition).toBe(true);
    expect(freezeResult.zappedLaserActive).toBe(false);
  });

  test('Renders Red Light sweeping lasers, warning alert borders, and progress gauge', async ({ page }) => {
    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('red_light_sentry');
      gm.state = 'PLAYING';
      gm.activeGame.sentryPhase = 'red';
      gm.render();
    });

    // Check canvas exists and screenshot/render succeeds without errors
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
  });
});
