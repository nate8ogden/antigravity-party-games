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
  const cacheKey = `${gameId}_${rw}x${rh}`;
  let cached = thumbnailCache.get(cacheKey);

  if (!cached) {
    cached = document.createElement('canvas');
    cached.width = rw;
    cached.height = rh;
    const offCtx = cached.getContext('2d');
    if (offCtx) {
      drawThumbnailDirect(offCtx, gameId, 0, 0, rw, rh);
    }
    thumbnailCache.set(cacheKey, cached);
  }

  ctx.drawImage(cached, Math.round(x), Math.round(y), rw, rh);
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
    default:
      drawDefaultArt(ctx, x, y, w, h);
      break;
  }

  // Premium angled arcade glass reflection & vignette
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h * 0.32);
  ctx.lineTo(x, y + h * 0.6);
  ctx.closePath();
  const glassGrad = ctx.createLinearGradient(x, y, x, y + h * 0.6);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.30)');
  glassGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.12)');
  glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = glassGrad;
  ctx.fill();

  // Subtle bottom vignette inside artwork
  const botVignette = ctx.createLinearGradient(x, y + h - 28, x, y + h);
  botVignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  botVignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = botVignette;
  ctx.fillRect(x, y + h - 28, w, 28);

  // Crisp inner bezel border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
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
  ctx.fillStyle = '#050814';
  ctx.fillRect(x, y, w, h);

  // Neon grid lines
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);

  // Energized Disc
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 6, 0, Math.PI * 2);
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
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y, w, h);

  // Vault box
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x + w / 2 - 20, y + h / 2 - 16, 40, 32);

  // Raccoon with mask
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2 - 4, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.fillRect(x + w / 2 - 10, y + h / 2 - 8, 20, 5);
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
  ctx.fillStyle = '#7F1D1D';
  ctx.fillRect(x, y, w, h);

  // Duck cutout
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 12, 0, Math.PI * 2);
  ctx.fill();

  // Reticle
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 16, 0, Math.PI * 2);
  ctx.stroke();
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

  // Anvil body
  ctx.fillStyle = '#44403C';
  ctx.fillRect(x + w * 0.3, y + h * 0.55, w * 0.4, h * 0.25);

  // Glowing hot blade
  ctx.fillStyle = '#F97316';
  ctx.fillRect(x + w * 0.25, y + h * 0.52, w * 0.5, 6);

  // Striking hammer
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(x + w * 0.5, y + h * 0.25, 14, 20);
}

// [G-73] Potion Alchemist Art
function drawPotionAlchemistArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#12121E';
  ctx.fillRect(x, y, w, h);

  // Cast-iron cauldron
  ctx.fillStyle = '#212121';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.62, 22, 0, Math.PI);
  ctx.fill();

  // Glowing magic liquid & bubbles
  ctx.fillStyle = '#8B5CF6';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.62, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#A78BFA';
  ctx.beginPath();
  ctx.arc(x + w / 2 - 6, y + h * 0.48, 4, 0, Math.PI * 2);
  ctx.arc(x + w / 2 + 8, y + h * 0.42, 5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-74] Royal Feast Art
function drawRoyalFeastArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#261C14';
  ctx.fillRect(x, y, w, h);

  // Golden platter
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.72, 26, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Roast turkey drumstick
  ctx.fillStyle = '#8D6E63';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.5, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + w / 2 + 10, y + h * 0.48, 6, 4);
}

// [G-75] Sword in Stone Art
function drawSwordInStoneArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0D1B1E';
  ctx.fillRect(x, y, w, h);

  // Boulder
  ctx.fillStyle = '#455A64';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.75, 28, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Excalibur embedded
  ctx.fillStyle = '#ECEFF1';
  ctx.fillRect(x + w / 2 - 2, y + h * 0.28, 4, 30);
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(x + w / 2 - 10, y + h * 0.25, 20, 4); // crossguard
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.18, 3, 0, Math.PI * 2); // pommel
  ctx.fill();
}

// [G-76] Dungeon Escape Art
function drawDungeonEscapeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#151520';
  ctx.fillRect(x, y, w, h);

  // Golden Portcullis bars
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(x + w * 0.25, y + 10, w * 0.5, 6);
  for (let bx = x + w * 0.3; bx <= x + w * 0.7; bx += 8) {
    ctx.fillRect(bx, y + 14, 3, 14);
  }

  // Swinging axe blade
  ctx.strokeStyle = '#B0BEC5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.35);
  ctx.lineTo(x + w * 0.7, y + h * 0.65);
  ctx.stroke();

  ctx.fillStyle = '#CFD8DC';
  ctx.beginPath();
  ctx.arc(x + w * 0.7, y + h * 0.65, 10, 0, Math.PI * 2);
  ctx.fill();
}

// [G-77] Neon Drifters Art
function drawNeonDriftersArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0A0A14';
  ctx.fillRect(x, y, w, h);

  // Curved drift line
  ctx.strokeStyle = '#00E5FF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + w * 0.4, y + h * 0.6, 22, -1.2, 1.2);
  ctx.stroke();

  // Drifting car
  ctx.fillStyle = '#E53935';
  ctx.fillRect(x + w * 0.5, y + h * 0.4, 18, 10);
  ctx.fillStyle = '#00E5FF';
  ctx.fillRect(x + w * 0.45, y + h * 0.46, 5, 2); // tire smoke
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
  ctx.fillStyle = '#10101C';
  ctx.fillRect(x, y, w, h);

  // Kart
  ctx.fillStyle = '#FB8C00';
  ctx.fillRect(x + w * 0.35, y + h * 0.45, 18, 14);

  // Homing missile
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.arc(x + w * 0.7, y + h * 0.35, 4, 0, Math.PI * 2);
  ctx.fill();

  // Mystery Box
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 10, y + 12, 10, 10);
}

