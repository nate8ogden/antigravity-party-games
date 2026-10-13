import json

with open('detected_bugs.json') as f:
    bugs = json.load(f)

for b in bugs['array_splice']:
    print(f"{b['file']}:{b['line']} -> {b['code']}")
