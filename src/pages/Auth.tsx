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
  const [account, setAccountState] = useState<Account>(() => {
    try {
      const stored = localStorage.getItem("ff_pending_account_type") as Account | null;
      if (stored === "owner" || stored === "customer") return stored;
    } catch {}
    return "customer";
  });
  const setAccount = (a: Account) => {
    try { localStorage.setItem("ff_pending_account_type", a); } catch {}
    setAccountState(a);
  };
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingOwner, setPendingOwner] = useState(false);

  useEffect(() => {
    document.title =
      mode === "signup" ? "Cadastre-se • Itchat Brasil" : mode === "forgot" ? "Recuperar senha • Itchat Brasil" : "Entrar • Itchat Brasil";
  }, [mode]);

  // Redireciona conforme tipo de conta selecionado.
  // Lojista → /admin (promovendo se necessário). Cliente → /
  useEffect(() => {
    if (!user) return;
    const finalize = async () => {
      const stored = (() => {
        try {
          return localStorage.getItem("ff_pending_account_type") as Account | null;
        } catch {
          return null;
        }
      })();
      const effectiveAccount: Account = stored ?? account;
      const isOwner = roles.includes("store_owner") || roles.includes("admin");

      if (effectiveAccount === "owner") {
        if (!isOwner) {
          // Tenta via RPC PostgreSQL direto primeiro
          const { error: rpcErr } = await (supabase.rpc as any)("claim_owner_role");
          if (rpcErr) {
            // Fallback para edge function
            const { error: fnErr } = await supabase.functions.invoke("claim-owner-role");
            if (fnErr) {
              toast.error("Não foi possível ativar sua conta de lojista");
              setPendingOwner(false);
              return;
            }
          }
          toast.success("Conta de lojista ativada! 🏪");
        }
        setPendingOwner(false);
        try { localStorage.removeItem("ff_pending_account_type"); } catch {}
        window.location.replace("/admin");
        return;
      }

      setPendingOwner(false);
      try { localStorage.removeItem("ff_pending_account_type"); } catch {}
      window.location.replace("/");
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
    toast.success(mode === "signin" ? "Bem-vindo de volta! 🎉" : "Conta criada! Aproveite 🚀");
  };

  const titles: Record<Mode, { title: string; subtitle: string; cta: string }> = {
    signin: {
      title: account === "owner" ? "Acesso do lojista" : "Bem-vindo de volta",
      subtitle:
        account === "owner"
          ? "Entre para gerenciar pedidos da sua loja"
          : "Entre para acessar seus pedidos",
      cta: "Entrar",
    },
    signup: {
      title: account === "owner" ? "Cadastrar minha loja" : "Criar conta",
      subtitle:
        account === "owner"
          ? "Cadastre-se grátis e comece a vender hoje"
          : "Cadastre-se em 30 segundos e comece a comprar",
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
              <>
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
                {mode === "signup" && (
                  <PasswordStrength password={password} />
                )}
              </>
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
                : "Compre com segurança e praticidade"}
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

const PasswordStrength = ({ password }: { password: string }) => {
  const rules = [
    { label: "Mínimo de 6 caracteres", test: password.length >= 6 },
    { label: "Uma letra maiúscula", test: /[A-Z]/.test(password) },
    { label: "Uma letra minúscula", test: /[a-z]/.test(password) },
    { label: "Um número", test: /\d/.test(password) },
    { label: "Um caractere especial (!@#$...)", test: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = rules.filter((r) => r.test).length;
  const pct = (score / rules.length) * 100;
  const levels = [
    { label: "Muito fraca", color: "bg-destructive" },
    { label: "Fraca", color: "bg-destructive" },
    { label: "Razoável", color: "bg-yellow-500" },
    { label: "Boa", color: "bg-yellow-400" },
    { label: "Forte", color: "bg-green-500" },
    { label: "Excelente", color: "bg-green-600" },
  ];
  const level = levels[score];

  if (!password) return null;

  return (
    <div className="space-y-2 px-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-300 ${level.color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Força da senha</span>
        <span className="font-semibold">{level.label}</span>
      </div>
      <ul className="space-y-1 text-xs">
        {rules.map((r) => (
          <li
            key={r.label}
            className={`flex items-center gap-2 ${r.test ? "text-green-600" : "text-muted-foreground"}`}
          >
            <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] ${r.test ? "bg-green-600 text-white" : "border border-muted-foreground/40"}`}>
              {r.test ? "✓" : ""}
            </span>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Auth;
