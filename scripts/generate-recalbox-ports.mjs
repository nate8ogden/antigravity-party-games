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
TIC_ROM="$SHARE/roms/tic80/${gameTitle}.tic"
PORT=8088

# 1. Start background micro-server at low CPU priority if not already running
if [ -d "$DATA_DIR" ]; then
  if ! pgrep -f "python3 -m http.server $PORT" >/dev/null 2>&1; then
    cd "$DATA_DIR"
    nohup nice -n 19 python3 -m http.server $PORT > /tmp/retro_arcade_server.log 2>&1 &
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

# 3. Launch Native TIC-80 JS Cartridge on TV via RetroArch if available
if [ -f "$TIC_ROM" ] && command -v retroarch >/dev/null 2>&1; then
  for core in /usr/lib/libretro/tic80_libretro.so /recalbox/share/cores/tic80_libretro.so; do
    if [ -f "$core" ]; then
      exec retroarch -L "$core" "$TIC_ROM"
      exit 0
    fi
  done
fi

# 4. Lean Pi Zero W fallback: Display on-screen TV guide with direct network URL
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
if (!gamelistXml.includes('Pokemon Kanto Adventure.sh')) {
  const pokeEntry = `\t<game>\n\t\t<path>./Pokemon Kanto Adventure.sh</path>\n\t\t<name>Pokemon Kanto Adventure (Custom JS Port)</name>\n\t\t<desc>Explore Pallet Town and Route 1 with Pikachu, Charmander, Squirtle, or Bulbasaur, battle wild Pokemon, and catch em all!</desc>\n\t\t<developer>Antigravity</developer>\n\t\t<publisher>Antigravity</publisher>\n\t\t<genre>RPG</genre>\n\t\t<players>1</players>\n\t\t<rating>0.99</rating>\n\t</game>\n</gameList>`;
  gamelistXml = gamelistXml.replace('</gameList>', pokeEntry);
}
const pokeScriptPath = path.join(recalboxPortsDir, 'Pokemon Kanto Adventure.sh');
const pokeScript = fs.readFileSync(path.join(recalboxPortsDir, 'Lode Runner.sh'), 'utf8')
  .replace(/Lode Runner/g, 'Pokemon Kanto Adventure')
  .replace(/loderunner/g, 'pokemon');
fs.writeFileSync(pokeScriptPath, pokeScript, { mode: 0o755 });

fs.writeFileSync(path.join(recalboxPortsDir, 'gamelist.xml'), gamelistXml, 'utf8');
console.log(`Generated ${fs.readdirSync(recalboxPortsDir).filter(f => f.endsWith('.sh')).length} Recalbox port scripts in ${recalboxPortsDir}`);
