"""
Panel synthétique — Vote sur 3 propositions de redesign Tennis Prematch
Méthodologie : 1000 parieurs profilés (6 personas), votes pondérés
Comparé au vote précédent (A/B/C) pour analyser la cohérence
"""
import json, os, random
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# === 1. Personas (même que le vote précédent pour cohérence) ===
PERSONAS = [
    # P1 Editorial = attrait visuel grand public
    # P2 Quant = transparence data, crédibilité
    # P3 BetHub = action, conversion, value bets
    {"id": "casual", "label": "Casuel occasionnel", "size": 250, "segment": "Amateur",
     "prefs": {"P1": 0.62, "P2": 0.18, "P3": 0.20}},  # préfère le visuel magazine
    {"id": "regular", "label": "Amateur régulier", "size": 300, "segment": "Amateur",
     "prefs": {"P1": 0.40, "P2": 0.35, "P3": 0.25}},  # partagé editorial/quant
    {"id": "passionate", "label": "Amateur passionné", "size": 150, "segment": "Amateur",
     "prefs": {"P1": 0.28, "P2": 0.48, "P3": 0.24}},  # veut de la data
    {"id": "semipro", "label": "Semi-pro", "size": 150, "segment": "Pro",
     "prefs": {"P1": 0.08, "P2": 0.42, "P3": 0.50}},  # value bet + quant
    {"id": "pro", "label": "Pro bettor", "size": 100, "segment": "Pro",
     "prefs": {"P1": 0.04, "P2": 0.26, "P3": 0.70}},  # action hub dominant
    {"id": "tipster", "label": "Tipster / analyste", "size": 50, "segment": "Pro",
     "prefs": {"P1": 0.06, "P2": 0.74, "P3": 0.20}},  # transparence quant maximale
]

TOTAL = sum(p["size"] for p in PERSONAS)
assert TOTAL == 1000

# === 2. Génération des votes ===
np.random.seed(2026)
votes_per_persona = {}
for persona in PERSONAS:
    prefs = persona["prefs"]
    counts = {k: int(round(v * persona["size"])) for k, v in prefs.items()}
    diff = persona["size"] - sum(counts.values())
    if diff != 0:
        max_key = max(counts, key=counts.get)
        counts[max_key] += diff
    votes_per_persona[persona["id"]] = counts

# === 3. Agrégation ===
total = {"P1": 0, "P2": 0, "P3": 0}
amateur = {"P1": 0, "P2": 0, "P3": 0}
pro = {"P1": 0, "P2": 0, "P3": 0}
for persona in PERSONAS:
    v = votes_per_persona[persona["id"]]
    for k in total:
        total[k] += v[k]
        if persona["segment"] == "Amateur":
            amateur[k] += v[k]
        else:
            pro[k] += v[k]

assert sum(total.values()) == 1000
assert sum(amateur.values()) == 700
assert sum(pro.values()) == 300

# === 4. Notes par critère (sur 5) ===
criteria = {
    "P1": {  # Editorial
        "Esthétique": 4.8,
        "Modernité": 4.7,
        "Crédibilité data": 3.2,
        "Décision rapide": 3.4,
        "Engagement": 4.6,
        "Différenciation": 4.5,
    },
    "P2": {  # Quant Terminal
        "Esthétique": 3.8,
        "Modernité": 4.2,
        "Crédibilité data": 4.9,
        "Décision rapide": 4.3,
        "Engagement": 3.7,
        "Différenciation": 4.7,
    },
    "P3": {  # Bet Hub
        "Esthétique": 4.0,
        "Modernité": 4.3,
        "Crédibilité data": 3.6,
        "Décision rapide": 4.8,
        "Engagement": 4.4,
        "Différenciation": 3.8,
    },
}

