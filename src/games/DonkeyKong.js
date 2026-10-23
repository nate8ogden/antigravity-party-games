/**
 * DonkeyKong.js
 * Classic 1981 Girder-and-Barrel Platformer for Retro Arcade Studio.
 * Features 6 inclined steel girder tiers, working & broken ladders with foot-bound
 * mounting/dismounting, seeded 30%/70% barrel ladder trajectory logic, flaming oil drum
 * fireball spawns, deterministic jump arcs, dual Hammer powerups, and Pauline rescue stages.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export class DonkeyKong {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'donkeykong';
    this.title = 'Donkey Kong';

    this.width = 960;
    this.height = 540;

    // Deterministic seeded PRNG for barrel trajectories
    this.rngSeed = 0x1981d04b;

    // Physics constants (deterministic jump arc & girder traversal)
    this.walkSpeed = 128;
    this.climbSpeed = 86;
    this.jumpHorizontalSpeed = 118;
    this.jumpImpulse = 248;
    this.gravity = 740;

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.bonusTimer = 5000;
    this.bonusTickAccum = 0;

    this.state = 'PLAYING';
    this.stageClearTimer = 0;
    this.deathTimer = 0;
    this.animTime = 0;

    this.girders = [];
    this.ladders = [];
    this.hammers = [];
    this.bonusItems = [];
    this.barrels = [];
    this.fireballs = [];
    this.particles = [];
    this.popups = [];
    this.barrelIdCounter = 1;

    this.reset();
  }

  /**
   * Deterministic PRNG returning float in [0, 1)
   */
  nextRandom() {
    let t = (this.rngSeed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  setState(nextState) {
    this.state = nextState;
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.rngSeed = 0x1981d04b;
    this.state = 'PLAYING';
    this._initStage(true);
  }

  _buildStageGeometry() {
    const stageType = (this.level - 1) % 8;
    this.stageType = stageType;
    this.stageNames = [
      '25M GIRDERS',
      '50M PIE FACTORY',
      '75M ELEVATORS',
      '100M RIVET TOWER',
      '125M VINE JUNGLE (DK JR.)',
      '150M SPRINGBOARD & TWIN CONVEYORS',
      '175M SPARKY CHAIN FACTORY',
      '200M MASTER RIVET CITADEL'
    ];
    this.stageSubtitle = this.stageNames[stageType];
    this.rivets = [];

    if (stageType === 0) {
      // STAGE 1 (25m): Classic 6 inclined steel girder tiers
      this.girders = [
        { tier: 0, xMin: 110, xMax: 850, yLeft: 514, yRight: 492, rollDir: -1, thickness: 12 },
        { tier: 1, xMin: 110, xMax: 805, yLeft: 418, yRight: 440, rollDir: 1, thickness: 12 },
        { tier: 2, xMin: 155, xMax: 850, yLeft: 368, yRight: 346, rollDir: -1, thickness: 12 },
        { tier: 3, xMin: 110, xMax: 805, yLeft: 274, yRight: 296, rollDir: 1, thickness: 12 },
        { tier: 4, xMin: 155, xMax: 850, yLeft: 224, yRight: 202, rollDir: -1, thickness: 12 },
        { tier: 5, xMin: 110, xMax: 805, yLeft: 132, yRight: 150, rollDir: 1, thickness: 12 },
        { tier: 6, xMin: 360, xMax: 575, yLeft: 84, yRight: 84, rollDir: 0, thickness: 10 }
      ];
      this.ladders = [
        { id: 'L0_A', fromTier: 0, toTier: 1, x: 350, broken: true },
        { id: 'L0_B', fromTier: 0, toTier: 1, x: 755, broken: false },
        { id: 'L1_A', fromTier: 1, toTier: 2, x: 215, broken: false },
        { id: 'L1_B', fromTier: 1, toTier: 2, x: 470, broken: false },
        { id: 'L1_C', fromTier: 1, toTier: 2, x: 650, broken: true },
        { id: 'L2_A', fromTier: 2, toTier: 3, x: 320, broken: true },
        { id: 'L2_B', fromTier: 2, toTier: 3, x: 540, broken: false },
        { id: 'L2_C', fromTier: 2, toTier: 3, x: 755, broken: false },
        { id: 'L3_A', fromTier: 3, toTier: 4, x: 215, broken: false },
        { id: 'L3_B', fromTier: 3, toTier: 4, x: 410, broken: false },
        { id: 'L3_C', fromTier: 3, toTier: 4, x: 675, broken: true },
        { id: 'L4_A', fromTier: 4, toTier: 5, x: 495, broken: true },
        { id: 'L4_B', fromTier: 4, toTier: 5, x: 755, broken: false },
        { id: 'L5_WIN', fromTier: 5, toTier: 6, x: 545, broken: false }
      ];
    } else if (stageType === 1) {
      // STAGE 2 (50m): Pie / Cement Factory — flatter, wide symmetrical conveyor tiers
      this.girders = [
        { tier: 0, xMin: 110, xMax: 850, yLeft: 510, yRight: 504, rollDir: -1, thickness: 12 },
        { tier: 1, xMin: 120, xMax: 840, yLeft: 424, yRight: 432, rollDir: 1, thickness: 12 },
        { tier: 2, xMin: 140, xMax: 820, yLeft: 354, yRight: 346, rollDir: -1, thickness: 12 },
        { tier: 3, xMin: 120, xMax: 840, yLeft: 274, yRight: 282, rollDir: 1, thickness: 12 },
        { tier: 4, xMin: 140, xMax: 820, yLeft: 206, yRight: 198, rollDir: -1, thickness: 12 },
        { tier: 5, xMin: 110, xMax: 830, yLeft: 134, yRight: 144, rollDir: 1, thickness: 12 },
        { tier: 6, xMin: 360, xMax: 575, yLeft: 84, yRight: 84, rollDir: 0, thickness: 10 }
      ];
      this.ladders = [
        { id: 'L0_A', fromTier: 0, toTier: 1, x: 185, broken: false },
        { id: 'L0_B', fromTier: 0, toTier: 1, x: 480, broken: true },
        { id: 'L0_C', fromTier: 0, toTier: 1, x: 775, broken: false },
        { id: 'L1_A', fromTier: 1, toTier: 2, x: 290, broken: false },
        { id: 'L1_B', fromTier: 1, toTier: 2, x: 670, broken: false },
        { id: 'L2_A', fromTier: 2, toTier: 3, x: 185, broken: false },
        { id: 'L2_B', fromTier: 2, toTier: 3, x: 480, broken: false },
        { id: 'L2_C', fromTier: 2, toTier: 3, x: 775, broken: false },
        { id: 'L3_A', fromTier: 3, toTier: 4, x: 290, broken: false },
        { id: 'L3_B', fromTier: 3, toTier: 4, x: 480, broken: true },
        { id: 'L3_C', fromTier: 3, toTier: 4, x: 670, broken: false },
        { id: 'L4_A', fromTier: 4, toTier: 5, x: 220, broken: false },
        { id: 'L4_B', fromTier: 4, toTier: 5, x: 740, broken: false },
        { id: 'L5_WIN', fromTier: 5, toTier: 6, x: 545, broken: false }
      ];
    } else if (stageType === 2) {
      // STAGE 3 (75m): Elevators & Stepped Promenade — steeper alternating switchbacks
      this.girders = [
        { tier: 0, xMin: 110, xMax: 850, yLeft: 516, yRight: 488, rollDir: -1, thickness: 12 },
        { tier: 1, xMin: 130, xMax: 820, yLeft: 412, yRight: 442, rollDir: 1, thickness: 12 },
        { tier: 2, xMin: 140, xMax: 850, yLeft: 368, yRight: 338, rollDir: -1, thickness: 12 },
        { tier: 3, xMin: 110, xMax: 810, yLeft: 268, yRight: 298, rollDir: 1, thickness: 12 },
        { tier: 4, xMin: 140, xMax: 850, yLeft: 224, yRight: 196, rollDir: -1, thickness: 12 },
        { tier: 5, xMin: 110, xMax: 810, yLeft: 130, yRight: 152, rollDir: 1, thickness: 12 },
        { tier: 6, xMin: 360, xMax: 575, yLeft: 84, yRight: 84, rollDir: 0, thickness: 10 }
      ];
      this.ladders = [
        { id: 'L0_A', fromTier: 0, toTier: 1, x: 260, broken: false },
        { id: 'L0_B', fromTier: 0, toTier: 1, x: 580, broken: true },
        { id: 'L0_C', fromTier: 0, toTier: 1, x: 780, broken: false },
        { id: 'L1_A', fromTier: 1, toTier: 2, x: 190, broken: false },
        { id: 'L1_B', fromTier: 1, toTier: 2, x: 420, broken: true },
        { id: 'L1_C', fromTier: 1, toTier: 2, x: 690, broken: false },
        { id: 'L2_A', fromTier: 2, toTier: 3, x: 260, broken: false },
        { id: 'L2_B', fromTier: 2, toTier: 3, x: 510, broken: false },
        { id: 'L2_C', fromTier: 2, toTier: 3, x: 760, broken: true },
        { id: 'L3_A', fromTier: 3, toTier: 4, x: 190, broken: false },
        { id: 'L3_B', fromTier: 3, toTier: 4, x: 460, broken: false },
        { id: 'L3_C', fromTier: 3, toTier: 4, x: 720, broken: false },
        { id: 'L4_A', fromTier: 4, toTier: 5, x: 350, broken: true },
        { id: 'L4_B', fromTier: 4, toTier: 5, x: 760, broken: false },
        { id: 'L5_WIN', fromTier: 5, toTier: 6, x: 545, broken: false }
      ];
    } else if (stageType === 3) {
      // STAGE 4 (100m): Rivet Tower — pyramid-narrowing steel tiers with 8 golden rivets
      this.girders = [
        { tier: 0, xMin: 100, xMax: 860, yLeft: 512, yRight: 500, rollDir: -1, thickness: 12 },
        { tier: 1, xMin: 125, xMax: 835, yLeft: 424, yRight: 436, rollDir: 1, thickness: 12 },
        { tier: 2, xMin: 150, xMax: 810, yLeft: 356, yRight: 344, rollDir: -1, thickness: 12 },
        { tier: 3, xMin: 175, xMax: 785, yLeft: 276, yRight: 288, rollDir: 1, thickness: 12 },
        { tier: 4, xMin: 200, xMax: 760, yLeft: 212, yRight: 200, rollDir: -1, thickness: 12 },
        { tier: 5, xMin: 160, xMax: 800, yLeft: 134, yRight: 146, rollDir: 1, thickness: 12 },
        { tier: 6, xMin: 360, xMax: 575, yLeft: 84, yRight: 84, rollDir: 0, thickness: 10 }
      ];
      this.ladders = [
        { id: 'L0_A', fromTier: 0, toTier: 1, x: 165, broken: false },
        { id: 'L0_B', fromTier: 0, toTier: 1, x: 480, broken: false },
        { id: 'L0_C', fromTier: 0, toTier: 1, x: 795, broken: false },
        { id: 'L1_A', fromTier: 1, toTier: 2, x: 210, broken: false },
        { id: 'L1_B', fromTier: 1, toTier: 2, x: 480, broken: true },
        { id: 'L1_C', fromTier: 1, toTier: 2, x: 750, broken: false },
        { id: 'L2_A', fromTier: 2, toTier: 3, x: 245, broken: false },
        { id: 'L2_B', fromTier: 2, toTier: 3, x: 480, broken: false },
        { id: 'L2_C', fromTier: 2, toTier: 3, x: 715, broken: false },
        { id: 'L3_A', fromTier: 3, toTier: 4, x: 275, broken: false },
        { id: 'L3_B', fromTier: 3, toTier: 4, x: 480, broken: true },
        { id: 'L3_C', fromTier: 3, toTier: 4, x: 685, broken: false },
        { id: 'L4_A', fromTier: 4, toTier: 5, x: 310, broken: false },
        { id: 'L4_B', fromTier: 4, toTier: 5, x: 650, broken: false },
        { id: 'L5_WIN', fromTier: 5, toTier: 6, x: 545, broken: false }
      ];
      for (let t = 1; t <= 4; t++) {
        this.rivets.push({ tier: t, x: 350, pulled: false });
        this.rivets.push({ tier: t, x: 610, pulled: false });
      }
    } else if (stageType === 4) {
      // STAGE 5 (125m): Vine Jungle — DK Jr. Stage 1 (Slanted jungle turf platforms + hanging climbable vines + Snapjaws)
      this.girders = [
        { tier: 0, xMin: 100, xMax: 860, yLeft: 514, yRight: 496, rollDir: -1, thickness: 14 },
        { tier: 1, xMin: 120, xMax: 810, yLeft: 416, yRight: 438, rollDir: 1, thickness: 14 },
        { tier: 2, xMin: 150, xMax: 855, yLeft: 362, yRight: 342, rollDir: -1, thickness: 14 },
        { tier: 3, xMin: 115, xMax: 815, yLeft: 272, yRight: 294, rollDir: 1, thickness: 14 },
        { tier: 4, xMin: 150, xMax: 855, yLeft: 220, yRight: 198, rollDir: -1, thickness: 14 },
        { tier: 5, xMin: 110, xMax: 815, yLeft: 132, yRight: 148, rollDir: 1, thickness: 14 },
        { tier: 6, xMin: 355, xMax: 580, yLeft: 84, yRight: 84, rollDir: 0, thickness: 12 }
      ];
      this.ladders = [
        { id: 'V0_A', fromTier: 0, toTier: 1, x: 220, broken: false },
        { id: 'V0_B', fromTier: 0, toTier: 1, x: 510, broken: false },
        { id: 'V0_C', fromTier: 0, toTier: 1, x: 765, broken: false },
        { id: 'V1_A', fromTier: 1, toTier: 2, x: 185, broken: false },
        { id: 'V1_B', fromTier: 1, toTier: 2, x: 430, broken: true },
        { id: 'V1_C', fromTier: 1, toTier: 2, x: 695, broken: false },
        { id: 'V2_A', fromTier: 2, toTier: 3, x: 280, broken: false },
        { id: 'V2_B', fromTier: 2, toTier: 3, x: 560, broken: false },
        { id: 'V2_C', fromTier: 2, toTier: 3, x: 775, broken: false },
        { id: 'V3_A', fromTier: 3, toTier: 4, x: 195, broken: false },
        { id: 'V3_B', fromTier: 3, toTier: 4, x: 465, broken: false },
        { id: 'V3_C', fromTier: 3, toTier: 4, x: 720, broken: true },
        { id: 'V4_A', fromTier: 4, toTier: 5, x: 340, broken: false },
        { id: 'V4_B', fromTier: 4, toTier: 5, x: 760, broken: false },
        { id: 'V5_WIN', fromTier: 5, toTier: 6, x: 545, broken: false }
      ];
    } else if (stageType === 5) {
      // STAGE 6 (150m): Springboard & Twin Conveyors — Dual-tier opposing conveyor belts with center ladder gaps
      this.girders = [
        { tier: 0, xMin: 105, xMax: 855, yLeft: 510, yRight: 510, rollDir: -1, thickness: 12 },
        { tier: 1, xMin: 115, xMax: 845, yLeft: 430, yRight: 430, rollDir: 1, thickness: 12 },
        { tier: 2, xMin: 130, xMax: 830, yLeft: 352, yRight: 352, rollDir: -1, thickness: 12 },
        { tier: 3, xMin: 115, xMax: 845, yLeft: 276, yRight: 276, rollDir: 1, thickness: 12 },
        { tier: 4, xMin: 130, xMax: 830, yLeft: 202, yRight: 202, rollDir: -1, thickness: 12 },
        { tier: 5, xMin: 110, xMax: 835, yLeft: 134, yRight: 142, rollDir: 1, thickness: 12 },
        { tier: 6, xMin: 360, xMax: 575, yLeft: 84, yRight: 84, rollDir: 0, thickness: 10 }
      ];
      this.ladders = [
        { id: 'C0_A', fromTier: 0, toTier: 1, x: 160, broken: false },
        { id: 'C0_B', fromTier: 0, toTier: 1, x: 480, broken: false },
        { id: 'C0_C', fromTier: 0, toTier: 1, x: 800, broken: false },
        { id: 'C1_A', fromTier: 1, toTier: 2, x: 260, broken: false },
        { id: 'C1_B', fromTier: 1, toTier: 2, x: 480, broken: true },
        { id: 'C1_C', fromTier: 1, toTier: 2, x: 700, broken: false },
        { id: 'C2_A', fromTier: 2, toTier: 3, x: 175, broken: false },
        { id: 'C2_B', fromTier: 2, toTier: 3, x: 480, broken: false },
        { id: 'C2_C', fromTier: 2, toTier: 3, x: 785, broken: false },
        { id: 'C3_A', fromTier: 3, toTier: 4, x: 260, broken: false },
        { id: 'C3_B', fromTier: 3, toTier: 4, x: 480, broken: true },
        { id: 'C3_C', fromTier: 3, toTier: 4, x: 700, broken: false },
        { id: 'C4_A', fromTier: 4, toTier: 5, x: 205, broken: false },
        { id: 'C4_B', fromTier: 4, toTier: 5, x: 480, broken: false },
        { id: 'C4_C', fromTier: 4, toTier: 5, x: 755, broken: false },
        { id: 'C5_WIN', fromTier: 5, toTier: 6, x: 545, broken: false }
      ];
    } else if (stageType === 6) {
      // STAGE 7 (175m): Sparky Chain Factory — High-voltage girder network with 4 vertical climbing chains
      this.girders = [
        { tier: 0, xMin: 110, xMax: 850, yLeft: 515, yRight: 490, rollDir: -1, thickness: 12 },
        { tier: 1, xMin: 110, xMax: 825, yLeft: 416, yRight: 440, rollDir: 1, thickness: 12 },
        { tier: 2, xMin: 135, xMax: 850, yLeft: 366, yRight: 342, rollDir: -1, thickness: 12 },
        { tier: 3, xMin: 110, xMax: 825, yLeft: 270, yRight: 294, rollDir: 1, thickness: 12 },
        { tier: 4, xMin: 135, xMax: 850, yLeft: 220, yRight: 196, rollDir: -1, thickness: 12 },
        { tier: 5, xMin: 110, xMax: 825, yLeft: 130, yRight: 150, rollDir: 1, thickness: 12 },
        { tier: 6, xMin: 360, xMax: 575, yLeft: 84, yRight: 84, rollDir: 0, thickness: 10 }
      ];
      this.ladders = [
        { id: 'S0_A', fromTier: 0, toTier: 1, x: 190, broken: false },
        { id: 'S0_B', fromTier: 0, toTier: 1, x: 385, broken: false },
        { id: 'S0_C', fromTier: 0, toTier: 1, x: 580, broken: true },
        { id: 'S0_D', fromTier: 0, toTier: 1, x: 775, broken: false },
        { id: 'S1_A', fromTier: 1, toTier: 2, x: 190, broken: false },
        { id: 'S1_B', fromTier: 1, toTier: 2, x: 385, broken: true },
        { id: 'S1_C', fromTier: 1, toTier: 2, x: 580, broken: false },
        { id: 'S1_D', fromTier: 1, toTier: 2, x: 775, broken: false },
        { id: 'S2_A', fromTier: 2, toTier: 3, x: 190, broken: false },
        { id: 'S2_B', fromTier: 2, toTier: 3, x: 385, broken: false },
        { id: 'S2_C', fromTier: 2, toTier: 3, x: 580, broken: false },
        { id: 'S2_D', fromTier: 2, toTier: 3, x: 775, broken: true },
        { id: 'S3_A', fromTier: 3, toTier: 4, x: 190, broken: false },
        { id: 'S3_B', fromTier: 3, toTier: 4, x: 385, broken: false },
        { id: 'S3_C', fromTier: 3, toTier: 4, x: 580, broken: true },
        { id: 'S3_D', fromTier: 3, toTier: 4, x: 775, broken: false },
        { id: 'S4_A', fromTier: 4, toTier: 5, x: 260, broken: false },
        { id: 'S4_B', fromTier: 4, toTier: 5, x: 520, broken: true },
        { id: 'S4_C', fromTier: 4, toTier: 5, x: 775, broken: false },
        { id: 'S5_WIN', fromTier: 5, toTier: 6, x: 545, broken: false }
      ];
    } else {
      // STAGE 8 (200m): Master Rivet Citadel — 6-tier narrow rivet tower with 10 golden rivets to pull out!
      this.girders = [
        { tier: 0, xMin: 95, xMax: 865, yLeft: 512, yRight: 502, rollDir: -1, thickness: 12 },
        { tier: 1, xMin: 120, xMax: 840, yLeft: 426, yRight: 436, rollDir: 1, thickness: 12 },
        { tier: 2, xMin: 145, xMax: 815, yLeft: 356, yRight: 346, rollDir: -1, thickness: 12 },
        { tier: 3, xMin: 170, xMax: 790, yLeft: 278, yRight: 288, rollDir: 1, thickness: 12 },
        { tier: 4, xMin: 195, xMax: 765, yLeft: 210, yRight: 200, rollDir: -1, thickness: 12 },
        { tier: 5, xMin: 155, xMax: 805, yLeft: 134, yRight: 144, rollDir: 1, thickness: 12 },
        { tier: 6, xMin: 360, xMax: 575, yLeft: 84, yRight: 84, rollDir: 0, thickness: 10 }
      ];
      this.ladders = [
        { id: 'M0_A', fromTier: 0, toTier: 1, x: 155, broken: false },
        { id: 'M0_B', fromTier: 0, toTier: 1, x: 480, broken: false },
        { id: 'M0_C', fromTier: 0, toTier: 1, x: 805, broken: false },
        { id: 'M1_A', fromTier: 1, toTier: 2, x: 200, broken: false },
        { id: 'M1_B', fromTier: 1, toTier: 2, x: 480, broken: true },
        { id: 'M1_C', fromTier: 1, toTier: 2, x: 760, broken: false },
        { id: 'M2_A', fromTier: 2, toTier: 3, x: 240, broken: false },
        { id: 'M2_B', fromTier: 2, toTier: 3, x: 480, broken: false },
        { id: 'M2_C', fromTier: 2, toTier: 3, x: 720, broken: false },
        { id: 'M3_A', fromTier: 3, toTier: 4, x: 275, broken: false },
        { id: 'M3_B', fromTier: 3, toTier: 4, x: 480, broken: true },
        { id: 'M3_C', fromTier: 3, toTier: 4, x: 685, broken: false },
        { id: 'M4_A', fromTier: 4, toTier: 5, x: 305, broken: false },
        { id: 'M4_B', fromTier: 4, toTier: 5, x: 655, broken: false },
        { id: 'M5_WIN', fromTier: 5, toTier: 6, x: 545, broken: false }
      ];
      for (let t = 1; t <= 5; t++) {
        this.rivets.push({ tier: t, x: 345, pulled: false });
        this.rivets.push({ tier: t, x: 615, pulled: false });
      }
    }
  }

  /**
   * Computes exact sloped Y surface coordinate for a girder tier at horizontal coordinate x
   */
  getGirderY(tier, x) {
    const g = this.girders[tier];
    if (!g) return 514;
    const clampedX = Math.max(g.xMin, Math.min(g.xMax, x));
    const t = (clampedX - g.xMin) / Math.max(1, g.xMax - g.xMin);
    return g.yLeft + (g.yRight - g.yLeft) * t;
  }

  /**
   * Finds the highest girder tier directly supporting (x, footY) within tolerance
   */
  findGirderAt(x, footY, tolerance = 14) {
    for (let i = this.girders.length - 1; i >= 0; i--) {
      const g = this.girders[i];
      if (x >= g.xMin - 6 && x <= g.xMax + 6) {
        const gy = this.getGirderY(i, x);
        if (Math.abs(footY - gy) <= tolerance) {
          return i;
        }
      }
    }
    return -1;
  }

  _initStage(fullReset = false) {
    this._buildStageGeometry();

    this.bonusTimer = Math.max(3000, 4000 + this.level * 1000);
    this.bonusTickAccum = 0;
    this.stageClearTimer = 0;
    this.deathTimer = 0;

    // Player (Jumpman) state — y represents exact foot position
    const startX = 215;
    this.player = {
      x: startX,
      y: this.getGirderY(0, startX),
      vx: 0,
      vy: 0,
      jumpVx: 0,
      tier: 0,
      facing: 1,
      onLadder: false,
      currentLadder: null,
      jumping: false,
      jumpedBarrels: new Set(),
      hammerTimer: 0,
      hammerSwingPhase: 0,
      walkCycle: 0
    };

    // Donkey Kong state at top-left of Tier 5
    this.kong = {
      x: 195,
      y: this.getGirderY(5, 195),
      pose: 'IDLE', // 'IDLE' | 'GRAB' | 'ROLL' | 'BEAT_CHEST'
      throwTimer: 1.15,
      throwInterval: Math.max(1.55, 2.75 - (this.level - 1) * 0.22),
      animTimer: 0
    };

    // Pauline on Tier 6
    this.pauline = {
      x: 425,
      y: this.getGirderY(6, 425),
      helpTimer: 0
    };

    // Oil drum at bottom-left of Tier 0
    this.oilDrum = {
      x: 145,
      y: this.getGirderY(0, 145),
      lit: true,
      flamePhase: 0
    };

    // Two classic Hammer powerups
    this.hammers = [
      {
        id: 'H1',
        tier: 1,
        x: 285,
        y: this.getGirderY(1, 285) - 36,
        collected: false
      },
      {
        id: 'H2',
        tier: 4,
        x: 295,
        y: this.getGirderY(4, 295) - 36,
        collected: false
      }
    ];

    // Pauline's bonus items on girders
    this.bonusItems = [
      {
        type: 'PARASOL',
        points: 300,
        x: 685,
        y: this.getGirderY(2, 685) - 14,
        collected: false,
        color: PALETTE.PINK
      },
      {
        type: 'PURSE',
        points: 500,
        x: 625,
        y: this.getGirderY(4, 625) - 12,
        collected: false,
        color: PALETTE.GOLD
      },
      {
        type: 'HAT',
        points: 800,
        x: 340,
        y: this.getGirderY(5, 340) - 12,
        collected: false,
        color: PALETTE.CYAN
      }
    ];

    this.barrels = [];
    this.fireballs = [];
    this.particles = [];
    if (fullReset) {
      this.popups = [];
    }

    // Spawn an initial rolling barrel so action starts immediately
    this._spawnBarrel(false);
  }

  _addScore(points, x, y, color = PALETTE.GOLD) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (typeof x === 'number' && typeof y === 'number') {
      this.popups.push({
        text: `+${points}`,
        x,
        y,
        vy: -38,
        life: 0.95,
        maxLife: 0.95,
        color
      });
    }
  }

  _spawnSparks(x, y, color = PALETTE.GOLD, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (this.nextRandom() - 0.5) * 0.4;
      const speed = 45 + this.nextRandom() * 115;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.35 + this.nextRandom() * 0.25,
        maxLife: 0.6,
        size: 2 + Math.floor(this.nextRandom() * 3),
        color
      });
    }
  }

  _spawnBarrel(forceBlue = false) {
    const blueChance = this.stageType === 6 ? 0.55 : 0.18;
    const isBlue = forceBlue || this.nextRandom() < blueChance;
    const spawnX = this.kong.x + 36;
    const spawnY = this.getGirderY(5, spawnX);
    this.barrels.push({
      id: this.barrelIdCounter++,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      tier: 5,
      dir: 1,
      state: 'ROLLING', // 'ROLLING' | 'LADDER' | 'FALLING'
      targetTier: 5,
      ladderX: 0,
      isBlue,
      rot: 0,
      lastTestedLadderId: null
    });
  }

  _spawnFireball() {
    const maxFireballs = Math.min(5, 2 + this.level);
    if (this.fireballs.length >= maxFireballs) return;

    const startX = this.oilDrum.x + 28;
    this.fireballs.push({
      x: startX,
      y: this.getGirderY(0, startX),
      tier: 0,
      dir: 1,
      onLadder: false,
      currentLadder: null,
      climbDir: -1, // -1 = climbing up, 1 = climbing down
      phase: this.nextRandom() * Math.PI * 2,
      decisionCooldown: 0.4
    });
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.animTime += clampedDt;

    // Handle state transitions
    if (this.input.isJustPressed('pause')) {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        this.audio.playMenuSelect();
        return;
      } else if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this.audio.playMenuSelect();
        return;
      }
    }

    if (this.state === 'MENU') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA')) {
        this.audio.playMenuSelect();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    // Update particles & floating score popups even during brief stage clear / death sequences
    this._updateParticlesAndPopups(clampedDt);

    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= clampedDt;
      if (this.stageClearTimer <= 0) {
        this.level += 1;
        this._initStage(false);
      }
      return;
    }

    if (this.deathTimer > 0) {
      this.deathTimer -= clampedDt;
      if (this.deathTimer <= 0) {
        this.lives -= 1;
        if (this.lives <= 0) {
          HighScoreStore.submit(this.id, this.score);
          this.state = 'GAMEOVER';
          this.audio.playGameOver();
        } else {
          this._initStage(false);
        }
      }
      return;
    }

    // Bonus countdown timer
    this.bonusTickAccum += clampedDt;
    if (this.bonusTickAccum >= 2.0) {
      this.bonusTickAccum -= 2.0;
      this.bonusTimer = Math.max(0, this.bonusTimer - 100);
    }

    this._updateKong(clampedDt);
    this._updatePlayer(clampedDt);
    this._updateBarrels(clampedDt);
    this._updateFireballs(clampedDt);
    this._checkPickupsAndCombat();
  }

  _updateParticlesAndPopups(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y += pop.vy * dt;
      pop.life -= dt;
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
      }
    }
  }

  _updateKong(dt) {
    this.kong.animTimer += dt;
    this.kong.throwTimer -= dt;
    this.oilDrum.flamePhase += dt * 9;
    this.pauline.helpTimer += dt;

    if (this.kong.throwTimer <= 0.65 && this.kong.throwTimer > 0.25) {
      this.kong.pose = 'GRAB';
    } else if (this.kong.throwTimer <= 0.25 && this.kong.throwTimer > 0) {
      this.kong.pose = 'ROLL';
    } else if (this.kong.throwTimer <= 0) {
      this._spawnBarrel();
      this.kong.throwTimer = this.kong.throwInterval;
      this.kong.pose = 'BEAT_CHEST';
    } else if (this.kong.throwTimer < this.kong.throwInterval - 0.45) {
      this.kong.pose = 'IDLE';
    }
  }

  _updatePlayer(dt) {
    const p = this.player;

    if (p.hammerTimer > 0) {
      p.hammerTimer = Math.max(0, p.hammerTimer - dt);
      p.hammerSwingPhase += dt * 22;
    }

    const moveX = (this.input.isDown('right') ? 1 : 0) - (this.input.isDown('left') ? 1 : 0);
    const moveY = (this.input.isDown('down') ? 1 : 0) - (this.input.isDown('up') ? 1 : 0);

    // 1. Ladder climbing and foot-position bounds detachment check
    if (p.onLadder && p.currentLadder) {
      const ladder = p.currentLadder;
      const topY = this.getGirderY(ladder.toTier, ladder.x);
      const bottomY = this.getGirderY(ladder.fromTier, ladder.x);

      p.x = ladder.x;
      if (moveY !== 0) {
        p.y += moveY * this.climbSpeed * dt;
        p.walkCycle += dt * 10;
      }

      // Check foot-position bounds at top and bottom girder surfaces
      const playerFootY = p.y;
      if (playerFootY <= topY) {
        p.y = topY;
        p.tier = ladder.toTier;
        p.onLadder = false;
        p.currentLadder = null;
        if (p.tier === 6) {
          this._triggerStageClear();
        }
        return;
      }
      if (playerFootY >= bottomY) {
        p.y = bottomY;
        p.tier = ladder.fromTier;
        p.onLadder = false;
        p.currentLadder = null;
        return;
      }

      // Allow smooth horizontal dismount when player's feet are right at either girder surface
      if (moveX !== 0) {
        if (Math.abs(playerFootY - bottomY) <= 7) {
          p.y = bottomY;
          p.tier = ladder.fromTier;
          p.onLadder = false;
          p.currentLadder = null;
        } else if (Math.abs(playerFootY - topY) <= 7) {
          p.y = topY;
          p.tier = ladder.toTier;
          p.onLadder = false;
          p.currentLadder = null;
          if (p.tier === 6) {
            this._triggerStageClear();
          }
        }
      }
      return;
    }

    // 2. Discrete jump arc with deterministic horizontal impulse locked at take-off
    if (p.jumping) {
      p.x += p.jumpVx * dt;
      const g = this.girders[p.tier];
      p.x = Math.max(g.xMin + 8, Math.min(g.xMax - 8, p.x));

      p.y += p.vy * dt;
      p.vy += this.gravity * dt;

      // Detect barrels jumped cleanly over while airborne
      for (const b of this.barrels) {
        if (
          Math.abs(b.x - p.x) < 22 &&
          b.y >= p.y &&
          b.y - p.y < 54
        ) {
          p.jumpedBarrels.add(b.id);
        }
      }

      const surfaceY = this.getGirderY(p.tier, p.x);
      if (p.vy > 0 && p.y >= surfaceY) {
        p.y = surfaceY;
        p.vy = 0;
        p.jumpVx = 0;
        p.jumping = false;

        if (p.jumpedBarrels.size > 0) {
          const count = p.jumpedBarrels.size;
          const bonus = count === 1 ? 100 : count === 2 ? 300 : 500;
          this._addScore(bonus, p.x, p.y - 28, PALETTE.CYAN);
          if (typeof this.audio.playBarrelJump === 'function') {
            this.audio.playBarrelJump();
          } else {
            this.audio.playCoin();
          }
          p.jumpedBarrels.clear();
        }
      }
      return;
    }

    // 3. Check for mounting working ladders (disabled during Hammer Mode)
    if (p.hammerTimer <= 0) {
      if (this.input.isDown('up')) {
        const upLadder = this.ladders.find(
          (l) => !l.broken && l.fromTier === p.tier && Math.abs(l.x - p.x) <= 14
        );
        if (upLadder) {
          p.onLadder = true;
          p.currentLadder = upLadder;
          p.x = upLadder.x;
          p.y = this.getGirderY(upLadder.fromTier, upLadder.x) - 2;
          return;
        }
      }

      if (this.input.isDown('down')) {
        const downLadder = this.ladders.find(
          (l) => !l.broken && l.toTier === p.tier && Math.abs(l.x - p.x) <= 14
        );
        if (downLadder) {
          p.onLadder = true;
          p.currentLadder = downLadder;
          p.x = downLadder.x;
          p.y = this.getGirderY(downLadder.toTier, downLadder.x) + 2;
          return;
        }
      }

      // Trigger discrete jump arc
      if (this.input.isJustPressed('actionA')) {
        p.jumping = true;
        p.jumpVx = moveX * this.jumpHorizontalSpeed;
        if (moveX !== 0) p.facing = moveX;
        p.vy = -this.jumpImpulse;
        p.jumpedBarrels.clear();
        this.audio.playJump();
        return;
      }
    }

    // 4. Walking along inclined girder surface
    const girder = this.girders[p.tier];
    if (moveX !== 0) {
      const prevStep = Math.floor(p.walkCycle * 0.5);
      p.facing = moveX;
      p.x += moveX * this.walkSpeed * dt;
      p.walkCycle += dt * 12;
      const nextStep = Math.floor(p.walkCycle * 0.5);
      if (nextStep !== prevStep && typeof this.audio.playWalkStomp === 'function') {
        this.audio.playWalkStomp(nextStep);
      }
    }

    // Handle girder edge boundaries (walking off edge drops to lower tier if available)
    if (p.x < girder.xMin) {
      if (p.tier > 0 && p.x < girder.xMin - 4) {
        p.tier -= 1;
      } else {
        p.x = girder.xMin;
      }
    } else if (p.x > girder.xMax) {
      if (p.tier > 0 && p.x > girder.xMax + 4) {
        p.tier -= 1;
      } else {
        p.x = girder.xMax;
      }
    }

    // Snap foot position to the inclined girder slope
    p.y = this.getGirderY(p.tier, p.x);
  }

  _updateBarrels(dt) {
    const rollSpeed = 148 + (this.level - 1) * 16;
    const ladderDropSpeed = 165 + (this.level - 1) * 14;

    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      b.rot += b.dir * dt * 8;

      if (b.state === 'ROLLING') {
        const g = this.girders[b.tier];
        b.dir = g.rollDir || b.dir;
        b.x += b.dir * rollSpeed * dt;
        b.y = this.getGirderY(b.tier, b.x);

        // Check ladder intersections on current tier:
        // 30% chance to roll down the ladder, 70% chance to continue straight
        for (const ladder of this.ladders) {
          if (
            ladder.toTier === b.tier &&
            b.lastTestedLadderId !== ladder.id &&
            Math.abs(b.x - ladder.x) <= 5
          ) {
            b.lastTestedLadderId = ladder.id;
            if (this.nextRandom() < 0.30) {
              b.state = 'LADDER';
              b.x = ladder.x;
              b.targetTier = ladder.fromTier;
              break;
            }
          }
        }

        if (b.state !== 'ROLLING') continue;

        // Check oil drum ignition on Tier 0
        if (b.tier === 0 && b.x <= this.oilDrum.x + 18) {
          this.oilDrum.lit = true;
          this._spawnSparks(this.oilDrum.x, this.oilDrum.y - 22, PALETTE.ORANGE, 12);
          this._spawnFireball();
          this.barrels.splice(i, 1);
          continue;
        }

        // Check falling off girder end
        if ((b.dir > 0 && b.x >= g.xMax) || (b.dir < 0 && b.x <= g.xMin)) {
          if (b.tier > 0) {
            b.state = 'FALLING';
            b.targetTier = b.tier - 1;
            b.vy = 20;
            b.lastTestedLadderId = null;
          } else {
            this.barrels.splice(i, 1);
          }
        }
      } else if (b.state === 'LADDER') {
        b.y += ladderDropSpeed * dt;
        const targetY = this.getGirderY(b.targetTier, b.x);
        if (b.y >= targetY) {
          b.y = targetY;
          b.tier = b.targetTier;
          b.dir = this.girders[b.tier].rollDir;
          b.state = 'ROLLING';
          b.lastTestedLadderId = null;
        }
      } else if (b.state === 'FALLING') {
        b.x += b.dir * 34 * dt;
        b.vy += this.gravity * dt;
        b.y += b.vy * dt;
        const targetY = this.getGirderY(b.targetTier, b.x);
        if (b.y >= targetY) {
          b.y = targetY;
          b.tier = b.targetTier;
          b.dir = this.girders[b.tier].rollDir;
          b.state = 'ROLLING';
          b.vy = 0;
          b.lastTestedLadderId = null;
        }
      }
    }
  }

  _updateFireballs(dt) {
    const speed = 72 + (this.level - 1) * 10;

    for (const f of this.fireballs) {
      f.phase += dt * 10;
      f.decisionCooldown = Math.max(0, f.decisionCooldown - dt);

      if (f.onLadder && f.currentLadder) {
        const l = f.currentLadder;
        const topY = this.getGirderY(l.toTier, l.x);
        const bottomY = this.getGirderY(l.fromTier, l.x);
        f.x = l.x;
        f.y += f.climbDir * speed * 0.85 * dt;

        if (f.climbDir < 0 && f.y <= topY) {
          f.y = topY;
          f.tier = l.toTier;
          f.onLadder = false;
          f.currentLadder = null;
          f.dir = this.player.x >= f.x ? 1 : -1;
          f.decisionCooldown = 0.5;
        } else if (f.climbDir > 0 && f.y >= bottomY) {
          f.y = bottomY;
          f.tier = l.fromTier;
          f.onLadder = false;
          f.currentLadder = null;
          f.dir = this.player.x >= f.x ? 1 : -1;
          f.decisionCooldown = 0.5;
        }
        continue;
      }

      const g = this.girders[f.tier];
      f.x += f.dir * speed * dt;
      if (f.x <= g.xMin + 24) {
        f.x = g.xMin + 24;
        f.dir = 1;
      } else if (f.x >= g.xMax - 24) {
        f.x = g.xMax - 24;
        f.dir = -1;
      }
      f.y = this.getGirderY(f.tier, f.x);

      // Periodically climb unbroken ladders toward player's tier
      if (f.decisionCooldown <= 0) {
        for (const l of this.ladders) {
          if (l.broken || l.toTier === 6) continue;
          if (l.fromTier === f.tier && Math.abs(l.x - f.x) < 6) {
            f.decisionCooldown = 0.6;
            const wantsUp = this.player.tier > f.tier ? 0.65 : 0.25;
            if (this.nextRandom() < wantsUp) {
              f.onLadder = true;
              f.currentLadder = l;
              f.climbDir = -1;
              break;
            }
          } else if (l.toTier === f.tier && Math.abs(l.x - f.x) < 6) {
            f.decisionCooldown = 0.6;
            const wantsDown = this.player.tier < f.tier ? 0.6 : 0.2;
            if (this.nextRandom() < wantsDown) {
              f.onLadder = true;
              f.currentLadder = l;
              f.climbDir = 1;
              break;
            }
          }
        }
      }
    }
  }

  _getHammerHitbox() {
    const p = this.player;
    if (p.hammerTimer <= 0) return null;
    const strikeDown = Math.sin(p.hammerSwingPhase) >= 0;
    if (strikeDown) {
      return {
        x: p.x + p.facing * 22,
        y: p.y - 12,
        r: 18
      };
    }
    return {
      x: p.x + p.facing * 4,
      y: p.y - 34,
      r: 16
    };
  }

  _checkPickupsAndCombat() {
    const p = this.player;

    // 1. Hammer pickups
    for (const h of this.hammers) {
      if (!h.collected && Math.hypot(p.x - h.x, (p.y - 16) - h.y) < 24) {
        h.collected = true;
        p.hammerTimer = 9.0;
        p.hammerSwingPhase = 0;
        this.audio.playPowerUp();
        this._spawnSparks(h.x, h.y, PALETTE.GOLD, 16);
      }
    }

    // 2. Pauline's bonus items
    for (const item of this.bonusItems) {
      if (!item.collected && Math.hypot(p.x - item.x, (p.y - 12) - item.y) < 22) {
        item.collected = true;
        this._addScore(item.points, item.x, item.y - 10, item.color);
        this.audio.playCoin();
        this._spawnSparks(item.x, item.y, item.color, 12);
      }
    }

    // 2b. Golden Rivets (Stages 4 & 8)
    if (this.rivets && this.rivets.length > 0) {
      let remainingRivets = 0;
      for (const rv of this.rivets) {
        if (!rv.pulled) {
          const ry = this.getGirderY(rv.tier, rv.x);
          if (p.tier === rv.tier && Math.abs(p.x - rv.x) < 14 && p.y <= ry + 4) {
            rv.pulled = true;
            this._addScore(100, rv.x, ry - 14, PALETTE.GOLD);
            this.audio.playCoin();
            this._spawnSparks(rv.x, ry, PALETTE.GOLD, 12);
          } else {
            remainingRivets++;
          }
        }
      }
      if (remainingRivets === 0) {
        this._triggerStageClear();
        return;
      }
    }

    const hammerBox = this._getHammerHitbox();

    // 3. Barrel collisions vs Hammer or Player body
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      const bx = b.x;
      const by = b.y - 9;

      if (hammerBox && Math.hypot(bx - hammerBox.x, by - hammerBox.y) < hammerBox.r + 10) {
        const pts = b.isBlue ? 500 : 300;
        this._addScore(pts, bx, by - 10, b.isBlue ? PALETTE.CYAN : PALETTE.GOLD);
        this._spawnSparks(bx, by, b.isBlue ? PALETTE.CYAN : PALETTE.ORANGE, 18);
        this.renderer.shake(5, 0.14);
        if (typeof this.audio.playHammerSmash === 'function') {
          this.audio.playHammerSmash();
        } else {
          this.audio.playExplosion(0.2, 1200);
          this.audio.playCoin();
        }
        this.barrels.splice(i, 1);
        continue;
      }

      // Player body hitbox
      if (Math.hypot(bx - p.x, by - (p.y - 13)) < 14) {
        this._triggerPlayerDeath();
        return;
      }
    }

    // 4. Fireball collisions vs Hammer or Player body
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i];
      const fx = f.x;
      const fy = f.y - 10;

      if (hammerBox && Math.hypot(fx - hammerBox.x, fy - hammerBox.y) < hammerBox.r + 10) {
        this._addScore(300, fx, fy - 10, PALETTE.PINK);
        this._spawnSparks(fx, fy, PALETTE.PINK, 18);
        this.renderer.shake(5, 0.14);
        if (typeof this.audio.playHammerSmash === 'function') {
          this.audio.playHammerSmash();
        } else {
          this.audio.playExplosion(0.22, 1400);
          this.audio.playCoin();
        }
        this.fireballs.splice(i, 1);
        continue;
      }

      if (Math.hypot(fx - p.x, fy - (p.y - 13)) < 14) {
        this._triggerPlayerDeath();
        return;
      }
    }

    // 5. Touching Donkey Kong directly
    if (p.tier === 5 && Math.abs(p.x - this.kong.x) < 34) {
      this._triggerPlayerDeath();
    }
  }

  _triggerPlayerDeath() {
    if (this.deathTimer > 0 || this.stageClearTimer > 0) return;
    this.deathTimer = 1.35;
    this.renderer.shake(9, 0.32);
    this.audio.playHit();
    this._spawnSparks(this.player.x, this.player.y - 14, PALETTE.RED, 24);
  }

  _triggerStageClear() {
    if (this.stageClearTimer > 0) return;
    this.stageClearTimer = 2.0;
    this._addScore(this.bonusTimer, this.pauline.x + 35, this.pauline.y - 28, PALETTE.GOLD);
    this._spawnSparks(this.pauline.x + 25, this.pauline.y - 24, PALETTE.PINK, 26);
    this.audio.playStageClear();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // Subtle industrial arcade backdrop grid
    this._drawBackdrop(ctx);

    // Ladders (drawn behind girders so rungs tuck cleanly into steel beams)
    this._drawLadders(ctx);

    // Inclined steel girders with rivets
    this._drawGirders(ctx);

    // Oil drum, barrel stack, Pauline, Donkey Kong, Hammers, Bonus Items
    this._drawStageProps(ctx);
    this._drawPauline(ctx);
    this._drawKong(ctx);

    // Active Barrels & Fireballs
    this._drawBarrels(ctx);
    this._drawFireballs(ctx);

    // Jumpman & Hammer
    this._drawPlayer(ctx);

    // Sparks & floating score popups
    this._drawParticlesAndPopups(ctx);

    // Top HUD & Bonus Box
    this.renderer.drawHUD({
      title: 'DONKEY KONG',
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `BONUS:${String(this.bonusTimer).padStart(4, '0')}`,
      accent: PALETTE.RED
    });

    this.renderer.drawStateOverlay(this.state, {
      title: 'DONKEY KONG',
      subtitle: '1981 INCLINED GIRDER & BARREL ARCADE EDITION',
      controls: 'ARROWS/WASD: CLIMB & RUN  |  Z/SPACE: JUMP BARRELS  |  HAMMER: AUTO-SMASH',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.RED
    });
  }

  _drawBackdrop(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 42, 85, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 80; x < 900; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }

    // Classic arcade BONUS timer box in top-right corner
    ctx.fillStyle = 'rgba(19, 27, 46, 0.9)';
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.fillRect(790, 50, 140, 54);
    ctx.strokeRect(790, 50, 140, 54);

    this.renderer.drawText('BONUS', 860, 68, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.PINK,
      align: 'center'
    });
    this.renderer.drawText(String(this.bonusTimer).padStart(4, '0'), 860, 94, {
      font: FONTS.HEADER,
      size: 15,
      color: PALETTE.CYAN,
      align: 'center',
      glow: 8
    });

    if (this.stageSubtitle) {
      this.renderer.drawText(this.stageSubtitle, 480, 62, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 6
      });
    }
    ctx.restore();
  }

  _drawGirders(ctx) {
    ctx.save();
    const isJungle = this.stageType === 4;
    const isConveyor = this.stageType === 1 || this.stageType === 5;
    const isSparky = this.stageType === 6;
    const mainStroke = isJungle ? PALETTE.GREEN : isConveyor ? PALETTE.GOLD : isSparky ? PALETTE.CYAN : PALETTE.RED;
    const webStroke = isJungle ? '#16A34A' : isConveyor ? '#F59E0B' : isSparky ? '#38BDF8' : '#FF5588';

    for (const g of this.girders) {
      const y1 = g.yLeft;
      const y2 = g.yRight;
      const h = g.thickness;

      // Top & bottom neon flanges
      ctx.strokeStyle = mainStroke;
      ctx.lineWidth = 3;
      ctx.shadowColor = mainStroke;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(g.xMin, y1);
      ctx.lineTo(g.xMax, y2);
      ctx.moveTo(g.xMin, y1 + h);
      ctx.lineTo(g.xMax, y2 + h);
      ctx.stroke();

      // Diagonal truss webbing inside the sloped girder
      ctx.shadowBlur = 0;
      ctx.strokeStyle = webStroke;
      ctx.lineWidth = 1.5;
      const span = g.xMax - g.xMin;
      const steps = Math.floor(span / 18);
      ctx.beginPath();
      for (let i = 0; i < steps; i++) {
        const xa = g.xMin + i * 18;
        const xb = Math.min(g.xMax, xa + 18);
        const ya = this.getGirderY(g.tier, xa);
        const yb = this.getGirderY(g.tier, xb);
        if (i % 2 === 0) {
          ctx.moveTo(xa, ya);
          ctx.lineTo(xb, yb + h);
        } else {
          ctx.moveTo(xa, ya + h);
          ctx.lineTo(xb, yb);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawLadders(ctx) {
    ctx.save();
    for (const l of this.ladders) {
      const topY = this.getGirderY(l.toTier, l.x);
      const bottomY = this.getGirderY(l.fromTier, l.x);
      const halfW = 9;

      ctx.strokeStyle = l.broken ? '#4E8098' : PALETTE.CYAN;
      ctx.lineWidth = 2;

      if (!l.broken) {
        // Full climbable ladder
        ctx.beginPath();
        ctx.moveTo(l.x - halfW, topY);
        ctx.lineTo(l.x - halfW, bottomY);
        ctx.moveTo(l.x + halfW, topY);
        ctx.lineTo(l.x + halfW, bottomY);
        for (let ry = topY + 6; ry < bottomY - 2; ry += 8) {
          ctx.moveTo(l.x - halfW, ry);
          ctx.lineTo(l.x + halfW, ry);
        }
        ctx.stroke();
      } else {
        // Broken ladder: top stub and bottom stub with gap in the middle
        const span = bottomY - topY;
        const gapTop = topY + span * 0.32;
        const gapBot = topY + span * 0.68;

        ctx.beginPath();
        ctx.moveTo(l.x - halfW, topY);
        ctx.lineTo(l.x - halfW, gapTop);
        ctx.moveTo(l.x + halfW, topY);
        ctx.lineTo(l.x + halfW, gapTop);

        ctx.moveTo(l.x - halfW, gapBot);
        ctx.lineTo(l.x - halfW, bottomY);
        ctx.moveTo(l.x + halfW, gapBot);
        ctx.lineTo(l.x + halfW, bottomY);

        for (let ry = topY + 6; ry < gapTop; ry += 8) {
          ctx.moveTo(l.x - halfW, ry);
          ctx.lineTo(l.x + halfW, ry);
        }
        for (let ry = gapBot + 4; ry < bottomY - 2; ry += 8) {
          ctx.moveTo(l.x - halfW, ry);
          ctx.lineTo(l.x + halfW, ry);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawStageProps(ctx) {
    ctx.save();
    // 1. Barrel reserve stack behind Donkey Kong (top-left of Tier 5)
    const stackX = 122;
    const stackY = this.getGirderY(5, stackX);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const bx = stackX + c * 16;
        const by = stackY - 12 - r * 18;
        ctx.fillStyle = '#B45309';
        ctx.fillRect(bx, by, 14, 16);
        ctx.strokeStyle = PALETTE.GOLD;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, 14, 16);
      }
    }

    // 2. Flaming Oil Drum at bottom-left of Tier 0
    const ox = this.oilDrum.x;
    const oy = this.oilDrum.y;
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(ox - 14, oy - 30, 28, 30);
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 14, oy - 30, 28, 30);
    this.renderer.drawText('OIL', ox, oy - 11, {
      font: FONTS.HEADER,
      size: 7,
      color: PALETTE.GOLD,
      align: 'center'
    });

    if (this.oilDrum.lit) {
      const flicker = Math.sin(this.oilDrum.flamePhase) * 4;
      ctx.fillStyle = PALETTE.ORANGE;
      ctx.shadowColor = PALETTE.ORANGE;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(ox - 12, oy - 30);
      ctx.lineTo(ox - 5, oy - 46 - flicker);
      ctx.lineTo(ox + 2, oy - 35);
      ctx.lineTo(ox + 8, oy - 48 + flicker);
      ctx.lineTo(ox + 12, oy - 30);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 3. Hammer Powerups
    for (const h of this.hammers) {
      if (h.collected) continue;
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(h.x - 2, h.y, 4, 14);
      ctx.fillStyle = PALETTE.RED;
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 1.5;
      ctx.fillRect(h.x - 9, h.y - 7, 18, 9);
      ctx.strokeRect(h.x - 9, h.y - 7, 18, 9);
    }

    // 4. Bonus Items
    for (const item of this.bonusItems) {
      if (item.collected) continue;
      ctx.fillStyle = item.color;
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 5. Golden Rivets (Stages 4 & 8)
    if (this.rivets && this.rivets.length > 0) {
      for (const rv of this.rivets) {
        const ry = this.getGirderY(rv.tier, rv.x);
        if (rv.pulled) {
          ctx.fillStyle = PALETTE.BG;
          ctx.fillRect(rv.x - 6, ry - 2, 12, 16);
        } else {
          this.renderer.drawGlowRect(rv.x - 5, ry - 4, 10, 16, PALETTE.GOLD, 8, true);
        }
      }
    }
    ctx.restore();
  }

  _drawPauline(ctx) {
    const px = Math.round(this.pauline.x);
    const py = Math.round(this.pauline.y);
    const bounce = Math.sin(this.pauline.helpTimer * 6) > 0 ? -2 : 0;

    ctx.save();
    // Pauline pixel-art sprite: golden hair, pink gown with white frill trim
    const paulineSprite = [
      '...GGGGGG...',
      '..GGGGGGGG..',
      '..GGFFFFKW..',
      '..GGGFFFF...',
      '....FFFF....',
      '...PPPPPP...',
      '..WPPPPPPW..',
      '..PPPPPPPP..',
      '.PPPPPPPPPP.',
      '.WWWWWWWWWW.',
      '.PPPPPPPPPP.',
      '...WW..WW...',
      '..WWW..WWW..'
    ];
    this.renderer.drawPixelSprite(
      paulineSprite,
      px - 12,
      py - 26 + bounce,
      2,
      {
        G: '#FACC15',
        F: '#FDE68A',
        K: '#0F172A',
        P: '#FF007A',
        W: '#FFFFFF'
      }
    );

    if (this.stageClearTimer > 0 || this.player.tier === 6) {
      // Classic floating Heart (♥) between Pauline and Jumpman on reaching top platform!
      const heartY = py - 34 + Math.sin(this.animTime * 8) * 3;
      const heartSprite = [
        '.RR..RR.',
        'RRRRRRRR',
        'RRRRRRRR',
        '.RRRRRR.',
        '..RRRR..',
        '...RR...'
      ];
      this.renderer.drawPixelSprite(
        heartSprite,
        px + 26,
        heartY - 8,
        2.2,
        { R: '#FF2A55' }
      );
      this.renderer.drawText('♥ STAGE CLEAR! ♥', px + 58, py - 38, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.PINK,
        align: 'center',
        glow: 10
      });
    } else if (Math.sin(this.pauline.helpTimer * 3) > -0.2) {
      this.renderer.drawText('HELP!', px + 26, py - 24, {
        font: FONTS.HEADER,
        size: 9,
        color: PALETTE.CYAN,
        align: 'left',
        glow: 6
      });
    }
    ctx.restore();
  }

  _drawKong(ctx) {
    const kx = Math.round(this.kong.x);
    const ky = Math.round(this.kong.y);
    ctx.save();

    // Rich multi-color pixel-art Donkey Kong sprite (24x20 matrix at scale 2.8 = 67x56px)
    const beatLeft = Math.sin(this.animTime * 8) > 0;
    const kongChest1 = [
      '.......BBBBBBBBBB.......',
      '.....BBBBBBBBBBBBBB.....',
      '....BBBBTTTTTTTTBBBB....',
      '....BBBTTWWKKWWTTBBB....',
      '...BBBBTTTTTTTTTTBBBB...',
      '...BBBTTTWWWWWWTTTBBB...',
      '....BBBBTTTTTTTTBBBB....',
      '.TTTBBBBBBBBBBBBBBBB....',
      'TTTTBBBBTTTTTTTTBBBBBBBB',
      'TTT.BBBTTTTTTTTTTBBBBBBB',
      '....BBBTTTTDDTTTTBBBTTTT',
      '....BBBBTTTTTTTTBBBBTTTT',
      '.....BBBBBBBBBBBBBB..TT.',
      '....BBBBBBBBBBBBBBBB....',
      '...BBBBBB......BBBBBB...',
      '..BBBBBB........BBBBBB..',
      '..TTTTT..........TTTTT..'
    ];
    const kongChest2 = [
      '.......BBBBBBBBBB.......',
      '.....BBBBBBBBBBBBBB.....',
      '....BBBBTTTTTTTTBBBB....',
      '....BBBTTWWKKWWTTBBB....',
      '...BBBBTTTTTTTTTTBBBB...',
      '...BBBTTTWWWWWWTTTBBB...',
      '....BBBBTTTTTTTTBBBB....',
      '....BBBBBBBBBBBBBBBBTTT.',
      'BBBBBBBBTTTTTTTTBBBBTTTT',
      'BBBBBBBTTTTTTTTTTBBB.TTT',
      'TTTTBBBTTTTDDTTTTBBB....',
      'TTTTBBBBTTTTTTTTBBBB....',
      '.TT..BBBBBBBBBBBBBB.....',
      '....BBBBBBBBBBBBBBBB....',
      '...BBBBBB......BBBBBB...',
      '..BBBBBB........BBBBBB..',
      '..TTTTT..........TTTTT..'
    ];
    const kongRoll = [
      '.......BBBBBBBBBB.......',
      '.....BBBBBBBBBBBBBB.....',
      '....BBBBTTTTTTTTBBBB....',
      '....BBBTTWWKKWWTTBBB....',
      '...BBBBTTTTTTTTTTBBBB...',
      '...BBBTTTWWWWWWTTTBBB...',
      '....BBBBTTTTTTTTBBBB....',
      '....BBBBBBBBBBBBBBBB....',
      '..BBBBBBTTTTTTTTBBBBBB..',
      '.BBBBBBTTTTTTTTTTBBBBBB.',
      '.TTTBBBTTTTDDTTTTBBBTTT.',
      '..TTBBBBTTTTTTTTBBBBTT..',
      '.....BBBBBBBBBBBBBB.....',
      '....BBBBBBBBBBBBBBBB....',
      '...BBBBBB......BBBBBB...',
      '..BBBBBB........BBBBBB..',
      '..TTTTT..........TTTTT..'
    ];

    const activeKong =
      this.kong.pose === 'GRAB' || this.kong.pose === 'ROLL'
        ? kongRoll
        : beatLeft
          ? kongChest1
          : kongChest2;

    this.renderer.drawPixelSprite(
      activeKong,
      kx - 33,
      ky - 48,
      2.8,
      {
        B: '#92400E',
        D: '#78350F',
        T: '#FDBA74',
        W: '#FFFFFF',
        K: '#0F172A'
      },
      this.kong.pose === 'GRAB',
      false
    );

    // Draw barrel in Kong's hands during GRAB / ROLL poses
    if (this.kong.pose === 'GRAB') {
      ctx.fillStyle = '#D97706';
      ctx.fillRect(kx - 36, ky - 28, 16, 18);
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 2;
      ctx.strokeRect(kx - 36, ky - 28, 16, 18);
    } else if (this.kong.pose === 'ROLL') {
      ctx.fillStyle = '#D97706';
      ctx.fillRect(kx + 20, ky - 22, 16, 18);
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 2;
      ctx.strokeRect(kx + 20, ky - 22, 16, 18);
    }

    ctx.restore();
  }

  _drawBarrels(ctx) {
    ctx.save();
    for (const b of this.barrels) {
      const cx = b.x;
      const cy = b.y - 9;
      const mainColor = b.isBlue ? '#0284C7' : '#D97706';
      const darkWood = b.isBlue ? '#0369A1' : '#92400E';
      const rimColor = b.isBlue ? PALETTE.CYAN : PALETTE.GOLD;

      ctx.save();
      ctx.translate(cx, cy);

      if (b.state === 'LADDER') {
        // Barrel rolling broadside down a ladder (wide cylindrical view with hoops)
        ctx.fillStyle = mainColor;
        ctx.fillRect(-12, -7, 24, 14);
        ctx.fillStyle = darkWood;
        ctx.fillRect(-12, -2, 24, 4);
        ctx.strokeStyle = rimColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -7, 24, 14);
        ctx.beginPath();
        ctx.moveTo(-6, -7);
        ctx.lineTo(-6, 7);
        ctx.moveTo(6, -7);
        ctx.lineTo(6, 7);
        ctx.stroke();
      } else {
        ctx.rotate(b.rot);
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = darkWood;
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = rimColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
        ctx.moveTo(-7, 0);
        ctx.lineTo(7, 0);
        ctx.moveTo(0, -7);
        ctx.lineTo(0, 7);
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.restore();
  }

  _drawFireballs(ctx) {
    ctx.save();
    const fireSprite1 = [
      '....YY..YY....',
      '..YYOOOOOOYY..',
      '.YOOORRRROOOY.',
      'YOORRRRRRRROOY',
      'YORRWWKRRWWKRY',
      'YORRWWKRRWWKRY',
      'YOORRRRRRRROOY',
      '.YOOOOOOOOOOY.',
      '..YYYYYYYYYY..'
    ];
    const fireSprite2 = [
      '..YY..YY..YY..',
      '.YOOOOOOOOOOY.',
      'YOORRRRRRRROOY',
      'YORRRRRRRRRROY',
      'YORRWWKRRWWKRY',
      'YORRWWKRRWWKRY',
      '.YOORRRRRRROY.',
      '..YOOOOOOOOY..',
      '...YYYYYYYY...'
    ];

    for (const f of this.fireballs) {
      const fx = Math.round(f.x - 12);
      const fy = Math.round(f.y - 19 + Math.sin(f.phase) * 2);
      const alt = Math.floor(f.phase * 2) % 2 === 0;
      this.renderer.drawPixelSprite(
        alt ? fireSprite1 : fireSprite2,
        fx,
        fy,
        1.8,
        {
          Y: PALETTE.GOLD,
          O: PALETTE.ORANGE,
          R: PALETTE.RED,
          W: PALETTE.WHITE,
          K: '#0F172A'
        },
        f.dir < 0,
        false
      );
    }
    ctx.restore();
  }

  _drawPlayer(ctx) {
    const p = this.player;
    ctx.save();

    if (this.deathTimer > 0) {
      ctx.translate(p.x, p.y - 12);
      ctx.rotate(this.deathTimer * 10);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
      return;
    }

    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const step = Math.floor(p.walkCycle) % 2 === 0;

    // Jumpman (Mario) authentic multi-color pixel-art sprites:
    // R = Red Hat/Overalls, B = Blue Shirt/Hair, F = Tan Face, M = Dark Mustache/Boots, Y = Gold Buttons
    const marioWalk1 = [
      '...RRRRRR...',
      '..RRRRRRRRR.',
      '..BBBFFKFF..',
      '.BFFFFFMMFF.',
      '.BFFFMMMMM..',
      '..BBBBFFFF..',
      '..BBRBBBRB..',
      '.BBBBRRRRBBB',
      '.FF.RRRRRR.F',
      '....RRYRRY..',
      '...RRRRRRRR.',
      '..RRRR..RRRR',
      '.MMMM....MMM'
    ];
    const marioWalk2 = [
      '...RRRRRR...',
      '..RRRRRRRRR.',
      '..BBBFFKFF..',
      '.BFFFFFMMFF.',
      '.BFFFMMMMM..',
      '..BBBBFFFF..',
      '...BBRBBR...',
      '..BBBRRRRBB.',
      '..FFRRRRRRFF',
      '....RRYRRY..',
      '....RRRRRR..',
      '....RRR.RRR.',
      '...MMMM.MMMM'
    ];
    const marioJump = [
      '...RRRRRR.FF',
      '..RRRRRRRRFF',
      '..BBBFFKFFBB',
      '.BFFFFFMMFFB',
      '.BFFFMMMMMB.',
      '..BBBBFFFF..',
      '.BBBRRRRRB..',
      'FF.RRRRRRRR.',
      '...RRYRRYRR.',
      '..RRRRRRRRR.',
      '.MMMM...MMMM',
      'MM........MM',
      '............'
    ];
    const marioClimb1 = [
      '..FFRRRRRR..',
      '..BBRRRRRR..',
      '...BBBBBBBB.',
      '...BBBBBBBB.',
      '..BBBRRRR...',
      '..BBRRRRRRFF',
      '....RRRRRRBB',
      '...RRRRRRRR.',
      '...RRR..RRR.',
      '..MMMM..RRRR',
      '........MMMM',
      '............',
      '............'
    ];
    const marioClimb2 = [
      '..RRRRRRFF..',
      '..RRRRRRBB..',
      '.BBBBBBBB...',
      '.BBBBBBBB...',
      '...RRRRBBB..',
      'FFRRRRRRBB..',
      'BBRRRRRR....',
      '.RRRRRRRR...',
      '.RRR..RRR...',
      'RRRR..MMMM..',
      'MMMM........',
      '............',
      '............'
    ];

    let activeSprite = step ? marioWalk1 : marioWalk2;
    if (p.onLadder) {
      activeSprite = step ? marioClimb1 : marioClimb2;
    } else if (p.jumping) {
      activeSprite = marioJump;
    }

    this.renderer.drawPixelSprite(
      activeSprite,
      px - 12,
      py - 26,
      2,
      {
        R: '#EF4444',
        B: '#2563EB',
        F: '#FDE68A',
        M: '#78350F',
        K: '#0F172A',
        Y: '#FACC15'
      },
      p.onLadder ? false : p.facing < 0,
      false
    );

    // Active Hammer swing visual
    const hammerBox = this._getHammerHitbox();
    if (hammerBox) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py - 14);
      ctx.lineTo(hammerBox.x, hammerBox.y);
      ctx.stroke();

      ctx.fillStyle = '#991B1B';
      ctx.shadowColor = PALETTE.GOLD;
      ctx.shadowBlur = 10;
      ctx.fillRect(hammerBox.x - 9, hammerBox.y - 7, 18, 14);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(hammerBox.x - 9, hammerBox.y - 7, 4, 14);
      ctx.fillRect(hammerBox.x + 5, hammerBox.y - 7, 4, 14);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  _drawParticlesAndPopups(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (const pop of this.popups) {
      ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }
    ctx.restore();
  }

  destroy() {
    this.barrels = [];
    this.fireballs = [];
    this.particles = [];
    this.popups = [];
  }
}

export default DonkeyKong;
