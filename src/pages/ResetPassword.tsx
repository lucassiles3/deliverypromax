import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Lock } from "lucide-react";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = "Redefinir senha • Itchat Brasil";
    // Supabase recovery: session is established automatically from URL hash
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === "PASSWORD_RECOVERY" || evt === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) return toast.error("As senhas não coincidem");
    if (password.length < 6) return toast.error("Mínimo de 6 caracteres");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada! ✅");
    navigate("/");
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
            <h1 className="font-display text-3xl font-bold">Nova senha</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ready ? "Defina uma nova senha forte" : "Validando link..."}
            </p>
          </div>

          {ready ? (
            <form onSubmit={submit} className="space-y-3">
              <label className="flex items-center gap-2 rounded-xl border-2 border-border bg-background p-3 text-sm transition-smooth focus-within:border-primary">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  required
                  type="password"
                  placeholder="Nova senha"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent outline-none"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border-2 border-border bg-background p-3 text-sm transition-smooth focus-within:border-primary">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  required
                  type="password"
                  placeholder="Confirme a senha"
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full bg-transparent outline-none"
                />
              </label>
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="h-12 w-full rounded-xl gradient-primary font-bold shadow-glow transition-bounce hover:scale-[1.02]"
              >
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          ) : (
            <Link
              to="/auth"
              className="block text-center text-sm text-primary hover:underline"
            >
              ← Voltar ao login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
