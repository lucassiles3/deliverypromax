// Webhook do Asaas: ao receber pagamento confirmado da assinatura,
// ativa a loja e estende o período da assinatura.
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
const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    // Valida token (header asaas-access-token configurado no painel do Asaas)
    if (WEBHOOK_TOKEN) {
      const sent = req.headers.get("asaas-access-token") || "";
      if (sent !== WEBHOOK_TOKEN) return json({ error: "invalid token" }, 401);
    }

    const body = await req.json();
    const event = body?.event as string | undefined;
    const payment = body?.payment;
    if (!event || !payment) return json({ ok: true });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const externalSubId = payment.subscription as string | undefined;
    if (!externalSubId) return json({ ok: true, skipped: "no subscription" });

    const { data: storeSub } = await admin
      .from("store_subscriptions")
      .select("id, store_id, plan_id, current_period_end")
      .eq("gateway_subscription_id", externalSubId)
      .maybeSingle();
    if (!storeSub) return json({ ok: true, skipped: "subscription not found" });

    const paid = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event);
    const failed = ["PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_CHARGEBACK_REQUESTED"].includes(event);

    // Atualiza/insere registro do pagamento
    await admin.from("subscription_payments").upsert({
      store_id: storeSub.store_id,
      subscription_id: storeSub.id,
      gateway: "asaas",
      external_id: payment.id,
      external_subscription_id: externalSubId,
      amount: payment.value,
      status: (payment.status || event).toLowerCase(),
      billing_type: payment.billingType,
      due_date: payment.dueDate,
      paid_at: paid ? new Date().toISOString() : null,
      invoice_url: payment.invoiceUrl,
      raw: body,
    }, { onConflict: "external_id" });

    if (paid) {
      // Estende a assinatura por 30 dias a partir do period_end (ou agora)
      const base = storeSub.current_period_end && new Date(storeSub.current_period_end) > new Date()
        ? new Date(storeSub.current_period_end)
        : new Date();
      const newEnd = new Date(base.getTime() + 30 * 86400_000).toISOString();

      await admin.from("store_subscriptions").update({
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: newEnd,
        next_payment_at: newEnd,
        cancelled_at: null,
      }).eq("id", storeSub.id);

      await admin.from("stores").update({
        lifecycle_status: "active",
        lifecycle_reason: "Assinatura PRO ativa",
        lifecycle_changed_at: new Date().toISOString(),
      }).eq("id", storeSub.store_id);

      // Notifica o lojista
      const { data: store } = await admin
        .from("stores").select("owner_id, name").eq("id", storeSub.store_id).maybeSingle();
      if (store?.owner_id) {
        await admin.from("notifications").insert({
          user_id: store.owner_id,
          store_id: storeSub.store_id,
          title: "✅ Assinatura PRO ativada",
          message: `Pagamento confirmado. Sua loja "${store.name}" está liberada.`,
          type: "success",
          link: "/admin",
        });
      }
    } else if (failed) {
      await admin.from("store_subscriptions").update({
        status: event === "PAYMENT_OVERDUE" ? "overdue" : "cancelled",
      }).eq("id", storeSub.id);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("subscription-webhook error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
