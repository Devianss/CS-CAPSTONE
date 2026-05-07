"""
Read recent Chrome history (Windows) and detect visits to blocked domains.

Chrome locks the History SQLite file while running. We copy it to a temp path
and open read-only, best-effort.
"""

from __future__ import annotations

import logging
import os
import shutil
import sqlite3
import tempfile
from pathlib import Path
from urllib.parse import urlparse

log = logging.getLogger(__name__)


def _normalize_host(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    try:
        host = (urlparse(raw).hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return ""


def _host_matches_blocked(host: str, blocked_norm: list[str]) -> str | None:
    h = host.lower().replace("www.", "", 1) if host.startswith("www.") else host.lower()
    for b in blocked_norm:
        if h == b or h.endswith("." + b):
            return b
    return None


def _chrome_history_path() -> Path | None:
    if os.name != "nt":
        return None
    local = os.environ.get("LOCALAPPDATA", "").strip()
    if not local:
        return None
    p = Path(local) / "Google" / "Chrome" / "User Data" / "Default" / "History"
    if p.is_file():
        return p
    return None


def check_blocked_chrome_visits(
    blocked_domains: list[str],
    max_visits: int = 50,
) -> dict:
    """
    Returns { ok, violations: [{ url, host, matchedBlocked }], error?, detail? }
    """
    blocked_norm = [_normalize_host(d) or str(d).lower().strip() for d in blocked_domains if str(d).strip()]
    blocked_norm = [b for b in blocked_norm if b]

    if not blocked_norm:
        return {"ok": True, "violations": [], "detail": "no_blocked_domains"}

    hist = _chrome_history_path()
    if hist is None:
        return {"ok": True, "violations": [], "detail": "chrome_history_unavailable"}

    tmp_path = None
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix="_chrome_history")
        tmp_path = tmp.name
        tmp.close()
        shutil.copyfile(hist, tmp_path)
    except OSError as e:
        log.warning("chrome history copy failed (%s)", e)
        return {"ok": True, "violations": [], "detail": f"history_copy_failed: {e}"}

    violations: list[dict] = []
    seen: set[tuple[str, str]] = set()
    try:
        conn = sqlite3.connect(tmp_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT u.url
                FROM urls u
                INNER JOIN visits v ON u.id = v.url
                ORDER BY v.visit_time DESC
                LIMIT ?
                """,
                (max_visits,),
            )
            for (url_row,) in cur.fetchall():
                url = str(url_row or "")
                host = _normalize_host(url)
                if not host:
                    continue
                matched = _host_matches_blocked(host, blocked_norm)
                if matched:
                    key = (host, matched)
                    if key not in seen:
                        seen.add(key)
                        violations.append({"url": url[:2048], "host": host, "matchedBlocked": matched})
        finally:
            conn.close()
    except sqlite3.Error as e:
        log.warning("chrome history sqlite error (%s)", e)
        return {"ok": False, "violations": [], "error": str(e)}
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return {"ok": True, "violations": violations}
