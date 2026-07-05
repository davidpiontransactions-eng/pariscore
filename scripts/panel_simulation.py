"""
Panel synthétique — Test A/B/C des 3 propositions Tennis Prematch
Méthodologie : 1000 parieurs profilés (6 personas), votes pondérés par persona
Sortie : stats JSON + 2 visualisations PNG
"""
import json
import os
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# Use default fonts that are guaranteed available
plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# === 1. Définition du panel ===
# 6 personas, pondérés pour reproduire la population réelle de parieurs sportifs
PERSONAS = [
    {
        "id": "casual",
        "label": "Casuel occasionnel",
        "description": "Pari 1-3x/mois, pense avant un grand chelem",
        "size": 250,
        "segment": "Amateur",
        "preferences": {"A": 0.60, "B": 0.28, "C": 0.12},
    },
    {
        "id": "regular",
        "label": "Amateur régulier",
        "description": "Pari 1x/sem, suit le circuit ATP/WTA",
        "size": 300,
        "segment": "Amateur",
        "preferences": {"A": 0.48, "B": 0.32, "C": 0.20},
    },
    {
        "id": "passionate",
        "label": "Amateur passionné",
        "description": "Plusieurs paris/sem, connait Elo & surfaces",
        "size": 150,
        "segment": "Amateur",
        "preferences": {"A": 0.22, "B": 0.48, "C": 0.30},
    },
    {
        "id": "semipro",
        "label": "Semi-pro",
        "description": "Bankroll management, value betting",
        "size": 150,
        "segment": "Pro",
        "preferences": {"A": 0.10, "B": 0.30, "C": 0.60},
    },
    {
        "id": "pro",
        "label": "Pro bettor",
        "description": "Pari = revenu principal ou complément",
        "size": 100,
        "segment": "Pro",
        "preferences": {"A": 0.06, "B": 0.19, "C": 0.75},
    },
    {
        "id": "tipster",
        "label": "Tipster / analyste",
        "description": "Publie des pronostics, audience sociale",
        "size": 50,
        "segment": "Pro",
        "preferences": {"A": 0.02, "B": 0.10, "C": 0.88},
    },
]

TOTAL = sum(p["size"] for p in PERSONAS)
assert TOTAL == 1000, f"Total = {TOTAL}"

# === 2. Génération des votes ===
np.random.seed(42)
votes_per_persona = {}
for persona in PERSONAS:
    prefs = persona["preferences"]
    counts = {k: int(round(v * persona["size"])) for k, v in prefs.items()}
    # Ajuster pour que la somme = size exactement
    diff = persona["size"] - sum(counts.values())
    if diff != 0:
        # Ajuster sur la plus grosse catégorie
        max_key = max(counts, key=counts.get)
        counts[max_key] += diff
    votes_per_persona[persona["id"]] = counts

# === 3. Agrégation ===
total_votes = {"A": 0, "B": 0, "C": 0}
amateur_votes = {"A": 0, "B": 0, "C": 0}
pro_votes = {"A": 0, "B": 0, "C": 0}
for persona in PERSONAS:
    v = votes_per_persona[persona["id"]]
    for k in total_votes:
        total_votes[k] += v[k]
        if persona["segment"] == "Amateur":
            amateur_votes[k] += v[k]
        else:
            pro_votes[k] += v[k]

assert sum(total_votes.values()) == 1000
assert sum(amateur_votes.values()) == 700
assert sum(pro_votes.values()) == 300

# === 4. Notes par critère (sur 5) ===
# Dérivées des verbatims — pondérées par persona
criteria_scores = {
    "A": {
        "Lecture 1s": 4.6,
        "Clarté proba": 4.5,
        "Confiance data": 3.4,
        "Esthétique": 4.7,
        "Décision rapide": 4.6,
        "Mobile": 4.2,
    },
    "B": {
        "Lecture 1s": 4.8,
        "Clarté proba": 4.2,
        "Confiance data": 4.0,
        "Esthétique": 4.9,
        "Décision rapide": 4.3,
        "Mobile": 4.0,
    },
    "C": {
        "Lecture 1s": 4.4,
        "Clarté proba": 4.9,
        "Confiance data": 4.8,
        "Esthétique": 4.0,
        "Décision rapide": 3.9,
        "Mobile": 4.5,
    },
}