// [G-81] Monorail Hijack Art
function drawMonorailHijackArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0A0A14';
  ctx.fillRect(x, y, w, h);

  // Train car
  ctx.fillStyle = '#37474F';
  ctx.fillRect(x + 10, y + h * 0.6, w - 20, 24);

  // Window streak
  ctx.fillStyle = '#00E5FF';
  ctx.fillRect(x + 15, y + h * 0.68, w - 30, 4);

  // Overhead gantry
  ctx.fillStyle = '#E53935';
  ctx.fillRect(x + w * 0.55, y + 10, 14, 26);
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
  ctx.fillStyle = '#0A0A14';
  ctx.fillRect(x, y, w, h);

  // Velodrome oval
  ctx.strokeStyle = '#00E5FF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w * 0.38, h * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Rocket flare
  ctx.fillStyle = '#FF5722';
  ctx.beginPath();
  ctx.arc(x + w * 0.7, y + h * 0.35, 5, 0, Math.PI * 2);
  ctx.fill();
}

// [G-84] Cyber Demolition Art
function drawCyberDemolitionArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#14141C';
  ctx.fillRect(x, y, w, h);

  // Scrap Tower
  ctx.fillStyle = '#455A64';
  ctx.beginPath();
  ctx.arc(x + w * 0.7, y + h * 0.5, 12, 0, Math.PI * 2);
  ctx.fill();

  // Wrecking ball chain
  ctx.strokeStyle = '#B0BEC5';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 15, y + h * 0.5);
  ctx.lineTo(x + w * 0.5, y + h * 0.5);
  ctx.stroke();

  // Wrecking ball
  ctx.fillStyle = '#212121';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 7, 0, Math.PI * 2);
  ctx.fill();
}

// [G-85] Laser Speedway Art
function drawLaserSpeedwayArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0A0A14';
  ctx.fillRect(x, y, w, h);

  // Glowing laser slot rails
  ctx.strokeStyle = '#00E5FF';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);

  // Micro slot-car
  ctx.fillStyle = '#FF1744';
  ctx.fillRect(x + w * 0.45, y + 8, 12, 8);
}

// [G-86] Gravity Pods Art
function drawGravityPodsArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#06060E';
  ctx.fillRect(x, y, w, h);

  // Perspective tunnel rings
  ctx.strokeStyle = '#00E5FF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 18, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 8, 0, Math.PI * 2);
  ctx.stroke();

  // Pod on outer edge
  ctx.fillStyle = '#FB8C00';
  ctx.fillRect(x + w / 2 + 14, y + h / 2 - 4, 7, 8);
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
  // Bar counter
  ctx.fillStyle = '#4E342E';
  ctx.fillRect(x + 10, y + h * 0.6, w - 20, h * 0.35);
  // Sliding beer mug
  ctx.fillStyle = '#FBBF24';
  ctx.fillRect(x + w * 0.45, y + h * 0.5, 18, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + w * 0.45, y + h * 0.47, 18, 5);
}

// 118. Train Heist
function drawTrainHeistArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#EA580C';
  ctx.fillRect(x, y, w, h);
  // Train roof
  ctx.fillStyle = '#374151';
  ctx.fillRect(x, y + h * 0.65, w, h * 0.35);
  // Cowboy running
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.arc(x + w * 0.35, y + h * 0.52, 10, 0, Math.PI * 2);
  ctx.fill();
  // Gold sack
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(x + w * 0.7, y + h * 0.45, 9, 0, Math.PI * 2);
  ctx.fill();
}

// 119. Gold Panning
function drawGoldPanningArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(x, y, w, h);
  // Pan
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 26, 0, Math.PI * 2);
  ctx.fill();
  // Silt
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 20, 0, Math.PI * 2);
  ctx.fill();
  // Gold nugget
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 6, 0, Math.PI * 2);
  ctx.fill();
}

// 120. Rodeo Bull
function drawRodeoBullArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#451A03';
  ctx.fillRect(x, y, w, h);
  // Bull body tilted
  ctx.fillStyle = '#78350F';
  ctx.save();
  ctx.translate(x + w * 0.5, y + h * 0.55);
  ctx.rotate(-0.25);
  ctx.fillRect(-22, -12, 44, 24);
  // Horns
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(20, -10);
  ctx.lineTo(28, -20);
  ctx.stroke();
  // Rider
  ctx.fillStyle = '#1E88E5';
  ctx.beginPath();
  ctx.arc(0, -20, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 121. Horseshoe Toss
function drawHorseshoeTossArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#78350F';
  ctx.fillRect(x, y, w, h);
  // Stake
  ctx.fillStyle = '#E5E7EB';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.45, 6, 0, Math.PI * 2);
  ctx.fill();
  // Horseshoe ringing stake
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.45, 14, 0.4 * Math.PI, 1.6 * Math.PI);
  ctx.stroke();
}

