"""
Build a self-contained single HTML file from the Vite dashboard.

Runs `npm run build`, then:
  - Reads dist/index.html
  - Inlines all linked CSS and JS bundles
  - Injects a fetch() shim that serves the JSON data files from inline
    window variables, so the file works when opened from disk (file://)

Run from the dashboard/ directory:
    python scripts/build_standalone.py

Output: standalone.html  (in dashboard/)
"""

import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent.parent  # dashboard/
DIST = HERE / "dist"
DATA = HERE / "public" / "data"
OUTPUT = HERE / "standalone.html"

DATA_FILES = [
    "whisker_data.json",
    "ns_factors_data.json",
    "real_rates_data.json",
    "bei_data.json",
]


def build():
    print("Running npm run build...")
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=HERE,
        shell=True,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        sys.exit(1)
    print("Build complete.")


def load_data():
    data = {}
    for fname in DATA_FILES:
        path = DATA / fname
        if not path.exists():
            print(f"WARNING: {path} not found — skipping.")
            continue
        with open(path, encoding="utf-8") as f:
            data[fname] = json.load(f)
        print(f"  Loaded {fname} ({path.stat().st_size // 1024} KB)")
    return data


def make_fetch_shim(data):
    """
    Inline the data as a window global and override fetch() so that any
    request whose URL ends in one of the known filenames is served from
    memory.  All other fetch calls fall through to the real implementation.
    """
    payload = json.dumps(data, separators=(",", ":"))
    return f"""\
<script>
(function(){{
  var _d={payload};
  var _f=window.fetch;
  window.fetch=function(url){{
    var key=String(url).split('/').pop().split('?')[0];
    if(_d[key]){{
      return Promise.resolve({{
        ok:true,
        json:function(){{return Promise.resolve(_d[key]);}}
      }});
    }}
    return _f.apply(this,arguments);
  }};
}})();
</script>"""


def inline_assets(html, dist):
    # Inline <link rel="stylesheet" href="...">
    def inline_css(m):
        href = m.group(1)
        css_path = dist / href.lstrip("/")
        if css_path.exists():
            css = css_path.read_text(encoding="utf-8")
            return f"<style>{css}</style>"
        return m.group(0)

    html = re.sub(
        r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\'][^>]*/?>',
        inline_css,
        html,
    )

    # Inline <script type="module" src="...">
    # Keep type="module" on the inline tag: inline module scripts are deferred
    # (so document.getElementById("root") resolves) and work fine on file://.
    # Only *external* module scripts are blocked by CORS on file://.
    def inline_js(m):
        src = m.group(1)
        js_path = dist / src.lstrip("/")
        if js_path.exists():
            js = js_path.read_text(encoding="utf-8")
            return f'<script type="module">{js}</script>'
        return m.group(0)

    html = re.sub(
        r'<script\s[^>]*type=["\']module["\'][^>]*\bsrc=["\']([^"\']+)["\'][^>]*></script>',
        inline_js,
        html,
    )
    # Also catch reversed attribute order (src before type)
    html = re.sub(
        r'<script\s[^>]*\bsrc=["\']([^"\']+)["\'][^>]*type=["\']module["\'][^>]*></script>',
        inline_js,
        html,
    )

    return html


def main():
    build()

    html = (DIST / "index.html").read_text(encoding="utf-8")

    print("Loading data files...")
    data = load_data()

    print("Inlining assets...")
    html = inline_assets(html, DIST)

    shim = make_fetch_shim(data)
    html = html.replace("<head>", "<head>\n" + shim, 1)

    OUTPUT.write_text(html, encoding="utf-8")
    size_kb = OUTPUT.stat().st_size // 1024
    print(f"\nDone: {OUTPUT}  ({size_kb} KB)")


if __name__ == "__main__":
    main()
