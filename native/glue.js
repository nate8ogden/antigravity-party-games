// Retro Arcade Studio - native (QuickJS) browser-API glue.
// Runs the REAL src/engine + src/games code on a native C canvas.
// `__nc` is the native canvas/host object provided by the C core.

var globalThis_ = typeof globalThis !== 'undefined' ? globalThis : this;
globalThis_.window = globalThis_;
globalThis_.self = globalThis_;

const __perf = { now: () => __nc.now() };
globalThis_.performance = __perf;
globalThis_.requestAnimationFrame = () => 0;
globalThis_.cancelAnimationFrame = () => {};
globalThis_.setTimeout = () => 0;
globalThis_.clearTimeout = () => {};
globalThis_.setInterval = () => 0;
globalThis_.clearInterval = () => {};
globalThis_.fetch = () => Promise.reject(new Error('offline'));
globalThis_.addEventListener = () => {};
globalThis_.removeEventListener = () => {};
globalThis_.innerWidth = 960;
globalThis_.innerHeight = 540;
globalThis_.devicePixelRatio = 1;
globalThis_.getComputedStyle = () => ({});
globalThis_.URLSearchParams = class { constructor() {} get() { return null; } has() { return false; } };

const __store = {};
globalThis_.localStorage = {
  getItem: (k) => (k in __store ? __store[k] : null),
  setItem: (k, v) => { __store[k] = String(v); },
  removeItem: (k) => { delete __store[k]; }
};

globalThis_.navigator = {
  userAgent: 'RetroArcadeStudio-Native',
  getGamepads() {
    const bits = __nc.pad();
    const mk = (on) => ({ pressed: on, touched: on, value: on ? 1 : 0 });
    const b = (i) => (bits & (1 << i)) !== 0;
    // RetroPad ids: B0 Y1 SEL2 START3 UP4 DOWN5 LEFT6 RIGHT7 A8 X9 L10 R11 L2 12 R2 13 L3 14 R3 15
    const buttons = [
      mk(b(0)), mk(b(8)), mk(b(1)), mk(b(9)), mk(b(10)), mk(b(11)), mk(b(12)), mk(b(13)),
      mk(b(2)), mk(b(3)), mk(b(14)), mk(b(15)), mk(b(4)), mk(b(5)), mk(b(6)), mk(b(7)), mk(false)
    ];
    return [{ id: 'RetroPad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons }];
  }
};

// ---- Canvas 2D context: the native object already implements the drawing API ----
const __ctx = __nc.ctx;
__ctx.shadowBlur = 0; __ctx.shadowColor = 'rgba(0,0,0,0)'; __ctx.shadowOffsetX = 0; __ctx.shadowOffsetY = 0;
__ctx.lineJoin = 'miter'; __ctx.miterLimit = 10; __ctx.imageSmoothingEnabled = false;
__ctx.globalCompositeOperation = 'source-over';
__ctx.strokeText = () => {};
__ctx.getLineDash = () => [];
__ctx.setTransform = () => {}; __ctx.resetTransform = () => {}; __ctx.drawImage = () => {};
__ctx.createLinearGradient = (x0, y0, x1, y1) => {
  const id = __nc.newLinear(x0, y0, x1, y1);
  return { id, addColorStop: (o, c) => __nc.gradStop(id, o, String(c)) };
};
__ctx.createRadialGradient = (x0, y0, r0, x1, y1, r1) => {
  const id = __nc.newRadial(x0, y0, r0, x1, y1, r1);
  return { id, addColorStop: (o, c) => __nc.gradStop(id, o, String(c)) };
};

const __bufferCanvas = { width: 960, height: 540, getContext: () => __ctx, style: {} };
const __dummyEl = new Proxy(function () {}, {
  get: (t, p) => (p === 'style' || p === 'classList' || p === 'dataset' ? __dummyEl : p === 'textContent' || p === 'innerHTML' || p === 'value' ? '' : p === Symbol.toPrimitive ? () => '' : __dummyEl),
  set: () => true,
  apply: () => __dummyEl
});
globalThis_.document = {
  body: null,
  createElement: () => __bufferCanvas,
  getElementById: () => null,
  querySelector: () => __dummyEl, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  documentElement: { style: {} }
};

// ---- Engine stubs (CRT shader / touch overlay / audio are not needed natively) ----
class CRTOverlay { constructor() {} render() {} resize() {} destroy() {} }
class TouchControls { constructor() {} destroy() {} setVisible() {} }
class AudioSynth {
  constructor() {
    return new Proxy(this, { get: (t, p) => (p in t ? t[p] : (() => {})) });
  }
}
