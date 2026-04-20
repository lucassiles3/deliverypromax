import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * Cache local inteligente
 * - staleTime: tempo até os dados serem considerados "antigos" (sem refetch)
 * - gcTime:    tempo que os dados ficam em memória após não usados
 *
 * Persistimos no localStorage para que dados de leitura pública
 * (lojas, categorias, produtos, configs) fiquem disponíveis
 * imediatamente em uma nova sessão — sem flash de loading.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      gcTime: 1000 * 60 * 60 * 24, // 24h
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

export const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "ff-cache-v1",
  throttleTime: 1000,
});

/**
 * Lista de queryKeys que VALEM A PENA persistir no disco.
 * Tudo que não estiver aqui fica só em memória (RAM).
 *
 * Persistir:
 *  - Lojas (públicas), categorias, produtos
 *  - Perfil do usuário, endereços, favoritos
 *  - Configurações de loja, banners
 *  - Últimos pedidos do cliente
 *
 * NÃO persistir:
 *  - Sessões/itens de mesa em tempo real
 *  - Caixa do PDV / movimentos
 *  - Pedidos do admin (kanban) — mudam constantemente
 */
const PERSIST_KEYS = new Set<string>([
  "stores",
  "store",
  "products",
  "categories",
  "profile",
  "addresses",
  "favorites",
  "favorite-products",
  "favorite-stores",
  "store-toggles",
  "store-payment-methods",
  "store-loyalty",
  "user-orders",
  "loyalty",
]);

export const shouldPersistQuery = (queryKey: readonly unknown[]): boolean => {
  const root = queryKey[0];
  return typeof root === "string" && PERSIST_KEYS.has(root);
};
