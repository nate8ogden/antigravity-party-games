import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Skyline Sumo Just For Fun Mode & Unblocked Timer', () => {
  test('Lobby modal has Just For Fun mode toggle, altitude buttons, and starts speedrun', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    // 1. Open game modal for Skyline Sumo
    const modalOpened = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (!gm) return false;
      gm.openGameModalById('skyline_sumo');
      return gm.isModalOpen;
    });
    expect(modalOpened).toBe(true);

    // 2. Verify modal hitboxes exist for mode switching
    const hitboxes = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.render();
      return gm.sumoHitboxes?.map((h: any) => h.id) || [];
    });

    expect(hitboxes).toContain('sumo_mode_standard');
    expect(hitboxes).toContain('sumo_mode_no_limit');

    // 3. Click "⚡ JUST FOR FUN" tab
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const noLimitBox = gm.sumoHitboxes.find((h: any) => h.id === 'sumo_mode_no_limit');
      gm.handleCanvasClick(noLimitBox.x + 5, noLimitBox.y + 5);
      gm.render();
    });

    const modeAfterClick = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      return gm.sumoMode;
    });
    expect(modeAfterClick).toBe('no_limit');

    // Verify altitude button hitboxes now appear in Just For Fun mode
    const altitudeHitboxes = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      return gm.sumoHitboxes?.map((h: any) => h.id) || [];
    });
    expect(altitudeHitboxes).toContain('sumo_alt_100m');
    expect(altitudeHitboxes).toContain('sumo_alt_250m');
    expect(altitudeHitboxes).toContain('sumo_alt_500m');
    expect(altitudeHitboxes).toContain('sumo_alt_1,000m');
    expect(altitudeHitboxes).toContain('sumo_alt_− 50m');
    expect(altitudeHitboxes).toContain('sumo_alt_+ 50m');
    expect(altitudeHitboxes).toContain('sumo_play_btn');

    // 4. Click 500m altitude button
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const btn500 = gm.sumoHitboxes.find((h: any) => h.id === 'sumo_alt_500m');
      gm.handleCanvasClick(btn500.x + 5, btn500.y + 5);
    });

    const altitudeSelected = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      return gm.sumoTargetMeters;
    });
    expect(altitudeSelected).toBe(500);

    // 5. Start the game via play button
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const playBox = gm.sumoHitboxes.find((h: any) => h.id === 'sumo_play_btn');
      gm.handleCanvasClick(playBox.x + 5, playBox.y + 5);
    });

    // Verify game starts in Just For Fun mode with 500m goal
    const gameState = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const sumo = gm.activeGame;
      return {
        state: gm.state,
        isNoTimeLimit: sumo?.isNoTimeLimit,
        targetMeters: sumo?.targetMeters,
        roundTimer: sumo?.roundTimer
      };
    });

    expect(gameState.isNoTimeLimit).toBe(true);
    expect(gameState.targetMeters).toBe(500);
    expect(gameState.roundTimer).toBe(Infinity);
    expect(pageErrors.length).toBe(0);
  });

  test('Timer is completely unblocked during gameplay by any DOM elements or side pills', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    // Launch game into PLAYING state
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('skyline_sumo');
      gm.state = 'PLAYING';
    });
    await page.waitForTimeout(100);

    // Check DOM utility bar location
    const utilityBarBox = await page.locator('.utility-bar').boundingBox();
    const canvasBox = await page.locator('#game-canvas').boundingBox();

    expect(utilityBarBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();

    // The utility bar MUST be at the bottom, NOT at top
    // Canvas timer sits at y: 12..48 in canvas space
    expect(utilityBarBox!.y).toBeGreaterThan(canvasBox!.height * 0.7);

    // Verify non-gameplay buttons (.shop-btn, .trophy-btn) are hidden during in-game matches
    const bodyClass = await page.evaluate(() => document.body.className);
    expect(bodyClass).toContain('in-game');

    const shopBtnVisible = await page.locator('.shop-btn').isVisible();
    const trophyBtnVisible = await page.locator('.trophy-btn').isVisible();
    expect(shopBtnVisible).toBe(false);
    expect(trophyBtnVisible).toBe(false);

    // Verify side player HUD pills leave clear center clearance for the stopwatch
    const hudPillClearance = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const w = gm.logicalWidth;
      const centerMinX = w / 2 - 110;
      const centerMaxX = w / 2 + 110;

      // P1 HUD pill is aligned left at x=18
      const p1Text = `${gm.players[0].name} [WASD + Space]`;
      const p1TextW = gm.ctx.measureText(p1Text).width;
      const isNoLimit = gm.activeGame?.isNoTimeLimit === true;
      const centerZoneW = isNoLimit ? 210 : 120;
      const maxPillW = Math.max(70, Math.floor((w / 2 - centerZoneW / 2) - 18));
      const p1PillW = Math.min(p1TextW + 48, maxPillW);
      const p1Right = 18 + p1PillW;

      // P2 HUD pill is aligned right at w - 18
      const p2Text = `${gm.players[1].name} [Arrows + Enter]`;
      const p2TextW = gm.ctx.measureText(p2Text).width;
      const p2PillW = Math.min(p2TextW + 48, maxPillW);
      const p2Left = (w - 18) - p2PillW;

      return {
        p1Right,
        p2Left,
        centerMinX,
        centerMaxX,
        p1ClearsCenter: p1Right < centerMinX,
        p2ClearsCenter: p2Left > centerMaxX
      };
    });

    expect(hudPillClearance.p1ClearsCenter).toBe(true);
    expect(hudPillClearance.p2ClearsCenter).toBe(true);
  });

  test('Works completely standalone in web browser under file:// protocol with no server', async ({ page }) => {
    const standalonePath = path.resolve(process.cwd(), 'Antigravity_Games.html');
    const fileUrl = `file://${standalonePath}`;

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(fileUrl);
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const verified = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (!gm) return false;
      // Test starting Just For Fun mode from standalone file
      gm.sumoMode = 'no_limit';
      gm.sumoTargetMeters = 300;
      gm.startGame('skyline_sumo');
      gm.state = 'PLAYING';
      const sumo = gm.activeGame;
      return sumo && sumo.isNoTimeLimit === true && sumo.targetMeters === 300;
    });

    expect(verified).toBe(true);
    expect(pageErrors.length).toBe(0);
  });
});
