import json
import os
from datetime import datetime, timezone
from urllib import error, parse, request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
TABLE = "audit_log"


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


def _normalize_out(row, idx):
    created_at = str(row.get("created_at", ""))
    return {
        "id": int(row.get("id", idx + 1)),
        "createdAt": created_at,
        "eventType": str(row.get("event_type") or "unknown"),
        "actorUserId": str(row.get("actor_user_id") or "unknown"),
        "actorRole": str(row.get("actor_role") or "system"),
        "detail": str(row.get("detail") or ""),
        "approvalId": row.get("approval_id"),
        "approverUserId": row.get("approver_user_id"),
        "riskTier": row.get("risk_tier"),
        "confidenceScore": row.get("confidence_score"),
    }


def _op_list(limit: int):
    safe_limit = max(1, min(int(limit or 200), 1000))
    q = parse.urlencode(
        {
            "select": "*",
            "order": "created_at.desc",
            "limit": safe_limit,
        }
    )
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?{q}"
    rows = _http_json("GET", url, headers=_headers()) or []
    normalized = [_normalize_out(r, i) for i, r in enumerate(rows)]
    return {"ok": True, "rows": normalized}


def _op_insert(row):
    if not isinstance(row, dict):
        return {"ok": False, "error": "row must be an object"}
    payload = {
        "created_at": _to_iso(row.get("createdAt")),
        "event_type": str(row.get("eventType") or "unknown"),
        "actor_user_id": str(row.get("actorUserId") or "unknown"),
        "actor_role": str(row.get("actorRole") or "system"),
        "detail": str(row.get("detail") or ""),
        "approval_id": row.get("approvalId"),
        "approver_user_id": row.get("approverUserId"),
        "risk_tier": row.get("riskTier"),
        "confidence_score": row.get("confidenceScore"),
    }
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    _http_json("POST", url, payload=payload, headers=_headers("return=minimal"))
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
            result = _op_list(int(body.get("limit", 200)))
        elif op == "insert":
            result = _op_insert(body.get("row"))
        else:
            return _resp(400, {"ok": False, "error": "unsupported_op"})
        return _resp(200, result)
    except Exception as e:
        return _resp(500, {"ok": False, "error": str(e)})
