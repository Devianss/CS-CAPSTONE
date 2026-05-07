#!/usr/bin/env python3
"""
Upload markdown files from ./knowledge/ into Supabase runa_knowledge_chunks.

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Usage (from repo root):
  set SUPABASE_URL=...
  set SUPABASE_SERVICE_ROLE_KEY=...
  python scripts/seed_knowledge_base.py

If those are not set, the script loads a `.env` file from the repo root when present
(keys already in the environment take precedence).

Deletes existing rows (id >= 0) then inserts fresh chunks from *.md (visibility: both).
For role-specific chunks, name files like `topic.admin.md` or `topic.student.md`:
  optional suffix before .md sets visibility.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from urllib import error, request

ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_DIR = ROOT / "knowledge"
TABLE = "runa_knowledge_chunks"
MAX_CHARS = 1200


def load_dotenv_repo_root() -> None:
    """Populate os.environ from repo-root `.env` if missing (no extra deps)."""
    path = ROOT / ".env"
    if not path.is_file():
        return
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return
    for line in raw.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue
        idx = trimmed.find("=")
        if idx <= 0:
            continue
        key = trimmed[:idx].strip()
        val = trimmed[idx + 1 :].strip().strip('"').strip("'")
        if key and os.environ.get(key) is None:
            os.environ[key] = val


def visibility_for_path(p: Path) -> str:
    stem = p.stem.lower()
    if stem.endswith(".admin"):
        return "admin"
    if stem.endswith(".student"):
        return "student"
    return "both"


def chunk_markdown(text: str, source: str) -> list[tuple[int, str, str]]:
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return []
    parts = re.split(r"(?=^## )", text, flags=re.MULTILINE)
    out: list[tuple[int, str, str]] = []
    idx = 0
    for part in parts:
        block = part.strip()
        if not block:
            continue
        title = source
        m = re.match(r"^##\s+(.+)$", block.split("\n", 1)[0].strip())
        first_line = block.split("\n", 1)[0].strip()
        if m:
            title = m.group(1).strip()[:200]
        elif first_line.startswith("#"):
            title = first_line.lstrip("#").strip()[:200]
        body = block if len(block) <= MAX_CHARS else block[: MAX_CHARS - 20] + "\n… (truncated)"
        out.append((idx, title, body))
        idx += 1
    return out


def main() -> int:
    load_dotenv_repo_root()
    base = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base or not key:
        print(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n"
            "  Set them in your shell, or add them to a .env file in the repo root:\n"
            "    SUPABASE_URL=https://<project>.supabase.co\n"
            "    SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt>\n"
            "  (Dashboard: Project Settings → API.)",
            file=sys.stderr,
        )
        return 1

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    delete_url = f"{base}/rest/v1/{TABLE}?id=gte.0"
    try:
        req = request.Request(delete_url, method="DELETE", headers=headers)
        request.urlopen(req, timeout=30)
    except error.HTTPError as e:
        print(f"DELETE warning ({e.code}); table may be empty.", file=sys.stderr)

    rows: list[dict] = []
    if not KNOWLEDGE_DIR.is_dir():
        print(f"No {KNOWLEDGE_DIR} directory", file=sys.stderr)
        return 1

    for md in sorted(KNOWLEDGE_DIR.glob("*.md")):
        vis = visibility_for_path(md)
        raw = md.read_text(encoding="utf-8")
        display_source = md.name
        source_stem = re.sub(r"\.(admin|student)$", "", md.stem, flags=re.I)
        for chunk_index, title, content in chunk_markdown(raw, source_stem):
            rows.append(
                {
                    "source": display_source,
                    "title": title,
                    "content": content,
                    "chunk_index": chunk_index,
                    "visibility": vis,
                }
            )

    if not rows:
        print("No chunks produced.", file=sys.stderr)
        return 1

    insert_url = f"{base}/rest/v1/{TABLE}"
    req = request.Request(
        insert_url,
        data=json.dumps(rows).encode("utf-8"),
        method="POST",
        headers={**headers, "Prefer": "return=minimal"},
    )
    try:
        request.urlopen(req, timeout=60)
    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        print(f"Insert failed: {e.code} {body[:500]}", file=sys.stderr)
        return 1

    print(f"Inserted {len(rows)} chunk(s) into {TABLE}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
