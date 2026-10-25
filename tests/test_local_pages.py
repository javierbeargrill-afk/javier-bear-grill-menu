import sys
from pathlib import Path
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_local_pages import build_pages
from update_menu_snapshot import update_sitemap

class LocalPagesTests(unittest.TestCase):
    def test_catalogue_hidden_items_and_active_zones(self):
        menu = [{'n': '🍔 Hamburguesas', 'i': [
            {'n': 'Visible <img>', 'd': '<script>bad</script>', 'p': 4.25, 'img': 'javascript:bad'},
            {'n': 'Oculta', 'p': 99}, {'n': 'Tocino extra', 'p': 1}]}]
        zones = [{'nombre': 'Zona & uno', 'precio': 1.25, 'activa': True},
                 {'nombre': 'Inactiva', 'precio': 3, 'activa': False},
                 {'nombre': 'Fuera', 'fuera': True, 'precio': 0}]
        pages = build_pages(menu, {'Oculta'}, zones)
        burger, delivery = pages.values()
        self.assertIn('B/.4.25', burger)
        self.assertIn('Visible &lt;img&gt;', burger)
        self.assertNotIn('<script>bad', burger)
        self.assertNotIn('javascript:bad', burger)
        self.assertNotIn('Oculta', burger)
        self.assertNotIn('Tocino extra', burger)
        self.assertNotIn('Inactiva', delivery)
        self.assertIn('Zona &amp; uno', delivery)
        self.assertIn('B/.1.25', delivery)
        self.assertIn('Consultar por WhatsApp', delivery)
        self.assertEqual(pages, build_pages(menu, {'Oculta'}, zones))

    def test_sitemap_keeps_dates_for_unchanged_pages(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'sitemap.xml'
            p.write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc><lastmod>2020-01-01</lastmod></url></urlset>')
            update_sitemap(p, {'https://example.com/new/'}, ['https://example.com/', 'https://example.com/new/'])
            content = p.read_text()
            self.assertIn('<loc>https://example.com/</loc><lastmod>2020-01-01</lastmod>', content)
            update_sitemap(p, set(), ['https://example.com/', 'https://example.com/new/'])
            self.assertEqual(content, p.read_text())
