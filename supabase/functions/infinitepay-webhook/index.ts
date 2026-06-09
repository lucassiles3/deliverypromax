// Recebe notificações da InfinitePay quando o pagamento de um link é aprovado/recusado.
// Marca o pedido correspondente como pago em tempo real.
//
// Como configurar: cada loja cadastra a URL pública desta função em "Webhook URL"
// na seção InfinitePay do admin. A InfinitePay chamará esta URL ao mudar o
// status do pagamento.
//
// Identificamos o pedido pelo `order_nsu` (que enviamos como o uuid do pedido).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // pode chegar form-encoded
    try {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    } catch {
      body = {};
    }
  }

  console.log("[infinitepay-webhook] payload:", JSON.stringify(body).slice(0, 2000));

  // Status normalizado
  const rawStatus = String(
    body?.status ?? body?.payment_status ?? body?.transaction_status ?? body?.event ?? "",
  ).toLowerCase();
  const approved = ["paid", "approved", "success", "succeeded", "authorized", "captured", "completed"]
    .some((s) => rawStatus.includes(s));
  const refused = ["refused", "failed", "declined", "cancelled", "canceled", "expired", "voided"]
    .some((s) => rawStatus.includes(s));

  // Identificadores
  const orderNsu: string | undefined =
    body?.order_nsu ?? body?.orderNsu ?? body?.metadata?.order_nsu ?? body?.data?.order_nsu;
  const transactionNsu: string | undefined =
    body?.transaction_nsu ?? body?.transactionNsu ?? body?.id ?? body?.data?.id;
  const amount: number | undefined =
    Number(body?.amount ?? body?.paid_amount ?? body?.data?.amount) || undefined;

  if (!orderNsu) {
    return new Response(JSON.stringify({ ok: true, ignored: "missing order_nsu" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // order_nsu deve ser um UUID válido — caso a loja use outro formato, apenas registramos.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNsu);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (!isUuid) {
    // Não conseguimos casar com um pedido — só armazenamos no log.
    try {
      await supabase.from("platform_logs").insert({
        kind: "infinitepay_webhook",
        message: `Webhook recebido com order_nsu não-uuid: ${orderNsu}`,
        metadata: body,
      } as any);
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (approved) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, store_id, status")
        .eq("id", orderNsu)
        .maybeSingle();

      if (order) {
        // Marca como recebido se ainda estava aguardando pagamento
        if (order.status === "pending_payment") {
          await supabase.from("orders").update({ status: "received" }).eq("id", orderNsu);
        }

        // Registra transação
        await supabase.from("payment_transactions").insert({
          order_id: orderNsu,
          store_id: order.store_id,
          gateway: "infinitepay",
          method: "credit_card",
          status: "approved",
          amount: amount ?? null,
          external_id: transactionNsu ?? null,
          raw_response: body,
        } as any);
      }
    } else if (refused) {
      await supabase.from("payment_transactions").insert({
        order_id: orderNsu,
        gateway: "infinitepay",
        method: "credit_card",
        status: "refused",
        amount: amount ?? null,
        external_id: transactionNsu ?? null,
        raw_response: body,
      } as any);
    }
  } catch (e) {
    console.error("[infinitepay-webhook] error:", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
