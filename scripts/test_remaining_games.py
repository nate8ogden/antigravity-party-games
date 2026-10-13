import json

with open('all_catalog_games.json', encoding='utf-8') as f:
    games = json.load(f)

print(f"Total games in catalog: {len(games)}")
print("Sample of games 80 to 120:")
for i in range(80, 120):
    g = games[i]
    print(f"#{i+1} [{g['id']}] {g['title']} ({g['category']}): {g['tagline']}")
