import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Ban, CheckCircle2, PauseCircle, Search } from "lucide-react";

type Row = {
  id: string;
  name: string;
  city: string | null;
  created_at: string;
  lifecycle_status: "active" | "suspended" | "blocked";
  store_subscriptions: { status: string; monthly_amount: number; plan_id: string | null }[] | null;
  orders_count: number;
  revenue: number;
};

const statusColor: Record<string, string> = {
  active: "bg-green-500/10 text-green-700 dark:text-green-400",
  suspended: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  blocked: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export default function MasterStores() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: stores } = await supabase
      .from("stores")
      .select("id,name,city,created_at,lifecycle_status,store_subscriptions(status,monthly_amount,plan_id)")
      .order("created_at", { ascending: false });

    const enriched: Row[] = [];
    for (const s of stores || []) {
      const { count } = await supabase
        .from("orders").select("*", { count: "exact", head: true })
        .eq("store_id", s.id).eq("status", "delivered");
      const { data: sum } = await supabase
        .from("orders").select("total").eq("store_id", s.id).eq("status", "delivered");
      const revenue = (sum || []).reduce((a, b: any) => a + Number(b.total || 0), 0);
      enriched.push({ ...(s as any), orders_count: count || 0, revenue });
    }
    setRows(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const changeStatus = async (id: string, status: "active" | "suspended" | "blocked") => {
    const { error } = await supabase
      .from("stores")
      .update({ lifecycle_status: status, lifecycle_changed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    load();
  };

  const filtered = rows.filter(
    (r) => r.name.toLowerCase().includes(q.toLowerCase()) ||
           (r.city || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou cidade..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3">Loja</th>
                <th className="text-left p-3">Cidade</th>
                <th className="text-left p-3">Assinatura</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Pedidos</th>
                <th className="text-right p-3">Faturamento</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!loading && filtered.map((r) => {
                const sub = r.store_subscriptions?.[0];
                return (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-muted-foreground">{r.city || "—"}</td>
                    <td className="p-3">
                      <Badge variant="outline">{sub?.status || "—"}</Badge>
                      {sub?.monthly_amount ? <span className="ml-2 text-xs text-muted-foreground">{fmt(Number(sub.monthly_amount))}/mês</span> : null}
                    </td>
                    <td className="p-3">
                      <Badge className={statusColor[r.lifecycle_status]}>{r.lifecycle_status}</Badge>
                    </td>
                    <td className="p-3 text-right">{r.orders_count}</td>
                    <td className="p-3 text-right font-medium">{fmt(r.revenue)}</td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        {r.lifecycle_status !== "active" && (
                          <Button size="sm" variant="ghost" onClick={() => changeStatus(r.id, "active")} title="Reativar">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {r.lifecycle_status !== "suspended" && (
                          <Button size="sm" variant="ghost" onClick={() => changeStatus(r.id, "suspended")} title="Suspender">
                            <PauseCircle className="h-4 w-4 text-amber-600" />
                          </Button>
                        )}
                        {r.lifecycle_status !== "blocked" && (
                          <Button size="sm" variant="ghost" onClick={() => changeStatus(r.id, "blocked")} title="Bloquear">
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma loja encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
