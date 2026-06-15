// Recebe notificações da InfinitePay quando o pagamento de um link é aprovado/recusado.
// Marca o pedido correspondente como pago em tempo real, registra a transação
// completa (receipt_url, capture_method, paid_amount, transaction_nsu) e notifica
// cliente + loja.
//
// Payload esperado:
// {
//   "amount": 100,
//   "order_nsu": "<uuid-do-pedido>",
//   "paid_amount": 106,
//   "receipt_url": "https://recibo.infinitepay.io/...",
//   "installments": 1,
//   "capture_method": "credit_card",
//   "transaction_nsu": "a10558cd-..."
// }
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    try {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    } catch {
      body = {};
    }
  }

  console.log("[infinitepay-webhook] payload:", JSON.stringify(body).slice(0, 2000));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const logEvent = async (
    severity: "info" | "warning" | "error",
    message: string,
    metadata: Record<string, unknown> = {},
    store_id?: string,
  ) => {
    try {
      await supabase.from("platform_logs").insert({
        event_type: "infinitepay_webhook",
        severity,
        message,
        metadata,
        store_id: store_id ?? null,
      } as any);
    } catch (e) {
      console.error("[infinitepay-webhook] log insert error:", e);
    }
  };

  // -------- Extração de campos (tolerante a aliases) --------
  const orderNsu: string | undefined =
    body?.order_nsu ?? body?.orderNsu ?? body?.metadata?.order_nsu ?? body?.data?.order_nsu;
  const transactionNsu: string | undefined =
    body?.transaction_nsu ?? body?.transactionNsu ?? body?.id ?? body?.data?.id;
  const amount: number =
    Number(body?.amount ?? body?.data?.amount ?? 0) || 0;
  const paidAmount: number =
    Number(body?.paid_amount ?? body?.paidAmount ?? body?.data?.paid_amount ?? amount) || 0;
  const captureMethod: string =
    String(body?.capture_method ?? body?.captureMethod ?? body?.payment_method ?? "credit_card");
  const receiptUrl: string | undefined =
    body?.receipt_url ?? body?.receiptUrl ?? body?.data?.receipt_url;
  const installments: number =
    Number(body?.installments ?? body?.data?.installments ?? 1) || 1;

  // Status normalizado (se não vier, presume aprovado quando há paid_amount/receipt_url)
  const rawStatus = String(
    body?.status ?? body?.payment_status ?? body?.transaction_status ?? body?.event ?? "",
  ).toLowerCase();
  const refused = ["refused", "failed", "declined", "cancelled", "canceled", "expired", "voided"]
    .some((s) => rawStatus.includes(s));
  const approvedByStatus = ["paid", "approved", "success", "succeeded", "authorized", "captured", "completed"]
    .some((s) => rawStatus.includes(s));
  const approved = !refused && (approvedByStatus || (!!receiptUrl && paidAmount > 0) || (!rawStatus && !!transactionNsu));

  // -------- Validações --------
  if (!orderNsu) {
    await logEvent("warning", "Webhook sem order_nsu", { body });
    return json({ ok: false, error: "missing order_nsu" }, 400);
  }
  if (!transactionNsu) {
    await logEvent("warning", "Webhook sem transaction_nsu", { body });
    return json({ ok: false, error: "missing transaction_nsu" }, 400);
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNsu);
  if (!isUuid) {
    await logEvent("warning", `order_nsu não-uuid: ${orderNsu}`, { body });
    return json({ ok: false, error: "invalid order_nsu" }, 400);
  }

  try {
    // -------- Idempotência por transaction_nsu --------
    const { data: existing } = await supabase
      .from("payment_transactions")
      .select("id, status, order_id")
      .eq("gateway", "infinitepay")
      .eq("external_id", transactionNsu)
      .maybeSingle();
    if (existing) {
      await logEvent("info", "Webhook duplicado ignorado", { transactionNsu, order_id: existing.order_id });
      return json({ ok: true, duplicate: true });
    }

    // -------- Localiza o pedido --------
    const { data: order } = await supabase
      .from("orders")
      .select("id, store_id, user_id, status, total")
      .eq("id", orderNsu)
      .maybeSingle();

    if (!order) {
      await logEvent("error", `Pedido não encontrado: ${orderNsu}`, { body });
      return json({ ok: false, error: "order not found" }, 404);
    }

    if (approved) {
      // 1) Atualiza pedido para "received" se ainda estava aguardando pagamento + marca como pago
      const nowIso = new Date().toISOString();
      if (order.status === "pending_payment") {
        await supabase
          .from("orders")
          .update({
            status: "received",
            payment_status: "paid",
            paid_at: nowIso,
            ...(receiptUrl ? { notes: `[RECIBO_PAGAMENTO] ${receiptUrl}` } : {}),
          } as any)
          .eq("id", orderNsu);
      } else {
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            paid_at: nowIso,
            ...(receiptUrl ? { notes: `[RECIBO_PAGAMENTO] ${receiptUrl}` } : {}),
          } as any)
          .eq("id", orderNsu);
      }


      // 2) Registra a transação aprovada
      const { error: insErr } = await supabase.from("payment_transactions").insert({
        order_id: order.id,
        store_id: order.store_id,
        gateway: "infinitepay",
        method: captureMethod || "credit_card",
        status: "approved",
        amount: paidAmount || amount || order.total || 0,
        external_id: transactionNsu,
        ticket_url: receiptUrl ?? null,
        raw_webhook: body,
        paid_at: new Date().toISOString(),
      } as any);
      if (insErr && !String(insErr.message).includes("duplicate")) {
        console.error("[infinitepay-webhook] insert error:", insErr);
        await logEvent("error", "Falha ao inserir transação", { error: insErr.message, order_id: order.id }, order.store_id);
      }

      // 3) Notifica o lojista ("Pagamento confirmado")
      const { data: store } = await supabase
        .from("stores").select("owner_id, name").eq("id", order.store_id).maybeSingle();
      if (store?.owner_id) {
        await supabase.from("notifications").insert({
          user_id: store.owner_id,
          store_id: order.store_id,
          title: "💳 Pagamento confirmado",
          message: `Pedido #${order.id.slice(0, 6).toUpperCase()} foi pago. Inicie a preparação.`,
          type: "success",
          link: "/admin",
          metadata: { order_id: order.id, transaction_nsu: transactionNsu, gateway: "infinitepay" },
        } as any);
      }
      // (Cliente é notificado automaticamente pelo trigger tg_notify_customer_order_status
      //  quando o status passa de pending_payment → received.)

      await logEvent(
        "info",
        `Pagamento aprovado para pedido ${order.id}`,
        { transactionNsu, paidAmount, captureMethod, installments, receiptUrl },
        order.store_id,
      );

      return json({ ok: true, order_id: order.id, status: "paid" });
    }

    if (refused) {
      await supabase.from("payment_transactions").insert({
        order_id: order.id,
        store_id: order.store_id,
        gateway: "infinitepay",
        method: captureMethod || "credit_card",
        status: "rejected",
        amount: paidAmount || amount || 0,
        external_id: transactionNsu,
        raw_webhook: body,
      } as any);

      await logEvent("warning", `Pagamento recusado para pedido ${order.id}`, { transactionNsu, rawStatus }, order.store_id);
      return json({ ok: true, order_id: order.id, status: "refused" });
    }

    await logEvent("info", "Webhook recebido sem status conclusivo", { body }, order.store_id);
    return json({ ok: true, ignored: "inconclusive status" });
  } catch (e) {
    console.error("[infinitepay-webhook] error:", e);
    await logEvent("error", "Erro inesperado no webhook", { error: String(e) });
    return json({ ok: false, error: "internal error" }, 500);
  }
});
