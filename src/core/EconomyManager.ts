import { PlayerId } from './Types';

export interface MascotSkin {
  id: string;
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  description: string;
  price: number;
  previewColor: string;
  cosmeticEffect:
    | 'classic'
    | 'gold_sparkles'
    | 'neon_pulse'
    | 'shadow_smoke'
    | 'inferno_flame'
    | 'frost_crystals'
    | 'cosmic_stars'
    | 'arcade_retro'
    | 'toxic_ooze'
    | 'steam_mechanic'
    | 'samurai_ronin'
    | 'deep_abyss'
    | 'plasma_storm'
    | 'spectral_phantom'
    | 'rainbow_aurora'
    | 'quantum_overlord'
    | 'soundwave_eq'
    | 'targeting_hud'
    | 'magma_eruption'
    | 'valkyrie_wings'
    | 'dragon_scales'
    | 'void_singularity'
    | 'alien_beam'
    | 'western_spurs'
    | 'chef_steam'
    | 'disco_lights'
    | 'holy_radiance'
    | 'hero_energy'
    | 'arcane_runes'
    | 'pirate_cannon'
    | 'viking_frost'
    | 'kitsune_wisps'
    | 'astro_thruster';
}

export const SKIN_CATALOG: MascotSkin[] = [
  {
    id: 'classic',
    name: 'Classic Arena',
    rarity: 'Common',
    description: 'Original high-contrast team competition chassis colors with signature crests.',
    price: 0,
    previewColor: '#EF4444',
    cosmeticEffect: 'classic'
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Neon 2088',
    rarity: 'Rare',
    description: 'High-voltage synthwave aesthetic with pulsing cyan circuitry and electric visor.',
    price: 45,
    previewColor: '#06B6D4',
    cosmeticEffect: 'neon_pulse'
  },
  {
    id: 'arcade_retro',
    name: '8-Bit CRT Hero',
    rarity: 'Rare',
    description: 'Emerald phosphor arcade CRT chassis with retro scanlines and pixel grid glow.',
    price: 55,
    previewColor: '#22C55E',
    cosmeticEffect: 'arcade_retro'
  },
  {
    id: 'toxic_ooze',
    name: 'Radioactive Slime',
    rarity: 'Rare',
    description: 'Bioluminescent biohazard reactor shell with bubbling lime acid droplets.',
    price: 60,
    previewColor: '#84CC16',
    cosmeticEffect: 'toxic_ooze'
  },
  {
    id: 'shadow_ninja',
    name: 'Midnight Phantom',
    rarity: 'Rare',
    description: 'Stealth matte-carbon chassis with crimson ocular sensor and shadow mist aura.',
    price: 65,
    previewColor: '#475569',
    cosmeticEffect: 'shadow_smoke'
  },
  {
    id: 'neon_dj',
    name: 'Synthwave Beat Jockey',
    rarity: 'Rare',
    description: 'Chroma equalizer headphones with live stereo visualizer bars and neon soundwaves.',
    price: 65,
    previewColor: '#06B6D4',
    cosmeticEffect: 'soundwave_eq'
  },
  {
    id: 'steam_mechanic',
    name: 'Steampunk Chrono',
    rarity: 'Rare',
    description: 'Burnished brass plating with ticking clockwork cogs and pressurized steam jets.',
    price: 70,
    previewColor: '#B45309',
    cosmeticEffect: 'steam_mechanic'
  },
  {
    id: 'inferno_blaze',
    name: 'Inferno Volcanic',
    rarity: 'Epic',
    description: 'Molten obsidian shell with glowing magma fissures and continuous ember plumes.',
    price: 90,
    previewColor: '#F97316',
    cosmeticEffect: 'inferno_flame'
  },
  {
    id: 'frost_titan',
    name: 'Glacial Frost',
    rarity: 'Epic',
    description: 'Sub-zero crystalline armor with polar frost spikes and sub-zero blizzard glow.',
    price: 90,
    previewColor: '#38BDF8',
    cosmeticEffect: 'frost_crystals'
  },
  {
    id: 'samurai_ronin',
    name: 'Honor Blade Ronin',
    rarity: 'Epic',
    description: 'Lacquered crimson armor with golden kabuto crest and swirling sakura blossom petals.',
    price: 100,
    previewColor: '#DC2626',
    cosmeticEffect: 'samurai_ronin'
  },
  {
    id: 'mecha_sentinel',
    name: 'Titanium Mecha Sentinel',
    rarity: 'Epic',
    description: 'Heavy titanium armor plating with precision targeting HUD reticle and laser sweep.',
    price: 105,
    previewColor: '#64748B',
    cosmeticEffect: 'targeting_hud'
  },
  {
    id: 'deep_abyss',
    name: 'Abyssal Leviathan',
    rarity: 'Epic',
    description: 'Deep ocean Mariana trench chitin with bioluminescent aquatic bubbles and tide glow.',
    price: 110,
    previewColor: '#0284C7',
    cosmeticEffect: 'deep_abyss'
  },
  {
    id: 'magma_colossus',
    name: 'Magma Golem Colossus',
    rarity: 'Epic',
    description: 'Hardened tectonic basalt plates over liquid lava core with fiery venting geysers.',
    price: 115,
    previewColor: '#DC2626',
    cosmeticEffect: 'magma_eruption'
  },
  {
    id: 'plasma_storm',
    name: 'Stormbringer Overcharge',
    rarity: 'Epic',
    description: 'Tesla-coil energized chassis with crackling blue lightning arcs and electric discharge.',
    price: 120,
    previewColor: '#6366F1',
    cosmeticEffect: 'plasma_storm'
  },
  {
    id: 'spectral_phantom',
    name: 'Ethereal Apparition',
    rarity: 'Epic',
    description: 'Translucent ghostly ectoplasm shell with floating spirit orbs and eerie wisp aura.',
    price: 125,
    previewColor: '#A855F7',
    cosmeticEffect: 'spectral_phantom'
  },
  {
    id: 'valkyrie_aurora',
    name: 'Celestial Valkyrie',
    rarity: 'Epic',
    description: 'Golden winged divine armor with floating celestial feathers and radiant starlight halo.',
    price: 130,
    previewColor: '#FBBF24',
    cosmeticEffect: 'valkyrie_wings'
  },
  {
    id: 'golden_champion',
    name: 'Golden Sovereign',
    rarity: 'Legendary',
    description: 'Pure 24-karat mirror-finish gold chassis with gleaming starlight sparkles.',
    price: 150,
    previewColor: '#F59E0B',
    cosmeticEffect: 'gold_sparkles'
  },
  {
    id: 'rainbow_aurora',
    name: 'Prism Rainbow Aurora',
    rarity: 'Legendary',
    description: 'Holographic iridescent crystal with shimmering rainbow chromatic dispersion.',
    price: 180,
    previewColor: '#EC4899',
    cosmeticEffect: 'rainbow_aurora'
  },
  {
    id: 'galaxy_cosmic',
    name: 'Cosmic Singularity',
    rarity: 'Legendary',
    description: 'Deep interstellar dark matter containing swirling stellar nebulae and stars.',
    price: 200,
    previewColor: '#8B5CF6',
    cosmeticEffect: 'cosmic_stars'
  },
  {
    id: 'cyber_dragon',
    name: 'Emerald Dragon Sovereign',
    rarity: 'Legendary',
    description: 'Ancient draconic cyber-scales with iridescent emerald fire and dragon horn crests.',
    price: 220,
    previewColor: '#10B981',
    cosmeticEffect: 'dragon_scales'
  },
  {
    id: 'void_stalker',
    name: 'Void Rift Stalker',
    rarity: 'Legendary',
    description: 'Dark cosmic matter chassis with gravitational lensing rings and pulsating singularity core.',
    price: 240,
    previewColor: '#7C3AED',
    cosmeticEffect: 'void_singularity'
  },
  {
    id: 'quantum_overlord',
    name: 'Quantum Reality-Bender',
    rarity: 'Legendary',
    description: 'Interdimensional rift core with warping event horizon rings and pure void energy.',
    price: 250,
    previewColor: '#4F46E5',
    cosmeticEffect: 'quantum_overlord'
  },
  {
    id: 'alien_invader',
    name: 'Alien Star Invader',
    rarity: 'Legendary',
    description: 'Translucent alien glass saucer dome housing a glowing neon brain with hypnotic 3-eye gaze and tractor beam.',
    price: 230,
    previewColor: '#10B981',
    cosmeticEffect: 'alien_beam'
  },
  {
    id: 'cactus_gunslinger',
    name: 'Desperado Gunslinger',
    rarity: 'Epic',
    description: 'Rugged leather stetson cowboy hat, sheriff star badge, bullet bandolier, and spinning tumbleweed aura.',
    price: 95,
    previewColor: '#D97706',
    cosmeticEffect: 'western_spurs'
  },
  {
    id: 'chef_supreme',
    name: 'Master Chef Toque',
    rarity: 'Rare',
    description: 'Puffy white chef hat with crossed golden kitchen spatulas and aromatic sizzle smoke.',
    price: 50,
    previewColor: '#F8FAFC',
    cosmeticEffect: 'chef_steam'
  },
  {
    id: 'disco_king',
    name: 'Disco Inferno King',
    rarity: 'Epic',
    description: 'Glorious retro 70s afro with mirrorball star sunglasses and spinning RGB dancefloor spotlights.',
    price: 110,
    previewColor: '#EC4899',
    cosmeticEffect: 'disco_lights'
  },
  {
    id: 'knight_templar',
    name: 'Crusader Greathelm',
    rarity: 'Epic',
    description: 'Solid steel crusader helmet with golden cross visor, royal crest plume, and sacred shield radiance.',
    price: 115,
    previewColor: '#64748B',
    cosmeticEffect: 'holy_radiance'
  },
  {
    id: 'hero_avenger',
    name: 'Cosmic Masked Avenger',
    rarity: 'Legendary',
    description: 'Dynamic heroic domino mask with fluttering battle cape and crackling comic energy lightning.',
    price: 210,
    previewColor: '#3B82F6',
    cosmeticEffect: 'hero_energy'
  },
  {
    id: 'wizard_archmage',
    name: 'Celestial Star Archmage',
    rarity: 'Legendary',
    description: 'Pointed starry wizard hat, floating arcane crystal orb, and glowing runic spell glyphs.',
    price: 240,
    previewColor: '#8B5CF6',
    cosmeticEffect: 'arcane_runes'
  },
  {
    id: 'pirate_captain',
    name: 'Dread Buccaneer Captain',
    rarity: 'Epic',
    description: 'Jolly Roger captain bicorne hat with gold trim, skull eyepatch, brass hoop earring, and gunpowder plumes.',
    price: 105,
    previewColor: '#0F172A',
    cosmeticEffect: 'pirate_cannon'
  },
  {
    id: 'viking_berserker',
    name: 'Valhalla War Berserker',
    rarity: 'Epic',
    description: 'Heavy riveted iron horned helmet with battle braid, crossed bearded axes, and frozen blizzard frost.',
    price: 120,
    previewColor: '#78350F',
    cosmeticEffect: 'viking_frost'
  },
  {
    id: 'kitsune_fox',
    name: 'Mystic Kitsune Nine-Tail',
    rarity: 'Legendary',
    description: 'Japanese fox spirit with twitching ears, painted ceremonial mask, swaying spirit tails, and blue foxfire.',
    price: 225,
    previewColor: '#F97316',
    cosmeticEffect: 'kitsune_wisps'
  },
  {
    id: 'astro_bubble',
    name: 'Orbital Astro-Explorer',
    rarity: 'Epic',
    description: 'Retro bubble space helmet with gold reflective visor, life-support pack, and zero-G rocket thrusters.',
    price: 100,
    previewColor: '#0284C7',
    cosmeticEffect: 'astro_thruster'
  }
];

