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

mkdir -p "$RECALBOX_SHARE/roms/nes"
mkdir -p "$RECALBOX_SHARE/roms/snes"
mkdir -p "$RECALBOX_SHARE/roms/arcade/retro_arcade_data"
mkdir -p "$RECALBOX_SHARE/userscripts/manual"

echo "1. Installing NES 6502 cartridges & metadata..."
cp -f "$SRC_DIR/roms/nes/"*.nes "$RECALBOX_SHARE/roms/nes/"
[ -f "$SRC_DIR/roms/nes/gamelist.xml" ] && cp -f "$SRC_DIR/roms/nes/gamelist.xml" "$RECALBOX_SHARE/roms/nes/"

echo "2. Installing SNES LoROM cartridge & metadata..."
cp -f "$SRC_DIR/roms/snes/"*.sfc "$RECALBOX_SHARE/roms/snes/"
[ -f "$SRC_DIR/roms/snes/gamelist.xml" ] && cp -f "$SRC_DIR/roms/snes/gamelist.xml" "$RECALBOX_SHARE/roms/snes/"

echo "3. Installing Arcade 50-Game Studio & Cartridges..."
cp -f "$SRC_DIR/roms/arcade/"*.rom "$RECALBOX_SHARE/roms/arcade/"
cp -f "$SRC_DIR/roms/arcade/gamelist.xml" "$RECALBOX_SHARE/roms/arcade/"
cp -f "$SRC_DIR/roms/arcade/retro_arcade_data/index.html" "$RECALBOX_SHARE/roms/arcade/retro_arcade_data/"

echo "4. Installing Recalbox User Scripts..."
cp -f "$SRC_DIR/userscripts/manual/"*.sh "$RECALBOX_SHARE/userscripts/manual/"
chmod +x "$RECALBOX_SHARE/userscripts/manual/"*.sh

echo "5. Updating EmulationStation permissions..."
chmod 644 "$RECALBOX_SHARE/roms/nes/"*.nes
chmod 644 "$RECALBOX_SHARE/roms/snes/"*.sfc
chmod 644 "$RECALBOX_SHARE/roms/arcade/"*.rom

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
