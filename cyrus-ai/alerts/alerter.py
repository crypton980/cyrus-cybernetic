"""
CYRUS Alerting System — multi-channel alert dispatching.

Provides a production-ready alert manager that supports:

* **Webhook** delivery — HTTP POST to a configurable URL (e.g. Slack
  incoming webhook, PagerDuty Events API, generic HTTP receiver)
* **Log fallback** — always logs at WARNING/ERROR level so alerts are
  captured in the centralized log stream even when the webhook is
  unavailable
* **Alert history** — in-process ring buffer of the last 500 alerts for
  the operator dashboard
* **Deduplication** — suppresses identical alerts within a configurable
  cool-down window (``CYRUS_ALERT_COOLDOWN_SEC``)
* **Error rate monitoring** — ``check_error_rate_threshold()`` reads the
  metrics tracker and fires an alert when the rolling error rate exceeds
  the configured threshold

Configuration (env vars)
------------------------
CYRUS_ALERT_WEBHOOK_URL         → HTTP(S) URL for webhook delivery
CYRUS_ALERT_ERROR_RATE_THRESHOLD → float 0-1 (default: 0.3)
CYRUS_ALERT_COOLDOWN_SEC        → deduplication window in seconds (default: 300)
CYRUS_ALERT_HISTORY_SIZE        → max entries in history buffer (default: 500)
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_WEBHOOK_URL: str = os.getenv("CYRUS_ALERT_WEBHOOK_URL", "")
_ERROR_RATE_THRESHOLD: float = float(os.getenv("CYRUS_ALERT_ERROR_RATE_THRESHOLD", "0.3"))
_COOLDOWN_SEC: int = int(os.getenv("CYRUS_ALERT_COOLDOWN_SEC", "300"))
_HISTORY_SIZE: int = int(os.getenv("CYRUS_ALERT_HISTORY_SIZE", "500"))


# ── Data model ─────────────────────────────────────────────────────────────────

class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class Alert:
    message: str
    severity: AlertSeverity = AlertSeverity.WARNING
    source: str = "cyrus"
    metadata: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    delivered: bool = False
    delivery_error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["severity"] = self.severity.value
        return d


# ── State ──────────────────────────────────────────────────────────────────────

_history: deque[Alert] = deque(maxlen=_HISTORY_SIZE)
_cooldown_cache: dict[str, float] = {}   # message_key → last_sent_ts
_lock = threading.Lock()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_duplicate(message: str) -> bool:
    """Return True if an identical alert was sent within the cooldown window."""
    key = message[:200]
    last = _cooldown_cache.get(key, 0.0)
    return (time.time() - last) < _COOLDOWN_SEC


def _mark_sent(message: str) -> None:
    _cooldown_cache[message[:200]] = time.time()
    # Evict stale entries to bound memory
    if len(_cooldown_cache) > 1000:
        now = time.time()
        stale = [k for k, v in _cooldown_cache.items() if now - v > _COOLDOWN_SEC * 2]
        for k in stale:
            del _cooldown_cache[k]


def _deliver_webhook(alert: Alert) -> bool:
    """
    POST the alert payload to ``CYRUS_ALERT_WEBHOOK_URL``.

    Supports Slack-compatible ``{"text": "..."}`` format as well as a
    generic JSON payload.

    Returns True on success.
    """
    if not _WEBHOOK_URL:
        return False

    payload = {
        "text": f"[{alert.severity.upper()}] {alert.message}",
        "source": alert.source,
        "severity": alert.severity.value,
        "timestamp": alert.timestamp,
        **alert.metadata,
    }

    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        _WEBHOOK_URL,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "CYRUS-Alerter/1.0"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:  # noqa: S310
            return resp.status < 400
    except urllib.error.URLError as exc:
        logger.warning("[Alerter] webhook delivery failed: %s", exc)
        return False
    except Exception as exc:  # noqa: BLE001
        logger.warning("[Alerter] webhook delivery error: %s", exc)
        return False


# ── Public API ─────────────────────────────────────────────────────────────────


def send_alert(
    message: str,
    severity: AlertSeverity | str = AlertSeverity.WARNING,
    source: str = "cyrus",
    metadata: dict[str, Any] | None = None,
    force: bool = False,
) -> Alert:
    """
    Send an alert via all configured channels.

    The alert is always recorded in the in-process history ring buffer.
    Webhook delivery is attempted when ``CYRUS_ALERT_WEBHOOK_URL`` is set.
    Both are preceded by a stdlib log at the appropriate level.

    Parameters
    ----------
    message  : str             — alert message text
    severity : AlertSeverity   — severity level
    source   : str             — originating component/module
    metadata : dict | None     — extra key-value context
    force    : bool            — bypass deduplication cooldown

    Returns
    -------
    Alert — the recorded alert object.
    """
    if isinstance(severity, str):
        severity = AlertSeverity(severity)

    alert = Alert(
        message=message,
        severity=severity,
        source=source,
        metadata=metadata or {},
    )

    # Log regardless
    log_level = {
        AlertSeverity.INFO: "info",
        AlertSeverity.WARNING: "warning",
        AlertSeverity.ERROR: "error",
        AlertSeverity.CRITICAL: "critical",
    }.get(severity, "warning")

    getattr(logger, log_level if log_level != "critical" else "error")(
        "[Alert][%s] %s", severity.value.upper(), message,
        extra={"source": source, **(metadata or {})},
    )

    with _lock:
        if not force and _is_duplicate(message):
            logger.debug("[Alerter] suppressed duplicate alert: %s", message[:80])
            _history.append(alert)
            return alert

        _mark_sent(message)
        _history.append(alert)

    # Webhook delivery (non-blocking background thread)
    if _WEBHOOK_URL:
        def _send() -> None:
            ok = _deliver_webhook(alert)
            alert.delivered = ok
            if not ok:
                alert.delivery_error = "webhook delivery failed"

        t = threading.Thread(target=_send, daemon=True)
        t.start()
    else:
        alert.delivered = True  # log-only delivery counts as delivered

    return alert


def check_error_rate_threshold(error_rate: float | None = None) -> bool:
    """
    Check whether the current error rate exceeds the configured threshold
    and fire an alert if so.

    When *error_rate* is ``None``, it is computed from the metrics tracker.

    Returns True if an alert was fired.
    """
    if error_rate is None:
        try:
            from metrics.tracker import get_recent_metrics  # noqa: PLC0415
            metrics = get_recent_metrics(window=100)
            total = len(metrics)
            if total == 0:
                return False
            errors = sum(1 for m in metrics if m.get("overall_score", 1.0) < 0.3)
            error_rate = errors / total
        except Exception:  # noqa: BLE001
            return False

    if error_rate > _ERROR_RATE_THRESHOLD:
        send_alert(
            f"High error rate detected: {error_rate:.1%} (threshold: {_ERROR_RATE_THRESHOLD:.1%})",
            severity=AlertSeverity.ERROR,
            source="metrics_monitor",
            metadata={"error_rate": error_rate, "threshold": _ERROR_RATE_THRESHOLD},
        )
        return True
    return False


def get_alert_history(limit: int = 100) -> list[dict[str, Any]]:
    """Return the most recent *limit* alerts from the history ring buffer."""
    with _lock:
        alerts = list(_history)
    return [a.to_dict() for a in alerts[-limit:]]
