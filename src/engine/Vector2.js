/**
 * Vector2.js
 * Zero-dependency 2D vector mathematics library for Retro Arcade Studio physics,
 * steering, momentum, and trajectory calculations.
 */
import { wasmCore } from './WasmCore.js';

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  clone() {
    return new Vector2(this.x, this.y);
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  addScaled(v, scale) {
    this.x += v.x * scale;
    this.y += v.y * scale;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  scale(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  cross(v) {
    return this.x * v.y - this.y * v.x;
  }

  lenSq() {
    return this.x * this.x + this.y * this.y;
  }

  len() {
    return Math.hypot(this.x, this.y);
  }

  normalize() {
    const l = this.len();
    if (l > 1e-7) {
      this.x /= l;
      this.y /= l;
    } else {
      this.x = 0;
      this.y = 0;
    }
    return this;
  }

  limit(max) {
    const lSq = this.lenSq();
    if (lSq > max * max) {
      this.normalize().scale(max);
    }
    return this;
  }

  distSq(v) {
    return wasmCore.distSq(this.x, this.y, v.x, v.y);
  }

  dist(v) {
    return Math.sqrt(wasmCore.distSq(this.x, this.y, v.x, v.y));
  }

  angle() {
    return Math.atan2(this.y, this.x);
  }

  rotate(radians) {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const nx = this.x * c - this.y * s;
    const ny = this.x * s + this.y * c;
    this.x = nx;
    this.y = ny;
    return this;
  }

  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    return this;
  }

  perp() {
    const nx = -this.y;
    this.y = this.x;
    this.x = nx;
    return this;
  }

   reflect(normal) {
    const d = 2 * this.dot(normal);
    this.x -= d * normal.x;
    this.y -= d * normal.y;
    return this;
  }

  static add(a, b) {
    return new Vector2(a.x + b.x, a.y + b.y);
  }

  static sub(a, b) {
    return new Vector2(a.x - b.x, a.y - b.y);
  }

  static scale(v, s) {
    return new Vector2(v.x * s, v.y * s);
  }

  static fromAngle(radians, length = 1) {
    return new Vector2(Math.cos(radians) * length, Math.sin(radians) * length);
  }

  static dist(a, b) {
    return Math.sqrt(wasmCore.distSq(a.x, a.y, b.x, b.y));
  }

  static lerp(a, b, t) {
    return new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  }

  static cubicBezier(p0, p1, p2, p3, t) {
    const pt = wasmCore.cubicBezier(p0, p1, p2, p3, t);
    return new Vector2(pt.x, pt.y);
  }
}

export default Vector2;
