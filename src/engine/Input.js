/**
 * Input.js
 * Unified Input Event Controller handling physical keyboard, mouse/pointer,
 * canvas swipe/tap gestures, and mobile touch overlay controls simultaneously.
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
      isTouch: false
    };

    this.lastSwipe = null;
    this._swipeStart = null;
    this.onPauseCallback = null;
    this.onMenuCallback = null;
    this.onFirstInteraction = null;
    this._interacted = false;

    this.initKeyboard();
    this.initTouchOverlay();
    if (this.canvas) {
      this.bindCanvasPointer(this.canvas);
    }
  }

  _notifyInteraction() {
    if (!this._interacted) {
      this._interacted = true;
      if (typeof this.onFirstInteraction === 'function') {
        this.onFirstInteraction();
      }
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
      const action = this._keyMap[e.code];
      if (action) {
        this.keyState[action] = false;
        this.syncVirtualState();
      }
    };

    this._onBlur = () => {
      this.resetState();
    };

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
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
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return { x: 480, y: 270 };
      const x = ((clientX - rect.left) / rect.width) * this.logicalWidth;
      const y = ((clientY - rect.top) / rect.height) * this.logicalHeight;
      return {
        x: Math.max(0, Math.min(this.logicalWidth, x)),
        y: Math.max(0, Math.min(this.logicalHeight, y))
      };
    };

    canvas.addEventListener('mousemove', (e) => {
      const pt = toLogicalCoords(e.clientX, e.clientY);
      this.pointer.x = pt.x;
      this.pointer.y = pt.y;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this._notifyInteraction();
      const pt = toLogicalCoords(e.clientX, e.clientY);
      this.pointer.x = pt.x;
      this.pointer.y = pt.y;
      this.pointer.down = true;
      this.pointer.justPressed = true;
      this.pointer.isTouch = false;
      this._swipeStart = { x: pt.x, y: pt.y, time: performance.now() };
    });

    window.addEventListener('mouseup', () => {
      if (this.pointer.down) {
        this.pointer.down = false;
        this.pointer.justReleased = true;
      }
    });

    canvas.addEventListener(
      'touchstart',
      (e) => {
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
      },
      { passive: true }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
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
      },
      { passive: true }
    );

    canvas.addEventListener(
      'touchend',
      (e) => {
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
      },
      { passive: true }
    );
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
    this.virtualState.up = !!(this.keyState.up || this.touchState.up || this.gamepadState.up);
    this.virtualState.down = !!(this.keyState.down || this.touchState.down || this.gamepadState.down);
    this.virtualState.left = !!(this.keyState.left || this.touchState.left || this.gamepadState.left);
    this.virtualState.right = !!(this.keyState.right || this.touchState.right || this.gamepadState.right);
    this.virtualState.actionA = !!(this.keyState.actionA || this.touchState.actionA || this.gamepadState.actionA);
    this.virtualState.actionB = !!(this.keyState.actionB || this.touchState.actionB || this.gamepadState.actionB);
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
  }
}

export const Input = InputManager;
export default InputManager;
