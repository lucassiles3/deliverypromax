import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAsset } from "@/lib/assetMap";
import type { Store, Product, AddonGroup, Coupon, OpeningHours } from "@/data/stores";

type DbStore = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  cuisine: string | null;
  logo: string | null;
  cover_url: string | null;
  city: string | null;
  rating: number | null;
  reviews: number | null;
  delivery_time: string | null;
  delivery_fee: number | null;
  free_shipping_threshold: number | null;
  min_order: number | null;
  open: boolean;
  promo: string | null;
  categories: string[] | null;
  whatsapp_phone?: string | null;
  opening_hours?: OpeningHours | null;
  lat?: number | null;
  lng?: number | null;
  delivery_radius_km?: number | null;
};

const mapStore = (s: DbStore, products: Product[] = []): Store => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  tagline: s.tagline ?? "",
  cuisine: s.cuisine ?? "",
  rating: Number(s.rating ?? 5),
  reviews: s.reviews ?? 0,
  deliveryTime: s.delivery_time ?? "30-45 min",
  deliveryFee: Number(s.delivery_fee ?? 0),
  freeShippingThreshold: Number(s.free_shipping_threshold ?? 50),
  minOrder: Number(s.min_order ?? 0),
  cover: resolveAsset(s.cover_url),
  logo: s.logo ?? "🍽️",
  city: s.city ?? "",
  open: s.open,
  promo: s.promo ?? undefined,
  categories: s.categories ?? [],
  products,
  whatsappPhone: s.whatsapp_phone ?? undefined,
  openingHours: s.opening_hours ?? undefined,
  lat: s.lat != null ? Number(s.lat) : undefined,
  lng: s.lng != null ? Number(s.lng) : undefined,
  deliveryRadiusKm: s.delivery_radius_km != null ? Number(s.delivery_radius_km) : undefined,
});

export const useStores = () =>
  useQuery({
    queryKey: ["stores"],
    queryFn: async (): Promise<Store[]> => {
      const { data, error } = await supabase.from("stores").select("*").order("name");
      if (error) throw error;
      return (data as unknown as DbStore[]).map((s) => mapStore(s));
    },
  });

export const useStoreBySlug = (slug: string) =>
  useQuery({
    queryKey: ["store", slug],
    enabled: !!slug,
    queryFn: async (): Promise<Store | null> => {
      const { data: s, error } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!s) return null;

      const { data: products } = await supabase
        .from("products")
        .select(
          `id, name, description, price, old_price, image_url, category, rating, reviews,
           bestseller, promo, position,
           addon_groups (
             id, name, type, required, max_select, position,
             addon_options (id, name, price, position)
           )`,
        )
        .eq("store_id", s.id)
        .eq("active", true)
        .order("position");

      const mapped: Product[] = (products ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        price: Number(p.price),
        oldPrice: p.old_price ? Number(p.old_price) : undefined,
        image: resolveAsset(p.image_url),
        category: p.category ?? "Outros",
        rating: Number(p.rating ?? 5),
        reviews: p.reviews ?? 0,
        bestseller: !!p.bestseller,
        promo: !!p.promo,
        addonGroups: (p.addon_groups ?? [])
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
          .map(
            (g: any): AddonGroup => ({
              id: g.id,
              name: g.name,
              type: g.type,
              required: g.required,
              max: g.max_select ?? undefined,
              options: (g.addon_options ?? [])
                .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
                .map((o: any) => ({ id: o.id, name: o.name, price: Number(o.price) })),
            }),
          ),
      }));

      return mapStore(s as unknown as DbStore, mapped);
    },
  });

export const useCoupons = () =>
  useQuery({
    queryKey: ["coupons"],
    queryFn: async (): Promise<Coupon[]> => {
      const { data, error } = await supabase.from("coupons").select("*");
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        code: c.code,
        type: c.type,
        value: Number(c.value),
        minOrder: c.min_order ? Number(c.min_order) : undefined,
        label: c.label,
      }));
    },
  });