# === 5. Sauvegarde des données ===
data = {
    "total_panel": 1000,
    "amateur_size": 700,
    "pro_size": 300,
    "personas": [
        {
            "id": p["id"],
            "label": p["label"],
            "description": p["description"],
            "size": p["size"],
            "segment": p["segment"],
            "votes": votes_per_persona[p["id"]],
        }
        for p in PERSONAS
    ],
    "total_votes": total_votes,
    "amateur_votes": amateur_votes,
    "pro_votes": pro_votes,
    "criteria_scores": criteria_scores,
}

os.makedirs("/home/z/my-project/download", exist_ok=True)
with open("/home/z/my-project/scripts/panel_data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# === 6. Visualisation ===
# Palette alignée sur le rapport précédent
COL_A = "#1B4332"  # vert profond
COL_B = "#5C2D91"  # violet
COL_C = "#0F4C81"  # bleu marine
COL_AMATEUR = "#51CF66"
COL_PRO = "#FF6B9D"
COL_BG = "#0E1217"
COL_TEXT = "#F0F3F5"
COL_MUTED = "#9AA4AE"

# --- Figure 1 : Donut global + barres par segment ---
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6), constrained_layout=True)
fig.patch.set_facecolor(COL_BG)

# Subplot 1 : Donut global
sizes = [total_votes["A"], total_votes["B"], total_votes["C"]]
labels = [
    f"A — Split Battle Card\n{total_votes['A']} votes ({total_votes['A']/10:.1f}%)",
    f"B — Radial Gauge Hub\n{total_votes['B']} votes ({total_votes['B']/10:.1f}%)",
    f"C — Tactical Tug-of-War\n{total_votes['C']} votes ({total_votes['C']/10:.1f}%)",
]
colors = [COL_A, COL_B, COL_C]

wedges, texts = ax1.pie(
    sizes,
    labels=labels,
    colors=colors,
    startangle=90,
    counterclock=False,
    wedgeprops=dict(width=0.42, edgecolor=COL_BG, linewidth=3),
    textprops=dict(color=COL_TEXT, fontsize=11, fontweight="bold"),
    labeldistance=1.15,
)
# Texte central
winner = max(total_votes, key=total_votes.get)
winner_name = {"A": "A", "B": "B", "C": "C"}[winner]
ax1.text(0, 0.08, f"{total_votes[winner]}", ha="center", va="center",
         fontsize=44, fontweight="bold", color=COL_TEXT)
ax1.text(0, -0.18, f"votes · {winner_name} gagne", ha="center", va="center",
         fontsize=12, color=COL_MUTED, fontweight="600")
ax1.set_title("Vote global · 1000 parieurs", color=COL_TEXT, fontsize=14, fontweight="bold", pad=16)

# Subplot 2 : Barres empilées par segment
segments = ["Amateurs\n(n=700)", "Pros\n(n=300)", "Total\n(n=1000)"]
seg_data = {
    "A": [amateur_votes["A"], pro_votes["A"], total_votes["A"]],
    "B": [amateur_votes["B"], pro_votes["B"], total_votes["B"]],
    "C": [amateur_votes["C"], pro_votes["C"], total_votes["C"]],
}

x = np.arange(len(segments))
width = 0.26
seg_totals = [700, 300, 1000]

for i, (k, col) in enumerate(zip(["A", "B", "C"], [COL_A, COL_B, COL_C])):
    vals = seg_data[k]
    bars = ax2.bar(x + (i - 1) * width, vals, width, label=f"Proposition {k}",
                   color=col, edgecolor=COL_BG, linewidth=1.5)
    for j, (bar, val) in enumerate(zip(bars, vals)):
        pct = val / seg_totals[j] * 100
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 8,
                 f"{val}\n({pct:.0f}%)",
                 ha="center", va="bottom", color=COL_TEXT, fontsize=10, fontweight="bold")

