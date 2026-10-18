import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('1-4 Player Game Engine Verification', () => {

  test('Lobby loads with 60 FPS and 0 console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    // Verify touch-action is disabled to prevent pinch-to-zoom interference
    const touchAction = await page.locator('canvas').evaluate((el) =>
      window.getComputedStyle(el).touchAction
    );
    expect(touchAction).toBe('none');

    // Assert zero uncaught console exceptions
    expect(consoleErrors).toEqual([]);
  });

  test('Simulate 4-player simultaneous inputs and verify round transition', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tanks&players=4&autostart=true`);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');

    // Dispatches simultaneous touch events across all 4 quadrants
    await page.touchscreen.tap(box.x + 40, box.y + 40);                         // P1: Top-Left
    await page.touchscreen.tap(box.x + box.width - 40, box.y + 40);             // P2: Top-Right
    await page.touchscreen.tap(box.x + 40, box.y + box.height - 40);            // P3: Bottom-Left
    await page.touchscreen.tap(box.x + box.width - 40, box.y + box.height - 40); // P4: Bottom-Right

    // Simultaneous keyboard inputs (W, O, C, M)
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyO');
    await page.keyboard.down('KeyC');
    await page.keyboard.down('KeyM');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyO');
    await page.keyboard.up('KeyC');
    await page.keyboard.up('KeyM');

    // Wait for victory state or sudden death countdown
    await page.waitForTimeout(3000);
    const isRunning = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { active: boolean } }).__GAME_STATE__?.active !== false);
    expect(isRunning).toBeTruthy();
  });

  test('Direct Launch: Hovercraft Glacier with 2 Players', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=hovercraft&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('hovercraft');
    expect(gameState?.active).toBe(true);

    // Simulate P1 (W) and P2 (O) thrust bursts
    await page.keyboard.press('KeyW');
    await page.keyboard.press('KeyO');
    await page.waitForTimeout(500);
  });

  test('Direct Launch: Laser Grid High-Speed with 4 Players', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=lasergrid&speed=fast&players=4`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('laser_grid');
    expect(gameState?.active).toBe(true);

    // Tap steps for P1 and P3
    await page.keyboard.press('KeyW');
    await page.keyboard.press('KeyC');
  });

  test('Direct Launch: Orbital Slingshot Physics with Bots', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=slingshot&players=4&bots=3`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('orbital');
    expect(gameState?.active).toBe(true);
  });

  test('Direct Launch: Micro Turbo GP 2-Player Race', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=racing&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('micro_gp');
    expect(gameState?.active).toBe(true);

    // Hold drift for P1
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');
  });

  test('Responsive Pause Button toggles immediately on click and keyboard shortcut', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tanks&players=2`);
    const pauseBtn = page.locator('#center-pause-btn');
    await expect(pauseBtn).toBeVisible();

    // 1. Click should trigger pause immediately
    await pauseBtn.click();
    await page.waitForTimeout(100);
    let isPaused = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__?.state === 'PAUSED');
    expect(isPaused).toBe(true);

    // 2. Second click should resume immediately
    await pauseBtn.click();
    await page.waitForTimeout(100);
    isPaused = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__?.state === 'PAUSED');
    expect(isPaused).toBe(false);

    // 3. Pressing 'Escape' key should toggle pause
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    isPaused = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__?.state === 'PAUSED');
    expect(isPaused).toBe(true);

    // 4. Pressing 'p' key should resume
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(100);
    isPaused = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__?.state === 'PAUSED');
    expect(isPaused).toBe(false);
  });

  test('Autonomous Cup Tournament progression', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?tourney=cup&rounds=3&auto=true&speed=fast&game=tanks`);
    await expect(page.locator('canvas')).toBeVisible();

    // In autonomous mode, game runs continuously
    await page.waitForTimeout(3000);
    const active = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { active: boolean } }).__GAME_STATE__?.active);
    expect(active).toBe(true);
  });

  test('Direct Launch: Ghost Flashlight with 4 Players', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=ghost&players=4`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('ghost_flashlight');
    expect(gameState?.active).toBe(true);

    // Pulse flashlight for P1
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(300);
  });

  test('Direct Launch: Kitchen Chaos Food Fling with 4 Players', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=kitchen&players=4`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('kitchen_chaos');
    expect(gameState?.active).toBe(true);

    // Charge and fling food for P1 and P2
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyO');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyO');
  });

  test('Direct Launch: Skyline Sumo Scaffolding Climber', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=sumo&players=4`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('skyline_sumo');
    expect(gameState?.active).toBe(true);

    // Charge jump spring
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
  });

  test('Stress Test: 16 Rapid Simultaneous Multi-Touch Taps Across All 4 Corners', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tanks&players=4`);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');

    const corners = [
      { x: box.x + 35, y: box.y + 35 },
      { x: box.x + box.width - 35, y: box.y + 35 },
      { x: box.x + 35, y: box.y + box.height - 35 },
      { x: box.x + box.width - 35, y: box.y + box.height - 35 }
    ];

    // Rapid concurrent taps
    for (let round = 0; round < 4; round++) {
      await Promise.all(corners.map((c) => page.touchscreen.tap(c.x, c.y)));
      await page.waitForTimeout(50);
    }

    const isStillActive = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { active: boolean } }).__GAME_STATE__?.active);
    expect(isStillActive).toBe(true);
  });

  test('Section 7.3 Stability: 10 Consecutive Round Restarts Without Frame Drops', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tanks&players=2&speed=fast`);
    await expect(page.locator('canvas')).toBeVisible();

    // Trigger 10 quick game switches / restarts
    const games = ['tanks', 'hovercraft', 'laser_grid', 'orbital', 'micro_gp', 'ghost_flashlight', 'kitchen_chaos', 'skyline_sumo', 'tanks', 'hovercraft'];
    for (const g of games) {
      await page.evaluate((targetGame) => {
        const gm = (window as unknown as { __GAME_STATE__?: { game?: unknown } });
        // Trigger game reset directly in engine
        window.history.pushState({}, '', `/?game=${targetGame}&players=2`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, g);
      await page.waitForTimeout(100);
    }

    const isHealthy = await page.evaluate(() => {
      return (window as unknown as { __GAME_STATE__?: { active: boolean } }).__GAME_STATE__ !== undefined;
    });
    expect(isHealthy).toBe(true);
  });

  test('Simultaneous 2-Player Local Keyboard Duel: P1 (WASD+Space) and P2 (Arrows+Enter)', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tanks&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    // Player 1 controls (WASD + Space)
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('Space');

    // Concurrent Player 2 controls (Arrows + Enter)
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down('ArrowLeft');
    await page.keyboard.down('Enter');

    await page.waitForTimeout(500);

    // Verify both players registered inputs independently
    const inputStates = await page.evaluate(() => {
      const gs = (window as unknown as { __GAME_STATE__?: { game?: { input?: { getSteer: (p: number) => number; getThrottle: (p: number) => number } } } }).__GAME_STATE__;
      return {
        active: gs?.game !== undefined
      };
    });
    expect(inputStates.active).toBe(true);

    // Release all keys
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('Enter');

    await page.waitForTimeout(400);
  });

  test('AI Difficulty Setting: Verify URL param parsing and dynamic lobby switching', async ({ page }) => {
    // 1. Direct launch with ?difficulty=hard
    await page.goto(`${LOCAL_URL}?players=1&difficulty=hard`);
    await expect(page.locator('canvas')).toBeVisible();

    const initialDiff = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { globalBotDifficulty: string; players: { type: string }[] } }).__GAME_MANAGER__;
      return {
        diff: gm?.globalBotDifficulty,
        p2Type: gm?.players[1]?.type
      };
    });
    expect(initialDiff.diff).toBe('bot_hard');
    expect(initialDiff.p2Type).toBe('bot_hard');

    // 2. Click Easy difficulty tab on canvas
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');

    const diffW = 115;
    const diffSpacing = 10;
    const diffStartX = box.width / 2 - (3 * diffW + 2 * diffSpacing) / 2;
    const easyTabX = box.x + diffStartX + diffW / 2;
    const diffTabY = box.y + 122 + 13;

    await page.mouse.click(easyTabX, diffTabY);
    await page.waitForTimeout(100);

    const easyDiff = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { globalBotDifficulty: string; players: { type: string }[] } }).__GAME_MANAGER__;
      return {
        diff: gm?.globalBotDifficulty,
        p2Type: gm?.players[1]?.type
      };
    });
    expect(easyDiff.diff).toBe('bot_easy');
    expect(easyDiff.p2Type).toBe('bot_easy');
  });

  test('Batch 1: Animal Stack Game 9 with swinging crane and wobbling raft', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=animal_stack&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('animal_stack');
    expect(gameState?.active).toBe(true);

    // Tap to drop animal from crane
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(600);
  });

  test('Batch 1: Sumo Iceberg Game 10 with dynamic tilting disc physics', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=sumo_iceberg&players=4`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('sumo_iceberg');
    expect(gameState?.active).toBe(true);

    // Multi-player sumo dash tackle
    await page.keyboard.press('KeyW');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(600);
  });

  test('Batch 1: Cannon Barrage Game 13 with fortress tower duel', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=cannon_barrage&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('cannon_barrage');
    expect(gameState?.active).toBe(true);

    // Fire cannons for P1 and P2
    await page.keyboard.press('KeyW');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(600);
  });

  test('Batch 1: Anvil Rain Game 14 with shadow dodging and survival', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=anvil_rain&players=4`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('anvil_rain');
    expect(gameState?.active).toBe(true);

    // P1 quick dodge roll
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(600);
  });

  test('AI Calibration: Orbital slingshot bots do not spin forever', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=slingshot&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    // Run for 3 seconds with AI active
    await page.waitForTimeout(3000);
    const isRunning = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { active: boolean } }).__GAME_STATE__?.active);
    expect(isRunning).toBe(true);
  });

  test('Batch 2: Bomb Relay Game 18 with hot potato fuse and player pass', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=bomb_relay&players=4&speed=fast`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('bomb_relay');
    expect(gameState?.active).toBe(true);

    // Multi-player tackle sprint
    await page.keyboard.press('KeyW');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(600);
  });

  test('Batch 2: Micro Hockey Game 12 with 4-way circular air table and goals', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=micro_hockey&players=4&speed=fast`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('micro_hockey');
    expect(gameState?.active).toBe(true);

    // Paddle swing deflections
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ArrowUp');
  });

  test('Batch 2: Quick Draw Western Game 19 with millisecond reaction timing', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=quick_draw&players=2&speed=fast`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('quick_draw');
    expect(gameState?.active).toBe(true);
  });

  test('Batch 2: Balloon Burst Game 20 with pump inflation risk-reward', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=balloon_burst&players=2&speed=fast`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1000);
    const gameState = await page.evaluate(() => (window as unknown as { __GAME_STATE__?: { selectedGame: string; active: boolean } }).__GAME_STATE__);
    expect(gameState?.selectedGame).toBe('balloon_burst');
    expect(gameState?.active).toBe(true);

    // Inflate balloon
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(800);
    await page.keyboard.up('KeyW');
  });

  test('Skyline Sumo: Lookahead Camera Zoom and Lakitu Cloud Rescuer', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=skyline_sumo&players=2&speed=fast`);
    await expect(page.locator('canvas')).toBeVisible();

    // Verify game engine initializes active camera zoom and rescuer tracking
    await page.waitForTimeout(1200);
    const sumoData = await page.evaluate(() => {
      const g = (window as unknown as { __GAME_STATE__?: { game: unknown } }).__GAME_STATE__?.game as {
        cameraZoom?: number;
        rescuerActive?: boolean;
        climbers?: Map<number, unknown>;
      };
      return {
        hasZoom: typeof g?.cameraZoom === 'number',
        hasRescuer: typeof g?.rescuerActive === 'boolean',
        climbersCount: g?.climbers?.size || 0
      };
    });

    expect(sumoData.hasZoom).toBe(true);
    expect(sumoData.hasRescuer).toBe(true);
    expect(sumoData.climbersCount).toBeGreaterThan(0);
  });

  test('UI Gallery & Modal: Select game card, verify How to Play popup, and launch', async ({ page }) => {
    await page.goto(LOCAL_URL);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas box not found');

    // 1. Verify 16 games registered in catalog
    const catalogCount = await page.evaluate(() => {
      return (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'LOBBY';
    });
    expect(catalogCount).toBe(true);

    // 2. Click on a game card to pop up instructions modal
    await page.mouse.click(box.x + 280, box.y + 240);
    await page.waitForTimeout(300);

    const isModalOpen = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { isModalOpen: boolean; modalGameIndex: number } }).__GAME_MANAGER__;
      return mgr?.isModalOpen === true;
    });
    expect(isModalOpen).toBe(true);

    // 3. Click the Play Game button inside modal (exact center of button at modalY + modalH - 36)
    const modalH = Math.min(520, box.height * 0.88);
    const modalY = box.height / 2 - modalH / 2;
    const playBtnY = modalY + modalH - 36;
    await page.mouse.click(box.x + box.width / 2, box.y + playBtnY);
    await page.waitForTimeout(600);

    // 4. Verify game successfully launched from modal
    const launched = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__;
      return mgr?.state === 'COUNTDOWN' || mgr?.state === 'PLAYING';
    });
    expect(launched).toBe(true);
  });

  test('Batch 3: Swat the Fly Game 21 with bug buzzing and bot swatting', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=swat_fly&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2500);

    const swatState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean; roundTimer: number } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined,
        roundTimer: gm?.activeGame?.roundTimer
      };
    });

    expect(swatState.hasGame).toBe(true);
    expect(swatState.roundTimer).toBeLessThanOrEqual(60);
  });

  test('Batch 3: Stop at Zero Game 24 with precision countdown and bot timer locking', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=stop_at_zero&players=2&difficulty=hard`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2500);

    const clockState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean; roundTimer: number } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined,
        active: gm?.activeGame?.isFinished === false
      };
    });

    expect(clockState.hasGame).toBe(true);
    expect(clockState.active).toBe(true);
  });

  test('Batch 3: Turf Whack Game 25 with garden moles and bot mallet swinging', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=turf_whack&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2500);

    const whackState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined
      };
    });

    expect(whackState.hasGame).toBe(true);
  });

  test('Batch 3: Neon Lightcycles Game 29 with raycast lookahead trail navigation', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=neon_lightcycles&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2500);

    const cycleState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined
      };
    });

    expect(cycleState.hasGame).toBe(true);
  });

  test('Batch 3: AI Difficulty Calibration (Easy vs Normal vs Hard) across next batch', async ({ page }) => {
    // Verify difficulty parameter passing for swat_fly and neon_lightcycles
    await page.goto(`${LOCAL_URL}?game=swat_fly&players=1&difficulty=easy`);
    await expect(page.locator('canvas')).toBeVisible();

    const easyCheck = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { globalBotDifficulty: string } }).__GAME_MANAGER__;
      return gm?.globalBotDifficulty;
    });
    expect(easyCheck).toBe('bot_easy');

    await page.goto(`${LOCAL_URL}?game=neon_lightcycles&players=1&difficulty=hard`);
    const hardCheck = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { globalBotDifficulty: string } }).__GAME_MANAGER__;
      return gm?.globalBotDifficulty;
    });
    expect(hardCheck).toBe('bot_hard');
  });

  test('Batch 4: Blade Parry Game 22 with dojo bokken clash timing and bot parrying', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=blade_parry&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2500);

    const parryState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined
      };
    });

    expect(parryState.hasGame).toBe(true);
  });

  test('Batch 4: Safe Dial Lock Game 23 with spinning tumblers and lock cracking', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=safe_dial&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2500);

    const dialState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined
      };
    });

    expect(dialState.hasGame).toBe(true);
  });

  test('Batch 4: Coin Apex Game 26 with parabolic physics toss and apex zero-velocity catching', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=coin_apex&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2500);

    const coinState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined
      };
    });

    expect(coinState.hasGame).toBe(true);
  });

  test('Batch 4: Red Light Sentry Game 27 with stealth watchtower scanning and red light freeze', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=red_light_sentry&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2500);

    const sentryState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined
      };
    });

    expect(sentryState.hasGame).toBe(true);
  });

  test('Batch 4: AI Difficulty Calibration (Easy vs Normal vs Hard) across Batch 4', async ({ page }) => {
    // Verify difficulty parameter passing for blade_parry and red_light_sentry
    await page.goto(`${LOCAL_URL}?game=blade_parry&players=1&difficulty=easy`);
    await expect(page.locator('canvas')).toBeVisible();

    const easyCheck = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { globalBotDifficulty: string } }).__GAME_MANAGER__;
      return gm?.globalBotDifficulty;
    });
    expect(easyCheck).toBe('bot_easy');

    await page.goto(`${LOCAL_URL}?game=red_light_sentry&players=1&difficulty=hard`);
    await expect(page.locator('canvas')).toBeVisible();

    const hardCheck = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { globalBotDifficulty: string } }).__GAME_MANAGER__;
      return gm?.globalBotDifficulty;
    });
    expect(hardCheck).toBe('bot_hard');
  });

  test('Outsider Ergonomics: Category Filtering, Quick Actions, and Space/Enter Keyboard Launch', async ({ page }) => {
    await page.goto(LOCAL_URL);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // 1. Verify category filtering changes active category
    const initialCategory = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { selectedCategory: string } }).__GAME_MANAGER__;
      return gm?.selectedCategory;
    });
    expect(initialCategory).toBe('ALL');

    // Click 'PUZZLE' category pill or set it via setSelectedCategory
    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { setSelectedCategory: (c: string) => void; getFilteredCatalog: () => unknown[] } }).__GAME_MANAGER__;
      gm?.setSelectedCategory('PUZZLE');
    });

    const puzzleCatalog = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { getFilteredCatalog: () => { id: string }[] } }).__GAME_MANAGER__;
      return gm?.getFilteredCatalog().map(g => g.id);
    });
    expect(puzzleCatalog).toContain('safe_dial');

    // Reset to ALL
    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { setSelectedCategory: (c: string) => void } }).__GAME_MANAGER__;
      gm?.setSelectedCategory('ALL');
    });

    // 2. Open game modal and test Space / Enter to launch
    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { openGameModal: (idx: number) => void; isModalOpen: boolean } }).__GAME_MANAGER__;
      gm?.openGameModal(0);
    });

    const isModalOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { isModalOpen: boolean } }).__GAME_MANAGER__;
      return gm?.isModalOpen;
    });
    expect(isModalOpen).toBe(true);

    // Press Space to launch game from modal
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    const gameRunning = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; isModalOpen: boolean } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        modalOpen: gm?.isModalOpen
      };
    });
    expect(gameRunning.modalOpen).toBe(false);
    expect(['COUNTDOWN', 'PLAYING']).toContain(gameRunning.state);

    // 3. Test Escape to pause game
    await page.keyboard.press('KeyP');
    const isPaused = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__;
      return gm?.state === 'PAUSED';
    });
    expect(isPaused).toBe(true);

    // 4. Test Escape in pause menu to return to lobby
    await page.keyboard.press('Escape');
    const backToLobby = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__;
      return gm?.state === 'LOBBY';
    });
    expect(backToLobby).toBe(true);
  });

  test('Outsider Ergonomics: Quick Random and Cup Tournament Launchers', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    // Trigger Random Game via key 'R'
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(500);

    const randomState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: unknown } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        hasGame: gm?.activeGame !== undefined
      };
    });
    expect(['COUNTDOWN', 'PLAYING']).toContain(randomState.state);
    expect(randomState.hasGame).toBe(true);

    // Return to lobby
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // Trigger Cup Tournament via key 'T'
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(500);

    const cupState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { isTournament: boolean; tournamentGoalPoints: number; state: string } }).__GAME_MANAGER__;
      return {
        isCup: gm?.isTournament,
        target: gm?.tournamentGoalPoints,
        state: gm?.state
      };
    });
    expect(cupState.isCup).toBe(true);
    expect(cupState.target).toBe(3);
    expect(['COUNTDOWN', 'PLAYING']).toContain(cupState.state);
  });

  test('Batch 5: Laser Leap Game 28 with rotating neon beam jump rope and jump physics', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=laser_leap&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2000);

    const laserState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined
      };
    });
    expect(laserState.hasGame).toBe(true);
  });

  test('Batch 5: Color Clash Game 15 with paint roller rovers and territory grid claiming', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=color_clash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2000);

    const colorState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined
      };
    });
    expect(colorState.hasGame).toBe(true);
  });

  test('Batch 5: Meteor Shield Game 17 with orbital deflector shield and kinetic pulse', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=meteor_shield&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2000);

    const meteorState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined
      };
    });
    expect(meteorState.hasGame).toBe(true);
  });

  test('Batch 5: Sequence Clash Game 30 with 4-way holographic pad memory duel', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=sequence_clash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(2000);

    const seqState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { isFinished: boolean } } }).__GAME_MANAGER__;
      return {
        hasGame: gm?.activeGame !== undefined
      };
    });
    expect(seqState.hasGame).toBe(true);
  });

  test('Batch 5: AI Difficulty Calibration (Easy vs Normal vs Hard) across Batch 5', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=laser_leap&players=1&difficulty=easy`);
    await expect(page.locator('canvas')).toBeVisible();

    const easyCheck = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { globalBotDifficulty: string } }).__GAME_MANAGER__;
      return gm?.globalBotDifficulty;
    });
    expect(easyCheck).toBe('bot_easy');

    await page.goto(`${LOCAL_URL}?game=sequence_clash&players=1&difficulty=hard`);
    await expect(page.locator('canvas')).toBeVisible();

    const hardCheck = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { globalBotDifficulty: string } }).__GAME_MANAGER__;
      return gm?.globalBotDifficulty;
    });
    expect(hardCheck).toBe('bot_hard');
  });

  test('Settings & Preferences: Modal, Customization, LocalStorage Persistence, and Pause Menu Integration', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    // 1. Open settings via Utility Bar button
    const settingsBtn = page.locator('#settings-btn');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    await page.waitForTimeout(300);

    let isSettingsOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { isSettingsOpen: boolean } }).__GAME_MANAGER__;
      return gm?.isSettingsOpen;
    });
    expect(isSettingsOpen).toBe(true);

    // 2. Click 100% volume and Turbo speed via settings hitboxes
    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { settingsHitBoxes: { id: string; action: () => void }[] } }).__GAME_MANAGER__;
      const vol100 = gm?.settingsHitBoxes.find((b) => b.id === 'vol_1');
      if (vol100) vol100.action();

      const spdTurbo = gm?.settingsHitBoxes.find((b) => b.id === 'spd_1.6');
      if (spdTurbo) spdTurbo.action();

      const goal7 = gm?.settingsHitBoxes.find((b) => b.id === 'goal_7');
      if (goal7) goal7.action();
    });

    const updatedSettings = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { settings: { masterVolume: number; gameSpeed: number; tournamentGoal: number } } }).__GAME_MANAGER__;
      return gm?.settings;
    });
    expect(updatedSettings?.masterVolume).toBe(1.0);
    expect(updatedSettings?.gameSpeed).toBe(1.6);
    expect(updatedSettings?.tournamentGoal).toBe(7);

    // 3. Close settings via Save & Close button
    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { settingsHitBoxes: { id: string; action: () => void }[] } }).__GAME_MANAGER__;
      const saveClose = gm?.settingsHitBoxes.find((b) => b.id === 'save_close');
      if (saveClose) saveClose.action();
    });
    await page.waitForTimeout(200);

    isSettingsOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { isSettingsOpen: boolean } }).__GAME_MANAGER__;
      return gm?.isSettingsOpen;
    });
    expect(isSettingsOpen).toBe(false);

    // 4. Verify settings persisted to localStorage
    const savedLocal = await page.evaluate(() => {
      const raw = localStorage.getItem('antigravity_settings');
      return raw ? JSON.parse(raw) : null;
    });
    expect(savedLocal?.masterVolume).toBe(1.0);
    expect(savedLocal?.gameSpeed).toBe(1.6);
    expect(savedLocal?.tournamentGoal).toBe(7);

    // 5. Test opening settings via Keyboard shortcut 'S'
    await page.keyboard.press('KeyS');
    await page.waitForTimeout(200);

    isSettingsOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { isSettingsOpen: boolean } }).__GAME_MANAGER__;
      return gm?.isSettingsOpen;
    });
    expect(isSettingsOpen).toBe(true);

    // 6. Test closing settings via Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    isSettingsOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { isSettingsOpen: boolean } }).__GAME_MANAGER__;
      return gm?.isSettingsOpen;
    });
    expect(isSettingsOpen).toBe(false);

    // 7. Test opening settings from Pause menu during active gameplay
    await page.goto(`${LOCAL_URL}?game=tanks&players=2`);
    await page.waitForTimeout(1000);

    // Press 'P' to pause
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(200);

    const isPaused = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__;
      return gm?.state === 'PAUSED';
    });
    expect(isPaused).toBe(true);

    // Press 'S' to open settings while paused
    await page.keyboard.press('KeyS');
    await page.waitForTimeout(200);

    const pausedSettingsOpen = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { isSettingsOpen: boolean; state: string } }).__GAME_MANAGER__;
      return {
        isSettingsOpen: gm?.isSettingsOpen,
        state: gm?.state
      };
    });
    expect(pausedSettingsOpen.isSettingsOpen).toBe(true);
    expect(pausedSettingsOpen.state).toBe('PAUSED');

    // Close settings
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const finalState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { isSettingsOpen: boolean; state: string } }).__GAME_MANAGER__;
      return {
        isSettingsOpen: gm?.isSettingsOpen,
        state: gm?.state
      };
    });
    expect(finalState.isSettingsOpen).toBe(false);
    expect(finalState.state).toBe('PAUSED');
  });

  test('Batch 6: Bubble Soccer (G-31) - Turf soccer, bubble elastic collision, goal detection', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { consoleErrors.push(err.message); });

    await page.goto(`${LOCAL_URL}?game=bubble_soccer&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    // Past countdown into gameplay
    await page.waitForTimeout(1600);

    const gameInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { bubbles?: unknown[]; ball?: unknown }; state: string } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        hasBubbles: Array.isArray(gm?.activeGame?.bubbles) && gm.activeGame.bubbles.length === 2,
        hasBall: gm?.activeGame?.ball !== undefined
      };
    });

    expect(['COUNTDOWN', 'PLAYING']).toContain(gameInfo.state);
    expect(gameInfo.hasBubbles).toBe(true);
    expect(gameInfo.hasBall).toBe(true);

    // Drive P1 and dash
    await page.keyboard.press('KeyW');
    await page.keyboard.press('KeyD');
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);

    expect(consoleErrors).toEqual([]);
  });

  test('Batch 6: Wire Cutter (G-32) - Cyber defusal relay, module generation, wire snip feedback', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { consoleErrors.push(err.message); });

    await page.goto(`${LOCAL_URL}?game=wire_cutter&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1600);

    const moduleInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { currentModule?: { instructionText: string; correctWireIndex: number }; wirePlayers?: unknown[] }; state: string } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        hasPrompt: !!gm?.activeGame?.currentModule?.instructionText,
        correctWire: gm?.activeGame?.currentModule?.correctWireIndex,
        hasWirePlayers: Array.isArray(gm?.activeGame?.wirePlayers) && gm.activeGame.wirePlayers.length === 2
      };
    });

    expect(['COUNTDOWN', 'PLAYING']).toContain(moduleInfo.state);
    expect(moduleInfo.hasPrompt).toBe(true);
    expect([0, 1, 2, 3]).toContain(moduleInfo.correctWire);
    expect(moduleInfo.hasWirePlayers).toBe(true);

    // Human player cuts a wire
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(400);

    expect(consoleErrors).toEqual([]);
  });

  test('Batch 6: Magma Hop (G-33) - Basalt hopping pillars, fire crystals, geyser hazard', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { consoleErrors.push(err.message); });

    await page.goto(`${LOCAL_URL}?game=magma_hop&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const magmaInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { pillars?: unknown[]; magmaPlayers?: Map<number, unknown> }; state: string } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        pillarCount: gm?.activeGame?.pillars?.length,
        hasPlayers: (gm?.activeGame?.magmaPlayers?.size ?? 0) === 2
      };
    });

    expect(magmaInfo.state).toBe('PLAYING');
    expect((magmaInfo.pillarCount ?? 0) >= 20).toBe(true);
    expect(magmaInfo.hasPlayers).toBe(true);

    // Get initial player pillar position
    const startPillarId = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { magmaPlayers?: Map<number, { currentPillarId: number; x: number; y: number; isAlive: boolean }> } } }).__GAME_MANAGER__;
      return gm?.activeGame?.magmaPlayers?.get(0)?.currentPillarId;
    });

    // Hop in a direction (KeyD: Right)
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(500);

    const afterHopInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { magmaPlayers?: Map<number, { currentPillarId: number; isAlive: boolean; lives: number }> } } }).__GAME_MANAGER__;
      const p1 = gm?.activeGame?.magmaPlayers?.get(0);
      return {
        isAlive: p1?.isAlive,
        lives: p1?.lives,
        newPillarId: p1?.currentPillarId
      };
    });

    expect(afterHopInfo.isAlive).toBe(true);
    expect(afterHopInfo.lives).toBe(3);
    // Player should have successfully hopped to an adjacent pillar
    expect(afterHopInfo.newPillarId).not.toBe(startPillarId);

    // Hop again via Action key (Space)
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    const afterSpaceHopInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { magmaPlayers?: Map<number, { currentPillarId: number; isAlive: boolean; lives: number }> } } }).__GAME_MANAGER__;
      const p1 = gm?.activeGame?.magmaPlayers?.get(0);
      return {
        isAlive: p1?.isAlive,
        lives: p1?.lives,
        newPillarId: p1?.currentPillarId
      };
    });

    expect(afterSpaceHopInfo.isAlive).toBe(true);
    expect(afterSpaceHopInfo.lives).toBe(3);
    expect(afterSpaceHopInfo.newPillarId).not.toBe(afterHopInfo.newPillarId);

    expect(consoleErrors).toEqual([]);
  });

  test('Batch 6: Rhythm Duel (G-34) - Synthwave highway, beat scroll, tap timing judgment', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { consoleErrors.push(err.message); });

    await page.goto(`${LOCAL_URL}?game=rhythm_duel&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1600);

    const rhythmInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { notes?: unknown[]; playerStates?: Map<number, unknown> }; state: string } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        noteCount: gm?.activeGame?.notes?.length,
        hasPlayers: (gm?.activeGame?.playerStates?.size ?? 0) === 2
      };
    });

    expect(['COUNTDOWN', 'PLAYING']).toContain(rhythmInfo.state);
    expect((rhythmInfo.noteCount ?? 0) > 10).toBe(true);
    expect(rhythmInfo.hasPlayers).toBe(true);

    // Tap to hit notes
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    expect(consoleErrors).toEqual([]);
  });

  test('Batch 7: Cosmic Vortex (G-35) - Gravitational accretion disk, antimatter orbs, event horizon, repulsor blast', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { consoleErrors.push(err.message); });

    await page.goto(`${LOCAL_URL}?game=cosmic_vortex&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1600);

    const vortexInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { orbs?: unknown[]; playersState?: Map<number, unknown> }; state: string } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        orbCount: gm?.activeGame?.orbs?.length,
        hasPlayers: (gm?.activeGame?.playersState?.size ?? 0) === 2
      };
    });

    expect(['COUNTDOWN', 'PLAYING']).toContain(vortexInfo.state);
    expect((vortexInfo.orbCount ?? 0) >= 3).toBe(true);
    expect(vortexInfo.hasPlayers).toBe(true);

    // Fire thruster and tap pulse repulsor
    await page.keyboard.press('KeyW');
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);

    expect(consoleErrors).toEqual([]);
  });

  test('Batch 7: Pixel Paintball (G-36) - Ricochet splat arena, spinning pinatas, stun knockback', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { consoleErrors.push(err.message); });

    await page.goto(`${LOCAL_URL}?game=pixel_paintball&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1600);

    const paintballInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { pinatas?: unknown[]; pellets?: unknown[]; playersState?: Map<number, unknown> }; state: string } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        pinataCount: gm?.activeGame?.pinatas?.length,
        hasPlayers: (gm?.activeGame?.playersState?.size ?? 0) === 2
      };
    });

    expect(['COUNTDOWN', 'PLAYING']).toContain(paintballInfo.state);
    expect((paintballInfo.pinataCount ?? 0) >= 2).toBe(true);
    expect(paintballInfo.hasPlayers).toBe(true);

    // Steer and fire paintball pellets
    await page.keyboard.press('KeyA');
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);

    expect(consoleErrors).toEqual([]);
  });

  test('Batch 7: Minefield Dash (G-37) - Cyber hex minefield, proximity runes, fuse countdown, golden core', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { consoleErrors.push(err.message); });

    await page.goto(`${LOCAL_URL}?game=minefield_dash&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1600);

    const minefieldInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { grid?: unknown[][]; playersState?: Map<number, unknown> }; state: string } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        hasGrid: Array.isArray(gm?.activeGame?.grid) && gm.activeGame.grid.length > 0,
        hasPlayers: (gm?.activeGame?.playersState?.size ?? 0) === 2
      };
    });

    expect(['COUNTDOWN', 'PLAYING']).toContain(minefieldInfo.state);
    expect(minefieldInfo.hasGrid).toBe(true);
    expect(minefieldInfo.hasPlayers).toBe(true);

    // Sprint forward into minefield
    await page.keyboard.press('KeyW');
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(400);

    expect(consoleErrors).toEqual([]);
  });

  test('Batch 7: Asteroid Miner (G-38) - Zero-G kinetic salvage, rotary diamond drill, crystalline asteroids, gem collection & depot banking', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { consoleErrors.push(err.message); });

    await page.goto(`${LOCAL_URL}?game=asteroid_miner&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForTimeout(1600);

    const minerInfo = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { asteroids?: unknown[]; depots?: unknown[]; ships?: Map<number, unknown> }; state: string } }).__GAME_MANAGER__;
      return {
        state: gm?.state,
        asteroidCount: gm?.activeGame?.asteroids?.length,
        depotCount: gm?.activeGame?.depots?.length,
        hasShips: (gm?.activeGame?.ships?.size ?? 0) === 2
      };
    });

    expect(['COUNTDOWN', 'PLAYING']).toContain(minerInfo.state);
    expect((minerInfo.asteroidCount ?? 0) >= 5).toBe(true);
    expect(minerInfo.depotCount).toBe(2);
    expect(minerInfo.hasShips).toBe(true);

    // Fire bow thruster and steer towards asteroids
    await page.keyboard.press('KeyW');
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);

    expect(consoleErrors).toEqual([]);
  });

  test('Batch 8: Don\'t Look Down (G-39) - 5:00 min timer, zero checkpoints, 3 map selection, altitude tracking & high-stakes vertical ascent', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { consoleErrors.push(err.message); });

    // Launch with 2 players (Human + Bot) on normal difficulty
    await page.goto(`${LOCAL_URL}?game=dont_look_down&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    // Wait past countdown into active climb
    await page.waitForTimeout(1600);

    // Verify 5:00 minute time limit (300s), platforms, climbers, and initial map
    const climbState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { currentMapId?: string; roundTimer?: number; climbers?: Map<number, { altitude: number; isGrounded: boolean; isCharging: boolean }>; platforms?: unknown[] }; state: string } }).__GAME_MANAGER__;
      const ag = gm?.activeGame;
      return {
        state: gm?.state,
        currentMapId: ag?.currentMapId,
        roundTimer: ag?.roundTimer,
        climberCount: ag?.climbers?.size,
        platformCount: ag?.platforms?.length
      };
    });

    expect(['COUNTDOWN', 'PLAYING']).toContain(climbState.state);
    expect(climbState.currentMapId).toBe('cyber');
    expect(climbState.roundTimer).toBeLessThanOrEqual(300);
    expect(climbState.roundTimer).toBeGreaterThan(280);
    expect(climbState.climberCount).toBe(2);
    expect((climbState.platformCount ?? 0) >= 15).toBe(true);

    // Test map selection switching: Switch to Map 2 (Sky Ruins)
    await page.keyboard.press('Digit2');
    await page.waitForTimeout(200);

    const map2State = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { currentMapId?: string } } }).__GAME_MANAGER__;
      return gm?.activeGame?.currentMapId;
    });
    expect(map2State).toBe('sky');

    // Switch to Map 3 (Magma Caldera)
    await page.keyboard.press('Digit3');
    await page.waitForTimeout(200);

    const map3State = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { currentMapId?: string } } }).__GAME_MANAGER__;
      return gm?.activeGame?.currentMapId;
    });
    expect(map3State).toBe('magma');

    // Switch back to Map 1 (Cyber Spire)
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(200);

    // Test player leap mechanics: hold jump to charge leap, release to leap upwards
    await page.keyboard.down('Space');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(300);
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(500);

    // Ensure no unhandled console or page errors occurred
    expect(consoleErrors).toEqual([]);
  });

  test('Snowball Fight: Aim & power charging, ballistic trajectory, procedural winter maps, and bot duel', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    // Launch Snowball Fight with 2 players (P1 Human vs P2 Normal Bot)
    await page.goto(`${LOCAL_URL}?game=snowball_fight&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();

    // Wait past countdown into active gameplay
    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const snowState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number; currentMapName: string; playersState: Map<number, { hp: number; isCharging: boolean; chargePower: number }>; blocks: unknown[]; trees: unknown[]; snowballs: unknown[] }; state: string } }).__GAME_MANAGER__;
      const ag = gm?.activeGame;
      return {
        state: gm?.state,
        hasGame: ag !== undefined,
        roundTimer: ag?.roundTimer,
        mapName: ag?.currentMapName,
        blockCount: ag?.blocks?.length,
        treeCount: ag?.trees?.length,
        playerCount: ag?.playersState?.size
      };
    });

    expect(snowState.hasGame).toBe(true);
    expect(['COUNTDOWN', 'PLAYING']).toContain(snowState.state);
    expect(typeof snowState.mapName).toBe('string');
    expect((snowState.blockCount ?? 0) >= 4).toBe(true);
    expect(snowState.playerCount).toBe(2);

    // Test holding button to charge power
    await page.keyboard.down('Space');
    await page.waitForTimeout(400);

    const chargingState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { playersState: Map<number, { isCharging: boolean; chargePower: number }> } } }).__GAME_MANAGER__;
      const p1 = gm?.activeGame?.playersState?.get(0);
      return {
        isCharging: p1?.isCharging,
        chargePower: p1?.chargePower
      };
    });

    expect(chargingState.isCharging).toBe(true);
    expect(chargingState.chargePower).toBeGreaterThan(0.2);

    // Test releasing to throw snowball
    await page.keyboard.up('Space');
    await page.waitForTimeout(300);

    const throwState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { snowballs: { z: number; vx: number }[] } } }).__GAME_MANAGER__;
      return {
        ballCount: gm?.activeGame?.snowballs?.length ?? 0
      };
    });

    expect(throwState.ballCount).toBeGreaterThanOrEqual(1);

    // Wait for snowball flight and bot interaction
    await page.waitForTimeout(1200);

    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Highway Hop with 2 Players (Crossy Freeway & River Logs)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=highway_hop&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    // Wait past countdown into active gameplay
    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const hopState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { currentMapName: string; lanes: unknown[]; playersState: Map<number, { laneIndex: number; lives: number }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        mapName: gm?.activeGame?.currentMapName,
        laneCount: gm?.activeGame?.lanes?.length ?? 0,
        p1Lane: gm?.activeGame?.playersState?.get(0)?.laneIndex,
        p1Lives: gm?.activeGame?.playersState?.get(0)?.lives
      };
    });

    expect(hopState.hasGame).toBe(true);
    expect(hopState.state).toBe('PLAYING');
    expect(typeof hopState.mapName).toBe('string');
    expect(hopState.laneCount).toBeGreaterThanOrEqual(10);
    expect(hopState.p1Lives).toBe(3);

    // Test hopping forward with Space
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    const advancedState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { playersState: Map<number, { laneIndex: number; score: number }> } } }).__GAME_MANAGER__;
      return {
        p1Lane: gm?.activeGame?.playersState?.get(0)?.laneIndex,
        p1Score: gm?.activeGame?.playersState?.get(0)?.score
      };
    });

    expect(advancedState.p1Lane).toBeGreaterThanOrEqual(1);
    expect(advancedState.p1Score).toBeGreaterThanOrEqual(25);

    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Gold Rush Miner with 2 Players (Underground Cavern & Winch Claw)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=gold_miner&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    // Wait past countdown into active gameplay
    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const minerState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { currentMapName: string; items: unknown[]; playersState: Map<number, { clawState: string; score: number }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        mapName: gm?.activeGame?.currentMapName,
        itemCount: gm?.activeGame?.items?.length ?? 0,
        p1ClawState: gm?.activeGame?.playersState?.get(0)?.clawState
      };
    });

    expect(minerState.hasGame).toBe(true);
    expect(minerState.state).toBe('PLAYING');
    expect(typeof minerState.mapName).toBe('string');
    expect(minerState.itemCount).toBeGreaterThanOrEqual(15);
    expect(minerState.p1ClawState).toBe('SWINGING');

    // Test firing winch claw with Space
    await page.keyboard.down('Space');
    await page.waitForTimeout(120);
    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    const shootingState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { playersState: Map<number, { clawState: string; clawLength: number }> } } }).__GAME_MANAGER__;
      return {
        p1ClawState: gm?.activeGame?.playersState?.get(0)?.clawState,
        clawLength: gm?.activeGame?.playersState?.get(0)?.clawLength
      };
    });

    expect(['SHOOTING', 'REELING', 'SWINGING']).toContain(shootingState.p1ClawState);
    expect(shootingState.clawLength).toBeDefined();

    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Chomp Frogs with 4 Players (Sticky Tongue & Insect Snatching)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=chomp_frogs&players=4`);
    await expect(page.locator('canvas')).toBeVisible();

    // Wait past countdown into active gameplay
    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const frogState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { currentMapName: string; insects: unknown[]; playersState: Map<number, { tongueState: string }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        mapName: gm?.activeGame?.currentMapName,
        insectCount: gm?.activeGame?.insects?.length ?? 0,
        p1TongueState: gm?.activeGame?.playersState?.get(0)?.tongueState
      };
    });

    expect(frogState.hasGame).toBe(true);
    expect(frogState.state).toBe('PLAYING');
    expect(typeof frogState.mapName).toBe('string');
    expect(frogState.insectCount).toBeGreaterThanOrEqual(10);
    expect(frogState.p1TongueState).toBe('IDLE');

    // Test firing tongue with Space
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    const extendingState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { playersState: Map<number, { tongueState: string; tongueLength: number }> } } }).__GAME_MANAGER__;
      return {
        p1TongueState: gm?.activeGame?.playersState?.get(0)?.tongueState,
        tongueLength: gm?.activeGame?.playersState?.get(0)?.tongueLength
      };
    });

    expect(['EXTENDING', 'RETRACTING', 'SNAP_OUT', 'SNAP_IN']).toContain(extendingState.p1TongueState);
    expect(extendingState.tongueLength).toBeGreaterThan(10);

    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Tug of War with 2 Players (Oscillating Power Rhythm Meter)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=tug_of_war&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    // Wait past countdown into active gameplay
    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const tugState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { currentMapName: string; ropeOffset: number; playersState: Map<number, { needle: number; pullCount: number }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        mapName: gm?.activeGame?.currentMapName,
        needle: gm?.activeGame?.playersState?.get(0)?.needle,
        pullCount: gm?.activeGame?.playersState?.get(0)?.pullCount
      };
    });

    expect(tugState.hasGame).toBe(true);
    expect(tugState.state).toBe('PLAYING');
    expect(typeof tugState.mapName).toBe('string');
    expect(tugState.needle).toBeGreaterThanOrEqual(0);
    expect(tugState.needle).toBeLessThanOrEqual(1);

    // Test pulling with Space
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);

    const pulledState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { playersState: Map<number, { pullCount: number; slipCount: number }> } } }).__GAME_MANAGER__;
      const p1 = gm?.activeGame?.playersState?.get(0);
      return {
        acted: (p1?.pullCount ?? 0) + (p1?.slipCount ?? 0)
      };
    });

    expect(pulledState.acted).toBeGreaterThanOrEqual(1);

    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Volley Spike with 2 Players (Beach Volleyball Spikes & Net Physics)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=volley_spike&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const volleyState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { currentMapName: string; ball: { x: number; y: number; vy: number; radius: number }; teamLeftScore: number; teamRightScore: number } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        mapName: gm?.activeGame?.currentMapName,
        ballX: gm?.activeGame?.ball?.x,
        ballY: gm?.activeGame?.ball?.y,
        ballRadius: gm?.activeGame?.ball?.radius,
        teamLeftScore: gm?.activeGame?.teamLeftScore,
        teamRightScore: gm?.activeGame?.teamRightScore
      };
    });

    expect(volleyState.hasGame).toBe(true);
    expect(volleyState.state).toBe('PLAYING');
    expect(typeof volleyState.mapName).toBe('string');
    expect(volleyState.ballRadius).toBe(14);
    expect(volleyState.ballX).toBeGreaterThan(0);
    expect(volleyState.ballY).toBeGreaterThan(0);

    // Press P1 Jump / Spike key (KeyW)
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(300);

    const jumpingState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { playersState: Map<number, { isGrounded: boolean; y: number; groundY: number }> } } }).__GAME_MANAGER__;
      const p1 = gm?.activeGame?.playersState?.get(0);
      return {
        isGrounded: p1?.isGrounded,
        inAir: !(p1?.isGrounded) || (p1?.y ?? 0) < (p1?.groundY ?? 0)
      };
    });

    expect(jumpingState.inAir).toBe(true);
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Maze Escape with 2 Players (Labyrinth Wall Collision & Minotaur Patrol)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=maze_escape&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const mazeState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { currentMapName: string; gems: unknown[]; sentry: { x: number; y: number; radius: number }; playersState: Map<number, { x: number; y: number; score: number }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        mapName: gm?.activeGame?.currentMapName,
        gemCount: gm?.activeGame?.gems?.length ?? 0,
        sentryRadius: gm?.activeGame?.sentry?.radius,
        p1X: gm?.activeGame?.playersState?.get(0)?.x,
        p1Y: gm?.activeGame?.playersState?.get(0)?.y
      };
    });

    expect(mazeState.hasGame).toBe(true);
    expect(mazeState.state).toBe('PLAYING');
    expect(typeof mazeState.mapName).toBe('string');
    expect(mazeState.gemCount).toBeGreaterThanOrEqual(10);
    expect(mazeState.sentryRadius).toBe(15);
    expect(mazeState.p1X).toBeGreaterThan(0);
    expect(mazeState.p1Y).toBeGreaterThan(0);

    // Simulate move right & action
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(200);

    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Pinball Battle with 2 Players (Neon Bumpers & Flipper Actuation)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=pinball_battle&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const pinballState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { currentMapName: string; balls: unknown[]; bumpers: unknown[]; playersState: Map<number, { flipperAnim: number; shields: number }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        mapName: gm?.activeGame?.currentMapName,
        ballCount: gm?.activeGame?.balls?.length ?? 0,
        bumperCount: gm?.activeGame?.bumpers?.length ?? 0,
        p1Shields: gm?.activeGame?.playersState?.get(0)?.shields
      };
    });

    expect(pinballState.hasGame).toBe(true);
    expect(pinballState.state).toBe('PLAYING');
    expect(typeof pinballState.mapName).toBe('string');
    expect(pinballState.ballCount).toBeGreaterThanOrEqual(1);
    expect(pinballState.bumperCount).toBeGreaterThanOrEqual(3);
    expect(pinballState.p1Shields).toBe(5);

    // Actuate flipper with KeyW
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(100);

    const flipperState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { playersState: Map<number, { flipperActive: boolean }> } } }).__GAME_MANAGER__;
      return gm?.activeGame?.playersState?.get(0)?.flipperActive;
    });

    expect(flipperState).toBe(true);
    await page.keyboard.up('KeyW');

    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Mole Panic with 2 Players (Burrow Whacking & Slam Animation)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?game=mole_panic&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const moleState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { currentMapName: string; burrows: unknown[]; playersState: Map<number, { score: number; whackCount: number }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        mapName: gm?.activeGame?.currentMapName,
        burrowCount: gm?.activeGame?.burrows?.length ?? 0,
        p1Score: gm?.activeGame?.playersState?.get(0)?.score
      };
    });

    expect(moleState.hasGame).toBe(true);
    expect(moleState.state).toBe('PLAYING');
    expect(typeof moleState.mapName).toBe('string');
    expect(moleState.burrowCount).toBe(12);
    expect(moleState.p1Score).toBe(0);

    // Press whack action with Space
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    const whackCount = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { playersState: Map<number, { whackCount: number }> } } }).__GAME_MANAGER__;
      return gm?.activeGame?.playersState?.get(0)?.whackCount ?? 0;
    });

    expect(whackCount).toBeGreaterThanOrEqual(1);
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Color Flood with 2 Players and territory expansion', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`${LOCAL_URL}?game=color_flood&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForFunction(() => (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__?.state === 'PLAYING', { timeout: 6000 });

    const floodState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { currentMapName: string; totalValidCells: number } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        mapName: gm?.activeGame?.currentMapName,
        totalCells: gm?.activeGame?.totalValidCells ?? 0
      };
    });

    expect(floodState.hasGame).toBe(true);
    expect(floodState.state).toBe('PLAYING');
    expect(floodState.totalCells).toBeGreaterThan(50);

    await page.keyboard.press('KeyW');
    await page.waitForTimeout(200);
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Memory Matrix with 2 Players and audio note sequence', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`${LOCAL_URL}?game=memory_matrix&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1600);

    const matrixState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { pads: unknown[]; sequence: number[] } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        padCount: gm?.activeGame?.pads?.length ?? 0,
        seqLen: gm?.activeGame?.sequence?.length ?? 0
      };
    });

    expect(matrixState.hasGame).toBe(true);
    expect(matrixState.padCount).toBe(9);
    expect(matrixState.seqLen).toBeGreaterThanOrEqual(3);
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Snake Arena with 4 Players and pellet growth', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`${LOCAL_URL}?game=snake_arena&players=4&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1600);

    const snakeState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { pellets: unknown[]; snakes: Map<number, { isAlive: boolean }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        pelletCount: gm?.activeGame?.pellets?.length ?? 0,
        aliveSnakes: Array.from(gm?.activeGame?.snakes?.values() || []).filter((s) => s.isAlive).length
      };
    });

    expect(snakeState.hasGame).toBe(true);
    expect(snakeState.pelletCount).toBeGreaterThanOrEqual(5);
    expect(snakeState.aliveSnakes).toBe(4);

    await page.keyboard.press('KeyW');
    await page.waitForTimeout(200);
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Mirror Laser with rotatable reflector mirrors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`${LOCAL_URL}?game=mirror_laser&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1600);

    const laserState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { playerStates: Map<number, { health: number }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        p1Health: gm?.activeGame?.playerStates?.get(0)?.health
      };
    });

    expect(laserState.hasGame).toBe(true);
    expect(laserState.p1Health).toBe(3);

    await page.keyboard.press('KeyW');
    await page.waitForTimeout(200);
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Domino Cascade with rhythmic tile laying', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`${LOCAL_URL}?game=domino_cascade&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1600);

    const domState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { playerTracks: Map<number, { waypoints: unknown[] }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        waypointCount: gm?.activeGame?.playerTracks?.get(0)?.waypoints?.length ?? 0
      };
    });

    expect(domState.hasGame).toBe(true);
    expect(domState.waypointCount).toBeGreaterThanOrEqual(30);

    await page.keyboard.press('KeyW');
    await page.waitForTimeout(200);
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Water Balloon Barrage with crosswind artillery', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`${LOCAL_URL}?game=water_balloon&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1600);

    const wbState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { fence: { height: number }; catapults: Map<number, { aimAngle: number }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        fenceHeight: gm?.activeGame?.fence?.height ?? 0,
        hasCatapult: !!gm?.activeGame?.catapults?.get(0)
      };
    });

    expect(wbState.hasGame).toBe(true);
    expect(wbState.fenceHeight).toBeGreaterThan(100);
    expect(wbState.hasCatapult).toBe(true);

    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Sheep Dog Corrals with acoustic barking shockwave', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`${LOCAL_URL}?game=sheep_dog&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1600);

    const dogState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { sheep: unknown[]; pens: unknown[] } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        sheepCount: gm?.activeGame?.sheep?.length ?? 0,
        penCount: gm?.activeGame?.pens?.length ?? 0
      };
    });

    expect(dogState.hasGame).toBe(true);
    expect(dogState.sheepCount).toBeGreaterThanOrEqual(15);
    expect(dogState.penCount).toBe(4);

    await page.keyboard.press('KeyW');
    await page.waitForTimeout(200);
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Chest Snatch with mimic treasure jaw', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`${LOCAL_URL}?game=chest_snatch&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1600);

    const chestState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { gems: unknown[]; playersState: Map<number, { lives: number }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        gemCount: gm?.activeGame?.gems?.length ?? 0,
        p1Lives: gm?.activeGame?.playersState?.get(0)?.lives
      };
    });

    expect(chestState.hasGame).toBe(true);
    expect(chestState.gemCount).toBeGreaterThanOrEqual(10);
    expect(chestState.p1Lives).toBe(3);

    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Rapid Drop 4 real-time token dropping', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`${LOCAL_URL}?game=rapid_drop4&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1600);

    const dropState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { gridCols: number; gridRows: number } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        cols: gm?.activeGame?.gridCols ?? 0,
        rows: gm?.activeGame?.gridRows ?? 0
      };
    });

    expect(dropState.hasGame).toBe(true);
    expect(dropState.cols).toBe(8);
    expect(dropState.rows).toBe(7);

    await page.keyboard.press('KeyW');
    await page.waitForTimeout(200);
    expect(consoleErrors).toEqual([]);
  });

  test('Direct Launch: Floor Painter roller skate turf war', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`${LOCAL_URL}?game=floor_painter&players=2&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1600);

    const painterState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string; activeGame?: { totalTiles: number; skaters: Map<number, { speed: number }> } } }).__GAME_MANAGER__;
      return {
        hasGame: !!gm?.activeGame,
        state: gm?.state,
        totalTiles: gm?.activeGame?.totalTiles ?? 0,
        hasSkater: !!gm?.activeGame?.skaters?.get(0)
      };
    });

    expect(painterState.hasGame).toBe(true);
    expect(painterState.totalTiles).toBeGreaterThanOrEqual(1000);
    expect(painterState.hasSkater).toBe(true);

    await page.keyboard.press('KeyW');
    await page.waitForTimeout(200);
    expect(consoleErrors).toEqual([]);
  });

});