export interface ArenaTheme {
  id: string;
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  description: string;
  price: number;
  previewColor: string;
  borderColor: string;
  glowColor: string;
  floorPattern:
    | 'clean'
    | 'synth_grid'
    | 'matrix_rain'
    | 'ice_crystals'
    | 'volcanic_fissures'
    | 'gilded_inlays'
    | 'sakura_petals'
    | 'space_hull'
    | 'arcade_cabinet'
    | 'haunted_dungeon'
    | 'atlantis_deep'
    | 'candy_land';
}

export const ARENA_CATALOG: ArenaTheme[] = [
  {
    id: 'arena_classic',
    name: 'Modern Clean Slate',
    rarity: 'Common',
    description: 'Minimalist competition arena with crisp matte boundaries, tactile corner bumpers, and high-visibility lines.',
    price: 0,
    previewColor: '#0F172A',
    borderColor: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.25)',
    floorPattern: 'clean'
  },
  {
    id: 'arena_neon_synth',
    name: 'Neon Sunset Grid',
    rarity: 'Rare',
    description: 'Electric 80s synthwave floor with glowing magenta and cyan perimeter lasers, horizon grid lines, and sunset pulses.',
    price: 60,
    previewColor: '#2E0854',
    borderColor: '#EC4899',
    glowColor: 'rgba(236, 72, 153, 0.45)',
    floorPattern: 'synth_grid'
  },
  {
    id: 'arena_cyber_matrix',
    name: 'Cyberpunk Terminal',
    rarity: 'Rare',
    description: 'Deep terminal phosphor backdrop with cascading digital rain code, green laser circuitry, and pulsing data nodes.',
    price: 75,
    previewColor: '#021B0D',
    borderColor: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    floorPattern: 'matrix_rain'
  },
  {
    id: 'arena_arcade_cabinet',
    name: 'Retro 8-Bit Pixel Arcade',
    rarity: 'Rare',
    description: 'Vintage wood-grain arcade machine with CRT phosphor scanlines, 8-bit marquee art, pixelated grid, and CRT curvature.',
    price: 70,
    previewColor: '#1E1B4B',
    borderColor: '#A855F7',
    glowColor: 'rgba(168, 85, 247, 0.45)',
    floorPattern: 'arcade_cabinet'
  },
  {
    id: 'arena_candy_land',
    name: 'Sugar Rush Kingdom',
    rarity: 'Rare',
    description: 'Vibrant candy wonderland with striped peppermint boundary posts, gumdrop corner towers, and rainbow sugar sparkles.',
    price: 65,
    previewColor: '#4A0427',
    borderColor: '#F472B6',
    glowColor: 'rgba(244, 114, 182, 0.45)',
    floorPattern: 'candy_land'
  },
  {
    id: 'arena_subzero_ice',
    name: 'Glacial Ice Sheet',
    rarity: 'Epic',
    description: 'Crystalline polar ice field with jagged perimeter frost, drifting blizzard snowflakes, and sub-zero chill vapor.',
    price: 100,
    previewColor: '#082F49',
    borderColor: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.5)',
    floorPattern: 'ice_crystals'
  },
  {
    id: 'arena_sakura_temple',
    name: 'Sakura Zen Sanctuary',
    rarity: 'Epic',
    description: 'Traditional vermillion lacquered borders, torii shrine silhouettes, and drifting pink cherry blossom petals.',
    price: 105,
    previewColor: '#831843',
    borderColor: '#F472B6',
    glowColor: 'rgba(244, 114, 182, 0.5)',
    floorPattern: 'sakura_petals'
  },
  {
    id: 'arena_volcanic_magma',
    name: 'Molten Obsidian Core',
    rarity: 'Epic',
    description: 'Cracked volcanic basalt ground with pulsing orange magma fissures, rising heat shimmers, and flying fire embers.',
    price: 110,
    previewColor: '#1C0603',
    borderColor: '#F97316',
    glowColor: 'rgba(249, 115, 22, 0.5)',
    floorPattern: 'volcanic_fissures'
  },
  {
    id: 'arena_haunted_dungeon',
    name: 'Spooky Crypt Catacombs',
    rarity: 'Epic',
    description: 'Ancient gothic dungeon with creeping green ground mist, wrought-iron fencing, and glowing gargoyle torch sconces.',
    price: 115,
    previewColor: '#0B0F19',
    borderColor: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.5)',
    floorPattern: 'haunted_dungeon'
  },
  {
    id: 'arena_atlantis_deep',
    name: 'Sunken Atlantis Trench',
    rarity: 'Epic',
    description: 'Bioluminescent deep ocean ruin with underwater light caustics, floating air bubbles, and waving sea kelp fronds.',
    price: 120,
    previewColor: '#032B44',
    borderColor: '#06B6D4',
    glowColor: 'rgba(6, 182, 212, 0.5)',
    floorPattern: 'atlantis_deep'
  },
  {
    id: 'arena_golden_palace',
    name: 'Imperial Gilded Colosseum',
    rarity: 'Legendary',
    description: 'Grand royal marble arena adorned with 24-karat gold molding, laurel wreath banners, and celestial starlight columns.',
    price: 160,
    previewColor: '#171206',
    borderColor: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.55)',
    floorPattern: 'gilded_inlays'
  },
  {
    id: 'arena_deep_space_station',
    name: 'Orbital Star Cruiser',
    rarity: 'Legendary',
    description: 'Futuristic cruiser airlock with starlight windows, rotating hazard beacons, and glowing cyan forcefield perimeter.',
    price: 175,
    previewColor: '#0F172A',
    borderColor: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.6)',
    floorPattern: 'space_hull'
  }
];

