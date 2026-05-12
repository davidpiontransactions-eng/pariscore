"""
PariScore Sofascore microservice — Phase 0 prototype
Exposes 4 endpoints consumed by Node server.js via HTTP fetch on 127.0.0.1.

Run: python scripts/sofa-microservice.py
Default port: 8765 (set SOFA_PORT env to override)

Stack
- soccerdata (tls_requests plain HTTP, anti-Cloudflare via TLS fingerprint)
- ScraperFC (botasaurus, momentum + shotmap with xG/xGoT per shot)
- sofascore-wrapper (Playwright fallback for K-League/exotic leagues)

Routes
- GET /live                          → list live football events (light, no stats)
- GET /match/<id>/stats              → possession, shots, SOT, corners, xG (raw Sofa /event/{id}/statistics)
- GET /match/<id>/momentum           → momentum DataFrame (1 point per minute, ~92 pts/match)
- GET /match/<id>/shotmap            → per-shot xG/xGoT/coords/situation
- GET /match/<id>/incidents          → goals, cards, subs, VAR
- GET /health                        → status providers

Strategy
- /live + /match/<id>/stats use ScraperFC (botasaurus) when available, fallback sofascore-wrapper
- /momentum + /shotmap use ScraperFC scrape_match_momentum/scrape_match_shots
- /incidents uses sofascore-wrapper Match.incidents()
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

PORT = int(os.environ.get("SOFA_PORT", os.environ.get("PORT", 8765)))
BIND_HOST = os.environ.get("SOFA_BIND", "127.0.0.1")  # Set "0.0.0.0" in Render for internal service

# Lazy imports — fail soft per provider
try:
    import ScraperFC as sfc
    sfc_sofa = sfc.Sofascore()
    HAVE_SCRAPERFC = True
except Exception as e:
    sys.stderr.write(f"[boot] ScraperFC unavailable: {e}\n")
    HAVE_SCRAPERFC = False

try:
    from sofascore_wrapper.api import SofascoreAPI
    from sofascore_wrapper.match import Match
    HAVE_WRAPPER = True
except Exception as e:
    sys.stderr.write(f"[boot] sofascore-wrapper unavailable: {e}\n")
    HAVE_WRAPPER = False


# Simple in-memory cache (matchId → {ts, data}) — 30s TTL for live, 5min for terminated
_cache = {}
_CACHE_TTL_LIVE = 30
_CACHE_TTL_DONE = 300


def _cache_get(key: str, ttl: int):
    e = _cache.get(key)
    if e and time.time() - e["ts"] < ttl:
        return e["data"]
    return None


def _cache_set(key: str, data):
    _cache[key] = {"ts": time.time(), "data": data}


def _json_response(handler: BaseHTTPRequestHandler, code: int, payload):
    body = json.dumps(payload, default=str).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


def _df_to_records(df):
    if df is None:
        return []
    try:
        return df.to_dict(orient="records")
    except Exception:
        return []


async def _wrapper_live_games():
    api = SofascoreAPI()
    try:
        m = Match(api)
        return await m.live_games()
    finally:
        await api.close()


async def _wrapper_games_by_date(date: str):
    api = SofascoreAPI()
    try:
        m = Match(api)
        return await m.games_by_date(sport="football", date=date)
    finally:
        await api.close()


async def _wrapper_match_stats(match_id: int):
    api = SofascoreAPI()
    try:
        md = Match(api, match_id=match_id)
        return await md.stats()
    finally:
        await api.close()


async def _wrapper_match_incidents(match_id: int):
    api = SofascoreAPI()
    try:
        md = Match(api, match_id=match_id)
        return await md.incidents()
    finally:
        await api.close()


def run_async(coro):
    return asyncio.run(coro)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {self.address_string()} - {fmt % args}\n")

    def do_GET(self):
        u = urlparse(self.path)
        path = u.path.rstrip("/") or "/"
        from urllib.parse import parse_qs
        qs = parse_qs(u.query)
        try:
            if path == "/health":
                _json_response(self, 200, {
                    "ok": True,
                    "providers": {
                        "scraperfc": HAVE_SCRAPERFC,
                        "sofascore_wrapper": HAVE_WRAPPER,
                    },
                    "cache_size": len(_cache),
                })
                return

            if path == "/find-match":
                # GET /find-match?home=Gangwon&away=Daejeon&date=2026-05-12 → returns Sofascore event id
                home = (qs.get("home") or [""])[0].lower()
                away = (qs.get("away") or [""])[0].lower()
                date = (qs.get("date") or [""])[0]
                if not home or not away:
                    return _json_response(self, 400, {"error": "missing home/away param"})
                key = f"find:{home}:{away}:{date}"
                cached = _cache_get(key, _CACHE_TTL_LIVE)
                if cached:
                    return _json_response(self, 200, cached)
                if not HAVE_WRAPPER:
                    return _json_response(self, 503, {"error": "wrapper unavailable"})
                if date:
                    raw = run_async(_wrapper_games_by_date(date))
                else:
                    raw = run_async(_wrapper_live_games())
                events = raw.get("events", []) if isinstance(raw, dict) else []
                def norm(s):
                    return "".join(c for c in (s or "").lower() if c.isalnum())
                hn, an = norm(home), norm(away)
                found = None
                for e in events:
                    eh = norm(e.get("homeTeam", {}).get("name"))
                    ea = norm(e.get("awayTeam", {}).get("name"))
                    # match if home/away substring matches
                    if (hn in eh or eh in hn) and (an in ea or ea in an):
                        found = e
                        break
                payload = {
                    "matched": bool(found),
                    "sofa_event_id": found.get("id") if found else None,
                    "sofa_home": found.get("homeTeam", {}).get("name") if found else None,
                    "sofa_away": found.get("awayTeam", {}).get("name") if found else None,
                    "sofa_league": found.get("tournament", {}).get("name") if found else None,
                    "query": {"home": home, "away": away, "date": date},
                    "candidates_searched": len(events),
                }
                _cache_set(key, payload)
                return _json_response(self, 200, payload)

            if path == "/live":
                cached = _cache_get("live", _CACHE_TTL_LIVE)
                if cached:
                    return _json_response(self, 200, cached)
                if HAVE_WRAPPER:
                    data = run_async(_wrapper_live_games())
                    events = data.get("events", []) if isinstance(data, dict) else []
                    light = [{
                        "id": e.get("id"),
                        "home": e.get("homeTeam", {}).get("name"),
                        "away": e.get("awayTeam", {}).get("name"),
                        "league": e.get("tournament", {}).get("name"),
                        "minute": (e.get("time") or {}).get("played"),
                        "status": (e.get("status") or {}).get("description"),
                        "score": {
                            "home": (e.get("homeScore") or {}).get("current"),
                            "away": (e.get("awayScore") or {}).get("current"),
                        },
                    } for e in events]
                    payload = {"count": len(light), "events": light, "source": "sofascore-wrapper"}
                    _cache_set("live", payload)
                    return _json_response(self, 200, payload)
                return _json_response(self, 503, {"error": "no provider available"})

            # /match/<id>/<sub>
            if path.startswith("/match/"):
                parts = path.split("/")
                if len(parts) >= 4:
                    try:
                        mid = int(parts[2])
                    except ValueError:
                        return _json_response(self, 400, {"error": "match_id must be int"})
                    sub = parts[3]
                    key = f"{mid}:{sub}"
                    cached = _cache_get(key, _CACHE_TTL_LIVE)
                    if cached:
                        return _json_response(self, 200, cached)

                    if sub == "stats":
                        if HAVE_WRAPPER:
                            data = run_async(_wrapper_match_stats(mid))
                            _cache_set(key, data)
                            return _json_response(self, 200, data)
                        return _json_response(self, 503, {"error": "wrapper unavailable"})

                    if sub == "incidents":
                        if HAVE_WRAPPER:
                            data = run_async(_wrapper_match_incidents(mid))
                            _cache_set(key, data)
                            return _json_response(self, 200, data)
                        return _json_response(self, 503, {"error": "wrapper unavailable"})

                    if sub == "momentum":
                        if HAVE_SCRAPERFC:
                            url = sfc_sofa.get_match_url_from_id(mid)
                            df = sfc_sofa.scrape_match_momentum(url)
                            payload = {"match_id": mid, "url": url, "points": _df_to_records(df)}
                            _cache_set(key, payload)
                            return _json_response(self, 200, payload)
                        return _json_response(self, 503, {"error": "ScraperFC unavailable"})

                    if sub == "shotmap":
                        if HAVE_SCRAPERFC:
                            url = sfc_sofa.get_match_url_from_id(mid)
                            df = sfc_sofa.scrape_match_shots(url)
                            payload = {"match_id": mid, "url": url, "shots": _df_to_records(df)}
                            _cache_set(key, payload)
                            return _json_response(self, 200, payload)
                        return _json_response(self, 503, {"error": "ScraperFC unavailable"})

                    return _json_response(self, 404, {"error": f"unknown sub-route {sub}"})

            return _json_response(self, 404, {"error": "route not found", "path": path})
        except Exception as e:
            sys.stderr.write(traceback.format_exc())
            return _json_response(self, 500, {"error": str(e)[:300]})


def main():
    server = ThreadingHTTPServer((BIND_HOST, PORT), Handler)
    print(f"[sofa-microservice] listening on http://{BIND_HOST}:{PORT}")
    print(f"  providers : ScraperFC={HAVE_SCRAPERFC} sofascore-wrapper={HAVE_WRAPPER}")
    print(f"  routes    : /health /live /match/<id>/{{stats,incidents,momentum,shotmap}}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[sofa-microservice] shutdown")
        server.shutdown()


if __name__ == "__main__":
    main()
