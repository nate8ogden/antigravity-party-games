import subprocess
import json

games_to_check = [
    'BriefcaseSnatchGame.ts',
    'SecurityCameraGame.ts',
    'VaultSafeGame.ts',
    'LaserTripwireGame.ts',
    'WesternPokerGame.ts',
    'RattlesnakeReflexGame.ts',
    'BanditChaseGame.ts',
    'CactusSlalomGame.ts',
    'DynamiteTumbleGame.ts'
]

for g in games_to_check:
    print(f"=================== {g} ===================")
    # Get commit messages touching this file
    log = subprocess.check_output(['git', 'log', '-n', '2', '--oneline', f'src/games/{g}'], text=True).strip()
    print(f"Recent commits:\n{log}")
    
    # Read the file and inspect key methods, controls, mechanics
    with open(f'src/games/{g}', 'r', encoding='utf-8') as f:
        code = f.read()
    
    lines = len(code.split('\n'))
    print(f"Total lines: {lines}")
    
    # Check for new features like hit-stop, particle explosions, collision, bot AI
    has_hitstop = 'hitStop' in code or 'freezeFrame' in code or 'freezeTimer' in code
    has_shake = 'screenShake' in code or 'shake' in code or 'shakeTimer' in code
    has_collision = 'tackle' in code or 'shove' in code or 'bump' in code
    has_destroy = 'destroy(' in code
    print(f"Features: hitstop={has_hitstop}, shake={has_shake}, collision={has_collision}, destroy={has_destroy}")
