// Webhook de confirmação de pagamento PIX (Mercado Pago / Asaas).
// Atualiza payment_transactions e o status do pedido.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-signature, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ok = () => new Response("ok", { headers: corsHeaders });

async function fetchMpPayment(token: string, paymentId: string) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  return r.ok ? await r.json() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("gateway");
    const storeId = url.searchParams.get("store");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));

    let externalId: string | null = null;
    let approved = false;
    let raw: any = body;

    if (provider === "mercadopago") {
      // payload: { type: 'payment', data: { id } }
      const id = body?.data?.id || body?.resource?.split?.("/")?.pop();
      if (!id) return ok();
      // busca o pagamento para confirmar status (precisamos do token da loja)
      const { data: gw } = await admin
        .from("payment_gateways")
        .select("access_token_secret_name")
        .eq("store_id", storeId)
        .eq("provider", "mercadopago")
        .maybeSingle();
      const token = gw?.access_token_secret_name ? Deno.env.get(gw.access_token_secret_name) : null;
      if (token) {
        const pay = await fetchMpPayment(token, String(id));
        if (pay) {
          externalId = String(pay.id);
          approved = pay.status === "approved";
          raw = pay;
        }
      }
    } else if (provider === "asaas") {
      // payload: { event: 'PAYMENT_RECEIVED', payment: { id, status, ... } }
      externalId = body?.payment?.id ?? null;
      approved = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(body?.payment?.status);
    } else {
      return new Response("unknown gateway", { status: 400, headers: corsHeaders });
    }

    if (!externalId) return ok();

    // localiza transação
    const { data: txn } = await admin
      .from("payment_transactions")
      .select("id, order_id, store_id, status")
      .eq("external_id", externalId)
      .maybeSingle();
    if (!txn) return ok();

    const newStatus = approved ? "approved" : (txn.status === "pending" ? "pending" : txn.status);

    await admin
      .from("payment_transactions")
      .update({
        status: newStatus,
        paid_at: approved ? new Date().toISOString() : null,
        raw_webhook: raw,
      })
      .eq("id", txn.id);

    if (approved) {
      // pagamento confirmado -> entra direto em "preparo" (real time no Kanban)
      const nowIso = new Date().toISOString();
      await admin
        .from("orders")
        .update({ status: "preparing", accepted_at: nowIso })
        .eq("id", txn.order_id)
        .in("status", ["pending_payment", "received"]);
    }

    return ok();
  } catch (e) {
    console.error("pix-webhook error", e);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});
