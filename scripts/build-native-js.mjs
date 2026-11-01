#!/usr/bin/env node
/**
 * Builds one self-contained `.arcade` JavaScript bundle per game for the native
 * RetroArch core (native/src). Each bundle = browser-API glue + the REAL engine
 * (src/engine/*) + the REAL game class (src/games/*.js) + a frame loop that
 * mirrors src/main.js. No game logic is rewritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_CATALOG } from '../src/ui/MainMenu.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-native');
fs.mkdirSync(OUT, { recursive: true });

const ENGINE = [
  'src/engine/WasmCore.js',
  'src/engine/Vector2.js',
  'src/engine/CloudPersistence.js',
  'src/engine/Input.js',
  'src/engine/Renderer.js'
];

function stripESM(code) {
  return code
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+.*$/gm, '')
    .replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '')
    .replace(/^\s*export\s+(class|const|let|var|function)\s+/gm, '$1 ');
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const glue = read('native/glue.js');
const engine = ENGINE.map((f) => `\n// === ${f} ===\n` + stripESM(read(f))).join('\n');

const gamesDir = path.join(ROOT, 'src/games');
const byId = {};
for (const file of fs.readdirSync(gamesDir).filter((f) => f.endsWith('.js'))) {
  const raw = fs.readFileSync(path.join(gamesDir, file), 'utf8');
  const cls = raw.match(/export\s+class\s+([A-Za-z0-9_]+)/);
  const id = raw.match(/this\.id\s*=\s*['"]([a-z0-9_]+)['"]/);
  if (cls && id) byId[id[1]] = { file, className: cls[1], raw };
}

const sanitize = (t) => t.replace(/[\/\\:*?"<>|]/g, '_');
let count = 0;
for (const g of GAME_CATALOG) {
  const e = byId[g.id];
  if (!e) { console.warn('missing source for', g.id); continue; }
  const footer = `
// === native frame loop (mirrors src/main.js) ===
// Sprite blitting: identical per-cell rects, issued from C in one call instead of one JS call per cell.
Renderer.prototype.drawPixelSprite = function (rows, x, y, scale = 2, palette = {}, flipX = false, flipY = false) {
  __nc.sprite(rows, x, y, scale, palette, flipX, flipY);
};
const __renderer = new Renderer(null, null);
const __input = new InputManager(null);
const __audio = new AudioSynth();
const __game = new ${e.className}(__renderer, __input, __audio);
function __frame() {
  const dt = 1 / 60;
  __input.pollGamepads();
  __input.updateTurbo(dt);
  __renderer.beginFrame(dt);
  __game.update(dt);
  __game.render(__renderer.ctx);
  __renderer.endFrame();
  __input.endFrame();
}
`;
  const out = `${glue}\n${engine}\n// === src/games/${e.file} ===\n${stripESM(e.raw)}\n${footer}`;
  fs.writeFileSync(path.join(OUT, `${sanitize(g.title)}.arcade`), out);
  count++;
}
console.log(`Built ${count} native .arcade bundles in ${OUT}`);
