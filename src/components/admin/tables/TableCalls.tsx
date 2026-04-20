import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check } from "lucide-react";
import { elapsed } from "@/lib/format";
import { toast } from "sonner";

export const TableCalls = ({ storeId }: { storeId: string }) => {
  const qc = useQueryClient();

  const { data: calls = [] } = useQuery({
    queryKey: ["table-calls", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_calls")
        .select("*, tables:table_id(number, name)")
        .eq("store_id", storeId)
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`calls-${storeId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "table_calls", filter: `store_id=eq.${storeId}` }, (p: any) => {
        qc.invalidateQueries({ queryKey: ["table-calls", storeId] });
        toast(`🔔 Mesa ${p.new?.table_id?.slice(0, 6)}: chamada de garçom`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeId, qc]);

  const resolve = async (id: string) => {
    await supabase.from("table_calls").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["table-calls", storeId] });
  };

  if (calls.length === 0) return null;
  return (
    <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-700">
        <Bell className="h-4 w-4 animate-pulse" /> Chamadas pendentes ({calls.length})
      </div>
      <div className="flex flex-wrap gap-2">
        {calls.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-background px-3 py-1 text-xs">
            <strong>Mesa {c.tables?.number}</strong>
            <span className="text-muted-foreground">· {c.reason} · {elapsed(c.created_at)}</span>
            <button onClick={() => resolve(c.id)} className="rounded-full bg-green-500 p-0.5 text-white"><Check className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};
