/**
 * MainMenu.js
 * Interactive Canvas & Studio Lobby Menu for Retro Arcade Studio.
 * Supports switching between the 8 Flagship Core Games and 20 Expanded Vault Classics
 * via Keyboard/D-Pad, Mouse Pointer, or Touch Tap, while displaying persisted High Scores,
 * Firebase Cloud Star Ratings (1-5 ★), Favorite Bookmarks (♥), Emulator Save Slots,
 * Catalog Sorting, Mechanics Focus, Control Paradigm, and Modern Enhancements.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';
import {
  cloudPersistence,
  SaveStateManager,
  achievementManager
} from '../engine/CloudPersistence.js';

export const GAME_CATALOG = [
  // === 8 CORE ARCHETYPES ===
  {
    id: 'loderunner',
    title: 'Vault Runner',
    category: 'core',
    genre: 'Platform',
    accent: PALETTE.GOLD,
    mechanics: '28x16 Grid, Brick Digging, A* AI Traps',
    controls: '4-Way D-Pad + Left(Z) / Right(X) Dig',
    enhancements: '8s regeneration timers, WASM A* & debris'
  },
  {
    id: 'digdug',
    title: 'Sub-Terra Driller',
    category: 'core',
    genre: 'Action',
    accent: PALETTE.ORANGE,
    mechanics: 'Freeform Tunneling, 4-Stage Pump, Rock Drop',
    controls: '4-Way D-Pad + Pump Harpoon (Z/Space)',
    enhancements: 'Volumetric soil strata, 1.2s rock hang'
  },
  {
    id: 'donkeykong',
    title: 'Girder Titan',
    category: 'core',
    genre: 'Platform',
    accent: PALETTE.PINK,
    mechanics: '4 Classic Stages (Girders, Conveyor, Elevators, Rivets)',
    controls: '4-Way Climb/Move + Jump (Z/Space)',
    enhancements: '30/70 barrel RNG, Hammer smash mode'
  },
  {
    id: 'sumo',
    title: 'Dohyo Clash',
    category: 'core',
    genre: 'Sports',
    accent: PALETTE.RED,
    mechanics: 'Center-of-Mass Ring Physics, Stamina Drag',
    controls: 'Analogue/D-Pad + Shove(Z) / Slap & Evade(X)',
    enhancements: 'Vector momentum, ring-edge tension glow'
  },
  {
    id: 'pacman',
    title: 'Neon Chomper',
    category: 'core',
    genre: 'Maze',
    accent: PALETTE.GOLD,
    mechanics: '4 Classic Mazes, 4-Specter AI, Fright Multipliers',
    controls: '4-Way D-Pad / Swipe + Variant Toggle (X)',
    enhancements: 'Dynamic maze color shift, fruit cycles'
  },
  {
    id: 'frogger',
    title: 'Cyber Hopper',
    category: 'core',
    genre: 'Action',
    accent: PALETTE.GREEN,
    mechanics: 'Discrete Grid Hops, 60s Timer, River Logs',
    controls: '4-Way D-Pad / Tap-to-Leap Direction',
    enhancements: 'Log/turtle momentum transfer, splash FX'
  },
  {
    id: 'galaga',
    title: 'Star Squadron',
    category: 'core',
    genre: 'Shooter',
    accent: PALETTE.CYAN,
    mechanics: 'Bezier Flight Paths, Tractor Beam Rescue',
    controls: 'Left/Right Move + Dual Fire (Z/Space)',
    enhancements: 'Side-by-side Dual Fighter, 3-layer stars'
  },
  {
    id: 'spaceinvaders',
    title: 'Cosmic Armada',
    category: 'core',
    genre: 'Shooter',
    accent: PALETTE.GREEN,
    mechanics: '5x11 Fleet March, Accelerating Tempo, UFO',
    controls: 'Left/Right Move + Laser Cannon (Z/Space)',
    enhancements: 'Voxel-eroded destructible defense bunkers'
  },

  // === 20 EXPANDED CLASSICS ===
  {
    id: 'asteroids',
    title: 'Meteor Vector',
    category: 'expanded',
    genre: 'Shooter',
    accent: PALETTE.CYAN,
    mechanics: 'Vector wrap-around, ship inertia, rock split',
    controls: 'Rotate + Thrust(Up) + Fire(Z) + Hyper(X)',
    enhancements: 'Glowing vector geometry & UFO saucers'
  },
  {
    id: 'centipede',
    title: 'Mycelium Crawler',
    category: 'expanded',
    genre: 'Shooter',
    accent: PALETTE.GREEN,
    mechanics: 'Segmented winding chain, mushroom grid',
    controls: '4-Way Bottom Zone + Rapid Blaster (Z)',
    enhancements: 'Chain splitting, Flea/Spider/Scorpion AI'
  },
  {
    id: 'defender',
    title: 'Horizon Vanguard',
    category: 'expanded',
    genre: 'Shooter',
    accent: PALETTE.PINK,
    mechanics: 'Side-scrolling radar, colonist rescue',
    controls: 'Thrust/Move + Laser(Z) + Smart Bomb(X)',
    enhancements: 'Live planet scanner minimap & Mutant AI'
  },
  {
    id: 'arkanoid',
    title: 'Prism Breaker',
    category: 'expanded',
    genre: 'Action',
    accent: PALETTE.CYAN,
    mechanics: '6 Brick Fortresses, paddle reflection physics',
    controls: 'Left/Right Prism Paddle + Launch/Laser(Z)',
    enhancements: 'Expand, Multiball & Laser power capsules'
  },
  {
    id: 'paperboy',
    title: 'Courier Dash',
    category: 'expanded',
    genre: 'Action',
    accent: PALETTE.GOLD,
    mechanics: 'Isometric street navigation, parcel throws',
    controls: 'Steer/Speed + Throw Parcel (Z)',
    enhancements: 'Subscriber mailboxes & breakable windows'
  },
  {
    id: 'joust',
    title: 'Sky Lancer',
    category: 'expanded',
    genre: 'Platform',
    accent: PALETTE.ORANGE,
    mechanics: 'Flapping flight momentum, lance altitude',
    controls: 'Left/Right + Flap Wings (Z/Up)',
    enhancements: 'Bouncing eggs & grasping Lava Claw hazard'
  },
  {
    id: 'qbert',
    title: 'Iso Hop',
    category: 'expanded',
    genre: 'Platform',
    accent: PALETTE.ORANGE,
    mechanics: 'Isometric pyramid hops, serpent chase AI',
    controls: '4-Way Diagonal Pyramid Hops',
    enhancements: 'Color-flipping cubes & spinning discs'
  },
  {
    id: 'rampage',
    title: 'Kaiju Crush',
    category: 'expanded',
    genre: 'Action',
    accent: PALETTE.RED,
    mechanics: 'Skyscraper climbing & collapse physics',
    controls: 'Climb/Walk + Punch(Z) + Jump(X)',
    enhancements: 'Structural demolition & helicopter blitz'
  },
  {
    id: 'marblemadness',
    title: 'Gyro Sphere',
    category: 'expanded',
    genre: 'Action',
    accent: PALETTE.CYAN,
    mechanics: '6 Isometric Courses, slope gravity, momentum',
    controls: '4-Way Roll Acceleration + Turbo(Z)',
    enhancements: '3D shaded slope vectors, ice & boost pads'
  },
  {
    id: 'pitfall',
    title: 'Jungle Strider',
    category: 'expanded',
    genre: 'Platform',
    accent: PALETTE.GREEN,
    mechanics: 'Vine swinging, crocodile timing, scorpions',
    controls: 'Run/Climb + Jump/Grab Vine (Z)',
    enhancements: 'Multi-screen jungle canopy & cavern'
  },
  {
    id: 'duckhunt',
    title: 'Wing Blaster',
    category: 'expanded',
    genre: 'Shooter',
    accent: PALETTE.GOLD,
    mechanics: 'Light-gun touch/click & crosshair targeting',
    controls: 'Tap/Click or Aim Crosshair + Shoot(Z)',
    enhancements: '3-shell reload, angled trajectories & hound'
  },
  {
    id: 'excitebike',
    title: 'Nitro Moto',
    category: 'expanded',
    genre: 'Sports',
    accent: PALETTE.PINK,
    mechanics: 'Stunt incline jumping, engine heat meter',
    controls: 'Lane/Pitch + Gas(Z) + Turbo Boost(X)',
    enhancements: 'Mid-air wheelie pitch & cooling arrows'
  },
  {
    id: 'missilecommand',
    title: 'Aegis Intercept',
    category: 'expanded',
    genre: 'Shooter',
    accent: PALETTE.RED,
    mechanics: 'ABM interception trajectories, blast radii',
    controls: 'Click/Tap or Crosshair + Launch ABM(Z)',
    enhancements: '3 defense batteries & chain shockwaves'
  },
  {
    id: 'burgertime',
    title: 'Bistro Stacker',
    category: 'expanded',
    genre: 'Platform',
    accent: PALETTE.GOLD,
    mechanics: '4 Kitchen Layouts, cascading burger slices',
    controls: '4-Way Scaffold Climb + Throw Spice(X)',
    enhancements: 'Cascading burger slices & enemy crush'
  },
  {
    id: 'bubblebobble',
    title: 'Bubble Dragons',
    category: 'expanded',
    genre: 'Platform',
    accent: PALETTE.PINK,
    mechanics: '6 Cave Stages, bubble traps, air currents',
    controls: 'Move + Blow Bubble(Z) + Jump(X/Up)',
    enhancements: 'Chain-popping physics & bonus fruit drops'
  },
  {
    id: 'spyhunter',
    title: 'Highway Agent',
    category: 'expanded',
    genre: 'Action',
    accent: PALETTE.CYAN,
    mechanics: 'High-speed combat driving & Supply Van',
    controls: 'Steer/Speed + Machine Gun(Z) + Oil/Smoke(X)',
    enhancements: 'Supply Van docking & syndicate pursuers'
  },
  {
    id: 'tron',
    title: 'Light Grid',
    category: 'expanded',
    genre: 'Action',
    accent: PALETTE.CYAN,
    mechanics: 'Light cycle trail walls, AI turn raycasts',
    controls: '4-Way 90° Turns + Boost(Z) + Brake(X)',
    enhancements: 'Neon grid arena & predictive AI cycles'
  },
  {
    id: 'trackandfield',
    title: 'Cyber Decathlon',
    category: 'expanded',
    genre: 'Sports',
    accent: PALETTE.GOLD,
    mechanics: 'Button mashing velocity, angle triggers',
    controls: 'Mash Run(Z / L-R) + Angle Action(X)',
    enhancements: '100m Dash, Long Jump & Javelin events'
  },
  {
    id: 'outrun',
    title: 'Synthwave Horizon',
    category: 'expanded',
    genre: 'Sports',
    accent: PALETTE.PINK,
    mechanics: 'Pseudo-3D horizon road, drifting, forks',
    controls: 'Steer + Gas(Z/Up) + Drift Brake(X/Down)',
    enhancements: 'Synthwave hills, palm trees & track forks'
  },
  {
    id: 'contra',
    title: 'Commando Strike',
    category: 'expanded',
    genre: 'Shooter',
    accent: PALETTE.RED,
    mechanics: '8-way directional aiming, Spread Shot (S)',
    controls: '8-Way Aim/Move + Fire(Z) + Jump(X)',
    enhancements: 'Spread/Laser capsules & Wall Boss core'
  }
];

const SORT_MODES = [
  { id: 'default', label: 'SORT: FEATURED' },
  { id: 'rating', label: 'SORT: ★ TOP RATED' },
  { id: 'highscore', label: 'SORT: 🏆 HIGH SCORE' },
  { id: 'saved', label: 'SORT: ♥ SAVED' },
  { id: 'most_played', label: 'SORT: 🔥 MOST PLAYED' }
];

export class MainMenu {
  constructor(renderer, input, audio, onSelectGame) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;
    this.onSelectGame = onSelectGame;

    cloudPersistence.initializeCatalog(GAME_CATALOG.map((g) => g.id));

    this.activeTab = 'core'; // 'core' (8 flagship) | 'expanded' (20 classics)
    this.sortModeIndex = 0;
    this.selectedIndex = 0;
    this.hoverIndex = -1;
    this.animTime = 0;
    this.cardRects = [];
    this.tabRects = [];
    this.inspectorStarRects = [];
    this.inspectorFavRect = null;
  }

  getSortMode() {
    return SORT_MODES[this.sortModeIndex % SORT_MODES.length];
  }

  cycleSortMode() {
    this.sortModeIndex = (this.sortModeIndex + 1) % SORT_MODES.length;
    cloudPersistence.sortMode = this.getSortMode().id;
    this.selectedIndex = 0;
    this.audio.playMenuMove();
    return this.getSortMode();
  }

  getVisibleGames() {
    const base = GAME_CATALOG.filter((g) => g.category === this.activeTab);
    return cloudPersistence.sortCatalog(base, this.getSortMode().id);
  }

  setTab(tab) {
    if (this.activeTab !== tab) {
      this.activeTab = tab;
      this.selectedIndex = 0;
      this.audio.playMenuMove();
    }
  }

  update(dt) {
    this.animTime += dt;
    const list = this.getVisibleGames();
    const cols = this.activeTab === 'core' ? 4 : 5;
    const rows = Math.ceil(list.length / cols);

    if (this.selectedIndex >= list.length) {
      this.selectedIndex = Math.max(0, list.length - 1);
    }
    const activeGame = list[this.selectedIndex] || list[0];

    // Tab toggle with Action B (X / Shift)
    if (this.input.isJustPressed('actionB')) {
      this.setTab(this.activeTab === 'core' ? 'expanded' : 'core');
    }

    // Favorite / Bookmark toggle with KeyF
    if (this.input.isKeyJustPressed('KeyF') && activeGame) {
      const saved = cloudPersistence.toggleSaveGame(activeGame.id);
      this.audio.playCoin();
      achievementManager.unlock('arcade_critic', this.audio);
      achievementManager.pushToast(
        saved ? `♥ SAVED ${activeGame.title.toUpperCase()}` : `REMOVED ${activeGame.title.toUpperCase()}`,
        'Synced to Local & Firebase Cloud',
        PALETTE.PINK
      );
      if (typeof window !== 'undefined' && window.arcadeStudio) {
        window.arcadeStudio._syncHeaderStatus();
      }
    }

    // 1-5 Star Rating shortcuts (Digit1..Digit5) in Lobby
    for (let s = 1; s <= 5; s++) {
      if (this.input.isKeyJustPressed(`Digit${s}`) && activeGame) {
        cloudPersistence.rateGame(activeGame.id, s);
        this.audio.playCoin();
        achievementManager.unlock('arcade_critic', this.audio);
        achievementManager.pushToast(
          `★ RATED ${activeGame.title.toUpperCase()}: ${s}/5 STARS`,
          'Synced to Firebase Cloud Leaderboard',
          PALETTE.GOLD
        );
        if (typeof window !== 'undefined' && window.arcadeStudio) {
          window.arcadeStudio._syncHeaderStatus();
        }
      }
    }

    // Keyboard / D-Pad Grid Navigation
    if (this.input.isJustPressed('right')) {
      this.selectedIndex = (this.selectedIndex + 1) % list.length;
      this.audio.playMenuMove();
    } else if (this.input.isJustPressed('left')) {
      this.selectedIndex = (this.selectedIndex - 1 + list.length) % list.length;
      this.audio.playMenuMove();
    } else if (this.input.isJustPressed('down')) {
      const next = this.selectedIndex + cols;
      if (next < list.length) {
        this.selectedIndex = next;
      } else {
        this.selectedIndex = this.selectedIndex % cols;
      }
      this.audio.playMenuMove();
    } else if (this.input.isJustPressed('up')) {
      const prev = this.selectedIndex - cols;
      if (prev >= 0) {
        this.selectedIndex = prev;
      } else {
        const col = this.selectedIndex % cols;
        const lastRowIdx = (rows - 1) * cols + col;
        this.selectedIndex = Math.min(list.length - 1, lastRowIdx);
      }
      this.audio.playMenuMove();
    }

    // Launch selected game with Action A (Z / Space / Enter)
    if (this.input.isJustPressed('actionA')) {
      const chosen = list[this.selectedIndex];
      if (chosen && typeof this.onSelectGame === 'function') {
        this.audio.playMenuSelect();
        this.onSelectGame(chosen.id);
        return;
      }
    }

    // Pointer hover & click / touch support
    const px = this.input.pointer.x;
    const py = this.input.pointer.y;

    if (this.input.pointer.justPressed) {
      // Check tab & sort button clicks
      for (const tab of this.tabRects) {
        if (px >= tab.x && px <= tab.x + tab.w && py >= tab.y && py <= tab.y + tab.h) {
          if (tab.id === 'sort') {
            this.cycleSortMode();
          } else {
            this.setTab(tab.id);
          }
          return;
        }
      }

      // Check Inspector 1-5 Star clicks
      if (activeGame && this.inspectorStarRects.length === 5) {
        for (let s = 0; s < 5; s++) {
          const sr = this.inspectorStarRects[s];
          if (px >= sr.x && px <= sr.x + sr.w && py >= sr.y && py <= sr.y + sr.h) {
            cloudPersistence.rateGame(activeGame.id, s + 1);
            this.audio.playCoin();
            achievementManager.unlock('arcade_critic', this.audio);
            achievementManager.pushToast(
              `★ RATED ${activeGame.title.toUpperCase()}: ${s + 1}/5`,
              'Synced to Firebase Cloud Leaderboard',
              PALETTE.GOLD
            );
            return;
          }
        }
      }

      // Check Inspector Fav Heart click
      if (activeGame && this.inspectorFavRect) {
        const fr = this.inspectorFavRect;
        if (px >= fr.x && px <= fr.x + fr.w && py >= fr.y && py <= fr.y + fr.h) {
          const saved = cloudPersistence.toggleSaveGame(activeGame.id);
          this.audio.playCoin();
          achievementManager.unlock('arcade_critic', this.audio);
          achievementManager.pushToast(
            saved ? `♥ SAVED ${activeGame.title.toUpperCase()}` : `REMOVED ${activeGame.title.toUpperCase()}`,
            'Synced to Firebase Cloud',
            PALETTE.PINK
          );
          return;
        }
      }

      // Check card clicks
      for (let i = 0; i < this.cardRects.length; i++) {
        const r = this.cardRects[i];
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
          this.selectedIndex = i;
          const chosen = list[i];
          if (chosen && typeof this.onSelectGame === 'function') {
            this.audio.playMenuSelect();
            this.onSelectGame(chosen.id);
            return;
          }
        }
      }
    } else {
      // Hover update
      for (let i = 0; i < this.cardRects.length; i++) {
        const r = this.cardRects[i];
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
          if (this.hoverIndex !== i) {
            this.hoverIndex = i;
            this.selectedIndex = i;
          }
          break;
        }
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    const W = this.renderer.width;
    const H = this.renderer.height;
    const scores = HighScoreStore.loadAll();

    // Deep space background with perspective synth grid
    ctx.fillStyle = PALETTE.BG;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    const gridOffset = (this.animTime * 24) % 40;
    for (let x = 0; x <= W; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = gridOffset; y <= H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    // Header Banner
    this.renderer.drawText('RETRO ARCADE STUDIO', W / 2, 32, {
      font: FONTS.HEADER,
      size: 20,
      color: PALETTE.CYAN,
      align: 'center',
      glow: 14
    });

    const cloudStatus =
      cloudPersistence.syncStatus === 'synced'
        ? 'FIREBASE CLOUD: SYNCED'
        : 'FIREBASE CLOUD: LOCAL+CACHE';

    this.renderer.drawText(
      `CRT SHADER PIPELINE  •  ${cloudStatus}  •  SAVE STATES [F5/F8]  •  REWIND [R]`,
      W / 2,
      52,
      {
        font: FONTS.HUD,
        size: 11,
        color: PALETTE.GOLD,
        align: 'center'
      }
    );

    // Category Tabs + Cloud Sort Pill
    const sortMode = this.getSortMode();
    this.tabRects = [
      { id: 'core', label: 'CORE 8 ARCHETYPES (FEATURED)', x: 85, y: 62, w: 265, h: 28 },
      { id: 'expanded', label: 'EXPANDED VAULT (20 CLASSICS)', x: 362, y: 62, w: 265, h: 28 },
      { id: 'sort', label: sortMode.label, x: 639, y: 62, w: 236, h: 28 }
    ];

    for (const tab of this.tabRects) {
      const isSort = tab.id === 'sort';
      const active = !isSort && this.activeTab === tab.id;
      ctx.save();
      ctx.fillStyle = isSort
        ? 'rgba(255, 215, 0, 0.14)'
        : active
        ? 'rgba(0, 240, 255, 0.18)'
        : 'rgba(19, 27, 46, 0.85)';
      ctx.strokeStyle = isSort
        ? PALETTE.GOLD
        : active
        ? PALETTE.CYAN
        : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = active || isSort ? 2 : 1;
      if (active) {
        ctx.shadowColor = PALETTE.CYAN;
        ctx.shadowBlur = 10;
      }
      ctx.fillRect(tab.x, tab.y, tab.w, tab.h);
      ctx.strokeRect(tab.x, tab.y, tab.w, tab.h);
      ctx.restore();

      this.renderer.drawText(tab.label, tab.x + tab.w / 2, tab.y + 19, {
        font: FONTS.HUD,
        size: 11.5,
        color: isSort ? PALETTE.GOLD : active ? PALETTE.CYAN : PALETTE.MUTED,
        align: 'center'
      });
    }

    const list = this.getVisibleGames();
    this.cardRects = [];

    if (this.activeTab === 'core') {
      // 4x2 Featured Cabinet Cards
      const cols = 4;
      const cardW = 216;
      const cardH = 162;
      const gapX = 16;
      const gapY = 16;
      const startX = (W - (cols * cardW + (cols - 1) * gapX)) / 2;
      const startY = 102;

      list.forEach((game, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);
        this.cardRects.push({ x, y, w: cardW, h: cardH });

        const selected = idx === this.selectedIndex;
        const rec = cloudPersistence.getRecord(game.id);
        const rating = cloudPersistence.getEffectiveRating(game.id);
        const hi = Math.max(scores[game.id] || 0, rec.highScore || 0);
        const hasSave = !!SaveStateManager.getSlotMeta(game.id, 1);

        ctx.save();
        ctx.fillStyle = selected ? 'rgba(24, 36, 64, 0.96)' : 'rgba(15, 22, 38, 0.90)';
        ctx.strokeStyle = selected ? game.accent : 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = selected ? 2.5 : 1.2;
        if (selected) {
          ctx.shadowColor = game.accent;
          ctx.shadowBlur = 16;
        }
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeRect(x, y, cardW, cardH);
        ctx.restore();

        // Top accent bar
        ctx.fillStyle = game.accent;
        ctx.fillRect(x, y, cardW, 4);

        // Star Rating + Favorite Heart + Save State Badge
        const favIcon = rec.saved ? '♥ ' : '';
        const saveIcon = hasSave ? ' 💾' : '';
        this.renderer.drawText(
          `${favIcon}★${rating.toFixed(1)}${saveIcon}`,
          x + 8,
          y + 21,
          {
            font: FONTS.HUD,
            size: 11.5,
            color: rec.saved ? PALETTE.PINK : PALETTE.GOLD
          }
        );

        this.renderer.drawText(`HI: ${String(hi).padStart(6, '0')}`, x + cardW - 8, y + 21, {
          font: FONTS.HUD,
          size: 11.5,
          color: PALETTE.GOLD,
          align: 'right'
        });

        // Game Title
        this.renderer.drawText(game.title.toUpperCase(), x + cardW / 2, y + 46, {
          font: FONTS.HEADER,
          size: 11,
          color: PALETTE.WHITE,
          align: 'center',
          glow: selected ? 8 : 0,
          glowColor: game.accent
        });

        // Mechanics & Controls info
        this.renderer.drawText(game.mechanics, x + cardW / 2, y + 73, {
          font: FONTS.BODY,
          size: 10.5,
          color: PALETTE.CYAN,
          align: 'center',
          bold: false
        });

        this.renderer.drawText(game.controls, x + cardW / 2, y + 95, {
          font: FONTS.BODY,
          size: 10,
          color: PALETTE.MUTED,
          align: 'center',
          bold: false
        });

        this.renderer.drawText(game.enhancements, x + cardW / 2, y + 115, {
          font: FONTS.BODY,
          size: 9.8,
          color: PALETTE.GREEN,
          align: 'center',
          bold: false
        });

        // Launch button pill
        ctx.save();
        ctx.fillStyle = selected ? game.accent : 'rgba(255,255,255,0.07)';
        ctx.fillRect(x + 24, y + 131, cardW - 48, 22);
        ctx.restore();

        this.renderer.drawText(
          selected ? '▶ INSERT COIN [Z/CLICK]' : 'SELECT CABINET',
          x + cardW / 2,
          y + 146,
          {
            font: FONTS.HUD,
            size: 11,
            color: selected ? PALETTE.BG : PALETTE.WHITE,
            align: 'center'
          }
        );
      });
    } else {
      // 5x4 Grid for the 20 Expanded Vault Classics
      const cols = 5;
      const cardW = 174;
      const cardH = 78;
      const gapX = 11;
      const gapY = 10;
      const startX = (W - (cols * cardW + (cols - 1) * gapX)) / 2;
      const startY = 100;

      list.forEach((game, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);
        this.cardRects.push({ x, y, w: cardW, h: cardH });

        const selected = idx === this.selectedIndex;
        const rec = cloudPersistence.getRecord(game.id);
        const rating = cloudPersistence.getEffectiveRating(game.id);
        const hi = Math.max(scores[game.id] || 0, rec.highScore || 0);

        ctx.save();
        ctx.fillStyle = selected ? 'rgba(24, 36, 64, 0.96)' : 'rgba(15, 22, 38, 0.90)';
        ctx.strokeStyle = selected ? game.accent : 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = selected ? 2.2 : 1;
        if (selected) {
          ctx.shadowColor = game.accent;
          ctx.shadowBlur = 12;
        }
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeRect(x, y, cardW, cardH);
        ctx.restore();

        ctx.fillStyle = game.accent;
        ctx.fillRect(x, y, cardW, 3);

        this.renderer.drawText(game.title.toUpperCase(), x + 7, y + 20, {
          font: FONTS.HEADER,
          size: 8.8,
          color: selected ? game.accent : PALETTE.WHITE
        });

        this.renderer.drawText(
          `${rec.saved ? '♥' : ''}★${rating.toFixed(1)} HI:${hi}`,
          x + cardW - 6,
          y + 19,
          {
            font: FONTS.HUD,
            size: 9.8,
            color: PALETTE.GOLD,
            align: 'right'
          }
        );

        this.renderer.drawText(game.mechanics, x + 7, y + 41, {
          font: FONTS.BODY,
          size: 9.5,
          color: PALETTE.MUTED,
          bold: false
        });

        this.renderer.drawText(
          selected ? '▶ PRESS Z / CLICK TO PLAY' : game.controls,
          x + 7,
          y + 62,
          {
            font: FONTS.HUD,
            size: 9.5,
            color: selected ? PALETTE.GREEN : PALETTE.CYAN
          }
        );
      });
    }

    // Selected Game Inspector Footer Strip (with Interactive 1-5 Star Rating & ♥ Bookmark)
    const activeGame = list[this.selectedIndex] || list[0];
    this.inspectorStarRects = [];
    this.inspectorFavRect = null;

    if (activeGame) {
      const rec = cloudPersistence.getRecord(activeGame.id);
      const effRating = cloudPersistence.getEffectiveRating(activeGame.id);
      const userStars = rec.userRating || Math.round(effRating);

      ctx.save();
      ctx.fillStyle = 'rgba(19, 27, 46, 0.95)';
      ctx.strokeStyle = activeGame.accent;
      ctx.lineWidth = 1.5;
      ctx.fillRect(22, 454, W - 44, 72);
      ctx.strokeRect(22, 454, W - 44, 72);
      ctx.restore();

      this.renderer.drawText(`SELECTED: ${activeGame.title.toUpperCase()}`, 36, 478, {
        font: FONTS.HEADER,
        size: 11.5,
        color: activeGame.accent,
        glow: 8
      });

      // Interactive 1-5 Star Rating Widget in Inspector
      this.renderer.drawText('RATE [1-5]:', 355, 478, {
        font: FONTS.HUD,
        size: 11.5,
        color: PALETTE.MUTED
      });

      for (let s = 1; s <= 5; s++) {
        const sx = 425 + (s - 1) * 20;
        const sy = 463;
        this.inspectorStarRects.push({ x: sx, y: sy, w: 19, h: 20 });
        this.renderer.drawText(s <= userStars ? '★' : '☆', sx + 3, 479, {
          font: FONTS.HUD,
          size: 15,
          color: s <= userStars ? PALETTE.GOLD : PALETTE.MUTED
        });
      }

      // Interactive Favorite / Bookmark Pill
      const favX = 538;
      const favY = 463;
      this.inspectorFavRect = { x: favX, y: favY, w: 86, h: 20 };
      ctx.save();
      ctx.fillStyle = rec.saved ? 'rgba(255, 0, 122, 0.25)' : 'rgba(255, 255, 255, 0.06)';
      ctx.strokeStyle = rec.saved ? PALETTE.PINK : PALETTE.MUTED;
      ctx.fillRect(favX, favY, 86, 20);
      ctx.strokeRect(favX, favY, 86, 20);
      ctx.restore();
      this.renderer.drawText(rec.saved ? '♥ SAVED [F]' : '♡ SAVE [F]', favX + 43, 477, {
        font: FONTS.HUD,
        size: 10.5,
        color: rec.saved ? PALETTE.PINK : PALETTE.WHITE,
        align: 'center'
      });

      this.renderer.drawText(
        `CONTROLS: ${activeGame.controls}   |   MODERN TECH: ${activeGame.enhancements}`,
        36,
        506,
        {
          font: FONTS.BODY,
          size: 11.5,
          color: PALETTE.WHITE,
          bold: false
        }
      );

      this.renderer.drawText(
        `♪ BGM: ${
          this.audio && this.audio.getCurrentTrackTitle
            ? this.audio.getCurrentTrackTitle().toUpperCase()
            : 'NEON ARCADE LOBBY'
        }`,
        W - 36,
        478,
        {
          font: FONTS.HUD,
          size: 11.5,
          color: PALETTE.GOLD,
          align: 'right'
        }
      );
    }
  }
}

export default MainMenu;
