import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const EXCLUIR = [
  "ingredientes",
  "delivery",
  "salsas para combos y picadas",
  "acompañantes combos y picadas",
  "merma",
  "tocino",
  "bebidas para combos",
]

const EMOJI_MAP: Record<string, string> = {
  "promociones":            "🔥",
  "pollo":                  "🍗",
  "hamburguesas":           "🍔",
  "combo de hamburguesas":  "🍔",
  "carne y cerdo":          "🥩",
  "picadas":                "🍖",
  "salchipapas y hoddogs":  "🌭",
  "chorizos":               "🌭",
  "acompañantes":           "🍟",
  "bebidas":                "🥤",
  "salsas":                 "🥫",
  "niños":                  "🧒",
  "especiales":             "⭐",
}

const CAT_ORDER = [
  "promociones", "pollo", "combo de hamburguesas", "hamburguesas",
  "carne y cerdo", "picadas", "salchipapas y hoddogs", "chorizos",
  "acompañantes", "bebidas", "salsas", "niños", "especiales",
]

const STORE_ID = "982e8d09-b15d-42fd-af07-c64abed4b073"
const MENU_URL = "https://menujaviergrill.store/"

// ─── Caché de imagen ──────────────────────────────────────────────────────────

async function cacheImagen(
  loyverseUrl: string,
  itemId: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<string> {
  try {
    // Loyverse cambia el identificador de imagen cuando cambia la foto.
    // Lo incluimos en el path para evitar fotos viejas en CDN.
    const rawKey = loyverseUrl.split("/").pop()?.split("?")[0] || "image"
    const sourceKey = rawKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "image"

    const baseName = `loyverse/${sourceKey}`

    // Primero probamos los formatos más comunes sin descargar desde Loyverse.
    for (const ext of ["jpg", "png", "webp", "gif", "avif"]) {
      const candidate = `${supabaseUrl}/storage/v1/object/public/menu-images/${baseName}.${ext}`
      const exists = await fetch(candidate, { method: "HEAD", cache: "no-store" })
      if (exists.ok) return candidate
    }

    const imgRes = await fetch(loyverseUrl, {
      headers: { "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" }
    })
    if (!imgRes.ok) return loyverseUrl

    const contentType = (imgRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim()
    const ext = contentType.includes("png") ? "png"
      : contentType.includes("webp") ? "webp"
      : contentType.includes("gif") ? "gif"
      : contentType.includes("avif") ? "avif"
      : "jpg"

    const fileName = `${baseName}.${ext}`
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/menu-images/${fileName}`
    const bytes = new Uint8Array(await imgRes.arrayBuffer())
    if (!bytes.byteLength) return loyverseUrl

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { error } = await supabase.storage
      .from("menu-images")
      .upload(fileName, bytes, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      })

    if (error) {
      const verify = await fetch(publicUrl, { method: "HEAD", cache: "no-store" })
      if (!verify.ok) return loyverseUrl
    }

    return publicUrl
  } catch {
    return loyverseUrl
  }
}


async function warmCachedMenuImages(
  menuData: any[],
  supabaseUrl: string,
  serviceKey: string
): Promise<number> {
  try {
    const next = structuredClone(menuData)
    const targets: { item: any, url: string }[] = []

    for (const cat of next) {
      for (const item of (cat?.i || [])) {
        if (typeof item?.img === "string" && item.img.includes("api.loyverse.com/image/")) {
          targets.push({ item, url: item.img })
        }
      }
    }

    if (!targets.length) return 0

    let changed = 0
    for (let i = 0; i < targets.length; i += 6) {
      const batch = targets.slice(i, i + 6)
      await Promise.all(batch.map(async ({ item, url }) => {
        const cached = await cacheImagen(url, "cached", supabaseUrl, serviceKey)
        if (cached !== url && cached.includes("/storage/v1/object/public/menu-images/")) {
          item.img = cached
          changed++
        }
      }))
    }

    if (changed > 0) {
      await fetch(
        `${supabaseUrl}/rest/v1/menu_cache?id=eq.1`,
        {
          method: "PATCH",
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ data: next }),
        }
      )
    }

    return changed
  } catch {
    return 0
  }
}

async function getCachedMenuData(
  supabaseUrl: string,
  serviceKey: string
): Promise<any[]> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/menu_cache?id=eq.1&select=data`,
    { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
  )
  if (!res.ok) return []
  const rows = await res.json()
  return rows.length && Array.isArray(rows[0].data) ? rows[0].data : []
}

// ─── Escapar campo CSV ────────────────────────────────────────────────────────

function csvEscape(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ""
  const s = String(val).replace(/"/g, '""')
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s}"`
  return s
}

// ─── Headers exactos de la plantilla oficial de Meta ─────────────────────────

const META_HEADER =
  "id,title,description,availability,condition,price,link,image_link,brand," +
  "google_product_category,fb_product_category,quantity_to_sell_on_facebook," +
  "sale_price,sale_price_effective_date,item_group_id,gender,color,size,age_group," +
  "material,pattern,shipping,shipping_weight,video[0].url,video[0].tag[0],gtin," +
  "product_tags[0],product_tags[1],style[0]"

async function buildMetaFeed(
  catMap: Record<string, string>,
  allItems: any[],
  SUPA_URL: string,
  SERVICE_KEY: string
): Promise<Response> {

  const itemsFiltrados = allItems.filter(item => {
    if (item.is_deleted) return false
    if (!item.variants?.length) return false
    const store = item.variants[0].stores?.[0]
    if (!store?.available_for_sale) return false
    const price = parseFloat(store.price ?? item.variants[0].default_price ?? "0")
    if (!price || isNaN(price)) return false
    if (!item.item_name?.trim()) return false
    const cat = (item.category_id && catMap[item.category_id])
      ? catMap[item.category_id]
      : (item.category_name?.trim() || "Sin categoría")
    return !EXCLUIR.includes(cat.toLowerCase())
  })

  const procesarMeta = async (item: any): Promise<string> => {
    const store = item.variants[0].stores[0]
    const price = parseFloat(store.price ?? item.variants[0].default_price ?? "0")

    let imgUrl = ""
    if (item.image_url) {
      imgUrl = await cacheImagen(item.image_url, item.id, SUPA_URL, SERVICE_KEY)
    }

    let desc = item.item_name.trim()
    if (item.description) {
      const clean = item.description
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim()
      if (clean) desc = clean
    }

    const catNombre = (item.category_id && catMap[item.category_id])
      ? catMap[item.category_id]
      : (item.category_name?.trim() || "Sin categoría")

    return [
      csvEscape(item.id),
      csvEscape(item.item_name.trim()),
      csvEscape(desc),
      "in stock",
      "new",
      `${price.toFixed(2)} PAB`,
      csvEscape(MENU_URL),
      csvEscape(imgUrl),
      csvEscape("Javier Bear Grill"),
      csvEscape("Food, Beverages & Tobacco > Food Items"),
      csvEscape(catNombre),
      "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
      csvEscape(catNombre),
      "", "",
    ].join(",")
  }

  const filas: string[] = [META_HEADER]
  for (let i = 0; i < itemsFiltrados.length; i += 10) {
    const lote = itemsFiltrados.slice(i, i + 10)
    const res  = await Promise.all(lote.map(procesarMeta))
    filas.push(...res)
  }

  return new Response(filas.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jbg-meta-catalog.csv"`,
      ...CORS,
    }
  })
}


async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("")
}

