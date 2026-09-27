#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SELF = Path(__file__).resolve()

PATTERNS = [
    ("private key", re.compile(r"BEGIN (?:RSA|OPENSSH|EC|DSA|PRIVATE) PRIVATE KEY")),
    ("GitHub token", re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}")),
    ("hard-coded admin password", re.compile(r"\bADMIN_PASS(?:WORD)?\s*=\s*['\"][^'\"]+['\"]", re.I)),
    ("hard-coded Loyverse token", re.compile(r"\bLOYVERSE_TOKEN\s*=\s*['\"][^'\"]+['\"]", re.I)),
    ("Supabase service-role secret", re.compile(r"\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"][^'\"]+['\"]", re.I)),
    ("literal long bearer token", re.compile(r"Bearer\s+[A-Za-z0-9._~-]{32,}")),
]

EXTS = {".html",".js",".mjs",".cjs",".ts",".tsx",".py",".json",".yml",".yaml",".toml",".ini",".env"}

problems=[]
for path in ROOT.rglob("*"):
    if not path.is_file() or path.resolve() == SELF:
        continue
    if ".git" in path.parts or path.suffix.lower() not in EXTS:
        continue
    try:
        text=path.read_text(encoding="utf-8")
    except Exception:
        continue
    for name, pattern in PATTERNS:
        if pattern.search(text):
            problems.append(f"{path.relative_to(ROOT)}: potential {name}")

index=(ROOT/"index.html").read_text(encoding="utf-8")
if "/rest/v1/pedidos" in index:
    problems.append("index.html: direct anonymous pedidos REST insert is forbidden; use order-api")
if "ORDER_API_URL" not in index:
    problems.append("index.html: ORDER_API_URL missing")
if "escapeHtml(r.cliente" not in index:
    problems.append("index.html: admin order rendering is not explicitly escaping customer names")

if problems:
    print("SECURITY CHECK FAILED")
    for p in problems:
        print("-",p)
    sys.exit(1)

print("Security checks passed.")
