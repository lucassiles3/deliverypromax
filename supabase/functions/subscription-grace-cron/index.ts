// CRON diário — bloqueia lojas com fatura vencida há mais de 5 dias e
// reativa lojas cuja(s) fatura(s) tenham sido pagas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await admin.rpc("enforce_subscription_grace");
    if (error) throw error;
    return json({ ok: true, blocked: data });
  } catch (e) {
    console.error("grace-cron", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
