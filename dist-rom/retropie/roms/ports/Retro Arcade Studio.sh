#!/usr/bin/env bash
# =============================================================================
# Retro Arcade Studio — RetroPie / Batocera / RecalBox Native Port Launcher
# =============================================================================
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME_HTML="$DIR/retro_arcade_data/index.html"

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
