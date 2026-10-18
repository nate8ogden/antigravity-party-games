/**
 * WebAssembly (WASM) Native Physics, Elastic Collision & Particle Accelerator
 *
 * Architectural Evaluation:
 * - Rendering calls (Canvas2D ctx.arc / ctx.fillRect) are host-bound in browsers; moving draw calls
 *   to WASM adds FFI marshaling overhead without speeding up rasterization.
 * - Hot numeric loops (batch particle integration, 2D rigid-body elastic collisions, spatial
 *   distance checks, and AI raycast lookahead) benefit significantly from WASM's linear memory
 *   (zero GC pressure, contiguous Float32Array layout, deterministic IEEE-754 FPU execution).
 *
 * This module compiles an inline IEEE WebAssembly binary synchronously into a native
 * WebAssembly.Instance sharing a 64KB linear memory buffer with TypeScript.
 */

export interface ElasticBody2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass?: number;
}

export interface WasmBenchmarkResult {
  wasmActive: boolean;
  wasmTimeMs: number;
  jsTimeMs: number;
  speedupFactor: number;
  particlesProcessed: number;
  collisionsSolved: number;
}

// Helper to encode unsigned LEB128 integers for WASM binary format
function uleb128(val: number): number[] {
  const bytes: number[] = [];
  do {
    let byte = val & 0x7f;
    val >>>= 7;
    if (val !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (val !== 0);
  return bytes;
}

// Helper to encode signed LEB128 integers for WASM binary format
function sleb128(val: number): number[] {
  const bytes: number[] = [];
  let more = true;
  while (more) {
    let byte = val & 0x7f;
    val >>= 7;
    if ((val === 0 && (byte & 0x40) === 0) || (val === -1 && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    bytes.push(byte);
  }
  return bytes;
}

function section(id: number, payload: number[]): number[] {
  return [id, ...uleb128(payload.length), ...payload];
}

function encodeString(str: string): number[] {
  const bytes = Array.from(str).map((c) => c.charCodeAt(0));
  return [...uleb128(bytes.length), ...bytes];
}

function f32Const(val: number): number[] {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, val, true);
  return [0x43, ...new Uint8Array(buf)];
}

/**
 * Builds the compact binary WebAssembly module exporting:
 * - memory (1 page = 64KB shared Float32Array linear memory)
 * - distSq(x1: f32, y1: f32, x2: f32, y2: f32) -> f32
 * - stepParticleBatch(baseByteOffset: i32, count: i32, dt60: f32, drag: f32, dt: f32) -> i32
 */
function buildWasmBinary(): Uint8Array {
  const F32 = 0x7d;
  const I32 = 0x7f;

  // Type section:
  // Type 0: (f32, f32, f32, f32) -> f32   [distSq]
  // Type 1: (i32, i32, f32, f32, f32) -> i32 [stepParticleBatch]
  const typeSection = section(1, [
    2, // 2 function types
    0x60, 4, F32, F32, F32, F32, 1, F32,
    0x60, 5, I32, I32, F32, F32, F32, 1, I32
  ]);

  // Function section: 2 functions referencing Type 0 and Type 1
  const funcSection = section(3, [2, 0, 1]);

  // Memory section: 1 memory with min 1 page (64KB), max 4 pages (256KB)
  const memSection = section(5, [1, 0x01, 1, 4]);

  // Export section: memory, distSq, stepParticleBatch
  const exportSection = section(7, [
    3,
    ...encodeString('memory'), 0x02, 0,
    ...encodeString('distSq'), 0x00, 0,
    ...encodeString('stepParticleBatch'), 0x00, 1
  ]);

  // Function 0 body: distSq(x1, y1, x2, y2) -> (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1)
  // Locals: 2 f32 (local 4 = dx, local 5 = dy)
  const func0Code = [
    1, 2, F32, // 2 locals of type f32
    0x20, 2, 0x20, 0, 0x93, 0x22, 4, // local.get 2 (x2), local.get 0 (x1), f32.sub, local.tee 4 (dx)
    0x20, 4, 0x94,                   // local.get 4 (dx), f32.mul
    0x20, 3, 0x20, 1, 0x93, 0x22, 5, // local.get 3 (y2), local.get 1 (y1), f32.sub, local.tee 5 (dy)
    0x20, 5, 0x94,                   // local.get 5 (dy), f32.mul
    0x92,                            // f32.add
    0x0b                             // end
  ];

  // Function 1 body: stepParticleBatch(ptr: i32, count: i32, dt60: f32, drag: f32, dt: f32) -> i32
  // Each particle in linear memory is 6 floats (24 bytes):
  //   offset + 0: x
  //   offset + 4: y
  //   offset + 8: vx
  //   offset + 12: vy
  //   offset + 16: life
  //   offset + 20: maxLife
  // Locals: local 5 = i (i32), local 6 = addr (i32), local 7 = vx (f32), local 8 = vy (f32)
  const func1Code = [
    2, 2, I32, 2, F32, // 2 i32 locals (5, 6), 2 f32 locals (7, 8)
    0x41, 0, 0x21, 5,  // i32.const 0 -> local.set 5 (i = 0)
    0x02, 0x40,        // block $break
      0x03, 0x40,      // loop $top
        // if (i >= count) br $break
        0x20, 5, 0x20, 1, 0x4e, 0x0d, 1,
        // addr = ptr + i * 24
        0x20, 0, 0x20, 5, 0x41, ...sleb128(24), 0x6c, 0x6a, 0x21, 6,
        // vx = mem[addr + 8] * drag; mem[addr + 8] = vx
        0x20, 6,
        0x20, 6, 0x2a, 2, 8, 0x20, 3, 0x94, 0x22, 7,
        0x38, 2, 8,
        // vy = mem[addr + 12] * drag; mem[addr + 12] = vy
        0x20, 6,
        0x20, 6, 0x2a, 2, 12, 0x20, 3, 0x94, 0x22, 8,
        0x38, 2, 12,
        // mem[addr + 0] = mem[addr + 0] + vx * dt60
        0x20, 6,
        0x20, 6, 0x2a, 2, 0, 0x20, 7, 0x20, 2, 0x94, 0x92,
        0x38, 2, 0,
        // mem[addr + 4] = mem[addr + 4] + vy * dt60
        0x20, 6,
        0x20, 6, 0x2a, 2, 4, 0x20, 8, 0x20, 2, 0x94, 0x92,
        0x38, 2, 4,
        // mem[addr + 16] = mem[addr + 16] - dt (life -= dt)
        0x20, 6,
        0x20, 6, 0x2a, 2, 16, 0x20, 4, 0x93,
        0x38, 2, 16,
        // i = i + 1
        0x20, 5, 0x41, 1, 0x6a, 0x21, 5,
        0x0c, 0,       // br $top
      0x0b,            // end loop
    0x0b,              // end block
    0x20, 5,           // return i (processed count)
    0x0b               // end function
  ];

  const codeSection = section(10, [
    2,
    ...uleb128(func0Code.length), ...func0Code,
    ...uleb128(func1Code.length), ...func1Code
  ]);

  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // "\0asm" magic
    0x01, 0x00, 0x00, 0x00, // version 1
    ...typeSection,
    ...funcSection,
    ...memSection,
    ...exportSection,
    ...codeSection
  ]);
}

export class WasmPhysicsEngine {
  private static instance: WasmPhysicsEngine;
  public readonly isWasmSupported: boolean = false;
  private wasmExports: {
    memory: WebAssembly.Memory;
    distSq: (x1: number, y1: number, x2: number, y2: number) => number;
    stepParticleBatch: (ptr: number, count: number, dt60: number, drag: number, dt: number) => number;
  } | null = null;
  private f32View: Float32Array | null = null;

  public totalParticlesIntegrated: number = 0;
  public totalCollisionsResolved: number = 0;

  private constructor() {
    try {
      if (typeof WebAssembly !== 'undefined') {
        const bytes = buildWasmBinary();
        const mod = new WebAssembly.Module(bytes as BufferSource);
        const inst = new WebAssembly.Instance(mod);
        this.wasmExports = inst.exports as unknown as typeof this.wasmExports;
        if (this.wasmExports && this.wasmExports.memory) {
          this.f32View = new Float32Array(this.wasmExports.memory.buffer);
          this.isWasmSupported = true;
        }
      }
    } catch (err) {
      console.warn('WASM Physics fallback to JS:', err);
      this.isWasmSupported = false;
    }

    if (typeof window !== 'undefined') {
      (window as unknown as { __WASM_ENGINE__: WasmPhysicsEngine }).__WASM_ENGINE__ = this;
    }
  }

  public static getInstance(): WasmPhysicsEngine {
    if (!WasmPhysicsEngine.instance) {
      WasmPhysicsEngine.instance = new WasmPhysicsEngine();
    }
    return WasmPhysicsEngine.instance;
  }

  public isNativeWasmActive(): boolean {
    return this.isWasmSupported && this.wasmExports !== null;
  }

  /**
   * Native WASM squared Euclidean distance
   */
  public distSq(x1: number, y1: number, x2: number, y2: number): number {
    if (this.wasmExports) {
      return this.wasmExports.distSq(x1, y1, x2, y2);
    }
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  /**
   * Batch integrates particle kinematics in WASM linear memory and compacts living particles in-place.
   */
  public updateParticles<T extends {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    alpha: number;
  }>(particles: T[], dt: number, drag: number = 0.96): void {
    const len = particles.length;
    if (len === 0) return;

    const dt60 = dt * 60;
    const maxBatch = 2500; // 2500 * 24 bytes = 60,000 bytes (< 64KB page)

    if (this.wasmExports && this.f32View && len <= maxBatch) {
      const view = this.f32View;
      for (let i = 0; i < len; i++) {
        const p = particles[i];
        const base = i * 6;
        view[base] = p.x;
        view[base + 1] = p.y;
        view[base + 2] = p.vx;
        view[base + 3] = p.vy;
        view[base + 4] = p.life;
        view[base + 5] = p.maxLife;
      }

      this.wasmExports.stepParticleBatch(0, len, dt60, drag, dt);
      this.totalParticlesIntegrated += len;

      let alive = 0;
      for (let i = 0; i < len; i++) {
        const base = i * 6;
        const life = view[base + 4];
        if (life > 0) {
          const p = particles[i];
          p.x = view[base];
          p.y = view[base + 1];
          p.vx = view[base + 2];
          p.vy = view[base + 3];
          p.life = life;
          p.alpha = Math.max(0, life / p.maxLife);
          particles[alive++] = p;
        }
      }
      particles.length = alive;
      return;
    }

    // Fallback JS loop
    let alive = 0;
    for (let i = 0; i < len; i++) {
      const p = particles[i];
      p.x += p.vx * dt60;
      p.y += p.vy * dt60;
      p.vx *= drag;
      p.vy *= drag;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life > 0) {
        particles[alive++] = p;
      }
    }
    particles.length = alive;
  }

  /**
   * Resolves 2D elastic collision between two circular bodies with position separation and impulse transfer.
   * Returns true if a collision occurred and was resolved.
   */
  public resolveElasticCollision(
    a: ElasticBody2D,
    b: ElasticBody2D,
    restitution: number = 0.85
  ): boolean {
    const minDist = a.radius + b.radius;
    const dSq = this.distSq(a.x, a.y, b.x, b.y);
    if (dSq >= minDist * minDist || dSq < 1e-8) return false;

    const dist = Math.sqrt(dSq);
    const nx = (b.x - a.x) / dist;
    const ny = (b.y - a.y) / dist;

    // Separate overlapping circles proportionally to inverse mass
    const ma = a.mass ?? 1.0;
    const mb = b.mass ?? 1.0;
    const invMa = 1 / ma;
    const invMb = 1 / mb;
    const invMassSum = invMa + invMb;

    const overlap = minDist - dist;
    a.x -= nx * overlap * (invMa / invMassSum);
    a.y -= ny * overlap * (invMa / invMassSum);
    b.x += nx * overlap * (invMb / invMassSum);
    b.y += ny * overlap * (invMb / invMassSum);

    // Relative velocity along normal
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal < 0) {
      const j = (-(1 + restitution) * velAlongNormal) / invMassSum;
      const impulseX = j * nx;
      const impulseY = j * ny;
      a.vx -= impulseX * invMa;
      a.vy -= impulseY * invMa;
      b.vx += impulseX * invMb;
      b.vy += impulseY * invMb;
    }

    this.totalCollisionsResolved++;
    return true;
  }

  /**
   * Runs a live performance benchmark comparing native WASM batch integration vs JS
   */
  public runBenchmark(particleCount: number = 1500, iterations: number = 200): WasmBenchmarkResult {
    const dummyParticles = Array.from({ length: particleCount }, (_, idx) => ({
      x: (idx % 400) * 1.5,
      y: Math.floor(idx / 400) * 1.5,
      vx: 2.5,
      vy: -1.8,
      life: 100.0,
      maxLife: 100.0,
      alpha: 1.0
    }));

    const t0 = performance.now();
    if (this.wasmExports && this.f32View) {
      const view = this.f32View;
      for (let i = 0; i < particleCount; i++) {
        const base = i * 6;
        view[base] = dummyParticles[i].x;
        view[base + 1] = dummyParticles[i].y;
        view[base + 2] = dummyParticles[i].vx;
        view[base + 3] = dummyParticles[i].vy;
        view[base + 4] = dummyParticles[i].life;
        view[base + 5] = dummyParticles[i].maxLife;
      }
      for (let iter = 0; iter < iterations; iter++) {
        this.wasmExports.stepParticleBatch(0, particleCount, 1.0, 0.98, 0.016);
      }
    }
    const wasmTimeMs = performance.now() - t0;

    const t1 = performance.now();
    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < particleCount; i++) {
        const p = dummyParticles[i];
        p.x += p.vx * 1.0;
        p.y += p.vy * 1.0;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= 0.016;
        p.alpha = p.life / p.maxLife;
      }
    }
    const jsTimeMs = performance.now() - t1;

    return {
      wasmActive: this.isWasmSupported,
      wasmTimeMs: Number(wasmTimeMs.toFixed(3)),
      jsTimeMs: Number(jsTimeMs.toFixed(3)),
      speedupFactor: Number((jsTimeMs / Math.max(0.05, wasmTimeMs)).toFixed(2)),
      particlesProcessed: particleCount * iterations,
      collisionsSolved: this.totalCollisionsResolved
    };
  }
}
