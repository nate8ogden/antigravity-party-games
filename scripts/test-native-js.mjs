#!/usr/bin/env node
// Runs every dist-native/*.arcade bundle in a Node VM against a mock native canvas.
// Verifies the real engine+game boot, run for N frames with scripted input, and only
// call native functions from the documented contract.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'dist-native');

const HOST = new Set('pad now newLinear newRadial gradStop sprite ctx'.split(' '));
const CTX = new Set(('save restore translate scale rotate beginPath closePath moveTo lineTo quadraticCurveTo bezierCurveTo arc ellipse rect fill stroke clip ' +
  'fillRect clearRect strokeRect fillText measureText setLineDash fillStyle strokeStyle lineWidth globalAlpha font textAlign textBaseline lineCap').split(' '));

const only = process.argv[2];
const frames = +(process.argv[3] || 240);
let failed = 0, gradId = 0;
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.arcade') && (!only || f.includes(only)));
for (const f of files) {
  let frame = 0;
  const calls = {}, unknown = new Set();
  const ctxStore = {};
  const ctxMock = new Proxy(ctxStore, {
    get(t, name) {
      if (name in t) return t[name];
      if (CTX.has(name)) {
        if (name === 'globalAlpha' || name === 'lineWidth') return 1;
        return (...a) => { calls[name] = (calls[name] || 0) + 1; return name === 'measureText' ? { width: 10 } : undefined; };
      }
      return undefined;
    },
    set(t, name, v) { t[name] = v; if (CTX.has(name)) calls['set:' + name] = (calls['set:' + name] || 0) + 1; return true; }
  });
  const nc = new Proxy({}, {
    get(_, name) {
      if (name === 'ctx') return ctxMock;
      if (!HOST.has(name)) { unknown.add(String(name)); return () => 0; }
      return (...a) => {
        calls[name] = (calls[name] || 0) + 1;
        if (name === 'now') return frame * 1000 / 60;
        if (name === 'pad') {
          let b = 0;
          if (frame % 40 < 20) b |= 1 << 7;
          if (frame % 25 === 3) b |= 1 << 8;
          if (frame % 90 === 40) b |= 1 << 3;
          return b;
        }
        if (name === 'newLinear' || name === 'newRadial') return gradId++;
        return undefined;
      };
    }
  });
  const sandbox = { __nc: nc, console, Math, JSON, Promise, Proxy, Set, Map, Symbol, Date, Number, String, Array, Object, RegExp, Error, parseFloat, parseInt, isNaN, Float32Array, Float64Array, Int32Array, Int16Array, Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray, ArrayBuffer, Reflect };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  try {
    vm.runInContext(src + '\n;globalThis.__frame = __frame;', sandbox, { filename: f });
    const t0 = performance.now();
    for (frame = 0; frame < frames; frame++) sandbox.__frame();
    const ms = (performance.now() - t0) / frames;
    const n = Object.values(calls).reduce((s, v) => s + v, 0) / frames;
    const warn = unknown.size ? ` UNKNOWN NATIVE: ${[...unknown].join(',')}` : '';
    if (unknown.size) failed++;
    console.log(`ok   ${f.padEnd(30)} ${ms.toFixed(3)}ms/f  ${Math.round(n)} native calls/f${warn}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}: ${(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`);
  }
}
console.log(failed ? `\n${failed} bundle(s) failed` : `\nAll ${files.length} bundles booted and ran ${frames} frames`);
process.exit(failed ? 1 : 0);
