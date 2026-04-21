import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateProfile = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { display_name?: string; phone?: string | null; avatar_url?: string | null; cpf?: string | null; birthday?: string | null }) => {
      if (!user) throw new Error("Faça login");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...input, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast({ description: "Perfil atualizado" });
    },
    onError: (e: Error) => toast({ description: e.message, variant: "destructive" }),
  });
};

export const useUpdatePassword = () =>
  useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => toast({ description: "Senha alterada com sucesso" }),
    onError: (e: Error) => toast({ description: e.message, variant: "destructive" }),
  });
