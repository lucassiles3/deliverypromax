import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const callerId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { store_id, email, role, display_name } = body ?? {};

    if (!store_id || !email || !role) {
      return json({ error: "store_id, email e role são obrigatórios" }, 400);
    }
    if (!["manager", "attendant", "kitchen", "courier"].includes(role)) {
      return json({ error: "role inválido" }, 400);
    }

    // Verifica se quem chama é dono da loja
    const { data: store } = await admin
      .from("stores")
      .select("id, name, owner_id")
      .eq("id", store_id)
      .maybeSingle();

    if (!store) return json({ error: "loja não encontrada" }, 404);

    // permite owner ou admin
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (store.owner_id !== callerId && !isAdmin) {
      return json({ error: "forbidden" }, 403);
    }

    const lowerEmail = String(email).toLowerCase().trim();

    // Cria invite (se já existir pendente, apenas atualiza role)
    const { data: existing } = await admin
      .from("store_invites")
      .select("id")
      .eq("store_id", store_id)
      .eq("email", lowerEmail)
      .is("accepted_at", null)
      .maybeSingle();

    if (existing) {
      await admin
        .from("store_invites")
        .update({ role, display_name, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() })
        .eq("id", existing.id);
    } else {
      await admin.from("store_invites").insert({
        store_id,
        email: lowerEmail,
        role,
        display_name,
        invited_by: callerId,
      });
    }

    // Se o usuário já existir, adiciona como membro direto
    const { data: existingUser } = await admin
      .from("profiles")
      .select("id")
      .eq("id", callerId) // placeholder; vamos buscar pelo email via admin api
      .maybeSingle();

    // tenta resolver usuário pelo email via Admin API
    let existingUserId: string | null = null;
    try {
      const { data: list } = await admin.auth.admin.listUsers();
      const u = list?.users?.find((x) => x.email?.toLowerCase() === lowerEmail);
      if (u) existingUserId = u.id;
    } catch {
      /* ignore */
    }

    if (existingUserId) {
      await admin.from("store_members").upsert(
        {
          store_id,
          user_id: existingUserId,
          role,
          display_name,
          invited_by: callerId,
          active: true,
        },
        { onConflict: "store_id,user_id" },
      );
      await admin
        .from("store_invites")
        .update({ accepted_at: new Date().toISOString(), accepted_by: existingUserId })
        .eq("store_id", store_id)
        .eq("email", lowerEmail)
        .is("accepted_at", null);

      return json({ ok: true, mode: "linked", message: "Usuário existente vinculado à loja." });
    }

    // Envia magic link / convite por email via Supabase Auth
    const redirectTo = req.headers.get("origin") ?? SUPABASE_URL;
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(lowerEmail, {
      data: {
        invited_to_store: store.name,
        store_id,
        staff_role: role,
        display_name,
      },
      redirectTo,
    });

    if (invErr) {
      // não bloquear: convite no DB já foi salvo; usuário pode se cadastrar depois manualmente
      console.warn("inviteUserByEmail falhou:", invErr.message);
      return json({
        ok: true,
        mode: "pending",
        warning: "Convite registrado. Email automático falhou — peça à pessoa para criar conta com este email.",
      });
    }

    return json({ ok: true, mode: "invited", message: "Convite enviado por email." });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
