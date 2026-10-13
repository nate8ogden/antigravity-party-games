import json

with open('all_catalog_games.json') as f:
    games = json.load(f)

print(f"Total games: {len(games)}")
cat_map = {}
for g in games:
    cat = g['category']
    cat_map[cat] = cat_map.get(cat, 0) + 1

for cat, count in sorted(cat_map.items()):
    print(f"  {cat}: {count}")
