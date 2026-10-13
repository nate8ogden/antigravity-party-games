import re

files = [
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

for filename in files:
    filepath = f'src/games/{filename}'
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    print(f"=== {filename} ===")
    # Extract tackle / hitstop / controls logic
    tackle_matches = re.findall(r'(?:tackle|shove|bump|hitStop|dash)[^;{]+[;{]', code, re.IGNORECASE)
    print("Sample new mechanic calls:", tackle_matches[:4])
    
    # Check bot logic
    bot_matches = re.findall(r'bot[^;{]+[;{]', code, re.IGNORECASE)
    print("Bot references count:", len(bot_matches))
    
    # Check round timer / win conditions
    win_matches = re.findall(r'(?:winner|win|score\s*>=|roundTimer)[^;{]+[;{]', code, re.IGNORECASE)
    print("Win condition logic:", win_matches[:3])
    print()
