import json
import os
from datetime import datetime, timezone
from urllib import error, parse, request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
TABLE = "approval_requests"


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


def _to_iso(v):
    if isinstance(v, (int, float)):
        return datetime.fromtimestamp(v / 1000.0, tz=timezone.utc).isoformat()
    if isinstance(v, str) and v:
        return v
    return datetime.now(timezone.utc).isoformat()


def _normalize_out(row):
    created_at = str(row.get("created_at", ""))
    return {
        "id": str(row.get("id", "")),
        "createdAt": created_at,
        "requesterId": str(row.get("requester_id", "")),
        "requesterRole": "admin" if row.get("requester_role") == "admin" else "student",
        "action": row.get("action") or {},
        "riskTier": str(row.get("risk_tier") or "high"),
        "evidence": row.get("evidence"),
        "status": str(row.get("status") or "pending"),
        "decision": row.get("decision"),
        "comments": row.get("comments"),
    }


def _op_list(limit: int):
    safe_limit = max(1, min(int(limit or 100), 500))
    q = parse.urlencode(
        {
            "select": "*",
            "order": "created_at.desc",
            "limit": safe_limit,
        }
    )
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?{q}"
    rows = _http_json("GET", url, headers=_headers()) or []
    normalized = [_normalize_out(r) for r in rows]
    return {"ok": True, "rows": normalized}


def _op_upsert(rows):
    if not isinstance(rows, list):
        return {"ok": False, "error": "rows must be an array"}
    payload = []
    for r in rows[-500:]:
        if not isinstance(r, dict):
            continue
        payload.append(
            {
                "id": str(r.get("id", "")),
                "created_at": _to_iso(r.get("createdAt")),
                "requester_id": str(r.get("requesterId", "")),
                "requester_role": "admin" if r.get("requesterRole") == "admin" else "student",
                "action": r.get("action") or {},
                "risk_tier": str(r.get("riskTier") or "high"),
                "evidence": r.get("evidence"),
                "status": str(r.get("status") or "pending"),
                "decision": r.get("decision"),
                "comments": r.get("comments"),
            }
        )
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    _http_json(
        "POST",
        url,
        payload=payload,
        headers=_headers("resolution=merge-duplicates,return=minimal"),
    )
    return {"ok": True}


def lambda_handler(event, _context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    if method == "OPTIONS":
        return _resp(200, {"ok": True})
    try:
        _ensure_config()
        body = _parse_event_body(event)
        op = str(body.get("op", "")).strip()
        if op == "list":
            result = _op_list(int(body.get("limit", 100)))
        elif op == "upsert":
            result = _op_upsert(body.get("rows"))
        else:
            return _resp(400, {"ok": False, "error": "unsupported_op"})
        return _resp(200, result)
    except Exception as e:
        return _resp(500, {"ok": False, "error": str(e)})
