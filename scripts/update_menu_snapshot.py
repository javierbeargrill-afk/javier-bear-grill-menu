#!/usr/bin/env python3
import html
import json
import re
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_local_pages import build_pages, ORIGIN

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SUPABASE_URL = "https://uazonbacmpwuznugirru.supabase.co"

def api_get(path, anon_key):
    req = urllib.request.Request(
        SUPABASE_URL + path,
        headers={
            "apikey": anon_key,
            "Authorization": "Bearer " + anon_key,
            "Accept": "application/json",
            "User-Agent": "JBG-menu-snapshot/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))

def esc(value):
    return html.escape(str(value or ""), quote=True)

def render_snapshot(menu, hidden):
    out = []
    product_index = 0
    for cat in menu:
        items = [x for x in (cat.get("i") or []) if x.get("n") not in hidden]
        if not items:
            continue
        cat_name = str(cat.get("n") or "Menú")
        out.append(f'  <div class="category-block" data-cat="{esc(cat_name)}">')
        out.append(f'    <div class="category-toggle">{esc(cat_name)}</div>')
        out.append('    <div class="cat-scroll">')
        for item in items:
            name = str(item.get("n") or "")
            desc = str(item.get("d") or "")
            price = float(item.get("p") or 0)
            image = item.get("img")
            badge = item.get("badge")
            loading = "eager" if product_index < 4 else "lazy"
            product_index += 1
            out.append('      <article class="card" itemscope itemtype="https://schema.org/MenuItem">')
            if image:
                out.append('        <div class="card-img-wrap">')
                out.append(
                    f'          <img class="card-img loaded" src="{esc(image)}" alt="{esc(name)}" '
                    f'loading="{loading}" decoding="async" itemprop="image">'
                )
                out.append('        </div>')
            else:
                out.append('        <div class="card-img-wrap no-img"><div class="card-no-img">🍔</div></div>')
            out.append('        <div class="card-body">')
            if badge:
                css = "estrella" if "estrella" in str(badge).lower() else "popular"
                out.append(f'          <span class="item-badge {css}">{esc(badge)}</span>')
            out.append(f'          <span class="card-name" itemprop="name">{esc(name)}</span>')
            if desc:
                out.append(f'          <span class="card-desc" itemprop="description">{esc(desc)}</span>')
            out.append('        </div>')
            out.append('        <div class="card-footer" itemprop="offers" itemscope itemtype="https://schema.org/Offer">')
            out.append('          <meta itemprop="priceCurrency" content="PAB">')
            out.append('          <link itemprop="availability" href="https://schema.org/InStock">')
            out.append(f'          <span class="card-price" itemprop="price" content="{price:.2f}">&#36;{price:.2f}</span>')
            out.append('        </div>')
            out.append('      </article>')
        out.append('    </div>')
        out.append('  </div>')
    if not out:
        return '  <div id="loadingMsg"><span class="spinner"></span>Cargando menú...</div>'
    return "\n".join(out)

def render_menu_schema(menu, hidden):
    sections = []
    for cat in menu:
        items = []
        for item in cat.get("i") or []:
            if item.get("n") in hidden:
                continue
            entry = {
                "@type": "MenuItem", "name": str(item.get("n") or ""),
                "offers": {"@type": "Offer", "priceCurrency": "PAB",
                           "price": f'{float(item.get("p") or 0):.2f}',
                           "availability": "https://schema.org/InStock",
                           "url": "https://menujaviergrill.store/"},
            }
            if item.get("d"):
                entry["description"] = item["d"]
            if item.get("img"):
                entry["image"] = item["img"]
            items.append(entry)
        if items:
            sections.append({"@type": "MenuSection", "name": str(cat.get("n") or "Menú"),
                             "hasMenuItem": items})
    data = {"@context": "https://schema.org", "@type": "Menu",
            "@id": "https://menujaviergrill.store/#menu",
            "name": "Menú oficial de Javier Bear Grill", "url": "https://menujaviergrill.store/",
            "hasMenuSection": sections}
    # JSON inside a script element must never contain a literal closing tag.
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")

def update_documents(source, menu, hidden):
    start, end = "<!-- MENU_SNAPSHOT_START -->", "<!-- MENU_SNAPSHOT_END -->"
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    replacement = start + "\n" + render_snapshot(menu, hidden) + "\n" + end
    updated, count = pattern.subn(lambda _: replacement, source, count=1)
    if count != 1:
        raise ValueError("No se encontraron los marcadores MENU_SNAPSHOT en index.html")
    updated, count = re.subn(r'(<script id="menuJsonLd" type="application/ld\+json">).*?(</script>)',
                             lambda m: m[1] + render_menu_schema(menu, hidden) + m[2], updated, count=1, flags=re.S)
    if count != 1:
        raise ValueError("No se encontró menuJsonLd en index.html")
    return updated

def main():
    source = INDEX.read_text(encoding="utf-8")
    key_match = re.search(r"const SUPABASE_ANON_KEY\s*=\s*'([^']+)'", source)
    if not key_match:
        raise SystemExit("No se encontró SUPABASE_ANON_KEY en index.html")
    anon_key = key_match.group(1)

    menu_rows = api_get("/rest/v1/menu_cache?id=eq.1&select=data", anon_key)
    if not menu_rows or not isinstance(menu_rows[0].get("data"), list):
        raise SystemExit("menu_cache está vacío")
    menu = menu_rows[0]["data"]

    cfg_rows = api_get("/rest/v1/jbg_config?key=eq.productos_ocultos&select=value", anon_key)
    hidden = set(cfg_rows[0].get("value") or []) if cfg_rows else set()

    zones_rows = api_get("/rest/v1/jbg_config?key=eq.zonas&select=value", anon_key)
    if not zones_rows or not isinstance(zones_rows[0].get("value"), list):
        raise SystemExit("La configuración de zonas está vacía; se conserva la publicación anterior")
    pages = build_pages(menu, hidden, zones_rows[0]["value"])
    changed = set()
    updated = update_documents(source, menu, hidden)
    if updated != source:
        INDEX.write_text(updated, encoding="utf-8")
        changed.add(ORIGIN + "/")
    for route, content in pages.items():
        path = ROOT / route / "index.html"
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            changed.add(f"{ORIGIN}/{route}/")
    update_sitemap(ROOT / "sitemap.xml", changed, [ORIGIN + "/"] + [f"{ORIGIN}/{r}/" for r in pages])


def update_sitemap(path, changed, urls):
    ns = "http://www.sitemaps.org/schemas/sitemap/0.9"
    old = ET.fromstring(path.read_text(encoding="utf-8"))
    dates = {el.findtext(f"{{{ns}}}loc"): el.findtext(f"{{{ns}}}lastmod") for el in old}
    today = datetime.now(ZoneInfo("America/Panama")).date().isoformat()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', f'<urlset xmlns="{ns}">']
    for url in urls:
        date = today if url in changed or not dates.get(url) else dates[url]
        lines.append(f'  <url><loc>{esc(url)}</loc><lastmod>{date}</lastmod></url>')
    lines.append('</urlset>')
    content = "\n".join(lines) + "\n"
    if path.read_text(encoding="utf-8") != content:
        path.write_text(content, encoding="utf-8")

if __name__ == "__main__":
    main()
