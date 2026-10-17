import { PlayerId } from './Types';
import { EconomyManager } from './EconomyManager';

export type CharacterMood = 'idle' | 'happy' | 'triumph' | 'shocked' | 'focused';

interface MascotTheme {
  primary: string;
  light: string;
  dark: string;
  visorGlow: string;
  accent: string;
}

const MASCOT_THEMES: Record<number, MascotTheme> = {
  0: {
    primary: '#EF4444',
    light: '#FCA5A5',
    dark: '#991B1B',
    visorGlow: '#FECACA',
    accent: '#F59E0B'
  },
  1: {
    primary: '#3B82F6',
    light: '#93C5FD',
    dark: '#1E40AF',
    visorGlow: '#67E8F9',
    accent: '#06B6D4'
  },
  2: {
    primary: '#10B981',
    light: '#86EFAC',
    dark: '#065F46',
    visorGlow: '#A7F3D0',
    accent: '#FBBF24'
  },
  3: {
    primary: '#F59E0B',
    light: '#FDE68A',
    dark: '#92400E',
    visorGlow: '#FEF08A',
    accent: '#EF4444'
  }
};

export function getSkinMascotTheme(skinId: string, playerId: PlayerId): MascotTheme {
  if (skinId === 'golden_champion') {
    return {
      primary: '#F59E0B',
      light: '#FEF08A',
      dark: '#92400E',
      visorGlow: '#FFFFFF',
      accent: '#FEF08A'
    };
  } else if (skinId === 'cyber_neon') {
    return {
      primary: '#06B6D4',
      light: '#67E8F9',
      dark: '#083344',
      visorGlow: '#EC4899',
      accent: '#A855F7'
    };
  } else if (skinId === 'shadow_ninja') {
    return {
      primary: '#1E293B',
      light: '#475569',
      dark: '#020617',
      visorGlow: '#EF4444',
      accent: '#DC2626'
    };
  } else if (skinId === 'inferno_blaze') {
    return {
      primary: '#EA580C',
      light: '#FDBA74',
      dark: '#7C2D12',
      visorGlow: '#FEF08A',
      accent: '#EF4444'
    };
  } else if (skinId === 'frost_titan') {
    return {
      primary: '#0284C7',
      light: '#E0F2FE',
      dark: '#0C4A6E',
      visorGlow: '#38BDF8',
      accent: '#7DD3FC'
    };
  } else if (skinId === 'galaxy_cosmic') {
    return {
      primary: '#7C3AED',
      light: '#DDD6FE',
      dark: '#2E1065',
      visorGlow: '#F472B6',
      accent: '#38BDF8'
    };
  } else if (skinId === 'arcade_retro') {
    return {
      primary: '#16A34A',
      light: '#86EFAC',
      dark: '#14532D',
      visorGlow: '#4ADE80',
      accent: '#22C55E'
    };
  } else if (skinId === 'toxic_ooze') {
    return {
      primary: '#65A30D',
      light: '#BEF264',
      dark: '#365314',
      visorGlow: '#A3E635',
      accent: '#84CC16'
    };
  } else if (skinId === 'steam_mechanic') {
    return {
      primary: '#B45309',
      light: '#FDE68A',
      dark: '#78350F',
      visorGlow: '#F59E0B',
      accent: '#D97706'
    };
  } else if (skinId === 'samurai_ronin') {
    return {
      primary: '#DC2626',
      light: '#FCA5A5',
      dark: '#7F1D1D',
      visorGlow: '#FEF08A',
      accent: '#F59E0B'
    };
  } else if (skinId === 'deep_abyss') {
    return {
      primary: '#0284C7',
      light: '#BAE6FD',
      dark: '#0C4A6E',
      visorGlow: '#38BDF8',
      accent: '#06B6D4'
    };
  } else if (skinId === 'plasma_storm') {
    return {
      primary: '#4F46E5',
      light: '#C7D2FE',
      dark: '#1E1B4B',
      visorGlow: '#67E8F9',
      accent: '#38BDF8'
    };
  } else if (skinId === 'spectral_phantom') {
    return {
      primary: '#9333EA',
      light: '#E9D5FF',
      dark: '#3B0764',
      visorGlow: '#D8B4FE',
      accent: '#C084FC'
    };
  } else if (skinId === 'rainbow_aurora') {
    return {
      primary: '#DB2777',
      light: '#FBCFE8',
      dark: '#831843',
      visorGlow: '#38BDF8',
      accent: '#F59E0B'
    };
  } else if (skinId === 'quantum_overlord') {
    return {
      primary: '#312E81',
      light: '#A5B4FC',
      dark: '#0F0E2A',
      visorGlow: '#818CF8',
      accent: '#C084FC'
    };
  } else if (skinId === 'neon_dj') {
    return {
      primary: '#0891B2',
      light: '#A5F3FC',
      dark: '#164E63',
      visorGlow: '#F43F5E',
      accent: '#38BDF8'
    };
  } else if (skinId === 'mecha_sentinel') {
    return {
      primary: '#475569',
      light: '#E2E8F0',
      dark: '#0F172A',
      visorGlow: '#EF4444',
      accent: '#38BDF8'
    };
  } else if (skinId === 'magma_colossus') {
    return {
      primary: '#B91C1C',
      light: '#FED7AA',
      dark: '#450A0A',
      visorGlow: '#F97316',
      accent: '#EA580C'
    };
  } else if (skinId === 'valkyrie_aurora') {
    return {
      primary: '#D97706',
      light: '#FEF3C7',
      dark: '#78350F',
      visorGlow: '#FFFFFF',
      accent: '#F59E0B'
    };
  } else if (skinId === 'cyber_dragon') {
    return {
      primary: '#059669',
      light: '#6EE7B7',
      dark: '#064E3B',
      visorGlow: '#34D399',
      accent: '#F59E0B'
    };
  } else if (skinId === 'void_stalker') {
    return {
      primary: '#4C1D95',
      light: '#C4B5FD',
      dark: '#1E0B4B',
      visorGlow: '#A78BFA',
      accent: '#F43F5E'
    };
  } else if (skinId === 'alien_invader') {
    return {
      primary: '#059669',
      light: '#A7F3D0',
      dark: '#064E3B',
      visorGlow: '#34D399',
      accent: '#10B981'
    };
  } else if (skinId === 'cactus_gunslinger') {
    return {
      primary: '#D97706',
      light: '#FDE68A',
      dark: '#78350F',
      visorGlow: '#FBBF24',
      accent: '#B45309'
    };
  } else if (skinId === 'chef_supreme') {
    return {
      primary: '#E2E8F0',
      light: '#FFFFFF',
      dark: '#475569',
      visorGlow: '#F8FAFC',
      accent: '#F59E0B'
    };
  } else if (skinId === 'disco_king') {
    return {
      primary: '#EC4899',
      light: '#FCE7F3',
      dark: '#831843',
      visorGlow: '#F43F5E',
      accent: '#FBBF24'
    };
  } else if (skinId === 'knight_templar') {
    return {
      primary: '#64748B',
      light: '#CBD5E1',
      dark: '#1E293B',
      visorGlow: '#F59E0B',
      accent: '#EF4444'
    };
  } else if (skinId === 'hero_avenger') {
    return {
      primary: '#2563EB',
      light: '#BFDBFE',
      dark: '#1E3A8A',
      visorGlow: '#60A5FA',
      accent: '#EF4444'
    };
  } else if (skinId === 'wizard_archmage') {
    return {
      primary: '#7C3AED',
      light: '#DDD6FE',
      dark: '#2E1065',
      visorGlow: '#C084FC',
      accent: '#FDE68A'
    };
  } else if (skinId === 'pirate_captain') {
    return {
      primary: '#1E293B',
      light: '#475569',
      dark: '#0F172A',
      visorGlow: '#F59E0B',
      accent: '#EF4444'
    };
  } else if (skinId === 'viking_berserker') {
    return {
      primary: '#92400E',
      light: '#FED7AA',
      dark: '#451A03',
      visorGlow: '#38BDF8',
      accent: '#F59E0B'
    };
  } else if (skinId === 'kitsune_fox') {
    return {
      primary: '#EA580C',
      light: '#FFEDD5',
      dark: '#7C2D12',
      visorGlow: '#38BDF8',
      accent: '#EF4444'
    };
  } else if (skinId === 'astro_bubble') {
    return {
      primary: '#0284C7',
      light: '#E0F2FE',
      dark: '#0369A1',
      visorGlow: '#FBBF24',
      accent: '#38BDF8'
    };
  } else if (skinId === 'cyber_samurai_ronin') {
    return {
      primary: '#0F172A',
      light: '#38BDF8',
      dark: '#020617',
      visorGlow: '#06B6D4',
      accent: '#EC4899'
    };
  } else if (skinId === 'space_pirate_corsair') {
    return {
      primary: '#3B0764',
      light: '#C084FC',
      dark: '#1E1B4B',
      visorGlow: '#22D3EE',
      accent: '#FDE047'
    };
  } else if (skinId === 'retro_gameboy_classic') {
    return {
      primary: '#CBD5E1',
      light: '#F8FAFC',
      dark: '#64748B',
      visorGlow: '#84CC16',
      accent: '#BE123C'
    };
  } else if (skinId === 'mecha_kaiju') {
    return {
      primary: '#1E293B',
      light: '#6EE7B7',
      dark: '#064E3B',
      visorGlow: '#10B981',
      accent: '#34D399'
    };
  } else if (skinId === 'pharaoh_anubis') {
    return {
      primary: '#1E3A8A',
      light: '#FEF08A',
      dark: '#0F172A',
      visorGlow: '#FBBF24',
      accent: '#F59E0B'
    };
  } else if (skinId === 'cyber_netrunner') {
    return {
      primary: '#831843',
      light: '#F472B6',
      dark: '#1F091D',
      visorGlow: '#06B6D4',
      accent: '#FDE047'
    };
  } else if (skinId === 'celestial_seraphim') {
    return {
      primary: '#FEF3C7',
      light: '#FFFFFF',
      dark: '#B45309',
      visorGlow: '#38BDF8',
      accent: '#F59E0B'
    };
  } else if (skinId === 'neon_reaper') {
    return {
      primary: '#1E1B4B',
      light: '#C084FC',
      dark: '#090514',
      visorGlow: '#A855F7',
      accent: '#22D3EE'
    };
  } else if (skinId === 'chrono_timelord') {
    return {
      primary: '#0C4A6E',
      light: '#BAE6FD',
      dark: '#082F49',
      visorGlow: '#38BDF8',
      accent: '#FBBF24'
    };
  } else if (skinId === 'shogun_mech') {
    return {
      primary: '#1E293B',
      light: '#94A3B8',
      dark: '#020617',
      visorGlow: '#10B981',
      accent: '#FBBF24'
    };
  } else if (skinId === 'marshmallow_dj') {
    return {
      primary: '#F8FAFC',
      light: '#FFFFFF',
      dark: '#94A3B8',
      visorGlow: '#EC4899',
      accent: '#06B6D4'
    };
  } else if (skinId === 'plague_alchemist') {
    return {
      primary: '#064E3B',
      light: '#6EE7B7',
      dark: '#022C22',
      visorGlow: '#10B981',
      accent: '#A855F7'
    };
  } else if (skinId === 'supernova_phoenix') {
    return {
      primary: '#EA580C',
      light: '#FEF08A',
      dark: '#7C2D12',
      visorGlow: '#FFFFFF',
      accent: '#F59E0B'
    };
  } else if (skinId === 'glitch_cyber_phantom') {
    return {
      primary: '#090D16',
      light: '#67E8F9',
      dark: '#020617',
      visorGlow: '#EC4899',
      accent: '#06B6D4'
    };
  } else if (skinId === 'solar_eclipse_knight') {
    return {
      primary: '#18181B',
      light: '#FEF08A',
      dark: '#09090B',
      visorGlow: '#F59E0B',
      accent: '#FDE047'
    };
  } else if (skinId === 'deep_angler_leviathan') {
    return {
      primary: '#042F2E',
      light: '#5EEAD4',
      dark: '#022C22',
      visorGlow: '#22D3EE',
      accent: '#14B8A6'
    };
  } else if (skinId === 'dr_steampunk_inventor') {
    return {
      primary: '#78350F',
      light: '#FDE68A',
      dark: '#451A03',
      visorGlow: '#38BDF8',
      accent: '#F59E0B'
    };
  } else if (skinId === 'neon_cyber_kitsune') {
    return {
      primary: '#0F172A',
      light: '#F472B6',
      dark: '#020617',
      visorGlow: '#38BDF8',
      accent: '#EC4899'
    };
  } else if (skinId === 'cosmic_jester') {
    return {
      primary: '#4C1D95',
      light: '#DDD6FE',
      dark: '#1E1B4B',
      visorGlow: '#FDE047',
      accent: '#A855F7'
    };
  } else if (skinId === 'cosmic_black_hole') {
    return {
      primary: '#1E1B4B',
      light: '#C084FC',
      dark: '#090514',
      visorGlow: '#A855F7',
      accent: '#38BDF8'
    };
  } else if (skinId === 'cyber_valkyrie_prime') {
    return {
      primary: '#0284C7',
      light: '#E0F2FE',
      dark: '#075985',
      visorGlow: '#38BDF8',
      accent: '#FDE047'
    };
  } else if (skinId === 'cyber_glitch_oni') {
    return {
      primary: '#881337',
      light: '#FB7185',
      dark: '#4C0519',
      visorGlow: '#F43F5E',
      accent: '#06B6D4'
    };
  } else if (skinId === 'golden_dragon_emperor') {
    return {
      primary: '#B45309',
      light: '#FEF08A',
      dark: '#78350F',
      visorGlow: '#FFFFFF',
      accent: '#F59E0B'
    };
  } else if (skinId === 'prism_crystal_golem') {
    return {
      primary: '#581C87',
      light: '#E9D5FF',
      dark: '#2E1065',
      visorGlow: '#38BDF8',
      accent: '#F472B6'
    };
  } else if (skinId === 'deep_sea_abyssal_kraken') {
    return {
      primary: '#042F2E',
      light: '#5EEAD4',
      dark: '#022C22',
      visorGlow: '#14B8A6',
      accent: '#38BDF8'
    };
  } else if (skinId === 'inferno_lava_demon') {
    return {
      primary: '#18181B', // Obsidian basalt
      light: '#FEF08A',   // Solar gold core
      dark: '#09090B',    // Deep volcanic crust
      visorGlow: '#FF4500', // Searing brimstone magma
      accent: '#F97316'   // Molten lava orange
    };
  } else if (skinId === 'retro_synthwave_racer') {
    return {
      primary: '#2E0854', // Synthwave deep violet
      light: '#00F0FF',   // Electric cyan
      dark: '#120224',    // Midnight abyss
      visorGlow: '#FF007F', // Fluorescent neon magenta
      accent: '#FFE600'   // Sunset neon yellow
    };
  } else if (skinId === 'cyber_stealth_operative') {
    return {
      primary: '#0F172A', // Matte carbon stealth
      light: '#34D399',   // Emerald active-camo highlight
      dark: '#020617',    // Shadow carbon
      visorGlow: '#10B981', // Night-vision emerald
      accent: '#6EE7B7'
    };
  } else if (skinId === 'electric_storm_raijin') {
    return {
      primary: '#1E1B4B', // Storm cloud midnight
      light: '#BAE6FD',   // Plasma lightning white-blue
      dark: '#0F172A',
      visorGlow: '#38BDF8', // Electric lightning cyan
      accent: '#FDE047'   // Gold thunderbolt
    };
  } else if (skinId === 'mecha_dragoon_valkyrie') {
    return {
      primary: '#F8FAFC', // Armored titanium white
      light: '#818CF8',   // Photonic particle violet
      dark: '#1E293B',    // Gunmetal inner frame
      visorGlow: '#06B6D4', // Cockpit emerald/cyan HUD
      accent: '#F59E0B'   // Golden V-fin crest
    };
  } else if (skinId === 'frost_valkyrie_queen') {
    return {
      primary: '#082F49', // Glacial deep ice
      light: '#E0F2FE',   // Diamond frost crystal
      dark: '#031E30',
      visorGlow: '#38BDF8', // Arctic cyan
      accent: '#BAE6FD'
    };
  } else if (skinId === 'toxic_cyber_mutant') {
    return {
      primary: '#1A2E05', // Radioactive dark sludge
      light: '#BEF264',   // Neon lime acid
      dark: '#0D1702',
      visorGlow: '#84CC16', // Acid green hazard
      accent: '#FACC15'   // Toxic yellow warning
    };
  } else if (skinId === 'steampunk_aeronaut_ace') {
    return {
      primary: '#451A03', // Weathered aviator leather
      light: '#FDE68A',   // Burnished brass
      dark: '#271B11',
      visorGlow: '#F59E0B', // Glowing amber flight optics
      accent: '#B45309'   // Copper rivet trim
    };
  }

  return MASCOT_THEMES[playerId] || MASCOT_THEMES[0];
}

