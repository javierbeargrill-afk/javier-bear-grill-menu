
const ALLOWED_ORIGINS = new Set([
  "https://menujaviergrill.store",
  "https://www.menujaviergrill.store",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://menujaviergrill.store";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function tokenB64Url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, saltB64: string, expectedB64: string, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: b64ToBytes(saltB64), iterations },
    material,
    256,
  );
  const actual = new Uint8Array(bits);
  const expected = b64ToBytes(expectedB64);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const SUPA_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPA_URL || !SERVICE_KEY) return json(req, { error: "Server configuration error" }, 500);

  const serviceHeaders = {
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");

  async function requireSession(): Promise<{ok: boolean, token?: string, hash?: string}> {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return { ok: false };
    const hash = await sha256Hex(token);
    const now = encodeURIComponent(new Date().toISOString());
    const res = await fetch(
      `${SUPA_URL}/rest/v1/jbg_admin_sessions?token_hash=eq.${hash}&expires_at=gt.${now}&select=token_hash&limit=1`,
      { headers: serviceHeaders },
    );
    if (!res.ok) return { ok: false };
    const rows = await res.json();
    return rows.length ? { ok: true, token, hash } : { ok: false };
  }

  async function loginRateState(): Promise<{ hash: string, attempts: number, blocked: boolean }> {
    const clientIp = (req.headers.get("cf-connecting-ip") || "").trim() || "unknown";
    const hash = await sha256Hex(clientIp + ":" + SERVICE_KEY.slice(-32));
    const res = await fetch(
      `${SUPA_URL}/rest/v1/jbg_admin_login_attempts?ip_hash=eq.${hash}&select=attempts,window_started,blocked_until&limit=1`,
      { headers: serviceHeaders },
    );
    if (!res.ok) return { hash, attempts: 0, blocked: false };
    const rows = await res.json();
    if (!rows.length) return { hash, attempts: 0, blocked: false };
    const row = rows[0];
    const now = Date.now();
    const blockedUntil = row.blocked_until ? new Date(row.blocked_until).getTime() : 0;
    if (blockedUntil > now) return { hash, attempts: Number(row.attempts || 0), blocked: true };
    const windowStart = new Date(row.window_started).getTime();
    if (!Number.isFinite(windowStart) || now - windowStart > 15 * 60 * 1000) {
      return { hash, attempts: 0, blocked: false };
    }
    return { hash, attempts: Number(row.attempts || 0), blocked: false };
  }

  async function recordFailedLogin(hash: string, currentAttempts: number) {
    const attempts = currentAttempts + 1;
    const now = new Date();
    const payload: Record<string, unknown> = {
      ip_hash: hash,
      attempts,
      blocked_until: attempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null,
      updated_at: now.toISOString(),
    };
    if (currentAttempts === 0) payload.window_started = now.toISOString();
    await fetch(`${SUPA_URL}/rest/v1/jbg_admin_login_attempts?on_conflict=ip_hash`, {
      method: "POST",
      headers: { ...serviceHeaders, "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  async function clearFailedLogins(hash: string) {
    await fetch(`${SUPA_URL}/rest/v1/jbg_admin_login_attempts?ip_hash=eq.${hash}`, {
      method: "DELETE",
      headers: { ...serviceHeaders, "Prefer": "return=minimal" },
    }).catch(() => {});
  }

  if (action === "login") {
    const password = String(body?.password || "");
    if (!password || password.length > 200) return json(req, { error: "Credenciales inválidas" }, 401);

    const rate = await loginRateState();
    if (rate.blocked) {
      return json(req, { error: "Demasiados intentos. Intenta nuevamente más tarde." }, 429);
    }

    const credRes = await fetch(
      `${SUPA_URL}/rest/v1/jbg_admin_credentials?id=eq.1&select=salt_b64,password_hash_b64,iterations&limit=1`,
      { headers: serviceHeaders },
    );
    if (!credRes.ok) return json(req, { error: "No se pudo validar el acceso" }, 500);
    const rows = await credRes.json();
    if (!rows.length) return json(req, { error: "Admin no configurado" }, 500);

    const c = rows[0];
    const valid = await verifyPassword(password, c.salt_b64, c.password_hash_b64, Number(c.iterations));
    if (!valid) {
      await recordFailedLogin(rate.hash, rate.attempts);
      await new Promise(r => setTimeout(r, 500));
      return json(req, { error: "Credenciales inválidas" }, 401);
    }

    await clearFailedLogins(rate.hash);

    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const token = tokenB64Url(raw);
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    await fetch(`${SUPA_URL}/rest/v1/jbg_admin_sessions?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, {
      method: "DELETE",
      headers: { ...serviceHeaders, "Prefer": "return=minimal" },
    }).catch(() => {});

    const insertRes = await fetch(`${SUPA_URL}/rest/v1/jbg_admin_sessions`, {
      method: "POST",
      headers: { ...serviceHeaders, "Prefer": "return=minimal" },
      body: JSON.stringify({ token_hash: tokenHash, expires_at: expiresAt }),
    });
    if (!insertRes.ok) return json(req, { error: "No se pudo iniciar la sesión" }, 500);

    return json(req, { ok: true, token, expires_at: expiresAt });
  }

  const session = await requireSession();
  if (!session.ok) return json(req, { error: "Sesión no válida o vencida" }, 401);

  if (action === "session") return json(req, { ok: true });

  if (action === "logout") {
    await fetch(`${SUPA_URL}/rest/v1/jbg_admin_sessions?token_hash=eq.${session.hash}`, {
      method: "DELETE",
      headers: { ...serviceHeaders, "Prefer": "return=minimal" },
    });
    return json(req, { ok: true });
  }

  if (action === "orders") {
    const days = Math.min(Math.max(Number(body?.days || 7), 1), 30);
    const limit = Math.min(Math.max(Number(body?.limit || 100), 1), 200);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const url = `${SUPA_URL}/rest/v1/pedidos?select=orden,cliente,zona,direccion,total,subtotal,delivery,pago,items,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=${limit}`;
    const res = await fetch(url, { headers: serviceHeaders });
    if (!res.ok) return json(req, { error: "No se pudieron cargar los pedidos" }, 500);
    return json(req, { ok: true, orders: await res.json() });
  }

  if (action === "config_update") {
    const key = String(body?.key || "");
    const allowed = new Set(["horarios", "banner", "zonas", "delivery_gratis", "productos_ocultos"]);
    if (!allowed.has(key)) return json(req, { error: "Configuración no permitida" }, 400);

    const res = await fetch(`${SUPA_URL}/rest/v1/jbg_config?key=eq.${encodeURIComponent(key)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders, "Prefer": "return=minimal" },
      body: JSON.stringify({ value: body?.value, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return json(req, { error: "No se pudo guardar la configuración" }, 500);
    return json(req, { ok: true });
  }

  if (action === "sync") {
    const res = await fetch(`${SUPA_URL}/functions/v1/loyverse-menu?sync=true`, {
      headers: { "Authorization": `Bearer ${session.token}` },
    });
    const txt = await res.text();
    if (!res.ok) return json(req, { error: "Falló la sincronización", detail: txt.slice(0, 300) }, 502);
    try { return json(req, { ok: true, data: JSON.parse(txt) }); }
    catch { return json(req, { ok: true, data: txt }); }
  }

  return json(req, { error: "Acción no reconocida" }, 400);
});
