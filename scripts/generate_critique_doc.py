import json
import os
import re
import sys

def main():
    with open('all_catalog_games.json', 'utf8') as f:
        games = json.load(f)
    with open('game_class_mapping.json', 'utf8') as f:
        mapping = json.load(f)

    print(f"Loaded {len(games)} games and {len(mapping)} mappings.")

    output_path = 'GAME_CRITIQUES_AND_RESOLUTIONS.md'

    lines = []
    
    # Header
    lines.append("# Master Architectural Review: Exhaustive Minigame Critiques & Definitive Design Resolutions")
    lines.append("**Document Status:** Permanent Reference Specification for All AI Agents & Human Developers  ")
    lines.append("**Target Suite:** Antigravity 1–4 Player Local Arcade Suite (260 Registered Minigames)  ")
    lines.append("**Evaluation Perspective:** Brutally Honest Human Couch Player, Competitive Game Designer, & Systems Auditor  ")
    lines.append("**Scope:** Complete End-to-End Teardown & Resolution for Every Single Game (#1 to #260)  \n")
    lines.append("---\n")
    
    # Executive Summary & Philosophy
    lines.append("## 1. Executive Summary & The \"Couch Play\" Philosophy\n")
    lines.append("### 1.1 The Human Player Reality")
    lines.append("Video games played locally on a single screen between two to four people have one fundamental job: **they must create immediate physical, emotional, and social sparks in the room**. If a game fails at that, it does not matter if its physics engine compiles cleanly or its canvas loop runs at 60 FPS. If two friends on a couch play a minigame and one of them checks their phone, yawns, or asks *'Wait, what was I even supposed to do there?'*, that game has failed catastrophically.\n")
    lines.append("Great local party games live on high-stakes physical comedy, readable risk-reward decisions, clutch comebacks, and the visceral joy of sabotaging your friend at the exact last second. Weak minigames, by contrast, suffer from one of six cardinal game design sins:\n")
    
    lines.append("1. **The 'Senseless Gimmick' Sin (Ludonarrative Dissonance):** The game assigns an arbitrary skin to a bizarre, unintuitive mechanic. When players are asked to pop popcorn with a laser cannon, fling raw dough at a floating mirror, or balance a walrus on an oil barrel using binary button clicks, their brains reject the premise. If the rules don't make immediate physical sense, the player feels alienated rather than engaged.")
    lines.append("2. **The 'Parallel Solitaire' Sin (Zero Interaction):** The game places two or four players in separate lanes or corners where they cannot bump, steal, block, draft, or interfere with one another. This is not multiplayer; it is simultaneous single-player. It completely wastes the social energy of being in the same room.")
    lines.append("3. **The 'Turret-Spin Purgatory' Sin:** The designer implements a single-button control scheme by making the avatar rotate constantly in a circle at 90 degrees per second. The player spends 80% of their play session waiting passively for the needle to sweep around to the desired vector. It feels like playing a game with 1,000ms of input latency.")
    lines.append("4. **The 'Carpal Tunnel Mashing' Sin:** The minigame boils down to whoever can vibrate their index finger on the Spacebar the fastest. There is zero tactical nuance, zero mind games, zero bluffing, and it leaves the player with a strained tendon rather than a memorable memory.")
    lines.append("5. **The 'Runaway Leader / Dead Time' Sin:** An early mistake at second 3 puts Player 1 so far behind that the remaining 27 seconds of the match are a mathematically hopeless march to an inevitable loss. There is no comeback mechanic, no sudden-death tension, and no drama.")
    lines.append("6. **The 'Bipolar Bot' Sin:** When a human plays solo against the CPU, the bot oscillates between an omniscient 0ms aimbot that calculates trigonometric intercept vectors instantaneously, or a lobotomized potato that drives directly into an explosive barrel and sits there.")
    lines.append("\n---\n")

    # The Holy Trinity: The Golden Benchmark
    lines.append("## 2. The Golden Benchmark: The Sacred Trinity of Masterclasses\n")
    lines.append("Before critiquing the catalog, we must define what perfection looks like in this engine. Three minigames in this collection demonstrate exceptional mastery of arcade psychology, kinetic tactility, and multiplayer drama. **These three games represent the gold standard and MUST NOT BE CHANGED or diluted.**\n")
    
    lines.append("### 🏆 1. Skyline Sumo (`skyline_sumo`) - The Vertical Leap Masterpiece")
    lines.append("- **Why It Works:** It combines vertical king-of-the-hill platforming with push-your-luck physics. The oscillating aim needle and hold-to-charge jump spring force the player to commit to their leap. Every jump is a leap of faith where you can land on a springy platform, bounce off a neon billboard, or dropkick an opponent off their perch.")
    lines.append("- **The Social Sparks:** The Lakitu-style cloud rescue mechanic is pure comedy—it prevents instant elimination frustration while creating hilarious scramble races when players fall and scramble back up. The dynamic vertical camera zooming and rooftop trophy finish create genuine photo-finish climaxes.")
    lines.append("- **Directive for Agents:** **DO NOT REWORK CORE SYSTEMS.** Leave the jump physics, aim oscillation, spring bounce, and vertical camera completely intact. Only subtle visual polish (e.g. enhanced wind streaks or landing dust) is permissible.\n")

    lines.append("### 🏆 2. Sumo Iceberg (`sumo_iceberg`) - The Physical Comedy Masterpiece")
    lines.append("- **Why It Works:** Pure, unadulterated Newtonian slapstick. Players control rounded sumo discs on a slippery, tilting circular ice floe surrounded by freezing arctic waters. The platform physically tilts based on where player masses congregate, creating emergent dynamic hazards without requiring artificial scripts.")
    lines.append("- **The Social Sparks:** Dash charges require total commitment—if you dash at your rival and they bait you and side-step, your own momentum carries you sliding helplessly off the edge into the sea. The shrinking platform timer ramps up panic organically. Bumping into rivals produces crisp, punchy carambole physics.")
    lines.append("- **Directive for Agents:** **DO NOT REWORK CORE SYSTEMS.** The tilt inertia, dash cooldowns, surface friction, and edge-fall detection are perfectly calibrated. Preserve this code as a holy relic of game feel.\n")

    lines.append("### 🏆 3. Gold Miner (`gold_miner`) - The Greedy Timing & Sabotage Masterpiece")
    lines.append("- **Why It Works:** It takes an all-time arcade classic and transforms it into a ruthless simultaneous four-player race. The oscillating winch claw requires split-second spatial projection. Players must weigh the risk of high-value heavy gold nuggets (slow reel speed) against lightweight diamonds (rapid payout) versus useless heavy boulders.")
    lines.append("- **The Social Sparks:** The sheer hilarity of aiming for a 500-point diamond only to have a rival's claw snatch it 20 milliseconds before yours, leaving your claw to grab a 10-point heavy skull that takes 6 seconds to reel in. The TNT explosive barrels allow strategic sabotage—if an opponent is about to snatch a massive nugget, you can detonate an adjacent dynamite barrel to vaporize it out from under them.")
    lines.append("- **Directive for Agents:** **DO NOT REWORK CORE SYSTEMS.** The swing cadence, reel speed coefficients, cavern item placement, and claw collision radii are masterfully balanced. Do not alter the core loop.\n")
    lines.append("---\n")

    # Detailed 260 Minigame Critiques
    lines.append("## 3. Exhaustive Individual Critiques & Definitive Resolutions (#1 to #260)\n")
    lines.append("Every game below is evaluated from multiple perspectives: **Player Fun & Psychology**, **Control Feel & Juice**, **Multiplayer Interaction & Griefing**, **Visual/Audio Readability**, **Bot Calibration**, and **The Benchmark Comparison**. Each entry concludes with the **Definitive Design Resolution** that provides the exact architectural fix to resolve all design deficiencies.\n")

    print("Generating critiques for all 260 games...")
    
    with open('scripts/all_critiques_data.py', 'w', encoding='utf8') as f_data:
        f_data.write("# Data container for custom game evaluations\n")
    
    # We will generate comprehensive entries for all 260 games
    return lines, games, mapping

if __name__ == '__main__':
    main()
