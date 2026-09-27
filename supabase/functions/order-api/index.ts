const ALLOWED_ORIGINS = new Set([
  "https://menujaviergrill.store",
  "https://www.menujaviergrill.store",
  "https://javierbeargrill-afk.github.io",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://menujaviergrill.store";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function cleanText(value: unknown, max: number, required = false) {
  const s = String(value ?? "").trim();
  if ((required && !s) || s.length > max || /[<>]/.test(s)) return null;
  return s;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 20000) return json(req, { error: "Request too large" }, 413);

  const SUPA_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SUPA_URL || !SERVICE_KEY) return json(req, { error: "Server configuration error" }, 500);

  const serviceHeaders = {
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  const clientIp = (req.headers.get("cf-connecting-ip") || "").trim() || "unknown";
  const ipHash = await sha256Hex(clientIp + ":" + SERVICE_KEY.slice(-32));
  const now = Date.now();

  const rateRes = await fetch(
    `${SUPA_URL}/rest/v1/jbg_order_rate_limits?ip_hash=eq.${ipHash}&select=request_count,window_started,blocked_until&limit=1`,
    { headers: serviceHeaders },
  );
  let count = 0;
  let windowStarted = now;
  if (rateRes.ok) {
    const rows = await rateRes.json();
    if (rows.length) {
      const row = rows[0];
      const blockedUntil = row.blocked_until ? new Date(row.blocked_until).getTime() : 0;
      if (blockedUntil > now) return json(req, { error: "Too many requests" }, 429);
      const start = new Date(row.window_started).getTime();
      if (Number.isFinite(start) && now - start <= 15 * 60 * 1000) {
        count = Number(row.request_count || 0);
        windowStarted = start;
      }
    }
  }

  count++;
  const blockedUntil = count > 20 ? new Date(now + 30 * 60 * 1000).toISOString() : null;
  await fetch(`${SUPA_URL}/rest/v1/jbg_order_rate_limits?on_conflict=ip_hash`, {
    method: "POST",
    headers: { ...serviceHeaders, "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      ip_hash: ipHash,
      request_count: count,
      window_started: new Date(windowStarted).toISOString(),
      blocked_until: blockedUntil,
      updated_at: new Date(now).toISOString(),
    }),
  }).catch(() => {});
  if (blockedUntil) return json(req, { error: "Too many requests" }, 429);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json(req, { error: "Invalid order" }, 400);

  const orden = cleanText(body.orden, 40, true);
  const cliente = cleanText(body.cliente, 80, true);
  const direccion = cleanText(body.direccion, 250, false);
  const zona = cleanText(body.zona, 80, true);
  const pago = String(body.pago || "");
  if (!orden || !/^[A-Za-z0-9#_-]{3,40}$/.test(orden) || !cliente || direccion === null || !zona) {
    return json(req, { error: "Invalid order" }, 400);
  }
  if (!["efectivo","yappy","tarjeta"].includes(pago)) return json(req, { error: "Invalid payment" }, 400);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
    return json(req, { error: "Invalid items" }, 400);
  }

  const [menuRes, zonesRes] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/menu_cache?id=eq.1&select=data&limit=1`, { headers: serviceHeaders }),
    fetch(`${SUPA_URL}/rest/v1/jbg_config?key=eq.zonas&select=value&limit=1`, { headers: serviceHeaders }),
  ]);
  if (!menuRes.ok || !zonesRes.ok) return json(req, { error: "Could not validate order" }, 503);

  const menuRows = await menuRes.json();
  const zoneRows = await zonesRes.json();
  const menu = Array.isArray(menuRows?.[0]?.data) ? menuRows[0].data : [];
  const zones = Array.isArray(zoneRows?.[0]?.value) ? zoneRows[0].value : [];

  const priceByName = new Map<string, number>();
  for (const cat of menu) {
    for (const item of (cat?.i || [])) {
      if (typeof item?.n === "string" && Number.isFinite(Number(item?.p))) {
        priceByName.set(item.n, Number(item.p));
      }
    }
  }

  const safeItems: Array<{n:string,qty:number,p:number}> = [];
  let subtotal = 0;
  for (const raw of body.items) {
    const name = cleanText(raw?.n, 120, true);
    const qty = Number(raw?.qty);
    if (!name || !Number.isInteger(qty) || qty < 1 || qty > 20 || !priceByName.has(name)) {
      return json(req, { error: "Invalid items" }, 400);
    }
    const price = Number(priceByName.get(name));
    safeItems.push({ n: name, qty, p: price });
    subtotal += price * qty;
  }

  const zone = zones.find((z: any) => z?.activa !== false && String(z?.nombre || "") === zona);
  if (!zone) return json(req, { error: "Invalid delivery zone" }, 400);
  const delivery = zone?.fuera ? 0 : Number(zone?.precio || 0);
  if (!Number.isFinite(delivery) || delivery < 0 || delivery > 50) return json(req, { error: "Invalid delivery" }, 400);

  subtotal = Number(subtotal.toFixed(2));
  const total = Number((subtotal + delivery).toFixed(2));

  const insert = await fetch(`${SUPA_URL}/rest/v1/pedidos`, {
    method: "POST",
    headers: { ...serviceHeaders, "Prefer": "return=minimal" },
    body: JSON.stringify({
      orden, cliente, zona, direccion: direccion || null, pago,
      items: safeItems, subtotal, delivery, total,
    }),
  });

  if (!insert.ok) {
    if (insert.status === 409) return json(req, { ok: true, duplicate: true }, 200);
    return json(req, { error: "Could not save order" }, 500);
  }

  return json(req, { ok: true, subtotal, delivery, total });
});
