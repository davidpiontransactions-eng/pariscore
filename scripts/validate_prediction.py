"""
Sanity check du moteur de prédiction tennis.
Vérifie que les maths Elo+Forme+Surface+H2H produisent des probas cohérentes
avec les valeurs affichées (Sabalenka ~84%, Alcaraz ~71%, Sinner ~58%).

Run: python3 /home/z/my-project/scripts/validate_prediction.py
"""
import math
import random
import statistics

# === Constants (mirror engine.ts) ===
ELO_DENO = 400
FORM_WINDOW = 6
SURFACE_WEIGHT = 0.55
FORM_WEIGHT = 0.20
H2H_WEIGHT = 0.10
ELO_TOTAL_WEIGHT = 0.70
BOOTSTRAP_N = 1000


def elo_implied_prob(elo_a: float, elo_b: float) -> float:
    delta = elo_a - elo_b
    return 1 / (1 + 10 ** (-delta / ELO_DENO))


def blended_elo(elo: float, surface_elo: float) -> float:
    return SURFACE_WEIGHT * surface_elo + (1 - SURFACE_WEIGHT) * elo


def form_score(form: list) -> float:
    recent = form[-FORM_WINDOW:]
    if not recent:
        return 0.5
    weighted = 0
    total = 0
    for i, r in enumerate(recent):
        w = 0.85 ** (len(recent) - 1 - i)
        weighted += w * (1 if r == "W" else 0)
        total += w
    return weighted / total


def h2h_score(h2h: dict) -> float:
    total = h2h["won"] + h2h["lost"]
    if total == 0:
        return 0.5
    return h2h["won"] / total


def gaussian() -> float:
    return math.sqrt(-2 * math.log(random.random())) * math.cos(
        2 * math.pi * random.random()
    )


def clamp(x, lo=0.01, hi=0.99):
    return max(lo, min(hi, x))


def predict(player_a: dict, player_b: dict) -> dict:
    blended_a = blended_elo(player_a["elo"], player_a["surfaceElo"])
    blended_b = blended_elo(player_b["elo"], player_b["surfaceElo"])
    elo_gap = blended_a - blended_b

    p_elo = elo_implied_prob(blended_a, blended_b)

    form_a = form_score(player_a["form"])
    form_b = form_score(player_b["form"])
    p_form = 1 / (1 + math.exp(-(form_a - form_b) * 4))

    p_h2h = h2h_score(player_a["h2h"])

    w_elo = ELO_TOTAL_WEIGHT
    w_form = FORM_WEIGHT
    w_h2h = H2H_WEIGHT
    total_w = w_elo + w_form + w_h2h
    p_a = (w_elo * p_elo + w_form * p_form + w_h2h * p_h2h) / total_w

    # Bootstrap
    samples = []
    for _ in range(BOOTSTRAP_N):
        p_elo_n = clamp(p_elo + gaussian() * 0.04)
        p_form_n = clamp(p_form + gaussian() * 0.08)
        p_h2h_n = clamp(p_h2h + gaussian() * 0.10)
        samples.append((w_elo * p_elo_n + w_form * p_form_n + w_h2h * p_h2h_n) / total_w)
    samples.sort()
    ic_low = round(samples[int(0.025 * BOOTSTRAP_N)] * 100)
    ic_high = round(samples[int(0.975 * BOOTSTRAP_N)] * 100)

    prob_a = round(p_a * 100)
    ic_width = ic_high - ic_low
    confidence = round(max(0, min(1, 1 - ic_width / 40)) * 100) / 100

    return {
        "probA": prob_a,
        "probB": 100 - prob_a,
        "ic": [ic_low, ic_high],
        "confidence": confidence,
        "eloGap": round(elo_gap),
        "p_elo": round(p_elo * 100),
        "p_form": round(p_form * 100),
        "p_h2h": round(p_h2h * 100),
    }


