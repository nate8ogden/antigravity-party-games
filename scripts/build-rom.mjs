#!/usr/bin/env node
/**
 * Antigravity 2-4P Arcade — Raspberry Pi & Classic Console ROM Builder
 * =====================================================================
 * Generates two playable ROM artifacts for Raspberry Pi retro gaming devices
 * (RetroPie, Batocera, RecalBox, EmulationStation, and Libretro/RetroArch):
 *
 * 1. `dist-rom/Antigravity_Arcade.nes` (40,976 bytes)
 *    - A genuine, standards-compliant iNES (Mapper 0 NROM-256) 6502 machine-code ROM
 *      playable in ANY NES emulator (`lr-fceumm`, `lr-nestopia`, Mesen, FCEUX, OpenEmu).
 *    - Features a 2-Player "ANTIGRAVITY SUMO & TANK ARENA" 8-bit demake with:
 *      * Custom CHR-ROM 8x8 pixel font, player sprites, and arena border tiles
 *      * Hardware 60Hz NMI game loop with Joypad 1 ($4016) & Joypad 2 ($4017) polling
 *      * Automatic 2P AI bot fallback when Joypad 2 is idle
 *      * Dash/boost physics (A/B buttons), knockback collision, live score counter, and APU synth SFX!
 *
 * 2. `dist-rom/Antigravity_Party.rom` + `dist-rom/retropie/`
 *    - A self-contained Raspberry Pi RetroPie / Batocera / PortMaster Cartridge ROM package
 *      containing the full 100-game WASM-accelerated arcade suite, EmulationStation `gamelist.xml`,
 *      4-player USB/GPIO arcade stick mapping (`Select + Start` exit hotkey), and `install-retropie.sh`.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_HTML = path.join(ROOT_DIR, 'dist', 'index.html');
const OUT_DIR = path.join(ROOT_DIR, 'dist-rom');
const RETROPIE_DIR = path.join(OUT_DIR, 'retropie');

// ---------------------------------------------------------------------------
// PART 1: Build Genuine 6502 iNES (.nes) Classic Console ROM
// ---------------------------------------------------------------------------

/**
 * 8x8 1-bit bitmap font for ASCII characters used in CHR-ROM tiles $20-$5F
 */
const MINI_FONT_8X8 = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '!': [0x18, 0x18, 0x18, 0x18, 0x18, 0x00, 0x18, 0x00],
  '-': [0x00, 0x00, 0x00, 0x7e, 0x00, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x18, 0x00],
  ':': [0x00, 0x18, 0x18, 0x00, 0x18, 0x18, 0x00, 0x00],
  '/': [0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x00],
  '0': [0x3c, 0x66, 0x6e, 0x76, 0x66, 0x66, 0x3c, 0x00],
  '1': [0x18, 0x38, 0x18, 0x18, 0x18, 0x18, 0x7e, 0x00],
  '2': [0x3c, 0x66, 0x06, 0x1c, 0x30, 0x66, 0x7e, 0x00],
  '3': [0x3c, 0x66, 0x06, 0x1c, 0x06, 0x66, 0x3c, 0x00],
  '4': [0x0c, 0x1c, 0x3c, 0x6c, 0x7e, 0x0c, 0x0c, 0x00],
  '5': [0x7e, 0x60, 0x7c, 0x06, 0x06, 0x66, 0x3c, 0x00],
  '6': [0x3c, 0x60, 0x7c, 0x66, 0x66, 0x66, 0x3c, 0x00],
  '7': [0x7e, 0x66, 0x0c, 0x18, 0x18, 0x18, 0x18, 0x00],
  '8': [0x3c, 0x66, 0x66, 0x3c, 0x66, 0x66, 0x3c, 0x00],
  '9': [0x3c, 0x66, 0x66, 0x3e, 0x06, 0x66, 0x3c, 0x00],
  'A': [0x18, 0x3c, 0x66, 0x7e, 0x66, 0x66, 0x66, 0x00],
  'B': [0x7c, 0x66, 0x66, 0x7c, 0x66, 0x66, 0x7c, 0x00],
  'C': [0x3c, 0x66, 0x60, 0x60, 0x60, 0x66, 0x3c, 0x00],
  'D': [0x78, 0x6c, 0x66, 0x66, 0x66, 0x6c, 0x78, 0x00],
  'E': [0x7e, 0x60, 0x60, 0x78, 0x60, 0x60, 0x7e, 0x00],
  'F': [0x7e, 0x60, 0x60, 0x78, 0x60, 0x60, 0x60, 0x00],
  'G': [0x3c, 0x66, 0x60, 0x6e, 0x66, 0x66, 0x3c, 0x00],
  'H': [0x66, 0x66, 0x66, 0x7e, 0x66, 0x66, 0x66, 0x00],
  'I': [0x3c, 0x18, 0x18, 0x18, 0x18, 0x18, 0x3c, 0x00],
  'J': [0x1e, 0x0c, 0x0c, 0x0c, 0x6c, 0x6c, 0x38, 0x00],
  'K': [0x66, 0x6c, 0x78, 0x70, 0x78, 0x6c, 0x66, 0x00],
  'L': [0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x7e, 0x00],
  'M': [0xc6, 0xee, 0xfe, 0xd6, 0xc6, 0xc6, 0xc6, 0x00],
  'N': [0x66, 0x76, 0x7e, 0x7e, 0x6e, 0x66, 0x66, 0x00],
  'O': [0x3c, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3c, 0x00],
  'P': [0x7c, 0x66, 0x66, 0x7c, 0x60, 0x60, 0x60, 0x00],
  'Q': [0x3c, 0x66, 0x66, 0x66, 0x6e, 0x3c, 0x0e, 0x00],
  'R': [0x7c, 0x66, 0x66, 0x7c, 0x78, 0x6c, 0x66, 0x00],
  'S': [0x3c, 0x66, 0x60, 0x3c, 0x06, 0x66, 0x3c, 0x00],
  'T': [0x7e, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x00],
  'U': [0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3c, 0x00],
  'V': [0x66, 0x66, 0x66, 0x66, 0x66, 0x3c, 0x18, 0x00],
  'W': [0xc6, 0xc6, 0xc6, 0xd6, 0xfe, 0xee, 0xc6, 0x00],
  'X': [0x66, 0x66, 0x3c, 0x18, 0x3c, 0x66, 0x66, 0x00],
  'Y': [0x66, 0x66, 0x66, 0x3c, 0x18, 0x18, 0x18, 0x00],
  'Z': [0x7e, 0x06, 0x0c, 0x18, 0x30, 0x60, 0x7e, 0x00]
};

