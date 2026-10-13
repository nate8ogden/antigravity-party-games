import json, re

with open('all_catalog_games.json', encoding='utf-8') as f:
    games = json.load(f)
with open('game_class_mapping.json', encoding='utf-8') as f:
    mapping = json.load(f)

for g in games[:15]:
    cls = mapping[g['id']]
    with open(f'src/games/{cls}.ts', encoding='utf-8') as cf:
        code = cf.read()
    
    fields = re.findall(r'private\s+([a-zA-Z0-9_]+)\s*:', code)
    methods = re.findall(r'(?:public|private)\s+([a-zA-Z0-9_]+)\s*\(', code)
    
    print(f"[{g['id']}] {g['title']}")
    print(f"   Fields: {', '.join(fields[:6])}")
    print(f"   Key Methods: {', '.join(methods[:4])}")
