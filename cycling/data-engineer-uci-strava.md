# Data Source Evaluation: Cycling

**Date:** 2026-06-26
**Goal:** Evaluate UCI Data Hub and Strava API as data sources for cycling predictive models.

---

## 1. UCI Data Hub

| Field | Detail |
|---|---|
| **Source** | Union Cycliste Internationale (UCI) |
| **URL** | https://www.uci.org / https://dataride.uci.ch / https://portal.tech.uci.ch |
| **Access Type** | No public API. Rankings published as HTML pages on uci.org. Dashboards (dataride, portal.tech) require authorized access only. |
| **GitHub Wrappers** | None (no API to wrap). Third-party scrapers exist: |
| | - `jenslemb/cyclingdata` (R): scrapes ProCyclingStats → race results, rankings, rider profiles |
| | - `firstcycling-api` (Python, PyPI): wraps firstcycling.com → races, riders, rankings, startlists |
| | - `r-huijts/firstcycling-mcp` (MCP): MCP server for firstcycling.com |
| **Documentation** | No official API docs. Third-party aggregators (ProCyclingStats, FirstCycling, CyclingNews) are the de facto sources. |
| **Auth** | N/A (no API). Third-party scrapers require no auth. |
| **Rate Limits** | N/A for UCI directly. Scrapers subject to target site throttling. |
| **Cost** | Free (HTML pages). Dataride dashboards may require federation credentials. |
| **Available Data** | Rider rankings (road, MTB, track, BMX), race results, UCI points, World Tour standings, rider licenses. |
| **Format** | HTML (uci.org). Third-party scrapers → CSV, JSON, R/Python dataframes. |
| **Pertinence (1–5)** | **3/5** — UCI rankings are useful for baseline rider ratings, but no live/API access limits automation. |
| **Limitations** | No official API; HTML-only; dataride.uci.ch behind auth; rankings update frequency unknown (likely weekly). |
| **Note** | Practical path: scrape ProCyclingStats (cyclingdata R pkg) or use FirstCycling Python wrapper for structured data. |

---

## 2. Strava API

| Field | Detail |
|---|---|
| **Source** | Strava (v3 API) |
| **URL** | https://developers.strava.com |
| **Access Type** | REST API v3. OAuth 2.0 — each athlete must individually authorize the app. |
| **GitHub Wrappers** | `stravalib` (⭐983, Python, mature), `strava-client` (Python, lightweight) |
| **Documentation** | Well-documented: https://developers.strava.com/docs/reference/ |
| **Auth** | OAuth 2.0 (per-athlete consent). Requires refresh token rotation. |
| **Rate Limits** | 100 requests per 15 minutes, 1000 per day (free tier). Higher limits via application. |
| **Cost** | **June 2026: $11.99/month** subscription for API access (new paywall). Previously free. |
| **Available Data** | Activities (rides, runs), streams (time series: heartrate, power, cadence, speed, altitude, lat/lng), segment efforts, gear, athlete stats, route geometry (GPX/TCX). |
| **Format** | JSON (REST), GPX/TCX (route downloads) |
| **Pertinence (1–5)** | **1/5** — Per-athlete OAuth barrier makes bulk collection of pro cyclist data impossible. |
| **Limitations** | **Dealbreakers:** (1) Each pro cyclist must individually authorize the app — no bulk access. (2) June 2026 paywall ($11.99/mo). (3) 2024 ban on using data for AI/ML training. (4) Rate limits prevent large-scale collection. |
| **Note** | Only viable for small-scale personal coaching datasets, not for prediction at scale. |


## Summary

| Source | Pertinence | Viable for PariScore? | Recommended Approach |
|---|---|---|---|
| UCI (official) | 3/5 | Partial (rankings only) | Skip direct; use aggregators below |
| ProCyclingStats (scraper) | 4/5 | Yes | R package `cyclingdata` — race results, rankings |
| FirstCycling (API wrapper) | 4/5 | Yes | Python `firstcycling-api` — races, riders, startlists |
| Strava API | 1/5 | No | Per-athlete OAuth + paywall + AI ban = non-viable |

**Recommendation:** Focus on ProCyclingStats / FirstCycling for cycling data. Evaluate commercial cycling APIs on RapidAPI as a potential structured-data alternative.
