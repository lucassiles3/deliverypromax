// CRON diário — marca faturas vencidas, bloqueia lojas após grace_days e reativa lojas pagas.
// A função SQL `enforce_subscription_grace` também envia notificações ao dono da loja.
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
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();
  let runId: string | null = null;

  try {
    const { data: run } = await admin.from("billing_job_runs").insert({
      job_name: "subscription-grace-cron",
      status: "running",
    }).select("id").single();
    runId = run?.id ?? null;
  } catch (_) { /* noop */ }

  try {
    const { data, error } = await admin.rpc("enforce_subscription_grace");
    if (error) throw error;

    if (runId) {
      await admin.from("billing_job_runs").update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        processed: Number(data ?? 0),
        succeeded: Number(data ?? 0),
        summary: { blocked: data },
      }).eq("id", runId);
    }
    return json({ ok: true, blocked: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("grace-cron", e);
    if (runId) {
      await admin.from("billing_job_runs").update({
        status: "error",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        error_message: msg,
      }).eq("id", runId);
    }
    return json({ error: msg }, 500);
  }
});
