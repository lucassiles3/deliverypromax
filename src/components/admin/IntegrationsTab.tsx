import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Key, Webhook, Copy, Trash2, Plus, Activity, CheckCircle2, XCircle, BookOpen, Wallet } from "lucide-react";
import { PixGatewaySection } from "./integrations/PixGatewaySection";

type Section = "pix" | "keys" | "webhooks" | "deliveries" | "docs";

export const IntegrationsTab = ({ storeId }: { storeId: string }) => {
  const [section, setSection] = useState<Section>("pix");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "pix" as const, label: "PIX / Gateways", icon: Wallet },
          { id: "keys" as const, label: "API Keys", icon: Key },
          { id: "webhooks" as const, label: "Webhooks", icon: Webhook },
          { id: "deliveries" as const, label: "Entregas", icon: Activity },
          { id: "docs" as const, label: "Documentação", icon: BookOpen },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition-smooth ${
              section === t.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>
      {section === "pix" && <PixGatewaySection storeId={storeId} />}
      {section === "keys" && <KeysSection storeId={storeId} />}
      {section === "webhooks" && <WebhooksSection storeId={storeId} />}
      {section === "deliveries" && <DeliveriesSection storeId={storeId} />}
      {section === "docs" && <DocsSection />}
    </div>
  );
};

// --- helpers
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genApiKey(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `ff_live_${hex}`;
}