export interface PowerUpBooster {
  id: string;
  name: string;
  rarity: 'Epic' | 'Legendary';
  description: string;
  price: number;
  previewColor: string;
  icon: string;
  effectType: 'time_bonus' | 'double_coins' | 'extra_shield' | 'turbo_velocity' | 'bonus_flat_coins';
}

export const BOOSTER_CATALOG: PowerUpBooster[] = [
  {
    id: 'booster_time',
    name: 'Time Booster Chrono',
    rarity: 'Epic',
    description: 'Automatic in-match trigger: Instantly grants +5s clutch overtime when round clock drops below 5s in tense battles!',
    price: 75,
    previewColor: '#38BDF8',
    icon: '⏱️',
    effectType: 'time_bonus'
  },
  {
    id: 'booster_siphon',
    name: 'Coin Siphon Beacon',
    rarity: 'Epic',
    description: 'Automatic victory perk: Passive beacon siphons +10 flat bonus coins on round win (+25 for Tournament champions)!',
    price: 85,
    previewColor: '#FBBF24',
    icon: '🧲',
    effectType: 'bonus_flat_coins'
  },
  {
    id: 'booster_double_coins',
    name: 'Double Bounty Magnet',
    rarity: 'Epic',
    description: 'Automatic victory perk: Passive bounty multiplier doubles all round and tournament coin earnings (2x Coins)!',
    price: 90,
    previewColor: '#F59E0B',
    icon: '💰',
    effectType: 'double_coins'
  },
  {
    id: 'booster_shield',
    name: 'Aegis Overcharge Shield',
    rarity: 'Epic',
    description: 'Automatic in-match defense: Spawns an electric Aegis forcefield ring that absorbs your first hazard strike or impact!',
    price: 100,
    previewColor: '#10B981',
    icon: '🛡️',
    effectType: 'extra_shield'
  },
  {
    id: 'booster_turbo',
    name: 'Hyperdrive Turbo Surge',
    rarity: 'Legendary',
    description: 'Automatic in-match boost: Provides +15% enhanced speed and acceleration with twin blue rocket jet thruster flames!',
    price: 125,
    previewColor: '#EC4899',
    icon: '⚡',
    effectType: 'turbo_velocity'
  }
];

