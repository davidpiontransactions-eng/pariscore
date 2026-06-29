"""
Route TennisExplorer — scraping ATP tournaments with match data, odds, and draw info.

Endpoints:
  GET /tennis/tournaments        → List of all ATP tournaments (from homepage)
  GET /tennis/tournaments/{slug} → Full tournament data with matches
  GET /tennis/tournaments/{slug}/draw  → Draw bracket data
"""

from __future__ import annotations

import logging
import re
import time
from typing import Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup, Tag
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("pariscore.tennis")

BASE_URL = "https://www.tennis-explorer.com"

router = APIRouter(prefix="/tennis", tags=["tennis"])


# ── Pydantic models ─────────────────────────────────────────────


class TennisMatchOdds(BaseModel):
    player_a: float | None = None
    player_b: float | None = None


class TennisMatch(BaseModel):
    id: str
    round: str
    player_a_name: str
    player_b_name: str
    player_a_slug: str
    player_b_slug: str
    score: str | None = None
    odds: TennisMatchOdds = Field(default_factory=TennisMatchOdds)
    status: str = "scheduled"  # scheduled | live | completed
    time: str | None = None
    court: str | None = None


class TournamentRound(BaseModel):
    name: str
    matches: list[TennisMatch]


class TournamentResponse(BaseModel):
    id: str
    name: str
    slug: str
    surface: str
    category: str
    year: int
    location: str
    prize_money: str | None = None
    draw_size: int | None = None
    rounds: list[TournamentRound]
    current_round: str
    cached_at: float


class TournamentListItem(BaseModel):
    name: str
    slug: str
    surface: str
    category: str
    draw_size: int | None = None
    match_count: int = 0
    status: str = "upcoming"  # upcoming | ongoing | completed


class TournamentListResponse(BaseModel):
    tournaments: list[TournamentListItem]
    cached_at: float


class DrawMatchLine(BaseModel):
    round: str
    position: int  # position within the round (0 = top-left)
    player_a_name: str
    player_b_name: str
    player_a_slug: str | None = None
    player_b_slug: str | None = None
    score: str | None = None


class DrawResponse(BaseModel):
    slug: str
    year: int
    rounds: dict[str, list[DrawMatchLine]]  # round_name -> matches
    cached_at: float


# ── In-memory cache ─────────────────────────────────────────────

_cache: dict[str, tuple[float, object]] = {}
CACHE_TTL = 300  # 5 minutes


def _cache_get(key: str):
    if key in _cache:
        ts, value = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return value
        del _cache[key]
    return None


def _cache_set(key: str, value: object):
    _cache[key] = (time.time(), value)


# ── HTTP helpers ────────────────────────────────────────────────

_client: httpx.AsyncClient | None = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            },
        )
    return _client


async def _fetch_html(url: str) -> str:
    """Fetch and return HTML text, raising on failure."""
    client = await _get_client()
    try:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP {e.response.status_code} fetching {url}")
        raise HTTPException(status_code=502, detail=f"TennisExplorer returned {e.response.status_code}")
    except httpx.RequestError as e:
        logger.error(f"Request failed for {url}: {e}")
        raise HTTPException(status_code=503, detail=f"TennisExplorer unreachable: {e}")


# ── Scraper: tournament list (homepage) ───────────────────────


