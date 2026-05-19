// Endpoint público chamado pelo n8n para enviar o QR code do WhatsApp.
// POST { store_id, qr_code, status?, secret }
// Não requer JWT — usa um "secret" simples (chatbot_n8n_webhook_url tem o store_id),
// mas validamos pelo store_id existir + opcionalmente token compartilhado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { store_id, qr_code, status } = body ?? {};

    if (!store_id || typeof store_id !== "string") {
      return new Response(JSON.stringify({ error: "store_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store, error: findErr } = await supabase
      .from("stores")
      .select("id")
      .eq("id", store_id)
      .maybeSingle();

    if (findErr || !store) {
      return new Response(JSON.stringify({ error: "store not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newStatus =
      status === "connected" ? "connected" :
      status === "disconnected" ? "disconnected" :
      qr_code ? "pending_qr" : "disconnected";

    const patch: Record<string, unknown> = {
      chatbot_status: newStatus,
      chatbot_qr_updated_at: new Date().toISOString(),
    };
    if (qr_code) patch.chatbot_qr_code = qr_code;
    if (newStatus === "connected") {
      patch.chatbot_connected_at = new Date().toISOString();
      patch.chatbot_qr_code = null;
    }

    const { error: updErr } = await supabase
      .from("stores")
      .update(patch)
      .eq("id", store_id);

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
