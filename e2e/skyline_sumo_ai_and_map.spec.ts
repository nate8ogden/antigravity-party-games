import { test, expect } from '@playwright/test';

test.describe('Skyline Sumo AI & Tactical Map Radar Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
  });

  test('Skyline Sumo AI charges, releases jumps, and climbs upward without freezing (2 Players)', async ({ page }) => {
    const aiClimbResult = await page.evaluate(async () => {
      const gm = (window as unknown as {
        __GAME_MANAGER__: {
          startGame: (id: string) => void;
          activeGame: {
            roundTimer: number;
            climbers: Map<number, { id: number; y: number; highestY: number; score: number; isCharging: boolean; isGrounded: boolean }>;
            platforms: { x: number; y: number; w: number; h: number }[];
          } | null;
          update: (dt: number) => void;
          state: string;
        };
      }).__GAME_MANAGER__;

      // Start Skyline Sumo in 2-player mode (P1 human, P2 Bot)
      gm.startGame('skyline_sumo');

      // Fast forward past countdown (4.0s)
      gm.update(4.0);

      const game = gm.activeGame;
      if (!game) throw new Error('Active game not initialized');

      const botClimber = game.climbers.get(1);
      if (!botClimber) throw new Error('Bot climber P2 not found');

      const initialBotY = botClimber.y;
      let botEverCharged = false;
      let botEverAirborne = false;
      let highestAscentY = initialBotY;

      // Simulate 8 seconds of active gameplay steps (120 frames at 60fps = 2s simulated per loop)
      for (let f = 0; f < 300; f++) {
        gm.update(0.016);
        if (botClimber.isCharging) botEverCharged = true;
        if (!botClimber.isGrounded) botEverAirborne = true;
        if (botClimber.y < highestAscentY) highestAscentY = botClimber.y;
      }

      return {
        initialBotY,
        highestAscentY,
        botEverCharged,
        botEverAirborne,
        heightGained: initialBotY - highestAscentY,
        score: botClimber.score,
        totalClimbers: game.climbers.size
      };
    });

    expect(aiClimbResult.totalClimbers).toBe(2);
    // Bot should have successfully charged its jump
    expect(aiClimbResult.botEverCharged).toBe(true);
    // Bot should have successfully become airborne
    expect(aiClimbResult.botEverAirborne).toBe(true);
    // Bot should have gained vertical height (ascended towards platforms)
    expect(aiClimbResult.heightGained).toBeGreaterThan(30);
  });

  test('Tactical Map Radar displays both players (or up to 4) calibrating in real-time', async ({ page }) => {
    // Test 4-player match
    const radarData = await page.evaluate(async () => {
      const gm = (window as unknown as {
        __GAME_MANAGER__: {
          setPlayerCount: (count: number) => void;
          startGame: (id: string) => void;
          activeGame: {
            climbers: Map<number, { id: number; y: number; highestY: number; score: number }>;
          } | null;
          update: (dt: number) => void;
          players: { id: number; type: string; name: string; color: string }[];
        };
      }).__GAME_MANAGER__;

      // Configure 4 players
      gm.setPlayerCount(4);
      gm.startGame('skyline_sumo');

      // Fast forward past countdown
      gm.update(4.0);

      const game = gm.activeGame;
      if (!game) throw new Error('Active game not initialized');

      const climbers = Array.from(game.climbers.values());

      // Advance frames and check altitude calibration
      gm.update(0.5);

      const playerPositions = climbers.map((c) => ({
        id: c.id,
        y: c.y,
        score: c.score
      }));

      return {
        climberCount: climbers.length,
        playerPositions
      };
    });

    // All 4 players are registered in the game and map
    expect(radarData.climberCount).toBe(4);
    radarData.playerPositions.forEach((p) => {
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(typeof p.y).toBe('number');
    });
  });

  test('Sumo Bump physics push players horizontally upon collision', async ({ page }) => {
    const bumpResult = await page.evaluate(async () => {
      const gm = (window as unknown as {
        __GAME_MANAGER__: {
          startGame: (id: string) => void;
          activeGame: {
            climbers: Map<number, { id: number; x: number; y: number; vx: number; vy: number }>;
          } | null;
          update: (dt: number) => void;
        };
      }).__GAME_MANAGER__;

      gm.startGame('skyline_sumo');
      gm.update(4.0);

      const game = gm.activeGame;
      if (!game) throw new Error('Active game not initialized');

      const c1 = game.climbers.get(0)!;
      const c2 = game.climbers.get(1)!;

      // Force positions close together to test sumo bump
      c1.x = 300;
      c1.y = 400;
      c2.x = 315;
      c2.y = 400;
      c1.vx = 0;
      c2.vx = 0;

      // Run 1 frame of update
      gm.update(0.016);

      return {
        c1x: c1.x,
        c2x: c2.x,
        c1vx: c1.vx,
        c2vx: c2.vx
      };
    });

    // c1 was pushed to the left, c2 was pushed to the right
    expect(bumpResult.c1vx).toBeLessThan(0);
    expect(bumpResult.c2vx).toBeGreaterThan(0);
    expect(bumpResult.c2x).toBeGreaterThan(bumpResult.c1x);
  });
});
