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
 * Normaliza e extrai os valores de colunas independentemente do nome exato ou formato (Português/Inglês, com/sem acento).
 */
function getColumnValue(row: any, ...candidates: string[]) {
  if (!row || typeof row !== "object") return null;

  // 1. Checagem exata da propriedade
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  // 2. Checagem insensível a maiúsculas/minúsculas e acentos
  const rowKeys = Object.keys(row);
  for (const candidate of candidates) {
    const normCandidate = candidate
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

    for (const rk of rowKeys) {
      const normRowKey = rk
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

      if (normRowKey === normCandidate && row[rk] !== undefined && row[rk] !== null && row[rk] !== "") {
        return row[rk];
      }
    }
  }

  return null;
}

function normalizeHomeProductRow(row: any, index: number): HomeProduct {
  const name = getColumnValue(row, "Nome do Produto", "nome_do_produto", "nomeDoProduto", "product_name", "name", "nome", "produto", "titulo", "title") || `Produto ${index + 1}`;
  const store = getColumnValue(row, "Estabelecimento", "estabelecimento", "store_name", "loja", "store", "parceiro", "empresa") || "Estabelecimento";
  const segment = getColumnValue(row, "Segmento", "segmento", "segment", "categoria", "category", "tipo");
  
  // Tratamento numérico para preço promocional (Promoção / promo_price)
  const rawPromo = getColumnValue(row, "Promoção", "promocao", "promo_price", "preco_promocional", "preco", "price", "valor", "valor_promocional");
  const promo = typeof rawPromo === "number" ? rawPromo : parseFloat(String(rawPromo ?? "0").replace("R$", "").replace(",", ".").trim()) || 0;

  // Tratamento numérico para preço antigo (Preço Antigo / old_price)
  const rawOld = getColumnValue(row, "Preço Antigo", "preco_antigo", "old_price", "precoAntigo", "preco_original", "valor_antigo");
  const oldPrice = rawOld != null && rawOld !== "" 
    ? (typeof rawOld === "number" ? rawOld : parseFloat(String(rawOld).replace("R$", "").replace(",", ".").trim()) || null)
    : null;

  const desc = getColumnValue(row, "Descrição", "descricao", "description", "desc", "detalhes");
  const link = getColumnValue(row, "Link do Produto", "link_do_produto", "product_link", "link", "url", "link_produto") || "#";
  const image = getColumnValue(row, "Link da Imagem", "link_da_imagem", "image_url", "linkdaimagem", "imagem", "image", "foto", "picture", "url_imagem") || null;

  return {
    id: row.id || `home-prod-${index}`,
    product_name: String(name),
    store_name: String(store),
    segment: segment ? String(segment) : null,
    promo_price: isNaN(promo) ? 0 : promo,
    old_price: oldPrice != null && !isNaN(oldPrice) ? oldPrice : null,
    description: desc ? String(desc) : null,
    product_link: String(link),
    image_url: image ? String(image) : null,
    position: row.position ?? index,
  };
}

export function useHomeProducts({ pageSize = 8, segment, search }: UseHomeProductsOptions = {}) {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["home-products-real", page, pageSize, segment, search],
    staleTime: 1000 * 60 * 3, // 3 minutos de cache
    queryFn: async () => {
      const from = 0;
      const to = page * pageSize - 1;

      // Nomes de tabelas possíveis que podem ter sido criados no Supabase
      const tablesToTry = [
        "produtos_home",
        "produtos home",
        "home_products",
        "Produtos Home",
        "produtoshome",
        "home_produtos",
        "produtos_destaque",
        "destaques",
      ];

      for (const tableName of tablesToTry) {
        try {
          const { data, count, error } = await supabase
            .from(tableName as any)
            .select("*", { count: "exact" })
            .range(from, to);

          if (error) {
            console.warn(`[useHomeProducts] Tabela "${tableName}" retornou erro:`, error.message);
            continue;
          }

          if (data && data.length > 0) {
            let items = data.map((row: any, idx: number) => normalizeHomeProductRow(row, idx));

            // Filtro por segmento se selecionado
            if (segment && segment !== "all") {
              const segLower = segment.toLowerCase();
              items = items.filter((i) => i.segment && i.segment.toLowerCase().includes(segLower));
            }

            // Filtro por termo de busca se fornecido
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
        } catch (err: any) {
          console.warn(`[useHomeProducts] Exceção ao consultar "${tableName}":`, err?.message);
        }
      }

      // Retorna vazio se ainda não houver registros cadastrados na tabela do banco do usuário
      return {
        items: [] as HomeProduct[],
        totalCount: 0,
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
