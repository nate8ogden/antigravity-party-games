import { BaseGame } from './BaseGame';
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
 * Pre-compiled 266-byte Inline WebAssembly (Wasm) Physics & Grid Kernel.
 * Instantiated synchronously via new WebAssembly.Module / WebAssembly.Instance
 * with zero external network fetches so it works 100% inside the single-file bundle.
 *
 * Exports:
 * - mem: WebAssembly.Memory (1 page = 64KB, shared with JS Uint8Array views)
 * - isSupported(col: i32, row: i32, escapeRevealed: i32) -> i32 (1 if supported, 0 if falling)
 * - manhattanCost(c1: i32, r1: i32, c2: i32, r2: i32) -> i32 (|c1-c2| + |r1-r2|*2)
 */
const WASM_LODE_KERNEL_BYTES = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 16, 2, 96, 3, 127, 127, 127, 1, 127, 96, 4, 127, 127, 127, 127, 1, 127,
  3, 3, 2, 0, 1, 5, 3, 1, 0, 1, 7, 37, 3, 3, 109, 101, 109, 2, 0, 11, 105, 115, 83, 117, 112, 112, 111,
  114, 116, 101, 100, 0, 0, 13, 109, 97, 110, 104, 97, 116, 116, 97, 110, 67, 111, 115, 116, 0, 1, 10,
  188, 1, 2, 132, 1, 1, 5, 127, 32, 1, 65, 15, 78, 4, 64, 65, 1, 15, 11, 32, 1, 65, 28, 108, 32, 0, 106,
  34, 3, 45, 0, 0, 34, 4, 65, 3, 70, 32, 4, 65, 4, 70, 114, 4, 64, 65, 1, 15, 11, 32, 4, 65, 6, 70, 32,
  2, 69, 69, 113, 4, 64, 65, 1, 15, 11, 32, 3, 65, 28, 106, 34, 5, 45, 0, 128, 4, 34, 7, 65, 2, 70, 4,
  64, 65, 1, 15, 11, 32, 7, 65, 1, 70, 4, 64, 65, 0, 15, 11, 32, 5, 45, 0, 0, 34, 6, 65, 1, 70, 32, 6,
  65, 2, 70, 114, 32, 6, 65, 3, 70, 114, 4, 64, 65, 1, 15, 11, 32, 6, 65, 6, 70, 32, 2, 69, 69, 113, 11,
  52, 1, 2, 127, 32, 0, 32, 2, 107, 34, 4, 65, 0, 72, 4, 64, 65, 0, 32, 4, 107, 33, 4, 11, 32, 1, 32, 3,
  107, 34, 5, 65, 0, 72, 4, 64, 65, 0, 32, 5, 107, 33, 5, 11, 32, 4, 32, 5, 65, 2, 108, 106, 11
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
  guardCount: number;
  guardSpeed: number;     // tiles per second
  holeDuration: number;   // seconds brick remains open
  trapDuration: number;   // seconds guard stays trapped in hole
  rows: string[];         // 16 rows of 28 chars
}

/**
 * 30 Hand-Crafted Sumo Lode Runner Levels (28 cols x 16 rows each).
 * Legend:
 *  '.' = Empty
 *  '#' = Diggable Dohyō Clay Brick
 *  '@' = Indestructible Imperial Stone
 *  'H' = Bamboo Ladder
 *  '-' = Sacred Shimenawa Rope (hand-over-hand)
 *  'X' = Trapdoor (False Brick: looks like '#', entities fall straight through!)
 *  'S' = Hidden Escape Ladder (appears once all '$' Gold is collected)
 *  '$' = Golden Chanko / Koban Treasure
 *  'P' = Player 1/3 Spawn
 *  'Q' = Player 2/4 Spawn
 *  'E' = Rival Oni-Sumo Guard Spawn
 */
