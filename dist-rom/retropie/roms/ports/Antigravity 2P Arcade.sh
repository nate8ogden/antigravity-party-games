#!/usr/bin/env bash
# =============================================================================
# Antigravity 2-4P Arcade — RetroPie / Batocera / RecalBox Native Port Launcher
# =============================================================================
# Supports:
# - Raspberry Pi 3B+ / 4 / 400 / 5 / Zero 2W
# - 1-4 USB / Bluetooth / GPIO Arcade Controllers (via W3C Gamepad + Libretro hotkeys)
# - Press SELECT + START on any controller to exit back to EmulationStation!

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME_HTML="$DIR/antigravity_data/index.html"

# Enable V3D / VC4 GPU hardware acceleration on Raspberry Pi OS / Mesa
export MOZ_WEBRENDER=1
export LIBGL_ALWAYS_SOFTWARE=0

BROWSER=""
for candidate in chromium-browser chromium google-chrome-stable epiphany-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then
    BROWSER="$candidate"
    break
  fi
done

if [ -z "$BROWSER" ]; then
  echo "Chromium not found. Install via: sudo apt-get install -y chromium-browser"
  exit 1
fi

# Launch in hardware-accelerated fullscreen arcade cabinet kiosk mode
exec "$BROWSER" \
  --kiosk \
  --app="file://$GAME_HTML?cabinet=1" \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --ignore-gpu-blocklist \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required \
  --no-first-run \
  --disable-infobars \
  --disable-session-crashed-bubble
