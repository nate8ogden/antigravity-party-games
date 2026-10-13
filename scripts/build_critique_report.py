import json
import os
import re

def analyze_game_code(cls_name, code):
    lines = code.split('\n')
    line_count = len(lines)
    
    # Input analysis
    has_wasd = bool(re.search(r'steer|throttle|ArrowUp|KeyW', code))
    has_press = 'isPressed' in code or 'press(' in code
    has_hold = bool(re.search(r'isHolding|holdDuration|charge|chargeTimer', code, re.IGNORECASE))
    has_mouse = 'mouse' in code.lower() or 'pointer' in code.lower()
    
    # Physics analysis
    has_gravity = bool(re.search(r'gravity|vy\s*\+=', code))
    has_friction = bool(re.search(r'friction|vx\s*\*=|vy\s*\*=', code))
    has_rotation = bool(re.search(r'angle\s*\+=|omega|angularVelocity', code))
    
    # Interaction analysis
    has_player_collision = bool(re.search(r'hypot\([^)]*other|distanceTo|collid.*player|bounce.*player|tackle', code, re.IGNORECASE))
    has_projectiles = bool(re.search(r'bullet|missile|projectile|cannonball|laser', code, re.IGNORECASE))
    has_collectibles = bool(re.search(r'coin|gem|star|battery|powerup|item', code, re.IGNORECASE))
    has_hazards = bool(re.search(r'hazard|obstacle|mine|lava|spikes|anvil', code, re.IGNORECASE))
    
    # Bot analysis
    has_bot = bool(re.search(r'bot|ai|cpu', code, re.IGNORECASE))
    bot_frame_random = bool(re.search(r'Math\.random\(\)\s*<', code))
    
    # Win condition / Scoring
    has_timer = bool(re.search(r'roundTimer|timeRemaining|duration', code))
    has_score_target = bool(re.search(r'targetScore|maxScore|score\s*>=', code))
    has_elimination = bool(re.search(r'eliminated|alive\s*=\s*false|lives', code, re.IGNORECASE))
    
    return {
        'line_count': line_count,
        'has_wasd': has_wasd,
        'has_press': has_press,
        'has_hold': has_hold,
        'has_mouse': has_mouse,
        'has_gravity': has_gravity,
        'has_friction': has_friction,
        'has_rotation': has_rotation,
        'has_player_collision': has_player_collision,
        'has_projectiles': has_projectiles,
        'has_collectibles': has_collectibles,
        'has_hazards': has_hazards,
        'has_bot': has_bot,
        'bot_frame_random': bot_frame_random,
        'has_timer': has_timer,
        'has_score_target': has_score_target,
        'has_elimination': has_elimination,
    }

print("Code analyzer defined successfully.")
