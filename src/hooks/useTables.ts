import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TableStatus = "available" | "occupied" | "reserved" | "blocked";

export type Sector = {
  id: string;
  store_id: string;
  name: string;
  color: string;
  position: number;
  active: boolean;
};

export type RestaurantTable = {
  id: string;
  store_id: string;
  sector_id: string | null;
  number: number;
  name: string | null;
  capacity: number;
  status: TableStatus;
  notes: string | null;
  position_x: number;
  position_y: number;
  qr_token: string;
  position: number;
  active: boolean;
};

export type TableSession = {
  id: string;
  store_id: string;
  table_id: string;
  status: string;
  people: number;
  waiter_user_id: string | null;
  waiter_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  subtotal: number;
  service_fee: number;
  service_fee_percent: number;
  discount: number;
  total: number;
  paid_amount: number;
  opened_at: string;
  closed_at: string | null;
  cash_register_id: string | null;
};

export const useSectors = (storeId: string | null) =>
  useQuery({
    queryKey: ["sectors", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .eq("store_id", storeId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Sector[];
    },
  });

export const useTables = (storeId: string | null) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["tables", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("store_id", storeId!)
        .order("number");
      if (error) throw error;
      return (data ?? []) as RestaurantTable[];
    },
  });

  const channelId = useId();
  useEffect(() => {
    if (!storeId) return;
    const ch = supabase
      .channel(`tables-${storeId}-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tables", filter: `store_id=eq.${storeId}` }, () => {
        qc.invalidateQueries({ queryKey: ["tables", storeId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions", filter: `store_id=eq.${storeId}` }, () => {
        qc.invalidateQueries({ queryKey: ["tables", storeId] });
        qc.invalidateQueries({ queryKey: ["open-sessions", storeId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [storeId, qc, channelId]);

  return query;
};

export const useOpenSessions = (storeId: string | null) =>
  useQuery({
    queryKey: ["open-sessions", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_sessions")
        .select("*")
        .eq("store_id", storeId!)
        .eq("status", "open");
      if (error) throw error;
      return (data ?? []) as TableSession[];
    },
    refetchInterval: 30_000,
  });