async def scrape_tournament_list() -> list[TournamentListItem]:
    """Scrape the ATP tournaments table from the homepage."""
    html = await _fetch_html(BASE_URL)
    soup = BeautifulSoup(html, "lxml")

    items: list[TournamentListItem] = []
    table = soup.find("table", class_="tournamentsTable")
    if not table:
        logger.warning("No tournamentsTable found on homepage")
        return items

    rows = table.find_all("tr")
    for row in rows:
        tds = row.find_all("td")
        if len(tds) < 3:
            continue

        # Column 0: name + link
        name_td = tds[0]
        link = name_td.find("a")
        if not link or not link.get("href"):
            continue
        href = link["href"].strip("/")
        # href looks like "wimbledon/2026/atp-men/"
        parts = href.split("/")
        slug = parts[0] if parts else ""
        name = link.get_text(strip=True)

        # Column 1: surface
        surface = tds[1].get_text(strip=True) if len(tds) > 1 else ""

        # Column 2: category
        category = tds[2].get_text(strip=True) if len(tds) > 2 else ""

        # Column 3: draw size (optional)
        draw_size = None
        if len(tds) > 3:
            ds_text = tds[3].get_text(strip=True)
            if ds_text.isdigit():
                draw_size = int(ds_text)

        items.append(TournamentListItem(
            name=name,
            slug=slug,
            surface=surface,
            category=category,
            draw_size=draw_size,
        ))

    return items


# ── Scraper: single tournament page (matches by round) ──────


_ROUND_ORDER = [
    "Qualifying", "Q1", "Q2", "Q3",
    "R1", "R2", "R3", "R4",
    "R128", "R64", "R32", "R16",
    "Quarter-finals", "Semi-finals", "Final",
    "Round robin",
]


def _round_rank(name: str) -> int:
    try:
        return _ROUND_ORDER.index(name)
    except ValueError:
        return 999


def _clean_player_name(name: str) -> str:
    """Remove trailing annotation like (2) or [Alt] from player names."""
    return re.sub(r'\s*\([^)]*\)$', '', name).strip()


async def scrape_tournament(slug: str, year: int = 2026) -> TournamentResponse:
    """Scrape a tournament page and return structured data."""
    url = f"{BASE_URL}/{slug}/{year}/atp-men/"
    html = await _fetch_html(url)
    soup = BeautifulSoup(html, "lxml")

    # ── Tournament metadata ──
    title_el = soup.find("h1") or soup.find("title")
    name = slug.capitalize()
    if title_el:
        name = title_el.get_text(strip=True).replace("| Tennis Explorer", "").strip()

    # Extract surface from breadcrumb or meta
    surface = "Unknown"
    breadcrumb = soup.find("div", class_="breadcrumb")
    if breadcrumb:
        for item in breadcrumb.find_all("a"):
            txt = item.get_text(strip=True)
            if txt.lower() in ("clay", "grass", "hard", "carpet"):
                surface = txt.capitalize()
                break

    # Extract category
    category = "ATP"
    cat_heading = soup.find(["h2", "h3"], string=re.compile(r"(Grand Slam|Masters|ATP|Challenger)", re.I))
    if cat_heading:
        category = cat_heading.get_text(strip=True)

    # Location, prize money
    location = ""
    prize_money = None
    info_lines = soup.find_all("div", class_="tournamentInfo")
    for line in info_lines:
        text = line.get_text(" ", strip=True)
        m = re.search(r"Location:\s*(.+?)(?:\s+\||$)", text)
        if m:
            location = m.group(1).strip()
        m2 = re.search(r"Prize money:\s*(.+?)(?:\s+\||$)", text)
        if m2:
            prize_money = m2.group(1).strip()

    # ── Rounds and matches ──
    rounds: list[TournamentRound] = []
    current_round: str = ""

    # Strategy: find all <h3> headings followed by a <table>
    # Each h3 is a round name, the next table contains its matches
    for h3 in soup.find_all(["h3", "h4"]):
        round_name = h3.get_text(strip=True)
        if not round_name:
            continue

        # Find the next <table class="matchTable">
        table = h3.find_next_sibling("table")
        if not table:
            # Maybe the table is inside the next div
            parent = h3.find_parent()
            if parent:
                table = parent.find_next("table", class_="matchTable")
        if not table:
            continue

        matches = _parse_match_rows(table, round_name)

        if matches:
            rounds.append(TournamentRound(name=round_name, matches=matches))
            if not current_round:
                current_round = round_name

    # Sort rounds
    rounds.sort(key=lambda r: _round_rank(r.name))

    return TournamentResponse(
        id=f"{slug}-{year}",
        name=name,
        slug=slug,
        surface=surface,
        category=category,
        year=year,
        location=location,
        prize_money=prize_money,
        rounds=rounds,
        current_round=current_round or (rounds[-1].name if rounds else ""),
        cached_at=time.time(),
    )


