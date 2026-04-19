// Processa entregas de webhook pendentes (chamado por cron a cada minuto, ou manualmente)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Pega até 50 entregas pendentes (success=false e attempts<5)
  const { data: pending } = await admin
    .from("webhook_deliveries")
    .select("id, webhook_id, payload, attempts, webhooks!inner(url, secret, active)")
    .eq("success", false)
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);

  let processed = 0;
  for (const row of (pending ?? []) as any[]) {
    const wh = row.webhooks;
    if (!wh?.active) continue;
    const body = JSON.stringify(row.payload);
    const sig = await hmacHex(wh.secret, body);
    let status = 0;
    let respText = "";
    let ok = false;
    try {
      const r = await fetch(wh.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FoodFlash-Signature": sig,
          "X-FoodFlash-Event": row.payload.event,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      status = r.status;
      respText = (await r.text()).slice(0, 500);
      ok = r.ok;
    } catch (e) {
      respText = e instanceof Error ? e.message : "fetch error";
    }
    await admin
      .from("webhook_deliveries")
      .update({ success: ok, response_status: status, response_body: respText, attempts: row.attempts + 1 })
      .eq("id", row.id);
    processed++;
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
