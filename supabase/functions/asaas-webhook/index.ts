// Webhook público do Asaas. Configure no painel Asaas em:
//   Integrações → Webhooks → Nova URL
// URL: https://wguhkvnzoklrivydgrda.supabase.co/functions/v1/asaas-webhook
// Token de autenticação: o mesmo valor do secret ASAAS_WEBHOOK_TOKEN
// (Asaas envia esse token no header "asaas-access-token")
//
// Eventos tratados (assinatura PRO):
//   PAYMENT_CONFIRMED / PAYMENT_RECEIVED   → ativa assinatura e estende period_end +1 mês
//   PAYMENT_OVERDUE                        → marca como overdue (libera tela de renovação)
//   PAYMENT_REFUNDED / PAYMENT_DELETED     → marca cobrança como refunded/cancelled
//   SUBSCRIPTION_DELETED / _INACTIVATED    → marca a assinatura como cancelled
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_TOKEN = (Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "").trim();

function addOneMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    if (!WEBHOOK_TOKEN) return json({ error: "webhook not configured" }, 503);

    // Asaas envia o token em "asaas-access-token". Aceitamos também Authorization Bearer p/ testes.
    const provided =
      req.headers.get("asaas-access-token") ||
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (provided !== WEBHOOK_TOKEN) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({} as any));
    const event = String(body?.event ?? "");
    const payment = body?.payment ?? null;
    const subscription = body?.subscription ?? null;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    console.log("[asaas-webhook]", event, "payment:", payment?.id, "sub:", payment?.subscription ?? subscription?.id);

    // ===== Eventos de pagamento =====
    if (payment?.id && event.startsWith("PAYMENT_")) {
      const externalSubId: string | null = payment.subscription ?? null;
      const status =
        event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED" ? "paid"
        : event === "PAYMENT_OVERDUE" ? "overdue"
        : event === "PAYMENT_REFUNDED" ? "refunded"
        : event === "PAYMENT_DELETED" ? "cancelled"
        : (payment.status || "pending").toLowerCase();

      // Localiza a assinatura local pelo gateway_subscription_id (ou pelo customer)
      let subRow: any = null;
      if (externalSubId) {
        const { data } = await admin
          .from("store_subscriptions")
          .select("id, store_id, current_period_end")
          .eq("gateway_subscription_id", externalSubId)
          .maybeSingle();
        subRow = data;
      }
      if (!subRow && payment.customer) {
        const { data } = await admin
          .from("store_subscriptions")
          .select("id, store_id, current_period_end")
          .eq("gateway_customer_id", payment.customer)
          .maybeSingle();
        subRow = data;
      }

      // Upsert da cobrança
      await admin.from("subscription_payments").upsert({
        store_id: subRow?.store_id ?? null,
        subscription_id: subRow?.id ?? null,
        gateway: "asaas",
        external_id: payment.id,
        external_subscription_id: externalSubId,
        amount: payment.value ?? payment.netValue ?? 0,
        status,
        billing_type: payment.billingType,
        due_date: payment.dueDate,
        paid_at: payment.paymentDate ? new Date(payment.paymentDate).toISOString() : null,
        invoice_url: payment.invoiceUrl,
        raw: body,
      }, { onConflict: "external_id" });

      // Atualiza estado da assinatura
      if (subRow) {
        if (status === "paid") {
          const base = subRow.current_period_end && new Date(subRow.current_period_end) > new Date()
            ? new Date(subRow.current_period_end)
            : new Date();
          const newEnd = addOneMonth(base);
          await admin.from("store_subscriptions").update({
            status: "active",
            current_period_start: new Date().toISOString(),
            current_period_end: newEnd.toISOString(),
            last_payment_at: new Date().toISOString(),
          }).eq("id", subRow.id);
        } else if (status === "overdue") {
          await admin.from("store_subscriptions").update({
            status: "overdue",
          }).eq("id", subRow.id);
        }
      }

      return json({ ok: true, handled: event, status });
    }

    // ===== Eventos de assinatura =====
    if (subscription?.id && event.startsWith("SUBSCRIPTION_")) {
      const cancelStates = ["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_EXPIRED"];
      if (cancelStates.includes(event)) {
        await admin.from("store_subscriptions").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        }).eq("gateway_subscription_id", subscription.id);
      }
      return json({ ok: true, handled: event });
    }

    return json({ ok: true, ignored: event });
  } catch (e) {
    console.error("asaas-webhook error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
