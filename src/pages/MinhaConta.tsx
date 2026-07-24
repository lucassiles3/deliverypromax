import { useState, useEffect } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { User, Lock, Phone, Mail, Save, MapPin, Heart, Bell, Receipt, LogOut, Trophy, Cake, Store, Eye, EyeOff } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile, useUpdatePassword } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PasswordStrength } from "@/components/PasswordStrength";

import { useStoreAccess } from "@/hooks/useStoreAccess";

const MinhaConta = () => {
  const { user, loading, signOut, isOwner } = useAuth();
  const { data: storeAccess = [], isLoading: accessLoading } = useStoreAccess();
  const hasStores = storeAccess.length > 0;
  const showLojista = isOwner || hasStores;
  const goLojista = () => {
    if (accessLoading) return;
    if (hasStores) navigate("/admin");
    else navigate("/cadastro");
  };
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const updatePw = useUpdatePassword();

  const [form, setForm] = useState({ display_name: "", phone: "", birthday: "" });
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        phone: profile.phone ?? "",
        birthday: (profile as any).birthday ?? "",
      });
    }
  }, [profile]);

  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const isPasswordStrong = pw.length >= 6 && hasUpper && hasLower && hasNumber && hasSpecial;

  if (loading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  const initials = (form.display_name || user.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="container max-w-3xl py-6 space-y-6">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold md:text-3xl">Minha conta</h1>
        </div>

        {/* Atalhos */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <ShortcutLink to="/meus-pedidos" icon={Receipt} label="Pedidos" />
          <ShortcutLink to="/recompensas" icon={Trophy} label="Recompensas" />
          <ShortcutLink to="/enderecos" icon={MapPin} label="Endereços" />
          <ShortcutLink to="/favoritos" icon={Heart} label="Favoritos" />
          <ShortcutLink to="/notificacoes" icon={Bell} label="Notificações" />
        </div>

        {showLojista && (
          <button
            onClick={goLojista}
            disabled={accessLoading}
            className="flex w-full items-center gap-4 rounded-2xl bg-primary p-5 text-left shadow-lg shadow-primary/20 transition-transform active:scale-[0.98] disabled:opacity-70"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Store className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg font-bold text-primary-foreground">Modo Lojista</p>
              <p className="text-sm text-primary-foreground/80">
                {hasStores ? "Acessar painel de administração da loja" : "Criar sua loja e escolher um plano"}
              </p>
            </div>
            <div className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-primary-foreground">
              Ir
            </div>
          </button>
        )}

        {/* Perfil */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-display text-lg font-bold">{form.display_name || "Sem nome"}</p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-3 w-3" /> {user.email}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nome completo</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} maxLength={100} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Phone className="h-3 w-3" /> Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" maxLength={20} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Cake className="h-3 w-3" /> Aniversário</Label>
              <Input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Ganhe um cupom no seu mês 🎉</p>
            </div>
          </div>

          <Button className="mt-4" onClick={() => update.mutate({ display_name: form.display_name, phone: form.phone, birthday: form.birthday || null })} disabled={update.isPending}>
            <Save className="mr-1 h-4 w-4" /> Salvar perfil
          </Button>
        </Card>

        {/* Senha */}
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <Lock className="h-4 w-4" /> Alterar senha
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Input
                type={showPw ? "text" : "password"}
                placeholder="Nova senha"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              onClick={() => {
                if (!isPasswordStrong) return;
                updatePw.mutate(pw);
                setPw("");
              }}
              disabled={!isPasswordStrong || updatePw.isPending}
            >
              Atualizar senha
            </Button>
          </div>
          {pw.length > 0 && (
            <div className="mt-3">
              <PasswordStrength password={pw} />
            </div>
          )}
        </Card>

        <Button variant="outline" onClick={signOut} className="w-full">
          <LogOut className="mr-1 h-4 w-4" /> Sair da conta
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

const ShortcutLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <Link
    to={to}
    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-4 shadow-soft transition-smooth hover:shadow-card hover:border-primary/40"
  >
    <Icon className="h-5 w-5 text-primary" />
    <span className="text-xs font-semibold">{label}</span>
  </Link>
);

export default MinhaConta;
