import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type StaleCourierAlert = {
  order_id: string;
  courier_id: string;
  courier_name: string;
  last_update: string | null;
  minutes_stale: number;
  level: "warn" | "critical";
};

/**
 * Polls active out_for_delivery orders and reports those whose courier
 * hasn't pinged GPS within the configured thresholds.
 */
export const useStaleCouriers = (storeId: string | null) => {
  return useQuery({
    queryKey: ["stale-couriers", storeId],
    enabled: !!storeId,
    refetchInterval: 30000,
    queryFn: async (): Promise<{
      alertMin: number;
      reassignMin: number;
      alerts: StaleCourierAlert[];
    }> => {
      const { data: store } = await supabase
        .from("stores")
        .select("courier_gps_alert_min, courier_gps_reassign_min")
        .eq("id", storeId!)
        .maybeSingle();

      const alertMin = store?.courier_gps_alert_min ?? 5;
      const reassignMin = store?.courier_gps_reassign_min ?? 10;

      const { data: rows } = await supabase
        .from("orders")
        .select(
          "id, courier_id, couriers:courier_id(name), courier_locations:courier_id(updated_at)",
        )
        .eq("store_id", storeId!)
        .eq("status", "out_for_delivery")
        .not("courier_id", "is", null);

      const now = Date.now();
      const alerts: StaleCourierAlert[] = (rows ?? [])
        .map((r: any) => {
          const lastIso: string | null = r.courier_locations?.updated_at ?? null;
          const minutes = lastIso
            ? Math.floor((now - new Date(lastIso).getTime()) / 60000)
            : 9999;
          return {
            order_id: r.id,
            courier_id: r.courier_id,
            courier_name: r.couriers?.name ?? "Entregador",
            last_update: lastIso,
            minutes_stale: minutes,
            level: minutes >= reassignMin ? ("critical" as const) : ("warn" as const),
          };
        })
        .filter((a) => a.minutes_stale >= alertMin);

      return { alertMin, reassignMin, alerts };
    },
  });
};

export const useReassignStaleOrders = (storeId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("reassign_stale_courier_orders", {
        _store_id: storeId!,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      if (n > 0) toast.success(`${n} pedido(s) liberado(s) para reatribuição`);
      else toast.message("Nenhum pedido precisou ser reatribuído");
      qc.invalidateQueries({ queryKey: ["stale-couriers", storeId] });
      qc.invalidateQueries({ queryKey: ["kanban-orders", storeId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao reatribuir"),
  });
};

export const useUnassignOrder = (storeId: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ courier_id: null, status: "ready" })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido devolvido à fila");
      qc.invalidateQueries({ queryKey: ["stale-couriers", storeId] });
      qc.invalidateQueries({ queryKey: ["kanban-orders", storeId] });
    },
    onError: (e: any) => toast.error(e.message),
  });
};
