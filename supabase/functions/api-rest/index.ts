// FoodFlash REST API
// Auth: Authorization: Bearer ff_live_xxx
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "missing api key" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const keyHash = await sha256Hex(token);
    const { data: keyRow } = await admin
      .from("api_keys")
      .select("id, store_id, revoked_at")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (!keyRow) return json({ error: "invalid api key" }, 401);
    const storeId = keyRow.store_id as string;

    // touch last_used (fire-and-forget)
    admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then(() => {});

    const url = new URL(req.url);
    // Path is something like /api-rest/produtos or /api-rest/pedidos/<id>/status
    const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    // remove function name prefix
    const idx = parts.indexOf("api-rest");
    const route = idx >= 0 ? parts.slice(idx + 1) : parts;
    const method = req.method.toUpperCase();

    // GET /produtos
    if (method === "GET" && route[0] === "produtos" && route.length === 1) {
      const { data, error } = await admin
        .from("products")
        .select("id, name, description, category, price, old_price, active, stock, track_stock, image_url, position")
        .eq("store_id", storeId)
        .order("position");
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    // PUT /produtos/:id
    if (method === "PUT" && route[0] === "produtos" && route.length === 2) {
      const body = await req.json().catch(() => ({}));
      const allowed: Record<string, unknown> = {};
      for (const k of ["price", "old_price", "stock", "active", "name", "description", "category"]) {
        if (k in body) allowed[k] = body[k];
      }
      const { data, error } = await admin
        .from("products")
        .update(allowed)
        .eq("id", route[1])
        .eq("store_id", storeId)
        .select()
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "not found" }, 404);
      return json({ data });
    }

    // GET /pedidos?status=&from=&to=&limit=
    if (method === "GET" && route[0] === "pedidos" && route.length === 1) {
      const status = url.searchParams.get("status");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
      let q = admin
        .from("orders")
        .select("id, customer_name, customer_phone, total, subtotal, delivery_fee, status, method, payment_method, address, created_at, order_items(product_name, quantity, unit_price, notes)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (status) q = q.eq("status", status as any);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    // PUT /pedidos/:id/status
    if (method === "PUT" && route[0] === "pedidos" && route[2] === "status" && route.length === 3) {
      const body = await req.json().catch(() => ({}));
      const status = body.status as string;
      const allowed = ["received", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"];
      if (!allowed.includes(status)) return json({ error: "invalid status" }, 400);
      const { data, error } = await admin
        .from("orders")
        .update({ status })
        .eq("id", route[1])
        .eq("store_id", storeId)
        .select()
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "not found" }, 404);
      return json({ data });
    }

    // GET /relatorios/vendas?from=&to=
    if (method === "GET" && route[0] === "relatorios" && route[1] === "vendas") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      let q = admin
        .from("orders")
        .select("id, total, subtotal, delivery_fee, status, created_at, payment_method, method")
        .eq("store_id", storeId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      const summary = {
        orders: data?.length ?? 0,
        revenue: (data ?? []).reduce((s, o: any) => s + Number(o.total), 0),
      };
      return json({ summary, data });
    }

    // POST /cupons
    if (method === "POST" && route[0] === "cupons" && route.length === 1) {
      const body = await req.json().catch(() => ({}));
      const required = ["code", "label", "type", "value"];
      for (const k of required) if (!(k in body)) return json({ error: `missing ${k}` }, 400);
      const { data, error } = await admin
        .from("coupons")
        .insert({
          store_id: storeId,
          code: String(body.code).toUpperCase(),
          label: body.label,
          type: body.type,
          value: body.value,
          min_order: body.min_order ?? null,
          expires_at: body.expires_at ?? null,
          usage_limit: body.usage_limit ?? null,
          per_user_limit: body.per_user_limit ?? 1,
          active: body.active ?? true,
          visibility: body.visibility ?? "public",
        })
        .select()
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }

    // GET /clientes
    if (method === "GET" && route[0] === "clientes" && route.length === 1) {
      const { data, error } = await admin
        .from("orders")
        .select("customer_name, customer_phone, total, created_at")
        .eq("store_id", storeId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) return json({ error: error.message }, 500);
      const map = new Map<string, { name: string; phone: string; orders: number; total: number; last: string }>();
      for (const o of data ?? []) {
        const phone = (o as any).customer_phone || "";
        if (!phone) continue;
        const cur = map.get(phone) || { name: (o as any).customer_name, phone, orders: 0, total: 0, last: (o as any).created_at };
        cur.orders += 1;
        cur.total += Number((o as any).total);
        if ((o as any).created_at > cur.last) cur.last = (o as any).created_at;
        map.set(phone, cur);
      }
      return json({ data: Array.from(map.values()) });
    }

    // POST /webhooks
    if (method === "POST" && route[0] === "webhooks" && route.length === 1) {
      const body = await req.json().catch(() => ({}));
      if (!body.url) return json({ error: "missing url" }, 400);
      const secret = body.secret || crypto.randomUUID().replace(/-/g, "");
      const events = Array.isArray(body.events) && body.events.length
        ? body.events
        : ["order.created", "order.status_changed", "order.cancelled"];
      const { data, error } = await admin
        .from("webhooks")
        .insert({ store_id: storeId, url: body.url, secret, events, active: true })
        .select()
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }

    return json({ error: "route not found", method, route }, 404);
  } catch (e) {
    console.error("api-rest error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