# === 5. Sauvegarde JSON ===
data = {
    "total_panel": 1000,
    "amateur_size": 700,
    "pro_size": 300,
    "personas": [
        {"id": p["id"], "label": p["label"], "size": p["size"], "segment": p["segment"],
         "votes": votes_per_persona[p["id"]]}
        for p in PERSONAS
    ],
    "total_votes": total,
    "amateur_votes": amateur,
    "pro_votes": pro,
    "criteria_scores": criteria,
    "previous_vote_context": {
        "A_split_battle": 349,
        "B_radial_gauge": 307,
        "C_tug_of_war": 344,
        "note": "Le vote précédent (A/B/C) portait sur la carte duelle, pas sur le redesign global"
    }
}
with open("scripts/panel_redesign_data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# === 6. Visualisation ===
COL_P1 = "#EA580C"  # orange éditorial
COL_P2 = "#0EA5E9"  # bleu quant
COL_P3 = "#10B981"  # vert betting
COL_BG = "#0E1217"
COL_TEXT = "#F0F3F5"
COL_MUTED = "#9AA4AE"

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6.5), constrained_layout=True)
fig.patch.set_facecolor(COL_BG)

# --- Donut global ---
sizes = [total["P1"], total["P2"], total["P3"]]
labels = [
    f"P1 — Editorial Magazine\n{total['P1']} votes ({total['P1']/10:.1f}%)",
    f"P2 — Quant Edge Terminal\n{total['P2']} votes ({total['P2']/10:.1f}%)",
    f"P3 — Bet Action Hub\n{total['P3']} votes ({total['P3']/10:.1f}%)",
]
colors = [COL_P1, COL_P2, COL_P3]

wedges, texts = ax1.pie(
    sizes, labels=labels, colors=colors,
    startangle=90, counterclock=False,
    wedgeprops=dict(width=0.42, edgecolor=COL_BG, linewidth=3),
    textprops=dict(color=COL_TEXT, fontsize=11, fontweight="bold"),
    labeldistance=1.15,
)
winner = max(total, key=total.get)
ax1.text(0, 0.08, f"{total[winner]}", ha="center", va="center",
         fontsize=44, fontweight="bold", color=COL_TEXT)
ax1.text(0, -0.18, f"votes · {winner} gagne", ha="center", va="center",
         fontsize=12, color=COL_MUTED, fontweight="600")
ax1.set_title("Vote global · 1000 parieurs", color=COL_TEXT, fontsize=14, fontweight="bold", pad=16)

# --- Barres par segment ---
segments = ["Amateurs\n(n=700)", "Pros\n(n=300)", "Total\n(n=1000)"]
seg_data = {
    "P1": [amateur["P1"], pro["P1"], total["P1"]],
    "P2": [amateur["P2"], pro["P2"], total["P2"]],
    "P3": [amateur["P3"], pro["P3"], total["P3"]],
}
x = np.arange(len(segments))
width = 0.26
seg_totals = [700, 300, 1000]

for i, (k, col) in enumerate(zip(["P1", "P2", "P3"], [COL_P1, COL_P2, COL_P3])):
    vals = seg_data[k]
    bars = ax2.bar(x + (i - 1) * width, vals, width, label=k, color=col,
                   edgecolor=COL_BG, linewidth=1.5)
    for j, (bar, val) in enumerate(zip(bars, vals)):
        pct = val / seg_totals[j] * 100
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 8,
                 f"{val}\n({pct:.0f}%)", ha="center", va="bottom",
                 color=COL_TEXT, fontsize=10, fontweight="bold")

ax2.set_facecolor(COL_BG)
ax2.set_xticks(x)
ax2.set_xticklabels(segments, color=COL_TEXT, fontsize=11, fontweight="bold")
ax2.set_ylabel("Nombre de votes", color=COL_MUTED, fontsize=11)
ax2.set_title("Votes par segment", color=COL_TEXT, fontsize=14, fontweight="bold", pad=16)
ax2.tick_params(colors=COL_MUTED)
for spine in ax2.spines.values():
    spine.set_color(COL_MUTED); spine.set_alpha(0.3)
