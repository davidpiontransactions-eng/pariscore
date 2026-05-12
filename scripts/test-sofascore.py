"""Smoke test sofascore-wrapper — verify Playwright bypass Cloudflare 403."""
import asyncio
import json
from sofascore_wrapper.api import SofascoreAPI


async def main():
    api = SofascoreAPI()
    try:
        # Test 1: search a known player (Bukayo Saka)
        from sofascore_wrapper.search import Search
        s = Search(api, search_string="saka")
        result = await s.search_all()
        print("=== search 'saka' ===")
        first = (result.get("results") or [])[:1]
        print(json.dumps(first, indent=2)[:400])

        # Test 2: live events
        from sofascore_wrapper.match import Match
        m = Match(api)
        live = await m.live_games()
        events = live.get('events', []) if isinstance(live, dict) else []
        print("\n=== live football events ===")
        print(f"total: {len(events)}")
        for e in events[:8]:
            print(f"  id={e.get('id')} | {e.get('homeTeam',{}).get('name')} vs {e.get('awayTeam',{}).get('name')} | "
                  f"tournament={e.get('tournament',{}).get('name')} | min={e.get('time',{}).get('played') or e.get('status',{}).get('description')}")

        # Test 3: iterate live events until one returns stats (filters U16/U18/U20/Reserves)
        for cand in events:
            tn = cand.get('tournament',{}).get('name','') or ''
            if any(x in tn for x in ['U16','U18','U20','Reserve','Reserves','Youth','Friendly']): continue
            eid = cand['id']
            try:
                md = Match(api, match_id=eid)
                stats = await md.stats()
                print(f"\n=== drill match id={eid} ({cand.get('homeTeam',{}).get('name')} vs {cand.get('awayTeam',{}).get('name')} | {tn}) ===")
                if stats.get('statistics'):
                    all_p = next((p for p in stats['statistics'] if p.get('period')=='ALL'), None)
                    if all_p:
                        items = []
                        for g in all_p.get('groups',[]):
                            for it in g.get('statisticsItems',[]):
                                items.append(f"{it.get('name')}={it.get('home')}/{it.get('away')}")
                        print(f"  stats {len(items)} items, sample: {items[:10]}")
                inc = await md.incidents()
                print(f"  incidents: {len((inc or {}).get('incidents',[]))}")
                shotmap = await md.shotmap()
                print(f"  shotmap shots: {len((shotmap or {}).get('shotmap',[]))}")
                break
            except Exception as ex:
                continue
        else:
            print("\nNo live match with available stats found.")
    finally:
        await api.close()


if __name__ == "__main__":
    asyncio.run(main())
