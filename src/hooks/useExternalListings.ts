import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, SUBCATEGORIES } from "@/components/CategoryGrid";
import { isOpenNow } from "@/lib/openingHours";

export type ExternalListing = {
  id: string;
  name: string;
  logo: string | null;
  category_key: string;
  subcategory_key: string | null;
  catalog_url: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  opening_hours: Record<string, { open?: string; close?: string; closed?: boolean }> | null;
  active: boolean;
  delivery_time: string | null;
  delivery_radius_km: number | null;
  delivery_fee: number | null;
};

const cuisineFromListing = (l: ExternalListing): string => {
  if (l.subcategory_key) {
    const sub = SUBCATEGORIES[l.category_key]?.find((s) => s.key === l.subcategory_key);
    if (sub) return sub.label;
  }
  const cat = CATEGORIES.find((c) => c.key === l.category_key);
  return cat?.match[0] ?? cat?.label ?? "";
};

/** Devolve listings prontos para serem mesclados como Store no Index. */
export const useExternalListings = (coords?: { lat: number; lng: number } | null) => {
  const normLat = coords?.lat != null ? Number(coords.lat.toFixed(3)) : null;
  const normLng = coords?.lng != null ? Number(coords.lng.toFixed(3)) : null;

  return useQuery({
    queryKey: ["external-listings", normLat, normLng],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      if (normLat != null && normLng != null) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("get_available_external_listings", {
          user_lat: normLat,
          user_lng: normLng,
        });
        if (!rpcErr && rpcData) {
          return ((rpcData as any[]) ?? []).map((l) => ({
            id: `ext_${l.id}`,
            slug: `ext_${l.id}`,
            name: l.name,
            tagline: "",
            cuisine: cuisineFromListing(l as any),
            rating: 5,
            reviews: 0,
            deliveryTime: "—",
            deliveryFee: null,
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
            _external: true,
            _externalUrl: l.catalog_url,
            _categoryKey: l.category_key,
            _subcategoryKey: l.subcategory_key,
          }));
        }
      }
      const { data, error } = await supabase
        .from("external_listings" as any)
        .select(
          "id, name, logo, category_key, subcategory_key, catalog_url, address, lat, lng, opening_hours, delivery_time, delivery_radius_km, delivery_fee",
        )
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as ExternalListing[]).map((l) => ({
        id: `ext_${l.id}`,
        slug: `ext_${l.id}`,
        name: l.name,
        tagline: "",
        cuisine: cuisineFromListing(l),
        rating: 5,
        reviews: 0,
        deliveryTime: l.delivery_time || "—",
        deliveryFee: l.delivery_fee ?? null,
        freeShippingThreshold: 0,
        minOrder: 0,
        cover: "",
        logo: l.logo || "🏪",
        city: "",
        open: isOpenNow(l.opening_hours as any),
        promo: undefined,
        categories: [],
        products: [],
        lat: l.lat ?? undefined,
        lng: l.lng ?? undefined,
        deliveryRadiusKm: l.delivery_radius_km ?? undefined,
        // marca como externo
        _external: true,
        _externalUrl: l.catalog_url,
        _categoryKey: l.category_key,
        _subcategoryKey: l.subcategory_key,
      }));
    },
  });
};

export const useAllExternalListings = () =>
  useQuery({
    queryKey: ["external-listings-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_listings" as any)
        .select("id, name, logo, category_key, subcategory_key, catalog_url, address, lat, lng, opening_hours, active, delivery_time, delivery_radius_km, delivery_fee, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ExternalListing[];
    },
  });
