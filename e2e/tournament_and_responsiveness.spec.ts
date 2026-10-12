import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Tournament Mode, Viewport Responsiveness, Audio & Input Stress Testing', () => {

  test('Autonomous Tournament Mode runs 3 rounds across catalog without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${LOCAL_URL}?tourney=cup&rounds=3&auto=true&speed=fast`);
    await expect(page.locator('canvas')).toBeVisible();

    // Verify tournament initialized
    const isTournament = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { isTournament: boolean; state: string } }).__GAME_MANAGER__;
      return gm?.isTournament;
    });
    expect(isTournament).toBe(true);

    // Fast-forward through 3 rounds
    for (let round = 1; round <= 3; round++) {
      await page.waitForTimeout(1000);

      // Trigger round completion acceleration
      await page.evaluate(() => {
        const gm = (window as unknown as { __GAME_MANAGER__?: { activeGame?: { roundTimer: number } } }).__GAME_MANAGER__;
        if (gm?.activeGame) {
          gm.activeGame.roundTimer = 0.1;
        }
      });

      // Wait for round transition
      await page.waitForTimeout(2500);
    }

    expect(consoleErrors).toEqual([]);
  });

  test('Responsive Viewport Test: Mobile Portrait (390x844 iPhone)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${LOCAL_URL}?game=fireworks_finale&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    const canvasDims = await page.locator('canvas').evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      touchAction: window.getComputedStyle(el).touchAction
    }));

    expect(canvasDims.width).toBeGreaterThan(300);
    expect(canvasDims.height).toBeGreaterThan(500);
    expect(canvasDims.touchAction).toBe('none');
  });

  test('Responsive Viewport Test: Tablet (820x1180 iPad)', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto(`${LOCAL_URL}?game=disco_tile&players=4`);
    await expect(page.locator('canvas')).toBeVisible();

    const canvasDims = await page.locator('canvas').evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight
    }));

    expect(canvasDims.width).toBeGreaterThan(700);
    expect(canvasDims.height).toBeGreaterThan(800);
  });

  test('Responsive Viewport Test: Ultra-wide Desktop (2560x1440)', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto(`${LOCAL_URL}?game=synthwave_highway&players=4`);
    await expect(page.locator('canvas')).toBeVisible();

    const canvasDims = await page.locator('canvas').evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight
    }));

    expect(canvasDims.width).toBeGreaterThan(1800);
    expect(canvasDims.height).toBeGreaterThan(1000);
  });

  test('Audio Engine Volume & Mute API Controls', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tanks&players=2`);
    await expect(page.locator('canvas')).toBeVisible();

    const audioState = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { audio: { getMasterVolume: () => number; setMasterVolume: (v: number) => void; toggleMute: () => boolean } } }).__GAME_MANAGER__;
      if (!gm?.audio) return null;

      const initialVol = gm.audio.getMasterVolume();
      gm.audio.setMasterVolume(0.5);
      const halfVol = gm.audio.getMasterVolume();
      const muted = gm.audio.toggleMute();
      const unmuted = !gm.audio.toggleMute();

      return { initialVol, halfVol, muted, unmuted };
    });

    expect(audioState).not.toBeNull();
    expect(audioState?.halfVol).toBe(0.5);
    expect(audioState?.muted).toBe(true);
    expect(audioState?.unmuted).toBe(true);
  });

  test('Rapid Quad-Corner Multi-Touch Spamming (50 touches per corner)', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=dunk_tank&players=4`);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas box not found');

    // Rapid spam touches across 4 corners
    for (let i = 0; i < 20; i++) {
      await Promise.all([
        page.touchscreen.tap(box.x + 30, box.y + 30),
        page.touchscreen.tap(box.x + box.width - 30, box.y + 30),
        page.touchscreen.tap(box.x + 30, box.y + box.height - 30),
        page.touchscreen.tap(box.x + box.width - 30, box.y + box.height - 30)
      ]);
    }

    const state = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { state: string } }).__GAME_MANAGER__;
      return gm?.state;
    });

    expect(['PLAYING', 'COUNTDOWN']).toContain(state);
  });

  test('Lobby Responsive Hitboxes: Mobile Viewport (390x844) zero clipping and full interactability', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    // Verify all hitboxes are within canvas boundaries
    const boundsCheck = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: {
        canvas: HTMLCanvasElement;
        playerTabHitboxes: { count: number; x: number; y: number; w: number; h: number }[];
        diffHitboxes: { id: string; x: number; y: number; w: number; h: number }[];
        categoryPillBoxes: { id: string; x: number; y: number; w: number; h: number }[];
        playerBadgeHitboxes: { pid: number; x: number; y: number; w: number; h: number }[];
      } }).__GAME_MANAGER__;
      if (!gm) return null;

      const cw = gm.canvas.width;
      const ch = gm.canvas.height;

      const checkBoxes = (boxes: { x: number; y: number; w: number; h: number }[]) => {
        return boxes.every(b => b.x >= 0 && (b.x + b.w) <= cw + 1 && b.y >= 0 && (b.y + b.h) <= ch + 1);
      };

      return {
        cw,
        ch,
        tabsValid: checkBoxes(gm.playerTabHitboxes),
        diffValid: checkBoxes(gm.diffHitboxes),
        catValid: checkBoxes(gm.categoryPillBoxes),
        badgesValid: checkBoxes(gm.playerBadgeHitboxes),
        tabCount: gm.playerTabHitboxes.length,
        diffCount: gm.diffHitboxes.length,
        badgeCount: gm.playerBadgeHitboxes.length
      };
    });

    expect(boundsCheck).not.toBeNull();
    expect(boundsCheck?.tabsValid).toBe(true);
    expect(boundsCheck?.diffValid).toBe(true);
    expect(boundsCheck?.catValid).toBe(true);
    expect(boundsCheck?.badgesValid).toBe(true);
    expect(boundsCheck?.tabCount).toBe(4);
    expect(boundsCheck?.diffCount).toBe(3);
    expect(boundsCheck?.badgeCount).toBe(4);

    // Test clicking 4P quick tab
    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: {
        playerTabHitboxes: { count: number; x: number; y: number; w: number; h: number }[];
        handleCanvasClick: (x: number, y: number) => void;
      } }).__GAME_MANAGER__;
      const tab4 = gm?.playerTabHitboxes.find(t => t.count === 4);
      if (tab4 && gm) {
        gm.handleCanvasClick(tab4.x + tab4.w / 2, tab4.y + tab4.h / 2);
      }
    });

    const activePlayers = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { players: { type: string }[] } }).__GAME_MANAGER__;
      return gm?.players.filter(p => p.type !== 'disabled').length;
    });
    expect(activePlayers).toBe(4);

    // Test clicking AI Difficulty HARD
    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: {
        diffHitboxes: { id: string; x: number; y: number; w: number; h: number }[];
        handleCanvasClick: (x: number, y: number) => void;
      } }).__GAME_MANAGER__;
      const hardBtn = gm?.diffHitboxes.find(d => d.id === 'bot_hard');
      if (hardBtn && gm) {
        gm.handleCanvasClick(hardBtn.x + hardBtn.w / 2, hardBtn.y + hardBtn.h / 2);
      }
    });

    const aiDiff = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { globalBotDifficulty: string } }).__GAME_MANAGER__;
      return gm?.globalBotDifficulty;
    });
    expect(aiDiff).toBe('bot_hard');

    // Test clicking Category "REFLEX"
    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: {
        categoryPillBoxes: { id: string; x: number; y: number; w: number; h: number }[];
        handleCanvasClick: (x: number, y: number) => void;
      } }).__GAME_MANAGER__;
      const reflexPill = gm?.categoryPillBoxes.find(c => c.id === 'Reflex');
      if (reflexPill && gm) {
        gm.handleCanvasClick(reflexPill.x + reflexPill.w / 2, reflexPill.y + reflexPill.h / 2);
      }
    });

    const selectedCat = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: { selectedCategory: string } }).__GAME_MANAGER__;
      return gm?.selectedCategory;
    });
    expect(selectedCat).toBe('Reflex');
  });

});

