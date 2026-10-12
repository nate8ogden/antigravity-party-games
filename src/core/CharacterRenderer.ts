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

  // 2. Player-Specific Headgear / Silhouette Accents (Behind Head)
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

    // Gleaming Star Sparkle
    const sparkleSize = (5 + Math.sin(animTime * 10) * 2) * scale;
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
  } else if (activeSkin === 'samurai_ronin') {
    // Floating sakura petals
    for (let i = 0; i < 3; i++) {
      const px = cx + Math.sin(animTime * 1.5 + i * 2.1) * (radius * 1.2);
      const py = drawY - Math.cos(animTime * 1.8 + i) * (radius * 0.8);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(animTime + i);
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.5 * scale, 2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
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
