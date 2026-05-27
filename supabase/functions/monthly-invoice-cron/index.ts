// CRON mensal — gera fatura consolidada do mês anterior para cada loja com assinatura.
// - Modelo "fixed_plus_per_order": cria payment Asaas com R$1 × pedidos entregues
// - Modelo "commission":          cria payment Asaas com 10% × vendas entregues
// Agende este endpoint para rodar no dia 1 de cada mês.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = (Deno.env.get("ASAAS_API_KEY") ?? "").trim();
const KEY_IS_PROD = /\$aact_prod_/i.test(ASAAS_API_KEY);
const KEY_IS_SANDBOX = /\$aact_hmlg_/i.test(ASAAS_API_KEY);
const ASAAS_ENV_RAW = (Deno.env.get("ASAAS_ENV") ?? "").trim().toLowerCase();
const IS_PROD = KEY_IS_PROD || (!KEY_IS_SANDBOX && (ASAAS_ENV_RAW === "production" || ASAAS_ENV_RAW === "prod" || ASAAS_ENV_RAW === "live"));
const ASAAS_BASE = IS_PROD ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas ${res.status}`);
  return data;
}

function previousMonthPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({} as any));
    const { start, end } = body?.period_start && body?.period_end
      ? { start: body.period_start as string, end: body.period_end as string }
      : previousMonthPeriod();

    const { data: subs, error } = await admin
      .from("store_subscriptions")
      .select("id, store_id, billing_model, per_order_fee, commission_percent, gateway_customer_id, status, stores:store_id(name)")
      .in("status", ["active", "trial", "overdue"]);
    if (error) throw error;

    const dueDate = new Date(new Date(end).getTime() + 5 * 86400_000).toISOString().slice(0, 10);
    const results: any[] = [];

    for (const sub of subs ?? []) {
      try {
        // 1) Gera fatura local via função SQL
        const { data: invId, error: rpcErr } = await admin.rpc("generate_monthly_invoice", {
          _store_id: sub.store_id,
          _period_start: start,
        });
        if (rpcErr) throw rpcErr;

        const { data: invoice } = await admin
          .from("monthly_invoices")
          .select("*")
          .eq("id", invId)
          .maybeSingle();
        if (!invoice || Number(invoice.total_amount) <= 0) {
          results.push({ store_id: sub.store_id, skipped: "no_amount" });
          continue;
        }
        if (invoice.asaas_payment_id) {
          results.push({ store_id: sub.store_id, skipped: "already_invoiced", payment_id: invoice.asaas_payment_id });
          continue;
        }
        if (!sub.gateway_customer_id) {
          results.push({ store_id: sub.store_id, skipped: "no_customer" });
          continue;
        }

        // 2) Cria payment avulso no Asaas
        const description = sub.billing_model === "commission"
          ? `Comissão ${start} a ${end} (${invoice.orders_count} pedidos)`
          : `Taxa por pedido ${start} a ${end} (${invoice.orders_count} × R$ ${Number(sub.per_order_fee).toFixed(2)})`;

        const payment = await asaas("/payments", {
          method: "POST",
          body: JSON.stringify({
            customer: sub.gateway_customer_id,
            billingType: "PIX",
            value: Number(invoice.total_amount),
            dueDate,
            description,
            externalReference: `invoice:${invoice.id}`,
          }),
        });

        await admin.from("monthly_invoices").update({
          status: "pending",
          asaas_payment_id: payment.id,
          invoice_url: payment.invoiceUrl,
          due_date: payment.dueDate,
          raw: { payment },
        }).eq("id", invoice.id);

        results.push({ store_id: sub.store_id, invoice_id: invoice.id, payment_id: payment.id, amount: invoice.total_amount });
      } catch (e) {
        console.error("invoice fail", sub.store_id, e);
        results.push({ store_id: sub.store_id, error: e instanceof Error ? e.message : "unknown" });
      }
    }

    return json({ ok: true, period: { start, end }, processed: results.length, results });
  } catch (e) {
    console.error("monthly-invoice-cron", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
