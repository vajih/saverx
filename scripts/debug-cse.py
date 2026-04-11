#!/usr/bin/env python3
import json, os, pathlib, ssl, urllib.request, urllib.parse

try:
    import certifi

    ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ctx = ssl.create_default_context()

env = pathlib.Path(__file__).parent.parent / ".env"
for line in env.read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

key = os.environ.get("GOOGLE_CSE_KEY", "")
cx = os.environ.get("GOOGLE_CSE_CX", "")
print("KEY:", key[:10] + "..." if key else "MISSING")
print("CX :", cx if cx else "MISSING")

query = "Abilify Maintena medication drug"
url = (
    "https://www.googleapis.com/customsearch/v1"
    f"?key={key}&cx={cx}&q={urllib.parse.quote(query)}"
    "&searchType=image&imgType=photo&num=5&safe=active"
)
req = urllib.request.Request(url, headers={"User-Agent": "SaveRx/1.0"})
try:
    with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
        data = json.loads(r.read())
    items = data.get("items", [])
    print(f"Results: {len(items)}")
    for it in items:
        print(" -", it.get("link", ""))
    if not items:
        print("Keys:", list(data.keys()))
        if "error" in data:
            print("ERROR:", json.dumps(data["error"], indent=2))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.reason)
    print("Body:", e.read().decode()[:500])
except Exception as e:
    print("Exception:", e)
