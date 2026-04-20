import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";
import { brl } from "@/lib/format";

export const WaiterRanking = ({ storeId }: { storeId: string }) => {
  const { data: sessions = [] } = useQuery({
    queryKey: ["waiter-ranking", storeId],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("table_sessions")
        .select("waiter_user_id, waiter_name, total")
        .eq("store_id", storeId)
        .eq("status", "closed")
        .gte("opened_at", since);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ranking = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    sessions.forEach((s: any) => {
      const key = s.waiter_user_id ?? s.waiter_name ?? "—";
      const cur = map.get(key) ?? { name: s.waiter_name ?? "Sem garçom", total: 0, count: 0 };
      cur.total += Number(s.total ?? 0);
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [sessions]);

  return (
    <div className="rounded-2xl border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="font-display font-bold">Ranking — últimos 30 dias</h3>
      </div>
      {ranking.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma comanda fechada ainda</div>
      ) : (
        ranking.map((r, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
              i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-orange-700 text-white" : "bg-muted"
            }`}>
              {i < 3 ? <Trophy className="h-4 w-4" /> : i + 1}
            </span>
            <div className="flex-1">
              <div className="font-bold">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.count} comanda(s)</div>
            </div>
            <div className="font-display text-lg font-bold text-primary">{brl(r.total)}</div>
          </div>
        ))
      )}
    </div>
  );
};
