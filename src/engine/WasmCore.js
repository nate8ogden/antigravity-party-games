/**
 * WasmCore.js
 * WebAssembly (WASM) Native Accelerator for Retro Arcade Studio.
 *
 * Architectural Evaluation:
 * 1. WHERE WASM EXCELLED (Implemented Here):
 *    - Lode Runner (`LodeRunner.js`): 28x16 A* pathfinding cost tables in contiguous WASM
 *      linear memory (`Int32Array` views), weighted Manhattan heuristic (`lodeHeuristic`),
 *      and batch brick-digging particle debris integration with gravity (`stepParticleBatch`).
 *    - Dig Dug (`DigDug.js`) & Space Invaders (`SpaceInvaders.js`): Radial volumetric soil
 *      excavation and destructible bunker voxel erosion (`erodeGridCircle`) in linear memory.
 *    - Galaga (`Galaga.js`) & Vector2 (`Vector2.js`): Native FPU cubic Bezier trajectory
 *      evaluation (`cubicBezierAxis`) and Euclidean distance squared (`distSq`).
 *    - Studio-Wide Particle Kinematics: Zero-GC batch particle integration (`stepParticleBatch`).
 *
 * 2. WHERE JS / WEBGL REMAIN OPTIMAL (Kept on Host):
 *    - CRT Post-Processing (`CRTOverlay.js`): Barrel distortion, scanlines, chromatic aberration,
 *      and bloom execute in parallel on the GPU via WebGL GLSL fragment shaders.
 *    - Canvas2D Draw Calls & Web Audio Oscillator Graph: Host-bound browser APIs where WASM
 *      FFI boundary crossings would add overhead without accelerating native C++ rasterization.
 */

function uleb128(val) {
  const bytes = [];
  do {
    let byte = val & 0x7f;
    val >>>= 7;
    if (val !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (val !== 0);
  return bytes;
}

function sleb128(val) {
  const bytes = [];
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

function section(id, payload) {
  return [id, ...uleb128(payload.length), ...payload];
}

function encodeString(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i));
  }
  return [...uleb128(bytes.length), ...bytes];
}

function f32Const(val) {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, val, true);
  return [0x43, ...new Uint8Array(buf)];
}

/**
 * Assembles the IEEE WebAssembly binary module (\0asm v1) exporting:
 * - memory (2 pages = 128KB shared linear memory)
 * - distSq(x1: f32, y1: f32, x2: f32, y2: f32) -> f32
 * - cubicBezierAxis(p0: f32, p1: f32, p2: f32, p3: f32, t: f32) -> f32
 * - lodeHeuristic(c1: i32, r1: i32, c2: i32, r2: i32, vWeight: i32) -> i32
 * - stepParticleBatch(ptr: i32, count: i32, dt: f32, gravity: f32, drag: f32) -> i32
 * - erodeGridCircle(ptr: i32, cols: i32, rows: i32, cx: i32, cy: i32, radSq: i32) -> i32
 */
