"""Generate PWA icons (192 and 512) for SetPoint.
Uses matplotlib to draw a simple tennis-ball-like icon on emerald background.
"""
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import os

OUT = "/home/z/my-project/public"

def make_icon(size: int, path: str):
    fig, ax = plt.subplots(figsize=(size/100, size/100), dpi=100)
    fig.patch.set_facecolor("#10b981")  # emerald-600
    ax.set_facecolor("#10b981")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_aspect("equal")
    ax.axis("off")
    # White circle (tennis ball)
    ball = mpatches.Circle((0.5, 0.5), 0.28, fill=True, facecolor="white",
                            edgecolor="#0E1217", linewidth=2)
    ax.add_patch(ball)
    # Tennis curve (yellow-green)
    curve_color = "#bef264"
    # Top curve
    arc1 = mpatches.Arc((0.5, 0.5), 0.45, 0.45, angle=0, theta1=20, theta2=160,
                         color=curve_color, linewidth=4)
    ax.add_patch(arc1)
    # Bottom curve
    arc2 = mpatches.Arc((0.5, 0.5), 0.45, 0.45, angle=0, theta1=200, theta2=340,
                         color=curve_color, linewidth=4)
    ax.add_patch(arc2)
    plt.savefig(path, dpi=100, facecolor="#10b981", bbox_inches="tight",
                pad_inches=0)
    plt.close()
    print(f"OK {path}")

make_icon(192, os.path.join(OUT, "icon-192.png"))
make_icon(512, os.path.join(OUT, "icon-512.png"))
