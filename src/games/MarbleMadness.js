/**
 * MarbleMadness.js
 * Isometric 3D-Grid Course Roller
 * Navigate shaded isometric slope tiles (flat, slopeDown, slopeLeft, slopeRight, boost, ice, chasm, goal)
 * across 6 distinct multi-stage courses with realistic slope gravity vectors, momentum,
 * bumper rebounds, patrolling steel marbles, and chasm drop-offs!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';
import { Vector2 } from '../engine/Vector2.js';

const COURSE_CATALOG = [
  {
    name: 'PRACTICE TERRACE',
    subtitle: 'GENTLE SLOPES & WIDE BRIDGES',
    timeLimit: 50,
    flatA: '#1E3A8A',
    flatB: '#172554',
    stroke: '#00F0FF',
    skirtL: '#0F172A',
    skirtR: '#1E293B'
  },
  {
    name: 'SERPENTINE CHASM',
    subtitle: 'SWITCHBACK CURVES & BOOST PADS',
    timeLimit: 52,
    flatA: '#065F46',
    flatB: '#064E3B',
    stroke: '#00FF66',
    skirtL: '#022C22',
    skirtR: '#064E3B'
  },
  {
    name: 'BUMPER FORTRESS',
    subtitle: 'PINBALL CITADEL & SPLIT ISLAND',
    timeLimit: 54,
    flatA: '#581C87',
    flatB: '#3B0764',
    stroke: '#FF007A',
    skirtL: '#1E1B4B',
    skirtR: '#2E1065'
  },
  {
    name: 'TWIN SKYBRIDGES',
    subtitle: 'GLACIER ICE & PARALLEL BRIDGES',
    timeLimit: 55,
    flatA: '#0C4A6E',
    flatB: '#082F49',
    stroke: '#38BDF8',
    skirtL: '#082F49',
    skirtR: '#0369A1'
  },
  {
    name: 'VORTEX GAUNTLET',
    subtitle: 'SPIRAL DESCENT & TURBO RUNWAY',
    timeLimit: 56,
    flatA: '#7C2D12',
    flatB: '#431407',
    stroke: '#FF8800',
    skirtL: '#271206',
    skirtR: '#431407'
  },
  {
    name: 'ZENITH CITADEL',
    subtitle: 'GRAND MASTER CHAMPIONSHIP',
    timeLimit: 60,
    flatA: '#312E81',
    flatB: '#1E1B4B',
    stroke: '#FFD700',
    skirtL: '#090D16',
    skirtR: '#1E1B4B'
  },
  {
    name: 'THE CATAPULT CHASM',
    subtitle: 'TURBO JUMP BRIDGES & TWIN GAPS',
    timeLimit: 58,
    flatA: '#701A75',
    flatB: '#4A044E',
    stroke: '#F472B6',
    skirtL: '#2E1065',
    skirtR: '#3B0764'
  },
  {
    name: 'ICE & ACID GAUNTLET',
    subtitle: 'SLICK GLACIERS & TOXIC POOLS',
    timeLimit: 60,
    flatA: '#14532D',
    flatB: '#052E16',
    stroke: '#4ADE80',
    skirtL: '#022C22',
    skirtR: '#064E3B'
  },
  {
    name: 'SWISS CHEESE LABYRINTH',
    subtitle: 'PERFORATED DECK & BUMPER MAZE',
    timeLimit: 62,
    flatA: '#78350F',
    flatB: '#451A03',
    stroke: '#FACC15',
    skirtL: '#1C1917',
    skirtR: '#292524'
  },
  {
    name: 'ULTIMATE MARBLE CITADEL',
    subtitle: 'FINAL ATARI CHAMPIONSHIP FINALE',
    timeLimit: 65,
    flatA: '#7F1D1D',
    flatB: '#450A0A',
    stroke: '#38BDF8',
    skirtL: '#090D16',
    skirtR: '#1E293B'
  }
];

export class MarbleMadness {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'marblemadness';
    this.title = 'Marble Madness';
    this.state = 'PLAYING';

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.totalCourses = COURSE_CATALOG.length;

    this.tileW = 36;
    this.tileH = 18;
    this.elevScale = 16;

    this.courseBannerTimer = 0;
    this.boostCooldown = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';
    this.timeLeft = 50.0;

    this.particles = [];
    this.trail = [];
    this._buildCourse(this.level);
  }

  _getCourseMeta(level = this.level) {
    const idx = (Math.max(1, level) - 1) % COURSE_CATALOG.length;
    return { ...COURSE_CATALOG[idx], index: idx + 1 };
  }

  _buildCourse(level) {
    this.grid = new Map();
    this.tileList = [];
    this.bumpers = [];
    this.hazards = [];
    this.levelClearTimer = 0;
    this.courseBannerTimer = 2.4;
    this.boostCooldown = 0;

    const meta = this._getCourseMeta(level);
    const loopTier = Math.floor((level - 1) / COURSE_CATALOG.length);
    this.courseName = meta.name;
    this.courseSubtitle = meta.subtitle;
    this.courseTheme = meta;
    this.timeLeft = Math.max(32, meta.timeLimit - loopTier * 4);

    const setTile = (gx, gy, z, type = 'flat') => {
      const ix = Math.round(gx);
      const iy = Math.round(gy);
      const key = `${ix},${iy}`;
      const tile = { gx: ix, gy: iy, z, type };
      this.grid.set(key, tile);
    };

    const fillRectTiles = (x0, y0, x1, y1, z, type = 'flat') => {
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1);
      const maxY = Math.max(y0, y1);
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          setTile(x, y, z, type);
        }
      }
    };

    const courseIndex = ((level - 1) % COURSE_CATALOG.length) + 1;
    let startZ = 12;

    if (courseIndex === 1) {
      // =========================================================================
      // COURSE 1: PRACTICE TERRACE (Gentle introduction, wide bridges & slopes)
      // =========================================================================
      let cz = 12;
      fillRectTiles(-1, -1, 2, 2, cz, 'flat');

      // Gentle slopeRight ramp along +x
      let cx = 3;
      for (let step = 0; step < 5; step++) {
        cz -= 0.6;
        fillRectTiles(cx + step, -1, cx + step, 2, cz, 'slopeRight');
      }
      cx += 5;

      // Wide Landing Plaza with 2 friendly bumpers
      fillRectTiles(cx, -1, cx + 4, 3, cz, 'flat');
      this.bumpers.push({ gx: cx + 2, gy: 0.2, z: cz, r: 0.42, pulse: 0 });
      this.bumpers.push({ gx: cx + 2, gy: 2.0, z: cz, r: 0.42, pulse: 0 });

      // Wide slopeLeft cascade heading down +y
      let cy = 4;
      for (let step = 0; step < 5; step++) {
        cz -= 0.6;
        fillRectTiles(cx + 1, cy + step, cx + 4, cy + step, cz, 'slopeLeft');
      }
      cy += 5;

      // Mid Terrace + wide bridge with boost pad
      fillRectTiles(cx + 1, cy, cx + 5, cy + 3, cz, 'flat');
      const bxStart = cx + 6;
      for (let step = 0; step < 6; step++) {
        cz -= 0.35;
        const bx = bxStart + step;
        for (let y = cy; y <= cy + 3; y++) {
          setTile(bx, y, cz, step === 2 && (y === cy + 1 || y === cy + 2) ? 'boost' : 'flat');
        }
      }

      // Large Goal Court
      const gx0 = bxStart + 6;
      fillRectTiles(gx0, cy - 1, gx0 + 5, cy + 4, cz, 'flat');
      fillRectTiles(gx0 + 2, cy, gx0 + 4, cy + 3, cz, 'goal');
    } else if (courseIndex === 2) {
      // =========================================================================
      // COURSE 2: SERPENTINE CHASM (S-Curve switchbacks, boost pads & steel guard)
      // =========================================================================
      let cz = 14;
      startZ = cz;
      fillRectTiles(-1, -1, 2, 2, cz, 'flat');

      // Leg 1: Eastward sprint with speed boost
      for (let x = 3; x <= 8; x++) {
        cz -= 0.45;
        for (let y = 0; y <= 2; y++) {
          setTile(x, y, cz, x === 5 && y === 1 ? 'boost' : 'slopeRight');
        }
      }

      // Turn 1 Plaza (x: 9..12, y: 0..3)
      fillRectTiles(9, 0, 12, 3, cz, 'flat');
      this.bumpers.push({ gx: 11, gy: 1.5, z: cz, r: 0.42, pulse: 0 });

      // Leg 2: Southward slopeLeft chute (x: 9..11, y: 4..9)
      for (let y = 4; y <= 9; y++) {
        cz -= 0.55;
        fillRectTiles(9, y, 11, y, cz, 'slopeLeft');
      }

      // Turn 2 Plaza (x: 8..12, y: 10..13)
      fillRectTiles(8, 10, 12, 13, cz, 'flat');
      this.hazards.push({
        gx: 10,
        gy: 11.5,
        z: cz,
        baseX: 10,
        baseY: 11.5,
        ampX: 1.4,
        ampY: 0.9,
        phase: 0,
        speed: 2.1 + loopTier * 0.4
      });

      // Leg 3: Westward switchback catwalk (x: 3..7, y: 11..13)
      for (let x = 7; x >= 3; x--) {
        cz -= 0.25;
        fillRectTiles(x, 11, x, 13, cz, 'flat');
      }
      this.bumpers.push({ gx: 5, gy: 12, z: cz, r: 0.4, pulse: 0 });

      // Turn 3 Plaza (x: 0..2, y: 10..14)
      fillRectTiles(0, 10, 2, 14, cz, 'flat');

      // Leg 4: Southward diagonal slopeDown drop (x: 0..3, y: 15..20)
      for (let y = 15; y <= 20; y++) {
        cz -= 0.6;
        fillRectTiles(0, y, 3, y, cz, y % 2 === 0 ? 'slopeDown' : 'slopeLeft');
      }

      // Final Eastward Goal Terrace (x: 0..8, y: 21..25)
      fillRectTiles(0, 21, 8, 25, cz, 'flat');
      setTile(3, 23, cz, 'boost');
      setTile(4, 23, cz, 'boost');
      fillRectTiles(5, 22, 7, 24, cz, 'goal');
    } else if (courseIndex === 3) {
      // =========================================================================
      // COURSE 3: BUMPER FORTRESS (Pinball bumper diamond & split chasm island)
      // =========================================================================
      let cz = 15;
      startZ = cz;
      fillRectTiles(-1, -1, 2, 2, cz, 'flat');

      // Steep diagonal slopeDown launch chute
      for (let s = 1; s <= 5; s++) {
        cz -= 0.75;
        fillRectTiles(s, s, s + 2, s + 2, cz, 'slopeDown');
      }

      // Giant Pinball Bumper Arena (x: 6..13, y: 6..13)
      fillRectTiles(6, 6, 13, 13, cz, 'flat');
      const bumperCoords = [
        [8.5, 8.5],
        [10.5, 8.5],
        [9.5, 10.0],
        [8.5, 11.5],
        [10.5, 11.5],
        [11.8, 10.0]
      ];
      for (const [bx, by] of bumperCoords) {
        this.bumpers.push({ gx: bx, gy: by, z: cz, r: 0.44, pulse: 0 });
      }

      // Split Island Bridge around central chasm (x: 14..20, y: 6..13)
      for (let x = 14; x <= 20; x++) {
        cz -= 0.4;
        // Left/North branch (y: 6..8)
        fillRectTiles(x, 6, x, 8, cz, x === 17 ? 'boost' : 'slopeRight');
        // Central chasm (y: 9..10)
        setTile(x, 9, cz - 3, 'chasm');
        setTile(x, 10, cz - 3, 'chasm');
        // Right/South branch (y: 11..13)
        fillRectTiles(x, 11, x, 13, cz, x === 17 ? 'boost' : 'slopeRight');
      }

      // Reconvergence Citadel & Goal (x: 21..27, y: 6..13)
      fillRectTiles(21, 6, 27, 13, cz, 'flat');
      this.hazards.push({
        gx: 22.5,
        gy: 9.5,
        z: cz,
        baseX: 22.5,
        baseY: 9.5,
        ampX: 0.6,
        ampY: 2.4,
        phase: 0,
        speed: 2.5 + loopTier * 0.4
      });
      fillRectTiles(24, 8, 26, 11, cz, 'goal');
    } else if (courseIndex === 4) {
      // =========================================================================
      // COURSE 4: TWIN SKYBRIDGES (Cryo Ice Plazas & Parallel High-Altitude Bridges)
      // =========================================================================
      let cz = 15;
      startZ = cz;
      fillRectTiles(-1, -1, 2, 2, cz, 'flat');

      // Icy entry ramp
      for (let x = 3; x <= 7; x++) {
        cz -= 0.5;
        fillRectTiles(x, -1, x, 2, cz, 'ice');
      }

      // Sky Fork Plaza (x: 8..11, y: -2..4)
      fillRectTiles(8, -2, 11, 4, cz, 'flat');

      // Twin Parallel Skybridges across the abyss (x: 12..20)
      for (let x = 12; x <= 20; x++) {
        cz -= 0.35;
        // Upper Express Bridge (1.5-tile narrow with boost pads)
        setTile(x, -2, cz, x % 3 === 0 ? 'boost' : 'flat');
        setTile(x, -1, cz, x % 3 === 0 ? 'boost' : 'flat');
        // Lower Glacier Bridge (2-tile wide ice bridge with bumpers)
        setTile(x, 2, cz, 'ice');
        setTile(x, 3, cz, 'ice');
        setTile(x, 4, cz, 'ice');
      }
      this.bumpers.push({ gx: 15, gy: 3, z: cz + 1.2, r: 0.4, pulse: 0 });
      this.bumpers.push({ gx: 18, gy: 3, z: cz + 0.5, r: 0.4, pulse: 0 });

      // Confluence Terrace (x: 21..25, y: -2..4)
      fillRectTiles(21, -2, 25, 4, cz, 'flat');
      this.hazards.push({
        gx: 23,
        gy: 1,
        z: cz,
        baseX: 23,
        baseY: 1,
        ampX: 1.0,
        ampY: 2.2,
        phase: 0.7,
        speed: 2.6 + loopTier * 0.4
      });

      // Glacier Slide Southward (+y: 5..11)
      for (let y = 5; y <= 11; y++) {
        cz -= 0.6;
        fillRectTiles(21, y, 25, y, cz, y <= 8 ? 'slopeLeft' : 'ice');
      }

      // Goal Sanctuary (x: 20..26, y: 12..17)
      fillRectTiles(20, 12, 26, 17, cz, 'flat');
      fillRectTiles(22, 14, 24, 16, cz, 'goal');
    } else if (courseIndex === 5) {
      // =========================================================================
      // COURSE 5: VORTEX GAUNTLET (Spiral Funnel Descent & Turbo Straightaway)
      // =========================================================================
      let cz = 16;
      startZ = cz;
      fillRectTiles(-1, -1, 2, 2, cz, 'flat');

      // Spiral Arm 1: East (+x: 3..10, y: -1..1)
      for (let x = 3; x <= 10; x++) {
        cz -= 0.45;
        fillRectTiles(x, -1, x, 1, cz, 'slopeRight');
      }
      fillRectTiles(11, -1, 13, 2, cz, 'flat');
      this.bumpers.push({ gx: 12, gy: 0.5, z: cz, r: 0.42, pulse: 0 });

      // Spiral Arm 2: South (+y: 3..10, x: 11..13)
      for (let y = 3; y <= 10; y++) {
        cz -= 0.45;
        fillRectTiles(11, y, 13, y, cz, 'slopeLeft');
      }
      fillRectTiles(10, 11, 13, 13, cz, 'flat');

      // Spiral Arm 3: West (x: 4..9, y: 11..13) with ice & hazard
      for (let x = 9; x >= 4; x--) {
        cz -= 0.25;
        fillRectTiles(x, 11, x, 13, cz, x % 2 === 0 ? 'ice' : 'flat');
      }
      this.hazards.push({
        gx: 6.5,
        gy: 12,
        z: cz,
        baseX: 6.5,
        baseY: 12,
        ampX: 2.0,
        ampY: 0.6,
        phase: 0,
        speed: 2.7 + loopTier * 0.4
      });
      fillRectTiles(1, 11, 3, 14, cz, 'flat');

      // Spiral Arm 4: South Plunge (y: 15..20, x: 1..3)
      for (let y = 15; y <= 20; y++) {
        cz -= 0.65;
        fillRectTiles(1, y, 3, y, cz, 'slopeDown');
      }
      fillRectTiles(1, 21, 4, 24, cz, 'flat');

      // Turbo Boost Runway Eastward (x: 5..15, y: 21..24)
      for (let x = 5; x <= 15; x++) {
        cz -= 0.35;
        for (let y = 21; y <= 24; y++) {
          const isBoost = (x === 7 || x === 11) && (y === 22 || y === 23);
          setTile(x, y, cz, isBoost ? 'boost' : 'slopeRight');
        }
      }
      this.hazards.push({
        gx: 10,
        gy: 22.5,
        z: cz + 1.5,
        baseX: 10,
        baseY: 22.5,
        ampX: 0.5,
        ampY: 1.3,
        phase: 1.2,
        speed: 3.0 + loopTier * 0.4
      });

      // Goal Platform (x: 16..21, y: 20..25)
      fillRectTiles(16, 20, 21, 25, cz, 'flat');
      fillRectTiles(18, 21, 20, 24, cz, 'goal');
    } else if (courseIndex === 6) {
      // =========================================================================
      // COURSE 6: ZENITH CITADEL (Grand Master Championship Course)
      // =========================================================================
      let cz = 18;
      startZ = cz;
      fillRectTiles(-1, -1, 2, 2, cz, 'flat');

      // 1. High-velocity slopeRight + boost launch
      for (let x = 3; x <= 8; x++) {
        cz -= 0.65;
        for (let y = -1; y <= 1; y++) {
          setTile(x, y, cz, x === 5 && y === 0 ? 'boost' : 'slopeRight');
        }
      }

      // 2. Ice Diamond Arena (x: 9..15, y: -2..4)
      fillRectTiles(9, -2, 15, 4, cz, 'ice');
      fillRectTiles(11, 0, 13, 2, cz, 'flat');
      this.bumpers.push({ gx: 10.5, gy: -0.5, z: cz, r: 0.42, pulse: 0 });
      this.bumpers.push({ gx: 13.5, gy: -0.5, z: cz, r: 0.42, pulse: 0 });
      this.bumpers.push({ gx: 10.5, gy: 2.5, z: cz, r: 0.42, pulse: 0 });
      this.bumpers.push({ gx: 13.5, gy: 2.5, z: cz, r: 0.42, pulse: 0 });
      this.hazards.push({
        gx: 12,
        gy: 1,
        z: cz,
        baseX: 12,
        baseY: 1,
        ampX: 2.2,
        ampY: 1.8,
        phase: 0,
        speed: 2.8 + loopTier * 0.4
      });

      // 3. Steep Southward Cascade (x: 11..13, y: 5..11)
      for (let y = 5; y <= 11; y++) {
        cz -= 0.65;
        fillRectTiles(11, y, 13, y, cz, y % 2 === 0 ? 'slopeDown' : 'slopeLeft');
      }

      // 4. Mid Citadel Checkpoint (x: 10..14, y: 12..15)
      fillRectTiles(10, 12, 14, 15, cz, 'flat');

      // 5. Razor Catwalk Eastward (x: 15..22, y: 13..14)
      for (let x = 15; x <= 22; x++) {
        cz -= 0.4;
        setTile(x, 13, cz, x === 18 ? 'boost' : 'flat');
        setTile(x, 14, cz, x === 18 ? 'boost' : 'flat');
      }

      // 6. Zenith Grand Finale Court (x: 23..30, y: 11..17)
      fillRectTiles(23, 11, 30, 17, cz, 'flat');
      this.bumpers.push({ gx: 25, gy: 12.5, z: cz, r: 0.44, pulse: 0 });
      this.bumpers.push({ gx: 25, gy: 15.5, z: cz, r: 0.44, pulse: 0 });
      this.hazards.push({
        gx: 26,
        gy: 14,
        z: cz,
        baseX: 26,
        baseY: 14,
        ampX: 0.8,
        ampY: 2.2,
        phase: 0.5,
        speed: 3.1 + loopTier * 0.4
      });
      this.hazards.push({
        gx: 27.5,
        gy: 14,
        z: cz,
        baseX: 27.5,
        baseY: 14,
        ampX: 0.6,
        ampY: 2.0,
        phase: 2.6,
        speed: 3.1 + loopTier * 0.4
      });
      fillRectTiles(28, 12, 30, 16, cz, 'goal');
    } else if (courseIndex === 7) {
      // =========================================================================
      // COURSE 7: THE CATAPULT CHASM (High-speed turbo launch bridges & twin gaps)
      // =========================================================================
      let cz = 17;
      startZ = cz;
      fillRectTiles(-1, -1, 2, 2, cz, 'flat');

      // Catapult Launch Runway Eastward (x: 3..11, y: -1..2)
      for (let x = 3; x <= 11; x++) {
        cz -= 0.5;
        for (let y = -1; y <= 2; y++) {
          const isBoost = (x === 5 || x === 8 || x === 10) && (y === 0 || y === 1);
          setTile(x, y, cz, isBoost ? 'boost' : 'slopeRight');
        }
      }

      // Twin Chasm Bypass Plaza (x: 12..18, y: -2..3)
      fillRectTiles(12, -2, 18, 3, cz, 'flat');
      setTile(14, 0, cz - 3, 'chasm');
      setTile(14, 1, cz - 3, 'chasm');
      setTile(16, 0, cz - 3, 'chasm');
      setTile(16, 1, cz - 3, 'chasm');
      this.bumpers.push({ gx: 15, gy: 0.5, z: cz, r: 0.42, pulse: 0 });

      // Southward Steep Chute (x: 14..17, y: 4..11)
      for (let y = 4; y <= 11; y++) {
        cz -= 0.6;
        fillRectTiles(14, y, 17, y, cz, y === 7 ? 'boost' : 'slopeLeft');
      }

      // Catapult Landing Basin & Goal (x: 13..22, y: 12..17)
      fillRectTiles(13, 12, 22, 17, cz, 'flat');
      this.hazards.push({
        gx: 17.5,
        gy: 14.5,
        z: cz,
        baseX: 17.5,
        baseY: 14.5,
        ampX: 2.2,
        ampY: 1.5,
        phase: 0,
        speed: 2.9 + loopTier * 0.4
      });
      fillRectTiles(19, 13, 21, 16, cz, 'goal');
    } else if (courseIndex === 8) {
      // =========================================================================
      // COURSE 8: ICE & ACID GAUNTLET (Slick Glaciers & Toxic Chasm Pools)
      // =========================================================================
      let cz = 17;
      startZ = cz;
      fillRectTiles(-1, -1, 2, 2, cz, 'flat');

      // Icy Descent (x: 3..9, y: -1..2)
      for (let x = 3; x <= 9; x++) {
        cz -= 0.5;
        fillRectTiles(x, -1, x, 2, cz, x % 2 === 0 ? 'ice' : 'slopeRight');
      }

      // Acid Pool Basin (x: 10..18, y: -2..6)
      fillRectTiles(10, -2, 18, 6, cz, 'ice');
      fillRectTiles(12, 0, 13, 1, cz - 3, 'chasm');
      fillRectTiles(15, 2, 16, 3, cz - 3, 'chasm');
      this.bumpers.push({ gx: 11.5, gy: 2.5, z: cz, r: 0.42, pulse: 0 });
      this.bumpers.push({ gx: 16.5, gy: 0.0, z: cz, r: 0.42, pulse: 0 });
      this.hazards.push({
        gx: 14,
        gy: 2,
        z: cz,
        baseX: 14,
        baseY: 2,
        ampX: 2.5,
        ampY: 2.2,
        phase: 0.4,
        speed: 3.0 + loopTier * 0.4
      });

      // Narrow Glacier Sluice Southward (x: 13..15, y: 7..14)
      for (let y = 7; y <= 14; y++) {
        cz -= 0.55;
        fillRectTiles(13, y, 15, y, cz, y % 2 === 0 ? 'ice' : 'slopeDown');
      }

      // Goal Sanctuary (x: 12..19, y: 15..20)
      fillRectTiles(12, 15, 19, 20, cz, 'flat');
      fillRectTiles(15, 16, 18, 19, cz, 'goal');
    } else if (courseIndex === 9) {
      // =========================================================================
      // COURSE 9: SWISS CHEESE LABYRINTH (Perforated Deck & Bumper Maze)
      // =========================================================================
      let cz = 18;
      startZ = cz;
      fillRectTiles(-1, -1, 2, 2, cz, 'flat');

      // Entry Ramp
      for (let x = 3; x <= 6; x++) {
        cz -= 0.5;
        fillRectTiles(x, -1, x, 2, cz, 'slopeRight');
      }

      // Giant Swiss Cheese Perforated Deck (x: 7..19, y: -2..10)
      fillRectTiles(7, -2, 19, 10, cz, 'flat');
      const holes = [
        [9, 0], [12, 1], [15, -1], [17, 2],
        [10, 4], [13, 4], [16, 5],
        [9, 7], [12, 8], [15, 7], [17, 8]
      ];
      for (const [hx, hy] of holes) {
        setTile(hx, hy, cz - 3, 'chasm');
      }
      const bumpers = [
        [10.5, 2], [14.5, 2], [11.5, 6], [15.5, 6]
      ];
      for (const [bx, by] of bumpers) {
        this.bumpers.push({ gx: bx, gy: by, z: cz, r: 0.42, pulse: 0 });
      }
      this.hazards.push({
        gx: 13,
        gy: 2.5,
        z: cz,
        baseX: 13,
        baseY: 2.5,
        ampX: 3.0,
        ampY: 1.2,
        phase: 0,
        speed: 2.8 + loopTier * 0.4
      });
      this.hazards.push({
        gx: 13,
        gy: 6.5,
        z: cz,
        baseX: 13,
        baseY: 6.5,
        ampX: 3.0,
        ampY: 1.2,
        phase: 1.6,
        speed: 2.8 + loopTier * 0.4
      });

      // Exit Boost Bridge & Goal (x: 20..26, y: 3..8)
      for (let x = 20; x <= 23; x++) {
        cz -= 0.4;
        fillRectTiles(x, 4, x, 7, cz, x === 21 ? 'boost' : 'slopeRight');
      }
      fillRectTiles(24, 3, 28, 8, cz, 'flat');
      fillRectTiles(25, 4, 27, 7, cz, 'goal');
    } else {
      // =========================================================================
      // COURSE 10: ULTIMATE MARBLE CITADEL (Final Atari Championship Finale)
      // =========================================================================
      let cz = 20;
      startZ = cz;
      fillRectTiles(-1, -1, 2, 2, cz, 'flat');

      // 1. Lightning Launch Ramp Eastward (x: 3..9, y: -1..1)
      for (let x = 3; x <= 9; x++) {
        cz -= 0.65;
        for (let y = -1; y <= 1; y++) {
          setTile(x, y, cz, (x === 5 || x === 8) && y === 0 ? 'boost' : 'slopeRight');
        }
      }

      // 2. Twin Steel Guard Ice Ring (x: 10..17, y: -3..4)
      fillRectTiles(10, -3, 17, 4, cz, 'ice');
      fillRectTiles(13, 0, 14, 1, cz - 3, 'chasm');
      this.bumpers.push({ gx: 11.5, gy: -1, z: cz, r: 0.44, pulse: 0 });
      this.bumpers.push({ gx: 15.5, gy: -1, z: cz, r: 0.44, pulse: 0 });
      this.bumpers.push({ gx: 11.5, gy: 2, z: cz, r: 0.44, pulse: 0 });
      this.bumpers.push({ gx: 15.5, gy: 2, z: cz, r: 0.44, pulse: 0 });
      this.hazards.push({
        gx: 13.5,
        gy: -1.5,
        z: cz,
        baseX: 13.5,
        baseY: -1.5,
        ampX: 2.4,
        ampY: 0.8,
        phase: 0,
        speed: 3.2 + loopTier * 0.4
      });
      this.hazards.push({
        gx: 13.5,
        gy: 2.5,
        z: cz,
        baseX: 13.5,
        baseY: 2.5,
        ampX: 2.4,
        ampY: 0.8,
        phase: Math.PI,
        speed: 3.2 + loopTier * 0.4
      });

      // 3.Corkscrew Descent Southward (x: 12..15, y: 5..12)
      for (let y = 5; y <= 12; y++) {
        cz -= 0.65;
        fillRectTiles(12, y, 15, y, cz, y % 2 === 0 ? 'slopeDown' : 'slopeLeft');
      }

      // 4. Championship Catwalk Eastward (x: 12..25, y: 13..16)
      fillRectTiles(12, 13, 15, 16, cz, 'flat');
      for (let x = 16; x <= 24; x++) {
        cz -= 0.4;
        setTile(x, 14, cz, x % 3 === 0 ? 'boost' : 'ice');
        setTile(x, 15, cz, x % 3 === 0 ? 'boost' : 'ice');
      }

      // 5. Ultimate Citadel Goal Sanctuary (x: 25..32, y: 12..18)
      fillRectTiles(25, 12, 32, 18, cz, 'flat');
      this.hazards.push({
        gx: 27.5,
        gy: 15,
        z: cz,
        baseX: 27.5,
        baseY: 15,
        ampX: 1.0,
        ampY: 2.4,
        phase: 0.8,
        speed: 3.4 + loopTier * 0.4
      });
      fillRectTiles(29, 13, 31, 17, cz, 'goal');
    }

    // Sort tiles back-to-front by (gx + gy) for painter's algorithm rendering
    this.tileList = Array.from(this.grid.values()).sort((a, b) => a.gx + a.gy - (b.gx + b.gy));

    // Initialize Marble at start platform
    this.marble = {
      gx: 0.5,
      gy: 0.5,
      z: startZ,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 10,
      safeGx: 0.5,
      safeGy: 0.5,
      safeZ: startZ,
      falling: false,
      fallTimer: 0,
      currentTileType: 'flat',
      rollAngle: 0
    };

    this.camera = { x: 0, y: 0 };
    this._updateCamera(1.0);
  }

  _isoProject(gx, gy, z) {
    const sx = (gx - gy) * this.tileW + this.renderer.width / 2 - this.camera.x;
    const sy = (gx + gy) * this.tileH - z * this.elevScale + 230 - this.camera.y;
    return { x: sx, y: sy };
  }

  _updateCamera(lerpFactor = 0.12) {
    const rawX = (this.marble.gx - this.marble.gy) * this.tileW;
    const rawY = (this.marble.gx + this.marble.gy) * this.tileH - this.marble.z * this.elevScale;
    this.camera.x += (rawX - this.camera.x) * lerpFactor;
    this.camera.y += (rawY - this.camera.y) * lerpFactor;
  }

  _getTileAt(gx, gy) {
    const ix = Math.round(gx);
    const iy = Math.round(gy);
    return this.grid.get(`${ix},${iy}`) || null;
  }

  /**
   * Returns the isometric slope gravity vector in grid coordinates for a tile type
   */
  _getSlopeGravityVector(tileType) {
    switch (tileType) {
      case 'slopeDown':
        return new Vector2(2.6, 2.6);
      case 'slopeRight':
        return new Vector2(3.4, 0.4);
      case 'slopeLeft':
        return new Vector2(0.4, 3.4);
      case 'boost':
        return new Vector2(4.5, 1.5);
      case 'ice':
      case 'flat':
      case 'goal':
      default:
        return new Vector2(0, 0);
    }
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.particles = [];
    this.trail = [];
  }

  _spawnParticles(gx, gy, z, color, count = 12) {
    const pt = this._isoProject(gx, gy, z);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 110;
      this.particles.push({
        x: pt.x,
        y: pt.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 30,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        color,
        size: 3 + Math.random() * 3
      });
    }
  }

  update(dt) {
    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        this.input.pointer.justPressed
      ) {
        this.audio.playMenuSelect();
        this.reset();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('pause')) {
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    if (this.courseBannerTimer > 0) {
      this.courseBannerTimer = Math.max(0, this.courseBannerTimer - dt);
    }
    if (this.boostCooldown > 0) {
      this.boostCooldown = Math.max(0, this.boostCooldown - dt);
    }

    // Allow cycling courses directly with Action B (X/Shift) when stationary on start pad, or N key
    if (this.input.isKeyJustPressed('KeyN')) {
      this.level = (this.level % this.totalCourses) + 1;
      this.audio.playMenuSelect();
      this._buildCourse(this.level);
      return;
    }

    if (this.levelClearTimer > 0) {
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) {
        this.level++;
        this._buildCourse(this.level);
      }
      return;
    }

    // Countdown Race Timer
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.lives--;
      if (this.lives <= 0) {
        HighScoreStore.submit(this.id, this.score);
        this.audio.playGameOver();
        this.setState('GAMEOVER');
        return;
      } else {
        this.timeLeft = 22.0;
        this.audio.playHit();
      }
    }

    const m = this.marble;

    // Handle Chasm Fall / Respawn
    if (m.falling) {
      m.fallTimer += dt;
      m.vz -= 26 * dt;
      m.z += m.vz * dt;
      m.gx += m.vx * 0.35 * dt;
      m.gy += m.vy * 0.35 * dt;

      if (m.fallTimer > 0.85) {
        this.lives--;
        if (this.lives <= 0) {
          HighScoreStore.submit(this.id, this.score);
          this.audio.playGameOver();
          this.setState('GAMEOVER');
          return;
        }
        m.gx = m.safeGx;
        m.gy = m.safeGy;
        m.z = m.safeZ;
        m.vx = 0;
        m.vy = 0;
        m.vz = 0;
        m.falling = false;
        m.fallTimer = 0;
        this.trail = [];
        this.audio.playPop();
      }
      this._updateCamera(0.15);
      return;
    }

    // Player Steering (screen-aligned to isometric axes)
    const axis = this.input.getAxis();
    const boost = this.input.isDown('actionA') || this.input.isDown('actionB') ? 1.45 : 1.0;
    const accelStrength = 9.5 * boost;

    // Convert 2D screen input vector into isometric grid acceleration
    const isoAx = (axis.x + axis.y) * 0.7071 * accelStrength;
    const isoAy = (axis.y - axis.x) * 0.7071 * accelStrength;

    // Check current tile under marble
    const tile = this._getTileAt(m.gx, m.gy);
    if (!tile || tile.type === 'chasm') {
      m.falling = true;
      m.fallTimer = 0;
      m.vz = -4;
      m.currentTileType = 'chasm';
      this.audio.playLaser(520, 110, 0.32);
      this.renderer.shake(5, 0.2);
      return;
    }

    m.currentTileType = tile.type;
    m.z += (tile.z - m.z) * Math.min(1, dt * 14);

    // Record safe respawn point on flat tiles
    if (tile.type === 'flat') {
      m.safeGx = tile.gx;
      m.safeGy = tile.gy;
      m.safeZ = tile.z;
    }

    // Boost Pad impulse
    if (tile.type === 'boost' && this.boostCooldown <= 0) {
      this.boostCooldown = 0.25;
      const spd = Math.hypot(m.vx, m.vy);
      if (spd > 0.4) {
        m.vx = (m.vx / spd) * 8.4;
        m.vy = (m.vy / spd) * 8.4;
      } else {
        m.vx += 5.5;
      }
      this.score += 50;
      this.audio.playPowerUp();
      this._spawnParticles(m.gx, m.gy, m.z, PALETTE.GOLD, 10);
    }

    // Apply Isometric Slope Gravity Vector + Player Acceleration
    const slopeGravity = this._getSlopeGravityVector(tile.type);
    m.vx += (isoAx + slopeGravity.x) * dt;
    m.vy += (isoAy + slopeGravity.y) * dt;

    // Track surface damping & momentum cap (ice tiles have much lower friction!)
    const surfaceDrag = tile.type === 'ice' ? 0.65 : 0.28;
    const damping = Math.pow(surfaceDrag, dt);
    m.vx *= damping;
    m.vy *= damping;

    const maxSpeed = tile.type === 'boost' ? 9.5 : boost > 1 ? 8.2 : 6.4;
    const speed = Math.hypot(m.vx, m.vy);
    if (speed > maxSpeed) {
      m.vx = (m.vx / speed) * maxSpeed;
      m.vy = (m.vy / speed) * maxSpeed;
    }

    // Integrate marble grid position
    const prevGx = m.gx;
    const prevGy = m.gy;
    m.gx += m.vx * dt;
    m.gy += m.vy * dt;
    m.rollAngle += speed * dt * 4;

    // Award continuous distance progress points
    if (m.gx + m.gy > prevGx + prevGy + 0.01) {
      this.score += Math.floor((m.gx + m.gy - (prevGx + prevGy)) * 25);
      if (this.score > this.highScore) {
        this.highScore = this.score;
        HighScoreStore.submit(this.id, this.score);
      }
    }

    // Bumper Rebound Collisions
    for (const b of this.bumpers) {
      if (b.pulse > 0) b.pulse = Math.max(0, b.pulse - dt * 3);
      const dx = m.gx - b.gx;
      const dy = m.gy - b.gy;
      const dist = Math.hypot(dx, dy);
      const minDist = b.r + 0.28;
      if (dist < minDist && dist > 0.0001) {
        const nx = dx / dist;
        const ny = dy / dist;
        m.gx = b.gx + nx * minDist;
        m.gy = b.gy + ny * minDist;
        // Reflect velocity + elastic bumper kick
        const dot = m.vx * nx + m.vy * ny;
        m.vx = (m.vx - 2 * dot * nx) * 0.9 + nx * 4.2;
        m.vy = (m.vy - 2 * dot * ny) * 0.9 + ny * 4.2;
        b.pulse = 1.0;
        this.score += 100;
        this.audio.playHop();
        this.renderer.shake(3, 0.08);
        this._spawnParticles(b.gx, b.gy, b.z, PALETTE.PINK, 8);
      }
    }

    // Roaming Enemy Steel Marble Collisions
    for (const h of this.hazards) {
      h.phase += h.speed * dt;
      h.gx = h.baseX + Math.cos(h.phase) * h.ampX;
      h.gy = h.baseY + Math.sin(h.phase) * h.ampY;

      const dx = m.gx - h.gx;
      const dy = m.gy - h.gy;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.56 && dist > 0.0001) {
        const nx = dx / dist;
        const ny = dy / dist;
        m.vx = nx * 6.0;
        m.vy = ny * 6.0;
        this.audio.playShove();
        this.renderer.shake(5, 0.14);
        this._spawnParticles(m.gx, m.gy, m.z, PALETTE.ORANGE, 10);
      }
    }

    // Update ribbon trail
    this.trail.push({ gx: m.gx, gy: m.gy, z: m.z, life: 0.35 });
    if (this.trail.length > 18) this.trail.shift();
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Check Goal Platform Reach!
    if (tile.type === 'goal') {
      const timeBonus = Math.floor(this.timeLeft * 100);
      this.score += 1500 + timeBonus;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        HighScoreStore.submit(this.id, this.score);
      }
      this.audio.playStageClear();
      this._spawnParticles(m.gx, m.gy, m.z, PALETTE.GOLD, 28);
      this.levelClearTimer = 1.8;
    }

    this._updateCamera(0.15);
  }

  _drawIsoTile(ctx, tile) {
    const { gx, gy, z, type } = tile;
    if (type === 'chasm') return;

    const theme = this.courseTheme || COURSE_CATALOG[0];

    // Corner elevation adjustments to visually slant slope tiles
    let zN = z;
    let zE = z;
    let zS = z;
    let zW = z;

    if (type === 'slopeRight') {
      zN += 0.32;
      zW += 0.32;
      zE -= 0.32;
      zS -= 0.32;
    } else if (type === 'slopeLeft') {
      zN += 0.32;
      zE += 0.32;
      zW -= 0.32;
      zS -= 0.32;
    } else if (type === 'slopeDown') {
      zN += 0.38;
      zS -= 0.38;
    }

    const pN = this._isoProject(gx - 0.5, gy - 0.5, zN);
    const pE = this._isoProject(gx + 0.5, gy - 0.5, zE);
    const pS = this._isoProject(gx + 0.5, gy + 0.5, zS);
    const pW = this._isoProject(gx - 0.5, gy + 0.5, zW);

    const skirtDepth = 22;

    // Left vertical skirt face (pW -> pS) with Atari 1984 cliff grid-line shading
    ctx.fillStyle = theme.skirtL;
    ctx.beginPath();
    ctx.moveTo(pW.x, pW.y);
    ctx.lineTo(pS.x, pS.y);
    ctx.lineTo(pS.x, pS.y + skirtDepth);
    ctx.lineTo(pW.x, pW.y + skirtDepth);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Right vertical skirt face (pS -> pE)
    ctx.fillStyle = theme.skirtR;
    ctx.beginPath();
    ctx.moveTo(pS.x, pS.y);
    ctx.lineTo(pE.x, pE.y);
    ctx.lineTo(pE.x, pE.y + skirtDepth);
    ctx.lineTo(pS.x, pS.y + skirtDepth);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Top Isometric Diamond Face
    const checker = Math.abs(gx + gy) % 2 === 0;
    let fill = checker ? theme.flatA : theme.flatB;
    let stroke = theme.stroke;

    if (type === 'slopeRight') {
      fill = checker ? '#0369A1' : '#075985';
      stroke = '#38BDF8';
    } else if (type === 'slopeLeft') {
      fill = checker ? '#0F766E' : '#115E59';
      stroke = PALETTE.GREEN;
    } else if (type === 'slopeDown') {
      fill = checker ? '#6D28D9' : '#4C1D95';
      stroke = PALETTE.PURPLE;
    } else if (type === 'ice') {
      fill = checker ? '#0284C7' : '#0369A1';
      stroke = '#E0F2FE';
    } else if (type === 'boost') {
      fill = '#9A3412';
      stroke = PALETTE.GOLD;
    } else if (type === 'goal') {
      fill = checker ? PALETTE.WHITE : '#0F172A';
      stroke = PALETTE.GOLD;
    }

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(pN.x, pN.y);
    ctx.lineTo(pE.x, pE.y);
    ctx.lineTo(pS.x, pS.y);
    ctx.lineTo(pW.x, pW.y);
    ctx.closePath();
    ctx.fill();

    // Authentic 1984 Atari 2x2 sub-grid contour lines inside each isometric tile
    const midNW = { x: (pN.x + pW.x) * 0.5, y: (pN.y + pW.y) * 0.5 };
    const midES = { x: (pE.x + pS.x) * 0.5, y: (pE.y + pS.y) * 0.5 };
    const midNE = { x: (pN.x + pE.x) * 0.5, y: (pN.y + pE.y) * 0.5 };
    const midWS = { x: (pW.x + pS.x) * 0.5, y: (pW.y + pS.y) * 0.5 };

    if (type === 'goal') {
      // Checkered Finish Tile sub-quadrants
      const center = { x: (pN.x + pS.x) * 0.5, y: (pN.y + pS.y) * 0.5 };
      ctx.fillStyle = checker ? '#0F172A' : PALETTE.GOLD;
      ctx.beginPath();
      ctx.moveTo(pN.x, pN.y);
      ctx.lineTo(midNE.x, midNE.y);
      ctx.lineTo(center.x, center.y);
      ctx.lineTo(midNW.x, midNW.y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(midES.x, midES.y);
      ctx.lineTo(pS.x, pS.y);
      ctx.lineTo(midWS.x, midWS.y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(midNW.x, midNW.y);
      ctx.lineTo(midES.x, midES.y);
      ctx.moveTo(midNE.x, midNE.y);
      ctx.lineTo(midWS.x, midWS.y);
      ctx.stroke();
      ctx.restore();
    }

    // Outer tile border stroke
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(pN.x, pN.y);
    ctx.lineTo(pE.x, pE.y);
    ctx.lineTo(pS.x, pS.y);
    ctx.lineTo(pW.x, pW.y);
    ctx.closePath();
    ctx.stroke();

    // Draw directional chevron on slope & boost tiles
    if (
      type === 'slopeRight' ||
      type === 'slopeLeft' ||
      type === 'slopeDown' ||
      type === 'boost'
    ) {
      const c = this._isoProject(gx, gy, z);
      ctx.strokeStyle = type === 'boost' ? PALETTE.GOLD : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = type === 'boost' ? 2.2 : 1.5;
      ctx.beginPath();
      if (type === 'slopeRight' || type === 'boost') {
        ctx.moveTo(c.x - 4, c.y - 4);
        ctx.lineTo(c.x + 5, c.y + 2);
        ctx.lineTo(c.x - 2, c.y + 5);
      } else if (type === 'slopeLeft') {
        ctx.moveTo(c.x + 4, c.y - 4);
        ctx.lineTo(c.x - 5, c.y + 2);
        ctx.lineTo(c.x + 2, c.y + 5);
      } else {
        ctx.moveTo(c.x - 5, c.y - 2);
        ctx.lineTo(c.x, c.y + 5);
        ctx.lineTo(c.x + 5, c.y - 2);
      }
      ctx.stroke();
    }
  }

  render(ctx = this.renderer.ctx) {
    ctx.fillStyle = PALETTE.BG;
    ctx.fillRect(0, 38, this.renderer.width, this.renderer.height - 38);

    const courseMeta = this._getCourseMeta(this.level);

    // Subtle background isometric wireframe grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(480 + i * 64, 40);
      ctx.lineTo(480 + i * 64 - 500, 540);
      ctx.moveTo(480 + i * 64, 40);
      ctx.lineTo(480 + i * 64 + 500, 540);
      ctx.stroke();
    }

    // Render all Isometric Course Tiles back-to-front
    let goalCenterSumX = 0;
    let goalCenterSumY = 0;
    let goalCenterZ = 0;
    let goalCount = 0;
    for (const tile of this.tileList) {
      this._drawIsoTile(ctx, tile);
      if (tile.type === 'goal') {
        goalCenterSumX += tile.gx;
        goalCenterSumY += tile.gy;
        goalCenterZ = tile.z;
        goalCount++;
      }
    }

    // Checkered START & FINISH Banners on the Isometric Course
    const startTile = this._getTileAt(0, 0);
    if (startTile) {
      const sp = this._isoProject(0.5, -0.8, startTile.z);
      ctx.save();
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sp.x - 24, sp.y);
      ctx.lineTo(sp.x - 24, sp.y - 26);
      ctx.moveTo(sp.x + 24, sp.y);
      ctx.lineTo(sp.x + 24, sp.y - 26);
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(sp.x - 26, sp.y - 38, 52, 14);
      ctx.strokeRect(sp.x - 26, sp.y - 38, 52, 14);
      this.renderer.drawText('START', sp.x, sp.y - 28, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.CYAN,
        align: 'center'
      });
      ctx.restore();
    }

    if (goalCount > 0) {
      const gp = this._isoProject(goalCenterSumX / goalCount, goalCenterSumY / goalCount, goalCenterZ);
      ctx.save();
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(gp.x - 32, gp.y + 4);
      ctx.lineTo(gp.x - 32, gp.y - 32);
      ctx.moveTo(gp.x + 32, gp.y + 4);
      ctx.lineTo(gp.x + 32, gp.y - 32);
      ctx.stroke();

      // Checkered FINISH Banner Header
      ctx.fillStyle = '#090D16';
      ctx.fillRect(gp.x - 36, gp.y - 48, 72, 17);
      for (let c = 0; c < 12; c++) {
        ctx.fillStyle = c % 2 === 0 ? PALETTE.WHITE : '#090D16';
        ctx.fillRect(gp.x - 36 + c * 6, gp.y - 48, 6, 3);
        ctx.fillRect(gp.x - 36 + c * 6, gp.y - 34, 6, 3);
      }
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gp.x - 36, gp.y - 48, 72, 17);
      this.renderer.drawText('FINISH', gp.x, gp.y - 36, {
        font: FONTS.HEADER,
        size: 8.5,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 6
      });
      ctx.restore();
    }

    // Render Bumpers
    for (const b of this.bumpers) {
      const pt = this._isoProject(b.gx, b.gy, b.z);
      const rad = 11 + b.pulse * 5;
      this.renderer.drawGlowCircle(pt.x, pt.y - 5, rad, PALETTE.PINK, 12);
      this.renderer.drawGlowCircle(pt.x, pt.y - 7, rad * 0.55, PALETTE.GOLD, 6);
    }

    // Render Menacing Black/Steel Enemy Marbles
    for (const h of this.hazards) {
      const pt = this._isoProject(h.gx, h.gy, h.z);
      ctx.save();
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y + 2, 10.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Menacing Black/Steel Outer Rim & Dark Gunmetal Sphere
      this.renderer.drawGlowCircle(pt.x, pt.y - 7, 10.5, PALETTE.RED, 8, true);
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 7, 9.5, 0, Math.PI * 2);
      ctx.fill();

      // Rolling crimson/steel equator seam
      ctx.save();
      ctx.translate(pt.x, pt.y - 7);
      ctx.rotate(h.phase * 1.6);
      ctx.strokeStyle = PALETTE.RED;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8.5, 3.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Metallic steel highlight
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(pt.x - 3, pt.y - 10, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Player Marble Trail
    for (const tr of this.trail) {
      const pt = this._isoProject(tr.gx, tr.gy, tr.z);
      ctx.globalAlpha = (tr.life / 0.35) * 0.45;
      ctx.fillStyle = PALETTE.CYAN;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Render Player Marble (Glossy 3D Specular Highlight + Rolling Seam)
    const m = this.marble;
    const mp = this._isoProject(m.gx, m.gy, m.z);
    if (!m.falling) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
      ctx.beginPath();
      ctx.ellipse(mp.x, mp.y + 2, 10.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const r = m.falling ? Math.max(3, m.radius * (1 - m.fallTimer * 0.7)) : m.radius;
    ctx.save();
    // Deep cobalt 3D base + electric cyan inner sphere
    this.renderer.drawGlowCircle(mp.x, mp.y - 7, r, '#0284C7', 14, true);
    ctx.fillStyle = PALETTE.CYAN;
    ctx.beginPath();
    ctx.arc(mp.x - 1, mp.y - 8, r * 0.82, 0, Math.PI * 2);
    ctx.fill();

    // Rolling seam band rotating with marble velocity/rollAngle
    ctx.save();
    ctx.translate(mp.x, mp.y - 7);
    ctx.rotate(m.rollAngle);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.88, r * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Glossy 3D Specular Highlight
    const hx = mp.x - 3.2 + Math.cos(m.rollAngle) * 1.5;
    const hy = mp.y - 10.2 + Math.sin(m.rollAngle) * 1.5;
    ctx.fillStyle = PALETTE.WHITE;
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Render Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Course Status / Intro Banner
    if (this.levelClearTimer > 0) {
      const nextMeta = this._getCourseMeta(this.level + 1);
      this.renderer.drawText(
        `COURSE ${courseMeta.index} CLEAR! NEXT: ${nextMeta.name}`,
        480,
        112,
        {
          font: FONTS.HEADER,
          size: 16,
          color: PALETTE.GOLD,
          align: 'center',
          glow: 12
        }
      );
    } else if (m.falling) {
      this.renderer.drawText('CHASM DROP-OFF!', 480, 112, {
        font: FONTS.HEADER,
        size: 18,
        color: PALETTE.PINK,
        align: 'center',
        glow: 12
      });
    } else if (this.courseBannerTimer > 0) {
      this.renderer.drawText(
        `COURSE ${courseMeta.index}/${this.totalCourses}: ${this.courseName}`,
        480,
        96,
        {
          font: FONTS.HEADER,
          size: 15,
          color: courseMeta.stroke,
          align: 'center',
          glow: 12
        }
      );
      this.renderer.drawText(this.courseSubtitle, 480, 120, {
        font: FONTS.HUD,
        size: 12,
        color: PALETTE.WHITE,
        align: 'center'
      });
    }

    // Tile slope & Course indicator in lower bar
    this.renderer.drawText(
      `COURSE ${courseMeta.index}/${this.totalCourses}: ${this.courseName}  |  SURFACE: ${m.currentTileType.toUpperCase()}  |  [N]: NEXT COURSE`,
      20,
      522,
      {
        font: FONTS.HUD,
        size: 12,
        color: courseMeta.stroke
      }
    );

    // Top HUD
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `TIME:${Math.ceil(this.timeLeft)}s C${courseMeta.index}/${this.totalCourses}`,
      accent: courseMeta.stroke
    });

    // State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '10-COURSE ISOMETRIC 3D ROLLER',
      controls: 'ARROWS/WASD: ROLL  |  Z/SPACE: TURBO SPIN  |  N: SKIP COURSE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default MarbleMadness;
