/**
 * Input.js
 * Unified Input Event Controller handling physical keyboard, mouse/pointer,
 * canvas swipe/tap gestures, W3C Gamepad API, Rapid-Fire Auto-Turbo latch,
 * Attract-Mode Demo AI inputs, and mobile touch overlay controls simultaneously.
 */
import { TouchControls } from '../ui/TouchControls.js';

export class InputManager {
  constructor(canvas = null) {
    this.canvas = canvas;
    this.logicalWidth = 960;
    this.logicalHeight = 540;

    this.virtualState = {
      up: false,
      down: false,
      left: false,
      right: false,
      actionA: false,
      actionB: false,
      pause: false,
      menu: false
    };

    this.keyState = {
      up: false,
      down: false,
      left: false,
      right: false,
      actionA: false,
      actionB: false,
      pause: false,
      menu: false
    };

    this.touchState = {
      up: false,
      down: false,
      left: false,
      right: false,
      actionA: false,
      actionB: false,
      axisX: 0,
      axisY: 0
    };

    this.gamepadState = {
      connected: false,
      count: 0,
      name: '',
      up: false,
      down: false,
      left: false,
      right: false,
      actionA: false,
      actionB: false,
      pause: false,
      menu: false,
      select: false,
      start: false,
      l1: false,
      r1: false,
      l2: false,
      r2: false,
      l3: false,
      r3: false,
      axisX: 0,
      axisY: 0,
      rightAxisX: 0,
      rightAxisY: 0,
      rewindHeld: false,
      saveState: false,
      loadState: false,
      fastForward: false,
      favorite: false,
      nextTab: false,
      prevTab: false
    };

    this._gamepadSaveLatched = false;
    this._gamepadLoadLatched = false;
    this._gamepadFastForwardLatched = false;
    this._gamepadFavoriteLatched = false;
    this._gamepadNextTabLatched = false;
    this._gamepadPrevTabLatched = false;
    this._gamepadSelectLatched = false;
    this._gamepadStartLatched = false;
    this.onGamepadConnected = null;
    this.onGamepadDisconnected = null;

    this.attractState = {
      active: false,
      up: false,
      down: false,
      left: false,
      right: false,
      actionA: false,
      actionB: false
    };

    this.rawKeysDown = new Set();
    this.rawKeysJustPressed = new Set();

    // Hardware Rapid-Fire Turbo Auto-Fire (15 Hz pulse when held)
    this.turboEnabled = false;
    this._turboTick = 0;

    this.prevState = { ...this.virtualState };
    // Edge-latched presses so rapid keydown+keyup between frames is never missed
    this.latchedPress = {
      up: false,
      down: false,
      left: false,
      right: false,
      actionA: false,
      actionB: false,
      pause: false,
      menu: false
    };

    this.pointer = {
      x: 480,
      y: 270,
      down: false,
      justPressed: false,
      justReleased: false,
      isTouch: false,
      get isDown() {
        return this.down;
      }
    };

    this.lastSwipe = null;
    this._swipeStart = null;
    this.onPauseCallback = null;
    this.onMenuCallback = null;
    this.onFirstInteraction = null;
    this.onUserActivity = null;
    this._interacted = false;

    this.mounted = false;
    this._boundListeners = [];
    this.logicalWidth = 960;
    this.logicalHeight = 540;

    this.initKeyboard();
    this.initGamepad();
    this.initTouchOverlay();
    if (this.canvas) {
      this.bindCanvasPointer(this.canvas);
    }
    this.mount();
  }

  get keysDown() {
    return this.rawKeysDown;
  }

