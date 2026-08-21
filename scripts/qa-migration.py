# Test end-to-end de la migration localStorage → DB
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from playwright.sync_api import sync_playwright

LEGACY = {
    "initial": 500,
    "bets": [
        {
            "id": "bet_legacy_1",
            "matchId": "m1",
            "playerA": "Carlos Alcaraz",
            "playerB": "Jannik Sinner",
            "betOn": "A",
            "betOnName": "Carlos Alcaraz",
            "stake": 20,
            "odd": 1.75,
            "status": "won",
            "placedAt": "2026-07-01T14:00:00.000Z",
            "settledAt": "2026-07-01T16:00:00.000Z",
            "payout": 35.0,
            "bookmaker": "1xbet",
            "surface": "Clay",
            "tournament": "Roland-Garros",
        },
        {
            "id": "bet_legacy_2",
            "matchId": "m2",
            "playerA": "Novak Djokovic",
            "playerB": "Daniil Medvedev",
            "betOn": "B",
            "betOnName": "Daniil Medvedev",
            "stake": 10,
            "odd": 2.4,
            "status": "lost",
            "placedAt": "2026-07-05T10:00:00.000Z",
            "settledAt": "2026-07-05T12:00:00.000Z",
        },
        {
            "id": "bet_legacy_3",
            "matchId": "m3",
            "playerA": "Aryna Sabalenka",
            "playerB": "Iga Swiatek",
            "betOn": "A",
            "betOnName": "Aryna Sabalenka",
            "stake": 15,
            "odd": 1.9,
            "status": "pending",
            "placedAt": "2026-08-18T09:00:00.000Z",
        },
    ],
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    # Injection AVANT navigation : pas besoin de charger la home d'abord
    ctx.add_init_script(
        f"localStorage.setItem('setpoint-bankroll', JSON.stringify({LEGACY!r}));"
        "localStorage.removeItem('bm-migrated-setpoint');"
    )
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:150]))

    page.goto("http://localhost:3000/bankroll", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)

    # Le bandeau doit apparaitre
    banner = page.locator("text=ancien module")
    count = banner.count()
    print(f"Bandeau de migration visible: {count > 0}")
    if count == 0:
        page.screenshot(path="docs/bet-tracker/qa/09-migration-missing.png", full_page=True)
        print("ERREUR: bandeau absent — screenshot pris")
        browser.close()
        sys.exit(1)

    page.screenshot(path="docs/bet-tracker/qa/09-migration-banner.png", full_page=True)
    page.click("text=Migrer vers la base")
    page.wait_for_timeout(4000)
    page.screenshot(path="docs/bet-tracker/qa/10-migration-done.png", full_page=True)
    print("Legacy localStorage injecte (3 paris tennis, capital 500) — migration cliquee")

    # Verifie la bankroll migree via l'API
    import urllib.request, json as j
    with urllib.request.urlopen("http://localhost:3000/api/v1/bm/bankrolls") as r:
        bankrolls = j.loads(r.read())["bankrolls"]
    migrated = [b for b in bankrolls if "migr" in b["name"].lower()]
    print(f"Bankrolls apres migration: {len(bankrolls)} (migree: {len(migrated)})")
    if not migrated:
        print("ERREUR: bankroll migree absente")
        browser.close()
        sys.exit(1)

    with urllib.request.urlopen(f"http://localhost:3000/api/v1/bm/bets?bankrollId={migrated[0]['id']}") as r:
        bets = j.loads(r.read())["bets"]
    print(f"Paris migrés: {len(bets)}")
    for b in bets:
        print(f"  {b['matchLabel']} | {b['pick']} | {b['status']} | payout={b['payout']} | {b['sport']} | note={b['note']}")

    ok = (
        len(bets) == 3
        and bets[0]["status"] == "pending"
        and any(b["status"] == "won" and b["payout"] == 35.0 for b in bets)
        and any(b["status"] == "lost" and b["payout"] == 0 for b in bets)
        and all(b["sport"] == "tennis" for b in bets)
    )
    print(f"\nMigration {'VALIDEE' if ok else 'EN ECHEC'}")
    if errors:
        print("Erreurs page:", errors[:5])
    browser.close()
    sys.exit(0 if ok else 1)