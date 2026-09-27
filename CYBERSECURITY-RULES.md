# Javier Bear Grill — Cybersecurity Rules

These rules apply to the website, GitHub, Supabase, Loyverse, Google integrations and future production services.

## 1. Secrets

1. No private secret is ever stored in frontend HTML/JavaScript, a public GitHub file, screenshot or documentation.
2. Private tokens live only in the service that needs them (for example Supabase Edge Function secrets).
3. A secret that ever becomes public is considered permanently compromised and must be rotated; deleting the commit is not enough.
4. Never reuse an admin password that has appeared in Git history.
5. GitHub, Supabase, Loyverse, Google and domain accounts should use strong unique passwords and MFA/passkeys where available.

## 2. Public frontend

1. Treat all browser code, URLs and public API keys as visible to attackers.
2. Never trust values supplied by the browser for totals, prices, permissions or admin authorization.
3. Customer-controlled text must never be inserted into HTML with raw `innerHTML`; use `textContent` or an escaping function.
4. Customer fields must have length and format limits in both the browser and the server/database.
5. Exact customer location is transmitted only when necessary for delivery and must not be published.

## 3. Database and Supabase

1. RLS is mandatory on every table in an exposed schema.
2. Default access is deny; grant only the exact SELECT/INSERT/UPDATE/DELETE privileges required.
3. Customer-order tables are never publicly readable.
4. Public writes go through a validating/rate-limited server endpoint whenever practical.
5. Service-role keys are server-only.
6. Security Advisor is reviewed after schema/auth changes and at least monthly.
7. Public Storage buckets contain public media only; upload size and MIME type are restricted.

## 4. Admin access

1. Admin authentication is verified server-side, never by a password embedded in JavaScript.
2. Failed logins are rate-limited/temporarily blocked.
3. Admin sessions expire and tokens are never logged or committed.
4. Test/development mode must not alter real business hours and test orders must be clearly marked.
5. Admin endpoints follow least privilege and reject unknown actions/config keys.

## 5. GitHub and deployment

1. Production changes use a branch + Pull Request + automated checks before merge.
2. Security checks must pass before production merge.
3. Third-party GitHub Actions should be pinned to a reviewed commit SHA.
4. Community code is never auto-deployed into Javier Bear Grill without review.
5. The reusable public project and JBG production configuration remain logically separated.
6. Generated snapshots may publish public menu data only.

## 6. APIs and integrations

1. Every state-changing or expensive endpoint requires authentication, a scoped secret, or rate limiting as appropriate.
2. Debug endpoints must be protected and removed when no longer needed.
3. CORS is defense-in-depth, not authentication.
4. Google/Loyverse/Meta integrations must use the minimum scopes needed.
5. Automated syncs must be idempotent, logged and safe to retry.

## 7. Monitoring and response

1. Review unusual Supabase/GitHub logs regularly, especially repeated 401/429/5xx activity and unexpected origins.
2. Keep a record of security-relevant production changes.
3. Critical incident: revoke/rotate exposed credentials immediately, invalidate sessions, block the vulnerable path, preserve logs, then patch.
4. High-risk vulnerability: patch as soon as practical, normally within 72 hours.
5. Medium/low findings go into the roadmap and are reviewed monthly.
6. Backups and recovery paths are tested before destructive database changes.

## 8. Privacy

1. Collect only data needed to fulfill an order.
2. Do not expose customer names, addresses, locations or order history publicly.
3. Do not store sensitive business data in the public website repository.
4. Old private-address references in search caches should be removed/reindexed after they are deleted from the source.