function buildArcadeWasmBinary() {
  const F32 = 0x7d;
  const I32 = 0x7f;

  // Type section: 5 function signatures
  const typeSection = section(1, [
    5,
    // Type 0: (f32, f32, f32, f32) -> f32 [distSq]
    0x60, 4, F32, F32, F32, F32, 1, F32,
    // Type 1: (f32, f32, f32, f32, f32) -> f32 [cubicBezierAxis]
    0x60, 5, F32, F32, F32, F32, F32, 1, F32,
    // Type 2: (i32, i32, i32, i32, i32) -> i32 [lodeHeuristic]
    0x60, 5, I32, I32, I32, I32, I32, 1, I32,
    // Type 3: (i32, i32, f32, f32, f32) -> i32 [stepParticleBatch]
    0x60, 5, I32, I32, F32, F32, F32, 1, I32,
    // Type 4: (i32, i32, i32, i32, i32, i32) -> i32 [erodeGridCircle]
    0x60, 6, I32, I32, I32, I32, I32, I32, 1, I32
  ]);

  // Function section: 5 functions mapping 1-to-1 with Types 0..4
  const funcSection = section(3, [5, 0, 1, 2, 3, 4]);

  // Memory section: 1 shared linear memory (min 2 pages = 128KB, max 4 pages = 256KB)
  const memSection = section(5, [1, 0x01, 2, 4]);

  // Export section
  const exportSection = section(7, [
    6,
    ...encodeString('memory'), 0x02, 0,
    ...encodeString('distSq'), 0x00, 0,
    ...encodeString('cubicBezierAxis'), 0x00, 1,
    ...encodeString('lodeHeuristic'), 0x00, 2,
    ...encodeString('stepParticleBatch'), 0x00, 3,
    ...encodeString('erodeGridCircle'), 0x00, 4
  ]);

  // Func 0: distSq(x1, y1, x2, y2) -> (x2-x1)^2 + (y2-y1)^2
  const func0Code = [
    1, 2, F32, // locals 4, 5: f32
    0x20, 2, 0x20, 0, 0x93, 0x22, 4, 0x20, 4, 0x94,
    0x20, 3, 0x20, 1, 0x93, 0x22, 5, 0x20, 5, 0x94,
    0x92,
    0x0b
  ];

  // Func 1: cubicBezierAxis(p0, p1, p2, p3, t)
  // Locals: 5=u(f32), 6=tt(f32), 7=uu(f32)
  const func1Code = [
    1, 3, F32,
    // u = 1.0 - t (local 5)
    ...f32Const(1.0), 0x20, 4, 0x93, 0x22, 5,
    // uu = u * u (local 7)
    0x20, 5, 0x94, 0x21, 7,
    // tt = t * t (local 6)
    0x20, 4, 0x20, 4, 0x94, 0x21, 6,
    // term0: uu * u * p0
    0x20, 7, 0x20, 5, 0x94, 0x20, 0, 0x94,
    // term1: 3.0 * uu * t * p1
    ...f32Const(3.0), 0x20, 7, 0x94, 0x20, 4, 0x94, 0x20, 1, 0x94, 0x92,
    // term2: 3.0 * u * tt * p2
    ...f32Const(3.0), 0x20, 5, 0x94, 0x20, 6, 0x94, 0x20, 2, 0x94, 0x92,
    // term3: tt * t * p3
    0x20, 6, 0x20, 4, 0x94, 0x20, 3, 0x94, 0x92,
    0x0b
  ];

  // Func 2: lodeHeuristic(c1, r1, c2, r2, vWeight) -> |c2 - c1| * 10 + |r2 - r1| * vWeight
  // Locals: 5=dc(i32), 6=dr(i32)
  const func2Code = [
    1, 2, I32,
    // dc = c2 - c1
    0x20, 2, 0x20, 0, 0x6b, 0x22, 5,
    // if (dc < 0) dc = 0 - dc
    0x41, 0, 0x48, 0x04, 0x40,
      0x41, 0, 0x20, 5, 0x6b, 0x21, 5,
    0x0b,
    // dr = r2 - r1
    0x20, 3, 0x20, 1, 0x6b, 0x22, 6,
    // if (dr < 0) dr = 0 - dr
    0x41, 0, 0x48, 0x04, 0x40,
      0x41, 0, 0x20, 6, 0x6b, 0x21, 6,
    0x0b,
    // return dc * 10 + dr * vWeight
    0x20, 5, 0x41, 10, 0x6c,
    0x20, 6, 0x20, 4, 0x6c,
    0x6a,
    0x0b
  ];

  // Func 3: stepParticleBatch(ptr: i32, count: i32, dt: f32, gravity: f32, drag: f32) -> i32
  // Each particle = 6 f32s (24 bytes): [x, y, vx, vy, life, maxLife]
  // Locals: 5=i(i32), 6=addr(i32), 7=vx(f32), 8=vy(f32)
  const func3Code = [
    2, 2, I32, 2, F32,
    0x41, 0, 0x21, 5, // i = 0
    0x02, 0x40,       // block $break
      0x03, 0x40,     // loop $top
        0x20, 5, 0x20, 1, 0x4e, 0x0d, 1, // if (i >= count) br $break
        // addr = ptr + i * 24
        0x20, 0, 0x20, 5, 0x41, ...sleb128(24), 0x6c, 0x6a, 0x21, 6,
        // vx = mem[addr + 8] * drag; mem[addr + 8] = vx
        0x20, 6,
        0x20, 6, 0x2a, 2, 8, 0x20, 4, 0x94, 0x22, 7,
        0x38, 2, 8,
        // vy = (mem[addr + 12] + gravity * dt) * drag; mem[addr + 12] = vy
        0x20, 6,
        0x20, 6, 0x2a, 2, 12, 0x20, 3, 0x20, 2, 0x94, 0x92, 0x20, 4, 0x94, 0x22, 8,
        0x38, 2, 12,
        // mem[addr + 0] = mem[addr + 0] + vx * dt
        0x20, 6,
        0x20, 6, 0x2a, 2, 0, 0x20, 7, 0x20, 2, 0x94, 0x92,
        0x38, 2, 0,
        // mem[addr + 4] = mem[addr + 4] + vy * dt
        0x20, 6,
        0x20, 6, 0x2a, 2, 4, 0x20, 8, 0x20, 2, 0x94, 0x92,
        0x38, 2, 4,
        // mem[addr + 16] = mem[addr + 16] - dt
        0x20, 6,
        0x20, 6, 0x2a, 2, 16, 0x20, 2, 0x93,
        0x38, 2, 16,
        // i++
        0x20, 5, 0x41, 1, 0x6a, 0x21, 5,
        0x0c, 0,
      0x0b,
    0x0b,
    0x20, 5,
    0x0b
  ];

  // Func 4: erodeGridCircle(ptr: i32, cols: i32, rows: i32, cx: i32, cy: i32, radSq: i32) -> i32
  // Locals: 6=r(i32), 7=c(i32), 8=dx(i32), 9=dy(i32), 10=addr(i32), 11=eroded(i32)
  const func4Code = [
    1, 6, I32,
    0x41, 0, 0x21, 6,  // r = 0
    0x41, 0, 0x21, 11, // eroded = 0
    0x02, 0x40,        // block $rowBreak
      0x03, 0x40,      // loop $rowLoop
        0x20, 6, 0x20, 2, 0x4e, 0x0d, 1, // if (r >= rows) br $rowBreak
        0x20, 6, 0x20, 4, 0x6b, 0x21, 9, // dy = r - cy
        0x41, 0, 0x21, 7,                // c = 0
        0x02, 0x40,                      // block $colBreak
          0x03, 0x40,                    // loop $colLoop
            0x20, 7, 0x20, 1, 0x4e, 0x0d, 1, // if (c >= cols) br $colBreak
            0x20, 7, 0x20, 3, 0x6b, 0x21, 8, // dx = c - cx
            // if (dx*dx + dy*dy <= radSq)
            0x20, 8, 0x20, 8, 0x6c,
            0x20, 9, 0x20, 9, 0x6c,
            0x6a,
            0x20, 5,
            0x4c, // i32.le_s
            0x04, 0x40,
              // addr = ptr + (r * cols + c) * 4
              0x20, 0,
              0x20, 6, 0x20, 1, 0x6c, 0x20, 7, 0x6a, 0x41, 4, 0x6c,
              0x6a, 0x22, 10,
              // if (memI32[addr] != 0) { memI32[addr] = 0; eroded++; }
              0x28, 2, 0, // i32.load
              0x45,       // i32.eqz
              0x04, 0x40,
              0x05,       // else (non-zero)
                0x20, 10, 0x41, 0, 0x36, 2, 0, // i32.store 0
                0x20, 11, 0x41, 1, 0x6a, 0x21, 11,
              0x0b,
            0x0b,
            0x20, 7, 0x41, 1, 0x6a, 0x21, 7, // c++
            0x0c, 0,
          0x0b,
        0x0b,
        0x20, 6, 0x41, 1, 0x6a, 0x21, 6, // r++
        0x0c, 0,
      0x0b,
    0x0b,
    0x20, 11,
    0x0b
  ];

  const codeSection = section(10, [
    5,
    ...uleb128(func0Code.length), ...func0Code,
    ...uleb128(func1Code.length), ...func1Code,
    ...uleb128(func2Code.length), ...func2Code,
    ...uleb128(func3Code.length), ...func3Code,
    ...uleb128(func4Code.length), ...func4Code
  ]);

  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // "\0asm"
    0x01, 0x00, 0x00, 0x00, // version 1
    ...typeSection,
    ...funcSection,
    ...memSection,
    ...exportSection,
    ...codeSection
  ]);
}

