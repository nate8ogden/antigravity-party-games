import { PlayerId, InputState } from './Types';
import { EconomyManager } from './EconomyManager';

interface Ripple {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
}

export interface DetailedInputState extends InputState {
  steer: number;         // Smoothed analog steer: -1.0 (left) to 1.0 (right)
  throttle: number;      // Smoothed analog throttle: -1.0 (reverse) to 1.0 (forward)
  rawSteer: number;      // Discrete target steer: -1, 0, 1
  rawThrottle: number;   // Discrete target throttle: -1, 0, 1
  action: boolean;       // fire / boost / jump / fling / drop
  justAction: boolean;
  justUp: boolean;
  justDown: boolean;
  justLeft: boolean;
  justRight: boolean;
}

interface VirtualJoystick {
  active: boolean;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  opacity: number;
}

interface TouchTrack {
  pid: PlayerId;
  role: 'joystick' | 'action';
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  startTime: number;
}

export class InputRouter {
  private canvas: HTMLCanvasElement;
  public controlMode: 'single_button' | 'directional' = 'directional';

  private states: Record<PlayerId, DetailedInputState> = {
    0: { pressed: false, justPressed: false, justReleased: false, pressStartTime: 0, holdDuration: 0, steer: 0, throttle: 0, rawSteer: 0, rawThrottle: 0, action: false, justAction: false, justUp: false, justDown: false, justLeft: false, justRight: false },
    1: { pressed: false, justPressed: false, justReleased: false, pressStartTime: 0, holdDuration: 0, steer: 0, throttle: 0, rawSteer: 0, rawThrottle: 0, action: false, justAction: false, justUp: false, justDown: false, justLeft: false, justRight: false },
    2: { pressed: false, justPressed: false, justReleased: false, pressStartTime: 0, holdDuration: 0, steer: 0, throttle: 0, rawSteer: 0, rawThrottle: 0, action: false, justAction: false, justUp: false, justDown: false, justLeft: false, justRight: false },
    3: { pressed: false, justPressed: false, justReleased: false, pressStartTime: 0, holdDuration: 0, steer: 0, throttle: 0, rawSteer: 0, rawThrottle: 0, action: false, justAction: false, justUp: false, justDown: false, justLeft: false, justRight: false }
  };

  private botOverrides: Record<PlayerId, { pressed: boolean; steer: number; throttle: number; action: boolean }> = {
    0: { pressed: false, steer: 0, throttle: 0, action: false },
    1: { pressed: false, steer: 0, throttle: 0, action: false },
    2: { pressed: false, steer: 0, throttle: 0, action: false },
    3: { pressed: false, steer: 0, throttle: 0, action: false }
  };

  // Keyboard axes
  private keyboardSteer: Record<PlayerId, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  private keyboardThrottle: Record<PlayerId, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  private keyboardAction: Record<PlayerId, boolean> = { 0: false, 1: false, 2: false, 3: false };

  // Touch axes & virtual joysticks
  private touchSteer: Record<PlayerId, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  private touchThrottle: Record<PlayerId, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  private joysticks: Record<PlayerId, VirtualJoystick> = {
    0: { active: false, originX: 0, originY: 0, currentX: 0, currentY: 0, opacity: 0 },
    1: { active: false, originX: 0, originY: 0, currentX: 0, currentY: 0, opacity: 0 },
    2: { active: false, originX: 0, originY: 0, currentX: 0, currentY: 0, opacity: 0 },
    3: { active: false, originX: 0, originY: 0, currentX: 0, currentY: 0, opacity: 0 }
  };
  private activeTouches: Map<number, TouchTrack> = new Map();

  // Gamepad API axes & buttons
  private gamepadSteer: Record<PlayerId, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  private gamepadThrottle: Record<PlayerId, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  private gamepadAction: Record<PlayerId, boolean> = { 0: false, 1: false, 2: false, 3: false };

  // Input buffering / coyote window (seconds)
  private actionBufferTimer: Record<PlayerId, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  private pressBufferTimer: Record<PlayerId, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

  // Ripples & visual flair
  private ripples: Ripple[] = [];
  private playerColors: string[] = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B'];

  // Track active raw keys to avoid ghosting
  private activeKeys: Set<string> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  public setControlMode(mode: 'single_button' | 'directional') {
    this.controlMode = mode;
  }

