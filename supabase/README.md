# Production Supabase mirror

This folder records the server-side code and migrations used by Javier Bear Grill production.

It is intentionally safe to keep in the public repository:

- Edge Function source code may be public.
- Database migrations may be public.
- **Real credentials and secret values must never be committed.**

Required private values remain configured in Supabase, including:

- `LOYVERSE_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- cron/sync secrets

The browser uses only the Supabase anon/publishable key for resources that RLS explicitly exposes.

## Functions

- `loyverse-menu`: public menu cache, authenticated sync/debug operations, Meta catalog feed.
- `admin-api`: server-side admin authentication/actions with login throttling.
- `order-api`: public order-log endpoint with validation, server-side price/zone calculation and rate limiting.

## Security principle

GitHub visibility is not an authentication mechanism. Anything here can be read and copied; authorization is enforced by Supabase RLS, server-side secrets, input validation and rate limits.
