"""
service.py  –  PCU Lab Portal Security & AI Microservice
=========================================================
Runs as a local HTTP server (localhost:5001).
Electron spawns this via child_process.spawn.

Endpoints
─────────
  POST /scan-file     → ClamAV file scan
  POST /scan-usb      → USB device enumeration + scan
  POST /analyze-url   → URL reputation check
  POST /ai-task       → Groq chat completion invocation
  GET  /health        → liveness check

Install dependencies:
  pip install flask groq boto3 python-clamd watchdog requests

Run standalone:
  FLASK_PORT=5001 python service.py
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

import boto3  # pyright: ignore[reportMissingImports]
from flask import Flask, jsonify, request
from groq import Groq  # pyright: ignore[reportMissingImports]

# Optional: install python-clamd for real ClamAV support
try:
    import clamd  # pyright: ignore[reportMissingImports]
    CLAMD_AVAILABLE = True
except ImportError:
    CLAMD_AVAILABLE = False

# Optional: install usb-monitor for real USB hooks
try:
    import usb.core  # pyright: ignore[reportMissingImports]  # pyusb
    import usb.backend.libusb1  # pyright: ignore[reportMissingImports]
    USB_AVAILABLE = True
except ImportError:
    USB_AVAILABLE = False

try:
    import libusb_package  # pyright: ignore[reportMissingImports]
except ImportError:
    libusb_package = None

# ─────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())

PORT = int(os.environ.get("FLASK_PORT", 5001))
AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-1")
AI_PROVIDER = os.environ.get("AI_PROVIDER", "groq")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
MAX_AI_PROMPT_CHARS = 8_000
MAX_HISTORY_TURNS = 24
MAX_GROQ_TOKENS = 2_048

logging.basicConfig(level=logging.INFO, format="[service] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)

# EICAR standard test string (embedded in many AV test files)
EICAR_MARKER = b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE"

AI_OFFLINE_FALLBACK = (
    "The AI sidecar is running, but the Groq service could not be reached from this machine "
    "(missing API key, network policy, or provider access). This is a labeled offline response — "
    "your message was still received. For the thesis demo, configure GROQ_API_KEY, "
    "or continue using keyword-based stubs in the UI."
)


def _sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _normalize_url(raw: str) -> tuple[str, str]:
    candidate = str(raw or "").strip()
    if not candidate:
        return "", ""
    if not re.match(r"^[a-z][a-z0-9+.-]*://", candidate, flags=re.I):
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return candidate, host


def _enumerate_usb_devices() -> list[dict]:
    devices: list[dict] = []
    if USB_AVAILABLE:
        backend = _get_usb_backend()
        if backend is None:
            return [
                {
                    "vendor_id": "0x0000",
                    "product_id": "0x0000",
                    "manufacturer": "Stub",
                    "product": "USB backend unavailable — install libusb backend/driver for live USB",
                }
            ]
        try:
            for dev in usb.core.find(find_all=True, backend=backend):
                devices.append(
                    {
                        "vendor_id": hex(dev.idVendor),
                        "product_id": hex(dev.idProduct),
                        "manufacturer": dev.manufacturer if hasattr(dev, "manufacturer") else None,
                        "product": dev.product if hasattr(dev, "product") else None,
                    }
                )
        except Exception as e:
            log.warning("USB enumeration fallback (%s)", e)
            devices = [
                {
                    "vendor_id": "0x0000",
                    "product_id": "0x0000",
                    "manufacturer": "Stub",
                    "product": "USB enumeration fallback active",
                }
            ]
    else:
        log.warning("pyusb not installed – returning stub USB list")
        devices = [
            {
                "vendor_id": "0x0000",
                "product_id": "0x0000",
                "manufacturer": "Stub",
                "product": "No pyusb — install pyusb for live USB",
            }
        ]
    return devices


# ─────────────────────────────────────────────
#  AWS clients (lazy-init so startup is fast)
# ─────────────────────────────────────────────
_groq_client = None
_dynamodb = None
_s3 = None
_usb_backend = None
_usb_backend_checked = False
_usb_backend_warned = False


def _get_usb_backend():
    """Resolve and cache pyusb backend once (Windows-friendly)."""
    global _usb_backend, _usb_backend_checked, _usb_backend_warned
    if _usb_backend_checked:
        return _usb_backend
    _usb_backend_checked = True
    if not USB_AVAILABLE:
        return None
    try:
        if libusb_package is not None:
            backend = usb.backend.libusb1.get_backend(
                find_library=lambda _name: libusb_package.find_library()
            )
        else:
            backend = usb.backend.libusb1.get_backend()
        _usb_backend = backend
        if backend is None and not _usb_backend_warned:
            log.warning("USB backend unavailable — using stub USB list")
            _usb_backend_warned = True
        return _usb_backend
    except Exception as e:
        if not _usb_backend_warned:
            log.warning("USB backend init failed (%s) — using stub USB list", e)
            _usb_backend_warned = True
        return None


def get_groq_client():
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    return _groq_client


def dynamodb_client():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb


# ─────────────────────────────────────────────
#  Health
# ─────────────────────────────────────────────
@app.get("/health")
def health():
    backend = _get_usb_backend() if USB_AVAILABLE else None
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    return jsonify(
        status="ok",
        clamd=CLAMD_AVAILABLE,
        usb=USB_AVAILABLE,
        usbBackendReady=backend is not None,
        aiProvider=AI_PROVIDER,
        groqConfigured=bool(groq_key),
        groqModel=GROQ_MODEL,
        timestamp=time.time(),
    )


# ─────────────────────────────────────────────
#  /scan-file  – ClamAV malware scanning
# ─────────────────────────────────────────────
@app.post("/scan-file")
def scan_file():
    body = request.get_json(force=True)
    file_path: str = body.get("path", "")
    p = Path(file_path)

    if not file_path or not p.is_file():
        return jsonify(ok=False, error="File not found"), 400

    try:
        with p.open("rb") as f:
            head = f.read(65536)
    except OSError as e:
        return jsonify(ok=False, error=str(e)), 400

    if EICAR_MARKER in head:
        sha256 = _sha256_file(p)
        log.info("scan-file EICAR test signature detected: %s", file_path)
        return jsonify(
            ok=True,
            clean=False,
            threat="EICAR-TEST-SIGNATURE",
            sha256=sha256,
            engine="builtin-eicar",
        )

    sha256 = _sha256_file(p)

    if CLAMD_AVAILABLE:
        try:
            cd = clamd.ClamdUnixSocket()  # or ClamdNetworkSocket("127.0.0.1", 3310)
            result = cd.scan(file_path)
            status = result.get(file_path, ("OK", ""))[0]
            threat = result.get(file_path, ("OK", ""))[1]
            clean = status == "OK"
        except Exception as e:
            log.error("ClamAV error: %s", e)
            clean, threat = True, None  # fallback: allow
    else:
        clean, threat = True, None
        log.warning("ClamAV not installed – returning stub result (file hashed)")

    log.info("scan-file %s → clean=%s", file_path, clean)
    return jsonify(ok=True, clean=clean, threat=threat, sha256=sha256, engine="clamd" if CLAMD_AVAILABLE else "stub")


# ─────────────────────────────────────────────
#  /usb-list (GET) + /scan-usb (POST) – USB enumeration
# ─────────────────────────────────────────────
@app.get("/usb-list")
def usb_list():
    devices = _enumerate_usb_devices()
    return jsonify(ok=True, devices=devices, count=len(devices))


@app.post("/scan-usb")
def scan_usb():
    devices = _enumerate_usb_devices()
    return jsonify(ok=True, devices=devices, count=len(devices))


# ─────────────────────────────────────────────
#  /analyze-url  – URL reputation (stub → extend with VirusTotal/GuardDuty)
# ─────────────────────────────────────────────
@app.post("/analyze-url")
def analyze_url():
    body = request.get_json(force=True)
    url: str = body.get("url", "")
    if not url:
        return jsonify(ok=False, error="url required"), 400

    normalized, domain = _normalize_url(url)
    if not domain:
        return jsonify(ok=False, error="invalid url"), 400

    blocked_keywords = ["malware", "phishing", "hack", "crack", "keygen", "trojan", "ransom"]
    text = f"{normalized} {domain}".lower()
    suspicious = any(kw in text for kw in blocked_keywords)
    score = 0.9 if suspicious else 0.1

    return jsonify(ok=True, url=normalized, domain=domain, suspicious=suspicious, score=score)


# ─────────────────────────────────────────────
#  /ai-task  – Groq (legacy history format compatibility)
# ─────────────────────────────────────────────
@app.post("/ai-task")
def ai_task():
    body = request.get_json(force=True)
    prompt: str = body.get("prompt", "")
    system_override: str = body.get("system", "")
    max_tokens: int = body.get("maxTokens", body.get("max_tokens", 1024))
    role: str = body.get("role", "student")
    tools = body.get("tools") or []
    history = body.get("history") or []
    temperature: float = body.get("temperature", 0.3)

    if not prompt:
        return jsonify(ok=False, error="prompt required"), 400
    if len(prompt) > MAX_AI_PROMPT_CHARS:
        return jsonify(ok=False, error=f"prompt too large (>{MAX_AI_PROMPT_CHARS} chars)"), 400

    if AI_PROVIDER.lower() != "groq":
        return jsonify(
            ok=True,
            response=AI_OFFLINE_FALLBACK,
            source="local_fallback",
            detail=f"Unsupported AI_PROVIDER={AI_PROVIDER!r}; expected 'groq'.",
        )

    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not groq_key:
        return jsonify(
            ok=True,
            response=AI_OFFLINE_FALLBACK,
            source="local_fallback",
            detail="Missing GROQ_API_KEY.",
        )

    role = "admin" if role == "admin" else "student"
    try:
        max_tokens = int(max_tokens)
    except Exception:
        max_tokens = 1024
    max_tokens = max(64, min(max_tokens, MAX_GROQ_TOKENS))
    try:
        temperature = float(temperature)
    except Exception:
        temperature = 0.3
    temperature = max(0.0, min(temperature, 1.0))

    if not system_override:
        system_override = (
            "You are Runa, a bounded assistant for CS students in the PCU lab."
            if role == "student"
            else "You are Runa, a bounded operational assistant for PCU lab administrators."
        )

    tool_hint = ""
    if isinstance(tools, list) and tools:
        tool_hint = f"\n\nTool ids for this session: {', '.join(str(t) for t in tools)}."

    full_system = f"{system_override}{tool_hint}\nrole: {role}."

    messages = []
    groq_messages = [{"role": "system", "content": full_system}]
    turns = history[-MAX_HISTORY_TURNS:] if isinstance(history, list) else []
    for h in turns:
        if isinstance(h, dict) and h.get("role") in ("user", "assistant"):
            content = h.get("content", [])
            if isinstance(content, str):
                content = [{"text": content}]
            if isinstance(content, list):
                messages.append({"role": h["role"], "content": content})
                normalized = " ".join(
                    block.get("text", "").strip()
                    for block in content
                    if isinstance(block, dict) and isinstance(block.get("text"), str)
                ).strip()
                if normalized:
                    groq_messages.append({"role": h["role"], "content": normalized})
    messages.append({"role": "user", "content": [{"text": prompt}]})
    groq_messages.append({"role": "user", "content": prompt})

    try:
        response = get_groq_client().chat.completions.create(
            model=GROQ_MODEL,
            messages=groq_messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        choice = response.choices[0] if response.choices else None
        text = ((choice.message.content if choice and choice.message else "") or "").strip()
        if not text:
            text = "No response content from model."
        usage = response.usage
        input_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        output_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        total_tokens = int(getattr(usage, "total_tokens", input_tokens + output_tokens) or 0)
        updated_history = messages + [{"role": "assistant", "content": [{"text": text}]}]
        log.info("ai-task completed (%d chars) via provider=groq model=%s", len(text), GROQ_MODEL)
        return jsonify(
            ok=True,
            response=text,
            source="groq",
            model=GROQ_MODEL,
            inputTokens=input_tokens,
            outputTokens=output_tokens,
            totalTokens=total_tokens,
            updatedHistory=updated_history,
        )
    except Exception as e:
        log.error("Groq error: %s", e)
        # Always return 200 so the Electron shell can render a labeled fallback during demos.
        return jsonify(
            ok=True,
            response=AI_OFFLINE_FALLBACK,
            source="local_fallback",
            detail=str(e)[:400],
        )


# ─────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    log.info("PCU Lab Portal service starting on port %d", PORT)
    app.run(host="127.0.0.1", port=PORT, debug=False, threaded=True)
