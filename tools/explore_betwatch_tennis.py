"""Quick test: hit betwatch.fr tennis API to see exact response format."""
import json
from scrapling import Fetcher

url = "https://betwatch.fr/tennis/getMoney?live_only=false&prematch_only=false&date=2026-07-31&utc=2&step=1"
print(f"Fetching: {url}")

try:
    resp = Fetcher().get(url)
    data = resp.json()
    print(f"Status: {resp.status}")
    print(f"Total matches: {len(data.get('data', []))}")
    
    # Show first match with money data
    for m in data.get('data', [])[:5]:
        has_money = m.get('i') and any(row[1] is not None for row in m.get('i', []))
        print(f"  {m.get('htn','?')} vs {m.get('atn','?')} | totalMatched={m.get('v')} | money={'YES' if has_money else 'NULL'} | i={m.get('i')}")
    
    # Save sample
    with open("data/scrapling-tests/tennis_api_sample.json", "w") as f:
        json.dump({"url": url, "sample": data.get('data', [])[:3]}, f, indent=2)
    print("Saved sample to data/scrapling-tests/tennis_api_sample.json")
    
except Exception as e:
    print(f"Error: {e}")
