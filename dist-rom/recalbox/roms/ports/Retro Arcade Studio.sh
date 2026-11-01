#!/bin/bash
# =============================================================================
# Retro Arcade Studio — Recalbox 9.2 Unified Ports Launcher & Micro-Server
# =============================================================================
SHARE="/recalbox/share"
DATA_DIR="$SHARE/system/retro_arcade_data"
PORT=8088

# 1. Start background micro-server if not running
if [ -d "$DATA_DIR" ]; then
  pkill -f "python3 -m http.server $PORT" 2>/dev/null || true
  cd "$DATA_DIR"
  nohup python3 -m http.server $PORT > /tmp/retro_arcade_server.log 2>&1 &
fi

IP_ADDR=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
[ -z "$IP_ADDR" ] && IP_ADDR="recalbox.local"

# 2. If a native browser is available, launch direct kiosk redirect
for browser in chromium-browser chromium epiphany-browser cog wpe; do
  if command -v "$browser" >/dev/null 2>&1; then
    exec "$browser" --kiosk "http://localhost:$PORT?cabinet=1"
    exit 0
  fi
done

# 3. Lean Pi Zero W build: Display on-screen TV guide with direct network URL
if command -v dialog >/dev/null 2>&1; then
  dialog --title "🕹️ Retro Arcade Studio (50 Games)" \
         --msgbox "\nServer is LIVE on your network!\n\nOpen any phone, tablet, or laptop browser to:\n\n   http://$IP_ADDR:$PORT\n   http://recalbox.local:$PORT\n\nAll 50 modernized arcade classics are ready to play!" 14 62
elif command -v recalbox-osd >/dev/null 2>&1; then
  recalbox-osd -m "Retro Arcade Studio active at http://$IP_ADDR:$PORT" -t 8
else
  clear
  echo "=========================================================="
  echo "🕹️  RETRO ARCADE STUDIO (50 CLASSIC GAMES) IS LIVE!"
  echo "=========================================================="
  echo ""
  echo "  Open this link in any browser on your Wi-Fi:"
  echo "    ▶ http://$IP_ADDR:$PORT"
  echo "    ▶ http://recalbox.local:$PORT"
  echo ""
  echo "  Includes all 50 classics:"
  echo "  Pac-Man, Donkey Kong, Galaga, Dig Dug, OutRun, Frogger,"
  echo "  Arkanoid, BurgerTime, Marble Madness, Paperboy, and more!"
  echo "=========================================================="
  sleep 7
fi