/**
 * Procedural Vector Mascot Renderer.
 * Draws expressive, polished, tactile 2.5D mascot characters for players and bots.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  playerId: PlayerId,
  isBot: boolean = false,
  mood: CharacterMood = 'idle',
  animTime: number = 0,
  customSkinId?: string
) {
  ctx.save();
  const activeSkin = customSkinId || EconomyManager.getInstance().getEquippedSkin(playerId);
  const theme = getSkinMascotTheme(activeSkin, playerId);
  const scale = radius / 30; // 30 is base design radius

  // Subtle breathing / floating animation
  const bobY = mood === 'triumph'
    ? Math.sin(animTime * 6) * 4 * scale
    : Math.sin(animTime * 3 + playerId) * 1.5 * scale;
  const drawY = cy + bobY;

  // 1. Ambient Drop Shadow
  ctx.save();
  ctx.beginPath();
  const shadowR = radius * (mood === 'triumph' ? 0.9 : 0.85);
  ctx.ellipse(cx, cy + radius * 0.9, shadowR, radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.fill();
  ctx.restore();

  // 2. Headgear & Silhouette Accents (Behind Head - Custom for Skins, or Player Default)
  if (activeSkin === 'hero_avenger') {
    // Fluttering superhero cape on back
    ctx.save();
    ctx.fillStyle = '#DC2626';
    ctx.strokeStyle = '#991B1B';
    ctx.lineWidth = 1.5 * scale;
    const flap = Math.sin(animTime * 6) * 4 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.7, drawY);
    ctx.quadraticCurveTo(cx - radius * 1.2, drawY + radius * 1.3, cx - radius * 0.9 + flap, drawY + radius * 1.6);
    ctx.lineTo(cx + radius * 0.9 + flap, drawY + radius * 1.6);
    ctx.quadraticCurveTo(cx + radius * 1.2, drawY + radius * 1.3, cx + radius * 0.7, drawY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'samurai_ronin' || activeSkin === 'cyber_samurai_ronin') {
    // Crossed Katana blades on back (Plasma glowing for Cyber Ronin)
    ctx.save();
    const isCyber = activeSkin === 'cyber_samurai_ronin';
    ctx.strokeStyle = isCyber ? '#06B6D4' : '#CBD5E1';
    if (isCyber) {
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 8 * scale;
    }
    ctx.lineWidth = 2.8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 26 * scale, drawY - 30 * scale);
    ctx.lineTo(cx + 24 * scale, drawY + 24 * scale);
    ctx.stroke();
    ctx.strokeStyle = isCyber ? '#EC4899' : '#CBD5E1';
    if (isCyber) ctx.shadowColor = '#EC4899';
    ctx.beginPath();
    ctx.moveTo(cx + 26 * scale, drawY - 30 * scale);
    ctx.lineTo(cx - 24 * scale, drawY + 24 * scale);
    ctx.stroke();
    ctx.fillStyle = isCyber ? '#FDE047' : '#F59E0B';
    ctx.fillRect(cx - 17 * scale, drawY - 19 * scale, 5 * scale, 5 * scale);
    ctx.fillRect(cx + 12 * scale, drawY - 19 * scale, 5 * scale, 5 * scale);
    ctx.restore();
  } else if (activeSkin === 'viking_berserker') {
    // Crossed Battle Axes on back
    ctx.save();
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 24 * scale, drawY - 28 * scale);
    ctx.lineTo(cx + 24 * scale, drawY + 24 * scale);
    ctx.moveTo(cx + 24 * scale, drawY - 28 * scale);
    ctx.lineTo(cx - 24 * scale, drawY + 24 * scale);
    ctx.stroke();
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.arc(cx - 20 * scale, drawY - 22 * scale, 8 * scale, Math.PI * 0.6, Math.PI * 1.8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 20 * scale, drawY - 22 * scale, 8 * scale, Math.PI * 1.2, Math.PI * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'kitsune_fox') {
    // 3 Swaying fluffy fox tails behind
    ctx.save();
    for (let tIdx = -1; tIdx <= 1; tIdx++) {
      const tailSway = Math.sin(animTime * 3 + tIdx * 1.2) * 5 * scale;
      const tx = cx + tIdx * 14 * scale + tailSway;
      const ty = drawY + radius * 0.3;
      ctx.fillStyle = '#EA580C';
      ctx.beginPath();
      ctx.ellipse(tx, ty + 16 * scale, 8 * scale, 16 * scale, tIdx * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(tx, ty + 24 * scale, 5 * scale, 7 * scale, tIdx * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'astro_bubble') {
    // Twin pressurized life-support rocket tanks on back
    ctx.save();
    ctx.fillStyle = '#E2E8F0';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5 * scale;
    ctx.fillRect(cx - 24 * scale, drawY - 14 * scale, 9 * scale, 26 * scale);
    ctx.strokeRect(cx - 24 * scale, drawY - 14 * scale, 9 * scale, 26 * scale);
    ctx.fillRect(cx + 15 * scale, drawY - 14 * scale, 9 * scale, 26 * scale);
    ctx.strokeRect(cx + 15 * scale, drawY - 14 * scale, 9 * scale, 26 * scale);
    ctx.restore();
  } else if (activeSkin === 'retro_gameboy_classic') {
    // 1989 DMG-01 Handheld Cartridge Shell housing behind mascot
    ctx.save();
    const gw = radius * 2.15;
    const gh = radius * 2.35;
    ctx.fillStyle = '#CBD5E1';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cx - gw / 2, drawY - gh * 0.48, gw, gh, [6 * scale, 6 * scale, 14 * scale, 6 * scale]);
    } else {
      ctx.rect(cx - gw / 2, drawY - gh * 0.48, gw, gh);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'mecha_kaiju') {
    // Radioactive Cherenkov Dorsal Fins & Armored Tail behind mascot
    ctx.save();
    ctx.fillStyle = '#10B981';
    ctx.strokeStyle = '#A7F3D0';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 10 * scale;
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const sx = cx + i * 11 * scale;
      const sy = drawY - radius * 0.6 + Math.abs(i) * 6 * scale;
      ctx.beginPath();
      ctx.moveTo(sx - 5 * scale, sy + 8 * scale);
      ctx.lineTo(sx + i * 4 * scale, sy - 12 * scale);
      ctx.lineTo(sx + 5 * scale, sy + 8 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'pharaoh_anubis') {
    // Royal Lapis & 24K Gold Striped Nemes Headdress Flaps behind head
    ctx.save();
    ctx.fillStyle = '#1E3A8A';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.85, drawY - radius * 0.6);
    ctx.lineTo(cx - radius * 1.35, drawY + radius * 0.35);
    ctx.lineTo(cx - radius * 0.9, drawY + radius * 0.95);
    ctx.lineTo(cx + radius * 0.9, drawY + radius * 0.95);
    ctx.lineTo(cx + radius * 1.35, drawY + radius * 0.35);
    ctx.lineTo(cx + radius * 0.85, drawY - radius * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gold Nemes horizontal stripes
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2.2 * scale;
    for (let sy = -0.3; sy <= 0.7; sy += 0.25) {
      ctx.beginPath();
      ctx.moveTo(cx - radius * 1.2, drawY + radius * sy);
      ctx.lineTo(cx + radius * 1.2, drawY + radius * sy);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'celestial_seraphim') {
    // Six Fluttering Radiant Angel Wings (3 pairs)
    ctx.save();
    ctx.fillStyle = 'rgba(254, 249, 195, 0.85)';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = 10 * scale;
    for (let wTier = -1; wTier <= 1; wTier++) {
      const flap = Math.sin(animTime * 5 + wTier) * 4 * scale;
      const wy = drawY + wTier * 10 * scale;
      const span = (1.65 - Math.abs(wTier) * 0.18) * radius;
      // Left Wing
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.5, wy);
      ctx.quadraticCurveTo(cx - span, wy - 14 * scale - flap, cx - span * 1.05, wy + 2 * scale);
      ctx.quadraticCurveTo(cx - span * 0.7, wy + 10 * scale, cx - radius * 0.5, wy + 5 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right Wing
      ctx.beginPath();
      ctx.moveTo(cx + radius * 0.5, wy);
      ctx.quadraticCurveTo(cx + span, wy - 14 * scale - flap, cx + span * 1.05, wy + 2 * scale);
      ctx.quadraticCurveTo(cx + span * 0.7, wy + 10 * scale, cx + radius * 0.5, wy + 5 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'neon_reaper') {
    // Twin Crossed Glowing Violet Plasma Scythes on back
    ctx.save();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 22 * scale, drawY - 26 * scale);
    ctx.lineTo(cx + 20 * scale, drawY + 24 * scale);
    ctx.moveTo(cx + 22 * scale, drawY - 26 * scale);
    ctx.lineTo(cx - 20 * scale, drawY + 24 * scale);
    ctx.stroke();
    // Curved plasma scythe blades
    ctx.fillStyle = '#A855F7';
    ctx.strokeStyle = '#E9D5FF';
    ctx.lineWidth = 1.2 * scale;
    ctx.shadowColor = '#A855F7';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 22 * scale, drawY - 26 * scale);
    ctx.quadraticCurveTo(cx - 38 * scale, drawY - 32 * scale, cx - 36 * scale, drawY - 12 * scale);
    ctx.quadraticCurveTo(cx - 28 * scale, drawY - 20 * scale, cx - 18 * scale, drawY - 21 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 22 * scale, drawY - 26 * scale);
    ctx.quadraticCurveTo(cx + 38 * scale, drawY - 32 * scale, cx + 36 * scale, drawY - 12 * scale);
    ctx.quadraticCurveTo(cx + 28 * scale, drawY - 20 * scale, cx + 18 * scale, drawY - 21 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'space_pirate_corsair') {
    // Laser Cutlass Sheath & Hovering Cyber Parrot Drone
    ctx.save();
    // Sheathed Cyber Cutlass Across Back
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 3.5 * scale;
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 1.2, drawY + radius * 0.7);
    ctx.lineTo(cx + radius * 1.1, drawY - radius * 0.85);
    ctx.stroke();
    // Golden Cutlass Basket Hilt
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(cx - radius * 1.15, drawY + radius * 0.65, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Orbiting Cyber Parrot Drone
    const parrotA = animTime * 2.5;
    const parrotX = cx + Math.cos(parrotA) * (radius * 1.35);
    const parrotY = drawY - radius * 0.6 + Math.sin(parrotA) * 6 * scale;
    ctx.fillStyle = '#C084FC';
    ctx.beginPath();
    ctx.ellipse(parrotX, parrotY, 5 * scale, 3.5 * scale, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.arc(parrotX + 3 * scale, parrotY - 1 * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'shogun_mech') {
    // High-Torque Gunmetal Vernier Thruster Wings & Micro-Missile Pods
    ctx.save();
    // Twin Heavy Shoulder Missile Pods
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1.6 * scale;
    ctx.fillRect(cx - radius * 1.4, drawY - radius * 0.55, 12 * scale, 24 * scale);
    ctx.strokeRect(cx - radius * 1.4, drawY - radius * 0.55, 12 * scale, 24 * scale);
    ctx.fillRect(cx + radius * 1.4 - 12 * scale, drawY - radius * 0.55, 12 * scale, 24 * scale);
    ctx.strokeRect(cx + radius * 1.4 - 12 * scale, drawY - radius * 0.55, 12 * scale, 24 * scale);
    // Missile Tip Indicators
    ctx.fillStyle = '#EF4444';
    for (let r = 0; r < 3; r++) {
      ctx.fillRect(cx - radius * 1.35 + 2 * scale, drawY - radius * 0.45 + r * 7 * scale, 4 * scale, 4 * scale);
      ctx.fillRect(cx + radius * 1.35 - 10 * scale, drawY - radius * 0.45 + r * 7 * scale, 4 * scale, 4 * scale);
    }
    // High-Thrust Cyan Vernier Jet Plumes
    const jetFlicker = Math.sin(animTime * 18) * 3 * scale;
    ctx.fillStyle = '#38BDF8';
    ctx.shadowColor = '#0284C7';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.7, drawY + radius * 0.4);
    ctx.lineTo(cx - radius * 0.9, drawY + radius * 0.95 + jetFlicker);
    ctx.lineTo(cx - radius * 0.5, drawY + radius * 0.4);
    ctx.moveTo(cx + radius * 0.7, drawY + radius * 0.4);
    ctx.lineTo(cx + radius * 0.9, drawY + radius * 0.95 + jetFlicker);
    ctx.lineTo(cx + radius * 0.5, drawY + radius * 0.4);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'glitch_cyber_phantom') {
    // Digitized Cyber Wings with Cyan/Magenta Chromatic Split
    ctx.save();
    const wingFlap = Math.sin(animTime * 7) * 4 * scale;
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#EC4899';
    ctx.shadowBlur = 8 * scale;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * radius * 0.4, drawY);
      ctx.lineTo(cx + dir * (radius * 1.6), drawY - radius * 0.8 - wingFlap);
      ctx.lineTo(cx + dir * (radius * 1.2), drawY);
      ctx.lineTo(cx + dir * (radius * 1.5), drawY + radius * 0.6);
      ctx.lineTo(cx + dir * radius * 0.5, drawY + radius * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'solar_eclipse_knight') {
    // Colossal Obsidian Sun-Greatsword on Back with Coronal Flame
    ctx.save();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 4 * scale;
    ctx.shadowColor = '#FEF08A';
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 1.25, drawY + radius * 0.9);
    ctx.lineTo(cx + radius * 1.25, drawY - radius * 1.1);
    ctx.stroke();
    // Sun Disc Crossguard
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx - radius * 0.6, drawY + radius * 0.3, 8 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'deep_angler_leviathan') {
    // Translucent Serrated Dorsal Spine Fins
    ctx.save();
    ctx.fillStyle = 'rgba(20, 184, 166, 0.7)';
    ctx.strokeStyle = '#5EEAD4';
    ctx.lineWidth = 1.5 * scale;
    for (let i = 0; i < 4; i++) {
      const fx = cx - 18 * scale + i * 12 * scale;
      const finH = (14 + (i % 2) * 6) * scale;
      ctx.beginPath();
      ctx.moveTo(fx, drawY - radius * 0.7);
      ctx.lineTo(fx + 6 * scale, drawY - radius * 0.7 - finH);
      ctx.lineTo(fx + 10 * scale, drawY - radius * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'dr_steampunk_inventor') {
    // Twin Copper Steam Boilers with Pressure Gauges
    ctx.save();
    ctx.fillStyle = '#B45309';
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 1.5 * scale;
    ctx.fillRect(cx - radius * 1.2, drawY - radius * 0.4, 10 * scale, 22 * scale);
    ctx.strokeRect(cx - radius * 1.2, drawY - radius * 0.4, 10 * scale, 22 * scale);
    ctx.fillRect(cx + radius * 1.2 - 10 * scale, drawY - radius * 0.4, 10 * scale, 22 * scale);
    ctx.strokeRect(cx + radius * 1.2 - 10 * scale, drawY - radius * 0.4, 10 * scale, 22 * scale);
    // Pressure Gauge Dial
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.8, drawY - radius * 0.1, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'neon_cyber_kitsune') {
    // Triple Animated Neon Fox Tails with Electric Cyan Tips
    ctx.save();
    ctx.lineWidth = 4 * scale;
    ctx.strokeStyle = '#EC4899';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 10 * scale;
    for (let i = -1; i <= 1; i++) {
      const tailSway = Math.sin(animTime * 4 + i * 1.2) * 8 * scale;
      ctx.beginPath();
      ctx.moveTo(cx + i * 10 * scale, drawY + radius * 0.4);
      ctx.quadraticCurveTo(cx + i * 28 * scale + tailSway, drawY + radius * 0.8, cx + i * 36 * scale + tailSway, drawY + radius * 0.1);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'cosmic_jester') {
    // Bifurcated Cosmic Cape studded with Diamond Constellations
    ctx.save();
    ctx.fillStyle = '#4C1D95';
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.7, drawY);
    ctx.quadraticCurveTo(cx - radius * 1.4, drawY + radius * 0.8, cx - radius * 1.3, drawY + radius * 1.2);
    ctx.lineTo(cx - radius * 0.4, drawY + radius * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.7, drawY);
    ctx.quadraticCurveTo(cx + radius * 1.4, drawY + radius * 0.8, cx + radius * 1.3, drawY + radius * 1.2);
    ctx.lineTo(cx + radius * 0.4, drawY + radius * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'supernova_phoenix') {
    // Blazing Solar Firebird Wings behind mascot
    ctx.save();
    const flap = Math.sin(animTime * 6) * 5 * scale;
    const wGrad = ctx.createLinearGradient(cx - radius * 1.7, drawY - radius, cx + radius * 1.7, drawY + radius);
    wGrad.addColorStop(0, '#FEF08A');
    wGrad.addColorStop(0.5, '#F97316');
    wGrad.addColorStop(1, '#DC2626');
    ctx.fillStyle = wGrad;
    ctx.shadowColor = '#F97316';
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.5, drawY);
    ctx.quadraticCurveTo(cx - radius * 1.7, drawY - radius * 1.1 - flap, cx - radius * 1.75, drawY - radius * 0.1);
    ctx.quadraticCurveTo(cx - radius * 1.3, drawY + radius * 0.5, cx - radius * 0.5, drawY + radius * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.5, drawY);
    ctx.quadraticCurveTo(cx + radius * 1.7, drawY - radius * 1.1 - flap, cx + radius * 1.75, drawY - radius * 0.1);
    ctx.quadraticCurveTo(cx + radius * 1.3, drawY + radius * 0.5, cx + radius * 0.5, drawY + radius * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'cosmic_black_hole') {
    // Relativistic Accretion Ring & Twin Vertical Hawking Jet Spires on Back
    ctx.save();
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 3.5 * scale;
    ctx.shadowColor = '#C084FC';
    ctx.shadowBlur = 14 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, drawY, radius * 1.55, radius * 0.45, 0.25, 0, Math.PI * 2);
    ctx.stroke();
    // Polar Hawking Jet Beams
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius * 0.6);
    ctx.lineTo(cx, drawY - radius * 1.5);
    ctx.moveTo(cx, drawY + radius * 0.6);
    ctx.lineTo(cx, drawY + radius * 1.5);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'cyber_valkyrie_prime') {
    // Grand Holographic Cyber Feather Wings of Starlight
    ctx.save();
    const wingFlap = Math.sin(animTime * 6.5) * 6 * scale;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 12 * scale;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * radius * 0.4, drawY);
      ctx.lineTo(cx + dir * (radius * 1.8), drawY - radius * 1.0 - wingFlap);
      ctx.lineTo(cx + dir * (radius * 1.4), drawY - radius * 0.2);
      ctx.lineTo(cx + dir * (radius * 1.7), drawY + radius * 0.5);
      ctx.lineTo(cx + dir * radius * 0.5, drawY + radius * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'cyber_glitch_oni') {
    // Heavy Spiked Kanabo Club Across Back with Glowing Red Circuit Teeth
    ctx.save();
    ctx.strokeStyle = '#4C0519';
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 1.2, drawY + radius * 0.9);
    ctx.lineTo(cx + radius * 1.2, drawY - radius * 1.0);
    ctx.stroke();
    // Spikes along club
    ctx.fillStyle = '#F43F5E';
    ctx.shadowColor = '#F43F5E';
    ctx.shadowBlur = 8 * scale;
    for (let i = 0; i < 4; i++) {
      const sx = cx + (i * 7 - 10) * scale;
      const sy = drawY - (i * 7 - 4) * scale;
      ctx.fillRect(sx, sy, 3.5 * scale, 3.5 * scale);
    }
    ctx.restore();
  } else if (activeSkin === 'golden_dragon_emperor') {
    // Imperial Golden Dragon Spine Tail & Fluttering Golden Silk Ribbons
    ctx.save();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 4 * scale;
    ctx.shadowColor = '#FEF08A';
    ctx.shadowBlur = 10 * scale;
    const tailWave = Math.sin(animTime * 4) * 8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, drawY + radius * 0.5);
    ctx.quadraticCurveTo(cx - radius * 0.8 + tailWave, drawY + radius * 1.2, cx - radius * 1.2 + tailWave, drawY + radius * 0.6);
    ctx.stroke();
    // Golden silk ribbon banners
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(cx - radius * 1.3 + tailWave, drawY + radius * 0.5, 8 * scale, 12 * scale);
    ctx.restore();
  } else if (activeSkin === 'prism_crystal_golem') {
    // Floating Faceted Gemstone Crystal Clusters Orbiting Shoulders
    ctx.save();
    ctx.fillStyle = '#C084FC';
    ctx.strokeStyle = '#E9D5FF';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#A855F7';
    ctx.shadowBlur = 10 * scale;
    for (let i = 0; i < 4; i++) {
      const a = animTime * 2 + (i * Math.PI) / 2;
      const gx = cx + Math.cos(a) * (radius * 1.35);
      const gy = drawY + Math.sin(a) * (radius * 0.65);
      ctx.beginPath();
      ctx.moveTo(gx, gy - 6 * scale);
      ctx.lineTo(gx + 5 * scale, gy);
      ctx.lineTo(gx, gy + 6 * scale);
      ctx.lineTo(gx - 5 * scale, gy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'deep_sea_abyssal_kraken') {
    // 4 Writhing Bioluminescent Kraken Tentacles Curling Over Shoulders
    ctx.save();
    ctx.strokeStyle = '#0D9488';
    ctx.lineWidth = 4 * scale;
    ctx.shadowColor = '#2DD4BF';
    ctx.shadowBlur = 10 * scale;
    for (const [dir, tOff] of [[-1, 0], [1, 1], [-1.2, 2], [1.2, 3]]) {
      const sway = Math.sin(animTime * 3 + tOff) * 7 * scale;
      ctx.beginPath();
      ctx.moveTo(cx + dir * radius * 0.35, drawY + radius * 0.2);
      ctx.quadraticCurveTo(cx + dir * (radius * 1.25) + sway, drawY - radius * 0.5, cx + dir * (radius * 1.4) + sway, drawY - radius * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'inferno_lava_demon') {
    // Leathery Obsidian Demon Wings with Dripping Lava Veins & Searing Ribs
    ctx.save();
    const wingFlap = Math.sin(animTime * 5.5) * 5 * scale;
    ctx.fillStyle = '#09090B';
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 2.2 * scale;
    ctx.shadowColor = '#FF4500';
    ctx.shadowBlur = 14 * scale;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * radius * 0.4, drawY);
      ctx.lineTo(cx + dir * (radius * 1.65), drawY - radius * 1.15 - wingFlap);
      ctx.lineTo(cx + dir * (radius * 1.25), drawY - radius * 0.2);
      ctx.lineTo(cx + dir * (radius * 1.55), drawY + radius * 0.5);
      ctx.lineTo(cx + dir * radius * 0.5, drawY + radius * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing Molten Lava Skeletal Struts
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.moveTo(cx + dir * radius * 0.4, drawY);
      ctx.lineTo(cx + dir * (radius * 1.55), drawY - radius * 1.05 - wingFlap);
      ctx.moveTo(cx + dir * radius * 0.4, drawY);
      ctx.lineTo(cx + dir * (radius * 1.45), drawY + radius * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'retro_synthwave_racer') {
    // 80s Synthwave Outrun: Dual Turbo Rocket Thrusters firing supersonic cyan & hot-magenta plumes
    ctx.save();
    // Checkered Racing Cape with Magenta Neon Trim
    ctx.fillStyle = '#16042E';
    ctx.strokeStyle = '#FF007F';
    ctx.lineWidth = 2 * scale;
    const flap = Math.sin(animTime * 6.5) * 5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.6, drawY);
    ctx.lineTo(cx - radius * 1.05 + flap, drawY + radius * 1.45);
    ctx.lineTo(cx + radius * 1.05 + flap, drawY + radius * 1.45);
    ctx.lineTo(cx + radius * 0.6, drawY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Twin Polished Chrome Rocket Thruster Canisters
    for (const [exDir, col, flameCol] of ([[-1, '#00F0FF', '#38BDF8'], [1, '#FF007F', '#F43F5E']] as [number, string, string][])) {
      const exX = cx + exDir * 17 * scale;
      const exY = drawY + radius * 0.65;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(exX - 3.5 * scale, exY, 7 * scale, 13 * scale);
      ctx.strokeStyle = col as string;
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeRect(exX - 3.5 * scale, exY, 7 * scale, 13 * scale);

      // Rocket supersonic exhaust flame cones
      ctx.fillStyle = flameCol as string;
      ctx.shadowColor = col as string;
      ctx.shadowBlur = 10 * scale;
      const fLen = (18 + Math.sin(animTime * 18 + exDir * 3) * 6) * scale;
      ctx.beginPath();
      ctx.moveTo(exX - 3 * scale, exY + 13 * scale);
      ctx.lineTo(exX, exY + 13 * scale + fLen);
      ctx.lineTo(exX + 3 * scale, exY + 13 * scale);
      ctx.closePath();
      ctx.fill();
      // White-hot core
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(exX - 1.5 * scale, exY + 13 * scale);
      ctx.lineTo(exX, exY + 13 * scale + fLen * 0.5);
      ctx.lineTo(exX + 1.5 * scale, exY + 13 * scale);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'cyber_stealth_operative') {
    // Silenced Carbon-Fiber Photon Jump Pack with Active-Camo Hex Fins
    ctx.save();
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1.8 * scale;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 8 * scale;
    // Central Jump Generator Pack
    ctx.fillRect(cx - 10 * scale, drawY - 8 * scale, 20 * scale, 24 * scale);
    ctx.strokeRect(cx - 10 * scale, drawY - 8 * scale, 20 * scale, 24 * scale);
    // Twin Suppressor Wings
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 10 * scale, drawY - 4 * scale);
      ctx.lineTo(cx + dir * 26 * scale, drawY - 18 * scale);
      ctx.lineTo(cx + dir * 20 * scale, drawY + 16 * scale);
      ctx.lineTo(cx + dir * 10 * scale, drawY + 10 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Emerald Energy Capacitor Core
    ctx.fillStyle = '#34D399';
    ctx.fillRect(cx - 3 * scale, drawY - 2 * scale, 6 * scale, 12 * scale);
    ctx.restore();
  } else if (activeSkin === 'electric_storm_raijin') {
    // Floating Halo Ring of 6 Electrified Golden Shinto Taiko Drums with Tomoe Spirals
    ctx.save();
    const haloR = radius * 1.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 12 * scale;
    for (let i = 0; i < 6; i++) {
      const da = animTime * 1.5 + (i * Math.PI * 2) / 6;
      const dx = cx + Math.cos(da) * haloR;
      const dy = drawY + Math.sin(da) * (haloR * 0.85);
      // Drum body
      ctx.fillStyle = '#B45309';
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.arc(dx, dy, 7.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Tomoe gold spiral pip
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(dx, dy, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
      // Lightning arc connecting to adjacent drum
      const nextA = animTime * 1.5 + ((i + 1) * Math.PI * 2) / 6;
      const nx = cx + Math.cos(nextA) * haloR;
      const ny = drawY + Math.sin(nextA) * (haloR * 0.85);
      ctx.strokeStyle = '#BAE6FD';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo((dx + nx) / 2 + Math.sin(animTime * 20 + i) * 4 * scale, (dy + ny) / 2);
      ctx.lineTo(nx, ny);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'mecha_dragoon_valkyrie') {
    // Twin Variable-Sweep Photon Particle Wings with Vernier Afterburners
    ctx.save();
    const wingSweep = Math.sin(animTime * 3) * 4 * scale;
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#818CF8';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#6366F1';
    ctx.shadowBlur = 12 * scale;
    for (const dir of [-1, 1]) {
      // Main Mecha Wing Blade
      ctx.beginPath();
      ctx.moveTo(cx + dir * 8 * scale, drawY - 6 * scale);
      ctx.lineTo(cx + dir * 36 * scale, drawY - (22 + wingSweep) * scale);
      ctx.lineTo(cx + dir * 28 * scale, drawY - 2 * scale);
      ctx.lineTo(cx + dir * 34 * scale, drawY + (16 - wingSweep) * scale);
      ctx.lineTo(cx + dir * 10 * scale, drawY + 8 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Glowing Photonic Particle Edge
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.moveTo(cx + dir * 12 * scale, drawY - 4 * scale);
      ctx.lineTo(cx + dir * 34 * scale, drawY - (20 + wingSweep) * scale);
      ctx.stroke();
      // Vernier Thruster Nozzle & Cyan Flame
      const vX = cx + dir * 18 * scale;
      const vY = drawY + 12 * scale;
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(vX, vY, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'frost_valkyrie_queen') {
    // 6 Floating Sub-Zero Geometric Diamond Ice Shard Wings
    ctx.save();
    ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.6 * scale;
    ctx.shadowColor = '#BAE6FD';
    ctx.shadowBlur = 14 * scale;
    for (const dir of [-1, 1]) {
      for (let s = 0; s < 3; s++) {
        const sOff = animTime * 2.5 + s * 0.8;
        const fl = Math.sin(sOff) * 3 * scale;
        const sx = cx + dir * (14 + s * 10) * scale;
        const sy = drawY - (18 - s * 14 + fl) * scale;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 10 * scale);
        ctx.lineTo(sx + dir * 6 * scale, sy);
        ctx.lineTo(sx, sy + 10 * scale);
        ctx.lineTo(sx - dir * 6 * scale, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  } else if (activeSkin === 'toxic_cyber_mutant') {
    // Twin Heavy Hazardous Sludge Tanks with Bubbling Acid Viewing Tubes
    ctx.save();
    for (const dir of [-1, 1]) {
      const tx = cx + dir * 18 * scale;
      const ty = drawY + 2 * scale;
      // Steel Tank Body
      ctx.fillStyle = '#0D1702';
      ctx.strokeStyle = '#EAB308';
      ctx.lineWidth = 1.8 * scale;
      ctx.fillRect(tx - 5 * scale, ty - 14 * scale, 10 * scale, 24 * scale);
      ctx.strokeRect(tx - 5 * scale, ty - 14 * scale, 10 * scale, 24 * scale);
      // Glowing Acid Level Viewport
      ctx.fillStyle = '#84CC16';
      ctx.shadowColor = '#A3E635';
      ctx.shadowBlur = 8 * scale;
      const acidH = (12 + Math.sin(animTime * 6 + dir) * 3) * scale;
      ctx.fillRect(tx - 2.5 * scale, ty + 8 * scale - acidH, 5 * scale, acidH);
      // Hazard Black Stripe
      ctx.fillStyle = '#000000';
      ctx.fillRect(tx - 4 * scale, ty - 8 * scale, 8 * scale, 2 * scale);
    }
    ctx.restore();
  } else if (activeSkin === 'steampunk_aeronaut_ace') {
    // Victorian Aviator Copper Boiler with Spinning Twin Brass Dual-Blade Propellers
    ctx.save();
    // Copper Boiler Vessel
    ctx.fillStyle = '#78350F';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.8 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY + 4 * scale, 14 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Twin Spinning Brass Propellers
    for (const dir of [-1, 1]) {
      const px = cx + dir * 22 * scale;
      const py = drawY - 10 * scale;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(animTime * 22 * dir);
      ctx.fillStyle = '#FDE68A';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1.2 * scale;
      // 2 Blades
      for (const a of [0, Math.PI]) {
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 8 * scale, Math.sin(a) * 8 * scale, 8 * scale, 3 * scale, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // Center brass hub
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.arc(0, 0, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  } else if (activeSkin === 'classic') {
    if (playerId === 0) {
      // P1: Winged Crest (Behind)
      ctx.save();
      ctx.fillStyle = theme.dark;
      ctx.beginPath();
      ctx.moveTo(cx - 20 * scale, drawY - 10 * scale);
      ctx.lineTo(cx - 28 * scale, drawY - 32 * scale);
      ctx.lineTo(cx - 12 * scale, drawY - 22 * scale);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx + 20 * scale, drawY - 10 * scale);
      ctx.lineTo(cx + 28 * scale, drawY - 32 * scale);
      ctx.lineTo(cx + 12 * scale, drawY - 22 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (playerId === 1) {
      // P2: Cyber Tech Ears / Jet Fins
      ctx.save();
      ctx.fillStyle = theme.dark;
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(cx - 33 * scale, drawY - 12 * scale, 8 * scale, 24 * scale, 4 * scale)
        : ctx.rect(cx - 33 * scale, drawY - 12 * scale, 8 * scale, 24 * scale);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(cx + 25 * scale, drawY - 12 * scale, 8 * scale, 24 * scale, 4 * scale)
        : ctx.rect(cx + 25 * scale, drawY - 12 * scale, 8 * scale, 24 * scale);
      ctx.fill();
      ctx.restore();
    } else if (playerId === 2) {
      // P3: Scout Sprout / Antenna Fins
      ctx.save();
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(cx - 16 * scale, drawY - 24 * scale, 6 * scale, 0, Math.PI * 2);
      ctx.arc(cx + 16 * scale, drawY - 24 * scale, 6 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (playerId === 3) {
      // P4: Solar Star Crest Trim
      ctx.save();
      ctx.fillStyle = theme.dark;
      ctx.beginPath();
      ctx.moveTo(cx, drawY - 36 * scale);
      ctx.lineTo(cx - 10 * scale, drawY - 24 * scale);
      ctx.lineTo(cx + 10 * scale, drawY - 24 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // 3. Main Spherical Chassis Body (Rich 2.5D Lighting Gradient)
  const bodyGrad = ctx.createRadialGradient(
    cx - radius * 0.35,
    drawY - radius * 0.45,
    radius * 0.1,
    cx,
    drawY,
    radius
  );
  bodyGrad.addColorStop(0, theme.light);
  bodyGrad.addColorStop(0.45, theme.primary);
  bodyGrad.addColorStop(1, theme.dark);

  ctx.beginPath();
  ctx.arc(cx, drawY, radius, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Subtle outer edge stroke for crisp vector punch
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = Math.max(1.5, 2.5 * scale);
  ctx.stroke();

  // 4. Glossy Specular Rim Curve (Top-Left Highlight)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    cx - radius * 0.28,
    drawY - radius * 0.45,
    radius * 0.48,
    radius * 0.22,
    -Math.PI / 5,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fill();
  ctx.restore();

  // 5. Glossy Visor / Faceplate (Dark Tech Mask)
  const visorW = radius * 1.35;
  const visorH = radius * 0.72;
  const visorX = cx - visorW / 2;
  const visorY = drawY - radius * 0.12;
  const visorR = visorH * 0.45;

  ctx.save();
  // Visor drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 6 * scale;
  ctx.shadowOffsetY = 2 * scale;

  const visorGrad = ctx.createLinearGradient(visorX, visorY, visorX, visorY + visorH);
  visorGrad.addColorStop(0, '#0F172A');
  visorGrad.addColorStop(0.6, '#1E293B');
  visorGrad.addColorStop(1, '#020617');

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(visorX, visorY, visorW, visorH, visorR);
  } else {
    ctx.rect(visorX, visorY, visorW, visorH);
  }
  ctx.fillStyle = visorGrad;
  ctx.fill();
  ctx.restore();

  // Visor rim border
  ctx.strokeStyle = isBot ? '#38BDF8' : theme.light;
  ctx.lineWidth = Math.max(1, 1.8 * scale);
  ctx.stroke();

  // Visor glass sheen (top-half angled glare)
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(visorX, visorY, visorW, visorH, visorR);
  } else {
    ctx.rect(visorX, visorY, visorW, visorH);
  }
  ctx.clip();

  const sheenGrad = ctx.createLinearGradient(visorX, visorY, visorX + visorW, visorY + visorH);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  sheenGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)');
  sheenGrad.addColorStop(0.41, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(visorX, visorY, visorW, visorH);
  ctx.restore();

  // 6. Expressive Digital Eyes
  const eyeColor = isBot ? '#38BDF8' : theme.visorGlow;
  const eyeY = visorY + visorH * 0.52;
  const eyeOffset = visorW * 0.24;

  ctx.save();
  ctx.fillStyle = eyeColor;
  ctx.strokeStyle = eyeColor;
  ctx.lineWidth = Math.max(1.5, 3 * scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Eye glow
  ctx.shadowColor = eyeColor;
  ctx.shadowBlur = 6 * scale;

  if (mood === 'happy' || mood === 'triumph') {
    // Cheerful chevron / arch eyes: ^ ^
    const archH = 5 * scale;
    const archW = 6 * scale;

    ctx.beginPath();
    ctx.moveTo(cx - eyeOffset - archW, eyeY + archH);
    ctx.lineTo(cx - eyeOffset, eyeY - archH);
    ctx.lineTo(cx - eyeOffset + archW, eyeY + archH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + eyeOffset - archW, eyeY + archH);
    ctx.lineTo(cx + eyeOffset, eyeY - archH);
    ctx.lineTo(cx + eyeOffset + archW, eyeY + archH);
    ctx.stroke();
  } else if (mood === 'shocked') {
    // Wide surprised round eyes: O O
    const eyeR = 5 * scale;
    ctx.beginPath();
    ctx.arc(cx - eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    // Natural periodic digital blink (every ~3.6s, eyes blink for 140ms)
    const blinkCycle = (animTime + playerId * 1.2) % 3.6;
    const isBlinking = blinkCycle < 0.14;
    const blinkRatio = isBlinking ? (1 - Math.sin((blinkCycle / 0.14) * Math.PI)) : 1.0;
    const eyeW = 4.5 * scale;
    const eyeH = Math.max(1.2 * scale, 7 * scale * blinkRatio);

    // Left Eye
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cx - eyeOffset - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH, eyeW / 2);
    } else {
      ctx.rect(cx - eyeOffset - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH);
    }
    ctx.fill();

    // Right Eye
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cx + eyeOffset - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH, eyeW / 2);
    } else {
      ctx.rect(cx + eyeOffset - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH);
    }
    ctx.fill();
  }
  ctx.restore();

  // 6.5 Panic sweat drop when shocked or in sudden death
  if (mood === 'shocked') {
    ctx.save();
    const sweatX = cx + visorW * 0.44;
    const sweatY = visorY - 3 * scale;
    ctx.fillStyle = '#67E8F9';
    ctx.beginPath();
    ctx.arc(sweatX, sweatY, 3.2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sweatX, sweatY - 5 * scale);
    ctx.lineTo(sweatX + 2.5 * scale, sweatY);
    ctx.lineTo(sweatX - 2.5 * scale, sweatY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 6.8 Colorblind Accessibility Heraldic Crest on Chassis Core
  ctx.save();
  const emblemY = drawY + radius * 0.52;
  const emblemSize = 4.2 * scale;
  ctx.fillStyle = theme.accent;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(1, 1.2 * scale);

  ctx.beginPath();
  if (playerId === 0) {
    // P1: Bold Square
    ctx.rect(cx - emblemSize, emblemY - emblemSize, emblemSize * 2, emblemSize * 2);
  } else if (playerId === 1) {
    // P2: Diamond
    ctx.moveTo(cx, emblemY - emblemSize * 1.2);
    ctx.lineTo(cx + emblemSize * 1.2, emblemY);
    ctx.lineTo(cx, emblemY + emblemSize * 1.2);
    ctx.lineTo(cx - emblemSize * 1.2, emblemY);
    ctx.closePath();
  } else if (playerId === 2) {
    // P3: Triangle
    ctx.moveTo(cx, emblemY - emblemSize * 1.2);
    ctx.lineTo(cx + emblemSize * 1.2, emblemY + emblemSize);
    ctx.lineTo(cx - emblemSize * 1.2, emblemY + emblemSize);
    ctx.closePath();
  } else {
    // P4: Hexagon
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const ex = cx + Math.cos(angle) * emblemSize * 1.1;
      const ey = emblemY + Math.sin(angle) * emblemSize * 1.1;
      if (i === 0) ctx.moveTo(ex, ey);
      else ctx.lineTo(ex, ey);
    }
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 7. Bot Chrome Antenna & Pulsing Node (if isBot)
  if (isBot) {
    ctx.save();
    // Antenna stem
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = Math.max(1.5, 2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius);
    ctx.lineTo(cx, drawY - radius - 14 * scale);
    ctx.stroke();

    // Pulsing LED node
    const ledR = (4.5 + Math.sin(animTime * 8) * 1) * scale;
    const ledGrad = ctx.createRadialGradient(
      cx,
      drawY - radius - 15 * scale,
      1,
      cx,
      drawY - radius - 15 * scale,
      ledR
    );
    ledGrad.addColorStop(0, '#FFFFFF');
    ledGrad.addColorStop(0.4, '#38BDF8');
    ledGrad.addColorStop(1, '#0284C7');

    ctx.beginPath();
    ctx.arc(cx, drawY - radius - 15 * scale, ledR, 0, Math.PI * 2);
    ctx.fillStyle = ledGrad;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 10 * scale;
    ctx.fill();
    ctx.restore();
  }

  // 8. Champion Golden Crown (if mood === 'triumph')
  if (mood === 'triumph') {
    if (activeSkin === 'classic') {
      ctx.save();
      const crownW = radius * 1.25;
      const crownH = radius * 0.72;
      const crownX = cx - crownW / 2;
      const crownY = drawY - radius * 1.15;

      ctx.shadowColor = 'rgba(245, 158, 11, 0.65)';
      ctx.shadowBlur = 12 * scale;
      ctx.shadowOffsetY = 2 * scale;

      const crownGrad = ctx.createLinearGradient(crownX, crownY, crownX, crownY + crownH);
      crownGrad.addColorStop(0, '#FEF08A');
      crownGrad.addColorStop(0.5, '#F59E0B');
      crownGrad.addColorStop(1, '#B45309');

      ctx.beginPath();
      ctx.moveTo(crownX, crownY + crownH);
      ctx.lineTo(crownX + crownW, crownY + crownH);
      ctx.lineTo(crownX + crownW, crownY + crownH * 0.25);
      ctx.lineTo(crownX + crownW * 0.75, crownY + crownH * 0.55);
      ctx.lineTo(crownX + crownW * 0.5, crownY);
      ctx.lineTo(crownX + crownW * 0.25, crownY + crownH * 0.55);
      ctx.lineTo(crownX, crownY + crownH * 0.25);
      ctx.closePath();
      ctx.fillStyle = crownGrad;
      ctx.fill();

      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.stroke();

      // Center Ruby Jewel in Crown
      ctx.beginPath();
      ctx.arc(cx, crownY + crownH * 0.65, 3.5 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1 * scale;
      ctx.stroke();
      ctx.restore();
    } else {
      // Floating Victory Starlight Halo high above custom headgear so hats/helmets are never covered
      ctx.save();
      const haloY = drawY - radius * 1.65;
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
      ctx.lineWidth = 2 * scale;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 10 * scale;
      ctx.beginPath();
      ctx.ellipse(cx, haloY, radius * 0.65, radius * 0.16, 0, 0, Math.PI * 2);
      ctx.stroke();
      drawStarSparkle(ctx, cx - radius * 0.85, haloY + 4 * scale, 4 * scale);
      drawStarSparkle(ctx, cx + radius * 0.85, haloY + 4 * scale, 4 * scale);
      ctx.restore();
    }
  }

  // 8.5 Unique Custom Headgear & Masks for Skins (Unmistakable Silhouettes)
  if (activeSkin === 'pirate_captain') {
    // Pirate Tricorn Hat with Skull & Crossbones & Gold Hoop Earring
    ctx.save();
    const hatW = radius * 2.2;
    const hatH = radius * 0.95;
    const hatX = cx - hatW / 2;
    const hatY = drawY - radius * 1.4;
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(hatX, hatY + hatH);
    ctx.quadraticCurveTo(cx - radius * 0.4, hatY + hatH * 0.1, cx, hatY);
    ctx.quadraticCurveTo(cx + radius * 0.4, hatY + hatH * 0.1, hatX + hatW, hatY + hatH);
    ctx.quadraticCurveTo(cx, hatY + hatH * 0.7, hatX, hatY + hatH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Skull & Bones emblem
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, hatY + hatH * 0.55, 3.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Pirate Eyepatch
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(cx - eyeOffset, eyeY, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - eyeOffset - 10 * scale, eyeY - 8 * scale);
    ctx.lineTo(cx - eyeOffset + 10 * scale, eyeY + 8 * scale);
    ctx.stroke();
    // Gold Earring
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx + radius * 0.95, drawY + 2 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'space_pirate_corsair') {
    // Void Corsair Cyber-Tricorne Hat with Holographic Skull & Laser Telescope Eye-Scope
    ctx.save();
    const hatW = radius * 2.35;
    const hatH = radius * 1.05;
    const hatX = cx - hatW / 2;
    const hatY = drawY - radius * 1.45;
    const hatGrad = ctx.createLinearGradient(hatX, hatY, hatX, hatY + hatH);
    hatGrad.addColorStop(0, '#4C1D95');
    hatGrad.addColorStop(1, '#0F0B1E');
    ctx.fillStyle = hatGrad;
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2.2 * scale;
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(hatX, hatY + hatH);
    ctx.quadraticCurveTo(cx - radius * 0.45, hatY + hatH * 0.05, cx, hatY - 2 * scale);
    ctx.quadraticCurveTo(cx + radius * 0.45, hatY + hatH * 0.05, hatX + hatW, hatY + hatH);
    ctx.quadraticCurveTo(cx, hatY + hatH * 0.65, hatX, hatY + hatH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Glowing Neon Cyan Holographic Skull Emblem on Hat
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.arc(cx, hatY + hatH * 0.5, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(cx - 1.5 * scale, hatY + hatH * 0.48, 1 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 1.5 * scale, hatY + hatH * 0.48, 1 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Brass & Neon Cyan Laser Telescope Bionic Eye-Scope over Right Eye
    ctx.fillStyle = '#1E1B4B';
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.arc(cx + eyeOffset, eyeY, 6.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.arc(cx + eyeOffset, eyeY, 3.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Crosshair reticle inside bionic eye
    ctx.strokeStyle = '#67E8F9';
    ctx.lineWidth = 0.8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx + eyeOffset - 5 * scale, eyeY);
    ctx.lineTo(cx + eyeOffset + 5 * scale, eyeY);
    ctx.moveTo(cx + eyeOffset, eyeY - 5 * scale);
    ctx.lineTo(cx + eyeOffset, eyeY + 5 * scale);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'cyber_samurai_ronin') {
    // Holographic Conical Jingasa Straw Hat with Cyan/Magenta Neon Rim & Menpo Mask
    ctx.save();
    const hatY = drawY - radius * 0.72;
    const hatW = radius * 2.55;
    const hatH = radius * 0.68;
    const jGrad = ctx.createLinearGradient(cx - hatW / 2, hatY - hatH, cx + hatW / 2, hatY);
    jGrad.addColorStop(0, '#0F172A');
    jGrad.addColorStop(0.5, '#1E293B');
    jGrad.addColorStop(1, '#083344');
    ctx.fillStyle = jGrad;
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2.2 * scale;
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - hatW / 2, hatY);
    ctx.quadraticCurveTo(cx - radius * 0.4, hatY - hatH * 0.85, cx, hatY - hatH);
    ctx.quadraticCurveTo(cx + radius * 0.4, hatY - hatH * 0.85, cx + hatW / 2, hatY);
    ctx.quadraticCurveTo(cx, hatY + 5 * scale, cx - hatW / 2, hatY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Holographic Magenta Lattice Ribs on Jingasa
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.75)';
    ctx.lineWidth = 1.2 * scale;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, hatY - hatH);
      ctx.lineTo(cx + i * (hatW * 0.18), hatY + 1 * scale);
      ctx.stroke();
    }
    // Cyber Menpo Jaw Guard below visor
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.55, drawY + radius * 0.28);
    ctx.lineTo(cx, drawY + radius * 0.52);
    ctx.lineTo(cx + radius * 0.55, drawY + radius * 0.28);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'retro_gameboy_classic') {
    // 1989 Chomp-Boy DMG-01 Screen Bezel, Red Battery LED, Tactile D-Pad & Crimson A/B Buttons
    ctx.save();
    // Top "DOT MATRIX" magenta/blue bezel accent lines above visor
    ctx.strokeStyle = '#831843';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.72, visorY - 4 * scale);
    ctx.lineTo(cx + radius * 0.72, visorY - 4 * scale);
    ctx.stroke();
    // Glowing Red Battery Indicator LED on left bezel
    ctx.fillStyle = '#EF4444';
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 5 * scale;
    ctx.beginPath();
    ctx.arc(cx - radius * 0.78, visorY + visorH * 0.45, 2.2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Directional Cross D-Pad on lower-left chest
    const dpx = cx - radius * 0.42;
    const dpy = drawY + radius * 0.54;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(dpx - 7 * scale, dpy - 2.5 * scale, 14 * scale, 5 * scale);
    ctx.fillRect(dpx - 2.5 * scale, dpy - 7 * scale, 5 * scale, 14 * scale);
    // Crimson A & B Tactile Buttons on lower-right chest
    ctx.fillStyle = '#BE123C';
    ctx.beginPath();
    ctx.arc(cx + radius * 0.28, dpy + 2 * scale, 3.6 * scale, 0, Math.PI * 2);
    ctx.arc(cx + radius * 0.54, dpy - 2 * scale, 3.6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'mecha_kaiju') {
    // Atomic Mecha-Kaiju Horned Snout Crest & Steel Fang Jawplate
    ctx.save();
    // Center Cherenkov Nasal Horn
    ctx.fillStyle = '#10B981';
    ctx.strokeStyle = '#A7F3D0';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 6 * scale, drawY - radius * 0.75);
    ctx.lineTo(cx, drawY - radius * 1.45);
    ctx.lineTo(cx + 6 * scale, drawY - radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Steel Kaiju Fangs along bottom of visor
    ctx.fillStyle = '#E2E8F0';
    for (let f = -2; f <= 2; f++) {
      const fx = cx + f * 7 * scale;
      const fy = visorY + visorH;
      ctx.beginPath();
      ctx.moveTo(fx - 2.5 * scale, fy);
      ctx.lineTo(fx, fy - 4.5 * scale);
      ctx.lineTo(fx + 2.5 * scale, fy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'pharaoh_anubis') {
    // Tall Anubis Jackal Ears, Golden Nemes Browband & Royal Uraeus Cobra Crest
    ctx.save();
    // Tall Pointed Jackal Ears
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.65, drawY - radius * 0.65);
    ctx.lineTo(cx - radius * 0.55, drawY - radius * 1.55);
    ctx.lineTo(cx - radius * 0.2, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.65, drawY - radius * 0.65);
    ctx.lineTo(cx + radius * 0.55, drawY - radius * 1.55);
    ctx.lineTo(cx + radius * 0.2, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Golden Uraeus Cobra on forehead
    ctx.fillStyle = '#FBBF24';
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, drawY - radius * 0.92, 6 * scale, 9 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.95, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'cyber_netrunner') {
    // Quad-Optic Hologram Cyber-Goggles & High Neon Tech Collar
    ctx.save();
    const gogY = drawY - radius * 0.55;
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 1.6 * scale;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(cx - radius * 0.82, gogY - 7 * scale, radius * 1.64, 13 * scale, 6 * scale)
      : ctx.rect(cx - radius * 0.82, gogY - 7 * scale, radius * 1.64, 13 * scale);
    ctx.fill();
    ctx.stroke();
    // 4 Glowing Cyan/Magenta Optic Lenses
    for (let i = 0; i < 4; i++) {
      const lx = cx - 15 * scale + i * 10 * scale;
      ctx.fillStyle = i % 2 === 0 ? '#06B6D4' : '#EC4899';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6 * scale;
      ctx.beginPath();
      ctx.arc(lx, gogY - 0.5 * scale, 3.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'celestial_seraphim') {
    // Burning Golden Ophanim Wheel-of-Eyes Halo above head
    ctx.save();
    const haloY = drawY - radius * 1.25;
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3 * scale;
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, haloY, radius * 0.95, radius * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Glowing Seraph Eyes studded along the Ophanim Ring
    for (let i = -2; i <= 2; i++) {
      const ex = cx + i * 10 * scale;
      const ey = haloY + Math.cos(i * 0.6) * 3 * scale;
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(ex, ey, 2.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'neon_reaper') {
    // Cowled Obsidian Reaper Hood & Bone Skull Jawplate
    ctx.save();
    ctx.fillStyle = '#090514';
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#A855F7';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.98, drawY - radius * 0.1);
    ctx.quadraticCurveTo(cx - radius * 0.85, drawY - radius * 1.25, cx, drawY - radius * 1.38);
    ctx.quadraticCurveTo(cx + radius * 0.85, drawY - radius * 1.25, cx + radius * 0.98, drawY - radius * 0.1);
    ctx.quadraticCurveTo(cx, drawY - radius * 0.55, cx - radius * 0.98, drawY - radius * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'chrono_timelord') {
    // Celestial Brass & Cyan Astrolabe Clockwork Crown
    ctx.save();
    const clockY = drawY - radius * 1.05;
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.arc(cx, clockY, 11 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Rotating Astrolabe Clock Hands
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.6 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, clockY);
    ctx.lineTo(cx + Math.cos(animTime * 4) * 8 * scale, clockY + Math.sin(animTime * 4) * 8 * scale);
    ctx.moveTo(cx, clockY);
    ctx.lineTo(cx + Math.cos(-animTime * 1.5) * 6 * scale, clockY + Math.sin(-animTime * 1.5) * 6 * scale);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'shogun_mech') {
    // Towering Golden Gundam V-Fin Kabuto Crest & Emerald Forehead Sensor
    ctx.save();
    const vY = drawY - radius * 0.68;
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, vY);
    ctx.lineTo(cx - radius * 1.35, vY - radius * 0.85);
    ctx.lineTo(cx - radius * 1.1, vY - radius * 0.95);
    ctx.lineTo(cx, vY - 5 * scale);
    ctx.lineTo(cx + radius * 1.1, vY - radius * 0.95);
    ctx.lineTo(cx + radius * 1.35, vY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Central Emerald Mecha Camera Sensor
    ctx.fillStyle = '#10B981';
    ctx.fillRect(cx - 3.5 * scale, vY - 7 * scale, 7 * scale, 7 * scale);
    ctx.restore();
  } else if (activeSkin === 'marshmallow_dj') {
    // White Cylinder LED Bucket Top, Neon X-Eyes & RGB Equalizer Collar
    ctx.save();
    // Flat Cylinder Bucket Top Ridge
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, drawY - radius * 0.82, radius * 0.92, radius * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Glowing Neon X-Eyes over Visor
    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 2.8 * scale;
    ctx.shadowColor = '#EC4899';
    ctx.shadowBlur = 8 * scale;
    for (const ex of [cx - eyeOffset, cx + eyeOffset]) {
      ctx.beginPath();
      ctx.moveTo(ex - 5 * scale, eyeY - 5 * scale);
      ctx.lineTo(ex + 5 * scale, eyeY + 5 * scale);
      ctx.moveTo(ex + 5 * scale, eyeY - 5 * scale);
      ctx.lineTo(ex - 5 * scale, eyeY + 5 * scale);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'plague_alchemist') {
    // Wide-Brim Alchemist Hat & Curved Beaked Mask with Glowing Emerald Lenses
    ctx.save();
    const hatY = drawY - radius * 0.78;
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1.5 * scale;
    ctx.fillRect(cx - radius * 0.58, hatY - 14 * scale, radius * 1.16, 14 * scale);
    ctx.strokeRect(cx - radius * 0.58, hatY - 14 * scale, radius * 1.16, 14 * scale);
    ctx.beginPath();
    ctx.ellipse(cx, hatY, radius * 1.3, 5.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Curved Bird-Beak Nose Cone on Visor
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#34D399';
    ctx.beginPath();
    ctx.moveTo(cx - 6 * scale, eyeY + 2 * scale);
    ctx.quadraticCurveTo(cx + 12 * scale, eyeY + 8 * scale, cx + 4 * scale, eyeY + 18 * scale);
    ctx.lineTo(cx - 6 * scale, eyeY + 10 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'supernova_phoenix') {
    // Three-Plume Blazing Solar Phoenix Feather Crest
    ctx.save();
    const crestY = drawY - radius * 0.85;
    for (let i = -1; i <= 1; i++) {
      ctx.save();
      ctx.translate(cx + i * 7 * scale, crestY);
      ctx.rotate(i * 0.35 + Math.sin(animTime * 5 + i) * 0.08);
      ctx.fillStyle = i === 0 ? '#FEF08A' : '#F97316';
      ctx.shadowColor = '#EA580C';
      ctx.shadowBlur = 10 * scale;
      ctx.beginPath();
      ctx.ellipse(0, -10 * scale, 4 * scale, 13 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  } else if (activeSkin === 'glitch_cyber_phantom') {
    // Holographic Faceted Polygon Faceplate & Shifting Glitch Horns
    ctx.save();
    const gY = drawY - radius * 0.75;
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#EC4899';
    ctx.shadowBlur = 10 * scale;
    // Polygonal Visor Crown
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.8, gY);
    ctx.lineTo(cx - radius * 0.4, gY - 14 * scale);
    ctx.lineTo(cx, gY - 6 * scale);
    ctx.lineTo(cx + radius * 0.4, gY - 14 * scale);
    ctx.lineTo(cx + radius * 0.8, gY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.fill();
    ctx.stroke();
    // Glitching Cyan/Magenta Ocular Slits
    const glitchOffset = Math.sin(animTime * 25) * 2 * scale;
    ctx.fillStyle = '#EC4899';
    ctx.fillRect(cx - 10 * scale + glitchOffset, eyeY - 2 * scale, 8 * scale, 3 * scale);
    ctx.fillStyle = '#06B6D4';
    ctx.fillRect(cx + 2 * scale - glitchOffset, eyeY - 2 * scale, 8 * scale, 3 * scale);
    ctx.restore();
  } else if (activeSkin === 'solar_eclipse_knight') {
    // Burning Golden Solar Eclipse Coronal Halo & Obsidian Sallet Crest
    ctx.save();
    const haloY = drawY - radius * 0.85;
    // Radiant Coronal Flare Halo
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3.5 * scale;
    ctx.shadowColor = '#FEF08A';
    ctx.shadowBlur = 14 * scale;
    ctx.beginPath();
    ctx.arc(cx, haloY, radius * 0.65, 0, Math.PI * 2);
    ctx.stroke();
    // Black Moon Eclipse Disc inside
    ctx.fillStyle = '#09090B';
    ctx.beginPath();
    ctx.arc(cx, haloY, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();
    // Crown Spikes
    ctx.fillStyle = '#FDE047';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const sx = cx + Math.cos(a) * radius * 0.65;
      const sy = haloY + Math.sin(a) * radius * 0.65;
      ctx.fillRect(sx - 2 * scale, sy - 2 * scale, 4 * scale, 4 * scale);
    }
    ctx.restore();
  } else if (activeSkin === 'deep_angler_leviathan') {
    // Bioluminescent Curved Lure Stalk Dangling Over Visor
    ctx.save();
    const stalkBaseY = drawY - radius * 0.8;
    ctx.strokeStyle = '#0D9488';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, stalkBaseY);
    ctx.quadraticCurveTo(cx + 12 * scale, stalkBaseY - 22 * scale, cx + 6 * scale, stalkBaseY - 8 * scale);
    ctx.stroke();
    // Glowing Lure Bulb with Pulse
    const lureY = stalkBaseY - 6 * scale;
    const lurePulse = 1 + Math.sin(animTime * 6) * 0.25;
    ctx.fillStyle = '#22D3EE';
    ctx.shadowColor = '#5EEAD4';
    ctx.shadowBlur = 12 * scale * lurePulse;
    ctx.beginPath();
    ctx.arc(cx + 6 * scale, lureY, 5 * scale * lurePulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'dr_steampunk_inventor') {
    // Double Brass Magnifying Flight Goggles & Top Hat Rim
    ctx.save();
    const gogY = drawY - radius * 0.45;
    // Leather Goggle Strap
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.95, gogY);
    ctx.lineTo(cx + radius * 0.95, gogY);
    ctx.stroke();
    // Twin Brass Goggle Barrels with Glowing Cyan Lenses
    for (const gx of [cx - eyeOffset, cx + eyeOffset]) {
      ctx.fillStyle = '#B45309';
      ctx.strokeStyle = '#FDE68A';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(gx, gogY, 7.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.shadowColor = '#0284C7';
      ctx.shadowBlur = 6 * scale;
      ctx.beginPath();
      ctx.arc(gx, gogY, 4.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'neon_cyber_kitsune') {
    // Carbon-Fiber Fox Ears with Glowing Pink Interiors & Ceremonial Mask
    ctx.save();
    const earY = drawY - radius * 0.72;
    for (const dir of [-1, 1]) {
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#EC4899';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(cx + dir * 6 * scale, earY);
      ctx.lineTo(cx + dir * 18 * scale, earY - 18 * scale);
      ctx.lineTo(cx + dir * 22 * scale, earY + 2 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Glowing Pink Inner Ear
      ctx.fillStyle = '#EC4899';
      ctx.beginPath();
      ctx.moveTo(cx + dir * 9 * scale, earY - 1 * scale);
      ctx.lineTo(cx + dir * 17 * scale, earY - 13 * scale);
      ctx.lineTo(cx + dir * 19 * scale, earY + 1 * scale);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'cosmic_jester') {
    // Dual Star-Tipped Jester Horns (Violet & Gold Split)
    ctx.save();
    const jY = drawY - radius * 0.7;
    // Left Violet Horn
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 8 * scale, jY);
    ctx.quadraticCurveTo(cx - 24 * scale, jY - 18 * scale, cx - 18 * scale, jY - 4 * scale);
    ctx.stroke();
    // Star Bell Left
    ctx.fillStyle = '#FDE047';
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.arc(cx - 18 * scale, jY - 4 * scale, 3.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Right Gold Horn
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(cx + 8 * scale, jY);
    ctx.quadraticCurveTo(cx + 24 * scale, jY - 18 * scale, cx + 18 * scale, jY - 4 * scale);
    ctx.stroke();
    // Star Bell Right
    ctx.fillStyle = '#A855F7';
    ctx.shadowColor = '#A855F7';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.arc(cx + 18 * scale, jY - 4 * scale, 3.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'cyber_neon') {
    // Cyberpunk Neon Mohawk Fin & Circuit Brow
    ctx.save();
    ctx.fillStyle = '#EC4899';
    ctx.strokeStyle = '#67E8F9';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#EC4899';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 5 * scale, drawY - radius * 0.8);
    ctx.lineTo(cx, drawY - radius * 1.45);
    ctx.lineTo(cx + 5 * scale, drawY - radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'arcade_retro') {
    // Classic Red Ball-Top Arcade Joystick mounted on head
    ctx.save();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius * 0.85);
    ctx.lineTo(cx, drawY - radius * 1.3);
    ctx.stroke();
    ctx.fillStyle = '#EF4444';
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 1.35, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'toxic_ooze') {
    // Biohazard Glass Containment Dome & Glowing Slime Brain
    ctx.save();
    ctx.fillStyle = 'rgba(163, 230, 53, 0.35)';
    ctx.strokeStyle = '#84CC16';
    ctx.lineWidth = 1.8 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.55, radius * 0.78, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'shadow_ninja') {
    // Shinobi Metal Forehead Protector Headband (Hachigane) & Trailing Scarf
    ctx.save();
    const hbY = drawY - radius * 0.58;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(cx - radius * 0.9, hbY, radius * 1.8, 7 * scale);
    ctx.fillStyle = '#94A3B8';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1 * scale;
    ctx.fillRect(cx - 10 * scale, hbY + 1 * scale, 20 * scale, 5 * scale);
    ctx.strokeRect(cx - 10 * scale, hbY + 1 * scale, 20 * scale, 5 * scale);
    ctx.restore();
  } else if (activeSkin === 'neon_dj') {
    // Over-Ear Studio DJ Headphones with Glowing RGB Earcups
    ctx.save();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY, radius * 1.05, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#EC4899';
    ctx.shadowColor = '#EC4899';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.ellipse(cx - radius * 1.05, drawY, 5 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + radius * 1.05, drawY, 5 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'steam_mechanic') {
    // Victorian Brass Top Hat & Dual Aviator Goggles on Forehead
    ctx.save();
    const hatY = drawY - radius * 0.8;
    ctx.fillStyle = '#451A03';
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 1.5 * scale;
    ctx.fillRect(cx - radius * 0.55, hatY - 16 * scale, radius * 1.1, 16 * scale);
    ctx.strokeRect(cx - radius * 0.55, hatY - 16 * scale, radius * 1.1, 16 * scale);
    ctx.beginPath();
    ctx.ellipse(cx, hatY, radius * 1.1, 4.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Brass Goggles on hat band
    ctx.fillStyle = '#38BDF8';
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx - 6 * scale, hatY - 5 * scale, 4.5 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 6 * scale, hatY - 5 * scale, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'inferno_blaze' || activeSkin === 'magma_colossus') {
    // Curved Molten Obsidian Demon/Golem Horns
    ctx.save();
    ctx.fillStyle = '#450A0A';
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 1.8 * scale;
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.55, drawY - radius * 0.65);
    ctx.quadraticCurveTo(cx - radius * 1.25, drawY - radius * 1.1, cx - radius * 0.95, drawY - radius * 1.45);
    ctx.quadraticCurveTo(cx - radius * 0.7, drawY - radius * 0.95, cx - radius * 0.25, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.55, drawY - radius * 0.65);
    ctx.quadraticCurveTo(cx + radius * 1.25, drawY - radius * 1.1, cx + radius * 0.95, drawY - radius * 1.45);
    ctx.quadraticCurveTo(cx + radius * 0.7, drawY - radius * 0.95, cx + radius * 0.25, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'frost_titan') {
    // Jagged Glacial Ice-Spike Crown
    ctx.save();
    ctx.fillStyle = '#BAE6FD';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 8 * scale;
    const baseC = drawY - radius * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.65, baseC);
    ctx.lineTo(cx - radius * 0.45, baseC - 14 * scale);
    ctx.lineTo(cx - radius * 0.2, baseC - 5 * scale);
    ctx.lineTo(cx, baseC - 20 * scale);
    ctx.lineTo(cx + radius * 0.2, baseC - 5 * scale);
    ctx.lineTo(cx + radius * 0.45, baseC - 14 * scale);
    ctx.lineTo(cx + radius * 0.65, baseC);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'mecha_sentinel') {
    // Titanium Mecha V-Crest & Tactical Ear Pods
    ctx.save();
    ctx.fillStyle = '#CBD5E1';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius * 0.7);
    ctx.lineTo(cx - radius * 0.95, drawY - radius * 1.25);
    ctx.lineTo(cx - radius * 0.35, drawY - radius * 0.9);
    ctx.lineTo(cx, drawY - radius * 1.35);
    ctx.lineTo(cx + radius * 0.35, drawY - radius * 0.9);
    ctx.lineTo(cx + radius * 0.95, drawY - radius * 1.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'deep_abyss') {
    // Bioluminescent Anglerfish Lure Stalk & Fin Crest
    ctx.save();
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius * 0.85);
    ctx.quadraticCurveTo(cx, drawY - radius * 1.55, cx + 12 * scale, drawY - radius * 1.2);
    ctx.stroke();
    ctx.fillStyle = '#67E8F9';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.arc(cx + 12 * scale, drawY - radius * 1.2, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'plasma_storm') {
    // Dual Copper Tesla Coil Towers on Head
    ctx.save();
    ctx.fillStyle = '#B45309';
    ctx.strokeStyle = '#67E8F9';
    ctx.lineWidth = 1.5 * scale;
    for (const dir of [-1, 1]) {
      const tx = cx + dir * radius * 0.55;
      const ty = drawY - radius * 1.15;
      ctx.beginPath();
      ctx.arc(tx, ty, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'spectral_phantom') {
    // Floating Ethereal Wisp Crown
    ctx.save();
    ctx.fillStyle = '#E9D5FF';
    ctx.shadowColor = '#C084FC';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.5, drawY - radius * 0.85);
    ctx.quadraticCurveTo(cx, drawY - radius * 1.55 + Math.sin(animTime * 5) * 4 * scale, cx + radius * 0.5, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'valkyrie_aurora') {
    // Winged Golden Valkyrie Diadem
    ctx.save();
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.7, drawY - radius * 0.65);
    ctx.lineTo(cx, drawY - radius * 1.05);
    ctx.lineTo(cx + radius * 0.7, drawY - radius * 0.65);
    ctx.lineTo(cx, drawY - radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'rainbow_aurora') {
    // Prismatic Crystal Tiara
    ctx.save();
    const tCols = ['#EF4444', '#F59E0B', '#10B981', '#38BDF8', '#EC4899'];
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = tCols[i + 2];
      ctx.beginPath();
      ctx.moveTo(cx + i * 6 * scale - 3 * scale, drawY - radius * 0.8);
      ctx.lineTo(cx + i * 6 * scale, drawY - radius * (1.35 - Math.abs(i) * 0.12));
      ctx.lineTo(cx + i * 6 * scale + 3 * scale, drawY - radius * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'galaxy_cosmic' || activeSkin === 'void_stalker' || activeSkin === 'quantum_overlord') {
    // Cosmic Singularity Third-Eye Gem on Forehead
    ctx.save();
    ctx.fillStyle = '#F472B6';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2 * scale;
    ctx.shadowColor = '#C084FC';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius * 0.85);
    ctx.lineTo(cx + 5 * scale, drawY - radius * 0.65);
    ctx.lineTo(cx, drawY - radius * 0.45);
    ctx.lineTo(cx - 5 * scale, drawY - radius * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'hero_avenger') {
    // Heroic Golden Lightning Ear-Wings & Chest Star
    ctx.save();
    ctx.fillStyle = '#FBBF24';
    drawStarSparkle(ctx, cx, drawY + radius * 0.52, 6 * scale);
    ctx.restore();
  } else if (activeSkin === 'cactus_gunslinger') {
    // Western Stetson Cowboy Hat & Gold Sheriff Star
    ctx.save();
    const brimW = radius * 2.4;
    const brimY = drawY - radius * 0.85;
    ctx.fillStyle = '#78350F';
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.7, brimY);
    ctx.lineTo(cx - radius * 0.55, brimY - radius * 0.75);
    ctx.quadraticCurveTo(cx, brimY - radius * 0.95, cx + radius * 0.55, brimY - radius * 0.75);
    ctx.lineTo(cx + radius * 0.7, brimY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Hat Band with gold buckle
    ctx.fillStyle = '#B45309';
    ctx.fillRect(cx - radius * 0.68, brimY - 6 * scale, radius * 1.36, 5 * scale);
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(cx - 3 * scale, brimY - 7 * scale, 6 * scale, 7 * scale);
    // Wide Curved Brim
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.ellipse(cx, brimY, brimW * 0.5, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Sheriff Star on chest
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1 * scale;
    drawStarSparkle(ctx, cx, drawY + radius * 0.55, 6 * scale);
    ctx.restore();
  } else if (activeSkin === 'chef_supreme') {
    // Tall Pleated Chef's Toque Hat
    ctx.save();
    const hatY = drawY - radius * 0.95;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.arc(cx, hatY - 22 * scale, 14 * scale, 0, Math.PI * 2);
    ctx.arc(cx - 16 * scale, hatY - 14 * scale, 12 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 16 * scale, hatY - 14 * scale, 12 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(cx - radius * 0.7, hatY - 8 * scale, radius * 1.4, 10 * scale);
    ctx.strokeRect(cx - radius * 0.7, hatY - 8 * scale, radius * 1.4, 10 * scale);
    ctx.restore();
  } else if (activeSkin === 'disco_king') {
    // Giant 70s Retro Afro & Neon Star Sunglasses
    ctx.save();
    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.7, radius * 1.1, 0, Math.PI * 2);
    ctx.arc(cx - radius * 0.8, drawY - radius * 0.3, radius * 0.7, 0, Math.PI * 2);
    ctx.arc(cx + radius * 0.8, drawY - radius * 0.3, radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Star-shaped Neon Party Sunglasses
    ctx.fillStyle = '#EC4899';
    drawStarSparkle(ctx, cx - eyeOffset, eyeY, 9 * scale);
    drawStarSparkle(ctx, cx + eyeOffset, eyeY, 9 * scale);
    ctx.strokeStyle = '#F472B6';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - eyeOffset + 5 * scale, eyeY);
    ctx.lineTo(cx + eyeOffset - 5 * scale, eyeY);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'knight_templar') {
    // Medieval Crusader Greathelm & Golden Cross Visor
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(cx - radius * 0.8, drawY - radius * 0.8, radius * 1.6, radius * 0.5, 4 * scale)
      : ctx.rect(cx - radius * 0.8, drawY - radius * 0.8, radius * 1.6, radius * 0.5);
    ctx.fill();
    ctx.stroke();
    // Gold Cross Visor Slit
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 18 * scale, eyeY);
    ctx.lineTo(cx + 18 * scale, eyeY);
    ctx.moveTo(cx, eyeY - 8 * scale);
    ctx.lineTo(cx, eyeY + 8 * scale);
    ctx.stroke();
    // Red plume feather on top
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.ellipse(cx, drawY - radius * 1.1, 5 * scale, 12 * scale, Math.PI * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'wizard_archmage') {
    // Pointed Starry Wizard Hat & Arcane Moon Buckle
    ctx.save();
    const hatY = drawY - radius * 0.8;
    ctx.fillStyle = '#4C1D95';
    ctx.strokeStyle = '#C084FC';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.8, hatY);
    ctx.quadraticCurveTo(cx - radius * 0.3, hatY - radius * 1.4, cx + 8 * scale, hatY - radius * 1.8);
    ctx.quadraticCurveTo(cx + radius * 0.4, hatY - radius * 1.1, cx + radius * 0.8, hatY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gold Moon Buckle on Hat
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(cx, hatY - 4 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Wide Hat Brim
    ctx.fillStyle = '#581C87';
    ctx.beginPath();
    ctx.ellipse(cx, hatY, radius * 1.25, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'viking_berserker') {
    // Riveted Iron Horned Helmet
    ctx.save();
    ctx.fillStyle = '#78350F';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.6, drawY - radius * 0.5);
    ctx.quadraticCurveTo(cx - radius * 1.4, drawY - radius * 0.9, cx - radius * 1.3, drawY - radius * 1.3);
    ctx.quadraticCurveTo(cx - radius * 0.8, drawY - radius * 0.8, cx - radius * 0.4, drawY - radius * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.6, drawY - radius * 0.5);
    ctx.quadraticCurveTo(cx + radius * 1.4, drawY - radius * 0.9, cx + radius * 1.3, drawY - radius * 1.3);
    ctx.quadraticCurveTo(cx + radius * 0.8, drawY - radius * 0.8, cx + radius * 0.4, drawY - radius * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'kitsune_fox') {
    // Pointed Fox Ears with Pink Inner Fluff
    ctx.save();
    ctx.fillStyle = '#EA580C';
    ctx.strokeStyle = '#7C2D12';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.7, drawY - radius * 0.4);
    ctx.lineTo(cx - radius * 0.75, drawY - radius * 1.35);
    ctx.lineTo(cx - radius * 0.15, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FBCFE8';
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.62, drawY - radius * 0.5);
    ctx.lineTo(cx - radius * 0.68, drawY - radius * 1.2);
    ctx.lineTo(cx - radius * 0.25, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.7, drawY - radius * 0.4);
    ctx.lineTo(cx + radius * 0.75, drawY - radius * 1.35);
    ctx.lineTo(cx + radius * 0.15, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FBCFE8';
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.62, drawY - radius * 0.5);
    ctx.lineTo(cx + radius * 0.68, drawY - radius * 1.2);
    ctx.lineTo(cx + radius * 0.25, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'alien_invader') {
    // Glass UFO Dome & Glowing Brain & 3 Alien Eyes
    ctx.save();
    ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.6, radius * 0.85, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#34D399';
    const brainPulse = Math.sin(animTime * 5) * 1.5 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.85, 8 * scale + brainPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#064E3B';
    ctx.beginPath();
    ctx.arc(cx, eyeY - 10 * scale, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'astro_bubble') {
    // Reflective Space Helmet Glass Dome & Gold Visor Shine
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY, radius * 1.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - radius * 0.35, drawY - radius * 0.4, radius * 0.5, radius * 0.25, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'samurai_ronin') {
    // Samurai Horned Kabuto Helmet Crest
    ctx.save();
    ctx.fillStyle = '#DC2626';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.8, drawY - radius * 0.4);
    ctx.lineTo(cx - radius * 0.6, drawY - radius * 1.1);
    ctx.lineTo(cx, drawY - radius * 0.9);
    ctx.lineTo(cx + radius * 0.6, drawY - radius * 1.1);
    ctx.lineTo(cx + radius * 0.8, drawY - radius * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 1.1, 10 * scale, Math.PI * 0.8, Math.PI * 2.2);
    ctx.arc(cx, drawY - radius * 1.05, 7 * scale, Math.PI * 2.2, Math.PI * 0.8, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'golden_champion') {
    // Royal Golden Crown (always on for Golden Sovereign)
    ctx.save();
    const crownW = radius * 1.15;
    const crownH = radius * 0.65;
    const crownX = cx - crownW / 2;
    const crownY = drawY - radius * 1.1;
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY + crownH);
    ctx.lineTo(crownX + crownW, crownY + crownH);
    ctx.lineTo(crownX + crownW, crownY + crownH * 0.25);
    ctx.lineTo(crownX + crownW * 0.75, crownY + crownH * 0.55);
    ctx.lineTo(cx, crownY);
    ctx.lineTo(crownX + crownW * 0.25, crownY + crownH * 0.55);
    ctx.lineTo(crownX, crownY + crownH * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'cyber_dragon') {
    // Dual Emerald Dragon Horns & Golden Forehead Crest
    ctx.save();
    ctx.fillStyle = '#059669';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.8 * scale;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 8 * scale;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 6 * scale, drawY - radius * 0.75);
      ctx.quadraticCurveTo(cx + dir * 24 * scale, drawY - radius * 1.5, cx + dir * 18 * scale, drawY - radius * 1.6);
      ctx.quadraticCurveTo(cx + dir * 14 * scale, drawY - radius * 1.1, cx + dir * 2 * scale, drawY - radius * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Golden Forehead Crest
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius * 0.95);
    ctx.lineTo(cx + 5 * scale, drawY - radius * 0.7);
    ctx.lineTo(cx - 5 * scale, drawY - radius * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'cosmic_black_hole') {
    // Floating Event Horizon Crown & Dark Matter Orb
    ctx.save();
    ctx.strokeStyle = '#C084FC';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#A855F7';
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, drawY - radius * 1.1, radius * 0.65, radius * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Central Singularity Orb
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 1.1, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'cyber_valkyrie_prime') {
    // Golden Winged Tiara & Cyan Brow Visor
    ctx.save();
    ctx.fillStyle = '#FDE047';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = 8 * scale;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 6 * scale, drawY - radius * 0.7);
      ctx.lineTo(cx + dir * 22 * scale, drawY - radius * 1.4);
      ctx.lineTo(cx + dir * 14 * scale, drawY - radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'cyber_glitch_oni') {
    // Twin Cyber Oni Horns & Crimson Menpo Fangs
    ctx.save();
    ctx.fillStyle = '#881337';
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#F43F5E';
    ctx.shadowBlur = 10 * scale;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 7 * scale, drawY - radius * 0.7);
      ctx.quadraticCurveTo(cx + dir * 18 * scale, drawY - radius * 1.5, cx + dir * 12 * scale, drawY - radius * 1.6);
      ctx.lineTo(cx + dir * 3 * scale, drawY - radius * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Demonic lower fang plate
    ctx.fillStyle = '#4C0519';
    ctx.fillRect(cx - 10 * scale, drawY + radius * 0.25, 20 * scale, 10 * scale);
    ctx.fillStyle = '#FFFFFF';
    for (let f = -1; f <= 1; f += 2) {
      ctx.beginPath();
      ctx.moveTo(cx + f * 5 * scale, drawY + radius * 0.25);
      ctx.lineTo(cx + f * 7 * scale, drawY + radius * 0.5);
      ctx.lineTo(cx + f * 3 * scale, drawY + radius * 0.25);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'golden_dragon_emperor') {
    // Imperial Antler Horns & Celestial Golden Dragon Crown
    ctx.save();
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 10 * scale;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 6 * scale, drawY - radius * 0.7);
      ctx.lineTo(cx + dir * 20 * scale, drawY - radius * 1.5);
      ctx.lineTo(cx + dir * 26 * scale, drawY - radius * 1.7);
      ctx.lineTo(cx + dir * 16 * scale, drawY - radius * 1.3);
      ctx.lineTo(cx + dir * 4 * scale, drawY - radius * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Pearl Orb
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.85, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'prism_crystal_golem') {
    // Faceted Diamond Crystalline Crown
    ctx.save();
    ctx.fillStyle = '#C084FC';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.8 * scale;
    ctx.shadowColor = '#E879F9';
    ctx.shadowBlur = 10 * scale;
    for (const [dir, hOffset] of [[-1, 0], [0, 6], [1, 0]]) {
      const px = cx + dir * 12 * scale;
      ctx.beginPath();
      ctx.moveTo(px - 5 * scale, drawY - radius * 0.75);
      ctx.lineTo(px, drawY - radius * 1.25 - hOffset * scale);
      ctx.lineTo(px + 5 * scale, drawY - radius * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'deep_sea_abyssal_kraken') {
    // Cephalopod Mantle Hood with 3 Glowing Turquoise Eye Sensors
    ctx.save();
    ctx.fillStyle = '#042F2E';
    ctx.strokeStyle = '#2DD4BF';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#14B8A6';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.5, radius * 0.75, Math.PI, 0);
    ctx.lineTo(cx + radius * 0.75, drawY);
    ctx.lineTo(cx - radius * 0.75, drawY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 3 Cyan Sensors
    ctx.fillStyle = '#22D3EE';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(cx + i * 8 * scale, drawY - radius * 0.85, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'inferno_lava_demon') {
    // Towering Balrog Basalt Horns with Glowing Lava Fissures & Flaming Brimstone Halo
    ctx.save();
    ctx.fillStyle = '#09090B';
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 2.5 * scale;
    ctx.shadowColor = '#FF4500';
    ctx.shadowBlur = 14 * scale;
    // Curved Horns
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 8 * scale, drawY - radius * 0.7);
      ctx.quadraticCurveTo(cx + dir * 30 * scale, drawY - radius * 1.5, cx + dir * 24 * scale, drawY - radius * 1.9);
      ctx.lineTo(cx + dir * 4 * scale, drawY - radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Liquid gold molten crack inside horn
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.moveTo(cx + dir * 7 * scale, drawY - radius * 0.75);
      ctx.quadraticCurveTo(cx + dir * 24 * scale, drawY - radius * 1.45, cx + dir * 20 * scale, drawY - radius * 1.8);
      ctx.stroke();
    }
    // Hovering Flaming Brimstone Halo
    const haloBob = Math.sin(animTime * 6) * 3 * scale;
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#F97316';
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, drawY - (radius * 1.35 + haloBob), 14 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Forehead Blazing Magma Eye Rune
    ctx.fillStyle = '#FF4500';
    ctx.shadowColor = '#FEF08A';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.82, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'retro_synthwave_racer') {
    // Aerodynamic Synthwave Helmet in Deep Purple with Hot-Pink & Cyan Stripes and Polarized Visor
    ctx.save();
    // Midnight Purple Helmet Shell
    ctx.fillStyle = '#16042E';
    ctx.strokeStyle = '#FF007F';
    ctx.lineWidth = 2.2 * scale;
    ctx.shadowColor = '#FF007F';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.45, radius * 0.85, Math.PI, 0);
    ctx.lineTo(cx + radius * 0.85, drawY - radius * 0.15);
    ctx.lineTo(cx - radius * 0.85, drawY - radius * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Twin Neon Racing Stripes (Hot Pink & Electric Cyan)
    ctx.fillStyle = '#00F0FF';
    ctx.fillRect(cx - 5 * scale, drawY - radius * 1.3, 3 * scale, radius * 0.85);
    ctx.fillStyle = '#FF007F';
    ctx.fillRect(cx + 2 * scale, drawY - radius * 1.3, 3 * scale, radius * 0.85);

    // Polarized Audio-Equalizer Face Visor
    const eqGrad = ctx.createLinearGradient(cx - radius * 0.7, drawY, cx + radius * 0.7, drawY);
    eqGrad.addColorStop(0, '#00F0FF');
    eqGrad.addColorStop(0.5, '#EC4899');
    eqGrad.addColorStop(1, '#FFE600');
    ctx.fillStyle = eqGrad;
    ctx.shadowColor = '#00F0FF';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.roundRect(cx - radius * 0.65, drawY - radius * 0.45, radius * 1.3, 10 * scale, 4 * scale);
    ctx.fill();

    // Side Aero Racing Winglets
    for (const dir of [-1, 1]) {
      ctx.fillStyle = '#2E0854';
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.moveTo(cx + dir * radius * 0.85, drawY - radius * 0.4);
      ctx.lineTo(cx + dir * (radius * 1.15), drawY - radius * 0.55);
      ctx.lineTo(cx + dir * radius * 0.85, drawY - radius * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'cyber_stealth_operative') {
    // Matte Carbon-Fiber Hood with Active Hexagonal Mesh & Tri-Ocular Night-Vision
    ctx.save();
    // Stealth Cowl
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1.8 * scale;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.5, radius * 0.85, Math.PI * 0.9, Math.PI * 0.1, true);
    ctx.lineTo(cx + radius * 0.7, drawY + radius * 0.2);
    ctx.lineTo(cx - radius * 0.7, drawY + radius * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tri-Ocular Night-Vision Optic Goggles (Splinter Cell / Ghost In The Shell)
    ctx.fillStyle = '#10B981';
    ctx.shadowColor = '#34D399';
    ctx.shadowBlur = 12 * scale;
    // Center Top Lens
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.55, 3.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Left & Right Lenses
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + dir * 8 * scale, drawY - radius * 0.38, 3.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // Goggle bridge bracket
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 8 * scale, drawY - radius * 0.38);
    ctx.lineTo(cx, drawY - radius * 0.55);
    ctx.lineTo(cx + 8 * scale, drawY - radius * 0.38);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'electric_storm_raijin') {
    // Shinto Horned Thunder Kami Crown with Plasma Lightning Arcs
    ctx.save();
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.2 * scale;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 12 * scale;
    // Dual Jagged Lightning Horns
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 6 * scale, drawY - radius * 0.7);
      ctx.lineTo(cx + dir * 18 * scale, drawY - radius * 1.3);
      ctx.lineTo(cx + dir * 12 * scale, drawY - radius * 1.4);
      ctx.lineTo(cx + dir * 26 * scale, drawY - radius * 1.95);
      ctx.lineTo(cx + dir * 8 * scale, drawY - radius * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Plasma Lightning Arc connecting horn tips
    if (Math.sin(animTime * 14) > 0.1) {
      ctx.strokeStyle = '#BAE6FD';
      ctx.lineWidth = 1.8 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 26 * scale, drawY - radius * 1.95);
      ctx.lineTo(cx + (Math.sin(animTime * 25) * 8) * scale, drawY - radius * 2.1);
      ctx.lineTo(cx + 26 * scale, drawY - radius * 1.95);
      ctx.stroke();
    }
    // Gold Thunderbolt Forehead Emblem
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius * 0.95);
    ctx.lineTo(cx + 4 * scale, drawY - radius * 0.75);
    ctx.lineTo(cx + 1 * scale, drawY - radius * 0.75);
    ctx.lineTo(cx + 3 * scale, drawY - radius * 0.55);
    ctx.lineTo(cx - 3 * scale, drawY - radius * 0.78);
    ctx.lineTo(cx, drawY - radius * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'mecha_dragoon_valkyrie') {
    // Armored Gundam Mecha Helmet with Golden V-Fin & Emerald Optic Sensor
    ctx.save();
    // White Titanium Forehead Plating
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 14 * scale, drawY - radius * 0.6);
    ctx.lineTo(cx + 14 * scale, drawY - radius * 0.6);
    ctx.lineTo(cx + 10 * scale, drawY - radius * 0.95);
    ctx.lineTo(cx - 10 * scale, drawY - radius * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dual Golden V-Fin Antenna Crest
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 1.2 * scale;
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius * 0.9);
    ctx.lineTo(cx - 28 * scale, drawY - radius * 1.8);
    ctx.lineTo(cx - 18 * scale, drawY - radius * 1.6);
    ctx.lineTo(cx, drawY - radius * 1.05);
    ctx.lineTo(cx + 18 * scale, drawY - radius * 1.6);
    ctx.lineTo(cx + 28 * scale, drawY - radius * 1.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red Center Jewel / Sensor Hub
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(cx - 3.5 * scale, drawY - radius * 1.05, 7 * scale, 6 * scale);

    // Cyan Cockpit Eye HUD Visor
    ctx.fillStyle = '#06B6D4';
    ctx.shadowColor = '#22D3EE';
    ctx.shadowBlur = 8 * scale;
    ctx.fillRect(cx - 9 * scale, drawY - radius * 0.45, 18 * scale, 5 * scale);
    ctx.restore();
  } else if (activeSkin === 'frost_valkyrie_queen') {
    // Diamond Frost Tiara with Hovering Sub-Zero Ice Crystal Spires
    ctx.save();
    ctx.fillStyle = 'rgba(224, 242, 254, 0.95)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.8 * scale;
    ctx.shadowColor = '#BAE6FD';
    ctx.shadowBlur = 14 * scale;
    // 5 Crown Spires of varying heights
    const spHeights = [14, 22, 30, 22, 14];
    for (let i = 0; i < 5; i++) {
      const spX = cx + (i - 2) * 6.5 * scale;
      const spH = spHeights[i] * scale;
      ctx.beginPath();
      ctx.moveTo(spX - 3 * scale, drawY - radius * 0.7);
      ctx.lineTo(spX, drawY - radius * 0.7 - spH);
      ctx.lineTo(spX + 3 * scale, drawY - radius * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Arctic Cyan Center Forehead Diamond
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius * 0.9);
    ctx.lineTo(cx + 4 * scale, drawY - radius * 0.75);
    ctx.lineTo(cx, drawY - radius * 0.6);
    ctx.lineTo(cx - 4 * scale, drawY - radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'toxic_cyber_mutant') {
    // Industrial Hazmat Gas Mask with Dual Air Filters & Acid Green Visor
    ctx.save();
    // Mask Body
    ctx.fillStyle = '#1A2E05';
    ctx.strokeStyle = '#84CC16';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY + radius * 0.1, radius * 0.75, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Twin Ribbed Filtration Canisters (Cheeks)
    for (const dir of [-1, 1]) {
      const fx = cx + dir * 16 * scale;
      const fy = drawY + radius * 0.15;
      ctx.fillStyle = '#EAB308';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.arc(fx, fy, 7 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Filter slots
      ctx.fillStyle = '#000000';
      ctx.fillRect(fx - 4 * scale, fy - 1 * scale, 8 * scale, 2 * scale);
    }

    // Glowing Toxic Slime Visor
    ctx.fillStyle = '#84CC16';
    ctx.shadowColor = '#A3E635';
    ctx.shadowBlur = 10 * scale;
    ctx.fillRect(cx - 10 * scale, drawY - radius * 0.45, 20 * scale, 7 * scale);
    ctx.restore();
  } else if (activeSkin === 'steampunk_aeronaut_ace') {
    // Weathered Leather Aviator Cap with Sheepskin Earflaps & Flip-Down Triple Brass Goggles
    ctx.save();
    // Leather Cap
    ctx.fillStyle = '#451A03';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY - radius * 0.45, radius * 0.85, Math.PI, 0);
    ctx.lineTo(cx + radius * 0.85, drawY + radius * 0.35);
    ctx.lineTo(cx + radius * 0.6, drawY + radius * 0.4);
    ctx.lineTo(cx + radius * 0.5, drawY - radius * 0.1);
    ctx.lineTo(cx - radius * 0.5, drawY - radius * 0.1);
    ctx.lineTo(cx - radius * 0.6, drawY + radius * 0.4);
    ctx.lineTo(cx - radius * 0.85, drawY + radius * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Triple Brass Goggles
    for (const [dir, r] of ([[-1, 7], [1, 7], [0, 4]] as [number, number][])) {
      const gx = dir === 0 ? cx : cx + dir * 9 * scale;
      const gy = dir === 0 ? drawY - radius * 0.8 : drawY - radius * 0.45;
      ctx.fillStyle = '#78350F';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(gx, gy, r * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Glowing Amber Optic Lens
      ctx.fillStyle = '#FDE68A';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 6 * scale;
      ctx.beginPath();
      ctx.arc(gx, gy, (r - 2.5) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 9. Custom Cosmetic Skin Auras & Dynamic Visual Signatures
  if (activeSkin === 'golden_champion') {
    for (let i = 0; i < 3; i++) {
      const a = animTime * 2.2 + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(a) * (radius * 1.25);
      const sy = drawY + Math.sin(a) * (radius * 0.65);
      drawStarSparkle(ctx, sx, sy, (4 + Math.sin(animTime * 6 + i) * 1.5) * scale);
    }
  } else if (activeSkin === 'cyber_neon') {
    ctx.save();
    ctx.strokeStyle = '#06B6D4';
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 10 * scale;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY, radius * 1.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'inferno_blaze') {
    for (let i = 0; i < 3; i++) {
      const a = animTime * 3.5 + i * 2.1;
      const ex = cx + Math.cos(a) * (radius * 0.85);
      const ey = drawY - Math.abs(Math.sin(a)) * (radius * 1.1);
      ctx.fillStyle = i % 2 === 0 ? '#F97316' : '#FBBF24';
      ctx.beginPath();
      ctx.arc(ex, ey, (2.5 + Math.sin(animTime * 8 + i) * 1) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (activeSkin === 'frost_titan') {
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.lineWidth = 1.5 * scale;
    for (let i = 0; i < 4; i++) {
      const fa = -Math.PI / 2 + (i - 1.5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(fa) * radius, drawY + Math.sin(fa) * radius);
      ctx.lineTo(cx + Math.cos(fa) * (radius + 6 * scale), drawY + Math.sin(fa) * (radius + 6 * scale));
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'galaxy_cosmic') {
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const a = animTime * 1.2 + i * 1.57;
      const gx = cx + Math.cos(a) * (radius * 1.2);
      const gy = drawY + Math.sin(a) * (radius * 0.7);
      ctx.fillStyle = '#C084FC';
      ctx.beginPath();
      ctx.arc(gx, gy, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'arcade_retro') {
    // Green phosphor CRT scanline aura
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
    ctx.lineWidth = 1.5 * scale;
    ctx.setLineDash([3 * scale, 2 * scale]);
    ctx.strokeRect(cx - radius * 1.1, drawY - radius * 1.1, radius * 2.2, radius * 2.2);
    ctx.restore();
  } else if (activeSkin === 'toxic_ooze') {
    // Rising radioactive acid droplets
    for (let i = 0; i < 3; i++) {
      const ox = cx + Math.cos(animTime * 2 + i * 2) * (radius * 0.9);
      const oy = drawY - ((animTime * 25 + i * 14) % (radius * 1.4));
      ctx.fillStyle = '#A3E635';
      ctx.beginPath();
      ctx.arc(ox, oy, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (activeSkin === 'steam_mechanic') {
    // Rotating brass gear behind mascot
    ctx.save();
    ctx.translate(cx + radius * 0.7, drawY - radius * 0.6);
    ctx.rotate(animTime * 2);
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(0, 0, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 1 * scale;
    for (let i = 0; i < 6; i++) {
      const ga = (i * Math.PI) / 3;
      ctx.strokeRect(Math.cos(ga) * 6 * scale - 1, Math.sin(ga) * 6 * scale - 1, 3 * scale, 3 * scale);
    }
    ctx.restore();
  } else if (activeSkin === 'samurai_ronin' || activeSkin === 'cyber_samurai_ronin') {
    // Floating sakura petals & cyber slash arc
    if (activeSkin === 'cyber_samurai_ronin') {
      ctx.save();
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2 * scale;
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 10 * scale;
      ctx.beginPath();
      ctx.arc(cx, drawY, radius * 1.28, animTime * 3, animTime * 3 + Math.PI * 0.65);
      ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 3; i++) {
      const px = cx + Math.sin(animTime * 1.5 + i * 2.1) * (radius * 1.25);
      const py = drawY - Math.cos(animTime * 1.8 + i) * (radius * 0.8);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(animTime + i);
      ctx.fillStyle = activeSkin === 'cyber_samurai_ronin' && i === 0 ? '#06B6D4' : '#F472B6';
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.5 * scale, 2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (activeSkin === 'space_pirate_corsair') {
    // Orbiting Cyber-Parrot Drone (Obsidian & Hologram Cyan) & Void Dubloons
    ctx.save();
    const droneA = animTime * 2.2;
    const dx = cx + Math.cos(droneA) * (radius * 1.38);
    const dy = drawY - radius * 0.35 + Math.sin(droneA * 2) * (5 * scale);
    ctx.fillStyle = '#7C3AED';
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 1.4 * scale;
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.arc(dx, dy, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Cyber Parrot Beak & Optics
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.moveTo(dx + 4 * scale, dy - 1 * scale);
    ctx.lineTo(dx + 8 * scale, dy + 1 * scale);
    ctx.lineTo(dx + 4 * scale, dy + 3 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.arc(dx + 1.5 * scale, dy - 1 * scale, 1.2 * scale, 0, Math.PI * 2);
    ctx.fill();
    // 2 Orbiting Void Doubloons
    for (let i = 0; i < 2; i++) {
      const va = animTime * 1.8 + i * Math.PI;
      const vx = cx + Math.cos(va) * (radius * 1.25);
      const vy = drawY + Math.sin(va) * (radius * 0.6);
      ctx.fillStyle = '#FBBF24';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 6 * scale;
      ctx.beginPath();
      ctx.ellipse(vx, vy, 3.5 * scale, 2.2 * scale, animTime * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'retro_gameboy_classic') {
    // Floating 8-Bit Pixel Hearts & Chiptune Square Waves
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = animTime * 2 + i * 2.1;
      const px = cx + Math.cos(a) * (radius * 1.32);
      const py = drawY + Math.sin(a) * (radius * 0.65);
      ctx.fillStyle = i % 2 === 0 ? '#84CC16' : '#BE123C';
      ctx.fillRect(px - 2.5 * scale, py - 2.5 * scale, 5 * scale, 5 * scale);
    }
    ctx.restore();
  } else if (activeSkin === 'mecha_kaiju') {
    // Nuclear Cherenkov Atomic Breath Ring & Plasma Sparks
    ctx.save();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 12 * scale;
    const kPulse = 1 + Math.sin(animTime * 6) * 0.08;
    ctx.beginPath();
    ctx.arc(cx, drawY, radius * 1.26 * kPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'pharaoh_anubis') {
    // Orbiting Golden Ankh Hieroglyphs
    ctx.save();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1.6 * scale;
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 8 * scale;
    for (let i = 0; i < 2; i++) {
      const a = animTime * 1.8 + i * Math.PI;
      const ax = cx + Math.cos(a) * (radius * 1.35);
      const ay = drawY + Math.sin(a) * (radius * 0.55);
      ctx.beginPath();
      ctx.arc(ax, ay - 3 * scale, 2.5 * scale, 0, Math.PI * 2);
      ctx.moveTo(ax, ay - 0.5 * scale);
      ctx.lineTo(ax, ay + 5 * scale);
      ctx.moveTo(ax - 3 * scale, ay + 1.5 * scale);
      ctx.lineTo(ax + 3 * scale, ay + 1.5 * scale);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'cyber_netrunner') {
    // Glitching Hologram Hex-Polygons
    ctx.save();
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 1.4 * scale;
    for (let i = 0; i < 3; i++) {
      const a = animTime * 2.5 + i * 2.1;
      const hx = cx + Math.cos(a) * (radius * 1.28);
      const hy = drawY + Math.sin(a) * (radius * 0.65);
      ctx.strokeRect(hx - 3 * scale, hy - 3 * scale, 6 * scale, 6 * scale);
    }
    ctx.restore();
  } else if (activeSkin === 'celestial_seraphim') {
    // Divine Starlight Choir Sparkles
    for (let i = 0; i < 4; i++) {
      const a = animTime * 1.8 + (i * Math.PI) / 2;
      drawStarSparkle(ctx, cx + Math.cos(a) * radius * 1.38, drawY + Math.sin(a) * radius * 0.75, 4 * scale);
    }
  } else if (activeSkin === 'neon_reaper') {
    // Drifting Violet & Cyan Soul-Lantern Wisps
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = animTime * 2.1 + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(a) * (radius * 1.32);
      const sy = drawY + Math.sin(a) * (radius * 0.68);
      ctx.fillStyle = i === 0 ? '#22D3EE' : '#C084FC';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10 * scale;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'chrono_timelord') {
    // Counter-Rotating Golden Time-Dilation Rings
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
    ctx.lineWidth = 1.4 * scale;
    ctx.setLineDash([4 * scale, 3 * scale]);
    ctx.beginPath();
    ctx.arc(cx, drawY, radius * 1.28, animTime, animTime + Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'shogun_mech') {
    // Titan Mech High-Thrust Vernier Thruster Jets & Tactical HUD Brackets
    ctx.save();
    // Dual Cyan/Emerald Thruster Plumes
    const thrusterFlame = (5 + Math.sin(animTime * 18) * 3) * scale;
    ctx.fillStyle = '#06B6D4';
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 12 * scale;
    // Left Thruster Plume
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.75, drawY + radius * 0.7);
    ctx.lineTo(cx - radius * 0.55, drawY + radius * 0.7);
    ctx.lineTo(cx - radius * 0.65, drawY + radius * 0.7 + thrusterFlame);
    ctx.closePath();
    ctx.fill();
    // Right Thruster Plume
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.55, drawY + radius * 0.7);
    ctx.lineTo(cx + radius * 0.75, drawY + radius * 0.7);
    ctx.lineTo(cx + radius * 0.65, drawY + radius * 0.7 + thrusterFlame);
    ctx.closePath();
    ctx.fill();

    // Tactical Target Bracket & Floating Sparks
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1.4 * scale;
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 8 * scale;
    const hudAngle = animTime * 1.5;
    for (let i = 0; i < 4; i++) {
      const a = hudAngle + (i * Math.PI) / 2;
      const hx = cx + Math.cos(a) * (radius * 1.35);
      const hy = drawY + Math.sin(a) * (radius * 0.7);
      ctx.beginPath();
      ctx.arc(hx, hy, 2 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    // High-thrust emerald vernier particles
    for (let i = 0; i < 3; i++) {
      const a = animTime * 3 + i * 2.1;
      const sx = cx + Math.cos(a) * (radius * 1.25);
      const sy = drawY + Math.sin(a) * (radius * 0.55);
      ctx.fillStyle = '#34D399';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'marshmallow_dj') {
    // Pulsing Neon Soundwave Rings
    ctx.save();
    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 1.5 * scale;
    const mR = radius * (1.15 + ((animTime * 1.5) % 0.3));
    ctx.beginPath();
    ctx.arc(cx, drawY, mR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'plague_alchemist') {
    // Orbiting Bubbling Emerald & Violet Elixir Flasks
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const a = animTime * 2 + i * Math.PI;
      const fx = cx + Math.cos(a) * (radius * 1.32);
      const fy = drawY + Math.sin(a) * (radius * 0.6);
      ctx.fillStyle = i === 0 ? '#10B981' : '#A855F7';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.arc(fx, fy, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'supernova_phoenix') {
    // Swirling Solar Flare Embers & Reborn Fire Ring
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const a = animTime * 3.2 + (i * Math.PI) / 2;
      const px = cx + Math.cos(a) * (radius * 1.35);
      const py = drawY + Math.sin(a) * (radius * 0.7);
      ctx.fillStyle = i % 2 === 0 ? '#FEF08A' : '#F97316';
      ctx.shadowColor = '#EA580C';
      ctx.shadowBlur = 8 * scale;
      ctx.beginPath();
      ctx.arc(px, py, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'deep_abyss') {
    // Bioluminescent rising sea bubbles
    for (let i = 0; i < 3; i++) {
      const bx = cx + Math.sin(animTime * 2.5 + i * 2) * (radius * 0.85);
      const by = drawY - ((animTime * 30 + i * 16) % (radius * 1.5));
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.arc(bx, by, 3 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (activeSkin === 'plasma_storm') {
    // Crackling lightning arcs
    ctx.save();
    ctx.strokeStyle = '#67E8F9';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 8 * scale;
    const lAngle = animTime * 4;
    const lx1 = cx + Math.cos(lAngle) * (radius * 1.15);
    const ly1 = drawY + Math.sin(lAngle) * (radius * 1.15);
    const lx2 = cx + Math.cos(lAngle + 0.4) * (radius * 1.25);
    const ly2 = drawY + Math.sin(lAngle + 0.4) * (radius * 1.25);
    ctx.beginPath();
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx1 + (Math.random() - 0.5) * 6 * scale, ly1 - 8 * scale);
    ctx.lineTo(lx2, ly2);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'spectral_phantom') {
    // Ethereal translucent ghost halo
    ctx.save();
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.65)';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#C084FC';
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, drawY, radius * 1.2, radius * 1.3 + Math.sin(animTime * 4) * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'rainbow_aurora') {
    // Prismatic iridescent rainbow ring
    ctx.save();
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EC4899'];
    for (let i = 0; i < 6; i++) {
      const ra = animTime * 2 + (i * Math.PI) / 3;
      const rx = cx + Math.cos(ra) * (radius * 1.25);
      const ry = drawY + Math.sin(ra) * (radius * 0.7);
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(rx, ry, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'quantum_overlord') {
    // Warping quantum orbital rings
    ctx.save();
    ctx.strokeStyle = '#818CF8';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, drawY, radius * 1.35, radius * 0.55, animTime * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#C084FC';
    ctx.beginPath();
    ctx.ellipse(cx, drawY, radius * 1.35, radius * 0.55, -animTime * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'neon_dj') {
    // Pulsing audio equalizer bars on left and right
    ctx.save();
    ctx.fillStyle = '#06B6D4';
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 6 * scale;
    const barW = 2.5 * scale;
    const barGap = 3.5 * scale;
    for (let i = 0; i < 3; i++) {
      const h1 = (4 + Math.sin(animTime * 10 + i * 1.5) * 3 + 3) * scale;
      const h2 = (4 + Math.cos(animTime * 8 + i * 1.2) * 3 + 3) * scale;
      // Left equalizer
      ctx.fillRect(cx - radius * 1.3 - (2 - i) * barGap, drawY + radius * 0.2 - h1 / 2, barW, h1);
      // Right equalizer
      ctx.fillStyle = '#EC4899';
      ctx.fillRect(cx + radius * 1.3 + i * barGap - barW, drawY + radius * 0.2 - h2 / 2, barW, h2);
    }
    ctx.restore();
  } else if (activeSkin === 'mecha_sentinel') {
    // Tactical laser targeting reticle and tracking brackets
    ctx.save();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 1.2 * scale;
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 8 * scale;
    const reticleR = radius * 1.3;
    const rot = animTime * 1.5;
    ctx.beginPath();
    ctx.arc(cx, drawY, reticleR, rot, rot + Math.PI * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, drawY, reticleR, rot + Math.PI, rot + Math.PI * 1.5);
    ctx.stroke();
    // Center laser point
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(animTime * 3) * 6 * scale, drawY + Math.sin(animTime * 3) * 4 * scale, 1.8 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'magma_colossus') {
    // Erupting molten embers and lava geysers
    for (let i = 0; i < 4; i++) {
      const a = animTime * 2.5 + i * 1.6;
      const mx = cx + Math.sin(a) * (radius * 0.95);
      const my = drawY - ((animTime * 35 + i * 20) % (radius * 1.6));
      ctx.fillStyle = i % 2 === 0 ? '#EF4444' : '#F97316';
      ctx.shadowColor = '#EA580C';
      ctx.shadowBlur = 6 * scale;
      ctx.beginPath();
      ctx.arc(mx, my, (2 + Math.sin(animTime * 6 + i) * 1) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (activeSkin === 'valkyrie_aurora') {
    // Golden celestial wings arching behind mascot
    ctx.save();
    ctx.strokeStyle = '#FDE047';
    ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 10 * scale;
    const wingFlap = Math.sin(animTime * 4) * (4 * scale);
    // Left Wing
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.6, drawY);
    ctx.quadraticCurveTo(cx - radius * 1.5, drawY - radius * 0.9 - wingFlap, cx - radius * 1.6, drawY - radius * 0.2);
    ctx.quadraticCurveTo(cx - radius * 1.2, drawY + radius * 0.4, cx - radius * 0.6, drawY + radius * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right Wing
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.6, drawY);
    ctx.quadraticCurveTo(cx + radius * 1.5, drawY - radius * 0.9 - wingFlap, cx + radius * 1.6, drawY - radius * 0.2);
    ctx.quadraticCurveTo(cx + radius * 1.2, drawY + radius * 0.4, cx + radius * 0.6, drawY + radius * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Floating starlight feather
    const fx = cx + Math.sin(animTime * 2) * (radius * 1.2);
    const fy = drawY - Math.cos(animTime * 2) * (radius * 0.8);
    drawStarSparkle(ctx, fx, fy, 3.5 * scale);
    ctx.restore();
  } else if (activeSkin === 'cyber_dragon') {
    // Emerald draconic horns and jade spirit flames
    ctx.save();
    ctx.fillStyle = '#10B981';
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 1.2 * scale;
    ctx.shadowColor = '#059669';
    ctx.shadowBlur = 8 * scale;
    // Left Dragon Horn
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.5, drawY - radius * 0.7);
    ctx.quadraticCurveTo(cx - radius * 0.9, drawY - radius * 1.2, cx - radius * 0.7, drawY - radius * 1.4);
    ctx.quadraticCurveTo(cx - radius * 0.5, drawY - radius * 1.0, cx - radius * 0.2, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right Dragon Horn
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.5, drawY - radius * 0.7);
    ctx.quadraticCurveTo(cx + radius * 0.9, drawY - radius * 1.2, cx + radius * 0.7, drawY - radius * 1.4);
    ctx.quadraticCurveTo(cx + radius * 0.5, drawY - radius * 1.0, cx + radius * 0.2, drawY - radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 3 Orbiting Jade Spirit Flames
    for (let i = 0; i < 3; i++) {
      const ja = animTime * 2.8 + (i * Math.PI * 2) / 3;
      const jx = cx + Math.cos(ja) * (radius * 1.25);
      const jy = drawY + Math.sin(ja) * (radius * 0.65);
      ctx.fillStyle = '#34D399';
      ctx.beginPath();
      ctx.arc(jx, jy, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'void_stalker') {
    // Dark matter gravitational singularity and pulsing event horizon
    ctx.save();
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#7C3AED';
    ctx.shadowBlur = 12 * scale;
    const vPulse = 1 + Math.sin(animTime * 5) * 0.15;
    ctx.beginPath();
    ctx.ellipse(cx, drawY, radius * 1.35 * vPulse, radius * 0.45 * vPulse, animTime * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#F43F5E';
    ctx.beginPath();
    ctx.ellipse(cx, drawY, radius * 1.35 * vPulse, radius * 0.45 * vPulse, -animTime * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    // Inward graviton particles
    for (let i = 0; i < 4; i++) {
      const gPhase = (animTime * 1.5 + i * 0.25) % 1;
      const gDist = (1 - gPhase) * radius * 1.4;
      const ga = animTime * 2 + (i * Math.PI) / 2;
      const gx = cx + Math.cos(ga) * gDist;
      const gy = drawY + Math.sin(ga) * (gDist * 0.5);
      ctx.fillStyle = '#C4B5FD';
      ctx.beginPath();
      ctx.arc(gx, gy, 1.8 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'alien_invader') {
    // Green tractor beam pulse & hovering scout probe
    ctx.save();
    const beamPulse = 0.25 + Math.sin(animTime * 4) * 0.1;
    ctx.fillStyle = `rgba(34, 197, 94, ${beamPulse})`;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.7, drawY + radius * 0.5);
    ctx.lineTo(cx - radius * 1.3, drawY + radius * 1.5);
    ctx.lineTo(cx + radius * 1.3, drawY + radius * 1.5);
    ctx.lineTo(cx + radius * 0.7, drawY + radius * 0.5);
    ctx.closePath();
    ctx.fill();

    // Hovering mini scout probe
    const probeA = animTime * 2;
    const px = cx + Math.cos(probeA) * (radius * 1.35);
    const py = drawY - radius * 0.8 + Math.sin(probeA * 1.5) * 4 * scale;
    ctx.fillStyle = '#86EFAC';
    ctx.beginPath();
    ctx.ellipse(px, py, 4 * scale, 2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(px, py - 1.5 * scale, 1.8 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (activeSkin === 'cactus_gunslinger') {
    // Orbiting tumbleweed dust and golden revolver sparks
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = animTime * 2.2 + i * 2.1;
      const sx = cx + Math.cos(a) * (radius * 1.25);
      const sy = drawY + Math.sin(a) * (radius * 0.6);
      ctx.fillStyle = '#F59E0B';
      ctx.shadowColor = '#D97706';
      ctx.shadowBlur = 6 * scale;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'chef_supreme') {
    // Rising aromatic culinary steam spirals
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5 * scale;
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 12 * scale;
      const syOffset = ((animTime * 20 + i * 15) % (radius * 1.4));
      const sy = drawY - radius * 0.9 - syOffset;
      const sway = Math.sin(animTime * 3 + i) * 4 * scale;
      ctx.beginPath();
      ctx.arc(sx + sway, sy, 3 * scale, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'disco_king') {
    // Rotating 70s dancefloor spotlights and mirrorball sparkles
    ctx.save();
    const colors = ['#EC4899', '#8B5CF6', '#06B6D4', '#EAB308'];
    for (let i = 0; i < 4; i++) {
      const angle = animTime * 1.8 + (i * Math.PI) / 2;
      const sx = cx + Math.cos(angle) * (radius * 1.3);
      const sy = drawY + Math.sin(angle) * (radius * 0.7);
      ctx.fillStyle = colors[i];
      ctx.shadowColor = colors[i];
      ctx.shadowBlur = 8 * scale;
      drawStarSparkle(ctx, sx, sy, 3.5 * scale);
    }
    ctx.restore();
  } else if (activeSkin === 'knight_templar') {
    // Holy radiant sunburst aura & cross glint
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 10 * scale;
    for (let i = 0; i < 8; i++) {
      const rayA = animTime * 0.8 + (i * Math.PI) / 4;
      const r1 = radius * 1.15;
      const r2 = radius * 1.35 + Math.sin(animTime * 4 + i) * 3 * scale;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rayA) * r1, drawY + Math.sin(rayA) * r1);
      ctx.lineTo(cx + Math.cos(rayA) * r2, drawY + Math.sin(rayA) * r2);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'hero_avenger') {
    // Heroic plasma sparks and crackling lightning
    ctx.save();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.8 * scale;
    ctx.shadowColor = '#0284C7';
    ctx.shadowBlur = 10 * scale;
    const lAngle = animTime * 5;
    const lx1 = cx + Math.cos(lAngle) * (radius * 1.15);
    const ly1 = drawY + Math.sin(lAngle) * (radius * 1.15);
    ctx.beginPath();
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx1 + Math.sin(animTime * 8) * 6 * scale, ly1 - 10 * scale);
    ctx.stroke();
    drawStarSparkle(ctx, cx, drawY - radius * 1.3, 4 * scale);
    ctx.restore();
  } else if (activeSkin === 'wizard_archmage') {
    // Mystic arcane runes orbiting mascot
    ctx.save();
    ctx.fillStyle = '#C084FC';
    ctx.shadowColor = '#9333EA';
    ctx.shadowBlur = 10 * scale;
    for (let i = 0; i < 4; i++) {
      const ra = animTime * 1.6 + (i * Math.PI * 2) / 4;
      const rx = cx + Math.cos(ra) * (radius * 1.3);
      const ry = drawY + Math.sin(ra) * (radius * 0.7);
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(animTime * 2 + i);
      ctx.fillRect(-2 * scale, -2 * scale, 4 * scale, 4 * scale);
      ctx.restore();
    }
    ctx.restore();
  } else if (activeSkin === 'pirate_captain') {
    // Cannon smoke puffs and drifting gold dubloon glints
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const pa = animTime * 1.8 + i * 2.1;
      const px = cx + Math.cos(pa) * (radius * 1.2);
      const py = drawY + Math.sin(pa) * (radius * 0.55);
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(px, py, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'viking_berserker') {
    // Raging crimson fury sparks & frost shards
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const a = animTime * 3.5 + i * 1.7;
      const fx = cx + Math.cos(a) * (radius * 1.1);
      const fy = drawY - ((animTime * 30 + i * 18) % (radius * 1.5));
      ctx.fillStyle = i % 2 === 0 ? '#EF4444' : '#38BDF8';
      ctx.shadowColor = '#DC2626';
      ctx.shadowBlur = 6 * scale;
      ctx.beginPath();
      ctx.arc(fx, fy, 2.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'kitsune_fox') {
    // 3 Orbiting ethereal turquoise Foxfire spirit wisps
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const fa = animTime * 2.5 + (i * Math.PI * 2) / 3;
      const fx = cx + Math.cos(fa) * (radius * 1.3);
      const fy = drawY + Math.sin(fa) * (radius * 0.7);
      ctx.fillStyle = '#67E8F9';
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 12 * scale;
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'astro_bubble') {
    // Orbiting rainbow stardust bubbles & telemetry ring
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, drawY, radius * 1.4, radius * 0.6, animTime * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const ba = -animTime * 2 + (i * Math.PI * 2) / 3;
      const bx = cx + Math.cos(ba) * (radius * 1.4);
      const by = drawY + Math.sin(ba) * (radius * 0.6);
      ctx.fillStyle = 'rgba(224, 242, 254, 0.8)';
      ctx.beginPath();
      ctx.arc(bx, by, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'glitch_cyber_phantom') {
    // Glitching Hologram Wireframe Nodes & Matrix Hex Sparks
    ctx.save();
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 1.4 * scale;
    ctx.shadowColor = '#EC4899';
    ctx.shadowBlur = 10 * scale;
    for (let i = 0; i < 4; i++) {
      const a = animTime * 3 + (i * Math.PI) / 2;
      const hx = cx + Math.cos(a) * (radius * 1.32);
      const hy = drawY + Math.sin(a) * (radius * 0.7);
      ctx.strokeRect(hx - 3 * scale, hy - 3 * scale, 6 * scale, 6 * scale);
      // Scanline glitch burst
      if ((Math.floor(animTime * 10) + i) % 3 === 0) {
        ctx.fillStyle = '#EC4899';
        ctx.fillRect(hx - 6 * scale, hy - 0.75 * scale, 12 * scale, 1.5 * scale);
      }
    }
    ctx.restore();
  } else if (activeSkin === 'solar_eclipse_knight') {
    // Radiant Umbral Solar Eclipse Corona & Coronal Flare Prominences
    ctx.save();
    const coronaPulse = 1 + Math.sin(animTime * 5) * 0.08;
    const coronaR = radius * 1.25 * coronaPulse;
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 14 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY, coronaR, 0, Math.PI * 2);
    ctx.stroke();

    // 6 Coronal Prominence Rays
    for (let i = 0; i < 6; i++) {
      const rayA = animTime * 1.2 + (i * Math.PI) / 3;
      const rInner = coronaR;
      const rOuter = coronaR + (6 + Math.sin(animTime * 8 + i * 2) * 5) * scale;
      ctx.strokeStyle = i % 2 === 0 ? '#FEF08A' : '#F97316';
      ctx.lineWidth = 1.6 * scale;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rayA) * rInner, drawY + Math.sin(rayA) * rInner);
      ctx.lineTo(cx + Math.cos(rayA) * rOuter, drawY + Math.sin(rayA) * rOuter);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'deep_angler_leviathan') {
    // Bioluminescent Abyssal Lure Beacon & Rising Deep Ocean Bubbles
    ctx.save();
    // Glowing Angler Lure Stalk at crown
    const lureA = animTime * 2;
    const lx = cx + Math.sin(lureA) * (6 * scale);
    const ly = drawY - radius * 1.35 + Math.cos(lureA * 1.5) * (3 * scale);
    ctx.fillStyle = '#38BDF8';
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 14 * scale;
    ctx.beginPath();
    ctx.arc(lx, ly, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(lx, ly, 2 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Rising Deep Ocean Bubbles
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.2 * scale;
    for (let i = 0; i < 3; i++) {
      const bx = cx + Math.sin(animTime * 2.2 + i * 1.8) * (radius * 0.9);
      const by = drawY - ((animTime * 28 + i * 18) % (radius * 1.6));
      ctx.beginPath();
      ctx.arc(bx, by, (2.2 + (i % 2)) * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'dr_steampunk_inventor') {
    // Venting Brass Steam Jets & Counter-Rotating Clockwork Cogs
    ctx.save();
    // Dual Steam Puffs
    for (const sx of [cx - radius * 0.9, cx + radius * 0.9]) {
      const puffY = drawY - radius * 0.4 - ((animTime * 30 + sx) % (radius * 0.8));
      ctx.fillStyle = 'rgba(241, 245, 249, 0.45)';
      ctx.beginPath();
      ctx.arc(sx + Math.sin(animTime * 4) * 3 * scale, puffY, 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // Orbiting Brass Clockwork Cogs
    for (let i = 0; i < 2; i++) {
      const ga = animTime * 1.6 + i * Math.PI;
      const gx = cx + Math.cos(ga) * (radius * 1.32);
      const gy = drawY + Math.sin(ga) * (radius * 0.6);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(animTime * (i === 0 ? 3 : -3));
      ctx.fillStyle = '#D97706';
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  } else if (activeSkin === 'neon_cyber_kitsune') {
    // 3 Orbiting Neon Cyber Foxfire Spirit Wisps with Glitch Trails
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const fa = animTime * 2.6 + (i * Math.PI * 2) / 3;
      const fx = cx + Math.cos(fa) * (radius * 1.34);
      const fy = drawY + Math.sin(fa) * (radius * 0.7);
      ctx.fillStyle = i % 2 === 0 ? '#EC4899' : '#06B6D4';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12 * scale;
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.4 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'cosmic_jester') {
    // Orbiting Planetary Void Marbles & Twinkling Diamond Star Sparkles
    ctx.save();
    const marbleColors = ['#A855F7', '#F59E0B', '#EC4899'];
    for (let i = 0; i < 3; i++) {
      const ma = animTime * 2.4 + (i * Math.PI * 2) / 3;
      const mx = cx + Math.cos(ma) * (radius * 1.36);
      const my = drawY + Math.sin(ma) * (radius * 0.65);
      ctx.fillStyle = marbleColors[i];
      ctx.shadowColor = marbleColors[i];
      ctx.shadowBlur = 8 * scale;
      ctx.beginPath();
      ctx.arc(mx, my, 3.2 * scale, 0, Math.PI * 2);
      ctx.fill();
      // Orbiting ring around marble
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.8 * scale;
      ctx.beginPath();
      ctx.ellipse(mx, my, 4.5 * scale, 1.8 * scale, animTime * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawStarSparkle(ctx, cx + Math.sin(animTime * 3) * (radius * 1.1), drawY - radius * 1.1, 4 * scale);
    ctx.restore();
  } else if (activeSkin === 'shadow_ninja') {
    // Crimson Shadow Smoke & Dark Shinobi Mist Wisps
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const sa = animTime * 2.2 + (i * Math.PI) / 2;
      const sx = cx + Math.cos(sa) * (radius * 1.25);
      const sy = drawY + Math.sin(sa) * (radius * 0.65);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.shadowColor = '#DC2626';
      ctx.shadowBlur = 10 * scale;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'cosmic_black_hole') {
    // Spacetime Distortion Orbit Rings & Dark Matter Singularity Motes
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const oa = animTime * 2.5 + (i * Math.PI * 2) / 3;
      const ox = cx + Math.cos(oa) * (radius * 1.4);
      const oy = drawY + Math.sin(oa) * (radius * 0.7);
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 1.2 * scale;
      ctx.shadowColor = '#A855F7';
      ctx.shadowBlur = 12 * scale;
      ctx.beginPath();
      ctx.arc(ox, oy, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'cyber_valkyrie_prime') {
    // Radiant Starlight Beams & Drifting Holographic Valkyrie Feathers
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const va = animTime * 2.4 + (i * Math.PI * 2) / 3;
      const vx = cx + Math.cos(va) * (radius * 1.35);
      const vy = drawY + Math.sin(va) * (radius * 0.65);
      drawStarSparkle(ctx, vx, vy, 4 * scale);
    }
    ctx.restore();
  } else if (activeSkin === 'cyber_glitch_oni') {
    // Crackling Crimson & Magenta Digitized Glitch Hex Nodes
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const ga = animTime * 4.5 + (i * Math.PI) / 2;
      const gx = cx + Math.cos(ga) * (radius * 1.3 + Math.sin(animTime * 12 + i) * 4 * scale);
      const gy = drawY + Math.sin(ga) * (radius * 0.65);
      ctx.fillStyle = i % 2 === 0 ? '#F43F5E' : '#EC4899';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10 * scale;
      ctx.fillRect(gx - 2.5 * scale, gy - 2.5 * scale, 5 * scale, 5 * scale);
    }
    ctx.restore();
  } else if (activeSkin === 'golden_dragon_emperor') {
    // Orbiting Golden Dragon Pearl & Draconic Flame Wisps
    ctx.save();
    const pa = animTime * 2.8;
    const px = cx + Math.cos(pa) * (radius * 1.4);
    const py = drawY + Math.sin(pa) * (radius * 0.7);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    ctx.arc(px, py, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawStarSparkle(ctx, px, py, 3 * scale);
    ctx.restore();
  } else if (activeSkin === 'prism_crystal_golem') {
    // Prismatic Light Refraction Spectrum Rainbow Glints
    ctx.save();
    const prismCols = ['#F43F5E', '#FBBF24', '#34D399', '#38BDF8', '#A855F7'];
    for (let i = 0; i < 5; i++) {
      const ca = animTime * 2.2 + (i * Math.PI * 2) / 5;
      const cxPos = cx + Math.cos(ca) * (radius * 1.35);
      const cyPos = drawY + Math.sin(ca) * (radius * 0.65);
      ctx.fillStyle = prismCols[i];
      ctx.shadowColor = prismCols[i];
      ctx.shadowBlur = 8 * scale;
      ctx.beginPath();
      ctx.arc(cxPos, cyPos, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'deep_sea_abyssal_kraken') {
    // Bioluminescent Ocean Bubbles & Siphon Wave Pulses
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const ba = animTime * 2.0 + (i * Math.PI) / 2;
      const bx = cx + Math.cos(ba) * (radius * 1.3);
      const by = drawY + Math.sin(ba) * (radius * 0.65);
      ctx.strokeStyle = '#2DD4BF';
      ctx.lineWidth = 1.4 * scale;
      ctx.shadowColor = '#14B8A6';
      ctx.shadowBlur = 8 * scale;
      ctx.beginPath();
      ctx.arc(bx, by, 3.5 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  } else if (activeSkin === 'inferno_lava_demon') {
    // Blazing Volcanic Hellfire Embers, Ground Fissures & Sulfur Plumes
    ctx.save();
    // Swirling Molten Fire Embers
    for (let i = 0; i < 6; i++) {
      const ea = animTime * 3.5 + (i * Math.PI * 2) / 6;
      const ex = cx + Math.cos(ea) * (radius * 1.35);
      const ey = drawY + Math.sin(ea) * (radius * 0.7);
      ctx.fillStyle = i % 2 === 0 ? '#FF4500' : '#FEF08A';
      ctx.shadowColor = '#F97316';
      ctx.shadowBlur = 12 * scale;
      ctx.beginPath();
      ctx.arc(ex, ey, (2.5 + (i % 2)) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // Ground Lava Crack Flare underneath
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 1.8 * scale;
    ctx.shadowColor = '#FF4500';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, drawY + radius * 1.15, radius * 0.9, radius * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (activeSkin === 'retro_synthwave_racer') {
    // 80s Cyberspace Neon Grid Ground Decal & Supersonic Nitrous Sparks
    ctx.save();
    // Perspective Neon Grid Ring underneath
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.45)';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.ellipse(cx, drawY + radius * 1.15, radius * 1.1, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Moving Grid Cross-Hatch Lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 8 * scale, drawY + radius * 0.9);
      ctx.lineTo(cx + i * 14 * scale, drawY + radius * 1.4);
      ctx.stroke();
    }
    // Orbiting Magenta & Cyan Digital Synth Stars
    for (const [dir, col] of ([[-1, '#00F0FF'], [1, '#FF007F']] as [number, string][])) {
      const sa = animTime * 4 + dir * 1.5;
      const sx = cx + Math.cos(sa) * (radius * 1.35);
      const sy = drawY + Math.sin(sa) * (radius * 0.65);
      ctx.fillStyle = col as string;
      ctx.shadowColor = col as string;
      ctx.shadowBlur = 12 * scale;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'cyber_stealth_operative') {
    // Flickering Active-Camo Hexagonal Shield Grid & Matrix Scan Particles
    ctx.save();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
    ctx.lineWidth = 1.2 * scale;
    ctx.shadowColor = '#34D399';
    ctx.shadowBlur = 8 * scale;
    // Hexagonal Active-Camo Shell
    const hexR = radius * 1.25;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      const hx = cx + Math.cos(a + animTime * 0.5) * hexR;
      const hy = drawY + Math.sin(a + animTime * 0.5) * (hexR * 0.85);
      if (a === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
    // Floating Matrix Hexagon Particles
    for (let i = 0; i < 4; i++) {
      const ha = animTime * 2.2 + (i * Math.PI) / 2;
      const hx = cx + Math.cos(ha) * (radius * 1.35);
      const hy = drawY + Math.sin(ha) * (radius * 0.7);
      ctx.fillStyle = '#10B981';
      ctx.fillRect(hx - 2 * scale, hy - 2 * scale, 4 * scale, 4 * scale);
    }
    ctx.restore();
  } else if (activeSkin === 'electric_storm_raijin') {
    // Orbiting Ball-Lightning Orbs with Sudden Plasma Discharges
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const la = animTime * 4.5 + (i * Math.PI * 2) / 3;
      const lx = cx + Math.cos(la) * (radius * 1.4);
      const ly = drawY + Math.sin(la) * (radius * 0.75);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 14 * scale;
      ctx.beginPath();
      ctx.arc(lx, ly, 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      // Forked discharge to center
      if (Math.sin(animTime * 15 + i) > 0.4) {
        ctx.strokeStyle = '#BAE6FD';
        ctx.lineWidth = 1.2 * scale;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo((lx + cx) / 2 + Math.sin(animTime * 30) * 6 * scale, (ly + drawY) / 2);
        ctx.lineTo(cx, drawY);
        ctx.stroke();
      }
    }
    ctx.restore();
  } else if (activeSkin === 'mecha_dragoon_valkyrie') {
    // Photonic GN-Particle Dust Plumes & Radiant Jet Wake
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const pa = animTime * 3 + (i * Math.PI * 2) / 6;
      const px = cx + Math.cos(pa) * (radius * 1.3);
      const py = drawY + Math.sin(pa) * (radius * 0.75);
      ctx.fillStyle = i % 2 === 0 ? '#818CF8' : '#38BDF8';
      ctx.shadowColor = '#6366F1';
      ctx.shadowBlur = 10 * scale;
      ctx.beginPath();
      ctx.arc(px, py, (2 + Math.sin(animTime * 8 + i)) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'frost_valkyrie_queen') {
    // Swirling Perpetual Sub-Zero Blizzard Vortex & Glacial Snowflakes
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 10 * scale;
    for (let i = 0; i < 6; i++) {
      const sa = -animTime * 3.5 + (i * Math.PI * 2) / 6;
      const sx = cx + Math.cos(sa) * (radius * 1.35);
      const sy = drawY + Math.sin(sa) * (radius * 0.75);
      // Diamond snowflake
      ctx.beginPath();
      ctx.moveTo(sx, sy - 3 * scale);
      ctx.lineTo(sx + 2.5 * scale, sy);
      ctx.lineTo(sx, sy + 3 * scale);
      ctx.lineTo(sx - 2.5 * scale, sy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'toxic_cyber_mutant') {
    // Bubbling Radioactive Acid Drops & Biohazard Vapor Wisps
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const ba = animTime * 2.8 + (i * Math.PI * 2) / 5;
      const bx = cx + Math.cos(ba) * (radius * 1.25);
      const by = drawY + Math.sin(ba) * (radius * 0.65) - Math.abs(Math.sin(animTime * 5 + i)) * 8 * scale;
      ctx.fillStyle = '#84CC16';
      ctx.shadowColor = '#A3E635';
      ctx.shadowBlur = 10 * scale;
      ctx.beginPath();
      ctx.arc(bx, by, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (activeSkin === 'steampunk_aeronaut_ace') {
    // Venting White Steam Clouds & Tiny Spinning Brass Clockwork Cogs
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const sa = animTime * 2 + (i * Math.PI * 2) / 4;
      const sx = cx + Math.cos(sa) * (radius * 1.3);
      const sy = drawY + Math.sin(sa) * (radius * 0.65);
      // Steam puff
      ctx.fillStyle = 'rgba(254, 243, 199, 0.45)';
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      // Mini brass gear
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(sx, sy, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 10. Equipped Booster Visual Signatures (In-Game Active Feedback)
  const equippedBooster = EconomyManager.getInstance().getEquippedBooster(playerId);
  if (equippedBooster === 'booster_shield') {
    // Aegis Kinetic Barrier: Shimmering cyan forcefield bubble with rotating energy nodes
    ctx.save();
    const shieldPulse = 1 + Math.sin(animTime * 4) * 0.05;
    const shieldR = radius * 1.32 * shieldPulse;
    
    // Outer forcefield glow ring
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
    ctx.lineWidth = Math.max(1.5, 2.5 * scale);
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    ctx.arc(cx, drawY, shieldR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner translucent energy dome
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.beginPath();
    ctx.arc(cx, drawY, shieldR, 0, Math.PI * 2);
    ctx.fill();

    // 3 Orbiting Aegis shield node satellites
    for (let i = 0; i < 3; i++) {
      const sa = animTime * 3 + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(sa) * shieldR;
      const sy = drawY + Math.sin(sa) * shieldR;
      ctx.fillStyle = '#22D3EE';
      ctx.shadowColor = '#67E8F9';
      ctx.shadowBlur = 8 * scale;
      ctx.beginPath();
      ctx.arc(sx, sy, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (equippedBooster === 'booster_turbo') {
    // Turbo Overdrive Engine: Twin blue/cyan plasma rocket thrusters flaring from back
    ctx.save();
    const flameH = (8 + Math.sin(animTime * 20) * 4) * scale;
    const leftNozzleX = cx - radius * 0.45;
    const rightNozzleX = cx + radius * 0.45;
    const nozzleY = drawY + radius * 0.75;

    // Left Thruster Flame
    const leftGrad = ctx.createLinearGradient(leftNozzleX, nozzleY, leftNozzleX, nozzleY + flameH);
    leftGrad.addColorStop(0, '#FFFFFF');
    leftGrad.addColorStop(0.3, '#38BDF8');
    leftGrad.addColorStop(0.8, '#0284C7');
    leftGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = leftGrad;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(leftNozzleX - 4 * scale, nozzleY);
    ctx.lineTo(leftNozzleX, nozzleY + flameH);
    ctx.lineTo(leftNozzleX + 4 * scale, nozzleY);
    ctx.closePath();
    ctx.fill();

    // Right Thruster Flame
    const rightGrad = ctx.createLinearGradient(rightNozzleX, nozzleY, rightNozzleX, nozzleY + flameH);
    rightGrad.addColorStop(0, '#FFFFFF');
    rightGrad.addColorStop(0.3, '#38BDF8');
    rightGrad.addColorStop(0.8, '#0284C7');
    rightGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = rightGrad;
    ctx.beginPath();
    ctx.moveTo(rightNozzleX - 4 * scale, nozzleY);
    ctx.lineTo(rightNozzleX, nozzleY + flameH);
    ctx.lineTo(rightNozzleX + 4 * scale, nozzleY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (equippedBooster === 'booster_time') {
    // Chrono Stabilizer: Subtle ticking golden gear tick aura
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 1.2 * scale;
    ctx.setLineDash([4 * scale, 4 * scale]);
    ctx.beginPath();
    ctx.arc(cx, drawY, radius * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    // Ticking needle
    const handA = animTime * 4;
    ctx.beginPath();
    ctx.moveTo(cx, drawY - radius * 1.15);
    ctx.lineTo(cx + Math.cos(handA) * 6 * scale, drawY - radius * 1.15 + Math.sin(handA) * 6 * scale);
    ctx.stroke();
    ctx.restore();
  } else if (equippedBooster === 'booster_double_coins') {
    // Midas Coin Multiplier: Gold sparkles orbiting mascot
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const ca = animTime * 2 + i * Math.PI;
      const cxPos = cx + Math.cos(ca) * (radius * 1.25);
      const cyPos = drawY + Math.sin(ca) * (radius * 0.6);
      drawStarSparkle(ctx, cxPos, cyPos, 3 * scale);
    }
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draws a glittering 4-point star sparkle.
 */
function drawStarSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = '#FDE047';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y);
  ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
