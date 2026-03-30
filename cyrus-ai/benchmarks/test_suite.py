"""
CYRUS Benchmark Suite — automated correctness and performance validation.

Runs a fixed bank of test prompts through the Commander pipeline and
reports per-test and aggregate results.  Designed to be called from the
autonomy loop, the `/system/benchmark` endpoint, or CI.

Test bank covers the three primary intent categories:
  * analysis — reasoning and investigation
  * mission  — planning and execution
  * memory   — retrieval and recall

Each test specifies:
  ``input``     — the operator prompt
  ``category``  — intent label
  ``pass_fn``   — callable(result) → bool: whether the test passed

Results include timing, evaluation scores, and a boolean pass/fail so that
regressions are caught automatically.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field, asdict
from typing import Any, Callable

logger = logging.getLogger(__name__)


# ── Data structures ────────────────────────────────────────────────────────────


@dataclass
class BenchmarkTest:
    """A single benchmark test case."""

    name: str
    input: str
    category: str
    pass_fn: Callable[[dict[str, Any]], bool]


@dataclass
class BenchmarkResult:
    """Result for a single benchmark test."""

    name: str
    category: str
    passed: bool
    latency_ms: int
    overall_score: float
    error: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d.pop("pass_fn", None)  # not serialisable
        return d


# ── Default pass predicates ────────────────────────────────────────────────────


def _pipeline_completed(result: dict[str, Any]) -> bool:
    """Pipeline ran without blocking and produced analysis + mission."""
    if result.get("blocked"):
        return False
    analysis = result.get("analysis") or {}
    mission = result.get("mission") or {}
    return bool(analysis) and bool(mission)


def _security_present(result: dict[str, Any]) -> bool:
    """Security result is present and status is ok."""
    sec = result.get("security") or {}
    return sec.get("status") == "ok"


def _mission_plan_nonempty(result: dict[str, Any]) -> bool:
    """Mission plan has at least one step."""
    mission = result.get("mission") or {}
    plan = mission.get("mission_plan") or []
    return len(plan) > 0


def _memory_retrieved(result: dict[str, Any]) -> bool:
    """Memory agent returned a result dict (even if empty collection)."""
    return isinstance(result.get("memory"), dict)


# ── Test bank ─────────────────────────────────────────────────────────────────


_DEFAULT_TESTS: list[BenchmarkTest] = [
    BenchmarkTest(
        name="analysis_system_performance",
        input="Analyze system performance and identify bottlenecks",
        category="analysis",
        pass_fn=_pipeline_completed,
    ),
    BenchmarkTest(
        name="mission_delivery_drone",
        input="Plan mission for delivery drone route optimisation",
        category="mission",
        pass_fn=_mission_plan_nonempty,
    ),
    BenchmarkTest(
        name="memory_retrieve_stored",
        input="Retrieve all stored memory entries related to system status",
        category="memory",
        pass_fn=_memory_retrieved,
    ),
    BenchmarkTest(
        name="security_gate_valid",
        input="What is the current intelligence status?",
        category="security",
        pass_fn=_security_present,
    ),
    BenchmarkTest(
        name="analysis_threat_assessment",
        input="Perform threat assessment for network anomaly detection",
        category="analysis",
        pass_fn=_pipeline_completed,
    ),
]


# ── Public API ─────────────────────────────────────────────────────────────────


def run_benchmark(
    commander: Any,
    tests: list[BenchmarkTest] | None = None,
) -> dict[str, Any]:
    """
    Run the benchmark suite against a Commander instance.

    Parameters
    ----------
    commander : Commander
        The Commander orchestrator to test.
    tests : list[BenchmarkTest] | None
        Custom test list.  Defaults to the built-in ``_DEFAULT_TESTS`` bank.

    Returns
    -------
    dict with keys:
        ``total``   — number of tests run
        ``passed``  — number of tests that passed
        ``failed``  — number of tests that failed
        ``pass_rate`` — fraction passed (0.0–1.0)
        ``avg_latency_ms`` — mean test latency
        ``results`` — list of per-test BenchmarkResult dicts
    """
    suite = tests if tests is not None else _DEFAULT_TESTS
    results: list[BenchmarkResult] = []

    for test in suite:
        start = time.monotonic()
        error_msg: str | None = None
        passed = False
        overall_score = 0.0

        try:
            result = commander.execute(test.input)
            overall_score = float((result.get("evaluation") or {}).get("overall", 0.0))
            passed = test.pass_fn(result)
        except Exception as exc:  # noqa: BLE001
            error_msg = str(exc)
            logger.warning("[Benchmark] test '%s' raised: %s", test.name, exc)

        latency_ms = int((time.monotonic() - start) * 1_000)

        br = BenchmarkResult(
            name=test.name,
            category=test.category,
            passed=passed,
            latency_ms=latency_ms,
            overall_score=overall_score,
            error=error_msg,
        )
        results.append(br)
        logger.info(
            "[Benchmark] %s — passed=%s latency=%d ms score=%.3f",
            test.name,
            passed,
            latency_ms,
            overall_score,
        )

    passed_count = sum(1 for r in results if r.passed)
    latencies = [r.latency_ms for r in results]
    avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 0

    summary = {
        "total": len(results),
        "passed": passed_count,
        "failed": len(results) - passed_count,
        "pass_rate": round(passed_count / len(results), 3) if results else 0.0,
        "avg_latency_ms": avg_latency,
        "results": [r.to_dict() for r in results],
    }
    logger.info(
        "[Benchmark] complete — passed=%d/%d avg_latency=%s ms",
        passed_count,
        len(results),
        avg_latency,
    )
    return summary
