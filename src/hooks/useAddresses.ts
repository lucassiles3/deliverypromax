import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export type AddressInput = {
  label?: string | null;
  cep: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  reference?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_default?: boolean;
};

export const useAddresses = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_addresses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useSaveAddress = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: AddressInput & { id?: string }) => {
      if (!user) throw new Error("Faça login");
      if (input.is_default) {
        await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", user.id);
      }
      if (id) {
        const { error } = await supabase.from("user_addresses").update(input).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_addresses").insert({ ...input, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast({ description: "Endereço salvo" });
    },
    onError: (e: Error) => toast({ description: e.message, variant: "destructive" }),
  });
};

export const useDeleteAddress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast({ description: "Endereço removido" });
    },
  });
};