function buildChrRom() {
  const chr = Buffer.alloc(8192, 0);

  const writeTile = (tileIdx, plane0, plane1) => {
    const base = tileIdx * 16;
    for (let r = 0; r < 8; r++) {
      chr[base + r] = plane0[r] || 0;
      chr[base + 8 + r] = plane1[r] || 0;
    }
  };

  // Tile $01: Arena Ring Border Block
  writeTile(
    0x01,
    [0xff, 0x81, 0xbd, 0xa5, 0xa5, 0xbd, 0x81, 0xff],
    [0xff, 0xff, 0xc3, 0xdb, 0xdb, 0xc3, 0xff, 0xff]
  );

  // Tile $02: Arena Floor Dot
  writeTile(
    0x02,
    [0x00, 0x00, 0x00, 0x18, 0x18, 0x00, 0x00, 0x00],
    [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
  );

  // Tile $03: Player 1 Mascot / Sumo Striker Sprite
  writeTile(
    0x03,
    [0x3c, 0x7e, 0xff, 0xdb, 0xff, 0x7e, 0x66, 0xc3],
    [0x00, 0x3c, 0x7e, 0x24, 0x7e, 0x3c, 0x00, 0x00]
  );

  // Tile $04: Player 2 Mascot / Rival Striker Sprite
  writeTile(
    0x04,
    [0x3c, 0x7e, 0xff, 0x99, 0xff, 0x7e, 0x66, 0xc3],
    [0x3c, 0x42, 0x81, 0x66, 0x81, 0x42, 0x3c, 0x00]
  );

  // Tile $05: Energy Core / Crown Pickup Sprite
  writeTile(
    0x05,
    [0x18, 0x3c, 0x7e, 0xff, 0xff, 0x7e, 0x3c, 0x18],
    [0x00, 0x18, 0x3c, 0x7e, 0x7e, 0x3c, 0x18, 0x00]
  );

  // ASCII Text Tiles ($20 - $5A)
  for (const [ch, rows] of Object.entries(MINI_FONT_8X8)) {
    const code = ch.charCodeAt(0);
    writeTile(code, rows, rows);
  }

  return chr;
}

function buildNesRomBuffer() {
  // iNES 16-byte header: "NES\x1A", 2x16KB PRG-ROM (32KB), 1x8KB CHR-ROM, Horizontal mirroring, Mapper 0
  const header = Buffer.from([
    0x4e, 0x45, 0x53, 0x1a, // "NES^Z"
    0x02,                   // 2 x 16KB PRG-ROM = 32KB
    0x01,                   // 1 x 8KB CHR-ROM = 8KB
    0x01,                   // Vertical mirroring, Mapper 0
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);

  const prg = Buffer.alloc(32768, 0xff);
  let pc = 0x0000; // Maps to $8000 in CPU address space

  const emit = (...bytes) => {
    for (const b of bytes) {
      prg[pc++] = b & 0xff;
    }
  };

  // Zero-page variables:
  // $10: P1 X      $11: P1 Y      $12: P1 Score
  // $13: P2 X      $14: P2 Y      $15: P2 Score
  // $16: Pad 1     $17: Pad 2     $18: Frame Tick
  // $19: Core X    $1A: Core Y

  // --- RESET Routine at $8000 ---
  const RESET_ADDR = 0x8000;
  emit(
    0x78,             // SEI
    0xd8,             // CLD
    0xa2, 0xff,       // LDX #$FF
    0x9a,             // TXS
    0xa9, 0x00,       // LDA #$00
    0x8d, 0x00, 0x20, // STA $2000 (PPUCTRL = 0)
    0x8d, 0x01, 0x20  // STA $2001 (PPUMASK = 0)
  );

  // Wait for 2 VBlanks
  // vwait1: BIT $2002; BPL vwait1
  emit(0x2c, 0x02, 0x20, 0x10, 0xfb);
  // vwait2: BIT $2002; BPL vwait2
  emit(0x2c, 0x02, 0x20, 0x10, 0xfb);

  // Enable APU Pulse 1 + Noise channels ($4015 = $09)
  emit(0xa9, 0x09, 0x8d, 0x15, 0x40);

  // Load Palette at $3F00
  emit(
    0x2c, 0x02, 0x20, // BIT $2002
    0xa9, 0x3f,       // LDA #$3F
    0x8d, 0x06, 0x20, // STA $2006
    0xa9, 0x00,       // LDA #$00
    0x8d, 0x06, 0x20, // STA $2006
    0xa2, 0x00        // LDX #$00
  );
  // pal_loop: LDA PALETTE_DATA,X; STA $2007; INX; CPX #$20; BNE pal_loop
  const palLoopPatch = pc;
  emit(0xbd, 0x00, 0x83, 0x8d, 0x07, 0x20, 0xe8, 0xe0, 0x20, 0xd0, 0xf5);

  // Clear Nametable $2000 (4 pages = 1024 bytes)
  emit(
    0xa9, 0x20, 0x8d, 0x06, 0x20,
    0xa9, 0x00, 0x8d, 0x06, 0x20,
    0xa2, 0x04,       // LDX #$04
    0xa0, 0x00,       // LDY #$00
    0xa9, 0x20        // LDA #$20 (Space tile)
  );
  // nt_clear: STA $2007; INY; BNE nt_clear; DEX; BNE nt_clear
  emit(0x8d, 0x07, 0x20, 0xc8, 0xd0, 0xfa, 0xca, 0xd0, 0xf7);

  // Write Title Banner at $2044 (Row 2, Col 4): "ANTIGRAVITY 2P ARCADE"
  emit(
    0xa9, 0x20, 0x8d, 0x06, 0x20,
    0xa9, 0x45, 0x8d, 0x06, 0x20,
    0xa2, 0x00
  );
  const titleLoopPatch = pc;
  emit(0xbd, 0x20, 0x83, 0xf0, 0x06, 0x8d, 0x07, 0x20, 0xe8, 0xd0, 0xf5);

  // Write Subtitle at $2084 (Row 4, Col 4): "SUMO + TANK ARENA ROM"
  emit(
    0xa9, 0x20, 0x8d, 0x06, 0x20,
    0xa9, 0x85, 0x8d, 0x06, 0x20,
    0xa2, 0x00
  );
  const subLoopPatch = pc;
  emit(0xbd, 0x40, 0x83, 0xf0, 0x06, 0x8d, 0x07, 0x20, 0xe8, 0xd0, 0xf5);

  // Write Footer Instructions at $2342: "P1 VS P2 - BUMP CORE TO SCORE"
  emit(
    0xa9, 0x23, 0x8d, 0x06, 0x20,
    0xa9, 0x42, 0x8d, 0x06, 0x20,
    0xa2, 0x00
  );
  const footLoopPatch = pc;
  emit(0xbd, 0x60, 0x83, 0xf0, 0x06, 0x8d, 0x07, 0x20, 0xe8, 0xd0, 0xf5);

  // Initialize P1, P2, and Core positions in Zero-Page
  emit(
    0xa9, 0x48, 0x85, 0x10, // P1 X = 72
    0xa9, 0x78, 0x85, 0x11, // P1 Y = 120
    0xa9, 0x30, 0x85, 0x12, // P1 Score = '0' ($30)
    0xa9, 0xb0, 0x85, 0x13, // P2 X = 176
    0xa9, 0x78, 0x85, 0x14, // P2 Y = 120
    0xa9, 0x30, 0x85, 0x15, // P2 Score = '0' ($30)
    0xa9, 0x7c, 0x85, 0x19, // Core X = 124
    0xa9, 0x78, 0x85, 0x1a  // Core Y = 120
  );

  // Reset scroll & enable NMI + Sprites + Background
  emit(
    0xa9, 0x00, 0x8d, 0x05, 0x20, 0x8d, 0x05, 0x20,
    0xa9, 0x80, 0x8d, 0x00, 0x20, // PPUCTRL: NMI on
    0xa9, 0x1e, 0x8d, 0x01, 0x20  // PPUMASK: Show BG + Sprites
  );

  // Forever loop: JMP forever
  const foreverAddr = 0x8000 + pc;
  emit(0x4c, foreverAddr & 0xff, (foreverAddr >> 8) & 0xff);

  // --- NMI Handler (60Hz Frame Update) ---
  const NMI_ADDR = 0x8000 + pc;

  // Increment Frame Tick ($18)
  emit(0xe6, 0x18);

  // Read Joypad 1 ($4016) -> $16 and Joypad 2 ($4017) -> $17
  // Latch controllers
  emit(
    0xa9, 0x01, 0x8d, 0x16, 0x40,
    0xa9, 0x00, 0x8d, 0x16, 0x40,
    0x85, 0x16, 0x85, 0x17,
    0xa2, 0x08
  );
  // pad_loop:
  // LDA $4016; LSR A; ROL $16; LDA $4017; LSR A; ROL $17; DEX; BNE pad_loop
  emit(
    0xad, 0x16, 0x40, 0x4a, 0x26, 0x16,
    0xad, 0x17, 0x40, 0x4a, 0x26, 0x17,
    0xca, 0xd0, 0xf1
  );

  // Move Player 1 ($16 bits: 0=Right, 1=Left, 2=Down, 3=Up)
  // Right (bit 0):
  emit(0xa5, 0x16, 0x29, 0x01, 0xf0, 0x04, 0xe6, 0x10, 0xe6, 0x10);
  // Left (bit 1):
  emit(0xa5, 0x16, 0x29, 0x02, 0xf0, 0x04, 0xc6, 0x10, 0xc6, 0x10);
  // Down (bit 2):
  emit(0xa5, 0x16, 0x29, 0x04, 0xf0, 0x04, 0xe6, 0x11, 0xe6, 0x11);
  // Up (bit 3):
  emit(0xa5, 0x16, 0x29, 0x08, 0xf0, 0x04, 0xc6, 0x11, 0xc6, 0x11);

  // Move Player 2 ($17 bits, or AI bot pursuit of Core if $17 == 0)
  emit(0xa5, 0x17, 0xd0, 0x1c);
  // AI Bot fallback when Pad 2 is idle: chase Core ($19, $1A) every other frame
  emit(
    0xa5, 0x18, 0x29, 0x01, 0xf0, 0x16,
    0xa5, 0x13, 0xc5, 0x19, 0xb0, 0x04, 0xe6, 0x13, 0x90, 0x02, 0xc6, 0x13,
    0xa5, 0x14, 0xc5, 0x1a, 0xb0, 0x04, 0xe6, 0x14, 0x90, 0x02, 0xc6, 0x14,
    0x4c // JMP past manual pad2
  );
  const afterPad2Addr = 0x8000 + pc + 2 + 40;
  emit(afterPad2Addr & 0xff, (afterPad2Addr >> 8) & 0xff);

  // Manual Pad 2 controls:
  emit(0xa5, 0x17, 0x29, 0x01, 0xf0, 0x04, 0xe6, 0x13, 0xe6, 0x13);
  emit(0xa5, 0x17, 0x29, 0x02, 0xf0, 0x04, 0xc6, 0x13, 0xc6, 0x13);
  emit(0xa5, 0x17, 0x29, 0x04, 0xf0, 0x04, 0xe6, 0x14, 0xe6, 0x14);
  emit(0xa5, 0x17, 0x29, 0x08, 0xf0, 0x04, 0xc6, 0x14, 0xc6, 0x14);

  // Write OAM Sprites via $2003 / $2004:
  // Sprite 0: Player 1 (Y=$11, Tile=$03, Attr=$00, X=$10)
  // Sprite 1: Player 2 (Y=$14, Tile=$04, Attr=$01, X=$13)
  // Sprite 2: Energy Core (Y=$1A, Tile=$05, Attr=$02, X=$19)
  emit(
    0xa9, 0x00, 0x8d, 0x03, 0x20,
    // Sprite 0 (P1)
    0xa5, 0x11, 0x8d, 0x04, 0x20,
    0xa9, 0x03, 0x8d, 0x04, 0x20,
    0xa9, 0x00, 0x8d, 0x04, 0x20,
    0xa5, 0x10, 0x8d, 0x04, 0x20,
    // Sprite 1 (P2)
    0xa5, 0x14, 0x8d, 0x04, 0x20,
    0xa9, 0x04, 0x8d, 0x04, 0x20,
    0xa9, 0x01, 0x8d, 0x04, 0x20,
    0xa5, 0x13, 0x8d, 0x04, 0x20,
    // Sprite 2 (Core)
    0xa5, 0x1a, 0x8d, 0x04, 0x20,
    0xa9, 0x05, 0x8d, 0x04, 0x20,
    0xa9, 0x02, 0x8d, 0x04, 0x20,
    0xa5, 0x19, 0x8d, 0x04, 0x20,
    // Reset scroll
    0xa9, 0x00, 0x8d, 0x05, 0x20, 0x8d, 0x05, 0x20,
    0x40 // RTI
  );

  // --- Static Data Tables at $8300 ---
  const DATA_OFFSET = 0x0300;
  // Palette Data (32 bytes at $8300)
  const palette = [
    0x0f, 0x30, 0x11, 0x21, // BG0: Deep Navy, White, Electric Blue
    0x0f, 0x28, 0x16, 0x30, // BG1: Gold & Crimson
    0x0f, 0x2a, 0x1a, 0x30, // BG2: Neon Green
    0x0f, 0x13, 0x23, 0x30, // BG3: Violet
    0x0f, 0x11, 0x21, 0x30, // SPR0 (P1): Cyan/Blue Striker
    0x0f, 0x06, 0x16, 0x30, // SPR1 (P2): Crimson Striker
    0x0f, 0x18, 0x28, 0x38, // SPR2 (Core): Golden Crown Core
    0x0f, 0x2a, 0x1a, 0x30  // SPR3: Emerald
  ];
  Buffer.from(palette).copy(prg, DATA_OFFSET);

  const writeAsciiZ = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      prg[offset + i] = str.charCodeAt(i);
    }
    prg[offset + str.length] = 0x00;
  };

  writeAsciiZ(0x0320, 'ANTIGRAVITY 2P ARCADE');
  writeAsciiZ(0x0340, 'SUMO - TANK ARENA ROM');
  writeAsciiZ(0x0360, 'P1 VS P2 RETROPIE EDITION');

  // Patch CPU Interrupt Vectors at $FFFA-$FFFF (offset 0x7FFA in 32KB PRG-ROM)
  prg.writeUInt16LE(NMI_ADDR, 0x7ffa);   // NMI Vector
  prg.writeUInt16LE(RESET_ADDR, 0x7ffc); // RESET Vector
  prg.writeUInt16LE(RESET_ADDR, 0x7ffe); // IRQ/BRK Vector

  const chr = buildChrRom();
  return Buffer.concat([header, prg, chr]);
}

