import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

async function skipCountdown(page: any) {
  await page.evaluate(() => {
    const gm = (window as any).__GAME_MANAGER__;
    if (gm) {
      gm.countdownTimer = 0;
      gm.state = 'PLAYING';
    }
  });
  await page.waitForTimeout(100);
}

test.describe('Volley Spike - Snappy Controls & 2v2 Team Mechanics', () => {
  test('initializes 2v2 match with 4 players, 2 teams, and clean stopped player physics (no auto-patrol drift)', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=volley_spike&players=4&bots=3&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(150);

    const debug = await page.evaluate(() => (window as any).__VOLLEY_SPIKE_DEBUG__);
    expect(debug).toBeTruthy();
    expect(debug.players.length).toBe(4);

    // Player 0 (Left team human) should start with vx === 0 and NOT auto-patrol drift
    const p0 = debug.players[0];
    expect(p0.team).toBe('LEFT');
    expect(p0.vx).toBe(0);

    // In 2-player local multiplayer (WASD vs Arrows), P0 & P2 are LEFT team (Blue), P1 & P3 are RIGHT team (Red)
    expect(debug.players[0].team).toBe('LEFT');
    expect(debug.players[1].team).toBe('RIGHT');
    expect(debug.players[2].team).toBe('LEFT');
    expect(debug.players[3].team).toBe('RIGHT');
  });

  test('direct player controls: A/D moves cleanly, releasing stops immediately with zero drift', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=volley_spike&players=4&bots=3&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(100);

    // Dispatch KeyD down for Player 0 (WASD)
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    });
    await page.waitForTimeout(120);

    let debug = await page.evaluate(() => (window as any).__VOLLEY_SPIKE_DEBUG__);
    expect(debug.players[0].vx).toBeGreaterThan(0);

    // Release KeyD - player must stop with zero drift (no auto-patrol)
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    });
    await page.waitForTimeout(100);

    debug = await page.evaluate(() => (window as any).__VOLLEY_SPIKE_DEBUG__);
    expect(debug.players[0].vx).toBe(0);
  });

  test('jumping and dive sliding save mechanics work with vertical/horizontal inputs', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=volley_spike&players=4&bots=3&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(100);

    // Dispatch KeyS down for sliding dive save
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    });
    await page.waitForTimeout(80);

    let debug = await page.evaluate(() => (window as any).__VOLLEY_SPIKE_DEBUG__);
    expect(debug.players[0].isDiving).toBe(true);
    expect(debug.players[0].diveTimer).toBeGreaterThan(0);

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
    });
    await page.waitForTimeout(400);

    // Dispatch KeyW down for jumping
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    });
    await page.waitForTimeout(80);

    debug = await page.evaluate(() => (window as any).__VOLLEY_SPIKE_DEBUG__);
    expect(debug.players[0].isGrounded).toBe(false);
    expect(debug.players[0].vy).toBeLessThan(0);

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    });
  });

  test('scoring awards points to both 2v2 teammates and Duo Combo bonus on assist + spike', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=volley_spike&players=4&bots=3&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(100);

    // Trigger normal point for LEFT team
    await page.evaluate(() => {
      const debug = (window as any).__VOLLEY_SPIKE_DEBUG__;
      debug.handlePointScored('LEFT', 'POINT LEFT!');
    });

    let debug = await page.evaluate(() => (window as any).__VOLLEY_SPIKE_DEBUG__);
    expect(debug.teamLeftScore).toBe(1);
    // Both teammate 0 and teammate 2 on LEFT team should have received 100 points
    expect(debug.players[0].score).toBe(100);
    expect(debug.players[2].score).toBe(100);

    // Now simulate a Duo Combo (P0 set, P2 spike)
    await page.evaluate(() => {
      const debug = (window as any).__VOLLEY_SPIKE_DEBUG__;
      // P0 touched ball first
      debug.ball.previousTouchPlayer = 0;
      // P2 spiked ball
      debug.ball.lastTouchPlayer = 2;
      debug.ball.lastTouchTeam = 'LEFT';
      debug.handlePointScored('LEFT', 'SPIKE!');
    });

    debug = await page.evaluate(() => (window as any).__VOLLEY_SPIKE_DEBUG__);
    expect(debug.teamLeftScore).toBe(2);
    // P0 gets 100 + 30 assist bonus = 130 + previous 100 = 230
    expect(debug.players[0].score).toBe(230);
    // P2 gets 100 + 30 spike bonus = 130 + previous 100 = 230
    expect(debug.players[2].score).toBe(230);
  });

  test('winning team gives shared 1st place podium rankings (place: 1) for both teammates', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=volley_spike&players=4&bots=3&difficulty=normal`);
    await expect(page.locator('canvas')).toBeVisible();
    await skipCountdown(page);
    await page.waitForTimeout(100);

    // Score 7 points for LEFT team to win the match
    await page.evaluate(() => {
      const debug = (window as any).__VOLLEY_SPIKE_DEBUG__;
      for (let i = 0; i < 7; i++) {
        debug.handlePointScored('LEFT', 'POINT LEFT!');
      }
    });

    await page.waitForTimeout(150);

    const result = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm ? gm.activeGame : null;
      return game ? game.getRoundResult() : null;
    });

    expect(result).toBeTruthy();
    expect(result.rankings.length).toBe(4);

    // In 2v2, both players on the winning team share 1st place (place: 1)
    const firstPlacePlayers = result.rankings.filter((r: any) => r.place === 1);
    expect(firstPlacePlayers.length).toBe(2);
    expect(firstPlacePlayers.map((r: any) => r.playerId).sort()).toEqual([0, 2]);

    // Both players on losing team share 2nd place (place: 2)
    const secondPlacePlayers = result.rankings.filter((r: any) => r.place === 2);
    expect(secondPlacePlayers.length).toBe(2);
    expect(secondPlacePlayers.map((r: any) => r.playerId).sort()).toEqual([1, 3]);

    expect(result.mvpHighlight).toContain('Blue Duo');
  });
});