export class WasmCore {
  constructor() {
    this.isWasmSupported = false;
    this.exports = null;
    this.f32View = null;
    this.i32View = null;

    // Telemetry counters
    this.stats = {
      particlesStepped: 0,
      lodePathQueries: 0,
      bezierEvaluations: 0,
      voxelsEroded: 0
    };

    this._init();
  }

  _init() {
    try {
      if (typeof WebAssembly !== 'undefined') {
        const bytes = buildArcadeWasmBinary();
        const mod = new WebAssembly.Module(bytes);
        const inst = new WebAssembly.Instance(mod);
        this.exports = inst.exports;
        if (this.exports && this.exports.memory) {
          this.f32View = new Float32Array(this.exports.memory.buffer);
          this.i32View = new Int32Array(this.exports.memory.buffer);
          this.isWasmSupported = true;
        }
      }
    } catch (_) {
      this.isWasmSupported = false;
    }

    if (typeof window !== 'undefined') {
      window.__WASM_CORE__ = this;
    }
  }

  isActive() {
    return this.isWasmSupported && this.exports !== null;
  }

  /**
   * Native WASM squared Euclidean distance
   */
  distSq(x1, y1, x2, y2) {
    if (this.exports) {
      return this.exports.distSq(x1, y1, x2, y2);
    }
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  /**
   * Native WASM 2D Cubic Bezier evaluation (used by Vector2.cubicBezier & Galaga flight paths)
   */
  cubicBezier(p0, p1, p2, p3, t, outVec) {
    this.stats.bezierEvaluations++;
    if (this.exports) {
      const x = this.exports.cubicBezierAxis(p0.x, p1.x, p2.x, p3.x, t);
      const y = this.exports.cubicBezierAxis(p0.y, p1.y, p2.y, p3.y, t);
      if (outVec) {
        outVec.x = x;
        outVec.y = y;
        return outVec;
      }
      return { x, y };
    }
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
    const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
    if (outVec) {
      outVec.x = x;
      outVec.y = y;
      return outVec;
    }
    return { x, y };
  }

  /**
   * Native WASM Lode Runner A* Heuristic & Linear-Memory Cost Table Pathfinder
   * Uses byte offset 65536 (Page 1) in shared WASM linear memory for zero-allocation gScore/cameFrom tables.
   */
  lodeHeuristic(c1, r1, c2, r2, verticalWeight = 12) {
    if (this.exports) {
      return this.exports.lodeHeuristic(c1 | 0, r1 | 0, c2 | 0, r2 | 0, verticalWeight | 0);
    }
    return Math.abs(c2 - c1) * 10 + Math.abs(r2 - r1) * verticalWeight;
  }

  /**
   * Lode Runner 28x16 A* Guard Pathfinding accelerated via WASM linear memory tables & heuristic
   */
  solveLodeRunnerAStar(cols, rows, startCol, startRow, goalCol, goalRow, getNeighborsFn) {
    this.stats.lodePathQueries++;
    const totalCells = cols * rows;
    const startIdx = startRow * cols + startCol;
    const goalIdx = goalRow * cols + goalCol;
    if (startIdx === goalIdx) return null;

    // Use WASM linear memory Page 1 (byte offset 65536 -> i32 index 16384) for gScore, fScore, cameFrom, closed
    const baseI32 = 16384;
    const gScoreOffset = baseI32;
    const fScoreOffset = baseI32 + totalCells;
    const cameFromOffset = baseI32 + totalCells * 2;
    const closedOffset = baseI32 + totalCells * 3;
    const mem = this.i32View;

    if (mem && this.exports) {
      for (let i = 0; i < totalCells; i++) {
        mem[gScoreOffset + i] = 999999;
        mem[fScoreOffset + i] = 999999;
        mem[cameFromOffset + i] = -1;
        mem[closedOffset + i] = 0;
      }

      mem[gScoreOffset + startIdx] = 0;
      mem[fScoreOffset + startIdx] = this.exports.lodeHeuristic(startCol, startRow, goalCol, goalRow, 12);

      const open = [startIdx];
      let bestIdx = startIdx;
      let bestH = mem[fScoreOffset + startIdx];
      let steps = 0;

      while (open.length > 0 && steps < 280) {
        steps++;
        let lowestPos = 0;
        let lowestF = mem[fScoreOffset + open[0]];
        for (let i = 1; i < open.length; i++) {
          const f = mem[fScoreOffset + open[i]];
          if (f < lowestF) {
            lowestF = f;
            lowestPos = i;
          }
        }

        const current = open[lowestPos];
        open.splice(lowestPos, 1);

        if (current === goalIdx) {
          bestIdx = current;
          break;
        }

        mem[closedOffset + current] = 1;
        const cc = current % cols;
        const cr = (current / cols) | 0;

        const neighbors = getNeighborsFn(cc, cr);
        for (let i = 0; i < neighbors.length; i++) {
          const nb = neighbors[i];
          const nIdx = nb.row * cols + nb.col;
          if (mem[closedOffset + nIdx] === 1) continue;

          const tentativeG = mem[gScoreOffset + current] + ((nb.cost || 1) * 10);
          if (tentativeG < mem[gScoreOffset + nIdx]) {
            mem[cameFromOffset + nIdx] = current;
            mem[gScoreOffset + nIdx] = tentativeG;
            const h = this.exports.lodeHeuristic(nb.col, nb.row, goalCol, goalRow, 12);
            mem[fScoreOffset + nIdx] = tentativeG + h;
            if (h < bestH) {
              bestH = h;
              bestIdx = nIdx;
            }
            if (!open.includes(nIdx)) {
              open.push(nIdx);
            }
          }
        }
      }

      let cur = bestIdx;
      if (cur === startIdx) return null;
      while (mem[cameFromOffset + cur] !== -1 && mem[cameFromOffset + cur] !== startIdx) {
        cur = mem[cameFromOffset + cur];
      }
      return { col: cur % cols, row: (cur / cols) | 0 };
    }

    return null;
  }

  /**
   * Batch integrates particle arrays in-place using WASM linear memory (`stepParticleBatch`)
   */
  stepParticles(particles, dt, gravity = 0, drag = 0.98) {
    const len = particles ? particles.length : 0;
    if (len === 0) return;

    const maxBatch = 2000;
    if (this.exports && this.f32View && len <= maxBatch) {
      const view = this.f32View;
      for (let i = 0; i < len; i++) {
        const p = particles[i];
        const base = i * 6;
        view[base] = p.x;
        view[base + 1] = p.y;
        view[base + 2] = p.vx || 0;
        view[base + 3] = p.vy || 0;
        view[base + 4] = p.life !== undefined ? p.life : (p.timer !== undefined ? p.timer : 0.5);
        view[base + 5] = p.maxLife || 1.0;
      }

      this.exports.stepParticleBatch(0, len, dt, gravity, drag);
      this.stats.particlesStepped += len;

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
          if (p.life !== undefined) p.life = life;
          if (p.timer !== undefined) p.timer = life;
          particles[alive++] = p;
        }
      }
      particles.length = alive;
      return;
    }

