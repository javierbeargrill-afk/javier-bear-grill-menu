import importlib.util
import json
from pathlib import Path
import re
import unittest

spec = importlib.util.spec_from_file_location("snapshot", Path(__file__).resolve().parents[1] / "scripts/update_menu_snapshot.py")
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)


class MenuSnapshotTests(unittest.TestCase):
    def test_initial_html_contains_matching_menu_without_javascript(self):
        menu = [{"n": "Hamburguesas", "i": [
            {"n": "Clásica", "p": 3.99, "d": "Pan & queso", "img": "https://example.com/burger.jpg"},
            {"n": "Oculta", "p": 4.0}]}]
        source = '<script id="menuJsonLd" type="application/ld+json">{}</script><!-- MENU_SNAPSHOT_START --><!-- MENU_SNAPSHOT_END -->'
        updated = snapshot.update_documents(source, menu, {"Oculta"})
        schema = json.loads(re.search(r'ld\+json">(.*?)</script>', updated)[1])
        items = schema["hasMenuSection"][0]["hasMenuItem"]
        self.assertEqual([item["name"] for item in items], ["Clásica"])
        self.assertEqual(items[0]["offers"]["price"], "3.99")
        self.assertIn('itemprop="price" content="3.99"', updated)
        self.assertNotIn("Oculta", updated)
        self.assertEqual(snapshot.update_documents(updated, menu, {"Oculta"}), updated)

    def test_untrusted_menu_text_cannot_close_script(self):
        name = '</script><img src=x onerror=alert(1)>\\1'
        encoded = snapshot.render_menu_schema([{"n": "Menú", "i": [{"n": name, "p": 1}]}], set())
        self.assertNotIn("<", encoded)
        self.assertEqual(json.loads(encoded)["hasMenuSection"][0]["hasMenuItem"][0]["name"], name)

    def test_missing_markers_fail_instead_of_silently_dropping_schema(self):
        with self.assertRaises(ValueError):
            snapshot.update_documents("<html></html>", [], set())


if __name__ == "__main__":
    unittest.main()
