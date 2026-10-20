"""Verify deployed EduNizam homepage contains its configured Ahrefs Web Analytics tag."""

from __future__ import annotations

from html import unescape
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = "https://edunizam.online/"
SCRIPT_URL = "https://analytics.ahrefs.com/analytics.js"
source = Path("index.html").read_text(encoding="utf-8")
source_tags = re.findall(r"<script\\b[^>]*>", source, re.I)
source_matches = [
    tag for tag in source_tags
    if (m := re.search(r'\\bsrc=["\\']([^"\\']+)["\\']', tag, re.I))
    and m.group(1) == SCRIPT_URL
]
if len(source_matches) != 1:
    raise SystemExit("FAIL: repository homepage must contain exactly one Ahrefs analytics script")
source_key = re.search(r'\\bdata-key=["\\']([^"\\']+)["\\']', source_matches[0], re.I)
if not source_key:
    raise SystemExit("FAIL: repository Ahrefs script has no data-key")

request = Request(
    BASE,
    headers={
        "User-Agent": "EduNizamAhrefsVerification/1.0",
        "Cache-Control": "no-cache",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    },
)
try:
    with urlopen(request, timeout=25) as response:
        if response.status != 200:
            raise SystemExit(f"FAIL: live homepage returned HTTP {response.status}")
        live_html = unescape(response.read().decode("utf-8", errors="replace"))
except (HTTPError, URLError, TimeoutError, OSError) as exc:
    raise SystemExit(f"FAIL: live homepage could not be fetched: {type(exc).__name__}") from exc

live_tags = re.findall(r"<script\\b[^>]*>", live_html, re.I)
live_matches = [
    tag for tag in live_tags
    if (m := re.search(r'\\bsrc=["\\']([^"\\']+)["\\']', tag, re.I))
    and m.group(1) == SCRIPT_URL
]
if len(live_matches) != 1:
    raise SystemExit(f"FAIL: live homepage must contain exactly one Ahrefs script; found {len(live_matches)}")
live_key = re.search(r'\\bdata-key=["\\']([^"\\']+)["\\']', live_matches[0], re.I)
if not live_key or live_key.group(1) != source_key.group(1):
    raise SystemExit("FAIL: live Ahrefs data-key does not match repository configuration")

print("PASS: edunizam.online serves exactly one Ahrefs Web Analytics script")
print("PASS: deployed data-key matches repository configuration (key redacted)")
print("EDUNIZAM AHREFS LIVE VERIFICATION PASSED")
