import confetti from 'canvas-confetti';
import {
  PlayerId,
  PlayerConfig,
  PlayerType,
  GameState,
  MinigameId,
  MinigameMetadata,
  RoundResult,
  DevicePlatformMode
} from './Types';
import { InputRouter } from './InputRouter';
import { AudioEngine } from './AudioEngine';
import { ParticleSystem } from './ParticleSystem';
import { BaseGame } from '../games/BaseGame';
import { CyberTanksGame } from '../games/CyberTanksGame';
import { BumperHovercraftGame } from '../games/BumperHovercraftGame';
import { LaserGridReflexGame } from '../games/LaserGridReflexGame';
import { OrbitalSlingshotGame } from '../games/OrbitalSlingshotGame';
import { MicroTurboGPGame } from '../games/MicroTurboGPGame';
import { GhostFlashlightGame } from '../games/GhostFlashlightGame';
import { KitchenChaosGame } from '../games/KitchenChaosGame';
import { SkylineSumoGame } from '../games/SkylineSumoGame';
import { AnimalStackGame } from '../games/AnimalStackGame';
import { SumoIcebergGame } from '../games/SumoIcebergGame';
import { CannonBarrageGame } from '../games/CannonBarrageGame';
import { AnvilRainGame } from '../games/AnvilRainGame';
import { BombRelayGame } from '../games/BombRelayGame';
import { MicroHockeyGame } from '../games/MicroHockeyGame';
import { QuickDrawWesternGame } from '../games/QuickDrawWesternGame';
import { BalloonBurstGame } from '../games/BalloonBurstGame';
import { SwatFlyGame } from '../games/SwatFlyGame';
import { StopAtZeroGame } from '../games/StopAtZeroGame';
import { TurfWhackGame } from '../games/TurfWhackGame';
import { NeonLightcyclesGame } from '../games/NeonLightcyclesGame';
import { BladeParryGame } from '../games/BladeParryGame';
import { SafeDialGame } from '../games/SafeDialGame';
import { CoinApexGame } from '../games/CoinApexGame';
import { RedLightSentryGame } from '../games/RedLightSentryGame';
import { LaserLeapGame } from '../games/LaserLeapGame';
import { ColorClashGame } from '../games/ColorClashGame';
import { MeteorShieldGame } from '../games/MeteorShieldGame';
import { SequenceClashGame } from '../games/SequenceClashGame';
import { BubbleSoccerGame } from '../games/BubbleSoccerGame';
import { WireCutterGame } from '../games/WireCutterGame';
import { MagmaHopGame } from '../games/MagmaHopGame';
import { RhythmDuelGame } from '../games/RhythmDuelGame';
import { CosmicVortexGame } from '../games/CosmicVortexGame';
import { PixelPaintballGame } from '../games/PixelPaintballGame';
import { MinefieldDashGame } from '../games/MinefieldDashGame';
import { AsteroidMinerGame } from '../games/AsteroidMinerGame';
import { DontLookDownGame } from '../games/DontLookDownGame';
import { SnowballFightGame } from '../games/SnowballFightGame';
import { HighwayHopGame } from '../games/HighwayHopGame';
import { GoldMinerGame } from '../games/GoldMinerGame';
import { ChompFrogsGame } from '../games/ChompFrogsGame';
import { TugOfWarGame } from '../games/TugOfWarGame';
import { VolleySpikeGame } from '../games/VolleySpikeGame';
import { MazeEscapeGame } from '../games/MazeEscapeGame';
import { PinballBattleGame } from '../games/PinballBattleGame';
import { MolePanicGame } from '../games/MolePanicGame';
import { ColorFloodGame } from '../games/ColorFloodGame';
import { MemoryMatrixGame } from '../games/MemoryMatrixGame';
import { SnakeArenaGame } from '../games/SnakeArenaGame';
import { MirrorLaserGame } from '../games/MirrorLaserGame';
import { DominoCascadeGame } from '../games/DominoCascadeGame';
import { WaterBalloonBarrageGame } from '../games/WaterBalloonBarrageGame';
import { SheepDogCorralsGame } from '../games/SheepDogCorralsGame';
import { ChestSnatchGame } from '../games/ChestSnatchGame';
import { RapidDrop4Game } from '../games/RapidDrop4Game';
import { FloorPainterGame } from '../games/FloorPainterGame';
import { DodgeballBlitzGame } from '../games/DodgeballBlitzGame';
import { GravityGolfGame } from '../games/GravityGolfGame';
import { CyberDiscGame } from '../games/CyberDiscGame';
import { SumoSpheresGame } from '../games/SumoSpheresGame';
import { SkyGlidersGame } from '../games/SkyGlidersGame';
import { PixelCurlingGame } from '../games/PixelCurlingGame';
import { BumperBoatsGame } from '../games/BumperBoatsGame';
import { TargetSniperGame } from '../games/TargetSniperGame';
import { FruitChopperGame } from '../games/FruitChopperGame';
import { CatapultClashGame } from '../games/CatapultClashGame';
import { JoustingKnightsGame } from '../games/JoustingKnightsGame';
import { DragonTamerGame } from '../games/DragonTamerGame';
import { CastleArcherGame } from '../games/CastleArcherGame';
import { DrawbridgePanicGame } from '../games/DrawbridgePanicGame';
import { BlacksmithForgeGame } from '../games/BlacksmithForgeGame';
import { PotionAlchemistGame } from '../games/PotionAlchemistGame';
import { RoyalFeastGame } from '../games/RoyalFeastGame';
import { SwordInStoneGame } from '../games/SwordInStoneGame';
import { DungeonEscapeGame } from '../games/DungeonEscapeGame';
import { NeonDriftersGame } from '../games/NeonDriftersGame';
import { HoverboardRailGame } from '../games/HoverboardRailGame';
import { TrafficJamGame } from '../games/TrafficJamGame';
import { NitroKartGame } from '../games/NitroKartGame';
import { MonorailHijackGame } from '../games/MonorailHijackGame';
import { DroneDeliveryGame } from '../games/DroneDeliveryGame';
import { RocketSkatesGame } from '../games/RocketSkatesGame';
import { CyberDemolitionGame } from '../games/CyberDemolitionGame';
import { LaserSpeedwayGame } from '../games/LaserSpeedwayGame';
import { GravityPodsGame } from '../games/GravityPodsGame';
import { PancakeFlipperGame } from '../games/PancakeFlipperGame';
import { SushiExpressGame } from '../games/SushiExpressGame';
import { PizzaTossGame } from '../games/PizzaTossGame';
import { BurgerStackGame } from '../games/BurgerStackGame';
import { IceCreamScoopGame } from '../games/IceCreamScoopGame';
import { WokStirFryGame } from '../games/WokStirFryGame';
import { DonutGlazerGame } from '../games/DonutGlazerGame';
import { FruitBlenderGame } from '../games/FruitBlenderGame';
import { TeppanyakiCatchGame } from '../games/TeppanyakiCatchGame';
import { PopcornPopperGame } from '../games/PopcornPopperGame';
import { SubmarineTorpedoGame } from '../games/SubmarineTorpedoGame';
import { JellyfishJumpGame } from '../games/JellyfishJumpGame';
import { PearlDiversGame } from '../games/PearlDiversGame';
import { SharkBaitGame } from '../games/SharkBaitGame';
import { SunkenTreasureGame } from '../games/SunkenTreasureGame';
import { OctopusInkGame } from '../games/OctopusInkGame';
import { CrabWalkGame } from '../games/CrabWalkGame';
import { ElectricEelGame } from '../games/ElectricEelGame';
import { WaterScooterGame } from '../games/WaterScooterGame';
import { DeepSeaHarpoonGame } from '../games/DeepSeaHarpoonGame';
import { MoonLanderGame } from '../games/MoonLanderGame';
import { SpaceJunkSalvageGame } from '../games/SpaceJunkSalvageGame';
import { AlienProbeGame } from '../games/AlienProbeGame';
import { SolarFlareGame } from '../games/SolarFlareGame';
import { WormholeLeapGame } from '../games/WormholeLeapGame';
import { NebulaDriftGame } from '../games/NebulaDriftGame';
import { SatelliteLaserGame } from '../games/SatelliteLaserGame';
import { MarsRoverGame } from '../games/MarsRoverGame';
import { ZeroGTetherGame } from '../games/ZeroGTetherGame';
import { SaloonBrawlerGame } from '../games/SaloonBrawlerGame';
import { TrainHeistGame } from '../games/TrainHeistGame';
import { GoldPanningGame } from '../games/GoldPanningGame';
import { RodeoBullGame } from '../games/RodeoBullGame';
import { HorseshoeTossGame } from '../games/HorseshoeTossGame';
import { DynamiteTumbleGame } from '../games/DynamiteTumbleGame';
import { CactusSlalomGame } from '../games/CactusSlalomGame';
import { BanditChaseGame } from '../games/BanditChaseGame';
import { RattlesnakeReflexGame } from '../games/RattlesnakeReflexGame';
import { WesternPokerGame } from '../games/WesternPokerGame';
import { LaserTripwireGame } from '../games/LaserTripwireGame';
import { VaultSafeGame } from '../games/VaultSafeGame';
import { SecurityCameraGame } from '../games/SecurityCameraGame';
import { BriefcaseSnatchGame } from '../games/BriefcaseSnatchGame';
import { HackTerminalGame } from '../games/HackTerminalGame';
import { SmokeBombEscapeGame } from '../games/SmokeBombEscapeGame';
import { MicroWiretapGame } from '../games/MicroWiretapGame';
import { RooftopZiplineGame } from '../games/RooftopZiplineGame';
import { DroneInterceptGame } from '../games/DroneInterceptGame';
import { DisguiseShuffleGame } from '../games/DisguiseShuffleGame';
import { SynthwaveHighwayGame } from '../games/SynthwaveHighwayGame';
import { DrumSoloGame } from '../games/DrumSoloGame';
import { TurntableScratchGame } from '../games/TurntableScratchGame';
import { BassDropGame } from '../games/BassDropGame';
import { VocalPitchGame } from '../games/VocalPitchGame';
import { BreakdanceBattleGame } from '../games/BreakdanceBattleGame';
import { NeonMetronomeGame } from '../games/NeonMetronomeGame';
import { EqualizerBounceGame } from '../games/EqualizerBounceGame';
import { RetroChiptuneGame } from '../games/RetroChiptuneGame';
import { DiscoTileGame } from '../games/DiscoTileGame';
import { FunhouseMirrorsGame } from '../games/FunhouseMirrorsGame';
import { TestStrengthGame } from '../games/TestStrengthGame';
import { HauntedMansionGame } from '../games/HauntedMansionGame';
import { FireworksFinaleGame } from '../games/FireworksFinaleGame';
import { HydraSlayerGame } from '../games/HydraSlayerGame';
import { PharaohTombGame } from '../games/PharaohTombGame';
import { SpartanShieldGame } from '../games/SpartanShieldGame';
import { KrakenWhirlpoolGame } from '../games/KrakenWhirlpoolGame';
import { IcarusWingsGame } from '../games/IcarusWingsGame';
import { MinotaurLabyrinthGame } from '../games/MinotaurLabyrinthGame';
import { OlympusLightningGame } from '../games/OlympusLightningGame';
import { AnubisScalesGame } from '../games/AnubisScalesGame';
import { GorgonGazeGame } from '../games/GorgonGazeGame';
import { VikingLongshipGame } from '../games/VikingLongshipGame';
import { AntimatterContainmentGame } from '../games/AntimatterContainmentGame';
import { WarpGateJumpGame } from '../games/WarpGateJumpGame';
import { SolarSailRiderGame } from '../games/SolarSailRiderGame';
import { PlanetaryRoverGame } from '../games/PlanetaryRoverGame';
import { PulsarSignalGame } from '../games/PulsarSignalGame';
import { AsteroidCatcherGame } from '../games/AsteroidCatcherGame';
import { AlienAbductionGame } from '../games/AlienAbductionGame';
import { SpaceElevatorGame } from '../games/SpaceElevatorGame';
import { OrbitalDropPodGame } from '../games/OrbitalDropPodGame';
import { DysonSphereCollectorGame } from '../games/DysonSphereCollectorGame';
import { PenguinSlideGame } from '../games/PenguinSlideGame';
import { IcebergBreakerGame } from '../games/IcebergBreakerGame';
import { BlizzardBeaconGame } from '../games/BlizzardBeaconGame';
import { WalrusBaskGame } from '../games/WalrusBaskGame';
import { PolarIceFishingGame } from '../games/PolarIceFishingGame';
import { AuroraCollectorGame } from '../games/AuroraCollectorGame';
import { DogSledDashGame } from '../games/DogSledDashGame';
import { MammothStampedeGame } from '../games/MammothStampedeGame';
import { FrostbiteCavernGame } from '../games/FrostbiteCavernGame';
import { GeyserLeapGame } from '../games/GeyserLeapGame';
import { ClockworkCogsGame } from '../games/ClockworkCogsGame';
import { SteamBoilerReliefGame } from '../games/SteamBoilerReliefGame';
import { ZeppelinDogfightGame } from '../games/ZeppelinDogfightGame';
import { TeslaCoilArcGame } from '../games/TeslaCoilArcGame';
import { AutomatorAssemblyGame } from '../games/AutomatorAssemblyGame';
import { PneumaticTubeRushGame } from '../games/PneumaticTubeRushGame';
import { OrnithopterFlockGame } from '../games/OrnithopterFlockGame';
import { PressureGaugeLockGame } from '../games/PressureGaugeLockGame';
import { CopperConduitGame } from '../games/CopperConduitGame';
import { MonocycleDerbyGame } from '../games/MonocycleDerbyGame';
import { CyberSamuraiSlashGame } from '../games/CyberSamuraiSlashGame';
import { MainframeBreachGame } from '../games/MainframeBreachGame';
import { HovercarSkylineGame } from '../games/HovercarSkylineGame';
import { HologramGlitchGame } from '../games/HologramGlitchGame';
import { LaserGrappleGame } from '../games/LaserGrappleGame';
import { NeuralSynapseGame } from '../games/NeuralSynapseGame';
import { DroneSwarmDefenseGame } from '../games/DroneSwarmDefenseGame';
import { SynthKeytarSoloGame } from '../games/SynthKeytarSoloGame';
import { QuantumTunnelingGame } from '../games/QuantumTunnelingGame';
import { HyperloopRacerGame } from '../games/HyperloopRacerGame';
import { RingTossFrenzyGame } from '../games/RingTossFrenzyGame';
import { BalloonDartClownGame } from '../games/BalloonDartClownGame';
import { DuckPondDerbyGame } from '../games/DuckPondDerbyGame';
import { MilkBottleKnockdownGame } from '../games/MilkBottleKnockdownGame';
import { BumperCarDerbyGame } from '../games/BumperCarDerbyGame';
import { CottonCandySpinGame } from '../games/CottonCandySpinGame';
import { RollerCoasterBrakeGame } from '../games/RollerCoasterBrakeGame';
import { FerrisWheelHopGame } from '../games/FerrisWheelHopGame';
import { DunkClownTankGame } from '../games/DunkClownTankGame';
import { FortuneTellerTarotGame } from '../games/FortuneTellerTarotGame';
import { VineSwingCanopyGame } from '../games/VineSwingCanopyGame';
import { TrexEggScrambleGame } from '../games/TrexEggScrambleGame';
import { PiranhaRiverHopGame } from '../games/PiranhaRiverHopGame';
import { PterodactylGlideGame } from '../games/PterodactylGlideGame';
import { QuicksandEscapeGame } from '../games/QuicksandEscapeGame';
import { BlowpipeTargetGame } from '../games/BlowpipeTargetGame';
import { AmberFossilExcavateGame } from '../games/AmberFossilExcavateGame';
import { RaptorPounceDodgeGame } from '../games/RaptorPounceDodgeGame';
import { BambooPoleVaultGame } from '../games/BambooPoleVaultGame';
import { VolcanoLavaLeapGame } from '../games/VolcanoLavaLeapGame';
import { CaterpillarInchwormGame } from '../games/CaterpillarInchwormGame';
import { HoneybeeNectarRelayGame } from '../games/HoneybeeNectarRelayGame';
import { SpiderWebTangleGame } from '../games/SpiderWebTangleGame';
import { AntColonyHaulGame } from '../games/AntColonyHaulGame';
import { FireflyNightBeaconGame } from '../games/FireflyNightBeaconGame';
import { DungBeetleRollGame } from '../games/DungBeetleRollGame';
import { LadybugAphidHuntGame } from '../games/LadybugAphidHuntGame';
import { GrasshopperHighJumpGame } from '../games/GrasshopperHighJumpGame';
import { DragonflyDogfightGame } from '../games/DragonflyDogfightGame';
import { CentipedeSlalomGame } from '../games/CentipedeSlalomGame';
import { PoltergeistPossessionGame } from '../games/PoltergeistPossessionGame';
import { GraveyardZombieBashGame } from '../games/GraveyardZombieBashGame';
import { PhantomMirrorGazeGame } from '../games/PhantomMirrorGazeGame';
import { CauldronWitchBrewGame } from '../games/CauldronWitchBrewGame';
import { GargoyleStoneStareGame } from '../games/GargoyleStoneStareGame';
import { GhostVacuumBusterGame } from '../games/GhostVacuumBusterGame';
import { TombstoneCryptSliderGame } from '../games/TombstoneCryptSliderGame';
import { CreepyDollCrawlGame } from '../games/CreepyDollCrawlGame';
import { OuijaSpiritBoardGame } from '../games/OuijaSpiritBoardGame';
import { CursedClocktowerPendulumGame } from '../games/CursedClocktowerPendulumGame';
import { SynthwaveNeonRacerGame } from '../games/SynthwaveNeonRacerGame';
import { PixelSpaceInvaderGame } from '../games/PixelSpaceInvaderGame';
import { PacMazeChompGame } from '../games/PacMazeChompGame';
import { BreakoutBrickBlasterGame } from '../games/BreakoutBrickBlasterGame';
import { LaserDiscDanceGame } from '../games/LaserDiscDanceGame';
import { CrtScanlineSniperGame } from '../games/CrtScanlineSniperGame';
import { CyberGridRunnerGame } from '../games/CyberGridRunnerGame';
import { SynthDrumPadGame } from '../games/SynthDrumPadGame';
import { MatrixCodeRainGame } from '../games/MatrixCodeRainGame';
import { SharksAndMinnowsGame } from '../games/SharksAndMinnowsGame';
import { PowerPathClashGame } from '../games/PowerPathClashGame';
import { LandscapeArtilleryGame } from '../games/LandscapeArtilleryGame';
import { SpamClickShowdownGame } from '../games/SpamClickShowdownGame';
import { SumoLodeRunnerGame, SUMO_LODE_LEVELS, SUMO_LODE_TUTORIAL_LEVEL } from '../games/SumoLodeRunnerGame';
import { ThumbWarWrestleGame } from '../games/ThumbWarWrestleGame';
import { SwipeNinjaBlitzGame } from '../games/SwipeNinjaBlitzGame';
import { getGamePhoneMode, getPhoneModeBadge } from './PhoneCatalogConfig';
import { renderGameThumbnailArt } from './GameThumbnails';
import { drawCharacter } from './CharacterRenderer';
import {
  EconomyManager,
  SKIN_CATALOG,
  ARENA_CATALOG,
  BOOSTER_CATALOG,
  PACK_CATALOG,
  PackResult
} from './EconomyManager';
import { AchievementManager, ACHIEVEMENTS } from './AchievementManager';
import { CloudPersistenceManager, CatalogSortMode } from './CloudPersistenceManager';
import { WasmPhysicsEngine } from './WasmPhysicsEngine';

export const GAME_CATALOG: MinigameMetadata[] = [
  {
    id: 'sumo_lode_runner',
    title: 'Sumo Lode Runner',
    tagline: '40-Stage Dohyō Gold Heist & Trap Puzzle',
    category: 'Action',
    icon: '[G-261]',
    instructions: 'Collect all Golden Chanko chests across 40 classic & modern Dohyō stages to unlock the Escape Ladder! Dig diagonal clay pits [Space / Q / E] to trap Oni-Sumo guards and walk across their heads.',
    controlPrompt: 'Move/Climb: WASD / Arrows • Dig: Space / Q / E • Stage: [ / ]'
  },
  {
    id: 'tanks',
    title: 'Cyber Tanks 2.0',
    tagline: 'Ricochet Arena Duel',
    category: 'Action',
    icon: '[G-01]',
    instructions: 'Best of 3 Match! The battlefield is packed with tactical obstacles. Cannon shells have a 1.2s reload recharge. Hold to rotate; release to drive; tap to fire bouncing shells!',
    controlPrompt: 'Hold: Rotate | Release: Drive | Tap: Fire (1.2s Recharge)'
  },
  {
    id: 'hovercraft',
    title: 'Neon Bumper Derby',
    tagline: 'Pinball Demolition Arena',
    category: 'Action',
    icon: '[G-02]',
    instructions: 'Smash into rival bumper cars! Slam opponents into electric perimeter rails and center pinball bumpers to deplete their shields. Grab battery sparks to recharge!',
    controlPrompt: 'WASD / Arrows: Steer & Drive | Space / Tap: Turbo Boost | Grippy Tires'
  },
  {
    id: 'laser_grid',
    title: 'Laser Grid Reflex',
    tagline: 'Tile Overcharge Dodge',
    category: 'Reflex',
    icon: '[G-03]',
    instructions: 'Watch telegraphed tile flashes! Tap to dash around the grid; hold to reverse direction. Grab golden overcharge batteries!',
    controlPrompt: 'Tap: Dash Step | Hold: Reverse Direction'
  },
  {
    id: 'orbital',
    title: 'Orbital Slingshot',
    tagline: 'Meteor Miner Physics',
    category: 'Physics',
    icon: '[G-04]',
    instructions: 'Hold [W] (or [↑] / Space) to tether to nearby planets; release to launch into a gravitational slingshot arc. You cannot move or steer without a planet! Mine space crystals and avoid the singularity.',
    controlPrompt: 'Hold [W] / [↑]: Tether Orbit | Release: Slingshot Arc'
  },
  {
    id: 'micro_gp',
    title: 'Micro Turbo GP',
    tagline: 'Single-Button Drift Racer',
    category: 'Racing',
    icon: '[G-05]',
    instructions: 'Hold button to power-drift around curves and charge multi-tier Nitro! Release to blast off with explosive Nitro Speed and straighten out. Track walls and auto-rescue prevent getting stuck in loops.',
    controlPrompt: 'Hold: Drift & Charge Nitro | Release: Unleash Nitro Blast'
  },
  {
    id: 'ghost_flashlight',
    title: 'Ghost Flashlight',
    tagline: 'Darkness Tag & Stealth',
    category: 'Action',
    icon: '[G-06]',
    instructions: 'Survive the haunted mansion! Aim your flashlight at the Ghost to reveal and slow them down. Hold Action / Space for the Ultra-Beam! If tagged, you become the Ghost—hunt survivors to pass the curse!',
    controlPrompt: 'Move: Direct / WASD / Stick | Hold Action: Ultra-Beam | Least Ghost Time Wins'
  },
  {
    id: 'kitchen_chaos',
    title: 'Kitchen Chaos',
    tagline: 'High-Speed Food Fling',
    category: 'Party',
    icon: '[G-07]',
    instructions: 'Hold to charge fling launcher, release to toss food ingredients onto center rotating plates. Spicy peppers trigger 2X Fever Mode!',
    controlPrompt: 'Hold: Charge Throw | Release: Fling Food'
  },
  {
    id: 'skyline_sumo',
    title: 'Skyline Sumo',
    tagline: 'Springboard Platform Climber',
    category: 'Action',
    icon: '[G-08]',
    instructions: 'Hold to charge jump spring and oscillating aim angle; release to leap upwards! Bop opponents on the head to stun them.',
    controlPrompt: 'Hold: Charge Jump & Aim | Release: Spring Leap'
  },
  {
    id: 'animal_stack',
    title: 'Animal Stack',
    tagline: 'Sky Crane Animal Stacker',
    category: 'Physics',
    icon: '[G-09]',
    instructions: 'Overhead crane swings animals across the sky. Rotate and drop uniquely shaped animals onto the sturdy moored raft to build the ultimate towering animal stack!',
    controlPrompt: 'Space / Tap: Drop | W / S / ↑ / ↓ / R: Rotate | A / D / ← / →: Steer'
  },
  {
    id: 'sumo_iceberg',
    title: 'Sumo Iceberg',
    tagline: 'Dynamic Tilting Disc',
    category: 'Physics',
    icon: '[G-10]',
    instructions: 'Dynamic ice disc tilts with player weights and melts over time! Sprint multiple times with tactical recharges to ram opponents off the slippery edges.',
    controlPrompt: 'Tap / Space: Sprint Tackle (3 Charges) | Steer: Ice Drift'
  },
  {
    id: 'cannon_barrage',
    title: 'Cannon Barrage',
    tagline: 'Destructible Fortress Duel',
    category: 'Action',
    icon: '[G-13]',
    instructions: 'Demolish the 2 outer guard bastions to bring down the enemy fortress shield! Only the main tower can fire, and it can only be damaged once both outer towers fall.',
    controlPrompt: 'Tap: Fire Cannonball'
  },
  {
    id: 'anvil_rain',
    title: 'Anvil Rain',
    tagline: 'Shadow Dodging Survival',
    category: 'Reflex',
    icon: '[G-14]',
    instructions: 'Giant, golden & iron anvils plummet from the sky! Tap / Space to dash and body-check rivals under falling shadows. Protect your Hard Hat!',
    controlPrompt: 'Steer: Run | Tap / Space: Dash & Body-Check'
  },
  {
    id: 'bomb_relay',
    title: 'Bomb Relay',
    tagline: 'Hot Potato Explosive Tag',
    category: 'Action',
    icon: '[G-18]',
    instructions: 'A ticking time-bomb is lit! Tap to sprint and tackle opponents to pass the bomb. When the fuse runs out, BOOM!',
    controlPrompt: 'Tap/Hold: Dash & Tag'
  },
  {
    id: 'micro_hockey',
    title: 'Micro Hockey',
    tagline: '4-Way Circular Air Table',
    category: 'Action',
    icon: '[G-12]',
    instructions: 'Guard your goal arch on the circular air hockey table! Hold to swing your paddle along the rim and deflect the puck into opponent goals.',
    controlPrompt: 'Hold: Defend & Slap Puck'
  },
  {
    id: 'quick_draw',
    title: 'Quick Draw Western',
    tagline: 'High Noon Millisecond Duel',
    category: 'Reflex',
    icon: '[G-19]',
    instructions: 'Wait for the tense countdown... when "DRAW!" flashes, tap instantly! Misfiring early will foul your gun.',
    controlPrompt: 'Tap on DRAW!: Fire Gun'
  },
  {
    id: 'balloon_burst',
    title: 'Balloon Burst',
    tagline: 'Pressure Inflation Showdown',
    category: 'Party',
    icon: '[G-20]',
    instructions: 'Hold your pump valve to inflate your balloon for score. If you pump past maximum capacity, it POPs and loses points!',
    controlPrompt: 'Hold: Pump Air | Release: Bank Score'
  },
  {
    id: 'swat_fly',
    title: 'Swat the Fly',
    tagline: 'Picnic Pest Buster',
    category: 'Reflex',
    icon: '[G-21]',
    instructions: 'Flies buzz across the checkered tablecloth! Move your flyswatter across the table and slam down on pests mid-flight or landed. Golden dragonflies give +3, but beware stinging wasps (-2)!',
    controlPrompt: 'WASD / Arrows to Move • Space / Enter to Swat'
  },
  {
    id: 'stop_at_zero',
    title: 'Stop at Zero',
    tagline: 'Blind Precision Stopwatch',
    category: 'Reflex',
    icon: '[G-24]',
    instructions: 'Countdown ticks from 5.000s; digits vanish at 3.000s! Tap your button closest to exactly 0.000s to win the round.',
    controlPrompt: 'Tap: Freeze Blind Clock'
  },
  {
    id: 'turf_whack',
    title: 'Turf Whack',
    tagline: 'Garden Mole Whacker',
    category: 'Party',
    icon: '[G-25]',
    instructions: 'Moles pop out of garden burrow holes! Tap to swing your wooden mallet. Gold moles give +2, but avoid TNT dynamite (-2)!',
    controlPrompt: 'Tap: Swing Mallet'
  },
  {
    id: 'neon_lightcycles',
    title: 'Neon Lightcycles',
    tagline: 'Cyber Grid Trail Duel',
    category: 'Racing',
    icon: '[G-29]',
    instructions: 'Drive at lightspeed leaving a solid neon light ribbon! Tap to turn 90° clockwise. Trap rivals into crashing into trails or borders.',
    controlPrompt: 'Tap: Turn 90° Clockwise'
  },
  {
    id: 'blade_parry',
    title: 'Blade Parry',
    tagline: 'Rock \'Em Sock \'Em Blade Bots',
    category: 'Action',
    icon: '[G-22]',
    instructions: 'Step into the boxing ring with spring-neck combat robots! Throw Left & Right blade punches and time your Blade Parry to guard-break your rival. Pop their head off for the Knockout!',
    controlPrompt: 'A / D / ← / →: Shuffle | W / ↑: Left Punch | S / ↓: Right Punch | Space / Enter: Parry'
  },
  {
    id: 'safe_dial',
    title: 'Safe Dial Lock',
    tagline: 'Bank Vault Lockpicker',
    category: 'Puzzle',
    icon: '[G-23]',
    instructions: 'Spinning dial needle sweeps across combinations! Tap when the needle enters the glowing green sector to crack a tumbler. Crack 3 to pop the vault!',
    controlPrompt: 'Tap: Lock Tumbler'
  },
  {
    id: 'coin_apex',
    title: 'Coin Apex',
    tagline: 'Zero-Velocity Catch',
    category: 'Reflex',
    icon: '[G-26]',
    instructions: 'Gold doubloons are catapulted skyward! Tap precisely when the coin reaches its highest zero-velocity apex point for +3 Perfect points.',
    controlPrompt: 'Tap: Catch at Apex'
  },
  {
    id: 'red_light_sentry',
    title: 'Red Light Sentry',
    tagline: 'Watchtower Stealth Dash',
    category: 'Party',
    icon: '[G-27]',
    instructions: 'Mechanical watchtower sentry scans the arena. Hold your corner button to sprint toward the trophy; release to freeze before the Red Light scans!',
    controlPrompt: 'Hold: Sprint | Release: Freeze'
  },
  {
    id: 'laser_leap',
    title: 'Laser Leap',
    tagline: 'Neon Laser Jump Rope',
    category: 'Reflex',
    icon: '[G-28]',
    instructions: 'A high-voltage rotating laser beam sweeps across the arena. Tap to leap over the beam right as it sweeps under your feet! Watch out for sudden direction reversals.',
    controlPrompt: 'Tap: Jump Over Laser Beam'
  },
  {
    id: 'color_clash',
    title: 'Color Clash',
    tagline: 'Turf Painter Duel',
    category: 'Action',
    icon: '[G-15]',
    instructions: 'Drive your paint roller rover across the arena grid to paint tiles in your color! Snatch golden Paint Bombs to blast a 3x3 territory burst. Most tiles wins!',
    controlPrompt: 'Steer: Paint Tiles | Seek Paint Bombs'
  },
  {
    id: 'meteor_shield',
    title: 'Meteor Shield',
    tagline: 'Planetary Core Defense',
    category: 'Physics',
    icon: '[G-17]',
    instructions: 'Meteors plummet toward your planetary core! Orbit your curved deflector shield to ricochet fiery meteors toward rival planets. Tap for kinetic boost.',
    controlPrompt: 'Steer: Orbit Shield | Tap: Kinetic Pulse'
  },
  {
    id: 'sequence_clash',
    title: 'Sequence Clash',
    tagline: 'Cyber Memory Duel',
    category: 'Puzzle',
    icon: '[G-30]',
    instructions: 'Holographic cyber pads illuminate in accelerating musical patterns. Memorize the sequence and repeat it step-by-step! First mistake eliminates.',
    controlPrompt: 'WASD / Arrows: Enter Sequence'
  },
  {
    id: 'bubble_soccer',
    title: 'Bubble Soccer',
    tagline: 'Inflatable Bumper Derby',
    category: 'Action',
    icon: '[G-31]',
    instructions: 'Bounce rivals across the turf in high-elasticity bubble suits! Ram into the giant soccer ball, deflect ricochets, and blast goals into the enemy net.',
    controlPrompt: 'Steer: Drive Suit | Tap: Turbo Dash'
  },
  {
    id: 'wire_cutter',
    title: 'Wire Cutter',
    tagline: 'Cyber Defusal Relay',
    category: 'Puzzle',
    icon: '[G-32]',
    instructions: 'Analyze fast-scrambling terminal diagnostics! Snip the wire that matches the color or inverted prompt before the cyber bomb detonates. Fastest clean cut scores!',
    controlPrompt: 'WASD / Arrows: Snip Red/Blue/Green/Yellow Wire'
  },
  {
    id: 'magma_hop',
    title: 'Magma Hop',
    tagline: 'Volcanic Basalt Survival',
    category: 'Reflex',
    icon: '[G-33]',
    instructions: 'Hop between sinking basalt stepping stones over a boiling sea of molten lava! Snatch floating fire crystals and dodge erupting magma geysers.',
    controlPrompt: 'Steer / Arrows / Tap: Leap To Adjacent Pillar'
  },
  {
    id: 'rhythm_duel',
    title: 'Rhythm Duel',
    tagline: 'Synthwave Neon Highway',
    category: 'Reflex',
    icon: '[G-34]',
    instructions: 'Hit incoming glowing notes right on the judgment line to sync with the 128 BPM electronic beat! Rack up combo streaks for massive score multipliers.',
    controlPrompt: 'Space / Enter / Primary Tap: Hit Note On Beat'
  },
  {
    id: 'cosmic_vortex',
    title: 'Cosmic Vortex',
    tagline: 'Gravitational Singularity Duel',
    category: 'Physics',
    icon: '[G-35]',
    instructions: 'Navigate the swirling accretion disk around a supermassive black hole! Tap thrusters to slingshot out of gravitational pull, pulse repulsor shields, and harvest antimatter orbs before crossing the event horizon.',
    controlPrompt: 'Hold: Fire Thrusters | Tap: Repulsor Pulse'
  },
  {
    id: 'pixel_paintball',
    title: 'Pixel Paintball',
    tagline: 'Ricochet Splat Arena',
    category: 'Action',
    icon: '[G-36]',
    instructions: 'Blast bouncing paint pellets around the arena! Splat rival suits, bust spinning neon piñatas, and control the splatter zone. Stun opponents with direct pellet headshots!',
    controlPrompt: 'Hold: Aim Cannon | Release: Fire Splat Pellet'
  },
  {
    id: 'minefield_dash',
    title: 'Minefield Dash',
    tagline: 'Proximity Rune Sprint',
    category: 'Puzzle',
    icon: '[G-37]',
    instructions: 'Sprint through a high-stakes cyber hex minefield! Observe proximity warning runes (1, 2, 3) to deduce concealed explosive triggers. Extract golden battery cores and survive the blast shockwaves!',
    controlPrompt: 'WASD / Arrows: Move • Space / Enter: Dash Sprint'
  },
  {
    id: 'asteroid_miner',
    title: 'Asteroid Miner',
    tagline: 'Zero-G Kinetic Salvage',
    category: 'Physics',
    icon: '[G-38]',
    instructions: 'Pilot zero-g mining tugboats equipped with rotary diamond drills! Shatter crystalline asteroids into glittering gems, vacuum up cargo, and deposit loot into your salvage depot. Steal cargo by ramming rivals or raiding their depot! Highest banked score when the 50s shift expires wins.',
    controlPrompt: 'A/D or Left/Right: Steer • Space/Enter or W/Up: Fire Thrusters'
  },
  {
    id: 'dont_look_down',
    title: "Don't Look Down",
    tagline: '90-Second Vertical Tower Rush',
    category: 'Physics',
    icon: '[G-39]',
    instructions: 'Ascend a perilous vertical tower! Jump across floating triangles, planetary spheres, crystal diamonds, and tech hexagons. Press Space/W or Enter/Up for instant zero-stall leaps and mid-air flutter jumps! Press 1-3 to switch map themes.',
    controlPrompt: 'A/D or Left/Right: Steer • Space/W or Enter/Up: Instant Leap & Air Jump • 1-3: Switch Map'
  },
  {
    id: 'snowball_fight',
    title: 'Snowball Fight',
    tagline: 'Artillery Snow Fort Duel',
    category: 'Action',
    icon: '[G-40]',
    instructions: 'Aim your sweeping arrow and hold your button to charge throw power. Release to fling snowballs in high ballistic arcs over snow fort walls and splat opponents!',
    controlPrompt: 'Hold: Charge Power | Release: Throw | A/D or Steer: Aim'
  },
  {
    id: 'highway_hop',
    title: 'Highway Hop',
    tagline: 'Procedural Crossy Freeway',
    category: 'Action',
    icon: '[G-41]',
    instructions: 'Hop across speeding highways, rushing river rapids on floating logs, and dangerous railway tracks with flashing signals! Reach the golden finish pasture to score big!',
    controlPrompt: 'Tap/Space: Hop Forward | Arrows/WASD: Steer & Jump'
  },
  {
    id: 'gold_miner',
    title: 'Gold Rush Miner',
    tagline: 'Underground Reel & Claw Winch',
    category: 'Physics',
    icon: '[G-42]',
    instructions: 'Watch your oscillating mechanical winch crane and tap to shoot your claw deep into underground caverns. Retrieve sparkling diamonds and heavy gold nuggets; beware explosive TNT!',
    controlPrompt: 'Tap / Down: Fire Winch Claw'
  },
  {
    id: 'chomp_frogs',
    title: 'Chomp Frogs',
    tagline: 'Lilypad Hop & Bug Chomp Arena',
    category: 'Action',
    icon: '[G-43]',
    instructions: 'Leap dynamically across floating lily pads and rippling pond waters! Tap to snap your lightning-fast tongue, devouring gnats, fireflies, golden beetles, and giant royal butterflies. Bump rivals into the water and avoid stinging wasps! 1-3 to switch ponds.',
    controlPrompt: 'Steer/WASD/Arrows: Aim & Hop | Space/Enter/Tap: Instant Chomp | 1-3: Switch Pond'
  },
  {
    id: 'tug_of_war',
    title: 'Tug of War',
    tagline: 'High-Voltage Rhythm Pit Heave',
    category: 'Action',
    icon: '[G-44]',
    instructions: 'Time your taps in the green sweet spot of your oscillating power meter to unleash powerful rope heaves! Pull opponents across the cliff edge into the bubbling hazard pit!',
    controlPrompt: 'Tap / Space: Rhythm Power Pull'
  },
  {
    id: 'volley_spike',
    title: 'Volley Spike',
    tagline: 'Beach Volley Smash Duel',
    category: 'Physics',
    icon: '[G-45]',
    instructions: 'Bump, set, and smash! Move left and right across the sand, time your jumps, and leap at apex to unleash flaming downward Power Spikes over the center net!',
    controlPrompt: 'A/D or Steer: Move | Tap/Space: Jump & Spike'
  },
  {
    id: 'maze_escape',
    title: 'Maze Escape',
    tagline: 'Labyrinth Relic Dash',
    category: 'Puzzle',
    icon: '[G-46]',
    instructions: 'Navigate a procedurally shifting labyrinth! Grab glowing gems and snatch the center Golden Relic while evading the roaming Minotaur Sentry. Drop freeze traps to halt rivals!',
    controlPrompt: 'Arrows/WASD: Move | Tap/Space: Drop Trap'
  },
  {
    id: 'pinball_battle',
    title: 'Pinball Battle',
    tagline: 'Multi-Flipper Defense Arena',
    category: 'Action',
    icon: '[G-47]',
    instructions: 'Guard your goal slot with responsive flipper paddles! Bank speeding pinballs off neon bumpers into rival goals, and survive multi-ball frenzy!',
    controlPrompt: 'Steer: Move Paddle | Tap/Hold Space: Fire Flippers'
  },
  {
    id: 'mole_panic',
    title: 'Mole Panic',
    tagline: 'Carnival Whack-A-Mole Stampede',
    category: 'Reflex',
    icon: '[G-48]',
    instructions: 'Slam your giant squeaky mallet down on emerging moles across 12 dirt burrows! Whack Golden King Moles and Prismatic Star Moles for mega points; beware explosive TNT moles!',
    controlPrompt: 'Steer / Move: Position Mallet | Tap/Space: Whack!'
  },
  {
    id: 'color_flood',
    title: 'Color Flood',
    tagline: 'Territory Capture Grid',
    category: 'Puzzle',
    icon: '[G-49]',
    instructions: 'Flood the arena with jewel colors! Tap button or steer to cycle available colors and absorb matching adjacent territory. Capture over 50% of the arena to dominate!',
    controlPrompt: 'Tap/Space: Flood Color | Steer: Pick Color'
  },
  {
    id: 'memory_matrix',
    title: 'Memory Matrix',
    tagline: 'Musical Reflex Sequence',
    category: 'Reflex',
    icon: '[G-50]',
    instructions: 'Memorize luminous musical tile patterns! When the rotating pointer points at your target pad, tap in sequence to chime without striking out!',
    controlPrompt: 'Tap/Space: Strike Pad | Sweep: Auto Pointer'
  },
  {
    id: 'snake_arena',
    title: 'Snake Arena',
    tagline: '4-Player Battle Royale',
    category: 'Action',
    icon: '[G-51]',
    instructions: 'Slither across neon grids, gobble power pellets to grow longer, and trap rivals into fatal collisions! Tapping executes sharp 90-degree tactical turns.',
    controlPrompt: 'Tap/Space: 90° Turn | Steer: Guide Direction'
  },
  {
    id: 'mirror_laser',
    title: 'Mirror Laser',
    tagline: 'Reflective Core Duel',
    category: 'Reflex',
    icon: '[G-52]',
    instructions: 'Central emitter core fires high-energy laser pulses! Tap to rotate your diagonal reflector mirror 45 degrees to deflect beams into rival base cores.',
    controlPrompt: 'Tap/Space: Rotate Mirror 45° | Deflect Beams'
  },
  {
    id: 'domino_cascade',
    title: 'Domino Cascade',
    tagline: 'Rhythmic Chain Topple',
    category: 'Reflex',
    icon: '[G-53]',
    instructions: 'Lay domino tiles in sync with the musical rhythm before the descending barrier drops! Trigger a spectacular cascading topple for bonus fireworks and chime bells.',
    controlPrompt: 'Tap/Space in Rhythm: Lay Tile | Topple Chain'
  },
  {
    id: 'water_balloon',
    title: 'Water Balloon Barrage',
    tagline: 'Backyard Artillery Duel',
    category: 'Action',
    icon: '[G-54]',
    instructions: 'Catapult wobbly water balloons over the central garden fence! Hold to oscillate trajectory angle and charge launch power; release to soak opponents!',
    controlPrompt: 'Hold: Angle & Power | Release: Launch Splash'
  },
  {
    id: 'sheep_dog',
    title: 'Sheep Dog Corrals',
    tagline: 'Meadow Herding Frenzy',
    category: 'Party',
    icon: '[G-55]',
    instructions: 'Guide energetic sheep dogs around the meadow! Hold button to sprint, and release to unleash an acoustic BARK shockwave that scatters sheep into your corner corral!',
    controlPrompt: 'Hold: Sprint | Release: Bark Shockwave'
  },
  {
    id: 'chest_snatch',
    title: 'Chest Snatch',
    tagline: 'Mimic Vault Jewel Heist',
    category: 'Reflex',
    icon: '[G-56]',
    instructions: 'Snatch sparkling rubies, emeralds, and diamonds from inside the giant mimic chest! Watch for the jaw chatter warning and pull your hand back before the razor teeth clamp shut!',
    controlPrompt: 'Hold: Reach In & Grab | Release: Pull Hand Back'
  },
  {
    id: 'rapid_drop4',
    title: 'Rapid Drop 4',
    tagline: 'Real-Time 4-in-a-Row',
    category: 'Puzzle',
    icon: '[G-57]',
    instructions: 'No turn waiting! Slide across columns and drop heavy tokens in real-time gravity duels. Connect 4 tokens in any direction for laser celebrations!',
    controlPrompt: 'Steer: Choose Column | Tap/Space: Drop Token'
  },
  {
    id: 'floor_painter',
    title: 'Floor Painter',
    tagline: 'Roller Skate Turf War',
    category: 'Action',
    icon: '[G-58]',
    instructions: 'Glide across the arena on roller skates leaving behind thick coats of your player paint! Steal opponent turf, snag golden mega-rollers, and bump rivals!',
    controlPrompt: 'Hold: Steer & Drift | Bump Rivals: Steal Paint'
  },
  {
    id: 'dodgeball_blitz',
    title: 'Dodgeball Blitz',
    tagline: 'Gymnasium Ball Elimination',
    category: 'Action',
    icon: '[G-59]',
    instructions: 'Evade red rubber dodgeballs bouncing across the hardwood gym! Scoop up loose balls, aim across the division line, and throw with Space. Catch incoming balls to stun rivals!',
    controlPrompt: 'WASD / Arrows: Run | Space / Enter: Throw or Catch'
  },
  {
    id: 'gravity_golf',
    title: 'Gravity Golf',
    tagline: 'Celestial Orbital Mini-Golf',
    category: 'Physics',
    icon: '[G-60]',
    instructions: 'Tee off across celestial planetary bodies! Steer to aim your launch trajectory and hold Space to charge stroke power. Slingshot around gravity wells into the cosmic wormhole cup!',
    controlPrompt: 'Steer: Aim Angle | Hold Space: Charge Power'
  },
  {
    id: 'cyber_disc',
    title: 'Cyber Disc',
    tagline: 'Tron Energy Disc Duel',
    category: 'Action',
    icon: '[G-61]',
    instructions: 'Deflect the high-speed energized disc across the cyber grid velodrome! Hold defensive shields to power-reflect incoming discs past opponent goal lines.',
    controlPrompt: 'WASD / Arrows: Skim | Space / Enter: Energy Shield'
  },
  {
    id: 'sumo_spheres',
    title: 'Sumo Spheres',
    tagline: 'Tilting Gyro Platform Derby',
    category: 'Physics',
    icon: '[G-62]',
    instructions: 'Roll heavy motorized gyro-spheres on an elevating, tilting platform over the abyss! Tap turbo boost to ram rivals over the edge while keeping the arena balanced.',
    controlPrompt: 'WASD / Arrows: Roll | Space / Enter: Turbo Ram'
  },
  {
    id: 'sky_gliders',
    title: 'Sky Gliders',
    tagline: 'Paper Airplane Canyon Flight',
    category: 'Action',
    icon: '[G-63]',
    instructions: 'Pilot paper delta-wing gliders through sunset mountain canyons! Pull pitch to climb or dive for speed, catch golden thermal updraft rings, and nail the runway bullseye!',
    controlPrompt: 'Throttle Up/Down: Pitch Climb/Dive | Steer: Bank Left/Right'
  },
  {
    id: 'pixel_curling',
    title: 'Pixel Curling',
    tagline: 'Olympic Friction Ice Clash',
    category: 'Sports',
    icon: '[G-65]',
    instructions: 'Launch 44-pound polished granite curling stones down the ice sheet! Steer your curl trajectory, charge launch force, and rapidly sweep your broom to melt ice friction towards the button!',
    controlPrompt: 'Steer: Aim Curl | Hold Space: Launch | Tap Space: Sweep'
  },
  {
    id: 'bumper_boats',
    title: 'Bumper Boats',
    tagline: 'Splash Lagoon Water Derby',
    category: 'Action',
    icon: '[G-66]',
    instructions: 'Steer motorized inflatable bumper boats through tropical water canals! Blast rivals with high-pressure water cannons and bounce them into the swirling central whirlpool!',
    controlPrompt: 'Steer: Rudder | Throttle: Propeller | Space: Water Cannon'
  },
  {
    id: 'target_sniper',
    title: 'Target Sniper',
    tagline: 'Carnival Shooting Gallery',
    category: 'Reflex',
    icon: '[G-67]',
    instructions: 'Take aim at moving ducks, clay targets, and spinning stars across the 3-tier carnival gallery! Chain consecutive bulls-eyes for 4x score multipliers and avoid pirate skull hazards!',
    controlPrompt: 'WASD / Arrows: Aim Reticle | Space / Enter: Fire Shot'
  },
  {
    id: 'fruit_chopper',
    title: 'Fruit Chopper',
    tagline: 'Airborne Katana Dojo Slice',
    category: 'Reflex',
    icon: '[G-68]',
    instructions: 'Airborne watermelons, pineapples, oranges, and strawberries are tossed across the dojo! Slice airborne fruits into juicy halves with your katana, chain combos, and dodge black bombs!',
    controlPrompt: 'WASD / Arrows: Move Blade | Space / Enter: Katana Slice'
  },
  {
    id: 'catapult_clash',
    title: 'Catapult Clash',
    tagline: 'Destructible Castle Siege',
    category: 'Physics',
    icon: '[G-67]',
    instructions: 'Launch boulders at rival stone battlements! Adjust elevation & power trajectory to crush enemy ramparts before yours are pulverized.',
    controlPrompt: 'Hold: Power / Arc | Release: Catapult Fire'
  },
  {
    id: 'jousting_knights',
    title: 'Jousting Knights',
    tagline: 'Galloping Steed Tilt Clash',
    category: 'Action',
    icon: '[G-68]',
    instructions: 'Gallop down the medieval tilt rail at breakneck speed! Time your lance elevation to splinter the opponent’s wooden shield and unhorse them.',
    controlPrompt: 'Hold / Drag: Aim Lance | Tap: Charge & Couched Strike'
  },
  {
    id: 'dragon_tamer',
    title: 'Dragon Tamer',
    tagline: 'Fire Drake Corral Panic',
    category: 'Party',
    icon: '[G-69]',
    instructions: 'Sound your acoustic dinner horn to herd fiery baby drakes into your corner stables! Avoid wild tail whips and capture the rare Golden Wyrmling for 3x points!',
    controlPrompt: 'WASD / Move: Guide Tamer | Tap / Space: Sound Horn'
  },
  {
    id: 'castle_archer',
    title: 'Castle Archer',
    tagline: 'Parapet Volley Defense',
    category: 'Reflex',
    icon: '[G-70]',
    instructions: 'Snipe advancing goblin battering rams and shield-bearers with ballistic longbow arrows from high castle ramparts! Chain headshots for fire arrows!',
    controlPrompt: 'WASD / Arrows: Aim Arc | Space / Tap: Release Bowstring'
  },
  {
    id: 'drawbridge_panic',
    title: 'Drawbridge Panic',
    tagline: 'Moat Drop Gatekeeper',
    category: 'Reflex',
    icon: '[G-71]',
    instructions: 'Guard the castle gateway! Lower the drawbridge to grant safe passage to royal gold wagons, and raise it instantly to plunge raiding barbarians into the alligator moat!',
    controlPrompt: 'Hold: Lower Bridge | Release: Raise Gate'
  },
  {
    id: 'blacksmith_forge',
    title: 'Blacksmith Forge',
    tagline: 'Rhythmic Anvil Blade Striking',
    category: 'Reflex',
    icon: '[G-72]',
    instructions: 'Strike while the iron is red hot! Time heavy hammer swings on the oscillating sweet-spot bar to forge legendary glowing broadswords with combo multipliers.',
    controlPrompt: 'Tap / Press: Anvil Hammer Strike'
  },
  {
    id: 'potion_alchemist',
    title: 'Potion Alchemist',
    tagline: 'Bubbling Cauldron Alchemy',
    category: 'Reflex',
    icon: '[G-73]',
    instructions: 'Match bubbling reagent formulas before cauldrons boil over! Time your tap on Dragon Root, Moon Lotus, and Emerald Moss to brew royal potions.',
    controlPrompt: 'Tap / Space: Add Active Reagent'
  },
  {
    id: 'royal_feast',
    title: 'Royal Feast',
    tagline: 'Banquet Platter Catcher',
    category: 'Party',
    icon: '[G-74]',
    instructions: 'Slide across the grand banquet hall with your golden platter! Catch falling roast turkeys, sweet pies, and goblets while evading rotten fish and poison cabbage!',
    controlPrompt: 'Move / Tap: Steer Platter / Reverse Direction'
  },
  {
    id: 'sword_in_stone',
    title: 'Sword in the Stone',
    tagline: 'Excalibur Pull Showdown',
    category: 'Reflex',
    icon: '[G-75]',
    instructions: 'Only the true High King can heave Excalibur from the ancient runestone! Time your rhythmic power tugs at the golden apex to draw the sacred blade.',
    controlPrompt: 'Tap / Press: Power Heave Tug'
  },
  {
    id: 'dungeon_escape',
    title: 'Dungeon Maze Runner',
    tagline: 'Pendulum Blade Citadel',
    category: 'Action',
    icon: '[G-76]',
    instructions: 'Navigate dangerous dungeon catacombs! Dash past oscillating pendulum axe blades and retracting floor spike traps to reach the golden portcullis exit.',
    controlPrompt: 'WASD / Move: Steer Runner | Tap: 90° Quick Turn'
  },
  {
    id: 'neon_drifters',
    title: 'Neon Drifters',
    tagline: 'Cyberpunk Drift Circuit',
    category: 'Racing',
    icon: '[G-77]',
    instructions: 'Drift through glowing cyber hairpin turns! Hold tight angles to build drift scores and boost ahead to conquer 3 high-speed laps.',
    controlPrompt: 'WASD / Move: Steer / Drift | Space / Gas: Accelerate'
  },
  {
    id: 'hoverboard_rail',
    title: 'Hoverboard Rail',
    tagline: 'Aero Skyline Rail Grind',
    category: 'Action',
    icon: '[G-78]',
    instructions: 'Grind along elevated magnetic sky-rails! Switch rails to snatch golden battery cells, and time ollie jumps over neon barricades.',
    controlPrompt: 'Up / Down: Switch Rails | Tap / Space: Ollie Jump'
  },
  {
    id: 'traffic_jam',
    title: 'Traffic Jam Fury',
    tagline: 'Cyber Highway Expressway',
    category: 'Racing',
    icon: '[G-79]',
    instructions: 'Weave through 5-lane cyber highway traffic at breakneck speeds! Score near-miss speed streaks and hold turbo to reach maximum distance.',
    controlPrompt: 'Left / Right: Switch Lanes | Hold: Turbo Throttle'
  },
  {
    id: 'nitro_kart',
    title: 'Nitro Kart Arena',
    tagline: 'Weaponized Derby Clash',
    category: 'Action',
    icon: '[G-80]',
    instructions: 'Derby combat in an energized arena! Grab mystery boxes to launch homing missiles and lay slippery oil slicks to spin out rivals.',
    controlPrompt: 'Steer: Drive Kart | Tap / Space: Launch Weapon'
  },
  {
    id: 'monorail_hijack',
    title: 'Monorail Hijack',
    tagline: 'Maglev Rooftop Heist',
    category: 'Action',
    icon: '[G-81]',
    instructions: 'Leap between speeding monorail car roofs! Snatch crypto bounty briefcases while ducking low under high-speed tunnel gantries.',
    controlPrompt: 'Left / Right: Run Roof | Up / Tap: Jump | Down: Duck'
  },
  {
    id: 'drone_delivery',
    title: 'Drone Delivery',
    tagline: 'Wind Tunnel Quadcopter',
    category: 'Physics',
    icon: '[G-82]',
    instructions: 'Pilot delivery quadcopters through gusting wind tunnels! Fetch cargo crates from the central depot and touch down on your colored landing pad.',
    controlPrompt: 'Steer: Tilt Drone | Hold: Rotor Lift'
  },
  {
    id: 'rocket_skates',
    title: 'Rocket Skates',
    tagline: 'Loop-de-Loop Velodrome',
    category: 'Racing',
    icon: '[G-83]',
    instructions: 'Nitro-boosted roller skates on a banked oval velodrome! Cut into tight inner turns and fire your rocket backpack for blistering laps.',
    controlPrompt: 'Steer: Inner/Outer Lane | Hold: Rocket Boost'
  },
  {
    id: 'cyber_demolition',
    title: 'Cyber Demolition',
    tagline: 'Monster Truck Wrecking Ball',
    category: 'Physics',
    icon: '[G-84]',
    instructions: 'Drive heavy monster trucks towing physics wrecking balls! Build pendulum momentum to smash scrap towers into valuable metallic debris.',
    controlPrompt: 'Steer & Drive: Swing Wrecking Ball'
  },
  {
    id: 'laser_speedway',
    title: 'Laser Speedway',
    tagline: 'Micro Slot-Car Overheat',
    category: 'Racing',
    icon: '[G-85]',
    instructions: 'Micro slot-cars on laser guide tracks! Hold throttle to accelerate down straights, but ease off in tight corners to avoid capacitor blowouts.',
    controlPrompt: 'Hold: Accelerate | Release: Coast & Cool Down'
  },
  {
    id: 'gravity_pods',
    title: 'Gravity Pods',
    tagline: 'Magnetic Pipeline Racer',
    category: 'Action',
    icon: '[G-86]',
    instructions: 'Glide around the 360° perimeter of a sub-orbital magnetic tube! Dodge plasma mines and snatch golden warp rings for turbo speeds.',
    controlPrompt: 'Steer: Rotate Around Tube | Tap: Nitro Surge'
  },
  {
    id: 'pancake_flipper',
    title: 'Pancake Flipper',
    tagline: 'Precision Pan Flipping',
    category: 'Reflex',
    icon: '[G-87]',
    instructions: 'Watch your pancake sizzle in the hot skillet! Wait for the golden sweet spot, then tap to flip. Catch it neatly on the plate without burning or undercooking.',
    controlPrompt: 'Tap / Space: Flip Pancake'
  },
  {
    id: 'sushi_express',
    title: 'Sushi Express',
    tagline: 'Conveyor Snatch Race',
    category: 'Reflex',
    icon: '[G-88]',
    instructions: 'A rapid conveyor belt carries fresh nigiri and maki rolls! Grab the target sushi requested at the top. Grabbing incorrect plates or wasabi traps costs points.',
    controlPrompt: 'Tap / Space: Snatch Plate'
  },
  {
    id: 'pizza_toss',
    title: 'Pizza Toss',
    tagline: 'Dough Spinning Rhythm',
    category: 'Reflex',
    icon: '[G-89]',
    instructions: 'Toss pizza dough high into the pizzeria air! Tap precisely when it descends into your chef hands to spin it wider. Drop it and you have to start fresh!',
    controlPrompt: 'Tap / Space: Catch & Toss Dough'
  },
  {
    id: 'burger_stack',
    title: 'Burger Stack',
    tagline: 'Falling Patty Balance',
    category: 'Action',
    icon: '[G-90]',
    instructions: 'Patties, cheese, lettuce, and onions rain from above! Steer your burger plate left and right to build a towering gourmet stack before topping with a sesame bun.',
    controlPrompt: 'Steer: Move Plate Left / Right'
  },
  {
    id: 'ice_cream_scoop',
    title: 'Ice Cream Scoop',
    tagline: 'Wobbly Cone Stacker',
    category: 'Action',
    icon: '[G-91]',
    instructions: 'Delicious gelato scoops drop from the ceiling dispensers! Slide your waffle cone underneath to balance a towering ice cream masterpiece without toppling.',
    controlPrompt: 'Steer: Move Cone Left / Right'
  },
  {
    id: 'wok_stir_fry',
    title: 'Wok Stir Fry',
    tagline: 'Flaming Toss Timing',
    category: 'Reflex',
    icon: '[G-92]',
    instructions: 'Toss noodles and veggies over blazing flames! Keep ingredients airborne to sear them evenly. Keep heat under control to avoid burning your wok.',
    controlPrompt: 'Tap / Space: Toss Wok'
  },
  {
    id: 'donut_glazer',
    title: 'Donut Glazer',
    tagline: 'Glaze Conveyor Drop',
    category: 'Reflex',
    icon: '[G-93]',
    instructions: 'Hot golden donuts cruise on an assembly belt. Tap to trigger the glaze dispenser nozzle right as each donut passes directly underneath for perfection!',
    controlPrompt: 'Tap / Space: Dispense Glaze'
  },
  {
    id: 'fruit_blender',
    title: 'Fruit Blender',
    tagline: 'Smoothie Slicing Frenzy',
    category: 'Action',
    icon: '[G-94]',
    instructions: 'Whole pineapples, watermelons, and berries drop into the giant glass blender! Tap blade pulse to chop them into smoothie nectar while avoiding ice bombs.',
    controlPrompt: 'Tap / Space: Pulse Blender Blades'
  },
  {
    id: 'teppanyaki_catch',
    title: 'Teppanyaki Catch',
    tagline: 'Sizzling Shrimp Catch',
    category: 'Action',
    icon: '[G-95]',
    instructions: 'The hibachi chef flings sizzling tiger shrimp across the table! Slide your ceramic bowl across the grill to catch every succulent bite.',
    controlPrompt: 'Steer: Slide Bowl Across Griddle'
  },
  {
    id: 'popcorn_popper',
    title: 'Popcorn Popper',
    tagline: 'Cinema Kernel Catch',
    category: 'Action',
    icon: '[G-96]',
    instructions: 'Kernels heat and burst high from the theater popper! Tap when kernels pop into the air to snag them into your bucket before they burn on the bottom.',
    controlPrompt: 'Tap / Space: Snag Popped Kernels'
  },
  {
    id: 'submarine_torpedo',
    title: 'Submarine Torpedo',
    tagline: 'Deep Trench Sonar Duel',
    category: 'Action',
    icon: '[G-97]',
    instructions: 'Pilot submarines through murky ocean trenches! Fire torpedoes that rebound off rock pillars. Deplete rival hull integrity before sonar expires.',
    controlPrompt: 'Steer: Navigate Trench | Tap / Space: Launch Torpedo'
  },
  {
    id: 'jellyfish_jump',
    title: 'Jellyfish Jump',
    tagline: 'Abyss Bioluminescent Ascent',
    category: 'Action',
    icon: '[G-98]',
    instructions: 'Ascend a vertical oceanic trench by bouncing atop glowing jellyfish bell domes! Steer left and right to land on floating bells and achieve maximum altitude.',
    controlPrompt: 'Steer: Move Diver Left / Right'
  },
  {
    id: 'pearl_divers',
    title: 'Pearl Divers',
    tagline: 'Deep Reef Clam Snatch',
    category: 'Reflex',
    icon: '[G-99]',
    instructions: 'Free-dive toward the seabed where giant clams open! Tap to plunge down and pluck glowing pearls before the shell snaps shut on your fingers.',
    controlPrompt: 'Tap / Space: Plunge Dive'
  },
  {
    id: 'shark_bait',
    title: 'Shark Bait',
    tagline: 'Feeding Frenzy Lagoon',
    category: 'Action',
    icon: '[G-100]',
    instructions: 'Steer inflatable rescue rafts through predator-infested waters! Collect red lifebuoys to score while evading circling great white shark fins.',
    controlPrompt: 'Steer: Navigate Raft'
  },
  {
    id: 'sunken_treasure',
    title: 'Sunken Treasure',
    tagline: 'Galleon Winch Crane',
    category: 'Reflex',
    icon: '[G-101]',
    instructions: 'Lower salvage winch hooks over a sunken pirate shipwreck! Time your drop to haul up gold doubloon chests and silver ingots while avoiding spiked sea urchins.',
    controlPrompt: 'Tap / Space: Drop Winch Hook'
  },
  {
    id: 'octopus_ink',
    title: 'Octopus Ink',
    tagline: 'Kraken Whirlpool Vortex',
    category: 'Action',
    icon: '[G-102]',
    instructions: 'Ride the swirling currents of a kraken whirlpool! Dodge giant sweeping tentacles and blinding ink clouds while collecting glowing plankton canisters.',
    controlPrompt: 'Steer: Orbit / Radial | Tap / Space: Turbo Thrust'
  },
  {
    id: 'crab_walk',
    title: 'Crab Walk',
    tagline: 'Lateral Beach Scuttle',
    category: 'Action',
    icon: '[G-103]',
    instructions: 'Scuttle left and right along the sandy beach tide line! Catch falling seashells and starfish with your claws while dodging heavy falling coconuts.',
    controlPrompt: 'Steer: Scuttle Left / Right'
  },
  {
    id: 'electric_eel',
    title: 'Electric Eel',
    tagline: 'Cavern High-Voltage Slalom',
    category: 'Action',
    icon: '[G-104]',
    instructions: 'Navigate tight underwater cavern circuits! Time your passage through electric eel pylon gates when the high-voltage arcs cycle off to avoid paralysis.',
    controlPrompt: 'Steer: Pilot Submersible'
  },
  {
    id: 'water_scooter',
    title: 'Water Scooter',
    tagline: 'Jet-Ski Slalom Sprint',
    category: 'Racing',
    icon: '[G-105]',
    instructions: 'High-speed jet-ski slalom through floating maritime buoys! Carve tight turns around green and red channel markers to build maximum lap speed.',
    controlPrompt: 'Steer: Carve Turns | Hold: Accelerate'
  },
  {
    id: 'deep_sea_harpoon',
    title: 'Deep Sea Harpoon',
    tagline: 'Midnight Trench Sniping',
    category: 'Reflex',
    icon: '[G-106]',
    instructions: 'Rotate your flashlight-mounted harpoon turret in the pitch-black abyss! Snipe luminous anglerfish, neon squids, and the legendary golden nautilus.',
    controlPrompt: 'Tap / Space: Fire Harpoon'
  },
  {
    id: 'moon_lander',
    title: 'Moon Lander',
    tagline: 'Lunar Crater Touchdown',
    category: 'Physics',
    icon: '[G-107]',
    instructions: 'Control thrusters and tilt angle for safe touchdown on lunar landing pads! Soft landings earn score multipliers. Avoid hard surface crashes.',
    controlPrompt: 'Steer: Tilt Lander | Hold: Fire Thrusters'
  },
  {
    id: 'space_junk_salvage',
    title: 'Space Junk Salvage',
    tagline: 'Orbital Debris Tractor',
    category: 'Action',
    icon: '[G-108]',
    instructions: 'Fire magnetic tractor beams to pull orbital scrap into your cargo bay! Return scrap to the recycling depot while dodging communication satellites.',
    controlPrompt: 'Steer: Pilot Tug | Action: Magnetic Tractor Beam'
  },
  {
    id: 'alien_probe',
    title: 'Alien Probe',
    tagline: 'Mothership Core Recon',
    category: 'Action',
    icon: '[G-109]',
    instructions: 'Pilot scout saucers through alien defense grids! Collect transmission crystals and activate stealth cloaking to pass through sweeping laser beams.',
    controlPrompt: 'Steer: Fly Saucer | Action: Stealth Cloaking'
  },
  {
    id: 'solar_flare',
    title: 'Solar Flare',
    tagline: 'Coronal Wave Glider',
    category: 'Action',
    icon: '[G-110]',
    instructions: 'Unfurl your diamond solar sail to ride high-speed coronal plasma winds! Watch your temperature gauge and furl sails during peak flares to avoid burning.',
    controlPrompt: 'Steer: Navigate | Action / Up: Unfurl Solar Sail'
  },
  {
    id: 'wormhole_leap',
    title: 'Wormhole Leap',
    tagline: 'Quantum Portal Chaining',
    category: 'Action',
    icon: '[G-111]',
    instructions: 'Fly into paired color-coded singularity wormholes to warp across sectors! Collect quantum crystals and build portal combo streaks.',
    controlPrompt: 'Steer: Navigate | Action: Quantum Warp Burst'
  },
  {
    id: 'nebula_drift',
    title: 'Nebula Drift',
    tagline: 'Cosmic Dust Circuit',
    category: 'Racing',
    icon: '[G-113]',
    instructions: 'Zero-drag inertial drifting race through cosmic nebula dust clouds! Pass through waypoint rings and unleash turbo nitro boosts.',
    controlPrompt: 'Steer: Drift Craft | Action: Turbo Nitro Boost'
  },
  {
    id: 'satellite_laser',
    title: 'Satellite Laser',
    tagline: 'Solar Reflector Grid',
    category: 'Puzzle',
    icon: '[G-114]',
    instructions: 'Position satellite mirrors to reflect high-power solar laser beams directly into your home base receiver capacitor!',
    controlPrompt: 'Steer: Position Satellite | Action: Rotate Mirror'
  },
  {
    id: 'mars_rover',
    title: 'Mars Rover',
    tagline: 'Red Planet Sample Drill',
    category: 'Action',
    icon: '[G-115]',
    instructions: 'Drive 6-wheel rovers across Martian dunes! Drill precious soil samples and deliver them back to the habitat rocket while dodging dust devils.',
    controlPrompt: 'Steer: Drive Rover | Action: Deploy Soil Drill'
  },
  {
    id: 'zero_g_tether',
    title: 'Zero-G Tether',
    tagline: 'Orbital Spacewalk Duels',
    category: 'Physics',
    icon: '[G-116]',
    instructions: 'Reel in elastic quantum cables to slingshot around station anchor pylons! Snatch drifting cargo capsules in zero gravity.',
    controlPrompt: 'Steer: Thrusters | Action: Reel / Latch Tether'
  },
  {
    id: 'saloon_brawler',
    title: 'Saloon Brawler',
    tagline: 'Mug Slide & Barstool Duck',
    category: 'Action',
    icon: '[G-117]',
    instructions: 'Slide foamy beer mugs down the mahogany counter to thirsty outlaws! Hold to duck flying barstools and shattered bottles.',
    controlPrompt: 'Tap: Slide Mug | Hold: Duck Counter'
  },
  {
    id: 'train_heist',
    title: 'Train Heist',
    tagline: 'Locomotive Rooftop Dash',
    category: 'Action',
    icon: '[G-118]',
    instructions: 'Sprint atop runaway train cars! Tap to jump chimney gaps and hold to duck under water tower beams while snagging gold loot sacks.',
    controlPrompt: 'Tap: Jump Gap | Hold: Duck Low'
  },
  {
    id: 'gold_panning',
    title: 'Gold Panning',
    tagline: 'Resonant River Silt Swirl',
    category: 'Puzzle',
    icon: '[G-119]',
    instructions: 'Swirl river silt at resonance frequency to wash away mud! Once shiny gold nuggets drift into the center ring, tap to scoop!',
    controlPrompt: 'Hold: Swirl Pan | Tap: Scoop Center Nugget'
  },
  {
    id: 'rodeo_bull',
    title: 'Rodeo Bull',
    tagline: 'Mechanical Bronco Balance',
    category: 'Physics',
    icon: '[G-120]',
    instructions: 'Hang on tight! Counter-lean against unpredictable mechanical bucking kicks. Stay in the green balance sweet spot to survive.',
    controlPrompt: 'Tap / Hold: Counter-Lean Balance'
  },
  {
    id: 'horseshoe_toss',
    title: 'Horseshoe Toss',
    tagline: 'Iron Stake Ringers',
    category: 'Sports',
    icon: '[G-121]',
    instructions: 'Tap to lock pitch angle, then tap again to gauge throw power! Ring iron stakes for 10 points or score 5 for leaners.',
    controlPrompt: 'Tap 1: Lock Aim | Tap 2: Pitch Power'
  },
  {
    id: 'dynamite_tumble',
    title: 'Dynamite Tumble',
    tagline: 'TNT Sizzle Boot',
    category: 'Action',
    icon: '[G-122]',
    instructions: 'Sizzling sticks of dynamite tumble toward your bunker! Tap when TNT enters your perimeter to boot it toward rivals before the fuse blows.',
    controlPrompt: 'Tap: Kick Dynamite Away'
  },
  {
    id: 'cactus_slalom',
    title: 'Cactus Slalom',
    tagline: 'Desert Gallop Weave',
    category: 'Racing',
    icon: '[G-123]',
    instructions: 'Gallop at top speed across desert canyons! Tap to switch slalom direction, weaving around prickly saguaro cacti and snatching horseshoes.',
    controlPrompt: 'Tap: Slalom Turn'
  },
  {
    id: 'bandit_chase',
    title: 'Bandit Chase',
    tagline: 'Stagecoach Quadrant Defense',
    category: 'Action',
    icon: '[G-124]',
    instructions: 'Outlaws on horseback are ambushing the stagecoach! Time your sweeping reticle and tap to blast bandits before they plunder cargo.',
    controlPrompt: 'Tap: Fire Shotgun Blast'
  },
  {
    id: 'rattlesnake_reflex',
    title: 'Rattlesnake Reflex',
    tagline: 'High-Noon Snake Strike Duel',
    category: 'Reflex',
    icon: '[G-125]',
    instructions: 'Listen to the ominous rattle buildup! Tap the instant the snake lunges to snatch golden eggs. False starts get bitten!',
    controlPrompt: 'Wait for Strike... Tap Instant!'
  },
  {
    id: 'western_poker',
    title: 'Western Poker Showdown',
    tagline: 'Rapid Card River Draft',
    category: 'Party',
    icon: '[G-126]',
    instructions: 'Cards slide down the saloon river! Tap to draft high-value cards and form pairs, three of a kind, or flushes for maximum points.',
    controlPrompt: 'Tap: Draft Card in River'
  },
  {
    id: 'laser_tripwire',
    title: 'Laser Tripwire',
    tagline: 'Vault Corridor Infiltration',
    category: 'Reflex',
    icon: '[G-127]',
    instructions: 'Contort and crawl beneath oscillating security lasers! Hold to crawl, tap to jump, and snatch classified intel.',
    controlPrompt: 'Tap: Jump | Hold: Crawl Low'
  },
  {
    id: 'vault_safe',
    title: 'Vault Safe Stethoscope',
    tagline: 'Titanium Combination Crack',
    category: 'Puzzle',
    icon: '[G-128]',
    instructions: 'Listen to the mechanical click resonance! Tap when the combination dial passes the high-frequency gate to pop all 3 tumblers.',
    controlPrompt: 'Tap: Lock Tumbler Gate'
  },
  {
    id: 'security_camera',
    title: 'Security Camera Freeze',
    tagline: 'CCTV Vision Cone Sneak',
    category: 'Action',
    icon: '[G-129]',
    instructions: 'Sweeping CCTV cameras scan the museum! Hold to advance forward, but freeze completely still when the red spotlight sweeps overhead.',
    controlPrompt: 'Hold: Sneak | Release: Freeze Still'
  },
  {
    id: 'briefcase_snatch',
    title: 'Briefcase Snatch',
    tagline: 'Subway Station Turnstile Dash',
    category: 'Action',
    icon: '[G-130]',
    instructions: 'Grab classified briefcases and dash through open subway turnstiles to bank points! Tag rivals to steal their briefcase.',
    controlPrompt: 'Hold: Turn / Steer'
  },
  {
    id: 'hack_terminal',
    title: 'Hack The Terminal',
    tagline: 'Cyber Mainframe ICE Decrypt',
    category: 'Puzzle',
    icon: '[G-131]',
    instructions: 'Match the target hexadecimal cipher code as packets scroll! Tap when your cursor aligns with the key node before ICE locks you out.',
    controlPrompt: 'Tap: Decrypt Node'
  },
  {
    id: 'smoke_bomb_escape',
    title: 'Smoke Bomb Escape',
    tagline: 'Shipyard Searchlight Evasion',
    category: 'Action',
    icon: '[G-132]',
    instructions: 'Sneak past shipyard searchlights to reach the extraction chopper! Tap to deploy thick smoke canisters that block beam detection.',
    controlPrompt: 'Tap: Deploy Smoke Canister'
  },
  {
    id: 'micro_wiretap',
    title: 'Micro Wiretap',
    tagline: 'Silent Embassy Bug Plant',
    category: 'Reflex',
    icon: '[G-133]',
    instructions: 'Screw listening bugs under the ambassador desk! Tap only when the decibel needle is in the green silent zone.',
    controlPrompt: 'Tap in Green: Tighten Screw'
  },
  {
    id: 'rooftop_zipline',
    title: 'Rooftop Zipline',
    tagline: 'Skyscraper Antenna Glider',
    category: 'Racing',
    icon: '[G-134]',
    instructions: 'Zipline between skyscraper radio towers! Tap to switch between upper and lower cables, snagging data chips and dodging voltage sparks.',
    controlPrompt: 'Tap: Switch Cable Line'
  },
  {
    id: 'drone_intercept',
    title: 'Drone Intercept',
    tagline: 'EMP Surveillance Jammer',
    category: 'Action',
    icon: '[G-135]',
    instructions: 'Surveillance drones swarm overhead! Align your aiming reticle and tap to fire electromagnetic pulses to fry hostile drones.',
    controlPrompt: 'Tap: Discharge EMP Shockwave'
  },
  {
    id: 'disguise_shuffle',
    title: 'Disguise Shuffle',
    tagline: 'Masquerade Ball Double Agent',
    category: 'Party',
    icon: '[G-136]',
    instructions: 'Spot the rogue double agent wearing the Golden Mask in the masquerade ballroom! Tap when your spotlight sweeps over the agent.',
    controlPrompt: 'Tap: Unmask Rogue Agent'
  },
  {
    id: 'synthwave_highway',
    title: 'Synthwave Highway',
    tagline: 'Neon Outrun Drifter',
    category: 'Action',
    icon: '[G-137]',
    instructions: 'Cruise down an endless neon synthwave highway! Tap to shift lanes, avoiding grid roadblocks while collecting digital audio cassettes.',
    controlPrompt: 'Tap: Switch Lane'
  },
  {
    id: 'drum_solo',
    title: 'Drum Solo',
    tagline: 'Percussion Precision Clash',
    category: 'Party',
    icon: '[G-138]',
    instructions: 'Follow the pulsating drum fills! Tap exactly as the rhythmic strike marker aligns with the snare drum target.',
    controlPrompt: 'Tap: Strike Snare'
  },
  {
    id: 'turntable_scratch',
    title: 'Turntable Scratch',
    tagline: 'Vinyl DJ Beat Match',
    category: 'Party',
    icon: '[G-139]',
    instructions: 'Spin the vinyl platter! Tap to scratch back and forth right as the needle passes over beat cue zones.',
    controlPrompt: 'Tap: Scratch Record'
  },
  {
    id: 'bass_drop',
    title: 'Bass Drop',
    tagline: 'Subwoofer Soundwave Jump',
    category: 'Action',
    icon: '[G-140]',
    instructions: 'Giant subwoofers emit crushing low-frequency shockwaves! Tap to jump and hover above shockwave rings before they knock you off the stage.',
    controlPrompt: 'Tap: Shockwave Leap'
  },
  {
    id: 'vocal_pitch',
    title: 'Vocal Pitch',
    tagline: 'Autotune Frequency Lock',
    category: 'Party',
    icon: '[G-141]',
    instructions: 'A dynamic vocal melody curve scrolls across the screen. Tap to modulate your pitch frequency to stay inside the golden harmony window.',
    controlPrompt: 'Tap: Modulate Pitch'
  },
  {
    id: 'breakdance_battle',
    title: 'Breakdance Battle',
    tagline: 'Neon B-Boy Freeze Clash',
    category: 'Party',
    icon: '[G-142]',
    instructions: 'Show off your best power moves! Tap during the peak freeze window to score crowd hype points without wiping out.',
    controlPrompt: 'Tap: Freeze Pose'
  },
  {
    id: 'neon_metronome',
    title: 'Neon Metronome',
    tagline: 'Pendulum Tempo Match',
    category: 'Party',
    icon: '[G-143]',
    instructions: 'A glowing tempo needle swings across the arc. Tap precisely when the needle hits the center tick for maximum combo multipliers.',
    controlPrompt: 'Tap: Hit Downbeat'
  },
  {
    id: 'equalizer_bounce',
    title: 'Equalizer Bounce',
    tagline: 'Audio Spectrum Trampoline',
    category: 'Action',
    icon: '[G-144]',
    instructions: 'Ride the frequency bars of a booming audio equalizer! Tap to bounce from peak to peak as sound levels surge and crash.',
    controlPrompt: 'Tap: Surge Bounce'
  },
  {
    id: 'retro_chiptune',
    title: 'Retro Chiptune',
    tagline: '8-Bit Arpeggio Step Sequencer',
    category: 'Party',
    icon: '[G-145]',
    instructions: 'The 4-step sequencer sweeps rapidly across the synthesizer! Tap to trigger notes in time with the master lead melody.',
    controlPrompt: 'Tap: Trigger Step Note'
  },
  {
    id: 'disco_tile',
    title: 'Disco Tile',
    tagline: 'Neon Dance Floor Drop',
    category: 'Action',
    icon: '[G-146]',
    instructions: 'The disco dance floor flashes to the beat! Stand on the announced safe color before unlit tiles drop out beneath you.',
    controlPrompt: 'Tap: Rotate 90°'
  },
  {
    id: 'funhouse_mirrors',
    title: 'Funhouse Mirrors',
    tagline: 'Hall of Illusions Maze',
    category: 'Party',
    icon: '[G-152]',
    instructions: 'Navigate optical mirror reflections! Tap to turn and snatch golden prize tickets while dodging deceptive glass reflections.',
    controlPrompt: 'Tap: Turn 90°'
  },
  {
    id: 'test_strength',
    title: 'Test Your Strength',
    tagline: 'High-Striker Sledgehammer',
    category: 'Action',
    icon: '[G-154]',
    instructions: 'Swing the carnival sledgehammer with maximum torque! Time the surging power meter at 100% peak to shoot the puck and ring the brass bell.',
    controlPrompt: 'Tap: Slam Hammer'
  },
  {
    id: 'haunted_mansion',
    title: 'Haunted Mansion',
    tagline: 'UV Strobe Specter Hunt',
    category: 'Action',
    icon: '[G-155]',
    instructions: 'Ghosts materialize in the darkened Victorian parlor! Sweep your flashlight cone and tap to flash high-voltage UV strobe pulses.',
    controlPrompt: 'Tap: Fire UV Strobe'
  },
  {
    id: 'fireworks_finale',
    title: 'Fireworks Grand Finale',
    tagline: 'Pyrotechnic Sky Spectacular',
    category: 'Party',
    icon: '[G-156]',
    instructions: 'Launch rockets into the midnight sky! Tap right as fireworks reach their apex detonation rings to unleash brilliant starbursts.',
    controlPrompt: 'Tap: Detonate Apex'
  },
  {
    id: 'hydra_slayer',
    title: 'Hydra Swamp Slayer',
    tagline: 'Multi-Headed Mythic Duel',
    category: 'Action',
    icon: '[G-157]',
    instructions: 'The serpent Hydra lashes from the swamp! Tap on apex crunch zones to sever heads, and dodge corrosive venom spit.',
    controlPrompt: 'Tap: Blade Strike'
  },
  {
    id: 'pharaoh_tomb',
    title: 'Pharaoh Tomb Escape',
    tagline: 'Rolling Boulder & Spike Vault',
    category: 'Reflex',
    icon: '[G-158]',
    instructions: 'Outrun the massive rolling skull boulder! Tap to vault over sharp spike pits and snatch golden scarab idols.',
    controlPrompt: 'Tap: Vault Jump'
  },
  {
    id: 'spartan_shield',
    title: 'Spartan Phalanx Wall',
    tagline: 'Shield Wall & Spear Counter',
    category: 'Action',
    icon: '[G-159]',
    instructions: 'Persian fire arrows rain from above! Hold to raise your bronze Aspis shield, then release to thrust your spear at charging foes.',
    controlPrompt: 'Hold: Shield • Release: Spear'
  },
  {
    id: 'kraken_whirlpool',
    title: 'Kraken Maelstrom Vortex',
    tagline: 'Tentacle Dodge & Treasure Tacking',
    category: 'Reflex',
    icon: '[G-160]',
    instructions: 'Navigate the stormy vortex! Tap to tack your longship in and out to dodge crashing colossal tentacles and collect floating chests.',
    controlPrompt: 'Tap: Steer Rudder'
  },
  {
    id: 'icarus_wings',
    title: 'Flight of Icarus',
    tagline: 'Thermal Updrafts & Solar Blaze',
    category: 'Physics',
    icon: '[G-161]',
    instructions: 'Flap feathered wax wings to ride golden thermals! Avoid flying too close to the scorching sun or crashing into Aegean sea waves.',
    controlPrompt: 'Tap: Flap Wings'
  },
  {
    id: 'minotaur_labyrinth',
    title: 'Knossos Labyrinth',
    tagline: 'Ariadne Thread & Beast Escape',
    category: 'Puzzle',
    icon: '[G-162]',
    instructions: 'The fearsome Minotaur stalks the stone maze! Tap to switch corridors, grab Ariadne golden skeins, and trap the beast.',
    controlPrompt: 'Tap: Switch Corridor'
  },
  {
    id: 'olympus_lightning',
    title: 'Olympus Lightning Conduit',
    tagline: 'Divine Bolt Catch & Discharge',
    category: 'Reflex',
    icon: '[G-163]',
    instructions: 'Zeus hurls crackling thunderbolts from Mount Olympus! Tap precisely as bolts hit the gold sweet spot to channel divine fury.',
    controlPrompt: 'Tap: Catch Lightning'
  },
  {
    id: 'anubis_scales',
    title: 'Anubis Scales of Truth',
    tagline: 'Maat Feather Soul Balance',
    category: 'Puzzle',
    icon: '[G-164]',
    instructions: 'Stand trial in the Hall of Two Truths! Tap to drop soul offerings and balance your scale pan level with the Feather of Truth.',
    controlPrompt: 'Tap: Drop Offering'
  },
  {
    id: 'gorgon_gaze',
    title: 'Gorgon Mirror Deflection',
    tagline: 'Petrifying Gaze Mirror Counter',
    category: 'Action',
    icon: '[G-165]',
    instructions: 'Medusa emerges from dark stone ruins! Hold your polished bronze mirror shield right as her emerald eyes glow to reflect the deadly beam.',
    controlPrompt: 'Hold: Mirror Shield'
  },
  {
    id: 'viking_longship',
    title: 'Viking Fjord Raid',
    tagline: 'War Drum Cadence & Ice Ram',
    category: 'Racing',
    icon: '[G-166]',
    instructions: 'Strike the war drum in perfect rhythm! Catch the thumping beat for a Valhalla surge and ram clean through frozen icebergs.',
    controlPrompt: 'Tap: Drum Beat'
  },
  {
    id: 'antimatter_containment',
    title: 'Antimatter Containment',
    tagline: 'Magnetic Coils & Singularity Pulse',
    category: 'Reflex',
    icon: '[G-167]',
    instructions: 'Stabilize the fluctuating antimatter core! Tap when the fluctuating energy enters the green sweet zone to fire magnetic stabilization pulses.',
    controlPrompt: 'Tap: Magnetic Pulse'
  },
  {
    id: 'warp_gate_jump',
    title: 'Warp Gate Hyperdrive',
    tagline: 'Chromatic Gate Trajectory Alignment',
    category: 'Action',
    icon: '[G-168]',
    instructions: 'Approach lightspeed warp gates! Tap right when your trajectory alignment needle points directly through the rotating green gate opening.',
    controlPrompt: 'Tap: Warp Jump'
  },
  {
    id: 'solar_sail_rider',
    title: 'Solar Sail Corona Rider',
    tagline: 'Photon Gale & Ion Storm Tack',
    category: 'Racing',
    icon: '[G-169]',
    instructions: 'Ride the photon winds of a blazing star! Tap to deploy sails during golden solar flares, and furl sails to slip through purple ion storms.',
    controlPrompt: 'Tap: Deploy / Furl Sail'
  },
  {
    id: 'planetary_rover',
    title: 'Martian Planetary Rover',
    tagline: 'Low-Gravity Crater Hop',
    category: 'Physics',
    icon: '[G-170]',
    instructions: 'Traverse the craggy Martian surface! Tap to hop your 6-wheeled rover over deep impact craters and snag floating green xenocrystals.',
    controlPrompt: 'Tap: Low-G Hop'
  },
  {
    id: 'pulsar_signal',
    title: 'Pulsar Radio Signal',
    tagline: 'Frequency Lock & Cosmic Wave Sync',
    category: 'Reflex',
    icon: '[G-171]',
    instructions: 'Tune into the rotating neutron star! Tap as the radio telescope dish sweeps into direct alignment with the pulsar lighthouse beam.',
    controlPrompt: 'Tap: Lock Frequency'
  },
  {
    id: 'asteroid_catcher',
    title: 'Kuiper Asteroid Catcher',
    tagline: 'Magnetic Harpoon & Refinery Mining',
    category: 'Action',
    icon: '[G-172]',
    instructions: 'Fire the mining tractor harpoon! Time the swinging pendulum to spear rich gold and platinum asteroids while avoiding explosive red mines.',
    controlPrompt: 'Tap: Fire Harpoon'
  },
  {
    id: 'alien_abduction',
    title: 'UFO Alien Abduction',
    tagline: 'Tractor Beam Specimen Hoist',
    category: 'Party',
    icon: '[G-173]',
    instructions: 'Hover above nighttime farm pastures! Hold your tractor beam to hoist prized cows into your flying saucer, but beware of explosive dynamite tractors.',
    controlPrompt: 'Hold: Tractor Beam'
  },
  {
    id: 'space_elevator',
    title: 'Space Elevator Tether',
    tagline: 'Orbital Climber & Mag-Surge',
    category: 'Racing',
    icon: '[G-174]',
    instructions: 'Ascend the 36,000 km carbon nanotube tether! Tap at magnetic induction boost rings for acceleration surges, avoiding electrostatic lightning.',
    controlPrompt: 'Tap: Magnetic Surge'
  },
  {
    id: 'orbital_drop_pod',
    title: 'Orbital Drop Pod',
    tagline: 'Atmospheric Re-entry Burn',
    category: 'Physics',
    icon: '[G-175]',
    instructions: 'Plummet through the fiery atmospheric insertion! Tap retro-thrusters to cool your ablative heat shield within the green thermal threshold.',
    controlPrompt: 'Tap: Retro-Thruster'
  },
  {
    id: 'dyson_sphere_collector',
    title: 'Dyson Swarm Collector',
    tagline: 'Solar Flare Mega-Capacitor',
    category: 'Action',
    icon: '[G-176]',
    instructions: 'Orbit inside the Dyson megastructure! Hold to deploy solar collector panels and absorb plasma flares into your capacitor while dodging coronal spikes.',
    controlPrompt: 'Hold: Deploy Panels'
  },
  {
    id: 'penguin_slide',
    title: 'Penguin Glacier Slide',
    tagline: 'High-Speed Bobsled Slalom',
    category: 'Racing',
    icon: '[G-177]',
    instructions: 'Tuck and belly-slide down the glacier! Steer left/right to weave through slalom flags and boost over ice ramps while dodging jagged crevasses.',
    controlPrompt: 'Tap: Steer / Bank'
  },
  {
    id: 'iceberg_breaker',
    title: 'Icebreaker Ram',
    tagline: 'Arctic Pack Ice Demolition',
    category: 'Action',
    icon: '[G-178]',
    instructions: 'Pilot a heavy arctic icebreaker cutter! Hold to charge steam turbines and ram dense ice floes to harvest frozen core diamonds before rivals.',
    controlPrompt: 'Hold: Charge Ram'
  },
  {
    id: 'blizzard_beacon',
    title: 'Blizzard Lighthouse',
    tagline: 'Zero-Visibility Fog Guide',
    category: 'Puzzle',
    icon: '[G-179]',
    instructions: 'A blinding whiteout blizzard engulfs the coast! Align your rotating searchlight beacon to illuminate stranded expedition ships and guide them safely to port.',
    controlPrompt: 'Tap: Lock Beam Angle'
  },
  {
    id: 'walrus_bask',
    title: 'Walrus Iceberg King',
    tagline: 'Sumo Tusk King of the Hill',
    category: 'Physics',
    icon: '[G-180]',
    instructions: 'Bask on the prime sunlit iceberg! Belly-slam and nudge rival walruses into the freezing sea to claim sole ownership of the ice shelf.',
    controlPrompt: 'Hold: Belly Charge'
  },
  {
    id: 'polar_ice_fishing',
    title: 'Polar Ice Fishing',
    tagline: 'Deep Trench Frost Angler',
    category: 'Reflex',
    icon: '[G-181]',
    instructions: 'Drill an ice hole over deep trenches! Cast your glowing lure and jerk the line the microsecond an abyssal arctic trout strikes.',
    controlPrompt: 'Tap: Cast & Strike'
  },
  {
    id: 'aurora_collector',
    title: 'Aurora Borealis Weaver',
    tagline: 'Geomagnetic Light Prism',
    category: 'Party',
    icon: '[G-182]',
    instructions: 'The sky dances with northern lights! Adjust your magnetic polar crystal to absorb flowing ribbon waves of green, magenta, and solar violet.',
    controlPrompt: 'Tap: Shift Polarity'
  },
  {
    id: 'dog_sled_dash',
    title: 'Husky Dog Sled Sprint',
    tagline: 'Great Northern Mushers',
    category: 'Racing',
    icon: '[G-183]',
    instructions: 'Mush through howling snowy winds! Tap in rhythm with your lead huskies to leap fallen pine logs and leap across gaping crevasse gaps.',
    controlPrompt: 'Tap: Leap Obstacle'
  },
  {
    id: 'mammoth_stampede',
    title: 'Mammoth Stampede',
    tagline: 'Tundra Ice Age Survival',
    category: 'Action',
    icon: '[G-184]',
    instructions: 'A thundering herd of woolly mammoths stampedes across the permafrost! Dodge massive tusk sweeps and giant stomps to remain the last hunter standing.',
    controlPrompt: 'Hold: Move / Dodge'
  },
  {
    id: 'frostbite_cavern',
    title: 'Frostbite Stalactite Cavern',
    tagline: 'Glacial Drop Hazard Reflex',
    category: 'Reflex',
    icon: '[G-185]',
    instructions: 'The ancient cavern roof is collapsing under heavy frost! Dash under falling razor-sharp ice stalactites to gather frozen prehistoric relics.',
    controlPrompt: 'Tap: Direction Dash'
  },
  {
    id: 'geyser_leap',
    title: 'Geothermal Geyser Leap',
    tagline: 'Icelandic Volcanic Hot Springs',
    category: 'Action',
    icon: '[G-186]',
    instructions: 'Leap across arctic thermal stepping stones! Time your jumps between boiling steam vents so you do not get blasted into the sky by scalding geysers.',
    controlPrompt: 'Tap: Leap Next Stone'
  },
  {
    id: 'clockwork_cogs',
    title: 'Clockwork Cog Synchrony',
    tagline: 'Precision Escapement Mesh',
    category: 'Reflex',
    icon: '[G-187]',
    instructions: 'Big Ben gears are uncoupled! Tap when the golden drive teeth align with the driven escapement gear to mesh the gear train and generate kinetic torque.',
    controlPrompt: 'Tap: Mesh Gears'
  },
  {
    id: 'steam_boiler_relief',
    title: 'Steam Boiler Relief',
    tagline: 'High-Pressure Safety Regulator',
    category: 'Physics',
    icon: '[G-188]',
    instructions: 'The locomotive furnace is raging! Hold to vent steam safety valves and sustain maximum horsepower in the gold 80-95 PSI sweet spot without triggering a catastrophic blowout.',
    controlPrompt: 'Hold: Vent Steam Valve'
  },
  {
    id: 'zeppelin_dogfight',
    title: 'Zeppelin Sky Duel',
    tagline: 'Victorian Dirigible Aerial Combat',
    category: 'Action',
    icon: '[G-189]',
    instructions: 'Pilot an armored steam dirigible over London smog! Rotate to aim steam cannons and hold to burst forward while puncturing rival airship gasbags.',
    controlPrompt: 'Tap: Rotate & Shoot | Hold: Thrust'
  },
  {
    id: 'tesla_coil_arc',
    title: 'Tesla Coil Lightning Net',
    tagline: 'Wardenclyffe High-Voltage Harvester',
    category: 'Reflex',
    icon: '[G-190]',
    instructions: 'Nikola Tesla high-voltage discharges whip around the perimeter! Hold your grounding rod to channel lightning arcs into your Leyden capacitor jars.',
    controlPrompt: 'Hold: Ground Rod'
  },
  {
    id: 'automator_assembly',
    title: 'Automaton Clockwork Assembly',
    tagline: 'Hydraulic Toy Stamp Factory',
    category: 'Action',
    icon: '[G-191]',
    instructions: 'Conveyor belts carry unfinished brass automatons! Tap the steam press to stamp heart gears and windup keys into moving automatons with perfect rhythm.',
    controlPrompt: 'Tap: Stamp Gear'
  },
  {
    id: 'pneumatic_tube_rush',
    title: 'Pneumatic Tube Dispatch',
    tagline: 'Underground Brass Capsule Sorter',
    category: 'Puzzle',
    icon: '[G-192]',
    instructions: 'Pressurized brass capsules speed through the city tube grid! Tap to toggle your suction diverter gate: collect gold and silver dispatches while avoiding volatile nitro bombs.',
    controlPrompt: 'Tap: Toggle Gate'
  },
  {
    id: 'ornithopter_flock',
    title: 'Ornithopter Wing Flight',
    tagline: 'Da Vinci Flapping Air Spire',
    category: 'Racing',
    icon: '[G-193]',
    instructions: 'Soar through clock spires on leather mechanical wings! Tap in steady avian cadence to flap for lift and catch rising thermal updrafts.',
    controlPrompt: 'Tap: Flap Wings'
  },
  {
    id: 'pressure_gauge_lock',
    title: 'Pressure Gauge Safe Cracker',
    tagline: 'Clockwork Tumbler Lock Duel',
    category: 'Puzzle',
    icon: '[G-194]',
    instructions: 'Crack the Bank of England brass safe! Time needle clicks to lock concentric tumblers into the golden resonance sweet spots.',
    controlPrompt: 'Tap: Lock Tumbler Pin'
  },
  {
    id: 'copper_conduit',
    title: 'Copper Conduit Smelter',
    tagline: 'Foundry Molten Flow Manifold',
    category: 'Action',
    icon: '[G-195]',
    instructions: 'Molten copper drips from overhead crucibles! Tap to rotate elbow valves and align the conduit pipe network so molten metal pours safely into ingot molds.',
    controlPrompt: 'Tap: Rotate Valve'
  },
  {
    id: 'monocycle_derby',
    title: 'Velodrome Monocycle Derby',
    tagline: 'Giant Gyroscopic Single-Wheel Sprint',
    category: 'Racing',
    icon: '[G-196]',
    instructions: 'Race giant 6-foot monocycles inside the wooden velodrome! Hold to pedal and lean into the curve, but release before you over-torque into a faceplant wipeout.',
    controlPrompt: 'Hold: Pedal & Lean'
  },
  {
    id: 'cyber_samurai_slash',
    title: 'Cyber Samurai Katana Duel',
    tagline: 'High-Speed Neon Energy Parry',
    category: 'Action',
    icon: '[G-197]',
    instructions: 'Clash atop rainy cyber-skyscrapers! Tap for swift katana slashes; hold to raise an energy parry shield to deflect and stun incoming blade strikes.',
    controlPrompt: 'Tap: Slash | Hold: Parry Shield'
  },
  {
    id: 'mainframe_breach',
    title: 'Mainframe ICE Core Breach',
    tagline: 'Quantum Data Packet Injection',
    category: 'Puzzle',
    icon: '[G-198]',
    instructions: 'Concentric ICE firewalls protect the quantum mainframe! Time your data packet injection beams through rotating firewall gaps to breach the core.',
    controlPrompt: 'Tap: Fire Data Packet'
  },
  {
    id: 'hovercar_skyline',
    title: 'Hovercar Skyline Highway',
    tagline: 'Neo-Tokyo Cyberway Traffic Weave',
    category: 'Racing',
    icon: '[G-199]',
    instructions: 'Speed down multi-tier neon skyways! Tap to switch cyber-lanes, dodging heavy autonomous cargo haulers while grabbing turbo battery orbs.',
    controlPrompt: 'Tap: Switch Lane'
  },
  {
    id: 'hologram_glitch',
    title: 'Hologram Glitch Purge',
    tagline: 'Android Replica Perception Reflex',
    category: 'Reflex',
    icon: '[G-200]',
    instructions: 'Holographic android avatars stand on inspection pedestals! The moment an avatar displays chromatic scanline glitching, tap first to purge the imposter.',
    controlPrompt: 'Tap: Purge Glitch'
  },
  {
    id: 'laser_grapple',
    title: 'Laser Grapple Swing',
    tagline: 'Skyline Tether Kinetic Physics',
    category: 'Physics',
    icon: '[G-201]',
    instructions: 'Swing across neon anchor spires in the night sky! Hold to tether onto ahead anchor nodes; release at the forward apex to fling in soaring parabolic leaps.',
    controlPrompt: 'Hold: Grapple | Release: Leap'
  },
  {
    id: 'neural_synapse',
    title: 'Neural Synapse Bridge',
    tagline: 'AI Cortex Impulses & Ion Channels',
    category: 'Party',
    icon: '[G-202]',
    instructions: 'Consciousness surges across synthetic brain axons! Tap to toggle synaptic gates open to conduct harmonic thoughts while blocking corrupt virus packets.',
    controlPrompt: 'Tap: Toggle Synapse'
  },
  {
    id: 'drone_swarm_defense',
    title: 'Drone Swarm EMP Bastion',
    tagline: 'Data Vault Shockwave Annihilation',
    category: 'Action',
    icon: '[G-203]',
    instructions: 'Swarms of hostile micro-drones dive toward your data terminal! Time resonant EMP shockwave bursts to vaporize clusters before they breach your core.',
    controlPrompt: 'Tap: EMP Shockwave'
  },
  {
    id: 'synth_keytar_solo',
    title: 'Synthwave Keytar Solo',
    tagline: 'Neon Outrun Rhythm Rocker',
    category: 'Reflex',
    icon: '[G-204]',
    instructions: 'Rock the stadium with searing synthesizer power chords! Tap when neon synth notes cross the keytar strike line to unleash massive crowd hype.',
    controlPrompt: 'Tap: Strike Note'
  },
  {
    id: 'quantum_tunneling',
    title: 'Quantum Tunneling Accelerator',
    tagline: 'Subatomic Wave-Particle Duality',
    category: 'Reflex',
    icon: '[G-205]',
    instructions: 'Race along subatomic magnetic rails! Hold to phase-shift into an intangible wave to tunnel through solid particle barriers without shattering.',
    controlPrompt: 'Hold: Phase Shift'
  },
  {
    id: 'hyperloop_racer',
    title: 'Maglev Hyperloop Velocity',
    tagline: 'Vacuum Tube 360-Degree Helical Sprint',
    category: 'Racing',
    icon: '[G-206]',
    instructions: 'Blast through vacuum maglev tubes at Mach 1! Hold to engage linear magnetic induction thrust, but release to cool coils before thermal burnout.',
    controlPrompt: 'Hold: Maglev Thrust'
  },
  {
    id: 'ring_toss_frenzy',
    title: 'Carousel Bottle Toss',
    tagline: 'Whirling Turntable Ringer Rush',
    category: 'Reflex',
    icon: '[G-207]',
    instructions: 'Time your sweeping aim guide and charge power to heave rings onto spinning carnival glass bottles! Score golden bottles for massive points.',
    controlPrompt: 'Hold: Charge Throw | Release: Pitch Ring'
  },
  {
    id: 'balloon_dart_clown',
    title: 'Clown Wheel Shootout',
    tagline: 'Rotating Circus Target Wheel',
    category: 'Action',
    icon: '[G-208]',
    instructions: 'Aim your sweeping dart reticle and pop colorful balloons on the rotating clown wheel! Hit the laughing clown nose for a loud honk and jackpot points!',
    controlPrompt: 'Tap / Action: Fire Dart'
  },
  {
    id: 'duck_pond_derby',
    title: 'Duck Pond Derby',
    tagline: 'Magnetic Rubber Duck Winch',
    category: 'Physics',
    icon: '[G-209]',
    instructions: 'Launch your magnetic fishing hook into the swirling current pond to snag bobbing rubber ducks! Golden star ducks award maximum prize points.',
    controlPrompt: 'Tap / Action: Drop & Reel Hook'
  },
  {
    id: 'milk_bottle_knockdown',
    title: 'Milk Bottle Knockdown',
    tagline: 'Carnival Baseball Strikeout',
    category: 'Action',
    icon: '[G-210]',
    instructions: 'Hurl heavy weighted baseballs at tiered pyramids of porcelain milk bottles! Hit the base for full strike collapses and score multiplier bonuses.',
    controlPrompt: 'Hold: Charge Pitch | Release: Throw Baseball'
  },
  {
    id: 'bumper_car_derby',
    title: 'Bumper Car Derby',
    tagline: 'Electric Arena Smash',
    category: 'Action',
    icon: '[G-211]',
    instructions: 'Ram opponents with heavy rubber bumpers! Drive through spark zones to recharge boost and slam rivals into bouncing electrified walls.',
    controlPrompt: 'Steer: Drive | Tap: Nitro Ram'
  },
  {
    id: 'cotton_candy_spin',
    title: 'Cotton Candy Drum Spin',
    tagline: 'Centrifugal Sugar Floss Drum',
    category: 'Party',
    icon: '[G-212]',
    instructions: 'Spin your paper cone along the perimeter of the giant spinning sugar drum to catch flying cotton candy strands! Build huge fluffy clouds for giant bonus payouts.',
    controlPrompt: 'Tap / Steer: Reverse Cone Spin'
  },
  {
    id: 'roller_coaster_brake',
    title: 'Trestle Speed Braker',
    tagline: 'Wooden Trestle Thrill Braker',
    category: 'Racing',
    icon: '[G-213]',
    instructions: 'Hurtle down steep wooden drops and hairpin loops! Hold your brake on extreme danger curves to prevent catastrophic derailment while sustaining top thrill speeds.',
    controlPrompt: 'Hold: Apply Track Brakes'
  },
  {
    id: 'ferris_wheel_hop',
    title: 'Twin Wheel Gondola Hop',
    tagline: 'Counter-Rotating Gondola Leap',
    category: 'Physics',
    icon: '[G-214]',
    instructions: 'Time leaps between counter-rotating Ferris wheel gondolas as they align at the apex! Snatch floating prize ribbons without tumbling to the safety net below.',
    controlPrompt: 'Tap / Action: Leap Gondola'
  },
  {
    id: 'dunk_clown_tank',
    title: 'Heckler Dunk Tank',
    tagline: 'Bullseye Clown Splashdown',
    category: 'Reflex',
    icon: '[G-215]',
    instructions: 'Heckling clown perches on the wooden plank above the splash tank! Time your pitch to strike the oscillating metal bullseye target and drop him into the water!',
    controlPrompt: 'Tap / Action: Pitch Softball'
  },
  {
    id: 'fortune_teller_tarot',
    title: 'Fortune Teller Tarot',
    tagline: 'Mystic Arcana Crystal Match',
    category: 'Party',
    icon: '[G-216]',
    instructions: 'Watch the glowing crystal ball reveal an ancient Arcana rune! Tap when your sweeping tarot deck cycles to the matching symbol to build cosmic multiplier streaks.',
    controlPrompt: 'Tap / Action: Select Arcana Card'
  },
  {
    id: 'vine_swing_canopy',
    title: 'Vine Swing Canopy',
    tagline: 'Jungle Pendulum Liana Rush',
    category: 'Physics',
    icon: '[G-217]',
    instructions: 'Swing on hanging jungle lianas across a deep rainforest waterfall! Time releases to fly through the air, catch the next vine, and snatch floating tropical fruits.',
    controlPrompt: 'Tap: Release / Catch Vine'
  },
  {
    id: 'trex_egg_scramble',
    title: 'T-Rex Egg Scramble',
    tagline: 'Prehistoric Nest Heist',
    category: 'Action',
    icon: '[G-218]',
    instructions: 'Sneak into the center dinosaur nest and gather glowing prehistoric eggs! When the sleeping T-Rex stirs and opens its amber eye, FREEZE instantly or get roared back home!',
    controlPrompt: 'Steer: Sneak | Release: Freeze'
  },
  {
    id: 'piranha_river_hop',
    title: 'Piranha River Hop',
    tagline: 'Rapids Log Frog Crossing',
    category: 'Reflex',
    icon: '[G-219]',
    instructions: 'Hop across drifting river logs and mossy bark to reach the opposite jungle bank! Watch out for sharp-toothed red piranhas leaping out of the turbulent river currents.',
    controlPrompt: 'Tap: Hop Forward | Steer: Hop Lateral'
  },
  {
    id: 'pterodactyl_glide',
    title: 'Pterodactyl Glide',
    tagline: 'Volcanic Thermal Flight',
    category: 'Racing',
    icon: '[G-220]',
    instructions: 'Soar through prehistoric skies on leathery pterosaur wings! Flap to gain altitude, dive for speed, catch volcanic thermal updrafts, and swoop through floating air rings.',
    controlPrompt: 'Tap: Flap Wings | Hold: Dive'
  },
  {
    id: 'quicksand_escape',
    title: 'Quicksand Escape',
    tagline: 'Bubbling Mud Pit Rescue',
    category: 'Party',
    icon: '[G-221]',
    instructions: 'The bubbling prehistoric quicksand is pulling you down! Tap vigorously to kick your legs up to safety, and grab overhead swinging rescue ropes to hoist completely free.',
    controlPrompt: 'Tap: Kick Mud | Hold: Grab Rope'
  },
  {
    id: 'blowpipe_target',
    title: 'Blowpipe Target',
    tagline: 'Ancient Ruins Dart Aim',
    category: 'Reflex',
    icon: '[G-222]',
    instructions: 'Aim a traditional hollow bamboo blowpipe as the crosshair oscillates! Inhale to build lung power and exhale darts to strike moving stone masks and Aztec golden suns.',
    controlPrompt: 'Hold: Inhale Breath | Release: Fire Dart'
  },
  {
    id: 'amber_fossil_excavate',
    title: 'Amber Fossil Excavate',
    tagline: 'Paleontology Quarry Chisel',
    category: 'Puzzle',
    icon: '[G-223]',
    instructions: 'Chisel sedimentary shale rock slabs in an ancient quarry! Break through hardened stone layers to unearth preserved golden amber gems and ancient trilobite shells.',
    controlPrompt: 'Tap: Chisel Rock Block'
  },
  {
    id: 'raptor_pounce_dodge',
    title: 'Raptor Pounce Dodge',
    tagline: 'Velociraptor Ambush Evasion',
    category: 'Action',
    icon: '[G-224]',
    instructions: 'Cunning velociraptors stalk from tall savanna ferns! Watch the glowing red trajectory telegraph lines and dodge-roll out of the pounce strike zone to score close-call bonuses.',
    controlPrompt: 'Steer: Move | Tap: Dodge Roll'
  },
  {
    id: 'bamboo_pole_vault',
    title: 'Bamboo Pole Vault',
    tagline: 'Jungle Ravine Spring Leap',
    category: 'Sports',
    icon: '[G-225]',
    instructions: 'Sprint down the runway and plant your flexible green bamboo pole into the stone vault box! Hold to bend the pole and release at maximum spring tension to vault the chasm.',
    controlPrompt: 'Tap: Plant Pole | Release: Launch Vault'
  },
  {
    id: 'volcano_lava_leap',
    title: 'Volcano Lava Leap',
    tagline: 'Caldera Basalt Pillar Hop',
    category: 'Action',
    icon: '[G-226]',
    instructions: 'Survive in the boiling crater of an active supervolcano! Hop between obsidian basalt pillars, avoid rumbling pillars about to submerge in molten lava, and collect fire rubies.',
    controlPrompt: 'Steer / Tap: Leap Basalt Pillar'
  },
  {
    id: 'caterpillar_inchworm',
    title: 'Caterpillar Inchworm',
    tagline: 'Dewy Twig Scrunch & Surge',
    category: 'Reflex',
    icon: '[G-227]',
    instructions: 'Inchworm along garden rose branches! Hold to contract your tail forward into an arched U-shape, then release to surge your head forward and snatch morning dew drops.',
    controlPrompt: 'Hold: Contract Tail | Release: Extend Head'
  },
  {
    id: 'honeybee_nectar_relay',
    title: 'Honeybee Nectar Relay',
    tagline: 'Wildflower Harvest Rush',
    category: 'Racing',
    icon: '[G-228]',
    instructions: 'Buzz across the blooming flower meadow! Sip nectar from clover and lavender blossoms, dodge patrolling garden wasps, and deposit sweet honey into your hive cell.',
    controlPrompt: 'Steer: Fly Bee | Hover: Sip Nectar'
  },
  {
    id: 'spider_web_tangle',
    title: 'Spider Web Tangle',
    tagline: 'Radial Dew Web Trapper',
    category: 'Puzzle',
    icon: '[G-229]',
    instructions: 'Traverse an 8-spoke morning spiderweb! Crawl across radial threads to wrap trapped fruit flies and gnats in sticky silk before the morning rain arrives.',
    controlPrompt: 'Tap: Crawl Web | Steer: Radial Switch'
  },
  {
    id: 'ant_colony_haul',
    title: 'Ant Colony Haul',
    tagline: 'Subterranean Picnic Pantry',
    category: 'Action',
    icon: '[G-230]',
    instructions: 'Scurry to the surface picnic table and haul heavy sugar cubes, watermelon seeds, and berry crumbs deep into the underground colony queen pantry chamber.',
    controlPrompt: 'Steer: Scurry Ant | Touch: Grab & Deliver'
  },
  {
    id: 'firefly_night_beacon',
    title: 'Firefly Night Beacon',
    tagline: 'Midnight Meadow Glow Harmony',
    category: 'Party',
    icon: '[G-231]',
    instructions: 'Synchronize your bioluminescent firefly lantern with the rhythmic flashes of the central meadow mother beacon! Go dark when predatory night bats swoop overhead.',
    controlPrompt: 'Tap: Flash Lantern | Steer: Hover'
  },
  {
    id: 'dung_beetle_roll',
    title: 'Dung Beetle Roll',
    tagline: 'Colossal Soil Sphere Smash',
    category: 'Physics',
    icon: '[G-232]',
    instructions: 'Roll an expanding sphere of rich garden moss and soil! Gather loose soil clumps to grow the ball into an unstoppable boulder and score into the compost goal.',
    controlPrompt: 'Steer: Roll Mud Ball | Ram: Bump Rivals'
  },
  {
    id: 'ladybug_aphid_hunt',
    title: 'Ladybug Aphid Hunt',
    tagline: 'Rose Leaf Pest Gobbler',
    category: 'Action',
    icon: '[G-233]',
    instructions: 'Skitter across broad green rose leaves hunting garden aphid pests! Gobble green and golden royal aphids, and tap to flutter your spotted wings in a rapid snap dash.',
    controlPrompt: 'Steer: Skitter | Tap: Flutter Dash'
  },
  {
    id: 'grasshopper_high_jump',
    title: 'Grasshopper High Jump',
    tagline: 'Spring Leg Meadow Leap',
    category: 'Sports',
    icon: '[G-234]',
    instructions: 'Charge your powerful hind legs to launch soaring parabolic leaps across garden stepping stones! Time releases to land dead-center on 3-leaf golden clover landing pads.',
    controlPrompt: 'Hold: Charge Jump | Release: Launch Leap'
  },
  {
    id: 'dragonfly_dogfight',
    title: 'Dragonfly Dogfight',
    tagline: 'Lily Pond Aerial Ace Duel',
    category: 'Action',
    icon: '[G-235]',
    instructions: 'Dart across the tranquil garden lily pond at supersonic speeds! Hover-dash to snap flying mosquitoes out of the air and dive on rival dragonflies in mid-air duels.',
    controlPrompt: 'Steer: Fly Dragonfly | Tap: Supersonic Dash'
  },
  {
    id: 'centipede_slalom',
    title: 'Centipede Slalom',
    tagline: 'Wiggling Pebble Gate Weave',
    category: 'Racing',
    icon: '[G-236]',
    instructions: 'Guide a multi-segmented wriggling garden centipede through narrow red-and-white slalom gate pairs! Weave cleanly without crashing your trailing body into stone posts.',
    controlPrompt: 'Steer: Slalom Wiggle'
  },
  {
    id: 'poltergeist_possession',
    title: 'Telekinetic Toyroom',
    tagline: 'Gravity Wand Levitation',
    category: 'Action',
    icon: '[G-237]',
    instructions: 'Glide across the Arcane Toyroom and tether floating rockets, globes, and Golden Music Boxes with your Gravity Wand! Hurl props into the Starlight Portal, Holo-Targets, or rival mages!',
    controlPrompt: 'Steer: Glide & Tether | Tap: Hurl Prop | Hold (72-98%): Repulsor Wave'
  },
  {
    id: 'graveyard_zombie_bash',
    title: 'Midnight Courtyard Bash',
    tagline: 'Pumpkin & Skeleton Whack',
    category: 'Action',
    icon: '[G-238]',
    instructions: 'Sprint across the moonlit courtyard to bash popping Skeletons, Jack-O-Lanterns, and Golden Skeleton Kings! Avoid striking Marble Angel Statues and unleash Seismic Shovel Slams!',
    controlPrompt: 'Steer: Run Courtyard | Tap: Shovel Bash | Hold (72-98%): Seismic Slam'
  },
  {
    id: 'phantom_mirror_gaze',
    title: 'Phantom Mirror Gaze',
    tagline: 'Hall of Illusions Shatter',
    category: 'Puzzle',
    icon: '[G-239]',
    instructions: 'Sprint across the Hall of Mirrors! Smash purple Impostor Mirrors with your silver mallet, absorb Royal Crown blessings, and unleash Prism Shatter Waves.',
    controlPrompt: 'Steer: Run Gallery | Tap: Smash Mirror | Hold (72-98%): Prism Wave'
  },
  {
    id: 'cauldron_witch_brew',
    title: 'Cauldron Alchemy Brew',
    tagline: 'Royal Apothecary Cauldron Toss',
    category: 'Puzzle',
    icon: '[G-240]',
    instructions: 'Sprint around the shared Royal Apothecary Lab, grab Moon Shrooms, Dragon Scales, and Golden Feathers, and dunk them into the central Cauldron in recipe order for 2x Master Brew jackpots!',
    controlPrompt: 'Steer: Run Lab & Grab | Tap: Toss in Cauldron | Hold (72-98%): Vortex Shunt'
  },
  {
    id: 'gargoyle_stone_stare',
    title: 'Gargoyle Stone Stare',
    tagline: 'Cathedral Belfry Freeze & Vault',
    category: 'Reflex',
    icon: '[G-241]',
    instructions: 'Climb the Cathedral Belfry roof to collect Golden Chimes and ring the Summit Bell! Release all controls to freeze into an indestructible Stone Statue whenever the Sentinel Gargoyle stares!',
    controlPrompt: 'Steer / Hold: Climb Roof | Release: Stone Statue Freeze | Hold (72-98%): Stone Vault'
  },
  {
    id: 'ghost_vacuum_buster',
    title: 'Ghost Vacuum Buster',
    tagline: 'Proton Ecto-Canister Trap',
    category: 'Action',
    icon: '[G-242]',
    instructions: 'Roam the Grand Mansion Hall and aim your Proton Suction Cone to reel Slimer Sprites, Plasma Wisps, and Golden King Specters into your canister! Charge a Proton Overdrive to yank ghosts and shunt rivals.',
    controlPrompt: 'Steer: Move & Aim Cone | Hold: Boost Suction | Release (72-98%): Proton Overdrive'
  },
  {
    id: 'tombstone_crypt_slider',
    title: 'Pharaoh Relic Slider',
    tagline: 'Ancient Treasure Vault Shove',
    category: 'Physics',
    icon: '[G-243]',
    instructions: 'Run across the Pharaoh Treasure Vault and shove heavy carved stone lids open to unearth Golden Scarabs, Emerald Ankhs, and Diamond Pharaoh Crowns!',
    controlPrompt: 'Steer / Tap: Shove Vault Slab | Hold (72-98%): Seismic Slab Launch'
  },
  {
    id: 'creepy_doll_crawl',
    title: 'Clockwork Toy Derby',
    tagline: 'Grand Toymaker Wind-Up Sprint',
    category: 'Racing',
    icon: '[G-244]',
    instructions: 'Pilot a Brass Wind-Up Toy Racer across the Grand Toymaker Workbench! Weave for Golden Gears and Star Keys, and wind your Mainspring Key to the 72-98% sweet-spot for an Overdrive Sprint!',
    controlPrompt: 'Steer: Weave Lanes | Hold: Wind Mainspring | Release (72-98%): Overdrive Sprint'
  },
  {
    id: 'ouija_spirit_board',
    title: 'Celestial Star Compass',
    tagline: 'Galactic Constellation Decoder',
    category: 'Party',
    icon: '[G-245]',
    instructions: 'Pilot your brass Astro-Compass across the planetarium star-chart! Lock onto glowing star runes to trace cosmic constellations (`COMET`, `NOVA`, `ORBIT`) and bump rivals.',
    controlPrompt: 'Steer: Pilot Astro-Compass | Hold (72-98%): Supernova Pulse'
  },
  {
    id: 'cursed_clocktower_pendulum',
    title: 'Grand Clocktower Pendulum',
    tagline: 'Chronos Gear & Pendulum Dodge',
    category: 'Action',
    icon: '[G-246]',
    instructions: 'Sprint across the Grand Clocktower Beam gathering Brass Cogs and Golden Chronos Cores! Hold to crouch beneath the sweeping pendulum and release a charged Chronos Time-Vault!',
    controlPrompt: 'Steer: Run Beam | Hold: Crouch & Charge | Release (72-98%): Chronos Vault'
  },
  {
    id: 'synthwave_neon_racer',
    title: 'Synthwave Neon Racer',
    tagline: 'Wireframe Sunset Highway',
    category: 'Racing',
    icon: '[G-247]',
    instructions: 'Cruise down an endless 80s synthwave perspective highway! Dodge retro cruisers and hit cyan boost chevron pads towards the glowing sun.',
    controlPrompt: 'Steer: Switch Lanes | Hold: Turbo Nitro'
  },
  {
    id: 'pixel_space_invader',
    title: 'Pixel Space Invader',
    tagline: 'Descending Alien Matrix',
    category: 'Action',
    icon: '[G-248]',
    instructions: 'Defend the bottom baseline from marching waves of descending pixel invaders and alien drop-bombs! Shoot mystery UFOs for massive bonus points.',
    controlPrompt: 'Steer: Move Cannon | Tap: Fire Laser'
  },
  {
    id: 'pac_maze_chomp',
    title: 'Pac Maze Chomp',
    tagline: 'Neon Dot Labyrinth Gobbler',
    category: 'Action',
    icon: '[G-250]',
    instructions: 'Chomp glowing yellow dots across neon blue maze corridors! Snatch big corner power energizers to turn the tables and chomp wandering ghosts.',
    controlPrompt: 'Steer: Navigate Maze | Chomp Pellets'
  },
  {
    id: 'breakout_brick_blaster',
    title: 'Breakout Brick Blaster',
    tagline: 'Rainbow Neon Wall Smash',
    category: 'Physics',
    icon: '[G-251]',
    instructions: 'Slide metallic neon paddles to volley high-velocity vector balls into rainbow rows of destructible bricks before the ball slips past.',
    controlPrompt: 'Steer: Slide Paddle | Volley Ball'
  },
  {
    id: 'laser_disc_dance',
    title: 'LaserDisc Dance',
    tagline: 'Interactive Synth QTE',
    category: 'Party',
    icon: '[G-252]',
    instructions: 'Sync your rhythm to the holographic spinning LaserDisc! Tap illuminated neon directional arrows in perfect time with the electronic synthwave beat.',
    controlPrompt: 'Steer / Tap: Match Arrow On Beat'
  },
  {
    id: 'crt_scanline_sniper',
    title: 'CRT Scanline Sniper',
    tagline: 'Phosphor Target Gallery',
    category: 'Reflex',
    icon: '[G-253]',
    instructions: 'Target floating pixel ducks, soda cans, and golden UFOs drifting across curved CRT scanlines with rapid laser lightgun trigger reflexes.',
    controlPrompt: 'Steer: Move Crosshair | Tap: Fire Lightgun'
  },
  {
    id: 'cyber_grid_runner',
    title: 'Cyber Grid Runner',
    tagline: 'Hoverboard Data Core Chaser',
    category: 'Action',
    icon: '[G-254]',
    instructions: 'Pilot agile cyber hoverboards across an electrified synthwave grid! Snatch floating data cores, trigger nitro speed boosts, and unleash EMP shockwaves to steal rival data packets.',
    controlPrompt: 'WASD / Arrows: 360° Hover | Space / Enter: Nitro Boost & EMP Shock'
  },
  {
    id: 'synth_drum_pad',
    title: 'Synth Drum Pad',
    tagline: '808 Electronic Beat Battle',
    category: 'Party',
    icon: '[G-255]',
    instructions: 'Strike silicone rubber drum pads (Kick, Snare, Hi-Hat, Tom) in sync with the step sequencer to lay down the fattest retro drum groove.',
    controlPrompt: 'Steer: Select Pad | Tap: Strike On Beat'
  },
  {
    id: 'matrix_code_rain',
    title: 'Matrix Code Rain',
    tagline: 'Falling Terminal Cipher Stream',
    category: 'Puzzle',
    icon: '[G-256]',
    instructions: 'Catch golden cipher keys falling through green digital code rain to charge your decryption buffer while evading corrupt red glitch fragments.',
    controlPrompt: 'Steer: Slide Hacker Terminal | Catch Keys'
  },
  {
    id: 'sharks_and_minnows',
    title: 'Sharks & Minnows',
    tagline: 'Deep Ocean Lagoon Dash',
    category: 'Action',
    icon: '[G-257]',
    instructions: 'The classic pool duel! Minnows must sprint across the deep ocean channel from shore to shore. The Shark patrols the deep water with sudden chomp lunges. Score points for safe crossings and catching minnows!',
    controlPrompt: 'WASD / Arrows: Swim • Space / Enter: Dash / Lunge'
  },
  {
    id: 'power_path_clash',
    title: 'Power Path Clash',
    tagline: 'Math Tower Combat Showdown',
    category: 'Action',
    icon: '[G-258]',
    instructions: 'Calculate the ultimate progression! Fight weaker enemies to absorb their damage, grab multiplier runes, and build unstoppable power. Climax with an epic anime-style showdown where the highest damage warrior wins!',
    controlPrompt: 'WASD / Arrows: Select Door • Space / Enter: Advance'
  },
  {
    id: 'landscape_artillery',
    title: 'Landscape Artillery',
    tagline: 'Turn-Based Hillside Slingshot Duel',
    category: 'Physics',
    icon: '[G-259]',
    instructions: 'Turn-based artillery showdown on destructible terrain! Camera zooms into your turn. Aim left or right, pull back to set angle and power. Master gravity, wind, and body shots: direct headshots deliver 2.5x critical damage!',
    controlPrompt: 'Left/Right: Aim • Down/Up: Pull Back Power • Space/Enter: Launch'
  },
  {
    id: 'spam_click_showdown',
    title: 'Spam Click Showdown',
    tagline: 'Furious Button-Mashing Soda Blastoff',
    category: 'Party',
    icon: '[G-260]',
    instructions: 'Spam click as fast as humanly possible! Every click pumps pressurized fizzy soda into your rocket bottle. Hit over 8 CPS to activate burning Overdrive and reach 1000 PSI first to blast off into the stratosphere!',
    controlPrompt: 'SPAM CLICK MOUSE / TAP / SPACE / ENTER / BUTTONS AS FAST AS YOU CAN!'
  },
  {
    id: 'thumb_war_wrestle',
    title: 'Thumb War Wrestle',
    tagline: '1-2-3-4 I Declare A Thumb War!',
    category: 'Party',
    icon: '[P-01]',
    instructions: 'Phone-Exclusive Tabletop Showdown! Tap to lunge your articulated thumb across the ring and hold down on top of your rival’s thumb when exhausted to pin them for a 3-count! In 3-4P Phone Mode, Top 1v1 & Bottom 1v1 play simultaneously and winners battle in the Grand Final!',
    controlPrompt: 'Tap Touch Zone: Lunge & Slam • Hold on Pinned Rival: 1-2-3 Pin Count',
    phoneMode: 'phone_only'
  },
  {
    id: 'swipe_ninja_blitz',
    title: 'Swipe Ninja Blitz',
    tagline: '4-Corner Touchscreen Katana Fruit Slash',
    category: 'Reflex',
    icon: '[P-02]',
    instructions: 'Phone-Exclusive 1–4 Player Touch Blitz! Swipe or tap inside your quadrant to unleash glowing katana arcs! Slice flying watermelons, golden pineapples, and combo stars flying through your corner while avoiding spiked bombs!',
    controlPrompt: 'Swipe / Drag or Tap Your Quadrant: Unleash Katana Slash Arcs!',
    phoneMode: 'phone_only'
  }
];

export interface GameSettings {
  masterVolume: number; // 0.0, 0.25, 0.5, 0.75, 1.0
  sfxEnabled: boolean;
  gameSpeed: number; // 1.0, 1.3, 1.6
  tournamentGoal: number; // 3, 5, 7, 10
  shakeLevel: 'full' | 'reduced' | 'off';
}

export function detectInitialDeviceMode(): DevicePlatformMode {
  if (typeof window === 'undefined') return 'computer';

  // 1. Explicit query parameter override (?mode=phone or ?device=phone or ?mode=tablet)
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get('mode') || params.get('device') || params.get('platform');
  if (modeParam === 'phone' || modeParam === 'mobile' || modeParam === 'tablet' || modeParam === 'ipad') return 'phone';
  if (modeParam === 'computer' || modeParam === 'desktop') return 'computer';

  // 2. User-Agent mobile & tablet heuristics (covers Android, Pixel, iPhone, iPad, iPod, etc.)
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|BlackBerry|Opera Mini/i.test(ua);
  // iPadOS 13+ Safari reports desktop MacIntel user-agent with maxTouchPoints > 1
  const isIPadOS =
    typeof navigator !== 'undefined' &&
    (/Macintosh|MacIntel/i.test(ua) || navigator.platform === 'MacIntel') &&
    navigator.maxTouchPoints > 1;

  // 3. Pointer & screen characteristics
  const isCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const isTouchScreen = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
  const isPhoneOrTabletScreen = window.innerWidth <= 1024 || window.innerHeight <= 1024;

  // Phones and Touch Tablets (iPad) default to Touch/Mobile mode
  if (isMobileUA || isIPadOS || (isCoarse && isTouchScreen) || (isTouchScreen && isPhoneOrTabletScreen && isCoarse)) {
    return 'phone';
  }
  return 'computer';
}

export class GameManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: InputRouter;
  public audio: AudioEngine;
  public particles: ParticleSystem;
  public economy: EconomyManager = EconomyManager.getInstance();

  public state: GameState = 'LOBBY';
  public players: PlayerConfig[] = [];
  public selectedGameIndex: number = 0;
  public activeGame: BaseGame | null = null;
  public activeGameId: MinigameId | null = null;
  public currentRoundResult: RoundResult | null = null;

  // Device Platform Mode (Computer vs Phone) & 4P Split-Screen Bracket State
  public deviceMode: DevicePlatformMode = detectInitialDeviceMode();
  public deviceModePillHitbox: { x: number; y: number; w: number; h: number } | null = null;
  public secondarySplitGame: BaseGame | null = null;
  public splitBracketStage: 'none' | 'semis' | 'final' = 'none';
  public splitBracketGameId: MinigameId | null = null;
  public splitBracketTopWinner: PlayerId | null = null;
  public splitBracketBotWinner: PlayerId | null = null;
  public splitBracketTransitionTimer: number = 0;

  // Tournament settings
  public isTournament: boolean = false;
  public tournamentGoalPoints: number = 3;
  public tournamentLeaderboard: { playerId: PlayerId; points: number }[] = [];

  // Countdown timer
  private countdownTimer: number = 3.0;
  public matchElapsedSeconds: number = 0;

  // Safe Pause Button State (Hold 1.5s)
  public pauseHoldProgress: number = 0;
  private isHoldingPause: boolean = false;
  private pauseHoldStartTime: number = 0;

  // Rematch / Next button hold
  public rematchTimer: number = 0;

  // Scrollable Game Selection & Modal State
  public scrollY: number = 0;
  public targetScrollY: number = 0;
  public maxScrollY: number = 0;
  public isModalOpen: boolean = false;
  public modalGameIndex: number = 0;
  public sumoMode: 'standard' | 'no_limit' = 'standard';
  public sumoTargetMeters: number = 250;
  public lodeRunnerLevel: number = 0;
  public lodeRunnerSoloMode: boolean = true;
  public sumoHitboxes: Array<{ id: string; x: number; y: number; w: number; h: number; action: () => void }> = [];
  public modalCloudHitboxes: Array<{ id?: string; x: number; y: number; w: number; h: number; action: () => void }> = [];
  public roundOverCloudHitboxes: Array<{ id?: string; x: number; y: number; w: number; h: number; action: () => void }> = [];
  public selectedCategory: string = 'ALL';
  public catalogSortMode: CatalogSortMode = 'default';
  public cloud: CloudPersistenceManager = CloudPersistenceManager.getInstance();
  public wasm: WasmPhysicsEngine = WasmPhysicsEngine.getInstance();
  public categoryPillBoxes: { id: string; x: number; y: number; w: number; h: number; type: 'category' | 'random' | 'cup' | 'sort' }[] = [];
  public playerTabHitboxes: { count: number; x: number; y: number; w: number; h: number }[] = [];
  public diffHitboxes: { id: 'bot_easy' | 'bot_normal' | 'bot_hard'; x: number; y: number; w: number; h: number }[] = [];
  public playerBadgeHitboxes: { pid: number; x: number; y: number; w: number; h: number }[] = [];

  // Search filter in lobby
  public searchQuery: string = '';
  public isSearchFocused: boolean = false;

  // Performance cache for 60 FPS catalog filtering
  private cachedFilteredCatalog: MinigameMetadata[] | null = null;
  private catalogFilterDirty: boolean = true;

  // Podium celebratory confetti timer
  private podiumConfettiTimer: number = 1.8;

  // Round over button coordinate
  private roundOverBtnY: number = 0;

  // Settings State & Hitboxes
  public isSettingsOpen: boolean = false;
  public settings: GameSettings = {
    masterVolume: 0.75,
    sfxEnabled: true,
    gameSpeed: 1.0,
    tournamentGoal: 3,
    shakeLevel: 'full'
  };
  public settingsHitBoxes: { id: string; action: () => void; x: number; y: number; w: number; h: number }[] = [];

  // Shop / Wardrobe & Locker State
  public isShopOpen: boolean = false;
  public currentShopTab: 'ALL' | 'SKINS' | 'ARENAS' | 'PACKS' | 'BOOSTERS' = 'ALL';
  public selectedShopSkinIndex: number = 0;
  public selectedShopItemIndex: number = 0;
  public shopScrollY: number = 0;
  public targetShopScrollY: number = 0;
  public maxShopScrollY: number = 0;
  public shopPreviewPlayerId: PlayerId = 0;
  public shopHitBoxes: { id: string; action: () => void; x: number; y: number; w: number; h: number }[] = [];
  public shopCoinBadgeHitbox: { x: number; y: number; w: number; h: number } | null = null;
  public shopLobbyBannerHitbox: { x: number; y: number; w: number; h: number } | null = null;
  public packOpeningResult: PackResult | null = null;
  public packOpeningAnim: {
    packId: string;
    packName: string;
    packColor: string;
    packRarity: string;
    startTime: number;
    result: PackResult;
    particles: { x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number }[];
  } | null = null;
  public playerShieldActive: Record<PlayerId, boolean> = { 0: false, 1: false, 2: false, 3: false };
  public static instance: GameManager | null = null;
  public chronoClutchTriggered: boolean = false;

  // Trophy & Achievements State
  public isTrophiesOpen: boolean = false;
  public trophyHitBoxes: { id: string; action: () => void; x: number; y: number; w: number; h: number }[] = [];
  public trophyLobbyBannerHitbox: { x: number; y: number; w: number; h: number } | null = null;

  // Hi-DPI Retina Rendering State
  public logicalWidth: number = 800;
  public logicalHeight: number = 600;
  public dpr: number = 1;

  // Ambient Luxury Bokeh Motes in Lobby
  private ambientMotes: { x: number; y: number; radius: number; vx: number; vy: number; alpha: number; color: string }[] = [];
  private lastGamepadNavTime: number = 0;
  private dotPattern: CanvasPattern | null = null;

  constructor(canvas: HTMLCanvasElement) {
    GameManager.instance = this;
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;

    this.audio = new AudioEngine();
    this.particles = new ParticleSystem();
    this.input = new InputRouter(this.canvas);
    this.cloud.initializeCatalog(GAME_CATALOG.map((g) => g.id));

    // Apply auto-detected phone mode to input router and DOM elements
    if (this.deviceMode === 'phone') {
      this.input.setDeviceMode('phone');
      if (typeof document !== 'undefined') {
        const btnComp = document.getElementById('btn-mode-computer');
        const btnPhone = document.getElementById('btn-mode-phone');
        if (btnComp && btnPhone) {
          btnComp.classList.remove('active');
          btnPhone.classList.add('active');
        }
        document.body.classList.add('phone-platform-mode');
        document.body.classList.add('phone-mode');
      }
    }

    // Initialize ambient bokeh motes for luxury arcade lobby
    const moteColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#38BDF8'];
    for (let i = 0; i < 28; i++) {
      this.ambientMotes.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        radius: 2.0 + Math.random() * 4.0,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.2 - Math.random() * 0.45,
        alpha: 0.10 + Math.random() * 0.20,
        color: moteColors[Math.floor(Math.random() * moteColors.length)]
      });
    }

    this.initPlayers();
    this.loadSettings();
    this.setupResize();
    this.checkUrlParams();
  }

  private initPlayers() {
    this.players = [
      {
        id: 0,
        type: 'human',
        name: 'Player 1',
        color: '#EF4444',
        colorDark: '#991B1B',
        colorLight: '#FCA5A5',
        corner: 'top-left',
        primaryKey: 'W',
        altKeys: ['Q', 'E'],
        score: 0
      },
      {
        id: 1,
        type: 'bot_normal',
        name: 'Player 2',
        color: '#3B82F6',
        colorDark: '#1E40AF',
        colorLight: '#93C5FD',
        corner: 'top-right',
        primaryKey: 'O',
        altKeys: ['I', 'P', '↑'],
        score: 0
      },
      {
        id: 2,
        type: 'disabled',
        name: 'Player 3',
        color: '#10B981',
        colorDark: '#065F46',
        colorLight: '#6EE7B7',
        corner: 'bottom-left',
        primaryKey: 'C',
        altKeys: ['X', 'V'],
        score: 0
      },
      {
        id: 3,
        type: 'disabled',
        name: 'Player 4',
        color: '#F59E0B',
        colorDark: '#92400E',
        colorLight: '#FCD34D',
        corner: 'bottom-right',
        primaryKey: 'M',
        altKeys: ['N', ','],
        score: 0
      }
    ];

    this.tournamentLeaderboard = [
      { playerId: 0, points: 0 },
      { playerId: 1, points: 0 },
      { playerId: 2, points: 0 },
      { playerId: 3, points: 0 }
    ];
  }

  public static getInstance(): GameManager | null {
    return GameManager.instance;
  }

  public initRoundBoosters(): void {
    for (const p of this.players) {
      if (p.type !== 'disabled') {
        const b = EconomyManager.getInstance().getEquippedBooster(p.id);
        this.playerShieldActive[p.id] = (b === 'booster_shield');
      } else {
        this.playerShieldActive[p.id] = false;
      }
    }
  }

  public hasShield(pid: PlayerId): boolean {
    return !!this.playerShieldActive[pid];
  }

  public tryAbsorbShield(pid: PlayerId, x?: number, y?: number): boolean {
    if (this.playerShieldActive[pid]) {
      this.playerShieldActive[pid] = false;
      const posX = x ?? this.logicalWidth / 2;
      const posY = y ?? this.logicalHeight / 2;
      this.audio.playCountdown(false);
      this.particles.spawnGoBlast(posX, posY);
      this.particles.showFloatingText('🛡️ AEGIS FORCEFIELD BROKEN!', posX, posY - 25, '#06B6D4', 24);
      return true;
    }
    return false;
  }

  public getPlayerSpeedMultiplier(pid: PlayerId): number {
    return EconomyManager.getInstance().getEquippedBooster(pid) === 'booster_turbo' ? 1.15 : 1.0;
  }

  public isAutonomous: boolean = false;
  public gameSpeedMultiplier: number = 1.0;
  public globalBotDifficulty: 'bot_easy' | 'bot_normal' | 'bot_hard' = 'bot_normal';
  private autoNextTimer: number = 0;

  public setGlobalDifficulty(diff: 'bot_easy' | 'bot_normal' | 'bot_hard') {
    this.globalBotDifficulty = diff;
    for (const p of this.players) {
      if (p.type.startsWith('bot_')) {
        p.type = diff;
      }
    }
    this.audio.playTap();
  }

  private checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    let gameParam = params.get('game');
    const playersParam = params.get('players');
    const botsParam = params.get('bots');
    const diffParam = params.get('difficulty') || params.get('diff') || params.get('ai');
    const tourneyParam = params.get('tourney') || params.get('tournament');
    const roundsParam = params.get('rounds') || params.get('points');
    const speedParam = params.get('speed');
    const autoParam = params.get('auto');
    const autostartParam = params.get('autostart');
    const devParam = params.get('device') || params.get('mode') || params.get('platform');
    const sortParam = params.get('sort') || params.get('rank');

    if (sortParam && ['default', 'rating', 'highscore', 'saved', 'most_played'].includes(sortParam)) {
      this.catalogSortMode = sortParam as CatalogSortMode;
      this.catalogFilterDirty = true;
    }

    if (devParam === 'phone' || devParam === 'mobile') {
      this.setDeviceMode('phone');
    } else if (devParam === 'computer' || devParam === 'desktop') {
      this.setDeviceMode('computer');
    }

    if (diffParam === 'easy') this.setGlobalDifficulty('bot_easy');
    else if (diffParam === 'hard') this.setGlobalDifficulty('bot_hard');
    else if (diffParam === 'normal') this.setGlobalDifficulty('bot_normal');

    if (autoParam === 'true') {
      this.isAutonomous = true;
    }

    if (speedParam === 'fast') {
      this.gameSpeedMultiplier = 1.6;
    }

    if (roundsParam) {
      const r = parseInt(roundsParam, 10);
      if (!isNaN(r) && r > 0) this.tournamentGoalPoints = r;
    }

    if (tourneyParam === 'cup' || tourneyParam === 'true') {
      this.isTournament = true;
    }

    if (playersParam) {
      const count = parseInt(playersParam, 10);
      this.setPlayerCount(count);
    }

    // Configure specific bot count if requested (e.g. ?players=4&bots=3)
    if (botsParam) {
      const bCount = parseInt(botsParam, 10);
      if (!isNaN(bCount)) {
        const active = this.players.filter((p) => p.type !== 'disabled');
        const numBots = Math.min(active.length, bCount);
        // Set last numBots active players as bots
        for (let i = 0; i < active.length; i++) {
          if (i >= active.length - numBots) {
            active[i].type = this.globalBotDifficulty;
          } else {
            active[i].type = 'human';
          }
        }
      }
    }

    // Handle game aliases from Section 7
    if (gameParam) {
      if (gameParam === 'lasergrid') gameParam = 'laser_grid';
      if (gameParam === 'slingshot') gameParam = 'orbital';
      if (gameParam === 'racing') gameParam = 'micro_gp';
      if (gameParam === 'ghost') gameParam = 'ghost_flashlight';
      if (gameParam === 'kitchen') gameParam = 'kitchen_chaos';
      if (gameParam === 'sumo') gameParam = 'skyline_sumo';
      if (gameParam === 'stack' || gameParam === 'animals') gameParam = 'animal_stack';
      if (gameParam === 'iceberg' || gameParam === 'ice') gameParam = 'sumo_iceberg';
      if (gameParam === 'cannons' || gameParam === 'cannon') gameParam = 'cannon_barrage';
      if (gameParam === 'anvil' || gameParam === 'anvils') gameParam = 'anvil_rain';
      if (gameParam === 'bomb' || gameParam === 'relay') gameParam = 'bomb_relay';
      if (gameParam === 'hockey') gameParam = 'micro_hockey';
      if (gameParam === 'dodgeball' || gameParam === 'dodge') gameParam = 'dodgeball_blitz';
      if (gameParam === 'curling') gameParam = 'pixel_curling';
      if (gameParam === 'western' || gameParam === 'draw') gameParam = 'quick_draw';
      if (gameParam === 'balloon' || gameParam === 'balloons') gameParam = 'balloon_burst';
      if (gameParam === 'vortex' || gameParam === 'cosmic') gameParam = 'cosmic_vortex';
      if (gameParam === 'paintball' || gameParam === 'paint') gameParam = 'pixel_paintball';
      if (gameParam === 'minefield' || gameParam === 'minesweeper') gameParam = 'minefield_dash';
      if (gameParam === 'asteroid' || gameParam === 'miner') gameParam = 'asteroid_miner';
      if (gameParam === 'dont_look_down' || gameParam === 'climb' || gameParam === 'dld') gameParam = 'dont_look_down';
      if (gameParam === 'snowball_fight' || gameParam === 'snowball' || gameParam === 'snow') gameParam = 'snowball_fight';
      if (gameParam === 'highway_hop' || gameParam === 'highway' || gameParam === 'chicken' || gameParam === 'crossy' || gameParam === 'hop') gameParam = 'highway_hop';
      if (gameParam === 'gold_miner' || gameParam === 'goldminer' || gameParam === 'gold' || gameParam === 'goldrush' || gameParam === 'claw') gameParam = 'gold_miner';
      if (gameParam === 'chomp_frogs' || gameParam === 'frogs' || gameParam === 'hungry_frogs' || gameParam === 'frog' || gameParam === 'chomp') gameParam = 'chomp_frogs';
      if (gameParam === 'tug_of_war' || gameParam === 'tug' || gameParam === 'tugofwar' || gameParam === 'rope') gameParam = 'tug_of_war';
      if (gameParam === 'volley_spike' || gameParam === 'volley' || gameParam === 'volleyball' || gameParam === 'spike') gameParam = 'volley_spike';
      if (gameParam === 'maze_escape' || gameParam === 'maze' || gameParam === 'labyrinth' || gameParam === 'dungeon') gameParam = 'maze_escape';
      if (gameParam === 'pinball_battle' || gameParam === 'pinball' || gameParam === 'flipper' || gameParam === 'flipper_battle') gameParam = 'pinball_battle';
      if (gameParam === 'mole_panic' || gameParam === 'mole' || gameParam === 'moles' || gameParam === 'whack' || gameParam === 'whackamole') gameParam = 'mole_panic';
      if (gameParam === 'sharks_and_minnows' || gameParam === 'shark_and_minnows' || gameParam === 'sharks' || gameParam === 'minnows' || gameParam === 'shark') gameParam = 'sharks_and_minnows';
      if (gameParam === 'power_path_clash' || gameParam === 'power_path' || gameParam === 'path_clash' || gameParam === 'hero_path' || gameParam === 'damage_path') gameParam = 'power_path_clash';
      if (gameParam === 'landscape_artillery' || gameParam === 'artillery' || gameParam === 'landscape' || gameParam === 'artillery_duel' || gameParam === 'worms') gameParam = 'landscape_artillery';
      if (gameParam === 'spam_click_showdown' || gameParam === 'spam_click' || gameParam === 'spam' || gameParam === 'click' || gameParam === 'clicker') gameParam = 'spam_click_showdown';
      if (gameParam === 'sumo_lode_runner' || gameParam === 'loderunner' || gameParam === 'lode_runner' || gameParam === 'lode' || gameParam === 'sumo_lode') gameParam = 'sumo_lode_runner';

      const levelParam = params.get('level');
      if (levelParam) {
        const parsedLvl = parseInt(levelParam, 10);
        if (!isNaN(parsedLvl) && parsedLvl >= 0 && parsedLvl <= SUMO_LODE_LEVELS.length) {
          this.lodeRunnerLevel = parsedLvl;
        }
      }
      const soloParam = params.get('solo');
      if (soloParam === 'false' || soloParam === '0') {
        this.lodeRunnerSoloMode = false;
      } else if (soloParam === 'true' || soloParam === '1') {
        this.lodeRunnerSoloMode = true;
      }

      const idx = GAME_CATALOG.findIndex((g) => g.id === gameParam);
      if (idx !== -1) {
        this.selectedGameIndex = idx;
        this.startGame(GAME_CATALOG[idx].id);
      }
    } else if (autostartParam === 'true') {
      this.startGame(GAME_CATALOG[this.selectedGameIndex].id);
    }
  }

  public handleScroll(deltaY: number) {
    if (this.isShopOpen) {
      this.targetShopScrollY = Math.max(0, Math.min(this.maxShopScrollY, this.targetShopScrollY + deltaY));
      return;
    }
    if (this.state !== 'LOBBY' || this.isModalOpen) return;
    this.targetScrollY = Math.max(0, Math.min(this.maxScrollY, this.targetScrollY + deltaY));
  }

  public getUnifiedShopItems(): {
    category: 'SKIN' | 'ARENA' | 'PACK' | 'BOOSTER';
    id: string;
    name: string;
    rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
    price: number;
    description: string;
    previewColor: string;
    isUnlocked: boolean;
    raw: any;
  }[] {
    const econ = EconomyManager.getInstance();
    const items: {
      category: 'SKIN' | 'ARENA' | 'PACK' | 'BOOSTER';
      id: string;
      name: string;
      rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
      price: number;
      description: string;
      previewColor: string;
      isUnlocked: boolean;
      raw: any;
    }[] = [];

    // Skins (16 items)
    if (this.currentShopTab === 'ALL' || this.currentShopTab === 'SKINS') {
      SKIN_CATALOG.forEach((s) => {
        items.push({
          category: 'SKIN',
          id: s.id,
          name: s.name,
          rarity: s.rarity,
          price: s.price,
          description: s.description,
          previewColor: s.previewColor,
          isUnlocked: econ.isSkinUnlocked(s.id),
          raw: s
        });
      });
    }

    // Arenas (6 items)
    if (this.currentShopTab === 'ALL' || this.currentShopTab === 'ARENAS') {
      ARENA_CATALOG.forEach((a) => {
        items.push({
          category: 'ARENA',
          id: a.id,
          name: a.name,
          rarity: a.rarity,
          price: a.price,
          description: a.description,
          previewColor: a.previewColor,
          isUnlocked: econ.isArenaUnlocked(a.id),
          raw: a
        });
      });
    }

    // Lucky Mystery Packs (3 items)
    if (this.currentShopTab === 'ALL' || this.currentShopTab === 'PACKS') {
      PACK_CATALOG.forEach((p) => {
        items.push({
          category: 'PACK',
          id: p.id,
          name: p.name,
          rarity: p.rarity,
          price: p.price,
          description: p.description,
          previewColor: p.previewColor,
          isUnlocked: false,
          raw: p
        });
      });
    }

    // Boosters (4 items)
    if (this.currentShopTab === 'ALL' || this.currentShopTab === 'BOOSTERS') {
      BOOSTER_CATALOG.forEach((b) => {
        items.push({
          category: 'BOOSTER',
          id: b.id,
          name: b.name,
          rarity: b.rarity,
          price: b.price,
          description: b.description,
          previewColor: b.previewColor,
          isUnlocked: econ.isBoosterUnlocked(b.id),
          raw: b
        });
      });
    }

    return items;
  }

  private ensureShopItemVisible(index: number) {
    const itemH = 48;
    const itemGap = 6;
    const itemTop = index * (itemH + itemGap);
    const itemBottom = itemTop + itemH;
    const viewportH = 420;
    if (itemTop < this.targetShopScrollY) {
      this.targetShopScrollY = itemTop;
    } else if (itemBottom > this.targetShopScrollY + viewportH) {
      this.targetShopScrollY = itemBottom - viewportH;
    }
    this.targetShopScrollY = Math.max(0, Math.min(this.maxShopScrollY, this.targetShopScrollY));
  }

  private triggerShopItemPrimaryAction() {
    const items = this.getUnifiedShopItems();
    if (this.selectedShopItemIndex < 0 || this.selectedShopItemIndex >= items.length) return;
    const item = items[this.selectedShopItemIndex];
    const econ = EconomyManager.getInstance();

    if (item.category === 'SKIN') {
      if (!econ.isSkinUnlocked(item.id)) {
        if (econ.unlockSkin(item.id)) {
          this.audio.playPurchase();
          confetti({ particleCount: 65, spread: 70, origin: { y: 0.55 } });
        }
      } else {
        econ.equipSkin(0, item.id);
        this.audio.playTap();
      }
    } else if (item.category === 'ARENA') {
      if (!econ.isArenaUnlocked(item.id)) {
        if (econ.unlockArena(item.id)) {
          this.audio.playPurchase();
          confetti({ particleCount: 65, spread: 70, origin: { y: 0.55 } });
        }
      } else {
        econ.equipArena(item.id);
        this.audio.playTap();
      }
    } else if (item.category === 'PACK') {
      const res = econ.openPack(item.id);
      if (res) {
        this.packOpeningResult = res;
        this.audio.playFanfare();
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });
      }
    } else if (item.category === 'BOOSTER') {
      if (!econ.isBoosterUnlocked(item.id)) {
        if (econ.unlockBooster(item.id)) {
          this.audio.playPurchase();
          confetti({ particleCount: 65, spread: 70, origin: { y: 0.55 } });
        }
      } else {
        econ.equipBooster(0, item.id);
        this.audio.playTap();
      }
    }
  }

  private renderArenaThemeAura(w: number, h: number) {
    const arenaId = EconomyManager.getInstance().getEquippedArena();
    if (arenaId === 'arena_classic') return;

    const arena = ARENA_CATALOG.find((a) => a.id === arenaId);
    if (!arena) return;

    this.ctx.save();
    const t = performance.now() * 0.002;
    const pulse = 0.8 + 0.2 * Math.sin(t * 3);

    // 1. Glowing outer screen border
    this.ctx.strokeStyle = arena.borderColor;
    this.ctx.lineWidth = 4;
    this.ctx.shadowColor = arena.glowColor;
    this.ctx.shadowBlur = 12 * pulse;
    this.ctx.strokeRect(4, 4, w - 8, h - 8);

    // 2. Animated Thematic Environmental Features per Arena
    if (arenaId === 'arena_neon_synth') {
      this.ctx.save();
      // Moving 3D perspective synthwave floor grid lines
      this.ctx.strokeStyle = 'rgba(236, 72, 153, 0.22)';
      this.ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const gy = h - ((t * 40 + i * 28) % (h * 0.32));
        this.ctx.beginPath();
        this.ctx.moveTo(0, gy);
        this.ctx.lineTo(w, gy);
        this.ctx.stroke();
      }
      this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      for (let i = -4; i <= 4; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(w / 2 + i * 35, h * 0.68);
        this.ctx.lineTo(w / 2 + i * 160, h);
        this.ctx.stroke();
      }
      // Laser corners
      const corners = [
        { x: 8, y: 8, dx: 1, dy: 1, c: '#06B6D4' },
        { x: w - 8, y: 8, dx: -1, dy: 1, c: '#06B6D4' },
        { x: 8, y: h - 8, dx: 1, dy: -1, c: '#EC4899' },
        { x: w - 8, y: h - 8, dx: -1, dy: -1, c: '#EC4899' }
      ];
      for (const { x, y, dx, dy, c } of corners) {
        this.ctx.strokeStyle = c;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + dy * 28);
        this.ctx.lineTo(x, y);
        this.ctx.lineTo(x + dx * 28, y);
        this.ctx.stroke();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_cyber_matrix') {
      this.ctx.save();
      // Cascading green matrix digital code rain columns
      this.ctx.fillStyle = '#22C55E';
      this.ctx.font = 'bold 9px monospace';
      const glyphs = '01<>/_#ABCDEF';
      for (let c = 0; c < 8; c++) {
        const gx = c < 4 ? 12 + c * 16 : w - 70 + (c - 4) * 16;
        const streamOffset = (t * 50 + c * 35) % (h * 0.8);
        for (let r = 0; r < 5; r++) {
          const gy = 40 + (streamOffset + r * 16) % (h - 80);
          this.ctx.globalAlpha = r === 4 ? 0.8 : (r + 1) * 0.15;
          const char = glyphs[(c * 3 + r + Math.floor(t * 4)) % glyphs.length];
          this.ctx.fillText(char, gx, gy);
        }
      }
      this.ctx.globalAlpha = 1.0;
      // Circuit trace corner brackets
      this.ctx.strokeStyle = '#10B981';
      this.ctx.lineWidth = 3;
      const corners = [
        { x: 8, y: 8, dx: 1, dy: 1 },
        { x: w - 8, y: 8, dx: -1, dy: 1 },
        { x: 8, y: h - 8, dx: 1, dy: -1 },
        { x: w - 8, y: h - 8, dx: -1, dy: -1 }
      ];
      for (const { x, y, dx, dy } of corners) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + dy * 28);
        this.ctx.lineTo(x, y);
        this.ctx.lineTo(x + dx * 28, y);
        this.ctx.stroke();
        this.ctx.fillRect(x + dx * 6 - 2, y + dy * 6 - 2, 4, 4);
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_arcade_cabinet') {
      this.ctx.save();
      // Retro CRT scanlines raster
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let y = 0; y < h; y += 4) {
        this.ctx.fillRect(0, y, w, 1.5);
      }
      // Top & Bottom 8-bit marquee flashing bulbs
      const bulbColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899'];
      for (let i = 0; i < Math.floor(w / 40); i++) {
        const bx = 20 + i * 40;
        const bColor = bulbColors[(i + Math.floor(t * 3)) % bulbColors.length];
        this.ctx.fillStyle = bColor;
        this.ctx.shadowColor = bColor;
        this.ctx.shadowBlur = 6;
        this.ctx.beginPath();
        this.ctx.arc(bx, 6, 2.5, 0, Math.PI * 2);
        this.ctx.arc(bx, h - 6, 2.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_candy_land') {
      this.ctx.save();
      // Candy cane gumdrop corner towers
      const gumdrops = [
        { x: 16, y: 16, c: '#EC4899' },
        { x: w - 16, y: 16, c: '#06B6D4' },
        { x: 16, y: h - 16, c: '#10B981' },
        { x: w - 16, y: h - 16, c: '#F59E0B' }
      ];
      for (const g of gumdrops) {
        this.ctx.fillStyle = g.c;
        this.ctx.shadowColor = g.c;
        this.ctx.shadowBlur = 8;
        this.ctx.beginPath();
        this.ctx.arc(g.x, g.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(g.x - 2, g.y - 2, 2.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      // Floating confection sugar sparkles
      for (let i = 0; i < 6; i++) {
        const sx = (i * (w / 6) + Math.sin(t * 2 + i) * 30 + 40) % (w - 40);
        const sy = h - ((t * 25 + i * 45) % (h - 60)) - 30;
        this.ctx.fillStyle = '#F472B6';
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_subzero_ice') {
      this.ctx.save();
      // Hanging crystalline icicles from top border
      this.ctx.fillStyle = 'rgba(224, 242, 254, 0.7)';
      this.ctx.strokeStyle = '#38BDF8';
      this.ctx.lineWidth = 1;
      for (let i = 0; i < Math.floor(w / 30); i++) {
        const ix = 15 + i * 30;
        const ih = 8 + Math.sin(i * 1.7) * 5;
        this.ctx.beginPath();
        this.ctx.moveTo(ix - 6, 6);
        this.ctx.lineTo(ix, 6 + ih);
        this.ctx.lineTo(ix + 6, 6);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }
      // Drifting swirling blizzard snowflakes
      for (let i = 0; i < 14; i++) {
        const fx = (w + ((t * 45 + i * 73) % w) + Math.sin(t * 3 + i) * 20) % w;
        const fy = ((t * 60 + i * 41) % h);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        this.ctx.beginPath();
        this.ctx.arc(fx, fy, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_sakura_temple') {
      this.ctx.save();
      // Vermillion Torii Shrine Pillars in top corners
      for (const tx of [28, w - 28]) {
        this.ctx.fillStyle = '#DC2626';
        this.ctx.fillRect(tx - 10, 12, 3, 22);
        this.ctx.fillRect(tx + 7, 12, 3, 22);
        this.ctx.fillRect(tx - 15, 10, 30, 4);
        this.ctx.fillRect(tx - 12, 17, 24, 3);
      }
      // Floating pink cherry blossom petals tumbling across the wind
      for (let i = 0; i < 14; i++) {
        const px = (w + ((t * 30 + i * 67) % w) + Math.sin(t * 2 + i) * 35) % w;
        const py = ((t * 35 + i * 53) % h);
        this.ctx.save();
        this.ctx.translate(px, py);
        this.ctx.rotate(t * 1.5 + i);
        this.ctx.fillStyle = '#F472B6';
        this.ctx.shadowColor = '#EC4899';
        this.ctx.shadowBlur = 6;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_volcanic_magma') {
      this.ctx.save();
      // Molten magma fissures along bottom border
      this.ctx.strokeStyle = '#F97316';
      this.ctx.lineWidth = 2.5;
      this.ctx.shadowColor = '#EA580C';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.moveTo(20, h - 8);
      for (let x = 40; x < w - 20; x += 35) {
        const yFiss = h - 8 + Math.sin(x * 0.05 + t * 4) * 3;
        this.ctx.lineTo(x, yFiss);
      }
      this.ctx.stroke();
      // Rising fire embers
      for (let i = 0; i < 10; i++) {
        const ex = (i * (w / 10) + Math.sin(t * 3 + i) * 20 + 30) % (w - 40);
        const ey = h - ((t * 50 + i * 40) % (h * 0.5)) - 10;
        this.ctx.fillStyle = i % 2 === 0 ? '#EF4444' : '#FBBF24';
        this.ctx.beginPath();
        this.ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_haunted_dungeon') {
      this.ctx.save();
      // Creeping green ectoplasmic ground mist waves rolling along bottom
      this.ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      this.ctx.beginPath();
      this.ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 40) {
        const my = h - 22 + Math.sin(x * 0.02 + t * 2) * 8;
        this.ctx.lineTo(x, my);
      }
      this.ctx.lineTo(w, h);
      this.ctx.closePath();
      this.ctx.fill();
      // 4 Corner Torch Sconces
      const torches = [
        { x: 18, y: 18 },
        { x: w - 18, y: 18 },
        { x: 18, y: h - 18 },
        { x: w - 18, y: h - 18 }
      ];
      for (const tc of torches) {
        const flameFlicker = Math.sin(t * 12 + tc.x) * 2;
        this.ctx.fillStyle = '#10B981';
        this.ctx.shadowColor = '#34D399';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.arc(tc.x, tc.y, 6 + flameFlicker, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#A7F3D0';
        this.ctx.beginPath();
        this.ctx.arc(tc.x, tc.y, 2.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_atlantis_deep') {
      this.ctx.save();
      // Aquatic sunlight caustics shimmer waves across the display
      this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.14)';
      this.ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        this.ctx.beginPath();
        const cy = 60 + i * (h / 4);
        this.ctx.moveTo(0, cy + Math.sin(t * 2 + i) * 15);
        for (let x = 40; x <= w; x += 40) {
          this.ctx.lineTo(x, cy + Math.sin(x * 0.015 + t * 2.5 + i) * 12);
        }
        this.ctx.stroke();
      }
      // Swaying bioluminescent sea kelp in bottom corners
      this.ctx.strokeStyle = '#14B8A6';
      this.ctx.lineWidth = 3;
      for (const kx of [22, 34, w - 22, w - 34]) {
        this.ctx.beginPath();
        this.ctx.moveTo(kx, h - 6);
        this.ctx.quadraticCurveTo(kx + Math.sin(t * 3 + kx) * 10, h - 22, kx + Math.cos(t * 2 + kx) * 8, h - 38);
        this.ctx.stroke();
      }
      // Rising bioluminescent oxygen bubbles
      for (let i = 0; i < 10; i++) {
        const bx = (i * (w / 10) + Math.sin(t * 2 + i) * 25 + 40) % (w - 40);
        const by = h - ((t * 35 + i * 50) % h);
        this.ctx.strokeStyle = '#67E8F9';
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.arc(bx, by, 3 + (i % 3) * 1.5, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_golden_palace') {
      this.ctx.save();
      // Inner delicate gold filigree and sparkling starlight
      this.ctx.strokeStyle = 'rgba(254, 243, 199, 0.6)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([8, 6]);
      this.ctx.strokeRect(14, 14, w - 28, h - 28);
      this.ctx.setLineDash([]);
      // Twinkling golden starlight glints along borders
      for (let i = 0; i < 6; i++) {
        const sx = 40 + ((t * 80 + i * 140) % (w - 80));
        const sy = i % 2 === 0 ? 11 : h - 11;
        this.ctx.fillStyle = '#FEF3C7';
        this.ctx.shadowColor = '#F59E0B';
        this.ctx.shadowBlur = 8;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_deep_space_station') {
      this.ctx.save();
      // Distant twinkling stars
      for (let i = 0; i < 12; i++) {
        const sx = (i * 71) % (w - 30) + 15;
        const sy = (i * 53) % (h - 30) + 15;
        const sAlpha = 0.3 + 0.5 * Math.sin(t * 3 + i * 1.5);
        this.ctx.fillStyle = `rgba(224, 242, 254, ${sAlpha})`;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      // Rotating amber hazard beacons on corners
      const beacons = [
        { x: 14, y: 14 },
        { x: w - 14, y: 14 },
        { x: 14, y: h - 14 },
        { x: w - 14, y: h - 14 }
      ];
      for (const b of beacons) {
        const beaconFlash = (Math.sin(t * 8 + b.x) + 1) * 0.5;
        this.ctx.fillStyle = `rgba(245, 158, 11, ${0.4 + beaconFlash * 0.6})`;
        this.ctx.shadowColor = '#F59E0B';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_steampunk_forge') {
      this.ctx.save();
      // Rotating brass corner gear cogs
      const gears = [
        { x: 18, y: 18, dir: 1 },
        { x: w - 18, y: 18, dir: -1 },
        { x: 18, y: h - 18, dir: -1 },
        { x: w - 18, y: h - 18, dir: 1 }
      ];
      for (const g of gears) {
        this.ctx.save();
        this.ctx.translate(g.x, g.y);
        this.ctx.rotate(t * 1.8 * g.dir);
        this.ctx.fillStyle = '#B45309';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 14, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#F59E0B';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        // Gear teeth
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          this.ctx.fillRect(Math.cos(a) * 13 - 2, Math.sin(a) * 13 - 2, 4, 4);
        }
        // Center axle
        this.ctx.fillStyle = '#78350F';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
      // Venting steam puffs
      for (let i = 0; i < 6; i++) {
        const sx = i % 2 === 0 ? 25 + (i * 20) : w - 25 - (i * 20);
        const sy = h - 15 - ((t * 40 + i * 25) % 45);
        this.ctx.fillStyle = 'rgba(254, 243, 199, 0.25)';
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 5 + (i % 3) * 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_synthwave_highway') {
      this.ctx.save();
      // Glowing neon horizon sun at top center
      const sunX = w / 2;
      const sunY = 48;
      const sunR = 26;
      const sunGrad = this.ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
      sunGrad.addColorStop(0, '#FDE047');
      sunGrad.addColorStop(0.5, '#F43F5E');
      sunGrad.addColorStop(1, '#9333EA');
      this.ctx.fillStyle = sunGrad;
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      this.ctx.fill();
      // Horizontal laser slats through sun
      this.ctx.fillStyle = '#0F172A';
      for (let y = sunY - 4; y < sunY + sunR; y += 7) {
        this.ctx.fillRect(sunX - sunR, y, sunR * 2, 2.5);
      }
      // Neon Palm Tree silhouettes in bottom corners
      const palms = [{ x: 28, y: h - 12 }, { x: w - 28, y: h - 12 }];
      this.ctx.fillStyle = '#EC4899';
      for (const p of palms) {
        this.ctx.fillRect(p.x - 2, p.y - 28, 4, 28); // Trunk
        for (let a = -1.2; a <= 1.2; a += 0.6) {
          this.ctx.beginPath();
          this.ctx.arc(p.x + Math.sin(a) * 14, p.y - 28 + Math.cos(a) * 4, 8, 0, Math.PI);
          this.ctx.fill();
        }
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_jade_dragon') {
      this.ctx.save();
      // Swirling ethereal emerald dragon energy trail
      this.ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const orbitAngle = t * 2 + (i / 18) * Math.PI * 2;
        const ox = w / 2 + Math.cos(orbitAngle) * (w * 0.46);
        const oy = h / 2 + Math.sin(orbitAngle) * (h * 0.44);
        if (i === 0) this.ctx.moveTo(ox, oy);
        else this.ctx.lineTo(ox, oy);
      }
      this.ctx.closePath();
      this.ctx.stroke();
      // Hanging Jade Lanterns in top corners
      const lanterns = [{ x: 26, y: 22 }, { x: w - 26, y: 22 }];
      for (const lt of lanterns) {
        const sway = Math.sin(t * 3 + lt.x) * 4;
        this.ctx.fillStyle = '#10B981';
        this.ctx.shadowColor = '#34D399';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.roundRect(lt.x + sway - 6, lt.y - 8, 12, 16, 4);
        this.ctx.fill();
        this.ctx.fillStyle = '#FEF08A';
        this.ctx.beginPath();
        this.ctx.arc(lt.x + sway, lt.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_pinball_matrix') {
      this.ctx.save();
      // Flashing 1000-PT Arcade Pinball Pop Bumpers in corners
      const bumpers = [
        { x: 24, y: 24, c: '#EC4899' },
        { x: w - 24, y: 24, c: '#06B6D4' },
        { x: 24, y: h - 24, c: '#F59E0B' },
        { x: w - 24, y: h - 24, c: '#10B981' }
      ];
      for (const bp of bumpers) {
        const bScale = 1 + Math.max(0, Math.sin(t * 8 + bp.x)) * 0.22;
        this.ctx.fillStyle = bp.c;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = bp.c;
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.arc(bp.x, bp.y, 12 * bScale, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_biolum_jungle') {
      this.ctx.save();
      // Glowing Cyan/Violet Bioluminescent Mushrooms in corners & Drifting Spores
      for (const mx of [24, w - 24]) {
        this.ctx.fillStyle = '#CCFBF1';
        this.ctx.fillRect(mx - 2.5, h - 22, 5, 14);
        this.ctx.fillStyle = '#2DD4BF';
        this.ctx.shadowColor = '#2DD4BF';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(mx, h - 22, 11, Math.PI, 0);
        this.ctx.fill();
      }
      for (let i = 0; i < 10; i++) {
        const sx = (i * (w / 10) + Math.sin(t * 2 + i) * 30 + 30) % (w - 30);
        const sy = h - ((t * 25 + i * 47) % (h - 40)) - 20;
        this.ctx.fillStyle = i % 2 === 0 ? '#2DD4BF' : '#C084FC';
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_pirate_galleon') {
      this.ctx.save();
      // Broadside Brass Cannons & Swaying Ship Lanterns
      for (const cxPos of [20, w - 20]) {
        const dir = cxPos < w / 2 ? 1 : -1;
        this.ctx.fillStyle = '#78350F';
        this.ctx.fillRect(cxPos - 8, h / 2 - 8, 16, 16);
        this.ctx.fillStyle = '#334155';
        this.ctx.strokeStyle = '#F59E0B';
        this.ctx.lineWidth = 1.5;
        this.ctx.fillRect(cxPos, h / 2 - 5, dir * 18, 10);
        this.ctx.strokeRect(cxPos, h / 2 - 5, dir * 18, 10);
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_cyber_tokyo') {
      this.ctx.save();
      // Holographic Neon Kanji Signs & Rain Streaks
      this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      this.ctx.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) {
        const rx = ((i * 79 + t * 40) % (w - 20)) + 10;
        const ry = ((i * 53 + t * 180) % (h - 30)) + 10;
        this.ctx.beginPath();
        this.ctx.moveTo(rx, ry);
        this.ctx.lineTo(rx - 3, ry + 14);
        this.ctx.stroke();
      }
      for (const bx of [22, w - 22]) {
        this.ctx.strokeStyle = bx < w / 2 ? '#EC4899' : '#06B6D4';
        this.ctx.shadowColor = this.ctx.strokeStyle;
        this.ctx.shadowBlur = 10;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(bx - 10, 48, 20, 48);
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_black_hole') {
      this.ctx.save();
      // Relativistic Gravitational Lensing Orbit Rings along perimeter
      this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.ellipse(w / 2, h / 2, w * 0.48, h * 0.46, 0, t, t + Math.PI * 1.4);
      this.ctx.stroke();
      this.ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
      this.ctx.beginPath();
      this.ctx.ellipse(w / 2, h / 2, w * 0.47, h * 0.45, 0, -t * 1.2, -t * 1.2 + Math.PI * 1.2);
      this.ctx.stroke();
      this.ctx.restore();
    } else if (arenaId === 'arena_dragons_hoard') {
      this.ctx.save();
      // Glittering Golden Dubloon Mounds & Ruby Gems in bottom corners
      for (const gx of [26, w - 26]) {
        this.ctx.fillStyle = '#F59E0B';
        this.ctx.shadowColor = '#FBBF24';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(gx, h - 10, 16, Math.PI, 0);
        this.ctx.fill();
        this.ctx.fillStyle = '#EF4444';
        this.ctx.beginPath();
        this.ctx.arc(gx, h - 18, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_olympus_pantheon') {
      this.ctx.save();
      // Fluted White Marble Corinthian Corner Pillars & Golden Lightning Braziers
      for (const px of [16, w - 16]) {
        this.ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
        this.ctx.strokeStyle = '#F59E0B';
        this.ctx.lineWidth = 1.5;
        this.ctx.fillRect(px - 6, 16, 12, 36);
        this.ctx.strokeRect(px - 6, 16, 12, 36);
        this.ctx.fillRect(px - 9, 12, 18, 5);
        this.ctx.fillRect(px - 9, 50, 18, 5);
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_retro_synth_drift') {
      this.ctx.save();
      // Cyberspace Warp Tunnel: Speedlines & Pulsing Neon Arches
      this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const ringScale = ((t * 0.8 + i * 0.25) % 1);
        const rw = w * ringScale;
        const rh = h * ringScale;
        this.ctx.strokeRect(w / 2 - rw / 2, h / 2 - rh / 2, rw, rh);
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_crystal_cavern') {
      this.ctx.save();
      // Amethyst Crystal Clusters in 4 corners
      const corners = [{ x: 18, y: 18 }, { x: w - 18, y: 18 }, { x: 18, y: h - 18 }, { x: w - 18, y: h - 18 }];
      for (const c of corners) {
        this.ctx.fillStyle = '#C084FC';
        this.ctx.strokeStyle = '#E9D5FF';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(c.x, c.y - 12);
        this.ctx.lineTo(c.x + 8, c.y + 4);
        this.ctx.lineTo(c.x - 8, c.y + 4);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_inferno_caldera') {
      this.ctx.save();
      // Roaring Fire Braziers in bottom corners
      for (const bx of [24, w - 24]) {
        this.ctx.fillStyle = '#450A0A';
        this.ctx.fillRect(bx - 8, h - 22, 16, 16);
        const fPulse = Math.sin(t * 14 + bx) * 3;
        this.ctx.fillStyle = '#EF4444';
        this.ctx.shadowColor = '#F97316';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.arc(bx, h - 24 + fPulse, 7, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#FEF08A';
        this.ctx.beginPath();
        this.ctx.arc(bx, h - 24 + fPulse, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    } else if (arenaId === 'arena_cyber_dojo') {
      this.ctx.save();
      // Holographic Shoji Frames & Green Cyber Lanterns
      for (const lx of [22, w - 22]) {
        this.ctx.strokeStyle = '#10B981';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(lx - 8, 16, 16, 24);
        this.ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
        this.ctx.fillRect(lx - 6, 18, 12, 20);
      }
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  private renderShopArenaDiorama(arena: any, x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const t = performance.now() * 0.0025;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const pat = arena.floorPattern;

    ctx.save();
    // Clip inside rounded arena preview box
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 10);
    } else {
      ctx.rect(x + 2, y + 2, w - 4, h - 4);
    }
    ctx.clip();

    // Rich 2.5D radial depth floor shading
    const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.65);
    bgGrad.addColorStop(0, arena.previewColor);
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    // Bespoke Animated 2.5D Diorama Scenery per Arena Theme
    if (pat === 'synth_grid' || pat === 'synthwave_highway') {
      // Glowing Retro 80s Sunset & Perspective Neon Grid + Palm Silhouettes
      const sunR = pat === 'synthwave_highway' ? 28 : 20;
      const sunY = y + 36;
      const sunGrad = ctx.createLinearGradient(cx, sunY - sunR, cx, sunY + sunR);
      sunGrad.addColorStop(0, '#FDE047');
      sunGrad.addColorStop(0.5, '#EC4899');
      sunGrad.addColorStop(1, '#7E22CE');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(cx, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = arena.previewColor;
      for (let sy = sunY - 2; sy < sunY + sunR; sy += 5) {
        ctx.fillRect(cx - sunR, sy, sunR * 2, 2);
      }
      // Horizon & moving perspective lines
      const horY = y + 54;
      ctx.strokeStyle = '#EC4899';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, horY);
      ctx.lineTo(x + w, horY);
      ctx.stroke();
      for (let i = -5; i <= 5; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 14, horY);
        ctx.lineTo(cx + i * 52, y + h);
        ctx.stroke();
      }
      for (let r = 0; r < 4; r++) {
        const ry = horY + ((t * 22 + r * 15) % (h - 54));
        ctx.beginPath();
        ctx.moveTo(x, ry);
        ctx.lineTo(x + w, ry);
        ctx.stroke();
      }
      if (pat === 'synthwave_highway') {
        // Neon cyan palm trees on sides
        ctx.fillStyle = '#06B6D4';
        for (const px of [x + 22, x + w - 22]) {
          ctx.fillRect(px - 1.5, horY - 18, 3, 22);
          ctx.beginPath();
          ctx.arc(px, horY - 18, 9, Math.PI, 0);
          ctx.fill();
        }
      }
    } else if (pat === 'matrix_rain') {
      // Cascading Cyberpunk Digital Code Rain & Glowing Circuit Nodes
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 9px monospace';
      const chars = '01<>#/$%&*';
      for (let c = 0; c < 12; c++) {
        const mx = x + 12 + c * 20;
        const my = y + ((t * 45 + c * 29) % (h - 16));
        ctx.globalAlpha = 0.85;
        ctx.fillText(chars[(c + Math.floor(t * 5)) % chars.length], mx, my + 12);
        ctx.globalAlpha = 0.35;
        ctx.fillText(chars[(c + 3) % chars.length], mx, my);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.strokeRect(x + 14, y + 14, w - 28, h - 28);
    } else if (pat === 'arcade_cabinet') {
      // Retro 8-Bit Pixel Arcade: CRT scanlines, Pac-maze neon walls, power pellets & marquee lights
      // Flashing RGB Marquee Bulbs
      const bCols = ['#EF4444', '#FBBF24', '#22C55E', '#38BDF8', '#EC4899', '#A855F7'];
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = bCols[(i + Math.floor(t * 5)) % bCols.length];
        ctx.beginPath();
        ctx.arc(x + 12 + i * 22, y + 8, 3, 0, Math.PI * 2);
        ctx.arc(x + 12 + i * 22, y + h - 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // Glowing Neon Pac-Maze Walls
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#60A5FA';
      ctx.shadowBlur = 8;
      ctx.strokeRect(x + 16, y + 18, 48, 22);
      ctx.strokeRect(x + w - 64, y + 18, 48, 22);
      ctx.strokeRect(cx - 36, cy - 8, 72, 16);
      ctx.shadowBlur = 0;
      // Yellow Power Pellets
      ctx.fillStyle = '#FDE047';
      for (let i = 0; i < 5; i++) {
        const px = cx - 44 + i * 22;
        ctx.beginPath();
        ctx.arc(px, cy + 22, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Animated 8-bit Ghost
      const gx = cx + Math.sin(t * 3) * 35;
      const gy = y + 29;
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(gx, gy, 6, Math.PI, 0);
      ctx.lineTo(gx + 6, gy + 7);
      ctx.lineTo(gx + 2, gy + 5);
      ctx.lineTo(gx - 2, gy + 7);
      ctx.lineTo(gx - 6, gy + 5);
      ctx.closePath();
      ctx.fill();
      // CRT phosphor horizontal scanlines
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      for (let sy = y; sy < y + h; sy += 3) {
        ctx.fillRect(x, sy, w, 1);
      }
    } else if (pat === 'candy_land') {
      // Sugar Rush Kingdom: Spiraling peppermint swirl columns, gumdrop towers & sugar glints
      // Wavy marshmallow frosting drip at top
      ctx.fillStyle = '#FDF2F8';
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let fx = x; fx <= x + w; fx += 16) {
        const drip = Math.sin((fx - x) * 0.4 + t * 2) * 4 + 7;
        ctx.lineTo(fx, y + drip);
      }
      ctx.lineTo(x + w, y);
      ctx.closePath();
      ctx.fill();

      // Left & Right Spiraling Peppermint Candy Pillars
      for (const colX of [x + 14, x + w - 14]) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(colX - 8, y + 8, 16, h - 16);
        ctx.fillStyle = '#EF4444';
        for (let py = y + 8; py < y + h - 16; py += 10) {
          ctx.beginPath();
          ctx.moveTo(colX - 8, py);
          ctx.lineTo(colX + 8, py + 6);
          ctx.lineTo(colX + 8, py + 10);
          ctx.lineTo(colX - 8, py + 4);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Gumdrop Towers with Sugar Dust Crystals
      const gCols = ['#EC4899', '#38BDF8', '#FBBF24', '#4ADE80', '#A855F7'];
      for (let i = 0; i < 4; i++) {
        const gx = x + 38 + i * 44;
        const gy = y + h - 14;
        ctx.fillStyle = gCols[i % gCols.length];
        ctx.beginPath();
        ctx.arc(gx, gy - 8, 10, Math.PI, 0);
        ctx.lineTo(gx + 10, gy);
        ctx.lineTo(gx - 10, gy);
        ctx.closePath();
        ctx.fill();
        // Sugar glint dots
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(gx - 4, gy - 12, 1.5, 1.5);
        ctx.fillRect(gx + 3, gy - 9, 1.5, 1.5);
      }

      // Swirling Center Giant Lollipop Medallion
      ctx.save();
      ctx.translate(cx, cy - 2);
      ctx.rotate(t * 1.5);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#EC4899' : '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 18, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (pat === 'ice_crystals') {
      // Glacial Ice Sheet: Deep ice fissures, jagged glacial stalagmites & swirling blizzard
      // Top & Bottom Glacial Ice Spikes
      ctx.fillStyle = '#7DD3FC';
      for (let i = 0; i < 11; i++) {
        const ix = x + 12 + i * 22;
        ctx.beginPath();
        ctx.moveTo(ix - 8, y);
        ctx.lineTo(ix, y + 14 + (i % 3) * 6);
        ctx.lineTo(ix + 8, y);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ix - 8, y + h);
        ctx.lineTo(ix, y + h - 14 - (i % 2) * 7);
        ctx.lineTo(ix + 8, y + h);
        ctx.closePath();
        ctx.fill();
      }
      // Glowing Ice Lake Deep Fracture Cracks
      ctx.strokeStyle = '#BAE6FD';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(cx - 55, cy - 14);
      ctx.lineTo(cx - 15, cy + 4);
      ctx.lineTo(cx + 25, cy - 6);
      ctx.lineTo(cx + 60, cy + 12);
      ctx.moveTo(cx - 15, cy + 4);
      ctx.lineTo(cx - 5, cy + 28);
      ctx.moveTo(cx + 25, cy - 6);
      ctx.lineTo(cx + 35, cy - 24);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Multi-layer Swirling Blizzard Snowflakes
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 16; i++) {
        const sx = x + ((i * 29 + t * (25 + (i % 3) * 15)) % w);
        const sy = y + ((i * 19 + t * (35 + (i % 2) * 10)) % h);
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 3) * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pat === 'sakura_petals') {
      // Sakura Zen Sanctuary: Vermillion Torii Gate, stone lanterns & falling blossom petals
      // Traditional Vermillion Torii Gate in Center
      ctx.fillStyle = '#E11D48';
      ctx.shadowColor = '#BE123C';
      ctx.shadowBlur = 8;
      // Columns & Base
      ctx.fillRect(cx - 26, y + 16, 6, 38);
      ctx.fillRect(cx + 20, y + 16, 6, 38);
      // Top Crossbars (Kasagi and Shimaki)
      ctx.fillRect(cx - 38, y + 12, 76, 5);
      ctx.fillRect(cx - 30, y + 22, 60, 4);
      // Black lintel ridge
      ctx.fillStyle = '#18181B';
      ctx.fillRect(cx - 40, y + 10, 80, 3);
      ctx.shadowBlur = 0;

      // Stone Lanterns on flanks with warm flame glow
      for (const lx of [x + 18, x + w - 18]) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(lx - 4, y + h - 22, 8, 14);
        ctx.fillRect(lx - 7, y + h - 26, 14, 5);
        ctx.fillStyle = '#FDE047';
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 10;
        ctx.fillRect(lx - 3, y + h - 21, 6, 6);
        ctx.shadowBlur = 0;
      }

      // Tumbling Pink Cherry Blossom Petals
      ctx.fillStyle = '#F472B6';
      for (let i = 0; i < 14; i++) {
        const px = x + ((i * 27 + t * 24 + Math.sin(t * 2 + i) * 12) % w);
        const py = y + ((i * 17 + t * 28) % h);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(t * 2 + i);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.5, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (pat === 'volcanic_fissures') {
      // Molten Obsidian Core: Basalt plates, glowing liquid lava rivers & volcanic embers
      // Dark Basalt Rock Floor plates
      ctx.fillStyle = '#0F0906';
      ctx.fillRect(x, y, w, h);

      // Glowing Liquid Lava Magma Fissures
      ctx.strokeStyle = '#F97316';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 22);
      ctx.lineTo(cx - 20, cy - 4);
      ctx.lineTo(cx + 15, cy + 10);
      ctx.lineTo(x + w - 10, y + h - 18);
      ctx.moveTo(cx - 20, cy - 4);
      ctx.lineTo(cx - 42, y + h - 14);
      ctx.stroke();

      // Molten yellow core filament inside lava
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Flying Volcanic Fire Embers
      for (let i = 0; i < 12; i++) {
        const ex = x + 16 + ((i * 31 + Math.sin(t * 4 + i) * 14) % (w - 32));
        const ey = y + h - ((t * 40 + i * 22) % h);
        ctx.fillStyle = i % 2 === 0 ? '#FBBF24' : '#EF4444';
        ctx.beginPath();
        ctx.arc(ex, ey, 2 + (i % 3) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pat === 'haunted_dungeon') {
      // Spooky Crypt Catacombs: Flagstones, gargoyle torches, witchfire & ectoplasm mist
      // Cobblestone flagstone grid
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
      ctx.lineWidth = 1;
      for (let px = x + 24; px < x + w; px += 28) {
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px, y + h);
        ctx.stroke();
      }
      for (let py = y + 20; py < y + h; py += 22) {
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x + w, py);
        ctx.stroke();
      }

      // Rolling Supernatural Green Ectoplasm Mist
      const mistGrad = ctx.createLinearGradient(x, y + h - 30, x, y + h);
      mistGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
      mistGrad.addColorStop(1, 'rgba(16, 185, 129, 0.35)');
      ctx.fillStyle = mistGrad;
      ctx.fillRect(x, y + h - 30, w, 30);

      // 3 Gothic Stone Torch Sconces with Dancing Witchfire Flames
      for (const tx of [x + 28, cx, x + w - 28]) {
        // Iron bracket
        ctx.fillStyle = '#334155';
        ctx.fillRect(tx - 3, y + 20, 6, 16);
        // Witchfire emerald flame
        const flamePulse = Math.sin(t * 12 + tx) * 2;
        ctx.fillStyle = '#10B981';
        ctx.shadowColor = '#34D399';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(tx, y + 17 + flamePulse, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A7F3D0';
        ctx.beginPath();
        ctx.arc(tx, y + 17 + flamePulse, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // Floating Translucent Spectral Wisps
      for (let i = 0; i < 3; i++) {
        const wx = cx + Math.sin(t * 2 + i * 2.1) * (w * 0.35);
        const wy = cy + Math.cos(t * 1.8 + i) * 16;
        ctx.fillStyle = 'rgba(167, 243, 208, 0.25)';
        ctx.beginPath();
        ctx.arc(wx, wy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pat === 'atlantis_deep') {
      // Sunken Atlantis Trench: Caustics light rays, sunken pillars, kelp forest & bubbles
      // Dynamic Underwater Sunlight Caustics
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.28)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + 18 + i * 22);
        ctx.quadraticCurveTo(cx, y + 8 + i * 22 + Math.sin(t * 2.5 + i) * 12, x + w, y + 18 + i * 22);
        ctx.stroke();
      }

      // Sunken Greek Ruin Columns
      for (const colX of [x + 32, x + w - 32]) {
        ctx.fillStyle = '#0E7490';
        ctx.fillRect(colX - 6, y + 18, 12, h - 36);
        ctx.fillStyle = '#155E75';
        ctx.fillRect(colX - 8, y + 14, 16, 5);
        ctx.fillRect(colX - 8, y + h - 22, 16, 5);
      }

      // Swaying Emerald Giant Kelp Fronds
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 3.5;
      for (let k = 0; k < 6; k++) {
        const kx = x + 20 + k * 44;
        const sway = Math.sin(t * 3 + k * 1.2) * 14;
        ctx.beginPath();
        ctx.moveTo(kx, y + h);
        ctx.quadraticCurveTo(kx + sway, y + h - 24, kx + sway * 0.5, y + h - 46);
        ctx.stroke();
      }

      // Rising Shimmering Air Bubbles
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const bx = x + ((i * 33 + Math.sin(t * 3 + i) * 10) % (w - 20)) + 10;
        const by = y + h - ((t * 30 + i * 24) % h);
        ctx.beginPath();
        ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (pat === 'gilded_inlays') {
      // Imperial Gilded Colosseum: Carrara marble, 24K gold Greek key border, laurel wreath
      // Marble Tile Floor
      ctx.fillStyle = '#1C160C';
      ctx.fillRect(x, y, w, h);

      // 24K Gold Mosaic Border & Greek Key Pattern
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#FBBF24';
      ctx.shadowBlur = 8;
      ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
      ctx.shadowBlur = 0;

      // 4 Polished Golden Corner Pedestals
      for (const [px, py] of [[x + 16, y + 16], [x + w - 16, y + 16], [x + 16, y + h - 16], [x + w - 16, y + h - 16]]) {
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(px - 4, py - 4, 8, 8);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }

      // Central Imperial Golden Laurel Wreath Medallion
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.stroke();

      // Laurel Leaves along circle
      ctx.fillStyle = '#FEF08A';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        const lx = cx + Math.cos(a) * 26;
        const ly = cy + Math.sin(a) * 26;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(a + Math.PI / 4);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Center Sunburst Star
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (pat === 'space_hull') {
      // Orbital Star Cruiser: Deep space viewport, drifting starfield, hazard beacons & cyan forcefield
      // Panoramic Deep Space Starfield & Nebula
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 22; i++) {
        const starX = x + ((i * 37 + t * 8) % w);
        const starY = y + ((i * 23) % h);
        const starSize = (i % 3 === 0 ? 2 : 1);
        ctx.fillRect(starX, starY, starSize, starSize);
      }

      // Titanium Viewport Airlock Ring
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#0284C7';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Hexagonal Forcefield Perimeter Lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.2;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32);
        ctx.lineTo(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52);
        ctx.stroke();
      }

      // Dual Sweeping Orange Hazard Warning Beacons
      const beaconAngle = t * 4;
      for (const bx of [x + 20, x + w - 20]) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(bx - 4, y + 10, 8, 8);
        const bGrad = ctx.createRadialGradient(bx, y + 14, 2, bx, y + 14, 18);
        bGrad.addColorStop(0, '#F59E0B');
        bGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(bx, y + 14, 16, beaconAngle, beaconAngle + Math.PI * 0.7);
        ctx.lineTo(bx, y + 14);
        ctx.fill();
      }
    } else if (pat === 'steampunk_forge') {
      // Steampunk Clockwork Forge: 3 Interlocking gears at exact ratios, molten grates, steam plumes
      // Molten furnace grate floor below
      ctx.fillStyle = '#1A0C04';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
      for (let gy = y + 12; gy < y + h; gy += 14) {
        ctx.fillRect(x + 12, gy, w - 24, 3);
      }

      // 3 Meshing Brass Clockwork Gears with Exact Teeth Ratios (1, -1.5, 2)
      const gearList = [
        { gx: cx - 28, gy: cy - 2, r: 22, speed: 1.2, teeth: 12 },
        { gx: cx + 18, gy: cy - 14, r: 15, speed: -1.76, teeth: 8 },
        { gx: cx + 22, gy: cy + 18, r: 12, speed: 2.2, teeth: 6 }
      ];
      for (const g of gearList) {
        ctx.save();
        ctx.translate(g.gx, g.gy);
        ctx.rotate(t * g.speed);
        // Outer Gear Body
        ctx.fillStyle = '#B45309';
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, g.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Gear Teeth
        for (let i = 0; i < g.teeth; i++) {
          const a = (i * Math.PI * 2) / g.teeth;
          ctx.fillStyle = '#FDE047';
          ctx.fillRect(Math.cos(a) * g.r - 2.5, Math.sin(a) * g.r - 2.5, 5, 5);
        }
        // Center Axle Rivet
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Venting Steam Clouds from corner pipes
      for (const sx of [x + 18, x + w - 18]) {
        const steamY = y + h - 14 - ((t * 28 + sx) % (h * 0.7));
        ctx.fillStyle = 'rgba(254, 243, 199, 0.45)';
        ctx.beginPath();
        ctx.arc(sx + Math.sin(t * 5) * 4, steamY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pat === 'jade_dragon') {
      // Jade Dragon Sanctuary: Coiling serpentine emerald dragon, jade scales & golden lanterns
      // Coiling Ethereal Emerald Dragon Body
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#34D399';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let xPos = x + 16; xPos <= x + w - 16; xPos += 8) {
        const yPos = cy + Math.sin(xPos * 0.05 + t * 3.5) * 16;
        if (xPos === x + 16) ctx.moveTo(xPos, yPos);
        else ctx.lineTo(xPos, yPos);
      }
      ctx.stroke();

      // Dragon Golden Dorsal Crest
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Two Ornate Chinese Hanging Red Lanterns with Gold Tassels
      for (const lx of [x + 26, x + w - 26]) {
        const sway = Math.sin(t * 2 + lx) * 3;
        // Cord
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, y);
        ctx.lineTo(lx + sway, y + 16);
        ctx.stroke();
        // Lantern Hexagon
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(lx + sway - 6, y + 16, 12, 14);
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(lx + sway - 8, y + 14, 16, 3);
        ctx.fillRect(lx + sway - 8, y + 29, 16, 3);
        // Tassel
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx + sway, y + 32);
        ctx.lineTo(lx + sway, y + 42);
        ctx.stroke();
      }
    } else if (pat === 'pinball_matrix') {
      // Hyper-Pinball Bumper Matrix: Pop bumpers, flipper guides, 1000-PT flash rings & rollover lanes
      // Pop Bumpers with Pulsing Glow & Star Inserts
      const bumperData = [
        { bx: cx - 36, by: cy - 14, c: '#EC4899', score: '1000' },
        { bx: cx + 36, by: cy - 14, c: '#06B6D4', score: '1000' },
        { bx: cx, by: cy + 18, c: '#F59E0B', score: '5000' }
      ];
      for (const b of bumperData) {
        const pulse = 1 + Math.max(0, Math.sin(t * 8 + b.bx)) * 0.18;
        ctx.fillStyle = b.c;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.shadowColor = b.c;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(b.bx, b.by, 13 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Inner Chrome Rim
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.bx, b.by, 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Neon Rollover Lane Arrows (▲ ▲ ▲)
      for (let i = 0; i < 3; i++) {
        const ax = cx - 22 + i * 22;
        const ay = y + 16;
        ctx.fillStyle = (Math.floor(t * 6) % 3 === i) ? '#FDE047' : 'rgba(253, 224, 71, 0.3)';
        ctx.beginPath();
        ctx.moveTo(ax, ay - 4);
        ctx.lineTo(ax + 4, ay + 3);
        ctx.lineTo(ax - 4, ay + 3);
        ctx.closePath();
        ctx.fill();
      }

      // Chrome Wire Ball Return Rails at Bottom
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 14, y + h - 14);
      ctx.lineTo(cx - 18, y + h - 6);
      ctx.moveTo(x + w - 14, y + h - 14);
      ctx.lineTo(cx + 18, y + h - 6);
      ctx.stroke();
    } else if (pat === 'biolum_jungle') {
      // Bioluminescent Avatar Grove: Giant glowing alien mushrooms, hanging liana vines & spirit spores
      // Hanging Bioluminescent Liana Vines from Ceiling
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      for (let v = 0; v < 4; v++) {
        const vx = x + 24 + v * 52;
        ctx.beginPath();
        ctx.moveTo(vx, y);
        ctx.quadraticCurveTo(vx + Math.sin(t * 2 + v) * 8, y + 16, vx, y + 26 + (v % 2) * 8);
        ctx.stroke();
        // Glowing dewdrop bud
        ctx.fillStyle = '#2DD4BF';
        ctx.beginPath();
        ctx.arc(vx, y + 26 + (v % 2) * 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3 Giant Bioluminescent Mushrooms with Glowing Gills
      const shroomList = [
        { mx: cx - 42, my: y + h - 10, c: '#2DD4BF', r: 16, stalkH: 18 },
        { mx: cx + 2, my: y + h - 8, c: '#C084FC', r: 24, stalkH: 24 },
        { mx: cx + 44, my: y + h - 10, c: '#38BDF8', r: 15, stalkH: 16 }
      ];
      for (const m of shroomList) {
        // Stalk
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(m.mx - 3, m.my - m.stalkH, 6, m.stalkH);
        // Glowing Mushroom Cap
        ctx.fillStyle = m.c;
        ctx.shadowColor = m.c;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(m.mx, m.my - m.stalkH, m.r, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Gills underneath
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(m.mx - m.r, m.my - m.stalkH);
        ctx.lineTo(m.mx + m.r, m.my - m.stalkH);
        ctx.stroke();
      }

      // Drifting Glowing Airborne Spirit Spores
      for (let i = 0; i < 10; i++) {
        const spX = x + ((i * 31 + t * 14) % (w - 20)) + 10;
        const spY = y + ((i * 19 + Math.sin(t * 3 + i) * 12) % (h - 20)) + 10;
        ctx.fillStyle = i % 2 === 0 ? '#5EEAD4' : '#E879F9';
        ctx.beginPath();
        ctx.arc(spX, spY, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pat === 'pirate_galleon') {
      // Ghost Galleon Quarterdeck: Weathered oak planks, broadside cannons, swinging lantern & kraken tentacles
      // Weathered Oak Deck Planks & Nail Rivets
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)';
      ctx.lineWidth = 1.5;
      for (let py = y + 16; py < y + h; py += 14) {
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x + w, py);
        ctx.stroke();
        // Iron nail heads
        ctx.fillStyle = '#451A03';
        ctx.fillRect(x + 22, py - 1, 2, 2);
        ctx.fillRect(x + w - 24, py - 1, 2, 2);
      }

      // Broadside Brass Cannons along gunports
      for (const canX of [x + 26, x + w - 26]) {
        ctx.fillStyle = '#78350F';
        ctx.fillRect(canX - 5, y + h - 18, 10, 14);
        ctx.fillStyle = '#D97706';
        ctx.fillRect(canX - 3, y + h - 24, 6, 8);
      }

      // Writhing Kraken Tentacles curling over deck gunwales
      for (const tent of [{ tx: x + 12, s: 1 }, { tx: x + w - 12, s: -1 }]) {
        const sway = Math.sin(t * 3 + tent.tx) * 8;
        ctx.strokeStyle = '#065F46';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tent.tx, y + h);
        ctx.quadraticCurveTo(tent.tx + tent.s * 16 + sway, cy, tent.tx + tent.s * 6, y + 24);
        ctx.stroke();
        // Tentacle suckers
        ctx.fillStyle = '#A7F3D0';
        ctx.beginPath();
        ctx.arc(tent.tx + tent.s * 10 + sway * 0.5, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Swinging Brass Ship's Lantern with Warm Light Radial Cast
      const swayA = Math.sin(t * 2) * 0.25;
      const lx = cx + Math.sin(swayA) * 16;
      const ly = y + 26;
      // Cord
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      // Warm radial light bloom
      const bloom = ctx.createRadialGradient(lx, ly + 8, 3, lx, ly + 8, 28);
      bloom.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
      bloom.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(lx, ly + 8, 28, 0, Math.PI * 2);
      ctx.fill();
      // Lantern body
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(lx - 4, ly + 4, 8, 10);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(lx - 2, ly + 6, 4, 6);
    } else if (pat === 'cyber_tokyo') {
      // Neo-Tokyo Rooftop 2099: Skyscraper skyline, neon kanji billboards, flying spinners & laser rain
      // Distant Megacity Spires & Neon Windows
      ctx.fillStyle = '#0F172A';
      const bWidths = [28, 38, 26, 42, 32, 36, 28];
      let curBx = x + 8;
      bWidths.forEach((bw, idx) => {
        const bh = 34 + (idx % 3) * 18;
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(curBx, y + h - bh, bw - 3, bh);
        // Neon Billboard Frames
        ctx.strokeStyle = idx % 2 === 0 ? '#06B6D4' : '#EC4899';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(curBx + 4, y + h - bh + 6, bw - 11, 12);
        // Red aircraft warning beacon on top
        if (idx % 2 === 0) {
          ctx.fillStyle = Math.sin(t * 8 + idx) > 0 ? '#EF4444' : '#7F1D1D';
          ctx.fillRect(curBx + bw / 2 - 1.5, y + h - bh - 3, 3, 3);
        }
        curBx += bw;
      });

      // Flying Spinner Hovercar with Light Streaks
      const spinX = x + ((t * 60) % (w + 40)) - 20;
      const spinY = y + 20 + Math.sin(t * 4) * 4;
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(spinX, spinY, 12, 3);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(spinX - 8, spinY + 1, 8, 1.5);

      // Slanted Cyberpunk Laser Rain
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const rx = x + ((i * 24 + t * 45) % w);
        const ry = y + ((i * 19 + t * 65) % (h - 20));
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4, ry + 10);
        ctx.stroke();
      }
    } else if (pat === 'black_hole') {
      // Event Horizon Singularity: Gravitational lensing, relativistic accretion disk & polar Hawking jets
      // Dual Vertical Relativistic Polar Hawking Jets
      const jetLength = 34 + Math.sin(t * 10) * 8;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy - jetLength);
      ctx.moveTo(cx, cy + 8);
      ctx.lineTo(cx, cy + jetLength);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Swirling Relativistic Accretion Disk (3D Perspective Doppler Asymmetry)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 1.6);
      // Outer purple/violet accretion band
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#EC4899';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.ellipse(0, 0, 52, 18, 0.3, 0, Math.PI * 2);
      ctx.stroke();
      // Inner hot yellow/orange relativistic band
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 36, 12, 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Pitch-Black Event Horizon Core with Photon Sphere Ring
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pat === 'dragons_hoard') {
      // Dragon’s Golden Treasury: Shimmering gold coin mounds, rubies/emeralds, treasure chest
      // Deep Cavern Stalactites
      ctx.fillStyle = '#1C1204';
      for (let i = 0; i < 9; i++) {
        const sx = x + 14 + i * 26;
        ctx.beginPath();
        ctx.moveTo(sx - 6, y);
        ctx.lineTo(sx, y + 12 + (i % 3) * 6);
        ctx.lineTo(sx + 6, y);
        ctx.closePath();
        ctx.fill();
      }

      // Shimmering Mountains of Gold Coins
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.arc(cx - 52, y + h + 14, 52, Math.PI, 0);
      ctx.arc(cx + 52, y + h + 14, 54, Math.PI, 0);
      ctx.arc(cx, y + h + 18, 60, Math.PI, 0);
      ctx.fill();

      // Specular Gold Coin Specular Shimmer Dots
      for (let i = 0; i < 18; i++) {
        const coinX = cx - 55 + (i * 27) % 110;
        const coinY = cy + 4 + (i * 19) % 36;
        const glint = Math.sin(t * 6 + i) > 0.6;
        ctx.fillStyle = glint ? '#FEF08A' : '#F59E0B';
        ctx.beginPath();
        ctx.arc(coinX, coinY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cut Sparkling Gemstones (Rubies, Emeralds, Sapphires)
      const gems = [
        { gx: cx - 35, gy: cy + 18, c: '#EF4444' },
        { gx: cx + 32, gy: cy + 16, c: '#10B981' },
        { gx: cx - 18, gy: cy + 28, c: '#3B82F6' },
        { gx: cx + 20, gy: cy + 26, c: '#EC4899' }
      ];
      for (const gem of gems) {
        ctx.fillStyle = gem.c;
        ctx.shadowColor = gem.c;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(gem.gx, gem.gy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Center Royal Treasure Chest with Golden Banding
      ctx.fillStyle = '#78350F';
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 2;
      ctx.fillRect(cx - 18, cy - 6, 36, 22);
      ctx.strokeRect(cx - 18, cy - 6, 36, 22);
      // Keyhole / Padlock
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(cx - 3, cy + 3, 6, 6);
    } else if (pat === 'olympus_pantheon') {
      // Mount Olympus Cloud Pantheon: Corinthian marble columns, billowing clouds & Zeus lightning
      // Mount Olympus Twilight Gradient Sky is backdrop
      // 4 Classical Fluted Corinthian White Marble Columns
      for (const colX of [x + 22, x + 54, x + w - 54, x + w - 22]) {
        // Pediment Capital & Base
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(colX - 8, y + 12, 16, 5);
        ctx.fillRect(colX - 8, y + h - 18, 16, 5);
        // Column Shaft
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(colX - 6, y + 17, 12, h - 35);
        // Fluting lines
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colX - 2, y + 17);
        ctx.lineTo(colX - 2, y + h - 18);
        ctx.moveTo(colX + 2, y + 17);
        ctx.lineTo(colX + 2, y + h - 18);
        ctx.stroke();
      }

      // Billowing Volumetric Divine Cloud Banks rolling across floor
      ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';
      for (let i = 0; i < 7; i++) {
        const clX = x + 18 + i * 28 + Math.sin(t * 1.5 + i) * 6;
        const clY = y + h - 14;
        ctx.beginPath();
        ctx.arc(clX, clY, 14 + (i % 3) * 4, Math.PI, 0);
        ctx.fill();
      }

      // Zeus Golden Thunderbolts crackling dynamically
      if (Math.sin(t * 8) > 0.4) {
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(cx - 24, y + 14);
        ctx.lineTo(cx - 8, cy - 2);
        ctx.lineTo(cx - 14, cy + 2);
        ctx.lineTo(cx + 12, cy + 18);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    } else if (pat === 'synth_drift') {
      // Hyper-Grid Cyber Tunnel: 3D Cyberspace Tunnel with Wireframe Arches & Speedlines
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 8;
      for (let i = 1; i <= 4; i++) {
        const scale = ((t * 0.6 + i * 0.25) % 1);
        const rw = w * 0.9 * scale;
        const rh = h * 0.8 * scale;
        ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);
      }
      ctx.shadowBlur = 0;
      // Perspective convergence lines to center
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
      ctx.lineWidth = 1.2;
      for (const [cornerX, cornerY] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
        ctx.beginPath();
        ctx.moveTo(cornerX, cornerY);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
    } else if (pat === 'crystal_cavern') {
      // Amethyst Crystal Geode: Jagged quartz stalactites, central geode pool & floating crystal dust
      ctx.fillStyle = '#C084FC';
      ctx.strokeStyle = '#E9D5FF';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const qx = x + 20 + i * 36;
        const qh = 16 + (i % 3) * 8;
        ctx.beginPath();
        ctx.moveTo(qx - 6, y);
        ctx.lineTo(qx, y + qh);
        ctx.lineTo(qx + 6, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(qx - 6, y + h);
        ctx.lineTo(qx, y + h - qh);
        ctx.lineTo(qx + 6, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Glowing Geode Pool in Center
      ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 42, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (pat === 'inferno_caldera') {
      // Hellfire Dragon Caldera: Volcanic crater with obsidian dragon statues & erupting fire embers
      ctx.fillStyle = '#1C0603';
      ctx.fillRect(x, y, w, h);
      // Boiling Lava Lake
      ctx.fillStyle = '#EA580C';
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, 64, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Rising Fire Embers
      for (let i = 0; i < 12; i++) {
        const ex = x + 20 + ((i * 26 + t * 40) % (w - 40));
        const ey = y + h - ((t * 45 + i * 22) % h);
        ctx.fillStyle = i % 2 === 0 ? '#FBBF24' : '#EF4444';
        ctx.beginPath();
        ctx.arc(ex, ey, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pat === 'cyber_dojo') {
      // Neo-Shogun Cyber Dojo: Neon tatami floor, shoji sliding screens & cyber bonsai
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1.2;
      for (let tx = x + 16; tx < x + w; tx += 28) {
        ctx.strokeRect(tx, y + 16, 26, h - 32);
      }
      // Cybernetic Bonsai in Center
      ctx.fillStyle = '#065F46';
      ctx.fillRect(cx - 3, cy - 8, 6, 22);
      ctx.fillStyle = '#EC4899';
      ctx.shadowColor = '#EC4899';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy - 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // Modern Clean Slate: Sleek esports stadium with perimeter LED ribbon, rotating spotlights & cyber crest
      // Subtle Cyber Floor Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1;
      for (let gx = x + 18; gx < x + w; gx += 20) {
        ctx.beginPath();
        ctx.moveTo(gx, y + 14);
        ctx.lineTo(gx, y + h - 14);
        ctx.stroke();
      }
      for (let gy = y + 18; gy < y + h; gy += 18) {
        ctx.beginPath();
        ctx.moveTo(x + 14, gy);
        ctx.lineTo(x + w - 14, gy);
        ctx.stroke();
      }

      // High-Contrast Competition Boundary with Rounded Bumpers
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 14, y + 14, w - 28, h - 28);

      // Sweeping Stadium Spotlight Beams
      const spotA1 = t * 1.8;
      const spotA2 = -t * 1.5;
      const spotGrad1 = ctx.createRadialGradient(cx, cy, 4, cx + Math.cos(spotA1) * 36, cy + Math.sin(spotA1) * 22, 32);
      spotGrad1.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
      spotGrad1.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = spotGrad1;
      ctx.beginPath();
      ctx.arc(cx, cy, 38, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Center Competition Logo Crest & Crosshairs
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#0284C7';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 28, cy);
      ctx.lineTo(cx + 28, cy);
      ctx.moveTo(cx, cy - 28);
      ctx.lineTo(cx, cy + 28);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Center Dot
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Perimeter LED Ticker Tape (Top and Bottom)
      for (let tx = x + 18; tx < x + w - 18; tx += 12) {
        const lit = (Math.floor(t * 8) + Math.floor(tx / 12)) % 3 === 0;
        ctx.fillStyle = lit ? '#38BDF8' : 'rgba(56, 189, 248, 0.2)';
        ctx.fillRect(tx, y + 8, 6, 2);
        ctx.fillRect(tx, y + h - 10, 6, 2);
      }
    }

    ctx.restore();
  }

  private renderMiniArenaIcon(ctx: CanvasRenderingContext2D, pattern: string, cx: number, cy: number, borderColor: string) {
    ctx.save();
    if (pattern === 'synth_grid' || pattern === 'synthwave_highway' || pattern === 'synth_drift') {
      const sGrad = ctx.createLinearGradient(cx, cy - 6, cx, cy + 6);
      sGrad.addColorStop(0, '#FDE047');
      sGrad.addColorStop(1, '#EC4899');
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 6, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 2);
      ctx.lineTo(cx + 8, cy + 2);
      ctx.moveTo(cx - 6, cy + 5);
      ctx.lineTo(cx + 6, cy + 5);
      ctx.stroke();
    } else if (pattern === 'matrix_rain') {
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('01', cx, cy);
    } else if (pattern === 'arcade_cabinet') {
      ctx.fillStyle = '#A855F7';
      ctx.fillRect(cx - 6, cy - 6, 12, 12);
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
    } else if (pattern === 'candy_land') {
      ctx.fillStyle = '#EC4899';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'ice_crystals') {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
      ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
      ctx.stroke();
    } else if (pattern === 'sakura_petals') {
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 5, 2.5, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'volcanic_fissures' || pattern === 'inferno_caldera') {
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + 5, cy + 5);
      ctx.lineTo(cx - 5, cy + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'haunted_dungeon') {
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#A7F3D0';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'atlantis_deep') {
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI);
      ctx.stroke();
    } else if (pattern === 'gilded_inlays') {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'space_hull') {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 5, cy - 5, 10, 10);
    } else if (pattern === 'steampunk_forge') {
      ctx.fillStyle = '#B45309';
      ctx.strokeStyle = '#FDE68A';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (pattern === 'jade_dragon') {
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 1.5);
      ctx.stroke();
    } else if (pattern === 'pinball_matrix') {
      ctx.fillStyle = '#EC4899';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'biolum_jungle') {
      ctx.fillStyle = '#2DD4BF';
      ctx.beginPath();
      ctx.arc(cx, cy - 1, 5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(cx - 1, cy - 1, 2, 6);
    } else if (pattern === 'pirate_galleon') {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    } else if (pattern === 'cyber_tokyo') {
      ctx.fillStyle = '#06B6D4';
      ctx.fillRect(cx - 6, cy - 6, 4, 12);
      ctx.fillStyle = '#EC4899';
      ctx.fillRect(cx - 1, cy - 3, 4, 9);
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(cx + 4, cy - 7, 3, 13);
    } else if (pattern === 'black_hole') {
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (pattern === 'dragons_hoard') {
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'olympus_pantheon') {
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + 3, cy - 1);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 3, cy + 6);
      ctx.lineTo(cx - 2, cy + 1);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
    } else if (pattern === 'crystal_cavern') {
      ctx.fillStyle = '#C084FC';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + 4, cy + 6);
      ctx.lineTo(cx - 4, cy + 6);
      ctx.closePath();
      ctx.fill();
    } else if (pattern === 'cyber_dojo') {
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 5, cy - 5, 10, 10);
      ctx.fillStyle = '#EC4899';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 5, cy - 5, 10, 10);
    }
    ctx.restore();
  }

  public openGameModal(index: number) {
    if (index >= 0 && index < GAME_CATALOG.length) {
      this.modalGameIndex = index;
      this.selectedGameIndex = index;
      this.isModalOpen = true;
      this.audio.playTap();
    }
  }

  public openGameModalById(id: string) {
    const idx = GAME_CATALOG.findIndex((g) => g.id === id);
    if (idx !== -1) {
      this.openGameModal(idx);
    }
  }

  public closeGameModal() {
    this.isModalOpen = false;
    this.audio.playTap();
  }

  public loadSettings() {
    try {
      const saved = localStorage.getItem('antigravity_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.masterVolume === 'number' && !isNaN(parsed.masterVolume)) {
            this.settings.masterVolume = Math.max(0, Math.min(1, parsed.masterVolume));
          }
          if (typeof parsed.sfxEnabled === 'boolean') {
            this.settings.sfxEnabled = parsed.sfxEnabled;
          }
          if (typeof parsed.gameSpeed === 'number' && !isNaN(parsed.gameSpeed)) {
            this.settings.gameSpeed = Math.max(0.5, Math.min(2.0, parsed.gameSpeed));
          }
          if (typeof parsed.tournamentGoal === 'number' && !isNaN(parsed.tournamentGoal)) {
            this.settings.tournamentGoal = Math.max(1, Math.min(20, parsed.tournamentGoal));
          }
          if (typeof parsed.shakeLevel === 'string' && ['full', 'reduced', 'off'].includes(parsed.shakeLevel)) {
            this.settings.shakeLevel = parsed.shakeLevel;
          }
        }
      }
    } catch {
      // localStorage may be unavailable or corrupted
    }
    this.applySettings();
  }

  public saveSettings() {
    try {
      localStorage.setItem('antigravity_settings', JSON.stringify(this.settings));
    } catch {
      // localStorage may be unavailable
    }
    this.applySettings();
  }

  public applySettings() {
    this.audio.setMasterVolume(this.settings.masterVolume);
    this.audio.setSfxEnabled(this.settings.sfxEnabled);
    this.gameSpeedMultiplier = this.settings.gameSpeed;
    this.tournamentGoalPoints = this.settings.tournamentGoal;
    this.particles.shakeIntensity = this.settings.shakeLevel === 'full' ? 1.0 : this.settings.shakeLevel === 'reduced' ? 0.5 : 0.0;
  }

  public toggleSettings() {
    this.isSettingsOpen = !this.isSettingsOpen;
    if (this.isSettingsOpen) {
      this.isModalOpen = false;
      this.isShopOpen = false;
    }
    this.audio.playTap();
  }

  public openSettings() {
    this.isSettingsOpen = true;
    this.isModalOpen = false;
    this.isShopOpen = false;
    this.audio.playTap();
  }

  public closeSettings() {
    this.isSettingsOpen = false;
    this.saveSettings();
    this.audio.playTap();
  }

  public toggleShop() {
    this.isShopOpen = !this.isShopOpen;
    if (this.isShopOpen) {
      this.isModalOpen = false;
      this.isSettingsOpen = false;
      this.isTrophiesOpen = false;
      this.selectedShopItemIndex = 0;
      this.selectedShopSkinIndex = 0;
      this.targetShopScrollY = 0;
      this.packOpeningResult = null;
    }
    this.audio.playTap();
  }

  public openShop() {
    this.isShopOpen = true;
    this.isModalOpen = false;
    this.isSettingsOpen = false;
    this.isTrophiesOpen = false;
    this.selectedShopItemIndex = 0;
    this.selectedShopSkinIndex = 0;
    this.targetShopScrollY = 0;
    this.packOpeningResult = null;
    this.audio.playTap();
  }

  public closeShop() {
    this.isShopOpen = false;
    this.packOpeningResult = null;
    this.audio.playTap();
  }

  public toggleTrophies() {
    this.isTrophiesOpen = !this.isTrophiesOpen;
    if (this.isTrophiesOpen) {
      this.isModalOpen = false;
      this.isSettingsOpen = false;
      this.isShopOpen = false;
    }
    this.audio.playTap();
  }

  public openTrophies() {
    this.isTrophiesOpen = true;
    this.isModalOpen = false;
    this.isSettingsOpen = false;
    this.isShopOpen = false;
    this.audio.playTap();
  }

  public closeTrophies() {
    this.isTrophiesOpen = false;
    this.audio.playTap();
  }

  public resetScores() {
    this.players.forEach((p) => (p.score = 0));
    this.tournamentLeaderboard.forEach((l) => (l.points = 0));
    this.audio.playTap();
  }

  public restoreDefaultSettings() {
    this.settings = {
      masterVolume: 0.75,
      sfxEnabled: true,
      gameSpeed: 1.0,
      tournamentGoal: 3,
      shakeLevel: 'full'
    };
    this.saveSettings();
    this.audio.playFanfare();
  }

  public setDeviceMode(mode: DevicePlatformMode) {
    if (this.deviceMode === mode) return;
    this.deviceMode = mode;
    if (this.input) {
      this.input.setDeviceMode(mode);
      this.syncInputActivePlayers();
    }
    this.catalogFilterDirty = true;
    if (this.state === 'LOBBY') {
      this.selectedGameIndex = 0;
      this.scrollY = 0;
      this.targetScrollY = 0;
    }

    if (typeof document !== 'undefined') {
      const btnComp = document.getElementById('btn-mode-computer');
      const btnPhone = document.getElementById('btn-mode-phone');
      if (btnComp && btnPhone) {
        btnComp.classList.toggle('active', mode === 'computer');
        btnPhone.classList.toggle('active', mode === 'phone');
      }
      document.body.classList.toggle('phone-platform-mode', mode === 'phone');
      document.body.classList.toggle('phone-mode', mode === 'phone');
    }

    this.audio.playTap();
  }

  public syncInputActivePlayers() {
    if (!this.input) return;
    const mask: Record<PlayerId, boolean> = {
      0: this.players[0]?.type !== 'disabled',
      1: this.players[1]?.type !== 'disabled',
      2: this.players[2]?.type !== 'disabled',
      3: this.players[3]?.type !== 'disabled'
    };
    const humanMask: Record<PlayerId, boolean> = {
      0: this.players[0]?.type === 'human',
      1: this.players[1]?.type === 'human',
      2: this.players[2]?.type === 'human',
      3: this.players[3]?.type === 'human'
    };
    this.input.setActivePlayerMask(mask, humanMask);
    const activeCount = this.players.filter((p) => p.type !== 'disabled').length;
    if (this.splitBracketStage === 'final' && this.splitBracketTopWinner !== null && this.splitBracketBotWinner !== null) {
      this.input.setPhoneTouchLayout('2p_final', [this.splitBracketTopWinner, this.splitBracketBotWinner]);
    } else if (activeCount <= 2) {
      this.input.setPhoneTouchLayout('2p_faceoff');
    } else {
      this.input.setPhoneTouchLayout('4p_corners');
    }
  }

  public setPlayerCount(count: number) {
    // 0: 1P SOLO (P1 Human only, no CPU bots!)
    // 1: 1P V AI (P1 Human, P2 Bot using global difficulty, P3/P4 Disabled)
    // 2: 2P (P1 Human, P2 Human, P3/P4 Disabled)
    // 3: 3P (P1, P2, P3 Human, P4 Disabled)
    // 4: 4P (P1, P2, P3, P4 Human)
    if (count === 0) {
      this.players[0].type = 'human';
      this.players[1].type = 'disabled';
      this.players[2].type = 'disabled';
      this.players[3].type = 'disabled';
      this.lodeRunnerSoloMode = true;
    } else if (count === 1) {
      this.players[0].type = 'human';
      this.players[1].type = this.globalBotDifficulty;
      this.players[2].type = 'disabled';
      this.players[3].type = 'disabled';
      this.lodeRunnerSoloMode = false;
    } else {
      for (let i = 0; i < 4; i++) {
        this.players[i].type = i < count ? 'human' : 'disabled';
      }
      this.lodeRunnerSoloMode = false;
    }
    this.catalogFilterDirty = true;
    if (this.state === 'LOBBY') {
      this.selectedGameIndex = 0;
      this.scrollY = 0;
      this.targetScrollY = 0;
    }
    this.syncInputActivePlayers();
  }

  public togglePlayerSlot(id: PlayerId) {
    const p = this.players[id];
    const cycle: PlayerType[] = ['human', 'bot_easy', 'bot_normal', 'bot_hard', 'disabled'];
    const curIdx = cycle.indexOf(p.type);
    p.type = cycle[(curIdx + 1) % cycle.length];
    this.catalogFilterDirty = true;
    this.syncInputActivePlayers();
    this.audio.playTap();
  }

  public setSelectedCategory(cat: string) {
    this.selectedCategory = cat;
    this.catalogFilterDirty = true;
    this.selectedGameIndex = 0;
    this.scrollY = 0;
    this.targetScrollY = 0;
    this.audio.playTap();
  }

  public setCatalogSortMode(mode: CatalogSortMode) {
    this.catalogSortMode = mode;
    this.catalogFilterDirty = true;
    this.selectedGameIndex = 0;
    this.scrollY = 0;
    this.targetScrollY = 0;
    this.audio.playTap();
  }

  public cycleCatalogSortMode() {
    const order: CatalogSortMode[] = ['default', 'rating', 'highscore', 'saved', 'most_played'];
    const idx = order.indexOf(this.catalogSortMode);
    this.setCatalogSortMode(order[(idx + 1) % order.length]);
  }

  public rateGame(gameId: string, stars: number) {
    this.cloud.setRating(gameId, stars);
    this.catalogFilterDirty = true;
    this.audio.playCoin();
  }

  public toggleSaveGame(gameId: string): boolean {
    const isNowSaved = this.cloud.toggleSave(gameId);
    this.catalogFilterDirty = true;
    if (isNowSaved) {
      this.audio.playCoin();
    } else {
      this.audio.playTap();
    }
    return isNowSaved;
  }

  public getGalleryLayout(w: number = this.logicalWidth, h: number = this.logicalHeight) {
    const isNarrowHeader = w < 920;
    const galleryY = isNarrowHeader ? 206 : 178;
    const isDesktopSideCards = w >= 1180;
    const galleryH = Math.max(120, h - galleryY - (isDesktopSideCards ? 86 : 98));
    const galleryX = isDesktopSideCards ? 198 : 16;
    const galleryW = Math.max(240, isDesktopSideCards ? w - 396 : w - 32);

    let cols: number;
    let gap: number;
    let cardW: number;
    let cardH: number;

    if (w < 600) {
      cols = 2;
      gap = 10;
      cardW = Math.floor((galleryW - (cols - 1) * gap) / cols);
      cardH = Math.round(cardW * 1.05);
    } else {
      gap = 16;
      const targetCardW = 195;
      cols = Math.max(2, Math.floor((galleryW + gap) / (targetCardW + gap)));
      cardW = Math.min(222, Math.floor((galleryW - (cols - 1) * gap) / cols));
      cardH = 205;
    }

    const totalGridW = cols * cardW + (cols - 1) * gap;
    const startX = galleryX + Math.max(0, Math.floor((galleryW - totalGridW) / 2));

    return {
      isNarrowHeader,
      isDesktopSideCards,
      galleryX,
      galleryY,
      galleryW,
      galleryH,
      cols,
      gap,
      cardW,
      cardH,
      totalGridW,
      startX
    };
  }

  public getGalleryCols(): number {
    return this.getGalleryLayout().cols;
  }

  public scrollToGame(index: number) {
    const { cols, cardH, gap } = this.getGalleryLayout();
    const row = Math.floor(index / cols);
    const targetY = row * (cardH + gap);
    this.targetScrollY = Math.max(0, Math.min(this.maxScrollY, targetY - 40));
  }

  public getFilteredCatalog(): MinigameMetadata[] {
    if (!this.catalogFilterDirty && this.cachedFilteredCatalog) {
      return this.cachedFilteredCatalog;
    }

    const activeCount = this.players.filter((p) => p.type !== 'disabled').length;

    let list = GAME_CATALOG.filter((g) => {
      const pMode = g.phoneMode || getGamePhoneMode(g.id);
      if (this.deviceMode === 'computer') {
        // On Computer mode, hide phone-exclusive games
        return pMode !== 'phone_only';
      } else {
        // On Phone mode:
        // 1. Hide pc_only games that aren't feasible on a phone screen
        if (pMode === 'pc_only') return false;
        // 2. If 3 or 4 players are active, hide 2p_only games (they only show when 1P v AI or 2P is selected!)
        if (activeCount >= 3 && pMode === '2p_only') return false;
        return true;
      }
    });

    if (this.selectedCategory !== 'ALL') {
      list = list.filter((g) => g.category.toUpperCase() === this.selectedCategory.toUpperCase());
    }
    if (this.searchQuery.trim().length > 0) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter((g) =>
        g.title.toLowerCase().includes(q) ||
        g.tagline.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q)
      );
    }

    // Apply Firebase / Cloud Ranking Sort Mode (Rating, High Score, Saved, Most Played)
    list = this.cloud.sortCatalog(list, this.catalogSortMode);

    this.cachedFilteredCatalog = list;
    this.catalogFilterDirty = false;
    return list;
  }

  public startRandomGame() {
    const list = this.getFilteredCatalog();
    const chosen = list[Math.floor(Math.random() * list.length)] || GAME_CATALOG[0];
    this.audio.playFanfare();
    this.startGame(chosen.id);
  }

  public startCupTournament() {
    this.isTournament = true;
    this.tournamentGoalPoints = this.settings.tournamentGoal || 3;
    this.players.forEach((p) => (p.score = 0));
    this.audio.playFanfare();
    this.startRandomGame();
  }

  public returnToLobby() {
    if (this.activeGame) {
      this.activeGame.destroy();
      this.activeGame = null;
    }
    if (this.secondarySplitGame) {
      this.secondarySplitGame.destroy();
      this.secondarySplitGame = null;
    }
    this.splitBracketStage = 'none';
    this.splitBracketTopWinner = null;
    this.splitBracketBotWinner = null;
    if (this.input) {
      this.input.isInGame = false;
      this.input.resetAll();
      this.input.setControlMode('directional');
      this.syncInputActivePlayers();
    }
    this.state = 'LOBBY';
    this.audio.playTap();
  }

  public exitPodiumToLobby() {
    this.players.forEach((p) => (p.score = 0));
    this.isTournament = false;
    this.returnToLobby();
  }

  public handleGlobalKey(key: string): void {
    if (this.isTrophiesOpen) {
      if (key === 'Escape' || key === 'Enter' || key === ' ' || key === 't' || key === 'T') {
        this.closeTrophies();
      }
      return;
    }

    if (this.isShopOpen) {
      if (this.packOpeningResult) {
        if (key === 'Escape' || key === 'Enter' || key === ' ') {
          this.packOpeningResult = null;
          this.audio.playTap();
        }
        return;
      }

      const items = this.getUnifiedShopItems();
      const tabs: ('ALL' | 'SKINS' | 'ARENAS' | 'PACKS' | 'BOOSTERS')[] = ['ALL', 'SKINS', 'ARENAS', 'PACKS', 'BOOSTERS'];

      if (key === 'Escape' || key === 'b' || key === 'B') {
        this.closeShop();
      } else if (key === 'Tab') {
        const curTabIdx = tabs.indexOf(this.currentShopTab);
        this.currentShopTab = tabs[(curTabIdx + 1) % tabs.length];
        this.selectedShopItemIndex = 0;
        this.selectedShopSkinIndex = 0;
        this.targetShopScrollY = 0;
        this.audio.playTap();
      } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
        if (items.length > 0) {
          this.selectedShopItemIndex = (this.selectedShopItemIndex - 1 + items.length) % items.length;
          this.selectedShopSkinIndex = this.selectedShopItemIndex;
          this.ensureShopItemVisible(this.selectedShopItemIndex);
          this.audio.playTap();
        }
      } else if (key === 'ArrowRight' || key === 'ArrowDown') {
        if (items.length > 0) {
          this.selectedShopItemIndex = (this.selectedShopItemIndex + 1) % items.length;
          this.selectedShopSkinIndex = this.selectedShopItemIndex;
          this.ensureShopItemVisible(this.selectedShopItemIndex);
          this.audio.playTap();
        }
      } else if (key === '1' || key === '2' || key === '3' || key === '4') {
        const pid = (parseInt(key, 10) - 1) as PlayerId;
        const cur = items[this.selectedShopItemIndex];
        if (cur && cur.category === 'SKIN' && EconomyManager.getInstance().isSkinUnlocked(cur.id)) {
          EconomyManager.getInstance().equipSkin(pid, cur.id);
          this.audio.playTap();
        } else if (cur && cur.category === 'BOOSTER' && EconomyManager.getInstance().isBoosterUnlocked(cur.id)) {
          EconomyManager.getInstance().equipBooster(pid, cur.id);
          this.audio.playTap();
        }
      } else if (key === 'Enter' || key === ' ') {
        this.triggerShopItemPrimaryAction();
      }
      return;
    }

    if (this.isSettingsOpen) {
      if (key === 'Escape' || key === 'Enter' || key === ' ' || key === 'o' || key === 'O' || key === 's' || key === 'S') {
        this.closeSettings();
      }
      return;
    }

    if (this.isModalOpen) {
      const modalGame = GAME_CATALOG[this.modalGameIndex];
      if (key === 'Escape') {
        this.closeGameModal();
      } else if (key === 'Enter' || key === ' ') {
        this.startGame(modalGame.id);
      } else if (modalGame?.id === 'sumo_lode_runner') {
        if (key === 'ArrowLeft' || key === '[') {
          this.lodeRunnerLevel = Math.max(0, this.lodeRunnerLevel - 1);
          this.audio.playTap();
        } else if (key === 'ArrowRight' || key === ']') {
          this.lodeRunnerLevel = Math.min(SUMO_LODE_LEVELS.length, this.lodeRunnerLevel + 1);
          this.audio.playTap();
        } else if (key === 'b' || key === 'B') {
          this.lodeRunnerSoloMode = !this.lodeRunnerSoloMode;
          this.setPlayerCount(this.lodeRunnerSoloMode ? 0 : 1);
          this.audio.playTap();
        }
      }
      return;
    }

    if (this.state === 'ROUND_OVER') {
      if (key === 'Enter' || key === ' ') {
        this.audio.playTap();
        if (this.isTournament) {
          this.startRandomGame();
        } else {
          this.startGame(GAME_CATALOG[this.selectedGameIndex].id);
        }
      } else if (key === 'Escape' || key === 'Backspace') {
        this.returnToLobby();
      }
      return;
    }

    if (this.state === 'PODIUM') {
      if (key === 'Escape' || key === 'Enter' || key === ' ') {
        this.exitPodiumToLobby();
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (key === 'Escape' || key === 'l' || key === 'L') {
        this.returnToLobby();
      } else if (key === 's' || key === 'S' || key === 'o' || key === 'O') {
        this.openSettings();
      } else if (key === 'Enter' || key === ' ' || key === 'p' || key === 'P') {
        this.togglePause();
      }
      return;
    }

    if (this.state === 'PLAYING' || this.state === 'COUNTDOWN') {
      if (key === 'Escape' || key === 'p' || key === 'P') {
        this.togglePause();
      }
      return;
    }

    if (this.state === 'LOBBY') {
      if (this.isSearchFocused || this.searchQuery.length > 0) {
        if (key === 'Escape') {
          this.searchQuery = '';
          this.isSearchFocused = false;
          this.catalogFilterDirty = true;
          this.audio.playTap();
          return;
        } else if (key === 'Backspace') {
          if (this.searchQuery.length > 0) {
            this.searchQuery = this.searchQuery.slice(0, -1);
            this.catalogFilterDirty = true;
            this.audio.playTap();
            if (this.searchQuery.length === 0) this.isSearchFocused = false;
          } else {
            this.isSearchFocused = false;
          }
          return;
        } else if (key === 'Enter') {
          this.isSearchFocused = false;
          const filtered = this.getFilteredCatalog();
          if (filtered.length > 0) {
            const catIdx = GAME_CATALOG.findIndex((g) => g.id === filtered[0].id);
            this.openGameModal(catIdx !== -1 ? catIdx : 0);
          }
          return;
        } else if (key.length === 1 && !['1', '2', '3', '4'].includes(key)) {
          this.searchQuery += key;
          this.catalogFilterDirty = true;
          this.audio.playTap();
          return;
        }
      }

      if (key === '/') {
        this.isSearchFocused = true;
        this.audio.playTap();
        return;
      }

      if (key === 'b' || key === 'B') {
        this.openShop();
        return;
      }

      // Keyboard Grid Navigation in Catalog
      const displayed = this.getFilteredCatalog();
      if (displayed.length > 0) {
        if (key === 'ArrowRight') {
          this.selectedGameIndex = Math.min(displayed.length - 1, this.selectedGameIndex + 1);
          this.scrollToGame(this.selectedGameIndex);
          this.audio.playMenuTick();
          return;
        } else if (key === 'ArrowLeft') {
          this.selectedGameIndex = Math.max(0, this.selectedGameIndex - 1);
          this.scrollToGame(this.selectedGameIndex);
          this.audio.playMenuTick();
          return;
        } else if (key === 'ArrowDown') {
          const cols = this.getGalleryCols();
          this.selectedGameIndex = Math.min(displayed.length - 1, this.selectedGameIndex + cols);
          this.scrollToGame(this.selectedGameIndex);
          this.audio.playMenuTick();
          return;
        } else if (key === 'ArrowUp') {
          const cols = this.getGalleryCols();
          this.selectedGameIndex = Math.max(0, this.selectedGameIndex - cols);
          this.scrollToGame(this.selectedGameIndex);
          this.audio.playMenuTick();
          return;
        } else if (key === 'Enter' || key === ' ') {
          if (this.selectedGameIndex >= 0 && this.selectedGameIndex < displayed.length) {
            const catIdx = GAME_CATALOG.findIndex((g) => g.id === displayed[this.selectedGameIndex].id);
            this.audio.playMenuConfirm();
            this.openGameModal(catIdx !== -1 ? catIdx : this.selectedGameIndex);
            return;
          }
        }
      }

      if (key === 's' || key === 'S' || key === 'o' || key === 'O') {
        this.openSettings();
      } else if (key === 'r' || key === 'R') {
        this.startRandomGame();
      } else if (key === 't' || key === 'T') {
        this.startCupTournament();
      } else if (key === '1') {
        this.setPlayerCount(1);
      } else if (key === '2') {
        this.setPlayerCount(2);
      } else if (key === '3') {
        this.setPlayerCount(3);
      } else if (key === '4') {
        this.setPlayerCount(4);
      }
    }
  }

  private instantiateGameWithPlayers(gameId: MinigameId, customPlayers: PlayerConfig[]): BaseGame | null {
    const savedPlayers = this.players;
    const savedActive = this.activeGame;
    this.players = customPlayers;
    this.activeGame = null;

    switch (gameId) {
      case 'tanks':
        this.activeGame = new CyberTanksGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'hovercraft':
        this.activeGame = new BumperHovercraftGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'laser_grid':
        this.activeGame = new LaserGridReflexGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'orbital':
        this.activeGame = new OrbitalSlingshotGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'micro_gp':
        this.activeGame = new MicroTurboGPGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ghost_flashlight':
        this.activeGame = new GhostFlashlightGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'kitchen_chaos':
        this.activeGame = new KitchenChaosGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'skyline_sumo':
        this.activeGame = new SkylineSumoGame(this.players, this.input, this.audio, this.particles);
        (this.activeGame as SkylineSumoGame).setMode(this.sumoMode === 'no_limit', this.sumoTargetMeters);
        break;
      case 'animal_stack':
        this.activeGame = new AnimalStackGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'sumo_iceberg':
        this.activeGame = new SumoIcebergGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cannon_barrage':
        this.activeGame = new CannonBarrageGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'anvil_rain':
        this.activeGame = new AnvilRainGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'bomb_relay':
        this.activeGame = new BombRelayGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'micro_hockey':
        this.activeGame = new MicroHockeyGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'quick_draw':
        this.activeGame = new QuickDrawWesternGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'balloon_burst':
        this.activeGame = new BalloonBurstGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'swat_fly':
        this.activeGame = new SwatFlyGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'stop_at_zero':
        this.activeGame = new StopAtZeroGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'turf_whack':
        this.activeGame = new TurfWhackGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'neon_lightcycles':
        this.activeGame = new NeonLightcyclesGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'blade_parry':
        this.activeGame = new BladeParryGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'safe_dial':
        this.activeGame = new SafeDialGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'coin_apex':
        this.activeGame = new CoinApexGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'red_light_sentry':
        this.activeGame = new RedLightSentryGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'laser_leap':
        this.activeGame = new LaserLeapGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'color_clash':
        this.activeGame = new ColorClashGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'meteor_shield':
        this.activeGame = new MeteorShieldGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'sequence_clash':
        this.activeGame = new SequenceClashGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'bubble_soccer':
        this.activeGame = new BubbleSoccerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'wire_cutter':
        this.activeGame = new WireCutterGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'magma_hop':
        this.activeGame = new MagmaHopGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'rhythm_duel':
        this.activeGame = new RhythmDuelGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cosmic_vortex':
        this.activeGame = new CosmicVortexGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pixel_paintball':
        this.activeGame = new PixelPaintballGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'minefield_dash':
        this.activeGame = new MinefieldDashGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'asteroid_miner':
        this.activeGame = new AsteroidMinerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dont_look_down':
        this.activeGame = new DontLookDownGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'snowball_fight':
        this.activeGame = new SnowballFightGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'highway_hop':
        this.activeGame = new HighwayHopGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'gold_miner':
        this.activeGame = new GoldMinerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'chomp_frogs':
        this.activeGame = new ChompFrogsGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'tug_of_war':
        this.activeGame = new TugOfWarGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'volley_spike':
        this.activeGame = new VolleySpikeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'maze_escape':
        this.activeGame = new MazeEscapeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pinball_battle':
        this.activeGame = new PinballBattleGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'mole_panic':
        this.activeGame = new MolePanicGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'color_flood':
        this.activeGame = new ColorFloodGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'memory_matrix':
        this.activeGame = new MemoryMatrixGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'snake_arena':
        this.activeGame = new SnakeArenaGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'mirror_laser':
        this.activeGame = new MirrorLaserGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'domino_cascade':
        this.activeGame = new DominoCascadeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'water_balloon':
        this.activeGame = new WaterBalloonBarrageGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'sheep_dog':
        this.activeGame = new SheepDogCorralsGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'chest_snatch':
        this.activeGame = new ChestSnatchGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'rapid_drop4':
        this.activeGame = new RapidDrop4Game(this.players, this.input, this.audio, this.particles);
        break;
      case 'floor_painter':
        this.activeGame = new FloorPainterGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dodgeball_blitz':
        this.activeGame = new DodgeballBlitzGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'gravity_golf':
        this.activeGame = new GravityGolfGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cyber_disc':
        this.activeGame = new CyberDiscGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'sumo_spheres':
        this.activeGame = new SumoSpheresGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'sky_gliders':
        this.activeGame = new SkyGlidersGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'whack_a_thief':
        this.activeGame = new TurfWhackGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pixel_curling':
        this.activeGame = new PixelCurlingGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'bumper_boats':
        this.activeGame = new BumperBoatsGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'target_sniper':
        this.activeGame = new TargetSniperGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'fruit_chopper':
        this.activeGame = new FruitChopperGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'catapult_clash':
        this.activeGame = new CatapultClashGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'jousting_knights':
        this.activeGame = new JoustingKnightsGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dragon_tamer':
        this.activeGame = new DragonTamerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'castle_archer':
        this.activeGame = new CastleArcherGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'drawbridge_panic':
        this.activeGame = new DrawbridgePanicGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'blacksmith_forge':
        this.activeGame = new BlacksmithForgeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'potion_alchemist':
        this.activeGame = new PotionAlchemistGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'royal_feast':
        this.activeGame = new RoyalFeastGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'sword_in_stone':
        this.activeGame = new SwordInStoneGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dungeon_escape':
        this.activeGame = new DungeonEscapeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'neon_drifters':
        this.activeGame = new NeonDriftersGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'hoverboard_rail':
        this.activeGame = new HoverboardRailGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'traffic_jam':
        this.activeGame = new TrafficJamGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'nitro_kart':
        this.activeGame = new NitroKartGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'monorail_hijack':
        this.activeGame = new MonorailHijackGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'drone_delivery':
        this.activeGame = new DroneDeliveryGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'rocket_skates':
        this.activeGame = new RocketSkatesGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cyber_demolition':
        this.activeGame = new CyberDemolitionGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'laser_speedway':
        this.activeGame = new LaserSpeedwayGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'gravity_pods':
        this.activeGame = new GravityPodsGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pancake_flipper':
        this.activeGame = new PancakeFlipperGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'sushi_express':
        this.activeGame = new SushiExpressGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pizza_toss':
        this.activeGame = new PizzaTossGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'burger_stack':
        this.activeGame = new BurgerStackGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ice_cream_scoop':
        this.activeGame = new IceCreamScoopGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'wok_stir_fry':
        this.activeGame = new WokStirFryGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'donut_glazer':
        this.activeGame = new DonutGlazerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'fruit_blender':
        this.activeGame = new FruitBlenderGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'teppanyaki_catch':
        this.activeGame = new TeppanyakiCatchGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'popcorn_popper':
        this.activeGame = new PopcornPopperGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'submarine_torpedo':
        this.activeGame = new SubmarineTorpedoGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'jellyfish_jump':
        this.activeGame = new JellyfishJumpGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pearl_divers':
        this.activeGame = new PearlDiversGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'shark_bait':
        this.activeGame = new SharkBaitGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'sunken_treasure':
        this.activeGame = new SunkenTreasureGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'octopus_ink':
        this.activeGame = new OctopusInkGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'crab_walk':
        this.activeGame = new CrabWalkGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'electric_eel':
        this.activeGame = new ElectricEelGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'water_scooter':
        this.activeGame = new WaterScooterGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'deep_sea_harpoon':
        this.activeGame = new DeepSeaHarpoonGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'moon_lander':
        this.activeGame = new MoonLanderGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'space_junk_salvage':
        this.activeGame = new SpaceJunkSalvageGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'alien_probe':
        this.activeGame = new AlienProbeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'solar_flare':
        this.activeGame = new SolarFlareGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'wormhole_leap':
        this.activeGame = new WormholeLeapGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'astro_miner':
        this.activeGame = new AsteroidMinerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'nebula_drift':
        this.activeGame = new NebulaDriftGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'satellite_laser':
        this.activeGame = new SatelliteLaserGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'mars_rover':
        this.activeGame = new MarsRoverGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'zero_g_tether':
        this.activeGame = new ZeroGTetherGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'saloon_brawler':
        this.activeGame = new SaloonBrawlerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'train_heist':
        this.activeGame = new TrainHeistGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'gold_panning':
        this.activeGame = new GoldPanningGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'rodeo_bull':
        this.activeGame = new RodeoBullGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'horseshoe_toss':
        this.activeGame = new HorseshoeTossGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dynamite_tumble':
        this.activeGame = new DynamiteTumbleGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cactus_slalom':
        this.activeGame = new CactusSlalomGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'bandit_chase':
        this.activeGame = new BanditChaseGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'rattlesnake_reflex':
        this.activeGame = new RattlesnakeReflexGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'western_poker':
        this.activeGame = new WesternPokerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'laser_tripwire':
        this.activeGame = new LaserTripwireGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'vault_safe':
        this.activeGame = new VaultSafeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'security_camera':
        this.activeGame = new SecurityCameraGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'briefcase_snatch':
        this.activeGame = new BriefcaseSnatchGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'hack_terminal':
        this.activeGame = new HackTerminalGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'smoke_bomb_escape':
        this.activeGame = new SmokeBombEscapeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'micro_wiretap':
        this.activeGame = new MicroWiretapGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'rooftop_zipline':
        this.activeGame = new RooftopZiplineGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'drone_intercept':
        this.activeGame = new DroneInterceptGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'disguise_shuffle':
        this.activeGame = new DisguiseShuffleGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'synthwave_highway':
        this.activeGame = new SynthwaveHighwayGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'drum_solo':
        this.activeGame = new DrumSoloGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'turntable_scratch':
        this.activeGame = new TurntableScratchGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'bass_drop':
        this.activeGame = new BassDropGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'vocal_pitch':
        this.activeGame = new VocalPitchGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'breakdance_battle':
        this.activeGame = new BreakdanceBattleGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'neon_metronome':
        this.activeGame = new NeonMetronomeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'equalizer_bounce':
        this.activeGame = new EqualizerBounceGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'retro_chiptune':
        this.activeGame = new RetroChiptuneGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'disco_tile':
        this.activeGame = new DiscoTileGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ring_toss':
        this.activeGame = new RingTossFrenzyGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'rollercoaster_thrill':
        this.activeGame = new RollerCoasterBrakeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'balloon_dart':
        this.activeGame = new BalloonDartClownGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dunk_tank':
        this.activeGame = new DunkClownTankGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ferris_wheel':
        this.activeGame = new FerrisWheelHopGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'funhouse_mirrors':
        this.activeGame = new FunhouseMirrorsGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cotton_candy':
        this.activeGame = new CottonCandySpinGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'test_strength':
        this.activeGame = new TestStrengthGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'haunted_mansion':
        this.activeGame = new HauntedMansionGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'fireworks_finale':
        this.activeGame = new FireworksFinaleGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'hydra_slayer':
        this.activeGame = new HydraSlayerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pharaoh_tomb':
        this.activeGame = new PharaohTombGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'spartan_shield':
        this.activeGame = new SpartanShieldGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'kraken_whirlpool':
        this.activeGame = new KrakenWhirlpoolGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'icarus_wings':
        this.activeGame = new IcarusWingsGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'minotaur_labyrinth':
        this.activeGame = new MinotaurLabyrinthGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'olympus_lightning':
        this.activeGame = new OlympusLightningGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'anubis_scales':
        this.activeGame = new AnubisScalesGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'gorgon_gaze':
        this.activeGame = new GorgonGazeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'viking_longship':
        this.activeGame = new VikingLongshipGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'antimatter_containment':
        this.activeGame = new AntimatterContainmentGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'warp_gate_jump':
        this.activeGame = new WarpGateJumpGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'solar_sail_rider':
        this.activeGame = new SolarSailRiderGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'planetary_rover':
        this.activeGame = new PlanetaryRoverGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pulsar_signal':
        this.activeGame = new PulsarSignalGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'asteroid_catcher':
        this.activeGame = new AsteroidCatcherGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'alien_abduction':
        this.activeGame = new AlienAbductionGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'space_elevator':
        this.activeGame = new SpaceElevatorGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'orbital_drop_pod':
        this.activeGame = new OrbitalDropPodGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dyson_sphere_collector':
        this.activeGame = new DysonSphereCollectorGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'penguin_slide':
        this.activeGame = new PenguinSlideGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'iceberg_breaker':
        this.activeGame = new IcebergBreakerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'blizzard_beacon':
        this.activeGame = new BlizzardBeaconGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'walrus_bask':
        this.activeGame = new WalrusBaskGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'polar_ice_fishing':
        this.activeGame = new PolarIceFishingGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'aurora_collector':
        this.activeGame = new AuroraCollectorGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dog_sled_dash':
        this.activeGame = new DogSledDashGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'mammoth_stampede':
        this.activeGame = new MammothStampedeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'frostbite_cavern':
        this.activeGame = new FrostbiteCavernGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'geyser_leap':
        this.activeGame = new GeyserLeapGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'clockwork_cogs':
        this.activeGame = new ClockworkCogsGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'steam_boiler_relief':
        this.activeGame = new SteamBoilerReliefGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'zeppelin_dogfight':
        this.activeGame = new ZeppelinDogfightGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'tesla_coil_arc':
        this.activeGame = new TeslaCoilArcGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'automator_assembly':
        this.activeGame = new AutomatorAssemblyGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pneumatic_tube_rush':
        this.activeGame = new PneumaticTubeRushGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ornithopter_flock':
        this.activeGame = new OrnithopterFlockGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pressure_gauge_lock':
        this.activeGame = new PressureGaugeLockGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'copper_conduit':
        this.activeGame = new CopperConduitGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'monocycle_derby':
        this.activeGame = new MonocycleDerbyGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cyber_samurai_slash':
        this.activeGame = new CyberSamuraiSlashGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'mainframe_breach':
        this.activeGame = new MainframeBreachGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'hovercar_skyline':
        this.activeGame = new HovercarSkylineGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'hologram_glitch':
        this.activeGame = new HologramGlitchGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'laser_grapple':
        this.activeGame = new LaserGrappleGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'neural_synapse':
        this.activeGame = new NeuralSynapseGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'drone_swarm_defense':
        this.activeGame = new DroneSwarmDefenseGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'synth_keytar_solo':
        this.activeGame = new SynthKeytarSoloGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'quantum_tunneling':
        this.activeGame = new QuantumTunnelingGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'hyperloop_racer':
        this.activeGame = new HyperloopRacerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ring_toss_frenzy':
        this.activeGame = new RingTossFrenzyGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'balloon_dart_clown':
        this.activeGame = new BalloonDartClownGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'duck_pond_derby':
        this.activeGame = new DuckPondDerbyGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'milk_bottle_knockdown':
        this.activeGame = new MilkBottleKnockdownGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'bumper_car_derby':
        this.activeGame = new BumperCarDerbyGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cotton_candy_spin':
        this.activeGame = new CottonCandySpinGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'roller_coaster_brake':
        this.activeGame = new RollerCoasterBrakeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ferris_wheel_hop':
        this.activeGame = new FerrisWheelHopGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dunk_clown_tank':
        this.activeGame = new DunkClownTankGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'fortune_teller_tarot':
        this.activeGame = new FortuneTellerTarotGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'vine_swing_canopy':
        this.activeGame = new VineSwingCanopyGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'trex_egg_scramble':
        this.activeGame = new TrexEggScrambleGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'piranha_river_hop':
        this.activeGame = new PiranhaRiverHopGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pterodactyl_glide':
        this.activeGame = new PterodactylGlideGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'quicksand_escape':
        this.activeGame = new QuicksandEscapeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'blowpipe_target':
        this.activeGame = new BlowpipeTargetGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'amber_fossil_excavate':
        this.activeGame = new AmberFossilExcavateGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'raptor_pounce_dodge':
        this.activeGame = new RaptorPounceDodgeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'bamboo_pole_vault':
        this.activeGame = new BambooPoleVaultGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'volcano_lava_leap':
        this.activeGame = new VolcanoLavaLeapGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'caterpillar_inchworm':
        this.activeGame = new CaterpillarInchwormGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'honeybee_nectar_relay':
        this.activeGame = new HoneybeeNectarRelayGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'spider_web_tangle':
        this.activeGame = new SpiderWebTangleGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ant_colony_haul':
        this.activeGame = new AntColonyHaulGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'firefly_night_beacon':
        this.activeGame = new FireflyNightBeaconGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dung_beetle_roll':
        this.activeGame = new DungBeetleRollGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ladybug_aphid_hunt':
        this.activeGame = new LadybugAphidHuntGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'grasshopper_high_jump':
        this.activeGame = new GrasshopperHighJumpGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'dragonfly_dogfight':
        this.activeGame = new DragonflyDogfightGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'centipede_slalom':
        this.activeGame = new CentipedeSlalomGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'poltergeist_possession':
        this.activeGame = new PoltergeistPossessionGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'graveyard_zombie_bash':
        this.activeGame = new GraveyardZombieBashGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'phantom_mirror_gaze':
        this.activeGame = new PhantomMirrorGazeGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cauldron_witch_brew':
        this.activeGame = new CauldronWitchBrewGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'gargoyle_stone_stare':
        this.activeGame = new GargoyleStoneStareGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ghost_vacuum_buster':
        this.activeGame = new GhostVacuumBusterGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'tombstone_crypt_slider':
        this.activeGame = new TombstoneCryptSliderGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'creepy_doll_crawl':
        this.activeGame = new CreepyDollCrawlGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'ouija_spirit_board':
        this.activeGame = new OuijaSpiritBoardGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cursed_clocktower_pendulum':
        this.activeGame = new CursedClocktowerPendulumGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'synthwave_neon_racer':
        this.activeGame = new SynthwaveNeonRacerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pixel_space_invader':
        this.activeGame = new PixelSpaceInvaderGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'vector_tank_battle':
        this.activeGame = new CyberTanksGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'pac_maze_chomp':
        this.activeGame = new PacMazeChompGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'breakout_brick_blaster':
        this.activeGame = new BreakoutBrickBlasterGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'laser_disc_dance':
        this.activeGame = new LaserDiscDanceGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'crt_scanline_sniper':
        this.activeGame = new CrtScanlineSniperGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'cyber_grid_runner':
        this.activeGame = new CyberGridRunnerGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'synth_drum_pad':
        this.activeGame = new SynthDrumPadGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'matrix_code_rain':
        this.activeGame = new MatrixCodeRainGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'sharks_and_minnows':
        this.activeGame = new SharksAndMinnowsGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'power_path_clash':
        this.activeGame = new PowerPathClashGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'landscape_artillery':
        this.activeGame = new LandscapeArtilleryGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'spam_click_showdown':
        this.activeGame = new SpamClickShowdownGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'sumo_lode_runner': {
        const lodeGame = new SumoLodeRunnerGame(this.players, this.input, this.audio, this.particles);
        lodeGame.setSoloMode(this.lodeRunnerSoloMode);
        lodeGame.setStartingLevel(this.lodeRunnerLevel);
        this.activeGame = lodeGame;
        break;
      }
      case 'thumb_war_wrestle':
        this.activeGame = new ThumbWarWrestleGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'swipe_ninja_blitz':
        this.activeGame = new SwipeNinjaBlitzGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'tabletop_air_hockey':
        this.activeGame = new MicroHockeyGame(this.players, this.input, this.audio, this.particles);
        break;
      case 'tap_tug_overdrive':
        this.activeGame = new TugOfWarGame(this.players, this.input, this.audio, this.particles);
        break;
    }

    const created = this.activeGame;
    this.players = savedPlayers;
    this.activeGame = savedActive;
    return created;
  }

  public startGame(gameId: MinigameId, isSplitFinal: boolean = false) {
    this.activeGameId = gameId;
    if (gameId === 'sumo_lode_runner' && this.activeGame instanceof SumoLodeRunnerGame) {
      this.lodeRunnerLevel = this.activeGame.currentLevel;
    }
    if (this.activeGame) {
      this.activeGame.destroy();
      this.activeGame = null;
    }
    if (this.secondarySplitGame) {
      this.secondarySplitGame.destroy();
      this.secondarySplitGame = null;
    }
    this.isModalOpen = false;
    const idx = GAME_CATALOG.findIndex((g) => g.id === gameId);
    if (idx !== -1) this.selectedGameIndex = idx;

    const activeCount = this.players.filter((p) => p.type !== 'disabled').length;
    const phoneMode = getGamePhoneMode(gameId);
    const usesSplitBracketOnPhone =
      phoneMode === '4p_split_bracket' ||
      gameId === 'thumb_war_wrestle';

    if (isSplitFinal && this.splitBracketTopWinner !== null && this.splitBracketBotWinner !== null) {
      // GRAND FINAL of Phone 4P Split Bracket: Top 1v1 Winner vs Bottom 1v1 Winner!
      this.splitBracketStage = 'final';
      this.splitBracketGameId = gameId;
      const topWin = this.splitBracketTopWinner;
      const botWin = this.splitBracketBotWinner;
      const finalPlayers: PlayerConfig[] = this.players.map((p) => ({
        ...p,
        type: p.id === topWin || p.id === botWin ? (p.type === 'disabled' ? this.globalBotDifficulty : p.type) : 'disabled'
      }));
      this.activeGame = this.instantiateGameWithPlayers(gameId, finalPlayers);
    } else if (this.deviceMode === 'phone' && activeCount >= 3 && usesSplitBracketOnPhone) {
      // SIMULTANEOUS TOP 1v1 (P1 vs P2) & BOTTOM 1v1 (P3 vs P4) ON PHONE!
      this.splitBracketStage = 'semis';
      this.splitBracketGameId = gameId;
      this.splitBracketTopWinner = null;
      this.splitBracketBotWinner = null;
      this.splitBracketTransitionTimer = 0;

      const topPlayers: PlayerConfig[] = this.players.map((p) => ({
        ...p,
        type: p.id === 0 || p.id === 1 ? (p.type === 'disabled' ? this.globalBotDifficulty : p.type) : 'disabled'
      }));
      const botPlayers: PlayerConfig[] = this.players.map((p) => ({
        ...p,
        type: p.id === 2 || p.id === 3 ? (p.type === 'disabled' ? this.globalBotDifficulty : p.type) : 'disabled'
      }));

      this.activeGame = this.instantiateGameWithPlayers(gameId, topPlayers);
      this.secondarySplitGame = this.instantiateGameWithPlayers(gameId, botPlayers);
    } else {
      this.splitBracketStage = 'none';
      this.splitBracketGameId = null;
      this.splitBracketTopWinner = null;
      this.splitBracketBotWinner = null;
      this.activeGame = this.instantiateGameWithPlayers(gameId, this.players);
    }

    const SINGLE_BUTTON_GAMES = new Set<string>([
      'spam_click_showdown',
      'thumb_war_wrestle',
      'swipe_ninja_blitz',
      'neon_lightcycles',
      'micro_gp',
      'kitchen_chaos',
      'skyline_sumo',
      'cannon_barrage',
      'quick_draw',
      'balloon_burst',
      'swat_fly',
      'stop_at_zero',
      'coin_apex',
      'red_light_sentry',
      'laser_leap',
      'rhythm_duel',
      'gold_miner',
      'tug_of_war',
      'domino_cascade',
      'safe_dial',
      'drawbridge_panic',
      'blacksmith_forge',
      'potion_alchemist',
      'sword_in_stone',
      'laser_speedway',
      'pancake_flipper',
      'sushi_express',
      'pizza_toss',
      'wok_stir_fry',
      'donut_glazer',
      'fruit_blender',
      'popcorn_popper',
      'pearl_divers',
      'sunken_treasure',
      'deep_sea_harpoon',
      'saloon_brawler',
      'train_heist',
      'gold_panning',
      'rodeo_bull',
      'horseshoe_toss',
      'dynamite_tumble',
      'cactus_slalom',
      'bandit_chase',
      'rattlesnake_reflex',
      'western_poker',
      'laser_tripwire',
      'vault_safe',
      'security_camera',
      'briefcase_snatch',
      'hack_terminal',
      'smoke_bomb_escape',
      'micro_wiretap',
      'rooftop_zipline',
      'drone_intercept',
      'disguise_shuffle',
      'synthwave_highway',
      'drum_solo',
      'turntable_scratch',
      'bass_drop',
      'vocal_pitch',
      'breakdance_battle',
      'neon_metronome',
      'equalizer_bounce',
      'retro_chiptune',
      'disco_tile',
      'funhouse_mirrors',
      'test_strength',
      'haunted_mansion',
      'fireworks_finale',
      'hydra_slayer',
      'pharaoh_tomb',
      'spartan_shield',
      'kraken_whirlpool',
      'icarus_wings',
      'minotaur_labyrinth',
      'olympus_lightning',
      'anubis_scales',
      'gorgon_gaze',
      'viking_longship',
      'antimatter_containment',
      'warp_gate_jump',
      'solar_sail_rider',
      'planetary_rover',
      'pulsar_signal',
      'asteroid_catcher',
      'alien_abduction',
      'space_elevator',
      'orbital_drop_pod',
      'dyson_sphere_collector',
      'penguin_slide',
      'iceberg_breaker',
      'blizzard_beacon',
      'walrus_bask',
      'polar_ice_fishing',
      'aurora_collector',
      'dog_sled_dash',
      'mammoth_stampede',
      'frostbite_cavern',
      'geyser_leap',
      'clockwork_cogs',
      'steam_boiler_relief',
      'zeppelin_dogfight',
      'tesla_coil_arc',
      'automator_assembly',
      'pneumatic_tube_rush',
      'ornithopter_flock',
      'pressure_gauge_lock',
      'copper_conduit',
      'monocycle_derby',
      'cyber_samurai_slash',
      'mainframe_breach',
      'hovercar_skyline',
      'hologram_glitch',
      'laser_grapple',
      'neural_synapse',
      'drone_swarm_defense',
      'synth_keytar_solo',
      'quantum_tunneling',
      'hyperloop_racer',
      'ring_toss_frenzy',
      'balloon_dart_clown',
      'duck_pond_derby',
      'milk_bottle_knockdown',
      'cotton_candy_spin',
      'roller_coaster_brake',
      'ferris_wheel_hop',
      'dunk_clown_tank',
      'fortune_teller_tarot',
      'vine_swing_canopy',
      'quicksand_escape',
      'blowpipe_target',
      'amber_fossil_excavate',
      'bamboo_pole_vault',
      'caterpillar_inchworm',
      'grasshopper_high_jump',
      'creepy_doll_crawl',
      'synth_drum_pad'
    ]);

    if (this.input) {
      this.input.isInGame = true;
      this.input.setControlMode(SINGLE_BUTTON_GAMES.has(gameId) ? 'single_button' : 'directional');
      this.syncInputActivePlayers();
    }

    if (this.activeGame) {
      this.activeGame.init(this.logicalWidth, this.logicalHeight);
      if (this.secondarySplitGame) {
        this.secondarySplitGame.init(this.logicalWidth, this.logicalHeight);
      }
      const mutator = this.activeGame.rollRandomMutator(0.35);
      if (mutator.type !== 'none') {
        this.particles.showFloatingText(`🎲 MUTATOR: ${mutator.name}!`, this.logicalWidth / 2, 95, mutator.color, 24);
        this.audio.playBoost();
      }
      if (this.splitBracketStage === 'semis') {
        this.particles.showFloatingText('📱 TOP 1v1 & BOTTOM 1v1 -> WINNERS FINAL!', this.logicalWidth / 2, this.logicalHeight / 2, '#FDE047', 20);
      } else if (this.splitBracketStage === 'final' && this.splitBracketTopWinner !== null && this.splitBracketBotWinner !== null) {
        this.particles.showFloatingText(
          `🏆 GRAND FINAL: P${this.splitBracketTopWinner + 1} vs P${this.splitBracketBotWinner + 1}!`,
          this.logicalWidth / 2,
          this.logicalHeight / 2,
          '#FBBF24',
          24
        );
      }
      this.state = 'COUNTDOWN';
      this.countdownTimer = isSplitFinal ? 2.4 : 3.2;
      this.chronoClutchTriggered = false;
      this.initRoundBoosters();
      this.matchElapsedSeconds = 0;
      this.audio.playCountdown(false);
    }
  }

  public togglePause(): void {
    if (this.state === 'PLAYING' || this.state === 'COUNTDOWN') {
      this.state = 'PAUSED';
      this.isHoldingPause = false;
      this.pauseHoldProgress = 0;
      this.audio.playTap();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.isHoldingPause = false;
      this.pauseHoldProgress = 0;
      this.audio.playTap();
    }
  }

  public triggerSafePause(hold: boolean) {
    if (this.state !== 'PLAYING' && this.state !== 'COUNTDOWN' && this.state !== 'PAUSED') return;

    if (hold) {
      this.togglePause();
    } else {
      this.isHoldingPause = false;
      this.pauseHoldProgress = 0;
    }
  }

  public update(dt: number) {
    const effectiveDt = dt * this.gameSpeedMultiplier;
    this.particles.update(effectiveDt);
    this.input.update(effectiveDt);

    // Expose __GAME_STATE__ globally for automated test runners and dev inspection
    if (typeof window !== 'undefined') {
      (window as unknown as { __GAME_STATE__: unknown }).__GAME_STATE__ = {
        active: this.state !== 'LOBBY',
        state: this.state,
        game: this.activeGame,
        roundTimer: this.activeGame?.roundTimer,
        selectedGame: this.activeGameId || GAME_CATALOG[this.selectedGameIndex]?.id,
        sortMode: this.catalogSortMode,
        wasmActive: this.wasm.isNativeWasmActive()
      };
    }

    if (this.isShopOpen) {
      this.shopScrollY += (this.targetShopScrollY - this.shopScrollY) * Math.min(1, effectiveDt * 16);
    }

    // Universal Libretro / RetroArch / Raspberry Pi Gamepad Hotkeys (Select+Start = Exit to Lobby, Start = Pause/Resume)
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      try {
        const gps = navigator.getGamepads();
        const gp = gps?.[0] || gps?.[1] || gps?.[2] || gps?.[3];
        if (gp && gp.connected) {
          const now = performance.now();
          const btnSelect = gp.buttons[8]?.pressed ?? false;
          const btnStart = gp.buttons[9]?.pressed ?? false;
          if (btnSelect && btnStart && now - this.lastGamepadNavTime > 350) {
            if (this.state !== 'LOBBY') {
              this.returnToLobby();
              this.lastGamepadNavTime = now + 300;
            }
          } else if (btnStart && !btnSelect && (this.state === 'PLAYING' || this.state === 'PAUSED') && now - this.lastGamepadNavTime > 300) {
            this.togglePause();
            this.lastGamepadNavTime = now + 250;
          }
        }
      } catch {
        // Ignore gamepad permission errors
      }
    }

    if (this.state === 'LOBBY') {
      this.scrollY += (this.targetScrollY - this.scrollY) * Math.min(1, effectiveDt * 16);
      for (const m of this.ambientMotes) {
        m.x += m.vx * effectiveDt * 60;
        m.y += m.vy * effectiveDt * 60;
        if (m.y < -10) m.y = this.logicalHeight + 10;
        if (m.y > this.logicalHeight + 10) m.y = -10;
        if (m.x < -10) m.x = this.logicalWidth + 10;
        if (m.x > this.logicalWidth + 10) m.x = -10;
      }

      // Couch Multiplayer Gamepad Lobby Navigation
      if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
        const gps = navigator.getGamepads();
        const gp = gps[0] || gps[1] || gps[2] || gps[3];
        if (gp && gp.connected) {
          const now = performance.now();
          if (now - this.lastGamepadNavTime > 190) {
            const stickX = gp.axes[0] ?? 0;
            const stickY = gp.axes[1] ?? 0;
            const dLeft = (gp.buttons[14]?.pressed) || stickX < -0.45;
            const dRight = (gp.buttons[15]?.pressed) || stickX > 0.45;
            const dUp = (gp.buttons[12]?.pressed) || stickY < -0.45;
            const dDown = (gp.buttons[13]?.pressed) || stickY > 0.45;
            const btnA = gp.buttons[0]?.pressed; // A button / Cross
            const btnB = gp.buttons[1]?.pressed; // B button / Circle
            const btnX = gp.buttons[2]?.pressed; // X button / Square (Random)
            const btnY = gp.buttons[3]?.pressed; // Y button / Triangle (Cup)
            const btnL1 = gp.buttons[4]?.pressed; // L1 / LB (Cycle Sort Mode)

            const displayed = this.getFilteredCatalog();
            if (displayed.length > 0) {
              if (dRight) {
                this.selectedGameIndex = Math.min(displayed.length - 1, this.selectedGameIndex + 1);
                this.scrollToGame(this.selectedGameIndex);
                this.audio.playMenuTick();
                this.lastGamepadNavTime = now;
              } else if (dLeft) {
                this.selectedGameIndex = Math.max(0, this.selectedGameIndex - 1);
                this.scrollToGame(this.selectedGameIndex);
                this.audio.playMenuTick();
                this.lastGamepadNavTime = now;
              } else if (dDown) {
                const cols = this.getGalleryCols();
                this.selectedGameIndex = Math.min(displayed.length - 1, this.selectedGameIndex + cols);
                this.scrollToGame(this.selectedGameIndex);
                this.audio.playMenuTick();
                this.lastGamepadNavTime = now;
              } else if (dUp) {
                const cols = this.getGalleryCols();
                this.selectedGameIndex = Math.max(0, this.selectedGameIndex - cols);
                this.scrollToGame(this.selectedGameIndex);
                this.audio.playMenuTick();
                this.lastGamepadNavTime = now;
              } else if (btnA) {
                if (this.isModalOpen) {
                  this.audio.playMenuConfirm();
                  this.startGame(GAME_CATALOG[this.modalGameIndex].id);
                } else if (this.selectedGameIndex >= 0 && this.selectedGameIndex < displayed.length) {
                  const catIdx = GAME_CATALOG.findIndex((g) => g.id === displayed[this.selectedGameIndex].id);
                  this.audio.playMenuConfirm();
                  this.openGameModal(catIdx !== -1 ? catIdx : this.selectedGameIndex);
                }
                this.lastGamepadNavTime = now + 150;
              } else if (btnB) {
                if (this.isModalOpen) {
                  this.isModalOpen = false;
                  this.audio.playTap();
                } else if (this.searchQuery) {
                  this.searchQuery = '';
                  this.catalogFilterDirty = true;
                  this.audio.playTap();
                }
                this.lastGamepadNavTime = now + 150;
              } else if (btnX) {
                this.startRandomGame();
                this.lastGamepadNavTime = now + 250;
              } else if (btnY) {
                this.startCupTournament();
                this.lastGamepadNavTime = now + 250;
              } else if (btnL1) {
                this.cycleCatalogSortMode();
                this.lastGamepadNavTime = now + 250;
              }
            }
          }
        }
      }
    }

    // Safe Pause button 1.5s hold logic
    if ((this.state === 'PLAYING' || this.state === 'COUNTDOWN') && this.isHoldingPause) {
      const duration = (performance.now() - this.pauseHoldStartTime) / 1000;
      this.pauseHoldProgress = Math.min(1.0, duration / 1.5);
      if (this.pauseHoldProgress >= 1.0) {
        this.state = 'PAUSED';
        this.isHoldingPause = false;
        this.pauseHoldProgress = 0;
        this.audio.playTap();
      }
    }

    // Update dynamic achievement toast notifications
    AchievementManager.getInstance().update(effectiveDt);

    if (this.state === 'COUNTDOWN') {
      const prevInt = Math.ceil(this.countdownTimer);
      this.countdownTimer -= effectiveDt;
      const curInt = Math.ceil(this.countdownTimer);

      if (curInt < prevInt && curInt > 0) {
        this.audio.playCountdown(false);
        this.audio.playAnnouncerCountdown(curInt);
      } else if (this.countdownTimer <= 0) {
        this.state = 'PLAYING';
        this.audio.playCountdown(true);
        this.audio.playAnnouncerCountdown(0);
        this.particles.spawnGoBlast(this.logicalWidth / 2, this.logicalHeight / 2);
      }
    } else if (this.state === 'PLAYING' && this.activeGame) {
      const prevTimerInt = Math.ceil(this.activeGame.roundTimer);
      if (!this.activeGame.isRoundOver()) {
        this.activeGame.update(effectiveDt, this.logicalWidth, this.logicalHeight);
      }
      if (this.splitBracketStage === 'semis' && this.secondarySplitGame && !this.secondarySplitGame.isRoundOver()) {
        this.secondarySplitGame.update(effectiveDt, this.logicalWidth, this.logicalHeight);
      }
      const curTimerInt = Math.ceil(this.activeGame.roundTimer);

      // Universal Match Anti-Stalemate Watchdog: ensure no standard round can stall indefinitely
      this.matchElapsedSeconds += effectiveDt;
      const isUnlimitedMode = (this.activeGame as any)?.isNoTimeLimit === true || (this.activeGame as any)?.isMultiRound === true;
      if (!isUnlimitedMode && this.matchElapsedSeconds >= 65.0) {
        if (!this.activeGame.isFinished) {
          this.activeGame.isFinished = true;
        }
        if (this.secondarySplitGame && !this.secondarySplitGame.isFinished) {
          this.secondarySplitGame.isFinished = true;
        }
        this.particles.showFloatingText('⚡ ANTI-LOOP SUDDEN DEATH RESOLVED!', this.logicalWidth / 2, 75, '#38BDF8', 22);
      }

      // Play high-tension ticking sound in final 5 seconds of the round
      if (this.activeGame.roundTimer > 0 && this.activeGame.roundTimer <= 5.0 && curTimerInt < prevTimerInt) {
        this.audio.playUrgencyTick(this.activeGame.roundTimer);
      }

      // Clutch Overtime: Booster Time check (+5s clutch when roundTimer <= 3s)
      if (this.activeGame.roundTimer > 0 && this.activeGame.roundTimer <= 3.0 && !this.chronoClutchTriggered) {
        let hasTimeBooster = false;
        for (const p of this.players) {
          if (p.type !== 'disabled' && EconomyManager.getInstance().getEquippedBooster(p.id) === 'booster_time') {
            hasTimeBooster = true;
            break;
          }
        }
        if (hasTimeBooster) {
          this.chronoClutchTriggered = true;
          this.activeGame.roundTimer += 5.0;
          if (this.secondarySplitGame) this.secondarySplitGame.roundTimer += 5.0;
          this.audio.playCountdown(true);
          this.particles.showFloatingText('⏱️ CHRONO CLUTCH! +5s!', this.logicalWidth / 2, 80, '#38BDF8', 26);
          this.particles.spawnGoBlast(this.logicalWidth / 2, 80);
        }
      }

      if (this.splitBracketStage === 'semis' && this.secondarySplitGame) {
        // Check Top 1v1 (P1 vs P2) completion
        if (this.activeGame.isRoundOver() && this.splitBracketTopWinner === null) {
          const topRes = this.activeGame.getRoundResult();
          this.splitBracketTopWinner = (topRes.winnerId !== null && (topRes.winnerId === 0 || topRes.winnerId === 1)) ? topRes.winnerId : 0;
          this.audio.playPointScore(this.splitBracketTopWinner);
          this.particles.showFloatingText(
            `🏆 P${this.splitBracketTopWinner + 1} WINS TOP 1v1!`,
            this.logicalWidth / 2,
            this.logicalHeight * 0.25,
            this.players[this.splitBracketTopWinner].color,
            22
          );
        }
        // Check Bottom 1v1 (P3 vs P4) completion
        if (this.secondarySplitGame.isRoundOver() && this.splitBracketBotWinner === null) {
          const botRes = this.secondarySplitGame.getRoundResult();
          this.splitBracketBotWinner = (botRes.winnerId !== null && (botRes.winnerId === 2 || botRes.winnerId === 3)) ? botRes.winnerId : 2;
          this.audio.playPointScore(this.splitBracketBotWinner);
          this.particles.showFloatingText(
            `🏆 P${this.splitBracketBotWinner + 1} WINS BOTTOM 1v1!`,
            this.logicalWidth / 2,
            this.logicalHeight * 0.75,
            this.players[this.splitBracketBotWinner].color,
            22
          );
        }
        // When BOTH Top 1v1 and Bottom 1v1 have finished, transition to the GRAND FINAL!
        if (this.splitBracketTopWinner !== null && this.splitBracketBotWinner !== null) {
          if (this.splitBracketTransitionTimer === 0) {
            this.audio.playFanfare();
          }
          this.splitBracketTransitionTimer += effectiveDt;
          if (this.splitBracketTransitionTimer >= 1.8 && this.splitBracketGameId) {
            this.startGame(this.splitBracketGameId, true);
            return;
          }
        }
      } else if (this.activeGame.isRoundOver()) {
        this.state = 'ROUND_OVER';
        if (this.input) {
          this.input.isInGame = false;
        }
        this.currentRoundResult = this.activeGame.getRoundResult();
        this.audio.playFanfare();
        this.autoNextTimer = 2.0;

        // Record High Score, Wins & Plays in CloudPersistenceManager (Local + Firebase Sync)
        const finishedGameId = this.activeGameId || GAME_CATALOG[this.selectedGameIndex]?.id;
        if (finishedGameId && this.currentRoundResult) {
          let bestNumericScore = 100;
          for (const r of this.currentRoundResult.rankings) {
            const parsed = parseFloat(String(r.score).replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed) && parsed > bestNumericScore) {
              bestNumericScore = Math.round(parsed);
            }
          }
          if (this.currentRoundResult.winnerId !== null) {
            bestNumericScore = Math.max(bestNumericScore, this.players[this.currentRoundResult.winnerId].score * 100 + 100);
          }
          const humanWon = this.currentRoundResult.winnerId !== null && !this.players[this.currentRoundResult.winnerId]?.type.startsWith('bot_');
          this.cloud.recordRoundComplete(
            finishedGameId,
            bestNumericScore,
            humanWon,
            this.matchElapsedSeconds
          );
          this.catalogFilterDirty = true;
        }

        // Award points to round winner with celebratory audio and visual confetti
        if (this.currentRoundResult.winnerId !== null) {
          const wId = this.currentRoundResult.winnerId;
          this.players[wId].score += 1;
          const entry = this.tournamentLeaderboard.find((e) => e.playerId === wId);
          if (entry) entry.points += 1;

          // Award in-game currency economy for winning (with 2x Double Bounty & Siphon Booster support!)
          const wonCoins = EconomyManager.getInstance().awardRoundWin(wId);
          this.audio.playCoin();
          const equippedB = EconomyManager.getInstance().getEquippedBooster(wId);
          let bTag = '';
          if (equippedB === 'booster_double_coins') bTag = ' (2x BOUNTY)';
          else if (equippedB === 'booster_siphon') bTag = ' (+10 SIPHON)';
          this.particles.showFloatingText(`+${wonCoins} COINS${bTag}!`, this.logicalWidth / 2, this.logicalHeight / 2 + 15, '#FBBF24', 20);

          // Check gameplay achievements
          if (wId === 0) {
            AchievementManager.getInstance().unlock('first_win');
          }
          AchievementManager.getInstance().recordMatchPlayed();
          AchievementManager.getInstance().checkCoinMilestones(EconomyManager.getInstance().getCoins());

          if (this.globalBotDifficulty === 'bot_hard' && this.players.filter((p) => p.type !== 'disabled').length === 2 && this.players[1].type === 'bot_hard' && wId === 0) {
            AchievementManager.getInstance().unlock('hard_bot_slayer');
          }

          this.audio.playPointScore(wId);
          this.particles.spawnWinnerCelebration(this.logicalWidth / 2, this.logicalHeight / 2 - 25, this.players[wId].color);

          // Check if tournament won
          if (this.isTournament && this.players[wId].score >= this.tournamentGoalPoints) {
            this.state = 'PODIUM';
            const cupCoins = EconomyManager.getInstance().awardTournamentWin(wId);
            this.audio.playCoin();
            const equippedCupB = EconomyManager.getInstance().getEquippedBooster(wId);
            let cupBTag = '';
            if (equippedCupB === 'booster_double_coins') cupBTag = ' (2x BOUNTY)';
            else if (equippedCupB === 'booster_siphon') cupBTag = ' (+25 SIPHON)';
            this.particles.showFloatingText(`+${cupCoins} TOURNAMENT COINS${cupBTag}!`, this.logicalWidth / 2, this.logicalHeight / 2 - 80, '#FBBF24', 26);
            AchievementManager.getInstance().unlock('tournament_champion');
            const secondPlaceScore = this.players.filter((p) => p.id !== wId && p.type !== 'disabled').reduce((max, p) => Math.max(max, p.score), 0);
            if (secondPlaceScore === 0) {
              AchievementManager.getInstance().unlock('perfectionist');
            }
            confetti({
              particleCount: 120,
              spread: 80,
              origin: { y: 0.6 }
            });
          }
        }
      }
    } else if (this.state === 'PODIUM') {
      this.podiumConfettiTimer -= effectiveDt;
      if (this.podiumConfettiTimer <= 0) {
        this.podiumConfettiTimer = 1.8;
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.5, x: 0.3 + Math.random() * 0.4 }
        });
      }
    } else if (this.state === 'ROUND_OVER' && this.isAutonomous) {
      this.autoNextTimer -= effectiveDt;
      if (this.autoNextTimer <= 0) {
        // Automatically start next game in tournament/auto mode
        this.selectedGameIndex = (this.selectedGameIndex + 1) % GAME_CATALOG.length;
        this.startGame(GAME_CATALOG[this.selectedGameIndex].id);
      }
    }

    this.input.endFrame();
  }

  private renderSplitBracketViewports(w: number, h: number) {
    if (!this.activeGame || !this.secondarySplitGame) return;

    // 1. TOP HALF: P1 vs P2 1v1 Semi-Final
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, 0, w, h / 2 - 2);
    this.ctx.clip();
    this.ctx.scale(1, 0.5);
    this.activeGame.render(this.ctx, w, h);
    this.ctx.restore();

    if (this.splitBracketTopWinner !== null) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
      this.ctx.fillRect(0, 0, w, h / 2 - 2);
      this.ctx.fillStyle = this.players[this.splitBracketTopWinner].color;
      this.ctx.font = '900 18px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`✓ PLAYER ${this.splitBracketTopWinner + 1} ADVANCES TO GRAND FINAL!`, w / 2, h * 0.25);
      this.ctx.restore();
    }

    // 2. BOTTOM HALF: P3 vs P4 1v1 Semi-Final
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, h / 2 + 2, w, h / 2 - 2);
    this.ctx.clip();
    this.ctx.translate(0, h / 2);
    this.ctx.scale(1, 0.5);
    this.secondarySplitGame.render(this.ctx, w, h);
    this.ctx.restore();

    if (this.splitBracketBotWinner !== null) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
      this.ctx.fillRect(0, h / 2 + 2, w, h / 2 - 2);
      this.ctx.fillStyle = this.players[this.splitBracketBotWinner].color;
      this.ctx.font = '900 18px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`✓ PLAYER ${this.splitBracketBotWinner + 1} ADVANCES TO GRAND FINAL!`, w / 2, h * 0.75);
      this.ctx.restore();
    }

    // 3. Center Neon Split-Bracket Divider Ribbon
    this.ctx.save();
    this.ctx.fillStyle = '#0F172A';
    this.ctx.fillRect(0, h / 2 - 11, w, 22);
    this.ctx.strokeStyle = '#F59E0B';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(0, h / 2 - 11);
    this.ctx.lineTo(w, h / 2 - 11);
    this.ctx.moveTo(0, h / 2 + 11);
    this.ctx.lineTo(w, h / 2 + 11);
    this.ctx.stroke();

    this.ctx.fillStyle = '#FDE047';
    this.ctx.font = '900 10px Montserrat, sans-serif';
    this.ctx.textAlign = 'center';
    const bannerTxt =
      this.splitBracketTopWinner !== null && this.splitBracketBotWinner !== null
        ? `🏆 LAUNCHING GRAND FINAL: P${this.splitBracketTopWinner + 1} vs P${this.splitBracketBotWinner + 1}!`
        : '📱 PHONE 4P BRACKET — TOP: P1 vs P2  •  BOTTOM: P3 vs P4  (WINNERS PLAY FINAL!)';
    this.ctx.fillText(bannerTxt, w / 2, h / 2 + 3.5);
    this.ctx.restore();
  }

  public render() {
    this.ctx.save();
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

    // Apply screen shake
    const shake = this.particles.getShakeOffset();
    this.ctx.translate(shake.x, shake.y);

    if (this.state === 'LOBBY') {
      this.renderLobby();
    } else if (this.state === 'COUNTDOWN' || this.state === 'PLAYING' || this.state === 'PAUSED') {
      if (this.splitBracketStage === 'semis' && this.activeGame && this.secondarySplitGame) {
        this.renderSplitBracketViewports(this.logicalWidth, this.logicalHeight);
      } else if (this.activeGame) {
        this.activeGame.render(this.ctx, this.logicalWidth, this.logicalHeight);
        this.activeGame.drawMutatorHUD(this.ctx, this.logicalWidth);
        if (this.splitBracketStage === 'final' && this.splitBracketTopWinner !== null && this.splitBracketBotWinner !== null) {
          this.ctx.save();
          const pillW = Math.min(340, this.logicalWidth - 40);
          this.drawRoundedRect(this.logicalWidth / 2 - pillW / 2, 42, pillW, 22, 8, 'rgba(15, 23, 42, 0.88)', '#F59E0B', 1.5);
          this.ctx.fillStyle = '#FDE047';
          this.ctx.font = '900 10.5px Montserrat, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(
            `🏆 GRAND FINAL: P${this.splitBracketTopWinner + 1} (TOP) vs P${this.splitBracketBotWinner + 1} (BOTTOM)`,
            this.logicalWidth / 2,
            56.5
          );
          this.ctx.restore();
        }
      }
      // Climax Tension Vignette in final 8 seconds of standard rounds
      if (
        this.state === 'PLAYING' &&
        this.activeGame &&
        !(this.activeGame as any)?.isNoTimeLimit &&
        this.activeGame.roundTimer > 0 &&
        this.activeGame.roundTimer <= 8.0
      ) {
        this.ctx.save();
        const urgency = 1.0 - this.activeGame.roundTimer / 8.0;
        const pulse = (Math.sin(performance.now() * 0.014) + 1) * 0.5;
        const alpha = (0.08 + urgency * 0.14) * (0.65 + pulse * 0.35);
        this.ctx.strokeStyle = `rgba(239, 68, 68, ${alpha.toFixed(3)})`;
        this.ctx.lineWidth = 8 + urgency * 8;
        this.ctx.strokeRect(0, 0, this.logicalWidth, this.logicalHeight);
        this.ctx.restore();
      }
      this.renderArenaThemeAura(this.logicalWidth, this.logicalHeight);
      this.renderHUD();
      if (this.state === 'COUNTDOWN') {
        this.renderCountdownOverlay();
      }
      if (this.state === 'PAUSED') {
        this.renderPauseOverlay();
      }
    } else if (this.state === 'ROUND_OVER') {
      if (this.activeGame) {
        this.activeGame.render(this.ctx, this.logicalWidth, this.logicalHeight);
      }
      this.renderArenaThemeAura(this.logicalWidth, this.logicalHeight);
      this.renderRoundOverOverlay();
    } else if (this.state === 'PODIUM') {
      this.renderPodiumOverlay();
    }

    // Render visual juice, touch thumbsticks & input ripples
    this.particles.render(this.ctx);
    this.input.render(this.ctx);

    // Global Settings Modal (if opened)
    if (this.isSettingsOpen) {
      this.renderSettingsModal(this.logicalWidth, this.logicalHeight);
    }

    // Mascot Wardrobe & Custom Skins Modal (if opened)
    if (this.isShopOpen) {
      this.renderShopModal(this.logicalWidth, this.logicalHeight);
    }

    // Trophy Room & Achievements Modal (if opened)
    if (this.isTrophiesOpen) {
      this.renderTrophiesModal(this.logicalWidth, this.logicalHeight);
    }

    // Dynamic achievement toast notifications
    AchievementManager.getInstance().renderToasts(this.ctx, this.logicalWidth, this.logicalHeight);

    // Synchronize DOM classes to prevent floating utility bar from colliding with modals & overlays
    this.updateOverlayDOMClass();

    this.ctx.restore();
  }

  private updateOverlayDOMClass() {
    const isOverlayActive =
      this.isModalOpen ||
      this.isSettingsOpen ||
      this.isShopOpen ||
      this.isTrophiesOpen ||
      this.state === 'ROUND_OVER' ||
      this.state === 'PODIUM';
    if (document.body.classList.contains('modal-open') !== isOverlayActive) {
      document.body.classList.toggle('modal-open', isOverlayActive);
    }
  }

  private drawRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    fillColor?: string | CanvasGradient,
    strokeColor?: string,
    lineWidth: number = 1
  ) {
    this.ctx.save();
    this.ctx.beginPath();
    if (this.ctx.roundRect) {
      this.ctx.roundRect(x, y, w, h, radius);
    } else {
      this.ctx.rect(x, y, w, h);
    }
    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }
    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  public drawCoinIcon(x: number, y: number, radius: number = 10) {
    this.ctx.save();
    // Outer gold drop shadow and metallic body
    const grad = this.ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
    grad.addColorStop(0, '#FDE68A');
    grad.addColorStop(0.45, '#F59E0B');
    grad.addColorStop(1, '#B45309');

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = grad;
    this.ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
    this.ctx.shadowBlur = radius * 0.7;
    this.ctx.shadowOffsetY = 1;
    this.ctx.fill();

    // Inner bevel ring
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetY = 0;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#FEF3C7';
    this.ctx.lineWidth = Math.max(1, radius * 0.12);
    this.ctx.stroke();

    // Center star / diamond emblem
    this.ctx.fillStyle = '#FEF3C7';
    this.ctx.beginPath();
    const innerR = radius * 0.42;
    this.ctx.moveTo(x, y - innerR);
    this.ctx.lineTo(x + innerR * 0.65, y);
    this.ctx.lineTo(x, y + innerR);
    this.ctx.lineTo(x - innerR * 0.65, y);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  private renderLobby() {
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    // 1. Luxury Arcade Ambient Background (Soft Radial Atmosphere)
    const bgGrad = this.ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, Math.max(w, h) * 0.72);
    bgGrad.addColorStop(0, '#FFFFFF');
    bgGrad.addColorStop(0.55, '#F8FAFC');
    bgGrad.addColorStop(1, '#EEF2F6');
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, w, h);

    // Floating Luxury Ambient Bokeh Motes
    for (const m of this.ambientMotes) {
      this.ctx.beginPath();
      this.ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = m.color;
      this.ctx.globalAlpha = m.alpha;
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;

    // Dynamic Corner Player Ambient Glows
    if (this.players[0].type !== 'disabled') {
      const g1 = this.ctx.createRadialGradient(0, 0, 10, 0, 0, 280);
      g1.addColorStop(0, 'rgba(239, 68, 68, 0.09)');
      g1.addColorStop(1, 'rgba(239, 68, 68, 0)');
      this.ctx.fillStyle = g1;
      this.ctx.fillRect(0, 0, 320, 320);
    }
    if (this.players[1].type !== 'disabled') {
      const g2 = this.ctx.createRadialGradient(w, 0, 10, w, 0, 280);
      g2.addColorStop(0, 'rgba(59, 130, 246, 0.09)');
      g2.addColorStop(1, 'rgba(59, 130, 246, 0)');
      this.ctx.fillStyle = g2;
      this.ctx.fillRect(w - 320, 0, 320, 320);
    }
    if (this.players[2].type !== 'disabled') {
      const g3 = this.ctx.createRadialGradient(0, h, 10, 0, h, 280);
      g3.addColorStop(0, 'rgba(16, 185, 129, 0.09)');
      g3.addColorStop(1, 'rgba(16, 185, 129, 0)');
      this.ctx.fillStyle = g3;
      this.ctx.fillRect(0, h - 320, 320, 320);
    }
    if (this.players[3].type !== 'disabled') {
      const g4 = this.ctx.createRadialGradient(w, h, 10, w, h, 280);
      g4.addColorStop(0, 'rgba(245, 158, 11, 0.09)');
      g4.addColorStop(1, 'rgba(245, 158, 11, 0)');
      this.ctx.fillStyle = g4;
      this.ctx.fillRect(w - 320, h - 320, 320, 320);
    }

    // Micro-dot gaming mat texture (cached GPU pattern fill replacing 700+ per-frame arc draw calls)
    if (!this.dotPattern) {
      const patCanvas = document.createElement('canvas');
      patCanvas.width = 28;
      patCanvas.height = 28;
      const patCtx = patCanvas.getContext('2d');
      if (patCtx) {
        patCtx.fillStyle = 'rgba(148, 163, 184, 0.12)';
        patCtx.beginPath();
        patCtx.arc(14, 14, 1.1, 0, Math.PI * 2);
        patCtx.fill();
        this.dotPattern = this.ctx.createPattern(patCanvas, 'repeat');
      }
    }
    if (this.dotPattern) {
      this.ctx.fillStyle = this.dotPattern;
      this.ctx.fillRect(0, 0, w, h);
    }

    // 2. Title Header with Subtitle (Shop & Trophies are housed in bottom utility bar for zero-collision layout)
    this.shopCoinBadgeHitbox = null;
    this.trophyLobbyBannerHitbox = null;
    this.shopLobbyBannerHitbox = null;

    // 3. Player Count Quick Tabs (Responsive 2.5D Tactile Buttons)
    this.playerTabHitboxes = [];
    const humanCount = this.players.filter((p) => p.type === 'human').length;
    const botCount = this.players.filter((p) => p.type !== 'human' && p.type !== 'disabled').length;
    const activeCount = humanCount + botCount;
    const currentDisplayedCount = this.getFilteredCatalog().length;

    // Center Title Header (Unobstructed, zero overlap with desktop player cards or mobile borders)
    const titleY = w < 560 ? 50 : 42;
    const subY = w < 560 ? 64 : 58;
    this.ctx.save();
    this.ctx.fillStyle = '#0F172A';
    this.ctx.font = w < 500 ? '900 15px Montserrat, sans-serif' : (w < 720 ? '900 18px Montserrat, sans-serif' : '900 20px Montserrat, sans-serif');
    this.ctx.textAlign = 'center';
    this.ctx.fillText('ANTIGRAVITY PARTY GAMES', w / 2, titleY);
    this.ctx.restore();

    // Center Subtitle
    const isTabletScreen = w >= 600 && w < 1180;
    this.ctx.fillStyle = this.deviceMode === 'phone' ? '#0284C7' : '#64748B';
    this.ctx.font = w < 500 ? '700 9.5px Montserrat, sans-serif' : (w < 720 ? '700 10.5px Montserrat, sans-serif' : '700 11.5px Montserrat, sans-serif');
    this.ctx.textAlign = 'center';
    const subText =
      this.deviceMode === 'phone'
        ? `${isTabletScreen ? '📱 TABLET & TOUCH MODE' : '📱 PHONE MODE'} (${currentDisplayedCount} Games)  •  ${activeCount >= 3 ? '4-Corner Touch + 1v1 Top/Bot → Final' : '1-2P Face-to-Face & Touch'}`
        : `${currentDisplayedCount} Minigames  •  1-4 Players & Bots  •  Tournament Cup`;
    this.ctx.fillText(subText, w / 2, subY);

    // At startup or when playing 1 Human vs AI bot(s), Tab 1 ("1P V AI") is selected; when 1 Human only (no bots), Tab 0 ("1P SOLO") is selected
    let selectedTabCount = activeCount;
    if (humanCount === 1 && botCount >= 1) {
      selectedTabCount = 1;
    } else if (humanCount === 1 && botCount === 0) {
      selectedTabCount = 0;
    } else if (botCount === 0) {
      selectedTabCount = humanCount;
    }

    const tabY = 82;
    const maxTabsW = Math.min(580, w - 32);
    const tabGap = 7;
    const tabW = Math.max(46, Math.floor((maxTabsW - 4 * tabGap) / 5));
    const totalTabsW = 5 * tabW + 4 * tabGap;
    const tabsStartX = (w - totalTabsW) / 2;

    const tabs = [
      { count: 0, label: tabW < 72 ? '1P SOLO' : '👤 1P SOLO' },
      { count: 1, label: tabW < 72 ? '1P V AI' : '🤖 1P V AI' },
      { count: 2, label: tabW < 72 ? '2P' : '2 PLAYERS' },
      { count: 3, label: tabW < 72 ? '3P' : '3 PLAYERS' },
      { count: 4, label: tabW < 72 ? '4P' : '4 PLAYERS' }
    ];

    tabs.forEach((tab, idx) => {
      const tabX = tabsStartX + idx * (tabW + tabGap);
      const isSelected = selectedTabCount === tab.count;
      this.playerTabHitboxes.push({ count: tab.count, x: tabX, y: tabY, w: tabW, h: 26 });

      this.ctx.save();
      if (isSelected) {
        this.ctx.shadowColor = 'rgba(37, 99, 235, 0.35)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetY = 3;
        // 3D bottom bevel
        this.drawRoundedRect(tabX, tabY + 3, tabW, 25, 7, '#1E40AF');
        // Main button top
        const tabGrad = this.ctx.createLinearGradient(tabX, tabY, tabX, tabY + 28);
        tabGrad.addColorStop(0, '#3B82F6');
        tabGrad.addColorStop(1, '#2563EB');
        this.drawRoundedRect(tabX, tabY, tabW, 26, 7, tabGrad, '#93C5FD', 1.5);
      } else {
        this.ctx.shadowColor = 'rgba(15, 23, 42, 0.05)';
        this.ctx.shadowBlur = 6;
        this.ctx.shadowOffsetY = 2;
        // Inactive 3D bottom bevel
        this.drawRoundedRect(tabX, tabY + 2, tabW, 26, 7, '#E2E8F0');
        this.drawRoundedRect(tabX, tabY, tabW, 26, 7, '#FFFFFF', '#CBD5E1', 1.5);
      }
      this.ctx.restore();

      this.ctx.fillStyle = isSelected ? '#FFFFFF' : '#334155';
      this.drawFittedButtonText(tab.label, tabX + tabW / 2, tabY + 17, tabW - 8, 10.5, 7.5);
    });

    // 4. Global AI Difficulty Bar (Responsive Segmented Tactile Switch)
    this.diffHitboxes = [];
    const diffY = 120;
    const maxDiffW = Math.min(365, w - 32);
    const diffSpacing = 8;
    const diffW = Math.max(60, Math.floor((maxDiffW - 2 * diffSpacing) / 3));
    const totalDiffW = 3 * diffW + 2 * diffSpacing;
    const diffStartX = (w - totalDiffW) / 2;
    const diffOptions: { id: 'bot_easy' | 'bot_normal' | 'bot_hard'; label: string; icon: string; topGrad: string; botGrad: string; strokeColor: string; shadowColor: string }[] = [
      { id: 'bot_easy', label: 'EASY', icon: '🌱', topGrad: '#22C55E', botGrad: '#16A34A', strokeColor: '#86EFAC', shadowColor: 'rgba(22, 163, 74, 0.35)' },
      { id: 'bot_normal', label: 'NORMAL', icon: '⚡', topGrad: '#0EA5E9', botGrad: '#0284C7', strokeColor: '#7DD3FC', shadowColor: 'rgba(2, 132, 199, 0.35)' },
      { id: 'bot_hard', label: 'HARD', icon: '🔥', topGrad: '#EF4444', botGrad: '#DC2626', strokeColor: '#FCA5A5', shadowColor: 'rgba(220, 38, 38, 0.35)' }
    ];

    // Difficulty Section Label (show if ample horizontal room)
    if (diffStartX > 80) {
      this.ctx.fillStyle = '#475569';
      this.ctx.font = '900 11px Montserrat, sans-serif';
      this.ctx.textAlign = 'right';
      this.ctx.fillText('AI LEVEL:', diffStartX - 12, diffY + 17);
      this.ctx.textAlign = 'center';
    }

    diffOptions.forEach((opt, idx) => {
      const optX = diffStartX + idx * (diffW + diffSpacing);
      const isSelected = this.globalBotDifficulty === opt.id;
      this.diffHitboxes.push({ id: opt.id, x: optX, y: diffY, w: diffW, h: 24 });

      this.ctx.save();
      if (isSelected) {
        this.ctx.shadowColor = opt.shadowColor;
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetY = 3;
        // 3D bevel
        this.drawRoundedRect(optX, diffY + 3, diffW, 23, 6, '#0F172A');
        const optGrad = this.ctx.createLinearGradient(optX, diffY, optX, diffY + 26);
        optGrad.addColorStop(0, opt.topGrad);
        optGrad.addColorStop(1, opt.botGrad);
        this.drawRoundedRect(optX, diffY, diffW, 24, 6, optGrad, opt.strokeColor, 1.5);
      } else {
        this.ctx.shadowColor = 'rgba(15, 23, 42, 0.04)';
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetY = 1;
        this.drawRoundedRect(optX, diffY + 2, diffW, 24, 6, '#E2E8F0');
        this.drawRoundedRect(optX, diffY, diffW, 24, 6, '#FFFFFF', '#CBD5E1', 1.5);
      }
      this.ctx.restore();

      this.ctx.fillStyle = isSelected ? '#FFFFFF' : '#475569';
      this.drawFittedButtonText(`${opt.icon} ${opt.label}`, optX + diffW / 2, diffY + 17, diffW - 8, 11, 8.0);
    });

    // 5. Category Filter Tabs & Quick Action Buttons (Auto-Wrapping Responsive Design)
    this.categoryPillBoxes = [];
    const galleryLayout = this.getGalleryLayout(w, h);
    const isNarrow = galleryLayout.isNarrowHeader;
    const catBarY = 148;
    const categories: { id: string; label: string; icon: string }[] = [
      { id: 'ALL', label: `ALL (${currentDisplayedCount})`, icon: '🎮' },
      { id: 'Action', label: 'ACTION', icon: '⚡' },
      { id: 'Reflex', label: 'REFLEX', icon: '⏱' },
      { id: 'Racing', label: 'RACING', icon: '🏎' },
      { id: 'Party', label: 'PARTY', icon: '🎉' },
      { id: 'Physics', label: 'PHYSICS', icon: '🪐' },
      { id: 'Puzzle', label: 'PUZZLE', icon: '🧩' }
    ];

    const sortMeta: Record<CatalogSortMode, { label: string; shortLabel: string; color: string; bgTop: string; bgBot: string; border: string }> = {
      default: { label: '📊 RANK: ALL', shortLabel: '📊 RANK', color: '#475569', bgTop: '#FFFFFF', bgBot: '#F8FAFC', border: '#CBD5E1' },
      rating: { label: '⭐ TOP RATED', shortLabel: '⭐ RATED', color: '#FFFFFF', bgTop: '#F59E0B', bgBot: '#D97706', border: '#FDE68A' },
      highscore: { label: '🏆 HIGH SCORES', shortLabel: '🏆 SCORES', color: '#FFFFFF', bgTop: '#0EA5E9', bgBot: '#0284C7', border: '#BAE6FD' },
      saved: { label: `❤️ SAVED (${this.cloud.getSavedCount()})`, shortLabel: `❤️ SAVED`, color: '#FFFFFF', bgTop: '#EC4899', bgBot: '#DB2777', border: '#FBCFE8' },
      most_played: { label: '🔥 MOST PLAYED', shortLabel: '🔥 PLAYED', color: '#FFFFFF', bgTop: '#8B5CF6', bgBot: '#6D28D9', border: '#DDD6FE' }
    };
    const activeSort = sortMeta[this.catalogSortMode] || sortMeta.default;

    if (!isNarrow) {
      const catW = 58;
      const allPillW = 72;
      const catGap = 4;
      const classicW = 94;
      const randW = 78;
      const cupW = 72;
      const sortW = 100;
      const searchBaseW = 86;
      const totalPillsW = allPillW + 6 * (catW + catGap) + 8 + classicW + 5 + randW + 5 + cupW + 5 + sortW + 5 + searchBaseW;
      let curX = Math.max(16, w / 2 - totalPillsW / 2);

      categories.forEach((cat) => {
        const isSel = this.selectedCategory.toUpperCase() === cat.id.toUpperCase();
        const pillW = cat.id === 'ALL' ? allPillW : catW;
        this.categoryPillBoxes.push({ id: cat.id, x: curX, y: catBarY, w: pillW, h: 22, type: 'category' });

        this.ctx.save();
        if (isSel) {
          this.ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
          this.ctx.shadowBlur = 6;
          this.ctx.shadowOffsetY = 2;
          const selGrad = this.ctx.createLinearGradient(curX, catBarY, curX, catBarY + 22);
          selGrad.addColorStop(0, '#1E293B');
          selGrad.addColorStop(1, '#0F172A');
          this.drawRoundedRect(curX, catBarY, pillW, 22, 6, selGrad, '#38BDF8', 1.5);
        } else {
          this.drawRoundedRect(curX, catBarY, pillW, 22, 6, '#FFFFFF', '#CBD5E1', 1);
        }
        this.ctx.restore();

        this.ctx.fillStyle = isSel ? '#FFFFFF' : '#475569';
        this.drawFittedButtonText(cat.label, curX + pillW / 2, catBarY + 14.5, pillW - 8, 9.5, 7.5);

        curX += pillW + catGap;
      });

      curX += 4;

      // 🕹️ CLASSIC ARCADE STUDIO BUTTON (Neon Cyan/Dark 3D Button)
      this.categoryPillBoxes.push({ id: 'CLASSIC_ARCADE', x: curX, y: catBarY, w: classicW, h: 22, type: 'category' });
      this.ctx.save();
      this.ctx.shadowColor = 'rgba(0, 240, 255, 0.45)';
      this.ctx.shadowBlur = 8;
      this.ctx.shadowOffsetY = 2;
      this.drawRoundedRect(curX, catBarY + 2, classicW, 20, 6, '#0369A1');
      const classicGrad = this.ctx.createLinearGradient(curX, catBarY, curX, catBarY + 22);
      classicGrad.addColorStop(0, '#0F172A');
      classicGrad.addColorStop(1, '#1E293B');
      this.drawRoundedRect(curX, catBarY, classicW, 21, 6, classicGrad, '#00F0FF', 1.5);
      this.ctx.restore();
      this.ctx.fillStyle = '#00F0FF';
      this.drawFittedButtonText('🕹️ CLASSICS', curX + classicW / 2, catBarY + 14.5, classicW - 8, 9.5, 7.5);

      curX += classicW + 5;

      // 🎲 RANDOM MINIGAME BUTTON (Tactile Violet 3D Button)
      this.categoryPillBoxes.push({ id: 'RANDOM', x: curX, y: catBarY, w: randW, h: 22, type: 'random' });
      this.ctx.save();
      this.ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
      this.ctx.shadowBlur = 8;
      this.ctx.shadowOffsetY = 2;
      this.drawRoundedRect(curX, catBarY + 2, randW, 20, 6, '#6D28D9');
      const randGrad = this.ctx.createLinearGradient(curX, catBarY, curX, catBarY + 22);
      randGrad.addColorStop(0, '#A78BFA');
      randGrad.addColorStop(1, '#7C3AED');
      this.drawRoundedRect(curX, catBarY, randW, 21, 6, randGrad, '#C4B5FD', 1.5);
      this.ctx.restore();

      this.ctx.fillStyle = '#FFFFFF';
      this.drawFittedButtonText('🎲 RANDOM', curX + randW / 2, catBarY + 14.5, randW - 8, 9.5, 7.5);

      curX += randW + 5;

      // 🏆 CUP TOURNAMENT BUTTON (Tactile Gold 3D Button)
      this.categoryPillBoxes.push({ id: 'CUP', x: curX, y: catBarY, w: cupW, h: 22, type: 'cup' });
      this.ctx.save();
      this.ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
      this.ctx.shadowBlur = 8;
      this.ctx.shadowOffsetY = 2;
      this.drawRoundedRect(curX, catBarY + 2, cupW, 20, 6, '#B45309');
      const cupGrad = this.ctx.createLinearGradient(curX, catBarY, curX, catBarY + 22);
      cupGrad.addColorStop(0, '#FBBF24');
      cupGrad.addColorStop(1, '#D97706');
      this.drawRoundedRect(curX, catBarY, cupW, 21, 6, cupGrad, '#FDE68A', 1.5);
      this.ctx.restore();

      this.ctx.fillStyle = '#FFFFFF';
      this.drawFittedButtonText('🏆 CUP', curX + cupW / 2, catBarY + 14.5, cupW - 8, 9.5, 7.5);

      curX += cupW + 5;

      // ⭐ RANK / SORT PILL (Firebase Cloud Ratings, High Scores, Saves, Plays)
      this.categoryPillBoxes.push({ id: 'SORT_CYCLE', x: curX, y: catBarY, w: sortW, h: 22, type: 'sort' });
      this.ctx.save();
      if (this.catalogSortMode !== 'default') {
        this.ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
        this.ctx.shadowBlur = 6;
        this.ctx.shadowOffsetY = 2;
        const sGrad = this.ctx.createLinearGradient(curX, catBarY, curX, catBarY + 22);
        sGrad.addColorStop(0, activeSort.bgTop);
        sGrad.addColorStop(1, activeSort.bgBot);
        this.drawRoundedRect(curX, catBarY, sortW, 22, 6, sGrad, activeSort.border, 1.5);
      } else {
        this.drawRoundedRect(curX, catBarY, sortW, 22, 6, '#FFFFFF', '#CBD5E1', 1);
      }
      this.ctx.restore();
      this.ctx.fillStyle = activeSort.color;
      this.drawFittedButtonText(activeSort.label, curX + sortW / 2, catBarY + 14.5, sortW - 8, 9.0, 7.0);

      curX += sortW + 5;

      // 🔍 LIVE SEARCH PILL
      const searchLabel = this.searchQuery ? `🔍 "${this.searchQuery}" [✕]` : (this.isSearchFocused ? '🔍 TYPE... [Esc]' : '🔍 SEARCH [/]');
      this.ctx.font = '900 9.5px Montserrat, sans-serif';
      const sTextW = this.ctx.measureText(searchLabel).width;
      const searchW = Math.max(searchBaseW, sTextW + 16);
      this.categoryPillBoxes.push({ id: 'SEARCH', x: curX, y: catBarY, w: searchW, h: 22, type: 'category' });

      this.ctx.save();
      if (this.searchQuery || this.isSearchFocused) {
        this.ctx.shadowColor = 'rgba(14, 165, 233, 0.4)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetY = 2;
        this.drawRoundedRect(curX, catBarY + 2, searchW, 20, 6, '#0369A1');
        const searchGrad = this.ctx.createLinearGradient(curX, catBarY, curX, catBarY + 22);
        searchGrad.addColorStop(0, '#38BDF8');
        searchGrad.addColorStop(1, '#0284C7');
        this.drawRoundedRect(curX, catBarY, searchW, 21, 6, searchGrad, '#BAE6FD', 1.5);
        this.ctx.fillStyle = '#FFFFFF';
      } else {
        this.drawRoundedRect(curX, catBarY, searchW, 22, 6, '#FFFFFF', '#CBD5E1', 1);
        this.ctx.fillStyle = '#475569';
      }
      this.ctx.restore();
      this.drawFittedButtonText(searchLabel, curX + searchW / 2, catBarY + 14.5, searchW - 8, 9.5, 7.5);
    } else {
      // Mobile / Narrow / Tablet Portrait: Row 1 has Categories
      const catGap = 4;
      const totalCatW = Math.min(w - 24, 620);
      const catW = Math.max(38, Math.floor((totalCatW - 6 * catGap) / 7));
      let curX = (w - (7 * catW + 6 * catGap)) / 2;

      categories.forEach((cat) => {
        const isSel = this.selectedCategory.toUpperCase() === cat.id.toUpperCase();
        this.categoryPillBoxes.push({ id: cat.id, x: curX, y: catBarY, w: catW, h: 22, type: 'category' });

        this.ctx.save();
        if (isSel) {
          const selGrad = this.ctx.createLinearGradient(curX, catBarY, curX, catBarY + 22);
          selGrad.addColorStop(0, '#1E293B');
          selGrad.addColorStop(1, '#0F172A');
          this.drawRoundedRect(curX, catBarY, catW, 22, 6, selGrad, '#38BDF8', 1.5);
        } else {
          this.drawRoundedRect(curX, catBarY, catW, 22, 6, '#FFFFFF', '#CBD5E1', 1);
        }
        this.ctx.restore();

        this.ctx.fillStyle = isSel ? '#FFFFFF' : '#475569';
        const label = catW < 52 ? (cat.id === 'ALL' ? 'ALL' : cat.label.slice(0, 3)) : (cat.id === 'ALL' ? (catW < 64 ? 'ALL' : `ALL (${currentDisplayedCount})`) : cat.label);
        this.drawFittedButtonText(label, curX + catW / 2, catBarY + 14.5, catW - 6, 8.5, 6.5);
        curX += catW + catGap;
      });

      // Narrow Row 2: Actions (CLASSICS, RANDOM, CUP, RANK, SEARCH)
      const actionY = 175;
      const actGap = 5;
      const btnW = Math.min(100, Math.floor((w - 24 - 4 * actGap) / 5));
      const totalActW = 5 * btnW + 4 * actGap;
      let actX = (w - totalActW) / 2;

      // 🕹️ CLASSICS
      this.categoryPillBoxes.push({ id: 'CLASSIC_ARCADE', x: actX, y: actionY, w: btnW, h: 22, type: 'category' });
      this.ctx.save();
      this.drawRoundedRect(actX, actionY + 2, btnW, 20, 6, '#0369A1');
      const classicGrad = this.ctx.createLinearGradient(actX, actionY, actX, actionY + 22);
      classicGrad.addColorStop(0, '#0F172A');
      classicGrad.addColorStop(1, '#1E293B');
      this.drawRoundedRect(actX, actionY, btnW, 21, 6, classicGrad, '#00F0FF', 1.5);
      this.ctx.restore();
      this.ctx.fillStyle = '#00F0FF';
      this.drawFittedButtonText('🕹️ CLASSICS', actX + btnW / 2, actionY + 14.5, btnW - 6, 8.5, 6.5);
      actX += btnW + actGap;

      // 🎲 RANDOM
      this.categoryPillBoxes.push({ id: 'RANDOM', x: actX, y: actionY, w: btnW, h: 22, type: 'random' });
      this.ctx.save();
      this.drawRoundedRect(actX, actionY + 2, btnW, 20, 6, '#6D28D9');
      const randGrad = this.ctx.createLinearGradient(actX, actionY, actX, actionY + 22);
      randGrad.addColorStop(0, '#A78BFA');
      randGrad.addColorStop(1, '#7C3AED');
      this.drawRoundedRect(actX, actionY, btnW, 21, 6, randGrad, '#C4B5FD', 1.5);
      this.ctx.restore();
      this.ctx.fillStyle = '#FFFFFF';
      this.drawFittedButtonText('🎲 RANDOM', actX + btnW / 2, actionY + 14.5, btnW - 8, 8.5, 6.5);
      actX += btnW + actGap;

      // 🏆 CUP
      this.categoryPillBoxes.push({ id: 'CUP', x: actX, y: actionY, w: btnW, h: 22, type: 'cup' });
      this.ctx.save();
      this.drawRoundedRect(actX, actionY + 2, btnW, 20, 6, '#B45309');
      const cupGrad = this.ctx.createLinearGradient(actX, actionY, actX, actionY + 22);
      cupGrad.addColorStop(0, '#FBBF24');
      cupGrad.addColorStop(1, '#D97706');
      this.drawRoundedRect(actX, actionY, btnW, 21, 6, cupGrad, '#FDE68A', 1.5);
      this.ctx.restore();
      this.ctx.fillStyle = '#FFFFFF';
      this.drawFittedButtonText('🏆 CUP', actX + btnW / 2, actionY + 14.5, btnW - 8, 8.5, 6.5);
      actX += btnW + actGap;

      // ⭐ RANK
      this.categoryPillBoxes.push({ id: 'SORT_CYCLE', x: actX, y: actionY, w: btnW, h: 22, type: 'sort' });
      this.ctx.save();
      if (this.catalogSortMode !== 'default') {
        const sGrad = this.ctx.createLinearGradient(actX, actionY, actX, actionY + 22);
        sGrad.addColorStop(0, activeSort.bgTop);
        sGrad.addColorStop(1, activeSort.bgBot);
        this.drawRoundedRect(actX, actionY, btnW, 22, 6, sGrad, activeSort.border, 1.5);
      } else {
        this.drawRoundedRect(actX, actionY, btnW, 22, 6, '#FFFFFF', '#CBD5E1', 1);
      }
      this.ctx.restore();
      this.ctx.fillStyle = activeSort.color;
      this.drawFittedButtonText(btnW >= 100 ? activeSort.label : activeSort.shortLabel, actX + btnW / 2, actionY + 14.5, btnW - 8, 8.5, 6.5);
      actX += btnW + actGap;

      // 🔍 SEARCH
      const sLabel = this.searchQuery ? `🔍 "${this.searchQuery}"` : (this.isSearchFocused ? '🔍 TYPE...' : '🔍 SEARCH');
      this.categoryPillBoxes.push({ id: 'SEARCH', x: actX, y: actionY, w: btnW, h: 22, type: 'category' });
      this.ctx.save();
      if (this.searchQuery || this.isSearchFocused) {
        this.drawRoundedRect(actX, actionY + 2, btnW, 20, 6, '#0369A1');
        const sGrad = this.ctx.createLinearGradient(actX, actionY, actX, actionY + 22);
        sGrad.addColorStop(0, '#38BDF8');
        sGrad.addColorStop(1, '#0284C7');
        this.drawRoundedRect(actX, actionY, btnW, 21, 6, sGrad, '#BAE6FD', 1.5);
        this.ctx.fillStyle = '#FFFFFF';
      } else {
        this.drawRoundedRect(actX, actionY, btnW, 22, 6, '#FFFFFF', '#CBD5E1', 1);
        this.ctx.fillStyle = '#475569';
      }
      this.ctx.restore();
      this.drawFittedButtonText(sLabel, actX + btnW / 2, actionY + 14.5, btnW - 8, 8.5, 6.5);
    }

    // 6. Corner Player Badges
    this.renderCornerPlayerBadges();

    // 7. Center Scrollable Game Gallery (Filtered Custom Art Squares)
    this.renderScrollableGallery(w, h, galleryLayout.galleryY);

    // 8. "How to Play" Pop-up Modal (When a game square is selected)
    if (this.isModalOpen) {
      this.renderGameModal(w, h);
    }
  }

  private renderScrollableGallery(w: number, h: number, _galleryYArg: number = 178) {
    const { galleryX, galleryY, galleryW, galleryH, cols, gap, cardW, cardH, startX } = this.getGalleryLayout(w, h);

    const displayedGames = this.getFilteredCatalog();
    const activePlayerCount = this.players.filter((p) => p.type !== 'disabled').length;

    const rows = Math.ceil(displayedGames.length / cols);
    const totalContentH = rows * cardH + (rows - 1) * gap + 85;

    this.maxScrollY = Math.max(0, totalContentH - galleryH);
    this.targetScrollY = Math.max(0, Math.min(this.maxScrollY, this.targetScrollY));

    // Clip to gallery viewing window
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(galleryX - 4, galleryY, galleryW + 8, galleryH);
    this.ctx.clip();

    // Empty search state
    if (displayedGames.length === 0) {
      const emptyW = Math.min(460, galleryW - 40);
      const emptyH = 130;
      const emptyX = galleryX + galleryW / 2 - emptyW / 2;
      const emptyY = galleryY + 40;

      this.ctx.save();
      this.ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
      this.ctx.shadowBlur = 12;
      this.ctx.shadowOffsetY = 4;
      this.drawRoundedRect(emptyX, emptyY + 3, emptyW, emptyH, 14, '#CBD5E1');
      this.drawRoundedRect(emptyX, emptyY, emptyW, emptyH, 14, '#FFFFFF', '#E2E8F0', 1.5);
      this.ctx.restore();

      this.ctx.fillStyle = '#0F172A';
      this.ctx.font = '900 16px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🔍 NO MINIGAMES FOUND', emptyX + emptyW / 2, emptyY + 42);

      this.ctx.fillStyle = '#64748B';
      this.ctx.font = '600 12px sans-serif';
      const emptyMsg = this.catalogSortMode === 'saved'
        ? 'No saved games yet! Click ❤️ SAVE inside any game card to bookmark it.'
        : `No games match "${this.searchQuery}" in category ${this.selectedCategory}.`;
      this.ctx.fillText(emptyMsg, emptyX + emptyW / 2, emptyY + 70);

      this.ctx.fillStyle = '#0284C7';
      this.ctx.font = 'bold 12px Montserrat, sans-serif';
      this.ctx.fillText('Click 📊 RANK or [✕] on Search to show all games', emptyX + emptyW / 2, emptyY + 98);

      this.ctx.restore();
      return;
    }

    const catColors: Record<string, string> = {
      Action: '#DC2626',
      Physics: '#7C3AED',
      Reflex: '#D97706',
      Racing: '#059669',
      Party: '#EA580C',
      Puzzle: '#0284C7'
    };

    for (let idx = 0; idx < displayedGames.length; idx++) {
      const game = displayedGames[idx];
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cardX = startX + col * (cardW + gap);
      const cardY = galleryY + row * (cardH + gap) - this.scrollY;

      // Frustum culling
      if (cardY + cardH < galleryY - 10 || cardY > galleryY + galleryH + 10) continue;

      const isSelected = idx === this.selectedGameIndex;

      // Glowing selection backlight aura
      if (isSelected) {
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(59, 130, 246, 0.45)';
        this.ctx.shadowBlur = 12;
        this.drawRoundedRect(cardX - 2, cardY - 2, cardW + 4, cardH + 4, 16, 'rgba(59, 130, 246, 0.16)');
        this.ctx.restore();
      }

      // 3D Tactile Card Outer Frame & Shadow
      this.ctx.save();
      this.ctx.shadowColor = isSelected ? 'rgba(37, 99, 235, 0.30)' : 'rgba(15, 23, 42, 0.06)';
      this.ctx.shadowBlur = isSelected ? 10 : 4;
      this.ctx.shadowOffsetY = isSelected ? 4 : 2;

      // 3D bottom bevel edge
      this.drawRoundedRect(cardX, cardY + 3, cardW, cardH - 1, 14, isSelected ? '#1D4ED8' : '#CBD5E1');

      // Top card face
      const strokeColor = isSelected ? '#2563EB' : '#E2E8F0';
      const lineWidth = isSelected ? 2.5 : 1.5;
      this.drawRoundedRect(cardX, cardY, cardW, cardH - 2, 14, '#FFFFFF', strokeColor, lineWidth);

      // Specular top rim light
      this.drawRoundedRect(cardX + 3, cardY + 1, cardW - 6, 2, 1, 'rgba(255, 255, 255, 0.85)');
      this.ctx.restore();

      // Custom full-art square thumbnail with top rounded clipping
      const artH = w < 600 ? Math.max(86, cardH - 76) : 118;
      this.ctx.save();
      this.ctx.beginPath();
      if (this.ctx.roundRect) {
        this.ctx.roundRect(cardX + 6, cardY + 6, cardW - 12, artH, [10, 10, 4, 4]);
      } else {
        this.ctx.rect(cardX + 6, cardY + 6, cardW - 12, artH);
      }
      this.ctx.clip();
      renderGameThumbnailArt(this.ctx, game.id, cardX + 6, cardY + 6, cardW - 12, artH);
      this.ctx.restore();

      // Floating Category Pill (Top-Left overlay on artwork with 2.5D tactile drop edge)
      const catColor = catColors[game.category] || '#0284C7';
      this.drawRoundedRect(cardX + 12, cardY + 13.5, 62, 18, 5, '#0F172A');
      this.drawRoundedRect(cardX + 12, cardY + 12, 62, 18, 5, catColor);
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '900 8.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(game.category.toUpperCase(), cardX + 43, cardY + 24.5);

      // Floating Rating & Save Badge (Top-Right overlay on artwork)
      const cloudStats = this.cloud.getGameStats(game.id);
      const effRating = this.cloud.getEffectiveRating(game.id);
      const ratingBadgeText = cloudStats.saved ? `❤️ ★ ${effRating.toFixed(1)}` : `★ ${effRating.toFixed(1)}`;
      const rBadgeW = cloudStats.saved ? 58 : 44;
      const rBadgeX = cardX + cardW - 12 - rBadgeW;
      this.drawRoundedRect(rBadgeX, cardY + 13.5, rBadgeW, 18, 5, 'rgba(15, 23, 42, 0.9)');
      this.drawRoundedRect(
        rBadgeX,
        cardY + 12,
        rBadgeW,
        18,
        5,
        cloudStats.saved ? '#BE185D' : 'rgba(15, 23, 42, 0.82)',
        cloudStats.userRating > 0 ? '#FBBF24' : 'rgba(255, 255, 255, 0.25)',
        1
      );
      this.ctx.fillStyle = '#FDE047';
      this.drawFittedButtonText(ratingBadgeText, rBadgeX + rBadgeW / 2, cardY + 24.5, rBadgeW - 6, 8.5, 6.5);

      // Phone Mode Compatibility Badge or High Score Pill along bottom of artwork
      if (this.deviceMode === 'phone') {
        const badge = getPhoneModeBadge(game.id, activePlayerCount);
        this.drawRoundedRect(cardX + 12, cardY + artH - 14, cardW - 24, 16, 4, badge.bg, 'rgba(255,255,255,0.35)', 1);
        this.ctx.fillStyle = badge.color;
        this.drawFittedButtonText(badge.label, cardX + cardW / 2, cardY + artH - 3, cardW - 30, 8.0, 6.5);
      } else if (cloudStats.highScore > 0 || this.catalogSortMode === 'highscore' || this.catalogSortMode === 'most_played') {
        const statText = this.catalogSortMode === 'most_played'
          ? `🔥 ${cloudStats.plays} PLAYS • ${cloudStats.wins}W`
          : `🏆 HI-SCORE: ${cloudStats.highScore} (${cloudStats.wins}W)`;
        this.drawRoundedRect(cardX + 12, cardY + artH - 14, cardW - 24, 16, 4, 'rgba(15, 23, 42, 0.82)', '#38BDF8', 1);
        this.ctx.fillStyle = '#BAE6FD';
        this.drawFittedButtonText(statText, cardX + cardW / 2, cardY + artH - 3, cardW - 30, 8.0, 6.5);
      }

      // Game Title (Clean, centered, auto-fit font to card width)
      this.ctx.fillStyle = '#0F172A';
      this.ctx.textAlign = 'center';
      let titleFontSize = 13.5;
      this.ctx.font = `900 ${titleFontSize}px Montserrat, sans-serif`;
      const maxTextW = cardW - 18;
      while (this.ctx.measureText(game.title).width > maxTextW && titleFontSize > 9.5) {
        titleFontSize -= 0.5;
        this.ctx.font = `900 ${titleFontSize}px Montserrat, sans-serif`;
      }
      this.ctx.fillText(game.title, cardX + cardW / 2, cardY + artH + 26);

      // Game Tagline (Auto-fit with ellipsis if necessary)
      this.ctx.fillStyle = '#64748B';
      this.ctx.font = '600 10px sans-serif';
      let tagline = game.tagline;
      if (this.ctx.measureText(tagline).width > maxTextW) {
        while (tagline.length > 4 && this.ctx.measureText(tagline + '…').width > maxTextW) {
          tagline = tagline.slice(0, -1);
        }
        tagline += '…';
      }
      this.ctx.fillText(tagline, cardX + cardW / 2, cardY + artH + 42);

      // Tactile "HOW TO PLAY ▶" 3D Button Banner
      const btnY = cardY + cardH - 28;
      const btnH = 22;
      // 3D bottom bevel
      this.drawRoundedRect(cardX + 10, btnY + 2, cardW - 20, btnH, 6, '#86EFAC');
      // Button face
      const howToPlayGrad = this.ctx.createLinearGradient(cardX + 10, btnY, cardX + cardW - 10, btnY + btnH);
      howToPlayGrad.addColorStop(0, '#F0FDF4');
      howToPlayGrad.addColorStop(1, '#DCFCE7');
      this.drawRoundedRect(cardX + 10, btnY, cardW - 20, btnH, 6, howToPlayGrad, '#4ADE80', 1.3);
      this.ctx.fillStyle = '#15803D';
      this.drawFittedButtonText('HOW TO PLAY ▶', cardX + cardW / 2, btnY + 15, cardW - 28, 10.5, 7.5);
    }

    this.ctx.restore();

    // Sleek pill scrollbar track & thumb
    if (this.maxScrollY > 0) {
      const scrollTrackX = galleryX + galleryW - 8;
      const scrollTrackY = galleryY + 6;
      const scrollTrackH = galleryH - 12;
      this.drawRoundedRect(scrollTrackX, scrollTrackY, 6, scrollTrackH, 3, '#E2E8F0');

      const thumbH = Math.max(36, (galleryH / totalContentH) * scrollTrackH);
      const thumbY = scrollTrackY + (this.scrollY / this.maxScrollY) * (scrollTrackH - thumbH);
      const thumbGrad = this.ctx.createLinearGradient(scrollTrackX, thumbY, scrollTrackX + 6, thumbY);
      thumbGrad.addColorStop(0, '#94A3B8');
      thumbGrad.addColorStop(1, '#64748B');
      this.drawRoundedRect(scrollTrackX, thumbY, 6, thumbH, 3, thumbGrad);
    }
  }

  private renderGameModal(w: number, h: number) {
    this.modalCloudHitboxes = [];
    const game = GAME_CATALOG[this.modalGameIndex];
    if (!game) return;

    // Deep dark frosted backdrop overlay
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    this.ctx.fillRect(0, 0, w, h);

    // Modal Card sizing
    const modalW = Math.min(560, w * 0.92);
    const modalH = (game.id === 'skyline_sumo' || game.id === 'sumo_lode_runner')
      ? (w < 460 && h >= 540 ? Math.min(502, h * 0.92) : Math.min(585, h * 0.95))
      : Math.min(545, h * 0.92);
    const modalX = w / 2 - modalW / 2;
    const modalY = h / 2 - modalH / 2;

    // Card background with 3D depth and deep shadow
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
    this.ctx.shadowBlur = 32;
    this.ctx.shadowOffsetY = 14;

    // 3D bevel
    this.drawRoundedRect(modalX, modalY + 4, modalW, modalH, 18, '#CBD5E1');
    // Main card
    this.drawRoundedRect(modalX, modalY, modalW, modalH, 18, '#FFFFFF', '#CBD5E1', 2);
    this.ctx.restore();

    // Top Header Strip: Category Pill & Mode Pill & Interactive Star Rating + Save & Close Button
    const catColors: Record<string, string> = {
      Action: '#DC2626',
      Physics: '#7C3AED',
      Reflex: '#D97706',
      Racing: '#059669',
      Party: '#EA580C',
      Puzzle: '#0284C7'
    };
    const catColor = catColors[game.category] || '#0284C7';
    this.drawRoundedRect(modalX + 16, modalY + 12, 72, 22, 6, catColor);
    this.ctx.fillStyle = '#FFFFFF';
    this.drawFittedButtonText(game.category.toUpperCase(), modalX + 52, modalY + 26.5, 64, 9.5, 7.5);

    const headerSubPill = game.id === 'sumo_lode_runner' ? '40 STAGES' : '1–4P ARCADE';
    const subPillW = game.id === 'sumo_lode_runner' ? 84 : 84;
    this.drawRoundedRect(modalX + 94, modalY + 12, subPillW, 22, 6, '#F1F5F9', '#CBD5E1', 1);
    this.ctx.fillStyle = '#0284C7';
    this.drawFittedButtonText(headerSubPill, modalX + 94 + subPillW / 2, modalY + 26.5, subPillW - 8, 9.0, 7.5);

    // Interactive 1–5 Star Rating + ❤️ Save Controls in Modal Header
    const cloudStats = this.cloud.getGameStats(game.id);
    const effRating = this.cloud.getEffectiveRating(game.id);
    const activeStars = cloudStats.userRating > 0 ? cloudStats.userRating : Math.round(effRating);
    const starBarX = modalX + 94 + subPillW + 8;
    const starBtnW = modalW < 400 ? 17 : 20;
    if (starBarX + 5 * (starBtnW + 2) < modalX + modalW - 36) {
      for (let s = 1; s <= 5; s++) {
        const sx = starBarX + (s - 1) * (starBtnW + 2);
        const isLit = s <= activeStars;
        this.drawRoundedRect(
          sx,
          modalY + 12,
          starBtnW,
          22,
          5,
          isLit ? '#FEF3C7' : '#F8FAFC',
          isLit ? '#F59E0B' : '#CBD5E1',
          1
        );
        this.ctx.fillStyle = isLit ? '#D97706' : '#94A3B8';
        this.ctx.font = '900 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('★', sx + starBtnW / 2, modalY + 27);
        const starVal = s;
        this.modalCloudHitboxes.push({
          x: sx,
          y: modalY + 10,
          w: starBtnW,
          h: 26,
          action: () => this.rateGame(game.id, starVal)
        });
      }
    }

    // Save / Bookmark Pill Button
    const saveBtnX = starBarX + 5 * (starBtnW + 2) + 6;
    const saveBtnW = 68;
    if (saveBtnX + saveBtnW < modalX + modalW - 44) {
      this.drawRoundedRect(
        saveBtnX,
        modalY + 12,
        saveBtnW,
        22,
        6,
        cloudStats.saved ? '#FCE7F3' : '#F8FAFC',
        cloudStats.saved ? '#EC4899' : '#CBD5E1',
        1.2
      );
      this.ctx.fillStyle = cloudStats.saved ? '#BE185D' : '#475569';
      this.drawFittedButtonText(cloudStats.saved ? '❤️ SAVED' : '🤍 SAVE', saveBtnX + saveBtnW / 2, modalY + 26.5, saveBtnW - 8, 9.0, 7.0);
      this.modalCloudHitboxes.push({
        x: saveBtnX,
        y: modalY + 10,
        w: saveBtnW,
        h: 26,
        action: () => this.toggleSaveGame(game.id)
      });
    }

    // Close Button "✕" (Tactile circle in top-right header, completely clear of artwork)
    const closeBtnX = modalX + modalW - 24;
    const closeBtnY = modalY + 22;
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetY = 2;
    this.ctx.fillStyle = '#F1F5F9';
    this.ctx.beginPath();
    this.ctx.arc(closeBtnX, closeBtnY, 14, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#CBD5E1';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.fillStyle = '#475569';
    this.ctx.font = '900 13px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('✕', closeBtnX, closeBtnY + 4.5);

    // Hero Full-Art banner with rounded clipping (Placed cleanly below header, scaled on compact viewports)
    const artY = modalY + 40;
    const isCompactModal = w < 460 || h < 540;
    const artH = h < 440 ? 58 : isCompactModal ? 88 : game.id === 'sumo_lode_runner' ? 116 : 142;
    this.ctx.save();
    this.ctx.beginPath();
    if (this.ctx.roundRect) {
      this.ctx.roundRect(modalX + 14, artY, modalW - 28, artH, 12);
    } else {
      this.ctx.rect(modalX + 14, artY, modalW - 28, artH);
    }
    this.ctx.clip();
    renderGameThumbnailArt(this.ctx, game.id, modalX + 14, artY, modalW - 28, artH);

    // Subtle bottom gradient vignette inside hero art
    const artVignette = this.ctx.createLinearGradient(modalX, artY + artH - 30, modalX, artY + artH);
    artVignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    artVignette.addColorStop(1, 'rgba(0, 0, 0, 0.40)');
    this.ctx.fillStyle = artVignette;
    this.ctx.fillRect(modalX + 14, artY + artH - 30, modalW - 28, 30);
    this.ctx.restore();

    // Hero banner fine border
    this.ctx.save();
    this.ctx.beginPath();
    if (this.ctx.roundRect) {
      this.ctx.roundRect(modalX + 14, artY, modalW - 28, artH, 12);
    } else {
      this.ctx.rect(modalX + 14, artY, modalW - 28, artH);
    }
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();

    // Game Title & Tagline (Auto-fit title & tagline so they never overflow)
    this.ctx.fillStyle = '#0F172A';
    this.ctx.font = isCompactModal ? '900 18px Montserrat, sans-serif' : game.id === 'sumo_lode_runner' ? '900 21px Montserrat, sans-serif' : '900 23px Montserrat, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(game.title, modalX + modalW / 2, artY + artH + 22, modalW - 28);

    this.ctx.fillStyle = '#0284C7';
    this.ctx.font = isCompactModal ? 'bold 11px Montserrat, sans-serif' : 'bold 12px Montserrat, sans-serif';
    this.ctx.fillText(game.tagline, modalX + modalW / 2, artY + artH + 38, modalW - 28);

    // How to Play Instructions or Custom Mode Config
    if (game.id === 'skyline_sumo') {
      this.sumoHitboxes = [];

      // Mode Selector Tabs (Standard 60s vs Just For Fun No Limit)
      const tabW = (modalW - 56) / 2;
      const tabH = 32;
      const tabY = artY + artH + 56;
      const tab1X = modalX + 24;
      const tab2X = tab1X + tabW + 8;

      const isStd = this.sumoMode === 'standard';
      this.sumoHitboxes.push({
        id: 'sumo_mode_standard',
        x: tab1X,
        y: tabY,
        w: tabW,
        h: tabH,
        action: () => { this.sumoMode = 'standard'; this.audio.playTap(); }
      });
      this.sumoHitboxes.push({
        id: 'sumo_mode_no_limit',
        x: tab2X,
        y: tabY,
        w: tabW,
        h: tabH,
        action: () => { this.sumoMode = 'no_limit'; this.audio.playTap(); }
      });

      // Render Tab 1 (Standard)
      this.ctx.save();
      this.drawRoundedRect(tab1X, tabY, tabW, tabH, 8, isStd ? '#0284C7' : '#F1F5F9', isStd ? '#38BDF8' : '#CBD5E1', 1.5);
      this.ctx.fillStyle = isStd ? '#FFFFFF' : '#64748B';
      this.ctx.font = '900 11px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🏆 60s STANDARD MATCH', tab1X + tabW / 2, tabY + 20, tabW - 8);
      this.ctx.restore();

      // Render Tab 2 (Just For Fun)
      this.ctx.save();
      this.drawRoundedRect(tab2X, tabY, tabW, tabH, 8, !isStd ? '#7C3AED' : '#F1F5F9', !isStd ? '#A78BFA' : '#CBD5E1', 1.5);
      this.ctx.fillStyle = !isStd ? '#FFFFFF' : '#64748B';
      this.ctx.font = '900 11px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('⚡ JUST FOR FUN (NO LIMIT)', tab2X + tabW / 2, tabY + 20, tabW - 8);
      this.ctx.restore();

      if (!isStd) {
        // Just For Fun Altitude Config
        const altY = tabY + 40;
        this.ctx.fillStyle = '#0F172A';
        this.ctx.font = '900 13px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`🎯 CHOOSE TARGET ALTITUDE TO REACH: ${this.sumoTargetMeters}m`, modalX + modalW / 2, altY + 12, modalW - 32);

        const btnOptions = [
          { label: '100m', val: 100 },
          { label: '250m', val: 250 },
          { label: '500m', val: 500 },
          { label: '1,000m', val: 1000 },
          { label: '− 50m', step: -50 },
          { label: '+ 50m', step: 50 },
          { label: '✏️ Custom', custom: true }
        ];

        const rowW = modalW - 48;
        const pillCount = btnOptions.length;
        const pillGap = 5;
        const pillW = (rowW - pillGap * (pillCount - 1)) / pillCount;
        const pillH = 26;
        const pillY = altY + 22;

        btnOptions.forEach((opt, oIdx) => {
          const pillX = modalX + 24 + oIdx * (pillW + pillGap);
          const isSelected = opt.val === this.sumoTargetMeters;

          this.sumoHitboxes.push({
            id: `sumo_alt_${opt.label}`,
            x: pillX,
            y: pillY,
            w: pillW,
            h: pillH,
            action: () => {
              if (opt.val) {
                this.sumoTargetMeters = opt.val;
                this.audio.playTap();
              } else if (opt.step) {
                this.sumoTargetMeters = Math.max(50, Math.min(5000, this.sumoTargetMeters + opt.step));
                this.audio.playTap();
              } else if (opt.custom) {
                const res = window.prompt('Enter target altitude to reach in meters (50 - 5000):', String(this.sumoTargetMeters));
                if (res) {
                  const num = parseInt(res, 10);
                  if (!isNaN(num)) {
                    this.sumoTargetMeters = Math.max(50, Math.min(5000, num));
                    this.audio.playCoin();
                  }
                }
              }
            }
          });

          this.ctx.save();
          this.drawRoundedRect(
            pillX,
            pillY,
            pillW,
            pillH,
            6,
            isSelected ? '#7C3AED' : '#F8FAFC',
            isSelected ? '#C4B5FD' : '#CBD5E1',
            isSelected ? 1.5 : 1
          );
          this.ctx.fillStyle = isSelected ? '#FFFFFF' : '#334155';
          this.ctx.font = '800 9px Montserrat, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(opt.label, pillX + pillW / 2, pillY + 16.5, pillW - 4);
          this.ctx.restore();
        });

        this.ctx.fillStyle = '#64748B';
        this.ctx.font = '600 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('⏱ Live stopwatch counts your climb. First to conquer the summit wins!', modalX + modalW / 2, pillY + 38, modalW - 32);
      } else {
        this.ctx.fillStyle = '#334155';
        this.ctx.font = '13px sans-serif';
        this.ctx.textAlign = 'center';
        this.wrapText(game.instructions, modalX + modalW / 2, tabY + 48, modalW - 48, 17);
      }
    } else if (game.id === 'sumo_lode_runner') {
      this.sumoHitboxes = [];
      const totalLevels = SUMO_LODE_LEVELS.length;
      const bp = this.lodeRunnerLevel <= 0 ? SUMO_LODE_TUTORIAL_LEVEL : (SUMO_LODE_LEVELS[this.lodeRunnerLevel - 1] || SUMO_LODE_LEVELS[0]);
      const sidePad = modalW < 400 ? 14 : 24;
      const rowW = modalW - sidePad * 2;

      // ROW 1: 1P SOLO (NO CPU) vs 2P CO-OP / VS CPU Mode Toggle
      const modeY = artY + artH + 46;
      const modeH = 26;
      const modeW = (rowW - 8) / 2;
      const mode1X = modalX + sidePad;
      const mode2X = mode1X + modeW + 8;

      this.sumoHitboxes.push({
        id: 'lode_mode_solo',
        x: mode1X,
        y: modeY,
        w: modeW,
        h: modeH,
        action: () => {
          this.lodeRunnerSoloMode = true;
          this.setPlayerCount(0);
          this.audio.playTap();
        }
      });
      this.sumoHitboxes.push({
        id: 'lode_mode_2p',
        x: mode2X,
        y: modeY,
        w: modeW,
        h: modeH,
        action: () => {
          this.lodeRunnerSoloMode = false;
          if (this.players.filter((p) => p.type !== 'disabled').length < 2) {
            this.setPlayerCount(1);
          }
          this.audio.playTap();
        }
      });

      this.ctx.save();
      this.drawRoundedRect(
        mode1X,
        modeY,
        modeW,
        modeH,
        6,
        this.lodeRunnerSoloMode ? '#16A34A' : '#F8FAFC',
        this.lodeRunnerSoloMode ? '#86EFAC' : '#CBD5E1',
        this.lodeRunnerSoloMode ? 1.5 : 1
      );
      this.ctx.fillStyle = this.lodeRunnerSoloMode ? '#FFFFFF' : '#475569';
      this.ctx.font = modeW < 175 ? '900 9px Montserrat, sans-serif' : '900 10px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        modeW < 175 ? '👤 1P SOLO (NO CPU)' : '👤 1P SOLO PUZZLE (NO CPU)',
        mode1X + modeW / 2,
        modeY + 16.5,
        modeW - 8
      );

      this.drawRoundedRect(
        mode2X,
        modeY,
        modeW,
        modeH,
        6,
        !this.lodeRunnerSoloMode ? '#0284C7' : '#F8FAFC',
        !this.lodeRunnerSoloMode ? '#38BDF8' : '#CBD5E1',
        !this.lodeRunnerSoloMode ? 1.5 : 1
      );
      this.ctx.fillStyle = !this.lodeRunnerSoloMode ? '#FFFFFF' : '#475569';
      this.ctx.font = modeW < 175 ? '900 9px Montserrat, sans-serif' : '900 10px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        modeW < 175 ? '👥 2P CO-OP / VS CPU' : '👥 2P CO-OP / VS CPU BOT',
        mode2X + modeW / 2,
        modeY + 16.5,
        modeW - 8
      );
      this.ctx.restore();

      // ROW 2: Chapter Quick-Jump Pills (Dojo 0 | 1983 1-10 | Ch 2 11-16 | Ch 3 17-22 | Ch 4 23-28 | Ch 5 29-40)
      const chapY = modeY + 31;
      const chapH = 24;
      const chapGap = 4;
      const chapW = (rowW - chapGap * 5) / 6;
      const chapOpts: { label: string; shortLabel: string; startLvl: number; endLvl: number }[] = [
        { label: '🎓 Dojo (0)', shortLabel: '🎓 Dojo', startLvl: 0, endLvl: 0 },
        { label: '1983 (1-10)', shortLabel: '1-10', startLvl: 1, endLvl: 10 },
        { label: 'Ch 2 (11-16)', shortLabel: '11-16', startLvl: 11, endLvl: 16 },
        { label: 'Ch 3 (17-22)', shortLabel: '17-22', startLvl: 17, endLvl: 22 },
        { label: 'Ch 4 (23-28)', shortLabel: '23-28', startLvl: 23, endLvl: 28 },
        { label: 'Ch 5 (29-40)', shortLabel: '29-40', startLvl: 29, endLvl: 40 }
      ];

      chapOpts.forEach((ch, cIdx) => {
        const cx = modalX + sidePad + cIdx * (chapW + chapGap);
        const isCurrentChap = this.lodeRunnerLevel >= ch.startLvl && this.lodeRunnerLevel <= ch.endLvl;

        this.sumoHitboxes.push({
          id: `lode_chap_${ch.label}`,
          x: cx,
          y: chapY,
          w: chapW,
          h: chapH,
          action: () => {
            this.lodeRunnerLevel = ch.startLvl;
            this.audio.playTap();
          }
        });

        this.ctx.save();
        this.drawRoundedRect(
          cx,
          chapY,
          chapW,
          chapH,
          6,
          isCurrentChap ? '#0F172A' : '#F1F5F9',
          isCurrentChap ? '#38BDF8' : '#CBD5E1',
          isCurrentChap ? 1.5 : 1
        );
        this.ctx.fillStyle = isCurrentChap ? '#38BDF8' : '#334155';
        this.ctx.font = chapW < 58 ? '800 8px Montserrat, sans-serif' : '800 8.5px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(chapW < 58 ? ch.shortLabel : ch.label, cx + chapW / 2, chapY + 15.5, chapW - 4);
        this.ctx.restore();
      });

      // ROW 3: Stage Stepper Bar [ ◀ PREV ]  Stage X/40: Title (N Oni)  [ NEXT ▶ ]
      const stepY = chapY + 29;
      const stepH = 28;
      const navBtnW = modalW < 420 ? 50 : 68;
      const prevX = modalX + sidePad;
      const nextX = modalX + modalW - sidePad - navBtnW;
      const infoX = prevX + navBtnW + 5;
      const infoW = nextX - infoX - 5;

      this.sumoHitboxes.push({
        id: 'lode_stage_prev',
        x: prevX,
        y: stepY,
        w: navBtnW,
        h: stepH,
        action: () => {
          this.lodeRunnerLevel = Math.max(0, this.lodeRunnerLevel - 1);
          this.audio.playTap();
        }
      });
      this.sumoHitboxes.push({
        id: 'lode_stage_next',
        x: nextX,
        y: stepY,
        w: navBtnW,
        h: stepH,
        action: () => {
          this.lodeRunnerLevel = Math.min(totalLevels, this.lodeRunnerLevel + 1);
          this.audio.playTap();
        }
      });

      this.ctx.save();
      this.drawRoundedRect(prevX, stepY, navBtnW, stepH, 6, '#F8FAFC', '#94A3B8', 1.2);
      this.drawRoundedRect(nextX, stepY, navBtnW, stepH, 6, '#F8FAFC', '#94A3B8', 1.2);
      this.ctx.fillStyle = '#0F172A';
      this.ctx.font = modalW < 420 ? '900 9px Montserrat, sans-serif' : '900 10px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('◀ PREV', prevX + navBtnW / 2, stepY + 18, navBtnW - 4);
      this.ctx.fillText('NEXT ▶', nextX + navBtnW / 2, stepY + 18, navBtnW - 4);

      // Center Stage Info Pill
      this.drawRoundedRect(infoX, stepY, infoW, stepH, 6, '#EFF6FF', '#93C5FD', 1.2);
      this.ctx.fillStyle = '#1E3A8A';
      const stageDesc =
        this.lodeRunnerLevel === 0
          ? `🎓 Stage 0: ${bp.title}`
          : `🎌 Stage ${this.lodeRunnerLevel}/${totalLevels}: ${bp.title} (${bp.guardCount} Oni)`;
      let stgFont = 10.5;
      this.ctx.font = `900 ${stgFont}px Montserrat, sans-serif`;
      while (this.ctx.measureText(stageDesc).width > infoW - 10 && stgFont > 7.5) {
        stgFont -= 0.5;
        this.ctx.font = `900 ${stgFont}px Montserrat, sans-serif`;
      }
      this.ctx.fillText(stageDesc, infoX + infoW / 2, stepY + 18, infoW - 8);
      this.ctx.restore();

      // ROW 4: Concise instructions cleanly above CONTROLS box (hidden if ultra-short landscape modal)
      const ctrlYEst = modalY + modalH - 114;
      if (stepY + 42 < ctrlYEst - 8) {
        this.ctx.fillStyle = '#334155';
        this.ctx.font = isCompactModal ? '10.5px sans-serif' : '11.5px sans-serif';
        this.ctx.textAlign = 'center';
        this.wrapText(game.instructions, modalX + modalW / 2, stepY + 42, modalW - sidePad * 2, isCompactModal ? 13 : 14.5);
      }
    } else {
      // Standard Instructions
      this.ctx.fillStyle = '#334155';
      this.ctx.font = isCompactModal ? '11.5px sans-serif' : '13px sans-serif';
      this.ctx.textAlign = 'center';
      this.wrapText(game.instructions, modalX + modalW / 2, artY + artH + 58, modalW - 40, isCompactModal ? 14.5 : 17);
    }

    // Controls Prompt Box (High-contrast mint container, auto-fitted so text never touches mascots)
    const ctrlY = modalY + modalH - 114;
    this.drawRoundedRect(modalX + 24, ctrlY, modalW - 48, 30, 8, '#F0FDF4', '#86EFAC', 1.5);
    this.ctx.fillStyle = '#166534';
    this.ctx.textAlign = 'center';
    const ctrlText = `CONTROLS: ${game.controlPrompt}`;
    const maxCtrlTextW = modalW - 142; // Keep clear of flanking mascots at modalX + 44 and modalX + modalW - 44
    let ctrlFont = 10.5;
    this.ctx.font = `900 ${ctrlFont}px Montserrat, sans-serif`;
    while (this.ctx.measureText(ctrlText).width > maxCtrlTextW && ctrlFont > 7.5) {
      ctrlFont -= 0.5;
      this.ctx.font = `900 ${ctrlFont}px Montserrat, sans-serif`;
    }
    this.ctx.fillText(ctrlText, modalX + modalW / 2, ctrlY + 19, maxCtrlTextW);

    // Player Mascots flanking the controls box
    const isBotP2 = this.players[1].type.startsWith('bot_');
    drawCharacter(this.ctx, modalX + 44, ctrlY + 15, 13, 0, false, 'happy', performance.now() * 0.001);
    drawCharacter(this.ctx, modalX + modalW - 44, ctrlY + 15, 13, 1, isBotP2, 'happy', performance.now() * 0.001);

    // Player Key Shortcuts Badge
    this.ctx.fillStyle = '#64748B';
    this.ctx.font = '600 10px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('P1: [WASD / Q,E]  •  P2: [Arrows / , .]  •  iPhone Touch Deck Ready', modalX + modalW / 2, ctrlY + 44, modalW - 32);

    // Play Button (Sitting cleanly with margin above bottom card bevel)
    const btnW = Math.min(280, modalW - 32);
    const btnH = 44;
    const btnX = modalX + modalW / 2 - btnW / 2;
    const btnY = modalY + modalH - 62;

    this.ctx.save();
    this.ctx.shadowColor = 'rgba(22, 163, 74, 0.45)';
    this.ctx.shadowBlur = 14;
    this.ctx.shadowOffsetY = 4;
    // 3D bottom bevel
    this.drawRoundedRect(btnX, btnY + 4, btnW, btnH - 1, 12, '#15803D');
    // Button face
    const btnGrad = this.ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    btnGrad.addColorStop(0, '#22C55E');
    btnGrad.addColorStop(1, '#16A34A');
    this.drawRoundedRect(btnX, btnY, btnW, btnH - 2, 12, btnGrad, '#86EFAC', 2);
    this.ctx.restore();

    const playText = game.id === 'skyline_sumo' && this.sumoMode === 'no_limit'
      ? `▶ START SPEEDRUN [${this.sumoTargetMeters}m]`
      : game.id === 'sumo_lode_runner'
      ? (this.lodeRunnerLevel === 0 ? '▶ START TUTORIAL DOJO [Space]' : `▶ PLAY STAGE ${this.lodeRunnerLevel}/${SUMO_LODE_LEVELS.length} [Space]`)
      : '▶ PLAY GAME [Space / Enter]';

    this.ctx.fillStyle = '#FFFFFF';
    this.drawFittedButtonText(playText, modalX + modalW / 2, btnY + 27, btnW - 16, 14, 9.5);

    if (game.id === 'skyline_sumo' || game.id === 'sumo_lode_runner') {
      this.sumoHitboxes.push({
        id: 'sumo_play_btn',
        x: btnX - 10,
        y: btnY - 14,
        w: btnW + 20,
        h: btnH + 22,
        action: () => {
          this.audio.playTap();
          this.startGame(game.id);
        }
      });
    }
  }

  private renderSettingsModal(w: number, h: number) {
    this.settingsHitBoxes = [];

    // Dark backdrop overlay
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
    this.ctx.fillRect(0, 0, w, h);

    const modalW = Math.min(560, w * 0.94);
    const modalH = Math.min(540, h * 0.94);
    const modalX = w / 2 - modalW / 2;
    const modalY = h / 2 - modalH / 2;

    // 3D Card background
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    this.ctx.shadowBlur = 32;
    this.ctx.shadowOffsetY = 12;

    // 3D bevel
    this.drawRoundedRect(modalX, modalY + 4, modalW, modalH, 18, '#CBD5E1');
    // Card face
    this.drawRoundedRect(modalX, modalY, modalW, modalH, 18, '#FFFFFF', '#CBD5E1', 2);
    this.ctx.restore();

    // Close button "✕"
    const closeBtnX = modalX + modalW - 28;
    const closeBtnY = modalY + 28;
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetY = 2;
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    this.ctx.beginPath();
    this.ctx.arc(closeBtnX, closeBtnY, 15, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '900 13px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('✕', closeBtnX, closeBtnY + 4.5);

    this.settingsHitBoxes.push({
      id: 'close',
      action: () => this.closeSettings(),
      x: closeBtnX - 16,
      y: closeBtnY - 16,
      w: 32,
      h: 32
    });

    // Header Title & Subtitle
    this.ctx.fillStyle = '#0F172A';
    this.ctx.font = '900 22px Montserrat, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('⚙️ SETTINGS & PREFERENCES', modalX + 24, modalY + 34);

    this.ctx.fillStyle = '#64748B';
    this.ctx.font = '600 11.5px sans-serif';
    this.ctx.fillText('Audio, Game Speed, Tournament Rules & Controls', modalX + 26, modalY + 50);

    // Separator
    this.ctx.strokeStyle = '#E2E8F0';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(modalX + 24, modalY + 62);
    this.ctx.lineTo(modalX + modalW - 24, modalY + 62);
    this.ctx.stroke();

    // SECTION 1: 🔊 AUDIO SETTINGS
    let curY = modalY + 72;
    this.ctx.fillStyle = '#0284C7';
    this.ctx.font = '900 11px Montserrat, sans-serif';
    this.ctx.fillText('🔊 AUDIO SETTINGS', modalX + 26, curY + 10);

    // Master Volume row
    curY += 20;
    this.ctx.fillStyle = '#334155';
    this.ctx.font = 'bold 11px Montserrat, sans-serif';
    this.ctx.fillText('Master Volume:', modalX + 26, curY + 16);

    const volOptions: { label: string; val: number }[] = [
      { label: 'MUTE', val: 0.0 },
      { label: '25%', val: 0.25 },
      { label: '50%', val: 0.5 },
      { label: '75%', val: 0.75 },
      { label: '100%', val: 1.0 }
    ];
    const labelOffset = modalW < 440 ? 114 : 140;
    const availRowW = Math.max(180, modalW - labelOffset - 20);
    const volPillW = Math.min(58, Math.floor((availRowW - 4 * 5) / 5));
    const volPillH = 24;
    const volStartX = modalX + labelOffset;
    volOptions.forEach((opt, idx) => {
      const px = volStartX + idx * (volPillW + 5);
      const isSel = Math.abs(this.settings.masterVolume - opt.val) < 0.05;

      this.ctx.save();
      if (isSel) {
        this.ctx.shadowColor = 'rgba(2, 132, 199, 0.35)';
        this.ctx.shadowBlur = 6;
        this.ctx.shadowOffsetY = 2;
        this.drawRoundedRect(px, curY + 2, volPillW, volPillH, 5, '#0369A1');
        const grad = this.ctx.createLinearGradient(px, curY, px, curY + volPillH);
        grad.addColorStop(0, '#0284C7');
        grad.addColorStop(1, '#0369A1');
        this.drawRoundedRect(px, curY, volPillW, volPillH, 5, grad, '#7DD3FC', 1.5);
      } else {
        this.drawRoundedRect(px, curY, volPillW, volPillH, 5, '#FFFFFF', '#CBD5E1', 1);
      }
      this.ctx.restore();

      this.ctx.fillStyle = isSel ? '#FFFFFF' : '#475569';
      this.drawFittedButtonText(opt.label, px + volPillW / 2, curY + 16, volPillW - 6, 10, 7.5);

      this.settingsHitBoxes.push({
        id: `vol_${opt.val}`,
        action: () => {
          this.settings.masterVolume = opt.val;
          this.applySettings();
          this.audio.playTap();
        },
        x: px,
        y: curY,
        w: volPillW,
        h: volPillH
      });
    });

    // Sound FX row
    curY += 32;
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#334155';
    this.ctx.font = 'bold 11px Montserrat, sans-serif';
    this.ctx.fillText('Sound Effects:', modalX + 26, curY + 16);

    const sfxOptions = [
      { label: '✓ ON', val: true },
      { label: '✕ OFF', val: false }
    ];
    const sfxW = Math.min(68, Math.floor((availRowW - 8) / 2));
    sfxOptions.forEach((opt, idx) => {
      const px = volStartX + idx * (sfxW + 8);
      const isSel = this.settings.sfxEnabled === opt.val;

      this.ctx.save();
      if (isSel) {
        const strokeColor = opt.val ? '#86EFAC' : '#FCA5A5';
        const bevelColor = opt.val ? '#15803D' : '#991B1B';
        const gradColor = opt.val ? '#16A34A' : '#DC2626';
        this.drawRoundedRect(px, curY + 2, sfxW, volPillH, 5, bevelColor);
        this.drawRoundedRect(px, curY, sfxW, volPillH, 5, gradColor, strokeColor, 1.5);
      } else {
        this.drawRoundedRect(px, curY, sfxW, volPillH, 5, '#FFFFFF', '#CBD5E1', 1);
      }
      this.ctx.restore();

      this.ctx.fillStyle = isSel ? '#FFFFFF' : '#475569';
      this.drawFittedButtonText(opt.label, px + sfxW / 2, curY + 16, sfxW - 6, 10, 7.5);

      this.settingsHitBoxes.push({
        id: `sfx_${opt.val}`,
        action: () => {
          this.settings.sfxEnabled = opt.val;
          this.applySettings();
          this.audio.playTap();
        },
        x: px,
        y: curY,
        w: sfxW,
        h: volPillH
      });
    });

    // Separator
    curY += 36;
    this.ctx.strokeStyle = '#E2E8F0';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(modalX + 24, curY);
    this.ctx.lineTo(modalX + modalW - 24, curY);
    this.ctx.stroke();

    // SECTION 2: ⚡ GAMEPLAY & TOURNAMENT
    curY += 12;
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#DC2626';
    this.ctx.font = '900 11px Montserrat, sans-serif';
    this.ctx.fillText('⚡ GAMEPLAY & TOURNAMENT', modalX + 26, curY + 10);

    // Game Speed row
    curY += 20;
    this.ctx.fillStyle = '#334155';
    this.ctx.font = 'bold 11px Montserrat, sans-serif';
    this.ctx.fillText('Game Speed:', modalX + 26, curY + 16);

    const speedOptions = [
      { label: '1.0x NORMAL', val: 1.0 },
      { label: '1.3x FAST', val: 1.3 },
      { label: '1.6x TURBO', val: 1.6 }
    ];
    const spdW = Math.min(96, Math.floor((availRowW - 12) / 3));
    speedOptions.forEach((opt, idx) => {
      const px = volStartX + idx * (spdW + 6);
      const isSel = Math.abs(this.settings.gameSpeed - opt.val) < 0.05;

      this.ctx.save();
      if (isSel) {
        this.drawRoundedRect(px, curY + 2, spdW, volPillH, 5, '#6D28D9');
        this.drawRoundedRect(px, curY, spdW, volPillH, 5, '#7C3AED', '#C4B5FD', 1.5);
      } else {
        this.drawRoundedRect(px, curY, spdW, volPillH, 5, '#FFFFFF', '#CBD5E1', 1);
      }
      this.ctx.restore();

      this.ctx.fillStyle = isSel ? '#FFFFFF' : '#475569';
      this.drawFittedButtonText(opt.label, px + spdW / 2, curY + 16, spdW - 6, 10, 7.0);

      this.settingsHitBoxes.push({
        id: `spd_${opt.val}`,
        action: () => {
          this.settings.gameSpeed = opt.val;
          this.applySettings();
          this.audio.playTap();
        },
        x: px,
        y: curY,
        w: spdW,
        h: volPillH
      });
    });

    // Tournament Goal Points row
    curY += 32;
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#334155';
    this.ctx.font = 'bold 11px Montserrat, sans-serif';
    this.ctx.fillText('Cup Goal Points:', modalX + 26, curY + 16);

    const goalOptions = [3, 5, 7, 10];
    const goalW = Math.min(68, Math.floor((availRowW - 18) / 4));
    goalOptions.forEach((pts, idx) => {
      const px = volStartX + idx * (goalW + 6);
      const isSel = this.settings.tournamentGoal === pts;

      this.ctx.save();
      if (isSel) {
        this.drawRoundedRect(px, curY + 2, goalW, volPillH, 5, '#B45309');
        this.drawRoundedRect(px, curY, goalW, volPillH, 5, '#D97706', '#FDE68A', 1.5);
      } else {
        this.drawRoundedRect(px, curY, goalW, volPillH, 5, '#FFFFFF', '#CBD5E1', 1);
      }
      this.ctx.restore();

      this.ctx.fillStyle = isSel ? '#FFFFFF' : '#475569';
      this.drawFittedButtonText(`${pts} PTS`, px + goalW / 2, curY + 16, goalW - 6, 10, 7.5);

      this.settingsHitBoxes.push({
        id: `goal_${pts}`,
        action: () => {
          this.settings.tournamentGoal = pts;
          this.applySettings();
          this.audio.playTap();
        },
        x: px,
        y: curY,
        w: goalW,
        h: volPillH
      });
    });

    // Screen Shake row
    curY += 32;
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#334155';
    this.ctx.font = 'bold 11px Montserrat, sans-serif';
    this.ctx.fillText('Screen Shake:', modalX + 26, curY + 16);

    const shakeOptions: { label: string; val: 'full' | 'reduced' | 'off' }[] = [
      { label: 'FULL', val: 'full' },
      { label: 'REDUCED', val: 'reduced' },
      { label: 'OFF', val: 'off' }
    ];
    const shkW = Math.min(96, Math.floor((availRowW - 12) / 3));
    shakeOptions.forEach((opt, idx) => {
      const px = volStartX + idx * (shkW + 6);
      const isSel = this.settings.shakeLevel === opt.val;

      this.ctx.save();
      if (isSel) {
        this.drawRoundedRect(px, curY + 2, shkW, volPillH, 5, '#0F172A');
        this.drawRoundedRect(px, curY, shkW, volPillH, 5, '#1E293B', '#94A3B8', 1.5);
      } else {
        this.drawRoundedRect(px, curY, shkW, volPillH, 5, '#FFFFFF', '#CBD5E1', 1);
      }
      this.ctx.restore();

      this.ctx.fillStyle = isSel ? '#FFFFFF' : '#475569';
      this.drawFittedButtonText(opt.label, px + shkW / 2, curY + 16, shkW - 6, 10, 7.5);

      this.settingsHitBoxes.push({
        id: `shk_${opt.val}`,
        action: () => {
          this.settings.shakeLevel = opt.val;
          this.applySettings();
          this.audio.playTap();
        },
        x: px,
        y: curY,
        w: shkW,
        h: volPillH
      });
    });

    // Separator
    curY += 34;
    this.ctx.strokeStyle = '#E2E8F0';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(modalX + 24, curY);
    this.ctx.lineTo(modalX + modalW - 24, curY);
    this.ctx.stroke();

    // SECTION 3: 🎮 CONTROLS REFERENCE
    curY += 10;
    const refH = 64;
    this.drawRoundedRect(modalX + 24, curY, modalW - 48, refH, 8, '#F8FAFC', '#E2E8F0', 1);

    this.ctx.fillStyle = '#475569';
    this.ctx.font = '900 10px Montserrat, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('⌨️ CONTROLS & SHORTCUTS REFERENCE', modalX + 36, curY + 18, modalW - 72);

    this.ctx.fillStyle = '#334155';
    this.ctx.font = '600 10.5px monospace';
    this.ctx.fillText('P1: [WASD + Space]  •  P2: [Arrows + Enter]  •  P3: [IJKL + C]  •  P4: [Numpad / M]', modalX + 36, curY + 36, modalW - 72);
    this.ctx.fillStyle = '#64748B';
    this.ctx.fillText('Shortcuts: [Esc / P] Pause  •  [R] Random  •  [T] Cup  •  [O / S] Settings', modalX + 36, curY + 52, modalW - 72);

    // SECTION 4: 🔄 DATA ACTIONS
    curY += refH + 10;
    const resetScoreW = Math.min(186, Math.floor((modalW - 58) * 0.55));
    const resetDefW = Math.min(150, Math.floor((modalW - 58) * 0.45));
    const resetH = 26;

    // Reset Scores button
    this.drawRoundedRect(modalX + 24, curY + 2, resetScoreW, resetH, 6, '#CBD5E1');
    this.drawRoundedRect(modalX + 24, curY, resetScoreW, resetH, 6, '#F8FAFC', '#94A3B8', 1.2);
    this.ctx.fillStyle = '#334155';
    this.drawFittedButtonText('🔄 RESET TOURNAMENT SCORES', modalX + 24 + resetScoreW / 2, curY + 17, resetScoreW - 10, 10, 7.0);
    this.settingsHitBoxes.push({
      id: 'reset_scores',
      action: () => this.resetScores(),
      x: modalX + 24,
      y: curY,
      w: resetScoreW,
      h: resetH
    });

    // Restore Defaults button
    this.drawRoundedRect(modalX + 24 + resetScoreW + 10, curY + 2, resetDefW, resetH, 6, '#CBD5E1');
    this.drawRoundedRect(modalX + 24 + resetScoreW + 10, curY, resetDefW, resetH, 6, '#F8FAFC', '#94A3B8', 1.2);
    this.ctx.fillStyle = '#334155';
    this.drawFittedButtonText('↩ RESTORE DEFAULTS', modalX + 24 + resetScoreW + 10 + resetDefW / 2, curY + 17, resetDefW - 10, 10, 7.0);
    this.settingsHitBoxes.push({
      id: 'restore_defaults',
      action: () => this.restoreDefaultSettings(),
      x: modalX + 24 + resetScoreW + 10,
      y: curY,
      w: resetDefW,
      h: resetH
    });

    // BOTTOM BUTTON: ✓ SAVE & CLOSE [Esc / Enter]
    const saveBtnW = Math.min(240, modalW - 48);
    const saveBtnH = 40;
    const saveBtnX = modalX + modalW / 2 - saveBtnW / 2;
    const saveBtnY = modalY + modalH - 50;

    this.ctx.save();
    this.ctx.shadowColor = 'rgba(22, 163, 74, 0.45)';
    this.ctx.shadowBlur = 12;
    this.ctx.shadowOffsetY = 4;
    this.drawRoundedRect(saveBtnX, saveBtnY + 3, saveBtnW, saveBtnH - 1, 10, '#15803D');
    const btnGrad = this.ctx.createLinearGradient(saveBtnX, saveBtnY, saveBtnX, saveBtnY + saveBtnH);
    btnGrad.addColorStop(0, '#22C55E');
    btnGrad.addColorStop(1, '#16A34A');
    this.drawRoundedRect(saveBtnX, saveBtnY, saveBtnW, saveBtnH - 2, 10, btnGrad, '#86EFAC', 1.5);
    this.ctx.restore();

    this.ctx.fillStyle = '#FFFFFF';
    this.drawFittedButtonText('✓ SAVE & CLOSE [Esc / Enter]', saveBtnX + saveBtnW / 2, saveBtnY + 25, saveBtnW - 14, 13, 9.0);

    this.settingsHitBoxes.push({
      id: 'save_close',
      action: () => this.closeSettings(),
      x: saveBtnX,
      y: saveBtnY,
      w: saveBtnW,
      h: saveBtnH
    });
  }

  public startPackOpeningAnimation(curItem: any, res: PackResult) {
    this.packOpeningResult = res;
    const parts: { x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number }[] = [];
    const colors = [res.previewColor, '#F59E0B', '#38BDF8', '#EC4899', '#10B981', '#FFFFFF'];
    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 260;
      parts.push({
        x: this.logicalWidth / 2,
        y: this.logicalHeight / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 5,
        alpha: 1.0
      });
    }
    this.packOpeningAnim = {
      packId: curItem.id,
      packName: curItem.name,
      packColor: curItem.previewColor,
      packRarity: curItem.rarity,
      startTime: performance.now(),
      result: res,
      particles: parts
    };
    this.audio.playCountdown(false);
  }

  private renderShopModal(w: number, h: number) {
    this.shopHitBoxes = [];

    // Dark backdrop overlay
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    this.ctx.fillRect(0, 0, w, h);

    const modalW = Math.min(760, w * 0.95);
    const modalH = Math.min(560, h * 0.95);
    const modalX = w / 2 - modalW / 2;
    const modalY = h / 2 - modalH / 2;

    // 3D Card background
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    this.ctx.shadowBlur = 32;
    this.ctx.shadowOffsetY = 12;
    // 3D bevel
    this.drawRoundedRect(modalX, modalY + 4, modalW, modalH, 18, '#CBD5E1');
    // Card face
    this.drawRoundedRect(modalX, modalY, modalW, modalH, 18, '#FFFFFF', '#CBD5E1', 2);
    this.ctx.restore();

    // Close button "✕"
    const closeBtnX = modalX + modalW - 28;
    const closeBtnY = modalY + 28;
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetY = 2;
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    this.ctx.beginPath();
    this.ctx.arc(closeBtnX, closeBtnY, 15, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '900 13px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('✕', closeBtnX, closeBtnY + 4.5);

    this.shopHitBoxes.push({
      id: 'shop_close',
      action: () => this.closeShop(),
      x: closeBtnX - 16,
      y: closeBtnY - 16,
      w: 32,
      h: 32
    });

    // Header Title & Subtitle
    this.ctx.fillStyle = '#0F172A';
    this.ctx.font = '900 20px Montserrat, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('SHOP & MASCOT LOCKER', modalX + 22, modalY + 31);

    this.ctx.fillStyle = '#64748B';
    this.ctx.font = '600 11.5px sans-serif';
    this.ctx.fillText('Skins, Arena Themes, Mystery Lucky Packs & Rare Boosters', modalX + 23, modalY + 47);

    // Current Coin Balance Pill at top right
    const userCoins = EconomyManager.getInstance().getCoins();
    const pillW = 135;
    const pillH = 32;
    const pillX = modalX + modalW - 180;
    const pillY = modalY + 14;
    this.drawRoundedRect(pillX, pillY + 2, pillW, pillH, 10, '#D97706');
    this.drawRoundedRect(pillX, pillY, pillW, pillH, 10, '#FFFBEB', '#FDE68A', 1.5);
    this.drawCoinIcon(pillX + 16, pillY + 16, 9);
    this.ctx.fillStyle = '#92400E';
    this.ctx.font = '900 12.5px Montserrat, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${userCoins} COINS`, pillX + 32, pillY + 20.5);

    // Category Tabs: Dynamic counts from live catalogs
    const totalSkins = SKIN_CATALOG.length;
    const totalArenas = ARENA_CATALOG.length;
    const totalPacks = PACK_CATALOG.length;
    const totalBoosters = BOOSTER_CATALOG.length;
    const totalAll = totalSkins + totalArenas + totalPacks + totalBoosters;

    const tabs: { id: 'ALL' | 'SKINS' | 'ARENAS' | 'PACKS' | 'BOOSTERS'; label: string; count: number }[] = [
      { id: 'ALL', label: 'ALL', count: totalAll },
      { id: 'SKINS', label: 'SKINS', count: totalSkins },
      { id: 'ARENAS', label: 'ARENAS', count: totalArenas },
      { id: 'PACKS', label: 'LUCKY PACKS', count: totalPacks },
      { id: 'BOOSTERS', label: 'BOOSTERS', count: totalBoosters }
    ];

    const tabY = modalY + 58;
    const tabH = 26;
    let tabX = modalX + 22;

    tabs.forEach((tab) => {
      const isSelectedTab = this.currentShopTab === tab.id;
      const tabText = `${tab.label} (${tab.count})`;
      this.ctx.font = '900 10.5px Montserrat, sans-serif';
      const textW = this.ctx.measureText(tabText).width;
      const tW = textW + 18;

      this.ctx.save();
      if (isSelectedTab) {
        this.ctx.shadowColor = 'rgba(37, 99, 235, 0.35)';
        this.ctx.shadowBlur = 6;
        this.ctx.shadowOffsetY = 2;
        this.drawRoundedRect(tabX, tabY, tW, tabH, 8, '#2563EB');
      } else {
        this.drawRoundedRect(tabX, tabY, tW, tabH, 8, '#F1F5F9', '#CBD5E1', 1);
      }
      this.ctx.restore();

      this.ctx.fillStyle = isSelectedTab ? '#FFFFFF' : '#475569';
      this.ctx.font = '900 10.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(tabText, tabX + tW / 2, tabY + 17.5);

      this.shopHitBoxes.push({
        id: `tab_${tab.id}`,
        action: () => {
          this.currentShopTab = tab.id;
          this.selectedShopItemIndex = 0;
          this.selectedShopSkinIndex = 0;
          this.targetShopScrollY = 0;
          this.audio.playTap();
        },
        x: tabX,
        y: tabY,
        w: tW,
        h: tabH
      });

      tabX += tW + 8;
    });

    // Layout: Left Column = Scrollable Unified Catalog (270px)
    // Right Column = Rich Interactive Showcase Stage & Controls
    const listX = modalX + 20;
    const listY = modalY + 94;
    const listW = Math.min(270, modalW * 0.38);
    const listH = modalH - 110;
    const stageX = listX + listW + 16;
    const stageY = listY;
    const stageW = modalX + modalW - stageX - 20;
    const stageH = listH;

    const items = this.getUnifiedShopItems();
    this.selectedShopItemIndex = Math.max(0, Math.min(items.length - 1, this.selectedShopItemIndex));
    this.selectedShopSkinIndex = this.selectedShopItemIndex;

    const itemH = 50;
    const itemGap = 6;
    const totalContentH = items.length * (itemH + itemGap) - itemGap;
    this.maxShopScrollY = Math.max(0, totalContentH - listH);
    this.targetShopScrollY = Math.max(0, Math.min(this.maxShopScrollY, this.targetShopScrollY));

    // Outer catalog frame
    this.drawRoundedRect(listX, listY, listW, listH, 10, '#F8FAFC', '#E2E8F0', 1);

    // Clip catalog list for smooth scrolling
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(listX, listY, listW, listH);
    this.ctx.clip();

    items.forEach((item, idx) => {
      const rowY = listY + idx * (itemH + itemGap) - this.shopScrollY;
      if (rowY + itemH < listY - 10 || rowY > listY + listH + 10) return;

      const isSelected = idx === this.selectedShopItemIndex;

      this.ctx.save();
      if (isSelected) {
        this.ctx.shadowColor = 'rgba(59, 130, 246, 0.3)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetY = 2;
        this.drawRoundedRect(listX + 4, rowY + 2, listW - 8, itemH - 4, 8, '#2563EB');
        this.drawRoundedRect(listX + 4, rowY, listW - 8, itemH - 4, 8, '#EFF6FF', '#3B82F6', 1.5);
      } else {
        this.drawRoundedRect(listX + 4, rowY, listW - 8, itemH - 4, 8, '#FFFFFF', '#CBD5E1', 1);
      }
      this.ctx.restore();

      // Category Pill Tag
      let catTagBg = '#DBEAFE';
      let catTagText = '#1D4ED8';
      let catTagLabel = 'SKIN';
      if (item.category === 'ARENA') {
        catTagBg = '#D1FAE5';
        catTagText = '#047857';
        catTagLabel = 'ARENA';
      } else if (item.category === 'PACK') {
        catTagBg = '#FEF3C7';
        catTagText = '#B45309';
        catTagLabel = 'PACK';
      } else if (item.category === 'BOOSTER') {
        catTagBg = '#EDE9FE';
        catTagText = '#6D28D9';
        catTagLabel = 'BOOST';
      }

      this.drawRoundedRect(listX + 10, rowY + 6, 38, 14, 4, catTagBg);
      this.ctx.fillStyle = catTagText;
      this.ctx.font = '900 8.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(catTagLabel, listX + 29, rowY + 16.5);

      // Rarity Pip
      const rarityColor = item.rarity === 'Legendary' ? '#F59E0B' : item.rarity === 'Epic' ? '#8B5CF6' : item.rarity === 'Rare' ? '#06B6D4' : '#64748B';
      this.ctx.beginPath();
      this.ctx.arc(listX + 54, rowY + 13, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = rarityColor;
      this.ctx.fill();

      // Right-hand Mini Preview Swatch / Crest on each catalog row
      const swatchX = listX + listW - 36;
      const swatchY = rowY + 11;
      this.ctx.save();
      if (item.category === 'ARENA' && item.raw) {
        this.drawRoundedRect(swatchX - 4, swatchY, 26, 24, 5, item.raw.previewColor, item.raw.borderColor, 1.5);
        this.renderMiniArenaIcon(this.ctx, item.raw.floorPattern, swatchX + 9, swatchY + 12, item.raw.borderColor);
      } else if (item.category === 'SKIN') {
        // Draw real custom mascot character with headgear, visor, horns & aura!
        drawCharacter(this.ctx, swatchX + 9, swatchY + 12, 10, 0, false, 'idle', 0, item.id);
        this.ctx.beginPath();
        this.ctx.arc(swatchX + 9, swatchY + 12, 11, 0, Math.PI * 2);
        this.ctx.strokeStyle = rarityColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      } else if (item.category === 'BOOSTER' && item.raw) {
        this.ctx.beginPath();
        this.ctx.arc(swatchX + 9, swatchY + 12, 11, 0, Math.PI * 2);
        this.ctx.fillStyle = item.previewColor;
        this.ctx.fill();
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(item.raw.icon || '⚡', swatchX + 9, swatchY + 16);
      } else if (item.category === 'PACK') {
        this.drawRoundedRect(swatchX - 1, swatchY + 2, 20, 20, 4, item.previewColor, '#FDE68A', 1.5);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🎁', swatchX + 9, swatchY + 15.5);
      }
      this.ctx.restore();

      // Item Name
      this.ctx.fillStyle = isSelected ? '#1E3A8A' : '#0F172A';
      this.ctx.font = '900 11.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'left';
      let displayName = item.name;
      if (displayName.length > 18) displayName = displayName.substring(0, 16) + '...';
      this.ctx.fillText(displayName, listX + 63, rowY + 17);

      // Status / Price Subtext
      if (item.category === 'PACK') {
        this.drawCoinIcon(listX + 18, rowY + 33, 6);
        this.ctx.fillStyle = '#B45309';
        this.ctx.font = 'bold 10px Montserrat, sans-serif';
        this.ctx.fillText(`${item.price} COINS`, listX + 28, rowY + 36.5);
      } else if (item.isUnlocked) {
        this.ctx.fillStyle = '#059669';
        this.ctx.font = 'bold 9.5px Montserrat, sans-serif';
        if (item.category === 'ARENA') {
          const isActive = EconomyManager.getInstance().getEquippedArena() === item.id;
          this.ctx.fillText(isActive ? '✓ ACTIVE ARENA' : '✓ UNLOCKED', listX + 12, rowY + 36.5);
        } else if (item.category === 'SKIN') {
          const equippedBy: number[] = [];
          for (let p = 0; p < 4; p++) {
            if (EconomyManager.getInstance().getEquippedSkin(p as PlayerId) === item.id) {
              equippedBy.push(p + 1);
            }
          }
          if (equippedBy.length > 0) {
            this.ctx.fillText(`✓ ON P${equippedBy.join(', P')}`, listX + 12, rowY + 36.5);
          } else {
            this.ctx.fillText('✓ UNLOCKED', listX + 12, rowY + 36.5);
          }
        } else if (item.category === 'BOOSTER') {
          const equippedBy: number[] = [];
          for (let p = 0; p < 4; p++) {
            if (EconomyManager.getInstance().getEquippedBooster(p as PlayerId) === item.id) {
              equippedBy.push(p + 1);
            }
          }
          if (equippedBy.length > 0) {
            this.ctx.fillText(`✓ ON P${equippedBy.join(', P')}`, listX + 12, rowY + 36.5);
          } else {
            this.ctx.fillText('✓ UNLOCKED', listX + 12, rowY + 36.5);
          }
        }
      } else {
        this.drawCoinIcon(listX + 18, rowY + 33, 6);
        this.ctx.fillStyle = '#B45309';
        this.ctx.font = 'bold 10px Montserrat, sans-serif';
        this.ctx.fillText(`${item.price} COINS`, listX + 28, rowY + 36.5);
      }

      this.shopHitBoxes.push({
        id: `shop_item_${idx}`,
        action: () => {
          this.selectedShopItemIndex = idx;
          this.selectedShopSkinIndex = idx;
          this.audio.playTap();
        },
        x: listX + 4,
        y: Math.max(listY, rowY),
        w: listW - 8,
        h: Math.min(itemH - 4, listY + listH - rowY)
      });
    });

    this.ctx.restore();

    // Scrollbar indicator
    if (totalContentH > listH) {
      const scrollThumbH = Math.max(22, (listH / totalContentH) * listH);
      const scrollThumbY = listY + (this.shopScrollY / this.maxShopScrollY) * (listH - scrollThumbH);
      this.drawRoundedRect(listX + listW - 5, scrollThumbY, 3, scrollThumbH, 2, '#94A3B8');
    }

    // --- RIGHT COLUMN: Showcase Stage ---
    const curItem = items[this.selectedShopItemIndex] || items[0];
    const centerX = stageX + stageW / 2;

    this.drawRoundedRect(stageX, stageY, stageW, stageH, 14, '#F8FAFC', '#E2E8F0', 1.5);

    // Common Rarity Pill
    const rarityColors = {
      Legendary: { bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' },
      Epic: { bg: '#F3E8FF', border: '#E9D5FF', text: '#7E22CE' },
      Rare: { bg: '#E0F2FE', border: '#BAE6FD', text: '#0369A1' },
      Common: { bg: '#F1F5F9', border: '#E2E8F0', text: '#475569' }
    };
    const rc = rarityColors[curItem.rarity] || rarityColors.Common;

    // === CASE 1: SKIN ===
    if (curItem.category === 'SKIN') {
      // Preview Chassis Tabs: P1, P2, P3, P4
      const pTabY = stageY + 10;
      this.ctx.fillStyle = '#64748B';
      this.ctx.font = '900 11px Montserrat, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText('PREVIEW CHASSIS:', stageX + 16, pTabY + 16);

      const pBtnW = 40;
      const pBtnH = 22;
      const pBtnStartX = stageX + 140;
      for (let p = 0; p < 4; p++) {
        const pbx = pBtnStartX + p * (pBtnW + 6);
        const isSelectedP = this.shopPreviewPlayerId === p;
        const pColor = this.players[p]?.color || '#EF4444';

        if (isSelectedP) {
          this.drawRoundedRect(pbx, pTabY + 2, pBtnW, pBtnH, 6, pColor);
        } else {
          this.drawRoundedRect(pbx, pTabY + 2, pBtnW, pBtnH, 6, '#F1F5F9', '#CBD5E1', 1);
        }

        this.ctx.fillStyle = isSelectedP ? '#FFFFFF' : '#475569';
        this.ctx.font = '900 10.5px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`P${p + 1}`, pbx + pBtnW / 2, pTabY + 16.5);

        this.shopHitBoxes.push({
          id: `preview_p${p}`,
          action: () => {
            this.shopPreviewPlayerId = p as PlayerId;
            this.audio.playTap();
          },
          x: pbx,
          y: pTabY,
          w: pBtnW,
          h: pBtnH
        });
      }

      // Spotlight Beam & Holographic Turntable Pedestal
      const spotlightX = centerX;
      const spotlightY = stageY + 100;
      const stageT = performance.now() * 0.001;
      const rarityGlow = curItem.rarity === 'Legendary' ? '#F59E0B' : curItem.rarity === 'Epic' ? '#8B5CF6' : curItem.rarity === 'Rare' ? '#06B6D4' : '#64748B';

      const spotGrad = this.ctx.createRadialGradient(spotlightX, spotlightY - 6, 12, spotlightX, spotlightY, 105);
      spotGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      spotGrad.addColorStop(0.55, `${curItem.previewColor}28`);
      spotGrad.addColorStop(1, 'rgba(241, 245, 249, 0)');
      this.ctx.fillStyle = spotGrad;
      this.ctx.fillRect(stageX + 5, stageY + 34, stageW - 10, 142);

      // 3D Holographic Turntable Pedestal
      this.ctx.save();
      this.ctx.shadowColor = rarityGlow;
      this.ctx.shadowBlur = 16;
      this.ctx.shadowOffsetY = 4;
      this.ctx.beginPath();
      this.ctx.ellipse(spotlightX, spotlightY + 29, 84, 23, 0, 0, Math.PI * 2);
      this.ctx.fillStyle = '#1E293B';
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.ellipse(spotlightX, spotlightY + 24, 78, 20, 0, 0, Math.PI * 2);
      const pedGrad = this.ctx.createRadialGradient(spotlightX, spotlightY + 22, 10, spotlightX, spotlightY + 24, 78);
      pedGrad.addColorStop(0, '#FFFFFF');
      pedGrad.addColorStop(0.75, '#F1F5F9');
      pedGrad.addColorStop(1, '#CBD5E1');
      this.ctx.fillStyle = pedGrad;
      this.ctx.fill();
      this.ctx.strokeStyle = rarityGlow;
      this.ctx.lineWidth = 2.2;
      this.ctx.stroke();

      // Rotating holographic telemetry ring on turntable
      this.ctx.strokeStyle = curItem.previewColor;
      this.ctx.lineWidth = 1.6;
      this.ctx.setLineDash([12, 8]);
      this.ctx.lineDashOffset = -stageT * 28;
      this.ctx.beginPath();
      this.ctx.ellipse(spotlightX, spotlightY + 24, 62, 14, 0, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.restore();

      // Mascot Character (Full 2.5D Custom Headgear + Back Rig + Animated Aura)
      drawCharacter(
        this.ctx,
        spotlightX,
        spotlightY - 12,
        46,
        this.shopPreviewPlayerId,
        false,
        'triumph',
        stageT,
        curItem.id
      );

      // Rarity pill
      const rBadgeW = 90;
      const rBadgeH = 18;
      this.drawRoundedRect(centerX - rBadgeW / 2, stageY + 160, rBadgeW, rBadgeH, 6, rc.bg, rc.border, 1);
      this.ctx.fillStyle = rc.text;
      this.ctx.font = '900 9.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(curItem.rarity.toUpperCase(), centerX, stageY + 172.5);

      // Title & Description
      this.ctx.fillStyle = '#0F172A';
      this.ctx.font = '900 18px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(curItem.name, centerX, stageY + 200);

      this.ctx.fillStyle = '#475569';
      this.ctx.font = '600 11.5px sans-serif';
      this.ctx.textAlign = 'center';
      this.wrapText(curItem.description, centerX, stageY + 220, stageW - 40, 16);

      // Action Area (Unlock or Equip P1-P4)
      const actionAreaY = stageY + stageH - 56;
      if (!curItem.isUnlocked) {
        const canAfford = userCoins >= curItem.price;
        const buyBtnW = Math.min(260, stageW - 40);
        const buyBtnH = 38;
        const buyBtnX = centerX - buyBtnW / 2;

        this.ctx.save();
        if (canAfford) {
          this.ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
          this.ctx.shadowBlur = 10;
          this.ctx.shadowOffsetY = 3;
          this.drawRoundedRect(buyBtnX, actionAreaY + 2, buyBtnW, buyBtnH, 10, '#B45309');
          const buyGrad = this.ctx.createLinearGradient(buyBtnX, actionAreaY, buyBtnX, actionAreaY + buyBtnH);
          buyGrad.addColorStop(0, '#FBBF24');
          buyGrad.addColorStop(1, '#D97706');
          this.drawRoundedRect(buyBtnX, actionAreaY, buyBtnW, buyBtnH, 10, buyGrad, '#FDE68A', 1.5);
        } else {
          this.drawRoundedRect(buyBtnX, actionAreaY + 2, buyBtnW, buyBtnH, 10, '#94A3B8');
          this.drawRoundedRect(buyBtnX, actionAreaY, buyBtnW, buyBtnH, 10, '#CBD5E1', '#94A3B8', 1);
        }
        this.ctx.restore();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '900 12.5px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        if (canAfford) {
          this.ctx.fillText(`UNLOCK FOR ${curItem.price} COINS`, centerX, actionAreaY + 24);
        } else {
          this.ctx.fillText(`LOCKED (NEED ${curItem.price - userCoins} MORE COINS)`, centerX, actionAreaY + 24);
        }

        if (canAfford) {
          this.shopHitBoxes.push({
            id: `buy_${curItem.id}`,
            action: () => {
              if (EconomyManager.getInstance().unlockSkin(curItem.id)) {
                this.audio.playPurchase();
                confetti({ particleCount: 65, spread: 70, origin: { x: centerX / w, y: actionAreaY / h } });
              }
            },
            x: buyBtnX,
            y: actionAreaY,
            w: buyBtnW,
            h: buyBtnH
          });
        }
      } else {
        const eqBtnW = Math.max(52, Math.floor((stageW - 40) / 4));
        const eqGap = 8;
        const totalEqW = 4 * eqBtnW + 3 * eqGap;
        const eqStartX = centerX - totalEqW / 2;

        for (let p = 0; p < 4; p++) {
          const ebx = eqStartX + p * (eqBtnW + eqGap);
          const isEquipped = EconomyManager.getInstance().getEquippedSkin(p as PlayerId) === curItem.id;
          const pColor = this.players[p]?.color || '#EF4444';

          this.ctx.save();
          if (isEquipped) {
            this.drawRoundedRect(ebx, actionAreaY + 2, eqBtnW, 36, 8, '#047857');
            const eqGrad = this.ctx.createLinearGradient(ebx, actionAreaY, ebx, actionAreaY + 36);
            eqGrad.addColorStop(0, '#10B981');
            eqGrad.addColorStop(1, '#059669');
            this.drawRoundedRect(ebx, actionAreaY, eqBtnW, 36, 8, eqGrad, '#6EE7B7', 1.5);
          } else {
            this.drawRoundedRect(ebx, actionAreaY + 2, eqBtnW, 36, 8, '#CBD5E1');
            this.drawRoundedRect(ebx, actionAreaY, eqBtnW, 36, 8, '#FFFFFF', '#94A3B8', 1.5);
          }
          this.ctx.restore();

          this.ctx.fillStyle = isEquipped ? '#FFFFFF' : pColor;
          this.ctx.font = '900 10.5px Montserrat, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(isEquipped ? `P${p + 1} ✓` : `EQUIP P${p + 1}`, ebx + eqBtnW / 2, actionAreaY + 22.5);

          this.shopHitBoxes.push({
            id: `equip_p${p}_${curItem.id}`,
            action: () => {
              EconomyManager.getInstance().equipSkin(p as PlayerId, curItem.id);
              this.audio.playTap();
            },
            x: ebx,
            y: actionAreaY,
            w: eqBtnW,
            h: 36
          });
        }
      }
    }

    // === CASE 2: ARENA THEME ===
    else if (curItem.category === 'ARENA') {
      const arenaBoxW = Math.min(320, stageW - 24);
      const arenaBoxH = 132;
      const arenaBoxX = centerX - arenaBoxW / 2;
      const arenaBoxY = stageY + 16;
      const arenaAnimT = performance.now() * 0.001;

      // Draw Live 2.5D Themed Arena Diorama Container
      this.ctx.save();
      this.ctx.shadowColor = curItem.raw.glowColor;
      this.ctx.shadowBlur = 18;
      this.drawRoundedRect(arenaBoxX, arenaBoxY, arenaBoxW, arenaBoxH, 12, curItem.raw.previewColor, curItem.raw.borderColor, 2.5);
      this.ctx.restore();

      // Render bespoke animated 2.5D environmental props & floor diorama
      this.renderShopArenaDiorama(curItem.raw, arenaBoxX, arenaBoxY, arenaBoxW, arenaBoxH);

      // Frame border & dueling mascots inside the diorama
      this.ctx.save();
      this.drawRoundedRect(arenaBoxX, arenaBoxY, arenaBoxW, arenaBoxH, 12, 'rgba(0,0,0,0)', curItem.raw.borderColor, 2.5);

      // Central floor competition sigil medallion ring
      this.ctx.strokeStyle = curItem.raw.borderColor;
      this.ctx.lineWidth = 1.6;
      this.ctx.setLineDash([8, 5]);
      this.ctx.lineDashOffset = -arenaAnimT * 22;
      this.ctx.beginPath();
      this.ctx.ellipse(centerX, arenaBoxY + arenaBoxH * 0.65, 42, 13, 0, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      const p1Skin = EconomyManager.getInstance().getEquippedSkin(0);
      const p2Skin = EconomyManager.getInstance().getEquippedSkin(1);
      const duelOffset = Math.sin(arenaAnimT * 3.2) * 6;
      const m1X = arenaBoxX + 56 + duelOffset;
      const m1Y = arenaBoxY + arenaBoxH * 0.56;
      const m2X = arenaBoxX + arenaBoxW - 56 - duelOffset;
      const m2Y = arenaBoxY + arenaBoxH * 0.56;

      // Soft contact drop shadows beneath dueling mascots
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      this.ctx.beginPath();
      this.ctx.ellipse(m1X, m1Y + 16, 16, 5, 0, 0, Math.PI * 2);
      this.ctx.ellipse(m2X, m2Y + 16, 16, 5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Dueling Mascots with their custom skins
      drawCharacter(this.ctx, m1X, m1Y, 21, 0, false, 'happy', arenaAnimT, p1Skin);
      drawCharacter(this.ctx, m2X, m2Y, 21, 1, false, 'happy', arenaAnimT, p2Skin);

      // Arena Simulation Pill Tag
      this.drawRoundedRect(centerX - 82, arenaBoxY + arenaBoxH - 19, 164, 15, 5, 'rgba(15, 23, 42, 0.88)', curItem.raw.borderColor, 1);
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '900 8.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('LIVE 2.5D ARENA DIORAMA', centerX, arenaBoxY + arenaBoxH - 8.5);
      this.ctx.restore();

      // Rarity pill
      const rBadgeW = 90;
      const rBadgeH = 18;
      this.drawRoundedRect(centerX - rBadgeW / 2, stageY + 152, rBadgeW, rBadgeH, 6, rc.bg, rc.border, 1);
      this.ctx.fillStyle = rc.text;
      this.ctx.font = '900 9.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(curItem.rarity.toUpperCase(), centerX, stageY + 164.5);

      // Arena Title & Description
      this.ctx.fillStyle = '#0F172A';
      this.ctx.font = '900 18px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(curItem.name, centerX, stageY + 192);

      this.ctx.fillStyle = '#475569';
      this.ctx.font = '600 11.5px sans-serif';
      this.ctx.textAlign = 'center';
      this.wrapText(curItem.description, centerX, stageY + 212, stageW - 40, 16);

      // Environment Spec Pill
      this.drawRoundedRect(centerX - 135, stageY + 268, 270, 22, 6, '#F1F5F9', '#CBD5E1', 1);
      this.ctx.fillStyle = '#475569';
      this.ctx.font = 'bold 9.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`Trim: ${curItem.raw.borderColor}  •  Biome: ${curItem.raw.floorPattern.toUpperCase()}`, centerX, stageY + 282.5);

      // Action Area
      const actionAreaY = stageY + stageH - 56;
      const isEquippedArena = EconomyManager.getInstance().getEquippedArena() === curItem.id;
      const buyBtnW = Math.min(260, stageW - 40);
      const buyBtnH = 38;
      const buyBtnX = centerX - buyBtnW / 2;

      if (!curItem.isUnlocked) {
        const canAfford = userCoins >= curItem.price;
        this.ctx.save();
        if (canAfford) {
          this.ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
          this.ctx.shadowBlur = 10;
          this.ctx.shadowOffsetY = 3;
          this.drawRoundedRect(buyBtnX, actionAreaY + 2, buyBtnW, buyBtnH, 10, '#B45309');
          const buyGrad = this.ctx.createLinearGradient(buyBtnX, actionAreaY, buyBtnX, actionAreaY + buyBtnH);
          buyGrad.addColorStop(0, '#FBBF24');
          buyGrad.addColorStop(1, '#D97706');
          this.drawRoundedRect(buyBtnX, actionAreaY, buyBtnW, buyBtnH, 10, buyGrad, '#FDE68A', 1.5);
        } else {
          this.drawRoundedRect(buyBtnX, actionAreaY + 2, buyBtnW, buyBtnH, 10, '#94A3B8');
          this.drawRoundedRect(buyBtnX, actionAreaY, buyBtnW, buyBtnH, 10, '#CBD5E1', '#94A3B8', 1);
        }
        this.ctx.restore();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '900 12.5px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        if (canAfford) {
          this.ctx.fillText(`UNLOCK FOR ${curItem.price} COINS`, centerX, actionAreaY + 24);
        } else {
          this.ctx.fillText(`LOCKED (NEED ${curItem.price - userCoins} MORE COINS)`, centerX, actionAreaY + 24);
        }

        if (canAfford) {
          this.shopHitBoxes.push({
            id: `buy_${curItem.id}`,
            action: () => {
              if (EconomyManager.getInstance().unlockArena(curItem.id)) {
                this.audio.playPurchase();
                confetti({ particleCount: 65, spread: 70, origin: { x: centerX / w, y: actionAreaY / h } });
              }
            },
            x: buyBtnX,
            y: actionAreaY,
            w: buyBtnW,
            h: buyBtnH
          });
        }
      } else {
        this.ctx.save();
        if (isEquippedArena) {
          this.drawRoundedRect(buyBtnX, actionAreaY + 2, buyBtnW, buyBtnH, 10, '#047857');
          const eqGrad = this.ctx.createLinearGradient(buyBtnX, actionAreaY, buyBtnX, actionAreaY + buyBtnH);
          eqGrad.addColorStop(0, '#10B981');
          eqGrad.addColorStop(1, '#059669');
          this.drawRoundedRect(buyBtnX, actionAreaY, buyBtnW, buyBtnH, 10, eqGrad, '#6EE7B7', 1.5);
        } else {
          this.drawRoundedRect(buyBtnX, actionAreaY + 2, buyBtnW, buyBtnH, 10, '#CBD5E1');
          this.drawRoundedRect(buyBtnX, actionAreaY, buyBtnW, buyBtnH, 10, '#FFFFFF', '#2563EB', 1.5);
        }
        this.ctx.restore();

        this.ctx.fillStyle = isEquippedArena ? '#FFFFFF' : '#2563EB';
        this.ctx.font = '900 12.5px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(isEquippedArena ? '✓ CURRENTLY ACTIVE ARENA' : 'EQUIP ARENA THEME', centerX, actionAreaY + 24);

        this.shopHitBoxes.push({
          id: `equip_arena_${curItem.id}`,
          action: () => {
            EconomyManager.getInstance().equipArena(curItem.id);
            this.audio.playTap();
          },
          x: buyBtnX,
          y: actionAreaY,
          w: buyBtnW,
          h: buyBtnH
        });
      }
    }

    // === CASE 3: MYSTERY LUCKY PACK ===
    else if (curItem.category === 'PACK') {
      const crateY = stageY + 80;
      const t = performance.now() * 0.003;
      const bob = Math.sin(t) * 4;

      // 3D Animated Lucky Crate Illustration
      this.ctx.save();
      this.ctx.shadowColor = curItem.previewColor;
      this.ctx.shadowBlur = 18;

      // Crate body (68x54)
      const crateW = 68;
      const crateH = 54;
      const cx = centerX - crateW / 2;
      const cy = crateY - crateH / 2 + bob;

      // Planks
      this.drawRoundedRect(cx, cy, crateW, crateH, 8, curItem.previewColor, '#334155', 2);

      // Metallic corner brackets
      this.ctx.fillStyle = '#CBD5E1';
      this.ctx.fillRect(cx + 4, cy + 4, 8, 8);
      this.ctx.fillRect(cx + crateW - 12, cy + 4, 8, 8);
      this.ctx.fillRect(cx + 4, cy + crateH - 12, 8, 8);
      this.ctx.fillRect(cx + crateW - 12, cy + crateH - 12, 8, 8);

      // Gold lock hole
      this.ctx.beginPath();
      this.ctx.arc(centerX, cy + crateH / 2, 7, 0, Math.PI * 2);
      this.ctx.fillStyle = '#FEF3C7';
      this.ctx.fill();
      this.ctx.strokeStyle = '#D97706';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = '#78350F';
      this.ctx.fillRect(centerX - 1.5, cy + crateH / 2 - 1, 3, 5);
      this.ctx.restore();

      // Rarity pill
      const rBadgeW = 90;
      const rBadgeH = 18;
      this.drawRoundedRect(centerX - rBadgeW / 2, stageY + 150, rBadgeW, rBadgeH, 6, rc.bg, rc.border, 1);
      this.ctx.fillStyle = rc.text;
      this.ctx.font = '900 9.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(curItem.rarity.toUpperCase(), centerX, stageY + 162.5);

      // Pack Title & Description
      this.ctx.fillStyle = '#0F172A';
      this.ctx.font = '900 18px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(curItem.name, centerX, stageY + 190);

      this.ctx.fillStyle = '#475569';
      this.ctx.font = '600 11.5px sans-serif';
      this.ctx.textAlign = 'center';
      this.wrapText(curItem.description, centerX, stageY + 210, stageW - 40, 16);

      // Drop Odds Breakdown Table
      const weights = curItem.raw.weights;
      const oddsW = Math.min(270, stageW - 36);
      const oddsH = 24;
      const oddsX = centerX - oddsW / 2;
      const oddsY = stageY + 260;
      this.drawRoundedRect(oddsX, oddsY, oddsW, oddsH, 6, '#F1F5F9', '#CBD5E1', 1);

      this.ctx.font = '900 9.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      const cPct = Math.round(weights.Common * 100);
      const rPct = Math.round(weights.Rare * 100);
      const ePct = Math.round(weights.Epic * 100);
      const lPct = Math.round(weights.Legendary * 100);
      this.ctx.fillStyle = '#475569';
      this.ctx.fillText(`Drop Odds: ${cPct}% Common | ${rPct}% Rare | ${ePct}% Epic | ${lPct}% Legendary`, centerX, oddsY + 15.5);

      // Duplicate Refund Guarantee Pill
      const dupW = Math.min(270, stageW - 36);
      const dupY = oddsY + 30;
      this.drawRoundedRect(centerX - dupW / 2, dupY, dupW, 22, 6, '#FEF3C7', '#FDE68A', 1);
      this.ctx.fillStyle = '#92400E';
      this.ctx.font = '900 9px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🛡️ 50% COINS REFUNDED IF YOU ROLL A DUPLICATE!', centerX, dupY + 14.5);

      // Action Area: "OPEN PACK FOR XX COINS"
      const actionAreaY = stageY + stageH - 56;
      const canAfford = userCoins >= curItem.price;
      const buyBtnW = Math.min(260, stageW - 40);
      const buyBtnH = 38;
      const buyBtnX = centerX - buyBtnW / 2;

      this.ctx.save();
      if (canAfford) {
        this.ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetY = 3;
        this.drawRoundedRect(buyBtnX, actionAreaY + 2, buyBtnW, buyBtnH, 10, '#B45309');
        const buyGrad = this.ctx.createLinearGradient(buyBtnX, actionAreaY, buyBtnX, actionAreaY + buyBtnH);
        buyGrad.addColorStop(0, '#FBBF24');
        buyGrad.addColorStop(1, '#D97706');
        this.drawRoundedRect(buyBtnX, actionAreaY, buyBtnW, buyBtnH, 10, buyGrad, '#FDE68A', 1.5);
      } else {
        this.drawRoundedRect(buyBtnX, actionAreaY + 2, buyBtnW, buyBtnH, 10, '#94A3B8');
        this.drawRoundedRect(buyBtnX, actionAreaY, buyBtnW, buyBtnH, 10, '#CBD5E1', '#94A3B8', 1);
      }
      this.ctx.restore();

      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '900 12.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      if (canAfford) {
        this.ctx.fillText(`OPEN PACK FOR ${curItem.price} COINS`, centerX, actionAreaY + 24);
      } else {
        this.ctx.fillText(`NEED ${curItem.price - userCoins} MORE COINS`, centerX, actionAreaY + 24);
      }

      if (canAfford) {
        this.shopHitBoxes.push({
          id: `open_pack_${curItem.id}`,
          action: () => {
            const res = EconomyManager.getInstance().openPack(curItem.id);
            if (res) {
              this.startPackOpeningAnimation(curItem, res);
            }
          },
          x: buyBtnX,
          y: actionAreaY,
          w: buyBtnW,
          h: buyBtnH
        });
      }
    }

    // === CASE 4: POWER-UP BOOSTER ===
    else if (curItem.category === 'BOOSTER') {
      const emblemY = stageY + 80;
      const t = performance.now() * 0.003;
      const pulse = 1 + 0.08 * Math.sin(t * 4);

      // Glowing Power-Up Crest
      this.ctx.save();
      this.ctx.shadowColor = curItem.previewColor;
      this.ctx.shadowBlur = 18 * pulse;

      this.ctx.beginPath();
      this.ctx.arc(centerX, emblemY, 34 * pulse, 0, Math.PI * 2);
      this.ctx.fillStyle = curItem.previewColor;
      this.ctx.fill();
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      // Large Icon
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '28px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(curItem.raw.icon, centerX, emblemY + 9);
      this.ctx.restore();

      // Rarity pill
      const rBadgeW = 90;
      const rBadgeH = 18;
      this.drawRoundedRect(centerX - rBadgeW / 2, stageY + 150, rBadgeW, rBadgeH, 6, rc.bg, rc.border, 1);
      this.ctx.fillStyle = rc.text;
      this.ctx.font = '900 9.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(curItem.rarity.toUpperCase(), centerX, stageY + 162.5);

      // Booster Title
      this.ctx.fillStyle = '#0F172A';
      this.ctx.font = '900 18px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(curItem.name, centerX, stageY + 190);

      // Effect Pill Banner
      let buffText = 'POWER BUFF';
      if (curItem.id === 'booster_time') buffText = '⏱️ CHRONO CLUTCH: +5s WHEN TIMER <= 3s';
      else if (curItem.id === 'booster_siphon') buffText = '🧲 COIN SIPHON: +10 COINS PER WIN (+25 IN TOURNAMENT)';
      else if (curItem.id === 'booster_double_coins') buffText = '💰 DOUBLE BOUNTY: 2X COINS ON ALL VICTORIES';
      else if (curItem.id === 'booster_shield') buffText = '🛡️ AEGIS OVERCHARGE: +1 BUMPER IMPACT SHIELD';
      else if (curItem.id === 'booster_turbo') buffText = '⚡ HYPERDRIVE: +15% ACCELERATION BOOST';

      this.drawRoundedRect(centerX - 135, stageY + 208, 270, 24, 6, '#EFF6FF', '#3B82F6', 1.5);
      this.ctx.fillStyle = '#1D4ED8';
      this.ctx.font = '900 9.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(buffText, centerX, stageY + 224);

      // Description
      this.ctx.fillStyle = '#475569';
      this.ctx.font = '600 11.5px sans-serif';
      this.ctx.textAlign = 'center';
      this.wrapText(curItem.description, centerX, stageY + 252, stageW - 40, 16);

      // Action Area
      const actionAreaY = stageY + stageH - 56;
      if (!curItem.isUnlocked) {
        const canAfford = userCoins >= curItem.price;
        const buyBtnW = Math.min(260, stageW - 40);
        const buyBtnH = 38;
        const buyBtnX = centerX - buyBtnW / 2;

        this.ctx.save();
        if (canAfford) {
          this.ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
          this.ctx.shadowBlur = 10;
          this.ctx.shadowOffsetY = 3;
          this.drawRoundedRect(buyBtnX, actionAreaY + 2, buyBtnW, buyBtnH, 10, '#B45309');
          const buyGrad = this.ctx.createLinearGradient(buyBtnX, actionAreaY, buyBtnX, actionAreaY + buyBtnH);
          buyGrad.addColorStop(0, '#FBBF24');
          buyGrad.addColorStop(1, '#D97706');
          this.drawRoundedRect(buyBtnX, actionAreaY, buyBtnW, buyBtnH, 10, buyGrad, '#FDE68A', 1.5);
        } else {
          this.drawRoundedRect(buyBtnX, actionAreaY + 2, buyBtnW, buyBtnH, 10, '#94A3B8');
          this.drawRoundedRect(buyBtnX, actionAreaY, buyBtnW, buyBtnH, 10, '#CBD5E1', '#94A3B8', 1);
        }
        this.ctx.restore();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '900 12.5px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        if (canAfford) {
          this.ctx.fillText(`UNLOCK FOR ${curItem.price} COINS`, centerX, actionAreaY + 24);
        } else {
          this.ctx.fillText(`LOCKED (NEED ${curItem.price - userCoins} MORE COINS)`, centerX, actionAreaY + 24);
        }

        if (canAfford) {
          this.shopHitBoxes.push({
            id: `buy_${curItem.id}`,
            action: () => {
              if (EconomyManager.getInstance().unlockBooster(curItem.id)) {
                this.audio.playPurchase();
                confetti({ particleCount: 65, spread: 70, origin: { x: centerX / w, y: actionAreaY / h } });
              }
            },
            x: buyBtnX,
            y: actionAreaY,
            w: buyBtnW,
            h: buyBtnH
          });
        }
      } else {
        const eqBtnW = Math.max(52, Math.floor((stageW - 40) / 4));
        const eqGap = 8;
        const totalEqW = 4 * eqBtnW + 3 * eqGap;
        const eqStartX = centerX - totalEqW / 2;

        for (let p = 0; p < 4; p++) {
          const ebx = eqStartX + p * (eqBtnW + eqGap);
          const isEquipped = EconomyManager.getInstance().getEquippedBooster(p as PlayerId) === curItem.id;
          const pColor = this.players[p]?.color || '#EF4444';

          this.ctx.save();
          if (isEquipped) {
            this.drawRoundedRect(ebx, actionAreaY + 2, eqBtnW, 36, 8, '#047857');
            const eqGrad = this.ctx.createLinearGradient(ebx, actionAreaY, ebx, actionAreaY + 36);
            eqGrad.addColorStop(0, '#10B981');
            eqGrad.addColorStop(1, '#059669');
            this.drawRoundedRect(ebx, actionAreaY, eqBtnW, 36, 8, eqGrad, '#6EE7B7', 1.5);
          } else {
            this.drawRoundedRect(ebx, actionAreaY + 2, eqBtnW, 36, 8, '#CBD5E1');
            this.drawRoundedRect(ebx, actionAreaY, eqBtnW, 36, 8, '#FFFFFF', '#94A3B8', 1.5);
          }
          this.ctx.restore();

          this.ctx.fillStyle = isEquipped ? '#FFFFFF' : pColor;
          this.ctx.font = '900 10.5px Montserrat, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(isEquipped ? `P${p + 1} ✓` : `EQUIP P${p + 1}`, ebx + eqBtnW / 2, actionAreaY + 22.5);

          this.shopHitBoxes.push({
            id: `equip_booster_p${p}_${curItem.id}`,
            action: () => {
              EconomyManager.getInstance().equipBooster(p as PlayerId, curItem.id);
              this.audio.playTap();
            },
            x: ebx,
            y: actionAreaY,
            w: eqBtnW,
            h: 36
          });
        }
      }
    }

    // === CINEMATIC PACK OPENING & REVEAL MODAL OVERLAY ===
    if (this.packOpeningAnim || this.packOpeningResult) {
      const anim = this.packOpeningAnim;
      const res = anim?.result || this.packOpeningResult!;
      const elapsed = anim ? performance.now() - anim.startTime : 3500;

      // Dark cinematic backdrop
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      this.ctx.fillRect(0, 0, w, h);

      if (elapsed < 2400) {
        // === PHASES 1 & 2: 3D MYSTERY LOOT CRATE DROP & VIBRATION ===
        const isDropping = elapsed < 550;
        const dropT = Math.min(1.0, elapsed / 500);
        const dropY = isDropping
          ? (h / 2) - (1 - Math.sin((dropT * Math.PI) / 2)) * 320
          : h / 2;

        const intensity = isDropping ? 0 : Math.min(14, (elapsed - 550) * 0.009);
        const shakeX = (Math.random() - 0.5) * intensity;
        const shakeY = (Math.random() - 0.5) * intensity * 0.6;
        const crateX = w / 2 + shakeX;
        const crateY = dropY + shakeY;

        // Expanding shadow on floor
        this.ctx.save();
        const shadowScale = isDropping ? dropT : 1.0;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.beginPath();
        this.ctx.ellipse(w / 2, h / 2 + 80, 80 * shadowScale, 24 * shadowScale, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        // 3D Wooden & Reinforced Steel Loot Crate
        const crateSize = 130;
        this.ctx.save();
        this.ctx.shadowColor = res.previewColor;
        this.ctx.shadowBlur = 18 + intensity * 2;

        // Crate Body
        this.drawRoundedRect(crateX - crateSize / 2, crateY - crateSize / 2, crateSize, crateSize, 16, '#78350F', '#B45309', 3);
        // Steel Rim Brackets
        this.ctx.strokeStyle = '#94A3B8';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(crateX - crateSize / 2 + 8, crateY - crateSize / 2 + 8, crateSize - 16, crateSize - 16);
        // Corner rivets
        const rivets = [
          { x: crateX - crateSize / 2 + 14, y: crateY - crateSize / 2 + 14 },
          { x: crateX + crateSize / 2 - 14, y: crateY - crateSize / 2 + 14 },
          { x: crateX - crateSize / 2 + 14, y: crateY + crateSize / 2 - 14 },
          { x: crateX + crateSize / 2 - 14, y: crateY + crateSize / 2 - 14 }
        ];
        this.ctx.fillStyle = '#CBD5E1';
        for (const rv of rivets) {
          this.ctx.beginPath();
          this.ctx.arc(rv.x, rv.y, 3, 0, Math.PI * 2);
          this.ctx.fill();
        }

        // Center Glowing Hologram Core
        const corePulse = 1 + 0.15 * Math.sin(performance.now() * 0.015);
        this.ctx.fillStyle = res.previewColor;
        this.ctx.shadowColor = res.previewColor;
        this.ctx.shadowBlur = 25;
        this.ctx.beginPath();
        this.ctx.arc(crateX, crateY, 26 * corePulse, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '24px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(res.itemType === 'skin' ? '🎭' : res.itemType === 'arena' ? '🏟️' : '⚡', crateX, crateY + 8);

        // Radiant Energy Cracks spider-webbing across crate
        if (!isDropping) {
          const crackProgress = Math.min(1.0, (elapsed - 550) / 1400);
          this.ctx.strokeStyle = res.previewColor;
          this.ctx.lineWidth = 2.5;
          this.ctx.shadowColor = '#FFFFFF';
          this.ctx.shadowBlur = 8;
          for (let i = 0; i < 6; i++) {
            const crackAngle = (i * Math.PI) / 3;
            const crackDist = 26 + crackProgress * 42;
            this.ctx.beginPath();
            this.ctx.moveTo(crateX + Math.cos(crackAngle) * 26, crateY + Math.sin(crackAngle) * 26);
            this.ctx.lineTo(crateX + Math.cos(crackAngle + 0.2) * (crackDist * 0.6), crateY + Math.sin(crackAngle + 0.2) * (crackDist * 0.6));
            this.ctx.lineTo(crateX + Math.cos(crackAngle) * crackDist, crateY + Math.sin(crackAngle) * crackDist);
            this.ctx.stroke();
          }
        }
        this.ctx.restore();

        // Text prompt
        this.ctx.fillStyle = '#CBD5E1';
        this.ctx.font = '900 13px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        const dots = '.'.repeat(1 + (Math.floor(elapsed / 300) % 3));
        this.ctx.fillText(`✨ UNLOCKING MYSTERY CRATE${dots}`, w / 2, h / 2 + 115);
        this.ctx.fillStyle = '#64748B';
        this.ctx.font = 'bold 11px Montserrat, sans-serif';
        this.ctx.fillText('[TAP ANYWHERE TO SKIP]', w / 2, h / 2 + 138);

        // Skip Hitbox (Click anywhere to fast-forward to card reveal)
        this.shopHitBoxes.push({
          id: 'skip_pack_animation',
          action: () => {
            if (this.packOpeningAnim) {
              this.packOpeningAnim.startTime = performance.now() - 2600;
              this.audio.playTap();
            }
          },
          x: 0,
          y: 0,
          w,
          h
        });
      } else {
        // === PHASES 3 & 4: EXPLOSIVE BURST & 3D CARD FLIP REVEAL ===
        const revealElapsed = elapsed - 2400;

        // White Flash Bloom on burst
        if (revealElapsed < 300) {
          const flashAlpha = (1 - revealElapsed / 300) * 0.75;
          this.ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
          this.ctx.fillRect(0, 0, w, h);
        }

        // Render Burst Confetti Particles
        if (anim && anim.particles) {
          this.ctx.save();
          for (const p of anim.particles) {
            p.x += p.vx * 0.016;
            p.y += p.vy * 0.016;
            p.vy += 220 * 0.016; // gravity
            p.alpha = Math.max(0, p.alpha - 0.012);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
          }
          this.ctx.restore();
        }

        // 3D Card Flip Animation (0 to 450ms of reveal)
        const flipT = Math.min(1.0, revealElapsed / 400);
        const scaleX = Math.abs(Math.cos(flipT * Math.PI));
        const isCardFront = flipT >= 0.5;

        const cardW = 380;
        const cardH = 340;
        const cardCenterX = w / 2;
        const cardY = h / 2 - cardH / 2;

        this.ctx.save();
        this.ctx.translate(cardCenterX, 0);
        this.ctx.scale(scaleX, 1.0);
        this.ctx.translate(-cardCenterX, 0);

        const cardX = cardCenterX - cardW / 2;

        if (!isCardFront) {
          // Card Back: High-Tech Holographic Crest
          this.ctx.shadowColor = res.previewColor;
          this.ctx.shadowBlur = 24;
          this.drawRoundedRect(cardX, cardY + 4, cardW, cardH, 18, '#0F172A');
          this.drawRoundedRect(cardX, cardY, cardW, cardH, 18, '#1E293B', res.previewColor, 3);
          this.ctx.strokeStyle = '#38BDF8';
          this.ctx.lineWidth = 1.5;
          this.ctx.strokeRect(cardX + 16, cardY + 16, cardW - 32, cardH - 32);
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.font = '900 28px Montserrat, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('ANTIGRAVITY', cardCenterX, cardY + cardH / 2 + 10);
        } else {
          // Card Front: Full Item Reward
          this.ctx.shadowColor = res.previewColor;
          this.ctx.shadowBlur = 30;
          this.drawRoundedRect(cardX, cardY + 4, cardW, cardH, 18, '#0F172A');
          this.drawRoundedRect(cardX, cardY, cardW, cardH, 18, '#FFFFFF', res.previewColor, 3);

          // Live 2.5D Reward Showcase on Reveal Card
          const revealT = performance.now() * 0.001;
          if (res.itemType === 'skin') {
            this.ctx.beginPath();
            this.ctx.ellipse(cardCenterX, cardY + 76, 42, 11, 0, 0, Math.PI * 2);
            this.ctx.fillStyle = '#E2E8F0';
            this.ctx.fill();
            drawCharacter(this.ctx, cardCenterX, cardY + 54, 28, 0, false, 'triumph', revealT, res.itemId);
          } else if (res.itemType === 'arena') {
            const arenaDef = ARENA_CATALOG.find(a => a.id === res.itemId) || ARENA_CATALOG[0];
            this.renderShopArenaDiorama(arenaDef, cardCenterX - 95, cardY + 18, 190, 68);
            this.drawRoundedRect(cardCenterX - 95, cardY + 18, 190, 68, 8, 'rgba(0,0,0,0)', arenaDef.borderColor, 2);
          } else {
            this.ctx.beginPath();
            this.ctx.arc(cardCenterX, cardY + 54, 30, 0, Math.PI * 2);
            this.ctx.fillStyle = res.previewColor;
            this.ctx.fill();
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2.5;
            this.ctx.stroke();

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '24px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('⚡', cardCenterX, cardY + 62);
          }

          // Title
          this.ctx.fillStyle = '#0F172A';
          this.ctx.font = '900 20px Montserrat, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(res.name, cardCenterX, cardY + 114);

          // Rarity Pill
          const resRc = rarityColors[res.rarity] || rarityColors.Rare;
          this.drawRoundedRect(cardCenterX - 50, cardY + 124, 100, 20, 6, resRc.bg, resRc.border, 1);
          this.ctx.fillStyle = resRc.text;
          this.ctx.font = '900 10.5px Montserrat, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(res.rarity.toUpperCase(), cardCenterX, cardY + 138);

          // Duplicate vs New Unlock Banner
          if (res.isDuplicate) {
            this.drawRoundedRect(cardX + 24, cardY + 156, cardW - 48, 52, 10, '#FFFBEB', '#F59E0B', 2);
            this.ctx.fillStyle = '#B45309';
            this.ctx.font = '900 12.5px Montserrat, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('⚠️ DUPLICATE ITEM DETECTED!', cardCenterX, cardY + 176);

            this.ctx.fillStyle = '#92400E';
            this.ctx.font = 'bold 11.5px Montserrat, sans-serif';
            this.ctx.fillText(`+${res.refundCoins} COINS REFUNDED (50% VALUE)`, cardCenterX, cardY + 195);
          } else {
            this.drawRoundedRect(cardX + 24, cardY + 156, cardW - 48, 52, 10, '#ECFDF5', '#10B981', 2);
            this.ctx.fillStyle = '#047857';
            this.ctx.font = '900 12.5px Montserrat, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('✨ NEW REWARD UNLOCKED!', cardCenterX, cardY + 176);

            this.ctx.fillStyle = '#065F46';
            this.ctx.font = 'bold 11.5px Montserrat, sans-serif';
            this.ctx.fillText('Added directly to your Mascot Locker & Wardrobe!', cardCenterX, cardY + 195);
          }

          // Description
          this.ctx.fillStyle = '#475569';
          this.ctx.font = '600 11.5px sans-serif';
          this.ctx.textAlign = 'center';
          this.wrapText(res.description, cardCenterX, cardY + 226, cardW - 50, 16);

          // Claim & Continue Button
          const claimBtnW = 200;
          const claimBtnH = 38;
          const claimBtnX = cardCenterX - claimBtnW / 2;
          const claimBtnY = cardY + cardH - 52;

          this.ctx.save();
          this.ctx.shadowColor = 'rgba(37, 99, 235, 0.4)';
          this.ctx.shadowBlur = 10;
          this.drawRoundedRect(claimBtnX, claimBtnY + 2, claimBtnW, claimBtnH, 10, '#1D4ED8');
          this.drawRoundedRect(claimBtnX, claimBtnY, claimBtnW, claimBtnH, 10, '#2563EB', '#60A5FA', 1.5);
          this.ctx.restore();

          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.font = '900 12.5px Montserrat, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('COLLECT & CONTINUE', cardCenterX, claimBtnY + 24);

          this.shopHitBoxes.push({
            id: 'dismiss_pack_reveal',
            action: () => {
              this.packOpeningAnim = null;
              this.packOpeningResult = null;
              this.audio.playTap();
            },
            x: claimBtnX,
            y: claimBtnY,
            w: claimBtnW,
            h: claimBtnH
          });
        }
        this.ctx.restore();
      }
    }
  }

  private renderTrophiesModal(w: number, h: number) {
    this.trophyHitBoxes = [];

    // Dark backdrop overlay
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    this.ctx.fillRect(0, 0, w, h);

    const modalW = Math.min(740, w * 0.95);
    const modalH = Math.min(540, h * 0.95);
    const modalX = w / 2 - modalW / 2;
    const modalY = h / 2 - modalH / 2;

    // 3D Card background
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    this.ctx.shadowBlur = 32;
    this.ctx.shadowOffsetY = 12;
    // 3D bevel
    this.drawRoundedRect(modalX, modalY + 4, modalW, modalH, 18, '#CBD5E1');
    // Card face
    this.drawRoundedRect(modalX, modalY, modalW, modalH, 18, '#FFFFFF', '#CBD5E1', 2);
    this.ctx.restore();

    // Close button "✕"
    const closeBtnX = modalX + modalW - 28;
    const closeBtnY = modalY + 28;
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetY = 2;
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    this.ctx.beginPath();
    this.ctx.arc(closeBtnX, closeBtnY, 15, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '900 13px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('✕', closeBtnX, closeBtnY + 4.5);

    this.trophyHitBoxes.push({
      id: 'trophies_close',
      action: () => this.closeTrophies(),
      x: closeBtnX - 16,
      y: closeBtnY - 16,
      w: 32,
      h: 32
    });

    // Header Title & Subtitle
    this.ctx.fillStyle = '#0F172A';
    this.ctx.font = '900 21px Montserrat, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('🏆 TROPHY ROOM & ACHIEVEMENTS', modalX + 24, modalY + 34);

    this.ctx.fillStyle = '#64748B';
    this.ctx.font = '600 11.5px sans-serif';
    this.ctx.fillText('Complete gameplay milestones & mastery feats to earn trophy badges and bonus Coins!', modalX + 26, modalY + 50);

    // Unlocked Counter Pill at top right
    const unlockedCount = AchievementManager.getInstance().getUnlockedCount();
    const totalCount = AchievementManager.getInstance().getTotalCount();
    const pct = Math.round((unlockedCount / totalCount) * 100);

    const pillW = 155;
    const pillH = 32;
    const pillX = modalX + modalW - 200;
    const pillY = modalY + 18;
    this.drawRoundedRect(pillX, pillY + 2, pillW, pillH, 10, '#B45309');
    this.drawRoundedRect(pillX, pillY, pillW, pillH, 10, '#FFFBEB', '#FDE68A', 1.5);

    this.ctx.fillStyle = '#92400E';
    this.ctx.font = '900 12px Montserrat, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`🏆 ${unlockedCount} / ${totalCount} (${pct}%)`, pillX + pillW / 2, pillY + 20);

    // Grid of 12 achievements: 3 cols x 4 rows
    const cols = 3;
    const gap = 12;
    const startGridX = modalX + 24;
    const startGridY = modalY + 70;
    const cardW = Math.floor((modalW - 48 - (cols - 1) * gap) / cols);
    const cardH = 92;

    ACHIEVEMENTS.forEach((ach, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cardX = startGridX + col * (cardW + gap);
      const cardY = startGridY + row * (cardH + gap);
      const isAchUnlocked = AchievementManager.getInstance().isUnlocked(ach.id);

      this.ctx.save();
      if (isAchUnlocked) {
        this.ctx.shadowColor = 'rgba(245, 158, 11, 0.25)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetY = 2;
        this.drawRoundedRect(cardX, cardY + 2, cardW, cardH, 10, '#D97706');
        const cGrad = this.ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
        cGrad.addColorStop(0, '#FFFBEB');
        cGrad.addColorStop(1, '#FEF3C7');
        this.drawRoundedRect(cardX, cardY, cardW, cardH, 10, cGrad, '#FDE68A', 1.5);
      } else {
        this.drawRoundedRect(cardX, cardY + 2, cardW, cardH, 10, '#E2E8F0');
        this.drawRoundedRect(cardX, cardY, cardW, cardH, 10, '#F8FAFC', '#CBD5E1', 1);
      }
      this.ctx.restore();

      // Trophy / Lock badge icon
      const iconX = cardX + 18;
      const iconY = cardY + 22;
      this.ctx.beginPath();
      this.ctx.arc(iconX, iconY, 11, 0, Math.PI * 2);
      this.ctx.fillStyle = isAchUnlocked ? '#F59E0B' : '#94A3B8';
      this.ctx.fill();
      this.ctx.strokeStyle = isAchUnlocked ? '#FEF3C7' : '#E2E8F0';
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();

      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '900 9px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(isAchUnlocked ? '★' : '🔒', iconX, iconY + 3);

      // Title
      this.ctx.fillStyle = isAchUnlocked ? '#78350F' : '#334155';
      this.ctx.font = '900 12px Montserrat, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(ach.title, cardX + 36, cardY + 22);

      // Description
      this.ctx.fillStyle = isAchUnlocked ? '#92400E' : '#64748B';
      this.ctx.font = '500 10.5px sans-serif';
      this.wrapText(ach.description, cardX + 12, cardY + 44, cardW - 24, 14);

      // Bounty reward pill at bottom right of card
      const bountyW = 76;
      const bountyH = 18;
      const bountyX = cardX + cardW - bountyW - 10;
      const bountyY = cardY + cardH - bountyH - 8;

      this.ctx.save();
      if (isAchUnlocked) {
        this.drawRoundedRect(bountyX, bountyY, bountyW, bountyH, 5, '#D1FAE5', '#6EE7B7', 1);
        this.ctx.fillStyle = '#065F46';
        this.ctx.font = '900 9.5px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('✓ CLAIMED', bountyX + bountyW / 2, bountyY + 12.5);
      } else {
        this.drawRoundedRect(bountyX, bountyY, bountyW, bountyH, 5, '#FEF3C7', '#FDE68A', 1);
        this.drawCoinIcon(bountyX + 10, bountyY + 9, 5);
        this.ctx.fillStyle = '#92400E';
        this.ctx.font = '900 9.5px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`+${ach.rewardCoins}`, bountyX + 44, bountyY + 12.5);
      }
      this.ctx.restore();
    });
  }

  private renderCornerPlayerBadges() {
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    this.playerBadgeHitboxes = [];

    const controlHints = [
      'WASD + Space',
      'Arrows + Enter',
      'IJKL / C',
      'Numpad / M'
    ];

    if (w >= 1180) {
      // Desktop: 4 luxury corner cards in side margins
      const badgeW = 168;
      const badgeH = 62;
      const coords = [
        { x: 18, y: 18 },              // P1: Top-Left
        { x: w - badgeW - 18, y: 18 }, // P2: Top-Right
        { x: 18, y: h - badgeH - 16 }, // P3: Bottom-Left
        { x: w - badgeW - 18, y: h - badgeH - 16 } // P4: Bottom-Right
      ];

      this.players.forEach((p, idx) => {
        const c = coords[idx];
        this.playerBadgeHitboxes.push({ pid: idx, x: c.x, y: c.y, w: badgeW, h: badgeH });
        const isDisabled = p.type === 'disabled';

        this.ctx.save();
        if (isDisabled) {
          // Disabled: Clean dashed slot inviting a player to join
          this.ctx.shadowColor = 'rgba(0, 0, 0, 0.02)';
          this.ctx.shadowBlur = 6;
          this.ctx.shadowOffsetY = 1;
          this.drawRoundedRect(c.x, c.y, badgeW, badgeH, 12, 'rgba(255, 255, 255, 0.85)', '#CBD5E1', 1.5);

          // Dashed inner border
          this.ctx.strokeStyle = '#94A3B8';
          this.ctx.lineWidth = 1.2;
          this.ctx.setLineDash([4, 4]);
          this.ctx.strokeRect(c.x + 4, c.y + 4, badgeW - 8, badgeH - 8);
          this.ctx.setLineDash([]);

          this.ctx.fillStyle = '#64748B';
          this.ctx.font = '900 12px Montserrat, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(`+ ADD PLAYER ${idx + 1}`, c.x + badgeW / 2, c.y + 26);

          this.ctx.fillStyle = '#94A3B8';
          this.ctx.font = '600 10px sans-serif';
          this.ctx.fillText('(Tap or Click to Join)', c.x + badgeW / 2, c.y + 44);
        } else {
          // Active Player Card with 3D tactile edge
          this.ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
          this.ctx.shadowBlur = 10;
          this.ctx.shadowOffsetY = 3;

          // 3D bottom bevel
          this.drawRoundedRect(c.x, c.y + 3, badgeW, badgeH - 1, 12, p.colorDark);
          // Card face
          this.drawRoundedRect(c.x, c.y, badgeW, badgeH - 2, 12, '#FFFFFF', p.color, 2);

          // Player color accent tab on left edge
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          if (this.ctx.roundRect) {
            this.ctx.roundRect(c.x, c.y + 6, 4, badgeH - 14, [2, 0, 0, 2]);
          } else {
            this.ctx.rect(c.x, c.y + 6, 4, badgeH - 14);
          }
          this.ctx.fill();

          // High-polish procedural vector character mascot
          const isBot = p.type.startsWith('bot_');
          drawCharacter(
            this.ctx,
            c.x + badgeW - 24,
            c.y + 28,
            18,
            p.id,
            isBot,
            'idle',
            performance.now() * 0.001
          );

          // Player Name
          this.ctx.fillStyle = '#0F172A';
          this.ctx.font = '900 13px Montserrat, sans-serif';
          this.ctx.textAlign = 'left';
          this.ctx.fillText(p.name, c.x + 14, c.y + 20);

          // Status chip text in clean tactile pill
          let statusStr = 'HUMAN';
          let statusColor = '#059669';
          let statusBg = '#ECFDF5';
          if (p.type === 'bot_easy') { statusStr = 'BOT: EASY'; statusColor = '#16A34A'; statusBg = '#F0FDF4'; }
          else if (p.type === 'bot_normal') { statusStr = 'BOT: NORMAL'; statusColor = '#0284C7'; statusBg = '#F0F9FF'; }
          else if (p.type === 'bot_hard') { statusStr = 'BOT: HARD'; statusColor = '#DC2626'; statusBg = '#FEF2F2'; }

          this.drawRoundedRect(c.x + 14, c.y + 26, 92, 16, 4, statusBg);
          this.ctx.fillStyle = statusColor;
          this.ctx.font = '900 9px Montserrat, sans-serif';
          this.ctx.fillText(statusStr, c.x + 18, c.y + 38);

          // Keycap shortcut hint
          this.ctx.fillStyle = '#64748B';
          this.ctx.font = '10px monospace';
          this.ctx.fillText(`⌨ ${controlHints[idx]}`, c.x + 14, c.y + 53);
        }
        this.ctx.restore();
      });
    } else {
      // Mobile / Tablet: Sleek compact player dock bar sitting cleanly above the bottom utility bar
      const dockH = 28;
      const dockY = h - 90;
      const maxDockW = Math.min(460, w - 24);
      const dockGap = 6;
      const chipW = Math.max(48, Math.floor((maxDockW - 3 * dockGap) / 4));
      const totalDockW = 4 * chipW + 3 * dockGap;
      const dockStartX = (w - totalDockW) / 2;

      this.players.forEach((p, idx) => {
        const chipX = dockStartX + idx * (chipW + dockGap);
        this.playerBadgeHitboxes.push({ pid: idx, x: chipX, y: dockY, w: chipW, h: dockH });
        const isDisabled = p.type === 'disabled';

        this.ctx.save();
        if (isDisabled) {
          this.drawRoundedRect(chipX, dockY, chipW, dockH, 6, '#F8FAFC', '#CBD5E1', 1);
          this.ctx.fillStyle = '#94A3B8';
          this.drawFittedButtonText(`+ P${idx + 1}`, chipX + chipW / 2, dockY + 17.5, chipW - 8, 9.5, 7.0, '700');
        } else {
          this.ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
          this.ctx.shadowBlur = 4;
          this.ctx.shadowOffsetY = 1;
          this.drawRoundedRect(chipX, dockY + 2, chipW, dockH - 2, 6, p.colorDark);
          this.drawRoundedRect(chipX, dockY, chipW, dockH - 2, 6, '#FFFFFF', p.color, 1.5);

          // Dot indicator
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(chipX + 8, dockY + (dockH - 2) / 2, 3, 0, Math.PI * 2);
          this.ctx.fill();

          const isBot = p.type.startsWith('bot_');
          const chipLabel = isBot ? `P${idx + 1}: ${p.type.replace('bot_', '').slice(0, 3).toUpperCase()}` : `P${idx + 1}: ME`;
          this.ctx.fillStyle = '#0F172A';
          this.drawFittedButtonText(chipLabel, chipX + chipW / 2 + 3, dockY + 16.5, chipW - 14, 9.0, 6.5, '800');
        }
        this.ctx.restore();
      });
    }
  }

  private renderHUD() {
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    const isNoLimit = (this.activeGame as any)?.isNoTimeLimit === true;
    const centerZoneW = isNoLimit ? 210 : 120;

    // Corner player HUD status pills with high-contrast frosted backing
    const isOrbital = this.activeGame instanceof OrbitalSlingshotGame;
    const isPhone = this.deviceMode === 'phone';
    const isCustomTouchDeck = Boolean(this.input.suppressPhoneOverlay);
    const activeCount = this.players.filter((p) => p.type !== 'disabled').length;
    const isPhone2P = isPhone && activeCount <= 2 && !isCustomTouchDeck;

    const hudPositions = isCustomTouchDeck ? [] : [
      {
        x: 18,
        y: isPhone2P ? h - 70 : 22,
        align: 'left' as const,
        p: this.players[0],
        keys: isOrbital ? 'W / Space' : 'WASD + Space',
        rotate180: false
      },
      {
        x: w - 18,
        y: isPhone2P ? 68 : 22,
        align: 'right' as const,
        p: this.players[1],
        keys: isOrbital ? '↑ / Enter' : 'Arrows + Enter',
        rotate180: isPhone2P
      },
      {
        x: 18,
        y: h - 22,
        align: 'left' as const,
        p: this.players[2],
        keys: isOrbital ? 'I / U' : 'C / IJKL',
        rotate180: false
      },
      {
        x: w - 18,
        y: h - 22,
        align: 'right' as const,
        p: this.players[3],
        keys: isOrbital ? '8 / 0' : 'M / Numpad',
        rotate180: false
      }
    ];

    for (const hp of hudPositions) {
      if (hp.p.type === 'disabled') continue;

      this.ctx.save();
      const isBot = hp.p.type.startsWith('bot_');
      const pillText = isPhone
        ? (isBot ? `${hp.p.name} [BOT]` : `${hp.p.name} (${hp.p.score}★)`)
        : `${hp.p.name} [${hp.keys}]`;
      this.ctx.font = '900 11px Montserrat, sans-serif';
      const textW = this.ctx.measureText(pillText).width;
      
      // Ensure player HUD pills never touch or block the central timer or utility controls on any resolution
      const centerReserve = (hp.y > h / 2) ? 170 : centerZoneW;
      const maxPillW = Math.max(60, Math.floor((w / 2 - centerReserve / 2) - 14));
      const pillW = Math.min(textW + 48, maxPillW);
      const pillH = 30;
      const pillX = hp.align === 'left' ? hp.x : hp.x - pillW;
      const pillY = hp.y - pillH / 2;

      if (hp.rotate180) {
        this.ctx.translate(pillX + pillW / 2, pillY + pillH / 2);
        this.ctx.rotate(Math.PI);
        this.ctx.translate(-(pillX + pillW / 2), -(pillY + pillH / 2));
      }

      // High-contrast frosted dark pill with 3D bevel
      this.drawRoundedRect(pillX, pillY + 2, pillW, pillH, 15, hp.p.colorDark);
      this.drawRoundedRect(pillX, pillY, pillW, pillH, 15, 'rgba(15, 23, 42, 0.90)', hp.p.color, 1.8);

      // Render miniature vector mascot inside HUD pill
      const charX = hp.align === 'left' ? pillX + 18 : pillX + pillW - 18;
      drawCharacter(this.ctx, charX, pillY + pillH / 2, 11, hp.p.id, isBot, 'idle', performance.now() * 0.001);

      // Clear readable white text clipped safely within pill bounds
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(pillX + 4, pillY, pillW - 8, pillH);
      this.ctx.clip();
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.textAlign = hp.align;
      const textX = hp.align === 'left' ? pillX + 34 : pillX + pillW - 34;
      this.ctx.fillText(pillText, textX, pillY + 19);
      this.ctx.restore();

      // Render equipped active booster badge if player has one
      const equippedBoosterId = EconomyManager.getInstance().getEquippedBooster(hp.p.id);
      if (equippedBoosterId) {
        let bLabel = '⚡ BOOST';
        let bBg = 'rgba(59, 130, 246, 0.9)';
        let bBorder = '#60A5FA';
        if (equippedBoosterId === 'booster_shield') {
          const hasShield = this.hasShield(hp.p.id);
          bLabel = hasShield ? '🛡️ AEGIS' : '🛡️ BROKEN';
          bBg = hasShield ? 'rgba(6, 182, 212, 0.9)' : 'rgba(100, 116, 139, 0.7)';
          bBorder = hasShield ? '#22D3EE' : '#94A3B8';
        } else if (equippedBoosterId === 'booster_turbo') {
          bLabel = '⚡ TURBO';
          bBg = 'rgba(2, 132, 199, 0.9)';
          bBorder = '#38BDF8';
        } else if (equippedBoosterId === 'booster_time') {
          bLabel = '⏱️ CHRONO';
          bBg = 'rgba(245, 158, 11, 0.9)';
          bBorder = '#FBBF24';
        } else if (equippedBoosterId === 'booster_double_coins') {
          bLabel = '💰 2x COINS';
          bBg = 'rgba(217, 119, 6, 0.9)';
          bBorder = '#FDE68A';
        } else if (equippedBoosterId === 'booster_siphon') {
          bLabel = '🧲 SIPHON';
          bBg = 'rgba(147, 51, 234, 0.9)';
          bBorder = '#C084FC';
        }

        const bW = 72;
        const bH = 17;
        const bX = hp.align === 'left' ? pillX : pillX + pillW - bW;
        const bY = hp.y < h / 2 ? pillY + pillH + 4 : pillY - bH - 4;

        this.ctx.save();
        this.drawRoundedRect(bX, bY, bW, bH, 5, bBg, bBorder, 1);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '900 8.5px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(bLabel, bX + bW / 2, bY + 12);
        this.ctx.restore();
      }

      this.ctx.restore();
    }

    // Top Center Stopwatch / Timer
    if (this.activeGame) {
      if (isNoLimit) {
        // Just For Fun / Altitude Speedrun Mode: live stopwatch with tenths and target height pill
        const elapsedSec = (this.activeGame as any)?.elapsedTime ?? this.matchElapsedSeconds;
        const targetMeters = (this.activeGame as any)?.targetMeters ?? 250;
        const mins = Math.floor(elapsedSec / 60);
        const secs = Math.floor(elapsedSec % 60);
        const tenths = Math.floor((elapsedSec * 10) % 10);
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;

        const timerW = 190;
        const timerH = 30;
        const timerX = w / 2 - timerW / 2;
        const timerY = isPhone2P ? 56 : 8;

        this.ctx.save();
        // High-contrast frosted glass container
        this.drawRoundedRect(timerX, timerY + 2, timerW, timerH, 14, '#064E3B');
        this.drawRoundedRect(timerX, timerY, timerW, timerH, 14, 'rgba(15, 23, 42, 0.94)', '#10B981', 1.8);

        // Vector Stopwatch Icon
        const iconX = timerX + 18;
        const iconY = timerY + timerH / 2;
        const iconR = 6;
        this.ctx.beginPath();
        this.ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#34D399';
        this.ctx.lineWidth = 1.8;
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(iconX - 2.5, iconY - iconR - 2.5);
        this.ctx.lineTo(iconX + 2.5, iconY - iconR - 2.5);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(iconX, iconY);
        this.ctx.lineTo(iconX, iconY - iconR * 0.6);
        this.ctx.lineTo(iconX + iconR * 0.45, iconY);
        this.ctx.stroke();

        // Digital Stopwatch Text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '900 14px Montserrat, monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(timeStr, timerX + 32, timerY + 22.5);

        // Target Altitude Pill Badge
        const badgeW = 76;
        const badgeH = 22;
        const badgeX = timerX + timerW - badgeW - 6;
        const badgeY = timerY + 6;
        this.drawRoundedRect(badgeX, badgeY, badgeW, badgeH, 8, 'rgba(16, 185, 129, 0.22)', '#10B981', 1.2);

        this.ctx.fillStyle = '#6EE7B7';
        this.ctx.font = '900 10.5px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`🎯 ${targetMeters}m`, badgeX + badgeW / 2, badgeY + 15);
        this.ctx.restore();
      } else {
        const timerVal = Math.ceil(this.activeGame.roundTimer);
        const isUrgent = this.activeGame.roundTimer < 10;
        const isCritical = this.activeGame.roundTimer <= 5;
        const pulseScale = isCritical ? 1.0 + Math.sin(performance.now() * 0.018) * 0.08 : 1.0;
        const timerW = 96 * pulseScale;
        const timerH = 30 * pulseScale;
        const timerX = w / 2 - timerW / 2;
        const timerY = (isPhone2P ? 56 : 8) - (timerH - 30) / 2;

        this.ctx.save();
        // Frosted beveled pill with high-contrast critical warning state
        this.drawRoundedRect(
          timerX,
          timerY,
          timerW,
          timerH,
          12,
          isCritical ? 'rgba(220, 38, 38, 0.95)' : 'rgba(15, 23, 42, 0.90)',
          isCritical ? '#FCA5A5' : (isUrgent ? '#EF4444' : '#38BDF8'),
          isCritical ? 2.5 : 1.5
        );

        // Draw procedural vector stopwatch icon
        const iconX = timerX + 22 * pulseScale;
        const iconY = timerY + timerH / 2;
        const iconR = 6 * pulseScale;
        this.ctx.beginPath();
        this.ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
        this.ctx.strokeStyle = isCritical ? '#FFFFFF' : '#38BDF8';
        this.ctx.lineWidth = 1.8 * pulseScale;
        this.ctx.stroke();

        // Top stopwatch button nub
        this.ctx.beginPath();
        this.ctx.moveTo(iconX - 2.5 * pulseScale, iconY - iconR - 2.5 * pulseScale);
        this.ctx.lineTo(iconX + 2.5 * pulseScale, iconY - iconR - 2.5 * pulseScale);
        this.ctx.stroke();

        // Stopwatch hands
        this.ctx.beginPath();
        this.ctx.moveTo(iconX, iconY);
        this.ctx.lineTo(iconX, iconY - iconR * 0.6);
        this.ctx.lineTo(iconX + iconR * 0.45, iconY);
        this.ctx.stroke();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `900 ${Math.round(16 * pulseScale)}px Montserrat, monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${timerVal}s`, timerX + timerW * 0.62, timerY + timerH * 0.68);
        this.ctx.restore();
      }
    }
  }

  private renderCountdownOverlay() {
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    // Dark backdrop overlay
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    this.ctx.fillRect(0, 0, w, h);

    const count = Math.ceil(this.countdownTimer);
    const frac = this.countdownTimer - Math.floor(this.countdownTimer);
    const isGo = count <= 0 || this.countdownTimer < 0.6;
    const text = isGo ? 'GO!' : `${count}`;

    // Active Game Title & Quick Control Banner above the countdown
    if (this.activeGame) {
      const activeMeta = this.activeGameId
        ? GAME_CATALOG.find((g) => g.id === this.activeGameId)
        : null;
      const gameMeta = activeMeta || GAME_CATALOG[this.selectedGameIndex];
      if (gameMeta) {
        const bannerW = Math.min(480, w * 0.90);
        const bannerH = 62;
        const bannerX = w / 2 - bannerW / 2;
        const bannerY = h / 2 - 130;

        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        this.ctx.shadowBlur = 16;
        this.ctx.shadowOffsetY = 4;
        this.drawRoundedRect(bannerX, bannerY, bannerW, bannerH, 12, 'rgba(15, 23, 42, 0.94)', '#38BDF8', 1.5);
        this.ctx.restore();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '900 17px Montserrat, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(gameMeta.title.toUpperCase(), w / 2, bannerY + 24);

        // Responsive mobile action prompt
        this.ctx.fillStyle = '#86EFAC';
        let promptText = `🎮 ${gameMeta.controlPrompt}`;
        if (this.input.suppressPhoneOverlay) {
          promptText = '🕹️ LEFT D-PAD TO MOVE/CLIMB  •  ⛏️ TAP DIG L / DIG R';
        } else if (this.deviceMode === 'phone') {
          const isSingle = (this.input as any)?.controlMode === 'single_button';
          promptText = isSingle
            ? '📱 TAP ANYWHERE ON YOUR HALF TO ACTION'
            : '🕹️ DRAG THUMBSTICK  •  ⚡ TAP ACTION BUTTON';
        }

        const maxTextW = bannerW - 20;
        this.ctx.font = 'bold 11px Montserrat, sans-serif';
        let textW = this.ctx.measureText(promptText).width;
        if (textW > maxTextW) {
          this.ctx.font = 'bold 9.5px Montserrat, sans-serif';
          textW = this.ctx.measureText(promptText).width;
          if (textW > maxTextW) {
            while (promptText.length > 10 && this.ctx.measureText(promptText + '...').width > maxTextW) {
              promptText = promptText.slice(0, -4);
            }
            promptText += '...';
          }
        }
        this.ctx.fillText(promptText, w / 2, bannerY + 47);
      }
    }

    // Dynamic scale spring pulse
    const scale = 1.0 + Math.sin(frac * Math.PI) * 0.32;
    const ringRadius = 60 + (1 - frac) * 50;
    const ringAlpha = Math.max(0, frac * 0.6);

    // Shockwave Ring
    this.ctx.save();
    this.ctx.strokeStyle = isGo ? `rgba(34, 197, 94, ${ringAlpha})` : `rgba(245, 158, 11, ${ringAlpha})`;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(w / 2, h / 2 + 30, ringRadius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    // Scaling Countdown Text with 3D drop shadow
    this.ctx.save();
    this.ctx.translate(w / 2, h / 2 + 30);
    this.ctx.scale(scale, scale);

    // 3D Shadow
    this.ctx.fillStyle = isGo ? '#15803D' : '#B45309';
    this.ctx.font = '900 88px Montserrat, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, 0, 4);

    // Face
    this.ctx.fillStyle = isGo ? '#22C55E' : '#FBBF24';
    this.ctx.fillText(text, 0, 0);

    // Outer stroke highlight
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeText(text, 0, 0);
    this.ctx.restore();
  }

  private renderPauseOverlay() {
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '900 36px Montserrat, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PAUSED', w / 2, h / 2 - 30);

    // Pause Overlay 3D Action Buttons (Resume, Settings, Lobby)
    const btnW = 115;
    const btnH = 42;
    const gap = 12;
    const totalW = 3 * btnW + 2 * gap;
    const startX = w / 2 - totalW / 2;
    const resumeX = startX;
    const settingsX = startX + btnW + gap;
    const lobbyX = startX + 2 * (btnW + gap);
    const btnY = h / 2 + 10;

    // Resume 2.5D Button
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(34, 197, 94, 0.4)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetY = 3;
    const resGrad = this.ctx.createLinearGradient(resumeX, btnY, resumeX, btnY + btnH);
    resGrad.addColorStop(0, '#22C55E');
    resGrad.addColorStop(1, '#15803D');
    this.drawRoundedRect(resumeX, btnY, btnW, btnH, 8, resGrad, '#86EFAC', 1.5);
    this.ctx.restore();

    this.ctx.fillStyle = '#FFFFFF';
    this.drawFittedButtonText('▶ RESUME [P]', resumeX + btnW / 2, btnY + 26, btnW - 10, 11.5, 8.5);

    // Settings 2.5D Button
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(2, 132, 199, 0.4)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetY = 3;
    const setGrad = this.ctx.createLinearGradient(settingsX, btnY, settingsX, btnY + btnH);
    setGrad.addColorStop(0, '#0284C7');
    setGrad.addColorStop(1, '#0369A1');
    this.drawRoundedRect(settingsX, btnY, btnW, btnH, 8, setGrad, '#7DD3FC', 1.5);
    this.ctx.restore();

    this.ctx.fillStyle = '#FFFFFF';
    this.drawFittedButtonText('⚙️ SETTINGS [S]', settingsX + btnW / 2, btnY + 26, btnW - 10, 11.5, 8.5);

    // Lobby 2.5D Button
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetY = 3;
    const lobGrad = this.ctx.createLinearGradient(lobbyX, btnY, lobbyX, btnY + btnH);
    lobGrad.addColorStop(0, '#EF4444');
    lobGrad.addColorStop(1, '#B91C1C');
    this.drawRoundedRect(lobbyX, btnY, btnW, btnH, 8, lobGrad, '#FCA5A5', 1.5);
    this.ctx.restore();

    this.ctx.fillStyle = '#FFFFFF';
    this.drawFittedButtonText('⌂ LOBBY [Esc]', lobbyX + btnW / 2, btnY + 26, btnW - 10, 11.5, 8.5);
  }

  private renderRoundOverOverlay() {
    this.roundOverCloudHitboxes = [];
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    this.ctx.fillRect(0, 0, w, h);

    const res = this.currentRoundResult;
    if (!res) return;

    // Winner Hero Mascot & Banner
    this.ctx.textAlign = 'center';
    if (res.winnerId !== null) {
      const winner = this.players[res.winnerId];
      const isBot = winner.type.startsWith('bot_');

      // Victorious Hero Mascot with Golden Crown & Sparkles
      drawCharacter(
        this.ctx,
        w / 2,
        h / 2 - 140,
        42,
        res.winnerId,
        isBot,
        'triumph',
        performance.now() * 0.001
      );

      this.ctx.fillStyle = winner.color;
      this.ctx.font = '900 40px Montserrat, sans-serif';
      this.ctx.fillText(`${winner.name.toUpperCase()} WINS!`, w / 2, h / 2 - 68);
    } else {
      // Draw Mascot Shocked Duo
      drawCharacter(this.ctx, w / 2 - 38, h / 2 - 135, 26, 0, false, 'shocked', performance.now() * 0.001);
      drawCharacter(this.ctx, w / 2 + 38, h / 2 - 135, 26, 1, false, 'shocked', performance.now() * 0.001);

      this.ctx.fillStyle = '#F59E0B';
      this.ctx.font = '900 40px Montserrat, sans-serif';
      this.ctx.fillText('ROUND DRAW!', w / 2, h / 2 - 68);
    }

    // MVP Highlight
    this.ctx.fillStyle = '#E2E8F0';
    this.ctx.font = '600 15px sans-serif';
    this.ctx.fillText(res.mvpHighlight, w / 2, h / 2 - 32);

    // Currency Victory Reward
    if (res.winnerId !== null) {
      const coinY = h / 2 - 12;
      this.drawCoinIcon(w / 2 - 64, coinY, 9);
      this.ctx.fillStyle = '#FDE68A';
      this.ctx.font = 'bold 13px Montserrat, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText('+15 COINS EARNED', w / 2 - 48, coinY + 4.5);
      this.ctx.textAlign = 'center';
    }

    // Standings mini list
    let standY = h / 2 + 8;
    res.rankings.forEach((r) => {
      const p = this.players[r.playerId];
      this.ctx.fillStyle = p.color;
      this.ctx.font = 'bold 14px sans-serif';
      this.ctx.fillText(`${r.place}. ${p.name}  —  Score: ${r.score}`, w / 2, standY);
      standY += 22;
    });

    // Tournament Cup Standings Tracker
    if (this.isTournament) {
      standY += 8;
      this.ctx.fillStyle = '#FBBF24';
      this.ctx.font = '900 13px Montserrat, sans-serif';
      this.ctx.fillText(`TOURNAMENT CUP RACE (First to ${this.tournamentGoalPoints} Wins)`, w / 2, standY);
      standY += 22;

      const activePlayers = this.players.filter((p) => p.type !== 'disabled');
      const tourneySummary = activePlayers
        .map((p) => `${p.name}: ${p.score} / ${this.tournamentGoalPoints} Wins`)
        .join('   •   ');

      this.ctx.fillStyle = '#F8FAFC';
      this.ctx.font = 'bold 12px Montserrat, sans-serif';
      this.ctx.fillText(tourneySummary, w / 2, standY);
      standY += 26;
    }

    // Rematch & Next Game Buttons in Center
    const btnW = this.isTournament ? 200 : 160;
    const btnH = 42;
    const gap = 14;
    const totalW = btnW + 130 + gap;
    const rematchX = w / 2 - totalW / 2;
    const menuX = rematchX + btnW + gap;
    const btnY = Math.max(h / 2 + 115, standY + 12);
    this.roundOverBtnY = btnY;

    // Rematch / Next 2.5D Button
    this.ctx.save();
    this.ctx.shadowColor = this.isTournament ? 'rgba(245, 158, 11, 0.45)' : 'rgba(59, 130, 246, 0.4)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetY = 3;
    const rematchGrad = this.ctx.createLinearGradient(rematchX, btnY, rematchX, btnY + btnH);
    if (this.isTournament) {
      rematchGrad.addColorStop(0, '#FBBF24');
      rematchGrad.addColorStop(1, '#D97706');
      this.drawRoundedRect(rematchX, btnY, btnW, btnH, 8, rematchGrad, '#FDE68A', 1.5);
    } else {
      rematchGrad.addColorStop(0, '#3B82F6');
      rematchGrad.addColorStop(1, '#1D4ED8');
      this.drawRoundedRect(rematchX, btnY, btnW, btnH, 8, rematchGrad, '#93C5FD', 1.5);
    }
    this.ctx.restore();

    this.ctx.fillStyle = '#FFFFFF';
    const nextBtnText = this.isTournament ? '🏆 NEXT CUP MATCH [Space]' : '🔄 REMATCH [Space]';
    this.drawFittedButtonText(nextBtnText, rematchX + btnW / 2, btnY + 26, btnW - 12, 12, 8.5);

    // Menu 2.5D Button
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetY = 3;
    const menuW = 130;
    const menuGrad = this.ctx.createLinearGradient(menuX, btnY, menuX, btnY + btnH);
    menuGrad.addColorStop(0, '#10B981');
    menuGrad.addColorStop(1, '#047857');
    this.drawRoundedRect(menuX, btnY, menuW, btnH, 8, menuGrad, '#6EE7B7', 1.5);
    this.ctx.restore();

    this.ctx.fillStyle = '#FFFFFF';
    this.drawFittedButtonText('⌂ LOBBY [Esc]', menuX + menuW / 2, btnY + 26, menuW - 10, 12, 8.5);

    // Post-Match Rate & Save Strip below Rematch/Lobby buttons
    const curGame = GAME_CATALOG[this.selectedGameIndex];
    if (curGame) {
      const rateY = btnY + btnH + 14;
      const cStats = this.cloud.getGameStats(curGame.id);
      const effR = this.cloud.getEffectiveRating(curGame.id);
      const litStars = cStats.userRating > 0 ? cStats.userRating : Math.round(effR);
      const stripW = 264;
      const stripX = w / 2 - stripW / 2;

      this.drawRoundedRect(stripX, rateY, stripW, 28, 8, 'rgba(15, 23, 42, 0.85)', 'rgba(148, 163, 184, 0.35)', 1);
      this.ctx.fillStyle = '#CBD5E1';
      this.ctx.font = '900 9.5px Montserrat, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText('RATE:', stripX + 10, rateY + 18);

      const starStart = stripX + 48;
      for (let s = 1; s <= 5; s++) {
        const sx = starStart + (s - 1) * 24;
        const isLit = s <= litStars;
        this.drawRoundedRect(
          sx,
          rateY + 4,
          20,
          20,
          4,
          isLit ? 'rgba(245, 158, 11, 0.25)' : 'rgba(30, 41, 59, 0.8)',
          isLit ? '#FBBF24' : '#475569',
          1
        );
        this.ctx.fillStyle = isLit ? '#FDE047' : '#64748B';
        this.ctx.font = '900 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('★', sx + 10, rateY + 18);
        const sVal = s;
        this.roundOverCloudHitboxes.push({
          x: sx,
          y: rateY + 2,
          w: 22,
          h: 24,
          action: () => this.rateGame(curGame.id, sVal)
        });
      }

      const saveX = starStart + 5 * 24 + 8;
      const saveW = 76;
      this.drawRoundedRect(
        saveX,
        rateY + 4,
        saveW,
        20,
        5,
        cStats.saved ? '#BE185D' : 'rgba(30, 41, 59, 0.9)',
        cStats.saved ? '#F472B6' : '#475569',
        1
      );
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '900 9px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(cStats.saved ? '❤️ SAVED' : '🤍 SAVE', saveX + saveW / 2, rateY + 17.5);
      this.roundOverCloudHitboxes.push({
        x: saveX,
        y: rateY + 2,
        w: saveW,
        h: 24,
        action: () => this.toggleSaveGame(curGame.id)
      });
    }
  }

  private renderPodiumOverlay() {
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    // Dark backdrop overlay
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    this.ctx.fillRect(0, 0, w, h);

    // Champion Golden Header Banner
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
    this.ctx.shadowBlur = 18;
    this.ctx.shadowOffsetY = 4;
    this.ctx.fillStyle = '#FBBF24';
    this.ctx.font = '900 36px Montserrat, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🏆 TOURNAMENT CHAMPION 🏆', w / 2, h / 2 - 145);
    this.ctx.restore();

    // Tournament Victory Coin Prize Pill
    const pCoinY = h / 2 - 116;
    this.drawCoinIcon(w / 2 - 110, pCoinY, 10);
    this.ctx.fillStyle = '#FDE68A';
    this.ctx.font = '900 14px Montserrat, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('+60 TOURNAMENT CHAMPIONSHIP COINS!', w / 2 - 92, pCoinY + 5);
    this.ctx.textAlign = 'center';

    // Podium Blocks: 2nd (Left), 1st (Center), 3rd (Right)
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    const p1 = sorted[0];
    const p2 = sorted[1];
    const p3 = sorted[2];

    const cx = w / 2;
    const basePodiumY = h / 2 + 130;

    // 1st Place (Gold Center Pedestal)
    if (p1) {
      const bW = 120;
      const bH = 125;
      const bX = cx - bW / 2;
      const bY = basePodiumY - bH;

      this.ctx.save();
      this.ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
      this.ctx.shadowBlur = 16;
      this.ctx.shadowOffsetY = 5;
      this.drawRoundedRect(bX, bY + 4, bW, bH, 12, '#B45309');
      const gGrad = this.ctx.createLinearGradient(bX, bY, bX, bY + bH);
      gGrad.addColorStop(0, '#FBBF24');
      gGrad.addColorStop(1, '#D97706');
      this.drawRoundedRect(bX, bY, bW, bH, 12, gGrad, '#FDE68A', 2);
      this.ctx.restore();

      // Podium Rank Number
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '900 34px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('1', cx, bY + 65);

      // 1st Place Champion Mascot standing on pedestal
      const isBot1 = p1.type.startsWith('bot_');
      drawCharacter(this.ctx, cx, bY - 45, 34, p1.id, isBot1, 'triumph', performance.now() * 0.001);

      // Player Name & Score Banner above
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '900 16px Montserrat, sans-serif';
      this.ctx.fillText(p1.name, cx, bY - 110);
      this.ctx.fillStyle = '#FDE68A';
      this.ctx.font = 'bold 13px sans-serif';
      this.ctx.fillText(`${p1.score} Wins`, cx, bY - 94);
    }

    // 2nd Place (Silver Left Pedestal)
    if (p2) {
      const bW = 110;
      const bH = 85;
      const bX = cx - 175;
      const bY = basePodiumY - bH;

      this.ctx.save();
      this.ctx.shadowColor = 'rgba(148, 163, 184, 0.35)';
      this.ctx.shadowBlur = 12;
      this.ctx.shadowOffsetY = 4;
      this.drawRoundedRect(bX, bY + 4, bW, bH, 10, '#475569');
      const sGrad = this.ctx.createLinearGradient(bX, bY, bX, bY + bH);
      sGrad.addColorStop(0, '#94A3B8');
      sGrad.addColorStop(1, '#64748B');
      this.drawRoundedRect(bX, bY, bW, bH, 10, sGrad, '#CBD5E1', 1.5);
      this.ctx.restore();

      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '900 28px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('2', bX + bW / 2, bY + 50);

      // 2nd Place Mascot
      const isBot2 = p2.type.startsWith('bot_');
      drawCharacter(this.ctx, bX + bW / 2, bY - 38, 28, p2.id, isBot2, 'happy', performance.now() * 0.001);

      this.ctx.fillStyle = '#E2E8F0';
      this.ctx.font = '900 14px Montserrat, sans-serif';
      this.ctx.fillText(p2.name, bX + bW / 2, bY - 76);
      this.ctx.fillStyle = '#CBD5E1';
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.fillText(`${p2.score} Wins`, bX + bW / 2, bY - 60);
    }

    // 3rd Place (Bronze Right Pedestal)
    if (p3 && p3.type !== 'disabled') {
      const bW = 110;
      const bH = 58;
      const bX = cx + 65;
      const bY = basePodiumY - bH;

      this.ctx.save();
      this.ctx.shadowColor = 'rgba(180, 83, 9, 0.35)';
      this.ctx.shadowBlur = 12;
      this.ctx.shadowOffsetY = 4;
      this.drawRoundedRect(bX, bY + 4, bW, bH, 10, '#78350F');
      const bGrad = this.ctx.createLinearGradient(bX, bY, bX, bY + bH);
      bGrad.addColorStop(0, '#B45309');
      bGrad.addColorStop(1, '#92400E');
      this.drawRoundedRect(bX, bY, bW, bH, 10, bGrad, '#FCD34D', 1.5);
      this.ctx.restore();

      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '900 24px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('3', bX + bW / 2, bY + 38);

      // 3rd Place Mascot
      const isBot3 = p3.type.startsWith('bot_');
      drawCharacter(this.ctx, bX + bW / 2, bY - 34, 25, p3.id, isBot3, 'focused', performance.now() * 0.001);

      this.ctx.fillStyle = '#E2E8F0';
      this.ctx.font = '900 14px Montserrat, sans-serif';
      this.ctx.fillText(p3.name, bX + bW / 2, bY - 68);
      this.ctx.fillStyle = '#CBD5E1';
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.fillText(`${p3.score} Wins`, bX + bW / 2, bY - 52);
    }

    // Back to Menu 2.5D Button
    const btnW = 216;
    const btnH = 44;
    const btnX = cx - btnW / 2;
    const btnY = basePodiumY + 25;

    this.ctx.save();
    this.ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
    this.ctx.shadowBlur = 12;
    this.ctx.shadowOffsetY = 3;
    this.drawRoundedRect(btnX, btnY + 4, btnW, btnH - 1, 10, '#1D4ED8');
    const menuGrad = this.ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    menuGrad.addColorStop(0, '#3B82F6');
    menuGrad.addColorStop(1, '#2563EB');
    this.drawRoundedRect(btnX, btnY, btnW, btnH - 2, 10, menuGrad, '#93C5FD', 1.5);
    this.ctx.restore();

    this.ctx.fillStyle = '#FFFFFF';
    this.drawFittedButtonText('⌂ MAIN MENU [Space / Esc]', cx, btnY + 27, btnW - 14, 12.5, 9.0);
  }

  private drawFittedButtonText(
    text: string,
    centerX: number,
    y: number,
    maxW: number,
    baseFontPx: number,
    minFontPx: number = 7.0,
    weight: string = '900'
  ) {
    this.ctx.textAlign = 'center';
    let sz = baseFontPx;
    this.ctx.font = `${weight} ${sz}px Montserrat, sans-serif`;
    while (this.ctx.measureText(text).width > maxW && sz > minFontPx) {
      sz = Math.max(minFontPx, sz - 0.5);
      this.ctx.font = `${weight} ${sz}px Montserrat, sans-serif`;
      if (sz <= minFontPx) break;
    }
    this.ctx.fillText(text, centerX, y, Math.max(8, maxW));
  }

  private wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = this.ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        this.ctx.fillText(line, x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    this.ctx.fillText(line, x, curY);
  }

  public handleCanvasClick(x: number, y: number) {
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    // Handle Trophy modal interactions
    if (this.isTrophiesOpen) {
      const modalW = Math.min(740, w * 0.95);
      const modalH = Math.min(540, h * 0.95);
      const modalX = w / 2 - modalW / 2;
      const modalY = h / 2 - modalH / 2;

      for (const box of this.trophyHitBoxes) {
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          box.action();
          return;
        }
      }

      const closeBtnX = modalX + modalW - 28;
      const closeBtnY = modalY + 28;
      if (Math.hypot(x - closeBtnX, y - closeBtnY) <= 22) {
        this.closeTrophies();
        return;
      }

      if (x < modalX || x > modalX + modalW || y < modalY || y > modalY + modalH) {
        this.closeTrophies();
        return;
      }

      return;
    }

    // Handle Shop / Mascot Wardrobe interactions
    if (this.isShopOpen) {
      if (this.packOpeningResult) {
        this.packOpeningResult = null;
        this.audio.playTap();
        return;
      }

      const modalW = Math.min(760, w * 0.95);
      const modalH = Math.min(560, h * 0.95);
      const modalX = w / 2 - modalW / 2;
      const modalY = h / 2 - modalH / 2;

      for (const box of this.shopHitBoxes) {
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          box.action();
          return;
        }
      }

      // Close button click
      const closeBtnX = modalX + modalW - 28;
      const closeBtnY = modalY + 28;
      if (Math.hypot(x - closeBtnX, y - closeBtnY) <= 22) {
        this.closeShop();
        return;
      }

      // Clicking outside modal closes it
      if (x < modalX || x > modalX + modalW || y < modalY || y > modalY + modalH) {
        this.closeShop();
        return;
      }

      return;
    }

    // Handle Settings modal interactions
    if (this.isSettingsOpen) {
      const modalW = Math.min(560, w * 0.94);
      const modalH = Math.min(540, h * 0.94);
      const modalX = w / 2 - modalW / 2;
      const modalY = h / 2 - modalH / 2;

      for (const box of this.settingsHitBoxes) {
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          box.action();
          return;
        }
      }

      // Clicking outside modal closes it
      if (x < modalX || x > modalX + modalW || y < modalY || y > modalY + modalH) {
        this.closeSettings();
        return;
      }

      return;
    }

    if (this.state === 'LOBBY') {
      // If modal is open, handle modal buttons / closing
      if (this.isModalOpen) {
        const game = GAME_CATALOG[this.modalGameIndex];
        const modalW = Math.min(560, w * 0.92);
        const modalH = (game?.id === 'skyline_sumo' || game?.id === 'sumo_lode_runner')
          ? Math.min(585, h * 0.95)
          : Math.min(545, h * 0.92);
        const modalX = w / 2 - modalW / 2;
        const modalY = h / 2 - modalH / 2;

        // Close button click
        const closeBtnX = modalX + modalW - 24;
        const closeBtnY = modalY + 22;
        if (Math.hypot(x - closeBtnX, y - closeBtnY) <= 22) {
          this.closeGameModal();
          return;
        }

        // Check Star Rating & Save buttons in Modal Header
        for (const chb of this.modalCloudHitboxes) {
          if (x >= chb.x && x <= chb.x + chb.w && y >= chb.y && y <= chb.y + chb.h) {
            chb.action();
            return;
          }
        }

        // Check Skyline Sumo / Sumo Lode Runner custom mode & stage hitboxes
        if (game?.id === 'skyline_sumo' || game?.id === 'sumo_lode_runner') {
          for (const hb of this.sumoHitboxes) {
            if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) {
              hb.action();
              return;
            }
          }
        }

        // Play button click (with generous touch padding)
        const btnW = 280;
        const btnH = 44;
        const btnX = modalX + modalW / 2 - btnW / 2;
        const btnY = modalY + modalH - 62;
        if (x >= btnX - 10 && x <= btnX + btnW + 10 && y >= btnY - 14 && y <= btnY + btnH + 8) {
          this.audio.playTap();
          this.startGame(GAME_CATALOG[this.modalGameIndex].id);
          return;
        }

        // Clicking outside modal dialog closes it
        if (x < modalX || x > modalX + modalW || y < modalY || y > modalY + modalH) {
          this.closeGameModal();
          return;
        }

        // Click inside modal dialog body (swallowed)
        return;
      }

      // Check Shop Coin Badge & Mascot Skins button
      if (this.shopCoinBadgeHitbox) {
        const b = this.shopCoinBadgeHitbox;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.openShop();
          return;
        }
      }
      if (this.shopLobbyBannerHitbox) {
        const b = this.shopLobbyBannerHitbox;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.openShop();
          return;
        }
      }
      if (this.trophyLobbyBannerHitbox) {
        const b = this.trophyLobbyBannerHitbox;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.openTrophies();
          return;
        }
      }

      // 0. Check category filter & quick action pills
      for (const pill of this.categoryPillBoxes) {
        if (x >= pill.x && x <= pill.x + pill.w && y >= pill.y && y <= pill.y + pill.h) {
          if (pill.id === 'CLASSIC_ARCADE') {
            this.audio.playTap();
            window.location.href = './classic/';
            return;
          } else if (pill.id === 'SEARCH') {
            if (this.searchQuery) {
              this.searchQuery = '';
              this.isSearchFocused = false;
            } else {
              this.isSearchFocused = !this.isSearchFocused;
            }
            this.audio.playTap();
          } else if (pill.type === 'category') {
            this.setSelectedCategory(pill.id);
          } else if (pill.type === 'random') {
            this.startRandomGame();
          } else if (pill.type === 'cup') {
            this.startCupTournament();
          } else if (pill.type === 'sort') {
            if (pill.id === 'SORT_CYCLE') {
              this.cycleCatalogSortMode();
            } else {
              this.setCatalogSortMode(pill.id as CatalogSortMode);
            }
          }
          return;
        }
      }

      // 1. Check player count quick tabs
      for (const tab of this.playerTabHitboxes) {
        if (x >= tab.x && x <= tab.x + tab.w && y >= tab.y && y <= tab.y + tab.h) {
          this.setPlayerCount(tab.count);
          this.audio.playTap();
          return;
        }
      }

      // 2. Check global AI difficulty tabs
      for (const diff of this.diffHitboxes) {
        if (x >= diff.x && x <= diff.x + diff.w && y >= diff.y && y <= diff.y + diff.h) {
          this.setGlobalDifficulty(diff.id);
          return;
        }
      }

      // 3. Check player badges / mobile dock chips
      for (const b of this.playerBadgeHitboxes) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.togglePlayerSlot(b.pid as PlayerId);
          return;
        }
      }

      // 4. Check scrollable game gallery cards (opens instructions modal)
      const { galleryX, galleryY, galleryW, galleryH, cols, gap, cardW, cardH, startX } = this.getGalleryLayout(w, h);

      if (x >= galleryX && x <= galleryX + galleryW && y >= galleryY && y <= galleryY + galleryH) {
        const displayedGames = this.getFilteredCatalog();

        for (let idx = 0; idx < displayedGames.length; idx++) {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const cardX = startX + col * (cardW + gap);
          const cardY = galleryY + row * (cardH + gap) - this.scrollY;

          if (x >= cardX && x <= cardX + cardW && y >= cardY && y <= cardY + cardH) {
            const catalogIdx = GAME_CATALOG.findIndex((g) => g.id === displayedGames[idx].id);
            this.openGameModal(catalogIdx !== -1 ? catalogIdx : idx);
            return;
          }
        }
      }
    } else if (this.state === 'PLAYING') {
      if (this.activeGame && typeof (this.activeGame as any).handlePointerDown === 'function') {
        const handled = (this.activeGame as any).handlePointerDown(x, y, w, h);
        if (handled) return;
      }
    } else if (this.state === 'PAUSED') {
      const btnW = 115;
      const btnH = 42;
      const gap = 12;
      const totalW = 3 * btnW + 2 * gap;
      const startX = w / 2 - totalW / 2;
      const resumeX = startX;
      const settingsX = startX + btnW + gap;
      const lobbyX = startX + 2 * (btnW + gap);
      const btnY = h / 2 + 10;

      // Resume button
      if (x >= resumeX && x <= resumeX + btnW && y >= btnY && y <= btnY + btnH) {
        this.state = 'PLAYING';
        this.audio.playTap();
        return;
      }
      // Settings button
      if (x >= settingsX && x <= settingsX + btnW && y >= btnY && y <= btnY + btnH) {
        this.openSettings();
        return;
      }
      // Lobby button
      if (x >= lobbyX && x <= lobbyX + btnW && y >= btnY && y <= btnY + btnH) {
        this.state = 'LOBBY';
        this.audio.playTap();
        return;
      }
    } else if (this.state === 'ROUND_OVER') {
      for (const chb of this.roundOverCloudHitboxes) {
        if (x >= chb.x && x <= chb.x + chb.w && y >= chb.y && y <= chb.y + chb.h) {
          chb.action();
          return;
        }
      }

      const btnW = this.isTournament ? 200 : 160;
      const btnH = 42;
      const gap = 14;
      const menuW = 130;
      const totalW = btnW + menuW + gap;
      const rematchX = w / 2 - totalW / 2;
      const menuX = rematchX + btnW + gap;
      const btnY = this.roundOverBtnY || (h / 2 + 130);

      // Rematch / Next Cup Match button
      if (x >= rematchX && x <= rematchX + btnW && y >= btnY && y <= btnY + btnH) {
        this.audio.playTap();
        if (this.isTournament) {
          this.startRandomGame();
        } else {
          this.startGame(GAME_CATALOG[this.selectedGameIndex].id);
        }
        return;
      }
      // Menu button
      if (x >= menuX && x <= menuX + menuW && y >= btnY && y <= btnY + btnH) {
        this.audio.playTap();
        this.state = 'LOBBY';
        return;
      }
    } else if (this.state === 'PODIUM') {
      // Main menu button
      const cx = w / 2;
      const basePodiumY = h / 2 + 130;
      const btnW = 180;
      if (x >= cx - btnW / 2 && x <= cx + btnW / 2 && y >= basePodiumY + 25 && y <= basePodiumY + 69) {
        this.exitPodiumToLobby();
      }
    }
  }

  public handleMouseMove(x: number, y: number): void {
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    if (this.isTrophiesOpen) {
      const modalW = Math.min(740, w * 0.95);
      const modalH = Math.min(540, h * 0.95);
      const modalX = w / 2 - modalW / 2;
      const modalY = h / 2 - modalH / 2;
      const closeBtnX = modalX + modalW - 28;
      const closeBtnY = modalY + 28;
      if (Math.hypot(x - closeBtnX, y - closeBtnY) <= 18) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
      for (const box of this.trophyHitBoxes) {
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }
      this.canvas.style.cursor = 'default';
      return;
    }

    if (this.isShopOpen) {
      const modalW = Math.min(760, w * 0.95);
      const modalH = Math.min(560, h * 0.95);
      const modalX = w / 2 - modalW / 2;
      const modalY = h / 2 - modalH / 2;
      const closeBtnX = modalX + modalW - 28;
      const closeBtnY = modalY + 28;
      if (Math.hypot(x - closeBtnX, y - closeBtnY) <= 18) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
      for (const box of this.shopHitBoxes) {
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }
      this.canvas.style.cursor = 'default';
      return;
    }

    if (this.isSettingsOpen) {
      const modalW = Math.min(560, w * 0.94);
      const modalH = Math.min(540, h * 0.94);
      const modalX = w / 2 - modalW / 2;
      const modalY = h / 2 - modalH / 2;
      const closeBtnX = modalX + modalW - 28;
      const closeBtnY = modalY + 28;
      if (Math.hypot(x - closeBtnX, y - closeBtnY) <= 18) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
      for (const box of this.settingsHitBoxes) {
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }
      this.canvas.style.cursor = 'default';
      return;
    }

    if (this.isModalOpen) {
      const game = GAME_CATALOG[this.modalGameIndex];
      const modalW = Math.min(560, w * 0.92);
      const modalH = (game?.id === 'skyline_sumo' || game?.id === 'sumo_lode_runner')
        ? Math.min(585, h * 0.95)
        : Math.min(545, h * 0.92);
      const modalX = w / 2 - modalW / 2;
      const modalY = h / 2 - modalH / 2;
      const closeBtnX = modalX + modalW - 24;
      const closeBtnY = modalY + 22;
      if (Math.hypot(x - closeBtnX, y - closeBtnY) <= 18) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
      for (const chb of this.modalCloudHitboxes) {
        if (x >= chb.x && x <= chb.x + chb.w && y >= chb.y && y <= chb.y + chb.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }
      if (game?.id === 'skyline_sumo' || game?.id === 'sumo_lode_runner') {
        for (const hb of this.sumoHitboxes) {
          if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) {
            this.canvas.style.cursor = 'pointer';
            return;
          }
        }
      }
      const btnW = 280;
      const btnH = 44;
      const btnX = modalX + modalW / 2 - btnW / 2;
      const btnY = modalY + modalH - 62;
      if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
      this.canvas.style.cursor = 'default';
      return;
    }

    if (this.state === 'LOBBY') {
      // Check Shop Coin Badge & Mascot Skins button
      if (this.shopCoinBadgeHitbox) {
        const b = this.shopCoinBadgeHitbox;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }
      if (this.shopLobbyBannerHitbox) {
        const b = this.shopLobbyBannerHitbox;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }
      if (this.trophyLobbyBannerHitbox) {
        const b = this.trophyLobbyBannerHitbox;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }

      // Category / Search pills
      for (const pill of this.categoryPillBoxes) {
        if (x >= pill.x && x <= pill.x + pill.w && y >= pill.y && y <= pill.y + pill.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }

      // Player count tabs
      for (const tab of this.playerTabHitboxes) {
        if (x >= tab.x && x <= tab.x + tab.w && y >= tab.y && y <= tab.y + tab.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }

      // AI difficulty tabs
      for (const diff of this.diffHitboxes) {
        if (x >= diff.x && x <= diff.x + diff.w && y >= diff.y && y <= diff.y + diff.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }

      // Player badges / mobile dock chips
      for (const b of this.playerBadgeHitboxes) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }

      // Gallery cards
      const { galleryX, galleryY, galleryW, galleryH, cols, gap, cardW, cardH, startX } = this.getGalleryLayout(w, h);

      if (x >= galleryX && x <= galleryX + galleryW && y >= galleryY && y <= galleryY + galleryH) {
        const displayedGames = this.getFilteredCatalog();

        for (let idx = 0; idx < displayedGames.length; idx++) {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const cardX = startX + col * (cardW + gap);
          const cardY = galleryY + row * (cardH + gap) - this.scrollY;

          if (x >= cardX && x <= cardX + cardW && y >= cardY && y <= cardY + cardH) {
            this.canvas.style.cursor = 'pointer';
            return;
          }
        }
      }
    } else if (this.state === 'PAUSED') {
      const btnW = 115;
      const btnH = 42;
      const gap = 12;
      const totalW = 3 * btnW + 2 * gap;
      const startX = w / 2 - totalW / 2;
      const btnY = h / 2 + 10;
      if (x >= startX && x <= startX + totalW && y >= btnY && y <= btnY + btnH) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
    } else if (this.state === 'ROUND_OVER') {
      const btnW = this.isTournament ? 200 : 160;
      const menuW = 130;
      const gap = 14;
      const totalW = btnW + menuW + gap;
      const rematchX = w / 2 - totalW / 2;
      const btnY = this.roundOverBtnY || (h / 2 + 130);
      if (x >= rematchX && x <= rematchX + totalW && y >= btnY && y <= btnY + 42) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
    } else if (this.state === 'PODIUM') {
      const cx = w / 2;
      const basePodiumY = h / 2 + 130;
      const btnW = 180;
      if (x >= cx - btnW / 2 && x <= cx + btnW / 2 && y >= basePodiumY + 25 && y <= basePodiumY + 69) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }

    this.canvas.style.cursor = 'default';
  }

  public resizeCanvas(): void {
    const container = this.canvas.parentElement;
    if (!container) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.logicalWidth = container.clientWidth;
    this.logicalHeight = container.clientHeight;
    this.canvas.width = Math.round(this.logicalWidth * this.dpr);
    this.canvas.height = Math.round(this.logicalHeight * this.dpr);
    this.canvas.style.width = this.logicalWidth + 'px';
    this.canvas.style.height = this.logicalHeight + 'px';
    this.dotPattern = null;
  }

  private setupResize() {
    const resize = () => {
      this.resizeCanvas();
    };
    window.addEventListener('resize', resize);
    resize();
  }
}
