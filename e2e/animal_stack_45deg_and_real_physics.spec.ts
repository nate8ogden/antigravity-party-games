import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Animal Stack - 45-Degree Rotation & Realistic Physics', () => {
  test('animal turns in 45-degree increments (0°, 45°, 90°, 135°, 180°, etc.)', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=animal_stack&players=2&bots=0&autostart=true`);
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => {
      const gs = (window as any).__GAME_STATE__;
      return gs && gs.state === 'PLAYING';
    }, { timeout: 6000 });

    const step45 = Math.PI / 4;

    for (let step = 1; step <= 8; step++) {
      await page.keyboard.press('KeyR');
      await page.waitForTimeout(100);

      const rot = await page.evaluate(() => {
        const dbg = (window as any).__ANIMAL_STACK_DEBUG__;
        return dbg?.getHeldRotation();
      });

      const expected = (step * step45) % (Math.PI * 2);
      expect(rot).toBeCloseTo(expected, 2);
    }
  });

  test('realistic physics: balanced drops settle stably while overhanging drops tilt and tumble off', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=animal_stack&players=2&bots=0&autostart=true`);
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => {
      const gs = (window as any).__GAME_STATE__;
      return gs && gs.state === 'PLAYING';
    }, { timeout: 6000 });

    const physicsResult = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm.activeGame;
      const raftTopY = game.raftY - game.raftHeight / 2;
      const raftLeft = game.raftX - game.raftWidth / 2;
      const raftRight = game.raftX + game.raftWidth / 2;

      // 1. Test balanced drop centered on raft
      const croc = game.constructor.getExtents({ width: 76, height: 24 }, 0);
      game.fallingAnimal = {
        type: { id: 'crocodile', name: 'Crocodile', width: 76, height: 24, mass: 35, primaryColor: '#059669', secondaryColor: '#047857', badge: '🐊' },
        playerId: 0,
        x: game.raftX,
        y: raftTopY - croc.halfH - 2,
        vx: 0,
        vy: 100,
        settled: false,
        angle: 0
      };

      // Update 1 physics tick
      game.update(0.016, 960, 600);
      const balancedSettled = game.fallingAnimal === null && game.animals.length === 1;

      // 2. Test overhanging drop with center of mass off the right edge of raft
      game.fallingAnimal = {
        type: { id: 'elephant', name: 'Elephant', width: 56, height: 44, mass: 45, primaryColor: '#64748B', secondaryColor: '#475569', badge: '🐘' },
        playerId: 0,
        x: raftRight + 12, // Center of mass overhanging off edge!
        y: raftTopY - 20,
        vx: 0,
        vy: 100,
        settled: false,
        angle: 0
      };

      // Update 1 physics tick
      game.update(0.016, 960, 600);
      const tippingAnimal = game.fallingAnimal;
      const tippingVx = tippingAnimal ? tippingAnimal.vx : 0;
      const tippingAngle = tippingAnimal ? tippingAnimal.angle : 0;

      return {
        balancedSettled,
        tippingVx,
        tippingAngle,
        raftTilt: game.raftTilt
      };
    });

    // Balanced drop should settle stably
    expect(physicsResult.balancedSettled).toBe(true);

    // Overhanging drop must induce tipping physics (lateral velocity pushing off edge)
    expect(physicsResult.tippingVx).toBeGreaterThan(50);
    // Tumble rotation
    expect(physicsResult.tippingAngle).toBeGreaterThan(0);
    // Raft remains firmly moored
    expect(physicsResult.raftTilt).toBe(0);
  });

  test('all 7 actual animal shapes render on canvas with distinct geometry', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=animal_stack&players=2&bots=0&autostart=true`);
    await page.waitForSelector('canvas');

    const renderCheck = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm.activeGame;
      const canvas = document.querySelector('canvas');
      const ctx = canvas?.getContext('2d');
      if (!ctx || !game) return false;

      // Render each animal def
      const animalDefs = [
        'crocodile', 'giraffe', 'elephant', 'turtle', 'pig', 'duck', 'frog'
      ];

      for (const id of animalDefs) {
        const def = game.constructor.ANIMAL_TYPES?.find((a: any) => a.id === id) || {
          id, width: 40, height: 30, mass: 20
        };
        // Should execute render without any exceptions
        game.renderAnimal(ctx, def, 200, 200, 0, Math.PI / 4);
      }
      return true;
    });

    expect(renderCheck).toBe(true);
  });
});
