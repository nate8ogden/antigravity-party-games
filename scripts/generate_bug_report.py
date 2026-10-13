import os
import re
import json

def find_all_bugs():
    files = [f for f in sorted(os.listdir('src/games')) if f.endswith('.ts') and f != 'BaseGame.ts']
    core_files = [f for f in sorted(os.listdir('src/core')) if f.endswith('.ts')]
    
    bugs_by_category = {
        'nan_division': [],
        'array_splice': [],
        'missing_destroy': [],
        'unbounded_arrays': [],
        'listener_leaks': [],
        'core_engine_bugs': []
    }

    # 1. Scan Game Files
    for filename in files:
        filepath = os.path.join('src/games', filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')

        # Check Division by Zero / NaN
        for idx, line in enumerate(lines):
            # match / (var) where var is dist, distance, d, len, length, mag, magnitude, speed, total
            match = re.search(r'/\s*([a-zA-Z0-9_]+)\b', line)
            if match:
                var_name = match.group(1)
                if var_name in ['dist', 'distance', 'd', 'len', 'length', 'mag', 'magnitude', 'totalDist', 'radiusSum', 'diff']:
                    # check context
                    context = "\n".join(lines[max(0, idx-4):idx+1])
                    if not re.search(r'(>|!==|!=)\s*0', context) and 'Math.max(' not in line and '|| 1' not in line and '|| 0.001' not in line:
                        bugs_by_category['nan_division'].append({
                            'file': filename,
                            'line': idx + 1,
                            'code': line.strip(),
                            'var': var_name,
                            'description': f"Direct division by `{var_name}` without zero check or epsilon guard. If objects overlap or spawn at identical coordinates, `{var_name} == 0`, injecting `NaN` into coordinates and freezing game physics."
                        })

        # Check Array Splice Index Shifts
        for idx, line in enumerate(lines):
            if '.splice(' in line:
                context = "\n".join(lines[max(0, idx-10):idx+5])
                var_match = re.search(r'for\s*\(\s*let\s+([a-zA-Z0-9_]+)\s*=\s*0;\s*\1\s*<\s*[^;]+;\s*\1\+\+\s*\)', context)
                if var_match:
                    loop_var = var_match.group(1)
                    after_context = "\n".join(lines[idx:idx+4])
                    if f"{loop_var}--" not in after_context:
                        arr_match = re.search(r'([a-zA-Z0-9_\.]+)\.splice\(', line)
                        arr_name = arr_match.group(1) if arr_match else "array"
                        bugs_by_category['array_splice'].append({
                            'file': filename,
                            'line': idx + 1,
                            'code': line.strip(),
                            'loop_var': loop_var,
                            'arr': arr_name,
                            'description': f"Forward for-loop (`let {loop_var} = 0; ...; {loop_var}++`) calls `{arr_name}.splice({loop_var}, 1)` without decrementing `{loop_var}--`. The immediately following element is skipped during that frame, resulting in ghost hitboxes and skipped updates."
                        })

        # Check Missing destroy()
        if 'destroy(' not in content:
            bugs_by_category['missing_destroy'].append({
                'file': filename,
                'line': 1,
                'code': f'class {filename.replace(".ts", "")} extends BaseGame',
                'description': f"Class does not override `public destroy(): void`. When switching games in the lobby, active entities, listeners, or timers created by this game remain uncollected."
            })
        else:
            if 'addEventListener' in content and 'removeEventListener' not in content:
                bugs_by_category['listener_leaks'].append({
                    'file': filename,
                    'line': 1,
                    'code': 'addEventListener without removeEventListener',
                    'description': "DOM event listeners attached during game lifecycle are never detached in `destroy()`, causing memory accumulation across game switches."
                })

        # Check Unbounded Array Growth
        for field_match in re.finditer(r'private\s+([a-zA-Z0-9_]+)\s*:\s*([^;=]+)\[\]\s*=\s*\[\];', content):
            arr_name = field_match.group(1)
            if arr_name in ['players', 'runners', 'climbers', 'duelists', 'chefs', 'cars', 'tanks', 'paddles', 'eliminationOrder']:
                continue
            if f'{arr_name}.push(' in content:
                if f'{arr_name}.splice(' not in content and f'{arr_name}.filter(' not in content and f'{arr_name}.length =' not in content and f'{arr_name} = []' not in content and f'{arr_name}.shift(' not in content:
                    bugs_by_category['unbounded_arrays'].append({
                        'file': filename,
                        'line': 1,
                        'code': f'private {arr_name}: ...[] = []',
                        'arr': arr_name,
                        'description': f"Array `{arr_name}` is continuously appended via `.push()` but has no `.splice()`, `.filter()`, `.shift()`, or length cap. In long rounds, this array grows indefinitely, degrading frame rate."
                    })

    # 2. Scan Core Files
    for filename in core_files:
        filepath = os.path.join('src/core', filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
        for idx, line in enumerate(lines):
            if re.search(r'/\s*(dist|distance|d|len|length|mag|magnitude)\b', line):
                context = "\n".join(lines[max(0, idx-4):idx+1])
                if not re.search(r'(>|!==|!=)\s*0', context) and 'Math.max(' not in line and '|| 1' not in line:
                    bugs_by_category['core_engine_bugs'].append({
                        'file': f'src/core/{filename}',
                        'line': idx + 1,
                        'code': line.strip(),
                        'description': "Potential division by zero in core engine subsystem."
                    })

    return bugs_by_category

bugs = find_all_bugs()
print("Scan complete. Bug counts:")
for cat, items in bugs.items():
    print(f"  {cat}: {len(items)}")

with open('detected_bugs.json', 'w', encoding='utf-8') as f:
    json.dump(bugs, f, indent=2)
