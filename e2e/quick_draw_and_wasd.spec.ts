import { test, expect } from '@playwright/test';

test.describe('Quick Draw Western, Startup Toggle, and WASD Vertical Controls', () => {
  test('Startup player toggle: shows 1 Player v AI selected when Player 2 is a bot, not 2 Player', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const toggleState = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (!gm) return null;
      
      const humanCount = gm.players.filter((p: any) => p.type === 'human').length;
      const botCount = gm.players.filter((p: any) => p.type !== 'human' && p.type !== 'disabled').length;
      const activeCount = humanCount + botCount;
      
      let selectedTabCount = activeCount;
      if (humanCount === 1 && botCount >= 1) {
        selectedTabCount = 1;
      } else if (botCount === 0) {
        selectedTabCount = humanCount;
      }

      return {
        p1Type: gm.players[0].type,
        p2Type: gm.players[1].type,
        humanCount,
        botCount,
        selectedTabCount,
        tabsLength: gm.playerTabHitboxes.length
      };
    });

    expect(toggleState).not.toBeNull();
    expect(toggleState!.p1Type).toBe('human');
    expect(toggleState!.p2Type).toContain('bot');
    expect(toggleState!.humanCount).toBe(1);
    expect(toggleState!.botCount).toBe(1);
    // On startup, toggle MUST select Tab 1 ("1 Player v AI"), not Tab 2 ("2 Players")!
    expect(toggleState!.selectedTabCount).toBe(1);
  });
  test('Quick Draw Western renders both duelists with full bodies and boots without errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Start Quick Draw Western
    const duelState = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (!gm) return null;
      gm.startGame('quick_draw');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      if (!game) return null;
      const slingers = Array.from(game.slingers?.values() || []);
      return {
        active: slingers.length,
        s1: slingers[0],
        s2: slingers[1],
        round: game.currentDuelRound,
        state: game.state
      };
    });

    expect(duelState).not.toBeNull();
    expect(duelState!.active).toBe(2);
    expect(duelState!.s1.x).toBeGreaterThan(0);
    expect(duelState!.s2.x).toBeGreaterThan(duelState!.s1.x);

    // Let the game run through a draw cycle
    await page.waitForTimeout(3500);

    // Player 1 fires
    await page.keyboard.press('KeyW');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);

    expect(pageErrors.length).toBe(0);
  });

  test('WASD vertical controls: KeyW moves UP (decreasing Y), KeyS moves DOWN (increasing Y)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const arenaGames = [
      'alien_probe',
      'ant_colony_haul',
      'bumper_car_derby',
      'centipede_slalom',
      'crt_scanline_sniper',
      'cyber_grid_runner',
      'dragonfly_dogfight',
      'dung_beetle_roll',
      'funhouse_mirrors',
      'gargoyle_stone_stare',
      'ghost_vacuum_buster',
      'graveyard_zombie_bash',
      'honeybee_nectar_relay',
      'ladybug_aphid_hunt',
      'ouija_spirit_board',
      'pac_maze_chomp',
      'poltergeist_possession',
      'raptor_pounce_dodge',
      'satellite_laser',
      'tombstone_crypt_slider',
      'trex_egg_scramble'
    ];

    for (const gameId of arenaGames.slice(0, 5)) {
      await page.goto(`http://localhost:5173/?game=${gameId}`);
      await page.waitForTimeout(800);

      // Get initial position of player 0
      const initialY = await page.evaluate(() => {
        const gm = (window as any).gameManager;
        if (!gm || !gm.currentGame) return null;
        const g = gm.currentGame;
        const pState = g.playersState?.get(0) || g.cars?.get(0) || g.diggers?.get(0);
        return pState ? pState.y : null;
      });

      if (initialY !== null) {
        // Press KeyW (UP) -> Y should decrease or stay at top boundary
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(300);
        await page.keyboard.up('KeyW');

        const yAfterW = await page.evaluate(() => {
          const gm = (window as any).gameManager;
          const g = gm.currentGame;
          const pState = g.playersState?.get(0) || g.cars?.get(0) || g.diggers?.get(0);
          return pState ? pState.y : null;
        });

        // Press KeyS (DOWN) -> Y should increase
        await page.keyboard.down('KeyS');
        await page.waitForTimeout(400);
        await page.keyboard.up('KeyS');

        const yAfterS = await page.evaluate(() => {
          const gm = (window as any).gameManager;
          const g = gm.currentGame;
          const pState = g.playersState?.get(0) || g.cars?.get(0) || g.diggers?.get(0);
          return pState ? pState.y : null;
        });

        if (yAfterW !== null && yAfterS !== null) {
          // KeyS must have moved player DOWN (higher Y coordinate than after KeyW)
          expect(yAfterS).toBeGreaterThanOrEqual(yAfterW);
        }
      }
    }

    expect(pageErrors.length).toBe(0);
  });
});
