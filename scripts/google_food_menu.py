#!/usr/bin/env python3
"""Optional Google Business Profile adapter. No secrets or raw API data in logs."""
import argparse
import copy
import hashlib
import html
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

MAX_BYTES = 5_000_000
PUBLIC_MENU_URL = 'https://menujaviergrill.store/'
CACHE_URL = 'https://uazonbacmpwuznugirru.supabase.co/functions/v1/loyverse-menu'
EXCLUDED = {'ingredientes', 'delivery', 'merma', 'bebidas para combos',
            'salsas para combos y picadas', 'acompañantes combos y picadas', 'tocino'}

class SyncError(Exception):
    pass

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def http_json(url, method='GET', token=None, body=None, form=None):
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    if form is not None:
        data = urlencode(form).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    try:
        with build_opener(NoRedirect).open(Request(url, data=data, headers=headers, method=method), timeout=30) as response:
            raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise SyncError('API response exceeds the size limit')
            return json.loads(raw), dict(response.headers)
    except HTTPError as exc:
        # Never include response bodies, URLs, credentials or location details.
        raise SyncError(f'API HTTP {exc.code}; check service enablement, OAuth scope and permissions') from None
    except (URLError, TimeoutError, ValueError):
        raise SyncError('API network or JSON response error') from None

def fingerprint(value):
    raw = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()

def clean(value, limit):
    if not isinstance(value, str):
        raise SyncError('Menu text must be a string')
    text = unicodedata.normalize('NFC', re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', '', value))).strip())
    if not text or len(text) > limit:
        raise SyncError(f'Menu text is empty or exceeds {limit} characters')
    return text

def label(value, description=None):
    result = {'displayName': clean(value, 140), 'languageCode': 'es'}
    if description:
        result['description'] = clean(description, 1000)
    return result

def money(value, currency):
    if isinstance(value, bool) or currency not in {'PAB', 'USD'}:
        raise SyncError('Invalid price or currency')
    try:
        price = Decimal(str(value))
        if not price.is_finite() or price <= 0 or price > 10000 or price != price.quantize(Decimal('0.01')):
            raise SyncError('Price must be positive and have at most two decimals')
    except InvalidOperation:
        raise SyncError('Invalid price') from None
    units = int(price)
    return {'currencyCode': currency, 'units': str(units), 'nanos': int((price - units) * 1_000_000_000)}

def build_menu(cache, currency='PAB', section=None):
    if not isinstance(cache, list) or not cache:
        raise SyncError('Empty or invalid menu cache')
    sections, names = [], set()
    for category in cache:
        if not isinstance(category, dict) or not isinstance(category.get('i'), list):
            raise SyncError('Invalid cache category')
        title = clean(category.get('n', ''), 140)
        if re.sub(r'^[^\w]+', '', title).casefold() in EXCLUDED or (section and title != section):
            continue
        if title in names:
            raise SyncError('Duplicate category name')
        names.add(title)
        items, seen = [], set()
        for item in category['i']:
            if not isinstance(item, dict):
                raise SyncError('Invalid cache item')
            name = clean(item.get('n', ''), 140)
            if name in seen:
                raise SyncError('Duplicate item name within a section')
            seen.add(name)
            items.append({'labels': [label(name, item.get('d'))],
                          'attributes': {'price': money(item.get('p'), currency)}})
        if items:
            sections.append({'labels': [label(title)], 'items': items})
    if not sections:
        raise SyncError('No eligible menu sections')
    # Image URLs are not mediaKeys. Upload/mapping is a separate later step.
    return {'labels': [label('Menú local Javier Bear Grill')], 'sourceUrl': PUBLIC_MENU_URL, 'sections': sections}

def display_name(value):
    return next((x.get('displayName', '') for x in value.get('labels', []) if x.get('languageCode') == 'es'),
                next((x.get('displayName', '') for x in value.get('labels', [])), ''))

def merge_menu(remote, desired, resource, section=None):
    if remote.get('name', resource) != resource or not isinstance(remote.get('menus', []), list):
        raise SyncError('Google menu resource does not match the selected location')
    menus = copy.deepcopy(remote.get('menus', []))
    matches = [i for i, m in enumerate(menus) if m.get('sourceUrl') == PUBLIC_MENU_URL]
    if len(matches) > 1:
        raise SyncError('Multiple Google menus match the source URL; reconcile before publishing')
    old = menus[matches[0]] if matches else None
    wanted = copy.deepcopy(desired)
    if old:
        # Preserve existing photos, options, allergens and other Google-only attributes.
        old_sections = {display_name(s): s for s in old.get('sections', [])}
        if len(old_sections) != len(old.get('sections', [])):
            raise SyncError('Ambiguous existing Google section names')
        for s in wanted['sections']:
            old_items = old_sections.get(display_name(s), {}).get('items', [])
            by_name = {display_name(i): i for i in old_items}
            if len(by_name) != len(old_items):
                raise SyncError('Ambiguous existing Google item names')
            for item in s['items']:
                existing = by_name.get(display_name(item))
                if existing:
                    saved = copy.deepcopy(existing)
                    saved['labels'] = item['labels']
                    saved.setdefault('attributes', {})['price'] = item['attributes']['price']
                    item.clear()
                    item.update(saved)
        saved_menu = copy.deepcopy(old)
        saved_menu.update(wanted)
        wanted = saved_menu
        if section:
            # Pilot replaces one section while preserving all other sections.
            updated = {display_name(s): s for s in wanted['sections']}
            wanted['sections'] = [updated.pop(display_name(s), s) for s in old.get('sections', [])]
            wanted['sections'].extend(updated.values())
    if matches:
        menus[matches[0]] = wanted
    else:
        menus.append(wanted)
    return {'name': resource, 'menus': menus}

def public_projection(payload):
    # Compare API readback only for fields managed here; ignore server normalization.
    return [{'sourceUrl': m.get('sourceUrl'), 'sections': [
        {'name': display_name(s), 'items': [
            {'name': display_name(i), 'description': i.get('labels'), 'price': i.get('attributes', {}).get('price')}
            for i in s.get('items', [])]} for s in m.get('sections', [])]}
        for m in payload.get('menus', []) if m.get('sourceUrl') == PUBLIC_MENU_URL]

def env(name):
    value = os.environ.get(name, '').strip()
    if not value:
        raise SyncError(f'Missing protected configuration: {name}')
    return value

def oauth_token():
    result, _ = http_json('https://oauth2.googleapis.com/token', method='POST', form={
        'client_id': env('GOOGLE_CLIENT_ID'), 'client_secret': env('GOOGLE_CLIENT_SECRET'),
        'refresh_token': env('GOOGLE_REFRESH_TOKEN'), 'grant_type': 'refresh_token'})
    if not isinstance(result.get('access_token'), str) or not result['access_token']:
        raise SyncError('Google OAuth did not return an access token')
    return result['access_token']

def private_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)

