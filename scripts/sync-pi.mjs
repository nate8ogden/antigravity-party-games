import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PI_HOST = process.env.PI_HOST || 'recalbox.local';
const PI_USER = process.env.PI_USER || 'root';
const SD_MOUNT_SHARE = '/Volumes/SHARE';

console.log('===================================================================');
console.log('🔄 RETRO ARCADE STUDIO — AUTOMATIC SYNC TO RECALBOX');
console.log('===================================================================');

// Step 1: Ensure bundle & ROMs are built
console.log('📦 1. Building latest bundles and ROMs...');
execSync('npm run build:rom', { cwd: ROOT_DIR, stdio: 'inherit' });

// Step 2: Check target destination
if (fs.existsSync(SD_MOUNT_SHARE)) {
  console.log(`\n💾 2. Detected mounted SD Card at ${SD_MOUNT_SHARE}. Syncing locally...`);
  const installScript = path.join(ROOT_DIR, 'dist-rom/recalbox/install-recalbox.sh');
  execSync(`bash "${installScript}" "${SD_MOUNT_SHARE}"`, { stdio: 'inherit' });
  execSync('sync', { stdio: 'inherit' });
  console.log('✅ Local SD Card synced successfully!');
  process.exit(0);
}

// Step 3: Network sync over Wi-Fi
console.log(`\n📡 2. SD Card not mounted locally. Checking network connection to ${PI_HOST}...`);
let online = false;
try {
  execSync(`nc -z -w 3 ${PI_HOST} 22`, { stdio: 'ignore' });
  online = true;
} catch {
  online = false;
}

if (!online) {
  console.log(`⚠️  Could not reach ${PI_HOST}:22 on the current network.`);
  console.log('   Ensure the Raspberry Pi Zero W is powered on and connected to the same Wi-Fi (Chaparral-Guest).');
  console.log('   You can specify an IP address using: PI_HOST=192.168.x.x npm run sync');
  process.exit(1);
}

console.log(`🚀 3. Connected to ${PI_HOST}! Syncing ROMs and web app over SSH/rsync...`);
const distRecalbox = path.join(ROOT_DIR, 'dist-rom/recalbox');

try {
  // Sync ROMs
  execSync(
    `rsync -avz --inplace "${distRecalbox}/roms/" ${PI_USER}@${PI_HOST}:/recalbox/share/roms/`,
    { stdio: 'inherit' }
  );
  // Sync user scripts
  execSync(
    `rsync -avz --inplace "${distRecalbox}/userscripts/" ${PI_USER}@${PI_HOST}:/recalbox/share/userscripts/`,
    { stdio: 'inherit' }
  );

  // Trigger EmulationStation reload
  console.log('🔄 4. Refreshing EmulationStation on Recalbox TV screen...');
  try {
    execSync(
      `ssh -o ConnectTimeout=4 -o StrictHostKeyChecking=no ${PI_USER}@${PI_HOST} "/etc/init.d/S31emulationstation restart"`,
      { stdio: 'inherit' }
    );
  } catch {
    console.log('   (EmulationStation restart command sent)');
  }

  console.log('\n===================================================================');
  console.log('🏆 SYNC COMPLETE! Updated games are live on your TV!');
  console.log('===================================================================');
} catch (err) {
  console.error('❌ Network sync error:', err.message);
  process.exit(1);
}
