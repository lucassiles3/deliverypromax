import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type StoreGroup = {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
};

export const ProductAddonGroupsLinker = ({
  storeId,
  productId,
}: {
  storeId: string;
  productId: string;
}) => {
  const qc = useQueryClient();

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["addon-groups-store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_groups")
        .select("id, name, type, required")
        .eq("store_id", storeId)
        .is("product_id", null)
        .order("position");
      if (error) throw error;
      return (data ?? []) as StoreGroup[];
    },
  });

  const { data: linked = [], isLoading: loadingLinks } = useQuery({
    queryKey: ["product-addon-groups", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_addon_groups")
        .select("id, group_id, position")
        .eq("product_id", productId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const linkedMap = new Map(linked.map((l: any) => [l.group_id, l.id]));

  const toggle = async (groupId: string) => {
    if (linkedMap.has(groupId)) {
      const linkId = linkedMap.get(groupId)!;
      const { error } = await supabase.from("product_addon_groups").delete().eq("id", linkId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("product_addon_groups")
        .insert({ product_id: productId, group_id: groupId, position: linked.length });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["product-addon-groups", productId] });
  };

  if (loadingGroups || loadingLinks) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando grupos...
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed p-4 text-center text-xs text-muted-foreground">
        Nenhum grupo reutilizável cadastrado. Vá na aba <strong>Adicionais</strong> do catálogo para criar.
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {groups.map((g) => {
        const isLinked = linkedMap.has(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => toggle(g.id)}
            className={`flex items-center justify-between rounded-xl border-2 p-3 text-left transition-smooth ${
              isLinked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}
          >
            <div>
              <div className="text-sm font-bold">{g.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {g.type === "single" ? "Escolha 1" : "Múltipla"}
                {g.required ? " • Obrigatório" : ""}
              </div>
            </div>
            {isLinked && <Check className="h-5 w-5 text-primary" />}
          </button>
        );
      })}
    </div>
  );
};
