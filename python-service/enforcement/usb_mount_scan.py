"""
USB removable-drive quick scan (Windows): first-level files, EICAR / hash heuristics.
"""

from __future__ import annotations

import hashlib
import logging
import os
import string
from pathlib import Path

log = logging.getLogger(__name__)

EICAR_MARKER = b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE"
MAX_FILE_BYTES = 4 * 1024 * 1024
MAX_FILES_PER_ROOT = 64


def _removable_roots_windows() -> list[str]:
    if os.name != "nt":
        return []
    try:
        import ctypes
    except ImportError:
        return []

    DRIVE_REMOVABLE = 2
    drives: list[str] = []
    bitmask = ctypes.windll.kernel32.GetLogicalDrives()
    for i, letter in enumerate(string.ascii_uppercase):
        if bitmask & (1 << i):
            root = f"{letter}:\\"
            try:
                if ctypes.windll.kernel32.GetDriveTypeW(root) == DRIVE_REMOVABLE:
                    drives.append(root.rstrip("\\"))
            except Exception:
                continue
    return drives


def _sha256_head(p: Path, max_bytes: int = 65536) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        h.update(f.read(max_bytes))
    return h.hexdigest()


def scan_removable_mounts() -> dict:
    """
    Returns {
      ok, roots, filesScanned, threats: [{path, kind, detail}],
      suspiciousCount, clean
    }
    """
    roots = _removable_roots_windows()
    files_scanned = 0
    threats: list[dict] = []

    for root in roots:
        base = Path(root)
        if not base.exists():
            continue
        try:
            for entry in base.iterdir():
                if files_scanned >= MAX_FILES_PER_ROOT:
                    break
                if entry.is_file():
                    files_scanned += 1
                    try:
                        if entry.stat().st_size > MAX_FILE_BYTES:
                            continue
                        head = entry.read_bytes()[:65536]
                    except OSError:
                        continue
                    if EICAR_MARKER in head:
                        threats.append(
                            {
                                "path": str(entry),
                                "kind": "eicar_test_signature",
                                "detail": "EICAR marker in removable media file",
                            }
                        )
        except OSError as e:
            log.warning("usb scan listdir failed %s (%s)", root, e)

    suspicious = len(threats)
    return {
        "ok": True,
        "roots": roots,
        "filesScanned": files_scanned,
        "threats": threats,
        "suspiciousCount": suspicious,
        "clean": suspicious == 0,
    }
