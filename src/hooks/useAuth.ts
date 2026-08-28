import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type Role = "admin" | "store_owner" | "customer";

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
};

export const useAuth = (): AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName?: string, phone?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isOwner: boolean;
} => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    loading: true,
  });

  useEffect(() => {
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      if (session?.user) {
        // Defer role fetch to avoid deadlocks
        setTimeout(() => loadRoles(session.user.id), 0);
      } else {
        setState((s) => ({ ...s, roles: [], loading: false }));
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      if (session?.user) loadRoles(session.user.id);
      else setState((s) => ({ ...s, loading: false }));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const loadRoles = async (uid: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setState((s) => ({ ...s, roles: (data?.map((r) => r.role) as Role[]) ?? [], loading: false }));
  };

  const translateError = (msg?: string): string | null => {
    if (!msg) return null;
    const m = msg.toLowerCase();
    if (m.includes("invalid login") || m.includes("invalid credentials")) return "Email ou senha incorretos";
    if (m.includes("email not confirmed")) return "Confirme seu email antes de entrar";
    if (m.includes("user already registered") || m.includes("already been registered")) return "Este email já está cadastrado";
    if (m.includes("password should be at least")) return "A senha deve ter no mínimo 6 caracteres";
    if (m.includes("weak") || m.includes("pwned") || m.includes("known to be")) return "Senha muito fraca. Escolha outra mais forte";
    if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos";
    if (m.includes("invalid email")) return "Email inválido";
    if (m.includes("network")) return "Erro de conexão. Verifique sua internet";
    if (m.includes("signup") && m.includes("disabled")) return "Cadastros estão temporariamente desativados";
    return msg;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: translateError(error?.message) };
  };

  const signUp = async (email: string, password: string, displayName?: string, phone?: string) => {
    const meta: Record<string, string> = {};
    if (displayName) meta.display_name = displayName;
    if (phone) meta.phone = phone;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: Object.keys(meta).length ? meta : undefined,
      },
    });
    return { error: translateError(error?.message) };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    isOwner: state.roles.includes("store_owner") || state.roles.includes("admin"),
  };
};
