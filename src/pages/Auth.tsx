import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Mail, Lock, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Entrar • FoodFlash";
  }, []);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const { error } =
      mode === "signin" ? await signIn(email, password) : await signUp(email, password, name);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(mode === "signin" ? "Bem-vindo de volta! 🎉" : "Conta criada! Aproveite 🚀");
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container flex items-center justify-center py-10 md:py-16">
        <div className="w-full max-w-md rounded-3xl bg-card p-7 shadow-float">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-2xl font-bold text-primary-foreground shadow-glow">
              F
            </div>
            <h1 className="font-display text-3xl font-bold">
              {mode === "signin" ? "Bem-vindo de volta" : "Criar conta"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Entre para acessar pedidos e cashback"
                : "Cadastre-se em 30 segundos e ganhe cashback"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <Field icon={UserIcon}>
                <input
                  required
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent outline-none"
                />
              </Field>
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

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="h-12 w-full rounded-xl gradient-primary font-bold shadow-glow transition-bounce hover:scale-[1.02]"
            >
              {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar minha conta"}
            </Button>
          </form>

          <div className="mt-5 rounded-xl bg-success/5 p-3 text-center text-xs text-success">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            Ganhe 5% de cashback em todos os pedidos
          </div>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? (
              <>
                Não tem conta? <strong className="text-primary">Cadastre-se grátis</strong>
              </>
            ) : (
              <>
                Já tem conta? <strong className="text-primary">Entrar</strong>
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

export default Auth;
