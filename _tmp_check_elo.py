import json
d=json.load(open("/tmp/tn2.json"))
ms=d.get("matches",[])
for m in ms[:5]:
  a,b=m["playerA"],m["playerB"]
  s=m["stats"]
  print(f"{a['name']:25s} elo={a['elo']}  surfElo={a.get('surfaceElo','-')}  prob={m['probA']}%  eloGap={s['eloGap']}")
  print(f"{b['name']:25s} elo={b['elo']}  surfElo={b.get('surfaceElo','-')}  prob={m['probB']}%")
  print()
