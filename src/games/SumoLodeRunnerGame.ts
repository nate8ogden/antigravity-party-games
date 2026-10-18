import { BaseGame, DEFAULT_MUTATOR } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

/**
 * Tile Constants (stored in shared WebAssembly Linear Memory mem[0..447])
 */
export const TILE_EMPTY = 0;
export const TILE_BRICK = 1;         // Diggable Dohyō clay / biome turf
export const TILE_SOLID = 2;         // Indestructible Imperial stone / bedrock
export const TILE_LADDER = 3;        // Climbable bamboo ladder
export const TILE_ROPE = 4;          // Hand-over-hand Shimenawa sacred rope
export const TILE_TRAPDOOR = 5;      // False brick: looks like TILE_BRICK, falls straight through!
export const TILE_HIDDEN_LADDER = 6; // Revealed only when all Gold on the stage is collected

/**
 * Dynamic Overlay Constants (stored in shared WebAssembly Linear Memory mem[512..959])
 */
export const DYN_NONE = 0;
export const DYN_DUG_HOLE = 1;       // Dug brick pit (entities fall in; guards get trapped)
export const DYN_TRAPPED_GUARD = 2;  // Dug pit occupied by a trapped guard (acts as solid bridge!)

export const GRID_COLS = 28;
export const GRID_ROWS = 16;
export const GRID_SIZE = GRID_COLS * GRID_ROWS; // 448 cells

/**
 * Pre-compiled 283-byte Inline WebAssembly (Wasm) Physics & Grid Kernel.
 * Instantiated synchronously via new WebAssembly.Module / WebAssembly.Instance
 * with zero external network fetches so it works 100% inside the single-file bundle.
 *
 * Exports:
 * - mem: WebAssembly.Memory (1 page = 64KB, shared with JS Uint8Array views)
 * - isSupported(col: i32, row: i32, escapeRevealed: i32) -> i32 (1 if floor/ladder supported, 0 if falling)
 * - manhattanCost(c1: i32, r1: i32, c2: i32, r2: i32) -> i32 (|c1-c2| + |r1-r2|*2)
 */
const WASM_LODE_KERNEL_BYTES = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 16, 2, 96, 3, 127, 127, 127, 1, 127, 96, 4, 127, 127, 127, 127, 1, 127,
  3, 3, 2, 0, 1, 5, 3, 1, 0, 1, 7, 37, 3, 3, 109, 101, 109, 2, 0, 11, 105, 115, 83, 117, 112, 112, 111,
  114, 116, 101, 100, 0, 0, 13, 109, 97, 110, 104, 97, 116, 116, 97, 110, 67, 111, 115, 116, 0, 1, 10,
  205, 1, 2, 149, 1, 1, 5, 127, 32, 0, 65, 0, 72, 32, 0, 65, 28, 78, 114, 32, 1, 65, 0, 72, 114, 4, 64,
  65, 0, 15, 11, 32, 1, 65, 15, 78, 4, 64, 65, 1, 15, 11, 32, 1, 65, 28, 108, 32, 0, 106, 34, 3, 45, 0,
  0, 34, 4, 65, 3, 70, 4, 64, 65, 1, 15, 11, 32, 4, 65, 6, 70, 32, 2, 69, 69, 113, 4, 64, 65, 1, 15, 11,
  32, 3, 65, 28, 106, 34, 5, 45, 0, 128, 4, 34, 7, 65, 2, 70, 4, 64, 65, 1, 15, 11, 32, 7, 65, 1, 70, 4,
  64, 65, 0, 15, 11, 32, 5, 45, 0, 0, 34, 6, 65, 1, 70, 32, 6, 65, 2, 70, 114, 32, 6, 65, 3, 70, 114, 4,
  64, 65, 1, 15, 11, 32, 6, 65, 6, 70, 32, 2, 69, 69, 113, 11, 52, 1, 2, 127, 32, 0, 32, 2, 107, 34, 4,
  65, 0, 72, 4, 64, 65, 0, 32, 4, 107, 33, 4, 11, 32, 1, 32, 3, 107, 34, 5, 65, 0, 72, 4, 64, 65, 0, 32,
  5, 107, 33, 5, 11, 32, 4, 32, 5, 65, 2, 108, 106, 11
]);

interface WasmLodeExports {
  mem: WebAssembly.Memory;
  isSupported: (col: number, row: number, escapeRevealed: number) => number;
  manhattanCost: (c1: number, r1: number, c2: number, r2: number) => number;
}

export interface BiomePalette {
  name: string;
  jpSubtitle: string;
  bgTop: string;
  bgBottom: string;
  brickMain: string;
  brickLight: string;
  brickDark: string;
  brickMortar: string;
  tawaraAccent: string;
  solidMain: string;
  solidLight: string;
  solidDark: string;
  ladderRail: string;
  ladderRung: string;
  ropeColor: string;
  lanternGlow: string;
}

const BIOME_PALETTES: BiomePalette[] = [
  // Chapter 1 (Levels 1-6): Edo Kokugikan Dojo
  {
    name: 'Edo Kokugikan Dojo',
    jpSubtitle: '第一章・江戸国技館',
    bgTop: '#1A110B',
    bgBottom: '#2D1D12',
    brickMain: '#B45309',
    brickLight: '#D97706',
    brickDark: '#78350F',
    brickMortar: '#451A03',
    tawaraAccent: '#FDE68A',
    solidMain: '#334155',
    solidLight: '#64748B',
    solidDark: '#0F172A',
    ladderRail: '#D97706',
    ladderRung: '#FDE68A',
    ropeColor: '#FBBF24',
    lanternGlow: 'rgba(251, 146, 60, 0.16)'
  },
  // Chapter 2 (Levels 7-12): Arashiyama Bamboo Shrine
  {
    name: 'Arashiyama Bamboo Shrine',
    jpSubtitle: '第二章・嵐山竹林神社',
    bgTop: '#061A14',
    bgBottom: '#0F2E22',
    brickMain: '#15803D',
    brickLight: '#22C55E',
    brickDark: '#14532D',
    brickMortar: '#052E16',
    tawaraAccent: '#86EFAC',
    solidMain: '#3F3F46',
    solidLight: '#71717A',
    solidDark: '#18181B',
    ladderRail: '#65A30D',
    ladderRung: '#BEF264',
    ropeColor: '#FDE047',
    lanternGlow: 'rgba(52, 211, 153, 0.15)'
  },
  // Chapter 3 (Levels 13-18): Hokkaido Frost Onsen
  {
    name: 'Hokkaido Frost Onsen',
    jpSubtitle: '第三章・北海氷雪温泉',
    bgTop: '#081B2E',
    bgBottom: '#0F2D4A',
    brickMain: '#0284C7',
    brickLight: '#38BDF8',
    brickDark: '#0369A1',
    brickMortar: '#082F49',
    tawaraAccent: '#E0F2FE',
    solidMain: '#1E293B',
    solidLight: '#475569',
    solidDark: '#020617',
    ladderRail: '#0EA5E9',
    ladderRung: '#BAE6FD',
    ropeColor: '#F8FAFC',
    lanternGlow: 'rgba(56, 189, 248, 0.16)'
  },
  // Chapter 4 (Levels 19-24): Kagoshima Magma Forge
  {
    name: 'Kagoshima Magma Forge',
    jpSubtitle: '第四章・桜島溶岩鍛冶場',
    bgTop: '#1F0909',
    bgBottom: '#3B0D0C',
    brickMain: '#991B1B',
    brickLight: '#DC2626',
    brickDark: '#450A0A',
    brickMortar: '#F97316',
    tawaraAccent: '#FDBA74',
    solidMain: '#27272A',
    solidLight: '#52525B',
    solidDark: '#09090B',
    ladderRail: '#EA580C',
    ladderRung: '#FDBA74',
    ropeColor: '#FCD34D',
    lanternGlow: 'rgba(239, 68, 68, 0.18)'
  },
  // Chapter 5 (Levels 25-30): Imperial Golden Castle
  {
    name: 'Imperial Golden Castle',
    jpSubtitle: '最終章・黄金横綱天守閣',
    bgTop: '#170B2B',
    bgBottom: '#2A124C',
    brickMain: '#9333EA',
    brickLight: '#C084FC',
    brickDark: '#581C87',
    brickMortar: '#3B0764',
    tawaraAccent: '#FDE047',
    solidMain: '#422006',
    solidLight: '#CA8A04',
    solidDark: '#1C1917',
    ladderRail: '#EAB308',
    ladderRung: '#FEF08A',
    ropeColor: '#FEF08A',
    lanternGlow: 'rgba(250, 204, 21, 0.20)'
  }
];

export interface LevelBlueprint {
  level: number;
  title: string;
  hint?: string;
  guardCount: number;
  guardSpeed: number;     // tiles per second
  holeDuration: number;   // seconds brick remains open
  trapDuration: number;   // seconds guard stays trapped in hole
  rows: string[];         // 16 rows of 28 chars
}

/**
 * Interactive Stage 0 Tutorial Dojo ("Yokozuna Training Dojo")
 * Teaches:
 * 1. Climbing Bamboo Ladders (H) & collecting Gold ($)
 * 2. Digging Dohyō Clay Bricks (#) diagonally with [SPACE / Q / E]
 * 3. Crossing Sacred Shimenawa Ropes (-) & dropping down with [S / DOWN]
 * 4. Trapping an Oni-Sumo Guard (E) in a dug pit & walking across its head
 * 5. Climbing the revealed Golden Escape Ladder (S) to the top exit
 */
export const SUMO_LODE_TUTORIAL_LEVEL: LevelBlueprint = {
  level: 0,
  title: 'Yokozuna Training Dojo',
  hint: 'Follow the 5 numbered steps to master Lode Runner mechanics! Infinite lives in Training Dojo.',
  guardCount: 1,
  guardSpeed: 2.0,
  holeDuration: 9.5,
  trapDuration: 5.5,
  rows: [
    '.............S..............',
    '.............S..............',
    '.............S....$.........',
    '@@@@@@@@@@@@HSH#########@@@@',
    '..............H.............',
    '..............H...E.........',
    '..............##########H...',
    '............H---------..H...',
    '............H...........H...',
    '............H.......$...H...',
    '......$.....H.....@@@@@@@...',
    '....#####H###...............',
    '....H....H.$#...............',
    '....H....H.X#...............',
    '..P.H..Q.H..................',
    '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
  ]
};

/**
 * 40 Hand-Crafted Sumo Lode Runner Levels (28 cols x 16 rows each).
 * - Stages 1–10: Inspired by Original 1983 Broderbund Lode Runner level designs
 * - Stages 11–40: Expanded Edo, Bamboo, Frost, Magma & Imperial Castle campaigns with 1983 & 1994 dynamics
 */
