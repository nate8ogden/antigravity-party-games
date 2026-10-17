# 📱 COMPLETE 260-GAME PHONE FEASIBILITY & MULTIPLAYER ANALYSIS

> **Generated Before Adapting Phone Controls**  
> **Scope:** Every single game in `GAME_CATALOG` (#1 to #260) + 4 brand-new Phone-Exclusive Touchscreen Games (#261 to #264).

---

## 📊 Executive Summary & Classification Tiers

| Phone Compatibility Tier | Game Count | Visibility in `💻 COMPUTER` Mode | Visibility in `📱 PHONE` Mode | How Multiplayer Works on Phone |
| :--- | :---: | :---: | :---: | :--- |
| **1. `4p_native` (4P Simultaneous Corner Touch)** | **147** | Always Visible (1P–4P) | Always Visible (1P–4P) | All 1–4 players play simultaneously using 4 ergonomic corner touch pads (Top-Left P1, Top-Right P2, Bottom-Left P3, Bottom-Right P4). |
| **2. `4p_split_bracket` (Dual 1v1 Top/Bottom → Winners Final)** | **30** | Always Visible (1P–4P) | Always Visible (1P–4P) | In 1P/2P: Full-screen 1v1 faceoff. In 3P/4P: **Simultaneous 1v1 on the Top Half + 1v1 on the Bottom Half**, and then the **Winners Play Each Other** in the Championship Final! |
| **3. `2p_only` (1P v AI or 2P Phone Only)** | **71** | Always Visible (1P–4P) | **Shown ONLY when `1 PLAYER V AI` or `2 PLAYERS` is selected** (Hidden in 3P/4P) | Uses full-width Top-vs-Bottom 2-player ergonomic touch controls (Left/Right/Action pads). Hidden when 3P or 4P is selected on Phone so players never get cramped 4-way steering. |
| **4. `pc_only` (Computer Only — Infeasible on Phone)** | **12** | Always Visible (1P–4P) | **Hidden in `📱 PHONE` Mode** (Replaced by `phone_only` games) | Requires desktop multi-key sequences, fine crosshair sniping, or dense keyboard layouts that are not feasible on a shared phone screen. |
| **5. `phone_only` (New Phone-Exclusive Replacement Games)** | **4** | **Hidden in `💻 COMPUTER` Mode** | **Shown ONLY in `📱 PHONE` Mode** (1P–4P) | Purpose-built mobile touchscreen games (*Thumb War Wrestle*, *Swipe Ninja Blitz*, *Tabletop Neon Hockey*, *Tap Tug Overdrive*) designed specifically for phone play! |

---

## 🚫 Tier 4: Games Infeasible on Phone (`pc_only` — 12 Games)
*These 12 games are automatically hidden when the top toggle is switched to `📱 PHONE`, and replaced by the new Phone-Exclusive games below.*

| # | Game ID | Title | Category | Why It Is Infeasible on Phone (`pc_only`) |
| :---: | :--- | :--- | :--- | :--- |
| 21 | `blade_parry` | **Blade Parry** | Action | Requires 5 distinct inputs per player (Left/Right shuffle, Up left-punch, Down right-punch, Action parry), which is too complex for shared mobile touch zones. |
| 28 | `sequence_clash` | **Sequence Clash** | Puzzle | Requires rapid 4-way directional arrow/WASD sequence typing (Up/Down/Left/Right combos) which lacks tactile key separation on a shared phone screen. |
| 30 | `wire_cutter` | **Wire Cutter** | Puzzle | Relies on distinct 4-direction color-coded key mapping (W/A/S/D vs Arrow directions) to snip specific bomb wires; virtual joysticks cause accidental wrong-wire snips. |
| 37 | `dont_look_down` | **Don** | Physics | Precision multi-tier platforming with simultaneous horizontal air-steering, double-jumping, and map-switching keys; cramped vertical camera per player on mobile. |
| 62 | `whack_a_thief` | **Whack-A-Thief** | Reflex | Requires rapid 2D cursor reticle positioning across a grid of windows plus a separate zap button; thumb sticks are too slow compared to direct desktop keys. |
| 65 | `target_sniper` | **Target Sniper** | Reflex | Fine 2D crosshair reticle aiming + firing across tiny moving targets; fingers occlude the targets and analog virtual sticks lack mouse/keyboard sniping precision. |
| 151 | `ferris_wheel` | **Sky Wheel Balance** | Physics | Uses separate Up/Down spoke climbing + Left/Right/Action adjacent spoke jumping + 1-3 theme keys; multi-axis spoke transfers are awkward on touch. |
| 245 | `ouija_spirit_board` | **Ouija Spirit Board** | Party | Requires reading all 26 alphabet letters on a board and steering a planchette to spell words; letters become too small and occluded by thumbs on a phone. |
| 252 | `laser_disc_dance` | **LaserDisc Dance** | Party | 4-direction DDR arrow rhythm matching (Up/Down/Left/Right on beat) requires discrete directional keys rather than an analog touch stick. |
| 253 | `crt_scanline_sniper` | **CRT Scanline Sniper** | Reflex | Lightgun crosshair precision shooter where small distant targets and scanline distortion make shared phone thumb-stick aiming frustrating. |
| 256 | `matrix_code_rain` | **Matrix Code Rain** | Puzzle | Dense falling glyph columns require reading tiny alphanumeric characters and precise horizontal terminal alignment that is illegible on a shared phone. |
| 259 | `landscape_artillery` | **Landscape Artillery** | Physics | Requires simultaneous dual-axis angle aiming + power pullback + firing across a wide landscape where tiny trajectories are hard to read on mobile. |

---

## 📱 Tier 5: Brand-New Phone-Exclusive Games (`phone_only` — 4 Games)
*These 4 new games appear exclusively when the `📱 PHONE` toggle is active, replacing the `pc_only` games with native touchscreen party action.*

| # | Game ID | Title | Category | Phone Multiplayer Support & Design |
| :---: | :--- | :--- | :--- | :--- |
| 261 | `thumb_war_wrestle` | **Thumb War Wrestle** | Action | **1–4 Players (4P Split-Bracket / Face-to-Face):** Hold your thumb pad to lock grips, dodge rival pins, and slam the Pin Strike button when the ring flashes gold! |
| 262 | `swipe_ninja_blitz` | **Swipe Ninja Blitz** | Reflex | **1–4 Players (4-Quadrant Touchscreen Slicer):** Swipe and tap flying neon fruit, sushi, and data orbs in your touch quadrant while avoiding decoy mines! |
| 263 | `tabletop_air_hockey` | **Tabletop Neon Hockey** | Sports | **1–4 Players (4P Split-Bracket / Tabletop Faceoff):** Direct touch-drag air hockey paddles with high-velocity puck physics—1v1 on Top + 1v1 on Bottom, then Winners play each other! |
| 264 | `tap_tug_overdrive` | **Tap Tug Overdrive** | Arcade | **1–4 Players (4-Corner Capacitor Mash):** Rapid-fire multi-touch plasma tug-of-war with critical golden surge windows built for mobile screens! |

---

## 🏆 Tier 2: 4-Player Phone Split-Bracket Games (`4p_split_bracket` — 30 Games)
*When played on `📱 PHONE` with 3 or 4 players, these games run **1v1 on the Top Half** and **1v1 on the Bottom Half** simultaneously, and then the **Winners Play Each Other** in the Grand Final!*

| # | Game ID | Title | Category | Control Prompt | Phone 3P/4P Adaptation |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 29 | `bubble_soccer` | **Bubble Soccer** | Action | `Steer: Drive Suit | Tap: Turbo Dash` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 39 | `highway_hop` | **Highway Hop** | Action | `Tap/Space: Hop Forward | Arrows/WASD: Steer & Jump` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 43 | `volley_spike` | **Volley Spike** | Physics | `A/D or Steer: Move | Tap/Space: Jump & Spike` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 45 | `pinball_battle` | **Pinball Battle** | Action | `Steer: Move Paddle | Tap/Hold Space: Fire Flippers` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 52 | `water_balloon` | **Water Balloon Barrage** | Action | `Hold: Angle & Power | Release: Launch Splash` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 55 | `rapid_drop4` | **Rapid Drop 4** | Puzzle | `Steer: Choose Column | Tap/Space: Drop Token` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 57 | `dodgeball_blitz` | **Dodgeball Blitz** | Action | `WASD / Arrows: Run | Space / Enter: Throw or Catch` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 58 | `gravity_golf` | **Gravity Golf** | Physics | `Steer: Aim Angle | Hold Space: Charge Power` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 59 | `cyber_disc` | **Cyber Disc** | Action | `WASD / Arrows: Skim | Space / Enter: Energy Shield` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 60 | `sumo_spheres` | **Sumo Spheres** | Physics | `WASD / Arrows: Roll | Space / Enter: Turbo Ram` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 63 | `pixel_curling` | **Pixel Curling** | Sports | `Steer: Aim Curl | Hold Space: Launch | Tap Space: Sweep` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 67 | `catapult_clash` | **Catapult Clash** | Physics | `Hold: Power / Arc | Release: Catapult Fire` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 68 | `jousting_knights` | **Jousting Knights** | Action | `Hold / Drag: Aim Lance | Tap: Charge & Couched Strike` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 70 | `castle_archer` | **Castle Archer** | Reflex | `WASD / Arrows: Aim Arc | Space / Tap: Release Bowstring` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 74 | `royal_feast` | **Royal Feast** | Party | `Move / Tap: Steer Platter / Reverse Direction` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 79 | `traffic_jam` | **Traffic Jam Fury** | Racing | `Left / Right: Switch Lanes | Hold: Turbo Throttle` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 82 | `drone_delivery` | **Drone Delivery** | Physics | `Steer: Tilt Drone | Hold: Rotor Lift` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 90 | `burger_stack` | **Burger Stack** | Action | `Steer: Move Plate Left / Right` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 91 | `ice_cream_scoop` | **Ice Cream Scoop** | Action | `Steer: Move Cone Left / Right` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 95 | `teppanyaki_catch` | **Teppanyaki Catch** | Action | `Steer: Slide Bowl Across Griddle` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 98 | `jellyfish_jump` | **Jellyfish Jump** | Action | `Steer: Move Diver Left / Right` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 103 | `crab_walk` | **Crab Walk** | Action | `Steer: Scuttle Left / Right` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 164 | `anubis_scales` | **Anubis Scales of Truth** | Puzzle | `Tap: Drop Offering` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 239 | `phantom_mirror_gaze` | **Phantom Mirror Gaze** | Puzzle | `Steer: Select Mirror | Tap: Shatter Mirror` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 240 | `cauldron_witch_brew` | **Cauldron Witch Brew** | Puzzle | `Steer: Select Ingredient | Tap: Drop In Cauldron` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 242 | `ghost_vacuum_buster` | **Ghost Vacuum Buster** | Action | `Steer: Aim Nozzle | Hold: Vacuum Suction` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 243 | `tombstone_crypt_slider` | **Tombstone Crypt Slider** | Physics | `Steer: Approach Tomb | Hold: Slide Slab` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 248 | `pixel_space_invader` | **Pixel Space Invader** | Action | `Steer: Move Cannon | Tap: Fire Laser` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 251 | `breakout_brick_blaster` | **Breakout Brick Blaster** | Physics | `Steer: Slide Paddle | Volley Ball` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |
| 258 | `power_path_clash` | **Power Path Clash** | Action | `WASD / Arrows: Select Door • Space / Enter: Advance` | Top 1v1 (P1 vs P2) + Bottom 1v1 (P3 vs P4) → Winners Final |

---

## 👥 Tier 3: 2-Player / 1P v AI Only on Phone (`2p_only` — 71 Games)
*These games require full 2D steering or wider horizontal space per player. When `📱 PHONE` mode is active, they **ONLY appear when `1 PLAYER V AI` or `2 PLAYERS` is selected** and are hidden when `3 PLAYERS` or `4 PLAYERS` is selected.*

| # | Game ID | Title | Category | Control Prompt | Phone Visibility & Adaptation |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `tanks` | **Cyber Tanks 2.0** | Action | `Hold: Rotate | Release: Drive | Tap: Fire (1.2s Recharge)` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 2 | `hovercraft` | **Neon Bumper Derby** | Action | `WASD / Arrows: Steer & Drive | Space / Tap: Turbo Boost | Grippy Tires` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 6 | `ghost_flashlight` | **Ghost Flashlight** | Action | `Move: Direct / WASD / Stick | Hold Action: Ultra-Beam | Least Ghost Time Wins` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 9 | `animal_stack` | **Animal Stack** | Physics | `Space / Tap: Drop | W / S / ↑ / ↓ / R: Rotate | A / D / ← / →: Steer` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 12 | `anvil_rain` | **Anvil Rain** | Reflex | `Steer: Run | Tap / Space: Dash & Body-Check` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 13 | `bomb_relay` | **Bomb Relay** | Action | `Tap/Hold: Dash & Tag` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 19 | `turf_whack` | **Turf Whack** | Party | `Tap: Swing Mallet` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 26 | `color_clash` | **Color Clash** | Action | `Steer: Paint Tiles | Seek Paint Bombs` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 31 | `magma_hop` | **Magma Hop** | Reflex | `Steer / Arrows / Tap: Leap To Adjacent Pillar` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 33 | `cosmic_vortex` | **Cosmic Vortex** | Physics | `Hold: Fire Thrusters | Tap: Repulsor Pulse` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 34 | `pixel_paintball` | **Pixel Paintball** | Action | `Hold: Aim Cannon | Release: Fire Splat Pellet` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 35 | `minefield_dash` | **Minefield Dash** | Puzzle | `WASD / Arrows: Move • Space / Enter: Dash Sprint` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 36 | `asteroid_miner` | **Asteroid Miner** | Physics | `A/D or Left/Right: Steer • Space/Enter or W/Up: Fire Thrusters` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 38 | `snowball_fight` | **Snowball Fight** | Action | `Hold: Charge Power | Release: Throw | A/D or Steer: Aim` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 44 | `maze_escape` | **Maze Escape** | Puzzle | `Arrows/WASD: Move | Tap/Space: Drop Trap` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 46 | `mole_panic` | **Mole Panic** | Reflex | `Steer / Move: Position Mallet | Tap/Space: Whack!` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 47 | `color_flood` | **Color Flood** | Puzzle | `Tap/Space: Flood Color | Steer: Pick Color` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 48 | `memory_matrix` | **Memory Matrix** | Reflex | `Tap/Space: Strike Pad | Sweep: Auto Pointer` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 49 | `snake_arena` | **Snake Arena** | Action | `Tap/Space: 90° Turn | Steer: Guide Direction` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 53 | `sheep_dog` | **Sheep Dog Corrals** | Party | `Hold: Sprint | Release: Bark Shockwave` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 56 | `floor_painter` | **Floor Painter** | Action | `Hold: Steer & Drift | Bump Rivals: Steal Paint` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 61 | `sky_gliders` | **Sky Gliders** | Action | `Throttle Up/Down: Pitch Climb/Dive | Steer: Bank Left/Right` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 64 | `bumper_boats` | **Bumper Boats** | Action | `Steer: Rudder | Throttle: Propeller | Space: Water Cannon` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 66 | `fruit_chopper` | **Fruit Chopper** | Reflex | `WASD / Arrows: Move Blade | Space / Enter: Katana Slice` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 69 | `dragon_tamer` | **Dragon Tamer** | Party | `WASD / Move: Guide Tamer | Tap / Space: Sound Horn` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 76 | `dungeon_escape` | **Dungeon Maze Runner** | Action | `WASD / Move: Steer Runner | Tap: 90° Quick Turn` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 77 | `neon_drifters` | **Neon Drifters** | Racing | `WASD / Move: Steer / Drift | Space / Gas: Accelerate` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 78 | `hoverboard_rail` | **Hoverboard Rail** | Action | `Up / Down: Switch Rails | Tap / Space: Ollie Jump` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 80 | `nitro_kart` | **Nitro Kart Arena** | Action | `Steer: Drive Kart | Tap / Space: Launch Weapon` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 81 | `monorail_hijack` | **Monorail Hijack** | Action | `Left / Right: Run Roof | Up / Tap: Jump | Down: Duck` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 83 | `rocket_skates` | **Rocket Skates** | Racing | `Steer: Inner/Outer Lane | Hold: Rocket Boost` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 84 | `cyber_demolition` | **Cyber Demolition** | Physics | `Steer & Drive: Swing Wrecking Ball` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 86 | `gravity_pods` | **Gravity Pods** | Action | `Steer: Rotate Around Tube | Tap: Nitro Surge` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 97 | `submarine_torpedo` | **Submarine Torpedo** | Action | `Steer: Navigate Trench | Tap / Space: Launch Torpedo` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 100 | `shark_bait` | **Shark Bait** | Action | `Steer: Navigate Raft` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 102 | `octopus_ink` | **Octopus Ink** | Action | `Steer: Orbit / Radial | Tap / Space: Turbo Thrust` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 104 | `electric_eel` | **Electric Eel** | Action | `Steer: Pilot Submersible` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 105 | `water_scooter` | **Water Scooter** | Racing | `Steer: Carve Turns | Hold: Accelerate` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 107 | `moon_lander` | **Moon Lander** | Physics | `Steer: Tilt Lander | Hold: Fire Thrusters` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 108 | `space_junk_salvage` | **Space Junk Salvage** | Action | `Steer: Pilot Tug | Action: Magnetic Tractor Beam` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 109 | `alien_probe` | **Alien Probe** | Action | `Steer: Fly Saucer | Action: Stealth Cloaking` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 110 | `solar_flare` | **Solar Flare** | Action | `Steer: Navigate | Action / Up: Unfurl Solar Sail` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 111 | `wormhole_leap` | **Wormhole Leap** | Action | `Steer: Navigate | Action: Quantum Warp Burst` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 112 | `astro_miner` | **Astro Miner** | Action | `Steer: Pilot Miner | Action / Space: Fire Mining Laser` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 113 | `nebula_drift` | **Nebula Drift** | Racing | `Steer: Drift Craft | Action: Turbo Nitro Boost` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 114 | `satellite_laser` | **Satellite Laser** | Puzzle | `Steer: Position Satellite | Action: Rotate Mirror` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 115 | `mars_rover` | **Mars Rover** | Action | `Steer: Drive Rover | Action: Deploy Soil Drill` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 116 | `zero_g_tether` | **Zero-G Tether** | Physics | `Steer: Thrusters | Action: Reel / Latch Tether` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 211 | `bumper_car_derby` | **Bumper Car Derby** | Action | `Steer: Drive | Tap: Nitro Ram` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 218 | `trex_egg_scramble` | **T-Rex Egg Scramble** | Action | `Steer: Sneak | Release: Freeze` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 219 | `piranha_river_hop` | **Piranha River Hop** | Reflex | `Tap: Hop Forward | Steer: Hop Lateral` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 220 | `pterodactyl_glide` | **Pterodactyl Glide** | Racing | `Tap: Flap Wings | Hold: Dive` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 224 | `raptor_pounce_dodge` | **Raptor Pounce Dodge** | Action | `Steer: Move | Tap: Dodge Roll` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 226 | `volcano_lava_leap` | **Volcano Lava Leap** | Action | `Steer / Tap: Leap Basalt Pillar` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 228 | `honeybee_nectar_relay` | **Honeybee Nectar Relay** | Racing | `Steer: Fly Bee | Hover: Sip Nectar` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 229 | `spider_web_tangle` | **Spider Web Tangle** | Puzzle | `Tap: Crawl Web | Steer: Radial Switch` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 230 | `ant_colony_haul` | **Ant Colony Haul** | Action | `Steer: Scurry Ant | Touch: Grab & Deliver` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 231 | `firefly_night_beacon` | **Firefly Night Beacon** | Party | `Tap: Flash Lantern | Steer: Hover` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 232 | `dung_beetle_roll` | **Dung Beetle Roll** | Physics | `Steer: Roll Mud Ball | Ram: Bump Rivals` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 233 | `ladybug_aphid_hunt` | **Ladybug Aphid Hunt** | Action | `Steer: Skitter | Tap: Flutter Dash` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 235 | `dragonfly_dogfight` | **Dragonfly Dogfight** | Action | `Steer: Fly Dragonfly | Tap: Supersonic Dash` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 236 | `centipede_slalom` | **Centipede Slalom** | Racing | `Steer: Slalom Wiggle` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 237 | `poltergeist_possession` | **Poltergeist Possession** | Action | `Steer: Move Ghost | Tap: Possess & Hurl` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 238 | `graveyard_zombie_bash` | **Graveyard Zombie Bash** | Action | `Steer: Run Graveyard | Tap: Shovel Bash` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 241 | `gargoyle_stone_stare` | **Gargoyle Stone Stare** | Reflex | `Steer: Creep Forward | Release: Freeze Solid` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 246 | `cursed_clocktower_pendulum` | **Cursed Clocktower Pendulum** | Action | `Steer: Run Rafters | Hold: Duck / Crouch` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 247 | `synthwave_neon_racer` | **Synthwave Neon Racer** | Racing | `Steer: Switch Lanes | Hold: Turbo Nitro` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 249 | `vector_tank_battle` | **Vector Tank Battle** | Action | `Steer: Rotate Turret | Throttle: Drive | Tap: Shoot` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 250 | `pac_maze_chomp` | **Pac Maze Chomp** | Action | `Steer: Navigate Maze | Chomp Pellets` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 254 | `cyber_grid_runner` | **Cyber Grid Runner** | Action | `WASD / Arrows: 360° Hover | Space / Enter: Nitro Boost & EMP Shock` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |
| 257 | `sharks_and_minnows` | **Sharks & Minnows** | Action | `WASD / Arrows: Swim • Space / Enter: Dash / Lunge` | Visible in 1P/2P on Phone (Hidden in 3P/4P); Top-vs-Bottom 2P Touch Controls |

---

## ⚡ Tier 1: 4-Player Simultaneous Phone Games (`4p_native` — 147 Games)
*All 147 of these games work natively with 1, 2, 3, or 4 players simultaneously on one phone screen using the 4 corner touch zones.*

| # | Game ID | Title | Category | Control Prompt | Phone 1P–4P Simultaneous Support |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 3 | `laser_grid` | **Laser Grid Reflex** | Reflex | `Tap: Dash Step | Hold: Reverse Direction` | 4-Corner Simultaneous Touch (1P–4P) |
| 4 | `orbital` | **Orbital Slingshot** | Physics | `Hold [W] / [↑]: Tether Orbit | Release: Slingshot Arc` | 4-Corner Simultaneous Touch (1P–4P) |
| 5 | `micro_gp` | **Micro Turbo GP** | Racing | `Hold: Drift & Charge Nitro | Release: Unleash Nitro Blast` | 4-Corner Simultaneous Touch (1P–4P) |
| 7 | `kitchen_chaos` | **Kitchen Chaos** | Party | `Hold: Charge Throw | Release: Fling Food` | 4-Corner Simultaneous Touch (1P–4P) |
| 8 | `skyline_sumo` | **Skyline Sumo** | Action | `Hold: Charge Jump & Aim | Release: Spring Leap` | 4-Corner Simultaneous Touch (1P–4P) |
| 10 | `sumo_iceberg` | **Sumo Iceberg** | Physics | `Tap / Space: Sprint Tackle (3 Charges) | Steer: Ice Drift` | 4-Corner Simultaneous Touch (1P–4P) |
| 11 | `cannon_barrage` | **Cannon Barrage** | Action | `Tap: Fire Cannonball` | 4-Corner Simultaneous Touch (1P–4P) |
| 14 | `micro_hockey` | **Micro Hockey** | Action | `Hold: Defend & Slap Puck` | 4-Corner Simultaneous Touch (1P–4P) |
| 15 | `quick_draw` | **Quick Draw Western** | Reflex | `Tap on DRAW!: Fire Gun` | 4-Corner Simultaneous Touch (1P–4P) |
| 16 | `balloon_burst` | **Balloon Burst** | Party | `Hold: Pump Air | Release: Bank Score` | 4-Corner Simultaneous Touch (1P–4P) |
| 17 | `swat_fly` | **Swat the Fly** | Reflex | `WASD / Arrows to Move • Space / Enter to Swat` | 4-Corner Simultaneous Touch (1P–4P) |
| 18 | `stop_at_zero` | **Stop at Zero** | Reflex | `Tap: Freeze Blind Clock` | 4-Corner Simultaneous Touch (1P–4P) |
| 20 | `neon_lightcycles` | **Neon Lightcycles** | Racing | `Tap: Turn 90° Clockwise` | 4-Corner Simultaneous Touch (1P–4P) |
| 22 | `safe_dial` | **Safe Dial Lock** | Puzzle | `Tap: Lock Tumbler` | 4-Corner Simultaneous Touch (1P–4P) |
| 23 | `coin_apex` | **Coin Apex** | Reflex | `Tap: Catch at Apex` | 4-Corner Simultaneous Touch (1P–4P) |
| 24 | `red_light_sentry` | **Red Light Sentry** | Party | `Hold: Sprint | Release: Freeze` | 4-Corner Simultaneous Touch (1P–4P) |
| 25 | `laser_leap` | **Laser Leap** | Reflex | `Tap: Jump Over Laser Beam` | 4-Corner Simultaneous Touch (1P–4P) |
| 27 | `meteor_shield` | **Meteor Shield** | Physics | `Steer: Orbit Shield | Tap: Kinetic Pulse` | 4-Corner Simultaneous Touch (1P–4P) |
| 32 | `rhythm_duel` | **Rhythm Duel** | Reflex | `Space / Enter / Primary Tap: Hit Note On Beat` | 4-Corner Simultaneous Touch (1P–4P) |
| 40 | `gold_miner` | **Gold Rush Miner** | Physics | `Tap / Down: Fire Winch Claw` | 4-Corner Simultaneous Touch (1P–4P) |
| 41 | `chomp_frogs` | **Chomp Frogs** | Action | `Steer/WASD/Arrows: Aim & Hop | Space/Enter/Tap: Instant Chomp | 1-3: Switch Pond` | 4-Corner Simultaneous Touch (1P–4P) |
| 42 | `tug_of_war` | **Tug of War** | Action | `Tap / Space: Rhythm Power Pull` | 4-Corner Simultaneous Touch (1P–4P) |
| 50 | `mirror_laser` | **Mirror Laser** | Reflex | `Tap/Space: Rotate Mirror 45° | Deflect Beams` | 4-Corner Simultaneous Touch (1P–4P) |
| 51 | `domino_cascade` | **Domino Cascade** | Reflex | `Tap/Space in Rhythm: Lay Tile | Topple Chain` | 4-Corner Simultaneous Touch (1P–4P) |
| 54 | `chest_snatch` | **Chest Snatch** | Reflex | `Hold: Reach In & Grab | Release: Pull Hand Back` | 4-Corner Simultaneous Touch (1P–4P) |
| 71 | `drawbridge_panic` | **Drawbridge Panic** | Reflex | `Hold: Lower Bridge | Release: Raise Gate` | 4-Corner Simultaneous Touch (1P–4P) |
| 72 | `blacksmith_forge` | **Blacksmith Forge** | Reflex | `Tap / Press: Anvil Hammer Strike` | 4-Corner Simultaneous Touch (1P–4P) |
| 73 | `potion_alchemist` | **Potion Alchemist** | Reflex | `Tap / Space: Add Active Reagent` | 4-Corner Simultaneous Touch (1P–4P) |
| 75 | `sword_in_stone` | **Sword in the Stone** | Reflex | `Tap / Press: Power Heave Tug` | 4-Corner Simultaneous Touch (1P–4P) |
| 85 | `laser_speedway` | **Laser Speedway** | Racing | `Hold: Accelerate | Release: Coast & Cool Down` | 4-Corner Simultaneous Touch (1P–4P) |
| 87 | `pancake_flipper` | **Pancake Flipper** | Reflex | `Tap / Space: Flip Pancake` | 4-Corner Simultaneous Touch (1P–4P) |
| 88 | `sushi_express` | **Sushi Express** | Reflex | `Tap / Space: Snatch Plate` | 4-Corner Simultaneous Touch (1P–4P) |
| 89 | `pizza_toss` | **Pizza Toss** | Reflex | `Tap / Space: Catch & Toss Dough` | 4-Corner Simultaneous Touch (1P–4P) |
| 92 | `wok_stir_fry` | **Wok Stir Fry** | Reflex | `Tap / Space: Toss Wok` | 4-Corner Simultaneous Touch (1P–4P) |
| 93 | `donut_glazer` | **Donut Glazer** | Reflex | `Tap / Space: Dispense Glaze` | 4-Corner Simultaneous Touch (1P–4P) |
| 94 | `fruit_blender` | **Fruit Blender** | Action | `Tap / Space: Pulse Blender Blades` | 4-Corner Simultaneous Touch (1P–4P) |
| 96 | `popcorn_popper` | **Popcorn Popper** | Action | `Tap / Space: Snag Popped Kernels` | 4-Corner Simultaneous Touch (1P–4P) |
| 99 | `pearl_divers` | **Pearl Divers** | Reflex | `Tap / Space: Plunge Dive` | 4-Corner Simultaneous Touch (1P–4P) |
| 101 | `sunken_treasure` | **Sunken Treasure** | Reflex | `Tap / Space: Drop Winch Hook` | 4-Corner Simultaneous Touch (1P–4P) |
| 106 | `deep_sea_harpoon` | **Deep Sea Harpoon** | Reflex | `Tap / Space: Fire Harpoon` | 4-Corner Simultaneous Touch (1P–4P) |
| 117 | `saloon_brawler` | **Saloon Brawler** | Action | `Tap: Slide Mug | Hold: Duck Counter` | 4-Corner Simultaneous Touch (1P–4P) |
| 118 | `train_heist` | **Train Heist** | Action | `Tap: Jump Gap | Hold: Duck Low` | 4-Corner Simultaneous Touch (1P–4P) |
| 119 | `gold_panning` | **Gold Panning** | Puzzle | `Hold: Swirl Pan | Tap: Scoop Center Nugget` | 4-Corner Simultaneous Touch (1P–4P) |
| 120 | `rodeo_bull` | **Rodeo Bull** | Physics | `Tap / Hold: Counter-Lean Balance` | 4-Corner Simultaneous Touch (1P–4P) |
| 121 | `horseshoe_toss` | **Horseshoe Toss** | Sports | `Tap 1: Lock Aim | Tap 2: Pitch Power` | 4-Corner Simultaneous Touch (1P–4P) |
| 122 | `dynamite_tumble` | **Dynamite Tumble** | Action | `Tap: Kick Dynamite Away` | 4-Corner Simultaneous Touch (1P–4P) |
| 123 | `cactus_slalom` | **Cactus Slalom** | Racing | `Tap: Slalom Turn` | 4-Corner Simultaneous Touch (1P–4P) |
| 124 | `bandit_chase` | **Bandit Chase** | Action | `Tap: Fire Shotgun Blast` | 4-Corner Simultaneous Touch (1P–4P) |
| 125 | `rattlesnake_reflex` | **Rattlesnake Reflex** | Reflex | `Wait for Strike... Tap Instant!` | 4-Corner Simultaneous Touch (1P–4P) |
| 126 | `western_poker` | **Western Poker Showdown** | Party | `Tap: Draft Card in River` | 4-Corner Simultaneous Touch (1P–4P) |
| 127 | `laser_tripwire` | **Laser Tripwire** | Reflex | `Tap: Jump | Hold: Crawl Low` | 4-Corner Simultaneous Touch (1P–4P) |
| 128 | `vault_safe` | **Vault Safe Stethoscope** | Puzzle | `Tap: Lock Tumbler Gate` | 4-Corner Simultaneous Touch (1P–4P) |
| 129 | `security_camera` | **Security Camera Freeze** | Action | `Hold: Sneak | Release: Freeze Still` | 4-Corner Simultaneous Touch (1P–4P) |
| 130 | `briefcase_snatch` | **Briefcase Snatch** | Action | `Hold: Turn / Steer` | 4-Corner Simultaneous Touch (1P–4P) |
| 131 | `hack_terminal` | **Hack The Terminal** | Puzzle | `Tap: Decrypt Node` | 4-Corner Simultaneous Touch (1P–4P) |
| 132 | `smoke_bomb_escape` | **Smoke Bomb Escape** | Action | `Tap: Deploy Smoke Canister` | 4-Corner Simultaneous Touch (1P–4P) |
| 133 | `micro_wiretap` | **Micro Wiretap** | Reflex | `Tap in Green: Tighten Screw` | 4-Corner Simultaneous Touch (1P–4P) |
| 134 | `rooftop_zipline` | **Rooftop Zipline** | Racing | `Tap: Switch Cable Line` | 4-Corner Simultaneous Touch (1P–4P) |
| 135 | `drone_intercept` | **Drone Intercept** | Action | `Tap: Discharge EMP Shockwave` | 4-Corner Simultaneous Touch (1P–4P) |
| 136 | `disguise_shuffle` | **Disguise Shuffle** | Party | `Tap: Unmask Rogue Agent` | 4-Corner Simultaneous Touch (1P–4P) |
| 137 | `synthwave_highway` | **Synthwave Highway** | Action | `Tap: Switch Lane` | 4-Corner Simultaneous Touch (1P–4P) |
| 138 | `drum_solo` | **Drum Solo** | Party | `Tap: Strike Snare` | 4-Corner Simultaneous Touch (1P–4P) |
| 139 | `turntable_scratch` | **Turntable Scratch** | Party | `Tap: Scratch Record` | 4-Corner Simultaneous Touch (1P–4P) |
| 140 | `bass_drop` | **Bass Drop** | Action | `Tap: Shockwave Leap` | 4-Corner Simultaneous Touch (1P–4P) |
| 141 | `vocal_pitch` | **Vocal Pitch** | Party | `Tap: Modulate Pitch` | 4-Corner Simultaneous Touch (1P–4P) |
| 142 | `breakdance_battle` | **Breakdance Battle** | Party | `Tap: Freeze Pose` | 4-Corner Simultaneous Touch (1P–4P) |
| 143 | `neon_metronome` | **Neon Metronome** | Party | `Tap: Hit Downbeat` | 4-Corner Simultaneous Touch (1P–4P) |
| 144 | `equalizer_bounce` | **Equalizer Bounce** | Action | `Tap: Surge Bounce` | 4-Corner Simultaneous Touch (1P–4P) |
| 145 | `retro_chiptune` | **Retro Chiptune** | Party | `Tap: Trigger Step Note` | 4-Corner Simultaneous Touch (1P–4P) |
| 146 | `disco_tile` | **Disco Tile** | Action | `Tap: Rotate 90°` | 4-Corner Simultaneous Touch (1P–4P) |
| 147 | `ring_toss` | **Neon Ring Pitch** | Reflex | `Steer: Aim Angle | Tap/Space: Pitch Hoop | 1-3: Switch Theme` | 4-Corner Simultaneous Touch (1P–4P) |
| 148 | `rollercoaster_thrill` | **Rollercoaster Thrill** | Action | `Tap: Lean Into Curve` | 4-Corner Simultaneous Touch (1P–4P) |
| 149 | `balloon_dart` | **Balloon Dart Gallery** | Action | `Steer: Aim Angle | Tap/Space: Pitch Dart | 1-3: Switch Gallery` | 4-Corner Simultaneous Touch (1P–4P) |
| 150 | `dunk_tank` | **Plunger Dunk Splashdown** | Action | `Steer: Aim Cannon | Tap/Space: Fire Plunger | Mash Tap: Climb Ladder | 1-3: Switch Tank` | 4-Corner Simultaneous Touch (1P–4P) |
| 152 | `funhouse_mirrors` | **Funhouse Mirrors** | Party | `Tap: Turn 90°` | 4-Corner Simultaneous Touch (1P–4P) |
| 153 | `cotton_candy` | **Sugar Cloud Stacker** | Party | `Steer: Slide Stick | Tap/Space: Cash In Stack | 1-3: Switch Theme` | 4-Corner Simultaneous Touch (1P–4P) |
| 154 | `test_strength` | **Test Your Strength** | Action | `Tap: Slam Hammer` | 4-Corner Simultaneous Touch (1P–4P) |
| 155 | `haunted_mansion` | **Haunted Mansion** | Action | `Tap: Fire UV Strobe` | 4-Corner Simultaneous Touch (1P–4P) |
| 156 | `fireworks_finale` | **Fireworks Grand Finale** | Party | `Tap: Detonate Apex` | 4-Corner Simultaneous Touch (1P–4P) |
| 157 | `hydra_slayer` | **Hydra Swamp Slayer** | Action | `Tap: Blade Strike` | 4-Corner Simultaneous Touch (1P–4P) |
| 158 | `pharaoh_tomb` | **Pharaoh Tomb Escape** | Reflex | `Tap: Vault Jump` | 4-Corner Simultaneous Touch (1P–4P) |
| 159 | `spartan_shield` | **Spartan Phalanx Wall** | Action | `Hold: Shield • Release: Spear` | 4-Corner Simultaneous Touch (1P–4P) |
| 160 | `kraken_whirlpool` | **Kraken Maelstrom Vortex** | Reflex | `Tap: Steer Rudder` | 4-Corner Simultaneous Touch (1P–4P) |
| 161 | `icarus_wings` | **Flight of Icarus** | Physics | `Tap: Flap Wings` | 4-Corner Simultaneous Touch (1P–4P) |
| 162 | `minotaur_labyrinth` | **Knossos Labyrinth** | Puzzle | `Tap: Switch Corridor` | 4-Corner Simultaneous Touch (1P–4P) |
| 163 | `olympus_lightning` | **Olympus Lightning Conduit** | Reflex | `Tap: Catch Lightning` | 4-Corner Simultaneous Touch (1P–4P) |
| 165 | `gorgon_gaze` | **Gorgon Mirror Deflection** | Action | `Hold: Mirror Shield` | 4-Corner Simultaneous Touch (1P–4P) |
| 166 | `viking_longship` | **Viking Fjord Raid** | Racing | `Tap: Drum Beat` | 4-Corner Simultaneous Touch (1P–4P) |
| 167 | `antimatter_containment` | **Antimatter Containment** | Reflex | `Tap: Magnetic Pulse` | 4-Corner Simultaneous Touch (1P–4P) |
| 168 | `warp_gate_jump` | **Warp Gate Hyperdrive** | Action | `Tap: Warp Jump` | 4-Corner Simultaneous Touch (1P–4P) |
| 169 | `solar_sail_rider` | **Solar Sail Corona Rider** | Racing | `Tap: Deploy / Furl Sail` | 4-Corner Simultaneous Touch (1P–4P) |
| 170 | `planetary_rover` | **Martian Planetary Rover** | Physics | `Tap: Low-G Hop` | 4-Corner Simultaneous Touch (1P–4P) |
| 171 | `pulsar_signal` | **Pulsar Radio Signal** | Reflex | `Tap: Lock Frequency` | 4-Corner Simultaneous Touch (1P–4P) |
| 172 | `asteroid_catcher` | **Kuiper Asteroid Catcher** | Action | `Tap: Fire Harpoon` | 4-Corner Simultaneous Touch (1P–4P) |
| 173 | `alien_abduction` | **UFO Alien Abduction** | Party | `Hold: Tractor Beam` | 4-Corner Simultaneous Touch (1P–4P) |
| 174 | `space_elevator` | **Space Elevator Tether** | Racing | `Tap: Magnetic Surge` | 4-Corner Simultaneous Touch (1P–4P) |
| 175 | `orbital_drop_pod` | **Orbital Drop Pod** | Physics | `Tap: Retro-Thruster` | 4-Corner Simultaneous Touch (1P–4P) |
| 176 | `dyson_sphere_collector` | **Dyson Swarm Collector** | Action | `Hold: Deploy Panels` | 4-Corner Simultaneous Touch (1P–4P) |
| 177 | `penguin_slide` | **Penguin Glacier Slide** | Racing | `Tap: Steer / Bank` | 4-Corner Simultaneous Touch (1P–4P) |
| 178 | `iceberg_breaker` | **Icebreaker Ram** | Action | `Hold: Charge Ram` | 4-Corner Simultaneous Touch (1P–4P) |
| 179 | `blizzard_beacon` | **Blizzard Lighthouse** | Puzzle | `Tap: Lock Beam Angle` | 4-Corner Simultaneous Touch (1P–4P) |
| 180 | `walrus_bask` | **Walrus Iceberg King** | Physics | `Hold: Belly Charge` | 4-Corner Simultaneous Touch (1P–4P) |
| 181 | `polar_ice_fishing` | **Polar Ice Fishing** | Reflex | `Tap: Cast & Strike` | 4-Corner Simultaneous Touch (1P–4P) |
| 182 | `aurora_collector` | **Aurora Borealis Weaver** | Party | `Tap: Shift Polarity` | 4-Corner Simultaneous Touch (1P–4P) |
| 183 | `dog_sled_dash` | **Husky Dog Sled Sprint** | Racing | `Tap: Leap Obstacle` | 4-Corner Simultaneous Touch (1P–4P) |
| 184 | `mammoth_stampede` | **Mammoth Stampede** | Action | `Hold: Move / Dodge` | 4-Corner Simultaneous Touch (1P–4P) |
| 185 | `frostbite_cavern` | **Frostbite Stalactite Cavern** | Reflex | `Tap: Direction Dash` | 4-Corner Simultaneous Touch (1P–4P) |
| 186 | `geyser_leap` | **Geothermal Geyser Leap** | Action | `Tap: Leap Next Stone` | 4-Corner Simultaneous Touch (1P–4P) |
| 187 | `clockwork_cogs` | **Clockwork Cog Synchrony** | Reflex | `Tap: Mesh Gears` | 4-Corner Simultaneous Touch (1P–4P) |
| 188 | `steam_boiler_relief` | **Steam Boiler Relief** | Physics | `Hold: Vent Steam Valve` | 4-Corner Simultaneous Touch (1P–4P) |
| 189 | `zeppelin_dogfight` | **Zeppelin Sky Duel** | Action | `Tap: Rotate & Shoot | Hold: Thrust` | 4-Corner Simultaneous Touch (1P–4P) |
| 190 | `tesla_coil_arc` | **Tesla Coil Lightning Net** | Reflex | `Hold: Ground Rod` | 4-Corner Simultaneous Touch (1P–4P) |
| 191 | `automator_assembly` | **Automaton Clockwork Assembly** | Action | `Tap: Stamp Gear` | 4-Corner Simultaneous Touch (1P–4P) |
| 192 | `pneumatic_tube_rush` | **Pneumatic Tube Dispatch** | Puzzle | `Tap: Toggle Gate` | 4-Corner Simultaneous Touch (1P–4P) |
| 193 | `ornithopter_flock` | **Ornithopter Wing Flight** | Racing | `Tap: Flap Wings` | 4-Corner Simultaneous Touch (1P–4P) |
| 194 | `pressure_gauge_lock` | **Pressure Gauge Safe Cracker** | Puzzle | `Tap: Lock Tumbler Pin` | 4-Corner Simultaneous Touch (1P–4P) |
| 195 | `copper_conduit` | **Copper Conduit Smelter** | Action | `Tap: Rotate Valve` | 4-Corner Simultaneous Touch (1P–4P) |
| 196 | `monocycle_derby` | **Velodrome Monocycle Derby** | Racing | `Hold: Pedal & Lean` | 4-Corner Simultaneous Touch (1P–4P) |
| 197 | `cyber_samurai_slash` | **Cyber Samurai Katana Duel** | Action | `Tap: Slash | Hold: Parry Shield` | 4-Corner Simultaneous Touch (1P–4P) |
| 198 | `mainframe_breach` | **Mainframe ICE Core Breach** | Puzzle | `Tap: Fire Data Packet` | 4-Corner Simultaneous Touch (1P–4P) |
| 199 | `hovercar_skyline` | **Hovercar Skyline Highway** | Racing | `Tap: Switch Lane` | 4-Corner Simultaneous Touch (1P–4P) |
| 200 | `hologram_glitch` | **Hologram Glitch Purge** | Reflex | `Tap: Purge Glitch` | 4-Corner Simultaneous Touch (1P–4P) |
| 201 | `laser_grapple` | **Laser Grapple Swing** | Physics | `Hold: Grapple | Release: Leap` | 4-Corner Simultaneous Touch (1P–4P) |
| 202 | `neural_synapse` | **Neural Synapse Bridge** | Party | `Tap: Toggle Synapse` | 4-Corner Simultaneous Touch (1P–4P) |
| 203 | `drone_swarm_defense` | **Drone Swarm EMP Bastion** | Action | `Tap: EMP Shockwave` | 4-Corner Simultaneous Touch (1P–4P) |
| 204 | `synth_keytar_solo` | **Synthwave Keytar Solo** | Reflex | `Tap: Strike Note` | 4-Corner Simultaneous Touch (1P–4P) |
| 205 | `quantum_tunneling` | **Quantum Tunneling Accelerator** | Reflex | `Hold: Phase Shift` | 4-Corner Simultaneous Touch (1P–4P) |
| 206 | `hyperloop_racer` | **Maglev Hyperloop Velocity** | Racing | `Hold: Maglev Thrust` | 4-Corner Simultaneous Touch (1P–4P) |
| 207 | `ring_toss_frenzy` | **Ring Toss Frenzy** | Reflex | `Hold: Charge Throw | Release: Pitch Ring` | 4-Corner Simultaneous Touch (1P–4P) |
| 208 | `balloon_dart_clown` | **Balloon Dart Clown** | Action | `Tap / Action: Fire Dart` | 4-Corner Simultaneous Touch (1P–4P) |
| 209 | `duck_pond_derby` | **Duck Pond Derby** | Physics | `Tap / Action: Drop & Reel Hook` | 4-Corner Simultaneous Touch (1P–4P) |
| 210 | `milk_bottle_knockdown` | **Milk Bottle Knockdown** | Action | `Hold: Charge Pitch | Release: Throw Baseball` | 4-Corner Simultaneous Touch (1P–4P) |
| 212 | `cotton_candy_spin` | **Cotton Candy Spin** | Party | `Tap / Steer: Reverse Cone Spin` | 4-Corner Simultaneous Touch (1P–4P) |
| 213 | `roller_coaster_brake` | **Roller Coaster Brake** | Racing | `Hold: Apply Track Brakes` | 4-Corner Simultaneous Touch (1P–4P) |
| 214 | `ferris_wheel_hop` | **Ferris Wheel Hop** | Physics | `Tap / Action: Leap Gondola` | 4-Corner Simultaneous Touch (1P–4P) |
| 215 | `dunk_clown_tank` | **Dunk Clown Tank** | Reflex | `Tap / Action: Pitch Softball` | 4-Corner Simultaneous Touch (1P–4P) |
| 216 | `fortune_teller_tarot` | **Fortune Teller Tarot** | Party | `Tap / Action: Select Arcana Card` | 4-Corner Simultaneous Touch (1P–4P) |
| 217 | `vine_swing_canopy` | **Vine Swing Canopy** | Physics | `Tap: Release / Catch Vine` | 4-Corner Simultaneous Touch (1P–4P) |
| 221 | `quicksand_escape` | **Quicksand Escape** | Party | `Tap: Kick Mud | Hold: Grab Rope` | 4-Corner Simultaneous Touch (1P–4P) |
| 222 | `blowpipe_target` | **Blowpipe Target** | Reflex | `Hold: Inhale Breath | Release: Fire Dart` | 4-Corner Simultaneous Touch (1P–4P) |
| 223 | `amber_fossil_excavate` | **Amber Fossil Excavate** | Puzzle | `Tap: Chisel Rock Block` | 4-Corner Simultaneous Touch (1P–4P) |
| 225 | `bamboo_pole_vault` | **Bamboo Pole Vault** | Sports | `Tap: Plant Pole | Release: Launch Vault` | 4-Corner Simultaneous Touch (1P–4P) |
| 227 | `caterpillar_inchworm` | **Caterpillar Inchworm** | Reflex | `Hold: Contract Tail | Release: Extend Head` | 4-Corner Simultaneous Touch (1P–4P) |
| 234 | `grasshopper_high_jump` | **Grasshopper High Jump** | Sports | `Hold: Charge Jump | Release: Launch Leap` | 4-Corner Simultaneous Touch (1P–4P) |
| 244 | `creepy_doll_crawl` | **Creepy Doll Crawl** | Racing | `Hold: Wind Spring | Release: Crawl Sprint` | 4-Corner Simultaneous Touch (1P–4P) |
| 255 | `synth_drum_pad` | **Synth Drum Pad** | Party | `Steer: Select Pad | Tap: Strike On Beat` | 4-Corner Simultaneous Touch (1P–4P) |
| 260 | `spam_click_showdown` | **Spam Click Showdown** | Party | `SPAM CLICK MOUSE / TAP / SPACE / ENTER / BUTTONS AS FAST AS YOU CAN!` | 4-Corner Simultaneous Touch (1P–4P) |