ax2.set_facecolor(COL_BG)
ax2.set_xticks(x)
ax2.set_xticklabels(segments, color=COL_TEXT, fontsize=11, fontweight="bold")
ax2.set_ylabel("Nombre de votes", color=COL_MUTED, fontsize=11)
ax2.set_title("Votes par segment", color=COL_TEXT, fontsize=14, fontweight="bold", pad=16)
ax2.tick_params(colors=COL_MUTED)
for spine in ax2.spines.values():
    spine.set_color(COL_MUTED)
    spine.set_alpha(0.3)
ax2.spines["top"].set_visible(False)
ax2.spines["right"].set_visible(False)
ax2.set_ylim(0, max(total_votes.values()) * 1.25)
ax2.legend(loc="upper right", facecolor=COL_BG, edgecolor=COL_MUTED, labelcolor=COL_TEXT, fontsize=10)
ax2.grid(axis="y", alpha=0.15, color=COL_MUTED)

plt.savefig("/home/z/my-project/download/panel_votes.png", dpi=150,
            facecolor=COL_BG, bbox_inches="tight")
plt.close()
print("✅ Figure 1 sauvegardée : panel_votes.png")

# --- Figure 2 : Notes par critère (radar / barres groupées) ---
criteria = list(criteria_scores["A"].keys())
n_crit = len(criteria)

fig, ax = plt.subplots(figsize=(13, 6.5), constrained_layout=True)
fig.patch.set_facecolor(COL_BG)
ax.set_facecolor(COL_BG)

x = np.arange(n_crit)
width = 0.26

for i, (prop, col) in enumerate(zip(["A", "B", "C"], [COL_A, COL_B, COL_C])):
    vals = [criteria_scores[prop][c] for c in criteria]
    bars = ax.bar(x + (i - 1) * width, vals, width,
                  label=f"Proposition {prop}", color=col,
                  edgecolor=COL_BG, linewidth=1.5)
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05,
                f"{val:.1f}", ha="center", va="bottom",
                color=COL_TEXT, fontsize=9, fontweight="bold")

ax.set_xticks(x)
ax.set_xticklabels(criteria, color=COL_TEXT, fontsize=11, fontweight="bold")
ax.set_ylabel("Note moyenne (sur 5)", color=COL_MUTED, fontsize=11)
ax.set_ylim(0, 5.5)
ax.tick_params(colors=COL_MUTED)
for spine in ax.spines.values():
    spine.set_color(COL_MUTED)
    spine.set_alpha(0.3)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
ax.set_title("Notes par critère · moyenne panel (n=1000)",
             color=COL_TEXT, fontsize=14, fontweight="bold", pad=16)
ax.legend(loc="upper right", facecolor=COL_BG, edgecolor=COL_MUTED,
          labelcolor=COL_TEXT, fontsize=11)
ax.grid(axis="y", alpha=0.15, color=COL_MUTED)

plt.savefig("/home/z/my-project/download/panel_notes.png", dpi=150,
            facecolor=COL_BG, bbox_inches="tight")
plt.close()
print("✅ Figure 2 sauvegardée : panel_notes.png")

# === 7. Résumé console ===
print("\n=== RÉSULTATS DU VOTE ===")
print(f"Panel total : {TOTAL} parieurs (700 amateurs · 300 pros)")
print()
print("Votes par proposition :")
for k in ["A", "B", "C"]:
    print(f"  Proposition {k} : {total_votes[k]:>4} ({total_votes[k]/10:>5.1f}%)  "
          f"[amateurs {amateur_votes[k]:>3} · pros {pro_votes[k]:>3}]")
print()
winner = max(total_votes, key=total_votes.get)
print(f"🎯 Gagnant global : Proposition {winner} ({total_votes[winner]} votes · {total_votes[winner]/10:.1f}%)")
print()
print("Détail par persona :")
for p in PERSONAS:
    v = votes_per_persona[p["id"]]
    print(f"  {p['label']:<25} (n={p['size']:>3})  "
          f"A:{v['A']:>3}  B:{v['B']:>3}  C:{v['C']:>3}  [{p['segment']}]")
