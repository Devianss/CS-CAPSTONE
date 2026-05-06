import json
import logging
import os
from urllib import error, request

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
DEMO_SHARED_TOKEN = os.environ.get("DEMO_SHARED_TOKEN", "").strip()
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MAX_HISTORY_TURNS = 24

logging.basicConfig(level=logging.INFO, format="[runa-ai-task] %(message)s")
log = logging.getLogger(__name__)


def _resp(status_code: int, body: dict):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "content-type,x-api-key",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def _normalize_history(history):
    messages = []
    turns = history[-MAX_HISTORY_TURNS:] if isinstance(history, list) else []
    for item in turns:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        if role not in ("user", "assistant"):
            continue
        content = item.get("content", [])
        if isinstance(content, str):
            normalized = content.strip()
        elif isinstance(content, list):
            normalized = " ".join(
                block.get("text", "").strip()
                for block in content
                if isinstance(block, dict) and isinstance(block.get("text"), str)
            ).strip()
        else:
            normalized = ""
        if normalized:
            messages.append({"role": role, "content": normalized})
    return messages


def lambda_handler(event, _context):
    request_id = getattr(_context, "aws_request_id", "unknown")
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    log.info("request_start request_id=%s method=%s", request_id, method)
    if method == "OPTIONS":
        log.info("request_options request_id=%s", request_id)
        return _resp(200, {"ok": True})

    headers = event.get("headers") or {}
    incoming_key = headers.get("x-api-key") or headers.get("X-Api-Key") or ""
    if DEMO_SHARED_TOKEN and incoming_key != DEMO_SHARED_TOKEN:
        log.warning("request_unauthorized request_id=%s", request_id)
        return _resp(401, {"ok": False, "error": "unauthorized"})

    if not GROQ_API_KEY:
        log.error("missing_groq_api_key request_id=%s", request_id)
        return _resp(500, {"ok": False, "error": "missing GROQ_API_KEY"})

    try:
        raw_body = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            import base64

            raw_body = base64.b64decode(raw_body).decode("utf-8")
        body = json.loads(raw_body)
    except Exception:
        log.exception("invalid_json request_id=%s", request_id)
        return _resp(400, {"ok": False, "error": "invalid_json"})

    prompt = str(body.get("prompt", "")).strip()
    role = "admin" if body.get("role") == "admin" else "student"
    system = str(body.get("system", "")).strip()
    tools = body.get("tools") if isinstance(body.get("tools"), list) else []
    history = body.get("history") if isinstance(body.get("history"), list) else []
    max_tokens = int(body.get("maxTokens", 1024) or 1024)
    temperature = float(body.get("temperature", 0.3) or 0.3)

    if not prompt:
        log.warning("prompt_required request_id=%s", request_id)
        return _resp(400, {"ok": False, "error": "prompt_required"})
    log.info(
        "request_validated request_id=%s role=%s prompt_len=%d history_turns=%d",
        request_id,
        role,
        len(prompt),
        len(history) if isinstance(history, list) else 0,
    )

    if not system:
        system = (
            "You are Runa, a bounded assistant for CS students in the PCU lab."
            if role == "student"
            else "You are Runa, a bounded operational assistant for PCU lab administrators."
        )

    tool_hint = ""
    if tools:
        tool_hint = f"\n\nTool ids for this session: {', '.join(str(t) for t in tools)}."
    full_system = f"{system}{tool_hint}\nrole: {role}."

    groq_messages = [{"role": "system", "content": full_system}]
    groq_messages.extend(_normalize_history(history))
    groq_messages.append({"role": "user", "content": prompt})

    try:
        payload = {
            "model": GROQ_MODEL,
            "messages": groq_messages,
            "max_tokens": max(64, min(max_tokens, 2048)),
            "temperature": max(0.0, min(temperature, 1.0)),
        }
        req = request.Request(
            GROQ_URL,
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "runa-ai-lambda/1.0",
            },
        )
        try:
            with request.urlopen(req, timeout=20) as res:
                raw = res.read().decode("utf-8")
                data = json.loads(raw) if raw else {}
        except error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="ignore")
            response_headers = dict(e.headers.items()) if e.headers else {}
            log.error(
                "groq_http_error request_id=%s status=%s headers=%s detail=%s",
                request_id,
                e.code,
                json.dumps(
                    {
                        "cf-ray": response_headers.get("cf-ray"),
                        "server": response_headers.get("server"),
                        "content-type": response_headers.get("content-type"),
                    }
                ),
                detail[:360],
            )
            raise RuntimeError(f"groq_http_{e.code}: {detail[:360]}")

        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        text = (message.get("content") or "").strip() or "No response content from model."

        usage = data.get("usage") or {}
        input_tokens = int(usage.get("prompt_tokens", 0) or 0)
        output_tokens = int(usage.get("completion_tokens", 0) or 0)
        total_tokens = int(usage.get("total_tokens", input_tokens + output_tokens) or 0)

        updated_history = history + [
            {"role": "user", "content": [{"text": prompt}]},
            {"role": "assistant", "content": [{"text": text}]},
        ]
        log.info(
            "request_success request_id=%s model=%s response_len=%d input_tokens=%d output_tokens=%d",
            request_id,
            GROQ_MODEL,
            len(text),
            input_tokens,
            output_tokens,
        )

        return _resp(
            200,
            {
                "ok": True,
                "response": text,
                "source": "lambda",
                "model": GROQ_MODEL,
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "totalTokens": total_tokens,
                "updatedHistory": updated_history,
            },
        )
    except Exception as exc:
        log.exception("request_fallback request_id=%s error=%s", request_id, str(exc))
        return _resp(
            200,
            {
                "ok": True,
                "response": (
                    "The AI sidecar is running, but the cloud AI provider could not be reached. "
                    "This is a labeled offline response."
                ),
                "source": "local_fallback",
                "detail": str(exc)[:400],
            },
        )
