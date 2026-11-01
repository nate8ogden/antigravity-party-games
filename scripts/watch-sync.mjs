import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const PI_HOST = process.env.PI_HOST || 'recalbox.local';

console.log('===================================================================');
console.log('👀 AUTO-SYNC WATCHER: LIVE SYNC AS GEMINI COOKS');
console.log('   Watching src/ for game and engine changes...');
console.log(`   Auto-detecting when Pi (${PI_HOST}) turns on...`);
console.log('===================================================================');

let debounceTimer = null;
let isSyncing = false;
let needsSync = true;
let piWasOnline = false;

function isPiOnline() {
  try {
    execSync(`nc -z -w 2 ${PI_HOST} 22`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function triggerSync(reason = 'change') {
  if (isSyncing) return;
  isSyncing = true;

  console.log(`\n⚡ [Sync Trigger: ${reason}] Cooking new ROMs and syncing to Pi...`);
  const child = spawn('node', ['scripts/sync-pi.mjs'], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  child.on('close', (code) => {
    isSyncing = false;
    if (code === 0) {
      needsSync = false;
      console.log('✨ All systems up to date!');
    } else {
      needsSync = true;
      console.log(`⏳ Pi is currently off. Will automatically push updates as soon as the Pi powers on!`);
    }
    console.log('\n👀 Watching for code changes & Pi power-on events...');
  });
}

// Watch src/ directory for any file changes while coding
fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
  if (!filename || filename.endsWith('.tmp') || filename.startsWith('.')) return;
  needsSync = true;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => triggerSync(`File changed (${filename})`), 1000);
});

// Poll every 8 seconds to detect when the Pi turns on
setInterval(() => {
  if (isSyncing) return;
  const online = isPiOnline();

  // Pi just powered on and joined Wi-Fi!
  if (online && (!piWasOnline || needsSync)) {
    console.log(`\n🟢 Detected Pi powered on at ${PI_HOST}!`);
    triggerSync('Pi powered on');
  }

  piWasOnline = online;
}, 8000);

// Run initial sync on startup
triggerSync('Startup');
