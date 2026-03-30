"""cyrus-ai/alerts package — multi-channel alerting system."""

from alerts.alerter import (
    send_alert,
    AlertSeverity,
    check_error_rate_threshold,
    get_alert_history,
)

__all__ = [
    "send_alert",
    "AlertSeverity",
    "check_error_rate_threshold",
    "get_alert_history",
]
