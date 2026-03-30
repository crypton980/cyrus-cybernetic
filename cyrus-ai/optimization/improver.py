"""
CYRUS Self-Improvement Engine — metrics-driven optimization directives.

Analyses the current metrics snapshot and produces a structured action
directive that the autonomy loop (and any external controller) can act on.

Decision logic
--------------
Priority order (highest wins):
  1. HIGH_ERROR_RATE   — error/blocked fraction > 20 %
  2. OPTIMIZE_SPEED    — avg latency > LATENCY_WARN_MS (default 3000 ms)
  3. OPTIMIZE_QUALITY  — avg evaluation score < QUALITY_THRESHOLD (0.6)
  4. OBSERVE           — avg latency > LATENCY_OK_MS (default 1500 ms)
  5. STABLE            — everything within acceptable bounds

Each action includes a structured report for logging and API exposure.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, asdict
from typing import Any

logger = logging.getLogger(__name__)

# ── Thresholds (environment-configurable via constants for testability) ─────────

LATENCY_OK_MS: int = 1_500      # above this → observe
LATENCY_WARN_MS: int = 3_000    # above this → optimize_speed
QUALITY_THRESHOLD: float = 0.60  # below this → optimize_quality
ERROR_RATE_THRESHOLD: float = 0.20  # above this → high_error_rate


@dataclass
class OptimizationAction:
    """Structured optimization directive produced by `improve_system()`."""

    action: str
    reason: str
    metrics_snapshot: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def improve_system(metrics: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Analyse a list of metric entries and return an optimization directive.

    Parameters
    ----------
    metrics : list[dict]
        Snapshot from `metrics.tracker.get_metrics()`.  Each entry should
        have at minimum ``latency`` (int ms) and optionally
        ``overall_score`` (float) and ``error``/``blocked`` (bool).

    Returns
    -------
    dict — serialised `OptimizationAction`.
        ``action``  — one of: stable, observe, optimize_speed,
                       optimize_quality, high_error_rate
        ``reason``  — human-readable explanation
        ``metrics_snapshot`` — the aggregate statistics used for the decision
    """
    if not metrics:
        return OptimizationAction(
            action="observe",
            reason="No metrics collected yet — waiting for baseline data.",
            metrics_snapshot={},
        ).to_dict()

    # ── Compute aggregates ──────────────────────────────────────────────────
    count = len(metrics)
    latencies = [m.get("latency", 0) for m in metrics]
    scores = [m.get("overall_score", 0.7) for m in metrics]
    error_count = sum(1 for m in metrics if m.get("error") or m.get("blocked"))

    avg_latency = sum(latencies) / count
    avg_score = sum(scores) / count
    error_rate = error_count / count

    snapshot = {
        "count": count,
        "avg_latency_ms": round(avg_latency, 1),
        "avg_overall_score": round(avg_score, 3),
        "error_rate": round(error_rate, 3),
    }

    # ── Decision priority order ─────────────────────────────────────────────
    if error_rate > ERROR_RATE_THRESHOLD:
        action = "high_error_rate"
        reason = (
            f"Error/blocked rate {error_rate:.0%} exceeds threshold "
            f"({ERROR_RATE_THRESHOLD:.0%}). Investigate agent failures."
        )

    elif avg_latency > LATENCY_WARN_MS:
        action = "optimize_speed"
        reason = (
            f"Average latency {avg_latency:.0f} ms exceeds warn threshold "
            f"({LATENCY_WARN_MS} ms). Consider caching or prompt reduction."
        )

    elif avg_score < QUALITY_THRESHOLD:
        action = "optimize_quality"
        reason = (
            f"Average quality score {avg_score:.3f} below threshold "
            f"({QUALITY_THRESHOLD}). Review LLM prompt quality and context retrieval."
        )

    elif avg_latency > LATENCY_OK_MS:
        action = "observe"
        reason = (
            f"Latency {avg_latency:.0f} ms slightly elevated (ok threshold: "
            f"{LATENCY_OK_MS} ms). Monitoring for trend."
        )

    else:
        action = "stable"
        reason = (
            f"All metrics within acceptable bounds — latency {avg_latency:.0f} ms, "
            f"score {avg_score:.3f}, error rate {error_rate:.0%}."
        )

    directive = OptimizationAction(
        action=action,
        reason=reason,
        metrics_snapshot=snapshot,
    )
    logger.info(
        "[Improver] action=%s avg_latency=%.0f avg_score=%.3f error_rate=%.0f%%",
        action,
        avg_latency,
        avg_score,
        error_rate * 100,
    )
    return directive.to_dict()
