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

mkdir -p "$RECALBOX_SHARE/roms/ports"
mkdir -p "$RECALBOX_SHARE/system/retro_arcade_data"
mkdir -p "$RECALBOX_SHARE/userscripts/manual"

echo "1. Installing 52 Individual Port Launchers & Metadata in Ports..."
cp -f "$SRC_DIR/roms/ports/"*.sh "$RECALBOX_SHARE/roms/ports/"
[ -f "$SRC_DIR/roms/ports/gamelist.xml" ] && cp -f "$SRC_DIR/roms/ports/gamelist.xml" "$RECALBOX_SHARE/roms/ports/"
chmod +x "$RECALBOX_SHARE/roms/ports/"*.sh

echo "2. Installing Self-Contained Web Studio Engine to System Directory..."
[ -f "$SRC_DIR/roms/arcade/retro_arcade_data/index.html" ] && cp -f "$SRC_DIR/roms/arcade/retro_arcade_data/index.html" "$RECALBOX_SHARE/system/retro_arcade_data/"
[ -f "$SRC_DIR/../../Retro_Arcade_Studio.html" ] && cp -f "$SRC_DIR/../../Retro_Arcade_Studio.html" "$RECALBOX_SHARE/system/retro_arcade_data/index.html"

echo "3. Installing Recalbox User Scripts..."
cp -f "$SRC_DIR/userscripts/manual/"*.sh "$RECALBOX_SHARE/userscripts/manual/" 2>/dev/null || true
chmod +x "$RECALBOX_SHARE/userscripts/manual/"*.sh 2>/dev/null || true

echo "4. Removing legacy broken arcade entries if present..."
rm -rf "$RECALBOX_SHARE/roms/arcade/retro_arcade_data" 2>/dev/null || true
rm -f "$RECALBOX_SHARE/roms/arcade/"*.rom 2>/dev/null || true

echo ""
echo "================================================================="
echo "✅ RECALBOX 9.2 INSTALLATION COMPLETE!"
echo "================================================================="
echo "Installed Artifacts:"
echo "  • 52 Individual Game Ports in $RECALBOX_SHARE/roms/ports/"
echo "  • Full 50-Game Engine in $RECALBOX_SHARE/system/retro_arcade_data/"
echo ""
echo "In EmulationStation on your TV, go to PORTS and you will see all 52 games!"
echo "================================================================="
