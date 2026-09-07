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
 *  - Configurações de loja, banners
 *
 * NÃO persistir (ficar somente em RAM para isolamento multi-tenant):
 *  - Perfil do usuário, endereços, favoritos, pedidos do cliente, pontos de fidelidade
 *  - Sessões/itens de mesa em tempo real
 *  - Caixa do PDV / movimentos
 *  - Pedidos do admin (kanban)
 */
const PERSIST_KEYS = new Set<string>([
  "stores",
  "store",
  "products",
  "categories",
  "store-toggles",
  "store-payment-methods",
  "store-loyalty",
  "home-banners",
]);

export const shouldPersistQuery = (queryKey: readonly unknown[]): boolean => {
  const root = queryKey[0];
  return typeof root === "string" && PERSIST_KEYS.has(root);
};
