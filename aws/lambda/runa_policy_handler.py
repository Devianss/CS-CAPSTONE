import json
import os
from urllib import error, parse, request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
TABLE = "blocked_domains"


def _resp(status_code: int, body: dict):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def _ensure_config():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in Lambda env")


def _headers(prefer: str | None = None):
    h = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def _http_json(method: str, url: str, payload=None, headers=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, method=method.upper(), headers=headers or {})
    try:
        with request.urlopen(req, timeout=20) as r:
            raw = r.read().decode("utf-8") if r.length != 0 else ""
            return json.loads(raw) if raw else None
    except error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"supabase_http_{e.code}: {detail[:360]}")


def _parse_event_body(event):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64

        raw = base64.b64decode(raw).decode("utf-8")
    return json.loads(raw)


def _normalize_domain(raw):
    value = str(raw or "").strip().lower()
    if value.startswith("http://") or value.startswith("https://"):
        try:
            from urllib.parse import urlparse

            host = urlparse(value).hostname or ""
            value = host.lower()
        except Exception:
            pass
    if value.startswith("www."):
        value = value[4:]
    return value.split("/")[0]


def _op_list_domains():
    q = parse.urlencode({"select": "domain", "order": "created_at.desc"})
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?{q}"
    rows = _http_json("GET", url, headers=_headers()) or []
    domains = []
    seen = set()
    for row in rows:
        d = _normalize_domain(row.get("domain"))
        if d and d not in seen:
            seen.add(d)
            domains.append(d)
    return {"ok": True, "domains": domains}


def _op_upsert_domain(domain):
    d = _normalize_domain(domain)
    if not d:
        return {"ok": False, "error": "invalid_domain"}
    payload = {"domain": d}
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    _http_json(
        "POST",
        url,
        payload=payload,
        headers=_headers("resolution=merge-duplicates,return=minimal"),
    )
    return {"ok": True, "domain": d}


def lambda_handler(event, _context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    if method == "OPTIONS":
        return _resp(200, {"ok": True})
    try:
        _ensure_config()
        body = _parse_event_body(event)
        op = str(body.get("op", "")).strip()
        if op == "list_blocked_domains":
            result = _op_list_domains()
        elif op == "upsert_blocked_domain":
            result = _op_upsert_domain(body.get("domain"))
        else:
            return _resp(400, {"ok": False, "error": "unsupported_op"})
        return _resp(200, result)
    except Exception as e:
        return _resp(500, {"ok": False, "error": str(e)})
