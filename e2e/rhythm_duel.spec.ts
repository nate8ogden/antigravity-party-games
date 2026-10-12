import { test, expect } from '@playwright/test';

test.describe('Rhythm Duel Minigame - Beat Timing, Randomization & AI Difficulty', () => {
  test('Beats last until approximately half a second (0.5s) left in the round', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=rhythm_duel&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    // Skip countdown
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    const timingData = await page.evaluate(() => {
      const dbg = (window as any).__RHYTHM_DUEL_DEBUG__;
      if (!dbg) return null;
      return {
        lastNoteTargetTime: dbg.getLastNoteTargetTime(),
        firstNoteTargetTime: dbg.getFirstNoteTargetTime(),
        roundDuration: 34.0
      };
    });

    expect(timingData).not.toBeNull();
    // Round duration is 34.0s, last note target time must be within ~33.3s - 33.6s (exactly ~0.5s left)
    const timeRemainingWhenLastNoteArrives = timingData!.roundDuration - timingData!.lastNoteTargetTime;
    expect(timeRemainingWhenLastNoteArrives).toBeGreaterThanOrEqual(0.35);
    expect(timeRemainingWhenLastNoteArrives).toBeLessThanOrEqual(0.65);
    expect(timingData!.firstNoteTargetTime).toBeGreaterThan(1.0);
  });

  test('Beats are randomized across different game resets', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=rhythm_duel&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    // Get note times from run 1
    const run1Notes = await page.evaluate(() => {
      const dbg = (window as any).__RHYTHM_DUEL_DEBUG__;
      const notes = dbg.getNotes().filter((n: any) => n.playerId === 0);
      return notes.map((n: any) => Math.round(n.targetTime * 100) / 100);
    });

    // Reset game to generate fresh randomized beat track
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('rhythm_duel');
      gm.countdownTimer = 0;
      gm.state = 'PLAYING';
    });

    await page.waitForTimeout(100);

    // Get note times from run 2
    const run2Notes = await page.evaluate(() => {
      const dbg = (window as any).__RHYTHM_DUEL_DEBUG__;
      const notes = dbg.getNotes().filter((n: any) => n.playerId === 0);
      return notes.map((n: any) => Math.round(n.targetTime * 100) / 100);
    });

    expect(run1Notes.length).toBeGreaterThan(30);
    expect(run2Notes.length).toBeGreaterThan(30);

    // Due to random pattern library selection, random micro-mutations, and swing,
    // the beat tracks should not be 100% identical!
    const matchesAll = run1Notes.length === run2Notes.length &&
      run1Notes.every((val: number, idx: number) => Math.abs(val - run2Notes[idx]) < 0.001);

    expect(matchesAll).toBe(false);
  });

  test('Normal bot AI is less hard and makes realistic human timing judgments', async ({ page }) => {
    // 1 Human (P1) vs 1 Bot (P2) on Normal difficulty
    await page.goto('http://localhost:5173/?game=rhythm_duel&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    // Fast-forward game simulation by advancing frames to let the bot play through ~20 notes
    const botStats = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game) return null;

      // Simulate 8 seconds of gameplay at 60fps
      for (let f = 0; f < 8 * 60; f++) {
        game.update(1 / 60, 800, 600);
      }

      const dbg = (window as any).__RHYTHM_DUEL_DEBUG__;
      return dbg ? dbg.getPlayerState(1) : null;
    });

    expect(botStats).not.toBeNull();
    // Bot should have played notes and scored points
    expect(botStats!.score).toBeGreaterThan(0);
    // Crucially: with the softer AI, bot does NOT have 100% perfect hits!
    // It should have some misses, great hits, or OK hits rather than robotic perfection
    const nonPerfectHitsOrMisses = botStats!.greatHits + botStats!.misses;
    expect(nonPerfectHitsOrMisses).toBeGreaterThan(0);
  });

  test('Direct pointerdown click on player lane triggers note tap', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=rhythm_duel&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(100);

    const clickScored = await page.evaluate(() => {
      const dbg = (window as any).__RHYTHM_DUEL_DEBUG__;
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (!game || !dbg) return false;

      // Align songTime with the first note's targetTime
      const firstNote = dbg.getFirstNoteTargetTime();
      game.songTime = firstNote;
      for (const n of game.notes) {
        n.y = game.hitLineY - (n.targetTime - game.songTime) * game.noteSpeed;
      }

      const p1 = dbg.getPlayerState(0);
      const canvas = gm.canvas;
      const rect = canvas.getBoundingClientRect();
      const clientX = rect.left + ((p1.laneX + p1.laneW * 0.5) / game.lastWidth) * rect.width;
      const clientY = rect.top + (game.hitLineY / game.lastHeight) * rect.height;

      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        clientX,
        clientY,
        bubbles: true
      }));

      return dbg.getPlayerState(0).score > 0;
    });

    expect(clickScored).toBe(true);
  });
});
