// Cria cobrança PIX no gateway configurado pela loja (Mercado Pago ou Asaas).
// Retorna QR Code + payload para o cliente pagar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function createMercadoPagoPix(opts: {
  token: string;
  amount: number;
  description: string;
  externalReference: string;
  payerEmail?: string;
  splitRecipientId?: string;
  marketplaceFeePct?: number;
  notificationUrl: string;
}) {
  const body: any = {
    transaction_amount: Number(opts.amount.toFixed(2)),
    payment_method_id: "pix",
    description: opts.description,
    external_reference: opts.externalReference,
    notification_url: opts.notificationUrl,
    payer: { email: opts.payerEmail || "comprador@example.com" },
  };
  if (opts.splitRecipientId && opts.marketplaceFeePct) {
    body.application_fee = +(opts.amount * opts.marketplaceFeePct / 100).toFixed(2);
  }
  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${opts.token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": opts.externalReference,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Mercado Pago error");
  return {
    external_id: String(data.id),
    qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
    qr_code_payload: data.point_of_interaction?.transaction_data?.qr_code ?? null,
    ticket_url: data.point_of_interaction?.transaction_data?.ticket_url ?? null,
    raw: data,
  };
}

async function createAsaasPix(opts: {
  token: string;
  sandbox: boolean;
  amount: number;
  description: string;
  externalReference: string;
  customer: { name: string; cpfCnpj?: string; email?: string };
  splitRecipientId?: string;
  marketplaceFeePct?: number;
}) {
  const base = opts.sandbox
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";
  // 1) cria cliente
  const cRes = await fetch(`${base}/customers`, {
    method: "POST",
    headers: { "access_token": opts.token, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: opts.customer.name,
      cpfCnpj: opts.customer.cpfCnpj || "00000000000",
      email: opts.customer.email,
    }),
  });
  const cData = await cRes.json();
  if (!cRes.ok) throw new Error(cData?.errors?.[0]?.description || "Asaas customer error");

  // 2) cria cobrança PIX
  const due = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
  const body: any = {
    customer: cData.id,
    billingType: "PIX",
    value: Number(opts.amount.toFixed(2)),
    dueDate: due,
    description: opts.description,
    externalReference: opts.externalReference,
  };
  if (opts.splitRecipientId && opts.marketplaceFeePct) {
    body.split = [{
      walletId: opts.splitRecipientId,
      percentualValue: 100 - opts.marketplaceFeePct,
    }];
  }
  const pRes = await fetch(`${base}/payments`, {
    method: "POST",
    headers: { "access_token": opts.token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const pData = await pRes.json();
  if (!pRes.ok) throw new Error(pData?.errors?.[0]?.description || "Asaas payment error");

  // 3) busca QR code
  const qRes = await fetch(`${base}/payments/${pData.id}/pixQrCode`, {
    headers: { "access_token": opts.token },
  });
  const qData = await qRes.json();

  return {
    external_id: pData.id,
    qr_code_base64: qData.encodedImage ?? null,
    qr_code_payload: qData.payload ?? null,
    ticket_url: pData.invoiceUrl ?? null,
    raw: { payment: pData, qr: qData },
  };
}

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
    const orderId = body.order_id as string | undefined;
    const sessionId = body.table_session_id as string | undefined;
    const explicitAmount = body.amount as number | undefined;
    if (!orderId && !sessionId) return json({ error: "missing order_id or table_session_id" }, 400);

    let storeId: string;
    let amount: number;
    let payerName: string;
    let reference: string;

    if (orderId) {
      const { data: order } = await admin
        .from("orders")
        .select("id, store_id, user_id, total, customer_name, customer_phone")
        .eq("id", orderId)
        .maybeSingle();
      if (!order) return json({ error: "order not found" }, 404);
      if (order.user_id !== user.id) return json({ error: "forbidden" }, 403);
      storeId = order.store_id;
      amount = Number(order.total);
      payerName = order.customer_name;
      reference = order.id;
    } else {
      const { data: sess } = await admin
        .from("table_sessions")
        .select("id, store_id, total, paid_amount")
        .eq("id", sessionId)
        .maybeSingle();
      if (!sess) return json({ error: "session not found" }, 404);
      const remaining = Math.max(0, Number(sess.total) - Number(sess.paid_amount || 0));
      amount = explicitAmount && explicitAmount > 0 ? Math.min(explicitAmount, remaining) : remaining;
      if (amount <= 0) return json({ error: "session already paid" }, 400);
      storeId = sess.store_id;
      payerName = "Cliente da mesa";
      reference = `mesa-${sess.id}-${Date.now()}`;
    }

    const order = orderId ? { id: reference, store_id: storeId, total: amount, customer_name: payerName } : null;

    // gateway ativo da loja (default ou primeiro ativo)
    const { data: gateway } = await admin
      .from("payment_gateways")
      .select("*")
      .eq("store_id", storeId)
      .eq("active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!gateway) return json({ error: "store has no active payment gateway" }, 400);

    const tokenSecretName = gateway.access_token_secret_name as string | null;
    if (!tokenSecretName) return json({ error: "gateway missing access token" }, 400);
    const accessToken = Deno.env.get(tokenSecretName);
    if (!accessToken) return json({ error: `secret ${tokenSecretName} not set` }, 500);

    const notificationUrl = `${SUPABASE_URL}/functions/v1/pix-webhook?gateway=${gateway.provider}&store=${storeId}`;
    const description = orderId
      ? `Pedido #${reference.slice(0, 8)}`
      : `Comanda mesa ${reference.slice(5, 13)}`;

    let result;
    if (gateway.provider === "mercadopago") {
      result = await createMercadoPagoPix({
        token: accessToken,
        amount,
        description,
        externalReference: reference,
        payerEmail: user.email ?? undefined,
        splitRecipientId: gateway.split_enabled ? gateway.split_recipient_id : undefined,
        marketplaceFeePct: gateway.split_enabled ? Number(gateway.marketplace_fee_percent) : undefined,
        notificationUrl,
      });
    } else if (gateway.provider === "asaas") {
      result = await createAsaasPix({
        token: accessToken,
        sandbox: !!gateway.sandbox,
        amount,
        description,
        externalReference: reference,
        customer: { name: payerName, email: user.email ?? undefined },
        splitRecipientId: gateway.split_enabled ? gateway.split_recipient_id : undefined,
        marketplaceFeePct: gateway.split_enabled ? Number(gateway.marketplace_fee_percent) : undefined,
      });
    } else {
      return json({ error: "unsupported provider" }, 400);
    }

    const { data: txn, error: txnErr } = await admin
      .from("payment_transactions")
      .insert({
        order_id: orderId ?? null,
        table_session_id: sessionId ?? null,
        store_id: storeId,
        gateway: gateway.provider,
        external_id: result.external_id,
        method: "pix",
        amount,
        status: "pending",
        qr_code_base64: result.qr_code_base64,
        qr_code_payload: result.qr_code_payload,
        ticket_url: result.ticket_url,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        raw_response: result.raw,
      })
      .select("id, qr_code_base64, qr_code_payload, ticket_url, expires_at")
      .maybeSingle();
    if (txnErr) return json({ error: txnErr.message }, 500);

    return json({ data: txn });
  } catch (e) {
    console.error("pix-create error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
