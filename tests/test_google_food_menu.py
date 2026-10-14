import copy
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('google_menu', Path(__file__).parents[1] / 'scripts/google_food_menu.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
CACHE = [{'n': '🍔 Hamburguesas', 'i': [{'n': 'Clásica', 'p': 3.99, 'd': '<p>Carne &amp; queso</p>', 'cost': 99, 'img': 'https://example.invalid/photo.jpg'}]}]
RESOURCE = 'accounts/1/locations/2/foodMenus'

class MenuTests(unittest.TestCase):
    def test_money_precision_and_payload_allowlist(self):
        item = g.build_menu(CACHE)['sections'][0]['items'][0]
        self.assertEqual(item['attributes']['price'], {'currencyCode': 'PAB', 'units': '3', 'nanos': 990000000})
        self.assertEqual(item['labels'][0]['description'], 'Carne & queso')
        self.assertNotIn('cost', str(item))
        self.assertNotIn('mediaKeys', item['attributes'])

    def test_reject_bad_prices(self):
        for v in [None, True, 0, -1, 'variable', 'NaN', 'Infinity', '2.999']:
            with self.subTest(v=v), self.assertRaises(g.SyncError):
                g.money(v, 'PAB')

    def test_filter_private_categories_and_empty_fail_closed(self):
        private = [{'n': '🧂 Ingredientes', 'i': [{'n': 'Res', 'p': 5}]}]
        with self.assertRaises(g.SyncError): g.build_menu(private)
        with self.assertRaises(g.SyncError): g.build_menu([])

    def test_duplicate_unicode_names_rejected(self):
        cache = copy.deepcopy(CACHE)
        cache[0]['i'].append({'n': 'Cla\u0301sica', 'p': 4})
        with self.assertRaises(g.SyncError): g.build_menu(cache)

    def test_labels_are_arrays_and_text_limit(self):
        menu = g.build_menu(CACHE)
        self.assertIsInstance(menu['labels'], list)
        self.assertIsInstance(menu['sections'][0]['labels'], list)
        with self.assertRaises(g.SyncError): g.clean('a' * 141, 140)

    def test_preserve_unmanaged_menus_media_and_options(self):
        old = g.build_menu(CACHE)
        old['sections'][0]['items'][0]['attributes']['mediaKeys'] = ['existing-key']
        old['sections'][0]['items'][0]['options'] = [{'labels': [{'displayName': 'Grande'}]}]
        untouched = {'sourceUrl': 'https://other.example/', 'sections': []}
        before = {'name': RESOURCE, 'menus': [untouched, old]}
        desired = g.build_menu(CACHE)
        desired['sections'][0]['items'][0]['attributes']['price']['units'] = '4'
        result = g.merge_menu(before, desired, RESOURCE)
        self.assertEqual(result['menus'][0], untouched)
        updated = result['menus'][1]['sections'][0]['items'][0]
        self.assertEqual(updated['attributes']['mediaKeys'], ['existing-key'])
        self.assertIn('options', updated)
        self.assertEqual(before['menus'][1]['sections'][0]['items'][0]['attributes']['price']['units'], '3')

    def test_pilot_preserves_other_sections(self):
        old = g.build_menu(CACHE)
        old['sections'].append({'labels': [g.label('Bebidas')], 'items': [{'labels': [g.label('Agua')]}]})
        merged = g.merge_menu({'menus': [old]}, g.build_menu(CACHE), RESOURCE, section='🍔 Hamburguesas')
        self.assertEqual(merged['menus'][0]['sections'][1], old['sections'][1])

    def test_reject_ambiguous_menu_and_resource(self):
        desired = g.build_menu(CACHE)
        with self.assertRaises(g.SyncError): g.merge_menu({'menus': [desired, desired]}, desired, RESOURCE)
        with self.assertRaises(g.SyncError): g.merge_menu({'name': 'wrong', 'menus': []}, desired, RESOURCE)

    @patch.dict(os.environ, {'GOOGLE_ACCOUNT_ID': '1', 'GOOGLE_LOCATION_ID': '2'})
    def test_preview_never_patches(self):
        with patch.object(g, 'http_json', side_effect=[({'metadata': {'canHaveFoodMenus': True}}, {}), ({'name': RESOURCE, 'menus': []}, {})]) as http:
            result = g.synchronize('test-token', g.build_menu(CACHE), 'preview')
            self.assertTrue(result['changed'])
            self.assertTrue(all(c.kwargs.get('method', 'GET') == 'GET' for c in http.call_args_list))

    @patch.dict(os.environ, {'GOOGLE_ACCOUNT_ID': '1', 'GOOGLE_LOCATION_ID': '2'})
    def test_ineligible_location_cannot_write(self):
        with patch.object(g, 'http_json', return_value=({'metadata': {'canHaveFoodMenus': False}}, {})) as http:
            with self.assertRaises(g.SyncError): g.synchronize('test-token', g.build_menu(CACHE), 'publish')
            self.assertEqual(http.call_count, 1)

    @patch.dict(os.environ, {'GOOGLE_ACCOUNT_ID': '1', 'GOOGLE_LOCATION_ID': '2'})
    def test_publish_requires_reviewed_hash_and_backup(self):
        before = {'name': RESOURCE, 'menus': []}
        with patch.object(g, 'http_json', side_effect=[({'metadata': {'canHaveFoodMenus': True}}, {}), (before, {})]) as http:
            with self.assertRaises(g.SyncError): g.synchronize('test-token', g.build_menu(CACHE), 'publish', 'wrong', '/unused')
            self.assertEqual(http.call_count, 2)

    @patch.dict(os.environ, {'GOOGLE_ACCOUNT_ID': '1', 'GOOGLE_LOCATION_ID': '2'})
    def test_remote_drift_prevents_patch(self):
        before = {'name': RESOURCE, 'menus': []}
        with tempfile.TemporaryDirectory() as directory, patch.object(g, 'http_json', side_effect=[({'metadata': {'canHaveFoodMenus': True}}, {}), (before, {}), ({'menus': [{'sourceUrl': 'external'}]}, {})]) as http:
            with self.assertRaises(g.SyncError): g.synchronize('test-token', g.build_menu(CACHE), 'publish', g.fingerprint(before), directory, expected_proposed_hash=g.fingerprint(g.build_menu(CACHE)))
            self.assertTrue(all(c.kwargs.get('method', 'GET') == 'GET' for c in http.call_args_list))

    @patch.dict(os.environ, {'GOOGLE_ACCOUNT_ID': '1', 'GOOGLE_LOCATION_ID': '2'})
    def test_publish_readback_and_private_backups(self):
        before = {'name': RESOURCE, 'menus': []}
        desired = g.build_menu(CACHE)
        after = g.merge_menu(before, desired, RESOURCE)
        with tempfile.TemporaryDirectory() as directory, patch.object(g, 'http_json', side_effect=[({'metadata': {'canHaveFoodMenus': True}}, {}), (before, {}), (before, {}), (after, {}), (after, {})]) as http:
            result = g.synchronize('test-token', desired, 'publish', g.fingerprint(before), directory, expected_proposed_hash=g.fingerprint(g.build_menu(CACHE)))
            self.assertTrue(result['verified'])
            self.assertEqual(sum(c.kwargs.get('method') == 'PATCH' for c in http.call_args_list), 1)
            self.assertEqual(len(list(Path(directory).glob('*.json'))), 3)
            self.assertTrue(all(p.stat().st_mode & 0o777 == 0o600 for p in Path(directory).glob('*.json')))

    def test_pagination(self):
        with patch.object(g, 'http_json', side_effect=[({'accounts': [1], 'nextPageToken': 'next'}, {}), ({'accounts': [2]}, {})]):
            self.assertEqual(g.paged('https://example.invalid/accounts', 'accounts', 'test-token'), [1, 2])

    def test_cache_stale_rejected(self):
        with patch.object(g, 'http_json', return_value=(CACHE, {'X-Updated-At': '2000-01-01T00:00:00Z'})):
            with self.assertRaises(g.SyncError): g.load_cache()

if __name__ == '__main__': unittest.main()