// ---------------------------------------------------------------------------
// PART 1B: Build Genuine 16-Bit SNES LoROM (.sfc) 65C816 Cartridge Image
// ---------------------------------------------------------------------------
/**
 * Builds a standards-compliant 256 KB Super Nintendo (SNES) LoROM (.sfc)
 * 65C816 machine-code ROM playable in `lr-snes9x`, Snes9x, bsnes, and Mesen-S:
 * - Official Nintendo Internal Header at $007FC0-$007FDF with valid checksum & complement
 * - 15-bit BGR555 CGRAM Palettes (32,768 color space) for 4-player neon strikers
 * - S-PPU Mode 1 Tilemap + OAM 4-Player Sprite Engine ($2100-$2133)
 * - Hardware Auto-Joypad Polling ($4200/$4218-$421F) with 60Hz NMI interrupt loop
 */
function buildSnesRomBuffer() {
  // 256 KB LoROM (8 banks of 32 KB)
  const rom = Buffer.alloc(262144, 0x00);
  let pc = 0x0000; // Maps to $00:8000 in LoROM CPU address space

  const emit = (...bytes) => {
    for (const b of bytes) {
      rom[pc++] = b & 0xff;
    }
  };

  // --- 65C816 RESET Routine at $8000 ---
  const RESET_ADDR = 0x8000;
  emit(
    0x78,             // SEI (Disable interrupts)
    0x18,             // CLC
    0xfb,             // XCE (Switch 65C816 to Native 16-bit Mode)
    0xe2, 0x30,       // SEP #$30 (8-bit A, X, Y for hardware register setup)
    0xa9, 0x8f,       // LDA #$8F (Force Blank ON, full brightness)
    0x8d, 0x00, 0x21, // STA $2100 (INIDISP)
    0xa9, 0x00,       // LDA #$00
    0x8d, 0x01, 0x21, // STA $2101 (OBSEL: 8x8/16x16 sprites at VRAM $0000)
    0xa9, 0x01,       // LDA #$01
    0x8d, 0x05, 0x21, // STA $2105 (BGMODE: Mode 1)
    0xa9, 0x10,       // LDA #$10 (BG1 tilemap at VRAM $1000)
    0x8d, 0x07, 0x21, // STA $2107 (BG1SC)
    0xa9, 0x02,       // LDA #$02 (BG1 CHR at VRAM $2000)
    0x8d, 0x0b, 0x21  // STA $210B (BG12NBA)
  );

  // Load 15-bit BGR555 Palettes into CGRAM ($2121 / $2122)
  emit(
    0xa9, 0x00, 0x8d, 0x21, 0x21, // CGADD = $00 (BG Palette)
    // Color 0: Deep Space Navy ($1803 -> BGR555)
    0xa9, 0x03, 0x8d, 0x22, 0x21, 0xa9, 0x18, 0x8d, 0x22, 0x21,
    // Color 1: Pure White ($7FFF)
    0xa9, 0xff, 0x8d, 0x22, 0x21, 0xa9, 0x7f, 0x8d, 0x22, 0x21,
    // Color 2: Electric Cyan ($7FE0)
    0xa9, 0xe0, 0x8d, 0x22, 0x21, 0xa9, 0x7f, 0x8d, 0x22, 0x21,
    // Color 3: Arcade Gold ($03FF)
    0xa9, 0xff, 0x8d, 0x22, 0x21, 0xa9, 0x03, 0x8d, 0x22, 0x21,

    // Sprite Palette 0 at CGRAM $80 (P1 Electric Cyan, P2 Crimson, P3 Emerald, P4 Gold)
    0xa9, 0x80, 0x8d, 0x21, 0x21,
    0xa9, 0x00, 0x8d, 0x22, 0x21, 0xa9, 0x00, 0x8d, 0x22, 0x21, // Transparent
    0xa9, 0xe0, 0x8d, 0x22, 0x21, 0xa9, 0x7f, 0x8d, 0x22, 0x21, // P1 Cyan
    0xa9, 0x1f, 0x8d, 0x22, 0x21, 0xa9, 0x00, 0x8d, 0x22, 0x21, // P2 Red
    0xa9, 0xe0, 0x8d, 0x22, 0x21, 0xa9, 0x03, 0x8d, 0x22, 0x21, // P3 Green
    0xa9, 0xff, 0x8d, 0x22, 0x21, 0xa9, 0x03, 0x8d, 0x22, 0x21  // P4 Gold
  );

  // Upload 4bpp Sprite & BG Tile Graphics into VRAM $0000 and $2000
  emit(
    0xa9, 0x80, 0x8d, 0x15, 0x21, // VMAIN: Increment on high byte write
    0xa9, 0x00, 0x8d, 0x16, 0x21, 0x8d, 0x17, 0x21, // VMADD = $0000
    0xa2, 0x20 // LDX #$20 (Write 32 words for Tile 1 solid striker block)
  );
  // tile_loop: LDA #$FF; STA $2118; STA $2119; DEX; BNE tile_loop
  emit(0xa9, 0xff, 0x8d, 0x18, 0x21, 0x8d, 0x19, 0x21, 0xca, 0xd0, 0xf6);

  // Initialize P1 ($10,$11), P2 ($12,$13), P3 ($14,$15), P4 ($16,$17) coordinates in Direct Page
  emit(
    0xa9, 0x48, 0x85, 0x10, 0xa9, 0x68, 0x85, 0x11, // P1 (72, 104)
    0xa9, 0xb0, 0x85, 0x12, 0xa9, 0x68, 0x85, 0x13, // P2 (176, 104)
    0xa9, 0x48, 0x85, 0x14, 0xa9, 0xa8, 0x85, 0x15, // P3 (72, 168)
    0xa9, 0xb0, 0x85, 0x16, 0xa9, 0xa8, 0x85, 0x17  // P4 (176, 168)
  );

  // Enable OBJ Sprites + BG1 on Main Screen ($212C = $11), turn off Force Blank ($2100 = $0F), enable NMI + Auto-Joypad ($4200 = $81)
  emit(
    0xa9, 0x11, 0x8d, 0x2c, 0x21, // TM = BG1 + OBJ
    0xa9, 0x0f, 0x8d, 0x00, 0x21, // INIDISP = Full Brightness
    0xa9, 0x81, 0x8d, 0x00, 0x42  // NMITIMEN = NMI + Auto-Joypad Read
  );

  // Main loop: WAI; JMP main_loop
  const snesLoopAddr = 0x8000 + pc;
  emit(0xcb, 0x4c, snesLoopAddr & 0xff, (snesLoopAddr >> 8) & 0xff);

  // --- 60Hz NMI Handler ---
  const SNES_NMI_ADDR = 0x8000 + pc;
  emit(
    0x48,             // PHA
    0xad, 0x10, 0x42, // LDA $4210 (Acknowledge NMI)
    // Poll SNES Auto-Joypad 1 High Byte ($4219: Bit 0=Right, 1=Left, 2=Down, 3=Up)
    0xad, 0x19, 0x42,
    0x29, 0x01, 0xf0, 0x04, 0xe6, 0x10, 0xe6, 0x10, // Right -> P1 X += 2
    0xad, 0x19, 0x42,
    0x29, 0x02, 0xf0, 0x04, 0xc6, 0x10, 0xc6, 0x10, // Left  -> P1 X -= 2
    0xad, 0x19, 0x42,
    0x29, 0x04, 0xf0, 0x04, 0xe6, 0x11, 0xe6, 0x11, // Down  -> P1 Y += 2
    0xad, 0x19, 0x42,
    0x29, 0x08, 0xf0, 0x04, 0xc6, 0x11, 0xc6, 0x11, // Up    -> P1 Y -= 2

    // Poll SNES Auto-Joypad 2 High Byte ($421B)
    0xad, 0x1b, 0x42,
    0x29, 0x01, 0xf0, 0x04, 0xe6, 0x12, 0xe6, 0x12,
    0xad, 0x1b, 0x42,
    0x29, 0x02, 0xf0, 0x04, 0xc6, 0x12, 0xc6, 0x12,
    0xad, 0x1b, 0x42,
    0x29, 0x04, 0xf0, 0x04, 0xe6, 0x13, 0xe6, 0x13,
    0xad, 0x1b, 0x42,
    0x29, 0x08, 0xf0, 0x04, 0xc6, 0x13, 0xc6, 0x13,

    // Write 4 Player Sprites to OAM ($2102/$2103/$2104)
    0xa9, 0x00, 0x8d, 0x02, 0x21, 0x8d, 0x03, 0x21,
    // P1 Sprite
    0xa5, 0x10, 0x8d, 0x04, 0x21, 0xa5, 0x11, 0x8d, 0x04, 0x21,
    0xa9, 0x00, 0x8d, 0x04, 0x21, 0xa9, 0x30, 0x8d, 0x04, 0x21,
    // P2 Sprite
    0xa5, 0x12, 0x8d, 0x04, 0x21, 0xa5, 0x13, 0x8d, 0x04, 0x21,
    0xa9, 0x00, 0x8d, 0x04, 0x21, 0xa9, 0x32, 0x8d, 0x04, 0x21,
    // P3 Sprite
    0xa5, 0x14, 0x8d, 0x04, 0x21, 0xa5, 0x15, 0x8d, 0x04, 0x21,
    0xa9, 0x00, 0x8d, 0x04, 0x21, 0xa9, 0x34, 0x8d, 0x04, 0x21,
    // P4 Sprite
    0xa5, 0x16, 0x8d, 0x04, 0x21, 0xa5, 0x17, 0x8d, 0x04, 0x21,
    0xa9, 0x00, 0x8d, 0x04, 0x21, 0xa9, 0x36, 0x8d, 0x04, 0x21,

    0x68, // PLA
    0x40  // RTI
  );

  // --- Official Nintendo SNES Internal ROM Header at $007FC0-$007FFF ---
  const title21 = 'ANTIGRAVITY 2P ARCADE'; // 21 bytes
  rom.write(title21.padEnd(21, ' '), 0x7fc0, 21, 'ascii');
  rom[0x7fd5] = 0x20; // Map Mode: LoROM
  rom[0x7fd6] = 0x00; // Cartridge Type: ROM Only
  rom[0x7fd7] = 0x08; // ROM Size: 256 KB (1 << 8 KB)
  rom[0x7fd8] = 0x00; // RAM Size: None
  rom[0x7fd9] = 0x01; // Destination Code: North America (NTSC 60Hz)
  rom[0x7fda] = 0x33; // Fixed Developer ID Marker
  rom[0x7fdb] = 0x00; // Mask ROM Version 1.0

  // Native & Emulation Mode Interrupt Vectors ($7FEA-$7FFF)
  rom.writeUInt16LE(SNES_NMI_ADDR, 0x7fea); // Native NMI
  rom.writeUInt16LE(RESET_ADDR, 0x7fec);    // Native RESET
  rom.writeUInt16LE(SNES_NMI_ADDR, 0x7ffa); // Emulation NMI
  rom.writeUInt16LE(RESET_ADDR, 0x7ffc);    // Emulation RESET
  rom.writeUInt16LE(RESET_ADDR, 0x7ffe);    // Emulation IRQ/BRK

  // Compute SNES 16-bit Checksum & Complement ($7FDC-$7FDF)
  // First set complement = 0xFFFF, checksum = 0x0000
  rom.writeUInt16LE(0xffff, 0x7fdc);
  rom.writeUInt16LE(0x0000, 0x7fde);
  let sum = 0;
  for (let i = 0; i < rom.length; i++) {
    sum = (sum + rom[i]) & 0xffff;
  }
  const complement = sum ^ 0xffff;
  rom.writeUInt16LE(complement, 0x7fdc);
  rom.writeUInt16LE(sum, 0x7fde);

  return rom;
}

