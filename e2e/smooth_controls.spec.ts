import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:5173/';

test.describe('Smooth Controls & Input Architecture Suite', () => {

  test('Keyboard steering exhibits exponential smoothing and raw discrete access', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    const result = await page.evaluate(async () => {
      const gm = (window as any).__GAME_MANAGER__;
      const input = gm.input;
      input.resetAll();
      input.setControlMode('directional');

      // Dispatch KeyD down for Player 1 (Red)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));

      const rawImmediate = input.getRawSteer(0);
      const steerBeforeUpdate = input.getSteer(0);

      // Advance one tick of 16ms (dt = 0.016)
      input.update(0.016);
      const steerTick1 = input.getSteer(0);

      // Advance second tick of 16ms
      input.update(0.016);
      const steerTick2 = input.getSteer(0);

      // Advance third tick of 16ms
      input.update(0.016);
      const steerTick3 = input.getSteer(0);

      // Release key
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
      const rawAfterRelease = input.getRawSteer(0);

      // Advance 1 tick during decay
      input.update(0.016);
      const steerDecay1 = input.getSteer(0);

      // Advance many ticks to settle
      for (let i = 0; i < 20; i++) input.update(0.016);
      const steerSettled = input.getSteer(0);

      return {
        rawImmediate,
        steerBeforeUpdate,
        steerTick1,
        steerTick2,
        steerTick3,
        rawAfterRelease,
        steerDecay1,
        steerSettled
      };
    });

    expect(result.rawImmediate).toBe(1);
    expect(result.steerBeforeUpdate).toBe(0);
    // Smooth ramp: tick1 < tick2 < tick3 <= 1
    expect(result.steerTick1).toBeGreaterThan(0.2);
    expect(result.steerTick1).toBeLessThan(result.steerTick2);
    expect(result.steerTick2).toBeLessThan(result.steerTick3);
    expect(result.steerTick3).toBeGreaterThan(0.6);

    // Decay
    expect(result.rawAfterRelease).toBe(0);
    expect(result.steerDecay1).toBeLessThan(result.steerTick3);
    expect(result.steerSettled).toBe(0);
  });

  test('Floating virtual thumbstick anchors dynamically and generates 360-degree analog vectors', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    const result = await page.evaluate(async () => {
      const gm = (window as any).__GAME_MANAGER__;
      const input = gm.input;
      const canvas = gm.canvas;
      input.resetAll();
      input.setControlMode('directional');

      // P1 top-left quadrant: anchor at (120, 120)
      const touchStart = new Touch({
        identifier: 1,
        target: canvas,
        clientX: 120,
        clientY: 120
      });
      canvas.dispatchEvent(new TouchEvent('touchstart', {
        changedTouches: [touchStart],
        touches: [touchStart]
      }));

      // Initially no movement
      input.update(0.016);
      const initialSteer = input.getSteer(0);
      const initialThrottle = input.getThrottle(0);

      // Move 30px right and 30px up (forward): clientX = 150, clientY = 90
      const touchMove = new Touch({
        identifier: 1,
        target: canvas,
        clientX: 150,
        clientY: 90
      });
      canvas.dispatchEvent(new TouchEvent('touchmove', {
        changedTouches: [touchMove],
        touches: [touchMove]
      }));

      // Let it smooth for 3 frames
      for (let i = 0; i < 5; i++) input.update(0.016);

      const dragSteer = input.getSteer(0);
      const dragThrottle = input.getThrottle(0);

      // Release touch
      const touchEnd = new Touch({
        identifier: 1,
        target: canvas,
        clientX: 150,
        clientY: 90
      });
      canvas.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [touchEnd],
        touches: []
      }));

      for (let i = 0; i < 15; i++) input.update(0.016);

      const releasedSteer = input.getSteer(0);
      const releasedThrottle = input.getThrottle(0);

      return {
        initialSteer,
        initialThrottle,
        dragSteer,
        dragThrottle,
        releasedSteer,
        releasedThrottle
      };
    });

    expect(result.initialSteer).toBe(0);
    expect(result.initialThrottle).toBe(0);
    // Drag right should produce positive steer
    expect(result.dragSteer).toBeGreaterThan(0.4);
    // Drag upward should produce positive throttle
    expect(result.dragThrottle).toBeGreaterThan(0.4);
    // Released should settle to 0
    expect(result.releasedSteer).toBe(0);
    expect(result.releasedThrottle).toBe(0);
  });

  test('Single-button mode converts any touch in quadrant to instantaneous action press', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    const result = await page.evaluate(async () => {
      const gm = (window as any).__GAME_MANAGER__;
      const input = gm.input;
      const canvas = gm.canvas;
      input.resetAll();
      input.setControlMode('single_button');

      // Tap in P2 quadrant (top-right, e.g. clientX: 700, clientY: 100 on 800x600)
      const touch = new Touch({
        identifier: 42,
        target: canvas,
        clientX: 700,
        clientY: 100
      });
      canvas.dispatchEvent(new TouchEvent('touchstart', {
        changedTouches: [touch],
        touches: [touch]
      }));

      const isPressedP2 = input.isPressed(1);
      const justActionP2 = input.justAction(1);
      const isPressedP1 = input.isPressed(0);

      // Release touch
      canvas.dispatchEvent(new TouchEvent('touchend', {
        changedTouches: [touch],
        touches: []
      }));

      const releasedPressedP2 = input.isPressed(1);

      return {
        isPressedP2,
        justActionP2,
        isPressedP1,
        releasedPressedP2
      };
    });

    expect(result.isPressedP2).toBe(true);
    expect(result.justActionP2).toBe(true);
    expect(result.isPressedP1).toBe(false);
    expect(result.releasedPressedP2).toBe(false);
  });

  test('Input buffering / coyote window prevents dropped frame inputs', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    const result = await page.evaluate(async () => {
      const gm = (window as any).__GAME_MANAGER__;
      const input = gm.input;
      input.resetAll();

      // Trigger action for Player 1
      input.triggerAction(0);

      const immediateJustAction = input.justAction(0);

      // Simulate frame end where instantaneous flags are cleared
      input.endFrame();

      // In the next frame, 16ms later:
      input.update(0.016);
      // Thanks to the 120ms coyote buffer, a delayed query still catches the action!
      const bufferedJustAction = input.justAction(0);

      // Second query immediately after should be consumed
      const consumedJustAction = input.justAction(0);

      return {
        immediateJustAction,
        bufferedJustAction,
        consumedJustAction
      };
    });

    expect(result.immediateJustAction).toBe(true);
    expect(result.bufferedJustAction).toBe(true);
    expect(result.consumedJustAction).toBe(false);
  });

  test('Virtual joystick rendering and ripple canvas draws execute cleanly', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    const noThrow = await page.evaluate(async () => {
      const gm = (window as any).__GAME_MANAGER__;
      const input = gm.input;
      const canvas = gm.canvas;
      const ctx = canvas.getContext('2d');

      input.resetAll();
      input.setControlMode('directional');

      // Add test ripples and simulate touch thumbstick
      input.addRipple(200, 200, '#EF4444');
      input.addRipple(300, 300, '#3B82F6');

      const touch = new Touch({
        identifier: 77,
        target: canvas,
        clientX: 150,
        clientY: 150
      });
      canvas.dispatchEvent(new TouchEvent('touchstart', {
        changedTouches: [touch],
        touches: [touch]
      }));

      // Render
      input.render(ctx);
      input.renderRipples(ctx);
      input.renderJoysticks(ctx);

      return true;
    });

    expect(noThrow).toBe(true);
  });

  test('HTML5 Gamepad API polling maps sticks and buttons to player steering and action', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await expect(page.locator('canvas')).toBeVisible();

    const result = await page.evaluate(async () => {
      const gm = (window as any).__GAME_MANAGER__;
      const input = gm.input;
      input.resetAll();
      input.setControlMode('directional');

      // Mock navigator.getGamepads returning a connected gamepad for Player 1 (Red)
      const mockGamepad = {
        connected: true,
        axes: [0.85, -0.75, 0, 0], // stick X = 0.85 (right), stick Y = -0.75 (up)
        buttons: [
          { pressed: true, value: 1.0 }, // Button 0 (A button): pressed
          { pressed: false, value: 0 },
          { pressed: false, value: 0 },
          { pressed: false, value: 0 },
          { pressed: false, value: 0 },
          { pressed: false, value: 0 },
          { pressed: false, value: 0 },
          { pressed: false, value: 0 },
          { pressed: false, value: 0 },
          { pressed: false, value: 0 },
          { pressed: false, value: 0 },
          { pressed: false, value: 0 },
          { pressed: false, value: 0 }, // dpad up
          { pressed: false, value: 0 }, // dpad down
          { pressed: false, value: 0 }, // dpad left
          { pressed: false, value: 0 }  // dpad right
        ]
      };

      navigator.getGamepads = () => [mockGamepad as any, null, null, null];

      // Update input engine with simulated gamepad active
      input.update(0.016);
      const isAction = input.isActionPressed(0);
      const isPressed = input.isPressed(0);
      const justAction = input.justAction(0);

      // Advance several ticks to smooth stick inputs
      for (let i = 0; i < 5; i++) input.update(0.016);

      const steer = input.getSteer(0);
      const throttle = input.getThrottle(0);

      return {
        isAction,
        isPressed,
        justAction,
        steer,
        throttle
      };
    });

    expect(result.isAction).toBe(true);
    expect(result.isPressed).toBe(true);
    expect(result.justAction).toBe(true);
    // Gamepad stick X is 0.85, so steer should smoothly rise towards ~0.85
    expect(result.steer).toBeGreaterThan(0.6);
    // Gamepad stick Y is -0.75 (upwards), so throttle should smoothly rise towards ~0.75
    expect(result.throttle).toBeGreaterThan(0.5);
  });

});
