"""Analyze API response for PowerScore data."""
import json
import subprocess

# Get API response
result = subprocess.run(
    ["curl", "-s", "http://localhost:3000/api/v1/tennis/top10"],
    capture_output=True,
    text=True
)

data = json.loads(result.stdout)
print(f"Total matches: {len(data['top10'])}")
print("\nMatches with powerscore data:")
for m in data['top10']:
    ps1 = m.get('powerscore_p1')
    ps2 = m.get('powerscore_p2')
    if ps1 is not None or ps2 is not None:
        print(f"  [OK] {m['player1']} vs {m['player2']}: p1={ps1}, p2={ps2}")
    else:
        print(f"  [NO] {m['player1']} vs {m['player2']}: p1=null, p2=null")

print("\n--- Summary ---")
matches_with_ps = [m for m in data['top10'] if m.get('powerscore_p1') is not None]
print(f"Matches with powerscore: {len(matches_with_ps)}/{len(data['top10'])}")
