import subprocess

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

for f in files:
    print(f"=== DIFF SUMMARY FOR {f} ===")
    commit = subprocess.check_output(['git', 'log', '-n', '1', '--format=%H', f'src/games/{f}'], text=True).strip()
    stat = subprocess.check_output(['git', 'show', '--stat', commit, '--', f'src/games/{f}'], text=True).strip()
    print(stat.split('\n')[0], stat.split('\n')[-1])
    
    diff = subprocess.check_output(['git', 'show', commit, '--', f'src/games/{f}'], text=True)
    added_lines = [l for l in diff.split('\n') if l.startswith('+') and not l.startswith('+++')]
    
    # check new mechanics
    keywords = ['controls', 'tackle', 'shove', 'dash', 'powerup', 'bomb', 'shake', 'hitstop', 'parry', 'boost', 'ai', 'steer']
    found = {}
    for k in keywords:
        count = sum(1 for l in added_lines if k in l.lower())
        if count > 0:
            found[k] = count
    print("New mechanics added:", found)
    print()
