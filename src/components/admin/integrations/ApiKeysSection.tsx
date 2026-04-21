import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Plus, Copy, Trash2, BookOpen, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const generateToken = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `ff_live_${hex}`;
};

export const ApiKeysSection = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<{ token: string; name: string } | null>(null);

  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApiKey[];
    },
  });

  const create = async () => {
    if (!name.trim()) return toast.error("Dê um nome para a chave");
    const token = generateToken();
    const hash = await sha256Hex(token);
    const prefix = token.slice(0, 12);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("api_keys").insert({
      store_id: storeId,
      name: name.trim(),
      key_hash: hash,
      key_prefix: prefix,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setRevealed({ token, name: name.trim() });
    setName("");
    qc.invalidateQueries({ queryKey: ["api-keys", storeId] });
  };

  const revoke = async (k: ApiKey) => {
    if (!confirm(`Revogar chave "${k.name}"? Aplicações que a usam vão parar de funcionar.`)) return;
    const { error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", k.id);
    if (error) return toast.error(error.message);
    toast.success("Chave revogada");
    qc.invalidateQueries({ queryKey: ["api-keys", storeId] });
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-bold">API Pública</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Integre sistemas externos (ERP, CRM, BI) com sua loja. Cada chave dá acesso apenas aos dados desta loja.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/docs/api"><BookOpen className="h-4 w-4" /> Documentação <ExternalLink className="h-3 w-3" /></Link>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border-2 bg-card p-5">
        <h4 className="mb-3 font-display text-base font-bold">Criar nova chave</h4>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Integração ERP"
            className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <Button onClick={create} className="gap-2"><Plus className="h-4 w-4" /> Gerar chave</Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          A chave aparece <b>uma única vez</b> após criada. Guarde em local seguro.
        </p>
      </div>

      {revealed && (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-50 p-5 dark:bg-amber-950/30">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            ⚠️ Copie agora — não será mostrada de novo
          </p>
          <p className="mt-1 text-sm font-bold">{revealed.name}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-background px-3 py-2 font-mono text-xs">{revealed.token}</code>
            <Button size="sm" onClick={() => copy(revealed.token)}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setRevealed(null)}>Já guardei</Button>
        </div>
      )}

      <div>
        <h4 className="mb-3 font-display text-base font-bold">Chaves ativas</h4>
        {keys.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma chave criada
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 text-left">Nome</th>
                  <th className="px-4 py-2 text-left">Prefixo</th>
                  <th className="px-4 py-2 text-left">Criada em</th>
                  <th className="px-4 py-2 text-left">Último uso</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-bold">{k.name}</td>
                    <td className="px-4 py-2"><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{k.key_prefix}…</code></td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(k.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-2 text-muted-foreground">{k.last_used_at ? new Date(k.last_used_at).toLocaleString("pt-BR") : "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        k.revoked_at ? "bg-muted text-muted-foreground" : "bg-green-500/10 text-green-600"
                      }`}>
                        {k.revoked_at ? "Revogada" : "Ativa"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {!k.revoked_at && (
                        <button onClick={() => revoke(k)}
                          className="rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
