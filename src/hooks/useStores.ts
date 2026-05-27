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
  cnpj?: string | null;
  phone?: string | null;
  instagram?: string | null;
  website?: string | null;
  short_description?: string | null;
  address_cep?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_state?: string | null;
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
  cnpj: s.cnpj ?? undefined,
  phone: s.phone ?? undefined,
  instagram: s.instagram ?? undefined,
  website: s.website ?? undefined,
  shortDescription: s.short_description ?? undefined,
  addressCep: s.address_cep ?? undefined,
  addressStreet: s.address_street ?? undefined,
  addressNumber: s.address_number ?? undefined,
  addressComplement: s.address_complement ?? undefined,
  addressNeighborhood: s.address_neighborhood ?? undefined,
  addressState: s.address_state ?? undefined,
});

export const useStores = () =>
  useQuery({
    queryKey: ["stores"],
    queryFn: async (): Promise<Store[]> => {
      // Oculta lojas demo/seed (sem dono atribuído) de todas as listagens públicas.
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .not("owner_id", "is", null)
        .order("name");
      if (error) throw error;
      return (data as unknown as DbStore[]).map((s) => mapStore(s));
    },
  });

export const useStoreBySlug = (slug: string) =>
  useQuery({
    queryKey: ["store", slug],
    enabled: !!slug,
    queryFn: async (): Promise<Store | null> => {
      // Paraleliza as duas queries — a de produtos filtra pela slug via inner-join
      // em stores, evitando o waterfall (fetch loja → fetch produtos).
      const storePromise = supabase
        .from("stores")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      const productsPromise = supabase
        .from("products")
        .select(
          `id, name, description, price, old_price, image_url, category, rating, reviews,
           bestseller, promo, position,
           stores!inner(slug),
           addon_groups!addon_groups_product_id_fkey (
             id, name, type, required, max_select, position,
             addon_options (id, name, price, position),
             addon_group_items (
               position, price_override,
               addon_items (id, name, description, image_url, price, active, track_stock, stock)
             )
           ),
           product_addon_groups (
             position,
             addon_groups (
               id, name, type, required, max_select, position,
               addon_group_items (
                 position, price_override,
                 addon_items (id, name, description, image_url, price, active, track_stock, stock)
               )
             )
           )`,
        )
        .eq("stores.slug", slug)
        .eq("active", true)
        .order("position");

      const [{ data: s, error: storeError }, { data: products }] = await Promise.all([
        storePromise,
        productsPromise,
      ]);

      if (storeError) throw storeError;
      if (!s) return null;

      const itemsToOptions = (groupItems: any[] = []) =>
        (groupItems ?? [])
          .filter((gi: any) => gi?.addon_items?.active !== false)
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
          .map((gi: any) => {
            const it = gi.addon_items ?? {};
            const out = it.track_stock && (it.stock ?? 0) <= 0;
            return {
              id: it.id,
              name: it.name,
              description: it.description ?? undefined,
              image: resolveAsset(it.image_url) || undefined,
              price: Number(gi.price_override ?? it.price ?? 0),
              outOfStock: !!out,
            };
          });

      const mapGroup = (g: any): AddonGroup => {
        const fromItems = itemsToOptions(g.addon_group_items);
        const fromOptions = (g.addon_options ?? [])
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
          .map((o: any) => ({ id: o.id, name: o.name, price: Number(o.price) }));
        return {
          id: g.id,
          name: g.name,
          type: g.type,
          required: g.required,
          max: g.max_select ?? undefined,
          options: fromItems.length > 0 ? fromItems : fromOptions,
        };
      };

      const mapped: Product[] = (products ?? []).map((p: any) => {
        const direct = (p.addon_groups ?? []).map((g: any) => ({ g, pos: g.position ?? 0 }));
        const linked = (p.product_addon_groups ?? []).map((pag: any) => ({
          g: pag.addon_groups,
          pos: pag.position ?? 0,
        }));
        const seen = new Set<string>();
        const allGroups = [...direct, ...linked]
          .filter((x) => x.g && !seen.has(x.g.id) && (seen.add(x.g.id), true))
          .sort((a, b) => a.pos - b.pos)
          .map((x) => mapGroup(x.g))
          .filter((g) => g.options.length > 0);

        return {
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
          addonGroups: allGroups,
        };
      });

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
