import { test, expect } from '@playwright/test';

test.describe('Cannon Barrage - Multiple Towers, Shielded Main Fortress, & Exclusive Firing', () => {
  test('Each player has 2 outer guard towers flanking the main fortress tower', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const fortressData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('cannon_barrage');
      gm.state = 'PLAYING';
      const game = gm.activeGame as any;

      const p1Fortress = game.fortresses.get(0);
      const p2Fortress = game.fortresses.get(1);

      return {
        p1SubTowersCount: p1Fortress.subTowers.length,
        p1SubTowersAlive: p1Fortress.subTowers.filter((st: any) => st.alive).length,
        p2SubTowersCount: p2Fortress.subTowers.length,
        p2SubTowersAlive: p2Fortress.subTowers.filter((st: any) => st.alive).length,
        p1MainHp: p1Fortress.hp,
        p2MainHp: p2Fortress.hp,
        p1Shielded: !game.areSubTowersDown(p1Fortress),
        p2Shielded: !game.areSubTowersDown(p2Fortress)
      };
    });

    expect(pageErrors).toEqual([]);
    expect(fortressData.p1SubTowersCount).toBe(2);
    expect(fortressData.p1SubTowersAlive).toBe(2);
    expect(fortressData.p2SubTowersCount).toBe(2);
    expect(fortressData.p2SubTowersAlive).toBe(2);
    expect(fortressData.p1Shielded).toBe(true);
    expect(fortressData.p2Shielded).toBe(true);
  });

  test('Main tower is shielded while 2 outer towers stand, and can ONLY be hit when both are down', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const shieldAndDamageData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('cannon_barrage');
      gm.state = 'PLAYING';
      const game = gm.activeGame as any;
      const w = gm.logicalWidth;
      const h = gm.logicalHeight;

      const p2Fortress = game.fortresses.get(1);
      const initialP2MainHp = p2Fortress.hp;

      // 1. Fire a cannonball directly at P2's main tower while outer towers are alive
      game.cannonballs.push({
        id: 9999,
        shooterId: 0,
        x: p2Fortress.x - 5,
        y: p2Fortress.y,
        vx: 300,
        vy: 0,
        radius: 6,
        life: 2.0
      });

      // Update to trigger collision check
      game.update(0.016, w, h);

      const p2MainHpAfterShieldHit = p2Fortress.hp;
      const isStillShielded = !game.areSubTowersDown(p2Fortress);

      // 2. Destroy only 1 outer tower (guard tower 0)
      const st0 = p2Fortress.subTowers[0];
      st0.hp = 0;
      st0.alive = false;

      // Try hitting main tower again with 1 tower still standing
      game.cannonballs.push({
        id: 10000,
        shooterId: 0,
        x: p2Fortress.x - 5,
        y: p2Fortress.y,
        vx: 300,
        vy: 0,
        radius: 6,
        life: 2.0
      });
      game.update(0.016, w, h);

      const p2MainHpAfter1TowerDown = p2Fortress.hp;
      const isShieldedWith1Down = !game.areSubTowersDown(p2Fortress);

      // 3. Destroy the second outer tower (guard tower 1)
      const st1 = p2Fortress.subTowers[1];
      st1.hp = 0;
      st1.alive = false;

      const areTowersDownNow = game.areSubTowersDown(p2Fortress);

      // 4. Now fire at main tower when both outer towers are down!
      game.cannonballs.push({
        id: 10001,
        shooterId: 0,
        x: p2Fortress.x - 5,
        y: p2Fortress.y,
        vx: 300,
        vy: 0,
        radius: 6,
        life: 2.0
      });
      game.update(0.016, w, h);

      const p2MainHpAfterBothTowersDown = p2Fortress.hp;

      return {
        initialP2MainHp,
        p2MainHpAfterShieldHit,
        isStillShielded,
        p2MainHpAfter1TowerDown,
        isShieldedWith1Down,
        areTowersDownNow,
        p2MainHpAfterBothTowersDown
      };
    });

    // Main tower must NOT take damage while outer towers are up
    expect(shieldAndDamageData.initialP2MainHp).toBe(4);
    expect(shieldAndDamageData.p2MainHpAfterShieldHit).toBe(4); // 0 damage!
    expect(shieldAndDamageData.isStillShielded).toBe(true);

    // Main tower must NOT take damage when only 1 tower is down
    expect(shieldAndDamageData.p2MainHpAfter1TowerDown).toBe(4); // 0 damage!
    expect(shieldAndDamageData.isShieldedWith1Down).toBe(true);

    // Main tower shield drops only when both are down, and now takes direct damage
    expect(shieldAndDamageData.areTowersDownNow).toBe(true);
    expect(shieldAndDamageData.p2MainHpAfterBothTowersDown).toBe(3); // 1 damage taken!
  });

  test('Outer guard towers take damage and can be destroyed by cannonballs', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const guardTowerHitData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('cannon_barrage');
      gm.state = 'PLAYING';
      const game = gm.activeGame as any;
      const w = gm.logicalWidth;
      const h = gm.logicalHeight;

      const p2Fortress = game.fortresses.get(1);
      const st0 = p2Fortress.subTowers[0];
      const initialSt0Hp = st0.hp;

      // Direct hit on guard tower 0
      game.cannonballs.push({
        id: 10002,
        shooterId: 0,
        x: st0.x - 5,
        y: st0.y,
        vx: 300,
        vy: 0,
        radius: 6,
        life: 2.0
      });
      game.update(0.016, w, h);

      const st0HpAfterHit1 = st0.hp;
      const st0AliveAfterHit1 = st0.alive;

      // Second hit destroys guard tower 0
      game.cannonballs.push({
        id: 10003,
        shooterId: 0,
        x: st0.x - 5,
        y: st0.y,
        vx: 300,
        vy: 0,
        radius: 6,
        life: 2.0
      });
      game.update(0.016, w, h);

      const st0HpAfterHit2 = st0.hp;
      const st0AliveAfterHit2 = st0.alive;

      return {
        initialSt0Hp,
        st0HpAfterHit1,
        st0AliveAfterHit1,
        st0HpAfterHit2,
        st0AliveAfterHit2
      };
    });

    expect(guardTowerHitData.initialSt0Hp).toBe(2);
    expect(guardTowerHitData.st0HpAfterHit1).toBe(1);
    expect(guardTowerHitData.st0AliveAfterHit1).toBe(true);
    expect(guardTowerHitData.st0HpAfterHit2).toBe(0);
    expect(guardTowerHitData.st0AliveAfterHit2).toBe(false);
  });
});
