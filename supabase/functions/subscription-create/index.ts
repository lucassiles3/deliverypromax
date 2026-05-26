// Cria/recupera assinatura PRO no Asaas para a loja do usuário autenticado.
// Plano: R$ 150 / mês, cobrança PIX. Retorna QR Code da primeira cobrança.
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
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE = (Deno.env.get("ASAAS_ENV") === "production")
  ? "https://api.asaas.com/v3"
  : "https://sandbox.asaas.com/api/v3";

const PRO_PRICE = 150.0;

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: {
      "access_token": ASAAS_API_KEY,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description || `Asaas error ${res.status}`;
    throw new Error(msg);
  }
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
    const cpfCnpj = (body.cpfCnpj as string | undefined)?.replace(/\D/g, "");
    if (!storeId) return json({ error: "missing store_id" }, 400);

    const { data: store } = await admin
      .from("stores")
      .select("id, name, owner_id, phone")
      .eq("id", storeId)
      .maybeSingle();
    if (!store) return json({ error: "store not found" }, 404);
    if (store.owner_id !== user.id) return json({ error: "forbidden" }, 403);

    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, phone")
      .eq("id", user.id)
      .maybeSingle();

    // Carrega assinatura existente
    const { data: sub } = await admin
      .from("store_subscriptions")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();

    const { data: proPlan } = await admin
      .from("subscription_plans")
      .select("id")
      .eq("slug", "pro")
      .maybeSingle();

    // 1) Garante customer no Asaas
    let customerId = sub?.gateway_customer_id as string | null;
    if (!customerId) {
      if (!cpfCnpj || cpfCnpj.length < 11) {
        return json({ error: "cpfCnpj required", code: "need_cpf_cnpj" }, 400);
      }
      const customer = await asaas("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: profile?.display_name || store.name,
          email: user.email,
          cpfCnpj,
          mobilePhone: (profile?.phone || store.phone || "").replace(/\D/g, "") || undefined,
          externalReference: `store:${storeId}`,
        }),
      });
      customerId = customer.id;
    }

    // 2) Garante subscription mensal PIX no Asaas
    let subscriptionId = sub?.gateway_subscription_id as string | null;
    if (!subscriptionId) {
      const nextDue = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
      const subResp = await asaas("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          cycle: "MONTHLY",
          value: PRO_PRICE,
          nextDueDate: nextDue,
          description: `Assinatura PRO - ${store.name}`,
          externalReference: `store:${storeId}`,
        }),
      });
      subscriptionId = subResp.id;
    }

    // 3) Persiste assinatura
    const subPayload = {
      store_id: storeId,
      plan_id: proPlan?.id ?? null,
      status: (sub?.status === "active" ? "active" : "trial") as any,
      monthly_amount: PRO_PRICE,
      gateway: "asaas",
      gateway_customer_id: customerId,
      gateway_subscription_id: subscriptionId,
      trial_ends_at: sub?.trial_ends_at ?? new Date(Date.now() + 7 * 86400_000).toISOString(),
      current_period_start: sub?.current_period_start ?? new Date().toISOString(),
      current_period_end: sub?.current_period_end ?? null,
    };
    if (sub) {
      await admin.from("store_subscriptions").update(subPayload).eq("store_id", storeId);
    } else {
      await admin.from("store_subscriptions").insert(subPayload);
    }

    const { data: subRow } = await admin
      .from("store_subscriptions").select("id").eq("store_id", storeId).maybeSingle();

    // 4) Pega a próxima cobrança PENDING da subscription
    const list = await asaas(`/subscriptions/${subscriptionId}/payments?status=PENDING&limit=1`);
    const payment = list?.data?.[0];
    let qr: any = null;
    if (payment?.id) {
      qr = await asaas(`/payments/${payment.id}/pixQrCode`).catch(() => null);
      await admin.from("subscription_payments").upsert({
        store_id: storeId,
        subscription_id: subRow?.id ?? null,
        gateway: "asaas",
        external_id: payment.id,
        external_subscription_id: subscriptionId,
        amount: payment.value ?? PRO_PRICE,
        status: (payment.status || "pending").toLowerCase(),
        billing_type: payment.billingType,
        due_date: payment.dueDate,
        invoice_url: payment.invoiceUrl,
        pix_qr_code: qr?.encodedImage ?? null,
        pix_payload: qr?.payload ?? null,
        raw: { payment, qr },
      }, { onConflict: "external_id" });
    }

    return json({
      data: {
        subscription_id: subscriptionId,
        customer_id: customerId,
        payment_id: payment?.id ?? null,
        invoice_url: payment?.invoiceUrl ?? null,
        due_date: payment?.dueDate ?? null,
        value: PRO_PRICE,
        pix: qr ? { encodedImage: qr.encodedImage, payload: qr.payload, expirationDate: qr.expirationDate } : null,
      },
    });
  } catch (e) {
    console.error("subscription-create error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