export interface MysteryPack {
  id: string;
  name: string;
  rarity: 'Rare' | 'Epic' | 'Legendary';
  description: string;
  price: number;
  previewColor: string;
  icon: string;
  weights: {
    Common: number;
    Rare: number;
    Epic: number;
    Legendary: number;
  };
}

export const PACK_CATALOG: MysteryPack[] = [
  {
    id: 'pack_bronze',
    name: 'Lucky Bronze Pack',
    rarity: 'Rare',
    description: 'A great value mystery crate! Contains Common or Rare items with a 25% Epic chance. 50% coin refund if duplicate!',
    price: 40,
    previewColor: '#B45309',
    icon: '📦',
    weights: { Common: 0.35, Rare: 0.40, Epic: 0.22, Legendary: 0.03 }
  },
  {
    id: 'pack_silver',
    name: 'Lucky Silver Crate',
    rarity: 'Epic',
    description: 'High-tier mystery crate with elevated Epic odds and a 15% Legendary drop rate. 50% coin refund if duplicate!',
    price: 75,
    previewColor: '#94A3B8',
    icon: '🎁',
    weights: { Common: 0.10, Rare: 0.40, Epic: 0.35, Legendary: 0.15 }
  },
  {
    id: 'pack_cosmic_titan',
    name: 'Cosmic Titan Mystery Vault',
    rarity: 'Legendary',
    description: 'Ultimate cosmic crate with highest Legendary drop rate (35%!) and 50% Epic guarantee. 50% coin refund on duplicates!',
    price: 120,
    previewColor: '#7C3AED',
    icon: '🌌',
    weights: { Common: 0, Rare: 0.15, Epic: 0.50, Legendary: 0.35 }
  },
  {
    id: 'pack_gold',
    name: 'Legendary Sovereign Vault',
    rarity: 'Legendary',
    description: 'Guaranteed Epic or Legendary skin, arena theme, or booster! 50% coin refund if duplicate!',
    price: 140,
    previewColor: '#F59E0B',
    icon: '👑',
    weights: { Common: 0, Rare: 0.05, Epic: 0.55, Legendary: 0.40 }
  }
];

