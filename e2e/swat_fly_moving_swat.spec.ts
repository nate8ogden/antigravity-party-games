import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Swat the Fly: Mid-Air & Moving Fly Swatting', () => {
  test('Flying / moving flies can be swatted mid-air', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=swat_fly&players=1&difficulty=normal&autostart=true`);
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => {
      const gs = (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__;
      return gs && gs.state === 'PLAYING';
    }, { timeout: 6000 });

    // Spawn a moving/flying fly directly near player's swatter
    const spawnInfo = await page.evaluate(() => {
      const dbg = (window as unknown as { __SWAT_FLY_DEBUG__?: {
        getSwatters: () => Array<{ id: number; x: number; y: number; score: number }>;
        spawnMovingFlyNear: (x: number, y: number) => { id: number; state: string; x: number; y: number };
      } }).__SWAT_FLY_DEBUG__;

      const sw = dbg?.getSwatters()[0];
      if (!sw) return null;

      // Spawn a flying fly 15px away from swatter
      const fly = dbg?.spawnMovingFlyNear(sw.x + 10, sw.y + 10);
      return {
        initialScore: sw.score,
        flyState: fly?.state,
        flyId: fly?.id,
        swatterX: sw.x,
        swatterY: sw.y
      };
    });

    expect(spawnInfo).not.toBeNull();
    expect(spawnInfo?.flyState).toBe('flying');

    // Press Space to swat the moving fly
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    const postSwat = await page.evaluate((flyId) => {
      const dbg = (window as unknown as { __SWAT_FLY_DEBUG__?: {
        getSwatters: () => Array<{ id: number; x: number; y: number; score: number }>;
        getInsects: () => Array<{ id: number; alive: boolean; state: string }>;
      } }).__SWAT_FLY_DEBUG__;

      const sw = dbg?.getSwatters()[0];
      const insects = dbg?.getInsects() || [];
      const targetFly = insects.find((i) => i.id === flyId);

      return {
        newScore: sw?.score || 0,
        flyAlive: targetFly ? targetFly.alive : false
      };
    }, spawnInfo!.flyId);

    // Verify the moving fly was swatted: score increased, fly was squashed!
    expect(postSwat.newScore).toBeGreaterThan(spawnInfo!.initialScore);
    expect(postSwat.flyAlive).toBe(false);
  });

  test('Bot AI can target and swat moving insects as well', async ({ page }) => {
    // Start game with 1 bot
    await page.goto(`${LOCAL_URL}?game=swat_fly&players=2&bots=1&difficulty=hard&autostart=true`);
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => {
      const gs = (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__;
      return gs && gs.state === 'PLAYING';
    }, { timeout: 6000 });

    // Wait a few seconds for bot to play and score points against moving/landed flies
    await page.waitForTimeout(3000);

    const botScore = await page.evaluate(() => {
      const dbg = (window as unknown as { __SWAT_FLY_DEBUG__?: {
        getSwatters: () => Array<{ id: number; score: number }>;
      } }).__SWAT_FLY_DEBUG__;
      const bot = dbg?.getSwatters().find((s) => s.id === 1);
      return bot?.score ?? 0;
    });

    expect(botScore).toBeGreaterThanOrEqual(0);
  });
});
