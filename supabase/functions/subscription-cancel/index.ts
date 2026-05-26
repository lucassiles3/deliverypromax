// Cancela a assinatura PRO no Asaas e marca como cancelada localmente.
// O acesso permanece liberado até current_period_end.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ASAAS_API_KEY = (Deno.env.get("ASAAS_API_KEY") ?? "").trim();
const ASAAS_ENV_RAW = (Deno.env.get("ASAAS_ENV") ?? "").trim().toLowerCase();
const KEY_IS_PROD = /\$aact_prod_/i.test(ASAAS_API_KEY);
const KEY_IS_SANDBOX = /\$aact_hmlg_/i.test(ASAAS_API_KEY);
const IS_PROD = KEY_IS_PROD || (!KEY_IS_SANDBOX && (ASAAS_ENV_RAW === "production" || ASAAS_ENV_RAW === "prod" || ASAAS_ENV_RAW === "live"));
const ASAAS_BASE = IS_PROD ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas error ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    if (!ASAAS_API_KEY) return json({ error: "ASAAS_API_KEY not configured" }, 500);

    const auth = req.headers.get("authorization") || "";
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "unauthenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (userErr || !user) return json({ error: "invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id as string | undefined;
    if (!storeId) return json({ error: "missing store_id" }, 400);

    const { data: store } = await admin
      .from("stores").select("id, owner_id").eq("id", storeId).maybeSingle();
    if (!store) return json({ error: "store not found" }, 404);
    if (store.owner_id !== user.id) return json({ error: "forbidden" }, 403);

    const { data: sub } = await admin
      .from("store_subscriptions").select("*").eq("store_id", storeId).maybeSingle();
    if (!sub) return json({ error: "no subscription" }, 404);

    // 1) Cancela no Asaas (deleta assinatura e cobranças futuras)
    if (sub.gateway_subscription_id) {
      await asaas(`/subscriptions/${sub.gateway_subscription_id}`, { method: "DELETE" }).catch((e) => {
        console.error("asaas delete failed", e);
      });
    }

    // 2) Marca como cancelada. Mantém current_period_end para o usuário continuar até expirar.
    await admin.from("store_subscriptions").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    }).eq("store_id", storeId);

    return json({ ok: true, ends_at: sub.current_period_end ?? sub.trial_ends_at });
  } catch (e) {
    console.error("subscription-cancel error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
