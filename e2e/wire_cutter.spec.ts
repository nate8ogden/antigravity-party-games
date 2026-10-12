import { test, expect } from '@playwright/test';

test.describe('Wire Cutter Minigame - Sequences, AI & Controls', () => {
  test('Initializes with WireModule prompts, wires, and debug interface', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=wire_cutter&players=2&difficulty=normal');
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

    const mod = await page.evaluate(() => {
      const dbg = (window as any).__WIRE_CUTTER_DEBUG__;
      return dbg ? dbg.getCurrentModule() : null;
    });

    expect(mod).not.toBeNull();
    expect(typeof mod!.prompt).toBe('string');
    expect(mod!.prompt.length).toBeGreaterThan(0);
    expect(['single', 'sequence', 'all_except_then']).toContain(mod!.type);
  });

  test('Ordered Multi-step sequence: step 1 advances progress, step 2 completes defusal and awards score', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=wire_cutter&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
      const dbg = (window as any).__WIRE_CUTTER_DEBUG__;
      if (dbg) {
        // Force an ordered sequence: Wire 2 (Green/DOWN) -> Wire 0 (Red/UP)
        dbg.setModule({
          type: 'sequence',
          sequence: [2, 0],
          instructionText: '⚡ CUT: DOWN ➔ UP!',
          subPrompt: 'Execute sequence: DOWN then UP',
          timer: 5.0,
          maxTimer: 5.0,
          totalSteps: 2
        });
      }
    });

    await page.waitForTimeout(50);

    // Initial state
    const p1Before = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(0);
    });
    expect(p1Before.score).toBe(0);
    expect(p1Before.sequenceStep).toBe(0);

    // Player 1 cuts step 1: Wire 2 (Down)
    await page.evaluate(() => {
      (window as any).__WIRE_CUTTER_DEBUG__.cutWire(0, 2);
    });

    const p1Step1 = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(0);
    });
    expect(p1Step1.sequenceStep).toBe(1);
    expect(p1Step1.score).toBe(0); // Not defused yet
    expect(p1Step1.stunTimer).toBe(0); // No stun

    // Player 1 cuts step 2: Wire 0 (Up)
    await page.evaluate(() => {
      (window as any).__WIRE_CUTTER_DEBUG__.cutWire(0, 0);
    });

    const p1Step2 = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(0);
    });
    // Defusal complete! Score should now be 1
    expect(p1Step2.score).toBe(1);
  });

  test('Ordered Multi-step sequence: cutting wrong wire causes stun and resets step', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=wire_cutter&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
      const dbg = (window as any).__WIRE_CUTTER_DEBUG__;
      if (dbg) {
        // Sequence: 1 (Blue) -> 3 (Yellow)
        dbg.setModule({
          type: 'sequence',
          sequence: [1, 3],
          instructionText: '⚡ CUT: BLUE ➔ YELLOW!',
          timer: 5.0,
          maxTimer: 5.0,
          totalSteps: 2
        });
      }
    });

    await page.waitForTimeout(50);

    // Player cuts wrong wire immediately (wire 0 instead of 1)
    await page.evaluate(() => {
      (window as any).__WIRE_CUTTER_DEBUG__.cutWire(0, 0);
    });

    const state = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(0);
    });

    expect(state.score).toBe(0);
    expect(state.sequenceStep).toBe(0);
    expect(state.stunTimer).toBeGreaterThan(0); // Stunned!
  });

  test('All-except-then sequence: cutting finisher early stuns; cutting all 3 others then finisher defuses', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=wire_cutter&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
      const dbg = (window as any).__WIRE_CUTTER_DEBUG__;
      if (dbg) {
        // Target: CUT ALL BUT RED (0), THEN RED!
        // The other 3 wires are 1 (Blue), 2 (Green), 3 (Yellow)
        dbg.setModule({
          type: 'all_except_then',
          exceptWireIndex: 0,
          correctWireIndex: 0,
          instructionText: '⚠️ CUT ALL BUT RED, THEN RED!',
          subPrompt: 'Cut the other 3 wires first, then snip RED!',
          timer: 6.0,
          maxTimer: 6.0,
          totalSteps: 4
        });
      }
    });

    await page.waitForTimeout(50);

    // 1. Try cutting Red (0) too early
    await page.evaluate(() => {
      (window as any).__WIRE_CUTTER_DEBUG__.cutWire(0, 0);
    });

    let state = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(0);
    });
    expect(state.stunTimer).toBeGreaterThan(0);
    expect(state.score).toBe(0);

    // Clear stun for testing the full correct sequence
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      if (game && game.wirePlayers) {
        game.wirePlayers[0].stunTimer = 0;
        game.wirePlayers[0].cutWiresThisModule.clear();
      }
    });

    // 2. Cut wire 1 (Blue)
    await page.evaluate(() => {
      (window as any).__WIRE_CUTTER_DEBUG__.cutWire(0, 1);
    });
    state = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(0);
    });
    expect(state.cutWiresThisModule).toContain(1);
    expect(state.score).toBe(0);

    // 3. Cut wire 2 (Green)
    await page.evaluate(() => {
      (window as any).__WIRE_CUTTER_DEBUG__.cutWire(0, 2);
    });
    state = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(0);
    });
    expect(state.cutWiresThisModule).toContain(2);
    expect(state.score).toBe(0);

    // 4. Cut wire 3 (Yellow)
    await page.evaluate(() => {
      (window as any).__WIRE_CUTTER_DEBUG__.cutWire(0, 3);
    });
    state = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(0);
    });
    expect(state.cutWiresThisModule.length).toBe(3);
    expect(state.score).toBe(0);

    // 5. Finally cut the finisher wire 0 (Red)
    await page.evaluate(() => {
      (window as any).__WIRE_CUTTER_DEBUG__.cutWire(0, 0);
    });
    state = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(0);
    });
    expect(state.score).toBe(1); // Successfully defused!
  });

  test('Direct canvas pointerdown click on wire node registers cut', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=wire_cutter&players=2&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
      const dbg = (window as any).__WIRE_CUTTER_DEBUG__;
      if (dbg) {
        // Direct cut for Wire 0 (Red / UP)
        dbg.setModule({
          type: 'single',
          correctWireIndex: 0,
          instructionText: '⚡ SNIP THE RED WIRE!',
          timer: 4.0,
          maxTimer: 4.0,
          totalSteps: 1
        });
      }
    });

    await page.waitForTimeout(100);

    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Wire 0 is UP terminal node:
    // cx = width / 2; cy = bombY + 16 + screenH + (bombH - screenH - 32) / 2;
    // wire 0 position: (cx, cy - 95).
    // Canvas dimensions are 800x600.
    // bombH = min(380, 600*0.72) = 380.
    // bombY = 300 - 190 + 10 = 120.
    // screenH = 65.
    // cy = 120 + 16 + 65 + (380 - 65 - 32)/2 = 201 + 283/2 = 201 + 141.5 = 342.5.
    // wire 0: x = 400, y = 342.5 - 95 = 247.5.
    // Scale to bounding box:
    const clickX = box!.x + (400 / 800) * box!.width;
    const clickY = box!.y + (247.5 / 600) * box!.height;

    await page.mouse.click(clickX, clickY);

    // Allow frame update to process pointer queue
    await page.waitForTimeout(150);

    const state = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(0);
    });

    // Score should have increased by 1 from the pointer cut
    expect(state.score).toBe(1);
  });

  test('Bot AI operates with faster competitive reaction times and scores', async ({ page }) => {
    // 1 Human (P1) vs 1 Bot (P2) on Hard difficulty
    await page.goto('http://localhost:5173/?game=wire_cutter&players=2&difficulty=hard');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
      const dbg = (window as any).__WIRE_CUTTER_DEBUG__;
      if (dbg) {
        // Set a single cut module: Wire 1 (Blue)
        dbg.setModule({
          type: 'single',
          correctWireIndex: 1,
          instructionText: '✂️ CUT COLOR: BLUE',
          timer: 4.0,
          maxTimer: 4.0,
          totalSteps: 1
        });
      }
    });

    // Hard bot delay is 0.14s - 0.22s. Wait 400ms.
    await page.waitForTimeout(450);

    const botState = await page.evaluate(() => {
      return (window as any).__WIRE_CUTTER_DEBUG__.getPlayerState(1);
    });

    // Bot should have successfully reacted and scored!
    expect(botState).not.toBeNull();
    expect(botState.score).toBeGreaterThanOrEqual(1);
  });
});
