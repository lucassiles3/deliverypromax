// Cria um link de pagamento na InfinitePay para uma loja específica.
// Cada loja configura sua própria InfiniteTag (handle) em /admin → Configurações.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Item {
  quantity: number;
  price: number; // em centavos
  description: string;
}

interface Body {
  store_id: string;
  order_nsu?: string;
  items: Item[];
  customer?: { name?: string; email?: string; phone_number?: string };
  address?: Record<string, string>;
  redirect_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;

    if (!body?.store_id || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(JSON.stringify({ error: "store_id e items são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Saneamento básico
    const items = body.items
      .map((i) => ({
        quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
        price: Math.max(1, Math.floor(Number(i.price) || 0)),
        description: String(i.description || "Item").slice(0, 120),
      }))
      .filter((i) => i.price > 0);

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "Itens inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("infinitepay_handle, infinitepay_redirect_url, infinitepay_webhook_url, name")
      .eq("id", body.store_id)
      .maybeSingle();

    if (storeErr || !store) {
      return new Response(JSON.stringify({ error: "Loja não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const handle = (store.infinitepay_handle ?? "").trim().replace(/^\$/, "");
    if (!handle) {
      return new Response(
        JSON.stringify({ error: "Esta loja ainda não configurou a InfiniteTag." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload: Record<string, unknown> = {
      handle,
      items,
    };
    if (body.order_nsu) payload.order_nsu = String(body.order_nsu);
    const redirect = body.redirect_url || (store as any).infinitepay_redirect_url;
    if (redirect) payload.redirect_url = redirect;
    const webhook = (store as any).infinitepay_webhook_url;
    if (webhook) payload.webhook_url = webhook;
    if (body.customer && (body.customer.name || body.customer.email || body.customer.phone_number)) {
      payload.customer = body.customer;
    }
    if (body.address) payload.address = body.address;

    const res = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* ignore */ }

    if (!res.ok) {
      console.error("[infinitepay] HTTP", res.status, text);
      return new Response(
        JSON.stringify({ error: data?.message || data?.error || "Falha ao gerar link", details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // A API retorna { url, slug, ... }
    const url: string | undefined = data?.url || data?.checkout_url || data?.link;
    if (!url) {
      return new Response(
        JSON.stringify({ error: "Resposta sem URL", details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ url, slug: data?.slug ?? null, order_nsu: data?.order_nsu ?? payload.order_nsu ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[infinitepay] error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
