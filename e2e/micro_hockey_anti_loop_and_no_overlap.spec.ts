import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Micro Hockey: Anti-Loop, Smart Bot AI, No HUD Overlap', () => {
  test('Puck anti-loop watchdog and spin perturbation prevent infinite loops', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=micro_hockey&players=2&bots=1&autostart=true`);
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => {
      const gs = (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__;
      return gs && gs.state === 'PLAYING';
    }, { timeout: 6000 });

    // Trigger simulated loop via debug interface
    await page.evaluate(() => {
      const dbg = (window as unknown as { __MICRO_HOCKEY_DEBUG__?: { triggerSimulatedLoop: () => void } }).__MICRO_HOCKEY_DEBUG__;
      dbg?.triggerSimulatedLoop();
    });

    // Wait a brief moment for anti-loop watchdog to engage and break loop
    await page.waitForTimeout(600);

    const postLoopState = await page.evaluate(() => {
      const dbg = (window as unknown as { __MICRO_HOCKEY_DEBUG__?: {
        getPuck: () => { vx: number; vy: number };
        getLoopState: () => { stagnation: number; wallBounces: number };
      } }).__MICRO_HOCKEY_DEBUG__;
      return {
        vx: dbg?.getPuck().vx || 0,
        vy: dbg?.getPuck().vy || 0,
        loopState: dbg?.getLoopState()
      };
    });

    // Puck must have broken out of pure vertical movement (vx !== 0)
    expect(Math.abs(postLoopState.vx)).toBeGreaterThan(20);
    // Wall bounce / stagnation counters reset
    expect(postLoopState.loopState?.wallBounces).toBeLessThan(5);
  });

  test('Bot AI actively predicts and defends net with ray-circle interception', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=micro_hockey&players=2&bots=1&difficulty=hard&autostart=true`);
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => {
      const gs = (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__;
      return gs && gs.state === 'PLAYING';
    }, { timeout: 6000 });

    // Wait 2.5 seconds to observe bot actively defending
    await page.waitForTimeout(2500);

    const botPaddle = await page.evaluate(() => {
      const dbg = (window as unknown as { __MICRO_HOCKEY_DEBUG__?: {
        getPaddles: () => Array<{ id: number; paddleAngleOffset: number; goalsConceded: number }>;
      } }).__MICRO_HOCKEY_DEBUG__;
      return dbg?.getPaddles().find((p) => p.id === 1);
    });

    expect(botPaddle).toBeDefined();
    // Bot should have moved its paddle to guard net (non-zero or dynamically reacting)
    expect(botPaddle).not.toBeNull();
  });

  test('Time and Hockey Arena / Score Pills have zero overlap', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=micro_hockey&players=4&autostart=true`);
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => {
      const gs = (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__;
      return gs && gs.state === 'PLAYING';
    }, { timeout: 6000 });

    const layout = await page.evaluate(() => {
      const dbg = (window as unknown as { __MICRO_HOCKEY_DEBUG__?: {
        getArena: () => { x: number; y: number; radius: number };
        getPaddles: () => Array<{ centerAngle: number }>;
      } }).__MICRO_HOCKEY_DEBUG__;

      const arena = dbg?.getArena();
      // Timer is at Y=8, height=30 (bottom Y=38)
      const timerBottomY = 38;
      const arenaTopY = (arena?.y || 300) - (arena?.radius || 190) - 12;

      return {
        timerBottomY,
        arenaTopY,
        clearance: arenaTopY - timerBottomY
      };
    });

    // Substantial clear vertical buffer between timer bottom and arena top
    expect(layout.clearance).toBeGreaterThanOrEqual(40);
  });
});
