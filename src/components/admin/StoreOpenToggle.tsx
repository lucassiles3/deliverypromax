import { useEffect, useState } from "react";
import { Power, PowerOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Props = {
  storeId: string | null | undefined;
  /** "floating" exibe um FAB fixo; "inline" renderiza um chip compacto */
  variant?: "floating" | "inline";
  className?: string;
};

/**
 * Botão de abrir/fechar a loja. Pode ser usado como FAB global (floating)
 * em qualquer tela do painel/PDV, mantendo o estado sincronizado via React Query.
 */
export const StoreOpenToggle = ({ storeId, variant = "floating", className }: Props) => {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["store-open-status", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, open")
        .eq("id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; open: boolean } | null;
    },
  });

  // Realtime: se outro operador abrir/fechar, reflete imediatamente.
  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`store-open-${storeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stores", filter: `id=eq.${storeId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["store-open-status", storeId] });
          qc.invalidateQueries({ queryKey: ["stores"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, qc]);

  const toggle = async () => {
    if (!storeId || !data || saving) return;
    setSaving(true);
    const next = !data.open;
    // Optimistic
    qc.setQueryData(["store-open-status", storeId], { ...data, open: next });
    const { error } = await supabase.from("stores").update({ open: next }).eq("id", storeId);
    setSaving(false);
    if (error) {
      qc.setQueryData(["store-open-status", storeId], data);
      toast.error("Não foi possível alterar o status da loja", { description: error.message });
      return;
    }
    qc.invalidateQueries({ queryKey: ["stores"] });
    qc.invalidateQueries({ queryKey: ["store", data.name] });
    toast.success(next ? "Loja aberta — recebendo pedidos" : "Loja fechada — pedidos pausados");
  };

  if (!storeId || isLoading || !data) return null;

  const open = data.open;
  const Icon = saving ? Loader2 : open ? Power : PowerOff;

  if (variant === "inline") {
    return (
      <button
        onClick={toggle}
        disabled={saving}
        className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-all ${
          open
            ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
            : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
        } ${className ?? ""}`}
        title={open ? "Clique para fechar a loja" : "Clique para abrir a loja"}
      >
        <Icon className={`h-3.5 w-3.5 ${saving ? "animate-spin" : ""}`} />
        {open ? "Aberta" : "Fechada"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold shadow-glow transition-all hover:scale-105 active:scale-95 md:bottom-6 ${
        open
          ? "bg-success text-success-foreground"
          : "bg-destructive text-destructive-foreground animate-pulse"
      } ${className ?? ""}`}
      title={open ? "Clique para fechar a loja" : "Clique para abrir a loja"}
    >
      <Icon className={`h-5 w-5 ${saving ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{open ? "Loja Aberta" : "Loja Fechada"}</span>
    </button>
  );
};
