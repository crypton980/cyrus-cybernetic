from typing import Any, Callable, Dict



def safe_execute(fn: Callable[[], Any]) -> Any:
    try:
        return fn()
    except Exception as exc:
        return {"error": str(exc)}
