#!/usr/bin/env bash
# =============================================================================
# One-Step Installer for Raspberry Pi RetroPie / Batocera / RecalBox
# =============================================================================
set -e

RETROPIE_ROOT="${1:-$HOME/RetroPie}"
echo "Installing Antigravity Arcade ROMs to $RETROPIE_ROOT..."

mkdir -p "$RETROPIE_ROOT/roms/nes"
mkdir -p "$RETROPIE_ROOT/roms/ports/antigravity_data"

cp -f "$(dirname "$0")/roms/nes/Antigravity_Arcade.nes" "$RETROPIE_ROOT/roms/nes/"
cp -f "$(dirname "$0")/roms/ports/Antigravity 2P Arcade.sh" "$RETROPIE_ROOT/roms/ports/"
cp -f "$(dirname "$0")/roms/ports/antigravity_data/index.html" "$RETROPIE_ROOT/roms/ports/antigravity_data/"
chmod +x "$RETROPIE_ROOT/roms/ports/Antigravity 2P Arcade.sh"

echo "✅ Installed:"
echo "  1. Classic 6502 NES ROM: $RETROPIE_ROOT/roms/nes/Antigravity_Arcade.nes"
echo "  2. 100-Game Arcade Port: $RETROPIE_ROOT/roms/ports/Antigravity 2P Arcade.sh"
echo "Restart EmulationStation to play!"