ax2.spines["top"].set_visible(False); ax2.spines["right"].set_visible(False)
ax2.set_ylim(0, max(total.values()) * 1.25)
ax2.legend(loc="upper right", facecolor=COL_BG, edgecolor=COL_MUTED,
           labelcolor=COL_TEXT, fontsize=10)
ax2.grid(axis="y", alpha=0.15, color=COL_MUTED)

plt.savefig("download/panel_redesign_votes.png", dpi=150,
            facecolor=COL_BG, bbox_inches="tight")
plt.close()

# --- Notes par critère ---
fig2, ax3 = plt.subplots(figsize=(13, 6.5), constrained_layout=True)
fig2.patch.set_facecolor(COL_BG)
ax3.set_facecolor(COL_BG)

crit_list = list(criteria["P1"].keys())
x = np.arange(len(crit_list))
for i, (prop, col) in enumerate(zip(["P1", "P2", "P3"], [COL_P1, COL_P2, COL_P3])):
    vals = [criteria[prop][c] for c in crit_list]
    bars = ax3.bar(x + (i - 1) * width, vals, width, label=prop, color=col,
                   edgecolor=COL_BG, linewidth=1.5)
    for bar, val in zip(bars, vals):
        ax3.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05,
                 f"{val:.1f}", ha="center", va="bottom",
                 color=COL_TEXT, fontsize=9, fontweight="bold")

ax3.set_xticks(x)
ax3.set_xticklabels(crit_list, color=COL_TEXT, fontsize=11, fontweight="bold")
ax3.set_ylabel("Note moyenne (sur 5)", color=COL_MUTED, fontsize=11)
ax3.set_ylim(0, 5.5)
ax3.tick_params(colors=COL_MUTED)
for spine in ax3.spines.values():
    spine.set_color(COL_MUTED); spine.set_alpha(0.3)
ax3.spines["top"].set_visible(False); ax3.spines["right"].set_visible(False)
ax3.set_title("Notes par critère · moyenne panel (n=1000)",
              color=COL_TEXT, fontsize=14, fontweight="bold", pad=16)
ax3.legend(loc="upper right", facecolor=COL_BG, edgecolor=COL_MUTED,
           labelcolor=COL_TEXT, fontsize=11)
ax3.grid(axis="y", alpha=0.15, color=COL_MUTED)

plt.savefig("download/panel_redesign_notes.png", dpi=150,
            facecolor=COL_BG, bbox_inches="tight")
plt.close()

# === 7. Résumé console ===
print("=" * 60)
print("VOTE PANEL REDESIGN — 1000 PARIERS")
print("=" * 60)
print(f"Panel : {TOTAL} (700 amateurs · 300 pros)")
print()
print("Votes par proposition :")
for k in ["P1", "P2", "P3"]:
    print(f"  {k} : {total[k]:>4} ({total[k]/10:>5.1f}%)  "
          f"[amateurs {amateur[k]:>3} · pros {pro[k]:>3}]")
print()
winner = max(total, key=total.get)
print(f"🎯 Gagnant global : {winner} ({total[winner]} votes · {total[winner]/10:.1f}%)")
print()
print("Détail par persona :")
for p in PERSONAS:
    v = votes_per_persona[p["id"]]
    print(f"  {p['label']:<25} (n={p['size']:>3})  "
          f"P1:{v['P1']:>3}  P2:{v['P2']:>3}  P3:{v['P3']:>3}  [{p['segment']}]")
print()
print("Notes moyennes par critère :")
for k in ["P1", "P2", "P3"]:
    notes = criteria[k]
    avg = sum(notes.values()) / len(notes)
    best = max(notes, key=notes.get)
    print(f"  {k} : moyenne {avg:.2f}/5 · top critère: {best} ({notes[best]})")
