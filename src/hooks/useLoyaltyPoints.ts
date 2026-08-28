import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type LoyaltyReward = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  cost_points: number;
  reward_type: "fixed" | "percent" | "free_shipping" | "free_item";
  reward_value: number;
  free_product_id: string | null;
  stock: number | null;
  active: boolean;
  position: number;
};

export type LoyaltyRedemption = {
  id: string;
  store_id: string;
  reward_id: string;
  points_spent: number;
  coupon_code: string;
  status: "pending" | "used" | "expired";
  expires_at: string | null;
  used_at: string | null;
  created_at: string;
  reward?: { name: string };
  store?: { name: string; logo: string | null };
};

/** Saldo de pontos do usuário em uma loja específica. */
export const useStorePoints = (storeId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["loyalty-points", storeId, user?.id],
    enabled: !!user && !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("customer_points_balance", {
        _store_id: storeId!,
        _user_id: user!.id,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
};

/** Saldo agregado de pontos por loja (somando todas). */
export const useAllStorePoints = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["loyalty-points-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_points")
        .select("store_id, delta, expires_at, stores(name, logo)")
        .eq("user_id", user!.id);
      if (error) throw error;
      const now = new Date();
      const map = new Map<string, { storeId: string; name: string; logo: string | null; balance: number }>();
      (data ?? []).forEach((row: any) => {
        if (row.expires_at && new Date(row.expires_at) < now) return;
        const cur = map.get(row.store_id) ?? {
          storeId: row.store_id,
          name: row.stores?.name ?? "Loja",
          logo: row.stores?.logo ?? null,
          balance: 0,
        };
        cur.balance += Number(row.delta);
        map.set(row.store_id, cur);
      });
      return Array.from(map.values()).filter((s) => s.balance > 0).sort((a, b) => b.balance - a.balance);
    },
  });
};

/** Catálogo de recompensas de uma loja. */
export const useLoyaltyRewards = (storeId?: string) =>
  useQuery({
    queryKey: ["loyalty-rewards", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("store_id", storeId!)
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as LoyaltyReward[];
    },
  });

/** Histórico de resgates do usuário. */
export const useMyRedemptions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["loyalty-redemptions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_redemptions")
        .select("id, store_id, reward_id, points_spent, coupon_code, status, expires_at, used_at, created_at, loyalty_rewards(name), stores(name, logo)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        reward: r.loyalty_rewards,
        store: r.stores,
      })) as LoyaltyRedemption[];
    },
  });
};

/** Resgata uma recompensa (chama RPC redeem_loyalty_reward). */
export const useRedeemReward = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rewardId: string) => {
      const { data, error } = await supabase.rpc("redeem_loyalty_reward", { _reward_id: rewardId });
      if (error) throw error;
      return data as { coupon_code: string; expires_at: string; points_remaining: number };
    },
    onSuccess: (data) => {
      toast.success(`🎉 Recompensa resgatada! Cupom: ${data.coupon_code}`);
      qc.invalidateQueries({ queryKey: ["loyalty-points"] });
      qc.invalidateQueries({ queryKey: ["loyalty-points-all"] });
      qc.invalidateQueries({ queryKey: ["loyalty-redemptions"] });
      qc.invalidateQueries({ queryKey: ["loyalty-rewards"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao resgatar"),
  });
};