async function hasCronAccess(req: Request, supabaseUrl: string, serviceKey: string): Promise<boolean> {
  const supplied = (req.headers.get("x-jbg-cron-secret") || "").trim()
  if (!supplied) return false

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/jbg_get_menu_cron_secret`, {
    method: "POST",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  })
  if (!res.ok) return false

  const expectedRaw = await res.json().catch(() => null)
  const expected = typeof expectedRaw === "string" ? expectedRaw : ""
  if (!expected || supplied.length !== expected.length) return false

  let diff = 0
  for (let n = 0; n < supplied.length; n++) diff |= supplied.charCodeAt(n) ^ expected.charCodeAt(n)
  return diff === 0
}

async function hasAdminSession(req: Request, supabaseUrl: string, serviceKey: string): Promise<boolean> {
  const auth = req.headers.get("authorization") || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  if (!token) return false
  const hash = await sha256Hex(token)
  const now = encodeURIComponent(new Date().toISOString())
  const res = await fetch(
    `${supabaseUrl}/rest/v1/jbg_admin_sessions?token_hash=eq.${hash}&expires_at=gt.${now}&select=token_hash&limit=1`,
    { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
  )
  if (!res.ok) return false
  const rows = await res.json()
  return rows.length > 0
}

// ─── Handler principal ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", ...CORS }
  })

  try {
    const TOKEN       = Deno.env.get("LOYVERSE_TOKEN")
    const SUPA_URL    = Deno.env.get("SUPABASE_URL")
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!TOKEN)                    throw new Error("LOYVERSE_TOKEN no configurado")
    if (!SUPA_URL || !SERVICE_KEY) throw new Error("Variables de Supabase no configuradas")

    const loyHeaders = { Authorization: `Bearer ${TOKEN}` }
    const url        = new URL(req.url)
    const metaFeed      = url.searchParams.get("meta") === "1"
    const debugSales    = url.searchParams.get("debug_sales") === "1"
    const debugItem     = url.searchParams.get("debug_item") === "1"
    const syncRequested = url.searchParams.get("sync") === "true"
    const warmImages     = url.searchParams.get("warm_images") === "1"
    const soloLeer      = !syncRequested && !warmImages && !debugSales && !metaFeed && !debugItem

    if (warmImages) {
      const warmAdminAllowed = await hasAdminSession(req, SUPA_URL, SERVICE_KEY)
      const warmCronAllowed = !warmAdminAllowed
        ? await hasCronAccess(req, SUPA_URL, SERVICE_KEY)
        : false
      if (!warmAdminAllowed && !warmCronAllowed) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...CORS }
        })
      }

      const cached = await getCachedMenuData(SUPA_URL, SERVICE_KEY)
      const pending = cached.reduce((sum: number, cat: any) =>
        sum + (cat?.i || []).filter((item: any) =>
          typeof item?.img === "string" && item.img.includes("api.loyverse.com/image/")
        ).length, 0)

      if (pending > 0) EdgeRuntime.waitUntil(warmCachedMenuImages(cached, SUPA_URL, SERVICE_KEY))

      return new Response(JSON.stringify({ ok: true, pending, background: pending > 0 }), {
        status: pending > 0 ? 202 : 200,
        headers: { "Content-Type": "application/json", ...CORS }
      })
    }

    const adminAllowed = (syncRequested || debugSales || debugItem)
      ? await hasAdminSession(req, SUPA_URL, SERVICE_KEY)
      : false
    const cronAllowed = syncRequested && !adminAllowed
      ? await hasCronAccess(req, SUPA_URL, SERVICE_KEY)
      : false

    if ((syncRequested || debugSales || debugItem) && !adminAllowed && !cronAllowed) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS }
      })
    }

    // ── Caché rápida (solo menú web) ─────────────────────────────────────────
    if (soloLeer) {
      const cacheRes = await fetch(
        `${SUPA_URL}/rest/v1/menu_cache?id=eq.1&select=data,updated_at`,
        { headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` } }
      )
      if (cacheRes.ok) {
        const rows = await cacheRes.json()
        if (rows.length && Array.isArray(rows[0].data) && rows[0].data.length > 0) {
          return new Response(JSON.stringify(rows[0].data), {
            headers: {
              "Content-Type": "application/json",
              "X-Cache": "HIT",
              "X-Updated-At": rows[0].updated_at,
              ...CORS
            },
          })
        }
      }
    }

    // 1️⃣ Categorías
    const catRes = await fetch("https://api.loyverse.com/v1.0/categories?limit=250", { headers: loyHeaders })
    if (!catRes.ok) throw new Error(`Error categorías: ${catRes.status}`)
    const catData = await catRes.json()
    const catMap: Record<string, string> = {}
    for (const c of (catData.categories || [])) catMap[c.id] = c.name

    // 2️⃣ Items con paginación
    let allItems: any[] = []
    let cursor = ""
    do {
      const itemUrl = new URL("https://api.loyverse.com/v1.0/items")
      itemUrl.searchParams.set("limit", "250")
      if (cursor) itemUrl.searchParams.set("cursor", cursor)
      const res = await fetch(itemUrl.toString(), { headers: loyHeaders })
      if (!res.ok) throw new Error(`Error items: ${res.status}`)
      const data = await res.json()
      allItems = allItems.concat(data.items || [])
      cursor = data.cursor || ""
    } while (cursor)

    // ── DEBUG TEMPORAL: ver todos los campos crudos de un combo ──────────────
    // Borrar este bloque cuando ya no se necesite
    if (debugItem) {
      const combo = allItems.find(i =>
        i.item_name?.toLowerCase().includes('combo') &&
        !i.is_deleted
      )
      return new Response(JSON.stringify({
        _nota: "Campos crudos de Loyverse — borrar ?debug_item cuando termines",
        _campos_disponibles: combo ? Object.keys(combo) : [],
        item: combo ?? null,
      }, null, 2), {
        headers: { "Content-Type": "application/json", ...CORS }
      })
    }

    // ── RAMA META CATALOG (?meta=1) ──────────────────────────────────────────
    if (metaFeed) {
      return await buildMetaFeed(catMap, allItems, SUPA_URL, SERVICE_KEY)
    }

    // ── RAMA MENÚ WEB ─────────────────────────────────────────────────────────

    // 3️⃣ Filtrar
    const itemsFiltrados = allItems.filter(item => {
      if (item.is_deleted) return false
      if (!item.variants?.length) return false
      const store = item.variants[0].stores?.[0]
      if (!store?.available_for_sale) return false
      const price = parseFloat(store.price ?? item.variants[0].default_price ?? "0")
      if (!price || isNaN(price)) return false
      if (!item.item_name?.trim()) return false
      const cat = (item.category_id && catMap[item.category_id])
        ? catMap[item.category_id]
        : (item.category_name?.trim() || "Sin categoría")
      return !EXCLUIR.includes(cat.toLowerCase())
    })

    // 4️⃣ Procesar imágenes en lotes de 10
    const procesarItem = async (item: any) => {
      const store     = item.variants[0].stores[0]
      const price     = parseFloat(store.price ?? item.variants[0].default_price ?? "0")
      const catNombre = (item.category_id && catMap[item.category_id])
        ? catMap[item.category_id]
        : (item.category_name?.trim() || "Sin categoría")

      let imgUrl = null
      if (item.image_url) {
        imgUrl = await cacheImagen(item.image_url, item.id, SUPA_URL, SERVICE_KEY)
      }

      let desc = null
      if (item.description) {
        desc = item.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
        if (!desc) desc = null
      }

      return { cat: catNombre, item: { n: item.item_name.trim(), p: price, img: imgUrl, d: desc } }
    }

    const resultados: any[] = []
    for (let i = 0; i < itemsFiltrados.length; i += 10) {
      const lote = itemsFiltrados.slice(i, i + 10)
      const res  = await Promise.all(lote.map(procesarItem))
      resultados.push(...res)
    }

    // 5️⃣ Agrupar por categoría
    const grupos: Record<string, any[]> = {}
    for (const { cat, item } of resultados) {
      if (!grupos[cat]) grupos[cat] = []
      grupos[cat].push(item)
    }

    // 6️⃣ Badges desde item_sales (últimos 30 días)
    const etiquetas: Record<string, number> = {}
    const salesDebug: any[] = []
    try {
      const desde = new Date(Date.now() - 30 * 24 * 3600000).toISOString().split('T')[0]
      const hasta = new Date().toISOString().split('T')[0]
      const EXCLUIR_CATS = ['delivery','merma','tocino','ingredientes','bebidas para combos','salsas para combos','acompañantes combos']

      let salesCursor = ""
      do {
        const sUrl = new URL("https://api.loyverse.com/v1.0/item_sales")
        sUrl.searchParams.set("date_from", desde)
        sUrl.searchParams.set("date_to", hasta)
        sUrl.searchParams.set("limit", "250")
        sUrl.searchParams.set("store_id", STORE_ID)
        if (salesCursor) sUrl.searchParams.set("cursor", salesCursor)
        const sRes = await fetch(sUrl.toString(), { headers: loyHeaders })
        if (!sRes.ok) {
          const errText = await sRes.text()
          salesDebug.push({ error: sRes.status, body: errText })
          break
        }
        const sData = await sRes.json()
        salesDebug.push({ status: 'ok', count: sData.item_sales?.length, sample: sData.item_sales?.slice(0,2) })
        for (const item of (sData.item_sales || [])) {
          const nombre   = (item.item_name || '').trim()
          const cat      = (item.category_name || '').toLowerCase()
          const vendidos = parseFloat(item.items_sold || 0)
          if (!nombre || vendidos <= 0) continue
          if (EXCLUIR_CATS.some(e => cat.includes(e))) continue
          etiquetas[nombre] = (etiquetas[nombre] || 0) + vendidos
        }
        salesCursor = sData.cursor || ""
      } while (salesCursor)
    } catch(e) { salesDebug.push({ exception: e.message }) }

    if (debugSales) {
      return new Response(JSON.stringify({ salesDebug, etiquetas }, null, 2), {
        headers: { "Content-Type": "application/json", ...CORS }
      })
    }

    const badges: Record<string, string> = {}
    const sortedVentas = Object.entries(etiquetas).sort((a, b) => b[1] - a[1])
    if (sortedVentas.length > 0) badges[sortedVentas[0][0]] = '⭐ Producto estrella'
    for (let i = 1; i < Math.min(4, sortedVentas.length); i++) {
      badges[sortedVentas[i][0]] = '🔥 Más pedido'
    }

    // 7️⃣ Emojis + ordenar + badges
    const resultado = Object.entries(grupos)
      .map(([cat, items]) => {
        const key   = cat.toLowerCase()
        const emoji = EMOJI_MAP[key] ?? "🍽️"
        const itemsConBadge = items
          .map(item => ({ ...item, badge: badges[item.n] || null }))
          .sort((a, b) => {
            if (a.badge === '⭐ Producto estrella') return -1
            if (b.badge === '⭐ Producto estrella') return 1
            if (a.badge && !b.badge) return -1
            if (!a.badge && b.badge) return 1
            return a.n.localeCompare(b.n)
          })
        return { n: `${emoji} ${cat}`, i: itemsConBadge, _order: CAT_ORDER.indexOf(key) }
      })
      .sort((a, b) => {
        if (a._order === -1 && b._order === -1) return a.n.localeCompare(b.n)
        if (a._order === -1) return 1
        if (b._order === -1) return -1
        return a._order - b._order
      })
      .map(({ n, i }) => ({ n, i }))

    // 8️⃣ Guardar en menu_cache
    await fetch(
      `${SUPA_URL}/rest/v1/menu_cache?id=eq.1`,
      {
        method: "PATCH",
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ data: resultado, updated_at: new Date().toISOString() }),
      }
    )

    return new Response(JSON.stringify(resultado), {
      headers: { "Content-Type": "application/json", "X-Cache": "MISS", ...CORS },
    })

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
    )
  }
})