def _parse_match_rows(table: Tag, round_name: str) -> list[TennisMatch]:
    """Parse <tr> rows from a match table."""
    matches: list[TennisMatch] = []
    rows = table.find_all("tr")
    for i, row in enumerate(rows):
        if "flags" not in (row.get("class") or []):
            # Maybe it's a header row or spacer
            continue

        tds = row.find_all("td")
        if len(tds) < 4:
            continue

        # Column 0: time
        time_td = tds[0]
        match_time = time_td.get_text(strip=True) or None

        # Check for LIVE indicator
        status = "scheduled"
        live_span = time_td.find("span", class_=re.compile(r"live|liveIndicator", re.I))
        if live_span:
            status = "live"
        elif match_time and match_time.upper() == "LIVE":
            status = "live"

        # Find player A (first <td> with <a> pointing to /player/)
        player_a_td = tds[1]
        a_link = player_a_td.find("a", href=re.compile(r"/player/"))
        player_a_name = ""
        player_a_slug = ""
        if a_link:
            player_a_name = _clean_player_name(a_link.get_text(strip=True))
            player_a_slug = a_link["href"].strip("/").split("/")[-1]

        # Score
        score_td = tds[2] if len(tds) > 2 else None
        score = None
        if score_td:
            score = score_td.get_text(strip=True) or None
            if score and re.match(r"^[\d\s–\-]+$", score):
                status = "completed"

        # Find player B
        # Player B is in the last <td> with an <a> to /player/
        player_b_td = tds[-1]
        b_link = player_b_td.find("a", href=re.compile(r"/player/"))
        player_b_name = ""
        player_b_slug = ""
        if b_link:
            player_b_name = _clean_player_name(b_link.get_text(strip=True))
            player_b_slug = b_link["href"].strip("/").split("/")[-1]

        # Odds: look for <td class="course"> in the row
        odds_a, odds_b = None, None
        odd_cells = row.find_all("td", class_="course")
        if len(odd_cells) >= 2:
            try:
                odds_a = float(odd_cells[0].get_text(strip=True).replace(",", "."))
            except ValueError:
                pass
            try:
                odds_b = float(odd_cells[1].get_text(strip=True).replace(",", "."))
            except ValueError:
                pass
        elif len(odd_cells) == 1:
            odds_text = odd_cells[0].get_text(strip=True)
            # Single odds cell usually belongs to player A
            try:
                odds_a = float(odds_text.replace(",", "."))
            except ValueError:
                pass

        if not player_a_name or not player_b_name:
            continue

        match_id = f"{round_name.lower().replace(' ', '-')}-{i}-{player_a_slug or 'a'}-{player_b_slug or 'b'}"

        matches.append(TennisMatch(
            id=match_id,
            round=round_name,
            player_a_name=player_a_name,
            player_b_name=player_b_name,
            player_a_slug=player_a_slug,
            player_b_slug=player_b_slug,
            score=score,
            odds=TennisMatchOdds(player_a=odds_a, player_b=odds_b),
            status=status,
            time=match_time,
        ))

    return matches


# ── Scraper: draw page ────────────────────────────────────────