    // JS fallback
    let alive = 0;
    for (let i = 0; i < len; i++) {
      const p = particles[i];
      p.vx = (p.vx || 0) * drag;
      p.vy = ((p.vy || 0) + gravity * dt) * drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life !== undefined) {
        p.life -= dt;
        if (p.life > 0) particles[alive++] = p;
      } else if (p.timer !== undefined) {
        p.timer -= dt;
        if (p.timer > 0) particles[alive++] = p;
      }
    }
    particles.length = alive;
  }

  /**
   * Erodes a 2D voxel/soil matrix (Space Invaders bunkers / Dig Dug soil) using WASM linear memory
   */
  erodeVoxelMatrix(matrix, cx, cy, radius) {
    const rows = matrix.length;
    const cols = rows > 0 ? matrix[0].length : 0;
    if (rows === 0 || cols === 0) return 0;
    const radSq = Math.round(radius * radius);

    // Use byte offset 81920 (i32 index 20480) in WASM memory
    const baseByte = 81920;
    const baseI32 = baseByte >> 2;
    if (this.exports && this.i32View && rows * cols <= 8192) {
      const view = this.i32View;
      for (let r = 0; r < rows; r++) {
        const rowArr = matrix[r];
        const rowBase = baseI32 + r * cols;
        for (let c = 0; c < cols; c++) {
          view[rowBase + c] = rowArr[c] ? 1 : 0;
        }
      }
      const eroded = this.exports.erodeGridCircle(
        baseByte,
        cols,
        rows,
        Math.round(cx),
        Math.round(cy),
        radSq
      );
      if (eroded > 0) {
        for (let r = 0; r < rows; r++) {
          const rowArr = matrix[r];
          const rowBase = baseI32 + r * cols;
          for (let c = 0; c < cols; c++) {
            rowArr[c] = view[rowBase + c];
          }
        }
        this.stats.voxelsEroded += eroded;
      }
      return eroded;
    }

    // JS fallback
    let eroded = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = c - cx;
        const dy = r - cy;
        if (dx * dx + dy * dy <= radSq && matrix[r][c]) {
          matrix[r][c] = 0;
          eroded++;
        }
      }
    }
    return eroded;
  }

  /**
   * Benchmarks WASM vs JS performance for Lode Runner heuristics & batch particle integration
   */
  runBenchmark(particleCount = 1000, iterations = 150) {
    const nowFn = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();

    let wasmTimeMs = 0;
    if (this.exports && this.f32View) {
      for (let i = 0; i < particleCount * 6; i += 6) {
        this.f32View[i] = 100;
        this.f32View[i + 1] = 100;
        this.f32View[i + 2] = 25;
        this.f32View[i + 3] = -40;
        this.f32View[i + 4] = 5.0;
        this.f32View[i + 5] = 5.0;
      }
      const t0 = nowFn();
      for (let step = 0; step < iterations; step++) {
        this.exports.stepParticleBatch(0, particleCount, 0.016, 480.0, 0.98);
        this.exports.lodeHeuristic(2, 3, 25, 14, 12);
      }
      wasmTimeMs = Math.max(0.01, nowFn() - t0);
    }

    const jsBuf = new Float32Array(particleCount * 6);
    const t1 = nowFn();
    let dummy = 0;
    for (let step = 0; step < iterations; step++) {
      for (let i = 0; i < particleCount * 6; i += 6) {
        jsBuf[i + 2] *= 0.98;
        jsBuf[i + 3] = (jsBuf[i + 3] + 480.0 * 0.016) * 0.98;
        jsBuf[i] += jsBuf[i + 2] * 0.016;
        jsBuf[i + 1] += jsBuf[i + 3] * 0.016;
        jsBuf[i + 4] -= 0.016;
      }
      dummy += Math.abs(25 - 2) * 10 + Math.abs(14 - 3) * 12;
    }
    const jsTimeMs = Math.max(0.01, nowFn() - t1);

    return {
      wasmActive: this.isActive(),
      wasmTimeMs: Number(wasmTimeMs.toFixed(3)),
      jsTimeMs: Number(jsTimeMs.toFixed(3)),
      speedupFactor: Number((jsTimeMs / Math.max(0.005, wasmTimeMs)).toFixed(2)),
      dummy
    };
  }
}

export const wasmCore = new WasmCore();
export default wasmCore;
