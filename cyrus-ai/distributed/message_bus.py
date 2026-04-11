import json
import os
import time
from typing import Any, Callable, Dict

import redis

from distributed.safe_execution import safe_execute

CHANNEL = os.getenv("CYRUS_EVENT_CHANNEL", "cyrus_events")
_REDIS_HOST = os.getenv("CYRUS_REDIS_HOST", "localhost")
_REDIS_PORT = int(os.getenv("CYRUS_REDIS_PORT", "6379"))
_REDIS_DB = int(os.getenv("CYRUS_REDIS_DB", "0"))

r = redis.Redis(host=_REDIS_HOST, port=_REDIS_PORT, db=_REDIS_DB, decode_responses=True)



def publish_event(event: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(event, dict):
        raise ValueError("event must be an object")

    def _publish() -> Dict[str, Any]:
        delivered = r.publish(CHANNEL, json.dumps(event))
        return {
            "status": "published",
            "channel": CHANNEL,
            "delivered": delivered,
        }

    result = safe_execute(_publish)
    if isinstance(result, dict) and result.get("error"):
        return {
            "status": "failed",
            "channel": CHANNEL,
            "error": result["error"],
        }

    return result



def subscribe_events(callback: Callable[[Dict[str, Any]], None]) -> None:
    if not callable(callback):
        raise ValueError("callback must be callable")

    while True:
        pubsub = r.pubsub(ignore_subscribe_messages=True)
        subscribe_result = safe_execute(lambda: pubsub.subscribe(CHANNEL))
        if isinstance(subscribe_result, dict) and subscribe_result.get("error"):
            time.sleep(1)
            continue

        for message in pubsub.listen():
            if message.get("type") != "message":
                continue

            parsed = safe_execute(lambda: json.loads(message.get("data", "{}")))
            if isinstance(parsed, dict) and parsed.get("error"):
                continue

            _ = safe_execute(lambda: callback(parsed))