export const SUMO_LODE_LEVELS: LevelBlueprint[] = [
  // =========================================================================
  // CHAPTER 1: 1983 BRODERBUND HERITAGE DOJO (Levels 1 - 10)
  // =========================================================================
  {
    level: 1,
    title: '1983 Classic: First Strike',
    hint: 'Inspired by Original Lode Runner Stage 1! Climb ladders, cross the rope bridge, and dig bricks [SPACE / Q / E].',
    guardCount: 1,
    guardSpeed: 2.35,
    holeDuration: 8.8,
    trapDuration: 5.0,
    rows: [
      '.............S..............',
      '.............S..............',
      '....$........S.......$......',
      '#######H#####S####H#########',
      '.......H.....S....H.........',
      '.......H##########H.........',
      '.......H----------H....E....',
      '.......H..........#######H##',
      '.......H...$.............H..',
      '##H###########...........H..',
      '..H......................H..',
      '..H....$.............$...H..',
      '..H..#####H#######H#####.H..',
      '..H.......H.......H......H..',
      '..H...P...H...$...H..Q...H..',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 2,
    title: '1983 Classic: Rope & Freefall',
    hint: 'Shimmy out along the Sacred Ropes (-) and press DOWN [S / ▼] above floating mid-air Gold to snatch it as you fall!',
    guardCount: 1,
    guardSpeed: 2.45,
    holeDuration: 8.5,
    trapDuration: 4.8,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S...........$..',
      '###H---------S----------H###',
      '...H....................H...',
      '...H.....$........$.....H...',
      '...H.........E..........H...',
      '...H...#####H..H#####...H...',
      '...H........H..H........H...',
      '...H---..$..H..H..$..---H...',
      '...H........H..H........H...',
      '...H..#######..#######..H...',
      '...H..H..............H..H...',
      '...H..H...$......$...H..H...',
      '...H..H...P......Q...H..H...',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 3,
    title: '1983 Classic: Bedrock & Clay',
    hint: 'Dark Stone (@) cannot be dug! Lure the Oni Guard onto Clay Bricks (#) to trap it, and dig into the 2 side vaults.',
    guardCount: 1,
    guardSpeed: 2.55,
    holeDuration: 8.2,
    trapDuration: 4.6,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S...........$..',
      '####H@@@@@@@HS@@@@@@@H######',
      '....H.......H........H......',
      '....H..$....H...E..$.H......',
      '....#######.H.#######H......',
      '....H.......H........H......',
      '....H#######H########H......',
      '....H..#$#..H...#$#..H......',
      '....H..#X#..H...#X#..H......',
      '..$.H.......H........H..$...',
      '####H@@@@@@@H@@@@@@@@H######',
      '....H.......H........H......',
      '....H...P...H....Q...H......',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 4,
    title: '1983 Classic: Secret Chimney',
    hint: 'False Bricks (X) look like solid walls with a hairline crack — drop straight through the central chimney for Gold!',
    guardCount: 2,
    guardSpeed: 2.65,
    holeDuration: 8.0,
    trapDuration: 4.5,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E...--S--...E.....$..',
      '#####H######XSX######H######',
      '.....H......XSX......H......',
      '.....H..$...$S$...$..H......',
      '.....H.#####XSX#####.H......',
      '.....H......$S$......H......',
      '.....H..####XSX####..H......',
      '.....H..H..$.S.$..H..H......',
      '.....H..H#########H..H......',
      '..$..H..H.........H..H..$...',
      '#####H..H..#####..H..H######',
      '.....H..H..H...H..H..H......',
      '....PH..H..H...H..H..HQ.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 5,
    title: '1983 Classic: Twin Pagodas',
    hint: 'Cross between the Twin Pagodas using the high rope, or excavate the brick vaults on the middle terraces!',
    guardCount: 2,
    guardSpeed: 2.75,
    holeDuration: 7.8,
    trapDuration: 4.4,
    rows: [
      '.............S..............',
      '.............S..............',
      '...$.........S..........$...',
      '..H####H-----S-----H#####H..',
      '..H....H...........H.....H..',
      '..H.E..H...$...$...H..E..H..',
      '..H#####..#######..#####.H..',
      '..H.......H.....H........H..',
      '..H..###..H..$..H..###...H..',
      '..H..#$#..H.###.H..#$#...H..',
      '..H..#X#..H.#$#.H..#X#...H..',
      '..H.......H.#X#.H........H..',
      '..H#######H.....H########H..',
      '..H.......H.....H........H..',
      '..H...P...H.....H...Q....H..',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 6,
    title: '1983 Classic: Skyfall Columns',
    hint: 'Dig the brick (#) directly above each vertical column of mid-air Gold, then jump through the hole to collect them all!',
    guardCount: 2,
    guardSpeed: 2.85,
    holeDuration: 7.8,
    trapDuration: 4.3,
    rows: [
      '.............S..............',
      '.............S..............',
      '....$........S........$.....',
      '##H##########S##########H###',
      '..H.....................H...',
      '..H...$......E......$...H...',
      '..H......................H..',
      '..H...$.............$...H...',
      '..H......H#######H......H...',
      '..H######H.......H######H...',
      '..H......H...$...H......H...',
      '..H..E...H..###..H......H...',
      '..H######H..#$#..H######H...',
      '..H......H..#X#..H......H...',
      '..H..P...H.......H...Q..H...',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 7,
    title: '1983 Classic: Zig-Zag Switchback',
    hint: 'Dig holes in the long brick decks to drop down a floor fast—or trap pursuing Oni Guards behind you!',
    guardCount: 2,
    guardSpeed: 2.95,
    holeDuration: 7.6,
    trapDuration: 4.2,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S..........$...',
      '######################H#####',
      '......................H.....',
      '....$........$........H.$...',
      '####H#######################',
      '....H.......................',
      '..$.H........E........$.....',
      '######################H#####',
      '......................H.....',
      '....$........$........H.$...',
      '####H#######################',
      '....H.......................',
      '....H....P.......Q..........',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 8,
    title: '1983 Classic: The 2-1 Staircase',
    hint: 'To dig 2 layers deep: dig TWO adjacent bricks on the top row, step into the first hole, and dig the brick below!',
    guardCount: 2,
    guardSpeed: 3.0,
    holeDuration: 8.0,
    trapDuration: 4.2,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E....$...',
      '#####H#######S#######H######',
      '.....H.......S.......H......',
      '.....H..###########..H......',
      '.....H..###$###$###..H......',
      '.....H..###X###X###..H......',
      '..$..H...............H..$...',
      '####H########H########H#####',
      '....H........H........H.....',
      '....H..#####.H.#####..H.....',
      '....H..##$##.H.##$##..H.....',
      '....H..##X##.H.##X##..H.....',
      '....H...P....H....Q...H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 9,
    title: '1983 Classic: Guardhouse Pit',
    hint: 'Use the overhead Sacred Rope to cross above the central Oni Guardhouse, or bait them out onto the brick wings!',
    guardCount: 2,
    guardSpeed: 3.05,
    holeDuration: 7.5,
    trapDuration: 4.1,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '####H--------S--------H#####',
      '....H........S........H.....',
      '....H..$.....S.....$..H.....',
      '....H.####H#####H####.H.....',
      '....H.H...H..$..H...H.H.....',
      '....H.H.$.H.E.E.H.$.H.H.....',
      '....H.H###H#####H###H.H.....',
      '....H.H.............H.H.....',
      '..$.H.H..$.......$..H.H.$...',
      '####H.H.###########.H.H#####',
      '....H.H.............H.H.....',
      '...PH.H.............H.HQ....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 10,
    title: '1983 Classic: Stepped Pyramid',
    hint: 'Climb the stepped pyramid slopes and excavate into the Pharaoh-Sumo inner chamber!',
    guardCount: 2,
    guardSpeed: 3.1,
    holeDuration: 7.5,
    trapDuration: 4.0,
    rows: [
      '.............S..............',
      '.............S..............',
      '..........$..S..$...........',
      '.........H###S###H..........',
      '.......$.H...S...H.$........',
      '......H###..###..###H.......',
      '....$.H....##$##....H.$.....',
      '...H###...###X###...###H....',
      '.$.H.....##$#X#$##.....H.$..',
      'H###....###X#X#X###....###H.',
      'H......E...........E......H.',
      'H..$...................$..H.',
      'H.H#####################H.H.',
      'H.H.....................H.H.',
      'H.H......P.......Q......H.H.',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },

  // =========================================================================
  // CHAPTER 2: EDO KOKUGIKAN DOJO (Levels 11 - 16)
  // =========================================================================
  {
    level: 11,
    title: 'Dohyō Initiate',
    hint: 'Collect all 9 Gold Pots to reveal the Escape Ladder (S) at the top!',
    guardCount: 2,
    guardSpeed: 3.12,
    holeDuration: 7.4,
    trapDuration: 4.0,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S...E.......$..',
      '#######H###########H########',
      '.......H...........H........',
      '.......H...$...$...H........',
      '.......H..H#####H..H........',
      '.......H..H.....H..H........',
      '.......H..H.....H..H....$...',
      '####H######.....######H#####',
      '....H.................H.....',
      '....H...$....E....$...H.....',
      '....#########H#########.....',
      '.............H..............',
      '..$....P.....H.....Q.....$..',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 12,
    title: 'Twin Torii Towers',
    hint: 'Drop from the upper Sacred Ropes (-) through the floating mid-air Gold!',
    guardCount: 2,
    guardSpeed: 3.15,
    holeDuration: 7.3,
    trapDuration: 4.0,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S...........$..',
      '#####H#######S#######H######',
      '.....H-------.-------H......',
      '.....H...$.......$...H......',
      '.....H...............H......',
      '.....H..H#########H..H......',
      '..$..H..H....E....H..H..$...',
      '####H#..H...$.$...H..#H#####',
      '....H...H..H###H..H...H.....',
      '....H...H..H...H..H...H.....',
      '....H####..H...H..####H.....',
      '....H......H...H......H.....',
      '....H..P...H...H...Q..H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 13,
    title: 'Sacred Rope Crossing',
    guardCount: 2,
    guardSpeed: 3.2,
    holeDuration: 7.2,
    trapDuration: 3.9,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '####H--------S--------H#####',
      '....H.................H.....',
      '....H..$.....E.....$..H.....',
      '....H.H####.....####H.H.....',
      '....H.H.............H.H.....',
      '....H.H..$.......$..H.H.....',
      '....H.H.####H.H####.H.H.....',
      '....H.H.....H.H.....H.H.....',
      '..$.H.H..E..H.H.....H.H.$...',
      '####H.#######.#######.H#####',
      '....H.................H.....',
      '....H....P.......Q....H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 14,
    title: 'The Stepping Stone Pit',
    guardCount: 2,
    guardSpeed: 3.25,
    holeDuration: 7.2,
    trapDuration: 3.9,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E....$...',
      '######H######S######H#######',
      '......H.............H.......',
      '......H..$...$...$..H.......',
      '......H.###.###.###.H.......',
      '......H.#$#.#$#.#$#.H.......',
      '......H.#X#.#X#.#X#.H.......',
      '..$...H.............H...$...',
      '#######H###########H########',
      '.......H...........H........',
      '.......H...$...$...H........',
      '.......H..#######..H........',
      '.......H..P.....Q..H........',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 15,
    title: "Trickster's Trapdoor",
    guardCount: 2,
    guardSpeed: 3.3,
    holeDuration: 7.1,
    trapDuration: 3.8,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '#H###XX#####HS#####XX#####H#',
      '.H...$......H......$......H.',
      '.H..H##..E..H..E..##H.....H.',
      '.H..H#######H#######H.....H.',
      '.H..H.......H.......H.....H.',
      '.H..H..$....H....$..H.....H.',
      '####H.##XX#####XX##.H#######',
      '....H...$.......$...H.......',
      '....H..H#########H..H.......',
      '....H..H.........H..H.......',
      '....H..H.P.....Q.H..H.......',
      '....H..H....$....H..H.......',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 16,
    title: 'Staircase Excavation',
    guardCount: 2,
    guardSpeed: 3.35,
    holeDuration: 7.0,
    trapDuration: 3.8,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E....$...',
      '######H######S######H#######',
      '......H......S......H.......',
      '......H..#########..H.......',
      '......H..##$###$##..H.......',
      '......H..##X###X##..H.......',
      '..$...H.............H...$...',
      '####H########H########H#####',
      '....H........H........H.....',
      '....H..####..H..####..H.....',
      '....H..#$##..H..##$#..H.....',
      '....H..#X##.EHE.##X#..H.....',
      '....H...P....H....Q...H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },

  // =========================================================================
  // CHAPTER 3: ARASHIYAMA BAMBOO SHRINE (Levels 17 - 22)
  // =========================================================================
  {
    level: 17,
    title: 'Bamboo Labyrinth',
    guardCount: 3,
    guardSpeed: 3.4,
    holeDuration: 6.8,
    trapDuration: 3.6,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '####H#######HS#######H######',
      '....H.......H........H......',
      '....H..$....H....$...H......',
      '....######H###H#######......',
      '..........H...H.............',
      '..$.......H.E.H.......$.....',
      '#####H#####...#####H########',
      '.....H.............H........',
      '.....H...$.....$...H........',
      '.....H..H#######H..H........',
      '.....H..H.......H..H........',
      '.....H..H.P...Q.H..H........',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 18,
    title: 'The Hanging Gardens',
    guardCount: 3,
    guardSpeed: 3.45,
    holeDuration: 6.7,
    trapDuration: 3.5,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '###H---------S---------H####',
      '...H....$.........$....H....',
      '...H...$....E....$.....H....',
      '...H..#####H.H#####....H....',
      '...H-------H.H-------..H....',
      '...H..$....H.H....$....H....',
      '...H.......H.H.........H....',
      '...H.H####.H.H.####H...H....',
      '...H.H...E.H.H.E...H...H....',
      '...H.H.H#########H.H...H....',
      '...H.H.H.........H.H...H....',
      '...H.H.H..P...Q..H.H...H....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 19,
    title: 'Oni Bridge Puzzle',
    guardCount: 3,
    guardSpeed: 3.5,
    holeDuration: 6.6,
    trapDuration: 3.5,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E....$...',
      '#####H#######S#######H######',
      '.....H...............H......',
      '.....H..$.........$..H......',
      '.....H.@@@#@@H@@#@@@.H......',
      '.....H.......H.......H......',
      '..$..H...E...H.......H..$...',
      '####H########H########H#####',
      '....H........H........H.....',
      '....H..$.....H.....$..H.....',
      '....H.@@@#@@@H@@@#@@@.H.....',
      '....H........H........H.....',
      '....H...P....H....Q...H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 20,
    title: 'Three-Story Dig',
    guardCount: 3,
    guardSpeed: 3.55,
    holeDuration: 6.5,
    trapDuration: 3.4,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E....$...',
      '#####H#######S#######H######',
      '.....H.......S.......H......',
      '.....H...#########...H......',
      '.....H...###$#$###...H......',
      '.....H...###$#$###...H......',
      '.....H...###X#X###...H......',
      '..$..H.......E.......H..$...',
      '####H#################H#####',
      '....H.................H.....',
      '....H....$.......$....H.....',
      '....H...###########...H.....',
      '....H....P.......Q....H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 21,
    title: 'Shrine of Illusions',
    guardCount: 3,
    guardSpeed: 3.6,
    holeDuration: 6.5,
    trapDuration: 3.4,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E....$...',
      '#H##X#X#H####S####H#X#X###H#',
      '.H......H.........H.......H.',
      '.H$.....H....$....H.....$.H.',
      '####H####X#######X####H#####',
      '....H.................H.....',
      '....H..$.....E.....$..H.....',
      '....H.H##X#######X##H.H.....',
      '....H.H.............H.H.....',
      '....H.H..$.......$..H.H.....',
      '....H.H.H#########H.H.H.....',
      '....H.H.H.........H.H.H.....',
      '....H.H.H..P...Q..H.H.H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 22,
    title: 'Emerald Pagoda',
    guardCount: 3,
    guardSpeed: 3.65,
    holeDuration: 6.4,
    trapDuration: 3.3,
    rows: [
      '.............S..............',
      '..........$..S..$...........',
      '........H###HSH###H.........',
      '........H...HSH...H.........',
      '......$.H.E.HSH.E.H.$.......',
      '.....H###H#######H###H......',
      '.....H...H.......H...H......',
      '...$.H...H..$.$..H...H.$....',
      '..H##H...#########...H##H...',
      '..H..H.......E.......H..H...',
      '..H..H..$.........$..H..H...',
      '..H..H###############H..H...',
      '..H..H...............H..H...',
      '..H..H...P.......Q...H..H...',
      '..H..H.......$.......H..H...',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },

  // =========================================================================
  // CHAPTER 4: HOKKAIDO FROST ONSEN (Levels 23 - 28)
  // =========================================================================
  {
    level: 23,
    title: 'Glacial Tiers',
    guardCount: 4,
    guardSpeed: 3.7,
    holeDuration: 6.3,
    trapDuration: 3.2,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      'H##########################H',
      'H..........................H',
      'H....$.......$.......$.....H',
      'H..######H#######H######...H',
      'H........H.......H.........H',
      'H..E.....H...$...H.....E...H',
      'H.H######H#######H######H..H',
      'H.H......H.......H......H..H',
      'H.H..$...H.......H...$..H..H',
      'H.H.H####H#######H####H.H..H',
      'H.H.H....H.......H....H.H..H',
      'H.H.H....HP.....QH....H.H..H',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 24,
    title: 'Frozen Waterfall',
    guardCount: 4,
    guardSpeed: 3.75,
    holeDuration: 6.2,
    trapDuration: 3.2,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '###H-----H##HS##H-----H#####',
      '...H.....H..H.H.H.....H.....',
      '...H..$..H.EH.HEH..$..H.....',
      '...H.H##.########.##H.H.....',
      '...H.H---........---H.H.....',
      '...H.H...$......$...H.H.....',
      '...H.H..H###XX###H..H.H.....',
      '...H.H..H..E..E..H..H.H.....',
      '...H.H..H..$..$..H..H.H.....',
      '...H.H..H########H..H.H.....',
      '...H.H..H........H..H.H.....',
      '...H.H..H.P....Q.H..H.H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 25,
    title: 'The Ice Vaults',
    guardCount: 4,
    guardSpeed: 3.8,
    holeDuration: 6.1,
    trapDuration: 3.1,
    rows: [
      '.............S..............',
      '.............S..............',
      '......E......S......E.......',
      '####H########S########H#####',
      '....H.................H.....',
      '....H.#####.....#####.H.....',
      '....H.#$#$#.....#$#$#.H.....',
      '....H.#X#X#..$..#X#X#.H.....',
      '....H.......###.......H.....',
      '....H.E....#####....E.H.....',
      '....H#####.......#####H.....',
      '....H.#$#.........#$#.H.....',
      '....H.#X#..H###H..#X#.H.....',
      '....H......H...H......H.....',
      '....H..P...H...H...Q..H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 26,
    title: 'Rope & Chasm Gauntlet',
    guardCount: 4,
    guardSpeed: 3.85,
    holeDuration: 6.0,
    trapDuration: 3.0,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '##H----------S----------H###',
      '..H......$.......$......H...',
      '..H...$......$......$...H...',
      '..H..###----###----###..H...',
      '..H....E...........E....H...',
      '..H....$.....$.....$....H...',
      '..H...###---###---###...H...',
      '..H......E.......E......H...',
      '..H..$...............$..H...',
      '..H.H#################H.H...',
      '..H.H.................H.H...',
      '..H.H.....P.....Q.....H.H...',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 27,
    title: 'Double Trapdoor Drop',
    guardCount: 4,
    guardSpeed: 3.9,
    holeDuration: 6.0,
    trapDuration: 3.0,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '#H##XX######HS######XX####H#',
      '.H..XX......H.......XX....H.',
      '.H..$$......H.......$$....H.',
      '###H####..E.H.E...####H#####',
      '...H...#####H#####....H.....',
      '...H........H.........H.....',
      '...H..$.....H.....$...H.....',
      '...H.##XX###H###XX##..H.....',
      '...H...$$...H...$$....H.....',
      '...H..H#####H#####H...H.....',
      '...H..H.....H.....H...H.....',
      '...H..H..P..H..Q..H...H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 28,
    title: 'Blizzard Bastion',
    guardCount: 4,
    guardSpeed: 3.95,
    holeDuration: 5.9,
    trapDuration: 2.9,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '#####H#######S#######H######',
      '.....H-------.-------H......',
      '.....H...$.......$...H......',
      '.....H..H###H.H###H..H......',
      '..$..H..H...H.H...H..H..$...',
      'H#####..H.E.H.H.E.H..#####H.',
      'H.......H###H.H###H.......H.',
      'H...$...H...H.H...H...$...H.',
      'H..H#####...H.H...#####H..H.',
      'H..H........H.H........H..H.',
      'H..H...P....H.H....Q...H..H.',
      'H..H......$.H.H.$......H..H.',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },

  // =========================================================================
  // CHAPTER 5: KAGOSHIMA MAGMA FORGE & IMPERIAL CASTLE (Levels 29 - 40)
  // =========================================================================
  {
    level: 29,
    title: 'The Iron Foundry',
    guardCount: 4,
    guardSpeed: 4.05,
    holeDuration: 5.8,
    trapDuration: 2.9,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '@@@##H@@####HS####@@H##@@@@@',
      '.....H......H.......H.......',
      '.....H..$...H...$...H.......',
      '.....H.H@##@H@##@H..H.......',
      '.....H.H....H....H..H.......',
      '..$..H.H.E..H..E.H..H...$...',
      '@@@#H#.H####H####H..H###@@@@',
      '....H..H....H....H..H.......',
      '....H..H.$..H..$.H..H.......',
      '....H..H#########H..H.......',
      '....H..H.........H..H.......',
      '....H..H..P...Q..H..H.......',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 30,
    title: 'Crucible of Timing',
    guardCount: 5,
    guardSpeed: 4.1,
    holeDuration: 5.8,
    trapDuration: 2.8,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..E.......S.......E..$...',
      '#######H#####S#####H########',
      '.......H...........H........',
      '..$....H..E..$..E..H....$...',
      '####H#######H.H#######H#####',
      '....H.......H.H.......H.....',
      '....H...$...H.H...$...H.....',
      '....H..H####H.H####H..H.....',
      '....H..H....H.H....H..H.....',
      '..$.H..H..E.H.H....H..H.$...',
      '####H..H###########H..H#####',
      '....H..H...........H..H.....',
      '....H..H...P...Q...H..H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 31,
    title: 'Deep Magma Excavation',
    guardCount: 5,
    guardSpeed: 4.15,
    holeDuration: 6.2,
    trapDuration: 2.8,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '####H########S########H#####',
      '....H........S........H.....',
      '....H..#############..H.....',
      '....H..##$#######$##..H.....',
      '....H..##X#$###$#X##..H.....',
      '....H..##X#X#$#X#X##..H.....',
      '....H..##X#X#X#X#X##..H.....',
      '..$.H..E.....E.....E..H.$...',
      '#####H###############H######',
      '.....H...............H......',
      '.....H...$.......$...H......',
      '.....H...P.......Q...H......',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 32,
    title: 'Suspended Anvils',
    guardCount: 5,
    guardSpeed: 4.2,
    holeDuration: 5.7,
    trapDuration: 2.7,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '##H----------S----------H###',
      '..H....$...........$....H...',
      '..H..$....$.....$....$..H...',
      '..H.@H@..@@H...H@@..@H@.H...',
      '..H..H----H-----H----H..H...',
      '..H..H.E..H.....H..E.H..H...',
      '..H..H...$H..$..H$...H..H...',
      '..H..H..###.###.###..H..H...',
      '..H..H.E...........E.H..H...',
      '..H..H###############H..H...',
      '..H..H.......E.......H..H...',
      '..H..H....P.....Q....H..H...',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 33,
    title: 'Furnace Maze',
    guardCount: 5,
    guardSpeed: 4.25,
    holeDuration: 5.7,
    trapDuration: 2.7,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..E.......S.......E..$...',
      '#H##H###XX##HS###XX###H###H#',
      '.H..H....$..H....$....H...H.',
      '.H..H..H####H.H####H..H...H.',
      '.H..H..H.E..H.H..E.H..H...H.',
      '..$.H..H..$.H.H.$..H..H.$...',
      'H####..H###XH.HX###H..#####H',
      'H......H....H.H....H.......H',
      'H..$...H.E..H.H....H...$...H',
      'H.H##H.######.######.H##H..H',
      'H.H..H...............H..H..H',
      'H.H..H....P.....Q....H..H..H',
      'H.H..H.......$.......H..H..H',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 34,
    title: 'Caldera Rim',
    guardCount: 5,
    guardSpeed: 4.3,
    holeDuration: 5.6,
    trapDuration: 2.6,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '###H.........S.........H####',
      '...H..$......S......$..H....',
      '...######H...S...H######....',
      '.........H...S...H..........',
      '.....E...H..$S$..H...E......',
      '....H#####H#####H#####H.....',
      '....H.....H.....H.....H.....',
      '....H..E..H.$.$.H..E..H.....',
      '....H.H####.###.####H.H.....',
      '....H.H.....#$#.....H.H.....',
      '....H.H..E..#X#.....H.H.....',
      '....H.H...P.....Q...H.H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 35,
    title: "Shogun's Courtyard",
    guardCount: 5,
    guardSpeed: 4.4,
    holeDuration: 5.6,
    trapDuration: 2.6,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '#####H#######S#######H######',
      '.....H.......S.......H......',
      '.....H..#####.#####..H......',
      '.....H..#$#$#.#$#$#..H......',
      '.....H..#X#X#.#X#X#..H......',
      '..$..H...E...E...E...H..$...',
      '####H#################H#####',
      '....H.................H.....',
      '....H..$....$.$....$..H.....',
      '....H.H####.H#H.####H.H.....',
      '....H.H.....H.H.....H.H.....',
      '....H.H..P..H.H..Q..H.H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 36,
    title: 'The Gauntlet of Ropes',
    guardCount: 5,
    guardSpeed: 4.45,
    holeDuration: 5.5,
    trapDuration: 2.5,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '##H----------S----------H###',
      '..H....$.....$.....$....H...',
      '..H---###---------###---H...',
      '..H....E.....$.....E....H...',
      '..H---------###---------H...',
      '..H..$.......E.......$..H...',
      '..H.H##-------------##H.H...',
      '..H.H..E...........E..H.H...',
      '..H.H..$.....$.....$..H.H...',
      '..H.H.H#############H.H.H...',
      '..H.H.H.............H.H.H...',
      '..H.H.H....P...Q....H.H.H...',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 37,
    title: 'Master Excavator',
    guardCount: 6,
    guardSpeed: 4.5,
    holeDuration: 6.0,
    trapDuration: 2.5,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..E.......S.......E..$...',
      '####H########S########H#####',
      '....H........S........H.....',
      '....H.@@@#########@@@.H.....',
      '....H.@@@#$#####$#@@@.H.....',
      '....H.@@@#X##$##X#@@@.H.....',
      '....H.@@@#X##X##X#@@@.H.....',
      '..$.H..E..E.....E..E..H.$...',
      '#####H###############H######',
      '.....H...#########...H......',
      '.....H...###$#$###...H......',
      '.....H...###X#X###...H......',
      '.....H....P.....Q....H......',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 38,
    title: 'Trapdoor Matrix',
    guardCount: 6,
    guardSpeed: 4.55,
    holeDuration: 5.5,
    trapDuration: 2.5,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..E.......S.......E..$...',
      '#H#X#X#H#####S#####H#X#X##H#',
      '.H.....H...........H......H.',
      '.H$....H..$.....$..H....$.H.',
      '####H###X###H.H###X###H#####',
      '....H.......H.H.......H.....',
      '....H.E..$..H.H..$..E.H.....',
      '....H###X###H.H###X###H.....',
      '....H.......H.H.......H.....',
      '....H..E.$..H.H..$.E..H.....',
      '....H.H#####H.H#####H.H.....',
      '....H.H.....H.H.....H.H.....',
      '....H.H..P..H.H..Q..H.H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 39,
    title: "Yokozuna's Trial",
    guardCount: 6,
    guardSpeed: 4.6,
    holeDuration: 5.4,
    trapDuration: 2.4,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..E.......S.......E..$...',
      '#####H-------S-------H######',
      '.....H...............H......',
      '..$..H..H###H.H###H..H..$...',
      '####H###H.#$H.H$#.H###H#####',
      '....H...H.#X#.#X#.H...H.....',
      '....H.E.H..E...E..H.E.H.....',
      '....H###H#########H###H.....',
      '....H...H...$.$...H...H.....',
      '....H...H.H#####H.H...H.....',
      '....H...H.H..$..H.H...H.....',
      '....H...H.H.#X#.H.H...H.....',
      '....H...H.H.P.Q.H.H...H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 40,
    title: 'Imperial Grand Dohyō',
    guardCount: 6,
    guardSpeed: 4.7,
    holeDuration: 5.4,
    trapDuration: 2.4,
    rows: [
      '.............S..............',
      '.........$...S...$..........',
      '..$..E..H###HSH##H..E...$...',
      '#####H--H...HSH..H--H#######',
      '.....H..H..$HSH$..H..H......',
      '.....H..H#########H..H......',
      '.....H..H..##$##..H..H......',
      '..$..H..H..##X##..H..H..$...',
      '####H###H.E.....E.H###H#####',
      '....H...H#########H...H.....',
      '....H.E.H..$...$..H.E.H.....',
      '....H###H.###X###.H###H.....',
      '....H...H.#$#.#$#.H...H.....',
      '....H...H.#X#.#X#.H...H.....',
      '....H...H...P.Q...H...H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  }
];

interface DugBrick {
  col: number;
  row: number;
  timer: number;
  maxDuration: number;
  dugBy: PlayerId;
}

interface GoldItem {
  id: number;
  col: number;
  row: number;
  collected: boolean;
  carriedByGuardId: number | null;
}

interface BonusItem {
  active: boolean;
  spawnedThisLevel: boolean;
  col: number;
  row: number;
  timer: number;
}

interface SumoRunnerPlayer {
  id: PlayerId;
  x: number;           // Grid column float (0..27)
  y: number;           // Grid row float (0..15)
  spawnCol: number;
  spawnRow: number;
  facing: -1 | 1;
  state: 'IDLE' | 'RUN' | 'CLIMB' | 'ROPE' | 'FALL' | 'DIG' | 'DEAD';
  digTimer: number;
  digTargetCol: number;
  digTargetRow: number;
  respawnTimer: number;
  invulnTimer: number;
  animPhase: number;
  score: number;
  goldCollected: number;
  guardsTrapped: number;
  levelsCleared: number;
  dropFromRopeCooldown: number;
}

interface OniGuard {
  id: number;
  x: number;
  y: number;
  spawnCol: number;
  spawnRow: number;
  facing: -1 | 1;
  state: 'PATROL' | 'CLIMB' | 'ROPE' | 'FALL' | 'TRAPPED' | 'CLIMB_OUT';
  trapTimer: number;
  trapCol: number;
  trapRow: number;
  climbOutTimer: number;
  climbOutCol: number;
  carryingGoldId: number | null;
  goldHoldTimer: number;
  animPhase: number;
  moveDirX: number;
  moveDirY: number;
  repathTimer: number;
  immuneHoleCol: number;
  immuneHoleRow: number;
  dropFromRopeCooldown: number;
  respawnFlashTimer: number;
}

const BFS_DIRS: readonly { dx: number; dy: number }[] = [
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 }
];

export class SumoLodeRunnerGame extends BaseGame {
  // Multi-round / 40-level campaign flags so GameManager does not cut off at 65s
  public isMultiRound: boolean = true;
  public isNoTimeLimit: boolean = false;

  // Current Level (0 = Interactive Tutorial Dojo, 1..40 = Campaign Stages)
  public currentLevel: number = 0;
  public maxUnlockedLevel: number = 1;
  public teamLives: number = 5;
  // 1-Player Solo Puzzle Mode (when true & 1 human player is active, disables the CPU partner so you can solve puzzles stress-free)
  public soloMode: boolean = true;
  private levelClearBannerTimer: number = 0;
  private stageHintTimer: number = 0;
  private escapeRevealed: boolean = false;
  private escapeFlashTimer: number = 0;

  // Dynamic Procedural Soundtrack State (inspired by Lode Runner, Super Mario Bros. & Legend of Zelda)
  public musicEnabled: boolean = true;
  private bgmStepIndex: number = 0;
  private bgmStepTimer: number = 0;
  private bgmMood: 'normal' | 'positive' | 'negative' | 'escape' = 'normal';
  private bgmMoodTimer: number = 0;

  // Dynamic Viewport Dimensions for Resize-Safe Mouse Hitboxes
  private lastWidth: number = 960;
  private lastHeight: number = 640;

  // WebAssembly Kernel & Shared Linear Memory Views
  private wasmExports: WasmLodeExports | null = null;
  private gridMem!: Uint8Array;
  private dynMem!: Uint8Array;
  public wasmActive: boolean = false;

  // Zero-Allocation BFS Ring Buffers for Guard & Bot Pathfinding
  private bfsVisited: Uint8Array = new Uint8Array(GRID_SIZE);
  private bfsQueueCol: Int16Array = new Int16Array(GRID_SIZE);
  private bfsQueueRow: Int16Array = new Int16Array(GRID_SIZE);
  private bfsFirstMoveX: Int8Array = new Int8Array(GRID_SIZE);
  private bfsFirstMoveY: Int8Array = new Int8Array(GRID_SIZE);

  // OffscreenCanvas Static Tilemap Layer Cache for Zero-Lag 60/120fps Rendering
  private tileCacheCanvas: HTMLCanvasElement | null = null;
  private tileCacheCtx: CanvasRenderingContext2D | null = null;
  private tileCacheDirty: boolean = true;
  private cachedTileW: number = 0;
  private cachedTileH: number = 0;

  // Entities & Level State
  private runners: Map<PlayerId, SumoRunnerPlayer> = new Map();
  private guards: OniGuard[] = [];
  private golds: GoldItem[] = [];
  private dugBricks: DugBrick[] = [];
  private trapdoorRevealed: Uint8Array = new Uint8Array(GRID_SIZE);
  private bonusItem: BonusItem = {
    active: false,
    spawnedThisLevel: false,
    col: 13,
    row: 14,
    timer: 0
  };

  // Direct keyboard listener for dedicated Dig Left (Q/Z), Dig Right (E/X/C), and Level Select ([ / ] / T / R / B / M)
  private rawKeys: Set<string> = new Set();
  private justRawKeys: Set<string> = new Set();
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;
  private canvasClickHandler: ((e: MouseEvent) => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseUpHandler: ((e: MouseEvent) => void) | null = null;
  private touchStartHandler: ((e: TouchEvent) => void) | null = null;
  private touchMoveHandler: ((e: TouchEvent) => void) | null = null;
  private touchEndHandler: ((e: TouchEvent) => void) | null = null;

  // Smart Mobile Follow-Cam & Dedicated iPhone Arcade Touch Control Deck State
  private mobileZoomCam: boolean = true;
  private camFocusX: number = 13.5;
  private camFocusY: number = 10;
  private virtualDpadSteer: number = 0;
  private virtualDpadThrottle: number = 0;
  private virtualDigDir: -1 | 1 | null = null;
  private digLeftPressed: boolean = false;
  private digRightPressed: boolean = false;
  private activeDeckTouches: Map<number, 'dpad' | 'digL' | 'digR' | 'hud'> = new Map();
  private dpadZone: { cx: number; cy: number; r: number } = { cx: 84, cy: 710, r: 56 };
  private digLeftZone: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };
  private digRightZone: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };

  // Clickable HUD Hitboxes for Level Navigation & Mobile Controls
  private hudHitboxes: { id: string; x: number; y: number; w: number; h: number; action: () => void }[] = [];

  private isTouchDeckVisible(width: number, height: number): boolean {
    const isPhonePortrait = width < 640 && height > width;
    const isPhoneLandscape = width < 930 && height < 480;
    return isPhonePortrait || isPhoneLandscape || this.input?.deviceMode === 'phone';
  }

  private updateDpadFromPoint(cx: number, cy: number): void {
    const dx = cx - this.dpadZone.cx;
    const dy = cy - this.dpadZone.cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      this.virtualDpadSteer = 0;
      this.virtualDpadThrottle = 0;
      return;
    }
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    this.virtualDpadSteer = absX > 9 && absX >= absY * 0.55 ? Math.sign(dx) : 0;
    this.virtualDpadThrottle = absY > 9 && absY >= absX * 0.55 ? -Math.sign(dy) : 0;
  }

  private processDeckPointerDown(pointerId: number, cx: number, cy: number): boolean {
    if (this.isFinished) return false;
    for (let i = 0; i < this.hudHitboxes.length; i++) {
      const box = this.hudHitboxes[i];
      if (cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h) {
        this.activeDeckTouches.set(pointerId, 'hud');
        box.action();
        return true;
      }
    }
    if (this.isTouchDeckVisible(this.lastWidth, this.lastHeight)) {
      const dl = this.digLeftZone;
      if (dl.w > 0 && cx >= dl.x && cx <= dl.x + dl.w && cy >= dl.y && cy <= dl.y + dl.h) {
        this.activeDeckTouches.set(pointerId, 'digL');
        this.digLeftPressed = true;
        this.virtualDigDir = -1;
        return true;
      }
      const dr = this.digRightZone;
      if (dr.w > 0 && cx >= dr.x && cx <= dr.x + dr.w && cy >= dr.y && cy <= dr.y + dr.h) {
        this.activeDeckTouches.set(pointerId, 'digR');
        this.digRightPressed = true;
        this.virtualDigDir = 1;
        return true;
      }
      if (Math.hypot(cx - this.dpadZone.cx, cy - this.dpadZone.cy) <= this.dpadZone.r * 1.38) {
        this.activeDeckTouches.set(pointerId, 'dpad');
        this.updateDpadFromPoint(cx, cy);
        return true;
      }
    }
    return false;
  }

  private processDeckPointerMove(pointerId: number, cx: number, cy: number): void {
    const role = this.activeDeckTouches.get(pointerId);
    if (role === 'dpad') {
      this.updateDpadFromPoint(cx, cy);
    }
  }

  private processDeckPointerUp(pointerId: number): void {
    const role = this.activeDeckTouches.get(pointerId);
    if (!role) return;
    this.activeDeckTouches.delete(pointerId);
    if (role === 'dpad') {
      let stillHoldingDpad = false;
      for (const r of this.activeDeckTouches.values()) {
        if (r === 'dpad') stillHoldingDpad = true;
      }
      if (!stillHoldingDpad) {
        this.virtualDpadSteer = 0;
        this.virtualDpadThrottle = 0;
      }
    } else if (role === 'digL') {
      this.digLeftPressed = false;
    } else if (role === 'digR') {
      this.digRightPressed = false;
    }
  }

  public setStartingLevel(level: number): void {
    this.currentLevel = Math.max(0, Math.min(SUMO_LODE_LEVELS.length, Math.floor(level)));
  }

  public setSoloMode(solo: boolean): void {
    this.soloMode = solo;
  }

  public getLevelBlueprint(levelNum: number = this.currentLevel): LevelBlueprint {
    if (levelNum <= 0) return SUMO_LODE_TUTORIAL_LEVEL;
    const idx = Math.max(0, Math.min(SUMO_LODE_LEVELS.length - 1, levelNum - 1));
    return SUMO_LODE_LEVELS[idx];
  }

  private initWasmKernel(): void {
    if (this.wasmExports) return;
    try {
      const mod = new WebAssembly.Module(WASM_LODE_KERNEL_BYTES);
      const inst = new WebAssembly.Instance(mod);
      this.wasmExports = inst.exports as unknown as WasmLodeExports;
      const buf = this.wasmExports.mem.buffer;
      this.gridMem = new Uint8Array(buf, 0, GRID_SIZE);
      this.dynMem = new Uint8Array(buf, 512, GRID_SIZE);
      this.wasmActive = true;
    } catch {
      // Fallback to native TypedArrays if CSP blocks Wasm compilation
      const fallbackBuf = new ArrayBuffer(1024);
      this.gridMem = new Uint8Array(fallbackBuf, 0, GRID_SIZE);
      this.dynMem = new Uint8Array(fallbackBuf, 512, GRID_SIZE);
      this.wasmActive = false;
    }
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.initWasmKernel();
    if (this.input) {
      this.input.suppressPhoneOverlay = this.isTouchDeckVisible(width, height);
    }

    // Load saved level progress
    try {
      const saved = localStorage.getItem('antigravity_sumo_lode_unlocked');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= SUMO_LODE_LEVELS.length) {
          this.maxUnlockedLevel = parsed;
        }
      }
    } catch {
      // ignore storage errors
    }

    // Bind dedicated Lode Runner hotkeys & multi-touch Arcade Deck listeners
    if (!this.keyDownHandler && typeof window !== 'undefined') {
      this.keyDownHandler = (e: KeyboardEvent) => {
        if (!this.rawKeys.has(e.code)) {
          this.justRawKeys.add(e.code);
        }
        this.rawKeys.add(e.code);
      };
      this.keyUpHandler = (e: KeyboardEvent) => {
        this.rawKeys.delete(e.code);
      };
      window.addEventListener('keydown', this.keyDownHandler);
      window.addEventListener('keyup', this.keyUpHandler);

      const canvas = this.input.getCanvas();
      const toCanvasCoords = (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = this.lastWidth / Math.max(1, rect.width);
        const scaleY = this.lastHeight / Math.max(1, rect.height);
        return {
          cx: (clientX - rect.left) * scaleX,
          cy: (clientY - rect.top) * scaleY
        };
      };

      this.canvasClickHandler = (e: MouseEvent) => {
        const { cx, cy } = toCanvasCoords(e.clientX, e.clientY);
        this.processDeckPointerDown(-999, cx, cy);
      };
      this.mouseMoveHandler = (e: MouseEvent) => {
        if (!this.activeDeckTouches.has(-999)) return;
        const { cx, cy } = toCanvasCoords(e.clientX, e.clientY);
        this.processDeckPointerMove(-999, cx, cy);
      };
      this.mouseUpHandler = () => {
        this.processDeckPointerUp(-999);
      };

      this.touchStartHandler = (e: TouchEvent) => {
        let handled = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const { cx, cy } = toCanvasCoords(t.clientX, t.clientY);
          if (this.processDeckPointerDown(t.identifier, cx, cy)) {
            handled = true;
          }
        }
        if (handled) {
          e.stopPropagation();
        }
      };
      this.touchMoveHandler = (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (this.activeDeckTouches.has(t.identifier)) {
            const { cx, cy } = toCanvasCoords(t.clientX, t.clientY);
            this.processDeckPointerMove(t.identifier, cx, cy);
          }
        }
      };
      this.touchEndHandler = (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          this.processDeckPointerUp(t.identifier);
        }
      };

      canvas.addEventListener('mousedown', this.canvasClickHandler);
      window.addEventListener('mousemove', this.mouseMoveHandler);
      window.addEventListener('mouseup', this.mouseUpHandler);
      canvas.addEventListener('touchstart', this.touchStartHandler, { passive: true, capture: true });
      window.addEventListener('touchmove', this.touchMoveHandler, { passive: true });
      window.addEventListener('touchend', this.touchEndHandler, { passive: true });
      window.addEventListener('touchcancel', this.touchEndHandler, { passive: true });
    }

    this.reset(width, height);
  }

  public override destroy(): void {
    if (this.input) {
      this.input.suppressPhoneOverlay = false;
    }
    if (typeof window !== 'undefined') {
      if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
      if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
      if (this.mouseMoveHandler) window.removeEventListener('mousemove', this.mouseMoveHandler);
      if (this.mouseUpHandler) window.removeEventListener('mouseup', this.mouseUpHandler);
      if (this.touchMoveHandler) window.removeEventListener('touchmove', this.touchMoveHandler);
      if (this.touchEndHandler) {
        window.removeEventListener('touchend', this.touchEndHandler);
        window.removeEventListener('touchcancel', this.touchEndHandler);
      }
      const canvas = this.input?.getCanvas();
      if (canvas) {
        if (this.canvasClickHandler) canvas.removeEventListener('mousedown', this.canvasClickHandler);
        if (this.touchStartHandler) canvas.removeEventListener('touchstart', this.touchStartHandler, { capture: true } as EventListenerOptions);
      }
    }
    this.keyDownHandler = null;
    this.keyUpHandler = null;
    this.canvasClickHandler = null;
    this.mouseMoveHandler = null;
    this.mouseUpHandler = null;
    this.touchStartHandler = null;
    this.touchMoveHandler = null;
    this.touchEndHandler = null;
    this.activeDeckTouches.clear();
    super.destroy();
  }

  private spawnActiveRunners(preserveStats: boolean = false): void {
    const prevStats = new Map<PlayerId, { score: number; goldCollected: number; guardsTrapped: number; levelsCleared: number }>();
    if (preserveStats) {
      for (const [id, r] of this.runners.entries()) {
        prevStats.set(id, {
          score: r.score,
          goldCollected: r.goldCollected,
          guardsTrapped: r.guardsTrapped,
          levelsCleared: r.levelsCleared
        });
      }
    }

    this.runners.clear();
    let active = this.getActivePlayers();
    const humanCount = active.filter((p) => p.type === 'human').length;

    // If the user toggled +CPU Partner ON (!this.soloMode) while in 1P Solo lobby mode, enable P2 as a CPU partner
    if (!this.soloMode && humanCount === 1 && active.length === 1 && this.players[1]) {
      this.players[1].type = 'bot_normal';
      active = this.getActivePlayers();
    }

    // In 1P Solo Mode (when only 1 human player is playing), filter out CPU bots so the player can solve puzzles stress-free!
    const filtered = this.soloMode && humanCount === 1 ? active.filter((p) => p.type === 'human') : active;
    const list = filtered.length > 0 ? filtered : active;

    list.forEach((p) => {
      const saved = prevStats.get(p.id);
      this.runners.set(p.id, {
        id: p.id,
        x: 10,
        y: 14,
        spawnCol: 10,
        spawnRow: 14,
        facing: p.id % 2 === 0 ? 1 : -1,
        state: 'IDLE',
        digTimer: 0,
        digTargetCol: -1,
        digTargetRow: -1,
        respawnTimer: 0,
        invulnTimer: 1.5,
        animPhase: 0,
        score: saved ? saved.score : 0,
        goldCollected: saved ? saved.goldCollected : 0,
        guardsTrapped: saved ? saved.guardsTrapped : 0,
        levelsCleared: saved ? saved.levelsCleared : 0,
        dropFromRopeCooldown: 0
      });
    });
  }

  public reset(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.initWasmKernel();
    this.activeMutator = { ...DEFAULT_MUTATOR };
    this.particles.clear();
    this.isFinished = false;
    this.roundTimer = 180;
    this.teamLives = 5;
    this.spawnActiveRunners();
    this.loadLevel(this.currentLevel);
  }

  public loadLevel(levelNum: number): void {
    this.currentLevel = Math.max(0, Math.min(SUMO_LODE_LEVELS.length, levelNum));
    const bp = this.getLevelBlueprint(this.currentLevel);

    this.gridMem.fill(TILE_EMPTY);
    this.dynMem.fill(DYN_NONE);
    this.trapdoorRevealed.fill(0);
    this.dugBricks = [];
    this.golds = [];
    this.guards = [];
    this.escapeRevealed = false;
    this.escapeFlashTimer = 0;
    this.levelClearBannerTimer = 0;
    this.stageHintTimer = bp.hint ? 11.0 : 4.5;
    this.teamLives = 5; // Fresh 5 lives per stage (infinite in Stage 0 Tutorial)
    this.roundTimer = 180; // Fresh 3-minute timer per stage
    this.tileCacheDirty = true;
    this.bgmMood = 'normal';
    this.bgmMoodTimer = 0;

    const pSpawns: { col: number; row: number }[] = [];
    const qSpawns: { col: number; row: number }[] = [];
    const eSpawns: { col: number; row: number }[] = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      const rowStr = bp.rows[r] || '';
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = rowStr[c] || '.';
        const idx = r * GRID_COLS + c;
        if (ch === '#') {
          this.gridMem[idx] = TILE_BRICK;
        } else if (ch === '@') {
          this.gridMem[idx] = TILE_SOLID;
        } else if (ch === 'H') {
          this.gridMem[idx] = TILE_LADDER;
        } else if (ch === '-') {
          this.gridMem[idx] = TILE_ROPE;
        } else if (ch === 'X') {
          this.gridMem[idx] = TILE_TRAPDOOR;
        } else if (ch === 'S') {
          this.gridMem[idx] = TILE_HIDDEN_LADDER;
        } else if (ch === '$') {
          this.gridMem[idx] = TILE_EMPTY;
          this.golds.push({
            id: this.golds.length,
            col: c,
            row: r,
            collected: false,
            carriedByGuardId: null
          });
        } else if (ch === 'P') {
          pSpawns.push({ col: c, row: r });
        } else if (ch === 'Q') {
          qSpawns.push({ col: c, row: r });
        } else if (ch === 'E') {
          eSpawns.push({ col: c, row: r });
        }
      }
    }

    // Position players on P / Q spawns
    const defaultP = pSpawns[0] || { col: 8, row: 14 };
    const defaultQ = qSpawns[0] || { col: 19, row: 14 };

    this.bonusItem = {
      active: false,
      spawnedThisLevel: false,
      col: Math.round((defaultP.col + defaultQ.col) / 2),
      row: defaultP.row,
      timer: 0
    };

    let pIdx = 0;
    for (const runner of this.runners.values()) {
      const sp = pIdx % 2 === 0 ? defaultP : defaultQ;
      const offsetCol = pIdx >= 2 ? (pIdx === 2 ? -1 : 1) : 0;
      runner.spawnCol = Math.max(1, Math.min(GRID_COLS - 2, sp.col + offsetCol));
      runner.spawnRow = sp.row;
      runner.x = runner.spawnCol;
      runner.y = runner.spawnRow;
      runner.facing = pIdx % 2 === 0 ? 1 : -1;
      runner.state = 'IDLE';
      runner.digTimer = 0;
      runner.respawnTimer = 0;
      runner.invulnTimer = 1.5;
      runner.dropFromRopeCooldown = 0;
      if (pIdx === 0) {
        this.camFocusX = runner.x;
        this.camFocusY = runner.y;
      }
      pIdx++;
    }

    // Spawn Oni-Sumo Guards up to bp.guardCount
    for (let i = 0; i < bp.guardCount; i++) {
      const sp = eSpawns[i % Math.max(1, eSpawns.length)] || { col: 4 + i * 4, row: 2 };
      this.guards.push({
        id: i,
        x: sp.col,
        y: sp.row,
        spawnCol: sp.col,
        spawnRow: sp.row,
        facing: i % 2 === 0 ? 1 : -1,
        state: 'PATROL',
        trapTimer: 0,
        trapCol: -1,
        trapRow: -1,
        climbOutTimer: 0,
        climbOutCol: sp.col,
        carryingGoldId: null,
        goldHoldTimer: 0,
        animPhase: i * 1.3,
        moveDirX: 0,
        moveDirY: 0,
        repathTimer: 0,
        immuneHoleCol: -1,
        immuneHoleRow: -1,
        dropFromRopeCooldown: 0,
        respawnFlashTimer: 0
      });
    }
  }

  /**
   * Zero-allocation count of remaining uncollected gold on the stage.
   */
  public getRemainingGoldCount(): number {
    let count = 0;
    for (let i = 0; i < this.golds.length; i++) {
      if (!this.golds[i].collected) count++;
    }
    return count;
  }

  /**
   * Calls into the compiled WebAssembly kernel (or fallback) to check if tile (col, row) has floor/ladder support.
   * Note: Rope support is intentionally checked separately via `onRope` so `dropFromRopeCooldown` can release ropes!
   */
  public isTileSupported(col: number, row: number): boolean {
    const c = Math.max(0, Math.min(GRID_COLS - 1, Math.round(col)));
    const r = Math.max(0, Math.min(GRID_ROWS - 1, Math.round(row)));
    if (this.wasmExports) {
      return this.wasmExports.isSupported(c, r, this.escapeRevealed ? 1 : 0) === 1;
    }
    if (r >= GRID_ROWS - 1) return true;
    const idx = r * GRID_COLS + c;
    const t = this.gridMem[idx];
    if (t === TILE_LADDER) return true;
    if (t === TILE_HIDDEN_LADDER && this.escapeRevealed) return true;
    const belowIdx = idx + GRID_COLS;
    const dynBelow = this.dynMem[belowIdx];
    if (dynBelow === DYN_TRAPPED_GUARD) return true;
    if (dynBelow === DYN_DUG_HOLE) return false;
    const belowT = this.gridMem[belowIdx];
    if (belowT === TILE_BRICK || belowT === TILE_SOLID || belowT === TILE_LADDER) return true;
    if (belowT === TILE_HIDDEN_LADDER && this.escapeRevealed) return true;
    return false;
  }

  /**
   * Checks if a cell (col, row) is passable (not solid stone or intact brick)
   */
  public isCellPassable(col: number, row: number, isGuard: boolean = false): boolean {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    const idx = row * GRID_COLS + col;
    const dyn = this.dynMem[idx];
    if (dyn === DYN_TRAPPED_GUARD) {
      // Another entity cannot fall inside an already-occupied trapped guard hole
      return false;
    }
    if (dyn === DYN_DUG_HOLE) {
      return true;
    }
    const t = this.gridMem[idx];
    if (t === TILE_SOLID || t === TILE_BRICK) return false;
    // Note: TILE_TRAPDOOR looks like brick but is passable!
    if (isGuard && t === TILE_TRAPDOOR && this.trapdoorRevealed[idx] === 0) {
      return true;
    }
    return true;
  }

  public isClimbable(col: number, row: number): boolean {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    const t = this.gridMem[row * GRID_COLS + col];
    return t === TILE_LADDER || (t === TILE_HIDDEN_LADDER && this.escapeRevealed);
  }

  /**
   * Finds a climbable ladder column within ±0.42 tiles of x so players don't get stuck on ladder corners.
   */
  private findNearbyLadderCol(x: number, row: number, moveY: number): number {
    const centerCol = Math.round(x);
    const candidates = [centerCol, Math.floor(x + 0.42), Math.ceil(x - 0.42)];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (c < 0 || c >= GRID_COLS || Math.abs(x - c) > 0.44) continue;
      if (moveY < 0) {
        if (this.isClimbable(c, row) || this.isClimbable(c, row - 1) || this.isClimbable(c, row + 1)) {
          return c;
        }
      } else if (moveY > 0) {
        if (this.isClimbable(c, row) || this.isClimbable(c, row + 1)) {
          return c;
        }
      }
    }
    return -1;
  }

  /**
   * Validates Lode Runner digging rule:
   * Target (digCol, digRow) must be TILE_BRICK (not already dug),
   * and the tile directly above (digCol, digRow - 1) must be free of intact bricks, stone, ladders, ropes, or trapped guards.
   */
  public canDigAt(digCol: number, digRow: number): boolean {
    if (digCol < 0 || digCol >= GRID_COLS || digRow <= 0 || digRow >= GRID_ROWS - 1) return false;
    const targetIdx = digRow * GRID_COLS + digCol;
    if (this.gridMem[targetIdx] !== TILE_BRICK) return false;
    if (this.dynMem[targetIdx] !== DYN_NONE) return false;

    const aboveIdx = (digRow - 1) * GRID_COLS + digCol;
    const aboveTile = this.gridMem[aboveIdx];
    const aboveDyn = this.dynMem[aboveIdx];
    if (aboveDyn === DYN_TRAPPED_GUARD) return false;
    if (aboveTile === TILE_BRICK && aboveDyn === DYN_NONE) return false;
    if (aboveTile === TILE_SOLID || aboveTile === TILE_LADDER || aboveTile === TILE_ROPE) return false;
    if (aboveTile === TILE_HIDDEN_LADDER && this.escapeRevealed) return false;

    return true;
  }

  /**
   * Resolves the best dig direction (-1, +1, or 0) for a runner pressing the single Action button.
   */
  private getPreferredDigDir(runner: SumoRunnerPlayer): -1 | 0 | 1 | null {
    const col = Math.round(runner.x);
    const row = Math.round(runner.y);
    if (this.canDigAt(col + runner.facing, row + 1)) return runner.facing;
    const opp = (runner.facing * -1) as -1 | 1;
    if (this.canDigAt(col + opp, row + 1)) return opp;
    if (this.canDigAt(col, row + 1)) return 0;
    return null;
  }

  private triggerDig(
    runner: SumoRunnerPlayer,
    dir: -1 | 0 | 1,
    gridOriginX: number,
    gridOriginY: number,
    tileW: number,
    tileH: number
  ): boolean {
    const baseCol = Math.round(runner.x);
    const baseRow = Math.round(runner.y);
    const digCol = baseCol + dir;
    const digRow = baseRow + 1;

    if (!this.canDigAt(digCol, digRow)) return false;

    // Snap runner cleanly to baseCol so dig beam aligns with target brick
    runner.x = baseCol;
    runner.y = baseRow;
    if (dir !== 0) {
      runner.facing = dir;
    }
    runner.state = 'DIG';
    runner.digTimer = 0.16;
    runner.digTargetCol = digCol;
    runner.digTargetRow = digRow;

    const bp = this.getLevelBlueprint();
    const idx = digRow * GRID_COLS + digCol;
    this.dynMem[idx] = DYN_DUG_HOLE;
    this.dugBricks.push({
      col: digCol,
      row: digRow,
      timer: 0,
      maxDuration: bp.holeDuration,
      dugBy: runner.id
    });
    this.tileCacheDirty = true;

    const px = gridOriginX + (digCol + 0.5) * tileW;
    const py = gridOriginY + (digRow + 0.5) * tileH;
    const biome = this.getCurrentBiome();
    this.audio.playLaser(this.audio.getPlayerPan(runner.id));
    this.triggerMusicEvent('positive', 1.4);
    this.particles.spawnSparks(px, py, biome.brickLight, 10);
    // Ceremonial Shio-maki salt crystals on Shiko Stomp dig
    this.particles.spawnSparks(px, py - 4, '#F8FAFC', 4);
    return true;
  }

  public getCurrentBiome(): BiomePalette {
    if (this.currentLevel <= 10) return BIOME_PALETTES[0];
    if (this.currentLevel <= 16) return BIOME_PALETTES[1];
    if (this.currentLevel <= 22) return BIOME_PALETTES[2];
    if (this.currentLevel <= 34) return BIOME_PALETTES[3];
    return BIOME_PALETTES[4];
  }

  /**
   * Shifts the procedural chiptune soundtrack mood on positive or negative game actions.
   */
  private triggerMusicEvent(mood: 'positive' | 'negative' | 'escape', duration: number = 2.4): void {
    if (this.escapeRevealed && mood !== 'negative') {
      if (this.bgmMood !== 'escape') {
        this.bgmStepIndex = 0;
        this.bgmStepTimer = 0.01;
      }
      this.bgmMood = 'escape';
      this.bgmMoodTimer = 999;
      return;
    }
    if (this.bgmMood !== mood && (mood === 'positive' || mood === 'escape')) {
      this.bgmStepIndex = 0;
      this.bgmStepTimer = 0.01;
    }
    this.bgmMood = mood;
    this.bgmMoodTimer = Math.max(this.bgmMoodTimer, duration);
  }

  /**
   * Toggles 1P Solo Mode (No CPU) vs +CPU Partner during gameplay.
   */
  public toggleSoloMode(): void {
    this.soloMode = !this.soloMode;
    this.audio.playMenuTick();
    // Preserve P1 score/stats and respawn runners cleanly on current stage
    this.spawnActiveRunners(true);
    this.loadLevel(this.currentLevel);
    this.particles.showFloatingText(
      this.soloMode ? '👤 1P SOLO MODE (NO CPU)' : '🤖 CPU PARTNER ENABLED!',
      this.lastWidth / 2,
      78,
      this.soloMode ? '#4ADE80' : '#38BDF8',
      16
    );
  }

  /**
   * 3-Voice Procedural Chiptune Sequencer inspired by Hudson/Broderbund NES Lode Runner,
   * Super Mario Bros. (syncopated pulse-wave bounce & walking triangle bass), and
   * The Legend of Zelda (heroic 4th/5th overworld intervals & dungeon tension).
   * Dynamically shifts melody, harmony, and tempo when positive or negative actions occur!
   */
  private updateSoundtrack(dt: number): void {
    if (!this.musicEnabled || this.isFinished) return;

    if (this.bgmMoodTimer > 0) {
      this.bgmMoodTimer = Math.max(0, this.bgmMoodTimer - dt);
      if (this.bgmMoodTimer <= 0) {
        this.bgmMood = this.escapeRevealed ? 'escape' : 'normal';
      }
    } else if (this.escapeRevealed) {
      this.bgmMood = 'escape';
    } else {
      // Check if any Oni Guard is dangerously close to an alive player -> automatic 'negative' tension shift
      let guardDanger = false;
      for (const r of this.runners.values()) {
        if (r.state === 'DEAD') continue;
        for (let i = 0; i < this.guards.length; i++) {
          const g = this.guards[i];
          if (g.state === 'TRAPPED') continue;
          const dist = Math.abs(g.x - r.x) + Math.abs(g.y - r.y) * 1.5;
          if (dist < 3.4) {
            guardDanger = true;
            break;
          }
        }
        if (guardDanger) break;
      }
      this.bgmMood = guardDanger ? 'negative' : 'normal';
    }

    // Step duration (16th-note groove): faster during escape or danger, bouncy during positive flourish
    const stepDuration =
      this.bgmMood === 'escape'
        ? 0.125
        : this.bgmMood === 'negative'
          ? 0.135
          : this.bgmMood === 'positive'
            ? 0.14
            : 0.16;

    this.bgmStepTimer -= dt;
    if (this.bgmStepTimer > 0) return;
    this.bgmStepTimer += stepDuration;

    const step = this.bgmStepIndex % 32;
    this.bgmStepIndex = (this.bgmStepIndex + 1) % 32;

    // 32-step Melodic Tables (Hz, 0 = rest):
    // Normal: Mix of Lode Runner's playful 8-bit stepping motif + Mario syncopated cadence + Zelda heroic fifths
    const NORMAL_MELODY: readonly number[] = [
      523.25, 659.25, 0, 659.25, 0, 523.25, 659.25, 0,
      783.99, 0, 0, 0, 392.00, 0, 0, 0,
      440.00, 0, 587.33, 0, 659.25, 783.99, 698.46, 587.33,
      523.25, 0, 392.00, 440.00, 523.25, 0, 0, 0
    ];
    const NORMAL_BASS: readonly number[] = [
      130.81, 0, 196.00, 0, 261.63, 0, 196.00, 0,
      196.00, 0, 146.83, 0, 98.00, 0, 123.47, 0,
      110.00, 0, 164.81, 0, 174.61, 0, 146.83, 0,
      130.81, 0, 196.00, 0, 130.81, 98.00, 130.81, 0
    ];

    // Positive Action Shift (Gold collected, brick dug, or Oni trapped): Bright Lydian/Major heroic Mario+Zelda flourish!
    const POSITIVE_MELODY: readonly number[] = [
      587.33, 783.99, 880.00, 1046.50, 0, 880.00, 1046.50, 1174.66,
      1318.51, 0, 1046.50, 0, 783.99, 880.00, 1046.50, 0,
      659.25, 783.99, 987.77, 1174.66, 0, 987.77, 1174.66, 1318.51,
      1567.98, 0, 1318.51, 1046.50, 1174.66, 0, 783.99, 0
    ];
    const POSITIVE_BASS: readonly number[] = [
      196.00, 293.66, 392.00, 293.66, 220.00, 329.63, 440.00, 329.63,
      261.63, 392.00, 523.25, 392.00, 196.00, 293.66, 392.00, 0,
      164.81, 246.94, 329.63, 246.94, 196.00, 293.66, 392.00, 293.66,
      261.63, 0, 196.00, 0, 261.63, 392.00, 523.25, 0
    ];

    // Negative Action Shift (Oni Guard close pursuit, gold stolen, or player caught): Tense Phrygian/Diminished dungeon alarm!
    const NEGATIVE_MELODY: readonly number[] = [
      440.00, 466.16, 440.00, 392.00, 440.00, 554.37, 523.25, 466.16,
      440.00, 0, 329.63, 349.23, 329.63, 293.66, 329.63, 0,
      493.88, 523.25, 493.88, 440.00, 493.88, 622.25, 587.33, 523.25,
      440.00, 329.63, 261.63, 246.94, 220.00, 0, 440.00, 0
    ];
    const NEGATIVE_BASS: readonly number[] = [
      110.00, 110.00, 116.54, 110.00, 110.00, 138.59, 130.81, 116.54,
      110.00, 0, 82.41, 87.31, 82.41, 73.42, 82.41, 0,
      123.47, 123.47, 130.81, 123.47, 110.00, 110.00, 98.00, 87.31,
      82.41, 0, 110.00, 0, 82.41, 110.00, 82.41, 0
    ];

    // Escape Revealed Shift: Triumphant ascending Zelda/Lode Runner victory climb anthem!
    const ESCAPE_MELODY: readonly number[] = [
      523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51, 0,
      587.33, 739.99, 880.00, 1174.66, 880.00, 1174.66, 1479.98, 0,
      659.25, 783.99, 987.77, 1318.51, 1174.66, 1318.51, 1567.98, 0,
      1046.50, 0, 783.99, 1046.50, 1318.51, 0, 1046.50, 0
    ];
    const ESCAPE_BASS: readonly number[] = [
      130.81, 196.00, 261.63, 196.00, 130.81, 196.00, 261.63, 196.00,
      146.83, 220.00, 293.66, 220.00, 146.83, 220.00, 293.66, 220.00,
      164.81, 246.94, 329.63, 246.94, 196.00, 293.66, 392.00, 293.66,
      261.63, 196.00, 130.81, 196.00, 261.63, 0, 130.81, 0
    ];

    const leadTable =
      this.bgmMood === 'escape'
        ? ESCAPE_MELODY
        : this.bgmMood === 'positive'
          ? POSITIVE_MELODY
          : this.bgmMood === 'negative'
            ? NEGATIVE_MELODY
            : NORMAL_MELODY;
    const bassTable =
      this.bgmMood === 'escape'
        ? ESCAPE_BASS
        : this.bgmMood === 'positive'
          ? POSITIVE_BASS
          : this.bgmMood === 'negative'
            ? NEGATIVE_BASS
            : NORMAL_BASS;

    // Slight pitch transposition by chapter so later chapters feel fresh
    const chapterSemitones = this.currentLevel <= 0 ? 0 : Math.min(4, Math.floor((this.currentLevel - 1) / 10));
    const pitchMul = Math.pow(2, chapterSemitones / 12);

    const leadFreq = leadTable[step] * pitchMul;
    const bassFreq = bassTable[step] * pitchMul;

    if (leadFreq > 0) {
      const wave: OscillatorType = this.bgmMood === 'negative' ? 'sawtooth' : 'square';
      const slide = this.bgmMood === 'positive' && step % 2 === 1 ? leadFreq * 1.06 : undefined;
      this.audio.playChiptuneVoice(leadFreq, stepDuration * 0.88, wave, 0.115, -0.12, slide);
      // Add harmonic fifth / third counter-melody shimmer
      if ((this.bgmMood === 'positive' || this.bgmMood === 'escape') && step % 2 === 0) {
        this.audio.playChiptuneVoice(leadFreq * 1.5, stepDuration * 0.72, 'triangle', 0.068, 0.18);
      } else if (this.bgmMood === 'normal' && step % 4 === 0) {
        this.audio.playChiptuneVoice(leadFreq * 0.5, stepDuration * 0.75, 'triangle', 0.055, 0.14);
      }
    }

    if (bassFreq > 0) {
      // Fundamental NES triangle bass + subtle octave-up square overtone so bassline cuts through laptop/phone speakers
      this.audio.playChiptuneVoice(bassFreq, stepDuration * 0.92, 'triangle', 0.155, 0.06);
      this.audio.playChiptuneVoice(bassFreq * 2, stepDuration * 0.55, 'square', 0.042, 0.06);
    }

    // Chiptune Taiko & Hi-Hat Percussion Groove
    if (step % 4 === 0) {
      this.audio.playChiptunePercussion('kick', this.bgmMood === 'negative' ? 0.14 : 0.115);
    } else if (step % 4 === 2) {
      this.audio.playChiptunePercussion(this.bgmMood === 'negative' ? 'snare' : 'hat', 0.085);
    } else if (this.bgmMood !== 'normal' && step % 2 === 1) {
      this.audio.playChiptunePercussion('hat', 0.062);
    }
  }

  public update(dt: number, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    if (this.input) {
      this.input.suppressPhoneOverlay = this.isTouchDeckVisible(width, height);
    }
    if (this.isFinished) return;

    const clampedDt = Math.min(dt, 0.05);
    const p1 = this.runners.get(0) || Array.from(this.runners.values())[0];
    if (p1 && p1.state !== 'DEAD') {
      const camLerp = 1 - Math.exp(-10 * clampedDt);
      this.camFocusX += (p1.x - this.camFocusX) * camLerp;
      this.camFocusY += (p1.y - this.camFocusY) * camLerp;
    }

    if (this.currentLevel > 0) {
      this.roundTimer = Math.max(0, this.roundTimer - clampedDt);
    }
    if (this.stageHintTimer > 0) {
      this.stageHintTimer = Math.max(0, this.stageHintTimer - clampedDt);
    }

    // Update dynamic reactive background soundtrack
    this.updateSoundtrack(clampedDt);

    // Handle quick keyboard level navigation & toggles ([ / ] / T / R / B / M)
    if (this.justRawKeys.has('BracketLeft') || this.justRawKeys.has('PageDown')) {
      if (this.currentLevel > 0) {
        this.audio.playMenuTick();
        this.loadLevel(this.currentLevel - 1);
      }
    } else if (this.justRawKeys.has('BracketRight') || this.justRawKeys.has('PageUp')) {
      if (this.currentLevel < SUMO_LODE_LEVELS.length) {
        this.audio.playMenuTick();
        this.loadLevel(this.currentLevel + 1);
      }
    } else if (this.justRawKeys.has('KeyT')) {
      this.audio.playMenuTick();
      this.loadLevel(0);
    } else if (this.justRawKeys.has('KeyR')) {
      this.audio.playTap();
      this.loadLevel(this.currentLevel);
    } else if (this.justRawKeys.has('KeyB')) {
      this.toggleSoloMode();
    } else if (this.justRawKeys.has('KeyM')) {
      this.musicEnabled = !this.musicEnabled;
      this.audio.playMenuTick();
    }

    if (this.escapeFlashTimer > 0) {
      this.escapeFlashTimer = Math.max(0, this.escapeFlashTimer - clampedDt);
    }

    // Stage Clear celebration transition to next level
    if (this.levelClearBannerTimer > 0) {
      this.levelClearBannerTimer -= clampedDt;
      if (this.levelClearBannerTimer <= 0) {
        if (this.currentLevel < SUMO_LODE_LEVELS.length) {
          this.currentLevel++;
          if (this.currentLevel > this.maxUnlockedLevel) {
            this.maxUnlockedLevel = this.currentLevel;
            try {
              localStorage.setItem('antigravity_sumo_lode_unlocked', String(this.maxUnlockedLevel));
            } catch {
              // ignore
            }
          }
          this.loadLevel(this.currentLevel);
        } else {
          // Completed all 40 levels!
          this.isFinished = true;
          this.audio.playFanfare();
        }
      }
      this.justRawKeys.clear();
      return;
    }

    this.updateBots(clampedDt, width, height);

    const layout = this.getGridLayout(width, height);
    const { originX, originY, tileW, tileH } = layout;

    // 1. Update Dug Bricks & Regeneration Timers
    this.updateDugBricks(clampedDt, originX, originY, tileW, tileH);

    // 2. Update Bonus Yokozuna Onigiri Item (1994 Legend Returns tribute)
    if (this.bonusItem.active) {
      this.bonusItem.timer -= clampedDt;
      if (this.bonusItem.timer <= 0) {
        this.bonusItem.active = false;
      }
    }

    // 3. Update Sumo Players
    this.updateRunners(clampedDt, originX, originY, tileW, tileH);

    // 4. Update Rival Oni-Sumo Guards
    this.updateGuards(clampedDt, originX, originY, tileW, tileH);

    // 5. Check Escape Ladder Stage Clear condition
    const remainingGold = this.getRemainingGoldCount();
    const totalGold = this.golds.length;

    // Spawn Bonus Yokozuna Onigiri when 50% of gold is collected (Stages 1..40)
    if (
      this.currentLevel > 0 &&
      !this.bonusItem.spawnedThisLevel &&
      totalGold >= 4 &&
      totalGold - remainingGold >= Math.ceil(totalGold * 0.5)
    ) {
      this.bonusItem.spawnedThisLevel = true;
      this.bonusItem.active = true;
      this.bonusItem.timer = 15.0;
      const bx = originX + (this.bonusItem.col + 0.5) * tileW;
      const by = originY + (this.bonusItem.row + 0.5) * tileH;
      this.particles.spawnSparks(bx, by, '#FFFFFF', 10);
      this.particles.showFloatingText('🍙 YOKOZUNA ONIGIRI APPEARED!', bx, by - 16, '#F8FAFC', 13);
    }

    if (remainingGold === 0 && !this.escapeRevealed) {
      this.escapeRevealed = true;
      this.escapeFlashTimer = 1.2;
      this.tileCacheDirty = true;
      this.audio.playSecretChime();
      this.audio.playFanfare();
      this.triggerMusicEvent('escape', 999);
      this.particles.showFloatingText('⚡ ESCAPE LADDER REVEALED! CLIMB TO TOP!', width / 2, originY + 28, '#FDE047', 20);
    }

    if (this.escapeRevealed) {
      for (const runner of this.runners.values()) {
        if (runner.state !== 'DEAD' && runner.y <= 0.38 && this.isClimbable(Math.round(runner.x), 0)) {
          // Player reached top of the escape ladder!
          runner.score += 500;
          runner.levelsCleared += 1;

          // Award Co-op Survival Bonus to surviving teammates
          for (const mate of this.runners.values()) {
            if (mate.id !== runner.id && mate.state !== 'DEAD') {
              mate.score += 250;
              mate.levelsCleared += 1;
            }
          }

          this.audio.playFanfare();
          const px = originX + (runner.x + 0.5) * tileW;
          const py = originY + 20;
          this.particles.spawnWinnerCelebration(px, py, '#FBBF24');
          this.particles.spawnSparks(px, py, '#F8FAFC', 18); // Ceremonial Shio-maki salt shower
          const stageLabel = this.currentLevel === 0 ? 'TUTORIAL DOJO' : `STAGE ${this.currentLevel}`;
          this.particles.showFloatingText(`🏆 ${stageLabel} CLEAR! +500 PTS!`, width / 2, height / 2 - 20, '#FDE047', 24);
          this.levelClearBannerTimer = 1.75;
          break;
        }
      }
    }

    // If teamLives runs out on a campaign stage, restart the current stage instead of booting to Game Over
    if (this.teamLives <= 0 && this.currentLevel > 0) {
      this.particles.showFloatingText('🔄 DOHYŌ RESET — TRY STAGE AGAIN!', width / 2, height / 2, '#38BDF8', 20);
      this.loadLevel(this.currentLevel);
    } else if (this.roundTimer <= 0 && this.currentLevel > 0) {
      this.isFinished = true;
    }

    this.justRawKeys.clear();
  }

  private updateDugBricks(dt: number, originX: number, originY: number, tileW: number, tileH: number): void {
    for (let i = this.dugBricks.length - 1; i >= 0; i--) {
      const b = this.dugBricks[i];
      b.timer += dt;

      if (b.timer >= b.maxDuration) {
        // Brick seals shut!
        const idx = b.row * GRID_COLS + b.col;
        this.dynMem[idx] = DYN_NONE;
        this.tileCacheDirty = true;

        const px = originX + (b.col + 0.5) * tileW;
        const py = originY + (b.row + 0.5) * tileH;

        // Check if any guard is inside the sealing brick -> Crush & Respawn at top!
        for (let gIdx = 0; gIdx < this.guards.length; gIdx++) {
          const g = this.guards[gIdx];
          if (Math.round(g.x) === b.col && Math.round(g.y) === b.row) {
            if (g.carryingGoldId !== null) {
              this.dropGuardGold(g, b.col, b.row - 1);
            }
            g.x = g.spawnCol;
            g.y = this.currentLevel === 0 ? g.spawnRow : 0;
            g.state = this.currentLevel === 0 ? 'PATROL' : 'FALL';
            g.trapTimer = 0;
            g.trapCol = -1;
            g.trapRow = -1;
            g.climbOutTimer = 0;
            g.respawnFlashTimer = 0.65;

            const creditPlayer = this.runners.get(b.dugBy);
            if (creditPlayer) {
              creditPlayer.score += 250;
            }
            this.audio.playExplosion();
            this.triggerMusicEvent('positive', 2.8);
            this.particles.spawnSparks(px, py, '#F59E0B', 14);
            this.particles.showFloatingText('+250 ONI CRUSHED!', px, py - 14, '#FBBF24', 14);
          }
        }

        // Check if any player is trapped inside the sealing brick or sealed inside a 1-tile pocket below
        for (const r of this.runners.values()) {
          if (r.state === 'DEAD') continue;
          const rCol = Math.round(r.x);
          const rRow = Math.round(r.y);
          if (rCol === b.col && rRow === b.row) {
            this.killRunner(r, originX, originY, tileW, tileH, 'CRUSHED BY DOHYO CLAY!');
          } else if (
            rCol === b.col &&
            rRow === b.row + 1 &&
            !this.isCellPassable(rCol - 1, rRow) &&
            !this.isCellPassable(rCol + 1, rRow) &&
            !this.isCellPassable(rCol, rRow + 1) &&
            !this.isClimbable(rCol, rRow)
          ) {
            // Anti-entombment failsafe: boost the Sumo runner above the sealing brick so they are never softlocked
            r.y = Math.max(0, b.row - 1);
            r.state = 'IDLE';
            this.particles.spawnSparks(px, py - tileH, '#F8FAFC', 10);
            this.particles.showFloatingText('SHIKO BOOST UP!', px, py - tileH, '#38BDF8', 12);
          }
        }

        // Ensure no gold item is buried inside the sealed brick
        for (let gIdx = 0; gIdx < this.golds.length; gIdx++) {
          const gold = this.golds[gIdx];
          if (!gold.collected && gold.carriedByGuardId === null && gold.col === b.col && gold.row === b.row) {
            gold.row = Math.max(0, b.row - 1);
          }
        }

        this.dugBricks.splice(i, 1);
      }
    }
  }

  private killRunner(runner: SumoRunnerPlayer, originX: number, originY: number, tileW: number, tileH: number, reason: string): void {
    if (runner.state === 'DEAD' || runner.invulnTimer > 0) return;
    runner.state = 'DEAD';
    runner.respawnTimer = 1.15;

    // Only human deaths in non-tutorial stages consume teamLives
    const pConfig = this.players[runner.id];
    const isHuman = pConfig ? pConfig.type === 'human' : true;
    if (this.currentLevel > 0 && isHuman) {
      this.teamLives = Math.max(0, this.teamLives - 1);
    }

    const px = originX + (runner.x + 0.5) * tileW;
    const py = originY + (runner.y + 0.5) * tileH;
    this.audio.playStun();
    this.triggerMusicEvent('negative', 3.0);
    this.particles.addTrauma(0.22);
    this.particles.spawnExplosion(px, py, '#EF4444', 18);
    this.particles.showFloatingText(reason, px, py - 16, '#EF4444', 14);
  }

  private updateRunners(dt: number, originX: number, originY: number, tileW: number, tileH: number): void {
    const moveSpeed = 5.6 * this.activeMutator.speedMultiplier;

    for (const r of this.runners.values()) {
      r.animPhase += dt * 10;
      if (r.invulnTimer > 0) r.invulnTimer = Math.max(0, r.invulnTimer - dt);
      if (r.dropFromRopeCooldown > 0) r.dropFromRopeCooldown = Math.max(0, r.dropFromRopeCooldown - dt);

      if (r.state === 'DEAD') {
        r.respawnTimer -= dt;
        if (r.respawnTimer <= 0 && (this.teamLives > 0 || this.currentLevel === 0)) {
          r.x = r.spawnCol;
          r.y = r.spawnRow;
          r.state = 'IDLE';
          r.invulnTimer = 2.0;
          const px = originX + (r.x + 0.5) * tileW;
          const py = originY + (r.y + 0.5) * tileH;
          this.particles.spawnSparks(px, py, '#38BDF8', 12);
          this.particles.spawnSparks(px, py, '#F8FAFC', 8); // Ceremonial salt purification
        }
        continue;
      }

      if (r.state === 'DIG') {
        r.digTimer -= dt;
        if (r.digTimer <= 0) {
          r.state = 'IDLE';
        }
        continue;
      }

      const col = Math.round(r.x);
      const row = Math.round(r.y);
      const cellIdx = row * GRID_COLS + col;
      const currentTile = this.gridMem[cellIdx];
      const onLadder = this.isClimbable(col, row);
      const onRope = currentTile === TILE_ROPE && r.dropFromRopeCooldown <= 0 && Math.abs(r.y - row) < 0.38;
      // Floor support only engages once the runner has actually reached the integer row (not at y = row - 0.49 mid-air!)
      const floorSupport = this.isTileSupported(col, row) && (onLadder || r.y >= row - 0.08);
      const supported = onLadder || onRope || floorSupport;

      // Reveal false brick if player steps or falls through a trapdoor (with Zelda/Broderbund secret discovery chime!)
      const belowRow = Math.min(GRID_ROWS - 1, row + 1);
      const belowIdx = belowRow * GRID_COLS + col;
      if (this.gridMem[belowIdx] === TILE_TRAPDOOR && this.trapdoorRevealed[belowIdx] === 0) {
        this.trapdoorRevealed[belowIdx] = 1;
        this.tileCacheDirty = true;
        const tx = originX + (col + 0.5) * tileW;
        const ty = originY + (belowRow + 0.5) * tileH;
        this.audio.playSecretChime();
        this.triggerMusicEvent('positive', 1.8);
        this.particles.spawnSparks(tx, ty, '#38BDF8', 10);
        this.particles.showFloatingText('✨ SECRET PASSAGE!', tx, ty - 10, '#38BDF8', 12);
      }
      if (currentTile === TILE_TRAPDOOR && this.trapdoorRevealed[cellIdx] === 0) {
        this.trapdoorRevealed[cellIdx] = 1;
        this.tileCacheDirty = true;
        const tx = originX + (col + 0.5) * tileW;
        const ty = originY + (row + 0.5) * tileH;
        this.audio.playSecretChime();
        this.triggerMusicEvent('positive', 1.8);
        this.particles.spawnSparks(tx, ty, '#38BDF8', 10);
      }

      if (!supported) {
        // Gravity fall (authentic Lode Runner: straight vertical drop, snap X to column)
        const prevFloorRow = Math.floor(r.y + 0.05);
        r.state = 'FALL';
        r.x += (col - r.x) * Math.min(1, dt * 18);
        r.y = Math.min(GRID_ROWS - 1, r.y + moveSpeed * 1.18 * dt);

        const newFloorRow = Math.floor(r.y + 0.05);
        if (newFloorRow > prevFloorRow && newFloorRow < GRID_ROWS) {
          const landTile = this.gridMem[newFloorRow * GRID_COLS + col];
          if (landTile === TILE_ROPE && r.dropFromRopeCooldown <= 0) {
            r.y = newFloorRow;
            r.state = 'ROPE';
          } else if (this.isClimbable(col, newFloorRow) || this.isTileSupported(col, newFloorRow)) {
            r.y = newFloorRow;
            r.state = 'IDLE';
          }
        }
        this.collectGoldAt(r, Math.round(r.x), Math.round(r.y), originX, originY, tileW, tileH);
        continue;
      }

      // Read directional & dig inputs (use justAction without justPressed so touch joystick movement doesn't auto-dig)
      let steer = this.input.getSteer(r.id);
      let throttle = this.input.getThrottle(r.id);
      const justAct = this.input.justAction(r.id);

      // Dedicated iPhone Arcade Touch Control Deck D-Pad override for Player 1
      if (r.id === 0 && (this.virtualDpadSteer !== 0 || this.virtualDpadThrottle !== 0)) {
        steer = this.virtualDpadSteer;
        throttle = this.virtualDpadThrottle;
      }

      const moveX = Math.abs(steer) > 0.25 ? Math.sign(steer) : 0;
      const moveY = Math.abs(throttle) > 0.25 ? -Math.sign(throttle) : 0; // -1 = UP, +1 = DOWN

      if (moveX !== 0) {
        r.facing = moveX as -1 | 1;
      }

      // Check dedicated Dig Left / Dig Right hotkeys, Touch Deck Dig buttons, OR Action button
      let wantDigDir: -1 | 1 | 0 | null = null;
      if (r.id === 0) {
        if (this.virtualDigDir !== null) {
          wantDigDir = this.virtualDigDir;
          r.facing = this.virtualDigDir;
          this.virtualDigDir = null;
        } else if (this.justRawKeys.has('KeyQ') || this.justRawKeys.has('KeyZ')) {
          wantDigDir = -1;
        } else if (this.justRawKeys.has('KeyE') || this.justRawKeys.has('KeyX') || this.justRawKeys.has('KeyC')) {
          wantDigDir = 1;
        }
      } else if (r.id === 1) {
        if (this.justRawKeys.has('Comma') || this.justRawKeys.has('Slash') || this.justRawKeys.has('ShiftRight')) wantDigDir = -1;
        else if (this.justRawKeys.has('Period')) wantDigDir = 1;
      }

      if (wantDigDir === null && justAct && !onRope) {
        wantDigDir = this.getPreferredDigDir(r);
      } else if (wantDigDir !== null && !this.canDigAt(col + wantDigDir, row + 1) && this.canDigAt(col, row + 1)) {
        // Allow Q/Z/E/X/C to Shiko-stomp straight down if diagonal is blocked by a wall
        wantDigDir = 0;
      }

      if (wantDigDir !== null && !onRope) {
        this.input.consumeAction(r.id);
        if (this.triggerDig(r, wantDigDir, originX, originY, tileW, tileH)) {
          continue;
        }
      }

      // Drop off rope when pressing Down
      if (onRope && moveY > 0 && !onLadder) {
        r.dropFromRopeCooldown = 0.32;
        r.y = row + 0.45;
        r.state = 'FALL';
        continue;
      }

      // Vertical climbing on Ladders (with ±0.42 corner-snapping & smooth top-of-ladder completion)
      let movedVertically = false;
      if (moveY !== 0) {
        const ladderCol = this.findNearbyLadderCol(r.x, row, moveY);
        if (ladderCol !== -1) {
          let targetY = r.y + moveY * moveSpeed * dt;
          // If climbing UP out of the top rung (where row itself is empty air above the ladder at row + 1),
          // clamp targetY at `row` so the player reaches the exact floor level and can walk off smoothly
          if (moveY < 0 && !this.isClimbable(ladderCol, row) && !this.isClimbable(ladderCol, row - 1)) {
            targetY = Math.max(row, targetY);
          }
          const checkRow = moveY < 0 ? Math.floor(targetY + 0.02) : Math.ceil(targetY - 0.02);
          if (
            checkRow >= 0 &&
            checkRow < GRID_ROWS &&
            this.isCellPassable(ladderCol, checkRow) &&
            Math.abs(targetY - r.y) > 0.001
          ) {
            r.x += (ladderCol - r.x) * Math.min(1, dt * 18);
            r.y = Math.max(0, Math.min(GRID_ROWS - 2, targetY));
            r.state = 'CLIMB';
            movedVertically = true;
          }
        }
      }

      // Horizontal movement (Running on ground/trapped-guard/ladder-top, or shimmying on rope)
      if (!movedVertically && moveX !== 0) {
        const nextX = r.x + moveX * moveSpeed * dt;
        const targetCol = moveX > 0 ? Math.ceil(nextX - 0.15) : Math.floor(nextX + 0.15);
        if (targetCol >= 0 && targetCol < GRID_COLS && this.isCellPassable(targetCol, row)) {
          r.x = Math.max(0, Math.min(GRID_COLS - 1, nextX));
          r.y += (row - r.y) * Math.min(1, dt * 16);
          r.state = onRope ? 'ROPE' : onLadder ? 'CLIMB' : 'RUN';
        } else {
          r.x = col;
          r.state = onRope ? 'ROPE' : onLadder ? 'CLIMB' : 'IDLE';
        }
      } else if (!movedVertically) {
        r.x += (col - r.x) * Math.min(1, dt * 12);
        r.y += (row - r.y) * Math.min(1, dt * 12);
        r.state = onRope ? 'ROPE' : onLadder ? 'CLIMB' : 'IDLE';
      }

      this.collectGoldAt(r, Math.round(r.x), Math.round(r.y), originX, originY, tileW, tileH);
    }
  }

  private collectGoldAt(runner: SumoRunnerPlayer, col: number, row: number, originX: number, originY: number, tileW: number, tileH: number): void {
    for (let i = 0; i < this.golds.length; i++) {
      const g = this.golds[i];
      if (!g.collected && g.carriedByGuardId === null && g.col === col && g.row === row) {
        g.collected = true;
        runner.goldCollected++;
        const isFreefall = runner.state === 'FALL';
        const basePts = isFreefall ? 300 : 250;
        const earned = Math.round(basePts * this.activeMutator.scoreMultiplier);
        runner.score += earned;
        const px = originX + (col + 0.5) * tileW;
        const py = originY + (row + 0.5) * tileH;
        this.audio.playCoin();
        this.triggerMusicEvent('positive', isFreefall ? 2.8 : 2.4);
        this.particles.spawnSparks(px, py, '#FDE047', isFreefall ? 18 : 12);
        if (isFreefall) {
          this.particles.spawnSparks(px, py, '#38BDF8', 8);
          this.particles.showFloatingText(`⚡ +${earned} FREEFALL GOLD!`, px, py - 14, '#38BDF8', 13);
        } else {
          this.particles.showFloatingText(`+${earned} GOLD!`, px, py - 12, '#FDE047', 13);
        }
      }
    }

    // Check Yokozuna Onigiri Bonus pickup
    if (this.bonusItem.active && this.bonusItem.col === col && this.bonusItem.row === row) {
      this.bonusItem.active = false;
      runner.score += Math.round(800 * this.activeMutator.scoreMultiplier);
      const px = originX + (col + 0.5) * tileW;
      const py = originY + (row + 0.5) * tileH;
      this.audio.playFanfare();
      this.triggerMusicEvent('positive', 3.5);
      this.particles.spawnSparks(px, py, '#FFFFFF', 16);
      this.particles.showFloatingText('🍙 +800 ONIGIRI BONUS!', px, py - 14, '#4ADE80', 15);
    }
  }

  private dropGuardGold(guard: OniGuard, col: number, row: number): void {
    if (guard.carryingGoldId === null) return;
    const gold = this.golds[guard.carryingGoldId];
    guard.carryingGoldId = null;
    if (!gold) return;
    gold.carriedByGuardId = null;

    const safeCol = Math.max(0, Math.min(GRID_COLS - 1, col));
    const safeRow = Math.max(0, Math.min(GRID_ROWS - 2, row));
    gold.col = safeCol;
    gold.row = safeRow;
  }

  private updateGuards(dt: number, originX: number, originY: number, tileW: number, tileH: number): void {
    const bp = this.getLevelBlueprint();
    const guardSpeed = bp.guardSpeed * this.activeMutator.speedMultiplier;

    for (let gIdx = 0; gIdx < this.guards.length; gIdx++) {
      const g = this.guards[gIdx];
      g.animPhase += dt * 9;
      if (g.dropFromRopeCooldown > 0) g.dropFromRopeCooldown = Math.max(0, g.dropFromRopeCooldown - dt);
      if (g.respawnFlashTimer > 0) g.respawnFlashTimer = Math.max(0, g.respawnFlashTimer - dt);

      const col = Math.round(g.x);
      const row = Math.round(g.y);
      const cellIdx = row * GRID_COLS + col;

      // 0. Check if guard is currently climbing out of a hole
      if (g.state === 'CLIMB_OUT') {
        g.climbOutTimer -= dt;
        const t = 1 - Math.max(0, g.climbOutTimer / 0.22);
        g.x = g.trapCol + (g.climbOutCol - g.trapCol) * t;
        g.y = g.trapRow - t;
        if (g.climbOutTimer <= 0) {
          g.x = g.climbOutCol;
          g.y = Math.max(0, g.trapRow - 1);
          g.immuneHoleCol = g.trapCol;
          g.immuneHoleRow = g.trapRow;
          g.state = 'PATROL';
          g.trapCol = -1;
          g.trapRow = -1;
        }
        continue;
      }

      // 1. Check if guard is currently TRAPPED in a dug hole
      if (g.state === 'TRAPPED') {
        g.trapTimer += dt;
        const holeIdx = g.trapRow * GRID_COLS + g.trapCol;
        if (this.dynMem[holeIdx] !== DYN_NONE) {
          this.dynMem[holeIdx] = DYN_TRAPPED_GUARD;
        }

        if (g.trapTimer >= bp.trapDuration) {
          // Verify cell directly above hole is passable before climbing out
          if (this.isCellPassable(g.trapCol, g.trapRow - 1, true)) {
            this.dynMem[holeIdx] = DYN_DUG_HOLE;
            const climbDir = g.facing;
            let exitCol = g.trapCol + climbDir;
            if (!this.isCellPassable(exitCol, g.trapRow - 1, true)) {
              exitCol = g.trapCol - climbDir;
            }
            if (!this.isCellPassable(exitCol, g.trapRow - 1, true)) {
              exitCol = g.trapCol;
            }
            g.climbOutCol = Math.max(0, Math.min(GRID_COLS - 1, exitCol));
            g.climbOutTimer = 0.22;
            g.state = 'CLIMB_OUT';
            g.trapTimer = 0;
          }
        }
        continue;
      }

      // Clear hole immunity once guard moves away from the hole column
      if (g.immuneHoleCol !== -1 && (col !== g.immuneHoleCol || row !== g.immuneHoleRow - 1)) {
        g.immuneHoleCol = -1;
        g.immuneHoleRow = -1;
      }

      // 2. Check if guard stepped into an open DUG_HOLE!
      if (this.dynMem[cellIdx] === DYN_DUG_HOLE && !(col === g.immuneHoleCol && row === g.immuneHoleRow)) {
        g.state = 'TRAPPED';
        g.trapCol = col;
        g.trapRow = row;
        g.trapTimer = 0;
        g.x = col;
        g.y = row;
        this.dynMem[cellIdx] = DYN_TRAPPED_GUARD;

        // Drop any carried gold right above the hole (authentic Lode Runner mechanic!)
        if (g.carryingGoldId !== null) {
          this.dropGuardGold(g, col, Math.max(0, row - 1));
        }

        // Award trap points to the player who dug this hole (zero-allocation loop)
        for (let bIdx = 0; bIdx < this.dugBricks.length; bIdx++) {
          const b = this.dugBricks[bIdx];
          if (b.col === col && b.row === row) {
            const r = this.runners.get(b.dugBy);
            if (r) {
              r.score += 75;
              r.guardsTrapped++;
            }
            break;
          }
        }
        const px = originX + (col + 0.5) * tileW;
        const py = originY + (row + 0.5) * tileH;
        this.audio.playBounce();
        this.triggerMusicEvent('positive', 2.4);
        this.particles.spawnSparks(px, py, '#38BDF8', 8);
        this.particles.showFloatingText('+75 TRAPPED!', px, py - 12, '#38BDF8', 12);
        continue;
      }

      // 3. Check if guard is supported or falling
      const onLadder = this.isClimbable(col, row);
      const onRope = this.gridMem[cellIdx] === TILE_ROPE && g.dropFromRopeCooldown <= 0 && Math.abs(g.y - row) < 0.38;
      const floorSupport = this.isTileSupported(col, row) && (onLadder || g.y >= row - 0.08);
      const supported = onLadder || onRope || floorSupport;

      if (!supported) {
        const prevFloorRow = Math.floor(g.y + 0.05);
        g.state = 'FALL';
        g.x += (col - g.x) * Math.min(1, dt * 16);
        g.y = Math.min(GRID_ROWS - 1, g.y + guardSpeed * 1.25 * dt);
        const newFloorRow = Math.floor(g.y + 0.05);
        if (newFloorRow > prevFloorRow && newFloorRow < GRID_ROWS) {
          const newIdx = newFloorRow * GRID_COLS + col;
          if (this.dynMem[newIdx] === DYN_DUG_HOLE && !(col === g.immuneHoleCol && newFloorRow === g.immuneHoleRow)) {
            g.y = newFloorRow;
          } else if (this.gridMem[newIdx] === TILE_ROPE && g.dropFromRopeCooldown <= 0) {
            g.y = newFloorRow;
            g.state = 'ROPE';
          } else if (this.isClimbable(col, newFloorRow) || this.isTileSupported(col, newFloorRow)) {
            g.y = newFloorRow;
            g.state = 'PATROL';
          }
        }
        continue;
      }

      // 4. Guard Gold Stealing & Dropping (disabled in Stage 0 Tutorial and first 2.5s of a stage)
      if (this.currentLevel > 0 && this.roundTimer < 177.5) {
        if (g.carryingGoldId === null) {
          for (let i = 0; i < this.golds.length; i++) {
            const gold = this.golds[i];
            if (!gold.collected && gold.carriedByGuardId === null && gold.col === col && gold.row === row) {
              gold.carriedByGuardId = g.id;
              g.carryingGoldId = gold.id;
              g.goldHoldTimer = 4.5 + Math.random() * 3.0;
              this.triggerMusicEvent('negative', 1.8);
              break;
            }
          }
        } else {
          g.goldHoldTimer -= dt;
          const belowT = row + 1 < GRID_ROWS ? this.gridMem[(row + 1) * GRID_COLS + col] : TILE_SOLID;
          const permanentFloor = belowT === TILE_BRICK || belowT === TILE_SOLID || belowT === TILE_LADDER;
          if (g.goldHoldTimer <= 0 && this.gridMem[cellIdx] === TILE_EMPTY && permanentFloor && this.isTileSupported(col, row)) {
            this.dropGuardGold(g, col, row);
          }
        }
      }

      // 5. In Stage 0 Tutorial, keep the trainee Oni Guard patrolling its upper platform (cols 15..22, row 5)
      if (this.currentLevel === 0) {
        if (g.moveDirX === 0) g.moveDirX = 1;
        const nextX = g.x + g.moveDirX * guardSpeed * dt;
        if (nextX > 22) {
          g.x = 22;
          g.moveDirX = -1;
        } else if (nextX < 15) {
          g.x = 15;
          g.moveDirX = 1;
        } else {
          g.x = nextX;
        }
        g.facing = g.moveDirX as -1 | 1;
        g.y += (row - g.y) * Math.min(1, dt * 15);
        g.state = 'PATROL';
      } else {
        // Find nearest alive player & run Wasm-assisted BFS pathfinding
        let nearestPlayer: SumoRunnerPlayer | null = null;
        let bestCost = 999999;
        for (const r of this.runners.values()) {
          if (r.state === 'DEAD') continue;
          const rc = Math.round(r.x);
          const rr = Math.round(r.y);
          const cost = this.wasmExports
            ? this.wasmExports.manhattanCost(col, row, rc, rr)
            : Math.abs(col - rc) + Math.abs(row - rr) * 2;
          if (cost < bestCost) {
            bestCost = cost;
            nearestPlayer = r;
          }
        }

        g.repathTimer -= dt;
        if (nearestPlayer && (g.repathTimer <= 0 || (g.moveDirX === 0 && g.moveDirY === 0))) {
          g.repathTimer = 0.14;
          const step = this.computeShortestPathStep(col, row, Math.round(nearestPlayer.x), Math.round(nearestPlayer.y), true);
          g.moveDirX = step.dx;
          g.moveDirY = step.dy;
        }

        // Execute Guard Movement (with smooth top-of-ladder completion)
        const canFinishLadderUp = g.moveDirY < 0 && g.y > row && this.isClimbable(col, row + 1);
        if (
          g.moveDirY !== 0 &&
          (onLadder || canFinishLadderUp || (g.moveDirY > 0 && onRope) || this.isClimbable(col, row + g.moveDirY))
        ) {
          if (g.moveDirY > 0 && onRope && !onLadder) {
            g.dropFromRopeCooldown = 0.32;
            g.y = row + 0.45;
            g.state = 'FALL';
          } else {
            g.x += (col - g.x) * Math.min(1, dt * 15);
            let nextY = g.y + g.moveDirY * guardSpeed * dt;
            if (g.moveDirY < 0 && !onLadder && !this.isClimbable(col, row - 1)) {
              nextY = Math.max(row, nextY);
            }
            g.y = Math.max(0, Math.min(GRID_ROWS - 2, nextY));
            g.state = 'CLIMB';
          }
        } else if (g.moveDirX !== 0) {
          g.facing = g.moveDirX as -1 | 1;
          const nextX = g.x + g.moveDirX * guardSpeed * dt;
          const checkCol = g.moveDirX > 0 ? Math.ceil(nextX - 0.12) : Math.floor(nextX + 0.12);
          if (
            checkCol >= 0 &&
            checkCol < GRID_COLS &&
            this.isCellPassable(checkCol, row, true) &&
            !this.isGuardAt(g.id, checkCol, row)
          ) {
            g.x = Math.max(0, Math.min(GRID_COLS - 1, nextX));
            g.y += (row - g.y) * Math.min(1, dt * 15);
            g.state = onRope ? 'ROPE' : 'PATROL';
          } else {
            g.moveDirX = -g.moveDirX;
          }
        }
      }

      // 6. Check Guard catching a Player (do not catch players on the ledge above when guard is already falling into a hole)
      const guardOverHole = this.dynMem[cellIdx] === DYN_DUG_HOLE || (row + 1 < GRID_ROWS && this.dynMem[(row + 1) * GRID_COLS + col] === DYN_DUG_HOLE && g.state === 'FALL');
      if (!guardOverHole) {
        for (const r of this.runners.values()) {
          if (r.state === 'DEAD' || r.invulnTimer > 0) continue;
          if (Math.abs(r.x - g.x) < 0.48 && Math.abs(r.y - g.y) < 0.48) {
            this.killRunner(r, originX, originY, tileW, tileH, 'CAUGHT BY ONI GUARD!');
          }
        }
      }
    }
  }

  private isGuardAt(excludeGuardId: number, col: number, row: number): boolean {
    for (let i = 0; i < this.guards.length; i++) {
      const g = this.guards[i];
      if (g.id !== excludeGuardId && g.state !== 'TRAPPED' && Math.round(g.x) === col && Math.round(g.y) === row) {
        return true;
      }
    }
    return false;
  }

  /**
   * Zero-Allocation Ring-Buffer BFS Pathfinding across the 28x16 Lode Runner Graph.
   */
  private computeShortestPathStep(
    startCol: number,
    startRow: number,
    targetCol: number,
    targetRow: number,
    isGuard: boolean
  ): { dx: number; dy: number } {
    if (startCol === targetCol && startRow === targetRow) {
      return { dx: 0, dy: 0 };
    }

    this.bfsVisited.fill(0);
    let head = 0;
    let tail = 0;

    const startIdx = startRow * GRID_COLS + startCol;
    this.bfsVisited[startIdx] = 1;
    this.bfsQueueCol[tail] = startCol;
    this.bfsQueueRow[tail] = startRow;
    this.bfsFirstMoveX[tail] = 0;
    this.bfsFirstMoveY[tail] = 0;
    tail++;

    let bestFallbackIdx = -1;
    let bestFallbackCost = 999999;

    while (head < tail) {
      const c = this.bfsQueueCol[head];
      const r = this.bfsQueueRow[head];
      const fmx = this.bfsFirstMoveX[head];
      const fmy = this.bfsFirstMoveY[head];
      head++;

      if (c === targetCol && r === targetRow) {
        return { dx: fmx, dy: fmy };
      }

      if (head > 1) {
        const hCost = this.wasmExports
          ? this.wasmExports.manhattanCost(c, r, targetCol, targetRow)
          : Math.abs(c - targetCol) + Math.abs(r - targetRow) * 2;
        if (hCost < bestFallbackCost) {
          bestFallbackCost = hCost;
          bestFallbackIdx = head - 1;
        }
      }

      const cellIdx = r * GRID_COLS + c;
      const tile = this.gridMem[cellIdx];
      const onLadder = this.isClimbable(c, r);
      const onRope = tile === TILE_ROPE;
      const supported = onLadder || onRope || this.isTileSupported(c, r);

      if (!supported) {
        const nr = r + 1;
        if (nr < GRID_ROWS && this.isCellPassable(c, nr, isGuard)) {
          const nIdx = nr * GRID_COLS + c;
          if (!this.bfsVisited[nIdx]) {
            this.bfsVisited[nIdx] = 1;
            this.bfsQueueCol[tail] = c;
            this.bfsQueueRow[tail] = nr;
            this.bfsFirstMoveX[tail] = fmx;
            this.bfsFirstMoveY[tail] = fmy !== 0 || fmx !== 0 ? fmy : 1;
            tail++;
          }
        }
        continue;
      }

      for (let d = 0; d < 4; d++) {
        const { dx, dy } = BFS_DIRS[d];
        const nc = c + dx;
        const nr = r + dy;
        if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;

        if (dy === -1 && !onLadder) continue;
        if (dy === 1) {
          const ladderBelow = this.isClimbable(c, nr);
          if (!onLadder && !ladderBelow && !onRope) continue;
        }
        if (dx !== 0) {
          if (!isGuard && this.dynMem[nr * GRID_COLS + nc] === DYN_DUG_HOLE) continue;
        }

        if (!this.isCellPassable(nc, nr, isGuard)) continue;

        const nIdx = nr * GRID_COLS + nc;
        if (!this.bfsVisited[nIdx]) {
          this.bfsVisited[nIdx] = 1;
          this.bfsQueueCol[tail] = nc;
          this.bfsQueueRow[tail] = nr;
          this.bfsFirstMoveX[tail] = fmx === 0 && fmy === 0 ? dx : fmx;
          this.bfsFirstMoveY[tail] = fmx === 0 && fmy === 0 ? dy : fmy;
          tail++;
        }
      }
    }

    if (bestFallbackIdx !== -1) {
      return {
        dx: this.bfsFirstMoveX[bestFallbackIdx],
        dy: this.bfsFirstMoveY[bestFallbackIdx]
      };
    }

    return { dx: Math.sign(targetCol - startCol), dy: 0 };
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const me = this.runners.get(botId);
    if (!me || me.state === 'DEAD' || me.state === 'DIG') {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // In Stage 0 (Tutorial Dojo), if there is a human player in the match, keep the AI bot idle
    // so the human player gets to complete all 5 tutorial steps themselves!
    if (this.currentLevel === 0) {
      const hasHuman = this.getActivePlayers().some((p) => p.type === 'human');
      if (hasHuman) {
        this.input.setBotInput(botId, false, 0, 0, false);
        return;
      }
    }

    const myCol = Math.round(me.x);
    const myRow = Math.round(me.y);

    // 1. Check if an Oni Guard is dangerously close on the same row -> Dig a defensive trap hole!
    for (let i = 0; i < this.guards.length; i++) {
      const g = this.guards[i];
      if (g.state === 'TRAPPED' || g.state === 'CLIMB_OUT') continue;
      const gCol = Math.round(g.x);
      const gRow = Math.round(g.y);
      const distX = gCol - myCol;
      if (gRow === myRow && Math.abs(distX) >= 1 && Math.abs(distX) <= 3) {
        const dirToGuard = Math.sign(distX) as -1 | 1;
        if (this.canDigAt(myCol + dirToGuard, myRow + 1)) {
          this.input.setBotInput(botId, true, dirToGuard, 0, true);
          return;
        }
      }
    }

    // 2. If escape ladder is revealed, head straight to the top of the Escape Ladder!
    let targetCol = myCol;
    let targetRow = 0;

    if (this.escapeRevealed) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.gridMem[c] === TILE_HIDDEN_LADDER || this.gridMem[c] === TILE_LADDER) {
          targetCol = c;
          targetRow = 0;
          break;
        }
      }
    } else if (this.bonusItem.active) {
      targetCol = this.bonusItem.col;
      targetRow = this.bonusItem.row;
    } else {
      // Find closest uncollected gold
      let bestDist = 999999;
      for (let i = 0; i < this.golds.length; i++) {
        const gold = this.golds[i];
        if (!gold.collected && gold.carriedByGuardId === null) {
          const d = Math.abs(gold.col - myCol) + Math.abs(gold.row - myRow) * 2;
          if (d < bestDist) {
            bestDist = d;
            targetCol = gold.col;
            targetRow = gold.row;
          }
        }
      }
    }

    // If gold is directly below us under a diggable brick, dig it!
    if (targetRow > myRow && Math.abs(targetCol - myCol) <= 1) {
      if (this.canDigAt(myCol - 1, myRow + 1)) {
        this.input.setBotInput(botId, true, -1, 0, true);
        return;
      } else if (this.canDigAt(myCol + 1, myRow + 1)) {
        this.input.setBotInput(botId, true, 1, 0, true);
        return;
      } else if (this.canDigAt(myCol, myRow + 1)) {
        this.input.setBotInput(botId, true, 0, 0, true);
        return;
      }
    }

    const step = this.computeShortestPathStep(myCol, myRow, targetCol, targetRow, false);
    this.input.setBotInput(botId, false, step.dx, -step.dy, false);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.runners.values()).sort((a, b) => b.score - a.score);
    const winner = list[0];
    const winnerId = winner ? winner.id : null;
    const totalStages = SUMO_LODE_LEVELS.length;

    return {
      winnerId,
      rankings: list.map((r, idx) => ({
        playerId: r.id,
        score: r.score,
        place: idx + 1
      })),
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} REACHED STAGE ${this.currentLevel}/${totalStages} WITH ${winner.score} PTS (${winner.goldCollected} GOLD)!`
          : `REACHED STAGE ${this.currentLevel}/${totalStages} IN SUMO LODE RUNNER!`
    };
  }

  private getGridLayout(width: number, height: number) {
    const isPhonePortrait = width < 640 && height > width;
    const isPhoneLandscape = width < 930 && height < 480;
    const isTouchDeck = isPhonePortrait || isPhoneLandscape || this.input?.deviceMode === 'phone';

    const topMargin = width < 640 || height < 480 ? 44 : 54;
    const touchDeckH = isPhonePortrait ? Math.min(188, Math.max(158, Math.floor(height * 0.215))) : 0;
    const bottomMargin = 26 + touchDeckH;
    const sideMargin = isPhonePortrait ? 4 : isPhoneLandscape ? 104 : 20;

    const viewW = Math.max(240, width - sideMargin * 2);
    const viewH = Math.max(180, height - topMargin - bottomMargin);
    const viewX = Math.floor((width - viewW) / 2);
    const viewY = topMargin;

    let tileW: number;
    let tileH: number;
    let totalW: number;
    let totalH: number;
    let originX: number;
    let originY: number;

    if (isPhonePortrait && this.mobileZoomCam) {
      const baseTileW = Math.max(12, Math.floor(viewW / GRID_COLS));
      tileW = Math.max(19, Math.min(23, Math.round(baseTileW * 1.58)));
      const bannerPad = this.currentLevel === 0 ? 42 : 14;
      const maxTileH = Math.max(16, Math.floor((viewH - bannerPad) / GRID_ROWS));
      tileH = Math.max(18, Math.min(maxTileH, Math.round(tileW * 1.22)));
      totalW = tileW * GRID_COLS;
      totalH = tileH * GRID_ROWS;

      const targetOriginX = viewX + viewW * 0.5 - (this.camFocusX + 0.5) * tileW;
      originX =
        totalW > viewW
          ? Math.round(Math.max(viewX + viewW - totalW, Math.min(viewX, targetOriginX)))
          : Math.floor((width - totalW) / 2);

      const topOffset = this.currentLevel === 0 ? 38 : 6;
      const targetOriginY = viewY + topOffset + (viewH - topOffset) * 0.5 - (this.camFocusY + 0.5) * tileH;
      originY =
        totalH > viewH - topOffset
          ? Math.round(Math.max(viewY + viewH - totalH, Math.min(viewY + topOffset, targetOriginY)))
          : viewY + topOffset + Math.floor((viewH - topOffset - totalH) / 2);
    } else {
      tileW = Math.max(12, Math.floor(viewW / GRID_COLS));
      const rawTileH = Math.max(12, Math.floor(viewH / GRID_ROWS));
      // Prevent extreme vertical stretching on portrait screens when full-map view is selected
      tileH = isPhonePortrait ? Math.min(rawTileH, Math.round(tileW * 1.45)) : rawTileH;
      totalW = tileW * GRID_COLS;
      totalH = tileH * GRID_ROWS;
      originX = Math.floor((width - totalW) / 2);
      const topOffset = isPhonePortrait && this.currentLevel === 0 ? 20 : 0;
      originY = viewY + topOffset + Math.floor((viewH - topOffset - totalH) / 2);
    }

    return {
      originX,
      originY,
      tileW,
      tileH,
      totalW,
      totalH,
      viewX,
      viewY,
      viewW,
      viewH,
      isPhonePortrait,
      isPhoneLandscape,
      isTouchDeck,
      touchDeckH
    };
  }

  /**
   * Renders all static tiles (Bricks, Indestructible Stone, Bamboo Ladders, Shimenawa Ropes)
   * onto an OffscreenCanvas cache so per-frame rendering costs < 0.2ms with zero lag!
   */
  private rebuildTileCache(totalW: number, totalH: number, tileW: number, tileH: number): void {
    if (!this.tileCacheCanvas) {
      this.tileCacheCanvas = document.createElement('canvas');
      this.tileCacheCtx = this.tileCacheCanvas.getContext('2d');
    }
    if (this.tileCacheCanvas.width !== totalW || this.tileCacheCanvas.height !== totalH) {
      this.tileCacheCanvas.width = totalW;
      this.tileCacheCanvas.height = totalH;
    }
    const ctx = this.tileCacheCtx;
    if (!ctx) return;

    ctx.clearRect(0, 0, totalW, totalH);
    const biome = this.getCurrentBiome();

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = r * GRID_COLS + c;
        const t = this.gridMem[idx];
        const dyn = this.dynMem[idx];
        const x = c * tileW;
        const y = r * tileH;

        if ((t === TILE_BRICK && dyn === DYN_NONE) || t === TILE_TRAPDOOR) {
          const isRevealedTrap = t === TILE_TRAPDOOR && this.trapdoorRevealed[idx] === 1;
          ctx.save();
          if (isRevealedTrap) {
            ctx.globalAlpha = 0.42;
          }

          // 1990s Legend Returns style 3D Dohyō Clay Brick with woven straw tawara trim
          ctx.fillStyle = biome.brickDark;
          ctx.fillRect(x, y, tileW, tileH);

          // Upper & Lower brick courses with staggered mortar joint
          const halfH = Math.floor(tileH / 2);
          ctx.fillStyle = biome.brickMain;
          ctx.fillRect(x + 1, y + 1, tileW - 2, halfH - 2);
          ctx.fillRect(x + 1, y + halfH + 1, Math.floor(tileW / 2) - 2, tileH - halfH - 2);
          ctx.fillRect(x + Math.floor(tileW / 2) + 1, y + halfH + 1, Math.ceil(tileW / 2) - 2, tileH - halfH - 2);

          // Top straw tawara specular highlight
          ctx.fillStyle = biome.brickLight;
          ctx.fillRect(x + 1, y + 1, tileW - 2, 3);
          ctx.fillStyle = biome.tawaraAccent;
          for (let sx = x + 3; sx < x + tileW - 3; sx += 6) {
            ctx.fillRect(sx, y + 1, 2, 2);
          }
          ctx.restore();

          // Subtle hairline crack on false bricks (TILE_TRAPDOOR), plus clear chevron when revealed
          if (t === TILE_TRAPDOOR) {
            ctx.save();
            if (isRevealedTrap) {
              ctx.strokeStyle = 'rgba(253, 224, 71, 0.78)';
              ctx.lineWidth = 1.2;
              ctx.setLineDash([2, 2]);
              ctx.strokeRect(x + 2, y + 2, tileW - 4, tileH - 4);
              ctx.setLineDash([]);
              ctx.fillStyle = '#FDE047';
              ctx.font = '900 9px Montserrat, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('▾', x + tileW / 2, y + tileH * 0.68);
            } else {
              // Subtle 1994 Legend Returns hairline mortar crack so observant players can spot false bricks
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(x + tileW * 0.35, y + 3);
              ctx.lineTo(x + tileW * 0.52, y + tileH * 0.55);
              ctx.lineTo(x + tileW * 0.42, y + tileH - 2);
              ctx.stroke();
            }
            ctx.restore();
          }
        } else if (t === TILE_SOLID) {
          // Indestructible Imperial Castle Bedrock Block with metallic rivets
          ctx.fillStyle = biome.solidDark;
          ctx.fillRect(x, y, tileW, tileH);

          ctx.fillStyle = biome.solidMain;
          ctx.fillRect(x + 1.5, y + 1.5, tileW - 3, tileH - 3);

          // Bevel highlight
          ctx.fillStyle = biome.solidLight;
          ctx.fillRect(x + 2, y + 2, tileW - 4, 2.5);
          ctx.fillRect(x + 2, y + 2, 2.5, tileH - 4);

          // 4 Corner Iron Rivets
          ctx.fillStyle = '#E2E8F0';
          ctx.fillRect(x + 4, y + 4, 2, 2);
          ctx.fillRect(x + tileW - 6, y + 4, 2, 2);
          ctx.fillRect(x + 4, y + tileH - 6, 2, 2);
          ctx.fillRect(x + tileW - 6, y + tileH - 6, 2, 2);
        } else if (t === TILE_LADDER || (t === TILE_HIDDEN_LADDER && this.escapeRevealed)) {
          const isEscape = t === TILE_HIDDEN_LADDER;
          const railCol = isEscape ? '#FACC15' : biome.ladderRail;
          const rungCol = isEscape ? '#FEF08A' : biome.ladderRung;

          // Bamboo side rails
          const leftRailX = x + Math.floor(tileW * 0.22);
          const rightRailX = x + Math.floor(tileW * 0.78) - 3;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fillRect(leftRailX + 1, y, 3, tileH);
          ctx.fillRect(rightRailX + 1, y, 3, tileH);

          ctx.fillStyle = railCol;
          ctx.fillRect(leftRailX, y, 3, tileH);
          ctx.fillRect(rightRailX, y, 3, tileH);

          // 3 Bamboo rungs per tile
          ctx.fillStyle = rungCol;
          for (let ry = 4; ry < tileH; ry += Math.floor(tileH / 3)) {
            ctx.fillRect(leftRailX - 1, y + ry, rightRailX - leftRailX + 5, 2.5);
          }
        } else if (t === TILE_ROPE) {
          // Sacred Shimenawa Twisted Hemp Rope with white Shide lightning paper streamers
          const ropeY = y + Math.floor(tileH * 0.22);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(x, ropeY + 2, tileW, 3);

          ctx.fillStyle = biome.ropeColor;
          ctx.fillRect(x, ropeY, tileW, 3);

          // White Shide zig-zag paper streamer in center of tile
          if ((c + r) % 2 === 0) {
            ctx.fillStyle = '#FFFFFF';
            const mx = x + Math.floor(tileW / 2);
            ctx.beginPath();
            ctx.moveTo(mx - 2, ropeY + 3);
            ctx.lineTo(mx + 2, ropeY + 3);
            ctx.lineTo(mx, ropeY + 7);
            ctx.lineTo(mx + 3, ropeY + 7);
            ctx.lineTo(mx - 1, ropeY + 12);
            ctx.lineTo(mx - 3, ropeY + 7);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    this.cachedTileW = tileW;
    this.cachedTileH = tileH;
    this.tileCacheDirty = false;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    ctx.save();
    const now = performance.now() * 0.001;
    const biome = this.getCurrentBiome();
    const bp = this.getLevelBlueprint();
    const layout = this.getGridLayout(width, height);
    const { originX, originY, tileW, tileH, totalW, totalH } = layout;

    // 1. Atmospheric Biome Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, biome.bgTop);
    bgGrad.addColorStop(1, biome.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Traditional Dojo Timber Pillars & Glowing Chōchin Lanterns in background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let px = originX + tileW * 3; px < originX + totalW; px += tileW * 7) {
      ctx.fillRect(px, originY, 8, totalH);
      const lanternY = originY + 28 + Math.sin(now * 2 + px) * 2;
      const glow = ctx.createRadialGradient(px + 4, lanternY, 2, px + 4, lanternY, 36);
      glow.addColorStop(0, biome.lanternGlow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px + 4, lanternY, 36, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.ellipse(px + 4, lanternY, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(px + 1, lanternY - 9, 6, 2);
      ctx.fillRect(px + 1, lanternY + 7, 6, 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    }

    // 2. Blit Cached Static Tilemap Layer (Zero-Lag OffscreenCanvas)
    if (this.tileCacheDirty || this.cachedTileW !== tileW || this.cachedTileH !== tileH) {
      this.rebuildTileCache(totalW, totalH, tileW, tileH);
    }
    if (this.tileCacheCanvas) {
      ctx.drawImage(this.tileCacheCanvas, originX, originY);
    }

    // Golden Escape Reveal Screen Flash
    if (this.escapeFlashTimer > 0) {
      ctx.fillStyle = `rgba(253, 224, 71, ${Math.min(0.32, this.escapeFlashTimer * 0.25)})`;
      ctx.fillRect(originX, originY, totalW, totalH);
    }

    // 2b. Render Live Dig Target Reticles for Players
    this.renderDigTargetReticles(ctx, originX, originY, tileW, tileH, now);

    // 3. Render Dug Brick Pits & Regeneration Warning Animations
    for (let i = 0; i < this.dugBricks.length; i++) {
      const b = this.dugBricks[i];
      const bx = originX + b.col * tileW;
      const by = originY + b.row * tileH;
      const rem = b.maxDuration - b.timer;

      ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 2, by + 2, tileW - 4, tileH - 4);

      if (rem < 1.6) {
        const progress = 1 - Math.max(0, rem / 1.6);
        const fillH = Math.floor(tileH * progress);
        const shakeX = Math.sin(now * 45) * 1.5;
        ctx.fillStyle = biome.brickMain;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(bx + 1 + shakeX, by + tileH - fillH, tileW - 2, fillH);
        ctx.globalAlpha = 1.0;
      }
    }

    // 4. Render Golden Chanko Pots & Imperial Koban Treasures
    for (let i = 0; i < this.golds.length; i++) {
      const g = this.golds[i];
      if (g.collected || g.carriedByGuardId !== null) continue;
      const gx = originX + (g.col + 0.5) * tileW;
      const gy = originY + (g.row + 0.55) * tileH + Math.sin(now * 4 + g.id) * 1.5;
      this.drawGoldenTreasure(ctx, gx, gy, Math.min(tileW, tileH) * 0.42, now + g.id);
    }

    // 4b. Render Bonus Yokozuna Onigiri Item (1994 Legend Returns tribute)
    if (this.bonusItem.active) {
      const bx = originX + (this.bonusItem.col + 0.5) * tileW;
      const by = originY + (this.bonusItem.row + 0.5) * tileH + Math.sin(now * 6) * 2;
      this.drawBonusOnigiri(ctx, bx, by, Math.min(tileW, tileH) * 0.45);
    }

    // 5. Escape Beacon at Top of Revealed Escape Ladder
    if (this.escapeRevealed) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.gridMem[c] === TILE_HIDDEN_LADDER) {
          const ex = originX + (c + 0.5) * tileW;
          const ey = originY + 12;
          const pulse = 0.65 + 0.35 * Math.sin(now * 8);
          ctx.save();
          ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`;
          ctx.font = '900 10px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('▲ EXIT ▲', ex, ey);
          ctx.restore();
          break;
        }
      }
    }

    // 6. Render Rival Oni-Sumo Guards (Mad Monks) & Top Respawn Lightning Telegraphs
    for (let i = 0; i < this.guards.length; i++) {
      const g = this.guards[i];
      if (g.respawnFlashTimer > 0) {
        const sx = originX + (g.spawnCol + 0.5) * tileW;
        ctx.save();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx - 4, originY);
        ctx.lineTo(sx + 3, originY + tileH * 0.6);
        ctx.lineTo(sx - 2, originY + tileH * 0.9);
        ctx.lineTo(sx + 4, originY + tileH * 1.5);
        ctx.stroke();
        ctx.restore();
      }
      const shakeX = g.state === 'TRAPPED' && g.trapTimer > bp.trapDuration - 0.9 ? Math.sin(now * 50) * 2.5 : 0;
      const gx = originX + (g.x + 0.5) * tileW + shakeX;
      const gy = originY + (g.y + 0.52) * tileH;
      this.drawOniSumoGuard(ctx, g, gx, gy, Math.min(tileW, tileH) * 0.48, now);
    }

    // 7. Render Sumo Rikishi Players & Digging Ki Beams
    for (const r of this.runners.values()) {
      if (r.state === 'DEAD') continue;
      const rx = originX + (r.x + 0.5) * tileW;
      const ry = originY + (r.y + 0.5) * tileH;

      if (r.state === 'DIG') {
        const tx = originX + (r.digTargetCol + 0.5) * tileW;
        const ty = originY + (r.digTargetRow + 0.5) * tileH;
        ctx.save();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(rx + r.facing * 6, ry + 2);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx + r.facing * 6, ry + 2);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
      }

      this.drawSumoRunner(ctx, r, rx, ry, Math.min(tileW, tileH) * 0.5, now);
    }

    // 7b. Interactive Tutorial Overlay & Step-by-Step World Callouts (Stage 0) or Stage Hint Banner
    if (this.currentLevel === 0) {
      this.renderTutorialOverlay(ctx, width, originX, originY, tileW, tileH, now);
    } else if (bp.hint && this.stageHintTimer > 0) {
      this.renderStageHintBanner(ctx, width, originY, bp.hint, Math.min(1, this.stageHintTimer));
    }

    // 8. Render Top & Bottom Classic-Modern Sumo Lode Runner HUD Bar
    this.renderLodeRunnerHUD(ctx, width, height, bp, biome);

    // 9. Stage Clear Banner Overlay
    if (this.levelClearBannerTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(width / 2 - 220, height / 2 - 48, 440, 96);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(width / 2 - 220, height / 2 - 48, 440, 96);

      ctx.fillStyle = '#FDE047';
      ctx.font = '900 21px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const clearTitle =
        this.currentLevel === 0
          ? '🎓 TRAINING DOJO COMPLETE! 🎓'
          : `🎌 STAGE ${this.currentLevel} COMPLETE! 🎌`;
      ctx.fillText(clearTitle, width / 2, height / 2 - 10);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 13px Montserrat, sans-serif';
      const nextBp = this.getLevelBlueprint(this.currentLevel + 1);
      const nextMsg =
        this.currentLevel < SUMO_LODE_LEVELS.length
          ? `Advancing to Stage ${this.currentLevel + 1}: ${nextBp.title}...`
          : `ALL ${SUMO_LODE_LEVELS.length} YOKOZUNA STAGES CONQUERED!`;
      ctx.fillText(nextMsg, width / 2, height / 2 + 22);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Draws a subtle live Dig Target Reticle on the brick a human player will excavate when pressing Action.
   */
  private renderDigTargetReticles(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    tileW: number,
    tileH: number,
    now: number
  ): void {
    for (const r of this.runners.values()) {
      if (r.state === 'DEAD' || r.state === 'FALL' || r.state === 'ROPE') continue;
      const pConfig = this.players[r.id];
      if (pConfig && pConfig.type !== 'human') continue;

      const dir = this.getPreferredDigDir(r);
      if (dir === null) continue;

      const digCol = Math.round(r.x) + dir;
      const digRow = Math.round(r.y) + 1;
      const bx = originX + digCol * tileW;
      const by = originY + digRow * tileH;
      const pulse = 0.55 + 0.35 * Math.sin(now * 8);

      ctx.save();
      ctx.strokeStyle = `rgba(253, 224, 71, ${pulse})`;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(bx + 1.5, by + 1.5, tileW - 3, tileH - 3);
      ctx.setLineDash([]);

      if (this.currentLevel <= 2) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        ctx.fillRect(bx - 2, by + tileH - 11, tileW + 4, 11);
        ctx.fillStyle = '#FDE047';
        ctx.font = '800 7.5px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DIG [SPACE]', bx + tileW / 2, by + tileH - 3);
      }
      ctx.restore();
    }
  }

  /**
   * Renders the 5-step interactive coaching overlay & world callouts in Stage 0 (Yokozuna Training Dojo).
   */
  private renderTutorialOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    originX: number,
    originY: number,
    tileW: number,
    tileH: number,
    now: number
  ): void {
    // Identify tutorial golds by coordinates:
    // Step 1: (6, 10) | Step 2: (11, 12) | Step 3: (20, 9) | Step 4: (18, 2)
    const gStep1 = this.golds.find((g) => g.col === 6 && g.row === 10);
    const gStep2 = this.golds.find((g) => g.col === 11 && g.row === 12);
    const gStep3 = this.golds.find((g) => g.col === 20 && g.row === 9);
    const gStep4 = this.golds.find((g) => g.col === 18 && g.row === 2);

    const p1 = this.runners.get(0) || Array.from(this.runners.values())[0];
    const pCol = p1 ? Math.round(p1.x) : 3;
    const pRow = p1 ? Math.round(p1.y) : 14;

    let stepNum = 5;
    let bannerTitle = 'STEP 5/5: CLIMB THE GOLDEN ESCAPE LADDER TO GRADUATE!';
    let bannerSub = 'Climb the revealed Golden Ladder (S) at the top-center all the way to ▲ EXIT ▲!';
    let targetCol = 13;
    let targetRow = 1;
    let targetLabel = '▲ CLIMB EXIT!';
    let highlightColor = '#4ADE80';

    ctx.save();

    if (gStep1 && !gStep1.collected) {
      stepNum = 1;
      bannerTitle = 'STEP 1/5: MOVE & CLIMB BAMBOO LADDERS';
      bannerSub = 'Use [WASD / Arrows] to climb the Bamboo Ladder (H) and collect the 1st Gold Pot!';
      targetCol = 6;
      targetRow = 10;
      targetLabel = '1. GRAB GOLD!';
    } else if (gStep2 && !gStep2.collected) {
      stepNum = 2;
      bannerTitle = 'STEP 2/5: EXCAVATE DOHYŌ CLAY BRICKS';
      bannerSub = 'Stand at (10,10) left of the buried Gold & press [SPACE / E / ENTER] to dig the brick (#)!';
      targetCol = 11;
      targetRow = 11;
      targetLabel = pCol === 10 && pRow === 10 ? '⚡ PRESS [SPACE / E] TO DIG!' : '2. DIG BRICK [SPACE]';
      if (pCol === 10 && pRow === 10) highlightColor = '#FDE047';

      // Draw subtle standing-spot guide at (10, 10) so player sees diagonal dig geometry
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(originX + 10 * tileW + 1, originY + 10 * tileH + 1, tileW - 2, tileH - 2);
      ctx.setLineDash([]);
    } else if (gStep3 && !gStep3.collected) {
      stepNum = 3;
      bannerTitle = 'STEP 3/5: SHIMMY ACROSS SACRED ROPES (MANDATORY)';
      bannerSub = 'Climb the center ladder to the Sacred Rope (-), shimmy RIGHT to col 20 & press DOWN [S / ▼]!';
      targetCol = 20;
      targetRow = 7;
      const onRopeAtDrop = pRow === 7 && pCol === 20;
      targetLabel = onRopeAtDrop ? '⚡ PRESS DOWN [S / ▼] NOW!' : '3. DROP OFF ROPE [S/▼]!';
      if (onRopeAtDrop) highlightColor = '#FDE047';

      // Draw pulsing vertical drop-arrow column from rope (20, 7) down to Gold #3 at (20, 9)
      const dropX = originX + 20.5 * tileW;
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(dropX, originY + 7.5 * tileH);
      ctx.lineTo(dropX, originY + 9.2 * tileH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FDE047';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', dropX, originY + 8.6 * tileH + Math.sin(now * 8) * 2);
    } else if (gStep4 && !gStep4.collected) {
      stepNum = 4;
      const guard = this.guards[0];
      const isGuardTrapped = guard && guard.state === 'TRAPPED';
      bannerTitle = 'STEP 4/5: TRAP THE ONI GUARD & WALK OVER ITS HEAD';
      bannerSub = isGuardTrapped
        ? 'Oni is trapped! Walk safely across its head to the left ladder (col 14) & climb to the Gold!'
        : 'Press [SPACE / Q / E] to dig a trap hole for the Oni Guard, walk over its head & climb to the Gold!';
      targetCol = 18;
      targetRow = 2;
      targetLabel = isGuardTrapped ? '✓ ONI TRAPPED! WALK OVER & CLIMB!' : '4. TRAP GUARD & GRAB!';
      if (isGuardTrapped) highlightColor = '#FDE047';
    }

    // Draw floating world callout badge + bouncing pointer at target tile
    const tx = originX + (targetCol + 0.5) * tileW;
    const ty = originY + targetRow * tileH - 8 + Math.sin(now * 6) * 3;

    // Pulsing highlight ring around target tile
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(originX + targetCol * tileW - 2, originY + targetRow * tileH - 2, tileW + 4, tileH + 4);

    // Callout pill
    ctx.font = '900 9.5px Montserrat, sans-serif';
    const pillW = Math.max(96, ctx.measureText(targetLabel).width + 16);
    const pillX = Math.max(originX + 4, Math.min(originX + GRID_COLS * tileW - pillW - 4, tx - pillW / 2));
    const pillY = Math.max(originY + 28, ty - 22);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(pillX, pillY, pillW, 18);
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pillX, pillY, pillW, 18);

    ctx.fillStyle = highlightColor;
    ctx.textAlign = 'center';
    ctx.fillText(targetLabel, pillX + pillW / 2, pillY + 12.5);

    // Top-of-arena coaching banner
    const bannerW = Math.min(width - 32, 680);
    const bannerX = (width - bannerW) / 2;
    const bannerY = originY + 2;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fillRect(bannerX, bannerY, bannerW, 36);
    ctx.strokeStyle = stepNum === 5 ? '#FACC15' : '#38BDF8';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(bannerX, bannerY, bannerW, 36);

    ctx.fillStyle = stepNum === 5 ? '#FDE047' : '#38BDF8';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎓 ${bannerTitle}`, width / 2, bannerY + 14);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 10px Montserrat, sans-serif';
    ctx.fillText(bannerSub, width / 2, bannerY + 29);
    ctx.restore();
  }

  private renderStageHintBanner(
    ctx: CanvasRenderingContext2D,
    width: number,
    originY: number,
    hint: string,
    alpha: number
  ): void {
    ctx.save();
    ctx.globalAlpha = Math.min(0.95, alpha);
    const bannerW = Math.min(width - 40, 640);
    const bannerX = (width - bannerW) / 2;
    const bannerY = originY + 2;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.fillRect(bannerX, bannerY, bannerW, 22);
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(bannerX, bannerY, bannerW, 22);

    ctx.fillStyle = '#FEF08A';
    ctx.font = '800 10px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`💡 ${hint}`, width / 2, bannerY + 14.5);
    ctx.restore();
  }

  private drawBonusOnigiri(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.save();
    ctx.translate(x, y);
    // Triangular rice ball with nori seaweed wrap
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.95, r * 0.85);
    ctx.lineTo(-r * 0.95, r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Nori strip at bottom
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-r * 0.42, r * 0.15, r * 0.84, r * 0.7);
    ctx.restore();
  }

  private drawGoldenTreasure(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
    ctx.save();
    const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 1, x, y, r * 1.2);
    grad.addColorStop(0, '#FEF08A');
    grad.addColorStop(0.55, '#FACC15');
    grad.addColorStop(1, '#B45309');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y + 1, r * 0.92, 0, Math.PI, false);
    ctx.lineTo(x - r * 0.92, y - r * 0.35);
    ctx.quadraticCurveTo(x, y - r * 0.7, x + r * 0.92, y - r * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#FEF9C3';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (Math.sin(t * 5) > 0.2) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - r * 0.35, y - r * 0.25, 2.5, 2.5);
    }
    ctx.restore();
  }

  private drawOniSumoGuard(ctx: CanvasRenderingContext2D, g: OniGuard, x: number, y: number, r: number, now: number): void {
    ctx.save();
    ctx.translate(x, y);

    const legSwing = g.state === 'TRAPPED' ? 0 : Math.sin(g.animPhase) * 3;

    // Legs
    ctx.fillStyle = '#7F1D1D';
    ctx.fillRect(-r * 0.55, r * 0.35 + legSwing * 0.4, r * 0.42, r * 0.55);
    ctx.fillRect(r * 0.15, r * 0.35 - legSwing * 0.4, r * 0.42, r * 0.55);

    // Muscular Oni Sumo Torso
    const bodyGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, r * 1.05);
    bodyGrad.addColorStop(0, '#EF4444');
    bodyGrad.addColorStop(1, '#7F1D1D');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Dark Indigo Mawashi Belt
    ctx.fillStyle = g.carryingGoldId !== null ? '#FACC15' : '#1E1B4B';
    ctx.fillRect(-r * 0.82, r * 0.08, r * 1.64, r * 0.38);

    // Golden sack on back if carrying gold
    if (g.carryingGoldId !== null) {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(-g.facing * r * 0.65, -r * 0.25, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Oni Horns & Topknot
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.65);
    ctx.lineTo(-r * 0.75, -r * 1.15);
    ctx.lineTo(-r * 0.25, -r * 0.75);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.65);
    ctx.lineTo(r * 0.75, -r * 1.15);
    ctx.lineTo(r * 0.25, -r * 0.75);
    ctx.fill();

    // Glowing fierce yellow eyes
    const eyeOff = g.facing * r * 0.18;
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(eyeOff - r * 0.35, -r * 0.25, r * 0.25, r * 0.2);
    ctx.fillRect(eyeOff + r * 0.1, -r * 0.25, r * 0.25, r * 0.2);

    // If trapped in dug hole, draw dizzy stars
    if (g.state === 'TRAPPED') {
      const starAngle = now * 6;
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(Math.cos(starAngle) * r * 0.7, -r * 1.1, 2.2, 0, Math.PI * 2);
      ctx.arc(Math.cos(starAngle + Math.PI) * r * 0.7, -r * 1.1, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawSumoRunner(ctx: CanvasRenderingContext2D, r: SumoRunnerPlayer, x: number, y: number, rad: number, now: number): void {
    const pConfig = this.players[r.id];
    const mawashiColor = pConfig ? pConfig.color : '#EF4444';

    ctx.save();
    if (r.invulnTimer > 0 && Math.floor(now * 14) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    ctx.translate(x, y);

    const stride = r.state === 'RUN' || r.state === 'CLIMB' || r.state === 'ROPE' ? Math.sin(r.animPhase) * 3.2 : 0;

    // Sumo Legs
    ctx.fillStyle = '#FDBA74';
    if (r.state === 'DIG') {
      ctx.fillRect(-rad * 0.75, rad * 0.2, rad * 0.45, rad * 0.65);
      ctx.fillRect(rad * 0.35, -rad * 0.1, rad * 0.5, rad * 0.5);
    } else {
      ctx.fillRect(-rad * 0.55, rad * 0.32 + stride * 0.4, rad * 0.42, rad * 0.55);
      ctx.fillRect(rad * 0.15, rad * 0.32 - stride * 0.4, rad * 0.42, rad * 0.55);
    }

    // Round Sumo Belly & Torso
    const skinGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, rad * 1.05);
    skinGrad.addColorStop(0, '#FFEDD5');
    skinGrad.addColorStop(1, '#FB923C');
    ctx.fillStyle = skinGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Player-Colored Ceremonial Mawashi Belt
    ctx.fillStyle = mawashiColor;
    ctx.fillRect(-rad * 0.86, rad * 0.08, rad * 1.72, rad * 0.42);
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1.3;
    ctx.strokeRect(-rad * 0.86, rad * 0.08, rad * 1.72, rad * 0.42);

    // Traditional Black Chonmage Sumo Topknot
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(0, -rad * 0.55, rad * 0.48, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-rad * 0.18, -rad * 1.12, rad * 0.36, rad * 0.45);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-rad * 0.16, -rad * 0.85, rad * 0.32, 2);

    // Expressive Eyes
    const faceOff = r.facing * rad * 0.2;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(faceOff - rad * 0.28, -rad * 0.25, 2.5, 3);
    ctx.fillRect(faceOff + rad * 0.12, -rad * 0.25, 2.5, 3);

    // Rosy Sumo Cheeks
    ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.beginPath();
    ctx.arc(faceOff - rad * 0.38, -rad * 0.06, 2.2, 0, Math.PI * 2);
    ctx.arc(faceOff + rad * 0.32, -rad * 0.06, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Small P1/P2 indicator tag above topknot
    ctx.fillStyle = mawashiColor;
    ctx.font = '900 8.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`P${r.id + 1}`, 0, -rad * 1.28);

    ctx.restore();
  }

  private renderLodeRunnerHUD(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    bp: LevelBlueprint,
    biome: BiomePalette
  ): void {
    this.hudHitboxes.length = 0;

    const barY = height - 26;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(0, barY, width, 26);
    ctx.strokeStyle = biome.brickLight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, barY);
    ctx.lineTo(width, barY);
    ctx.stroke();

    const remainingGold = this.getRemainingGoldCount();
    const totalGold = this.golds.length;
    const totalStages = SUMO_LODE_LEVELS.length;

    const btnY = barY + 3;
    const btnH = 20;

    // Left Status: Gold Remaining & Lives
    ctx.textAlign = 'left';
    ctx.fillStyle = remainingGold === 0 ? '#4ADE80' : '#FACC15';
    ctx.font = '900 9.5px Montserrat, sans-serif';
    const livesLabel = this.currentLevel === 0 ? '∞' : String(this.teamLives);
    const goldText =
      remainingGold === 0
        ? '✨ ESCAPE LADDER OPEN!'
        : `🪙 ${totalGold - remainingGold}/${totalGold}  ❤️ ${livesLabel}`;
    ctx.fillText(goldText, 10, btnY + 13.5);

    // Stage Title & Biome Label positioned cleanly between Gold status and center dock
    ctx.fillStyle = '#FDE047';
    ctx.font = '900 9.5px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    const stageHeader =
      this.currentLevel === 0
        ? `STAGE 0 (DOJO): ${bp.title.toUpperCase()}`
        : `STAGE ${this.currentLevel}/${totalStages}: ${bp.title.toUpperCase()}`;
    ctx.fillText(stageHeader, width / 2 - 102, btnY + 13.5);

    // Right of center dock: Interactive Stage Controls (🎓 DOJO | ◀ | ▶ | ↻ RETRY | 👤 SOLO/CPU [B] | 🎵 BGM [M])
    const tutBtnX = width / 2 + 100;
    const prevBtnX = tutBtnX + 54;
    const nextBtnX = prevBtnX + 24;
    const retryBtnX = nextBtnX + 24;
    const soloBtnX = retryBtnX + 52;
    const bgmBtnX = soloBtnX + 66;

    // Tutorial Quick-Jump Button [T]
    ctx.fillStyle = this.currentLevel === 0 ? '#0284C7' : '#1E293B';
    ctx.fillRect(tutBtnX, btnY, 50, btnH);
    ctx.fillStyle = '#E0F2FE';
    ctx.font = '800 8.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎓 DOJO', tutBtnX + 25, btnY + 13.5);
    this.hudHitboxes.push({
      id: 'lvl_tut',
      x: tutBtnX,
      y: btnY,
      w: 50,
      h: btnH,
      action: () => {
        this.audio.playMenuTick();
        this.loadLevel(0);
      }
    });

    // Prev Level Button
    ctx.fillStyle = this.currentLevel > 0 ? '#334155' : '#1E293B';
    ctx.fillRect(prevBtnX, btnY, 21, btnH);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 9.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◀', prevBtnX + 10.5, btnY + 13.5);
    this.hudHitboxes.push({
      id: 'lvl_prev',
      x: prevBtnX,
      y: btnY,
      w: 21,
      h: btnH,
      action: () => {
        if (this.currentLevel > 0) {
          this.audio.playMenuTick();
          this.loadLevel(this.currentLevel - 1);
        }
      }
    });

    // Next Level Button
    ctx.fillStyle = this.currentLevel < totalStages ? '#334155' : '#1E293B';
    ctx.fillRect(nextBtnX, btnY, 21, btnH);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText('▶', nextBtnX + 10.5, btnY + 13.5);
    this.hudHitboxes.push({
      id: 'lvl_next',
      x: nextBtnX,
      y: btnY,
      w: 21,
      h: btnH,
      action: () => {
        if (this.currentLevel < totalStages) {
          this.audio.playMenuTick();
          this.loadLevel(this.currentLevel + 1);
        }
      }
    });

    // Instant Retry Button [R]
    ctx.fillStyle = '#7F1D1D';
    ctx.fillRect(retryBtnX, btnY, 48, btnH);
    ctx.fillStyle = '#FCA5A5';
    ctx.font = '800 8.5px Montserrat, sans-serif';
    ctx.fillText('↻ RETRY', retryBtnX + 24, btnY + 13.5);
    this.hudHitboxes.push({
      id: 'lvl_retry',
      x: retryBtnX,
      y: btnY,
      w: 48,
      h: btnH,
      action: () => {
        this.audio.playTap();
        this.loadLevel(this.currentLevel);
      }
    });

    // 1P Solo / +CPU Partner Toggle Button [B]
    ctx.fillStyle = this.soloMode ? '#15803D' : '#4338CA';
    ctx.fillRect(soloBtnX, btnY, 62, btnH);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 8px Montserrat, sans-serif';
    ctx.fillText(this.soloMode ? '👤 1P SOLO' : '🤖 +CPU [B]', soloBtnX + 31, btnY + 13.5);
    this.hudHitboxes.push({
      id: 'toggle_solo',
      x: soloBtnX,
      y: btnY,
      w: 62,
      h: btnH,
      action: () => {
        this.toggleSoloMode();
      }
    });

    // Dynamic Soundtrack Toggle Button [M]
    ctx.fillStyle = this.musicEnabled ? '#0F766E' : '#334155';
    ctx.fillRect(bgmBtnX, btnY, 52, btnH);
    ctx.fillStyle = this.musicEnabled ? '#5EEAD4' : '#94A3B8';
    ctx.font = '800 8px Montserrat, sans-serif';
    ctx.fillText(this.musicEnabled ? '🎵 BGM' : '🔇 BGM', bgmBtnX + 26, btnY + 13.5);
    this.hudHitboxes.push({
      id: 'toggle_bgm',
      x: bgmBtnX,
      y: btnY,
      w: 52,
      h: btnH,
      action: () => {
        this.musicEnabled = !this.musicEnabled;
        this.audio.playMenuTick();
      }
    });

    // Right Status: Player Scores & Wasm Engine Badge
    ctx.textAlign = 'right';
    const p1Score = this.runners.get(0)?.score ?? 0;
    const p2Runner = this.runners.get(1);
    const wasmTag = this.wasmActive ? '⚡WASM' : '⚡JIT';
    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 9px Montserrat, sans-serif';
    const scoreText = p2Runner ? `P1:${p1Score} P2:${p2Runner.score} [${wasmTag}]` : `P1:${p1Score} [${wasmTag}]`;
    ctx.fillText(scoreText, width - 8, btnY + 13.5);
  }
}
