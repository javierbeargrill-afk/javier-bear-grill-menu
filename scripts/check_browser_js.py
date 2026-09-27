#!/usr/bin/env python3
import re
import subprocess
import tempfile
from pathlib import Path

html = Path("index.html").read_text(encoding="utf-8")
scripts=[]
for attrs, body in re.findall(r"<script([^>]*)>([\s\S]*?)</script>", html, re.I):
    if "application/ld+json" in attrs.lower():
        continue
    if body.strip():
        scripts.append(body)

with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as tmp:
    tmp.write("\n".join(scripts))
    name=tmp.name
subprocess.run(["node","--check",name],check=True)
print("Browser JavaScript syntax OK.")
