import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Mail, Lock, User as UserIcon, Phone, Store as StoreIcon, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

type Mode = "signin" | "signup" | "forgot";
type Account = "customer" | "owner";

const Auth = () => {
  const { user, roles, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account>("customer");
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pendingOwner, setPendingOwner] = useState(false);

  useEffect(() => {
    document.title =
      mode === "signup" ? "Cadastre-se • FoodFlash" : mode === "forgot" ? "Recuperar senha • FoodFlash" : "Entrar • FoodFlash";
  }, [mode]);

  // Promote to store_owner if needed, then redirect by account type.
  useEffect(() => {
    if (!user) return;
    const finalize = async () => {
      if (pendingOwner) {
        const { error } = await supabase.functions.invoke("claim-owner-role");
        setPendingOwner(false);
        if (error) {
          toast.error("Não foi possível ativar sua conta de lojista");
          return;
        }
        toast.success("Conta de lojista ativada! 🏪");
        // Force a session refresh so role is reloaded
        window.location.href = "/admin";
        return;
      }
      // Existing user — redirect based on actual roles
      const isOwner = roles.includes("store_owner") || roles.includes("admin");
      if (account === "owner" && isOwner) navigate("/admin");
      else navigate("/");
    };
    finalize();
  }, [user, roles, pendingOwner, account, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Enviamos um link para redefinir sua senha 📧");
      setMode("signin");
      return;
    }

    if (mode === "signup" && account === "owner") setPendingOwner(true);

    const { error } =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, name, phone);
    setLoading(false);
    if (error) {
      setPendingOwner(false);
      toast.error(error);
      return;
    }
    toast.success(mode === "signin" ? "Bem-vindo de volta! 🎉" : "Conta criada! Aproveite 🚀");
  };

  const signInWithGoogle = async () => {
    if (googleLoading) return;
    if (mode === "signup" && account === "owner") setPendingOwner(true);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        toast.error("Não foi possível entrar com Google");
        setPendingOwner(false);
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      toast.success("Bem-vindo! 🎉");
    } catch {
      toast.error("Erro ao conectar com Google");
      setPendingOwner(false);
      setGoogleLoading(false);
    }
  };

  const titles: Record<Mode, { title: string; subtitle: string; cta: string }> = {
    signin: {
      title: account === "owner" ? "Acesso do lojista" : "Bem-vindo de volta",
      subtitle:
        account === "owner"
          ? "Entre para gerenciar pedidos da sua loja"
          : "Entre para acessar pedidos e cashback",
      cta: "Entrar",
    },
    signup: {
      title: account === "owner" ? "Cadastrar minha loja" : "Criar conta",
      subtitle:
        account === "owner"
          ? "Cadastre-se grátis e comece a vender hoje"
          : "Cadastre-se em 30 segundos e ganhe cashback",
      cta: account === "owner" ? "Criar conta de lojista" : "Criar minha conta",
    },
    forgot: {
      title: "Esqueceu a senha?",
      subtitle: "Enviaremos um link para redefinir",
      cta: "Enviar link de recuperação",
    },
  };
  const t = titles[mode];

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container flex items-center justify-center py-10 md:py-16">
        <div className="w-full max-w-md rounded-3xl bg-card p-7 shadow-float">
          {/* Account type selector */}
          {mode !== "forgot" && (
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setAccount("customer")}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-bounce ${
                  account === "customer"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                Sou cliente
              </button>
              <button
                type="button"
                onClick={() => setAccount("owner")}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-bounce ${
                  account === "owner"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <StoreIcon className="h-4 w-4" />
                Sou lojista
              </button>
            </div>
          )}

          <div className="mb-6 text-center">
            <div
              className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-primary-foreground shadow-glow ${
                account === "owner" ? "bg-accent" : "gradient-primary"
              }`}
            >
              {account === "owner" ? <StoreIcon className="h-6 w-6" /> : "F"}
            </div>
            <h1 className="font-display text-3xl font-bold">{t.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
          </div>

          {mode !== "forgot" && (
            <>
              <button
                onClick={signInWithGoogle}
                disabled={googleLoading}
                className="mb-4 flex h-12 w-full items-center justify-center gap-3 rounded-xl border-2 border-border bg-background font-semibold transition-bounce hover:scale-[1.02] hover:border-primary disabled:opacity-50"
              >
                <GoogleIcon />
                {googleLoading ? "Conectando..." : `${mode === "signin" ? "Entrar" : "Cadastrar"} com Google`}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-xs uppercase tracking-wider text-muted-foreground">
                    ou com email
                  </span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <>
                <Field icon={UserIcon}>
                  <input
                    required
                    placeholder={account === "owner" ? "Seu nome (responsável)" : "Seu nome completo"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent outline-none"
                  />
                </Field>
                <Field icon={Phone}>
                  <input
                    placeholder={account === "owner" ? "WhatsApp da loja" : "WhatsApp (opcional)"}
                    required={account === "owner"}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-transparent outline-none"
                  />
                </Field>
              </>
            )}
            <Field icon={Mail}>
              <input
                required
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none"
              />
            </Field>
            {mode !== "forgot" && (
              <Field icon={Lock}>
                <input
                  required
                  type="password"
                  placeholder="Senha (mín. 6 caracteres)"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent outline-none"
                />
              </Field>
            )}

            {mode === "signin" && (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="w-full text-right text-xs font-medium text-primary hover:underline"
              >
                Esqueci minha senha
              </button>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className={`h-12 w-full rounded-xl font-bold shadow-glow transition-bounce hover:scale-[1.02] ${
                account === "owner" ? "bg-accent text-accent-foreground hover:bg-accent/90" : "gradient-primary"
              }`}
            >
              {loading ? "Aguarde..." : t.cta}
            </Button>
          </form>

          {mode === "signup" && (
            <div
              className={`mt-5 rounded-xl p-3 text-center text-xs ${
                account === "owner" ? "bg-accent/10 text-accent-foreground" : "bg-success/5 text-success"
              }`}
            >
              <Sparkles className="mr-1 inline h-3.5 w-3.5" />
              {account === "owner"
                ? "0% de mensalidade • Receba pedidos no WhatsApp"
                : "Ganhe 5% de cashback em todos os pedidos"}
            </div>
          )}

          <button
            onClick={() =>
              setMode(mode === "signin" ? "signup" : "signin")
            }
            className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? (
              <>
                {account === "owner" ? "Ainda não tem loja cadastrada?" : "Não tem conta?"}{" "}
                <strong className="text-primary">
                  {account === "owner" ? "Cadastrar minha loja" : "Cadastre-se grátis"}
                </strong>
              </>
            ) : mode === "signup" ? (
              <>
                Já tem conta? <strong className="text-primary">Entrar</strong>
              </>
            ) : (
              <>
                Lembrou a senha? <strong className="text-primary">Voltar ao login</strong>
              </>
            )}
          </button>

          <Link
            to="/"
            className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground"
          >
            ← Continuar como visitante
          </Link>
        </div>
      </div>
    </div>
  );
};

const Field = ({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) => (
  <label className="flex items-center gap-2 rounded-xl border-2 border-border bg-background p-3 text-sm transition-smooth focus-within:border-primary">
    <Icon className="h-4 w-4 text-muted-foreground" />
    {children}
  </label>
);

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default Auth;
