import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { User, Lock, Phone, Mail, Save, MapPin, Heart, Bell, Receipt, LogOut, IdCard, Trophy, Cake } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile, useUpdatePassword } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MinhaConta = () => {
  const { user, loading, signOut } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const updatePw = useUpdatePassword();

  const [form, setForm] = useState({ display_name: "", phone: "", cpf: "", avatar_url: "", birthday: "" });
  const [pw, setPw] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        phone: profile.phone ?? "",
        cpf: (profile as any).cpf ?? "",
        avatar_url: profile.avatar_url ?? "",
        birthday: (profile as any).birthday ?? "",
      });
    }
  }, [profile]);

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

        {/* Perfil */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {form.avatar_url && <AvatarImage src={form.avatar_url} />}
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
              <Label className="flex items-center gap-1"><IdCard className="h-3 w-3" /> CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" maxLength={14} />
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
            <div className="md:col-span-2">
              <Label>URL do avatar</Label>
              <Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://..." maxLength={500} />
            </div>
          </div>

          <Button className="mt-4" onClick={() => update.mutate({ ...form, birthday: form.birthday || null } as any)} disabled={update.isPending}>
            <Save className="mr-1 h-4 w-4" /> Salvar perfil
          </Button>
        </Card>

        {/* Senha */}
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <Lock className="h-4 w-4" /> Alterar senha
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              minLength={6}
            />
            <Button
              onClick={() => {
                if (pw.length < 6) return;
                updatePw.mutate(pw);
                setPw("");
              }}
              disabled={pw.length < 6 || updatePw.isPending}
            >
              Atualizar senha
            </Button>
          </div>
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
