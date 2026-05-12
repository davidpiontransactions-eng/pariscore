"""Smoke test soccerdata + ScraperFC — verify plain HTTP Sofascore access."""
import soccerdata as sd
import ScraperFC as sfc

print("=== soccerdata Sofascore ===")
try:
    sofa = sd.Sofascore(leagues="ENG-Premier League", seasons="2024-2025")
    print("instance OK:", sofa)
    sched = sofa.read_schedule()
    print(f"schedule rows: {len(sched)} | columns: {list(sched.columns)[:10]}")
    print(sched.head(3).to_string()[:500])
except Exception as e:
    print(f"ERR: {type(e).__name__}: {e}")

print("\n=== ScraperFC Sofascore ===")
try:
    s = sfc.Sofascore()
    seasons = s.get_valid_seasons("EPL")
    print(f"valid EPL seasons: {list(seasons)[:5]}")
    # Test momentum for a known finished match
    last_match_url = s.get_match_url_from_id(13591611)  # any past EPL match id
    print(f"match URL: {last_match_url}")
    try:
        momentum = s.scrape_match_momentum(last_match_url)
        print(f"momentum points: {len(momentum) if hasattr(momentum,'__len__') else 'N/A'}")
    except Exception as ex:
        print(f"momentum err: {type(ex).__name__}: {str(ex)[:120]}")
    try:
        shots = s.scrape_match_shots(last_match_url)
        print(f"shots: {len(shots) if hasattr(shots,'__len__') else 'N/A'}")
    except Exception as ex:
        print(f"shots err: {type(ex).__name__}: {str(ex)[:120]}")
except Exception as e:
    print(f"ERR: {type(e).__name__}: {e}")