// ============ API KEYS ============
const KeysSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createKey = async () => {
    if (!name.trim()) return toast.error("Dê um nome à chave");
    setCreating(true);
    const raw = genApiKey();
    const hash = await sha256Hex(raw);
    const prefix = raw.slice(0, 12);
    const { error } = await supabase.from("api_keys").insert({
      store_id: storeId,
      name: name.trim(),
      key_prefix: prefix,
      key_hash: hash,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    setRevealed(raw);
    setName("");
    qc.invalidateQueries({ queryKey: ["api-keys", storeId] });
  };

  const revoke = async (id: string) => {
    if (!confirm("Revogar esta chave? Sistemas que a usam vão parar de funcionar.")) return;
    const { error } = await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Chave revogada");
    qc.invalidateQueries({ queryKey: ["api-keys", storeId] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-display text-lg font-bold">Criar nova API key</h3>
        <p className="mt-1 text-sm text-muted-foreground">A chave é exibida UMA ÚNICA vez. Guarde em local seguro.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: ERP da loja, Bot do WhatsApp"
            className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button onClick={createKey} disabled={creating}>
            <Plus className="mr-1 h-4 w-4" /> Gerar chave
          </Button>
        </div>

        {revealed && (
          <div className="mt-4 rounded-xl border-2 border-primary bg-primary/5 p-4">
            <div className="text-xs font-bold uppercase text-primary">Sua nova chave (copie agora!)</div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-background px-3 py-2 text-xs">{revealed}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(revealed); toast.success("Copiado!"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <button onClick={() => setRevealed(null)} className="mt-3 text-xs font-bold text-muted-foreground hover:text-foreground">
              Fechar (já copiei)
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="border-b px-5 py-3 font-bold">Chaves cadastradas</div>
        {keys.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma chave criada ainda.</div>
        ) : (
          <ul className="divide-y">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 px-5 py-3">
                <Key className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-bold">{k.name}</div>
                  <div className="text-xs text-muted-foreground">
                    <code>{k.key_prefix}…</code> · criada {new Date(k.created_at).toLocaleDateString("pt-BR")}
                    {k.last_used_at && ` · usada ${new Date(k.last_used_at).toLocaleString("pt-BR")}`}
                  </div>
                </div>
                {k.revoked_at ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">revogada</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => revoke(k.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ============ WEBHOOKS ============
const WebhooksSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");

  const { data: hooks = [] } = useQuery({
    queryKey: ["webhooks", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhooks")
        .select("id, url, secret, events, active, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = async () => {
    if (!url.trim().startsWith("http")) return toast.error("URL inválida");
    const secret = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("webhooks").insert({
      store_id: storeId,
      url: url.trim(),
      secret,
      events: ["order.created", "order.status_changed", "order.cancelled"],
      active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Webhook cadastrado");
    setUrl("");
    qc.invalidateQueries({ queryKey: ["webhooks", storeId] });
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("webhooks").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["webhooks", storeId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir webhook?")) return;
    await supabase.from("webhooks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["webhooks", storeId] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-display text-lg font-bold">Cadastrar webhook</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Receba POST nessa URL quando pedidos forem criados, mudarem status ou forem cancelados. Assinatura HMAC SHA-256 no header <code>X-FoodFlash-Signature</code>.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://meusistema.com/webhooks/foodflash"
            className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button onClick={create}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="border-b px-5 py-3 font-bold">Webhooks ativos</div>
        {hooks.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum webhook cadastrado.</div>
        ) : (
          <ul className="divide-y">
            {hooks.map((h) => (
              <li key={h.id} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Webhook className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-bold">{h.url}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {h.events.map((e) => (
                        <span key={e} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{e}</span>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant={h.active ? "default" : "outline"} onClick={() => toggle(h.id, h.active)}>
                    {h.active ? "Ativo" : "Pausado"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(h.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  Secret: <code className="rounded bg-muted px-2 py-0.5">{h.secret.slice(0, 8)}…</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(h.secret); toast.success("Secret copiado"); }}
                    className="font-bold text-primary"
                  >
                    copiar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ============ DELIVERIES ============
const DeliveriesSection = ({ storeId }: { storeId: string }) => {
  const { data: deliveries = [] } = useQuery({
    queryKey: ["webhook-deliveries", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_deliveries")
        .select("id, event, success, response_status, response_body, attempts, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  return (
    <div className="rounded-2xl border bg-card">
      <div className="border-b px-5 py-3 font-bold">Últimas 50 entregas</div>
      {deliveries.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Sem entregas ainda. Faça um pedido de teste.</div>
      ) : (
        <ul className="divide-y">
          {deliveries.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-5 py-3">
              {d.success ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5 text-destructive" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{d.event}</span>
                  {d.response_status ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">HTTP {d.response_status}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">tentativas: {d.attempts}</span>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</div>
                {d.response_body && (
                  <code className="mt-1 block max-w-full overflow-x-auto rounded bg-muted px-2 py-1 text-[10px]">{d.response_body}</code>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ============ DOCS ============
const DocsSection = () => {
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-rest`;
  const examples: { method: string; path: string; desc: string }[] = [
    { method: "GET",  path: "/produtos",                      desc: "Listar cardápio completo" },
    { method: "PUT",  path: "/produtos/:id",                  desc: "Atualizar preço/estoque/status (body JSON)" },
    { method: "GET",  path: "/pedidos?status=preparing&limit=20", desc: "Listar pedidos (filtros: status, from, to, limit)" },
    { method: "PUT",  path: "/pedidos/:id/status",            desc: 'Body: { "status": "preparing" }' },
    { method: "GET",  path: "/relatorios/vendas?from=2024-01-01", desc: "Resumo de vendas + lista" },
    { method: "POST", path: "/cupons",                        desc: 'Body: { "code","label","type","value", ... }' },
    { method: "GET",  path: "/clientes",                      desc: "Base agregada por telefone" },
    { method: "POST", path: "/webhooks",                      desc: 'Body: { "url","events?":[...] }' },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-display text-lg font-bold">Como autenticar</h3>
        <p className="mt-1 text-sm text-muted-foreground">Inclua sua API key no header de toda requisição:</p>
        <code className="mt-2 block rounded-lg bg-muted px-3 py-2 text-xs">Authorization: Bearer ff_live_xxxxxxxxxxxxx</code>

        <h3 className="mt-5 font-display text-lg font-bold">Base URL</h3>
        <code className="mt-1 block break-all rounded-lg bg-muted px-3 py-2 text-xs">{base}</code>
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="border-b px-5 py-3 font-bold">Endpoints</div>
        <ul className="divide-y">
          {examples.map((e) => (
            <li key={e.method + e.path} className="px-5 py-3">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  e.method === "GET" ? "bg-blue-500/10 text-blue-600" :
                  e.method === "POST" ? "bg-green-500/10 text-green-600" :
                  "bg-amber-500/10 text-amber-600"
                }`}>{e.method}</span>
                <code className="text-sm">{e.path}</code>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{e.desc}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-display text-lg font-bold">Webhooks</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Eventos enviados via POST JSON. Headers: <code>X-FoodFlash-Event</code>, <code>X-FoodFlash-Signature</code> (HMAC SHA-256 com seu secret).
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {["order.created", "order.status_changed", "order.cancelled"].map((e) => (
            <code key={e} className="rounded-lg bg-muted px-3 py-2 text-xs">{e}</code>
          ))}
        </div>
      </div>
    </div>
  );
};
