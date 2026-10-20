/**
 * MainMenu.js
 * Interactive Canvas & Studio Lobby Menu for Retro Arcade Studio.
 * Features custom-drawn animated miniature arcade screenshots/dioramas for all 28 games,
 * recognizable icons, clear gameplay descriptions, Firebase Cloud Star Ratings (1-5 ★),
 * Favorite Bookmarks (♥), Emulator Save Slots (💾), and Catalog Sorting.
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
    icon: '🧱',
    title: 'Vault Runner',
    classicRef: 'Lode Runner Style',
    category: 'core',
    genre: 'Puzzle Platformer',
    accent: PALETTE.GOLD,
    mechanics: 'Dig bricks to trap guards & collect all gold chests to reveal the escape ladder',
    controls: '4-Way Move/Climb + Dig Left(Z) / Right(X)',
    enhancements: '8s brick regen, WASM A* guard AI & walking on trapped guards'
  },
  {
    id: 'digdug',
    icon: '⛏️',
    title: 'Sub-Terra Driller',
    classicRef: 'Dig Dug Style',
    category: 'core',
    genre: 'Underground Action',
    accent: PALETTE.ORANGE,
    mechanics: 'Carve dirt tunnels, inflate monsters with your air pump & drop boulders on them',
    controls: '4-Way Tunneling + Pump Harpoon (Z/Space)',
    enhancements: '4-color soil strata, 4-stage monster inflation & rock crushes'
  },
  {
    id: 'donkeykong',
    icon: '🦍',
    title: 'Girder Titan',
    classicRef: 'Donkey Kong Style',
    category: 'core',
    genre: 'Arcade Platformer',
    accent: PALETTE.PINK,
    mechanics: 'Climb slanted steel girders, jump rolling barrels & grab hammers across 4 stages',
    controls: 'Left/Right + Up/Down Ladders + Jump (Z/Space)',
    enhancements: '25m Girders, 50m Conveyor, 75m Elevators & 100m Rivet Tower'
  },
  {
    id: 'sumo',
    icon: '🥋',
    title: 'Dohyo Clash',
    classicRef: 'Sumo Wrestling',
    category: 'core',
    genre: 'Ring Combat',
    accent: PALETTE.RED,
    mechanics: 'Push, slap-stun & sidestep your rival sumo wrestler out of the circular clay ring',
    controls: 'Move + Power Shove(Z) + Palm Slap/Sidestep(X)',
    enhancements: 'Stamina friction physics & pulsing ring-edge danger tension'
  },
  {
    id: 'pacman',
    icon: '🍒',
    title: 'Neon Chomper',
    classicRef: 'Pac-Man / Ms. Pac Style',
    category: 'core',
    genre: 'Maze Chase',
    accent: PALETTE.GOLD,
    mechanics: 'Eat all maze dots & power pellets to chomp the 4 colorful ghosts for 200-1600 pts',
    controls: '4-Way D-Pad/Swipe + Toggle Ms. Chomper (X)',
    enhancements: '4 distinct arcade mazes, 4 ghost AI personalities & bonus fruit'
  },
  {
    id: 'frogger',
    icon: '🐸',
    title: 'Cyber Hopper',
    classicRef: 'Frogger Style',
    category: 'core',
    genre: 'Road & River Hop',
    accent: PALETTE.GREEN,
    mechanics: 'Hop your frog across 5 lanes of speeding cars & ride floating river logs to home bays',
    controls: '4-Way Hop / Tap-to-Leap Direction',
    enhancements: 'Diving turtles, bonus flies & strict 60-second life timer'
  },
  {
    id: 'galaga',
    icon: '🚀',
    title: 'Star Squadron',
    classicRef: 'Galaga Style',
    category: 'core',
    genre: 'Space Shooter',
    accent: PALETTE.CYAN,
    mechanics: 'Blast diving alien bug formations & rescue your captured fighter for Dual-Ship guns',
    controls: 'Left/Right Dodge + Fire Twin Lasers (Z/Space)',
    enhancements: 'Boss tractor-beam capture/rescue & 4-shot Dual Fighter mode'
  },
  {
    id: 'spaceinvaders',
    icon: '👾',
    title: 'Cosmic Armada',
    classicRef: 'Space Invaders Style',
    category: 'core',
    genre: 'Fixed Shooter',
    accent: PALETTE.GREEN,
    mechanics: 'Defend Earth behind 4 destructible bunkers against 55 marching alien invaders & UFOs',
    controls: 'Left/Right Cannon + Fire Laser (Z/Space)',
    enhancements: 'Accelerating fleet march heartbeat & pixel-eroded shields'
  },

  // === 20 EXPANDED CLASSICS ===
  {
    id: 'asteroids',
    icon: '☄️',
    title: 'Meteor Vector',
    classicRef: 'Asteroids Style',
    category: 'expanded',
    genre: 'Vector Shooter',
    accent: PALETTE.CYAN,
    mechanics: 'Rotate & thrust your vector ship to shatter splitting boulders & UFO saucers',
    controls: 'Rotate + Thrust(Up) + Fire(Z) + Hyperspace(X)',
    enhancements: 'Glowing vector lines, wrap-around physics & 3-stage rock splits'
  },
  {
    id: 'centipede',
    icon: '🐛',
    title: 'Mycelium Crawler',
    classicRef: 'Centipede Style',
    category: 'expanded',
    genre: 'Bug Blaster',
    accent: PALETTE.GREEN,
    mechanics: 'Shoot the winding multi-segment centipede & spiders through a mushroom field',
    controls: '4-Way Bottom Zone + Rapid Blaster (Z)',
    enhancements: 'Splitting centipede chains, 4-hit mushrooms, Fleas & Scorpions'
  },
  {
    id: 'defender',
    icon: '🛸',
    title: 'Horizon Vanguard',
    classicRef: 'Defender Style',
    category: 'expanded',
    genre: 'Radar Shooter',
    accent: PALETTE.PINK,
    mechanics: 'Fly across a wrap-around alien planet with radar scanner to save colonists',
    controls: 'Thrust/Move + Laser(Z) + Smart Bomb(X)',
    enhancements: 'Live top radar minimap, mid-air human catches & Mutant AI'
  },
  {
    id: 'arkanoid',
    icon: '🏓',
    title: 'Prism Breaker',
    classicRef: 'Arkanoid / Breakout',
    category: 'expanded',
    genre: 'Brick Breaker',
    accent: PALETTE.CYAN,
    mechanics: 'Bounce the energy ball off your paddle to smash 6 brick fortresses & catch capsules',
    controls: 'Left/Right Paddle + Launch/Fire Laser (Z)',
    enhancements: '[E] Expand, [M] 3-Ball Multiball, [L] Dual Lasers & [S] Slow'
  },
  {
    id: 'paperboy',
    icon: '🚲',
    title: 'Courier Dash',
    classicRef: 'Paperboy Style',
    category: 'expanded',
    genre: 'Street Action',
    accent: PALETTE.GOLD,
    mechanics: 'Steer your bike up the street, toss newspapers into mailboxes & dodge hazards',
    controls: 'Steer/Speed + Throw Newspaper (Z)',
    enhancements: 'Subscriber mailboxes, breakable non-subscriber windows & dogs'
  },
  {
    id: 'joust',
    icon: '🦩',
    title: 'Sky Lancer',
    classicRef: 'Joust Style',
    category: 'expanded',
    genre: 'Flying Duel',
    accent: PALETTE.ORANGE,
    mechanics: 'Flap your flying mount above lava & defeat enemy riders by striking from higher up',
    controls: 'Left/Right + Flap Wings (Z / Up)',
    enhancements: 'Higher-lance wins, hatching eggs & grasping Lava Troll Hand'
  },
  {
    id: 'qbert',
    icon: '🟧',
    title: 'Iso Hop',
    classicRef: 'Q*bert Style',
    category: 'expanded',
    genre: 'Isometric Puzzle',
    accent: PALETTE.ORANGE,
    mechanics: 'Hop diagonally across a 3D cube pyramid to flip every tile color while dodging snakes',
    controls: '4-Way Diagonal Pyramid Hops',
    enhancements: 'Coily snake chase AI & floating escape discs on pyramid sides'
  },
  {
    id: 'rampage',
    icon: '🦖',
    title: 'Kaiju Crush',
    classicRef: 'Rampage Style',
    category: 'expanded',
    genre: 'City Smash',
    accent: PALETTE.RED,
    mechanics: 'Climb skyscrapers as a giant monster & punch windows until the buildings collapse',
    controls: 'Climb/Walk + Punch Building(Z) + Jump(X)',
    enhancements: 'Collapsing multi-story towers, helicopters, tanks & snacks'
  },
  {
    id: 'marblemadness',
    icon: '🔮',
    title: 'Gyro Sphere',
    classicRef: 'Marble Madness Style',
    category: 'expanded',
    genre: 'Isometric Race',
    accent: PALETTE.CYAN,
    mechanics: 'Roll your marble down 6 steep 3D isometric ramp courses before the timer expires',
    controls: '4-Way Roll Acceleration + Turbo Boost (Z)',
    enhancements: '6 courses with 3D slopes, ice patches, bumpers & speed pads'
  },
  {
    id: 'pitfall',
    icon: '🌴',
    title: 'Jungle Strider',
    classicRef: 'Pitfall! Style',
    category: 'expanded',
    genre: 'Jungle Adventure',
    accent: PALETTE.GREEN,
    mechanics: 'Swing on vines over tar pits, hop across crocodile jaws & grab jungle treasures',
    controls: 'Run/Climb Ladders + Jump/Grab Vine (Z)',
    enhancements: 'Upper jungle canopy + underground scorpion cavern paths'
  },
  {
    id: 'duckhunt',
    icon: '🦆',
    title: 'Wing Blaster',
    classicRef: 'Duck Hunt Style',
    category: 'expanded',
    genre: 'Light-Gun Shooter',
    accent: PALETTE.GOLD,
    mechanics: 'Click/tap or aim the crosshair to shoot fast-flying ducks with 3 shells per wave',
    controls: 'Click/Tap Duck or Aim Crosshair + Shoot(Z)',
    enhancements: '3-shell shotgun reload, bouncing duck flight & hunting dog'
  },
  {
    id: 'excitebike',
    icon: '🏍️',
    title: 'Nitro Moto',
    classicRef: 'Excitebike Style',
    category: 'expanded',
    genre: 'Motocross Stunt',
    accent: PALETTE.PINK,
    mechanics: 'Race your dirt bike over huge stunt ramps, pitch mid-air & manage turbo engine heat',
    controls: 'Switch Lane/Pitch + Gas(Z) + Turbo Boost(X)',
    enhancements: 'Engine overheat gauge, track cooling arrows & rival bikers'
  },
  {
    id: 'missilecommand',
    icon: '💥',
    title: 'Aegis Intercept',
    classicRef: 'Missile Command Style',
    category: 'expanded',
    genre: 'City Defense',
    accent: PALETTE.RED,
    mechanics: 'Launch counter-missiles from 3 batteries to detonate incoming warheads above 6 cities',
    controls: 'Click/Tap Sky or Aim Crosshair + Fire ABM(Z)',
    enhancements: 'Expanding blast shockwaves that chain-destroy split warheads'
  },
  {
    id: 'burgertime',
    icon: '🍔',
    title: 'Bistro Stacker',
    classicRef: 'BurgerTime Style',
    category: 'expanded',
    genre: 'Kitchen Platform',
    accent: PALETTE.GOLD,
    mechanics: 'Walk across giant buns, patties & lettuce on kitchen scaffolds to drop burgers onto trays',
    controls: '4-Way Scaffold Climb + Throw Pepper Stun(X)',
    enhancements: 'Cascading burger slices & multi-floor enemy crush bonuses'
  },
  {
    id: 'bubblebobble',
    icon: '🫧',
    title: 'Bubble Dragons',
    classicRef: 'Bubble Bobble Style',
    category: 'expanded',
    genre: 'Cave Platformer',
    accent: PALETTE.PINK,
    mechanics: 'Blow bubbles to trap cave monsters, pop them in chains & collect giant bonus fruit',
    controls: 'Move + Blow Bubble(Z) + Jump(X / Up)',
    enhancements: '6 cave layouts, air currents & chain-pop fruit multipliers'
  },
  {
    id: 'spyhunter',
    icon: '🏎️',
    title: 'Highway Agent',
    classicRef: 'Spy Hunter Style',
    category: 'expanded',
    genre: 'Combat Driving',
    accent: PALETTE.CYAN,
    mechanics: 'Drive your armed spy car at high speed, firing machine guns & dropping oil slicks',
    controls: 'Steer/Speed + Machine Gun(Z) + Oil/Smoke(X)',
    enhancements: 'Dock inside the red Weapons Van for Oil & Smoke upgrades'
  },
  {
    id: 'tron',
    icon: '🟦',
    title: 'Light Grid',
    classicRef: 'Tron Light Cycles',
    category: 'expanded',
    genre: 'Light Cycle Arena',
    accent: PALETTE.CYAN,
    mechanics: 'Steer your neon light cycle at 90° angles to trap rival AI cycles behind light walls',
    controls: '4-Way 90° Turns + Turbo Boost(Z) + Brake(X)',
    enhancements: 'Predictive raycast AI cycles & high-speed trail boxing'
  },
  {
    id: 'trackandfield',
    icon: '🏅',
    title: 'Cyber Decathlon',
    classicRef: 'Track & Field Style',
    category: 'expanded',
    genre: 'Olympic Sports',
    accent: PALETTE.GOLD,
    mechanics: 'Mash sprint buttons to build speed & time your launch angle in 3 stadium events',
    controls: 'Mash Run(Z or L/R) + Jump/Throw Angle(X)',
    enhancements: '100m Dash, Long Jump & Javelin Throw with foul-line angles'
  },
  {
    id: 'outrun',
    icon: '🌅',
    title: 'Synthwave Horizon',
    classicRef: 'OutRun Style',
    category: 'expanded',
    genre: '3D Arcade Racer',
    accent: PALETTE.PINK,
    mechanics: 'Drift your red convertible at 290 km/h down branching palm-lined sunset highways',
    controls: 'Steer + Accelerate(Z/Up) + Drift Brake(X/Down)',
    enhancements: '3D hills & curves, tire smoke drifts & Left/Right road forks'
  },
  {
    id: 'contra',
    icon: '🪖',
    title: 'Commando Strike',
    classicRef: 'Contra Style',
    category: 'expanded',
    genre: 'Run & Gun',
    accent: PALETTE.RED,
    mechanics: 'Run-and-gun across jungle bridges with 8-way aiming & 5-way Spread Shot powerups',
    controls: '8-Way Aim/Move + Shoot(Z) + Jump(X)',
    enhancements: 'Spread Shot [S], Rapid [R], Laser [L] & Fortress Wall Boss'
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

  /**
   * Renders a bespoke, animated miniature arcade screenshot/diorama for each of the 28 games
   * so the user can visually identify every game at a glance.
   */
  drawGamePreview(ctx, gameId, x, y, w, h, t = 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // CRT Mini-Screen Background
    ctx.fillStyle = '#060913';
    ctx.fillRect(x, y, w, h);

    const cx = x + w / 2;
    const cy = y + h / 2;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);

    switch (gameId) {
      case 'loderunner': {
        // Brick platforms, ladder, gold chest, runner & trapped guard
        ctx.fillStyle = '#B91C1C';
        for (let bx = x + 4; bx < x + w - 4; bx += 12) {
          if (Math.abs(bx - (x + w * 0.48)) > 8) {
            ctx.fillRect(bx, y + h * 0.65, 10, 6);
          }
          ctx.fillRect(bx, y + h * 0.34, 10, 6);
        }
        // Ladder
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 1.5;
        const lx = x + w * 0.76;
        ctx.strokeRect(lx, y + h * 0.2, 10, h * 0.65);
        for (let ry = y + h * 0.25; ry < y + h * 0.82; ry += 6) {
          ctx.beginPath();
          ctx.moveTo(lx, ry);
          ctx.lineTo(lx + 10, ry);
          ctx.stroke();
        }
        // Gold chests
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x + w * 0.18, y + h * 0.24, 9, 6);
        ctx.fillRect(x + w * 0.6, y + h * 0.55, 9, 6);
        // Trapped Red Guard in dug hole
        ctx.fillStyle = '#FF2A55';
        ctx.fillRect(x + w * 0.45, y + h * 0.62, 7, 9);
        // White Runner digging
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + w * 0.28, y + h * 0.51, 7, 12);
        break;
      }

      case 'digdug': {
        // 4 underground soil strata + tunnel + inflated Pooka
        const strata = ['#D97706', '#EA580C', '#B91C1C', '#581C87'];
        const sh = h / 4;
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = strata[i];
          ctx.fillRect(x, y + i * sh, w, sh + 1);
        }
        // Carved black tunnel
        ctx.fillStyle = '#060913';
        ctx.fillRect(x + w * 0.18, y + h * 0.42, w * 0.64, h * 0.26);
        ctx.fillRect(x + w * 0.44, y + h * 0.12, w * 0.14, h * 0.45);
        // White/Blue Driller
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(x + w * 0.24, y + h * 0.46, 9, 9);
        // Pump harpoon line
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.33, y + h * 0.51);
        ctx.lineTo(x + w * 0.56, y + h * 0.51);
        ctx.stroke();
        // Inflating Red Pooka with goggles
        const r = 7 + pulse * 3.5;
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(x + w * 0.64, y + h * 0.51, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(x + w * 0.61, y + h * 0.48, 5, 3);
        break;
      }

      case 'donkeykong': {
        // Slanted red steel girders + ladder + rolling barrel + Kong
        ctx.strokeStyle = '#FF007A';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(x + 6, y + h * 0.3);
        ctx.lineTo(x + w - 10, y + h * 0.38);
        ctx.moveTo(x + 10, y + h * 0.78);
        ctx.lineTo(x + w - 6, y + h * 0.68);
        ctx.stroke();
        // Ladder
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + w * 0.72, y + h * 0.36, 9, h * 0.35);
        // Giant Ape on top left
        ctx.fillStyle = '#B45309';
        ctx.fillRect(x + 12, y + h * 0.12, 14, 13);
        // Rolling orange barrel
        const bx = x + w * 0.35 + ((t * 28) % (w * 0.35));
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(bx, y + h * 0.67, 5.5, 0, Math.PI * 2);
        ctx.fill();
        // Jumper leaping over barrel
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(x + w * 0.46, y + h * 0.48 - Math.abs(Math.sin(t * 5)) * 7, 7, 10);
        break;
      }

      case 'sumo': {
        // Dohyo clay ring & Tawara straw border + 2 Rikishi colliding
        const rad = Math.min(w, h) * 0.38;
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Two wrestlers pushing at center
        ctx.fillStyle = '#FDBA74';
        ctx.beginPath();
        ctx.arc(cx - 7, cy, 6.5, 0, Math.PI * 2);
        ctx.arc(cx + 7, cy, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(cx - 10, cy - 3, 5, 6);
        ctx.fillStyle = '#FF2A55';
        ctx.fillRect(cx + 5, cy - 3, 5, 6);
        break;
      }

      case 'pacman': {
        // Neon blue maze walls + dots + yellow Pac-Man + Red/Cyan ghosts
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
        ctx.strokeRect(x + w * 0.28, y + h * 0.28, w * 0.44, h * 0.16);
        // Pac-Dots & Power Pellet
        ctx.fillStyle = '#FDE68A';
        for (let dx = x + w * 0.45; dx < x + w - 12; dx += 10) {
          ctx.fillRect(dx, cy + 4, 3, 3);
        }
        // Yellow Chomper
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        const mouth = 0.15 + 0.25 * Math.abs(Math.sin(t * 8));
        ctx.arc(x + w * 0.32, cy + 5, 7.5, mouth * Math.PI, (2 - mouth) * Math.PI);
        ctx.lineTo(x + w * 0.32, cy + 5);
        ctx.fill();
        // Red Ghost (Blinky)
        const gx = x + w * 0.68;
        const gy = cy + 5;
        ctx.fillStyle = '#FF2A55';
        ctx.beginPath();
        ctx.arc(gx, gy - 2, 6.5, Math.PI, 0);
        ctx.lineTo(gx + 6.5, gy + 6);
        ctx.lineTo(gx - 6.5, gy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(gx - 4, gy - 4, 3, 3);
        ctx.fillRect(gx + 1, gy - 4, 3, 3);
        break;
      }

      case 'frogger': {
        // River top half, road bottom half, logs, car & green frog
        ctx.fillStyle = '#0C4A6E';
        ctx.fillRect(x, y, w, h * 0.48);
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(x, y + h * 0.52, w, h * 0.48);
        // Floating river log
        ctx.fillStyle = '#92400E';
        ctx.fillRect(x + w * 0.22, y + h * 0.2, w * 0.45, 8);
        // Speeding race car
        ctx.fillStyle = '#FF2A55';
        ctx.fillRect(x + w * 0.55, y + h * 0.66, 16, 9);
        // Green Frog
        ctx.fillStyle = '#00FF66';
        ctx.beginPath();
        ctx.arc(cx, y + h * 0.48, 5.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'galaga': {
        // Boss alien + tractor beam cone + Dual Fighter firing 4 lasers
        ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
        ctx.beginPath();
        ctx.moveTo(cx, y + h * 0.28);
        ctx.lineTo(cx - 18, y + h * 0.85);
        ctx.lineTo(cx + 18, y + h * 0.85);
        ctx.closePath();
        ctx.fill();
        // Boss Galaga at top
        ctx.fillStyle = '#00FF66';
        ctx.fillRect(cx - 7, y + h * 0.14, 14, 9);
        ctx.fillStyle = '#FF2A55';
        ctx.fillRect(cx - 4, y + h * 0.1, 8, 5);
        // Dual Fighter ships at bottom
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cx - 12, y + h * 0.76, 9, 8);
        ctx.fillRect(cx + 3, y + h * 0.76, 9, 8);
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(cx - 10, y + h * 0.46, 2, 10);
        ctx.fillRect(cx + 8, y + h * 0.46, 2, 10);
        break;
      }

      case 'spaceinvaders': {
        // Pixel invaders + green arch bunker + laser cannon
        const colors = ['#FF007A', '#00F0FF', '#00FF66'];
        for (let r = 0; r < 2; r++) {
          ctx.fillStyle = colors[r];
          for (let c = 0; c < 4; c++) {
            const ix = x + 14 + c * ((w - 28) / 3.5);
            const iy = y + 8 + r * 11;
            ctx.fillRect(ix, iy, 8, 6);
          }
        }
        // Green Defense Bunker
        ctx.fillStyle = '#00FF66';
        ctx.fillRect(cx - 12, y + h * 0.58, 24, 9);
        // Player Cannon
        ctx.fillRect(cx - 7, y + h * 0.82, 14, 5);
        ctx.fillRect(cx - 1.5, y + h * 0.75, 3, 7);
        break;
      }

      case 'asteroids': {
        // Vector polygon rocks + wireframe triangle ship
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 1.6;
        // Vector Ship
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy + 6);
        ctx.lineTo(cx + 8, cy);
        ctx.lineTo(cx - 6, cy - 6);
        ctx.closePath();
        ctx.stroke();
        // Vector Asteroid
        ctx.strokeStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(x + w * 0.74, y + h * 0.38, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + w * 0.24, y + h * 0.65, 7, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'centipede': {
        // Mushrooms + winding multi-segment centipede chain
        ctx.fillStyle = '#FF007A';
        ctx.fillRect(x + w * 0.22, y + h * 0.3, 6, 5);
        ctx.fillRect(x + w * 0.72, y + h * 0.55, 6, 5);
        // Segmented centipede
        for (let s = 0; s < 6; s++) {
          ctx.fillStyle = s === 0 ? '#FFD700' : '#00FF66';
          ctx.beginPath();
          ctx.arc(x + w * 0.3 + s * 8, y + h * 0.42 + Math.sin(s + t * 5) * 3, 4.2, 0, Math.PI * 2);
          ctx.fill();
        }
        // Bug Blaster at bottom
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(cx - 4, y + h * 0.8, 8, 7);
        break;
      }

      case 'defender': {
        // Alien mountain terrain + side-scrolling fighter + horizontal laser
        ctx.strokeStyle = '#B829FF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.82);
        ctx.lineTo(x + w * 0.3, y + h * 0.62);
        ctx.lineTo(x + w * 0.6, y + h * 0.8);
        ctx.lineTo(x + w, y + h * 0.66);
        ctx.stroke();
        // Fighter ship
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(x + w * 0.16, cy - 4, 14, 6);
        // Horizontal laser beam
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(x + w * 0.32, cy - 1, w * 0.48, 2);
        // Green Lander
        ctx.fillStyle = '#00FF66';
        ctx.fillRect(x + w * 0.78, cy - 5, 8, 8);
        break;
      }

      case 'arkanoid': {
        // Rainbow brick rows + bouncing ball + Vaus paddle
        const bCols = ['#FF2A55', '#FF8800', '#FFD700', '#00FF66', '#00F0FF'];
        for (let r = 0; r < 3; r++) {
          ctx.fillStyle = bCols[r];
          for (let c = 0; c < 5; c++) {
            ctx.fillRect(x + 8 + c * ((w - 16) / 5), y + 7 + r * 6, (w - 24) / 5, 4.5);
          }
        }
        // Paddle
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(cx - 14, y + h - 10, 28, 5);
        // Ball
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx + 6, y + h * 0.58, 3.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'paperboy': {
        // Diagonal street + mailbox + bike throwing paper
        ctx.fillStyle = '#15803D';
        ctx.fillRect(x, y, w * 0.42, h);
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + w * 0.42, y, w * 0.58, h);
        // Mailbox
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x + w * 0.22, y + h * 0.28, 9, 8);
        // Rolled paper in flight
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + w * 0.42, y + h * 0.42, 7, 4);
        // Cyclist
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(x + w * 0.62, y + h * 0.6, 8, 12);
        break;
      }

      case 'joust': {
        // Lava pit + stone platform + 2 winged riders with lances
        ctx.fillStyle = '#EA580C';
        ctx.fillRect(x, y + h - 7, w, 7);
        ctx.fillStyle = '#92400E';
        ctx.fillRect(x + w * 0.2, y + h * 0.62, w * 0.6, 5);
        // Player Higher Mount
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x + w * 0.28, y + h * 0.3, 10, 8);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + w * 0.38, y + h * 0.33, 9, 2);
        // Enemy Lower Mount
        ctx.fillStyle = '#FF2A55';
        ctx.fillRect(x + w * 0.62, y + h * 0.44, 10, 8);
        break;
      }

      case 'qbert': {
        // Isometric pyramid cubes + orange hopper
        const cubeCoords = [
          [cx, y + 12],
          [cx - 10, y + 22],
          [cx + 10, y + 22],
          [cx - 20, y + 32],
          [cx, y + 32],
          [cx + 20, y + 32]
        ];
        cubeCoords.forEach(([qx, qy], idx) => {
          ctx.fillStyle = idx < 3 ? '#FFD700' : '#00F0FF';
          ctx.fillRect(qx - 7, qy, 14, 6);
          ctx.fillStyle = '#1E3A8A';
          ctx.fillRect(qx - 7, qy + 6, 14, 5);
        });
        // Orange Q*bert
        ctx.fillStyle = '#FF8800';
        ctx.beginPath();
        ctx.arc(cx - 10, y + 18, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'rampage': {
        // Skyscraper with windows + giant green Kaiju monster clinging to side
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + w * 0.38, y + 8, w * 0.42, h - 8);
        ctx.fillStyle = '#FDE047';
        for (let wy = y + 14; wy < y + h - 8; wy += 10) {
          ctx.fillRect(x + w * 0.44, wy, 5, 5);
          ctx.fillRect(x + w * 0.62, wy, 5, 5);
        }
        // Giant Green Monster climbing
        ctx.fillStyle = '#00FF66';
        ctx.fillRect(x + w * 0.24, y + h * 0.36, 12, 18);
        break;
      }

      case 'marblemadness': {
        // Isometric sloped teal ramp + glossy cyan marble
        ctx.fillStyle = '#0D9488';
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 12);
        ctx.lineTo(x + w - 10, y + h * 0.45);
        ctx.lineTo(x + w - 16, y + h - 8);
        ctx.lineTo(x + 6, y + h * 0.55);
        ctx.closePath();
        ctx.fill();
        // Glossy Marble
        ctx.fillStyle = '#00F0FF';
        ctx.beginPath();
        ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cx - 3, cy - 3, 2.5, 2.5);
        break;
      }

      case 'pitfall': {
        // Jungle canopy, swinging vine & crocodile jaws in swamp
        ctx.fillStyle = '#14532D';
        ctx.fillRect(x, y, w, 9);
        ctx.fillStyle = '#15803D';
        ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(x + w * 0.28, y + h * 0.72, w * 0.44, h * 0.28);
        // Swinging Vine
        ctx.strokeStyle = '#86EFAC';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, y + 9);
        ctx.lineTo(cx + Math.sin(t * 4) * 12, y + h * 0.56);
        ctx.stroke();
        // Explorer on vine
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(cx + Math.sin(t * 4) * 12 - 3, y + h * 0.52, 6, 10);
        break;
      }

      case 'duckhunt': {
        // Sky, green grass, flying duck & red light-gun crosshair
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(x, y, w, h * 0.72);
        ctx.fillStyle = '#16A34A';
        ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
        // Flying Duck
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(cx - 5, y + h * 0.36, 11, 7);
        // Red Target Crosshair
        ctx.strokeStyle = '#FF2A55';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, y + h * 0.39, 10, 0, Math.PI * 2);
        ctx.moveTo(cx - 13, y + h * 0.39);
        ctx.lineTo(cx + 13, y + h * 0.39);
        ctx.moveTo(cx, y + h * 0.39 - 13);
        ctx.lineTo(cx, y + h * 0.39 + 13);
        ctx.stroke();
        break;
      }

      case 'excitebike': {
        // Track + jump ramp + motocross bike popping wheelie
        ctx.fillStyle = '#9A3412';
        ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
        // Ramp
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.moveTo(x + w * 0.25, y + h * 0.75);
        ctx.lineTo(x + w * 0.52, y + h * 0.45);
        ctx.lineTo(x + w * 0.52, y + h * 0.75);
        ctx.closePath();
        ctx.fill();
        // Bike mid-air
        ctx.fillStyle = '#FF007A';
        ctx.fillRect(x + w * 0.56, y + h * 0.28, 12, 8);
        break;
      }

      case 'missilecommand': {
        // Cities at bottom + red incoming missile lines + glowing blast circle
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(x + 10, y + h - 7, 10, 7);
        ctx.fillRect(cx - 5, y + h - 7, 10, 7);
        ctx.fillRect(x + w - 20, y + h - 7, 10, 7);
        // Incoming red trails
        ctx.strokeStyle = '#FF2A55';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 12, y);
        ctx.lineTo(cx - 4, cy);
        ctx.moveTo(x + w - 10, y);
        ctx.lineTo(cx + 12, cy - 4);
        ctx.stroke();
        // Blast fireball
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(cx - 4, cy, 7 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'burgertime': {
        // Stacked giant burger layers (Top Bun, Lettuce, Patty, Cheese, Bottom Bun)
        const layers = ['#F59E0B', '#22C55E', '#92400E', '#FACC15', '#D97706'];
        layers.forEach((col, idx) => {
          ctx.fillStyle = col;
          ctx.fillRect(cx - 18, y + 8 + idx * ((h - 16) / 5), 36, 5.5);
        });
        // Chef Hat icon on left
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + 8, cy - 6, 8, 10);
        break;
      }

      case 'bubblebobble': {
        // Green dragon + translucent cyan bubbles trapping enemy
        ctx.fillStyle = '#00FF66';
        ctx.fillRect(x + 10, y + h - 16, 10, 11);
        // Floating Cyan Bubbles
        ctx.strokeStyle = '#00F0FF';
        ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx + 4, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Trapped Red Zen-Chan inside bubble
        ctx.fillStyle = '#FF2A55';
        ctx.fillRect(cx + 1, cy - 3, 6, 6);
        break;
      }

      case 'spyhunter': {
        // Top-down highway road + white spy car firing guns + red weapons van
        ctx.fillStyle = '#14532D';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + w * 0.24, y, w * 0.52, h);
        // Red Weapons Van ahead
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(cx - 6, y + 6, 12, 16);
        // White Spy Car behind
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(cx - 5, y + h - 18, 10, 14);
        break;
      }

      case 'tron': {
        // 90-degree neon cyan & orange light-cycle wall trails
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + h - 10);
        ctx.lineTo(x + 8, y + 12);
        ctx.lineTo(cx + 6, y + 12);
        ctx.lineTo(cx + 6, cy + 4);
        ctx.stroke();

        ctx.strokeStyle = '#FF8800';
        ctx.beginPath();
        ctx.moveTo(x + w - 8, y + 10);
        ctx.lineTo(x + w - 8, y + h - 12);
        ctx.lineTo(cx - 6, y + h - 12);
        ctx.lineTo(cx - 6, cy - 4);
        ctx.stroke();
        break;
      }

      case 'trackandfield': {
        // Red Olympic running lanes + athlete sprinting
        ctx.fillStyle = '#B91C1C';
        ctx.fillRect(x, y + h * 0.45, w, h * 0.55);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.65);
        ctx.lineTo(x + w, y + h * 0.65);
        ctx.moveTo(x, y + h * 0.85);
        ctx.lineTo(x + w, y + h * 0.85);
        ctx.stroke();
        // Sprinter
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 4, y + h * 0.34, 8, 14);
        break;
      }

      case 'outrun': {
        // Synthwave sunset sun + perspective 3D road + red sports car
        ctx.fillStyle = '#FF007A';
        ctx.beginPath();
        ctx.arc(cx, y + h * 0.42, 11, Math.PI, 0);
        ctx.fill();
        // 3D Road trapezoid
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(cx - 6, y + h * 0.42);
        ctx.lineTo(cx + 6, y + h * 0.42);
        ctx.lineTo(x + w - 6, y + h);
        ctx.lineTo(x + 6, y + h);
        ctx.closePath();
        ctx.fill();
        // Red Testarossa car
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(cx - 9, y + h - 13, 18, 8);
        break;
      }

      case 'contra':
      default: {
        // Commando firing 5-way red Spread Shot fan at boss core
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(x + 10, cy - 6, 8, 14);
        // 5-way Spread Shot red energy bullets
        ctx.fillStyle = '#FF2A55';
        for (let a = -2; a <= 2; a++) {
          const bx = x + 26 + ((t * 35) % (w * 0.45));
          const by = cy + a * 5;
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // Alien Boss Core on right
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x + w - 12, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    // Subtle CRT scanline & inner bezel border on preview screen
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.32)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
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
    this.renderer.drawText('RETRO ARCADE STUDIO', W / 2, 30, {
      font: FONTS.HEADER,
      size: 19,
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
      49,
      {
        font: FONTS.HUD,
        size: 10.5,
        color: PALETTE.GOLD,
        align: 'center'
      }
    );

    // Category Tabs + Cloud Sort Pill
    const sortMode = this.getSortMode();
    this.tabRects = [
      { id: 'core', label: '🕹️ CORE 8 ARCHETYPES (FEATURED)', x: 80, y: 58, w: 270, h: 28 },
      { id: 'expanded', label: '👾 EXPANDED VAULT (20 CLASSICS)', x: 362, y: 58, w: 270, h: 28 },
      { id: 'sort', label: sortMode.label, x: 644, y: 58, w: 236, h: 28 }
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
        size: 11,
        color: isSort ? PALETTE.GOLD : active ? PALETTE.CYAN : PALETTE.MUTED,
        align: 'center'
      });
    }

    const list = this.getVisibleGames();
    this.cardRects = [];

    if (this.activeTab === 'core') {
      // 4x2 Featured Cabinet Cards with Live Miniature Arcade Screenshots
      const cols = 4;
      const cardW = 216;
      const cardH = 166;
      const gapX = 16;
      const gapY = 14;
      const startX = (W - (cols * cardW + (cols - 1) * gapX)) / 2;
      const startY = 96;

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
        ctx.fillStyle = selected ? 'rgba(24, 36, 64, 0.96)' : 'rgba(15, 22, 38, 0.92)';
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

        // Star Rating + Favorite Heart + Save State Badge + High Score
        const favIcon = rec.saved ? '♥ ' : '';
        const saveIcon = hasSave ? ' 💾' : '';
        this.renderer.drawText(
          `${favIcon}★${rating.toFixed(1)}${saveIcon}`,
          x + 8,
          y + 18,
          {
            font: FONTS.HUD,
            size: 10.5,
            color: rec.saved ? PALETTE.PINK : PALETTE.GOLD
          }
        );

        this.renderer.drawText(`HI: ${String(hi).padStart(6, '0')}`, x + cardW - 8, y + 18, {
          font: FONTS.HUD,
          size: 10.5,
          color: PALETTE.GOLD,
          align: 'right'
        });

        // Live Miniature Arcade Screenshot Preview (200x58)
        this.drawGamePreview(ctx, game.id, x + 8, y + 23, cardW - 16, 56, this.animTime);

        // Game Icon + Title + Genre/Classic Ref Badge
        this.renderer.drawText(
          `${game.icon || '🕹️'} ${game.title.toUpperCase()}`,
          x + cardW / 2,
          y + 95,
          {
            font: FONTS.HEADER,
            size: 10,
            color: PALETTE.WHITE,
            align: 'center',
            glow: selected ? 8 : 0,
            glowColor: game.accent
          }
        );

        this.renderer.drawText(
          `${game.classicRef} • ${game.genre}`,
          x + cardW / 2,
          y + 111,
          {
            font: FONTS.HUD,
            size: 9.5,
            color: PALETTE.CYAN,
            align: 'center'
          }
        );

        // Clear, non-vague 1-line gameplay summary
        const shortDesc =
          game.mechanics.length > 42 ? game.mechanics.slice(0, 41) + '…' : game.mechanics;
        this.renderer.drawText(shortDesc, x + cardW / 2, y + 127, {
          font: FONTS.BODY,
          size: 9.2,
          color: PALETTE.MUTED,
          align: 'center',
          bold: false
        });

        // Launch button pill
        ctx.save();
        ctx.fillStyle = selected ? game.accent : 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 16, y + 137, cardW - 32, 21);
        ctx.restore();

        this.renderer.drawText(
          selected ? '▶ INSERT COIN [Z / CLICK]' : '▶ PLAY CABINET',
          x + cardW / 2,
          y + 151,
          {
            font: FONTS.HUD,
            size: 10.5,
            color: selected ? PALETTE.BG : PALETTE.WHITE,
            align: 'center'
          }
        );
      });
    } else {
      // 5x4 Grid for the 20 Expanded Vault Classics with Left-Side Live Screenshot Thumbnail
      const cols = 5;
      const cardW = 176;
      const cardH = 80;
      const gapX = 10;
      const gapY = 9;
      const startX = (W - (cols * cardW + (cols - 1) * gapX)) / 2;
      const startY = 96;

      list.forEach((game, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);
        this.cardRects.push({ x, y, w: cardW, h: cardH });

        const selected = idx === this.selectedIndex;
        const rec = cloudPersistence.getRecord(game.id);
        const rating = cloudPersistence.getEffectiveRating(game.id);

        ctx.save();
        ctx.fillStyle = selected ? 'rgba(24, 36, 64, 0.96)' : 'rgba(15, 22, 38, 0.92)';
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

        // Left-side Miniature Arcade Screenshot (54x54)
        this.drawGamePreview(ctx, game.id, x + 6, y + 20, 54, 54, this.animTime);

        // Top Row: Icon + Title + Star Rating
        this.renderer.drawText(
          `${game.icon || '🕹️'} ${game.title.toUpperCase()}`,
          x + 6,
          y + 15,
          {
            font: FONTS.HEADER,
            size: 7.5,
            color: selected ? game.accent : PALETTE.WHITE
          }
        );

        this.renderer.drawText(
          `${rec.saved ? '♥' : ''}★${rating.toFixed(1)}`,
          x + cardW - 5,
          y + 15,
          {
            font: FONTS.HUD,
            size: 9.2,
            color: PALETTE.GOLD,
            align: 'right'
          }
        );

        // Right-side Clear Classic Reference & Genre
        this.renderer.drawText(game.classicRef, x + 65, y + 33, {
          font: FONTS.HUD,
          size: 9.5,
          color: PALETTE.CYAN
        });

        // 2-Line recognizable gameplay summary next to screenshot
        const words = game.mechanics.split(' ');
        let line1 = '';
        let line2 = '';
        for (const w of words) {
          if ((line1 + ' ' + w).trim().length <= 19) {
            line1 = (line1 + ' ' + w).trim();
          } else if ((line2 + ' ' + w).trim().length <= 19) {
            line2 = (line2 + ' ' + w).trim();
          }
        }
        this.renderer.drawText(line1, x + 65, y + 48, {
          font: FONTS.BODY,
          size: 8.8,
          color: PALETTE.MUTED,
          bold: false
        });
        this.renderer.drawText(line2, x + 65, y + 60, {
          font: FONTS.BODY,
          size: 8.8,
          color: PALETTE.MUTED,
          bold: false
        });

        this.renderer.drawText(
          selected ? '▶ CLICK / Z TO PLAY' : game.genre.toUpperCase(),
          x + 65,
          y + 73,
          {
            font: FONTS.HUD,
            size: 8.8,
            color: selected ? PALETTE.GREEN : PALETTE.GOLD
          }
        );
      });
    }

    // Selected Game Inspector Footer Strip (with Large Live Screenshot, Clear Description & 1-5 Star Rating)
    const activeGame = list[this.selectedIndex] || list[0];
    this.inspectorStarRects = [];
    this.inspectorFavRect = null;

    if (activeGame) {
      const rec = cloudPersistence.getRecord(activeGame.id);
      const effRating = cloudPersistence.getEffectiveRating(activeGame.id);
      const userStars = rec.userRating || Math.round(effRating);

      ctx.save();
      ctx.fillStyle = 'rgba(19, 27, 46, 0.96)';
      ctx.strokeStyle = activeGame.accent;
      ctx.lineWidth = 1.5;
      ctx.fillRect(20, 450, W - 40, 78);
      ctx.strokeRect(20, 450, W - 40, 78);
      ctx.restore();

      // Large Live Animated Screenshot inside the Inspector (118x64)
      this.drawGamePreview(ctx, activeGame.id, 28, 457, 118, 64, this.animTime);

      const textLeft = 158;
      this.renderer.drawText(
        `${activeGame.icon || '🕹️'} ${activeGame.title.toUpperCase()}  (${activeGame.classicRef.toUpperCase()})`,
        textLeft,
        472,
        {
          font: FONTS.HEADER,
          size: 10.5,
          color: activeGame.accent,
          glow: 8
        }
      );

      // Interactive 1-5 Star Rating Widget in Inspector
      this.renderer.drawText('RATE [1-5]:', 525, 472, {
        font: FONTS.HUD,
        size: 10.5,
        color: PALETTE.MUTED
      });

      for (let s = 1; s <= 5; s++) {
        const sx = 592 + (s - 1) * 19;
        const sy = 457;
        this.inspectorStarRects.push({ x: sx, y: sy, w: 18, h: 20 });
        this.renderer.drawText(s <= userStars ? '★' : '☆', sx + 2, 473, {
          font: FONTS.HUD,
          size: 14.5,
          color: s <= userStars ? PALETTE.GOLD : PALETTE.MUTED
        });
      }

      // Interactive Favorite / Bookmark Pill
      const favX = 696;
      const favY = 457;
      this.inspectorFavRect = { x: favX, y: favY, w: 82, h: 19 };
      ctx.save();
      ctx.fillStyle = rec.saved ? 'rgba(255, 0, 122, 0.25)' : 'rgba(255, 255, 255, 0.06)';
      ctx.strokeStyle = rec.saved ? PALETTE.PINK : PALETTE.MUTED;
      ctx.fillRect(favX, favY, 82, 19);
      ctx.strokeRect(favX, favY, 82, 19);
      ctx.restore();
      this.renderer.drawText(rec.saved ? '♥ SAVED [F]' : '♡ SAVE [F]', favX + 41, 470, {
        font: FONTS.HUD,
        size: 10,
        color: rec.saved ? PALETTE.PINK : PALETTE.WHITE,
        align: 'center'
      });

      // Clear Gameplay Description & Controls in Inspector
      this.renderer.drawText(`GAMEPLAY: ${activeGame.mechanics}`, textLeft, 494, {
        font: FONTS.BODY,
        size: 11,
        color: PALETTE.WHITE,
        bold: false
      });

      this.renderer.drawText(
        `CONTROLS: ${activeGame.controls}   •   FEATURES: ${activeGame.enhancements}`,
        textLeft,
        514,
        {
          font: FONTS.HUD,
          size: 10.5,
          color: PALETTE.CYAN
        }
      );

      this.renderer.drawText(
        `♪ ${
          this.audio && this.audio.getCurrentTrackTitle
            ? this.audio.getCurrentTrackTitle().toUpperCase()
            : 'ARCADE SYNTH'
        }`,
        W - 30,
        472,
        {
          font: FONTS.HUD,
          size: 10,
          color: PALETTE.GOLD,
          align: 'right'
        }
      );
    }
  }
}

export default MainMenu;
