// Edge function: scans abandoned_carts that haven't moved in >30min, sends a push notification.
// Triggered by pg_cron every 10 min.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 30 minutes ago
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: carts, error } = await supabase
    .from("abandoned_carts")
    .select("id, user_id, store_id, items, estimated_total, stores:store_id(name)")
    .is("notified_at", null)
    .is("recovered_at", null)
    .lt("updated_at", cutoff)
    .limit(100);

  if (error) {
    console.error("query error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const c of carts ?? []) {
    const items = (c.items as Array<{ name: string; quantity: number }>) ?? [];
    if (items.length === 0) continue;
    const itemSummary = items
      .slice(0, 2)
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(", ");
    const more = items.length > 2 ? ` +${items.length - 2}` : "";
    const storeName = (c as any).stores?.name ?? "a loja";

    const { error: notifErr } = await supabase.from("notifications").insert({
      user_id: c.user_id,
      store_id: c.store_id,
      title: "🛒 Esqueceu algo no carrinho?",
      message: `Seu carrinho em ${storeName} tem: ${itemSummary}${more}. Total estimado R$ ${Number(c.estimated_total).toFixed(2).replace(".", ",")}. Volte para finalizar!`,
      type: "info",
      link: `/checkout`,
      metadata: { source: "abandoned_cart", cart_id: c.id, total: c.estimated_total },
    });

    if (!notifErr) {
      await supabase
        .from("abandoned_carts")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", c.id);
      sent++;
    } else {
      console.error("notif insert error", notifErr);
    }
  }

  return new Response(JSON.stringify({ scanned: carts?.length ?? 0, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
