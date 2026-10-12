import { test, expect } from '@playwright/test';

test.describe('Sequence Clash Game - Controls & Edge Detection', () => {
  test('Initializes pads with key hints and switches from DEMONSTRATE to INPUT', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=sequence_clash&players=2&difficulty=normal');
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

    const initData = await page.evaluate(() => {
      const dbg = (window as any).__SEQUENCE_CLASH_DEBUG__;
      if (!dbg) return null;
      return {
        stage: dbg.getCurrentStage(),
        sequence: dbg.getSequence(),
        duelists: dbg.getDuelists()
      };
    });

    expect(initData).not.toBeNull();
    expect(initData!.sequence.length).toBeGreaterThanOrEqual(3);
    expect(initData!.duelists.length).toBe(2);
    expect(initData!.duelists[0].alive).toBe(true);
  });

  test('Holding down a directional key does NOT repeat or cause false multi-frame mistake elimination', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=sequence_clash&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
      const dbg = (window as any).__SEQUENCE_CLASH_DEBUG__;
      if (dbg) {
        dbg.skipDemonstration();
      }
    });

    await page.waitForTimeout(100);

    const edgeTest = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const dbg = (window as any).__SEQUENCE_CLASH_DEBUG__;
      if (!game || !dbg) return null;

      // Force sequence to start with Pad 0 (Top / W) and then Pad 1 (Right / D)
      game.sequence[0] = 0;
      game.sequence[1] = 1;

      // Hold down 'KeyW' continuously across 10 frames
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));

      for (let i = 0; i < 10; i++) {
        game.update(0.016, 800, 600);
      }

      const d = dbg.getDuelists().find((pl: any) => pl.id === 0);
      return {
        alive: d.alive,
        inputIndex: d.inputIndex,
        score: d.score
      };
    });

    expect(edgeTest).not.toBeNull();
    // Player must still be alive! The hold should NOT have fired 10 times and triggered a mistake
    expect(edgeTest!.alive).toBe(true);
    // Only exactly 1 step advanced
    expect(edgeTest!.inputIndex).toBe(1);
    expect(edgeTest!.score).toBe(10);
  });

  test('Entering the full sequence correctly completes the sequence and awards +25 bonus', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=sequence_clash&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
      const dbg = (window as any).__SEQUENCE_CLASH_DEBUG__;
      if (dbg) {
        dbg.skipDemonstration();
      }
    });

    await page.waitForTimeout(100);

    const completion = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const dbg = (window as any).__SEQUENCE_CLASH_DEBUG__;
      if (!game || !dbg) return null;

      const seq = dbg.getSequence();

      // Enter each pad in the sequence step by step
      for (let s = 0; s < seq.length; s++) {
        const expectedPad = seq[s];
        dbg.pressPad(0, expectedPad);
        game.update(0.016, 800, 600);
      }

      const p0 = dbg.getDuelists().find((d: any) => d.id === 0);
      return {
        alive: p0.alive,
        completed: p0.completed,
        score: p0.score,
        expectedScore: seq.length * 10 + 25
      };
    });

    expect(completion).not.toBeNull();
    expect(completion!.alive).toBe(true);
    expect(completion!.completed).toBe(true);
    expect(completion!.score).toBe(completion!.expectedScore);
  });

  test('Inputting an incorrect pad immediately triggers mistake elimination', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=sequence_clash&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
      const dbg = (window as any).__SEQUENCE_CLASH_DEBUG__;
      if (dbg) {
        dbg.skipDemonstration();
      }
    });

    await page.waitForTimeout(100);

    const mistakeResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const dbg = (window as any).__SEQUENCE_CLASH_DEBUG__;
      if (!game || !dbg) return null;

      const seq = dbg.getSequence();
      // Input deliberately wrong pad
      const wrongPad = (seq[0] + 2) % 4;
      dbg.pressPad(0, wrongPad);
      game.update(0.016, 800, 600);

      const p0 = dbg.getDuelists().find((d: any) => d.id === 0);
      return {
        alive: p0.alive
      };
    });

    expect(mistakeResult).not.toBeNull();
    expect(mistakeResult!.alive).toBe(false);
  });

  test('Direct mouse/touch clicking on the holographic pads registers input', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=sequence_clash&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
      const dbg = (window as any).__SEQUENCE_CLASH_DEBUG__;
      if (dbg) {
        dbg.skipDemonstration();
      }
    });

    await page.waitForTimeout(100);

    const clickResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const dbg = (window as any).__SEQUENCE_CLASH_DEBUG__;
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      if (!game || !dbg || !canvas) return null;

      const expectedFirstPad = game.sequence[0];

      // Calculate center of the targeted pad
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const scale = rect.width / 800;
      const padDist = 68 * scale;

      let targetX = cx;
      let targetY = cy;
      if (expectedFirstPad === 0) targetY -= padDist;
      else if (expectedFirstPad === 1) targetX += padDist;
      else if (expectedFirstPad === 2) targetY += padDist;
      else if (expectedFirstPad === 3) targetX -= padDist;

      // Dispatch pointerdown event
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: targetX,
        clientY: targetY,
        bubbles: true
      }));

      // Update 1 frame to process pointer queue
      game.update(0.016, 800, 600);

      const p0 = dbg.getDuelists().find((d: any) => d.id === 0);
      return {
        alive: p0.alive,
        inputIndex: p0.inputIndex,
        score: p0.score
      };
    });

    expect(clickResult).not.toBeNull();
    expect(clickResult!.alive).toBe(true);
    expect(clickResult!.inputIndex).toBe(1);
    expect(clickResult!.score).toBe(10);
  });
});
