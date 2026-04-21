// Stub para emissão de NFC-e. Cria registro pending em fiscal_invoices.
// Integração real (Focus NFe / PlugNotas) deve ser plugada aqui.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const auth = req.headers.get("authorization") || "";
    const userJwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (!userJwt) return json({ error: "unauthenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userRes } = await admin.auth.getUser(userJwt);
    const user = userRes?.user;
    if (!user) return json({ error: "invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id as string;
    const customerCpf = body.customer_cpf as string | undefined;
    if (!orderId) return json({ error: "missing order_id" }, 400);

    const { data: order } = await admin
      .from("orders")
      .select("id, store_id, total, customer_name")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return json({ error: "order not found" }, 404);

    const { data: cfg } = await admin
      .from("store_fiscal_config")
      .select("*")
      .eq("store_id", order.store_id)
      .maybeSingle();

    if (!cfg?.enabled) {
      // Cria registro em modo manual (apenas controle)
      const { data: inv } = await admin
        .from("fiscal_invoices")
        .insert({
          order_id: order.id,
          store_id: order.store_id,
          provider: "manual",
          status: "pending",
          total: order.total,
          customer_name: order.customer_name,
          customer_cpf: customerCpf,
          error_message: "Emissão fiscal não configurada — registro manual.",
        })
        .select()
        .maybeSingle();
      return json({ data: inv, manual: true });
    }

    // Stub: marca como processing — aqui plugar Focus NFe / PlugNotas
    const { data: inv } = await admin
      .from("fiscal_invoices")
      .insert({
        order_id: order.id,
        store_id: order.store_id,
        provider: cfg.provider,
        status: "processing",
        total: order.total,
        customer_name: order.customer_name,
        customer_cpf: customerCpf,
        serie: cfg.serie,
      })
      .select()
      .maybeSingle();

    // TODO: chamada real ao provedor (Focus NFe / PlugNotas)
    // Por enquanto, deixa "processing" — provedor real responderá via webhook.

    return json({ data: inv });
  } catch (e) {
    console.error("fiscal-emit error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