def load_cache(path=None):
    if path:
        return json.loads(Path(path).read_text())
    cache, headers = http_json(CACHE_URL)
    stamp = headers.get('X-Updated-At') or headers.get('x-updated-at')
    try:
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(stamp.replace('Z', '+00:00'))).total_seconds()
        if age < -300 or age > 7200:
            raise SyncError('Menu cache is stale; verify Loyverse synchronization')
    except (AttributeError, ValueError, TypeError):
        raise SyncError('Menu cache freshness could not be verified') from None
    return cache

def paged(url, key, token):
    result, seen = [], set()
    while True:
        page, _ = http_json(url, token=token)
        result.extend(page.get(key, []))
        next_token = page.get('nextPageToken')
        if not next_token:
            return result
        if next_token in seen:
            raise SyncError('Repeated Google pagination token')
        seen.add(next_token)
        # Endpoints supplied by the adapter only; preserve query without old page token.
        url = re.sub(r'([?&])pageToken=[^&]*', r'\1', url).rstrip('?&')
        url += ('&' if '?' in url else '?') + urlencode({'pageToken': next_token})

def synchronize(token, desired, mode, expected_hash=None, backup_dir=None, section=None, expected_proposed_hash=None):
    account, location = env('GOOGLE_ACCOUNT_ID'), env('GOOGLE_LOCATION_ID')
    if not re.fullmatch(r'[0-9]+', account) or not re.fullmatch(r'[0-9]+', location):
        raise SyncError('Google account and location IDs must be numeric IDs from discovery')
    resource = f'accounts/{account}/locations/{location}/foodMenus'
    info, _ = http_json(f'https://mybusinessbusinessinformation.googleapis.com/v1/locations/{location}?readMask=name,title,metadata', token=token)
    if info.get('metadata', {}).get('canHaveFoodMenus') is not True:
        raise SyncError('This Google location is not eligible for FoodMenus')
    url = 'https://mybusiness.googleapis.com/v4/' + resource
    before, _ = http_json(url, token=token)
    payload = merge_menu(before, desired, resource, section)
    digest = fingerprint(before)
    summary = {'mode': mode, 'current_hash': digest, 'proposed_hash': fingerprint(desired), 'changed': fingerprint(public_projection(before)) != fingerprint(public_projection(payload)),
               'sections': len(desired['sections']), 'items': sum(len(s['items']) for s in desired['sections'])}
    if mode != 'publish' or not summary['changed']:
        return summary
    if not expected_hash or expected_hash != digest or expected_proposed_hash != fingerprint(desired) or not backup_dir:
        raise SyncError('Publishing requires reviewed current/proposed hashes and a private backup directory')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    private_json(Path(backup_dir) / f'google-menu-before-{stamp}.json', before)
    private_json(Path(backup_dir) / f'google-menu-proposed-{stamp}.json', payload)
    latest, _ = http_json(url, token=token)
    if fingerprint(latest) != digest:
        raise SyncError('Google menu changed since preview; publishing cancelled')
    # Google does not provide per-item writes or an atomic compare-and-swap here.
    http_json(url + '?updateMask=menus', method='PATCH', token=token, body=payload)
    after, _ = http_json(url, token=token)
    private_json(Path(backup_dir) / f'google-menu-after-{stamp}.json', after)
    if fingerprint(public_projection(after)) != fingerprint(public_projection(payload)):
        raise SyncError('Google write completed but readback differs; inspect private backup before retrying')
    summary['verified'] = True
    return summary

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['offline', 'discover', 'preview', 'publish'], default='preview')
    parser.add_argument('--cache-file')
    parser.add_argument('--section', help='Exact section name for a controlled pilot')
    parser.add_argument('--currency', choices=['PAB', 'USD'], default='PAB')
    parser.add_argument('--expected-hash')
    parser.add_argument('--expected-proposed-hash')
    parser.add_argument('--backup-dir')
    parser.add_argument('--output', help='Private preview file; must not already exist')
    args = parser.parse_args()
    try:
        if args.mode == 'discover':
            token = oauth_token()
            accounts = paged('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', 'accounts', token)
            found = []
            for account in accounts:
                name = account.get('name', '')
                if not re.fullmatch(r'accounts/[0-9]+', name):
                    raise SyncError('Invalid Google account resource')
                locations = paged(f'https://mybusinessbusinessinformation.googleapis.com/v1/{name}/locations?readMask=name,title,metadata', 'locations', token)
                found.append({'account': name, 'locations': locations})
            if not args.output:
                raise SyncError('Discovery requires a private output path')
            private_json(args.output, found)
            print(json.dumps({'accounts': len(accounts), 'private_output_saved': True}))
            return 0
        if args.mode == 'publish' and args.cache_file:
            raise SyncError('Publishing must use the fresh live cache, not an offline file')
        desired = build_menu(load_cache(args.cache_file), args.currency, args.section)
        if args.output:
            private_json(args.output, desired)
        if args.mode == 'offline':
            print(json.dumps({'sections': len(desired['sections']), 'items': sum(len(s['items']) for s in desired['sections']), 'google_called': False}))
        else:
            print(json.dumps(synchronize(oauth_token(), desired, args.mode, args.expected_hash, args.backup_dir, args.section, args.expected_proposed_hash)))
        return 0
    except (SyncError, OSError, json.JSONDecodeError) as exc:
        # OSError may contain private paths; only allow our bounded error messages.
        print('Google menu: ' + (str(exc) if isinstance(exc, SyncError) else 'local file operation failed'), file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