export interface PackResult {
  itemType: 'skin' | 'arena' | 'booster';
  itemId: string;
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  description: string;
  previewColor: string;
  isDuplicate: boolean;
  refundCoins: number;
}

export class EconomyManager {
  private static instance: EconomyManager | null = null;

  private coins: number = 0;
  private unlockedSkins: Set<string> = new Set(['classic']);
  private equippedSkins: Record<PlayerId, string> = {
    0: 'classic',
    1: 'classic',
    2: 'classic',
    3: 'classic'
  };

  private unlockedArenas: Set<string> = new Set(['arena_classic']);
  private equippedArena: string = 'arena_classic';

  private unlockedBoosters: Set<string> = new Set();
  private equippedBoosters: Record<PlayerId, string | null> = {
    0: null,
    1: null,
    2: null,
    3: null
  };

  private listeners: ((coins: number) => void)[] = [];

  constructor() {
    this.load();
  }

  public static getInstance(): EconomyManager {
    if (!EconomyManager.instance) {
      EconomyManager.instance = new EconomyManager();
    }
    return EconomyManager.instance;
  }

  private load(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;

      const savedCoins = localStorage.getItem('antigravity_coins');
      if (savedCoins !== null) {
        const parsed = parseInt(savedCoins, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          this.coins = parsed;
        }
      } else {
        // Welcome bonus for exploring the wardrobe & shop
        this.coins = 50;
        this.save();
      }

      // Skins
      const savedUnlocked = localStorage.getItem('antigravity_unlocked_skins');
      if (savedUnlocked) {
        const list = JSON.parse(savedUnlocked);
        if (Array.isArray(list)) {
          list.forEach((id) => this.unlockedSkins.add(id));
        }
      }
      this.unlockedSkins.add('classic');

      const savedEquipped = localStorage.getItem('antigravity_equipped_skins');
      if (savedEquipped) {
        const eq = JSON.parse(savedEquipped);
        if (eq && typeof eq === 'object') {
          for (let p = 0; p < 4; p++) {
            if (typeof eq[p] === 'string' && this.unlockedSkins.has(eq[p])) {
              this.equippedSkins[p as PlayerId] = eq[p];
            }
          }
        }
      }

      // Arenas
      const savedArenas = localStorage.getItem('antigravity_unlocked_arenas');
      if (savedArenas) {
        const list = JSON.parse(savedArenas);
        if (Array.isArray(list)) {
          list.forEach((id) => this.unlockedArenas.add(id));
        }
      }
      this.unlockedArenas.add('arena_classic');

      const savedEquippedArena = localStorage.getItem('antigravity_equipped_arena');
      if (savedEquippedArena && this.unlockedArenas.has(savedEquippedArena)) {
        this.equippedArena = savedEquippedArena;
      }

      // Boosters
      const savedBoosters = localStorage.getItem('antigravity_unlocked_boosters');
      if (savedBoosters) {
        const list = JSON.parse(savedBoosters);
        if (Array.isArray(list)) {
          list.forEach((id) => this.unlockedBoosters.add(id));
        }
      }

      const savedEquippedBoosters = localStorage.getItem('antigravity_equipped_boosters');
      if (savedEquippedBoosters) {
        const eqB = JSON.parse(savedEquippedBoosters);
        if (eqB && typeof eqB === 'object') {
          for (let p = 0; p < 4; p++) {
            if (typeof eqB[p] === 'string' && this.unlockedBoosters.has(eqB[p])) {
              this.equippedBoosters[p as PlayerId] = eqB[p];
            }
          }
        }
      }
    } catch (_) {
      // Safe fallback if localStorage is disabled or restricted
    }
  }

  private save(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.setItem('antigravity_coins', this.coins.toString());
      localStorage.setItem('antigravity_unlocked_skins', JSON.stringify(Array.from(this.unlockedSkins)));
      localStorage.setItem('antigravity_equipped_skins', JSON.stringify(this.equippedSkins));
      localStorage.setItem('antigravity_unlocked_arenas', JSON.stringify(Array.from(this.unlockedArenas)));
      localStorage.setItem('antigravity_equipped_arena', this.equippedArena);
      localStorage.setItem('antigravity_unlocked_boosters', JSON.stringify(Array.from(this.unlockedBoosters)));
      localStorage.setItem('antigravity_equipped_boosters', JSON.stringify(this.equippedBoosters));
    } catch (_) {
      // Ignore private browsing quota errors
    }
  }

  public getCoins(): number {
    return this.coins;
  }

  public addCoins(amount: number): number {
    if (amount <= 0) return this.coins;
    this.coins += amount;
    this.save();
    this.notify();
    return this.coins;
  }

  public spendCoins(amount: number): boolean {
    if (amount <= 0 || this.coins < amount) return false;
    this.coins -= amount;
    this.save();
    this.notify();
    return true;
  }

  // --- Skins ---
  public isSkinUnlocked(skinId: string): boolean {
    return this.unlockedSkins.has(skinId);
  }

  public unlockSkin(skinId: string, free: boolean = false): boolean {
    const skin = SKIN_CATALOG.find((s) => s.id === skinId);
    if (!skin) return false;
    if (this.unlockedSkins.has(skinId)) return true;

    if (free || this.spendCoins(skin.price)) {
      this.unlockedSkins.add(skinId);
      this.save();
      return true;
    }
    return false;
  }

  public getEquippedSkin(playerId: PlayerId): string {
    return this.equippedSkins[playerId] || 'classic';
  }

  public equipSkin(playerId: PlayerId, skinId: string): boolean {
    if (!this.unlockedSkins.has(skinId)) return false;
    this.equippedSkins[playerId] = skinId;
    this.save();
    return true;
  }

  // --- Arenas ---
  public isArenaUnlocked(arenaId: string): boolean {
    return this.unlockedArenas.has(arenaId);
  }

  public unlockArena(arenaId: string, free: boolean = false): boolean {
    const arena = ARENA_CATALOG.find((a) => a.id === arenaId);
    if (!arena) return false;
    if (this.unlockedArenas.has(arenaId)) return true;

    if (free || this.spendCoins(arena.price)) {
      this.unlockedArenas.add(arenaId);
      this.save();
      return true;
    }
    return false;
  }

  public getEquippedArena(): string {
    return this.equippedArena || 'arena_classic';
  }

  public equipArena(arenaId: string): boolean {
    if (!this.unlockedArenas.has(arenaId)) return false;
    this.equippedArena = arenaId;
    this.save();
    return true;
  }

  // --- Boosters ---
  public isBoosterUnlocked(boosterId: string): boolean {
    return this.unlockedBoosters.has(boosterId);
  }

  public unlockBooster(boosterId: string, free: boolean = false): boolean {
    const booster = BOOSTER_CATALOG.find((b) => b.id === boosterId);
    if (!booster) return false;
    if (this.unlockedBoosters.has(boosterId)) return true;

    if (free || this.spendCoins(booster.price)) {
      this.unlockedBoosters.add(boosterId);
      this.save();
      return true;
    }
    return false;
  }

  public getEquippedBooster(playerId: PlayerId): string | null {
    return this.equippedBoosters[playerId] || null;
  }

  public equipBooster(playerId: PlayerId, boosterId: string | null): boolean {
    if (boosterId !== null && !this.unlockedBoosters.has(boosterId)) return false;
    this.equippedBoosters[playerId] = boosterId;
    this.save();
    return true;
  }

  // --- Mystery Lucky Pack Opening ---
  public openPack(packId: string): PackResult | null {
    const pack = PACK_CATALOG.find((p) => p.id === packId);
    if (!pack) return null;
    if (!this.spendCoins(pack.price)) return null;

    // Roll rarity based on pack weights
    const roll = Math.random();
    let rolledRarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' = 'Rare';
    let cumulative = 0;

    cumulative += pack.weights.Common;
    if (roll < cumulative) rolledRarity = 'Common';
    else {
      cumulative += pack.weights.Rare;
      if (roll < cumulative) rolledRarity = 'Rare';
      else {
        cumulative += pack.weights.Epic;
        if (roll < cumulative) rolledRarity = 'Epic';
        else rolledRarity = 'Legendary';
      }
    }

    // Build pool of eligible candidates across skins, arenas, and boosters
    type Candidate = {
      type: 'skin' | 'arena' | 'booster';
      id: string;
      name: string;
      rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
      description: string;
      previewColor: string;
      price: number;
    };

    const pool: Candidate[] = [];
    SKIN_CATALOG.forEach((s) => {
      if (s.rarity === rolledRarity) {
        pool.push({ type: 'skin', id: s.id, name: s.name, rarity: s.rarity, description: s.description, previewColor: s.previewColor, price: s.price });
      }
    });
    ARENA_CATALOG.forEach((a) => {
      if (a.rarity === rolledRarity) {
        pool.push({ type: 'arena', id: a.id, name: a.name, rarity: a.rarity, description: a.description, previewColor: a.previewColor, price: a.price });
      }
    });
    BOOSTER_CATALOG.forEach((b) => {
      if (b.rarity === rolledRarity) {
        pool.push({ type: 'booster', id: b.id, name: b.name, rarity: b.rarity, description: b.description, previewColor: b.previewColor, price: b.price });
      }
    });

    // Fallback if pool is empty for rolled rarity
    if (pool.length === 0) {
      SKIN_CATALOG.forEach((s) => {
        pool.push({ type: 'skin', id: s.id, name: s.name, rarity: s.rarity, description: s.description, previewColor: s.previewColor, price: s.price });
      });
    }

    // Pick random item from candidate pool
    const picked = pool[Math.floor(Math.random() * pool.length)];

    // Check if duplicate
    let isDuplicate = false;
    if (picked.type === 'skin') isDuplicate = this.isSkinUnlocked(picked.id);
    else if (picked.type === 'arena') isDuplicate = this.isArenaUnlocked(picked.id);
    else if (picked.type === 'booster') isDuplicate = this.isBoosterUnlocked(picked.id);

    let refundCoins = 0;
    if (isDuplicate) {
      // Refund 50% of the item's coin price (min 20 coins refund)
      refundCoins = Math.max(20, Math.floor(picked.price * 0.5));
      this.addCoins(refundCoins);
    } else {
      // New Unlock!
      if (picked.type === 'skin') this.unlockSkin(picked.id, true);
      else if (picked.type === 'arena') this.unlockArena(picked.id, true);
      else if (picked.type === 'booster') this.unlockBooster(picked.id, true);
    }

    return {
      itemType: picked.type,
      itemId: picked.id,
      name: picked.name,
      rarity: picked.rarity,
      description: picked.description,
      previewColor: picked.previewColor,
      isDuplicate,
      refundCoins
    };
  }

  // Award round victory coins (with double coins & coin siphon booster support!)
  public awardRoundWin(winnerId: PlayerId): number {
    let amount = 15;
    if (this.equippedBoosters[winnerId] === 'booster_double_coins') {
      amount *= 2;
    } else if (this.equippedBoosters[winnerId] === 'booster_siphon') {
      amount += 10;
    }
    this.addCoins(amount);
    return amount;
  }

  // Award tournament cup championship coins
  public awardTournamentWin(winnerId: PlayerId): number {
    let amount = 50;
    if (this.equippedBoosters[winnerId] === 'booster_double_coins') {
      amount *= 2;
    } else if (this.equippedBoosters[winnerId] === 'booster_siphon') {
      amount += 25;
    }
    this.addCoins(amount);
    return amount;
  }

  public addListener(cb: (coins: number) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify(): void {
    for (const cb of this.listeners) {
      try {
        cb(this.coins);
      } catch (_) {
        // Safe callback execution
      }
    }
  }

  public resetForTesting(): void {
    this.coins = 100;
    this.unlockedSkins = new Set(['classic']);
    this.equippedSkins = { 0: 'classic', 1: 'classic', 2: 'classic', 3: 'classic' };
    this.unlockedArenas = new Set(['arena_classic']);
    this.equippedArena = 'arena_classic';
    this.unlockedBoosters = new Set();
    this.equippedBoosters = { 0: null, 1: null, 2: null, 3: null };
    this.save();
    this.notify();
  }
}
