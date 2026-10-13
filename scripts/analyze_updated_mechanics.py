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
    with open(f'src/games/{filename}', 'r', encoding='utf-8') as f:
        code = f.read()
    
    print(f"==================== {filename} ====================")
    # Check update method
    update_block = re.search(r'public\s+update\s*\([^)]*\)\s*:[^{]*\{([\s\S]*?)(?:public\s+render|public\s+destroy)', code)
    if update_block:
        up_text = update_block.group(1)
        # find tackle / collision logic
        tackle_logics = [line.strip() for line in up_text.split('\n') if any(w in line.lower() for w in ['tackle', 'shove', 'bump', 'steal', 'snatch', 'hitstop'])]
        print(f"Tackle/HitStop logic in update ({len(tackle_logics)} lines):")
        for l in tackle_logics[:5]:
            print("  *", l)
    
    # Check controls prompt & instructions in comments or constants
    m = re.search(r'class\s+([A-Za-z0-9_]+)\s+extends', code)
    cls_name = m.group(1) if m else "Unknown"
    print(f"Class: {cls_name}")
    print()
