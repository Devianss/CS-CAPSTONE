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

    if not file_path or not Path(file_path).exists():
        return jsonify(ok=False, error="File not found"), 400

    # File hash (always computed)
    sha256 = hashlib.sha256(Path(file_path).read_bytes()).hexdigest()

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
        # Stub: always clean in dev
        clean, threat = True, None
        log.warning("ClamAV not installed – returning stub result")

    log.info("scan-file %s → clean=%s", file_path, clean)
    return jsonify(ok=True, clean=clean, threat=threat, sha256=sha256)


# ─────────────────────────────────────────────
#  /scan-usb  – USB device enumeration
# ─────────────────────────────────────────────
@app.post("/scan-usb")
def scan_usb():
    devices = []
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
        devices = [{"vendor_id": "0x0000", "product_id": "0x0000", "manufacturer": "Stub", "product": "StubDevice"}]

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

    if not prompt:
        return jsonify(ok=False, error="prompt required"), 400

    try:
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": system,
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
        return jsonify(ok=True, response=text, input_tokens=result["usage"]["input_tokens"])

    except Exception as e:
        log.error("Bedrock error: %s", e)
        return jsonify(ok=False, error=str(e)), 500


# ─────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    log.info("PCU Lab Portal service starting on port %d", PORT)
    app.run(host="127.0.0.1", port=PORT, debug=False, threaded=True)