// 122. Dynamite Tumble
function drawDynamiteTumbleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#292524';
  ctx.fillRect(x, y, w, h);
  // Red TNT Stick
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(x + w * 0.35, y + h * 0.42, 28, 16);
  // Spark fuse
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35 + 28, y + h * 0.5);
  ctx.lineTo(x + w * 0.35 + 36, y + h * 0.44);
  ctx.stroke();
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(x + w * 0.35 + 36, y + h * 0.44, 4, 0, Math.PI * 2);
  ctx.fill();
}

// 123. Cactus Slalom
function drawCactusSlalomArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#D97706';
  ctx.fillRect(x, y, w, h);
  // Saguaro Cactus
  ctx.fillStyle = '#15803D';
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  ctx.fillRect(cx - 3, cy - 14, 6, 28);
  ctx.fillRect(cx - 10, cy - 6, 8, 3);
  ctx.fillRect(cx - 10, cy - 12, 3, 8);
  ctx.fillRect(cx + 2, cy - 2, 8, 3);
  ctx.fillRect(cx + 7, cy - 8, 3, 8);
}

// 124. Bandit Chase
function drawBanditChaseArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#92400E';
  ctx.fillRect(x, y, w, h);
  // Center coach
  ctx.fillStyle = '#571C0C';
  ctx.fillRect(x + w * 0.38, y + h * 0.4, 24, 20);
  // Reticle
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + w * 0.72, y + h * 0.45, 10, 0, Math.PI * 2);
  ctx.stroke();
}

// 125. Rattlesnake Reflex
function drawRattlesnakeReflexArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#431407';
  ctx.fillRect(x, y, w, h);
  // Snake coils
  ctx.strokeStyle = '#15803D';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.52, 16, 0, Math.PI * 1.8);
  ctx.stroke();
  // Snake eyes
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.4, 5, 0, Math.PI * 2);
  ctx.fill();
}

// 126. Western Poker
function drawWesternPokerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#064E3B';
  ctx.fillRect(x, y, w, h);
  // Two playing cards
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + w * 0.32, y + h * 0.35, 18, 26);
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + w * 0.32, y + h * 0.35, 18, 26);
  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText('A♥', x + w * 0.35, y + h * 0.5);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + w * 0.52, y + h * 0.35, 18, 26);
  ctx.strokeRect(x + w * 0.52, y + h * 0.35, 18, 26);
  ctx.fillStyle = '#111827';
  ctx.fillText('K♠', x + w * 0.55, y + h * 0.5);
}

// 127. Laser Tripwire
function drawLaserTripwireArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);
  // Red lasers criss-crossed
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.35);
  ctx.lineTo(x + w, y + h * 0.35);
  ctx.moveTo(x, y + h * 0.65);
  ctx.lineTo(x + w, y + h * 0.65);
  ctx.stroke();
  // Spy crouching
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.5, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 128. Vault Safe
function drawVaultSafeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y, w, h);
  // Safe Dial
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.5);
  ctx.lineTo(x + w * 0.5 + 14, y + h * 0.5 - 14);
  ctx.stroke();
}

// 129. Security Camera
function drawSecurityCameraArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);
  // Yellow vision cone
  ctx.fillStyle = 'rgba(254, 240, 138, 0.3)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + 10);
  ctx.lineTo(x + w * 0.1, y + h);
  ctx.lineTo(x + w * 0.8, y + h);
  ctx.closePath();
  ctx.fill();
  // Camera mount
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.arc(x + w * 0.3, y + 10, 8, 0, Math.PI * 2);
  ctx.fill();
}

// 130. Briefcase Snatch
function drawBriefcaseSnatchArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y, w, h);
  // Golden Briefcase
  ctx.fillStyle = '#D97706';
  ctx.fillRect(x + w * 0.35, y + h * 0.4, 28, 18);
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + w * 0.35, y + h * 0.4, 28, 18);
  // Handle
  ctx.strokeRect(x + w * 0.44, y + h * 0.34, 10, 6);
}

// 131. Hack Terminal
function drawHackTerminalArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#030712';
  ctx.fillRect(x, y, w, h);
  // Green cyber code lines
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('0x7F A4 C9', x + 10, y + h * 0.4);
  ctx.fillText('SYS_OK >_', x + 10, y + h * 0.65);
}

// 132. Smoke Bomb Escape
function drawSmokeBombEscapeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0B132B';
  ctx.fillRect(x, y, w, h);
  // Smoke plume
  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 24, 0, Math.PI * 2);
  ctx.arc(x + w * 0.38, y + h * 0.45, 18, 0, Math.PI * 2);
  ctx.arc(x + w * 0.62, y + h * 0.45, 18, 0, Math.PI * 2);
  ctx.fill();
}

// 133. Micro Wiretap
function drawMicroWiretapArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#18181B';
  ctx.fillRect(x, y, w, h);
  // Microphone bug
  ctx.fillStyle = '#71717A';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Radio waves
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 26, -0.6, 0.6);
  ctx.stroke();
}

// 134. Rooftop Zipline
function drawRooftopZiplineArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);
  // Cable wire
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x + w, y + h - 10);
  ctx.stroke();
  // Zipliner
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 9, 0, Math.PI * 2);
  ctx.fill();
}

