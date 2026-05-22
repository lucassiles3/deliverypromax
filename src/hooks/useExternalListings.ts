import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/components/CategoryGrid";

export type ExternalListing = {
  id: string;
  name: string;
  logo: string | null;
  category_key: string;
  catalog_url: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  opening_hours: Record<string, { open?: string; close?: string; closed?: boolean }> | null;
  active: boolean;
  delivery_time: string | null;
  delivery_radius_km: number | null;
};

const cuisineFromCategory = (key: string): string => {
  const cat = CATEGORIES.find((c) => c.key === key);
  return cat?.match[0] ?? cat?.label ?? "";
};

/** Devolve listings prontos para serem mesclados como Store no Index. */
export const useExternalListings = () =>
  useQuery({
    queryKey: ["external-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_listings" as any)
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as ExternalListing[]).map((l) => ({
        id: `ext_${l.id}`,
        slug: `ext_${l.id}`,
        name: l.name,
        tagline: l.address ?? "",
        cuisine: cuisineFromCategory(l.category_key),
        rating: 5,
        reviews: 0,
        deliveryTime: l.delivery_time || "—",
        deliveryFee: 0,
        freeShippingThreshold: 0,
        minOrder: 0,
        cover: "",
        logo: l.logo || "🏪",
        city: "",
        open: true,
        promo: undefined,
        categories: [],
        products: [],
        lat: l.lat ?? undefined,
        lng: l.lng ?? undefined,
        deliveryRadiusKm: l.delivery_radius_km ?? undefined,
        // marca como externo
        _external: true,
        _externalUrl: l.catalog_url,
      }));
    },
  });

export const useAllExternalListings = () =>
  useQuery({
    queryKey: ["external-listings-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_listings" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ExternalListing[];
    },
  });
