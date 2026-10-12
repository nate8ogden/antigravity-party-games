import { MinigameId } from './Types';

/**
 * Procedural Art Renderer for Minigame Thumbnails and Hero Artwork.
 * Produces crisp, vibrant, customized full-art illustrations for all 16 minigames.
 */
const thumbnailCache = new Map<string, HTMLCanvasElement>();

export function clearThumbnailCache(): void {
  thumbnailCache.clear();
}

export function renderGameThumbnailArt(
  ctx: CanvasRenderingContext2D,
  gameId: MinigameId,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const rw = Math.max(1, Math.round(w));
  const rh = Math.max(1, Math.round(h));
  // 2x Retina supersampling for crystal-clear render quality
  const scale = 2;
  const sw = rw * scale;
  const sh = rh * scale;
  const cacheKey = `${gameId}_${sw}x${sh}`;
  let cached = thumbnailCache.get(cacheKey);

  if (!cached) {
    cached = document.createElement('canvas');
    cached.width = sw;
    cached.height = sh;
    const offCtx = cached.getContext('2d');
    if (offCtx) {
      offCtx.scale(scale, scale);
      drawThumbnailDirect(offCtx, gameId, 0, 0, rw, rh);
    }
    thumbnailCache.set(cacheKey, cached);
  }

  ctx.drawImage(cached, Math.round(x), Math.round(y), rw, rh);
}

function parseColorToRgb(color: string): [number, number, number] {
  if (!color || typeof color !== 'string') return [15, 23, 42];
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    if (!isNaN(num) && hex.length === 6) {
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  } else if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      return [parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10)];
    }
  }
  return [15, 23, 42];
}

function adjustColorRgb(rgb: [number, number, number], factor: number): string {
  const r = Math.min(255, Math.max(0, Math.round(rgb[0] * factor)));
  const g = Math.min(255, Math.max(0, Math.round(rgb[1] * factor)));
  const b = Math.min(255, Math.max(0, Math.round(rgb[2] * factor)));
  return `rgb(${r}, ${g}, ${b})`;
}

function adjustColorRgba(rgb: [number, number, number], factor: number, alpha: number): string {
  const r = Math.min(255, Math.max(0, Math.round(rgb[0] * factor)));
  const g = Math.min(255, Math.max(0, Math.round(rgb[1] * factor)));
  const b = Math.min(255, Math.max(0, Math.round(rgb[2] * factor)));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawEnhancedAtmosphericBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  baseColor: string,
  gameId: string
) {
  const rgb = parseColorToRgb(baseColor);
  const topColor = adjustColorRgb(rgb, 1.45);
  const midColor = adjustColorRgb(rgb, 1.0);
  const botColor = adjustColorRgb(rgb, 0.45);

  // Multi-stop atmospheric vertical gradient
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, topColor);
  bgGrad.addColorStop(0.35, midColor);
  bgGrad.addColorStop(1, botColor);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // Radial ambient centerpiece spotlight behind main subjects
  const cx = x + w * 0.5;
  const cy = y + h * 0.46;
  const glowRad = Math.max(w, h) * 0.72;
  const spotGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, glowRad);
  spotGrad.addColorStop(0, adjustColorRgba(rgb, 1.85, 0.35));
  spotGrad.addColorStop(0.45, adjustColorRgba(rgb, 1.3, 0.15));
  spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spotGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, glowRad, 0, Math.PI * 2);
  ctx.fill();

  // Thematic ambient environmental details based on deterministic hash
  let hash = 0;
  for (let i = 0; i < gameId.length; i++) {
    hash = ((hash << 5) - hash + gameId.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(hash);

  const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;

  if (brightness < 110 || rgb[2] > rgb[0] + 15) {
    // Cyber / Space / Night ambiance: soft glowing stars & horizon line
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let s = 0; s < 12; s++) {
      const sx = x + (((seed * (s + 1) * 31) % Math.round(w - 14)) + 7);
      const sy = y + (((seed * (s + 1) * 67) % Math.round(h * 0.62)) + 6);
      const sz = s % 4 === 0 ? 1.8 : 1.0;
      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    // Horizon glow line
    const horizonY = y + h * 0.72;
    const horizGrad = ctx.createLinearGradient(x, horizonY, x + w, horizonY);
    horizGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    horizGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
    horizGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.strokeStyle = horizGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, horizonY);
    ctx.lineTo(x + w, horizonY);
    ctx.stroke();
  } else {
    // Warm / Earth / Action ambiance: warm horizon glow
    const horizonY = y + h * 0.75;
    const horizGrad = ctx.createLinearGradient(x, horizonY, x + w, horizonY);
    horizGrad.addColorStop(0, 'rgba(254, 240, 138, 0)');
    horizGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.28)');
    horizGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.strokeStyle = horizGrad;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, horizonY);
    ctx.lineTo(x + w, horizonY);
    ctx.stroke();
  }
}

function drawThumbnailDirect(
  ctx: CanvasRenderingContext2D,
  gameId: MinigameId,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, 10);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.clip();

  // Smart Backdrop Interceptor:
  // Converts flat single-color fillRects into luminous, multi-stop atmospheric gradients
  const originalFillRect = ctx.fillRect;
  let bgApplied = false;

  ctx.fillRect = function (fx: number, fy: number, fw: number, fh: number) {
    if (!bgApplied && Math.abs(fx - x) < 2 && Math.abs(fy - y) < 2 && Math.abs(fw - w) < 4 && Math.abs(fh - h) < 4) {
      bgApplied = true;
      if (typeof ctx.fillStyle === 'string') {
        drawEnhancedAtmosphericBackground(ctx, x, y, w, h, ctx.fillStyle, gameId);
        return;
      }
    }
    originalFillRect.call(ctx, fx, fy, fw, fh);
  };

  switch (gameId) {
    case 'tanks':
      drawTanksArt(ctx, x, y, w, h);
      break;
    case 'hovercraft':
      drawHovercraftArt(ctx, x, y, w, h);
      break;
    case 'laser_grid':
      drawLaserGridArt(ctx, x, y, w, h);
      break;
    case 'orbital':
      drawOrbitalArt(ctx, x, y, w, h);
      break;
    case 'micro_gp':
      drawMicroGpArt(ctx, x, y, w, h);
      break;
    case 'ghost_flashlight':
      drawGhostFlashlightArt(ctx, x, y, w, h);
      break;
    case 'kitchen_chaos':
      drawKitchenChaosArt(ctx, x, y, w, h);
      break;
    case 'skyline_sumo':
      drawSkylineSumoArt(ctx, x, y, w, h);
      break;
    case 'animal_stack':
      drawAnimalStackArt(ctx, x, y, w, h);
      break;
    case 'sumo_iceberg':
      drawSumoIcebergArt(ctx, x, y, w, h);
      break;
    case 'cannon_barrage':
      drawCannonBarrageArt(ctx, x, y, w, h);
      break;
    case 'anvil_rain':
      drawAnvilRainArt(ctx, x, y, w, h);
      break;
    case 'bomb_relay':
      drawBombRelayArt(ctx, x, y, w, h);
      break;
    case 'micro_hockey':
      drawMicroHockeyArt(ctx, x, y, w, h);
      break;
    case 'quick_draw':
      drawQuickDrawArt(ctx, x, y, w, h);
      break;
    case 'balloon_burst':
      drawBalloonBurstArt(ctx, x, y, w, h);
      break;
    case 'swat_fly':
      drawSwatFlyArt(ctx, x, y, w, h);
      break;
    case 'stop_at_zero':
      drawStopAtZeroArt(ctx, x, y, w, h);
      break;
    case 'turf_whack':
      drawTurfWhackArt(ctx, x, y, w, h);
      break;
    case 'neon_lightcycles':
      drawNeonLightcyclesArt(ctx, x, y, w, h);
      break;
    case 'blade_parry':
      drawBladeParryArt(ctx, x, y, w, h);
      break;
    case 'safe_dial':
      drawSafeDialArt(ctx, x, y, w, h);
      break;
    case 'coin_apex':
      drawCoinApexArt(ctx, x, y, w, h);
      break;
    case 'red_light_sentry':
      drawRedLightSentryArt(ctx, x, y, w, h);
      break;
    case 'laser_leap':
      drawLaserLeapArt(ctx, x, y, w, h);
      break;
    case 'color_clash':
      drawColorClashArt(ctx, x, y, w, h);
      break;
    case 'meteor_shield':
      drawMeteorShieldArt(ctx, x, y, w, h);
      break;
    case 'sequence_clash':
      drawSequenceClashArt(ctx, x, y, w, h);
      break;
    case 'bubble_soccer':
      drawBubbleSoccerArt(ctx, x, y, w, h);
      break;
    case 'wire_cutter':
      drawWireCutterArt(ctx, x, y, w, h);
      break;
    case 'magma_hop':
      drawMagmaHopArt(ctx, x, y, w, h);
      break;
    case 'rhythm_duel':
      drawRhythmDuelArt(ctx, x, y, w, h);
      break;
    case 'cosmic_vortex':
      drawCosmicVortexArt(ctx, x, y, w, h);
      break;
    case 'pixel_paintball':
      drawPixelPaintballArt(ctx, x, y, w, h);
      break;
    case 'minefield_dash':
      drawMinefieldDashArt(ctx, x, y, w, h);
      break;
    case 'asteroid_miner':
      drawAsteroidMinerArt(ctx, x, y, w, h);
      break;
    case 'dont_look_down':
      drawDontLookDownArt(ctx, x, y, w, h);
      break;
    case 'snowball_fight':
      drawSnowballFightArt(ctx, x, y, w, h);
      break;
    case 'highway_hop':
      drawHighwayHopArt(ctx, x, y, w, h);
      break;
    case 'gold_miner':
      drawGoldMinerArt(ctx, x, y, w, h);
      break;
    case 'chomp_frogs':
      drawChompFrogsArt(ctx, x, y, w, h);
      break;
    case 'tug_of_war':
      drawTugOfWarArt(ctx, x, y, w, h);
      break;
    case 'volley_spike':
      drawVolleySpikeArt(ctx, x, y, w, h);
      break;
    case 'maze_escape':
      drawMazeEscapeArt(ctx, x, y, w, h);
      break;
    case 'pinball_battle':
      drawPinballBattleArt(ctx, x, y, w, h);
      break;
    case 'mole_panic':
      drawMolePanicArt(ctx, x, y, w, h);
      break;
    case 'color_flood':
      drawColorFloodArt(ctx, x, y, w, h);
      break;
    case 'memory_matrix':
      drawMemoryMatrixArt(ctx, x, y, w, h);
      break;
    case 'snake_arena':
      drawSnakeArenaArt(ctx, x, y, w, h);
      break;
    case 'mirror_laser':
      drawMirrorLaserArt(ctx, x, y, w, h);
      break;
    case 'domino_cascade':
      drawDominoCascadeArt(ctx, x, y, w, h);
      break;
    case 'water_balloon':
      drawWaterBalloonArt(ctx, x, y, w, h);
      break;
    case 'sheep_dog':
      drawSheepDogArt(ctx, x, y, w, h);
      break;
    case 'chest_snatch':
      drawChestSnatchArt(ctx, x, y, w, h);
      break;
    case 'rapid_drop4':
      drawRapidDrop4Art(ctx, x, y, w, h);
      break;
    case 'floor_painter':
      drawFloorPainterArt(ctx, x, y, w, h);
      break;
    case 'dodgeball_blitz':
      drawDodgeballBlitzArt(ctx, x, y, w, h);
      break;
    case 'gravity_golf':
      drawGravityGolfArt(ctx, x, y, w, h);
      break;
    case 'cyber_disc':
      drawCyberDiscArt(ctx, x, y, w, h);
      break;
    case 'sumo_spheres':
      drawSumoSpheresArt(ctx, x, y, w, h);
      break;
    case 'sky_gliders':
      drawSkyGlidersArt(ctx, x, y, w, h);
      break;
    case 'whack_a_thief':
      drawWhackAThiefArt(ctx, x, y, w, h);
      break;
    case 'pixel_curling':
      drawPixelCurlingArt(ctx, x, y, w, h);
      break;
    case 'bumper_boats':
      drawBumperBoatsArt(ctx, x, y, w, h);
      break;
    case 'target_sniper':
      drawTargetSniperArt(ctx, x, y, w, h);
      break;
    case 'fruit_chopper':
      drawFruitChopperArt(ctx, x, y, w, h);
      break;
    case 'catapult_clash':
      drawCatapultClashArt(ctx, x, y, w, h);
      break;
    case 'jousting_knights':
      drawJoustingKnightsArt(ctx, x, y, w, h);
      break;
    case 'dragon_tamer':
      drawDragonTamerArt(ctx, x, y, w, h);
      break;
    case 'castle_archer':
      drawCastleArcherArt(ctx, x, y, w, h);
      break;
    case 'drawbridge_panic':
      drawDrawbridgePanicArt(ctx, x, y, w, h);
      break;
    case 'blacksmith_forge':
      drawBlacksmithForgeArt(ctx, x, y, w, h);
      break;
    case 'potion_alchemist':
      drawPotionAlchemistArt(ctx, x, y, w, h);
      break;
    case 'royal_feast':
      drawRoyalFeastArt(ctx, x, y, w, h);
      break;
    case 'sword_in_stone':
      drawSwordInStoneArt(ctx, x, y, w, h);
      break;
    case 'dungeon_escape':
      drawDungeonEscapeArt(ctx, x, y, w, h);
      break;
    case 'neon_drifters':
      drawNeonDriftersArt(ctx, x, y, w, h);
      break;
    case 'hoverboard_rail':
      drawHoverboardRailArt(ctx, x, y, w, h);
      break;
    case 'traffic_jam':
      drawTrafficJamArt(ctx, x, y, w, h);
      break;
    case 'nitro_kart':
      drawNitroKartArt(ctx, x, y, w, h);
      break;
    case 'monorail_hijack':
      drawMonorailHijackArt(ctx, x, y, w, h);
      break;
    case 'drone_delivery':
      drawDroneDeliveryArt(ctx, x, y, w, h);
      break;
    case 'rocket_skates':
      drawRocketSkatesArt(ctx, x, y, w, h);
      break;
    case 'cyber_demolition':
      drawCyberDemolitionArt(ctx, x, y, w, h);
      break;
    case 'laser_speedway':
      drawLaserSpeedwayArt(ctx, x, y, w, h);
      break;
    case 'gravity_pods':
      drawGravityPodsArt(ctx, x, y, w, h);
      break;
    case 'pancake_flipper':
      drawPancakeFlipperArt(ctx, x, y, w, h);
      break;
    case 'sushi_express':
      drawSushiExpressArt(ctx, x, y, w, h);
      break;
    case 'pizza_toss':
      drawPizzaTossArt(ctx, x, y, w, h);
      break;
    case 'burger_stack':
      drawBurgerStackArt(ctx, x, y, w, h);
      break;
    case 'ice_cream_scoop':
      drawIceCreamScoopArt(ctx, x, y, w, h);
      break;
    case 'wok_stir_fry':
      drawWokStirFryArt(ctx, x, y, w, h);
      break;
    case 'donut_glazer':
      drawDonutGlazerArt(ctx, x, y, w, h);
      break;
    case 'fruit_blender':
      drawFruitBlenderArt(ctx, x, y, w, h);
      break;
    case 'teppanyaki_catch':
      drawTeppanyakiCatchArt(ctx, x, y, w, h);
      break;
    case 'popcorn_popper':
      drawPopcornPopperArt(ctx, x, y, w, h);
      break;
    case 'submarine_torpedo':
      drawSubmarineTorpedoArt(ctx, x, y, w, h);
      break;
    case 'jellyfish_jump':
      drawJellyfishJumpArt(ctx, x, y, w, h);
      break;
    case 'pearl_divers':
      drawPearlDiversArt(ctx, x, y, w, h);
      break;
    case 'shark_bait':
      drawSharkBaitArt(ctx, x, y, w, h);
      break;
    case 'sunken_treasure':
      drawSunkenTreasureArt(ctx, x, y, w, h);
      break;
    case 'octopus_ink':
      drawOctopusInkArt(ctx, x, y, w, h);
      break;
    case 'crab_walk':
      drawCrabWalkArt(ctx, x, y, w, h);
      break;
    case 'electric_eel':
      drawElectricEelArt(ctx, x, y, w, h);
      break;
    case 'water_scooter':
      drawWaterScooterArt(ctx, x, y, w, h);
      break;
    case 'deep_sea_harpoon':
      drawDeepSeaHarpoonArt(ctx, x, y, w, h);
      break;
    case 'moon_lander':
      drawMoonLanderArt(ctx, x, y, w, h);
      break;
    case 'space_junk_salvage':
      drawSpaceJunkSalvageArt(ctx, x, y, w, h);
      break;
    case 'alien_probe':
      drawAlienProbeArt(ctx, x, y, w, h);
      break;
    case 'solar_flare':
      drawSolarFlareArt(ctx, x, y, w, h);
      break;
    case 'wormhole_leap':
      drawWormholeLeapArt(ctx, x, y, w, h);
      break;
    case 'astro_miner':
      drawAstroMinerArt(ctx, x, y, w, h);
      break;
    case 'nebula_drift':
      drawNebulaDriftArt(ctx, x, y, w, h);
      break;
    case 'satellite_laser':
      drawSatelliteLaserArt(ctx, x, y, w, h);
      break;
    case 'mars_rover':
      drawMarsRoverArt(ctx, x, y, w, h);
      break;
    case 'zero_g_tether':
      drawZeroGTetherArt(ctx, x, y, w, h);
      break;
    case 'saloon_brawler':
      drawSaloonBrawlerArt(ctx, x, y, w, h);
      break;
    case 'train_heist':
      drawTrainHeistArt(ctx, x, y, w, h);
      break;
    case 'gold_panning':
      drawGoldPanningArt(ctx, x, y, w, h);
      break;
    case 'rodeo_bull':
      drawRodeoBullArt(ctx, x, y, w, h);
      break;
    case 'horseshoe_toss':
      drawHorseshoeTossArt(ctx, x, y, w, h);
      break;
    case 'dynamite_tumble':
      drawDynamiteTumbleArt(ctx, x, y, w, h);
      break;
    case 'cactus_slalom':
      drawCactusSlalomArt(ctx, x, y, w, h);
      break;
    case 'bandit_chase':
      drawBanditChaseArt(ctx, x, y, w, h);
      break;
    case 'rattlesnake_reflex':
      drawRattlesnakeReflexArt(ctx, x, y, w, h);
      break;
    case 'western_poker':
      drawWesternPokerArt(ctx, x, y, w, h);
      break;
    case 'laser_tripwire':
      drawLaserTripwireArt(ctx, x, y, w, h);
      break;
    case 'vault_safe':
      drawVaultSafeArt(ctx, x, y, w, h);
      break;
    case 'security_camera':
      drawSecurityCameraArt(ctx, x, y, w, h);
      break;
    case 'briefcase_snatch':
      drawBriefcaseSnatchArt(ctx, x, y, w, h);
      break;
    case 'hack_terminal':
      drawHackTerminalArt(ctx, x, y, w, h);
      break;
    case 'smoke_bomb_escape':
      drawSmokeBombEscapeArt(ctx, x, y, w, h);
      break;
    case 'micro_wiretap':
      drawMicroWiretapArt(ctx, x, y, w, h);
      break;
    case 'rooftop_zipline':
      drawRooftopZiplineArt(ctx, x, y, w, h);
      break;
    case 'drone_intercept':
      drawDroneInterceptArt(ctx, x, y, w, h);
      break;
    case 'disguise_shuffle':
      drawDisguiseShuffleArt(ctx, x, y, w, h);
      break;
    case 'synthwave_highway':
      drawSynthwaveHighwayArt(ctx, x, y, w, h);
      break;
    case 'drum_solo':
      drawDrumSoloArt(ctx, x, y, w, h);
      break;
    case 'turntable_scratch':
      drawTurntableScratchArt(ctx, x, y, w, h);
      break;
    case 'bass_drop':
      drawBassDropArt(ctx, x, y, w, h);
      break;
    case 'vocal_pitch':
      drawVocalPitchArt(ctx, x, y, w, h);
      break;
    case 'breakdance_battle':
      drawBreakdanceBattleArt(ctx, x, y, w, h);
      break;
    case 'neon_metronome':
      drawNeonMetronomeArt(ctx, x, y, w, h);
      break;
    case 'equalizer_bounce':
      drawEqualizerBounceArt(ctx, x, y, w, h);
      break;
    case 'retro_chiptune':
      drawRetroChiptuneArt(ctx, x, y, w, h);
      break;
    case 'disco_tile':
      drawDiscoTileArt(ctx, x, y, w, h);
      break;
    case 'ring_toss':
      drawRingTossArt(ctx, x, y, w, h);
      break;
    case 'rollercoaster_thrill':
      drawRollercoasterThrillArt(ctx, x, y, w, h);
      break;
    case 'balloon_dart':
      drawBalloonDartArt(ctx, x, y, w, h);
      break;
    case 'dunk_tank':
      drawDunkTankArt(ctx, x, y, w, h);
      break;
    case 'ferris_wheel':
      drawFerrisWheelArt(ctx, x, y, w, h);
      break;
    case 'funhouse_mirrors':
      drawFunhouseMirrorsArt(ctx, x, y, w, h);
      break;
    case 'cotton_candy':
      drawCottonCandyArt(ctx, x, y, w, h);
      break;
    case 'test_strength':
      drawTestStrengthArt(ctx, x, y, w, h);
      break;
    case 'haunted_mansion':
      drawHauntedMansionArt(ctx, x, y, w, h);
      break;
    case 'fireworks_finale':
      drawFireworksFinaleArt(ctx, x, y, w, h);
      break;
    case 'hydra_slayer':
      drawHydraSlayerArt(ctx, x, y, w, h);
      break;
    case 'pharaoh_tomb':
      drawPharaohTombArt(ctx, x, y, w, h);
      break;
    case 'spartan_shield':
      drawSpartanShieldArt(ctx, x, y, w, h);
      break;
    case 'kraken_whirlpool':
      drawKrakenWhirlpoolArt(ctx, x, y, w, h);
      break;
    case 'icarus_wings':
      drawIcarusWingsArt(ctx, x, y, w, h);
      break;
    case 'minotaur_labyrinth':
      drawMinotaurLabyrinthArt(ctx, x, y, w, h);
      break;
    case 'olympus_lightning':
      drawOlympusLightningArt(ctx, x, y, w, h);
      break;
    case 'anubis_scales':
      drawAnubisScalesArt(ctx, x, y, w, h);
      break;
    case 'gorgon_gaze':
      drawGorgonGazeArt(ctx, x, y, w, h);
      break;
    case 'viking_longship':
      drawVikingLongshipArt(ctx, x, y, w, h);
      break;
    case 'antimatter_containment':
      drawAntimatterContainmentArt(ctx, x, y, w, h);
      break;
    case 'warp_gate_jump':
      drawWarpGateJumpArt(ctx, x, y, w, h);
      break;
    case 'solar_sail_rider':
      drawSolarSailRiderArt(ctx, x, y, w, h);
      break;
    case 'planetary_rover':
      drawPlanetaryRoverArt(ctx, x, y, w, h);
      break;
    case 'pulsar_signal':
      drawPulsarSignalArt(ctx, x, y, w, h);
      break;
    case 'asteroid_catcher':
      drawAsteroidCatcherArt(ctx, x, y, w, h);
      break;
    case 'alien_abduction':
      drawAlienAbductionArt(ctx, x, y, w, h);
      break;
    case 'space_elevator':
      drawSpaceElevatorArt(ctx, x, y, w, h);
      break;
    case 'orbital_drop_pod':
      drawOrbitalDropPodArt(ctx, x, y, w, h);
      break;
    case 'dyson_sphere_collector':
      drawDysonSphereCollectorArt(ctx, x, y, w, h);
      break;
    case 'penguin_slide':
      drawPenguinSlideArt(ctx, x, y, w, h);
      break;
    case 'iceberg_breaker':
      drawIcebergBreakerArt(ctx, x, y, w, h);
      break;
    case 'blizzard_beacon':
      drawBlizzardBeaconArt(ctx, x, y, w, h);
      break;
    case 'walrus_bask':
      drawWalrusBaskArt(ctx, x, y, w, h);
      break;
    case 'polar_ice_fishing':
      drawPolarIceFishingArt(ctx, x, y, w, h);
      break;
    case 'aurora_collector':
      drawAuroraCollectorArt(ctx, x, y, w, h);
      break;
    case 'dog_sled_dash':
      drawDogSledDashArt(ctx, x, y, w, h);
      break;
    case 'mammoth_stampede':
      drawMammothStampedeArt(ctx, x, y, w, h);
      break;
    case 'frostbite_cavern':
      drawFrostbiteCavernArt(ctx, x, y, w, h);
      break;
    case 'geyser_leap':
      drawGeyserLeapArt(ctx, x, y, w, h);
      break;
    case 'clockwork_cogs':
      drawClockworkCogsArt(ctx, x, y, w, h);
      break;
    case 'steam_boiler_relief':
      drawSteamBoilerReliefArt(ctx, x, y, w, h);
      break;
    case 'zeppelin_dogfight':
      drawZeppelinDogfightArt(ctx, x, y, w, h);
      break;
    case 'tesla_coil_arc':
      drawTeslaCoilArcArt(ctx, x, y, w, h);
      break;
    case 'automator_assembly':
      drawAutomatorAssemblyArt(ctx, x, y, w, h);
      break;
    case 'pneumatic_tube_rush':
      drawPneumaticTubeRushArt(ctx, x, y, w, h);
      break;
    case 'ornithopter_flock':
      drawOrnithopterFlockArt(ctx, x, y, w, h);
      break;
    case 'pressure_gauge_lock':
      drawPressureGaugeLockArt(ctx, x, y, w, h);
      break;
    case 'copper_conduit':
      drawCopperConduitArt(ctx, x, y, w, h);
      break;
    case 'monocycle_derby':
      drawMonocycleDerbyArt(ctx, x, y, w, h);
      break;
    case 'cyber_samurai_slash':
      drawCyberSamuraiSlashArt(ctx, x, y, w, h);
      break;
    case 'mainframe_breach':
      drawMainframeBreachArt(ctx, x, y, w, h);
      break;
    case 'hovercar_skyline':
      drawHovercarSkylineArt(ctx, x, y, w, h);
      break;
    case 'hologram_glitch':
      drawHologramGlitchArt(ctx, x, y, w, h);
      break;
    case 'laser_grapple':
      drawLaserGrappleArt(ctx, x, y, w, h);
      break;
    case 'neural_synapse':
      drawNeuralSynapseArt(ctx, x, y, w, h);
      break;
    case 'drone_swarm_defense':
      drawDroneSwarmDefenseArt(ctx, x, y, w, h);
      break;
    case 'synth_keytar_solo':
      drawSynthKeytarSoloArt(ctx, x, y, w, h);
      break;
    case 'quantum_tunneling':
      drawQuantumTunnelingArt(ctx, x, y, w, h);
      break;
    case 'hyperloop_racer':
      drawHyperloopRacerArt(ctx, x, y, w, h);
      break;
    case 'ring_toss_frenzy':
      drawRingTossFrenzyArt(ctx, x, y, w, h);
      break;
    case 'balloon_dart_clown':
      drawBalloonDartClownArt(ctx, x, y, w, h);
      break;
    case 'duck_pond_derby':
      drawDuckPondDerbyArt(ctx, x, y, w, h);
      break;
    case 'milk_bottle_knockdown':
      drawMilkBottleKnockdownArt(ctx, x, y, w, h);
      break;
    case 'bumper_car_derby':
      drawBumperCarDerbyArt(ctx, x, y, w, h);
      break;
    case 'cotton_candy_spin':
      drawCottonCandySpinArt(ctx, x, y, w, h);
      break;
    case 'roller_coaster_brake':
      drawRollerCoasterBrakeArt(ctx, x, y, w, h);
      break;
    case 'ferris_wheel_hop':
      drawFerrisWheelHopArt(ctx, x, y, w, h);
      break;
    case 'dunk_clown_tank':
      drawDunkClownTankArt(ctx, x, y, w, h);
      break;
    case 'fortune_teller_tarot':
      drawFortuneTellerTarotArt(ctx, x, y, w, h);
      break;
    case 'vine_swing_canopy':
      drawVineSwingCanopyArt(ctx, x, y, w, h);
      break;
    case 'trex_egg_scramble':
      drawTrexEggScrambleArt(ctx, x, y, w, h);
      break;
    case 'piranha_river_hop':
      drawPiranhaRiverHopArt(ctx, x, y, w, h);
      break;
    case 'pterodactyl_glide':
      drawPterodactylGlideArt(ctx, x, y, w, h);
      break;
    case 'quicksand_escape':
      drawQuicksandEscapeArt(ctx, x, y, w, h);
      break;
    case 'blowpipe_target':
      drawBlowpipeTargetArt(ctx, x, y, w, h);
      break;
    case 'amber_fossil_excavate':
      drawAmberFossilExcavateArt(ctx, x, y, w, h);
      break;
    case 'raptor_pounce_dodge':
      drawRaptorPounceDodgeArt(ctx, x, y, w, h);
      break;
    case 'bamboo_pole_vault':
      drawBambooPoleVaultArt(ctx, x, y, w, h);
      break;
    case 'volcano_lava_leap':
      drawVolcanoLavaLeapArt(ctx, x, y, w, h);
      break;
    case 'caterpillar_inchworm':
      drawCaterpillarInchwormArt(ctx, x, y, w, h);
      break;
    case 'honeybee_nectar_relay':
      drawHoneybeeNectarRelayArt(ctx, x, y, w, h);
      break;
    case 'spider_web_tangle':
      drawSpiderWebTangleArt(ctx, x, y, w, h);
      break;
    case 'ant_colony_haul':
      drawAntColonyHaulArt(ctx, x, y, w, h);
      break;
    case 'firefly_night_beacon':
      drawFireflyNightBeaconArt(ctx, x, y, w, h);
      break;
    case 'dung_beetle_roll':
      drawDungBeetleRollArt(ctx, x, y, w, h);
      break;
    case 'ladybug_aphid_hunt':
      drawLadybugAphidHuntArt(ctx, x, y, w, h);
      break;
    case 'grasshopper_high_jump':
      drawGrasshopperHighJumpArt(ctx, x, y, w, h);
      break;
    case 'dragonfly_dogfight':
      drawDragonflyDogfightArt(ctx, x, y, w, h);
      break;
    case 'centipede_slalom':
      drawCentipedeSlalomArt(ctx, x, y, w, h);
      break;
    case 'poltergeist_possession':
      drawPoltergeistPossessionArt(ctx, x, y, w, h);
      break;
    case 'graveyard_zombie_bash':
      drawGraveyardZombieBashArt(ctx, x, y, w, h);
      break;
    case 'phantom_mirror_gaze':
      drawPhantomMirrorGazeArt(ctx, x, y, w, h);
      break;
    case 'cauldron_witch_brew':
      drawCauldronWitchBrewArt(ctx, x, y, w, h);
      break;
    case 'gargoyle_stone_stare':
      drawGargoyleStoneStareArt(ctx, x, y, w, h);
      break;
    case 'ghost_vacuum_buster':
      drawGhostVacuumBusterArt(ctx, x, y, w, h);
      break;
    case 'tombstone_crypt_slider':
      drawTombstoneCryptSliderArt(ctx, x, y, w, h);
      break;
    case 'creepy_doll_crawl':
      drawCreepyDollCrawlArt(ctx, x, y, w, h);
      break;
    case 'ouija_spirit_board':
      drawOuijaSpiritBoardArt(ctx, x, y, w, h);
      break;
    case 'cursed_clocktower_pendulum':
      drawCursedClocktowerPendulumArt(ctx, x, y, w, h);
      break;
    case 'synthwave_neon_racer':
      drawSynthwaveNeonRacerArt(ctx, x, y, w, h);
      break;
    case 'pixel_space_invader':
      drawPixelSpaceInvaderArt(ctx, x, y, w, h);
      break;
    case 'vector_tank_battle':
      drawVectorTankBattleArt(ctx, x, y, w, h);
      break;
    case 'pac_maze_chomp':
      drawPacMazeChompArt(ctx, x, y, w, h);
      break;
    case 'breakout_brick_blaster':
      drawBreakoutBrickBlasterArt(ctx, x, y, w, h);
      break;
    case 'laser_disc_dance':
      drawLaserDiscDanceArt(ctx, x, y, w, h);
      break;
    case 'crt_scanline_sniper':
      drawCrtScanlineSniperArt(ctx, x, y, w, h);
      break;
    case 'cyber_grid_runner':
      drawCyberGridRunnerArt(ctx, x, y, w, h);
      break;
    case 'synth_drum_pad':
      drawSynthDrumPadArt(ctx, x, y, w, h);
      break;
    case 'matrix_code_rain':
      drawMatrixCodeRainArt(ctx, x, y, w, h);
      break;
    case 'sharks_and_minnows':
      drawSharksAndMinnowsArt(ctx, x, y, w, h);
      break;
    case 'power_path_clash':
      drawPowerPathClashArt(ctx, x, y, w, h);
      break;
    case 'landscape_artillery':
      drawLandscapeArtilleryArt(ctx, x, y, w, h);
      break;
    case 'spam_click_showdown':
      drawSpamClickShowdownArt(ctx, x, y, w, h);
      break;
    default:
      drawDefaultArt(ctx, x, y, w, h);
      break;
  }
  ctx.fillRect = originalFillRect;

  // Luminous central ambient bloom
  const centerGlow = ctx.createRadialGradient(x + w * 0.5, y + h * 0.5, 4, x + w * 0.5, y + h * 0.5, w * 0.65);
  centerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  centerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(x, y, w, h);

  // Premium angled arcade glass reflection & vignette
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h * 0.32);
  ctx.lineTo(x, y + h * 0.6);
  ctx.closePath();
  const glassGrad = ctx.createLinearGradient(x, y, x, y + h * 0.6);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
  glassGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.12)');
  glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = glassGrad;
  ctx.fill();

  // Subtle bottom vignette inside artwork
  const botVignette = ctx.createLinearGradient(x, y + h - 28, x, y + h);
  botVignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  botVignette.addColorStop(1, 'rgba(0, 0, 0, 0.44)');
  ctx.fillStyle = botVignette;
  ctx.fillRect(x, y + h - 28, w, 28);

  // Crisp dual inner bezel borders (bright specular rim + dark inset)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

  ctx.restore();
  ctx.restore();
}

// 1. CYBER TANKS
function drawTanksArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Arena floor
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#0F172A');
  bg.addColorStop(1, '#1E293B');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  // Subtle grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.lineWidth = 1;
  const gridStep = 20;
  for (let gx = x; gx <= x + w; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let gy = y; gy <= y + h; gy += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }

  // Red Tank
  const t1x = x + w * 0.28;
  const t1y = y + h * 0.65;
  ctx.save();
  ctx.translate(t1x, t1y);
  ctx.rotate(-0.35);
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(-18, -12, 36, 24);
  ctx.fillStyle = '#991B1B';
  ctx.fillRect(-18, -16, 36, 5);
  ctx.fillRect(-18, 11, 36, 5);
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F87171';
  ctx.fillRect(0, -3, 20, 6);
  ctx.restore();

  // Blue Tank
  const t2x = x + w * 0.72;
  const t2y = y + h * 0.35;
  ctx.save();
  ctx.translate(t2x, t2y);
  ctx.rotate(2.8);
  ctx.fillStyle = '#3B82F6';
  ctx.fillRect(-18, -12, 36, 24);
  ctx.fillStyle = '#1E40AF';
  ctx.fillRect(-18, -16, 36, 5);
  ctx.fillRect(-18, 11, 36, 5);
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#60A5FA';
  ctx.fillRect(0, -3, 20, 6);
  ctx.restore();

  // Bouncing Laser Shell Trail
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(t1x + 15, t1y - 8);
  ctx.lineTo(x + w * 0.52, y + h * 0.2);
  ctx.lineTo(t2x - 10, t2y + 10);
  ctx.stroke();

  // Laser Glow
  ctx.fillStyle = '#FDE68A';
  ctx.beginPath();
  ctx.arc(x + w * 0.52, y + h * 0.2, 5, 0, Math.PI * 2);
  ctx.fill();

  // Crate obstacle in center
  ctx.fillStyle = '#78350F';
  ctx.fillRect(x + w * 0.46, y + h * 0.48, 22, 22);
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + w * 0.46, y + h * 0.48, 22, 22);
}

// 2. NEON BUMPER DERBY
function drawHovercraftArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Stadium Floor
  ctx.fillStyle = '#090D16';
  ctx.fillRect(x, y, w, h);

  // Subtle floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1;
  const step = 18;
  for (let gx = x; gx <= x + w; gx += step) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let gy = y; gy <= y + h; gy += step) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }

  // Electric perimeter rails
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);

  const cx = x + w / 2;
  const cy = y + h / 2;

  // Center Pinball Bumpers
  ctx.fillStyle = '#EC4899';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  // Mini Pinball Bumper (top-right)
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(cx + w * 0.28, cy - h * 0.22, 10, 0, Math.PI * 2);
  ctx.fill();

  // Battery Drop (bottom-left)
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(cx - w * 0.28, cy + h * 0.22, 8, 0, Math.PI * 2);
  ctx.fill();

  // Red Bumper Car
  ctx.save();
  ctx.translate(cx - 28, cy + 4);
  ctx.rotate(0.3);
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(-2, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Blue Bumper Car
  ctx.save();
  ctx.translate(cx + 26, cy - 4);
  ctx.rotate(3.4);
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(-2, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Clash Shockwave & Sparks
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx - 1, cy, 12, 0, Math.PI * 2);
  ctx.stroke();
}

// 3. LASER GRID REFLEX
function drawLaserGridArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#090D16';
  ctx.fillRect(x, y, w, h);

  // Isometric neon tile floor
  const tileCols = 4;
  const tileRows = 3;
  const tw = w / (tileCols + 1);
  const th = h / (tileRows + 1);

  for (let c = 0; c < tileCols; c++) {
    for (let r = 0; r < tileRows; r++) {
      const tx = x + (c + 0.6) * tw;
      const ty = y + (r + 0.6) * th;
      const isHazard = (c === 2 && r === 1);
      ctx.fillStyle = isHazard ? '#7F1D1D' : '#1E293B';
      ctx.fillRect(tx, ty, tw * 0.8, th * 0.75);
      ctx.strokeStyle = isHazard ? '#EF4444' : '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tx, ty, tw * 0.8, th * 0.75);
    }
  }

  // Laser beam danger line
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.55);
  ctx.lineTo(x + w, y + h * 0.55);
  ctx.stroke();
  ctx.strokeStyle = '#FCA5A5';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.55);
  ctx.lineTo(x + w, y + h * 0.55);
  ctx.stroke();

  // Dashing Cyber Runner
  const rx = x + w * 0.35;
  const ry = y + h * 0.45;
  ctx.fillStyle = '#06B6D4';
  ctx.beginPath();
  ctx.arc(rx, ry, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#A5F3FC';
  ctx.beginPath();
  ctx.arc(rx + 3, ry - 3, 4, 0, Math.PI * 2);
  ctx.fill();

  // Golden Battery Gem
  const bx = x + w * 0.75;
  const by = y + h * 0.32;
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(bx, by, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(bx, by, 4, 0, Math.PI * 2);
  ctx.fill();
}

// 4. ORBITAL SLINGSHOT
function drawOrbitalArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep Space
  const space = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w);
  space.addColorStop(0, '#1E1B4B');
  space.addColorStop(1, '#030712');
  ctx.fillStyle = space;
  ctx.fillRect(x, y, w, h);

  // Tiny Stars
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  const starCoords = [[0.15, 0.2], [0.85, 0.25], [0.2, 0.8], [0.8, 0.85], [0.5, 0.15]];
  starCoords.forEach(([sx, sy]) => {
    ctx.fillRect(x + w * sx, y + h * sy, 2, 2);
  });

  // Central Planet with Atmosphere
  const px = x + w * 0.48;
  const py = y + h * 0.52;
  const pGrad = ctx.createRadialGradient(px - 6, py - 6, 4, px, py, 26);
  pGrad.addColorStop(0, '#60A5FA');
  pGrad.addColorStop(0.7, '#2563EB');
  pGrad.addColorStop(1, '#1E3A8A');
  ctx.fillStyle = pGrad;
  ctx.beginPath();
  ctx.arc(px, py, 26, 0, Math.PI * 2);
  ctx.fill();

  // Planetary Rings
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-0.4);
  ctx.strokeStyle = 'rgba(191, 219, 254, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 44, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Orbit Trajectory Arc
  ctx.strokeStyle = '#FACC15';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 42, -Math.PI * 0.4, Math.PI * 0.6);
  ctx.stroke();
  ctx.setLineDash([]);

  // Slingshot Spaceship
  const sx = px + 42 * Math.cos(Math.PI * 0.6);
  const sy = py + 42 * Math.sin(Math.PI * 0.6);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(Math.PI * 0.6 + Math.PI / 2);
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(7, 8);
  ctx.lineTo(-7, 8);
  ctx.closePath();
  ctx.fill();
  // Thrust plume
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(-2, 8, 4, 6);
  ctx.restore();
}

// 5. MICRO TURBO GP
function drawMicroGpArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Grass infield
  ctx.fillStyle = '#15803D';
  ctx.fillRect(x, y, w, h);

  // Curving asphalt track
  const cx = x + w / 2;
  const cy = y + h * 0.6;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 50;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.38, h * 0.4, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Red & White Curbs
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.38 + 26, h * 0.4 + 26, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Center dashed track stripe
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.38, h * 0.4, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Drifting Formula Race Car
  const carX = cx + 22;
  const carY = cy - h * 0.4 + 2;
  ctx.save();
  ctx.translate(carX, carY);
  ctx.rotate(0.3);

  // Tire smoke
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(-18, 8, 8, 0, Math.PI * 2);
  ctx.arc(-26, 12, 10, 0, Math.PI * 2);
  ctx.fill();

  // Car chassis
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(-14, -7, 28, 14);
  // Wheels
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(-12, -10, 8, 4);
  ctx.fillRect(6, -10, 8, 4);
  ctx.fillRect(-12, 6, 8, 4);
  ctx.fillRect(6, 6, 8, 4);
  // Spoiler
  ctx.fillStyle = '#B45309';
  ctx.fillRect(-16, -9, 4, 18);
  ctx.restore();
}

// 6. GHOST FLASHLIGHT
function drawGhostFlashlightArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Midnight Darkness
  ctx.fillStyle = '#050814';
  ctx.fillRect(x, y, w, h);

  // Flashlight Origin
  const fx = x + w * 0.18;
  const fy = y + h * 0.65;

  // Flashlight Cone
  const coneGrad = ctx.createRadialGradient(fx, fy, 5, fx, fy, w * 0.75);
  coneGrad.addColorStop(0, 'rgba(253, 224, 71, 0.85)');
  coneGrad.addColorStop(0.6, 'rgba(253, 224, 71, 0.3)');
  coneGrad.addColorStop(1, 'rgba(253, 224, 71, 0.0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(x + w * 0.95, y + h * 0.15);
  ctx.lineTo(x + w * 0.85, y + h * 0.95);
  ctx.closePath();
  ctx.fill();

  // Flashlight Handle
  ctx.fillStyle = '#475569';
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(-0.5);
  ctx.fillRect(-22, -6, 22, 12);
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(0, -9, 8, 18);
  ctx.restore();

  // Spooky Ghost Illuminated
  const gx = x + w * 0.68;
  const gy = y + h * 0.42;

  ctx.fillStyle = '#A7F3D0';
  ctx.beginPath();
  ctx.arc(gx, gy - 8, 16, Math.PI, 0);
  ctx.lineTo(gx + 16, gy + 14);
  // Wavy bottom skirt
  ctx.quadraticCurveTo(gx + 8, gy + 8, gx, gy + 14);
  ctx.quadraticCurveTo(gx - 8, gy + 8, gx - 16, gy + 14);
  ctx.closePath();
  ctx.fill();

  // Ghost Eyes & Mouth
  ctx.fillStyle = '#064E3B';
  ctx.beginPath();
  ctx.ellipse(gx - 6, gy - 7, 3, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(gx + 6, gy - 7, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(gx, gy + 2, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 7. KITCHEN CHAOS
function drawKitchenChaosArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Tile counter
  ctx.fillStyle = '#FEF3C7';
  ctx.fillRect(x, y, w, h);

  // Rotating Serving Plate
  const px = x + w * 0.65;
  const py = y + h * 0.5;
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.ellipse(px, py, 34, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Flying Burger
  const bx = x + w * 0.38;
  const by = y + h * 0.38;
  // Bottom bun
  ctx.fillStyle = '#D97706';
  ctx.fillRect(bx - 12, by + 4, 24, 6);
  // Patty
  ctx.fillStyle = '#78350F';
  ctx.fillRect(bx - 14, by, 28, 4);
  // Cheese
  ctx.fillStyle = '#FBBF24';
  ctx.fillRect(bx - 13, by - 2, 26, 3);
  // Lettuce
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(bx - 14, by - 4, 28, 3);
  // Top bun
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.ellipse(bx, by - 7, 13, 6, 0, Math.PI, 0);
  ctx.fill();

  // Flying Spicy Pepper
  const chx = x + w * 0.72;
  const chy = y + h * 0.3;
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.arc(chx, chy, 8, 0, Math.PI);
  ctx.lineTo(chx + 12, chy - 4);
  ctx.closePath();
  ctx.fill();
  // Pepper stem
  ctx.strokeStyle = '#15803D';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(chx - 6, chy);
  ctx.lineTo(chx - 10, chy - 4);
  ctx.stroke();

  // Fling trajectory
  ctx.strokeStyle = '#F59E0B';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.15, y + h * 0.7);
  ctx.quadraticCurveTo(bx, by - 20, px, py);
  ctx.stroke();
  ctx.setLineDash([]);
}

// 8. SKYLINE SUMO (With Lakitu cloud rescuer)
function drawSkylineSumoArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dusk Gradient
  const dusk = ctx.createLinearGradient(x, y, x, y + h);
  dusk.addColorStop(0, '#4C1D95');
  dusk.addColorStop(0.55, '#831843');
  dusk.addColorStop(1, '#F59E0B');
  ctx.fillStyle = dusk;
  ctx.fillRect(x, y, w, h);

  // Skyscraper silhouettes in background
  ctx.fillStyle = '#1E1B4B';
  ctx.fillRect(x + w * 0.05, y + h * 0.45, w * 0.18, h * 0.55);
  ctx.fillRect(x + w * 0.28, y + h * 0.35, w * 0.22, h * 0.65);
  ctx.fillRect(x + w * 0.75, y + h * 0.42, w * 0.2, h * 0.58);

  // Skyscraper glowing windows
  ctx.fillStyle = '#FDE047';
  for (let wy = y + h * 0.48; wy < y + h * 0.9; wy += 12) {
    ctx.fillRect(x + w * 0.32, wy, 4, 6);
    ctx.fillRect(x + w * 0.42, wy, 4, 6);
  }

  // Floating bouncy platform
  const platX = x + w * 0.25;
  const platY = y + h * 0.72;
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(platX, platY, w * 0.5, 12);
  ctx.fillStyle = '#15803D';
  ctx.fillRect(platX, platY + 8, w * 0.5, 4);

  // Chubby Leaping Sumo Fighter
  const sx = x + w * 0.42;
  const sy = y + h * 0.46;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(sx, sy, 14, 0, Math.PI * 2);
  ctx.fill();
  // Sumo belt
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(sx - 14, sy - 2, 28, 5);
  // Head & topknot
  ctx.fillStyle = '#FCA5A5';
  ctx.beginPath();
  ctx.arc(sx, sy - 14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(sx, sy - 21, 4, 0, Math.PI * 2);
  ctx.fill();

  // Lakitu Cloud Rescuer on top right!
  const lx = x + w * 0.8;
  const ly = y + h * 0.2;
  // Fluffy cloud
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(lx, ly, 10, 0, Math.PI * 2);
  ctx.arc(lx + 8, ly - 4, 11, 0, Math.PI * 2);
  ctx.arc(lx + 18, ly, 9, 0, Math.PI * 2);
  ctx.fill();
  // Smiling eyes
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(lx + 4, ly - 2, 2, 3);
  ctx.fillRect(lx + 12, ly - 2, 2, 3);
  // Fishing pole line & hook
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lx, ly + 2);
  ctx.lineTo(lx - 16, ly + 28);
  ctx.stroke();
  // Golden hook
  ctx.beginPath();
  ctx.arc(lx - 18, ly + 31, 3, 0, Math.PI);
  ctx.stroke();
}

// 9. ANIMAL STACK
function drawAnimalStackArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Sunny sky
  ctx.fillStyle = '#BAE6FD';
  ctx.fillRect(x, y, w, h);

  // Sea water
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(x, y + h * 0.78, w, h * 0.22);

  // Floating wooden raft
  const rx = x + w * 0.2;
  const ry = y + h * 0.74;
  ctx.fillStyle = '#92400E';
  ctx.fillRect(rx, ry, w * 0.6, 12);
  ctx.fillStyle = '#B45309';
  ctx.fillRect(rx + 4, ry + 2, w * 0.6 - 8, 8);

  // Bottom Animal: Chubby Pink Piglet
  const bx = x + w * 0.5;
  const by = ry - 14;
  ctx.fillStyle = '#F472B6';
  ctx.beginPath();
  ctx.roundRect(bx - 18, by - 12, 36, 24, 8);
  ctx.fill();
  // Piglet snout
  ctx.fillStyle = '#EC4899';
  ctx.beginPath();
  ctx.ellipse(bx, by + 2, 7, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#831843';
  ctx.beginPath();
  ctx.arc(bx - 2.5, by + 2, 1.2, 0, Math.PI * 2);
  ctx.arc(bx + 2.5, by + 2, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  ctx.fillStyle = '#DB2777';
  ctx.beginPath();
  ctx.moveTo(bx - 16, by - 10);
  ctx.lineTo(bx - 22, by - 18);
  ctx.lineTo(bx - 8, by - 12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bx + 16, by - 10);
  ctx.lineTo(bx + 22, by - 18);
  ctx.lineTo(bx + 8, by - 12);
  ctx.closePath();
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(bx - 8, by - 4, 2.8, 0, Math.PI * 2);
  ctx.arc(bx + 8, by - 4, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(bx - 9, by - 5, 1, 0, Math.PI * 2);
  ctx.arc(bx + 7, by - 5, 1, 0, Math.PI * 2);
  ctx.fill();
  // Cheeks
  ctx.fillStyle = 'rgba(244, 114, 182, 0.7)';
  ctx.beginPath();
  ctx.arc(bx - 12, by + 2, 2.5, 0, Math.PI * 2);
  ctx.arc(bx + 12, by + 2, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Middle Animal: Sunny Duckie
  const dx = bx;
  const dy = by - 24;
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.roundRect(dx - 14, dy - 10, 28, 20, 7);
  ctx.fill();
  // Orange Duck Bill
  ctx.fillStyle = '#EA580C';
  ctx.beginPath();
  ctx.roundRect(dx - 6, dy + 1, 12, 5, 3);
  ctx.fill();
  // Duck Eyes
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(dx - 6, dy - 3, 2.5, 0, Math.PI * 2);
  ctx.arc(dx + 6, dy - 3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(dx - 7, dy - 4, 0.9, 0, Math.PI * 2);
  ctx.arc(dx + 5, dy - 4, 0.9, 0, Math.PI * 2);
  ctx.fill();
  // Wings
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(dx - 13, dy + 2, 4, -Math.PI / 2, Math.PI / 2);
  ctx.arc(dx + 13, dy + 2, 4, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  // Top Animal: Happy Green Frog
  const fx = bx;
  const fy = dy - 20;
  ctx.fillStyle = '#22C55E';
  ctx.beginPath();
  ctx.roundRect(fx - 11, fy - 7, 22, 14, 6);
  ctx.fill();
  // Frog eye domes
  ctx.beginPath();
  ctx.arc(fx - 6, fy - 7, 5, 0, Math.PI * 2);
  ctx.arc(fx + 6, fy - 7, 5, 0, Math.PI * 2);
  ctx.fill();
  // Frog Eyes
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(fx - 6, fy - 7, 3.5, 0, Math.PI * 2);
  ctx.arc(fx + 6, fy - 7, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(fx - 6, fy - 7, 2, 0, Math.PI * 2);
  ctx.arc(fx + 6, fy - 7, 2, 0, Math.PI * 2);
  ctx.fill();
  // Happy smile
  ctx.strokeStyle = '#15803D';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(fx, fy + 2, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Overhead crane hook
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.5, y + 16);
  ctx.stroke();
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + 18, 5, 0, Math.PI * 2);
  ctx.fill();
}

// 10. SUMO ICEBERG
function drawSumoIcebergArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Freezing water
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(x, y, w, h);

  // Tilted Iceberg Disc
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = '#F0F9FF';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.4, h * 0.32, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7DD3FC';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Red Sumo
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(cx - 24, cy - 4, 15, 0, Math.PI * 2);
  ctx.fill();

  // Blue Sumo
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(cx + 18, cy + 8, 15, 0, Math.PI * 2);
  ctx.fill();

  // Impact star
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(cx - 2, cy + 2, 7, 0, Math.PI * 2);
  ctx.fill();

  // Water splash ripples
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx + w * 0.35, cy + h * 0.22, 10, 0, Math.PI * 2);
  ctx.stroke();
}

// 11. CANNON BARRAGE
function drawCannonBarrageArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Sky
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(x, y, w, h);

  // Stone Wall Ramparts
  ctx.fillStyle = '#475569';
  ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
  // Crenellations
  for (let cx = x + 10; cx < x + w; cx += 32) {
    ctx.fillRect(cx, y + h * 0.64, 16, h * 0.08);
  }

  // Black Iron Cannon
  const canX = x + w * 0.28;
  const canY = y + h * 0.66;
  ctx.save();
  ctx.translate(canX, canY);
  ctx.rotate(-0.55);
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(-8, -8, 34, 16);
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Cannon Smoke & Muzzle Flash
  const fx = canX + 24;
  const fy = canY - 16;
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(fx, fy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(203, 213, 225, 0.7)';
  ctx.beginPath();
  ctx.arc(fx - 4, fy - 6, 8, 0, Math.PI * 2);
  ctx.arc(fx + 6, fy - 4, 7, 0, Math.PI * 2);
  ctx.fill();

  // Flying Iron Cannonball
  const ballX = x + w * 0.72;
  const ballY = y + h * 0.36;
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(ballX, ballY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.arc(ballX - 2, ballY - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

// 12. ANVIL RAIN
function drawAnvilRainArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Danger room
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y, w, h);

  // Ground Danger Shadow
  const sx = x + w * 0.5;
  const sy = y + h * 0.82;
  ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, 32, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Heavy Iron Anvil Falling
  const ax = sx;
  const ay = y + h * 0.38;
  ctx.fillStyle = '#334155';
  // Anvil horn & body
  ctx.beginPath();
  ctx.moveTo(ax - 28, ay - 14);
  ctx.lineTo(ax + 24, ay - 14);
  ctx.lineTo(ax + 24, ay - 4);
  ctx.lineTo(ax + 12, ay);
  ctx.lineTo(ax + 16, ay + 14);
  ctx.lineTo(ax - 22, ay + 14);
  ctx.lineTo(ax - 16, ay);
  ctx.closePath();
  ctx.fill();

  // Anvil Highlight
  ctx.fillStyle = '#64748B';
  ctx.fillRect(ax - 24, ay - 14, 44, 4);

  // Motion drop lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ax - 18, ay - 35);
  ctx.lineTo(ax - 18, ay - 18);
  ctx.moveTo(ax + 14, ay - 35);
  ctx.lineTo(ax + 14, ay - 18);
  ctx.stroke();
}

// 13. BOMB RELAY
function drawBombRelayArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Warm dramatic backdrop
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#7F1D1D');
  bg.addColorStop(1, '#18181B');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  // Big Cartoon Bomb
  const bx = x + w * 0.5;
  const by = y + h * 0.58;
  const rad = 28;

  // Bomb body
  ctx.fillStyle = '#09090B';
  ctx.beginPath();
  ctx.arc(bx, by, rad, 0, Math.PI * 2);
  ctx.fill();

  // Glossy highlight
  ctx.fillStyle = '#52525B';
  ctx.beginPath();
  ctx.arc(bx - 9, by - 9, 8, 0, Math.PI * 2);
  ctx.fill();

  // Bomb cap & Fuse
  ctx.fillStyle = '#71717A';
  ctx.fillRect(bx - 6, by - rad - 5, 12, 6);

  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx, by - rad - 5);
  ctx.quadraticCurveTo(bx + 18, by - rad - 20, bx + 26, by - rad - 12);
  ctx.stroke();

  // Sparking Fuse Flame
  const fx = bx + 26;
  const fy = by - rad - 12;
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(fx, fy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(fx, fy, 3, 0, Math.PI * 2);
  ctx.fill();

  // Skull decal on bomb
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(bx, by - 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(bx - 4, by + 3, 8, 4);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(bx - 4, by - 3, 3, 3);
  ctx.fillRect(bx + 1, by - 3, 3, 3);
}

// 14. MICRO HOCKEY
function drawMicroHockeyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Neon rink floor
  ctx.fillStyle = '#0B132B';
  ctx.fillRect(x, y, w, h);

  // Circular table boundary
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  // Center circle
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Red Mallet (Left)
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(cx - 32, cy - 6, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#991B1B';
  ctx.beginPath();
  ctx.arc(cx - 32, cy - 6, 6, 0, Math.PI * 2);
  ctx.fill();

  // Blue Mallet (Right)
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(cx + 32, cy + 6, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1D4ED8';
  ctx.beginPath();
  ctx.arc(cx + 32, cy + 6, 6, 0, Math.PI * 2);
  ctx.fill();

  // Streaking Neon Puck
  const px = cx + 8;
  const py = cy - 14;
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fill();

  // Puck Speed trail
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(px - 22, py + 12);
  ctx.lineTo(px, py);
  ctx.stroke();
}

// 15. QUICK DRAW WESTERN
function drawQuickDrawArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Western High Noon Sunset
  const sunset = ctx.createLinearGradient(x, y, x, y + h);
  sunset.addColorStop(0, '#EA580C');
  sunset.addColorStop(0.5, '#F59E0B');
  sunset.addColorStop(1, '#78350F');
  ctx.fillStyle = sunset;
  ctx.fillRect(x, y, w, h);

  // Giant Orange Sun
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.42, 32, 0, Math.PI * 2);
  ctx.fill();

  // Desert Mesa Hill Silhouettes
  ctx.fillStyle = '#451A03';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + h * 0.68);
  ctx.lineTo(x + w * 0.35, y + h * 0.64);
  ctx.lineTo(x + w * 0.6, y + h * 0.72);
  ctx.lineTo(x + w, y + h * 0.62);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();

  // Saguaro Cactus Silhouette
  const cax = x + w * 0.2;
  const cay = y + h * 0.55;
  ctx.fillStyle = '#271003';
  ctx.fillRect(cax, cay, 6, 32);
  ctx.fillRect(cax - 8, cay + 8, 8, 4);
  ctx.fillRect(cax - 8, cay + 4, 4, 8);
  ctx.fillRect(cax + 6, cay + 12, 8, 4);
  ctx.fillRect(cax + 10, cay + 8, 4, 8);

  // Duelling Cowboy Silhouette with Hat & Revolver
  const cwX = x + w * 0.72;
  const cwY = y + h * 0.52;
  // Hat
  ctx.fillRect(cwX - 12, cwY - 2, 24, 4);
  ctx.fillRect(cwX - 6, cwY - 8, 12, 6);
  // Head
  ctx.beginPath();
  ctx.arc(cwX, cwY + 3, 5, 0, Math.PI * 2);
  ctx.fill();
  // Body & coat
  ctx.fillRect(cwX - 6, cwY + 8, 12, 20);
  // Gun arm pointing left
  ctx.fillRect(cwX - 14, cwY + 12, 10, 4);
  // Gun smoke
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(cwX - 18, cwY + 10, 3, 0, Math.PI * 2);
  ctx.arc(cwX - 22, cwY + 7, 4, 0, Math.PI * 2);
  ctx.fill();
}

// 16. BALLOON BURST
function drawBalloonBurstArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Carnival Sky
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#E0F2FE');
  sky.addColorStop(1, '#BAE6FD');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  // Confetti streamers
  const confettiColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  confettiColors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + w * (0.15 + i * 0.18), y + h * (0.12 + (i % 3) * 0.1), 5, 10);
  });

  // Gigantic Shiny Inflated Balloon
  const bx = x + w * 0.52;
  const by = y + h * 0.48;
  const radX = 32;
  const radY = 38;

  // Red balloon gradient
  const balGrad = ctx.createRadialGradient(bx - 10, by - 12, 4, bx, by, radY);
  balGrad.addColorStop(0, '#FCA5A5');
  balGrad.addColorStop(0.4, '#EF4444');
  balGrad.addColorStop(1, '#991B1B');
  ctx.fillStyle = balGrad;
  ctx.beginPath();
  ctx.ellipse(bx, by, radX, radY, 0, 0, Math.PI * 2);
  ctx.fill();

  // Balloon strain tension cracks/lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(bx + 12, by - 6, 8, 0, Math.PI * 0.7);
  ctx.stroke();

  // Balloon knot & string
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(bx - 3, by + radY, 6, 5);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx, by + radY + 5);
  ctx.quadraticCurveTo(bx - 8, by + radY + 18, bx + 2, by + radY + 28);
  ctx.stroke();

  // POP burst spark
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(bx + radX - 4, by - radY + 8, 6, 0, Math.PI * 2);
  ctx.fill();
}

// 17. Swat the Fly
function drawSwatFlyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Wooden table with red gingham
  ctx.fillStyle = '#451A03';
  ctx.fillRect(x, y, w, h);

  // Red & White Gingham Tablecloth
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 12, y + 12, w - 24, h - 24);

  const check = 18;
  for (let gy = y + 12; gy < y + h - 12; gy += check) {
    for (let gx = x + 12; gx < x + w - 12; gx += check) {
      if ((Math.floor(gx / check) + Math.floor(gy / check)) % 2 === 0) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.fillRect(gx, gy, check, check);
      }
    }
  }

  // Buzzing Housefly
  const fx = x + w * 0.35;
  const fy = y + h * 0.45;
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.ellipse(fx, fy, 8, 12, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Fly wings
  ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
  ctx.beginPath();
  ctx.ellipse(fx - 7, fy - 6, 8, 4, -0.4, 0, Math.PI * 2);
  ctx.ellipse(fx + 7, fy - 6, 8, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Swatter Head in Mid-Slam
  const sx = x + w * 0.65;
  const sy = y + h * 0.45;
  ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
  ctx.beginPath();
  ctx.roundRect(sx - 18, sy - 22, 36, 40, 6);
  ctx.fill();
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Handle
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(sx - 2, sy + 18, 4, 30);
  ctx.fillStyle = '#1D4ED8';
  ctx.fillRect(sx - 3, sy + 34, 6, 14);
}

// 18. Stop at Zero
function drawStopAtZeroArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Industrial steel casing
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);

  // Digital LED Display Box
  const dw = w * 0.7;
  const dh = 48;
  const dx = x + w / 2 - dw / 2;
  const dy = y + h * 0.28;
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.roundRect(dx, dy, dw, dh, 8);
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glowing 0.000s text
  ctx.shadowColor = '#38BDF8';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#38BDF8';
  ctx.font = '900 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('0.000 s', x + w / 2, dy + dh / 2);
  ctx.shadowBlur = 0;

  // Red Slam Button below
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.roundRect(x + w / 2 - 28, y + h * 0.72, 56, 18, 5);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// 19. Turf Whack
function drawTurfWhackArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Backyard green lawn
  ctx.fillStyle = '#15803D';
  ctx.fillRect(x, y, w, h);

  // Garden Hole & Dirt Rim
  const hx = x + w / 2;
  const hy = y + h * 0.62;
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.ellipse(hx, hy + 4, 38, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1C1917';
  ctx.beginPath();
  ctx.ellipse(hx, hy, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cute Mole with Golden Crown popping out
  const my = hy - 18;
  ctx.fillStyle = '#57534E';
  ctx.beginPath();
  ctx.ellipse(hx, my, 18, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Snout
  ctx.fillStyle = '#F472B6';
  ctx.beginPath();
  ctx.ellipse(hx, my + 3, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(hx - 5, my - 4, 2, 0, Math.PI * 2);
  ctx.arc(hx + 5, my - 4, 2, 0, Math.PI * 2);
  ctx.fill();
  // Gold Crown
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.moveTo(hx - 9, my - 12);
  ctx.lineTo(hx - 11, my - 20);
  ctx.lineTo(hx - 4, my - 15);
  ctx.lineTo(hx, my - 22);
  ctx.lineTo(hx + 4, my - 15);
  ctx.lineTo(hx + 11, my - 20);
  ctx.lineTo(hx + 9, my - 12);
  ctx.closePath();
  ctx.fill();

  // Wooden Whack Mallet overhead
  const mx = hx + 36;
  const malY = my - 16;
  ctx.save();
  ctx.translate(mx, malY);
  ctx.rotate(-0.4);
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.roundRect(-16, -12, 32, 16, 4);
  ctx.fill();
  ctx.fillStyle = '#78350F';
  ctx.fillRect(-2, 4, 4, 28);
  ctx.restore();
}

// 20. Neon Lightcycles
function drawNeonLightcyclesArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Tron digital grid floor
  ctx.fillStyle = '#050811';
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1;
  for (let gx = x; gx < x + w; gx += 20) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let gy = y; gy < y + h; gy += 20) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }

  // Cyan Lightcycle Trail
  ctx.shadowColor = '#06B6D4';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#06B6D4';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + h * 0.7);
  ctx.lineTo(x + w * 0.55, y + h * 0.7);
  ctx.lineTo(x + w * 0.55, y + h * 0.25);
  ctx.lineTo(x + w * 0.8, y + h * 0.25);
  ctx.stroke();

  // Cyan Lightcycle head
  ctx.fillStyle = '#06B6D4';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.8, y + h * 0.25 - 5, 14, 10, 3);
  ctx.fill();

  // Red Opponent Trail trapped
  ctx.shadowColor = '#EF4444';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + 16);
  ctx.lineTo(x + w * 0.35, y + h * 0.5);
  ctx.lineTo(x + w * 0.5, y + h * 0.5);
  ctx.stroke();

  // Sparks at turning corner
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(x + w * 0.55, y + h * 0.7, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// 21. Blade Parry (Rock 'Em Sock 'Em Blade Bots)
function drawBladeParryArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Stadium dark arena backdrop
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  // Boxing Ring Canvas Floor
  const ringY = y + h * 0.72;
  ctx.fillStyle = '#334155';
  ctx.fillRect(x + 10, ringY, w - 20, h - (ringY - y));

  // Boxing Ring Ropes
  const ropes = [ringY - 32, ringY - 20, ringY - 8];
  const ropeColors = ['#EF4444', '#F8FAFC', '#3B82F6'];
  for (let r = 0; r < ropes.length; r++) {
    ctx.strokeStyle = ropeColors[r];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, ropes[r]);
    ctx.lineTo(x + w - 10, ropes[r]);
    ctx.stroke();
  }

  // Left Robot (Red Rocker)
  const r1X = x + w * 0.32;
  const r1Y = ringY;
  ctx.fillStyle = '#EF4444';
  // Body
  ctx.beginPath();
  ctx.roundRect(r1X - 10, r1Y - 26, 20, 22, 3);
  ctx.fill();
  // Spring Neck
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r1X, r1Y - 26);
  ctx.lineTo(r1X - 3, r1Y - 32);
  ctx.lineTo(r1X + 3, r1Y - 36);
  ctx.lineTo(r1X, r1Y - 40);
  ctx.stroke();
  // Head
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.roundRect(r1X - 8, r1Y - 54, 16, 14, 3);
  ctx.fill();
  // Visor
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(r1X - 2, r1Y - 50, 10, 4);
  // Piston Punch Left Arm Extended
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r1X + 4, r1Y - 20);
  ctx.lineTo(r1X + 22, r1Y - 20);
  ctx.stroke();
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(r1X + 24, r1Y - 20, 5, 0, Math.PI * 2);
  ctx.fill();

  // Right Robot (Blue Bomber)
  const r2X = x + w * 0.68;
  const r2Y = ringY;
  ctx.fillStyle = '#3B82F6';
  // Body
  ctx.beginPath();
  ctx.roundRect(r2X - 10, r2Y - 26, 20, 22, 3);
  ctx.fill();
  // Spring Neck (Extended Popped Head!)
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r2X, r2Y - 26);
  ctx.lineTo(r2X - 4, r2Y - 34);
  ctx.lineTo(r2X + 4, r2Y - 42);
  ctx.lineTo(r2X, r2Y - 48);
  ctx.stroke();
  // Popped Head!
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.roundRect(r2X - 8, r2Y - 62, 16, 14, 3);
  ctx.fill();
  // X_X Eyes
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r2X - 5, r2Y - 58); ctx.lineTo(r2X - 1, r2Y - 54);
  ctx.moveTo(r2X - 1, r2Y - 58); ctx.lineTo(r2X - 5, r2Y - 54);
  ctx.stroke();

  // Center Clash Sparks
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(x + w * 0.52, ringY - 22, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + w * 0.52, ringY - 22, 4, 0, Math.PI * 2);
  ctx.fill();
}

// 22. Safe Dial Lock
function drawSafeDialArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Heavy bank vault steel wall
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) * 0.38;

  // Outer vault rim
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fill();

  // Dial plate
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Glowing Green Combination Sector
  ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r - 4, -0.6, 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Dial Ticks
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 20; i++) {
    const ang = (i * Math.PI * 2) / 20;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * (r - 4), cy + Math.sin(ang) * (r - 4));
    ctx.lineTo(cx + Math.cos(ang) * (r - (i % 5 === 0 ? 12 : 7)), cy + Math.sin(ang) * (r - (i % 5 === 0 ? 12 : 7)));
    ctx.stroke();
  }

  // Dial Needle
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy);
  ctx.lineTo(cx, cy - r + 8);
  ctx.lineTo(cx + 3, cy);
  ctx.lineTo(cx, cy + 6);
  ctx.closePath();
  ctx.fill();

  // Center Hub
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();

  // 3 Green Tumbler LEDs
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < 2 ? '#10B981' : '#475569';
    ctx.beginPath();
    ctx.arc(cx - 16 + i * 16, cy + r * 0.55, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 23. Coin Apex
function drawCoinApexArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Vaulted stone treasury background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  // Parabolic Physics Trail
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.25, y + h * 0.85);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.15, x + w * 0.75, y + h * 0.85);
  ctx.stroke();
  ctx.setLineDash([]);

  // Golden Coin at Apex
  const cx = x + w * 0.5;
  const cy = y + h * 0.36;

  // Gold Coin
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Engraved '$' or star
  ctx.fillStyle = '#78350F';
  ctx.font = 'bold 15px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', cx, cy);

  // Apex Star Glint Flare
  ctx.shadowColor = '#FDE047';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(cx + 12, cy - 12);
  ctx.lineTo(cx + 14, cy - 7);
  ctx.lineTo(cx + 19, cy - 7);
  ctx.lineTo(cx + 15, cy - 3);
  ctx.lineTo(cx + 17, cy + 2);
  ctx.lineTo(cx + 12, cy - 1);
  ctx.lineTo(cx + 7, cy + 2);
  ctx.lineTo(cx + 9, cy - 3);
  ctx.lineTo(cx + 5, cy - 7);
  ctx.lineTo(cx + 10, cy - 7);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

// 24. Red Light Sentry
function drawRedLightSentryArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Stealth dark arena
  ctx.fillStyle = '#090D16';
  ctx.fillRect(x, y, w, h);

  const sx = x + w * 0.5;
  const sy = y + h * 0.26;

  // Crimson Scanning Light Cone
  const coneGrad = ctx.createRadialGradient(sx, sy, 6, sx, sy, h * 0.7);
  coneGrad.addColorStop(0, 'rgba(239, 68, 68, 0.65)');
  coneGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.arc(sx, sy, h * 0.7, Math.PI * 0.3, Math.PI * 0.7);
  ctx.closePath();
  ctx.fill();

  // Mechanical Watchtower Sentry Eye
  ctx.fillStyle = '#334155';
  ctx.fillRect(sx - 16, y + 10, 32, 22);

  ctx.shadowColor = '#EF4444';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(sx, sy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(sx, sy, 5, 0, Math.PI * 2);
  ctx.fill();

  // Frozen Runner Statue (in silhouette)
  const rx = x + w * 0.35;
  const ry = y + h * 0.75;
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.arc(rx, ry - 14, 5, 0, Math.PI * 2); // head
  ctx.fillRect(rx - 4, ry - 9, 8, 12); // body
  ctx.fillRect(rx - 5, ry + 3, 3, 8); // legs
  ctx.fillRect(rx + 2, ry + 3, 3, 8);
  ctx.fill();

  // Center Trophy Line
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(sx, y + h * 0.55);
  ctx.lineTo(sx, y + h);
  ctx.stroke();
  ctx.setLineDash([]);
}

// 25. Laser Leap (G-28)
function drawLaserLeapArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dark Cyber Floor
  ctx.fillStyle = '#090D16';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Concentric Neon Circuit Tracks
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, h * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, h * 0.24, 0, Math.PI * 2);
  ctx.stroke();

  // Central Rotating Spindle Core
  ctx.shadowColor = '#F43F5E';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#FB7185';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Sweeping Crimson Laser Beam
  const beamAngle = -0.45;
  const beamLen = h * 0.46;
  const bx = cx + Math.cos(beamAngle) * beamLen;
  const by = cy + Math.sin(beamAngle) * beamLen;

  ctx.shadowColor = '#EF4444';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(bx, by);
  ctx.stroke();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Jumping Pod on the left
  const jx = cx - h * 0.35;
  const jy = cy;
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.ellipse(jx, jy + 8, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Airborne Jumper
  ctx.fillStyle = '#38BDF8';
  ctx.shadowColor = '#38BDF8';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(jx, jy - 10, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(jx, jy - 10, 3, 0, Math.PI * 2);
  ctx.fill();
}

// 26. Color Clash (G-15)
function drawColorClashArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(x, y, w, h);

  // 4x3 Grid of Painted Tiles
  const cols = 5;
  const rows = 4;
  const tw = w / cols;
  const th = h / rows;

  const tileColors = [
    '#EF4444', '#38BDF8', '#38BDF8', '#FACC15', '#10B981',
    '#EF4444', '#EF4444', '#38BDF8', '#FACC15', '#10B981',
    '#EF4444', '#10B981', '#10B981', '#FACC15', '#38BDF8',
    '#10B981', '#10B981', '#EF4444', '#FACC15', '#FACC15'
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const color = tileColors[idx % tileColors.length];
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + c * tw + 1, y + r * th + 1, tw - 2, th - 2);
    }
  }
  ctx.globalAlpha = 1.0;

  // Rover in Center
  const rx = x + w * 0.48;
  const ry = y + h * 0.52;
  ctx.save();
  ctx.translate(rx, ry);
  ctx.rotate(0.35);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(2, 2, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = '#FFFFFF';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(-12, -8, 24, 16, 4);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Front Roller
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(8, -9, 5, 18);

  ctx.restore();
}

// 27. Meteor Shield (G-17)
function drawMeteorShieldArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep Space
  ctx.fillStyle = '#020617';
  ctx.fillRect(x, y, w, h);

  // Tiny Stars
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + w * 0.15, y + h * 0.2, 1.5, 1.5);
  ctx.fillRect(x + w * 0.85, y + h * 0.3, 1.5, 1.5);
  ctx.fillRect(x + w * 0.3, y + h * 0.8, 1.5, 1.5);

  const px = x + w * 0.38;
  const py = y + h * 0.54;

  // Planet Core
  ctx.shadowColor = '#38BDF8';
  ctx.shadowBlur = 14;
  const pGrad = ctx.createRadialGradient(px - 4, py - 4, 2, px, py, 18);
  pGrad.addColorStop(0, '#FFFFFF');
  pGrad.addColorStop(0.5, '#38BDF8');
  pGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = pGrad;
  ctx.beginPath();
  ctx.arc(px, py, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Deflector Shield Arc
  ctx.shadowColor = '#67E8F9';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#67E8F9';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(px, py, 28, -Math.PI * 0.3, Math.PI * 0.3);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Incoming / Ricocheting Meteor
  const mx = x + w * 0.74;
  const my = y + h * 0.36;

  ctx.shadowColor = '#F97316';
  ctx.shadowBlur = 12;
  const mGrad = ctx.createRadialGradient(mx, my, 2, mx, my, 10);
  mGrad.addColorStop(0, '#FEF08A');
  mGrad.addColorStop(0.5, '#F97316');
  mGrad.addColorStop(1, '#9A3412');
  ctx.fillStyle = mGrad;
  ctx.beginPath();
  ctx.arc(mx, my, 8, 0, Math.PI * 2);
  ctx.fill();

  // Fire Trail
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.6)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.lineTo(mx + 16, my - 12);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// 28. Sequence Clash (G-30)
function drawSequenceClashArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Cyber Chamber
  ctx.fillStyle = '#090D16';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const padDist = 18;
  const padR = 11;

  // Outer Pulse Ring
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, h * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  // 4 Cyber Pads
  const pads = [
    { x: cx, y: cy - padDist, c: '#38BDF8', s: '▲' },
    { x: cx + padDist, y: cy, c: '#FACC15', s: '►' },
    { x: cx, y: cy + padDist, c: '#EC4899', s: '▼' },
    { x: cx - padDist, y: cy, c: '#4ADE80', s: '◄' }
  ];

  pads.forEach((p, idx) => {
    ctx.shadowColor = p.c;
    ctx.shadowBlur = idx === 0 ? 16 : 8; // Top pad active
    ctx.fillStyle = idx === 0 ? '#FFFFFF' : p.c;
    ctx.beginPath();
    ctx.roundRect(p.x - padR, p.y - padR, padR * 2, padR * 2, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = idx === 0 ? p.c : '#0F172A';
    ctx.font = 'bold 9px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.s, p.x, p.y + 3);
  });
}

// 29. Bubble Soccer (G-31)
function drawBubbleSoccerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Turf pitch
  const turf = ctx.createLinearGradient(x, y, x, y + h);
  turf.addColorStop(0, '#15803D');
  turf.addColorStop(1, '#166534');
  ctx.fillStyle = turf;
  ctx.fillRect(x, y, w, h);

  // Pitch white lines & center circle
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 10, y + 8, w - 20, h - 16);
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 20, 0, Math.PI * 2);
  ctx.stroke();

  // Soccer Ball in center
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 3, 0, Math.PI * 2);
  ctx.fill();

  // Bubble Suit 1 (Red)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.beginPath();
  ctx.arc(x + w * 0.32, y + h * 0.5, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.arc(x + w * 0.32, y + h * 0.5, 6, 0, Math.PI * 2);
  ctx.fill();

  // Bubble Suit 2 (Blue)
  ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.beginPath();
  ctx.arc(x + w * 0.68, y + h * 0.5, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.arc(x + w * 0.68, y + h * 0.5, 6, 0, Math.PI * 2);
  ctx.fill();
}

// 30. Wire Cutter (G-32)
function drawWireCutterArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Cyber Bomb Chassis
  ctx.fillStyle = '#1E1E2E';
  ctx.fillRect(x, y, w, h);

  // Digital LED Display in top
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.22, y + 10, w * 0.56, 22, 4);
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Digital countdown text
  ctx.fillStyle = '#EF4444';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('03:45', x + w * 0.5, y + 26);

  // 4 Colored Wires
  const wireColors = ['#EF4444', '#38BDF8', '#22C55E', '#EAB308'];
  const startY = y + 42;
  const wireSpacing = 11;

  wireColors.forEach((wc, i) => {
    const wy = startY + i * wireSpacing;
    ctx.strokeStyle = wc;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 16, wy);
    ctx.bezierCurveTo(x + w * 0.35, wy + (i % 2 === 0 ? -6 : 6), x + w * 0.65, wy + (i % 2 === 0 ? 6 : -6), x + w - 16, wy);
    ctx.stroke();
  });

  // Snip Tool Scissors Icon
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.52 - 6, y + h * 0.68 - 8);
  ctx.lineTo(x + w * 0.52 + 8, y + h * 0.68 + 8);
  ctx.moveTo(x + w * 0.52 + 8, y + h * 0.68 - 8);
  ctx.lineTo(x + w * 0.52 - 6, y + h * 0.68 + 8);
  ctx.stroke();
}

// 31. Magma Hop (G-33)
function drawMagmaHopArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Molten Lava background
  const lava = ctx.createLinearGradient(x, y, x, y + h);
  lava.addColorStop(0, '#7F1D1D');
  lava.addColorStop(0.5, '#B91C1C');
  lava.addColorStop(1, '#450A0A');
  ctx.fillStyle = lava;
  ctx.fillRect(x, y, w, h);

  // Basalt Pillar 1 (Left)
  ctx.fillStyle = '#1E1E24';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.28, y + h * 0.62, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4B5563';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Basalt Pillar 2 (Right, Cracking)
  ctx.fillStyle = '#2A1810';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.72, y + h * 0.62, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#F97316';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Fire Crystal on right pillar
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.72, y + h * 0.44);
  ctx.lineTo(x + w * 0.72 + 6, y + h * 0.51);
  ctx.lineTo(x + w * 0.72, y + h * 0.58);
  ctx.lineTo(x + w * 0.72 - 6, y + h * 0.51);
  ctx.closePath();
  ctx.fill();

  // Hopping Player Arc & Character
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.28, y + h * 0.6);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.24, x + w * 0.72, y + h * 0.6);
  ctx.stroke();
  ctx.setLineDash([]);

  // Player in mid air
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.32, 8, 0, Math.PI * 2);
  ctx.fill();
}

// 32. Rhythm Duel (G-34)
function drawRhythmDuelArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Synthwave gradient
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#090514');
  bg.addColorStop(0.6, '#200A38');
  bg.addColorStop(1, '#05020A');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  // Retrowave sun
  const sunGrad = ctx.createLinearGradient(0, y + 6, 0, y + 36);
  sunGrad.addColorStop(0, '#F43F5E');
  sunGrad.addColorStop(1, '#FBBF24');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + 24, 18, 0, Math.PI * 2);
  ctx.fill();

  // Highway lines
  ctx.strokeStyle = '#EC4899';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.25, y + 42);
  ctx.lineTo(x + w * 0.15, y + h);
  ctx.moveTo(x + w * 0.5, y + 42);
  ctx.lineTo(x + w * 0.5, y + h);
  ctx.moveTo(x + w * 0.75, y + 42);
  ctx.lineTo(x + w * 0.85, y + h);
  ctx.stroke();

  // Target Hit Line
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + h - 16);
  ctx.lineTo(x + w - 12, y + h - 16);
  ctx.stroke();

  // Diamond Notes
  const notes = [
    { nx: x + w * 0.32, ny: y + h - 34, c: '#38BDF8' },
    { nx: x + w * 0.68, ny: y + h - 16, c: '#FACC15' }
  ];

  notes.forEach((n) => {
    ctx.fillStyle = n.c;
    ctx.beginPath();
    ctx.moveTo(n.nx, n.ny - 6);
    ctx.lineTo(n.nx + 7, n.ny);
    ctx.lineTo(n.nx, n.ny + 6);
    ctx.lineTo(n.nx - 7, n.ny);
    ctx.closePath();
    ctx.fill();
  });
}

// 33. Cosmic Vortex (G-35)
function drawCosmicVortexArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep galactic void
  const bg = ctx.createRadialGradient(x + w * 0.5, y + h * 0.5, 5, x + w * 0.5, y + h * 0.5, w * 0.7);
  bg.addColorStop(0, '#1E1B4B');
  bg.addColorStop(0.5, '#0F172A');
  bg.addColorStop(1, '#030712');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Swirling accretion spiral arms
  ctx.save();
  ctx.translate(cx, cy);
  const spiralColors = ['#8B5CF6', '#EC4899', '#06B6D4', '#38BDF8'];
  for (let arm = 0; arm < 4; arm++) {
    ctx.rotate((Math.PI / 2) * arm);
    ctx.strokeStyle = spiralColors[arm % spiralColors.length];
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let theta = 0.5; theta < 3.8; theta += 0.15) {
      const r = theta * 11;
      const px = Math.cos(theta) * r;
      const py = Math.sin(theta) * r;
      if (theta === 0.5) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Black hole event horizon
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.shadowColor = '#C084FC';
  ctx.shadowBlur = 18;
  ctx.fill();

  // Glowing photon ring
  ctx.strokeStyle = '#F472B6';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Orbiting spacecraft
  const sx = Math.cos(1.2) * 36;
  const sy = Math.sin(1.2) * 36;
  ctx.translate(sx, sy);
  ctx.rotate(1.2 + Math.PI / 2);
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-5, -4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 34. Pixel Paintball (G-36)
function drawPixelPaintballArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Arena floor
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#1E293B');
  bg.addColorStop(1, '#0F172A');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  // Paint splatters on the floor
  const splats = [
    { sx: x + w * 0.28, sy: y + h * 0.35, r: 16, c: '#EC4899' },
    { sx: x + w * 0.72, sy: y + h * 0.65, r: 18, c: '#06B6D4' },
    { sx: x + w * 0.36, sy: y + h * 0.75, r: 12, c: '#FACC15' },
    { sx: x + w * 0.65, sy: y + h * 0.3, r: 14, c: '#10B981' }
  ];

  splats.forEach((s) => {
    ctx.fillStyle = s.c;
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, s.r, 0, Math.PI * 2);
    ctx.fill();
    // Splatter drips
    for (let d = 0; d < 4; d++) {
      const a = (d / 4) * Math.PI * 2 + 0.3;
      const dx = s.sx + Math.cos(a) * (s.r + 5);
      const dy = s.sy + Math.sin(a) * (s.r + 5);
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Paintball Blaster Cannon
  ctx.save();
  ctx.translate(x + w * 0.25, y + h * 0.55);
  ctx.rotate(-0.4);
  ctx.fillStyle = '#475569';
  ctx.fillRect(-14, -6, 28, 12);
  ctx.fillStyle = '#EC4899';
  ctx.fillRect(10, -4, 12, 8); // Barrel
  // Hopper on top
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(-2, -9, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Flying paint projectile with motion trail
  ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.42, y + h * 0.48);
  ctx.lineTo(x + w * 0.62, y + h * 0.38);
  ctx.stroke();

  ctx.fillStyle = '#EC4899';
  ctx.shadowColor = '#EC4899';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x + w * 0.62, y + h * 0.38, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// 35. Minefield Dash (G-37)
function drawMinefieldDashArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dark Cyber Tech Grid
  ctx.fillStyle = '#0B1120';
  ctx.fillRect(x, y, w, h);

  // Hex / Grid cells
  const cellSize = 22;
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.lineWidth = 1;
  for (let gx = x + 10; gx < x + w - 10; gx += cellSize) {
    for (let gy = y + 10; gy < y + h - 10; gy += cellSize) {
      ctx.strokeRect(gx, gy, cellSize, cellSize);
    }
  }

  // Active danger warning tiles
  const dangerTiles = [
    { tx: x + w * 0.35, ty: y + h * 0.4, count: '3', c: '#EF4444' },
    { tx: x + w * 0.58, ty: y + h * 0.35, count: '2', c: '#F59E0B' },
    { tx: x + w * 0.42, ty: y + h * 0.65, count: '1', c: '#38BDF8' }
  ];

  dangerTiles.forEach((dt) => {
    ctx.fillStyle = `${dt.c}33`;
    ctx.fillRect(dt.tx - 10, dt.ty - 10, 20, 20);
    ctx.strokeStyle = dt.c;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(dt.tx - 10, dt.ty - 10, 20, 20);

    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.fillStyle = dt.c;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dt.count, dt.tx, dt.ty);
  });

  // Glowing golden energy core in center
  const cx = x + w * 0.72;
  const cy = y + h * 0.5;
  ctx.fillStyle = '#FACC15';
  ctx.shadowColor = '#FACC15';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Running Hero Character
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(x + w * 0.22, y + h * 0.5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// 36. Asteroid Miner (G-38)
function drawAsteroidMinerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep Void background
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#0F172A');
  bg.addColorStop(1, '#05070D');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  // Distant stars
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  const starCoords = [
    [x + w * 0.15, y + h * 0.2],
    [x + w * 0.85, y + h * 0.18],
    [x + w * 0.35, y + h * 0.82],
    [x + w * 0.8, y + h * 0.78],
    [x + w * 0.5, y + h * 0.15]
  ];
  starCoords.forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Crystalline Asteroid
  const ax = x + w * 0.65;
  const ay = y + h * 0.45;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(18, -10);
  ctx.lineTo(24, 12);
  ctx.lineTo(6, 24);
  ctx.lineTo(-18, 16);
  ctx.lineTo(-24, -4);
  ctx.closePath();
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Mineral core
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#38BDF8';
  ctx.shadowColor = '#38BDF8';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();

  // Sparkling loose gems
  const gems = [
    { gx: x + w * 0.52, gy: y + h * 0.32, c: '#EF4444' },
    { gx: x + w * 0.75, gy: y + h * 0.72, c: '#10B981' },
    { gx: x + w * 0.48, gy: y + h * 0.65, c: '#FACC15' }
  ];
  gems.forEach((g) => {
    ctx.fillStyle = g.c;
    ctx.shadowColor = g.c;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(g.gx, g.gy - 4);
    ctx.lineTo(g.gx + 4, g.gy);
    ctx.lineTo(g.gx, g.gy + 4);
    ctx.lineTo(g.gx - 4, g.gy);
    ctx.closePath();
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  // Mining Tugboat Ship with Rotary Drill
  ctx.save();
  ctx.translate(x + w * 0.28, y + h * 0.52);
  ctx.rotate(0.35);

  // Thruster plume
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.moveTo(-16, -3);
  ctx.lineTo(-24, 0);
  ctx.lineTo(-16, 3);
  ctx.closePath();
  ctx.fill();

  // Ship body
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-12, -10);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Drill cone on bow
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(12, -5);
  ctx.lineTo(12, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// 37. Don't Look Down
function drawDontLookDownArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Vertigo sky gradient: deep dark void at bottom, starry dusk towards azure sky at top
  const skyGrad = ctx.createLinearGradient(x, y, x, y + h);
  skyGrad.addColorStop(0, '#0F172A');
  skyGrad.addColorStop(0.3, '#1E1B4B');
  skyGrad.addColorStop(0.7, '#312E81');
  skyGrad.addColorStop(1, '#020617');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(x, y, w, h);

  // Distant twinkling stars / altitude dust
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  const starOffsets = [
    [0.15, 0.12], [0.85, 0.18], [0.35, 0.25], [0.72, 0.08], [0.22, 0.45], [0.9, 0.55]
  ];
  for (const [sx, sy] of starOffsets) {
    ctx.fillRect(x + w * sx, y + h * sy, 1.5, 1.5);
  }

  // Vertical tower pillar silhouette in background
  ctx.fillStyle = '#090D16';
  ctx.fillRect(x + w * 0.38, y, w * 0.24, h);
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + w * 0.38, y, w * 0.24, h);

  // Tower summit beacon / crown at the top
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + 14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = '#FDE047';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + 14, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Staggered perilous floating platforms
  const platforms = [
    { px: 0.18, py: 0.82, pw: 0.32, ph: 7, color: '#38BDF8' },
    { px: 0.55, py: 0.64, pw: 0.28, ph: 7, color: '#06B6D4' },
    { px: 0.22, py: 0.46, pw: 0.25, ph: 7, color: '#10B981' },
    { px: 0.52, py: 0.28, pw: 0.26, ph: 7, color: '#F59E0B' },
    { px: 0.40, py: 0.12, pw: 0.20, ph: 6, color: '#EC4899' },
  ];

  for (const p of platforms) {
    const rx = x + w * p.px;
    const ry = y + h * p.py;
    const rw = w * p.pw;

    // Platform glow & base
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(rx, ry, rw, p.ph);
    // Neon top edge
    ctx.fillStyle = p.color;
    ctx.fillRect(rx, ry, rw, 2);
    // Platform underside bevel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(rx, ry + p.ph - 1.5, rw, 1.5);
  }

  // Altitude gauge ruler marks on left side
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  for (let i = 0; i < 6; i++) {
    const markY = y + 18 + i * ((h - 36) / 5);
    ctx.fillRect(x + 6, markY, (i % 2 === 0 ? 8 : 4), 1.5);
  }
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 9px Montserrat, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('320m', x + 16, y + 22);

  // Vertigo speed lines below player falling/jumping
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.42, y + h * 0.7);
  ctx.lineTo(x + w * 0.42, y + h * 0.95);
  ctx.moveTo(x + w * 0.58, y + h * 0.72);
  ctx.lineTo(x + w * 0.58, y + h * 0.92);
  ctx.stroke();
  ctx.setLineDash([]);

  // Jumper 1 (Red player in mid-leap leap curve towards upper platform)
  const jumperX = x + w * 0.40;
  const jumperY = y + h * 0.36;

  // Jump motion arc
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(jumperX - 10, jumperY + 12, 14, Math.PI * 0.8, 0, false);
  ctx.stroke();

  // Player 1 Orb
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(jumperX, jumperY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Player 2 (Cyan player resting on lower platform)
  const p2X = x + w * 0.32;
  const p2Y = y + h * 0.82 - 6;
  ctx.fillStyle = '#06B6D4';
  ctx.beginPath();
  ctx.arc(p2X, p2Y, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Warning exclamation sign / "NO CHECKPOINTS" indicator
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.70, y + h * 0.40, w * 0.24, 15, 3);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NO CHECKPOINTS', x + w * 0.82, y + h * 0.40 + 11);
}

// [G-40] Snowball Fight Thumbnail Art
function drawSnowballFightArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Arctic Winter Gradient
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, '#BAE6FD'); // Light sky blue
  bgGrad.addColorStop(0.5, '#E0F2FE'); // Soft ice
  bgGrad.addColorStop(1, '#F8FAFC'); // Fresh snow field
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // Background Snowy Pine Trees
  const tree1X = x + w * 0.48;
  const tree1Y = y + h * 0.38;
  ctx.fillStyle = '#15803D';
  ctx.beginPath();
  ctx.arc(tree1X, tree1Y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(tree1X, tree1Y - 4, 9, 0, Math.PI * 2);
  ctx.fill();

  // Left Snow Fort Block
  const fort1X = x + w * 0.22;
  const fort1Y = y + h * 0.58;
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(fort1X, fort1Y, 26, 28);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(fort1X, fort1Y, 26, 28);

  // Right Snow Fort Block
  const fort2X = x + w * 0.72;
  const fort2Y = y + h * 0.58;
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(fort2X, fort2Y, 26, 28);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(fort2X, fort2Y, 26, 28);

  // Player 1 (Red thrower on Left behind fort)
  const p1X = x + w * 0.16;
  const p1Y = y + h * 0.65;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(p1X, p1Y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Red Player Beanie & Scarf
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(p1X, p1Y - 4, 6, 0, Math.PI * 2);
  ctx.fill();

  // Aim trajectory line from P1
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(p1X, p1Y);
  ctx.quadraticCurveTo(x + w * 0.45, y + h * 0.25, x + w * 0.78, y + h * 0.62);
  ctx.stroke();
  ctx.setLineDash([]);

  // Flying Snowball in mid-arc
  const ballX = x + w * 0.48;
  const ballY = y + h * 0.32;
  // Drop shadow
  ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
  ctx.beginPath();
  ctx.ellipse(ballX, y + h * 0.62, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Snowball sphere
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(ballX, ballY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#93C5FD';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Player 2 (Blue player on Right getting splatted)
  const p2X = x + w * 0.84;
  const p2Y = y + h * 0.65;
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(p2X, p2Y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Splat on P2
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(p2X - 2, p2Y - 3, 6, 0, Math.PI * 2);
  ctx.fill();

  // Floating "SPLAT!" text badge
  ctx.fillStyle = '#0284C7';
  ctx.font = '900 9px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SPLAT!', p2X, p2Y - 14);

  // Snow particles
  ctx.fillStyle = '#FFFFFF';
  const flakes = [
    { fx: x + w * 0.1, fy: y + h * 0.2 },
    { fx: x + w * 0.3, fy: y + h * 0.15 },
    { fx: x + w * 0.65, fy: y + h * 0.22 },
    { fx: x + w * 0.85, fy: y + h * 0.18 },
    { fx: x + w * 0.5, fy: y + h * 0.78 }
  ];
  flakes.forEach((f) => {
    ctx.beginPath();
    ctx.arc(f.fx, f.fy, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

// 41. Highway Hop
function drawHighwayHopArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Safe Grass Top
  ctx.fillStyle = '#059669';
  ctx.fillRect(x, y, w, h * 0.22);

  // River Mid-Top
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(x, y + h * 0.22, w, h * 0.25);

  // Floating Log in River
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.35, y + h * 0.26, w * 0.42, h * 0.16, 5);
  ctx.fill();
  ctx.strokeStyle = '#451A03';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Highway Asphalt Mid-Bottom
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y + h * 0.47, w, h * 0.32);

  // Road Lane Divider Dashes
  ctx.fillStyle = '#FBBF24';
  for (let rx = x + 8; rx < x + w; rx += 22) {
    ctx.fillRect(rx, y + h * 0.62, 10, 2);
  }

  // Red Sports Car speeding left
  const carX = x + w * 0.62;
  const carY = y + h * 0.52;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.roundRect(carX, carY, 34, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#93C5FD';
  ctx.fillRect(carX + 4, carY + 2, 8, 10);
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(carX - 2, carY + 3, 2, 3);
  ctx.fillRect(carX - 2, carY + 8, 2, 3);

  // Safe Grass Bottom Start
  ctx.fillStyle = '#10B981';
  ctx.fillRect(x, y + h * 0.79, w, h * 0.21);

  // Hopper Chicken leaping upward
  const hopX = x + w * 0.28;
  const hopY = y + h * 0.68;

  // Hopper Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(hopX, hopY + 12, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Chicken Body
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(hopX, hopY, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(hopX - 3, hopY - 4, 3, 0, Math.PI * 2);
  ctx.arc(hopX + 3, hopY - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(hopX - 3, hopY - 5, 1.5, 0, Math.PI * 2);
  ctx.arc(hopX + 3, hopY - 5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.moveTo(hopX, hopY - 9);
  ctx.lineTo(hopX - 3, hopY - 6);
  ctx.lineTo(hopX + 3, hopY - 6);
  ctx.closePath();
  ctx.fill();
}

// 42. Gold Miner
function drawGoldMinerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Sky / surface grass
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h * 0.26);
  ctx.fillStyle = '#10B981';
  ctx.fillRect(x, y + h * 0.24, w, 4);

  // Subterranean Cavern
  const caveGrad = ctx.createLinearGradient(x, y + h * 0.26, x, y + h);
  caveGrad.addColorStop(0, '#292524');
  caveGrad.addColorStop(1, '#1C1917');
  ctx.fillStyle = caveGrad;
  ctx.fillRect(x, y + h * 0.26, w, h * 0.74);

  // Winch Shack on Surface
  const winchX = x + w * 0.48;
  const winchY = y + h * 0.22;
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(winchX - 12, winchY - 12, 24, 12);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(winchX - 12, winchY - 12, 24, 12);

  // Winch Pulley
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.arc(winchX, winchY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Angled Cable into Cavern
  const clawX = x + w * 0.35;
  const clawY = y + h * 0.64;
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(winchX, winchY);
  ctx.lineTo(clawX, clawY);
  ctx.stroke();

  // Mechanical Claw
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.arc(clawX, clawY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(clawX, clawY);
  ctx.lineTo(clawX - 6, clawY + 8);
  ctx.moveTo(clawX, clawY);
  ctx.lineTo(clawX + 6, clawY + 8);
  ctx.stroke();

  // Sparkling Diamond
  const diaX = clawX;
  const diaY = clawY + 12;
  ctx.fillStyle = '#67E8F9';
  ctx.beginPath();
  ctx.moveTo(diaX, diaY - 7);
  ctx.lineTo(diaX + 7, diaY);
  ctx.lineTo(diaX, diaY + 7);
  ctx.lineTo(diaX - 7, diaY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Large Gold Nugget in Cavern Corner
  const goldX = x + w * 0.76;
  const goldY = y + h * 0.72;
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(goldX, goldY, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(goldX - 4, goldY - 4, 4, 0, Math.PI * 2);
  ctx.fill();

  // TNT Barrel
  const tntX = x + w * 0.16;
  const tntY = y + h * 0.82;
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(tntX - 8, tntY - 10, 16, 20);
  ctx.strokeStyle = '#7F1D1D';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tntX - 8, tntY - 10, 16, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TNT', tntX, tntY + 3);
}

// 43. Chomp Frogs
function drawChompFrogsArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Lush Wetland Background
  ctx.fillStyle = '#064E3B';
  ctx.fillRect(x, y, w, h);

  // Circular Pond
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, w * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = '#0284C7';
  ctx.fill();
  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Water Ripple Rings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, w * 0.24, 0.4, 1.8);
  ctx.stroke();

  // Lily Pad Bank (Bottom-Left)
  const frogX = x + w * 0.24;
  const frogY = y + h * 0.72;
  ctx.fillStyle = '#15803D';
  ctx.beginPath();
  ctx.arc(frogX, frogY, 18, 0.3, Math.PI * 1.8);
  ctx.lineTo(frogX, frogY);
  ctx.fill();
  ctx.strokeStyle = '#14532D';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Target Dragonfly in Center Pond
  const bugX = x + w * 0.62;
  const bugY = y + h * 0.36;

  // Elastic Sticky Tongue extending towards dragonfly
  ctx.strokeStyle = '#F43F5E';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(frogX, frogY);
  ctx.lineTo(bugX, bugY);
  ctx.stroke();

  // Sticky Tip Bulb
  ctx.fillStyle = '#BE123C';
  ctx.beginPath();
  ctx.arc(bugX, bugY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Dragonfly Wings & Body
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(bugX - 6, bugY - 5, 7, 3, 0.4, 0, Math.PI * 2);
  ctx.ellipse(bugX + 6, bugY - 5, 7, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(bugX, bugY, 4, 0, Math.PI * 2);
  ctx.fill();

  // Frog Body
  ctx.fillStyle = '#22C55E';
  ctx.beginPath();
  ctx.ellipse(frogX, frogY, 13, 10, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Frog Eyes
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(frogX + 1, frogY - 8, 4, 0, Math.PI * 2);
  ctx.arc(frogX + 8, frogY - 3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(frogX + 2, frogY - 8, 2, 0, Math.PI * 2);
  ctx.arc(frogX + 9, frogY - 3, 2, 0, Math.PI * 2);
  ctx.fill();
}

// 44. Tug of War
function drawTugOfWarArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dark Arena
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  // Left Platform (Blue)
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y + h * 0.42, w * 0.36, h * 0.58);
  ctx.fillStyle = '#3B82F6';
  ctx.fillRect(x, y + h * 0.42, w * 0.36, 4);

  // Right Platform (Red)
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x + w * 0.64, y + h * 0.42, w * 0.36, h * 0.58);
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(x + w * 0.64, y + h * 0.42, w * 0.36, 4);

  // Center Mud Hazard Pit
  ctx.fillStyle = '#451A03';
  ctx.fillRect(x + w * 0.36, y + h * 0.42, w * 0.28, h * 0.58);
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.62, 10, 0, Math.PI * 2);
  ctx.fill();

  // Central Braided Rope
  const ropeY = y + h * 0.55;
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.12, ropeY);
  ctx.lineTo(x + w * 0.88, ropeY);
  ctx.stroke();
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center Red Ribbon Flag
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.48, ropeY - 5);
  ctx.lineTo(x + w * 0.54, ropeY + 2);
  ctx.lineTo(x + w * 0.48, ropeY + 9);
  ctx.closePath();
  ctx.fill();

  // Left Puller (Blue)
  const leftX = x + w * 0.22;
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(leftX, ropeY - 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Right Puller (Red)
  const rightX = x + w * 0.78;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(rightX, ropeY - 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Mini Rhythm Meter badge
  const barW = 34;
  const barH = 5;
  const barX = x + w * 0.5 - barW / 2;
  const barY = y + h * 0.24;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(barX + barW * 0.38, barY, barW * 0.24, barH);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(barX + barW * 0.5 - 1, barY - 2, 2, barH + 4);
}

// 45. Volley Spike
function drawVolleySpikeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Sunset Court Background
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, '#1E1B4B');
  bgGrad.addColorStop(0.5, '#7C3AED');
  bgGrad.addColorStop(1, '#F43F5E');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // Distant glowing sun
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.42, 22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.fill();

  // Beach sand floor
  ctx.fillStyle = '#D97706';
  ctx.fillRect(x, y + h * 0.82, w, h * 0.18);
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(x, y + h * 0.82, w, 3);

  // Center Net Post
  const netX = x + w * 0.5;
  const netTop = y + h * 0.48;
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(netX - 2, netTop, 4, y + h * 0.82 - netTop);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(netX - 3, netTop, 6, 4);

  // Net lattice
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  for (let ny = netTop + 6; ny < y + h * 0.82; ny += 6) {
    ctx.beginPath();
    ctx.moveTo(netX - 2, ny);
    ctx.lineTo(netX + 2, ny);
    ctx.stroke();
  }

  // Left Player (Blue) leaping to spike
  const p1X = x + w * 0.32;
  const p1Y = y + h * 0.52;
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(p1X, p1Y, 12, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Right Player (Red) on sand
  const p2X = x + w * 0.72;
  const p2Y = y + h * 0.82;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(p2X, p2Y, 11, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Spiked Volleyball with flame sparks
  const bX = x + w * 0.44;
  const bY = y + h * 0.38;
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(bX, bY, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(bX, bY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Downward spike motion streak
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bX, bY);
  ctx.lineTo(x + w * 0.62, y + h * 0.72);
  ctx.stroke();
}

// 46. Maze Escape
function drawMazeEscapeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dark Labyrinth Floor
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  // Procedural Corridor Walls
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x + w * 0.12, y + h * 0.15, w * 0.76, 5);
  ctx.fillRect(x + w * 0.12, y + h * 0.85, w * 0.76, 5);
  ctx.fillRect(x + w * 0.12, y + h * 0.15, 5, h * 0.7);
  ctx.fillRect(x + w * 0.88 - 5, y + h * 0.15, 5, h * 0.7);

  // Interior walls
  ctx.fillRect(x + w * 0.32, y + h * 0.15, 5, h * 0.42);
  ctx.fillRect(x + w * 0.5, y + h * 0.48, 5, h * 0.37);
  ctx.fillRect(x + w * 0.32, y + h * 0.65, w * 0.38, 5);
  ctx.fillRect(x + w * 0.68, y + h * 0.28, 5, h * 0.42);

  // Golden Star Relic in Center
  const relicX = x + w * 0.5;
  const relicY = y + h * 0.35;
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(relicX, relicY, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 8px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★', relicX, relicY + 3);

  // Cyan Gems in Corridors
  const gems = [
    { gx: x + w * 0.22, gy: y + h * 0.35 },
    { gx: x + w * 0.22, gy: y + h * 0.75 },
    { gx: x + w * 0.78, gy: y + h * 0.22 },
    { gx: x + w * 0.78, gy: y + h * 0.75 }
  ];
  ctx.fillStyle = '#38BDF8';
  for (const g of gems) {
    ctx.beginPath();
    ctx.arc(g.gx, g.gy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Runner Player (Green)
  const pX = x + w * 0.42;
  const pY = y + h * 0.45;
  ctx.fillStyle = '#22C55E';
  ctx.beginPath();
  ctx.arc(pX, pY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Minotaur Sentry (Red horns)
  const sX = x + w * 0.65;
  const sY = y + h * 0.78;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(sX, sY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7F1D1D';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#FBBF24';
  ctx.fillRect(sX - 5, sY - 9, 2, 4);
  ctx.fillRect(sX + 3, sY - 9, 2, 4);
}

// 47. Pinball Battle
function drawPinballBattleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dark Cyber Table
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(x, y, w, h);

  // Outer Neon Rails
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x + w * 0.12, y + h * 0.1, w * 0.76, h * 0.8);

  // Triangular Bumpers in Center
  const b1X = x + w * 0.38;
  const b1Y = y + h * 0.42;
  const b2X = x + w * 0.62;
  const b2Y = y + h * 0.42;
  const b3X = x + w * 0.5;
  const b3Y = y + h * 0.58;

  const drawMiniBumper = (bx: number, by: number, c: string) => {
    ctx.beginPath();
    ctx.arc(bx, by, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#1E293B';
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  };

  drawMiniBumper(b1X, b1Y, '#EF4444');
  drawMiniBumper(b2X, b2Y, '#3B82F6');
  drawMiniBumper(b3X, b3Y, '#F59E0B');

  // Bottom Flipper Paddle (Blue)
  const flipX = x + w * 0.5;
  const flipY = y + h * 0.84;
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.roundRect(flipX - 22, flipY - 3, 44, 7, 3);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Top Opponent Paddle (Red)
  const topX = x + w * 0.5;
  const topY = y + h * 0.16;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.roundRect(topX - 22, topY - 3, 44, 7, 3);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Steel Chrome Pinball rebounding off bumper
  const ballX = x + w * 0.46;
  const ballY = y + h * 0.7;
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Motion streak
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ballX, ballY);
  ctx.lineTo(ballX - 12, ballY + 14);
  ctx.stroke();
}

// 48. Mole Panic
function drawMolePanicArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Carnival Fairground Wood
  ctx.fillStyle = '#451A03';
  ctx.fillRect(x, y, w, h);

  // Burrows
  const burrows = [
    { bx: x + w * 0.3, by: y + h * 0.38 },
    { bx: x + w * 0.7, by: y + h * 0.38 },
    { bx: x + w * 0.3, by: y + h * 0.72 },
    { bx: x + w * 0.7, by: y + h * 0.72 }
  ];

  for (const b of burrows) {
    ctx.fillStyle = '#1C1917';
    ctx.beginPath();
    ctx.ellipse(b.bx, b.by, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Golden King Mole emerging from Top-Left Burrow
  const moleX = burrows[0].bx;
  const moleY = burrows[0].by - 8;
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(moleX, moleY, 10, Math.PI, 0, false);
  ctx.lineTo(moleX + 10, moleY + 6);
  ctx.lineTo(moleX - 10, moleY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Golden Crown
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.moveTo(moleX - 6, moleY - 9);
  ctx.lineTo(-4 + moleX, moleY - 5);
  ctx.lineTo(moleX, moleY - 9);
  ctx.lineTo(4 + moleX, moleY - 5);
  ctx.lineTo(6 + moleX, moleY - 9);
  ctx.lineTo(5 + moleX, moleY - 3);
  ctx.lineTo(-5 + moleX, moleY - 3);
  ctx.closePath();
  ctx.fill();

  // Squeaky Red Mallet swinging down on King Mole
  ctx.save();
  ctx.translate(moleX + 14, moleY - 14);
  ctx.rotate(-0.4);
  ctx.fillStyle = '#78350F';
  ctx.fillRect(-2, 0, 4, 22);
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.roundRect(-14, -14, 28, 14, 3);
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Squeak impact sparks
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(moleX + 6, moleY - 4, 3, 0, Math.PI * 2);
  ctx.fill();
}

// [G-49] Color Flood Art
function drawColorFloodArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4'];
  const cols = 6;
  const rows = 4;
  const cw = w / cols;
  const ch = h / rows;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const idx = (c * 2 + r * 3) % colors.length;
      ctx.fillStyle = colors[idx];
      ctx.fillRect(x + c * cw + 2, y + r * ch + 2, cw - 4, ch - 4);
    }
  }

  // Large corner territory flood banner
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, Math.PI / 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// [G-50] Memory Matrix Art
function drawMemoryMatrixArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(x, y, w, h);

  const cols = 3;
  const padSize = 22;
  const gap = 8;
  const totalW = cols * padSize + (cols - 1) * gap;
  const sx = x + (w - totalW) / 2;
  const sy = y + (h - totalW) / 2;

  const padCols = ['#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6'];

  for (let i = 0; i < 9; i++) {
    const c = i % 3;
    const r = Math.floor(i / 3);
    const px = sx + c * (padSize + gap);
    const py = sy + r * (padSize + gap);

    ctx.fillStyle = i === 4 ? '#FFFFFF' : padCols[i];
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, padSize, padSize, 4);
    else ctx.rect(px, py, padSize, padSize);
    ctx.fill();

    if (i === 4) {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

// [G-51] Snake Arena Art
function drawSnakeArenaArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  // Border
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);

  // Red Snake
  const redSegs = [
    { x: x + 25, y: y + 30 },
    { x: x + 40, y: y + 30 },
    { x: x + 55, y: y + 30 },
    { x: x + 55, y: y + 45 }
  ];
  ctx.fillStyle = '#EF4444';
  redSegs.forEach((seg, idx) => {
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, idx === 3 ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Blue Snake
  const blueSegs = [
    { x: x + w - 25, y: y + h - 30 },
    { x: x + w - 40, y: y + h - 30 },
    { x: x + w - 55, y: y + h - 30 }
  ];
  ctx.fillStyle = '#3B82F6';
  blueSegs.forEach((seg, idx) => {
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, idx === 2 ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Glowing Pellets
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(x + 75, y + 65, 5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-52] Mirror Laser Art
function drawMirrorLaserArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2;

  // Center emitter
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();

  // Angled Mirror
  ctx.save();
  ctx.translate(cx + 35, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(-12, -2, 24, 4);
  ctx.restore();

  // Laser beam hitting mirror and bouncing up
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 35, cy);
  ctx.lineTo(cx + 35, cy - 35);
  ctx.stroke();

  // Target core
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(cx + 35, cy - 35, 8, 0, Math.PI * 2);
  ctx.fill();
}

// [G-53] Domino Cascade Art
function drawDominoCascadeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  const startX = x + 20;
  const startY = y + h / 2;

  // Dominos falling along an S-curve
  for (let i = 0; i < 9; i++) {
    const dx = startX + i * 14;
    const dy = startY + Math.sin(i * 0.7) * 16;
    const isDown = i < 5;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(isDown ? 0.7 : 0);

    ctx.fillStyle = i === 4 ? '#F59E0B' : '#EF4444';
    ctx.fillRect(-3, -10, 6, 20);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, -10, 6, 20);

    ctx.restore();
  }
}

// [G-54] Water Balloon Art
function drawWaterBalloonArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  // Ground
  ctx.fillStyle = '#15803D';
  ctx.fillRect(x, y + h - 18, w, 18);

  // Central Fence
  ctx.fillStyle = '#78350F';
  ctx.fillRect(x + w / 2 - 4, y + h - 55, 8, 37);

  // Catapult on left
  ctx.fillStyle = '#451A03';
  ctx.fillRect(x + 20, y + h - 25, 20, 8);

  // Arc line
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x + 30, y + h - 25);
  ctx.quadraticCurveTo(x + w / 2, y + 15, x + w - 30, y + h - 25);
  ctx.stroke();
  ctx.setLineDash([]);

  // Flying Water Balloon
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.arc(x + w / 2 - 6, y + 30, 7, 0, Math.PI * 2);
  ctx.fill();
}

// [G-55] Sheep Dog Art
function drawSheepDogArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#14532D';
  ctx.fillRect(x, y, w, h);

  // Corner Pen
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + w - 40, y + 10, 30, 30);

  // Sheep (Fluffy white)
  const sheepList = [
    { sx: x + 45, sy: y + 35 },
    { sx: x + 65, sy: y + 42 },
    { sx: x + 55, sy: y + 55 }
  ];
  ctx.fillStyle = '#FFFFFF';
  for (const s of sheepList) {
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dog
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.ellipse(x + 25, y + 48, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bark wave
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + 25, y + 48, 18, -0.6, 0.6);
  ctx.stroke();
}

// [G-56] Chest Snatch Art
function drawChestSnatchArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2;

  // Chest Body
  ctx.fillStyle = '#78350F';
  ctx.fillRect(cx - 25, cy - 8, 50, 26);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 25, cy - 8, 50, 26);

  // Open Lid
  ctx.fillStyle = '#451A03';
  ctx.fillRect(cx - 25, cy - 26, 50, 12);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 25, cy - 26, 50, 12);

  // Sharp Teeth
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx - 20 + i * 11, cy - 14, 5, 6);
  }

  // Red Ruby in jaw
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-57] Rapid Drop 4 Art
function drawRapidDrop4Art(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  const gridW = 75;
  const gridH = 55;
  const gx = x + (w - gridW) / 2;
  const gy = y + (h - gridH) / 2 + 5;

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(gx, gy, gridW, gridH);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.strokeRect(gx, gy, gridW, gridH);

  // Matrix of tokens
  const rows = 4;
  const cols = 5;
  const cw = gridW / cols;
  const ch = gridH / rows;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const tx = gx + c * cw + cw / 2;
      const ty = gy + r * ch + ch / 2;

      let col = '#0B0F19';
      if (r === 3) col = c % 2 === 0 ? '#EF4444' : '#3B82F6';
      else if (r === 2 && c === 2) col = '#EF4444';

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// [G-58] Floor Painter Art
function drawFloorPainterArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  // Sinuous colored paint swathes
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 25);
  ctx.quadraticCurveTo(x + w / 2, y + 10, x + w - 20, y + 45);
  ctx.stroke();

  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(x + 20, y + h - 25);
  ctx.quadraticCurveTo(x + w / 2, y + h - 10, x + w - 10, y + 40);
  ctx.stroke();

  // Roller skater
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + w - 25, y + 42, 6, 0, Math.PI * 2);
  ctx.fill();
}

// [G-59] Dodgeball Blitz Art
function drawDodgeballBlitzArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#D97706';
  ctx.fillRect(x, y, w, h);

  // Court lines
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);

  ctx.strokeStyle = '#FBBF24';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 10);
  ctx.lineTo(x + w / 2, y + h - 10);
  ctx.stroke();

  // Red Dodgeball
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 12, 0, Math.PI * 2);
  ctx.fill();
}

// [G-60] Gravity Golf Art
function drawGravityGolfArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  // Central Planet with ring
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, 28, 8, 0.2, 0, Math.PI * 2);
  ctx.stroke();

  // Golf ball curving around
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + w * 0.78, y + h * 0.35, 4, 0, Math.PI * 2);
  ctx.fill();
}

// [G-61] Cyber Disc Art
function drawCyberDiscArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Tron cyber grid arena floor
  ctx.fillStyle = '#050814';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Perspective floor grid
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
  ctx.lineWidth = 1;
  for (let gx = -20; gx <= 20; gx += 10) {
    ctx.beginPath();
    ctx.moveTo(cx + gx * 0.4, cy - 14);
    ctx.lineTo(cx + gx * 1.6, y + h);
    ctx.stroke();
  }

  // Cyan Player Identity Disc (In flight)
  const d1X = cx - 8;
  const d1Y = cy;
  ctx.save();
  ctx.translate(d1X, d1Y);
  ctx.rotate(-0.3);

  // Outer neon glow ring
  ctx.strokeStyle = '#38bdf8';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner solid core ring
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // Cyan disc velocity light ribbon trail
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 8, cy + 12);
  ctx.quadraticCurveTo(cx - 16, cy + 8, d1X, d1Y);
  ctx.stroke();

  // Red Enemy Disc ricocheting on right
  const d2X = cx + 18;
  const d2Y = cy - 8;
  ctx.strokeStyle = '#ef4444';
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(d2X, d2Y, 12, 5, 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Impact Sparks
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(d2X + 6, d2Y - 2, 2, 0, Math.PI * 2);
  ctx.arc(d2X + 10, d2Y + 3, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-62] Sumo Spheres Art
function drawSumoSpheresArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(x, y, w, h);

  // Circular Tilting Arena
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Two spheres clashing
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(x + w / 2 - 10, y + h / 2, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(x + w / 2 + 10, y + h / 2, 9, 0, Math.PI * 2);
  ctx.fill();
}

// [G-63] Sky Gliders Art
function drawSkyGlidersArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#C2410C';
  ctx.fillRect(x, y, w, h);

  // Golden Ring
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x + w * 0.65, y + h * 0.45, 14, 20, 0, 0, Math.PI * 2);
  ctx.stroke();

  // White Paper Glider
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x + 25, y + h * 0.55);
  ctx.lineTo(x + 10, y + h * 0.45);
  ctx.lineTo(x + 14, y + h * 0.55);
  ctx.lineTo(x + 10, y + h * 0.65);
  ctx.closePath();
  ctx.fill();
}

// [G-64] Whack-A-Thief Art
function drawWhackAThiefArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Bank vault room
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Vault steel hatch rim
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy + 12, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy + 12, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sneaky Thief Raccoon popping out of hatch
  const rX = cx - 4;
  const rY = cy + 2;

  // Raccoon grey head & furry cheeks
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(rX, rY, 11, 0, Math.PI * 2);
  ctx.fill();

  // Pointed ears with pink inner
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(rX - 10, rY - 6); ctx.lineTo(rX - 14, rY - 16); ctx.lineTo(rX - 4, rY - 10);
  ctx.moveTo(rX + 10, rY - 6); ctx.lineTo(rX + 14, rY - 16); ctx.lineTo(rX + 4, rY - 10);
  ctx.fill();
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.moveTo(rX - 9, rY - 7); ctx.lineTo(rX - 12, rY - 14); ctx.lineTo(rX - 5, rY - 10);
  ctx.moveTo(rX + 9, rY - 7); ctx.lineTo(rX + 12, rY - 14); ctx.lineTo(rX + 5, rY - 10);
  ctx.fill();

  // Black bandit mask
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(rX, rY - 2, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Expressive white eyes & startled pupils
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(rX - 4, rY - 2, 3, 0, Math.PI * 2);
  ctx.arc(rX + 4, rY - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(rX - 3.5, rY - 3, 1.5, 0, Math.PI * 2);
  ctx.arc(rX + 4.5, rY - 3, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Black nose tip
  ctx.beginPath();
  ctx.arc(rX, rY + 4, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Loot sack with golden coins ($)
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(rX + 16, rY + 6, 8, 10, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', rX + 16, rY + 8);

  // Big Comic Whack Mallet swinging from upper left
  const mX = cx + 8;
  const mY = cy - 14;
  ctx.save();
  ctx.translate(mX, mY);
  ctx.rotate(0.45);

  // Wooden mallet handle
  ctx.fillStyle = '#92400e';
  ctx.fillRect(-3, -16, 6, 24);

  // Red heavy squeaky hammer head
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#f87171';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-14, 6, 28, 14, 3);
  else ctx.rect(-14, 6, 28, 14);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Yellow hammer face caps
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-14, 6, 4, 14);
  ctx.fillRect(10, 6, 4, 14);
  ctx.restore();

  // Comic impact speed lines
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - 14); ctx.lineTo(cx - 4, cy - 8);
  ctx.moveTo(cx + 6, cy - 16); ctx.lineTo(cx + 4, cy - 8);
  ctx.stroke();
}

// [G-65] Pixel Curling Art
function drawPixelCurlingArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#BAE6FD';
  ctx.fillRect(x, y, w, h);

  // House rings
  ctx.fillStyle = '#1D4ED8';
  ctx.beginPath();
  ctx.arc(x + w * 0.68, y + h / 2, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + w * 0.68, y + h / 2, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.arc(x + w * 0.68, y + h / 2, 10, 0, Math.PI * 2);
  ctx.fill();

  // Granite Curling Stone
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(x + 25, y + h / 2, 8, 0, Math.PI * 2);
  ctx.fill();
}

// [G-66] Bumper Boats Art
function drawBumperBoatsArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(x, y, w, h);

  // Whirlpool
  ctx.fillStyle = '#0369A1';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 22, 0, Math.PI * 2);
  ctx.fill();

  // Bumper Boat
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(x + w * 0.35, y + h * 0.45, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(x + w * 0.35, y + h * 0.45, 7, 0, Math.PI * 2);
  ctx.fill();
}

// [G-67] Target Sniper Art
function drawTargetSniperArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Carnival shooting booth background
  ctx.fillStyle = '#450a0a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Red and white awning stripes at top
  const stripeW = w / 6;
  for (let s = 0; s < 6; s++) {
    ctx.fillStyle = s % 2 === 0 ? '#dc2626' : '#f8fafc';
    ctx.fillRect(x + s * stripeW, y, stripeW, 8);
  }

  // Wooden counter ledge at bottom
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x, y + h - 12, w, 12);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(x, y + h - 12, w, 2);

  // Moving Mechanical Yellow Target Duck in center
  const dX = cx + 2;
  const dY = cy + 2;

  // Duck body
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(dX, dY, 13, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Duck head & bill
  ctx.beginPath();
  ctx.arc(dX + 8, dY - 6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(dX + 12, dY - 7);
  ctx.lineTo(dX + 19, dY - 5);
  ctx.lineTo(dX + 12, dY - 3);
  ctx.closePath();
  ctx.fill();

  // Duck eye
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(dX + 9, dY - 7, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Red Bullseye Star painted on duck chest
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(dX - 2, dY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(dX - 2, dY, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Precision Sniper Rifle Scope Crosshair
  ctx.strokeStyle = '#22c55e';
  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 1.8;

  // Outer crosshair ring
  ctx.beginPath();
  ctx.arc(cx - 2, cy, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Inner precision circle
  ctx.beginPath();
  ctx.arc(cx - 2, cy, 7, 0, Math.PI * 2);
  ctx.stroke();

  // Hashmark crosshairs
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy); ctx.lineTo(cx + 20, cy);
  ctx.moveTo(cx - 2, cy - 22); ctx.lineTo(cx - 2, cy + 22);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Center red laser lock dot
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx - 2, cy, 2, 0, Math.PI * 2);
  ctx.fill();
}

// [G-68] Fruit Chopper Art
function drawFruitChopperArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#451A03';
  ctx.fillRect(x, y, w, h);

  // Watermelon halves
  ctx.fillStyle = '#15803D';
  ctx.beginPath();
  ctx.arc(x + w / 2 - 8, y + h / 2, 12, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x + w / 2 + 8, y + h / 2, 12, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.fill();

  // Katana slash
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 10);
  ctx.lineTo(x + w - 10, y + h - 10);
  ctx.stroke();
}

// [G-67] Catapult Clash Art
function drawCatapultClashArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#2E3842';
  ctx.fillRect(x, y, w, h);

  // Distant castle wall
  ctx.fillStyle = '#455A64';
  ctx.fillRect(x + w * 0.65, y + h * 0.45, w * 0.35, h * 0.55);

  // Catapult base & arm
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(x + 10, y + h - 18, 30, 8);
  ctx.strokeStyle = '#D7CCC8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + h - 18);
  ctx.lineTo(x + 36, y + h * 0.4);
  ctx.stroke();

  // Flying boulder
  ctx.fillStyle = '#9E9E9E';
  ctx.beginPath();
  ctx.arc(x + w * 0.55, y + h * 0.35, 7, 0, Math.PI * 2);
  ctx.fill();
}

// [G-68] Jousting Knights Art
function drawJoustingKnightsArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1B262C';
  ctx.fillRect(x, y, w, h);

  // Wooden tilt divider rail
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(x, y + h * 0.55, w, 6);

  // Left red knight lance
  ctx.strokeStyle = '#E53935';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h * 0.45);
  ctx.lineTo(x + w * 0.55, y + h * 0.42);
  ctx.stroke();

  // Right blue knight lance
  ctx.strokeStyle = '#1E88E5';
  ctx.beginPath();
  ctx.moveTo(x + w - 10, y + h * 0.65);
  ctx.lineTo(x + w * 0.45, y + h * 0.68);
  ctx.stroke();
}

// [G-69] Dragon Tamer Art
function drawDragonTamerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#261C14';
  ctx.fillRect(x, y, w, h);

  // Baby dragon
  ctx.fillStyle = '#43A047';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 14, 0, Math.PI * 2);
  ctx.fill();

  // Dragon flame puff
  ctx.fillStyle = '#FF5722';
  ctx.beginPath();
  ctx.arc(x + w / 2 + 18, y + h / 2 - 2, 7, 0, Math.PI * 2);
  ctx.fill();

  // Tamer whistle waves
  ctx.strokeStyle = '#FFD54F';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + 14, y + h / 2, 10, -0.6, 0.6);
  ctx.stroke();
}

// [G-70] Castle Archer Art
function drawCastleArcherArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1A237E';
  ctx.fillRect(x, y, w, h);

  // Castle parapet battlement
  ctx.fillStyle = '#37474F';
  ctx.fillRect(x, y + h * 0.65, w, h * 0.35);

  // Drawn longbow & arrow
  ctx.strokeStyle = '#8D6E63';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x + w * 0.35, y + h * 0.45, 16, -1.2, 1.2);
  ctx.stroke();

  // Fired arrow
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.4, y + h * 0.45);
  ctx.lineTo(x + w * 0.8, y + h * 0.3);
  ctx.stroke();
}

// [G-71] Drawbridge Panic Art
function drawDrawbridgePanicArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  // Castle Moat Water
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(x, y + h * 0.7, w, h * 0.3);

  // Angled drawbridge plank
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h * 0.7);
  ctx.lineTo(x + w * 0.6, y + h * 0.45);
  ctx.stroke();

  // Iron chain
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(x + 8, y + h * 0.2);
  ctx.lineTo(x + w * 0.6, y + h * 0.45);
  ctx.stroke();
  ctx.setLineDash([]);
}

// [G-72] Blacksmith Forge Art
function drawBlacksmithForgeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1C1917';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.52;

  // Stone Hearth & Glowing Firebox
  ctx.fillStyle = '#292524';
  ctx.fillRect(x + 12, y + 16, w - 24, h * 0.45);
  const fireGrad = ctx.createRadialGradient(cx, y + h * 0.35, 4, cx, y + h * 0.35, 26);
  fireGrad.addColorStop(0, '#FEF08A');
  fireGrad.addColorStop(0.4, '#F97316');
  fireGrad.addColorStop(0.8, '#DC2626');
  fireGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
  ctx.fillStyle = fireGrad;
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.35, 26, 0, Math.PI * 2);
  ctx.fill();

  // Heavy Cast-Iron Anvil
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy + 2);
  ctx.lineTo(cx + 22, cy + 2);
  ctx.lineTo(cx + 28, cy + 8);
  ctx.lineTo(cx + 12, cy + 18);
  ctx.lineTo(cx + 18, cy + 28);
  ctx.lineTo(cx - 24, cy + 28);
  ctx.lineTo(cx - 16, cy + 18);
  ctx.lineTo(cx - 28, cy + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glowing Red-Hot Sword Blade on Anvil
  const bladeGrad = ctx.createLinearGradient(cx - 24, cy + 1, cx + 18, cy + 1);
  bladeGrad.addColorStop(0, '#FEF08A');
  bladeGrad.addColorStop(0.5, '#F97316');
  bladeGrad.addColorStop(1, '#EF4444');
  ctx.fillStyle = bladeGrad;
  ctx.fillRect(cx - 24, cy - 2, 42, 6);

  // Blacksmith Hammer Striking Downward
  ctx.save();
  ctx.translate(cx + 4, cy - 14);
  ctx.rotate(0.35);
  ctx.fillStyle = '#78350F';
  ctx.fillRect(-3, -22, 6, 22); // wooden handle
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(-10, -32, 20, 10); // steel hammer head
  ctx.restore();

  // Explosive Hammer Strike Spark Bursts
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(cx + 4, cy - 2, 3, 0, Math.PI * 2);
  ctx.arc(cx - 6, cy - 8, 2, 0, Math.PI * 2);
  ctx.arc(cx + 14, cy - 10, 2.5, 0, Math.PI * 2);
  ctx.arc(cx - 12, cy - 16, 2, 0, Math.PI * 2);
  ctx.arc(cx + 10, cy - 20, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

// [G-73] Potion Alchemist Art
function drawPotionAlchemistArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F0E1E';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.54;

  // Wooden Laboratory Shelf Table
  ctx.fillStyle = '#3E2723';
  ctx.fillRect(x + 8, cy + 16, w - 16, h * 0.3);
  ctx.strokeStyle = '#5D4037';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8, cy + 16, w - 16, h * 0.3);

  // Heavy Witch Cauldron
  ctx.fillStyle = '#18181B';
  ctx.beginPath();
  ctx.arc(cx - 12, cy + 6, 22, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#3F3F46';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Cauldron Glowing Purple Potion Surface
  ctx.fillStyle = '#A855F7';
  ctx.shadowColor = '#A855F7';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(cx - 12, cy + 6, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Rising Carbonated Magic Bubbles
  const bubbleColors = ['#C084FC', '#34D399', '#38BDF8'];
  for (let b = 0; b < 6; b++) {
    ctx.fillStyle = bubbleColors[b % bubbleColors.length];
    ctx.beginPath();
    ctx.arc(cx - 20 + b * 7, cy - 4 - (b % 3) * 10, 3 + (b % 2) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Emerald Glass Flask with Cork
  ctx.save();
  ctx.translate(cx + 24, cy);
  // Flask Glass Body
  ctx.fillStyle = 'rgba(16, 185, 129, 0.75)';
  ctx.beginPath();
  ctx.arc(0, 8, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6EE7B7';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Flask Neck & Cork
  ctx.fillStyle = '#065F46';
  ctx.fillRect(-3, -6, 6, 8);
  ctx.fillStyle = '#B45309';
  ctx.fillRect(-4, -10, 8, 4);
  ctx.restore();
}

// [G-74] Royal Feast Art
function drawRoyalFeastArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1C1917';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Royal Velvet Tablecloth with Gold Trim
  ctx.fillStyle = '#831843';
  ctx.fillRect(x + 6, cy + 12, w - 12, h * 0.4);
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(x + 6, cy + 12, w - 12, 3);

  // Large Polished Silver/Gold Platter
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Succulent Golden Roasted Turkey Feast
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#B45309';
  ctx.beginPath();
  ctx.ellipse(-2, -4, 18, 12, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Golden Glaze Highlight
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(-4, -6, 12, 6, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Drumstick Bone
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.rect(14, -6, 10, 5);
  ctx.arc(24, -7, 3, 0, Math.PI * 2);
  ctx.arc(24, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Golden Goblet of Wine
  ctx.save();
  ctx.translate(cx - 30, cy + 2);
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI);
  ctx.fill();
  ctx.fillRect(-2, 0, 4, 10);
  ctx.fillRect(-6, 10, 12, 3);
  ctx.fillStyle = '#BE123C';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// [G-75] Sword in Stone Art
function drawSwordInStoneArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#06101E';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.52;

  // Divine Beam of Celestial Light from the Heavens
  const lightGrad = ctx.createLinearGradient(cx, y, cx, cy + 18);
  lightGrad.addColorStop(0, 'rgba(254, 240, 138, 0.40)');
  lightGrad.addColorStop(1, 'rgba(254, 240, 138, 0.05)');
  ctx.fillStyle = lightGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 16, y);
  ctx.lineTo(cx + 16, y);
  ctx.lineTo(cx + 34, cy + 24);
  ctx.lineTo(cx - 34, cy + 24);
  ctx.closePath();
  ctx.fill();

  // Ancient Mossy Granite Boulder
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(cx - 36, cy + 28);
  ctx.lineTo(cx - 24, cy + 2);
  ctx.lineTo(cx + 8, cy);
  ctx.lineTo(cx + 34, cy + 12);
  ctx.lineTo(cx + 38, cy + 28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Excalibur Broadsword Embedded in Stone
  // Gleaming Steel Blade
  ctx.fillStyle = '#F8FAFC';
  ctx.shadowColor = '#67E8F9';
  ctx.shadowBlur = 8;
  ctx.fillRect(cx - 2.5, cy - 18, 5, 24);
  ctx.shadowBlur = 0;

  // Golden Ornate Crossguard
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(cx - 14, cy - 21, 28, 4);
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 14, cy - 21, 28, 4);

  // Leather Hilt Grip
  ctx.fillStyle = '#991B1B';
  ctx.fillRect(cx - 2, cy - 30, 4, 9);

  // Crowned Golden Pommel
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(cx, cy - 31, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Floating Runic Sparkles
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(cx - 18, cy - 8, 2, 0, Math.PI * 2);
  ctx.arc(cx + 20, cy - 14, 2.5, 0, Math.PI * 2);
  ctx.arc(cx - 8, cy - 26, 2, 0, Math.PI * 2);
  ctx.fill();
}

// [G-76] Dungeon Escape Art
function drawDungeonEscapeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.48;

  // Stone Dungeon Archway
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx, cy + 4, 34, Math.PI, 0);
  ctx.lineTo(cx + 34, y + h - 8);
  ctx.lineTo(cx - 34, y + h - 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Heavy Iron Spiked Portcullis Grille
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(cx - 28, cy - 16, 56, 38);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2.5;
  for (let px = cx - 22; px <= cx + 22; px += 11) {
    ctx.beginPath();
    ctx.moveTo(px, cy - 16);
    ctx.lineTo(px, cy + 22);
    ctx.stroke();
    // Bottom spike
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.moveTo(px - 3, cy + 22);
    ctx.lineTo(px, cy + 27);
    ctx.lineTo(px + 3, cy + 22);
    ctx.closePath();
    ctx.fill();
  }

  // Torches on Dungeon Pillars
  ctx.fillStyle = '#F59E0B';
  ctx.shadowColor = '#F59E0B';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx - 36, cy, 4, 0, Math.PI * 2);
  ctx.arc(cx + 36, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// [G-77] Neon Drifters Art
function drawNeonDriftersArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#090814';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.52;

  // Wet Asphalt Ground with Neon Reflections
  ctx.fillStyle = '#131124';
  ctx.fillRect(x + 4, y + h * 0.55, w - 8, h * 0.45);

  // Twin Neon Glowing Drift Skid Marks
  ctx.strokeStyle = '#EC4899';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#EC4899';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx - 8, cy + 8, 30, -0.6 * Math.PI, 0.45 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = '#06B6D4';
  ctx.shadowColor = '#06B6D4';
  ctx.beginPath();
  ctx.arc(cx - 8, cy + 8, 37, -0.6 * Math.PI, 0.45 * Math.PI);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Drifting Pink Sports Car
  ctx.save();
  ctx.translate(cx + 8, cy - 2);
  ctx.rotate(0.35);

  // Car Body
  ctx.fillStyle = '#F43F5E';
  ctx.fillRect(-18, -10, 36, 20);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(-6, -8, 12, 16); // windshield / roof

  // Cyan Neon Underglow
  ctx.fillStyle = '#06B6D4';
  ctx.shadowColor = '#06B6D4';
  ctx.shadowBlur = 10;
  ctx.fillRect(-16, -11, 32, 2);
  ctx.fillRect(-16, 9, 32, 2);
  ctx.shadowBlur = 0;

  // Glowing Headlight Beams
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(18, -6, 2.5, 0, Math.PI * 2);
  ctx.arc(18, 6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// [G-78] Hoverboard Rail Art
function drawHoverboardRailArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F0E1E';
  ctx.fillRect(x, y, w, h);

  // Magnetic rail
  ctx.strokeStyle = '#00E5FF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + h * 0.65);
  ctx.lineTo(x + w - 5, y + h * 0.65);
  ctx.stroke();

  // Hoverboard
  ctx.fillStyle = '#FF4081';
  ctx.fillRect(x + w * 0.4, y + h * 0.55, 20, 5);

  // Energy battery
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x + w * 0.75, y + h * 0.55, 5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-79] Traffic Jam Fury Art
function drawTrafficJamArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1E1E2F';
  ctx.fillRect(x, y, w, h);

  // Cyber lanes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.5, y + h);
  ctx.stroke();
  ctx.setLineDash([]);

  // Commuter traffic
  ctx.fillStyle = '#546E7A';
  ctx.fillRect(x + w * 0.25, y + 10, 12, 20);

  // Player racer
  ctx.fillStyle = '#1E88E5';
  ctx.fillRect(x + w * 0.65, y + h * 0.55, 14, 22);
}

// [G-80] Nitro Kart Arena Art
function drawNitroKartArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Asphalt race track arena
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Red and White Checkered Racing Curbs on outer turn
  const curbGrad = ctx.createLinearGradient(x, y, x + w, y);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x, y, w, 5);
  ctx.fillStyle = '#f8fafc';
  for (let c = 0; c < 8; c++) {
    if (c % 2 === 0) ctx.fillRect(x + c * (w / 8), y, w / 8, 5);
  }

  // Drift skid marks on track
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx - 6, cy + 18, 16, 2.8, 4.4);
  ctx.arc(cx + 8, cy + 14, 18, 2.8, 4.4);
  ctx.stroke();

  // Floating Holographic Question Mark Mystery Item Box
  const boxX = cx + 18;
  const boxY = cy - 10;
  ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
  ctx.shadowColor = '#eab308';
  ctx.shadowBlur = 8;
  ctx.fillRect(boxX - 6, boxY - 6, 12, 12);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(boxX - 6, boxY - 6, 12, 12);
  ctx.shadowBlur = 0;
  // Question Mark
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('?', boxX, boxY + 3);

  // Speeding Orange & Cyan Nitro Kart in mid-drift
  const kX = cx - 6;
  const kY = cy + 4;
  ctx.save();
  ctx.translate(kX, kY);
  ctx.rotate(-0.25);

  // Big racing rubber tires
  ctx.fillStyle = '#020617';
  ctx.fillRect(-14, -10, 6, 5); // Front Left
  ctx.fillRect(8, -10, 6, 5);  // Front Right
  ctx.fillRect(-16, 6, 7, 7);  // Rear Left
  ctx.fillRect(9, 6, 7, 7);   // Rear Right

  // Aerodynamic Kart Body (Vibrant Orange & Yellow)
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(0, -14); // Nose
  ctx.lineTo(8, -4);
  ctx.lineTo(8, 8);
  ctx.lineTo(-8, 8);
  ctx.lineTo(-8, -4);
  ctx.closePath();
  ctx.fill();

  // Kart racing stripe & spoiler
  ctx.fillStyle = '#fde047';
  ctx.fillRect(-2, -12, 4, 18);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(-10, 8, 20, 3); // Rear spoiler

  // Racer Helmet (Cyan)
  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.arc(0, -1, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#020617';
  ctx.fillRect(-2, -3, 4, 2); // Visor

  // Twin Nitro Exhaust Boost Plumes (Cyan / Violet Flames)
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(-5, 11); ctx.lineTo(-7, 21); ctx.lineTo(-3, 11);
  ctx.moveTo(3, 11); ctx.lineTo(5, 21); ctx.lineTo(7, 11);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// [G-81] Monorail Hijack Art
function drawMonorailHijackArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Cyberpunk metropolis night sky
  ctx.fillStyle = '#060614';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Distant glowing neon skyscraper skyline
  const buildings = [
    { bx: x + 8, bw: 14, bh: 26, col: '#1e1b4b', winCol: '#38bdf8' },
    { bx: x + 26, bw: 18, bh: 36, col: '#0f172a', winCol: '#f43f5e' },
    { bx: cx + 10, bw: 16, bh: 30, col: '#1e1b4b', winCol: '#facc15' },
    { bx: x + w - 24, bw: 16, bh: 22, col: '#0f172a', winCol: '#38bdf8' }
  ];
  for (const b of buildings) {
    ctx.fillStyle = b.col;
    ctx.fillRect(b.bx, cy - b.bh + 14, b.bw, b.bh);
    ctx.fillStyle = b.winCol;
    ctx.fillRect(b.bx + 3, cy - b.bh + 18, 2, 2);
    ctx.fillRect(b.bx + 8, cy - b.bh + 22, 2, 2);
    ctx.fillRect(b.bx + 3, cy - b.bh + 26, 2, 2);
  }

  // Glowing High-Speed Maglev Rail Track (Cyan/Blue)
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, cy + 18);
  ctx.lineTo(x + w, cy + 18);
  ctx.stroke();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Aerodynamic Bullet Monorail Train Car
  const trkY = cy + 4;
  // Train Car Body
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(x + 12, trkY + 12);
  ctx.lineTo(x + w - 16, trkY + 12);
  ctx.lineTo(x + w - 8, trkY + 4);
  ctx.lineTo(x + w - 18, trkY - 6);
  ctx.lineTo(x + 12, trkY - 6);
  ctx.closePath();
  ctx.fill();

  // Silver Rooftop & Aerodynamic nose cone
  ctx.fillStyle = '#64748b';
  ctx.fillRect(x + 12, trkY - 6, w - 30, 3);

  // Glowing Cyan Panoramic Window Ribbon
  ctx.fillStyle = '#00e5ff';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 6;
  ctx.fillRect(x + 16, trkY - 1, w - 34, 4);
  ctx.shadowBlur = 0;

  // Maglev speed motion streaks underneath
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 4, trkY + 14); ctx.lineTo(x + 22, trkY + 14);
  ctx.moveTo(x + 16, trkY + 16); ctx.lineTo(cx + 8, trkY + 16);
  ctx.stroke();

  // Agent / Infiltrator on train roof shooting grapple
  const agX = cx - 8;
  const agY = trkY - 6;
  ctx.fillStyle = '#f43f5e';
  // Head / Visor
  ctx.beginPath();
  ctx.arc(agX + 2, agY - 6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Crouched body
  ctx.fillRect(agX - 3, agY - 4, 8, 4);

  // High-Tech Grapple Cable extending up to overhead gantry
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(agX + 4, agY - 4);
  ctx.lineTo(cx + 18, y + 8);
  ctx.stroke();

  // Overhead Surveillance Gantry at top
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(cx + 12, y + 4, 14, 6);
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.arc(cx + 19, y + 10, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-82] Drone Delivery Art
function drawDroneDeliveryArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0A0A16';
  ctx.fillRect(x, y, w, h);

  // Drone body
  ctx.fillStyle = '#43A047';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.45, 8, 0, Math.PI * 2);
  ctx.fill();

  // Rotors
  ctx.strokeStyle = '#90A4AE';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h * 0.4);
  ctx.lineTo(x + w * 0.7, y + h * 0.5);
  ctx.stroke();

  // Package
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(x + w * 0.5 - 4, y + h * 0.55, 8, 8);
}

// [G-83] Rocket Skates Art
function drawRocketSkatesArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F0C20';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.52;

  // Cyber Halfpipe Ramp Curve
  ctx.strokeStyle = '#06B6D4';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#06B6D4';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h - 14);
  ctx.quadraticCurveTo(cx - 15, y + h - 14, cx + 25, y + 24);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // High-Top Sneaker Boot
  ctx.save();
  ctx.translate(cx - 4, cy - 8);
  ctx.rotate(-0.35);

  // Twin Rocket Thruster Chambers
  ctx.fillStyle = '#334155';
  ctx.fillRect(-18, 12, 32, 8);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-18, 12, 32, 8);

  // Twin Thruster Exhaust Flames
  const flameGrad = ctx.createLinearGradient(-18, 16, -38, 16);
  flameGrad.addColorStop(0, '#FFFFFF');
  flameGrad.addColorStop(0.3, '#FACC15');
  flameGrad.addColorStop(0.7, '#EF4444');
  flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(-18, 12);
  ctx.lineTo(-38, 16);
  ctx.lineTo(-18, 20);
  ctx.closePath();
  ctx.fill();

  // Sneaker Sole
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(-14, 6, 32, 6);

  // Sneaker Canvas Upper Body (Red with White Stripe)
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.lineTo(-14, -14);
  ctx.lineTo(-2, -14);
  ctx.lineTo(8, -2);
  ctx.lineTo(18, 6);
  ctx.closePath();
  ctx.fill();

  // White Racing Swoosh
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.quadraticCurveTo(2, -2, 16, 4);
  ctx.stroke();

  // Toe Cap
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(16, 6, 5, -Math.PI / 2, Math.PI / 2);
  ctx.fill();

  ctx.restore();

  // Speed Spark Particles
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(cx - 32, cy + 12, 2.5, 0, Math.PI * 2);
  ctx.arc(cx - 42, cy + 8, 1.8, 0, Math.PI * 2);
  ctx.arc(cx - 24, cy + 22, 2, 0, Math.PI * 2);
  ctx.fill();
}

// [G-84] Cyber Demolition Art
function drawCyberDemolitionArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.52;
  const cy = y + h * 0.5;

  // Hazard Caution Stripes on Floor
  ctx.save();
  ctx.fillStyle = '#EAB308';
  ctx.fillRect(x + 10, y + h - 16, w - 20, 10);
  ctx.fillStyle = '#0F172A';
  for (let s = x + 12; s < x + w - 12; s += 16) {
    ctx.beginPath();
    ctx.moveTo(s, y + h - 6);
    ctx.lineTo(s + 8, y + h - 16);
    ctx.lineTo(s + 12, y + h - 16);
    ctx.lineTo(s + 4, y + h - 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Steel Tower Frame
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 10);
  ctx.lineTo(x + 28, y + h - 18);
  ctx.moveTo(x + 18, y + 10);
  ctx.lineTo(cx, y + 16);
  ctx.stroke();

  // Swinging Steel Chain
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 10);
  ctx.quadraticCurveTo(cx - 15, y + 25, cx + 8, cy - 2);
  ctx.stroke();

  // Spiked Wrecking Ball
  ctx.save();
  ctx.translate(cx + 8, cy - 2);
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Spikes radiating
  ctx.fillStyle = '#E2E8F0';
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    const sx = Math.cos(a) * 18;
    const sy = Math.sin(a) * 18;
    const px = Math.cos(a) * 26;
    const py = Math.sin(a) * 26;
    ctx.beginPath();
    ctx.moveTo(sx - Math.sin(a) * 4, sy + Math.cos(a) * 4);
    ctx.lineTo(px, py);
    ctx.lineTo(sx + Math.sin(a) * 4, sy - Math.cos(a) * 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Smashing Concrete Debris / Sparks
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(cx + 36, cy + 8, 3, 0, Math.PI * 2);
  ctx.arc(cx + 42, cy - 6, 2, 0, Math.PI * 2);
  ctx.arc(cx + 32, cy - 18, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-85] Laser Speedway Art
function drawLaserSpeedwayArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#060714';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.38;

  // 3D Perspective Grid Speedway Road
  const roadTopW = 20;
  const roadBotW = w * 0.85;
  const roadBotY = y + h - 8;

  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.moveTo(cx - roadTopW, cy);
  ctx.lineTo(cx + roadTopW, cy);
  ctx.lineTo(cx + roadBotW / 2, roadBotY);
  ctx.lineTo(cx - roadBotW / 2, roadBotY);
  ctx.closePath();
  ctx.fill();

  // Glowing Neon Cyan & Pink Guardrail Lasers
  ctx.strokeStyle = '#06B6D4';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#06B6D4';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(cx - roadTopW, cy);
  ctx.lineTo(cx - roadBotW / 2, roadBotY);
  ctx.stroke();

  ctx.strokeStyle = '#EC4899';
  ctx.shadowColor = '#EC4899';
  ctx.beginPath();
  ctx.moveTo(cx + roadTopW, cy);
  ctx.lineTo(cx + roadBotW / 2, roadBotY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Center Dashed Dividing Laser
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, roadBotY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Red Anti-Grav Speeder
  ctx.save();
  ctx.translate(cx - 24, y + h * 0.68);
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.moveTo(-10, 10);
  ctx.lineTo(10, 10);
  ctx.lineTo(5, -12);
  ctx.lineTo(-5, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(-3, -8, 6, 8); // cockpit
  // Jet thrust flame
  ctx.fillStyle = '#F97316';
  ctx.fillRect(-6, 10, 12, 7);
  ctx.restore();

  // Cyan Rival Speeder
  ctx.save();
  ctx.translate(cx + 22, y + h * 0.58);
  ctx.fillStyle = '#0EA5E9';
  ctx.beginPath();
  ctx.moveTo(-8, 8);
  ctx.lineTo(8, 8);
  ctx.lineTo(4, -10);
  ctx.lineTo(-4, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FDE047';
  ctx.fillRect(-2, -6, 4, 6);
  // Jet flame
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(-5, 8, 10, 6);
  ctx.restore();
}

// [G-86] Gravity Pods Art
function drawGravityPodsArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#050714';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Concentric Wormhole Gravity Rings receding into depth
  const ringColors = ['#1E1B4B', '#312E81', '#4338CA', '#06B6D4', '#22D3EE'];
  for (let r = 5; r >= 1; r--) {
    const rad = r * 11;
    ctx.strokeStyle = ringColors[r - 1];
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rad * 1.35, rad * 0.85, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Center Graviton Core
  const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
  coreGrad.addColorStop(0, '#FFFFFF');
  coreGrad.addColorStop(0.5, '#38BDF8');
  coreGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();

  // Orbiting Golden Gravity Pod
  ctx.save();
  const podAngle = 0.75;
  const podX = cx + Math.cos(podAngle) * 44;
  const podY = cy + Math.sin(podAngle) * 28;
  ctx.translate(podX, podY);
  ctx.rotate(podAngle + Math.PI / 2);

  // Pod Hull
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Viewport Dome
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.arc(0, -1, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Ion thruster trail
  ctx.fillStyle = '#67E8F9';
  ctx.beginPath();
  ctx.moveTo(-4, 6);
  ctx.lineTo(0, 14);
  ctx.lineTo(4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// [G-87] Pancake Flipper Art
function drawPancakeFlipperArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#FFE0B2';
  ctx.fillRect(x, y, w, h);

  // Frying pan body
  ctx.fillStyle = '#37474F';
  ctx.beginPath();
  ctx.arc(x + w * 0.45, y + h * 0.55, 20, 0, Math.PI * 2);
  ctx.fill();

  // Handle
  ctx.strokeStyle = '#263238';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.45 + 16, y + h * 0.55 + 12);
  ctx.lineTo(x + w * 0.85, y + h * 0.85);
  ctx.stroke();

  // Golden pancake flipped in air
  ctx.fillStyle = '#FFA726';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.45, y + h * 0.32, 14, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Butter square
  ctx.fillStyle = '#FFF59D';
  ctx.fillRect(x + w * 0.45 - 3, y + h * 0.32 - 4, 6, 5);
}

// [G-88] Sushi Express Art
function drawSushiExpressArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1A237E';
  ctx.fillRect(x, y, w, h);

  // Conveyor belt track
  ctx.fillStyle = '#37474F';
  ctx.fillRect(x, y + h * 0.5 - 6, w, 16);
  ctx.strokeStyle = '#78909C';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.5 - 6);
  ctx.lineTo(x + w, y + h * 0.5 - 6);
  ctx.moveTo(x, y + h * 0.5 + 10);
  ctx.lineTo(x + w, y + h * 0.5 + 10);
  ctx.stroke();

  // Ceramic plate
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.52, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sushi roll
  ctx.fillStyle = '#1B5E20';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ECEFF1';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FF5722';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-89] Pizza Toss Art
function drawPizzaTossArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#BF360C';
  ctx.fillRect(x, y, w, h);

  // Wood oven brick arch
  ctx.strokeStyle = '#E64A19';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);

  // Spinning pizza crust
  ctx.fillStyle = '#FFE082';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.48, 22, 14, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Sauce & toppings
  ctx.fillStyle = '#D32F2F';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.48, 17, 10, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFF9C4';
  ctx.beginPath();
  ctx.arc(x + w * 0.45, y + h * 0.46, 3, 0, Math.PI * 2);
  ctx.arc(x + w * 0.55, y + h * 0.5, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-90] Burger Stack Art
function drawBurgerStackArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#FFF8E1';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  // Plate
  ctx.fillStyle = '#ECEFF1';
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.78, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bottom bun
  ctx.fillStyle = '#D7CCC8';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cx - 16, y + h * 0.65, 32, 7, 3) : ctx.rect(cx - 16, y + h * 0.65, 32, 7);
  ctx.fill();

  // Patty
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(cx - 17, y + h * 0.56, 34, 6);

  // Cheese slice
  ctx.fillStyle = '#FFC107';
  ctx.fillRect(cx - 18, y + h * 0.51, 36, 4);

  // Lettuce
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(cx - 17, y + h * 0.45, 34, 5);

  // Top bun
  ctx.fillStyle = '#D7CCC8';
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.38, 17, 9, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

// [G-91] Ice Cream Scoop Art
function drawIceCreamScoopArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#E1F5FE';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  // Waffle cone
  ctx.fillStyle = '#D7CCC8';
  ctx.beginPath();
  ctx.moveTo(cx - 12, y + h * 0.55);
  ctx.lineTo(cx + 12, y + h * 0.55);
  ctx.lineTo(cx, y + h * 0.88);
  ctx.closePath();
  ctx.fill();

  // Bottom scoop (mint)
  ctx.fillStyle = '#81C784';
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.52, 13, 0, Math.PI * 2);
  ctx.fill();

  // Middle scoop (vanilla)
  ctx.fillStyle = '#FFF9C4';
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.4, 12, 0, Math.PI * 2);
  ctx.fill();

  // Top scoop (strawberry)
  ctx.fillStyle = '#F06292';
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.28, 11, 0, Math.PI * 2);
  ctx.fill();

  // Cherry on top
  ctx.fillStyle = '#C2185B';
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.18, 4, 0, Math.PI * 2);
  ctx.fill();
}

// [G-92] Wok Stir Fry Art
function drawWokStirFryArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#212121';
  ctx.fillRect(x, y, w, h);

  // Fire glow
  ctx.fillStyle = '#FF5722';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.75, 18, 0, Math.PI);
  ctx.fill();

  // Cast iron wok
  ctx.fillStyle = '#424242';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.55, 24, 0, Math.PI);
  ctx.fill();

  // Flying stir fry veggies / noodles
  ctx.fillStyle = '#FF9800';
  ctx.fillRect(x + w * 0.38, y + h * 0.32, 10, 4);
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(x + w * 0.54, y + h * 0.28, 8, 5);
  ctx.fillStyle = '#E53935';
  ctx.fillRect(x + w * 0.46, y + h * 0.38, 7, 4);
}

// [G-93] Donut Glazer Art
function drawDonutGlazerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#FCE4EC';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Donut dough
  ctx.fillStyle = '#FFB74D';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();

  // Center hole
  ctx.fillStyle = '#FCE4EC';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  // Pink glaze
  ctx.fillStyle = '#EC407A';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FCE4EC';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  // Sprinkles
  ctx.fillStyle = '#FFEB3B';
  ctx.fillRect(cx - 10, cy - 8, 4, 2);
  ctx.fillStyle = '#00E5FF';
  ctx.fillRect(cx + 6, cy - 6, 4, 2);
  ctx.fillStyle = '#76FF03';
  ctx.fillRect(cx - 4, cy + 8, 4, 2);
}

// [G-94] Fruit Blender Art
function drawFruitBlenderArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#E0F7FA';
  ctx.fillRect(x, y, w, h);

  // Blender base
  ctx.fillStyle = '#37474F';
  ctx.fillRect(x + w * 0.35, y + h * 0.72, w * 0.3, h * 0.2);

  // Glass pitcher
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.33, y + h * 0.22);
  ctx.lineTo(x + w * 0.67, y + h * 0.22);
  ctx.lineTo(x + w * 0.62, y + h * 0.72);
  ctx.lineTo(x + w * 0.38, y + h * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#90A4AE';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Smoothie vortex inside
  ctx.fillStyle = '#E91E63';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.5, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
}

// [G-95] Teppanyaki Catch Art
function drawTeppanyakiCatchArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#263238';
  ctx.fillRect(x, y, w, h);

  // Steel griddle surface
  ctx.fillStyle = '#607D8B';
  ctx.fillRect(x + 8, y + h * 0.6, w - 16, h * 0.3);

  // Chef's bowl
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.arc(x + w * 0.35, y + h * 0.55, 12, 0, Math.PI);
  ctx.fill();

  // Grilled shrimp arched in air
  ctx.fillStyle = '#FF7043';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.6, y + h * 0.32, 9, 5, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Sizzle vapor lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.65, y + h * 0.58);
  ctx.lineTo(x + w * 0.68, y + h * 0.48);
  ctx.stroke();
}

// [G-96] Popcorn Popper Art
function drawPopcornPopperArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#212121';
  ctx.fillRect(x, y, w, h);

  // Popper kettle
  ctx.fillStyle = '#D32F2F';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.68, 16, 0, Math.PI);
  ctx.fill();

  // Popcorn kernels bursting
  ctx.fillStyle = '#FFF59D';
  ctx.beginPath();
  ctx.arc(x + w * 0.38, y + h * 0.36, 5, 0, Math.PI * 2);
  ctx.arc(x + w * 0.5, y + h * 0.26, 6, 0, Math.PI * 2);
  ctx.arc(x + w * 0.64, y + h * 0.38, 5, 0, Math.PI * 2);
  ctx.fill();

  // Butter sparks
  ctx.fillStyle = '#FFB300';
  ctx.beginPath();
  ctx.arc(x + w * 0.45, y + h * 0.46, 2.5, 0, Math.PI * 2);
  ctx.arc(x + w * 0.56, y + h * 0.48, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-97] Submarine Torpedo Art
function drawSubmarineTorpedoArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#001E3D';
  ctx.fillRect(x, y, w, h);

  // Submarine hull
  ctx.fillStyle = '#00E5FF';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.42, y + h * 0.52, 22, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Conning tower
  ctx.fillStyle = '#00B4D8';
  ctx.fillRect(x + w * 0.4, y + h * 0.35, 6, 7);

  // Propeller bubbles
  ctx.fillStyle = '#81D4FA';
  ctx.beginPath();
  ctx.arc(x + w * 0.16, y + h * 0.52, 3, 0, Math.PI * 2);
  ctx.arc(x + w * 0.11, y + h * 0.49, 2, 0, Math.PI * 2);
  ctx.fill();

  // Torpedo speeding right
  ctx.fillStyle = '#FF5252';
  ctx.fillRect(x + w * 0.72, y + h * 0.5, 12, 4);
}

// [G-98] Jellyfish Jump Art
function drawJellyfishJumpArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#000B18';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.55;

  // Bioluminescent dome
  ctx.fillStyle = '#E040FB';
  ctx.beginPath();
  ctx.arc(cx, cy, 20, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Tentacles
  ctx.strokeStyle = '#E040FB';
  ctx.lineWidth = 1.8;
  for (let t = -14; t <= 14; t += 7) {
    ctx.beginPath();
    ctx.moveTo(cx + t, cy);
    ctx.quadraticCurveTo(cx + t + 4, cy + 12, cx + t, cy + 22);
    ctx.stroke();
  }

  // Little diver above
  ctx.fillStyle = '#00E5FF';
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.25, 6, 0, Math.PI * 2);
  ctx.fill();
}

// [G-99] Pearl Divers Art
function drawPearlDiversArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#006064';
  ctx.fillRect(x, y, w, h);

  // Sand floor
  ctx.fillStyle = '#C2B280';
  ctx.fillRect(x, y + h * 0.82, w, h * 0.18);

  const cx = x + w * 0.5;
  const cy = y + h * 0.72;

  // Open clam shell
  ctx.fillStyle = '#5D4037';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI);
  ctx.fill();

  // Golden pearl inside
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 7, 0, Math.PI * 2);
  ctx.fill();

  // Diver descending
  ctx.fillStyle = '#FF1744';
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.32, 6, 12, 0, 0, Math.PI * 2);
  ctx.fill();
}

// [G-100] Shark Bait Art
function drawSharkBaitArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0277BD';
  ctx.fillRect(x, y, w, h);

  // Inflatable raft
  ctx.fillStyle = '#FF5252';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.38, y + h * 0.5, 18, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#263238';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.38, y + h * 0.5, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shark fin circling
  ctx.fillStyle = '#263238';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.8, y + h * 0.52);
  ctx.lineTo(x + w * 0.7, y + h * 0.32);
  ctx.lineTo(x + w * 0.68, y + h * 0.52);
  ctx.closePath();
  ctx.fill();
}

// [G-101] Sunken Treasure Art
function drawSunkenTreasureArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#004D40';
  ctx.fillRect(x, y, w, h);

  // Seabed
  ctx.fillStyle = '#A1887F';
  ctx.fillRect(x, y + h * 0.84, w, h * 0.16);

  // Gold chest
  ctx.fillStyle = '#FFB300';
  ctx.fillRect(x + w * 0.4, y + h * 0.65, 24, 16);
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(x + w * 0.42, y + h * 0.67, 20, 12);

  // Winch hook descending
  ctx.strokeStyle = '#ECEFF1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.52, y);
  ctx.lineTo(x + w * 0.52, y + h * 0.52);
  ctx.stroke();

  ctx.fillStyle = '#B0BEC5';
  ctx.beginPath();
  ctx.arc(x + w * 0.52, y + h * 0.52, 4, 0, Math.PI * 2);
  ctx.fill();
}

// [G-102] Octopus Ink Art
function drawOctopusInkArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#001020';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Curling tentacle
  ctx.strokeStyle = '#D81B60';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 1.4);
  ctx.stroke();

  // Ink cloud puff
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.arc(cx - 10, cy - 6, 16, 0, Math.PI * 2);
  ctx.fill();

  // Yellow eye
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(cx + 6, cy + 4, 4, 0, Math.PI * 2);
  ctx.fill();
}

// [G-103] Crab Walk Art
function drawCrabWalkArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#FFE082';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.65;

  // Crab body
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 18, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Claws
  ctx.beginPath();
  ctx.arc(cx - 20, cy - 8, 6, 0, Math.PI * 2);
  ctx.arc(cx + 20, cy - 8, 6, 0, Math.PI * 2);
  ctx.fill();

  // Seashell above
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.28, 8, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

// [G-104] Electric Eel Art
function drawElectricEelArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#050D1A';
  ctx.fillRect(x, y, w, h);

  // Electrical arc pylons
  ctx.fillStyle = '#455A64';
  ctx.beginPath();
  ctx.arc(x + w * 0.35, y + h * 0.5, 7, 0, Math.PI * 2);
  ctx.arc(x + w * 0.65, y + h * 0.5, 7, 0, Math.PI * 2);
  ctx.fill();

  // Lightning spark
  ctx.strokeStyle = '#FFEB3B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + h * 0.5);
  ctx.lineTo(x + w * 0.45, y + h * 0.42);
  ctx.lineTo(x + w * 0.55, y + h * 0.58);
  ctx.lineTo(x + w * 0.65, y + h * 0.5);
  ctx.stroke();
}

// [G-105] Water Scooter Art
function drawWaterScooterArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#00BCD4';
  ctx.fillRect(x, y, w, h);

  // White foam wake
  ctx.fillStyle = '#E0F7FA';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.15, y + h * 0.65);
  ctx.lineTo(x + w * 0.4, y + h * 0.5);
  ctx.lineTo(x + w * 0.15, y + h * 0.35);
  ctx.fill();

  // Jet-ski pointed hull
  ctx.fillStyle = '#FF1744';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.65, y + h * 0.5);
  ctx.lineTo(x + w * 0.35, y + h * 0.38);
  ctx.lineTo(x + w * 0.35, y + h * 0.62);
  ctx.closePath();
  ctx.fill();

  // Green slalom buoy
  ctx.fillStyle = '#00E676';
  ctx.beginPath();
  ctx.arc(x + w * 0.78, y + h * 0.35, 8, 0, Math.PI * 2);
  ctx.fill();
}

// [G-106] Deep Sea Harpoon Art
function drawDeepSeaHarpoonArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#020C1B';
  ctx.fillRect(x, y, w, h);

  // Flashlight beam
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.75);
  ctx.lineTo(x + w * 0.85, y + h * 0.2);
  ctx.lineTo(x + w * 0.85, y + h * 0.6);
  ctx.closePath();
  ctx.fill();

  // Glowing neon squid
  ctx.fillStyle = '#E040FB';
  ctx.beginPath();
  ctx.arc(x + w * 0.65, y + h * 0.38, 8, 0, Math.PI * 2);
  ctx.fill();

  // Harpoon spear
  ctx.strokeStyle = '#00E5FF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.25, y + h * 0.7);
  ctx.lineTo(x + w * 0.48, y + h * 0.5);
  ctx.stroke();
}

// [G-107] Moon Lander Art
function drawMoonLanderArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#060A14';
  ctx.fillRect(x, y, w, h);

  // Lunar surface
  ctx.fillStyle = '#263238';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 1.5, h * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Landing pad
  ctx.fillStyle = '#00E5FF';
  ctx.fillRect(x + w * 0.35, y + h * 0.75, w * 0.3, 4);

  // Lander
  const lx = x + w * 0.5;
  const ly = y + h * 0.45;
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.moveTo(lx, ly - 10);
  ctx.lineTo(lx + 8, ly + 6);
  ctx.lineTo(lx - 8, ly + 6);
  ctx.closePath();
  ctx.fill();

  // Exhaust
  ctx.fillStyle = '#FFEB3B';
  ctx.beginPath();
  ctx.moveTo(lx - 4, ly + 6);
  ctx.lineTo(lx + 4, ly + 6);
  ctx.lineTo(lx, ly + 14);
  ctx.closePath();
  ctx.fill();
}

// [G-108] Space Junk Salvage Art
function drawSpaceJunkSalvageArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#070A18';
  ctx.fillRect(x, y, w, h);

  // Salvage depot
  ctx.fillStyle = '#00E676';
  ctx.beginPath();
  ctx.arc(x + w * 0.2, y + h * 0.5, 12, 0, Math.PI * 2);
  ctx.fill();

  // Tractor beam cone
  ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.7, y + h * 0.5);
  ctx.lineTo(x + w * 0.35, y + h * 0.35);
  ctx.lineTo(x + w * 0.35, y + h * 0.65);
  ctx.closePath();
  ctx.fill();

  // Floating scrap metal
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(x + w * 0.45, y + h * 0.46, 8, 8);

  // Tug
  ctx.fillStyle = '#1E88E5';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.65, y + h * 0.5);
  ctx.lineTo(x + w * 0.8, y + h * 0.4);
  ctx.lineTo(x + w * 0.8, y + h * 0.6);
  ctx.closePath();
  ctx.fill();
}

// [G-109] Alien Probe Art
function drawAlienProbeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#080E18';
  ctx.fillRect(x, y, w, h);

  // Red defense laser beam
  ctx.strokeStyle = '#FF1744';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h * 0.2);
  ctx.lineTo(x + w * 0.9, y + h * 0.8);
  ctx.stroke();

  // Saucer
  const sx = x + w * 0.5;
  const sy = y + h * 0.45;
  ctx.fillStyle = '#455A64';
  ctx.beginPath();
  ctx.ellipse(sx, sy, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dome
  ctx.fillStyle = '#43A047';
  ctx.beginPath();
  ctx.arc(sx, sy - 3, 6, Math.PI, 0);
  ctx.fill();

  // Data crystal
  ctx.fillStyle = '#00E5FF';
  ctx.beginPath();
  ctx.arc(x + w * 0.3, y + h * 0.7, 5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-110] Solar Flare Art
function drawSolarFlareArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#180603';
  ctx.fillRect(x, y, w, h);

  // Solar flare corona
  ctx.fillStyle = '#FF5722';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 1.3, h * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Radiant wave arc
  ctx.strokeStyle = '#FFD54F';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 1.3, h * 0.8, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  // Solar Sail Diamond
  const sx = x + w * 0.5;
  const sy = y + h * 0.4;
  ctx.fillStyle = '#FFEB3B';
  ctx.beginPath();
  ctx.moveTo(sx, sy - 14);
  ctx.lineTo(sx + 14, sy);
  ctx.lineTo(sx, sy + 8);
  ctx.lineTo(sx - 14, sy);
  ctx.closePath();
  ctx.fill();
}

// [G-111] Wormhole Leap Art
function drawWormholeLeapArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0A0515';
  ctx.fillRect(x, y, w, h);

  // Cyan Portal
  ctx.fillStyle = '#00E5FF';
  ctx.beginPath();
  ctx.arc(x + w * 0.28, y + h * 0.45, 14, 0, Math.PI * 2);
  ctx.fill();

  // Magenta Portal
  ctx.fillStyle = '#E040FB';
  ctx.beginPath();
  ctx.arc(x + w * 0.72, y + h * 0.55, 14, 0, Math.PI * 2);
  ctx.fill();

  // Warp streak
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.28, y + h * 0.45);
  ctx.lineTo(x + w * 0.72, y + h * 0.55);
  ctx.stroke();
  ctx.setLineDash([]);
}

// [G-112] Astro Miner Art
function drawAstroMinerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0B0D13';
  ctx.fillRect(x, y, w, h);

  // Asteroid Geode
  const ax = x + w * 0.65;
  const ay = y + h * 0.45;
  ctx.fillStyle = '#424242';
  ctx.beginPath();
  ctx.arc(ax, ay, 18, 0, Math.PI * 2);
  ctx.fill();

  // Ruby crystal
  ctx.fillStyle = '#FF1744';
  ctx.beginPath();
  ctx.arc(ax, ay, 8, 0, Math.PI * 2);
  ctx.fill();

  // Mining laser
  ctx.strokeStyle = '#FFCC80';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.25, y + h * 0.65);
  ctx.lineTo(ax - 12, ay + 6);
  ctx.stroke();

  // Miner
  ctx.fillStyle = '#FB8C00';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h * 0.6);
  ctx.lineTo(x + w * 0.15, y + h * 0.52);
  ctx.lineTo(x + w * 0.15, y + h * 0.72);
  ctx.closePath();
  ctx.fill();
}

// [G-113] Nebula Drift Art
function drawNebulaDriftArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#080512';
  ctx.fillRect(x, y, w, h);

  // Nebula cloud
  const grad = ctx.createRadialGradient(x + w * 0.5, y + h * 0.5, 4, x + w * 0.5, y + h * 0.5, 35);
  grad.addColorStop(0, 'rgba(124, 77, 255, 0.5)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 35, 0, Math.PI * 2);
  ctx.fill();

  // Waypoint ring
  ctx.strokeStyle = '#00E5FF';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x + w * 0.65, y + h * 0.4, 15, 0, Math.PI * 2);
  ctx.stroke();

  // Drifting craft
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.45, y + h * 0.55);
  ctx.lineTo(x + w * 0.32, y + h * 0.45);
  ctx.lineTo(x + w * 0.35, y + h * 0.65);
  ctx.closePath();
  ctx.fill();
}

// [G-114] Satellite Laser Art
function drawSatelliteLaserArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#060814';
  ctx.fillRect(x, y, w, h);

  // Emitter
  ctx.fillStyle = '#FF9800';
  ctx.beginPath();
  ctx.arc(x + w * 0.2, y + h * 0.7, 10, 0, Math.PI * 2);
  ctx.fill();

  // Satellite reflector
  const sx = x + w * 0.5;
  const sy = y + h * 0.35;
  ctx.fillStyle = '#1E88E5';
  ctx.beginPath();
  ctx.arc(sx, sy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx - 10, sy - 8);
  ctx.lineTo(sx + 10, sy + 8);
  ctx.stroke();

  // Receiver
  ctx.strokeStyle = '#00E676';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x + w * 0.8, y + h * 0.65, 12, 0, Math.PI * 2);
  ctx.stroke();

  // Bouncing Laser Beam
  ctx.strokeStyle = '#FFEB3B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.7);
  ctx.lineTo(sx, sy);
  ctx.lineTo(x + w * 0.8, y + h * 0.65);
  ctx.stroke();
}

// [G-115] Mars Rover Art
function drawMarsRoverArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#4E1F16';
  ctx.fillRect(x, y, w, h);

  // Dune ridge
  ctx.fillStyle = '#6D2B1E';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 1.3, h * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Rover body
  ctx.fillStyle = '#ECEFF1';
  ctx.fillRect(x + w * 0.38, y + h * 0.45, 24, 14);

  // Wheels
  ctx.fillStyle = '#212121';
  ctx.fillRect(x + w * 0.35, y + h * 0.58, 6, 6);
  ctx.fillRect(x + w * 0.46, y + h * 0.58, 6, 6);
  ctx.fillRect(x + w * 0.57, y + h * 0.58, 6, 6);

  // Water Ice crystal
  ctx.fillStyle = '#00E5FF';
  ctx.beginPath();
  ctx.arc(x + w * 0.75, y + h * 0.6, 6, 0, Math.PI * 2);
  ctx.fill();
}

// [G-116] Zero-G Tether Art
function drawZeroGTetherArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#04060F';
  ctx.fillRect(x, y, w, h);

  // Station Hub
  const cx = x + w * 0.4;
  const cy = y + h * 0.5;
  ctx.fillStyle = '#37474F';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#00E5FF';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tether line
  const ax = x + w * 0.72;
  const ay = y + h * 0.35;
  ctx.strokeStyle = '#E53935';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ax, ay);
  ctx.stroke();

  // Spacewalker
  ctx.fillStyle = '#ECEFF1';
  ctx.beginPath();
  ctx.arc(ax, ay, 8, 0, Math.PI * 2);
  ctx.fill();

  // Visor
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(ax + 3, ay - 1, 3, 0, Math.PI * 2);
  ctx.fill();
}

// 117. Saloon Brawler
function drawSaloonBrawlerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#27170E';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.48;

  // Weathered Wood Saloon Floor & Wall Panel
  ctx.fillStyle = '#451A03';
  ctx.fillRect(x + 6, y + h * 0.62, w - 12, h * 0.38);
  ctx.strokeStyle = '#27170E';
  ctx.lineWidth = 1.5;
  for (let fx = x + 16; fx < x + w - 10; fx += 22) {
    ctx.beginPath();
    ctx.moveTo(fx, y + h * 0.62);
    ctx.lineTo(fx, y + h);
    ctx.stroke();
  }

  // Swinging Batwing Saloon Doors
  ctx.fillStyle = '#78350F';
  ctx.fillRect(cx - 36, cy - 24, 22, 34);
  ctx.fillRect(cx + 14, cy - 24, 22, 34);
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 36, cy - 24, 22, 34);
  ctx.strokeRect(cx + 14, cy - 24, 22, 34);

  // Red & Blue Clashing Brawler Fists
  ctx.save();
  // Red Left Fist
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(cx - 12, cy + 2, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#991B1B';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Blue Right Fist
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(cx + 12, cy - 2, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1D4ED8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Impact Clashing Starburst
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Flying Shattered Whiskey Glass & Droplets
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(cx + 26, cy - 18, 3, 0, Math.PI * 2);
  ctx.arc(cx - 24, cy - 14, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy - 22, 2, 0, Math.PI * 2);
  ctx.fill();
}

// 118. Train Heist
function drawTrainHeistArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1C1917';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Desert Sunset Canyon Sky
  const skyGrad = ctx.createLinearGradient(x, y, x, y + h * 0.6);
  skyGrad.addColorStop(0, '#7C2D12');
  skyGrad.addColorStop(1, '#EA580C');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(x, y, w, h * 0.55);

  // Distant Canyon Mesa Silhouette
  ctx.fillStyle = '#431407';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.55);
  ctx.lineTo(x + w * 0.25, y + h * 0.42);
  ctx.lineTo(x + w * 0.45, y + h * 0.42);
  ctx.lineTo(x + w * 0.6, y + h * 0.55);
  ctx.lineTo(x + w * 0.8, y + h * 0.46);
  ctx.lineTo(x + w, y + h * 0.55);
  ctx.closePath();
  ctx.fill();

  // Steam Locomotive Roof Top
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x + 4, cy + 4, w - 8, h * 0.38);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, cy + 4, w - 8, h * 0.38);

  // Rivet Studs along roof edge
  ctx.fillStyle = '#94A3B8';
  for (let rx = x + 12; rx < x + w - 10; rx += 16) {
    ctx.beginPath();
    ctx.arc(rx, cy + 8, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Running Heist Cowboy with Hat
  ctx.save();
  ctx.translate(cx - 16, cy - 2);
  // Stetson Hat
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.ellipse(0, -10, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-5, -16, 10, 7);
  // Red Bandana & Duster
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.arc(0, -4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-7, 2, 14, 12);
  ctx.restore();

  // Swag Bag of Gold with $ Sign
  ctx.save();
  ctx.translate(cx + 22, cy);
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#FEF08A';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', 0, 3.5);
  ctx.restore();
}

// 119. Gold Panning
function drawGoldPanningArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0C4A6E';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // River Ripple Waves
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.stroke();

  // Heavy Cast-Iron Prospector Pan
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner Pan Water & Dark Gravel
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();

  // Shimmering Golden Nuggets & Dust
  const goldPositions = [
    { x: cx, y: cy, r: 6 },
    { x: cx - 9, y: cy + 7, r: 4.5 },
    { x: cx + 11, y: cy - 6, r: 4 },
    { x: cx - 6, y: cy - 9, r: 3.5 },
    { x: cx + 8, y: cy + 9, r: 3 }
  ];

  ctx.shadowColor = '#FACC15';
  ctx.shadowBlur = 8;
  for (const g of goldPositions) {
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(g.x - g.r * 0.3, g.y - g.r * 0.3, g.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// 120. Rodeo Bull
function drawRodeoBullArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#451A03';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.54;

  // Rodeo Arena Fence Rails
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 22);
  ctx.lineTo(x + w - 4, y + 22);
  ctx.moveTo(x + 4, y + 36);
  ctx.lineTo(x + w - 4, y + 36);
  ctx.stroke();

  // Bucking Mechanical Bull Body
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.32);

  // Bull Torso & Muscular Shoulders
  ctx.fillStyle = '#1C1917';
  ctx.beginPath();
  ctx.ellipse(-4, 0, 26, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bull Head
  ctx.beginPath();
  ctx.arc(20, -6, 12, 0, Math.PI * 2);
  ctx.fill();

  // Golden Wicked Horns
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(20, -14);
  ctx.quadraticCurveTo(24, -26, 32, -24);
  ctx.stroke();

  // Glowing Red Nostrils / Eye
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(22, -8, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Cowboy Rider Holding Rope
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.arc(-4, -20, 8, 0, Math.PI * 2);
  ctx.fill();
  // Stetson Hat on Rider
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(-4, -26, 12, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-8, -32, 8, 7);

  ctx.restore();

  // Kicked Up Dust Billows
  ctx.fillStyle = 'rgba(217, 119, 6, 0.45)';
  ctx.beginPath();
  ctx.arc(cx - 28, cy + 16, 14, 0, Math.PI * 2);
  ctx.arc(cx - 14, cy + 18, 11, 0, Math.PI * 2);
  ctx.fill();
}

// 121. Horseshoe Toss
function drawHorseshoeTossArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#78350F';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.52;

  // Sandy Dirt Pit
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 38, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Iron Ground Stake
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(cx - 3, cy - 24, 6, 32);
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.arc(cx, cy - 24, 4, 0, Math.PI * 2);
  ctx.fill();

  // Cast Iron Horseshoe Ringer around Stake
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0.35 * Math.PI, 1.65 * Math.PI);
  ctx.stroke();
  // Calks on tips
  ctx.fillStyle = '#64748B';
  ctx.fillRect(8, 10, 6, 5);
  ctx.fillRect(8, -15, 6, 5);
  ctx.restore();

  // Clinking Ringer Impact Sparks
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 8, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 8, cy - 12, 2, 0, Math.PI * 2);
  ctx.arc(cx - 10, cy + 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

// 122. Dynamite Tumble
function drawDynamiteTumbleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1C1917';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.48;
  const cy = y + h * 0.5;

  // Rocky Cavern Wall
  ctx.fillStyle = '#292524';
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h - 8);
  ctx.lineTo(x + w * 0.3, y + h * 0.4);
  ctx.lineTo(x + w * 0.7, y + h * 0.35);
  ctx.lineTo(x + w - 10, y + h - 8);
  ctx.closePath();
  ctx.fill();

  // 3-Stick Red TNT Dynamite Bundle
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.25);

  // Bottom 2 Sticks
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(-22, -6, 44, 12);
  ctx.fillRect(-22, 6, 44, 12);
  // Top Stick
  ctx.fillRect(-20, -18, 44, 12);

  // Black Hazard Binding Tape
  ctx.fillStyle = '#0C0A09';
  ctx.fillRect(-12, -18, 6, 36);
  ctx.fillRect(8, -18, 6, 36);

  // White "TNT" Stencil Text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TNT', -2, -8);

  // Sizzling Fuse Line
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(24, -12);
  ctx.quadraticCurveTo(34, -18, 38, -26);
  ctx.stroke();

  // Blazing Fuse Spark Burst
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(38, -26, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(38, -26, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 123. Cactus Slalom
function drawCactusSlalomArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#9A3412';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.52;

  // Huge Setting Desert Sun on Horizon
  const sunGrad = ctx.createRadialGradient(cx, y + h * 0.45, 4, cx, y + h * 0.45, 34);
  sunGrad.addColorStop(0, '#FEF08A');
  sunGrad.addColorStop(0.5, '#F97316');
  sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.45, 34, 0, Math.PI * 2);
  ctx.fill();

  // Rolling Sand Dunes
  ctx.fillStyle = '#EA580C';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.6);
  ctx.quadraticCurveTo(cx - 20, y + h * 0.5, cx + 15, y + h * 0.65);
  ctx.quadraticCurveTo(cx + 35, y + h * 0.72, x + w, y + h * 0.62);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();

  // Center Saguaro Cactus with Dual Branches & Ribs
  ctx.fillStyle = '#15803D';
  // Main Trunk
  ctx.fillRect(cx - 4, cy - 22, 8, 38);
  ctx.beginPath();
  ctx.arc(cx, cy - 22, 4, Math.PI, 0);
  ctx.fill();

  // Left Arm
  ctx.fillRect(cx - 15, cy - 6, 12, 5);
  ctx.fillRect(cx - 15, cy - 16, 5, 12);
  ctx.beginPath();
  ctx.arc(cx - 12.5, cy - 16, 2.5, Math.PI, 0);
  ctx.fill();

  // Right Arm
  ctx.fillRect(cx + 3, cy - 1, 12, 5);
  ctx.fillRect(cx + 10, cy - 11, 5, 12);
  ctx.beginPath();
  ctx.arc(cx + 12.5, cy - 11, 2.5, Math.PI, 0);
  ctx.fill();

  // Highlights on Cactus Ribs
  ctx.fillStyle = '#4ADE80';
  ctx.fillRect(cx - 2, cy - 20, 2, 34);

  // Speeding Red Buggy Kart Slalom Silhouette
  ctx.save();
  ctx.translate(cx + 26, y + h * 0.72);
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(-8, -4, 16, 8);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(-9, -6, 5, 3);
  ctx.fillRect(4, -6, 5, 3);
  ctx.fillRect(-9, 4, 5, 3);
  ctx.fillRect(4, 4, 5, 3);
  ctx.restore();
}

// 124. Bandit Chase
function drawBanditChaseArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#78350F';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.46;
  const cy = y + h * 0.52;

  // Canyon Road Ground
  ctx.fillStyle = '#B45309';
  ctx.fillRect(x, y + h * 0.65, w, h * 0.35);

  // Stagecoach Body (Rich Mahogany & Gold)
  ctx.fillStyle = '#571C0C';
  ctx.fillRect(cx - 24, cy - 14, 34, 22);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 24, cy - 14, 34, 22);

  // Coach Windows with Warm Yellow Glow
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(cx - 18, cy - 8, 8, 8);
  ctx.fillRect(cx - 4, cy - 8, 8, 8);

  // 4 Spoked Stagecoach Wheels
  const wheelPositions = [
    { x: cx - 18, y: cy + 12, r: 8 },
    { x: cx + 6, y: cy + 12, r: 9 }
  ];
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2;
  for (const wh of wheelPositions) {
    ctx.beginPath();
    ctx.arc(wh.x, wh.y, wh.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wh.x - wh.r, wh.y);
    ctx.lineTo(wh.x + wh.r, wh.y);
    ctx.moveTo(wh.x, wh.y - wh.r);
    ctx.lineTo(wh.x, wh.y + wh.r);
    ctx.stroke();
  }

  // Crosshair Gun Reticle Locking On
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + 28, cy - 6, 12, 0, Math.PI * 2);
  ctx.moveTo(cx + 28 - 16, cy - 6);
  ctx.lineTo(cx + 28 + 16, cy - 6);
  ctx.moveTo(cx + 28, cy - 6 - 16);
  ctx.lineTo(cx + 28, cy - 6 + 16);
  ctx.stroke();
}

// 125. Rattlesnake Reflex
function drawRattlesnakeReflexArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#3F1508';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.52;

  // Desert Stone Ledge
  ctx.fillStyle = '#78350F';
  ctx.fillRect(x + 8, y + h * 0.65, w - 16, h * 0.35);

  // Coiled Rattlesnake Body (Diamond Scales)
  ctx.strokeStyle = '#15803D';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy + 4, 18, 0, Math.PI * 1.75);
  ctx.stroke();

  // Outer Coil Overlap
  ctx.strokeStyle = '#166534';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy + 4, 26, 0.4 * Math.PI, 1.35 * Math.PI);
  ctx.stroke();

  // Snake Head with Amber Eyes
  ctx.fillStyle = '#22C55E';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy - 14, 9, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(cx + 7, cy - 16, 2, 0, Math.PI * 2);
  ctx.fill();

  // Forked Red Tongue
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + 12, cy - 13);
  ctx.lineTo(cx + 20, cy - 14);
  ctx.lineTo(cx + 24, cy - 17);
  ctx.moveTo(cx + 20, cy - 14);
  ctx.lineTo(cx + 24, cy - 11);
  ctx.stroke();

  // Vibrating Tail Rattle with Motion Blur Lines
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(cx - 18, cy - 6, 10, 5);
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 9);
  ctx.lineTo(cx - 24, cy - 3);
  ctx.moveTo(cx - 21, cy - 10);
  ctx.lineTo(cx - 21, cy - 2);
  ctx.stroke();
}

// 126. Western Poker
function drawWesternPokerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#064E3B';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.48;

  // Casino Green Felt Table Rim
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);

  // Fanned Playing Cards (Ace of Spades, King of Hearts)
  // Card 1: King of Hearts
  ctx.save();
  ctx.translate(cx - 14, cy);
  ctx.rotate(-0.18);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-12, -18, 24, 36);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-12, -18, 24, 36);
  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('K♥', 0, 4);
  ctx.restore();

  // Card 2: Ace of Spades (On Top)
  ctx.save();
  ctx.translate(cx + 8, cy);
  ctx.rotate(0.12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-12, -18, 24, 36);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-12, -18, 24, 36);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('A♠', 0, 4);
  ctx.restore();

  // Stacks of Clay Poker Chips
  const chipColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B'];
  for (let c = 0; c < 4; c++) {
    ctx.fillStyle = chipColors[c];
    ctx.beginPath();
    ctx.ellipse(cx + 34, cy + 12 - c * 4, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// 127. Laser Tripwire
function drawLaserTripwireArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#080C1A';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Vault Security Corridor Grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 12, y + 10, w - 24, h - 20);

  // Criss-Crossing Crimson Lasers with Glow
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#EF4444';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + h * 0.32);
  ctx.lineTo(x + w - 6, y + h * 0.38);
  ctx.moveTo(x + 6, y + h * 0.72);
  ctx.lineTo(x + w - 6, y + h * 0.64);
  ctx.moveTo(x + w * 0.28, y + 6);
  ctx.lineTo(x + w * 0.76, y + h - 6);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Crouching Stealth Agent Silhouette
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head & Night Vision Goggles
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(-8, -6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(-11, -8, 5, 2.5);
  ctx.restore();
}

// 128. Vault Safe
function drawVaultSafeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.48;

  // Massive Steel Vault Door Bezel
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Radial Steel Locking Bolts
  ctx.fillStyle = '#E2E8F0';
  for (let b = 0; b < Math.PI * 2; b += Math.PI / 4) {
    const bx = cx + Math.cos(b) * 28;
    const by = cy + Math.sin(b) * 28;
    ctx.beginPath();
    ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Central Gold Safe Dial Wheel
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Stethoscope Sound Waves
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx + 20, cy - 14, 8, -0.6, 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 20, cy - 14, 13, -0.6, 0.6);
  ctx.stroke();
}

// 129. Security Camera
function drawSecurityCameraArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#090D1A';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.45;

  // Modern High-Tech CCTV Camera Mounting Arm
  ctx.fillStyle = '#334155';
  ctx.fillRect(x + 12, y + 10, 16, 12);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 18);
  ctx.lineTo(cx - 8, cy - 14);
  ctx.stroke();

  // Cylindrical Dome Camera Body
  ctx.save();
  ctx.translate(cx - 8, cy - 14);
  ctx.rotate(0.42);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(-14, -8, 28, 16);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(8, -8, 6, 16);

  // Blinking Red Record LED
  ctx.fillStyle = '#EF4444';
  ctx.shadowColor = '#EF4444';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(-8, -10, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Translucent Amber/Gold Security Scanning Laser Cone
  const coneGrad = ctx.createLinearGradient(cx - 4, cy - 10, cx + 18, y + h);
  coneGrad.addColorStop(0, 'rgba(250, 204, 21, 0.45)');
  coneGrad.addColorStop(1, 'rgba(250, 204, 21, 0.04)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy - 10);
  ctx.lineTo(x + 8, y + h - 6);
  ctx.lineTo(x + w - 8, y + h - 6);
  ctx.closePath();
  ctx.fill();

  // Target Lock Hexagon Frame on Floor
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 1.8;
  ctx.strokeRect(cx + 8, y + h - 24, 26, 16);
  ctx.fillStyle = '#EF4444';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('TARGET', cx + 10, y + h - 13);
}

// 130. Briefcase Snatch
function drawBriefcaseSnatchArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Rainy City Skyline Silhouettes
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x + 10, y + h * 0.25, 24, h * 0.75);
  ctx.fillRect(x + 38, y + h * 0.15, 30, h * 0.85);
  ctx.fillRect(x + 72, y + h * 0.3, 26, h * 0.7);
  ctx.fillRect(x + 102, y + h * 0.2, 34, h * 0.8);

  // Searchlight Beam slicing across the rooftop
  const lightGrad = ctx.createLinearGradient(x + w, y, cx, cy);
  lightGrad.addColorStop(0, 'rgba(254, 240, 138, 0.25)');
  lightGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = lightGrad;
  ctx.beginPath();
  ctx.moveTo(x + w - 4, y + 4);
  ctx.lineTo(cx - 30, y + h);
  ctx.lineTo(cx + 45, y + h);
  ctx.closePath();
  ctx.fill();

  // High-Tech Carbon Fiber Briefcase
  ctx.save();
  ctx.translate(cx, cy + 4);
  ctx.rotate(-0.1);

  // Briefcase Body
  ctx.fillStyle = '#18181B';
  ctx.fillRect(-24, -14, 48, 28);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2;
  ctx.strokeRect(-24, -14, 48, 28);

  // Metal Corner Protectors
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(-24, -14, 6, 6);
  ctx.fillRect(18, -14, 6, 6);
  ctx.fillRect(-24, 8, 6, 6);
  ctx.fillRect(18, 8, 6, 6);

  // Handle
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, -14);
  ctx.lineTo(-10, -22);
  ctx.lineTo(10, -22);
  ctx.lineTo(10, -14);
  ctx.stroke();

  // Digital Glowing Neon Classified Lock
  ctx.fillStyle = '#06B6D4';
  ctx.shadowColor = '#06B6D4';
  ctx.shadowBlur = 8;
  ctx.fillRect(-6, -3, 12, 6);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Diagonal Rain Streaks
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1;
  for (let r = 0; r < 8; r++) {
    const rx = x + 16 + r * 18;
    const ry = y + 10 + (r % 3) * 12;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 8, ry + 22);
    ctx.stroke();
  }
}

// 131. Hack Terminal
function drawHackTerminalArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#030712';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Curved CRT Cyber Monitor Bezel
  ctx.fillStyle = '#111827';
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 3;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 8);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
  }

  // Glowing Phosphor Green Screen Interior
  ctx.fillStyle = '#022C22';
  ctx.fillRect(x + 14, y + 14, w - 28, h - 28);

  // Digital Matrix Rain Columns
  ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
  ctx.font = 'bold 7px monospace';
  for (let col = 0; col < 6; col++) {
    const mx = x + 20 + col * 16;
    ctx.fillText('0 1 0 1', mx, y + 26);
    ctx.fillText('1 1 0 0', mx, y + 36);
    ctx.fillText('1 0 1 1', mx, y + 46);
  }

  // Glowing Green Command Prompts
  ctx.fillStyle = '#34D399';
  ctx.font = 'bold 9px monospace';
  ctx.shadowColor = '#10B981';
  ctx.shadowBlur = 6;
  ctx.fillText('> ROOT_ACCESS', x + 18, y + h * 0.62);
  ctx.fillText('> BYPASS [99%]', x + 18, y + h * 0.74);

  // Holographic Cyber Key Icon in Center
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx + 28, cy - 6, 6, 0, Math.PI * 2);
  ctx.moveTo(cx + 28 + 6, cy - 6);
  ctx.lineTo(cx + 28 + 14, cy - 6);
  ctx.lineTo(cx + 28 + 14, cy - 3);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Monitor Scanlines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.lineWidth = 1;
  for (let sy = y + 16; sy < y + h - 16; sy += 4) {
    ctx.beginPath();
    ctx.moveTo(x + 14, sy);
    ctx.lineTo(x + w - 14, sy);
    ctx.stroke();
  }
}

// 132. Smoke Bomb Escape
function drawSmokeBombEscapeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#09090B';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.52;

  // Dark Rooftop Tiles
  ctx.fillStyle = '#18181B';
  ctx.fillRect(x + 8, y + h * 0.7, w - 16, h * 0.3);

  // Volumetric Purple & Midnight Smoke Clouds with Gradient
  const smokePuffs = [
    { x: cx, y: cy, r: 28, c: 'rgba(107, 33, 168, 0.75)' },
    { x: cx - 18, y: cy + 4, r: 22, c: 'rgba(88, 28, 135, 0.85)' },
    { x: cx + 18, y: cy + 2, r: 24, c: 'rgba(126, 34, 206, 0.8)' },
    { x: cx - 8, y: cy - 14, r: 20, c: 'rgba(147, 51, 234, 0.65)' },
    { x: cx + 12, y: cy - 12, r: 22, c: 'rgba(168, 85, 247, 0.55)' }
  ];

  for (const p of smokePuffs) {
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Steel Ninja Shuriken Flying through Smoke
  ctx.save();
  ctx.translate(cx + 26, cy - 14);
  ctx.rotate(0.6);
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(3, -3);
  ctx.lineTo(12, 0);
  ctx.lineTo(3, 3);
  ctx.lineTo(0, 12);
  ctx.lineTo(-3, 3);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-3, -3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Glowing Yellow Ninja Eyes in the Smoke
  ctx.fillStyle = '#FACC15';
  ctx.shadowColor = '#FACC15';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(cx - 7, cy - 2, 4, 2, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 7, cy - 2, 4, 2, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// 133. Micro Wiretap
function drawMicroWiretapArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0C0A09';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Circuit Board Copper Traces
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 10, cy);
  ctx.lineTo(cx - 16, cy);
  ctx.lineTo(cx - 16, cy + 18);
  ctx.lineTo(cx + 16, cy + 18);
  ctx.moveTo(cx + 16, cy);
  ctx.lineTo(x + w - 10, cy);
  ctx.stroke();

  // Expanding Neon Green Radio Audio Waves
  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#22C55E';
  ctx.shadowBlur = 8;
  for (let rad = 24; rad <= 38; rad += 7) {
    ctx.beginPath();
    ctx.arc(cx, cy, rad, -0.55 * Math.PI, 0.55 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0.45 * Math.PI, 1.55 * Math.PI);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Mini Stealth Microphone Bug Body
  ctx.fillStyle = '#262626';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#737373';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Center Microphone Grille & Pulsing LED
  ctx.fillStyle = '#171717';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

// 134. Rooftop Zipline
function drawRooftopZiplineArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#020617';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Night City Skyline Towers
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x + 10, y + 24, 28, h);
  ctx.fillRect(x + w - 38, y + 42, 28, h);

  // High-Tension Steel Cable Wire
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 28);
  ctx.lineTo(x + w - 24, y + h - 16);
  ctx.stroke();

  // Speeding Zipliner Agent with Pulley
  ctx.save();
  ctx.translate(cx, cy - 2);
  ctx.rotate(0.36);

  // Pulley Wheel on Cable
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(0, -10, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 0);
  ctx.stroke();

  // Agent Body & Flying Cape/Scarf
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(0, 4, 6, 0, Math.PI * 2);
  ctx.fill();
  // Flying scarf
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.lineTo(-18, -4);
  ctx.lineTo(-14, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Cable Friction Sparks
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(cx - 8, cy - 8, 2, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

// 135. Drone Intercept
function drawDroneInterceptArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#030712';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.48;

  // Radar Sweep Rings
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Quadcopter Drone Carbon-X Arms
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy - 14);
  ctx.lineTo(cx + 22, cy + 14);
  ctx.moveTo(cx + 22, cy - 14);
  ctx.lineTo(cx - 22, cy + 14);
  ctx.stroke();

  // 4 Spinning Rotor Blur Discs
  const rotors = [
    { x: cx - 22, y: cy - 14 },
    { x: cx + 22, y: cy - 14 },
    { x: cx - 22, y: cy + 14 },
    { x: cx + 22, y: cy + 14 }
  ];
  ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
  for (const r of rotors) {
    ctx.beginPath();
    ctx.arc(r.x, r.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
  }

  // Central Avionics Pod & Glowing Red Targeting Eye
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#06B6D4';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#EF4444';
  ctx.shadowColor = '#EF4444';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// 136. Disguise Shuffle
function drawDisguiseShuffleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1E1B4B';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.48;

  // Stage Velvet Curtain Drape Silhouettes
  ctx.fillStyle = '#312E81';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 24, cy, x, y + h);
  ctx.lineTo(x, y);
  ctx.moveTo(x + w, y);
  ctx.quadraticCurveTo(x + w - 24, cy, x + w, y + h);
  ctx.lineTo(x + w, y);
  ctx.fill();

  // Golden Venetian Disguise Mask
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Mask Eyeholes
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.ellipse(-10, -1, 5, 3.5, -0.2, 0, Math.PI * 2);
  ctx.ellipse(10, -1, 5, 3.5, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Fancy Feather Plume
  ctx.fillStyle = '#EC4899';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(-6, -28, -2, -34);
  ctx.quadraticCurveTo(6, -26, 0, -14);
  ctx.fill();
  ctx.restore();

  // Sparkles
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(cx - 24, cy - 16, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 26, cy + 14, 2, 0, Math.PI * 2);
  ctx.fill();
}

// 137. Synthwave Highway
function drawSynthwaveHighwayArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#110022';
  ctx.fillRect(x, y, w, h);
  // Neon Sunset
  ctx.fillStyle = '#EC4899';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.45, 20, Math.PI, 0);
  ctx.fill();
  // Sun stripes
  ctx.fillStyle = '#110022';
  ctx.fillRect(x + w * 0.3, y + h * 0.35, w * 0.4, 2);
  ctx.fillRect(x + w * 0.3, y + h * 0.40, w * 0.4, 2);
  // Perspective road lines
  ctx.strokeStyle = '#06B6D4';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.45);
  ctx.lineTo(x + w * 0.1, y + h);
  ctx.moveTo(x + w * 0.5, y + h * 0.45);
  ctx.lineTo(x + w * 0.9, y + h);
  ctx.moveTo(x + w * 0.5, y + h * 0.45);
  ctx.lineTo(x + w * 0.5, y + h);
  ctx.stroke();
}

// 138. Drum Solo
function drawDrumSoloArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);
  // Snare drum
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.55, 24, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Drumsticks crossed
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h * 0.3);
  ctx.lineTo(x + w * 0.7, y + h * 0.7);
  ctx.moveTo(x + w * 0.7, y + h * 0.3);
  ctx.lineTo(x + w * 0.3, y + h * 0.7);
  ctx.stroke();
}

// 139. Turntable Scratch
function drawTurntableScratchArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#18181B';
  ctx.fillRect(x, y, w, h);
  // Vinyl record
  ctx.fillStyle = '#09090B';
  ctx.beginPath();
  ctx.arc(x + w * 0.48, y + h * 0.5, 22, 0, Math.PI * 2);
  ctx.fill();
  // Record grooves
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + w * 0.48, y + h * 0.5, 16, 0, Math.PI * 2);
  ctx.arc(x + w * 0.48, y + h * 0.5, 11, 0, Math.PI * 2);
  ctx.stroke();
  // Center label
  ctx.fillStyle = '#8B5CF6';
  ctx.beginPath();
  ctx.arc(x + w * 0.48, y + h * 0.5, 6, 0, Math.PI * 2);
  ctx.fill();
  // Tonearm
  ctx.strokeStyle = '#E4E4E7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.82, y + h * 0.25);
  ctx.lineTo(x + w * 0.6, y + h * 0.45);
  ctx.stroke();
}

// 140. Bass Drop
function drawBassDropArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#09090B';
  ctx.fillRect(x, y, w, h);
  // Subwoofer cone
  ctx.fillStyle = '#27272A';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7C3AED';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#EC4899';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 6, 0, Math.PI * 2);
  ctx.fill();
  // Sound shockwave arcs
  ctx.strokeStyle = '#A855F7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 30, -0.6, 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 30, Math.PI - 0.6, Math.PI + 0.6);
  ctx.stroke();
}

// 141. Vocal Pitch
function drawVocalPitchArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Digital audio workstation / studio screen
  ctx.fillStyle = '#030712';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // DAW Note Pitch Grid Lines (C4, D4, E4, F4)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.lineWidth = 1;
  const gridYs = [y + 10, y + 20, y + 30, y + 40];
  for (const gy of gridYs) {
    ctx.beginPath();
    ctx.moveTo(x + 16, gy);
    ctx.lineTo(x + w - 6, gy);
    ctx.stroke();
  }

  // Pitch note names on left
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('F4', x + 4, y + 12);
  ctx.fillText('E4', x + 4, y + 22);
  ctx.fillText('D4', x + 4, y + 32);
  ctx.fillText('C4', x + 4, y + 42);

  // Target Pitch Guidance Bar (Neon Cyan Glow)
  ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x + 22, y + 17, w - 38, 7, 3);
  else ctx.rect(x + 22, y + 17, w - 38, 7);
  ctx.fill();
  ctx.stroke();

  // Singing Voice Pitch Waveform (Vibrant Emerald -> Lime)
  ctx.strokeStyle = '#10b981';
  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let px = 18; px < w - 8; px += 2) {
    // Wave approaching and snapping onto target bar
    const waveY = cy - 2 + Math.sin(px * 0.22) * 5 * (px < cx ? 1.4 : 0.2);
    if (px === 18) ctx.moveTo(x + px, waveY);
    else ctx.lineTo(x + px, waveY);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Active Voice Pitch Head / Diamond hitting the note
  const hitX = cx + 8;
  const hitY = y + 20.5;
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(hitX, hitY, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Studio microphone icon in corner
  const micX = x + w - 14;
  const micY = y + h - 12;
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(micX - 2.5, micY - 5, 5, 8, 2.5);
  else ctx.rect(micX - 2.5, micY - 5, 5, 8);
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(micX, micY - 1, 4.5, 0, Math.PI);
  ctx.moveTo(micX, micY + 3.5); ctx.lineTo(micX, micY + 7);
  ctx.stroke();
}

// 142. Breakdance Battle
function drawBreakdanceBattleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1E1B4B';
  ctx.fillRect(x, y, w, h);
  // Floor spotlight
  ctx.fillStyle = 'rgba(236, 72, 153, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.75, 30, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // B-boy dancer headstand silhouette
  ctx.fillStyle = '#F43F5E';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.65, 6, 0, Math.PI * 2); // Head on floor
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.65);
  ctx.lineTo(x + w * 0.5, y + h * 0.45); // Torso up
  ctx.lineTo(x + w * 0.35, y + h * 0.25); // Leg left split
  ctx.moveTo(x + w * 0.5, y + h * 0.45);
  ctx.lineTo(x + w * 0.65, y + h * 0.25); // Leg right split
  ctx.stroke();
}

// 143. Neon Metronome
function drawNeonMetronomeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);
  // Triangular pyramid body
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.2);
  ctx.lineTo(x + w * 0.25, y + h * 0.8);
  ctx.lineTo(x + w * 0.75, y + h * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Swinging needle
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.75);
  ctx.lineTo(x + w * 0.65, y + h * 0.28);
  ctx.stroke();
  // Weight bob
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(x + w * 0.6, y + h * 0.42, 4, 0, Math.PI * 2);
  ctx.fill();
}

// 144. Equalizer Bounce
function drawEqualizerBounceArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#090814';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Sound Studio Studio Monitor Acoustic Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);

  // Equalizer Multi-Segment Bars (Green -> Yellow -> Red LEDs)
  const barHeights = [0.42, 0.78, 0.95, 0.62, 0.88, 0.52, 0.72];
  const barW = (w - 28) / barHeights.length;
  const baseFloorY = y + h * 0.82;

  for (let i = 0; i < barHeights.length; i++) {
    const bx = x + 14 + i * barW;
    const totalSegs = 10;
    const activeSegs = Math.round(barHeights[i] * totalSegs);
    for (let s = 0; s < totalSegs; s++) {
      const sy = baseFloorY - (s + 1) * 6;
      if (s < activeSegs) {
        ctx.fillStyle = s >= 8 ? '#EF4444' : s >= 5 ? '#FACC15' : '#10B981';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = s >= 7 ? 6 : 0;
        ctx.fillRect(bx + 2, sy, barW - 4, 4.5);
        ctx.shadowBlur = 0;
      }
    }
  }

  // Glowing Bouncing Beat Orb Surfing on Highest Peak
  const peakBarIdx = 2; // highest bar
  const peakX = x + 14 + peakBarIdx * barW + barW / 2;
  const peakY = baseFloorY - Math.round(barHeights[peakBarIdx] * 10) * 6 - 8;

  ctx.fillStyle = '#38BDF8';
  ctx.shadowColor = '#38BDF8';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(peakX, peakY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(peakX - 2, peakY - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Radiating Audio Beat Ripple Waves
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(peakX, peakY, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(peakX, peakY, 22, 0, Math.PI * 2);
  ctx.stroke();
}

// 145. Retro Chiptune
function drawRetroChiptuneArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#060B18';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Handheld 8-Bit Console Bezel
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.roundRect(cx - 32, cy - 26, 64, 52, 6);
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Green LCD Dot Matrix Screen
  ctx.fillStyle = '#84CC16';
  ctx.fillRect(cx - 24, cy - 20, 48, 30);
  ctx.strokeStyle = '#3F6212';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 24, cy - 20, 48, 30);

  // Pixelated 8-Bit Double Music Note on Screen
  ctx.fillStyle = '#1A2E05';
  // Left note head
  ctx.fillRect(cx - 16, cy - 2, 8, 6);
  // Right note head
  ctx.fillRect(cx + 4, cy - 6, 8, 6);
  // Stems
  ctx.fillRect(cx - 10, cy - 14, 3, 13);
  ctx.fillRect(cx + 10, cy - 18, 3, 13);
  // Connecting beam bar
  ctx.fillRect(cx - 10, cy - 18, 23, 4);

  // Console D-Pad & Action Buttons
  ctx.fillStyle = '#334155';
  ctx.fillRect(cx - 20, cy + 14, 10, 4);
  ctx.fillRect(cx - 17, cy + 11, 4, 10);
  // Red B & A Buttons
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.arc(cx + 12, cy + 16, 3, 0, Math.PI * 2);
  ctx.arc(cx + 20, cy + 14, 3, 0, Math.PI * 2);
  ctx.fill();

  // Floating Golden Sparkles Around Console
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(cx - 36, cy - 14, 2, 0, Math.PI * 2);
  ctx.arc(cx + 36, cy + 18, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 34, cy - 22, 2, 0, Math.PI * 2);
  ctx.fill();
}

// 146. Disco Tile
function drawDiscoTileArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#090818';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Hanging Mirror Disco Ball
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx, y + 16);
  ctx.stroke();

  // Silver Disco Ball with Facet Shimmer
  ctx.fillStyle = '#E2E8F0';
  ctx.shadowColor = '#FFFFFF';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, y + 26, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, y + 26, 12, 0, Math.PI * 2);
  ctx.stroke();

  // Facet Grid Lines
  ctx.strokeStyle = '#94A3B8';
  ctx.beginPath();
  ctx.moveTo(cx - 12, y + 26);
  ctx.lineTo(cx + 12, y + 26);
  ctx.moveTo(cx, y + 14);
  ctx.lineTo(cx, y + 38);
  ctx.stroke();

  // 3D Perspective Glowing Disco Floor Tiles
  const tileColors = ['#EC4899', '#06B6D4', '#EAB308', '#8B5CF6', '#10B981', '#F43F5E'];
  const floorTopY = y + h * 0.55;
  const floorBotY = y + h - 8;

  const rows = 3;
  const cols = 5;
  for (let r = 0; r < rows; r++) {
    const y0 = floorTopY + (r / rows) * (floorBotY - floorTopY);
    const y1 = floorTopY + ((r + 1) / rows) * (floorBotY - floorTopY);
    const w0 = 36 + r * 30;
    const w1 = 36 + (r + 1) * 30;

    for (let c = 0; c < cols; c++) {
      const x00 = cx - w0 / 2 + (c / cols) * w0;
      const x01 = cx - w0 / 2 + ((c + 1) / cols) * w0;
      const x10 = cx - w1 / 2 + (c / cols) * w1;
      const x11 = cx - w1 / 2 + ((c + 1) / cols) * w1;

      ctx.fillStyle = tileColors[(r * cols + c) % tileColors.length];
      ctx.beginPath();
      ctx.moveTo(x00 + 1, y0);
      ctx.lineTo(x01 - 1, y0);
      ctx.lineTo(x11 - 1, y1 - 1);
      ctx.lineTo(x10 + 1, y1 - 1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Radiating Disco Light Beams
  ctx.fillStyle = 'rgba(236, 72, 153, 0.18)';
  ctx.beginPath();
  ctx.moveTo(cx, y + 26);
  ctx.lineTo(x + 10, y + h);
  ctx.lineTo(cx - 20, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
  ctx.beginPath();
  ctx.moveTo(cx, y + 26);
  ctx.lineTo(x + w - 10, y + h);
  ctx.lineTo(cx + 20, y + h);
  ctx.closePath();
  ctx.fill();
}

// 147. Ring Toss
function drawRingTossArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#450A0A';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.52;

  // Carnival Red & White Striped Awning Top
  for (let s = 0; s < 6; s++) {
    ctx.fillStyle = s % 2 === 0 ? '#DC2626' : '#FFFFFF';
    ctx.fillRect(x + 8 + s * ((w - 16) / 6), y + 8, (w - 16) / 6, 14);
  }

  // Rustic Wooden Crate Shelf Table
  ctx.fillStyle = '#78350F';
  ctx.fillRect(x + 8, cy + 8, w - 16, h * 0.4);
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8, cy + 8, w - 16, h * 0.4);

  // 3 Glass Soda Bottles with Colorful Liquids
  const bottles = [
    { x: cx - 22, color: '#38BDF8' },
    { x: cx, color: '#FACC15' },
    { x: cx + 22, color: '#EF4444' }
  ];

  for (const b of bottles) {
    // Glass Body
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(b.x - 6, cy - 8, 12, 24, 3);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Bottle Neck & Cap
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(b.x - 3, cy - 16, 6, 8);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(b.x - 4, cy - 18, 8, 2.5);
  }

  // Flying Golden Plastic Ring Mid-Toss (Landing on Center Bottle)
  ctx.save();
  ctx.translate(cx, cy - 12);
  ctx.rotate(-0.25);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Floating Ring Stars
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(cx - 28, cy - 12, 2, 0, Math.PI * 2);
  ctx.arc(cx + 28, cy - 18, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

// 148. Rollercoaster Thrill
function drawRollercoasterThrillArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Twilight theme park sky
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#1e1b4b');
  sky.addColorStop(0.5, '#4c1d95');
  sky.addColorStop(1, '#831843');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Distant glowing illuminated Ferris Wheel on left
  const fwX = x + 16;
  const fwY = cy + 4;
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(fwX, fwY, 14, 0, Math.PI * 2);
  ctx.stroke();
  for (let s = 0; s < 6; s++) {
    const a = (s * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(fwX, fwY);
    ctx.lineTo(fwX + Math.cos(a) * 14, fwY + Math.sin(a) * 14);
    ctx.stroke();
  }

  // Steel Tubular Coaster Rail Track (Loop-de-loop curve)
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 6, cy + 18);
  ctx.bezierCurveTo(cx - 14, cy + 22, cx - 18, cy - 18, cx, cy - 18);
  ctx.bezierCurveTo(cx + 18, cy - 18, cx + 14, cy + 20, x + w - 4, cy - 6);
  ctx.stroke();

  // Highlight rail tube
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Rail Cross-Ties along track
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.2;
  const ties = [
    [x + 14, cy + 19, x + 16, cy + 16],
    [cx - 10, cy - 6, cx - 8, cy - 9],
    [cx - 2, cy - 18, cx + 2, cy - 18],
    [cx + 12, cy - 2, cx + 14, cy - 5],
    [x + w - 12, cy + 2, x + w - 10, cy - 1]
  ];
  for (const [x1, y1, x2, y2] of ties) {
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Speeding Red Coaster Cart plunging down the drop
  const cartX = cx + 8;
  const cartY = cy - 8;
  ctx.save();
  ctx.translate(cartX, cartY);
  ctx.rotate(0.55);

  // Cart Chassis (Vibrant Red)
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#f87171';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-10, -6, 20, 11, 2);
  else ctx.rect(-10, -6, 20, 11);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Cart silver trim & headlights
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(8, -1, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Thrilled Passengers (Hands up in the air!)
  ctx.fillStyle = '#f8fafc';
  // Passenger 1 (Front)
  ctx.beginPath();
  ctx.arc(4, -9, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Hands up
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(3, -9); ctx.lineTo(1, -15);
  ctx.moveTo(5, -9); ctx.lineTo(7, -15);
  // Passenger 2 (Back)
  ctx.arc(-4, -8, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.moveTo(-5, -8); ctx.lineTo(-7, -14);
  ctx.moveTo(-3, -8); ctx.lineTo(-1, -14);
  ctx.stroke();
  ctx.restore();

  // Wind speed motion streaks
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cartX - 6, cartY - 14); ctx.lineTo(cartX - 18, cartY - 20);
  ctx.moveTo(cartX, cartY + 12); ctx.lineTo(cartX - 12, cartY + 6);
  ctx.stroke();
}

// 149. Balloon Dart
function drawBalloonDartArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#111827';
  ctx.fillRect(x, y, w, h);
  // Cork wheel
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 26, 0, Math.PI * 2);
  ctx.fill();
  // Multi balloons
  const cols = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B'];
  cols.forEach((col, i) => {
    const a = (i * Math.PI) / 2;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x + w * 0.5 + Math.cos(a) * 14, y + h * 0.5 + Math.sin(a) * 14, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  // Dart
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.5);
  ctx.lineTo(x + w * 0.5 - 10, y + h * 0.5 + 8);
  ctx.lineTo(x + w * 0.5 - 6, y + h * 0.5 + 10);
  ctx.closePath();
  ctx.fill();
}

// 150. Dunk Tank
function drawDunkTankArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);
  // Water tank
  ctx.fillStyle = 'rgba(6, 182, 212, 0.7)';
  ctx.fillRect(x + w * 0.35, y + h * 0.45, w * 0.5, h * 0.4);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + w * 0.35, y + h * 0.45, w * 0.5, h * 0.4);
  // Bullseye target arm
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + h * 0.55);
  ctx.lineTo(x + w * 0.15, y + h * 0.55);
  ctx.stroke();
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.arc(x + w * 0.15, y + h * 0.55, 9, 0, Math.PI * 2);
  ctx.fill();
}

// 151. Ferris Wheel
function drawFerrisWheelArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(x, y, w, h);
  // Neon wheel rim
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.stroke();
  // Spokes & Gondolas
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
    ctx.stroke();
    // Gondola dot
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 152. Funhouse Mirrors
function drawFunhouseMirrorsArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Carnival tent interior
  ctx.fillStyle = '#1c101e';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Ornate Brass Gilded Funhouse Mirror Frame
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 24, cy - 20, 48, 40, 6);
  else ctx.rect(cx - 24, cy - 20, 48, 40);
  ctx.fill();

  // Marquee Vanity Bulbs along frame
  const bulbCoords = [
    [cx - 22, cy - 18], [cx, cy - 18], [cx + 22, cy - 18],
    [cx - 22, cy + 18], [cx, cy + 18], [cx + 22, cy + 18],
    [cx - 22, cy], [cx + 22, cy]
  ];
  for (const [bx, by] of bulbCoords) {
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(bx, by, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Wavy Distorted Mirror Glass (Cyan / Blue Gradient)
  const mirGrad = ctx.createLinearGradient(cx, cy - 16, cx, cy + 16);
  mirGrad.addColorStop(0, '#0284c7');
  mirGrad.addColorStop(0.5, '#38bdf8');
  mirGrad.addColorStop(1, '#0369a1');
  ctx.fillStyle = mirGrad;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 19, cy - 15, 38, 30, 4);
  else ctx.rect(cx - 19, cy - 15, 38, 30);
  ctx.fill();

  // Mirror glass warp distortion lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - 10);
  ctx.bezierCurveTo(cx - 6, cy - 4, cx - 12, cy + 4, cx - 16, cy + 10);
  ctx.moveTo(cx + 16, cy - 10);
  ctx.bezierCurveTo(cx + 6, cy - 4, cx + 12, cy + 4, cx + 16, cy + 10);
  ctx.stroke();

  // Comical Stretched Elastic Figure in center
  const pX = cx;
  const pY = cy;

  // Stretched rubbery torso
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(pX - 4, pY - 8);
  ctx.bezierCurveTo(pX - 10, pY, pX - 2, pY + 8, pX - 5, pY + 12);
  ctx.lineTo(pX + 5, pY + 12);
  ctx.bezierCurveTo(pX + 2, pY + 8, pX + 10, pY, pX + 4, pY - 8);
  ctx.closePath();
  ctx.fill();

  // Goofy Oversized Head & Giant Grin
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(pX, pY - 9, 6, 0, Math.PI * 2);
  ctx.fill();

  // Cartoon Googly Eyes
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(pX - 2, pY - 10, 1.5, 0, Math.PI * 2);
  ctx.arc(pX + 2.5, pY - 10, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Giant stretched toothy smile
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(pX, pY - 8, 3.5, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

// 153. Cotton Candy
function drawCottonCandyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Carnival night booth
  ctx.fillStyle = '#1e1026';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Background candy sparkles / sprinkles
  const sprinkles = [
    [x + 12, y + 12, '#38bdf8'],
    [x + w - 14, y + 14, '#fde047'],
    [x + 16, y + h - 14, '#a855f7'],
    [x + w - 16, y + h - 12, '#34d399']
  ];
  for (const [sx, sy, col] of sprinkles) {
    ctx.fillStyle = col as string;
    ctx.beginPath();
    ctx.arc(sx as number, sy as number, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Paper Cone Stick (White with Red Barber-pole Spiral Stripes)
  const stickX = cx;
  const stickTop = cy - 2;
  const stickBot = y + h - 8;

  // White base cone
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(stickX - 3.5, stickTop);
  ctx.lineTo(stickX + 3.5, stickTop);
  ctx.lineTo(stickX + 1, stickBot);
  ctx.lineTo(stickX - 1, stickBot);
  ctx.closePath();
  ctx.fill();

  // Red spiral stripes on cone
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(stickX - 3, stickTop + 4); ctx.lineTo(stickX + 2.5, stickTop + 8);
  ctx.moveTo(stickX - 2, stickTop + 12); ctx.lineTo(stickX + 2, stickTop + 16);
  ctx.stroke();

  // Enormous Fluffy Two-Tone Cotton Candy Cloud
  const puffY = cy - 8;

  // Base Electric Pink Puff
  ctx.fillStyle = '#f472b6';
  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx - 6, puffY + 2, 13, 0, Math.PI * 2);
  ctx.arc(cx + 6, puffY + 2, 13, 0, Math.PI * 2);
  ctx.arc(cx, puffY - 6, 14, 0, Math.PI * 2);
  ctx.fill();

  // Frost Cyan Swirled Puff layer
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#0284c7';
  ctx.beginPath();
  ctx.arc(cx + 4, puffY - 4, 11, 0, Math.PI * 2);
  ctx.arc(cx - 3, puffY + 4, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Delicate Gossamer Spun Sugar Strands
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx - 2, puffY - 6, 11, 0.4, 2.8);
  ctx.arc(cx + 3, puffY + 1, 10, 2.5, 4.8);
  ctx.stroke();

  // Golden sugar crystal sparkle on top
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(cx - 2, puffY - 14, 2, 0, Math.PI * 2);
  ctx.fill();
}

// 154. Test Your Strength
function drawTestStrengthArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Carnival high-striker arcade
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Striker Tower Backboard (Wood Grain)
  const towX = cx - 8;
  ctx.fillStyle = '#78350f';
  ctx.fillRect(towX - 6, y + 10, 12, h - 22);

  // Power Gauge Rail (Green -> Amber -> Red Gradient)
  const pGrad = ctx.createLinearGradient(towX, y + h - 14, towX, y + 14);
  pGrad.addColorStop(0, '#22c55e');
  pGrad.addColorStop(0.5, '#f59e0b');
  pGrad.addColorStop(1, '#ef4444');
  ctx.fillStyle = pGrad;
  ctx.fillRect(towX - 3, y + 14, 6, h - 30);

  // Graduation tick marks
  ctx.fillStyle = '#ffffff';
  for (let gy = y + 18; gy < y + h - 18; gy += 6) {
    ctx.fillRect(towX + 4, gy, 3, 1);
  }

  // Golden Brass Bell at summit
  const bellX = towX;
  const bellY = y + 13;
  ctx.fillStyle = '#facc15';
  ctx.shadowColor = '#eab308';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(bellX, bellY, 8, Math.PI, 0);
  ctx.lineTo(bellX + 9, bellY + 3);
  ctx.lineTo(bellX - 9, bellY + 3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ringing Impact Soundwave Shockwaves
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(bellX, bellY, 13, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.stroke();

  // Speeding Metal Puck flying upward
  const puckY = cy - 2;
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 6;
  ctx.fillRect(towX - 5, puckY, 10, 4);
  ctx.shadowBlur = 0;

  // Motion speed streaks under puck
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(towX - 2, puckY + 5); ctx.lineTo(towX - 2, puckY + 15);
  ctx.moveTo(towX + 2, puckY + 5); ctx.lineTo(towX + 2, puckY + 15);
  ctx.stroke();

  // Sledgehammer striking the anvil pad at bottom right
  const hamX = cx + 14;
  const hamY = cy + 12;
  ctx.save();
  ctx.translate(hamX, hamY);
  ctx.rotate(-0.4);

  // Wooden shaft
  ctx.fillStyle = '#92400e';
  ctx.fillRect(-2, -18, 4, 24);

  // Heavy steel sledgehammer head
  ctx.fillStyle = '#475569';
  ctx.fillRect(-9, -22, 18, 8);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-7, -20, 14, 4);
  ctx.restore();

  // Rubber anvil pad at bottom
  ctx.fillStyle = '#020617';
  ctx.fillRect(towX - 8, y + h - 14, 16, 6);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(towX - 6, y + h - 16, 12, 3);
}

// 155. Haunted Mansion
function drawHauntedMansionArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Midnight stormy sky
  ctx.fillStyle = '#090514';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Giant Full Moon behind mansion
  const mGrad = ctx.createRadialGradient(cx + 12, y + 14, 2, cx + 12, y + 14, 20);
  mGrad.addColorStop(0, '#fef08a');
  mGrad.addColorStop(0.5, '#fde68a');
  mGrad.addColorStop(1, 'rgba(254, 230, 138, 0)');
  ctx.fillStyle = mGrad;
  ctx.beginPath();
  ctx.arc(cx + 12, y + 14, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath();
  ctx.arc(cx + 12, y + 14, 11, 0, Math.PI * 2);
  ctx.fill();

  // Flying Bats silhouettes across moon
  ctx.fillStyle = '#090514';
  ctx.beginPath();
  ctx.moveTo(cx + 16, y + 8);
  ctx.lineTo(cx + 12, y + 5);
  ctx.lineTo(cx + 15, y + 9);
  ctx.lineTo(cx + 19, y + 6);
  ctx.closePath();
  ctx.fill();

  // Crooked Victorian Haunted Mansion Silhouette
  const hX = cx - 6;
  const hY = cy + 4;
  ctx.fillStyle = '#1e1b4b';

  // Main house tower & pitched roofs
  ctx.beginPath();
  ctx.moveTo(hX - 16, y + h);
  ctx.lineTo(hX - 16, hY + 2);
  ctx.lineTo(hX - 8, hY - 14); // Steep roof peak
  ctx.lineTo(hX, hY - 4);
  ctx.lineTo(hX + 16, hY - 18); // Tower spire
  ctx.lineTo(hX + 22, hY + 4);
  ctx.lineTo(hX + 22, y + h);
  ctx.closePath();
  ctx.fill();

  // Crooked Chimney
  ctx.fillRect(hX - 14, hY - 16, 4, 8);

  // Eerie Glowing Yellow Attic Windows
  ctx.fillStyle = '#fde047';
  ctx.shadowColor = '#eab308';
  ctx.shadowBlur = 6;
  ctx.fillRect(hX + 4, hY - 8, 4, 5);
  ctx.fillRect(hX - 6, hY + 2, 4, 4);
  ctx.shadowBlur = 0;

  // Glowing Ectoplasmic Ghost hovering over roof
  const gX = cx - 12;
  const gY = cy - 8;
  ctx.fillStyle = 'rgba(168, 85, 247, 0.85)';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 8;
  // Ghost head
  ctx.beginPath();
  ctx.arc(gX, gY, 6, 0, Math.PI * 2);
  ctx.fill();
  // Wispy tail
  ctx.beginPath();
  ctx.moveTo(gX - 5, gY + 3);
  ctx.quadraticCurveTo(gX - 10, gY + 12, gX - 2, gY + 14);
  ctx.quadraticCurveTo(gX + 4, gY + 10, gX + 5, gY + 3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ghost glowing cyan eyes
  ctx.fillStyle = '#00ffff';
  ctx.beginPath();
  ctx.arc(gX - 2, gY - 1, 1.2, 0, Math.PI * 2);
  ctx.arc(gX + 2, gY - 1, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

// 156. Fireworks Finale
function drawFireworksFinaleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#030712';
  ctx.fillRect(x, y, w, h);
  // Exploding Starburst
  const cx = x + w * 0.5;
  const cy = y + h * 0.45;
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
    ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
    ctx.stroke();
  }
  // Golden Sparkle Center
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

// --- Batch 11: Ancient Wonders & Mythological Trials ---
function drawHydraSlayerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0b1d12';
  ctx.fillRect(x, y, w, h);
  // Swamp water
  ctx.fillStyle = '#1e8449';
  ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
  // Hydra heads
  const cx = x + w * 0.5;
  const cy = y + h * 0.45;
  ctx.strokeStyle = '#27ae60';
  ctx.lineWidth = 4;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, y + h * 0.7);
    ctx.quadraticCurveTo(cx + i * 20, cy, cx + i * 15, cy - 12);
    ctx.stroke();
    // Head
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(cx + i * 15, cy - 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(cx + i * 15 - 1, cy - 14, 2, 2);
  }
}

function drawPharaohTombArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#3d2b1f';
  ctx.fillRect(x, y, w, h);
  // Floor
  ctx.fillStyle = '#654321';
  ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
  // Granite Boulder
  ctx.fillStyle = '#5d6d7e';
  ctx.beginPath();
  ctx.arc(x + w * 0.32, y + h * 0.55, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Runner
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(x + w * 0.7, y + h * 0.45, 10, 16);
  // Spikes
  ctx.fillStyle = '#bdc3c7';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.55, y + h * 0.7);
  ctx.lineTo(x + w * 0.6, y + h * 0.58);
  ctx.lineTo(x + w * 0.65, y + h * 0.7);
  ctx.fill();
}

function drawSpartanShieldArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#5b3924';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Bronze Aspis Shield
  ctx.fillStyle = '#d4ac0d';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7d6608';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Spartan Lambda (Λ)
  ctx.strokeStyle = '#900c3f';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + 9);
  ctx.lineTo(cx, cy - 8);
  ctx.lineTo(cx + 8, cy + 9);
  ctx.stroke();
}

function drawKrakenWhirlpoolArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f2b48';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Vortex spiral
  ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 1.5);
  ctx.stroke();
  // Kraken Tentacle
  ctx.fillStyle = '#16a085';
  ctx.beginPath();
  ctx.ellipse(cx + 10, cy - 6, 6, 18, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Small Viking Ship
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy + 8);
  ctx.lineTo(cx - 4, cy + 14);
  ctx.lineTo(cx - 18, cy + 14);
  ctx.closePath();
  ctx.fill();
}

function drawIcarusWingsArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, '#f39c12');
  bgGrad.addColorStop(0.6, '#85c1e9');
  bgGrad.addColorStop(1, '#1b4f72');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);
  // Golden Sun
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(x + w * 0.8, y + h * 0.25, 12, 0, Math.PI * 2);
  ctx.fill();
  // Feathered Wings
  const cx = x + w * 0.45;
  const cy = y + h * 0.55;
  ctx.fillStyle = '#ecf0f1';
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy);
  ctx.lineTo(cx - 16, cy - 10);
  ctx.lineTo(cx - 8, cy + 6);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy);
  ctx.lineTo(cx + 16, cy - 10);
  ctx.lineTo(cx + 8, cy + 6);
  ctx.fill();
  // Body
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawMinotaurLabyrinthArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#2c1e13';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Circular maze tracks
  ctx.strokeStyle = '#795548';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.stroke();
  // Minotaur
  ctx.fillStyle = '#78281f';
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  // Horns
  ctx.strokeStyle = '#f5b041';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy - 3);
  ctx.lineTo(cx - 8, cy - 7);
  ctx.moveTo(cx + 4, cy - 3);
  ctx.lineTo(cx + 8, cy - 7);
  ctx.stroke();
}

function drawOlympusLightningArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Mount Olympus stormy sky
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#1e1035');
  sky.addColorStop(0.5, '#3b0764');
  sky.addColorStop(1, '#090514');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Swirling Thunderstorm Clouds at summit
  ctx.fillStyle = '#2e1065';
  ctx.beginPath();
  ctx.arc(cx - 16, y + 10, 14, 0, Math.PI * 2);
  ctx.arc(cx + 12, y + 8, 16, 0, Math.PI * 2);
  ctx.arc(cx, y + 14, 12, 0, Math.PI * 2);
  ctx.fill();

  // Greek Corinthian Marble Column Summit at bottom
  ctx.fillStyle = '#f8fafc';
  // Capital cornice
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 16, y + h - 16, 32, 6, 2);
  else ctx.rect(cx - 16, y + h - 16, 32, 6);
  ctx.fill();
  // Fluted column shaft
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(cx - 12, y + h - 10, 24, 10);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + h - 10); ctx.lineTo(cx - 6, y + h);
  ctx.moveTo(cx, y + h - 10); ctx.lineTo(cx, y + h);
  ctx.moveTo(cx + 6, y + h - 10); ctx.lineTo(cx + 6, y + h);
  ctx.stroke();

  // Zeus's Divine Thunderbolt (Cracking bifurcated lightning bolt)
  ctx.strokeStyle = '#38bdf8';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(cx - 8, y + 10);
  ctx.lineTo(cx + 4, cy - 8);
  ctx.lineTo(cx - 4, cy);
  ctx.lineTo(cx + 6, y + h - 16);
  ctx.stroke();

  // Blazing White-Hot Core of Lightning
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Secondary Golden Electric Branch Tendril
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 8);
  ctx.lineTo(cx + 18, cy - 2);
  ctx.lineTo(cx + 14, cy + 8);
  ctx.stroke();

  // Impact Sparks on Marble Pillar
  const spX = cx + 6;
  const spY = y + h - 16;
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(spX, spY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(spX - 6, spY - 3, 1.5, 0, Math.PI * 2);
  ctx.arc(spX + 6, spY - 4, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawAnubisScalesArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Ancient Egyptian temple chamber of judgment
  ctx.fillStyle = '#1c100c';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Ornate Golden Balance Post with Jackal Head Finial
  ctx.fillStyle = '#b45309';
  ctx.fillRect(cx - 2, cy - 18, 4, 36);

  // Base stand
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 18, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Anubis Jackal Head Emblem atop balance
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Jackal tall ears
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy - 20); ctx.lineTo(cx - 5, cy - 26); ctx.lineTo(cx - 1, cy - 21);
  ctx.moveTo(cx + 3, cy - 20); ctx.lineTo(cx + 5, cy - 26); ctx.lineTo(cx + 1, cy - 21);
  ctx.fill();

  // Golden Balance Crossbeam
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(cx - 22, cy - 14, 44, 3.5);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(cx - 22, cy - 14, 44, 1);

  // Left Pan Suspension Chains
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 11); ctx.lineTo(cx - 23, cy + 6);
  ctx.moveTo(cx - 18, cy - 11); ctx.lineTo(cx - 13, cy + 6);
  ctx.stroke();

  // Left Golden Pan (Holding Feather of Ma'at)
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(cx - 18, cy + 6, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Luminous Sky-Blue Feather of Truth (Ma'at)
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.ellipse(cx - 18, cy + 2, 3, 6, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Feather quill
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 19, cy + 6); ctx.lineTo(cx - 17, cy - 2);
  ctx.stroke();

  // Right Pan Suspension Chains
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 18, cy - 11); ctx.lineTo(cx + 13, cy + 6);
  ctx.moveTo(cx + 18, cy - 11); ctx.lineTo(cx + 23, cy + 6);
  ctx.stroke();

  // Right Golden Pan (Holding Sacred Heart)
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(cx + 18, cy + 6, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sacred Ruby Heart of the Pharaoh
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#f87171';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(cx + 16.5, cy + 1, 2.5, Math.PI, 0);
  ctx.arc(cx + 19.5, cy + 1, 2.5, Math.PI, 0);
  ctx.lineTo(cx + 18, cy + 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawGorgonGazeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#17202a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.45;
  const cy = y + h * 0.5;
  // Medusa face
  ctx.fillStyle = '#1e8449';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  // Emerald glowing eyes
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 2, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Mirror Shield deflecting
  ctx.fillStyle = '#ecf0f1';
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x + w * 0.75, cy, 4, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawVikingLongshipArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e3c54';
  ctx.fillRect(x, y, w, h);
  // Water
  ctx.fillStyle = '#152536';
  ctx.fillRect(x, y + h * 0.65, w, h * 0.35);
  // Wooden Hull
  const cx = x + w * 0.5;
  const cy = y + h * 0.6;
  ctx.fillStyle = '#6e2c00';
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.lineTo(cx + 16, cy + 10);
  ctx.lineTo(cx - 18, cy + 10);
  ctx.closePath();
  ctx.fill();
  // Striped Sail
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(cx - 8, cy - 18, 16, 14);
  // War Drum
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(cx + 12, cy - 4, 5, 0, Math.PI * 2);
  ctx.fill();
}

// --- Batch 12: Deep Space Odyssey & Cosmic Anomalies ---
function drawAntimatterContainmentArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep space laboratory void
  ctx.fillStyle = '#050510';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Background stars
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(x + 10, y + 8, 1, 0, Math.PI * 2);
  ctx.arc(x + w - 12, y + 14, 1.2, 0, Math.PI * 2);
  ctx.arc(x + 14, y + h - 10, 1, 0, Math.PI * 2);
  ctx.fill();

  // Magnetic Confinement Ring (Titanium Chasis with Coils)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, Math.PI * 2);
  ctx.stroke();

  // Superconducting magnetic coil nodes
  const coils = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  for (const angle of coils) {
    const kx = cx + Math.cos(angle) * 21;
    const ky = cy + Math.sin(angle) * 21;
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(kx, ky, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(kx, ky, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Antimatter Accretion Disc Bloom
  const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.3, '#38bdf8');
  coreGrad.addColorStop(0.7, '#a855f7');
  coreGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();

  // Pure Singularity Core (Black Void Center)
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Magnetic Flux Arcs connecting to containment ring
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy); ctx.lineTo(cx - 16, cy - 8);
  ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 16, cy + 8);
  ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 8, cy - 16);
  ctx.stroke();
}

function drawWarpGateJumpArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep space backdrop
  ctx.fillStyle = '#04020e';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Massive Circular Warp Portal Ring
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Hyperspace Event Horizon Vortex
  const vGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 20);
  vGrad.addColorStop(0, '#ffffff');
  vGrad.addColorStop(0.3, '#38bdf8');
  vGrad.addColorStop(0.7, '#6366f1');
  vGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = vGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 19, 0, Math.PI * 2);
  ctx.fill();

  // Swirling Hyperspace Tunnel Rings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 14, 8, 0.4, 0, Math.PI * 2);
  ctx.ellipse(cx, cy, 7, 4, 0.4, 0, Math.PI * 2);
  ctx.stroke();

  // Warp Gate Pylon Emitters (Cyan & Emerald)
  for (let p = 0; p < 6; p++) {
    const angle = (p * Math.PI) / 3;
    const px = cx + Math.cos(angle) * 22;
    const py = cy + Math.sin(angle) * 22;
    ctx.fillStyle = p % 2 === 0 ? '#00e5ff' : '#10b981';
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Starship Diving into Portal
  const sX = cx - 2;
  const sY = cy + 2;
  ctx.save();
  ctx.translate(sX, sY);
  ctx.rotate(-0.75);

  // Wedge hull
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-8, -6);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 6);
  ctx.closePath();
  ctx.fill();

  // Twin Cyan Ion Thruster Plumes
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(-6, -4); ctx.lineTo(-14, -4); ctx.lineTo(-6, -2);
  ctx.moveTo(-6, 2); ctx.lineTo(-14, 4); ctx.lineTo(-6, 4);
  ctx.fill();
  ctx.restore();
}

function drawSolarSailRiderArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Blazing solar corona gradient
  const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  bgGrad.addColorStop(0, '#f97316');
  bgGrad.addColorStop(0.4, '#b45309');
  bgGrad.addColorStop(1, '#090514');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Sun flare glow on left
  const sunGrad = ctx.createRadialGradient(x, y + h * 0.5, 5, x, y + h * 0.5, 38);
  sunGrad.addColorStop(0, '#fef08a');
  sunGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.4)');
  sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(x, y + h * 0.5, 38, 0, Math.PI * 2);
  ctx.fill();

  // Giant Gossamer Iridescent Solar Sail (Diamond)
  const sailX = cx + 4;
  const sailY = cy;

  // Diamond sail body
  const sailGrad = ctx.createLinearGradient(sailX - 18, sailY, sailX + 16, sailY);
  sailGrad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
  sailGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.8)');
  sailGrad.addColorStop(1, 'rgba(244, 63, 94, 0.7)');
  ctx.fillStyle = sailGrad;
  ctx.beginPath();
  ctx.moveTo(sailX - 8, sailY - 20);
  ctx.lineTo(sailX + 18, sailY);
  ctx.lineTo(sailX - 8, sailY + 20);
  ctx.lineTo(sailX - 16, sailY);
  ctx.closePath();
  ctx.fill();

  // Carbon composite sail spars
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sailX - 8, sailY - 20); ctx.lineTo(sailX - 8, sailY + 20);
  ctx.moveTo(sailX - 16, sailY); ctx.lineTo(sailX + 18, sailY);
  ctx.stroke();

  // Central Science Payload Capsule
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(sailX - 8, sailY, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(sailX - 10, sailY - 1, 4, 2);
}

function drawPlanetaryRoverArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Red planet starry night sky
  ctx.fillStyle = '#1c0a06';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Ringed Gas Giant visible on horizon
  const pX = x + w - 16;
  const pY = y + 14;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(pX, pY, 7, 0, Math.PI * 2);
  ctx.fill();
  // Planetary Rings
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(pX, pY, 14, 4, -0.4, 0, Math.PI * 2);
  ctx.stroke();

  // Layered Martian Dunes
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.moveTo(x, cy + 4);
  ctx.quadraticCurveTo(cx - 10, cy, cx + 10, cy + 6);
  ctx.quadraticCurveTo(cx + 25, cy + 10, x + w, cy + 4);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#9a3412';
  ctx.beginPath();
  ctx.moveTo(x, cy + 12);
  ctx.quadraticCurveTo(cx, cy + 8, x + w, cy + 14);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();

  // High-Tech 6-Wheel Exploration Rover
  const rX = cx - 6;
  const rY = cy + 6;

  // Rover Chassis Body
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(rX - 12, rY - 8, 24, 10, 2);
  else ctx.rect(rX - 12, rY - 8, 24, 10);
  ctx.fill();

  // Solar array panel on rover top
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(rX - 8, rY - 10, 16, 2);

  // Camera Mast with optical lens
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rX + 6, rY - 8);
  ctx.lineTo(rX + 6, rY - 16);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(rX + 6, rY - 16, 2, 0, Math.PI * 2);
  ctx.fill();

  // 6 Rugged All-Terrain Rover Wheels
  const wheelXs = [-9, 0, 9];
  for (const wx of wheelXs) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(rX + wx, rY + 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(rX + wx, rY + 4, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing Alien Crystal sample discovered on right
  const cryX = cx + 22;
  const cryY = cy + 10;
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(cryX, cryY - 6);
  ctx.lineTo(cryX + 3, cryY);
  ctx.lineTo(cryX, cryY + 4);
  ctx.lineTo(cryX - 3, cryY);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPulsarSignalArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep cosmos
  ctx.fillStyle = '#050714';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Spinning Pulsar Neutron Star
  const pulX = cx + 12;
  const pulY = cy - 8;

  // Relativistic Radiation Jet Cones (Opposing beams)
  const jetGrad1 = ctx.createLinearGradient(pulX, pulY, pulX - 22, pulY + 16);
  jetGrad1.addColorStop(0, '#ffffff');
  jetGrad1.addColorStop(0.5, '#38bdf8');
  jetGrad1.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = jetGrad1;
  ctx.beginPath();
  ctx.moveTo(pulX, pulY);
  ctx.lineTo(pulX - 24, pulY + 10);
  ctx.lineTo(pulX - 18, pulY + 20);
  ctx.closePath();
  ctx.fill();

  // Opposite jet cone
  const jetGrad2 = ctx.createLinearGradient(pulX, pulY, pulX + 18, pulY - 14);
  jetGrad2.addColorStop(0, '#ffffff');
  jetGrad2.addColorStop(0.5, '#a855f7');
  jetGrad2.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = jetGrad2;
  ctx.beginPath();
  ctx.moveTo(pulX, pulY);
  ctx.lineTo(pulX + 16, pulY - 16);
  ctx.lineTo(pulX + 22, pulY - 8);
  ctx.closePath();
  ctx.fill();

  // Pulsar Star Core
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(pulX, pulY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Deep-Space Radio Parabolic Observatory Dish on left
  const dishX = cx - 14;
  const dishY = cy + 10;
  ctx.save();
  ctx.translate(dishX, dishY);
  ctx.rotate(-0.65);

  // Dish bowl
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 14, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Receiver horn & mount
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(-6, -2, 6, 4);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(10, 0);
  ctx.stroke();
  ctx.restore();

  // Concentric Radio Wave Signal Rings arriving
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(pulX, pulY, 12, 2.2, 3.8);
  ctx.arc(pulX, pulY, 20, 2.2, 3.8);
  ctx.stroke();
}

function drawAsteroidCatcherArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep space asteroid belt
  ctx.fillStyle = '#080c16';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Distant space rocks
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(x + 12, y + 12, 3, 0, Math.PI * 2);
  ctx.arc(x + w - 14, y + 16, 4, 0, Math.PI * 2);
  ctx.fill();

  // Industrial Mining Tug Ship at top
  const shipX = cx;
  const shipY = y + 10;
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(shipX - 16, shipY, 32, 12, 3);
  else ctx.rect(shipX - 16, shipY, 32, 12);
  ctx.fill();

  // Cockpit canopy & hazard stripes
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(shipX - 8, shipY + 2, 16, 4);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(shipX - 16, shipY + 9, 32, 3);

  // Reinforced Tungsten Harpoon Cable extending down
  const astX = cx - 4;
  const astY = cy + 10;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(shipX, shipY + 12);
  ctx.lineTo(astX, astY);
  ctx.stroke();

  // Golden Mineral-Rich Asteroid
  const aGrad = ctx.createRadialGradient(astX - 3, astY - 3, 2, astX, astY, 14);
  aGrad.addColorStop(0, '#fef08a');
  aGrad.addColorStop(0.5, '#f59e0b');
  aGrad.addColorStop(1, '#78350f');
  ctx.fillStyle = aGrad;
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 6;

  // Organic asteroid polygon
  ctx.beginPath();
  ctx.moveTo(astX - 12, astY - 4);
  ctx.lineTo(astX - 6, astY - 12);
  ctx.lineTo(astX + 8, astY - 10);
  ctx.lineTo(astX + 14, astY - 2);
  ctx.lineTo(astX + 10, astY + 10);
  ctx.lineTo(astX - 4, astY + 12);
  ctx.lineTo(astX - 12, astY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Impact Harpoon Tip & Mining Drill Sparks
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(astX, astY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(astX - 4, astY - 2, 1.5, 0, Math.PI * 2);
  ctx.arc(astX + 5, astY + 3, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawAlienAbductionArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Midnight country pasture under starlight
  ctx.fillStyle = '#060b18';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Full Moon in upper right
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(x + w - 14, y + 12, 6, 0, Math.PI * 2);
  ctx.fill();

  // Pasture ground hill at bottom
  ctx.fillStyle = '#14532d';
  ctx.beginPath();
  ctx.ellipse(cx, y + h, w * 0.6, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wooden fence posts on ground
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + 12, y + h - 14, 3, 14);
  ctx.fillRect(x + 22, y + h - 14, 3, 14);
  ctx.fillRect(x + 10, y + h - 10, 16, 2);

  // Glowing Conical Tractor Beam (Neon Cyan / Lime)
  const beamGrad = ctx.createLinearGradient(cx, y + 18, cx, y + h - 4);
  beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
  beamGrad.addColorStop(0.6, 'rgba(163, 230, 53, 0.45)');
  beamGrad.addColorStop(1, 'rgba(163, 230, 53, 0.05)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 8, y + 16);
  ctx.lineTo(cx + 8, y + 16);
  ctx.lineTo(cx + 22, y + h - 4);
  ctx.lineTo(cx - 22, y + h - 4);
  ctx.closePath();
  ctx.fill();

  // Floating Abducted Cow in zero-gravity
  const cowX = cx;
  const cowY = cy + 4;
  ctx.save();
  ctx.translate(cowX, cowY);
  ctx.rotate(0.2);

  // Cow body (White)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Black Holstein patches
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(-2, -2, 3, 0, Math.PI * 2);
  ctx.arc(4, 1, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Cow head & pink muzzle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(9, -2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.arc(11, -1, 2, 0, Math.PI * 2);
  ctx.fill();

  // Dangling legs
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-6, 4, 2, 5);
  ctx.fillRect(4, 4, 2, 5);
  ctx.restore();

  // Metallic UFO Saucer hovering above
  const ufoY = y + 14;
  // Glass dome cockpit
  ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
  ctx.beginPath();
  ctx.arc(cx, ufoY - 2, 7, Math.PI, 0);
  ctx.fill();

  // Alien pilot silhouette in dome
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(cx, ufoY - 3, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Metallic Saucer Disk
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.ellipse(cx, ufoY, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rotating glowing perimeter lights
  const ufoLights = [-14, -7, 0, 7, 14];
  for (const lx of ufoLights) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(cx + lx, ufoY + 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpaceElevatorArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const bgGrad = ctx.createLinearGradient(0, y + h, 0, y);
  bgGrad.addColorStop(0, '#154360');
  bgGrad.addColorStop(1, '#05070a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  // Cable
  ctx.strokeStyle = '#bdc3c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx, y + h);
  ctx.stroke();
  // Climber
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.roundRect(cx - 7, y + h * 0.45, 14, 22, 4);
  ctx.fill();
  // Boost ring
  ctx.strokeStyle = '#00e676';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.3, 14, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawOrbitalDropPodArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#4a1512';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.45;
  // Re-entry Flames
  ctx.strokeStyle = '#f39c12';
  ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 8, cy + 12);
    ctx.lineTo(cx + i * 14, cy + 26);
    ctx.stroke();
  }
  // Pod
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx + 10, cy + 10);
  ctx.lineTo(cx - 10, cy + 10);
  ctx.closePath();
  ctx.fill();
  // Heat shield
  ctx.fillStyle = '#ff1744';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDysonSphereCollectorArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep space cosmos with nebula haze
  ctx.fillStyle = '#060612';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Background Nebula Haze
  const neb = ctx.createRadialGradient(cx, cy, 5, cx, cy, 34);
  neb.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
  neb.addColorStop(0.5, 'rgba(168, 85, 247, 0.2)');
  neb.addColorStop(1, 'rgba(6, 6, 18, 0)');
  ctx.fillStyle = neb;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fill();

  // Blazing Central Star (Solar Corona)
  const sunGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
  sunGrad.addColorStop(0, '#ffffff');
  sunGrad.addColorStop(0.3, '#fef08a');
  sunGrad.addColorStop(0.7, '#f59e0b');
  sunGrad.addColorStop(1, '#ea580c');
  ctx.fillStyle = sunGrad;
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Solar flare prominences
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx - 8, cy - 8, 8, -0.2, 1.2);
  ctx.arc(cx + 8, cy + 6, 8, 2.8, 4.2);
  ctx.stroke();

  // Dyson Megastructure Orbital Lattice Rings
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 24, 9, 0.45, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 24, 9, -0.45, 0, Math.PI * 2);
  ctx.stroke();

  // Photovoltaic Harvester Collector Panels orbiting along rings
  const panels = [
    [cx - 18, cy - 8],
    [cx + 18, cy + 8],
    [cx - 16, cy + 9],
    [cx + 16, cy - 9]
  ];
  for (const [px, py] of panels) {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(px - 2.5, py - 2.5, 5, 5);
  }

  // Foreground Solar Harvester Drone on right capturing plasma
  const drX = cx + 18;
  const drY = cy;
  ctx.fillStyle = '#00ffff';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 6;
  ctx.fillRect(drX - 3, drY - 3, 6, 6);
  ctx.shadowBlur = 0;

  // Plasma capture beam from sun to drone
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy);
  ctx.lineTo(drX, drY);
  ctx.stroke();
}

function drawPenguinSlideArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Slalom track
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 10);
  ctx.bezierCurveTo(cx - 15, cy - 10, cx + 15, cy + 10, x + w - 10, y + h - 10);
  ctx.stroke();
  // Penguin sliding
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 14, 7, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, 9, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(cx + 12, cy + 4, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawIcebergBreakerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Ice floes
  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.moveTo(cx + 5, cy - 18);
  ctx.lineTo(cx + 25, cy - 12);
  ctx.lineTo(cx + 18, cy + 10);
  ctx.lineTo(cx + 2, cy + 5);
  ctx.closePath();
  ctx.fill();
  // Ship hull
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 10);
  ctx.lineTo(cx + 8, cy - 10);
  ctx.lineTo(cx + 18, cy);
  ctx.lineTo(cx + 8, cy + 10);
  ctx.lineTo(cx - 24, cy + 10);
  ctx.closePath();
  ctx.fill();
  // Bow ram spark
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + 18, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBlizzardBeaconArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Light cone
  const coneGrad = ctx.createRadialGradient(cx, cy, 2, cx + 22, cy - 12, 35);
  coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
  coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 34, cy - 24);
  ctx.lineTo(cx + 38, cy + 6);
  ctx.closePath();
  ctx.fill();
  // Lighthouse tower
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(cx - 6, cy - 6, 12, 22);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx - 7, cy - 14, 14, 8);
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(cx, cy - 10, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawWalrusBaskArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Ice berg platform
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 28, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Walrus body
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 16, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tusks
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx + 6, cy + 4, 3, 8);
  ctx.fillRect(cx + 11, cy + 4, 3, 8);
  // Eye
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx + 8, cy - 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPolarIceFishingArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(x, y, w, h);
  // Top ice sheet
  ctx.fillStyle = '#f0f9ff';
  ctx.fillRect(x, y, w, h * 0.35);
  const cx = x + w * 0.5;
  // Ice hole
  ctx.fillStyle = '#0369a1';
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.35, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Fishing line & glowing lure
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.35);
  ctx.lineTo(cx, y + h * 0.72);
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.72, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawAuroraCollectorArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#050b14';
  ctx.fillRect(x, y, w, h);
  // Aurora ribbon
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#10b981');
  grad.addColorStop(0.5, '#06b6d4');
  grad.addColorStop(1, '#ec4899');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 25);
  ctx.bezierCurveTo(x + w * 0.3, y + 5, x + w * 0.7, y + 45, x + w - 5, y + 15);
  ctx.stroke();
  // Prism crystal
  const cx = x + w * 0.5;
  const cy = y + h * 0.65;
  ctx.fillStyle = '#a78bfa';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx + 10, cy);
  ctx.lineTo(cx, cy + 12);
  ctx.lineTo(cx - 10, cy);
  ctx.closePath();
  ctx.fill();
}

function drawDogSledDashArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#334155';
  ctx.fillRect(x, y, w, h);
  // Snow ground
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x, y + h * 0.65, w, h * 0.35);
  const cy = y + h * 0.62;
  // Sled
  ctx.fillStyle = '#b45309';
  ctx.fillRect(x + 8, cy - 8, 16, 6);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 6, cy);
  ctx.lineTo(x + 26, cy);
  ctx.stroke();
  // Harness lines
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 24, cy - 4);
  ctx.lineTo(x + 36, cy - 4);
  ctx.stroke();
  // Husky
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.ellipse(x + 42, cy - 6, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x + 43, cy - 4, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMammothStampedeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Mammoth body
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy - 2, 18, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.ellipse(cx + 10, cy - 5, 10, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // Curved Tusk
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx + 14, cy - 2, 12, 0.2, Math.PI * 0.7);
  ctx.stroke();
  // Trunk
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + 14, cy - 2);
  ctx.quadraticCurveTo(cx + 22, cy + 6, cx + 18, cy + 14);
  ctx.stroke();
}

function drawFrostbiteCavernArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  // Stalactites hanging from top
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + 12, y + 20);
  ctx.lineTo(x + 18, y);
  ctx.moveTo(x + 24, y);
  ctx.lineTo(x + 32, y + 28);
  ctx.lineTo(x + 40, y);
  ctx.fill();
  // Falling shard
  const cx = x + w * 0.7;
  const cy = y + h * 0.6;
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 6, cy + 16);
  ctx.lineTo(cx - 6, cy + 16);
  ctx.closePath();
  ctx.fill();
}

function drawGeyserLeapArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e3852';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.65;
  // Stepping stones
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.ellipse(x + 14, cy, 10, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w - 14, cy, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Center Geyser vent & steam plume
  ctx.fillStyle = '#3a2e2b';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Steam blast
  const steamGrad = ctx.createLinearGradient(cx, cy, cx, y + 6);
  steamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  steamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = steamGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.quadraticCurveTo(cx - 12, y + 16, cx, y + 6);
  ctx.quadraticCurveTo(cx + 12, y + 16, cx + 8, cy);
  ctx.closePath();
  ctx.fill();
}

function drawClockworkCogsArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1c1510';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Left Brass Gear
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(cx - 14, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1510';
  ctx.beginPath();
  ctx.arc(cx - 14, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  // Right Bronze Gear
  ctx.fillStyle = '#cd7f32';
  ctx.beginPath();
  ctx.arc(cx + 14, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1510';
  ctx.beginPath();
  ctx.arc(cx + 14, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  // Center Meshing Gold Spark
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawSteamBoilerReliefArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#151412';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.52;
  // Boiler Tank
  ctx.fillStyle = '#3a342e';
  ctx.beginPath();
  ctx.roundRect(cx - 24, cy - 14, 48, 32, 6);
  ctx.fill();
  // Gauge
  ctx.fillStyle = '#f8f4e6';
  ctx.beginPath();
  ctx.arc(cx, cy + 2, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 2);
  ctx.lineTo(cx + 8, cy - 6);
  ctx.stroke();
  // Steam Plume from chimney
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy - 14);
  ctx.lineTo(cx - 12, cy - 28);
  ctx.lineTo(cx + 12, cy - 28);
  ctx.lineTo(cx + 4, cy - 14);
  ctx.closePath();
  ctx.fill();
}

function drawZeppelinDogfightArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#2d222b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Zeppelin Envelope
  ctx.fillStyle = '#b8860b';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 3, 24, 12, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Ribs
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 4, 11, -1.2, 1.2);
  ctx.stroke();
  // Gondola
  ctx.fillStyle = '#5c3a21';
  ctx.fillRect(cx - 8, cy + 5, 16, 5);
  // Cannon blast
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(cx + 26, cy - 7, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawTeslaCoilArcArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#080a12';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Central Coil Toroid
  ctx.fillStyle = '#e0e0e0';
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();
  // Copper Tower Base
  ctx.fillStyle = '#b87333';
  ctx.fillRect(cx - 4, cy + 4, 8, 16);
  // Branching Arcs
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - 14, cy - 16);
  ctx.lineTo(cx - 24, cy - 10);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 16, cy + 12);
  ctx.lineTo(cx + 26, cy + 8);
  ctx.stroke();
}

function drawAutomatorAssemblyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Victorian clockwork workshop
  ctx.fillStyle = '#1e120c';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Background interlocking brass gears
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx - 16, cy - 12, 10, 0, Math.PI * 2);
  ctx.stroke();

  // Conveyor Belt at bottom
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, cy + 12, w, 8);
  // Conveyor rollers
  ctx.fillStyle = '#475569';
  for (let rx = x + 8; rx < x + w; rx += 14) {
    ctx.beginPath();
    ctx.arc(rx, cy + 16, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Intricate Brass Clockwork Automaton Toy in center
  const botX = cx;
  const botY = cy + 2;

  // Cubic Brass Torso
  ctx.fillStyle = '#d97706';
  ctx.fillRect(botX - 8, botY - 6, 16, 14);
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1;
  ctx.strokeRect(botX - 8, botY - 6, 16, 14);

  // Glowing Cyan Chest Heart Gauge
  ctx.fillStyle = '#06b6d4';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(botX, botY + 1, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Automaton Head
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(botX - 6, botY - 14, 12, 7);
  // Yellow optical sensor eyes
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(botX - 3, botY - 10, 1.5, 0, Math.PI * 2);
  ctx.arc(botX + 3, botY - 10, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Golden Winding Key in back
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(botX - 8, botY);
  ctx.lineTo(botX - 14, botY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(botX - 14, botY - 2.5, 2.5, 0, Math.PI * 2);
  ctx.arc(botX - 14, botY + 2.5, 2.5, 0, Math.PI * 2);
  ctx.stroke();

  // Hydraulic Assembly Gripper Arm from ceiling placing a gear
  const armX = cx + 8;
  const armY = cy - 14;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + 8, y);
  ctx.lineTo(armX, armY);
  ctx.stroke();

  // Golden Gear held in claw
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(armX, armY + 5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e120c';
  ctx.beginPath();
  ctx.arc(armX, armY + 5, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPneumaticTubeRushArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Steampunk dispatch station
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Transparent Glass Pneumatic Tube spanning canvas
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.fillRect(x, cy - 10, w, 20);

  // Brass Tube Collar Flanges
  ctx.fillStyle = '#b45309';
  ctx.fillRect(x + 10, cy - 12, 6, 24);
  ctx.fillRect(x + w - 16, cy - 12, 6, 24);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(x + 12, cy - 12, 2, 24);
  ctx.fillRect(x + w - 14, cy - 12, 2, 24);

  // Glass Specular Sheen lines on tube
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, cy - 7); ctx.lineTo(x + w, cy - 7);
  ctx.moveTo(x, cy + 8); ctx.lineTo(x + w, cy + 8);
  ctx.stroke();

  // Aerodynamic Polished Brass Dispatch Capsule hurtling through
  const capX = cx + 2;
  const capY = cy;
  ctx.save();
  ctx.translate(capX, capY);

  // Capsule Brass Body
  ctx.fillStyle = '#f59e0b';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-16, -6, 32, 12, 6);
  else ctx.rect(-16, -6, 32, 12);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Chrome Endcaps
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-16, -6, 5, 12);
  ctx.fillRect(11, -6, 5, 12);

  // Red Urgent Dispatch Label
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-6, -4, 12, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-4, -2, 8, 4);
  ctx.restore();

  // High-Speed Air Compression Waves / Vapor rings behind capsule
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(capX - 22, cy, 4, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(capX - 30, cy, 3, 6, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawOrnithopterFlockArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#3a4454';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Thermal Brass Ring
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx + 14, cy - 4, 14, 0, Math.PI * 2);
  ctx.stroke();
  // Ornithopter Body
  ctx.fillStyle = '#b87333';
  ctx.beginPath();
  ctx.ellipse(cx - 10, cy + 2, 10, 4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Flapping Wing
  ctx.fillStyle = '#e2ba86';
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy);
  ctx.quadraticCurveTo(cx - 6, cy - 16, cx + 4, cy - 10);
  ctx.closePath();
  ctx.fill();
}

function drawPressureGaugeLockArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#111317';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Vault Dial Rim
  ctx.fillStyle = '#2c251d';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Sweet spot arc
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, -0.6, 0.6);
  ctx.stroke();
  // Tumbler Needle
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 12, cy - 6);
  ctx.stroke();
}

function drawCopperConduitArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Industrial Victorian boiler room
  ctx.fillStyle = '#180d08';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Background riveted boiler plates
  ctx.fillStyle = '#291811';
  ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);

  // Escaping white steam pressure plumes
  ctx.fillStyle = 'rgba(254, 240, 138, 0.2)';
  ctx.beginPath();
  ctx.arc(cx - 14, cy - 12, 6, 0, Math.PI * 2);
  ctx.arc(cx - 10, cy - 18, 8, 0, Math.PI * 2);
  ctx.fill();

  // Gleaming Polished Copper Conduit Pipe System
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 10, cy - 10);
  ctx.lineTo(cx - 4, cy - 10);
  ctx.lineTo(cx - 4, cy + 12);
  ctx.lineTo(x + w - 10, cy + 12);
  ctx.stroke();

  // Shiny Metallic Copper Core Highlight
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Heavy Brass Flange Elbow Joints
  const joints = [
    [cx - 4, cy - 10],
    [cx - 4, cy + 12]
  ];
  for (const [jx, jy] of joints) {
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(jx, jy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(jx, jy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Molten Glowing Copper Alloy Surge in center glass sight tube
  ctx.fillStyle = '#f97316';
  ctx.shadowColor = '#fb923c';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx - 4, cy + 1, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 5, cy, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Brass Steam Pressure Gauge with red danger needle
  const gX = cx + 18;
  const gY = cy - 8;
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(gX, gY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Danger red needle pointing into the red
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(gX, gY);
  ctx.lineTo(gX + 4, gY - 3);
  ctx.stroke();
}

function drawMonocycleDerbyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#3a2416';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Giant Outer Monocycle Wheel
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.stroke();
  // Hub Rider
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(cx + 2, cy - 4, 5, 0, Math.PI * 2);
  ctx.fill();
  // Lean speed lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy + 12);
  ctx.lineTo(cx - 10, cy + 12);
  ctx.stroke();
}

function drawCyberSamuraiSlashArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Neo-Tokyo dark cyber ambiance
  ctx.fillStyle = '#090414';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Background neon rain streaks
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 14, y); ctx.lineTo(x + 6, y + h);
  ctx.moveTo(x + w - 12, y); ctx.lineTo(x + w - 20, y + h);
  ctx.stroke();

  // Armored Cyber-Samurai Silhouette in low ready stance
  const sX = cx - 10;
  const sY = cy + 4;

  // Carbon-fiber Kabuto helmet & gold crest horns
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(sX, sY - 8, 9, 0, Math.PI * 2);
  ctx.fill();

  // Golden samurai helmet crescent crest (Maedate)
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(sX - 8, sY - 14);
  ctx.quadraticCurveTo(sX, sY - 20, sX + 8, sY - 14);
  ctx.quadraticCurveTo(sX, sY - 16, sX - 8, sY - 14);
  ctx.closePath();
  ctx.fill();

  // Glowing Cyan Optical Visor Slit
  ctx.fillStyle = '#00ffff';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 6;
  ctx.fillRect(sX - 4, sY - 9, 10, 2.5);
  ctx.shadowBlur = 0;

  // Armored shoulder guard (Sode)
  ctx.fillStyle = '#334155';
  ctx.fillRect(sX - 10, sY - 2, 7, 10);

  // Blazing Plasma Katana Slash Arc across canvas
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 5;
  ctx.shadowColor = '#fb7185';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx - 4, cy, 26, -Math.PI * 0.45, Math.PI * 0.28);
  ctx.stroke();

  // Inner White-Hot Cutting Laser Core
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Sliced energy spark bloom at slash impact point
  const sparkX = cx + 18;
  const sparkY = cy + 8;
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(sparkX, sparkY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sparkX - 6, sparkY - 6); ctx.lineTo(sparkX + 6, sparkY + 6);
  ctx.moveTo(sparkX + 6, sparkY - 6); ctx.lineTo(sparkX - 6, sparkY + 6);
  ctx.stroke();
}

function drawMainframeBreachArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep mainframe cyber void
  ctx.fillStyle = '#030712';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Perspective 3D cyber grid
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.2)';
  ctx.lineWidth = 1;
  for (let gx = -24; gx <= 24; gx += 12) {
    ctx.beginPath();
    ctx.moveTo(cx + gx * 0.4, cy - 18);
    ctx.lineTo(cx + gx * 1.5, y + h);
    ctx.stroke();
  }

  // Fractured Purple ICE Security Ring Barrier (Breaking open)
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0.5, Math.PI * 1.7);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ICE Fracture shards flying off
  ctx.fillStyle = '#c084fc';
  ctx.fillRect(cx + 16, cy - 10, 3, 3);
  ctx.fillRect(cx + 20, cy - 2, 2.5, 2.5);

  // Central Luminous Neural Intelligence Data Core
  const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 12);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.35, '#38bdf8');
  coreGrad.addColorStop(0.8, '#0284c7');
  coreGrad.addColorStop(1, '#0369a1');
  ctx.fillStyle = coreGrad;
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Concentric Core Hexagon Data Frame
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const hx = cx + Math.cos(angle) * 7;
    const hy = cy + Math.sin(angle) * 7;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.stroke();

  // Golden Trojan Breach Data Worm piercing the perimeter
  const wX = cx + 18;
  const wY = cy - 12;
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wX + 8, wY - 6);
  ctx.lineTo(wX, wY);
  ctx.lineTo(cx + 4, cy - 4);
  ctx.stroke();

  // Trojan Drill Tip glowing gold
  ctx.fillStyle = '#fde047';
  ctx.shadowColor = '#eab308';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(cx + 4, cy - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawHovercarSkylineArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0a0e1c';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Neon Cyber Highway lines
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 4, cy - 10);
  ctx.lineTo(x + w - 4, cy - 10);
  ctx.moveTo(x + 4, cy + 10);
  ctx.lineTo(x + w - 4, cy + 10);
  ctx.stroke();
  // Hovercar
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.roundRect(cx - 14, cy - 5, 28, 10, 3);
  ctx.fill();
  // Neon trail
  ctx.fillStyle = '#00ffff';
  ctx.fillRect(cx - 18, cy - 2, 4, 4);
}

function drawHologramGlitchArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#070a18';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Hologram Pedestal
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 16, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glitching Avatar Figure
  ctx.fillStyle = '#ff0077';
  ctx.fillRect(cx - 8, cy - 14, 16, 22);
  // Visor
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 6, cy - 10, 12, 3);
  // Scanline glitch
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 4);
  ctx.lineTo(cx + 14, cy - 4);
  ctx.stroke();
}

function drawLaserGrappleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0e0a1a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Anchor Spire Node
  ctx.fillStyle = '#00ffff';
  ctx.beginPath();
  ctx.arc(cx + 10, cy - 14, 5, 0, Math.PI * 2);
  ctx.fill();
  // Laser Tether Beam
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy - 14);
  ctx.lineTo(cx - 10, cy + 8);
  ctx.stroke();
  // Swinger
  ctx.fillStyle = '#ff007f';
  ctx.beginPath();
  ctx.arc(cx - 10, cy + 8, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawNeuralSynapseArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#080617';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Axon line
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 6, cy);
  ctx.lineTo(x + w - 6, cy);
  ctx.stroke();
  // Synapse Node
  ctx.fillStyle = '#1c1b2e';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Thought spark
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDroneSwarmDefenseArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#050711';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // EMP shockwave ring
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy + 8, 18, 0, Math.PI * 2);
  ctx.stroke();
  // Micro drones descending
  ctx.fillStyle = '#ff0055';
  ctx.beginPath();
  ctx.arc(cx - 12, cy - 12, 3, 0, Math.PI * 2);
  ctx.arc(cx + 8, cy - 16, 3, 0, Math.PI * 2);
  ctx.arc(cx + 18, cy - 8, 3, 0, Math.PI * 2);
  ctx.fill();
  // Defense Terminal Core
  ctx.fillStyle = '#00ffcc';
  ctx.beginPath();
  ctx.arc(cx, cy + 8, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawSynthKeytarSoloArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#130820';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Note highway lines
  ctx.strokeStyle = 'rgba(255, 0, 128, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 14, y + 4);
  ctx.lineTo(cx - 14, y + h - 4);
  ctx.moveTo(cx + 14, y + 4);
  ctx.lineTo(cx + 14, y + h - 4);
  ctx.stroke();
  // Strike bar
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy + 10);
  ctx.lineTo(cx + 18, cy + 10);
  ctx.stroke();
  // Synth note
  ctx.fillStyle = '#ff007f';
  ctx.beginPath();
  ctx.roundRect(cx - 12, cy - 8, 24, 8, 3);
  ctx.fill();
}

function drawQuantumTunnelingArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#070a18';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Accelerator rail
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 4, cy + 6);
  ctx.lineTo(x + w - 4, cy + 6);
  ctx.stroke();
  // Hadron Barrier
  ctx.fillStyle = '#ff0055';
  ctx.fillRect(cx + 6, cy - 14, 8, 24);
  // Quantum Wave Particle (Tunneling through)
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx - 8, cy, 8, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHyperloopRacerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#060a17';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Maglev Vacuum Tube
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, cy - 10, w - 8, 20);
  // Induction Ring
  ctx.strokeStyle = '#ff007f';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx + 12, cy, 4, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Hyperloop Pod
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Batch 16: Carnival Midway & Fairground Shenanigans (Games 207-216)
function drawRingTossFrenzyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Wooden Shelf
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + 6, cy + 8, w - 12, 10);
  // Glass Bottles
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(cx - 16, cy - 8, 8, 16);
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(cx - 3, cy - 14, 8, 22);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(cx + 10, cy - 8, 8, 16);
  // Flying Ring
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx - 2, cy - 12, 12, 6, -0.3, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBalloonDartClownArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Wheel Rim
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.stroke();
  // Center Clown Nose
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  // Balloons
  const colors = ['#ef4444', '#3b82f6', '#10b981', '#ec4899'];
  colors.forEach((col, i) => {
    const a = (i / 4) * Math.PI * 2;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  // Flying Dart
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 18, cy + 18);
  ctx.lineTo(cx + 8, cy + 8);
  ctx.stroke();
}

function drawDuckPondDerbyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Circular Blue Pond
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Yellow Rubber Duck
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx - 4, cy, 8, 0, Math.PI * 2);
  ctx.fill();
  // Beak
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 2);
  ctx.lineTo(cx + 8, cy);
  ctx.lineTo(cx + 2, cy + 2);
  ctx.closePath();
  ctx.fill();
  // Magnetic Horseshoe Hook
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx + 12, cy - 10, 5, Math.PI, 0);
  ctx.stroke();
}

function drawMilkBottleKnockdownArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Wooden Shelf
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + 6, cy + 12, w - 12, 6);
  // White Bottles
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(cx - 14, cy, 7, 12);
  ctx.fillRect(cx - 3, cy, 7, 12);
  ctx.fillRect(cx + 8, cy, 7, 12);
  ctx.fillRect(cx - 8, cy - 13, 7, 12);
  ctx.fillRect(cx + 2, cy - 13, 7, 12);
  // Baseball Strike
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 18, cy - 14, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBumperCarDerbyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Rubber arena perimeter wall
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

  // Red Bumper Car
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.ellipse(cx - 10, cy, 9, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Rubber bumper ring
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Blue Bumper Car
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.ellipse(cx + 10, cy, 9, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Collision Spark
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCottonCandySpinArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Metallic Machine Bowl
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.stroke();
  // Fluffy Pink Cotton Candy Cloud
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(cx + 4, cy - 7, 7, 0, Math.PI * 2);
  ctx.fill();
  // Paper Stick
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - 6, cy + 14);
  ctx.stroke();
}

function drawRollerCoasterBrakeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Wooden Trestle Support
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 15, cy + 22);
  ctx.lineTo(cx - 15, cy + 2);
  ctx.moveTo(cx + 15, cy + 22);
  ctx.lineTo(cx + 15, cy + 2);
  ctx.stroke();
  // Coaster Track Rail Wave
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 4, cy + 12);
  ctx.bezierCurveTo(cx - 10, cy - 18, cx + 10, cy + 22, x + w - 4, cy - 8);
  ctx.stroke();
  // Red Coaster Car
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx - 8, cy - 8, 16, 9);
  // Brake Spark
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(cx + 8, cy - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawFerrisWheelHopArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Two Counter-Rotating Rings
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx - 12, cy, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(cx + 12, cy, 14, 0, Math.PI * 2);
  ctx.stroke();
  // Gondola Baskets
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx - 14, cy - 17, 5, 4);
  ctx.fillRect(cx + 9, cy - 17, 5, 4);
  // Center Jump Spark
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawDunkClownTankArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Blue Water Tank
  ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.fillRect(cx - 20, cy - 4, 24, 24);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 20, cy - 4, 24, 24);
  // Perch Plank
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 22, cy - 8, 28, 4);
  // Red Bullseye Target
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx + 14, cy - 4, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + 14, cy - 4, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawFortuneTellerTarotArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep mystical velvet fortune-teller booth
  ctx.fillStyle = '#140522';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Velvet cloth drape folds with gold starlight flecks
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 4, y); ctx.quadraticCurveTo(cx - 10, y + 14, x + 4, y + h);
  ctx.moveTo(x + w - 4, y); ctx.quadraticCurveTo(cx + 10, y + 14, x + w - 4, y + h);
  ctx.stroke();

  // Two Laid-Out Tarot Cards on Table
  const cardW = 14;
  const cardH = 22;

  // Tarot Card 1 (Left - The Sun)
  const c1X = cx - 18;
  const c1Y = cy + 2;
  ctx.save();
  ctx.translate(c1X, c1Y);
  ctx.rotate(-0.18);

  ctx.fillStyle = '#0f172a';
  if (ctx.roundRect) ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 2);
  else ctx.rect(-cardW / 2, -cardH / 2, cardW, cardH);
  ctx.fill();

  // Gold filigree border
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  if (ctx.roundRect) ctx.roundRect(-cardW / 2 + 1, -cardH / 2 + 1, cardW - 2, cardH - 2, 1.5);
  else ctx.rect(-cardW / 2 + 1, -cardH / 2 + 1, cardW - 2, cardH - 2);
  ctx.stroke();

  // The Sun face
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Tarot Card 2 (Right - The Star)
  const c2X = cx + 18;
  const c2Y = cy + 2;
  ctx.save();
  ctx.translate(c2X, c2Y);
  ctx.rotate(0.18);

  ctx.fillStyle = '#0f172a';
  if (ctx.roundRect) ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 2);
  else ctx.rect(-cardW / 2, -cardH / 2, cardW, cardH);
  ctx.fill();

  // Gold filigree border
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  if (ctx.roundRect) ctx.roundRect(-cardW / 2 + 1, -cardH / 2 + 1, cardW - 2, cardH - 2, 1.5);
  else ctx.rect(-cardW / 2 + 1, -cardH / 2 + 1, cardW - 2, cardH - 2);
  ctx.stroke();

  // The Star (Cyan 8-point star)
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Ornate Brass Tripod Claw Stand under crystal ball
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + 12); ctx.lineTo(cx - 4, cy + 4);
  ctx.moveTo(cx + 7, cy + 12); ctx.lineTo(cx + 4, cy + 4);
  ctx.stroke();

  // Glowing Mystical Crystal Ball in center
  const ballR = 14;
  const ballGrad = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, ballR);
  ballGrad.addColorStop(0, '#ffffff');
  ballGrad.addColorStop(0.25, '#f0abfc');
  ballGrad.addColorStop(0.65, '#9333ea');
  ballGrad.addColorStop(1, '#3b0764');

  ctx.fillStyle = ballGrad;
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, cy - 1, ballR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Swirling Ethereal Arcane Nebula inside crystal ball
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy - 1, 7, -0.6, 2.2);
  ctx.stroke();

  // Arcane Star Sparkle in center
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 1, cy - 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(cx + 4, cy + 2, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawVineSwingCanopyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep jungle canopy background
  ctx.fillStyle = '#032616';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Background jungle foliage leaves
  ctx.fillStyle = '#064e3b';
  ctx.beginPath();
  ctx.arc(x + 12, y + 10, 16, 0, Math.PI * 2);
  ctx.arc(x + w - 10, y + 12, 18, 0, Math.PI * 2);
  ctx.fill();

  // Sunlight ray breaking through canopy
  const sunGrad = ctx.createLinearGradient(x + 10, y, cx + 10, y + h);
  sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.25)');
  sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 35, y);
  ctx.lineTo(cx + 25, y + h);
  ctx.lineTo(cx - 5, y + h);
  ctx.closePath();
  ctx.fill();

  // Thick braided jungle vine
  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 24, y);
  ctx.quadraticCurveTo(cx - 16, cy + 18, cx + 18, cy + 2);
  ctx.stroke();

  // Vine texture highlights
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 23, y);
  ctx.quadraticCurveTo(cx - 15, cy + 17, cx + 17, cy + 1);
  ctx.stroke();

  // Swinging Explorer Silhouette holding vine
  const pX = cx - 4;
  const pY = cy + 10;
  ctx.fillStyle = '#f8fafc';
  // Head
  ctx.beginPath();
  ctx.arc(pX, pY - 10, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Body & reaching arms
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(pX, pY - 7);
  ctx.lineTo(pX - 2, pY + 2); // Torso
  ctx.moveTo(pX - 1, pY - 5);
  ctx.lineTo(pX - 8, pY - 8); // Arm gripping vine
  ctx.moveTo(pX - 2, pY + 2);
  ctx.lineTo(pX + 5, pY + 8); // Legs in motion
  ctx.stroke();

  // Golden ripe banana cluster target on right
  const banX = cx + 20;
  const banY = cy - 6;
  ctx.fillStyle = '#facc15';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(banX, banY, 4, 0, Math.PI * 2);
  ctx.arc(banX - 3, banY + 3, 3.5, 0, Math.PI * 2);
  ctx.arc(banX + 3, banY + 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Green stem
  ctx.fillStyle = '#15803d';
  ctx.fillRect(banX - 1.5, banY - 6, 3, 3);
}

function drawTrexEggScrambleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Primeval volcanic mist background
  ctx.fillStyle = '#140c1d';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Distant glowing amber volcanic haze
  const haze = ctx.createRadialGradient(cx, cy + 15, 2, cx, cy + 15, 30);
  haze.addColorStop(0, 'rgba(249, 115, 22, 0.25)');
  haze.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(cx, cy + 15, 30, 0, Math.PI * 2);
  ctx.fill();

  // Menacing T-Rex predatory head looming in shadows above
  ctx.fillStyle = '#2e1065';
  ctx.beginPath();
  ctx.moveTo(cx - 24, y + 2);
  ctx.lineTo(cx + 22, y + 2);
  ctx.lineTo(cx + 26, y + 16);
  ctx.lineTo(cx + 8, y + 20);
  ctx.lineTo(cx - 2, y + 16);
  ctx.lineTo(cx - 24, y + 12);
  ctx.closePath();
  ctx.fill();

  // Sharp prehistoric teeth
  ctx.fillStyle = '#fef08a';
  for (let t = 0; t < 5; t++) {
    ctx.beginPath();
    ctx.moveTo(cx + 2 + t * 4, y + 18);
    ctx.lineTo(cx + 4 + t * 4, y + 23);
    ctx.lineTo(cx + 6 + t * 4, y + 18);
    ctx.closePath();
    ctx.fill();
  }

  // Glowing amber predatory slit eye
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(cx + 14, y + 10, 4.5, 3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.fillRect(cx + 13.5, y + 8, 1.5, 4);

  // Twig Nest
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nest criss-cross twigs
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy + 12); ctx.lineTo(cx + 18, cy + 16);
  ctx.moveTo(cx - 16, cy + 18); ctx.lineTo(cx + 15, cy + 11);
  ctx.stroke();

  // Giant Golden Dino Egg in center (speckled)
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 8, 12, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Egg speckles
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.arc(cx - 3, cy + 5, 1.2, 0, Math.PI * 2);
  ctx.arc(cx + 2, cy + 9, 1.5, 0, Math.PI * 2);
  ctx.arc(cx - 1, cy + 12, 1, 0, Math.PI * 2);
  ctx.fill();

  // Left cracked egg hatching with blue baby raptor eye
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.ellipse(cx - 12, cy + 11, 6, 8, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Crack fissure
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy + 7);
  ctx.lineTo(cx - 11, cy + 10);
  ctx.lineTo(cx - 13, cy + 13);
  ctx.stroke();
  // Peeking cyan eye
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(cx - 11, cy + 10, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPiranhaRiverHopArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Rushing turquoise jungle river
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // River foam currents
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, cy - 14); ctx.quadraticCurveTo(cx - 10, cy - 18, cx + 15, cy - 12);
  ctx.moveTo(x + 10, cy + 18); ctx.quadraticCurveTo(cx, cy + 14, x + w, cy + 20);
  ctx.stroke();

  // Floating Wooden Stepping Log
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 20, cy + 3, 40, 12, 5);
  else ctx.rect(cx - 20, cy + 3, 40, 12);
  ctx.fill();

  // Log bark texture & moss
  ctx.fillStyle = '#451a03';
  ctx.fillRect(cx - 18, cy + 7, 36, 2);
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(cx - 12, cy + 3, 10, 2);

  // Leaping Red Piranha 1 (Left)
  const p1X = cx - 12;
  const p1Y = cy - 10;
  ctx.save();
  ctx.translate(p1X, p1Y);
  ctx.rotate(-0.35);
  // Piranha body
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tail fin
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(-16, -6);
  ctx.lineTo(-16, 6);
  ctx.closePath();
  ctx.fill();
  // Jaw with razor teeth
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.arc(6, 1, 4, -0.4, 0.8);
  ctx.lineTo(6, 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(7, -1, 2, 2);
  ctx.fillRect(7, 2, 2, 2);
  // Yellow eye
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(3, -3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(3.5, -3, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Water splash droplets around piranha
  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.arc(p1X - 8, p1Y + 9, 2, 0, Math.PI * 2);
  ctx.arc(p1X + 8, p1Y + 8, 1.8, 0, Math.PI * 2);
  ctx.arc(p1X + 14, p1Y - 4, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPterodactylGlideArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Prehistoric canyon sunset sky
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#581c87');
  sky.addColorStop(0.5, '#b45309');
  sky.addColorStop(1, '#f59e0b');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Volcano silhouette in distance
  ctx.fillStyle = '#311042';
  ctx.beginPath();
  ctx.moveTo(x + 5, y + h);
  ctx.lineTo(cx - 15, cy + 4);
  ctx.lineTo(cx - 5, cy + 4);
  ctx.lineTo(cx + 25, y + h);
  ctx.closePath();
  ctx.fill();
  // Smoke plume
  ctx.fillStyle = 'rgba(74, 4, 78, 0.4)';
  ctx.beginPath();
  ctx.arc(cx - 10, cy - 2, 6, 0, Math.PI * 2);
  ctx.arc(cx - 6, cy - 10, 8, 0, Math.PI * 2);
  ctx.fill();

  // Glowing Golden Updraft Thermal Ring
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.ellipse(cx + 14, cy - 6, 8, 14, 0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Soaring Pterodactyl in foreground
  const ptX = cx - 10;
  const ptY = cy + 2;
  ctx.save();
  ctx.translate(ptX, ptY);
  ctx.rotate(-0.18);

  // Leathery wings
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-20, -14); // Left wingtip
  ctx.quadraticCurveTo(-10, -6, -4, 2);
  ctx.lineTo(0, 5);     // Body
  ctx.lineTo(12, 1);
  ctx.quadraticCurveTo(16, -8, 22, -12); // Right wingtip
  ctx.lineTo(4, -2);
  ctx.closePath();
  ctx.fill();

  // Beak & Head Crest
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(10, -8);  // Long sharp beak
  ctx.lineTo(0, -4);
  ctx.lineTo(-6, -11); // Head crest
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawQuicksandEscapeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Quicksand mud pit background
  ctx.fillStyle = '#29180c';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Swirling mud vortex
  const mudGrad = ctx.createRadialGradient(cx, cy + 10, 2, cx, cy + 10, 28);
  mudGrad.addColorStop(0, '#592c10');
  mudGrad.addColorStop(0.6, '#78350f');
  mudGrad.addColorStop(1, '#29180c');
  ctx.fillStyle = mudGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 28, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mud suction spiral rings
  ctx.strokeStyle = '#9a3412';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 18, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy + 10, 9, 4, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Bubbling mud craters
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.arc(cx - 16, cy + 12, 3, 0, Math.PI * 2);
  ctx.arc(cx + 18, cy + 8, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Overhead Braided Hemp Rescue Rope with Carabiner
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + 10, y);
  ctx.lineTo(cx - 2, cy - 4);
  ctx.stroke();

  // Rope knot & metallic rescue loop
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 2, 6, 0, Math.PI * 2);
  ctx.stroke();

  // Reaching Sinking Player Hands
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  // Left arm reaching up
  ctx.moveTo(cx - 8, cy + 8);
  ctx.lineTo(cx - 5, cy + 1);
  ctx.lineTo(cx - 3, cy + 3);
  ctx.lineTo(cx - 6, cy + 9);
  ctx.fill();
  // Right hand grabbing near the loop
  ctx.moveTo(cx + 2, cy + 7);
  ctx.lineTo(cx - 1, cy);
  ctx.lineTo(cx + 2, cy + 1);
  ctx.lineTo(cx + 4, cy + 8);
  ctx.fill();
}

function drawBlowpipeTargetArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Ancient Aztec mossy temple stone
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Carved concentric sun target on stone
  const targetRings = [
    { r: 20, col: '#0f766e' },
    { r: 15, col: '#f59e0b' },
    { r: 10, col: '#dc2626' },
    { r: 5, col: '#fef08a' }
  ];
  for (const ring of targetRings) {
    ctx.fillStyle = ring.col;
    ctx.beginPath();
    ctx.arc(cx + 4, cy - 6, ring.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Aztec sun ray triangles around target
  ctx.fillStyle = '#d97706';
  for (let a = 0; a < 8; a++) {
    const angle = (a * Math.PI) / 4;
    const sx = cx + 4 + Math.cos(angle) * 21;
    const sy = cy - 6 + Math.sin(angle) * 21;
    ctx.beginPath();
    ctx.arc(sx, sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bamboo Blowpipe angled from bottom-left
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h - 6);
  ctx.lineTo(cx - 12, cy + 4);
  ctx.stroke();

  // Bamboo segments/nodes
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + h - 14); ctx.lineTo(x + 16, y + h - 10);
  ctx.moveTo(cx - 18, cy + 9); ctx.lineTo(cx - 15, cy + 13);
  ctx.stroke();

  // Venomous Dart in flight towards bullseye
  const dX = cx - 4;
  const dY = cy - 2;
  // Dart shaft
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(dX - 8, dY + 4);
  ctx.lineTo(dX + 2, dY - 2);
  ctx.stroke();
  // Toxic emerald poison tip
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(dX + 3, dY - 2.5, 2, 0, Math.PI * 2);
  ctx.fill();
  // Red feather fletching
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(dX - 8, dY + 4);
  ctx.lineTo(dX - 12, dY + 3);
  ctx.lineTo(dX - 9, dY + 7);
  ctx.closePath();
  ctx.fill();
}

function drawAmberFossilExcavateArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Ancient sandstone excavation strata
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Chiseled stone excavation pit
  ctx.fillStyle = '#44403c';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 22, cy - 20, 44, 40, 6);
  else ctx.rect(cx - 22, cy - 20, 44, 40);
  ctx.fill();

  // Pickaxe chisel marks in rock
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 14); ctx.lineTo(cx - 10, cy - 10);
  ctx.moveTo(cx + 12, cy + 10); ctx.lineTo(cx + 18, cy + 15);
  ctx.stroke();

  // Large Translucent Amber Gemstone
  const ambR = 14;
  const ambGrad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, ambR);
  ambGrad.addColorStop(0, '#fef08a');
  ambGrad.addColorStop(0.4, '#f59e0b');
  ambGrad.addColorStop(0.85, '#d97706');
  ambGrad.addColorStop(1, '#92400e');

  ctx.fillStyle = ambGrad;
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(cx, cy, ambR, ambR * 1.25, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Specular facet highlights
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy - 5, 6, 8, 0.2, -0.8, 1);
  ctx.stroke();

  // Fossilized Prehistoric Mosquito preserved inside amber
  ctx.fillStyle = '#451a03';
  // Mosquito thorax & abdomen
  ctx.beginPath();
  ctx.ellipse(cx, cy, 3, 1.5, 0.5, 0, Math.PI * 2);
  ctx.ellipse(cx + 2.5, cy + 2, 4, 1.2, 0.7, 0, Math.PI * 2);
  ctx.fill();
  // Delicate wings
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx - 2, cy - 3, 4, 1.5, -0.6, 0, Math.PI * 2);
  ctx.ellipse(cx + 2, cy - 2, 4, 1.5, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  // Long needle proboscis
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - 1);
  ctx.lineTo(cx - 6, cy - 3);
  ctx.stroke();
}

function drawRaptorPounceDodgeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dark Jurassic jungle night
  ctx.fillStyle = '#022c22';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Red Danger Strike Trajectory Arc
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 10);
  ctx.quadraticCurveTo(cx, cy - 10, x + w - 10, cy + 12);
  ctx.stroke();
  ctx.setLineDash([]);

  // Menacing Velociraptor mid-pounce (Left to Center)
  ctx.save();
  ctx.translate(cx - 10, cy - 6);
  ctx.rotate(0.25);

  // Raptor body & snout
  ctx.fillStyle = '#065f46';
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Snout & razor fangs
  ctx.beginPath();
  ctx.moveTo(8, -4);
  ctx.lineTo(18, -1);
  ctx.lineTo(9, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(12, 0, 2, 2);

  // Fierce predatory yellow eye
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(8, -3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.fillRect(8, -4, 1, 2);

  // Deadly sickle claw foot extended
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(4, 5);
  ctx.quadraticCurveTo(8, 14, 14, 8);
  ctx.stroke();
  ctx.restore();

  // Evasive player dodge roll silhouette (Right)
  const dX = cx + 18;
  const dY = cy + 10;
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(dX, dY, 6, 0, Math.PI * 2);
  ctx.fill();
  // Motion blur swoosh
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dX - 2, dY, 9, 1.2, 3.2);
  ctx.stroke();
}

function drawBambooPoleVaultArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Prehistoric canyon chasm background
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Deep canyon chasm in center
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.moveTo(cx - 16, y + h);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.lineTo(cx + 8, cy + 6);
  ctx.lineTo(cx + 18, y + h);
  ctx.closePath();
  ctx.fill();

  // Canyon mist
  ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.fillRect(cx - 14, cy + 12, 28, 8);

  // High-tension curved green bamboo pole
  ctx.strokeStyle = '#84cc16';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy + 14); // Ground plant
  ctx.quadraticCurveTo(cx - 10, cy - 20, cx + 14, cy - 8);
  ctx.stroke();

  // Bamboo node segments
  ctx.strokeStyle = '#4d7c0f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy + 6); ctx.lineTo(cx - 8, cy + 5);
  ctx.moveTo(cx - 6, cy - 10); ctx.lineTo(cx - 3, cy - 11);
  ctx.stroke();

  // Inverted acrobat vaulter at peak of arc
  const vX = cx + 8;
  const vY = cy - 12;
  ctx.fillStyle = '#f8fafc';
  // Head
  ctx.beginPath();
  ctx.arc(vX + 6, vY + 2, 3, 0, Math.PI * 2);
  ctx.fill();
  // Body in air
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(vX + 4, vY);
  ctx.lineTo(vX - 4, vY - 4);
  ctx.lineTo(vX - 9, vY - 1);
  ctx.stroke();

  // Target cliff ledge on right with goal flag
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx + 16, cy + 4, 14, 18);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(cx + 20, cy);
  ctx.lineTo(cx + 28, cy - 4);
  ctx.lineTo(cx + 20, cy - 8);
  ctx.closePath();
  ctx.fill();
}

function drawVolcanoLavaLeapArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Blazing volcanic magma chamber
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Molten bubbling lava lake
  const lava = ctx.createLinearGradient(x, cy, x, y + h);
  lava.addColorStop(0, '#ea580c');
  lava.addColorStop(0.5, '#f59e0b');
  lava.addColorStop(1, '#dc2626');
  ctx.fillStyle = lava;
  ctx.fillRect(x, cy + 4, w, h * 0.5);

  // Floating Basalt Stepping Pillars
  const pillars = [
    { px: cx - 20, py: cy + 6, r: 9 },
    { px: cx, py: cy + 4, r: 12 },
    { px: cx + 22, py: cy + 8, r: 8 }
  ];

  for (const pil of pillars) {
    // Column base
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.ellipse(pil.px, pil.py, pil.r, pil.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glowing lava crust rim
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Fiery Dragon Ruby atop center pillar
  ctx.fillStyle = '#f43f5e';
  ctx.shadowColor = '#fb7185';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx + 5, cy + 1);
  ctx.lineTo(cx, cy + 7);
  ctx.lineTo(cx - 5, cy + 1);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Rising lava sparks / embers
  const sparks = [
    [cx - 12, cy - 10, '#fef08a'],
    [cx + 10, cy - 14, '#f97316'],
    [cx - 4, cy - 18, '#ef4444'],
    [cx + 18, cy - 6, '#fde047']
  ];
  for (const [sx, sy, col] of sparks) {
    ctx.fillStyle = col as string;
    ctx.beginPath();
    ctx.arc(sx as number, sy as number, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCaterpillarInchwormArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Vibrant garden greenery
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Textured wooden plant branch
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.moveTo(x, cy + 8);
  ctx.lineTo(x + w, cy + 4);
  ctx.lineTo(x + w, cy + 14);
  ctx.lineTo(x, cy + 18);
  ctx.closePath();
  ctx.fill();

  // Green garden leaf attached to branch
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.ellipse(cx + 20, cy + 4, 10, 5, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Arched Green Inchworm in mid-loop
  const wormX = cx - 4;
  const wormY = cy + 4;

  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(wormX - 16, wormY);
  ctx.quadraticCurveTo(wormX, wormY - 20, wormX + 14, wormY - 2);
  ctx.stroke();

  // Body segment bands
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(wormX - 7, wormY - 11, 4, -0.6, 0.6);
  ctx.arc(wormX + 4, wormY - 12, 4, 2.5, 3.8);
  ctx.stroke();

  // Inchworm Head & cute eyes
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.arc(wormX + 16, wormY - 5, 5, 0, Math.PI * 2);
  ctx.fill();

  // Eyes & rosy cheek
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(wormX + 18, wormY - 6, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(wormX + 16, wormY - 3, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Shimmering morning dewdrop on leaf tip
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#7dd3fc';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(cx + 28, cy + 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawHoneybeeNectarRelayArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Twilight garden meadow
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Blooming Velvet Orchid Flower on left
  const fX = cx - 14;
  const fY = cy + 4;
  ctx.fillStyle = '#9333ea';
  for (let p = 0; p < 5; p++) {
    const angle = (p * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.ellipse(fX + Math.cos(angle) * 11, fY + Math.sin(angle) * 11, 7, 5, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  // Glowing Golden Nectar Center
  ctx.fillStyle = '#facc15';
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(fX, fY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Hovering Bumblebee / Honeybee in center
  const bX = cx + 8;
  const bY = cy - 4;

  // Gossamer Translucent Wings
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(bX - 2, bY - 10, 7, 3.5, -0.4, 0, Math.PI * 2);
  ctx.ellipse(bX + 5, bY - 10, 6, 3, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Striped Fuzzy Body
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(bX, bY, 10, 6.5, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Black stripes
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(bX - 4, bY - 6, 2.5, 12);
  ctx.fillRect(bX + 2, bY - 6, 2.5, 12);

  // Head & shiny eye
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(bX - 8, bY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(bX - 9, bY - 1, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Dripping Golden Nectar Droplet
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(bX - 2, bY + 6);
  ctx.quadraticCurveTo(bX, bY + 12, bX, bY + 14);
  ctx.quadraticCurveTo(bX - 4, bY + 12, bX - 2, bY + 6);
  ctx.fill();
}

function drawSpiderWebTangleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Midnight web background
  ctx.fillStyle = '#090d16';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Dew-speckled Spider Orb Web
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;

  // Radial web spokes
  for (let s = 0; s < 8; s++) {
    const angle = (s * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * 32, cy + Math.sin(angle) * 32);
    ctx.stroke();
  }

  // Concentric spiral rings
  for (let r = 8; r <= 26; r += 7) {
    ctx.beginPath();
    for (let s = 0; s <= 8; s++) {
      const angle = (s * Math.PI) / 4;
      const wx = cx + Math.cos(angle) * r;
      const wy = cy + Math.sin(angle) * r;
      if (s === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  }

  // Trapped Golden Moth on left
  const mX = cx - 14;
  const mY = cy - 8;
  ctx.fillStyle = '#fde047';
  ctx.shadowColor = '#eab308';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.ellipse(mX, mY, 4, 2.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Velvet Black Widow Spider in center
  ctx.fillStyle = '#020617';
  // Abdomen
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 2, 7, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Cephalothorax
  ctx.beginPath();
  ctx.arc(cx - 5, cy, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Iconic Crimson Hourglass on abdomen
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 4, cy);
  ctx.lineTo(cx + 1, cy + 3);
  ctx.lineTo(cx + 4, cy + 5);
  ctx.lineTo(cx, cy + 5);
  ctx.closePath();
  ctx.fill();

  // Articulated legs
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.4;
  const legDirs = [-0.8, -0.4, 0.4, 0.8];
  for (const ld of legDirs) {
    // Left legs
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy);
    ctx.lineTo(cx - 10, cy + ld * 10);
    ctx.lineTo(cx - 15, cy + ld * 16);
    ctx.stroke();
    // Right legs
    ctx.beginPath();
    ctx.moveTo(cx + 3, cy);
    ctx.lineTo(cx + 10, cy + ld * 10);
    ctx.lineTo(cx + 16, cy + ld * 16);
    ctx.stroke();
  }
}

function drawAntColonyHaulArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Earthy subterranean cavern cross-section
  ctx.fillStyle = '#3f1f0d';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Carved underground ant tunnel
  ctx.fillStyle = '#1c1007';
  ctx.beginPath();
  ctx.moveTo(x, cy + 4);
  ctx.quadraticCurveTo(cx - 10, cy - 8, cx + 10, cy - 4);
  ctx.quadraticCurveTo(cx + 25, cy, x + w, cy - 2);
  ctx.lineTo(x + w, cy + 18);
  ctx.lineTo(x, cy + 20);
  ctx.closePath();
  ctx.fill();

  // Gleaming Faceted Crystal Sugar Cube hoisted by ants
  const sX = cx + 2;
  const sY = cy - 6;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#e0f2fe';
  ctx.shadowBlur = 6;
  ctx.fillRect(sX - 6, sY - 6, 12, 12);
  ctx.shadowBlur = 0;
  // Sugar facet lines
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(sX - 6, sY - 6, 12, 12);
  ctx.strokeRect(sX - 4, sY - 4, 8, 8);

  // Red Soldier Ant on left lifting
  const a1X = cx - 12;
  const a1Y = cy + 2;
  ctx.fillStyle = '#dc2626';
  // Head, thorax, abdomen
  ctx.beginPath();
  ctx.arc(a1X - 6, a1Y - 2, 3, 0, Math.PI * 2);
  ctx.ellipse(a1X - 2, a1Y, 3, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(a1X + 3, a1Y + 1, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Black Worker Ant on right pushing
  const a2X = cx + 14;
  const a2Y = cy + 3;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(a2X + 6, a2Y - 1, 2.5, 0, Math.PI * 2);
  ctx.ellipse(a2X + 2, a2Y, 2.5, 1.8, 0, 0, Math.PI * 2);
  ctx.ellipse(a2X - 2, a2Y + 1, 3.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Little haul effort sweat drop
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(a1X - 4, a1Y - 8, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawFireflyNightBeaconArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Midnight forest sky with starlight
  ctx.fillStyle = '#050814';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Distant glowing firefly bokeh motes
  const motes = [
    [x + 14, y + 12, 2.5, 'rgba(250, 204, 21, 0.4)'],
    [x + w - 16, y + 16, 3, 'rgba(163, 230, 53, 0.35)'],
    [x + 20, y + h - 14, 2, 'rgba(250, 204, 21, 0.45)'],
    [x + w - 24, y + h - 18, 2.5, 'rgba(163, 230, 53, 0.4)']
  ];
  for (const [mx, my, mr, col] of motes) {
    ctx.fillStyle = col as string;
    ctx.beginPath();
    ctx.arc(mx as number, my as number, mr as number, 0, Math.PI * 2);
    ctx.fill();
  }

  // Brilliant Phosphorescent Golden-Emerald Lantern Bloom
  const glowGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
  glowGrad.addColorStop(0, '#ffffff');
  glowGrad.addColorStop(0.2, '#fef08a');
  glowGrad.addColorStop(0.5, '#a3e635');
  glowGrad.addColorStop(0.8, 'rgba(74, 222, 128, 0.3)');
  glowGrad.addColorStop(1, 'rgba(74, 222, 128, 0)');

  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fill();

  // Firefly Insect Body
  ctx.fillStyle = '#1e293b';
  // Head
  ctx.beginPath();
  ctx.arc(cx - 5, cy - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  // Thorax
  ctx.beginPath();
  ctx.ellipse(cx, cy - 3, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Translucent wings
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(cx - 2, cy - 9, 7, 3, -0.4, 0, Math.PI * 2);
  ctx.ellipse(cx + 4, cy - 8, 6, 2.5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Bioluminescent Lantern Abdomen Core
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.ellipse(cx + 5, cy + 1, 6, 4, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawDungBeetleRollArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Golden savanna sand path
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Savanna sunset hill slope
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, cy + 10);
  ctx.lineTo(x + w, cy - 2);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();

  // Massive Textured Spherical Soil Ball
  const ballX = cx - 4;
  const ballY = cy + 2;
  const ballR = 16;
  const ballGrad = ctx.createRadialGradient(ballX - 4, ballY - 4, 2, ballX, ballY, ballR);
  ballGrad.addColorStop(0, '#78350f');
  ballGrad.addColorStop(0.7, '#451a03');
  ballGrad.addColorStop(1, '#29180c');

  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
  ctx.fill();

  // Golden nuggets embedded in soil
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(ballX - 6, ballY - 5, 2, 0, Math.PI * 2);
  ctx.arc(ballX + 4, ballY + 6, 2.2, 0, Math.PI * 2);
  ctx.arc(ballX - 2, ballY + 7, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Rolling motion lines behind the ball
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(ballX - 18, ballY + 4, 4, 1.5, 3.5);
  ctx.arc(ballX - 16, ballY + 9, 3, 2, 4);
  ctx.stroke();

  // Horned Obsidian Scarab Beetle pushing uphill
  const bX = cx + 18;
  const bY = cy - 1;
  ctx.fillStyle = '#0f172a';
  // Carapace
  ctx.beginPath();
  ctx.ellipse(bX, bY, 7, 5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Iridescent shell sheen
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.ellipse(bX - 1, bY - 1, 4, 2, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Strong pushing legs against ball
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(bX - 4, bY);
  ctx.lineTo(ballX + ballR, ballY);
  ctx.moveTo(bX - 2, bY + 3);
  ctx.lineTo(ballX + ballR - 2, ballY + 5);
  ctx.stroke();
}

function drawLadybugAphidHuntArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Vibrant emerald leaf surface
  ctx.fillStyle = '#15803d';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Translucent leaf veins
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, cy + 18);
  ctx.quadraticCurveTo(cx, cy, x + w, cy - 18);
  ctx.stroke();

  // Glossy Scarlet Red Ladybug
  const lbX = cx - 6;
  const lbY = cy + 2;
  const lbR = 12;

  // Red dome shell
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(lbX, lbY, lbR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Center shell split line
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lbX - lbR, lbY);
  ctx.lineTo(lbX + lbR, lbY);
  ctx.stroke();

  // Jet-black spots
  ctx.fillStyle = '#0f172a';
  const spots = [
    [lbX - 4, lbY - 5, 2.2],
    [lbX + 4, lbY - 5, 2.2],
    [lbX - 5, lbY + 5, 2],
    [lbX + 5, lbY + 5, 2],
    [lbX, lbY - 8, 1.8]
  ];
  for (const [sx, sy, sr] of spots) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Specular glossy reflection
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(lbX - 4, lbY - 4, 3, 2, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Scurrying Lime Aphid Target on right
  const apX = cx + 18;
  const apY = cy - 6;
  ctx.fillStyle = '#a3e635';
  ctx.beginPath();
  ctx.ellipse(apX, apY, 5, 3.5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Aphid panic movement lines
  ctx.strokeStyle = '#bef264';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(apX + 6, apY - 3); ctx.lineTo(apX + 11, apY - 5);
  ctx.moveTo(apX + 6, apY + 2); ctx.lineTo(apX + 11, apY + 4);
  ctx.stroke();
}

function drawGrasshopperHighJumpArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Sunny meadow sky
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Clover pad at bottom
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.ellipse(cx - 14, cy + 18, 12, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 8, cy + 19, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Upward launch velocity streaks
  ctx.strokeStyle = 'rgba(163, 230, 53, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy + 16); ctx.lineTo(cx - 2, cy - 2);
  ctx.moveTo(cx - 4, cy + 18); ctx.lineTo(cx + 4, cy);
  ctx.stroke();

  // High-Jumping Grasshopper mid-leap
  const ghX = cx + 2;
  const ghY = cy - 6;
  ctx.save();
  ctx.translate(ghX, ghY);
  ctx.rotate(-0.4);

  // Body
  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing case
  ctx.fillStyle = '#65a30d';
  ctx.beginPath();
  ctx.ellipse(-2, -1, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Powerful springing hind legs
  ctx.strokeStyle = '#4d7c0f';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-14, 10);
  ctx.lineTo(-6, 16);
  ctx.stroke();

  // Eye & long antenna
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(8, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a3e635';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(9, -3);
  ctx.quadraticCurveTo(16, -14, 22, -12);
  ctx.stroke();
  ctx.restore();
}

function drawDragonflyDogfightArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Sunlit water pond surface
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Water ripple concentric rings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, 24, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy + 12, 14, 4, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Dragonfly 1: Electric Blue (Top Left)
  const d1X = cx - 10;
  const d1Y = cy - 8;
  ctx.save();
  ctx.translate(d1X, d1Y);
  ctx.rotate(0.35);
  // Needle body
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(-2, -12, 4, 24);
  // Head
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(0, -12, 3, 0, Math.PI * 2);
  ctx.fill();
  // Gossamer wings
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(-10, -6, 9, 3, -0.2, 0, Math.PI * 2);
  ctx.ellipse(10, -6, 9, 3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Dragonfly 2: Blaze Orange (Bottom Right)
  const d2X = cx + 12;
  const d2Y = cy + 4;
  ctx.save();
  ctx.translate(d2X, d2Y);
  ctx.rotate(-2.4);
  // Needle body
  ctx.fillStyle = '#f97316';
  ctx.fillRect(-2, -12, 4, 24);
  // Head
  ctx.fillStyle = '#c2410c';
  ctx.beginPath();
  ctx.arc(0, -12, 3, 0, Math.PI * 2);
  ctx.fill();
  // Gossamer wings
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(-10, -6, 9, 3, -0.2, 0, Math.PI * 2);
  ctx.ellipse(10, -6, 9, 3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCentipedeSlalomArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Rich forest loam soil
  ctx.fillStyle = '#292524';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Slalom Checkpoint Posts (Red & Yellow)
  const gates = [
    { gx: cx - 18, gy: cy - 6, col: '#ef4444' },
    { gx: cx, gy: cy + 10, col: '#facc15' },
    { gx: cx + 18, gy: cy - 8, col: '#ef4444' }
  ];
  for (const g of gates) {
    ctx.fillStyle = g.col;
    ctx.beginPath();
    ctx.arc(g.gx, g.gy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Fluid S-Curved Centipede Body Segments weaving between poles
  const segs = [
    { sx: cx - 24, sy: cy + 8 },
    { sx: cx - 16, sy: cy + 3 },
    { sx: cx - 9, sy: cy - 4 },
    { sx: cx - 1, sy: cy - 2 },
    { sx: cx + 7, sy: cy + 4 },
    { sx: cx + 15, sy: cy + 2 },
    { sx: cx + 22, sy: cy - 6 }
  ];

  // Draw synchronized legs along segments
  ctx.strokeStyle = '#fed7aa';
  ctx.lineWidth = 1.2;
  for (const s of segs) {
    ctx.beginPath();
    ctx.moveTo(s.sx - 3, s.sy);
    ctx.lineTo(s.sx - 6, s.sy - 3);
    ctx.moveTo(s.sx + 3, s.sy);
    ctx.lineTo(s.sx + 6, s.sy + 3);
    ctx.stroke();
  }

  // Segment circles with fiery gradient colors
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    ctx.fillStyle = i === segs.length - 1 ? '#ef4444' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, i === segs.length - 1 ? 4.5 : 3.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head antennae on leading segment
  const head = segs[segs.length - 1];
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(head.sx, head.sy);
  ctx.lineTo(head.sx + 6, head.sy - 7);
  ctx.moveTo(head.sx, head.sy);
  ctx.lineTo(head.sx + 8, head.sy - 4);
  ctx.stroke();
}

function drawPoltergeistPossessionArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Haunted parlor night ambiance
  ctx.fillStyle = '#0f0a1c';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Swirling Ectoplasmic Psychic Aura
  const auraGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28);
  auraGrad.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
  auraGrad.addColorStop(0.5, 'rgba(147, 51, 234, 0.25)');
  auraGrad.addColorStop(1, 'rgba(15, 10, 28, 0)');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.fill();

  // Psychic Telekinesis Rings
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.ellipse(cx, cy - 2, 22, 12, 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Floating Possessed Victorian Antique Chair
  const chX = cx;
  const chY = cy - 2;
  ctx.save();
  ctx.translate(chX, chY);
  ctx.rotate(-0.15);

  // Mahogany Chair Back & Slats
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-10, -18, 20, 4);
  ctx.fillRect(-8, -14, 3, 14);
  ctx.fillRect(5, -14, 3, 14);
  ctx.fillRect(-1, -14, 3, 14);

  // Velvet Seat Cushion (Glowing Violet)
  ctx.fillStyle = '#a855f7';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 6;
  ctx.fillRect(-12, 0, 24, 6);
  ctx.shadowBlur = 0;

  // Carved Wooden Chair Legs
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, 6); ctx.lineTo(-11, 16);
  ctx.moveTo(10, 6); ctx.lineTo(11, 16);
  ctx.moveTo(-5, 6); ctx.lineTo(-4, 14);
  ctx.moveTo(5, 6); ctx.lineTo(6, 14);
  ctx.stroke();
  ctx.restore();

  // Floating teacup swirling in vortex
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(cx - 20, cy - 10, 3.5, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.arc(cx + 20, cy + 10, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawGraveyardZombieBashArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Midnight cemetery fog background
  ctx.fillStyle = '#060c14';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Full Silvery Moon casting volumetric fog beams
  const moonGrad = ctx.createRadialGradient(cx + 18, y + 10, 2, cx + 18, y + 10, 22);
  moonGrad.addColorStop(0, '#f8fafc');
  moonGrad.addColorStop(0.3, '#cbd5e1');
  moonGrad.addColorStop(0.7, 'rgba(203, 213, 225, 0.2)');
  moonGrad.addColorStop(1, 'rgba(6, 12, 20, 0)');
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(cx + 18, y + 10, 22, 0, Math.PI * 2);
  ctx.fill();

  // Solid Moon Disk
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.arc(cx + 18, y + 10, 8, 0, Math.PI * 2);
  ctx.fill();

  // Weathered Celtic Stone Cross Tombstone (Left)
  const tbX = cx - 14;
  const tbY = cy + 4;
  ctx.fillStyle = '#64748b';
  // Headstone Arch
  ctx.beginPath();
  ctx.arc(tbX, tbY - 8, 10, Math.PI, 0);
  ctx.lineTo(tbX + 10, tbY + 14);
  ctx.lineTo(tbX - 10, tbY + 14);
  ctx.closePath();
  ctx.fill();

  // Engraved "RIP" & Fissure Cracks
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 6.5px serif';
  ctx.textAlign = 'center';
  ctx.fillText('RIP', tbX, tbY);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tbX + 2, tbY - 14);
  ctx.lineTo(tbX - 2, tbY - 6);
  ctx.stroke();

  // Overturned Graveyard Dirt Mound
  ctx.fillStyle = '#3f1f0d';
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy + 18, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Decaying Green Zombie Arm bursting from ground
  const zX = cx + 8;
  const zY = cy + 16;
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(zX, zY);
  ctx.lineTo(zX + 2, cy - 2);
  ctx.stroke();

  // Zombie Wrist & Clawed Grasping Fingers
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(zX + 2, cy - 2); ctx.lineTo(zX - 5, cy - 10); // Thumb
  ctx.moveTo(zX + 2, cy - 2); ctx.lineTo(zX, cy - 12);     // Index
  ctx.moveTo(zX + 2, cy - 2); ctx.lineTo(zX + 5, cy - 11); // Middle
  ctx.moveTo(zX + 2, cy - 2); ctx.lineTo(zX + 9, cy - 7);  // Ring
  ctx.stroke();

  // Purple rotting fingernails
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.arc(zX - 5, cy - 10, 1.2, 0, Math.PI * 2);
  ctx.arc(zX, cy - 12, 1.2, 0, Math.PI * 2);
  ctx.arc(zX + 5, cy - 11, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Flying clods of earth
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.arc(zX - 6, cy + 4, 2, 0, Math.PI * 2);
  ctx.arc(zX + 12, cy + 2, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawPhantomMirrorGazeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dark gothic chamber wall
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Ornate Baroque Gilded Gold Mirror Frame
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 20, cy - 22, 40, 44, 12);
  else ctx.rect(cx - 20, cy - 22, 40, 44);
  ctx.fill();

  // Inner Gold Filigree Bevel
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 18, cy - 20, 36, 40, 10);
  else ctx.rect(cx - 18, cy - 20, 36, 40);
  ctx.stroke();

  // Dark Reflective Mirror Glass with Spectral Blue Fog
  const mirGrad = ctx.createLinearGradient(cx, cy - 18, cx, cy + 18);
  mirGrad.addColorStop(0, '#0f172a');
  mirGrad.addColorStop(0.5, '#1e293b');
  mirGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = mirGrad;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 15, cy - 17, 30, 34, 8);
  else ctx.rect(cx - 15, cy - 17, 30, 34);
  ctx.fill();

  // Ethereal Translucent Phantom Banshee emerging from mirror
  ctx.fillStyle = 'rgba(147, 197, 253, 0.75)';
  ctx.shadowColor = '#60a5fa';
  ctx.shadowBlur = 8;
  // Ghost head
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 9, 0, Math.PI * 2);
  ctx.fill();
  // Wispy spectral shoulders & cowl
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 12);
  ctx.quadraticCurveTo(cx - 8, cy - 2, cx, cy);
  ctx.quadraticCurveTo(cx + 8, cy - 2, cx + 12, cy + 12);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Piercing Glowing Crimson Eyes
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.ellipse(cx - 3.5, cy - 5, 2, 2.5, 0.1, 0, Math.PI * 2);
  ctx.ellipse(cx + 3.5, cy - 5, 2, 2.5, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Screaming hollow mouth
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, 2.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCauldronWitchBrewArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dark stone dungeon alcove
  ctx.fillStyle = '#051b11';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Mystical Violet Hearth Fire under cauldron
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy + 20);
  ctx.lineTo(cx - 8, cy + 10);
  ctx.lineTo(cx, cy + 20);
  ctx.lineTo(cx + 8, cy + 10);
  ctx.lineTo(cx + 14, cy + 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy + 20);
  ctx.lineTo(cx, cy + 12);
  ctx.lineTo(cx + 6, cy + 20);
  ctx.closePath();
  ctx.fill();

  // Heavy Cast-Iron Cauldron
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(cx, cy + 4, 18, 0, Math.PI);
  ctx.fill();
  // Cauldron rim
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cauldron cast iron feet
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(cx - 15, cy + 17, 5, 5);
  ctx.fillRect(cx + 10, cy + 17, 5, 5);

  // Toxic Glowing Neon-Green Brew Surface
  const brewGrad = ctx.createRadialGradient(cx, cy + 4, 1, cx, cy + 4, 17);
  brewGrad.addColorStop(0, '#86efac');
  brewGrad.addColorStop(0.5, '#22c55e');
  brewGrad.addColorStop(1, '#15803d');
  ctx.fillStyle = brewGrad;
  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 18, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Bubbles rising from brew
  ctx.fillStyle = '#bbf7d0';
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 2, 4, 0, Math.PI * 2);
  ctx.arc(cx + 8, cy - 6, 3, 0, Math.PI * 2);
  ctx.arc(cx - 2, cy - 12, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy - 16, 2, 0, Math.PI * 2);
  ctx.fill();

  // Swirling mystical potion vapor smoke
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4);
  ctx.bezierCurveTo(cx - 12, cy - 14, cx + 12, cy - 18, cx, cy - 24);
  ctx.stroke();
}

function drawGargoyleStoneStareArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Midnight cathedral parapet storm
  ctx.fillStyle = '#09090b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Distant Lightning Flash silhouette
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w - 10, y);
  ctx.lineTo(cx + 12, cy - 8);
  ctx.lineTo(cx + 18, cy - 4);
  ctx.lineTo(cx + 8, cy + 6);
  ctx.stroke();

  // Cathedral Stone Cornice Ledge
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.moveTo(x, cy + 14);
  ctx.lineTo(cx + 16, cy + 14);
  ctx.lineTo(cx + 10, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();

  // Perched Gothic Gargoyle Silhouette
  const gX = cx - 4;
  const gY = cy + 2;

  // Leathery folded bat wings
  ctx.fillStyle = '#52525b';
  ctx.beginPath();
  ctx.moveTo(gX, gY - 4);
  ctx.lineTo(gX - 18, gY - 18);
  ctx.lineTo(gX - 12, gY - 2);
  ctx.lineTo(gX + 16, gY - 18);
  ctx.lineTo(gX + 6, gY - 2);
  ctx.closePath();
  ctx.fill();

  // Horned Gargoyle Head & Torso
  ctx.fillStyle = '#71717a';
  ctx.beginPath();
  ctx.arc(gX, gY - 4, 9, 0, Math.PI * 2);
  ctx.fill();

  // Curved stone horns
  ctx.beginPath();
  ctx.moveTo(gX - 6, gY - 10); ctx.lineTo(gX - 10, gY - 18); ctx.lineTo(gX - 2, gY - 11);
  ctx.moveTo(gX + 6, gY - 10); ctx.lineTo(gX + 10, gY - 18); ctx.lineTo(gX + 2, gY - 11);
  ctx.fill();

  // Piercing Glowing Crimson Demonic Eyes
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(gX - 3.5, gY - 4, 2, 0, Math.PI * 2);
  ctx.arc(gX + 3.5, gY - 4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Stone talons clutching ledge
  ctx.fillStyle = '#a1a1aa';
  ctx.fillRect(gX - 6, gY + 12, 4, 4);
  ctx.fillRect(gX + 2, gY + 12, 4, 4);
}

function drawGhostVacuumBusterArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Haunted mansion interior
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Vacuum Suction Funnel Stream (Cyan Plasma Beam)
  const stream = ctx.createLinearGradient(cx - 16, cy + 12, cx + 16, cy - 8);
  stream.addColorStop(0, '#38bdf8');
  stream.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)');
  stream.addColorStop(1, 'rgba(110, 231, 183, 0.2)');

  ctx.fillStyle = stream;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 14);
  ctx.lineTo(cx + 8, cy - 18);
  ctx.lineTo(cx + 24, cy - 2);
  ctx.lineTo(cx - 6, cy + 18);
  ctx.closePath();
  ctx.fill();

  // Screaming Cartoonish Translucent Ghost being captured
  const gX = cx + 14;
  const gY = cy - 8;
  ctx.fillStyle = 'rgba(110, 231, 183, 0.85)';
  ctx.shadowColor = '#34d399';
  ctx.shadowBlur = 8;
  // Ghost head & stretched body
  ctx.beginPath();
  ctx.arc(gX, gY, 9, 0, Math.PI * 2);
  ctx.fill();

  // Stretched suction tail
  ctx.beginPath();
  ctx.moveTo(gX - 6, gY + 6);
  ctx.quadraticCurveTo(cx, cy + 6, cx - 10, cy + 14);
  ctx.quadraticCurveTo(cx + 2, cy + 2, gX + 6, gY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ghost panicked eyes & screaming mouth
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(gX - 3, gY - 2, 2, 0, Math.PI * 2);
  ctx.arc(gX + 4, gY - 2, 2, 0, Math.PI * 2);
  ctx.ellipse(gX, gY + 3, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // High-Tech Proton Buster Vacuum Nozzle (Bottom Left)
  ctx.fillStyle = '#0284c7';
  ctx.save();
  ctx.translate(cx - 14, cy + 14);
  ctx.rotate(-0.6);
  ctx.fillRect(-6, -4, 14, 8);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(8, -5, 4, 10); // Brass intake collar
  ctx.restore();
}

function drawTombstoneCryptSliderArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Ancient stone crypt chamber
  ctx.fillStyle = '#140e0a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Carved Granite Sarcophagus Box Base
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 24, cy - 14, 48, 28, 4);
  else ctx.rect(cx - 24, cy - 14, 48, 28);
  ctx.fill();

  // Deep Tomb Interior Void (Exposed)
  ctx.fillStyle = '#020617';
  ctx.fillRect(cx - 20, cy - 10, 20, 20);

  // Gleaming Golden Scarab / Pharaoh Artifact inside
  ctx.fillStyle = '#facc15';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 8;
  // Golden scarab body & wings
  ctx.beginPath();
  ctx.ellipse(cx - 10, cy, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38bdf8'; // Cyan jewel in scarab
  ctx.beginPath();
  ctx.arc(cx - 10, cy - 1, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Heavy Sliding Sarcophagus Stone Lid (Slid open to the right)
  const lidX = cx - 2;
  const lidY = cy - 16;
  ctx.fillStyle = '#57534e';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(lidX, lidY, 26, 32, 4);
  else ctx.rect(lidX, lidY, 26, 32);
  ctx.fill();

  // Carved hieroglyphics / relief bands on stone lid
  ctx.strokeStyle = '#78716c';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(lidX + 3, lidY + 4, 20, 24);
  ctx.beginPath();
  ctx.moveTo(lidX + 6, lidY + 12); ctx.lineTo(lidX + 20, lidY + 12);
  ctx.moveTo(lidX + 6, lidY + 20); ctx.lineTo(lidX + 20, lidY + 20);
  ctx.stroke();

  // Stone grind dust sparks at friction boundary
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(lidX - 1, cy - 8, 1.5, 0, Math.PI * 2);
  ctx.arc(lidX - 2, cy + 6, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawCreepyDollCrawlArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Spooky nursery shadows
  ctx.fillStyle = '#1c1015';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Antique Winding Brass Key in Doll's back
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy + 2);
  ctx.lineTo(cx - 6, cy + 2);
  ctx.stroke();
  // Key wings
  ctx.beginPath();
  ctx.arc(cx - 16, cy - 3, 4, 0, Math.PI * 2);
  ctx.arc(cx - 16, cy + 7, 4, 0, Math.PI * 2);
  ctx.stroke();

  // Porcelain Doll Body in Victorian Frilled Dress
  ctx.fillStyle = '#4c0519';
  ctx.beginPath();
  ctx.ellipse(cx - 2, cy + 6, 12, 7, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Lace frill collar
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + 2, 5, 8, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Pale Porcelain Doll Head
  ctx.fillStyle = '#fdf4ff';
  ctx.shadowColor = '#f5d0fe';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(cx + 10, cy - 4, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ceramic hairline fracture / crack
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy - 14);
  ctx.lineTo(cx + 12, cy - 8);
  ctx.lineTo(cx + 8, cy - 4);
  ctx.stroke();

  // Glassy Jet-Black Button Eyes with Glint
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(cx + 7, cy - 4, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 15, cy - 4, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Red specular eye glint
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx + 7.5, cy - 4.5, 1, 0, Math.PI * 2);
  ctx.arc(cx + 15.5, cy - 4.5, 1, 0, Math.PI * 2);
  ctx.fill();

  // Rosy round cheeks & doll lips
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(cx + 6, cy + 1, 2, 0, Math.PI * 2);
  ctx.arc(cx + 16, cy + 1, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawOuijaSpiritBoardArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Séance candlelit table
  ctx.fillStyle = '#1c1007';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Antique Carved Wooden Spirit Board
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 24, cy - 18, 48, 36, 4);
  else ctx.rect(cx - 24, cy - 18, 48, 36);
  ctx.fill();

  // Pyrography Burned Gold Border
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 22, cy - 16, 44, 32);

  // Arched Alphabet Guide Arc (A - Z)
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy + 8, 18, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  // Sun & Moon Corner Emblems
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(cx - 16, cy - 10, 3, 0, Math.PI * 2); // Sun
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 16, cy - 10, 3, 0, Math.PI * 2); // Moon
  ctx.fill();
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(cx + 15, cy - 11, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Glowing Heart-Shaped Planchette moving across letters
  const plX = cx + 2;
  const plY = cy - 2;
  ctx.fillStyle = '#78350f';
  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(plX, plY - 10);
  ctx.lineTo(plX + 9, plY + 5);
  ctx.quadraticCurveTo(plX, plY + 2, plX - 9, plY + 5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Planchette Glass Viewing Lens (Glowing Cyan)
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(plX, plY - 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(plX - 1, plY - 3, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCursedClocktowerPendulumArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Midnight clocktower storm
  ctx.fillStyle = '#09090b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Giant Clock Dial Face in background (Illuminated by lightning)
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy - 6, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Roman Numeral hour marks
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    const nx = cx + Math.cos(angle) * 19;
    const ny = cy - 6 + Math.sin(angle) * 19;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.beginPath();
    ctx.arc(nx, ny, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Interlocking Brass Gears
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx - 16, cy + 12, 10, 0, Math.PI * 2);
  ctx.stroke();

  // Swinging Cursed Pendulum Shaft
  const pendAngle = 0.38;
  const pLen = 34;
  const pivotX = cx - 4;
  const pivotY = cy - 22;
  const endX = pivotX + Math.sin(pendAngle) * pLen;
  const endY = pivotY + Math.cos(pendAngle) * pLen;

  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Razor-Sharp Curved Crescent Scythe Blade
  ctx.save();
  ctx.translate(endX, endY);
  ctx.rotate(-pendAngle);

  // Scythe blade crescent
  ctx.fillStyle = '#f1f5f9';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0.2, Math.PI - 0.2);
  ctx.quadraticCurveTo(0, 4, -14 * Math.cos(0.2), 14 * Math.sin(0.2));
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Razor cutting edge glint
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Center pendulum weight disk
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSynthwaveNeonRacerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#090514';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Neon Sun
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 12, Math.PI, 0);
  ctx.fill();
  // Wireframe grid lines
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy + 18);
  ctx.lineTo(cx - 8, cy - 4);
  ctx.lineTo(cx + 8, cy - 4);
  ctx.lineTo(cx + 24, cy + 18);
  ctx.stroke();
  // Wedge car
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(cx, cy + 2);
  ctx.lineTo(cx + 8, cy + 16);
  ctx.lineTo(cx - 8, cy + 16);
  ctx.closePath();
  ctx.fill();
}

function drawPixelSpaceInvaderArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep CRT space background
  ctx.fillStyle = '#06060f';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Background pixel stars
  const stars = [
    [x + 12, y + 10, '#38bdf8', 1.5],
    [x + w - 16, y + 14, '#f43f5e', 1.5],
    [x + 24, y + h - 16, '#a855f7', 1.2],
    [x + w - 26, y + h - 22, '#34d399', 1.2],
    [x + w * 0.45, y + 8, '#ffffff', 1]
  ];
  for (const [sx, sy, col, r] of stars) {
    ctx.fillStyle = col as string;
    ctx.beginPath();
    ctx.arc(sx as number, sy as number, r as number, 0, Math.PI * 2);
    ctx.fill();
  }

  // Top Invader: Magenta Crab
  const crabX = cx - 18;
  const crabY = cy - 20;
  ctx.fillStyle = '#f43f5e';
  // Crab body & horns
  ctx.fillRect(crabX + 4, crabY, 14, 3);
  ctx.fillRect(crabX + 2, crabY + 3, 18, 5);
  ctx.fillRect(crabX + 4, crabY + 8, 14, 4);
  // Crab eyes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(crabX + 5, crabY + 4, 3, 3);
  ctx.fillRect(crabX + 14, crabY + 4, 3, 3);
  // Crab claws
  ctx.fillStyle = '#fb7185';
  ctx.fillRect(crabX, crabY + 5, 2, 7);
  ctx.fillRect(crabX + 20, crabY + 5, 2, 7);
  ctx.fillRect(crabX + 2, crabY + 11, 4, 2);
  ctx.fillRect(crabX + 16, crabY + 11, 4, 2);

  // Middle Invader: Emerald Squid
  const squidX = cx + 8;
  const squidY = cy - 14;
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(squidX + 5, squidY, 8, 3);
  ctx.fillRect(squidX + 2, squidY + 3, 14, 6);
  ctx.fillRect(squidX + 4, squidY + 9, 10, 4);
  // Squid tentacles
  ctx.fillRect(squidX + 2, squidY + 12, 3, 3);
  ctx.fillRect(squidX + 8, squidY + 12, 2, 3);
  ctx.fillRect(squidX + 13, squidY + 12, 3, 3);
  // Squid eyes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(squidX + 4, squidY + 4, 3, 3);
  ctx.fillRect(squidX + 11, squidY + 4, 3, 3);

  // Exploding Invader Bits on left
  ctx.fillStyle = '#fde047';
  ctx.fillRect(cx - 28, cy - 8, 3, 3);
  ctx.fillRect(cx - 33, cy - 13, 2, 2);
  ctx.fillRect(cx - 24, cy - 14, 2, 2);

  // Pixel Defense Bunker Arch
  ctx.fillStyle = '#10b981';
  ctx.fillRect(cx - 26, cy + 12, 16, 9);
  ctx.fillStyle = '#06060f';
  ctx.fillRect(cx - 21, cy + 16, 6, 6); // Bunker arch cutout
  // Bunker blast damage
  ctx.fillRect(cx - 25, cy + 12, 3, 3);

  // Player Defender Cannon
  const pX = cx + 8;
  const pY = cy + 14;
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(pX - 9, pY + 4, 18, 5);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(pX - 6, pY + 1, 12, 3);
  ctx.fillRect(pX - 2, pY - 4, 4, 6);

  // Rising Player Dual Lasers
  ctx.fillStyle = '#fde047';
  ctx.fillRect(pX - 4, pY - 14, 2, 7);
  ctx.fillRect(pX + 2, pY - 14, 2, 7);
  // Laser glow
  ctx.fillStyle = 'rgba(253, 224, 71, 0.4)';
  ctx.fillRect(pX - 6, pY - 16, 6, 11);
  ctx.fillRect(pX, pY - 16, 6, 11);
}

function drawVectorTankBattleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Classic Atari Vector Glow backdrop
  ctx.fillStyle = '#020b05';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Vector Wireframe Mountain Horizon
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, cy - 2);
  ctx.lineTo(x + 18, cy - 14);
  ctx.lineTo(x + 36, cy - 6);
  ctx.lineTo(x + 58, cy - 20);
  ctx.lineTo(x + 80, cy - 4);
  ctx.lineTo(x + w, cy - 10);
  ctx.stroke();

  // Vanishing Ground Grid
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.28)';
  ctx.lineWidth = 1;
  const horizonY = cy;
  for (let gx = -35; gx <= 35; gx += 14) {
    ctx.beginPath();
    ctx.moveTo(cx + gx * 0.3, horizonY);
    ctx.lineTo(cx + gx * 1.5, y + h);
    ctx.stroke();
  }
  for (let gy = 0; gy < 3; gy++) {
    const py = horizonY + 7 + gy * gy * 3.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, py);
    ctx.lineTo(x + w - 4, py);
    ctx.stroke();
  }

  // Enemy Red Vector Tank in distance
  const eX = cx + 22;
  const eY = cy - 4;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(eX - 8, eY - 4, 16, 7);
  ctx.strokeRect(eX - 4, eY - 8, 8, 4);
  ctx.beginPath();
  ctx.moveTo(eX - 2, eY - 6);
  ctx.lineTo(eX - 12, eY - 3);
  ctx.stroke();

  // Green Targeting Reticle on Enemy
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(eX, eY - 3, 9, 0, Math.PI * 2);
  ctx.moveTo(eX - 13, eY - 3); ctx.lineTo(eX - 9, eY - 3);
  ctx.moveTo(eX + 9, eY - 3); ctx.lineTo(eX + 13, eY - 3);
  ctx.moveTo(eX, eY - 12); ctx.lineTo(eX, eY - 8);
  ctx.moveTo(eX, eY + 2); ctx.lineTo(eX, eY + 6);
  ctx.stroke();

  // Player Vector Tank in foreground (3D wireframe)
  const pX = cx - 14;
  const pY = cy + 12;
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 1.8;
  // Left Tread
  ctx.strokeRect(pX - 16, pY - 5, 10, 18);
  // Right Tread
  ctx.strokeRect(pX + 8, pY - 5, 10, 18);
  // Tank Hull
  ctx.strokeRect(pX - 8, pY - 2, 18, 14);
  // Turret & long cannon
  ctx.strokeRect(pX - 4, pY + 1, 10, 8);
  ctx.beginPath();
  ctx.moveTo(pX + 1, pY + 1);
  ctx.lineTo(pX + 15, pY - 11);
  ctx.stroke();

  // Vector laser blast tracer
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pX + 16, pY - 12);
  ctx.lineTo(cx + 8, cy + 2);
  ctx.stroke();
  // Vector muzzle spark
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pX + 16, pY - 12, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPacMazeChompArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep arcade maze blue-black
  ctx.fillStyle = '#030712';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Luminous blue double-rail maze walls
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Upper boundary wall
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 14);
  ctx.lineTo(cx - 6, y + 14);
  ctx.lineTo(cx - 6, y + 26);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + 6, y + 14);
  ctx.lineTo(x + w - 10, y + 14);
  ctx.lineTo(x + w - 10, y + 26);
  ctx.stroke();

  // Lower boundary wall
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h - 14);
  ctx.lineTo(cx + 8, y + h - 14);
  ctx.lineTo(cx + 8, y + h - 26);
  ctx.stroke();

  // Maze inner highlight line
  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Food Pellets path
  const pelletDots = [
    [x + 18, cy + 2],
    [x + 28, cy + 2],
    [cx + 12, cy + 2],
    [cx + 24, cy + 2]
  ];
  ctx.fillStyle = '#fed7aa';
  for (const [px, py] of pelletDots) {
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Energizer Power Pellet (Glowing Gold)
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(x + w - 16, cy + 2, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Pac Chomp Character (Yellow)
  const pacX = cx - 6;
  const pacY = cy + 2;
  const mouthAngle = 0.38;
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(pacX, pacY, 11, mouthAngle, Math.PI * 2 - mouthAngle);
  ctx.lineTo(pacX, pacY);
  ctx.closePath();
  ctx.fill();
  // Chomp eye specular
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(pacX + 1, pacY - 6, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Chasing Ghost: Blinky (Red)
  const ghostX = cx - 26;
  const ghostY = cy + 2;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(ghostX, ghostY - 2, 8, Math.PI, 0, false);
  ctx.lineTo(ghostX + 8, ghostY + 8);
  // Scalloped bottom tentacles
  ctx.lineTo(ghostX + 4, ghostY + 5);
  ctx.lineTo(ghostX, ghostY + 8);
  ctx.lineTo(ghostX - 4, ghostY + 5);
  ctx.lineTo(ghostX - 8, ghostY + 8);
  ctx.closePath();
  ctx.fill();

  // Ghost eyes looking right toward player
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ghostX - 1.5, ghostY - 2, 2.5, 0, Math.PI * 2);
  ctx.arc(ghostX + 4.5, ghostY - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.arc(ghostX, ghostY - 2, 1.3, 0, Math.PI * 2);
  ctx.arc(ghostX + 6, ghostY - 2, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawBreakoutBrickBlasterArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Arcade CRT cabinet backdrop
  ctx.fillStyle = '#020617';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Vivid 4-row Brick Wall with beveled 3D depth
  const rows = [
    { yOffset: -24, color: '#ef4444', highlight: '#fca5a5' },
    { yOffset: -17, color: '#f97316', highlight: '#fdba74' },
    { yOffset: -10, color: '#eab308', highlight: '#fef08a' },
    { yOffset: -3, color: '#22c55e', highlight: '#86efac' }
  ];
  const bW = (w - 24) / 5;
  const bH = 5.5;

  for (const r of rows) {
    for (let c = 0; c < 5; c++) {
      // Omit broken brick on col 2, row 3
      if (r.yOffset === -3 && c === 2) continue;
      const bx = x + 12 + c * bW;
      const by = cy + r.yOffset;

      // Base brick body
      ctx.fillStyle = r.color;
      ctx.fillRect(bx + 1, by + 1, bW - 2, bH - 2);

      // Top specular bevel
      ctx.fillStyle = r.highlight;
      ctx.fillRect(bx + 1, by + 1, bW - 2, 1.2);
    }
  }

  // Shattering Brick Shards at impact site
  const shatterX = x + 12 + 2 * bW + bW * 0.5;
  const shatterY = cy - 1;
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(shatterX - 4, shatterY - 3, 3, 3);
  ctx.fillRect(shatterX + 3, shatterY - 4, 3.5, 2.5);
  ctx.fillRect(shatterX - 2, shatterY + 4, 2.5, 2.5);
  ctx.fillRect(shatterX + 4, shatterY + 3, 2, 3);

  // Speeding Arcade Ball with light trail
  const ballX = shatterX + 4;
  const ballY = cy + 8;
  // Motion blur trail
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.arc(ballX - 3, ballY - 5, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(ballX - 1.5, ballY - 2.5, 3, 0, Math.PI * 2);
  ctx.fill();
  // Glowing White Ball
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(ballX, ballY, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Glossy Metallic Player Paddle at bottom
  const padX = cx;
  const padY = cy + 20;
  const padW = 28;
  const padH = 6;
  // Paddle base
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(padX - padW / 2, padY, padW, padH, 3);
  else ctx.rect(padX - padW / 2, padY, padW, padH);
  ctx.fill();

  // Paddle high-tech neon stripe
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(padX - padW / 2 + 3, padY + 1.5, padW - 6, 2);

  // Endcap bumpers
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(padX - padW / 2, padY + 1, 3, padH - 2);
  ctx.fillRect(padX + padW / 2 - 3, padY + 1, 3, padH - 2);
}

function drawLaserDiscDanceArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Laser disco dark floor
  ctx.fillStyle = '#090514';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Diagonal laser spotlights
  ctx.strokeStyle = 'rgba(236, 72, 153, 0.25)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  // Iridescent Holographic Laser CD Disc
  const discR = 21;
  const discGrad = ctx.createLinearGradient(cx - discR, cy - discR, cx + discR, cy + discR);
  discGrad.addColorStop(0, '#38bdf8');
  discGrad.addColorStop(0.25, '#c084fc');
  discGrad.addColorStop(0.5, '#f472b6');
  discGrad.addColorStop(0.75, '#fbbf24');
  discGrad.addColorStop(1, '#34d399');

  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, discR, 0, Math.PI * 2);
  ctx.fill();

  // Disc reflection grooves
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, discR - 5, 0, Math.PI * 2);
  ctx.stroke();

  // Inner hub cutout
  ctx.fillStyle = '#090514';
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glowing DDR Neon Step Arrows around perimeter
  const arrows = [
    { angle: -Math.PI / 2, color: '#38bdf8' }, // UP (Cyan)
    { angle: 0, color: '#34d399' },            // RIGHT (Green)
    { angle: Math.PI / 2, color: '#f43f5e' },  // DOWN (Pink)
    { angle: Math.PI, color: '#fbbf24' }       // LEFT (Gold)
  ];

  for (const arr of arrows) {
    const ax = cx + Math.cos(arr.angle) * 23;
    const ay = cy + Math.sin(arr.angle) * 23;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(arr.angle + Math.PI / 2);
    ctx.fillStyle = arr.color;
    ctx.shadowColor = arr.color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 2);
    ctx.lineTo(1.5, 2);
    ctx.lineTo(1.5, 5);
    ctx.lineTo(-1.5, 5);
    ctx.lineTo(-1.5, 2);
    ctx.lineTo(-4, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCrtScanlineSniperArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dark CRT phosphor monitor
  ctx.fillStyle = '#031008';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Scanlines overlay
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = 1;
  for (let gy = y; gy < y + h; gy += 3) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }

  // Thermal Duck/Drone Target in center sights
  const tX = cx + 3;
  const tY = cy - 2;
  // Thermal heatmap glow
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(tX, tY, 8, 0, Math.PI * 2);
  ctx.fill();
  // Duck head & beak
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(tX + 5, tY - 3, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(tX + 8, tY - 4);
  ctx.lineTo(tX + 14, tY - 2);
  ctx.lineTo(tX + 8, tY);
  ctx.closePath();
  ctx.fill();
  // Target wing silhouette
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.ellipse(tX - 2, tY, 5, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Illuminated Tactical Sniper Crosshair Rings
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = 5;

  // Outer mil-dot ring
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Inner precision ring
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshairs with mil-hash marks
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy); ctx.lineTo(cx + 24, cy);
  ctx.moveTo(cx, cy - 24); ctx.lineTo(cx, cy + 24);
  ctx.stroke();

  // Center lock-on dot
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // HUD Diagnostics text
  ctx.fillStyle = '#86efac';
  ctx.font = 'bold 6.5px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('RNG 120m', x + 8, y + 11);
  ctx.textAlign = 'right';
  ctx.fillText('LOCK', x + w - 8, y + 11);
}

function drawCyberGridRunnerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#050512';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Perspective Cyber Grid Lines
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
  ctx.lineWidth = 1;
  for (let gx = -16; gx <= 16; gx += 8) {
    ctx.beginPath();
    ctx.moveTo(cx + gx, cy - 14);
    ctx.lineTo(cx + gx * 1.8, cy + 18);
    ctx.stroke();
  }

  // Floating Cyber Data Core (Octahedron/Diamond)
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(cx + 12, cy - 8);
  ctx.lineTo(cx + 16, cy - 3);
  ctx.lineTo(cx + 12, cy + 2);
  ctx.lineTo(cx + 8, cy - 3);
  ctx.closePath();
  ctx.fill();

  // Cyber Hoverboard with Neon Thruster Plume
  ctx.fillStyle = '#f43f5e';
  ctx.save();
  ctx.translate(cx - 6, cy + 2);
  ctx.rotate(-0.2);
  // Hover deck
  ctx.fillRect(-10, -3, 20, 6);
  // Rider visor
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, -6, 4, 0, Math.PI * 2);
  ctx.fill();
  // Cyan Nitro Thruster exhaust
  ctx.fillStyle = 'rgba(6, 182, 212, 0.7)';
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-18, -2);
  ctx.lineTo(-18, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSynthDrumPadArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Brushed metal sampler housing
  ctx.fillStyle = '#18181b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Mini OLED Display at top
  ctx.fillStyle = '#09090b';
  ctx.fillRect(cx - 22, cy - 22, 44, 10);
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 22, cy - 22, 44, 10);

  // Equalizer spectrum bars on OLED
  const eqCols = ['#22c55e', '#38bdf8', '#a855f7', '#f43f5e', '#fbbf24'];
  const barHeights = [4, 7, 5, 8, 6];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = eqCols[i];
    ctx.fillRect(cx - 18 + i * 5, cy - 14 - barHeights[i], 3, barHeights[i]);
  }
  // BPM Text
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 6.5px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('128 BPM', cx + 20, cy - 15);

  // 4 Velocity-Sensitive Silicone Pads (2x2 Grid)
  const padSize = 13;
  const gap = 4;
  const pData = [
    { ox: -padSize - gap / 2, oy: -padSize / 2 + 1, col: '#ef4444', glow: '#f87171', active: true },
    { ox: gap / 2, oy: -padSize / 2 + 1, col: '#06b6d4', glow: '#38bdf8', active: false },
    { ox: -padSize - gap / 2, oy: padSize / 2 + 1 + gap, col: '#f59e0b', glow: '#fbbf24', active: false },
    { ox: gap / 2, oy: padSize / 2 + 1 + gap, col: '#a855f7', glow: '#c084fc', active: false }
  ];

  for (const pad of pData) {
    const px = cx + pad.ox;
    const py = cy + pad.oy;

    // Pad bevel base
    ctx.fillStyle = '#27272a';
    ctx.fillRect(px - 1, py - 1, padSize + 2, padSize + 2);

    if (pad.active) {
      // Lit / triggered pad shockwave aura
      ctx.fillStyle = pad.glow;
      ctx.shadowColor = pad.col;
      ctx.shadowBlur = 8;
      ctx.fillRect(px, py, padSize, padSize);
      ctx.shadowBlur = 0;

      // Finger strike impact ripples
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px + padSize / 2, py + padSize / 2, padSize * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = pad.col;
      ctx.fillRect(px, py, padSize, padSize);
      // Soft inner glow edge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(px + 1, py + 1, padSize - 2, 2);
    }
  }
}

function drawMatrixCodeRainArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep cyber-noir digital void
  ctx.fillStyle = '#020b05';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Matrix Digital Streams
  const streams = [
    { sx: x + 10, glyphs: ['0', '1', 'X', '9'], headY: y + 26 },
    { sx: x + 24, glyphs: ['F', 'A', '3', '0', '7'], headY: y + h - 8 },
    { sx: cx - 4, glyphs: ['Z', '8', 'E', '1'], headY: y + 36 },
    { sx: cx + 14, glyphs: ['4', 'B', 'C', '0', 'F', '2'], headY: y + h - 14 },
    { sx: x + w - 12, glyphs: ['1', '0', '9', 'X'], headY: y + 28 }
  ];

  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';

  for (const str of streams) {
    const total = str.glyphs.length;
    for (let i = 0; i < total; i++) {
      const gy = str.headY - (total - 1 - i) * 8;
      if (gy < y || gy > y + h) continue;

      if (i === total - 1) {
        // Leading white-hot glyph with bright phosphor bloom
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 6;
        ctx.fillText(str.glyphs[i], str.sx, gy);
        ctx.shadowBlur = 0;
      } else if (i === total - 2) {
        ctx.fillStyle = '#86efac';
        ctx.fillText(str.glyphs[i], str.sx, gy);
      } else {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.45)';
        ctx.fillText(str.glyphs[i], str.sx, gy);
      }
    }
  }

  // Central Golden Cryptographic Key floating in stream
  ctx.fillStyle = '#f59e0b';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 7;
  // Key loop
  ctx.beginPath();
  ctx.arc(cx - 5, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#020b05';
  ctx.beginPath();
  ctx.arc(cx - 5, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  // Key stem & teeth
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(cx + 1, cy - 2, 14, 4);
  ctx.fillRect(cx + 8, cy + 2, 3, 3);
  ctx.fillRect(cx + 13, cy + 2, 3, 4);
  ctx.shadowBlur = 0;

  // Cyan Cipher Data Ring around key
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx + 2, cy, 14, -0.6, Math.PI * 1.5);
  ctx.stroke();
}

function drawSharksAndMinnowsArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Deep ocean gradient
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#38BDF8');
  grad.addColorStop(0.5, '#0284C7');
  grad.addColorStop(1, '#0369A1');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Wave ripples
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx - 20, cy, 32, -0.6, 0.6);
  ctx.stroke();

  // Shark Fin slicing through water
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy + 10);
  ctx.lineTo(cx - 4, cy - 20);
  ctx.lineTo(cx + 12, cy + 10);
  ctx.closePath();
  ctx.fill();

  // Water wake splash around fin
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy + 10);
  ctx.lineTo(cx + 18, cy + 10);
  ctx.stroke();

  // Little Golden Minnow darting ahead
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.ellipse(cx + 28, cy - 12, 10, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Minnow tail
  ctx.beginPath();
  ctx.moveTo(cx + 19, cy - 8);
  ctx.lineTo(cx + 13, cy - 13);
  ctx.lineTo(cx + 13, cy - 3);
  ctx.closePath();
  ctx.fill();
}

function drawPowerPathClashArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Tower dungeon background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Branching doors
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 30, cy - 24, 25, 34);
  ctx.strokeRect(cx + 5, cy - 24, 25, 34);

  // Door Labels
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 8.5px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('+15', cx - 18, cy - 5);

  ctx.fillStyle = '#F59E0B';
  ctx.fillText('x2', cx + 18, cy - 5);

  // Clash Sword in center
  ctx.font = '22px sans-serif';
  ctx.fillText('⚔️', cx, cy + 24);
}

function drawLandscapeArtilleryArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dusk Sky
  const skyGrad = ctx.createLinearGradient(x, y, x, y + h);
  skyGrad.addColorStop(0, '#0F172A');
  skyGrad.addColorStop(0.6, '#334155');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(x, y, w, h);

  // Curved Rolling Hill
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + h * 0.65);
  ctx.quadraticCurveTo(x + w * 0.35, y + h * 0.45, x + w * 0.7, y + h * 0.6);
  ctx.quadraticCurveTo(x + w * 0.88, y + h * 0.7, x + w, y + h * 0.55);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fillStyle = '#15803D';
  ctx.fill();

  // Lime Crest
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.65);
  ctx.quadraticCurveTo(x + w * 0.35, y + h * 0.45, x + w * 0.7, y + h * 0.6);
  ctx.quadraticCurveTo(x + w * 0.88, y + h * 0.7, x + w, y + h * 0.55);
  ctx.strokeStyle = '#4ADE80';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Red Player on Left Hill
  const p1X = x + w * 0.25;
  const p1Y = y + h * 0.52;
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(p1X, p1Y - 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(p1X - 5, p1Y - 2, 10, 8);

  // Blue Player on Right Hill
  const p2X = x + w * 0.78;
  const p2Y = y + h * 0.62;
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(p2X, p2Y - 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(p2X - 5, p2Y - 2, 10, 8);

  // Ballistic Trajectory Arc from Red towards Blue
  ctx.save();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(p1X + 4, p1Y - 10);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.15, p2X - 4, p2Y - 14);
  ctx.stroke();
  ctx.restore();

  // Glowing Projectile
  ctx.fillStyle = '#F97316';
  ctx.beginPath();
  ctx.arc(x + w * 0.52, y + h * 0.24, 4, 0, Math.PI * 2);
  ctx.fill();

  // Target Crosshair
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#EF4444';
  ctx.textAlign = 'center';
  ctx.fillText('🎯', p2X, p2Y - 20);
}

function drawSpamClickShowdownArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Vibrant stage night background
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, '#090D16');
  bgGrad.addColorStop(1, '#1E1B4B');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // Stage light cone
  ctx.save();
  ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.85, y + h);
  ctx.lineTo(x + w * 0.15, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Bottle Body blasting upward
  const bX = x + w * 0.42;
  const bY = y + h * 0.38;
  ctx.save();
  ctx.translate(bX, bY);
  ctx.rotate(-0.18);

  // Fizz exhaust trail
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.beginPath();
  ctx.moveTo(-10, 30);
  ctx.lineTo(10, 30);
  ctx.lineTo(16, 55);
  ctx.lineTo(-16, 55);
  ctx.closePath();
  ctx.fill();

  // Sparks
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(-8, 48, 3, 0, Math.PI * 2);
  ctx.arc(6, 52, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Pressurized Bottle
  ctx.fillStyle = '#EF4444';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-14, -28, 28, 56, 8);
  ctx.fill();
  ctx.stroke();

  // Bottle Neck
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.rect(-6, -42, 12, 14);
  ctx.fill();
  ctx.stroke();

  // Foam Eruption
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, -46, 10, 0, Math.PI * 2);
  ctx.arc(-8, -42, 6, 0, Math.PI * 2);
  ctx.arc(8, -42, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Dynamic Tapping Hand / Cursor
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('👆', x + w * 0.72, y + h * 0.72);

  // Lightning Clicks
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#FBBF24';
  ctx.fillText('⚡ 1000 PSI!', x + w * 0.5, y + h * 0.92);
}

// Fallback Default Arcade Token
function drawDefaultArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);

  const cx = x + w * 0.5;
  const cy = y + h * 0.46;

  // Golden Arcade Token
  ctx.save();
  ctx.translate(cx, cy);

  // Outer Token Ring with Drop Shadow
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.arc(0, 3, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner Token Bezel
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.stroke();

  // Star Engraving
  ctx.fillStyle = '#FEF08A';
  ctx.font = '900 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★', 0, 6);

  ctx.restore();

  // Glowing Arcade Marquee Text
  ctx.fillStyle = '#38BDF8';
  ctx.shadowColor = '#38BDF8';
  ctx.shadowBlur = 8;
  ctx.font = '900 11px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MINIGAME', cx, y + h - 12);
  ctx.shadowBlur = 0;
}


