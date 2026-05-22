import { useEffect, useId } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

/** Subscribe to realtime changes on a favorites table for the current user. */
function useFavoritesRealtime(
  table: "favorite_stores" | "favorite_external_listings" | "favorite_products",
  invalidateKeys: string[],
) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const instanceId = useId();
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`rt-${table}-${user.id}-${instanceId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${user.id}` },
        () => {
          invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, table]);
}

export const useFavoriteProducts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorite_products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorite_products")
        .select("id, product_id, store_id, created_at, products(*), stores(slug, name, logo)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useFavoriteStores = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorite_stores", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorite_stores")
        .select("id, store_id, created_at, stores(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useFavoriteProductIds = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorite_product_ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("favorite_products").select("product_id");
      return new Set((data ?? []).map((r) => r.product_id));
    },
  });
};

export const useFavoriteStoreIds = () => {
  const { user } = useAuth();
  useFavoritesRealtime("favorite_stores", ["favorite_store_ids", "favorite_stores"]);
  return useQuery({
    queryKey: ["favorite_store_ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("favorite_stores").select("store_id");
      return new Set((data ?? []).map((r) => r.store_id));
    },
  });
};

export const useFavoriteListingIds = () => {
  const { user } = useAuth();
  useFavoritesRealtime("favorite_external_listings", [
    "favorite_listing_ids",
    "favorite_listings",
  ]);
  return useQuery({
    queryKey: ["favorite_listing_ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("favorite_external_listings" as any)
        .select("listing_id");
      return new Set(((data ?? []) as any[]).map((r) => r.listing_id as string));
    },
  });
};

export const useFavoriteListings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorite_listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorite_external_listings" as any)
        .select("id, listing_id, created_at, external_listings(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
};

export const useToggleFavoriteListing = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listingId, isFav }: { listingId: string; isFav: boolean }) => {
      if (!user) throw new Error("Faça login para favoritar");
      if (isFav) {
        await supabase
          .from("favorite_external_listings" as any)
          .delete()
          .eq("user_id", user.id)
          .eq("listing_id", listingId);
      } else {
        await supabase
          .from("favorite_external_listings" as any)
          .insert({ user_id: user.id, listing_id: listingId });
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["favorite_listing_ids"] });
      qc.invalidateQueries({ queryKey: ["favorite_listings"] });
      toast({
        description: vars.isFav ? "Loja removida dos favoritos" : "❤️ Loja favoritada",
      });
    },
    onError: (e: Error) => toast({ description: e.message, variant: "destructive" }),
  });
};

export const useToggleFavoriteProduct = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, storeId, isFav }: { productId: string; storeId: string; isFav: boolean }) => {
      if (!user) throw new Error("Faça login para favoritar");
      if (isFav) {
        await supabase.from("favorite_products").delete().eq("user_id", user.id).eq("product_id", productId);
      } else {
        await supabase.from("favorite_products").insert({ user_id: user.id, product_id: productId, store_id: storeId });
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["favorite_product_ids"] });
      qc.invalidateQueries({ queryKey: ["favorite_products"] });
      toast({ description: vars.isFav ? "Removido dos favoritos" : "❤️ Adicionado aos favoritos" });
    },
    onError: (e: Error) => toast({ description: e.message, variant: "destructive" }),
  });
};

export const useToggleFavoriteStore = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ storeId, isFav }: { storeId: string; isFav: boolean }) => {
      if (!user) throw new Error("Faça login para favoritar");
      if (isFav) {
        await supabase.from("favorite_stores").delete().eq("user_id", user.id).eq("store_id", storeId);
      } else {
        await supabase.from("favorite_stores").insert({ user_id: user.id, store_id: storeId });
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["favorite_store_ids"] });
      qc.invalidateQueries({ queryKey: ["favorite_stores"] });
      toast({ description: vars.isFav ? "Loja removida dos favoritos" : "❤️ Loja favoritada" });
    },
    onError: (e: Error) => toast({ description: e.message, variant: "destructive" }),
  });
};
