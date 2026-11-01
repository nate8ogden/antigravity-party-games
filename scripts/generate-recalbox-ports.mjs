import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const retropiePortsDir = path.join(ROOT_DIR, 'dist-rom', 'retropie', 'roms', 'ports');
const recalboxPortsDir = path.join(ROOT_DIR, 'dist-rom', 'recalbox', 'roms', 'ports');

fs.mkdirSync(recalboxPortsDir, { recursive: true });

// Copy and adapt gamelist.xml
const gamelistPath = path.join(retropiePortsDir, 'gamelist.xml');
let gamelistXml = fs.readFileSync(gamelistPath, 'utf8');

// Copy each .sh script with Recalbox-optimized runner
const files = fs.readdirSync(retropiePortsDir);
for (const file of files) {
  if (!file.endsWith('.sh')) continue;
  
  const content = fs.readFileSync(path.join(retropiePortsDir, file), 'utf8');
  const gameMatch = content.match(/game=([a-z0-9_]+)/i);
  const gameId = gameMatch ? gameMatch[1] : '';
  const gameTitle = file.replace(/\.sh$/, '');

  const recalboxScript = `#!/bin/bash
# =============================================================================
# Retro Arcade Studio — ${gameTitle} Port Launcher
# =============================================================================
GAME_ID="${gameId}"
GAME_TITLE="${gameTitle}"
SHARE="/recalbox/share"
DATA_DIR="$SHARE/system/retro_arcade_data"
PORT=8088

# 1. Start background micro-server if not already running
if [ -d "$DATA_DIR" ]; then
  if ! pgrep -f "python3 -m http.server $PORT" >/dev/null 2>&1; then
    cd "$DATA_DIR"
    nohup python3 -m http.server $PORT > /tmp/retro_arcade_server.log 2>&1 &
  fi
fi

IP_ADDR=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
[ -z "$IP_ADDR" ] && IP_ADDR="recalbox.local"

# 2. Check for native browser
for browser in chromium-browser chromium epiphany-browser cog wpe; do
  if command -v "$browser" >/dev/null 2>&1; then
    if [ -n "$GAME_ID" ]; then
      exec "$browser" --kiosk "http://localhost:$PORT/?game=$GAME_ID&cabinet=1"
    else
      exec "$browser" --kiosk "http://localhost:$PORT/?cabinet=1"
    fi
    exit 0
  fi
done

# 3. Lean Pi Zero W build: Display on-screen TV guide with direct network URL
URL="http://$IP_ADDR:$PORT/?game=$GAME_ID"
[ -z "$GAME_ID" ] && URL="http://$IP_ADDR:$PORT"

if command -v dialog >/dev/null 2>&1; then
  dialog --title "🕹️ $GAME_TITLE" \\
         --msgbox "\\n$GAME_TITLE is LIVE on your network!\\n\\nOpen any browser on your Wi-Fi to play this game directly:\\n\\n   $URL\\n   http://recalbox.local:$PORT/?game=$GAME_ID\\n" 13 62
elif command -v recalbox-osd >/dev/null 2>&1; then
  recalbox-osd -m "$GAME_TITLE: $URL" -t 8
else
  clear
  echo "=========================================================="
  echo "🕹️  $GAME_TITLE — READY TO PLAY!"
  echo "=========================================================="
  echo ""
  echo "  Open this link on your phone, tablet, or PC to play:"
  echo "    ▶ $URL"
  echo "    ▶ http://recalbox.local:$PORT/?game=$GAME_ID"
  echo ""
  echo "=========================================================="
  sleep 6
fi
`;

  const destPath = path.join(recalboxPortsDir, file);
  fs.writeFileSync(destPath, recalboxScript, { mode: 0o755 });
}

// Write the gamelist.xml
fs.writeFileSync(path.join(recalboxPortsDir, 'gamelist.xml'), gamelistXml, 'utf8');
console.log(`Generated ${files.filter(f => f.endsWith('.sh')).length} Recalbox port scripts in ${recalboxPortsDir}`);
