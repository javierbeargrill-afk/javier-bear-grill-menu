# Security Audit — 2026-09-27

Scope: `menujaviergrill.store`, production GitHub repository, public frontend, Supabase database/RLS, Storage and Edge Functions.

Method: authorized defensive review. No destructive exploitation, denial-of-service, credential stuffing or customer-data extraction was performed.

## Executive summary

The core design has several good controls already: RLS is enabled on all production tables, customer orders are not publicly readable, service-role/Loyverse credentials are server-side, admin passwords are hashed with PBKDF2, admin session tokens are random and stored server-side only as hashes, and cron sync uses a private server-side secret.

The audit found one high-impact stored-XSS path and several abuse/hardening issues. Immediate remediation was started on the audit date.

## Findings

| Severity | Finding | Status |
|---|---|---|
| Critical | Historical hard-coded admin password exists in old public Git history | Current credential verified different; historical value remains permanently compromised |
| High | Anonymous order insert + unescaped Admin order rendering allowed stored XSS in the Admin origin | Fixed in security branch; order rendering escapes attacker-controlled fields |
| High | Anyone with the public anon key could insert valid-looking fake orders and pollute statistics | Migrating to validated/rate-limited `order-api`; direct anon insert to be revoked after frontend deployment |
| High | Admin login had no real attempt throttling | Fixed in `admin-api` v2: per-IP temporary blocking |
| Medium | `warm_images=1` could be triggered without authorization, causing server work | Fixed in `loyverse-menu` v40 |
| Medium | Public Meta feed performs live Loyverse/API/image work and can be requested by anyone | Open: refactor to cached/pre-generated feed or protected feed URL without breaking Meta |
| Medium | Several menu/admin components still build HTML from dynamic trusted-source data | Partially mitigated; continue replacing raw `innerHTML` with safe DOM/text rendering |
| Medium | Public order endpoint lacked strong server-side schema/price validation | New `order-api` validates items against current menu and delivery zones |
| Medium | Storage image bucket had no per-bucket MIME/size restrictions | Fixed: image MIME allowlist + 10 MB limit |
| Medium | GitHub Action dependency used floating `actions/checkout@v4` | Fix prepared: pin to reviewed checkout commit |
| Low | Supabase Advisor warns `pg_net` is in `public` | Open; currently required by cron. Change only after compatibility test |
| Low | Supabase leaked-password protection is disabled | Low relevance to current custom admin auth; enable before relying on Supabase Auth users |
| Privacy | Current source removed the old residential address, but external/search caches may retain old content | Monitor/request reindex/removal where needed |
| Operational | Logs showed requests from an older Netlify-origin deployment | Investigate and decommission if no longer owned/needed |

## Evidence and controls verified

- RLS enabled on `menu_cache`, `pedidos`, `jbg_config`, `jbg_admin_credentials`, `jbg_admin_sessions`.
- Public roles can SELECT only intended public menu/config data.
- Public roles cannot SELECT customer orders.
- Admin credential/session tables have no public RLS policies.
- `jbg_get_menu_cron_secret()` cannot be executed by anon/authenticated roles.
- Current branch search found no service-role key, Loyverse token, admin password or literal Bearer secret.
- Historical review confirmed an old hard-coded admin credential in prior commits. The current stored admin credential does not match that historical value.
- Existing order table was checked for HTML-like payloads/extreme values; none were found at audit time.
- Hourly sync traffic in Supabase logs matches the configured server-side cron pattern.

## Required follow-up

1. Merge the security Pull Request and verify GitHub Pages deploys successfully.
2. After the new frontend is live, revoke anonymous direct INSERT on `pedidos`.
3. Test normal ordering, admin login, Admin Pedidos tab, manual sync and hourly cron.
4. Refactor/protect the Meta feed so public calls do not repeatedly hit Loyverse.
5. Investigate the old Netlify deployment/origin.
6. Continue eliminating dynamic raw HTML rendering.
7. Review security headers/CSP if a reverse proxy such as Cloudflare is introduced.
8. Perform a monthly Supabase Advisor + GitHub secret/history review.

## Risk principle

Repository privacy is not a security boundary for a browser application. Assume frontend code and public keys can always be inspected. Security must be enforced by server-side authorization, RLS, input validation, rate limits and secret isolation.