// 135. Drone Intercept
function drawDroneInterceptArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);
  // Drone frame
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + h * 0.35);
  ctx.lineTo(x + w * 0.65, y + h * 0.65);
  ctx.moveTo(x + w * 0.65, y + h * 0.35);
  ctx.lineTo(x + w * 0.35, y + h * 0.65);
  ctx.stroke();
  // Red sensor
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 5, 0, Math.PI * 2);
  ctx.fill();
}

// 136. Disguise Shuffle
function drawDisguiseShuffleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1E1B4B';
  ctx.fillRect(x, y, w, h);
  // Golden Venetian Mask
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.5, 20, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Mask eyeholes
  ctx.fillStyle = '#1E1B4B';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.42, y + h * 0.5, 4, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.58, y + h * 0.5, 4, 3, 0, 0, Math.PI * 2);
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
  ctx.fillStyle = '#030712';
  ctx.fillRect(x, y, w, h);
  // Pitch wave
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let px = 0; px < w; px += 2) {
    const py = y + h * 0.5 + Math.sin(px * 0.12) * 12;
    if (px === 0) ctx.moveTo(x + px, py);
    else ctx.lineTo(x + px, py);
  }
  ctx.stroke();
  // Target pitch bar
  ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.fillRect(x + w * 0.25, y + h * 0.45, w * 0.5, 6);
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
  ctx.fillStyle = '#09090B';
  ctx.fillRect(x, y, w, h);
  // EQ bars
  const heights = [0.4, 0.7, 0.9, 0.5, 0.8, 0.6];
  const colors = ['#22C55E', '#10B981', '#38BDF8', '#8B5CF6', '#EC4899', '#F43F5E'];
  const barW = (w - 30) / heights.length;
  heights.forEach((ht, i) => {
    const bx = x + 15 + i * barW;
    const barH = h * 0.6 * ht;
    const by = y + h * 0.8 - barH;
    ctx.fillStyle = colors[i];
    ctx.fillRect(bx + 2, by, barW - 4, barH);
  });
}

// 145. Retro Chiptune
function drawRetroChiptuneArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#18181B';
  ctx.fillRect(x, y, w, h);
  // 8-bit Music Note
  ctx.fillStyle = '#A855F7';
  // Note stem & flags (pixelated blocks)
  ctx.fillRect(x + w * 0.35, y + h * 0.55, 10, 8);
  ctx.fillRect(x + w * 0.55, y + h * 0.45, 10, 8);
  ctx.fillRect(x + w * 0.43, y + h * 0.25, 4, 25);
  ctx.fillRect(x + w * 0.63, y + h * 0.2, 4, 25);
  ctx.fillRect(x + w * 0.43, y + h * 0.2, 24, 6);
  // Golden Sparkle
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(x + w * 0.25, y + h * 0.3, 4, 4);
  ctx.fillRect(x + w * 0.75, y + h * 0.6, 4, 4);
}

// 146. Disco Tile
function drawDiscoTileArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);
  // 3x3 dance floor grid
  const cols = ['#EC4899', '#06B6D4', '#F59E0B', '#10B981'];
  const sz = 16;
  const sx = x + w * 0.5 - sz * 1.5;
  const sy = y + h * 0.5 - sz * 1.5;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = cols[(r * 3 + c) % cols.length];
      ctx.fillRect(sx + c * sz + 1, sy + r * sz + 1, sz - 2, sz - 2);
    }
  }
}

// 147. Ring Toss
function drawRingTossArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#7F1D1D';
  ctx.fillRect(x, y, w, h);
  // Glass bottle
  ctx.fillStyle = '#047857';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.44, y + h * 0.45, 12, 24, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + w * 0.47, y + h * 0.3, 6, 15, 1);
  ctx.fill();
  // Golden ring hooked around neck
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.42, 14, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// 148. Rollercoaster Thrill
function drawRollercoasterThrillArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#090D16';
  ctx.fillRect(x, y, w, h);
  // Coaster track rails
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h * 0.75);
  ctx.bezierCurveTo(x + w * 0.4, y + h * 0.8, x + w * 0.6, y + h * 0.2, x + w - 10, y + h * 0.35);
  ctx.stroke();
  // Coaster Cart
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.52, y + h * 0.35, 18, 12, 3);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
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
  ctx.fillStyle = '#18181B';
  ctx.fillRect(x, y, w, h);
  // Vertical mirrors
  ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.fillRect(x + w * 0.3, y + 10, 4, h - 20);
  ctx.fillRect(x + w * 0.7, y + 10, 4, h - 20);
  // True player
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, 9, 0, Math.PI * 2);
  ctx.fill();
  // Distorted mirror reflection
  ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.85, y + h * 0.5, 6, 14, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 153. Cotton Candy
function drawCottonCandyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1E1B4B';
  ctx.fillRect(x, y, w, h);
  // Paper stick
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.4);
  ctx.lineTo(x + w * 0.5, y + h * 0.85);
  ctx.stroke();
  // Fluffy Pink Puff
  ctx.fillStyle = '#EC4899';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.4, 20, 0, Math.PI * 2);
  ctx.arc(x + w * 0.42, y + h * 0.35, 14, 0, Math.PI * 2);
  ctx.arc(x + w * 0.58, y + h * 0.35, 14, 0, Math.PI * 2);
  ctx.fill();
}

