import json
import os
import re

def load_data():
    with open('all_catalog_games.json', encoding='utf-8') as f:
        games = json.load(f)
    with open('game_class_mapping.json', encoding='utf-8') as f:
        mapping = json.load(f)
    return games, mapping

def analyze_game_code(cls_name):
    filepath = f'src/games/{cls_name}.ts'
    if not os.path.exists(filepath):
        return None
    with open(filepath, encoding='utf-8') as f:
        code = f.read()

    lines = code.split('\n')
    line_count = len(lines)
    
    has_wasd = bool(re.search(r'steer|throttle|ArrowUp|KeyW|ArrowDown', code))
    has_hold = bool(re.search(r'isHolding|holdDuration|charge|chargeTimer|chargePower', code, re.IGNORECASE))
    has_rotation = bool(re.search(r'angle\s*\+=|omega|angularVelocity|rotationSpeed', code))
    has_player_collision = bool(re.search(r'hypot\([^)]*other|distanceTo|collid.*player|bounce.*player|tackle|dist\s*<\s*p1\.radius', code, re.IGNORECASE))
    has_projectiles = bool(re.search(r'bullet|missile|projectile|cannonball|laser|pellet|arrow', code, re.IGNORECASE))
    has_collectibles = bool(re.search(r'coin|gem|star|battery|powerup|fruit|item', code, re.IGNORECASE))
    has_hazards = bool(re.search(r'hazard|obstacle|mine|lava|spikes|anvil|rock|bomb', code, re.IGNORECASE))
    has_timer = bool(re.search(r'roundTimer|timeRemaining|countdown|duration', code))
    has_bot = bool(re.search(r'bot|ai|cpu', code, re.IGNORECASE))
    
    return {
        'line_count': line_count,
        'has_wasd': has_wasd,
        'has_hold': has_hold,
        'has_rotation': has_rotation,
        'has_player_collision': has_player_collision,
        'has_projectiles': has_projectiles,
        'has_collectibles': has_collectibles,
        'has_hazards': has_hazards,
        'has_timer': has_timer,
        'has_bot': has_bot,
        'code_sample': code[:1200]
    }

print("Loaded generator module.")
