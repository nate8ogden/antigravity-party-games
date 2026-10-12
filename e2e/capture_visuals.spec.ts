import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

const ALL_32_GAMES = [
  'tanks', 'hovercraft', 'laser_grid', 'orbital',
  'micro_gp', 'ghost_flashlight', 'kitchen_chaos', 'skyline_sumo',
  'animal_stack', 'sumo_iceberg', 'cannon_barrage', 'anvil_rain',
  'bomb_relay', 'micro_hockey', 'quick_draw', 'balloon_burst',
  'swat_fly', 'stop_at_zero', 'turf_whack', 'neon_lightcycles',
  'blade_parry', 'safe_dial', 'coin_apex', 'red_light_sentry',
  'laser_leap', 'color_clash', 'meteor_shield', 'sequence_clash',
  'bubble_soccer', 'wire_cutter', 'magma_hop', 'rhythm_duel'
];

test.describe('Minigame Visual Capture & UI Gallery Verification', () => {
  test('Capture snapshot: Lobby with Scrollable 16-Game Custom Art Squares Gallery', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/lobby_art_squares_gallery.png' });
  });

  test('Capture snapshot: "How to Play" Pop-up Modal with Hero Art', async ({ page }) => {
    await page.goto(LOCAL_URL);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas box not found');

    await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { openGameModal: (idx: number) => void } }).__GAME_MANAGER__;
      mgr?.openGameModal(8); // Animal Stack is index 8 (Game 9)
    });
    await page.waitForTimeout(400);

    const isModalOpen = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { isModalOpen: boolean } }).__GAME_MANAGER__;
      return mgr?.isModalOpen === true;
    });
    expect(isModalOpen).toBe(true);

    await page.screenshot({ path: 'test-results/how_to_play_modal.png' });
  });

  test('Capture snapshot: Settings & Preferences Modal', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('#settings-btn')).toBeVisible();

    // Open settings modal
    await page.click('#settings-btn');
    await page.waitForTimeout(400);

    const isSettingsOpen = await page.evaluate(() => {
      const mgr = (window as unknown as { __GAME_MANAGER__?: { isSettingsOpen: boolean } }).__GAME_MANAGER__;
      return mgr?.isSettingsOpen === true;
    });
    expect(isSettingsOpen).toBe(true);

    await page.screenshot({ path: 'test-results/settings_modal.png' });
  });

  test('Capture snapshot: Victory Round Over Screen with Hero Mascot', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tanks&players=2`);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: any }).__GAME_MANAGER__;
      if (!gm) return;
      gm.state = 'ROUND_OVER';
      gm.currentRoundResult = {
        winnerId: 0,
        mvpHighlight: 'Master of Ricochet & Precision Snipes!',
        rankings: [
          { playerId: 0, place: 1, score: 3 },
          { playerId: 1, place: 2, score: 1 }
        ]
      };
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/victory_screen_hero.png' });
  });

  test('Capture snapshot: Tournament Champion Podium with Mascots', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=tanks&players=4`);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__?: any }).__GAME_MANAGER__;
      if (!gm) return;
      gm.state = 'PODIUM';
      gm.players[0].score = 5;
      gm.players[1].score = 3;
      gm.players[2].score = 2;
      gm.players[3].score = 0;
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/podium_screen_mascots.png' });
  });

  for (const g of ALL_32_GAMES) {
    test(`Capture snapshot: ${g}`, async ({ page }) => {
      await page.goto(`${LOCAL_URL}?game=${g}&players=2&bots=1&difficulty=normal&speed=fast`);
      await page.waitForTimeout(2200); // Wait for countdown to finish into active gameplay
      await page.screenshot({ path: `test-results/game_${g}.png` });
    });
  }

  test('Capture snapshot: Popcorn Popper redesign in action', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=popcorn_popper&players=4&bots=3&difficulty=normal`);
    await page.waitForTimeout(3800); // Wait for countdown into full active gameplay with kernels popping
    await page.screenshot({ path: 'test-results/game_popcorn_popper_redesign.png' });
  });

  test('Capture snapshot: Fruit Blender redesign in action', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=fruit_blender&players=4&bots=3&difficulty=normal`);
    await page.waitForTimeout(3800); // Wait for countdown into full active gameplay with fruits dropping
    await page.screenshot({ path: 'test-results/game_fruit_blender_redesign.png' });
  });

  test('Capture snapshot: Pizza Toss redesign in action', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=pizza_toss&players=4&bots=3&difficulty=normal`);
    await page.waitForTimeout(3800); // Wait for countdown into full active gameplay with pizzas flying
    await page.screenshot({ path: 'test-results/game_pizza_toss_redesign.png' });
  });

  test('Capture snapshot: Teppanyaki Catch redesign in action', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=teppanyaki_catch&players=4&bots=3&difficulty=normal`);
    await page.waitForTimeout(3800); // Wait for countdown into full active gameplay with spatulas juggling
    await page.screenshot({ path: 'test-results/game_teppanyaki_catch_redesign.png' });
  });

  test('Capture snapshot: Vault Safe redesign in action', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=vault_safe&players=4&bots=3&difficulty=normal`);
    await page.waitForTimeout(3800); // Wait for countdown into full active gameplay with thermal drills cutting
    await page.screenshot({ path: 'test-results/game_vault_safe_redesign.png' });
  });
});

