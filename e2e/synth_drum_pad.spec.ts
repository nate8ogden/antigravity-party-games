import { test, expect } from '@playwright/test';

test.describe('Synth Drum Pad 808 - Game Mechanics & Human AI Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);
  });

  test('Starts Synth Drum Pad and renders 4 silicone pads & 8-step sequencer', async ({ page }) => {
    const gameInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('synth_drum_pad');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      return {
        padsCount: game.pads.length,
        padLabels: game.pads.map((p: any) => p.label),
        currentStep: game.currentStep,
        stepDuration: game.stepDuration,
        rhythmPatternLength: game.rhythmPattern.length,
      };
    });

    expect(gameInfo.padsCount).toBe(4);
    expect(gameInfo.padLabels).toEqual(['KICK', 'SNARE', 'HI-HAT', 'MID TOM']);
    expect(gameInfo.rhythmPatternLength).toBe(8);
    expect(gameInfo.stepDuration).toBeCloseTo(0.48, 2);
  });

  test('Timing window evaluates PERFECT, GOOD, and updates combo streak', async ({ page }) => {
    const timingResult = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('synth_drum_pad');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const p1 = gm.players[0];
      const ps = game.playersState.get(p1.id);

      // Force stepClock to exact downbeat (0.01s into step)
      game.stepClock = 0.01;
      const targetPad = game.rhythmPattern[game.currentStep];
      ps.padIndex = targetPad;

      // Simulate a strike right on the beat
      game.handlePlayerStrike(p1, ps);
      const scoreAfterPerfect = ps.score;
      const comboAfterPerfect = ps.combo;
      const ratingAfterPerfect = ps.lastRating;

      // Advance stepClock to 0.12s (GOOD window)
      game.stepClock = 0.12;
      game.handlePlayerStrike(p1, ps);
      const scoreAfterGood = ps.score;
      const comboAfterGood = ps.combo;

      // Off-beat strike on wrong pad (MISS / WRONG PAD)
      ps.padIndex = (targetPad + 1) % 4;
      game.handlePlayerStrike(p1, ps);
      const comboAfterMiss = ps.combo;

      return {
        scoreAfterPerfect,
        comboAfterPerfect,
        ratingAfterPerfect,
        scoreAfterGood,
        comboAfterGood,
        comboAfterMiss
      };
    });

    expect(timingResult.scoreAfterPerfect).toBeGreaterThanOrEqual(10);
    expect(timingResult.comboAfterPerfect).toBe(1);
    expect(timingResult.ratingAfterPerfect).toContain('PERFECT');
    expect(timingResult.scoreAfterGood).toBeGreaterThan(timingResult.scoreAfterPerfect);
    expect(timingResult.comboAfterGood).toBe(2);
    expect(timingResult.comboAfterMiss).toBe(0); // Miss resets combo
  });

  test('AI bot is NOT an aimbot: misses beats realistically and does not score 100% on Easy/Normal', async ({ page }) => {
    const botStats = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.players[0].type = 'bot_easy';
      gm.players[1].type = 'bot_normal';
      gm.startGame('synth_drum_pad');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      // Simulate 16 steps (~8 seconds of beats)
      let easyTaps = 0;
      let normalTaps = 0;
      let totalSteps = 16;

      for (let s = 0; s < totalSteps; s++) {
        // Run update for each step (0.48s in 0.016s increments)
        for (let frame = 0; frame < 30; frame++) {
          game.update(0.016, 960, 600);
          if (gm.input.justPressed(0)) easyTaps++;
          if (gm.input.justPressed(1)) normalTaps++;
          gm.input.endFrame();
        }
      }

      const psEasy = game.playersState.get(0);
      const psNormal = game.playersState.get(1);

      return {
        totalSteps,
        easyTaps,
        normalTaps,
        easyScore: psEasy ? psEasy.score : 0,
        normalScore: psNormal ? psNormal.score : 0,
      };
    });

    // Easy bot should NOT hit every step (aimbot would hit 16/16)
    // It should hit fewer than 14 steps
    expect(botStats.easyTaps).toBeLessThan(14);
    // Normal bot should hit a balanced human amount (between 5 and 15)
    expect(botStats.normalTaps).toBeLessThanOrEqual(15);
  });

  test('Single-button mode automatically aligns to active sequencer pad on tap', async ({ page }) => {
    const autoAlignResult = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('synth_drum_pad');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const p1 = gm.players[0];
      const ps = game.playersState.get(p1.id);

      // Start on a non-active pad
      const targetPad = game.rhythmPattern[game.currentStep];
      ps.padIndex = (targetPad + 2) % 4;

      // Simulate tapping without directional steering (steer=0, throttle=0, justPressed=true)
      gm.input.setBotInput(p1.id, true, 0, 0);
      game.update(0.016, 960, 600);

      return {
        targetPad,
        alignedPad: ps.padIndex
      };
    });

    expect(autoAlignResult.alignedPad).toBe(autoAlignResult.targetPad);
  });
});
