import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, phone, avatar_url, cpf, birthday, role, created_at, updated_at")
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
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...input, updated_at: new Date().toISOString() });
      if (profileError) throw profileError;

      // Sync metadata with Auth User
      const meta: Record<string, any> = {};
      if (input.display_name !== undefined) meta.display_name = input.display_name;
      if (input.phone !== undefined) meta.phone = input.phone;
      if (input.birthday !== undefined) meta.birthday = input.birthday;
      if (Object.keys(meta).length > 0) {
        await supabase.auth.updateUser({ data: meta }).catch(() => {});
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado com sucesso! 🎉");
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao atualizar perfil"),
  });
};

export const useUpdatePassword = () =>
  useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Senha alterada com sucesso! 🔒"),
    onError: (e: Error) => toast.error(e.message || "Erro ao alterar senha"),
  });
