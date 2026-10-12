import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Picky Multi-Perspective Audit Verification', () => {
  test('Persona A & B: Keyboard Grid Navigation (Arrows & Enter) in Lobby', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    // Check initial selectedGameIndex is 0
    let initialIndex = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { selectedGameIndex: number } }).__GAME_MANAGER__;
      return mgr?.selectedGameIndex;
    });
    expect(initialIndex).toBe(0);

    // Press ArrowRight to advance selection
    await page.keyboard.press('ArrowRight');
    let newIndex = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { selectedGameIndex: number } }).__GAME_MANAGER__;
      return mgr?.selectedGameIndex;
    });
    expect(newIndex).toBe(1);

    // Press ArrowDown to jump by columns
    await page.keyboard.press('ArrowDown');
    let downIndex = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { selectedGameIndex: number } }).__GAME_MANAGER__;
      return mgr?.selectedGameIndex;
    });
    expect(downIndex).toBeGreaterThan(1);

    // Press Space to open How to Play modal
    await page.keyboard.press(' ');
    let isModalOpen = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { isModalOpen: boolean } }).__GAME_MANAGER__;
      return mgr?.isModalOpen;
    });
    expect(isModalOpen).toBe(true);

    // Press Escape to close modal
    await page.keyboard.press('Escape');
    isModalOpen = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { isModalOpen: boolean } }).__GAME_MANAGER__;
      return mgr?.isModalOpen;
    });
    expect(isModalOpen).toBe(false);
  });

  test('Persona A: Hovering clickable card changes canvas cursor to pointer', async ({ page }) => {
    await page.goto(LOCAL_URL);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas box not found');

    // Move to center of first card
    await page.mouse.move(box.x + 280, box.y + 240);
    await page.waitForTimeout(100);

    const cursorStyle = await canvas.evaluate((el) => window.getComputedStyle(el).cursor);
    expect(cursorStyle).toBe('pointer');

    // Move to left empty margin outside cards and badges
    await page.mouse.move(box.x + 80, box.y + 110);
    await page.waitForTimeout(100);

    const emptyCursorStyle = await canvas.evaluate((el) => window.getComputedStyle(el).cursor);
    expect(emptyCursorStyle).toBe('default');
  });

  test('Persona B & C: SFX Setting disabling works across entire synthesizer', async ({ page }) => {
    await page.goto(LOCAL_URL);
    
    // Toggle sfx in audio engine
    const sfxResult = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { audio: { setSfxEnabled: (v: boolean) => void; isSfxEnabled: () => boolean } } }).__GAME_MANAGER__;
      mgr?.audio.setSfxEnabled(false);
      return mgr?.audio.isSfxEnabled();
    });
    expect(sfxResult).toBe(false);
  });

  test('Persona D: Podium celebratory exit resets scores and returns to lobby', async ({ page }) => {
    await page.goto(LOCAL_URL);

    await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { state: string; players: { score: number }[]; exitPodiumToLobby: () => void } }).__GAME_MANAGER__;
      if (mgr) {
        mgr.state = 'PODIUM';
        mgr.players[0].score = 5;
        mgr.exitPodiumToLobby();
      }
    });

    const state = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { state: string; players: { score: number }[] } }).__GAME_MANAGER__;
      return { state: mgr?.state, score: mgr?.players[0].score };
    });

    expect(state.state).toBe('LOBBY');
    expect(state.score).toBe(0);
  });
});
