import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type StoreToggles = {
  sound_alerts_enabled: boolean;
  auto_print_enabled: boolean;
  print_format: "a4" | "thermal_80mm";
  pdv_enabled: boolean;
};

const DEFAULTS: StoreToggles = {
  sound_alerts_enabled: true,
  auto_print_enabled: false,
  print_format: "thermal_80mm",
  pdv_enabled: true,
};

export const useStoreToggles = (storeId: string | null | undefined) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["store-toggles", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<StoreToggles> => {
      const { data, error } = await supabase
        .from("stores")
        .select("sound_alerts_enabled, auto_print_enabled, print_format, pdv_enabled")
        .eq("id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...(data as Partial<StoreToggles> | null) };
    },
  });

  const update = async (patch: Partial<StoreToggles>) => {
    if (!storeId) return;
    qc.setQueryData(["store-toggles", storeId], (old: StoreToggles | undefined) => ({
      ...DEFAULTS,
      ...(old ?? {}),
      ...patch,
    }));
    const { error } = await supabase.from("stores").update(patch).eq("id", storeId);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["store-toggles", storeId] });
    } else {
      qc.invalidateQueries({ queryKey: ["store-settings", storeId] });
    }
  };

  return {
    toggles: query.data ?? DEFAULTS,
    isLoading: query.isLoading,
    update,
  };
};