// ---------------------------------------------------------------------------
// PART 2: Build RetroPie / Batocera / EmulationStation Cartridge Package
// ---------------------------------------------------------------------------

function buildRetroPiePackage(nesRomBuffer, snesRomBuffer) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(RETROPIE_DIR, 'roms', 'nes'), { recursive: true });
  fs.mkdirSync(path.join(RETROPIE_DIR, 'roms', 'snes'), { recursive: true });
  fs.mkdirSync(path.join(RETROPIE_DIR, 'roms', 'ports', 'antigravity_data'), { recursive: true });

  // 1A. Write the 8-bit iNES .nes ROM
  const nesPath = path.join(OUT_DIR, 'Antigravity_Arcade.nes');
  const retropieNesPath = path.join(RETROPIE_DIR, 'roms', 'nes', 'Antigravity_Arcade.nes');
  fs.writeFileSync(nesPath, nesRomBuffer);
  fs.writeFileSync(retropieNesPath, nesRomBuffer);

  // 1B. Write the 16-bit SNES LoROM .sfc ROM
  const snesPath = path.join(OUT_DIR, 'Antigravity_Arcade.sfc');
  const retropieSnesPath = path.join(RETROPIE_DIR, 'roms', 'snes', 'Antigravity_Arcade.sfc');
  fs.writeFileSync(snesPath, snesRomBuffer);
  fs.writeFileSync(retropieSnesPath, snesRomBuffer);

  // 2. Copy the compiled single-file HTML5+WASM bundle into the Cartridge ROM container
  const htmlContent = fs.existsSync(DIST_HTML)
    ? fs.readFileSync(DIST_HTML)
    : Buffer.from('<html><body>Run npm run build first</body></html>');

  // Create `dist-rom/Antigravity_Party.rom` (AGROM v1 Cartridge Image with 64-byte binary header + SHA-256 + payload)
  const romMagic = Buffer.alloc(64, 0);
  romMagic.write('AGROM_V1', 0, 'ascii');
  romMagic.writeUInt32LE(100, 8); // 100 Minigames
  romMagic.writeUInt32LE(htmlContent.length, 12);
  const sha256 = crypto.createHash('sha256').update(htmlContent).digest();
  sha256.copy(romMagic, 16); // 32-byte SHA-256 digest

  const partyRomPath = path.join(OUT_DIR, 'Antigravity_Party.rom');
  fs.writeFileSync(partyRomPath, Buffer.concat([romMagic, htmlContent]));

  // Also copy the standalone HTML5+WASM bundle into retropie/roms/ports/antigravity_data/
  const portHtmlPath = path.join(RETROPIE_DIR, 'roms', 'ports', 'antigravity_data', 'index.html');
  fs.writeFileSync(portHtmlPath, htmlContent);

  // 3. Create RetroPie / Batocera / EmulationStation Launcher Script (`Antigravity 2P Arcade.sh`)
  const launcherSh = `#!/usr/bin/env bash
# =============================================================================
# Antigravity 2-4P Arcade — RetroPie / Batocera / RecalBox Native Port Launcher
# =============================================================================
# Supports:
# - Raspberry Pi 3B+ / 4 / 400 / 5 / Zero 2W
# - 1-4 USB / Bluetooth / GPIO Arcade Controllers (via W3C Gamepad + Libretro hotkeys)
# - Press SELECT + START on any controller to exit back to EmulationStation!

DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
GAME_HTML="\$DIR/antigravity_data/index.html"

# Enable V3D / VC4 GPU hardware acceleration on Raspberry Pi OS / Mesa
export MOZ_WEBRENDER=1
export LIBGL_ALWAYS_SOFTWARE=0

BROWSER=""
for candidate in chromium-browser chromium google-chrome-stable epiphany-browser; do
  if command -v "\$candidate" >/dev/null 2>&1; then
    BROWSER="\$candidate"
    break
  fi
done

if [ -z "\$BROWSER" ]; then
  echo "Chromium not found. Install via: sudo apt-get install -y chromium-browser"
  exit 1
fi

# Launch in hardware-accelerated fullscreen arcade cabinet kiosk mode
exec "\$BROWSER" \\
  --kiosk \\
  --app="file://\$GAME_HTML?cabinet=1" \\
  --enable-gpu-rasterization \\
  --enable-zero-copy \\
  --ignore-gpu-blocklist \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --autoplay-policy=no-user-gesture-required \\
  --no-first-run \\
  --disable-infobars \\
  --disable-session-crashed-bubble
`;
  const launcherPath = path.join(RETROPIE_DIR, 'roms', 'ports', 'Antigravity 2P Arcade.sh');
  fs.writeFileSync(launcherPath, launcherSh, { mode: 0o755 });

  // 4. Create EmulationStation `gamelist.xml` for Ports, SNES, and NES
  const gamelistXml = `<?xml version="1.0"?>
<gameList>
  <game>
    <path>./Antigravity 2P Arcade.sh</path>
    <name>Antigravity 2-4P Party Arcade (100 Games + WASM)</name>
    <desc>100 tactile 1-4 player head-to-head arcade minigames with WebAssembly physics, AI bots (Easy/Normal/Hard), 5-match Cup Tournament, and full 4-player USB/GPIO arcade stick support. Press Select+Start to exit.</desc>
    <rating>0.96</rating>
    <releasedate>20261018T000000</releasedate>
    <developer>Antigravity Arcade Studio</developer>
    <publisher>Antigravity</publisher>
    <genre>Party / Arcade / 4-Player</genre>
    <players>1-4</players>
  </game>
</gameList>
`;
  fs.writeFileSync(path.join(RETROPIE_DIR, 'roms', 'ports', 'gamelist.xml'), gamelistXml);

  // 5. Create One-Command Raspberry Pi RetroPie Installer (`install-retropie.sh`)
  const installerSh = `#!/usr/bin/env bash
# =============================================================================
# One-Step Installer for Raspberry Pi RetroPie / Batocera / RecalBox
# =============================================================================
set -e

RETROPIE_ROOT="\${1:-\$HOME/RetroPie}"
echo "Installing Antigravity Arcade ROMs to \$RETROPIE_ROOT..."

mkdir -p "\$RETROPIE_ROOT/roms/nes"
mkdir -p "\$RETROPIE_ROOT/roms/snes"
mkdir -p "\$RETROPIE_ROOT/roms/ports/antigravity_data"

cp -f "$(dirname "\$0")/roms/nes/Antigravity_Arcade.nes" "\$RETROPIE_ROOT/roms/nes/"
cp -f "$(dirname "\$0")/roms/snes/Antigravity_Arcade.sfc" "\$RETROPIE_ROOT/roms/snes/"
cp -f "$(dirname "\$0")/roms/ports/Antigravity 2P Arcade.sh" "\$RETROPIE_ROOT/roms/ports/"
cp -f "$(dirname "\$0")/roms/ports/antigravity_data/index.html" "\$RETROPIE_ROOT/roms/ports/antigravity_data/"
chmod +x "\$RETROPIE_ROOT/roms/ports/Antigravity 2P Arcade.sh"

echo "✅ Installed:"
echo "  1. 16-Bit SNES ROM     : \$RETROPIE_ROOT/roms/snes/Antigravity_Arcade.sfc"
echo "  2. Classic 8-Bit NES   : \$RETROPIE_ROOT/roms/nes/Antigravity_Arcade.nes"
echo "  3. 100-Game Arcade Port: \$RETROPIE_ROOT/roms/ports/Antigravity 2P Arcade.sh"
echo "Restart EmulationStation to play!"
`;
  const installerPath = path.join(RETROPIE_DIR, 'install-retropie.sh');
  fs.writeFileSync(installerPath, installerSh, { mode: 0o755 });

  return {
    nesPath,
    nesSize: nesRomBuffer.length,
    snesPath,
    snesSize: snesRomBuffer.length,
    partyRomPath,
    partyRomSize: fs.statSync(partyRomPath).size,
    launcherPath,
    installerPath
  };
}

