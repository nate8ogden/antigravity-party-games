/**
 * TouchControls.js
 * Responsive Multi-Device Touch & Arcade Control Deck for Desktop, Tablet, and Mobile Phones:
 * - Supports 3 device form-factor profiles: 'desktop', 'tablet', and 'phone'
 * - Left Side: Virtual 4-Way / 8-Way D-Pad with 15px directional deadzone threshold & multi-touch tracking
 * - Right Side: Dual action buttons (A & B) with thumb-slide support, glowing neon borders, and navigator.vibrate(15) haptics
 * - Automatic activation when ontouchstart / coarse pointer / mobile/tablet viewport is detected
 */
export class TouchControls {
  constructor(inputManager, container = document.body) {
    this.input = inputManager;
    this.container = container;
    this.deadzone = 15; // 15px threshold per specification

    this.deviceMode = this.detectDeviceMode(); // 'desktop' | 'tablet' | 'phone'
    this.isTouchDevice =
      'ontouchstart' in window ||
      (navigator && navigator.maxTouchPoints > 0) ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) ||
      this.deviceMode !== 'desktop';

    this.forceVisible = false;
    this.activeDpadTouchId = null;
    this.onResizeCallback = null;

    this.buildDOM();
    this.bindEvents();
    this.applyDeviceModeClasses();
    this.updateVisibility();
  }

  detectDeviceMode() {
    if (typeof window === 'undefined') return 'desktop';
    try {
      const params = new URLSearchParams(window.location.search || '');
      const forced = (params.get('device') || '').toLowerCase();
      if (forced === 'phone' || forced === 'mobile') return 'phone';
      if (forced === 'tablet' || forced === 'ipad') return 'tablet';
      if (forced === 'desktop' || forced === 'computer') return 'desktop';
    } catch (_) {}

    const w = window.innerWidth || 960;
    const h = window.innerHeight || 540;
    const minDim = Math.min(w, h);
    const maxDim = Math.max(w, h);
    const coarse =
      'ontouchstart' in window ||
      (navigator && navigator.maxTouchPoints > 0) ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);

    if (minDim <= 520 || (coarse && maxDim <= 930 && minDim <= 500)) {
      return 'phone';
    }
    if ((coarse && maxDim <= 1366) || (w >= 521 && w <= 1024 && coarse)) {
      return 'tablet';
    }
    if (w <= 640) {
      return 'phone';
    }
    if (w <= 1024 && h >= 600 && coarse) {
      return 'tablet';
    }
    return 'desktop';
  }

  setDeviceMode(mode) {
    const normalized = String(mode || '').toLowerCase();
    if (normalized === 'phone' || normalized === 'mobile') {
      this.deviceMode = 'phone';
      this.forceVisible = true;
    } else if (normalized === 'tablet' || normalized === 'ipad') {
      this.deviceMode = 'tablet';
      this.forceVisible = true;
    } else if (normalized === 'desktop' || normalized === 'computer') {
      this.deviceMode = 'desktop';
      this.forceVisible = false;
    } else {
      this.deviceMode = this.detectDeviceMode();
      this.forceVisible = this.deviceMode !== 'desktop';
    }
    this.applyDeviceModeClasses();
    this.updateVisibility();
    if (typeof this.onResizeCallback === 'function') {
      this.onResizeCallback();
    }
    return this.deviceMode;
  }

  applyDeviceModeClasses() {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.classList.remove('device-desktop', 'device-tablet', 'device-phone');
    document.body.classList.add(`device-${this.deviceMode}`);
    document.body.dataset.deviceMode = this.deviceMode;
  }

  triggerHaptic(ms = 15) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  }

  buildDOM() {
    const existing = document.getElementById('arcade-touch-overlay');
    if (existing) {
      existing.remove();
    }

    this.root = document.createElement('div');
    this.root.id = 'arcade-touch-overlay';
    this.root.className = 'arcade-touch-overlay';
    this.root.setAttribute('aria-label', 'Touch Controls Overlay');

    this.root.innerHTML = `
      <div class="touch-left-zone">
        <div class="virtual-dpad" id="virtual-dpad">
          <div class="dpad-ring"></div>
          <div class="dpad-arm dpad-up" data-dir="up"><span>▲</span></div>
          <div class="dpad-arm dpad-down" data-dir="down"><span>▼</span></div>
          <div class="dpad-arm dpad-left" data-dir="left"><span>◀</span></div>
          <div class="dpad-arm dpad-right" data-dir="right"><span>▶</span></div>
          <div class="dpad-Stick" id="dpad-thumb"></div>
        </div>
        <div class="touch-zone-caption">4-WAY D-PAD (15PX DEADZONE)</div>
      </div>

      <div class="touch-center-zone">
        <button type="button" class="touch-utility-btn" data-action="start">START / A</button>
        <button type="button" class="touch-utility-btn" data-action="pause">PAUSE</button>
        <button type="button" class="touch-utility-btn" data-action="menu">LOBBY</button>
      </div>

      <div class="touch-right-zone">
        <div class="action-buttons-cluster" id="action-buttons-cluster">
          <button type="button" class="virtual-action-btn btn-action-b" id="touch-btn-b" data-action="actionB">
            <span class="btn-main-label">B</span>
            <span class="btn-sub-label">ALT / DIG-R / SLAP</span>
          </button>
          <button type="button" class="virtual-action-btn btn-action-a" id="touch-btn-a" data-action="actionA">
            <span class="btn-main-label">A</span>
            <span class="btn-sub-label">ACT / DIG-L / JUMP</span>
          </button>
        </div>
        <div class="touch-zone-caption">NEON ACTION TRIGGERS</div>
      </div>
    `;

    this.container.appendChild(this.root);
    this.dpadEl = this.root.querySelector('#virtual-dpad');
    this.thumbEl = this.root.querySelector('#dpad-thumb');
    this.clusterEl = this.root.querySelector('#action-buttons-cluster');
    this.btnA = this.root.querySelector('#touch-btn-a');
    this.btnB = this.root.querySelector('#touch-btn-b');
    this.dirEls = {
      up: this.root.querySelector('.dpad-up'),
      down: this.root.querySelector('.dpad-down'),
      left: this.root.querySelector('.dpad-left'),
      right: this.root.querySelector('.dpad-right')
    };
  }

  bindEvents() {
    // Auto-show on any touchstart anywhere on window
    this._onFirstTouch = () => {
      if (!this.isTouchDevice) {
        this.isTouchDevice = true;
        if (this.deviceMode === 'desktop') {
          const w = window.innerWidth || 960;
          this.deviceMode = w <= 640 ? 'phone' : 'tablet';
          this.applyDeviceModeClasses();
        }
        this.updateVisibility();
        if (typeof this.onResizeCallback === 'function') {
          this.onResizeCallback();
        }
      }
    };
    window.addEventListener('touchstart', this._onFirstTouch, { passive: true });

    // Re-evaluate responsive layout on viewport resize if not manually locked
    window.addEventListener('resize', () => {
      if (!this.forceVisible && this.isTouchDevice) {
        const detected = this.detectDeviceMode();
        if (detected !== 'desktop' && detected !== this.deviceMode) {
          this.deviceMode = detected;
          this.applyDeviceModeClasses();
        }
      }
    });

    // D-Pad touch & pointer handling with 15px deadzone
    const handleDpadMove = (clientX, clientY) => {
      const rect = this.dpadEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const maxRadius = Math.max(24, rect.width * 0.36);

      let clampedX = dx;
      let clampedY = dy;
      if (dist > maxRadius && dist > 0) {
        clampedX = (dx / dist) * maxRadius;
        clampedY = (dy / dist) * maxRadius;
      }

      if (this.thumbEl) {
        this.thumbEl.style.transform = `translate(calc(-50% + ${clampedX.toFixed(1)}px), calc(-50% + ${clampedY.toFixed(1)}px))`;
      }

      const prevUp = this.input.touchState.up;
      const prevDown = this.input.touchState.down;
      const prevLeft = this.input.touchState.left;
      const prevRight = this.input.touchState.right;

      if (dist < this.deadzone) {
        this.input.setTouchDirection(false, false, false, false, 0, 0);
      } else {
        const up = dy < -this.deadzone;
        const down = dy > this.deadzone;
        const left = dx < -this.deadzone;
        const right = dx > this.deadzone;
        const normX = Math.max(-1, Math.min(1, dx / maxRadius));
        const normY = Math.max(-1, Math.min(1, dy / maxRadius));
        this.input.setTouchDirection(up, down, left, right, normX, normY);

        if (up !== prevUp || down !== prevDown || left !== prevLeft || right !== prevRight) {
          this.triggerHaptic(15);
        }
      }

      this.syncDpadVisuals();
    };

    const resetDpad = () => {
      this.activeDpadTouchId = null;
      if (this.thumbEl) {
        this.thumbEl.style.transform = 'translate(-50%, -50%)';
      }
      this.input.setTouchDirection(false, false, false, false, 0, 0);
      this.syncDpadVisuals();
    };

    this.dpadEl.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const touch = (e.targetTouches && e.targetTouches[0]) || e.changedTouches[0];
        if (!touch) return;
        this.activeDpadTouchId = touch.identifier;
        this.triggerHaptic(15);
        handleDpadMove(touch.clientX, touch.clientY);
      },
      { passive: false }
    );

    this.dpadEl.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        const touches = e.targetTouches && e.targetTouches.length > 0 ? e.targetTouches : e.changedTouches;
        for (let i = 0; i < touches.length; i++) {
          const t = touches[i];
          if (this.activeDpadTouchId === null || t.identifier === this.activeDpadTouchId) {
            handleDpadMove(t.clientX, t.clientY);
            break;
          }
        }
      },
      { passive: false }
    );

    this.dpadEl.addEventListener('touchend', (e) => {
      if (e.targetTouches && e.targetTouches.length === 0) {
        resetDpad();
        return;
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.activeDpadTouchId) {
          resetDpad();
          break;
        }
      }
    });
    this.dpadEl.addEventListener('touchcancel', resetDpad);

    // Support mouse drag on D-Pad when testing touch UI on desktop
    let mouseDpadDown = false;
    this.dpadEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      mouseDpadDown = true;
      this.triggerHaptic(15);
      handleDpadMove(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      if (mouseDpadDown) {
        handleDpadMove(e.clientX, e.clientY);
      }
    });
    window.addEventListener('mouseup', () => {
      if (mouseDpadDown) {
        mouseDpadDown = false;
        resetDpad();
      }
    });

    // Bind Action A and Action B buttons with independent multi-touch support
    const bindActionButton = (btn, actionKey) => {
      const press = (e) => {
        e.preventDefault();
        btn.classList.add('active');
        this.triggerHaptic(15);
        this.input.setTouchAction(actionKey, true);
      };
      const release = (e) => {
        e.preventDefault();
        btn.classList.remove('active');
        this.input.setTouchAction(actionKey, false);
      };

      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    };

    bindActionButton(this.btnA, 'actionA');
    bindActionButton(this.btnB, 'actionB');

    // Utility buttons (Start / Pause / Lobby)
    this.root.querySelectorAll('.touch-utility-btn').forEach((btn) => {
      const act = btn.getAttribute('data-action');
      const trigger = (e) => {
        e.preventDefault();
        this.triggerHaptic(15);
        if (act === 'start') {
          this.input.setTouchAction('actionA', true);
          setTimeout(() => this.input.setTouchAction('actionA', false), 90);
        } else if (act === 'pause') {
          this.input.triggerPause();
        } else if (act === 'menu') {
          this.input.triggerMenuReturn();
        }
      };
      btn.addEventListener('touchstart', trigger, { passive: false });
      btn.addEventListener('click', trigger);
    });
  }

  syncDpadVisuals() {
    const s = this.input.touchState;
    if (this.dirEls.up) this.dirEls.up.classList.toggle('active', !!s.up);
    if (this.dirEls.down) this.dirEls.down.classList.toggle('active', !!s.down);
    if (this.dirEls.left) this.dirEls.left.classList.toggle('active', !!s.left);
    if (this.dirEls.right) this.dirEls.right.classList.toggle('active', !!s.right);
  }

  setForceVisible(visible) {
    this.forceVisible = !!visible;
    this.updateVisibility();
    if (typeof this.onResizeCallback === 'function') {
      this.onResizeCallback();
    }
  }

  toggleForceVisible() {
    this.forceVisible = !this.forceVisible;
    if (this.forceVisible && this.deviceMode === 'desktop') {
      this.deviceMode = (window.innerWidth || 960) <= 640 ? 'phone' : 'tablet';
    } else if (!this.forceVisible && !this.isTouchDevice) {
      this.deviceMode = 'desktop';
    }
    this.applyDeviceModeClasses();
    this.updateVisibility();
    if (typeof this.onResizeCallback === 'function') {
      this.onResizeCallback();
    }
    return this.isVisible();
  }

  isVisible() {
    return this.isTouchDevice || this.forceVisible || this.deviceMode !== 'desktop';
  }

  updateVisibility() {
    if (!this.root) return;
    const vis = this.isVisible();
    this.root.classList.toggle('visible', vis);
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('touch-overlay-active', vis);
    }
  }
}

export default TouchControls;
