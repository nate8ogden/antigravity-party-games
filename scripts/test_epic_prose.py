import json

with open('all_catalog_games.json', encoding='utf-8') as f:
    games = json.load(f)

# Sample test for a few crazy ones
test_samples = ['dung_beetle_roll', 'ouija_spirit_board', 'cursed_clocktower_pendulum', 'power_path_clash', 'spam_click_showdown']
for gid in test_samples:
    g = next(x for x in games if x['id'] == gid)
    print(f"[{g['id']}] {g['title']}")
    print(f"  Concept: {g['instructions']}")
    print(f"  Controls: {g['controlPrompt']}")