export const SUMO_LODE_LEVELS: LevelBlueprint[] = [
  // =========================================================================
  // CHAPTER 1: EDO KOKUGIKAN DOJO (Levels 1 - 6)
  // =========================================================================
  {
    level: 1,
    title: 'Dohyō Initiate',
    guardCount: 2,
    guardSpeed: 3.1,
    holeDuration: 7.0,
    trapDuration: 3.8,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S...E.......$..',
      '#######H###########H########',
      '.......H...........H........',
      '.......H...$...$...H........',
      '.......H..#######..H........',
      '.......H..H.....H..H........',
      '..E....H..H.....H..H....$...',
      '###########.....############',
      '....H.................H.....',
      '....H...$.........$...H.....',
      '....#########H#########.....',
      '.............H..............',
      '..$....P.....H.....Q.....$..',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 2,
    title: 'Twin Torii Towers',
    guardCount: 2,
    guardSpeed: 3.2,
    holeDuration: 7.0,
    trapDuration: 3.7,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E.....$..',
      '#####H#######S#######H######',
      '.....H-------.-------H......',
      '.....H...............H......',
      '.....H...$.......$...H......',
      '.....H..###########..H......',
      '..$..H..H.........H..H..$...',
      '######..H...$ $...H..#######',
      '....H...H..#####..H...H.....',
      '....H...H..H...H..H...H.....',
      '....#####..H...H..#####.....',
      '....H......H...H......H.....',
      '....H..P...H...H...Q..H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 3,
    title: 'Sacred Rope Crossing',
    guardCount: 2,
    guardSpeed: 3.25,
    holeDuration: 6.9,
    trapDuration: 3.7,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '####H-----------------H#####',
      '....H.................H.....',
      '....H..$.....E.....$..H.....',
      '....H.#####.....#####.H.....',
      '....H.H.............H.H.....',
      '....H.H..$.......$..H.H.....',
      '....H.H.####H.H####.H.H.....',
      '....H.H.....H.H.....H.H.....',
      '..$.H.H..E..H.H.....H.H.$...',
      '#####.#######.#######.######',
      '....H.................H.....',
      '....H....P.......Q....H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 4,
    title: 'The Stepping Stone Pit',
    guardCount: 2,
    guardSpeed: 3.3,
    holeDuration: 6.8,
    trapDuration: 3.6,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E....$...',
      '######H######S######H#######',
      '......H.............H.......',
      '......H..$...$...$..H.......',
      '......H.###.###.###.H.......',
      '......H.#$#.#$#.#$#.H.......',
      '......H.###.###.###.H.......',
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
    level: 5,
    title: "Trickster's Trapdoor",
    guardCount: 2,
    guardSpeed: 3.35,
    holeDuration: 6.8,
    trapDuration: 3.6,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '#####XX#####HS#####XX#######',
      '.....$......H......$........',
      '....###..E..H..E..###.......',
      '....H#######H#######H.......',
      '....H.......H.......H.......',
      '....H..$....H....$..H.......',
      '....H.##XX#####XX##.H.......',
      '....H...$.......$...H.......',
      '....H..###########..H.......',
      '....H..H.........H..H.......',
      '....H..H.P.....Q.H..H.......',
      '....H..H....$....H..H.......',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 6,
    title: 'Staircase Excavation',
    guardCount: 3,
    guardSpeed: 3.4,
    holeDuration: 6.7,
    trapDuration: 3.5,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E....$...',
      '######H######S######H#######',
      '......H.............H.......',
      '......H..#########..H.......',
      '......H..##$###$##..H.......',
      '......H..#########..H.......',
      '..$...H.............H...$...',
      '####H########H########H#####',
      '....H........H........H.....',
      '....H..####..H..####..H.....',
      '....H..#$##..E..##$#..H.....',
      '....H..####..H..####..H.....',
      '....H...P....H....Q...H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },

  // =========================================================================
  // CHAPTER 2: ARASHIYAMA BAMBOO SHRINE (Levels 7 - 12)
  // =========================================================================
  {
    level: 7,
    title: 'Bamboo Labyrinth',
    guardCount: 3,
    guardSpeed: 3.5,
    holeDuration: 6.6,
    trapDuration: 3.5,
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
      '.....H..#########..H........',
      '.....H..H.......H..H........',
      '.....H..H.P...Q.H..H........',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 8,
    title: 'The Hanging Gardens',
    guardCount: 3,
    guardSpeed: 3.55,
    holeDuration: 6.5,
    trapDuration: 3.4,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '###H---------S---------H####',
      '...H...................H....',
      '...H...$....E....$.....H....',
      '...H..#####H.H#####....H....',
      '...H-------H.H-------..H....',
      '...H.......H.H.........H....',
      '...H..$....H.H....$....H....',
      '...H.#####.H.H.#####...H....',
      '...H.H...E.H.H.E...H...H....',
      '...H.H.###########.H...H....',
      '...H.H.H.........H.H...H....',
      '...H.H.H..P...Q..H.H...H....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 9,
    title: 'Oni Bridge Puzzle',
    guardCount: 3,
    guardSpeed: 3.6,
    holeDuration: 6.5,
    trapDuration: 3.4,
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
    level: 10,
    title: 'Three-Story Dig',
    guardCount: 3,
    guardSpeed: 3.65,
    holeDuration: 6.4,
    trapDuration: 3.3,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E....$...',
      '#####H#######S#######H######',
      '.....H...............H......',
      '.....H...#########...H......',
      '.....H...###$#$###...H......',
      '.....H...###$#$###...H......',
      '.....H...#########...H......',
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
    level: 11,
    title: 'Shrine of Illusions',
    guardCount: 3,
    guardSpeed: 3.7,
    holeDuration: 6.4,
    trapDuration: 3.3,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$....E.....S.....E....$...',
      '####X#X#H####S####H#X#X#####',
      '........H.........H.........',
      '..$.....H....$....H.....$...',
      '####H###X#########X###H#####',
      '....H.................H.....',
      '....H..$.....E.....$..H.....',
      '....H.###X#######X###.H.....',
      '....H.H.............H.H.....',
      '....H.H..$.......$..H.H.....',
      '....H.H.###########.H.H.....',
      '....H.H.H.........H.H.H.....',
      '....H.H.H..P...Q..H.H.H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 12,
    title: 'Emerald Pagoda',
    guardCount: 3,
    guardSpeed: 3.75,
    holeDuration: 6.3,
    trapDuration: 3.2,
    rows: [
      '.............S..............',
      '..........$..S..$...........',
      '........####HS####..........',
      '........H....S....H.........',
      '......$.H.E.....E.H.$.......',
      '.....####H#######H####......',
      '.....H...H.......H...H......',
      '...$.H...H..$ $..H...H.$....',
      '..####...#########...####...',
      '..H..H.......E.......H..H...',
      '..H..H..$.........$..H..H...',
      '..H..#################..H...',
      '..H..H...............H..H...',
      '..H..H...P.......Q...H..H...',
      '..H..H.......$.......H..H...',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },

  // =========================================================================
  // CHAPTER 3: HOKKAIDO FROST ONSEN (Levels 13 - 18)
  // =========================================================================
  {
    level: 13,
    title: 'Glacial Tiers',
    guardCount: 4,
    guardSpeed: 3.8,
    holeDuration: 6.2,
    trapDuration: 3.2,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '############################',
      'H..........................H',
      'H....$.......$.......$.....H',
      'H..######H#######H######...H',
      'H........H.......H.........H',
      'H..E.....H...$...H.....E...H',
      'H.#######H#######H#######..H',
      'H.H......H.......H......H..H',
      'H.H..$...H.......H...$..H..H',
      'H.H.#####H#######H#####.H..H',
      'H.H.H.................H.H..H',
      'H.H.H.....P.....Q.....H.H..H',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 14,
    title: 'Frozen Waterfall',
    guardCount: 4,
    guardSpeed: 3.85,
    holeDuration: 6.2,
    trapDuration: 3.1,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '###H-----###HS###-----H#####',
      '...H.....H......H.....H.....',
      '...H..$..H.E..E.H..$..H.....',
      '...H.###.########.###.H.....',
      '...H.H---........---H.H.....',
      '...H.H...$......$...H.H.....',
      '...H.H..####XX####..H.H.....',
      '...H.H..H..E..E..H..H.H.....',
      '...H.H..H..$..$..H..H.H.....',
      '...H.H..##########..H.H.....',
      '...H.H..H........H..H.H.....',
      '...H.H..H.P....Q.H..H.H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 15,
    title: 'The Ice Vaults',
    guardCount: 4,
    guardSpeed: 3.9,
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
      '....H.#####..$..#####.H.....',
      '....H.......###.......H.....',
      '....H.E....#####....E.H.....',
      '....H#####.......#####H.....',
      '....H.#$#.........#$#.H.....',
      '....H.###..#####..###.H.....',
      '....H......H...H......H.....',
      '....H..P...H...H...Q..H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 16,
    title: 'Rope & Chasm Gauntlet',
    guardCount: 4,
    guardSpeed: 3.95,
    holeDuration: 6.0,
    trapDuration: 3.0,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '##H----------S----------H###',
      '..H.....................H...',
      '..H...$......$......$...H...',
      '..H..###----###----###..H...',
      '..H....E...........E....H...',
      '..H....$.....$.....$....H...',
      '..H...###---###---###...H...',
      '..H......E.......E......H...',
      '..H..$...............$..H...',
      '..H.###################.H...',
      '..H.H.................H.H...',
      '..H.H.....P.....Q.....H.H...',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 17,
    title: 'Double Trapdoor Drop',
    guardCount: 4,
    guardSpeed: 4.0,
    holeDuration: 6.0,
    trapDuration: 3.0,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '####XX######HS######XX######',
      '....XX......H.......XX......',
      '....$$......H.......$$......',
      '###H####..E.H.E...####H#####',
      '...H...#####H#####....H.....',
      '...H........H.........H.....',
      '...H..$.....H.....$...H.....',
      '...H.##XX###H###XX##..H.....',
      '...H...$$...H...$$....H.....',
      '...H..######H######...H.....',
      '...H..H.....H.....H...H.....',
      '...H..H..P..H..Q..H...H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 18,
    title: 'Blizzard Bastion',
    guardCount: 4,
    guardSpeed: 4.05,
    holeDuration: 5.9,
    trapDuration: 2.9,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '#####H#######S#######H######',
      '.....H-------.-------H......',
      '.....H...$.......$...H......',
      '.....H..####H.H####..H......',
      '..$..H..H...H.H...H..H..$...',
      '######..H.E.H.H.E.H..#######',
      'H.......H###H.H###H........H',
      'H...$...H...H.H...H...$....H',
      'H..######...H.H...######...H',
      'H..H........H.H........H...H',
      'H..H...P....H.H....Q...H...H',
      'H..H........$ $........H...H',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },

  // =========================================================================
  // CHAPTER 4: KAGOSHIMA MAGMA FORGE (Levels 19 - 24)
  // =========================================================================
  {
    level: 19,
    title: 'The Iron Foundry',
    guardCount: 4,
    guardSpeed: 4.15,
    holeDuration: 5.8,
    trapDuration: 2.9,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '@@@##H@@####HS####@@H##@@@@@',
      '.....H......H.......H.......',
      '.....H..$...H...$...H.......',
      '.....H.@@##@H@##@@..H.......',
      '.....H.H....H....H..H.......',
      '..$..H.H.E..H..E.H..H...$...',
      '@@@##H.H####H####H..H###@@@@',
      '....H..H....H....H..H.......',
      '....H..H.$..H..$.H..H.......',
      '....H..H#########H..H.......',
      '....H..H.........H..H.......',
      '....H..H..P...Q..H..H.......',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 20,
    title: 'Crucible of Timing',
    guardCount: 5,
    guardSpeed: 4.2,
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
      '....H..#####H.H#####..H.....',
      '....H..H....H.H....H..H.....',
      '..$.H..H..E.H.H....H..H.$...',
      '#####..H###########H..######',
      '....H..H...........H..H.....',
      '....H..H...P...Q...H..H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 21,
    title: 'Deep Magma Excavation',
    guardCount: 5,
    guardSpeed: 4.25,
    holeDuration: 5.7,
    trapDuration: 2.8,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '####H########S########H#####',
      '....H.................H.....',
      '....H..#############..H.....',
      '....H..####$###$####..H.....',
      '....H..#####$#$#####..H.....',
      '....H..######$######..H.....',
      '....H..#############..H.....',
      '..$.H..E.....E.....E..H.$...',
      '#####H###############H######',
      '.....H...............H......',
      '.....H...$.......$...H......',
      '.....H...P.......Q...H......',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 22,
    title: 'Suspended Anvils',
    guardCount: 5,
    guardSpeed: 4.3,
    holeDuration: 5.7,
    trapDuration: 2.7,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '##H----------S----------H###',
      '..H.....................H...',
      '..H..$....$.....$....$..H...',
      '..H.@@@..@@@...@@@..@@@.H...',
      '..H..H----H-----H----H..H...',
      '..H..H.E...........E.H..H...',
      '..H..H...$...$...$...H..H...',
      '..H..H..###.###.###..H..H...',
      '..H..H.E...........E.H..H...',
      '..H..#################..H...',
      '..H..H.......E.......H..H...',
      '..H..H....P.....Q....H..H...',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 23,
    title: 'Furnace Maze',
    guardCount: 5,
    guardSpeed: 4.35,
    holeDuration: 5.6,
    trapDuration: 2.7,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..E.......S.......E..$...',
      '####H###XX###S###XX###H#####',
      '....H....$.......$....H.....',
      '....H..#####H.H#####..H.....',
      '....H..H.E..H.H..E.H..H.....',
      '..$.H..H..$.H.H.$..H..H.$...',
      '#####..H###XH.HX###H..######',
      'H......H....H.H....H.......H',
      'H..$...H.E..H.H....H...$...H',
      'H.####.######.######.####..H',
      'H.H..H...............H..H..H',
      'H.H..H....P.....Q....H..H..H',
      'H.H..H.......$.......H..H..H',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 24,
    title: 'Caldera Rim',
    guardCount: 5,
    guardSpeed: 4.4,
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
      '....######H#####H######.....',
      '....H.....H.....H.....H.....',
      '....H..E..H.$ $.H..E..H.....',
      '....H.#####.###.#####.H.....',
      '....H.H.....#$#.....H.H.....',
      '....H.H..E..###.....H.H.....',
      '....H.H...P.....Q...H.H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },

  // =========================================================================
  // CHAPTER 5: IMPERIAL GOLDEN CASTLE (Levels 25 - 30)
  // =========================================================================
  {
    level: 25,
    title: "Shogun's Courtyard",
    guardCount: 5,
    guardSpeed: 4.5,
    holeDuration: 5.5,
    trapDuration: 2.6,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$...E......S......E...$...',
      '#####H#######S#######H######',
      '.....H-------.-------H......',
      '.....H..#####.#####..H......',
      '.....H..#$#$#.#$#$#..H......',
      '.....H..#####.#####..H......',
      '..$..H...E...E...E...H..$...',
      '####H#################H#####',
      '....H.................H.....',
      '....H..$....$ $....$..H.....',
      '....H.#####.###.#####.H.....',
      '....H.H.....H.H.....H.H.....',
      '....H.H..P..H.H..Q..H.H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 26,
    title: 'The Gauntlet of Ropes',
    guardCount: 5,
    guardSpeed: 4.6,
    holeDuration: 5.5,
    trapDuration: 2.5,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..........S..........$...',
      '##H----------S----------H###',
      '..H....$...........$....H...',
      '..H---###---------###---H...',
      '..H....E.....$.....E....H...',
      '..H---------###---------H...',
      '..H..$.......E.......$..H...',
      '..H.###-------------###.H...',
      '..H.H..E...........E..H.H...',
      '..H.H..$.....$.....$..H.H...',
      '..H.H.###############.H.H...',
      '..H.H.H.............H.H.H...',
      '..H.H.H....P...Q....H.H.H...',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 27,
    title: 'Master Excavator',
    guardCount: 6,
    guardSpeed: 4.65,
    holeDuration: 5.4,
    trapDuration: 2.5,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..E.......S.......E..$...',
      '####H########S########H#####',
      '....H.................H.....',
      '....H.@@@@#######@@@@.H.....',
      '....H.@@@@##$#$##@@@@.H.....',
      '....H.@@@@###$###@@@@.H.....',
      '....H.@@@@#######@@@@.H.....',
      '..$.H..E..E.....E..E..H.$...',
      '#####H###############H######',
      '.....H...#########...H......',
      '.....H...###$#$###...H......',
      '.....H...#########...H......',
      '.....H....P.....Q....H......',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 28,
    title: 'Trapdoor Matrix',
    guardCount: 6,
    guardSpeed: 4.7,
    holeDuration: 5.4,
    trapDuration: 2.5,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..E.......S.......E..$...',
      '###X#X#H#####S#####H#X#X####',
      '.......H...........H........',
      '..$....H..$.....$..H....$...',
      '####H##X####H.H####X##H#####',
      '....H.......H.H.......H.....',
      '....H.E..$..H.H..$..E.H.....',
      '....H###X###H.H###X###H.....',
      '....H.......H.H.......H.....',
      '....H..E.$..H.H..$.E..H.....',
      '....H.######H.H######.H.....',
      '....H.H.....H.H.....H.H.....',
      '....H.H..P..H.H..Q..H.H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 29,
    title: "Yokozuna's Trial",
    guardCount: 6,
    guardSpeed: 4.8,
    holeDuration: 5.3,
    trapDuration: 2.4,
    rows: [
      '.............S..............',
      '.............S..............',
      '..$..E.......S.......E..$...',
      '#####H-------S-------H######',
      '.....H...............H......',
      '..$..H..####H.H####..H..$...',
      '####H###H.#$H.H$#.H###H#####',
      '....H...H.###.###.H...H.....',
      '....H.E.H..E...E..H.E.H.....',
      '....H###H#########H###H.....',
      '....H...H...$ $...H...H.....',
      '....H...H.#######.H...H.....',
      '....H...H.H..$..H.H...H.....',
      '....H...H.H.###.H.H...H.....',
      '....H...H.H.P.Q.H.H...H.....',
      '@@@@@@@@@@@@@@@@@@@@@@@@@@@@'
    ]
  },
  {
    level: 30,
    title: 'Imperial Grand Dohyō',
    guardCount: 6,
    guardSpeed: 4.9,
    holeDuration: 5.2,
    trapDuration: 2.4,
    rows: [
      '.............S..............',
      '.........$...S...$..........',
      '..$..E..####HS####..E...$...',
      '#####H--H....S....H--H######',
      '.....H..H..$...$..H..H......',
      '.....H..###########..H......',
      '.....H..H..##$##..H..H......',
      '..$..H..H..#####..H..H..$...',
      '####H###H.E.....E.H###H#####',
      '....H...H#########H...H.....',
      '....H.E.H..$...$..H.E.H.....',
      '....H###H.###X###.H###H.....',
      '....H...H.#$#.#$#.H...H.....',
      '....H...H.###.###.H...H.....',
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
  carryingGoldId: number | null;
  goldHoldTimer: number;
  animPhase: number;
  moveDirX: number;
  moveDirY: number;
  repathTimer: number;
  immuneHoleCol: number;
  immuneHoleRow: number;
}

export class SumoLodeRunnerGame extends BaseGame {
  // Multi-round / 30-level campaign flags so GameManager does not cut off at 65s
  public isMultiRound: boolean = true;
  public isNoTimeLimit: boolean = false;

  // Current Level (1..30)
  public currentLevel: number = 1;
  public maxUnlockedLevel: number = 1;
  public teamLives: number = 5;
  private levelClearBannerTimer: number = 0;
  private escapeRevealed: boolean = false;
  private escapeFlashTimer: number = 0;

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

  // Direct keyboard listener for dedicated Dig Left (Q/Z), Dig Right (E/X/C), and Level Select ([ / ] / R)
  private rawKeys: Set<string> = new Set();
  private justRawKeys: Set<string> = new Set();
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;
  private canvasClickHandler: ((e: MouseEvent) => void) | null = null;

  // Clickable HUD Hitboxes for Level Navigation
  private hudHitboxes: { id: string; x: number; y: number; w: number; h: number; action: () => void }[] = [];

  public setStartingLevel(level: number): void {
    this.currentLevel = Math.max(1, Math.min(30, Math.floor(level)));
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
    this.initWasmKernel();

    // Load saved level progress
    try {
      const saved = localStorage.getItem('antigravity_sumo_lode_unlocked');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
          this.maxUnlockedLevel = parsed;
        }
      }
    } catch {
      // ignore storage errors
    }

    // Bind dedicated Lode Runner hotkeys
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
      this.canvasClickHandler = (e: MouseEvent) => {
        if (this.isFinished) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = width / Math.max(1, rect.width);
        const scaleY = height / Math.max(1, rect.height);
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        for (const box of this.hudHitboxes) {
          if (cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h) {
            box.action();
            break;
          }
        }
      };
      canvas.addEventListener('mousedown', this.canvasClickHandler);
    }

    this.reset(width, height);
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
      if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
      const canvas = this.input?.getCanvas();
      if (canvas && this.canvasClickHandler) {
        canvas.removeEventListener('mousedown', this.canvasClickHandler);
      }
    }
    this.keyDownHandler = null;
    this.keyUpHandler = null;
    this.canvasClickHandler = null;
    super.destroy();
  }

  public reset(width: number, height: number): void {
    this.initWasmKernel();
    this.isFinished = false;
    this.roundTimer = 180;
    this.teamLives = 5;
    this.runners.clear();

    const active = this.getActivePlayers();
    active.forEach((p) => {
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
        score: 0,
        goldCollected: 0,
        guardsTrapped: 0,
        levelsCleared: 0,
        dropFromRopeCooldown: 0
      });
    });

    this.loadLevel(this.currentLevel);
  }

  public loadLevel(levelNum: number): void {
    this.currentLevel = Math.max(1, Math.min(30, levelNum));
    const bp = SUMO_LODE_LEVELS[this.currentLevel - 1];

    this.gridMem.fill(TILE_EMPTY);
    this.dynMem.fill(DYN_NONE);
    this.trapdoorRevealed.fill(0);
    this.dugBricks = [];
    this.golds = [];
    this.guards = [];
    this.escapeRevealed = false;
    this.escapeFlashTimer = 0;
    this.levelClearBannerTimer = 0;
    this.roundTimer = 180; // Fresh 3-minute timer per stage
    this.tileCacheDirty = true;

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

    let pIdx = 0;
    for (const runner of this.runners.values()) {
      const sp = pIdx % 2 === 0 ? defaultP : defaultQ;
      const offsetCol = pIdx >= 2 ? (pIdx === 2 ? -1 : 1) : 0;
      runner.spawnCol = Math.max(1, Math.min(GRID_COLS - 2, sp.col + offsetCol));
      runner.spawnRow = sp.row;
      runner.x = runner.spawnCol;
      runner.y = runner.spawnRow;
      runner.state = 'IDLE';
      runner.digTimer = 0;
      runner.respawnTimer = 0;
      runner.invulnTimer = 1.5;
      runner.dropFromRopeCooldown = 0;
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
        carryingGoldId: null,
        goldHoldTimer: 0,
        animPhase: i * 1.3,
        moveDirX: 0,
        moveDirY: 0,
        repathTimer: 0,
        immuneHoleCol: -1,
        immuneHoleRow: -1
      });
    }
  }

  /**
   * Calls into the compiled WebAssembly kernel (or fallback) to check if tile (col, row) has support
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
    if (t === TILE_LADDER || t === TILE_ROPE) return true;
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
      // Guards can also fall through trapdoors
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
   * Validates Lode Runner digging rule:
   * Target (digCol, digRow) must be TILE_BRICK (not already dug),
   * and the tile directly above (digCol, digRow - 1) must be passable and not a ladder/rope.
   */
  public canDigAt(digCol: number, digRow: number): boolean {
    if (digCol < 0 || digCol >= GRID_COLS || digRow <= 0 || digRow >= GRID_ROWS - 1) return false;
    const targetIdx = digRow * GRID_COLS + digCol;
    if (this.gridMem[targetIdx] !== TILE_BRICK) return false;
    if (this.dynMem[targetIdx] !== DYN_NONE) return false;

    const aboveIdx = (digRow - 1) * GRID_COLS + digCol;
    const aboveTile = this.gridMem[aboveIdx];
    if (aboveTile === TILE_BRICK && this.dynMem[aboveIdx] === DYN_NONE) return false;
    if (aboveTile === TILE_SOLID || aboveTile === TILE_LADDER) return false;

    return true;
  }

  private triggerDig(runner: SumoRunnerPlayer, dir: -1 | 1, gridOriginX: number, gridOriginY: number, tileW: number, tileH: number): boolean {
    const baseCol = Math.round(runner.x);
    const baseRow = Math.round(runner.y);
    const digCol = baseCol + dir;
    const digRow = baseRow + 1;

    if (!this.canDigAt(digCol, digRow)) return false;

    // Snap runner cleanly to baseCol so dig beam aligns with diagonal brick
    runner.x = baseCol;
    runner.y = baseRow;
    runner.facing = dir;
    runner.state = 'DIG';
    runner.digTimer = 0.16;
    runner.digTargetCol = digCol;
    runner.digTargetRow = digRow;

    const bp = SUMO_LODE_LEVELS[this.currentLevel - 1];
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
    this.particles.spawnSparks(px, py, biome.brickLight, 10);
    return true;
  }

  public getCurrentBiome(): BiomePalette {
    const chapterIdx = Math.min(4, Math.floor((this.currentLevel - 1) / 6));
    return BIOME_PALETTES[chapterIdx];
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    const clampedDt = Math.min(dt, 0.05);
    this.roundTimer = Math.max(0, this.roundTimer - clampedDt);

    // Handle quick keyboard level navigation ([ / ] / R)
    if (this.justRawKeys.has('BracketLeft') || this.justRawKeys.has('PageDown')) {
      if (this.currentLevel > 1) {
        this.audio.playMenuTick();
        this.loadLevel(this.currentLevel - 1);
      }
    } else if (this.justRawKeys.has('BracketRight') || this.justRawKeys.has('PageUp')) {
      if (this.currentLevel < 30) {
        this.audio.playMenuTick();
        this.loadLevel(this.currentLevel + 1);
      }
    } else if (this.justRawKeys.has('KeyR')) {
      this.audio.playTap();
      this.loadLevel(this.currentLevel);
    }

    if (this.escapeFlashTimer > 0) {
      this.escapeFlashTimer = Math.max(0, this.escapeFlashTimer - clampedDt);
    }

    // Stage Clear celebration transition to next level
    if (this.levelClearBannerTimer > 0) {
      this.levelClearBannerTimer -= clampedDt;
      if (this.levelClearBannerTimer <= 0) {
        if (this.currentLevel < 30) {
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
          // Completed all 30 levels!
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

    // 2. Update Sumo Players
    this.updateRunners(clampedDt, originX, originY, tileW, tileH);

    // 3. Update Rival Oni-Sumo Guards
    this.updateGuards(clampedDt, originX, originY, tileW, tileH);

    // 4. Check Escape Ladder Stage Clear condition
    const remainingGold = this.golds.filter((g) => !g.collected).length;
    if (remainingGold === 0 && !this.escapeRevealed) {
      this.escapeRevealed = true;
      this.escapeFlashTimer = 1.2;
      this.tileCacheDirty = true;
      this.audio.playFanfare();
      this.particles.showFloatingText('⚡ ESCAPE LADDER REVEALED! CLIMB TO TOP!', width / 2, originY + 28, '#FDE047', 20);
    }

    if (this.escapeRevealed) {
      for (const runner of this.runners.values()) {
        if (runner.state !== 'DEAD' && runner.y <= 0.35 && this.isClimbable(Math.round(runner.x), 0)) {
          // Player reached top of the escape ladder!
          runner.score += 500;
          runner.levelsCleared += 1;
          this.audio.playFanfare();
          const px = originX + (runner.x + 0.5) * tileW;
          const py = originY + 20;
          this.particles.spawnWinnerCelebration(px, py, '#FBBF24');
          this.particles.showFloatingText(`🏆 STAGE ${this.currentLevel} CLEAR! +500 PTS!`, width / 2, height / 2 - 20, '#FDE047', 24);
          this.levelClearBannerTimer = 1.75;
          break;
        }
      }
    }

    // Check if team lives exhausted or timer ran out
    if (this.teamLives <= 0 || this.roundTimer <= 0) {
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
        for (const g of this.guards) {
          if (Math.round(g.x) === b.col && Math.round(g.y) === b.row) {
            if (g.carryingGoldId !== null) {
              this.dropGuardGold(g, b.col, b.row - 1);
            }
            g.x = g.spawnCol;
            g.y = 0;
            g.state = 'FALL';
            g.trapTimer = 0;
            g.trapCol = -1;
            g.trapRow = -1;

            const creditPlayer = this.runners.get(b.dugBy);
            if (creditPlayer) {
              creditPlayer.score += 250;
            }
            this.audio.playExplosion();
            this.particles.spawnSparks(px, py, '#F59E0B', 14);
            this.particles.showFloatingText('+250 ONI CRUSHED!', px, py - 14, '#FBBF24', 14);
          }
        }

        // Check if any player is trapped inside the sealing brick
        for (const r of this.runners.values()) {
          if (r.state !== 'DEAD' && Math.round(r.x) === b.col && Math.round(r.y) === b.row) {
            this.killRunner(r, originX, originY, tileW, tileH, 'CRUSHED BY DOHYO CLAY!');
          }
        }

        // Ensure no gold item is buried inside the sealed brick
        for (const gold of this.golds) {
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
    runner.respawnTimer = 1.35;
    this.teamLives = Math.max(0, this.teamLives - 1);
    const px = originX + (runner.x + 0.5) * tileW;
    const py = originY + (runner.y + 0.5) * tileH;
    this.audio.playStun();
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
        if (r.respawnTimer <= 0 && this.teamLives > 0) {
          r.x = r.spawnCol;
          r.y = r.spawnRow;
          r.state = 'IDLE';
          r.invulnTimer = 2.0;
          const px = originX + (r.x + 0.5) * tileW;
          const py = originY + (r.y + 0.5) * tileH;
          this.particles.spawnSparks(px, py, '#38BDF8', 12);
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
      const supported = onLadder || onRope || this.isTileSupported(col, row);

      // Reveal false brick if player falls through a trapdoor
      const belowRow = Math.min(GRID_ROWS - 1, row + 1);
      if (this.gridMem[belowRow * GRID_COLS + col] === TILE_TRAPDOOR) {
        this.trapdoorRevealed[belowRow * GRID_COLS + col] = 1;
      }
      if (currentTile === TILE_TRAPDOOR) {
        this.trapdoorRevealed[cellIdx] = 1;
      }

      if (!supported) {
        // Gravity fall (authentic Lode Runner: straight vertical drop, snap X to column)
        r.state = 'FALL';
        r.x += (col - r.x) * Math.min(1, dt * 18);
        r.y += moveSpeed * 1.18 * dt;

        const newRow = Math.floor(r.y + 0.05);
        if (newRow > row && newRow < GRID_ROWS) {
          // Check if we landed on solid ground or caught a rope/ladder
          const landTile = this.gridMem[newRow * GRID_COLS + col];
          if (landTile === TILE_ROPE && r.dropFromRopeCooldown <= 0) {
            r.y = newRow;
            r.state = 'ROPE';
          } else if (this.isTileSupported(col, newRow)) {
            r.y = newRow;
            r.state = 'IDLE';
          }
        }
        this.collectGoldAt(r, Math.round(r.x), Math.round(r.y), originX, originY, tileW, tileH);
        continue;
      }

      // Read directional & dig inputs
      const steer = this.input.getSteer(r.id);
      const throttle = this.input.getThrottle(r.id);
      const justAct = this.input.justAction(r.id) || this.input.justPressed(r.id);

      const moveX = Math.abs(steer) > 0.25 ? Math.sign(steer) : 0;
      const moveY = Math.abs(throttle) > 0.25 ? -Math.sign(throttle) : 0; // -1 = UP, +1 = DOWN

      if (moveX !== 0) {
        r.facing = moveX as -1 | 1;
      }

      // Check dedicated Dig Left / Dig Right hotkeys OR Action button
      let wantDigDir: -1 | 1 | 0 = 0;
      if (r.id === 0) {
        if (this.justRawKeys.has('KeyQ') || this.justRawKeys.has('KeyZ')) wantDigDir = -1;
        else if (this.justRawKeys.has('KeyE') || this.justRawKeys.has('KeyX') || this.justRawKeys.has('KeyC')) wantDigDir = 1;
      } else if (r.id === 1) {
        if (this.justRawKeys.has('Comma') || this.justRawKeys.has('Slash') || this.justRawKeys.has('ShiftRight')) wantDigDir = -1;
        else if (this.justRawKeys.has('Period')) wantDigDir = 1;
      }

      if (wantDigDir === 0 && justAct && !onRope) {
        // Smart directional dig: dig in facing direction, or if blocked and opposite side is diggable, assist!
        if (this.canDigAt(col + r.facing, row + 1)) {
          wantDigDir = r.facing;
        } else if (moveX === 0 && this.canDigAt(col - r.facing, row + 1)) {
          wantDigDir = (r.facing * -1) as -1 | 1;
        } else {
          wantDigDir = r.facing;
        }
      }

      if (wantDigDir !== 0 && !onRope) {
        if (this.triggerDig(r, wantDigDir, originX, originY, tileW, tileH)) {
          continue;
        }
      }

      // Drop off rope when pressing Down
      if (onRope && moveY > 0 && !onLadder) {
        r.dropFromRopeCooldown = 0.28;
        r.y += 0.22;
        r.state = 'FALL';
        continue;
      }

      // Vertical climbing on Ladders
      let movedVertically = false;
      if (moveY !== 0) {
        // Check if current column or nearby column has a ladder
        let ladderCol = -1;
        if (moveY < 0) {
          if (this.isClimbable(col, row) || this.isClimbable(col, row - 1)) ladderCol = col;
        } else {
          if (this.isClimbable(col, row) || this.isClimbable(col, row + 1)) ladderCol = col;
        }

        if (ladderCol !== -1) {
          const targetY = r.y + moveY * moveSpeed * dt;
          const checkRow = moveY < 0 ? Math.floor(targetY) : Math.ceil(targetY);
          if (checkRow >= 0 && checkRow < GRID_ROWS && this.isCellPassable(ladderCol, checkRow)) {
            r.x += (ladderCol - r.x) * Math.min(1, dt * 16);
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
    for (const g of this.golds) {
      if (!g.collected && g.carriedByGuardId === null && g.col === col && g.row === row) {
        g.collected = true;
        runner.goldCollected++;
        runner.score += Math.round(250 * this.activeMutator.scoreMultiplier);
        const px = originX + (col + 0.5) * tileW;
        const py = originY + (row + 0.5) * tileH;
        this.audio.playCoin();
        this.particles.spawnSparks(px, py, '#FDE047', 12);
        this.particles.showFloatingText('+250 GOLD!', px, py - 12, '#FDE047', 13);
      }
    }
  }

  private dropGuardGold(guard: OniGuard, col: number, row: number): void {
    if (guard.carryingGoldId === null) return;
    const gold = this.golds[guard.carryingGoldId];
    guard.carryingGoldId = null;
    if (!gold) return;

    const safeCol = Math.max(0, Math.min(GRID_COLS - 1, col));
    const safeRow = Math.max(0, Math.min(GRID_ROWS - 2, row));
    gold.col = safeCol;
    gold.row = safeRow;
  }

  private updateGuards(dt: number, originX: number, originY: number, tileW: number, tileH: number): void {
    const bp = SUMO_LODE_LEVELS[this.currentLevel - 1];
    const guardSpeed = bp.guardSpeed * this.activeMutator.speedMultiplier;

    for (const g of this.guards) {
      g.animPhase += dt * 9;
      const col = Math.round(g.x);
      const row = Math.round(g.y);
      const cellIdx = row * GRID_COLS + col;

      // 1. Check if guard is currently TRAPPED in a dug hole
      if (g.state === 'TRAPPED') {
        g.trapTimer += dt;
        const holeIdx = g.trapRow * GRID_COLS + g.trapCol;
        if (this.dynMem[holeIdx] !== DYN_NONE) {
          this.dynMem[holeIdx] = DYN_TRAPPED_GUARD;
        }

        if (g.trapTimer >= bp.trapDuration) {
          // Guard climbs out of the hole!
          this.dynMem[holeIdx] = DYN_DUG_HOLE;
          const climbDir = g.facing;
          let exitCol = g.trapCol + climbDir;
          if (!this.isCellPassable(exitCol, g.trapRow - 1, true)) {
            exitCol = g.trapCol - climbDir;
          }
          if (!this.isCellPassable(exitCol, g.trapRow - 1, true)) {
            exitCol = g.trapCol;
          }
          g.x = Math.max(0, Math.min(GRID_COLS - 1, exitCol));
          g.y = Math.max(0, g.trapRow - 1);
          g.immuneHoleCol = g.trapCol;
          g.immuneHoleRow = g.trapRow;
          g.state = 'PATROL';
          g.trapTimer = 0;
          g.trapCol = -1;
          g.trapRow = -1;
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

        // Award trap points to the player who dug this hole
        const dugBrick = this.dugBricks.find((b) => b.col === col && b.row === row);
        if (dugBrick) {
          const r = this.runners.get(dugBrick.dugBy);
          if (r) {
            r.score += 75;
            r.guardsTrapped++;
          }
        }
        const px = originX + (col + 0.5) * tileW;
        const py = originY + (row + 0.5) * tileH;
        this.audio.playBounce();
        this.particles.spawnSparks(px, py, '#38BDF8', 8);
        this.particles.showFloatingText('+75 TRAPPED!', px, py - 12, '#38BDF8', 12);
        continue;
      }

      // 3. Check if guard is supported or falling
      const onLadder = this.isClimbable(col, row);
      const onRope = this.gridMem[cellIdx] === TILE_ROPE && Math.abs(g.y - row) < 0.38;
      const supported = onLadder || onRope || this.isTileSupported(col, row);

      if (!supported) {
        g.state = 'FALL';
        g.x += (col - g.x) * Math.min(1, dt * 16);
        g.y += guardSpeed * 1.25 * dt;
        const newRow = Math.floor(g.y + 0.05);
        if (newRow > row && newRow < GRID_ROWS) {
          const newIdx = newRow * GRID_COLS + col;
          if (this.dynMem[newIdx] === DYN_DUG_HOLE) {
            g.y = newRow;
          } else if (this.gridMem[newIdx] === TILE_ROPE || this.isTileSupported(col, newRow)) {
            g.y = newRow;
            g.state = 'PATROL';
          }
        }
        continue;
      }

      // 4. Guard Gold Stealing & Dropping
      if (g.carryingGoldId === null) {
        for (const gold of this.golds) {
          if (!gold.collected && gold.carriedByGuardId === null && gold.col === col && gold.row === row) {
            gold.carriedByGuardId = g.id;
            g.carryingGoldId = gold.id;
            g.goldHoldTimer = 7.0 + Math.random() * 5.0;
            break;
          }
        }
      } else {
        g.goldHoldTimer -= dt;
        if (g.goldHoldTimer <= 0 && this.gridMem[cellIdx] === TILE_EMPTY && this.isTileSupported(col, row)) {
          this.dropGuardGold(g, col, row);
        }
      }

      // 5. Find nearest alive player & run Wasm-assisted BFS pathfinding
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

      // Execute Guard Movement
      if (g.moveDirY !== 0 && (onLadder || (g.moveDirY > 0 && onRope) || this.isClimbable(col, row + g.moveDirY))) {
        if (g.moveDirY > 0 && onRope && !onLadder) {
          // Drop off rope toward player below
          g.y += 0.25;
          g.state = 'FALL';
        } else {
          g.x += (col - g.x) * Math.min(1, dt * 15);
          g.y = Math.max(0, Math.min(GRID_ROWS - 2, g.y + g.moveDirY * guardSpeed * dt));
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

      // 6. Check Guard catching a Player
      for (const r of this.runners.values()) {
        if (r.state === 'DEAD' || r.invulnTimer > 0) continue;
        if (Math.hypot(r.x - g.x, r.y - g.y) < 0.58) {
          this.killRunner(r, originX, originY, tileW, tileH, 'CAUGHT BY ONI GUARD!');
        }
      }
    }
  }

  private isGuardAt(excludeGuardId: number, col: number, row: number): boolean {
    for (const g of this.guards) {
      if (g.id !== excludeGuardId && g.state !== 'TRAPPED' && Math.round(g.x) === col && Math.round(g.y) === row) {
        return true;
      }
    }
    return false;
  }

  /**
   * Zero-Allocation Ring-Buffer BFS Pathfinding across the 28x16 Lode Runner Graph.
   * Respects Lode Runner rules: walking left/right when supported, climbing ladders,
   * traversing ropes, and dropping off ledges/ropes.
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

    const dirs = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 }
    ];

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

      // If unsupported in air, can only fall straight down!
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
        const { dx, dy } = dirs[d];
        const nc = c + dx;
        const nr = r + dy;
        if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;

        if (dy === -1 && !onLadder) continue; // Can only climb UP if on a ladder
        if (dy === 1) {
          // Can climb DOWN if on a ladder, ladder below, or dropping off a rope
          const ladderBelow = this.isClimbable(c, nr);
          if (!onLadder && !ladderBelow && !onRope) continue;
        }
        if (dx !== 0) {
          // Avoid walking into dug holes if this is a smart Bot player!
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

    const myCol = Math.round(me.x);
    const myRow = Math.round(me.y);

    // 1. Check if an Oni Guard is dangerously close on the same row -> Dig a defensive trap hole!
    for (const g of this.guards) {
      if (g.state === 'TRAPPED') continue;
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
    } else {
      // Find closest uncollected gold
      let bestDist = 999999;
      for (const gold of this.golds) {
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

    return {
      winnerId,
      rankings: list.map((r, idx) => ({
        playerId: r.id,
        score: r.score,
        place: idx + 1
      })),
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} REACHED STAGE ${this.currentLevel}/30 WITH ${winner.score} PTS (${winner.goldCollected} GOLD)!`
          : `REACHED STAGE ${this.currentLevel}/30 IN SUMO LODE RUNNER!`
    };
  }

  private getGridLayout(width: number, height: number) {
    const topMargin = 54;
    const bottomMargin = 28;
    const sideMargin = 20;
    const availW = Math.max(320, width - sideMargin * 2);
    const availH = Math.max(240, height - topMargin - bottomMargin);

    const tileW = Math.floor(availW / GRID_COLS);
    const tileH = Math.floor(availH / GRID_ROWS);
    const totalW = tileW * GRID_COLS;
    const totalH = tileH * GRID_ROWS;
    const originX = Math.floor((width - totalW) / 2);
    const originY = topMargin + Math.floor((availH - totalH) / 2);

    return { originX, originY, tileW, tileH, totalW, totalH };
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

          // Subtle tell if trapdoor has been revealed by someone falling through it
          if (t === TILE_TRAPDOOR && this.trapdoorRevealed[idx] === 1) {
            ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(x + 2, y + 2, tileW - 4, tileH - 4);
            ctx.setLineDash([]);
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
    ctx.save();
    const now = performance.now() * 0.001;
    const biome = this.getCurrentBiome();
    const bp = SUMO_LODE_LEVELS[this.currentLevel - 1];
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
      // Hanging Paper Chōchin Lantern
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

    // 3. Render Dug Brick Pits & Regeneration Warning Animations
    for (const b of this.dugBricks) {
      const bx = originX + b.col * tileW;
      const by = originY + b.row * tileH;
      const rem = b.maxDuration - b.timer;

      // Dark excavated cavity outline
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 2, by + 2, tileW - 4, tileH - 4);

      if (rem < 1.6) {
        // Brick is regenerating! Draw rising clay blocks with tremor
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
    for (const g of this.golds) {
      if (g.collected || g.carriedByGuardId !== null) continue;
      const gx = originX + (g.col + 0.5) * tileW;
      const gy = originY + (g.row + 0.55) * tileH + Math.sin(now * 4 + g.id) * 1.5;
      this.drawGoldenTreasure(ctx, gx, gy, Math.min(tileW, tileH) * 0.42, now + g.id);
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

    // 6. Render Rival Oni-Sumo Guards (Mad Monks)
    for (const g of this.guards) {
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

      // If digging, draw diagonal Sumo Shiko Stomp Ki Beam into target brick
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

    // 8. Render Top & Bottom Classic-Modern Sumo Lode Runner HUD Bar
    this.renderLodeRunnerHUD(ctx, width, height, bp, biome);

    // 9. Stage Clear Banner Overlay
    if (this.levelClearBannerTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fillRect(width / 2 - 210, height / 2 - 48, 420, 96);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(width / 2 - 210, height / 2 - 48, 420, 96);

      ctx.fillStyle = '#FDE047';
      ctx.font = '900 22px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🎌 STAGE ${this.currentLevel} COMPLETE! 🎌`, width / 2, height / 2 - 10);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 13px Montserrat, sans-serif';
      const nextMsg =
        this.currentLevel < 30
          ? `Advancing to Stage ${this.currentLevel + 1}: ${SUMO_LODE_LEVELS[this.currentLevel].title}...`
          : 'ALL 30 YOKOZUNA STAGES CONQUERED!';
      ctx.fillText(nextMsg, width / 2, height / 2 + 22);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawGoldenTreasure(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
    ctx.save();
    // Golden Chanko Cauldron / Koban Ingot Stack
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

    // Specular glint
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

    // Dark Indigo Mawashi Belt (glows gold when carrying stolen gold!)
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

    // If trapped in dug hole, draw flat walkable bridge indicator + dizzy stars!
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

    // Sumo Legs (Shiko stomp pose when digging!)
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

    // Player-Colored Ceremonial Mawashi Belt + Gold Kesho-Mawashi Apron Trim
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
    // White topknot tie (motoyui)
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-rad * 0.16, -rad * 0.85, rad * 0.32, 2);

    // Expressive Eyes & Headband facing direction
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
    this.hudHitboxes = [];

    // Bottom Classic Lode Runner Status Bar
    const barY = height - 26;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(0, barY, width, 26);
    ctx.strokeStyle = biome.brickLight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, barY);
    ctx.lineTo(width, barY);
    ctx.stroke();

    const remainingGold = this.golds.filter((g) => !g.collected).length;
    const totalGold = this.golds.length;

    // Interactive Level Selector Pill in Bottom Center: [ ◀ ] STAGE X/30: TITLE [ ▶ ] [ ↻ RETRY ]
    const prevBtnX = width / 2 - 195;
    const nextBtnX = width / 2 + 115;
    const retryBtnX = width / 2 + 150;
    const btnY = barY + 3;
    const btnH = 20;

    // Prev Level Button
    ctx.fillStyle = this.currentLevel > 1 ? '#334155' : '#1E293B';
    ctx.fillRect(prevBtnX, btnY, 26, btnH);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 10px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◀', prevBtnX + 13, btnY + 14);
    this.hudHitboxes.push({
      id: 'lvl_prev',
      x: prevBtnX,
      y: btnY,
      w: 26,
      h: btnH,
      action: () => {
        if (this.currentLevel > 1) {
          this.audio.playMenuTick();
          this.loadLevel(this.currentLevel - 1);
        }
      }
    });

    // Stage Title & Biome Label
    ctx.fillStyle = '#FDE047';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`STAGE ${this.currentLevel}/30: ${bp.title.toUpperCase()}`, width / 2 - 25, btnY + 14);

    // Next Level Button
    ctx.fillStyle = this.currentLevel < 30 ? '#334155' : '#1E293B';
    ctx.fillRect(nextBtnX, btnY, 26, btnH);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText('▶', nextBtnX + 13, btnY + 14);
    this.hudHitboxes.push({
      id: 'lvl_next',
      x: nextBtnX,
      y: btnY,
      w: 26,
      h: btnH,
      action: () => {
        if (this.currentLevel < 30) {
          this.audio.playMenuTick();
          this.loadLevel(this.currentLevel + 1);
        }
      }
    });

    // Instant Retry Button [R]
    ctx.fillStyle = '#7F1D1D';
    ctx.fillRect(retryBtnX, btnY, 58, btnH);
    ctx.fillStyle = '#FCA5A5';
    ctx.font = '800 9.5px Montserrat, sans-serif';
    ctx.fillText('↻ RETRY [R]', retryBtnX + 29, btnY + 13.5);
    this.hudHitboxes.push({
      id: 'lvl_retry',
      x: retryBtnX,
      y: btnY,
      w: 58,
      h: btnH,
      action: () => {
        this.audio.playTap();
        this.loadLevel(this.currentLevel);
      }
    });

    // Left Status: Gold Remaining & Lives
    ctx.textAlign = 'left';
    ctx.fillStyle = remainingGold === 0 ? '#4ADE80' : '#FACC15';
    ctx.font = '900 10.5px Montserrat, sans-serif';
    const goldText =
      remainingGold === 0
        ? '✨ ALL GOLD COLLECTED! CLIMB UP!'
        : `🪙 GOLD: ${totalGold - remainingGold}/${totalGold}   ❤️ LIVES: ${this.teamLives}`;
    ctx.fillText(goldText, 16, btnY + 14);

    // Right Status: Player Scores & Wasm Engine Badge
    ctx.textAlign = 'right';
    const p1Score = this.runners.get(0)?.score ?? 0;
    const p2Score = this.runners.get(1)?.score ?? 0;
    const wasmTag = this.wasmActive ? '⚡WASM' : '⚡JIT';
    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 10px Montserrat, sans-serif';
    ctx.fillText(`P1: ${p1Score}  •  P2: ${p2Score}  [${wasmTag}]`, width - 16, btnY + 14);
  }
}
