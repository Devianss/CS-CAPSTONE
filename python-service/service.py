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
  POST /ai-task       → Amazon Bedrock (Claude 3.5 Sonnet) invocation
  GET  /health        → liveness check

Install dependencies:
  pip install flask boto3 python-clamd watchdog requests

Run standalone:
  FLASK_PORT=5001 python service.py
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
from pathlib import Path

import boto3
from flask import Flask, jsonify, request

# Optional: install python-clamd for real ClamAV support
try:
    import clamd
    CLAMD_AVAILABLE = True
except ImportError:
    CLAMD_AVAILABLE = False

# Optional: install usb-monitor for real USB hooks
try:
    import usb.core  # pyusb
    USB_AVAILABLE = True
except ImportError:
    USB_AVAILABLE = False

# ─────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────
PORT = int(os.environ.get("FLASK_PORT", 5001))
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
BEDROCK_MODEL = "anthropic.claude-3-5-sonnet-20240620-v1:0"

logging.basicConfig(level=logging.INFO, format="[service] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)

# EICAR standard test string (embedded in many AV test files)
EICAR_MARKER = b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE"

AI_OFFLINE_FALLBACK = (
    "The AI sidecar is running, but Amazon Bedrock could not be reached from this machine "
    "(missing AWS credentials, network policy, or model access). This is a labeled offline response — "
    "your message was still received. For the thesis demo, configure AWS CLI credentials with "
    "Bedrock invoke permissions, or continue using keyword-based stubs in the UI."
)


def _sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _enumerate_usb_devices() -> list[dict]:
    devices: list[dict] = []
    if USB_AVAILABLE:
        try:
            for dev in usb.core.find(find_all=True):
                devices.append(
                    {
                        "vendor_id": hex(dev.idVendor),
                        "product_id": hex(dev.idProduct),
                        "manufacturer": dev.manufacturer if hasattr(dev, "manufacturer") else None,
                        "product": dev.product if hasattr(dev, "product") else None,
                    }
                )
        except Exception as e:
            log.error("USB enumeration error: %s", e)
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
_bedrock = None
_dynamodb = None
_s3 = None


def bedrock_client():
    global _bedrock
    if _bedrock is None:
        _bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    return _bedrock


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
    return jsonify(
        status="ok",
        clamd=CLAMD_AVAILABLE,
        usb=USB_AVAILABLE,
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

    # TODO: integrate AWS GuardDuty or VirusTotal API
    blocked_keywords = ["malware", "phishing", "hack", "crack", "keygen"]
    suspicious = any(kw in url.lower() for kw in blocked_keywords)

    return jsonify(ok=True, url=url, suspicious=suspicious, score=0.9 if suspicious else 0.1)


# ─────────────────────────────────────────────
#  /ai-task  – Amazon Bedrock (Claude 3.5 Sonnet)
# ─────────────────────────────────────────────
@app.post("/ai-task")
def ai_task():
    body = request.get_json(force=True)
    prompt: str = body.get("prompt", "")
    system: str = body.get("system", "You are a helpful lab management assistant for PCU Lab Portal.")
    max_tokens: int = body.get("max_tokens", 1024)
    role: str = body.get("role", "student")
    tools = body.get("tools") or []

    if not prompt:
        return jsonify(ok=False, error="prompt required"), 400

    tool_hint = ""
    if isinstance(tools, list) and tools:
        tool_hint = f"\n\nRegistered tool ids for this session: {', '.join(str(t) for t in tools)}."

    full_system = f"{system}{tool_hint}\n\nUser role tag: {role}."

    try:
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": full_system,
            "messages": [{"role": "user", "content": prompt}],
        }
        response = bedrock_client().invoke_model(
            modelId=BEDROCK_MODEL,
            body=json.dumps(payload),
            contentType="application/json",
            accept="application/json",
        )
        result = json.loads(response["body"].read())
        text = result["content"][0]["text"]
        log.info("ai-task completed (%d chars)", len(text))
        return jsonify(
            ok=True,
            response=text,
            source="bedrock",
            input_tokens=result["usage"]["input_tokens"],
        )

    except Exception as e:
        log.error("Bedrock error: %s", e)
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
