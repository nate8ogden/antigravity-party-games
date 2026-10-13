import json
import os
import re

def load_catalog():
    with open('all_catalog_games.json', encoding='utf-8') as f:
        games = json.load(f)
    with open('game_class_mapping.json', encoding='utf-8') as f:
        mapping = json.load(f)
    return games, mapping

def analyze_ts_file(cls_name):
    filepath = f'src/games/{cls_name}.ts'
    if not os.path.exists(filepath):
        return {
            'line_count': 0, 'fields': [], 'methods': [], 'has_wasd': False,
            'has_hold': False, 'has_player_collision': False, 'has_bot': False
        }
    with open(filepath, encoding='utf-8') as f:
        code = f.read()

    lines = code.split('\n')
    line_count = len(lines)
    
    fields = re.findall(r'private\s+([a-zA-Z0-9_]+)\s*:', code)
    methods = re.findall(r'(?:public|private)\s+([a-zA-Z0-9_]+)\s*\(', code)
    
    has_wasd = bool(re.search(r'steer|throttle|ArrowUp|KeyW|ArrowDown', code))
    has_hold = bool(re.search(r'isHolding|holdDuration|charge|chargeTimer|chargePower', code, re.IGNORECASE))
    has_player_collision = bool(re.search(r'hypot\([^)]*other|distanceTo|collid.*player|bounce.*player|tackle|dist\s*<\s*p1\.radius', code, re.IGNORECASE))
    has_bot = bool(re.search(r'bot|ai|cpu', code, re.IGNORECASE))
    has_timer = bool(re.search(r'roundTimer|timeRemaining|countdown|duration', code))
    has_rotation = bool(re.search(r'angle\s*\+=|omega|angularVelocity|rotationSpeed', code))

    return {
        'line_count': line_count,
        'fields': fields,
        'methods': methods,
        'has_wasd': has_wasd,
        'has_hold': has_hold,
        'has_player_collision': has_player_collision,
        'has_bot': has_bot,
        'has_timer': has_timer,
        'has_rotation': has_rotation,
        'code_sample': code[:800]
    }

print("Extractor ready.")