  public getControlMode(): 'single_button' | 'directional' {
    return this.controlMode;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  private lastHapticTime: number = 0;

  private triggerHaptic(durationMs = 12) {
    const now = performance.now();
    if (now - this.lastHapticTime < 45) return; // Rate limit to prevent vibration queue lag
    this.lastHapticTime = now;

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(durationMs);
      } catch (_) {
        // Silently ignore if blocked by browser policy
      }
    }
  }

  private bindEvents() {
    // Gamepad connection event listeners
    window.addEventListener('gamepadconnected', (e: Event) => {
      const gp = (e as GamepadEvent).gamepad;
      if (gp && gp.index < 4) {
        this.addRipple(this.canvas.width / 2, 40, this.playerColors[gp.index]);
        this.triggerHaptic(20);
      }
    });

    window.addEventListener('gamepaddisconnected', (e: Event) => {
      const idx = (e as GamepadEvent).gamepad?.index ?? -1;
      if (idx >= 0 && idx < 4) {
        const pid = idx as PlayerId;
        this.gamepadSteer[pid] = 0;
        this.gamepadThrottle[pid] = 0;
        this.gamepadAction[pid] = false;
        this.checkPlayerRelease(pid);
      }
    });

    // Keyboard listeners
    window.addEventListener('keydown', (e) => {
      this.activeKeys.add(e.code);
      this.recalculateKeyboardInputs();
    });

    window.addEventListener('keyup', (e) => {
      this.activeKeys.delete(e.code);
      this.recalculateKeyboardInputs();
    });

    // Window blur listener to clear stuck keys/touches when switching apps
    window.addEventListener('blur', () => {
      this.activeKeys.clear();
      this.activeTouches.clear();
      for (let p = 0; p < 4; p++) {
        const pid = p as PlayerId;
        this.joysticks[pid].active = false;
        this.joysticks[pid].opacity = 0;
        this.keyboardSteer[pid] = 0;
        this.keyboardThrottle[pid] = 0;
        this.keyboardAction[pid] = false;
        this.touchSteer[pid] = 0;
        this.touchThrottle[pid] = 0;
        this.gamepadSteer[pid] = 0;
        this.gamepadThrottle[pid] = 0;
        this.gamepadAction[pid] = false;
        if (!this.botOverrides[pid].pressed && this.states[pid].pressed) {
          this.release(pid);
        }
      }
    });

    // Multi-touch listeners with dynamic floating virtual thumbsticks
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const now = performance.now();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const clientX = touch.clientX - rect.left;
        const clientY = touch.clientY - rect.top;
        const info = this.pointToPlayerDetailed(clientX, clientY, rect.width, rect.height);
        if (info !== null) {
          const pid = info.pid;
          this.addRipple(clientX, clientY, this.playerColors[pid]);
          this.triggerHaptic(10);

          if (this.controlMode === 'single_button') {
            // In single_button mode: EVERY touch anywhere in player quadrant triggers action immediately!
            this.activeTouches.set(touch.identifier, {
              pid,
              role: 'action',
              originX: clientX,
              originY: clientY,
              currentX: clientX,
              currentY: clientY,
              startTime: now
            });
            this.triggerAction(pid);
          } else {
            // Directional mode
            // If player doesn't have an active joystick touch yet, anchor a new floating joystick
            const hasJoystick = Array.from(this.activeTouches.values()).some((t) => t.pid === pid && t.role === 'joystick');
            if (!hasJoystick) {
              this.activeTouches.set(touch.identifier, {
                pid,
                role: 'joystick',
                originX: clientX,
                originY: clientY,
                currentX: clientX,
                currentY: clientY,
                startTime: now
              });
              this.joysticks[pid] = {
                active: true,
                originX: clientX,
                originY: clientY,
                currentX: clientX,
                currentY: clientY,
                opacity: 1.0
              };
              this.press(pid);
            } else {
              // Secondary touch finger acts as dedicated Action button!
              this.activeTouches.set(touch.identifier, {
                pid,
                role: 'action',
                originX: clientX,
                originY: clientY,
                currentX: clientX,
                currentY: clientY,
                startTime: now
              });
              this.triggerAction(pid);
            }
          }
        }
      }
      this.recalculateTouchInputs();
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const track = this.activeTouches.get(touch.identifier);
        if (track) {
          track.currentX = touch.clientX - rect.left;
          track.currentY = touch.clientY - rect.top;
          if (track.role === 'joystick') {
            const joy = this.joysticks[track.pid];
            joy.currentX = track.currentX;
            joy.currentY = track.currentY;
          }
        }
      }
      this.recalculateTouchInputs();
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const track = this.activeTouches.get(touch.identifier);
        if (track) {
          if (track.role === 'joystick') {
            // Quick tap detection (< 220ms and drag distance < 14px) triggers an action tap!
            const duration = performance.now() - track.startTime;
            const travel = Math.hypot(track.currentX - track.originX, track.currentY - track.originY);
            if (duration < 220 && travel < 14) {
              this.triggerAction(track.pid);
            }
            this.joysticks[track.pid].active = false;
            this.touchSteer[track.pid] = 0;
            this.touchThrottle[track.pid] = 0;
          }
          this.activeTouches.delete(touch.identifier);
          this.checkPlayerRelease(track.pid);
        }
      }
      this.recalculateTouchInputs();
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const track = this.activeTouches.get(touch.identifier);
        if (track) {
          if (track.role === 'joystick') {
            this.joysticks[track.pid].active = false;
            this.touchSteer[track.pid] = 0;
            this.touchThrottle[track.pid] = 0;
          }
          this.activeTouches.delete(touch.identifier);
          this.checkPlayerRelease(track.pid);
        }
      }
      this.recalculateTouchInputs();
    }, { passive: false });

    // Mouse listeners for click & drag testing on desktop
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const info = this.pointToPlayerDetailed(clientX, clientY, rect.width, rect.height);
      if (info !== null) {
        const pid = info.pid;
        const now = performance.now();
        this.addRipple(clientX, clientY, this.playerColors[pid]);
        this.triggerHaptic(10);

        if (this.controlMode === 'single_button') {
          this.activeTouches.set(-999, {
            pid,
            role: 'action',
            originX: clientX,
            originY: clientY,
            currentX: clientX,
            currentY: clientY,
            startTime: now
          });
          this.triggerAction(pid);
        } else {
          this.activeTouches.set(-999, {
            pid,
            role: 'joystick',
            originX: clientX,
            originY: clientY,
            currentX: clientX,
            currentY: clientY,
            startTime: now
          });
          this.joysticks[pid] = {
            active: true,
            originX: clientX,
            originY: clientY,
            currentX: clientX,
            currentY: clientY,
            opacity: 1.0
          };
          this.press(pid);
        }
        this.recalculateTouchInputs();
      }
    });

    window.addEventListener('mousemove', (e) => {
      const track = this.activeTouches.get(-999);
      if (track) {
        const rect = this.canvas.getBoundingClientRect();
        track.currentX = e.clientX - rect.left;
        track.currentY = e.clientY - rect.top;
        if (track.role === 'joystick') {
          const joy = this.joysticks[track.pid];
          joy.currentX = track.currentX;
          joy.currentY = track.currentY;
        }
        this.recalculateTouchInputs();
      }
    });

    window.addEventListener('mouseup', () => {
      const track = this.activeTouches.get(-999);
      if (track) {
        if (track.role === 'joystick') {
          const duration = performance.now() - track.startTime;
          const travel = Math.hypot(track.currentX - track.originX, track.currentY - track.originY);
          if (duration < 220 && travel < 14) {
            this.triggerAction(track.pid);
          }
          this.joysticks[track.pid].active = false;
          this.touchSteer[track.pid] = 0;
          this.touchThrottle[track.pid] = 0;
        }
        this.activeTouches.delete(-999);
        this.checkPlayerRelease(track.pid);
        this.recalculateTouchInputs();
      }
    });
  }

  private pointToPlayerDetailed(x: number, y: number, width: number, height: number): { pid: PlayerId } | null {
    const midX = width / 2;
    const midY = height / 2;

    // Check center Safe Pause deadzone (~10% of canvas dimensions)
    const deadzoneRadius = Math.min(width, height) * 0.10;
    const dx = x - midX;
    const dy = y - midY;
    if (Math.hypot(dx, dy) < deadzoneRadius) {
      return null;
    }

    let pid: PlayerId;
    if (x < midX) {
      pid = y < midY ? 0 : 2;
    } else {
      pid = y < midY ? 1 : 3;
    }
    return { pid };
  }

  private recalculateTouchInputs() {
    for (let p = 0; p < 4; p++) {
      const pid = p as PlayerId;
      if (this.botOverrides[pid].pressed) continue;

      let hasActiveTouch = false;
      let anyActionTouch = false;

      for (const track of this.activeTouches.values()) {
        if (track.pid === pid) {
          hasActiveTouch = true;
          if (track.role === 'action') {
            anyActionTouch = true;
          } else if (track.role === 'joystick') {
            const dx = track.currentX - track.originX;
            const dy = track.currentY - track.originY;
            const dist = Math.hypot(dx, dy);
            const deadzone = 5;
            const maxRadius = 45;

            if (dist > deadzone) {
              const clamped = Math.min(dist, maxRadius);
              const norm = (clamped - deadzone) / (maxRadius - deadzone);
              this.touchSteer[pid] = (dx / dist) * norm;
              this.touchThrottle[pid] = (-dy / dist) * norm; // upwards drag is forward throttle
            } else {
              this.touchSteer[pid] = 0;
              this.touchThrottle[pid] = 0;
            }
          }
        }
      }

      if (!hasActiveTouch) {
        this.touchSteer[pid] = 0;
        this.touchThrottle[pid] = 0;
      }

      if (anyActionTouch) {
        this.states[pid].action = true;
      }
    }
  }

  private recalculateKeyboardInputs() {
    // Player 1 (Red): WASD (Directional), Space / KeyF / KeyE (Action)
    const p1Up = this.activeKeys.has('KeyW');
    const p1Down = this.activeKeys.has('KeyS');
    const p1Left = this.activeKeys.has('KeyA');
    const p1Right = this.activeKeys.has('KeyD');
    const p1Action = this.activeKeys.has('Space') || this.activeKeys.has('KeyF') || this.activeKeys.has('KeyE');
    this.applyPlayerKeyInput(0, p1Up, p1Down, p1Left, p1Right, p1Action);

    // Player 2 (Blue): Arrow Keys (Directional), Enter / ShiftRight / NumpadEnter (Action)
    const p2Up = this.activeKeys.has('ArrowUp');
    const p2Down = this.activeKeys.has('ArrowDown');
    const p2Left = this.activeKeys.has('ArrowLeft');
    const p2Right = this.activeKeys.has('ArrowRight');
    const p2Action = this.activeKeys.has('Enter') || this.activeKeys.has('ShiftRight') || this.activeKeys.has('NumpadEnter');
    this.applyPlayerKeyInput(1, p2Up, p2Down, p2Left, p2Right, p2Action);

    // Player 3 (Green): I, J, K, L (Directional), U / O / Z (Action)
    const p3Up = this.activeKeys.has('KeyI');
    const p3Down = this.activeKeys.has('KeyK');
    const p3Left = this.activeKeys.has('KeyJ');
    const p3Right = this.activeKeys.has('KeyL');
    const p3Action = this.activeKeys.has('KeyU') || this.activeKeys.has('KeyO') || this.activeKeys.has('KeyZ');
    this.applyPlayerKeyInput(2, p3Up, p3Down, p3Left, p3Right, p3Action);

    // Player 4 (Yellow): Numpad 8, 4, 5, 6 or T, F, G, H (Directional), Numpad0 / Slash / B (Action)
    const p4Up = this.activeKeys.has('Numpad8') || this.activeKeys.has('KeyT');
    const p4Down = this.activeKeys.has('Numpad5') || this.activeKeys.has('Numpad2') || this.activeKeys.has('KeyG');
    const p4Left = this.activeKeys.has('Numpad4') || (this.activeKeys.has('KeyF') && !p1Left && !p1Action);
    const p4Right = this.activeKeys.has('Numpad6') || this.activeKeys.has('KeyH');
    const p4Action = this.activeKeys.has('Numpad0') || this.activeKeys.has('Slash') || this.activeKeys.has('KeyB');
    this.applyPlayerKeyInput(3, p4Up, p4Down, p4Left, p4Right, p4Action);
  }

  private applyPlayerKeyInput(
    pid: PlayerId,
    up: boolean,
    down: boolean,
    left: boolean,
    right: boolean,
    action: boolean
  ) {
    if (this.botOverrides[pid].pressed) return;

    const s = this.states[pid];
    this.keyboardSteer[pid] = (right ? 1 : 0) - (left ? 1 : 0);
    this.keyboardThrottle[pid] = (up ? 1 : 0) - (down ? 1 : 0);
    s.rawSteer = this.keyboardSteer[pid];
    s.rawThrottle = this.keyboardThrottle[pid];

    const anyDirection = up || down || left || right;

    if (this.controlMode === 'single_button') {
      const isButtonDown = action || anyDirection;
      if (isButtonDown && !s.pressed) {
        this.triggerAction(pid);
      } else if (!isButtonDown && s.pressed) {
        this.checkPlayerRelease(pid);
      }
    } else {
      if (up) s.justUp = true;
      if (down) s.justDown = true;
      if (left) s.justLeft = true;
      if (right) s.justRight = true;

      const wasAction = this.keyboardAction[pid];
      this.keyboardAction[pid] = action;

      if (action && !wasAction) {
        this.triggerAction(pid);
      } else if (!action && wasAction) {
        s.action = false;
        this.checkPlayerRelease(pid);
      }
    }
  }

  private isAnyPlayerKeyHeld(pid: PlayerId): boolean {
    if (pid === 0) {
      return this.activeKeys.has('KeyW') || this.activeKeys.has('KeyS') || this.activeKeys.has('KeyA') || this.activeKeys.has('KeyD') || this.activeKeys.has('Space') || this.activeKeys.has('KeyF') || this.activeKeys.has('KeyE');
    } else if (pid === 1) {
      return this.activeKeys.has('ArrowUp') || this.activeKeys.has('ArrowDown') || this.activeKeys.has('ArrowLeft') || this.activeKeys.has('ArrowRight') || this.activeKeys.has('Enter') || this.activeKeys.has('ShiftRight') || this.activeKeys.has('NumpadEnter');
    } else if (pid === 2) {
      return this.activeKeys.has('KeyI') || this.activeKeys.has('KeyK') || this.activeKeys.has('KeyJ') || this.activeKeys.has('KeyL') || this.activeKeys.has('KeyU') || this.activeKeys.has('KeyO') || this.activeKeys.has('KeyZ');
    } else {
      return this.activeKeys.has('Numpad8') || this.activeKeys.has('Numpad5') || this.activeKeys.has('Numpad2') || this.activeKeys.has('Numpad4') || this.activeKeys.has('Numpad6') || this.activeKeys.has('KeyT') || this.activeKeys.has('KeyG') || this.activeKeys.has('KeyH') || (this.activeKeys.has('KeyF') && !this.activeKeys.has('KeyW') && !this.activeKeys.has('KeyA')) || this.activeKeys.has('Numpad0') || this.activeKeys.has('Slash') || this.activeKeys.has('KeyB');
    }
  }

  private hasActiveHumanInput(pid: PlayerId): boolean {
    if (this.isAnyPlayerKeyHeld(pid)) return true;
    for (const track of this.activeTouches.values()) {
      if (track.pid === pid) return true;
    }
    if (this.gamepadAction[pid] || Math.abs(this.gamepadSteer[pid]) > 0.05 || Math.abs(this.gamepadThrottle[pid]) > 0.05) {
      return true;
    }
    return false;
  }

  private checkPlayerRelease(pid: PlayerId) {
    if (!this.hasActiveHumanInput(pid)) {
      this.release(pid);
    }
  }

  public triggerAction(pid: PlayerId) {
    const s = this.states[pid];
    s.action = true;
    s.justAction = true;
    this.actionBufferTimer[pid] = 0.12; // 120ms action buffer / coyote window
    this.press(pid);
    this.triggerHaptic(12);
  }

  public press(pid: PlayerId) {
    const s = this.states[pid];
    if (!s.pressed) {
      s.pressed = true;
      s.justPressed = true;
      this.pressBufferTimer[pid] = 0.12;
      s.pressStartTime = performance.now();
      s.holdDuration = 0;
    }
  }

  public release(pid: PlayerId) {
    const s = this.states[pid];
    if (s.pressed) {
      s.pressed = false;
      s.justReleased = true;
      s.holdDuration = (performance.now() - s.pressStartTime) / 1000;
      s.action = false;
      if (this.controlMode === 'single_button') {
        s.steer = 0;
        s.throttle = 0;
        s.rawSteer = 0;
        s.rawThrottle = 0;
      }
    }
  }

  public setBotInput(pid: PlayerId, pressed: boolean, steer: number = 0, throttle: number = 0, action: boolean = false) {
    this.botOverrides[pid] = { pressed, steer, throttle, action };
    const s = this.states[pid];
    if (pressed || action) {
      if (!s.pressed) this.press(pid);
    } else {
      if (s.pressed) this.release(pid);
    }
    s.steer = steer;
    s.throttle = throttle;
    s.rawSteer = Math.sign(steer);
    s.rawThrottle = Math.sign(throttle);
    s.action = action;
    if (action) {
      s.justAction = true;
      this.actionBufferTimer[pid] = 0.12;
    }
  }

  public setBotPressed(pid: PlayerId, pressed: boolean) {
    this.setBotInput(pid, pressed);
  }

  public setBotState(pid: PlayerId, pressed: boolean) {
    this.setBotInput(pid, pressed);
  }

  public triggerBotPress(pid: PlayerId) {
    this.triggerAction(pid);
  }

  public getBotInput(pid: PlayerId) {
    return { ...this.botOverrides[pid] };
  }

  public getInputState(pid: PlayerId): DetailedInputState {
    const s = { ...this.states[pid] };
    if (EconomyManager.getInstance().getEquippedBooster(pid) === 'booster_turbo') {
      s.steer = Math.max(-1.15, Math.min(1.15, s.steer * 1.15));
      s.throttle = Math.max(-1.15, Math.min(1.15, s.throttle * 1.15));
    }
    return s;
  }

  public isPressed(pid: PlayerId): boolean {
    return this.states[pid].pressed;
  }

  public isPlayerTetherDown(pid: PlayerId): boolean {
    // Explicit keyboard tether key checks (Only W for P1, Only Up Arrow for P2, I for P3, Numpad8/T for P4)
    switch (pid) {
      case 0:
        if (this.activeKeys.has('KeyW') || this.activeKeys.has('Space')) return true;
        // Do NOT allow A, S, D to tether
        if (this.activeKeys.has('KeyA') || this.activeKeys.has('KeyS') || this.activeKeys.has('KeyD')) return false;
        break;
      case 1:
        if (this.activeKeys.has('ArrowUp') || this.activeKeys.has('Enter') || this.activeKeys.has('ShiftRight')) return true;
        if (this.activeKeys.has('ArrowLeft') || this.activeKeys.has('ArrowDown') || this.activeKeys.has('ArrowRight')) return false;
        break;
      case 2:
        if (this.activeKeys.has('KeyI') || this.activeKeys.has('KeyU') || this.activeKeys.has('KeyO')) return true;
        if (this.activeKeys.has('KeyJ') || this.activeKeys.has('KeyK') || this.activeKeys.has('KeyL')) return false;
        break;
      case 3:
        if (this.activeKeys.has('Numpad8') || this.activeKeys.has('KeyT') || this.activeKeys.has('Numpad0')) return true;
        if (this.activeKeys.has('Numpad4') || this.activeKeys.has('Numpad5') || this.activeKeys.has('Numpad6')) return false;
        break;
    }

    // Gamepad button or stick up
    if (this.gamepadAction[pid] || this.gamepadThrottle[pid] > 0.4) return true;

    // Corner touch input on mobile / touch displays
    for (const track of this.activeTouches.values()) {
      if (track.pid === pid) return true;
    }

    return false;
  }

  public justPressed(pid: PlayerId): boolean {
    if (this.states[pid].justPressed) return true;
    if (this.pressBufferTimer[pid] > 0) {
      this.pressBufferTimer[pid] = 0;
      return true;
    }
    return false;
  }

  public justReleased(pid: PlayerId): boolean {
    return this.states[pid].justReleased;
  }

  public getSteer(pid: PlayerId): number {
    return this.states[pid].steer;
  }

  public getThrottle(pid: PlayerId): number {
    return this.states[pid].throttle;
  }

  public getRawSteer(pid: PlayerId): number {
    return this.states[pid].rawSteer;
  }

  public getRawThrottle(pid: PlayerId): number {
    return this.states[pid].rawThrottle;
  }

  public isActionPressed(pid: PlayerId): boolean {
    return this.states[pid].action;
  }

  public justAction(pid: PlayerId): boolean {
    if (this.states[pid].justAction) return true;
    if (this.actionBufferTimer[pid] > 0) {
      this.actionBufferTimer[pid] = 0;
      return true;
    }
    return false;
  }

  public consumeAction(pid: PlayerId): void {
    this.states[pid].justAction = false;
    this.states[pid].justPressed = false;
    this.actionBufferTimer[pid] = 0;
    this.pressBufferTimer[pid] = 0;
  }

  public justUp(pid: PlayerId): boolean {
    return this.states[pid].justUp;
  }

  public justDown(pid: PlayerId): boolean {
    return this.states[pid].justDown;
  }

  public justLeft(pid: PlayerId): boolean {
    return this.states[pid].justLeft;
  }

  public justRight(pid: PlayerId): boolean {
    return this.states[pid].justRight;
  }

  public getHoldDuration(pid: PlayerId): number {
    if (!this.states[pid].pressed) return this.states[pid].holdDuration;
    return (performance.now() - this.states[pid].pressStartTime) / 1000;
  }

  public isRawKeyPressed(code: string): boolean {
    return this.activeKeys.has(code);
  }

  public addRipple(x: number, y: number, color: string) {
    this.ripples.push({
      x,
      y,
      radius: 14,
      alpha: 0.95,
      color
    });
  }

  // Poll standard HTML5 Gamepad API
  private pollGamepads() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    try {
      const gamepads = navigator.getGamepads();
      if (!gamepads) return;

      for (let i = 0; i < gamepads.length && i < 4; i++) {
        const gp = gamepads[i];
        if (!gp || !gp.connected) continue;
        const pid = i as PlayerId;
        if (this.botOverrides[pid].pressed) continue;

        // Analog stick with 0.12 deadzone
        const stickDeadzone = 0.12;
        let stickX = Math.abs(gp.axes[0] ?? 0) > stickDeadzone ? gp.axes[0] : 0;
        let stickY = Math.abs(gp.axes[1] ?? 0) > stickDeadzone ? gp.axes[1] : 0;

        // D-Pad buttons
        const dUp = gp.buttons[12]?.pressed ?? false;
        const dDown = gp.buttons[13]?.pressed ?? false;
        const dLeft = gp.buttons[14]?.pressed ?? false;
        const dRight = gp.buttons[15]?.pressed ?? false;

        if (dLeft) stickX = -1;
        if (dRight) stickX = 1;
        if (dUp) stickY = -1;
        if (dDown) stickY = 1;

        this.gamepadSteer[pid] = stickX;
        this.gamepadThrottle[pid] = -stickY; // invert stick Y so up is positive throttle

        // Action buttons: A / Cross (0), B / Circle (1), X / Square (2), Y / Triangle (3), RB (5), RT (7)
        const actionPressed = (gp.buttons[0]?.pressed || gp.buttons[1]?.pressed || gp.buttons[2]?.pressed || gp.buttons[3]?.pressed || gp.buttons[5]?.pressed || gp.buttons[7]?.pressed) ?? false;
        const wasAction = this.gamepadAction[pid];
        this.gamepadAction[pid] = actionPressed;

        if (actionPressed && !wasAction) {
          this.triggerAction(pid);
        } else if (!actionPressed && wasAction) {
          this.checkPlayerRelease(pid);
        }
      }
    } catch (_) {
      // Gracefully handle browser gamepad permission exceptions
    }
  }

  public update(dt: number) {
    this.pollGamepads();

    // Responsive exponential smoothing (~40ms rise time, silky smooth without lag)
    const smoothingFactor = 1 - Math.exp(-24 * dt);

    for (let p = 0; p < 4; p++) {
      const pid = p as PlayerId;
      const s = this.states[pid];

      // Decay buffers
      if (this.actionBufferTimer[pid] > 0) {
        this.actionBufferTimer[pid] = Math.max(0, this.actionBufferTimer[pid] - dt);
      }
      if (this.pressBufferTimer[pid] > 0) {
        this.pressBufferTimer[pid] = Math.max(0, this.pressBufferTimer[pid] - dt);
      }

      if (this.botOverrides[pid].pressed) {
        s.steer = this.botOverrides[pid].steer;
        s.throttle = this.botOverrides[pid].throttle;
        s.rawSteer = Math.sign(s.steer);
        s.rawThrottle = Math.sign(s.throttle);
        continue;
      }

      // Merge inputs from keyboard, touch joystick, and gamepad
      let targetSteer = this.keyboardSteer[pid];
      let targetThrottle = this.keyboardThrottle[pid];

      // Analog touch joystick takes precedence if actively dragged
      if (this.touchSteer[pid] !== 0 || this.touchThrottle[pid] !== 0) {
        targetSteer = this.touchSteer[pid];
        targetThrottle = this.touchThrottle[pid];
      }

      // Gamepad analog input takes precedence if active
      if (this.gamepadSteer[pid] !== 0 || this.gamepadThrottle[pid] !== 0) {
        targetSteer = this.gamepadSteer[pid];
        targetThrottle = this.gamepadThrottle[pid];
      }

      // Clamp target axes
      targetSteer = Math.max(-1, Math.min(1, targetSteer));
      targetThrottle = Math.max(-1, Math.min(1, targetThrottle));

      s.rawSteer = Math.round(targetSteer);
      s.rawThrottle = Math.round(targetThrottle);

      // Smooth interpolation
      s.steer += (targetSteer - s.steer) * smoothingFactor;
      s.throttle += (targetThrottle - s.throttle) * smoothingFactor;

      // Snap micro-residuals to zero to prevent creep
      if (Math.abs(s.steer) < 0.005 && targetSteer === 0) s.steer = 0;
      if (Math.abs(s.throttle) < 0.005 && targetThrottle === 0) s.throttle = 0;

      // Fade out virtual joystick when inactive
      const joy = this.joysticks[pid];
      if (!joy.active && joy.opacity > 0) {
        joy.opacity = Math.max(0, joy.opacity - dt * 4.5);
      }
    }

    // Update ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += dt * 150;
      r.alpha -= dt * 2.4;
      if (r.alpha <= 0) {
        this.ripples.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    this.renderJoysticks(ctx);
    this.renderRipples(ctx);
  }

  public renderRipples(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const r of this.ripples) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  public renderJoysticks(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (let p = 0; p < 4; p++) {
      const joy = this.joysticks[p as PlayerId];
      if (joy.opacity <= 0.01) continue;

      const color = this.playerColors[p];
      const alpha = joy.opacity;

      // Base ring
      ctx.beginPath();
      ctx.arc(joy.originX, joy.originY, 44, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha * 0.45;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Subtle base background glow
      ctx.beginPath();
      ctx.arc(joy.originX, joy.originY, 44, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.08;
      ctx.fill();

      // Origin center pip
      ctx.beginPath();
      ctx.arc(joy.originX, joy.originY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = alpha * 0.55;
      ctx.fill();

      // Knob position calculation with clamping
      const maxRadius = 44;
      const dx = joy.currentX - joy.originX;
      const dy = joy.currentY - joy.originY;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      const knobX = joy.originX + Math.cos(angle) * clampedDist;
      const knobY = joy.originY + Math.sin(angle) * clampedDist;

      // Connecting elastic spring
      if (clampedDist > 4) {
        ctx.beginPath();
        ctx.moveTo(joy.originX, joy.originY);
        ctx.lineTo(knobX, knobY);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * 0.4;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Full-tilt energy aura when pushed near edge
      if (clampedDist >= maxRadius * 0.75) {
        ctx.beginPath();
        ctx.arc(knobX, knobY, 25, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * 0.45;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Dynamic thumb knob
      ctx.beginPath();
      ctx.arc(knobX, knobY, 20, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.fill();

      // White outline rim
      ctx.beginPath();
      ctx.arc(knobX, knobY, 20, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.globalAlpha = alpha * 0.75;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Directional arrow on knob when dragging
      if (clampedDist > 12) {
        ctx.save();
        ctx.translate(knobX, knobY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(2, -5);
        ctx.lineTo(3.5, 0);
        ctx.lineTo(2, 5);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = alpha * 0.9;
        ctx.fill();
        ctx.restore();
      }

      // Specular highlight dot
      ctx.beginPath();
      ctx.arc(knobX - 4, knobY - 4, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = alpha * 0.85;
      ctx.fill();
    }
    ctx.restore();
  }

  public endFrame() {
    for (let i = 0; i < 4; i++) {
      const s = this.states[i as PlayerId];
      s.justPressed = false;
      s.justReleased = false;
      s.justAction = false;
      s.justUp = false;
      s.justDown = false;
      s.justLeft = false;
      s.justRight = false;
    }
  }

  public resetAll() {
    for (let i = 0; i < 4; i++) {
      const s = this.states[i as PlayerId];
      s.pressed = false;
      s.justPressed = false;
      s.justReleased = false;
      s.holdDuration = 0;
      s.steer = 0;
      s.throttle = 0;
      s.rawSteer = 0;
      s.rawThrottle = 0;
      s.action = false;
      s.justAction = false;
      s.justUp = false;
      s.justDown = false;
      s.justLeft = false;
      s.justRight = false;

      this.botOverrides[i as PlayerId] = { pressed: false, steer: 0, throttle: 0, action: false };
      this.keyboardSteer[i as PlayerId] = 0;
      this.keyboardThrottle[i as PlayerId] = 0;
      this.keyboardAction[i as PlayerId] = false;
      this.touchSteer[i as PlayerId] = 0;
      this.touchThrottle[i as PlayerId] = 0;
      this.gamepadSteer[i as PlayerId] = 0;
      this.gamepadThrottle[i as PlayerId] = 0;
      this.gamepadAction[i as PlayerId] = false;
      this.actionBufferTimer[i as PlayerId] = 0;
      this.pressBufferTimer[i as PlayerId] = 0;
      this.joysticks[i as PlayerId].active = false;
      this.joysticks[i as PlayerId].opacity = 0;
    }
    this.activeTouches.clear();
    this.activeKeys.clear();
    this.ripples = [];
  }
}
