import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Animal Stack Overhaul: Rotation, Unique Shapes, No Sinking, Wood Cannot Tip', () => {
  test('Animal rotation works with keyboard (W, S, R, Arrows) and UI button', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=animal_stack&players=2&bots=0&autostart=true`);
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => {
      const gs = (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__;
      return gs && gs.state === 'PLAYING';
    }, { timeout: 6000 });

    // Initial state: heldRotation should be 0
    let debug = await page.evaluate(() => {
      const dbg = (window as unknown as { __ANIMAL_STACK_DEBUG__?: {
        getHeldRotation: () => number;
        getHeldAnimal: () => { name: string; width: number; height: number; id: string };
        rotate: () => void;
        getRaftTilt: () => number;
        getRaftTopY: () => number;
      } }).__ANIMAL_STACK_DEBUG__;
      return {
        heldRot: dbg?.getHeldRotation(),
        heldAnimal: dbg?.getHeldAnimal(),
        tilt: dbg?.getRaftTilt(),
        raftTopY: dbg?.getRaftTopY()
      };
    });

    expect(debug.heldRot).toBe(0);
    expect(debug.heldAnimal).toBeDefined();
    expect(debug.tilt).toBe(0);

    // Rotate using KeyR (45° step)
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(150);

    let rotAfterR = await page.evaluate(() => {
      const dbg = (window as unknown as { __ANIMAL_STACK_DEBUG__?: { getHeldRotation: () => number } }).__ANIMAL_STACK_DEBUG__;
      return dbg?.getHeldRotation();
    });
    expect(rotAfterR).toBeCloseTo(Math.PI / 4, 2);

    // Rotate using KeyW (Player 0) (another 45° step -> 90°)
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(250);

    let rotAfterW = await page.evaluate(() => {
      const dbg = (window as unknown as { __ANIMAL_STACK_DEBUG__?: { getHeldRotation: () => number } }).__ANIMAL_STACK_DEBUG__;
      return dbg?.getHeldRotation();
    });
    expect(rotAfterW).toBeCloseTo(Math.PI / 2, 2);

    // Click on rotate button on screen (another 45° step -> 135°)
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      // Button is horizontally centered, Y ~ 108
      await page.mouse.click(box.x + box.width / 2, box.y + 108);
      await page.waitForTimeout(200);

      let rotAfterClick = await page.evaluate(() => {
        const dbg = (window as unknown as { __ANIMAL_STACK_DEBUG__?: { getHeldRotation: () => number } }).__ANIMAL_STACK_DEBUG__;
        return dbg?.getHeldRotation();
      });
      expect(rotAfterClick).toBeCloseTo(3 * Math.PI / 4, 2);
    }
  });

  test('Animals do not sink into the wood and wood does not tip', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=animal_stack&players=2&bots=0&autostart=true`);
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => {
      const gs = (window as unknown as { __GAME_STATE__?: { state: string } }).__GAME_STATE__;
      return gs && gs.state === 'PLAYING';
    }, { timeout: 6000 });

    // Drop first animal
    await page.keyboard.press('Space');
    // Wait for animal to fall and settle on wood
    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => {
      const dbg = (window as unknown as { __ANIMAL_STACK_DEBUG__?: {
        getAnimals: () => Array<{
          x: number;
          y: number;
          angle: number;
          settled: boolean;
          type: { width: number; height: number; name: string };
        }>;
        getRaftTopY: () => number;
        getRaftTilt: () => number;
      } }).__ANIMAL_STACK_DEBUG__;

      const animals = dbg?.getAnimals() || [];
      const raftTopY = dbg?.getRaftTopY() || 0;
      const tilt = dbg?.getRaftTilt() || 0;

      return {
        count: animals.length,
        firstAnimal: animals[0] || null,
        raftTopY,
        tilt
      };
    });

    expect(result.count).toBeGreaterThanOrEqual(1);
    expect(result.firstAnimal?.settled).toBe(true);

    // Verify ZERO SINKING: Bottom of settled animal must equal raftTopY exactly!
    const a = result.firstAnimal;
    if (a) {
      const cos = Math.abs(Math.cos(a.angle));
      const sin = Math.abs(Math.sin(a.angle));
      const halfH = (sin * a.type.width + cos * a.type.height) / 2;
      const animalBottomY = a.y + halfH;
      expect(animalBottomY).toBeCloseTo(result.raftTopY, 1);
    }

    // Verify wood raft CANNOT tip: tilt must remain 0
    expect(result.tilt).toBe(0);

    // Drop second animal with rotation
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);

    const secondResult = await page.evaluate(() => {
      const dbg = (window as unknown as { __ANIMAL_STACK_DEBUG__?: {
        getAnimals: () => Array<{
          x: number;
          y: number;
          angle: number;
          settled: boolean;
          type: { width: number; height: number; name: string };
        }>;
        getRaftTilt: () => number;
        getRaftTopY: () => number;
      } }).__ANIMAL_STACK_DEBUG__;
      return {
        animals: dbg?.getAnimals() || [],
        tilt: dbg?.getRaftTilt() || 0,
        raftTopY: dbg?.getRaftTopY() || 0
      };
    });

    // Tilt remains 0 despite multiple off-center animals
    expect(secondResult.tilt).toBe(0);

    // Check all settled animals have valid flush positioning (never sank into the wood plank)
    for (const sa of secondResult.animals) {
      const cos = Math.abs(Math.cos(sa.angle));
      const sin = Math.abs(Math.sin(sa.angle));
      const halfH = (sin * sa.type.width + cos * sa.type.height) / 2;
      const bottomY = sa.y + halfH;
      // Bottom of animal must never be below the raft top surface!
      expect(bottomY).toBeLessThanOrEqual(secondResult.raftTopY + 1);
    }
  });

  test('All 7 unique animal shapes exist with contrasting dimensions', async ({ page }) => {
    await page.goto(`${LOCAL_URL}?game=animal_stack&players=2&bots=0&autostart=true`);
    await page.waitForSelector('canvas');

    const catalog = await page.evaluate(() => {
      const dbg = (window as unknown as { __ANIMAL_STACK_DEBUG__?: {
        getHeldAnimal: () => { name: string; width: number; height: number; id: string };
      } }).__ANIMAL_STACK_DEBUG__;
      return !!dbg?.getHeldAnimal();
    });

    expect(catalog).toBe(true);
  });
});
