import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Canal Realtime compartilhado para a tabela `orders` por loja.
 *
 * Antes, cada consumidor (Admin.tsx, OrdersKanban, NewOrderAlerts) criava
 * seu próprio canal `orders:{storeId}` — três conexões WebSocket simultâneas
 * para a mesma tabela. Este hook mantém UMA única subscription por storeId
 * usando um contador de referências; quando o último consumidor desmonta,
 * o canal é fechado automaticamente.
 *
 * Uso:
 *   useOrdersChannel(storeId, (payload) => {
 *     if (payload.eventType === "INSERT") { ... }
 *   });
 */

type OrderEvent = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: any;
  old: any;
};

type Entry = {
  channel: RealtimeChannel;
  refCount: number;
  listeners: Set<(p: OrderEvent) => void>;
};

const registry = new Map<string, Entry>();

const acquire = (storeId: string, listener: (p: OrderEvent) => void): Entry => {
  let entry = registry.get(storeId);
  if (!entry) {
    const listeners = new Set<(p: OrderEvent) => void>();
    const channel = supabase
      .channel(`orders-shared:${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload: any) => {
          const evt: OrderEvent = {
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
          };
          listeners.forEach((fn) => {
            try { fn(evt); } catch (e) { console.warn("[useOrdersChannel] listener error", e); }
          });
        },
      )
      .subscribe();
    entry = { channel, refCount: 0, listeners };
    registry.set(storeId, entry);
  }
  entry.listeners.add(listener);
  entry.refCount += 1;
  return entry;
};

const release = (storeId: string, listener: (p: OrderEvent) => void) => {
  const entry = registry.get(storeId);
  if (!entry) return;
  entry.listeners.delete(listener);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    registry.delete(storeId);
  }
};

export const useOrdersChannel = (
  storeId: string | null | undefined,
  onEvent: (payload: OrderEvent) => void,
) => {
  useEffect(() => {
    if (!storeId) return;
    acquire(storeId, onEvent);
    return () => release(storeId, onEvent);
    // onEvent é tratado como callback estável; consumidores devem usar useCallback ou ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);
};
