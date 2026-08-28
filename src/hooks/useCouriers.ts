import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Courier = {
  id: string;
  store_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  vehicle_type: string;
  vehicle_plate: string | null;
  photo_url: string | null;
  active: boolean;
  is_online: boolean;
  created_at: string;
  updated_at: string;
};

export const useCouriers = (storeId: string | null) => {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["couriers", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("couriers")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Courier[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Partial<Courier> & { name: string }) => {
      const { error } = await supabase.from("couriers").insert({
        store_id: storeId!,
        name: input.name,
        phone: input.phone ?? null,
        vehicle_type: input.vehicle_type ?? "motorcycle",
        vehicle_plate: input.vehicle_plate ?? null,
        photo_url: input.photo_url ?? null,
        user_id: input.user_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entregador cadastrado");
      qc.invalidateQueries({ queryKey: ["couriers", storeId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Courier> & { id: string }) => {
      const { error } = await supabase.from("couriers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["couriers", storeId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("couriers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entregador removido");
      qc.invalidateQueries({ queryKey: ["couriers", storeId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...list, create, update, remove };
};

// Hook for the courier user themselves (looks up their own courier record by user_id)
export const useMyCourier = () => {
  return useQuery({
    queryKey: ["my-courier"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("couriers")
        .select("*, stores:store_id(name, slug, logo)")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data as (Courier & { stores: { name: string; slug: string; logo: string | null } }) | null;
    },
  });
};
