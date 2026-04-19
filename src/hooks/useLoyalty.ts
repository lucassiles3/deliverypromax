import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type LoyaltyState = {
  cashback: number;
  totalSpent: number;
  ordersCount: number;
};

const empty: LoyaltyState = { cashback: 0, totalSpent: 0, ordersCount: 0 };

export const useLoyalty = (): LoyaltyState => {
  const { user } = useAuth();
  const [state, setState] = useState<LoyaltyState>(empty);

  useEffect(() => {
    if (!user) {
      setState(empty);
      return;
    }
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("user_loyalty")
        .select("cashback, total_spent, orders_count")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      setState({
        cashback: Number(data?.cashback ?? 0),
        totalSpent: Number(data?.total_spent ?? 0),
        ordersCount: data?.orders_count ?? 0,
      });
    };
    load();

    const ch = supabase
      .channel(`loyalty:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_loyalty", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return state;
};

export const tierOf = (totalSpent: number): { name: string; emoji: string; next?: number } => {
  if (totalSpent >= 500) return { name: "VIP Ouro", emoji: "👑" };
  if (totalSpent >= 200) return { name: "Cliente Prata", emoji: "⭐", next: 500 };
  if (totalSpent >= 50) return { name: "Cliente Bronze", emoji: "🥉", next: 200 };
  return { name: "Novo cliente", emoji: "🌱", next: 50 };
};

export const CASHBACK_RATE = 0.05;
