import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HomeProduct {
  id: string;
  product_name: string;
  store_name: string;
  segment?: string | null;
  promo_price: number;
  old_price?: number | null;
  description?: string | null;
  product_link: string;
  image_url?: string | null;
  position?: number;
}

interface UseHomeProductsOptions {
  pageSize?: number;
  segment?: string | null;
  search?: string;
}

export function useHomeProducts({ pageSize = 8, segment, search }: UseHomeProductsOptions = {}) {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["home-products", page, pageSize, segment, search],
    staleTime: 1000 * 60 * 5, // 5 minutes cache to avoid redundant database reads/egress
    queryFn: async () => {
      const from = 0;
      const to = page * pageSize - 1;

      let q = supabase
        .from("home_products" as any)
        .select("id, product_name, store_name, segment, promo_price, old_price, description, product_link, image_url, active, position", { count: "exact" })
        .eq("active", true);

      if (segment && segment !== "all") {
        q = q.ilike("segment", `%${segment}%`);
      }

      if (search && search.trim()) {
        const term = search.trim();
        q = q.or(`product_name.ilike.%${term}%,store_name.ilike.%${term}%,description.ilike.%${term}%`);
      }

      const { data, count, error } = await q
        .order("position", { ascending: true })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (!error && data && data.length > 0) {
        return {
          items: data.map((item: any) => ({
            id: item.id,
            product_name: item.product_name,
            store_name: item.store_name,
            segment: item.segment,
            promo_price: Number(item.promo_price),
            old_price: item.old_price != null ? Number(item.old_price) : null,
            description: item.description,
            product_link: item.product_link,
            image_url: item.image_url,
            position: item.position,
          })) as HomeProduct[],
          totalCount: count ?? data.length,
        };
      }

      // Fallback para tabela de produtos padrão se home_products ainda estiver vazia
      let fallbackQ = supabase
        .from("products")
        .select("id, name, description, price, old_price, image_url, category, store_id, stores!inner(name, slug)", { count: "exact" })
        .eq("active", true);

      if (search && search.trim()) {
        fallbackQ = fallbackQ.ilike("name", `%${search.trim()}%`);
      }

      const { data: fbData, count: fbCount, error: fbError } = await fallbackQ
        .order("rating", { ascending: false })
        .range(from, to);

      if (fbError || !fbData) return { items: [], totalCount: 0 };

      const items: HomeProduct[] = fbData.map((p: any) => ({
        id: p.id,
        product_name: p.name,
        store_name: p.stores?.name ?? "Loja Parceira",
        segment: p.category ?? "Geral",
        promo_price: Number(p.price),
        old_price: p.old_price != null ? Number(p.old_price) : null,
        description: p.description,
        product_link: `/loja/${p.stores?.slug ?? "parceiro"}/produto/${p.id}`,
        image_url: p.image_url,
      }));

      return {
        items,
        totalCount: fbCount ?? items.length,
      };
    },
  });

  const items = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const hasMore = items.length < totalCount;

  const loadMore = () => {
    if (hasMore && !query.isFetching) {
      setPage((prev) => prev + 1);
    }
  };

  const resetPagination = () => {
    setPage(1);
  };

  return {
    products: items,
    totalCount,
    hasMore,
    page,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    loadMore,
    resetPagination,
    refetch: query.refetch,
  };
}
