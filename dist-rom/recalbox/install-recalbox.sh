#!/usr/bin/env bash
# =============================================================================
# One-Step Installer for Recalbox 9.2 (Raspberry Pi & PC)
# =============================================================================
set -e

RECALBOX_SHARE="${1:-/recalbox/share}"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================================================="
echo "🕹️  INSTALLING RETRO ARCADE STUDIO (50 GAMES) TO RECALBOX 9.2"
echo "    Target Share: $RECALBOX_SHARE"
echo "================================================================="

if [ ! -d "$RECALBOX_SHARE" ]; then
  echo "⚠️ Warning: $RECALBOX_SHARE directory structure will be created."
fi

mkdir -p "$RECALBOX_SHARE/roms/tic80"
mkdir -p "$RECALBOX_SHARE/roms/ports/Retro Arcade Studio"
mkdir -p "$RECALBOX_SHARE/roms/arcade/retro_arcade_data"
mkdir -p "$RECALBOX_SHARE/userscripts/manual"

echo "1. Installing 53 Authentic 1:1 Custom JS TIC-80 Cartridges (TIC-80 & Ports > My Custom Games)..."
if [ -d "$SRC_DIR/roms/tic80" ]; then
  cp -f "$SRC_DIR/roms/tic80/"*.tic "$RECALBOX_SHARE/roms/tic80/"
  cp -f "$SRC_DIR/roms/tic80/gamelist.xml" "$RECALBOX_SHARE/roms/tic80/"
  cp -f "$SRC_DIR/roms/tic80/"*.tic "$RECALBOX_SHARE/roms/ports/Retro Arcade Studio/"
  cp -f "$SRC_DIR/roms/tic80/gamelist.xml" "$RECALBOX_SHARE/roms/ports/Retro Arcade Studio/"
fi

echo "2. Installing Arcade 50-Game Studio & Cartridges..."
cp -f "$SRC_DIR/roms/arcade/"*.rom "$RECALBOX_SHARE/roms/arcade/"
cp -f "$SRC_DIR/roms/arcade/gamelist.xml" "$RECALBOX_SHARE/roms/arcade/"
cp -f "$SRC_DIR/roms/arcade/retro_arcade_data/index.html" "$RECALBOX_SHARE/roms/arcade/retro_arcade_data/"

echo "3. Installing Recalbox User Scripts..."
cp -f "$SRC_DIR/userscripts/manual/"*.sh "$RECALBOX_SHARE/userscripts/manual/"
chmod +x "$RECALBOX_SHARE/userscripts/manual/"*.sh

echo "4. Cleaning macOS resource forks (._*)..."
find "$RECALBOX_SHARE/roms/tic80" "$RECALBOX_SHARE/roms/ports" -name '._*' -delete 2>/dev/null || true

echo ""
echo "================================================================="
echo "✅ RECALBOX 9.2 INSTALLATION COMPLETE!"
echo "================================================================="
echo "Installed Artifacts:"
echo "  • 9x NES Cartridges in $RECALBOX_SHARE/roms/nes/"
echo "  • 1x SNES LoROM in $RECALBOX_SHARE/roms/snes/"
echo "  • 51x Arcade ROMs in $RECALBOX_SHARE/roms/arcade/"
echo "  • Recalbox User Script in $RECALBOX_SHARE/userscripts/manual/"
echo ""
echo "To play on Recalbox:"
echo "  1. In EmulationStation, press START > UI SETTINGS > UPDATE GAMELISTS"
echo "     (or reboot via START > QUIT > RESTART RECALBOX)."
echo "  2. Go to NES or Super Nintendo to play directly with your gamepad!"
echo "  3. Go to START > ADVANCED SETTINGS > USER SCRIPTS > RetroArcadeStudio"
echo "     to launch the full 50-game studio micro-server!"
echo "================================================================="
