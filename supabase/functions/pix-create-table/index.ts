// PIX direto pela mesa (cliente sem login). Valida pelo qr_token da mesa.
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
  token: string; amount: number; description: string; externalReference: string;
  notificationUrl: string; splitRecipientId?: string; marketplaceFeePct?: number;
}) {
  const body: any = {
    transaction_amount: Number(opts.amount.toFixed(2)),
    payment_method_id: "pix",
    description: opts.description,
    external_reference: opts.externalReference,
    notification_url: opts.notificationUrl,
    payer: { email: "mesa@example.com" },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const qrToken = body.qr_token as string | undefined;
    const requested = Number(body.amount || 0);
    if (!qrToken) return json({ error: "missing qr_token" }, 400);

    const { data: table } = await admin
      .from("tables")
      .select("id, store_id, number")
      .eq("qr_token", qrToken)
      .maybeSingle();
    if (!table) return json({ error: "invalid table token" }, 404);

    const { data: sess } = await admin
      .from("table_sessions")
      .select("id, store_id, total, paid_amount")
      .eq("table_id", table.id)
      .eq("status", "open")
      .maybeSingle();
    if (!sess) return json({ error: "no open session" }, 404);

    const remaining = Math.max(0, Number(sess.total) - Number(sess.paid_amount || 0));
    const amount = requested > 0 ? Math.min(requested, remaining) : remaining;
    if (amount <= 0) return json({ error: "session already paid" }, 400);

    const { data: gateway } = await admin
      .from("payment_gateways")
      .select("*")
      .eq("store_id", sess.store_id)
      .eq("active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!gateway) return json({ error: "no active gateway" }, 400);
    if (gateway.provider !== "mercadopago") {
      return json({ error: "PIX da mesa disponível apenas para Mercado Pago no momento" }, 400);
    }

    const tokenSecretName = gateway.access_token_secret_name as string | null;
    if (!tokenSecretName) return json({ error: "gateway missing token" }, 400);
    const accessToken = Deno.env.get(tokenSecretName);
    if (!accessToken) return json({ error: `secret ${tokenSecretName} not set` }, 500);

    const reference = `mesa-${sess.id}-${Date.now()}`;
    const notificationUrl = `${SUPABASE_URL}/functions/v1/pix-webhook?gateway=${gateway.provider}&store=${sess.store_id}`;

    const result = await createMercadoPagoPix({
      token: accessToken,
      amount,
      description: `Mesa ${table.number}`,
      externalReference: reference,
      notificationUrl,
      splitRecipientId: gateway.split_enabled ? gateway.split_recipient_id : undefined,
      marketplaceFeePct: gateway.split_enabled ? Number(gateway.marketplace_fee_percent) : undefined,
    });

    const { data: txn, error: txnErr } = await admin
      .from("payment_transactions")
      .insert({
        order_id: null,
        table_session_id: sess.id,
        store_id: sess.store_id,
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
      .select("id, qr_code_base64, qr_code_payload, ticket_url, expires_at, amount")
      .maybeSingle();
    if (txnErr) return json({ error: txnErr.message }, 500);

    return json({ data: txn });
  } catch (e) {
    console.error("pix-create-table", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
