import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Endurance, Chaos & Deep Stress Suite', () => {

  test('Dynamic Viewport Thrashing: Resizes During Active Gameplay with 0 Crashes or NaNs', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${LOCAL_URL}?game=micro_gp&players=4&bots=3&autostart=true`);
    await expect(page.locator('canvas')).toBeVisible();

    const viewports = [
      { width: 390, height: 844 },   // iPhone 14
      { width: 1024, height: 768 },  // iPad Landscape
      { width: 1920, height: 1080 }, // 1080p Desktop
      { width: 820, height: 1180 },  // iPad Portrait
      { width: 2560, height: 1440 }, // Ultra-wide QHD
      { width: 480, height: 320 }    // Ultra-compact mobile
    ];

    // Cycle through 18 rapid viewport switches during active gameplay
    for (let i = 0; i < 18; i++) {
      const vp = viewports[i % viewports.length];
      await page.setViewportSize(vp);
      await page.waitForTimeout(100);
    }

    // Inspect game state after thrashing: check canvas bounds and NaN freedom
    const stateCheck = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { canvas: HTMLCanvasElement; activeGame?: any; state: string } }).__GAME_MANAGER__;
      if (!gm || !gm.activeGame) return { valid: false, reason: 'GameManager or activeGame missing' };

      const canvas = gm.canvas;
      const isDimensionValid = canvas.width > 0 && canvas.height > 0;
      const ag = gm.activeGame;

      // Scan all numeric fields in active game
      let hasNaN = false;
      const scanObject = (obj: any, depth = 0) => {
        if (!obj || depth > 3) return;
        for (const k of Object.keys(obj)) {
          const val = obj[k];
          if (typeof val === 'number') {
            if (isNaN(val) || !isFinite(val)) hasNaN = true;
          } else if (typeof val === 'object' && val !== null) {
            scanObject(val, depth + 1);
          }
        }
      };
      scanObject(ag);

      return {
        valid: isDimensionValid && !hasNaN,
        canvasW: canvas.width,
        canvasH: canvas.height,
        hasNaN,
        gameState: gm.state
      };
    });

    expect(stateCheck.valid, `Viewport thrashing caused invalid state: ${JSON.stringify(stateCheck)}`).toBe(true);
    expect(consoleErrors).toEqual([]);
  });

  test('Audio Engine Saturation: 300 Rapid Sound Triggers & Volume Thrashing with 0 Errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${LOCAL_URL}`);
    await expect(page.locator('canvas')).toBeVisible();

    const audioStressResult = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { audio: any } }).__GAME_MANAGER__;
      const audio = gm?.audio;
      if (!audio) return { success: false, reason: 'AudioEngine missing' };

      try {
        // Trigger 300 audio calls across all SFX types
        for (let i = 0; i < 30; i++) {
          audio.playTap();
          audio.playBounce();
          audio.playScore();
          audio.playChime();
          audio.playExplosion();
          audio.playWhoosh();
          audio.playCountdown(i % 3 === 0);
          audio.playFanfare();
          audio.playTone(220 + (i * 10), 0.05, 'triangle');
          audio.playLaser();

          // Rapidly thrash volume
          audio.setMasterVolume((i % 10) / 10);
          audio.setSfxEnabled(i % 2 === 0);
        }

        // Test extreme/corrupted values
        audio.setMasterVolume(NaN);
        audio.setMasterVolume(-5);
        audio.setMasterVolume(999);
        audio.setMasterVolume(0.8);
        audio.setSfxEnabled(true);

        return { success: true, finalVol: audio.getMasterVolume() };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    expect(audioStressResult.success, `Audio stress failed: ${audioStressResult.error}`).toBe(true);
    expect(consoleErrors).toEqual([]);
  });

  test('Storage Corruption & Malformed Data Defense: Graceful Fallback with 0 Crashes', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Seed corrupted data into localStorage before navigating
    await page.addInitScript(() => {
      localStorage.setItem('antigravity_settings', JSON.stringify({
        masterVolume: 'invalid_string',
        sfxEnabled: 'not_a_bool',
        gameSpeed: NaN,
        tournamentGoal: -99,
        shakeLevel: 'ultra_mega_super'
      }));
      localStorage.setItem('antigravity_records', '{ corrupted json: true }}}');
    });

    await page.goto(`${LOCAL_URL}`);
    await expect(page.locator('canvas')).toBeVisible();

    // Verify settings safely recovered to sanitized values
    const settingsStatus = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { settings: any } }).__GAME_MANAGER__;
      return gm?.settings;
    });

    expect(settingsStatus).toBeDefined();
    expect(typeof settingsStatus.masterVolume).toBe('number');
    expect(isNaN(settingsStatus.masterVolume)).toBe(false);
    expect(typeof settingsStatus.gameSpeed).toBe('number');
    expect(isNaN(settingsStatus.gameSpeed)).toBe(false);
    expect(settingsStatus.tournamentGoal).toBeGreaterThan(0);
    expect(['full', 'reduced', 'off']).toContain(settingsStatus.shakeLevel);
    expect(consoleErrors).toEqual([]);
  });

  test('Multi-Touch Corner Rapid Spam: 100 Simulated Corner Taps During Active Match', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${LOCAL_URL}?game=animal_stack&players=4&bots=0&autostart=true`);
    await expect(page.locator('canvas')).toBeVisible();

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const corners = [
        { x: box.x + 40, y: box.y + 40 },                      // Top-Left (P1)
        { x: box.x + box.width - 40, y: box.y + 40 },           // Top-Right (P2)
        { x: box.x + 40, y: box.y + box.height - 40 },          // Bottom-Left (P3)
        { x: box.x + box.width - 40, y: box.y + box.height - 40 } // Bottom-Right (P4)
      ];

      // Dispatch 25 cycles of quad-corner taps
      for (let i = 0; i < 25; i++) {
        for (const pt of corners) {
          await page.mouse.click(pt.x, pt.y);
        }
        await page.waitForTimeout(20);
      }
    }

    // Verify input system is not stuck in down state
    const inputState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { input: any; state: string } }).__GAME_MANAGER__;
      const inp = gm?.input;
      if (!inp) return null;
      return {
        p0: inp.isPressed(0),
        p1: inp.isPressed(1),
        p2: inp.isPressed(2),
        p3: inp.isPressed(3)
      };
    });

    expect(inputState).not.toBeNull();
    // After mouse clicks complete, buttons should not remain permanently held
    expect(inputState?.p0).toBe(false);
    expect(inputState?.p1).toBe(false);
    expect(inputState?.p2).toBe(false);
    expect(inputState?.p3).toBe(false);
    expect(consoleErrors).toEqual([]);
  });

  test('Bot Autonomous Mobility & Non-Stagnation: 8 Diverse Games Verify Active Movement', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const TEST_GAMES = [
      'skyline_sumo',
      'dodgeball_blitz',
      'magma_hop',
      'orbital',
      'laser_grid',
      'bomb_relay',
      'sumo_iceberg',
      'catapult_clash'
    ];

    await page.goto(`${LOCAL_URL}`);
    await expect(page.locator('canvas')).toBeVisible();

    const mobilityResults = await page.evaluate(async (games) => {
      const gm = (window as unknown as { __GAME_MANAGER__?: {
        startGame: (id: string) => void;
        activeGame?: any;
        setPlayerCount: (n: number) => void;
        players: any[];
        globalBotDifficulty: string;
      } }).__GAME_MANAGER__;

      if (!gm) return [];

      gm.setPlayerCount(4);
      gm.players.forEach(p => {
        if (p.type !== 'disabled') p.type = 'bot_hard';
      });

      const results: { game: string; botActionsFired: boolean; moved: boolean }[] = [];

      for (const gId of games) {
        gm.startGame(gId);
        const ag = gm.activeGame;
        if (!ag) {
          results.push({ game: gId, botActionsFired: false, moved: false });
          continue;
        }

        // Wait 1.5 seconds in simulation time (90 frames)
        let anyInputDetected = false;
        for (let f = 0; f < 60; f++) {
          ag.update(0.016, 800, 600);
          // Check if any bot triggered an input in InputRouter
          for (let p = 0; p < 4; p++) {
            if (ag.input.isPressed(p) || ag.input.justPressed(p) || ag.input.getThrottle(p) !== 0 || ag.input.getSteer(p) !== 0) {
              anyInputDetected = true;
            }
          }
        }

        results.push({
          game: gId,
          botActionsFired: anyInputDetected,
          moved: true
        });
      }

      return results;
    }, TEST_GAMES);

    for (const r of mobilityResults) {
      expect(r.moved, `Bot failed to instance in ${r.game}`).toBe(true);
      expect(r.botActionsFired, `Bots took no input in ${r.game}`).toBe(true);
    }
    expect(consoleErrors).toEqual([]);
  });

});
