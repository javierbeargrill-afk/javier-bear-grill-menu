-- Security hardening applied to production on 2026-09-27.
-- Secrets are intentionally not stored in this repository.

-- Validate and bound order records.
alter table public.pedidos
  add constraint pedidos_orden_safe
    check (char_length(orden) between 3 and 40 and orden ~ '^[A-Za-z0-9#_-]+$'),
  add constraint pedidos_cliente_safe
    check (cliente is null or (char_length(cliente) <= 80 and cliente !~ '[<>]')),
  add constraint pedidos_zona_safe
    check (zona is null or (char_length(zona) <= 80 and zona !~ '[<>]')),
  add constraint pedidos_direccion_safe
    check (direccion is null or (char_length(direccion) <= 250 and direccion !~ '[<>]')),
  add constraint pedidos_pago_safe
    check (pago is null or pago in ('efectivo','yappy','tarjeta')),
  add constraint pedidos_items_safe
    check (
      jsonb_typeof(items) = 'array'
      and jsonb_array_length(items) between 1 and 30
      and char_length(items::text) <= 12000
      and items::text !~ '[<>]'
    ),
  add constraint pedidos_amounts_safe
    check (
      coalesce(subtotal,0) >= 0 and coalesce(subtotal,0) <= 500
      and coalesce(delivery,0) >= 0 and coalesce(delivery,0) <= 50
      and coalesce(total,0) >= 0 and coalesce(total,0) <= 550
      and abs(coalesce(total,0) - (coalesce(subtotal,0) + coalesce(delivery,0))) <= 0.02
    );

-- Server-only login throttling.
create table if not exists public.jbg_admin_login_attempts (
  ip_hash text primary key,
  attempts integer not null default 0 check (attempts between 0 and 1000),
  window_started timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.jbg_admin_login_attempts enable row level security;
revoke all on public.jbg_admin_login_attempts from anon, authenticated;

-- Server-only public-order throttling.
create table if not exists public.jbg_order_rate_limits (
  ip_hash text primary key,
  request_count integer not null default 0 check (request_count between 0 and 10000),
  window_started timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.jbg_order_rate_limits enable row level security;
revoke all on public.jbg_order_rate_limits from anon, authenticated;

create unique index if not exists pedidos_orden_unique_idx on public.pedidos(orden);

-- Close direct anonymous order inserts. Public writes now go through order-api.
drop policy if exists "Insertar publico" on public.pedidos;
drop policy if exists "Insertar pedido publico validado" on public.pedidos;
revoke insert on public.pedidos from anon, authenticated;

-- Bound public menu image uploads to expected media types and size.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[]
where id = 'menu-images';
