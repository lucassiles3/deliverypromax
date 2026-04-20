import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ChefHat, Bell, CheckCircle2 } from "lucide-react";
import { elapsed } from "@/lib/format";

const cols = [
  { id: "pending" as const, label: "Pendente", icon: Clock, color: "bg-muted" },
  { id: "preparing" as const, label: "Em preparo", icon: ChefHat, color: "bg-amber-500/10" },
  { id: "ready" as const, label: "Pronto", icon: Bell, color: "bg-blue-500/10" },
  { id: "delivered" as const, label: "Entregue", icon: CheckCircle2, color: "bg-green-500/10" },
];

export const KitchenDisplay = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["kds", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_session_items")
        .select("*, table_sessions:session_id(table_id, tables:table_id(number, name))")
        .eq("store_id", storeId)
        .neq("kitchen_status", "cancelled")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`kds-${storeId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_session_items", filter: `store_id=eq.${storeId}` }, () => {
        qc.invalidateQueries({ queryKey: ["kds", storeId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeId, qc]);

  const advance = async (id: string, status: "pending" | "preparing" | "ready" | "delivered") => {
    await supabase.from("table_session_items").update({ kitchen_status: status }).eq("id", id);
  };

  const next: Record<string, "preparing" | "ready" | "delivered" | null> = {
    pending: "preparing", preparing: "ready", ready: "delivered", delivered: null,
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {cols.map((c) => {
        const list = items.filter((i: any) => i.kitchen_status === c.id);
        return (
          <div key={c.id} className={`rounded-2xl border ${c.color} p-3`}>
            <div className="mb-2 flex items-center gap-2 font-bold">
              <c.icon className="h-4 w-4" />
              {c.label}
              <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs">{list.length}</span>
            </div>
            <div className="space-y-2">
              {list.map((it: any) => (
                <div key={it.id} className="rounded-lg border bg-background p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{it.quantity}x {it.product_name}</span>
                    <span className="text-[10px] text-muted-foreground">{elapsed(it.created_at)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Mesa {it.table_sessions?.tables?.number ?? "?"}
                  </div>
                  {it.notes && <div className="text-[11px] italic">📝 {it.notes}</div>}
                  {next[c.id] && (
                    <button
                      onClick={() => advance(it.id, next[c.id]!)}
                      className="mt-1 w-full rounded bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground"
                    >
                      → {cols.find((x) => x.id === next[c.id])?.label}
                    </button>
                  )}
                </div>
              ))}
              {list.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">vazio</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
