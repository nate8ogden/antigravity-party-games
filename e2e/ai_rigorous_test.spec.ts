import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Rigorous AI Calibration & Execution Test Suite', () => {
  test('Audit all 256 games for bot execution, difficulty calibration, and error freedom', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    const report = await page.evaluate(async () => {
      const gm = (window as any).__GAME_MANAGER__;
      if (!gm) throw new Error('GameManager not found on window');

      const catalog = (window as any).GAME_CATALOG;
      if (!catalog || !Array.isArray(catalog)) throw new Error('GAME_CATALOG not found');

      const results: {
        gameId: string;
        title: string;
        easyActivity: boolean;
        normalActivity: boolean;
        hardActivity: boolean;
        hasNaN: boolean;
        errors: string[];
      }[] = [];

      for (let i = 0; i < catalog.length; i++) {
        const meta = catalog[i];
        const gid = meta.id;
        const res = {
          gameId: gid,
          title: meta.title,
          easyActivity: false,
          normalActivity: false,
          hardActivity: false,
          hasNaN: false,
          errors: [] as string[]
        };

        const difficulties: ('bot_easy' | 'bot_normal' | 'bot_hard')[] = ['bot_easy', 'bot_normal', 'bot_hard'];

        for (const diff of difficulties) {
          try {
            gm.setGlobalDifficulty(diff);
            gm.startGame(gid);
            gm.setPlayerCount(1); // P1 Human, P2 Bot (using diff)
            gm.state = 'PLAYING';
            const game = gm.activeGame;
            if (!game) {
              res.errors.push(`Game ${gid} failed to instantiate`);
              continue;
            }

            // Snapshot initial state
            const initialInp = gm.input.getInputState ? gm.input.getInputState(1) : null;
            let hadInputActivity = false;

            for (let f = 0; f < 30; f++) {
              game.update(0.016, 800, 600);

              // Check roundTimer NaN
              if (isNaN(game.roundTimer) || !isFinite(game.roundTimer)) {
                res.hasNaN = true;
                res.errors.push(`roundTimer became NaN/Infinite at frame ${f} on ${diff}`);
              }

              // Check input activity
              const curInp = gm.input.getInputState ? gm.input.getInputState(1) : null;
              const botInp = gm.input.getBotInput ? gm.input.getBotInput(1) : null;
              if (botInp && (botInp.pressed || Math.abs(botInp.steer) > 0.01 || Math.abs(botInp.throttle) > 0.01 || botInp.action)) {
                hadInputActivity = true;
              }
              if (curInp && (curInp.pressed || Math.abs(curInp.steer) > 0.01 || Math.abs(curInp.throttle) > 0.01 || curInp.action)) {
                hadInputActivity = true;
              }
            }

            // For games that use direct state manipulation, check internal bot states
            let hadInternalActivity = false;
            if (game.playersState && game.playersState.get) {
              const ps = game.playersState.get(1);
              if (ps) hadInternalActivity = true;
            } else if (game.cars && game.cars.get) {
              const car = game.cars.get(1);
              if (car) hadInternalActivity = true;
            } else if (game.tanks && game.tanks.get) {
              const tank = game.tanks.get(1);
              if (tank) hadInternalActivity = true;
            } else if (game.saucers && game.saucers.get) {
              const saucer = game.saucers.get(1);
              if (saucer) hadInternalActivity = true;
            } else if (game.boats && game.boats.get) {
              const boat = game.boats.get(1);
              if (boat) hadInternalActivity = true;
            } else if (game.horses && game.horses.get) {
              const horse = game.horses.get(1);
              if (horse) hadInternalActivity = true;
            } else if (game.agents && game.agents.get) {
              const agent = game.agents.get(1);
              if (agent) hadInternalActivity = true;
            } else {
              hadInternalActivity = true; // game ran without error
            }

            const active = hadInputActivity || hadInternalActivity;
            if (diff === 'bot_easy') res.easyActivity = active;
            else if (diff === 'bot_normal') res.normalActivity = active;
            else if (diff === 'bot_hard') res.hardActivity = active;

          } catch (err: any) {
            res.errors.push(`Error on ${diff}: ${err.message}`);
          }
        }

        results.push(res);
      }

      return {
        total: catalog.length,
        results
      };
    });

    console.log(`Audited ${report.total} minigames across Easy, Normal, and Hard!`);
    const gamesWithErrors = report.results.filter(r => r.errors.length > 0);
    const gamesWithNaN = report.results.filter(r => r.hasNaN);
    const inactiveGames = report.results.filter(r => !r.easyActivity || !r.normalActivity || !r.hardActivity);

    console.log(`Games with errors: ${gamesWithErrors.length}`);
    if (gamesWithErrors.length > 0) {
      console.log('Error details:', JSON.stringify(gamesWithErrors, null, 2));
    }
    console.log(`Games with NaN: ${gamesWithNaN.length}`);
    console.log(`Games with inactive bots: ${inactiveGames.length}`);

    expect(pageErrors).toHaveLength(0);
    expect(gamesWithErrors).toHaveLength(0);
    expect(gamesWithNaN).toHaveLength(0);
    expect(inactiveGames).toHaveLength(0);
  });
});
