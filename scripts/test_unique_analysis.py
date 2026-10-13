import json, re

with open('all_catalog_games.json', encoding='utf-8') as f:
    games = json.load(f)
with open('game_class_mapping.json', encoding='utf-8') as f:
    mapping = json.load(f)

# Let's inspect 10 games from different places in the catalog
test_indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 39, 50, 100, 150, 200, 250]
for idx in test_indices:
    g = games[idx]
    cls = mapping[g['id']]
    with open(f'src/games/{cls}.ts', encoding='utf-8') as f:
        code = f.read()
    fields = re.findall(r'private\s+([a-zA-Z0-9_]+)\s*:', code)
    print(f"#{idx+1} [{g['id']}] {g['title']}: {g['tagline']}")
    print(f"   Fields: {fields[:4]}")