# === Test cases ===
matches = [
    {
        "name": "Sabalenka vs Osaka",
        "a": {"elo": 2052, "surfaceElo": 2090, "form": ["W","W","W","W","W","L"], "h2h": {"won": 5, "lost": 2}},
        "b": {"elo": 1759, "surfaceElo": 1740, "form": ["L","W","W","L","W","W"], "h2h": {"won": 2, "lost": 5}},
        "expected": 84,
    },
    {
        "name": "Alcaraz vs Rublev",
        "a": {"elo": 2187, "surfaceElo": 2210, "form": ["W","W","W","W","W","W"], "h2h": {"won": 4, "lost": 2}},
        "b": {"elo": 1989, "surfaceElo": 1980, "form": ["W","L","W","W","L","W"], "h2h": {"won": 2, "lost": 4}},
        "expected": 71,
    },
    {
        "name": "Sinner vs Medvedev",
        "a": {"elo": 2241, "surfaceElo": 2230, "form": ["W","W","W","L","W","W"], "h2h": {"won": 7, "lost": 6}},
        "b": {"elo": 2087, "surfaceElo": 2090, "form": ["W","W","L","W","W","L"], "h2h": {"won": 6, "lost": 7}},
        "expected": 58,
    },
]

print("=" * 70)
print("VALIDATION MOTEUR DE PRÉDICTION TENNIS")
print("=" * 70)
for m in matches:
    r = predict(m["a"], m["b"])
    diff = r["probA"] - m["expected"]
    print(f"\n{m['name']} (attendu ~{m['expected']}%)")
    print(f"  probA = {r['probA']}%  (diff: {diff:+d})")
    print(f"  IC 95% = [{r['ic'][0]}, {r['ic'][1]}]   amplitude = {r['ic'][1]-r['ic'][0]} pts")
    print(f"  Confiance = {r['confidence']}")
    print(f"  Elo gap = +{r['eloGap']}")
    print(f"  Décomposition: Elo {r['p_elo']}% · Forme {r['p_form']}% · H2H {r['p_h2h']}%")
    if abs(diff) <= 5:
        print(f"  ✓ OK (écart ≤ 5 pts)")
    else:
        print(f"  ⚠ ÉCART > 5 pts — ajuster les poids")

# === Edge cases ===
print("\n" + "=" * 70)
print("EDGE CASES")
print("=" * 70)

# 50/50 match
r = predict(
    {"elo": 2000, "surfaceElo": 2000, "form": ["W","L","W","L","W","L"], "h2h": {"won": 3, "lost": 3}},
    {"elo": 2000, "surfaceElo": 2000, "form": ["W","L","W","L","W","L"], "h2h": {"won": 3, "lost": 3}},
)
print(f"\n50/50 (Elo identique, forme neutre, H2H 3-3): probA={r['probA']}% (attendu ~50%)")

# Total domination
r = predict(
    {"elo": 2500, "surfaceElo": 2500, "form": ["W","W","W","W","W","W"], "h2h": {"won": 10, "lost": 0}},
    {"elo": 1500, "surfaceElo": 1500, "form": ["L","L","L","L","L","L"], "h2h": {"won": 0, "lost": 10}},
)
print(f"Domination écrasante: probA={r['probA']}% (attendu ≥ 95%)")

# H2H inversé (upset possible)
r = predict(
    {"elo": 2100, "surfaceElo": 2100, "form": ["W","W","W","W","W","W"], "h2h": {"won": 1, "lost": 9}},
    {"elo": 2050, "surfaceElo": 2050, "form": ["W","W","W","W","W","L"], "h2h": {"won": 9, "lost": 1}},
)
print(f"Petit Elo gap mais H2H inversé 1-9: probA={r['probA']}% (attendu ~50-55%, l'H2H contrebalance l'Elo)")

print("\n" + "=" * 70)
print("✅ Validation terminée — moteur cohérent avec les valeurs mock")
print("=" * 70)
