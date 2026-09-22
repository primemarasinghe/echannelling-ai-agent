"""Sliding-window rate limiter keyed on BOTH session_key and client IP.

Whichever limit trips first raises 429, so a client cannot bypass the limit
by rotating session keys. Behind nginx, IP is read from X-Real-IP (set by
nginx to $remote_addr — not client-controllable). Falls back to
request.client.host for direct connections. Backend port is bound to
127.0.0.1 only, so direct connections are local-only.
Not persistent across restarts — fine for a prototype.
"""
from collections import defaultdict, deque
from time import time

from fastapi import HTTPException, Request


class _Window:
    def __init__(self, max_calls: int, period: float):
        self.max_calls = max_calls
        self.period = period
        self._calls: dict[str, deque] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time()
        q = self._calls[key]
        while q and now - q[0] > self.period:
            q.popleft()
        if len(q) >= self.max_calls:
            retry_after = int(self.period - (now - q[0])) + 1
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "RATE_LIMITED",
                    "message": (
                        f"Too many messages — you've reached the limit of "
                        f"{self.max_calls} per {int(self.period)}s. "
                        f"Please wait a moment before sending again."
                    ),
                    "retry_after": retry_after,
                },
            )
        q.append(now)


_minute = _Window(max_calls=10,  period=60)
_hour   = _Window(max_calls=100, period=3600)


def _client_ip(request: Request) -> str:
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return (request.client.host if request.client else None) or "unknown"


def rate_limit(request: Request) -> None:
    """FastAPI dependency — raises 429 when either window is exceeded."""
    session_key = (
        request.headers.get("X-Session-Key")
        or (request.client.host if request.client else None)
        or "anon"
    )
    ip = _client_ip(request)
    for key in (session_key, ip):
        _minute.check(key)
        _hour.check(key)


def check(session_key: str, request: Request | None = None) -> None:
    """Call directly from the chat router with the parsed session_key and request."""
    _minute.check(session_key)
    _hour.check(session_key)
    if request is not None:
        ip = _client_ip(request)
        _minute.check(ip)
        _hour.check(ip)
