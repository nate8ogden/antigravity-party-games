import json

with open('all_catalog_games.json', encoding='utf-8') as f:
    games = json.load(f)

print("Sample of games 121 to 160:")
for i in range(120, 160):
    g = games[i]
    print(f"#{i+1} [{g['id']}] {g['title']} ({g['category']}): {g['tagline']}")

print("\nSample of games 161 to 200:")
for i in range(160, 200):
    g = games[i]
    print(f"#{i+1} [{g['id']}] {g['title']} ({g['category']}): {g['tagline']}")

print("\nSample of games 201 to 260:")
for i in range(200, 260):
    g = games[i]
    print(f"#{i+1} [{g['id']}] {g['title']} ({g['category']}): {g['tagline']}")
