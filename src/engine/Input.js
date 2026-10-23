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
      up: false,
      down: false,
      left: false,
      right: false,
      actionA: false,
      actionB: false,
      pause: false,
      menu: false,
      axisX: 0,
      axisY: 0
    };

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

  setAttractInput(up, down, left, right, actionA, actionB) {
    this.attractState.active = true;
    if (actionA && !this.attractState.actionA) this.latchedPress.actionA = true;
    if (actionB && !this.attractState.actionB) this.latchedPress.actionB = true;
    if (up && !this.attractState.up) this.latchedPress.up = true;
    if (down && !this.attractState.down) this.latchedPress.down = true;
    if (left && !this.attractState.left) this.latchedPress.left = true;
    if (right && !this.attractState.right) this.latchedPress.right = true;

    this.attractState.up = !!up;
    this.attractState.down = !!down;
    this.attractState.left = !!left;
    this.attractState.right = !!right;
    this.attractState.actionA = !!actionA;
    this.attractState.actionB = !!actionB;
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
    let axisX = 0;
    let axisY = 0;

    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (!gp || !gp.connected) continue;
      const b = gp.buttons || [];
      const ax = gp.axes || [];
      const lx = ax[0] || 0;
      const ly = ax[1] || 0;
      if (Math.abs(lx) > 0.25) axisX = lx;
      if (Math.abs(ly) > 0.25) axisY = ly;

      if (ly < -0.35 || (b[12] && b[12].pressed)) up = true;
      if (ly > 0.35 || (b[13] && b[13].pressed)) down = true;
      if (lx < -0.35 || (b[14] && b[14].pressed)) left = true;
      if (lx > 0.35 || (b[15] && b[15].pressed)) right = true;

      if ((b[0] && b[0].pressed) || (b[2] && b[2].pressed)) actionA = true;
      if ((b[1] && b[1].pressed) || (b[3] && b[3].pressed)) actionB = true;

      const selectDown = !!(b[8] && b[8].pressed);
      const startDown = !!(b[9] && b[9].pressed);
      if (selectDown && startDown) {
        menu = true;
      } else if (startDown) {
        pause = true;
      }
    }

    if (up || down || left || right || actionA || actionB) {
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

    this.gamepadState.up = up;
    this.gamepadState.down = down;
    this.gamepadState.left = left;
    this.gamepadState.right = right;
    this.gamepadState.actionA = actionA;
    this.gamepadState.actionB = actionB;
    this.gamepadState.pause = pause;
    this.gamepadState.menu = menu;
    this.gamepadState.axisX = axisX;
    this.gamepadState.axisY = axisY;
    this.syncVirtualState();
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
    this.gamepadState.axisX = 0;
    this.gamepadState.axisY = 0;
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
