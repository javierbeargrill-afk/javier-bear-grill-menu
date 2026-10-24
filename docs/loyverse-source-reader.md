# Loyverse source reader

The existing menu integration reads catalog data but does not preserve financial receipts. The new function reads official GET endpoints and stores source records and complete pages privately. It does not write to Loyverse or alter menu cache, prices, recipes or stock.

## Operation
Deploy `supabase/functions/jbg-loyverse-source-reader` with its deno.json. The function authenticates x-jbg-cron-secret against the existing privileged RPC; JWT verification is disabled only because authentication is implemented in the function. It reuses existing server environment variables and never returns source credentials. Do not expose this function to clients or copy secrets into invocation scripts.

Allowed resources: receipts, items, inventory and payment_types. POST body controls reader selection, not source mutations. Follow returned cursor to null; limit250. Receipts accept created_at_min/max. created_at is server ingestion time; reporting uses receipt_date in America/Panama. Inventory returns inventory_levels, not inventory.

Raw identity: resource+source_key; receipts use store+receipt_number, inventory store+variant; items/payment types source ID. The same page scope hashes to the same page key. Repeated reads update source snapshots rather than append duplicate transactions. Page and record writes are sequential; retry a failed page to repair a partial write. Page history preserves original responses; current record table is a latest-source snapshot.

## Validation
Runtime: missing secret401, invalid resource400. Successful complete cursor traversal and one payment/line total check per receipt. Local mocked tests cover auth, methods, dates, cursor, correct inventory shape, identity and source failures. Tables enable RLS, revoke PUBLIC/anon/authenticated and grant service-role ingestion only. No public financial endpoints or automatic cron was created.

## Reporting limits
Keep canceled receipts as audit evidence; exclude them from economic totals. Active REFUND receipts subtract from active SALE receipts. POS payment labels Pedidos ya/Uber identify channel amounts to reconcile, not extra sales on top of official platform orders. Crédito is not proof of cash received. Catalog cost is operational configuration, not invoice-verified cost. API inventory is not a dated physical count. Do not infer profit or cost of sales from purchases alone.

The financial reconstruction still depends on platform order coverage, source invoice checks, physical quantities and bank evidence.
