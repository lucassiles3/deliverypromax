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

/**
 * Normaliza valores de colunas independentemente se a tabela Supabase usa nomes em português ou inglês.
 * Ex: "Nome do Produto", "nome_do_produto", "product_name", "Promoção", "promocao", "promo_price", etc.
 */
function getColumnValue(row: any, ...candidates: string[]) {
  if (!row || typeof row !== "object") return null;

  for (const key of candidates) {
    // Busca exata
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
    // Busca case-insensitive limpando acentos e caracteres especiais
    const cleanCandidate = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    for (const rk of Object.keys(row)) {
      const cleanRowKey = rk.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      if (cleanRowKey === cleanCandidate && row[rk] !== undefined && row[rk] !== null) {
        return row[rk];
      }
    }
  }
  return null;
}

function normalizeHomeProductRow(row: any, index: number): HomeProduct {
  const name = getColumnValue(row, "product_name", "nome_do_produto", "nomeDoProduto", "Nome do Produto", "name", "nome", "produto") || `Produto ${index + 1}`;
  const store = getColumnValue(row, "store_name", "estabelecimento", "Estabelecimento", "loja", "store") || "Loja Parceira";
  const segment = getColumnValue(row, "segment", "segmento", "Segmento", "categoria", "category");
  const promo = Number(getColumnValue(row, "promo_price", "promocao", "Promoção", "preco_promocional", "preco", "price") ?? 0);
  const oldPrice = getColumnValue(row, "old_price", "preco_antigo", "Preço Antigo", "oldPrice");
  const desc = getColumnValue(row, "description", "descricao", "Descrição", "desc");
  const link = getColumnValue(row, "product_link", "link_do_produto", "Link do Produto", "linkDoProduto", "link", "url") || "#";
  const image = getColumnValue(row, "image_url", "link_da_imagem", "Link da Imagem", "linkDaImagem", "imagem", "image") || null;

  return {
    id: row.id || `home-prod-${index}`,
    product_name: String(name),
    store_name: String(store),
    segment: segment ? String(segment) : null,
    promo_price: isNaN(promo) ? 0 : promo,
    old_price: oldPrice != null && !isNaN(Number(oldPrice)) ? Number(oldPrice) : null,
    description: desc ? String(desc) : null,
    product_link: String(link),
    image_url: image ? String(image) : null,
    position: row.position ?? index,
  };
}

export function useHomeProducts({ pageSize = 8, segment, search }: UseHomeProductsOptions = {}) {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["home-products", page, pageSize, segment, search],
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos para evitar requisições repetidas e economizar egress
    queryFn: async () => {
      const from = 0;
      const to = page * pageSize - 1;

      // Nomes de tabelas possíveis que o usuário pode ter criado no Supabase
      const tablesToTry = ["produtos_home", "home_products", "produtos home"];

      for (const tableName of tablesToTry) {
        try {
          const { data, count, error } = await supabase
            .from(tableName as any)
            .select("*", { count: "exact" })
            .range(from, to);

          if (!error && data && data.length > 0) {
            let items = data.map((row: any, idx: number) => normalizeHomeProductRow(row, idx));

            // Filtro local por segmento se selecionado
            if (segment && segment !== "all") {
              const segLower = segment.toLowerCase();
              items = items.filter((i) => i.segment && i.segment.toLowerCase().includes(segLower));
            }

            // Filtro local por busca se fornecido
            if (search && search.trim()) {
              const sLower = search.trim().toLowerCase();
              items = items.filter(
                (i) =>
                  i.product_name.toLowerCase().includes(sLower) ||
                  i.store_name.toLowerCase().includes(sLower) ||
                  (i.description && i.description.toLowerCase().includes(sLower))
              );
            }

            return {
              items,
              totalCount: count ?? items.length,
            };
          }
        } catch {
          /* tenta próxima tabela */
        }
      }

      // Fallback para tabela de produtos padrão caso produtos_home ainda não tenha registros
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
