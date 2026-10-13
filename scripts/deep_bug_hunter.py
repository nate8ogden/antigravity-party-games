import os
import re

files = [f for f in os.listdir('src/games') if f.endswith('.ts') and f != 'BaseGame.ts']
print(f"Scanning {len(files)} game files for common bugs...")

bugs = []

for filename in files:
    filepath = os.path.join('src/games', filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')

    # Bug 1: Array splice forward loop index bug
    # Pattern: for (let i = 0; i < something.length; i++) ... something.splice(i, 1) without i--
    for idx, line in enumerate(lines):
        if '.splice(' in line:
            # check previous 10 lines for for-loop
            context = "\n".join(lines[max(0, idx-10):idx+5])
            if re.search(r'for\s*\(\s*let\s+([a-zA-Z0-9_]+)\s*=\s*0;\s*\1\s*<\s*[^;]+;\s*\1\+\+\s*\)', context):
                var_match = re.search(r'for\s*\(\s*let\s+([a-zA-Z0-9_]+)\s*=\s*0', context)
                if var_match:
                    loop_var = var_match.group(1)
                    # Check if loop_var-- is in the block
                    after_context = "\n".join(lines[idx:idx+4])
                    if f"{loop_var}--" not in after_context:
                        bugs.append({
                            'file': filename,
                            'line': idx + 1,
                            'type': 'Array Splice Index Shift (Missed Element)',
                            'code': line.strip()
                        })

    # Bug 2: Division by distance without check
    # Pattern: / dist or / Math.sqrt(...) or / hypot
    for idx, line in enumerate(lines):
        if re.search(r'/\s*(dist|distance|d|len|length|mag|magnitude)\b', line):
            # check if guarded by if (dist > 0) or dist > 0.001
            context = "\n".join(lines[max(0, idx-4):idx+1])
            if not re.search(r'(>|!==|!=)\s*0', context) and 'Math.max(' not in line:
                # check if dist could be 0
                bugs.append({
                    'file': filename,
                    'line': idx + 1,
                    'type': 'Potential Division by Zero (NaN Physics)',
                    'code': line.strip()
                })

    # Bug 3: Missing destroy() implementation or missing cleanup
    if 'destroy(' not in content:
        bugs.append({
            'file': filename,
            'line': 1,
            'type': 'Missing destroy() Override',
            'code': 'No destroy method in class'
        })
    else:
        # Check if setupListeners exists without removeEventListener in destroy
        if 'addEventListener' in content and 'removeEventListener' not in content:
            bugs.append({
                'file': filename,
                'line': 1,
                'type': 'DOM Event Listener Leak in destroy()',
                'code': 'addEventListener called without removeEventListener'
            })

    # Bug 4: Memory leak - Unbounded array growth
    # Arrays that push entities in update() or spawn() without maximum length or offscreen culling
    for field_match in re.finditer(r'private\s+([a-zA-Z0-9_]+)\s*:\s*([^;=]+)\[\]\s*=\s*\[\];', content):
        arr_name = field_match.group(1)
        if arr_name in ['players', 'runners', 'climbers', 'duelists', 'chefs', 'cars', 'tanks', 'paddles']:
            continue
        # check if .push( is called on this array, but no .splice, .filter, .length =, or .shift
        if f'{arr_name}.push(' in content:
            if f'{arr_name}.splice(' not in content and f'{arr_name}.filter(' not in content and f'{arr_name}.length =' not in content and f'{arr_name} = []' not in content and f'{arr_name}.shift(' not in content:
                bugs.append({
                    'file': filename,
                    'line': 1,
                    'type': f'Unbounded Array Memory Leak (`{arr_name}` never culled)',
                    'code': f'{arr_name}.push() without splice/filter/reset'
                })

print(f"Total potential bugs detected: {len(bugs)}")
for b in bugs[:20]:
    print(f"[{b['type']}] {b['file']}:{b['line']} -> {b['code']}")
