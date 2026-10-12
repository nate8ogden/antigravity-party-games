import { test, expect } from '@playwright/test';

test.describe('Universal Anti-Loop Framework & Game Loop Breakouts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
  });

  test('BaseGame Universal Anti-Loop: detects continuous spin loops and triggers breakout impulse', async ({ page }) => {
    const result = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('tanks');
      const game = gm.activeGame;

      let breakoutFired = false;
      let rescueAngleReceived = 0;

      // Simulate an entity continuously rotating at fixed (x, y)
      let angle = 0;
      for (let frame = 0; frame < 120; frame++) {
        angle += 0.15; // Spinning in circles
        game.trackAntiLoop('test_entity', 200, 200, angle, 0.016, 40, (rescueAngle: number) => {
          breakoutFired = true;
          rescueAngleReceived = rescueAngle;
        });
      }

      return {
        breakoutFired,
        rescueAngleReceived
      };
    });

    expect(result.breakoutFired).toBe(true);
  });

  test('Orbital Slingshot: Auto Gravity Slingshot Breakout after orbiting tethered planet > 2.8 times', async ({ page }) => {
    const result = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('orbital');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const ship = game.ships.get(0);
      const planet = game.planets[0];

      // Attach ship to planet tether
      ship.tetheredPlanet = planet;
      ship.tetherRadius = 60;
      ship.tetherAngle = 0;
      ship.tetherRotations = 0;
      ship.tetherDuration = 0;

      // Simulate holding input for 180 frames (~3 seconds)
      gm.input.press(0);
      let wasTetheredInitially = !!ship.tetheredPlanet;

      let maxSpeedObserved = 0;
      let breakoutSnapped = false;
      for (let i = 0; i < 360; i++) {
        game.update(0.016, 960, 600);
        const speed = Math.hypot(ship.vx, ship.vy);
        if (speed > maxSpeedObserved) maxSpeedObserved = speed;
        if (!ship.tetheredPlanet) breakoutSnapped = true;
      }

      return {
        wasTetheredInitially,
        breakoutSnapped,
        maxSpeedObserved,
        empCooldown: ship.empCooldown
      };
    });

    expect(result.wasTetheredInitially).toBe(true);
    // Tether MUST have automatically snapped into a slingshot breakout
    expect(result.breakoutSnapped).toBe(true);
    expect(result.maxSpeedObserved).toBeGreaterThanOrEqual(300); // Launched at high breakout velocity (380)
  });

  test('Cyber Tanks: Traction Breakout when spinning in place & Sudden Death crate collapse', async ({ page }) => {
    const result = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('tanks');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const tank = game.tanks.get(0);

      // Spin in place continuously
      for (let i = 0; i < 150; i++) {
        tank.angle += 0.12;
        game.update(0.016, 960, 600);
      }

      const speedAfterSpin = tank.speed;

      // Test sudden death crate demolition
      const initialCrates = game.obstacles.filter((o: any) => o.destructible).length;
      game.roundTimer = 14; // trigger sudden death threshold
      game.update(0.016, 960, 600);
      const remainingCrates = game.obstacles.filter((o: any) => o.destructible).length;

      return {
        speedAfterSpin,
        initialCrates,
        remainingCrates,
        suddenDeathActive: game.suddenDeathActive
      };
    });

    // Traction Breakout should have pushed speed forward (> 50)
    expect(result.speedAfterSpin).toBeGreaterThan(50);
    expect(result.suddenDeathActive).toBe(true);
    // Destructible crates are cleared in sudden death
    expect(result.remainingCrates).toBe(0);
  });

  test('Neon Lightcycles: Progressive Speed Ramp and Turbo Breakout on box loops', async ({ page }) => {
    const result = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('neon_lightcycles');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const cycle = game.cycles.get(0);

      const baseSpeed = cycle.speed;

      // Simulate time passing: roundTimer down to 10
      game.roundTimer = 10;
      game.update(0.016, 960, 600);

      // Fast turns in place to simulate box looping
      for (let i = 0; i < 120; i++) {
        cycle.x = 200;
        cycle.y = 200;
        cycle.dirIndex = (cycle.dirIndex + 1) % 4;
        game.trackAntiLoop(cycle.id, cycle.x, cycle.y, cycle.dirIndex * (Math.PI / 2), 0.016, 80, () => {
          cycle.boostTimer = 2.0;
        });
      }

      return {
        baseSpeed,
        boostActive: cycle.boostTimer > 0,
        suddenDeathActive: game.suddenDeathActive
      };
    });

    expect(result.boostActive).toBe(true);
  });

  test('Zero-G Tether: Auto-slingshot launch when tethered to anchor node > 3.0s', async ({ page }) => {
    const result = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('zero_g_tether');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const astro = game.astronauts.get(0);
      astro.tetherNodeId = 0;
      astro.tetherHoldTime = 0;

      // Run 220 frames (~3.5 seconds)
      for (let i = 0; i < 220; i++) {
        game.update(0.016, 960, 600);
      }

      return {
        isTethered: astro.tetherNodeId !== null,
        speed: Math.hypot(astro.vx, astro.vy),
        boostCooldown: astro.boostCooldown
      };
    });

    // Astronaut should have auto-slingshotted off the tether
    expect(result.isTethered).toBe(false);
    expect(result.speed).toBeGreaterThan(200);
    expect(result.boostCooldown).toBeGreaterThan(0);
  });

  test('Micro Turbo GP: Auto-Rescue Breakout Boost when spinning in circles for > 1.5s', async ({ page }) => {
    const result = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('micro_gp');
      gm.state = 'PLAYING';
      const game = gm.activeGame;
      const racer = game.racers.get(0);

      // Spin racer in circles
      for (let i = 0; i < 110; i++) {
        racer.angle += 0.12;
        game.update(0.016, 960, 600);
      }

      return {
        spinTimer: racer.spinTimer,
        turboActive: racer.turboTimer > 0,
        racerSpeed: racer.speed
      };
    });

    // Auto-rescue should have kicked in with turbo boost and reset spin timer
    expect(result.turboActive).toBe(true);
    expect(result.racerSpeed).toBeGreaterThan(250);
  });

  test('Universal Match Watchdog: GameManager terminates stalled matches past 65s', async ({ page }) => {
    const result = await page.evaluate(() => {
      const gm = (window as unknown as { __GAME_MANAGER__: any }).__GAME_MANAGER__;
      gm.startGame('tanks');
      gm.state = 'PLAYING';

      // Simulate match running for 66 seconds
      for (let i = 0; i < 70; i++) {
        gm.update(1.0);
      }

      return {
        isFinished: gm.activeGame.isFinished,
        state: gm.state,
        matchElapsedSeconds: gm.matchElapsedSeconds
      };
    });

    expect(result.isFinished).toBe(true);
    expect(result.matchElapsedSeconds).toBeGreaterThanOrEqual(58);
  });
});
