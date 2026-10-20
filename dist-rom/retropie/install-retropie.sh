#!/usr/bin/env bash
# =============================================================================
# One-Step Installer for Raspberry Pi RetroPie / Batocera / RecalBox
# =============================================================================
set -e

RETROPIE_ROOT="${1:-$HOME/RetroPie}"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Retro Arcade Studio ROMs & Ports to $RETROPIE_ROOT..."

mkdir -p "$RETROPIE_ROOT/roms/nes"
mkdir -p "$RETROPIE_ROOT/roms/snes"
mkdir -p "$RETROPIE_ROOT/roms/arcade"
mkdir -p "$RETROPIE_ROOT/roms/ports/retro_arcade_data"

cp -f "$SRC_DIR/roms/nes/"*.nes "$RETROPIE_ROOT/roms/nes/"
cp -f "$SRC_DIR/roms/snes/"*.sfc "$RETROPIE_ROOT/roms/snes/"
cp -f "$SRC_DIR/roms/arcade/"*.rom "$RETROPIE_ROOT/roms/arcade/"
cp -f "$SRC_DIR/roms/ports/"*.sh "$RETROPIE_ROOT/roms/ports/"
cp -f "$SRC_DIR/roms/ports/gamelist.xml" "$RETROPIE_ROOT/roms/ports/"
cp -f "$SRC_DIR/roms/ports/retro_arcade_data/index.html" "$RETROPIE_ROOT/roms/ports/retro_arcade_data/"
chmod +x "$RETROPIE_ROOT/roms/ports/"*.sh

echo "✅ Installed 9 NES ROMs, 1 SNES LoROM, 28 Arcade ROMs, and RetroPie Ports!"
echo "Restart EmulationStation to play!"
