// Cria/recupera assinatura PRO no Asaas para a loja do usuário autenticado.
// Modelos suportados:
//   - "fixed_plus_per_order": mensalidade R$150 (subscription Asaas MONTHLY) + R$1 por pedido (faturado mensalmente)
//   - "commission": sem mensalidade, ~10% sobre vendas (faturado mensalmente, sem subscription Asaas)
//
// Para o modelo "commission" não criamos subscription recorrente no Asaas — apenas o customer.
// As faturas mensais são criadas pelo cron `monthly-invoice-cron` como payments avulsos.
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
const ASAAS_API_KEY = (Deno.env.get("ASAAS_API_KEY") ?? "").trim();
const ASAAS_ENV_RAW = (Deno.env.get("ASAAS_ENV") ?? "").trim().toLowerCase();
const KEY_IS_PROD = /\$aact_prod_/i.test(ASAAS_API_KEY);
const KEY_IS_SANDBOX = /\$aact_hmlg_/i.test(ASAAS_API_KEY);
const IS_PROD = KEY_IS_PROD || (!KEY_IS_SANDBOX && (ASAAS_ENV_RAW === "production" || ASAAS_ENV_RAW === "prod" || ASAAS_ENV_RAW === "live"));
const ASAAS_BASE = IS_PROD ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

const FIXED_MONTHLY = 150.0;
const PER_ORDER_FEE = 1.0;
const COMMISSION_PCT = 10.0;

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
    const billingTypeRaw = (body.billing_type as string | undefined)?.toUpperCase();
    const billingType: "PIX" | "CREDIT_CARD" = billingTypeRaw === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX";
    const billingModelRaw = String(body.billing_model ?? "fixed_plus_per_order");
    const billingModel: "fixed_plus_per_order" | "commission" =
      billingModelRaw === "commission" ? "commission" : "fixed_plus_per_order";
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

    const { data: sub } = await admin
      .from("store_subscriptions")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();

    const planSlug = billingModel === "commission" ? "pro_commission" : "pro_fixed";
    const { data: plan } = await admin
      .from("subscription_plans").select("id").eq("slug", planSlug).maybeSingle();

    // 1) Customer Asaas
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

    // 2) Subscription recorrente — apenas no modelo FIXO
    let subscriptionId = sub?.gateway_subscription_id as string | null;

    // Se trocou de modelo e havia subscription, cancela a antiga
    if (sub?.billing_model && sub.billing_model !== billingModel && subscriptionId) {
      await asaas(`/subscriptions/${subscriptionId}`, { method: "DELETE" }).catch(() => null);
      subscriptionId = null;
    }

    if (billingModel === "fixed_plus_per_order") {
      if (!subscriptionId) {
        const nextDue = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
        const subResp = await asaas("/subscriptions", {
          method: "POST",
          body: JSON.stringify({
            customer: customerId,
            billingType,
            cycle: "MONTHLY",
            value: FIXED_MONTHLY,
            nextDueDate: nextDue,
            description: `Assinatura PRO Fixo - ${store.name}`,
            externalReference: `store:${storeId}`,
          }),
        });
        subscriptionId = subResp.id;
      } else {
        await asaas(`/subscriptions/${subscriptionId}`, {
          method: "POST",
          body: JSON.stringify({ billingType }),
        }).catch(() => null);
      }
    }

    // 3) Persiste assinatura local
    const subPayload: Record<string, unknown> = {
      store_id: storeId,
      plan_id: plan?.id ?? null,
      status: (sub?.status === "active" ? "active" : "trial"),
      monthly_amount: billingModel === "fixed_plus_per_order" ? FIXED_MONTHLY : 0,
      billing_model: billingModel,
      per_order_fee: billingModel === "fixed_plus_per_order" ? PER_ORDER_FEE : 0,
      commission_percent: billingModel === "commission" ? COMMISSION_PCT : 0,
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

    // 4) Para modelo FIXO: busca primeira cobrança PENDING (QR PIX, etc.)
    let payment: any = null;
    let qr: any = null;
    if (subscriptionId) {
      const list = await asaas(`/subscriptions/${subscriptionId}/payments?status=PENDING&limit=1`);
      payment = list?.data?.[0];
      if (payment?.id) {
        if (billingType === "PIX") {
          qr = await asaas(`/payments/${payment.id}/pixQrCode`).catch(() => null);
        }
        await admin.from("subscription_payments").upsert({
          store_id: storeId,
          subscription_id: subRow?.id ?? null,
          gateway: "asaas",
          external_id: payment.id,
          external_subscription_id: subscriptionId,
          amount: payment.value ?? FIXED_MONTHLY,
          status: (payment.status || "pending").toLowerCase(),
          billing_type: payment.billingType,
          due_date: payment.dueDate,
          invoice_url: payment.invoiceUrl,
          pix_qr_code: qr?.encodedImage ?? null,
          pix_payload: qr?.payload ?? null,
          raw: { payment, qr },
        }, { onConflict: "external_id" });
      }
    }

    return json({
      data: {
        billing_model: billingModel,
        subscription_id: subscriptionId,
        customer_id: customerId,
        payment_id: payment?.id ?? null,
        invoice_url: payment?.invoiceUrl ?? null,
        due_date: payment?.dueDate ?? null,
        value: billingModel === "fixed_plus_per_order" ? FIXED_MONTHLY : 0,
        billing_type: billingType,
        pix: qr ? { encodedImage: qr.encodedImage, payload: qr.payload, expirationDate: qr.expirationDate } : null,
      },
    });
  } catch (e) {
    console.error("subscription-create error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