// 154. Test Your Strength
function drawTestStrengthArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x, y, w, h);
  // High-striker tower
  ctx.fillStyle = '#334155';
  ctx.fillRect(x + w * 0.45, y + 15, 10, h - 30);
  // Golden Bell at top
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + 18, 10, Math.PI, 0);
  ctx.fill();
  // Rising puck
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(x + w * 0.43, y + h * 0.45, 14, 6);
  // Sledgehammer
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(x + w * 0.65, y + h * 0.65, 14, 8);
  ctx.fillStyle = '#78350F';
  ctx.fillRect(x + w * 0.7, y + h * 0.72, 4, 16);
}

// 155. Haunted Mansion
function drawHauntedMansionArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#05070E';
  ctx.fillRect(x, y, w, h);
  // Ghost silhouette
  ctx.fillStyle = '#A855F7';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.4, 14, Math.PI, 0);
  ctx.lineTo(x + w * 0.5 + 14, y + h * 0.6);
  ctx.lineTo(x + w * 0.5, y + h * 0.55);
  ctx.lineTo(x + w * 0.5 - 14, y + h * 0.6);
  ctx.closePath();
  ctx.fill();
  // Ghost eyes
  ctx.fillStyle = '#05070E';
  ctx.beginPath();
  ctx.arc(x + w * 0.46, y + h * 0.38, 2.5, 0, Math.PI * 2);
  ctx.arc(x + w * 0.54, y + h * 0.38, 2.5, 0, Math.PI * 2);
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
  ctx.fillStyle = '#2d1b4e';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  // Zeus Lightning Bolt
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + h * 0.15);
  ctx.lineTo(cx + 4, y + h * 0.42);
  ctx.lineTo(cx - 4, y + h * 0.52);
  ctx.lineTo(cx + 6, y + h * 0.85);
  ctx.stroke();
  // Golden Rod Conduit
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + 6, y + h * 0.75);
  ctx.lineTo(cx + 6, y + h * 0.9);
  ctx.stroke();
}

function drawAnubisScalesArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#231828';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.45;
  // Center beam
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(cx - 2, cy - 10, 4, 30);
  ctx.fillRect(cx - 20, cy - 10, 40, 4);
  // Pans
  ctx.fillStyle = '#b7950b';
  ctx.beginPath();
  ctx.ellipse(cx - 16, cy + 12, 8, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 16, cy + 12, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Feather on left pan
  ctx.fillStyle = '#5dade2';
  ctx.beginPath();
  ctx.ellipse(cx - 16, cy + 8, 2, 6, 0.2, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Torus ring
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.stroke();
  // Singularity Core
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawWarpGateJumpArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#080410';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Warp Gate
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.stroke();
  // Green slot
  ctx.strokeStyle = '#00e676';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 20, -0.4, 0.4);
  ctx.stroke();
  // Starship
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.closePath();
  ctx.fill();
}

function drawSolarSailRiderArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const bgGrad = ctx.createLinearGradient(x, y, x + w, y);
  bgGrad.addColorStop(0, '#f39c12');
  bgGrad.addColorStop(1, '#0e0b12');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.55;
  const cy = y + h * 0.5;
  // Diamond sail
  ctx.fillStyle = 'rgba(0, 229, 255, 0.75)';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 18);
  ctx.lineTo(cx + 12, cy);
  ctx.lineTo(cx - 6, cy + 18);
  ctx.lineTo(cx - 10, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPlanetaryRoverArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#2d140e';
  ctx.fillRect(x, y, w, h);
  // Red ground
  ctx.fillStyle = '#7b3a2c';
  ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
  const cx = x + w * 0.5;
  const cy = y + h * 0.65;
  // Rover
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(cx - 12, cy - 10, 24, 12);
  // Wheels
  ctx.fillStyle = '#2c3e50';
  ctx.beginPath();
  ctx.arc(cx - 8, cy + 4, 4, 0, Math.PI * 2);
  ctx.arc(cx, cy + 4, 4, 0, Math.PI * 2);
  ctx.arc(cx + 8, cy + 4, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPulsarSignalArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#070b14';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Radar circle
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.stroke();
  // Dish needle
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 16, cy - 14);
  ctx.stroke();
  // Pulsar star
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(cx + 16, cy - 14, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawAsteroidCatcherArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  // Gantry
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(cx - 16, y + 8, 32, 10);
  // Harpoon Cable
  ctx.strokeStyle = '#bdc3c7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, y + 18);
  ctx.lineTo(cx - 8, y + h * 0.65);
  ctx.stroke();
  // Gold Asteroid
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(cx - 8, y + h * 0.65, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawAlienAbductionArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  // Tractor beam
  ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(cx, y + 24);
  ctx.lineTo(cx + 18, y + h * 0.85);
  ctx.lineTo(cx - 18, y + h * 0.85);
  ctx.closePath();
  ctx.fill();
  // UFO Saucer
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.ellipse(cx, y + 20, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cow
  ctx.fillStyle = '#ecf0f1';
  ctx.fillRect(cx - 6, y + h * 0.6, 12, 8);
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
  ctx.fillStyle = '#0b0c16';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Center Sun
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  // Swarm ring
  ctx.strokeStyle = 'rgba(236, 240, 241, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.stroke();
  // Collector Drone
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(cx + 18, cy - 3, 6, 6);
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
  ctx.fillStyle = '#231812';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Conveyor Belt
  ctx.fillStyle = '#100c09';
  ctx.fillRect(x, cy + 8, w, 10);
  // Brass Toy Automaton
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(cx - 8, cy - 8, 16, 16);
  // Windup key
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy - 14, 4, 0, Math.PI * 2);
  ctx.stroke();
  // Hydraulic Press Head
  ctx.fillStyle = '#cd7f32';
  ctx.fillRect(cx - 12, cy - 26, 24, 8);
}

function drawPneumaticTubeRushArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#12161b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Brass Tube
  ctx.fillStyle = 'rgba(212, 175, 55, 0.2)';
  ctx.fillRect(x, cy - 8, w, 16);
  ctx.strokeStyle = '#cd7f32';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, cy - 8, w, 16);
  // Gold Capsule
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.roundRect(cx - 12, cy - 5, 24, 10, 4);
  ctx.fill();
  ctx.fillStyle = '#111111';
  ctx.fillRect(cx - 10, cy - 5, 2, 10);
  ctx.fillRect(cx + 8, cy - 5, 2, 10);
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
  ctx.fillStyle = '#1c100c';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Copper Pipe
  ctx.strokeStyle = '#b87333';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, y + 6);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + 16, cy);
  ctx.lineTo(cx + 16, y + h - 6);
  ctx.stroke();
  // Molten Copper Droplet
  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 4, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillStyle = '#100a1c';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Neon Katana Slash Arc
  ctx.strokeStyle = '#ff007f';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#ff007f';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 22, -Math.PI * 0.3, Math.PI * 0.4);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Samurai Helmet Silhouette
  ctx.fillStyle = '#00ffff';
  ctx.fillRect(cx - 8, cy - 8, 16, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 5, cy - 4, 10, 3);
}

function drawMainframeBreachArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#060a17';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Core
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();
  // ICE Ring with gap
  ctx.strokeStyle = '#d500f9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0.4, Math.PI * 1.8);
  ctx.stroke();
  // Incoming data packet
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(cx + 20, cy - 12, 3, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillStyle = '#1e082b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Glowing Purple Crystal Ball
  const ballGrad = ctx.createRadialGradient(cx - 3, cy - 5, 2, cx, cy, 14);
  ballGrad.addColorStop(0, '#ffffff');
  ballGrad.addColorStop(0.4, '#a855f7');
  ballGrad.addColorStop(1, '#3b0764');
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  // Star Rune
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★', cx, cy + 4);
}

function drawVineSwingCanopyArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Hanging Vine
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 16, y);
  ctx.quadraticCurveTo(cx - 10, cy, cx + 12, cy + 10);
  ctx.stroke();
  // Golden Banana Cluster
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx + 12, cy + 10, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrexEggScrambleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Nest Straw
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Golden Dino Egg
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, 6, 9, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Slit T-Rex Eye at top
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 14, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.fillRect(cx - 1.5, cy - 18, 3, 8);
}

function drawPiranhaRiverHopArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Drifting Log
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.roundRect(cx - 16, cy + 6, 32, 10, 5);
  ctx.fill();
  // Leaping Red Piranha
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8, 9, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // White sharp teeth
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx + 6, cy - 10);
  ctx.lineTo(cx + 10, cy - 8);
  ctx.lineTo(cx + 6, cy - 6);
  ctx.closePath();
  ctx.fill();
}

function drawPterodactylGlideArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Golden Air Ring
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx + 12, cy - 4, 6, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Pterosaur Wings Silhouette
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy + 4);
  ctx.lineTo(cx - 4, cy - 10);
  ctx.lineTo(cx + 4, cy + 2);
  ctx.lineTo(cx + 8, cy - 6);
  ctx.lineTo(cx - 4, cy);
  ctx.closePath();
  ctx.fill();
}

function drawQuicksandEscapeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#451a03';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Quicksand Mud Line
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x, cy + 2, w, h * 0.5);
  // Overhead Yellow Rope
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx, cy - 2);
  ctx.stroke();
  // Rescue loop
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBlowpipeTargetArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Aztec Sun Target
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(cx, cy - 6, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, cy - 6, 6, 0, Math.PI * 2);
  ctx.fill();
  // Bamboo Blowpipe angled
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy + 16);
  ctx.lineTo(cx + 4, cy + 4);
  ctx.stroke();
}

function drawAmberFossilExcavateArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Chiseled Rock Block
  ctx.fillStyle = '#44403c';
  ctx.fillRect(cx - 14, cy - 14, 28, 28);
  // Glowing Golden Amber Gem
  ctx.fillStyle = '#f59e0b';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 8, 10, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawRaptorPounceDodgeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#022c22';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Red Attack Trajectory Line
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 4);
  ctx.lineTo(x + w - 4, y + h - 4);
  ctx.stroke();
  ctx.setLineDash([]);
  // Sickle Claw
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy);
  ctx.quadraticCurveTo(cx + 4, cy + 8, cx + 8, cy - 2);
  ctx.stroke();
}

function drawBambooPoleVaultArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Chasm Gap
  ctx.fillStyle = '#020617';
  ctx.fillRect(cx - 10, cy + 6, 20, 20);
  // Arched Green Bamboo Pole
  ctx.strokeStyle = '#84cc16';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 8);
  ctx.quadraticCurveTo(cx - 6, cy - 16, cx + 10, cy - 8);
  ctx.stroke();
}

function drawVolcanoLavaLeapArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Basalt Pillar
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Fire Ruby
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawCaterpillarInchwormArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Wooden Twig
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x, cy + 6, w, 6);
  // Arched green inchworm
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy + 6);
  ctx.quadraticCurveTo(cx, cy - 12, cx + 14, cy + 6);
  ctx.stroke();
  // Cyan dewdrop
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(cx + 20, cy + 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawHoneybeeNectarRelayArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Flower Petals
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.arc(cx - 10, cy, 10, 0, Math.PI * 2);
  ctx.arc(cx + 10, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  // Honeybee
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 6, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Translucent Wings
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(cx - 2, cy - 12, 6, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpiderWebTangleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Web Strands
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy - 20);
  ctx.lineTo(cx + 20, cy + 20);
  ctx.moveTo(cx + 20, cy - 20);
  ctx.lineTo(cx - 20, cy + 20);
  ctx.stroke();
  ctx.strokeRect(cx - 12, cy - 12, 24, 24);
  // Red Spider
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawAntColonyHaulArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#451a03';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Underground tunnel curve
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x, cy - 4, w, 16);
  // Ant
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy + 4, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // White Sugar Cube
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx + 4, cy - 2, 8, 8);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx + 4, cy - 2, 8, 8);
}

function drawFireflyNightBeaconArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#020617';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Glowing Yellow Halo
  const glowGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
  glowGrad.addColorStop(0, '#ffffff');
  glowGrad.addColorStop(0.3, '#fef08a');
  glowGrad.addColorStop(0.7, '#f59e0b');
  glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  // Firefly core
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDungBeetleRollArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Large Textured Soil Ball
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(cx - 4, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Scarab Beetle
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(cx + 12, cy, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawLadybugAphidHuntArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#15803d';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Red Ladybug with black dots
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx - 4, cy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 3, 2, 0, Math.PI * 2);
  ctx.arc(cx - 4, cy + 3, 2, 0, Math.PI * 2);
  ctx.fill();
  // Tiny Lime Aphid
  ctx.fillStyle = '#a3e635';
  ctx.beginPath();
  ctx.arc(cx + 12, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrasshopperHighJumpArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Green Clover Pad
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(cx + 10, cy + 10, 8, 0, Math.PI * 2);
  ctx.fill();
  // Jumping Grasshopper
  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy - 4, 10, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Long Hind Legs
  ctx.strokeStyle = '#65a30d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx - 18, cy + 8);
  ctx.stroke();
}

function drawDragonflyDogfightArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Needle Abdomen
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 14);
  ctx.stroke();
  // Translucent Wings
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(cx - 10, cy - 4, 10, 3, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 10, cy - 4, 10, 3, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCentipedeSlalomArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#292524';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Red Slalom Gate Posts
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx - 14, cy, 4, 0, Math.PI * 2);
  ctx.arc(cx + 14, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  // S-curved Segmented Centipede
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.bezierCurveTo(cx - 8, cy - 6, cx + 8, cy + 6, cx, cy + 14);
  ctx.stroke();
}

function drawPoltergeistPossessionArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Glowing floating chair / possessed item
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(cx - 10, cy - 6, 20, 16);
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 6);
  ctx.lineTo(cx - 10, cy - 16);
  ctx.stroke();
  // Aura rings
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.4)';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.stroke();
}

function drawGraveyardZombieBashArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Tombstone
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(cx - 8, cy + 4, 10, Math.PI, 0);
  ctx.lineTo(cx + 2, cy + 16);
  ctx.lineTo(cx - 18, cy + 16);
  ctx.closePath();
  ctx.fill();
  // Green Zombie hand rising
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy + 16);
  ctx.lineTo(cx + 10, cy);
  ctx.lineTo(cx + 6, cy - 8);
  ctx.moveTo(cx + 10, cy);
  ctx.lineTo(cx + 14, cy - 8);
  ctx.stroke();
}

function drawPhantomMirrorGazeArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#172554';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Ornate Mirror Frame
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 14, cy - 18, 28, 36);
  // Translucent Phantom reflection inside
  ctx.fillStyle = 'rgba(147, 197, 253, 0.6)';
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 8, 0, Math.PI * 2);
  ctx.fill();
  // Glowing eyes
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx - 3, cy - 5, 2, 2);
  ctx.fillRect(cx + 1, cy - 5, 2, 2);
}

function drawCauldronWitchBrewArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#052e16';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Black Cauldron Pot
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(cx, cy + 6, 14, 0, Math.PI);
  ctx.fill();
  ctx.fillRect(cx - 16, cy + 4, 32, 4);
  // Bubbling lime brew
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(cx, cy + 4, 12, Math.PI, 0);
  ctx.fill();
  // Bubbles
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 6, 3, 0, Math.PI * 2);
  ctx.arc(cx + 6, cy - 10, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawGargoyleStoneStareArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#18181b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Stone gargoyle perched silhouette
  ctx.fillStyle = '#71717a';
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 10, 0, Math.PI * 2);
  ctx.fill();
  // Horns
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 8);
  ctx.lineTo(cx - 12, cy - 16);
  ctx.lineTo(cx - 4, cy - 10);
  ctx.moveTo(cx + 8, cy - 8);
  ctx.lineTo(cx + 12, cy - 16);
  ctx.lineTo(cx + 4, cy - 10);
  ctx.fill();
  // Glowing red eyes
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx - 4, cy - 4, 3, 2);
  ctx.fillRect(cx + 1, cy - 4, 3, 2);
}

function drawGhostVacuumBusterArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Ghost being sucked
  ctx.fillStyle = 'rgba(110, 231, 183, 0.7)';
  ctx.beginPath();
  ctx.arc(cx + 10, cy - 8, 8, 0, Math.PI * 2);
  ctx.fill();
  // Vacuum Suction Cone
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 10);
  ctx.lineTo(cx + 14, cy - 6);
  ctx.moveTo(cx - 12, cy + 10);
  ctx.lineTo(cx + 18, cy + 2);
  ctx.stroke();
  // Vacuum Nozzle
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(cx - 16, cy + 6, 8, 8);
}

function drawTombstoneCryptSliderArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Sarcophagus base
  ctx.fillStyle = '#0c0a09';
  ctx.fillRect(cx - 18, cy - 12, 36, 24);
  // Gold scarab inside
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx - 6, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  // Sliding stone lid (half-open)
  ctx.fillStyle = '#57534e';
  ctx.fillRect(cx + 2, cy - 12, 20, 24);
  ctx.strokeStyle = '#78716c';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx + 2, cy - 12, 20, 24);
}

function drawCreepyDollCrawlArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#271c19';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Winding brass key
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.arc(cx - 16, cy - 4, 4, 0, Math.PI * 2);
  ctx.stroke();
  // Doll Porcelain Head
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(cx + 6, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  // Button eye
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx + 4, cy - 2, 2, 0, Math.PI * 2);
  ctx.arc(cx + 8, cy - 2, 2, 0, Math.PI * 2);
  ctx.fill();
  // Rosy cheek
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(cx + 6, cy + 3, 3, 2);
}

function drawOuijaSpiritBoardArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#26160c';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Board border
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 20, cy - 15, 40, 30);
  // Curved alphabet arc
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy + 6, 16, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  // Glowing Planchette
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx + 8, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.closePath();
  ctx.fill();
  // Lens
  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawCursedClocktowerPendulumArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#18181b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Pendulum shaft
  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 20);
  ctx.lineTo(cx + 8, cy + 12);
  ctx.stroke();
  // Crescent scythe blade
  ctx.fillStyle = '#e4e4e7';
  ctx.beginPath();
  ctx.arc(cx + 8, cy + 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + 8, cy + 12, 14, 0, Math.PI * 0.8);
  ctx.stroke();
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
  ctx.fillStyle = '#05050a';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Green pixel invader
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(cx - 10, cy - 10, 20, 14);
  ctx.fillStyle = '#05050a';
  ctx.fillRect(cx - 6, cy - 6, 4, 4);
  ctx.fillRect(cx + 2, cy - 6, 4, 4);
  // Laser cannon at bottom
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(cx - 8, cy + 12, 16, 6);
  ctx.fillRect(cx - 2, cy + 8, 4, 4);
}

function drawVectorTankBattleArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#020b05';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Green wireframe tank
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 12, cy - 8, 24, 16);
  ctx.strokeRect(cx - 15, cy - 12, 30, 4);
  ctx.strokeRect(cx - 15, cy + 8, 30, 4);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 18, cy);
  ctx.stroke();
}

function drawPacMazeChompArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#030712';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Blue maze line
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 20, cy - 16, 40, 32);
  // Yellow Chomp Disc
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(cx - 6, cy, 10, 0.4, Math.PI * 2 - 0.4);
  ctx.lineTo(cx - 6, cy);
  ctx.closePath();
  ctx.fill();
  // Pellet
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(cx + 8, cy - 2, 4, 4);
}

function drawBreakoutBrickBlasterArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#020617';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Colored bricks
  const colors = ['#ef4444', '#f97316', '#22c55e', '#06b6d4'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(cx - 18 + i * 10, cy - 14, 8, 6);
  }
  // Ball
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + 2, cy - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  // Paddle
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(cx - 12, cy + 12, 24, 5);
}

function drawLaserDiscDanceArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#090514';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Shiny disc
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#090514';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  // Arrow flash
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx + 5, cy - 16);
  ctx.lineTo(cx - 5, cy - 16);
  ctx.closePath();
  ctx.fill();
}

function drawCrtScanlineSniperArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#06130b';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Crosshair
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.moveTo(cx - 18, cy);
  ctx.lineTo(cx + 18, cy);
  ctx.moveTo(cx, cy - 18);
  ctx.lineTo(cx, cy + 18);
  ctx.stroke();
  // Duck target in sights
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx + 2, cy - 2, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawCyberGridRunnerArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#05050f';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Neon Light Trail
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy + 12);
  ctx.lineTo(cx - 4, cy + 12);
  ctx.lineTo(cx - 4, cy - 10);
  ctx.lineTo(cx + 12, cy - 10);
  ctx.stroke();
  // Lightcycle
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(cx + 10, cy - 13, 8, 6);
}

function drawSynthDrumPadArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1e1e24';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // 4 pads
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(cx - 14, cy - 14, 12, 12);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(cx + 2, cy - 14, 12, 12);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(cx - 14, cy + 2, 12, 12);
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(cx + 2, cy + 2, 12, 12);
}

function drawMatrixCodeRainArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#020b05';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  // Green digital rain glyphs
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('1 0 X', cx, cy - 10);
  ctx.fillText('0 F 7', cx, cy);
  ctx.fillText('A 1 C', cx, cy + 10);
  // Gold key in stream
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx + 12, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Fallback Default
function drawDefaultArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 20px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ARCADE', x + w / 2, y + h / 2 + 7);
}


