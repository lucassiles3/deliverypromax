import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";

const labels: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  received: "Recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const StatusTimeline = ({ orderId }: { orderId: string }) => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["order-status-history", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("id, from_status, to_status, note, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!orderId) return;
    const ch = supabase
      .channel(`order-status-history:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_status_history",
          filter: `order_id=eq.${orderId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["order-status-history", orderId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId, qc]);

  return (
    <section className="rounded-2xl bg-card p-5 shadow-soft">
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <History className="h-4 w-4" /> Histórico de status
      </h3>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : !data?.length ? (
        <p className="text-xs text-muted-foreground">Sem histórico ainda.</p>
      ) : (
        <ol className="relative ml-2 border-l-2 border-border pl-4">
          {data.map((row) => (
            <li key={row.id} className="mb-4 last:mb-0">
              <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-bold">
                  {labels[row.to_status] ?? row.to_status}
                </p>
                <time className="text-[11px] text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("pt-BR")}
                </time>
              </div>
              {row.from_status && (
                <p className="text-[11px] text-muted-foreground">
                  de {labels[row.from_status] ?? row.from_status}
                </p>
              )}
              {row.note && (
                <p className="mt-1 text-xs italic text-muted-foreground">📝 {row.note}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
