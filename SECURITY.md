# Security Policy

Javier Bear Grill treats this repository as production code.

## Public repository assumption

Anything committed here must be considered public and permanently copyable. Never commit:

- passwords or password hashes intended to remain private;
- Loyverse access tokens;
- Supabase service-role keys;
- cron/sync secrets;
- Google OAuth client secrets or refresh tokens;
- customer exports, private addresses, invoices or financial data.

The Supabase anon/publishable key used by the browser is intentionally public. Its safety depends on strict RLS and database grants.

## Reporting a vulnerability

Do not publish working exploit payloads or customer data in a public issue. Contact the repository owner privately before disclosing sensitive details.

## Production security rules

See [CYBERSECURITY-RULES.md](CYBERSECURITY-RULES.md).

## Audit history

See [docs/SECURITY-AUDIT-2026-09-27.md](docs/SECURITY-AUDIT-2026-09-27.md).
