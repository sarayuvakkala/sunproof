"""Evidence chart for the installer: expected range vs actual, flagged days marked (module M5)."""

import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

BAND, LINE, FLAG, INK, MUTED, GRID = "#cde2fb", "#2a78d6", "#ec835a", "#0b0b0b", "#7a7974", "#ebe9e3"


def render(daily: pd.DataFrame, title: str) -> bytes:
    """daily: columns date, p10, p50, p90, actual, flag. Returns PNG bytes."""
    d = daily.copy()
    d["date"] = pd.to_datetime(d["date"])
    fig, ax = plt.subplots(figsize=(8, 3.6), dpi=150)
    ax.fill_between(d["date"], d["p10"], d["p90"], color=BAND, linewidth=0, label="Expected range")
    ax.plot(d["date"], d["actual"], color=LINE, linewidth=2, label="Actual")
    flagged = d[d["flag"].notna()]
    ax.scatter(flagged["date"], flagged["actual"], s=36, color=FLAG, edgecolor="white", linewidth=1.5,
               zorder=3, label="Worth checking")

    ax.set_title(title, loc="left", fontsize=11, color=INK, fontweight="bold")
    ax.set_ylabel("Units (kWh) per day", fontsize=9, color=MUTED)
    ax.set_ylim(bottom=0)
    ax.grid(axis="y", color=GRID)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(colors=MUTED, labelsize=8, length=0)
    ax.legend(loc="lower left", fontsize=8, frameon=False, ncol=3)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    return buf.getvalue()