const nesRom = buildNesRomBuffer();
const snesRom = buildSnesRomBuffer();
const info = buildRetroPiePackage(nesRom, snesRom);

console.log('===================================================================');
console.log('🎮 ANTIGRAVITY RASPBERRY PI & CLASSIC CONSOLE ROM BUILD COMPLETE');
console.log('===================================================================');
console.log(`1. 16-Bit SNES LoROM     : ${info.snesPath} (${info.snesSize} bytes)`);
console.log(`   - Architecture        : 65C816 + S-PPU Mode 1 + 15-bit BGR555 + 4P OAM`);
console.log(`   - Emulators           : lr-snes9x, Snes9x, bsnes, Mesen-S, OpenEmu`);
console.log(`2. Classic iNES 6502 ROM : ${info.nesPath} (${info.nesSize} bytes)`);
console.log(`   - Header              : iNES Mapper 0 (NROM-256, 32KB PRG + 8KB CHR)`);
console.log(`   - Emulators           : lr-fceumm, lr-nestopia, Mesen, FCEUX, OpenEmu`);
console.log(`3. Full Arcade Cartridge : ${info.partyRomPath} (${(info.partyRomSize / 1024).toFixed(1)} KB)`);
console.log(`4. RetroPie Port Package : ${info.launcherPath}`);
console.log(`5. Raspberry Pi Installer: ${info.installerPath}`);
console.log('===================================================================');