  _addManagedListener(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler, options);
    this._boundListeners.push({ target, type, handler, options });
  }

  _notifyInteraction() {
    if (!this._interacted) {
      this._interacted = true;
      if (typeof this.onFirstInteraction === 'function') {
        this.onFirstInteraction();
      }
    }
    if (typeof this.onUserActivity === 'function') {
      this.onUserActivity();
    }
  }

  initKeyboard() {
    this._keyMap = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      KeyZ: 'actionA',
      Space: 'actionA',
      Enter: 'actionA',
      KeyJ: 'actionA',
      KeyX: 'actionB',
      ShiftLeft: 'actionB',
      ShiftRight: 'actionB',
      KeyK: 'actionB',
      KeyP: 'pause',
      Escape: 'pause',
      Backspace: 'menu'
    };

    this._onKeyDown = (e) => {
      // Ignore if typing in an input element
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      this._notifyInteraction();
      if (!this.rawKeysDown.has(e.code)) {
        this.rawKeysJustPressed.add(e.code);
      }
      this.rawKeysDown.add(e.code);

      const action = this._keyMap[e.code];
      if (action) {
        e.preventDefault();
        if (!this.keyState[action]) {
          this.latchedPress[action] = true;
          if (action === 'pause' && typeof this.onPauseCallback === 'function') {
            this.onPauseCallback();
          }
          if (action === 'menu' && typeof this.onMenuCallback === 'function') {
            this.onMenuCallback();
          }
        }
        this.keyState[action] = true;
        this.syncVirtualState();
      }
    };

    this._onKeyUp = (e) => {
      this.rawKeysDown.delete(e.code);
      const action = this._keyMap[e.code];
      if (action) {
        this.keyState[action] = false;
        this.syncVirtualState();
      }
    };

    this._onBlur = () => {
      this.resetState();
    };
  }

  initGamepad() {
    this._onGamepadConnected = (e) => {
      this._notifyInteraction();
      this.pollGamepads();
      if (typeof this.onGamepadConnected === 'function') {
        const pad = e.gamepad || (e.detail && e.detail.gamepad);
        this.onGamepadConnected(pad);
      }
    };

    this._onGamepadDisconnected = (e) => {
      this.pollGamepads();
      if (typeof this.onGamepadDisconnected === 'function') {
        const pad = e.gamepad || (e.detail && e.detail.gamepad);
        this.onGamepadDisconnected(pad);
      }
    };
  }

  initTouchOverlay() {
    if (typeof document !== 'undefined' && document.body) {
      this.touchControls = new TouchControls(this, document.body);
    }
  }

  bindCanvasPointer(canvas, logicalWidth = 960, logicalHeight = 540) {
    this.canvas = canvas;
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;

    const toLogicalCoords = (clientX, clientY) => {
      if (!this.canvas) return { x: 480, y: 270 };
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return { x: 480, y: 270 };
      const x = ((clientX - rect.left) / rect.width) * this.logicalWidth;
      const y = ((clientY - rect.top) / rect.height) * this.logicalHeight;
      return {
        x: Math.max(0, Math.min(this.logicalWidth, x)),
        y: Math.max(0, Math.min(this.logicalHeight, y))
      };
    };

    this._onCanvasMouseMove = (e) => {
      const pt = toLogicalCoords(e.clientX, e.clientY);
      this.pointer.x = pt.x;
      this.pointer.y = pt.y;
    };

    this._onCanvasMouseDown = (e) => {
      if (e.button !== 0) return;
      this._notifyInteraction();
      const pt = toLogicalCoords(e.clientX, e.clientY);
      this.pointer.x = pt.x;
      this.pointer.y = pt.y;
      this.pointer.down = true;
      this.pointer.justPressed = true;
      this.pointer.isTouch = false;
      this._swipeStart = { x: pt.x, y: pt.y, time: performance.now() };
    };

    this._onWindowMouseUp = () => {
      if (this.pointer.down) {
        this.pointer.down = false;
        this.pointer.justReleased = true;
      }
    };

    this._onCanvasTouchStart = (e) => {
      this._notifyInteraction();
      if (e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const pt = toLogicalCoords(t.clientX, t.clientY);
        this.pointer.x = pt.x;
        this.pointer.y = pt.y;
        this.pointer.down = true;
        this.pointer.justPressed = true;
        this.pointer.isTouch = true;
        this._swipeStart = { x: pt.x, y: pt.y, time: performance.now() };
      }
    };

    this._onCanvasTouchMove = (e) => {
      if (e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const pt = toLogicalCoords(t.clientX, t.clientY);
        this.pointer.x = pt.x;
        this.pointer.y = pt.y;
        if (this._swipeStart) {
          const dx = pt.x - this._swipeStart.x;
          const dy = pt.y - this._swipeStart.y;
          if (Math.hypot(dx, dy) > 28) {
            if (Math.abs(dx) > Math.abs(dy)) {
              this.lastSwipe = dx > 0 ? 'right' : 'left';
            } else {
              this.lastSwipe = dy > 0 ? 'down' : 'up';
            }
            this._swipeStart = { x: pt.x, y: pt.y, time: performance.now() };
          }
        }
      }
    };

    this._onCanvasTouchEnd = (e) => {
      if (e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const pt = toLogicalCoords(t.clientX, t.clientY);
        if (this._swipeStart) {
          const dx = pt.x - this._swipeStart.x;
          const dy = pt.y - this._swipeStart.y;
          if (Math.hypot(dx, dy) > 24) {
            if (Math.abs(dx) > Math.abs(dy)) {
              this.lastSwipe = dx > 0 ? 'right' : 'left';
            } else {
              this.lastSwipe = dy > 0 ? 'down' : 'up';
            }
          }
          this._swipeStart = null;
        }
      }
      this.pointer.down = false;
      this.pointer.justReleased = true;
    };
  }

  mount() {
    if (this.mounted) {
      if (this.touchControls && !this.touchControls.mounted) {
        this.touchControls.mount();
      }
      return;
    }

    this._boundListeners = [];
    if (typeof window !== 'undefined') {
      this._addManagedListener(window, 'keydown', this._onKeyDown, { passive: false });
      this._addManagedListener(window, 'keyup', this._onKeyUp);
      this._addManagedListener(window, 'blur', this._onBlur);
      if (this._onWindowMouseUp) {
        this._addManagedListener(window, 'mouseup', this._onWindowMouseUp);
      }
      if (this._onGamepadConnected) {
        this._addManagedListener(window, 'gamepadconnected', this._onGamepadConnected);
      }
      if (this._onGamepadDisconnected) {
        this._addManagedListener(window, 'gamepaddisconnected', this._onGamepadDisconnected);
      }
    }

    if (this.canvas) {
      this._addManagedListener(this.canvas, 'mousemove', this._onCanvasMouseMove);
      this._addManagedListener(this.canvas, 'mousedown', this._onCanvasMouseDown);
      this._addManagedListener(this.canvas, 'touchstart', this._onCanvasTouchStart, { passive: true });
      this._addManagedListener(this.canvas, 'touchmove', this._onCanvasTouchMove, { passive: true });
      this._addManagedListener(this.canvas, 'touchend', this._onCanvasTouchEnd, { passive: true });
    }

    if (this.touchControls) {
      this.touchControls.mount();
    }

    this.mounted = true;
  }

  unmount() {
    for (let i = 0; i < this._boundListeners.length; i++) {
      const { target, type, handler, options } = this._boundListeners[i];
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener(type, handler, options);
      }
    }
    this._boundListeners = [];
    this.mounted = false;
    if (this.touchControls) {
      this.touchControls.unmount();
    }
    this.resetState();
  }

  remountForGameSwitch() {
    this.unmount();
    this.mount();
  }

  getActiveListenerCount() {
    const own = this.mounted ? this._boundListeners.length : 0;
    const touch =
      this.touchControls && typeof this.touchControls.getActiveListenerCount === 'function'
        ? this.touchControls.getActiveListenerCount()
        : 0;
    return own + touch;
  }

  destroy() {
    this.unmount();
  }

  setTouchDirection(up, down, left, right, axisX = 0, axisY = 0) {
    this._notifyInteraction();
    if (up && !this.touchState.up) this.latchedPress.up = true;
    if (down && !this.touchState.down) this.latchedPress.down = true;
    if (left && !this.touchState.left) this.latchedPress.left = true;
    if (right && !this.touchState.right) this.latchedPress.right = true;

    this.touchState.up = up;
    this.touchState.down = down;
    this.touchState.left = left;
    this.touchState.right = right;
    this.touchState.axisX = axisX;
    this.touchState.axisY = axisY;
    this.syncVirtualState();
  }

  setTouchAction(action, isDown) {
    this._notifyInteraction();
    if (isDown && !this.touchState[action]) {
      this.latchedPress[action] = true;
    }
    this.touchState[action] = isDown;
    this.syncVirtualState();
  }

  toggleTurbo(forceState) {
    this.turboEnabled = typeof forceState === 'boolean' ? forceState : !this.turboEnabled;
    this._turboTick = 0;
    return this.turboEnabled;
  }

  updateTurbo(dt = 0.016) {
    if (!this.turboEnabled) return;
    this._turboAccum = (this._turboAccum || 0) + dt;
    if (this._turboAccum >= 1 / 15) {
      this._turboAccum = 0;
      if (this.keyState.actionA || this.touchState.actionA || this.gamepadState.actionA) {
        this.latchedPress.actionA = true;
      }
      if (this.keyState.actionB || this.touchState.actionB || this.gamepadState.actionB) {
        this.latchedPress.actionB = true;
      }
    }
  }

  setAttractInput(upOrObj, down, left, right, actionA, actionB) {
    let u = upOrObj;
    let d = down;
    let l = left;
    let r = right;
    let a = actionA;
    let b = actionB;
    if (upOrObj && typeof upOrObj === 'object') {
      u = upOrObj.up;
      d = upOrObj.down;
      l = upOrObj.left;
      r = upOrObj.right;
      a = upOrObj.actionA;
      b = upOrObj.actionB;
    }
    this.attractState.active = true;
    if (a && !this.attractState.actionA) this.latchedPress.actionA = true;
    if (b && !this.attractState.actionB) this.latchedPress.actionB = true;
    if (u && !this.attractState.up) this.latchedPress.up = true;
    if (d && !this.attractState.down) this.latchedPress.down = true;
    if (l && !this.attractState.left) this.latchedPress.left = true;
    if (r && !this.attractState.right) this.latchedPress.right = true;

    this.attractState.up = !!u;
    this.attractState.down = !!d;
    this.attractState.left = !!l;
    this.attractState.right = !!r;
    this.attractState.actionA = !!a;
    this.attractState.actionB = !!b;
    this.syncVirtualState();
  }

  clearAttractInput() {
    if (!this.attractState.active) return;
    this.attractState.active = false;
    this.attractState.up = false;
    this.attractState.down = false;
    this.attractState.left = false;
    this.attractState.right = false;
    this.attractState.actionA = false;
    this.attractState.actionB = false;
    this.syncVirtualState();
  }

  triggerPause() {
    this._notifyInteraction();
    this.latchedPress.pause = true;
    if (typeof this.onPauseCallback === 'function') {
      this.onPauseCallback();
    }
  }

  triggerMenuReturn() {
    this._notifyInteraction();
    this.latchedPress.menu = true;
    if (typeof this.onMenuCallback === 'function') {
      this.onMenuCallback();
    }
  }

  pollGamepads() {
    // Handle Rapid-Fire Turbo Auto-Fire Oscillator (15 Hz pulse)
    if (this.turboEnabled) {
      this._turboTick = (this._turboTick + 1) % 4;
      if (this._turboTick === 0) {
        if (this.keyState.actionA || this.touchState.actionA || this.gamepadState.actionA) {
          this.latchedPress.actionA = true;
        }
        if (this.keyState.actionB || this.touchState.actionB || this.gamepadState.actionB) {
          this.latchedPress.actionB = true;
        }
      }
    }

    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return;
    }
    let pads;
    try {
      pads = navigator.getGamepads();
    } catch (_) {
      return;
    }
    if (!pads) return;

    let up = false;
    let down = false;
    let left = false;
    let right = false;
    let actionA = false;
    let actionB = false;
    let pause = false;
    let menu = false;
    let select = false;
    let start = false;
    let l1 = false;
    let r1 = false;
    let l2 = false;
    let r2 = false;
    let l3 = false;
    let r3 = false;
    let saveState = false;
    let loadState = false;
    let fastForward = false;
    let favorite = false;
    let nextTab = false;
    let prevTab = false;
    let rewindHeld = false;
    let axisX = 0;
    let axisY = 0;
    let rightAxisX = 0;
    let rightAxisY = 0;
    let connectedCount = 0;
    let primaryName = '';

    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (!gp || !gp.connected) continue;
      connectedCount++;
      if (!primaryName && gp.id) primaryName = gp.id;

      const b = gp.buttons || [];
      const ax = gp.axes || [];

      // Primary Left Stick / Joystick axes
      const lx = ax[0] ?? 0;
      const ly = ax[1] ?? 0;
      // Secondary Right Stick / Aiming axes
      const rx = ax[2] ?? 0;
      const ry = ax[3] ?? 0;

      // Linux / Raspberry Pi / USB Arcade Encoder Hat Switch fallback:
      const hatX =
        ax.length > 4 && Math.abs(ax[4]) > 0.35
          ? ax[4]
          : ax.length > 6 && Math.abs(ax[6]) > 0.35
          ? ax[6]
          : 0;
      const hatY =
        ax.length > 5 && Math.abs(ax[5]) > 0.35
          ? ax[5]
          : ax.length > 7 && Math.abs(ax[7]) > 0.35
          ? ax[7]
          : 0;

      if (Math.abs(lx) > 0.20) axisX = lx;
      else if (Math.abs(hatX) > 0.20) axisX = hatX;

      if (Math.abs(ly) > 0.20) axisY = ly;
      else if (Math.abs(hatY) > 0.20) axisY = hatY;

      if (Math.abs(rx) > 0.20) rightAxisX = rx;
      if (Math.abs(ry) > 0.20) rightAxisY = ry;

      // D-Pad Directional Checks (Stick, Hat Switch, or D-Pad buttons 12-15)
      if (ly < -0.35 || hatY < -0.35 || (b[12] && b[12].pressed)) up = true;
      if (ly > 0.35 || hatY > 0.35 || (b[13] && b[13].pressed)) down = true;
      if (lx < -0.35 || hatX < -0.35 || (b[14] && b[14].pressed)) left = true;
      if (lx > 0.35 || hatX > 0.35 || (b[15] && b[15].pressed)) right = true;

      // Digital button reads
      const b0 = !!(b[0] && b[0].pressed); // Face Bottom (A/Cross)
      const b1 = !!(b[1] && b[1].pressed); // Face Right (B/Circle)
      const b2 = !!(b[2] && b[2].pressed); // Face Left (X/Square)
      const b3 = !!(b[3] && b[3].pressed); // Face Top (Y/Triangle)
      const b4 = !!(b[4] && b[4].pressed); // L1 / LB
      const b5 = !!(b[5] && b[5].pressed); // R1 / RB
      const b6 = !!(b[6] && (b[6].pressed || (typeof b[6].value === 'number' && b[6].value > 0.4))); // L2 / LT
      const b7 = !!(b[7] && (b[7].pressed || (typeof b[7].value === 'number' && b[7].value > 0.4))); // R2 / RT
      const b8 = !!(b[8] && b[8].pressed); // Select / Back / Share / Coin
      const b9 = !!(b[9] && b[9].pressed); // Start / Options
      const b10 = !!(b[10] && b[10].pressed); // L3
      const b11 = !!(b[11] && b[11].pressed); // R3
      const b16 = !!(b[16] && b[16].pressed); // Guide / Home / PS button

      if (b4) l1 = true;
      if (b5) r1 = true;
      if (b6) l2 = true;
      if (b7) r2 = true;
      if (b10) l3 = true;
      if (b11) r3 = true;

      // RetroPie & Console Hotkey combos
      // 1. SELECT + START (or Guide button): Universal Return to Arcade Lobby
      if ((b8 && b9) || b16) {
        menu = true;
      } else if (b9 && !b8) {
        // START alone: Pause / Start Game
        pause = true;
        start = true;
      }

      // 2. SELECT + L1: Quick Save State (RetroPie standard)
      if (b8 && b4) {
        saveState = true;
      }
      // 3. SELECT + R1: Quick Load State (RetroPie standard)
      if (b8 && b5) {
        loadState = true;
      }
      // 4. SELECT + (b2 or b3): Toggle Favorite / Bookmark
      if (b8 && (b2 || b3)) {
        favorite = true;
      }
      // 5. SELECT alone: Coin / Select / Tab
      if (b8 && !b9 && !b4 && !b5 && !b2 && !b3) {
        select = true;
      }

      // 6. Fast Forward (Speed toggle): R3 stick click or SELECT + R2
      if (b11 || (b8 && b7)) {
        fastForward = true;
      }

      // 7. Rewind time: Hold L2 / LT or L3
      if (b6 || b10) {
        rewindHeld = true;
      }

      // 8. Menu Tab navigation via shoulder bumpers (when Select not held):
      if (b4 && !b8) prevTab = true;
      if (b5 && !b8) nextTab = true;

      // 9. Action A (Primary): Face Bottom (b0), Face Left (b2), Shoulder L1 (b4), Trigger L2 (b6), or SELECT on title screen
      if (b0 || b2 || (b4 && !b8) || b6 || (b8 && !b9 && !b4 && !b5)) {
        actionA = true;
      }

      // 10. Action B (Secondary): Face Right (b1), Face Top (b3), Shoulder R1 (b5), Trigger R2 (b7)
      if (b1 || b3 || (b5 && !b8) || b7) {
        actionB = true;
      }
    }

    if (up || down || left || right || actionA || actionB || select || start) {
      this._notifyInteraction();
    }

    if (up && !this.gamepadState.up) this.latchedPress.up = true;
    if (down && !this.gamepadState.down) this.latchedPress.down = true;
    if (left && !this.gamepadState.left) this.latchedPress.left = true;
    if (right && !this.gamepadState.right) this.latchedPress.right = true;
    if (actionA && !this.gamepadState.actionA) this.latchedPress.actionA = true;
    if (actionB && !this.gamepadState.actionB) this.latchedPress.actionB = true;
    if (pause && !this.gamepadState.pause) {
      this.latchedPress.pause = true;
      if (typeof this.onPauseCallback === 'function') this.onPauseCallback();
    }
    if (menu && !this.gamepadState.menu) {
      this.latchedPress.menu = true;
      if (typeof this.onMenuCallback === 'function') this.onMenuCallback();
    }

    if (saveState && !this.gamepadState.saveState) this._gamepadSaveLatched = true;
    if (loadState && !this.gamepadState.loadState) this._gamepadLoadLatched = true;
    if (fastForward && !this.gamepadState.fastForward) this._gamepadFastForwardLatched = true;
    if (favorite && !this.gamepadState.favorite) this._gamepadFavoriteLatched = true;
    if (nextTab && !this.gamepadState.nextTab) this._gamepadNextTabLatched = true;
    if (prevTab && !this.gamepadState.prevTab) this._gamepadPrevTabLatched = true;
    if (select && !this.gamepadState.select) this._gamepadSelectLatched = true;
    if (start && !this.gamepadState.start) this._gamepadStartLatched = true;

    this.gamepadState.connected = connectedCount > 0;
    this.gamepadState.count = connectedCount;
    this.gamepadState.name = primaryName || (connectedCount > 0 ? 'Gamepad' : '');
    this.gamepadState.up = up;
    this.gamepadState.down = down;
    this.gamepadState.left = left;
    this.gamepadState.right = right;
    this.gamepadState.actionA = actionA;
    this.gamepadState.actionB = actionB;
    this.gamepadState.pause = pause;
    this.gamepadState.menu = menu;
    this.gamepadState.select = select;
    this.gamepadState.start = start;
    this.gamepadState.l1 = l1;
    this.gamepadState.r1 = r1;
    this.gamepadState.l2 = l2;
    this.gamepadState.r2 = r2;
    this.gamepadState.l3 = l3;
    this.gamepadState.r3 = r3;
    this.gamepadState.rewindHeld = rewindHeld;
    this.gamepadState.saveState = saveState;
    this.gamepadState.loadState = loadState;
    this.gamepadState.fastForward = fastForward;
    this.gamepadState.favorite = favorite;
    this.gamepadState.nextTab = nextTab;
    this.gamepadState.prevTab = prevTab;
    this.gamepadState.axisX = axisX;
    this.gamepadState.axisY = axisY;
    this.gamepadState.rightAxisX = rightAxisX;
    this.gamepadState.rightAxisY = rightAxisY;

    this.syncVirtualState();
  }

  isGamepadConnected() {
    return this.gamepadState.connected;
  }

  getGamepadName() {
    return this.gamepadState.name || 'Gamepad';
  }

  getRightAxis() {
    if (Math.hypot(this.gamepadState.rightAxisX, this.gamepadState.rightAxisY) > 0.15) {
      return { x: this.gamepadState.rightAxisX, y: this.gamepadState.rightAxisY };
    }
    return { x: 0, y: 0 };
  }

  isGamepadRewindHeld() {
    return !!this.gamepadState.rewindHeld;
  }

  isGamepadSaveStatePressed() {
    return !!this._gamepadSaveLatched;
  }

  isGamepadLoadStatePressed() {
    return !!this._gamepadLoadLatched;
  }

  isGamepadFastForwardPressed() {
    return !!this._gamepadFastForwardLatched;
  }

  isGamepadFavoritePressed() {
    return !!this._gamepadFavoriteLatched;
  }

  isGamepadNextTabPressed() {
    return !!this._gamepadNextTabLatched;
  }

  isGamepadPrevTabPressed() {
    return !!this._gamepadPrevTabLatched;
  }

  isGamepadSelectPressed() {
    return !!this._gamepadSelectLatched;
  }

  isGamepadStartPressed() {
    return !!this._gamepadStartLatched;
  }

  syncVirtualState() {
    this.virtualState.up = !!(
      this.keyState.up ||
      this.touchState.up ||
      this.gamepadState.up ||
      (this.attractState.active && this.attractState.up)
    );
    this.virtualState.down = !!(
      this.keyState.down ||
      this.touchState.down ||
      this.gamepadState.down ||
      (this.attractState.active && this.attractState.down)
    );
    this.virtualState.left = !!(
      this.keyState.left ||
      this.touchState.left ||
      this.gamepadState.left ||
      (this.attractState.active && this.attractState.left)
    );
    this.virtualState.right = !!(
      this.keyState.right ||
      this.touchState.right ||
      this.gamepadState.right ||
      (this.attractState.active && this.attractState.right)
    );
    this.virtualState.actionA = !!(
      this.keyState.actionA ||
      this.touchState.actionA ||
      this.gamepadState.actionA ||
      (this.attractState.active && this.attractState.actionA)
    );
    this.virtualState.actionB = !!(
      this.keyState.actionB ||
      this.touchState.actionB ||
      this.gamepadState.actionB ||
      (this.attractState.active && this.attractState.actionB)
    );
    this.virtualState.pause = !!(this.keyState.pause || this.gamepadState.pause);
    this.virtualState.menu = !!(this.keyState.menu || this.gamepadState.menu);
  }

  /**
   * Maps physical and virtual inputs to normalized actions (Spec Section 4)
   */
  getActionState(action) {
    return !!this.virtualState[action];
  }

  isDown(action) {
    return !!this.virtualState[action];
  }

  isKeyDown(code) {
    return this.rawKeysDown.has(code);
  }

  isKeyJustPressed(code) {
    return this.rawKeysJustPressed.has(code);
  }

  isJustPressed(action) {
    if (action === 'any') {
      return (
        this.isJustPressed('actionA') ||
        this.isJustPressed('actionB') ||
        this.isJustPressed('up') ||
        this.isJustPressed('down') ||
        this.isJustPressed('left') ||
        this.isJustPressed('right') ||
        this.pointer.justPressed
      );
    }
    return !!this.latchedPress[action] || (!!this.virtualState[action] && !this.prevState[action]);
  }

  isJustReleased(action) {
    return !this.virtualState[action] && !!this.prevState[action];
  }

  getAxis() {
    if (Math.hypot(this.touchState.axisX, this.touchState.axisY) > 0.05) {
      return { x: this.touchState.axisX, y: this.touchState.axisY };
    }
    if (Math.hypot(this.gamepadState.axisX, this.gamepadState.axisY) > 0.1) {
      return { x: this.gamepadState.axisX, y: this.gamepadState.axisY };
    }
    let x = 0;
    let y = 0;
    if (this.virtualState.left) x -= 1;
    if (this.virtualState.right) x += 1;
    if (this.virtualState.up) y -= 1;
    if (this.virtualState.down) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  consumeSwipe() {
    const s = this.lastSwipe;
    this.lastSwipe = null;
    return s;
  }

  endFrame() {
    for (const k of Object.keys(this.virtualState)) {
      this.prevState[k] = this.virtualState[k];
      this.latchedPress[k] = false;
    }
    this.rawKeysJustPressed.clear();
    this.pointer.justPressed = false;
    this.pointer.justReleased = false;
    this._gamepadSaveLatched = false;
    this._gamepadLoadLatched = false;
    this._gamepadFastForwardLatched = false;
    this._gamepadFavoriteLatched = false;
    this._gamepadNextTabLatched = false;
    this._gamepadPrevTabLatched = false;
    this._gamepadSelectLatched = false;
    this._gamepadStartLatched = false;
  }

  resetState() {
    for (const k of Object.keys(this.virtualState)) {
      this.virtualState[k] = false;
      this.keyState[k] = false;
      this.prevState[k] = false;
      this.latchedPress[k] = false;
    }
    this.rawKeysDown.clear();
    this.rawKeysJustPressed.clear();
    this.clearAttractInput();
    this.touchState.up = false;
    this.touchState.down = false;
    this.touchState.left = false;
    this.touchState.right = false;
    this.touchState.actionA = false;
    this.touchState.actionB = false;
    this.touchState.axisX = 0;
    this.touchState.axisY = 0;
    this.gamepadState.up = false;
    this.gamepadState.down = false;
    this.gamepadState.left = false;
    this.gamepadState.right = false;
    this.gamepadState.actionA = false;
    this.gamepadState.actionB = false;
    this.gamepadState.pause = false;
    this.gamepadState.menu = false;
    this.gamepadState.select = false;
    this.gamepadState.start = false;
    this.gamepadState.l1 = false;
    this.gamepadState.r1 = false;
    this.gamepadState.l2 = false;
    this.gamepadState.r2 = false;
    this.gamepadState.l3 = false;
    this.gamepadState.r3 = false;
    this.gamepadState.rewindHeld = false;
    this.gamepadState.saveState = false;
    this.gamepadState.loadState = false;
    this.gamepadState.fastForward = false;
    this.gamepadState.favorite = false;
    this.gamepadState.nextTab = false;
    this.gamepadState.prevTab = false;
    this.gamepadState.axisX = 0;
    this.gamepadState.axisY = 0;
    this.gamepadState.rightAxisX = 0;
    this.gamepadState.rightAxisY = 0;
    this._gamepadSaveLatched = false;
    this._gamepadLoadLatched = false;
    this._gamepadFastForwardLatched = false;
    this._gamepadFavoriteLatched = false;
    this._gamepadNextTabLatched = false;
    this._gamepadPrevTabLatched = false;
    this._gamepadSelectLatched = false;
    this._gamepadStartLatched = false;
    this.pointer.down = false;
    this.pointer.justPressed = false;
    this.pointer.justReleased = false;
    this.lastSwipe = null;
    this._swipeStart = null;
    if (this.touchControls) {
      if (this.touchControls._startReleaseTimer) {
        clearTimeout(this.touchControls._startReleaseTimer);
        this.touchControls._startReleaseTimer = null;
      }
      this.touchControls.activeDpadTouchId = null;
      this.touchControls.mouseDpadDown = false;
      if (this.touchControls.thumbEl) {
        this.touchControls.thumbEl.style.transform = 'translate(-50%, -50%)';
      }
      if (this.touchControls.btnA) this.touchControls.btnA.classList.remove('active');
      if (this.touchControls.btnB) this.touchControls.btnB.classList.remove('active');
      this.touchControls.syncDpadVisuals();
    }
  }
}

export const Input = InputManager;
export default InputManager;