async def scrape_draw(slug: str, year: int = 2026) -> DrawResponse:
    """Scrape the draw/bracket page."""
    url = f"{BASE_URL}/{slug}/{year}/atp-men/?draw=1"
    html = await _fetch_html(url)
    soup = BeautifulSoup(html, "lxml")

    rounds_data: dict[str, list[DrawMatchLine]] = {}
    draw_container = soup.find("div", class_="drawContainer")

    if draw_container:
        for draw_round in draw_container.find_all("div", class_="drawRound"):
            round_name = draw_round.get("data-round", draw_round.get_text(strip=True))
            if not round_name:
                continue

            round_matches: list[DrawMatchLine] = []
            for j, match_div in enumerate(draw_round.find_all("div", class_="drawMatch")):
                player_a_el = match_div.find("div", class_="playerA") or match_div.find_all("span")[0] if match_div.find_all("span") else None
                player_b_el = match_div.find("div", class_="playerB") or match_div.find_all("span")[-1] if len(match_div.find_all("span")) > 1 else None

                p1_name = player_a_el.get_text(strip=True) if player_a_el else ""
                p2_name = player_b_el.get_text(strip=True) if player_b_el else ""
                p1_link = player_a_el.find("a") if player_a_el and hasattr(player_a_el, "find") else None
                p2_link = player_b_el.find("a") if player_b_el and hasattr(player_b_el, "find") else None
                p1_slug = p1_link["href"].strip("/").split("/")[-1] if p1_link and p1_link.get("href") else None
                p2_slug = p2_link["href"].strip("/").split("/")[-1] if p2_link and p2_link.get("href") else None

                if p1_name and p2_name:
                    round_matches.append(DrawMatchLine(
                        round=round_name,
                        position=j,
                        player_a_name=_clean_player_name(p1_name),
                        player_b_name=_clean_player_name(p2_name),
                        player_a_slug=p1_slug,
                        player_b_slug=p2_slug,
                    ))

            if round_matches:
                rounds_data[round_name] = round_matches

    # Fallback: if draw_container not found, try parsing from the match list with draw classes
    if not rounds_data:
        html2 = await _fetch_html(f"{BASE_URL}/{slug}/{year}/atp-men/")
        soup2 = BeautifulSoup(html2, "lxml")
        # Look for a draw/bracket specific section
        bracket = soup2.find("div", class_="bracket") or soup2.find("div", id="draw")
        if bracket:
            for round_el in bracket.find_all(["div", "section"], class_=re.compile(r"round|bracketRound", re.I)):
                rname = round_el.get("data-round", "") or round_el.find(["h3", "h4"])
                if rname and hasattr(rname, "get_text"):
                    rname = rname.get_text(strip=True)
                if not rname:
                    rname = f"Round {len(rounds_data) + 1}"

                round_matches = []
                for k, match_el in enumerate(round_el.find_all("div", class_=re.compile(r"match|bracketMatch", re.I))):
                    spans = match_el.find_all("span")
                    if len(spans) >= 2:
                        p1 = _clean_player_name(spans[0].get_text(strip=True))
                        p2 = _clean_player_name(spans[-1].get_text(strip=True))
                        if p1 and p2:
                            round_matches.append(DrawMatchLine(
                                round=rname if isinstance(rname, str) else f"Round {k}",
                                position=k,
                                player_a_name=p1, player_b_name=p2,
                            ))

                if round_matches:
                    rounds_data[rname if isinstance(rname, str) else f"Round {len(rounds_data)}"] = round_matches

    return DrawResponse(
        slug=slug,
        year=year,
        rounds=rounds_data,
        cached_at=time.time(),
    )


# ── Endpoints ──────────────────────────────────────────────────


@router.get("/tournaments")
async def list_tournaments():
    """Return the list of ATP tournaments from TennisExplorer homepage."""
    cached = _cache_get("tournament_list")
    if cached is not None:
        return cached

    items = await scrape_tournament_list()
    result = TournamentListResponse(tournaments=items, cached_at=time.time())
    _cache_set("tournament_list", result)
    return result


@router.get("/tournaments/{slug}")
async def get_tournament(slug: str, year: int = 2026):
    """Return full tournament data (rounds + matches)."""
    cache_key = f"tournament:{slug}:{year}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    result = await scrape_tournament(slug, year)
    _cache_set(cache_key, result)
    return result


@router.get("/tournaments/{slug}/draw")
async def get_draw(slug: str, year: int = 2026):
    """Return draw bracket data."""
    cache_key = f"draw:{slug}:{year}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    result = await scrape_draw(slug, year)
    _cache_set(cache_key, result)
    return result
