#!/bin/bash
# =============================================================================
# Retro Arcade Studio — Recalbox 9.2 Native Kiosk Launcher & Micro Server
# =============================================================================
SHARE="/recalbox/share"
DATA_DIR="$SHARE/roms/arcade/retro_arcade_data"
HTML_FILE="$DATA_DIR/index.html"
PORT=8080

# Check for native web engines / browser candidates on Recalbox:
BROWSER=""
for candidate in chromium-browser chromium epiphany-browser cog wpe; do
  if command -v "$candidate" >/dev/null 2>&1; then
    BROWSER="$candidate"
    break
  fi
done

if [ -n "$BROWSER" ]; then
  echo "Launching Retro Arcade Studio via $BROWSER..."
  exec "$BROWSER" --kiosk "file://$HTML_FILE?cabinet=1"
  exit 0
fi

# On standard Recalbox 9.2 (lean Buildroot without X11/Chromium):
# Launch background Python micro-server so all 50 games are playable instantly
# from any browser, phone, tablet, laptop, or smart TV on the home network!
IP_ADDR=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
[ -z "$IP_ADDR" ] && IP_ADDR="recalbox.local"

# Kill any existing server instance on port 8080
pkill -f "python3 -m http.server $PORT" 2>/dev/null || true

cd "$DATA_DIR"
nohup python3 -m http.server $PORT > /tmp/retro_arcade_server.log 2>&1 &
SERVER_PID=$!

echo "================================================================="
echo "🕹️  RETRO ARCADE STUDIO (50 GAMES) ACTIVE ON RECALBOX 9.2!"
echo "================================================================="
echo "Server running at PID: $SERVER_PID"
echo ""
echo "▶ Open this URL in any browser on your network:"
echo "    http://$IP_ADDR:$PORT"
echo "    http://recalbox.local:$PORT"
echo ""
echo "Features:"
echo "  • 50 Modernized Coin-Op Arcade Classics"
echo "  • WebGL CRT post-processing shaders & scanlines"
echo "  • Procedural Web Audio chiptune synthesis"
echo "  • USB / Bluetooth / GPIO Gamepad support"
echo "  • Emulator Save States & Instant Rewind"
echo "================================================================="
