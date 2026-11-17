import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { queryClient } from "@/lib/queryClient";

type Role = "super_admin" | "admin" | "store_owner" | "customer";

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
};

export const clearUserSessionState = () => {
  try {
    queryClient.clear();
    localStorage.removeItem("ff_cart");
    localStorage.removeItem("ff_last_contact");
  } catch (err) {
    console.warn("Erro ao limpar estado local de sessão:", err);
  }
};

// Estado global compartilhado em memória (Singleton) para evitar que dezenas de
// componentes (ex.: botões de favorito em cada card) disparem getSession() e
// queries duplicadas em user_roles simultaneamente.
let sharedState: AuthState = {
  user: null,
  session: null,
  roles: [],
  loading: true,
};

const listeners = new Set<(state: AuthState) => void>();
let authInitialized = false;
let lastLoadedRoleUid: string | null = null;
let roleFetchPromise: Promise<void> | null = null;

function setSharedState(updater: (prev: AuthState) => AuthState) {
  sharedState = updater(sharedState);
  listeners.forEach((l) => l(sharedState));
}

async function loadRolesOnce(uid: string) {
  if (lastLoadedRoleUid === uid && !sharedState.loading) return;
  if (roleFetchPromise && lastLoadedRoleUid === uid) return roleFetchPromise;
  lastLoadedRoleUid = uid;
  roleFetchPromise = (async () => {
    try {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (error) console.warn("Erro ao carregar papéis do usuário:", error);
      setSharedState((s) => ({
        ...s,
        roles: (data?.map((r) => r.role) as Role[]) ?? [],
        loading: false,
      }));
    } catch (err) {
      console.error("Erro inesperado ao carregar papéis:", err);
      setSharedState((s) => ({ ...s, loading: false }));
    } finally {
      roleFetchPromise = null;
    }
  })();
  return roleFetchPromise;
}

function initAuthSingleton() {
  if (authInitialized) return;
  authInitialized = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      lastLoadedRoleUid = null;
      clearUserSessionState();
    }
    setSharedState((s) => ({ ...s, session, user: session?.user ?? null }));
    if (session?.user) {
      setTimeout(() => loadRolesOnce(session.user.id), 0);
    } else {
      setSharedState((s) => ({ ...s, roles: [], loading: false }));
    }
  });

  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      setSharedState((s) => ({ ...s, session, user: session?.user ?? null }));
      if (session?.user) loadRolesOnce(session.user.id);
      else setSharedState((s) => ({ ...s, loading: false }));
    })
    .catch((err) => {
      console.error("Erro ao obter sessão:", err);
      setSharedState((s) => ({ ...s, loading: false }));
    });
}

export const useAuth = (): AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName?: string, phone?: string, birthday?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isOwner: boolean;
  isMaster: boolean;
} => {
  initAuthSingleton();
  const [state, setState] = useState<AuthState>(sharedState);

  useEffect(() => {
    setState(sharedState);
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const translateError = (msg?: string): string | null => {
    if (!msg) return null;
    const m = msg.toLowerCase();
    if (m.includes("failed to fetch") || m.includes("fetch failed") || m.includes("networkerror") || m.includes("network error")) {
      return "Erro de conexão com o servidor. Verifique sua internet ou se o projeto Supabase está ativo.";
    }
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
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: translateError(error?.message) };
    } catch (err: any) {
      return { error: translateError(err?.message || "Failed to fetch") };
    }
  };

  const signUp = async (email: string, password: string, displayName?: string, phone?: string, birthday?: string) => {
    try {
      const meta: Record<string, string> = {};
      if (displayName) meta.display_name = displayName;
      if (phone) meta.phone = phone;
      if (birthday) meta.birthday = birthday;
      const { data: authRes, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: Object.keys(meta).length ? meta : undefined,
        },
      });

      if (!error && authRes?.user) {
        await supabase.from("profiles").upsert({
          id: authRes.user.id,
          display_name: displayName || null,
          phone: phone || null,
          birthday: birthday || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
      }

      return { error: translateError(error?.message) };
    } catch (err: any) {
      return { error: translateError(err?.message || "Failed to fetch") };
    }
  };

  const signOut = async () => {
    clearUserSessionState();
    await supabase.auth.signOut();
  };

  const isMaster =
    state.roles.includes("super_admin") ||
    (state.user?.email ?? "").toLowerCase() === "suporteitchat@gmail.com";

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    isOwner: state.roles.includes("store_owner") || state.roles.includes("admin") || isMaster,
    isMaster,
  };
};
